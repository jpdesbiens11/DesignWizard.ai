/* DynamiteOrbit.ai — drafting helpers (entry point): dimensions, leaders, centre lines, section arrows and
   view labels. Built ONLY on the Sheet primitives, so they work on both the PDF and the SVG backend.
   Conventions (ISO 128 / ISO 129): thin lines for dimensions, filled arrowheads 3 mm long, text 3.5 mm
   placed above the dimension line and readable from the bottom / right. Units: mm, y down; points are [x, y].
   The GD&T helpers (drafting2.js) and the sheet furniture (drafting3.js) are re-exported from here. */

import { LW, TEXT_H, ARROW_LEN, arrowHead, fmtNum } from "./drafting2.js";

export * from "./drafting2.js";
export * from "./drafting3.js";

const RAD = Math.PI / 180;
const TEXT_GAP = 0.8;   // clearance between a dimension line and its text
const EXT_GAP = 1;      // gap between the measured point and its extension line
const EXT_OVER = 2;     // overshoot of the extension line beyond the dimension line

/** Angle (deg) at which a text lying along direction (ux, uy) stays readable from the bottom / right. */
function readableAngle(ux, uy) {
  let a = Math.atan2(uy, ux) / RAD;
  if (a > 90 + 1e-6) a -= 180;
  if (a < -90 - 1e-6) a += 180;
  if (Math.abs(a - 90) < 1e-6) a = -90; // vertical text reads upward (seen from the right)
  return a;
}

/** Text centred at `p`, `gap` mm above the line passing through `p` at `angle` (in the text's own frame). */
function textAbove(sheet, p, angle, str, { size, color, gap = TEXT_GAP }) {
  const a = angle * RAD;
  sheet.text(p[0] + Math.sin(a) * gap, p[1] - Math.cos(a) * gap, str, { size, align: "center", angle, color });
}

/** Linear dimension between p1 and p2.
    opts: { offset = 10, dir = 'aligned', text, tol, size = 3.5, color }
      dir 'h': horizontal distance; the dimension line lies `offset` below the lowest point (offset < 0:
               above the highest point).
      dir 'v': vertical distance; the dimension line lies `offset` right of the rightmost point (offset < 0:
               left of the leftmost point).
      dir 'aligned': true distance, the line is parallel to p1→p2, `offset` to the right-hand side when
               travelling from p1 to p2 on screen (negative: left-hand side).
      text: overrides the measured value; tol: appended, e.g. '±0.1'.
    Arrows flip outside automatically when the span is too short; text that does not fit moves outside.
    Returns { value, text, x, y, angle } (text anchor). */
export function dimLinear(sheet, p1, p2, opts = {}) {
  const { offset = 10, dir = "aligned", tol, size = TEXT_H, color = "#000" } = opts;
  const thin = { w: LW.fine, color };
  let a, b; // ends of the dimension line
  if (dir === "h") {
    const y = (offset >= 0 ? Math.max(p1[1], p2[1]) : Math.min(p1[1], p2[1])) + offset;
    a = [p1[0], y]; b = [p2[0], y];
  } else if (dir === "v") {
    const x = (offset >= 0 ? Math.max(p1[0], p2[0]) : Math.min(p1[0], p2[0])) + offset;
    a = [x, p1[1]]; b = [x, p2[1]];
  } else {
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    a = [p1[0] + nx * offset, p1[1] + ny * offset]; b = [p2[0] + nx * offset, p2[1] + ny * offset];
  }
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = span ? (b[0] - a[0]) / span : 1, uy = span ? (b[1] - a[1]) / span : 0;

  // Extension lines, from just off the measured point to a little beyond the dimension line.
  for (const [p, q] of [[p1, a], [p2, b]]) {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d <= EXT_GAP) continue;
    const ex = (q[0] - p[0]) / d, ey = (q[1] - p[1]) / d;
    sheet.line(p[0] + ex * EXT_GAP, p[1] + ey * EXT_GAP, q[0] + ex * EXT_OVER, q[1] + ey * EXT_OVER, thin);
  }

  let label = opts.text ?? fmtNum(span);
  if (tol) label = `${label} ${tol}`;
  const tw = sheet.textWidth(label, { size });
  const inside = span >= 2 * ARROW_LEN + 2.5;        // room for two arrowheads between the extension lines
  const textFits = tw + 1.5 <= span;                 // the text sits above the line, so it may overlap the arrows
  const tail = inside ? 0 : ARROW_LEN + 2.5;         // outside arrows need a tail beyond each end
  const textOut = textFits ? 0 : tw + 2;             // text moved outside, beyond b
  const ang = Math.atan2(uy, ux) / RAD;
  sheet.line(a[0] - ux * tail, a[1] - uy * tail, b[0] + ux * (tail + textOut), b[1] + uy * (tail + textOut), thin);
  arrowHead(sheet, a, inside ? ang + 180 : ang, { color });
  arrowHead(sheet, b, inside ? ang : ang + 180, { color });

  const along = textFits ? span / 2 : span + tail + textOut / 2;
  const anchor = [a[0] + ux * along, a[1] + uy * along];
  const tAngle = readableAngle(ux, uy);
  textAbove(sheet, anchor, tAngle, label, { size, color });
  return { value: span, text: label, x: anchor[0], y: anchor[1], angle: tAngle };
}

