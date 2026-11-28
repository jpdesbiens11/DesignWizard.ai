/* DynamiteOrbit.ai — small DXF writer for 2D exchange with any DWG / DXF tool (AutoCAD, DraftSight, LibreCAD, QCAD,
   laser and waterjet CAM...). ASCII DXF in the AutoCAD R12 dialect (AC1009): the oldest one every reader accepts, which is
   why polylines are POLYLINE / VERTEX / SEQEND (no LWPOLYLINE) and texts are plain ASCII (accents are removed).
   Drawing units are millimetres, 1:1, x to the right and y up. Pure module (browser and Node). */

import { normalizeProfile } from "../cad/profile.js";

const EOL = "\r\n";
/* Linetypes declared in the LTYPE table; dash lengths in drawing units (mm), negative = gap. */
const LTYPES = {
  CONTINUOUS: { text: "Solid line", pattern: [] },
  HIDDEN: { text: "Hidden __ __ __ __ __ __", pattern: [3, -1.5] },
  CENTER: { text: "Center ____ _ ____ _ ____", pattern: [12, -2.5, 2.5, -2.5] },
};

const fmt = (v) => {
  let s = (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6).replace(/0+$/, "");
  if (s.endsWith(".")) s += "0";
  return s;
};
const ascii = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7e]/g, "?");
/** R12 symbol names: capitals, digits, $ - _ (31 characters at most). */
const symbol = (s) => ascii(s).toUpperCase().replace(/[^A-Z0-9$_-]/g, "_").slice(0, 31) || "0";

export class DxfDoc {
  /** opts: {comment: text written as a DXF comment (group 999) at the top of the file}. */
  constructor(opts = {}) {
    this.comment = opts.comment || "DynamiteOrbit.ai - DXF R12 (AC1009) - units: millimetres";
    this.layers = new Map();
    this.entities = [];
    this.ext = [Infinity, Infinity, -Infinity, -Infinity];
    this.layer("0");
  }

