// Mesh template of the simplified finite-element brick: a regular grid of identical cubes (voxels) over the bodies.
// A cell is kept when its centre is inside a body. Bodies that touch share the grid nodes (bonded contact).
// Units: mm. Pure module (no DOM), used by index.js and tested by tests/node/fea.test.mjs.

/** Local corner offsets of a cell, standard hex8 order: bottom face counter-clockwise, then top face. */
export const CORNER_OFFSETS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
/** The six faces of a cell: outward direction and the 4 local corners, counter-clockwise seen from outside. */
export const FACE_DIRS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
export const FACE_NODES = [[0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2], [0, 3, 2, 1], [4, 5, 6, 7]];

// Scan rays are shifted by a tiny irrational fraction of h so that they never run along a triangle edge
// (the diagonal of a box face passes exactly through cell centres). The spare offsets serve as retries.
const JITTERS = [[Math.SQRT2 * 1e-4, Math.sqrt(3) * 1e-4], [-Math.sqrt(5) * 1e-4, Math.sqrt(7) * 1e-4], [Math.sqrt(11) * 1e-4, -Math.sqrt(13) * 1e-4]];
const MAX_GRID = 3e7;   // grid cells (kept or not): beyond this the request is a mistake, not a coarse mesh

/** World positions (matrix applied), bounding box and enclosed volume of one body. */
function prepareBody(body, b) {
  const { pos, idx, matrix: m } = body || {};
  if (!pos || !idx || pos.length < 9 || idx.length < 3) throw new Error(`Le corps ${body?.name ? `« ${body.name} »` : b + 1} n'a pas de maillage triangulaire.`);
  const P = new Float64Array(pos.length);
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    P[i] = m ? m[0] * x + m[4] * y + m[8] * z + m[12] : x;
    P[i + 1] = m ? m[1] * x + m[5] * y + m[9] * z + m[13] : y;
    P[i + 2] = m ? m[2] * x + m[6] * y + m[10] * z + m[14] : z;
    for (let d = 0; d < 3; d++) { box[d] = Math.min(box[d], P[i + d]); box[d + 3] = Math.max(box[d + 3], P[i + d]); }
  }
  let six = 0;   // divergence theorem: 6 V = sum of a . (b x c) over the triangles
  for (let t = 0; t < idx.length; t += 3) {
    const a = 3 * idx[t], b2 = 3 * idx[t + 1], c = 3 * idx[t + 2];
    six += P[a] * (P[b2 + 1] * P[c + 2] - P[b2 + 2] * P[c + 1]) + P[a + 1] * (P[b2 + 2] * P[c] - P[b2] * P[c + 2]) + P[a + 2] * (P[b2] * P[c + 1] - P[b2 + 1] * P[c]);
  }
  const boxVolume = (box[3] - box[0]) * (box[4] - box[1]) * (box[5] - box[2]);
  let volume = Math.abs(six) / 6;
  if (!(volume > 1e-6 * boxVolume)) volume = boxVolume;   // open or inconsistent mesh: fall back on the box
  return { P, idx, box, volume };
}

/** Cell size for about `target` cells; the thinnest body dimension is divided exactly, in 2 cells or more when affordable. */
function chooseSize(volume, minDim, target) {
  const h0 = Math.cbrt(volume / Math.max(1, target));
  if (!(minDim > 0)) return h0;
  for (let n = Math.max(2, Math.round(minDim / h0)); n >= 1; n--) {
    const h = minDim / n;
    if (volume / (h * h * h) <= 4 * target) return h;
  }
  return h0;
}

/** z of the hit of the vertical line (px, py) with triangle (a, b, c) (offsets into P), or NaN. */
function hitZ(P, a, b, c, px, py) {
  const ax = P[a], ay = P[a + 1], ux = P[b] - ax, uy = P[b + 1] - ay, vx = P[c] - ax, vy = P[c + 1] - ay;
  const den = ux * vy - vx * uy;
  if (den === 0) return NaN;   // triangle seen edge-on
  const w1 = ((px - ax) * vy - vx * (py - ay)) / den, w2 = (ux * (py - ay) - (px - ax) * uy) / den;
  if (w1 < 0 || w2 < 0 || w1 + w2 > 1) return NaN;
  return P[a + 2] + w1 * (P[b + 2] - P[a + 2]) + w2 * (P[c + 2] - P[a + 2]);
}

