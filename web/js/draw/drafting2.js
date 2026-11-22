/* DesignOrbit.ai — drafting helpers, part 2: shared constants and small utilities, GD&T (vector symbols,
   feature control frame, datum feature) and the surface-finish symbol.
   Everything here is built ONLY on the Sheet primitives, so it renders identically on the PDF and SVG
   backends. Units: mm, y down. Re-exported by drafting.js. */

/** Landscape paper sizes [width, height] in mm. */
export const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420], TABLOID: [431.8, 279.4] };      // TABLOID : 11 × 17 in (ANSI B), landscape

/** Line widths (mm), ISO 128 series. */
export const LW = { frame: 0.7, visible: 0.5, medium: 0.35, thin: 0.25, fine: 0.18 };

/** Ready-made line styles for drawing views. */
export const STYLE = {
  visible: { w: LW.visible },
  hidden: { w: LW.thin, dash: "hidden" },
  center: { w: LW.fine, dash: "center" },
  phantom: { w: LW.fine, dash: "phantom" },
  thin: { w: LW.fine },
  hatch: { w: 0.13 },
};

/** Lettering heights (font size in mm). */
export const TEXT_H = 3.5;
export const TEXT_SMALL = 2.5;

/** Arrowhead: 3 mm long, 15° half-angle, filled. */
export const ARROW_LEN = 3;
export const ARROW_HALF_ANGLE = 15;

export const GREY = "#555555";

const RAD = Math.PI / 180;

/** Number → drawing text: at most `decimals` decimals, trailing zeros removed ("12.5", "40"). */
export function fmtNum(v, decimals = 2) {
  const s = Number(v).toFixed(decimals);
  const t = s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  return t === "-0" ? "0" : t;
}

/** Filled arrowhead with its tip at `tip`, pointing in direction `angleDeg` (0 = +x, positive toward +y). */
export function arrowHead(sheet, tip, angleDeg, { len = ARROW_LEN, half = ARROW_HALF_ANGLE, color = "#000" } = {}) {
  const a = angleDeg * RAD, ux = Math.cos(a), uy = Math.sin(a);
  const hw = len * Math.tan(half * RAD);
  const bx = tip[0] - ux * len, by = tip[1] - uy * len;
  sheet.polyline([[tip[0], tip[1]], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]],
    { close: true, fill: color, w: 0 });
  return sheet;
}

/** Shrinks (down to `minScale`) then truncates with '…' so that `str` fits in `maxW`. → { str, size } */
export function fitText(sheet, str, maxW, size = TEXT_H, font = "sans", minScale = 0.6) {
  let s = String(str ?? "");
  const w = sheet.textWidth(s, { size, font });
  if (w <= maxW || !s) return { str: s, size };
  const scaled = Math.max(size * minScale, (size * maxW) / w);
  if (sheet.textWidth(s, { size: scaled, font }) <= maxW + 1e-6) return { str: s, size: scaled };
  while (s.length > 1 && sheet.textWidth(`${s}…`, { size: scaled, font }) > maxW) s = s.slice(0, -1);
  return { str: `${s}…`, size: scaled };
}

/* ---- GD&T vector symbols ------------------------------------------------------------------------------- */

/** Names accepted by gdtSymbol(). */
export const GDT_SYMBOLS = [
  "position", "flatness", "perpendicularity", "parallelism", "angularity", "concentricity", "symmetry",
  "circularity", "cylindricity", "profile_line", "profile_surface", "runout", "total_runout", "straightness",
  "diameter", "mmc", "lmc", "counterbore", "countersink", "depth",
];

/** Draws the GD&T symbol `name` with vector strokes inside the square box of side `h` whose top-left corner
    is (x, y). Returns the box width (= h). Unknown names draw a '?'. */
