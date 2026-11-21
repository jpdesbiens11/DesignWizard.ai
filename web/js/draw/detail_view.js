/* DesignWizard.ai — detail views of a part drawing (JP : « un outil pour choisir une zone → vue de détail à une autre échelle, les vues se
   replacent seules »). As mechanical modellers do it : a circle drawn on a view — its centre, then its radius — becomes a view of its own,
   lettered (DETAIL D), at a larger scale, the circle and its letter left on the view it comes from. A detail is kept on the part (`details`),
   in the coordinates of its view, so it follows the part and the scale of the sheet ; On / Off and copies as every entry of a model. It
   shows the lines of its view inside the circle — the dimensions stay on the views and in the tables. Pure (browser and Node). */

import { LW, STYLE, viewLabel } from "./drafting.js";

/** Letters of the details : not I, O, Q (ASME Y14.3 usage), not A B C (the datums, and the section A-A). */
export const DETAIL_LETTERS = "DEFGHJKLMNPRTUVWXYZ";
export const DETAIL_VIEWS = ["front", "top", "right"];
/** The standard scales a detail may take, largest first (the sheet keeps its own list : draw/part_drawing.js). */
export const DETAIL_SCALES = [[10, "10:1"], [5, "5:1"], [4, "4:1"], [2, "2:1"], [1, "1:1"], [0.5, "1:2"], [0.2, "1:5"]];
export const scaleName = (k) => (DETAIL_SCALES.find((s) => Math.abs(s[0] - k) < 1e-6) || [k, k >= 1 ? `${k}:1` : `1:${Math.round(100 / k) / 100}`])[1];
/** The scale a new detail takes : the first standard one at least twice the scale of the sheet. */
export const detailScaleFor = (sheetScale) => ([...DETAIL_SCALES].reverse().find((s) => s[0] >= 2 * sheetScale - 1e-9) || DETAIL_SCALES[0])[0];
/** The details that count (On). */
export const liveDetails = (spec) => ((spec && spec.details) || []).filter((d) => d && d.on !== false);
/** The next free letter of a part. */
export function nextLetter(spec) { const used = new Set(((spec && spec.details) || []).map((d) => d.letter)); return [...DETAIL_LETTERS].find((c) => !used.has(c)) || null; }
/** A new detail : view, centre (in the plane of the view, mm of the model), radius (mm of the model), scale. */
export function newDetail(spec, { view, at, r, scale }) {
  const letter = nextLetter(spec); if (!letter) return null;
  return { id: `det-${letter}`, letter, view, at: [Math.round(at[0] * 100) / 100, Math.round(at[1] * 100) / 100], r: Math.round(r * 100) / 100, scale };
}
/** A copy, born Off, with the next letter. */
export function copyDetail(spec, d) { const letter = nextLetter(spec); return letter ? { ...JSON.parse(JSON.stringify(d)), id: `det-${letter}`, letter, on: false } : null; }

