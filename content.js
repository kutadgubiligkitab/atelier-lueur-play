/* Atelier Lueur — monthly content: bounded, versioned, DATA-ONLY definitions + local event progress.
   No eval, no downloaded scripts, no remote code: a definition can only use objective/reward types this client already implements.
   Pure module (no DOM); game.js wires counters, rendering and rewards. Everything here is LOCAL-trust: valuable/online rewards must be
   server-verified (docs/backend/BACKEND_AND_REWARDS.md). */
(function () {
'use strict';
const ENGINE_VERSION = 1;                       // bump only when a NEW kind of mechanic ships in the app
const FORMAT = 'atelier-lueur-content', SCHEMA = 1;
const LIMITS = {maxBytes: 65536, maxEvents: 6, maxObjectives: 6, maxAssets: 8, maxAssetBytes: 262144, maxSpanDays: 62, maxGraceDays: 7,
  maxText: 200, fetchTimeoutMs: 6000, claimCap: {coins: 500, energy: 100, stars: 50, gems: 30}};
const OBJECTIVE_TYPES = ['merge', 'order', 'tap', 'coins', 'deco'];   // incremental counters the shipped engine already produces
const REWARD_KEYS = ['coins', 'energy', 'stars', 'gems'];
const BUNDLED = {format: FORMAT, schema: SCHEMA, contentVersion: 3, minClient: 1, publishedAt: '2026-11-26T00:00:00Z', events: [{
  id: 'week-of-light-2026', revision: 2,
  title: {ug: 'نۇر ھەپتىسى', en: 'Week of Light'},
  desc: {ug: 'تاختىدا بىرلەشتۈرۈڭ، زاكاز يەتكۈزۈڭ ۋە ئىشلەپچىقارغۇچتىن بۇيۇم ئېلىڭ. ۋاقىتلىق مۇكاپات — ھەقسىز.', en: 'Merge on the board, deliver orders and tap generators. A short free event.'},
  start: '2026-11-20T00:00:00Z', end: '2027-01-20T00:00:00Z',
  minClient: 1, eligibility: {minLevel: 1}, claimGraceDays: 3,
  objectives: [
    {id: 'merge-30', type: 'merge', target: 30, reward: {coins: 80}},
    {id: 'order-8', type: 'order', target: 8, reward: {energy: 20}},
    {id: 'tap-40', type: 'tap', target: 40, reward: {stars: 15}}
  ],
  completionReward: {coins: 150, energy: 30, stars: 20, gems: 10}
}], assets: []};

/* ---------------- validation (strict allow-list; any unknown key, wrong type or out-of-range value rejects the whole document) ---------------- */
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isInt = (x, a, b) => typeof x === 'number' && isFinite(x) && Math.floor(x) === x && x >= a && x <= b;
const safeText = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && !/[<>\u0000-\u001f\u007f]/.test(s);
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
function onlyKeys(o, keys, path, err) { Object.keys(o).forEach(k => { if (keys.indexOf(k) < 0) err.push(path + ': unknown key "' + k + '"'); }); }
function vText(t, path, max, err) { if (!isObj(t)) { err.push(path + ': text object required'); return; } onlyKeys(t, ['ug', 'en'], path, err); ['ug', 'en'].forEach(l => { if (!safeText(t[l], max)) err.push(path + '.' + l + ': invalid text'); }); }
function vReward(r, path, err) {
  if (!isObj(r)) { err.push(path + ': reward object required'); return; }
  onlyKeys(r, REWARD_KEYS, path, err); let any = false;
  REWARD_KEYS.forEach(k => { if (r[k] !== undefined) { if (!isInt(r[k], 1, LIMITS.claimCap[k])) err.push(path + '.' + k + ': 1..' + LIMITS.claimCap[k]); else any = true; } });
  if (!any) err.push(path + ': empty reward');
}
function vTime(s, path, err) { if (typeof s !== 'string' || s.length > 32 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s) || isNaN(Date.parse(s))) { err.push(path + ': ISO UTC time required'); return NaN; } return Date.parse(s); }
function validateDefinition(doc) {
  const err = [];
  if (!isObj(doc)) return {ok: false, errors: ['not an object']};
  onlyKeys(doc, ['format', 'schema', 'contentVersion', 'minClient', 'publishedAt', 'events', 'assets'], 'doc', err);
  if (doc.format !== FORMAT) err.push('format');
  if (doc.schema !== SCHEMA) return {ok: false, incompatible: 'schema', errors: ['unsupported schema ' + doc.schema]};
  if (!isInt(doc.contentVersion, 1, 1e9)) err.push('contentVersion');
  if (!isInt(doc.minClient, 1, 1e6)) err.push('minClient');
  else if (doc.minClient > ENGINE_VERSION) return {ok: false, incompatible: 'client', errors: ['needs client ' + doc.minClient]};
  vTime(doc.publishedAt, 'publishedAt', err);
  if (!Array.isArray(doc.events) || doc.events.length > LIMITS.maxEvents) err.push('events: array up to ' + LIMITS.maxEvents);
  if (!Array.isArray(doc.assets) || doc.assets.length > LIMITS.maxAssets) err.push('assets: array up to ' + LIMITS.maxAssets);
  const ids = {};
  (Array.isArray(doc.events) ? doc.events : []).forEach((e, i) => {
    const p = 'events[' + i + ']';
    if (!isObj(e)) { err.push(p + ': object'); return; }
    onlyKeys(e, ['id', 'revision', 'title', 'desc', 'start', 'end', 'minClient', 'eligibility', 'claimGraceDays', 'objectives', 'completionReward'], p, err);
    if (typeof e.id !== 'string' || !ID.test(e.id) || ids[e.id]) err.push(p + '.id'); else ids[e.id] = 1;
    if (!isInt(e.revision, 1, 1e6)) err.push(p + '.revision');
    vText(e.title, p + '.title', 60, err); vText(e.desc, p + '.desc', LIMITS.maxText, err);
    const s = vTime(e.start, p + '.start', err), en = vTime(e.end, p + '.end', err);
    if (!isNaN(s) && !isNaN(en) && (en <= s || en - s > LIMITS.maxSpanDays * 864e5)) err.push(p + ': end must be after start, within ' + LIMITS.maxSpanDays + ' days');
    if (!isInt(e.minClient, 1, 1e6)) err.push(p + '.minClient');
    if (!isObj(e.eligibility)) err.push(p + '.eligibility'); else { onlyKeys(e.eligibility, ['minLevel'], p + '.eligibility', err); if (!isInt(e.eligibility.minLevel, 1, 500)) err.push(p + '.eligibility.minLevel'); }
    if (!isInt(e.claimGraceDays, 0, LIMITS.maxGraceDays)) err.push(p + '.claimGraceDays');
    if (!Array.isArray(e.objectives) || e.objectives.length < 1 || e.objectives.length > LIMITS.maxObjectives) err.push(p + '.objectives: 1..' + LIMITS.maxObjectives);
    else { const oid = {}; e.objectives.forEach((o, j) => { const q = p + '.objectives[' + j + ']';
      if (!isObj(o)) { err.push(q + ': object'); return; }
      onlyKeys(o, ['id', 'type', 'target', 'reward'], q, err);
      if (typeof o.id !== 'string' || !ID.test(o.id) || oid[o.id]) err.push(q + '.id'); else oid[o.id] = 1;
      if (OBJECTIVE_TYPES.indexOf(o.type) < 0) err.push(q + '.type: not an allowed objective type');
      if (!isInt(o.target, 1, 5000)) err.push(q + '.target'); vReward(o.reward, q + '.reward', err); }); }
    if (e.completionReward !== undefined) vReward(e.completionReward, p + '.completionReward', err);
  });
  const aid = {};
  (Array.isArray(doc.assets) ? doc.assets : []).forEach((a, i) => { const p = 'assets[' + i + ']';
    if (!isObj(a)) { err.push(p); return; } onlyKeys(a, ['id', 'path', 'bytes', 'sha256'], p, err);
    if (typeof a.id !== 'string' || !ID.test(a.id) || aid[a.id]) err.push(p + '.id'); else aid[a.id] = 1;
    if (typeof a.path !== 'string' || !/^content\/[a-z0-9][a-z0-9._\/-]{0,80}\.png$/.test(a.path) || a.path.indexOf('..') >= 0 || a.path.indexOf('//') >= 0) err.push(p + '.path');
    if (!isInt(a.bytes, 1, LIMITS.maxAssetBytes)) err.push(p + '.bytes'); if (typeof a.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.sha256)) err.push(p + '.sha256'); });
  return err.length ? {ok: false, errors: err.slice(0, 12)} : {ok: true, errors: [], def: doc};
}

