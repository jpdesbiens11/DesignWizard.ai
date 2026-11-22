/* DesignOrbit.ai — PCBA: from functions to a circuit. A function is fulfilled by a block ; adding a block writes its
   parts (repères numbered per prefix) and merges its nets into the board : a port joins the board net of its name
   (a rail, GND, CAN_TX…), everything else stays inside the block under « <block>_<NAME> ». The functional tree keeps
   the link function → block → parts → nets, which is what a design review reads. */

import { BLOCKS, buildBlock, blockSentence } from "./blocks.js";
import { LIBRARY } from "./library.js";
import { nextRef, libraryOf } from "./model.js";
import { localNet, netClass } from "./netnames.js";

const RANK = { signal: 0, power: 1, hv: 2, ground: 3 };
const nextId = (list, prefix) => { let n = 0; for (const x of list) { const m = new RegExp(`^${prefix}(\\d+)$`).exec(x.id); if (m) n = Math.max(n, +m[1]); } return `${prefix}${n + 1}`; };
/** Next function id under a parent : "F3" at the root, "F1.2" under F1. */
export function nextFunctionId(board, parent = null) {
  const kids = (board.functions || []).filter((f) => (f.parent || null) === parent), base = parent ? `${parent}.` : "F";
  let n = (board.fseq || {})[parent || ""] || 0;                  // a number once given is never given again, even after the function is removed
  for (const f of kids) { const m = /(\d+)$/.exec(f.id); if (m) n = Math.max(n, +m[1]); }
  return `${base}${n + 1}`;
}
/** Remembers the highest number given under each parent (board.fseq), so that a number is never reused. */
function keepNumber(board, f) { const m = /(\d+)$/.exec(f.id); if (!m) return; const k = f.parent || ""; board.fseq = board.fseq || {}; if (!(board.fseq[k] >= +m[1])) board.fseq[k] = +m[1]; }
export function addFunction(board, { parent = null, name, kind, criteria = [], note } = {}) {
  const f = { id: nextFunctionId(board, parent), parent, name: name || "Nouvelle fonction", kind: kind || (parent ? "technique" : "principale"), criteria, block: null };
  if (note) f.note = note;
  (board.functions = board.functions || []).push(f); keepNumber(board, f);
  return f.id;
}
/** Removes a function and everything under it ; their blocks stay on the board, without a function. */
export function removeFunction(board, id) {
  const gone = new Set([id]);
  for (let grew = true; grew;) { grew = false; for (const f of board.functions) if (f.parent && gone.has(f.parent) && !gone.has(f.id)) { gone.add(f.id); grew = true; } }
  for (const f of board.functions) if (gone.has(f.id)) keepNumber(board, f);
  board.functions = board.functions.filter((f) => !gone.has(f.id));
  for (const b of board.blocks || []) if (gone.has(b.function)) b.function = null;
}

