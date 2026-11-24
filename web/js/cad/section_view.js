/* DynamiteOrbit.ai — a section view. The part is cut by a plane square to an axis ; what lies between the eye and the plane is
   taken away, what stays is projected like any view, and the outline of the cut itself is given apart, to be hatched.
   The 2D frame is the one of the hidden-line views : xdir to the right, xdir × dir upward. Used by the kernel worker and by the tests. */

import { v3 } from "./vec.js";

/** o : { axis: "x" | "y" | "z", at, dir (the way the eye looks), xdir }. → { visible, smooth, hidden: [], cut: [[[x, y], …], …], plane: { axis, at } } */
export function sectionView(K, shape, o) {
  const i = "xyz".indexOf(o.axis), bb = K.bbox(shape), n = [0, 0, 0], origin = [0, 0, 0], pad = 1; n[i] = 1; origin[i] = o.at;
  if (i < 0 || !(o.at > bb[i] && o.at < bb[i + 3])) throw new Error("Le plan de coupe ne traverse pas la pièce.");
  const lo = [bb[0] - pad, bb[1] - pad, bb[2] - pad], hi = [bb[3] + pad, bb[4] + pad, bb[5] + pad];
  if (o.dir[i] < 0) lo[i] = o.at; else hi[i] = o.at;                       // the eye looks toward −axis : it stands on the + side, which is removed
  const kept = K.cut(shape, [K.box(lo, hi)]), view = K.hlr(kept, o.dir, o.xdir, false), up = v3.cross(o.xdir, o.dir);
  const cut = K.section(shape, origin, n).map((pts) => pts.map((q) => [v3.dot(q, o.xdir), v3.dot(q, up)]));
  return { ...view, hidden: [], cut, plane: { axis: o.axis, at: o.at } };
}
/** The section a part asks for, or the one it gets by itself : through the middle, across the length, when the part has something inside. */
export function sectionOf(spec, built) {
  const bb = built.bbox, own = spec.section;
  if (own === false || (own && own.axis === "none")) return null;
  const facts = built.facts || {}, inside = ["holes", "pockets", "shells", "bosses"].some((k) => (facts[k] || []).length);
  if (!own && !inside) return null;
  const axis = own && (own.axis === "y" || own.axis === "x") ? own.axis : "x", i = "xyz".indexOf(axis), mid = (bb[i] + bb[i + 3]) / 2;
  const at = own && Number.isFinite(own.at) && own.at > bb[i] + 0.01 && own.at < bb[i + 3] - 0.01 ? own.at : mid + (bb[i + 3] - bb[i]) * 0.0007;      // a hair off the middle : a plane on a face of symmetry cuts nothing clean
  return axis === "x" ? { name: "section", axis, at, dir: [-1, 0, 0], xdir: [0, 1, 0], ax: [1, 2] } : { name: "section", axis, at, dir: [0, 1, 0], xdir: [1, 0, 0], ax: [0, 2] };
}
