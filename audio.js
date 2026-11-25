/* =========================================================
   Atelier Lueur — salon audio (Web Audio).
   Soft, warm F-major palette: short tails, gentle attack, no harsh highs.
   Music is an original seamless lounge loop (assets/audio/salon-loop.{m4a,mp3});
   a quiet procedural pad is the fallback if the file cannot be decoded.
   ========================================================= */
(function () {
  'use strict';
  const LOOP_LEN = 32 * 4 * (60 / 72);           // 32 bars at 72 BPM = 106.666… s (designed loop length)
  const SRC = ['assets/audio/salon-loop.m4a', 'assets/audio/salon-loop.mp3'];
  // F-major palette (A4=440)
  const F3 = 174.61, A3 = 220.00, C4 = 261.63, F4 = 349.23, A4 = 440.00, C5 = 523.25,
        F5 = 698.46, A5 = 880.00, C6 = 1046.50, F6 = 1396.91;
  const MERGE = [[F4, A4], [A4, C5], [C5, F5], [F5, A5], [A5, C6], [C6, F6]];

  const state = { sound: true, music: true, soundVol: 0.85, musicVol: 0.35, unlocked: false };
  let ac = null, sfxGain = null, musGain = null, master = null, ducking = null;
  let musicBuf = null, musicLoading = false, musicFailed = false;
  let musicSrc = null, musicNext = 0, musicTimer = 0, procNodes = [];
  const lastAt = Object.create(null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const vary = (f, p) => f * (1 + (Math.random() * 2 - 1) * (p == null ? 0.028 : p));
  const varyV = (v, p) => v * (1 + (Math.random() * 2 - 1) * (p == null ? 0.1 : p));

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
    const m = state.music && state.unlocked ? state.musicVol : 0;
    musGain.gain.setTargetAtTime(m, at, 0.08);
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
    musGain.gain.setTargetAtTime(base * 0.55, t, 0.03);
    musGain.gain.setTargetAtTime(base, t + (ms || 0.22), 0.08);
  }

  /* ---- a single soft voice: sine + quiet 2nd harmonic, short attack, low-pass ---- */
  function voice(opts) {
    const c = ctx(); if (!c || !state.sound || !state.unlocked) return;
    const t = (opts.when || 0) + c.currentTime + 0.003;
    const dur = opts.dur || 0.14, vol = Math.max(0.0002, varyV(opts.vol || 0.12));
    const f = vary(opts.f, opts.spread);
    const atk = opts.atk == null ? 0.012 : opts.atk;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(opts.cut || 3400, t); lp.Q.value = 0.65;
    o.type = opts.type || 'sine'; o.frequency.setValueAtTime(f, t);
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t);
    g2.gain.setValueAtTime(opts.harm == null ? 0.16 : opts.harm, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(sfxGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    duck(dur * 0.7);
  }
  function chime(freqs, step, dur, vol, cut) {
    freqs.forEach((f, i) => voice({ f: f, dur: dur || 0.14, vol: vol || 0.11, when: i * (step || 0.08), cut: cut || 3800 }));
  }
  function noiseBurst(opts) {
    const c = ctx(); if (!c || !state.sound || !state.unlocked) return;
    const t = c.currentTime + 0.003, dur = opts.dur || 0.08, n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / n * (opts.decay || 18));
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = opts.f || 700; bp.Q.value = opts.q || 0.9;
    const g = c.createGain(); g.gain.setValueAtTime(opts.vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + dur + 0.02);
  }
  function whoosh(up) {
    const c = ctx(); if (!c || !state.sound || !state.unlocked || !limited('whoosh', 120)) return;
    const t = c.currentTime + 0.003, dur = 0.2;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    o.type = 'sine';
    o.frequency.setValueAtTime(up ? F4 : C5, t);
    o.frequency.exponentialRampToValueAtTime(up ? C5 : F4, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(lp); lp.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
    noiseBurst({ dur: 0.16, f: 900, vol: 0.04, decay: 12 });
    duck(0.16);
  }

  const sfx = {
    tap:   () => { if (!limited('tap', 45)) return; voice({ f: F5, dur: 0.09, vol: 0.09, cut: 3200 }); },
    drop:  () => { if (!limited('drop', 60)) return; voice({ f: F3, dur: 0.14, vol: 0.1, cut: 1400, atk: 0.006 }); noiseBurst({ dur: 0.07, f: 500, vol: 0.05, decay: 28 }); },
    merge: (tier) => {
      if (!limited('merge', 70)) return;
      const i = clamp((tier | 0) || 1, 1, 6) - 1, pair = MERGE[i];
      voice({ f: pair[0], dur: 0.13, vol: 0.1, cut: 3400 });
      voice({ f: pair[1], dur: 0.16, vol: 0.1, when: 0.08, cut: 3600 });
      voice({ f: i >= 4 ? F6 : C6, dur: 0.11, vol: 0.045, when: 0.12, cut: 4800, harm: 0.08 });
    },
    no:    () => { if (!limited('no', 180)) return; voice({ f: A3, dur: 0.12, vol: 0.07, cut: 1800 }); voice({ f: F3, dur: 0.16, vol: 0.07, when: 0.08, cut: 1600 }); },
    spawn: () => { if (!limited('spawn', 80)) return; noiseBurst({ dur: 0.05, f: 700, vol: 0.06, decay: 30 }); voice({ f: F5, dur: 0.13, vol: 0.09, when: 0.015, cut: 3200 }); },
    ready: () => { if (!limited('ready', 400)) return; chime([C5, F5], 0.1, 0.16, 0.1, 3600); },
    deliver() { if (!limited('deliver', 200)) return; chime([F5, A5, C6], 0.08, 0.14, 0.1, 4000); },
    coin:  () => { if (!limited('coin', 90)) return; chime([A5, C6], 0.07, 0.13, 0.1, 4000); },
    level: () => { if (!limited('level', 400)) return; chime([F4, A4, C5, F5, A5], 0.11, 0.18, 0.1, 3800); },
    quest: () => { if (!limited('quest', 350)) return; chime([F5, A5, C6], 0.09, 0.15, 0.1, 4000); },
    claim: () => { if (!limited('claim', 250)) return; chime([C5, F5, A5, C6], 0.07, 0.13, 0.09, 4200); },
    shop:  () => { if (!limited('shop', 200)) return; chime([C5, F5], 0.08, 0.14, 0.1, 3400); },
    open:  () => whoosh(true),
    close: () => whoosh(false),
    unlock() { if (!limited('unlock', 400)) return; chime([F5, A5, C6, F6], 0.09, 0.16, 0.1, 5000); },
    empty: () => { if (!limited('empty', 400)) return; voice({ f: C4, dur: 0.14, vol: 0.07, cut: 1600 }); voice({ f: A3, dur: 0.2, vol: 0.07, when: 0.1, cut: 1500 }); }
  };

  /* ---- music: decoded loop with a short overlap, or a procedural pad ---- */
  function stopMusicSrc() {
    if (musicTimer) { try { clearTimeout(musicTimer); } catch (e) {} musicTimer = 0; }
    if (musicSrc) { try { musicSrc.stop(); } catch (e) {} musicSrc = null; }
    procNodes.forEach(n => { try { n.stop(); } catch (e) {} }); procNodes = [];
  }
  function scheduleBufferLoop() {
    const c = ctx(); if (!c || !musicBuf || !state.music || !state.unlocked) return;
    const overlap = 0.09;
    const startOff = 0.04;                                   // skip typical encoder priming
    const avail = Math.max(0.5, musicBuf.duration - startOff - 0.04);
    const dur = Math.min(LOOP_LEN, avail);
    const startAt = Math.max(c.currentTime + 0.02, musicNext || 0);
    const src = c.createBufferSource();
    src.buffer = musicBuf;
    src.connect(musGain);
    src.start(startAt, startOff, dur);
    musicSrc = src;
    musicNext = startAt + dur - overlap;
    const wait = Math.max(50, (musicNext - c.currentTime - 0.2) * 1000);
    musicTimer = setTimeout(() => { if (state.music && state.unlocked) scheduleBufferLoop(); }, wait);
  }
  function startProcedural() {
    const c = ctx(); if (!c || !state.music || !state.unlocked) return;
    stopMusicSrc();
    const chords = [[F3, A3, C4, F4], [F3 * 5/6, F3, A3, C4], [F3 * 4/3, F3 * 5/3, C4, F4], [C4, F3 * 4/3, F4 * 0.89, F4]]; // F, Dm, Bb, C-ish
    const step = 4 * (60 / 72); // one bar? two bars actually 60/72*4*2 wait: 2 bars = 6.666s
    const cell = 2 * 4 * (60 / 72);
    function pad(freqs, when, dur) {
      freqs.forEach((f, i) => {
        const oL = c.createOscillator(), oR = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
        const panner = c.createStereoPanner ? c.createStereoPanner() : null;
        lp.type = 'lowpass'; lp.frequency.value = 2400;
        oL.type = 'sine'; oR.type = 'sine';
        oL.frequency.value = f * 0.998; oR.frequency.value = f * 1.002;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.045 / freqs.length, when + 1.1);
        g.gain.setValueAtTime(0.045 / freqs.length, when + dur - 1.2);
        g.gain.linearRampToValueAtTime(0.0001, when + dur);
        oL.connect(g); oR.connect(g); g.connect(lp);
        if (panner) { panner.pan.value = i % 2 === 0 ? -0.3 : 0.3; lp.connect(panner); panner.connect(musGain); }
        else lp.connect(musGain);
        oL.start(when); oR.start(when); oL.stop(when + dur + 0.05); oR.stop(when + dur + 0.05);
        procNodes.push(oL, oR);
      });
    }
    const t0 = c.currentTime + 0.05;
    for (let k = 0; k < 32; k++) pad(chords[k % 4], t0 + k * cell, cell + 1.2);
    musicNext = t0 + 32 * cell - 0.8;
    musicTimer = setTimeout(() => { if (state.music && state.unlocked) startProcedural(); }, Math.max(200, (musicNext - c.currentTime) * 1000));
  }
  function loadMusic() {
    if (musicBuf || musicLoading || musicFailed) return musicBuf ? Promise.resolve(musicBuf) : Promise.resolve(null);
    const c = ctx(); if (!c) return Promise.resolve(null);
    musicLoading = true;
    const tryUrl = (i) => {
      if (i >= SRC.length) { musicFailed = true; musicLoading = false; return Promise.resolve(null); }
      return fetch(SRC[i], { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
        .then(b => new Promise((res, rej) => c.decodeAudioData(b.slice(0), res, rej)))
        .then(buf => { musicBuf = buf; musicLoading = false; return buf; })
        .catch(() => tryUrl(i + 1));
    };
    return tryUrl(0);
  }
  function startMusic() {
    const c = ctx(); if (!c || !state.music) return;
    applyGains();
    if (!state.unlocked) return;
    if (musicSrc || procNodes.length) return;                 // already playing
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

  const API = { unlock, applySettings, startMusic, stopMusic, sfx, F: { F3, A3, C4, F4, A4, C5, F5, A5, C6, F6 }, LOOP_LEN,
    get settings() { return { sound: state.sound, music: state.music, soundVol: state.soundVol, musicVol: state.musicVol, unlocked: state.unlocked }; },
    get context() { return ac; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.AUDIO = API;
})();
