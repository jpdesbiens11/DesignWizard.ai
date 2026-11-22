/* DynamiteOrbit — 2D profiles of the part language (pure geometry, no kernel).
   A profile is {outer, holes[]} where each loop is given as one of:
     {rect:[x,y,w,h], r}            rectangle from its min corner, optional corner radius
     {circle:[cx,cy,d]}             circle by centre and DIAMETER
     {slot:[x1,y1,x2,y2,w]}         obround between two centres
     {poly:[[x,y],[x,y,r],...], r}  polygon; a vertex may carry its own fillet radius (3rd value), `r` is the default
     {path:"M0 0 L10 0 A5 5 0 0 1 ..Z"}   SVG path data (M L H V A C Q Z, absolute or relative), y up
   A bare loop is accepted as a profile without holes. Coordinates are already numbers (see expr.evalDeep).
   Normalised loop = array of segments {t:"L", a, b} or {t:"A", a, b, m, c, r, ccw}, closed, outer loops counter-clockwise. */

import { generateProfile } from "./profile_gen.js";

const EPS = 1e-7;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

export class ProfileError extends Error {}

function num(v, what) {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ProfileError(`Profil : ${what} doit être un nombre, reçu ${JSON.stringify(v)}.`);
  return v;
}

function arcSeg(a, b, c, ccw) {
  const r = dist(a, c);
  let a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  if (ccw) { while (a1 <= a0 + 1e-12) a1 += 2 * Math.PI; } else { while (a1 >= a0 - 1e-12) a1 -= 2 * Math.PI; }
  const am = (a0 + a1) / 2;
  return { t: "A", a, b, m: [c[0] + r * Math.cos(am), c[1] + r * Math.sin(am)], c, r, ccw, a0, a1 };
}
const lineSeg = (a, b) => ({ t: "L", a, b });

function loopRect([x, y, w, h], r = 0) {
  num(x, "rect x"); num(y, "rect y"); num(w, "rect w"); num(h, "rect h");
  if (w <= 0 || h <= 0) throw new ProfileError(`Profil : rect de taille nulle ou négative (${w} × ${h}).`);
  return loopPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Math.max(0, Math.min(r || 0, w / 2 - 1e-4, h / 2 - 1e-4)));
}

function loopCircle([cx, cy, d]) {
  num(cx, "circle cx"); num(cy, "circle cy"); num(d, "circle d");
  if (d <= 0) throw new ProfileError(`Profil : cercle de diamètre ${d}.`);
  const r = d / 2, c = [cx, cy], p0 = [cx + r, cy], p1 = [cx - r, cy];
  return [arcSeg(p0, p1, c, true), arcSeg(p1, p0, c, true)];
}

function loopSlot([x1, y1, x2, y2, w]) {
  [x1, y1, x2, y2, w].forEach((v) => num(v, "slot"));
  const r = w / 2, d = unit([x2 - x1, y2 - y1]), n = [-d[1], d[0]];
  if (dist([x1, y1], [x2, y2]) < EPS) return loopCircle([x1, y1, w]);
  const a = add([x1, y1], mul(n, -r)), b = add([x2, y2], mul(n, -r)), c = add([x2, y2], mul(n, r)), e = add([x1, y1], mul(n, r));
  return [lineSeg(a, b), arcSeg(b, c, [x2, y2], true), lineSeg(c, e), arcSeg(e, a, [x1, y1], true)];
}

/** Polygon with per-vertex fillets. Vertices: [x, y] | [x, y, r] | [x, y, {r}]. */
function loopPoly(points, defaultR = 0) {
  if (!Array.isArray(points) || points.length < 3) throw new ProfileError("Profil : un polygone demande au moins 3 points.");
  let pts = points.map((p, i) => {
    if (!Array.isArray(p) || p.length < 2) throw new ProfileError(`Profil : point ${i + 1} invalide (${JSON.stringify(p)}).`);
    const extra = p[2];
    const r = extra === undefined || extra === null ? defaultR : (typeof extra === "object" ? (extra.r ?? defaultR) : extra);
    return { p: [num(p[0], `point ${i + 1} x`), num(p[1], `point ${i + 1} y`)], r: Math.max(0, r || 0) };
  });
  pts = pts.filter((q, i) => dist(q.p, pts[(i + 1) % pts.length].p) > EPS);     // drop duplicate vertices
  if (pts.length < 3) throw new ProfileError("Profil : polygone dégénéré.");
  let area2 = 0;
  pts.forEach((q, i) => { area2 += cross(q.p, pts[(i + 1) % pts.length].p); });
  if (Math.abs(area2) < EPS) throw new ProfileError("Profil : polygone d'aire nulle.");
  if (area2 < 0) pts.reverse();
  const n = pts.length, cut = [];
  for (let i = 0; i < n; i++) {
    const P = pts[i].p, A = pts[(i + n - 1) % n].p, B = pts[(i + 1) % n].p;
    const u = unit(sub(A, P)), v = unit(sub(B, P));
    const cosT = Math.max(-1, Math.min(1, dot(u, v))), theta = Math.acos(cosT);
    let r = pts[i].r;
    if (r > EPS && theta > 1e-3 && Math.PI - theta > 1e-3) {
      let t = r / Math.tan(theta / 2);
      const tmax = 0.5 * Math.min(dist(A, P), dist(B, P)) - 1e-6;
      if (t > tmax) { t = Math.max(0, tmax); r = t * Math.tan(theta / 2); }
      if (r > 1e-4) {
        const p1 = add(P, mul(u, t)), p2 = add(P, mul(v, t));
        const bis = unit(add(u, v)), c = add(P, mul(bis, r / Math.sin(theta / 2)));
        cut.push({ p1, p2, c, ccw: cross(sub(P, A), sub(B, P)) > 0 });
        continue;
      }
    }
    cut.push({ p1: P, p2: P, c: null });
  }
  const segs = [];
  for (let i = 0; i < n; i++) {
    const cur = cut[i], nxt = cut[(i + 1) % n];
    if (cur.c) segs.push(arcSeg(cur.p1, cur.p2, cur.c, cur.ccw));
    if (dist(cur.p2, nxt.p1) > EPS) segs.push(lineSeg(cur.p2, nxt.p1));
  }
  return segs;
}

