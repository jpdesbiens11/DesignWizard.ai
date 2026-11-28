/* DynamiteOrbit.ai — the instruments of a simulation (demande de JP) : temperature sensors and strain gauges put on the product,
   read on the result — what the thermocouples and the gauges of the test bench should say, before the bench exists.
     st.sensors = [{ id ("TC1", "SG2"), kind ("temp" | "gauge"), at [x, y, z] (mm), name?, off?, body? (the body it was put on),
                     n? (a gauge : the outward normal of the face it is bonded to), angle? (degrees : its axis, in the plane of that face),
                     rosette? (three grids, at 0°, 45° and 90° of the axis), ask? (["angle"] : an axis the tool chose, not yet confirmed) }]
   A sensor changes nothing in the calculation : it is read on the result that is kept (probe.js), so it can be put, moved or
   turned after a run, and its reading follows at once. A temperature sensor reads the temperature at its point. A gauge reads how
   much a short line along its axis stretches — the TOTAL strain, mechanical and thermal together, in µm/m (the « microstrain » of
   the instruments). A rosette reads three such lines and gives the two principal strains and their direction ; on a free surface
   of an isotropic material without heating, the principal stresses follow (plane stress).
   An instrument put aside (off) is kept and reads nothing. Pure : no page. */

import { findIn, scalarAt, vectorAt, gradientAt, stretch } from "./probe.js";

export const SENSOR_KINDS = {
  temp: { tag: "TC", label: "Temperature sensor", fr: "capteur de température", unit: "°C", color: "#0d9488", reads: "T", waits: "attend un calcul thermique" },
  gauge: { tag: "SG", label: "Strain gauge", fr: "jauge de déformation", unit: "µm/m", color: "#a16207", reads: "u", waits: "attend un calcul de structure" },
};
export const ROSETTE = { label: "Rosette 0°/45°/90°", fr: "rosette rectangulaire" };
const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4, fr = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("fr-CA", { maximumFractionDigits: d }).replace("-", "−");      // a true minus sign, as the strains have
const unit = (v) => { const l = v ? Math.hypot(v[0], v[1], v[2]) : 0; return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : null; };

/** Is this the number of an instrument (TC1, SG2) ? */
export const isSensorId = (id) => /^(TC|SG)\d+$/.test(String(id || ""));
/** The next free number of a kind : « TC3 ». A number is never given twice in a list, even after one was taken away from the middle. */
export function nextSensorId(list, kind) {
  const tag = SENSOR_KINDS[kind].tag;
  return `${tag}${1 + Math.max(0, ...(list || []).filter((s) => s && String(s.id).startsWith(tag)).map((s) => parseInt(String(s.id).slice(tag.length), 10) || 0))}`;
}
/** What the physics of a case can read : a thermal result holds temperatures, a structural one displacements. heat : the case solves a
    temperature field (thermal, or thermo-mechanical with sources). */
export const sensorKindsFor = (kind, heat) => (kind === "thermal" ? ["temp"] : kind === "thermo" && heat ? ["gauge", "temp"] : ["gauge"]);
/** A new instrument at a point. o : { normal (the face under the point), body (its name) }. The axis of a gauge is an example —
    along the first direction of the face — until the designer turns it or confirms it. */
export function newSensor(list, kind, at, o = {}) {
  const s = { id: nextSensorId(list, kind), kind, at: at.map(r2), ...(o.body ? { body: o.body } : {}) };
  return kind === "gauge" ? { ...s, n: (unit(o.normal) || [0, 0, 1]).map(r4), angle: 0, ask: ["angle"] } : s;
}
/** A copy, right after its original : it is born off, under a number of its own. → the list, changed in place */
export function copySensor(list, i) { const c = JSON.parse(JSON.stringify(list[i])); c.id = nextSensorId(list, c.kind); c.off = true; list.splice(i + 1, 0, c); return list; }
/** Does the gauge still wait for its axis ? */
export const asksAngle = (s) => !!(s && s.kind === "gauge" && Array.isArray(s.ask) && s.ask.includes("angle"));

/** The plane of a face, to turn a gauge in : u is the 0° of the gauge — the axis of the model that lies most in the plane (X before Y
    before Z), brought into it ; v is its 90°. → { u, v, n, axis (0 | 1 | 2 : the model axis u follows) } */
export function tangent(n) {
  const w = unit(n) || [0, 0, 1], a = w.map(Math.abs), k = a.indexOf(Math.min(...a)), dot = w[k], e = [0, 0, 0]; e[k] = 1;
  const u = unit(e.map((v, i) => v - dot * w[i])), v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  return { u, v, n: w, axis: k };
}
/** The grids of a gauge, as unit vectors in the model : one, or three (0°, 45°, 90° from its axis) for a rosette. */
export function gaugeAxes(s) {
  const { u, v } = tangent(s.n), at = (deg) => { const a = ((Number(s.angle) || 0) + deg) * Math.PI / 180, c = Math.cos(a), k = Math.sin(a); return [0, 1, 2].map((i) => c * u[i] + k * v[i]); };
  return s.rosette ? [at(0), at(45), at(90)] : [at(0)];
}
/** What a rectangular rosette says : from its three readings (grids a at 0°, b at 45°, c at 90°), the two principal strains and
    the angle from grid a to the first one, counted towards grid c (degrees, −90 to 90). */
