/* Atelier Lueur — salon area registry and gate rules (DATA + pure functions, no DOM, no storage).
   THIS FILE IS THE ONE CANONICAL DEFINITION of salon props, prices, positions and gates. tools/salon-sim.js and verify/salon-unit.js read it;
   docs quote it. Values marked "design parameter" are chosen, not measured on real players (see docs/salon/PROGRESSION_PLAN.md).

   Ownership lives in S.owned (id -> 1). Gate state is DERIVED from (level, owned, discovered core items) every time it is needed and is never stored.
   Rules:
   - A gate decides only whether a NOT-yet-owned prop can be bought. It never removes or hides ownership: owned props stay owned and drawn, even if an
     import/backup later leaves their prerequisites unmet (no deletion, no refund, no payout).
   - A stage is complete when all its props are owned (ownership, not gates), so a lower level after a restore cannot "un-complete" a stage.
   - An area is accessible (can be opened/viewed) when it is active and its unlock is met OR any of its props is already owned.
   - discovered = distinct valid ids of the ORIGINAL four families (lip|per|cmp|nail x ranks 1-6 = 24); never Skincare, producers or invented ids.
   - skn = distinct valid Skincare ranks skn1..skn6 present in S.seen (never producers, duplicates or unknown ids).
   - A stage is complete when all its REQUIRED props are owned (optional props, e.g. the Spa's accessories, never block completion or later gates).
   - A stage prerequisite is either a stage id (that stage complete) or {stage, minOwned} (at least that many of its props owned); it may name a stage of ANOTHER area.
   - GATE KINDS beyond level/stage/discovery (Makeup Studio): a stage may carry commissions (lifetime completed Atelier commissions, S.atl.d, never reset or consumed) and a prop may carry
     chapters (distinct Brush + Bag ranks 1-6 DISCOVERED in S.seen, max 12; never the album claim flag). Both are plain thresholds on derived inputs (inp.com, inp.chap); optional props never
     appear in a minOwned target of the same area's required path (verify/makeup-rules.js).
   - COLOUR VARIANTS (Spa): the slot is owned through S.owned[slot] (any ONE colour satisfies it); colours are separate records S.vo[slot_colour] = 1 and the equipped
     colour is S.ve[slot]. A slot that is owned but has no vo record owns and equips its default colour implicitly (derived, never stored), so furniture bought before
     variants existed needs no migration and no repurchase. Unknown slots/colours in vo/ve are preserved by the save but never count, never satisfy gates and are never equipable. */
