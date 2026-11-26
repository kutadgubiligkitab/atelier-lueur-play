/* =========================================================
   Atelier Lueur — ئويۇن لوگىكىسى
   ========================================================= */
(function(){
'use strict';

/* ---------------- تەڭشەكلەر ---------------- */
const COLS = 7, ROWS = 8, N = COLS*ROWS;
const ENERGY_CAP = 100, ENERGY_MS = 120000;     // ONE shared cap: passive regeneration stops at 100 (rewards may exceed it); +1 energy every 2 minutes
const INITIAL_ENERGY = 50;                    // a new game still starts with 50 (separate from the cap)
const LEGACY_ENERGY_CAP = 50;                 // the cap before the 100 cap (used only to settle old saves exactly once)
const MAXLV = 6, GEN_MAXLV = 3;
const CORE_CHAINS = ['lip','per','cmp','nail'];            // the original four families (album 'all', discover counts and early-game orders use these)
const CHAINS = CORE_CHAINS.concat(['skn']);                  // + Skincare (unlocked at level 15 by its first Spa Hamper)
/* Makeup Atelier (atelier.js = the only rule implementation). Brush/bag are COMMISSION-ONLY: they are NOT in CHAINS, so accessibleChains()/order generation never see them.
   ALL_CHAINS / GEN_TYPES_ALL exist only so the save validator, producers, album and board accept the new families. */
const ATL = window.ATELIER;
const ALL_CHAINS = CHAINS.concat(ATL.FAMILIES);
const GEN_TYPES_ALL = ['pink','lav','skn',ATL.PRODUCER];
const GEN_CHAINS = { pink:['lip','nail'], lav:['per','cmp'], skn:['skn'], [ATL.PRODUCER]: ATL.PRODUCER_OUTPUT };
/* Daily/weekly mission variety (missions.js = pure rules; this file owns the clock, the save, the claim transaction and the UI) */
const MSN = window.MISSIONS;
const MSN_CFG = { orderChains: CHAINS, genChains: GEN_CHAINS, hasAtelier: s => ATL.hasChapter(s), daily: [{k:'merge', n:15}, {k:'order', n:4}],
  get mixedFrom(){ const pr = window.PROGRESSION.PROFILES[window.CONFIG.progressionProfile]; return pr && pr.mixed ? pr.mixed.fromLevel : Infinity; } };
const ENERGY_PACKS = {
  20: { amt: 20, ladder: [60, 90, 130, 180, 240, 310, 390, 480], cap: 4 },
  50: { amt: 50, ladder: [140, 200, 280, 380, 500, 640, 800, 980], cap: 4 }
};
const SALON = window.SALON;               // salon-data.js: the one canonical registry (props, prices, positions, gates)
const DECOS = SALON.areaById('studio').stages[0].props;         // the Studio room, exactly as shipped (id, price, [x,y,w,h])
const DRAW_ORDER = SALON.areaById('studio').draw;
const TASKS = {
  ach:    [{id:'a1',k:'level',n:5,r:{coins:200}}, {id:'a2',k:'discover',n:12,r:{energy:50}}, {id:'a3',k:'deco',n:8,r:{energy:100}}, {id:'a4',k:'level',n:10,r:{coins:500}}, {id:'a5',k:'discover',n:24,r:{coins:800}}],
};
const starsNeed = lv => 30 + lv*20;
function roadReward(lv){
  if (lv % 5 === 0) return {coins:200, energy:50};
  return [{coins:120},{energy:30},{coins:80},{energy:20,coins:40}][lv % 4];
}

/* ---------------- ياردەمچىلەر ---------------- */
const $ = id => document.getElementById(id);
const rnd = n => Math.floor(Math.random()*n);
const pick = a => a[rnd(a.length)];
const A = window.ART, C = window.CONFIG;
document.body.insertAdjacentHTML('afterbegin', A.DEFS);
const PREVIEW = typeof location !== 'undefined' && /\/preview(?:\/|$)/.test(location.pathname || '');
const KEY = PREVIEW ? 'atelierLueur.preview.v2' : 'atelierLueur.v2';   // preview play path uses its own save so the main playtest is untouched
SAVE.configure({N, CHAINS: ALL_CHAINS, CUSTOMERS: ['mira','elara','sora','amina','nila','celine'], MAXLV, GEN_TYPES: GEN_TYPES_ALL, GEN_MAXLV, LANG_KEYS:Object.keys(LANGS),
  validateEv: v => window.CONTENT.strictEventState(v), evSummary: v => window.CONTENT.summaryOf(v), checkVariants: (o, vo, ve) => window.SALON.checkVariants(o, vo, ve)});
// storage adapter: may throw (blocked storage / quota). save.js reports every failure; nothing is swallowed here.
const persist = SAVE.createStore({
  get: k => window.localStorage.getItem(k), set: (k, v) => window.localStorage.setItem(k, v), remove: k => window.localStorage.removeItem(k),
}, {primary: KEY, backup: KEY + '.backup', before: KEY + '.backup.before', corrupt: KEY + '.corrupt'});
const dayKey = () => { const d = new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
const weekKey = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return 'w'+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
const monthKey = () => { const d = new Date(); return d.getFullYear()+'-'+(d.getMonth()+1); };
const calendarKeys = () => ({ day: dayKey(), week: weekKey(), month: monthKey() });

/* ---------------- ھالەت ---------------- */
function newGame(){
  const b = Array(N).fill(null);
  b[2] = {g:'pink', l:1}; b[4] = {g:'lav', l:1};
  b[16] = {c:'lip', l:1}; b[17] = {c:'lip', l:1};
  b[19] = {c:'per', l:1};
  const s = {v:2, board:b, energy:INITIAL_ENERGY, et:Date.now(), ecap:ENERGY_CAP, coins:60, stars:0, lv:1, orders:[],
    seen:{}, owned:{}, road:{}, album:{},
    cnt:{day:{k:dayKey()}, week:{k:weekKey()}, month:{k:monthKey()}}, claimed:{}, gift:'',
    eshop:{v:1, k:dayKey(), n20:0, n50:0},
    set:{sound:true, music:true, soundVol:0.85, musicVol:0.40, vib:true, lang:(typeof pickBestLang==='function' ? pickBestLang(typeof navigator!=='undefined' && (navigator.language || (navigator.languages && navigator.languages[0]) || ''), Object.keys(LANGS)) : 'ug')}, secretSeen:false,
    tut:0, inv:{v:1, cap:4, items:[]}};
  b.forEach(it => { if (it && it.c) s.seen[it.c+it.l] = 1; });
  MSN.startMonth(s, monthKey(), MSN_CFG); MSN.startWeek(s, weekKey(), MSN_CFG); MSN.assignDay(s, MSN_CFG, dayKey());
  return s;
}
/* Boot classification: a genuine first launch, a readable save, a corrupt/missing save, or a storage error are DIFFERENT cases.
   Anything but "ok" blocks autosave until the player resolves it, so unrecovered data is never overwritten. */
let S = null, hasSave = false, recovery = null;
const saveGate = {blocked: false, memoryOnly: false, warn: null};
const PLAYTEST_COIN_GRANT_BUILT = 60000;   // play-site public builds rewrite this to 60000; store/release stays 0
function playtestCoinTarget(){
  const live = (typeof window !== 'undefined' && window.CONFIG) ? window.CONFIG.playtestCoinGrant : (C && C.playtestCoinGrant);
  const n = (typeof live === 'number' && isFinite(live) && live > 0) ? live : PLAYTEST_COIN_GRANT_BUILT;
  return (typeof n === 'number' && isFinite(n) && n > 0 && n <= 1e9) ? Math.floor(n) : 0;
}
function applyPlaytestCoinGrant(s){          // play-site builds only (grant > 0); tops up once per save after load+migration
  const n = playtestCoinTarget(); if (!n || !s || s.ptcg) return false;
  if (s.coins < n) s.coins = n; s.ptcg = 1; return true;
}
function isEstablishedSave(s){             // mid-game progress: never re-show the first-play tutorial (ignore coins; playtest grant may raise them)
  return !!(s && (s.lv > 1 || s.stars > 0 || (s.owned && Object.keys(s.owned).length)));
}
function settlePlaytestGrant(){            // after load and later migrations, and again when entering the board
  if (!S) return false;
  prepareCalendar(S);
  if (applyPlaytestCoinGrant(S)) { save(); return true; }
  return false;
}
function applyBoot(boot){
  hasSave = false; recovery = null; saveGate.blocked = false;
  if (boot.status === 'ok'){ S = boot.state; hasSave = true; prepareCalendar(S); applyPlaytestCoinGrant(S); return; }
  S = newGame(); applyPlaytestCoinGrant(S);
  if (boot.status === 'fresh') return;
  recovery = boot; saveGate.blocked = true;
  if (boot.status === 'corrupt') recovery.preserved = persist.preserveCorrupt(boot.raw);   // original bytes kept before anything else happens
}
/* Existing saves: accept v1 snapshots, then upgrade S.msn to v2 immediately (counters and already-claimed rewards stay). */
function prepareCalendar(s){
  if (!s.cnt.month) s.cnt.month = {k: monthKey()};
  if (!s.eshop || s.eshop.k !== dayKey()) s.eshop = {v:1, k: dayKey(), n20:0, n50:0};
  if (s.tut === undefined || (s.tut < 5 && isEstablishedSave(s))) s.tut = 5;   // old saves, or mid-game saves that somehow have tut < 5, skip the first-play tutorial
  if (!s.inv) s.inv = {v:1, cap:4, items:[]};
  MSN.migrate(s, MSN_CFG, calendarKeys());
}
applyBoot(persist.read());
let L = LANGS[S.set.lang] || LANGS.ug;
let selected = null, page = 'board', drag = null;

/* autosave: validated write + rate-limited last-known-good backup; failures are shown, never reported as success */
function setSaveWarn(code){
  saveGate.warn = code;
  const el = document.getElementById('saveWarn'); if (!el) return;
  const txt = !code ? '' : code === 'memory' ? L.warnMemory : code === 'backup' ? L.warnBackup : code === 'invalid-state' ? L.warnInvalid : L.warnSave;
  el.textContent = txt; el.hidden = !txt;
}
function save(forceBackup){
  if (saveGate.blocked || saveGate.memoryOnly) return false;
  const r = persist.write(S, {forceBackup: forceBackup === true});
  if (!r.ok) setSaveWarn(r.code === 'invalid-state' ? 'invalid-state' : 'storage');
  else setSaveWarn(r.backupFailed ? 'backup' : null);
  return r.ok;
}

/* ---------------- ئاۋاز ---------------- */
const AUDIO = window.AUDIO;
function audio(){ if (AUDIO) AUDIO.unlock(); }
function applyAudio(){ if (AUDIO && S && S.set) AUDIO.applySettings(S.set); }
const SFX = AUDIO && AUDIO.sfx ? AUDIO.sfx : { tap(){}, spawn(){}, merge(){}, coin(){}, level(){}, no(){}, drop(){}, ready(){}, deliver(){}, quest(){}, claim(){}, shop(){}, open(){}, close(){}, unlock(){}, empty(){} };
function sfxReward(r, alt){ if (r && r.coins) SFX.coin(); else if (typeof alt === 'function') alt(); else SFX.claim(); }
const buzz = ms => { if (S.set.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch(e){} };

/* ---------------- تىل ---------------- */
function applyLang(){
  L = LANGS[S.set.lang] || LANGS.ug;
  document.documentElement.dir = L.dir; document.documentElement.lang = S.set.lang;
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = L[el.dataset.t]);
}
const itemName = it => it.g ? L.gens[it.g] : L.items[it.c][it.l-1];
const itemArt  = it => it.g ? A.gen(it.g, it.l) : A.item(it.c, it.l);

/* ---------------- ئېنېرگىيە ---------------- */
/* Energy rules (all derived from the persisted S.energy + S.et timestamp; timers only REFRESH the display):
   * +1 every ENERGY_MS while below ENERGY_CAP; elapsed time is credited at the next tick/launch (offline included), in whole intervals;
     S.et advances by exactly the credited intervals, so partial progress is kept and a reload can never credit the same time twice.
   * At or above the cap the anchor follows "now": no recovery time is banked while full. Reward/purchase energy may exceed the cap and is never clamped or discarded.
   * A clock moved backwards never grants energy and never leaves the anchor in the future. */
function migrateEnergy(){                    // saves written under the old cap (50) are settled with the OLD rule once, then continue under the new cap
  if (S.ecap === ENERGY_CAP) return false; const now = Date.now();
  if (S.energy < LEGACY_ENERGY_CAP){ const n = Math.floor((now - S.et) / ENERGY_MS); if (n > 0){ S.energy = Math.min(LEGACY_ENERGY_CAP, S.energy + n); S.et += n * ENERGY_MS; } if (S.energy >= LEGACY_ENERGY_CAP) S.et = now; }
  else S.et = now;
  if (S.et > now) S.et = now; S.ecap = ENERGY_CAP; return true;
}
function tick(){
  const now = Date.now();
  if (S.et > now) S.et = now;
  if (S.energy < ENERGY_CAP){
    const n = Math.floor((now - S.et)/ENERGY_MS);
    if (n > 0){ S.energy = Math.min(ENERGY_CAP, S.energy + n); S.et += n*ENERGY_MS; if (S.energy >= ENERGY_CAP) S.et = now; }
  } else S.et = now;
  rolloverTasks();
}
/* Daily/weekly reset (existing calendar keys). The OLD day's completions are recorded first; today's assignment is snapshotted ONCE here (deterministic, never re-rolled by reload, language or re-import).
   A save from before this feature keeps its current day/week legacy tasks untouched until its next reset. Old per-day/per-week claim records are pruned (they would otherwise grow without bound). */
function rolloverTasks(){
  const dk = dayKey(), wk = weekKey(), mk = monthKey();
  if (!S.cnt.month) S.cnt.month = {k: mk};
  const dayChanged = S.cnt.day.k !== dk, weekChanged = S.cnt.week.k !== wk, monthChanged = S.cnt.month.k !== mk;
  if (!dayChanged && !weekChanged && !monthChanged) return;
  MSN.sync(S, MSN_CFG);
  if (monthChanged) { S.cnt.month = {k: mk}; MSN.startMonth(S, mk, MSN_CFG); }
  if (weekChanged) { S.cnt.week = {k: wk}; MSN.startWeek(S, wk, MSN_CFG); }
  if (dayChanged) { S.cnt.day = {k: dk}; S.eshop = {v:1, k: dk, n20:0, n50:0}; MSN.assignDay(S, MSN_CFG, dk); }
  Object.keys(S.claimed).forEach(k => {
    if (/^d[1-8]\d{4}-\d{1,2}-\d{1,2}$/.test(k) && k.replace(/^d[1-8]/,'') !== dk) delete S.claimed[k];
    if (/^w[1-5]w\d{4}-\d{1,2}-\d{1,2}$/.test(k) && k.replace(/^w[1-5]/,'') !== wk) delete S.claimed[k];
    if (/^m[1-4]\d{4}-\d{1,2}$/.test(k) && k.replace(/^m[1-4]/,'') !== mk) delete S.claimed[k];
  });
}
const fmtDur = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60; return h ? h + ':' + String(m).padStart(2,'0') + ':' + String(x).padStart(2,'0') : m + ':' + String(x).padStart(2,'0'); };
function energyTimes(now){                   // seconds to the next +1 and to full (0 when at/above the cap), from the persisted anchor
  if (S.energy >= ENERGY_CAP) return {next: 0, full: 0};
  const next = Math.max(0, ENERGY_MS/1000 - (now - S.et)/1000); return {next, full: next + (ENERGY_CAP - S.energy - 1) * ENERGY_MS/1000};
}
function count(k, n=1){
  S.cnt.day[k] = (S.cnt.day[k]||0) + n;
  S.cnt.week[k] = (S.cnt.week[k]||0) + n;
  if (S.cnt.month) S.cnt.month[k] = (S.cnt.month[k]||0) + n;
  MSN.sync(S, MSN_CFG);                                                    // record a daily objective the moment it is completed (same state change as the event)
  if (EV && !evSuppress) { try { if (EV.onCount(k, n)) evDirty = true; } catch(e){} }   // monthly-event progress (lives inside S.ev, saved with the wallet)
}

/* ---------------- Monthly events (content.js): local progress, bounded remote definitions, bundled fallback ---------------- */
let EV = null, evSuppress = false, evDirty = false, curDef = null, contentInfo = {source: 'bundled', status: 'idle'}, lastContentFetch = 0;
const CONTENT_CACHE_KEY = 'atelierLueur.content.v1', LEGACY_EVENTS_KEY = 'atelierLueur.events.v1';
// Event progress and claim records live in the MAIN save document (S.ev), so they commit atomically with the wallet and travel with
// export/import/backup/restore. Only a device-local clock guard has its own tiny key.
try { EV = window.CONTENT.createEvents({
  get: () => (S && S.ev) || null, ensure: () => (S.ev || (S.ev = {v: 1, events: {}})),
  clock: {get: () => window.localStorage.getItem(PREVIEW ? 'atelierLueur.preview.clock.v1' : 'atelierLueur.clock.v1'), set: v => window.localStorage.setItem(PREVIEW ? 'atelierLueur.preview.clock.v1' : 'atelierLueur.clock.v1', v)},
}); } catch(e){ EV = null; }
// One-time move of event state from the earlier separate key (build 90ce0fc) into the save. The old bytes are kept under ".migrated"
// (never deleted) and the old key is retired so a later import cannot resurrect stale state.
function migrateLegacyEvents(){
  try {
    if (PREVIEW) return false;                     // never touch the main event-migration key from a preview session
    if (!S || S.ev !== undefined || saveGate.blocked) return false;
    const raw = window.localStorage.getItem(LEGACY_EVENTS_KEY); if (!raw) return false;
    const ev = window.CONTENT.migrateLegacy(raw); if (!ev) return false;
    S.ev = ev; if (!save()){ delete S.ev; return false; }                      // only retire the old key after the save holds the data
    window.localStorage.setItem(LEGACY_EVENTS_KEY + '.migrated', raw); window.localStorage.removeItem(LEGACY_EVENTS_KEY); return true;
  } catch(e){ return false; }
}
function loadCachedDef(){ try { const raw = window.localStorage.getItem(CONTENT_CACHE_KEY); if (!raw) return null; const v = window.CONTENT.validateDefinition(JSON.parse(raw)); return v.ok ? v.def : null; } catch(e){ return null; } }
function applyContent(def){ try { curDef = def; if (EV && (EV.sync(def, S.lv) | EV.prune())) { save(); if ($('nav').children.length) renderNav(); } } catch(e){} }
async function refreshContent(force){
  if (!EV || !window.CONTENT) return;
  const url = C.contentUrl, t = Date.now();
  if (curDef && (!url || (!force && t - lastContentFetch < 600000))){ applyContent(curDef); return; }   // throttled: just re-evaluate eligibility locally
  const cached = loadCachedDef();
  let chosen = window.CONTENT.choose(null, cached); applyContent(chosen.def); contentInfo = {source: chosen.source, status: 'idle'};
  if (!url) return; lastContentFetch = t;
  const r = await window.CONTENT.fetchDefinition(url, {allowInsecureLocal: !!C.contentAllowInsecureLocal});
  if (r.ok){ chosen = window.CONTENT.choose(r, cached);
    if (chosen.source === 'remote'){ try { window.localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(chosen.def)); } catch(e){} }
    if (r.serverTime) EV.setServerTime(r.serverTime); contentInfo = {source: chosen.source, status: 'ok'}; applyContent(chosen.def);
  } else contentInfo = {source: chosen.source, status: 'failed', reason: r.reason};   // network/invalid/incompatible: keep playing on cache or bundled
}

/* ---------------- مۇكاپات ---------------- */
function give(r, ups){            // ups (optional): collect level-ups instead of announcing them (used by the atomic event-claim transaction)
  if (r.coins){ S.coins += r.coins; count('coins', r.coins); }
  if (r.energy) S.energy += r.energy;
  if (r.stars){ if (ups) ups.push(...addStarsCore(r.stars)); else addStars(r.stars); }
}
const rwHtml = r => [r.coins && `<span class="rw"><i>${A.icon('coin')}</i>${r.coins}</span>`,
  r.energy && `<span class="rw"><i>${A.icon('bolt')}</i>${r.energy}</span>`,
  r.stars && `<span class="rw"><i>${A.icon('star')}</i>${r.stars}</span>`].filter(Boolean).join(' ');
function addStarsCore(n){          // state change only; returns the level-ups so the caller can announce them AFTER the state is safely saved
  const ups = []; S.stars += n;
  while (S.stars >= starsNeed(S.lv)){
    S.stars -= starsNeed(S.lv); S.lv++;
    if (curDef && EV) { try { EV.sync(curDef, S.lv); } catch(e){} }   // level-gated events may become eligible
    const r = roadReward(S.lv); S.road[S.lv] = 1; give(r);
    ups.push({lv: S.lv, r}); ups.push(...grantMilestones());      // producer milestone copies (once per save, recorded in S.pg)
  }
  return ups;
}
function announceLevelUps(ups, inline){          // inline: the caller shows the level-up inside its own panel (Atelier reward card) instead of replacing that panel with a modal
  ups.forEach(u => { if (u.atelierUnlocked){ preloadSprites(); renderSide(); setTimeout(() => toast(L.atl.unlocked), 900); } });
  ups.forEach(u => { if (u.supply){ if (u.supply.g === 'skn' || u.supply.g === ATL.PRODUCER) preloadSprites(); setTimeout(() => toast((u.supply.first ? L.skincareUnlocked + ' ' : '') + (u.supply.where === 'board' ? L.supplyPlaced(L.gens[u.supply.g]) : L.supplyWaiting(L.gens[u.supply.g]))), u.supply.g === ATL.PRODUCER && ups.some(x => x.atelierUnlocked) ? 2600 : 900); } });   // after the "Atelier unlocked" toast
  ups.filter(u => u.lv).forEach(({lv, r}) => setTimeout(() => {
    SFX.level(); confetti(); buzz([30,40,30]);
    if (inline) return;
    modal(L.levelUp, `<div class="bigart">${A.icon('star')}</div>
      <div class="center" style="font-size:30px;font-weight:800">${L.level(lv)}</div>
      <div class="center" style="margin:10px 0;font-size:18px">${rwHtml(r)}</div>
      ${C.giftMode && lv === C.secretLevel ? `<div class="center" style="font-weight:800;color:var(--pink-dark)">${L.secretOpened}</div>` : ''}
      <button class="btn wide" data-close>${L.thanks}</button>`);
  }, 350));
}
function addStars(n){ announceLevelUps(addStarsCore(n)); }

/* ---------------- Producer supply: guaranteed copies, coin purchases, persistent delivery queue ----------------
   Every state change below is a plain mutation of the one save document; callers commit with ONE save() (txn() for user actions), so a granted /
   bought / placed producer can neither be lost nor duplicated by a crash, reload or failed write. */
const SUPPLY = () => window.PROGRESSION.SUPPLY;
const emptyCell = () => S.board.findIndex(x => !x);
function equivOf(g){ let n = 0; S.board.forEach(it => { if (it && it.g === g) n += 1 << (it.l - 1); }); (S.queue || []).forEach(q => { if (q.g === g) n += 1 << (q.l - 1); }); return n; }
function producerPrice(g){ const P = SUPPLY().price, k = (S.pbuy && S.pbuy[g]) || 0; return Math.min(P.cap, Math.round(P.base * Math.pow(P.growth, k) / 50) * 50); }
function deliverProducer(g, l){            // board if a cell is free, otherwise the persistent delivery queue
  const i = emptyCell(); if (i >= 0){ S.board[i] = {g, l}; return 'board'; }
  S.qid = (S.qid || 0) + 1; (S.queue || (S.queue = [])).push({g, l, id: S.qid}); return 'queue';
}
function grantMilestones(){               // exactly once per save: the ledger S.pg is part of the same document
  const notes = [];
  for (const m of SUPPLY().milestones) if (S.lv >= m.level && !(S.pg && S.pg[m.key])){ (S.pg || (S.pg = {}))[m.key] = 1; notes.push({supply: {g: m.g, where: deliverProducer(m.g, 1), first: m.key === 'skn-15'}}); }
  notes.push(...atelierNotes());            // Makeup Atelier: unlock (when eligible) + guaranteed chests, by the same once-per-save ledger
  return notes;
}
function atelierNotes(){                  // same document, no write: callers commit with their own save(). An ineligible player gets nothing.
  const notes = [], a = ATL.activateState(S);
  if (a){ notes.push({atelierUnlocked: true}); a.grants.forEach(g => notes.push({supply: {g: ATL.PRODUCER, where: g.where}})); }
  else ATL.grantDue(S).forEach(g => notes.push({supply: {g: ATL.PRODUCER, where: g.where}}));
  return notes;
}
const atelierEnv = () => ({S: () => S, txn, host: {give, count, onCommission: () => { MSN.countCommission(S); MSN.sync(S, MSN_CFG); }}, supply: SUPPLY()});
function txn(fn){                          // user action as ONE atomic write on a copy of the save; failure discards the copy
  if (saveGate.blocked || saveGate.memoryOnly) return {ok: false, reason: 'storage'};
  const real = S; S = JSON.parse(JSON.stringify(real));
  try { const r = fn(); if (!r.ok || !save()){ S = real; return r.ok ? {ok: false, reason: 'storage'} : r; } return r; }
  catch(e){ S = real; return {ok: false, reason: 'error'}; }
}
function buyProducer(g){
  return txn(() => {
    const price = producerPrice(g);
    if (equivOf(g) >= SUPPLY().usefulEquiv) return {ok: false, reason: 'enough'};
    if (S.coins < price) return {ok: false, reason: 'coins'};
    if (emptyCell() < 0 && (S.queue || []).length >= SUPPLY().queueMax) return {ok: false, reason: 'full'};
    S.coins -= price; (S.pbuy || (S.pbuy = {}))[g] = ((S.pbuy[g]) || 0) + 1;
    return {ok: true, where: deliverProducer(g, 1), price};
  });
}
function placeQueued(id){
  return txn(() => {
    const q = (S.queue || []).find(x => x.id === id); if (!q) return {ok: false, reason: 'none'};     // a repeated click finds nothing: never twice
    const i = emptyCell(); if (i < 0) return {ok: false, reason: 'board'};
    S.board[i] = {g: q.g, l: q.l}; S.queue = S.queue.filter(x => x.id !== id); if (!S.queue.length) delete S.queue; return {ok: true};
  });
}
function migrateSupply(){                  // existing players beyond a milestone receive it once; runs at start-up and after import/restore
  if (!S || saveGate.blocked) return;
  const notes = grantMilestones(); if (notes.length){ save(); announceLevelUps(notes); }
}
function supplyTypes(){ return ['pink', 'lav', 'skn', ATL.PRODUCER].filter(g => equivOf(g) > 0 || (S.pbuy && S.pbuy[g])); }
function supplyHtml(){
  const rows = supplyTypes().map(g => { const eq = equivOf(g), price = producerPrice(g), full = eq >= SUPPLY().usefulEquiv, poor = S.coins < price;
    return `<div class="row prow"><div class="art">${A.gen(g, 1)}</div><div class="grow"><b>${L.gens[g]}</b><div class="muted" style="font-size:12px">${L.supplyCopies(Math.min(eq, SUPPLY().usefulEquiv), SUPPLY().usefulEquiv)}</div></div>
      ${full ? `<span class="muted" style="font-size:12px;max-width:80px;text-align:center">${L.supplyEnough}</span>`
        : `<button class="btn pink ${poor ? 'no' : ''}" data-pbuy="${g}" ${poor ? 'aria-label="' + L.supplyBuyNeed + '"' : ''}><span class="rw"><i>${A.icon('coin')}</i>${price}</span></button>`}</div>`; }).join('');
  const tray = (S.queue || []).map(q => `<div class="row prow"><div class="art">${A.gen(q.g, q.l)}</div><div class="grow"><b>${L.gens[q.g]}</b> · ${L.level(q.l)}<div class="muted" style="font-size:12px">${emptyCell() < 0 ? L.trayBoardFull : L.supplyWaiting(L.gens[q.g])}</div></div>
      <button class="btn" data-pplace="${q.id}" ${emptyCell() < 0 ? 'disabled' : ''}>${L.trayPlace}</button></div>`).join('');
  return (rows ? `<div class="ribbon small">${L.supplyTitle}</div><p class="muted center" style="margin:2px 0 4px;font-size:12px">${L.supplyNote}</p>${rows}` : '') + (tray ? `<div class="ribbon small">${L.trayTitle}</div>${tray}` : '');
}
const lastBuy = {};
function wireSupply(reopen){
  document.querySelectorAll('#modal [data-pbuy]').forEach(b => b.onclick = () => {
    const now = Date.now(); if (now - (lastBuy[b.dataset.pbuy] || 0) < 800) return;      // an accidental double tap is not charged twice
    lastBuy[b.dataset.pbuy] = now;
    const r = b.dataset.pbuy === ATL.PRODUCER ? ATL.buyChest(atelierEnv()) : buyProducer(b.dataset.pbuy);     // Atelier Chest copies: rule lives in atelier.js (same price curve and ownership limit)
    if (r.ok){ SFX.shop(); renderTop(); renderBoard(); renderInfo(); toast(r.where === 'board' ? L.supplyPlaced(L.gens[b.dataset.pbuy]) : L.supplyWaiting(L.gens[b.dataset.pbuy])); }
    else { SFX.no(); toast(r.reason === 'coins' ? L.noCoins : r.reason === 'full' ? L.supplyFull : L.supplyFail); }
    reopen();
  });
  document.querySelectorAll('#modal [data-pplace]').forEach(b => b.onclick = () => {
    const r = placeQueued(+b.dataset.pplace);
    if (r.ok){ SFX.tap(); renderBoard(); renderInfo(); toast(L.trayPlaced); } else { SFX.no(); toast(r.reason === 'board' ? L.trayBoardFull : L.supplyFail); }
    reopen();
  });
}

/* ---------------- زاكازلار ---------------- */
function newOrder(slot){          // data-driven (progression.js, profile v1 = the original rules; verify/progression.js proves parity)
  const o = window.PROGRESSION.makeOrder(S.lv, S.orders, Math.random, accessibleChains(), MAXLV, C.progressionProfile);
  o.who = pickCustomer(slot);                 // customer identity is independent of the order (separate randomness; order generation is unchanged)
  return o;
}
// item families the player can actually produce: those made by a producer currently on the board (never request what cannot be made)
function accessibleChains(){
  const types = {}; S.board.forEach(it => { if (it && it.g) types[it.g] = 1; });
  const fam = CHAINS.filter(c => Object.keys(types).some(t => (GEN_CHAINS[t] || []).indexOf(c) >= 0));
  return fam.length ? fam : CHAINS.slice();
}
function fillOrders(){ migrateCustomers(); for (let i=0;i<3;i++) if (!S.orders[i]) S.orders[i] = newOrder(i); seedTutorialOrder(); }
function haveCount(c, l){ return S.board.filter(it => it && it.c===c && it.l===l).length; }
const needs = o => window.PROGRESSION.reqs(o);
function ready(o){ return !!o && needs(o).every(r => haveCount(r.c, r.l) >= r.n); }

/* ---------------- Reward / feedback motion (CSS + Web Animations; state commits first) ---------------- */
function fxReduce(){ return !!(typeof REDUCED !== 'undefined' ? REDUCED : (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)'))).matches; }
function fxLayer(){
  let el = $('fxLayer');
  if (!el){ el = document.createElement('div'); el.id = 'fxLayer'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
  return el;
}
function fxPt(el){
  if (!el || !el.getBoundingClientRect) return {x: innerWidth / 2, y: innerHeight / 3};
  const r = el.getBoundingClientRect();
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}
let fxCoinHold = null, fxCoinRaf = 0, fxStarHold = null, fxBits = 0;
const FX_BIT_CAP = 28;
function fxClearBit(el){ if (!el || !el.parentNode) return; el.remove(); fxBits = Math.max(0, fxBits - 1); }
function fxBounce(el, soft){
  if (!el || fxReduce() || !el.animate) return;
  try { el.getAnimations().forEach(a => { if (a._fxBounce) a.cancel(); }); } catch(e){}
  const peak = soft ? 1.06 : 1.1;
  const a = el.animate(
    [{transform:'scale(1)'},{transform:'scale(' + peak + ')'},{transform:'scale(1)'}],
    {duration: soft ? 180 : 240, easing:'cubic-bezier(.22,.8,.28,1)'}
  );
  a._fxBounce = true;
}
function fxCountCoins(target, dur){
  const el = $('tCv');
  const from = fxCoinHold != null ? fxCoinHold : (el ? (parseInt(el.textContent, 10) || target) : target);
  if (fxCoinRaf) cancelAnimationFrame(fxCoinRaf);
  if (fxReduce() || !el){ fxCoinHold = null; if (el) el.textContent = String(S.coins); return; }
  const t0 = performance.now(), len = dur || 120, dest = target;
  fxCoinHold = from;
  const step = now => {
    const t = Math.min(1, (now - t0) / len);
    const eased = 1 - Math.pow(1 - t, 3);
    fxCoinHold = from + (dest - from) * eased;
    if ($('tCv')) $('tCv').textContent = String(Math.round(fxCoinHold));
    if (t < 1) fxCoinRaf = requestAnimationFrame(step);
    else {
      fxCoinHold = dest === S.coins ? null : dest;
      fxCoinRaf = 0;
      if ($('tCv')) $('tCv').textContent = String(Math.round(dest === S.coins ? S.coins : dest));
    }
  };
  fxCoinRaf = requestAnimationFrame(step);
}
function fxTweenStarBar(fromPct, toPct, dur){
  const bar = $('tLvB'); if (!bar) return;
  if (fxReduce()){ fxStarHold = null; bar.style.width = toPct + '%'; return; }
  const start = fromPct;
  const t0 = performance.now(), len = dur || 160;
  fxStarHold = start;
  const step = now => {
    const t = Math.min(1, (now - t0) / len);
    const eased = 1 - Math.pow(1 - t, 3);
    fxStarHold = start + (toPct - start) * eased;
    if ($('tLvB')) $('tLvB').style.width = fxStarHold + '%';
    if (t < 1) requestAnimationFrame(step);
    else {
      const done = Math.min(100, S.stars / starsNeed(S.lv) * 100);
      fxStarHold = Math.abs(toPct - done) < 0.2 ? null : toPct;
      if ($('tLvB')) $('tLvB').style.width = (fxStarHold == null ? done : toPct) + '%';
    }
  };
  requestAnimationFrame(step);
}
function fxBezier(p0, p1, p2, p3, t){
  const u = 1 - t, uu = u * u, tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y
  };
}
function fxFlyBits(kind, from, to, n, stagger, onLand){
  n = Math.max(0, Math.min(8, n | 0));
  if (!n || fxReduce() || !from || !to) { if (onLand) onLand(true); return 0; }
  const layer = fxLayer();
  const html = kind === 'star' ? A.icon('star') : A.icon('coin');
  const dur = 760, gap = 36;
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const perp = ang + Math.PI / 2;
  let spawned = 0;
  for (let i = 0; i < n; i++){
    let d = null;
    const last = i === n - 1;
    const finish = () => { if (onLand) onLand(last); if (d) fxClearBit(d); };
    if (fxBits >= FX_BIT_CAP) { finish(); continue; }
    d = document.createElement('div');
    d.className = 'fxBit fx' + (kind === 'star' ? 'Star' : 'Coin');
    d.innerHTML = html;
    layer.appendChild(d); fxBits++; spawned++;
    const fan = n === 1 ? 0 : (i - (n - 1) / 2) / ((n - 1) / 2);           // -1..1
    const fanAng = ang + Math.PI * 0.72 + fan * 0.95;                     // burst outward, then curve in
    const fanDist = 34 + Math.abs(fan) * 20;
    const p1 = {x: from.x + Math.cos(fanAng) * fanDist, y: from.y + Math.sin(fanAng) * fanDist};
    const p2 = {
      x: from.x + (to.x - from.x) * 0.55 + Math.cos(perp) * fan * 22,
      y: Math.min(from.y, to.y) - (26 + Math.abs(fan) * 16)
    };
    const frames = [0, 0.14, 0.3, 0.5, 0.7, 0.88, 1].map(t => {
      const p = fxBezier(from, p1, p2, to, t);
      const sc = t < 0.14 ? 0.4 + t * 3 : t > 0.88 ? 0.5 : 1;
      const op = t === 0 ? 0 : (t > 0.94 ? 0 : 1);
      return {transform:'translate(' + p.x + 'px,' + p.y + 'px) scale(' + sc + ')', opacity:op, offset:t};
    });
    const delay = (stagger || 0) + i * gap;
    const anim = d.animate(frames, {duration:dur, delay:delay, easing:'cubic-bezier(.22,.6,.2,1)', fill:'forwards'});
    if (anim && anim.finished) anim.finished.then(finish).catch(finish); else setTimeout(finish, delay + dur + 40);
    setTimeout(() => fxClearBit(d), delay + dur + 200);
  }
  return spawned;
}
function fxRewardFlight(opts){
  const fromEl = opts && opts.from, coins = (opts && opts.coins) || 0, stars = (opts && opts.stars) || 0;
  const fromCoins = opts && opts.fromCoins != null ? opts.fromCoins : (fxCoinHold != null ? fxCoinHold : (S ? S.coins - coins : 0));
  const toCoins = opts && opts.toCoins != null ? opts.toCoins : (S ? S.coins : fromCoins);
  const fromPct = opts && opts.fromPct != null ? opts.fromPct : null;
  const toPct = opts && opts.toPct != null ? opts.toPct : (S ? Math.min(100, S.stars / starsNeed(S.lv) * 100) : 0);
  const src = fxPt(fromEl);
  const coinTo = fxPt($('tCv') && $('tCv').closest('.pill') || $('tCv'));
  const starTo = fxPt($('tLv'));
  if (fxReduce()){
    fxCoinHold = null; if ($('tCv')) $('tCv').textContent = String(S.coins);
    fxStarHold = null; if ($('tLvB')) $('tLvB').style.width = toPct + '%';
    return;
  }
  // Hold the displayed wallet at the pre-payout value until pieces start to land (renderTop would otherwise jump)
  if (coins && fxCoinHold == null){ fxCoinHold = fromCoins; if ($('tCv')) $('tCv').textContent = String(Math.round(fromCoins)); }
  const nCoin = coins ? Math.min(8, Math.max(5, Math.round(Math.min(8, 4 + coins / 20)))) : 0;
  const nStar = stars ? Math.min(6, Math.max(4, Math.round(Math.min(6, 3 + stars / 15)))) : 0;
  let coinLanded = 0, starLanded = 0, coinsDone = !nCoin, starsDone = !nStar;
  const coinPill = $('tCv') && $('tCv').closest('.pill');
  const onCoinLand = last => {
    if (coinsDone) return;
    coinLanded++;
    const shown = (last || coinLanded >= nCoin) ? toCoins : fromCoins + Math.round((toCoins - fromCoins) * (coinLanded / nCoin));
    if (last || coinLanded >= nCoin) coinsDone = true;
    fxBounce(coinPill, true);
    fxCountCoins(shown, last ? 140 : 100);
  };
  const onStarLand = last => {
    if (starsDone) return;
    starLanded++;
    const pct = (last || starLanded >= nStar || fromPct == null) ? toPct : fromPct + (toPct - fromPct) * (starLanded / nStar);
    if (last || starLanded >= nStar) starsDone = true;
    fxBounce($('tLv'), true);
    if (fromPct != null) fxTweenStarBar(fxStarHold != null ? fxStarHold : fromPct, pct, last ? 180 : 120);
  };
  if (!nCoin && !nStar){ if (coins) fxCountCoins(toCoins, 80); return; }
  if (nCoin) fxFlyBits('coin', src, coinTo, nCoin, 0, onCoinLand);
  if (nStar) fxFlyBits('star', src, starTo, nStar, 50, onStarLand);
  setTimeout(() => {                                        // never leave the counter short if a flight was capped
    if (coins && !coinsDone){ coinsDone = true; fxCountCoins(toCoins, 120); }
    if (stars && !starsDone && fromPct != null){ starsDone = true; fxTweenStarBar(fxStarHold != null ? fxStarHold : fromPct, toPct, 160); }
  }, 1100);
}

function deliver(oi){
  const o = S.orders[oi]; if (!ready(o)) { toast(L.notReady); SFX.no(); return; }       // all-or-nothing: nothing is consumed unless EVERY requirement is met
  const fromEl = $('orders') && $('orders').children[oi];
  const fromCoins = fxCoinHold != null ? fxCoinHold : S.coins;
  const fromPct = Math.min(100, S.stars / starsNeed(S.lv) * 100);
  const payCoins = o.coins, payStars = o.stars;
  needs(o).forEach(r => { let left = r.n;
    S.board.forEach((it,i) => { if (left && it && it.c===r.c && it.l===r.l){ S.board[i] = null; if (selected===i) selected=null; left--; } }); });
  give({coins:o.coins}); addStars(o.stars); count('order');                              // one payout, one generic order count — wallet commits before any animation
  if (o.m){ MSN.countMixedDelivery(S); MSN.sync(S, MSN_CFG); }                             // an ORDINARY mixed-family order (an Atelier commission is counted separately)
  const atl = ATL.onOrdinaryDelivery(S);                                                  // Atelier cadence: ordinary deliveries only (commission deliveries never come through here)
  SFX.deliver(); buzz(20);
  setPortrait(oi, 'happy');   // art reaction after a REAL successful delivery only
  const el = $('orders').children[oi]; if (el) el.classList.add('leave');
  lastWho[oi] = whoOf(o, oi); S.orders[oi] = null; save(); closeModal();
  fxRewardFlight({from: fromEl || el, coins: payCoins, stars: payStars, fromCoins, toCoins: S.coins, fromPct, toPct: Math.min(100, S.stars / starsNeed(S.lv) * 100)});
  if (atl.created){ setTimeout(() => { toast(L.atl.newCommission); renderSide(); }, 900); }
  if (S.tut === 3) tutAdvance(3);
  setTimeout(() => { S.orders[oi] = newOrder(oi); PSTATE[oi] = 'idle'; orderFx[oi] = 'arrive'; save(); renderOrders(); renderBoard(); renderTut(); }, 420);
  renderTop(); renderBoard(); renderInfo(); renderNav(); renderTut();
}


/* ---------------- ئامبار، قايتۇرۇش، تەبرىك ۋە قىسقا ئۆگىتىش ---------------- */
const INV_CAPS = [4, 8, 12], INV_EXPAND = {8: 300, 12: 800}, UNDO_MS = 8000;
function invCapFit(n, used){                         // only 4 / 8 / 12; never auto-upgrade because the player has many coins
  const need = Math.max(used || 0, INV_CAPS[0]);
  let cap = INV_CAPS[0];
  for (const c of INV_CAPS){ if (c >= need){ cap = c; break; } cap = c; }
  if (INV_CAPS.indexOf(n) >= 0 && n >= need) return n;
  return cap;
}
function invState(){
  if (!S.inv) S.inv = {v:1, cap:4, items:[]};
  const used = Array.isArray(S.inv.items) ? S.inv.items.length : 0;
  const cap = invCapFit(S.inv.cap, used);
  if (S.inv.cap !== cap) S.inv.cap = cap;            // repair a bad cap; never raise it past what was paid for / needed
  return S.inv;
}
function showIdleHint(){                             // first-play tutorial and other brand-new games only; established saves see storage
  return !!(S && S.tut < 5 && !isEstablishedSave(S));
}
function invFree(){ const inv = invState(); return inv.cap - inv.items.length; }
function storeSelected(){
  const cell = selected, it = cell != null ? S.board[cell] : null; if (!it) return {ok:false, reason:'none'};
  if (invFree() < 1){ toast(L.invFull); SFX.no(); return {ok:false, reason:'full'}; }
  const r = txn(() => {
    const inv = invState(); if (inv.items.length >= inv.cap) return {ok:false, reason:'full'};
    const cur = S.board[cell]; if (!cur) return {ok:false, reason:'none'};
    inv.items.push(cur.g ? {g:cur.g, l:cur.l} : {c:cur.c, l:cur.l}); S.board[cell] = null; return {ok:true};
  });
  if (r.ok){ selected = null; SFX.drop(); renderAll(); } else { SFX.no(); toast(r.reason==='full' ? L.invFull : L.supplyFail); }
  return r;
}
function placeInv(i){
  const r = txn(() => {
    const inv = invState(), it = inv.items[i]; if (!it) return {ok:false, reason:'none'};
    const j = emptyCell(); if (j < 0) return {ok:false, reason:'board'};
    S.board[j] = it.g ? {g:it.g, l:it.l} : {c:it.c, l:it.l}; inv.items.splice(i, 1); return {ok:true, j};
  });
  if (r.ok){ selected = r.j; SFX.tap(); renderAll(); } else { SFX.no(); toast(r.reason==='board' ? L.boardFull : L.supplyFail); }
  return r;
}
let invExpandBusy = false, lastExpandAt = 0;
function commitExpandInv(){
  const now = Date.now();
  if (now - lastExpandAt < 800) return {ok:false, reason:'busy'};
  lastExpandAt = now;
  return txn(() => {
    const inv = invState(), n = INV_CAPS[INV_CAPS.indexOf(inv.cap) + 1]; if (!n) return {ok:false, reason:'max'};
    const price = INV_EXPAND[n]; if (S.coins < price) return {ok:false, reason:'coins'};
    S.coins -= price; inv.cap = n; return {ok:true, cap:n};
  });
}
function expandInv(){                                 // confirm first; a double tap cannot buy twice
  if (invExpandBusy) return {ok:false, reason:'busy'};
  const inv = invState(), n = INV_CAPS[INV_CAPS.indexOf(inv.cap) + 1]; if (!n) return {ok:false, reason:'max'};
  const price = INV_EXPAND[n];
  if (S.coins < price){ SFX.no(); toast(L.noCoins); return {ok:false, reason:'coins'}; }
  invExpandBusy = true;
  modal(L.invExpandTitle, `<p class="center">${L.invExpandAsk(price, n)}</p><div style="display:flex;gap:8px"><button type="button" class="btn pink wide" id="invExY">${L.yes}</button><button type="button" class="btn wide" data-close>${L.no}</button></div>`);
  const yes = $('invExY');
  if (yes) yes.onclick = ev => {
    ev.preventDefault(); ev.stopPropagation();
    if (yes.dataset.used) return;
    yes.dataset.used = '1'; yes.disabled = true;
    const r = commitExpandInv();
    closeModal();
    if (r.ok){ SFX.shop(); toast(L.invExpanded(r.cap)); renderAll(); }
    else if (r.reason !== 'busy'){ SFX.no(); toast(r.reason==='coins' ? L.noCoins : L.supplyFail); }
  };
  return {ok:true, reason:'confirm'};
}
const INV_MARK = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="14" y="40" width="72" height="48" rx="8" fill="#fff6fa" stroke="#d24b84" stroke-width="5"/><path d="M14 54H86" stroke="#f5c84c" stroke-width="6"/><path d="M50 40V88" stroke="#f5b5d2" stroke-width="4"/><path d="M22 40L50 18L78 40" fill="#ffe6f1" stroke="#d24b84" stroke-width="5" stroke-linejoin="round"/></svg>`;
function invPanelHtml(){
  const inv = invState(), next = INV_CAPS[INV_CAPS.indexOf(inv.cap) + 1];
  let h = `<div class="invPanel"><div class="invLab"><span class="invIco">${INV_MARK}</span><span class="invName">${L.invTitle}</span></div><div class="invRow"><div class="invSlots">`;
  for (let i = 0; i < inv.cap; i++){
    const it = inv.items[i];
    h += `<button type="button" class="invSlot${it ? ' full' : ''}" data-inv="${i}">${it ? itemArt(it) : ''}</button>`;
  }
  h += `</div>`;
  if (next) h += `<button type="button" class="invExpand${S.coins < INV_EXPAND[next] ? ' no' : ''}" id="invExpand" aria-label="${L.invExpand(INV_EXPAND[next])}"><span class="invPlus">+</span><span class="rw"><i>${A.icon('coin')}</i>${INV_EXPAND[next]}</span></button>`;
  h += `</div></div>`;
  return h;
}
function bindInv(){
  const root = $('info') || $('invBar'); if (!root) return;
  root.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => {
    const i = +b.dataset.inv; if (invState().items[i]) placeInv(i); else storeSelected();
  });
  const ex = $('invExpand'); if (ex) ex.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); expandInv(); };
}
function renderInv(){                                // storage is drawn inside #info when that panel is in storage mode
  const box = $('info'); if (!box || !box.classList.contains('invMode')) return;
  bindInv();
}

let undoSale = null, undoTimer = 0;
function clearUndo(){ undoSale = null; clearInterval(undoTimer); undoTimer = 0; renderUndo(); }
function renderUndo(){
  const el = $('undoBar'); if (!el) return;
  const left = undoSale ? Math.ceil((undoSale.until - Date.now()) / 1000) : 0;
  if (!undoSale || left <= 0){ el.hidden = true; el.innerHTML = ''; if (undoSale && left <= 0) undoSale = null; return; }
  el.hidden = false;
  el.innerHTML = `<button type="button" class="btn pink" id="bUndo">${L.undo} · ${L.undoLeft(left)}</button>`;
  const bUndo = $('bUndo');
  if (bUndo && el.clientWidth && bUndo.scrollWidth > el.clientWidth - 8) bUndo.textContent = L.undo + ' · ' + left;  // ug "سېكۇنت" may not fit: keep the chip readable with the number only
  bUndo.onclick = undoLastSale;
}
function undoLastSale(){
  if (!undoSale || Date.now() >= undoSale.until){ clearUndo(); return; }
  const u = undoSale;
  if (S.coins < u.coins){ toast(L.noCoins); SFX.no(); return; }
  const r = txn(() => {
    if (S.coins < u.coins) return {ok:false, reason:'coins'};
    let j = (S.board[u.cell] == null) ? u.cell : emptyCell();
    if (j < 0){
      const inv = invState(); if (inv.items.length >= inv.cap) return {ok:false, reason:'board'};
      inv.items.push({c:u.it.c, l:u.it.l}); S.coins -= u.coins;
    } else { S.board[j] = {c:u.it.c, l:u.it.l}; S.coins -= u.coins; }
    const dec = (obj, k, n) => { if (obj && obj[k]) obj[k] = Math.max(0, obj[k] - n); };
    dec(S.cnt.day, 'coins', u.coins); dec(S.cnt.week, 'coins', u.coins); if (S.cnt.month) dec(S.cnt.month, 'coins', u.coins);
    return {ok:true, j: j < 0 ? -1 : j};
  });
  if (!r.ok){ SFX.no(); toast(r.reason==='board' ? L.boardFull : L.noCoins); return; }
  if (r.j >= 0) selected = r.j; SFX.drop(); clearUndo(); renderAll();
}

function genDropTable(l){ return l === 1 ? [{l:1,p:90},{l:2,p:10}] : l === 2 ? [{l:1,p:75},{l:2,p:25}] : [{l:1,p:60},{l:2,p:30},{l:3,p:10}]; }
function openGenUpgrade(g, l){
  const prev = {}, cur = genDropTable(l); genDropTable(l - 1).forEach(x => { prev[x.l] = x.p; });
  const fams = GEN_CHAINS[g] || [];
  const cells = fams.map(c => cur.map(d => {
    const neu = prev[d.l] === undefined;
    return `<div class="guOut${neu ? ' new' : ''}">${A.item(c, d.l)}<span class="guLv">${d.l}</span>${neu ? `<span class="guNew">${L.genUpNew}</span>` : ''}<span class="guP">${d.p}%</span></div>`;
  }).join('')).join('');
  modal(L.genUpTitle, `<div class="guHero">${A.gen(g, l)}</div><div class="center guName">${L.genUpName(L.gens[g], l)}</div>
    <div class="center guLead">${L.genUpLead} ↑</div><div class="guLab">${L.genUpOutputs}</div><div class="guGrid">${cells}</div>
    <div class="center muted guGo">${L.genUpContinue}</div>`);
  $('modal').classList.add('genUp');
}

function prevDayKey(k){
  const p = String(k || '').split('-').map(Number); if (p.length !== 3 || p.some(n => !isFinite(n))) return '';
  const d = new Date(p[0], p[1] - 1, p[2] - 1);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function giftStreakNext(){ const dk = dayKey(); return (S.gst && S.gst.k === prevDayKey(dk)) ? Math.min(3, (S.gst.n || 1) + 1) : 1; }
function giftReward(n){ const k = Math.max(1, Math.min(3, n)); return {energy: 20 + 10 * k, coins: 20 + 10 * k}; }
function claimDailyGift(){
  const dk = dayKey(); if (S.gift === dk) return {ok:false, reason:'already'};
  const n = giftStreakNext(), rew = giftReward(n);
  const fromCoins = fxCoinHold != null ? fxCoinHold : S.coins;
  S.gift = dk; S.gst = {k: dk, n}; give(rew); SFX.coin(); save();
  fxRewardFlight({from: $('shGift'), coins: rew.coins, stars: 0, fromCoins, toCoins: S.coins});
  if (S.tut === 4) tutAdvance(4);
  return {ok:true, n, rew};
}

function seedTutorialOrder(){
  if (!S || S.lv !== 1 || haveCount('per', 1) < 1) return;
  if (S.tut > 3) return;
  const o = S.orders[0]; if (o && o.c === 'per' && o.l === 1 && o.n === 1 && !o.m) return;
  const who = o && o.who; S.orders[0] = {c:'per', l:1, n:1, coins:8, stars:4}; if (who) S.orders[0].who = who;
}
function startTutorial(){ if (S.tut === 0){ S.tut = 1; save(); } renderTut(); }
function skipTut(){ S.tut = 5; save(); renderTut(); }
function tutAdvance(from){ if (S.tut !== from) return; S.tut = from === 4 ? 5 : from + 1; save(); renderTut(); }
function renderTut(){
  const layer = $('tutLayer'); if (!layer) return;
  document.querySelectorAll('.tutPulse').forEach(el => el.classList.remove('tutPulse'));
  if (!S || S.tut < 1 || S.tut > 4){ layer.hidden = true; layer.innerHTML = ''; return; }
  layer.hidden = false;
  const txt = [L.tut1, L.tut2, L.tut3, L.tut4][S.tut - 1];
  layer.innerHTML = `<div class="tutCard"><div class="tutN ltr">${S.tut}/4</div><p>${txt}</p><button type="button" id="tutSkip">${L.tutSkip}</button></div>`;
  $('tutSkip').onclick = ev => { ev.stopPropagation(); skipTut(); };
  const pulse = ids => ids.forEach(i => { const c = $('board') && $('board').children[i]; if (c) c.classList.add('tutPulse'); });
  if (S.tut === 1) pulse([2, 4]);
  if (S.tut === 2) pulse([16, 17]);
  if (S.tut === 3){ const o = $('orders') && $('orders').children[0]; if (o) o.classList.add('tutPulse'); }
  if (S.tut === 4){ const b = document.querySelector('#nav button[data-k="shop"]'); if (b) b.classList.add('tutPulse'); const g = $('shGift'); if (g) g.classList.add('tutPulse'); }
}

/* ---------------- تاختا ھەرىكەتلىرى ---------------- */
function produce(i){
  const g = S.board[i];
  if (S.energy < 1){ toast(L.noEnergy); SFX.empty(); openShop(); return; }
  const gr = Math.floor(i/COLS), gc = i%COLS;
  let best = -1, bd = 1e9;
  S.board.forEach((it,j) => { if (it) return; const d = (Math.floor(j/COLS)-gr)**2 + ((j%COLS)-gc)**2; if (d < bd){ bd = d; best = j; } });
  if (best < 0){ toast(L.boardFull); SFX.no(); return; }
  if (S.energy >= ENERGY_CAP) S.et = Date.now();      // recovery starts when the player drops below the cap (nothing was banked while full)
  S.energy--;
  const r = Math.random(), l = g.l===3 ? (r<.1?3:r<.4?2:1) : g.l===2 ? (r<.25?2:1) : (r<.1?2:1);
  const it = {c: pick(GEN_CHAINS[g.g]), l};
  S.board[best] = it; discover(it); count('tap');
  SFX.spawn(); buzz(8); save();
  if (S.tut === 1) tutAdvance(1);
  renderBoard({fly:{to:best, from:i}}); renderTop(); renderOrders(); renderInfo(); renderNav(); renderTut();
}
function discover(it){
  if (!it.c) return;
  const k = it.c + it.l;
  if (!S.seen[k]){ S.seen[k] = 1; if (it.l > 1) toast(L.newItem + ' ✨'); }
}
function canMerge(a, b){
  if (!a || !b) return false;
  if (a.c && b.c) return a.c===b.c && a.l===b.l && a.l < MAXLV;
  if (a.g && b.g) return a.g===b.g && a.l===b.l && a.l < GEN_MAXLV;
  return false;
}
function drop(from, to){
  if (to == null || to === from) return;
  const a = S.board[from], b = S.board[to];
  if (canMerge(a, b)){
    const genUp = !!(a.g), genType = a.g, genLv = a.l + 1, lipMerge = !!(a.c && a.c === 'lip');
    S.board[to] = a.c ? {c:a.c, l:a.l+1} : {g:a.g, l:a.l+1};
    S.board[from] = null; discover(S.board[to]); count('merge'); if (a.c){ MSN.countMerge(S, a.c, MSN_CFG); MSN.sync(S, MSN_CFG); }   // per-family merge counter (ordinary families only)
    const atl = S.board[to].c && !ATL.hasChapter(S) ? atelierNotes() : [];      // lipstick/powder rank 6 may complete the unlock prerequisites
    selected = to; SFX.merge(a.l+1); buzz(15); save(); if (atl.length) announceLevelUps(atl);
    if (lipMerge && S.tut === 2) tutAdvance(2);
    renderBoard({pop:to}); renderTop(); renderOrders(); renderInfo(); renderNav(); renderTut();
    if (genUp) openGenUpgrade(genType, genLv);
    return;
  }
  S.board[to] = a; S.board[from] = b; selected = to; SFX.drop(); save(); renderAll();
}
function tap(i){
  const it = S.board[i];
  if (!it){ selected = null; renderBoard(); renderInfo(); return; }
  selected = i;
  if (it.g) produce(i); else { SFX.tap(); renderBoard(); renderInfo(); }
}
function sell(){
  const it = S.board[selected]; if (!it || it.g) return;          // generators stay unsellable
  const cell = selected, copy = {c:it.c, l:it.l}, coins = it.l * 2;
  const fromEl = $('board') && $('board').children[cell];
  const fromCoins = fxCoinHold != null ? fxCoinHold : S.coins;
  give({coins}); S.board[selected] = null; selected = null; SFX.coin(); save();
  fxRewardFlight({from: fromEl, coins, stars: 0, fromCoins, toCoins: S.coins});
  undoSale = {it:copy, cell, coins, until: Date.now() + UNDO_MS};
  clearInterval(undoTimer); undoTimer = setInterval(() => { if (!undoSale || Date.now() >= undoSale.until) clearUndo(); else renderUndo(); }, 200);
  renderAll(); renderUndo();
}

/* ---------------- كۆرسىتىش ---------------- */
function renderAll(){ renderTop(); renderOrders(); renderBoard(); renderInfo(); renderNav(); renderSide(); renderInv(); renderUndo(); if (page==='salon') renderSalon(); layout(); renderTut(); }

function renderTop(){
  const pct = Math.min(100, S.stars/starsNeed(S.lv)*100);
  const et = energyTimes(Date.now()), timer = S.energy >= ENERGY_CAP ? L.energyFull : '+1 ' + fmtDur(et.next);
  if (!$('tLv')){
    $('top').innerHTML = `
      <div class="lvbadge" id="tLv">${A.icon('star')}<b id="tLvN"></b><div class="bar"><i id="tLvB"></i></div></div>
      <div class="pill" id="tEp"><span class="ic">${A.icon('bolt')}</span><span class="val ev"><span id="tEv"></span><span class="sub" id="tEt"></span></span><button class="plus" id="tE">+</button></div>
      <div class="pill"><span class="ic">${A.icon('coin')}</span><span class="val" id="tCv"></span><button class="plus" id="tC">+</button></div>
      <button class="roundbtn" id="tSet">${A.icon('gear')}</button>`;
    $('tLv').onclick = openRoad; $('tE').onclick = openShop; $('tEp').onclick = e => { if (!e.target.closest('#tE')) openEnergy(); };   // + keeps opening the Shop; the rest of the pill shows the energy details
    $('tC').onclick = openShop; $('tSet').onclick = openSettings;
  }
  $('tLvN').textContent = S.lv;
  if (fxStarHold == null) $('tLvB').style.width = pct + '%';
  $('tEv').textContent = S.energy + '/' + ENERGY_CAP; $('tEt').textContent = timer; $('tEt').classList.toggle('full', S.energy >= ENERGY_CAP);
  if (fxCoinHold == null) $('tCv').textContent = S.coins;
  else $('tCv').textContent = String(Math.round(fxCoinHold));
}
const ATL_PREVIEW_LEVEL = 20;              // UI only: from this level the locked Atelier tile (with its requirements) is shown; its single sprite loads only then
function renderSide(){                                 // the level star opens the road; no duplicate crown beside the orders
  let h = '';
  const atlOpen = ATL.hasChapter(S), atlReady = atlOpen && S.atl.cur && ATL.requirements(S).ready;
  if (atlOpen || S.lv >= ATL_PREVIEW_LEVEL) h += `<button class="roundbtn atlBtn${atlOpen ? '' : ' lock'}" id="sAtl" aria-label="${L.atl.entryLabel}">${A.item('brs', 3)}${atlReady ? '<span class="dot">!</span>' : ''}${atlOpen ? '' : `<span class="lk">${A.icon('lock')}</span>`}</button>`;
  if (C.giftMode) h += `<button class="roundbtn" id="sSecret">${A.icon('letter')}${S.lv >= C.secretLevel && !S.secretSeen ? '<span class="dot">!</span>' : ''}</button>`;
  $('side').innerHTML = h;
  if ($('sAtl')) $('sAtl').onclick = () => openAtelier();   // never pass the click event as the optional reward argument
  if (C.giftMode) $('sSecret').onclick = openSecret;
}
/* ---------------- Customer portraits (presentation only) ----------------
   Modern Characters v1: raster idle / blink / happy frames. They are NOT a layered rig:
   no separate eyes, mouth or arms, and the raised hand in the happy frame is a single still.
   HTML orders carry no customer identity in the save, so portraits are mapped by SLOT INDEX for display only.
   Nothing here is saved; orders, rewards, economy and the save format are untouched. */
const PORTRAIT_BY_SLOT = ['mira','elara','sora'];          // LEGACY slot identity: how an order saved without "who" has always looked
/* Customer registry: immutable ids. Identity is stored on the order ("who") so it survives rerender, language change, reload, import and restore.
   Customers are interchangeable for gameplay: every customer can get every order type (selection never reads appearance, tone, religion or ethnicity). */
const CUSTOMERS = ['mira','elara','sora','amina','nila','celine'];
const whoOf = (o, slot) => (o && o.who) || PORTRAIT_BY_SLOT[(slot || 0) % 3];
const lastWho = [null, null, null];          // the customer who just left a slot (memory only): the replacement prefers someone else
function pickCustomer(slot){
  const used = new Set(S.orders.map((o, i) => (o && i !== slot) ? whoOf(o, i) : null).filter(Boolean));
  let pool = CUSTOMERS.filter(c => !used.has(c));                 // prefer a portrait that is not already on a visible card
  const fresh = pool.filter(c => c !== lastWho[slot]); if (fresh.length) pool = fresh;
  return pick(pool.length ? pool : CUSTOMERS);
}
function migrateCustomers(){                 // orders saved before customer identity existed keep the face they always had (their slot's)
  let n = 0; S.orders.forEach((o, i) => { if (o && !o.who){ o.who = PORTRAIT_BY_SLOT[i % 3]; n++; } }); return n;
}
const PORTRAIT_STATES = ['idle','blink','happy'];
const PSTATE = ['idle','idle','idle'];
/* Customer arrival/departure: visual only, tied to genuine order lifecycle events (a delivery -> the card leaves after the happy
   frame; the replacement order created 420 ms later -> the new customer arrives). orderFx is consumed once by renderOrders, so a
   rerender, reload/import or language change never replays it. Economy and the 420 ms replacement timing are untouched. */
const orderFx = [null, null, null];
let custFxTimer = 0;
function armCustomerFx(){ clearTimeout(custFxTimer); custFxTimer = setTimeout(endCustomerFx, 800); }
function endCustomerFx(){
  clearTimeout(custFxTimer); custFxTimer = 0; orderFx[0] = orderFx[1] = orderFx[2] = null;
  const box = document.getElementById('orders'); if (box) box.querySelectorAll('.arriving').forEach(el => el.classList.remove('arriving'));
}
const PRELOADED = [];
const REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
function pAttrs(id, st){
  const inl = window.CHAR_INLINE;                       // single-file build embeds the @2x frames
  if (inl && inl[id+'-'+st]) return {src: inl[id+'-'+st], srcset: ''};
  const f = `assets/characters/customer-${id}-${st}`;   // local files, responsive density
  return {src: `${f}.png`, srcset: `${f}.png 1x, ${f}@2x.png 2x, ${f}@3x.png 3x`};
}
function preloadSprites(){   // local item/producer art: decode up front, no network
  ART.SPRITE_IDS.concat(skinUnlocked() ? ART.SKINCARE_IDS : [], ATL.hasChapter(S) ? ART.ATELIER_IDS : []).forEach(id => {
    if (PRELOADED.some(im => im.dataset && im.dataset.id === id)) return;
    const a = ART.spriteAttrs(id), im = new Image();
    if (a.srcset) im.srcset = a.srcset;
    im.dataset.id = id; im.src = a.src; PRELOADED.push(im);
    if (im.decode) im.decode().catch(() => {});
  });
}
function preloadPortraits(){
  CUSTOMERS.forEach(id => PORTRAIT_STATES.forEach(st => {
    const a = pAttrs(id, st), im = new Image();
    if (a.srcset) im.srcset = a.srcset;
    im.src = a.src; PRELOADED.push(im);
    if (im.decode) im.decode().catch(() => {});
  }));
}
function portraitHtml(slot){
  const id = whoOf(S.orders[slot], slot);
  return `<div class="cust" data-slot="${slot}" aria-hidden="true">` + PORTRAIT_STATES.map(st => {
    const a = pAttrs(id, st);
    return `<img class="${st}${PSTATE[slot]===st?' on':''}" src="${a.src}"${a.srcset?` srcset="${a.srcset}"`:''} alt="" draggable="false">`;
  }).join('') + `</div>`;
}
function setPortrait(slot, st){
  PSTATE[slot] = st;
  const el = document.querySelector(`#orders .cust[data-slot="${slot}"]`);
  if (el) el.querySelectorAll('img').forEach(i => i.classList.toggle('on', i.classList.contains(st)));
}
const blinkTimers = [];
function scheduleBlink(slot, first){
  clearTimeout(blinkTimers[slot]);
  if (REDUCED.matches || document.hidden) return;
  const wait = first ? 1200 + slot*1300 + Math.random()*600 : 2400 + Math.random()*3200;   // independent, staggered
  blinkTimers[slot] = setTimeout(() => {
    if (document.hidden || REDUCED.matches) return;
    if (PSTATE[slot] === 'idle'){
      setPortrait(slot, 'blink');
      setTimeout(() => { if (PSTATE[slot] === 'blink') setPortrait(slot, 'idle'); }, 110 + Math.random()*30);
    }
    scheduleBlink(slot, false);
  }, wait);
}
function startBlinks(){ [0,1,2].forEach(i => scheduleBlink(i, true)); }
function stopBlinks(){ blinkTimers.forEach(clearTimeout); [0,1,2].forEach(i => { if (PSTATE[i] === 'blink') setPortrait(i, 'idle'); }); }
document.documentElement.classList.toggle('tabHidden', document.hidden);
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('tabHidden', document.hidden);
  if (document.hidden){ stopBlinks(); endSalonFx(); endCustomerFx(); } else startBlinks();
});   // no backlog on return; looping portrait motion pauses while the tab is hidden
if (REDUCED.addEventListener) REDUCED.addEventListener('change', () => { REDUCED.matches ? stopBlinks() : startBlinks(); });

