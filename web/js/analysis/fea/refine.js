/* DesignWizard.ai — refinement zones : smaller cubes where the analyst wants to look closely.
   The analyst places a volume in the model — a cylinder or a square prism along X, Y or Z — and what it shares with the product is
   meshed again with cubes 2, 3 or 4 times smaller. The fine cubes subdivide the cubes of the model (same grid lines), so a zone is
   a block of whole cubes : its shape, in cubes ; inside it the product is read again from its geometry, so a detail smaller than a
   cube of the model can appear. The fine cubes and the rest of the model are then solved TOGETHER, as one mesh (composite.js) :
   on the edge of a zone, a fine node follows the cube of the model it sits on (it is tied to it), so the zone stiffens or
   softens the model as much as it should, and the model loads the zone as much as it should. This file is what a zone IS : its
   shape, the cubes it takes, its fine mesh and its ties, and the supports and loads of the case that fall in it.
   Pure : no DOM. Units : mm. zone = { id, shape: "cylinder" | "prism", axis: 0 | 1 | 2, size (diameter or side), length, at: [x, y, z], ratio } */

import { assemble, fillGrid, exposedFaces, FACE_DIRS, CORNER_OFFSETS } from "./voxel.js";
import { selectNodes, regionFaces } from "./index.js";
import { trisRegion, pathNodes, nearestNode } from "./entity.js";
import { meshPieces } from "./solve.js";

export const ZONE_SHAPES = { cylinder: { fr: "Cylindre", en: "Cylinder", size: "Diamètre", mark: "⌀" }, prism: { fr: "Prisme carré", en: "Square prism", size: "Côté", mark: "□" } };
export const ZONE_RATIOS = [2, 3, 4];
export const ZONE_MAX_CELLS = 40000;      // fine cubes in one zone : beyond, the request is a whole fine model, not a zone
const AX = "XYZ", fr = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");

/** A zone as the solver reads it, or null when it is not one. */
export function normZone(z) {
  if (!z || !ZONE_SHAPES[z.shape] || ![0, 1, 2].includes(z.axis) || !(z.size > 0) || !(z.length > 0) || !Array.isArray(z.at) || z.at.length !== 3 || !z.at.every((v) => Number.isFinite(v))) return null;
  return { id: z.id || "Z", shape: z.shape, axis: z.axis, size: Number(z.size), length: Number(z.length), at: z.at.map(Number), ratio: ZONE_RATIOS.includes(z.ratio) ? z.ratio : 2 };
}
/** Is a point in the zone, grown by `grow` all around ? */
export function inZone(z, p, grow = 0) {
  const a = z.axis, [u, v] = [0, 1, 2].filter((d) => d !== a), r = z.size / 2 + grow;
  if (Math.abs(p[a] - z.at[a]) > z.length / 2 + grow) return false;
  const du = p[u] - z.at[u], dv = p[v] - z.at[v];
  return z.shape === "prism" ? Math.abs(du) <= r && Math.abs(dv) <= r : du * du + dv * dv <= r * r;
}
/** The box that holds the zone : [x0, y0, z0, x1, y1, z1]. */
export function zoneBox(z) { const half = [0, 1, 2].map((d) => (d === z.axis ? z.length : z.size) / 2); return [...z.at.map((c, d) => c - half[d]), ...z.at.map((c, d) => c + half[d])]; }
/** The outline of the zone, to draw it : its two end loops (closed) and the lines that join them. */
export function zoneOutline(z, n = 40) {
  const a = z.axis, [u, v] = [0, 1, 2].filter((d) => d !== a), r = z.size / 2, ring = z.shape === "prism" ? [[-r, -r], [r, -r], [r, r], [-r, r]] : Array.from({ length: n }, (_, k) => [r * Math.cos(2 * Math.PI * k / n), r * Math.sin(2 * Math.PI * k / n)]);
  const at = (s, [pu, pv]) => { const p = [0, 0, 0]; p[a] = z.at[a] + s * z.length / 2; p[u] = z.at[u] + pu; p[v] = z.at[v] + pv; return p; };
  const loops = [-1, 1].map((s) => { const l = ring.map((q) => at(s, q)); l.push(l[0]); return l; }), step = z.shape === "prism" ? 1 : n / 4;
  return { loops, lines: [0, 1, 2, 3].map((k) => [at(-1, ring[Math.round(k * step) % ring.length]), at(1, ring[Math.round(k * step) % ring.length])]) };
}
/** « Cylindre ⌀ 12 × 30 mm, axe Z » */
export const zoneText = (z) => `${ZONE_SHAPES[z.shape].fr} ${ZONE_SHAPES[z.shape].mark} ${fr(z.size)} × ${fr(z.length)} mm, axe ${AX[z.axis]}`;

