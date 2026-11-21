/* DesignWizard.ai — what a 3D view shows around the part : the triad (where X, Y and Z point, top right) and the grid
   behind the part. Pure : the viewer draws what these functions return ; the tests read the same numbers.
   The grid stands on the three faces of the box of the part that are away from the eye — the floor and the two back
   walls of a room — so that it is always BEHIND the part, whatever the view ; its step is a round number of millimetres. */

export const AXES = [{ key: "X", v: [1, 0, 0], color: "#e5484d" }, { key: "Y", v: [0, 1, 0], color: "#2f9e44" }, { key: "Z", v: [0, 0, 1], color: "#2563eb" }];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The triad as it is drawn : for each axis its end in the plane of the screen (x to the right, y down, unit length when the
    axis lies in the screen) and how far it comes toward the eye. right, up, eye : the unit vectors of the camera.
    → [{ key, color, x, y, depth }] sorted from the farthest to the nearest (drawn in that order, the nearest on top). */
export function triadOf(right, up, eye) {
  return AXES.map((a) => ({ key: a.key, color: a.color, v: a.v, x: dot(a.v, right), y: -dot(a.v, up), depth: dot(a.v, eye) })).sort((p, q) => p.depth - q.depth);
}
const STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** The step of the grid for a part of this size : a round number, about twenty squares or fewer along its longest side. */
export function gridStep(size) { const L = Math.max(...size.map((v) => Math.abs(v) || 0), 1e-6); return STEPS.find((s) => L / s <= 20) || STEPS[STEPS.length - 1]; }
/** The grid behind a part. box : [x0, y0, z0, x1, y1, z1] ; eye : unit vector from the part to the eye.
    → { step, major (a heavier line every `major` steps), min, max (the box of the grid, on multiples of the step),
        planes: [{ axis, at }], minor: Float32Array, heavy: Float32Array } — the two arrays are line segments (x, y, z pairs). */
export function gridOf(box, eye) {
  const size = [box[3] - box[0], box[4] - box[1], box[5] - box[2]], step = gridStep(size), major = 5, pad = step;
  const min = [0, 1, 2].map((k) => Math.floor((box[k] - pad) / step + 1e-9) * step), max = [0, 1, 2].map((k) => Math.ceil((box[k + 3] + pad) / step - 1e-9) * step);
  const planes = [0, 1, 2].map((axis) => ({ axis, at: eye[axis] >= 0 ? min[axis] : max[axis] })), minor = [], heavy = [];
  for (const { axis, at } of planes) {
    const [a, b] = [0, 1, 2].filter((k) => k !== axis);
    for (const [u, v] of [[a, b], [b, a]]) for (let i = Math.round(min[u] / step); i <= Math.round(max[u] / step); i++) {
      const p = [0, 0, 0], q = [0, 0, 0]; p[axis] = q[axis] = at; p[u] = q[u] = i * step; p[v] = min[v]; q[v] = max[v];
      (i % major === 0 ? heavy : minor).push(...p, ...q);
    }
  }
  return { step, major, min, max, planes, minor: new Float32Array(minor), heavy: new Float32Array(heavy) };
}
/** What tells two grids apart : the grid is rebuilt only when this changes. */
export const gridKey = (box, eye) => `${box.map((v) => Math.round(v * 10)).join(",")}|${eye.map((v) => (v >= 0 ? "+" : "-")).join("")}`;
