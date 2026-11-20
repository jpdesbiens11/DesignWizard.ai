/* DesignWizard.ai — Logiciel : a DESIGN is objects and the wires between them (sw/sw_objects.js says what an object is).
     design : { id, name, cpu (the key of a CPU sheet : sw/sw_cpu.js), period (ms : how often the software runs its step),
                objects : [{ id, kind, name, params : { key: value }, sure : [keys confirmed], x, y, off? }],
                wires : [{ from : "obj.port", to : "obj.port", delay? }], scenario? }
   A LOOP — a fault that inhibits the object it comes from — is opened as block diagrams do it : one of its wires carries the value of the
   step BEFORE (`delay` : a unit delay). The order then exists, and the C does the same.
   What this file gives, pure :
     - wireCheck : may this output feed this input ? Units must be the same ; a range that does not fit is SAID ;
     - problems : what is missing or wrong, for the guide — an input left open, two wires on one input, a loop, an example value not
       confirmed, more pins than the CPU has ;
     - order : the objects in the order the step runs them — a source before what reads it ;
     - simulate : the design run step by step against a scenario of the pins → the trace of every port. The same numbers the C must give.
     - machine : the same step, one period at a time, for a simulation one drives by hand (sw/sw_live.js) ;
   A value a kind proposes is an EXAMPLE until the project confirms it (`sure`) : the guide says so, and the files wait. */

import { KINDS, NATURES, cfgOf, portOf, portsOf } from "./sw_objects.js";

