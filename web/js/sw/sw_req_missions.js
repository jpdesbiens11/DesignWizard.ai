/* DynamiteOrbit.ai — Logiciel : THE MISSIONS WRITTEN FROM THE REQUIREMENTS (JP, 27 novembre 2026 : « toutes les missions de l'équipement — les
   variations in / out que le logiciel doit tenir dans les bornes des requis » ; choix par menu : « les missions viennent des requis » ; « une
   panoplie de profils qui couvre tout ce qui est généralement découpé en sous-étapes… specs, limites, corner cases, performances et safety »).
   The yardstick is read from the requirements, never from the software : each limit a requirement sets (its oracle, core/req_oracle.js) gets
   a mission that APPROACHES it, CROSSES it by a clear margin and holds it there, then BRINGS IT BACK — a voltage by the CELL EMULATOR of the bench
   (sw/sw_pack.js : a BMS bench holds a cell block at a voltage, it does not creep up on it by one mV), a temperature by heat from outside, a
   current by the load or the charger. Two limits on the same quantity at the same value make one mission. Beside them :
     nominal      a charge and a discharge inside every limit — nothing may react wrongly ;
     envelope     what the product must reach (« fournir 360 A en continu ») ;
     corner       two edges at once : the largest current at the edge of the temperature that removes service ;
     fault        what the bench injects : the round-robin of the CORE lost, the 12 V gone, the contactor's auxiliary contact stuck ;
     project      the duty cycles the project keeps on its bench (design.profiles) ;
     reserve      a HOLDOUT SET — missions drawn at random from the envelope (a seed read from the requirements : the same lot until they change),
                  played at every campaign, never shown to an AI : a version tuned to the missions it sees is caught on those it does not.
   What a mission cannot do is said (GAPS) : the bench records one line a second — a crossing shorter than a second is not played. What it
   follows : requirements-based testing (each limit : nominal, boundary, beyond, recovery), fault injection, and a holdout set as in machine
   learning. The standards were not read. Pure. */

import { packStart, plantOf, until, missionProfiles } from "./sw_pack.js";
import { profilesOf } from "./sw_story.js";
import { liveInputs } from "./sw_live.js";
import { forDiscipline, keyOf } from "../core/reqs.js";
import { oraclesFor, oracleText, SIGNALS } from "../core/req_oracle.js";

/** The kinds of missions, in the order the screen shows them : a colour, a pictogram, a short name. */
export const ORIGINS = {
  nominal: { fr: "Nominal", en: "Nominal", color: "#16a34a", icon: "check", says: "Dans toutes les limites : rien ne doit réagir à tort." },
  limit: { fr: "Limites des exigences", en: "Requirement limits", color: "#2563eb", icon: "report", says: "Chaque limite approchée, franchie et tenue, puis revenue." },
  envelope: { fr: "Enveloppe", en: "Operating envelope", color: "#0891b2", icon: "flow", says: "Ce que le produit doit atteindre." },
  corner: { fr: "Corner cases", en: "Corner cases", color: "#d97706", icon: "warning", says: "Deux bords à la fois." },
  fault: { fr: "Pannes injectées", en: "Fault injection", color: "#dc2626", icon: "bolt", says: "Ce que le banc casse exprès." },
  project: { fr: "Profils du projet", en: "Project duty cycles", color: "#7c3aed", icon: "folder", says: "Les duty cycles que le projet garde sur son banc." },
  reserve: { fr: "Lot de réserve", en: "Holdout set", color: "#475569", icon: "lock", says: "Joué à chaque campagne, jamais montré à une IA." },
};
/** What the missions do not do, said on the screen. */
export const GAPS = [
  "Le banc relève une ligne par seconde : une limite franchie moins d'une seconde n'est pas jouée.",
  "Une exigence que la machine ne lit pas n'a pas de mission de limite : les pannes injectées l'exercent, sans la juger.",
  "Le module est simulé aux valeurs typiques : une mission dit ce que fait le modèle, pas le produit.",
];

const fr = (x, n = 2) => String(+(+x).toFixed(n)).replace(".", ",");
const ev = (t, id, title, says, more = {}) => ({ t: Math.round(t * 1000), id, title, says, set: {}, ...more });
const OFF = { push: 0, cvFail: 0, heatTo: 0, cellHi: 0, cellLo: 0 };
const MODE_FR = { charge: "charge", discharge: "décharge" };

