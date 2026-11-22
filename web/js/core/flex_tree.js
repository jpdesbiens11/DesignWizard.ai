/* DesignOrbit.ai — the branched flexible circuit : a wide core, flat, and branches of their own widths that leave it along
   X or Y and fold up (Z+) or down (Z−) toward the points they serve. A branch ends in a temperature probe, a voltage tap,
   a tongue that slips into a clipped slot, or bare pads. A rigid board can sit on the core or under it — the usual case :
   the core is the layer under a rigid board, and its branches run to the measuring points of the product.
   def = { name, t, cu, r, layers, gap, core: { L, W }, rigid: { side: "over" | "under", t } | null,
           branches: [{ id, edge: "+X" | "-X" | "+Y" | "-Y", at (along that edge, mm), w, legs: [{ L, bend: 90 | -90 }], r (its own bend radius ; default def.r),
                        end: "temp" | "volt" | "slot" | "free", net, on, tracks, side, tabW (the width of a voltage tab) }],
           spots: [{ id, x, y (on the core, from its corner), end: "temp" | "volt", net, on, side }] (optional) }
   A spot sits on the core itself, on the face toward what it watches (side +1 : the top) : a thermistor pressed on its target through
   a pad, or a voltage tab — the flex that lies flat under a block of cells and reads each one by its centre.
   The first leg of a branch leaves the core flat ; bend +90 folds toward Z+, −90 toward Z−. Kept in the part (spec.flex),
   which is written again from it. Pure : no kernel, no DOM. The strip of a branch : core/busbar.js (legs, section). */

import { legsOf, stripProfile } from "./busbar.js";
import { BEND_RATIO, DYNAMIC_RATIO, SENSOR_KINDS, trackAmps, flexPart } from "./flex.js";

const r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ",");
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
export const EDGES = { "+X": { fr: "vers X+", axis: 0, sign: 1, along: "W" }, "-X": { fr: "vers X−", axis: 0, sign: -1, along: "W" }, "+Y": { fr: "vers Y+", axis: 1, sign: 1, along: "L" }, "-Y": { fr: "vers Y−", axis: 1, sign: -1, along: "L" } };
export const ENDS = { temp: { label: "Temperature sensor", fr: "Sonde de température", tracks: 2, text: "Une thermistance au bout de la branche, pressée ou collée sur ce qu'elle surveille" }, volt: { label: "Voltage tap", fr: "Prise de tension", tracks: 1, text: "Le bout de la branche soudé sur un busbar ou une borne : il en ramène le potentiel" },
  slot: { label: "Clipped tab", fr: "Languette clipsée", tracks: 2, text: "Le bout raidi de la branche glisse dans une fente et s'y clipse : un capteur ou une carte l'attend au fond" }, free: { label: "Solder pads", fr: "Plages à braser", tracks: 2, text: "Des plages nues au bout de la branche, pour des fils ou un composant" } };
export const FOLDS = [[90, "pli vers Z+ (le haut)"], [-90, "pli vers Z− (le bas)"]];
const TRACK = 0.3, EDGE = 0.5, ROOT = 1;      // a signal track, the margin to the edge of the film, how far a branch enters the core

export const blankTree = () => ({ name: "Circuit flexible ramifié", t: 0.2, cu: 0.035, r: 2, layers: 1, gap: 0.3, core: { L: 50, W: 30 }, rigid: { side: "over", t: 1.6 },
  branches: [{ id: "B1", edge: "+X", at: 8, w: 5, legs: [{ L: 25 }, { L: 12, bend: 90 }], end: "volt", net: "S1+" }, { id: "B2", edge: "+Y", at: 25, w: 4, legs: [{ L: 20 }, { L: 15, bend: -90 }], end: "temp" }] });
