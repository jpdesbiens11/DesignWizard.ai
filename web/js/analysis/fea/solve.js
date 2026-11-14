// Matrix-free solver of the simplified finite-element brick: the global matrix is never assembled. The product A x is
// accumulated element by element (y += Ke x_e) with the one element matrix of each material, and the system is solved by
// a conjugate gradient preconditioned by the diagonal (Jacobi). Memory stays proportional to the number of nodes.

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Preconditioned conjugate gradient for A x = b, A symmetric positive definite on the free dofs.
 * Imposed (Dirichlet) dofs keep the value they have in x: they are zeroed in the residual and in the search direction.
 * @param apply  (x, y) => y = A x on ALL the dofs
 * @param diag   diagonal of A (Float64Array)
 * @param b      right-hand side (Float64Array)
 * @param x      Float64Array, in: imposed values and initial guess, out: solution
 * @param fixed  Uint8Array, 1 on the imposed dofs
 * @param onProgress optional ({ iteration, residual, maxIter }) called every 50 iterations
 * @returns {{iterations: number, residual: number, converged: boolean, ms: number}} residual = |r| / |r0|, r0 being the residual
 *   of the problem with zero on the free dofs (the reduced right-hand side).
 */
export function pcg({ apply, diag, b, x, fixed, tol = 1e-6, maxIter = 20000, onProgress }) {
  const t0 = clock(), n = b.length;
  const r = new Float64Array(n), z = new Float64Array(n), p = new Float64Array(n), q = new Float64Array(n), inv = new Float64Array(n);
  for (let i = 0; i < n; i++) { inv[i] = fixed[i] || !(diag[i] > 0) ? 0 : 1 / diag[i]; p[i] = fixed[i] ? x[i] : 0; }

  apply(p, q);   // reference: the load seen by the free dofs once the imposed values are moved to the right-hand side
  let ref = 0;
  for (let i = 0; i < n; i++) if (!fixed[i]) ref += (b[i] - q[i]) * (b[i] - q[i]);
  ref = Math.sqrt(ref);
  if (ref === 0) {   // nothing drives the free dofs
    for (let i = 0; i < n; i++) if (!fixed[i]) x[i] = 0;
    return { iterations: 0, residual: 0, converged: true, ms: clock() - t0 };
  }

  apply(x, q);
  let rz = 0, rr = 0;
  for (let i = 0; i < n; i++) {
    r[i] = fixed[i] ? 0 : b[i] - q[i];
    z[i] = inv[i] * r[i]; p[i] = z[i];
    rz += r[i] * z[i]; rr += r[i] * r[i];
  }
  let residual = Math.sqrt(rr) / ref, iterations = 0;
  while (residual > tol && iterations < maxIter) {
    apply(p, q);
    let pq = 0;
    for (let i = 0; i < n; i++) pq += p[i] * q[i];   // p is zero on the imposed dofs
    if (!(pq > 0)) break;   // not positive definite: a mechanism (missing support) or a breakdown
    const alpha = rz / pq;
    let rzNew = 0;
    rr = 0;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      if (fixed[i]) continue;
      const ri = r[i] - alpha * q[i];
      r[i] = ri; z[i] = inv[i] * ri;
      rr += ri * ri; rzNew += ri * z[i];
    }
    const beta = rzNew / rz;
    rz = rzNew;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
    iterations++;
    residual = Math.sqrt(rr) / ref;
    if (onProgress && iterations % 50 === 0) onProgress({ iteration: iterations, residual, maxIter });
  }
  return { iterations, residual, converged: residual <= tol, ms: clock() - t0 };
}

/**
 * Structural operator: y = K u, 3 dofs per node, K never assembled.
 * @param stiffness one 24 x 24 element matrix per body (Float64Array(576), see hex8.js)
 * @returns {{apply: Function, diag: Float64Array}}
 */
export function structureOperator(model, stiffness) {
  const { elems, elemBody, nCells, nNodes } = model;
  const xe = new Float64Array(24), diag = new Float64Array(3 * nNodes);
  for (let e = 0; e < nCells; e++) {
    const K = stiffness[elemBody[e]];
    for (let a = 0; a < 8; a++) for (let c = 0; c < 3; c++) diag[3 * elems[8 * e + a] + c] += K[25 * (3 * a + c)];
  }
  function apply(x, y) {
    y.fill(0);
    for (let e = 0, o = 0; e < nCells; e++, o += 8) {
      const K = stiffness[elemBody[e]];
      for (let a = 0, i = 0; a < 8; a++, i += 3) {   // gather the 24 element dofs
        const d = 3 * elems[o + a];
        xe[i] = x[d]; xe[i + 1] = x[d + 1]; xe[i + 2] = x[d + 2];
      }
      for (let a = 0, row = 0; a < 8; a++) {   // y_e = Ke x_e, scattered three rows (one node) at a time
        let s0 = 0, s1 = 0, s2 = 0;
        for (let j = 0; j < 24; j++) s0 += K[row + j] * xe[j];
        row += 24;
        for (let j = 0; j < 24; j++) s1 += K[row + j] * xe[j];
        row += 24;
        for (let j = 0; j < 24; j++) s2 += K[row + j] * xe[j];
        row += 24;
        const d = 3 * elems[o + a];
        y[d] += s0; y[d + 1] += s1; y[d + 2] += s2;
      }
    }
  }
  return { apply, diag };
}

