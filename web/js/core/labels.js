/* DynamiteOrbit — labels and stickers : what is stuck, riveted or marked on a product — a brand sticker, a rating plate,
   a warning. A label belongs to an assembly and sits on one instance, on a flat face or wrapped on a cylinder ; it has a
   size in millimetres, a rotation, and an artwork : the mark of the platform, a text, or an image the designer brings.
   The artwork is one SVG, at scale, used both as the texture of the 3D view and as the file sent to the printer.
   label = { id, name, kind: "sticker" | "plate" | "marking", inst, w, h, turn (degrees),
             on: { p: [x, y, z], n: [x, y, z] } on a flat face — or { p, axis: [x, y, z], c: [x, y, z], r } on a cylinder,
                  in the coordinates of the part : a point of the surface and its normal ; the axis, a point of it, the radius,
             art: { type: "logo" | "text" | "image", text, sub, ink, paper, shape: "rect" | "round" | "pill", src } }
   On a cylinder the label is developed without stretching : a millimetre on the label is a millimetre of arc.
   Pure : no kernel, no DOM. */

import { v3 } from "../cad/vec.js";
import { LOGO, drawLogo } from "./brand.js";

const r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ","), esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const LABEL_KINDS = {
  sticker: { label: "Sticker", fr: "Autocollant", text: "Un vinyle imprimé, posé à la main : il suit une face plane ou un cylindre", lift: 0.1, color: "#ee8a32" },
  plate: { label: "Nameplate", fr: "Plaque signalétique", text: "Une plaque mince rivetée ou collée : références, tensions, avertissements", lift: 0.5, color: "#5b7fa6" },
  marking: { label: "Direct marking", fr: "Marquage direct", text: "Gravé au laser ou tampographié sur la pièce : aucune épaisseur", lift: 0.03, color: "#25ad9f" },
};
export const LABEL_ARTS = {
  logo: { fr: "Marque DynamiteOrbit", text: "Le sigle et le nom de la plateforme" },
  text: { fr: "Texte", text: "Une ligne, et une seconde plus petite : un nom, une référence, un avertissement" },
  image: { fr: "Image", text: "Un fichier PNG, JPEG ou SVG que vous apportez" },
};
export const LABEL_SHAPES = { rect: "Angles vifs", round: "Coins arrondis", pill: "Bouts ronds" };
export const IMAGE_LIMIT = 400000;           // characters of a data URL kept in the project : beyond, the project file grows too fast
export const blankLabel = (id = "E1") => ({ id, name: "Autocollant", kind: "sticker", inst: null, w: 80, h: 30, turn: 0, on: null, art: { type: "text", text: "", sub: "", ink: "#1b2733", paper: "#ffffff", shape: "round" } });
/** The sticker of the platform : its mark and its name, dark on white. */
export const brandSticker = (id = "E1", patch = {}) => ({ ...blankLabel(id), name: "Sticker DynamiteOrbit", w: 180, h: 60, art: { type: "logo", text: "DynamiteOrbit", sub: "by DynamiteAgile™", ink: "#26323f", paper: "#ffffff", shape: "round" }, ...patch });
export const nextLabelId = (list) => `E${(list || []).reduce((m, l) => Math.max(m, parseInt(String(l.id).replace(/\D/g, ""), 10) || 0), 0) + 1}`;
export const isWrapped = (label) => !!(label && label.on && Array.isArray(label.on.axis) && label.on.r > 0);

/** Where a label sits, from a point picked on a part : hit = { local: the point, normal: the normal there (both in the coordinates of the part),
    face: what the kernel says of the face — { type: "cylinder", axis, o, r, inner } or a plane }. A hole wall or another curved face : the tangent plane. */
