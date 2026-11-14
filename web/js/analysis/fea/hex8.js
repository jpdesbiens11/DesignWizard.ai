// Element matrices of the voxel mesh. Every cell is the same cube of side h, so each matrix is computed ONCE per material
// and reused for all the cells (matrix-free solver). Units: mm, N, MPa, W, degrees C.
//
// Structure: 8-node hexahedron with incompatible modes (Wilson, Taylor). The trilinear field alone locks in bending
// (parasitic shear); nine internal "bubble" dofs — 1 - xi^2, 1 - eta^2, 1 - zeta^2 for each displacement component — remove
// that. They are condensed out element by element: K = Kuu - Kua Kaa^-1 Kau. On an undistorted brick the element passes
// the patch test and reproduces pure bending exactly, even with a single element through the thickness.
// Thermal: plain 8-node trilinear conduction element.

const GAUSS = 1 / Math.sqrt(3);   // 2 x 2 x 2 Gauss rule, unit weights: exact for every product integrated here

/** Natural coordinates of the 8 corners, standard order: bottom face counter-clockwise, then top face. */
export const CORNERS = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];

function gaussPoints() {
  const points = [];
  for (const z of [-GAUSS, GAUSS]) for (const y of [-GAUSS, GAUSS]) for (const x of [-GAUSS, GAUSS]) points.push([x, y, z]);
  return points;
}

/**
 * Fills column `col` of a 6 x `cols` strain matrix with the strains of displacement component c (0, 1, 2) whose
 * gradient is (gx, gy, gz). Voigt order: exx, eyy, ezz, gamma_xy, gamma_yz, gamma_zx (engineering shear).
 */
function strainColumn(M, cols, col, c, gx, gy, gz) {
  if (c === 0) { M[col] = gx; M[3 * cols + col] = gy; M[5 * cols + col] = gz; }
  else if (c === 1) { M[cols + col] = gy; M[3 * cols + col] = gx; M[4 * cols + col] = gz; }
  else { M[2 * cols + col] = gz; M[4 * cols + col] = gy; M[5 * cols + col] = gx; }
}

/** Gradients (per mm) of the 8 trilinear shape functions at the natural point p. The Jacobian of the cube is (h / 2) I. */
function shapeGradients(p, h, grad) {
  const s = 2 / h;
  for (let a = 0; a < 8; a++) {
    const [xa, ya, za] = CORNERS[a], fx = 1 + xa * p[0], fy = 1 + ya * p[1], fz = 1 + za * p[2];
    grad[3 * a] = (s * xa * fy * fz) / 8; grad[3 * a + 1] = (s * ya * fx * fz) / 8; grad[3 * a + 2] = (s * za * fx * fy) / 8;
  }
  return grad;
}

/** B (6 x 24): strains of the nodal displacements at the natural point p. */
function strainB(p, h, B, grad) {
  shapeGradients(p, h, grad);
  B.fill(0);
  for (let a = 0; a < 8; a++) for (let c = 0; c < 3; c++) strainColumn(B, 24, 3 * a + c, c, grad[3 * a], grad[3 * a + 1], grad[3 * a + 2]);
}

/** G (6 x 9): strains of the incompatible modes at p. Mode m is 1 - (natural coordinate m)^2: its gradient is along axis m only. */
function strainG(p, h, G) {
  G.fill(0);
  for (let m = 0; m < 3; m++) {
    const g = [0, 0, 0];
    g[m] = (-2 * p[m] * 2) / h;
    for (let c = 0; c < 3; c++) strainColumn(G, 9, 3 * m + c, c, g[0], g[1], g[2]);
  }
}

/** Isotropic elasticity matrix D (6 x 6), stress = D strain. E in MPa. */
export function elasticity(E, nu) {
  const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu)), mu = E / (2 * (1 + nu)), D = new Float64Array(36);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) D[6 * i + j] = lambda + (i === j ? 2 * mu : 0);
    D[7 * (i + 3)] = mu;
  }
  return D;
}

/** K (na x nb) += w * A^T D B, with A (6 x na) and B (6 x nb). */
function addAtDB(K, A, na, D, B, nb, w) {
  const DB = new Float64Array(6 * nb);
  for (let r = 0; r < 6; r++) for (let j = 0; j < nb; j++) {
    let s = 0;
    for (let q = 0; q < 6; q++) s += D[6 * r + q] * B[nb * q + j];
    DB[nb * r + j] = s;
  }
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
    let s = 0;
    for (let r = 0; r < 6; r++) s += A[na * r + i] * DB[nb * r + j];
    K[nb * i + j] += w * s;
  }
}

