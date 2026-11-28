/* DynamiteOrbit.ai — Labo, THE TWO BOARDS AT WORK on the table (JP, 27 novembre 2026 : « 2 pcb types that speak to each other when powered with
   12 V and do all functions related to HW » ; choix par menu : « Les 2 cartes en marche » — une alimentation 12 V sur la carte principale, les CORE
   boards reliées par la daisy chain, les frames du round-robin simulées slot par slot, chaque fonction HW exercée).
   What runs together, and from where :
     the POWER PATH of each board is read from its blocks (input protection, diode-OR, buck, LDO, isolated DC-DC : railsOf) — the main lives on
       the module or on the 12 V, the bus side of the CORE boards on what the main gives them through the daisy chain cables (systemPower) ;
     the ROUND-ROBIN is timed from the frame each CORE board sends (coreFrame : RTU framing of sw/rs485_link.js, its CRC, its silences) — CORE 1
       opens the cycle, each CORE transmits after the frame before it and its silence (roundRobin) ;
     what each frame CARRIES comes from the module on the bench of the software (sw/sw_pack.js : each cell block voltage, the balancing of each
       CORE, ONE temperature for the module — said) ;
     what the main board DOES — contactor, LEDs, buzzer, pump, fan, current, voltages, EFC, the commands of the vehicle — is the software of the
       main board run against that module (sw/sw_live.js), each output read on the net and the pin of the board it drives (hwFunctions).
   The frame layout, the baud rate and the period are EXAMPLES, to confirm ; the RS-485 electrical layer is tried block by block in the Labo of a
   board ; the firmware of the CORE board is not drawn (one software per project). Pure. */

import { rtuFrame, frameTime, silences } from "../sw/rs485_link.js";
import { tableOf, tableLinks } from "./lab_table.js";
import { KINDS, cfgOf } from "../sw/sw_objects.js";
import { physText, shownUnit } from "../sw/sw_units.js";

/* a CORE frame (example) : slot address, a user-defined function code of the RTU framing, the cell block voltage (mV), 8 NTC (0.1 °C),
   flags (bit 0 : balancing ON), CRC-16 — 23 bytes */
export const FRAME = { fn: 0x41, bytes: 23, baud: 115200, period: 100, turn: 0.1, what: "adresse = slot · fonction 0x41 · cell block voltage (mV, 2 octets) · 8 NTC (0,1 °C, 2 octets chacune) · flags (bit 0 : balancing ON) · CRC-16" };
/* what feeds what in a power path : the input ports, the output ports of each power block */
const IO = { input_protection: [["IN"], ["OUT"]], power_or: [["SRC_A", "SRC_B"], ["OUT"]], buck: [["VIN"], ["VOUT"]], ldo: [["VIN"], ["VOUT"]], boost: [["VIN"], ["VOUT"]], dcdc_iso: [["VIN"], ["VISO"]] };

/** The rails a board has, given the nets that are fed from outside. → { on: Set(net), steps: [{ block, template, from, to }] } */
export function railsOf(board, present) {
  const on = new Set(present), steps = [];
  for (let changed = true; changed;) { changed = false;
    for (const x of (board && board.blocks) || []) { const io = IO[x.template], c = x.connect || {}; if (!io || !io[0].some((k) => on.has(c[k]))) continue;
      for (const k of io[1]) if (c[k] && !on.has(c[k])) { on.add(c[k]); steps.push({ block: x.id, template: x.template, from: io[0].map((q) => c[q]).filter((n) => on.has(n)), to: c[k] }); changed = true; } } }
  return { on, steps };
}
const other = (l, id) => (l.A.board === id ? l.B : l.A), mine = (l, id) => (l.A.board === id ? l.A : l.B);

/** The two kinds of boards on the table : the MAIN (the one that feeds the bus side of the others through a cable) and the NODE it listens to,
    with how many nodes its bus counts. → { main, node, n, cables } | null */
