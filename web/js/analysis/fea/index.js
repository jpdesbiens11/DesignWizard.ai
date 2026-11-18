// Simplified finite elements: mesh a part or an assembly coarsely with identical cubes, solve structure or steady-state
// heat very fast, and aim at "80 % of reality or better". Public API of the brick (pure, no DOM).
//
// Units: mm, N, MPa (N/mm2), W, degrees C. Conductivity k in W/m.K, convection coefficient in W/m2.K, density in kg/m3.
//
// model = buildModel({ bodies, target, h }):
//   grid { nx, ny, nz, h, origin }, cells Int16Array (body index or -1, index = i + nx * (j + ny * k)), nCells, nNodes,
//   nodes Float32Array(3 * nNodes), elems Int32Array(8 * nCells) (hex8 order: bottom face counter-clockwise, then top),
//   elemBody, elemCell, bodies [{ name, material, cells, volume }], bbox (of the kept cells), volume.
// region = { face: "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z", body?: name } | { box: [x0, y0, z0, x1, y1, z1] } | { near: [x, y, z], r }
//        | { patch: { at: [x, y, z], dir: "+X"… } } : the face the designer pointed at, inner faces included (patch.js)
//        | { nodes: [...] } | { faceList: [...] } : already resolved on this very mesh — the nodes, or the exposed faces (refine.js)
// material = { name, E (MPa), nu, k (W/m.K), rho (kg/m3), Re (MPa or null), alpha (1/K, thermal expansion, optional) }

import { cutFaces } from "./symmetry.js";
import { patchNodes } from "./patch.js";
import { buildModel, exposedFaces, sectionAt, skin, FACE_DIRS } from "./voxel.js";
import { structureElement, conductionElement, vonMises } from "./hex8.js";
import { pcg, structureOperator, thermalOperator, looseMotion, unmarkedBody } from "./solve.js";

export { buildModel, sectionAt, skin };

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const round3 = (v) => Math.round(v * 1000) / 1000;

/** Words that name a region in the error messages. */
function regionLabel(region) {
  if (region === "exterior") return "« extérieur »";
  if (region?.face) return `face ${region.face}${region.body ? ` du corps « ${region.body} »` : ""}`;
  if (region?.box) return `boîte [${Array.from(region.box, round3).join(", ")}]`;
  if (region?.near) return `voisinage du point [${Array.from(region.near, round3).join(", ")}]`;
  if (region?.patch) return `face pointée ${region.patch.dir} près de [${Array.from(region.patch.at || [], round3).join(", ")}]`;
  return `région ${JSON.stringify(region)}`;
}

/** Sorted, unique ids of the nodes of a region. */
export function selectNodes(model, region) {
  const { nodes, nNodes, elems, elemBody, nCells, grid } = model, tol = 0.51 * grid.h, picked = [];
  if (region?.nodes) return Int32Array.from(region.nodes);
  if (region?.plane) {   // the nodes of a grid plane : where a cut passes
    const { axis, i } = region.plane, x = grid.origin[axis] + i * grid.h;
    for (let k = 0; k < nNodes; k++) if (Math.abs(nodes[3 * k + axis] - x) < 0.01 * grid.h) picked.push(k);
    return Int32Array.from(picked);
  }
  if (model.cut) {   // a reduced model : the region keeps the meaning it has on the whole product ; `whole` is its size there
    const all = selectNodes(model.cut.full, region), sel = Int32Array.from(Array.from(all, (k) => model.cut.fromFull[k]).filter((k) => k >= 0));
    sel.whole = all.length; return sel;
  }
  if (region?.face) {
    const m = /^([+-])([XYZ])$/.exec(region.face);
    if (!m) throw new Error(`Face inconnue « ${region.face} » : utilisez +X, -X, +Y, -Y, +Z ou -Z.`);
    const axis = "XYZ".indexOf(m[2]), sign = m[1] === "+" ? 1 : -1;
    let inBody = null;   // optional restriction to the nodes of one body
    if (region.body != null) {
      const b = model.bodies.findIndex((body) => body.name === region.body);
      if (b < 0) throw new Error(`Corps « ${region.body} » introuvable dans le maillage.`);
      inBody = new Uint8Array(nNodes);
      for (let e = 0; e < nCells; e++) if (elemBody[e] === b) for (let a = 0; a < 8; a++) inBody[elems[8 * e + a]] = 1;
    }
    let extreme = -Infinity;
    for (let i = 0; i < nNodes; i++) if (!inBody || inBody[i]) extreme = Math.max(extreme, sign * nodes[3 * i + axis]);
    for (let i = 0; i < nNodes; i++) if ((!inBody || inBody[i]) && extreme - sign * nodes[3 * i + axis] <= tol) picked.push(i);
  } else if (region?.box?.length === 6) {
    const b = region.box;
    for (let i = 0; i < nNodes; i++) {
      const x = nodes[3 * i], y = nodes[3 * i + 1], z = nodes[3 * i + 2];
      if (x >= b[0] - tol && x <= b[3] + tol && y >= b[1] - tol && y <= b[4] + tol && z >= b[2] - tol && z <= b[5] + tol) picked.push(i);
    }
  } else if (region?.near?.length === 3) {
    const [px, py, pz] = region.near, r2 = (region.r > 0 ? region.r : 0) ** 2;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < nNodes; i++) {
      const d = (nodes[3 * i] - px) ** 2 + (nodes[3 * i + 1] - py) ** 2 + (nodes[3 * i + 2] - pz) ** 2;
      if (d <= r2) picked.push(i);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (!picked.length && best >= 0) picked.push(best);   // at least the nearest node
  } else if (region?.patch) {
    return patchNodes(model, region.patch);
  } else {
    throw new Error(`Région invalide (${regionLabel(region)}) : attendu { face }, { box }, { near, r } ou { patch }.`);
  }
  return Int32Array.from(picked);
}

