/* DesignWizard.ai — what the 3D view draws on a part when the designer points at it : a face lit up (the one a
   list names, the one under the cursor, the one just chosen), and the symbols of a load case — a clamp where the
   part is held, an arrow where it is pushed and which way, a row of small arrows for a pressure, a mark for heat.
   Every mark belongs to a tag, so a screen clears its own and nothing else. Pure three.js, no state of its own. */

import * as THREE from "../../vendor/three/three.module.min.js";

export const SIDES = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
export const SIDE_FR = { "+Z": "dessus", "-Z": "dessous", "+X": "droite", "-X": "gauche", "+Y": "arrière", "-Y": "avant" };
export const LIT = { hover: "#35c2ff", named: "#ffb020", chosen: "#2ec27e" };      // under the cursor · named by a list · just chosen

/** The side a normal looks at ("+Z"…), or null when it is not square to an axis. */
export function sideOf(n, tol = 0.985) {
  if (!n) return null;
  const a = [0, 1, 2].reduce((m, i) => (Math.abs(n[i]) > Math.abs(n[m]) ? i : m), 0);
  return Math.abs(n[a]) >= tol ? `${n[a] > 0 ? "+" : "-"}${"XYZ"[a]}` : null;
}

function overlay(viewer, o, index, color, tag, opacity) {
  if (!index.length) return 0;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", o.mesh.geometry.getAttribute("position")); g.setIndex(index);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  m.matrixAutoUpdate = false; m.matrix.copy(o.group.matrix); m.renderOrder = 6; m.userData.tag = tag;
  viewer.overlays.add(m); viewer.dirty = true;
  return index.length / 3;
}
const wanted = (id, ids) => !ids || ids.some((p) => id === p || id.startsWith(`${p}/`));

/** Lights up the planar faces that look at a side. o : { color, tag, opacity, ids (object ids or prefixes), level (coordinate
    of the plane along the axis ; default : the outermost one), all (every plane facing that side) }. → triangles lit */
export function lightSide(viewer, side, o = {}) {
  const dir = SIDES[side]; if (!dir) return 0;
  const axis = dir.findIndex((c) => c !== 0), sign = dir[axis], color = o.color || LIT.named, tag = o.tag || "face";
  let lit = 0;
  for (const [id, ob] of viewer.objects) {
    if (!ob.group.visible || !wanted(id, o.ids)) continue;
    const pos = ob.mesh.geometry.getAttribute("position").array, idx = ob.mesh.geometry.getIndex().array, n = idx.length / 3, facing = [], at = [];
    for (let t = 0; t < n; t++) {
      const a = 3 * idx[3 * t], b = 3 * idx[3 * t + 1], c = 3 * idx[3 * t + 2];
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nn = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], len = Math.hypot(...nn);
      if (len < 1e-12 || Math.abs(nn[axis]) / len < 0.999) continue;                    // a plane square to the axis, whichever way its triangle is wound
      facing.push(t); at.push((pos[a + axis] + pos[b + axis] + pos[c + axis]) / 3);
    }
    if (!facing.length) continue;
    const ext = sign > 0 ? Math.max(...at) : Math.min(...at), span = (Math.max(...at) - Math.min(...at)) || 1, level = o.level ?? ext, tol = Math.max(0.02, span * 1e-4), keep = [];
    facing.forEach((t, k) => { if (o.all || Math.abs(at[k] - level) <= tol) keep.push(idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]); });
    lit += overlay(viewer, ob, keep, color, tag, o.opacity ?? 0.55);
  }
  return lit;
}
/** Lights up one face of the B-Rep of an object (the one a pick returned : hit.id, hit.faceId). */
export function lightFace(viewer, id, faceId, o = {}) {
  const ob = viewer.objects.get(id), f = ob && ob.def.mesh && ob.def.mesh.faceOf; if (!f || faceId < 0) return 0;
  const idx = ob.mesh.geometry.getIndex().array, keep = [];
  for (let t = 0; t < f.length; t++) if (f[t] === faceId) keep.push(idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]);
  return overlay(viewer, ob, keep, o.color || LIT.hover, o.tag || "face", o.opacity ?? 0.5);
}

/** Points spread over one side of a box [x0, y0, z0, x1, y1, z1] : n × n of them, away from the edges. */
export function sidePoints(box, side, n = 3) {
  const dir = SIDES[side], a = dir.findIndex((c) => c !== 0), [u, v] = [0, 1, 2].filter((i) => i !== a), out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const p = [0, 0, 0]; p[a] = dir[a] > 0 ? box[3 + a] : box[a]; p[u] = box[u] + (box[3 + u] - box[u]) * (i + 0.5) / n; p[v] = box[v] + (box[3 + v] - box[v]) * (j + 0.5) / n; out.push(p); }
  return out;
}
const basic = (color, opacity = 0.95) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });
const put = (viewer, g, tag) => { g.traverse((x) => { x.renderOrder = 9; }); g.userData.tag = tag; viewer.overlays.add(g); viewer.dirty = true; return g; };
const turn = (obj, dir) => obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());

/** An arrow whose tip touches `tip` and that points along `dir` : a force, or one of the arrows of a pressure. o : { color, tag, len } */
export function arrow(viewer, tip, dir, o = {}) {
  const s = o.len || viewer._size() * 0.09, r = s * 0.05, g = new THREE.Group(), d = new THREE.Vector3(...dir).normalize(), mat = basic(o.color || "#e5484d");
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 3, s * 0.3, 14), mat), shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, s * 0.7, 10), mat);
  turn(head, dir); turn(shaft, dir);
  head.position.copy(new THREE.Vector3(...tip).addScaledVector(d, -s * 0.15)); shaft.position.copy(new THREE.Vector3(...tip).addScaledVector(d, -s * 0.65));
  g.add(head, shaft);
  return put(viewer, g, o.tag || "bc");
}
/** A clamp : where the part is held. A cone whose tip touches the surface, standing on a small plate — the ground. `out` = outward normal. */
export function clamp(viewer, at, out, o = {}) {
  const s = o.len || viewer._size() * 0.045, g = new THREE.Group(), n = new THREE.Vector3(...out).normalize(), mat = basic(o.color || "#0c66e4"), inward = [-out[0], -out[1], -out[2]];
  const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.45, s, 4), mat), plate = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.75, s * 0.75, s * 0.12, 4), mat);
  turn(cone, inward); turn(plate, inward);
  cone.position.copy(new THREE.Vector3(...at).addScaledVector(n, s * 0.5)); plate.position.copy(new THREE.Vector3(...at).addScaledVector(n, s * 1.06));
  g.add(cone, plate);
  return put(viewer, g, o.tag || "bc");
}
/** A mark for heat or an imposed temperature : a small diamond on the surface. */
export function gem(viewer, at, o = {}) {
  const s = o.len || viewer._size() * 0.02, m = new THREE.Mesh(new THREE.OctahedronGeometry(s), basic(o.color || "#f97316"));
  m.position.set(...at);
  return put(viewer, m, o.tag || "bc");
}
