/* DesignWizard.ai — 2D engineering-drawing kit: abstract Sheet + everything the two backends (pdf.js, svg.js)
   must agree on: font metrics (Adobe core-14 AFM widths), WinAnsi text handling, style / text resolution,
   arc → Bézier conversion and JPEG header parsing.
   Units are millimetres, origin top-left, y down (like SVG). Angles are degrees, 0 = +x, positive toward +y
   (clockwise on screen). No DOM, no Buffer: runs unchanged in the browser and in Node. */

export const MM_TO_PT = 72 / 25.4;

/* Named dash patterns (mm), ISO 128 style. */
export const DASHES = {
  hidden: [3, 1.5],
  center: [8, 1.5, 1.5, 1.5],
  phantom: [8, 1.5, 1.5, 1.5, 1.5, 1.5],
};

/* ---- font metrics --------------------------------------------------------------------------------------- */

/* Advance widths (1/1000 em) for WinAnsi codes 32..255, from the Adobe AFM files. */
const W_HELVETICA = (
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 " +
  "584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 " +
  "667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 " +
  "278 556 500 722 500 500 500 334 260 334 584 350 556 350 222 556 333 1000 556 556 333 1000 667 333 1000 350 611 350 " +
  "350 222 222 333 333 350 556 1000 333 1000 500 333 944 350 500 667 278 333 556 556 556 556 260 556 333 737 370 556 " +
  "584 333 737 333 400 584 333 333 333 556 537 278 333 333 365 556 834 834 834 611 667 667 667 667 667 667 1000 722 " +
  "667 667 667 667 278 278 278 278 722 722 778 778 778 778 778 584 778 722 722 722 722 667 667 611 556 556 556 556 " +
  "556 556 889 500 556 556 556 556 278 278 278 278 556 556 556 556 556 556 556 584 611 556 556 556 556 500 556 500"
).split(" ").map(Number);

const W_HELVETICA_BOLD = (
  "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 " +
  "584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 " +
  "667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 " +
  "333 611 556 778 556 556 500 389 280 389 584 350 556 350 278 556 500 1000 556 556 333 1000 667 333 1000 350 611 350 " +
  "350 278 278 500 500 350 556 1000 333 1000 556 333 944 350 500 667 278 333 556 556 556 556 280 556 333 737 370 556 " +
  "584 333 737 333 400 584 333 333 333 611 556 278 333 333 365 556 834 834 834 611 722 722 722 722 722 722 1000 722 " +
  "667 667 667 667 278 278 278 278 722 722 778 778 778 778 778 584 778 722 722 722 722 667 667 611 556 556 556 556 " +
  "556 556 889 556 556 556 556 556 278 278 278 278 611 611 611 611 611 611 611 584 611 611 611 611 611 556 611 556"
).split(" ").map(Number);

/* The four logical fonts. `cap` = cap height / em (used for the 'middle' and 'top' baselines). */
export const FONTS = {
  sans: { pdf: "Helvetica", widths: W_HELVETICA, cap: 0.718, desc: 0.207 },
  bold: { pdf: "Helvetica-Bold", widths: W_HELVETICA_BOLD, cap: 0.718, desc: 0.207 },
  italic: { pdf: "Helvetica-Oblique", widths: W_HELVETICA, cap: 0.718, desc: 0.207 },
  mono: { pdf: "Courier", widths: null, cap: 0.562, desc: 0.157 }, // Courier: 600 everywhere
};

/* ---- WinAnsi (CP1252) ----------------------------------------------------------------------------------- */

/* Unicode characters of CP1252 codes 0x80..0x9F ("\0" = undefined code). */
const CP1252_HIGH = "€\0‚ƒ„…†‡ˆ‰Š‹Œ\0Ž\0" +
  "\0‘’“”•–—˜™š›œ\0žŸ";
const CP1252_CODE = new Map();
for (let i = 0; i < 32; i++) if (CP1252_HIGH[i] !== "\0") CP1252_CODE.set(CP1252_HIGH[i], 0x80 + i);

/* Common technical / typographic characters that have no CP1252 code but an obvious stand-in. */
const SUBSTITUTES = {
  "⌀": "Ø", "∅": "Ø", "μ": "µ", "−": "-", "‐": "-", "‑": "-",
  " ": " ", " ": " ", " ": " ", "≤": "<=", "≥": ">=", "→": "->", "←": "<-",
  "′": "'", "″": "\"", "≈": "~", "\t": " ", "\n": " ", "\r": "",
};

