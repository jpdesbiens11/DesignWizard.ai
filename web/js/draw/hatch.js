/* DesignOrbit.ai — hatching : the lines that fill the cut face of a section. The outlines are given as polylines (closed or
   not, in any order) ; a point is inside when a ray from it crosses them an odd number of times, so holes stay white without
   having to be told apart. Pure. */

/** Hatch lines inside the outlines. polylines : [[[x, y], …], …] ; spacing between lines ; angle in degrees. → [[[x1, y1], [x2, y2]], …] */
export function hatch(polylines, spacing = 2, angle = 45) {
  const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), turn = ([x, y]) => [x * c + y * s, -x * s + y * c], back = ([x, y]) => [x * c - y * s, x * s + y * c];
  const edges = []; let lo = Infinity, hi = -Infinity;
  for (const pl of polylines) { const pts = pl.map(turn); for (let i = 0; i + 1 < pts.length; i++) { const p = pts[i], q = pts[i + 1]; if (Math.abs(p[1] - q[1]) < 1e-9) continue; edges.push([p, q]); lo = Math.min(lo, p[1], q[1]); hi = Math.max(hi, p[1], q[1]); } }
  const out = []; if (!edges.length || !(spacing > 0)) return out;
  for (let y = (Math.floor(lo / spacing) + 0.5) * spacing; y < hi; y += spacing) {
    const xs = []; for (const [p, q] of edges) if ((p[1] <= y) !== (q[1] <= y)) xs.push(p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]));
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-6) out.push([back([xs[i], y]), back([xs[i + 1], y])]);
  }
  return out;
}