/* ---------- SVG path data ---------- */
function loopsFromPath(d, flipY = false) {
  const toks = String(d).match(/[MmLlHhVvAaCcQqSsTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  let i = 0, cmd = "", cur = [0, 0], start = [0, 0], lastCtl = null;
  const loops = []; let segs = [];
  const nx = () => { if (i >= toks.length || /[A-Za-z]/.test(toks[i])) throw new ProfileError(`Profil : nombre manquant après « ${cmd} » dans le path.`); return parseFloat(toks[i++]); };
  const pt = (rel) => { const x = nx(), y = nx(); return rel ? [cur[0] + x, cur[1] + y] : [x, y]; };
  const lineTo = (p) => { if (dist(cur, p) > EPS) segs.push(lineSeg(cur, p)); cur = p; };
  const bez = (p0, p1, p2, p3) => { const N = 16; for (let k = 1; k <= N; k++) { const t = k / N, m = 1 - t;
    lineTo([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]); } };
  const close = () => { if (segs.length) { if (dist(cur, start) > EPS) segs.push(lineSeg(cur, start)); loops.push(segs); } segs = []; cur = start; };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    else if (cmd === "M") cmd = "L"; else if (cmd === "m") cmd = "l";
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === "M") { if (segs.length) close(); cur = pt(rel); start = cur; lastCtl = null; }
    else if (C === "L") { lineTo(pt(rel)); lastCtl = null; }
    else if (C === "H") { const x = nx(); lineTo([rel ? cur[0] + x : x, cur[1]]); lastCtl = null; }
    else if (C === "V") { const y = nx(); lineTo([cur[0], rel ? cur[1] + y : y]); lastCtl = null; }
    else if (C === "Z") { close(); lastCtl = null; }
    else if (C === "C") { const p1 = pt(rel), p2 = pt(rel), p3 = pt(rel); bez(cur, p1, p2, p3); lastCtl = p2; }
    else if (C === "S") { const p1 = lastCtl ? sub(mul(cur, 2), lastCtl) : cur, p2 = pt(rel), p3 = pt(rel); bez(cur, p1, p2, p3); lastCtl = p2; }
    else if (C === "Q") { const q = pt(rel), p3 = pt(rel); bez(cur, add(cur, mul(sub(q, cur), 2 / 3)), add(p3, mul(sub(q, p3), 2 / 3)), p3); lastCtl = q; }
    else if (C === "T") { const q = lastCtl ? sub(mul(cur, 2), lastCtl) : cur, p3 = pt(rel); bez(cur, add(cur, mul(sub(q, cur), 2 / 3)), add(p3, mul(sub(q, p3), 2 / 3)), p3); lastCtl = q; }
    else if (C === "A") {
      let rx = Math.abs(nx()), ry = Math.abs(nx()); nx(); const large = nx() !== 0; let sweep = nx() !== 0; const p = pt(rel);
      if (flipY) sweep = !sweep;
      if (dist(cur, p) < EPS) continue;
      if (rx < EPS || ry < EPS) { lineTo(p); continue; }
      let r = (rx + ry) / 2; const h = dist(cur, p) / 2;      // rx != ry is treated as a circular arc of the mean radius
      if (r < h) r = h;
      const mid = mul(add(cur, p), 0.5), dch = unit(sub(p, cur)), nrm = [-dch[1], dch[0]], off = Math.sqrt(Math.max(0, r * r - h * h));
      const c = add(mid, mul(nrm, (large !== sweep ? 1 : -1) * off));
      segs.push(arcSeg(cur, p, c, sweep)); cur = p; lastCtl = null;
    } else throw new ProfileError(`Profil : commande de path non reconnue « ${cmd} ».`);
  }
  if (segs.length) close();
  if (flipY) for (const lp of loops) for (const s of lp) { for (const k of ["a", "b", "m", "c"]) if (s[k]) s[k] = [s[k][0], -s[k][1]]; if (s.t === "A") Object.assign(s, arcSeg(s.a, s.b, s.c, s.ccw)); }
  return loops;
}

