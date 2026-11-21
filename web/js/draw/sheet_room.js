/* DesignWizard.ai — the room left on a sheet. Everything drawn on the first page is inked on a fine grid as it is drawn (a sheet wrapped by
   `inked`), the views are inked whole ; then what comes last — a feature control frame and its leader, a detail view — is put where the
   grid is still white, as near as it can to what it belongs to. A frame is never put on a line, a text or a view ; its leader crosses as
   little ink as it can. Pure (browser and Node). */

import { resolveText } from "./sheet.js";

const CELL = 1.5;
export class Room {
  /** w, h : the page, in mm. */
  constructor(w, h) { this.nx = Math.ceil(w / CELL) + 1; this.ny = Math.ceil(h / CELL) + 1; this.g = new Uint8Array(this.nx * this.ny); }
  _i(x, y) { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i < 0 || j < 0 || i >= this.nx || j >= this.ny ? -1 : j * this.nx + i; }
  dot(x, y) { const k = this._i(x, y); if (k >= 0) this.g[k] = 1; }
  /** Ink a rectangle, whole. */
  rect(x, y, w, h) { for (let j = Math.floor(y / CELL); j <= Math.floor((y + h) / CELL); j++) for (let i = Math.floor(x / CELL); i <= Math.floor((x + w) / CELL); i++) if (i >= 0 && j >= 0 && i < this.nx && j < this.ny) this.g[j * this.nx + i] = 1; }
  /** Ink a segment. */
  seg(x1, y1, x2, y2) { const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (CELL / 2))); for (let k = 0; k <= n; k++) this.dot(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n); }
  /** How many inked cells a rectangle (grown by pad) covers — 0 : it is free. */
  ink(x, y, w, h, pad = 0) {
    let n = 0;
    for (let j = Math.floor((y - pad) / CELL); j <= Math.floor((y + h + pad) / CELL); j++) for (let i = Math.floor((x - pad) / CELL); i <= Math.floor((x + w + pad) / CELL); i++) {
      if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) { n++; continue; } n += this.g[j * this.nx + i]; }
    return n;
  }
  /** Whether a rectangle (grown by pad) is white — the first inked cell answers. */
  free(x, y, w, h, pad = 0) {
    for (let j = Math.floor((y - pad) / CELL); j <= Math.floor((y + h + pad) / CELL); j++) for (let i = Math.floor((x - pad) / CELL); i <= Math.floor((x + w + pad) / CELL); i++)
      if (i < 0 || j < 0 || i >= this.nx || j >= this.ny || this.g[j * this.nx + i]) return false;
    return true;
  }
  /** The ink a straight line from a to b crosses, the last `spare` mm before b left out (where it touches what it points at), and what
      lies inside `skip` (a rectangle : the view it points into). */
  along(a, b, spare = 3, skip = null) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / CELL)); let c = 0;
    for (let k = 0; k <= n; k++) { const t = k / n; if (L * (1 - t) < spare) break; const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (skip && x >= skip.x && x <= skip.x + skip.w && y >= skip.y && y <= skip.y + skip.h) continue; const q = this._i(x, y); if (q >= 0) c += this.g[q]; }
    return c;
  }
}

