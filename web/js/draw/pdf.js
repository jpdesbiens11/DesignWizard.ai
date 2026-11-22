/* DesignOrbit.ai — vector PDF backend of the drawing kit. Writes a plain PDF 1.4 (uncompressed content
   streams, standard fonts with /WinAnsiEncoding, JPEG images as DCTDecode) into a Uint8Array.
   Each page content starts with one `cm` matrix that converts millimetres / y-down to PDF points / y-up,
   so every primitive is emitted directly in sheet coordinates. */

import {
  Sheet, MM_TO_PT, FONTS, resolveStyle, resolveText, arcToBeziers, arcSweep, colorRgb, num, toWinAnsi,
  jpegBytes, parseJpeg,
} from "./sheet.js";

const FONT_RES = { sans: "F1", bold: "F2", italic: "F3", mono: "F4" };

const rgb = (c) => colorRgb(c).map((v) => num(v, 3)).join(" ");

/** PDF literal string body: WinAnsi bytes, with '\', '(' and ')' escaped and non-ASCII bytes in octal. */
function pdfString(str) {
  let out = "";
  for (const b of toWinAnsi(str)) {
    if (b === 0x28 || b === 0x29 || b === 0x5C) out += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) out += `\\${b.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(b);
  }
  return out;
}

/** Text string for the Info dictionary: UTF-16BE with BOM, as a hex string (any Unicode title works). */
function pdfHexText(str) {
  let out = "FEFF";
  for (let i = 0; i < str.length; i++) out += str.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  return `<${out}>`;
}

function pdfDate(d) {
  const p = (v, n = 2) => String(v).padStart(n, "0");
  return `D:${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}` +
    `${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** ASCII / Latin-1 string → bytes (every string written by this module is 7-bit ASCII). */
function latin1(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
  return out;
}

export class PdfSheet extends Sheet {
  /** @param {{width?: number, height?: number, title?: string, date?: Date}} opts */
  constructor(opts = {}) {
    super(opts);
    this._date = opts.date instanceof Date ? opts.date : new Date();
    this._pages = [];
    this._images = [];           // { name, bytes, width, height, components, bits }
    this._imageBySource = new Map();
    this._gstates = new Map();   // opacity (string) → resource name
    this._addPage(this.width, this.height);
  }

  get pageCount() { return this._pages.length; }

  /** Starts a new page (same size as the first one unless a size is given). */
  newPage({ width = this.width, height = this.height } = {}) {
    this._addPage(width, height);
    return this;
  }

  _addPage(width, height) {
    this._page = { width, height, ops: [] };
    this._gs = { dash: "", cap: 0 }; // graphics state already emitted on this page
    this._pages.push(this._page);
  }

  /* ---- graphics state ---- */

  _applyStroke(st) {
    const g = this._gs, o = this._page.ops;
    if (g.w !== st.w) { o.push(`${num(st.w)} w`); g.w = st.w; }
    if (g.color !== st.color) { o.push(`${rgb(st.color)} RG`); g.color = st.color; }
    const dash = st.dash ? st.dash.map((v) => num(v)).join(" ") : "";
    if (g.dash !== dash) { o.push(`[${dash}] 0 d`); g.dash = dash; }
    const cap = st.cap === "round" ? 1 : 0;
    if (g.cap !== cap) { o.push(`${cap} J ${cap} j`); g.cap = cap; } // round caps come with round joins
  }

  _applyFill(color) {
    if (this._gs.fill !== color) { this._page.ops.push(`${rgb(color)} rg`); this._gs.fill = color; }
  }

  _gsName(opacity) {
    const key = num(opacity, 3);
    if (!this._gstates.has(key)) this._gstates.set(key, `GS${this._gstates.size + 1}`);
    return this._gstates.get(key);
  }

  /** Emits a path (already built in sheet coordinates) with the fill / stroke of `st`. */
  _paint(pathOps, st, closed = false) {
    if (!st.stroke && !st.fill) return this;
    if (st.stroke) this._applyStroke(st);
    if (st.fill) this._applyFill(st.fill);
    const op = st.fill ? (st.stroke ? "B" : "f") : "S";
    const body = `${pathOps}${closed ? " h" : ""} ${op}`;
    this._page.ops.push(st.opacity < 1 ? `q /${this._gsName(st.opacity)} gs ${body} Q` : body);
    return this;
  }

  /* ---- primitives ---- */

  line(x1, y1, x2, y2, style) {
    return this._paint(`${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l`, { ...resolveStyle(style), fill: null });
  }

  polyline(points, style) {
    if (!points || points.length < 2) return this;
    const st = resolveStyle(style);
    const ops = points.map((p, i) => `${num(p[0])} ${num(p[1])} ${i ? "l" : "m"}`).join(" ");
    return this._paint(ops, st, st.close);
  }

  rect(x, y, w, h, style) {
    return this._paint(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re`, resolveStyle(style));
  }

  circle(cx, cy, r, style) {
    const { start, curves } = arcToBeziers(cx, cy, r, 0, 360);
    return this._paint(this._curveOps(start, curves), resolveStyle(style), true);
  }

  arc(cx, cy, r, a0, a1, style) {
    if (arcSweep(a0, a1) >= 360) return this.circle(cx, cy, r, style);
    const st = resolveStyle(style);
    const { start, curves } = arcToBeziers(cx, cy, r, a0, a1);
    return this._paint(this._curveOps(start, curves), st, st.close);
  }

  _curveOps(start, curves) {
    return `${num(start[0])} ${num(start[1])} m ` + curves.map((c) => `${c.map((v) => num(v)).join(" ")} c`).join(" ");
  }

  path(cmds, style) {
    const ops = [];
    for (const c of cmds || []) {
      const k = String(c[0]).toUpperCase();
      if (k === "M") ops.push(`${num(c[1])} ${num(c[2])} m`);
      else if (k === "L") ops.push(`${num(c[1])} ${num(c[2])} l`);
      else if (k === "C") ops.push(`${c.slice(1, 7).map((v) => num(v)).join(" ")} c`);
      else if (k === "Z") ops.push("h");
    }
    if (!ops.length) return this;
    const st = resolveStyle(style);
    return this._paint(ops.join(" "), st, st.close);
  }

  text(x, y, str, opts) {
    const t = resolveText(str, opts);
    if (!t.str) return this;
    const rad = (t.angle * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
    // Start of the baseline = anchor + R(angle) · (dx, dy); the text matrix also undoes the page y-flip.
    const sx = x + c * t.dx - s * t.dy, sy = y + s * t.dx + c * t.dy;
    this._applyFill(t.color);
    const body = `BT /${FONT_RES[t.font]} ${num(t.size)} Tf ${num(c, 5)} ${num(s, 5)} ${num(s, 5)} ${num(-c, 5)} ` +
      `${num(sx)} ${num(sy)} Tm (${pdfString(t.str)}) Tj ET`;
    this._page.ops.push(t.opacity < 1 ? `q /${this._gsName(t.opacity)} gs ${body} Q` : body);
    return this;
  }

  image(x, y, w, h, jpeg) {
    let im = this._imageBySource.get(jpeg);
    if (!im) {
      const bytes = jpegBytes(jpeg);
      im = { name: `Im${this._images.length + 1}`, bytes, ...parseJpeg(bytes) };
      this._images.push(im);
      this._imageBySource.set(jpeg, im);
    }
    // Image space is the unit square with (0,0) bottom-left: map it to the rectangle, top edge at y.
    this._page.ops.push(`q ${num(w)} 0 0 ${num(-h)} ${num(x)} ${num(y + h)} cm /${im.name} Do Q`);
    return this;
  }

  /* ---- serialisation ---- */

  /** @returns {Uint8Array} the bytes of a complete PDF 1.4 file */
  toBytes() {
    const objects = []; // index = object number - 1; each entry is a list of chunks (string | Uint8Array)
    const alloc = () => objects.push(null);
    const catalogId = alloc(), pagesId = alloc(), infoId = alloc(), resId = alloc();

    const fontRefs = [];
    for (const [key, res] of Object.entries(FONT_RES)) {
      const id = alloc();
      objects[id - 1] = [`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[key].pdf} /Encoding /WinAnsiEncoding >>`];
      fontRefs.push(`/${res} ${id} 0 R`);
    }
    const gsRefs = [];
    for (const [opacity, name] of this._gstates) {
      const id = alloc();
      objects[id - 1] = [`<< /Type /ExtGState /CA ${opacity} /ca ${opacity} >>`];
      gsRefs.push(`/${name} ${id} 0 R`);
    }
    const imRefs = [];
    for (const im of this._images) {
      const id = alloc();
      const cs = im.components === 1 ? "/DeviceGray" : im.components === 4 ? "/DeviceCMYK" : "/DeviceRGB";
      const decode = im.components === 4 ? " /Decode [1 0 1 0 1 0 1 0]" : ""; // Adobe CMYK JPEGs are inverted
      objects[id - 1] = [
        `<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace ${cs}` +
        ` /BitsPerComponent ${im.bits || 8}${decode} /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`,
        im.bytes, "\nendstream",
      ];
      imRefs.push(`/${im.name} ${id} 0 R`);
    }
    objects[resId - 1] = [
      `<< /ProcSet [/PDF /Text /ImageB /ImageC] /Font << ${fontRefs.join(" ")} >>` +
      (gsRefs.length ? ` /ExtGState << ${gsRefs.join(" ")} >>` : "") +
      (imRefs.length ? ` /XObject << ${imRefs.join(" ")} >>` : "") + " >>",
    ];

    const kids = [];
    for (const page of this._pages) {
      const wPt = page.width * MM_TO_PT, hPt = page.height * MM_TO_PT;
      // One matrix per page: millimetres → points, and y down → y up.
      const stream = [`q ${num(MM_TO_PT, 6)} 0 0 ${num(-MM_TO_PT, 6)} 0 ${num(hPt, 4)} cm`, ...page.ops, "Q"].join("\n");
      const contentId = alloc(), pageId = alloc();
      objects[contentId - 1] = [`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
      objects[pageId - 1] = [
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(wPt, 4)} ${num(hPt, 4)}]` +
        ` /Resources ${resId} 0 R /Contents ${contentId} 0 R >>`,
      ];
      kids.push(`${pageId} 0 R`);
    }
    objects[catalogId - 1] = [`<< /Type /Catalog /Pages ${pagesId} 0 R >>`];
    objects[pagesId - 1] = [`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`];
    objects[infoId - 1] = [
      `<< /Title ${pdfHexText(this.title)} /Creator (DesignOrbit.ai) /Producer (DesignOrbit.ai)` +
      ` /CreationDate (${pdfDate(this._date)}) >>`,
    ];

    // Assemble: header, objects (recording byte offsets), xref table, trailer.
    const chunks = [];
    let pos = 0;
    const put = (c) => { const b = typeof c === "string" ? latin1(c) : c; chunks.push(b); pos += b.length; };
    put("%PDF-1.4\n");
    put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // binary marker comment
    const offsets = [];
    objects.forEach((obj, i) => {
      offsets.push(pos);
      put(`${i + 1} 0 obj\n`);
      obj.forEach(put);
      put("\nendobj\n");
    });
    const xrefPos = pos;
    put(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    for (const off of offsets) put(`${String(off).padStart(10, "0")} 00000 n \n`);
    put(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    const out = new Uint8Array(pos);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
  }

  /** Convenience for downloads in the browser. */
  toBlob() { return new Blob([this.toBytes()], { type: "application/pdf" }); }
}