/* ---------------- fetching (bounded; every failure resolves to {ok:false}, never throws) ---------------- */
async function fetchDefinition(url, o) {
  o = o || {}; const f = o.fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!f) return {ok: false, reason: 'no-fetch'};
  const secure = /^https:\/\//i.test(url) || (o.allowInsecureLocal && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) || (!/^[a-z]+:/i.test(url) && !/^\/\//.test(url));   // https, or same-origin relative
  if (!secure) return {ok: false, reason: 'insecure-url'};
  let timer, ctl = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    const t = new Promise((_, rej) => { timer = setTimeout(() => { if (ctl) ctl.abort(); rej(new Error('timeout')); }, o.timeoutMs || LIMITS.fetchTimeoutMs); });
    const res = await Promise.race([f(url, {cache: 'no-cache', credentials: 'same-origin', signal: ctl && ctl.signal}), t]);
    if (!res || !res.ok) return {ok: false, reason: 'http-' + (res && res.status)};
    const len = +(res.headers && res.headers.get && res.headers.get('content-length') || 0); if (len > LIMITS.maxBytes) return {ok: false, reason: 'too-large'};
    const text = await Promise.race([res.text(), t]); if (text.length > LIMITS.maxBytes) return {ok: false, reason: 'too-large'};
    let doc; try { doc = JSON.parse(text); } catch (e) { return {ok: false, reason: 'not-json'}; }
    const v = validateDefinition(doc); if (!v.ok) return {ok: false, reason: v.incompatible ? 'incompatible-' + v.incompatible : 'invalid', errors: v.errors};
    const d = res.headers && res.headers.get && res.headers.get('date'); const sms = d ? Date.parse(d) : NaN;
    return {ok: true, def: v.def, serverTime: isNaN(sms) ? null : sms};
  } catch (e) { return {ok: false, reason: String(e && e.message || e).slice(0, 40)}; } finally { clearTimeout(timer); }
}
// pick what to use: a remote document wins only if it is valid AND not older than the cached one (replay/rollback protection)
function choose(remote, cached) {
  if (remote && remote.ok && (!cached || remote.def.contentVersion >= cached.contentVersion)) return {def: remote.def, source: 'remote'};
  if (cached) return {def: cached, source: 'cache'};
  return {def: BUNDLED, source: 'bundled'};
}