/** Inverse of a small dense n x n matrix (Gauss-Jordan with partial pivoting). */
function invert(A, n) {
  const M = Float64Array.from(A), inv = new Float64Array(n * n);
  for (let i = 0; i < n; i++) inv[i * n + i] = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r * n + col]) > Math.abs(M[pivot * n + col])) pivot = r;
    if (M[pivot * n + col] === 0) throw new Error("Matrice élémentaire singulière : vérifiez le matériau (E, nu).");
    for (let j = 0; j < n; j++) {
      [M[col * n + j], M[pivot * n + j]] = [M[pivot * n + j], M[col * n + j]];
      [inv[col * n + j], inv[pivot * n + j]] = [inv[pivot * n + j], inv[col * n + j]];
    }
    const d = 1 / M[col * n + col];
    for (let j = 0; j < n; j++) { M[col * n + j] *= d; inv[col * n + j] *= d; }
    for (let r = 0; r < n; r++) {
      const f = M[r * n + col];
      if (r === col || f === 0) continue;
      for (let j = 0; j < n; j++) { M[r * n + j] -= f * M[col * n + j]; inv[r * n + j] -= f * inv[col * n + j]; }
    }
  }
  return inv;
}

/**
 * Structural element of a cube of side h (mm), material E (MPa), nu. Dof order: ux, uy, uz of corner 0, then corner 1, ...
 * @returns {{K: Float64Array, R: Float64Array, S: Float64Array}}
 *   K (24 x 24, N/mm): condensed stiffness;
 *   R (9 x 24): recovery of the internal dofs, alpha = R u_e (= -Kaa^-1 Kau u_e);
 *   S (48 x 24, MPa/mm): stresses at the 8 corners, 6 Voigt components each, INCLUDING the incompatible strains
 *   (sigma of corner c = rows 6c .. 6c + 5 of S times u_e). Stresses are read at the corners because the centre of an
 *   element sees no bending stress.
 */
export function structureElement(h, E, nu) {
  const D = elasticity(E, nu), w = (h * h * h) / 8;   // det J = (h / 2)^3, Gauss weights 1
  const B = new Float64Array(144), G = new Float64Array(54), grad = new Float64Array(24);
  const Kuu = new Float64Array(576), Kua = new Float64Array(216), Kaa = new Float64Array(81);
  for (const p of gaussPoints()) {
    strainB(p, h, B, grad); strainG(p, h, G);
    addAtDB(Kuu, B, 24, D, B, 24, w); addAtDB(Kua, B, 24, D, G, 9, w); addAtDB(Kaa, G, 9, D, G, 9, w);
  }
  const KaaInv = invert(Kaa, 9), R = new Float64Array(216);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 24; j++) {   // R = -Kaa^-1 Kau, with Kau = Kua^T
    let s = 0;
    for (let k = 0; k < 9; k++) s += KaaInv[9 * i + k] * Kua[9 * j + k];
    R[24 * i + j] = -s;
  }
  const K = Float64Array.from(Kuu);
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {   // static condensation: K = Kuu + Kua R
    let s = 0;
    for (let k = 0; k < 9; k++) s += Kua[9 * i + k] * R[24 * k + j];
    K[24 * i + j] += s;
  }
  for (let i = 0; i < 24; i++) for (let j = i + 1; j < 24; j++) K[24 * i + j] = K[24 * j + i] = (K[24 * i + j] + K[24 * j + i]) / 2;

  const S = new Float64Array(48 * 24), strain = new Float64Array(144);
  for (let c = 0; c < 8; c++) {
    strainB(CORNERS[c], h, B, grad); strainG(CORNERS[c], h, G);
    for (let r = 0; r < 6; r++) for (let j = 0; j < 24; j++) {   // strain = (B + G R) u_e
      let s = B[24 * r + j];
      for (let k = 0; k < 9; k++) s += G[9 * r + k] * R[24 * k + j];
      strain[24 * r + j] = s;
    }
    for (let r = 0; r < 6; r++) for (let j = 0; j < 24; j++) {
      let s = 0;
      for (let q = 0; q < 6; q++) s += D[6 * r + q] * strain[24 * q + j];
      S[(6 * c + r) * 24 + j] = s;
    }
  }
  return { K, R, S };
}

/** Conduction matrix (8 x 8) of a cube of side h (mm) for a UNIT conductivity: multiply by k in W/mm.K to get W/K. */
export function conductionElement(h) {
  const K = new Float64Array(64), grad = new Float64Array(24), w = (h * h * h) / 8;
  for (const p of gaussPoints()) {
    shapeGradients(p, h, grad);
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
      K[8 * a + b] += w * (grad[3 * a] * grad[3 * b] + grad[3 * a + 1] * grad[3 * b + 1] + grad[3 * a + 2] * grad[3 * b + 2]);
    }
  }
  return K;
}

/** Von Mises equivalent stress of the 6 Voigt components starting at s[o]: xx, yy, zz, xy, yz, zx. */
export function vonMises(s, o = 0) {
  const a = s[o] - s[o + 1], b = s[o + 1] - s[o + 2], c = s[o + 2] - s[o];
  return Math.sqrt(0.5 * (a * a + b * b + c * c) + 3 * (s[o + 3] * s[o + 3] + s[o + 4] * s[o + 4] + s[o + 5] * s[o + 5]));
}