/* ---------- how the bench moves each quantity ---------- */
/* in : how far short of the limit the approach stops ; out : how far past it the crossing goes ; rel : a share of the limit, not a step */
const DRIVE = {
  vblock_max: { in: 0.02, out: 0.03, unit: "V", put: (v) => ({ cellHi: +v.toFixed(3) }), off: { cellHi: 0 }, what: "Cell emulator : le cell block le plus haut", mode: "charge" },
  vblock_min: { in: 0.02, out: 0.05, unit: "V", put: (v) => ({ cellLo: +v.toFixed(3) }), off: { cellLo: 0 }, what: "Cell emulator : le cell block le plus bas", mode: "discharge" },
  temp_max: { in: 3, out: 3, unit: "°C", put: (v) => ({ heatTo: +v.toFixed(1) }), off: { heatTo: 0 }, what: "Chaleur du dehors : la cell la plus chaude", mode: "discharge", slow: true },
  current_abs: { rel: true, in: 0.05, out: 0.1, unit: "A", what: "Courant", modes: ["discharge", "charge"] },
};
const currentPut = (mode, a, C1) => (mode === "charge" ? { push: +Math.abs(a).toFixed(1) } : { a: +Math.abs(a).toFixed(1) });
const currentOff = (mode, C1) => (mode === "charge" ? { push: 0 } : { a: C1 });

/** The oracles of the software's requirements, each with its requirement. → [{ key, n, o, sure }] */
export function reqOracles(R) {
  const out = []; if (!R) return out;
  for (const r of forDiscipline(R, "sw").reqs) { const O = oraclesFor(R, r); O.list.forEach((o, n) => out.push({ key: keyOf(r), n, o, sure: O.sure })); }
  return out;
}
/* the limits to play : one per quantity, direction, value and way — the requirements that share it are named together */
function limitsOf(list) {
  const by = new Map(), add = (signal, op, value, mode, x, hold = 0, within = 0) => {
    const D = DRIVE[signal]; if (!D) return false;
    for (const m of mode ? [mode] : D.modes || [D.mode]) { const k = `${signal}|${op}|${value}|${m}`;
      if (!by.has(k)) by.set(k, { signal, op, value, mode: m, keys: [], items: [], hold: 0, within: 0 });
      const T = by.get(k); if (!T.keys.includes(x.key)) T.keys.push(x.key); T.items.push(x); T.hold = Math.max(T.hold, hold); T.within = Math.max(T.within, within || 0); }
    return true;
  };
  const none = [];
  for (const x of list) { const o = x.o;
    if (o.kind === "bound") { if (o.min !== undefined) add(o.signal, "<", o.min, "", x); if (o.max !== undefined) add(o.signal, ">", o.max, "", x); }
    else if (o.kind === "reaction") { const c = o.if.find((q) => DRIVE[q.signal]); if (!c || !add(c.signal, c.op, c.value, o.mode || "", x, o.hold || 0, o.within || 0)) none.push(x); } }
  return { tests: [...by.values()], none };
}
/* the start of a mission in a way : the module in service at 1 C */
function setup(mode, C1, amb, start) {
  return mode === "charge" ? { mode: "charge", start: start ?? 3.6, cMax: 1, a: 0, amb, ...OFF } : { mode: "discharge", start: start ?? 3.9, a: C1, amb, ...OFF };
}
const startText = (mode, C1, start) => `Le module est en service : ${mode === "charge" ? "le chargeur" : "la charge"} à 1 C (${fr(C1, 0)} A), cell blocks à ${fr(start, 2)} V au repos.`;
const ackEv = (t, pl, id = "ack") => (pl.ack ? [ev(t, id, "Acquittement", "Une personne acquitte le défaut, la cause disparue.", { pulse: { [pl.ack]: 300 } })] : []);