/** The parts of a polyline inside a circle (centre c, radius r) → [[p, …]]. */
export function clipCircle(pts, c, r) {
  const out = []; let cur = null;
  const inside = (p) => Math.hypot(p[0] - c[0], p[1] - c[1]) <= r + 1e-9;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], dx = q[0] - p[0], dy = q[1] - p[1], fx = p[0] - c[0], fy = p[1] - c[1], A = dx * dx + dy * dy;
    if (A < 1e-18) continue;
    const B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r, D = B * B - 4 * A * C;
    if (D <= 0) { cur = null; continue; }
    const s = Math.sqrt(D), t0 = Math.max(0, (-B - s) / (2 * A)), t1 = Math.min(1, (-B + s) / (2 * A));
    if (t1 <= t0) { cur = null; continue; }
    const a = [p[0] + dx * t0, p[1] + dy * t0], b = [p[0] + dx * t1, p[1] + dy * t1];
    if (cur && t0 < 1e-9 && inside(p)) cur.push(b); else { cur = [a, b]; out.push(cur); }
    if (t1 < 1 - 1e-9) cur = null;
  }
  return out;
}
/** The lines of a view inside the circle of a detail, kept as the view keeps them. */
export function detailLines(view, d) {
  const out = {};
  for (const k of ["visible", "smooth", "hidden"]) out[k] = (view[k] || []).flatMap((seg) => clipCircle(seg.pts || seg, d.at, d.r)).map((pts) => ({ pts }));
  return out;
}
/** Draw a detail : its lines at scale k, the top-left corner of its circle at (x, y) ; the circle thin ; DETAIL D and its scale under it. */
export function drawDetail(sheet, view, d, x, y, k, hidden) {
  const T = (p) => [x + (p[0] - (d.at[0] - d.r)) * k, y + ((d.at[1] + d.r) - p[1]) * k], L = detailLines(view, d);
  const lines = (list, st) => { for (const s of list) if (s.pts.length > 1) sheet.polyline(s.pts.map(T), st); };
  if (hidden) lines(L.hidden, { ...STYLE.hidden, w: 0.2, color: "#555555" });
  lines(L.smooth, { w: LW.fine, color: "#444444" }); lines(L.visible, { w: LW.visible, cap: "round" });
  sheet.circle(x + d.r * k, y + d.r * k, d.r * k, { w: LW.thin, color: "#333333" });
  viewLabel(sheet, x + d.r * k, y + 2 * d.r * k + 5, `DETAIL ${d.letter}`, `SCALE ${scaleName(k)}`, { size: 3.6 });
  return T;
}
/** On the view it comes from : the circle (a phantom line) and its letter, outside the circle toward the upper right. T : the transform of that view, s : its scale. */
export function markDetail(sheet, T, d, s) {
  const c = T(d.at), r = d.r * s, a = -Math.PI / 4, p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], q = [p[0] + 4, p[1] - 4];
  sheet.circle(c[0], c[1], r, { w: LW.medium, dash: [6, 1.2, 1.2, 1.2, 1.2, 1.2] });
  sheet.line(p[0], p[1], q[0], q[1], { w: LW.thin }); sheet.text(q[0] + 0.8, q[1] - 0.4, d.letter, { size: 4.2, font: "bold" });
}
/** For the guide : a detail outside its view, two with one letter, a detail no larger than the sheet. o : { boxes (model bounds of the views : {x0, y0, x1, y1}), scale (of the sheet), id }. */
export function detailIssues(spec, o = {}) {
  const out = [], id = o.id || (spec && spec.id) || "Pièce", seen = new Set();
  for (const d of (spec && spec.details) || []) {
    if (!d) continue;
    if (seen.has(d.letter)) out.push({ level: "error", text: `${id} — dessin : deux vues de détail portent la lettre ${d.letter} ; changez-en une.`, field: `detail:${d.id}` }); seen.add(d.letter);
    if (d.on === false) continue;
    const b = o.boxes && o.boxes[d.view];
    if (b && (d.at[0] + d.r < b.x0 || d.at[0] - d.r > b.x1 || d.at[1] + d.r < b.y0 || d.at[1] - d.r > b.y1)) out.push({ level: "warn", text: `${id} — dessin : la vue de détail ${d.letter} ne couvre plus rien de la vue ${d.view.toUpperCase()} — la pièce a changé ; tracez-la de nouveau ou mettez-la à Off.`, field: `detail:${d.id}` });
    else if (o.scale && d.scale <= o.scale + 1e-9) out.push({ level: "tip", text: `${id} — dessin : la vue de détail ${d.letter} est à l'échelle ${scaleName(d.scale)}, pas plus grande que la feuille — un détail sert à agrandir ; choisissez une échelle plus grande.`, field: `detail:${d.id}` });
  }
  if (o.left) out.push({ level: "tip", text: `${id} — dessin : ${o.left} vue${o.left > 1 ? "s" : ""} de détail sur une feuille à part : la première n'avait plus de place, même à une échelle plus petite.`, field: null });
  return out;
}
/** What is wrong with the details an answer brings back (core/ai_more.js). → [text] */
export function detailCheck(list) {
  if (list == null) return [];
  if (!Array.isArray(list)) return ["« details » doit être une liste de vues de détail."];
  const out = [], letters = new Set();
  list.forEach((d, i) => {
    const w = `« details[${i}] »`;
    if (!d || typeof d !== "object") { out.push(`${w} : un objet { letter, view, at, r, scale }.`); return; }
    if (!DETAIL_LETTERS.includes(d.letter) || String(d.letter).length !== 1) out.push(`${w} : la lettre est une de ${DETAIL_LETTERS}.`); else if (letters.has(d.letter)) out.push(`${w} : la lettre ${d.letter} est déjà prise.`); letters.add(d.letter);
    if (!DETAIL_VIEWS.includes(d.view)) out.push(`${w} : la vue est ${DETAIL_VIEWS.join(", ")}.`);
    if (!(Array.isArray(d.at) && d.at.length === 2 && d.at.every(Number.isFinite))) out.push(`${w} : « at » est le centre [u, v] dans le plan de la vue, en mm.`);
    if (!(Number.isFinite(d.r) && d.r > 0)) out.push(`${w} : « r » est le rayon de la zone, en mm, positif.`);
    if (!DETAIL_SCALES.some((s) => Math.abs(s[0] - d.scale) < 1e-9)) out.push(`${w} : « scale » est une échelle normalisée (${DETAIL_SCALES.map((s) => s[0]).join(", ")}).`);
    if (d.on !== undefined && typeof d.on !== "boolean") out.push(`${w} : « on » est vrai ou faux.`);
  });
  return out;
}
