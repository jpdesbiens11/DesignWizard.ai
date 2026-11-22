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

/* ---------- the mark as a vector (64 × 64, the figure of docs/BRAND.md) : « the bolt put in orbit » — the yellow tile and the bolt
   of the DynamiteAgile family at the centre, an orbit that passes behind the tile and in front of it, an orange spark on it ---------- */
export const LOGO = { size: 64, ring: { c: [32, 32], rx: 29, ry: 12, rot: -28 }, tile: [15, 15, 34, 34],
  bolt: [[34.48, 19.6], [25.8, 33.24], [32, 33.24], [29.52, 44.4], [39.44, 29.52], [33.24, 29.52]], spark: { at: 30, r: 6.4 },
  ink: "#26323f", blue: "#0c66e4", yellow: "#ffd23f", orange: "#e0602f" };
/** Point of the orbit at parameter t (degrees) ; 0..180 is the half in front of the tile. */
export function ringPoint(t) {
  const { c, rx, ry, rot } = LOGO.ring, a = t * Math.PI / 180, r = rot * Math.PI / 180;
  return [c[0] + rx * Math.cos(a) * Math.cos(r) - ry * Math.sin(a) * Math.sin(r), c[1] + rx * Math.cos(a) * Math.sin(r) + ry * Math.sin(a) * Math.cos(r)];
}
const sparkPoints = () => { const [cx, cy] = ringPoint(LOGO.spark.at), R = LOGO.spark.r; return Array.from({ length: 8 }, (_, i) => { const a = Math.PI * i / 4 - Math.PI / 2, k = i % 2 ? R * 0.3 : R; return [cx + k * Math.cos(a), cy + k * Math.sin(a)]; }); };
/** Draws the mark on a sheet that has polyline() (a PdfSheet, or anything that draws the same way) : its top left corner at
    (x, y), `size` wide and high — the orbit behind, the tile, the bolt, the orbit in front, the spark. */
export function drawLogo(sheet, x, y, size, { ink = LOGO.ink } = {}) {
  const k = size / LOGO.size, P = ([px, py]) => [x + px * k, y + py * k], arc = (t0, t1, n = 36) => Array.from({ length: n + 1 }, (_, i) => P(ringPoint(t0 + (t1 - t0) * i / n)));
  const [tx, ty, tw, th] = LOGO.tile;
  sheet.polyline(arc(180, 360), { color: LOGO.blue, w: 4 * k, cap: "round" });
  sheet.polyline([[tx, ty], [tx + tw, ty], [tx + tw, ty + th], [tx, ty + th]].map(P), { color: ink, w: 4 * k, fill: LOGO.yellow, close: true });
  sheet.polyline(LOGO.bolt.map(P), { color: LOGO.ink, w: 3.6 * k, close: true });
  sheet.polyline(arc(0, 180), { color: LOGO.blue, w: 4 * k, cap: "round" });
  sheet.polyline(sparkPoints().map(P), { color: ink, w: 1.4 * k, fill: LOGO.orange, close: true });
  return sheet;
}
/** The mark as an inline SVG, for a page (the report in HTML). */
export function logoSvg(size = 40) {
  const { c, rx, ry, rot } = LOGO.ring, [tx, ty, tw, th] = LOGO.tile, xy = (p) => p.map((v) => v.toFixed(2)).join(" "), ring = `fill="none" stroke="${LOGO.blue}" stroke-width="4" stroke-linecap="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="DynamiteOrbit"><path d="M${xy(ringPoint(180))}A${rx} ${ry} ${rot} 0 1 ${xy(ringPoint(360))}" ${ring}/><path d="M${tx} ${ty}h${tw}v${th}h-${tw}Z" fill="${LOGO.yellow}" stroke="${LOGO.ink}" stroke-width="4" stroke-linejoin="round"/><path d="M${LOGO.bolt.map(xy).join("L")}Z" fill="none" stroke="${LOGO.ink}" stroke-width="3.6" stroke-linejoin="round"/><path d="M${xy(ringPoint(0))}A${rx} ${ry} ${rot} 0 1 ${xy(ringPoint(180))}" ${ring}/><path d="M${sparkPoints().map(xy).join("L")}Z" fill="${LOGO.orange}" stroke="${LOGO.ink}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
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
