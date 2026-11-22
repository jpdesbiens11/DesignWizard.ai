/* DesignOrbit.ai — PCBA: plane geometry of copper. Every piece of copper is one of two shapes:
   a capsule { a: [x, y], b: [x, y], r } — a track segment, a via, a round or oval pad — or an axis-aligned
   rectangle { rect: [x0, y0, x1, y1] } — a rectangular pad. gap() gives the clear distance between two of them
   (zero or negative when they touch or overlap). */

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distance from point p to segment ab. */
export function ptSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (!l2) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** True when segments ab and cd cross or touch. */
export function segCross(a, b, c, d) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p, q, r) => Math.abs(cross(p, q, r)) < 1e-12 && Math.min(p[0], q[0]) - 1e-12 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-12 && Math.min(p[1], q[1]) - 1e-12 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-12;
  return on(c, d, a) || on(c, d, b) || on(a, b, c) || on(a, b, d);
}
/** Smallest distance between segments ab and cd (zero when they cross). */
export function segSeg(a, b, c, d) {
  return segCross(a, b, c, d) ? 0 : Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
}
const inRect = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
/** Smallest distance between segment ab and a rectangle (zero when it enters it). */
export function segRect(a, b, r) {
  if (inRect(a, r) || inRect(b, r)) return 0;
  const c = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  return Math.min(segSeg(a, b, c[0], c[1]), segSeg(a, b, c[1], c[2]), segSeg(a, b, c[2], c[3]), segSeg(a, b, c[3], c[0]));
}
/** Clear distance between two rectangles. */
export const rectRect = (p, q) => Math.hypot(Math.max(0, p[0] - q[2], q[0] - p[2]), Math.max(0, p[1] - q[3], q[1] - p[3]));

/** Copper shape of a resolved pad (model.js) : a rectangle, or a capsule for round and oval pads. */
export function padShape(p) {
  if ((p.shape || "rect") === "rect") return { rect: [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2] };
  const r = Math.min(p.w, p.h) / 2, e = Math.max(p.w, p.h) / 2 - r;
  return p.w >= p.h ? { a: [p.x - e, p.y], b: [p.x + e, p.y], r } : { a: [p.x, p.y - e], b: [p.x, p.y + e], r };
}
/** Copper shape of a via or of any disc. */
export const discShape = (x, y, d) => ({ a: [x, y], b: [x, y], r: d / 2 });
/** Copper shapes of a track : one capsule per segment. */
export function trackShapes(t) {
  const out = [];
  for (let i = 1; i < t.pts.length; i++) out.push({ a: t.pts[i - 1], b: t.pts[i], r: t.w / 2 });
  if (t.pts.length === 1) out.push({ a: t.pts[0], b: t.pts[0], r: t.w / 2 });
  return out;
}
/** Clear distance between two copper shapes ; ≤ 0 when they touch or overlap. */
export function gap(s, q) {
  if (s.rect && q.rect) return rectRect(s.rect, q.rect);
  if (s.rect) return segRect(q.a, q.b, s.rect) - q.r;
  if (q.rect) return segRect(s.a, s.b, q.rect) - s.r;
  return segSeg(s.a, s.b, q.a, q.b) - s.r - q.r;
}
/** Bounding box [x0, y0, x1, y1] of a copper shape. */
export function shapeBox(s) {
  return s.rect ? s.rect : [Math.min(s.a[0], s.b[0]) - s.r, Math.min(s.a[1], s.b[1]) - s.r, Math.max(s.a[0], s.b[0]) + s.r, Math.max(s.a[1], s.b[1]) + s.r];
}

/** True when point p is inside the closed polygon. */
export function inPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** Distance from point p to the edge of a closed polygon. */
export function polyEdge(p, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, ptSeg(p, poly[j], poly[i]));
  return best;
}
/** Distance from a copper shape to the edge of the board outline : negative when it sticks out. */
export function edgeGap(s, outline) {
  const pts = s.rect ? [[s.rect[0], s.rect[1]], [s.rect[2], s.rect[1]], [s.rect[2], s.rect[3]], [s.rect[0], s.rect[3]]] : [s.a, s.b], r = s.rect ? 0 : s.r;
  let best = Infinity;
  for (const p of pts) best = Math.min(best, inPoly(p, outline) ? polyEdge(p, outline) - r : -polyEdge(p, outline) - r);
  return best;
}
/** Signed area of a polygon (positive counter-clockwise). */
export function polyArea(poly) {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return s / 2;
}
