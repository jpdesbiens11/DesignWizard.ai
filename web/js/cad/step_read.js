/* DynamiteOrbit.ai — what the kernel can READ of a solid made elsewhere (a STEP from Onshape, Inventor, a supplier) : the faces
   that face along an axis of the part and the cylinders whose axis runs along one. Nothing is guessed here : each face is said with its
   kind, its level, its box and its area ; each cylinder with its axis, its centre, its radius, its sweep and whether it is a hole wall
   (its normal points to the axis : the face is reversed on its surface, as OpenCascade writes the wall of a hole). What those faces make
   — a pattern of holes, a bore, a shaft, a flat face — is read from these numbers by core/step_interfaces.js, which is pure and tested.
   Faces that lean (no axis of the part) and the other kinds of surface (cone, torus, B-spline…) are only counted. */

import { FACES } from "./vec.js";

const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** The axis a unit direction runs along, and which way : { k: 0 | 1 | 2, s: 1 | -1 } — or null when it leans (more than 0,01°). */
export function axisOf(d) {
  for (let k = 0; k < 3; k++) if (Math.abs(Math.abs(d[k]) - 1) < 2e-6) return { k, s: d[k] > 0 ? 1 : -1 };
  return null;
}
/** The two model axes that span a plane normal to axis k, in the order the faces of the part use (FACES[…].plane). */
export const planeAxes = (k) => FACES[["+X", "+Y", "+Z"][k]].plane;

/** The readable faces of a shape. → { bbox, planes: [{ axis, sign, level, box, area }], cyls: [{ axis, c: [a, b], r, inner, sweep, lo, hi, area }],
    faces (how many), slanted (faces of a readable kind that lean), other (faces of another kind) } */
export function readFeatures(K, shape) {
  const bbox = K.bbox(shape).map(r4), planes = [], cyls = [];
  let faces = 0, slanted = 0, other = 0;
  for (const f of K.facesInfo(shape)) {
    faces++;
    if (f.type !== "plane" && f.type !== "cylinder") { other++; continue; }
    const a = axisOf(f.type === "plane" ? f.n : f.axis); if (!a) { slanted++; continue; }
    const box = K.bbox(f.face).map(r4);
    if (f.type === "plane") planes.push({ axis: a.k, sign: a.s, level: r4(f.o[a.k]), box, area: r4(f.area) });
    else { const [p, q] = planeAxes(a.k); cyls.push({ axis: a.k, c: [r4(f.o[p]), r4(f.o[q])], r: r4(f.r), inner: !!f.inner, sweep: r4(f.sweep), lo: box[a.k], hi: box[3 + a.k], area: r4(f.area) }); }
  }
  return { bbox, planes, cyls, faces, slanted, other };
}
