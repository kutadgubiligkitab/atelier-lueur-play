/* =========================================================
   Atelier Lueur — Makeup Atelier: pure data, commission rules and atomic transactions.

   STATUS: PROVISIONAL PRIVATE-PLAYTEST CONTRACT. Loaded by index.html / build.py / the Capacitor build and wired into game.js (UI slice).
   This file is the ONLY implementation of the Atelier rules; game.js and the UI call it and never re-implement it.
   Values come from docs/atelier/ATELIER_CONTRACT.md (a model-based proposal, NOT proven balance, NOT real-player data).

   Design: every rule works on the plain save document S (S.atl holds the Atelier state) and is exposed as a function that either
   mutates the state it is given (inside a txn) or returns a pure result. User actions take an `env`:
     env.S()         -> the CURRENT save document (inside txn this is the working clone)
     env.txn(fn)     -> game.js txn(): clone S, run fn, save(); on failure the clone is discarded and {ok:false} returned
     env.host        -> {give(r, ups), count(k, n)}  (game.js give() / count(): coins, stars + level-ups, task and event counters)
     env.supply      -> window.PROGRESSION.SUPPLY (price curve, usefulEquiv, queueMax)
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- data (single source for the contract) ---------------- */
  const UNLOCK_LEVEL = 25;
  const COMMISSION_CADENCE = 3;          // ordinary deliveries required after the previous commission was completed (the ONE tunable)
  const FIRST_A_COMMISSIONS = 5;         // completed commissions that always use recipe A
  const PRODUCER = 'atl';                // the Atelier Chest (outputs brush / bag 50:50 once wired; art gen_atl_1..3)
  const FAMILIES = ['brs', 'bag'];       // commission-only families, six ranks each (MAXLV 6)
  const GUARANTEED = [                   // free copies, recorded once per save in S.pg (rank-1 chest each)
    { key: 'atl-25', level: 25 }, { key: 'atl-32', level: 32 }, { key: 'atl-44', level: 44 },
  ];
  const CHAPTER_REWARD = { coins: 100, energy: 20 };   // = the existing album chapter reward in game.js (not changed)
  const RECIPES = {
    A: { id: 'A', parts: [{ c: 'lip', l: 4 }, { c: 'brs', l: 3 }, { c: 'bag', l: 3 }], coins: 117, stars: 26, name: { en: 'Lip Look Kit', ug: 'لەۋ گىرىمى توپلىمى' } },
    B: { id: 'B', parts: [{ c: 'cmp', l: 5 }, { c: 'brs', l: 4 }, { c: 'bag', l: 4 }], coins: 186, stars: 32, name: { en: 'Powder Studio Kit', ug: 'پۇدرا گىرىمى توپلىمى' } },
  };
  const NAMES = { atelier: { en: 'Makeup Atelier', ug: 'گىرىم ئاتېلىيېسى' } };
  const REQUIRED_PRODUCER_GRANTS = ['pink-12', 'lav-16', 'skn-15'];   // the three existing producer types, as recorded in S.pg
  const REQUIRED_FAMILIES = ['lip', 'cmp'];                           // all six ranks seen (the commission ingredients owned by ordinary play)
  const MAXLV = 6;
  const PRODUCER_OUTPUT = ['brs', 'bag'];   // the Atelier Chest produces brush / bag, picked 50:50 by the game's existing producer code
  const ART_IDS = [1, 2, 3, 4, 5, 6].map(l => 'brs_' + l).concat([1, 2, 3, 4, 5, 6].map(l => 'bag_' + l), [1, 2, 3].map(l => 'gen_atl_' + l));

  const isInt = (x, a, b) => typeof x === 'number' && isFinite(x) && Math.floor(x) === x && x >= a && x <= b;

  /* ---------------- state helpers ---------------- */
  const hasChapter = s => !!(s.atl && s.atl.u === 1);
  function unlockStatus(s) {
    const missing = [];
    if (!(s.lv >= UNLOCK_LEVEL)) missing.push({ k: 'level', have: s.lv, need: UNLOCK_LEVEL });
    for (const key of REQUIRED_PRODUCER_GRANTS) if (!(s.pg && s.pg[key])) missing.push({ k: 'producer', key });
    for (const c of REQUIRED_FAMILIES) { let n = 0; for (let l = 1; l <= MAXLV; l++) if (s.seen && s.seen[c + l]) n++; if (n < MAXLV) missing.push({ k: 'seen', c, have: n, need: MAXLV }); }
    return { unlocked: hasChapter(s), eligible: missing.length === 0, missing };
  }

  /* shortfall = how many rank-1 equivalents the player still lacks for a recipe, from what is on the board RIGHT NOW (items only, never producers).
     per ingredient: need 2^(l-1) rank-1 equivalents; an exact-rank item (or better) covers it, otherwise lower ranks of the same family count at 2^(r-1) each. */
  function shortfall(s, id) {
    let total = 0;
    for (const p of RECIPES[id].parts) {
      const need = Math.pow(2, p.l - 1); let have = 0, exact = false;
      for (const it of s.board) if (it && it.c === p.c) { if (it.l >= p.l) exact = true; else have += Math.pow(2, it.l - 1); }
      if (!exact) total += Math.max(0, need - have);
    }
    return total;
  }
  /* Deterministic recipe choice, evaluated ONCE when a commission is created:
     the first FIRST_A_COMMISSIONS completed commissions are always A; afterwards B only if its shortfall is strictly smaller than A's; ties go to A.
     (PROPOSAL, deliberately NOT implemented: forbidding B twice in a row. See docs/atelier/ATELIER_CONTRACT.md.) */
  function chooseRecipe(s) {
    const a = s.atl;
    if (a.d < FIRST_A_COMMISSIONS) return 'A';
    return shortfall(s, 'B') < shortfall(s, 'A') ? 'B' : 'A';
  }
  function createCommission(s) {          // mutates s; rewards and recipe are FROZEN into the commission here
    const a = s.atl, r = chooseRecipe(s), rec = RECIPES[r];
    a.n += 1; a.cur = { r, n: a.n, coins: rec.coins, stars: rec.stars };
    return a.cur;
  }

  /* ---------------- producer copies (existing conventions: board if a cell is free, else the persistent queue) ---------------- */
  const emptyCell = s => s.board.findIndex(x => !x);
  function equivOf(s, g) { let n = 0; s.board.forEach(it => { if (it && it.g === g) n += 1 << (it.l - 1); }); (s.queue || []).forEach(q => { if (q.g === g) n += 1 << (q.l - 1); }); return n; }
  function producerPrice(s, supply) { const P = supply.price, k = (s.pbuy && s.pbuy[PRODUCER]) || 0; return Math.min(P.cap, Math.round(P.base * Math.pow(P.growth, k) / 50) * 50); }
  function deliverProducer(s, g, l) {
    const i = emptyCell(s); if (i >= 0) { s.board[i] = { g, l }; return 'board'; }
    s.qid = (s.qid || 0) + 1; (s.queue || (s.queue = [])).push({ g, l, id: s.qid }); return 'queue';
  }
  /* Guaranteed chests: each key once per save (ledger S.pg). Only for an unlocked Atelier; a player already past a level receives it once. */
  function grantDue(s) {
    const notes = [];
    if (!hasChapter(s)) return notes;
    for (const m of GUARANTEED) if (s.lv >= m.level && !(s.pg && s.pg[m.key])) { (s.pg || (s.pg = {}))[m.key] = 1; notes.push({ key: m.key, where: deliverProducer(s, PRODUCER, 1) }); }
    return notes;
  }

  /* ---------------- ordinary-delivery counter ---------------- */
  /* Call INSIDE the same state change as an ORDINARY order delivery (before its save). Commission deliveries never call this.
     Deliveries made while a commission is active do not count: the counter measures ordinary deliveries AFTER the last completion. */
  function onOrdinaryDelivery(s) {
    const a = s.atl; if (!a || a.u !== 1 || a.cur) return { advanced: false, created: false };
    a.s = Math.min(1000, a.s + 1);
    if (a.s >= COMMISSION_CADENCE) { createCommission(s); return { advanced: true, created: true }; }
    return { advanced: true, created: false };
  }

  /* ---------------- requirements / deterministic cell selection ---------------- */
  /* For each ingredient the LOWEST board index holding an exact {c,l} item not already chosen for another ingredient (row-major).
     Items only: producer cells ({g,l}) never match. There is no item protection in the current game, so nothing else is excluded. */
  function requirements(s) {
    const a = s.atl; if (!a || !a.cur) return null;
    const rec = RECIPES[a.cur.r], used = new Set(), rows = [];
    for (const p of rec.parts) {
      let cell = -1, have = 0;
      s.board.forEach((it, i) => { if (it && it.c === p.c && it.l === p.l) { have++; if (cell < 0 && !used.has(i)) cell = i; } });
      if (cell >= 0) used.add(cell);
      rows.push({ c: p.c, l: p.l, have, cell });
    }
    return { recipe: rec.id, parts: rows, ready: rows.every(r => r.cell >= 0), rewards: { coins: a.cur.coins, stars: a.cur.stars }, seq: a.cur.n };
  }

  /* ---------------- transactions ---------------- */
  /* State-only unlock (no write): state + the free chest + due guaranteed chests + the first commission. Used inside other durable state changes
     (level-up, merge, start-up, import) and by activate(). Returns null when not eligible / already unlocked, so an ineligible player gets nothing. */
  function activateState(s) {
    const st = unlockStatus(s);
    if (st.unlocked || !st.eligible) return null;
    s.atl = { v: 1, u: 1, d: 0, s: COMMISSION_CADENCE, n: 0 };         // first commission is available immediately (cadence applies AFTER a completion)
    const grants = grantDue(s); createCommission(s);
    return { grants, commission: s.atl.cur };
  }
  function activate(env) {                // unlock as ONE transaction
    return env.txn(() => {
      const s = env.S(), st = unlockStatus(s);
      if (st.unlocked) return { ok: false, reason: 'already' };
      if (!st.eligible) return { ok: false, reason: 'locked', missing: st.missing };
      const r = activateState(s);
      return { ok: true, grants: r.grants, commission: r.commission };
    });
  }
  function deliverCommission(env) {
    return env.txn(() => {
      const s = env.S(), a = s.atl;
      if (!a || a.u !== 1) return { ok: false, reason: 'locked' };
      if (!a.cur) return { ok: false, reason: 'none' };               // also what a repeated tap finds after a successful delivery
      const req = requirements(s);
      if (!req.ready) return { ok: false, reason: 'missing', parts: req.parts };
      const { r, coins, stars } = a.cur, cells = req.parts.map(p => p.cell);
      if (new Set(cells).size !== 3) return { ok: false, reason: 'error' };
      cells.forEach(i => { s.board[i] = null; });                     // exactly three distinct cells
      const ups = []; env.host.give({ coins, stars }, ups);           // coins (task counter) + stars (level-ups collected, same document)
      env.host.count('order');                                        // counts as ONE order for tasks and events
      if (env.host.onCommission) env.host.onCommission({ recipe: r });   // optional host hook (daily missions): same transaction, no rule is affected
      delete a.cur; a.d += 1; a.s = 0;                       // complete; the ordinary counter restarts from 0 (not advanced by this delivery)
      const grants = grantDue(s);                                     // a level-up inside this delivery may owe a chest (32 / 44)
      return { ok: true, recipe: r, coins, stars, cells, ups, grants };
    });
  }
  function buyChest(env) {                // extra copy: existing price curve (3000 x 2^k, cap), usefulEquiv ownership limit and queueMax
    return env.txn(() => {
      const s = env.S(), sup = env.supply;
      if (!hasChapter(s)) return { ok: false, reason: 'locked' };
      const price = producerPrice(s, sup);
      if (equivOf(s, PRODUCER) >= sup.usefulEquiv) return { ok: false, reason: 'enough' };
      if (s.coins < price) return { ok: false, reason: 'coins' };
      if (emptyCell(s) < 0 && (s.queue || []).length >= sup.queueMax) return { ok: false, reason: 'full' };
      s.coins -= price; (s.pbuy || (s.pbuy = {}))[PRODUCER] = ((s.pbuy[PRODUCER]) || 0) + 1;
      return { ok: true, where: deliverProducer(s, PRODUCER, 1), price };
    });
  }
  /* album chapters for the new families: shown once the Atelier is unlocked; existing reward (100 coins + 20 energy); 'all'/discover counts untouched */
  const chapters = s => (hasChapter(s) ? FAMILIES.slice() : []);
  function claimChapter(env, c) {
    return env.txn(() => {
      const s = env.S();
      if (chapters(s).indexOf(c) < 0) return { ok: false, reason: 'locked' };
      if (s.album[c]) return { ok: false, reason: 'claimed' };
      if (![1, 2, 3, 4, 5, 6].every(l => s.seen[c + l])) return { ok: false, reason: 'incomplete' };
      s.album[c] = 1; env.host.give(CHAPTER_REWARD, []);
      return { ok: true };
    });
  }

  /* ---------------- structural validation of S.atl (shared with save.js, which carries its own copy of these limits) ---------------- */
  function validAtl(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
    if (Object.keys(a).some(k => ['v', 'u', 'd', 's', 'n', 'cur'].indexOf(k) < 0)) return false;
    if (a.v !== 1 || a.u !== 1 || !isInt(a.d, 0, 1e6) || !isInt(a.s, 0, 1000) || !isInt(a.n, 0, 1e6)) return false;
    if (a.cur !== undefined) { const c = a.cur; if (!c || typeof c !== 'object' || Object.keys(c).some(k => ['r', 'n', 'coins', 'stars'].indexOf(k) < 0) || !RECIPES[c.r] || !isInt(c.n, 1, 1e6) || !isInt(c.coins, 0, 1e6) || !isInt(c.stars, 0, 1e6)) return false; }
    return true;
  }

  const API = {
    PRODUCER_OUTPUT, ART_IDS, UNLOCK_LEVEL, COMMISSION_CADENCE, FIRST_A_COMMISSIONS, PRODUCER, FAMILIES, GUARANTEED, CHAPTER_REWARD, RECIPES, NAMES, REQUIRED_PRODUCER_GRANTS, REQUIRED_FAMILIES,
    hasChapter, unlockStatus, activateState, shortfall, chooseRecipe, requirements, onOrdinaryDelivery, grantDue, chapters, validAtl, equivOf, producerPrice,
    activate, deliverCommission, buyChest, claimChapter,
    _createCommission: createCommission,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.ATELIER = API;
})();
