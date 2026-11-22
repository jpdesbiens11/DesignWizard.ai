/* DesignOrbit.ai — Physique: library of recognised, simple analytical models (« does the physics behind this part
   work? »). Each model is a closed-form hand calculation with its validity limits and its reference book: it answers
   80 % of the question in a second; a finite-element run or a test answers the rest.
     MODELS, model(id), defaults(id), run(id, inputs), prefill(id, { spec, built }), partContext(spec, built) */

import { verdictOf } from "./models_core.js";
import { props } from "./props.js";
import { medium, mediaSlots, mediaDefaults, mediaValues, MEDIA_PROPS } from "./media.js";
import { STRUCTURE_A } from "./models_structure.js";
import { STRUCTURE_B } from "./models_structure_plate.js";
import { JOINTS } from "./models_joints.js";
import { FLUID } from "./models_fluid.js";
import { THERMAL } from "./models_thermal.js";
import { ELECTRICAL } from "./models_electrical.js";

/* a physics, its colour and its pictogram : a model is found by what it looks like before it is read */
export const DOMAINS = [{ id: "structure", label: "Structure", color: "#2563eb", icon: "ruler", hint: "Ça plie, ça flambe, ça tord ?" }, { id: "joints", label: "Assemblages", color: "#7c3aed", icon: "bolt", hint: "Ça tient ensemble ?" },
  { id: "fluid", label: "Fluides", color: "#0891b2", icon: "flow", hint: "Ça passe, à quel prix ?" }, { id: "thermal", label: "Thermique", color: "#ea580c", icon: "thermal", hint: "Ça chauffe ?" },
  { id: "electrical", label: "Électrique", color: "#b45309", icon: "power", hint: "Le courant passe sans brûler ?" }];
/* the few words of a model on its tile : the long title and the question come once it is chosen */
const SHORT = { beam_cantilever_point: "Cantilever · end load", beam_cantilever_udl: "Cantilever · distributed load", beam_simple_point: "Two supports · center load", beam_simple_udl: "Two supports · distributed load",
  column_buckling: "Column buckling", shaft_torsion: "Shaft torsion", plate_pressure: "Plate under pressure", thermal_mismatch: "Thermal mismatch", bolted_joint: "Bolted joint", press_fit: "Press fit", dowel_pin: "Dowel pin · shear", spring_stop: "Spring contact · to its stop", plastic_screw: "Screw in plastic · pull-out", face_cam: "Face cam · handle", louvre_strip: "Louvre strip · flat joint",
  pipe_flow: "Tube · pressure loss", orifice_flow: "Calibrated orifice", conduction_stack: "Wall · conduction", junction_temperature: "Junction temperature", heatsink_natural: "Fins · natural convection", heatsink_forced: "Fins · forced convection",
  lumped_mass: "Thermal mass", busbar: "Busbar", pcb_trace: "PCB trace", adiabatic_pulse: "Current pulse" };
export const shortTitle = (m) => (m ? SHORT[m.id] || m.title : "");
/** The numeric inputs of a model that still hold the example the tool put there : neither typed, nor confirmed, nor read on a part.
    entered : the keys the designer typed or confirmed (a Set or a list). → keys, in the order of the form */
export function exampleKeys(m, inputs, entered) {
  const done = entered instanceof Set ? entered : new Set(entered || []), given = m ? mediaValues(m.id, inputs || {}).from : {};       // a value a medium gives is not an example : the medium is
  const slots = m ? mediaSlots(m.id).filter((s) => medium((inputs || {})[s.key]) && !done.has(s.key)).map((s) => s.key) : [];
  return [...slots, ...((m && m.inputs) || []).filter((d) => !d.options && !given[d.key] && inputActive(d, inputs || {}) && !done.has(d.key)).map((d) => d.key)];
}
/** What is wrong with the inputs of a model, for the guide : a value missing or outside what the model accepts, the examples still
    to enter or to confirm (o.examples, from exampleKeys), what was read on a part and wants a look (o.read : keys ; o.part : its id),
    then the limits of validity the run reports. → [{ level, text, field }] */
