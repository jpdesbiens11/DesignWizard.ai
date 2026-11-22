/* DynamiteOrbit — the reference cases of the simulation (validation.js runs them, as it runs those of the analytical models).
   The same rule : a worked example somebody else published, read on its page, replayed by the SOLVER — a small mesh of cubes
   built here, the conditions of the example, and the printed result compared with what the solver finds. The mesh of each case
   is said (`mesh`) : the gap of a simulation is also the gap of its mesh, and a case chosen fine enough to hide it would say
   nothing. Each solves in the page in two seconds at most. Pure : no page. */

import { buildModel, selectNodes, solveStructure, solveThermal, thermalSystem } from "./fea/index.js";

const IN = 25.4, LBF = 4.4482216152605, PSI = 0.006894757293168;
const OX = (book, page, where) => ({ name: `OpenStax, ${book}`, where, url: `https://openstax.org/books/${page}`, read: "read", licence: "CC BY-NC-SA 4.0" });

/** A closed box : 8 vertices, 12 triangles, outward winding. */
export function boxMesh(x0, y0, z0, x1, y1, z1) {
  return { pos: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]),
    idx: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) };
}
/** A closed cylinder of axis X, from x0 to x1, of radius r about (cy, cz). */
export function rodMesh(x0, x1, cy, cz, r, n = 96) {
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, y = cy + r * Math.cos(a), z = cz + r * Math.sin(a); pos.push(x0, y, z, x1, y, z); }
  pos.push(x0, cy, cz, x1, cy, cz);
  for (let i = 0; i < n; i++) { const b0 = 2 * i, t0 = b0 + 1, b1 = 2 * ((i + 1) % n), t1 = b1 + 1; idx.push(b0, b1, t1, b0, t1, t0, 2 * n, b1, b0, 2 * n + 1, t0, t1); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const mean = (field, sel, stride = 1, offset = 0) => { let s = 0; for (const i of sel) s += field[stride * i + offset]; return s / sel.length; };
const slide = (face, axis) => ({ region: { face }, dofs: [axis === 0, axis === 1, axis === 2] });      // a face held along one axis only

export const FEA_CASES = [
  { id: "fea-two-rods", kind: "fea", model: "fea:thermal", how: "direct", title: "Barreau d'acier et barreau d'aluminium bout à bout, de 100 °C à 20 °C",
    source: OX("University Physics, Volume 2", "university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer", "§ 1.6, Example 1.11"),
    given: ["deux barreaux de 25,0 cm, aire 7,85 × 10⁻⁵ m², isolés sur leur longueur", "acier k = 80 W/m·°C, bout à 100 °C", "aluminium k = 220 W/m·°C, bout à 20 °C"],
    mesh: "Deux barreaux carrés de même aire à 0,3 % près (8,85 mm de côté, 78,3 mm²), mailles de 2,21 mm : 3616 mailles. La section ronde de la source ne change rien à une conduction dans une seule direction.",
    expect: [{ key: "joint", label: "Température au joint", unit: "°C", value: 41.3, printed: "41.3 °C", tol: 0.005 }, { key: "P", label: "Flux de chaleur", unit: "W", value: 1.47, printed: "1.47 W", tol: 0.01 }],
    solve() {
      const h = 250 / 113, a = 4 * h, steel = { name: "Steel", E: 200000, nu: 0.3, k: 80, rho: 7850 }, alu = { name: "Aluminium", E: 70000, nu: 0.33, k: 220, rho: 2700 };
      const m = buildModel({ bodies: [{ name: "Steel", ...boxMesh(0, 0, 0, 250, a, a), material: steel }, { name: "Aluminium", ...boxMesh(250, 0, 0, 500, a, a), material: alu }], h });
      const setup = { fixedT: [{ region: { face: "-X" }, T: 100 }, { region: { face: "+X" }, T: 20 }] }, r = solveThermal(m, setup);
      const sys = thermalSystem(m, setup), AT = new Float64Array(m.nNodes); sys.op.apply(Float64Array.from(r.T), AT);      // the heat the hot end supplies : the residual on its nodes
      let P = 0; for (const i of selectNodes(m, { face: "-X" })) P += AT[i] - sys.b[i];
      return { joint: mean(r.T, selectNodes(m, { face: "+X", body: "Steel" })), P, cells: m.nCells };
    } },
  { id: "fea-rod-tension", kind: "fea", model: "fea:structure", how: "direct", title: "Tige d'acier de 2 m qui porte 550 kg",
    source: OX("University Physics, Volume 1", "university-physics-volume-1/pages/12-3-stress-strain-and-elastic-modulus", "§ 12.3, Example 12.8"),
    given: ["tige d'acier de 2,0 m, section 0,30 cm²", "charge : 550 kg × 9,8 m/s² = 5390 N", "Y = 2,0 × 10¹¹ Pa", "poids de la tige négligé"],
    mesh: "Tige carrée de même section (5,477 mm de côté, 30,0 mm²), une maille dans la section : 365 mailles. Un bout tenu dans l'axe, l'autre tiré ; la section reste libre de se contracter.",
    expect: [{ key: "sigma", label: "Contrainte de traction", unit: "MPa", value: 180, printed: "1.8 × 10⁸ Pa", tol: 0.03, note: "la source imprime deux chiffres" }, { key: "dL", label: "Allongement", unit: "mm", value: 1.8, printed: "1.8 mm", tol: 0.03, note: "la source imprime deux chiffres" }],
    solve() {
      const a = Math.sqrt(30), steel = { name: "Steel", E: 200000, nu: 0.3, k: 50, rho: 7850 }, m = buildModel({ bodies: [{ name: "Rod", ...boxMesh(0, 0, 0, 2000, a, a), material: steel }], h: a });
      const r = solveStructure(m, { fixed: [slide("-X", 0), slide("-Y", 1), slide("-Z", 2)], loads: [{ region: { face: "+X" }, force: [550 * 9.8, 0, 0] }] }), end = selectNodes(m, { face: "+X" });
      return { sigma: mean(r.vm, end), dL: mean(r.u, end, 3, 0) * 2000 / (m.bbox[3] - m.bbox[0]), cells: m.nCells };      // the mesh is 0,04 % shorter than the rod : the elongation is brought back to its 2 m
    } },
  { id: "fea-cantilever-round", kind: "fea", model: "fea:structure", how: "direct", title: "Barreau rond de 1 in encastré, 100 lbf/in sur 10 in", converted: true,
    source: { name: "MechaniCalc, « Beam Analysis Validation »", where: "cas « Cantilever Beam, Uniform Distributed Force » (valeur attendue du calcul à la main)", url: "https://mechanicalc.com/calculators/beam-analysis/validation", read: "read", licence: "© MechaniCalc, Inc. — nombres cités avec la référence" },
    given: ["barreau rond, diamètre 1 in, longueur 10 in", "w = 100 lbf/in (1000 lbf au total)", "E = 9.9e6 psi"],
    mesh: "Barreau rond de 25,4 mm, 10 mailles dans le diamètre (2,54 mm) : 8000 mailles. La charge répartie est appliquée comme un poids propre de 1000 lbf. Une section ronde est dessinée en escalier par les mailles cubiques, et l'écart vient surtout de là : mesuré ici, −23 % avec 6 mailles dans le diamètre, −8 % avec 8, −5 % avec 10, +1 % avec 12.",
    expect: [{ key: "tip", label: "Flèche en bout", unit: "mm", value: 0.2572 * IN, printed: "0.2572 in", tol: 0.08, note: "la source est la formule de poutre, sans flèche d'effort tranchant" }],
    solve() {
      const d = IN, L = 10 * IN, alu = { name: "Aluminium 6061-T6", E: 9.9e6 * PSI, nu: 0.33, k: 167, rho: 2700 }, m = buildModel({ bodies: [{ name: "Bar", ...rodMesh(0, L, 0, 0, d / 2), material: alu }], h: d / 10 });
      const g = 1000 * LBF / (alu.rho * 1e-9 * m.volume), r = solveStructure(m, { fixed: [{ face: "-X" }], gravity: [0, 0, -g] });      // the weight of the meshed bar is the load of the source, exactly
      return { tip: -mean(r.u, selectNodes(m, { face: "+X" }), 3, 2), cells: m.nCells };
    } },
  { id: "fea-blocked-concrete", kind: "fea", model: "fea:thermo", how: "direct", title: "Dalles de béton posées sans jeu, de 5 °C à 38 °C",
    source: OX("University Physics, Volume 2", "university-physics-volume-2/pages/1-3-thermal-expansion", "§ 1.3, Example 1.4"),
    given: ["dalles qui ne peuvent pas se dilater", "5 °C à la pose, 38 °C en été", "Y = 20 × 10⁹ N/m²", "α = 12 × 10⁻⁶ /°C"],
    mesh: "Un bloc de 1000 × 200 × 200 mm, mailles de 100 mm : 40 mailles. Les deux bouts sont tenus dans l'axe, les côtés restent libres ; la source ne donne pas de dimensions, et la contrainte n'en dépend pas.",
    expect: [{ key: "sigma", label: "Contrainte de compression", unit: "MPa", value: 7.9, printed: "7.9 × 10⁶ N/m²", tol: 0.02, note: "la source imprime deux chiffres" }],
    solve() {
      const c = { name: "Concrete", E: 20000, nu: 0.2, k: 1, rho: 2400, alpha: 12e-6 }, m = buildModel({ bodies: [{ name: "Block", ...boxMesh(0, 0, 0, 1000, 200, 200), material: c }], h: 100 });
      const r = solveStructure(m, { fixed: [slide("-X", 0), slide("+X", 0), slide("-Y", 1), slide("-Z", 2)], thermal: { T: 38, Tref: 5 }, tol: 1e-10 });
      return { sigma: mean(r.vm, selectNodes(m, { box: [500, 0, 0, 500, 200, 200] })), cells: m.nCells };
    } },
];
/** What the cases of a family of the simulation leave out. */
export const FEA_GAPS = {
  "fea:structure": "La flexion n'est rejouée que sur une section ronde, que les mailles cubiques dessinent en escalier ; aucune plaque, aucune concentration de contrainte, aucun assemblage de plusieurs pièces n'a de cas publié rejoué. Les essais du solveur contre les formules (traction, flexion, plaque, bilame) sont dans tests/node/fea.test.mjs — ce sont des recoupements internes, pas des cas publiés.",
  "fea:thermal": "La convection n'a pas de cas publié rejoué ; la conduction est rejouée dans une seule direction.",
  "fea:thermo": "La dilatation libre et le bilame n'ont pas de cas publié rejoué (le solveur les recoupe contre les formules dans ses essais).",
};
/** Replay a case of the simulation : what validation.runCase asks for as `solvers.fea`. */
export const solveFea = (c) => c.solve();
