/* DesignWizard.ai — PCBA: the design-rule check of an assembled board. Geometry first (short circuits, clearances,
   widths, drills, edges, placement), then what the assembler and the test bench will meet (fiducials, both sides,
   decoupling, test access, coating). Every finding carries the measured value, the limit and where it is. */

import { resolveBoard, netRules, boardBom, trackForCurrent } from "./model.js";
import { connectivity, ratsnest } from "./connect.js";
import { padShape, discShape, trackShapes, gap, edgeGap, shapeBox, dist } from "./geom2d.js";
import { PCB_THICKNESS } from "../cad/standards.js";
import { PCBA_RULES } from "./drc_rules.js";

const fr = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const overlap = (a, b, m = 0) => a[0] < b[2] + m && b[0] < a[2] + m && a[1] < b[3] + m && b[1] < a[3] + m;
const centre = (s) => (s.rect ? [(s.rect[0] + s.rect[2]) / 2, (s.rect[1] + s.rect[3]) / 2] : [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]);
/** Value of a component as a number, for comparing two lines of the bill of materials : "4,7 kΩ" → 4700. */
function valueOf(text) {
  const m = /^\s*([\d]+(?:[.,]\d+)?)\s*([pnµumkM]?)/.exec(String(text || "")); if (!m) return null;
  return +m[1].replace(",", ".") * ({ p: 1e-12, n: 1e-9, "µ": 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6 }[m[2]] || 1);
}