const split = (ref) => { const k = String(ref || "").lastIndexOf("."); return k < 0 ? [ref, ""] : [ref.slice(0, k), ref.slice(k + 1)]; };
const live = (d) => ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]);
const byId = (d) => Object.fromEntries(live(d).map((o) => [o.id, o]));
/** The wires that count : both ends on objects that are on, and on ports that exist. */
export const liveWires = (d) => { const O = byId(d); return ((d && d.wires) || []).filter((w) => { const [a, ap] = split(w.from), [b, bp] = split(w.to); return O[a] && O[b] && portOf(O[a], "out", ap) && portOf(O[b], "in", bp); }); };
/** May the output `from` feed the input `to` ? → { ok, level ("error" | "warn" | ""), text } */
export function wireCheck(d, from, to) {
  const O = byId(d), [a, ap] = split(from), [b, bp] = split(to), src = O[a] && portOf(O[a], "out", ap), dst = O[b] && portOf(O[b], "in", bp);
  if (!src || !dst) return { ok: false, level: "error", text: "Un fil part d'une sortie et arrive sur une entrée." };
  if (a === b) return { ok: false, level: "error", text: "Un objet ne se relie pas à lui-même." };
  if (src.unit !== dst.unit) return { ok: false, level: "error", text: `Les unités ne s'accordent pas : « ${src.label} » de ${O[a].name} est en ${src.unit}, « ${dst.label} » de ${O[b].name} attend des ${dst.unit}.` };
  if (src.min < dst.min || src.max > dst.max) return { ok: true, level: "warn", text: `La plage ne tient pas : ${O[a].name} peut donner de ${src.min} à ${src.max} ${src.unit}, ${O[b].name} n'attend que de ${dst.min} à ${dst.max}.` };
  return { ok: true, level: "", text: "" };
}
/** The objects in the order the step runs them : what feeds before what reads. → { ids, loop : [ids caught in a loop] } */
export function order(d) {
  const objs = live(d), W = liveWires(d), need = Object.fromEntries(objs.map((o) => [o.id, new Set()])); for (const w of W) if (!w.delay) need[split(w.to)[0]].add(split(w.from)[0]);      // a wire that carries the value of the step before asks for no order
  const ids = [], done = new Set(); let moved = true;
  while (moved) { moved = false; for (const o of objs) { if (done.has(o.id) || [...need[o.id]].some((x) => !done.has(x))) continue; ids.push(o.id); done.add(o.id); moved = true; } }
  return { ids, loop: objs.filter((o) => !done.has(o.id)).map((o) => o.id) };
}
/** The values a kind proposed that the project has not confirmed. → [{ obj, key, label }] */
export function unsure(d) { return live(d).flatMap((o) => KINDS[o.kind].params.filter((p) => !(o.sure || []).includes(p.key)).map((p) => ({ obj: o.id, key: p.key, label: p.label }))); }
/** How many pins of each sort the design takes. → { ain, din, dout } */
export const pinCount = (d) => { const n = { ain: 0, din: 0, dout: 0 }; for (const o of live(d)) if (KINDS[o.kind].pin) n[KINDS[o.kind].pin]++; return n; };
/** What is missing or wrong, for the guide. cpu : a CPU sheet (sw/sw_cpu.js) or null. → [{ level, text, obj?, field? }] — "error" keeps the files from being written. */
export function problems(d, cpu) {
  const out = [], objs = live(d), W = liveWires(d), O = byId(d), say = (level, text, obj, field) => out.push({ level, text, ...(obj ? { obj } : {}), ...(field ? { field } : {}) });
  if (!objs.length) { say("todo", "Le logiciel n'a encore aucun objet : posez-en un, ou partez de l'exemple."); return out; }
  const into = {}; for (const w of W) (into[w.to] = into[w.to] || []).push(w);
  for (const [to, list] of Object.entries(into)) if (list.length > 1) say("error", `Deux fils arrivent sur la même entrée (${O[split(to)[0]].name}, « ${split(to)[1]} ») : une entrée n'écoute qu'une sortie.`, split(to)[0]);
  for (const w of W) { const c = wireCheck(d, w.from, w.to); if (c.level) say(c.level === "warn" ? "check" : "error", c.text, split(w.to)[0]); }
  for (const w of (d.wires || []).filter((x) => !W.includes(x) && byId(d)[split(x.from)[0]] && byId(d)[split(x.to)[0]])) say("error", `Un fil va vers un port qui n'existe pas (${w.from} → ${w.to}).`, split(w.to)[0]);
  for (const o of objs) for (const p of portsOf(o).in) if (!p.free && !into[`${o.id}.${p.key}`]) say("error", `${o.name} : l'entrée « ${p.label} » n'est reliée à rien.`, o.id);
  const L = order(d).loop; if (L.length) say("error", `Des objets se suivent en boucle (${L.map((id) => O[id].name).join(", ")}) : l'un des fils de la boucle doit porter « la valeur du pas d'avant » — un clic sur le fil.`, L[0]);
  for (const o of objs) { const c = cfgOf(o); if (o.kind === "analog_in" && c.lo >= c.hi) say("error", `${o.name} : la plage vraisemblable est à l'envers (${c.lo} à ${c.hi}).`, o.id, "lo");
    if (o.kind === "limit" && (c.above ? c.clear >= c.trip : c.clear <= c.trip)) say("error", `${o.name} : le seuil de retour doit être ${c.above ? "sous" : "au-dessus du"} le seuil, sinon il bat.`.replace("sous le seuil", "sous le seuil"), o.id, "clear");
    if (o.kind === "limit" && d.period && c.delay % d.period) say("check", `${o.name} : le délai (${c.delay} ms) n'est pas un multiple de la période du logiciel (${d.period} ms) — il sera arrondi au pas suivant.`, o.id, "delay"); }
  if (cpu) { const n = pinCount(d); if (n.ain > cpu.adc.channels) say("error", `Le logiciel lit ${n.ain} voies analogiques ; le CPU choisi (${cpu.name}) en a ${cpu.adc.channels}.`);
    if (n.din + n.dout > cpu.gio) say("error", `Le logiciel prend ${n.din + n.dout} broches logiques ; le CPU choisi en offre ${cpu.gio}.`);
    for (const o of objs.filter((x) => x.kind === "analog_in")) if (cfgOf(o).bits !== cpu.adc.bits) say("check", `${o.name} : résolution de ${cfgOf(o).bits} bits, alors que le convertisseur du CPU choisi en a ${cpu.adc.bits}.`, o.id, "bits"); }
  const u = unsure(d); if (u.length) say("check", `${u.length} valeur${u.length > 1 ? "s sont des exemples" : " est un exemple"} proposé${u.length > 1 ? "s" : ""} par l'outil : à entrer ou à confirmer avant d'écrire les fichiers.`, u[0].obj, u[0].key);
  return out;
}
/** May the files be written ? Nothing wrong, and no example left unconfirmed. */
export const ready = (d, cpu) => !problems(d, cpu).some((p) => p.level === "error") && !unsure(d).length && live(d).length > 0;