/** Scan-line voxelisation of one body: marks the free cells whose centre is inside it. Returns the number of cells claimed. */
function voxelise(mesh, grid, cells, bodyIndex) {
  const { P, idx } = mesh, { nx, ny, nz, h, origin: [ox, oy, oz] } = grid;
  const hits = new Array(nx * ny);
  const jx = JITTERS[0][0] * h, jy = JITTERS[0][1] * h;
  for (let t = 0; t < idx.length; t += 3) {   // every triangle drops its z on the columns it covers
    const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    const i0 = Math.max(0, Math.ceil((Math.min(P[a], P[b], P[c]) - ox - jx) / h - 0.5));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(P[a], P[b], P[c]) - ox - jx) / h - 0.5));
    const j0 = Math.max(0, Math.ceil((Math.min(P[a + 1], P[b + 1], P[c + 1]) - oy - jy) / h - 0.5));
    const j1 = Math.min(ny - 1, Math.floor((Math.max(P[a + 1], P[b + 1], P[c + 1]) - oy - jy) / h - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const z = hitZ(P, a, b, c, ox + (i + 0.5) * h + jx, oy + (j + 0.5) * h + jy);
      if (z === z) (hits[i + nx * j] ||= []).push(z);
    }
  }
  let claimed = 0;
  for (let col = 0; col < nx * ny; col++) {
    let zs = hits[col];
    if (!zs) continue;
    for (let retry = 1; zs.length % 2 && retry < JITTERS.length; retry++) {   // odd parity: the ray grazed an edge, cast it again
      const px = ox + (col % nx + 0.5 + JITTERS[retry][0]) * h, py = oy + (Math.floor(col / nx) + 0.5 + JITTERS[retry][1]) * h;
      zs = [];
      for (let t = 0; t < idx.length; t += 3) {
        const z = hitZ(P, 3 * idx[t], 3 * idx[t + 1], 3 * idx[t + 2], px, py);
        if (z === z) zs.push(z);
      }
    }
    zs.sort((p, q) => p - q);
    for (let s = 0; s + 1 < zs.length; s += 2) {   // inside between hits 0-1, 2-3, ... (an open mesh loses its last hit)
      const k0 = Math.max(0, Math.ceil((zs[s] - oz) / h - 0.5)), k1 = Math.min(nz - 1, Math.ceil((zs[s + 1] - oz) / h - 0.5) - 1);
      for (let k = k0; k <= k1; k++) {
        const g = col + nx * ny * k;
        if (cells[g] === -1) { cells[g] = bodyIndex; claimed++; }   // the first body that claims a cell keeps it
      }
    }
  }
  return claimed;
}

/**
 * Meshes the bodies with the voxel template.
 * @param {{bodies: Array, target?: number, h?: number}} options bodies: [{ name, pos, idx, matrix?, material }]; target: wanted
 *   number of cells (sets h from the volume of the bodies); h (mm) overrides it.
 * @returns the model (see index.js for the field list).
 */