const orderReadyBit = [false, false, false];
function renderOrders(){
  const box = $('orders'); box.innerHTML = '';
  S.orders.forEach((o, oi) => {
    const d = document.createElement('div'); d.className = 'order';
    if (!o){ d.style.visibility = 'hidden'; box.appendChild(d); orderReadyBit[oi] = false; return; }
    if (orderFx[oi] === 'arrive'){ d.classList.add('arriving'); armCustomerFx(); }   // one-shot: consumed here, never replayed
    orderFx[oi] = null;
    const rq = needs(o).map(q => ({q, have: Math.min(q.n, haveCount(q.c, q.l))})), r = rq.every(x => x.have >= x.q.n);
    if (r){ d.classList.add('ready'); if (!orderReadyBit[oi]){ orderReadyBit[oi] = true; SFX.ready(); d.classList.add('readyHop'); setTimeout(() => d.classList.remove('readyHop'), 560); } }
    else orderReadyBit[oi] = false;
    if (rq.length > 1) d.classList.add('mixed');
    d.innerHTML = `${r ? `<span class="ok">${A.icon('check')}</span><span class="deliverCue">${L.deliver}</span>` : ''}
      ${portraitHtml(oi)}
      ${rq.length > 1 ? `<div class="need mixedNeed">${rq.map(x => `<div class="nd${x.have >= x.q.n ? ' got' : ''}"><div class="art">${A.item(x.q.c, x.q.l)}</div><div class="cnt">${x.have}/${x.q.n}</div></div>`).join('')}</div>`
        : `<div class="need"><div class="art">${A.item(o.c, o.l)}</div><div class="cnt">${rq[0].have}/${rq[0].q.n}</div></div>`}
      <div class="rw"><span><i>${A.icon('coin')}</i>${o.coins}</span><span><i>${A.icon('star')}</i>${o.stars}</span></div>`;
    d.onclick = () => r ? deliver(oi) : openOrder(oi);
    box.appendChild(d);
  });
}
function wanted(){
  const s = new Set();
  S.orders.forEach(o => { if (!o) return; needs(o).forEach(r => { let n = r.n; S.board.forEach((it,i) => { if (n && it && it.c===r.c && it.l===r.l){ s.add(i); n--; } }); }); });
  return s;
}
function refreshAtelierBadge(){            // the tile's ready dot follows the board (display only)
  const b = $('sAtl'); if (!b || !ATL.hasChapter(S)) return;
  const on = !!(S.atl.cur && ATL.requirements(S).ready), d = b.querySelector('.dot');
  if (on && !d) b.insertAdjacentHTML('beforeend', '<span class="dot">!</span>'); else if (!on && d) d.remove();
}
function renderBoard(fx={}){
  const bd = $('board'), want = wanted();
  if (bd.children.length !== N){
    bd.innerHTML = '';
    for (let i=0;i<N;i++){ const c = document.createElement('div'); c.dataset.i = i; c.className = 'cell' + ((i%COLS + Math.floor(i/COLS))%2 ? ' alt' : ''); bd.appendChild(c); }
  }
  [...bd.children].forEach((c, i) => {
    const it = S.board[i];
    c.classList.toggle('want', want.has(i));
    c.classList.toggle('sel', selected === i);
    const key = it ? (it.g ? 'g'+it.g+it.l : it.c+it.l) : '';
    if (c.dataset.k !== key || fx.pop===i || (fx.fly && fx.fly.to===i)){
      c.dataset.k = key;
      c.innerHTML = it ? `<div class="it${it.g?' gen':''}">${itemArt(it)}${it.g ? `<span class="bolt">${A.icon('bolt')}</span>` : ''}</div>` : '';
    }
    const el = c.firstElementChild; if (!el) return;
    el.classList.toggle('drag', !!(drag && drag.moved && drag.i === i));
    if (fx.pop === i){ el.classList.add('pop'); c.insertAdjacentHTML('beforeend', '<div class="burst"></div>'); setTimeout(()=>c.querySelector('.burst')?.remove(), 500); }
    if (fx.fly && fx.fly.from === i){
      el.classList.remove('genSquash'); void el.offsetWidth; el.classList.add('genSquash');
      setTimeout(() => el.classList.remove('genSquash'), 240);
    }
    if (fx.fly && fx.fly.to === i){
      const a = bd.children[fx.fly.from].getBoundingClientRect(), b = c.getBoundingClientRect();
      const dx = a.left-b.left, dy = a.top-b.top;
      el.style.setProperty('--fx', dx+'px'); el.style.setProperty('--fy', dy+'px');
      el.style.setProperty('--mx', (dx*0.5)+'px'); el.style.setProperty('--my', (dy*0.5-16)+'px');
      el.classList.add('fly');
      setTimeout(() => el.classList.remove('fly'), 450);   // drop pointer-events:none after the landing squash
    }
  });
  refreshAtelierBadge();
}
function renderInfo(){
  renderInfoInner(); if (page === 'board') layout();   // the panel's content may need more or less height: recompute
}
function renderInfoInner(){
  const it = selected != null ? S.board[selected] : null, box = $('info');
  if (!it && S.queue && S.queue.length){             // persistent delivery tray (only when a producer is waiting): same panel, board size unchanged
    const q = S.queue[0], free = emptyCell() >= 0;
    box.classList.remove('invMode');
    box.innerHTML = `<div class="art">${A.gen(q.g, q.l)}</div><div class="txt"><div class="ttl">${L.trayWaiting(S.queue.length)}</div><div class="hint">${L.gens[q.g]} · ${L.level(q.l)}${free ? '' : ' · ' + L.trayBoardFull}</div></div>
      <button class="btn pink" id="bTray" ${free ? '' : 'disabled'}>${L.trayPlace}</button>`;
    $('bTray').onclick = () => { const r = placeQueued(q.id); if (r.ok){ SFX.tap(); renderBoard(); renderInfo(); toast(L.trayPlaced); } else { SFX.no(); toast(L.trayBoardFull); } };
    return;
  }
  if (!it){
    if (showIdleHint()){
      box.classList.remove('invMode');
      box.innerHTML = `<div class="art">${A.icon('gift')}</div><div class="txt"><div class="hint">${L.idleHint}</div></div>`;
      return;
    }
    box.classList.add('invMode');
    box.innerHTML = invPanelHtml();
    bindInv();
    return;
  }
  box.classList.remove('invMode');
  box.innerHTML = infoItemHtml(it);
  if ($('bStore')) $('bStore').onclick = storeSelected;
  if (!it.g && $('bSell')) $('bSell').onclick = sell;
}
function infoItemHtml(it){                  // markup of the selected-item panel (also used, off-screen, to measure the tallest possible content)
  const max = it.g ? GEN_MAXLV : MAXLV;
  const next = it.l < max ? (it.g ? {g:it.g, l:it.l+1} : {c:it.c, l:it.l+1}) : null;
  let hint;
  if (it.g) hint = `${L.genHint}. ${next ? L.genMerge : L.genMax}`;
  else hint = next ? `${L.mergeInto} <i>${itemArt(next)}</i> ${itemName(next)}` : L.maxLevel;
  const store = `<button type="button" class="invStoreBtn" id="bStore"${invFree() < 1 ? ' disabled' : ''} aria-label="${L.invStore}">${INV_MARK}</button>`;
  const sellBtn = it.g ? '' : `<button class="btn pink" id="bSell">${L.sell} <span class="rw"><i>${A.icon('coin')}</i>${it.l*2}</span></button>`;
  return `${store}<div class="art">${itemArt(it)}</div><div class="txt"><div class="ttl">${itemName(it)} · ${L.level(it.l)}</div><div class="hint">${hint}</div></div>
    ${sellBtn}`;
}
/* Height the panel needs for the LONGEST content in the current language and width (every item rank, every producer, the delivery-tray row), measured off-screen once per width/language.
   The panel always reserves this height, so selecting a long-named item never resizes the panel or the board (geometry stays stable) and nothing is ever cut off. */
