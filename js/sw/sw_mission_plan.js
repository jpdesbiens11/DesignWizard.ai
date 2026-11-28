/* DynamiteOrbit.ai — Logiciel : THE PLAN OF THE MISSIONS (JP, 27 novembre 2026 : « que les missions puissent être déplacées et réordonnées dans la
   fenêtre Missions, être classées de fonctionnelle vers performance puis par safety / corner case / malfunction… voir les tags des requis dans le
   graph temporel du profil de mission… disable / enable Mission… attribuer un niveau de difficulté à la mission — une priorité de conception, du
   plus facile au plus difficile »).
   Each mission written from the requirements (sw/sw_req_missions.js) has a CLASS — Functional, Performance, Safety, Corner cases, Malfunction,
   then the holdout set — proposed from what it is and from the category the requirements it aims at carry in DynamiteAgile ; a place in its
   class ; On or Off (Off : kept, never played) ; a DIFFICULTY from 1 (easy) to 5 — the order in which the design takes them on. A difficulty the
   tool proposes is an example until a person sets it. The plan is kept on the software (`design.missionPlan`), each change one undoable step ;
   the AI loop never changes it (the yardstick). The PROFILE GRAPH of a mission : what it imposes on the bench, lane by lane (current, the hottest
   cell, the cell block held by the cell emulator), and, dashed on each lane, the limits of the requirements it aims at, tagged with their key.
   What it follows : a test plan's suites ordered by technique, a reorderable list (drag, or ↑ ↓ on the grip), a priority per test case. Pure. */

import { keyOf, forDiscipline } from "../core/reqs.js";
import { oraclesFor } from "../core/req_oracle.js";

/* the oracles of the software's requirements (the same list as sw/sw_req_missions.js reqOracles — written here, the plan is applied there) */
const oraclesOf = (R) => { const out = []; if (!R) return out; for (const r of forDiscipline(R, "sw").reqs) oraclesFor(R, r).list.forEach((o, n) => out.push({ key: keyOf(r), n, o })); return out; };

/** The classes, in the order JP gave them : a colour, a pictogram, the name of the trade. */
export const CLASSES = [
  { key: "functional", fr: "Functional", says: "Le produit fait ce qu'il doit, dans toutes ses limites.", color: "#16a34a", icon: "check" },
  { key: "performance", fr: "Performance", says: "Ce qu'il doit atteindre et tenir.", color: "#0891b2", icon: "flow" },
  { key: "safety", fr: "Safety", says: "Une limite franchie : le logiciel doit protéger.", color: "#dc2626", icon: "warning" },
  { key: "corner", fr: "Corner cases", says: "Deux bords à la fois.", color: "#d97706", icon: "ruler" },
  { key: "malfunction", fr: "Malfunction", says: "Ce que le banc casse exprès : une panne, un capteur, une liaison.", color: "#7c3aed", icon: "bolt" },
  { key: "reserve", fr: "Lot de réserve", says: "Holdout set : joué à chaque campagne, jamais montré à une IA.", color: "#475569", icon: "lock" },
];
const RANK = Object.fromEntries(CLASSES.map((c, i) => [c.key, i]));
export const classOf = (k) => CLASSES[RANK[k]] || CLASSES[0];
/** The difficulty of a mission : the order in which the design takes it on. */
export const LEVELS = [
  { n: 1, fr: "Facile", color: "#16a34a" }, { n: 2, fr: "Simple", color: "#65a30d" }, { n: 3, fr: "Moyen", color: "#ca8a04" }, { n: 4, fr: "Difficile", color: "#ea580c" }, { n: 5, fr: "Très difficile", color: "#dc2626" },
];
const PROPOSED = { functional: 1, performance: 2, safety: 3, corner: 4, malfunction: 4, reserve: 5 };