export function gdtSymbol(sheet, name, x, y, h, { color = "#000", w } = {}) {
  const st = { w: w ?? Math.max(0.18, h * 0.05), color };
  const X = (u) => x + u * h, Y = (v) => y + v * h;
  const L = (u1, v1, u2, v2) => sheet.line(X(u1), Y(v1), X(u2), Y(v2), st);
  const P = (pts, extra) => sheet.polyline(pts.map(([u, v]) => [X(u), Y(v)]), { ...st, ...extra });
  const C = (u, v, r) => sheet.circle(X(u), Y(v), r * h, st);
  // Arrowhead (in box units) at (u, v) pointing along `deg`.
  const A = (u, v, deg) => arrowHead(sheet, [X(u), Y(v)], deg, { len: 0.3 * h, half: 17, color });
  switch (name) {
    case "position":
      C(0.5, 0.5, 0.24); L(0.1, 0.5, 0.9, 0.5); L(0.5, 0.1, 0.5, 0.9); break;
    case "flatness":
      P([[0.1, 0.68], [0.66, 0.68], [0.9, 0.32], [0.34, 0.32]], { close: true }); break;
    case "perpendicularity":
      L(0.14, 0.76, 0.86, 0.76); L(0.5, 0.76, 0.5, 0.2); break;
    case "parallelism":
      L(0.2, 0.8, 0.5, 0.2); L(0.5, 0.8, 0.8, 0.2); break;
    case "angularity":
      P([[0.86, 0.76], [0.12, 0.76], [0.8, 0.28]]); break;
    case "concentricity":
      C(0.5, 0.5, 0.32); C(0.5, 0.5, 0.16); break;
    case "symmetry":
      L(0.12, 0.5, 0.88, 0.5); L(0.27, 0.32, 0.73, 0.32); L(0.27, 0.68, 0.73, 0.68); break;
    case "circularity":
      C(0.5, 0.5, 0.3); break;
    case "cylindricity": {
      // Circle between two parallel tangents inclined at 60°.
      const r = 0.2, dx = Math.cos(60 * RAD), dy = -Math.sin(60 * RAD), nx = -dy, ny = dx, k = 0.38;
      C(0.5, 0.5, r);
      for (const s of [-1, 1]) {
        const cx = 0.5 + s * r * nx, cy = 0.5 + s * r * ny;
        L(cx - dx * k, cy - dy * k, cx + dx * k, cy + dy * k);
      }
      break;
    }
    case "profile_line":
      sheet.arc(X(0.5), Y(0.68), 0.36 * h, 180, 360, st); break;
    case "profile_surface":
      sheet.arc(X(0.5), Y(0.68), 0.36 * h, 180, 360, { ...st, close: true }); break;
    case "runout":
      L(0.22, 0.78, 0.66, 0.34); A(0.8, 0.2, -45); break;
    case "total_runout":
      L(0.12, 0.8, 0.52, 0.8);
      L(0.12, 0.8, 0.4, 0.4); A(0.5, 0.26, -55);
      L(0.52, 0.8, 0.8, 0.4); A(0.9, 0.26, -55); break;
    case "straightness":
      L(0.12, 0.5, 0.88, 0.5); break;
    case "diameter":
      C(0.5, 0.5, 0.27); L(0.27, 0.88, 0.73, 0.12); break;
    case "mmc":
      C(0.5, 0.5, 0.38); P([[0.32, 0.69], [0.32, 0.31], [0.5, 0.56], [0.68, 0.31], [0.68, 0.69]]); break;
    case "lmc":
      C(0.5, 0.5, 0.38); P([[0.39, 0.3], [0.39, 0.69], [0.64, 0.69]]); break;
    case "counterbore":
      P([[0.2, 0.25], [0.2, 0.75], [0.8, 0.75], [0.8, 0.25]]); break;
    case "countersink":
      P([[0.14, 0.26], [0.5, 0.76], [0.86, 0.26]]); break;
    case "depth":
      L(0.22, 0.2, 0.78, 0.2); L(0.5, 0.2, 0.5, 0.6); A(0.5, 0.84, 90); break;
    default:
      sheet.text(X(0.5), Y(0.5), "?", { size: h * 0.6, align: "center", baseline: "middle", color });
  }
  return h;
}

/* ---- feature control frame ----------------------------------------------------------------------------- */

/** ISO 1101 / ASME Y14.5 feature control frame with its top-left corner at (x, y).
    spec: { symbol, tolerance: '0.2', diameter: bool, modifier: 'mmc'|'lmc'|null, datums: ['A', 'B', ...] }
    (a datum may also be { letter: 'A', modifier: 'mmc' }).
    opts: { h: frame height (default 7, text height = h / 2), color, leaderTo: [x, y] optional leader with
    an arrow from the nearest frame end to that point }. Returns { width, height }. */
