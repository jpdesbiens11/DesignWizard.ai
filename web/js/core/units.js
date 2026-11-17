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
  "MPa": ["ksi", PSI], "GPa": ["Msi", PSI], "kPa": ["psi", PSI], "Pa": ["psi", PSI * 1000], "L/min": ["gal/min", GAL], "cm³": ["in³", IN ** 3 / 1000],
};
/* a mass keeps its SI unit and adds the imperial one in brackets */
const DUAL = { "kg": ["lb", LB], "g": ["oz", LB * 1000 / 16] };

/** Clean preferences from anything. → { system : "si" | "imperial", pressure : "auto" | "kPa" | "bar" | "psi" | "atm" } */
export function tidyUnits(p) {
  const system = p && p.system === "imperial" ? "imperial" : "si", pressure = p && Object.prototype.hasOwnProperty.call(PRESSURE_UNITS, p.pressure) ? p.pressure : "auto";
  return { system, pressure };
}
export const SI_UNITS = Object.freeze({ system: "si", pressure: "auto" });
/** The units of a calculation — analytical models, simulation, isolation, calculation note, workbook : SI, whatever the designer chose for the
    design (the owner's rule : an engineering calculation is always written in SI). */
export const CALC_UNITS = SI_UNITS;
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

/* ---------- a length, a mass, a list of dimensions, a sentence : what the screens of the parts, the assemblies and the drawings write ---------- */
const comma = (x) => String(x).replace(".", ",");
/** A number to read in the unit shown : `d` decimals when nothing converts (the tool's own unit), four significant digits when it does (42 mm reads 1,654 in). */
export const shownNumber = (v, unit, d = 2, prefs) => (typeof v !== "number" || !Number.isFinite(v) ? v : converts(unit, prefs) ? Number(toShown(v, unit, prefs).toPrecision(4)) : Math.round(v * 10 ** d) / 10 ** d);
/** A quantity to read, rounded as a screen rounds it : « 12,5 mm », « 0,4921 in », « 1,83 kg (4,03 lb) ». */
export function measure(v, unit, d = 2, prefs, num = comma) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const u = shownUnit(unit, prefs), dual = dualOf(v, unit, prefs);
  return `${num(shownNumber(v, unit, d, prefs))}${u ? ` ${u}` : ""}${dual ? ` (${num(Number(dual[0].toPrecision(3)))} ${dual[1]})` : ""}`;
}
/** Several dimensions and one unit : « 160 × 110 × 42 mm », « 6,299 × 4,331 × 1,654 in ». */
export const measures = (list, unit, d = 1, prefs, num = comma) => `${list.map((v) => num(shownNumber(v, unit, d, prefs))).join(" × ")} ${shownUnit(unit, prefs)}`;
/** A mass given in grams, as it reads : grams under a kilogram, kilograms above — and, in the imperial system, ounces or pounds beside. */
export const massText = (g, prefs, num = comma) => (typeof g !== "number" || !Number.isFinite(g) ? "—" : g >= 1000 ? measure(g / 1000, "kg", 2, prefs, num) : measure(g, "g", 1, prefs, num));

/* the quantities a sentence may carry : one number or several (« 160 × 110 × 42 mm », « de 0,2 à 0,4 mm », « 0.2 to 0.5 mm »), then a unit that converts */
const NUMBER = "(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?!\\d)|\\d+)(?:[.,]\\d+)?", JOIN = "(?:\\s*[×–/-]\\s*|\\s+(?:x|à|et|ou|to|and|or)\\s+)";      // « 16,56 / 6,27 mm » : measured / required, both in the unit that follows
const PROSE_UNITS = [...Object.keys(IMPERIAL), "kPa", ...Object.keys(DUAL)].filter((u, i, a) => a.indexOf(u) === i).sort((a, b) => b.length - a.length);
const PROSE = new RegExp(`(?<![\\d.,])(${NUMBER}(?:${JOIN}${NUMBER})*)(\\s?)(${PROSE_UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})(?![A-Za-zÀ-ÿ0-9²³⁴·/])`, "g");
/** A sentence written in the units of the tools, read in the units chosen : every quantity it carries is converted where it stands, to three
    significant digits, written the way the sentence writes its numbers (comma or point) ; a mass gets its imperial reading in brackets.
    Nothing changes in SI, nor in what is not a quantity (« M3 × 0,5 », « 1,5 d », « ISO 2768 »), nor in the size of a metric tool, which is
    its name and not a measure (« Clé six pans de 3 mm » : the key of an M4 screw is a 3 mm key in any workshop).
    o.rule(unit, largest value, prefs) → [unit shown, SI units per unit shown] or null : a trade that reads a unit its own way (a board in mil). */