/**
 * Thermal operator: y = (K_conduction + H) T, one dof per node.
 * @param unit  8 x 8 conduction matrix of the cell for a unit conductivity (hex8.js)
 * @param cond  conductivity of each body in W/mm.K
 * @param film  Float64Array(nNodes): lumped convection conductance of each node (W/K), zero away from the cooled faces
 */
export function thermalOperator(model, unit, cond, film) {
  const { elems, elemBody, nCells, nNodes } = model;
  const xe = new Float64Array(8), diag = Float64Array.from(film);
  for (let e = 0; e < nCells; e++) for (let a = 0; a < 8; a++) diag[elems[8 * e + a]] += cond[elemBody[e]] * unit[9 * a];
  function apply(x, y) {
    for (let i = 0; i < nNodes; i++) y[i] = film[i] * x[i];
    for (let e = 0, o = 0; e < nCells; e++, o += 8) {
      const k = cond[elemBody[e]];
      for (let a = 0; a < 8; a++) xe[a] = x[elems[o + a]];
      for (let a = 0, row = 0; a < 8; a++, row += 8) {
        let s = 0;
        for (let j = 0; j < 8; j++) s += unit[row + j] * xe[j];
        y[elems[o + a]] += k * s;
      }
    }
  }
  return { apply, diag };
}

/**
 * Connected pieces of the mesh (cells that share at least one node). A piece that holds no support cannot be solved.
 * @returns {{piece: Int32Array, count: number}} piece index of every node
 */
export function meshPieces(model) {
  const { elems, nCells, nNodes } = model, parent = new Int32Array(nNodes);
  for (let i = 0; i < nNodes; i++) parent[i] = i;
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (let e = 0; e < nCells; e++) {
    const root = find(elems[8 * e]);
    for (let a = 1; a < 8; a++) parent[find(elems[8 * e + a])] = root;
  }
  const piece = new Int32Array(nNodes).fill(-1);
  let count = 0;
  for (let i = 0; i < nNodes; i++) {
    const root = find(i);
    if (piece[root] < 0) piece[root] = count++;
    piece[i] = piece[root];
  }
  return { piece, count };
}

/**
 * Looks for a piece of the mesh that the marked nodes do not hold.
 * @param mark  Uint8Array per node: the supports (structure) or the nodes with a way out for the heat (thermal)
 * @param rigid true for structure: the marked nodes of a piece must not all lie on one line, or the piece pivots about it
 * @returns null, or { body, level } for the first weak piece — level 0: no marked node, 1: a single node, 2: nodes on one line
 */
export function weakPiece(model, mark, rigid) {
  const { nodes, nNodes, elems, nCells } = model, { piece, count } = meshPieces(model);
  const level = new Uint8Array(count), first = new Int32Array(count), second = new Int32Array(count);
  for (let i = 0; i < nNodes; i++) {
    if (!mark[i]) continue;
    const p = piece[i];
    if (level[p] === 0) { level[p] = rigid ? 1 : 3; first[p] = i; }
    else if (level[p] === 1) { level[p] = 2; second[p] = i; }
    else if (level[p] === 2) {   // a third node off the line of the first two holds the piece
      const a = 3 * first[p], b = 3 * second[p], c = 3 * i;
      const ux = nodes[b] - nodes[a], uy = nodes[b + 1] - nodes[a + 1], uz = nodes[b + 2] - nodes[a + 2];
      const vx = nodes[c] - nodes[a], vy = nodes[c + 1] - nodes[a + 1], vz = nodes[c + 2] - nodes[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz > 1e-9 * (ux * ux + uy * uy + uz * uz) * (vx * vx + vy * vy + vz * vz)) level[p] = 3;
    }
  }
  for (let e = 0; e < nCells; e++) {
    const p = piece[elems[8 * e]];
    if (level[p] < 3) return { body: model.bodies[model.elemBody[e]].name ?? `n° ${model.elemBody[e] + 1}`, level: level[p] };
  }
  return null;
}