export function rosetteReduce(ea, eb, ec) {
  const mean = (ea + ec) / 2, half = (ea - ec) / 2, shear = eb - mean, r = Math.hypot(half, shear);
  return { e1: mean + r, e2: mean - r, phi: r > 1e-12 ? 0.5 * Math.atan2(2 * shear, 2 * half) * 180 / Math.PI : 0 };
}
/** The principal stresses under a rosette : a free surface carries no stress across it (plane stress), the material is isotropic and
    is not heated. e1, e2 in µm/m, E in MPa. → { s1, s2, vm } in MPa */
export function planeStress(e1, e2, E, nu) {
  const k = E / (1 - nu * nu) * 1e-6, s1 = k * (e1 + nu * e2), s2 = k * (e2 + nu * e1);
  return { s1, s2, vm: Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2) };
}

/** What one instrument reads on a result. probe : what the run kept (probe.js), or null when nothing was solved yet.
    → { id, kind, name, unit, state, … } — state « ok » : value (°C, or µm/m), shown (where to draw it : on the deformed shape),
      dist (mm to the cube it was read in), h (that cube), mirrored (read through a symmetry), zone (read in a refinement zone), body ;
      a rosette adds grids [a, b, c], e1, e2, phi and, when it can be said, stress { s1, s2, vm }.
      Other states : « off », « none » (no result), « idle » (this result does not hold what it reads), « wait » (its axis is to
      confirm), « cut » (on the side a cut removed), « far » (no cube near it). */
export function readSensor(probe, s) {
  const K = SENSOR_KINDS[s && s.kind], base = { id: s && s.id, kind: s && s.kind, name: (s && s.name) || "", unit: K ? K.unit : "" };
  if (!K || !Array.isArray(s.at) || s.at.length !== 3 || !s.at.every(Number.isFinite)) return { ...base, state: "bad" };
  if (s.off) return { ...base, state: "off" };
  if (!probe) return { ...base, state: "none" };
  if (!probe.meshes.some((m) => m[K.reads] !== undefined)) return { ...base, state: "idle" };
  if (asksAngle(s)) return { ...base, state: "wait" };
  const f = findIn(probe, s.at, { body: s.body });
  if (f.gone) return { ...base, state: f.gone === "cut" ? "cut" : "far" };
  const m = f.m, u = m.u ? vectorAt(m, m.u, f.at).map((v, d) => v * f.flip[d]) : null, mat = (probe.bodies || [])[m.elemBody[f.at.e]] || null;
  const row = { ...base, state: "ok", dist: f.at.dist, h: m.grid.h, mirrored: f.mirrored, zone: f.k < probe.meshes.length - 1, body: mat ? mat.name : "", shown: u && probe.scale ? s.at.map((v, d) => v + probe.scale * u[d]) : s.at.slice() };
  if (s.kind === "temp") return { ...row, value: scalarAt(m, m.T, f.at) };
  const G = gradientAt(m, m.u, f.at), grids = gaugeAxes(s).map((d) => stretch(G, d.map((v, i) => v * f.flip[i])) * 1e6);
  if (!s.rosette) return { ...row, value: grids[0] };
  const R = rosetteReduce(grids[0], grids[1], grids[2]), free = probe.kind === "structure" && mat && mat.E > 0 && mat.nu > -1 && mat.nu < 0.5;
  return { ...row, value: Math.abs(R.e1) >= Math.abs(R.e2) ? R.e1 : R.e2, grids, ...R, ...(free ? { stress: planeStress(R.e1, R.e2, mat.E, mat.nu) } : {}) };
}
/** Every instrument of a case, read on a result. */
export const readSensors = (probe, sensors) => (sensors || []).map((s) => readSensor(probe, s));

