/* DesignWizard.ai — units : what is shown, in the system the designer reads. Inside, nothing changes — every tool keeps its
   SI practical units (mm, N, MPa, kPa, °C) and the project file stays SI ; this module converts at the edges only : a value
   to show, a value typed.
   Two systems. « SI ». « Imperial », an engineering hybrid : the inch and the pound-force with what derives from them — in²,
   in³, in⁴, µin, lbf·in, lbf/in, psi, ksi, Msi, US gal/min — while the metre, the metre per second and the kilogram stay
   (a mass reads « kg (lb) »), with the degree Celsius, the kelvin, the watt, the ampere and all that is thermal or electrical.
   No slug, no poundal, no BTU.
   A pressure given in kPa has its own choice — kPa, bar, psi, atm — and can show its equivalents.
   Every factor is the SI value of one imperial unit, exact where the unit is defined so (inch, pound, gallon, atmosphere). */

const IN = 25.4, LBF = 4.4482216152605, LB = 0.45359237, GAL = 3.785411784, PSI = LBF / (IN * IN) * 1e3;      // mm, N, kg, L ; kPa per psi (6.894757…)
export const UNIT_SYSTEMS = {
  si: { label: "SI", hint: "mm · N · MPa · kPa · L/min" },
  imperial: { label: "Impérial", hint: "in · lbf · ksi · psi · gal/min — le m, le m/s et le kg restent ; masse en kg (lb)" },
};
/** The choices for a pressure given in kPa : the kPa that one unit is worth. « auto » follows the system (kPa, or psi). */
export const PRESSURE_UNITS = { kPa: 1, bar: 100, psi: PSI, atm: 101.325 };
/* SI practical unit → [imperial unit, how much of the SI unit one imperial unit is worth] */
const IMPERIAL = {
  "mm": ["in", IN], "µm": ["µin", IN / 1000], "mm²": ["in²", IN ** 2], "cm²": ["in²", IN ** 2 / 100], "mm³": ["in³", IN ** 3], "mm⁴": ["in⁴", IN ** 4],
  "N": ["lbf", LBF], "kN": ["lbf", LBF / 1000], "N·m": ["lbf·in", LBF * IN / 1000], "N·mm": ["lbf·in", LBF * IN], "N/mm": ["lbf/in", LBF / IN], "N·m/rad": ["lbf·in/rad", LBF * IN / 1000],
  "MPa": ["ksi", PSI], "GPa": ["Msi", PSI], "kPa": ["psi", PSI], "Pa": ["psi", PSI * 1000], "L/min": ["gal/min", GAL],
};
/* a mass keeps its SI unit and adds the imperial one in brackets */
const DUAL = { "kg": ["lb", LB], "g": ["oz", LB * 1000 / 16] };

/** Clean preferences from anything. → { system : "si" | "imperial", pressure : "auto" | "kPa" | "bar" | "psi" | "atm" } */
export function tidyUnits(p) {
  const system = p && p.system === "imperial" ? "imperial" : "si", pressure = p && Object.prototype.hasOwnProperty.call(PRESSURE_UNITS, p.pressure) ? p.pressure : "auto";
  return { system, pressure };
}
export const SI_UNITS = Object.freeze({ system: "si", pressure: "auto" });
/** The pressure unit in force : the one chosen, or the one of the system. */
export const pressureUnit = (prefs) => { const u = tidyUnits(prefs); return u.pressure !== "auto" ? u.pressure : u.system === "imperial" ? "psi" : "kPa"; };

/* [unit shown, SI units per unit shown] for a quantity given in `unit` */
function rule(unit, prefs) {
  const u = tidyUnits(prefs);
  if (unit === "kPa") { const pu = pressureUnit(u); return [pu, PRESSURE_UNITS[pu]]; }
  if (u.system === "imperial" && IMPERIAL[unit]) return IMPERIAL[unit];
  return [unit, 1];
}
/** The unit a quantity given in `unit` is shown in. */
export const shownUnit = (unit, prefs) => rule(unit, prefs)[0];
/** A value given in `unit`, in the unit shown. */
export const toShown = (v, unit, prefs) => (typeof v === "number" && Number.isFinite(v) ? v / rule(unit, prefs)[1] : v);
/** A value typed in the unit shown, back in `unit`. Cleaned of the dust of the floating point : 0.25 in is 6.35 mm. */
export function fromShown(v, unit, prefs) {
  if (typeof v !== "number" || !Number.isFinite(v)) return v;
  const k = rule(unit, prefs)[1];
  return k === 1 ? v : Number((v * k).toPrecision(12));
}
/** True when the system shows this unit as another one. */
export const converts = (unit, prefs) => rule(unit, prefs)[1] !== 1;
/** The second reading of a mass in the imperial system : [value, unit] — or null. */
export function dualOf(v, unit, prefs) {
  if (tidyUnits(prefs).system !== "imperial" || !DUAL[unit] || typeof v !== "number" || !Number.isFinite(v)) return null;
  return [v / DUAL[unit][1], DUAL[unit][0]];
}
/** A pressure in kPa in the four units : [[unit, value]], the unit in force first. */
export function pressureEquivalents(kPa, prefs) {
  if (typeof kPa !== "number" || !Number.isFinite(kPa)) return [];
  const first = pressureUnit(prefs);
  return [first, ...Object.keys(PRESSURE_UNITS).filter((k) => k !== first)].map((k) => [k, kPa / PRESSURE_UNITS[k]]);
}
/** A quantity to read : « 1,23 in », « 0,096 psi », « 1,83 kg (4,03 lb) ». num : how a number is written (the caller's own way). */
export function quantity(v, unit, prefs, num = (x) => String(x).replace(".", ",")) {
  const u = shownUnit(unit, prefs), d = dualOf(v, unit, prefs);
  return `${num(toShown(v, unit, prefs))}${u ? ` ${u}` : ""}${d ? ` (${num(d[0])} ${d[1]})` : ""}`.trim();
}
/** A number to put in a field : as it is when nothing converts, five significant digits when it does (4 mm reads 0.15748 in). */
export const fieldValue = (v, unit, prefs) => (typeof v === "number" && Number.isFinite(v) ? Number(toShown(v, unit, prefs).toPrecision(converts(unit, prefs) ? 5 : 12)) : v);

/* ---------- the choice, kept in this browser ---------- */
const KEY = "dw.units";
let memo = null;
/** The units in force. Without a browser (tests, tools) : SI. */
export function getUnits() {
  if (memo) return memo;
  let p = null;
  try { p = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(KEY) || "null") : null; } catch (e) { p = null; }
  memo = tidyUnits(p); return memo;
}
/** Changes the units and tells the screens (« dw:units » on the window). → the units in force */
export function setUnits(patch) {
  memo = tidyUnits({ ...getUnits(), ...patch });
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(memo)); } catch (e) { /* private window : the choice lasts for this page only */ }
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("dw:units", { detail: memo }));
  return memo;
}