  /** Declare (or redefine) a layer: AutoCAD colour index (7 = white / black, 8 = grey, 1 = red...) and linetype
      CONTINUOUS, HIDDEN or CENTER. Returns the name as written in the file. */
  layer(name, color = 7, linetype = "CONTINUOUS") {
    const lt = symbol(linetype);
    if (!LTYPES[lt]) throw new Error(`DXF : type de ligne inconnu « ${linetype} » (CONTINUOUS, HIDDEN ou CENTER).`);
    const key = symbol(name);
    this.layers.set(key, { name: key, color: Math.max(1, Math.min(255, Math.round(color) || 7)), linetype: lt });
    return key;
  }
  _layer(name) { const key = symbol(name ?? "0"); if (!this.layers.has(key)) this.layer(key); return key; }
  _num(...vals) { for (const v of vals) if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`DXF : coordonnée non finie (${v}).`); }
  _grow(x, y) { const e = this.ext; if (x < e[0]) e[0] = x; if (y < e[1]) e[1] = y; if (x > e[2]) e[2] = x; if (y > e[3]) e[3] = y; }

  line(x1, y1, x2, y2, layer = "0") {
    this._num(x1, y1, x2, y2); this._grow(x1, y1); this._grow(x2, y2);
    this.entities.push([[0, "LINE"], [8, this._layer(layer)], [10, fmt(x1)], [20, fmt(y1)], [30, "0.0"], [11, fmt(x2)], [21, fmt(y2)], [31, "0.0"]]);
    return this;
  }
  /** Open or closed polyline through `points` [[x, y], ...]; two points give a LINE, fewer give nothing. */
  polyline(points, layer = "0", closed = false) {
    const pts = (points || []).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-9);
    if (pts.length < 2) return this;
    if (pts.length === 2) return this.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], layer);
    const L = this._layer(layer), e = [[0, "POLYLINE"], [8, L], [66, 1], [10, "0.0"], [20, "0.0"], [30, "0.0"], [70, closed ? 1 : 0]];
    for (const p of pts) { this._num(p[0], p[1]); this._grow(p[0], p[1]); e.push([0, "VERTEX"], [8, L], [10, fmt(p[0])], [20, fmt(p[1])], [30, "0.0"]); }
    e.push([0, "SEQEND"], [8, L]);
    this.entities.push(e);
    return this;
  }
  circle(cx, cy, r, layer = "0") {
    this._num(cx, cy, r); this._grow(cx - r, cy - r); this._grow(cx + r, cy + r);
    this.entities.push([[0, "CIRCLE"], [8, this._layer(layer)], [10, fmt(cx)], [20, fmt(cy)], [30, "0.0"], [40, fmt(r)]]);
    return this;
  }
  /** Arc from angle a0 to angle a1 in degrees, counter-clockwise (the DXF convention). */
  arc(cx, cy, r, a0, a1, layer = "0") {
    this._num(cx, cy, r, a0, a1); this._grow(cx - r, cy - r); this._grow(cx + r, cy + r);
    const deg = (a) => fmt(((a % 360) + 360) % 360);
    this.entities.push([[0, "ARC"], [8, this._layer(layer)], [10, fmt(cx)], [20, fmt(cy)], [30, "0.0"], [40, fmt(r)], [50, deg(a0)], [51, deg(a1)]]);
    return this;
  }
  text(x, y, height, string, layer = "0") {
    this._num(x, y, height); this._grow(x, y);
    this.entities.push([[0, "TEXT"], [8, this._layer(layer)], [10, fmt(x)], [20, fmt(y)], [30, "0.0"], [40, fmt(height)], [1, ascii(string)], [7, "STANDARD"]]);
    return this;
  }

  toString() {
    const out = [];
    const put = (code, value) => { out.push(String(code).padStart(3, " "), String(value)); };
    const e = this.ext, has = Number.isFinite(e[0]), x0 = has ? e[0] : 0, y0 = has ? e[1] : 0, x1 = has ? e[2] : 0, y1 = has ? e[3] : 0;
    put(999, ascii(this.comment));
    put(0, "SECTION"); put(2, "HEADER");
    put(9, "$ACADVER"); put(1, "AC1009");
    put(9, "$INSBASE"); put(10, "0.0"); put(20, "0.0"); put(30, "0.0");
    put(9, "$EXTMIN"); put(10, fmt(x0)); put(20, fmt(y0)); put(30, "0.0");
    put(9, "$EXTMAX"); put(10, fmt(x1)); put(20, fmt(y1)); put(30, "0.0");
    put(9, "$LIMMIN"); put(10, fmt(x0)); put(20, fmt(y0));
    put(9, "$LIMMAX"); put(10, fmt(x1)); put(20, fmt(y1));
    put(9, "$LTSCALE"); put(40, "1.0");
    put(9, "$LUNITS"); put(70, 2);
    put(9, "$LUPREC"); put(70, 4);
    put(0, "ENDSEC");
    put(0, "SECTION"); put(2, "TABLES");
    put(0, "TABLE"); put(2, "LTYPE"); put(70, Object.keys(LTYPES).length);
    for (const [name, lt] of Object.entries(LTYPES)) {
      put(0, "LTYPE"); put(2, name); put(70, 0); put(3, lt.text); put(72, 65); put(73, lt.pattern.length);
      put(40, fmt(lt.pattern.reduce((s, d) => s + Math.abs(d), 0)));
      for (const d of lt.pattern) put(49, fmt(d));
    }
    put(0, "ENDTAB");
    put(0, "TABLE"); put(2, "LAYER"); put(70, this.layers.size);
    for (const l of this.layers.values()) { put(0, "LAYER"); put(2, l.name); put(70, 0); put(62, l.color); put(6, l.linetype); }
    put(0, "ENDTAB");
    put(0, "TABLE"); put(2, "STYLE"); put(70, 1);
    put(0, "STYLE"); put(2, "STANDARD"); put(70, 0); put(40, "0.0"); put(41, "1.0"); put(50, "0.0"); put(71, 0); put(42, "2.5"); put(3, "txt"); put(4, "");
    put(0, "ENDTAB");
    put(0, "ENDSEC");
    put(0, "SECTION"); put(2, "ENTITIES");
    for (const ent of this.entities) for (const [code, value] of ent) put(code, value);
    put(0, "ENDSEC");
    put(0, "EOF");
    return out.join(EOL) + EOL;
  }
}

