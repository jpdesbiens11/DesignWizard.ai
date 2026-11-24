/* DynamiteOrbit.ai — PCBA: a Word document (.docx, Office Open XML) written by hand from the neutral document model
   of review.js : headings, paragraphs, lists, tables, figures, check-lists, a sign-off table, a table of contents
   field, header and footer with page numbers. A4 portrait, 20 mm margins. A .docx is a ZIP of XML parts ; the
   archive is stored without compression, which Word and LibreOffice read. */

import { zip } from "./zip.js";
import { BRAND, FOOT_NOTE, confidentialNote } from "./brand.js";
import { logoPng } from "./brand_logo.js";
import { nameBoardsDeep } from "./board_names.js";

const esc = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', FILL = { ok: "DCF2E3", warn: "FCEFC7", error: "F9D9D9", muted: "EEF0F3", head: "DDE5F0" }, WIDTH = 9638;   // text width in twentieths of a point (170 mm)
const run = (text, o = {}) => `<w:r><w:rPr>${o.bold ? "<w:b/>" : ""}${o.italic ? "<w:i/>" : ""}${o.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.size ? `<w:sz w:val="${o.size}"/>` : ""}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const para = (inner, style, extra = "") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>${inner}</w:p>`;
const cellOf = (c) => (c !== null && typeof c === "object" ? c : { text: c });
const field = (code) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

function table(head, rows, widths, o = {}) {
  const n = (head || rows[0] || []).length, sum = (widths || []).reduce((s, w) => s + w, 0) || n, cols = Array.from({ length: n }, (_, i) => Math.round(WIDTH * ((widths && widths[i]) || 1) / sum));
  const tc = (c, i, isHead) => { const x = cellOf(c), fill = isHead ? FILL.head : x.fill ? FILL[x.fill] : o.firstCol && i === 0 ? FILL.muted : null;
    return `<w:tc><w:tcPr><w:tcW w:w="${cols[i]}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}</w:tcPr>${para(run(x.text, { bold: isHead || x.bold || (o.firstCol && i === 0), size: 18 }), null, `<w:spacing w:before="40" w:after="40"/>${x.align === "right" ? '<w:jc w:val="right"/>' : ""}`)}</w:tc>`; };
  const tr = (cells, isHead) => `<w:tr><w:trPr>${isHead ? "<w:tblHeader/>" : ""}${o.height && !isHead ? `<w:trHeight w:val="${o.height}"/>` : ""}<w:cantSplit/></w:trPr>${cells.map((c, i) => tc(c, i, isHead)).join("")}</w:tr>`;
  const border = ["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="9AA5B4"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${WIDTH}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map((c) => `<w:gridCol w:w="${c}"/>`).join("")}</w:tblGrid>${head ? tr(head, true) : ""}${rows.map((r) => tr(r, false)).join("")}</w:tbl>${para("", null, '<w:spacing w:after="60"/>')}`;
}
function picture(rid, n, wmm, hmm, name) {
  const cx = Math.round(wmm * 36000), cy = Math.round(hmm * 36000);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="${esc(name)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

const STYLES = `${HEAD}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="21"/><w:lang w:val="fr-CA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="900" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3A5F"/><w:sz w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="600"/></w:pPr><w:rPr><w:color w:val="5A6472"/><w:sz w:val="32"/></w:rPr></w:style>
${[[1, 32, 360], [2, 26, 240], [3, 22, 180]].map(([n, sz, before]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="100"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3A5F"/><w:sz w:val="${sz}"/></w:rPr></w:style>`).join("\n")}
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:rPr><w:i/><w:color w:val="5A6472"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="50"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="5A6472"/><w:sz w:val="17"/></w:rPr></w:style></w:styles>`;
const level = (i, fmt, text) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 * (i + 1)}" w:hanging="260"/></w:pPr></w:lvl>`;
const NUMBERING = `${HEAD}<w:numbering ${NS}><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map((i) => level(i, "bullet", i ? "–" : "•")).join("")}</w:abstractNum><w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2].map((i) => level(i, "decimal", `%${i + 1}.`)).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>`;