(function () {
'use strict';
const CORE_FAMILIES = ['lip', 'per', 'cmp', 'nail'], CORE_RANKS = 6;
const CORE_TOTAL = CORE_FAMILIES.length * CORE_RANKS;   // 24
const STUDIO_IDS = ['rug', 'flowers', 'table', 'mirror', 'chair', 'lamp', 'curtain', 'shelf'];
const AREAS = [
  { id: 'studio', active: true, unlock: null,
    draw: ['rug', 'curtain', 'shelf', 'mirror', 'table', 'chair', 'lamp', 'flowers'],
    stages: [ { id: 'studio', level: 1, after: [], discovered: 0, props: [      // today's room: no gate, prices and positions exactly as shipped
      { id: 'rug', price: 100, at: [90, 200, 180, 56] }, { id: 'flowers', price: 120, at: [234, 170, 36, 46] }, { id: 'table', price: 160, at: [76, 104, 100, 100] },
      { id: 'mirror', price: 220, at: [96, 30, 60, 80] }, { id: 'chair', price: 260, at: [168, 140, 64, 90] }, { id: 'lamp', price: 300, at: [316, 96, 36, 110] },
      { id: 'curtain', price: 380, at: [206, 20, 128, 150] }, { id: 'shelf', price: 450, at: [12, 40, 56, 140] } ] } ] },
  { id: 'reception', active: true, preview: 'reception-base',                                               // activated in slice S2 (Reception Art v1 installed)
    unlock: { level: 6, studioMin: 6, teaserStudioMin: 4 },                      // design parameters: right after the Studio is (nearly) done
    draw: ['rcprunner', 'rcpwall', 'rcpdesk', 'rcpsofa', 'rcpcase', 'rcpsign', 'rcpplant', 'rcptea', 'rcplights'],
    stages: [
      { id: 'rcp1', level: 6, after: [], discovered: 0, props: [ { id: 'rcprunner', price: 350 }, { id: 'rcpdesk', price: 450 }, { id: 'rcpsign', price: 500 } ] },
      { id: 'rcp2', level: 7, after: ['rcp1'], discovered: 20, props: [ { id: 'rcptea', price: 500 }, { id: 'rcpplant', price: 700 }, { id: 'rcpsofa', price: 700 } ] },
      { id: 'rcp3', level: 9, after: ['rcp2'], discovered: 0, props: [ { id: 'rcpwall', price: 1300 }, { id: 'rcplights', price: 1100, discovered: 22 }, { id: 'rcpcase', price: 1500, discovered: 24 } ] } ] }
,
  { id: 'spa', active: true, preview: 'spa-base',                                               // switched on: Spa Art v1 + UI (docs/salon/SPA_PLAN.md)
    unlock: { level: 15, afterStages: ['rcp2'], skn: 1, teaserAfterStage: 'rcp1' },            // level 15 (= the live Skincare unlock), Reception stage 2 complete, >= 1 skincare rank discovered
    palette: ['rose', 'sage', 'lilac'], defaultColour: 'rose', variantPriceFactor: 0.4,          // extra colours cost 40 % of the slot's base price (rounded to 10 coins)
    stars: { firstPurchaseOfSlot: 10, extraColour: 0, switch: 0 },                                // explicit decisions (docs/salon/COLOUR_VARIANTS.md): extra colours and switching grant nothing
    draw: ['sparug', 'spadrape', 'spashelf', 'spabasin', 'spatowels', 'spascreen', 'spabed', 'spachair', 'spafountain', 'spalamp', 'spaplant', 'spaorchid', 'spasteam', 'spatrolley', 'spapouf', 'spacandles'],
    stages: [
      { id: 'spa1', level: 15, after: [], discovered: 0, skn: 1, props: [
        { id: 'spabed', price: 1600, variants: true }, { id: 'spascreen', price: 900, variants: true }, { id: 'spatowels', price: 700 }, { id: 'sparug', price: 500 } ] },
      { id: 'spa2', level: 15, after: [{ stage: 'spa1', minOwned: 3 }], discovered: 0, skn: 3, props: [
        { id: 'spatrolley', price: 1300 }, { id: 'spasteam', price: 1500 }, { id: 'spachair', price: 1700, variants: true }, { id: 'spabasin', price: 1800 } ] },
      { id: 'spa3', level: 17, after: [{ stage: 'spa2', minOwned: 3 }], discovered: 0, skn: 5, props: [
        { id: 'spadrape', price: 1500, variants: true }, { id: 'spaplant', price: 1100 }, { id: 'spalamp', price: 1200 }, { id: 'spapouf', price: 700, required: false } ] },
      { id: 'spa4', level: 19, after: [{ stage: 'spa3', minOwned: 2 }], discovered: 0, skn: 5, props: [
        { id: 'spashelf', price: 2200, skn: 6 }, { id: 'spafountain', price: 2600 }, { id: 'spacandles', price: 800, gems: 15, required: false }, { id: 'spaorchid', price: 900, gems: 18, required: false } ] } ] }
,
  { id: 'makeup', active: true, preview: 'makeup-base',                                              // switched on: Makeup Studio (docs/salon/MAKEUP_PLAN.md); art docs/art/makeup-v1
    unlock: { level: 22, afterStages: ['spa2'] },                                                  // level 22 + Spa stage 2 complete; NO Atelier prerequisite for the first stage (design parameters, not player data)
    draw: ['mkrug', 'mkmirror', 'mkshelf', 'mkgallery', 'mksheers', 'mkvanity', 'mkcabinet', 'mkplinth', 'mkring', 'mkchair'],
    stages: [
      { id: 'mks1', level: 22, after: [], discovered: 0, props: [ { id: 'mkrug', price: 600 }, { id: 'mkvanity', price: 1900 }, { id: 'mkchair', price: 1600 }, { id: 'mkmirror', price: 2400 } ] },
      { id: 'mks2', level: 25, after: [{ stage: 'mks1', minOwned: 3 }], discovered: 0, commissions: 6, props: [ { id: 'mkring', price: 1500 }, { id: 'mkcabinet', price: 2400 }, { id: 'mkshelf', price: 1300 } ] },
      // mks3: only mks2 is referenced by minOwned and mks2 holds required props only, so optional purchases can never become necessary (checked by verify/makeup-rules.js)
      { id: 'mks3', level: 25, after: [{ stage: 'mks2', minOwned: 2 }], discovered: 0, commissions: 16, props: [ { id: 'mkgallery', price: 2500 }, { id: 'mksheers', price: 900, gems: 15, required: false },
        { id: 'mkplinth', price: 3200, gems: 25, required: false, chapters: 12 } ] } ] }
];
const areaById = id => AREAS.find(a => a.id === id) || null;
const activeAreas = () => AREAS.filter(a => a.active);
const allProps = () => AREAS.flatMap(a => a.stages.flatMap(s => s.props.map(p => Object.assign({ area: a.id, stage: s.id }, p))));
const findProp = id => allProps().find(p => p.id === id) || null;
const knownIds = () => allProps().map(p => p.id);
const ownedIn = (area, owned) => area.stages.reduce((n, s) => n + s.props.filter(p => owned[p.id]).length, 0);
const isRequired = p => p.required !== false;
const stageComplete = (area, st, owned) => st.props.filter(isRequired).every(p => owned[p.id]);
const stageById = id => { for (const a of AREAS) { const st = a.stages.find(x => x.id === id); if (st) return { area: a, stage: st }; } return null; };
/* core discovery: count distinct valid ids from a map like {lip1:1,...} (S.seen) */
function coreDiscovered(seen) { let n = 0; for (const f of CORE_FAMILIES) for (let r = 1; r <= CORE_RANKS; r++) if (seen && seen[f + r]) n++; return n; }
/* skincare discovery: distinct valid ranks skn1..skn6 (never producers, duplicates, rank 0/7, or invented ids) */
const SKN_RANKS = 6;
function sknDiscovered(seen) { let n = 0; for (let r = 1; r <= SKN_RANKS; r++) if (seen && seen['skn' + r]) n++; return n; }
/* chapter discovery (Atelier album chapters): distinct ranks 1-6 of EACH commission-only family present in S.seen (max 12). Derived from DISCOVERY, never from the album claim flag
   S.album (claiming is a separate reward action); mirrors ATELIER.FAMILIES (verify/makeup-rules.js asserts equality). */
const CHAPTER_FAMILIES = ['brs', 'bag'], CHAPTER_TOTAL = CHAPTER_FAMILIES.length * CORE_RANKS;   // 12
function chapterDiscovered(seen) { let n = 0; for (const f of CHAPTER_FAMILIES) for (let r = 1; r <= CORE_RANKS; r++) if (seen && seen[f + r]) n++; return n; }
// lifetime completed Atelier commissions = S.atl.d (never reset, never consumed); absent / malformed atl = 0
const commissionsDone = atl => (atl && Number.isInteger(atl.d) && atl.d > 0) ? atl.d : 0;
// inp: { lv, owned, core, skn, vo?, ve?, com?, chap? }  (com = commissionsDone(S.atl), chap = chapterDiscovered(S.seen); both default to 0)  (core = coreDiscovered(S.seen), skn = sknDiscovered(S.seen))
function afterReason(entry, inp) {                      // null when satisfied, otherwise a reason {k, need, have, stage}
  const id = typeof entry === 'string' ? entry : entry.stage, ref = stageById(id); if (!ref) return { k: 'stage', need: id, have: 0, stage: id };
  if (typeof entry === 'string') return stageComplete(ref.area, ref.stage, inp.owned) ? null : { k: 'stage', need: id, have: ref.stage.props.filter(p => isRequired(p) && inp.owned[p.id]).length, stage: id, total: ref.stage.props.filter(isRequired).length };
  const have = ref.stage.props.filter(p => inp.owned[p.id]).length; return have >= entry.minOwned ? null : { k: 'stageMin', need: entry.minOwned, have, stage: id };
}
function unlockReasons(area, inp) {
  const u = area.unlock, out = []; if (!u) return out;
  if (inp.lv < u.level) out.push({ k: 'level', need: u.level, have: inp.lv });
  if (u.studioMin && ownedIn(areaById('studio'), inp.owned) < u.studioMin) out.push({ k: 'studio', need: u.studioMin, have: ownedIn(areaById('studio'), inp.owned) });
  for (const a of u.afterStages || []) { const r = afterReason(a, inp); if (r) out.push(r); }
  if (u.skn && (inp.skn || 0) < u.skn) out.push({ k: 'skn', need: u.skn, have: inp.skn || 0 });
  return out;
}
// the unlock requirements of an area as rows {k, need, have, met} (derived from area.unlock, so rules live in ONE place)
function unlockRequirements(area, inp) {
  const u = area.unlock, rows = []; if (!u) return rows;
  if (u.level) rows.push({ k: 'level', need: u.level, have: Math.min(inp.lv, u.level), met: inp.lv >= u.level });
  if (u.studioMin) { const h = ownedIn(areaById('studio'), inp.owned); rows.push({ k: 'studio', need: u.studioMin, have: Math.min(h, u.studioMin), met: h >= u.studioMin }); }
  for (const a of u.afterStages || []) { const r = afterReason(a, inp), ref = stageById(a), req = ref.stage.props.filter(isRequired); rows.push({ k: 'stage', stage: a, need: req.length, have: req.filter(p => inp.owned[p.id]).length, met: !r }); }
  if (u.skn) rows.push({ k: 'skn', need: u.skn, have: Math.min(inp.skn || 0, u.skn), met: (inp.skn || 0) >= u.skn });
  return rows;
}
/* ---- colour variants ---- */
const variantPropOf = id => { const p = findProp(id); return p && p.variants ? p : null; };
const isVariantSlot = id => !!variantPropOf(id);
const paletteOf = id => { const p = findProp(id); return p ? areaById(p.area).palette || [] : []; };
const defaultColourOf = id => { const p = findProp(id); return p ? areaById(p.area).defaultColour || null : null; };
const colourPrice = id => { const p = variantPropOf(id); return p ? Math.round(p.price * areaById(p.area).variantPriceFactor / 10) * 10 : 0; };
const voKey = (slot, colour) => slot + '_' + colour;
function ownedColours(id, owned, vo) {                 // palette order; explicit records, else the implicit default for an owned legacy slot
  if (!isVariantSlot(id) || !owned || !owned[id]) return [];
  const pal = paletteOf(id), ex = pal.filter(c => vo && vo[voKey(id, c)]);
  return ex.length ? ex : [defaultColourOf(id)];
}
function equippedColour(id, owned, vo, ve) {           // the equipped colour is always an owned, valid colour of this slot (else the first owned one)
  const oc = ownedColours(id, owned, vo); if (!oc.length) return null;
  const e = ve && ve[id]; return oc.indexOf(e) >= 0 ? e : oc[0];
}
/* consistency of the optional colour records with slot ownership; null = consistent. Unknown slots/colours (future builds) are tolerated and ignored. */
function checkVariants(owned, vo, ve) {
  owned = owned || {};
  for (const k of Object.keys(vo || {})) {
    const i = k.indexOf('_'), slot = k.slice(0, i), colour = k.slice(i + 1), p = findProp(slot);
    if (!p) continue;                                                                   // unknown slot: preserved, ignored
    if (!p.variants) return 'colour-record-for-slot-without-variants:' + k;             // a known slot that has no colours cannot own one
    if (paletteOf(slot).indexOf(colour) < 0) continue;                                  // unknown colour of a known slot: preserved, ignored
    if (!owned[slot]) return 'colour-without-slot:' + k;                                // colour owned but the slot is not
  }
  for (const slot of Object.keys(ve || {})) {
    const p = findProp(slot); if (!p) continue;
    if (!p.variants) return 'equipped-slot-without-variants:' + slot;
    if (!owned[slot]) return 'equipped-slot-not-owned:' + slot;
    if (paletteOf(slot).indexOf(ve[slot]) < 0) continue;                                // unknown colour: never equipable, preserved
    if (ownedColours(slot, owned, vo).indexOf(ve[slot]) < 0) return 'equipped-colour-not-owned:' + slot + '_' + ve[slot];
  }
  return null;
}
function evaluate(inp) {
  return AREAS.map(area => {
    const ur = unlockReasons(area, inp), ownedN = ownedIn(area, inp.owned);
    const unlockMet = ur.length === 0, u = area.unlock || {};
    const studioOwned = ownedIn(areaById('studio'), inp.owned);
    const teaserOk = (u.teaserStudioMin === undefined || studioOwned >= u.teaserStudioMin) && (!u.teaserAfterStage || (() => { const r = stageById(u.teaserAfterStage); return !!r && stageComplete(r.area, r.stage, inp.owned); })());
    const teaser = !!area.unlock && area.active && !unlockMet && (u.teaserStudioMin !== undefined || !!u.teaserAfterStage) && teaserOk;
    const stages = area.stages.map(st => {
      const sr = [];
      if (inp.lv < st.level) sr.push({ k: 'level', need: st.level, have: inp.lv });
      for (const a of st.after) { const r = afterReason(a, inp); if (r) sr.push(r); }
      if (inp.core < st.discovered) sr.push({ k: 'discover', need: st.discovered, have: inp.core });
      if (st.skn && (inp.skn || 0) < st.skn) sr.push({ k: 'skn', need: st.skn, have: inp.skn || 0 });
      if (st.commissions && (inp.com || 0) < st.commissions) sr.push({ k: 'commissions', need: st.commissions, have: inp.com || 0 });
      const open = unlockMet && sr.length === 0;
      const props = st.props.map(p => {
        const pr = []; if (p.discovered && inp.core < p.discovered) pr.push({ k: 'discover', need: p.discovered, have: inp.core });
        if (p.skn && (inp.skn || 0) < p.skn) pr.push({ k: 'skn', need: p.skn, have: inp.skn || 0 });
        if (p.commissions && (inp.com || 0) < p.commissions) pr.push({ k: 'commissions', need: p.commissions, have: inp.com || 0 });
        if (p.chapters && (inp.chap || 0) < p.chapters) pr.push({ k: 'chapters', need: p.chapters, have: inp.chap || 0 });
        const owned = !!inp.owned[p.id];
        const reasons = owned ? [] : (unlockMet ? sr.concat(pr) : ur.concat(sr, pr));
        const row = { id: p.id, price: p.price, gems: p.gems || 0, required: isRequired(p), owned, state: owned ? 'owned' : reasons.length ? 'locked' : 'open', reasons };
        if (p.variants) { row.variants = true; row.colours = ownedColours(p.id, inp.owned, inp.vo); row.equipped = equippedColour(p.id, inp.owned, inp.vo, inp.ve); }
        return row;
      });
      const req = props.filter(p => p.required);
      return { id: st.id, open, complete: stageComplete(area, st, inp.owned), reasons: sr, props, requiredOwned: req.filter(p => p.owned).length, requiredTotal: req.length };
    });
    const allP = stages.flatMap(s => s.props), reqP = allP.filter(p => p.required), optP = allP.filter(p => !p.required);
    return { id: area.id, active: area.active, unlockMet, unlockReasons: ur, teaser, accessible: area.active && (unlockMet || ownedN > 0), ownedCount: ownedN, total: allP.length,
      requiredOwned: reqP.filter(p => p.owned).length, requiredTotal: reqP.length, optionalOwned: optP.filter(p => p.owned).length, optionalTotal: optP.length, complete: reqP.every(p => p.owned), stages };
  });
}
function canBuy(inp, id) {                              // first purchase of a prop/slot (any colour)
  const p = findProp(id); if (!p) return { ok: false, code: 'unknown', reasons: [] };
  const area = areaById(p.area); if (!area.active) return { ok: false, code: 'inactive', reasons: [] };
  if (inp.owned[id]) return { ok: false, code: 'owned', reasons: [] };
  const a = evaluate(inp).find(x => x.id === p.area), pr = a.stages.flatMap(s => s.props).find(x => x.id === id);
  return pr.state === 'open' ? { ok: true, code: 'ok', reasons: [] } : { ok: false, code: 'locked', reasons: pr.reasons };
}
// an EXTRA colour of an already owned variant slot: no gate is re-evaluated (owned rooms stay usable after a rollback), only validity and non-duplication
function canBuyColour(inp, slot, colour) {
  const p = variantPropOf(slot); if (!p) return { ok: false, code: 'unknown' };
  if (!areaById(p.area).active) return { ok: false, code: 'inactive' };
  if (paletteOf(slot).indexOf(colour) < 0) return { ok: false, code: 'invalid-colour' };
  if (!inp.owned[slot]) return { ok: false, code: 'slot-not-owned' };
  if (ownedColours(slot, inp.owned, inp.vo).indexOf(colour) >= 0) return { ok: false, code: 'owned' };
  return { ok: true, code: 'ok', price: colourPrice(slot) };
}
function canEquip(inp, slot, colour) {
  if (!isVariantSlot(slot)) return { ok: false, code: 'unknown' };
  if (paletteOf(slot).indexOf(colour) < 0) return { ok: false, code: 'invalid-colour' };
  if (ownedColours(slot, inp.owned, inp.vo).indexOf(colour) < 0) return { ok: false, code: 'not-owned' };
  return { ok: true, code: 'ok' };
}
// structural sanity for tests: ids unique + valid, stage references exist (also across areas), no cycles, thresholds reachable, variants coherent
function validateData() {
  const errs = [], ids = new Set();
  for (const p of allProps()) { if (!/^[a-z]{1,24}$/.test(p.id)) errs.push('bad id ' + p.id); if (ids.has(p.id)) errs.push('dup id ' + p.id); ids.add(p.id); if (!(p.price > 0 && Number.isInteger(p.price))) errs.push('bad price ' + p.id); }
  const stageIds = AREAS.flatMap(a => a.stages.map(s => s.id)); if (new Set(stageIds).size !== stageIds.length) errs.push('duplicate stage id');
  const entryId = e => typeof e === 'string' ? e : e.stage;
  for (const a of AREAS) {
    const sids = a.stages.map(s => s.id), seen = {};
    for (const s of a.stages) for (const x of s.after) { const id = entryId(x); if (!sids.includes(id)) errs.push('missing stage ' + id); const ref = stageById(id); if (typeof x !== 'string' && ref && !(x.minOwned >= 1 && x.minOwned <= ref.stage.props.length && x.minOwned <= ref.stage.props.filter(isRequired).length)) errs.push('bad minOwned ' + s.id); }
    const visit = (id, path) => { if (path.includes(id)) { errs.push('cycle ' + path.concat(id).join('>')); return; } const s = a.stages.find(x => x.id === id); if (!s || seen[id]) return; for (const x of s.after) visit(entryId(x), path.concat(id)); seen[id] = 1; };
    sids.forEach(id => visit(id, []));
    for (const s of a.stages) {
      if (s.discovered > CORE_TOTAL) errs.push('unreachable discovery ' + s.id); if ((s.skn || 0) > SKN_RANKS) errs.push('unreachable skincare gate ' + s.id);
      for (const p of s.props) { if ((p.discovered || 0) > CORE_TOTAL) errs.push('unreachable discovery ' + p.id); if ((p.skn || 0) > SKN_RANKS) errs.push('unreachable skincare gate ' + p.id);
        if ((p.chapters || 0) > CHAPTER_TOTAL || (p.chapters !== undefined && !Number.isInteger(p.chapters))) errs.push('unreachable chapter gate ' + p.id); if (p.commissions !== undefined && !(Number.isInteger(p.commissions) && p.commissions >= 1 && p.commissions <= 1e6)) errs.push('bad commission gate ' + p.id); }
      if (s.commissions !== undefined && !(Number.isInteger(s.commissions) && s.commissions >= 1 && s.commissions <= 1e6)) errs.push('bad commission gate ' + s.id);
      if (!s.props.some(isRequired)) errs.push('stage without required prop ' + s.id);
    }
    if (a.unlock) {
      const st = areaById('studio'); if (a.unlock.studioMin > st.stages.reduce((n, s) => n + s.props.length, 0)) errs.push('unreachable studioMin ' + a.id); if (a.id === 'studio') errs.push('studio must be ungated');
      for (const x of a.unlock.afterStages || []) { const ref = stageById(entryId(x)); if (!ref) errs.push('missing unlock stage ' + entryId(x)); else if (ref.area.id === a.id) errs.push('unlock stage inside its own area ' + a.id); }
      if ((a.unlock.skn || 0) > SKN_RANKS) errs.push('unreachable skincare unlock ' + a.id);
      if (a.unlock.teaserAfterStage && !stageById(a.unlock.teaserAfterStage)) errs.push('missing teaser stage ' + a.id);
    }
    if (a.stages.length && a.unlock && a.stages[0].after.length) errs.push('first stage of ' + a.id + ' must not have prerequisites');
    const vp = a.stages.flatMap(s => s.props).filter(p => p.variants);
    if (vp.length) { if (!a.palette || a.palette.length < 2 || a.palette.some(c => !/^[a-z]{1,12}$/.test(c)) || a.palette.indexOf(a.defaultColour) < 0 || !(a.variantPriceFactor > 0 && a.variantPriceFactor < 1)) errs.push('bad palette ' + a.id); if (vp.some(p => !isRequired(p))) errs.push('optional variant slot in ' + a.id); }
  }
  return errs;
}
// reasons that mention stages need the stage ids to exist on every code path of the UI (names live in i18n); exported for tests
window.SALON = { AREAS, CORE_FAMILIES, CORE_TOTAL, SKN_RANKS, STUDIO_IDS, areaById, activeAreas, allProps, findProp, knownIds, ownedIn, stageComplete, stageById, isRequired, coreDiscovered, sknDiscovered, evaluate, canBuy, canBuyColour, canEquip,
  validateData, unlockRequirements, isVariantSlot, CHAPTER_FAMILIES, CHAPTER_TOTAL, chapterDiscovered, commissionsDone, paletteOf, defaultColourOf, colourPrice, voKey, ownedColours, equippedColour, checkVariants };
})();
