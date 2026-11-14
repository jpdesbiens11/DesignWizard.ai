/* DesignWizard.ai — DFM / DFx rule engine of a part: the printable rule book (RULEBOOK) and checkPart().
   The rules live in one module per process family (dfx_rules_<family>.js); this file gives them a common context
   (facts, material, evaluated spec, lazy mesh wall thickness, patch helpers) and collects the findings.
   A rule never throws: every rule runs inside ctx.run(), a failing rule is skipped and listed in `skipped`. */

import { material, PROCESSES } from "../cad/materials.js";
import { evalDeep } from "../cad/expr.js";
import { makeFinding, sortFindings, summarize, meshWallThickness, num } from "./dfx_core.js";
import { BOOK_CNC, checkMilling, checkTurning, checkHoleSizes } from "./dfx_rules_cnc.js";
import { BOOK_SHEET, checkSheet, checkPlate } from "./dfx_rules_sheet.js";
import { BOOK_EXTRUSION, checkExtrusion } from "./dfx_rules_extrusion.js";
import { BOOK_PLASTIC, checkMolding, checkPrinting } from "./dfx_rules_plastic.js";
import { BOOK_PCB, checkPcb, checkPurchased } from "./dfx_rules_pcb.js";
import { BOOK_GENERAL, checkInterfaces, checkGeneral } from "./dfx_rules_general.js";
import { BOOK_ASSEMBLY } from "./dfa_rules.js";

/** Printable rule book: one entry per process {process, title, fr, steps[], rules[{id, title, limit, severity, why, source, fix?, manual?}]}.
    `fix: true` = a one-click auto-fix exists; `manual: true` = documented but not checked automatically. */
export const RULEBOOK = [...BOOK_CNC, ...BOOK_SHEET, ...BOOK_EXTRUSION, ...BOOK_PLASTIC, ...BOOK_PCB, ...BOOK_GENERAL, ...BOOK_ASSEMBLY]
  .map((b) => ({ ...b, title: b.title || (PROCESSES[b.process] || {}).label || b.process, fr: b.fr || (PROCESSES[b.process] || {}).fr || b.process }));

const INDEX = new Map(), BY_PROCESS = new Map();
for (const b of RULEBOOK) {
  const m = new Map();
  for (const r of b.rules) { m.set(r.id, r); if (!INDEX.has(r.id)) INDEX.set(r.id, { rule: r, book: b }); }
  BY_PROCESS.set(b.process, m);
}
/** Rule of the book by id (the entry of `process` wins when the id is shared by several processes). */
export function ruleInfo(id, process) {
  const own = BY_PROCESS.get(process);
  if (own && own.has(id)) return own.get(id);
  return INDEX.has(id) ? INDEX.get(id).rule : null;
}
const categoryOf = (id) => { const e = INDEX.get(id); return e ? (e.rule.category || e.book.category || "DFM") : "DFM"; };

const RUNNERS = {
  cnc_milling: [checkMilling], cnc_turning: [checkTurning], sheet_metal: [checkSheet], laser_cut: [checkPlate],
  extrusion_al: [checkExtrusion, checkHoleSizes], extrusion_plastic: [checkExtrusion, checkHoleSizes],
  injection_molding: [checkMolding], fdm: [checkPrinting], mjf: [checkPrinting], pcb: [checkPcb], purchased: [checkPurchased],
};
const FACT_LISTS = ["holes", "pockets", "bosses", "fillets", "chamfers", "shells", "extrudes", "revolves"];