/** The cubes of the model a zone takes : those it reaches (their centre within the zone grown by half a cube), kept or empty, on the
    side the cuts keep, and neither taken by another zone nor touching one (`taken` : a cube of the model always stands between two
    zones, and ties them). → { mark (per grid cell), count, kept (those that hold material), lo, hi } */
export function zoneBlock(model, zone, taken) {
  const { grid: { nx, ny, nz, h, origin }, cells } = model, n = [nx, ny, nz], mark = new Uint8Array(nx * ny * nz), box = zoneBox(zone), planes = model.cut ? model.cut.planes : [];
  const a = [0, 1, 2].map((d) => Math.max(0, Math.floor((box[d] - origin[d]) / h - 0.5))), b = [0, 1, 2].map((d) => Math.min(n[d] - 1, Math.ceil((box[d + 3] - origin[d]) / h - 0.5)));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; let count = 0, kept = 0;
  for (let k = a[2]; k <= b[2]; k++) for (let j = a[1]; j <= b[1]; j++) for (let i = a[0]; i <= b[0]; i++) {
    const g = i + nx * (j + ny * k), q = [i, j, k];
    if ((taken && taken[g]) || planes.some((pl) => (pl.keep > 0 ? q[pl.axis] < pl.i : q[pl.axis] >= pl.i))) continue;
    if (!inZone(zone, q.map((v, d) => origin[d] + (v + 0.5) * h), 0.4999 * h)) continue;
    mark[g] = 1; count++; if (cells[g] >= 0) kept++;
    for (let d = 0; d < 3; d++) { if (q[d] < lo[d]) lo[d] = q[d]; if (q[d] > hi[d]) hi[d] = q[d]; }
  }
  return { mark, count, kept, lo, hi };
}

const elemCache = new WeakMap();
/** Element of every grid cell of a model (-1 : empty). */
export function elementOf(model) {
  let m = elemCache.get(model); if (m) return m;
  m = new Int32Array(model.cells.length).fill(-1); for (let e = 0; e < model.nCells; e++) m[model.elemCell[e]] = e;
  elemCache.set(model, m); return m;
}

/**
 * The fine mesh of a zone and what ties it to the model : the block of cubes it takes, its own model (`local`, cubes h / ratio),
 * its ties (`bound` : a fine node that sits on a cube of the model outside the zone, that cube, and the 8 weights of its corners —
 * the node moves as the cube says there), the faces that are not surfaces of the product (`inner` : 1 where the zone meets the
 * rest, 2 on a cut plane), the nodes of each cut plane, and the weight of each node (halved on a plane of symmetry).
 * A fragment of the fine mesh that nothing ties to the rest of the product is left out.
 */
