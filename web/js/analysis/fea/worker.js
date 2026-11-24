/* DynamiteOrbit.ai — the simulation runs here, off the page, so the interface stays alive while the solver iterates. */

import { buildModel, solveStructure, solveThermal, skin } from "./index.js";
import { exposedFaces } from "./voxel.js";
import { nominalStress, coreStress } from "./precheck.js";
import { reduceModel, cutSetup } from "./symmetry.js";
import { prepareZones } from "./refine.js";
import { solveComposite, compositeSkin, onModel, peakOf, blockPeak } from "./composite.js";
import { probeMesh, probePlanes, probeBuffers } from "./probe.js";

const FLOATING = /^Le corps « (.+?) » (?:n'est relié à aucun appui|n'a ni température imposée)/;

/** One line per zone for the page : what it is, how fine, its peak, and what the model alone said on the cubes it took — or why
    it could not be solved. field(part) : the result read in a zone ; alone : the same field on the model solved alone. */
function zoneRows(preps, comp, failed, model, alone, peak) {
  let k = 0;
  return preps.map((p) => {
    if (!p.prep) return { id: p.id, error: p.error };
    const z = p.prep.zone, part = comp ? comp.parts[k++] : null, base = { id: p.id, shape: z.shape, axis: "XYZ"[z.axis], size: z.size, length: z.length, at: z.at, ratio: z.ratio, h: p.prep.local.grid.h, cells: p.prep.local.nCells, cubes: p.prep.block.kept };
    return part ? { ...base, peak: peak(part), alone: blockPeak(p.prep, model, alone) } : { ...base, error: failed || "La zone n'a pas été résolue." };
  });
}