const INFO_NEED = {};
function infoNeed(){
  const inf = $('info'), wpx = inf.getBoundingClientRect().width, key = Math.round(wpx) + '|' + (document.fonts && document.fonts.status); if (key in INFO_NEED) return INFO_NEED[key]; if (!wpx) return 0;
  const probe = document.createElement('div'); probe.className = 'info'; probe.setAttribute('aria-hidden', 'true'); probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;min-height:0;height:auto;box-sizing:border-box;width:' + wpx + 'px';
  document.body.appendChild(probe); let h = 0; const L0 = L;                       // the maximum over BOTH languages, so the board size never depends on the chosen language
  const m = html => { probe.innerHTML = html.replace(/<img[^>]*>/g, '');   /* sprites are fixed-size boxes: never load art just to measure */ h = Math.max(h, probe.getBoundingClientRect().height); };
  try { Object.keys(LANGS).forEach(lg => { L = LANGS[lg];
    ALL_CHAINS.forEach(c => { for (let l = 1; l <= MAXLV; l++) m(infoItemHtml({c, l})); }); GEN_TYPES_ALL.forEach(g => { for (let l = 1; l <= GEN_MAXLV; l++){ m(infoItemHtml({g, l})); m(`<div class="art">${A.gen(g, l)}</div><div class="txt"><div class="ttl">${L.trayWaiting(12)}</div><div class="hint">${L.gens[g]} · ${L.level(l)} · ${L.trayBoardFull}</div></div><button class="btn pink">${L.trayPlace}</button>`); } });
    m(`<div class="art">${A.icon('gift')}</div><div class="txt"><div class="hint">${L.idleHint}</div></div>`); }); } finally { L = L0; }
  probe.remove(); return INFO_NEED[key] = Math.ceil(h);
}
/* ONE eligibility rule for badges and claim buttons: a task is claimable when its goal is met and it is not claimed; an event goal / bonus likewise (EV.claimable). */
const taskIsClaimable = (g, t) => taskDone(g, t) && !isClaimed(g, t);
function taskCounts(){
  const c = {daily: 0, weekly: 0, month: 0, ach: 0, events: 0};
  for (const g of ['daily', 'weekly', 'month', 'ach']) tasksFor(g).forEach(t => { if (taskIsClaimable(g, t)) c[g]++; });
  if (EV){ try { c.events = EV.claimable(); } catch(e){} }
  c.total = c.daily + c.weekly + c.month + c.ach + c.events; return c;
}
function tasksClaimable(){ return taskCounts().total; }
const TAB_ORDER = ['daily', 'weekly', 'month', 'ach', 'events'];
let lastTaskKey = '';
function renderNav(){
  const tabs = [['tasks','tasks',openTasks],['board','gift',()=>go('board')],['salon','salon',()=>go('salon')],['album','book',openAlbum],['shop','shop',openShop]];
  const tc = taskCounts(), nTask = tc.total, nAlb = albumClaimable(); lastTaskKey = TAB_ORDER.map(k => tc[k]).join();
  $('nav').innerHTML = tabs.map(([k,ic]) => `<button data-k="${k}" class="${page===k?'on':''}"><span class="ic">${A.icon(ic)}</span>${L[k]}${
    k==='tasks' && nTask ? `<span class="dot">${nTask}</span>` : k==='album' && nAlb ? `<span class="dot">${nAlb}</span>` : ''}</button>`).join('');
  [...$('nav').children].forEach((b, i) => b.onclick = () => { SFX.tap(); if (tabs[i][0] === 'tasks') openTasks({auto: true}); else tabs[i][2](); });
}
function go(p){
  const entering = p === 'salon' && page !== 'salon';
  if (page === 'salon' && p !== 'salon') endSalonFx();
  if (page === 'board' && p !== 'board') endCustomerFx();       // leaving the room: drop any one-shot visuals
  page = p;
  $('pageBoard').style.display = p==='board' ? 'contents' : 'none';
  $('pageSalon').style.display = p==='salon' ? 'flex' : 'none';
  if (p==='salon') renderSalon(null, entering); else layout();
  renderNav();
}

