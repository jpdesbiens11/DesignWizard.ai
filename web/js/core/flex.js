/* DesignWizard.ai — the flexible circuit : a thin polyimide strip, folded where the product asks, that carries tracks —
   one per function it connects — and small sensors along its way : temperature probes pressed on what they watch, voltage
   taps welded on a busbar or a cell. It ends in a stiffened tail that enters a connector of the library, or is soldered
   on a rigid board. The designer gives the strip, its legs, the functions to carry and where the sensors sit ; the tracks
   a sensor needs are added for it. The definition is kept in the part (spec.flex) and the part is written again from it.
   Pure : no kernel, no DOM. Geometry of the strip : core/busbar.js (legs, section, faces).
   def = { name, W, t, cu, r, layers, legs: [{ L, bend }], tracks: [{ net, fn, w, i }], sensors: [{ id, kind: "temp" | "volt", leg, side, s, y, net }],
           tail: { ref, mate: "zif" | "solder", L }, gap } */

import { legsOf, stripProfile, onLeg } from "./busbar.js";
import { connector } from "../cad/elec_library.js";

const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000, fr = (x) => String(r2(x)).replace(".", ",");
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
export const SENSOR_KINDS = {
  temp: { fr: "Sonde de température", prefix: "TS", text: "Une thermistance sur le circuit, pressée ou collée sur ce qu'elle surveille", size: [1.6, 0.8, 0.8], pad: [4, 4] },
  volt: { fr: "Prise de tension", prefix: "VS", text: "Une patte du circuit soudée sur un busbar ou une borne de cellule : elle en ramène le potentiel", size: [4, 3, 0.1], pad: [4, 3] },
};
export const TAIL_MATES = { zif: "Dans un connecteur de la carte (queue raidie)", solder: "Brasée sur la carte" };
/** Usual limits of a flexible circuit laid once and left in place (IPC-2223 rules of thumb) : bend radius over thickness. */
export const BEND_RATIO = { 1: 6, 2: 12 }, DYNAMIC_RATIO = 100;
export const blankFlex = () => ({ name: "Circuit flexible", W: 12, t: 0.2, cu: 0.035, r: 2, layers: 1, gap: 0.3, legs: [{ L: 40 }, { L: 20, bend: 90 }, { L: 60, bend: -90 }],
  tracks: [{ net: "5V", fn: "Alimentation des capteurs", w: 0.5, i: 0.2 }, { net: "GND", fn: "Retour", w: 0.5, i: 0.2 }], sensors: [], tail: { ref: "hirose-fh12", mate: "zif", L: 6 } });

