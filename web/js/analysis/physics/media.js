/* DynamiteOrbit — the base of media : every solid, liquid and gas the analytical models know, with the properties they
   read from it. A value alone means nothing to a human : a model no longer asks for « E = 69 GPa », it asks which medium —
   « Aluminium 6061-T6 » — and the values follow, written beside it and not editable.
   Solids first (the materials of the library of parts, filed by group then by name), then liquids, then gases. Pure.
   The values are the typical ones of props.js ; `basis` says how each medium was checked. The data sheet prevails. */

import { MATERIALS, material, materialFamily, materialShort } from "../../cad/materials.js";
import { props, PROP_IDS, PROPS_NOTE, FLUIDS } from "./props.js";

export const MEDIA_STATES = [
  { id: "solid", label: "Solides", one: "Solide", hint: "métaux, plastiques, isolants, interfaces thermiques", icon: "part", color: "#8a7df0" },
  { id: "liquid", label: "Liquides", one: "Liquide", hint: "eau, mélanges, huiles", icon: "flow", color: "#0891b2" },
  { id: "gas", label: "Gaz", one: "Gaz", hint: "à la pression atmosphérique", icon: "thermal", color: "#64748b" },
];
/** What a medium can give : key → the term (English, as on a data sheet), its French word, its unit. */
export const MEDIA_PROPS = {
  rho: { label: "Density ρ", fr: "masse volumique", unit: "kg/m³" }, E: { label: "Young's modulus E", fr: "module d'Young", unit: "GPa" }, G: { label: "Shear modulus G", fr: "module de cisaillement", unit: "GPa" }, nu: { label: "Poisson's ratio ν", fr: "coefficient de Poisson", unit: "" },
  Re: { label: "Yield strength Re", fr: "limite élastique", unit: "MPa" }, Rm: { label: "Tensile strength Rm", fr: "résistance à la traction", unit: "MPa" }, fatigue: { label: "Fatigue strength (hint)", fr: "limite d'endurance (indication)", unit: "MPa" },
  cte: { label: "Thermal expansion α", fr: "dilatation thermique", unit: "µm/m·K" }, k: { label: "Thermal conductivity k", fr: "conductivité thermique", unit: "W/m·K" }, cp: { label: "Specific heat cp", fr: "chaleur massique", unit: "J/kg·K" },
  rhoE_n: { label: "Electrical resistivity ρ₂₀", fr: "résistivité électrique à 20 °C", unit: "nΩ·m" }, alphaE: { label: "Temperature coefficient of resistivity", fr: "coefficient de température de la résistivité", unit: "1/K" },
  Tmax: { label: "Max. service temperature", fr: "température maximale de service", unit: "°C" }, Tmelt: { label: "Melting point (solidus)", fr: "point de fusion (solidus)", unit: "°C" },
  mu_mPa: { label: "Dynamic viscosity μ", fr: "viscosité dynamique", unit: "mPa·s" }, Pr: { label: "Prandtl number", fr: "nombre de Prandtl", unit: "" },
};
/* the melting point (solidus) of the conductors a current pulse is checked on — typical, written from memory, not read again */
const TMELT = { "CU-C110": 1083, "AL6061-T6": 582, "AL6063-T5": 615, "AL5052-H32": 607, "BRASS-360": 885 };
const SOLID_BASIS = `${PROPS_NOTE} Table de la plateforme (props.js) : valeurs typiques à température ambiante, sans lecture consignée de chaque fiche.`;

const solid = (id) => { const p = props(id), m = material(id) || { name: id }; if (!p) return null;
  const P = { rho: p.rho, E: p.E, G: p.G, nu: p.nu, Re: p.Re, Rm: p.Rm, fatigue: p.fatigue, cte: p.cte, k: p.k, cp: p.cp, rhoE_n: p.rhoE ? Number((p.rhoE * 1e9).toPrecision(5)) : null, alphaE: p.alphaE, Tmax: p.Tmax, Tmelt: TMELT[id] ?? null };
  return { id, name: materialShort(m) || m.name, state: "solid", group: materialFamily(m) || "Autres", rank: m.cls === "metal" ? 0 : m.cls === "plastic" ? 1 : 2, props: P, basis: SOLID_BASIS + (TMELT[id] ? " Point de fusion : valeur typique écrite de mémoire." : "") }; };
