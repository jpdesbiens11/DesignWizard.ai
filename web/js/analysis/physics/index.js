/* DesignWizard.ai — Physique: library of recognised, simple analytical models (« does the physics behind this part
   work? »). Each model is a closed-form hand calculation with its validity limits and its reference book: it answers
   80 % of the question in a second; a finite-element run or a test answers the rest.
     MODELS, model(id), defaults(id), run(id, inputs), prefill(id, { spec, built }), partContext(spec, built) */

import { verdictOf } from "./models_core.js";
import { props } from "./props.js";
import { STRUCTURE_A } from "./models_structure.js";
import { STRUCTURE_B } from "./models_structure_plate.js";
import { JOINTS } from "./models_joints.js";
import { FLUID } from "./models_fluid.js";
import { THERMAL } from "./models_thermal.js";
import { ELECTRICAL } from "./models_electrical.js";

export const DOMAINS = [{ id: "structure", label: "Structure" }, { id: "joints", label: "Assemblages" }, { id: "fluid", label: "Fluides" },
  { id: "thermal", label: "Thermique" }, { id: "electrical", label: "Électrique" }];
export const MODELS = [...STRUCTURE_A, ...STRUCTURE_B, ...JOINTS, ...FLUID, ...THERMAL, ...ELECTRICAL];
const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function model(id) { return BY_ID.get(id) || null; }
/** Default inputs of a model ({} when unknown). */
export function defaults(id) { const m = model(id); return m ? Object.fromEntries(m.inputs.map((d) => [d.key, d.default])) : {}; }
/** Is this input used with the current choices (its `when` condition)? */
export function inputActive(def, inputs) { return !def.when || Object.entries(def.when).every(([k, list]) => list.includes(inputs[k])); }

/** Complete and clean the inputs: defaults for missing keys, numbers coerced, values brought back inside [min, max]. */
function normalize(m, inputs) {
  const clean = {}, notes = [];
  for (const d of m.inputs) {
    const raw = inputs ? inputs[d.key] : undefined;
    if (d.options) {
      const ok = d.options.some((o) => o.value === String(raw));
      clean[d.key] = ok ? String(raw) : d.default;
      if (!ok && raw !== undefined) notes.push(`Entrée « ${d.label} » : choix inconnu, valeur par défaut utilisée.`);
      continue;
    }
    let v = raw === undefined ? d.default : typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
    if (raw === null || raw === "" || !Number.isFinite(v)) { v = d.default; notes.push(`Entrée « ${d.label} » absente ou invalide : valeur par défaut utilisée (${String(d.default).replace(".", ",")} ${d.unit}).`); }
    const lim = v < d.min ? d.min : v > d.max ? d.max : v;
    if (lim !== v && inputActive(d, { ...clean, ...inputs })) notes.push(`Entrée « ${d.label} » hors de la plage ${String(d.min).replace(".", ",")} à ${String(d.max).replace(".", ",")} ${d.unit} : ramenée à ${String(lim).replace(".", ",")}.`);
    clean[d.key] = lim;
  }
  return { clean, notes };
}

/** Run a model. Never throws: an unknown model or an impossible calculation comes back as a "fail" with its reason.
    -> { values, checks: [{ label, value, limit, unit, ok, margin, note, tight, soft }], steps, warnings, verdict, inputs } */
export function run(id, inputs = {}) {
  const m = model(id);
  if (!m) return { values: {}, checks: [], steps: [], warnings: [`Modèle « ${id} » inconnu.`], verdict: "fail", inputs: {} };
  const { clean, notes } = normalize(m, inputs);
  let r;
  try { r = m.compute(clean); }
  catch (e) { return { values: {}, checks: [], steps: [], warnings: [...notes, `Calcul impossible : ${e.message}`], verdict: "fail", inputs: clean }; }
  const warnings = [...notes, ...r.warnings], values = {}, bad = [];
  for (const [k, v] of Object.entries(r.values)) { if (typeof v === "number" && Number.isFinite(v)) values[k] = v; else bad.push((m.outputs.find((o) => o.key === k) || { label: k }).label); }
  if (bad.length) warnings.push(`Résultat non défini pour : ${bad.join(", ")}. Vérifiez les entrées (division par zéro ou valeur hors domaine).`);
  return { values, checks: r.checks, steps: r.steps, warnings, verdict: bad.length ? "fail" : verdictOf(r.checks, warnings), inputs: clean };
}