/* ---------------- سالون ---------------- */
/* one-shot visual effects of the Salon (entry fade, arrival of a just-bought prop). They never touch game state and never
   replay: a rerender, reload, import or revisit shows the final owned state. All are cleaned on room change / page hide. */
let salonFxTimer = 0;
function endSalonFx(){
  clearTimeout(salonFxTimer); salonFxTimer = 0;
  const r = $('room'); if (!r) return;
  r.classList.remove('enter'); r.querySelectorAll('.arrive').forEach(el => el.classList.remove('arrive'));
}
/* ---- salon rooms (salon-data.js is the canonical registry; gate state is derived on every render, never stored) ---- */
let salonArea = 'studio', salonPicked = false, salonStagePick = {}; const SALON_PREF = PREVIEW ? 'atelierLueur.preview.salonArea' : 'atelierLueur.salonArea', ROOM_PRELOADED = {};
try { salonArea = localStorage.getItem(SALON_PREF) || 'studio'; } catch(e){}
const salonInp = () => ({lv: S.lv, owned: S.owned, core: coreSeen(), skn: SALON.sknDiscovered(S.seen), vo: S.vo, ve: S.ve, com: SALON.commissionsDone(S.atl), chap: SALON.chapterDiscovered(S.seen)});   // com = lifetime completed Atelier commissions (S.atl.d), chap = Brush/Bag ranks DISCOVERED (never the album claim)
function salonView(){
  const ev = SALON.evaluate(salonInp()), byId = {}; ev.forEach(a => byId[a.id] = a);
  const shown = ev.filter(a => a.active);                                         // the selector lists every implemented area in registry order, locked ones included (read-only preview)
  // a REMEMBERED room that is not accessible (e.g. after a rollback) falls back to the Studio; a locked room the player explicitly picked in this session stays as a preview (owned props are never touched)
  const area = shown.some(a => a.id === salonArea && (a.id === 'studio' || a.accessible || salonPicked)) ? salonArea : 'studio';
  return {ev, byId, shown, area};
}
function reasonText(r){
  return r.k === 'level' ? L.reqLevel(r.need) : r.k === 'studio' ? L.reqStudio(r.have, r.need) : r.k === 'stage' ? L.reqStage(r.stage || r.need)
    : r.k === 'stageMin' ? L.reqStageMin(r.stage, r.have, r.need) : r.k === 'skn' ? L.reqSkn(r.have, r.need) : r.k === 'commissions' ? L.reqCommissions(r.have, r.need) : r.k === 'chapters' ? L.reqChapters(r.have, r.need) : L.reqDiscover(r.have, r.need);
}
const equippedMap = () => { const m = {}; SALON.allProps().forEach(p => { if (p.variants && S.owned[p.id]) m[p.id] = SALON.equippedColour(p.id, S.owned, S.vo, S.ve); }); return m; };   // {slot: equipped colour} for owned colour slots
function preloadSpa(){                                             // the Spa view only: empty room + every prop in the colours currently equipped (default rose for slots not owned yet)
  const key = JSON.stringify(equippedMap()); if (ROOM_PRELOADED.spa === key) return; ROOM_PRELOADED.spa = key;
  ART.spaAssetList(equippedMap()).forEach(a => { if (!a) return; const im = new Image(); if (a.srcset) im.srcset = a.srcset; im.src = a.src; PRELOADED.push(im); if (im.decode) im.decode().catch(() => {}); });
}
function preloadRoom(area){                                        // only when that room is about to be shown (not at startup)
  if (ROOM_PRELOADED[area]) return; ROOM_PRELOADED[area] = 1;
  ART.roomAssetIds(area).forEach(id => { const a = ART.salonSrc(id), im = new Image(); if (a.srcset) im.srcset = a.srcset; im.src = a.src; PRELOADED.push(im); if (im.decode) im.decode().catch(() => {}); });
}
const swatchDots = (slot, cols) => `<span class="cdots" aria-hidden="true">${SALON.paletteOf(slot).filter(c => cols.indexOf(c) >= 0).map(c => `<i class="cdot c-${c}"></i>`).join('')}</span>`;
function propCard(d, st){        // d = registry prop, st = evaluated prop state ('owned' | 'open' | 'locked')
  const opt = st.required === false ? `<div class="optTag">${L.optionalTag}</div>` : '';
  const colour = st.variants ? (st.equipped || SALON.defaultColourOf(d.id)) : undefined;
  if (st.state === 'owned' && st.variants) return `<div class="deco have var" data-var="${d.id}" role="button" tabindex="0" aria-label="${L.decos[d.id]} · ${L.colourNames[colour]}"><div class="art">${A.deco(d.id, colour)}</div><div class="nm">${L.decos[d.id]}</div>${opt}<div class="price" style="background:none;box-shadow:none;color:var(--green)">✓ ${L.colourNames[colour]}</div>${swatchDots(d.id, st.colours)}</div>`;
  if (st.state === 'owned') return `<div class="deco have"><div class="art">${A.deco(d.id)}</div><div class="nm">${L.decos[d.id]}</div>${opt}<div class="price" style="background:none;box-shadow:none;color:var(--green)">✓ ${L.owned}</div></div>`;
  if (st.state === 'locked') return `<div class="deco lock" data-lock="${d.id}"><div class="art">${A.deco(d.id, colour)}</div><div class="nm">${L.decos[d.id]}</div>${opt}<div class="lockTxt"><i>${A.icon('lock')}</i><span>${reasonText(st.reasons[0])}</span></div></div>`;
  const btn = st.variants ? `<button class="price ${S.coins<d.price?'no':''}" data-var="${d.id}"><i>${A.icon('coin')}</i>${d.price}</button>` : `<button class="price ${S.coins<d.price?'no':''}" data-id="${d.id}"><i>${A.icon('coin')}</i>${d.price}</button>`;
  return `<div class="deco"><div class="art">${A.deco(d.id, colour)}</div><div class="nm">${L.decos[d.id]}</div>${opt}${btn}</div>`;
}
/* ---- colour preview / choice sheet (Spa colour slots). The previewed colour lives ONLY in this closure: Cancel, closing, switching rooms or reloading never saves it. ---- */
const previewedColours = {};
function openColourSheet(slot, startColour){
  const p = SALON.findProp(slot); if (!p || !p.variants) return;
  const pal = SALON.paletteOf(slot);
  pal.forEach(c => { if (previewedColours[slot + c]) return; previewedColours[slot + c] = 1; const a = ART.spaSrc(slot, c), im = new Image(); if (a.srcset) im.srcset = a.srcset; im.src = a.src; PRELOADED.push(im); });   // the three colours of this one slot, on demand
  const own0 = !!S.owned[slot]; let pv = own0 ? SALON.equippedColour(slot, S.owned, S.vo, S.ve) : (pal.indexOf(startColour) >= 0 ? startColour : pal[0]);
  const draw = () => {
    const owns = !!S.owned[slot], cols = SALON.ownedColours(slot, S.owned, S.vo), eq = SALON.equippedColour(slot, S.owned, S.vo, S.ve);
    const price = c => owns ? SALON.colourPrice(slot) : p.price, colourState = c => cols.indexOf(c) >= 0 ? (c === eq ? 'equipped' : 'owned') : 'buy';
    const pvOwned = cols.indexOf(pv) >= 0, can = SALON.canBuy(salonInp(), slot), locked = !owns && !can.ok;
    const room = A.room(Object.assign({}, S.owned, {[slot]: 1}), SALON.areaById(p.area).draw.map(id => ({id})), null, p.area, Object.assign(equippedMap(), {[slot]: pv}));
    let action;
    if (locked) action = `<button class="btn" disabled>${L.stLocked}</button>`;
    else if (pvOwned && pv === eq) action = `<button class="btn" disabled id="cAct">${L.btnEquippedNow}</button>`;
    else if (pvOwned) action = `<button class="btn pink" id="cAct" data-act="apply">${L.btnApply}</button>`;
    else action = `<button class="btn pink ${S.coins < price(pv) ? 'no' : ''}" id="cAct" data-act="${owns ? 'buyColour' : 'buy'}">${owns ? L.btnBuyColour(price(pv)) : L.btnBuy(price(pv))}</button>`;
    modal(L.decos[slot], `<div class="room sheetRoom">${room}</div><div class="pvTag">${L.previewHint}</div>
      <div class="swatches" role="radiogroup" aria-label="${L.colourPickTitle}">${pal.map(c => { const st = colourState(c); return `<button class="sw ${c === pv ? 'on' : ''} s-${st}" role="radio" aria-checked="${c === pv}" data-col="${c}"><i class="cdot c-${c}"></i><span class="swn">${L.colourNames[c]}</span><em>${st === 'equipped' ? L.stEquipped : st === 'owned' ? L.stOwned : price(c) + ' ' + A.icon('coin')}</em></button>`; }).join('')}</div>
      <div class="sheetNote">${owns ? L.hintOwned + ' ' + L.hintExtra(SALON.colourPrice(slot)) : L.hintFirst}</div>
      <div class="btnrow sheetActions">${action}<button class="btn quiet" id="cCancel">${L.cancel}</button></div>`);
    $('modal').querySelectorAll('[data-col]').forEach(el => el.onclick = () => { pv = el.dataset.col; draw(); });
    $('cCancel').onclick = closeModal;                                                           // preview discarded: nothing was written
    const act = $('cAct'); if (act && act.dataset.act) act.onclick = () => {
      const what = act.dataset.act; let r;
      if (what === 'apply'){ r = equipColour(slot, pv); if (r.ok){ toast(L.toastColourApplied); SFX.tap(); closeModal(); renderSalon(); } }
      else if (what === 'buy'){ r = buyDeco(slot, pv); if (r.ok) closeModal(); return; }
      else { r = buyColour(slot, pv); if (r.ok){ SFX.shop(); toast(L.toastColourAdded); renderTop(); closeModal(); renderSalon(slot); renderNav(); } else if (r.reason === 'coins'){ toast(L.noCoins); SFX.no(); } }
      if (r && !r.ok && r.reason !== 'coins'){ toast(L.errWrite); SFX.no(); draw(); }
    };
  };
  draw();
}
/* ---- Salon selector: every implemented area in registry order (Studio, Reception, Spa), locked ones included. Cards derive from the canonical registry
   (SALON.evaluate / unlockRequirements). Browsing is read-only: nothing is charged, granted, owned, counted or unlocked; closing changes nothing. ---- */