export function inputIssues(m, inputs, result, o = {}) {
  const out = [], name = (k) => { const d = m.inputs.find((x) => x.key === k) || mediaSlots(m.id).find((x) => x.key === k); return d ? d.label : k; };
  if (!m) return [{ level: "tip", text: "Choisissez un modèle dans le volet de droite : ils sont rangés par physique." }];
  const given = m ? mediaValues(m.id, inputs).from : {};
  for (const d of (m && m.inputs) || []) { if (d.options || given[d.key] || !inputActive(d, inputs)) continue; const v = inputs[d.key], unit = d.unit ? ` ${d.unit}` : "";
    if (v === null || v === undefined || !Number.isFinite(v)) out.push({ level: "error", field: d.key, text: `${d.label} : entrez une valeur (de ${d.min} à ${d.max}${unit}).` });
    else if (v < d.min || v > d.max) out.push({ level: "error", field: d.key, text: `${d.label} = ${v}${unit} : hors de ce que le modèle accepte (de ${d.min} à ${d.max}${unit}).` }); }
  const eg = (o.examples || []).filter((k) => !out.some((x) => x.field === k));
  if (eg.length) out.push({ level: "todo", field: eg[0], examples: eg, text: `${eg.length} valeur${eg.length > 1 ? "s" : ""} d'exemple à entrer ou à confirmer : ${eg.slice(0, 4).map(name).join(", ")}${eg.length > 4 ? "…" : ""}. Le verdict ne vaut que pour vos valeurs.` });
  const read = (o.read || []).filter((k) => m.inputs.some((d) => d.key === k && inputActive(d, inputs)));
  if (read.length) out.push({ level: "warn", field: read[0], text: `${read.length} valeur${read.length > 1 ? "s reprises" : " reprise"} de la pièce${o.part ? " " + o.part : ""} (${read.slice(0, 4).map(name).join(", ")}${read.length > 4 ? "…" : ""}) : l'enveloppe n'est pas toujours la section utile.` });
  for (const w of (result && result.warnings) || []) out.push({ level: "warn", text: `Limite de validité — ${w}` });
  return out;
}
export const MODELS = [...STRUCTURE_A, ...STRUCTURE_B, ...JOINTS, ...FLUID, ...THERMAL, ...ELECTRICAL];
for (const m of MODELS) m.media = mediaSlots(m.id);                   // the media a model reads its properties from (media.js)
const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function model(id) { return BY_ID.get(id) || null; }
/** Default inputs of a model ({} when unknown). */
export function defaults(id) { const m = model(id); return m ? Object.fromEntries(m.inputs.map((d) => [d.key, d.default])) : {}; }
/** The inputs a model opens with on a screen : its defaults, and the media it proposes — its properties then come from them. */
export function sessionDefaults(id) { return { ...defaults(id), ...mediaDefaults(id) }; }
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
  /* the properties a medium gives replace what was typed : a value alone means nothing, the medium says what it is */
  const mv = mediaValues(m.id, { ...clean, ...inputs });
  for (const s of mediaSlots(m.id)) if (!s.own) clean[s.key] = medium(inputs && inputs[s.key]) && s.states.includes(medium(inputs[s.key]).state) ? inputs[s.key] : "";
  for (const [k, v] of Object.entries(mv.values)) { const d = m.inputs.find((x) => x.key === k); clean[k] = v;
    if (d && inputActive(d, clean) && (v < d.min || v > d.max)) notes.push(`${mv.from[k].name} : ${d.label} = ${String(v).replace(".", ",")} ${d.unit}, hors de la plage du modèle (${String(d.min).replace(".", ",")} à ${String(d.max).replace(".", ",")}).`); }
  for (const x of mv.missing) { const d = m.inputs.find((q) => q.key === x.key); if (d && inputActive(d, clean)) notes.push(`${x.name} : ${MEDIA_PROPS[x.prop].fr} inconnue de la base des médias — « ${d.label} » garde ${String(clean[x.key]).replace(".", ",")} ${d.unit}, à vérifier.`); }
  return { clean, notes, media: mv };
}

