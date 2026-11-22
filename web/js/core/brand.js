/* DesignOrbit.ai — the mark every document of the platform carries, whatever its format : who made it, and the note
   « Co-Intelligence WorkFlow™ » in the words of DynamiteAgile. One source for the PDF, the Word document, the text
   and data files, the fabrication files and what is sent to Onshape — so that no export goes out without it.
   Pure : the writers and the tests share it. */

export const BRAND = { product: "DesignOrbit.ai™", by: "DynamiteAgile™", workflow: "Co-Intelligence WorkFlow™", site: "DesignOrbit.ai" };
/** Who made the document. */
export const BRAND_LINE = `${BRAND.product} by ${BRAND.by}`;
/** The mark : the platform, the house, the workflow. */
export const MARK = `${BRAND_LINE} · ${BRAND.workflow}`;
/** The note at the bottom of every document. */
export const FOOT_NOTE = `${MARK} — document généré par DesignOrbit.ai. La version électronique fait foi ; la version imprimée est pour référence.`;
/** The same note for the formats that only take plain ASCII (DXF, Gerber, drill files, STEP, STL). */
export const FOOT_NOTE_ASCII = "DesignOrbit.ai(TM) by DynamiteAgile(TM) - Co-Intelligence WorkFlow(TM) - document genere par DesignOrbit.ai. La version electronique fait foi ; la version imprimee est pour reference.";
const KEY = "Co-Intelligence WorkFlow";                        // what tells a file is already marked
/** « Extrait le 2026-11-16 14:02 — DesignOrbit.ai v0.42.0 » : when the document left the platform, and from which version. */
export function stampLine(when = new Date(), version = "") {
  const d = when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date(0), p = (n) => String(n).padStart(2, "0");
  return `Extrait le ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} — DesignOrbit.ai${version ? ` v${version}` : ""}`;
}

/* ---------- the mark as a vector (64 × 64, the figure of docs/BRAND.md) : the compass — two legs and the orbit they trace —
   and the rocket that leaves it on its dotted trajectory. One list of shapes : the PDF, the page, the label, the photo and
   the files of web/img/logo (tools/sketch_logo.py writes the same numbers ; a test holds them equal). ---------- */
export const LOGO = { size: 64, ink: "#26323f", blue: "#0c66e4", yellow: "#ffd23f", orange: "#ff8f4a",
  legs: [[26.6, 24.72, 12, 51], [37.4, 24.72, 52, 51]], arc: { c: [32, 15], r: 41.18, a0: 46.94, a1: 133.06 },
  dots: [[5, 38], [6.45, 32.17], [8.93, 26.73], [12.54, 21.96], [17.14, 18.14], [22.44, 15.35], [28.15, 13.49]], dotR: 1.5,
  flame: [[39.99, 16.81], [37.72, 23.26], [43.67, 19.9]],
  fins: [[[43.19, 9.58], [37.39, 10.58], [34.49, 14.03], [39.33, 14.17]], [[50.24, 15.49], [50.26, 21.38], [47.36, 24.83], [46.38, 20.09]]],
  rocket: [[55.71, 1.81], [55.46, 6.16], [53.79, 10.64], [51.52, 13.96], [46.38, 20.09], [39.33, 14.17], [44.48, 8.04], [47.35, 5.24], [51.47, 2.82]] };
const nf = (v) => String(+v.toFixed(2));
const arcAt = (deg) => { const { c, r } = LOGO.arc, a = deg * Math.PI / 180; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; };
/** The shapes of the mark, in drawing order, on its 64 grid : { kind: "line" | "arc" | "dot" | "area", … }. `ink` writes the
    legs and the outlines (light on a dark ground). */
export function logoShapes(ink = LOGO.ink) {
  const { r, a0, a1 } = LOGO.arc, area = (pts, fill) => ({ kind: "area", pts, fill, edge: ink, w: 2 });
  return [...LOGO.legs.map(([x1, y1, x2, y2]) => ({ kind: "line", pts: [[x1, y1], [x2, y2]], color: ink, w: 6 })),
    { kind: "arc", pts: Array.from({ length: 29 }, (_, i) => arcAt(a0 + (a1 - a0) * i / 28)), from: arcAt(a0), to: arcAt(a1), r, color: LOGO.blue, w: 6 },
    ...LOGO.dots.map((c) => ({ kind: "dot", c, r: LOGO.dotR, fill: LOGO.blue })),
    area(LOGO.flame, LOGO.orange), ...LOGO.fins.map((f) => area(f, ink)), area(LOGO.rocket, LOGO.yellow)];
}
/** Draws the mark on a sheet that has line(), polyline(), circle() (a PdfSheet, or anything that draws the same way) : its top
    left corner at (x, y), `size` wide and high. */