/** Nodes of a region, or a French error that names the region when it is empty. */
function pickNodes(model, region) {
  const sel = selectNodes(model, region);
  if (!sel.length && sel.whole) return sel;   // wholly on the side a cut removed : its twin on the kept side answers for it
  if (!sel.length) throw new Error(`La région « ${regionLabel(region)} » ne contient aucun nœud du maillage : déplacez-la sur la pièce ou choisissez une face.`);
  return sel;
}

/** Indices (into exposedFaces) of the exposed cell faces whose 4 nodes are all selected. */
function facesOf(model, sel) {
  const faces = exposedFaces(model), mark = new Uint8Array(model.nNodes), out = [];
  for (const i of sel) mark[i] = 1;
  for (let f = 0; f < faces.count; f++) {
    const o = 4 * f;
    if (mark[faces.nodes[o]] && mark[faces.nodes[o + 1]] && mark[faces.nodes[o + 2]] && mark[faces.nodes[o + 3]]) out.push(f);
  }
  return out;
}

/** The exposed faces of a region that are surfaces of the product ("exterior": all of them) — an empty list when it holds none. */
export function regionFaces(model, region) {
  const faces = exposedFaces(model), cut = cutFaces(model, faces), real = (f) => !cut || !cut[f];
  if (region === "exterior") return Array.from({ length: faces.count }, (_, f) => f).filter(real);
  return facesOf(model, selectNodes(model, region)).filter(real);
}

/** Exposed faces of a region ("exterior": all of them), or a French error when the region holds no complete face. */
function pickFaces(model, region) {
  if (region?.faceList) return Array.from(region.faceList);
  const faces = exposedFaces(model), cut = cutFaces(model, faces), real = (f) => !cut || !cut[f];   // a cut face is inside the product : no pressure, no convection on it
  if (region === "exterior") return Array.from({ length: faces.count }, (_, f) => f).filter(real);
  const sel = pickNodes(model, region), list = facesOf(model, sel).filter(real);
  if (!list.length && sel.whole) return list;
  if (!list.length) throw new Error(`La région « ${regionLabel(region)} » ne couvre aucune face extérieure du maillage : agrandissez-la ou choisissez une face.`);
  return list;
}

/** Size of a region: node count, centroid of its nodes, the box that holds them (lo, hi), exposed area (mm2) and mean outward normal of its faces (or null). */
export function regionInfo(model, region) {
  const sel = selectNodes(model, region), { nodes, grid } = model, centroid = [0, 0, 0], sum = [0, 0, 0], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const i of sel) for (let d = 0; d < 3; d++) { const v = nodes[3 * i + d]; centroid[d] += v; if (v < lo[d]) lo[d] = v; if (v > hi[d]) hi[d] = v; }
  for (let d = 0; d < 3; d++) centroid[d] /= sel.length || 1;
  const faces = exposedFaces(model), list = facesOf(model, sel);
  for (const f of list) for (let d = 0; d < 3; d++) sum[d] += FACE_DIRS[faces.dir[f]][d];
  const len = Math.hypot(sum[0], sum[1], sum[2]);
  return { count: sel.length, centroid, lo, hi, area: list.length * grid.h * grid.h, normal: len > 1e-9 ? sum.map((v) => v / len) : null };
}