function mergeNet(board, name, attrs, pins) {
  let n = board.nets.find((x) => x.name === name);
  if (!n) { n = { name, class: attrs.class || "signal", voltage: 0, current: 0, pins: [] }; board.nets.push(n); }
  const cls = attrs.class && attrs.class !== "signal" ? attrs.class : netClass(name, attrs.voltage || n.voltage);
  if ((RANK[cls] || 0) > (RANK[n.class] || 0)) n.class = cls;
  n.voltage = Math.max(n.voltage || 0, attrs.voltage || 0); n.current = Math.max(n.current || 0, attrs.current || 0);
  for (const p of pins) if (!n.pins.includes(p)) n.pins.push(p);
}
const refsOf = (board, blockId) => new Map((board.parts || []).filter((p) => p.block === blockId).map((p) => [p.local, p.ref]));
/** Name of the next free net of a family : "AIN" → AIN0, AIN1… */
function nextPool(board, family, taken = []) { for (let k = 0; k < 64; k++) if (!board.nets.some((n) => n.name === `${family}${k}`) && !taken.includes(`${family}${k}`)) return `${family}${k}`; return `${family}X`; }
/** Lazy pins (a microcontroller pin offered to whoever needs it) join the nets that now exist ; nets left with lazy pins only are removed. */
function bindLazy(board) {
  const lazy = new Set();
  for (const b of board.blocks) {
    const t = BLOCKS[b.template]; if (!t) continue;
    const built = buildBlock(b.template, b.params), refs = refsOf(board, b.id);
    for (const port of Object.values(built.ports)) {
      if (!port.lazy) continue;
      const [local, pin] = port.pin.split("."), ref = refs.get(local); if (!ref) continue;
      const full = `${ref}.${pin}`, net = board.nets.find((n) => n.name === port.suggest);
      lazy.add(full);
      if (net && !net.pins.includes(full) && net.pins.some((p) => !lazy.has(p))) net.pins.push(full);
    }
  }
  const dead = new Set(board.nets.filter((n) => !n.pins.length || n.pins.every((p) => lazy.has(p))).map((n) => n.name));
  if (dead.size) dropNets(board, dead);
}
function dropNets(board, names) {
  board.nets = board.nets.filter((n) => !names.has(n.name));
  board.tracks = (board.tracks || []).filter((t) => !names.has(t.net)); board.vias = (board.vias || []).filter((v) => !names.has(v.net)); board.planes = (board.planes || []).filter((p) => !names.has(p.net));
}
/** Writes the parts and nets of a built block on the board ; `keep` = parts of a previous build, by local id. */
function apply(board, block, built, keep = new Map()) {
  const lib = libraryOf(board, LIBRARY), refs = new Map();
  for (const p of built.parts) {
    const old = keep.get(p.id), def = lib[p.comp], ref = old ? old.ref : nextRef(board, (def && def.prefix) || "X");
    const part = { ref, comp: p.comp, value: p.value || "", block: block.id, local: p.id, role: p.role || "" };
    for (const k of ["edge", "nc", "pin", "corner"]) if (p[k] !== undefined) part[k] = p[k];
    if (old) for (const k of ["at", "rot", "side", "fixed", "mpn", "dnp"]) if (old[k] !== undefined) part[k] = old[k];
    board.parts.push(part); refs.set(p.id, ref);
  }
  for (const p of built.parts) if (p.near && refs.has(p.near)) board.parts.find((x) => x.ref === refs.get(p.id)).near = refs.get(p.near);
  block.connect = block.connect || {};
  const bound = new Map();                                      // local net → board net
  for (const [name, port] of Object.entries(built.ports)) {
    if (port.lazy) continue;
    if (!block.connect[name]) block.connect[name] = port.pool ? nextPool(board, port.suggest, Object.values(block.connect)) : port.suggest;      // several ports of one block may draw from the same pool
    if (!bound.has(port.net)) bound.set(port.net, block.connect[name]);
  }
  for (const n of built.nets) mergeNet(board, bound.get(n.name) || localNet(block.id, n.name), n, n.pins.map((pin) => { const dot = pin.indexOf("."); return `${refs.get(pin.slice(0, dot))}.${pin.slice(dot + 1)}`; }));
  bindLazy(board);
}
/** Takes the parts of a block off the board and their pins off the nets ; returns the parts, by local id. */
function strip(board, blockId) {
  const mine = board.parts.filter((p) => p.block === blockId), refs = new Set(mine.map((p) => p.ref));
  board.parts = board.parts.filter((p) => p.block !== blockId);
  for (const n of board.nets) n.pins = n.pins.filter((pin) => !refs.has(pin.slice(0, pin.indexOf("."))));
  return new Map(mine.map((p) => [p.local, p]));
}

/** Adds a block to the board. opts : { function (existing id), parent, kind, name, connect: { PORT: net name } }. Returns the block id. */
export function addBlock(board, templateId, given = {}, opts = {}) {
  const built = buildBlock(templateId, given), t = built.template;
  for (const k of ["functions", "blocks", "parts", "nets", "tracks", "vias", "planes"]) board[k] = board[k] || [];
  const block = { id: nextId(board.blocks, "B"), template: templateId, name: opts.name || t.name, function: null, params: built.params, connect: { ...(opts.connect || {}) } };
  let fn = opts.function ? board.functions.find((f) => f.id === opts.function) : null;
  if (!fn) { fn = { id: nextFunctionId(board, opts.parent || null), parent: opts.parent || null, name: blockSentence(t, built.params), kind: opts.kind || (opts.parent ? "technique" : "principale"), criteria: [], block: null, auto: true }; board.functions.push(fn); }
  fn.block = block.id; block.function = fn.id;
  board.blocks.push(block);
  apply(board, block, built);
  return block.id;
}
/** Removes a block : its parts, their pins, the nets left empty and their copper. Its function stays, without a solution. */
export function removeBlock(board, blockId) {
  strip(board, blockId);
  board.blocks = board.blocks.filter((b) => b.id !== blockId);
  for (const f of board.functions) if (f.block === blockId) f.block = null;
  board.functions = board.functions.filter((f) => !(f.auto && f.block === null && !board.functions.some((c) => c.parent === f.id)));
  bindLazy(board);
}
/** Builds a block again with new parameters ; parts that keep their role keep their repère, position and locks. */
export function rebuildBlock(board, blockId, given) {
  const block = board.blocks.find((b) => b.id === blockId);
  if (!block) throw new Error(`Bloc « ${blockId} » introuvable.`);
  const before = blockSentence(BLOCKS[block.template], block.params), built = buildBlock(block.template, given || block.params), keep = strip(board, blockId);
  block.params = built.params;
  const fn = board.functions.find((f) => f.id === block.function);
  if (fn && fn.auto && fn.name === before) fn.name = blockSentence(built.template, built.params);
  apply(board, block, built, keep);
  return blockId;
}
/** Binds a port of a block to another board net. */
export function connectPort(board, blockId, port, netName) {
  const block = board.blocks.find((b) => b.id === blockId);
  if (!block) throw new Error(`Bloc « ${blockId} » introuvable.`);
  block.connect = { ...(block.connect || {}), [port]: netName };
  return rebuildBlock(board, blockId);
}
/** Renames a net everywhere ; when the new name exists the two nets are merged. */
export function renameNet(board, from, to) {
  const src = board.nets.find((n) => n.name === from);
  if (!src || from === to) return;
  const dst = board.nets.find((n) => n.name === to);
  if (dst) { mergeNet(board, to, src, src.pins); board.nets = board.nets.filter((n) => n !== src); } else { src.name = to; src.class = RANK[netClass(to, src.voltage)] > RANK[src.class] ? netClass(to, src.voltage) : src.class; }
  for (const list of [board.tracks || [], board.vias || [], board.planes || []]) for (const x of list) if (x.net === from) x.net = to;
  for (const b of board.blocks || []) for (const [k, v] of Object.entries(b.connect || {})) if (v === from) b.connect[k] = to;
}

