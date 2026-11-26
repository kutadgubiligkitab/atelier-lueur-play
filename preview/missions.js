/* =========================================================
   Atelier Lueur — daily / weekly / monthly missions: PURE rules (no DOM, no storage).
   game.js owns the clock, the save, the claim transaction and the UI; this file owns
   selection, eligibility, level scaling, progress, completion and save-shape validation.

   Saved state (optional field S.msn; counters live in S.cnt.day / week / month):
     S.msn = { v:2, last?:[kind,...],                           // yesterday's rotating daily kinds
               lw?: { a, b },                                  // last week's rotating templates
               day?:  { k, lv, slots:[...] },                  // today's assignment, snapshotted at the daily reset
               week?: { k, done:['YYYY-M-D:dN',...], slots:[...] },
               month?:{ k, done:['YYYY-M-D:dN',...], slots:[...] } }
     A v:1 snapshot (four daily slots / 3- or 5-objective week, no month) is accepted on load
     and upgraded immediately by migrate() — mid-period counters and already-claimed rewards are kept.
   ========================================================= */
(function () {
  'use strict';
  const TEMPLATES = ['tap', 'fam', 'mix'];
  const SLOT3 = { tap: { n: 30 }, fam: { n: 4 }, mix: { n: 1 } };      // legacy v1 (kept for validMsn v1)
  const FAM_NEED = 4, FAM_COUNT = 2, COINS_N = 200, SLOT3_REWARD = { coins: 40 }, SLOT4_REWARD = { stars: 15 };
  const WEEK_N = 18, WEEK_REWARD = { stars: 30 }, WEEK_MAX_DONE = 64, MONTH_MAX_DONE = 280;
  const W5 = { order: { n: 25, r: { coins: 200 } }, merge: { n: 140, r: { energy: 50 } }, days: { n: WEEK_N, r: WEEK_REWARD },
    S4: { r: { coins: 140 }, tap: 140, fam: 12 }, S5: { r: { energy: 25, stars: 20 }, mix: 4, atl: 2, coin: 900 } };
  const S4_T = ['tap', 'fam'], S5_T = ['coin', 'mix', 'atl'];
  const KINDS = ['merge', 'order', 'tap', 'coins', 'deco', 'fam', 'mix', 'atl', 'days', 'bonus'];
  const DAILY_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'];
  const REW_KEYS = ['coins', 'energy', 'stars'];

  /* Daily set at level 1 is sized for a 20–40 minute session (6 objectives). Targets scale with level; rewards scale more slowly. */
  const D1 = [
    { id: 'd1', k: 'merge', n: 25, r: { coins: 35 } },
    { id: 'd2', k: 'order', n: 6,  r: { energy: 20 } },
    { id: 'd3', k: 'tap',   n: 40, r: { coins: 40 } },
    { id: 'd4', k: 'coins', n: 120, r: { stars: 12 } }
  ];
  const ROT = {
    fam:    { k: 'fam',   n: FAM_COUNT, per: 6, r: { coins: 45 } },
    mix:    { k: 'mix',   n: 1,  r: { energy: 15 } },
    xmerge: { k: 'merge', n: 20, r: { coins: 30 } },
    xorder: { k: 'order', n: 3,  r: { energy: 15 } }
  };
  const M1 = [
    { id: 'm1', k: 'days',  n: 48, r: { coins: 400, energy: 40 } },
    { id: 'm2', k: 'order', n: 80, r: { coins: 500 } },
    { id: 'm3', k: 'merge', n: 400, r: { energy: 60 } },
    { id: 'm4', k: 'bonus', n: 3,  r: { coins: 800, energy: 80, stars: 50 } }
  ];

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const famKey = c => 'mf' + c;
  const clone = x => JSON.parse(JSON.stringify(x));
  const bandMul = lv => lv >= 30 ? 3 : lv >= 20 ? 2.5 : lv >= 15 ? 2.15 : lv >= 10 ? 1.75 : lv >= 5 ? 1.35 : 1;
  const scaleN = (base, lv) => Math.max(1, Math.round(base * bandMul(lv)));
  const scaleR = (r, lv) => { const m = 1 + (bandMul(lv) - 1) * 0.55, out = {}; Object.keys(r).forEach(k => { out[k] = Math.max(1, Math.round(r[k] * m)); }); return out; };

  function producibleFamilies(S, cfg) {
    const fam = [];
    for (const it of S.board) if (it && it.g) for (const c of cfg.genChains[it.g] || []) if (cfg.orderChains.indexOf(c) >= 0 && fam.indexOf(c) < 0) fam.push(c);
    return cfg.orderChains.filter(c => fam.indexOf(c) >= 0);
  }
  function mixedPresent(S, cfg) {
    if (!(S.lv >= cfg.mixedFrom)) return false;
    const pf = producibleFamilies(S, cfg);
    return S.orders.some(o => o && o.m && pf.indexOf(o.c) >= 0 && pf.indexOf(o.m.c) >= 0);
  }
  function eligibleTemplates(S, cfg) {
    const out = [];
    if (S.board.some(it => it && it.g)) out.push('tap');
    if (producibleFamilies(S, cfg).length >= FAM_COUNT) out.push('fam');
    if (mixedPresent(S, cfg)) out.push('mix');
    return out;
  }
  function chooseTemplate(S, cfg, dk) {            // legacy v1 helper (unit tests + mid-migration)
    const last = S.msn && S.msn.last, el = eligibleTemplates(S, cfg);
    const lastOne = Array.isArray(last) ? last[0] : last;
    const pool = el.filter(t => t !== lastOne);
    if (!pool.length) return 'tap';
    return pool[hash(dk) % pool.length];
  }

  const pick = (el, last, key) => { const pool = el.filter(t => t !== last); return pool.length ? pool[hash(key) % pool.length] : el[0]; };

  function scaleSlot(tmpl, lv, extra) {
    const s = { id: tmpl.id, k: tmpl.k, n: scaleN(tmpl.n, lv), r: scaleR(tmpl.r, lv) };
    if (tmpl.per) s.per = scaleN(tmpl.per, lv);
    if (tmpl.a) s.a = tmpl.a;
    if (extra) Object.keys(extra).forEach(k => { s[k] = extra[k]; });
    return s;
  }

  function rotatingKinds(S, cfg) {
    const el = ['xmerge', 'xorder'];
    if (producibleFamilies(S, cfg).length >= FAM_COUNT) el.unshift('fam');
    if (mixedPresent(S, cfg)) el.unshift('mix');
    return el;
  }
  function chooseDailyRot(S, cfg, dk, lv) {
    const last = (S.msn && Array.isArray(S.msn.last)) ? S.msn.last : [];
    const el = rotatingKinds(S, cfg);
    const out = [], used = [];
    for (let i = 0; i < 2; i++) {
      const avoid = last.concat(used);
      let pool = el.filter(t => avoid.indexOf(t) < 0);
      if (!pool.length) pool = el.filter(t => used.indexOf(t) < 0);
      const pickKind = pool.length ? pool[hash(dk + '|' + i) % pool.length] : 'xmerge';
      used.push(pickKind);
      const tmpl = Object.assign({ id: i === 0 ? 'd5' : 'd6', rot: pickKind }, ROT[pickKind]);
      const extra = { rot: pickKind };
      if (pickKind === 'fam') extra.f = producibleFamilies(S, cfg);
      out.push(scaleSlot(tmpl, lv, extra));
    }
    return out;
  }

  function assignDay(S, cfg, dk) {
    const lv = S.lv || 1;
    S.msn = S.msn || { v: 2 }; S.msn.v = 2;
    const slots = D1.map(t => {
      const extra = (t.id === 'd4' && cfg.hasAtelier && cfg.hasAtelier(S)) ? { a: 1 } : null;
      return scaleSlot(t, lv, extra);
    }).concat(chooseDailyRot(S, cfg, dk, lv));
    S.msn.day = { k: dk, lv, slots };
    S.msn.last = slots.filter(s => s.rot).map(s => s.rot);
    return S.msn.day;
  }

  function assignWeek(S, cfg, wk) {
    S.msn = S.msn || { v: 2 }; S.msn.v = 2;
    const lv = S.lv || 1;
    const cur = S.msn.week && S.msn.week.slots, lw = cur ? weekLw(cur) : (S.msn.lw || {}), pf = producibleFamilies(S, cfg);
    const e4 = ['tap'].concat(pf.length >= FAM_COUNT ? ['fam'] : []);
    const e5 = ['coin'].concat(mixedPresent(S, cfg) ? ['mix'] : [], cfg.hasAtelier && cfg.hasAtelier(S) ? ['atl'] : []);
    const a = pick(e4, lw.a, wk + '|4'), b = pick(e5, lw.b, wk + '|5');
    const s4n = a === 'fam' ? W5.S4.fam : W5.S4.tap, s5n = W5.S5[b];
    const slots = [
      scaleSlot({ id: 'w1', k: 'order', n: W5.order.n, r: W5.order.r }, lv),
      scaleSlot({ id: 'w2', k: 'merge', n: W5.merge.n, r: W5.merge.r }, lv),
      scaleSlot({ id: 'w3', k: 'days',  n: W5.days.n,  r: W5.days.r  }, lv),
      scaleSlot({ id: 'w4', k: a === 'fam' ? 'fam' : 'tap', n: a === 'fam' ? FAM_COUNT : s4n, per: a === 'fam' ? s4n : undefined, r: W5.S4.r }, lv, a === 'fam' ? { f: pf, rot: a } : { rot: a }),
      scaleSlot({ id: 'w5', k: b === 'coin' ? 'coins' : b, n: s5n, r: W5.S5.r }, lv, { rot: b })
    ];
    S.msn.lw = { a, b };
    return slots;
  }
  function weekLw(slots) {
    const s4 = (slots || []).find(s => s.id === 'w4'), s5 = (slots || []).find(s => s.id === 'w5');
    return { a: (s4 && (s4.rot || (s4.k === 'fam' ? 'fam' : 'tap'))) || 'tap', b: (s5 && (s5.rot || (s5.k === 'coins' ? 'coin' : s5.k))) || 'coin' };
  }
  function startWeek(S, wk, cfg) {
    S.msn = S.msn || { v: 2 }; S.msn.v = 2;
    const slots = cfg ? assignWeek(S, cfg, wk) : null;
    S.msn.week = { k: wk, done: [] };
    if (slots) S.msn.week.slots = slots;
  }
  function assignMonth(S, cfg, mk) {
    const lv = S.lv || 1;
    return M1.map(t => scaleSlot(t, lv));
  }
  function startMonth(S, mk, cfg) {
    S.msn = S.msn || { v: 2 }; S.msn.v = 2;
    S.msn.month = { k: mk, done: [], slots: assignMonth(S, cfg, mk) };
  }

  const active = S => !!(S.msn && S.msn.day && S.msn.day.k === S.cnt.day.k && Array.isArray(S.msn.day.slots));
  const weekActive = S => !!(S.msn && S.msn.week && S.msn.week.k === S.cnt.week.k);
  const week5 = S => !!(weekActive(S) && (S.msn.week.slots || S.msn.week.s));
  const monthActive = S => !!(S.msn && S.msn.month && S.msn.month.k === (S.cnt.month && S.cnt.month.k) && Array.isArray(S.msn.month.slots));

  const cd = S => S.cnt.day, wc = S => S.cnt.week, mc = S => S.cnt.month || {};
  const bucket = (S, g) => g === 'daily' ? cd(S) : g === 'month' ? mc(S) : wc(S);

  function famRowsFor(S, slot, g) {
    const c = bucket(S, g), need = slot.per || FAM_NEED;
    return (slot.f || []).map(fam => { const have = c[famKey(fam)] || 0; return { c: fam, have: Math.min(need, have), ok: have >= need }; });
  }
  function famRows(S) { return active(S) ? famRowsFor(S, (S.msn.day.slots || []).find(s => s.k === 'fam') || { f: S.msn.day.f, per: FAM_NEED }, 'daily') : []; }
  function wfamRows(S) {
    const slot = weekSlot(S, 'w4');
    return slot ? famRowsFor(S, slot, 'weekly') : [];
  }

  function weekSlot(S, id) {
    if (S.msn && S.msn.week && Array.isArray(S.msn.week.slots)) return S.msn.week.slots.find(s => s.id === id);
    if (S.msn && S.msn.week && S.msn.week.s) {           // leftover v1 five-objective snapshot, before migrate
      const s = S.msn.week.s, W = W5;
      if (id === 'w1') return { id: 'w1', k: 'order', n: W.order.n, r: W.order.r };
      if (id === 'w2') return { id: 'w2', k: 'merge', n: W.merge.n, r: W.merge.r };
      if (id === 'w3') return { id: 'w3', k: 'days', n: WEEK_N, r: WEEK_REWARD };
      if (id === 'w4') return s.a === 'fam' ? { id: 'w4', k: 'fam', n: FAM_COUNT, per: s.n4, r: s.r4, f: s.f, rot: 'fam' } : { id: 'w4', k: 'tap', n: s.n4, r: s.r4, rot: 'tap' };
      if (id === 'w5') return { id: 'w5', k: s.b === 'coin' ? 'coins' : s.b, n: s.n5, r: s.r5, rot: s.b };
    }
    return null;
  }

  function slotDone(S, g, t) {
    if (t.k === 'bonus') {
      const others = (S.msn.month.slots || []).filter(s => s.k !== 'bonus');
      return others.every(s => slotDone(S, 'month', s));
    }
    if (t.k === 'days') return (g === 'month' ? monthProgress(S) : weekProgress(S)) >= t.n;
    if (t.k === 'fam') { const rows = famRowsFor(S, t, g); return rows.filter(r => r.ok).length >= (t.n || FAM_COUNT); }
    if (t.a && t.k === 'coins') { const c = bucket(S, g); return (c.coins || 0) >= t.n || (c.atl || 0) >= 1; }
    return progress(S, g, t) >= t.n;
  }
  function progress(S, g, t) {
    if (t.k === 'bonus') { const others = (S.msn.month && S.msn.month.slots || []).filter(s => s.k !== 'bonus'); return others.filter(s => slotDone(S, 'month', s)).length; }
    if (t.k === 'days') return g === 'month' ? monthProgress(S) : weekProgress(S);
    if (t.k === 'fam') return Math.min(t.n || FAM_COUNT, famRowsFor(S, t, g).filter(r => r.ok).length);
    const c = bucket(S, g);
    if (t.a && t.k === 'coins') return Math.min(t.n, c.coins || 0);     // headline bar shows the coins route
    return Math.min(t.n, c[t.k] || 0);
  }
  function altProgress(S, g, t) {                                       // coins OR atelier
    const c = bucket(S, g);
    return { coins: Math.min(t.n, c.coins || 0), n: t.n, atl: Math.min(1, c.atl || 0), atlRoute: !!t.a, done: (c.coins || 0) >= t.n || (!!t.a && (c.atl || 0) >= 1) };
  }

  /* legacy aliases used by older game.js / tests */
  function slot3(S) {
    if (active(S) && S.msn.day.slots) { const t = S.msn.day.slots.find(s => s.id === 'd3') || S.msn.day.slots[2]; const p = progress(S, 'daily', t); return { p, n: t.n, done: slotDone(S, 'daily', t) }; }
    if (!S.msn || !S.msn.day) return { p: 0, n: 1, done: false };
    const d = S.msn.day, c = cd(S);
    if (d.t === 'tap') { const p = Math.min(d.n, c.tap || 0); return { p, n: d.n, done: p >= d.n }; }
    if (d.t === 'mix') { const p = Math.min(d.n, c.mix || 0); return { p, n: d.n, done: p >= d.n }; }
    const ok = famRows(S).filter(r => r.ok).length, p = Math.min(FAM_COUNT, ok); return { p, n: FAM_COUNT, done: p >= FAM_COUNT };
  }
  function slot4(S) {
    if (active(S) && S.msn.day.slots) { const t = S.msn.day.slots.find(s => s.id === 'd4'); return t ? altProgress(S, 'daily', t) : { coins: 0, n: 1, atl: 0, atlRoute: false, done: false }; }
    const d = S.msn.day, c = cd(S), coins = Math.min(d.n4, c.coins || 0), atl = Math.min(1, c.atl || 0);
    return { coins, n: d.n4, atl, atlRoute: !!d.a, done: coins >= d.n4 || (!!d.a && atl >= 1) };
  }
  function wslot4(S) {
    const t = weekSlot(S, 'w4'); if (!t) return { p: 0, n: 1, done: false };
    const p = progress(S, 'weekly', t); return { p, n: t.n, done: slotDone(S, 'weekly', t) };
  }
  function wslot5(S) {
    const t = weekSlot(S, 'w5'); if (!t) return { p: 0, n: 1, done: false };
    const p = progress(S, 'weekly', t); return { p, n: t.n, done: slotDone(S, 'weekly', t) };
  }

  function dayTasks(S) { return (S.msn.day.slots || []).map(s => clone(s)); }
  function weekTasks(S) {
    if (S.msn.week.slots) return S.msn.week.slots.map(s => clone(s));
    return ['w1', 'w2', 'w3', 'w4', 'w5'].map(id => weekSlot(S, id)).filter(Boolean);
  }
  function monthTasks(S) { return (S.msn.month.slots || []).map(s => clone(s)); }

  function dailyDone(S, cfg) {
    if (active(S) && S.msn.day.slots) return S.msn.day.slots.map(t => slotDone(S, 'daily', t));
    const c = cd(S);
    return [(c[(cfg.daily && cfg.daily[0].k) || 'merge'] || 0) >= ((cfg.daily && cfg.daily[0].n) || 15),
            (c[(cfg.daily && cfg.daily[1].k) || 'order'] || 0) >= ((cfg.daily && cfg.daily[1].n) || 4),
            slot3(S).done, slot4(S).done];
  }
  function doneId(dk, slot, i) {                                  // v2: '2026-11-25:d1' ; also accept legacy ':1'
    return dk + ':' + (slot && slot.id ? slot.id : ('d' + (i + 1)));
  }
  function sync(S, cfg) {
    let changed = false;
    if (active(S) && weekActive(S)) {
      const dk = S.cnt.day.k, done = S.msn.week.done, slots = S.msn.day.slots;
      dailyDone(S, cfg).forEach((ok, i) => {
        const id = slots ? doneId(dk, slots[i], i) : (dk + ':' + (i + 1));
        if (ok && done.indexOf(id) < 0 && done.length < WEEK_MAX_DONE) { done.push(id); changed = true; }
      });
    }
    if (active(S) && monthActive(S)) {
      const dk = S.cnt.day.k, done = S.msn.month.done, slots = S.msn.day.slots;
      dailyDone(S, cfg).forEach((ok, i) => {
        const id = slots ? doneId(dk, slots[i], i) : (dk + ':' + (i + 1));
        if (ok && done.indexOf(id) < 0 && done.length < MONTH_MAX_DONE) { done.push(id); changed = true; }
      });
    }
    return changed;
  }
  const weekProgress = S => weekActive(S) ? S.msn.week.done.length : 0;
  const monthProgress = S => monthActive(S) ? S.msn.month.done.length : 0;

  const countDay = (S, k) => {
    cd(S)[k] = (cd(S)[k] || 0) + 1;
    S.cnt.week[k] = (S.cnt.week[k] || 0) + 1;
    if (S.cnt.month) S.cnt.month[k] = (S.cnt.month[k] || 0) + 1;
  };
  function countMerge(S, family, cfg) { if (cfg.orderChains.indexOf(family) >= 0) countDay(S, famKey(family)); }
  function countMixedDelivery(S) { countDay(S, 'mix'); }
  function countCommission(S) { countDay(S, 'atl'); }

  function convertDone(list) {
    return (list || []).map(x => x.replace(/:([1-8])$/, ':d$1')).filter((x, i, a) => a.indexOf(x) === i);
  }
  /* Upgrade a v:1 (or missing) snapshot in place. Same-period counters and claim keys are kept; new slots are assigned now so the board is never empty after the patch. */
  function migrate(S, cfg, keys) {
    if (!S.msn) S.msn = { v: 2 };
    const wasOld = S.msn.v !== 2;
    if (wasOld) {
      const last = S.msn.last, lw = S.msn.lw, day = S.msn.day, week = S.msn.week;
      const keepLast = Array.isArray(last) ? last : (TEMPLATES.indexOf(last) >= 0 ? [last] : undefined);
      const keepLw = (lw && S4_T.indexOf(lw.a) >= 0 && S5_T.indexOf(lw.b) >= 0) ? { a: lw.a, b: lw.b } : undefined;
      const keepWeekDone = week && week.k === keys.week ? convertDone(week.done) : null;
      S.msn = { v: 2 };
      if (keepLast) S.msn.last = keepLast;
      if (keepLw) S.msn.lw = keepLw;
      if (keepWeekDone) { S.msn.week = { k: keys.week, done: keepWeekDone }; }
    }
    S.msn.v = 2;
    if (!S.cnt.month) S.cnt.month = { k: keys.month };
    if (!S.msn.month || S.msn.month.k !== keys.month || !Array.isArray(S.msn.month.slots)) {
      const keep = (S.msn.month && S.msn.month.k === keys.month) ? convertDone(S.msn.month.done) : [];
      startMonth(S, keys.month, cfg);
      if (keep.length) S.msn.month.done = keep;
    }
    if (!S.msn.week || S.msn.week.k !== keys.week || !Array.isArray(S.msn.week.slots)) {
      const keep = (S.msn.week && S.msn.week.k === keys.week) ? convertDone(S.msn.week.done) : [];
      startWeek(S, keys.week, cfg);
      if (keep.length) S.msn.week.done = keep;
    }
    if (!S.msn.day || S.msn.day.k !== keys.day || !Array.isArray(S.msn.day.slots)) assignDay(S, cfg, keys.day);
    return wasOld;
  }

  const isInt = (x, a, b) => typeof x === 'number' && isFinite(x) && Math.floor(x) === x && x >= a && x <= b;
  function validRewards(r) { if (!r || typeof r !== 'object' || Array.isArray(r)) return false; const ks = Object.keys(r); return ks.length >= 1 && ks.length <= 3 && ks.every(k => REW_KEYS.indexOf(k) >= 0 && isInt(r[k], 0, 1e6)); }
  function validSlot(s, chains, ids) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
    const allow = ['id', 'k', 'n', 'r', 'per', 'f', 'a', 'rot'];
    if (Object.keys(s).some(k => allow.indexOf(k) < 0)) return false;
    if (ids.indexOf(s.id) < 0 || KINDS.indexOf(s.k) < 0 || !isInt(s.n, 1, 100000) || !validRewards(s.r)) return false;
    if (s.per !== undefined && !isInt(s.per, 1, 100000)) return false;
    if (s.a !== undefined && s.a !== 0 && s.a !== 1) return false;
    if (s.rot !== undefined && (typeof s.rot !== 'string' || s.rot.length > 16)) return false;
    if (s.f !== undefined && (!Array.isArray(s.f) || s.f.length > 8 || s.f.some(c => chains.indexOf(c) < 0))) return false;
    if (s.k === 'fam' && !(s.f && s.f.length >= 1)) return false;
    return true;
  }
  const DONE_RE = /^\d{4}-\d{1,2}-\d{1,2}:(d[1-8]|[1-8])$/;
  function validDone(list, max) {
    return Array.isArray(list) && list.length <= max && list.every(x => typeof x === 'string' && DONE_RE.test(x)) && new Set(list).size === list.length;
  }
  function validMsnV1(m, chains) {
    if (Object.keys(m).some(k => ['v', 'last', 'lw', 'day', 'week'].indexOf(k) < 0)) return false;
    if (m.last !== undefined && TEMPLATES.indexOf(m.last) < 0) return false;
    if (m.day !== undefined) { const d = m.day; if (!d || typeof d !== 'object' || Object.keys(d).some(k => ['k', 't', 'n', 'f', 'a', 'r3', 'r4', 'n4'].indexOf(k) < 0) || typeof d.k !== 'string' || d.k.length > 20 || TEMPLATES.indexOf(d.t) < 0 || !isInt(d.n, 1, 1000) || (d.a !== 0 && d.a !== 1) || !validRewards(d.r3) || !validRewards(d.r4) || !isInt(d.n4, 1, 100000)) return false; if (d.f !== undefined && (!Array.isArray(d.f) || d.f.length > 8 || d.f.some(c => chains.indexOf(c) < 0))) return false; if (d.t === 'fam' && !(d.f && d.f.length >= 1)) return false; }
    if (m.lw !== undefined && (!m.lw || typeof m.lw !== 'object' || Object.keys(m.lw).some(k => k !== 'a' && k !== 'b') || S4_T.indexOf(m.lw.a) < 0 || S5_T.indexOf(m.lw.b) < 0)) return false;
    if (m.week !== undefined && m.week && m.week.s !== undefined) { const t = m.week.s; if (!t || typeof t !== 'object' || Object.keys(t).some(k => ['a', 'b', 'n4', 'n5', 'r4', 'r5', 'f'].indexOf(k) < 0) || S4_T.indexOf(t.a) < 0 || S5_T.indexOf(t.b) < 0 || !isInt(t.n4, 1, 100000) || !isInt(t.n5, 1, 100000) || !validRewards(t.r4) || !validRewards(t.r5)) return false; if (t.f !== undefined && (!Array.isArray(t.f) || t.f.length > 8 || t.f.some(c => chains.indexOf(c) < 0))) return false; if (t.a === 'fam' && !(t.f && t.f.length >= FAM_COUNT)) return false; }
    if (m.week !== undefined) { const w = m.week; if (!w || typeof w !== 'object' || Object.keys(w).some(k => k !== 'k' && k !== 'done' && k !== 's') || typeof w.k !== 'string' || w.k.length > 20 || !validDone(w.done, 40) && (!Array.isArray(w.done) || w.done.length > 40 || w.done.some(x => typeof x !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}:[1-4]$/.test(x)) || new Set(w.done).size !== w.done.length)) return false; }
    return true;
  }
  function validMsnV2(m, chains) {
    if (Object.keys(m).some(k => ['v', 'last', 'lw', 'day', 'week', 'month'].indexOf(k) < 0)) return false;
    if (m.last !== undefined) {
      if (Array.isArray(m.last)) { if (m.last.length > 8 || m.last.some(x => typeof x !== 'string' || x.length > 16)) return false; }
      else if (TEMPLATES.indexOf(m.last) < 0) return false;
    }
    if (m.lw !== undefined && (!m.lw || typeof m.lw !== 'object' || Object.keys(m.lw).some(k => k !== 'a' && k !== 'b') || S4_T.indexOf(m.lw.a) < 0 || S5_T.indexOf(m.lw.b) < 0)) return false;
    if (m.day !== undefined) {
      const d = m.day;
      if (!d || typeof d !== 'object' || Object.keys(d).some(k => ['k', 'lv', 'slots'].indexOf(k) < 0) || typeof d.k !== 'string' || d.k.length > 20 || !isInt(d.lv, 1, 10000) || !Array.isArray(d.slots) || d.slots.length < 4 || d.slots.length > 8) return false;
      if (d.slots.some(s => !validSlot(s, chains, DAILY_IDS))) return false;
    }
    if (m.week !== undefined) {
      const w = m.week;
      if (!w || typeof w !== 'object' || Object.keys(w).some(k => k !== 'k' && k !== 'done' && k !== 'slots' && k !== 's') || typeof w.k !== 'string' || w.k.length > 20 || !validDone(w.done, WEEK_MAX_DONE)) return false;
      if (w.slots !== undefined) { if (!Array.isArray(w.slots) || w.slots.length < 3 || w.slots.length > 6 || w.slots.some(s => !validSlot(s, chains, ['w1', 'w2', 'w3', 'w4', 'w5']))) return false; }
      if (w.s !== undefined) { const t = w.s; if (!t || typeof t !== 'object' || Object.keys(t).some(k => ['a', 'b', 'n4', 'n5', 'r4', 'r5', 'f'].indexOf(k) < 0) || S4_T.indexOf(t.a) < 0 || S5_T.indexOf(t.b) < 0 || !isInt(t.n4, 1, 100000) || !isInt(t.n5, 1, 100000) || !validRewards(t.r4) || !validRewards(t.r5)) return false; }
    }
    if (m.month !== undefined) {
      const mo = m.month;
      if (!mo || typeof mo !== 'object' || Object.keys(mo).some(k => k !== 'k' && k !== 'done' && k !== 'slots') || typeof mo.k !== 'string' || mo.k.length > 20 || !validDone(mo.done, MONTH_MAX_DONE)) return false;
      if (!Array.isArray(mo.slots) || mo.slots.length < 3 || mo.slots.length > 6 || mo.slots.some(s => !validSlot(s, chains, ['m1', 'm2', 'm3', 'm4']))) return false;
    }
    return true;
  }
  function validMsn(m, chains) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
    if (m.v === 2) return validMsnV2(m, chains);
    if (m.v === 1) return validMsnV1(m, chains);
    return false;
  }
  function sanitizeMsn(m, chains) { if (!validMsn(m, chains)) return null; return JSON.parse(JSON.stringify(m)); }

  const API = { TEMPLATES, SLOT3, FAM_NEED, FAM_COUNT, COINS_N, SLOT3_REWARD, SLOT4_REWARD, WEEK_N, WEEK_REWARD, WEEK_MAX_DONE, MONTH_MAX_DONE, W5, D1, M1,
    assignWeek, week5, wfamRows, wslot4, wslot5, producibleFamilies, mixedPresent, eligibleTemplates, chooseTemplate, assignDay, startWeek, startMonth, assignMonth,
    countMerge, countMixedDelivery, countCommission, active, weekActive, monthActive, famRows, famRowsFor, slot3, slot4, dailyDone, sync, weekProgress, monthProgress,
    validMsn, sanitizeMsn, famKey, migrate, dayTasks, weekTasks, monthTasks, progress, slotDone, altProgress, scaleN, scaleR, bandMul };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.MISSIONS = API;
})();