/** Largest value of a nodal field as { value, node, at }; `sign` -1 gives the smallest. */
function extreme(model, field, sign = 1) {
  let node = 0;
  for (let i = 1; i < field.length; i++) if (sign * field[i] > sign * field[node]) node = i;
  return { value: field[node], node, at: Array.from(model.nodes.subarray(3 * node, 3 * node + 3)) };
}

function checkConverged(result, maxIter, hint) {
  if (result.converged) return;
  throw new Error(`Le calcul n'a pas convergé après ${result.iterations} itérations (résidu ${result.residual.toExponential(1)}, limite ${maxIter}). ${hint}`);
}

const AXIS = ["X", "Y", "Z"];

/** French sentence for a piece that the supports do not hold (see looseMotion in solve.js). */
function supportError(weak) {
  if (weak.level === 0) return `Le corps « ${weak.body} » n'est relié à aucun appui : fixez-le ou mettez-le en contact avec une pièce tenue.`;
  const names = (axes, word) => axes.map((d) => AXIS[d]).join(` ${word} `), moves = [];
  if (weak.slide.length) moves.push(`glisser le long de ${names(weak.slide, "et")}`);
  if (weak.pivot.length) moves.push(`pivoter autour d'un axe parallèle à ${names(weak.pivot, "ou")}`);
  if (weak.tilted) moves.push("pivoter autour d'un axe incliné");
  const how = weak.level === 1 ? "n'est tenu que par un seul nœud" : weak.level === 2 ? "n'est tenu que par une ligne de nœuds" : "n'est pas assez tenu";
  return `Le corps « ${weak.body} » ${how} : il peut encore ${moves.join(", ") || "bouger"}. Ajoutez des appuis qui bloquent ces mouvements (une face fixée, ou trois plans de glissement perpendiculaires).`;
}

/** Nodal temperature rise T - Tref of a thermal load { T: number | one value per node, Tref = 20 }, or a French error. */
function temperatureRise(model, thermal) {
  const Tref = Number.isFinite(thermal.Tref) ? thermal.Tref : 20, { T } = thermal, theta = new Float64Array(model.nNodes);
  if (typeof T === "number" && Number.isFinite(T)) return theta.fill(T - Tref);
  if (!T || T.length !== model.nNodes) {
    throw new Error(`Charge thermique invalide : il faut une température uniforme ou une température par nœud (${model.nNodes} valeurs attendues, ${T?.length ?? 0} reçues). Refaites le calcul thermique sur ce maillage.`);
  }
  for (let i = 0; i < theta.length; i++) {
    theta[i] = T[i] - Tref;
    if (!Number.isFinite(theta[i])) throw new Error("Charge thermique invalide : une température n'est pas un nombre. Refaites le calcul thermique.");
  }
  return theta;
}

/**
 * Linear static analysis, with optional thermal expansion.
 * @param setup fixed: supports, each a region (the three directions are held) or { region, dofs: [bx, by, bz] } (only the
 *   directions that are true: [true, false, false] is a sliding plane normal to X);
 *   loads: [{ region, force: [Fx, Fy, Fz] }] (total N spread equally on the nodes) or [{ region, pressure }] (MPa on the
 *   exposed faces, pushing into the material); gravity: [gx, gy, gz] in m/s2;
 *   thermal: { T, Tref = 20 } — T in degrees C, one number or one value per node (the T of solveThermal); every body expands
 *   by its material.alpha (1/K) times (T - Tref), T being trilinear in each cell;
 *   loads may also be [{ nodal: { nodes, f } }] — forces already shared out, 3 per node.
 * @returns u (mm), vm (von Mises at the nodes, MPa), vmElem, maxU, maxVm, reaction (N, sum on the held dofs), reactions (the
 *   same per entry of `fixed`), energy (elastic strain energy, N.mm), dofs, iterations, residual, ms, thermal (true when applied).
 */
