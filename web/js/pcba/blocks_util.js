/* DesignWizard.ai — PCBA: what every function-block template shares — preferred values, the way values are written,
   and a small builder that collects the parts, nets, ports, sizing lines and layout notes of one block. */

const E6 = [1, 1.5, 2.2, 3.3, 4.7, 6.8], E24 = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
const E96 = Array.from({ length: 96 }, (_, i) => Math.round(100 * 10 ** (i / 96)) / 100);
const SERIES = { E6, E24, E96 };
/** Nearest preferred value of a series ("E6", "E24", "E96") ; mode "up" or "down" takes the next one on that side. */
export function eSeries(value, series = "E24", mode = "near") {
  if (!(value > 0)) return 0;
  const dec = 10 ** Math.floor(Math.log10(value)), list = [...SERIES[series].map((x) => x * dec / 10), ...SERIES[series].map((x) => x * dec), ...SERIES[series].map((x) => x * dec * 10)];
  const ok = mode === "up" ? list.filter((x) => x >= value * (1 - 1e-9)) : mode === "down" ? list.filter((x) => x <= value * (1 + 1e-9)) : list;
  const best = ok.reduce((b, x) => (Math.abs(Math.log(x / value)) < Math.abs(Math.log(b / value)) ? x : b), ok[0]);
  return +best.toPrecision(3);
}
/** A number the French way : decimal comma, no trailing zeros. */
export const fr = (x, digits = 3) => String(+(+x).toPrecision(digits)).replace(".", ",");
const scaled = (v, unit, steps) => { for (const [k, p] of steps) if (Math.abs(v) >= k * 0.9999) return `${fr(v / k)} ${p}${unit}`; return `${fr(v)} ${unit}`; };
export const ohm = (r) => scaled(r, "Ω", [[1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"]]);
export const farad = (c) => scaled(c, "F", [[1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]]);
export const henry = (l) => scaled(l, "H", [[1e-3, "m"], [1e-6, "µ"], [1e-9, "n"]]);

/** Collects one block. part(id, comp, value, role, extra) ; net(name, pins, attrs) merges pins into the named net ;
    port(name, net, dir, suggest, extra) ; calc(label, value, unit, text) ; note(text). */
export function builder() {
  const parts = [], nets = new Map(), ports = {}, calc = [], notes = [];
  return {
    part(id, comp, value, role, extra = {}) { parts.push({ id, comp, value, role, ...extra }); return this; },
    net(name, pins, attrs = {}) {
      const n = nets.get(name) || { name, class: "signal", voltage: 0, current: 0, pins: [] };
      Object.assign(n, { class: attrs.class || n.class, voltage: Math.max(n.voltage, attrs.voltage || 0), current: Math.max(n.current, attrs.current || 0) });
      for (const p of pins) if (!n.pins.includes(p)) n.pins.push(p);
      nets.set(name, n); return this;
    },
    port(name, net, dir, suggest, extra = {}) { ports[name] = { net, dir, suggest, ...extra }; return this; },
    calc(label, value, unit, text) { calc.push({ label, value, unit, text }); return this; },
    note(text) { notes.push(text); return this; },
    out() { return { parts, nets: [...nets.values()], ports, calc, notes }; },
  };
}
/** Parameter definition of a template. */
export const P = (label, unit, def, min, max, extra = {}) => ({ label, unit, default: def, min, max, ...extra });