const areaThumbId = id => id === 'studio' ? 'base' : id + '-base';
const COMING_AREAS = ['nail', 'perfume'];                                  // placeholders in the picker only; not in the salon registry yet
function areaProgressHtml(x){
  if (x.optionalTotal > 0) return `<span>${L.requiredProg(x.requiredOwned, x.requiredTotal)}</span> <span class="optp">${L.optionalProg(x.optionalOwned, x.optionalTotal)}</span>`;   // extra colours never count
  return `<span>${L.areaFurnished(x.ownedCount, x.total)}</span>`;
}
function areaPickerThumb(x, def, open){
  if (!open){                                                              // locked real room: empty base + the usual veil and lock
    return `${A.salonImg(areaThumbId(x.id), 'selImg')}<div class="selVeil"></div><div class="selLock">${A.icon('lock')}</div>`;
  }
  return A.room(S.owned, def.draw.map(id => ({id})), null, x.id, x.id === 'spa' ? equippedMap() : undefined);  // current furniture, or the finished room when everything is owned
}
function openSalonSelector(){
  const v = salonView();
  const cards = v.shown.map(x => {
    const open = x.accessible || x.id === 'studio', def = SALON.areaById(x.id), cur = x.id === v.area;
    const name = L.areaNames[x.id] || x.id;
    return `<button type="button" class="selCard ${open ? 'open' : 'lock'}${cur ? ' cur' : ''}" data-area="${x.id}" aria-label="${name} · ${open ? (x.ownedCount + '/' + x.total) : L.areaLockedTag}"${cur ? ' aria-current="true"' : ''}>
      <div class="selThumb" dir="ltr">${areaPickerThumb(x, def, open)}</div>
      <div class="selMeta"><div class="selName">${name}</div>${open ? `<div class="selProg">${x.ownedCount}/${x.total}</div>` : `<div class="selSoon">${L.areaLockedTag}</div>`}</div></button>`;
  }).join('') + COMING_AREAS.map(id => {
    const name = L.areaNames[id] || id;
    return `<button type="button" class="selCard lock soon" data-soon="${id}" aria-label="${name} · ${L.soon}">
      <div class="selThumb" dir="ltr">${A.salonImg('base', 'selImg')}<div class="selVeil"></div><div class="selLock">${A.icon('lock')}</div></div>
      <div class="selMeta"><div class="selName">${name}</div><div class="selSoon">${L.soon}</div></div></button>`;
  }).join('');
  modal(L.salonsTitle, `<div class="selList" id="salonList">${cards}</div>`);
  $('modal').querySelectorAll('.selImg').forEach(im => { const ok = () => im.classList.add('ok'); if (im.complete && im.naturalWidth) ok(); else { im.addEventListener('load', ok); im.addEventListener('error', () => im.classList.add('bad')); } });
  $('salonList').onclick = ev => {
    const c = ev.target.closest('.selCard'); if (!c || !c.closest('#salonList')) return;
    if (c.dataset.soon){ toast(L.soon); return; }                          // placeholder: do not leave the picker
    const id = c.dataset.area, x = salonView().byId[id], open = x.accessible || id === 'studio';
    salonArea = id; salonPicked = !open;                                   // a locked pick is a session-only read-only preview
    if (open){ try { localStorage.setItem(SALON_PREF, id); } catch(e){} }
    closeModal(); renderSalon();
  };
}
function renderSalon(justBought, entering){
  endSalonFx();
  const v = salonView(), a = v.byId[v.area], def = SALON.areaById(v.area), accessible = a.accessible || v.area === 'studio';
  $('pageSalon').classList.add('multi');   // same 4:3 room framing for every area, so switching rooms does not jump the picture vertically
  $('salonTabs').innerHTML = `<button class="salonSelBtn" id="salonSel" data-area="${v.area}" aria-haspopup="dialog"><span class="sbIc">${accessible ? '' : `<i>${A.icon('lock')}</i>`}</span><span class="sbName">${L.areaNames[v.area]}</span><span class="sbTag">${L.salonsBtn} ▾</span></button>`;   // ONE room-selection control (replaces the old tab strip)
  $('salonSel').onclick = openSalonSelector;
  if (a.accessible && v.area === 'reception') preloadRoom('reception'); else if (v.byId.reception && v.byId.reception.accessible && v.area === 'studio') preloadRoom('reception');
  if (!accessible){                                                // locked room: read-only PREVIEW (never owned furniture, no purchase, no state change)
    $('decoList').className = 'decoList multi';
    const art = def.preview;                                       // only rooms with implemented approved art are previewed
    $('room').innerHTML = art
      ? `<div class="roomScene lockedPreview" data-area="${v.area}">${A.salonImg(art, 'roomBase')}<div class="veil"></div><div class="lockOverlay"><div class="lockArt">${A.icon('lock')}</div><div class="lockTag">${L.previewLabel}</div><div class="lockTitle">${L.lockedArea}</div></div></div>`
      : `<div class="roomLock"><div class="lockArt">${A.icon('lock')}</div><div class="lockTitle">${L.lockedArea}</div></div>`;
    $('decoProg').textContent = '0/' + a.total;
    const reqs = SALON.unlockRequirements(def, salonInp());
    $('decoList').innerHTML = `<div class="reqBox"><div class="reqHead">${L.reqTitle}</div>` + reqs.map(r => `<div class="req ${r.met ? 'met' : ''}"><i>${A.icon(r.met ? 'check' : 'lock')}</i><span>${reasonText(r)}</span><b>${r.have}/${r.need}</b></div>`).join('') + '</div>';
    return;
  }
  if (v.area === 'spa') preloadSpa(); else if (v.area === 'makeup') preloadRoom('makeup');
  $('room').innerHTML = A.room(S.owned, def.draw.map(id => ({id})), justBought || null, v.area, v.area === 'spa' ? equippedMap() : undefined);
  if (entering || justBought){
    if (entering) $('room').classList.add('enter');
    salonFxTimer = setTimeout(endSalonFx, 800);
  }
  if (a.optionalTotal > 0) $('decoProg').innerHTML = `<span>${L.requiredProg(a.requiredOwned, a.requiredTotal)}</span> <span class="optp">${L.optionalProg(a.optionalOwned, a.optionalTotal)}</span>`; else $('decoProg').textContent = a.ownedCount + '/' + a.total;
  $('decoList').className = 'decoList' + (v.area === 'studio' ? '' : ' multi');
  if (v.area === 'studio'){                                        // today's row, markup unchanged
    const st = a.stages[0].props;
    $('decoList').innerHTML = DECOS.map(d => propCard(d, st.find(x => x.id === d.id))).join('');
  } else {
    let pick = salonStagePick[v.area]; if (!a.stages.some(x => x.id === pick)) pick = (a.stages.find(x => !x.complete) || a.stages[a.stages.length - 1]).id;
    const cur = a.stages.find(x => x.id === pick), curDef = def.stages.find(x => x.id === pick);
    $('decoList').innerHTML = `<div class="stageChips" role="tablist">` + a.stages.map(x => { const n = x.requiredOwned;
        return `<button role="tab" data-stage="${x.id}" class="chip ${x.id === pick ? 'on' : ''} ${x.complete ? 'done' : x.open ? '' : 'lock'}"><span>${L.stageNames[x.id]}</span><b>${x.complete ? '✓' : x.open ? L.stageN(n, x.requiredTotal) : `<i>${A.icon('lock')}</i>`}</b></button>`; }).join('') + `</div>` +
      (cur.reasons.length && !cur.complete ? `<div class="stageReq">${cur.reasons.map(r => `<span>${reasonText(r)}</span>`).join('')}</div>` : '') +
      `<div class="propRow">` + curDef.props.map(d => propCard(d, cur.props.find(x => x.id === d.id))).join('') + `</div>`;
    $('decoList').querySelectorAll('[data-stage]').forEach(bn => bn.onclick = () => { salonStagePick[v.area] = bn.dataset.stage; renderSalon(); });
  }
  $('decoList').querySelectorAll('button[data-id]').forEach(bn => bn.onclick = () => buyDeco(bn.dataset.id));
  $('decoList').querySelectorAll('[data-var]').forEach(el => { el.onclick = () => openColourSheet(el.dataset.var); el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openColourSheet(el.dataset.var); } }; });
}
/* ---- salon purchases and colour equipment: every action is ONE durable transaction (txn): a failed or silently dropped write changes nothing ---- */
const starsFor = id => { const a = SALON.areaById(SALON.findProp(id).area); return a.stars ? a.stars.firstPurchaseOfSlot : 10; };    // Studio/Reception: the existing +10 rule
function buyProp(id, colour){            // FIRST purchase of a prop / slot. Variant slots need a valid colour (the player chose it in the preview); other props take none.
  const p = SALON.findProp(id); if (!p) return {ok: false, reason: 'unknown'};
  if (S.owned[id]) return {ok: false, reason: 'owned'};                                       // duplicate interaction: never a second purchase, charge or replay
  const variant = SALON.isVariantSlot(id);
  if (variant ? SALON.paletteOf(id).indexOf(colour) < 0 : colour !== undefined) return {ok: false, reason: 'colour'};
  const g = SALON.canBuy(salonInp(), id); if (!g.ok) return {ok: false, reason: g.code === 'inactive' ? 'inactive' : 'locked'};
  if (S.coins < p.price) return {ok: false, reason: 'coins'};
  let ups = [];
  const r = txn(() => {
    S.coins -= p.price; S.owned[id] = 1;
    if (variant){ (S.vo || (S.vo = {}))[SALON.voKey(id, colour)] = 1; (S.ve || (S.ve = {}))[id] = colour; }   // chosen colour is owned and equipped
    count('deco'); ups = addStarsCore(starsFor(id));                                          // one real decoration purchase: +10 stars, counters, level-up and its rewards in the SAME write
    return {ok: true};
  });
  return r.ok ? {ok: true, ups} : r;
}
function buyColour(slot, colour){        // an EXTRA colour of an owned slot: coins only. Buying also EQUIPS it (the player previewed it in the room and chose Buy). 0 stars, 0 counters, 0 events.
  const g = SALON.canBuyColour(salonInp(), slot, colour); if (!g.ok) return {ok: false, reason: g.code};
  if (S.coins < g.price) return {ok: false, reason: 'coins'};
  return txn(() => {
    S.coins -= g.price; const vo = S.vo || (S.vo = {});
    if (!SALON.paletteOf(slot).some(c => vo[SALON.voKey(slot, c)])) vo[SALON.voKey(slot, SALON.defaultColourOf(slot))] = 1;   // a legacy slot's implicit default becomes an explicit record first
    vo[SALON.voKey(slot, colour)] = 1; (S.ve || (S.ve = {}))[slot] = colour; return {ok: true};
  });
}
function equipColour(slot, colour){      // FREE switch between owned colours: nothing is charged, granted or counted
  const g = SALON.canEquip(salonInp(), slot, colour); if (!g.ok) return {ok: false, reason: g.code};
  if (SALON.equippedColour(slot, S.owned, S.vo, S.ve) === colour && S.ve && S.ve[slot] === colour) return {ok: true, noop: true};   // already equipped: no write at all
  return txn(() => { (S.ve || (S.ve = {}))[slot] = colour; return {ok: true}; });
}
function buyDeco(id, colour){            // UI wrapper: feedback only; all state changes happened inside buyProp
  const r = buyProp(id, colour);
  if (!r.ok){
    if (r.reason === 'locked'){ toast(L.salonLocked); SFX.no(); }
    else if (r.reason === 'coins'){ toast(L.noCoins); SFX.no(); }
    else if (r.reason === 'storage' || r.reason === 'error'){ toast(L.errWrite); SFX.no(); renderTop(); renderSalon(); }
    return r;
  }
  SFX.unlock(); confetti();
  renderTop(); renderSalon(id); renderNav(); announceLevelUps(r.ups);   // payment and save are already done; the arrival is only visual
  return r;
}

/* ---------------- كۆزنەكلەر (modal) ---------------- */
let tasksOpen = false;                 // true only while the Tasks panel itself is on screen (manual tab choice is then never overridden)
function modal(title, body){
  const was = $('overlay').classList.contains('on');
  tasksOpen = false; energyOpen = false;
  $('modal').innerHTML = `<button class="x" data-close>✕</button><div class="ribbon">${title}</div><div class="mbody">${body}</div>`;
  $('overlay').classList.add('on');
  if (!was) SFX.open();
}
function closeModal(){
  const was = $('overlay').classList.contains('on');
  tasksOpen = false; taskOpenKey = ''; energyOpen = false; invExpandBusy = false;
  $('overlay').classList.remove('on');
  $('modal').classList.remove('genUp');
  if (was) SFX.close();
  if (saveGate.blocked && recovery) showRecovery();
  renderTut();
}
$('overlay').addEventListener('click', e => { if (e.target.id==='overlay' || e.target.closest('[data-close]')) closeModal(); });

function openOrder(oi){
  const o = S.orders[oi]; if (!o) return;
  const rq = needs(o).map(q => ({q, have: Math.min(q.n, haveCount(q.c, q.l))})), ok = rq.every(x => x.have >= x.q.n);
  const mixed = rq.length > 1;
  modal(L.orderTitle, (mixed ? `<div class="center muted" style="font-weight:800">${L.mixedOrder}</div>` : '') +
    rq.map(x => `<div class="${mixed ? 'ordReq' : ''}"><div class="bigart">${A.item(x.q.c, x.q.l)}</div>
    <div class="center" style="font-weight:800">${L.items[x.q.c][x.q.l-1]} (${L.level(x.q.l)})</div>
    <div class="center ltr" style="font-size:22px;font-weight:800;color:${x.have>=x.q.n?'var(--green-dark)':'var(--pink-dark)'}">${x.have}/${x.q.n}</div></div>`).join('') +
    `<div class="center" style="font-weight:800;margin-top:8px">${L.reward}</div>
    <div class="center" style="font-size:18px;margin:4px 0">${rwHtml({coins:o.coins, stars:o.stars})}</div>
    <button class="btn wide" id="mDeliver" ${ok?'':'disabled'}>${L.deliver}</button>
    ${ok ? '' : `<div class="center muted" style="margin-top:6px">${L.notReady}</div>`}`);
  $('mDeliver').onclick = () => deliver(oi);
}

/* the task list of a tab: the snapshotted mission contract when one is active for today / this week, otherwise the legacy list (existing saves keep their current day and week until the next reset) */
function tasksFor(g){
  if (g === 'daily' && MSN.active(S)) return MSN.dayTasks(S);
  if (g === 'weekly' && MSN.weekActive(S) && (S.msn.week.slots || S.msn.week.s)) return MSN.weekTasks(S);
  if (g === 'month' && MSN.monthActive(S)) return MSN.monthTasks(S);
  return TASKS[g] || [];
}
function taskProgress(g, t){
  if (g === 'ach'){
    if (t.k==='level') return S.lv;
    if (t.k==='discover') return coreSeen();
    if (t.k==='deco') return SALON.STUDIO_IDS.filter(id => S.owned[id]).length;   // the achievement means the original eight Studio props, not every owned id
  }
  if ((g === 'daily' && MSN.active(S)) || (g === 'weekly' && MSN.weekActive(S)) || (g === 'month' && MSN.monthActive(S)))
    return MSN.progress(S, g, t);
  const c = g==='daily' ? S.cnt.day : g==='month' ? (S.cnt.month || {}) : S.cnt.week;
  return c[t.k]||0;
}
const claimKey = (g, t) => g==='daily' ? t.id+S.cnt.day.k : g==='weekly' ? t.id+S.cnt.week.k : g==='month' ? t.id+(S.cnt.month && S.cnt.month.k || '') : t.id;
const isClaimed = (g, t) => !!S.claimed[claimKey(g, t)];
function taskDone(g, t){                    // ONE completion rule for badges, rows and claims (coins may be an OR of two routes)
  if ((g === 'daily' && MSN.active(S)) || (g === 'weekly' && MSN.weekActive(S)) || (g === 'month' && MSN.monthActive(S)))
    return MSN.slotDone(S, g, t);
  return taskProgress(g, t) >= t.n;
}
let taskTab = 'daily', taskOpenKey = '';      // taskOpenKey: the ONE expanded details section (tab|period key|task id|kind), kept across routine re-renders
/* Atomic claim: the claim record and the reward are applied to a COPY of the save and written together with ONE verified write.
   Crash before the write -> not claimed, not paid. Crash/failure after -> claimed AND paid. A failed write discards the copy (wallet and claim
   flag return together; the visible save-warning banner appears). No pending log is needed because there is only one document to write. */