export function solveStructure(model, setup = {}, onProgress) {
  const t0 = clock(), { tol = 1e-6, maxIter = 20000 } = setup;
  if (!(setup.fixed || []).length) throw new Error("Aucun appui : fixez au moins une face ou une zone de la pièce, sinon elle part en mouvement libre.");
  const sys = structureSystem(model, setup), weak = looseMotion(model, sys.isFixed);
  if (weak) throw new Error(supportError(weak));
  const x = new Float64Array(sys.n), run = pcg({ apply: sys.op.apply, diag: sys.op.diag, b: sys.f, x, fixed: sys.isFixed, tol, maxIter, onProgress });
  checkConverged(run, maxIter, "Vérifiez qu'aucune pièce ne tient que par une arête ou un coin (elle pivoterait), ou augmentez la taille de maille.");
  return { ...structureResults(model, sys, x), iterations: run.iterations, residual: run.residual, ms: clock() - t0 };
}

/** The structural case of a model, assembled and not yet solved : forces `f`, held dofs `isFixed` (and the support that owns each),
    the element of each body, the operator K (never assembled). A part of a larger mesh is assembled the same way (composite.js). */
export function structureSystem(model, { fixed = [], loads = [], gravity, thermal } = {}) {
  const { nNodes, nCells, elems, elemBody, grid: { h } } = model, n = 3 * nNodes;
  const isFixed = new Uint8Array(n), owner = new Int32Array(n).fill(-1), f = new Float64Array(n);
  fixed.forEach((entry, k) => {   // a dof held by several supports reports its reaction to the first one
    const split = entry?.region !== undefined, dofs = split && entry.dofs ? entry.dofs : [true, true, true];
    if (dofs.length !== 3) throw new Error("Appui invalide : « dofs » donne les trois directions tenues, par exemple [true, false, false].");
    for (const i of pickNodes(model, split ? entry.region : entry)) {
      for (let d = 0; d < 3; d++) if (dofs[d] && !isFixed[3 * i + d]) { isFixed[3 * i + d] = 1; owner[3 * i + d] = k; }
    }
  });

  for (const load of loads || []) {
    if (load.nodal) {
      load.nodal.nodes.forEach((i, k) => { for (let d = 0; d < 3; d++) f[3 * i + d] += load.nodal.f[3 * k + d]; });
    } else if (load.force) {   // total force shared equally by the nodes of the region
      const sel = pickNodes(model, load.region), share = sel.whole || sel.length, w = model.cut ? model.cut.weight : null;   // on a reduced model : the share of the whole, halved on a cut plane
      for (const i of sel) for (let d = 0; d < 3; d++) f[3 * i + d] += (load.force[d] / share) * (w ? w[i] : 1);
    } else if (Number.isFinite(load.pressure)) {   // every exposed face pushes -p A n, a quarter on each corner
      const faces = exposedFaces(model);
      for (const face of pickFaces(model, load.region)) {
        const normal = FACE_DIRS[faces.dir[face]], q = (-load.pressure * h * h) / 4;
        for (let c = 0; c < 4; c++) for (let d = 0; d < 3; d++) f[3 * faces.nodes[4 * face + c] + d] += q * normal[d];
      }
    } else {
      throw new Error("Charge invalide : donnez une force [Fx, Fy, Fz] en N ou une pression en MPa.");
    }
  }
  if (gravity) {   // weight of each cell, an eighth on each corner: rho (kg/m3) * 1e-9 = kg/mm3, times m/s2 = N
    for (let e = 0; e < nCells; e++) {
      const w = ((Number(model.bodies[elemBody[e]].material?.rho) || 0) * 1e-9 * h * h * h) / 8;
      for (let a = 0; a < 8; a++) for (let d = 0; d < 3; d++) f[3 * elems[8 * e + a] + d] += w * gravity[d];
    }
  }

  const elements = model.bodies.map((body) => {
    const { E, nu } = body.material || {};
    if (!(E > 0) || !(nu > -1 && nu < 0.5)) throw new Error(`Matériau du corps « ${body.name} » incomplet : il faut un module E > 0 (MPa) et un coefficient de Poisson nu entre -1 et 0,5.`);
    return structureElement(h, E, nu);
  });
  // Thermal expansion: every cell pushes its 8 nodes with alpha Q theta_e (incompatible modes condensed, see hex8.js).
  const theta = thermal ? temperatureRise(model, thermal) : null, fth = theta ? new Float64Array(n) : null;
  const expansion = model.bodies.map((body) => (theta ? Number(body.material?.alpha) || 0 : 0)), te = new Float64Array(8);
  let energy = 0;   // starts with the part of the elastic energy that does not depend on u
  for (let e = 0; theta && e < nCells; e++) {
    const el = elements[elemBody[e]], alpha = expansion[elemBody[e]];
    if (!alpha) continue;
    for (let a = 0; a < 8; a++) te[a] = theta[elems[8 * e + a]];
    for (let i = 0; i < 24; i++) {
      let s = 0;
      for (let b = 0; b < 8; b++) s += el.Q[8 * i + b] * te[b];
      fth[3 * elems[8 * e + Math.floor(i / 3)] + i % 3] += alpha * s;
    }
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) energy += alpha * alpha * te[a] * el.W[8 * a + b] * te[b];
  }
  if (fth) for (let i = 0; i < n; i++) f[i] += fth[i];
  return { n, isFixed, owner, f, fth, theta, te, expansion, elements, energy, supports: fixed.length, op: structureOperator(model, elements.map((el) => el.K)) };
}

