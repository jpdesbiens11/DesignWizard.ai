/* DesignWizard.ai — PCBA: the mechanical twin of a board. The electronic board (kind "board") and the part of the
   "pcb" family that stands for it in the assembly are two views of the same object : the part gives the outline, the
   thickness and the mounting holes (its bolt-pattern interface) ; the board gives back its components as envelopes
   with their heights and its nets with their voltages, for the 3-D view, the isolation analysis and the simulation. */

import { roleOf } from "./board_role.js";
import { resolveParams, evalDeep } from "../cad/expr.js";
import { patternPoints } from "../cad/interfaces.js";
import { clearanceHole, thread } from "../cad/standards.js";
import { libraryOf } from "./model.js";

const KIND = new Set(["ic", "mcu", "connector", "capacitor", "inductor", "relay", "transformer", "mosfet", "sensor", "heatsink", "terminal", "fuse", "resistor", "optocoupler"]);
const r2 = (v) => Math.round(v * 100) / 100;

/** Outline, thickness and mounting holes of a "pcb" part, read without building it. → { size, r, t, holes } or null. */
export function boardFromPart(part) {
  if (!part || !part.pcb) return null;
  const scope = resolveParams(part.params || {}).scope, pcb = evalDeep(part.pcb, scope), size = pcb.size || null, holes = [];
  for (const h of pcb.holes || []) for (const at of Array.isArray(h.at[0]) ? h.at : [h.at]) holes.push({ at: [r2(at[0]), r2(at[1])], d: h.d, plated: !!h.plated, land: r2(2 * h.d), kind: "mount" });
  for (const i of part.interfaces || []) {
    if (i.type !== "bolt_pattern") continue;
    const p = evalDeep(i.params || {}, scope), at = evalDeep(i.at || [0, 0], scope), th = thread(p.screw || "M3"), d = clearanceHole(p.screw || "M3", (i.opts && i.opts.fit) || "medium");
    for (const pt of patternPoints(p.pattern)) holes.push({ at: [r2(at[0] + pt[0]), r2(at[1] + pt[1])], d, plated: false, land: r2(th.head ? th.head[0] + 0.5 : 2 * d), kind: "mount" });
  }
  return size ? { size: [r2(size[0]), r2(size[1])], r: pcb.r || 0, t: pcb.t ?? 1.6, holes } : null;
}
/** Takes outline, thickness and holes from the part. Returns true when something changed. */
export function inheritFromPart(board, part) {
  const m = boardFromPart(part); if (!m) return false;
  const before = JSON.stringify([board.board.size, board.board.r, board.board.t, board.board.holes]);
  Object.assign(board.board, { size: m.size, r: m.r, t: m.t, holes: m.holes }); board.part = part.id;
  return JSON.stringify([board.board.size, board.board.r, board.board.t, board.board.holes]) !== before;
}
/** Components and nets of the board, in the form the "pcb" block of a part holds them. */
export function twinBlocks(board, lib = {}) {
  const L = libraryOf(board, lib), components = [];
  for (const p of board.parts || []) {
    const def = L[p.comp]; if (!def || !p.at || def.body[2] < 0.3) continue;
    components.push({ ref: p.ref, name: def.name, kind: KIND.has(def.kind) ? def.kind : "other", at: [r2(p.at[0]), r2(p.at[1])], size: [def.body[0], def.body[1], def.body[2]], side: p.side || "top", ...(p.rot ? { rot: p.rot } : {}) });
  }
  const nets = {};
  for (const n of board.nets || []) if (Math.abs(n.voltage || 0) > 0 && (n.class === "power" || n.class === "hv")) nets[n.name] = { kind: "dc", voltage: n.voltage };
  return { components, nets };
}
/** The part that stands for the board in the assembly : updates `existing` (keeps its parameters, interfaces and zones) or makes a new one. */
export function twinPart(board, lib = {}, existing = null) {
  const { components, nets } = twinBlocks(board, lib), b = board.board || {};
  if (existing) return { ...existing, pcb: { ...existing.pcb, components, nets: { ...(existing.pcb.nets || {}), ...nets } } };
  return { dw: "part/1", id: board.part || `${board.id}-PCB`, name: board.name || board.id, family: "pcb", process: "pcb", material: "FR4", revision: board.revision || "A", function: board.description || "Carte électronique.",
    params: {}, interfaces: [], pcb: { size: [...(b.size || [60, 40])], r: b.r || 0, t: b.t || 1.6, holes: (b.holes || []).map((h) => ({ at: h.at, d: h.d })), components, zones: [], nets }, features: [], notes: [`Jumeau mécanique de la carte ${board.id}.`] };
}
/** The twin, kept as the board is designed (demande de JP : « le jumeau numérique fait / mis à jour dès les dimensions et les gros composants connus ») :
    a board whose first component is placed and that has no part yet receives one ; a board that has its part gives it its components and its
    nets whenever they change. Called inside the step that changes the board (a hook of the store) : the twin follows in the same undo step.
    only : the id of the board that changed (every board when absent). → [{ board, part, made }] : what was created or updated */
export function syncTwins(project, lib = {}, only = null) {
  const out = [], parts = project.parts || (project.parts = []);
  for (const b of project.boards || []) {
    if (only && b.id !== only) continue;
    let part = b.part ? parts.find((p) => p.id === b.part) : null;
    if (part && (part.family !== "pcb" || !part.pcb)) continue;                 // tied by hand to another kind of part : left alone
    if (!part) {
      if (roleOf(b) === "bench") continue;                                       // a board of the test bench is a tool : no twin is born for it (pcba/board_role.js)
      if (!(b.parts || []).some((p) => p.at)) continue;                           // nothing placed yet : no envelope to give
      const tw = twinPart({ ...b, part: null }, lib); let id = tw.id, n = 2; while (parts.some((p) => p.id === id)) id = `${tw.id}-${n++}`;
      parts.push({ ...tw, id }); b.part = id; out.push({ board: b.id, part: id, made: true }); continue;
    }
    const { components, nets } = twinBlocks(b, lib), next = { ...(part.pcb.nets || {}), ...nets };
    if (JSON.stringify(part.pcb.components || []) !== JSON.stringify(components) || JSON.stringify(part.pcb.nets || {}) !== JSON.stringify(next)) { part.pcb = { ...part.pcb, components, nets: next }; out.push({ board: b.id, part: part.id, made: false }); }
  }
  return out;
}
/** The board a part is the twin of, or null. */
export const boardOfPart = (project, partId) => ((project && project.boards) || []).find((b) => b.part === partId) || null;