/** Every track the circuit carries : those asked for, then the ones its sensors need — one per voltage tap, one per probe and a shared return. */
export function allTracks(def) {
  const out = def.tracks.map((t, k) => ({ id: `P${k + 1}`, ...t })), temps = def.sensors.filter((s) => s.kind === "temp");
  for (const s of def.sensors) out.push({ id: `P${out.length + 1}`, net: s.kind === "volt" ? s.net || s.id : s.id, fn: `${SENSOR_KINDS[s.kind].fr} ${s.id}`, w: 0.3, i: 0.01, sensor: s.id });
  if (temps.length) out.push({ id: `P${out.length + 1}`, net: "T-RET", fn: "Retour commun des sondes de température", w: 0.3, i: 0.01 * temps.length, sensor: "temp" });
  return out;
}
/** Where each track lies across the width : side by side from one edge, `gap` apart. → [{ ...track, y (its near edge) }] and the width they take. */
export function layTracks(def) {
  const edge = 0.5; let y = edge;
  const rows = allTracks(def).map((t) => { const row = { ...t, y: r3(y) }; y += t.w + def.gap; return row; });
  return { rows, used: r2(y - def.gap + edge) };
}
/** IPC-2221 : the current a covered track carries for a temperature rise dT — I = 0,024 · dT^0,44 · A^0,725, A in square mils. */
export const trackAmps = (w, cu, dT = 20) => 0.024 * dT ** 0.44 * ((w / 0.0254) * (cu / 0.0254)) ** 0.725;
const nextId = (def, kind) => { const p = SENSOR_KINDS[kind].prefix; return `${p}${def.sensors.filter((s) => s.kind === kind).reduce((m, s) => Math.max(m, parseInt(String(s.id).replace(/\D/g, ""), 10) || 0), 0) + 1}`; };
/** A new sensor where the designer pointed ; it takes the next number of its kind. where : { leg, side, s, y }. */
export function addSensor(def, kind, where, o = {}) {
  const s = { id: nextId(def, kind), kind, leg: where.leg, side: where.side, s: where.s, y: where.y ?? r2(def.W / 2), ...(kind === "volt" ? { net: o.net || "" } : {}), ...o };
  def.sensors.push(s); fitSensor(def, s); return s;
}
/** Keeps a sensor on the flat part of its leg, clear of the bends, and inside the width. */
export function fitSensor(def, s) {
  const g = legsOf(def)[s.leg]; if (!g) return s;
  const [a, b] = SENSOR_KINDS[s.kind].pad, clear = 1.5;
  s.s = r2(Math.max(g.from + a / 2 + (g.i ? clear : 0), Math.min(g.to - a / 2 - (g.i < def.legs.length - 1 ? clear : 0), s.s))); s.y = r2(Math.max(b / 2, Math.min(def.W - b / 2, s.y)));
  return s;
}
/** What the circuit is worth : the tracks against the width and their current, the bends against the thickness, the tail against its connector. */
export function flexChecks(def) {
  const legs = legsOf(def), lay = layTracks(def), notes = [], say = (level, text) => notes.push({ level, text }), ratio = BEND_RATIO[def.layers] || 12, rMin = ratio * def.t, len = legs.reduce((a, g) => a + g.L, 0), c = def.tail && connector(def.tail.ref);
  const rows = lay.rows.map((t) => { const amps = trackAmps(t.w, def.cu), R = 1.724e-8 * (len / 1000) / (t.w * def.cu * 1e-6); return { ...t, amps: r2(amps), R: r2(R * 1000), ok: (t.i || 0) <= amps }; });
  if (lay.used > def.W + 1e-9) say("bad", `${rows.length} pistes prennent ${fr(lay.used)} mm : la bande n'en fait que ${fr(def.W)} — l'élargir, affiner les pistes ou passer en double face.`);
  if (legs.length > 1 && def.r < rMin - 1e-9) say("bad", `Rayon de pli de ${fr(def.r)} mm pour ${fr(def.t)} mm d'épaisseur : au moins ${ratio} × l'épaisseur = ${fr(rMin)} mm pour un circuit ${def.layers === 1 ? "simple face" : "double face"} posé une fois ; ${DYNAMIC_RATIO} × s'il fléchit en service.`);
  for (const t of rows) { if (t.w < 0.1) say("bad", `${t.id} (${t.net}) : piste de ${fr(t.w)} mm — 0,1 mm au moins.`); if (!t.ok) say("check", `${t.id} (${t.net}) : ${fr(t.i)} A pour environ ${fr(t.amps)} A admissibles (IPC-2221, piste couverte, échauffement de 20 K) — élargir la piste.`); }
  if (def.gap < 0.1) say("bad", `Espace de ${fr(def.gap)} mm entre pistes : 0,1 mm au moins.`);
  legs.forEach((g) => { if (g.to - g.from < 3) say("bad", `Branche ${g.i + 1} de ${fr(g.L)} mm : trop courte entre ses plis.`); });
  for (const s of def.sensors) { if (!legs[s.leg]) say("bad", `${s.id} : sa branche n'existe plus.`); else if (s.kind === "volt" && !s.net) say("check", `${s.id} : dites quel potentiel cette prise ramène (S1+, HV−…).`); }
  if (def.sensors.some((s) => s.kind === "volt")) say("check", "Des prises de tension amènent des potentiels différents sur des pistes voisines : l'espace entre pistes et les lignes de fuite se jugent dans l'écran Isolation, sur l'assemblage.");
  if (c && def.tail.mate === "zif") { const pitch = rows.length * 1 + 1 <= def.W ? 1 : 0.5; if (rows.length * 0.5 + 1 > def.W) say("bad", `${rows.length} pistes au pas de 0,5 mm ne tiennent pas dans une queue de ${fr(def.W)} mm.`);
    if (rows.some((t) => (t.i || 0) > c.a)) say("check", `${c.maker} ${c.series} : ${fr(c.a)} A par contact — une piste demande plus ; doubler ses contacts.`);
    return { rows, used: lay.used, length: r2(len), pins: rows.length, pitch, notes, ok: !notes.some((n) => n.level === "bad") }; }
  return { rows, used: lay.used, length: r2(len), pins: rows.length, pitch: null, notes, ok: !notes.some((n) => n.level === "bad") };
}
/** Writes the part from its definition : the film, a copper body per track with its net, the sensors, the stiffener of the tail, the interfaces. */
export function flexPart(def, id, before = null) {
  const legs = legsOf(def), key = slug(`${id}_${def.name}`), lay = layTracks(def), ch = flexChecks(def), c = def.tail && connector(def.tail.ref), bodies = {}, features = [{ op: "extrude", id: "film", name: "Film", profile: stripProfile(def), plane: "XZ", length: "W" }], interfaces = [];
  const core = stripProfile({ ...def, t: def.cu, r: def.r + (def.t - def.cu) / 2, zc: def.t / 2 });                 // a track : the same path, in the middle of the film
  lay.rows.slice(0, 16).forEach((t, k) => { if (t.y + t.w > def.W) return; const body = `p${k + 1}`; bodies[body] = { material: "CU-C110", net: t.net, kind: "conductor", label: `${t.id} ${t.net}` };
    features.push({ op: "extrude", id: `lit${k + 1}`, mode: "cut", profile: core, plane: "XZ", at: t.y, length: t.w }, { op: "extrude", id: `piste${k + 1}`, name: `Piste ${t.id} — ${t.net}`, body, profile: core, plane: "XZ", at: t.y, length: t.w }); });
  const tailL = (def.tail && def.tail.L) || 6;
  if (def.tail && def.tail.mate === "zif") { bodies.raidisseur = { material: "FR4", kind: "insulator", label: "Raidisseur" }; features.push({ op: "box", id: "raidisseur", name: "Raidisseur de la queue", body: "raidisseur", size: [tailL, "W", r2(Math.max(0.05, 0.3 - def.t))], at: [0, 0, -r2(Math.max(0.05, 0.3 - def.t))] }); }
  interfaces.push({ id: "IF1", type: "planar", name: def.tail && def.tail.mate === "solder" ? "Brasage sur la carte" : `Queue dans le connecteur${c ? ` ${c.maker} ${c.series}` : ""}`, key: `${key}_queue`, partner: "Carte", side: "A", face: "+Z", level: def.t, at: [r2(tailL / 2), "W/2"], params: { w: tailL, h: "W" } });
  for (const s of def.sensors) { const g = legs[s.leg]; if (!g) continue;
    const K = SENSOR_KINDS[s.kind], q = onLeg(def, legs, s.leg, s.side, s.s, s.y), back = onLeg(def, legs, s.leg, -s.side, s.s, s.y), [a, b, h] = K.size, body = s.id.toLowerCase();
    const at = (f, base, out) => (f.face[1] === "Z" ? { size: [a, b, h], at: [r2(f.at[0] - a / 2), r2(f.at[1] - b / 2), r2(out > 0 ? base : base - h)] } : { size: [h, b, a], at: [r2(out > 0 ? base : base - h), r2(f.at[0] - b / 2), r2(f.at[1] - a / 2)] });
    const outward = (f) => (f.face[0] === "+" ? 1 : -1);
    if (s.kind === "temp") { bodies[body] = { material: "GENERIC-COMPONENT", kind: "insulator", label: s.id }; features.push({ op: "box", id: `corps_${body}`, name: `${K.fr} ${s.id}`, body, ...at(back, back.level, outward(back)) });      // the component stands on the back : the face that touches stays flat
      interfaces.push({ id: s.id, type: "planar", name: `${K.fr} ${s.id} — contact thermique`, key: s.key || `${key}_${body}`, partner: s.on || "Ce qu'elle surveille", side: "A", face: q.face, level: q.level, at: q.at, params: { w: K.pad[0], h: K.pad[1] } }); }
    else { bodies[body] = { material: "CU-C110", net: s.net || s.id, kind: "conductor", label: `${s.id} ${s.net || ""}`.trim() }; features.push({ op: "box", id: `patte_${body}`, name: `${K.fr} ${s.id}`, body, ...at(q, q.level, outward(q)) });
      interfaces.push({ id: s.id, type: "weld", name: `${K.fr} ${s.id}${s.net ? ` — ${s.net}` : ""}`, key: s.key || `${key}_${body}`, partner: s.on || "Busbar ou borne de cellule", side: "A", face: q.face, level: r2(q.level + outward(q) * h), at: q.at, ...(q.along ? { rot: 90 } : {}),
        params: { process: s.process || "laser", w: K.pad[0], h: K.pad[1], n: 1, t: h, wire: 0.3, wireMat: "Al", i: 0 } }); }
  }
  const kept = ((before && before.interfaces) || []).filter((i) => i.id !== "IF1" && !/^(TS|VS)\d+$/.test(i.id));
  return { ...(before ? { revision: before.revision, characteristics: before.characteristics } : {}), dw: "part/1", id, name: def.name || "Circuit flexible", function: `Relie ${ch.rows.length} fonction(s) le long de ${fr(ch.length)} mm${def.sensors.length ? `, avec ${def.sensors.length} capteur(s)` : ""}`,
    family: "flex", process: "purchased", material: "PI-FILM", elec: { kind: "insulator" }, flex: JSON.parse(JSON.stringify(def)), ...(c ? { library: { ref: c.id, maker: c.maker, series: c.series, kind: c.kind, a: c.a, v: c.v, poles: ch.pins, seen: c.seen } } : {}), bodies,
    params: { W: { value: def.W, min: def.W, max: def.W, step: 0.5, unit: "mm", label: "Largeur (se règle dans l'écran Circuits flexibles)", group: "Bande" } }, features: [...features, { op: "interfaces" }], interfaces: [...interfaces, ...kept],
    notes: [`Polyimide de ${fr(def.t)} mm, cuivre de ${fr(def.cu * 1000)} µm, ${def.layers === 1 ? "simple face" : "double face"} ; ${ch.rows.length} pistes : ${ch.rows.map((t) => `${t.id} ${t.net} ${fr(t.w)} mm`).join(", ")}.`,
      ...(legs.length > 1 ? [`Plis à 90°, rayon intérieur ${fr(def.r)} mm (au moins ${BEND_RATIO[def.layers] || 12} × l'épaisseur pour une pose statique) ; aucun composant ni trou métallisé dans un pli.`] : []),
      ...(def.tail && def.tail.mate === "zif" ? [`Queue raidie à 0,3 mm sur ${fr(tailL)} mm, ${ch.pins} contacts au pas de ${fr(ch.pitch || 0.5)} mm${c ? ` — ${c.maker} ${c.series}, ${fr(c.a)} A par contact` : ""}.`] : ["Queue brasée sur la carte : plages étamées, maintien mécanique à prévoir à côté du joint."]),
      "Géométrie de principe : les pistes sont montrées au cœur du film, les fenêtres du vernis et les plages ne sont pas dessinées."] };
}