/** What a solved structural case says : displacements, stresses, reactions, energy. x : the 3 displacements of every node. */
export function structureResults(model, sys, x) {
  const { nNodes, nCells, elems, elemBody } = model, { n, isFixed, owner, f, fth, theta, te, expansion, elements, op } = sys;
  let energy = sys.energy;
  // Reactions (K u - f on the held dofs) and elastic energy; stresses at the 8 corners of every element, averaged at the nodes.
  const Ku = new Float64Array(n), reaction = [0, 0, 0], reactions = Array.from({ length: sys.supports }, () => [0, 0, 0]);
  op.apply(x, Ku);
  for (let i = 0; i < n; i++) {
    energy += 0.5 * x[i] * Ku[i] - (fth ? x[i] * fth[i] : 0);
    if (isFixed[i]) { reaction[i % 3] += Ku[i] - f[i]; if (owner[i] >= 0) reactions[owner[i]][i % 3] += Ku[i] - f[i]; }      // no owner : a node tied to another mesh, not a support
  }
  const u = Float32Array.from(x), vm = new Float32Array(nNodes), vmElem = new Float32Array(nCells);
  const sum = new Float64Array(nNodes), share = new Uint8Array(nNodes), ue = new Float64Array(24), stress = new Float64Array(6);
  for (let e = 0; e < nCells; e++) {
    const { S, St } = elements[elemBody[e]], alpha = expansion[elemBody[e]];
    for (let a = 0; a < 8; a++) {
      for (let d = 0; d < 3; d++) ue[3 * a + d] = x[3 * elems[8 * e + a] + d];
      if (alpha) te[a] = theta[elems[8 * e + a]];
    }
    let top = 0;
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 6; r++) {   // sigma = D (B u + G a - eps_th) at corner c
        let s = 0;
        for (let j = 0, row = (6 * c + r) * 24; j < 24; j++) s += S[row + j] * ue[j];
        if (alpha) for (let b = 0, row = (6 * c + r) * 8; b < 8; b++) s += alpha * St[row + b] * te[b];
        stress[r] = s;
      }
      const v = vonMises(stress);
      sum[elems[8 * e + c]] += v; share[elems[8 * e + c]]++;
      if (v > top) top = v;
    }
    vmElem[e] = top;
  }
  const mag = new Float32Array(nNodes);
  for (let i = 0; i < nNodes; i++) { vm[i] = sum[i] / share[i]; mag[i] = Math.hypot(x[3 * i], x[3 * i + 1], x[3 * i + 2]); }
  return { u, vm, vmElem, mag, maxU: extreme(model, mag), maxVm: extreme(model, vm), reaction, reactions, energy, dofs: n - isFixed.reduce((s, v) => s + v, 0), ...(theta ? { thermal: true } : {}) };
}

/**
 * Steady-state heat conduction.
 * @param setup fixedT: [{ region, T }] imposed temperatures; power: [{ region, P }] total W spread equally on the nodes;
 *   convection: [{ region, h, Tamb }] on the exposed faces of the region, region "exterior" meaning every exposed face
 *   (h in W/m2.K, Tamb in degrees C) ; power may also be [{ nodal: { nodes, q } }] — watts already shared out, one per node.
 * @returns T (degrees C), maxT, minT, balance { in, out } (W), dofs, iterations, residual, ms.
 */
export function solveThermal(model, setup = {}, onProgress) {
  const t0 = clock(), { tol = 1e-6, maxIter = 20000 } = setup;
  if (!(setup.fixedT || []).length && !(setup.convection || []).length) throw new Error("Température indéfinie : imposez une température sur une zone ou ajoutez une convection, sinon la chaleur n'a aucune sortie.");
  const sys = thermalSystem(model, setup), loose = unmarkedBody(model, sys.anchored);
  if (loose !== null) throw new Error(`Le corps « ${loose} » n'a ni température imposée ni convection et ne touche aucune pièce qui en a : sa température est indéfinie.`);
  const run = pcg({ apply: sys.op.apply, diag: sys.op.diag, b: sys.b, x: sys.x, fixed: sys.isFixed, tol, maxIter, onProgress });
  checkConverged(run, maxIter, "Vérifiez les conductivités et les conditions aux limites, ou augmentez la taille de maille.");
  return { ...thermalResults(model, sys, sys.x), iterations: run.iterations, residual: run.residual, ms: clock() - t0 };
}