/* ---------- the simulation ---------- */
/** What a pin reads at step k of a scenario. pin : { points : [[t ms, value]] (held between two points) } or { follows : object id of a « Digital output », delay : ms, stuck? : 0 | 1 } */
const held = (pts, t) => { let v = pts.length ? pts[0][1] : 0; for (const [at, x] of pts) { if (at <= t) v = x; else break; } return v; };
/** The design as a MACHINE one steps by hand — the one step `simulate` replays and the live simulation runs (sw/sw_live.js). Each call of
    step(read) is one period : read(id, k, now, drove) gives what an input pin (ADC channel, digital input) reads at this step ; drove is what
    each « Digital output » was given, step after step. → { ids, ok, dt, mem (the memory of each object), last (every port, as it is now),
    drove, k (steps done), step(read) → the instant of the step, in ms } */
export function machine(d) {
  const O = byId(d), ord = order(d), W = liveWires(d), dt = d.period || 10, src = Object.fromEntries(W.map((w) => [w.to, w.from]));
  const mem = Object.fromEntries(ord.ids.map((id) => [id, KINDS[O[id].kind].init ? KINDS[O[id].kind].init() : {}])), cfg = Object.fromEntries(ord.ids.map((id) => [id, cfgOf(O[id])]));
  const last = {}, drove = {}; let k = 0;      // drove : a contact that follows an output reads it late
  for (const id of ord.ids) for (const p of [...portsOf(O[id]).in, ...portsOf(O[id]).out]) last[`${id}.${p.key}`] = 0;
  return { ids: ord.ids, ok: !ord.loop.length, dt, mem, last, drove, get k() { return k; },
    step(read) { const now = k * dt;
      for (const id of ord.ids) { const o = O[id], K = KINDS[o.kind], inp = {};
        for (const p of K.ports.in) { const from = src[`${id}.${p.key}`]; inp[p.key] = from ? last[from] : 0; last[`${id}.${p.key}`] = inp[p.key]; }
        let out = {};
        if (K.pin === "ain" || K.pin === "din") out[K.ports.out[0].key] = read(id, k, now, drove);
        else if (K.pin === "dout") (drove[id] = drove[id] || []).push(inp.level);
        else out = K.step(mem[id], cfg[id], inp, dt);
        for (const [key, v] of Object.entries(out)) last[`${id}.${key}`] = v; }
      k++; return now; } };
}
/** What an input pin reads at step k of a scenario : its points held, or the output it follows, late. */
export function pinRead(spec, k, now, drove, dt) {
  const s = spec || { points: [] };
  if (s.follows) { const h = drove[s.follows] || [], lag = Math.round((s.delay || 0) / dt), was = k - 1 - lag >= 0 ? h[k - 1 - lag] : 0; return s.stuck === 0 || s.stuck === 1 ? s.stuck : was || 0; }
  return held(s.points || [], now);
}
/** Runs the design against a scenario. sc : { steps, pins : { objectId : { points } | { follows, delay, stuck } } } → { t : [ms], ports : { "obj.port" : [values] }, ids (the order), ok } */
export function simulate(d, sc = d.scenario || { steps: 0, pins: {} }) {
  const m = machine(d), ports = Object.fromEntries(Object.keys(m.last).map((ref) => [ref, []])), t = [], read = (id, k, now, drove) => pinRead((sc.pins || {})[id], k, now, drove, m.dt);
  for (let k = 0; k < (sc.steps || 0); k++) { t.push(m.step(read)); for (const ref of Object.keys(ports)) ports[ref].push(m.last[ref]); }
  return { t, ports, ids: m.ids, ok: m.ok };
}
/** What happened in a run, in a few facts for the screen : when each 0 / 1 output changed. → [{ t, ref, to }] */
export function events(d, R) { const O = byId(d), out = []; for (const [ref, y] of Object.entries(R.ports)) { const [id, key] = split(ref), p = O[id] && portOf(O[id], "out", key); if (!p || p.unit !== "0/1") continue; for (let k = 1; k < y.length; k++) if (y[k] !== y[k - 1]) out.push({ t: R.t[k], ref, to: y[k] }); } return out.sort((a, b) => a.t - b.t || a.ref.localeCompare(b.ref)); }