export function prepareZone(model, bodies, zone, taken) {
  const z = normZone(zone); if (!z) throw new Error(`Zone ${zone && zone.id ? zone.id : ""} : forme, axe, cotes ou centre invalides.`);
  const { grid } = model, { nx, ny, nz } = grid, r = z.ratio, block = zoneBlock(model, z, taken), ofCell = elementOf(model), planes = model.cut ? model.cut.planes : [];
  if (!block.count) throw new Error(`La zone ${z.id} est hors du maillage : placez son centre sur la pièce.`);
  if (block.count * r ** 3 > 12 * ZONE_MAX_CELLS) throw new Error(`La zone ${z.id} est trop grande pour des cubes ${r} fois plus petits : réduisez-la, ou affinez plutôt le maillage d'ensemble.`);
  const lo = block.lo, n = [0, 1, 2].map((d) => (block.hi[d] - lo[d] + 1) * r), fine = { nx: n[0], ny: n[1], nz: n[2], h: grid.h / r, origin: [0, 1, 2].map((d) => grid.origin[d] + lo[d] * grid.h) };
  const parent = (i, j, k) => { const I = lo[0] + Math.floor(i / r), J = lo[1] + Math.floor(j / r), K = lo[2] + Math.floor(k / r); return I < 0 || J < 0 || K < 0 || I >= nx || J >= ny || K >= nz ? -1 : I + nx * (J + ny * K); };
  const cells = fillGrid(bodies, fine); let count = 0;
  for (let k = 0, g = 0; k < n[2]; k++) for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++, g++) { if (cells[g] < 0) continue; if (!block.mark[parent(i, j, k)]) cells[g] = -1; else count++; }
  if (!count) throw new Error(`La zone ${z.id} ne contient pas de matière : déplacez-la sur la pièce.`);
  if (count > ZONE_MAX_CELLS) throw new Error(`La zone ${z.id} demande ${count.toLocaleString("fr-CA")} cubes fins (limite : ${ZONE_MAX_CELLS.toLocaleString("fr-CA")}) : réduisez la zone ou sa finesse.`);
  const meta = bodies.map((b) => ({ name: b.name, material: b.material })), nxn = n[0] + 1, nyn = n[1] + 1;
  let local, bound, dropped = 0;
  for (let pass = 0; pass < 4; pass++) {
    local = assemble(fine, cells, meta); bound = { nodes: [], elem: [], w: [] };
    const sides = (a) => (a % r === 0 ? [a / r - 1, a / r] : [Math.floor(a / r)]);      // the cubes of the model a fine grid line belongs to, along one axis
    for (let gN = 0; gN < local.nodeGrid.length; gN++) {
      const id = local.nodeGrid[gN]; if (id < 0) continue;
      const q = [gN % nxn, Math.floor(gN / nxn) % nyn, Math.floor(gN / (nxn * nyn))];
      search: for (const K of sides(q[2])) for (const J of sides(q[1])) for (const I of sides(q[0])) {
        const P = [lo[0] + I, lo[1] + J, lo[2] + K]; if (P[0] < 0 || P[1] < 0 || P[2] < 0 || P[0] >= nx || P[1] >= ny || P[2] >= nz) continue;
        const g = P[0] + nx * (P[1] + ny * P[2]), e = ofCell[g]; if (block.mark[g] || e < 0) continue;
        const t = [(q[0] - I * r) / r, (q[1] - J * r) / r, (q[2] - K * r) / r];
        bound.nodes.push(id); bound.elem.push(e); for (const c of CORNER_OFFSETS) bound.w.push((c[0] ? t[0] : 1 - t[0]) * (c[1] ? t[1] : 1 - t[1]) * (c[2] ? t[2] : 1 - t[2]));
        break search;
      }
    }
    /* a fragment the rest of the product does not hold has nothing to stand on : it is left out */
    const { piece, count: pieces } = meshPieces(local), held = new Uint8Array(pieces); for (const i of bound.nodes) held[piece[i]] = 1;
    let loose = 0; for (let e = 0; e < local.nCells; e++) if (!held[piece[local.elems[8 * e]]]) { cells[local.elemCell[e]] = -1; loose++; }
    if (!loose) break;
    dropped += loose; if (loose === local.nCells) throw new Error(`La zone ${z.id} couvre tout ce qui tient ensemble ici : rien d'autre ne la porte. Réduisez-la, ou affinez plutôt le maillage d'ensemble.`);
  }
  const faces = exposedFaces(local), inner = new Uint8Array(faces.count);
  for (let f = 0; f < faces.count; f++) {
    const g = local.elemCell[faces.elem[f]], d = faces.dir[f], q = [g % n[0], Math.floor(g / n[0]) % n[1], Math.floor(g / (n[0] * n[1]))], P = parent(q[0] + FACE_DIRS[d][0], q[1] + FACE_DIRS[d][1], q[2] + FACE_DIRS[d][2]);
    if (P < 0 || block.mark[P]) continue;      // the edge of the grid, or an empty place inside the zone : a surface of the product
    if (ofCell[P] >= 0) inner[f] = 1;
    else if (planes.some((pl) => pl.axis === (d >> 1) && (lo[d >> 1] * r + q[d >> 1] + (d & 1)) === pl.i * r)) inner[f] = 2;
  }
  local.inner = inner;
  const weight = new Float32Array(local.nNodes).fill(1), onPlane = planes.map((pl) => ({ axis: pl.axis, bc: pl.bc, T: pl.T, nodes: [] }));
  for (let gN = 0; gN < local.nodeGrid.length; gN++) {
    const id = local.nodeGrid[gN]; if (id < 0) continue;
    const q = [gN % nxn, Math.floor(gN / nxn) % nyn, Math.floor(gN / (nxn * nyn))];
    planes.forEach((pl, k) => { if (lo[pl.axis] * r + q[pl.axis] === pl.i * r) { onPlane[k].nodes.push(id); if (pl.bc === "sym") weight[id] *= 0.5; } });
  }
  return { zone: z, block, local, inner, weight, dropped, planes: onPlane.map((p) => ({ ...p, nodes: Int32Array.from(p.nodes) })),
    bound: { nodes: Int32Array.from(bound.nodes), elem: Int32Array.from(bound.elem), w: Float64Array.from(bound.w) } };
}