const fluidProps = (f) => ({ rho: Number(f.rho.toPrecision(5)), mu_mPa: Number((f.mu * 1e3).toPrecision(5)), k: Number(f.k.toPrecision(4)), cp: Number(f.cp.toPrecision(5)), Pr: Number(f.Pr.toPrecision(4)) });
const fluid = (f) => ({ id: f.id, name: f.name, fr: f.fr, state: f.phase, group: f.phase === "gas" ? "Gaz usuels (1 atm)" : /oil/.test(f.id) ? "Huiles minérales" : "Eau et mélanges", props: fluidProps(f), range: f.range, at: (T) => fluidProps(f.at(T)), basis: f.basis });

const byName = (a, b) => a.name.localeCompare(b.name, "fr", { numeric: true });
/** Every medium : solids first (metals, then plastics, then the rest), then liquids, then gases ; in a state by group, in a group by name. */
export const MEDIA = (() => {
  const all = [...MATERIALS.filter((m) => PROP_IDS.includes(m.id)).map((m) => solid(m.id)).filter(Boolean), ...Object.values(FLUIDS).map(fluid)], order = MEDIA_STATES.map((s) => s.id);
  return all.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || (a.rank || 0) - (b.rank || 0) || a.group.localeCompare(b.group, "fr") || byName(a, b));
})();
const BY_ID = new Map(MEDIA.map((m) => [m.id, m]));
export const medium = (id) => BY_ID.get(id) || null;
/** The properties of a medium, at T °C for a fluid (20 °C when T is not given). */
export function mediumProps(id, T) { const m = medium(id); return !m ? null : m.at && Number.isFinite(T) ? m.at(T) : m.props; }
/** The menu of the media : [{ ...state, groups : [{ group, list }] }], the states in their order. states : which ones (all by default) ; find : text looked for. */
export function mediaMenu(states = null, find = "") {
  const q = String(find || "").trim().toLowerCase(), keep = (m) => (!states || states.includes(m.state)) && (!q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.group.toLowerCase().includes(q) || String(m.fr || "").toLowerCase().includes(q));
  return MEDIA_STATES.map((s) => { const list = MEDIA.filter((m) => m.state === s.id && keep(m)), groups = []; for (const m of list) { let g = groups.find((x) => x.group === m.group); if (!g) groups.push(g = { group: m.group, list: [] }); g.list.push(m); } return { ...s, groups, count: list.length }; }).filter((s) => s.count);
}

/* ---------- which model reads which medium : a slot is a choice of medium that gives some of the inputs of the model ---------- */
const S = (key, label, def, gives, states = ["solid"]) => ({ key, label, def, gives, states });
const BEAM = [S("mat", "Matériau de la poutre", "AL6061-T6", { E: "E", Re: "Re", rho: "rho" })], FLOW = [{ key: "fluid", label: "Fluide", def: "water", gives: {}, shows: ["rho", "mu_mPa"], states: ["liquid", "gas"], own: true }];
/** model id → its slots : { key (the input that holds the id of the medium), label, def (the medium proposed), gives { input key : property },
    shows (properties shown though the model reads them itself), states, own (the model already has this input) }. */
