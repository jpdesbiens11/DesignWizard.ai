/* DynamiteOrbit.ai — a spreadsheet (.xlsx, Office Open XML) written by hand from a neutral workbook model : sheets of
   cells — text, numbers, FORMULAS that stay alive in Excel and LibreOffice —, named cells, a few styles (title, heading,
   the yellow of a cell to fill, the result, the verdict), limits on what a cell accepts, a verdict that changes colour,
   pictures and line charts. An .xlsx is a ZIP of XML parts, stored here without compression.
   Every sheet carries the mark of the platform — its picture, its line on top, its note at the foot of the printed page.

   book : { title, subject, author, date, sheets : [sheet], names : [{ name, ref }] }
   sheet : { name (no space, no accent), cols : [width…], rows : [[cell…] | { h, cells }], merges : ["A1:D1"], freeze : rows kept on top,
             limits : [{ ref, min, max, list (a few words) | listRef (a range), text }], verdicts : [{ ref }] (a cell that reads OK / NON), pictures : [{ png, col, row, w, h (mm) }],
             charts : [{ title, x, y : [{ name, ref }], xTitle, yTitle, from : [col, row], to : [col, row] }] }
   cell : null | number | string | { v (value, or the last result of a formula), f (formula, without « = »), s (style) } */

import { zip } from "./zip.js";
import { FOOT_NOTE, MARK, BRAND } from "./brand.js";

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', esc = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main", REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", PKG = "http://schemas.openxmlformats.org/package/2006/relationships", DML = "http://schemas.openxmlformats.org/drawingml/2006/main";
/** The name of a column : 0 → A, 26 → AA. */
export const colName = (i) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
/** The address of a cell : (2, 4) → C5 ; absolute : $C$5. */
export const cellRef = (col, row, abs = false) => (abs ? `$${colName(col)}$${row + 1}` : `${colName(col)}${row + 1}`);