/** One mission per limit of the requirements : approach, crossing held, return, acknowledgement. */
function limitMissions(tests, C1, amb, pl) {
  return tests.map((T) => {
    const D = DRIVE[T.signal], up = T.op === ">", u = D.unit, cur = T.signal === "current_abs";
    const near = D.rel ? T.value * (1 - D.in) : up ? T.value - D.in : T.value + D.in, past = D.rel ? T.value * (1 + D.out) : up ? T.value + D.out : T.value - D.out;
    const put = (v) => (cur ? currentPut(T.mode, v, C1) : D.put(v)), back = cur ? currentOff(T.mode, C1) : D.off;
    const what = cur ? (T.mode === "charge" ? "Le chargeur pousse" : "La charge tire") : D.what, S = SIGNALS[T.signal];
    const go = D.slow ? 180 : 90, hold = D.slow ? 180 : Math.max(60, Math.ceil(((T.hold || 0) + (T.within || 0)) / 1000) + 30), rest = D.slow ? 240 : 120;
    /* a temperature that must fall below a limit : it is brought above first, then the heat stops */
    const cool = T.signal === "temp_max" && !up, start = T.mode === "charge" ? 3.6 : 3.9;
    const expect = [...new Set(T.items.map((x) => `${x.key} : ${oracleText(x.o)}`))].join(" ; ");
    const ev0 = ev(0, "start", `Départ en ${MODE_FR[T.mode]}`, startText(T.mode, C1, start), { plant: setup(T.mode, C1, amb, start) });
    const e1 = ev(60, "near", `Approche : ${what} à ${fr(near, 2)} ${u}`, `À ${fr(Math.abs(T.value - near), 2)} ${u} de la limite (${S.short} ${T.op} ${fr(T.value, 2)} ${u}) : rien ne doit encore réagir.`, { plant: put(near), keys: T.keys });
    const e2 = cool ? ev(60 + go, "past", `Franchit : la chaleur s'arrête, la cell la plus chaude descend sous ${fr(T.value, 1)} °C`, `Attendu — ${expect}.`, { plant: { heatTo: 0 }, keys: T.keys, cross: true })
      : ev(60 + go, "past", `Franchit : ${what} à ${fr(past, 2)} ${u}`, `Au-delà de la limite, tenu ${hold} s. Attendu — ${expect}.`, { plant: put(past), keys: T.keys, cross: true });
    const e3 = ev(60 + go + hold, "back", "Retour : la cause disparaît", cool ? "La mission revient au repos." : cur ? (T.mode === "charge" ? "Le chargeur revient à sa consigne." : `La charge revient à 1 C (${fr(C1, 0)} A).`) : `${what} : rendu à la normale.`, { plant: back });
    const end = 60 + go + hold + rest;
    return { id: `rq-${T.signal}-${T.op === ">" ? "hi" : "lo"}-${String(T.value).replace(/[^0-9]/g, "_")}-${T.mode}`, origin: "limit", kind: T.mode, keys: T.keys,
      name: `${T.keys.join(" · ")} — ${S.short} ${T.op} ${fr(T.value, 2)} ${u}${D.modes ? ` en ${MODE_FR[T.mode]}` : ""}`,
      events: [ev0, e1, e2, e3, ...ackEv(60 + go + hold + 60, pl), ev(end, "end", "Fin de la mission", "La mission est jouée.")] };
  });
}