/** Returns `str` restricted to characters that exist in CP1252; anything else becomes '?'. */
export function sanitizeText(str) {
  let out = "";
  for (const ch of String(str ?? "")) {
    const sub = SUBSTITUTES[ch];
    if (sub !== undefined) { out += sub; continue; }
    const c = ch.codePointAt(0);
    out += (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || CP1252_CODE.has(ch) ? ch : "?";
  }
  return out;
}

/** Encodes a string to WinAnsi (CP1252) bytes; characters outside CP1252 become '?'. */
export function toWinAnsi(str) {
  const s = sanitizeText(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = CP1252_CODE.get(s[i]) ?? s.charCodeAt(i);
  return out;
}

/** Decodes WinAnsi (CP1252) bytes back to a string. */
export function fromWinAnsi(bytes) {
  let out = "";
  for (const b of bytes) {
    if (b >= 0x80 && b <= 0x9F) out += CP1252_HIGH[b - 0x80] === "\0" ? "?" : CP1252_HIGH[b - 0x80];
    else out += String.fromCharCode(b);
  }
  return out;
}

/* ---- text measurement ----------------------------------------------------------------------------------- */

/** Width in mm of `str` set in `font` ('sans'|'bold'|'mono'|'italic') at `size` (font size in mm). */
export function textWidth(str, { size = 3.5, font = "sans" } = {}) {
  const widths = (FONTS[font] || FONTS.sans).widths;
  const bytes = toWinAnsi(str);
  if (!widths) return (bytes.length * 600 * size) / 1000;
  let w = 0;
  for (const b of bytes) w += b >= 32 ? widths[b - 32] : 0;
  return (w * size) / 1000;
}

/** Greedy word wrap: returns the lines of `str` that fit in `maxWidthMm` ('\n' forces a break). */
export function wrapText(str, maxWidthMm, opts = {}) {
  const lines = [];
  for (const para of String(str ?? "").split(/\r?\n/)) {
    let line = "";
    for (let word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, opts) <= maxWidthMm) { line = candidate; continue; }
      if (line) lines.push(line);
      // A single word wider than the column is broken by characters.
      while (word.length > 1 && textWidth(word, opts) > maxWidthMm) {
        let n = word.length - 1;
        while (n > 1 && textWidth(word.slice(0, n), opts) > maxWidthMm) n--;
        lines.push(word.slice(0, n));
        word = word.slice(n);
      }
      line = word;
    }
    lines.push(line);
  }
  return lines;
}

/* ---- style / text resolution (shared by both backends) -------------------------------------------------- */