/** A region of the product, found again on the fine mesh of a zone. A side of the product or a pointed face is carried over face by
    face (a fine face belongs when it looks the same way, over a face of the region on the model, within half a cube of its plane) ;
    a face, an edge or a point of the product itself, a box or a neighbourhood is the same place in space, read on the small cubes ;
    the face of a cut is the part of its plane the zone holds. → { nodes, faces (exposed faces of the fine mesh that carry it) } */
export function localRegion(prep, model, region) {
  const { local, inner, block: { lo }, zone: { ratio: r } } = prep, faces = exposedFaces(local), n = [local.grid.nx, local.grid.ny, local.grid.nz], real = (f) => !inner[f];
  const whole = (f) => { const o = 4 * f; return [faces.nodes[o], faces.nodes[o + 1], faces.nodes[o + 2], faces.nodes[o + 3]]; };
  if (region === "exterior") { const list = []; for (let f = 0; f < faces.count; f++) if (real(f)) list.push(f); return { nodes: Int32Array.from(new Set(list.flatMap(whole))), faces: list }; }
  if (region && region.any) { const parts = region.any.map((x) => localRegion(prep, model, x)); return { nodes: Int32Array.from(new Set(parts.flatMap((p) => Array.from(p.nodes)))), faces: [...new Set(parts.flatMap((p) => p.faces))] }; }
  if (region && region.tris) return trisRegion(local, region);
  if (region && region.cut !== undefined) { const k = prep.planes.findIndex((p) => p.axis === region.cut), list = []; if (k < 0) return { nodes: new Int32Array(0), faces: [] };
    for (let f = 0; f < faces.count; f++) if (inner[f] === 2 && (faces.dir[f] >> 1) === region.cut) list.push(f); return { nodes: prep.planes[k].nodes, faces: list }; }
  /* an edge, a point : the fine nodes along it, as long as they are close — the rest of the line is outside the zone */
  const close = (p, i) => i >= 0 && Math.hypot(local.nodes[3 * i] - p[0], local.nodes[3 * i + 1] - p[1], local.nodes[3 * i + 2] - p[2]) <= 0.9 * local.grid.h;
  if (region && Array.isArray(region.path)) return { nodes: pathNodes(local, region.path).filter((i) => region.path.some((p, s) => s + 1 < region.path.length ? segClose(local, i, p, region.path[s + 1]) : close(p, i))), faces: [] };
  if (region && region.near && !(region.r > 0)) { const i = nearestNode(local, region.near, null); return { nodes: close(region.near, i) ? Int32Array.of(i) : new Int32Array(0), faces: [] }; }
  if (region && (region.box || region.near)) {
    const { nodes, nNodes } = local, tol = 0.51 * local.grid.h, mark = new Uint8Array(nNodes), picked = [];
    for (let i = 0; i < nNodes; i++) {
      const p = [nodes[3 * i], nodes[3 * i + 1], nodes[3 * i + 2]];
      const inside = region.box ? p.every((v, d) => v >= region.box[d] - tol && v <= region.box[d + 3] + tol) : (p[0] - region.near[0]) ** 2 + (p[1] - region.near[1]) ** 2 + (p[2] - region.near[2]) ** 2 <= (region.r > 0 ? region.r : 0) ** 2;
      if (inside) { mark[i] = 1; picked.push(i); }
    }
    const list = []; for (let f = 0; f < faces.count; f++) if (real(f) && whole(f).every((i) => mark[i])) list.push(f);
    return { nodes: Int32Array.from(picked), faces: list };
  }
  /* a face of the product : where its faces are on the model, by column of cubes and by direction */
  const cf = exposedFaces(model), { nx, ny } = model.grid, at = new Map();
  for (const f of regionFaces(model, region)) {
    const g = model.elemCell[cf.elem[f]], q = [g % nx, Math.floor(g / nx) % ny, Math.floor(g / (nx * ny))], d = cf.dir[f], a = d >> 1, [u, v] = [0, 1, 2].filter((k) => k !== a), key = `${d}:${q[u]}:${q[v]}`;
    if (!at.has(key)) at.set(key, []); at.get(key).push(q[a] + (d & 1));
  }
  const list = [];
  for (let f = 0; f < faces.count && at.size; f++) {
    if (!real(f)) continue;
    const g = local.elemCell[faces.elem[f]], q = [g % n[0], Math.floor(g / n[0]) % n[1], Math.floor(g / (n[0] * n[1]))], d = faces.dir[f], a = d >> 1, [u, v] = [0, 1, 2].filter((k) => k !== a);
    const planes = at.get(`${d}:${lo[u] + Math.floor(q[u] / r)}:${lo[v] + Math.floor(q[v] / r)}`), level = lo[a] + (q[a] + (d & 1)) / r;
    if (planes && planes.some((p) => Math.abs(p - level) <= 0.51)) list.push(f);
  }
  return { nodes: Int32Array.from(new Set(list.flatMap(whole))), faces: list };
}

