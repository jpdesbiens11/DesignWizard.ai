/* DynamiteOrbit.ai — Logiciel : the LIVE simulation (demande de JP : « le voir en mode pause, en attente des différentes entrées qui
   pourraient changer à l'écran — capteurs, batterie — pour voir comment le logiciel réagit… une vraie simulation logicielle en temps
   réel »). The software runs its step, one period at a time, against a BENCH one drives by hand : each input pin of the design is a
   control — a quantity one sets (a cell voltage, a current), a switch (a request), or a contact that follows the output it belongs to
   and that one can jam, open or welded. The step is the one `simulate` replays and the tool writes in C (sw/sw_design.js machine).
   Pure : no page, no clock — the screen decides when a step is due. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { machine, liveWires, pinRead, split } from "./sw_design.js";
import { plantOf, packStart, packStep, packSense, packDrive } from "./sw_pack.js";

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
  const L = { d, m, inputs, set, keep, t: 0, log: [], trace: { t: [], ports: Object.fromEntries(Object.keys(m.last).map((r) => [r, []])) }, bool: boolOuts(d) };
  /* the module on the bench (sw/sw_pack.js) : it drives the pins it names, one second at a time, and obeys what the software commands */
  const pl = plantOf(d); if (pl) { L.plant = packStart(d); L.pl = pl; L.pk = { every: Math.max(1, Math.round(1000 / m.dt)), n: 0 }; sensePlant(L);
    /* the RECORD of the mission (JP, 26 novembre 2026 : « le duty cycle des composants dans le temps ») : one sample a second — what the pins read,
       the state of the module, what the software commands (every output pin), how many resistors bleed */
    L.recRefs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind] && KINDS[o.kind].pin === "dout").map((o) => `${o.id}.level`); L.rec = []; record(L); }
  return L;
}
const PLANT_PINS = ["vmax", "vmin", "temp", "current", "vmod", "vout", "bleed"];
function record(L) { const s = packSense(L.plant), last = L.m.last; L.rec.push({ t: L.t, ...s, state: L.pl.state ? last[L.pl.state] || 0 : 0, bleed: L.plant.bleed.filter(Boolean).length, out: L.recRefs.map((r) => (last[r] ? 1 : 0)) }); if (L.rec.length > 30000) L.rec.splice(0, L.rec.length - 30000); }
/** The record of a mission as CSV : one line a second — time, what the pins read in the units of physics, the state, each output. */
export function recordCsv(L, names = {}) {
  if (!L || !L.rec) return ""; const head = ["t (s)", "Vmax (V)", "Vmin (V)", "T max (°C)", "I (A, + discharge)", "state", "bleeding CORE", ...L.recRefs.map((r) => names[r] || r)];
  return `${[head.join(","), ...L.rec.map((x) => [x.t / 1000, x.vmax / 1000, x.vmin / 1000, x.temp / 10, x.current / 1000, x.state, x.bleed, ...x.out].join(","))].join("\r\n")}\r\n`;
}
function sensePlant(L) { const s = packSense(L.plant); for (const k of PLANT_PINS) if (L.pl[k]) liveSet(L, L.pl[k], s[k]); }
/** The pins the module on the bench drives : they are read, not set by hand. */
export const plantPins = (L) => new Set(L && L.pl ? PLANT_PINS.map((k) => L.pl[k]).filter(Boolean) : []);
/** Changes what drives the module on the bench (an event of a profile : `plant`). */
export function liveDrive(L, patch) { if (L && L.plant && patch) { packDrive(L.plant, patch); sensePlant(L); } return L; }
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
    for (const r of L.bool) if (L.m.last[r] !== before[r]) { L.log.push({ t: now, ref: r, to: L.m.last[r] }); L.nlog = (L.nlog || 0) + 1; }      // nlog : how many were ever logged (the log keeps the last 200)
    L.trace.t.push(now); for (const r of Object.keys(L.trace.ports)) L.trace.ports[r].push(L.m.last[r]);
    if (L.trace.t.length > L.keep) { L.trace.t.shift(); for (const r of Object.keys(L.trace.ports)) L.trace.ports[r].shift(); }
    if (L.plant && ++L.pk.n >= L.pk.every) { L.pk.n = 0; const last = L.m.last, pl = L.pl;
      packStep(L.plant, { closed: pl.contactor ? !!last[pl.contactor] : true, derate: pl.state ? (last[pl.state] || 0) >= 1 : false, pump: pl.pump ? !!last[pl.pump] : false }); sensePlant(L); record(L); } }
  if (L.log.length > 200) L.log.splice(0, L.log.length - 200);
  return L;
}
/** How many periods are due after `ms` of real time at a speed (1 : real time ; 0.1 : ten times slower), a remainder carried. → { n, rest } */
export const due = (ms, period, speed = 1, rest = 0) => { const x = rest + ms * speed / period, n = Math.floor(x); return { n: Math.min(n, speed > 1 ? 6000 : 400), rest: x - n }; };      // faster than real time (a module that charges in an hour) : more steps per frame