/* ---------- views of a part ---------- */

function bounds(view, keys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of keys) for (const seg of (view && view[k]) || []) for (const p of seg.pts || []) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return Number.isFinite(x0) ? { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 } : null;
}

/** Write the segments of a hidden-line view: full circles as CIRCLE, the rest as LINE / POLYLINE. */
function drawSegments(doc, list, layer, dx = 0, dy = 0) {
  for (const seg of list || []) {
    const c = seg.circle;
    if (c && c.full && c.r > 0) { doc.circle(c.c[0] + dx, c.c[1] + dy, c.r, layer); continue; }
    const pts = (seg.pts || []).map((p) => [p[0] + dx, p[1] + dy]);
    if (pts.length < 2) continue;
    const closed = pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9;
    doc.polyline(closed ? pts.slice(0, -1) : pts, layer, closed);
  }
}

/**
 * Orthographic views of a part laid out as on its drawing, third-angle projection: front view at the origin, top view
 * above it, right view beside it, at 1:1 in millimetres.
 * @param views {front, top, right} as returned by the kernel's hidden-line projection: {visible, hidden, smooth} lists
 *              of {pts: [[x, y], ...], circle?: {c, r, full}}.
 * @param opts  {gap: space between views (20 mm), hidden: false leaves the hidden edges out, smooth: false leaves the
 *              tangent edges out, title: text line under the front view, textHeight (3.5 mm)}.
 * Layers: VISIBLE (colour 7, continuous), HIDDEN (colour 8, linetype HIDDEN), THIN (colour 9, tangent edges), TEXT.
 */
export function viewsToDxf(views, opts = {}) {
  const gap = opts.gap ?? 20, keys = ["visible", "hidden", "smooth"];
  const doc = new DxfDoc({ comment: `DynamiteOrbit.ai - ${opts.title || "part views"} - third-angle projection, 1:1, units: millimetres` });
  doc.layer("VISIBLE", 7, "CONTINUOUS"); doc.layer("HIDDEN", 8, "HIDDEN"); doc.layer("THIN", 9, "CONTINUOUS");
  const v = views || {}, B = { front: bounds(v.front, keys), top: bounds(v.top, keys), right: bounds(v.right, keys) };
  if (!B.front && !B.top && !B.right) throw new Error("DXF : aucune vue à exporter (vues « front », « top », « right » vides).");
  const f = B.front || { x0: 0, y0: 0, w: 0, h: 0 };
  // the top view shares the horizontal axis of the front view (model X), the right view its vertical axis (model Z)
  const place = {
    front: B.front && [-B.front.x0, -B.front.y0],
    top: B.top && [B.front ? -f.x0 : -B.top.x0, (B.front ? f.h + gap : 0) - B.top.y0],
    right: B.right && [(B.front ? f.w + gap : 0) - B.right.x0, B.front ? -f.y0 : -B.right.y0],
  };
  for (const name of ["front", "top", "right"]) {
    const at = place[name];
    if (!at) continue;
    if (opts.hidden !== false) drawSegments(doc, v[name].hidden, "HIDDEN", at[0], at[1]);
    if (opts.smooth !== false) drawSegments(doc, v[name].smooth, "THIN", at[0], at[1]);
    drawSegments(doc, v[name].visible, "VISIBLE", at[0], at[1]);
  }
  if (opts.title) { const h = opts.textHeight ?? 3.5; doc.layer("TEXT", 7, "CONTINUOUS"); doc.text(0, -Math.max(8, gap / 2) - h, h, opts.title, "TEXT"); }
  return doc.toString();
}

/* ---------- profiles ---------- */

