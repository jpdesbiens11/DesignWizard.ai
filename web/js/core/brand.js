/* DynamiteOrbit — the mark every document of the platform carries, whatever its format : who made it, and the note
   « Co-Intelligence WorkFlow™ » in the words of DynamiteAgile. One source for the PDF, the Word document, the text
   and data files, the fabrication files and what is sent to Onshape — so that no export goes out without it.
   Pure : the writers and the tests share it. */

export const BRAND = { product: "DynamiteOrbit™", by: "DynamiteAgile™", workflow: "Co-Intelligence WorkFlow™", site: "DynamiteOrbit" };
/** Who made the document. */
export const BRAND_LINE = `${BRAND.product} by ${BRAND.by}`;
/** The mark : the platform, the house, the workflow. */
export const MARK = `${BRAND_LINE} · ${BRAND.workflow}`;
/** The note at the bottom of every document. */
export const FOOT_NOTE = `${MARK} — document généré par DynamiteOrbit. La version électronique fait foi ; la version imprimée est pour référence.`;
/** The same note for the formats that only take plain ASCII (DXF, Gerber, drill files, STEP, STL). */
export const FOOT_NOTE_ASCII = "DynamiteOrbit(TM) by DynamiteAgile(TM) - Co-Intelligence WorkFlow(TM) - document genere par DynamiteOrbit. La version electronique fait foi ; la version imprimee est pour reference.";
const KEY = "Co-Intelligence WorkFlow";                        // what tells a file is already marked
/** « Extrait le 2026-11-16 14:02 — DynamiteOrbit v0.42.0 » : when the document left the platform, and from which version. */
export function stampLine(when = new Date(), version = "") {
  const d = when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date(0), p = (n) => String(n).padStart(2, "0");
  return `Extrait le ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} — DynamiteOrbit${version ? ` v${version}` : ""}`;
}

/* ---------- the mark as a vector (64 × 64, the figure of docs/BRAND.md) : two legs, the arc they trace, the spark ---------- */
export const LOGO = { size: 64, legs: [[26.6, 24.72, 12, 51], [37.4, 24.72, 52, 51]], arc: { c: [32, 15], r: 41.18, a0: 46.94, a1: 133.06 }, star: [[32, 2], [34.76, 12.24], [45, 15], [34.76, 17.76], [32, 28], [29.24, 17.76], [19, 15], [29.24, 12.24]],
  ink: "#26323f", blue: "#0c66e4", yellow: "#ffd23f" };
/** Draws the mark on a sheet that has line(), polyline() (a PdfSheet, or anything that draws the same way) : its top left
    corner at (x, y), `size` wide and high. */
export function drawLogo(sheet, x, y, size) {
  const k = size / LOGO.size, P = (px, py) => [x + px * k, y + py * k], n = 28, { c, r, a0, a1 } = LOGO.arc;
  for (const [x1, y1, x2, y2] of LOGO.legs) sheet.line(...P(x1, y1), ...P(x2, y2), { color: LOGO.ink, w: 6 * k, cap: "round" });
  sheet.polyline(Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return P(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)); }), { color: LOGO.blue, w: 6 * k, cap: "round" });
  sheet.polyline(LOGO.star.map(([px, py]) => P(px, py)), { color: LOGO.ink, w: 2 * k, fill: LOGO.yellow, close: true });
  return sheet;
}
/** The mark as an inline SVG, for a page (the report in HTML). */
export function logoSvg(size = 40) {
  const { c, r, a0, a1 } = LOGO.arc, pt = (a) => `${(c[0] + r * Math.cos(a * Math.PI / 180)).toFixed(2)} ${(c[1] + r * Math.sin(a * Math.PI / 180)).toFixed(2)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="DynamiteOrbit">${LOGO.legs.map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${LOGO.ink}" stroke-width="6" stroke-linecap="round"/>`).join("")}<path d="M${pt(a0)}A${r} ${r} 0 0 1 ${pt(a1)}" fill="none" stroke="${LOGO.blue}" stroke-width="6" stroke-linecap="round"/><path d="M${LOGO.star.map((p) => p.join(" ")).join("L")}Z" fill="${LOGO.yellow}" stroke="${LOGO.ink}" stroke-width="2" stroke-linejoin="round"/></svg>`;
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
export const STL_HEADER = "DynamiteOrbit(TM) by DynamiteAgile(TM) - Co-Intelligence WorkFlow(TM)";

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
