/* =========================================================
   Atelier Lueur — cafe / boutique audio (Web Audio).
   Original percussive SFX bank + a cheerful 112 BPM cafe-bossa loop.
   Nothing here is sampled from another game. See assets/audio/CREDITS.txt.
   ========================================================= */
(function () {
  'use strict';
  const LOOP_LEN = 56 * 4 * (60 / 112);                 // 120 s
  const MUSIC_SRC = ['assets/audio/cafe-loop.m4a', 'assets/audio/cafe-loop.mp3'];
  const BANK_SRC  = ['assets/audio/sfx-bank.m4a', 'assets/audio/sfx-bank.mp3'];
  const BANK_JSON = 'assets/audio/sfx-bank.json';
  // merge staircase: major-third / triad steps, capped just under 3x
  const MERGE_RATES = [1, Math.pow(2, 4/12), Math.pow(2, 7/12), 2, Math.pow(2, 16/12), Math.pow(2, 19/12)];

  const state = { sound: true, music: true, soundVol: 0.85, musicVol: 0.40, unlocked: false };
  let ac = null, sfxGain = null, musGain = null, master = null;
  let musicBuf = null, musicLoading = false, musicFailed = false;
  let bankBuf = null, bankMap = null, bankLoading = false, bankFailed = false;
  let musicSrc = null, musicNext = 0, musicTimer = 0, procNodes = [];
  const lastAt = Object.create(null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const vary = (f, p) => f * (1 + (Math.random() * 2 - 1) * (p == null ? 0.03 : p));

  function ctx() {
    if (ac) return ac;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ac = new C(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = state.soundVol; sfxGain.connect(master);
    musGain = ac.createGain(); musGain.gain.value = 0; musGain.connect(master);
    return ac;
  }
  function applyGains(t) {
    if (!ac) return;
    const at = t || ac.currentTime;
    sfxGain.gain.setTargetAtTime(state.sound && state.unlocked ? state.soundVol : 0, at, 0.04);
    musGain.gain.setTargetAtTime(state.music && state.unlocked ? state.musicVol : 0, at, 0.08);
  }
  function limited(key, ms) {
    const n = nowMs();
    if (lastAt[key] && n - lastAt[key] < ms) return false;
    lastAt[key] = n; return true;
  }
  function duck(ms) {
    if (!ac || !state.music || !state.unlocked) return;
    const t = ac.currentTime, base = state.musicVol;
    musGain.gain.cancelScheduledValues(t);
    musGain.gain.setTargetAtTime(base * 0.45, t, 0.03);
    musGain.gain.setTargetAtTime(base, t + (ms || 0.22), 0.10);
  }

  function decodeFirst(urls) {
    const c = ctx(); if (!c) return Promise.resolve(null);
    const tryUrl = (i) => {
      if (i >= urls.length) return Promise.resolve(null);
      return fetch(urls[i], { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
        .then(b => new Promise((res, rej) => c.decodeAudioData(b.slice(0), res, rej)))
        .catch(() => tryUrl(i + 1));
    };
    return tryUrl(0);
  }
  function loadMusic() {
    if (musicBuf || musicLoading || musicFailed) return musicBuf ? Promise.resolve(musicBuf) : Promise.resolve(null);
    musicLoading = true;
    return decodeFirst(MUSIC_SRC).then(buf => {
      musicLoading = false;
      if (buf) musicBuf = buf; else musicFailed = true;
      return musicBuf;
    });
  }
  function loadBank() {
    if (bankBuf && bankMap) return Promise.resolve(true);
    if (bankFailed) return Promise.resolve(false);
    if (bankLoading) return bankLoading;
    bankLoading = Promise.all([
      fetch(BANK_JSON, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('http'); return r.json(); }),
      decodeFirst(BANK_SRC)
    ]).then(([meta, buf]) => {
      bankLoading = null;
      if (!meta || !buf) { bankFailed = true; return false; }
      bankMap = meta; bankBuf = buf; return true;
    }).catch(() => { bankLoading = null; bankFailed = true; return false; });
    return bankLoading;
  }

  /* ---- sample playback from the packed bank ---- */
  function playBank(name, opts) {
    const c = ctx(); if (!c || !state.sound || !state.unlocked || !bankBuf || !bankMap) return false;
    const key = (bankMap.aliases && bankMap.aliases[name]) || name;
    const reg = bankMap.sounds && bankMap.sounds[key];
    if (!reg) return false;
    const rate = (opts && opts.rate) || 1;
    const vol  = (opts && opts.vol)  || 1;
    const t = c.currentTime + 0.003;
    const src = c.createBufferSource();
    src.buffer = bankBuf;
    src.playbackRate.setValueAtTime(rate, t);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    src.connect(g); g.connect(sfxGain);
    // start's duration is in seconds of the SOURCE buffer
    src.start(t, reg.start, reg.dur);
    duck(Math.max(0.12, (reg.dur / rate) * 0.7));
    return true;
  }

  /* ---- tiny procedural fallback if the bank cannot be decoded ---- */
  function voice(opts) {
    const c = ctx(); if (!c || !state.sound || !state.unlocked) return;
    const t = c.currentTime + 0.003, dur = opts.dur || 0.12, f = opts.f, vol = opts.vol || 0.12;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = opts.cut || 2800;
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
    if (opts.f2) o.frequency.exponentialRampToValueAtTime(opts.f2, t + dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(lp); lp.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
    duck(dur * 0.7);
  }
  function fallback(name, tier) {
    if (name === 'spawn') return voice({ f: 1280, f2: 420, dur: 0.14, vol: 0.14, cut: 4200 });
    if (name === 'tap')   return voice({ f: 2100, dur: 0.04, vol: 0.08, cut: 5000 });
    if (name === 'merge') {
      const r = MERGE_RATES[clamp((tier | 0) || 1, 1, 6) - 1];
      return voice({ f: 392 * r, dur: 0.18, vol: 0.16, cut: 4000 });
    }
    if (name === 'coin' || name === 'deliver') {
      voice({ f: 784, dur: 0.25, vol: 0.12, cut: 5000 });
      voice({ f: 1047, dur: 0.3, vol: 0.12, cut: 5000 });
      return;
    }
    voice({ f: 330, dur: 0.12, vol: 0.08, cut: 1800 });
  }
  function play(name, opts) {
    if (playBank(name, opts)) return;
    if (bankFailed) fallback(name, opts && opts.tier);
    else loadBank().then(ok => { if (ok) playBank(name, opts); else fallback(name, opts && opts.tier); });
  }

  const sfx = {
    tap:   () => { if (!limited('tap', 45)) return; play('tap'); },
    drop:  () => { if (!limited('drop', 60)) return; play('drop'); },
    spawn: () => { if (!limited('spawn', 70)) return; play('spawn', { rate: vary(1, 0.03) }); },
    merge: (tier) => {
      if (!limited('merge', 80)) return;
      const i = clamp((tier | 0) || 1, 1, 6) - 1;
      play('merge', { rate: MERGE_RATES[i], tier: i + 1 });
    },
    no:     () => { if (!limited('no', 180)) return; play('no'); },
    empty:  () => { if (!limited('empty', 400)) return; play('empty'); },
    ready:  () => { if (!limited('ready', 400)) return; play('ready'); },
    coin:   () => { if (!limited('coin', 220)) return; play('coin'); },
    deliver() { if (!limited('deliver', 220)) return; play('coin'); },
    quest:  () => { if (!limited('quest', 350)) return; play('quest'); },
    claim:  () => { if (!limited('claim', 250)) return; play('claim'); },
    shop:   () => { if (!limited('shop', 200)) return; play('shop'); },
    open:   () => { if (!limited('whoosh', 140)) return; play('open'); },
    close:  () => { if (!limited('whoosh', 140)) return; play('close'); },
    unlock() { if (!limited('unlock', 400)) return; play('unlock'); },
    level:  () => { if (!limited('level', 400)) return; play('level'); }
  };

  /* ---- music loop with a short overlap (lossy encoders add priming) ---- */
  function stopMusicSrc() {
    if (musicTimer) { try { clearTimeout(musicTimer); } catch (e) {} musicTimer = 0; }
    if (musicSrc) { try { musicSrc.stop(); } catch (e) {} musicSrc = null; }
    procNodes.forEach(n => { try { n.stop(); } catch (e) {} }); procNodes = [];
  }
  function scheduleBufferLoop() {
    const c = ctx(); if (!c || !musicBuf || !state.music || !state.unlocked) return;
    const overlap = 0.09, startOff = 0.04;
    const avail = Math.max(0.5, musicBuf.duration - startOff - 0.04);
    const dur = Math.min(LOOP_LEN, avail);
    const startAt = Math.max(c.currentTime + 0.02, musicNext || 0);
    const src = c.createBufferSource();
    src.buffer = musicBuf; src.connect(musGain);
    src.start(startAt, startOff, dur);
    musicSrc = src;
    musicNext = startAt + dur - overlap;
    const wait = Math.max(50, (musicNext - c.currentTime - 0.2) * 1000);
    musicTimer = setTimeout(() => { if (state.music && state.unlocked) scheduleBufferLoop(); }, wait);
  }
  function startProcedural() {
    const c = ctx(); if (!c || !state.music || !state.unlocked) return;
    stopMusicSrc();
    const step = 4 * (60 / 112);
    function pulse(when, f, dur, vol) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(musGain);
      o.start(when); o.stop(when + dur + 0.02); procNodes.push(o);
    }
    const t0 = c.currentTime + 0.05;
    for (let k = 0; k < 32; k++) {
      const t = t0 + k * step;
      pulse(t, 130.81, 0.4, 0.04);
      pulse(t + 0.5, 196.0, 0.2, 0.03);
    }
    musicNext = t0 + 32 * step - 0.5;
    musicTimer = setTimeout(() => { if (state.music && state.unlocked) startProcedural(); }, Math.max(200, (musicNext - c.currentTime) * 1000));
  }
  function startMusic() {
    const c = ctx(); if (!c || !state.music) return;
    applyGains();
    if (!state.unlocked) return;
    if (musicSrc || procNodes.length) return;
    loadMusic().then(buf => {
      if (!state.music || !state.unlocked) return;
      if (buf) { musicNext = 0; scheduleBufferLoop(); }
      else startProcedural();
    });
  }
  function stopMusic() {
    stopMusicSrc();
    if (ac && musGain) musGain.gain.setTargetAtTime(0, ac.currentTime, 0.08);
  }

  function unlock() {
    const c = ctx(); if (!c) return false;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    if (!state.unlocked) {
      try {
        const o = c.createOscillator(), g = c.createGain();
        g.gain.value = 0; o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.02);
      } catch (e) {}
      state.unlocked = true;
      applyGains();
      loadBank();
      if (state.music) startMusic();
    }
    return true;
  }
  function applySettings(s) {
    if (!s) return;
    state.sound = s.sound !== false;
    state.music = s.music !== false;
    if (typeof s.soundVol === 'number') state.soundVol = clamp(s.soundVol, 0, 1);
    if (typeof s.musicVol === 'number') state.musicVol = clamp(s.musicVol, 0, 1);
    const c = ctx();
    applyGains(c && c.currentTime);
    if (state.music && state.unlocked) startMusic(); else stopMusic();
  }
  function onHidden() {
    if (!ac) return;
    stopMusicSrc();
    try { if (ac.state === 'running') ac.suspend(); } catch (e) {}
  }
  function onVisible() {
    const c = ctx(); if (!c) return;
    try { if (c.state === 'suspended') c.resume(); } catch (e) {}
    if (state.unlocked && state.music) { musicNext = 0; startMusic(); }
  }
  function install() {
    const wake = () => unlock();
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(ev =>
      document.addEventListener(ev, wake, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) onHidden(); else onVisible(); });
    window.addEventListener('pagehide', onHidden);
    window.addEventListener('pageshow', onVisible);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }

  const API = { unlock, applySettings, startMusic, stopMusic, sfx, LOOP_LEN, MERGE_RATES,
    get settings() { return { sound: state.sound, music: state.music, soundVol: state.soundVol, musicVol: state.musicVol, unlocked: state.unlocked }; },
    get context() { return ac; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.AUDIO = API;
})();