const DRAW = new Set(["line", "polyline", "rect", "circle", "arc", "path", "text"]);
/** A sheet that inks the room as it draws : the same calls, the same result. */
export function inked(sheet, room) {
  const ink = (k, a) => {
    if (k === "line") room.seg(a[0], a[1], a[2], a[3]);
    else if (k === "polyline") { const p = a[0] || []; for (let i = 1; i < p.length; i++) room.seg(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]); if (a[1] && (a[1].close || a[1].fill) && p.length > 2) room.seg(p[p.length - 1][0], p[p.length - 1][1], p[0][0], p[0][1]); }
    else if (k === "rect") { const [x, y, w, h, st] = a; if (st && st.fill && st.fill !== "none") room.rect(x, y, w, h); else { room.seg(x, y, x + w, y); room.seg(x + w, y, x + w, y + h); room.seg(x + w, y + h, x, y + h); room.seg(x, y + h, x, y); } }
    else if (k === "circle" || k === "arc") room.rect(a[0] - a[2], a[1] - a[2], 2 * a[2], 2 * a[2]);
    else if (k === "path") { let last = null; for (const c of a[0] || []) { const p = c[0] === "C" || c[0] === "c" ? [c[5], c[6]] : c.length > 2 ? [c[1], c[2]] : null; if (p && last && String(c[0]).toUpperCase() !== "M") room.seg(last[0], last[1], p[0], p[1]); if (p) last = p; } }
    else if (k === "text") { const t = resolveText(a[2], a[3]); if (!t.str) return; const x0 = a[0] + t.dx, base = a[1] + t.dy, top = base - 0.75 * t.size, bot = base + 0.25 * t.size;
      if (!t.angle) { room.rect(x0, top, t.width, bot - top); return; }
      const r = t.angle * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), P = (x, y) => [a[0] + (x - a[0]) * cs - (y - a[1]) * sn, a[1] + (x - a[0]) * sn + (y - a[1]) * cs];
      const q = [P(x0, top), P(x0 + t.width, top), P(x0 + t.width, bot), P(x0, bot)], xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
      room.rect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); }
  };
  const proxy = new Proxy(sheet, { get(target, k) {
    const v = target[k]; if (typeof v !== "function") return v;
    if (!DRAW.has(k)) return (...a) => { const r = v.apply(target, a); return r === target ? proxy : r; };
    return (...a) => { ink(k, a); const r = v.apply(target, a); return r === target ? proxy : r; };
  } });
  return proxy;
}
/** A sheet that draws nothing — to try a layout before drawing it : it measures text as the real one does. */
export function dry(sheet) {
  const proxy = new Proxy(sheet, { get(target, k) {
    const v = target[k]; if (typeof v !== "function") return v;
    if (DRAW.has(k) || k === "newPage" || k === "image") return () => proxy;
    return (...a) => { const r = v.apply(target, a); return r === target ? proxy : r; };
  } });
  return proxy;
}

/** Where to put a label of w × h (a feature control frame) tied by a leader to the point `to` : a horizontal stub of 4 mm from the end of
    the label that faces `to`, then a straight line. above / below : room for a line of text over and under it. dir : the side it would
    rather stand on (outward from its view). own : the view `to` lies in (its ink does not count against the leader). area : where it may go.
    → { x, y (the label), stub : [x, y] (where the leader leaves the stub), crowded (no white room was found : it is on something) } */
export function placeLabel(room, o) {
  const { to, w, h, above = 0, below = 0, area, own = null, dir = [1, -1] } = o, want = Math.atan2(dir[1], dir[0]);
  let best = null;
  const tryAt = (d, a, allowInk) => {
    const sx = to[0] + d * Math.cos(a), sy = to[1] + d * Math.sin(a), right = Math.cos(a) >= 0, x = right ? sx + 4 : sx - 4 - w, y = sy - h / 2;
    if (x < area.x || y - above < area.y || x + w > area.x + area.w || y + h + below > area.y + area.h) return;
    const bx = x - (right ? 4 : 0), white = room.free(bx, y - above, w + 4, h + above + below, 1);
    if (!white && !allowInk) return;
    const over = white ? 0 : room.ink(bx, y - above, w + 4, h + above + below, 1);
    const score = d + 22 * (1 - Math.cos(a - want)) + 2.5 * room.along([sx, sy], to, 3, own) + 6 * over;
    if (!best || score < best.score) best = { x, y, stub: [sx, sy], score, crowded: over > 0 };
  };
  for (const allowInk of [false, true]) {
    for (let d = 9; d <= 260 && !(best && best.score < d); d += d < 45 ? 3 : 7) for (let k = 0; k < 36; k++) tryAt(d, (k * 10 * Math.PI) / 180, allowInk);
    if (best) break;
  }
  return best;
}
/** Where to put a box of w × h (a detail view and its label) : white room, as near as it can to `near` (a point). → { x, y } or null. */
export function placeBox(room, w, h, near, area, pad = 2) {
  let best = null;
  for (let y = area.y; y + h <= area.y + area.h; y += 3) for (let x = area.x; x + w <= area.x + area.w; x += 3) {
    if (!room.free(x, y, w, h, pad)) continue;
    const d = Math.hypot(x + w / 2 - near[0], y + h / 2 - near[1]); if (!best || d < best.d) best = { x, y, d };
  }
  return best ? { x: best.x, y: best.y } : null;
}
