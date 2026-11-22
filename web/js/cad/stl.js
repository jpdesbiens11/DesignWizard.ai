/* DynamiteOrbit — STL export (binary) of tessellated bodies, for 3D printing and for viewers that do not read STEP.
   Pure module (browser and Node): takes the meshes of the kernel's tessellation ({pos: Float32Array, idx: Uint32Array}),
   returns the bytes of the file. Units are the model's (millimetres); the facet normals are recomputed from the vertices. */

import { STL_HEADER } from "../core/brand.js";

const HEADER = 80, RECORD = 50;

/** a * b for column-major 4x4 matrices (either may be null = identity). */
function compose(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);

/** Plain ASCII text for the 80-byte header (accents removed; must not start with "solid", which marks an ASCII STL). */
function asciiHeader(text) {
  const s = String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
  return s.slice(0, HEADER);
}

/**
 * Binary STL of one mesh or of a list of meshes.
 * @param meshes  {pos, idx, matrix?} or an array of them. `pos` = x,y,z triples, `idx` = vertex indices by threes
 *                (without `idx` the vertices are taken three by three); `matrix` = optional column-major 4x4 placement.
 * @param opts    {name: part name written in the header, matrix: column-major 4x4 applied to every mesh (after its own)}
 * @returns Uint8Array : 80-byte header, uint32 triangle count, then 50 bytes per triangle (normal, 3 vertices, uint16 0).
 *          Degenerate triangles (no area, or a non-finite vertex) are skipped; a mirroring matrix flips the winding.
 */
export function meshesToStl(meshes, { name = "part", matrix = null } = {}) {
  const list = (Array.isArray(meshes) ? meshes : [meshes]).filter((m) => m && m.pos);
  let max = 0;
  for (const m of list) max += Math.floor((m.idx ? m.idx.length : m.pos.length / 3) / 3);
  const bytes = new Uint8Array(HEADER + 4 + RECORD * max), dv = new DataView(bytes.buffer);
  const head = asciiHeader(`${STL_HEADER} - ${name} - mm`);      // 80 bytes : the mark first, what is left for the name
  for (let i = 0; i < head.length; i++) bytes[i] = head.charCodeAt(i);
  let count = 0, off = HEADER + 4;
  const P = [new Float64Array(3), new Float64Array(3), new Float64Array(3)];
  for (const m of list) {
    const M = compose(matrix, m.matrix || null), flip = !!M && det3(M) < 0;
    const pos = m.pos, idx = m.idx || null, nTri = Math.floor((idx ? idx.length : pos.length / 3) / 3);
    for (let t = 0; t < nTri; t++) {
      for (let k = 0; k < 3; k++) {
        const v = (idx ? idx[t * 3 + k] : t * 3 + k) * 3, x = pos[v], y = pos[v + 1], z = pos[v + 2], q = P[flip && k ? 3 - k : k];
        if (M) { q[0] = M[0] * x + M[4] * y + M[8] * z + M[12]; q[1] = M[1] * x + M[5] * y + M[9] * z + M[13]; q[2] = M[2] * x + M[6] * y + M[10] * z + M[14]; }
        else { q[0] = x; q[1] = y; q[2] = z; }
      }
      const [a, b, c] = P;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l2 = nx * nx + ny * ny + nz * nz;
      if (!(l2 > 1e-30) || !Number.isFinite(l2)) continue;                // degenerate or non-finite: not a facet
      const l = Math.sqrt(l2);
      dv.setFloat32(off, nx / l, true); dv.setFloat32(off + 4, ny / l, true); dv.setFloat32(off + 8, nz / l, true);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) dv.setFloat32(off + 12 + k * 12 + j * 4, P[k][j], true);
      dv.setUint16(off + 48, 0, true);
      off += RECORD; count++;
    }
  }
  dv.setUint32(HEADER, count, true);
  return bytes.slice(0, HEADER + 4 + RECORD * count);
}

/** Read back a binary STL: {triangles, bbox: [x0, y0, z0, x1, y1, z1], header}. Throws when the size does not match the count. */
export function stlStats(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < HEADER + 4) throw new Error("STL binaire invalide : fichier plus court que son en-tête (84 octets).");
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), triangles = dv.getUint32(HEADER, true);
  if (u8.length !== HEADER + 4 + RECORD * triangles) throw new Error(`STL binaire invalide : ${triangles} triangles annoncés pour ${u8.length} octets (attendu ${HEADER + 4 + RECORD * triangles}).`);
  const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let t = 0; t < triangles; t++) for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) {
    const v = dv.getFloat32(HEADER + 4 + t * RECORD + 12 + k * 12 + j * 4, true);
    if (v < bbox[j]) bbox[j] = v;
    if (v > bbox[3 + j]) bbox[3 + j] = v;
  }
  let header = "";
  for (let i = 0; i < HEADER && u8[i]; i++) header += String.fromCharCode(u8[i]);
  return { triangles, bbox: triangles ? bbox : [0, 0, 0, 0, 0, 0], header };
}