/** A measuring board with seven branches : what the screen offers as a worked example. */
export const exampleTree = () => ({ name: "Carte de mesure à sept branches", t: 0.2, cu: 0.035, r: 2, layers: 1, gap: 0.3, core: { L: 70, W: 46 }, rigid: { side: "over", t: 1.6 }, branches: [
  { id: "B1", edge: "+X", at: 8, w: 6, legs: [{ L: 30 }, { L: 12, bend: 90 }, { L: 10, bend: -90 }], end: "volt", net: "S1+", on: "Busbar de la série 1" },
  { id: "B2", edge: "+X", at: 23, w: 4, legs: [{ L: 22 }, { L: 10, bend: -90 }], end: "volt", net: "S2+", on: "Busbar de la série 2" },
  { id: "B3", edge: "+X", at: 38, w: 4, legs: [{ L: 40 }], end: "temp", on: "Cellule du milieu" },
  { id: "B4", edge: "+Y", at: 15, w: 5, legs: [{ L: 18 }, { L: 20, bend: 90 }], end: "temp", on: "Dissipateur" },
  { id: "B5", edge: "+Y", at: 50, w: 8, legs: [{ L: 12 }, { L: 10, bend: -90 }, { L: 14, bend: 90 }], end: "slot", tracks: 4, on: "Capteur de courant" },
  { id: "B6", edge: "-X", at: 23, w: 10, legs: [{ L: 25 }], end: "free", tracks: 8, on: "Faisceau de commande" },
  { id: "B7", edge: "-Y", at: 35, w: 4, legs: [{ L: 15 }, { L: 15, bend: -90 }], end: "volt", net: "S3+", on: "Busbar de la série 3" }] });

export const isTree = (def) => !!(def && def.core && Array.isArray(def.branches));
export const tracksOf = (b) => Math.max(1, Math.round(b.tracks || (ENDS[b.end] || ENDS.free).tracks));
/** The width a branch needs for its tracks. */
export const widthNeeded = (def, b) => r2(tracksOf(b) * TRACK + (tracksOf(b) - 1) * (def.gap || 0.3) + 2 * EDGE);
const strip = (def, b, extra = {}) => ({ t: def.t, r: b.r ?? def.r, legs: b.legs.map((g, i) => (i ? { ...g } : { ...g, L: (Number(g.L) || 0) + ROOT })), ...extra });
/** The geometry of a branch : its legs in its own frame (x away from the core, z up), and how that frame sits in the model.
    → { legs, model(lx, across, lz) → [x, y, z], dir([dx, dz]) → unit vector of the model, plane ("XZ" | "YZ"), at (where its width starts), poly(profile) } */
export function branchFrame(def, b) {
  const E = EDGES[b.edge] || EDGES["+X"], c = def.core, legs = legsOf(strip(def, b)), o = E.sign > 0 ? (E.axis === 0 ? c.L : c.W) : 0;
  const out = (lx) => o + E.sign * (lx - ROOT);                                           // the branch starts a little inside the core, to be one piece with it
  const model = (lx, a, lz) => (E.axis === 0 ? [out(lx), b.at + a, lz] : [b.at + a, out(lx), lz]);
  const dir = ([dx, dz]) => { const v = [0, 0, dz]; v[E.axis] = E.sign * dx; return v; };
  return { E, legs, model, dir, plane: E.axis === 0 ? "XZ" : "YZ", at: r2(b.at - b.w / 2), poly: (profile) => ({ poly: profile.poly.map((q) => [Math.round(out(q[0]) * 1e4) / 1e4, q[1], ...q.slice(2)]) }) };
}
const faceOf = (v) => { const a = [0, 1, 2].reduce((m, i) => (Math.abs(v[i]) > Math.abs(v[m]) ? i : m), 0); return (v[a] > 0 ? "+" : "-") + "XYZ"[a]; };
/** A place on the last leg of a branch : s from the tip (mm), on side +1 (the face on the left of the travel : the top of a flat leg) or −1.
    → { p (the point on that face), n (its outward normal), d (the direction of the leg), face, level, at (the two axes of that face), along (the leg runs along the second axis of the face) } */
export function tipSpot(def, b, fromTip = 0, side = 1) {
  const F = branchFrame(def, b), g = F.legs.at(-1), s = g.L - fromTip, c = [g.C[0] + g.d[0] * s, g.C[1] + g.d[1] * s], off = side * def.t / 2;
  const p = F.model(c[0] + g.n[0] * off, 0, c[1] + g.n[1] * off), n = F.dir([g.n[0] * side, g.n[1] * side]), d = F.dir(g.d), face = faceOf(n), a = "XYZ".indexOf(face[1]), pl = a === 2 ? [0, 1] : a === 1 ? [0, 2] : [1, 2];
  return { p: p.map(r2), n, d, face, level: r2(p[a]), at: [r2(p[pl[0]]), r2(p[pl[1]])], along: Math.abs(d[pl[1]]) > 0.5 };
}
/** A box lying on a face of the last leg : sizes along the leg, across the branch and out of the face ; « out » false sinks it into the film side. */
function boxOn(spot, along, across, thick) {
  const size = [0, 0, 0], at = [0, 0, 0];
  for (let a = 0; a < 3; a++) { const ext = Math.abs(spot.d[a]) > 0.5 ? along : Math.abs(spot.n[a]) > 0.5 ? thick : across; size[a] = r2(ext); at[a] = r2(Math.abs(spot.n[a]) > 0.5 ? (spot.n[a] > 0 ? spot.p[a] : spot.p[a] - thick) : spot.p[a] - ext / 2); }
  return { size, at };
}

