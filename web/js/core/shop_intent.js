/* DynamiteOrbit — the Shop companion: writes a part from its design INTENT, with no sketch.
   Input (the brief): what the part is for, its interfaces (type, shared parameters, which side of the part), the
   material, the process and the raw stock. Output: a complete part in the part language — stock from the rack,
   interfaces placed without clash, the smallest envelope that carries them, a commercial thickness chosen from what
   the interfaces need — and the list of decisions taken, in plain words. Deterministic: no AI call; the same brief
   also feeds the generic prompt when the user wants Claude to go further. */

import { INTERFACE_TYPES, patternPoints } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { material, MOLD_PROCESSES } from "../cad/materials.js";
import { STOCK_FORMS, PLATE_THICKNESS, ROUND_BARS, ANGLE_LEGS, ANGLE_THICKNESS, FLAT_THICKNESS, nextStd } from "../cad/stock.js";
import { SHEET_GAUGES } from "../cad/standards.js";
import { molded, moldProcess } from "./shop_mold.js";
import { extruded, extrusionProcess } from "./shop_extrusion.js";
import { foldedSheet, foldSides } from "./shop_folded.js";
import { engagement } from "./joint_health.js";
import { sheetSeries, sheetDefault, sheetWord, printProcess, laserProfile, AM_PROCESSES } from "../cad/special_processes.js";

const r1 = (x) => Math.round(x * 10) / 10;
const up = (x, step = 5) => Math.ceil((x - 1e-9) / step) * step;
const fr = (x) => r1(x).toLocaleString("fr-CA"), fr2 = (x) => (Math.round(x * 1000) / 1000).toLocaleString("fr-CA");
const P = (value, min, max, label, group = "Enveloppe", step = 1) => ({ value, min: r1(min), max: r1(max), step, unit: "mm", label, group });
const off = (base, d) => (Math.abs(d) < 1e-6 ? base : d > 0 ? `${base} + ${r1(d)}` : `${base} - ${r1(-d)}`);
const slug = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40).replace(/^_+|_+$/g, "");

/** Forms the companion knows how to synthesise, with the process each one implies by default. */
export const SHOP_FORMS = { plate: "cnc_milling", sheet: "laser_cut", block: "cnc_milling", bar_flat: "cnc_milling", angle: "cnc_milling", bar_round: "cnc_turning", print: "fdm", molded: "injection_molding", profile: "extrusion_al" };
export const WHERE = { "+Z": "dessus", "-Z": "dessous", "-Y": "avant", "+Y": "arrière", "-X": "gauche", "+X": "droite" };