const RAD = 180 / Math.PI;
function drawLoop(doc, loop, layer, dx, dy) {
  const arcs = loop.filter((s) => s.t === "A"), c0 = arcs.length && arcs[0].c, r0 = arcs.length && arcs[0].r;
  const sweep = (s) => { const a0 = Math.atan2(s.a[1] - s.c[1], s.a[0] - s.c[0]), a1 = Math.atan2(s.b[1] - s.c[1], s.b[0] - s.c[0]); let d = s.ccw ? a1 - a0 : a0 - a1; while (d <= 1e-12) d += 2 * Math.PI; return d; };
  if (arcs.length === loop.length && arcs.length && arcs.every((s) => Math.hypot(s.c[0] - c0[0], s.c[1] - c0[1]) < 1e-9 && Math.abs(s.r - r0) < 1e-9)
    && Math.abs(arcs.reduce((t, s) => t + sweep(s), 0) - 2 * Math.PI) < 1e-6) { doc.circle(c0[0] + dx, c0[1] + dy, r0, layer); return; }
  for (const s of loop) {
    if (s.t === "L") { doc.line(s.a[0] + dx, s.a[1] + dy, s.b[0] + dx, s.b[1] + dy, layer); continue; }
    const from = s.ccw ? s.a : s.b, to = s.ccw ? s.b : s.a;                 // DXF arcs always turn counter-clockwise
    doc.arc(s.c[0] + dx, s.c[1] + dy, s.r, Math.atan2(from[1] - s.c[1], from[0] - s.c[0]) * RAD, Math.atan2(to[1] - s.c[1], to[0] - s.c[0]) * RAD, layer);
  }
}

/**
 * A 2D profile (outer loop + holes) at 1:1, for laser / waterjet cutting and for extrusion dies: straight segments as
 * LINE, arc segments as true ARC, whole circles as CIRCLE, all on one layer.
 * @param profile a normalised profile {outer, holes} (see cad/profile.js) or any profile definition of the part language
 *                with numeric values ({rect, r}, {circle}, {slot}, {poly}, {path}, {gen...}, {outer, holes}).
 * @param opts    {layer: "PROFILE", color: 7, offset: [dx, dy], title: text line under the profile, textHeight}
 */
export function profileToDxf(profile, opts = {}) {
  const p = normalizeProfile(profile), [dx, dy] = opts.offset || [0, 0];
  const doc = new DxfDoc({ comment: `DynamiteOrbit.ai - ${opts.title || "profile"} - 1:1, units: millimetres` });
  const layer = doc.layer(opts.layer || "PROFILE", opts.color ?? 7, "CONTINUOUS");
  for (const loop of [p.outer, ...p.holes]) drawLoop(doc, loop, layer, dx, dy);
  if (opts.title) { const h = opts.textHeight ?? 3.5, y = Number.isFinite(doc.ext[1]) ? doc.ext[1] : 0, x = Number.isFinite(doc.ext[0]) ? doc.ext[0] : 0; doc.layer("TEXT", 7, "CONTINUOUS"); doc.text(x, y - 5 - h, h, opts.title, "TEXT"); }
  return doc.toString();
}

/**
 * Flat outline of a plate or sheet part: the visible edges of the top view only, at 1:1 in MODEL coordinates (x = X,
 * y = Y of the part), on layer CUT. Full circles (holes) are CIRCLE entities, the rest LINE / POLYLINE.
 * @param built the built part (id, name and bbox are written in the file comment: the thickness is the Z size)
 * @param views {top} from the kernel's hidden-line projection
 */
export function flatOutlineDxf(built, views) {
  const top = views && views.top;
  if (!top || !(top.visible || []).length) throw new Error("DXF : la vue de dessus (« top ») est vide, aucun contour à plat à exporter.");
  const bb = (built && built.bbox) || [0, 0, 0, 0, 0, 0], label = built ? [built.id, built.name].filter(Boolean).join(" ") : "";
  const doc = new DxfDoc({ comment: `DynamiteOrbit.ai - flat outline${label ? " of " + label : ""} - thickness ${fmt(bb[5] - bb[2])} mm - 1:1, units: millimetres` });
  doc.layer("CUT", 1, "CONTINUOUS");
  drawSegments(doc, top.visible, "CUT");
  return doc.toString();
}