/** The class the tool proposes for a mission : from what it is, and for a limit from the category of the requirements it aims at. */
export function defaultClass(p, R) {
  const o = p.origin || "project";
  if (o === "reserve") return "reserve"; if (o === "fault") return "malfunction"; if (o === "corner") return "corner"; if (o === "envelope") return "performance";
  if (o === "limit") { const cats = (p.keys || []).map((k) => { const r = R && (R.rows || []).find((x) => keyOf(x) === k); return String((r && r.category) || ""); });
    return cats.some((c) => /safety|sécurité/i.test(c)) ? "safety" : cats.some((c) => /performance/i.test(c)) ? "performance" : "functional"; }
  return "functional";
}
/** The plan a software keeps (or an empty one). */
export const planOf = (d) => (d && d.missionPlan) || {};
/** The missions with their plan : class, On / Off, difficulty (and whether a person set it), in their order — class after class, then the place
    a person gave, then the order they were written in. */
export function applyPlan(list, plan = {}, R = null) {
  const ord = new Map((plan.order || []).map((id, i) => [id, i])), off = new Set(plan.off || []), lv = plan.level || {}, cl = plan.cls || {};
  const out = list.map((p, i) => { const own = defaultClass(p, R), cls = p.origin === "reserve" ? "reserve" : cl[p.id] && cl[p.id] !== "reserve" ? cl[p.id] : own;
    return { ...p, cls, off: off.has(p.id), level: lv[p.id] || PROPOSED[cls] || 3, levelSure: !!lv[p.id], i }; });
  return out.sort((a, b) => RANK[a.cls] - RANK[b.cls] || (ord.has(a.id) ? ord.get(a.id) : 1e6 + a.i) - (ord.has(b.id) ? ord.get(b.id) : 1e6 + b.i));
}
const copy = (plan) => JSON.parse(JSON.stringify(plan || {}));
/** A mission moved : into a class (the holdout set keeps its own), before another (or at the end). list : the missions as shown (applyPlan). → plan */
export function moveMission(plan, list, id, cls, before = null) {
  const P = copy(plan), me = list.find((p) => p.id === id); if (!me) return P;
  const to = me.cls === "reserve" || cls === "reserve" ? me.cls : cls; P.cls = P.cls || {};
  if (to !== defaultClass(me, null) || P.cls[id]) P.cls[id] = to;
  const ids = list.map((p) => p.id).filter((x) => x !== id), at = before && ids.includes(before) ? ids.indexOf(before) : (() => { let k = -1; ids.forEach((x, i) => { const q = list.find((p) => p.id === x); if (q && RANK[q.cls] <= RANK[to]) k = i; }); return k + 1; })();
  ids.splice(at, 0, id); P.order = ids; return P;
}
/** One step up or down inside its class (the keyboard : ↑ ↓ on the grip). → plan */
export function nudgeMission(plan, list, id, step) {
  const me = list.find((p) => p.id === id); if (!me) return copy(plan);
  const same = list.filter((p) => p.cls === me.cls), i = same.indexOf(me), j = i + step; if (j < 0 || j >= same.length) return copy(plan);
  const before = step < 0 ? same[j].id : same[j + 1] ? same[j + 1].id : null;
  return moveMission(plan, list, id, me.cls, before || (step > 0 ? nextAfter(list, same[j]) : null));
}
const nextAfter = (list, p) => { const k = list.indexOf(p); return list[k + 1] ? list[k + 1].id : null; };
/** On or Off. → plan */
export function setOff(plan, id, off) { const P = copy(plan), s = new Set(P.off || []); if (off) s.add(id); else s.delete(id); P.off = [...s]; return P; }
/** The difficulty a person sets (1 to 5). → plan */
export function setLevel(plan, id, n) { const P = copy(plan); P.level = { ...(P.level || {}), [id]: Math.min(5, Math.max(1, Math.round(n))) }; return P; }
/** Every proposed difficulty confirmed as it is. → plan */
export function confirmLevels(plan, list) { let P = copy(plan); for (const p of list) if (!p.levelSure) P = setLevel(P, p.id, p.level); return P; }
/** Each class ordered from the easiest to the hardest — the design's priority. → plan */
export function sortByLevel(plan, list) { const P = copy(plan); P.order = [...list].sort((a, b) => RANK[a.cls] - RANK[b.cls] || a.level - b.level || list.indexOf(a) - list.indexOf(b)).map((p) => p.id); return P; }

