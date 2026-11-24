/* DynamiteOrbit.ai — PCBA: the catalogue of function blocks. A block is the proven little circuit that fulfils one
   function ; a template sizes it from a few parameters and returns
     { parts: [{ id, comp, value, role, near, edge, nc, pin, corner }],      // local ids ; comp = library id
       nets:  [{ name, class, voltage, current, pins: ["U.VIN", "CIN.1"] }], // local names
       ports: { NAME: { net, dir, suggest, pool, lazy, pin } },               // what the block shows to the others
       calc:  [{ label, value, unit, text }],                                 // the sizing, written like a hand calculation
       notes: [layout rules of thumb] }
   A port joins the board net named `suggest` (a rail, GND, CAN_TX…). `pool` : the next free net of that family
   (AIN0, AIN1…). `lazy` : the pin joins that net only when another block brings it. */

import { POWER_BLOCKS } from "./blocks_power.js";
import { CONTROL_BLOCKS } from "./blocks_control.js";
import { SENSE_BLOCKS } from "./blocks_sense.js";
import { IO_BLOCKS } from "./blocks_io.js";
import { LINK_BLOCKS } from "./blocks_link.js";

export const BLOCK_CATEGORIES = ["Raccorder", "Protéger", "Alimenter", "Calculer", "Mesurer", "Commander", "Communiquer", "Signaler", "Tester"];
export const BLOCKS = Object.fromEntries([...POWER_BLOCKS, ...CONTROL_BLOCKS, ...SENSE_BLOCKS, ...IO_BLOCKS, ...LINK_BLOCKS].map((t) => [t.id, t]));

/** Parameters of a template with their defaults, overridden by `given`. */
export function blockParams(template, given = {}) {
  const out = {};
  for (const [k, d] of Object.entries(template.params || {})) {
    let v = given[k] !== undefined && given[k] !== "" ? given[k] : d.default;
    if (!d.text) { v = +v; if (!Number.isFinite(v)) v = d.default; if (d.min !== null && d.min !== undefined) v = Math.max(d.min, v); if (d.max !== null && d.max !== undefined) v = Math.min(d.max, v); }
    out[k] = v;
  }
  return out;
}
/** The sentence of the function, with the parameters written in : "Abaisser 24 V vers 5 V, 1 A". */
export function blockSentence(template, params) {
  const f = typeof template.function === "function" ? template.function(params) : template.function;      // a sentence that changes with a parameter
  return String(f).replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? "" : typeof params[k] === "number" ? String(params[k]).replace(".", ",") : String(params[k])));
}
/** Builds a template : { parts, nets, ports, calc, notes }, or throws with a French message. */
export function buildBlock(templateId, given = {}) {
  const t = BLOCKS[templateId];
  if (!t) throw new Error(`Bloc inconnu « ${templateId} ».`);
  const params = blockParams(t, given);
  return { template: t, params, ...t.build(params) };
}
