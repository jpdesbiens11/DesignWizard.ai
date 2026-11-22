/* DesignOrbit.ai — 2D measurements of a normalised profile, used by the extrusion DFM rules and the profile preview:
   wall thickness (ray cast inward from the boundary), air gaps and tongue ratio (ray cast outward), circumscribing
   circle diameter (CCD), convex hull. Pure geometry, no kernel. */

import { flattenLoop, polyArea, profileArea, profilePerimeter, profileBBox } from "./profile.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(sub(lower[lower.length - 1], lower[lower.length - 2]), sub(p, lower[lower.length - 1])) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(sub(upper[upper.length - 1], upper[upper.length - 2]), sub(p, upper[upper.length - 1])) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Smallest enclosing circle (incremental algorithm). */
export function enclosingCircle(points) {
  const P = points.slice();
  for (let i = P.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [P[i], P[j]] = [P[j], P[i]]; }   // deterministic shuffle
  const from2 = (a, b) => ({ c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r: dist(a, b) / 2 });
  const from3 = (a, b, c) => {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
    const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
    return { c: [ux, uy], r: dist([ux, uy], a) };
  };
  const inside = (ci, p) => ci && dist(ci.c, p) <= ci.r + 1e-9;
  let ci = null;
  for (let i = 0; i < P.length; i++) {
    if (inside(ci, P[i])) continue;
    ci = { c: P[i], r: 0 };
    for (let j = 0; j < i; j++) {
      if (inside(ci, P[j])) continue;
      ci = from2(P[i], P[j]);
      for (let k = 0; k < j; k++) { if (!inside(ci, P[k])) ci = from3(P[i], P[j], P[k]) || ci; }
    }
  }
  return ci || { c: [0, 0], r: 0 };
}

function raySeg(o, d, a, b) {   // ray o + t d against segment ab: returns t or Infinity
  const e = sub(b, a), den = cross(d, e);
  if (Math.abs(den) < 1e-12) return Infinity;
  const ao = sub(a, o), t = cross(ao, e) / den, s = cross(ao, d) / den;
  return t > 1e-7 && s >= -1e-9 && s <= 1 + 1e-9 ? t : Infinity;
}

function distToHull(p, hull) {
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], e = sub(b, a), l2 = e[0] * e[0] + e[1] * e[1];
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * e[0] + (p[1] - a[1]) * e[1]) / l2)) : 0;
    best = Math.min(best, dist(p, [a[0] + e[0] * t, a[1] + e[1] * t]));
  }
  return best;
}

/** Measurements of an extrusion cross-section. `step` = sampling pitch along the boundary (mm). */
export function profileMetrics(profile, step) {
  const bb = profileBBox(profile), size = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
  const pitch = step || Math.max(0.25, Math.min(1.0, size / 160));
  const loops = [profile.outer, ...profile.holes].map((lp) => flattenLoop(lp, 0.02));
  const segs = [];
  loops.forEach((pts, li) => pts.forEach((p, i) => segs.push({ a: p, b: pts[(i + 1) % pts.length], loop: li })));
  const hull = convexHull(loops[0]);
  const circle = enclosingCircle(hull);
  let wallMin = Infinity, wallMax = 0, wallAt = null, gapMin = Infinity, gapAt = null, tongue = 0, tongueAt = null;
  const walls = [];
  for (const s of segs) {
    const e = sub(s.b, s.a), L = Math.hypot(e[0], e[1]);
    if (L < 1e-6) continue;
    const dirv = [e[0] / L, e[1] / L], nIn = [-dirv[1], dirv[0]];       // material is on the left of every loop
    const n = Math.max(1, Math.round(L / pitch));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, p = [s.a[0] + e[0] * t, s.a[1] + e[1] * t];
      let tin = Infinity, tout = Infinity;
      for (const q of segs) {
        if (q === s) continue;
        tin = Math.min(tin, raySeg(p, nIn, q.a, q.b));
        tout = Math.min(tout, raySeg(p, [-nIn[0], -nIn[1]], q.a, q.b));
      }
      if (Number.isFinite(tin)) {
        walls.push(tin);
        if (tin < wallMin) { wallMin = tin; wallAt = p; }
        if (tin > wallMax) wallMax = tin;
      }
      if (Number.isFinite(tout) && s.loop === 0) {                     // an open gap of the outer contour facing itself
        if (tout < gapMin) { gapMin = tout; gapAt = p; }
        const depth = distToHull(p, hull), ratio = depth / tout;
        if (ratio > tongue) { tongue = ratio; tongueAt = p; }
      }
    }
  }
  walls.sort((a, b) => a - b);
  const median = walls.length ? walls[Math.floor(walls.length / 2)] : 0;
  const area = profileArea(profile);
  return { bbox: bb, width: bb[2] - bb[0], height: bb[3] - bb[1], area, perimeter: profilePerimeter(profile), hollows: profile.holes.length,
    ccd: circle.r * 2, ccdCenter: circle.c, wallMin: Number.isFinite(wallMin) ? wallMin : null, wallAt, wallMedian: median, wallMax,
    gapMin: Number.isFinite(gapMin) ? gapMin : null, gapAt, tongueRatio: tongue, tongueAt,
    hullArea: Math.abs(polyArea(hull)), rMin: minRadius(profile) };
}
function minRadius(profile) {
  let r = Infinity;
  for (const lp of [profile.outer, ...profile.holes]) for (const s of lp) if (s.t === "A") r = Math.min(r, s.r);
  return Number.isFinite(r) ? r : 0;
}
/** Number of sharp (unfilleted) corners of the profile, inside and outside the material. */
export function sharpCorners(profile) {
  let n = 0;
  for (const lp of [profile.outer, ...profile.holes]) {
    for (let i = 0; i < lp.length; i++) {
      const a = lp[i], b = lp[(i + 1) % lp.length];
      if (a.t === "L" && b.t === "L") {
        const u = sub(a.b, a.a), v = sub(b.b, b.a);
        const ang = Math.abs(Math.atan2(cross(u, v), u[0] * v[0] + u[1] * v[1]));
        if (ang > 0.26) n++;      // more than 15 degrees between two straight segments
      }
    }
  }
  return n;
}
