/* =========================================================
   Atelier Lueur — daily/weekly mission variety: PURE rules (no DOM, no storage). Specification: Missions_Variety_Spec_v0_2 (provisional playtest candidate values,
   NOT proven balance). game.js owns the clock, the save, the claim transaction and the UI; this file owns selection, eligibility, progress and completion.

   Saved state (inside the one save document, optional field S.msn; counters live in the existing S.cnt.day):
     S.msn = { v:1, last?:'tap'|'fam'|'mix',                       // yesterday's slot-3 template (rotation)
               day?:  { k, t, n, f?, a, r3, r4, n4 },              // today's assignment, snapshotted at the daily reset (never re-rolled)
               lw?:   { a, b },                                    // last week's rotating templates (rotation memory)
               week?: { k, done:[ 'YYYY-M-D:slot', ... ], s? } }   // done = distinct daily-objective instances completed this week
     week.s (present only in FIVE-objective weeks, written ONCE at the weekly reset and frozen): { a:'tap'|'fam', b:'coin'|'mix'|'atl', n4, n5, r4, r5, f? }
     A week without s is the earlier THREE-objective week (30 orders / 120 merges / 8 days -> 40 stars); a save without week is a legacy decoration week. Both are preserved until the next weekly reset.
   S.cnt.day AND S.cnt.week gain numeric counters: mflip/mfper/mfcmp/mfnail/mfskn (successful merges per ordinary family), mix (ordinary mixed-order deliveries), atl (Atelier commissions).
   ========================================================= */
