/* DynamiteOrbit.ai — Logiciel : THE MODULE ON THE BENCH AS A 1.5D SYSTEM MODEL (JP, 28 novembre 2026 : « mettre dans la marge de droite les
   paramètres du pack qui permettent d'évaluer performance et aspect thermique transitoire durant les missions qu'on va simuler de manière système
   1.5D comme dans LMS Amesim de Siemens ; les conditions aux frontières sont aussi définies dans ce pan » ; inspiré du simulateur que JP a monté et
   recoupé avec des calculs Matlab — ses principes seulement : aucune de ses valeurs, aucun de ses profils, aucun de ses textes).
   ELECTRICAL — each CORE (a cell block : np cells in parallel) is an open-circuit curve and a resistance that follows the temperature (Arrhenius)
   and the state of charge (it rises when the block is nearly empty) ; its usable capacity falls in the cold. A mission may impose a POWER : the
   current is the root of P = (Σ OCV − I·Σ R)·I, clamped to what the cells allow.
   THERMAL, 1.5D — one AXIS along the stack of CORE (conduction CORE to CORE, the two ends to the lids), and for each CORE the HALF-AXIS across :
   to the casing, then the air ; and, the pump running, to a coolant that flows along the stack and warms CORE after CORE (inlet temperature, flow).
   Every capacity and conductance is a lumped value of the system, as a system-simulation tool writes them — a network of nodes, not a field.
   Every value is TYPICAL until the project enters or confirms it : the cell's own figures are those of its sheet, read (Molicel P45B) ; the others
   are examples, and the screen says so. Pure. */

