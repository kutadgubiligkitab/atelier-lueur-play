/* =========================================================
   Atelier Lueur — save protection and portable save transfer (shared by load / backup / import)

   * validateState(): checks the REAL game-state structure (see newGame() in game.js) and returns a clean copy.
   * Primary key stays `atelierLueur.v2`; a separate last-known-good backup and a preserved-corrupt slot sit beside it.
   * Nothing here evaluates imported content: only JSON.parse + an allow-list validator that builds NEW plain objects.
   * Export contains game PROGRESS only (no device settings, no letter text, no configuration, no code).
   ========================================================= */
(function () {
  'use strict';

  const FORMAT = 'atelier-lueur-save';
  const ENVELOPE_VERSION = 1;
  const MAX_IMPORT_BYTES = 1024 * 1024;           // 1 MiB (a real save is a few KB)
  const BACKUP_EVERY_MS = 60 * 1000;
  const BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };

  let CFG = null;
  function configure(c) { CFG = c; }

  // plain object (any realm): prototype is null or a root prototype whose own prototype is null
  const isObj = x => { if (x === null || typeof x !== 'object' || Array.isArray(x)) return false; const p = Object.getPrototypeOf(x); return p === null || Object.getPrototypeOf(p) === null; };
  const isNum = (x, min, max) => typeof x === 'number' && isFinite(x) && x >= min && x <= max;
  const isInt = (x, min, max) => isNum(x, min, max) && Math.floor(x) === x;
  const flag = x => x === 1 || x === true;

  /** Copy a map of flag values (1/true) with allow-listed key pattern and a size cap. */
  function flagMap(src, keyRe, maxKeys) {
    if (!isObj(src)) return null;
    const keys = Object.keys(src);
    if (keys.length > maxKeys) return null;
    const out = {};
    for (const k of keys) {
      if (BAD_KEYS[k] || !keyRe.test(k) || !flag(src[k])) return null;
      out[k] = 1;
    }
    return out;
  }
  function counters(src) {                          // {k:'2026-11-22', merge:3, ...}
    if (!isObj(src) || typeof src.k !== 'string' || src.k.length > 20) return null;
    const keys = Object.keys(src);
    if (keys.length > 24) return null;
    const out = {};
    for (const k of keys) {
      if (BAD_KEYS[k] || !/^[a-zA-Z]{1,16}$/.test(k)) return null;
      if (k === 'k') { out.k = src.k; continue; }
      if (!isNum(src[k], 0, 1e9)) return null;
      out[k] = src[k];
    }
    return out;
  }
  function clamp01(v, d){ return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : d; }
  function normalizeSet(s){
    if (s != null && !isObj(s)) return null;
    s = s || {};
    if (s.lang !== undefined && typeof s.lang !== 'string') return null;
    if (s.sound !== undefined && typeof s.sound !== 'boolean') return null;
    if (s.vib !== undefined && typeof s.vib !== 'boolean') return null;
    if (s.music !== undefined && typeof s.music !== 'boolean') return null;
    if (s.soundVol !== undefined && typeof s.soundVol !== 'number') return null;
    if (s.musicVol !== undefined && typeof s.musicVol !== 'number') return null;
    const lang = (typeof s.lang === 'string' && CFG.LANG_KEYS.indexOf(s.lang) >= 0) ? s.lang : 'ug';
    return { sound: s.sound !== false, music: s.music !== false, vib: s.vib !== false, lang,
      soundVol: clamp01(s.soundVol, 0.85), musicVol: clamp01(s.musicVol, 0.40) };
  }

  /**
   * Returns {ok:true, state} (a NEW clean object) or {ok:false, code}.
   * Missing optional fields get the same defaults newGame() uses; unknown fields and wrong types are rejected.
   */
  function validateState(s) {
    if (!CFG) throw new Error('SAVE.configure() was not called');
    const bad = code => ({ ok: false, code });
    if (!isObj(s)) return bad('not-object');
    const allowed = ['v', 'board', 'energy', 'et', 'coins', 'stars', 'gems', 'lv', 'orders', 'seen', 'owned', 'road', 'album', 'cnt', 'claimed', 'gift', 'set', 'secretSeen', 'ev', 'queue', 'qid', 'pg', 'pbuy', 'ecap', 'vo', 've', 'atl', 'msn', 'eshop', 'ptcg', 'ptgg', 'tut', 'inv', 'gst', 'ghs', 'ghp'];
    for (const k of Object.keys(s)) if (allowed.indexOf(k) < 0) return bad('unknown-field:' + k);
    if (s.v !== 2) return bad('version');

    // board: 56 cells; item {c,l} | producer {g,l,t?} | gift/gem box {box} | loose gem {gem}
    if (!Array.isArray(s.board) || s.board.length !== CFG.N) return bad('board');
    const board = [];
    for (const it of s.board) {
      if (it === null) { board.push(null); continue; }
      if (!isObj(it)) return bad('cell');
      const keys = Object.keys(it);
      if (it.c !== undefined && it.g === undefined && it.box === undefined && it.gem === undefined) {
        if (CFG.CHAINS.indexOf(it.c) < 0 || !isInt(it.l, 1, CFG.MAXLV)) return bad('item');
        if (keys.some(k => k !== 'c' && k !== 'l')) return bad('item-field');
        board.push({ c: it.c, l: it.l });
      } else if (it.g !== undefined && it.c === undefined && it.box === undefined && it.gem === undefined) {
        if (CFG.GEN_TYPES.indexOf(it.g) < 0 || !isInt(it.l, 1, CFG.GEN_MAXLV)) return bad('producer');
        if (keys.some(k => k !== 'g' && k !== 'l' && k !== 'ch' && k !== 't' && k !== 'n' && k !== 'rt')) return bad('producer-field');
        const g = { g: it.g, l: it.l };
        if (it.ch !== undefined) { if (!isNum(it.ch, 0, 1e6)) return bad('producer'); g.ch = it.ch; }
        if (it.t !== undefined) { if (!isNum(it.t, 0, 1e15)) return bad('producer'); g.t = it.t; }
        if (it.n !== undefined) { if (!isInt(it.n, 0, 20)) return bad('producer'); g.n = it.n; }
        if (it.rt !== undefined) { if (!isNum(it.rt, 0, 1e15)) return bad('producer'); g.rt = it.rt; }
        board.push(g);
      } else if (it.box === 'gift' || it.box === 'gem') {
        if (keys.some(k => k !== 'box')) return bad('box-field');
        board.push({ box: it.box });
      } else if (it.gem !== undefined) {
        if (!isInt(it.gem, 1, 20) || keys.some(k => k !== 'gem')) return bad('gem-item');
        board.push({ gem: it.gem });
      } else return bad('cell');
    }

    if (!isNum(s.energy, 0, 1e6)) return bad('energy');
    if (!isNum(s.coins, 0, 1e9)) return bad('coins');
    if (!isNum(s.stars, 0, 1e9)) return bad('stars');
    const gems = s.gems === undefined ? 0 : s.gems;
    if (!isInt(gems, 0, 1e9)) return bad('gems');
    if (!isInt(s.lv, 1, 10000)) return bad('level');
    const et = s.et === undefined ? Date.now() : s.et;
    if (!isNum(et, 0, 1e15)) return bad('et');

    if (!Array.isArray(s.orders) || s.orders.length > 3) return bad('orders');
    const orders = [];
    for (const o of s.orders) {
      if (o === null) { orders.push(null); continue; }
      if (!isObj(o)) return bad('order');
      if (Object.keys(o).some(k => ['c', 'l', 'n', 'coins', 'stars', 'isNew', 'm', 'who'].indexOf(k) < 0)) return bad('order-field');
      if (CFG.CHAINS.indexOf(o.c) < 0 || !isInt(o.l, 1, CFG.MAXLV) || !isInt(o.n, 1, 99) || !isNum(o.coins, 0, 1e9) || !isNum(o.stars, 0, 1e9)) return bad('order');
      if (o.isNew !== undefined && typeof o.isNew !== 'boolean') return bad('order');
      const c = { c: o.c, l: o.l, n: o.n, coins: o.coins, stars: o.stars };
      if (o.isNew !== undefined) c.isNew = o.isNew;
      if (o.who !== undefined) { if (typeof o.who !== 'string' || !CFG.CUSTOMERS || CFG.CUSTOMERS.indexOf(o.who) < 0) return bad('order-who'); c.who = o.who; }   // customer identity (immutable registry ids)
      if (o.m !== undefined) {                                         // mixed-family order: a second requirement of a DIFFERENT family
        if (!isObj(o.m) || Object.keys(o.m).some(k => ['c', 'l', 'n'].indexOf(k) < 0) || CFG.CHAINS.indexOf(o.m.c) < 0 || o.m.c === o.c || !isInt(o.m.l, 1, CFG.MAXLV) || !isInt(o.m.n, 1, 99)) return bad('order-mixed');
        c.m = { c: o.m.c, l: o.m.l, n: o.m.n };
      }
      orders.push(c);
    }

    const seen = flagMap(s.seen, new RegExp('^(' + CFG.CHAINS.join('|') + ')[1-9]$'), 64); if (!seen) return bad('seen');
    // all salon areas' props live in S.owned (salon-data.js); ids unknown to this build are preserved but ignored by it
    const owned = flagMap(s.owned, /^[a-z]{1,24}$/, 256); if (!owned) return bad('owned');
    const road = flagMap(s.road === undefined ? {} : s.road, /^[0-9]{1,5}$/, 2000); if (!road) return bad('road');
    const album = flagMap(s.album === undefined ? {} : s.album, /^[a-z]{1,16}$/, 32); if (!album) return bad('album');
    const claimed = flagMap(s.claimed === undefined ? {} : s.claimed, /^[A-Za-z0-9_\-]{1,40}$/, 600); if (!claimed) return bad('claimed');

    if (!isObj(s.cnt)) return bad('cnt');
    const day = counters(s.cnt.day), week = counters(s.cnt.week);
    const month = s.cnt.month === undefined ? null : counters(s.cnt.month);
    if (!day || !week || Object.keys(s.cnt).some(k => k !== 'day' && k !== 'week' && k !== 'month')) return bad('cnt');
    if (s.cnt.month !== undefined && !month) return bad('cnt');

    const gift = s.gift === undefined ? '' : s.gift;
    if (typeof gift !== 'string' || gift.length > 20) return bad('gift');
    const secretSeen = s.secretSeen === undefined ? false : s.secretSeen;
    if (typeof secretSeen !== 'boolean') return bad('secretSeen');

    if (s.set != null && !isObj(s.set)) return bad('settings');
    const set = normalizeSet(s.set);
    if (!set) return bad('settings');
    s.set = set;

    // monthly-event progress + claim records live INSIDE the save so wallet and claims are one document (optional; absent for players without events)
    let ev;
    if (s.ev !== undefined) { const r = CFG.validateEv ? CFG.validateEv(s.ev) : { ok: false }; if (!r.ok) return bad('ev'); ev = r.value; }

    // producer supply (optional; created when a producer is first granted/queued/bought): persistent delivery queue, ledger of granted milestones, purchase counters
    let queue, qid, pg, pbuy;
    if (s.queue !== undefined) {
      if (!Array.isArray(s.queue) || s.queue.length < 1 || s.queue.length > 12) return bad('queue');
      queue = []; for (const q of s.queue) { if (!isObj(q) || Object.keys(q).some(k => ['g', 'l', 'id'].indexOf(k) < 0) || CFG.GEN_TYPES.indexOf(q.g) < 0 || !isInt(q.l, 1, CFG.GEN_MAXLV) || !isInt(q.id, 1, 1e9)) return bad('queue'); queue.push({ g: q.g, l: q.l, id: q.id }); }
      if (new Set(queue.map(q => q.id)).size !== queue.length) return bad('queue');
    }
    if (s.qid !== undefined) { if (!isInt(s.qid, 0, 1e9)) return bad('qid'); qid = s.qid; }
    if (s.pg !== undefined) { pg = flagMap(s.pg, /^[a-z]{2,8}-[0-9]{1,4}$/, 64); if (!pg) return bad('pg'); }
    if (s.pbuy !== undefined) {
      if (!isObj(s.pbuy) || Object.keys(s.pbuy).some(k => CFG.GEN_TYPES.indexOf(k) < 0 || !isInt(s.pbuy[k], 0, 99999))) return bad('pbuy');
      pbuy = {}; Object.keys(s.pbuy).forEach(k => { pbuy[k] = s.pbuy[k]; });
    }

    // salon colour variants (optional; created by the first colour purchase): vo = owned colours {slot_colour: 1}, ve = equipped colour per slot {slot: colour}.
    // Shape is validated here; CONSISTENCY with slot ownership (a colour needs its slot, an equipped colour must be owned and valid) is delegated to the salon registry
    // (CFG.checkVariants). Ids unknown to this build are kept but never count; absent fields mean "no explicit colour records" (legacy owned slots own their default colour).
    let vo, ve;
    if (s.vo !== undefined) { vo = flagMap(s.vo, /^[a-z]{1,24}_[a-z]{1,12}$/, 512); if (!vo) return bad('vo'); }
    if (s.ve !== undefined) {
      if (!isObj(s.ve) || Object.keys(s.ve).length > 128) return bad('ve');
      ve = {}; for (const k of Object.keys(s.ve)) { if (BAD_KEYS[k] || !/^[a-z]{1,24}$/.test(k) || typeof s.ve[k] !== 'string' || !/^[a-z]{1,12}$/.test(s.ve[k])) return bad('ve'); ve[k] = s.ve[k]; }
    }
    if ((vo !== undefined || ve !== undefined) && CFG.checkVariants) { const why = CFG.checkVariants(owned, vo || {}, ve || {}); if (why) return bad('variants:' + why); }

    // Makeup Atelier state (optional; absent for every player until the feature is wired in): structure only. Rules/consistency live in atelier.js.
    let atl;
    if (s.atl !== undefined) {
      const a = s.atl, RID = x => x === 'A' || x === 'B';
      if (!isObj(a) || Object.keys(a).some(k => ['v', 'u', 'd', 's', 'n', 'cur'].indexOf(k) < 0) || a.v !== 1 || a.u !== 1 || !isInt(a.d, 0, 1e6) || !isInt(a.s, 0, 1000) || !isInt(a.n, 0, 1e6)) return bad('atl');
      atl = { v: 1, u: 1, d: a.d, s: a.s, n: a.n };
      if (a.cur !== undefined) {
        const c = a.cur;
        if (!isObj(c) || Object.keys(c).some(k => ['r', 'n', 'coins', 'stars'].indexOf(k) < 0) || !RID(c.r) || !isInt(c.n, 1, 1e6) || !isInt(c.coins, 0, 1e6) || !isInt(c.stars, 0, 1e6)) return bad('atl');
        atl.cur = { r: c.r, n: c.n, coins: c.coins, stars: c.stars };
      }
    }

    if (atl !== undefined && s.lv < 25) return bad('atl-level');   // an unlocked Atelier needs level >= 25 (UNLOCK_LEVEL in atelier.js): no Atelier state/copies on a lower-level save

    // daily/weekly/monthly missions (optional). Structure only; rules live in missions.js. v:1 snapshots stay valid so older saves can be imported; the game migrates them to v:2 on load.
    let msn;
    if (s.msn !== undefined) {
      const ext = (typeof window !== 'undefined' && window.MISSIONS && window.MISSIONS.sanitizeMsn) ? window.MISSIONS.sanitizeMsn(s.msn, CFG.CHAINS) : null;
      if (ext) msn = ext;
      else {
        const m = s.msn, TPL = ['tap', 'fam', 'mix'], rew = r => isObj(r) && Object.keys(r).length >= 1 && Object.keys(r).length <= 3 && Object.keys(r).every(k => ['coins', 'energy', 'stars'].indexOf(k) >= 0 && isInt(r[k], 0, 1e6));
        if (!isObj(m) || m.v !== 1 || Object.keys(m).some(k => ['v', 'last', 'lw', 'day', 'week'].indexOf(k) < 0) || (m.last !== undefined && TPL.indexOf(m.last) < 0)) return bad('msn');
        msn = { v: 1 }; if (m.last !== undefined) msn.last = m.last;
        const T4 = ['tap', 'fam'], T5 = ['coin', 'mix', 'atl'];
        if (m.lw !== undefined){ if (!isObj(m.lw) || Object.keys(m.lw).some(k => k !== 'a' && k !== 'b') || T4.indexOf(m.lw.a) < 0 || T5.indexOf(m.lw.b) < 0) return bad('msn'); msn.lw = { a: m.lw.a, b: m.lw.b }; }
        if (m.day !== undefined) {
          const d = m.day;
          if (!isObj(d) || Object.keys(d).some(k => ['k', 't', 'n', 'f', 'a', 'r3', 'r4', 'n4'].indexOf(k) < 0) || typeof d.k !== 'string' || d.k.length > 20 || TPL.indexOf(d.t) < 0 || !isInt(d.n, 1, 1000) || (d.a !== 0 && d.a !== 1) || !rew(d.r3) || !rew(d.r4) || !isInt(d.n4, 1, 100000)) return bad('msn');
          const nd = { k: d.k, t: d.t, n: d.n, a: d.a, r3: Object.assign({}, d.r3), r4: Object.assign({}, d.r4), n4: d.n4 };
          if (d.f !== undefined) { if (!Array.isArray(d.f) || d.f.length > 8 || d.f.some(c => CFG.CHAINS.indexOf(c) < 0)) return bad('msn'); nd.f = d.f.slice(); }
          if (d.t === 'fam' && !(nd.f && nd.f.length >= 1)) return bad('msn');
          msn.day = nd;
        }
        if (m.week !== undefined) {
          const w = m.week;
          if (!isObj(w) || Object.keys(w).some(k => k !== 'k' && k !== 'done' && k !== 's') || typeof w.k !== 'string' || w.k.length > 20 || !Array.isArray(w.done) || w.done.length > 40 || w.done.some(x => typeof x !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}:[1-4]$/.test(x)) || new Set(w.done).size !== w.done.length) return bad('msn');
          msn.week = { k: w.k, done: w.done.slice() };
          if (w.s !== undefined){
            const t = w.s;
            if (!isObj(t) || Object.keys(t).some(k => ['a', 'b', 'n4', 'n5', 'r4', 'r5', 'f'].indexOf(k) < 0) || T4.indexOf(t.a) < 0 || T5.indexOf(t.b) < 0 || !isInt(t.n4, 1, 100000) || !isInt(t.n5, 1, 100000) || !rew(t.r4) || !rew(t.r5)) return bad('msn');
            const nt = { a: t.a, b: t.b, n4: t.n4, n5: t.n5, r4: Object.assign({}, t.r4), r5: Object.assign({}, t.r5) };
            if (t.f !== undefined){ if (!Array.isArray(t.f) || t.f.length > 8 || t.f.some(c => CFG.CHAINS.indexOf(c) < 0)) return bad('msn'); nt.f = t.f.slice(); }
            if (t.a === 'fam' && !(nt.f && nt.f.length >= 2)) return bad('msn');
            msn.week.s = nt;
          }
        }
      }
    }
    let eshop;
    if (s.eshop !== undefined) {
      const e = s.eshop;
      if (!isObj(e) || e.v !== 1 || Object.keys(e).some(k => ['v', 'k', 'n20', 'n50'].indexOf(k) < 0) || typeof e.k !== 'string' || e.k.length > 20 || !isInt(e.n20, 0, 100) || !isInt(e.n50, 0, 100)) return bad('eshop');
      eshop = { v: 1, k: e.k, n20: e.n20, n50: e.n50 };
    }

    let ecap; if (s.ecap !== undefined) { if (!isInt(s.ecap, 1, 100000)) return bad('ecap'); ecap = s.ecap; }   // energy-cap version of this save (absent = written under the old cap)
    let ptcg; if (s.ptcg !== undefined) { if (s.ptcg !== 0 && s.ptcg !== 1) return bad('ptcg'); ptcg = s.ptcg; }   // playtest coin-grant flag (optional; ignored when the grant is off)
    let ptgg; if (s.ptgg !== undefined) { if (s.ptgg !== 0 && s.ptgg !== 1) return bad('ptgg'); ptgg = s.ptgg; }   // playtest gem-grant flag (optional; once per save)
    let tut; if (s.tut !== undefined) { if (!isInt(s.tut, 0, 5)) return bad('tut'); tut = s.tut; }   // 0-4 first-play tutorial step, 5 = finished (existing saves migrate to 5)
    let inv;
    if (s.inv !== undefined) {
      const v = s.inv, caps = [4, 8, 12, 16];
      if (!isObj(v) || v.v !== 1 || Object.keys(v).some(k => k !== 'v' && k !== 'cap' && k !== 'items') || caps.indexOf(v.cap) < 0 || !Array.isArray(v.items) || v.items.length > v.cap) return bad('inv');
      const items = [];
      for (const it of v.items) {
        if (!isObj(it)) return bad('inv');
        const keys = Object.keys(it);
        if (it.c !== undefined && it.g === undefined && it.box === undefined && it.gem === undefined) {
          if (CFG.CHAINS.indexOf(it.c) < 0 || !isInt(it.l, 1, CFG.MAXLV) || keys.some(k => k !== 'c' && k !== 'l')) return bad('inv');
          items.push({ c: it.c, l: it.l });
        } else if (it.g !== undefined && it.c === undefined && it.box === undefined && it.gem === undefined) {
          if (CFG.GEN_TYPES.indexOf(it.g) < 0 || !isInt(it.l, 1, CFG.GEN_MAXLV) || keys.some(k => k !== 'g' && k !== 'l' && k !== 'ch' && k !== 't' && k !== 'n' && k !== 'rt')) return bad('inv');
          const g = { g: it.g, l: it.l };
          if (it.ch !== undefined) { if (!isNum(it.ch, 0, 1e6)) return bad('inv'); g.ch = it.ch; }
          if (it.t !== undefined) { if (!isNum(it.t, 0, 1e15)) return bad('inv'); g.t = it.t; }
          if (it.n !== undefined) { if (!isInt(it.n, 0, 20)) return bad('inv'); g.n = it.n; }
          if (it.rt !== undefined) { if (!isNum(it.rt, 0, 1e15)) return bad('inv'); g.rt = it.rt; }
          items.push(g);
        } else if (it.box === 'gift' || it.box === 'gem') {
          if (keys.some(k => k !== 'box')) return bad('inv');
          items.push({ box: it.box });
        } else if (it.gem !== undefined) {
          if (!isInt(it.gem, 1, 20) || keys.some(k => k !== 'gem')) return bad('inv');
          items.push({ gem: it.gem });
        } else return bad('inv');
      }
      inv = { v: 1, cap: v.cap, items };
    }
    let gst;
    if (s.gst !== undefined) {
      if (!isObj(s.gst) || Object.keys(s.gst).some(k => k !== 'k' && k !== 'n') || typeof s.gst.k !== 'string' || s.gst.k.length > 20 || !isInt(s.gst.n, 1, 7)) return bad('gst');
      gst = { k: s.gst.k, n: s.gst.n };
    }
    let ghs; if (s.ghs !== undefined) { if (!isInt(s.ghs, 0, 3)) return bad('ghs'); ghs = s.ghs; }   // times the long-press hint was shown (0–3)
    let ghp; if (s.ghp !== undefined) { if (s.ghp !== 0 && s.ghp !== 1) return bad('ghp'); ghp = s.ghp; }   // 1 = the player has long-pressed a generator once

    const out = { ok: true, state: {
      v: 2, board, energy: s.energy, et, coins: s.coins, stars: s.stars, gems, lv: s.lv, orders, seen, owned, road, album,
      cnt: month ? { day, week, month } : { day, week }, claimed, gift, set: { sound: s.set.sound, music: s.set.music, soundVol: s.set.soundVol, musicVol: s.set.musicVol, vib: s.set.vib, lang: s.set.lang }, secretSeen,
    } };
    if (ev !== undefined) out.state.ev = ev;
    if (ecap !== undefined) out.state.ecap = ecap;
    if (vo !== undefined) out.state.vo = vo;
    if (ve !== undefined) out.state.ve = ve;
    if (queue !== undefined) out.state.queue = queue;
    if (qid !== undefined) out.state.qid = qid;
    if (pg !== undefined) out.state.pg = pg;
    if (pbuy !== undefined) out.state.pbuy = pbuy;
    if (atl !== undefined) out.state.atl = atl;
    if (msn !== undefined) out.state.msn = msn;
    if (eshop !== undefined) out.state.eshop = eshop;
    if (ptcg !== undefined) out.state.ptcg = ptcg;
    if (ptgg !== undefined) out.state.ptgg = ptgg;
    if (tut !== undefined) out.state.tut = tut;
    if (inv !== undefined) out.state.inv = inv;
    if (gst !== undefined) out.state.gst = gst;
    if (ghs !== undefined) out.state.ghs = ghs;
    if (ghp !== undefined) out.state.ghp = ghp;
    return out;
  }

  /* ---------- summary for confirmation screens ---------- */
  function summary(state) {
    const r = {
      lv: state.lv, coins: state.coins, stars: state.stars, energy: state.energy, gems: state.gems || 0,
      seen: Object.keys(state.seen).length, owned: (typeof window !== 'undefined' && window.SALON ? Object.keys(state.owned).filter(id => window.SALON.findProp(id)).length : Object.keys(state.owned).length),
    };
    if (state.ev && CFG && CFG.evSummary) { const e = CFG.evSummary(state.ev); r.evDone = e.evDone; r.evClaimed = e.evClaimed; }
    return r;
  }

  /* ---------- transfer envelope ---------- */
  function fnv1a(str) {                              // integrity hint against accidental damage (NOT security)
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function progressOf(state) { const p = JSON.parse(JSON.stringify(state)); delete p.set; return p; }

  function makeEnvelope(state, nowMs) {
    const v = validateState(state);
    if (!v.ok) return { ok: false, code: 'invalid-state' };
    const progress = progressOf(v.state);
    const env = {
      format: FORMAT, version: ENVELOPE_VERSION, app: 'atelier-lueur-html',
      exportedAt: new Date(nowMs === undefined ? Date.now() : nowMs).toISOString(),
      checksum: fnv1a(JSON.stringify(progress)), progress,
    };
    return { ok: true, text: JSON.stringify(env, null, 1), summary: summary(v.state) };
  }

  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  /** Parse imported text. `currentSet` = this device's settings (an import never changes language/sound). */
  function parseEnvelope(text, currentSet) {
    const bad = code => ({ ok: false, code });
    if (typeof text !== 'string') return bad('not-text');
    if (byteLength(text) > MAX_IMPORT_BYTES) return bad('too-big');
    let data;
    try { data = JSON.parse(text); } catch (e) { return bad('not-json'); }
    if (!isObj(data)) return bad('not-save');
    if (data.format !== FORMAT) return bad('not-save');
    if (typeof data.version !== 'number') return bad('not-save');
    if (data.version > ENVELOPE_VERSION) return bad('future-version');
    if (data.version !== ENVELOPE_VERSION) return bad('bad-version');
    if (Object.keys(data).some(k => ['format', 'version', 'app', 'exportedAt', 'checksum', 'progress'].indexOf(k) < 0)) return bad('not-save');
    if (!isObj(data.progress) || 'set' in data.progress) return bad('not-save');
    if (typeof data.checksum !== 'string' || data.checksum !== fnv1a(JSON.stringify(data.progress))) return bad('checksum');
    const cand = JSON.parse(JSON.stringify(data.progress));
    cand.set = normalizeSet(currentSet && isObj(currentSet) ? currentSet : null);
    const v = validateState(cand);
    if (!v.ok) return bad('invalid-state');
    return { ok: true, state: v.state, summary: summary(v.state), exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt.slice(0, 30) : '' };
  }

  /* ---------- storage layer ---------- */
  /**
   * storage: {get(key), set(key, val), remove(key)} — may THROW (blocked storage, quota). Nothing is swallowed:
   * every method returns an explicit result the UI shows.
   */
  function createStore(storage, keys, nowFn) {
    const now = nowFn || Date.now;
    let lastBackupAt = -Infinity;

    function errCode(e) {
      const n = e && e.name || '';
      if (/Quota/i.test(n) || (e && e.code === 22)) return 'quota';
      if (/Security/i.test(n)) return 'security';
      return 'io';
    }
    function tryGet(key) { try { return { ok: true, value: storage.get(key) }; } catch (e) { return { ok: false, code: errCode(e) }; } }
    function trySet(key, val) {
      try { storage.set(key, val); } catch (e) { return { ok: false, code: errCode(e) }; }
      try { if (storage.get(key) !== val) return { ok: false, code: 'verify-failed' }; } catch (e) { return { ok: false, code: errCode(e) }; }
      return { ok: true };
    }
    function parseRaw(raw) {
      if (typeof raw !== 'string') return { ok: false, code: 'not-text' };
      let data; try { data = JSON.parse(raw); } catch (e) { return { ok: false, code: 'not-json' }; }
      return validateState(data);
    }
    function parseBackup(raw) {                      // backup wrapper: {savedAt, state}
      if (typeof raw !== 'string') return { ok: false };
      let w; try { w = JSON.parse(raw); } catch (e) { return { ok: false }; }
      if (!isObj(w) || !isNum(w.savedAt, 0, 1e15)) return { ok: false };
      const v = validateState(w.state);
      return v.ok ? { ok: true, state: v.state, savedAt: w.savedAt } : { ok: false };
    }
    const backupWrapper = state => JSON.stringify({ savedAt: now(), state });

    /** Valid backups, newest first: 'auto' (rolling last-known-good) and 'before' (the save that was current before the last import/restore/new game). */
    function backups() {
      const list = []; let anyRaw = null;
      for (const id of ['auto', 'before']) {
        const g = tryGet(id === 'auto' ? keys.backup : keys.before);
        if (!g.ok || g.value === null || g.value === undefined) continue;
        const pb = parseBackup(g.value);
        if (pb.ok) list.push({ id, state: pb.state, savedAt: pb.savedAt }); else if (anyRaw === null) anyRaw = g.value;
      }
      list.sort((x, y) => y.savedAt - x.savedAt);
      return { list, anyRaw };
    }

    /** Read primary + backups and classify. Never writes (it only remembers how old the rolling backup is). */
    function read() {
      const p = tryGet(keys.primary);
      if (!p.ok) return { status: 'storage-error', code: p.code, backup: null, backups: [] };
      const { list, anyRaw } = backups();
      const auto = list.find(x => x.id === 'auto');
      if (auto) lastBackupAt = Math.max(lastBackupAt, auto.savedAt);     // an existing recent backup is not rewritten at launch
      const backup = list[0] || null;
      if (p.value === null || p.value === undefined) {
        if (backup) return { status: 'missing-with-backup', backup, backups: list };
        if (anyRaw) return { status: 'corrupt', raw: anyRaw, rawSource: 'backup', backup: null, backups: [] };
        return { status: 'fresh', backup: null, backups: [] };
      }
      const v = parseRaw(p.value);
      if (v.ok) return { status: 'ok', state: v.state, backup, backups: list };
      return { status: 'corrupt', raw: p.value, rawSource: 'primary', reason: v.code, backup, backups: list };
    }

    /** Keep the original bytes of unreadable data under a separate key (first free of 3 slots; identical bytes are not duplicated). */
    function preserveCorrupt(raw) {
      const slots = [keys.corrupt, keys.corrupt + '.2', keys.corrupt + '.3'];
      for (const k of slots) {
        const cur = tryGet(k);
        if (!cur.ok) return { ok: false, code: cur.code };
        if (cur.value === raw) return { ok: true, key: k, existed: true };
      }
      for (const k of slots) {
        const cur = tryGet(k);
        if (cur.ok && (cur.value === null || cur.value === undefined)) { const w = trySet(k, raw); return w.ok ? { ok: true, key: k } : { ok: false, code: w.code }; }
      }
      return { ok: false, code: 'slots-full' };
    }

    /** Autosave: validate -> primary -> (rate-limited) backup. Never touches the backup with unvalidated data. */
    function write(state, opts) {
      const v = validateState(state);
      if (!v.ok) return { ok: false, code: 'invalid-state', detail: v.code };
      const json = JSON.stringify(v.state);
      const w = trySet(keys.primary, json);
      if (!w.ok) return { ok: false, code: w.code };
      const t = now();
      if ((opts && opts.forceBackup) || t - lastBackupAt >= BACKUP_EVERY_MS) {
        const b = trySet(keys.backup, backupWrapper(v.state));
        if (!b.ok) return { ok: true, backupFailed: b.code };   // progress saved; backup problem is reported, not hidden
        lastBackupAt = t;
      }
      return { ok: true };
    }

    /**
     * Replace the saved game (import / restore / new game) with no partial result:
     *  1. validate the incoming state, 2. keep the CURRENT valid save as backup (unless there is none worth keeping),
     *  3. write the new primary and read it back. On any failure the previous primary is still in place.
     * opts.current: the current valid in-memory state, or null when the current data is unrecovered corruption.
     */
    function commit(newState, opts) {
      const v = validateState(newState);
      if (!v.ok) return { ok: false, code: 'invalid-state', stage: 'validate' };
      const cur = opts && opts.current ? validateState(opts.current) : { ok: false };
      const prevRaw = tryGet(keys.primary);
      if (!prevRaw.ok) return { ok: false, code: prevRaw.code, stage: 'read' };
      if (cur.ok) {
        const b = trySet(keys.before, backupWrapper(cur.state));               // the rolling backup keeps working independently
        if (!b.ok) return { ok: false, code: b.code, stage: 'backup' };       // nothing replaced yet
      }
      const json = JSON.stringify(v.state);
      const w = trySet(keys.primary, json);
      if (!w.ok) {                                                           // put the previous bytes back if the new write half-happened
        if (prevRaw.value !== null && prevRaw.value !== undefined) { try { storage.set(keys.primary, prevRaw.value); } catch (e) { /* reported below */ } }
        return { ok: false, code: w.code, stage: 'primary' };
      }
      return { ok: true, state: v.state };
    }

    function readBackups() { return backups().list; }
    function rawPrimary() { const p = tryGet(keys.primary); return p.ok ? p.value : null; }

    return { read, write, commit, preserveCorrupt, readBackups, rawPrimary, keys };
  }

  window.SAVE = { configure, validateState, summary, makeEnvelope, parseEnvelope, createStore, fnv1a, FORMAT, ENVELOPE_VERSION, MAX_IMPORT_BYTES };
})();