/** Checks a board. → { findings, summary: { error, warn, info }, stats, ok } */
export function checkBoard(board, lib = {}, opts = {}) {
  const R = resolveBoard(board, lib), fab = R.fab, b = board.board || {}, findings = [], spec = new Map((board.parts || []).map((p) => [p.ref, p]));
  const add = (rule, message, x = {}) => findings.push({ rule, severity: x.severity || PCBA_RULES[rule].severity, title: PCBA_RULES[rule].title, message, at: x.at || null, layer: x.layer || null, refs: x.refs || [], nets: x.nets || [], measured: x.measured ?? null, limit: x.limit ?? null });
  for (const p of R.problems) add("PCBA-04", p, { severity: "error" });
  const coated = b.coating && b.coating.type && b.coating.type !== "none", netOf = new Map(R.nets.map((n) => [n.name, n]));
  const bare = (a, c) => { const x = netOf.get(a), y = netOf.get(c), r = (n) => netRules({ ...board, board: { ...b, coating: { type: "AR" } } }, n || null); return Math.max(r(x).clearance, r(y).clearance); };   // clearance if the board were coated

  /* ---------- copper : every shape with its net and its layers ---------- */
  const items = [];
  R.pads.forEach((p) => items.push({ s: padShape(p), net: p.net, layers: p.layers, ref: p.ref, what: p.pin, pad: p }));
  R.tracks.forEach((t, ti) => { for (const s of trackShapes(t)) items.push({ s, net: t.net, layers: [t.layer], what: `piste ${t.net}`, track: ti }); });
  for (const v of R.vias) items.push({ s: discShape(v.x, v.y, v.d), net: v.net, layers: R.layers, what: `via ${v.net}`, via: v });
  const cmax = Math.max(0.2, ...R.nets.map((n) => n.rules.clearance)), cell = Math.max(2, 2 * cmax), grid = new Map();
  items.forEach((it, i) => { it.box = shapeBox(it.s); for (let gx = Math.floor((it.box[0] - cmax) / cell); gx <= Math.floor((it.box[2] + cmax) / cell); gx++) for (let gy = Math.floor((it.box[1] - cmax) / cell); gy <= Math.floor((it.box[3] + cmax) / cell); gy++) { const k = gx * 100003 + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
  const seen = new Set(), worst = new Map(), wouldPass = new Set();
  let minSpace = Infinity;
  for (const list of grid.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const i = list[x], j = list[y], a = items[i], c = items[j];
    if ((a.net && a.net === c.net) || (a.pad && c.pad && a.ref === c.ref) || !a.layers.some((l) => c.layers.includes(l))) continue;
    const need = R.rules.clearance(a.net, c.net);
    if (!overlap(a.box, c.box, need) || seen.has(i * 1e6 + j)) continue;
    seen.add(i * 1e6 + j);
    const d = gap(a.s, c.s);
    if (d < minSpace) minSpace = d;
    if (d >= need - 1e-6) continue;
    const short = d <= 1e-6, key = `${short ? "S" : "C"}|${[a.net || a.what, c.net || c.what].sort().join("|")}`, w = worst.get(key);
    if (!short && !coated && d >= bare(a.net, c.net) - 1e-6) wouldPass.add(key);
    if (!w || d < w.d) worst.set(key, { d, a, c, need, short, n: (w ? w.n : 0) + 1 }); else w.n++;
  }
  for (const [key, w] of worst) {
    const at = centre(w.a.s), layer = w.a.layers.find((l) => w.c.layers.includes(l)), more = w.n > 1 ? ` (${w.n} endroits)` : "", names = `${w.a.what}${w.a.pad && w.a.net ? ` (${w.a.net})` : ""} et ${w.c.what}${w.c.pad && w.c.net ? ` (${w.c.net})` : ""}`;
    if (w.short) add("PCBA-01", `${names} se touchent${more}.`, { at, layer, nets: [w.a.net, w.c.net].filter(Boolean), refs: [w.a.ref, w.c.ref].filter(Boolean), measured: 0, limit: w.need });
    else add("PCBA-02", `${fr(w.d, 3)} mm entre ${names}${more} ; minimum ${fr(w.need)} mm.`, { at, layer, nets: [w.a.net, w.c.net].filter(Boolean), refs: [w.a.ref, w.c.ref].filter(Boolean), measured: w.d, limit: w.need });
    if (wouldPass.has(key)) add("PCBA-61", `Avec un vernis de tropicalisation, ${fr(w.d, 3)} mm entre ${w.a.net || w.a.what} et ${w.c.net || w.c.what} suffiraient (colonne A5 d'IPC-2221B).`, { at, nets: [w.a.net, w.c.net].filter(Boolean) });
  }
  const hv = R.nets.filter((n) => n.class === "hv" || Math.abs(n.voltage) >= 60);
  if (hv.length) {
    add("PCBA-60", `${hv.map((n) => n.name).join(", ")} : espacements calculés selon IPC-2221B, colonne ${coated ? "A5 (carte vernie)" : "B2 (carte nue)"}.`, { severity: "info", nets: hv.map((n) => n.name) });
    if (coated && b.coating.sides === "top" && items.some((it) => hv.some((n) => n.name === it.net) && it.layers.includes("bottom"))) add("PCBA-60", "Le vernis ne couvre que le dessus alors que du cuivre haute tension se trouve dessous : l'espacement « carte vernie » n'y vaut pas.", { nets: hv.map((n) => n.name), layer: "bottom" });
  }

  /* ---------- widths, edges, drills ---------- */
  const narrow = new Map(), touches = (t) => items.filter((it) => it.pad && it.net === t.net && it.layers.includes(t.layer) && trackShapes(t).some((s) => gap(s, it.s) <= 1e-3));
  R.tracks.forEach((t) => {
    if (t.w < fab.track - 1e-6) add("PCBA-03", `Piste ${t.net} de ${fr(t.w, 3)} mm ; le fabricant tient ${fr(fab.track)} mm.`, { at: t.pts[0], layer: t.layer, nets: [t.net], measured: t.w, limit: fab.track });
    else { const need = R.rules.of(t.net).need; if (need > t.w + 1e-6) { const lim = Math.min(Infinity, ...touches(t).map((it) => Math.min(it.pad.w, it.pad.h) - 0.1)); if (t.w < Math.min(need, lim) - 1e-6 && !narrow.has(t.net)) narrow.set(t.net, { t, need }); } }
  });
  for (const [net, x] of narrow) add("PCBA-03", `Piste ${net} de ${fr(x.t.w)} mm alors que le courant du net (${fr(netOf.get(net).current)} A) demande ${fr(x.need)} mm : élargissez le tronc, ou vérifiez que cette branche porte moins.`, { severity: "warn", at: x.t.pts[0], layer: x.t.layer, nets: [net], measured: x.t.w, limit: x.need });
  for (const it of items) { const d = edgeGap(it.s, R.outline); if (d < fab.edge - 1e-6) add("PCBA-05", `${it.what} à ${fr(Math.max(d, 0), 3)} mm du bord ; minimum ${fr(fab.edge)} mm.`, { at: centre(it.s), layer: it.layers[0], refs: it.ref ? [it.ref] : [], nets: it.net ? [it.net] : [], measured: d, limit: fab.edge }); }
  for (const pl of R.planes) if (pl.inset < fab.edge - 1e-6) add("PCBA-05", `Plan ${pl.net} à ${fr(pl.inset)} mm du bord ; minimum ${fr(fab.edge)} mm.`, { layer: pl.layer, nets: [pl.net], measured: pl.inset, limit: fab.edge });
  const drills = [...R.pads.filter((p) => p.drill).map((p) => ({ x: p.x, y: p.y, d: p.drill, land: Math.min(p.w, p.h), what: p.pin, ref: p.ref })), ...R.vias.map((v) => ({ x: v.x, y: v.y, d: v.drill, land: v.d, what: `via ${v.net}` })), ...R.holes.map((h, i) => ({ x: h.x, y: h.y, d: h.d, land: null, what: `trou ${i + 1}` }))];
  let minDrill = Infinity, minRing = Infinity;
  for (const h of drills) {
    minDrill = Math.min(minDrill, h.d);
    if (h.d < fab.drill - 1e-6) add("PCBA-10", `${h.what} : perçage de ${fr(h.d, 3)} mm ; minimum ${fr(fab.drill)} mm.`, { at: [h.x, h.y], measured: h.d, limit: fab.drill });
    if (h.land !== null) { const ring = (h.land - h.d) / 2; minRing = Math.min(minRing, ring); if (ring < fab.ring - 1e-6) add("PCBA-11", `${h.what} : couronne de ${fr(ring, 3)} mm ; minimum ${fr(fab.ring, 3)} mm.`, { at: [h.x, h.y], measured: ring, limit: fab.ring }); }
  }
  for (let i = 0; i < drills.length; i++) for (let j = i + 1; j < drills.length; j++) { const a = drills[i], c = drills[j]; if (a.ref && a.ref === c.ref) continue; const wall = dist([a.x, a.y], [c.x, c.y]) - (a.d + c.d) / 2; if (wall < fab.holeGap - 1e-6) add("PCBA-12", `${a.what} et ${c.what} : ${fr(Math.max(wall, 0), 3)} mm de paroi à paroi ; minimum ${fr(fab.holeGap)} mm.`, { at: [a.x, a.y], measured: wall, limit: fab.holeGap }); }
  for (const v of R.vias) { const p = R.pads.find((q) => !q.drill && Math.abs(v.x - q.x) < q.w / 2 && Math.abs(v.y - q.y) < q.h / 2); if (p) add("PCBA-13", `Un via ${v.net} est posé dans la pastille ${p.pin}.`, { at: [v.x, v.y], refs: [p.ref], nets: [v.net] }); }
  const conn = connectivity(R), rats = ratsnest(R, conn);
  for (const n of conn.nets) if (n.open) { const l = rats.find((r) => r.net === n.name); add("PCBA-04", `${n.name} : ${n.open} liaison(s) à router.`, { at: l ? [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2] : null, nets: [n.name], measured: n.open, limit: 0 }); }

  /* ---------- placement ---------- */
  const placed = R.parts.filter((p) => spec.get(p.ref) && spec.get(p.ref).at), bb = R.bbox;
  for (const p of R.parts) if (!placed.includes(p)) add("PCBA-24", `${p.ref} (${p.def.name}) n'est pas placé.`, { refs: [p.ref] });
  placed.forEach((p, i) => {
    const s = spec.get(p.ref), body = [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2], edgy = s.edge || ["connector", "terminal"].includes(p.kind), box = edgy ? body : p.box;
    const out = Math.max(bb[0] - box[0], bb[1] - box[1], box[2] - bb[2], box[3] - bb[3]);
    if (out > 1e-6) add("PCBA-21", `${p.ref} dépasse de la carte de ${fr(out)} mm.`, { severity: edgy ? "warn" : "error", at: [p.x, p.y], refs: [p.ref], measured: out, limit: 0 });
    else if (!edgy && !s.corner && -out < 1 - 1e-6) add("PCBA-22", `${p.ref} est à ${fr(-out)} mm du bord ; minimum 1 mm.`, { at: [p.x, p.y], refs: [p.ref], measured: -out, limit: 1 });
    for (let j = i + 1; j < placed.length; j++) { const c = placed[j]; if (c.side === p.side && overlap(p.box, c.box, -0.01)) add("PCBA-20", `${p.ref} et ${c.ref} se recouvrent.`, { at: [(p.x + c.x) / 2, (p.y + c.y) / 2], refs: [p.ref, c.ref] }); }
    for (const h of R.holes) if (overlap(p.box, [h.x - h.land / 2 - 0.5, h.y - h.land / 2 - 0.5, h.x + h.land / 2 + 0.5, h.y + h.land / 2 + 0.5], -0.01)) add("PCBA-23", `${p.ref} est sous la tête de vis d'un trou de fixation.`, { at: [h.x, h.y], refs: [p.ref] });
  });
  for (const h of R.holes) { const head = discShape(h.x, h.y, h.land + 1), it = items.find((x) => !x.pad && gap(x.s, head) < -1e-6); if (it) add("PCBA-23", `${it.what} passe sous la tête de vis d'un trou de fixation.`, { at: [h.x, h.y], nets: it.net ? [it.net] : [] }); }

  /* ---------- assembly, test, board, coating ---------- */
  const dam = new Map();
  for (let i = 0; i < R.pads.length; i++) for (let j = i + 1; j < R.pads.length; j++) { const a = R.pads[i], c = R.pads[j]; if (a.ref !== c.ref || a.net === c.net || !a.layers.some((l) => c.layers.includes(l))) continue; const d = gap(padShape(a), padShape(c)) - 2 * fab.maskExp; if (d < fab.maskDam - 1e-6 && (!dam.has(a.ref) || d < dam.get(a.ref))) dam.set(a.ref, d); }
  for (const [ref, d] of dam) add("PCBA-30", `${ref} : ${fr(Math.max(d, 0), 3)} mm de vernis entre deux pastilles ; minimum ${fr(fab.maskDam)} mm.`, { refs: [ref], measured: d, limit: fab.maskDam });
  const smdSide = (s) => placed.filter((p) => p.side === s && p.pads.some((i) => !R.pads[i].drill) && !["fiducial", "testpoint"].includes(p.kind)), thtSide = (s) => placed.filter((p) => p.side === s && p.pads.some((i) => R.pads[i].drill));
  if (smdSide("top").length && smdSide("bottom").length) add("PCBA-31", `${smdSide("top").length} composants montés en surface dessus et ${smdSide("bottom").length} dessous : deux passages au four.`);
  const tht = [...thtSide("top"), ...thtSide("bottom")];
  if (tht.length) add("PCBA-32", `${tht.length} composant(s) traversant(s) (${tht.slice(0, 6).map((p) => p.ref).join(", ")}${tht.length > 6 ? "…" : ""}) : brasage manuel, sélectif ou à la vague.${thtSide("top").length && thtSide("bottom").length ? " Ils sont des deux côtés." : ""}`, { severity: thtSide("top").length && thtSide("bottom").length ? "warn" : "info", refs: tht.map((p) => p.ref) });
  for (const s of ["top", "bottom"]) { const n = placed.filter((p) => p.side === s && p.kind === "fiducial").length; if (smdSide(s).length && n < 3) add("PCBA-33", `${n ? `${n} mire(s) seulement` : "Aucune mire"} ${s === "top" ? "dessus" : "dessous"} : il en faut trois, non alignées, pour le placement automatique.`, { layer: s, measured: n, limit: 3 }); }
  const byComp = new Map(); for (const p of placed) if (p.def.polar && p.pads.length > 1) { if (!byComp.has(p.comp)) byComp.set(p.comp, new Set()); byComp.get(p.comp).add(p.rot); }
  for (const [comp, rots] of byComp) if (rots.size > 2) add("PCBA-34", `${R.parts.find((p) => p.comp === comp).def.name} : ${rots.size} orientations différentes.`, { refs: placed.filter((p) => p.comp === comp).map((p) => p.ref) });
  const bom = boardBom(board, lib), merge = [];
  for (let i = 0; i < bom.length; i++) for (let j = i + 1; j < bom.length; j++) { const a = bom[i], c = bom[j], va = valueOf(a.value), vc = valueOf(c.value); if (a.comp === c.comp && ["resistor", "capacitor"].includes(a.kind) && va && vc && va !== vc && Math.abs(va - vc) / Math.max(va, vc) < 0.05) merge.push(`${a.value} et ${c.value} (${a.package})`); }
  add("PCBA-35", `${bom.length} lignes pour ${placed.length} composants.${merge.length ? ` Valeurs voisines à regrouper : ${merge.join(" ; ")}.` : ""}${bom.some((l) => l.dnp) ? ` Non montés : ${bom.filter((l) => l.dnp).flatMap((l) => l.refs).join(", ")}.` : ""}`);
  for (const p of placed) {
    if (!["ic", "mcu", "sensor"].includes(p.kind)) continue;
    const far = [];
    for (const i of p.pads) { const pad = R.pads[i]; if (pad.type !== "power_in" || !pad.net) continue; const caps = netOf.get(pad.net).pads.map((k) => R.pads[k]).filter((q) => q.ref !== p.ref && R.parts.find((x) => x.ref === q.ref).kind === "capacitor"), d = Math.min(Infinity, ...caps.map((q) => dist([q.x, q.y], [pad.x, pad.y]))); if (caps.length && d > 4) far.push(`${pad.name} (broche ${pad.n}) à ${fr(d, 1)} mm`); }
    if (far.length) add("PCBA-36", `${p.ref} (${p.def.name}) : condensateur de découplage le plus proche de ${far.join(", ")} ; visez moins de 4 mm.`, { at: [p.x, p.y], refs: [p.ref] });
  }
  const probe = (n) => n.pads.some((i) => R.pads[i].drill || R.parts.find((x) => x.ref === R.pads[i].ref).kind === "testpoint"), blind = R.nets.filter((n) => ["power", "ground", "hv"].includes(n.class) && n.pads.length > 1 && !probe(n));
  if (blind.length) add("PCBA-40", `Sans accès de mesure : ${blind.map((n) => n.name).join(", ")}.`, { nets: blind.map((n) => n.name) });
  if (!PCB_THICKNESS.includes(R.t)) add("PCBA-50", `Épaisseur de ${fr(R.t)} mm : les épaisseurs courantes sont ${PCB_THICKNESS.map((t) => fr(t)).join(" · ")} mm.`, { measured: R.t });
  if (R.layers.length >= 4 && !R.planes.length) add("PCBA-51", "Quatre couches sans plan de masse ni plan d'alimentation.");
  const minTrack = R.tracks.length ? Math.min(...R.tracks.map((t) => t.w)) : null;
  if ((b.copper || 35) > 35 && ((minTrack !== null && minTrack < 0.2 - 1e-6) || minSpace < 0.2 - 1e-6)) add("PCBA-52", `Cuivre de ${b.copper} µm avec des pistes ou des isolements sous 0,2 mm.`, { measured: Math.min(minTrack ?? 1, minSpace) });
  if (R.w > 100 || R.h > 100) add("PCBA-53", `Carte de ${fr(R.w)} × ${fr(R.h)} mm.`);
  if (R.holes.length < 2) add("PCBA-54", `${R.holes.length} trou de fixation.`);
  if (coated) {
    const keep = placed.filter((p) => !p.coat), near = keep.filter((k) => placed.some((p) => p.coat && p.side === k.side && overlap(k.box, [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2], 1)));
    if (near.length) add("PCBA-62", `${near.map((p) => p.ref).join(", ")} : composant à vernir à moins de 1 mm de la zone épargnée.`, { refs: near.map((p) => p.ref) });
    if (placed.some((p) => p.kind === "testpoint")) add("PCBA-63", "Les points de test sont épargnés par le vernis ; programmez et essayez la carte avant de la vernir.");
  }

  const order = { error: 0, warn: 1, info: 2 }, summary = { error: 0, warn: 0, info: 0 };
  findings.sort((x, y) => order[x.severity] - order[y.severity] || x.rule.localeCompare(y.rule));
  for (const f of findings) summary[f.severity]++;
  const len = R.tracks.reduce((s, t) => s + t.pts.reduce((a, p, i) => (i ? a + dist(t.pts[i - 1], p) : 0), 0), 0), smd = R.pads.filter((p) => !p.drill).length;
  const stats = { pads: R.pads.length, smd, tht: R.pads.length - smd, tracks: R.tracks.length, vias: R.vias.length, minTrack, minSpace: Number.isFinite(minSpace) ? minSpace : null, minDrill: Number.isFinite(minDrill) ? minDrill : null, minRing: Number.isFinite(minRing) ? minRing : null,
    length: len, sides: ["top", "bottom"].filter((s) => placed.some((p) => p.side === s)), open: conn.open, lines: bom.length, probe: R.nets.length ? R.nets.filter(probe).length / R.nets.length : 0, checked: seen.size };
  return { findings, summary, stats, ok: summary.error === 0 };
}
export { trackForCurrent };