/** The groups of the panel, in the order one reads them. */
export const MODEL_GROUPS = [
  { key: "cell", fr: "Cell", icon: "power", color: "#2563eb", says: "Une cellule de la fiche : ce qui fait la performance." },
  { key: "pack", fr: "Pack", icon: "layers", color: "#7c3aed", says: "Comment les cellules sont montées." },
  { key: "thermal", fr: "Thermique 1.5D", icon: "thermal", color: "#ea580c", says: "Les nœuds et ce qui les relie : CORE, boîtier, liquide." },
  { key: "bc", fr: "Conditions aux frontières", icon: "sensor", color: "#0891b2", says: "Ce que le module voit autour de lui." },
  { key: "limits", fr: "Limites", icon: "warning", color: "#dc2626", says: "Ce que le module ne dépasse pas, quoi qu'on lui demande." },
];
const READ = "fiche Molicel INR-21700-P45B (ver. 0.2), lue", TYP = "valeur typique, à confirmer", EX = "exemple du projet, à confirmer";
/** Each parameter : its group, its words (fr ; en : the name of the trade), its unit, its typical value and where that value comes from. */
export const MODEL_PARAMS = [
  { key: "capCell", group: "cell", fr: "Capacité d'une cell", en: "Cell capacity", unit: "Ah", typical: 4.5, min: 0.5, max: 100, step: 0.05, basis: `${READ}, p. 3` },
  { key: "rCell", group: "cell", fr: "Résistance DC d'une cell à 25 °C", en: "Cell DC resistance", unit: "mΩ", typical: 25.6, min: 1, max: 200, step: 0.1, basis: `${TYP} (la fiche donne ≤ 8 mΩ à 1 kHz, pas la résistance DC)` },
  { key: "ea", group: "cell", fr: "Énergie d'activation de la résistance", en: "Activation energy (Arrhenius)", unit: "kJ/mol", typical: 25, min: 0, max: 80, step: 1, basis: TYP },
  { key: "capCold", group: "cell", fr: "Capacité utile à 0 °C", en: "Usable capacity at 0 °C", unit: "%", typical: 90, min: 30, max: 100, step: 1, basis: TYP },
  { key: "mCell", group: "cell", fr: "Masse d'une cell", en: "Cell mass", unit: "g", typical: 70, min: 5, max: 2000, step: 1, basis: `${READ}, p. 2` },
  { key: "cpCell", group: "cell", fr: "Chaleur massique d'une cell", en: "Cell specific heat", unit: "J/(kg·K)", typical: 1000, min: 500, max: 2000, step: 10, basis: TYP },
  { key: "np", group: "pack", fr: "Cells en parallèle par CORE", en: "Cells in parallel", unit: "", typical: 8, min: 1, max: 64, step: 1, basis: "l'architecture du projet (8 cellules par CORE)" },
  { key: "inertia", group: "pack", fr: "Masse thermique d'un CORE / masse de ses cells", en: "Thermal mass factor", unit: "×", typical: 1.2, min: 1, max: 5, step: 0.05, basis: `${EX} (supports, busbar, flex)` },
  { key: "gCC", group: "thermal", fr: "Conduction d'un CORE au suivant", en: "Core-to-core conductance", unit: "W/K", typical: 1, min: 0, max: 50, step: 0.1, basis: EX },
  { key: "gCW", group: "thermal", fr: "D'un CORE au boîtier", en: "Core-to-casing conductance", unit: "W/K", typical: 0.3, min: 0, max: 20, step: 0.05, basis: EX },
  { key: "cCase", group: "thermal", fr: "Capacité thermique du boîtier", en: "Casing heat capacity", unit: "J/K", typical: 900, min: 50, max: 50000, step: 10, basis: EX },
  { key: "hExt", group: "thermal", fr: "Convection du boîtier vers l'air", en: "External convection coefficient", unit: "W/(m²·K)", typical: 5, min: 0, max: 200, step: 0.5, basis: `${TYP} (air calme)` },
  { key: "aCase", group: "thermal", fr: "Surface du boîtier vers l'air", en: "Casing area", unit: "m²", typical: 0.25, min: 0.01, max: 10, step: 0.01, basis: EX },
  { key: "gCool", group: "thermal", fr: "D'un CORE au liquide, pompe en marche", en: "Core-to-coolant conductance", unit: "W/K", typical: 2, min: 0, max: 100, step: 0.1, basis: EX },
  { key: "flow", group: "thermal", fr: "Débit du liquide", en: "Coolant flow", unit: "L/min", typical: 2, min: 0.05, max: 100, step: 0.05, basis: EX },
  { key: "gEnd", group: "thermal", fr: "D'un bout de l'empilement à son couvercle", en: "End conductance", unit: "W/K", typical: 0.2, min: 0, max: 20, step: 0.05, basis: EX },
  { key: "amb", group: "bc", fr: "Température ambiante", en: "Ambient temperature", unit: "°C", typical: 25, min: -40, max: 85, step: 1, basis: EX },
  { key: "tInit", group: "bc", fr: "Température au départ", en: "Initial temperature", unit: "°C", typical: 25, min: -40, max: 85, step: 1, basis: EX },
  { key: "tCoolIn", group: "bc", fr: "Entrée du liquide", en: "Coolant inlet temperature", unit: "°C", typical: 25, min: -40, max: 85, step: 1, basis: EX },
  { key: "ends", group: "bc", fr: "Bouts de l'empilement", en: "Stack ends", unit: "", typical: "lids", values: [["lids", "vers les couvercles (à l'ambiante)"], ["adiabatic", "adiabatiques"]], basis: EX },
  { key: "iMaxCell", group: "limits", fr: "Courant max d'une cell, décharge", en: "Max continuous discharge", unit: "A", typical: 45, min: 1, max: 500, step: 1, basis: `${READ}, p. 3` },
  { key: "iChgCell", group: "limits", fr: "Courant max d'une cell, charge", en: "Max continuous charge", unit: "A", typical: 9, min: 0.5, max: 200, step: 0.5, basis: `${READ}, p. 3` },
  { key: "pPeak", group: "limits", fr: "Puissance de crête du module", en: "Peak power", unit: "kW", typical: 10, min: 0.1, max: 1000, step: 0.1, basis: EX },
];
const P_OF = Object.fromEntries(MODEL_PARAMS.map((p) => [p.key, p]));
/** What the model does not do — said beside it. */
export const MODEL_GAPS = [
  "Un CORE est un nœud : l'écart de température entre ses 8 cellules n'est pas calculé.",
  "Ni chaleur entropique ni effet de la vitesse de charge sur la capacité : seulement I²R et les résistances d'équilibrage.",
  "Un seul canal de liquide, qui longe l'empilement ; sa capacité propre est négligée (régime établi à chaque seconde).",
  "Les valeurs sans fiche sont des exemples : le modèle n'est pas recalé sur des mesures du module.",
];

/** The model of a software's module : the typical values, then what the project entered (`design.plant.model`). → { v: { key: value }, sure: [key], set: [key] } */
export function modelOf(d) {
  const own = (d && d.plant && d.plant.model) || {}, v = {};
  for (const p of MODEL_PARAMS) v[p.key] = own.values && own.values[p.key] !== undefined ? own.values[p.key] : p.typical;
  return { v, sure: [...(own.sure || [])], set: Object.keys(own.values || {}) };
}
/** One value entered by a person (it is confirmed by being entered). → the new `plant.model` */
export function setParam(model, key, value) {
  const p = P_OF[key]; if (!p) return model; const m = JSON.parse(JSON.stringify(model || {})); m.values = m.values || {};
  m.values[key] = p.values ? (p.values.some((x) => x[0] === value) ? value : p.typical) : Math.min(p.max, Math.max(p.min, Number(value)));
  m.sure = [...new Set([...(m.sure || []), key])]; return m;
}
/** Every value confirmed as it is. */
export const confirmAll = (model) => ({ ...JSON.parse(JSON.stringify(model || {})), sure: MODEL_PARAMS.map((p) => p.key) });
/** The values still examples : neither entered nor confirmed. → [param] */
export const unsureParams = (d) => { const M = modelOf(d); return MODEL_PARAMS.filter((p) => !M.sure.includes(p.key)); };
export const paramOf = (key) => P_OF[key];

