/* DynamiteOrbit — a small .pptx writer (Office Open XML, PresentationML), no dependency : a deck of slides, each with a title, a picture,
   a list and, when asked, a framed box to write in (the supplier's answer). For the fabrication shop (point 13 of the roadmap : « un .pptx de
   la gamme avec les images des étapes et les mesures intermédiaires ; une case pour que le fournisseur écrive ses commentaires »). Every slide
   carries the mark of the platform and its note ; the confidentiality note of the project when there is one (core/brand.js). Pure. */

import { zip } from "./zip.js";
import { BRAND_LINE, FOOT_NOTE } from "./brand.js";

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", CT = "application/vnd.openxmlformats-officedocument.presentationml";
const X = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const MM = 36000, W = 12192000, H = 6858000, mm = (v) => Math.round(v * MM);
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

/** A run of text. */
const run = (text, o = {}) => `<a:r><a:rPr lang="fr-CA" sz="${Math.round((o.size || 12) * 100)}"${o.bold ? ' b="1"' : ""}${o.italic ? ' i="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${o.color || "1F2937"}"/></a:solidFill></a:rPr><a:t>${X(text)}</a:t></a:r>`;
/** A paragraph : a string, or { text, bold, bullet, size, color }. */
function para(p, size) {
  const o = typeof p === "string" ? { text: p } : p || {};
  const pPr = o.bullet ? '<a:pPr marL="228600" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>' : "<a:pPr><a:buNone/></a:pPr>";
  return `<a:p>${pPr}${run(o.text, { size: o.size || size, bold: o.bold, italic: o.italic, color: o.color })}</a:p>`;
}
/** A text box at (x, y) mm, w × h mm. o : { size, frame (a border), fill } */
function textBox(id, x, y, w, h, paras, o = {}) {
  const line = o.frame ? `<a:ln w="15875"><a:solidFill><a:srgbClr val="${o.frame}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>", fill = o.fill ? `<a:solidFill><a:srgbClr val="${o.fill}"/></a:solidFill>` : "<a:noFill/>";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${mm(x)}" y="${mm(y)}"/><a:ext cx="${mm(w)}" cy="${mm(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="72000" tIns="36000" rIns="72000" bIns="36000" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${(paras.length ? paras : [""]).map((p) => para(p, o.size || 12)).join("")}</p:txBody></p:sp>`;
}
const picture = (id, rid, x, y, w, h) => `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${mm(x)}" y="${mm(y)}"/><a:ext cx="${mm(w)}" cy="${mm(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

/** A slide. s : { title, sub, image: { bytes, type: "jpeg" | "png", w, h (pixels) }, bullets: [paragraph], box: { label, text } } */
function slideXml(s, n, o) {
  const shapes = [], img = s.image, top = 30;
  shapes.push(textBox(2, 10, 3, 260, 7, [{ text: BRAND_LINE, size: 9, color: "0C66E4", bold: true }]), textBox(3, 270, 3, 60, 7, [{ text: `${n} / ${o.count}`, size: 9, color: "64748B" }]));
  shapes.push(textBox(4, 10, 10, 318, 16, [{ text: s.title || "", size: 24, bold: true, color: "111827" }, ...(s.sub ? [{ text: s.sub, size: 12, color: "475569" }] : [])]));
  const listX = img ? 207 : 10, listW = img ? 122 : 318, boxH = s.box ? 38 : 0;
  if (img) { const k = Math.min(190 / img.w, 132 / img.h), w = img.w * k, h = img.h * k; shapes.push(picture(5, "rId2", 10 + (190 - w) / 2, top, w, h)); }
  shapes.push(textBox(6, listX, top, listW, 132 - boxH - (boxH ? 3 : 0), (s.bullets || []).map((b) => (typeof b === "string" ? { text: b, bullet: true } : { bullet: true, ...b })), { size: 11 }));
  if (s.box) shapes.push(textBox(7, listX, top + 132 - boxH, listW, boxH, [{ text: s.box.label, size: 10, bold: true, color: "0C66E4" }, { text: s.box.text || "", size: 11 }], { frame: "0C66E4", fill: "F8FAFC" }));
  shapes.push(textBox(8, 10, 168, 318, 20, [...(o.confidential ? [{ text: o.confidential, size: 7, bold: true, color: "374151" }] : []), { text: FOOT_NOTE, size: 7, color: "64748B" }]));
  return `${HEAD}<p:sld ${NS}><p:cSld><p:spTree>${GROUP}${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="DynamiteOrbit"><a:themeElements><a:clrScheme name="DynamiteOrbit"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="26323F"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>`
  + ["0C66E4", "FFD23F", "2F7D4F", "C0392B", "7C3AED", "0891B2"].map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${c}"/></a:accent${i + 1}>`).join("") + '<a:hlink><a:srgbClr val="0C66E4"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>'
  + '<a:fontScheme name="DynamiteOrbit"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
  + `<a:fmtScheme name="DynamiteOrbit"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const MASTER = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`
  + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>';
const LAYOUT = `${HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const rels = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith("http") ? type : `${REL}/${type}`}" Target="${target}"/>`).join("")}</Relationships>`;

/** A .pptx file. o : { title, slides: [slide], confidential (the note of the project, or none), when } → Uint8Array */
export function pptx(o) {
  const slides = o.slides || [], files = [], n = slides.length, when = o.when || new Date(), imgs = [];
  slides.forEach((s, i) => { if (s.image && s.image.bytes) imgs.push(i); });
  const ext = (s) => (s.image.type === "png" ? "png" : "jpeg");
  files.push({ name: "[Content_Types].xml", bytes: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>`
    + `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`
    + `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT}.slide+xml"/>`).join("")}</Types>` });
  files.push({ name: "_rels/.rels", bytes: rels([["rId1", "officeDocument", "ppt/presentation.xml"], ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"]]) });
  files.push({ name: "docProps/core.xml", bytes: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(o.title || "")}</dc:title><dc:creator>DynamiteOrbit</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${when.toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` });
  files.push({ name: "ppt/presentation.xml", bytes: `${HEAD}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${3 + i}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` });
  files.push({ name: "ppt/_rels/presentation.xml.rels", bytes: rels([["rId1", "slideMaster", "slideMasters/slideMaster1.xml"], ["rId2", "theme", "theme/theme1.xml"], ...slides.map((_, i) => [`rId${3 + i}`, "slide", `slides/slide${i + 1}.xml`])]) });
  files.push({ name: "ppt/theme/theme1.xml", bytes: THEME }, { name: "ppt/slideMasters/slideMaster1.xml", bytes: MASTER }, { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", bytes: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]) });
  files.push({ name: "ppt/slideLayouts/slideLayout1.xml", bytes: LAYOUT }, { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", bytes: rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]) });
  slides.forEach((s, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, bytes: slideXml(s, i + 1, { count: n, confidential: o.confidential || "" }) });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, bytes: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ...(s.image && s.image.bytes ? [["rId2", "image", `../media/image${i + 1}.${ext(s)}`]] : [])]) });
    if (s.image && s.image.bytes) files.push({ name: `ppt/media/image${i + 1}.${ext(s)}`, bytes: s.image.bytes });
  });
  return zip(files, when);
}