/* ---------- reading back (tests, quick checks) ---------- */

/**
 * Minimal DXF reader for what this module writes (and for simple R12 files).
 * @returns {version, sections: [names in file order], ltypes: [names], layers: [{name, color, linetype}],
 *           entities: [{type, layer, ...}], eof: true when the file ends with EOF}
 *   LINE {x1, y1, x2, y2} · CIRCLE {cx, cy, r} · ARC {cx, cy, r, a0, a1} · TEXT {x, y, height, text}
 *   POLYLINE {closed, points: [[x, y], ...]}
 */
export function parseDxf(text) {
  const lines = String(text).split(/\r?\n/), pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) throw new Error(`DXF illisible : code de groupe attendu ligne ${i + 1}, reçu « ${lines[i]} ».`);
    pairs.push([code, lines[i + 1]]);
  }
  const res = { version: null, sections: [], ltypes: [], layers: [], entities: [], eof: false };
  let section = null, table = null, record = null, ent = null, poly = null, expectSection = false, expectTable = false, headerVar = null;
  const num = (v) => parseFloat(v);
  const flush = () => {
    if (!ent) return;
    if (ent.type === "VERTEX") { if (poly) poly.points.push([ent.x, ent.y]); }
    else if (ent.type === "SEQEND") { if (poly) res.entities.push(poly); poly = null; }
    else if (ent.type === "POLYLINE") poly = { type: "POLYLINE", layer: ent.layer, closed: !!(ent.flags & 1), points: [] };
    else { delete ent.flags; res.entities.push(ent); }
    ent = null;
  };
  for (const [code, raw] of pairs) {
    const value = raw.trim();
    if (code === 999) continue;
    if (code === 0) {
      flush(); record = null;
      if (value === "SECTION") { expectSection = true; continue; }
      if (value === "ENDSEC") { section = null; table = null; continue; }
      if (value === "EOF") { res.eof = true; break; }
      if (section === "TABLES") {
        if (value === "TABLE") { expectTable = true; continue; }
        if (value === "ENDTAB") { table = null; continue; }
        if (value === "LAYER" && table === "LAYER") { record = { name: "", color: 7, linetype: "CONTINUOUS" }; res.layers.push(record); }
        else if (value === "LTYPE" && table === "LTYPE") record = { ltype: true };
        continue;
      }
      if (section === "ENTITIES") ent = { type: value, layer: undefined };
      continue;
    }
    if (expectSection && code === 2) { section = value; res.sections.push(value); expectSection = false; continue; }
    if (expectTable && code === 2) { table = value; expectTable = false; continue; }
    if (section === "HEADER") { if (code === 9) headerVar = value; else if (headerVar === "$ACADVER" && code === 1) res.version = value; continue; }
    if (record) {
      if (record.ltype) { if (code === 2) res.ltypes.push(value); continue; }
      if (code === 2) record.name = value; else if (code === 62) record.color = parseInt(value, 10); else if (code === 6) record.linetype = value;
      continue;
    }
    if (!ent) continue;
    if (code === 8) ent.layer = value;
    else if (code === 70) ent.flags = parseInt(value, 10);
    else if (ent.type === "LINE") { if (code === 10) ent.x1 = num(value); else if (code === 20) ent.y1 = num(value); else if (code === 11) ent.x2 = num(value); else if (code === 21) ent.y2 = num(value); }
    else if (ent.type === "CIRCLE" || ent.type === "ARC") {
      if (code === 10) ent.cx = num(value); else if (code === 20) ent.cy = num(value); else if (code === 40) ent.r = num(value);
      else if (code === 50) ent.a0 = num(value); else if (code === 51) ent.a1 = num(value);
    } else if (ent.type === "TEXT") { if (code === 10) ent.x = num(value); else if (code === 20) ent.y = num(value); else if (code === 40) ent.height = num(value); else if (code === 1) ent.text = raw; }
    else if (code === 10) ent.x = num(value);
    else if (code === 20) ent.y = num(value);
  }
  flush();
  return res;
}
