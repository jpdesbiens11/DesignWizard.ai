/* DynamiteOrbit.ai — Logiciel : the MONITORING DASHBOARD of a software (demande de JP, 24 novembre 2026 : « un tableau de bord au pilote du BM
   ou au user qui allume des LED quand on a des conditions à surveiller, avec les valeurs montrées sous ou à côté des LED… un pop-up ouvert /
   fermé en plus de la fenêtre globale ; titre : Monitoring du BM-SWAP »).
   Nothing is declared for it : the dashboard is READ from the software. The general state is the lamp of a « Status lamp » (green · yellow ·
   red), or else the state of a module ; each LIMIT is a condition — its LED, its colour (red when it ends in a fault that stops the product,
   yellow when it only asks to watch), the value it compares, in physical units, and its threshold ; then what the product does : the contactor,
   the buzzer, the chain of boards. The title is the design's (`design.monitor.title`), or « Monitoring — <name> ».
   What it follows : the annunciator panel of a cockpit or a control room — one lamp per condition, its colour by severity, the value beside it.
   Pure : no page. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { liveWires, split } from "./sw_design.js";
import { physText, STATE_NAMES } from "./sw_units.js";

const GROUPS = [["mV", "Tension"], ["0.1 °C", "Température"], ["mA", "Courant"]];
const groupOf = (unit) => (GROUPS.find(([u]) => u === unit) || [unit, "Autres"])[1];

/** The dashboard of a design. → { title, lamp: { green, yellow, red } | null, state: ref | null, rows: [{ id, label, ref, sev, value: { ref, unit } | null, rule, group }], product: [{ id, label, ref, on, off, sev }], alarm: [ref] } */
export function monitorOf(d) {
  const objs = ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]), O = Object.fromEntries(objs.map((o) => [o.id, o])), W = liveWires(d);
  const outOf = (id) => W.filter((w) => split(w.from)[0] === id).map((w) => split(w.to));
  /* how a decision ends : in a fault (red), in a warning (yellow) — followed through the gates that combine it */
  const ends = (id, seen = new Set()) => { if (seen.has(id)) return null; seen.add(id); let worst = null;
    for (const [to, key] of outOf(id)) { const x = O[to]; if (!x) continue;
      const here = x.kind === "fault_latch" || (x.kind === "module_state" && key === "fault") || (x.kind === "contactor" && key === "inhibit") ? "red" : x.kind === "module_state" ? (key === "lost" ? "red" : "yellow") : ["logic", "on_delay", "debounce"].includes(x.kind) ? ends(to, seen) : null;
      if (here === "red") return "red"; if (here) worst = here; }
    return worst; };
  const lampO = objs.find((o) => o.kind === "state_lamp"), modO = objs.find((o) => o.kind === "module_state");
  /* a limit that only starts an action (a pump, a fan) is not a condition to watch : the action is shown with the product */
  const rows = objs.filter((o) => o.kind === "limit" && (ends(o.id) || !outOf(o.id).some(([to]) => O[to] && KINDS[O[to].kind].pin === "dout"))).map((o) => { const c = cfgOf(o), w = W.find((x) => x.to === `${o.id}.value`), unit = c.unit;
    return { id: o.id, label: o.name, ref: `${o.id}.trip`, sev: ends(o.id) || "yellow", value: w ? { ref: w.from, unit } : null, rule: `${c.above ? "≥" : "≤"} ${physText(c.trip, unit)}`, group: groupOf(unit) }; });
  const product = [];
  for (const o of objs.filter((x) => x.kind === "contactor")) product.push({ id: o.id, label: o.name, ref: `${o.id}.drive`, on: "fermé", off: "ouvert", sev: "off-red" });
  for (const o of objs.filter((x) => x.kind === "fault_latch")) product.push({ id: o.id, label: o.name, ref: `${o.id}.fault`, on: "défaut retenu", off: "aucun défaut", sev: "red" });
  for (const o of objs.filter((x) => x.kind === "pin_din" && modO && W.some((w) => w.from === `${x.id}.level` && w.to === `${modO.id}.lost`))) product.push({ id: o.id, label: o.name, ref: `${o.id}.level`, on: "muette", off: "répond", sev: "red" });
  for (const o of objs.filter((x) => KINDS[x.kind].pin === "dout" && ["pump", "fan", "heater", "valve"].includes(x.device))) product.push({ id: o.id, label: o.name, ref: `${o.id}.level`, on: "en marche", off: "à l'arrêt", sev: "green" });
  for (const o of objs.filter((x) => x.kind === "balancing")) product.push({ id: o.id, label: o.name, ref: `${o.id}.bleed`, on: "équilibre", off: "au repos", sev: "green" });      // the green light : balancing has started
  /* or the boards that balance alone and say it in their round (JP, 27 novembre 2026) : the central board only hears it */
  for (const o of objs.filter((x) => KINDS[x.kind].pin === "din" && x.device === "balancing")) product.push({ id: o.id, label: "Équilibrage des CORE — chacune seule, dit dans leur tour", ref: `${o.id}.level`, on: "équilibre", off: "au repos", sev: "green" });
  const alarm = objs.filter((o) => KINDS[o.kind].pin === "dout" && o.device === "buzzer").map((o) => `${o.id}.level`);
  for (const r of alarm) product.push({ id: split(r)[0], label: O[split(r)[0]].name, ref: r, on: "sonne", off: "silencieux", sev: "red" });
  return { title: (d && d.monitor && d.monitor.title) || `Monitoring — ${(d && d.name) || "logiciel"}`, lamp: lampO ? { green: `${lampO.id}.green`, yellow: `${lampO.id}.yellow`, red: `${lampO.id}.red` } : null,
    state: modO ? `${modO.id}.state` : null, rows, product, alarm };
}
/** The dashboard at an instant. get(ref) → the value of a port. → { general: "green" | "yellow" | "red" | null, stateName, rows: [{ …row, on, valueText }], product: [{ …p, on, text }], alarm: bool } */
export function monitorRead(M, get) {
  const v = (r) => (r ? get(r) : undefined), st = v(M.state);
  const general = M.lamp ? (v(M.lamp.red) ? "red" : v(M.lamp.yellow) ? "yellow" : v(M.lamp.green) ? "green" : null) : st === undefined ? null : st >= 2 ? "red" : st === 1 ? "yellow" : "green";
  return { general, stateName: st === undefined ? null : STATE_NAMES[st] || String(st),
    rows: M.rows.map((r) => { const x = r.value ? v(r.value.ref) : undefined; return { ...r, on: !!v(r.ref), valueText: x === undefined ? "—" : physText(x, r.value.unit) }; }),
    product: M.product.map((p) => { const on = !!v(p.ref); return { ...p, on, text: on ? p.on : p.off }; }), alarm: M.alarm.some((r) => !!v(r)) };
}
