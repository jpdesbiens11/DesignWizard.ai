/* DesignWizard.ai — 3D printing : what a build direction costs. On the tessellated part, a face that looks down and lies
   flatter than the limit angle of the process needs supports, unless it rests on the build plate. Pure : a mesh, a
   direction, an angle — no kernel. Not modelled : a short bridge between two walls (it prints without support) and a
   support that would land on the part instead of the plate. The area is therefore an UPPER bound, read on the real
   geometry ; the slicer of the supplier has the last word. */

import { BUILD_DIRS, DIR_WORDS, buildDir } from "../cad/special_processes.js";
export { BUILD_DIRS, DIR_WORDS, buildDir };
const SUPPORT = 1, PLATE = 2;

/** mesh : { pos, idx, faceOf?, faces? } ; dir : a key of BUILD_DIRS ; angle : the smallest self-supporting angle, in degrees from the plate ;
    opts.hole : the largest horizontal hole the process prints round without support (mm ; needs the faces of the mesh).
    → { dir, angle, area (mm² to support), plate (mm² resting on the plate), total (mm² of the part), share (area / total),
        height (mm along the build), volume (mm³ between the supported faces and the plate), faces (how many faces of the
        model carry a supported zone), flags (Uint8Array per triangle : 0 free, 1 to support, 2 on the plate) } */
export function supportReport(mesh, dir = "+Z", angle = 45, opts = {}) {
  const b = BUILD_DIRS[dir] || BUILD_DIRS["+Z"], pos = mesh.pos, idx = mesh.idx, nt = idx.length / 3, flags = new Uint8Array(nt), limit = Math.cos((angle * Math.PI) / 180) + 1e-3;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { const h = pos[i] * b[0] + pos[i + 1] * b[1] + pos[i + 2] * b[2]; if (h < lo) lo = h; if (h > hi) hi = h; }
  const tol = Math.max(1e-3, (hi - lo) * 1e-4), seen = new Set(), F = mesh.faces && mesh.faceOf ? mesh.faces : null;
  /* a small hole lying across the build prints round : its roof is short enough to hold by itself */
  const smallHole = (t) => { const f = F && F[mesh.faceOf[t]]; return !!f && f.type === "cylinder" && f.inner && opts.hole > 0 && 2 * f.r <= opts.hole + 1e-6 && Math.abs(f.axis[0] * b[0] + f.axis[1] * b[1] + f.axis[2] * b[2]) < 0.2; };
  let area = 0, plate = 0, total = 0, volume = 0;
  for (let t = 0; t < nt; t++) {
    const i = 3 * idx[3 * t], j = 3 * idx[3 * t + 1], k = 3 * idx[3 * t + 2];
    const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1], uz = pos[j + 2] - pos[i + 2], vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1], vz = pos[k + 2] - pos[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    const a = len / 2, down = -(nx * b[0] + ny * b[1] + nz * b[2]) / len;      // 1 : looks straight down, 0 : a wall
    total += a;
    if (down <= limit || smallHole(t)) continue;
    const h = [i, j, k].map((q) => pos[q] * b[0] + pos[q + 1] * b[1] + pos[q + 2] * b[2]);
    if (down > 0.999 && Math.max(...h) - lo <= tol) { flags[t] = PLATE; plate += a; continue; }
    flags[t] = SUPPORT; area += a; volume += a * down * ((h[0] + h[1] + h[2]) / 3 - lo);
    if (mesh.faceOf) seen.add(mesh.faceOf[t]);
  }
  const r = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  return { dir: BUILD_DIRS[dir] ? dir : "+Z", angle, area: r(area), plate: r(plate), total: r(total), share: total > 0 ? r(area / total, 3) : 0, height: r(hi - lo, 2), volume: r(volume, 0), faces: seen.size, flags };
}
/** The six directions, the cheapest first : least area to support, then the lowest build (fewer layers). */
export function rankDirections(mesh, angle = 45, opts = {}) {
  return Object.keys(BUILD_DIRS).map((d) => supportReport(mesh, d, angle, opts)).sort((p, q) => (Math.abs(p.area - q.area) > Math.max(1, 0.02 * Math.max(p.area, q.area)) ? p.area - q.area : p.height - q.height));
}