export function buildModel({ bodies, target = 4000, h } = {}) {
  if (!Array.isArray(bodies) || !bodies.length) throw new Error("Aucun corps à mailler : choisissez une pièce ou un assemblage.");
  if (bodies.length > 32000) throw new Error("Trop de corps pour le maillage simplifié (32 000 au plus).");
  const meshes = bodies.map(prepareBody);
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let volume = 0, minDim = Infinity;
  for (const m of meshes) {
    volume += m.volume;
    for (let d = 0; d < 3; d++) {
      box[d] = Math.min(box[d], m.box[d]); box[d + 3] = Math.max(box[d + 3], m.box[d + 3]);
      if (m.box[d + 3] - m.box[d] > 0) minDim = Math.min(minDim, m.box[d + 3] - m.box[d]);
    }
  }
  const size = Number(h) > 0 ? Number(h) : chooseSize(volume, Number.isFinite(minDim) ? minDim : 0, target);
  if (!(size > 0) || !Number.isFinite(size)) throw new Error("Taille de maille invalide : les corps n'ont pas de volume mesurable.");

  // The grid is centred on the bounding box and holds the nearest whole number of cells in each direction.
  const n = [0, 1, 2].map((d) => Math.max(1, Math.round((box[d + 3] - box[d]) / size)));
  if (n[0] * n[1] * n[2] > MAX_GRID) throw new Error(`Maillage trop fin (${n.join(" × ")} cellules) : augmentez la taille de maille h.`);
  const grid = { nx: n[0], ny: n[1], nz: n[2], h: size, origin: [0, 1, 2].map((d) => (box[d] + box[d + 3] - n[d] * size) / 2) };
  const { nx, ny, nz } = grid;
  const cells = new Int16Array(nx * ny * nz).fill(-1);
  const counts = meshes.map((m, b) => voxelise(m, grid, cells, b));
  const nCells = counts.reduce((s, c) => s + c, 0);
  if (!nCells) throw new Error("Maillage vide : aucune cellule n'a son centre dans un corps. Diminuez la taille de maille h ou vérifiez que les corps sont des volumes fermés.");

  // Compact numbering: only the grid nodes touched by a kept cell exist, numbered in grid order.
  const nxn = nx + 1, nyn = ny + 1, nodeId = new Int32Array(nxn * nyn * (nz + 1)).fill(-1);
  const cornerStep = CORNER_OFFSETS.map(([di, dj, dk]) => di + nxn * (dj + nyn * dk));
  const elemCell = new Int32Array(nCells), elemBody = new Int16Array(nCells);
  for (let g = 0, e = 0; g < cells.length; g++) {
    if (cells[g] < 0) continue;
    elemCell[e] = g; elemBody[e++] = cells[g];
    const i = g % nx, j = Math.floor(g / nx) % ny, k = Math.floor(g / (nx * ny)), base = i + nxn * (j + nyn * k);
    for (let c = 0; c < 8; c++) nodeId[base + cornerStep[c]] = 0;
  }
  let nNodes = 0;
  for (let g = 0; g < nodeId.length; g++) if (nodeId[g] === 0) nodeId[g] = nNodes++;
  const nodes = new Float32Array(3 * nNodes), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let g = 0; g < nodeId.length; g++) {
    const id = nodeId[g];
    if (id < 0) continue;
    const ijk = [g % nxn, Math.floor(g / nxn) % nyn, Math.floor(g / (nxn * nyn))];
    for (let d = 0; d < 3; d++) {
      const x = grid.origin[d] + ijk[d] * size;
      nodes[3 * id + d] = x; lo[d] = Math.min(lo[d], x); hi[d] = Math.max(hi[d], x);
    }
  }
  const elems = new Int32Array(8 * nCells);
  for (let e = 0; e < nCells; e++) {
    const g = elemCell[e], base = g % nx + nxn * (Math.floor(g / nx) % ny + nyn * Math.floor(g / (nx * ny)));
    for (let c = 0; c < 8; c++) elems[8 * e + c] = nodeId[base + cornerStep[c]];
  }
  const cellVolume = size * size * size;
  return {
    grid, cells, nCells, nNodes, nodes, elems, elemBody, elemCell,
    bodies: bodies.map((b, i) => ({ name: b.name, material: b.material, cells: counts[i], volume: counts[i] * cellVolume })),
    bbox: [...lo, ...hi], volume: nCells * cellVolume,
  };
}

const faceCache = new WeakMap();

/** Exposed cell faces (no kept neighbour across): { count, elem, dir (0..5, see FACE_DIRS), nodes (4 per face, outward winding) }. */
export function exposedFaces(model) {
  let faces = faceCache.get(model);
  if (faces) return faces;
  const { grid: { nx, ny, nz }, cells, elems, elemCell, nCells } = model;
  const elem = [], dir = [], nodes = [];
  for (let e = 0; e < nCells; e++) {
    const g = elemCell[e], ijk = [g % nx, Math.floor(g / nx) % ny, Math.floor(g / (nx * ny))];
    for (let f = 0; f < 6; f++) {
      const i = ijk[0] + FACE_DIRS[f][0], j = ijk[1] + FACE_DIRS[f][1], k = ijk[2] + FACE_DIRS[f][2];
      if (i >= 0 && i < nx && j >= 0 && j < ny && k >= 0 && k < nz && cells[i + nx * (j + ny * k)] >= 0) continue;
      elem.push(e); dir.push(f);
      for (const c of FACE_NODES[f]) nodes.push(elems[8 * e + c]);
    }
  }
  faces = { count: elem.length, elem: Int32Array.from(elem), dir: Uint8Array.from(dir), nodes: Int32Array.from(nodes) };
  faceCache.set(model, faces);
  return faces;
}

