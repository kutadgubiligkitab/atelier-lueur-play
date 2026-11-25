/* Atelier Lueur — progression definitions (DATA). Pure, no DOM.
   Profile "v1" reproduces the SHIPPED order generator exactly (parity-tested in verify/progression.js), so early-game behaviour is
   unchanged. Other balance ideas live in docs/progression/ as PROPOSALS with evidence; nothing here changes difficulty by itself. */
(function () {
'use strict';
const PROFILES = {
  v1: {
    id: 'v1',
    // item-level ceiling of generated orders by player level (last band whose fromLevel <= level wins), capped by MAXLV
    orderBands: [ {fromLevel: 1, maxItemLevel: 2}, {fromLevel: 3, maxItemLevel: 3}, {fromLevel: 5, maxItemLevel: 4},
                  {fromLevel: 7, maxItemLevel: 5}, {fromLevel: 9, maxItemLevel: 6} ],
    spread: 2,                       // an order asks for an item level in [max - spread, max]
    avoidDuplicateTries: 10,         // try not to repeat a (chain, level) already open
    multiCount: {maxItemLevel: 2, chance: 0.4, n: 2},   // cheap items sometimes ask for two
    payout: {coinsA: 3, coinsB: 5, starsA: 2, starsB: 2} // coins = n*(l*l*A+B), stars = n*(l*A+B)
  }
};
/* Profile "v2" = v1 + MIXED-FAMILY orders (first post-level-9 content). Everything below the threshold level behaves exactly like v1.
   A mixed order asks for ONE item each from two DIFFERENT accessible families. Budget (data, conservative): both parts are 1 item,
   item levels in [ceiling-3, ceiling-2] (single orders use [ceiling-2, ceiling]), so a mixed order is never harder per item than the lowest
   single-order levels. At most `maxOpen` mixed order is visible at a time. Rewards are the existing per-item rules summed over both parts. */
PROFILES.v2 = Object.assign({}, PROFILES.v1, {id: 'v2', mixed: {fromLevel: 10, maxOpen: 1, chance: 0.35, offsets: [3, 2], count: 1}});
function bandFor(profile, level){
  let b = profile.orderBands[0];
  for (const x of profile.orderBands) if (level >= x.fromLevel) b = x;
  return b;
}
// rnd: () => [0,1). open: current orders (may contain null). Consumes randomness in the same order as the original engine.
// rnd: () => [0,1). open: current orders (may contain null). chains: the ACCESSIBLE item families (game passes those producible by the
// generators on the board). Consumes randomness in the same order as the original engine for single orders.
const payCoins = (P, l) => l * l * P.payout.coinsA + P.payout.coinsB, payStars = (P, l) => l * P.payout.starsA + P.payout.starsB;
function makeOrder(level, open, rnd, chains, maxLv, profileId){
  const P = PROFILES[profileId || 'v1'] || PROFILES.v1;
  const maxL = Math.min(maxLv, bandFor(P, level).maxItemLevel);
  const rn = k => Math.floor(rnd() * k);
  const M = P.mixed;
  if (M && level >= M.fromLevel && chains.length >= 2 && open.filter(o => o && o.m).length < M.maxOpen && rnd() < M.chance){
    const lo = Math.max(1, maxL - M.offsets[0]), hi = Math.max(lo, maxL - M.offsets[1]);
    const i = rn(chains.length); let j = rn(chains.length - 1); if (j >= i) j++;          // two DISTINCT families
    const l1 = lo + rn(hi - lo + 1), l2 = lo + rn(hi - lo + 1), n = M.count;
    return {c: chains[i], l: l1, n, coins: n * (payCoins(P, l1) + payCoins(P, l2)), stars: n * (payStars(P, l1) + payStars(P, l2)), m: {c: chains[j], l: l2, n}};
  }
  const minL = Math.max(1, maxL - P.spread);
  const taken = (c, l) => open.some(o => o && ((o.c === c && o.l === l) || (o.m && o.m.c === c && o.m.l === l)));
  let c, l, tries = 0;
  do { c = chains[rn(chains.length)]; l = minL + rn(maxL - minL + 1); tries++; }
  while (tries < P.avoidDuplicateTries && taken(c, l));
  const n = (l <= P.multiCount.maxItemLevel && rnd() < P.multiCount.chance) ? P.multiCount.n : 1;
  return {c, l, n, coins: n * payCoins(P, l), stars: n * payStars(P, l)};
}
// the requirements of an order as a list: single orders have one, mixed orders two ({c,l,n} each)
const reqs = o => o.m ? [{c: o.c, l: o.l, n: o.n}, {c: o.m.c, l: o.m.l, n: o.m.n}] : [{c: o.c, l: o.l, n: o.n}];
/* Producer supply (data). Each milestone grants ONE rank-1 copy of a producer, exactly once per save (recorded in S.pg). Rank 2 needs 2 copies,
   rank 3 needs 4 copies (merge). Coin purchases: the k-th purchase of one producer type costs min(cap, round50(base * growth^k)); purchases stop being
   offered once the type already holds `usefulEquiv` rank-1 equivalents (enough for rank 3). Values chosen with tools/producer-sim.js (docs/producers/SIMULATION.md). */
const SUPPLY = {
  queueMax: 12, usefulEquiv: 4,
  price: {base: 3000, growth: 2, cap: 24000},
  milestones: [ {key: 'pink-12', level: 12, g: 'pink'}, {key: 'lav-16', level: 16, g: 'lav'}, {key: 'pink-24', level: 24, g: 'pink'},
                {key: 'lav-28', level: 28, g: 'lav'}, {key: 'pink-36', level: 36, g: 'pink'}, {key: 'lav-40', level: 40, g: 'lav'},
                {key: 'skn-15', level: 15, g: 'skn'}, {key: 'skn-22', level: 22, g: 'skn'}, {key: 'skn-34', level: 34, g: 'skn'} ],   // skn-15 = the Skincare unlock (first Spa Hamper)
};
window.PROGRESSION = { PROFILES, makeOrder, bandFor, reqs, SUPPLY };
})();