/** The nominal charge and discharge : inside every limit the requirements set. */
function nominalMissions(d, list, C1, amb) {
  const lo = Math.max(2.8, ...list.filter((x) => x.o.kind === "bound" && x.o.min !== undefined).map((x) => x.o.min)), keys = [...new Set(list.filter((x) => x.o.kind === "bound").map((x) => x.key))];
  const tc = until(d, { mode: "charge", start: 3.9, cMax: 1, amb }, (s, P) => P.done || P.ended, 3 * 3600) || 3600;
  const floor = +(lo + 0.4).toFixed(2), td = until(d, { mode: "discharge", start: 4.1, a: 2 * C1, amb }, (s) => s.vmin < floor * 1000, 3 * 3600) || 1800;
  return [
    { id: "nom-charge", origin: "nominal", kind: "charge", keys, name: "Nominal — charge à 1 C jusqu'à la fin", events: [
      ev(0, "start", "Départ en charge", `${startText("charge", C1, 3.9)} Le chargeur va jusqu'au bout de sa tension constante.`, { plant: setup("charge", C1, amb, 3.9) }),
      ev(tc + 60, "rest", "Le chargeur s'arrête", "La charge est finie : le module reste au repos.", { plant: { mode: "rest" } }), ev(tc + 180, "end", "Fin de la mission", "Rien n'a dû réagir.")] },
    { id: "nom-discharge", origin: "nominal", kind: "discharge", keys, name: `Nominal — décharge à 2 C jusqu'à ${fr(floor, 2)} V`, events: [
      ev(0, "start", "Départ en décharge", `Le module est en service : la charge tire 2 C (${fr(2 * C1, 0)} A), cell blocks à 4,1 V au repos.`, { plant: { ...setup("discharge", C1, amb, 4.1), a: 2 * C1 } }),
      ev(td, "rest", "La charge s'arrête", `Le cell block le plus bas est à ${fr(floor, 2)} V : ${fr(0.4, 1)} V au-dessus de la limite basse.`, { plant: { mode: "rest", a: 0 } }), ev(td + 120, "end", "Fin de la mission", "Rien n'a dû réagir.")] },
  ];
}
/** What the requirements say the product must reach. */
function envelopeMissions(list, C1, amb) {
  return list.filter((x) => x.o.kind === "envelope" && x.o.signal === "current").map((x) => { const dis = x.o.max !== undefined, A = Math.abs(dis ? x.o.max : x.o.min), mode = dis ? "discharge" : "charge";
    const s0 = dis ? 4.1 : 3.4, at = dis ? 60 : 200;
    return { id: `env-${x.key}-${x.n}`, origin: "envelope", kind: mode, keys: [x.key], name: `${x.key} — ${fr(A, 0)} A en ${MODE_FR[mode]}`, events: [
      ev(0, "start", `Départ en ${MODE_FR[mode]}`, startText(mode, C1, s0), { plant: setup(mode, C1, amb, s0) }),
      ev(at, "reach", `${dis ? "La charge tire" : "Le chargeur pousse"} ${fr(A, 0)} A`, `L'enveloppe de ${x.key} : ${oracleText(x.o)}. Tenu 60 s.`, { plant: currentPut(mode, A, C1), keys: [x.key], cross: true }),
      ev(at + 60, "back", "Retour à 1 C", "Le courant revient à la normale.", { plant: currentOff(mode, C1) }), ev(at + 180, "end", "Fin de la mission", "La mission est jouée.")] }; });
}
/** Two edges at once : the largest current of a way, at the edge of the temperature that removes service in that way. */
function cornerMissions(list, C1, amb, pl) {
  const out = [];
  for (const mode of ["discharge", "charge"]) {
    const env = list.find((x) => x.o.kind === "envelope" && x.o.signal === "current" && (mode === "discharge" ? x.o.max !== undefined : x.o.min !== undefined));
    const hot = list.filter((x) => x.o.kind === "reaction" && (!x.o.mode || x.o.mode === mode) && x.o.then && ((x.o.then.signal === "contactor" && x.o.then.is === 0) || (x.o.then.signal === "state" && x.o.then.atLeast >= 2)))
      .flatMap((x) => x.o.if.filter((c) => c.signal === "temp_max" && c.op === ">").map((c) => ({ x, v: c.value }))).sort((a, b) => a.v - b.v)[0];
    if (!env || !hot) continue;
    const A = Math.abs(mode === "discharge" ? env.o.max : env.o.min), T = hot.v - 2, s0 = mode === "charge" ? 3.4 : 4.0;
    out.push({ id: `corner-${mode}`, origin: "corner", kind: mode, keys: [env.key, hot.x.key], name: `Corner case — ${MODE_FR[mode]} ${fr(A, 0)} A à ${fr(T, 0)} °C`, events: [
      ev(0, "start", `Départ en ${MODE_FR[mode]}`, startText(mode, C1, s0), { plant: setup(mode, C1, amb, s0) }),
      ev(30, "hot", `Chaleur du dehors : la cell la plus chaude à ${fr(T, 0)} °C`, `À 2 °C de la limite de ${hot.x.key} : le module doit rester en service.`, { plant: { heatTo: T } }),
      ev(300, "peak", `${mode === "discharge" ? "La charge tire" : "Le chargeur pousse"} ${fr(A, 0)} A, à chaud`, `Le courant de ${env.key}, au bord de la température : les deux bords à la fois.`, { plant: currentPut(mode, A, C1), keys: [env.key, hot.x.key], cross: true }),
      ev(360, "back", "Retour : 1 C, la chaleur s'arrête", "Le courant revient, la chaleur du dehors s'arrête.", { plant: { ...currentOff(mode, C1), heatTo: 0 } }),
      ...ackEv(480, pl), ev(600, "end", "Fin de la mission", "La mission est jouée.")] });
  }
  return out;
}
/** What the bench breaks on purpose, in discharge at 1 C : the pins the module's bench names (lost, wake) and each auxiliary contact. */
function faultMissions(d, C1, amb, pl) {
  const name = (id) => { const o = (d.objects || []).find((x) => x.id === id); return o ? o.name.replace(/^Banc : /, "") : id; }, E = [ev(0, "start", "Départ en décharge", startText("discharge", C1, 3.9), { plant: setup("discharge", C1, amb, 3.9) })];
  let t = 60;
  if (pl.lost) { E.push(ev(t, "lost", "Comm : timeout du round-robin des CORE", `${name(pl.lost)} : plus aucune frame des CORE pendant 30 s.`, { set: { [pl.lost]: 1 }, cross: true }), ev(t + 30, "lost-back", "Comm : les frames des CORE reviennent", "La daisy chain est remise.", { set: { [pl.lost]: 0 } }), ...ackEv(t + 60, pl, "lost-ack")); t += 120; }
  if (pl.wake) { E.push(ev(t, "wake", "12 V perdu (WAKE)", `${name(pl.wake)} : le 12 V du véhicule disparaît pendant 30 s.`, { set: { [pl.wake]: 0 }, cross: true }), ev(t + 30, "wake-back", "12 V revenu", "Le 12 V du véhicule revient.", { set: { [pl.wake]: 1 } }), ...ackEv(t + 60, pl, "wake-ack")); t += 120; }
  for (const c of liveInputs(d).filter((i) => i.kind === "contact")) {
    E.push(ev(t, `${c.id}-open`, "Contactor : le contact auxiliaire reste ouvert", `${name(c.id)} dit « ouvert » alors que le contactor est commandé fermé, pendant 20 s.`, { set: { [c.id]: "open" }, cross: true }),
      ev(t + 20, `${c.id}-follows`, "Contact auxiliaire réparé", "Il suit de nouveau le contactor.", { set: { [c.id]: "follows" } }), ...ackEv(t + 50, pl, `${c.id}-ack`)); t += 110;
    if (pl.lost) { E.push(ev(t, `${c.id}-welded`, "Contactor welded, pendant un défaut", `Le round-robin se tait : le logiciel commande l'ouverture, mais ${name(c.id)} reste fermé (contactor collé), 20 s.`, { set: { [c.id]: "closed", [pl.lost]: 1 }, cross: true }),
      ev(t + 20, `${c.id}-free`, "Contactor libéré, frames revenues", "Le contact suit de nouveau ; les frames reviennent.", { set: { [c.id]: "follows", [pl.lost]: 0 } }), ...ackEv(t + 50, pl, `${c.id}-ack2`)); t += 110; } }
  if (E.length < 2) return [];
  E.push(ev(t + 60, "end", "Fin de la mission", "Les pannes sont jouées. Les exigences qui demandent ces réactions ne sont pas lues par la machine : elles sont exercées, pas jugées."));
  return [{ id: "fault-discharge", origin: "fault", kind: "discharge", keys: [], name: "Pannes injectées — en décharge à 1 C", events: E }];
}