/** Is a node of a mesh within 0.9 cube of the segment a b ? */
function segClose(m, i, a, b) {
  const p = [m.nodes[3 * i], m.nodes[3 * i + 1], m.nodes[3 * i + 2]], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1], p[2] - a[2] - t * d[2]) <= 0.9 * m.grid.h;
}

const touchCache = new WeakMap();
/** The share of a load spread on the nodes of a region that falls in the zone : each node of the model counts for the part of its
    cubes the zone took (and for its weight on a cut model). */
function shareIn(prep, model, region) {
  let all = touchCache.get(model);
  if (!all) { all = new Uint8Array(model.nNodes); for (let e = 0; e < model.nCells; e++) for (let c = 0; c < 8; c++) all[model.elems[8 * e + c]]++; touchCache.set(model, all); }
  if (!prep.touch) { prep.touch = new Uint8Array(model.nNodes); for (let e = 0; e < model.nCells; e++) if (prep.block.mark[model.elemCell[e]]) for (let c = 0; c < 8; c++) prep.touch[model.elems[8 * e + c]]++; }
  const sel = selectNodes(model, region), w = model.cut ? model.cut.weight : null, total = sel.whole || sel.length; let sum = 0;
  for (const i of sel) sum += (w ? w[i] : 1) * prep.touch[i] / all[i];
  return total ? sum / total : 0;
}
/** A total (a force, a power) shared between the nodes of a region in the zone, by their weight : `dofs` values per node. */
function spread(prep, nodes, total, share) {
  let sw = 0; for (const i of nodes) sw += prep.weight[i];
  const out = new Float64Array(total.length * nodes.length);
  nodes.forEach((i, k) => { for (let d = 0; d < total.length; d++) out[total.length * k + d] = total[d] * share * prep.weight[i] / sw; });
  return out;
}

/** The structural case of a zone : the supports and the loads that fall in it, and the conditions of the cut planes. load : the case
    of the whole model, before the cut planes add theirs. What happens on its edge is not here : the ties do it (composite.js). */
export function structureSetup(prep, model, load, thermal) {
  const fixed = [], loads = [];
  for (const entry of load.fixed || []) {
    const split = entry && entry.region !== undefined, nodes = localRegion(prep, model, split ? entry.region : entry).nodes;
    if (nodes.length) fixed.push({ region: { nodes }, dofs: split && entry.dofs ? entry.dofs : [true, true, true] });
  }
  for (const pl of prep.planes) { if (!pl.nodes.length) continue; if (pl.bc === "sym") fixed.push({ region: { nodes: pl.nodes }, dofs: [0, 1, 2].map((d) => d === pl.axis) }); else if (pl.bc === "fixed") fixed.push({ region: { nodes: pl.nodes } }); }
  for (const l of load.loads || []) {
    if (l.force) { const nodes = localRegion(prep, model, l.region).nodes, share = shareIn(prep, model, l.region); if (nodes.length && share > 0) loads.push({ nodal: { nodes, f: spread(prep, nodes, l.force, share) } }); }
    else if (Number.isFinite(l.pressure)) { const list = localRegion(prep, model, l.region).faces; if (list.length) loads.push({ region: { faceList: list }, pressure: l.pressure }); }
  }
  return { fixed, loads, ...(thermal ? { thermal } : {}) };
}
/** The thermal case of a zone : its share of the sources, the imposed temperatures and the convection that fall in it. */
export function thermalSetup(prep, model, load) {
  const power = [], fixedT = [], convection = [];
  for (const item of load.power || []) { const nodes = localRegion(prep, model, item.region).nodes, share = shareIn(prep, model, item.region); if (nodes.length && share > 0) power.push({ nodal: { nodes, q: spread(prep, nodes, [item.P], share) } }); }
  for (const item of load.fixedT || []) { const nodes = localRegion(prep, model, item.region).nodes; if (nodes.length) fixedT.push({ region: { nodes }, T: item.T }); }
  for (const pl of prep.planes) if (pl.bc === "temp" && Number.isFinite(pl.T) && pl.nodes.length) fixedT.push({ region: { nodes: pl.nodes }, T: pl.T });
  for (const item of load.convection || []) { const list = localRegion(prep, model, item.region).faces; if (list.length) convection.push({ region: { faceList: list }, h: item.h, Tamb: item.Tamb }); }
  return { power, fixedT, convection };
}

