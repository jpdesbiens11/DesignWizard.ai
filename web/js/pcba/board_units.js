/* DesignOrbit.ai — the lengths of a board, read as an electronics designer reads them. In SI : the millimetre, and the micrometre for a
   foil or a coating. In the imperial system : the mil — a thousandth of an inch, 0.0254 mm exactly — for what is drawn in copper, drilled
   or coated, and the inch from one inch up (the outline of the board, the length of copper laid). A copper foil is called by its weight
   (« 1 oz »), the name the trade gives it. The board itself stays in millimetres, and so do its fabrication files : this module converts
   what a screen or a report WRITES, and what is typed in a field. Pure. */

import { tidyUnits, getUnits, proseUnits, docUnits } from "../core/units.js";

const MIL = 0.0254, IN = 25.4;
const imperial = (prefs) => tidyUnits(prefs).system === "imperial";
const write = (x) => String(x).replace(".", ",");
const cut = (v, d) => Math.round(v * 10 ** d) / 10 ** d, lead = (v) => (Math.abs(v) >= 1000 ? Math.round(v) : Number(v.toPrecision(3)));      // three significant digits, and never less than the unit

/** [unit, millimetres per unit] for a length of `mm` millimetres : the mil under an inch, the inch from there — the millimetre in SI. */
export const boardRule = (mm, prefs = getUnits()) => (!imperial(prefs) ? ["mm", 1] : Math.abs(mm) < IN - 1e-9 ? ["mil", MIL] : ["in", IN]);
/** The unit of a field or of a column : kind « mil » (copper, drills, clearances) or « in » (the outline, a length of track) — « mm » in SI. */
export const boardUnit = (kind = "mil", prefs = getUnits()) => (imperial(prefs) ? (kind === "in" ? "in" : "mil") : "mm");
const factor = (kind, prefs) => (imperial(prefs) ? (kind === "in" ? IN : MIL) : 1);
/** A number alone, for a column whose head names the unit : « 0,15 » (mm), « 5,91 » (mil). */
export const boardNum = (mm, kind = "mil", d = 2, prefs = getUnits()) => (typeof mm !== "number" || !Number.isFinite(mm) ? "—" : write(imperial(prefs) ? lead(mm / factor(kind, prefs)) : cut(mm, d)));
/** A length to read : « 0,15 mm », « 5,91 mil », « 3,15 in ». */
export function boardLen(mm, d = 2, prefs = getUnits()) {
  if (typeof mm !== "number" || !Number.isFinite(mm)) return "—";
  const [unit, k] = boardRule(mm, prefs);
  return `${write(k === 1 ? cut(mm, d) : lead(mm / k))} ${unit}`;
}
/** Several lengths and one unit, the one of the largest : « 80 × 50 mm », « 3,15 × 1,97 in », « 276 × 276 × 55,1 mil ». */
export function boardDims(list, d = 2, prefs = getUnits(), join = " × ") {
  const [unit, k] = boardRule(Math.max(...list.map((v) => Math.abs(v))), prefs);
  return `${list.map((v) => write(k === 1 ? cut(v, d) : lead(v / k))).join(join)} ${unit}`;
}
/** What a field shows for a value kept in millimetres (five significant digits when converted : 0.15 mm reads 5.9055 mil). */
export const boardField = (mm, kind = "mil", prefs = getUnits()) => (typeof mm !== "number" || !Number.isFinite(mm) ? mm : imperial(prefs) ? Number((mm / factor(kind, prefs)).toPrecision(5)) : mm);
/** What was typed in that field, back in millimetres : 6 mil is 0.1524 mm. */
export const boardBack = (v, kind = "mil", prefs = getUnits()) => (typeof v !== "number" || !Number.isFinite(v) || !imperial(prefs) ? v : Number((v * factor(kind, prefs)).toPrecision(12)));
/** The label of that field : « Largeur (mm) » reads « Largeur (mil) » ; a label without a unit gets one when the value is converted. */
export const boardLabel = (label, kind = "mil", prefs = getUnits()) => (imperial(prefs) ? `${String(label).replace(/ ?\((?:mm|µm)\)$/, "")} (${boardUnit(kind, prefs)})` : label);

/* ---------- a foil, a coating : micrometres, or mil ---------- */
/** A thickness given in micrometres : « 50 µm », « 1,97 mil ». */
export const foilLen = (um, prefs = getUnits()) => (typeof um !== "number" || !Number.isFinite(um) ? "—" : imperial(prefs) ? `${write(lead(um / 1000 / MIL))} mil` : `${write(um)} µm`);
export const foilField = (um, prefs = getUnits()) => (typeof um !== "number" || !Number.isFinite(um) || !imperial(prefs) ? um : Number((um / 1000 / MIL).toPrecision(5)));
export const foilBack = (v, prefs = getUnits()) => (typeof v !== "number" || !Number.isFinite(v) || !imperial(prefs) ? v : Number((v * MIL * 1000).toPrecision(12)));
/* the weight the trade calls a foil by : ounces of copper per square foot — a name, like a thread size ; the thickness beside is the one the board keeps */
export const COPPER_WEIGHT = { 18: "½ oz", 35: "1 oz", 70: "2 oz" };
/** A copper foil : « 35 µm », or — imperial — « 1 oz (1,38 mil) ». */
export const copperName = (um, prefs = getUnits()) => (imperial(prefs) && COPPER_WEIGHT[um] ? `${COPPER_WEIGHT[um]} (${foilLen(um, prefs)})` : foilLen(um, prefs));

/* ---------- a sentence, a document ---------- */
const rule = (unit, max, u) => (u.system !== "imperial" ? null : unit === "mm" ? (max < IN - 1e-9 ? ["mil", MIL] : ["in", IN]) : unit === "µm" ? ["mil", MIL * 1000] : null);
/** A sentence about a board, written in millimetres by a tool : « piste de 0,15 mm » reads « piste de 5,91 mil », « 1 250 mm de cuivre » « 49,2 in de cuivre ». */
export const boardProse = (text, prefs = getUnits()) => proseUnits(text, prefs, { rule });
/** A document to read about a board (its design review), block by block. */
export const boardDoc = (doc, prefs = getUnits()) => docUnits(doc, prefs, { rule });
