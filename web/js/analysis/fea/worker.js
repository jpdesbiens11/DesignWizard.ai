/* DesignWizard.ai — the simulation runs here, off the page, so the interface stays alive while the solver iterates. */

import { buildModel, solveStructure, solveThermal, skin, selectNodes } from "./index.js";

/** Largest von Mises stress away from the supports and from concentrated loads (two cells clear): the NOMINAL stress a
    hand calculation predicts. The peak under a support is singular and depends on the mesh. */
function nominalStress(model, load, vm) {
  const h = model.grid.h, keepOut = [], X = model.nodes, r2 = (2 * h) ** 2;
  for (const region of load.fixed || []) keepOut.push(...selectNodes(model, region));
  for (const l of load.loads || []) if (l.force) { const ns = selectNodes(model, l.region); if (ns.length <= 30) keepOut.push(...ns); }
  let best = -1, node = -1;
  for (let i = 0; i < model.nNodes; i++) {
    if (vm[i] <= best) continue;
    let clear = true;
    for (const k of keepOut) { const dx = X[3 * i] - X[3 * k], dy = X[3 * i + 1] - X[3 * k + 1], dz = X[3 * i + 2] - X[3 * k + 2]; if (dx * dx + dy * dy + dz * dz < r2) { clear = false; break; } }
    if (clear) { best = vm[i]; node = i; }
  }
  return node < 0 ? null : { value: best, node, at: [X[3 * node], X[3 * node + 1], X[3 * node + 2]] };
}

self.onmessage = (e) => {
  const { id, kind, bodies, mesh, load, scale } = e.data;
  try {
    const model = buildModel({ bodies, ...mesh });
    const progress = (p) => self.postMessage({ id, progress: p });
    const info = { cells: model.nCells, nodes: model.nNodes, h: model.grid.h, grid: [model.grid.nx, model.grid.ny, model.grid.nz] };
    let result, s;
    if (kind === "thermal") {
      const r = solveThermal(model, load, progress);
      s = skin(model, r.T);
      result = { maxT: r.maxT, minT: r.minT, balance: r.balance, dofs: r.dofs, iterations: r.iterations, residual: r.residual, ms: r.ms };
    } else {
      const r = solveStructure(model, load, progress), b = model.bbox, diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
      const k = scale ?? (r.maxU.value > 0 ? Math.max(1, 0.06 * diag / r.maxU.value) : 1);
      s = skin(model, r.vm, { u: r.u, scale: k });
      result = { maxU: r.maxU, maxVm: r.maxVm, nominalVm: nominalStress(model, load, r.vm), reaction: r.reaction, energy: r.energy, dofs: r.dofs, iterations: r.iterations, residual: r.residual, ms: r.ms, scale: k };
    }
    self.postMessage({ id, ok: true, result, info, skin: s }, [s.pos.buffer, s.idx.buffer, s.val.buffer, s.epos.buffer]);
  } catch (err) { self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) }); }
};