export const MODEL_MEDIA = {
  beam_cantilever_point: BEAM, beam_cantilever_udl: BEAM, beam_simple_point: BEAM, beam_simple_udl: BEAM,
  column_buckling: [S("mat", "Matériau de la colonne", "AL6061-T6", { E: "E", Re: "Re" })], shaft_torsion: [S("mat", "Matériau de l'arbre", "AL6061-T6", { G: "G", Re: "Re" })], plate_pressure: [S("mat", "Matériau de la plaque", "AL6061-T6", { E: "E", Re: "Re" })],
  thermal_mismatch: [S("mat1", "Matériau 1", "AL6061-T6", { cte1: "cte", E1: "E", Re1: "Re" }), S("mat2", "Matériau 2", "STEEL-1018", { cte2: "cte", E2: "E", Re2: "Re" })],
  bolted_joint: [S("mat", "Matériau des pièces serrées", "AL6061-T6", { Em: "E", Re_p: "Re", Rm_t: "Rm" })],
  press_fit: [S("mat_h", "Matériau du moyeu", "STEEL-1018", { Eh: "E", nuh: "nu", Re_h: "Re" }), S("mat_s", "Matériau de l'arbre", "STEEL-1018", { Es: "E", nus: "nu", Re_s: "Re" })],
  dowel_pin: [S("mat", "Matériau des pièces", "AL6061-T6", { Re_p: "Re" })], pipe_flow: FLOW, orifice_flow: FLOW,
  conduction_stack: [S("mat1", "Couche 1", "AL6061-T6", { k1: "k" }), S("mat2", "Couche 2", "FR4", { k2: "k" }), S("mat3", "Couche 3", "SS-304", { k3: "k" }), S("mat_tim", "Interface thermique", "THERMAL-PAD", { tim_k: "k" })],
  heatsink_natural: [S("mat", "Matériau du dissipateur", "AL6063-T5", { k: "k" })], heatsink_forced: [S("mat", "Matériau du dissipateur", "AL6063-T5", { k: "k" })], lumped_mass: [S("mat", "Matériau de la masse", "AL6061-T6", { cp: "cp", k: "k", rho: "rho" })],
  spring_stop: [S("mat", "Alliage des lames", "CUBE-C17200", { E: "E", Re: "Re", rhoB: "rhoE_n" })], plastic_screw: [S("mat", "Plastique du bossage", "PC", { St: "Re" })],
  busbar: [S("mat", "Matériau du conducteur", "CU-C110", { rho20: "rhoE_n", alpha: "alphaE" })], adiabatic_pulse: [S("mat", "Matériau du conducteur", "CU-C110", { rho20: "rhoE_n", alpha: "alphaE", rho: "rho", cp: "cp", Tmelt: "Tmelt" })],
};
export const mediaSlots = (modelId) => MODEL_MEDIA[modelId] || [];
/** The media a model proposes when it opens : { slot key : medium id }. */
export const mediaDefaults = (modelId) => Object.fromEntries(mediaSlots(modelId).map((s) => [s.key, s.def]));
/** What the media chosen give to a model. inputs : the inputs (with the id of a medium under each slot key, or nothing : values typed before the base).
    → { values { input key : value }, from { input key : { slot, medium, name, prop } }, missing [{ slot, medium, key, prop }], shown [{ slot, medium, name, rows [[label, value, unit]] }] } */
export function mediaValues(modelId, inputs = {}) {
  const out = { values: {}, from: {}, missing: [], shown: [] }, T = Number.isFinite(inputs.T) ? inputs.T : undefined;
  for (const s of mediaSlots(modelId)) { const m = medium(inputs[s.key]); if (!m || !s.states.includes(m.state)) continue;
    const P = mediumProps(m.id, T), rows = [];
    for (const [key, prop] of Object.entries(s.gives)) { const v = P[prop]; if (typeof v === "number" && Number.isFinite(v)) { out.values[key] = v; out.from[key] = { slot: s.key, medium: m.id, name: m.name, prop }; } else out.missing.push({ slot: s.key, medium: m.id, name: m.name, key, prop }); }
    for (const prop of s.shows || []) if (Number.isFinite(P[prop])) rows.push([MEDIA_PROPS[prop].label, P[prop], MEDIA_PROPS[prop].unit]);
    out.shown.push({ slot: s.key, medium: m.id, name: m.name, state: m.state, rows, T: m.at ? T ?? 20 : null }); }
  return out;
}