/** What the circuit is worth : each branch against the edge it leaves, its tracks, its folds, its end. */
export function treeChecks(def) {
  const notes = [], say = (level, text, id = null, field = null) => notes.push({ level, text, id, field }), c = def.core, ratio = BEND_RATIO[def.layers] || 12, rMin = ratio * def.t, rows = [];
  if (!(c.L >= 5 && c.W >= 5)) say("bad", "Le cœur du circuit fait au moins 5 × 5 mm.");
  const byEdge = {};
  for (const b of def.branches) {
    const E = EDGES[b.edge], n = tracksOf(b), need = widthNeeded(def, b);
    if (!E) { say("bad", `${b.id} : bord inconnu (${b.edge}).`); continue; }
    const span = E.along === "W" ? c.W : c.L, legs = legsOf(strip(def, b)), len = b.legs.reduce((a, g) => a + (Number(g.L) || 0), 0), amps = trackAmps(TRACK, def.cu);
    rows.push({ id: b.id, edge: b.edge, w: b.w, tracks: n, need, length: r2(len), folds: b.legs.length - 1, end: b.end, net: b.end === "volt" ? b.net || "" : b.id, amps: r2(amps) });
    if (b.w < need - 1e-9) say("bad", `${b.id} : ${n} piste(s) demandent ${fr(need)} mm de large — la branche n'en fait que ${fr(b.w)}.`, b.id, "w");
    if (b.at - b.w / 2 < -1e-9 || b.at + b.w / 2 > span + 1e-9) say("bad", `${b.id} : elle dépasse le bord ${b.edge} du cœur (${fr(span)} mm de long).`, b.id, "at");
    legs.forEach((g, i) => { if (g.to - g.from < 3 + (i ? 0 : 1)) say("bad", `${b.id} : sa partie ${i + 1} (${fr(b.legs[i].L)} mm) est trop courte entre ses plis.`, b.id, `leg${i}`); });
    if (b.legs.length > 1 && (b.r ?? def.r) < rMin - 1e-9) say("bad", `${b.id} : rayon de pli de ${fr(b.r ?? def.r)} mm pour ${fr(def.t)} mm d'épaisseur — au moins ${ratio} × l'épaisseur = ${fr(rMin)} mm (${DYNAMIC_RATIO} × si la branche fléchit en service).`, b.id, "r");
    if (b.end === "volt" && !b.net) say("todo", `${b.id} : dites quel potentiel cette prise ramène (S1+, HV−…).`, b.id, "net");
    if (b.end === "slot" && legs.at(-1).to - legs.at(-1).from < 6) say("check", `${b.id} : moins de 6 mm de plat au bout pour la languette et son raidisseur.`, b.id, `leg${b.legs.length - 1}`);
    (byEdge[b.edge] = byEdge[b.edge] || []).push(b);
  }
  for (const list of Object.values(byEdge)) { list.sort((a, b) => a.at - b.at); for (let i = 1; i < list.length; i++) if (list[i].at - list[i].w / 2 < list[i - 1].at + list[i - 1].w / 2 + 1 - 1e-9) say("bad", `${list[i - 1].id} et ${list[i].id} se touchent sur le bord ${list[i].edge} : au moins 1 mm entre deux branches.`, list[i].id, "at"); }
  const spots = def.spots || [];
  for (const p of spots) {
    const K = SENSOR_KINDS[p.end], hx = K ? K.size[0] / 2 : 0, hy = K ? K.size[1] / 2 : 0;
    if (!K) { say("bad", `${p.id} : un point du cœur est une sonde (temp) ou une prise (volt).`, p.id, "end"); continue; }
    if (p.x - hx < -1e-9 || p.x + hx > c.L + 1e-9 || p.y - hy < -1e-9 || p.y + hy > c.W + 1e-9) say("bad", `${p.id} : il sort du cœur (${fr(c.L)} × ${fr(c.W)} mm).`, p.id, "x");
    if (p.end === "volt" && !p.net) say("todo", `${p.id} : dites quel potentiel cette prise ramène.`, p.id, "net");
  }
  spots.forEach((p, i) => spots.slice(i + 1).forEach((q) => { if (Math.hypot(p.x - q.x, p.y - q.y) < 3 - 1e-9) say("bad", `${p.id} et ${q.id} sont à moins de 3 mm l'un de l'autre sur le cœur.`, q.id, "x"); }));
  const ids = [...def.branches.map((b) => b.id), ...spots.map((p) => p.id)];
  if (new Set(ids).size !== ids.length) say("bad", "Deux branches ou points portent le même repère.");
  if (def.branches.filter((b) => b.end === "volt").length > 1) say("check", "Des prises de tension amènent des potentiels différents sur le cœur : l'espace entre pistes et les lignes de fuite se jugent dans l'écran Isolation, sur l'assemblage.");
  if (def.rigid && !(def.rigid.t > 0)) say("bad", "Donnez l'épaisseur de la carte rigide.", null, "rigid");
  const total = rows.reduce((a, r) => a + r.tracks, 0) + spots.reduce((a, p) => a + (p.end === "temp" ? 2 : 1), 0);
  return { rows, tracks: total, notes, ok: !notes.some((n) => n.level === "bad") };
}