export function drawLogo(sheet, x, y, size) {
  const k = size / LOGO.size, P = ([px, py]) => [x + px * k, y + py * k];
  for (const s of logoShapes()) {
    if (s.kind === "line") sheet.line(...P(s.pts[0]), ...P(s.pts[1]), { color: s.color, w: s.w * k, cap: "round" });
    else if (s.kind === "arc") sheet.polyline(s.pts.map(P), { color: s.color, w: s.w * k, cap: "round" });
    else if (s.kind === "dot") sheet.circle(...P(s.c), s.r * k, { w: 0, fill: s.fill });
    else sheet.polyline(s.pts.map(P), { color: s.edge, w: s.w * k, fill: s.fill, close: true });
  }
  return sheet;
}
/** The body of the mark in SVG, on its 64 grid (web/img/logo/mark.svg holds the same). */
export function logoSvgBody(ink = LOGO.ink) {
  const pts = (p) => p.map(([px, py]) => `${nf(px)} ${nf(py)}`).join("L");
  return logoShapes(ink).map((s) => s.kind === "line" ? `<path d="M${pts(s.pts)}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-linecap="round"/>`
    : s.kind === "arc" ? `<path d="M${nf(s.from[0])} ${nf(s.from[1])}A${nf(s.r)} ${nf(s.r)} 0 0 1 ${nf(s.to[0])} ${nf(s.to[1])}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-linecap="round"/>`
    : s.kind === "dot" ? `<circle cx="${nf(s.c[0])}" cy="${nf(s.c[1])}" r="${nf(s.r)}" fill="${s.fill}"/>`
    : `<path d="M${pts(s.pts)}Z" fill="${s.fill}" stroke="${s.edge}" stroke-width="${s.w}" stroke-linejoin="round"/>`).join("");
}
/** The mark as an inline SVG, for a page (the report in HTML). */
export function logoSvg(size = 40) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="DesignOrbit.ai">${logoSvgBody()}</svg>`;
}
/** The mark on a 2D canvas (the signature of a photo) : top left at (x, y), `size` wide. */
export function drawLogoCanvas(g, x, y, size, ink = LOGO.ink) {
  const k = size / LOGO.size, P = ([px, py]) => [x + px * k, y + py * k];
  g.lineCap = "round"; g.lineJoin = "round";
  for (const s of logoShapes(ink)) {
    g.beginPath();
    if (s.kind === "dot") { g.arc(...P(s.c), s.r * k, 0, 2 * Math.PI); g.fillStyle = s.fill; g.fill(); continue; }
    s.pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
    if (s.kind === "area") { g.closePath(); g.fillStyle = s.fill; g.fill(); g.strokeStyle = s.edge; g.lineWidth = s.w * k; g.stroke(); }
    else { g.strokeStyle = s.color; g.lineWidth = s.w * k; g.stroke(); }
  }
  return g;
}

/* ---------- a text file : the note where its format takes a comment, and nowhere it could break a reader ---------- */
const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`;
const endWith = (text, tail) => `${text.replace(/\s+$/, "")}\n${tail}\n`;
/* per extension : how the note is written. Each one leaves the data readable by the tools that read the format. */
const WRITERS = {
  txt: (t) => endWith(t, `\n${"—".repeat(24)}\n${FOOT_NOTE}`), md: (t) => endWith(t, `\n---\n\n_${FOOT_NOTE}_`),
  csv: (t) => endWith(t, csvCell(FOOT_NOTE)),
  dwiz: (t) => endWith(t, `\n# ${FOOT_NOTE}`),
  fs: (t) => endWith(t, `\n// ${FOOT_NOTE}`),
  dxf: (t) => `999\n${FOOT_NOTE_ASCII}\n${t}`,
  step: (t) => t.replace(/^(ISO-10303-21;\s*\n?)/, `$1/* ${FOOT_NOTE_ASCII} */\n`), stp: (t) => WRITERS.step(t),
  drawio: (t) => xmlNote(t), xml: (t) => xmlNote(t), svg: (t) => xmlNote(t), html: (t) => (/<\/body>/i.test(t) ? t.replace(/<\/body>/i, `<!-- ${FOOT_NOTE} -->\n</body>`) : endWith(t, `<!-- ${FOOT_NOTE} -->`)),
  gbr: (t) => gerberNote(t), drl: (t) => drillNote(t), xln: (t) => drillNote(t), ipc: (t) => `C  ${FOOT_NOTE_ASCII}\n${t}`,
  json: (t) => jsonNote(t),
};
function xmlNote(t) { const at = t.search(/<(?!\?)/), note = `<!-- ${FOOT_NOTE} -->\n`; return at < 0 ? endWith(t, note.trim()) : t.slice(0, at) + note + t.slice(at); }      // after the prolog, before the root
function gerberNote(t) { const lines = t.split("\n"), at = lines.findIndex((l) => /^G04/.test(l)); lines.splice(at < 0 ? 0 : at + 1, 0, `G04 ${FOOT_NOTE_ASCII.replace(/[*%]/g, "")}*`); return lines.join("\n"); }
function drillNote(t) { const lines = t.split("\n"), at = lines.findIndex((l) => /^M48/.test(l)); lines.splice(at < 0 ? 0 : at + 1, 0, `; ${FOOT_NOTE_ASCII}`); return lines.join("\n"); }
/* a JSON object takes the note as its first key ; anything else (a list, a broken file) is left alone */
function jsonNote(t) { try { const v = JSON.parse(t); if (!v || typeof v !== "object" || Array.isArray(v)) return t; return JSON.stringify({ _mark: FOOT_NOTE, ...v }, null, /\n/.test(t) ? 2 : 0) + (/\n$/.test(t) ? "\n" : ""); } catch (e) { return t; } }
const GERBER = /\.(g[tbmko][lospdk]?|g[pl]?\d+|gm\d+|gko|gbr)$/i;                  // outer and inner copper (.GTL, .G1, .GP2…), masks, silk, paste, outline
/** The kind of a file, from its name : the key of the writer that marks it ("" when the format is not a text the platform marks here). */
export function markKind(name) {
  const n = String(name || "").toLowerCase(), ext = (n.match(/\.([a-z0-9]+)$/) || [])[1] || "";
  if (/(^|\/)acces\.json$/.test(n)) return "";                 // a setting of the site, read by the page : not a document
  if (GERBER.test(n)) return "gbr";
  return WRITERS[ext] ? ext : "";
}
/** A text file with the note of the platform, written the way its format allows. Marked once : a file that carries the note
    comes back as it is. A format the platform does not know, or data that is not text, comes back untouched. */
