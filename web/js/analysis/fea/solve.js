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

const bodyOf = (model, e) => model.bodies[model.elemBody[e]].name ?? `n° ${model.elemBody[e] + 1}`;

/** Name of the first body that has a piece without any marked node (mark: Uint8Array per node), or null. */
export function unmarkedBody(model, mark) {
  const { piece, count } = meshPieces(model), has = new Uint8Array(count);
  for (let i = 0; i < model.nNodes; i++) if (mark[i]) has[piece[i]] = 1;
  for (let e = 0; e < model.nCells; e++) if (!has[piece[model.elems[8 * e]]]) return bodyOf(model, e);
  return null;
}

/** Eigenvalues and eigenvectors of a small symmetric n x n matrix (cyclic Jacobi rotations). A is destroyed; column j of `vectors` goes with values[j]. */
function symmetricEigen(A, n) {
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0, all = 0;
    for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) { all += A[p * n + q] ** 2; if (p !== q) off += A[p * n + q] ** 2; }
    if (off <= 1e-28 * all) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = A[p * n + q];
      if (apq === 0) continue;
      const theta = (A[q * n + q] - A[p * n + p]) / (2 * apq);
      const t = (theta < 0 ? -1 : 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {   // A <- J^T A J and V <- V J, J being the rotation in the plane (p, q)
        const akp = A[k * n + p], akq = A[k * n + q], vkp = V[k * n + p], vkq = V[k * n + q];
        A[k * n + p] = c * akp - s * akq; A[k * n + q] = s * akp + c * akq;
        V[k * n + p] = c * vkp - s * vkq; V[k * n + q] = s * vkp + c * vkq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p * n + k], aqk = A[q * n + k];
        A[p * n + k] = c * apk - s * aqk; A[q * n + k] = s * apk + c * aqk;
      }
    }
  }
  return { values: Array.from({ length: n }, (_, i) => A[i * n + i]), vectors: V };
}

/**
 * Checks that the held dofs remove the six rigid-body motions of every connected piece of the mesh.
 * The six motions (3 translations, 3 rotations about the centroid of the held nodes) are written on the held dofs of a
 * piece; a combination that is zero on all of them is a motion the supports do not see, i.e. a null vector of the 6 x 6
 * Gram matrix. Mechanisms inside a piece (cells linked by one edge) are not seen here: the solver reports them.
 * @param isFixed Uint8Array(3 * nNodes), 1 on the held dofs
 * @returns null, or for the first loose piece { body, level, slide, pivot, tilted } — level 0: no support at all, 1: a single
 *   held node, 2: held nodes on one line, 3: other; slide: axes (0, 1, 2) it can translate along; pivot: axes it can rotate
 *   about (an axis parallel to them); tilted: it can also rotate about an axis that is not parallel to X, Y or Z.
 */
export function looseMotion(model, isFixed) {
  const { nodes, nNodes, elems, nCells } = model, { piece, count } = meshPieces(model);
  const anyHeld = (i) => isFixed[3 * i] || isFixed[3 * i + 1] || isFixed[3 * i + 2];
  const heldNodes = new Int32Array(count), centre = new Float64Array(3 * count);
  for (let i = 0; i < nNodes; i++) {
    if (!anyHeld(i)) continue;
    heldNodes[piece[i]]++;
    for (let d = 0; d < 3; d++) centre[3 * piece[i] + d] += nodes[3 * i + d];
  }
  const gram = new Float64Array(36 * count), spread = new Float64Array(9 * count), row = new Float64Array(6), q = [0, 0, 0];
  for (let i = 0; i < nNodes; i++) {
    if (!anyHeld(i)) continue;
    const p = piece[i];
    for (let d = 0; d < 3; d++) q[d] = nodes[3 * i + d] - centre[3 * p + d] / heldNodes[p];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) spread[9 * p + 3 * a + b] += q[a] * q[b];
    for (let d = 0; d < 3; d++) {
      if (!isFixed[3 * i + d]) continue;
      // displacement along d of the six motions: translation k gives delta_dk, rotation about axis k gives (e_k x q)_d
      row.fill(0);
      row[d] = 1; row[3 + (d + 1) % 3] = q[(d + 2) % 3]; row[3 + (d + 2) % 3] = -q[(d + 1) % 3];
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) gram[36 * p + 6 * a + b] += row[a] * row[b];
    }
  }
  const seen = new Uint8Array(count);
  for (let e = 0; e < nCells; e++) {
    const p = piece[elems[8 * e]];
    if (seen[p]) continue;
    seen[p] = 1;
    if (!heldNodes[p]) return { body: bodyOf(model, e), level: 0, slide: [0, 1, 2], pivot: [0, 1, 2], tilted: false };
    const S = spread.slice(9 * p, 9 * p + 9), G = gram.slice(36 * p, 36 * p + 36);
    const scale = 1 / Math.sqrt((S[0] + S[4] + S[8]) / heldNodes[p] || 1);   // rotations in units of the support size
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) G[6 * a + b] *= (a < 3 ? 1 : scale) * (b < 3 ? 1 : scale);
    const { values, vectors } = symmetricEigen(G, 6), limit = 1e-9 * values.reduce((s, v) => s + v, 0);
    const free = [0, 1, 2, 3, 4, 5].filter((j) => values[j] <= limit);
    if (!free.length) continue;   // rank 6: the piece is held
    const turn = new Float64Array(9);   // directions of the free rotations: sum of omega omega^T over the free motions
    for (const j of free) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) turn[3 * a + b] += vectors[6 * (3 + a) + j] * vectors[6 * (3 + b) + j];
    const axes = symmetricEigen(turn, 3), span = [0, 1, 2].filter((j) => axes.values[j] > 1e-8);
    const pivot = [0, 1, 2].filter((d) => span.reduce((s, j) => s + axes.vectors[3 * d + j] ** 2, 0) > 0.99);
    const extent = symmetricEigen(S, 3).values.sort((a, b) => b - a);
    return {
      body: bodyOf(model, e), level: heldNodes[p] === 1 ? 1 : extent[1] <= 1e-9 * extent[0] ? 2 : 3,
      slide: [0, 1, 2].filter((d) => gram[36 * p + 7 * d] === 0), pivot, tilted: span.length > pivot.length,
    };
  }
  return null;
}