/* ---------- prefill from a part ---------- */
/** What a part can tell a model: { key: { v, note } } — material properties, envelope, mass, holes, screws. */
export function partContext(spec, built) {
  const c = {};
  const put = (k, v, note) => { if (typeof v === "number" ? Number.isFinite(v) && v > 0 : typeof v === "string" && v) c[k] = { v: typeof v === "number" ? Number(v.toPrecision(5)) : v, note }; };
  const p = spec && spec.material ? props(spec.material) : null;
  if (p) {
    const src = `${p.name} : valeur typique, à confirmer avec la fiche de la nuance`;
    for (const k of ["E", "G", "nu", "Re", "Rm", "rho", "k", "cp", "cte", "alphaE", "Tmax"]) put(k, p[k], src);
    if (p.rhoE) put("rhoE_n", p.rhoE * 1e9, src);
  }
  const bb = built && Array.isArray(built.bbox) && built.bbox.length === 6 ? built.bbox : null;
  if (bb) {
    const [L, b, h] = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map(Math.abs).sort((x, y) => y - x);
    put("L", L, "plus grande dimension de l'enveloppe de la pièce");
    put("b", b, "dimension intermédiaire de l'enveloppe de la pièce");
    put("h", h, "plus petite dimension de l'enveloppe de la pièce");
    put("A_face", L * b, "plus grande face de l'enveloppe de la pièce");
    put("A_sec", built.volume > 0 && L > 0 ? built.volume / L : b * h, built.volume > 0 ? "section moyenne = volume / plus grande dimension" : "section de l'enveloppe b × h");
  }
  if (built) {
    put("mass", built.mass, "masse calculée de la pièce");
    put("area_cm2", (built.bodies || []).reduce((a, x) => a + (x.area || 0), 0) / 100, "surface extérieure calculée de la pièce");
    const holes = ((built.facts && built.facts.holes) || []).filter((x) => x && x.d > 0), count = new Map();
    for (const x of holes) count.set(x.d, (count.get(x.d) || 0) + 1);
    const top = [...count.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0];
    if (top) put("d_hole", top[0], `diamètre de trou le plus fréquent de la pièce (${top[1]} trou${top[1] > 1 ? "s" : ""})`);
    const tapped = holes.find((x) => typeof x.thread === "string" && x.thread);
    if (tapped) put("screw", tapped.thread.toUpperCase(), "taraudage de la pièce");
  }
  const ifaces = [...((built && built.interfaces) || []), ...((spec && Array.isArray(spec.interfaces) && spec.interfaces) || [])];
  const scr = ifaces.find((x) => x && x.params && typeof x.params.screw === "string");
  if (scr && !c.screw) put("screw", scr.params.screw.toUpperCase(), `vis de l'interface « ${scr.name || scr.id || scr.type || "fixation"} »`);
  return c;
}

/** Inputs a model can take from a part. -> { inputs: { key: value }, notes: { key: "d'où vient la valeur" } } */
export function prefill(id, part = {}) {
  const m = model(id), res = { inputs: {}, notes: {} };
  if (!m || !m.fill || !part) return res;
  const c = partContext(part.spec, part.built);
  for (const [key, src] of Object.entries(m.fill)) {
    const d = m.inputs.find((x) => x.key === key), f = c[src];
    if (!d || !f) continue;
    if (d.options) { if (!d.options.some((o) => o.value === f.v)) continue; res.inputs[key] = f.v; }
    else if (typeof f.v === "number") res.inputs[key] = Math.min(d.max, Math.max(d.min, f.v));
    else continue;
    res.notes[key] = f.note;
  }
  return res;
}