/**
 * Section properties of the grid layer that contains `coord` along `axis` (0, 1 or 2).
 * a and b are the two other axes in increasing order; Ia and Ib are taken about the centroidal axes parallel to a and to b,
 * ca and cb are the matching fibre distances (along b and along a). Every cell adds its own h^4 / 12.
 */
export function sectionAt(model, axis, coord) {
  const { grid, cells } = model, { h, origin } = grid, n = [grid.nx, grid.ny, grid.nz];
  if (axis !== 0 && axis !== 1 && axis !== 2) throw new Error("Axe de coupe invalide : 0 (X), 1 (Y) ou 2 (Z).");
  const layer = Math.min(n[axis] - 1, Math.max(0, Math.floor((coord - origin[axis]) / h)));
  const [a, b] = [0, 1, 2].filter((d) => d !== axis), step = [1, n[0], n[0] * n[1]];
  const as = [], bs = [];
  for (let q = 0; q < n[b]; q++) for (let p = 0; p < n[a]; p++) {
    if (cells[layer * step[axis] + p * step[a] + q * step[b]] < 0) continue;
    as.push(origin[a] + (p + 0.5) * h); bs.push(origin[b] + (q + 0.5) * h);
  }
  const count = as.length;
  if (!count) return { area: 0, centroid: null, Ia: 0, Ib: 0, ca: 0, cb: 0, size: [0, 0], cells: 0 };
  const ma = as.reduce((s, v) => s + v, 0) / count, mb = bs.reduce((s, v) => s + v, 0) / count, own = (h * h * h * h) / 12;
  let Ia = 0, Ib = 0, ca = 0, cb = 0;
  for (let c = 0; c < count; c++) {
    const da = as[c] - ma, db = bs[c] - mb;
    Ia += db * db * h * h + own; Ib += da * da * h * h + own;
    ca = Math.max(ca, Math.abs(db) + h / 2); cb = Math.max(cb, Math.abs(da) + h / 2);
  }
  const span = (v) => Math.max(...v) - Math.min(...v) + h;
  return { area: count * h * h, centroid: [ma, mb], Ia, Ib, ca, cb, size: [span(as), span(bs)], cells: count };
}

/**
 * Outer skin of the mesh for display: the exposed cell faces as independent quads (4 vertices, 2 triangles, outward winding).
 * @param field Float32Array(nNodes) copied on the vertices (or null: zeros)
 * @param options u: nodal displacements (3 per node) added to the positions, multiplied by `scale`
 */
export function skin(model, field, { u, scale = 1 } = {}) {
  const faces = exposedFaces(model), { nodes, nNodes } = model, count = faces.count;
  const pos = new Float32Array(12 * count), idx = new Uint32Array(6 * count), val = new Float32Array(4 * count);
  const place = (node, d) => nodes[3 * node + d] + (u ? scale * u[3 * node + d] : 0);
  const seen = new Set(), edges = [];
  for (let f = 0; f < count; f++) {
    for (let c = 0; c < 4; c++) {
      const node = faces.nodes[4 * f + c], next = faces.nodes[4 * f + (c + 1) % 4];
      for (let d = 0; d < 3; d++) pos[12 * f + 3 * c + d] = place(node, d);
      if (field) val[4 * f + c] = field[node];
      const key = Math.min(node, next) * nNodes + Math.max(node, next);   // an edge shared by two faces is drawn once
      if (!seen.has(key)) { seen.add(key); edges.push(place(node, 0), place(node, 1), place(node, 2), place(next, 0), place(next, 1), place(next, 2)); }
    }
    idx.set([4 * f, 4 * f + 1, 4 * f + 2, 4 * f, 4 * f + 2, 4 * f + 3], 6 * f);
  }
  return { pos, idx, val, epos: new Float32Array(edges), faces: count };
}