/* ---------- the profile graph ---------- */
export const LANES = {
  i: { label: "Courant imposé", unit: "A", note: "+ décharge, − charge" },
  t: { label: "Cell la plus chaude", unit: "°C", note: "chaleur du dehors" },
  v: { label: "Cell block tenu", unit: "V", note: "cell emulator" },
};
/** What a mission imposes on the bench, lane by lane, as steps in time (s) ; C1 : 1 C in A ; amb : the ambient (°C).
    → { end, lanes: [{ key, label, unit, note, pts: [[t, value | null]] }], marks: [{ t, title, cross }] } */
export function profileSeries(p, C1 = 36, amb = 25) {
  const st = { mode: "rest", a: 0, push: 0, cMax: 2, heatTo: 0, amb, cellHi: 0, cellLo: 0 }, pts = { i: [], t: [], v: [] }, used = { i: false, t: false, v: false }, marks = [];
  const val = () => ({ i: st.mode === "discharge" ? st.a : st.mode === "charge" ? -(st.push || st.cMax * C1) : 0, t: st.heatTo || st.amb, v: st.cellHi || st.cellLo || null });
  for (const e of p.events || []) { if (e.hidden) continue; const t = e.t / 1000, P = e.plant || {};
    Object.assign(st, P);
    if (P.mode || P.a !== undefined || P.push !== undefined || P.cMax !== undefined) used.i = true; if (P.heatTo) used.t = true; if (P.cellHi || P.cellLo) used.v = true;
    const v = val(); for (const k of ["i", "t", "v"]) pts[k].push([t, v[k]]);
    if (e.title) marks.push({ t, title: e.title, cross: !!e.cross || !!e.target, set: !!(e.set && Object.keys(e.set).length) }); }
  const end = (p.events || []).length ? p.events[p.events.length - 1].t / 1000 : 0;
  return { end, marks, lanes: ["i", "t", "v"].filter((k) => used[k]).map((k) => ({ key: k, ...LANES[k], pts: pts[k] })) };
}
/* which lane draws a quantity of the bench */
const LANE_OF = { current: "i", current_abs: "i", temp_max: "t", vblock_max: "v", vblock_min: "v" };
/** The limits of the requirements a mission aims at, for its graph : one dashed line per value, tagged with the key, coloured by its verdict on
    this mission when the campaign gave one. C : the last campaign or null. → [{ lane, value, key, n, verdict }] */
export function tagLines(p, R, C = null) {
  const keys = new Set(p.keys || []), aims = p.aims ? new Set(p.aims.map((a) => `${a.key}#${a.n}`)) : null, out = [], put = (x, sig, v) => { const lane = LANE_OF[sig]; if (!lane || v === undefined) return; const row = C && C.rows.find((r) => r.key === x.key && r.n === x.n);
    out.push({ lane, value: v, key: x.key, n: x.n, verdict: row ? row.by[p.id] || "none" : null }); if (sig === "current_abs") out.push({ lane, value: -v, key: x.key, n: x.n, verdict: row ? row.by[p.id] || "none" : null }); };
  for (const x of oraclesOf(R).filter((y) => (aims ? aims.has(`${y.key}#${y.n}`) : keys.has(y.key)))) { const o = x.o;      // the limits it aims at, else every limit of its requirements
    if (o.kind === "reaction") { for (const c of o.if) put(x, c.signal, c.value); }
    else { if (o.min !== undefined) put(x, o.signal, o.min); if (o.max !== undefined) put(x, o.signal, o.max); } }
  return out;
}
