/* DynamiteOrbit.ai — Logiciel : the LIVE simulation (demande de JP : « le voir en mode pause, en attente des différentes entrées qui
   pourraient changer à l'écran — capteurs, batterie — pour voir comment le logiciel réagit… une vraie simulation logicielle en temps
   réel »). The software runs its step, one period at a time, against a BENCH one drives by hand : each input pin of the design is a
   control — a quantity one sets (a cell voltage, a current), a switch (a request), or a contact that follows the output it belongs to
   and that one can jam, open or welded. The step is the one `simulate` replays and the tool writes in C (sw/sw_design.js machine).
   Pure : no page, no clock — the screen decides when a step is due. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { machine, liveWires, pinRead, split } from "./sw_design.js";

const div = (a, b) => Math.trunc(a / b), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** The controls of the bench : one per input pin. kind "analog" : a quantity in the unit of the measure it feeds (or in counts when it feeds
    none) ; "digital" : 0 or 1 ; "contact" : follows an output of the design, late — and can be jammed.
    → [{ id, name, kind, unit, min, max, step, start, lo?, hi? (the plausible range), full?, toCounts?(v), of?, ofName?, delay? }] */
export function liveInputs(d) {
  const objs = ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]), O = Object.fromEntries(objs.map((o) => [o.id, o])), W = liveWires(d), sc = (d.scenario && d.scenario.pins) || {}, out = [];
  for (const o of objs) { const K = KINDS[o.kind], s = sc[o.id] || {}, first = s.points && s.points.length ? s.points[0][1] : 0;
    if (K.pin === "ain") { const w = W.find((x) => x.from === `${o.id}.counts`), m = w ? O[split(w.to)[0]] : null;
      if (m && m.kind === "analog_in") { const c = cfgOf(m), full = (1 << c.bits) - 1, phys = (n) => div(div(n * c.vref, full) * c.num, c.den) + c.offset, a = phys(0), b = phys(full), min = Math.min(a, b), max = Math.max(a, b);
        const toCounts = (v) => clamp(Math.round(((v - c.offset) * c.den / c.num) * full / c.vref), 0, full);
        out.push({ id: o.id, name: m.name, pin: o.name, kind: "analog", unit: c.unit, min, max, step: Math.max(1, Math.round((max - min) / 400)), start: phys(first), lo: c.lo, hi: c.hi, full, toCounts });
      } else out.push({ id: o.id, name: o.name, pin: o.name, kind: "analog", unit: "counts", min: 0, max: 4095, step: 1, start: first, full: 4095, toCounts: (v) => clamp(Math.round(v), 0, 4095) });
    } else if (K.pin === "din") {
      if (s.follows && O[s.follows]) out.push({ id: o.id, name: o.name, pin: o.name, kind: "contact", unit: "0/1", min: 0, max: 1, step: 1, start: "follows", of: s.follows, ofName: O[s.follows].name, delay: s.delay || 0 });
      else out.push({ id: o.id, name: o.name, pin: o.name, kind: "digital", unit: "0/1", min: 0, max: 1, step: 1, start: first ? 1 : 0 });
    } }
  return out;
}
/** A live run, at its start : the machine, the bench at its starting values, nothing logged. keep : how many steps of trace are kept. */
export function liveStart(d, keep = 600) {
  const m = machine(d), inputs = liveInputs(d), set = Object.fromEntries(inputs.map((i) => [i.id, i.start]));
  return { d, m, inputs, set, keep, t: 0, log: [], trace: { t: [], ports: Object.fromEntries(Object.keys(m.last).map((r) => [r, []])) }, bool: boolOuts(d) };
}
/* the 0 / 1 outputs of the design : what the journal watches */
const boolOuts = (d) => { const out = new Set(); for (const o of (d.objects || []).filter((x) => !x.off && KINDS[x.kind])) for (const p of KINDS[o.kind].ports.out) if (p.unit === "0/1") out.add(`${o.id}.${p.key}`); return out; };
/** Sets a control of the bench : a value, or for a contact « follows », « open » (jammed at 0), « closed » (welded at 1). */
export function liveSet(L, id, value) { const i = L.inputs.find((x) => x.id === id); if (!i) return L; L.set[id] = i.kind === "contact" ? (["follows", "open", "closed"].includes(value) ? value : "follows") : clamp(Number(value) || 0, i.min, i.max); return L; }
/** Runs n periods. Every 0 / 1 output that changes is logged { t, ref, to } ; the trace keeps the last steps of every port. → L */
export function liveStep(L, n = 1) {
  const by = Object.fromEntries(L.inputs.map((i) => [i.id, i]));
  const read = (id, k, now, drove) => { const i = by[id], v = L.set[id]; if (!i) return 0; if (i.kind === "analog") return i.toCounts(v); if (i.kind === "digital") return v ? 1 : 0;
    return pinRead({ follows: i.of, delay: i.delay, ...(v === "open" ? { stuck: 0 } : v === "closed" ? { stuck: 1 } : {}) }, k, now, drove, L.m.dt); };
  for (let q = 0; q < n; q++) { const before = {}; for (const r of L.bool) before[r] = L.m.last[r];
    const now = L.m.step(read); L.t = now + L.m.dt;
    for (const r of L.bool) if (L.m.last[r] !== before[r]) L.log.push({ t: now, ref: r, to: L.m.last[r] });
    L.trace.t.push(now); for (const r of Object.keys(L.trace.ports)) L.trace.ports[r].push(L.m.last[r]);
    if (L.trace.t.length > L.keep) { L.trace.t.shift(); for (const r of Object.keys(L.trace.ports)) L.trace.ports[r].shift(); } }
  if (L.log.length > 200) L.log.splice(0, L.log.length - 200);
  return L;
}
/** How many periods are due after `ms` of real time at a speed (1 : real time ; 0.1 : ten times slower), a remainder carried. → { n, rest } */
export const due = (ms, period, speed = 1, rest = 0) => { const x = rest + ms * speed / period, n = Math.floor(x); return { n: Math.min(n, 400), rest: x - n }; };