(function () {
  'use strict';
  const TEMPLATES = ['tap', 'fam', 'mix'];
  const SLOT3 = { tap: { n: 30 }, fam: { n: 4 }, mix: { n: 1 } };      // 30 producer taps | 4 merges in each of 2 families | 1 ordinary mixed delivery
  const FAM_NEED = 4, FAM_COUNT = 2, COINS_N = 200, SLOT3_REWARD = { coins: 40 }, SLOT4_REWARD = { stars: 15 }, WEEK_N = 8, WEEK_REWARD = { stars: 40 };
  const MAX_DONE = 40;
  /* FIVE-objective week (provisional candidates). Anchors: 20 orders -> 180 coins, 80 merges -> 40 energy, 8 daily objectives -> 25 stars.
     Slot 4 (120 coins): 12 merges in each of 2 families | 80 producer taps. Slot 5 (20 energy + 15 stars): 3 ordinary mixed deliveries | 2 Atelier commissions | earn 800 coins.
     Total stays 300 coins + 60 energy + 40 stars. */
  const W5 = { order: { n: 20, r: { coins: 180 } }, merge: { n: 80, r: { energy: 40 } }, days: { n: WEEK_N, r: { stars: 25 } }, S4: { r: { coins: 120 }, tap: 80, fam: 12 }, S5: { r: { energy: 20, stars: 15 }, mix: 3, atl: 2, coin: 800 } };
  const S4_T = ['tap', 'fam'], S5_T = ['coin', 'mix', 'atl'];

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const famKey = c => 'mf' + c;
  /* cfg = { orderChains:[...], genChains:{type:[families]}, mixedFrom:number, hasAtelier:S=>bool, daily:[{k,n},{k,n}] (slots 1 and 2: counter + target) } */

  /* ordinary families producible from producers ON THE BOARD (a queued producer alone does not count; commission-only families are not ordinary) */
  function producibleFamilies(S, cfg) {
    const fam = [];
    for (const it of S.board) if (it && it.g) for (const c of cfg.genChains[it.g] || []) if (cfg.orderChains.indexOf(c) >= 0 && fam.indexOf(c) < 0) fam.push(c);
    return cfg.orderChains.filter(c => fam.indexOf(c) >= 0);        // registry order: deterministic
  }
  /* a mixed ORDINARY order is present and both of its families are producible right now */
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
  /* deterministic: same save + same day -> same choice (no randomness, no clock beyond the day key). Avoid yesterday's template when another is eligible; otherwise the tap baseline. */
  function chooseTemplate(S, cfg, dk) {
    const last = S.msn && S.msn.last, el = eligibleTemplates(S, cfg);
    const pool = el.filter(t => t !== last);
    if (!pool.length) return 'tap';
    return pool[hash(dk) % pool.length];
  }
  /* creates today's snapshot (template, target, eligible families, Atelier route flag, rewards) */
  function assignDay(S, cfg, dk) {
    S.msn = S.msn || { v: 1 };
    const t = chooseTemplate(S, cfg, dk);
    const day = { k: dk, t, n: SLOT3[t].n, a: cfg.hasAtelier(S) ? 1 : 0, r3: Object.assign({}, SLOT3_REWARD), r4: Object.assign({}, SLOT4_REWARD), n4: COINS_N };
    if (t === 'fam') day.f = producibleFamilies(S, cfg);
    S.msn.day = day; S.msn.last = t;
    return day;
  }


  /* ---- FIVE-objective week: assignment (once, at the weekly reset), progress, completion ---- */
  const pick = (el, last, key) => { const pool = el.filter(t => t !== last); return pool.length ? pool[hash(key) % pool.length] : el[0]; };   // deterministic; avoid last week's template; otherwise the universal fallback (el[0])
  function assignWeek(S, cfg, wk) {
    S.msn = S.msn || { v: 1 };
    const cur = S.msn.week && S.msn.week.s, lw = cur ? { a: cur.a, b: cur.b } : (S.msn.lw || {}), pf = producibleFamilies(S, cfg);   // last week = the week being replaced (its own snapshot), else the stored memory
    const e4 = ['tap'].concat(pf.length >= FAM_COUNT ? ['fam'] : []);                                              // taps are the universal fallback; families need two producible ordinary families
    const e5 = ['coin'].concat(mixedPresent(S, cfg) ? ['mix'] : [], cfg.hasAtelier(S) ? ['atl'] : []);              // earned coins are the universal fallback
    const a = pick(e4, lw.a, wk + '|4'), b = pick(e5, lw.b, wk + '|5');
    const sn = { a, b, n4: a === 'fam' ? W5.S4.fam : W5.S4.tap, n5: W5.S5[b], r4: Object.assign({}, W5.S4.r), r5: Object.assign({}, W5.S5.r) };
    if (a === 'fam') sn.f = pf;
    S.msn.lw = { a, b }; return sn;
  }
  function startWeek(S, wk, cfg) { S.msn = S.msn || { v: 1 }; const sn = cfg ? assignWeek(S, cfg, wk) : null; S.msn.week = { k: wk, done: [] }; if (sn) S.msn.week.s = sn; }
  const week5 = S => !!(weekActive(S) && S.msn.week.s);
  const wc = S => S.cnt.week;
  function wfamRows(S) { const s = S.msn.week.s; return (s.f || []).map(c => { const have = wc(S)[famKey(c)] || 0; return { c, have: Math.min(s.n4, have), ok: have >= s.n4 }; }); }
  function wslot4(S) {                               // {p, n, done}: tap count, or qualified families out of 2
    const s = S.msn.week.s;
    if (s.a === 'tap') { const p = Math.min(s.n4, wc(S).tap || 0); return { p, n: s.n4, done: p >= s.n4 }; }
    const p = Math.min(FAM_COUNT, wfamRows(S).filter(r => r.ok).length); return { p, n: FAM_COUNT, done: p >= FAM_COUNT };
  }
  function wslot5(S) { const s = S.msn.week.s, k = s.b === 'coin' ? 'coins' : s.b, p = Math.min(s.n5, wc(S)[k] || 0); return { p, n: s.n5, done: p >= s.n5 }; }

  const cd = S => S.cnt.day;
  const countDay = (S, k) => { cd(S)[k] = (cd(S)[k] || 0) + 1; S.cnt.week[k] = (S.cnt.week[k] || 0) + 1; };   // one real event advances the day AND the week counter
  /* ---- event counters (call only for REAL successful events) ---- */
  function countMerge(S, family, cfg) { if (cfg.orderChains.indexOf(family) >= 0) countDay(S, famKey(family)); }
  function countMixedDelivery(S) { countDay(S, 'mix'); }
  function countCommission(S) { countDay(S, 'atl'); }

  /* ---- progress / completion (pure functions of the snapshot and the day counters) ---- */
  const active = S => !!(S.msn && S.msn.day && S.msn.day.k === S.cnt.day.k);
  const weekActive = S => !!(S.msn && S.msn.week && S.msn.week.k === S.cnt.week.k);
  function famRows(S) {                              // [{c, have, ok}] for the eligible families snapshot
    const d = S.msn.day; return (d.f || []).map(c => { const have = cd(S)[famKey(c)] || 0; return { c, have: Math.min(FAM_NEED, have), ok: have >= FAM_NEED }; });
  }
  function slot3(S) {                                // {p, n, done} (p/n = the headline progress)
    const d = S.msn.day, c = cd(S);
    if (d.t === 'tap') { const p = Math.min(d.n, c.tap || 0); return { p, n: d.n, done: p >= d.n }; }
    if (d.t === 'mix') { const p = Math.min(d.n, c.mix || 0); return { p, n: d.n, done: p >= d.n }; }
    const ok = famRows(S).filter(r => r.ok).length, p = Math.min(FAM_COUNT, ok); return { p, n: FAM_COUNT, done: p >= FAM_COUNT };
  }
  function slot4(S) {                                // OR objective: earn coins OR complete one Atelier commission (the same single objective)
    const d = S.msn.day, c = cd(S), coins = Math.min(d.n4, c.coins || 0), atl = Math.min(1, c.atl || 0);
    return { coins, n: d.n4, atl, atlRoute: !!d.a, done: coins >= d.n4 || (!!d.a && atl >= 1) };
  }
  /* completion of today's four slots; recorded ONCE per instance in the week list (independent of claiming) */
  function dailyDone(S, cfg) {
    const c = cd(S);
    return [(c[cfg.daily[0].k] || 0) >= cfg.daily[0].n, (c[cfg.daily[1].k] || 0) >= cfg.daily[1].n, slot3(S).done, slot4(S).done];
  }
  function sync(S, cfg) {
    if (!active(S) || !weekActive(S)) return false;
    let changed = false; const dk = S.cnt.day.k, done = S.msn.week.done;
    dailyDone(S, cfg).forEach((ok, i) => { const id = dk + ':' + (i + 1); if (ok && done.indexOf(id) < 0 && done.length < MAX_DONE) { done.push(id); changed = true; } });
    return changed;
  }
  const weekProgress = S => Math.min(WEEK_N, weekActive(S) ? S.msn.week.done.length : 0);

  /* ---- save-shape validation (also mirrored, structurally, by save.js) ---- */
  const isInt = (x, a, b) => typeof x === 'number' && isFinite(x) && Math.floor(x) === x && x >= a && x <= b;
  function validRewards(r) { if (!r || typeof r !== 'object' || Array.isArray(r)) return false; const ks = Object.keys(r); return ks.length >= 1 && ks.length <= 3 && ks.every(k => ['coins', 'energy', 'stars'].indexOf(k) >= 0 && isInt(r[k], 0, 1e6)); }
  function validMsn(m, chains) {
    if (!m || typeof m !== 'object' || Array.isArray(m) || m.v !== 1) return false;
    if (Object.keys(m).some(k => ['v', 'last', 'lw', 'day', 'week'].indexOf(k) < 0)) return false;
    if (m.last !== undefined && TEMPLATES.indexOf(m.last) < 0) return false;
    if (m.day !== undefined) { const d = m.day; if (!d || typeof d !== 'object' || Object.keys(d).some(k => ['k', 't', 'n', 'f', 'a', 'r3', 'r4', 'n4'].indexOf(k) < 0) || typeof d.k !== 'string' || d.k.length > 20 || TEMPLATES.indexOf(d.t) < 0 || !isInt(d.n, 1, 1000) || (d.a !== 0 && d.a !== 1) || !validRewards(d.r3) || !validRewards(d.r4) || !isInt(d.n4, 1, 100000)) return false; if (d.f !== undefined && (!Array.isArray(d.f) || d.f.length > 8 || d.f.some(c => chains.indexOf(c) < 0))) return false; if (d.t === 'fam' && !(d.f && d.f.length >= 1)) return false; }
    if (m.lw !== undefined && (!m.lw || typeof m.lw !== 'object' || Object.keys(m.lw).some(k => k !== 'a' && k !== 'b') || S4_T.indexOf(m.lw.a) < 0 || S5_T.indexOf(m.lw.b) < 0)) return false;
    if (m.week !== undefined && m.week && m.week.s !== undefined) { const t = m.week.s; if (!t || typeof t !== 'object' || Object.keys(t).some(k => ['a', 'b', 'n4', 'n5', 'r4', 'r5', 'f'].indexOf(k) < 0) || S4_T.indexOf(t.a) < 0 || S5_T.indexOf(t.b) < 0 || !isInt(t.n4, 1, 100000) || !isInt(t.n5, 1, 100000) || !validRewards(t.r4) || !validRewards(t.r5)) return false; if (t.f !== undefined && (!Array.isArray(t.f) || t.f.length > 8 || t.f.some(c => chains.indexOf(c) < 0))) return false; if (t.a === 'fam' && !(t.f && t.f.length >= FAM_COUNT)) return false; }
    if (m.week !== undefined) { const w = m.week; if (!w || typeof w !== 'object' || Object.keys(w).some(k => k !== 'k' && k !== 'done' && k !== 's') || typeof w.k !== 'string' || w.k.length > 20 || !Array.isArray(w.done) || w.done.length > MAX_DONE || w.done.some(x => typeof x !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}:[1-4]$/.test(x)) || new Set(w.done).size !== w.done.length) return false; }
    return true;
  }

  const API = { TEMPLATES, SLOT3, FAM_NEED, FAM_COUNT, COINS_N, SLOT3_REWARD, SLOT4_REWARD, WEEK_N, WEEK_REWARD, W5, assignWeek, week5, wfamRows, wslot4, wslot5, producibleFamilies, mixedPresent, eligibleTemplates, chooseTemplate, assignDay, startWeek,
    countMerge, countMixedDelivery, countCommission, active, weekActive, famRows, slot3, slot4, dailyDone, sync, weekProgress, validMsn, famKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.MISSIONS = API;
})();
