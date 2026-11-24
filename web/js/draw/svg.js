/* DynamiteOrbit.ai — SVG backend of the drawing kit. Produces standalone SVG markup (one document per page,
   width/height in mm, viewBox in mm) that renders like the PDF backend: same geometry, same text layout
   (text is positioned from the shared AFM metrics and pinned with textLength). No DOM access. */

import {
  Sheet, resolveStyle, resolveText, arcSweep, num, base64Encode, jpegBytes, parseJpeg,
} from "./sheet.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT_ATTR = {
  sans: "",
  bold: ' font-weight="bold"',
  italic: ' font-style="italic"',
  mono: ' font-family="Courier New, Courier, monospace"',
};

export class SvgSheet extends Sheet {
  /** @param {{width?: number, height?: number, title?: string, background?: string|null, exactText?: boolean}} opts
      background: page colour (default white, null = transparent).
      exactText: pin every text run to its AFM width with textLength (default true) so that the layout
      matches the PDF even when the viewer substitutes another sans-serif font. */
  constructor(opts = {}) {
    super(opts);
    this.background = opts.background === undefined ? "#ffffff" : opts.background;
    this.exactText = opts.exactText !== false;
    this._pages = [];
    this._addPage(this.width, this.height);
  }

  get pageCount() { return this._pages.length; }

  /** Starts a new page (same size as the first one unless a size is given). */
  newPage({ width = this.width, height = this.height } = {}) {
    this._addPage(width, height);
    return this;
  }

  _addPage(width, height) {
    this._page = { width, height, els: [] };
    this._pages.push(this._page);
  }

  /** Presentation attributes for a shape. */
  _attrs(st, allowFill = true) {
    let a = ` fill="${allowFill && st.fill ? st.fill : "none"}"`;
    if (st.stroke) {
      a += ` stroke="${st.color}" stroke-width="${num(st.w)}"`;
      if (st.dash) a += ` stroke-dasharray="${st.dash.map((v) => num(v)).join(" ")}"`;
      if (st.cap === "round") a += ' stroke-linecap="round" stroke-linejoin="round"';
    }
    if (st.opacity < 1) a += ` opacity="${num(st.opacity)}"`;
    return a;
  }

  _push(markup) { this._page.els.push(markup); return this; }

  /* ---- primitives ---- */

  line(x1, y1, x2, y2, style) {
    const st = resolveStyle(style);
    if (!st.stroke) return this;
    return this._push(`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}"${this._attrs(st, false)}/>`);
  }

  polyline(points, style) {
    if (!points || points.length < 2) return this;
    const st = resolveStyle(style);
    if (!st.stroke && !st.fill) return this;
    const pts = points.map((p) => `${num(p[0])},${num(p[1])}`).join(" ");
    return this._push(`<${st.close ? "polygon" : "polyline"} points="${pts}"${this._attrs(st)}/>`);
  }

  rect(x, y, w, h, style) {
    const st = resolveStyle(style);
    if (!st.stroke && !st.fill) return this;
    // Negative sizes are legal in PDF (`re`) but not in SVG: normalise.
    const rx = w < 0 ? x + w : x, ry = h < 0 ? y + h : y;
    return this._push(`<rect x="${num(rx)}" y="${num(ry)}" width="${num(Math.abs(w))}" height="${num(Math.abs(h))}"${this._attrs(st)}/>`);
  }

