/* =========================================================
   Atelier Lueur — original procedural SFX (Web Audio oscillators).
   Same tones as game.js at commit 0a79101. No background music loop:
   the music toggle and slider are saved, but nothing is played until
   the owner picks a track (sound-replacement plan is paused).
   ========================================================= */
(function () {
  'use strict';
  const state = { sound: true, music: true, soundVol: 0.85, musicVol: 0.40, unlocked: false };
  let ac = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function ctx() {
    if (ac) return ac;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ac = new C(); } catch (e) { return null; }
    return ac;
  }
  function unlockMedia() {               // re-unlock any HTMLAudio / video (music element if one is added later)
    try {
      const nodes = document.querySelectorAll('audio, video');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        try {
          if (typeof el.load === 'function' && el.error) el.load();
          if (typeof el.play === 'function' && !el.paused) {
            const p = el.play(); if (p && p.catch) p.catch(function () {});
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  function reloadBuffers() {}            // SFX are procedural oscillators; no decoded buffers to reload today
  function recreate() {
    const old = ac; ac = null;
    try { if (old && typeof old.close === 'function') old.close(); } catch (e) {}
    const c = ctx(); reloadBuffers(); return c;
  }
  function ensureRunning() {             // iOS may leave the context 'suspended' or 'interrupted' after lock/background/call
    const c = ctx();
    if (!c) return Promise.resolve(false);
    state.unlocked = true;
    unlockMedia();
    function resumeOne(x) {
      if (!x) return Promise.resolve(null);
      if (x.state === 'running') return Promise.resolve(x);
      try {
        const p = x.resume();
        if (p && typeof p.then === 'function') return p.then(function () { return x; }).catch(function () { return x; });
        return Promise.resolve(x);
      } catch (e) { return Promise.resolve(x); }
    }
    return resumeOne(c).then(function (x) {
      if (x && x.state === 'running') return true;
      const fresh = recreate();
      return resumeOne(fresh).then(function (y) { return !!(y && y.state === 'running'); });
    });
  }
  function unlock() {
    ensureRunning();
    state.unlocked = !!ac || state.unlocked;
    return !!ac || state.unlocked;
  }
  function applySettings(s) {
    if (!s) return;
    state.sound = s.sound !== false;
    state.music = s.music !== false;
    if (typeof s.soundVol === 'number') state.soundVol = clamp(s.soundVol, 0, 1);
    if (typeof s.musicVol === 'number') state.musicVol = clamp(s.musicVol, 0, 1);
  }
  function startMusic() {}
  function stopMusic() {}

  // Original tone() from 0a79101, scaled by the saved sound volume (default 0.85 ≈ the old fixed level).
  function tone(freq, dur, when, type, vol) {
    if (when == null) when = 0;
    if (type == null) type = 'sine';
    if (vol == null) vol = 0.12;
    if (!state.sound || !state.unlocked) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    const v = Math.max(0.0001, vol * (state.soundVol / 0.85));
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
  }

  const orig = {
    tap:   function () { tone(660, 0.08, 0, 'triangle'); },
    spawn: function () { tone(520, 0.08); tone(780, 0.1, 0.05); },
    merge: function () { tone(660, 0.12); tone(880, 0.12, 0.08); tone(1320, 0.2, 0.16, 'triangle'); },
    coin:  function () { [988, 1319, 1568].forEach(function (f, i) { tone(f, 0.15, i * 0.07, 'square', 0.05); }); },
    level: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, i * 0.1, 'triangle', 0.1); }); },
    no:    function () { tone(220, 0.15, 0, 'sawtooth', 0.05); }
  };
  const silent = function () {};
  // Extra names added after 0a79101: map onto the original palette, or stay silent (no original cue).
  const sfx = {
    tap: orig.tap,
    spawn: orig.spawn,
    merge: function () { orig.merge(); },          // ignore later merge(level) argument
    coin: orig.coin,
    level: orig.level,
    no: orig.no,
    drop: orig.tap,                                // original used tap when swapping two unmatched tiles
    deliver: orig.coin,                            // original order-handover cue
    shop: orig.coin,                               // original purchase cue
    unlock: orig.level,
    empty: orig.no,
    claim: orig.tap,                               // non-coin claims; coin-granting claims use coin() via sfxReward
    ready: silent,
    quest: silent,
    open: silent,
    close: silent,
    wrap: function () { tone(392, 0.14, 0, 'sine', 0.045); tone(523, 0.16, 0.12, 'triangle', 0.035); tone(349, 0.2, 0.28, 'sine', 0.03); },
    wrapDone: function () { tone(659, 0.14, 0, 'triangle', 0.05); tone(880, 0.2, 0.1, 'sine', 0.045); }
  };

  function install() {
    const wake = function () { ensureRunning(); };
    ['pointerdown', 'touchend', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, wake, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) ensureRunning();   // do not self-suspend on hide: iOS often then stays 'interrupted'
    });
    window.addEventListener('pageshow', function () { ensureRunning(); });
    window.addEventListener('focus', function () { ensureRunning(); });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }

  const API = {
    unlock: unlock,
    ensureRunning: ensureRunning,
    applySettings: applySettings,
    startMusic: startMusic,
    stopMusic: stopMusic,
    sfx: sfx,
    get settings() { return { sound: state.sound, music: state.music, soundVol: state.soundVol, musicVol: state.musicVol, unlocked: state.unlocked }; },
    get context() { return ac; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.AUDIO = API;
})();