/** Leader with a horizontal landing and the text above it. Returns the text anchor. */
function landing(sheet, from, dirX, label, { size, color }) {
  const tw = sheet.textWidth(label, { size });
  const end = [from[0] + dirX * (tw + 2), from[1]];
  sheet.line(from[0], from[1], end[0], end[1], { w: LW.fine, color });
  const mid = [(from[0] + end[0]) / 2, from[1]];
  textAbove(sheet, mid, 0, label, { size, color });
  return mid;
}

/** Diameter dimension of the circle (c, r).
    opts: { angle = -45 (direction of the leader from the centre, deg), text (default 'Ø<2r>', pass e.g.
    'Ø12 H7'), leader = true | false | length in mm (default 10), size = 3.5, color }
      leader true / number: leader outside the circle, its arrow touches the circle and points to the centre,
                            text on a horizontal landing.
      leader false: dimension line across the circle through the centre, two arrows, text above the line
                    (moved to an outside landing when the circle is too small).
    Returns { text, x, y }. */
export function dimDiameter(sheet, c, r, opts = {}) {
  const { angle = -45, leader = true, size = TEXT_H, color = "#000" } = opts;
  const label = opts.text ?? `Ø${fmtNum(2 * r)}`;
  const thin = { w: LW.fine, color };
  const ux = Math.cos(angle * RAD), uy = Math.sin(angle * RAD), dirX = ux >= 0 ? 1 : -1;
  const p = [c[0] + ux * r, c[1] + uy * r];
  const out = typeof leader === "number" ? leader : 10;
  const q = [c[0] + ux * (r + out), c[1] + uy * (r + out)];
  let at;
  if (leader === false) {
    const p0 = [c[0] - ux * r, c[1] - uy * r];
    const tw = sheet.textWidth(label, { size });
    const inside = 2 * r >= 2 * ARROW_LEN + 2.5, fits = tw + 1.5 <= 2 * r - (inside ? 2 * ARROW_LEN : 0);
    const tail = inside ? 0 : ARROW_LEN + 2.5;
    arrowHead(sheet, p, inside ? angle : angle + 180, { color });
    arrowHead(sheet, p0, inside ? angle + 180 : angle, { color });
    if (fits) {
      sheet.line(p0[0] - ux * tail, p0[1] - uy * tail, p[0] + ux * tail, p[1] + uy * tail, thin);
      at = [c[0], c[1]];
      textAbove(sheet, at, readableAngle(ux, uy), label, { size, color });
    } else {
      sheet.line(p0[0] - ux * tail, p0[1] - uy * tail, q[0], q[1], thin);
      at = landing(sheet, q, dirX, label, { size, color });
    }
  } else {
    sheet.line(p[0], p[1], q[0], q[1], thin);
    arrowHead(sheet, p, angle + 180, { color });
    at = landing(sheet, q, dirX, label, { size, color });
  }
  return { text: label, x: at[0], y: at[1] };
}

/** Radius dimension of the arc (c, r).
    opts: { angle = -45 (direction from the centre to the dimensioned point of the arc), text (default
    'R<r>'), leader = 8 (length outside the arc), inside (default: r >= 12), size = 3.5, color }
      inside true: line from the centre, arrow touching the arc from the inside, text on an outside landing.
      inside false: arrow touching the arc from the outside (small radii, fillets).
    Returns { text, x, y }. */