const TOOL = /(?<![A-Za-zÀ-ÿ])(?:clé|clef|douille|embout|tournevis|taraud|hex key|wrench|socket|driver)(?![A-Za-zÀ-ÿ])[^.;:,(]{0,24}$/i;
export function proseUnits(text, prefs, o = {}) {
  if (typeof text !== "string" || !text) return text;
  const u = tidyUnits(prefs); if (u.system === "si" && u.pressure === "auto") return text;
  return text.replace(PROSE, (all, nums, gap, unit, at, whole) => {
    if (TOOL.test(whole.slice(Math.max(0, at - 40), at))) return all;
    const point = /\d\.\d/.test(nums) && !/,/.test(nums), read = (t) => Number(t.replace(/[ \u00a0\u202f]/g, "").replace(",", ".")), write = (v) => { const t = String(Number(v.toPrecision(3))); return point ? t : t.replace(".", ","); };
    const own = o.rule ? o.rule(unit, Math.max(...nums.match(new RegExp(NUMBER, "g")).map(read)), u) : null, dual = !own && DUAL[unit] && u.system === "imperial", [shown, k] = dual ? DUAL[unit] : own || rule(unit, u); if (k === 1 && !dual) return all;
    if (dual) return new RegExp(`^${NUMBER}$`).test(nums) ? `${all} (${write(read(nums) / k)} ${shown})` : all;
    return `${nums.replace(new RegExp(NUMBER, "g"), (t) => write(read(t) / k))}${gap || " "}${shown}`;
  });
}

/* a document to read (the neutral model core/docx.js and core/pdfdoc.js print) : its sentences, its lists, the cells of its tables, read in the units chosen.
   What a block IS — its type, its style, a colour, a picture — is left alone ; a value and its unit kept in two cells of a table stay as they are, together. */
const DOC_KEEP = new Set(["type", "style", "fill", "align", "kind", "id", "png", "pngSize", "widths", "reference", "revision", "date"]);
/** A document model in the units chosen. Nothing changes in SI. o.si : a pattern — a section whose heading matches it stays as written, down to the
    next heading of its level or above (the sections that report calculations keep their SI units). */
export function docUnits(doc, prefs, o = {}) {
  const u = tidyUnits(prefs); if (!doc || (u.system === "si" && u.pressure === "auto")) return doc;
  let kept = 0;      // the level of the heading that opened a section left as written — 0 outside one
  const asWritten = (b) => { const m = o.si && b && /^h([1-6])$/.exec(b.type || ""); if (m) { if (o.si.test(b.text || "")) kept = +m[1]; else if (kept && +m[1] <= kept) kept = 0; } return kept > 0; };
  const walk = (v, key) => (typeof v === "string" ? (DOC_KEEP.has(key) ? v : proseUnits(v, u, o)) : Array.isArray(v) ? v.map((x) => walk(x, key)) : v && typeof v === "object" && !(v instanceof Uint8Array) && !(v instanceof Date) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, DOC_KEEP.has(k) ? x : walk(x, k)])) : v);
  return { ...doc, blocks: (doc.blocks || []).map((b) => (asWritten(b) ? b : walk(b, "blocks"))) };
}

/* ---------- the choice, kept in this browser ---------- */
const KEY = "dw.units";
let memo = null;
/** The units in force. Without a browser (tests, tools) : SI. The choice is the SYSTEM : a pressure follows it (kPa, or psi) — the unit of a
    pressure was once a choice of its own, for the analytical models, which now stay in SI ; a choice kept by an older version is not read. */
export function getUnits() {
  if (memo) return memo;
  let p = null;
  try { p = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(KEY) || "null") : null; } catch (e) { p = null; }
  memo = tidyUnits({ system: p && p.system }); return memo;
}
/** Changes the units and tells the screens (« dw:units » on the window). → the units in force */
export function setUnits(patch) {
  memo = tidyUnits({ system: { ...getUnits(), ...patch }.system });
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(memo)); } catch (e) { /* private window : the choice lasts for this page only */ }
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("dw:units", { detail: memo }));
  return memo;
}