export function systemOf(project) {
  const t = tableOf(project), live = tableLinks(project).filter((l) => l.on !== false && l.ok && l.A && l.B), byId = (id) => ((project && project.boards) || []).find((b) => b.id === id);
  const bus = live.filter((l) => /RS485|RS-485/i.test(l.A.net)); if (!bus.length) return null;
  const ids = [...new Set(bus.flatMap((l) => [l.A.board, l.B.board]))].filter((id) => t.boards.includes(id)).map(byId).filter(Boolean);
  const feeds = (b) => (b.blocks || []).some((x) => x.template === "dcdc_iso" && live.some((l) => (l.A.board === b.id || l.B.board === b.id) && mine(l, b.id).net === (x.connect || {}).VISO));
  const main = ids.find(feeds), node = ids.find((b) => b !== main); if (!main || !node) return null;
  const rs = (main.blocks || []).find((x) => x.template === "rs485"), n = Math.max(1, Number((rs && rs.params && rs.params.nodes) || 2) - 1);
  return { main, node, n, cables: live.filter((l) => [l.A.board, l.B.board].includes(main.id) && [l.A.board, l.B.board].includes(node.id)) };
}
/** Where each board takes its power : the main from its power connectors (the one near 12 V when the 12 V is there, the other — the module —
    when the module is), the node from its own cell block and from what the main gives it on a cable. → { main, node, bus, v12, own, brought } */
export function systemPower(S, { v12 = true, module = true } = {}) {
  const entries = (S.main.blocks || []).filter((x) => x.template === "conn_power").map((x) => ({ net: (x.connect || {}).VIN, v: Number((x.params || {}).v) || 0 }));
  const M = railsOf(S.main, entries.filter((e) => (Math.abs(e.v - 12) <= 4 ? v12 : module)).map((e) => e.net));
  const brought = S.cables.filter((l) => l.kind === "power" && M.on.has(mine(l, S.main.id).net)).map((l) => other(l, S.main.id).net);
  const cabled = new Set(S.cables.map((l) => other(l, S.main.id).net));
  const own = [...new Set((S.node.parts || []).length ? portNets(S.node).filter((n) => !cabled.has(n.net) && n.kind === "power").map((n) => n.net) : [])];
  const N = railsOf(S.node, [...own, ...brought]);
  return { main: M, node: N, bus: brought.length > 0, v12, module, own, brought };
}
/* the power nets that come in by a connector that is not a programming header */
const portNets = (b) => { const conn = new Set((b.parts || []).filter((p) => /^J\d/.test(p.ref || "")).map((p) => p.ref)), dbg = new Set((b.nets || []).filter((n) => /^(SWDIO|SWCLK)$/i.test(n.name)).flatMap((n) => n.pins.map((x) => String(x).split(".")[0])));
  return (b.nets || []).filter((n) => n.pins.some((x) => { const r = String(x).split(".")[0]; return conn.has(r) && !dbg.has(r); })).map((n) => ({ net: n.name, kind: n.class === "power" ? "power" : n.class === "ground" ? "ground" : "signal" })); };

/** The frame CORE `slot` (1…n) sends : its readings, in the units it keeps. → bytes */
export function coreFrame(slot, { mv, ntc, bleed }) {
  const u16 = (v) => { const x = Math.max(0, Math.min(65535, Math.round(v))); return [(x >> 8) & 255, x & 255]; }, i16 = (v) => u16(Math.round(v) & 0xffff);
  return rtuFrame(slot, FRAME.fn, [...u16(mv), ...ntc.flatMap(i16), bleed ? 1 : 0]);
}
/** The cycle of the round-robin : CORE 1 opens it, each CORE transmits once the frame before it has ended and its silence (t3,5) has passed,
    plus the turnaround of its transceiver. Times in ms. → { slots: [{ slot, t0, t1 }], frame, gap, cycle, period, fits, baud } */
export function roundRobin(n, { baud = FRAME.baud, period = FRAME.period, turn = FRAME.turn, bytes = FRAME.bytes } = {}) {
  const frame = frameTime(bytes, baud) * 1000, gap = silences(baud).t35 * 1000 + turn, slots = []; let t = 0;
  for (let k = 1; k <= n; k++) { slots.push({ slot: k, t0: t, t1: t + frame }); t += frame + gap; }
  const cycle = t - turn; return { slots, frame, gap, cycle, period, fits: cycle <= period, baud };
}
/** What each CORE board reads now, from the module on the bench : its cell block voltage, its 8 NTC (the module has ONE temperature : each
    probe carries it), its balancing. → [{ slot, mv, ntc, bleed }] */