/* ---------- loop utilities ---------- */
export function flattenLoop(loop, tol = 0.05) {
  const pts = [];
  for (const s of loop) {
    if (s.t === "L") { pts.push(s.a); continue; }
    const sweep = Math.abs(s.a1 - s.a0), n = Math.max(2, Math.ceil(sweep / (2 * Math.acos(Math.max(0, 1 - tol / Math.max(s.r, tol * 1.01))))));
    for (let k = 0; k < n; k++) { const a = s.a0 + (s.a1 - s.a0) * k / n; pts.push([s.c[0] + s.r * Math.cos(a), s.c[1] + s.r * Math.sin(a)]); }
  }
  return pts;
}
export function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) a += cross(pts[i], pts[(i + 1) % pts.length]); return a / 2; }
export function loopLength(loop) { return loop.reduce((s, g) => s + (g.t === "L" ? dist(g.a, g.b) : g.r * Math.abs(g.a1 - g.a0)), 0); }
export function reverseLoop(loop) {
  return loop.slice().reverse().map((s) => (s.t === "L" ? lineSeg(s.b, s.a) : arcSeg(s.b, s.a, s.c, !s.ccw)));
}
function orient(loop, ccw) { return (polyArea(flattenLoop(loop)) > 0) === ccw ? loop : reverseLoop(loop); }

function anyLoops(def) {
  if (!def || typeof def !== "object") throw new ProfileError(`Profil invalide : ${JSON.stringify(def)}.`);
  if (def.gen) { const n = normalizeProfile(generateProfile(def)); return [n.outer, ...n.holes]; }
  if (def.rect) return [loopRect(def.rect, def.r)];
  if (def.circle) return [loopCircle(def.circle)];
  if (def.slot) return [loopSlot(def.slot)];
  if (def.poly) return [loopPoly(def.poly, def.r || 0)];
  if (def.path) return loopsFromPath(def.path, !!def.flipY);
  throw new ProfileError(`Profil : forme inconnue (${Object.keys(def).join(", ")}). Formes : rect, circle, slot, poly, path.`);
}

/** Normalise any profile definition into {outer, holes} with consistent orientation. */
export function normalizeProfile(def) {
  if (def && def.outer && Array.isArray(def.outer) && def.outer[0] && def.outer[0].t) return def;     // already normalised
  if (def && def.gen) def = generateProfile(def);
  let outer, holes = [];
  if (def && def.outer) {
    const lo = anyLoops(def.outer);
    outer = lo[0]; holes = lo.slice(1);
    for (const h of def.holes || []) holes.push(...anyLoops(h));
  } else {
    const lo = anyLoops(def);
    // several loops in one path: the largest is the outer loop, the others are holes
    lo.sort((a, b) => Math.abs(polyArea(flattenLoop(b))) - Math.abs(polyArea(flattenLoop(a))));
    outer = lo[0]; holes = lo.slice(1);
    for (const h of (def && def.holes) || []) holes.push(...anyLoops(h));
  }
  if (!outer || !outer.length) throw new ProfileError("Profil vide.");
  return { outer: orient(outer, true), holes: holes.map((h) => orient(h, false)) };
}

export function profileBBox(profile) {
  const pts = flattenLoop(profile.outer, 0.02);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [x0, y0, x1, y1];
}

export function profileArea(profile) {
  return Math.abs(polyArea(flattenLoop(profile.outer, 0.01))) - profile.holes.reduce((s, h) => s + Math.abs(polyArea(flattenLoop(h, 0.01))), 0);
}
export function profilePerimeter(profile) { return loopLength(profile.outer) + profile.holes.reduce((s, h) => s + loopLength(h), 0); }

export function pointInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function pointInProfile(p, profile, flat) {
  const f = flat || { outer: flattenLoop(profile.outer), holes: profile.holes.map((h) => flattenLoop(h)) };
  return pointInPoly(p, f.outer) && !f.holes.some((h) => pointInPoly(p, h));
}

/** SVG path data of a normalised profile (for 2D previews); y is flipped when `flipY` (screen coordinates). */
export function profileToSvgPath(profile, flipY = true) {
  const f = (v) => (Math.round(v * 1000) / 1000).toString();
  const P = (p) => `${f(p[0])} ${f(flipY ? -p[1] : p[1])}`;
  const one = (loop) => {
    let d = `M${P(loop[0].a)}`;
    for (const s of loop) {
      if (s.t === "L") d += `L${P(s.b)}`;
      else { const large = Math.abs(s.a1 - s.a0) > Math.PI ? 1 : 0, sweep = (s.ccw !== flipY) ? 1 : 0; d += `A${f(s.r)} ${f(s.r)} 0 ${large} ${sweep} ${P(s.b)}`; }
    }
    return d + "Z";
  };
  return [profile.outer, ...profile.holes].map(one).join("");
}

export const _internal = { loopPoly, loopRect, loopCircle, loopSlot, loopsFromPath, arcSeg, lineSeg };