function solve(kind, bodies, mesh, load, scale, progress, cuts, zones) {
  const model = reduceModel(buildModel({ bodies, ...mesh }), cuts || []), heat = (c) => cutSetup(model, c, "thermal");      // what the cuts keep, with their conditions on the planes
  const info = { cells: model.nCells, nodes: model.nNodes, h: model.grid.h, grid: [model.grid.nx, model.grid.ny, model.grid.nz], ...(model.cut ? { copies: model.cut.copies, cuts: model.cut.planes.map((p) => ({ axis: "XYZ"[p.axis], at: p.at, keep: p.keep, bc: p.bc, ...(p.bc === "temp" ? { T: p.T } : {}) })) } : {}) };
  /* the refinement zones : the model is first solved alone — it says whether the case stands, and what the zones change — then
     with its zones, as one mesh. A zone that cannot be meshed, or a whole that cannot be solved, is said ; the model alone remains. */
  const preps = prepareZones(model, bodies, zones || []), ready = preps.filter((p) => p.prep).map((p) => p.prep);
  let comp = null, failed = null;
  const tied = () => { if (!ready.length) return; try { comp = solveComposite(kind, model, ready, load, (p) => progress({ ...p, stage: "zones" })); } catch (e) { failed = e && e.message ? e.message : String(e); } };
  const meshes = () => [comp.out, ...comp.parts.map((p) => p.prep.local)], fine = () => { info.fine = comp.parts.reduce((s, p) => s + p.prep.local.nCells, 0); info.zones = comp.parts.length; };
  /* what the page keeps to read the result anywhere, afterwards (its instruments) : the fine cubes of the zones first, then the rest */
  const keep = (list, more = {}) => ({ kind, meshes: list, planes: probePlanes(model), bodies: model.bodies.map((b) => ({ name: b.name, E: (b.material || {}).E, nu: (b.material || {}).nu })), ...more });
  if (kind === "thermal") {
    const r = solveThermal(model, heat(load), progress); tied();
    if (!comp) return { info, probe: keep([probeMesh(model, { T: r.T })]), skin: skin(model, r.T), result: { maxT: r.maxT, minT: r.minT, balance: r.balance, dofs: r.dofs, iterations: r.iterations, residual: r.residual, ms: r.ms, ...(preps.length ? { zones: zoneRows(preps, null, failed, model, r.T) } : {}) } };
    const Ts = [comp.rt.T, ...comp.parts.map((p) => p.rt.T)], s = compositeSkin(model, onModel(model, comp.out, comp.rt.T, 1, r.T), comp.parts.map((p) => ({ prep: p.prep, field: p.rt.T, u: null }))); fine();
    return { info, probe: keep([...comp.parts.map((p) => probeMesh(p.prep.local, { T: p.rt.T })), probeMesh(comp.out, { T: comp.rt.T })]), skin: { pos: s.pos, idx: s.idx, val: s.val, epos: s.epos }, result: { maxT: peakOf(meshes(), Ts), minT: peakOf(meshes(), Ts, -1), balance: { in: comp.rt.balance.in + comp.parts.reduce((a, p) => a + p.rt.balance.in, 0), out: comp.rt.balance.out + comp.parts.reduce((a, p) => a + p.rt.balance.out, 0) },
      dofs: comp.dofs, iterations: r.iterations + comp.iterations, residual: comp.residual, ms: r.ms + comp.ms, alone: { maxT: r.maxT, minT: r.minT }, zones: zoneRows(preps, comp, failed, model, r.T, (part) => part.rt.maxT) } };
  }
  let thermal = null, temps = null;
  if (kind === "thermo") {                                       // the temperature field first, then what it does to the held part
    const t = load.thermal || {};
    if (typeof t.uniform === "number") { thermal = { T: t.uniform, Tref: load.Tref ?? 20 }; temps = { maxT: { value: t.uniform }, minT: { value: t.uniform } }; }
    else { const rt = solveThermal(model, heat(t.case || {}), progress); thermal = { T: rt.T, Tref: load.Tref ?? 20 }; temps = { maxT: rt.maxT, minT: rt.minT, thermalIterations: rt.iterations }; }
  }
  const r = solveStructure(model, cutSetup(model, thermal ? { fixed: load.fixed, loads: load.loads || [], thermal } : load, "structure"), progress), b = model.bbox, diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]); tied();
  const maxU = comp ? peakOf(meshes(), [comp.r.mag, ...comp.parts.map((p) => p.r.mag)]) : r.maxU, maxVm = comp ? peakOf(meshes(), [comp.r.vm, ...comp.parts.map((p) => p.r.vm)]) : r.maxVm;
  const k = scale ?? (maxU.value > 0 ? Math.max(1, 0.06 * diag / maxU.value) : 1), yieldOf = (i) => { const m = model.bodies[i]; return (m && m.material && m.material.Re) || 0; };
  if (comp && comp.rt) temps = { ...temps, maxT: peakOf(meshes(), [comp.rt.T, ...comp.parts.map((p) => p.rt.T)]), minT: peakOf(meshes(), [comp.rt.T, ...comp.parts.map((p) => p.rt.T)], -1) };
  /* the yield strength of the body of each exposed face : the safety factor is painted from it (0 : unknown) */
  let s;
  if (comp) { const c = compositeSkin(model, onModel(model, comp.out, comp.r.vm, 1, r.vm), comp.parts.map((p) => ({ prep: p.prep, field: p.r.vm, u: p.r.u })), { u: onModel(model, comp.out, comp.r.u, 3, r.u), scale: k }); s = { pos: c.pos, idx: c.idx, val: c.val, epos: c.epos, re: Float32Array.from(c.body, yieldOf) }; fine(); }
  else s = { ...skin(model, r.vm, { u: r.u, scale: k }), re: Float32Array.from(exposedFaces(model).elem, (e) => yieldOf(model.elemBody[e])) };
  const flat = thermal && typeof thermal.T === "number" ? thermal.T : undefined;      // a uniform temperature is one number for every mesh
  const probe = keep(comp ? [...comp.parts.map((p) => probeMesh(p.prep.local, { u: p.r.u, T: p.rt ? p.rt.T : flat })), probeMesh(comp.out, { u: comp.r.u, T: comp.rt ? comp.rt.T : flat })] : [probeMesh(model, { u: r.u, T: thermal ? thermal.T : undefined })], { scale: k });
  return { info, skin: s, probe,
    result: { maxU, maxVm, nominalVm: nominalStress(model, load, r.vm), coreVm: kind === "thermo" ? coreStress(model, load, r.vm) : null, reaction: r.reaction, energy: r.energy,
      dofs: comp ? comp.dofs : r.dofs, iterations: r.iterations + (comp ? comp.iterations : 0), residual: comp ? comp.residual : r.residual, ms: r.ms + (comp ? comp.ms : 0), scale: k, ...(temps || {}),
      ...(comp ? { alone: { maxVm: r.maxVm, maxU: r.maxU } } : {}), ...(preps.length ? { zones: zoneRows(preps, comp, failed, model, r.vm, (part) => part.r.maxVm) } : {}) } };
}

self.onmessage = (e) => {
  const { id, kind, mesh, load, scale } = e.data, progress = (p) => self.postMessage({ id, progress: p }), dropped = [];
  let bodies = e.data.bodies;
  try {
    for (;;) {
      try {
        const out = solve(kind, bodies, mesh, load, scale, progress, e.data.cuts, e.data.zones), s = out.skin;
        self.postMessage({ id, ok: true, result: out.result, info: { ...out.info, dropped }, skin: s, probe: out.probe }, [s.pos.buffer, s.idx.buffer, s.val.buffer, s.epos.buffer, ...(s.re ? [s.re.buffer] : []), ...probeBuffers(out.probe)]);
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