/** The bytes of a picture given as bytes or as a data URL. */
function dataUrlBytes(v) { if (typeof v !== "string") return v; const s = atob(v.slice(v.indexOf(",") + 1)), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
/* the header of every page, in the manner of the house : the mark and who made the document, what the document is, its
   reference, its revision, its date and its page */
function headerTable(doc) {
  const cols = [1100, 5038, 3500], date = (doc.date || new Date(0)).toISOString().slice(0, 10), tight = '<w:spacing w:before="0" w:after="0"/>';
  const cell = (w, inner, extra = "") => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/>${extra}</w:tcPr>${inner}</w:tc>`, line = (label, value) => para(`${run(`${label} `, { size: 15, color: "5A6472" })}${value}`, null, tight);
  const border = ["top", "left", "bottom", "right", "insideV"].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="9AA5B4"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${WIDTH}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map((c) => `<w:gridCol w:w="${c}"/>`).join("")}</w:tblGrid><w:tr>`
    + cell(cols[0], para(picture("rIdLogo", 900, 13, 13, "DynamiteOrbit.ai"), null, `<w:jc w:val="center"/>${tight}`))
    + cell(cols[1], para(run(BRAND.product, { bold: true, color: "1F3A5F", size: 26 }), null, tight) + para(run(`by ${BRAND.by} · ${BRAND.workflow}`, { size: 15, color: "5A6472" }), null, tight) + para(run(doc.header || doc.title, { bold: true, size: 18 }), null, '<w:spacing w:before="60" w:after="0"/>') + para(run(String(doc.kind || doc.subject || "Document").toUpperCase(), { size: 13, color: "5A6472" }), null, tight))
    + cell(cols[2], line("N° doc. :", run(doc.reference || "—", { bold: true, size: 16 })) + line("Révision :", run(doc.revision || "—", { bold: true, size: 16 })) + line("Date :", run(date, { size: 16 })) + line("Page :", `${field("PAGE").replace(/<w:r>/g, '<w:r><w:rPr><w:sz w:val="16"/></w:rPr>')}${run(" de ", { size: 16 })}${field("NUMPAGES").replace(/<w:r>/g, '<w:r><w:rPr><w:sz w:val="16"/></w:rPr>')}`))
    + `</w:tr></w:tbl>${para("", null, '<w:spacing w:before="0" w:after="120"/>')}`;
}

/** A .docx file from a document model. → Uint8Array */
export function docx(model) {
  const doc = nameBoardsDeep(model);      // PCB · PCBA, or the words of the house (core/board_names.js)
  const body = [], media = [], rels = [], heads = doc.blocks.filter((b) => /^h[123]$/.test(b.type));
  const rel = (type, target) => { rels.push(`<Relationship Id="rId${rels.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`); return `rId${rels.length}`; };
  rel("styles", "styles.xml"); rel("numbering", "numbering.xml"); rel("settings", "settings.xml"); const hid = rel("header", "header1.xml"), fid = rel("footer", "footer1.xml");
  /* the first page : what the document is, who stands behind it, what changed */
  const day = (doc.date || new Date(0)).toISOString().slice(0, 10), who = doc.approvals && doc.approvals.length ? doc.approvals : [{ role: "Préparé par", name: doc.author || "", date: doc.author ? day : "" }, { role: "Vérifié par", name: "", date: "" }, { role: "Approuvé par", name: "", date: "" }];
  const log = doc.revisions && doc.revisions.length ? doc.revisions : [{ rev: doc.revision || "A", reason: "Émission du document", sections: "Toutes", by: doc.author || (who[0] && who[0].name) || "", date: day }], sub = (t) => para(run(t, { bold: true, color: "1F3A5F", size: 24 }), null, '<w:spacing w:before="320" w:after="80"/>');
  body.push(para(run(doc.title), "Title"), para(run(doc.subtitle || ""), "Subtitle"), table(null, [...(doc.project ? [["Projet", doc.project]] : []), ["N° de document", doc.reference || "—"], ["Révision", doc.revision || "—"], ["Date", day], ...(doc.organisation ? [["Organisation", doc.organisation]] : [])], [30, 70], { firstCol: true }),
    sub("Approbation"), table(["", "Nom", "Date", "Signature"], who.map((a) => [{ text: a.role, bold: true }, a.name || "", a.date || "", ""]), [24, 30, 18, 28], { height: 620 }),
    sub("Journal des révisions"), table(["Rév.", "Motif de la révision", "Sections touchées", "Nom", "Date"], log.slice(-8).map((r) => [{ text: r.rev || "", bold: true }, r.reason || "", r.sections || "Toutes", r.by || "", r.date || ""]), [9, 42, 19, 14, 16]), para('<w:r><w:br w:type="page"/></w:r>'));
  for (const b of doc.blocks) {
    if (/^h[123]$/.test(b.type)) body.push(para(run(b.text), `Heading${b.type[1]}`));
    else if (b.type === "p") body.push(para(b.runs ? b.runs.map((r) => run(r.text, r)).join("") : run(b.text, { color: b.style === "muted" ? "5A6472" : b.style === "warn" ? "A14A00" : null, italic: b.style === "note", bold: b.style === "warn" })));
    else if (b.type === "list") for (const it of b.items) { const x = cellOf(it); body.push(para(run(x.text), "ListParagraph", `<w:numPr><w:ilvl w:val="${Math.min(2, x.level || 0)}"/><w:numId w:val="${b.ordered ? 2 : 1}"/></w:numPr>`)); }
    else if (b.type === "table") { body.push(table(b.head, b.rows, b.widths, b.rowHeight ? { height: Math.round(b.rowHeight * 56.7) } : {})); if (b.caption) body.push(para(run(b.caption), "Caption")); }
    else if (b.type === "kv") body.push(table(null, b.rows, [30, 70], { firstCol: true }));
    else if (b.type === "checklist") body.push(table(null, b.items.map((i) => [{ text: i.state === "ok" ? "Fait" : i.state === "na" ? "Sans objet" : "À faire", fill: i.state === "ok" ? "ok" : i.state === "na" ? "muted" : "warn" }, i.text]), [16, 84]));
    else if (b.type === "signatures") body.push(table(["Rôle", "Nom", "Date", "Signature"], b.roles.map((r) => [r, "", "", ""]), [28, 26, 16, 30], { height: 700 }));
    else if (b.type === "pagebreak") body.push(para('<w:r><w:br w:type="page"/></w:r>'));
    else if (b.type === "toc") {
      body.push(para(run("Sommaire"), "Heading1"));
      const lines = heads.filter((h) => h.type !== "h3").map((h) => para(run(h.text), null, `<w:spacing w:after="40"/><w:ind w:left="${h.type === "h2" ? 320 : 0}"/>`));
      const first = `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>`;
      body.push(lines.length ? lines[0].replace("</w:pPr>", `</w:pPr>${first}`) : para(first), ...lines.slice(1), para('<w:r><w:fldChar w:fldCharType="end"/></w:r>'));
    } else if (b.type === "figure") {
      if (b.jpeg && !b.png) { const name = `image${media.length + 1}.jpg`, w = Math.min(b.width || 150, 170), h = w * (b.size ? b.size[1] / b.size[0] : 0.62); media.push({ name, bytes: dataUrlBytes(b.jpeg) }); body.push(para(picture(rel("image", `media/${name}`), media.length, w, h, b.caption || name), null, '<w:jc w:val="center"/><w:keepNext/>')); }
      else if (b.png) { const name = `image${media.length + 1}.png`, w = Math.min(b.width || 160, 170), h = b.height || w * (b.pngSize ? b.pngSize[1] / b.pngSize[0] : 0.6); media.push({ name, bytes: b.png }); body.push(para(picture(rel("image", `media/${name}`), media.length, w, h * (w / (b.width || w)), b.caption || name), null, '<w:jc w:val="center"/><w:keepNext/>')); }
      else body.push(para(run("Figure disponible dans la version PDF du rapport.", { color: "5A6472", italic: true }), null, '<w:jc w:val="center"/>'));
      if (b.caption) body.push(para(run(b.caption), "Caption"));
    }
  }
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="${hid}"/><w:footerReference w:type="default" r:id="${fid}"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2300" w:right="1134" w:bottom="1500" w:left="1134" w:header="500" w:footer="420" w:gutter="0"/></w:sectPr>`;
  const iso = (doc.date || new Date(0)).toISOString().replace(/\.\d+Z$/, "Z"), part = (name, type) => `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-${type}+xml"/>`;
  const files = [
    { name: "[Content_Types].xml", bytes: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>${part("word/document.xml", "officedocument.wordprocessingml.document.main")}${part("word/styles.xml", "officedocument.wordprocessingml.styles")}${part("word/numbering.xml", "officedocument.wordprocessingml.numbering")}${part("word/settings.xml", "officedocument.wordprocessingml.settings")}${part("word/header1.xml", "officedocument.wordprocessingml.header")}${part("word/footer1.xml", "officedocument.wordprocessingml.footer")}${part("docProps/core.xml", "package.core-properties")}${part("docProps/app.xml", "officedocument.extended-properties")}</Types>` },
    { name: "_rels/.rels", bytes: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", bytes: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.title)}</dc:title><dc:subject>${esc(doc.subject || "")}</dc:subject><dc:creator>${esc(doc.author || "")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>` },
    { name: "docProps/app.xml", bytes: `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>DynamiteOrbit.ai</Application></Properties>` },
    { name: "word/document.xml", bytes: `${HEAD}<w:document ${NS}><w:body>${body.join("")}${sect}</w:body></w:document>` },
    { name: "word/styles.xml", bytes: STYLES }, { name: "word/numbering.xml", bytes: NUMBERING },
    { name: "word/settings.xml", bytes: `${HEAD}<w:settings ${NS}><w:defaultTabStop w:val="708"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
    { name: "word/header1.xml", bytes: `${HEAD}<w:hdr ${NS}>${headerTable(doc)}</w:hdr>` },
    { name: "word/_rels/header1.xml.rels", bytes: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/dw_logo.png"/></Relationships>` },
    { name: "word/media/dw_logo.png", bytes: logoPng() },
    { name: "word/footer1.xml", bytes: `${HEAD}<w:ftr ${NS}>${para(run(doc.confidential || confidentialNote(), { size: 14, bold: true, color: "1c2430" }), "Header", '<w:pBdr><w:top w:val="single" w:sz="8" w:space="4" w:color="1F3A5F"/></w:pBdr><w:spacing w:after="40"/>')}${para(run(FOOT_NOTE, { size: 14 }), "Header", '<w:spacing w:after="0"/>')}${doc.stamp ? para(run(doc.stamp, { size: 13 }), "Header", '<w:spacing w:after="0"/>') : ""}</w:ftr>` },
    { name: "word/_rels/document.xml.rels", bytes: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>` },
    ...media.map((m) => ({ name: `word/media/${m.name}`, bytes: m.bytes })),
  ];
  return zip(files, doc.date || new Date(0));
}