export function surfaceAt(hit) {
  const p = hit.local.map(r2), f = hit.face;
  if (f && f.type === "cylinder" && !f.inner && f.r > 0) {
    let a = v3.unit(f.axis); const lead = Math.abs(a[2]) > 0.5 ? a[2] : Math.abs(a[0]) > 0.5 ? a[0] : a[1]; if (lead < 0) a = v3.neg(a);       // the axis points up (or toward +X, +Y) : the label reads the right way round
    return { p, axis: a.map((x) => r2(x) + 0), c: f.o.map(r2), r: r2(f.r) };      // + 0 : never a negative zero
  }
  return { p, n: v3.unit(hit.normal).map((x) => Math.round(x * 1e4) / 1e4), ...(f && f.type !== "plane" ? { tangent: true } : {}) };
}
/** The frame of a label : its centre, its right (u), its up (v), its normal (n) — on a cylinder, also the axis, the angle and the height of its centre. */
export function labelFrame(label) {
  const on = label.on; if (!on) return null;
  if (isWrapped(label)) {
    const a = v3.unit(on.axis), d = v3.sub(on.p, on.c), s0 = v3.dot(d, a), rad = v3.sub(d, v3.mul(a, s0)), e1 = v3.len(rad) > 1e-9 ? v3.unit(rad) : v3.unit(v3.cross(Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], a)), e2 = v3.cross(a, e1);
    return { wrap: "cyl", o: v3.add(v3.add(on.c, v3.mul(a, s0)), v3.mul(e1, on.r)), u: e2, v: a, n: e1, a, e1, e2, c: on.c, r: on.r, s0 };
  }
  const n = v3.unit(on.n), u = Math.abs(n[2]) < 0.9 ? v3.unit(v3.cross([0, 0, 1], n)) : [1, 0, 0], v = v3.cross(n, u);
  return { wrap: "flat", o: on.p, u: u.map((x) => x + 0), v: v.map((x) => x + 0), n };
}
/** The label as a mesh, in the coordinates of its part : { pos, nrm, uv, idx, epos (its outline), wrap }. It floats a hair above the surface. */
export function labelPatch(label, o = {}) {
  const F = labelFrame(label); if (!F || !(label.w > 0 && label.h > 0)) return null;
  const lift = o.lift ?? (LABEL_KINDS[label.kind] || LABEL_KINDS.sticker).lift, t = (label.turn || 0) * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t), w = label.w, h = label.h;
  const span = F.wrap === "cyl" ? (Math.abs(w * ct) + Math.abs(h * st)) / F.r : 0, N = F.wrap === "cyl" ? Math.max(2, Math.min(96, Math.ceil(span / (5 * Math.PI / 180)))) : 1;
  const at = (x, y) => { const along = x * ct - y * st, up = x * st + y * ct;                                 // the label turned in its own plane : along the right, along the up
    if (F.wrap === "flat") return { p: v3.add(v3.add(v3.add(F.o, v3.mul(F.u, along)), v3.mul(F.v, up)), v3.mul(F.n, lift)), n: F.n };
    const th = along / F.r, n = v3.add(v3.mul(F.e1, Math.cos(th)), v3.mul(F.e2, Math.sin(th))); return { p: v3.add(v3.add(F.c, v3.mul(F.a, F.s0 + up)), v3.mul(n, F.r + lift)), n }; };
  const pos = [], nrm = [], uv = [], idx = [], M = N;
  for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) { const q = at((i / N - 0.5) * w, (j / M - 0.5) * h); pos.push(...q.p); nrm.push(...q.n); uv.push(i / N, j / M); }
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  const edge = [], P = (i, j) => pos.slice(3 * (j * (N + 1) + i), 3 * (j * (N + 1) + i) + 3);
  for (let i = 0; i < N; i++) edge.push(...P(i, 0), ...P(i + 1, 0), ...P(i, M), ...P(i + 1, M));
  for (let j = 0; j < M; j++) edge.push(...P(0, j), ...P(0, j + 1), ...P(N, j), ...P(N, j + 1));
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx), epos: new Float32Array(edge), wrap: F.wrap, segments: N };
}