/** Run a model. Never throws: an unknown model or an impossible calculation comes back as a "fail" with its reason.
    -> { values, checks: [{ label, value, limit, unit, ok, margin, note, tight, soft }], steps, warnings, verdict, inputs } */
export function run(id, inputs = {}) {
  const m = model(id);
  if (!m) return { values: {}, checks: [], steps: [], warnings: [`Modèle « ${id} » inconnu.`], verdict: "fail", inputs: {} };
  const { clean, notes, media } = normalize(m, inputs);
  let r;
  try { r = m.compute(clean); }
  catch (e) { return { values: {}, checks: [], steps: [], warnings: [...notes, `Calcul impossible : ${e.message}`], verdict: "fail", inputs: clean, media }; }
  const warnings = [...notes, ...r.warnings], values = {}, bad = [];
  for (const [k, v] of Object.entries(r.values)) { if (typeof v === "number" && Number.isFinite(v)) values[k] = v; else bad.push((m.outputs.find((o) => o.key === k) || { label: k }).label); }
  if (bad.length) warnings.push(`Résultat non défini pour : ${bad.join(", ")}. Vérifiez les entrées (division par zéro ou valeur hors domaine).`);
  return { values, checks: r.checks, steps: r.steps, warnings, verdict: bad.length ? "fail" : verdictOf(r.checks, warnings), inputs: clean, media };
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
  /* a busbar says more than its envelope : its strip (width, thickness, length along the middle fibre), its current and its finish */
  const bus = spec && spec.busbar && typeof spec.busbar === "object" ? spec.busbar : null;
  if (bus) {
    const len = (bus.legs || []).reduce((t, l) => t + (Number(l.L) || 0), 0), src = `busbar ${spec.id || ""}`.trim(), covered = bus.insulation && bus.insulation.t > 0;
    put("L", len, `${src} : somme des branches, sur la fibre du milieu`); put("b", bus.W, `${src} : largeur de la bande`); put("h", bus.t, `${src} : épaisseur de la bande`); put("A_sec", bus.W * bus.t, `${src} : largeur × épaisseur`);
    put("I_bus", bus.I, `${src} : courant déclaré`); put("eps_bus", covered ? 0.9 : bus.finish === "Sn" || bus.finish === "Ni" ? 0.1 : bus.finish === "Ag" ? 0.05 : 0.4, `${src} : ${covered ? "barre gainée d'un isolant" : bus.finish === "Sn" ? "étamée" : bus.finish === "Ni" ? "nickelée" : bus.finish === "Ag" ? "argentée" : "cuivre nu"} — valeur typique`);
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
  const c = partContext(part.spec, part.built), slot = mediaSlots(id).find((s) => s.states.includes("solid") && !s.own), mat = slot && part.spec && medium(part.spec.material), given = slot && mat && mat.state === "solid" ? slot.gives : {};
  if (slot && mat && mat.state === "solid") { res.inputs[slot.key] = mat.id; res.notes[slot.key] = `matière de la pièce : ${mat.name}`; }
  for (const [key, src] of Object.entries(m.fill)) {
    if (given[key]) continue;                                    // the medium gives it
    const d = m.inputs.find((x) => x.key === key), f = c[src];
    if (!d || !f) continue;
    if (d.options) { if (!d.options.some((o) => o.value === f.v)) continue; res.inputs[key] = f.v; }
    else if (typeof f.v === "number") res.inputs[key] = Math.min(d.max, Math.max(d.min, f.v));
    else continue;
    res.notes[key] = f.note;
  }
  return res;
}

/* ---------- a run that is kept : its name, and its sheet ---------- */
/** A name for a new run of a model on a part — the name of the part first, so that the runs of a part sort together — unique among the runs kept. */
export function runName(project, modelId, partId) {
  const part = partId ? ((project && project.parts) || []).find((p) => p.id === partId) : null, base = `${part ? part.name || part.id : "Sans pièce"} — ${shortTitle(model(modelId)) || modelId}`, taken = new Set(((project && project.physics) || []).map((r) => r.name));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 999; n++) if (!taken.has(`${base} (${n})`)) return `${base} (${n})`;
  return base;
}
/** The runs kept, by part : [{ part (id or ""), name, runs }] — the parts in the order of the project, « sans pièce » last ; in a part, the latest first. */
export function runsByPart(project) {
  const parts = (project && project.parts) || [], by = new Map();
  for (const r of (project && project.physics) || []) { const k = r.part && parts.some((p) => p.id === r.part) ? r.part : ""; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const order = [...parts.map((p) => p.id).filter((id) => by.has(id)), ...(by.has("") ? [""] : [])];
  return order.map((id) => ({ part: id, name: id ? (parts.find((p) => p.id === id) || {}).name || id : "Sans pièce", runs: by.get(id).slice().sort((a, b) => String(b.when || "").localeCompare(String(a.when || ""))) }));
}
/** The sheet of a run that is kept, as text : what was asked, what was entered, what came out, how — for the file of the part. */
export function runSheet(saved, project) {
  const m = model(saved.model), part = saved.part ? ((project && project.parts) || []).find((p) => p.id === saved.part) : null, num = (v) => (typeof v === "number" ? String(Number(v.toPrecision(6))).replace(".", ",") : String(v ?? "—"));
  if (!m) return `${saved.name || saved.model}\nModèle « ${saved.model} » inconnu de cette version.\n`;
  const again = run(m.id, { ...defaults(m.id), ...(saved.inputs || {}) }), V = { ok: "OK", warn: "À VÉRIFIER", fail: "NON" };
  return [`${saved.name || m.title}`, `${m.title}`, `Question : ${m.question}`, `Pièce : ${part ? `${part.id} — ${part.name || ""}` : saved.part || "aucune"}`, `Date : ${String(saved.when || "").slice(0, 10) || "—"}`, `Verdict : ${V[again.verdict] || again.verdict}`, "",
    "DONNÉES", ...again.media.shown.map((x) => `  ${(m.media.find((q) => q.key === x.slot) || {}).label || "Média"} : ${x.name} (base des médias)`), ...m.inputs.filter((d) => inputActive(d, again.inputs)).map((d) => `  ${d.label} : ${d.options ? ((d.options.find((o) => o.value === String(again.inputs[d.key])) || {}).label || again.inputs[d.key]) : num(again.inputs[d.key])}${d.unit ? ` ${d.unit}` : ""}${again.media.from[d.key] ? ` — donné par ${again.media.from[d.key].name}` : ""}`), "",
    "RÉSULTATS", ...m.outputs.map((o) => `  ${o.label} : ${num(again.values[o.key])}${o.unit ? ` ${o.unit}` : ""}`), "",
    ...(again.checks.length ? ["VÉRIFICATIONS", ...again.checks.map((c) => `  ${c.ok ? "OK " : "NON"}  ${c.label} : ${num(c.value)} ${c.unit} — limite ${num(c.limit)} ${c.unit} — marge ${num(c.margin)}`), ""] : []),
    ...(again.warnings.length ? ["LIMITES DE VALIDITÉ", ...again.warnings.map((w) => `  ${w}`), ""] : []),
    "CALCUL", ...again.steps.map((s, i) => `  ${i + 1}. ${s}`), "", "HYPOTHÈSES", ...m.assumptions.map((a) => `  - ${a}`), "", `Domaine de validité : ${m.validity}`, `Référence : ${m.reference}`, ""].join("\n");
}