function claimTask(g, t){            // daily / weekly / achievement claim: claimed flag + reward (+ any level-up and grants) in ONE verified write; a failed write changes nothing and can be retried
  return txn(() => {
    const key = claimKey(g, t); if (S.claimed[key]) return {ok: false, reason: 'claimed'};          // a repeated tap finds it already claimed: never paid twice
    if (!taskDone(g, t)) return {ok: false, reason: 'notready'};
    S.claimed[key] = 1; const ups = []; give(t.r, ups); return {ok: true, ups};
  });
}
function claimEvent(eid, oid){
  if (!EV || saveGate.blocked || saveGate.memoryOnly) return {ok: false, reason: 'storage'};   // never grant what cannot be persisted
  const real = S, ups = []; S = JSON.parse(JSON.stringify(real)); evSuppress = true;
  try {
    const r = EV.claim(eid, oid); if (!r.ok){ S = real; return r; }
    give(r.reward, ups);
    if (!save()){ S = real; return {ok: false, reason: 'storage'}; }
    announceLevelUps(ups); return {ok: true, reward: r.reward};
  } catch(e){ S = real; return {ok: false, reason: 'error'}; }
  finally { evSuppress = false; }
}
function evCopy(map){                 // event title/desc: current language if the catalog has it, else English, else Uyghur
  if (!map) return '';
  return map[S.set.lang] || map.en || map.ug || '';
}
function eventsHtml(){
  const now = EV.nowMs();
  return EV.view().map(ev => {
    const left = Math.ceil((ev.end - now) / 864e5);
    const when = ev.status === 'ended' ? L.eventEnded : left <= 0 ? L.eventEndsToday : L.eventEnds(left);
    const rows = ev.objectives.map(o => `<div class="row is-${o.claimed ? 'claimed' : o.done ? 'ready' : 'progress'}"><div class="art">${A.icon(({merge:'gift', order:'tasks', tap:'gift', coins:'coin', deco:'salon'})[o.type] || 'star')}</div><div class="grow">${esc(L.task[o.type](o.target))}
      <div class="bar"><i style="width:${Math.min(100, o.progress/o.target*100)}%"></i><b>${o.progress}/${o.target}</b></div></div>
      <div class="center" style="min-width:70px">${o.claimed ? `<span class="stlab claimed"><span style="width:20px;display:inline-block;vertical-align:middle">${A.icon('check')}</span> ${L.claimed}</span>` :
        `${o.done ? `<div class="stlab ready">${L.taskReady}</div>` : ''}<div style="font-size:12px">${rwHtml(o.reward)}</div><button class="btn" data-evclaim="${esc(ev.id)}|${esc(o.id)}" ${o.done?'':'disabled'}>${L.claim}</button>`}</div></div>`).join('');
    const bonus = ev.completion ? `<div class="row is-${ev.completion.claimed ? 'claimed' : ev.completion.ready ? 'ready' : 'progress'}"><div class="art">${A.icon('star')}</div><div class="grow">${L.eventBonus}</div><div class="center" style="min-width:70px">${ev.completion.claimed ? `<span class="stlab claimed"><span style="width:20px;display:inline-block;vertical-align:middle">${A.icon('check')}</span> ${L.claimed}</span>` :
      `${ev.completion.ready ? `<div class="stlab ready">${L.taskReady}</div>` : ''}<div style="font-size:12px">${rwHtml(ev.completion.reward)}</div><button class="btn" data-evclaim="${esc(ev.id)}|*" ${ev.completion.ready?'':'disabled'}>${L.claim}</button>`}</div></div>` : '';
    const ekey = 'events|' + ev.id, eopen = taskOpenKey === ekey, eid = 'td-events-' + ev.id;
    const title = `<button type="button" class="evTitle infoBtn" data-info="${esc(ekey)}" aria-expanded="${eopen}" aria-controls="${eid}"><span class="ttxt">${esc(evCopy(ev.title))}</span><i class="infoDot" aria-hidden="true">i</i></button>`;
    const det = evCopy(ev.desc) ? `<div class="tcDet" id="${eid}" role="region"${eopen ? '' : ' hidden'}><p>${esc(evCopy(ev.desc))}</p></div>` : '';
    return `<div class="evCard">${title}<div class="evWhen">${esc(when)}</div>${det}${rows}${bonus}</div>`;
  }).join('');
}
function openTasks(opts){
  const auto = !!(opts && opts.auto) && !tasksOpen;       // opening from the nav while the panel is closed: jump to a tab that has something to claim
  const icons = {merge:'gift', order:'tasks', tap:'gift', coins:'coin', deco:'salon', level:'star', discover:'book', fam:'gift', mix:'tasks', atl:'tasks', days:'star', bonus:'star'};
  const hasEv = !!(EV && EV.view().length), counts = taskCounts();
  if (taskTab === 'events' && !hasEv) taskTab = 'daily';
  if (auto && !counts[taskTab]){ const t = TAB_ORDER.find(k => counts[k] > 0 && (k !== 'events' || hasEv)); if (t) taskTab = t; }
  const prevScroll = (!auto && tasksOpen && $('modal').querySelector('.mbody')) ? $('modal').querySelector('.mbody').scrollTop : 0;
  const tabs = [['daily',L.daily],['weekly',L.weekly],['month',L.monthly],['ach',L.achieve]].concat(hasEv ? [['events', L.eventsTab]] : []);
  const pk = taskTab === 'daily' ? S.cnt.day.k : taskTab === 'weekly' ? S.cnt.week.k : taskTab === 'month' ? (S.cnt.month && S.cnt.month.k || '') : '';
  const dkey = t => taskTab + '|' + pk + '|' + t.id + '|' + t.k;             // details state is scoped by tab, period key and task: after a rollover it can never attach to a different objective
  const tasksNow = taskTab === 'events' ? [] : tasksFor(taskTab);
  if (taskOpenKey && taskOpenKey.split('|')[0] === taskTab && !tasksNow.some(t => dkey(t) === taskOpenKey)) taskOpenKey = '';     // stale (rollover / contract change): forget it
  const bdi = s => `<bdi dir="ltr">${s}</bdi>`;
  const famRowHtml = (r, need) => `<div class="taskSub famRow${r.ok ? ' ok' : ''}">${L.task.famLine(L.chains[r.c], r.have, need)}${r.ok ? ' ✓' : ''}</div>`;
  const taskDetail = t => {                                              // inline details, built from the CURRENT saved contract; '' = simple objective (no info control)
    const D = L.task.det, period = taskTab === 'month' ? 'month' : taskTab === 'weekly' ? 'week' : 'day';
    const live = (taskTab === 'daily' && MSN.active(S)) || (taskTab === 'weekly' && MSN.weekActive(S)) || (taskTab === 'month' && MSN.monthActive(S));
    if (live && t.k === 'fam') return `<p>${D.fam(t.per, period)}</p>` + MSN.famRowsFor(S, t, taskTab === 'daily' ? 'daily' : taskTab === 'month' ? 'month' : 'weekly').map(r => famRowHtml(r, t.per)).join('');
    if (live && t.a && t.k === 'coins'){ const s4 = MSN.altProgress(S, taskTab === 'daily' ? 'daily' : 'weekly', t); return `<p>${D.or(t.n)}</p><div class="taskSub">${L.task.coinsRoute(s4.coins, s4.n)}</div><div class="taskSub">${L.task.atlRoute(s4.atl, 1)}</div>`; }
    if (live && t.k === 'mix') return `<p>${D.mix}</p>`;
    if (live && t.k === 'atl') return `<p>${D.atl(t.n)}</p>`;
    if (live && t.k === 'coins') return `<p>${D.coins(t.n, period)}</p>`;
    if (t.k === 'days') return `<p>${period === 'month' ? D.daysMonth(t.n) : D.days(t.n)}</p>`;
    if (t.k === 'bonus') return `<p>${D.bonus}</p>`;
    return '';
  };
  const list = taskTab === 'events' ? eventsHtml() : tasksNow.map(t => {
    const done = taskDone(taskTab, t), p = done ? t.n : Math.min(t.n, taskProgress(taskTab, t)), cl = isClaimed(taskTab, t), state = cl ? 'claimed' : done ? 'ready' : 'progress';
    const liveFam = t.k === 'fam' && ((taskTab === 'daily' && MSN.active(S)) || (taskTab === 'weekly' && MSN.weekActive(S)) || (taskTab === 'month' && MSN.monthActive(S)));
    let sub = '';
    if (liveFam){                                    // compact summary: the two leading families (full list in the details)
      const grp = taskTab === 'daily' ? 'daily' : taskTab === 'month' ? 'month' : 'weekly';
      const rows = MSN.famRowsFor(S, t, grp).map((r, i) => ({r, i})).sort((x, y) => y.r.have - x.r.have || x.i - y.i).slice(0, 2).map(x => x.r);
      sub = `<div class="taskSub famSum">` + rows.map(r => `<span class="famChip${r.ok ? ' ok' : ''}">${L.task.famLine(L.chains[r.c], r.have, t.per)}${r.ok ? ' ✓' : ''}</span>`).join(' · ') + `</div>`;
    }
    if (t.a && t.k === 'coins'){ const s4 = MSN.altProgress(S, taskTab === 'daily' ? 'daily' : 'weekly', t); sub = `<div class="taskSub orSub"><span>${L.task.coinsRoute(s4.coins, s4.n)}</span> <span class="orWord">${L.task.orWord}</span> <span>${L.task.atlRoute(s4.atl, 1)}</span></div>`; }
    const text = t.a && t.k === 'coins' ? L.task.coinsAlt(t.n) : t.k === 'fam' ? L.task.fam(t.per) : (t.k === 'days' && taskTab === 'month' ? L.task.daysMonth(t.n) : L.task[t.k](t.n));
    const det = taskDetail(t), key = dkey(t), open = !!det && taskOpenKey === key, did = 'td-' + taskTab + '-' + t.id;
    const title = det ? `<button type="button" class="taskTitle infoBtn" data-info="${esc(key)}" aria-expanded="${open}" aria-controls="${did}"><span class="ttxt">${text}</span><i class="infoDot" aria-hidden="true">i</i></button>` : `<div class="taskTitle">${text}</div>`;
    const rew = `<div class="tcRew">${state === 'claimed' ? `<span class="stlab claimed"><span class="ck">${A.icon('check')}</span> ${L.claimed}</span>` : state === 'ready' ? `<div class="stlab ready">${L.taskReady}</div>` : ''}<div class="tcChips">${rwHtml(t.r)}</div></div>`;
    const btn = state === 'claimed' ? '' : `<button class="btn" data-claim="${t.id}" ${done ? '' : 'disabled'}>${L.claim}</button>`;
    return `<div class="row taskCard is-${state}" data-state="${state}"><div class="tcHead"><div class="art">${A.icon(icons[t.k])}</div>${title}</div>${sub}
      <div class="tcFoot"><div class="bar"><i style="width:${p/t.n*100}%"></i><b>${p}/${t.n}</b></div><div class="tcAct">${rew}${btn}</div></div>
      ${det ? `<div class="tcDet" id="${did}" role="region"${open ? '' : ' hidden'}>${det}</div>` : ''}</div>`;
  }).join('');
  modal(L.tasksTitle, `<div class="tabs${tabs.length>=4?' many':''}">${tabs.map(([k,n]) => `<button data-tab="${k}" class="${taskTab===k?'on':''}"><span class="tabLab">${n}</span>${counts[k] ? `<span class="tabdot" aria-label="${counts[k]}">${counts[k]}</span>` : ''}</button>`).join('')}</div>${list}`);
  tasksOpen = true;
  const mb = $('modal').querySelector('.mbody');
  if (auto){ const first = $('modal').querySelector('.row.is-ready'); if (first) first.scrollIntoView({block: 'nearest'}); } else if (prevScroll && mb) mb.scrollTop = prevScroll;
  $('modal').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { taskTab = b.dataset.tab; openTasks(); });
  $('modal').querySelectorAll('[data-info]').forEach(btn => btn.onclick = () => {      // toggles one inline details section in place: no re-render, no claim, scroll untouched unless the new content is out of view
    const open = btn.getAttribute('aria-expanded') !== 'true';
    $('modal').querySelectorAll('[data-info]').forEach(x => { x.setAttribute('aria-expanded', 'false'); const d = document.getElementById(x.getAttribute('aria-controls')); if (d) d.hidden = true; });
    taskOpenKey = open ? btn.dataset.info : '';
    if (open){ const d = document.getElementById(btn.getAttribute('aria-controls')); btn.setAttribute('aria-expanded', 'true'); d.hidden = false; d.scrollIntoView({block: 'nearest'}); }
  });
  $('modal').querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
    const t = tasksFor(taskTab).find(x => x.id===b.dataset.claim); if (!t) return;
    const r = claimTask(taskTab, t);
    if (!r.ok){ if (r.reason === 'storage' || r.reason === 'error'){ toast(L.errWrite); SFX.no(); } openTasks(); return; }
    sfxReward(t.r); announceLevelUps(r.ups); renderTop(); renderNav(); openTasks();
  });
  $('modal').querySelectorAll('[data-evclaim]').forEach(b => b.onclick = () => {
    const [eid, oid] = b.dataset.evclaim.split('|'); const r = claimEvent(eid, oid);
    if (!r.ok){ toast(L.eventClaimFail); SFX.no(); openTasks(); return; }
    sfxReward(r.reward); renderTop(); renderNav(); openTasks();
  });
}
let lastReadyTotal = null;
function checkTaskBadges(){      // daily/weekly rollover, event expiry, content refresh: recompute from the same rule and refresh what is on screen
  const c = taskCounts(), key = TAB_ORDER.map(k => c[k]).join();
  const n = TAB_ORDER.reduce((a, k) => a + (c[k] || 0), 0);
  if (lastReadyTotal == null) lastReadyTotal = n;
  else if (n > lastReadyTotal) SFX.quest();
  lastReadyTotal = n;
  if (key === lastTaskKey) return;
  renderNav(); if (tasksOpen) openTasks();            // same tab, same scroll position
}

/* ---- Level road: browsing only (no state change, no claims, no unlocks). Rows are rendered 20 at a time; milestone labels are DERIVED from the canonical rules
   (PROGRESSION.SUPPLY, SALON registry + unlockRequirements, ATELIER, the active order profile), never from copied level numbers. ---- */
const ROAD_STEP = 20, ROAD_MAX = 10000;                                  // 10000 = the save validator's own level bound (SAVE accepts lv 1..10000); no design maximum is implied
function roadMilestones(lv){
  const out = [], also = rows => rows.filter(r => r && !r.met);
  for (const m of SUPPLY().milestones) if (m.level === lv) out.push({t: m.key === 'skn-15' ? L.roadSkincare : L.roadCopy(L.gens[m.g])});            // guaranteed producer copies (skn-15 = the Skincare unlock)
  for (const a of SALON.AREAS) if (a.active && a.unlock && a.unlock.level === lv){
    const reqs = SALON.unlockRequirements(a, salonInp()).filter(r => r.k !== 'level');
    out.push({t: L.roadSalon(L.areaNames[a.id]), also: also(reqs).map(r => reasonText(r) + (r.k === 'stage' ? ' ' + r.have + '/' + r.need : ''))});     // studio/skincare texts already carry their own n/m
  }
  if (lv === ATL.UNLOCK_LEVEL){                                           // level alone does NOT unlock the Atelier: the discovery prerequisites still apply (shown with current progress)
    const miss = ATL.unlockStatus(S).missing.filter(x => x.k === 'seen').map(x => L.atl.reqRanks((L.atl.families || L.chains)[x.c] || L.chains[x.c], x.have, x.need));
    out.push({t: L.roadAtelier, also: miss});
  }
  for (const gdef of ATL.GUARANTEED) if (gdef.level === lv && lv !== ATL.UNLOCK_LEVEL) out.push({t: L.roadChest(L.gens[ATL.PRODUCER])});
  const prof = window.PROGRESSION.PROFILES[C.progressionProfile]; if (prof && prof.mixed && prof.mixed.fromLevel === lv) out.push({t: L.roadMixed});
  return out;
}
function roadRowHtml(lv){
  const got = lv <= S.lv, cur = lv === S.lv + 1;
  const ms = roadMilestones(lv).map(m => `<div class="roadMs"><b>${m.t}</b>${m.also && m.also.length ? `<div class="roadAlso">${L.roadAlso} ${m.also.join(' · ')}</div>` : ''}</div>`).join('');
  return `<div class="roadRow ${got?'got':''} ${cur?'cur':''}" data-lv="${lv}"><div class="lv"><b>${lv}</b></div><div class="card">${rwHtml(roadReward(lv))}
      ${C.giftMode && lv===C.secretLevel ? `<span style="width:28px;height:28px;display:inline-block">${A.icon('letter')}</span>` : ''}
      <span class="tick">${got ? A.icon('check') : A.icon('lock')}</span>${ms}</div></div>`;
}
function openRoad(){
  const from = Math.max(2, S.lv - 2); let to = Math.min(ROAD_MAX, S.lv + ROAD_STEP);
  const rows = (a, z) => { let h = ''; for (let lv = a; lv <= z; lv++) h += roadRowHtml(lv); return h; };
  modal(L.road, `<div class="row"><div class="art">${A.icon('star')}</div><div class="grow">${L.level(S.lv)}
    <div class="bar"><i style="width:${S.stars/starsNeed(S.lv)*100}%"></i><b>${S.stars}/${starsNeed(S.lv)}</b></div></div></div>
    <div id="roadRows">${rows(from, to)}</div><button class="btn wide" id="roadMore" ${to >= ROAD_MAX ? 'hidden' : ''}>${L.roadMore}</button>`);
  $('roadMore').onclick = () => {                                         // append the next 20 levels below the existing rows: the scroll position is untouched
    const next = Math.min(ROAD_MAX, to + ROAD_STEP); $('roadRows').insertAdjacentHTML('beforeend', rows(to + 1, next)); to = next;
    if (to >= ROAD_MAX) $('roadMore').hidden = true;
  };
}

const coreSeen = () => SALON.coreDiscovered(S.seen);     // distinct valid ids of the original four families only (max 24)
const skinUnlocked = () => !!(S.pg && S.pg['skn-15']);
const albumChains = () => (skinUnlocked() ? CHAINS : CORE_CHAINS).concat(ATL.chapters(S));   // the Skincare chapter appears with the family; Atelier chapters once unlocked (core 'all' totals unchanged)
function albumClaimable(){
  let n = 0;
  albumChains().forEach(c => { if (!S.album[c] && [1,2,3,4,5,6].every(l => S.seen[c+l])) n++; });
  if (!S.album.all && coreSeen() >= 24) n++;
  return n;
}
function openAlbum(){
  const total = coreSeen();
  let h = `<div class="row"><div class="art">${A.icon('book')}</div><div class="grow">${L.allDone}: ${rwHtml({coins:500, energy:50})}
    <div class="bar"><i style="width:${total/24*100}%"></i><b>${total}/24</b></div></div>
    ${!S.album.all && total>=24 ? `<button class="btn" data-set="all">${L.claim}</button>` : S.album.all ? `<span style="width:30px">${A.icon('check')}</span>` : ''}</div>`;
  albumChains().forEach(c => {
    const got = [1,2,3,4,5,6].filter(l => S.seen[c+l]).length;
    h += `<div class="set"><h4>${L.chains[c]} <span class="prog">${got}/6</span>
      ${S.album[c] ? `<span style="width:24px;margin-inline-start:auto">${A.icon('check')}</span>` : got===6 ? `<button class="btn" data-set="${c}">${L.claim} 100</button>` : ''}</h4>
      <div class="cards">${[1,2,3,4,5,6].map(l => `<div class="card6 ${S.seen[c+l]?'':'no'}">${A.item(c,l)}</div>`).join('')}</div></div>`;
  });
  modal(L.albumTitle, h);
  $('modal').querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const k = b.dataset.set;
    if (ATL.FAMILIES.indexOf(k) >= 0){ const r = ATL.claimChapter(atelierEnv(), k); if (!r.ok){ SFX.no(); toast(L.atl.fail); return; } SFX.level(); confetti(); renderTop(); renderNav(); openAlbum(); return; }
    S.album[k] = 1;
    const rew = k==='all' ? {coins:500, energy:50} : {coins:100, energy:20}; give(rew); SFX.coin(); confetti(); save(); renderTop(); renderNav(); openAlbum();
  });
}


/* ---------------- Makeup Atelier panel (UI only: every rule comes from atelier.js) ----------------
   One active commission; ONE Deliver action consumes the three listed board items (lowest board index first). The station illustration is decoration:
   the three item sprites sit in its measured interiors (ART.ATELIER_STATION), text/buttons are real HTML outside the art. Nothing here is saved. */
