// Element matrices of the voxel mesh. Every cell is the same cube of side h, so each matrix is computed ONCE per material
// and reused for all the cells (matrix-free solver). Units: mm, N, MPa, W, degrees C.
//
// Structure: 8-node hexahedron with incompatible modes (Wilson, Taylor). The trilinear field alone locks in bending
// (parasitic shear); nine internal "bubble" dofs — 1 - xi^2, 1 - eta^2, 1 - zeta^2 for each displacement component — remove
// that. They are condensed out element by element: K = Kuu - Kua Kaa^-1 Kau. On an undistorted brick the element passes
// the patch test and reproduces pure bending exactly, even with a single element through the thickness.
// Thermal: plain 8-node trilinear conduction element.
// Thermal expansion: the strain alpha (T - Tref) is a load of the structural element, written for the nodal AND the
// internal dofs so that the incompatible modes stay consistent (free thermal bending is then exact as well).

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

/** Values of the 8 trilinear shape functions at the natural point p. */
function shapeValues(p, N) {
  for (let a = 0; a < 8; a++) N[a] = ((1 + CORNERS[a][0] * p[0]) * (1 + CORNERS[a][1] * p[1]) * (1 + CORNERS[a][2] * p[2])) / 8;
  return N;
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
 * @returns {{K: Float64Array, R: Float64Array, S: Float64Array, Q: Float64Array, P: Float64Array, St: Float64Array, W: Float64Array}}
 *   K (24 x 24, N/mm): condensed stiffness;
 *   R (9 x 24): recovery of the internal dofs, alpha = R u_e (= -Kaa^-1 Kau u_e);
 *   S (48 x 24, MPa/mm): stresses at the 8 corners, 6 Voigt components each, INCLUDING the incompatible strains
 *   (sigma of corner c = rows 6c .. 6c + 5 of S times u_e). Stresses are read at the corners because the centre of an
 *   element sees no bending stress.
 *   Thermal expansion, for theta_e = the 8 corner values of T - Tref and the expansion coefficient alpha (1/K):
 *   Q (24 x 8, N): condensed nodal forces, f_e = alpha Q theta_e (= f_u - Kua Kaa^-1 f_a);
 *   P (9 x 8, mm): thermal part of the internal dofs, alpha_int = R u_e + alpha P theta_e (= Kaa^-1 (f_a - Kau u_e));
 *   St (48 x 8, MPa): thermal part of the corner stresses, sigma = S u_e + alpha St theta_e (= D (B u + G a - eps_th));
 *   W (8 x 8, N.mm): elastic energy of the element = 1/2 u_e K u_e - u_e f_e + alpha^2 theta_e W theta_e.
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

  // Thermal strain: eps_th = alpha theta [1 1 1 0 0 0] with theta trilinear, so D eps_th = alpha theta E / (1 - 2 nu) [1 1 1 0 0 0].
  // Fu = integral of B^T D eps_th and Fa = integral of G^T D eps_th per unit alpha, as functions of the 8 corner values of theta.
  const modulus = E / (1 - 2 * nu), N = new Float64Array(8);
  const Fu = new Float64Array(192), Fa = new Float64Array(72), mass = new Float64Array(64);
  for (const p of gaussPoints()) {
    strainB(p, h, B, grad); strainG(p, h, G); shapeValues(p, N);
    for (let b = 0; b < 8; b++) {
      for (let i = 0; i < 24; i++) Fu[8 * i + b] += w * modulus * (B[i] + B[24 + i] + B[48 + i]) * N[b];
      for (let i = 0; i < 9; i++) Fa[8 * i + b] += w * modulus * (G[i] + G[9 + i] + G[18 + i]) * N[b];
      for (let a = 0; a < 8; a++) mass[8 * a + b] += w * N[a] * N[b];
    }
  }
  const P = new Float64Array(72), Q = Float64Array.from(Fu), W = new Float64Array(64);
  for (let b = 0; b < 8; b++) {
    for (let i = 0; i < 9; i++) for (let k = 0; k < 9; k++) P[8 * i + b] += KaaInv[9 * i + k] * Fa[8 * k + b];   // P = Kaa^-1 Fa
    for (let i = 0; i < 24; i++) for (let k = 0; k < 9; k++) Q[8 * i + b] += R[24 * k + i] * Fa[8 * k + b];     // Q = Fu + R^T Fa
  }
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {   // 1/2 integral of eps_th D eps_th, minus 1/2 f_a Kaa^-1 f_a
    let s = 1.5 * modulus * mass[8 * a + b];
    for (let k = 0; k < 9; k++) s -= 0.5 * Fa[8 * k + a] * P[8 * k + b];
    W[8 * a + b] = s;
  }

  const S = new Float64Array(48 * 24), St = new Float64Array(48 * 8), strain = new Float64Array(144);
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
    for (let r = 0; r < 6; r++) for (let b = 0; b < 8; b++) {   // D (G P theta_e - eps_th): theta at corner c is theta_e[c]
      let s = r < 3 && b === c ? -modulus : 0;
      for (let q = 0; q < 6; q++) for (let k = 0; k < 9; k++) s += D[6 * r + q] * G[9 * q + k] * P[8 * k + b];
      St[(6 * c + r) * 8 + b] = s;
    }
  }
  return { K, R, S, Q, P, St, W };
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