export function dimRadius(sheet, c, r, opts = {}) {
  const { angle = -45, leader = 8, size = TEXT_H, color = "#000" } = opts;
  const inside = opts.inside ?? r >= 12;
  const label = opts.text ?? `R${fmtNum(r)}`;
  const ux = Math.cos(angle * RAD), uy = Math.sin(angle * RAD);
  const p = [c[0] + ux * r, c[1] + uy * r];
  const q = [c[0] + ux * (r + leader), c[1] + uy * (r + leader)];
  const from = inside ? c : p;
  sheet.line(from[0], from[1], q[0], q[1], { w: LW.fine, color });
  arrowHead(sheet, p, inside ? angle : angle + 180, { color });
  const at = landing(sheet, q, ux >= 0 ? 1 : -1, label, { size, color });
  return { text: label, x: at[0], y: at[1] };
}

/** Leader note: arrow at `from`, straight line to the elbow `to`, short horizontal shoulder, then the text
    block (left-aligned when it runs to the right, right-aligned otherwise; first line level with the shoulder).
    lines: string or string[]. opts: { size = 3.5, end = 'arrow' | 'dot' | 'none', color }.
    Returns { x, y, width, height } of the text block. */
export function leaderNote(sheet, from, to, lines, { size = TEXT_H, end = "arrow", color = "#000" } = {}) {
  const list = (Array.isArray(lines) ? lines : [lines]).map((s) => String(s ?? ""));
  const dirX = to[0] >= from[0] ? 1 : -1, shoulder = 3, lineH = size * 1.45;
  sheet.polyline([[from[0], from[1]], [to[0], to[1]], [to[0] + dirX * shoulder, to[1]]], { w: LW.fine, color });
  if (end === "arrow") arrowHead(sheet, from, Math.atan2(from[1] - to[1], from[0] - to[0]) / RAD, { color });
  else if (end === "dot") sheet.circle(from[0], from[1], 0.6, { w: 0, fill: color });
  const tx = to[0] + dirX * (shoulder + 1);
  let width = 0;
  list.forEach((s, i) => {
    sheet.text(tx, to[1] + i * lineH, s, { size, align: dirX > 0 ? "left" : "right", baseline: "middle", color });
    width = Math.max(width, sheet.textWidth(s, { size }));
  });
  return { x: dirX > 0 ? tx : tx - width, y: to[1] - size / 2, width, height: (list.length - 1) * lineH + size };
}

/** Centre mark of a circle (c, r): small cross at the centre, a gap, then lines running `over` mm past the
    circle (solid thin cross for very small circles). opts: { over = 3, color }. */
export function centerMark(sheet, c, r, { over = 3, color = "#000" } = {}) {
  const st = { w: LW.fine, color };
  const ext = r + over, cross = Math.min(2.5, r * 0.35), gap = 1.2;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (r < 3 || cross + gap + 1.5 > ext) {
      sheet.line(c[0] - dx * ext, c[1] - dy * ext, c[0] + dx * ext, c[1] + dy * ext, st);
      continue;
    }
    sheet.line(c[0] - dx * cross, c[1] - dy * cross, c[0] + dx * cross, c[1] + dy * cross, st);
    for (const s of [-1, 1]) {
      sheet.line(c[0] + s * dx * (cross + gap), c[1] + s * dy * (cross + gap), c[0] + s * dx * ext, c[1] + s * dy * ext, st);
    }
  }
  return sheet;
}

/** Centre line (thin long-dash / short-dash) from p1 to p2. The long dashes are stretched slightly so the
    line starts and ends on a long dash; short lines are drawn solid. opts: { color }. */
export function centerLine(sheet, p1, p2, { color = "#000" } = {}) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const short = 1.5, gap = 1.5, rest = 2 * gap + short;   // one "gap, short dash, gap" group
  const n = Math.round((len - 8) / (8 + rest));           // number of groups for ~8 mm long dashes
  const long = n > 0 ? (len - n * rest) / (n + 1) : 0;
  const dash = n > 0 && long > 2 ? [long, gap, short, gap] : null;
  sheet.line(p1[0], p1[1], p2[0], p2[1], { w: LW.fine, color, dash });
  return sheet;
}