/* ---------------- event state lives INSIDE the main save document (S.ev) ----------------
   Why: a claim must change the wallet and the claim record together. They are one JSON document written with ONE verified write, so a crash
   or failed write leaves either "not claimed, not paid" or "claimed AND paid" — never a half state, and nothing needs a recovery log.
   Export / import / backup / restore carry progress + claims together with the wallet. This module never touches storage except a tiny
   device-local clock guard. It mutates the object the host gives it; the host persists (game.js: one save()).
   ev = {v:1, events:{[id]:{rev,activatedAt,start,end,graceUntil,title,desc,objectives:[{id,type,target,reward}],completionReward,progress:{},claims:{[objId|'*']:{t,legacy?}}}}} */
function strictEventState(ev) {                      // validation + clean copy of S.ev (used by save.js for load/import/export)
  const err = (m) => ({ok: false, error: m});
  if (!isObj(ev) || ev.v !== 1 || !isObj(ev.events)) return err('ev');
  onlyKeys(ev, ['v', 'events'], 'ev', []); if (Object.keys(ev).some(k => k !== 'v' && k !== 'events')) return err('ev-keys');
  const ids = Object.keys(ev.events); if (ids.length > 12) return err('ev-count');
  const out = {v: 1, events: {}};
  for (const id of ids) {
    const e = ev.events[id]; if (!ID.test(id) || !isObj(e)) return err('ev-id');
    const keys = ['rev', 'activatedAt', 'start', 'end', 'graceUntil', 'title', 'desc', 'objectives', 'completionReward', 'progress', 'claims'];
    if (Object.keys(e).some(k => keys.indexOf(k) < 0)) return err('ev-field');
    if (!isInt(e.rev, 1, 1e6) || !isInt(e.activatedAt, 0, 4e12) || !isInt(e.start, 0, 4e12) || !isInt(e.end, 0, 4e12) || !isInt(e.graceUntil, 0, 4e12) || e.end <= e.start || e.graceUntil < e.end) return err('ev-time');
    const t = [], d = []; vText(e.title, 't', 60, t); vText(e.desc, 'd', LIMITS.maxText, d); if (t.length || d.length) return err('ev-text');
    if (!Array.isArray(e.objectives) || e.objectives.length < 1 || e.objectives.length > LIMITS.maxObjectives) return err('ev-objs');
    const oid = {}, objs = [];
    for (const o of e.objectives) {
      if (!isObj(o) || Object.keys(o).some(k => ['id', 'type', 'target', 'reward'].indexOf(k) < 0) || typeof o.id !== 'string' || !ID.test(o.id) || oid[o.id] || OBJECTIVE_TYPES.indexOf(o.type) < 0 || !isInt(o.target, 1, 5000)) return err('ev-obj');
      const re = []; vReward(o.reward, 'r', re); if (re.length) return err('ev-reward'); oid[o.id] = 1;
      objs.push({id: o.id, type: o.type, target: o.target, reward: JSON.parse(JSON.stringify(o.reward))});
    }
    let comp = null; if (e.completionReward !== null && e.completionReward !== undefined) { const re = []; vReward(e.completionReward, 'r', re); if (re.length) return err('ev-reward'); comp = JSON.parse(JSON.stringify(e.completionReward)); }
    if (!isObj(e.progress) || !isObj(e.claims)) return err('ev-maps');
    const progress = {}, claims = {};
    for (const k of Object.keys(e.progress)) { const ob = objs.find(x => x.id === k); if (!ob || !isInt(e.progress[k], 0, ob.target)) return err('ev-progress'); progress[k] = e.progress[k]; }
    for (const k of Object.keys(e.claims)) { const cl = e.claims[k]; if ((k !== '*' && !oid[k]) || !isObj(cl) || !isInt(cl.t, 0, 4e12) || Object.keys(cl).some(x => x !== 't' && x !== 'legacy') || (cl.legacy !== undefined && cl.legacy !== true)) return err('ev-claim'); claims[k] = cl.legacy ? {t: cl.t, legacy: true} : {t: cl.t}; }
    out.events[id] = {rev: e.rev, activatedAt: e.activatedAt, start: e.start, end: e.end, graceUntil: e.graceUntil, title: {ug: e.title.ug, en: e.title.en}, desc: {ug: e.desc.ug, en: e.desc.en}, objectives: objs, completionReward: comp, progress, claims};
  }
  return {ok: true, value: out};
}
function summaryOf(ev) {                              // for the import/restore confirmation table
  let done = 0, claimed = 0; if (isObj(ev) && isObj(ev.events)) Object.keys(ev.events).forEach(id => { const e = ev.events[id]; e.objectives.forEach(o => { if ((e.progress[o.id] || 0) >= o.target) done++; }); claimed += Object.keys(e.claims).length; });
  return {evDone: done, evClaimed: claimed};
}
// one-time conversion of the earlier separate-key state (atelierLueur.events.v1, build 90ce0fc). A legacy claim may or may not have been paid
// (the old two-write design could lose it), so it is marked legacy and is never re-paid.
function migrateLegacy(raw) {
  let p; try { p = JSON.parse(raw); } catch (e) { return null; }
  if (!isObj(p) || p.v !== 1 || !isObj(p.events)) return null;
  const ev = {v: 1, events: {}};
  for (const id of Object.keys(p.events)) { const e = p.events[id]; if (!isObj(e) || !Array.isArray(e.objectives)) return null;
    const claims = {}; Object.keys(isObj(e.claimed) ? e.claimed : {}).forEach(k => { if (e.claimed[k]) claims[k] = {t: 0, legacy: true}; }); if (e.doneClaimed) claims['*'] = {t: 0, legacy: true};
    ev.events[id] = {rev: e.rev, activatedAt: e.activatedAt, start: e.start, end: e.end, graceUntil: e.graceUntil, title: e.title, desc: e.desc, objectives: e.objectives, completionReward: e.completionReward || null, progress: isObj(e.progress) ? e.progress : {}, claims}; }
  const v = strictEventState(ev); return v.ok ? v.value : null;
}
function createEvents(host, o) {
  o = o || {}; const now0 = o.now || Date.now; const clockStore = host.clock || null;
  let clk = {lastSeen: 0, skew: 0, at: 0};
  try { const r = clockStore && clockStore.get(); if (r) { const p = JSON.parse(r); if (isObj(p)) clk = {lastSeen: +p.lastSeen || 0, skew: +p.skew || 0, at: +p.at || 0}; } } catch (e) {}
  let lastClockWrite = 0;
  function saveClock(force) { const t = now0(); if (!clockStore || (!force && t - lastClockWrite < 60000)) return; lastClockWrite = t; try { clockStore.set(JSON.stringify(clk)); } catch (e) {} }
  // trusted "now": never goes backwards; a recent server Date that shows the device clock far off applies its skew. Heuristic, NOT authoritative.
  function nowMs() {
    let t = now0(); if (Math.abs(clk.skew) > 300000 && t - clk.at < 14 * 864e5 && t >= clk.at) t += clk.skew;
    if (t < clk.lastSeen) t = clk.lastSeen; else { clk.lastSeen = t; saveClock(false); } return t;
  }
  function setServerTime(sms) { if (sms) { const d = now0(); clk.skew = sms - d; clk.at = d; saveClock(true); } }
  const st = () => host.get();
  function eligible(ev, level) { return ev.minClient <= ENGINE_VERSION && level >= ev.eligibility.minLevel; }
  // Activates new eligible, in-window events once; objective list and rewards are SNAPSHOTTED (the player's reward contract).
  // Returns true when S.ev changed (the host then saves). S.ev is only created when there is something to store.
  function sync(def, level) {
    const t = nowMs(); let changed = false;
    (def.events || []).forEach(ev => {
      const s = Date.parse(ev.start), e = Date.parse(ev.end); const cur = st();
      if ((cur && cur.events[ev.id]) || t < s || t >= e || !eligible(ev, level)) return;
      const root = host.ensure();
      root.events[ev.id] = {rev: ev.revision, activatedAt: t, start: s, end: e, graceUntil: e + ev.claimGraceDays * 864e5, title: ev.title, desc: ev.desc,
        objectives: ev.objectives.map(x => ({id: x.id, type: x.type, target: x.target, reward: x.reward})), completionReward: ev.completionReward || null, progress: {}, claims: {}};
      changed = true;
    });
    return changed;
  }
  function onCount(type, n) {
    const root = st(); if (!root) return false; const t = nowMs(); let changed = false;
    Object.keys(root.events).forEach(id => { const e = root.events[id]; if (t >= e.end) return;           // progress only while the event runs
      e.objectives.forEach(ob => { if (ob.type !== type || (e.progress[ob.id] || 0) >= ob.target) return; e.progress[ob.id] = Math.min(ob.target, (e.progress[ob.id] || 0) + n); changed = true; }); });
    return changed;
  }
  const status = (e, t) => t < e.end ? 'active' : t < e.graceUntil ? 'ended' : 'expired';
  function view() {
    const root = st(); if (!root) return []; const t = nowMs();
    return Object.keys(root.events).map(id => { const e = root.events[id], s = status(e, t); if (s === 'expired') return null;
      const obs = e.objectives.map(ob => { const p = e.progress[ob.id] || 0; return {id: ob.id, type: ob.type, target: ob.target, progress: p, done: p >= ob.target, claimed: !!e.claims[ob.id], reward: ob.reward}; });
      const allClaimed = obs.every(x => x.claimed);
      return {id, rev: e.rev, status: s, title: e.title, desc: e.desc, end: e.end, graceUntil: e.graceUntil, objectives: obs, completion: e.completionReward ? {reward: e.completionReward, ready: obs.every(x => x.done) && allClaimed, claimed: !!e.claims['*']} : null};
    }).filter(Boolean);
  }
  // Marks the claim INSIDE the document the host passed in and returns the reward. The host applies the reward to the same document and
  // persists it with ONE write; if that write fails the host discards its working copy, so the claim flag is discarded with the wallet change.
  function claim(eventId, objectiveId) {
    const root = st(); const e = root && root.events[eventId]; const t = nowMs(); if (!e) return {ok: false, reason: 'unknown'}; if (status(e, t) === 'expired') return {ok: false, reason: 'expired'};
    if (objectiveId === '*') {
      if (!e.completionReward) return {ok: false, reason: 'none'}; if (e.claims['*']) return {ok: false, reason: 'already'};
      if (!e.objectives.every(ob => (e.progress[ob.id] || 0) >= ob.target && e.claims[ob.id])) return {ok: false, reason: 'not-ready'};
      e.claims['*'] = {t}; return {ok: true, reward: e.completionReward};
    }
    const ob = e.objectives.find(x => x.id === objectiveId); if (!ob) return {ok: false, reason: 'unknown'};
    if (e.claims[ob.id]) return {ok: false, reason: 'already'}; if ((e.progress[ob.id] || 0) < ob.target) return {ok: false, reason: 'not-ready'};
    e.claims[ob.id] = {t}; return {ok: true, reward: ob.reward};
  }
  const claimable = () => view().reduce((n, e) => n + e.objectives.filter(o => o.done && !o.claimed).length + (e.completion && e.completion.ready && !e.completion.claimed ? 1 : 0), 0);
  function prune() { const root = st(); if (!root) return false; const t = nowMs(); let ch = false; Object.keys(root.events).forEach(id => { if (t > root.events[id].graceUntil + 30 * 864e5) { delete root.events[id]; ch = true; } }); return ch; }
  return {sync, onCount, view, claim, claimable, prune, setServerTime, nowMs};
}
window.CONTENT = {ENGINE_VERSION, LIMITS, OBJECTIVE_TYPES, BUNDLED, validateDefinition, fetchDefinition, choose, createEvents, strictEventState, summaryOf, migrateLegacy};
})();