/** Footprint (u × v) of an interface on its face and the thickness it needs behind that face. */
export function footprint(it, mat) {
  const t = INTERFACE_TYPES[it.type], p = { ...t.params, ...(it.params || {}) }, side = it.side === "B" ? "B" : "A", plastic = material(mat) && material(mat).cls !== "metal";
  if (it.type === "bolt_pattern") {
    const th = thread(p.screw), pts = patternPoints(p.pattern), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), D = th.washer;
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), k = engagement(mat);
    const need = side === "A" ? Math.max(2, 0.8 * th.d) : plastic ? th.insert[1] + 1.5 : k * th.d;
    return { w: w + D, h: h + D, need, clear: [Math.max(0, w - D), Math.max(0, h - D)], edge: Math.max(1.5 * th.d, 4),
      why: side === "A" ? `passage ${p.screw} : au moins ${fr(need)} mm sous la tête` : plastic ? `insert ${p.screw} : ${fr(need)} mm` : `taraudage ${p.screw} : ${fr(k)} × d = ${fr(need)} mm en prise` };
  }
  if (it.type === "planar") return { w: p.w, h: p.h, need: 2, clear: [0, 0], edge: 0, why: "appui plan" };
  if (it.type === "bond") { const well = side === "B" && it.opts && it.opts.well && p.adhesive !== "tape", lip = well ? Math.max(0, Number(p.lip) || 0) : 0;      // a glue well takes its lip all round, and matter under its floor
    return { w: p.w + 2 * lip, h: p.h + 2 * lip, need: well ? Math.max(2, r1(p.gap + 1.5)) : 2, clear: [0, 0], edge: well ? 0 : 1, lip, why: `plage de collage ${fr(p.w)} × ${fr(p.h)} mm, film de ${fr(p.gap)} mm${well ? `, lèvre d'appui de ${fr(lip)} mm` : ""}` }; }
  if (it.type === "fit") return side === "A" ? { w: p.d, h: p.d, need: Math.max(3, 0.3 * p.d), clear: [0, 0], edge: 2, why: `épaulement de l'arbre Ø${fr(p.d)}`, spigot: p.length }
    : { w: p.d + 2 * Math.max(3, 0.4 * p.d), h: p.d + 2 * Math.max(3, 0.4 * p.d), need: p.length + 1.5, clear: [0, 0], edge: 0, why: `alésage Ø${fr(p.d)} de ${fr(p.length)} mm + fond` };
  if (it.type === "cutout") { const fix = p.fix && p.fix.screw ? (p.fix.pitch || (p.w || p.d) + 8) + thread(p.fix.screw).washer : 0;
    return p.shape === "round" ? { w: Math.max(p.d, fix), h: p.d, need: 1, clear: [0, 0], edge: 4, why: "ouverture" } : { w: Math.max(p.w, fix), h: p.h, need: 1, clear: [0, 0], edge: 4, why: "ouverture" }; }
  if (it.type === "weld" || it.type === "contact") return { w: p.w, h: p.h, need: it.type === "contact" ? 1.5 : 0.2, clear: [0, 0], edge: 1, why: it.type === "contact" ? `plage de contact ${fr(p.w)} × ${fr(p.h)} mm` : `zone de soudure ${fr(p.w)} × ${fr(p.h)} mm` };
  if (it.type === "rail") return { w: p.length, h: p.t + 3, need: side === "B" ? p.depth + 1.5 : 1, clear: [0, 0], edge: 2, why: `rainure de ${fr(p.depth)} mm + fond` };
  if (it.type === "pins") { const n = Math.max(1, Math.round(p.n || 2)); return { w: (n - 1) * p.pitch + 4 * p.d, h: 4 * p.d, need: side === "A" ? p.d : 1.5 * p.d, clear: [0, 0], edge: 2 * p.d, why: `goupilles Ø${fr(p.d)} : ${fr(side === "A" ? p.d : 1.5 * p.d)} mm de portée` }; }
  return { w: 10, h: 10, need: 2, clear: [0, 0], edge: 3, why: "" };
}

/** Place footprints on one face: a small one nests inside the bolt pattern of a large one when it fits, the rest sit in a row. */
export function arrange(items, gap = 6) {
  const order = [...items].sort((a, b) => b.fp.w * b.fp.h - a.fp.w * a.fp.h), row = [], notes = [];
  for (const it of order) {
    const host = row.find((h) => !h.guest && h.fp.clear[0] >= it.fp.w + 2 && h.fp.clear[1] >= it.fp.h + 2);
    if (host) { host.guest = it; it.host = host; notes.push(`« ${it.name} » tient à l'intérieur du motif de « ${host.name} » : les deux sont concentriques.`); } else row.push(it);
  }
  const total = row.reduce((s, it) => s + it.fp.w, 0) + gap * (row.length - 1);
  let x = -total / 2;
  for (const it of row) { it.du = r1(x + it.fp.w / 2); it.dv = 0; x += it.fp.w + gap; if (it.guest) { it.guest.du = it.du; it.guest.dv = 0; } }
  return { w: total, h: Math.max(0, ...row.map((it) => it.fp.h)), edge: Math.max(3, ...items.map((it) => it.fp.edge)), notes };
}

/** Which stock form suits the brief: a suggestion with its reason (the user keeps the last word). */
export function recommend(brief) {
  const faces = new Set((brief.interfaces || []).map((i) => i.where || "+Z")), axes = new Set([...faces].map((f) => f[1])), mat = material(brief.material);
  const q = Number(brief.quantity) || 1, plastic = mat && mat.cls !== "metal";
  const onlyAxis = (brief.interfaces || []).length > 0 && (brief.interfaces || []).every((i) => i.type === "fit" || (i.type === "bolt_pattern" && i.params && i.params.pattern && i.params.pattern.type === "circle"));
  const additive = plastic && ["fdm", "mjf", "sla"].find((k) => mat.processes.includes(k)), casts = mat && ["die_casting", "lp_die_casting", "permanent_mold", "sand_casting"].find((k) => mat.processes.includes(k));
  const holds = (brief.interfaces || []).some((i) => i.inside) || (brief.envelope && (brief.envelope.L || brief.envelope.W || brief.envelope.H));
  const extr = mat && mat.processes.find((k) => /^extrusion_/.test(k));
  if (mat && (mat.cls === "sheet" || mat.cls === "pcb")) return { form: "sheet", process: "laser_cut", why: `${mat.name} : une matière en feuille — la pièce se découpe à plat, au laser de précision.` };
  if (mat && mat.cls === "metal" && mat.processes.includes("lpbf") && !mat.processes.includes("cnc_milling")) return { form: "print", process: "lpbf", why: `${mat.name} : un alliage de fusion sur lit de poudre, la pièce s'imprime.` };
  if (mat && mat.cls === "metal" && mat.processes.includes("sheet_metal") && !mat.processes.includes("cnc_milling")) return axes.size > 1 || foldSides(brief).length ? { form: "sheet", process: "sheet_metal", why: `${mat.name} : une tôle — chaque plan d'appui latéral devient un bord plié à la presse plieuse.` } : { form: "sheet", process: "laser_cut", why: `${mat.name} : une tôle, découpée à plat au laser.` };
  if (extr && ((brief.contents || []).length || (brief.interfaces || []).some((i) => i.type === "rail" && i.side === "B"))) return { form: "profile", process: extr, why: "La pièce guide ce qu'elle contient sur toute sa longueur : un profilé extrudé, dessiné autour de ce qui glisse dedans." };
  if (casts && !mat.processes.includes("cnc_milling")) return { form: "molded", process: casts, why: `${mat.name} : un alliage de fonderie, la pièce se moule.` };
  if (holds && (casts || (plastic && mat.processes.includes("injection_molding") && q > 50))) return { form: "molded", process: casts || "injection_molding", why: `La pièce contient et porte d'autres pièces, en ${q} exemplaires : une coque moulée, dessinée autour de ce qu'elle loge.` };
  if (additive && q <= 20) return { form: "print", process: additive, why: `Matière plastique et ${q} pièce(s) : l'impression 3D évite tout outillage.` };
  if (plastic && q <= 50) return { form: axes.size > 1 ? "block" : "plate", process: "cnc_milling", why: "Plastique en petite série : usinage dans une plaque ou un bloc." };
  if (onlyAxis && axes.size === 1 && axes.has("Z")) return { form: "bar_round", process: "cnc_turning", why: "Toutes les interfaces sont de révolution autour d'un même axe : pièce de tour, prise dans un rond." };
  if (axes.size === 1 && axes.has("Z")) {
    const tapped = (brief.interfaces || []).some((i) => i.type === "bolt_pattern" && i.side === "B");
    return !tapped && mat && mat.processes.includes("sheet_metal") && q >= 20 ? { form: "sheet", process: "laser_cut", why: "Interfaces sur les deux grandes faces, sans taraudage : une tôle découpée au laser, sans reprise." }
      : { form: "plate", process: "cnc_milling", why: "Interfaces sur le dessus et le dessous seulement : une plaque du commerce, un ou deux posages." };
  }
  if (axes.size === 2 && axes.has("Z") && (axes.has("Y") || axes.has("X")) && faces.size === 2) return { form: "angle", process: "cnc_milling", why: "Deux plans d'appui perpendiculaires : une cornière du commerce, percée, presque sans copeaux." };
  return { form: "block", process: "cnc_milling", why: "Interfaces sur plus de deux directions : un bloc scié, usiné face par face." };
}

function prepare(brief, log) {
  return (brief.interfaces || []).map((raw, i) => {
    const t = INTERFACE_TYPES[raw.type];
    if (!t) throw new Error(`Type d'interface inconnu « ${raw.type} ».`);
    const id = `IF${i + 1}`, name = raw.name || t.label, key = raw.key || slug(`${brief.name || "piece"}_${raw.partner || name}_${id}`);
    const it = { id, type: raw.type, name, key, partner: raw.partner || undefined, side: raw.side === "B" ? "B" : "A", where: raw.where || "+Z", inside: !!raw.inside, from: raw.from || undefined, external: raw.external ? true : undefined, params: JSON.parse(JSON.stringify({ ...t.params, ...(raw.params || {}) })), opts: raw.opts ? { ...raw.opts } : undefined };
    it.fp = footprint(it, brief.material);
    if (it.type === "bond" && it.fp.lip) log.push(`« ${name} » : logement de colle de ${fr(it.params.w)} × ${fr(it.params.h)} mm profond de ${fr(it.params.gap)} mm, entouré d'une lèvre d'appui de ${fr(it.fp.lip)} mm — la pièce qui s'appuie porte sur la lèvre, la colle garde son épaisseur.`);
    if (!raw.key) log.push(`Interface « ${name} » : clé « ${key} » créée ; la pièce voisine la reprendra telle quelle.`);
    return it;
  });
}
/** Tapped side of a bolt pattern: through in a thin wall, blind at the engagement the material needs in a block. */
const tapped = (it, through) => (it.type === "bolt_pattern" && it.side === "B" && !(it.opts && (it.opts.depth !== undefined || it.opts.thread === "insert" || it.opts.standoff)) ? { opts: { ...(it.opts || {}), depth: through ? "through" : r1(it.fp.need) } } : {});
const ifaceOut = (it, face, at, extra = {}) => { const o = { id: it.id, type: it.type, name: it.name, key: it.key, partner: it.partner, side: it.side, external: it.external, face, at, params: it.params, opts: it.opts, ...extra }; for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
function thickness(items, series, floor, log, what = "Épaisseur") {
  let need = floor, why = `minimum d'atelier ${fr(floor)} mm`;
  for (const it of items) if (it.fp.need > need) { need = it.fp.need; why = `${it.fp.why} (« ${it.name} »)`; }
  const t = nextStd(series, need) ?? up(need, 1);
  log.push(`${what} ${fr(t)} mm : ${why}${t > need + 1e-6 ? ` → taille du commerce suivante` : ""}.`);
  return t;
}

function flat(brief, all, log) {
  const tongue = all.find((it) => it.type === "rail" && it.side !== "B"), items = all.filter((it) => it !== tongue);     // a tongue : the part slides in the groove of its neighbour
  const sheet = brief.form === "sheet", lay = arrange(items), env = brief.envelope || {};
  let L = up(Math.max(lay.w + 2 * lay.edge, env.L || 0, 20)), W = up(Math.max(lay.h + 2 * lay.edge, env.W || 0, 15));
  const series = sheet ? sheetSeries(brief.material) : PLATE_THICKNESS, usual = sheet ? sheetDefault(brief.material) : null, asked = sheet && Number(brief.t) > 0 ? Number(brief.t) : null, word = sheet ? sheetWord(brief.material) : "Plaque";
  let t, r = Math.min(sheet ? 3 : 4, r1(lay.edge));
  if (asked) { t = asked; log.push(`${word} de ${fr2(t)} mm : épaisseur choisie${series.some((x) => Math.abs(x - t) < 1e-6) ? ", dans la série du commerce" : " — hors de la série du commerce de cette matière"}.`); }
  else if (usual) { t = usual; log.push(`${word} de ${fr2(t)} mm : l'épaisseur courante de cette matière — un isolant se choisit pour ce qu'il doit tenir, pas pour ses fixations.`); }
  else t = thickness(items, series, sheet ? Math.max(1, series[0]) : 3, log);
  const LP = sheet ? laserProfile(brief.material) : null;
  if (LP) { log.push(`Découpe : ${LP.source}${LP.verdict === "ok" ? ` — ${LP.edge}` : ` — ${LP.why}.`}`); if (LP.corner > 0) r = Math.max(r, LP.corner); }
  const soft = sheet && material(brief.material) && material(brief.material).cls !== "metal";      // paper, film, laminate, plastic : the edge is looked at, not deburred
  log.push(...lay.notes, `Enveloppe ${fr(L)} × ${fr(W)} mm : la plus petite qui porte les interfaces avec ${fr(lay.edge)} mm de matière au bord.`);
  if (tongue) { L = r1(tongue.params.length); t = r1(tongue.params.t); W = Math.max(W, 30); r = 0.5;
    log.push(`Languette « ${tongue.name} » : la pièce glisse dans la rainure de sa voisine — largeur ${fr(L)} mm et épaisseur ${fr(t)} mm imposées par la glissière ; l'interface est sur la tranche arrière, à mi-épaisseur, et la pièce s'accouple enfoncée jusqu'à affleurer.`); }
  const minL = Math.min(L, lay.w + 2 * lay.edge);
  /* the thickness of a sheet is written as it is sold (a film from 0,025 mm) : no rounding to the tenth */
  return { family: sheet ? "sheet" : "plate",
    params: { L: P(L, minL, Math.max(400, 2 * L), "Longueur"), W: P(W, Math.min(W, lay.h + 2 * lay.edge), Math.max(300, 2 * W), "Largeur"), t: sheet && !tongue ? { value: t, min: Math.min(series[0], t), max: Math.max(series[series.length - 1], t), step: t < 0.5 ? 0.005 : t < 1 ? 0.05 : 0.5, unit: "mm", label: "Épaisseur", group: "Enveloppe" } : P(t, sheet || tongue ? 0.5 : 3, sheet ? 6 : 50, "Épaisseur", "Enveloppe", tongue ? 0.1 : 0.5), r: P(r, 0, 20, "Rayon des coins", "Détails", 0.5) },
    stock: { form: brief.form, L: "L", W: "W", t: "t" },
    features: [{ op: "outline", id: "contour", name: "Contour", profile: { rect: [0, 0, "L", "W"], r: "r" } }, { op: "interfaces" }, soft ? { op: "deburr", id: "bord", note: "Sans ébavurage : dépoussiérer, contrôler le bord coupé (propre, non carbonisé)" } : { op: "deburr", id: "ebavurage" }],
    ...(soft ? { notes: ["Bord découpé au laser : propre, non carbonisé — contrôle visuel à la réception", `Tolérance de découpe ± ${fr2(LP ? LP.tol : 0.2)} mm, à convenir avec l'atelier`] } : {}),
    interfaces: [...items.map((it) => ifaceOut(it, it.where === "-Z" ? "-Z" : "+Z", [off("L/2", it.du), off("W/2", it.dv)], tapped(it, true))), ...(tongue ? [ifaceOut(tongue, "+Y", ["L/2", "t/2"])] : [])] };
}

function block(brief, items, log) {
  const env = brief.envelope || {}, need = { X: [20, 6], Y: [15, 6], Z: [6, 6] }, out = [], lays = {}, additive = brief.form === "print";
  const axesOf = { Z: ["X", "Y"], Y: ["X", "Z"], X: ["Y", "Z"] };
  for (const face of Object.keys(WHERE)) {
    const on = items.filter((it) => it.where === face);
    if (!on.length) continue;
    const lay = arrange(on), [a, b] = axesOf[face[1]];
    lays[face] = lay; log.push(...lay.notes);
    need[a][0] = Math.max(need[a][0], lay.w + 2 * lay.edge); need[b][0] = Math.max(need[b][0], lay.h + 2 * lay.edge);
    need[face[1]][1] = Math.max(need[face[1]][1], ...on.map((it) => it.fp.need + 2));
  }
  const dim = (ax, e) => Math.max(need[ax][0], need[ax][1], e || 0);
  const L = up(dim("X", env.L)), W = up(dim("Y", env.W)), Hn = dim("Z", env.H), H = additive ? up(Hn, 1) : (nextStd(brief.form === "bar_flat" ? FLAT_THICKNESS : PLATE_THICKNESS, Hn) ?? up(Hn));
  log.push(`Bloc ${fr(L)} × ${fr(W)} × ${fr(H)} mm : chaque face porte ses interfaces${additive ? "" : " ; la hauteur est une épaisseur du commerce, les deux grandes faces restent brutes"}.`);
  const centre = { X: "L/2", Y: "W/2", Z: "H/2" };
  const metal = material(brief.material) && material(brief.material).cls === "metal";      // a printed polymer takes heat-set inserts ; a printed metal is tapped after the print
  for (const it of items) { const [a, b] = axesOf[it.where[1]]; out.push(ifaceOut(it, it.where, [off(centre[a], it.du), off(centre[b], it.dv)], additive && !metal ? {} : tapped(it, false))); }
  const params = { L: P(L, need.X[0], Math.max(400, 2 * L), "Longueur"), W: P(W, need.Y[0], Math.max(300, 2 * W), "Largeur"), H: P(H, need.Z[0], Math.max(200, 2 * H), "Hauteur") };
  const stock = additive ? { form: "print" } : brief.form === "bar_flat" ? { form: "bar_flat", w: "W", h: "H", L: "L" } : { form: "block", L: "L", W: "W", H: "H" };
  const features = additive ? [{ op: "extrude", id: "corps", name: "Corps", profile: { rect: [0, 0, "L", "W"], r: 2 }, plane: "XY", length: "H" }, { op: "interfaces" }] : [{ op: "interfaces" }, { op: "deburr", id: "ebavurage" }];
  if (additive && !metal) for (const o of out) if (o.type === "bolt_pattern" && o.side === "B") o.opts = { thread: "insert", ...(o.opts || {}) };
  return { family: "prismatic", params, stock, features, interfaces: out };
}

function angle(brief, items, log) {
  const base = items.filter((it) => it.where[1] === "Z"), wall = items.filter((it) => it.where[1] !== "Z"), lb = arrange(base), lw = arrange(wall);
  const t = thickness(items, ANGLE_THICKNESS, 3, log, "Épaisseur de cornière"), leg = (lay) => nextStd(ANGLE_LEGS, t + lay.h + 2 * lay.edge) ?? up(t + lay.h + 2 * lay.edge);
  const A = leg(lb), B = leg(lw), Wd = up(Math.max(lb.w + 2 * lb.edge, lw.w + 2 * lw.edge, (brief.envelope || {}).L || 0, 20));
  log.push(...lb.notes, ...lw.notes, `Cornière ${fr(A)} × ${fr(B)} × ${fr(t)} mm coupée à ${fr(Wd)} mm : ailes du commerce, il ne reste qu'à percer.`);
  const wface = "-Y";
  if (wall.some((it) => it.where !== "-Y")) log.push("Les interfaces latérales sont portées par l'aile verticale, côté avant (−Y).");
  return { family: "prismatic",
    params: { A: P(A, 15, 100, "Aile horizontale"), B: P(B, 15, 100, "Aile verticale"), t: P(t, 2, 10, "Épaisseur", "Enveloppe", 0.5), W: P(Wd, 15, Math.max(300, 2 * Wd), "Largeur") },
    stock: { form: "angle", a: "A", b: "B", t: "t", L: "W" }, features: [{ op: "interfaces" }, { op: "deburr", id: "ebavurage" }],
    interfaces: [...base.map((it) => ifaceOut(it, "-Z", [off("W/2", it.du), "t + (A - t)/2"], it.side === "A" ? { opts: { ...(it.opts || {}), depth: "t + 0.5" } } : tapped(it, true))),
      ...wall.map((it) => ifaceOut(it, wface, [off("W/2", it.du), "t + (B - t)/2"], it.side === "A" ? { opts: { ...(it.opts || {}), depth: "t + 0.5" } } : tapped(it, true)))] };
}

function round(brief, items, log) {
  const spig = items.filter((it) => it.type === "fit" && it.side === "A"), rest = items.filter((it) => !spig.includes(it));
  let dNeed = 8;
  for (const it of rest) {
    const circular = it.type === "fit" || (it.type === "bolt_pattern" && it.params.pattern && it.params.pattern.type === "circle") || (it.type === "cutout" && it.params.shape === "round");
    dNeed = Math.max(dNeed, (circular ? Math.max(it.fp.w, it.fp.h) : Math.hypot(it.fp.w, it.fp.h)) + 2);
  }
  for (const it of spig) dNeed = Math.max(dNeed, it.params.d + 4);
  const D = nextStd(ROUND_BARS, dNeed) ?? up(dNeed), body = up(Math.max(6, (brief.envelope || {}).H || 0, ...rest.map((it) => it.fp.need + 2)), 1);
  log.push(`Rond Ø${fr(D)} mm : le plus petit diamètre du commerce qui porte les interfaces ; corps de ${fr(body)} mm.`);
  const top = spig.find((it) => it.where !== "-Z"), bottom = spig.find((it) => it !== top), features = [], out = [];
  let z0 = "0", total = "H";
  const params = { D: P(D, dNeed, Math.max(150, 2 * D), "Diamètre"), H: P(body, 3, Math.max(200, 4 * body), "Longueur du corps") };
  if (bottom) { z0 = `${r1(bottom.params.length)}`; features.push({ op: "turn", id: "portee_bas", name: `Portée Ø${fr(bottom.params.d)}`, from: 0, to: z0, d: bottom.params.d }); out.push(ifaceOut(bottom, "-Z", [0, 0], { level: z0 })); total = `H + ${z0}`; }
  if (top) { features.push({ op: "turn", id: "portee_haut", name: `Portée Ø${fr(top.params.d)}`, from: total, to: `${total} + ${r1(top.params.length)}`, d: top.params.d }); out.push(ifaceOut(top, "+Z", [0, 0], { level: total })); }
  for (const it of rest) out.push(ifaceOut(it, it.where === "-Z" ? "-Z" : "+Z", [0, 0], { ...tapped(it, false), level: it.where === "-Z" ? z0 : total }));
  if (spig.length) log.push("Les portées d'ajustement sont chariotées dans le rond : la longueur de barre les inclut.");
  features.push({ op: "interfaces" }, { op: "deburr", id: "ebavurage" });
  return { family: "turned", params, stock: { form: "bar_round", d: "D", L: top ? `${total} + ${r1(top.params.length)}` : total }, features, interfaces: out };
}

/** Write the part. Returns { spec, decisions, recommendation, form, proposed }. proposed : the interfaces the companion added of its
    own — a closure for a moulded housing, its joint plane — which the brief did not ask for : [{ id, type, name, side, face, params }].
    Throws with a French message when the brief cannot be built. */
export function synthesize(brief, id = "PN-0001") {
  const log = [], rec = recommend(brief), form = brief.form && SHOP_FORMS[brief.form] ? brief.form : rec.form;
  const b = { ...brief, form, process: brief.process || SHOP_FORMS[form], material: brief.material || (form === "print" ? "PA12" : form === "molded" ? "PC-ABS" : form === "profile" ? "AL6063-T5" : "AL6061-T6") };
  if (form === "profile") b.process = extrusionProcess(b.material);
  if (form === "molded") b.process = MOLD_PROCESSES.includes(brief.process) ? brief.process : moldProcess(b.material);
  if (form === "print" && !(brief.process && AM_PROCESSES[brief.process])) b.process = printProcess(b.material) || "fdm";
  const fold = form === "sheet" && foldSides(b).length > 0;      // a metal sheet with folded edges : the press brake after the laser
  if (form === "sheet") b.process = fold ? "sheet_metal" : "laser_cut";
  log.push(`Matière première : ${STOCK_FORMS[form].label.toLowerCase()} — ${form === rec.form ? rec.why : "choix de l'utilisateur."}`);
  const items = prepare(b, log);
  if (form === "angle" && !items.some((it) => it.where[1] === "Z")) log.push("Aucune interface sur le dessous : l'aile horizontale reste libre.");
  const core = form === "profile" ? extruded(b, items, log) : form === "molded" ? molded(b, items, log) : fold ? foldedSheet(b, items, log, { arrange, ifaceOut, tapped, P, off, up }) : (form === "plate" || form === "sheet") ? flat(b, items.map((it) => ({ ...it, where: it.where === "-Z" ? "-Z" : "+Z" })), log) : form === "angle" ? angle(b, items, log) : form === "bar_round" ? round(b, items, log) : block(b, items, log);
  const intent = {}; for (const k of ["loads", "environment", "quantity", "priority"]) if (brief[k] !== undefined && brief[k] !== "") intent[k] = brief[k];
  const spec = { dw: "part/1", id, name: brief.name || "Nouvelle pièce", function: brief.fn || "", family: core.family, process: core.process || b.process, material: b.material, ...(Object.keys(intent).length ? { intent } : {}),
    params: core.params, interfaces: core.interfaces, ...(core.stock ? { stock: core.stock } : {}), features: core.features, ...(core.mold ? { mold: core.mold } : {}), ...(core.extrusion ? { extrusion: core.extrusion } : {}), ...(core.folded ? { folded: core.folded } : {}),
    notes: core.notes || ["Casser les angles vifs 0,2 à 0,5 mm", "Tolérances générales ISO 2768-mK"], interview: { questions: [], assumptions: log } };
  const asked = new Set(items.map((it) => it.id)), proposed = (core.interfaces || []).filter((x) => !asked.has(x.id)).map((x) => ({ id: x.id, type: x.type, name: x.name, side: x.side, face: x.face, params: x.params }));
  return { spec, decisions: log, recommendation: rec, form, proposed };
}