/** Cutting-plane indication from p1 to p2 (ISO 128): thin chain line with thick ends, an arrow at each end
    showing the viewing direction, and the section letter beside each arrow.
    The viewing direction is the right-hand side when travelling from p1 to p2 on screen; opts.flip reverses it.
    opts: { flip = false, size = 5 (letter height), arrowLen = 9, color }. */
export function sectionArrows(sheet, p1, p2, label, { flip = false, size = 5, arrowLen = 9, color = "#000" } = {}) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
  const ux = (p2[0] - p1[0]) / len, uy = (p2[1] - p1[1]) / len;
  const s = flip ? -1 : 1, nx = -uy * s, ny = ux * s;     // viewing direction
  const thick = Math.min(6, len / 4);
  centerLine(sheet, [p1[0] + ux * thick, p1[1] + uy * thick], [p2[0] - ux * thick, p2[1] - uy * thick], { color });
  sheet.line(p1[0], p1[1], p1[0] + ux * thick, p1[1] + uy * thick, { w: LW.frame, color });
  sheet.line(p2[0], p2[1], p2[0] - ux * thick, p2[1] - uy * thick, { w: LW.frame, color });
  const ang = Math.atan2(ny, nx) / RAD, head = 4.5;
  for (const p of [p1, p2]) {
    // The arrow tip touches the end of the cutting line; the shaft stands on the viewer's side.
    sheet.line(p[0] - nx * arrowLen, p[1] - ny * arrowLen, p[0] - nx * (head - 0.5), p[1] - ny * (head - 0.5), { w: LW.medium, color });
    arrowHead(sheet, p, ang, { len: head, color });
    if (label) {
      const d = arrowLen + size * 0.75;
      sheet.text(p[0] - nx * d, p[1] - ny * d, String(label), { size, font: "bold", align: "center", baseline: "middle", color });
    }
  }
  return sheet;
}

/** Section hatching: thin parallel lines clipped to the polygon `points` ([[x, y], ...], even-odd rule, so
    concave outlines work). The lines of all polygons hatched with the same spacing / angle are in phase.
    opts: { spacing = 2.5, angle = -45 (deg, sheet convention: negative rises to the right), w = 0.13, color }. */
export function hatchPolygon(sheet, points, { spacing = 2.5, angle = -45, w = 0.13, color = "#000" } = {}) {
  const c = Math.cos(angle * RAD), s = Math.sin(angle * RAD);
  // Rotate by -angle so that the hatch lines become horizontal scanlines v = const.
  const rot = points.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  const vs = rot.map((p) => p[1]);
  for (let v = Math.ceil(Math.min(...vs) / spacing) * spacing; v < Math.max(...vs); v += spacing) {
    const us = [];
    for (let i = 0; i < rot.length; i++) {
      const [u1, v1] = rot[i], [u2, v2] = rot[(i + 1) % rot.length];
      if ((v1 <= v && v2 > v) || (v2 <= v && v1 > v)) us.push(u1 + ((v - v1) / (v2 - v1)) * (u2 - u1));
    }
    us.sort((p, q) => p - q);
    for (let i = 0; i + 1 < us.length; i += 2) {
      sheet.line(us[i] * c - v * s, us[i] * s + v * c, us[i + 1] * c - v * s, us[i + 1] * s + v * c, { w, color });
    }
  }
  return sheet;
}

/** View label: bold `text` (e.g. 'COUPE A-A') centred on x with its top at y, underlined, and the optional
    `scaleText` (e.g. 'ÉCHELLE 2:1') below. opts: { size = 5, color }. Returns the total height. */
export function viewLabel(sheet, x, y, text, scaleText, { size = 5, color = "#000" } = {}) {
  const label = String(text ?? "");
  const tw = sheet.textWidth(label, { size, font: "bold" });
  sheet.text(x, y, label, { size, font: "bold", align: "center", baseline: "top", color });
  let height = size * 0.718 + 1.2;
  sheet.line(x - tw / 2, y + height, x + tw / 2, y + height, { w: LW.medium, color });
  if (scaleText) {
    sheet.text(x, y + height + 1.5, String(scaleText), { size: TEXT_H * 0.8, align: "center", baseline: "top", color });
    height += 1.5 + TEXT_H * 0.8 * 0.718;
  }
  return height;
}