function context(spec, built, geo) {
  const findings = [], ran = [], skipped = [];
  const facts = { ...(built.facts || {}) };
  for (const k of FACT_LISTS) facts[k] = Array.isArray(facts[k]) ? facts[k].filter((x) => x && typeof x === "object") : [];
  const mat = spec.material ? material(spec.material) : null, process = spec.process || null;
  const mainBody = (built.bodies || []).find((b) => b.name === (built.main || "main")) || (built.bodies || [])[0] || null;
  const bbox = (mainBody && mainBody.bbox) || built.bbox || null;
  const features = Array.isArray(spec.features) ? spec.features : [];
  const indexOf = (source) => { let i = features.findIndex((f) => f && f.id === source); if (i < 0) { const m = /^f(\d+)$/.exec(String(source)); if (m && features[+m[1] - 1] && !features[+m[1] - 1].id) i = +m[1] - 1; } return i; };
  let evaluated = null, wall;
  const ctx = {
    spec, built, geo: geo || {}, facts, mat, cls: mat ? mat.cls : "unknown", process, bbox, mainBody,
    dims: bbox ? [bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]] : null,
    hollow: facts.shells.length > 0,
    featureIndex: indexOf,
    /** Raw spec feature behind a facts `source` id (null for family / interface generated features). */
    feature: (source) => { const i = indexOf(source); return i >= 0 ? features[i] : null; },
    /** Same feature with its expressions evaluated. */
    efeature(source) {
      const i = indexOf(source);
      if (i < 0) return null;
      if (!evaluated) { try { evaluated = evalDeep(features, (built.params && built.params.scope) || {}); } catch (e) { evaluated = features; } }
      return evaluated[i];
    },
    /** Mesh wall thickness of the main body (null without geo.mesh); computed once. */
    wall() { if (wall === undefined) { try { wall = ctx.geo.mesh ? meshWallThickness(ctx.geo.mesh) : null; } catch (e) { wall = null; } if (wall && wall.min === null) wall = null; } return wall; },
    /** Patch entry for a fact: interface-generated geometry is fixed on the interface (ifacePath), the rest on the feature. */
    patch(fact, featPath, value, ifacePath) {
      if (!fact) return null;
      if (fact.iface) return ifacePath ? { target: "interface", id: fact.iface, path: ifacePath, value } : null;
      const m = /^pcb\.hole(\d+)$/.exec(String(fact.source));
      if (m) return featPath ? { target: "spec", id: null, path: `pcb.holes.${+m[1] - 1}.${featPath}`, value } : null;
      return featPath && indexOf(fact.source) >= 0 ? { target: "feature", id: fact.source, path: featPath, value } : null;
    },
    /** {label, patch} or null when one of the entries could not be expressed. */
    fix(label, ...ops) { return ops.length && ops.every(Boolean) ? { label, patch: ops } : null; },
    add(id, o) {
      const r = ruleInfo(id, process) || {};
      findings.push(makeFinding({ ...o, id, severity: o.severity || r.severity || "info", category: o.category || categoryOf(id), process, title: o.title || r.title || id, source: o.source || r.source || "" }));
    },
    run(id, fn) { ran.push(id); try { fn(); } catch (e) { skipped.push({ id, error: String(e && e.message || e) }); } },
    /** Shared thin-wall rule: shells (with auto-fix) and the mesh probe. lim = {rec (advised minimum), min (hard minimum), what}. */
    checkWalls(id, lim) {
      let fromShell = Infinity;
      for (const s of facts.shells) {
        if (!(s.t < lim.rec - 1e-6)) continue;
        fromShell = Math.min(fromShell, s.t);
        ctx.add(id, { severity: s.t < lim.min - 1e-6 ? "error" : "warn", value: s.t, limit: lim.rec, unit: "mm", feature: s.source,
          message: `Paroi (shell « ${s.source} ») de ${num(s.t)} mm : sous le minimum ${lim.what} de ${num(lim.rec)} mm${lim.min < lim.rec ? ` (limite absolue ${num(lim.min)} mm)` : ""}. Correctif : passer la paroi à ${num(lim.rec)} mm.`,
          fix: ctx.fix(`Passer la paroi à ${num(lim.rec)} mm`, ctx.patch(s, "t", lim.rec)) });
      }
      // the mesh is faceted: a curved wall is measured within about one chord deflection (the kernel uses diag / 900, 0.02 to 0.15 mm)
      const w = ctx.wall(), tol = bbox ? Math.max(0.02, Math.min(0.15, Math.hypot(bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]) / 900)) : 0.05;
      if (w && w.min < lim.rec - tol && !(fromShell <= w.min * 1.1)) {
        ctx.add(id, { severity: w.min < 0.5 * lim.min ? "error" : "warn", value: Math.round(w.min * 100) / 100, limit: lim.rec, unit: "mm", where: w.at,
          message: `Épaisseur locale de ${num(w.min)} mm mesurée sur le maillage (voir le marqueur 3D) : sous le minimum ${lim.what} de ${num(lim.rec)} mm. Correctif : épaissir cette zone ou écarter les features voisines (trou, pocket, bord).` });
      }
    },
  };
  return { ctx, findings, ran, skipped };
}

/** Check one part. spec = part spec (part language), built = result of buildPart(), geo = {mesh} optional
    (kernel tessellation of the main body: enables the wall-thickness rules).
    Returns { findings (errors first), summary {errors, warnings, infos, score, status}, rules (ids that ran), skipped }. */
export function checkPart(spec, built, geo) {
  spec = spec && typeof spec === "object" ? spec : {};
  built = built && typeof built === "object" ? built : {};
  const objs = (l) => (Array.isArray(l) ? l.filter((x) => x && typeof x === "object") : []);
  built = { ...built, interfaces: objs(built.interfaces), bodies: objs(built.bodies), log: objs(built.log) };
  const { ctx, findings, ran, skipped } = context(spec, built, geo);
  for (const fn of [...(RUNNERS[ctx.process] || []), checkInterfaces, checkGeneral]) {
    try { fn(ctx); } catch (e) { skipped.push({ id: fn.name, error: String(e && e.message || e) }); }
  }
  const sorted = sortFindings(findings);
  return { findings: sorted, summary: summarize(sorted), rules: [...new Set(ran)], skipped };
}