export function nodeReadings(plant, n) {
  const v = (plant && plant.v) || [], t = Math.round(((plant && plant.temp) ?? 25) * 10);
  return Array.from({ length: n }, (_, k) => ({ slot: k + 1, mv: Math.round((v[k] ?? 0) * 1000), ntc: new Array(8).fill(t), bleed: !!(plant && plant.bleed && plant.bleed[k]) }));
}
/** The two bench inputs the boards set by themselves : WAKE (the 12 V) and the silence of the round-robin (no bus side, or a chain cut). */
export const benchFromBoards = (power, cut = false) => ({ wake: power.v12 ? 1 : 0, lost: !power.bus || cut ? 1 : 0 });

/** Every hardware function of the main board, exercised : each pin of its software on its net, under the function of the board that carries it,
    with its value now. design : the software of the main board ; last : the ports of its live run. → [{ fn, name, items: [{ id, name, net, pin, dir, on, text }] }] */
export function hwFunctions(main, design, last = {}) {
  const objs = ((design && design.objects) || []).filter((o) => !o.off && KINDS[o.kind]), W = (design && design.wires) || [], O = Object.fromEntries(objs.map((o) => [o.id, o]));
  const top = (f) => String(f || "").split(".")[0], fnName = Object.fromEntries(((main && main.functions) || []).filter((f) => !f.parent).map((f) => [f.id, f.name])), groups = new Map();
  const blockOf = (net) => ((main && main.blocks) || []).find((x) => Object.values(x.connect || {}).includes(net));
  for (const o of objs.filter((x) => KINDS[x.kind].pin && ((x.hw && x.hw.board === main.id) || x.bench))) {
    const K = KINDS[o.kind], fn = o.hw ? top((blockOf(o.hw.net) || {}).function) : "frames", dir = K.pin;
    let text = "", on = null;
    if (dir === "ain") { const w = W.find((x) => x.from === `${o.id}.counts`), m = w ? O[w.to.split(".")[0]] : null; const c = m ? cfgOf(m) : null, v = m ? last[`${m.id}.value`] : last[`${o.id}.counts`];
      text = m && Number.isFinite(v) ? `${physText(v, c.unit, false)} ${shownUnit(c.unit)}` : Number.isFinite(v) ? `${v} comptes` : "—"; }
    else { const v = last[`${o.id}.level`]; on = v ? 1 : 0; text = on ? "1" : "0"; }
    if (!groups.has(fn)) groups.set(fn, { fn, name: fn === "frames" ? "Dit par les CORE boards, dans leurs frames" : fnName[fn] || "Autre", items: [] });
    groups.get(fn).items.push({ id: o.id, name: o.name, net: o.hw ? o.hw.net : "", pin: o.hw ? o.hw.pin : "", dir, on, text, device: o.device || "" });
  }
  return [...groups.values()].sort((a, b) => (a.fn === "frames") - (b.fn === "frames") || a.fn.localeCompare(b.fn, "en", { numeric: true }));
}
/** What this view does not simulate, said on the screen. */
export const SYSTEM_GAPS = [
  "Le firmware des CORE boards n'est pas dessiné (un logiciel par projet) : le round-robin et la règle de balancing tournent ici et dans le module simulé.",
  "Les 8 NTC d'une CORE portent la même température : le module simulé n'en a qu'une, celle du CORE le plus chaud.",
  "La couche électrique RS-485 (niveaux, terminaison, polarisation) s'essaie bloc par bloc dans le Labo d'une carte ; ici, les frames et leur timing.",
  "La frame CAN FD vers le véhicule, la précharge et le pyrofusible : leurs blocs logiciels sont à venir.",
  "Frame, baud rate et période : des exemples, à confirmer avec le projet.",
];
