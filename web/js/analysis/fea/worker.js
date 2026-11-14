/* DesignWizard.ai — the simulation runs here, off the page, so the interface stays alive while the solver iterates. */

import { buildModel, solveStructure, solveThermal, skin } from "./index.js";
import { nominalStress, coreStress } from "./precheck.js";

const FLOATING = /^Le corps « (.+?) » (?:n'est relié à aucun appui|n'a ni température imposée)/;

function solve(kind, bodies, mesh, load, scale, progress) {
  const model = buildModel({ bodies, ...mesh });
  const info = { cells: model.nCells, nodes: model.nNodes, h: model.grid.h, grid: [model.grid.nx, model.grid.ny, model.grid.nz] };
  if (kind === "thermal") {
    const r = solveThermal(model, load, progress);
    return { info, skin: skin(model, r.T), result: { maxT: r.maxT, minT: r.minT, balance: r.balance, dofs: r.dofs, iterations: r.iterations, residual: r.residual, ms: r.ms } };
  }
  let thermal = null, temps = null;
  if (kind === "thermo") {                                       // the temperature field first, then what it does to the held part
    const t = load.thermal || {};
    if (typeof t.uniform === "number") { thermal = { T: t.uniform, Tref: load.Tref ?? 20 }; temps = { maxT: { value: t.uniform }, minT: { value: t.uniform } }; }
    else { const rt = solveThermal(model, t.case || {}, progress); thermal = { T: rt.T, Tref: load.Tref ?? 20 }; temps = { maxT: rt.maxT, minT: rt.minT, thermalIterations: rt.iterations }; }
  }
  const r = solveStructure(model, thermal ? { fixed: load.fixed, loads: load.loads || [], thermal } : load, progress), b = model.bbox, diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  const k = scale ?? (r.maxU.value > 0 ? Math.max(1, 0.06 * diag / r.maxU.value) : 1);
  return { info, skin: skin(model, r.vm, { u: r.u, scale: k }),
    result: { maxU: r.maxU, maxVm: r.maxVm, nominalVm: nominalStress(model, load, r.vm), coreVm: kind === "thermo" ? coreStress(model, load, r.vm) : null, reaction: r.reaction, energy: r.energy,
      dofs: r.dofs, iterations: r.iterations, residual: r.residual, ms: r.ms, scale: k, ...(temps || {}) } };
}

self.onmessage = (e) => {
  const { id, kind, mesh, load, scale } = e.data, progress = (p) => self.postMessage({ id, progress: p }), dropped = [];
  let bodies = e.data.bodies;
  try {
    for (;;) {
      try {
        const out = solve(kind, bodies, mesh, load, scale, progress), s = out.skin;
        self.postMessage({ id, ok: true, result: out.result, info: { ...out.info, dropped }, skin: s }, [s.pos.buffer, s.idx.buffer, s.val.buffer, s.epos.buffer]);
        return;
      } catch (err) {
        // a body that touches nothing held (a small component lost by the coarse mesh) is left out, and said so
        const m = FLOATING.exec((err && err.message) || ""), rest = m ? bodies.filter((b) => b.name !== m[1]) : bodies;
        if (!m || rest.length === bodies.length || !rest.length || dropped.length >= 60) throw err;
        dropped.push(m[1]); bodies = rest;
      }
    }
  } catch (err) { self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) }); }
};