  circle(cx, cy, r, style) {
    const st = resolveStyle(style);
    if (!st.stroke && !st.fill) return this;
    return this._push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}"${this._attrs(st)}/>`);
  }

  arc(cx, cy, r, a0, a1, style) {
    const sweep = arcSweep(a0, a1);
    if (sweep >= 360) return this.circle(cx, cy, r, style);
    const st = resolveStyle(style);
    if ((!st.stroke && !st.fill) || sweep <= 0) return this;
    const t0 = (a0 * Math.PI) / 180, t1 = ((a0 + sweep) * Math.PI) / 180;
    const d = `M${num(cx + r * Math.cos(t0))} ${num(cy + r * Math.sin(t0))}` +
      `A${num(r)} ${num(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${num(cx + r * Math.cos(t1))} ${num(cy + r * Math.sin(t1))}` +
      (st.close ? "Z" : "");
    return this._push(`<path d="${d}"${this._attrs(st)}/>`);
  }

  path(cmds, style) {
    let d = "";
    for (const c of cmds || []) {
      const k = String(c[0]).toUpperCase();
      if (k === "M" || k === "L") d += `${k}${num(c[1])} ${num(c[2])}`;
      else if (k === "C") d += `C${c.slice(1, 7).map((v) => num(v)).join(" ")}`;
      else if (k === "Z") d += "Z";
    }
    if (!d) return this;
    const st = resolveStyle(style);
    if (!st.stroke && !st.fill) return this;
    if (st.close && !d.endsWith("Z")) d += "Z";
    return this._push(`<path d="${d}"${this._attrs(st)}/>`);
  }

  text(x, y, str, opts) {
    const t = resolveText(str, opts);
    if (!t.str) return this;
    let a = ` font-size="${num(t.size)}"${FONT_ATTR[t.font]} fill="${t.color}"`;
    if (this.exactText) {
      // Start of the baseline computed from the AFM metrics, exactly like the PDF backend.
      a = ` x="${num(x + t.dx)}" y="${num(y + t.dy)}"${a}`;
      if (t.width > 0) a += ` textLength="${num(t.width)}" lengthAdjust="spacingAndGlyphs"`;
    } else {
      a = ` x="${num(x)}" y="${num(y + t.dy)}"${a}`;
      if (t.align !== "left") a += ` text-anchor="${t.align === "center" ? "middle" : "end"}"`;
    }
    if (t.angle) a += ` transform="rotate(${num(t.angle)} ${num(x)} ${num(y)})"`;
    if (t.opacity < 1) a += ` opacity="${num(t.opacity)}"`;
    return this._push(`<text${a}>${esc(t.str)}</text>`);
  }

  image(x, y, w, h, jpeg) {
    const bytes = jpegBytes(jpeg);
    parseJpeg(bytes); // same validation as the PDF backend (JPEG only)
    const href = typeof jpeg === "string" && jpeg.startsWith("data:image/jpeg") ? jpeg : `data:image/jpeg;base64,${base64Encode(bytes)}`;
    return this._push(`<image x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="none" xlink:href="${esc(href)}"/>`);
  }

  /* ---- serialisation ---- */

  _document(page, index) {
    const title = this.title ? `<title>${esc(this.title)}${this._pages.length > 1 ? ` (${index + 1}/${this._pages.length})` : ""}</title>\n` : "";
    const bg = this.background ? `<rect x="0" y="0" width="${num(page.width)}" height="${num(page.height)}" fill="${esc(this.background)}"/>\n` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"` +
      ` width="${num(page.width)}mm" height="${num(page.height)}mm" viewBox="0 0 ${num(page.width)} ${num(page.height)}"` +
      ` font-family="Helvetica, Arial, sans-serif" fill="none" stroke="none" stroke-miterlimit="10" xml:space="preserve">\n` +
      `${title}${bg}${page.els.join("\n")}\n</svg>\n`;
  }

  /** @returns {string} SVG markup of one page (default: the current, i.e. last started, page) */
  toString(pageIndex = this._pages.length - 1) {
    const i = Math.min(Math.max(0, pageIndex | 0), this._pages.length - 1);
    return this._document(this._pages[i], i);
  }

  /** @returns {string[]} one standalone SVG document per page */
  toStrings() { return this._pages.map((p, i) => this._document(p, i)); }

  /** Convenience for downloads in the browser (current page). */
  toBlob(pageIndex) { return new Blob([this.toString(pageIndex)], { type: "image/svg+xml" }); }
}