/** The functional structure in tree order : one row per function, with the solution that fulfils it.
    { id, level, parent, name, kind, criteria, block, blockName, template, templateName, parts: [refs], nets: [names], cost } */
export function functionRows(board, lib = LIBRARY) {
  const L = libraryOf(board, lib), fs = board.functions || [], rows = [];
  const walk = (parent, level) => {
    for (const f of fs.filter((x) => (x.parent || null) === parent)) {
      const b = (board.blocks || []).find((x) => x.id === f.block) || null, parts = b ? (board.parts || []).filter((p) => p.block === b.id) : [], refs = new Set(parts.map((p) => p.ref));
      rows.push({ id: f.id, level, parent: f.parent || null, name: f.name, kind: f.kind || "technique", criteria: f.criteria || [], note: f.note || "", block: b ? b.id : null, blockName: b ? b.name : "", template: b ? b.template : "",
        templateName: b && BLOCKS[b.template] ? BLOCKS[b.template].name : "", parts: parts.map((p) => p.ref), nets: (board.nets || []).filter((n) => n.pins.some((pin) => refs.has(pin.slice(0, pin.indexOf("."))))).map((n) => n.name),
        cost: parts.reduce((s, p) => s + (p.dnp ? 0 : (L[p.comp] && L[p.comp].price) || 0), 0), leaf: !fs.some((x) => x.parent === f.id) });
      walk(f.id, level + 1);
    }
  };
  walk(null, 1);
  return rows;
}
/** The same structure as a nested tree. */
export function functionTree(board, lib = LIBRARY) {
  const rows = functionRows(board, lib), byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }])), roots = [];
  for (const r of byId.values()) (r.parent && byId.has(r.parent) ? byId.get(r.parent).children : roots).push(r);
  return roots;
}
const csv = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const critText = (c) => (c || []).map((x) => `${x.name} : ${x.level}${x.flex ? ` (${x.flex})` : ""}`).join(" | ");
/** The functional structure as a spreadsheet file (semicolons, UTF-8 with byte-order mark). */
export function functionCsv(rows) {
  const head = ["Repère", "Niveau", "Parent", "Fonction", "Type", "Critères", "Bloc", "Solution", "Composants", "Nets", "Coût"];
  return `﻿${[head, ...rows.map((r) => [r.id, r.level, r.parent || "", r.name, r.kind, critText(r.criteria), r.block || "", r.templateName || "", r.parts.join(" "), r.nets.join(" "), r.cost.toFixed(2).replace(".", ",")])].map((l) => l.map(csv).join(";")).join("\r\n")}\r\n`;
}
/** The functional structure as an indented text tree. */
export function functionOutline(rows) {
  return rows.map((r) => `${"  ".repeat(r.level - 1)}${r.id}  ${r.name}  [${r.kind}]${r.criteria.length ? `  { ${critText(r.criteria)} }` : ""}${r.block ? `  → ${r.block} ${r.blockName} (${r.parts.length} composants)` : r.leaf ? "  → sans solution" : ""}`).join("\n");
}
