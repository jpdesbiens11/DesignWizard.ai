/* DynamiteOrbit.ai — Logiciel : the PHYSICAL UNITS on the screen (demande de JP, 24 novembre 2026 : « tous les aspects physiques de la simulation
   doivent être concrets et en unités de la physique, non des variables de −50 000 à +50 000 qui ne veulent rien dire ; mets les conversions et
   gère la complexité en arrière-plan »).
   Inside, the software counts in whole numbers — mV, mA, tenths of a degree, per mille, mWh — because that is what a microcontroller does
   well and what the C is proved on, back to back (sw/sw_objects.js). On the screen, every quantity is shown in the unit of physics — V, A,
   °C, %, Wh — and what one types there is converted back, rounded to the whole number the software keeps. A state is shown by its name.
   Pure : no page. */

/** unit inside → { u : unit shown, k : how many inside per shown, d : decimals shown } */
export const PHYS = { mV: { u: "V", k: 1000, d: 3 }, mA: { u: "A", k: 1000, d: 3 }, "0.1 °C": { u: "°C", k: 10, d: 1 }, mWh: { u: "Wh", k: 1000, d: 3 }, "‰": { u: "%", k: 10, d: 1 }, kPa: { u: "kPa", k: 1, d: 0 }, rpm: { u: "tr/min", k: 1, d: 0 }, ms: { u: "ms", k: 1, d: 0 } };
export const STATE_NAMES = ["NORMAL", "DÉRATÉ", "URGENCE", "ARRÊT"];
/** The unit shown for a unit inside. */
export const shownUnit = (unit) => (PHYS[unit] ? PHYS[unit].u : unit === "counts" ? "comptes" : unit === "0/1" ? "" : unit || "");
/** A value inside, as a number in the unit shown. */
export const toShown = (v, unit) => (PHYS[unit] && Number.isFinite(v) ? v / PHYS[unit].k : v);
/** A number typed in the unit shown, back to the whole number inside. */
export const toInside = (x, unit) => (PHYS[unit] ? Math.round(Number(x) * PHYS[unit].k) : Math.round(Number(x)));
/** The step of a field in the unit shown : one whole number inside. */
export const shownStep = (unit) => (PHYS[unit] ? 1 / PHYS[unit].k : 1);
const fr = (n, d) => { const s = (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, "") || "0"; const [a, b] = s.split("."); return `${a.replace("-", "−").replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${b ? `,${b}` : ""}`; };
/** A value inside, written for a person : « 4,25 V », « 25 °C », « ARRÊT », « 1 ». */
export function physText(v, unit, withUnit = true) {
  if (v === undefined || v === null || v === "") return "";
  if (unit === "state") return STATE_NAMES[v] || String(v);
  if (unit === "0/1") return String(v);
  const P = PHYS[unit]; if (!P) return `${fr(v, 0)}${withUnit && unit ? ` ${shownUnit(unit)}` : ""}`;
  return `${fr(v / P.k, P.d)}${withUnit ? ` ${P.u}` : ""}`;
}