/** Writes the part from its definition : the film of the core and of each branch, a conductor per branch with its net, what is at the end of
    each, the rigid board when it is shown, and the interfaces — one per branch end, one for the core. */
export function treePart(def, id, before = null) {
  const c = def.core, key = slug(`${id}_${def.name}`), ch = treeChecks(def), bodies = {}, interfaces = [], rigid = def.rigid && def.rigid.t > 0 ? def.rigid : null;
  const features = [{ op: "box", id: "coeur", name: "Cœur", size: [c.L, c.W, def.t], at: [0, 0, 0] }];
  if (rigid) { bodies.carte = { material: "FR4", kind: "insulator", label: "Carte rigide" }; features.push({ op: "box", id: "carte", name: `Carte rigide (${rigid.side === "under" ? "sous" : "sur"} le cœur)`, body: "carte", size: [c.L, c.W, rigid.t], at: [0, 0, rigid.side === "under" ? -rigid.t : def.t] }); }
  def.branches.forEach((b, k) => {
    if (!EDGES[b.edge] || !(b.w > 0) || !b.legs.length) return;
    const F = branchFrame(def, b), n = tracksOf(b), body = b.id.toLowerCase(), net = b.end === "volt" ? b.net || b.id : b.id, tw = r2(Math.min(b.w - 2 * EDGE, n * TRACK + (n - 1) * (def.gap || 0.3))), label = `${b.id} — ${(ENDS[b.end] || ENDS.free).label.toLowerCase()}`;
    features.push({ op: "extrude", id: `film_${body}`, name: `Branche ${label}`, profile: F.poly(stripProfile(strip(def, b))), plane: F.plane, at: F.at, length: b.w });
    if (tw > 0.05) { const core = F.poly(stripProfile(strip(def, b, { t: def.cu, r: (b.r ?? def.r) + (def.t - def.cu) / 2, zc: def.t / 2 }))), at = r2(b.at - tw / 2);
      bodies[body] = { material: "CU-C110", net, kind: "conductor", label: `${b.id} ${net}` };
      features.push({ op: "extrude", id: `lit_${body}`, mode: "cut", profile: core, plane: F.plane, at, length: tw }, { op: "extrude", id: `piste_${body}`, name: `Pistes de ${b.id} (${n}) — ${net}`, body, profile: core, plane: F.plane, at, length: tw }); }
    const side = b.side === -1 ? -1 : 1, K = SENSOR_KINDS[b.end], on = b.on || (b.end === "volt" ? "Busbar ou borne de cellule" : b.end === "temp" ? "Ce qu'elle surveille" : b.end === "slot" ? "Fente du support" : "Fils ou composant");
    if (b.end === "temp") { const front = tipSpot(def, b, 3, side), back = tipSpot(def, b, 3, -side), comp = `ts_${body}`; bodies[comp] = { material: "GENERIC-COMPONENT", kind: "insulator", label: `Sonde ${b.id}` };
      features.push({ op: "box", id: comp, name: `${K.label} de ${b.id}`, body: comp, ...boxOn(back, K.size[0], K.size[1], K.size[2]) });      // the component stands on the back : the face that touches stays flat
      interfaces.push({ id: b.id, type: "planar", name: `${K.label} ${b.id} — contact thermique`, key: b.key || `${key}_${body}`, partner: on, side: "A", face: front.face, level: front.level, at: front.at, params: { w: Math.min(4, b.w), h: Math.min(4, b.w) } }); }
    else if (b.end === "volt") { const front = tipSpot(def, b, 3, side), tab = `vs_${body}`, h = K.size[2], tw2 = b.tabW > 0 ? Math.min(b.tabW, Math.max(1, b.w - 1)) : Math.max(1, b.w - 1); bodies[tab] = { material: "CU-C110", net, kind: "conductor", label: `Prise ${b.id} ${net}` };
      features.push({ op: "box", id: tab, name: `${K.label} de ${b.id}`, body: tab, ...boxOn(front, 4, tw2, h) });
      interfaces.push({ id: b.id, type: "weld", name: `${K.label} ${b.id}${b.net ? ` — ${b.net}` : ""}`, key: b.key || `${key}_${body}`, partner: on, side: "A", face: front.face, level: r2(front.level + (front.face[0] === "+" ? h : -h)), at: front.at, ...(front.along ? { rot: 90 } : {}),
        params: { process: b.process || "laser", w: 4, h: tw2, n: 1, t: h, wire: 0.3, wireMat: "Al", i: 0 } }); }
    else if (b.end === "slot") { const back = tipSpot(def, b, 3, -side), front = tipSpot(def, b, 3, side), st = `raid_${body}`, tk = r2(Math.max(0.05, 0.3 - def.t)); bodies[st] = { material: "FR4", kind: "insulator", label: `Raidisseur ${b.id}` };
      features.push({ op: "box", id: st, name: `Raidisseur de la languette ${b.id}`, body: st, ...boxOn(back, 6, b.w, tk) });
      interfaces.push({ id: b.id, type: "rail", name: `Languette ${b.id} dans sa fente clipsée`, key: b.key || `${key}_${body}`, partner: on, side: "A", face: front.face, level: front.level, at: front.at, ...(front.along ? {} : { rot: 90 }), params: { t: 0.3, depth: 5, length: b.w } }); }
    else { const front = tipSpot(def, b, 2.5, side); interfaces.push({ id: b.id, type: "planar", name: `Plages de ${b.id}`, key: b.key || `${key}_${body}`, partner: on, side: "A", face: front.face, level: front.level, at: front.at, params: { w: Math.min(4, b.w), h: Math.min(4, b.w) } }); }
    void k;
  });
  for (const p of def.spots || []) {      // a spot : on the face toward its target, the component itself pressed on it (through a pad)
    const K = SENSOR_KINDS[p.end]; if (!K) continue;
    const top = p.side !== -1, body = `sp_${slug(p.id)}`, [sx, sy, h] = K.size, z = top ? def.t : -h, level = top ? r2(def.t + h) : r2(-h), net = p.net || p.id;
    bodies[body] = p.end === "temp" ? { material: "GENERIC-COMPONENT", kind: "insulator", label: `Sonde ${p.id}` } : { material: "CU-C110", net, kind: "conductor", label: `Prise ${p.id} ${net}` };
    features.push({ op: "box", id: body, name: `${K.label} ${p.id}`, body, size: [sx, sy, h], at: [r2(p.x - sx / 2), r2(p.y - sy / 2), z] });
    interfaces.push(p.end === "temp" ? { id: p.id, type: "planar", name: `${K.label} ${p.id} — contact thermique`, key: p.key || `${key}_${slug(p.id)}`, partner: p.on || "Ce qu'elle surveille", side: "A", face: top ? "+Z" : "-Z", level, at: [p.x, p.y], params: { w: 4, h: 4 } }
      : { id: p.id, type: "weld", name: `${K.label} ${p.id}${p.net ? ` — ${p.net}` : ""}`, key: p.key || `${key}_${slug(p.id)}`, partner: p.on || "Busbar ou borne de cellule", side: "A", face: top ? "+Z" : "-Z", level, at: [p.x, p.y], params: { process: p.process || "laser", w: sx, h: sy, n: 1, t: h, wire: 0.3, wireMat: "Al", i: 0 } });
  }
  const up = !rigid || rigid.side === "over";
  interfaces.unshift({ id: "IF1", type: "planar", name: rigid ? `Carte rigide — ${rigid.side === "under" ? "sous" : "sur"} le cœur du circuit` : "Cœur du circuit — pose sur la carte", key: `${key}_coeur`, partner: "Carte ou support", side: "A", face: up ? "+Z" : "-Z", level: up ? r2(def.t + (rigid ? rigid.t : 0)) : -rigid.t, at: [r2(c.L / 2), r2(c.W / 2)], params: { w: c.L, h: c.W } });
  const mine = new Set(["IF1", ...def.branches.map((b) => b.id), ...(def.spots || []).map((p) => p.id)]), kept = ((before && before.interfaces) || []).filter((i) => !mine.has(i.id) && !/^(B|TS|VS)\d+$/.test(i.id));
  const folds = def.branches.reduce((a, b) => a + b.legs.length - 1, 0);
  return { ...(before ? { revision: before.revision, characteristics: before.characteristics, ...(before.look ? { look: before.look } : {}) } : {}), dw: "part/1", id, name: def.name || "Circuit flexible ramifié", function: `Relie ${def.branches.length} point(s) de mesure ou de raccordement à un cœur de ${fr(c.L)} × ${fr(c.W)} mm`,
    family: "flex", process: "purchased", material: "PI-FILM", elec: { kind: "insulator" }, flex: JSON.parse(JSON.stringify(def)), bodies, params: {}, features: [...features, { op: "interfaces" }], interfaces: [...interfaces, ...kept],
    notes: [`Polyimide de ${fr(def.t)} mm, cuivre de ${fr(def.cu * 1000)} µm, ${def.layers === 1 ? "simple face" : "double face"} ; cœur de ${fr(c.L)} × ${fr(c.W)} mm, ${def.branches.length} branche(s), ${ch.tracks} piste(s), ${folds} pli(s).`,
      ...def.branches.map((b) => `${b.id} : ${EDGES[b.edge] ? EDGES[b.edge].fr : b.edge}, ${fr(b.w)} mm de large, ${b.legs.map((g, i) => `${i ? (g.bend > 0 ? "pli Z+ puis " : "pli Z− puis ") : ""}${fr(g.L)} mm`).join(", ")} → ${(ENDS[b.end] || ENDS.free).label.toLowerCase()}${b.end === "volt" && b.net ? ` ${b.net}` : ""}${b.on ? ` (${b.on})` : ""}.`),
      ...((def.spots || []).length ? [`${def.spots.length} point(s) sur le cœur : ${def.spots.map((p) => `${p.id} (${(SENSOR_KINDS[p.end] || { label: p.end }).label.toLowerCase()}${p.end === "volt" && p.net ? ` ${p.net}` : ""})`).join(", ")}.`] : []),
      ...(folds ? [`Plis à 90°, rayon intérieur ${fr(def.r)} mm (au moins ${BEND_RATIO[def.layers] || 12} × l'épaisseur pour une pose statique) ; aucun composant ni trou métallisé dans un pli.`] : []),
      ...(rigid ? [`Carte rigide de ${fr(rigid.t)} mm montrée ${rigid.side === "under" ? "sous" : "sur"} le cœur : un corps de cette pièce, pour la place qu'elle prend — sa définition est celle de la carte.`] : []),
      "Géométrie de principe : une bande de cuivre par branche tient lieu de ses pistes ; le routage sur le cœur, les fenêtres du vernis et les plages ne sont pas dessinés."] };
}
/** The list of the guide : what is to correct, to enter, to check, and a word of advice. → [{ level, text, id (the branch), field }] */
export function treeGuide(def) {
  const LEVEL = { bad: "error", todo: "todo", check: "warn" }, out = treeChecks(def).notes.map((n) => ({ level: LEVEL[n.level] || "tip", text: n.text, id: n.id, field: n.field }));
  if (!def.branches.length) out.push({ level: "todo", text: "Aucune branche : choisissez à droite le bord qu'elle quitte, ou clic droit sur le cœur, dans la vue.", id: null, field: "add" });
  if (!def.rigid && def.branches.length) out.push({ level: "tip", text: "Montrez la carte rigide, sur ou sous le cœur : sa place se juge avec celle des branches.", id: null, field: "rigid" });
  return out;
}
/** What a point of the model belongs to : { branch } over a branch, { edge, at } — the nearest edge of the core and the place along it — on the core. */
export function whereOn(def, p) {
  const c = def.core, [x, y] = p, e = 1e-6;
  if (x >= -e && x <= c.L + e && y >= -e && y <= c.W + e) { const d = [["-X", x, y], ["+X", c.L - x, y], ["-Y", y, x], ["+Y", c.W - y, x]].sort((a, b) => a[1] - b[1])[0]; return { edge: d[0], at: r2(d[2]) }; }
  const b = def.branches.find((q) => { const E = EDGES[q.edge]; if (!E) return false; const out = E.axis === 0 ? (E.sign > 0 ? x > c.L : x < 0) : (E.sign > 0 ? y > c.W : y < 0); return out && Math.abs((E.axis === 0 ? y : x) - q.at) <= q.w / 2 + 0.3; });
  return b ? { branch: b.id } : null;
}
/** The centre line of a branch, in the model : from the edge of the core to its tip, through each fold. */
export function centerLine(def, b) { const F = branchFrame(def, b), pts = F.legs.map((g, i) => F.model(g.C[0] + (i ? 0 : ROOT), 0, g.C[1])), g = F.legs.at(-1); pts.push(F.model(g.C[0] + g.d[0] * g.L, 0, g.C[1] + g.d[1] * g.L)); return pts.map((q) => q.map(r2)); }
/** A definition put back in order — what comes from a file or from an AI : numbers where numbers go, folds of ±90°, the first part flat, a branch with at least one part. */
export function tidyTree(raw) {
  const { rigid: _r, branches: _b, ...base } = blankTree(), d = { ...base, ...(raw || {}) }, num = (v, f) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : f);
  d.core = { L: num((d.core || {}).L, 50), W: num((d.core || {}).W, 30) }; d.rigid = d.rigid && typeof d.rigid === "object" ? { side: d.rigid.side === "under" ? "under" : "over", t: num(d.rigid.t, 1.6) } : null;
  d.branches = (Array.isArray(d.branches) ? d.branches : []).filter((b) => b && typeof b === "object").map((b, k) => ({ ...b, id: String(b.id || `B${k + 1}`), edge: EDGES[b.edge] ? b.edge : "+X", at: num(b.at, 5), w: num(b.w, 4), end: ENDS[b.end] ? b.end : "free",
    legs: (Array.isArray(b.legs) && b.legs.length ? b.legs : [{ L: 20 }]).map((g, i) => (i ? { L: num((g || {}).L, 10), bend: num((g || {}).bend, 90) < 0 ? -90 : 90 } : { L: num((g || {}).L, 20) })) }));
  if (Array.isArray(d.spots)) d.spots = d.spots.filter((p) => p && typeof p === "object").map((p, k) => ({ ...p, id: String(p.id || `S${k + 1}`), x: num(p.x, 5), y: num(p.y, 5), end: p.end === "volt" ? "volt" : "temp", side: p.side === -1 ? -1 : 1 }));
  else delete d.spots;
  return d;
}
/** Writes a flexible circuit, whichever its kind : a single strip, or a core and its branches. */
export const writeFlex = (def, id, before = null) => (isTree(def) ? treePart(def, id, before) : flexPart(def, id, before));
/** A new branch on an edge, with the next number, at the first free place of that edge. */
export function addBranch(def, edge, o = {}) {
  const E = EDGES[edge] || EDGES["+X"], span = E.along === "W" ? def.core.W : def.core.L, w = o.w || 4, taken = def.branches.filter((b) => b.edge === edge).sort((a, b) => a.at - b.at);
  let at = w / 2 + 1; for (const t of taken) { if (at + w / 2 + 1 <= t.at - t.w / 2) break; at = t.at + t.w / 2 + 1 + w / 2; }
  const n = def.branches.reduce((m, b) => Math.max(m, parseInt(String(b.id).replace(/\D/g, ""), 10) || 0), 0) + 1;
  const b = { id: `B${n}`, edge, at: r2(Math.min(at, span - w / 2)), w, legs: [{ L: 20 }], end: "temp", ...o };
  def.branches.push(b); return b;
}