/* ---------- the example : one whole chain, and the energy counter ---------- */
const OBJ = (id, kind, name, x, y, params = {}) => ({ id, kind, name, x, y, params, sure: [] });
/** The example design : a cell voltage watched, an over-voltage that opens the contactor, the energy counted. Its values are examples : none is confirmed. */
export function demoDesign(cpu = "tms570ls1224_pge") {
  return { id: "BMS-SW", name: "Logiciel du BMS — exemple", cpu, period: 10,
    objects: [OBJ("adc_cell", "pin_adc", "Voie : tension d'une cellule", 20, 30, { channel: 0 }), OBJ("cell_v", "analog_in", "Cell voltage", 230, 20, { unit: "mV", num: 2, den: 1, lo: 500, hi: 5000, n: 4 }),
      OBJ("ov", "limit", "Over-voltage", 470, 30, { unit: "mV", above: 1, trip: 4250, clear: 4150, delay: 100 }), OBJ("latch", "fault_latch", "Fault latch", 690, 60),
      OBJ("req", "pin_din", "Entrée : demande de fermeture", 470, 210, { pin: 4 }), OBJ("k_fb", "pin_din", "Entrée : contact auxiliaire", 470, 330, { pin: 3 }),
      OBJ("k_pos", "contactor", "Contactor K+", 900, 180, { t_fb: 50 }), OBJ("k_drv", "pin_dout", "Sortie : bobine de K+", 1130, 190, { pin: 2 }),
      OBJ("adc_i", "pin_adc", "Voie : courant du pack", 20, 460, { channel: 1 }), OBJ("i_pack", "analog_in", "Pack current", 230, 450, { unit: "mA", num: 400, den: 1, offset: -660000, lo: -500000, hi: 500000, n: 2 }),
      OBJ("adc_v", "pin_adc", "Voie : tension du pack", 20, 610, { channel: 2 }), OBJ("v_pack", "analog_in", "Pack voltage", 230, 600, { unit: "mV", num: 250, den: 1, lo: 100000, hi: 820000, n: 4 }),
      OBJ("efc", "energy_counter", "Energy counter", 470, 520)],
    wires: [["adc_cell.counts", "cell_v.counts"], ["cell_v.value", "ov.value"], ["ov.trip", "latch.a"], ["k_pos.fault", "latch.b", 1], ["latch.fault", "k_pos.inhibit"], ["req.level", "k_pos.request"], ["k_fb.level", "k_pos.feedback"], ["k_pos.drive", "k_drv.level"],
      ["adc_i.counts", "i_pack.counts"], ["adc_v.counts", "v_pack.counts"], ["i_pack.value", "efc.i"], ["v_pack.value", "efc.v"]].map(([from, to, delay]) => ({ from, to, ...(delay ? { delay: true } : {}) })),
    /* the bench : the contactor is asked closed, the cell climbs past its limit, the software opens ; 100 A leave the pack all along */
    scenario: { steps: 120, pins: { adc_cell: { points: [[0, 2420], [300, 2600], [500, 2680], [900, 2420]] }, req: { points: [[0, 0], [50, 1]] }, k_fb: { follows: "k_drv", delay: 20 }, adc_i: { points: [[0, 2047], [100, 2358], [620, 2047]] }, adc_v: { points: [[0, 1986]] } } } };
}
export { NATURES, KINDS, split };