export function stampText(name, text) {
  const kind = markKind(name);
  if (!kind || typeof text !== "string" || text.includes(KEY)) return text;
  return WRITERS[kind](text);
}
/** Whether a text carries the note. */
export const isMarked = (text) => typeof text === "string" && text.includes(KEY);
/** The 80 bytes at the head of a binary STL : the mark, in ASCII. */
export const STL_HEADER = "DesignOrbit.ai(TM) by DynamiteAgile(TM) - Co-Intelligence WorkFlow(TM)";

/* ---------- the confidentiality note of a deliverable : whose document it is ---------- */
/** owner : the organisation the documents of the project belong to ("" : the issuer, unnamed) ; text : the wording of the project when it has its own. */
export function confidentialNote(owner = "", text = "") {
  const own = String(text || "").trim(); if (own) return own;
  const who = String(owner || "").trim().replace(/\.$/, "");                 // « Atelier inc. » : its own full stop is not doubled
  return `CONFIDENTIEL — ce document et les informations qu'il contient sont la propriété de ${who || "son émetteur"}. Toute reproduction, diffusion ou utilisation sans son autorisation écrite est interdite.`;
}
/** What every document of a project carries beside its content : the names of the approval block, the organisation and the notes.
    From project.drawing (the fields of the title block, shared by the drawings and the documents). */
export function docIdentity(project, when = new Date(), version = "") {
  const d = (project && project.drawing) || {}, day = (when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date(0)).toISOString().slice(0, 10);
  return { organisation: d.organisation || "", confidential: confidentialNote(d.organisation, d.confidentiality), stamp: stampLine(when, version), project: (project && project.name) || "",
    approvals: [{ role: "Préparé par", name: d.drawnBy || (project && project.author) || "", date: d.drawnBy || (project && project.author) ? day : "" }, { role: "Vérifié par", name: d.checkedBy || "", date: "" }, { role: "Approuvé par", name: d.approvedBy || "", date: "" }] };
}