/** The width of a feature control frame, without drawing it (the same cells as featureControlFrame). */
export function fcfWidth(sheet, spec = {}, h = 2 * TEXT_H) {
  const size = h / 2, pad = h * 0.22, glyph = size * 1.45, gap = size * 0.18, cell = (label, mod) => Math.max(h, pad + sheet.textWidth(label, { size }) + (mod ? gap + glyph : 0) + pad);
  return h + cell(`${spec.diameter ? "Ø" : ""}${spec.tolerance ?? ""}`, spec.modifier) + (spec.datums || []).reduce((w, d) => { const x = typeof d === "string" ? { letter: d } : d || {}; return w + cell(String(x.letter ?? ""), x.modifier); }, 0);
}
export function featureControlFrame(sheet, x, y, spec = {}, opts = {}) {
  const h = opts.h ?? 2 * TEXT_H, color = opts.color ?? "#000";
  const size = h / 2, pad = h * 0.22, glyph = size * 1.45, gap = size * 0.18;
  const st = { w: LW.thin, color };
  const tw = (s) => sheet.textWidth(s, { size });

  // Compartments: [symbol] [Ø tol (M)] [datum]...
  const cells = [{ w: h, draw: (cx) => gdtSymbol(sheet, spec.symbol, cx, y, h, { color }) }];
  const inline = (label, modifier) => {
    const lw = tw(label), w = pad + lw + (modifier ? gap + glyph : 0) + pad;
    return {
      w: Math.max(h, w),
      draw: (cx, cw) => {
        const x0 = cx + (cw - (w - 2 * pad)) / 2;
        sheet.text(x0, y + h / 2, label, { size, baseline: "middle", color });
        if (modifier) gdtSymbol(sheet, modifier, x0 + lw + gap, y + (h - glyph) / 2, glyph, { color });
      },
    };
  };
  cells.push(inline(`${spec.diameter ? "Ø" : ""}${spec.tolerance ?? ""}`, spec.modifier));
  for (const d of spec.datums || []) {
    const datum = typeof d === "string" ? { letter: d } : d || {};
    cells.push(inline(String(datum.letter ?? ""), datum.modifier));
  }

  let cx = x;
  for (const cell of cells) {
    if (cx > x) sheet.line(cx, y, cx, y + h, st);
    cell.draw(cx, cell.w);
    cx += cell.w;
  }
  const width = cx - x;
  sheet.rect(x, y, width, h, st);

  if (opts.leaderTo) {
    // Short horizontal stub from the nearest end of the frame, then straight to the target.
    const [tx, ty] = opts.leaderTo, fromLeft = opts.side ? opts.side === "left" : Math.abs(tx - x) <= Math.abs(tx - (x + width));
    const sx = fromLeft ? x : x + width, ex = sx + (fromLeft ? -4 : 4), my = y + h / 2;
    sheet.polyline([[sx, my], [ex, my], [tx, ty]], { w: LW.fine, color });
    arrowHead(sheet, [tx, ty], Math.atan2(ty - my, tx - ex) / RAD, { color });
  }
  return { width, height: h };
}

/* ---- datum feature ------------------------------------------------------------------------------------- */

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Datum feature symbol: filled triangle with its base on the surface at (x, y), a short stem and a boxed
    letter. `dir` is the side on which the symbol stands, away from the material ('up'|'down'|'left'|'right').
    opts: { dir = 'down', size = 3.5, stem = 4, color }. Returns the letter box { x, y, w, h }. */
export function datumFeature(sheet, x, y, letter, { dir = "down", size = TEXT_H, stem = 4, color = "#000" } = {}) {
  const [dx, dy] = DIRS[dir] || DIRS.down;
  const th = size, hb = th * Math.tan(30 * RAD), box = 2 * size; // equilateral triangle, height = text height
  sheet.polyline([[x - dy * hb, y + dx * hb], [x + dy * hb, y - dx * hb], [x + dx * th, y + dy * th]],
    { close: true, fill: color, w: 0 });
  sheet.line(x + dx * th, y + dy * th, x + dx * (th + stem), y + dy * (th + stem), { w: LW.thin, color });
  const cx = x + dx * (th + stem + box / 2), cy = y + dy * (th + stem + box / 2);
  sheet.rect(cx - box / 2, cy - box / 2, box, box, { w: LW.thin, color });
  sheet.text(cx, cy, String(letter), { size, align: "center", baseline: "middle", color });
  return { x: cx - box / 2, y: cy - box / 2, w: box, h: box };
}

/* ---- surface finish ------------------------------------------------------------------------------------ */

/** ISO 1302 surface-texture symbol (material removal required) with its tip on the surface at (x, y).
    `ra` is a number (→ 'Ra 1.6') or a ready-made string ('Rz 6.3').
    opts: { size = 2.5 (text height), angle = 0 (rotation about the tip: 0 = standing on a horizontal
    surface with the material below, positive clockwise), color }. */
export function surfaceFinish(sheet, x, y, ra, { size = TEXT_SMALL, angle = 0, color = "#000" } = {}) {
  const st = { w: LW.thin, color };
  const c = Math.cos(angle * RAD), s = Math.sin(angle * RAD);
  const pt = (u, v) => [x + u * c - v * s, y + u * s + v * c]; // local frame: u right, v down
  const h1 = 1.4 * size, h2 = 3 * size, k = 1 / Math.tan(60 * RAD);
  const label = typeof ra === "number" ? `Ra ${fmtNum(ra)}` : String(ra ?? "");
  const tw = sheet.textWidth(label, { size });
  // Check mark (short left leg, long right leg at 60°), closed by the "machining required" bar.
  sheet.polyline([pt(-h1 * k, -h1), pt(0, 0), pt(h2 * k, -h2), pt(h2 * k + (label ? tw + 2 : 3), -h2)], st);
  sheet.line(...pt(-h1 * k, -h1), ...pt(h1 * k, -h1), st);
  if (label) {
    const [tx, ty] = pt(h2 * k + 1, -h2 + 0.8);
    sheet.text(tx, ty, label, { size, baseline: "top", angle, color });
  }
  return sheet;
}