const mpa = (v) => fr(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 3);      // a small stress keeps its figures
const signed = (v) => { const d = Math.abs(v) >= 100 ? 0 : 1, x = Math.round(v * 10 ** d) / 10 ** d; return `${x > 0 ? "+" : x < 0 ? "−" : ""}${fr(Math.abs(x), d)}`; };
/** A reading in a few words : « 42,3 °C », « +312 µm/m », « ε1 +312 · ε2 −95 µm/m » — or why there is none. */
export function sensorText(row) {
  if (!row) return "—";
  if (row.state === "ok") return row.kind === "temp" ? `${fr(row.value, 1)} °C` : row.grids ? `ε1 ${signed(row.e1)} · ε2 ${signed(row.e2)} µm/m` : `${signed(row.value)} µm/m`;
  return { off: "Off", none: "—", idle: (SENSOR_KINDS[row.kind] || {}).waits || "—", wait: "axe à confirmer", cut: "côté retiré par la coupe", far: "hors du maillage", bad: "incomplet" }[row.state] || "—";
}
/** The detail of a rosette, line by line : its three grids, the principal strains and their angle, the stresses when they can be said. */
export function rosetteLines(row) {
  if (!row || row.state !== "ok" || !row.grids) return [];
  return [`Grilles 0° · 45° · 90° : ${row.grids.map(signed).join(" · ")} µm/m`, `Principales : ε1 ${signed(row.e1)} · ε2 ${signed(row.e2)} µm/m, ε1 à ${fr(row.phi, 1)}° de la grille 0°`,
    ...(row.stress ? [`Contraintes (surface libre) : σ1 ${mpa(row.stress.s1)} · σ2 ${mpa(row.stress.s2)} MPa — von Mises ${mpa(row.stress.vm)} MPa`] : [])];
}

/** What is missing or odd in the instruments, for the guide. rows : their readings (readSensors), when a result is there.
    Nothing here stops a run : an instrument is not part of the calculation (`soft`). → [{ level, id, text, field, soft }] */
export function sensorIssues(sensors, rows) {
  const out = [], list = (sensors || []).filter(Boolean), live = list.filter((s) => !s.off), add = (level, id, text, field) => out.push({ level, id, text, soft: true, ...(field ? { field } : {}) });
  if (list.length && !live.length) add("tip", list[0].id, "Tous les instruments sont à Off : aucune lecture. Remettez-en un à On pour le lire.");
  live.forEach((s, k) => {
    const row = (rows || []).find((r) => r.id === s.id), K = SENSOR_KINDS[s.kind]; if (!K) return;
    if (asksAngle(s)) add("todo", s.id, `${s.id} : confirmez l'axe de la jauge (${fr(Number(s.angle) || 0, 1)}° est un exemple) — sa lecture attend.`, "angle");
    if (row && row.state === "cut") add("warn", s.id, `${s.id} est du côté que la coupe a retiré : rien n'y est calculé. Correctif : déplacez-le, ou mettez le plan à Off.`, "at");
    else if (row && (row.state === "far" || row.state === "bad")) add("warn", s.id, `${s.id} est hors du maillage : aucun cube à moins de deux cubes de lui. Correctif : « Viser », puis cliquez la pièce.`, "at");
    else if (row && row.state === "ok" && row.dist > 0.75 * row.h) add("tip", s.id, `${s.id} est lu sur le cube le plus proche, à ${fr(row.dist, 1)} mm : le maillage ne passe pas par ce point. Un maillage plus fin, ou une zone de raffinement, l'y amène.`, "at");
    const twin = live.slice(0, k).find((o) => o.kind === s.kind && !!o.rosette === !!s.rosette && (Number(o.angle) || 0) === (Number(s.angle) || 0) && o.at && s.at && Math.hypot(o.at[0] - s.at[0], o.at[1] - s.at[1], o.at[2] - s.at[2]) < 0.011);
    if (twin) add("tip", s.id, `${s.id} est au même point que ${twin.id}, avec le même réglage : un seul suffit.`, "at");
  });
  return out;
}
/** « 2 capteurs · 1 jauge (1 à Off) » : what a case holds of instruments, for a list or a note. */
export function sensorNote(list) {
  const part = (kind, one, many) => { const l = (list || []).filter((s) => s && s.kind === kind), off = l.filter((s) => s.off).length; return l.length ? `${l.length} ${l.length > 1 ? many : one}${off ? ` (${off} à Off)` : ""}` : ""; };
  return [part("temp", "capteur", "capteurs"), part("gauge", "jauge", "jauges")].filter(Boolean).join(" · ");
}
/** What a kept simulation remembers of its instruments : the readings that were made, as plain numbers. */
export function keptSensors(rows) {
  return (rows || []).filter((r) => r.state === "ok").map((r) => ({ id: r.id, kind: r.kind, ...(r.name ? { name: r.name } : {}), value: r4(r.value), unit: r.unit,
    ...(r.grids ? { grids: r.grids.map(r4), e1: r4(r.e1), e2: r4(r.e2), phi: r4(r.phi), ...(r.stress ? { vm: r4(r.stress.vm) } : {}) } : {}) }));
}
/** The instruments of a kept simulation, in one line for a report : « TC1 42,3 °C · SG1 +312 µm/m ». */
export const keptSensorsText = (list) => (list || []).map((r) => `${r.id}${r.name ? ` (${r.name})` : ""} ${sensorText({ ...r, state: "ok" })}`).join(" · ");