/* ---------- the holdout set ---------- */
const SEGMENTS = 8;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** The seed of the holdout set : read from the requirements of the software — the same lot until they change. */
export const reserveSeed = (R) => hash((R ? forDiscipline(R, "sw").reqs : []).map((r) => `${keyOf(r)}:${r.statement || ""}`).join("|"));
/** n missions drawn at random inside and around the envelope : 8 segments of 90 s each, a way, a current, heat, a cell held, a fault. */
function reserveMissions(R, list, C1, amb, pl, n = 4) {
  const r = rng(reserveSeed(R)), envD = Math.max(3 * C1, ...list.filter((x) => x.o.kind === "envelope" && x.o.max !== undefined).map((x) => x.o.max)), envC = Math.max(2 * C1, ...list.filter((x) => x.o.kind === "envelope" && x.o.min !== undefined).map((x) => -x.o.min));
  const temps = list.flatMap((x) => (x.o.kind === "reaction" ? x.o.if : []).filter((c) => c.signal === "temp_max").map((c) => c.value)), tMax = Math.max(60, ...temps) + 5;
  const hi = Math.max(4.2, ...list.filter((x) => x.o.kind === "bound" && x.o.max !== undefined).map((x) => x.o.max)), lo = Math.min(2.8, ...list.filter((x) => x.o.kind === "bound" && x.o.min !== undefined).map((x) => x.o.min));
  const out = [];
  for (let m = 0; m < n; m++) {
    const s0 = +(3.3 + r() * 0.8).toFixed(2), E = [ev(0, "start", "Départ", `Cell blocks à ${fr(s0, 2)} V au repos.`, { plant: { ...setup("discharge", C1, amb, s0), a: 0, mode: "rest" } })];
    for (let k = 0; k < SEGMENTS; k++) {
      const t = 30 + k * 90, dis = r() < 0.55, A = Math.round((0.1 + r() * 1.05) * (dis ? envD : envC)), heat = r() < 0.4 ? Math.round(amb + r() * (tMax - amb)) : 0;
      const cHi = r() < 0.15 ? +(hi - 0.03 + r() * 0.08).toFixed(3) : 0, cLo = !cHi && r() < 0.15 ? +(lo - 0.06 + r() * 0.1).toFixed(3) : 0, lost = pl.lost && r() < 0.1;
      const p = { mode: dis ? "discharge" : "charge", a: dis ? A : 0, push: dis ? 0 : A, heatTo: heat, cellHi: cHi, cellLo: cLo };
      const said = [`${dis ? "décharge" : "charge"} ${A} A`, heat ? `${heat} °C` : null, cHi ? `cell block tenu à ${fr(cHi, 3)} V` : null, cLo ? `cell block tenu à ${fr(cLo, 3)} V` : null, lost ? "frames des CORE perdues" : null].filter(Boolean).join(", ");
      E.push(ev(t, `s${k}`, `Segment ${k + 1} : ${said}`, "Tiré au hasard dans l'enveloppe des exigences et autour.", { plant: p, ...(pl.lost ? { set: { [pl.lost]: lost ? 1 : 0 } } : {}), ...(pl.ack ? { pulse: { [pl.ack]: 300 } } : {}) }));
    }
    E.push(ev(30 + SEGMENTS * 90, "rest", "Au repos", "Le module s'arrête.", { plant: { mode: "rest", a: 0, push: 0, heatTo: 0, cellHi: 0, cellLo: 0 }, ...(pl.lost ? { set: { [pl.lost]: 0 } } : {}) }), ev(30 + SEGMENTS * 90 + 120, "end", "Fin de la mission", "La mission est jouée."));
    out.push({ id: `reserve-${m + 1}`, origin: "reserve", kind: "mission", keys: [], name: `Réserve ${m + 1}`, events: E });
  }
  return out;
}