/** The zones of a case, prepared one after the other : a zone never takes a cube another has, nor one that touches it.
    → one entry per zone : { id, prep } or { id, error } */
export function prepareZones(model, bodies, zones) {
  const { nx, ny, nz } = model.grid, taken = new Uint8Array(model.cells.length), out = [];
  for (const zone of zones || []) {
    const id = (zone && zone.id) || `Z${out.length + 1}`;
    try {
      const prep = prepareZone(model, bodies, { ...zone, id }, taken), { mark, lo, hi } = prep.block;
      for (let k = Math.max(0, lo[2] - 1); k <= Math.min(nz - 1, hi[2] + 1); k++) for (let j = Math.max(0, lo[1] - 1); j <= Math.min(ny - 1, hi[1] + 1); j++) for (let i = Math.max(0, lo[0] - 1); i <= Math.min(nx - 1, hi[0] + 1); i++) {
        let near = false; for (let c = -1; c <= 1 && !near; c++) for (let b = -1; b <= 1 && !near; b++) for (let a = -1; a <= 1; a++) { const I = i + a, J = j + b, K = k + c; if (I >= 0 && J >= 0 && K >= 0 && I < nx && J < ny && K < nz && mark[I + nx * (J + ny * K)]) { near = true; break; } }
        if (near) taken[i + nx * (j + ny * k)] = 1;
      }
      out.push({ id, prep });
    } catch (e) { out.push({ id, error: e && e.message ? e.message : String(e) }); }
  }
  return out;
}

/** What is missing or odd in the zones, for the guide. zones : as the screen keeps them (with `ask` : the values it invented) ;
    info(zone) → { error } | { cells, block (cubes of the model taken), h (cube of the model), walls (how many walls of the product the zone
    crosses) } ; → [{ level, id, text, field }] */
export function zoneIssues(zones, info) {
  const out = [], WORDS = { size: (z) => (z.shape === "prism" ? "le côté" : "le diamètre"), length: () => "la longueur" };
  (zones || []).forEach((z, k) => {
    const id = z.id || `Z${k + 1}`, add = (level, text, field) => out.push({ level, id, text, ...(field ? { field } : {}) });
    if (!normZone(z)) { add("error", `${id} : donnez une forme, un axe, des cotes positives et un centre.`, !(z.size > 0) ? "size" : !(z.length > 0) ? "length" : "at"); return; }
    for (const f of Array.isArray(z.ask) ? z.ask : []) if (WORDS[f]) add("todo", `${id} : entrez ${WORDS[f](z)} de la zone (${fr(z[f])} mm est un exemple).`, f);
    const i = info ? info(z) : null; if (!i) return;
    if (i.error) { add("error", `${i.error}`); return; }
    if (z.size < 2 * i.h) add("warn", `${id} : la zone est plus étroite que deux cubes du modèle (${fr(2 * i.h)} mm). Son bord colle au détail qu'elle regarde ; prévoyez deux à trois cubes de marge autour.`, "size");      // across, not along : a zone as long as its wall is thick ends on the surfaces of the part
    if (i.walls > 1) add("tip", `${id} traverse ${i.walls} parois de la pièce. Si une seule vous intéresse, raccourcissez la zone : « Une seule paroi », dans sa carte.`, "length");
  });
  return out;
}
