/* DesignWizard.ai — the simulation runs here, off the page, so the interface stays alive while the solver iterates. */

import { buildModel, solveStructure, solveThermal, skin } from "./index.js";

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
      result = { maxU: r.maxU, maxVm: r.maxVm, reaction: r.reaction, energy: r.energy, dofs: r.dofs, iterations: r.iterations, residual: r.residual, ms: r.ms, scale: k };
    }
    self.postMessage({ id, ok: true, result, info, skin: s }, [s.pos.buffer, s.idx.buffer, s.val.buffer, s.epos.buffer]);
  } catch (err) { self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) }); }
};