/** The duty cycles the project keeps on its bench : those it imported or wrote are played ; those the tool wrote from the software's own
    thresholds (sw/sw_pack.js missionProfiles) stay on the bench — a yardstick read from the software would test the software against itself.
    → { played: [profile], bench: [profile] } */
export function projectProfiles(d) {
  const all = profilesOf(d) || [], auto = plantOf(d) ? new Map(missionProfiles(d).map((p) => [p.id, JSON.stringify(p.events)])) : new Map();
  const fromThresholds = (p) => p.from === "thresholds" || auto.get(p.id) === JSON.stringify(p.events);      // a project saved before the mark : the same events
  return { played: all.filter((p) => !fromThresholds(p)), bench: all.filter(fromThresholds) };
}
/** Every mission the campaign plays, written from the requirements (and the project's own duty cycles). → [{ id, origin, kind, keys, name, events }] */
export function campaignMissions(project, d, { reserve = true } = {}) {
  const pl = plantOf(d), own = projectProfiles(d).played.map((p) => ({ ...p, origin: "project", keys: p.keys || [] })); if (!pl) return own;
  const R = project && project.reqs, list = reqOracles(R), S = packStart(d).S, C1 = S.capAh, amb = S.amb, { tests } = limitsOf(list);
  return [...nominalMissions(d, list, C1, amb), ...limitMissions(tests, C1, amb, pl), ...envelopeMissions(list, C1, amb), ...cornerMissions(list, C1, amb, pl), ...faultMissions(d, C1, amb, pl), ...own,
    ...(reserve ? reserveMissions(R, list, C1, amb, pl) : [])];
}
/** The oracles no mission crosses on purpose (no quantity the bench moves) — said, never hidden. → [{ key, n, o }] */
export function missionGaps(project) { return limitsOf(reqOracles(project && project.reqs)).none; }
/** A short signature of a set of missions : a campaign played on another set cannot be compared with it. */
export const missionSig = (list) => hash((list || []).map((p) => `${p.id}:${(p.events || []).length}:${(p.events || []).at(-1)?.t || 0}`).join("|")).toString(36);
/** How long a mission lasts, in seconds. */
export const missionSeconds = (p) => Math.round((((p.events || []).at(-1) || { t: 0 }).t) / 1000);