const atlName = (c, l) => L.items[c][l - 1];
function atelierLockedHtml(){
  const st = ATL.unlockStatus(S), row = (ok, txt) => `<div class="row"><div class="art" style="width:26px;height:26px">${ok ? A.icon('check') : A.icon('lock')}</div><div class="grow">${txt}</div></div>`;
  const rows = [row(S.lv >= ATL.UNLOCK_LEVEL, L.atl.reqLevel(S.lv, ATL.UNLOCK_LEVEL))].concat(ATL.REQUIRED_FAMILIES.map(c => { let n = 0; for (let l = 1; l <= 6; l++) if (S.seen[c + l]) n++; return row(n >= 6, L.atl.reqRanks((L.atl.families || L.chains)[c] || L.chains[c], n, 6)); }));
  return `<div class="center atlLockArt">${A.item('brs', 3)}</div><div class="ribbon small">${L.atl.reqTitle}</div>${rows.join('')}<p class="muted center" style="font-size:12px">${L.atl.reqPlay}</p>
    <div class="atlFoot"><button class="btn wide" data-close>${L.atl.close}</button></div>`;
}
function atelierHtml(reward){
  const a = S.atl, req = ATL.requirements(S), N = ATL.COMMISSION_CADENCE;
  const parts = req ? req.parts : [null, null, null], rec = a.cur ? ATL.RECIPES[a.cur.r] : null;
  const att = A.atelierStationAttrs(), [sw, sh] = A.ATELIER_STATION.space;
  const slots = A.ATELIER_STATION.slots.map(([x, y, w, h], i) => { const p = parts[i];
    return `<div class="atlSlot${p && !p.have ? ' miss' : ''}" data-slot="${i}" style="left:${(x/sw*100).toFixed(3)}%;top:${(y/sh*100).toFixed(3)}%;width:${(w/sw*100).toFixed(3)}%;height:${(h/sh*100).toFixed(3)}%">${p ? A.item(p.c, p.l) : ''}</div>`; }).join('');
  const station = `<div class="atlStation" dir="ltr"><img class="atlArt" src="${att.src}"${att.srcset ? ` srcset="${att.srcset}"` : ''} width="${sw}" height="${sh}" alt="" draggable="false">${slots}</div>`;
  let body;
  const rwChip = (ic, n) => `<span class="rw"><i>${A.icon(ic)}</i>+${n}</span>`;
  const rewardCard = reward ? `<div class="atlReward" role="status" aria-live="polite"><div class="atlRwTitle"><i>${A.icon('check')}</i>${L.atl.doneTitle}</div><div class="atlRwName">${L.atl.recipes[reward.recipe]}</div>
      <div class="atlRwChips">${rwChip('coin', reward.coins)}${rwChip('star', reward.stars)}</div>
      ${reward.levels.map(u => `<div class="atlRwLevel"><b>${L.atl.levelReached(u.lv)}</b> ${rwHtml(u.r)}</div>`).join('')}</div>` : '';
  if (rec){
    body = `<div class="center atlHead"><b>${L.atl.recipes[rec.id]}</b><div class="muted" style="font-size:12px">${L.atl.commission(a.cur.n)}</div></div>
      <div class="center atlRw">${rwHtml({coins: a.cur.coins, stars: a.cur.stars})}</div>
      <div class="muted center" style="font-size:12px;margin-top:6px">${L.atl.ingredients} · ${L.atl.need}</div>
      ${parts.map(p => `<div class="row atlIng${p.have ? ' got' : ''}" data-ing="${p.c}${p.l}"><div class="art">${A.item(p.c, p.l)}</div><div class="grow">${atlName(p.c, p.l)}<div class="muted" style="font-size:12px">${L.level(p.l)} · ${L.atl.onBoard(p.have)}</div></div><span class="atlMark" style="width:24px">${p.have ? A.icon('check') : ''}</span></div>`).join('')}
      <div class="center atlState ${req.ready ? 'ok' : ''}" role="status">${req.ready ? L.atl.ready : L.atl.notReady}</div>`;
  } else {
    const done = Math.min(a.s, N), left = Math.max(0, N - done);                // remaining = cadence constant minus real progress
    body = `<div class="center atlHead"><b>${L.atl.title}</b></div>
      <div class="center atlWait" role="status"><div class="atlWaitMain" id="atlRemain">${L.atl.waitRemaining(left)}</div>
      <div class="atlProg" id="atlProg">${L.atl.progress(done, N)}</div></div>
      <p class="muted center" style="font-size:12px">${L.atl.separateNote}</p>`;
  }
  const foot = rec ? `<p class="muted center" style="font-size:11px;margin:4px 0">${L.atl.cells} · ${L.atl.pickNote}</p>
    <div class="atlFoot"><button class="btn pink wide" id="atlGo" ${req && req.ready ? '' : 'disabled'}>${L.atl.deliver}</button><button class="btn wide" data-close>${L.atl.close}</button></div>`
    : `<div class="atlFoot"><button class="btn pink wide" id="atlBack">${L.atl.backToBoard}</button></div>`;    // no commission: no Deliver button and no ingredient instructions
  return `${rewardCard}${station}${body}${foot}`;
}
function openAtelier(reward){          // reward (optional) is passed ONLY by the delivery that just committed: it is shown once and never replayed on reopen/reload
  if (!ATL.hasChapter(S)){ modal(L.atl.title, atelierLockedHtml()); return; }
  preloadSprites();
  modal(L.atl.title, atelierHtml(reward));
  const back = $('atlBack'); if (back) back.onclick = () => { closeModal(); go('board'); };       // view change only: no state is touched
  const goBtn = $('atlGo'); if (!goBtn) return;
  goBtn.onclick = () => {
    if (goBtn.disabled) return; goBtn.disabled = true;                                           // a second tap cannot start a second delivery (the rule also refuses it: no active commission)
    const r = ATL.deliverCommission(atelierEnv());
    if (r.ok){
      const fromCoins = fxCoinHold != null ? fxCoinHold : (S.coins - (r.coins || 0));
      const fromPct = Math.min(100, (S.stars - (r.stars || 0)) / starsNeed(S.lv) * 100);
      SFX.deliver(); buzz(20); selected = null;
      fxRewardFlight({from: goBtn, coins: r.coins, stars: r.stars, fromCoins, toCoins: S.coins, fromPct, toPct: Math.min(100, S.stars / starsNeed(S.lv) * 100)});
      announceLevelUps(r.ups.concat(r.grants.map(g => ({supply: {g: ATL.PRODUCER, where: g.where}}))), true);    // the level-up is shown inside the reward card below
      renderTop(); renderBoard(); renderOrders(); renderInfo(); renderNav(); renderSide();
      openAtelier({recipe: r.recipe, coins: r.coins, stars: r.stars, levels: r.ups.filter(u => u.lv)});       // the ACTUAL credited (frozen) values, shown only because the write committed
    } else {
      SFX.no(); toast(r.reason === 'storage' ? L.atl.fail : r.reason === 'missing' ? L.atl.missing : L.atl.gone);
      openAtelier();
    }
  };
}

let energyOpen = false;
function energyInfoHtml(){
  const t = energyTimes(Date.now()), full = S.energy >= ENERGY_CAP;
  const timers = full
    ? `<div class="row"><div class="grow" id="enFullNow">${L.energyFullNow}</div></div>`
    : `<div class="row"><div class="grow">${L.energyNextIn}</div><b class="ltr" id="enNext">${fmtDur(t.next)}</b></div>
    <div class="row"><div class="grow">${L.energyFullIn}</div><b class="ltr" id="enFull">${fmtDur(t.full)}</b></div>`;
  return `<div class="enInfo" id="enInfo"><div class="enBig ltr">${S.energy}<small>/${ENERGY_CAP}</small></div>
    <div class="row"><div class="grow">${L.energyInterval(ENERGY_MS/1000)}</div></div>
    ${timers}
    <div class="muted center" id="enNote" style="font-size:12px;margin:2px 0 6px">${S.energy > ENERGY_CAP ? L.energyAbove(ENERGY_CAP) : L.energyKept}</div></div>`;
}
function refreshEnergyInfo(){                // display only: recomputed from S.energy/S.et every second while the panel is open
  if (!energyOpen || !$('enInfo')) return; const t = energyTimes(Date.now()), full = S.energy >= ENERGY_CAP;
  const next = $('enNext'), fullEl = $('enFull');
  if (next) next.textContent = fmtDur(t.next);
  if (fullEl) fullEl.textContent = fmtDur(t.full);
  // crossing the cap (or dropping below it) changes the row structure: rebuild once
  if (!!full !== !$('enFullNow') && !!full !== !!(next || fullEl)) { openShop('energy'); return; }
  if (full && !$('enFullNow')) { openShop('energy'); return; }
  if (!full && $('enFullNow')) { openShop('energy'); return; }
  $('enInfo').querySelector('.enBig').firstChild.textContent = S.energy; $('enNote').textContent = S.energy > ENERGY_CAP ? L.energyAbove(ENERGY_CAP) : L.energyKept;
}
function eshopState(){
  const k = dayKey();
  if (!S.eshop || S.eshop.v !== 1 || S.eshop.k !== k) S.eshop = {v:1, k, n20:0, n50:0};
  return S.eshop;
}
function energyOffer(pack){                 // pack is 20 or 50; price of the NEXT purchase today (resets at local midnight)
  const P = ENERGY_PACKS[pack], st = eshopState(), n = pack === 20 ? st.n20 : st.n50;
  if (n >= P.cap) return { sold: true, n, cap: P.cap, amt: P.amt };
  return { sold: false, price: P.ladder[Math.min(n, P.ladder.length - 1)], n, cap: P.cap, left: P.cap - n, amt: P.amt };
}
function buyEnergy(pack){
  return txn(() => {
    const off = energyOffer(pack);
    if (off.sold) return {ok: false, reason: 'sold'};
    if (S.coins < off.price) return {ok: false, reason: 'coins'};
    S.coins -= off.price; S.energy += off.amt;
    if (pack === 20) S.eshop.n20 = (S.eshop.n20 || 0) + 1; else S.eshop.n50 = (S.eshop.n50 || 0) + 1;
    return {ok: true, price: off.price, amt: off.amt, next: energyOffer(pack)};
  });
}
function packRow(pack){
  const off = energyOffer(pack), label = '+' + pack + ' ' + L.energy;
  if (off.sold) return `<div class="row" id="shE${pack}row"><div class="art">${A.icon('bolt')}</div><div class="grow">${label}<div class="muted" style="font-size:12px">${L.shopSoldOut}</div></div>
      <button class="btn pink" id="shE${pack}" disabled>${L.tomorrow}</button></div>`;
  return `<div class="row" id="shE${pack}row"><div class="art">${A.icon('bolt')}</div><div class="grow">${label}<div class="muted" style="font-size:12px">${L.shopLeft(off.left)}</div></div>
      <button class="btn pink" id="shE${pack}" ${S.coins < off.price ? 'disabled' : ''}><span class="rw"><i>${A.icon('coin')}</i>${off.price}</span></button></div>`;
}
function openEnergy(){ openShop('energy'); }
function openShop(mode){
  if (typeof mode !== 'string') mode = '';
  const ready = S.gift !== dayKey();
  const streak = ready ? giftStreakNext() : (S.gst && S.gst.k === dayKey() ? S.gst.n : 1);
  const grew = giftReward(ready ? streak : (S.gst && S.gst.n) || 1);
  const dots = [1,2,3].map(i => `<i class="gdot${i <= streak ? ' on' : ''}"></i>`).join('');
  eshopState();
  modal(mode === 'energy' ? L.energyTitle : L.shopTitle, (mode === 'energy' ? energyInfoHtml() : '') + `
    <div class="row"><div class="art">${A.icon('heart')}</div><div class="grow">${L.dailyGift} <span class="gstreak">${L.giftStreak(streak)}</span> ${dots}<br>${rwHtml(grew)}
      <div class="muted" style="font-size:11px;margin-top:2px">${L.giftStreakHint}</div></div>
      <button class="btn" id="shGift" ${ready?'':'disabled'}>${ready ? L.take : L.tomorrow}</button></div>
    ${packRow(20)}${packRow(50)}
    <div class="muted center" style="font-size:12px;margin:2px 0 8px">${L.shopLadderNote}</div>${supplyHtml()}`);
  energyOpen = mode === 'energy'; wireSupply(() => openShop(mode));
  $('shGift').onclick = () => { if (!claimDailyGift().ok) return; renderTop(); openShop(mode); };
  renderTut();
  const onBuy = pack => {
    const r = buyEnergy(pack);
    if (!r.ok){ SFX.no(); toast(r.reason === 'coins' ? L.noCoins : L.shopSoldOut); openShop(mode); return; }
    SFX.shop(); renderTop(); openShop(mode);
  };
  $('shE20').onclick = () => onBuy(20);
  $('shE50').onclick = () => onBuy(50);
}

function openSettings(){
  const bks = persist.readBackups(), bk = {ok: bks.length > 0, savedAt: bks.length ? bks[0].savedAt : 0};
  const sv = S.set.soundVol, mv = S.set.musicVol;
  modal(L.settings, `
    <div class="row"><div class="art" style="width:32px;height:32px">${A.icon('sound')}</div><div class="grow">${L.sound}</div><button class="toggle ${S.set.sound?'on':''}" id="stS" aria-pressed="${S.set.sound?'true':'false'}"></button></div>
    <div class="volRow"><label class="muted" for="stSV">${L.soundVol}</label><input class="vol" id="stSV" type="range" min="0" max="1" step="0.01" value="${sv}"></div>
    <div class="row"><div class="art" style="width:32px;height:32px">${A.icon('music')}</div><div class="grow">${L.music}</div><button class="toggle ${S.set.music?'on':''}" id="stM" aria-pressed="${S.set.music?'true':'false'}"></button></div>
    <div class="volRow"><label class="muted" for="stMV">${L.musicVol}</label><input class="vol" id="stMV" type="range" min="0" max="1" step="0.01" value="${mv}"></div>
    <div class="row"><div class="art" style="width:32px;height:32px">${A.icon('vibrate')}</div><div class="grow">${L.vibrate}</div><button class="toggle ${S.set.vib?'on':''}" id="stV"></button></div>
    <div class="row langRow" id="stLang" role="button" tabindex="0" aria-expanded="false" aria-haspopup="listbox" aria-controls="langSheet">
      <div class="art" style="width:32px;height:32px">${A.icon('globe')}</div>
      <div class="grow">${L.language}</div>
      <span class="langNow"><span class="langNowName">${LANGS[S.set.lang].label}</span><i aria-hidden="true">▾</i></span>
    </div>
    <div class="langSheet" id="langSheet" hidden role="listbox">
      ${Object.keys(LANGS).map(k => `<button type="button" class="lang ${S.set.lang===k?'on':''}" data-lang="${k}" role="option" aria-selected="${S.set.lang===k?'true':'false'}"><span>${S.set.lang===k?'✓ ':''}${LANGS[k].label}</span><code>${k.toUpperCase()}</code></button>`).join('')}
    </div>
    <div class="row" style="margin-bottom:2px"><div class="art" style="width:32px;height:32px">${A.icon('book')}</div><div class="grow">${L.saveSection}</div></div>
    <button class="btn wide" id="stExp" style="font-size:14px;margin-top:4px">${L.exportSave}</button>
    <button class="btn wide" id="stImp" style="font-size:14px;margin-top:6px">${L.importSave}</button>
    <button class="btn wide" id="stRes" style="font-size:14px;margin-top:6px"${bk.ok ? '' : ' disabled'}>${L.restoreBackup}</button>
    <div class="center muted" id="stBk" style="margin-top:4px;font-size:12px">${bk.ok ? L.backupInfo(fmtTime(bk.savedAt)) : L.noBackup}</div>
    <button class="btn pink wide" id="stReset" style="font-size:14px">${L.reset}</button>
    <div class="center muted" style="margin-top:8px">Atelier Lueur · v0.2</div>`);
  const mark = (id, on) => { const b = $(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  $('stS').onclick = () => { S.set.sound = !S.set.sound; applyAudio(); save(); mark('stS', S.set.sound); if (S.set.sound) SFX.tap(); };
  $('stM').onclick = () => { S.set.music = !S.set.music; applyAudio(); save(); mark('stM', S.set.music); };
  const slide = (id, key) => {
    const el = $(id);
    el.oninput = () => { S.set[key] = +el.value; applyAudio(); };
    el.onchange = () => { save(); if (key === 'soundVol' && S.set.sound) SFX.tap(); };
  };
  slide('stSV', 'soundVol'); slide('stMV', 'musicVol');
  $('stV').onclick = () => { S.set.vib = !S.set.vib; save(); mark('stV', S.set.vib); };
  const langRow = $('stLang'), langSheet = $('langSheet');
  const toggleLangSheet = on => {
    const open = on !== undefined ? on : langSheet.hidden;
    langSheet.hidden = !open;
    langRow.setAttribute('aria-expanded', open ? 'true' : 'false');
    langRow.classList.toggle('open', open);
    if (open) langSheet.scrollIntoView({block:'nearest'});
  };
  langRow.onclick = ev => { ev.stopPropagation(); toggleLangSheet(); };
  langRow.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleLangSheet(); } };
  langSheet.onclick = ev => ev.stopPropagation();
  langSheet.querySelectorAll('[data-lang]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    if (b.dataset.lang === S.set.lang){ toggleLangSheet(false); return; }
    S.set.lang = b.dataset.lang; save(); applyLang(); renderAll(); openSettings();
  });
  $('stReset').onclick = confirmReset;
  $('stExp').onclick = () => openExport();
  $('stImp').onclick = () => openImport(openSettings);
  $('stRes').onclick = () => openRestore(openSettings);
}
function confirmReset(){
  modal(L.reset, `<p class="center">${L.confirmNew}</p><div style="display:flex;gap:8px"><button class="btn pink wide" id="rY">${L.yes}</button><button class="btn wide" data-close>${L.no}</button></div>`);
  $('rY').onclick = () => { const r = startNewGame(); if (!r.ok){ toast(xferError(r)); return; } closeModal(); go('board'); renderAll(); toast(L.newDone); };
}