/* ---------- the physics ---------- */
const RG = 8.314e-3;      // kJ/(mol·K)
/** How the resistance of a block moves with its temperature (Arrhenius, from 25 °C) and its state of charge (it rises when nearly empty). */
export function rFactor(T, soc, v) { const a = Math.exp((v.ea / RG) * (1 / (T + 273.15) - 1 / 298.15)), x = Math.min(1, Math.max(0, soc)); return a * (1 + 0.9 * Math.exp(-12 * x)) / (1 + 0.9 * Math.exp(-6)); }
/** The share of the capacity a block can give at a temperature : 1 from 23 °C, capCold at 0 °C, falling on below. */
export function capFactor(T, v) { const c0 = v.capCold / 100; if (T >= 23) return 1; if (T >= 0) return c0 + (1 - c0) * T / 23; return Math.max(0.3, c0 + (1 - c0) * T / 23); }
/** The current that gives a power (W ; + discharge) from a voltage at rest and a resistance in series. → { i (A, + into the pack), max (the power asked is beyond the module) } */
export function solvePower(P, vOcv, rSum) {
  if (!P) return { i: 0, max: false };
  if (P > 0) { const dc = vOcv * vOcv - 4 * rSum * P; return dc > 0 ? { i: -(vOcv - Math.sqrt(dc)) / (2 * rSum), max: false } : { i: -vOcv / (2 * rSum), max: true }; }
  const q = -P; return { i: (-vOcv + Math.sqrt(vOcv * vOcv + 4 * rSum * q)) / (2 * rSum), max: false };
}
/** The nodes at the start : each CORE, the casing, the coolant along the stack — all at `tInit`. */
export const thermalStart = (n, v) => ({ tk: new Array(n).fill(v.tInit), tc: v.tInit, cool: new Array(n + 1).fill(v.tCoolIn) });
/** One step (dt s) of the network. q : the heat of each CORE (W) ; pump : the coolant flows ; amb : the air (°C) ; ext : { k, w } heat from outside on a CORE.
    Explicit, a second at a time : the conductances are small beside the capacities (the screen says when a value makes it unstable — stableDt). → Th */
export function thermalStep(Th, q, v, { pump = false, amb = v.amb, ext = null, dt = 1 } = {}) {
  const n = Th.tk.length, C = v.mCell / 1000 * v.cpCell * v.np * v.inertia, gca = v.hExt * v.aCase, mcp = (v.flow / 60) * 1.0 * 3600, d = new Array(n).fill(0);
  /* the coolant : it enters at tCoolIn and takes the heat of each CORE in turn (a steady stream each second) */
  Th.cool[0] = v.tCoolIn; let toCase = 0;
  for (let k = 0; k < n; k++) {
    const T = Th.tk[k]; let f = q[k] + (ext && ext.k === k ? ext.w : 0);
    if (k > 0) f += v.gCC * (Th.tk[k - 1] - T); if (k < n - 1) f += v.gCC * (Th.tk[k + 1] - T);
    f += v.gCW * (Th.tc - T); toCase += v.gCW * (T - Th.tc);
    if (v.ends !== "adiabatic" && (k === 0 || k === n - 1)) f += v.gEnd * (amb - T);
    if (pump) { const w = v.gCool * (T - Th.cool[k]); f -= w; Th.cool[k + 1] = Th.cool[k] + w / mcp; } else Th.cool[k + 1] = Th.cool[k];
    d[k] = f * dt / C;
  }
  for (let k = 0; k < n; k++) Th.tk[k] += d[k];
  Th.tc += (toCase + gca * (amb - Th.tc)) * dt / v.cCase;
  return Th;
}
/** The net heat that leaves a CORE through the network, now (W) — what heat from outside must give to hold it. */
export function lossOf(Th, k, v, { pump = false, amb = v.amb } = {}) {
  const n = Th.tk.length, T = Th.tk[k]; let w = v.gCW * (T - Th.tc);
  if (k > 0) w += v.gCC * (T - Th.tk[k - 1]); if (k < n - 1) w += v.gCC * (T - Th.tk[k + 1]);
  if (v.ends !== "adiabatic" && (k === 0 || k === n - 1)) w += v.gEnd * (T - amb); if (pump) w += v.gCool * (T - Th.cool[k]);
  return w;
}
/** What the panel shows beside the values : the module's nominal voltage and energy, its mass of cells, the time constant of a CORE, the largest
    step the network allows. n : the CORE in series. */
export function modelSummary(v, n = 8) {
  const C = v.mCell / 1000 * v.cpCell * v.np * v.inertia, gOut = v.gCW + v.gCC * 2 + v.gEnd + v.gCool, capAh = v.capCell * v.np;
  return { vNom: 3.6 * n, eWh: 3.6 * n * capAh, capAh, massKg: v.mCell * v.np * n / 1000, cCore: C, tauMin: C / Math.max(1e-6, v.gCW) / 60, stableDt: C / Math.max(1e-6, gOut), iMax: v.iMaxCell * v.np, iChg: v.iChgCell * v.np };
}