/** The thermal case of a model, assembled and not yet solved : right-hand side `b`, imposed temperatures (`isFixed`, their values in
    `x`, which starts from a plausible uniform temperature elsewhere), the convection of each node, the operator. */
export function thermalSystem(model, { fixedT = [], power = [], convection = [] } = {}) {
  const { nNodes, grid: { h } } = model;
  const isFixed = new Uint8Array(nNodes), x = new Float64Array(nNodes), b = new Float64Array(nNodes);
  const film = new Float64Array(nNodes), filmT = new Float64Array(nNodes);   // lumped h A and h A Tamb of each node
  let powerIn = 0, guess = 0, weight = 0;

  for (const item of power) {
    if (item.nodal) { item.nodal.nodes.forEach((i, k) => { b[i] += item.nodal.q[k]; powerIn += item.nodal.q[k]; }); continue; }
    const sel = pickNodes(model, item.region), share = sel.whole || sel.length, w = model.cut ? model.cut.weight : null;
    let got = 0; for (const i of sel) { const q = (item.P / share) * (w ? w[i] : 1); b[i] += q; got += q; }
    powerIn += w ? got : item.P;   // on a reduced model : what its side receives
  }
  const faces = exposedFaces(model);
  for (const item of convection) {
    if (!(item.h >= 0) || !Number.isFinite(item.Tamb)) throw new Error("Convection invalide : donnez h (W/m².K) et la température ambiante Tamb (°C).");
    const quarter = ((item.h / 1e6) * h * h) / 4;   // W/m2.K -> W/mm2.K, a quarter of the face on each corner
    for (const face of pickFaces(model, item.region)) {
      for (let c = 0; c < 4; c++) { film[faces.nodes[4 * face + c]] += quarter; filmT[faces.nodes[4 * face + c]] += quarter * item.Tamb; }
      guess += 4 * quarter * item.Tamb; weight += 4 * quarter;
    }
  }
  for (const item of fixedT) {
    if (!Number.isFinite(item.T)) throw new Error("Température imposée invalide : donnez T en °C.");
    const sel = pickNodes(model, item.region);
    for (const i of sel) { isFixed[i] = 1; x[i] = item.T; }
    guess += item.T; weight += 1;
  }
  for (let i = 0; i < nNodes; i++) b[i] += filmT[i];

  const cond = model.bodies.map((body) => {
    const k = Number(body.material?.k);
    if (!(k > 0)) throw new Error(`Matériau du corps « ${body.name} » incomplet : il faut une conductivité thermique k > 0 (W/m.K).`);
    return k / 1000;   // W/m.K -> W/mm.K
  });
  const anchored = Uint8Array.from(isFixed);
  for (let i = 0; i < nNodes; i++) if (film[i] > 0) anchored[i] = 1;

  // Start from a uniform, plausible temperature: it removes most of the slow "everything warms up together" mode.
  const start = weight > 0 ? guess / weight : null;
  for (let i = 0; i < nNodes; i++) if (!isFixed[i]) x[i] = start ?? 0;
  return { n: nNodes, isFixed, x, b, film, filmT, powerIn, anchored, start, op: thermalOperator(model, conductionElement(h), cond, film) };
}

/** What a solved thermal case says : temperatures and heat balance. x : the temperature of every node. */
export function thermalResults(model, sys, x) {
  const { nNodes } = model, { isFixed, b, film, filmT, powerIn, op } = sys;
  // Heat leaving: by convection, and through the imposed-temperature nodes (the residual there is the heat they supply).
  const AT = new Float64Array(nNodes);
  op.apply(x, AT);
  let out = 0;
  for (let i = 0; i < nNodes; i++) {
    out += film[i] * x[i] - filmT[i];
    if (isFixed[i]) out -= AT[i] - b[i];
  }
  const T = Float32Array.from(x);
  return { T, maxT: extreme(model, T), minT: extreme(model, T, -1), balance: { in: powerIn, out }, dofs: nNodes - isFixed.reduce((s, v) => s + v, 0) };
}