/* ---------------- Save protection UI: export / import / restore / recovery ---------------- */
const KB = Math.round(SAVE.MAX_IMPORT_BYTES / 1024);
const pad2 = n => String(n).padStart(2, '0');
const stamp = () => { const d = new Date(); return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()); };
function fmtTime(ms){                                   // neutral local time: YYYY-MM-DD HH:MM (same in every language)
  const d = new Date(ms); const t = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return L.dir === 'rtl' ? '\u2066' + t + '\u2069' : t;     // keep digits left-to-right inside RTL text
}
function xferError(res){
  const c = res && res.code;
  if (c === 'too-big') return L.errTooBig(KB);
  if (c === 'not-json') return L.errNotJson;
  if (c === 'not-save' || c === 'not-text') return L.errNotSave;
  if (c === 'future-version') return L.errFuture;
  if (c === 'bad-version') return L.errBadVersion;
  if (c === 'checksum') return L.errChecksum;
  if (c === 'invalid-state') return L.errInvalid;
  if (c === 'file') return L.errFile;
  if (res && res.stage === 'read') return L.errRead;
  return L.errWrite;                                       // quota, security, io, verify-failed (backup/primary stage)
}
function sumTable(cols){
  const rows = [['sumLevel','lv'],['sumCoins','coins'],['sumStars','stars'],['sumEnergy','energy'],['sumItems','seen'],['sumDecor','owned']];
  if (cols.some(c => c.sum.evDone || c.sum.evClaimed)) rows.push(['sumEvents','evDone'], ['sumEventClaims','evClaimed']);   // only when an event is involved
  return `<table class="cmp"><thead><tr><th></th>${cols.map(c => `<th>${c.title}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(([k, f]) => `<tr><td>${L[k]}</td>${cols.map(c => `<td class="num">${c.sum[f]}</td>`).join('')}</tr>`).join('') + `</tbody></table>`;
}
function adoptState(state){                                // only after a successful, verified commit
  S = state; saveGate.blocked = false; saveGate.memoryOnly = false; recovery = null; hasSave = true;
  selected = null; [0,1,2].forEach(i => { PSTATE[i] = 'idle'; });
  prepareCalendar(S);
  migrateEnergy(); applyLang(); applyAudio(); tick(); fillOrders(); setSaveWarn(null); migrateLegacyEvents(); migrateSupply(); if (curDef) applyContent(curDef);
  settlePlaytestGrant(); save();
  $('recovery').classList.remove('on');
  if ($('start').classList.contains('on')) showStart();
  renderAll();
}
function replaceSave(incoming){
  const cand = JSON.parse(JSON.stringify(incoming)); cand.set = S.set;               // device preferences stay as they are
  const res = persist.commit(cand, {current: saveGate.blocked ? null : S});            // current valid save becomes the backup first
  if (!res.ok) return res;                                                               // nothing in memory or storage was replaced
  adoptState(res.state); return res;
}
function startNewGame(){
  const old = S, fresh = newGame(); fresh.set = S.set;
  applyPlaytestCoinGrant(fresh);
  S = fresh; fillOrders();
  const res = persist.commit(S, {current: saveGate.blocked ? null : old});
  if (!res.ok){ S = old; return res; }
  adoptState(res.state); return res;
}
function downloadText(name, text, mime){
  try {
    const url = URL.createObjectURL(new Blob([text], {type: mime || 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000);
    return true;                                           // "requested" only: browsers do not confirm that a file was written
  } catch (e) { return false; }
}
function copyText(text, ta){
  return new Promise(res => {
    const selectIt = () => { try { ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); } catch (e) {} };
    const legacy = () => { selectIt(); let ok = false; try { ok = !!(document.execCommand && document.execCommand('copy')); } catch (e) {} res(ok ? 'copied' : 'manual'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => res('copied'), legacy); else legacy();
  });
}
function openTextOut(o){
  modal(o.title, `
    ${o.note ? `<p class="center muted">${o.note}</p>` : ''}
    ${o.sum ? sumTable([{title: L.colCurrent, sum: o.sum}]) : ''}
    <div class="xstatus" id="xSt" role="status" aria-live="polite"></div>
    <button class="btn wide" id="xDl">${L.downloadFile}</button>
    <button class="btn wide" id="xShow">${L.showText}</button>
    <div id="xBox" hidden>
      <textarea class="xfer" id="xTa" readonly rows="6" dir="ltr" lang="en" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="JSON"></textarea>
      <button class="btn wide" id="xCopy">${L.copyText}</button>
    </div>
    <button class="btn pink wide" id="xBack" style="margin-top:10px">${L.back}</button>`);
  $('xTa').value = o.text;
  const st = (msg, cls) => { const el = $('xSt'); el.textContent = msg; el.className = 'xstatus ' + (cls || ''); };
  const showBox = on => { $('xBox').hidden = !on; $('xShow').textContent = on ? L.hideText : L.showText; };
  $('xDl').onclick = () => { if (downloadText(o.name, o.text, o.mime)) st(L.xferDownloadRequested, 'info'); else { showBox(true); st(L.xferDownloadFailed, 'err'); } };
  $('xShow').onclick = () => { showBox($('xBox').hidden); if (!$('xBox').hidden) st(L.xferPrepared, 'info'); };
  $('xCopy').onclick = async () => { const r = await copyText(o.text, $('xTa')); st(r === 'copied' ? L.xferCopied : L.xferPrepared, r === 'copied' ? 'ok' : 'info'); };
  $('xBack').onclick = o.back || closeModal;
}
function openExport(){
  const e = SAVE.makeEnvelope(S, Date.now());
  if (!e.ok){ modal(L.exportSave, `<p class="center xstatus err">${L.errInvalid}</p><button class="btn wide" id="xBack">${L.back}</button>`); $('xBack').onclick = openSettings; return; }
  openTextOut({title: L.exportSave, note: L.exportNote, text: e.text, sum: e.summary, name: 'atelier-lueur-save-' + stamp() + '.json', back: openSettings});
}
function confirmReplace(o){
  const cols = [];
  if (!saveGate.blocked) cols.push({title: L.colCurrent, sum: SAVE.summary(S)});
  cols.push({title: o.kind === 'restore' ? L.colBackup : L.colImport, sum: o.sum});
  modal(L.replaceTitle, `${saveGate.blocked ? '' : `<p class="center">${L.replaceBody}</p>`}${sumTable(cols)}${o.note || ''}
    <div class="xstatus err" id="cErr" role="alert"></div>
    <div class="btnrow"><button class="btn pink" id="cYes">${L.replace}</button><button class="btn" id="cNo">${L.cancel}</button></div>`);
  $('cNo').onclick = o.back || closeModal;                  // cancel: nothing was touched
  $('cYes').onclick = () => {
    const r = replaceSave(o.state);
    if (!r.ok){ $('cErr').textContent = xferError(r); return; }
    closeModal(); if (page !== 'board' && $('game').classList.contains('on')) go('board');
    toast(o.kind === 'restore' ? L.restoreDone : L.importDone);
  };
}
function openImport(back){
  modal(L.importSave, `
    <p class="center muted">${L.importNote}</p>
    <button class="btn wide" id="iFile">${L.chooseFile}</button>
    <input type="file" id="iIn" hidden accept=".json,application/json,text/plain">
    <label class="lbl" for="iTa">${L.pasteHere}</label>
    <textarea class="xfer" id="iTa" rows="6" dir="ltr" lang="en" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea>
    <div class="xstatus err" id="iErr" role="alert"></div>
    <button class="btn wide" id="iCheck">${L.checkText}</button>
    <button class="btn pink wide" id="iBack" style="margin-top:10px">${L.cancel}</button>`);
  const err = m => { $('iErr').textContent = m || ''; };
  const proceed = text => {
    const r = SAVE.parseEnvelope(text, S.set);               // JSON.parse + allow-list validator only; nothing is evaluated
    if (!r.ok){ err(xferError(r)); return; }
    err(''); confirmReplace({kind: 'import', sum: r.summary, state: r.state, back: () => openImport(back)});
  };
  $('iFile').onclick = () => $('iIn').click();
  $('iIn').onchange = async () => {
    const f = $('iIn').files[0]; if (!f) return;
    if (f.size > SAVE.MAX_IMPORT_BYTES){ err(L.errTooBig(KB)); $('iIn').value = ''; return; }   // checked BEFORE reading
    let text;
    try { text = await (f.text ? f.text() : new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => no(fr.error); fr.readAsText(f); })); }
    catch (e) { err(L.errFile); return; }
    proceed(text);
  };
  $('iCheck').onclick = () => { const t = $('iTa').value; if (!t.trim()){ err(L.errEmpty); return; } proceed(t); };
  $('iBack').onclick = back || closeModal;
}
function openRestore(back){
  const list = persist.readBackups();
  if (!list.length){
    modal(L.restoreBackup, `<p class="center xstatus err">${L.errNoBackup}</p><button class="btn wide" id="rBack">${L.back}</button>`);
    $('rBack').onclick = back || closeModal; return;
  }
  const pick = b => confirmReplace({kind: 'restore', sum: SAVE.summary(b.state), state: b.state, back: list.length > 1 ? () => openRestore(back) : back,
    note: `<div class="center muted">${b.id === 'before' ? L.backupBefore : L.backupAuto} · ${L.backupInfo(fmtTime(b.savedAt))}</div>`});
  if (list.length === 1){ pick(list[0]); return; }
  modal(L.restoreBackup, `<p class="center muted">${L.chooseBackup}</p>` + list.map((b, i) => `<div class="bkopt"><div class="grow"><b>${b.id === 'before' ? L.backupBefore : L.backupAuto}</b><div class="muted" style="font-size:12px">${fmtTime(b.savedAt)}</div>
      <div style="font-size:12px">${L.sumLevel} <b class="ltr">${b.state.lv}</b> · ${L.sumCoins} <b class="ltr">${b.state.coins}</b> · ${L.sumStars} <b class="ltr">${b.state.stars}</b></div></div>
      <button class="btn" data-bk="${i}">${L.restoreBackup}</button></div>`).join('') + `<button class="btn pink wide" id="rBack" style="margin-top:10px">${L.cancel}</button>`);
  document.querySelectorAll('#modal [data-bk]').forEach(el => el.onclick = () => pick(list[+el.dataset.bk]));
  $('rBack').onclick = back || closeModal;
}
function showRecovery(view){
  const r = recovery; if (!r) return;
  const langTabs = `<div class="tabs">${Object.keys(LANGS).map(k => `<button data-rl="${k}" class="${S.set.lang === k ? 'on' : ''}"><span class="tabLab">${LANGS[k].label}</span></button>`).join('')}</div>`;
  let title, body;
  if (view === 'new'){
    title = L.recNewTitle;
    const noCopy = r.status === 'corrupt' && !(r.preserved && r.preserved.ok);
    body = `<p class="center">${noCopy ? L.recNewBodyNoCopy : L.recNewBody}</p><div class="xstatus err" id="rErr" role="alert"></div>
      <div class="btnrow"><button class="btn pink" id="rNewYes">${L.recNew}</button><button class="btn" id="rNewNo">${L.cancel}</button></div>`;
  } else {
    title = L.recTitle;
    const msg = r.status === 'corrupt' ? L.recCorrupt : r.status === 'missing-with-backup' ? L.recMissing : L.recStorage;
    const bsum = r.backup ? sumTable([{title: L.colBackup, sum: SAVE.summary(r.backup.state)}]) + `<div class="center muted">${L.backupInfo(fmtTime(r.backup.savedAt))}${r.backups && r.backups.length > 1 ? ' (+' + (r.backups.length - 1) + ')' : ''}</div>` : '';
    const btn = (id, label, cls) => `<button class="btn ${cls || ''} wide" id="${id}" style="font-size:15px">${label}</button>`;
    const buttons = r.status === 'storage-error'
      ? btn('rRetry', L.recRetry) + btn('rCont', L.recContinue, 'pink')
      : (r.backup ? btn('rRestore', L.restoreBackup) : '') + btn('rImport', L.importSave) +
        (r.status === 'corrupt' && r.raw ? btn('rExpBad', L.recExportBad) : '') + btn('rNew', L.recNew, 'pink');
    body = `<p class="center">${msg}</p>${bsum}<div class="xstatus err" id="rErr" role="alert"></div>${buttons}`;
  }
  $('recoveryBody').innerHTML = `<div class="ribbon">${title}</div><div class="mbody">${langTabs}${body}</div>`;
  $('recovery').classList.add('on');
  const hide = () => $('recovery').classList.remove('on');
  document.querySelectorAll('#recoveryBody [data-rl]').forEach(b => b.onclick = () => { S.set.lang = b.dataset.rl; applyLang(); showStart(); showRecovery(view); });
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on('rRestore', () => { hide(); openRestore(closeModal); });
  on('rImport', () => { hide(); openImport(closeModal); });
  on('rExpBad', () => { hide(); openTextOut({title: L.recExportBad, text: r.raw, mime: 'text/plain', name: 'atelier-lueur-damaged-' + stamp() + '.txt', back: closeModal}); });
  on('rNew', () => showRecovery('new'));
  on('rNewNo', () => showRecovery());
  on('rNewYes', () => { const res = startNewGame(); if (!res.ok){ $('rErr').textContent = xferError(res); return; } hide(); toast(L.newDone); });
  on('rRetry', () => {
    applyBoot(persist.read());
    if (recovery){ showRecovery(); const e = $('rErr'); if (e) e.textContent = L.recStorage; return; }
    hide(); applyLang(); tick(); fillOrders(); save(); showStart();
  });
  on('rCont', () => { saveGate.blocked = false; saveGate.memoryOnly = true; recovery = null; setSaveWarn('memory'); hide(); showStart(); });
}
document.getElementById('saveWarn').onclick = () => { if ($('game').classList.contains('on')) openSettings(); };

let secretTab = 'letter', letterOpen = false;
function openSecret(){
  if (S.lv < C.secretLevel){
    modal(L.secret, `<div class="bigart">${A.icon('lock')}</div><p class="center" style="font-weight:800">${L.lockedAt(C.secretLevel)}</p>`); return;
  }
  if (!S.secretSeen){ S.secretSeen = true; save(); renderSide(); }
  const tabs = `<div class="tabs"><button data-st="letter" class="${secretTab==='letter'?'on':''}">${L.letter}</button><button data-st="mem" class="${secretTab==='mem'?'on':''}">${L.memories}</button></div>`;
  let body;
  if (secretTab === 'letter'){
    body = letterOpen ? `<div class="paper">${esc(C.letter)}<div class="from">— ${esc(C.letterFrom)}</div></div>`
      : `<div class="envelope" id="env">${A.icon('letter')}</div><button class="btn pink wide" id="openL">${L.openLetter}</button>`;
  } else {
    body = C.memories.map(m => `<div class="mem"><div class="art">${A.icon('heart')}</div><div>${esc(m.text)}<small>${esc(m.date)}</small></div></div>`).join('');
  }
  modal(L.secret, tabs + body);
  $('modal').querySelectorAll('[data-st]').forEach(b => b.onclick = () => { secretTab = b.dataset.st; openSecret(); });
  const ol = () => { letterOpen = true; SFX.level(); confetti(true); openSecret(); };
  if ($('openL')) { $('openL').onclick = ol; $('env').onclick = ol; }
}
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ---------------- ئۈنۈم ---------------- */
let tt;
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 1600); }
function confetti(hearts, origin){
  if (fxReduce()) return;
  const cols = ['#ff5fa2','#ffc83d','#b79bff','#6fdc7f','#7fd3f0'];
  const layer = fxLayer();
  const src = origin || fxPt($('tLv')) || {x: innerWidth / 2, y: innerHeight * 0.28};
  const n = hearts ? 16 : 14;
  for (let i = 0; i < n; i++){
    if (fxBits >= FX_BIT_CAP) break;
    const d = document.createElement('div');
    d.className = 'fxBit ' + (hearts ? 'fxHeart' : 'fxConf');
    if (hearts){ d.textContent = '❤'; d.style.color = pick(cols); }
    else d.style.background = pick(cols);
    layer.appendChild(d); fxBits++;
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 46 + Math.random() * 70;
    const x2 = src.x + Math.cos(ang) * dist, y2 = src.y + Math.sin(ang) * dist + 18;
    const dur = 480 + rnd(220);
    const anim = d.animate([
      {transform:'translate(' + src.x + 'px,' + src.y + 'px) scale(1) rotate(0deg)', opacity:1},
      {transform:'translate(' + x2 + 'px,' + y2 + 'px) scale(.65) rotate(' + (rnd(240) - 120) + 'deg)', opacity:0}
    ], {duration:dur, easing:'cubic-bezier(.15,.75,.3,1)', fill:'forwards'});
    const done = () => fxClearBit(d);
    if (anim && anim.finished) anim.finished.then(done).catch(done); else setTimeout(done, dur + 40);
    setTimeout(() => fxClearBit(d), dur + 200);
  }
}

/* ---------------- سۆرەش ---------------- */
const bd = $('board');
bd.addEventListener('pointerdown', e => {
  audio();
  const c = e.target.closest('.cell'); if (!c) return;
  const i = +c.dataset.i;
  drag = {i, x0:e.clientX, y0:e.clientY, moved:false, target:null};
  if (S.board[i]) try { bd.setPointerCapture(e.pointerId); } catch(err){}
});
bd.addEventListener('pointermove', e => {
  if (!drag || !S.board[drag.i]) return;
  if (!drag.moved && Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) > 8){
    drag.moved = true; selected = drag.i;
    const g = document.createElement('div'); g.id = 'ghost'; g.innerHTML = itemArt(S.board[drag.i]);
    document.body.appendChild(g); renderBoard(); renderInfo();
  }
  if (drag.moved){
    const g = $('ghost'); g.style.left = e.clientX+'px'; g.style.top = e.clientY+'px';
    const c = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
    const t = c ? +c.dataset.i : null;
    if (t !== drag.target){
      if (drag.target != null) bd.children[drag.target].classList.remove('target', 'mergeOk');
      if (t != null && t !== drag.i){
        bd.children[t].classList.add('target');
        if (canMerge(S.board[drag.i], S.board[t])) bd.children[t].classList.add('mergeOk');
      }
      drag.target = t;
    }
  }
});
function endDrag(cancel){
  if (!drag) return;
  const d = drag; drag = null;
  $('ghost')?.remove();
  if (d.target != null) bd.children[d.target].classList.remove('target', 'mergeOk');
  if (cancel){ renderBoard(); return; }
  if (!d.moved) tap(d.i); else drop(d.i, d.target);
}
bd.addEventListener('pointerup', () => endDrag(false));
bd.addEventListener('pointercancel', () => endDrag(true));
/* iOS Safari double-tap zoom on rapid producer taps. touch-action alone did not stop it on the owner's iPhone (reported twice: with none, then with pinch-zoom), and during rapid taps the element under the
   finger is not stable: each tap spawns an item that flies out of the producer's cell over the producer. The zoom is therefore also cancelled where WebKit decides it: the default action of the touchend
   of a ONE-finger touch sequence that started on the board. This never touches the game logic (pointerup has already run tap()/drop()), so every tap still counts once and costs its energy; the board has
   no click handlers; scrolling and drag use pointer events; a sequence that ever had a second finger (pinch, two-finger pan) is left completely alone, so pinch zoom keeps working. */
let boardMulti = false;
bd.addEventListener('touchstart', e => { if (e.touches.length > 1) boardMulti = true; }, {passive: true});
bd.addEventListener('touchmove', e => { if (e.touches.length > 1) boardMulti = true; }, {passive: true});
bd.addEventListener('touchend', e => { if (e.touches.length > 0) return; if (!boardMulti && e.cancelable) e.preventDefault(); boardMulti = false; }, {passive: false});
bd.addEventListener('touchcancel', () => { boardMulti = false; }, {passive: true});

/* ---------------- ئورۇنلاشتۇرۇش ---------------- */
const INFO_BASE = () => (window.innerWidth <= 360 ? 74 : window.innerWidth <= 400 ? 62 : 64);   // the info panel's historic height (styles); it may GROW for long names, never shrink below this
function layout(){
  const w = $('boardWrap'); if (!w.clientHeight) return;
  /* the info panel is as tall as its content needs (long names / descriptions wrap instead of being cut off). On phones where the board is width-limited there is spare
     height between board and panel: reserve part of it for the panel so the board keeps its size; on height-limited phones the panel grows only when its content needs it.
     Storage lives inside this panel (not a new row), so the board keeps the pre-storage cell size. */
  const inf = $('info'), base = INFO_BASE(), root = document.documentElement;
  const avail = w.clientHeight + inf.offsetHeight, cellW = Math.floor((w.clientWidth-18)/COLS), need = cellW*ROWS + 20, spare = avail - need - base;
  root.style.setProperty('--infoH', Math.max(base, infoNeed(), Math.min(104, base + Math.max(0, spare - 12))) + 'px');
  const c = Math.floor(Math.min((w.clientWidth-18)/COLS, (w.clientHeight-20)/ROWS));
  document.documentElement.style.setProperty('--cell', Math.max(20, c) + 'px');
}
window.addEventListener('resize', layout);

/* ---------------- باشلاش ---------------- */
function showStart(){
  $('hero').innerHTML = `
    <div style="left:30%;top:4%;width:42%;height:42%">${A.item('lip',6)}</div>
    <div style="left:2%;top:34%;width:38%;height:38%;animation-delay:.5s">${A.item('per',6)}</div>
    <div style="right:2%;top:34%;width:38%;height:38%;animation-delay:1s">${A.item('cmp',6)}</div>
    <div style="left:30%;top:58%;width:40%;height:40%;animation-delay:1.5s">${A.gen('pink',3)}</div>`;
  $('giftLine').style.display = C.giftMode ? '' : 'none';
  $('giftLine').textContent = L.forYou(C.giftName);
  $('btnStart').textContent = hasSave ? L.cont : L.start;
  $('btnNew').textContent = L.newGame;
  $('btnNew').style.display = hasSave ? '' : 'none';
  $('start').classList.add('on');
}
function enterGame(){
  settlePlaytestGrant();
  audio(); SFX.tap();
  $('start').classList.remove('on'); $('game').classList.add('on');
  renderAll(); layout();
  startTutorial();
  setTimeout(layout, 50);
}
$('btnStart').onclick = enterGame;
$('btnNew').onclick = () => {
  if (!confirm(L.confirmNew)) return;
  const r = startNewGame(); if (!r.ok){ toast(xferError(r)); return; }
  enterGame();
};

migrateEnergy(); applyLang(); applyAudio(); tick(); fillOrders(); settlePlaytestGrant(); save(); preloadPortraits(); preloadSprites(); showStart(); startBlinks(); if (recovery) showRecovery();
migrateLegacyEvents(); migrateSupply(); settlePlaytestGrant();
refreshContent(true).catch(e => console.warn('[content]', e && e.message));   // async; never blocks or breaks start-up
window.__atelierBooted = true; if (window.__atelierStartupOk) window.__atelierStartupOk();   // startup finished: hide the safety-net message if it was shown
document.fonts && document.fonts.ready.then(() => { layout(); });
setInterval(() => { tick(); if ($('game').classList.contains('on')){ renderTop(); checkTaskBadges(); refreshEnergyInfo(); } }, 1000);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); else { tick(); renderAll(); refreshContent(false).catch(() => {}); } });

// سىناق ئۈچۈن
window.__game = { AUDIO, applyAudio, atelier: {open: () => openAtelier(), env: atelierEnv, notes: atelierNotes}, ALL_CHAINS, buyProp, buyColour, equipColour, salonInp, taskCounts, openTasks, tasksFor, get EV(){ return EV; }, energyTimes, ENERGY_CAP, ENERGY_MS, ENERGY_PACKS, energyOffer, buyEnergy, eshopState, dayKey, weekKey, monthKey, tick, applyLang, buyProducer, placeQueued, producerPrice, equivOf, grantMilestones, claimEvent, newOrder, accessibleChains, deliver: oi => deliver(oi), save: () => save(), get contentInfo(){ return contentInfo; }, refreshContent, get S(){ return S; }, get gate(){ return saveGate; }, get recovery(){ return recovery; }, renderAll, openShop, MSN, MSN_CFG, select: i => { selected = i; renderBoard(); renderInfo(); }, storeSelected, placeInv, expandInv, undoLastSale, get undoSale(){ return undoSale; }, openGenUpgrade, genDropTable, claimDailyGift, giftStreakNext, giftReward, skipTut, tutAdvance, INV_CAPS, INV_EXPAND, get fxCoinHold(){ return fxCoinHold; }, get fxBits(){ return fxBits; }, drop, sell, produce };
})();