/** Slides a label on its surface : dx along its right, dy along its up (mm) — around the cylinder and along its axis when it is wrapped. Returns the label. */
export function moveLabel(label, dx, dy) {
  const F = labelFrame(label); if (!F) return label;
  if (F.wrap === "flat") { label.on.p = v3.add(v3.add(label.on.p, v3.mul(F.u, dx)), v3.mul(F.v, dy)).map(r2); return label; }
  const th = dx / F.r, n = v3.add(v3.mul(F.e1, Math.cos(th)), v3.mul(F.e2, Math.sin(th)));
  label.on.p = v3.add(v3.add(F.c, v3.mul(F.a, F.s0 + dy)), v3.mul(n, F.r)).map(r2); return label;
}
const corner = (label) => { const s = (label.art || {}).shape || "round", m = Math.min(label.w, label.h); return s === "pill" ? m / 2 : s === "round" ? Math.min(m * 0.18, 8) : 0; };
/** The width of a line of text, in ems of a bold sans-serif : capitals are wide, a dash wider, a space or a dot narrow. An estimate, kept generous. */
export const textEms = (s) => [...String(s)].reduce((a, ch) => a + (/[A-ZÀ-ÖØ-ÞMW@%&]/.test(ch) ? 0.74 : /[—–]/.test(ch) ? 1 : /[ .,;:!'’|il]/.test(ch) ? 0.3 : /[mw]/.test(ch) ? 0.88 : 0.58), 0);
/** Lines of text fitted in a box : the size that fills the width, never more than the height allows. weight : 1 for bold, less for a lighter line. */
const fitText = (text, boxW, boxH, weight = 0.56) => Math.max(0.5, Math.min(boxH, boxW / (1.06 * weight / 0.56 * Math.max(0.6, textEms(text)))));
/** The artwork of a label : an SVG at scale (1 unit = 1 mm). With px, its size on a screen ; without, in millimetres — the file for the printer. */
export function labelSvg(label, o = {}) {
  const w = label.w, h = label.h, a = label.art || {}, ink = a.ink || "#1b2733", paper = a.paper || "#ffffff", rc = r2(corner(label)), pad = Math.min(w, h) * 0.12, out = [];
  const size = o.px ? `width="${Math.round(w * o.px)}" height="${Math.round(h * o.px)}"` : `width="${r2(w)}mm" height="${r2(h)}mm"`;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${r2(w)} ${r2(h)}" ${size}>`, `<title>${esc(label.name || label.id)}</title>`, `<desc>${esc(`${label.id} — ${fr(w)} × ${fr(h)} mm`)}</desc>`);
  if (paper !== "none") out.push(`<rect x="0" y="0" width="${r2(w)}" height="${r2(h)}" rx="${rc}" fill="${esc(paper)}"/>`);
  const text = (s, x, y, fs, anchor = "middle", bold = true, fill = ink) => `<text x="${r2(x)}" y="${r2(y)}" font-family="Helvetica, Arial, sans-serif" font-size="${r2(fs)}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" fill="${esc(fill)}">${esc(s)}</text>`;
  if (a.type === "logo") {
    const wide = w / h >= 2.2 && a.text, m = Math.min(h - 2 * pad, wide ? h - 2 * pad : w - 2 * pad), x0 = wide ? pad : (w - m) / 2, y0 = (h - m) / 2;
    drawLogo({ polyline: (pts, st) => out.push(`<path d="M${pts.map(([px, py]) => `${r2(px)} ${r2(py)}`).join("L")}${st.close ? "Z" : ""}" fill="${st.fill || "none"}" stroke="${esc(st.color)}" stroke-width="${r2(st.w)}" stroke-linecap="round" stroke-linejoin="round"/>`) }, x0, y0, m, { ink });
    if (wide) { const tx = x0 + m + pad * 0.8, tw = w - tx - pad, fs = fitText(a.text, tw, a.sub ? m * 0.46 : m * 0.6), fs2 = a.sub ? Math.min(fs * 0.48, fitText(a.sub, tw, m * 0.24, 0.5)) : 0;
      out.push(text(a.text, tx, h / 2 + (a.sub ? fs * 0.12 : fs * 0.36), fs, "start")); if (a.sub) out.push(text(a.sub, tx, h / 2 + fs * 0.12 + fs2 * 1.25, fs2, "start", false)); }
  } else if (a.type === "image") {
    if (a.src) out.push(`<image x="${r2(pad / 2)}" y="${r2(pad / 2)}" width="${r2(w - pad)}" height="${r2(h - pad)}" preserveAspectRatio="xMidYMid meet" href="${esc(a.src)}" xlink:href="${esc(a.src)}"/>`);
    else out.push(`<rect x="${r2(pad)}" y="${r2(pad)}" width="${r2(w - 2 * pad)}" height="${r2(h - 2 * pad)}" fill="none" stroke="${esc(ink)}" stroke-width="${r2(Math.min(w, h) * 0.02)}" stroke-dasharray="${r2(Math.min(w, h) * 0.08)}"/>`);
  } else {
    const main = a.text || "", fs = fitText(main || "Texte", w - 2 * pad, a.sub ? (h - 2 * pad) * 0.56 : (h - 2 * pad) * 0.8), fs2 = a.sub ? Math.min(fs * 0.5, fitText(a.sub, w - 2 * pad, (h - 2 * pad) * 0.3, 0.5)) : 0;
    out.push(text(main || "Texte", w / 2, h / 2 + (a.sub ? -fs2 * 0.25 : fs * 0.35), fs, "middle", true, main ? ink : "#9aa3aa")); if (a.sub) out.push(text(a.sub, w / 2, h / 2 + fs * 0.35 + fs2 * 0.85, fs2, "middle", false));
  }
  out.push("</svg>"); return out.join("\n");
}
/** The height of the smallest text of a label, in millimetres (0 : no text). */
export function textHeight(label) {
  const a = label.art || {}, w = label.w, h = label.h, pad = Math.min(w, h) * 0.12; if (a.type === "image" || (a.type === "logo" && !(w / h >= 2.2 && a.text))) return 0;
  if (a.type === "logo") { const m = h - 2 * pad, tw = w - (pad + m + pad * 0.8) - pad, fs = fitText(a.text, tw, a.sub ? m * 0.46 : m * 0.6); return r2(a.sub ? Math.min(fs * 0.48, fitText(a.sub, tw, m * 0.24, 0.5)) : fs); }
  const fs = fitText(a.text || "Texte", w - 2 * pad, a.sub ? (h - 2 * pad) * 0.56 : (h - 2 * pad) * 0.8); return r2(a.sub ? Math.min(fs * 0.5, fitText(a.sub, w - 2 * pad, (h - 2 * pad) * 0.3, 0.5)) : fs);
}

/** What the labels of an assembly ask for. instances : the ids of the instances of the assembly. → [{ level, text, id, field }] for the guide */
export function labelGuide(labels, instances = []) {
  const out = [], say = (level, text, id = null, field = null) => out.push({ level, text, id, field }), seen = new Set(), list = labels || [];
  for (const l of list) {
    const name = `${l.id}${l.name ? ` « ${l.name} »` : ""}`, a = l.art || {};
    if (seen.has(l.id)) say("error", `Deux étiquettes portent le repère ${l.id}.`, l.id, "id"); seen.add(l.id);
    if (!(l.w > 0 && l.h > 0)) say("error", `${name} : donnez sa largeur et sa hauteur.`, l.id, "w");
    if (!l.on || !l.inst) { say("todo", `${name} : à poser — choisissez-la, puis cliquez la face qui la porte, dans la vue.`, l.id, "on"); }
    else if (instances.length && !instances.includes(l.inst)) say("error", `${name} : la pièce qui la portait (${l.inst}) n'est plus dans l'assemblage — reposez-la.`, l.id, "on");
    else if (isWrapped(l)) { const t = (l.turn || 0) * Math.PI / 180, arc = Math.abs(l.w * Math.cos(t)) + Math.abs(l.h * Math.sin(t)), round = 2 * Math.PI * l.on.r;
      if (arc > round + 1e-6) say("error", `${name} : ${fr(arc)} mm autour d'un cylindre de ${fr(round)} mm de tour — elle se recouvre.`, l.id, "w");
      else if (arc > round / 2) say("warn", `${name} : elle fait plus d'un demi-tour (${fr(arc)} mm sur ${fr(round)}) — on ne la lit pas d'un seul regard.`, l.id, "w"); }
    else if (l.on.tangent) say("warn", `${name} : la face n'est ni plane ni cylindrique — l'étiquette est montrée à plat sur le plan tangent, elle ne l'épouse pas.`, l.id, "on");
    if (a.type === "text" && !String(a.text || "").trim()) say("todo", `${name} : écrivez son texte.`, l.id, "text");
    if (a.type === "image" && !a.src) say("todo", `${name} : apportez son image.`, l.id, "src");
    if (a.type === "image" && a.src && a.src.length > IMAGE_LIMIT) say("warn", `${name} : image lourde (${Math.round(a.src.length / 1024)} Ko dans le projet) — une image plus petite, ou un SVG, allège le fichier.`, l.id, "src");
    const th = l.w > 0 && l.h > 0 ? textHeight(l) : 0; if (th > 0 && th < 2) say("warn", `${name} : son plus petit texte ne fait que ${fr(th)} mm de haut — 2 mm au moins pour être lu.`, l.id, "h");
    if (a.ink && a.paper && a.paper !== "none" && String(a.ink).toLowerCase() === String(a.paper).toLowerCase()) say("warn", `${name} : l'encre et le fond ont la même couleur.`, l.id, "ink");
  }
  if (!list.length) say("tip", "Aucune étiquette : ajoutez la marque, un texte ou une image, puis cliquez la face qui la porte.", null, "add");
  return out;
}
/** One row per label, for the screen, the report and the list sent to the printer. names : instance id → the name of its part. */
export function labelRows(labels, names = {}) {
  return (labels || []).map((l) => ({ id: l.id, name: l.name || "", kind: (LABEL_KINDS[l.kind] || LABEL_KINDS.sticker).label, art: (LABEL_ARTS[(l.art || {}).type] || LABEL_ARTS.text).fr, on: l.inst ? names[l.inst] || l.inst : "—",
    surface: !l.on ? "à poser" : isWrapped(l) ? `cylindre Ø ${fr(2 * l.on.r)}` : l.on.tangent ? "plan tangent" : "face plane", w: r2(l.w), h: r2(l.h), turn: r2(l.turn || 0), area: r2(l.w * l.h / 100) }));
}
export const labelsCsv = (rows) => [["Repère", "Nom", "Genre", "Motif", "Sur", "Surface", "Largeur (mm)", "Hauteur (mm)", "Rotation (°)", "Aire (cm²)"], ...rows.map((r) => [r.id, r.name, r.kind, r.art, r.on, r.surface, r.w, r.h, r.turn, r.area])]
  .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
/** A label put back in order — what comes from a file or from an AI. */
export function tidyLabel(raw, k = 0) {
  const b = blankLabel(`E${k + 1}`), l = { ...b, ...(raw || {}) }, num = (v, f) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : f);
  l.id = String(l.id || b.id); l.kind = LABEL_KINDS[l.kind] ? l.kind : "sticker"; l.w = num(l.w, b.w); l.h = num(l.h, b.h); l.turn = num(l.turn, 0);
  l.art = { ...b.art, ...(l.art && typeof l.art === "object" ? l.art : {}) }; if (!LABEL_ARTS[l.art.type]) l.art.type = "text"; if (!LABEL_SHAPES[l.art.shape]) l.art.shape = "round";
  if (l.on && !(Array.isArray(l.on.p) && l.on.p.length === 3 && (Array.isArray(l.on.n) || isWrapped(l)))) l.on = null;
  return l;
}