/* the styles : a name → what it looks like. font [size, bold, colour, italic], fill, border, align, wrap, num (a number read as an engineer reads it) */
export const XL_STYLES = {
  plain: {}, title: { font: [16, 1, "1F3A5F"] }, brand: { font: [11, 1, "1F3A5F"] }, sub: { font: [10, 0, "5A6472", 1] }, head: { font: [10, 1, "1F3A5F"], fill: "DDE5F0", border: 1 }, group: { font: [10, 1, "5A6472"], fill: "EEF0F3" },
  label: { border: 1, wrap: 1 }, input: { font: [11, 1, "172B4D"], fill: "FFF4C2", border: 1, align: "right" }, choice: { font: [11, 1, "172B4D"], fill: "FFF4C2", border: 1 }, prop: { num: 1, font: [11, 0, "172B4D"], fill: "FFF9E0", border: 1, align: "right" },
  output: { num: 1, font: [11, 1, "0B4F2A"], fill: "E6F4EA", border: 1, align: "right" }, helper: { num: 1, font: [10, 0, "5A6472"], border: 1, align: "right" }, value: { num: 1, border: 1, align: "right" }, unit: { font: [9, 0, "5A6472"], border: 1 },
  note: { font: [9, 0, "5A6472"], wrap: 1 }, text: { wrap: 1 }, verdict: { font: [11, 1, "172B4D"], border: 1, align: "center" }, ok: { font: [11, 1, "0B4F2A"], fill: "DCF2E3", border: 1, align: "center" }, bad: { font: [11, 1, "8A1C1C"], fill: "F9D9D9", border: 1, align: "center" },
  warn: { font: [10, 0, "7A4B00"], fill: "FCEFC7", wrap: 1 }, th: { font: [10, 1, "FFFFFF"], fill: "1F3A5F", border: 1, align: "center", wrap: 1 }, td: { num: 1, border: 1, align: "right" }, tdl: { border: 1, wrap: 1 },
};
const STYLE_KEYS = Object.keys(XL_STYLES);
function stylesXml() {
  const fonts = ['<font><sz val="10"/><color rgb="FF1C2430"/><name val="Calibri"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], xfs = [];
  const side = '<left style="thin"><color rgb="FF9AA5B4"/></left><right style="thin"><color rgb="FF9AA5B4"/></right><top style="thin"><color rgb="FF9AA5B4"/></top><bottom style="thin"><color rgb="FF9AA5B4"/></bottom><diagonal/>';
  for (const k of STYLE_KEYS) { const s = XL_STYLES[k]; let font = 0, fill = 0;
    if (s.font) { fonts.push(`<font>${s.font[1] ? "<b/>" : ""}${s.font[3] ? "<i/>" : ""}<sz val="${s.font[0]}"/><color rgb="FF${s.font[2]}"/><name val="Calibri"/></font>`); font = fonts.length - 1; }
    if (s.fill) { fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`); fill = fills.length - 1; }
    xfs.push(`<xf numFmtId="${s.num ? 164 : 0}" fontId="${font}" fillId="${fill}" borderId="${s.border ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${s.num ? ' applyNumberFormat="1"' : ""}><alignment vertical="center"${s.align ? ` horizontal="${s.align}"` : ""}${s.wrap ? ' wrapText="1"' : ""}/></xf>`); }
  const dxf = (font, fill) => `<dxf><font><b/><color rgb="FF${font}"/></font><fill><patternFill><bgColor rgb="FF${fill}"/></patternFill></fill></dxf>`;
  /* zero as 0 ; a small number in powers of ten ; the others with up to four decimals */
  return `${HEAD}<styleSheet xmlns="${MAIN}"><numFmts count="1"><numFmt numFmtId="164" formatCode="[=0]0;[&lt;0.01]0.000E+00;#,##0.0###"/></numFmts><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${side}</border></borders>`
    + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3">${dxf("0B4F2A", "DCF2E3")}${dxf("8A1C1C", "F9D9D9")}${dxf("7A4B00", "FCEFC7")}</dxfs></styleSheet>`;
}

function cellXml(c, col, row) {
  if (c === null || c === undefined || c === "") return "";
  const x = typeof c === "object" ? c : { v: c }, r = cellRef(col, row), s = x.s && STYLE_KEYS.includes(x.s) ? ` s="${STYLE_KEYS.indexOf(x.s)}"` : "", num = typeof x.v === "number" && Number.isFinite(x.v);
  if (x.f) return num ? `<c r="${r}"${s}><f>${esc(x.f)}</f><v>${x.v}</v></c>` : `<c r="${r}"${s} t="str"><f>${esc(x.f)}</f><v>${esc(x.v ?? "")}</v></c>`;
  if (num) return `<c r="${r}"${s}><v>${x.v}</v></c>`;
  if (x.v === null || x.v === undefined || x.v === "") return s ? `<c r="${r}"${s}/>` : "";
  return `<c r="${r}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(x.v)}</t></is></c>`;
}
function sheetXml(sh, hasDrawing) {
  const rows = (sh.rows || []).map((r, i) => { const cells = Array.isArray(r) ? r : (r && r.cells) || [], h = !Array.isArray(r) && r && r.h ? ` ht="${r.h}" customHeight="1"` : "", inner = cells.map((c, k) => cellXml(c, k, i)).join(""); return inner || h ? `<row r="${i + 1}"${h}>${inner}</row>` : ""; }).join("");
  const cols = (sh.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join(""), fz = sh.freeze > 0 ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : "";
  const merges = (sh.merges || []).length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  const verdicts = (sh.verdicts || []).map((v, k) => `<conditionalFormatting sqref="${v.ref}"><cfRule type="cellIs" dxfId="0" priority="${3 * k + 1}" operator="equal"><formula>"OK"</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="${3 * k + 2}" operator="equal"><formula>"NON"</formula></cfRule><cfRule type="cellIs" dxfId="2" priority="${3 * k + 3}" operator="equal"><formula>"JUSTE"</formula></cfRule></conditionalFormatting>`).join("");
  const limits = (sh.limits || []).map((l) => (l.list || l.listRef ? `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorTitle="Choix inconnu" error="${esc(l.text || "Choisir une valeur de la liste.")}" sqref="${l.ref}"><formula1>${l.listRef ? esc(l.listRef) : `"${esc(l.list.join(","))}"`}</formula1></dataValidation>`
    : `<dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" errorStyle="warning" errorTitle="Hors de la plage du modèle" error="${esc(l.text || "")}" sqref="${l.ref}"><formula1>${l.min}</formula1><formula2>${l.max}</formula2></dataValidation>`)).join("");
  return `${HEAD}<worksheet xmlns="${MAIN}" xmlns:r="${REL}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0">${fz}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData>${merges}${verdicts}`
    + `${limits ? `<dataValidations count="${sh.limits.length}">${limits}</dataValidations>` : ""}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.9" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>`
    + `<headerFooter><oddHeader>&amp;L&amp;8${esc(MARK)}&amp;R&amp;8${esc(sh.name)}</oddHeader><oddFooter>&amp;L&amp;7${esc(FOOT_NOTE)}&amp;R&amp;8&amp;P / &amp;N</oddFooter></headerFooter>${hasDrawing ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
}
const EMU = 36000;                                             // English metric units in a millimetre
function chartXml(ch) {
  const title = (t, size = 1000) => (t ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:rPr lang="fr-CA" sz="${size}" b="1"/><a:t>${esc(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` : ""), COLORS = ["2563EB", "E5484D", "0EA5A4", "8B5CF6"];
  const ser = ch.y.map((s, k) => `<c:ser><c:idx val="${k}"/><c:order val="${k}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx><c:spPr><a:ln w="22225" cap="rnd"><a:solidFill><a:srgbClr val="${COLORS[k % 4]}"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${COLORS[k % 4]}"/></a:solidFill></c:spPr></c:marker><c:xVal><c:numRef><c:f>${esc(ch.x)}</c:f></c:numRef></c:xVal><c:yVal><c:numRef><c:f>${esc(s.ref)}</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>`).join("");
  const axis = (id, other, pos, t, grid) => `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${grid ? '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D5DAE1"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>' : ""}${title(t, 900)}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${other}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`;
  return `${HEAD}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="${DML}" xmlns:r="${REL}"><c:roundedCorners val="0"/><c:chart>${title(ch.title, 1100)}<c:autoTitleDeleted val="${ch.title ? 0 : 1}"/><c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${ser}<c:axId val="5001"/><c:axId val="5002"/></c:scatterChart>${axis(5001, 5002, "b", ch.xTitle, false)}${axis(5002, 5001, "l", ch.yTitle, true)}</c:plotArea>${ch.y.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : ""}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}
function drawingXml(sh, rids) {
  const at = (tag, [c, r]) => `<xdr:${tag}><xdr:col>${c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:${tag}>`, out = []; let id = 1;
  for (const p of sh.pictures || []) { const cx = Math.round(p.w * EMU), cy = Math.round(p.h * EMU), n = ++id;
    out.push(`<xdr:oneCellAnchor>${at("from", [p.col || 0, p.row || 0])}<xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${n}" name="${esc(p.name || "DynamiteOrbit.ai")}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rids.shift()}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`); }
  for (const c of sh.charts || []) { const n = ++id;
    out.push(`<xdr:twoCellAnchor>${at("from", c.from)}${at("to", c.to)}<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${n}" name="Graphique ${n - 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rids.shift()}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`); }
  return `${HEAD}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${DML}" xmlns:r="${REL}">${out.join("")}</xdr:wsDr>`;
}

/** An .xlsx file from a workbook model. → Uint8Array */
export function xlsx(book) {
  const when = book.date || new Date(0), iso = when.toISOString().replace(/\.\d+Z$/, "Z"), sheets = book.sheets || [], files = [], types = [], wbRels = [];
  let charts = 0, pics = 0; const seen = new Map();          // a picture used on several sheets is stored once
  sheets.forEach((sh, k) => {
    const n = k + 1, draws = (sh.pictures || []).length + (sh.charts || []).length;
    wbRels.push(`<Relationship Id="rId${n}" Type="${REL}/worksheet" Target="worksheets/sheet${n}.xml"/>`); types.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    files.push({ name: `xl/worksheets/sheet${n}.xml`, bytes: sheetXml(sh, draws > 0) });
    if (!draws) return;
    const rels = [], rids = [];
    for (const p of sh.pictures || []) { let name = seen.get(p.png); if (!name) { name = `image${++pics}.png`; seen.set(p.png, name); files.push({ name: `xl/media/${name}`, bytes: p.png }); } rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/image" Target="../media/${name}"/>`); rids.push(`rId${rels.length}`); }
    for (const c of sh.charts || []) { const name = `chart${++charts}.xml`; files.push({ name: `xl/charts/${name}`, bytes: chartXml(c) }); types.push(`<Override PartName="/xl/charts/${name}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`); rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/chart" Target="../charts/${name}"/>`); rids.push(`rId${rels.length}`); }
    files.push({ name: `xl/drawings/drawing${n}.xml`, bytes: drawingXml(sh, rids) }, { name: `xl/drawings/_rels/drawing${n}.xml.rels`, bytes: `${HEAD}<Relationships xmlns="${PKG}">${rels.join("")}</Relationships>` },
      { name: `xl/worksheets/_rels/sheet${n}.xml.rels`, bytes: `${HEAD}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>` });
    types.push(`<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
  });
  wbRels.push(`<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/>`);
  const names = (book.names || []).length ? `<definedNames>${book.names.map((d) => `<definedName name="${esc(d.name)}">${esc(d.ref)}</definedName>`).join("")}</definedNames>` : "";
  return zip([
    { name: "[Content_Types].xml", bytes: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${types.join("")}</Types>` },
    { name: "_rels/.rels", bytes: `${HEAD}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", bytes: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(book.title)}</dc:title><dc:subject>${esc(book.subject || "")}</dc:subject><dc:creator>${esc(book.author || "")}</dc:creator><dc:description>${esc(FOOT_NOTE)}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>` },
    { name: "docProps/app.xml", bytes: `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${esc(BRAND.site)}</Application></Properties>` },
    { name: "xl/workbook.xml", bytes: `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews><sheets>${sheets.map((sh, k) => `<sheet name="${esc(sh.name)}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`).join("")}</sheets>${names}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", bytes: `${HEAD}<Relationships xmlns="${PKG}">${wbRels.join("")}</Relationships>` },
    { name: "xl/styles.xml", bytes: stylesXml() }, ...files], when);
}