/** '#rgb' | '#rrggbb' → '#rrggbb' (lower case); anything unreadable → black. */
export function normColor(c) {
  const s = String(c ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s === "white" ? "#ffffff" : "#000000";
}

/** '#rrggbb' → [r, g, b] in 0..1. */
export function colorRgb(c) {
  const s = normColor(c);
  return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

/** Normalises a user style. `stroke` is false when w <= 0 or color is null/'none' (fill-only shapes). */
export function resolveStyle(style = {}) {
  const s = style || {};
  const w = Number.isFinite(s.w) ? s.w : 0.25;
  let dash = s.dash ?? null;
  if (typeof dash === "string") dash = DASHES[dash] || null;
  if (!Array.isArray(dash) || !dash.length || !dash.every((v) => Number.isFinite(v) && v >= 0) || !dash.some((v) => v > 0)) dash = null;
  const noColor = s.color === null || s.color === "none";
  return {
    w,
    stroke: w > 0 && !noColor,
    color: noColor ? "#000000" : normColor(s.color ?? "#000"),
    fill: s.fill && s.fill !== "none" ? normColor(s.fill) : null,
    dash,
    cap: s.cap === "round" ? "round" : "butt",
    close: !!s.close,
    opacity: clamp01(s.opacity ?? 1),
  };
}

/** Normalises text options. (dx, dy) is the offset from the anchor (x, y) to the start of the baseline,
    expressed in the (possibly rotated) text frame. */
export function resolveText(str, opts = {}) {
  const o = opts || {};
  const font = FONTS[o.font] ? o.font : "sans";
  const size = Number.isFinite(o.size) && o.size > 0 ? o.size : 3.5;
  const text = sanitizeText(str);
  const width = textWidth(text, { size, font });
  const align = o.align === "center" || o.align === "right" ? o.align : "left";
  const m = FONTS[font];
  const dy = o.baseline === "middle" ? (m.cap / 2) * size : o.baseline === "top" ? m.cap * size
    : o.baseline === "bottom" ? -m.desc * size : 0;
  return {
    str: text, font, size, width, align,
    dx: align === "center" ? -width / 2 : align === "right" ? -width : 0,
    dy,
    angle: Number.isFinite(o.angle) ? o.angle : 0,
    color: normColor(o.color ?? "#000"),
    opacity: clamp01(o.opacity ?? 1),
  };
}

/* ---- geometry ------------------------------------------------------------------------------------------- */

/** Sweep in degrees (0..360) of an arc drawn from a0 to a1 with increasing angle. */
export function arcSweep(a0, a1) {
  let sweep = a1 - a0;
  if (sweep >= 360) return 360;
  while (sweep < 0) sweep += 360;
  return sweep;
}

/** Arc as cubic Béziers (≤ 90° each): { start: [x, y], curves: [[x1, y1, x2, y2, x, y], ...] }. */
export function arcToBeziers(cx, cy, r, a0, a1) {
  const sweep = arcSweep(a0, a1);
  const n = Math.max(1, Math.ceil(sweep / 90 - 1e-9));
  const step = ((sweep / n) * Math.PI) / 180;
  const k = (4 / 3) * Math.tan(step / 4);
  let t = (a0 * Math.PI) / 180;
  const start = [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  const curves = [];
  for (let i = 0; i < n; i++) {
    const t1 = t + step;
    const c0 = Math.cos(t), s0 = Math.sin(t), c1 = Math.cos(t1), s1 = Math.sin(t1);
    curves.push([cx + r * (c0 - k * s0), cy + r * (s0 + k * c0), cx + r * (c1 + k * s1), cy + r * (s1 - k * c1),
      cx + r * c1, cy + r * s1]);
    t = t1;
  }
  return { start, curves };
}

/** Compact number formatting for both backends (no exponent, trailing zeros removed). */
export function num(v, decimals = 3) {
  if (!Number.isFinite(v)) return "0";
  const s = v.toFixed(decimals);
  const t = s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  return t === "-0" ? "0" : t;
}

/* ---- JPEG / base64 -------------------------------------------------------------------------------------- */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64Encode(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

export function base64Decode(str) {
  const clean = String(str).replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0, bits = 0, n = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[n++] = (acc >> bits) & 0xFF; }
  }
  return out.subarray(0, n);
}

/** Accepts a JPEG as a data URL, a bare base64 string, a Uint8Array or an ArrayBuffer → Uint8Array. */
export function jpegBytes(src) {
  if (src instanceof Uint8Array) return src;
  if (src instanceof ArrayBuffer) return new Uint8Array(src);
  if (typeof src === "string") {
    const i = src.indexOf("base64,");
    return base64Decode(i >= 0 ? src.slice(i + 7) : src);
  }
  throw new Error("image(): expected a JPEG data URL or a Uint8Array");
}

/** Reads the SOFn marker of a JPEG: { width, height, components, bits } (pixels). Throws if not a JPEG. */
export function parseJpeg(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error("image(): not a JPEG (only JPEG is supported)");
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xFF) { i++; continue; } // fill byte
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
    if (marker === 0xD9 || marker === 0xDA) break; // EOI / start of scan: no SOF found before the image data
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSof && i + 9 < bytes.length) {
      return {
        bits: bytes[i + 4],
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9],
      };
    }
    i += 2 + len;
  }
  throw new Error("image(): JPEG without a SOF marker");
}

/* ---- abstract sheet ------------------------------------------------------------------------------------- */

const abstract = (name) => { throw new Error(`Sheet.${name}() is not implemented by this backend`); };

/** Base class of the drawing backends. All primitives return `this` so calls can be chained. */
export class Sheet {
  /** @param {{width?: number, height?: number, title?: string}} opts page size in mm (default A4 landscape) */
  constructor({ width = 297, height = 210, title = "" } = {}) {
    this.width = width;
    this.height = height;
    this.title = String(title ?? "");
  }

  /* style: { w, color, fill, dash, cap, opacity } — see resolveStyle(). */
  line(x1, y1, x2, y2, style) { return abstract("line"); }
  polyline(points, style) { return abstract("polyline"); }       // style.close, style.fill
  rect(x, y, w, h, style) { return abstract("rect"); }
  circle(cx, cy, r, style) { return abstract("circle"); }
  arc(cx, cy, r, a0, a1, style) { return abstract("arc"); }       // from a0 to a1, increasing angle
  path(cmds, style) { return abstract("path"); }                  // [['M',x,y],['L',x,y],['C',x1,y1,x2,y2,x,y],['Z']]
  /* opts: { size, font, align, baseline, angle, color } — see resolveText(). */
  text(x, y, str, opts) { return abstract("text"); }
  image(x, y, w, h, jpeg) { return abstract("image"); }           // JPEG data URL or bytes
  newPage() { return abstract("newPage"); }

  /** Width in mm of `str`; identical for every backend (AFM tables). */
  textWidth(str, opts) { return textWidth(str, opts); }
  /** Lines of `str` wrapped to `maxWidthMm`. */
  wrapText(str, maxWidthMm, opts) { return wrapText(str, maxWidthMm, opts); }
}
