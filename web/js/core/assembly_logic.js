/* DynamiteOrbit — assembly logic (pure functions, no DOM, no kernel): interface matching, automatic mates,
   placement solving, linked parameters, hardware and BOM.
   asm = { id, name, instances:[{id, part, fixed, placement:{t,r}, hidden}], mates:[{id, a:{inst,iface}, b:{inst,iface}, linked, flip, angle, offset}] }
   `built` = map partId -> result of the kernel build (interfaces with frames, bbox, mass...). */

import { elecProcess } from "../cad/interfaces_elec.js";
import { frameMatrix, matMul, matInvRigid, matFromPlacement, matRotAxis, matTranslate, matDir, matPoint, v3, IDENTITY } from "../cad/vec.js";
import { compatible, interfaceType, interfaceSignature, patternPoints } from "../cad/interfaces.js";
import { flatAsm } from "./asm_levels.js";
import { liveAsm } from "./asm_live.js";

const FLIP = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];      // half turn about u: faces meet, normals opposed
const clone = (o) => JSON.parse(JSON.stringify(o));

export function ifaceOf(built, partId, ifaceId) {
  const b = built[partId];
  return b ? (b.interfaces || []).find((i) => i.id === ifaceId) || null : null;
}
const instOf = (asm, id) => asm.instances.find((i) => i.id === id) || null;

/** World matrix of instance B so that its interface frame meets the frame of A. */
export function mateMatrix(Ta, Fa, Fb, mate = {}) {
  let G = matMul(Ta, frameMatrix(Fa));
  if (!mate.flip) G = matMul(G, FLIP);
  if (mate.angle) G = matMul(G, matRotAxis([0, 0, 1], mate.angle));
  if (mate.offset) G = matMul(G, matTranslate([0, 0, -mate.offset]));
  return matMul(G, matInvRigid(frameMatrix(Fb)));
}

/** Solve the placements: fixed instances keep theirs, the others follow their mates (breadth first).
    A sub-assembly is one rigid whole (asm.groups, core/asm_levels.js) : each of its parts has its place in it (`local`), and
    the first of them that is placed — by a joint of this assembly, or because the sub-assembly is the ground — takes the
    others with it. The sub-assembly itself has its placement, under the id of its instance. */
export function solve(asm, built) {
  const placements = {}, explode = {}, placedBy = {}, problems = [];
  const queue = [], groups = asm.groups || {}, inGroup = (g) => asm.instances.filter((i) => i.group === g);
  /* a whole sub-assembly put where its frame G is : every part at G · its place inside */
  const seat = (g, G, by, push) => { placements[g] = G; placedBy[g] = by; explode[g] = push; for (const j of inGroup(g)) { placements[j.id] = matMul(G, j.local || IDENTITY); placedBy[j.id] = by; explode[j.id] = j.burst ? v3.add(push, matDir(G, j.burst)) : push; queue.push(j.id); } };      // exploded, a block moves away AND opens : each part keeps the push it has inside (burst)
  /* one instance placed at T : alone, or with the whole sub-assembly it belongs to */
  const put = (i, T, by, push) => { if (i.group && groups[i.group]) seat(i.group, matMul(T, matInvRigid(i.local || IDENTITY)), by, push); else { placements[i.id] = T; placedBy[i.id] = by; explode[i.id] = push; queue.push(i.id); } };
  const home = (i) => { if (i.group && groups[i.group]) seat(i.group, matFromPlacement(groups[i.group].placement), null, [0, 0, 0]); else put(i, matFromPlacement(i.placement), null, [0, 0, 0]); };
  let seeds = [...asm.instances.filter((i) => i.fixed), ...Object.keys(groups).filter((g) => groups[g].fixed).map((g) => inGroup(g)[0]).filter(Boolean)];
  if (!seeds.length && asm.instances.length) seeds = [asm.instances[0]];          // nothing fixed: the first instance is the ground
  for (const i of seeds) if (!placements[i.id]) home(i);
  const mates = asm.mates || [];
  while (queue.length) {
    const cur = queue.shift();
    for (const m of mates) {
      const fwd = m.a.inst === cur, back = m.b.inst === cur;
      if (!fwd && !back) continue;
      const from = fwd ? m.a : m.b, to = fwd ? m.b : m.a;
      const iFrom = instOf(asm, from.inst), iTo = instOf(asm, to.inst);
      if (!iFrom || !iTo) continue;
      const fa = ifaceOf(built, iFrom.part, from.iface), fb = ifaceOf(built, iTo.part, to.iface);
      if (!fa || !fb) { if (!problems.some((p) => p.mate === m.id)) problems.push({ mate: m.id, kind: "missing", msg: `Mate ${m.id} : interface introuvable (${!fa ? from.iface : to.iface}).` }); continue; }
      // the mate is defined from A to B; walking it backwards uses the inverse relation
      const T = fwd ? mateMatrix(placements[cur], fa.frame, fb.frame, m) : inverseMate(placements[cur], fa.frame, fb.frame, m);
      if (placements[to.inst]) {
        if (placedBy[to.inst] !== m.id && placedBy[cur] !== m.id) {
          const dev = deviation(placements[to.inst], T);
          if (dev > 0.05 && !problems.some((p) => p.mate === m.id)) problems.push({ mate: m.id, kind: "conflict", dev, msg: `Mate ${m.id} : les deux pièces sont déjà placées et l'interface est décalée de ${dev.toFixed(2)} mm.` });
        }
        continue;
      }
      put(iTo, T, m.id, v3.add(explode[cur], matDir(placements[cur], fa.frame.n)));
    }
  }
  const floating = [];      // what no joint reaches stays where it was put by hand : a part, or a whole sub-assembly (counted once)
  for (const i of asm.instances) if (!placements[i.id]) { floating.push(i.group && groups[i.group] ? i.group : i.id); home(i); queue.length = 0; }
  return { placements, explode, placedBy, floating, problems };
}
/** The assembly opened and solved through its levels : each sub-assembly is solved on its own first, and its parts keep in the
    parent the places they have in it. Parts that could not be built are left out. find(id) → assembly.
    → { asm (opened : core/asm_levels.js flatAsm, each part of a sub-assembly with its `local` and its `burst`), sol } */
export function solveLevels(asm, built, find, memo = new Map()) {
  const flat = flatAsm(asm, find), groups = flat.groups || {};
  const inner = (id) => { if (!memo.has(id)) memo.set(id, solveLevels(find(id), built, find, memo)); return memo.get(id); };
  const instances = flat.instances.filter((i) => built[i.part]).map((i) => { if (!(i.group && groups[i.group])) return i;
    const s = inner(groups[i.group].asm).sol, lid = i.id.slice(i.group.length + 1); return { ...i, local: s.placements[lid] || IDENTITY, burst: s.explode[lid] || [0, 0, 0] }; });      // its place in the sub-assembly, and the way it leaves it in an exploded view
  const opened = { ...flat, instances };
  return { asm: opened, sol: solve(opened, built) };
}
/** The assembly as a TREE of placed nodes, for what keeps its structure (STEP, Onshape) : the parts of this level, and each
    sub-assembly as ONE node that holds its own — every matrix in the frame of the node above, so that the same sub-assembly
    placed twice is the same content twice. What is put aside, gone from the project or not built is left out.
    → [{ inst, part, matrix } | { inst, asm, matrix, children: [ … ] }] */
export function placedTree(asm, built, find, memo = new Map()) {
  const { asm: opened, sol } = solveLevels(asm, built, find, memo), groups = opened.groups || {}, out = [];
  for (const i of (liveAsm(asm) || { instances: [] }).instances || []) {
    if (!sol.placements[i.id]) continue;
    if (i.asm) { if (groups[i.id]) out.push({ inst: i.id, asm: i.asm, matrix: sol.placements[i.id], children: placedTree(find(i.asm), built, find, memo) }); }
    else if (built[i.part]) out.push({ inst: i.id, part: i.part, matrix: sol.placements[i.id] });
  }
  return out;
}
function inverseMate(Tb, Fb, Fa, mate) {
  // Tb = G * inv(Mb) with G = Ta * Ma * X  =>  Ta = Tb * Mb * inv(X) * inv(Ma)
  let X = IDENTITY.slice();
  if (!mate.flip) X = matMul(X, FLIP);
  if (mate.angle) X = matMul(X, matRotAxis([0, 0, 1], mate.angle));
  if (mate.offset) X = matMul(X, matTranslate([0, 0, -mate.offset]));
  return matMul(matMul(matMul(Tb, frameMatrix(Fb)), matInvRigid(X)), matInvRigid(frameMatrix(Fa)));
}
function deviation(A, B) {
  let d = Math.hypot(A[12] - B[12], A[13] - B[13], A[14] - B[14]);
  for (const p of [[50, 0, 0], [0, 50, 0], [0, 0, 50]]) d = Math.max(d, v3.dist(matPoint(A, p), matPoint(B, p)));
  return d;
}

/** Interfaces of the assembly not used by any mate yet. */
export function freeInterfaces(asm, built) {
  const used = new Set();
  for (const m of asm.mates || []) { used.add(`${m.a.inst}/${m.a.iface}`); used.add(`${m.b.inst}/${m.b.iface}`); }
  const out = [];
  for (const inst of asm.instances) for (const it of (built[inst.part] && built[inst.part].interfaces) || []) if (!used.has(`${inst.id}/${it.id}`)) out.push({ inst: inst.id, part: inst.part, iface: it, external: !!it.external, ...(inst.group ? { group: inst.group } : {}) });
  return out;
}

export const pairKey = (a, b) => [`${a.inst}/${a.iface}`, `${b.inst}/${b.iface}`].sort().join("|");

/** Possible mates between free interfaces of different instances, best first. Pairs the user removed by hand
    (asm.rejected) are left out unless `withRejected`: the automatic mating never brings them back. */
export function candidates(asm, built, withRejected = false) {
  const free = freeInterfaces(asm, built), out = [], rejected = new Set(asm.rejected || []);
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
    const x = free[i], y = free[j];
    if (x.inst === y.inst || (x.group && x.group === y.group)) continue;      // two parts of one sub-assembly are joined in the sub-assembly, not here
    if (x.part === y.part && x.iface.id === y.iface.id && (x.iface.side === "B") === (y.iface.side === "B")) continue;      // the same face of two copies of one part (a flex in each CORE) : not a joint
    const c = compatible(x.iface, y.iface);
    if (!c.ok) continue;
    const [a, b] = x.iface.side === "B" ? [y, x] : [x, y];              // side A first
    const rej = rejected.has(pairKey({ inst: a.inst, iface: a.iface.id }, { inst: b.inst, iface: b.iface.id }));
    if (rej && !withRejected) continue;
    out.push({ rejected: rej, a: { inst: a.inst, iface: a.iface.id }, b: { inst: b.inst, iface: b.iface.id }, by: c.by, same: c.same, type: a.iface.type, ...(a.iface.type === "rail" ? { flip: true } : {}),     // a tongue slides IN : the two frames coincide instead of facing each other
      score: (c.by === "key" ? 4 : 2) + (c.same ? 1 : 0), label: `${a.iface.name} ↔ ${b.iface.name}` });
  }
  return out.sort((p, q) => q.score - p.score);
}

/** Add every unambiguous mate (each interface used once, best score first). Returns the mates added.
    opened : the assembly as flatAsm gives it, when it holds sub-assemblies — the joints are found between its parts through the
    levels, and written in `asm` (a part inside a sub-assembly is named « S~i2 »). */
export function autoMate(asm, built, opened) {
  const added = [], used = new Set();
  let n = nextJoint(asm) - 1;
  asm.mates = asm.mates || [];
  for (const c of candidates(opened || asm, built)) {
    const ka = `${c.a.inst}/${c.a.iface}`, kb = `${c.b.inst}/${c.b.iface}`;
    if (used.has(ka) || used.has(kb)) continue;
    used.add(ka); used.add(kb);
    const mate = { id: `M${++n}`, a: c.a, b: c.b, linked: true, by: c.by, ...(c.flip ? { flip: true } : {}) };
    asm.mates.push(mate); added.push(mate);
  }
  if (added.length) asm.mseq = n;
  return added;
}
/** The number the next joint takes : a joint keeps its number for ever, a joint removed does not give it back (asm.mseq). */
export function nextJoint(asm) {
  return Math.max(asm.mseq || 0, (asm.mates || []).reduce((mx, m) => Math.max(mx, parseInt(String(m.id).replace(/\D/g, ""), 10) || 0), 0)) + 1;
}
const JOINT_KIND = { bolt_pattern: "Bolted", bond: "Bonded", fit: "Fitted", planar: "Seated", pins: "Pinned", cutout: "Panel mount", rail: "Guided", weld: "Welded", contact: "Pressure contact" };      // the kind of a joint, as the trade says it
/** The joint register of an assembly : one row per mated pair of interfaces, with what holds it. specs : part id → spec (to tell a snapped joint).
    → [{ id, type, kind (in French), a, b (instance · part · interface name), key, by, hardware: [{ name, qty, unit }], process }] */
export function joints(asm, built, specs = {}) {
  const inst = new Map(asm.instances.map((i) => [i.id, i]));
  return (asm.mates || []).map((m) => {
    const ia = inst.get(m.a.inst), ib = inst.get(m.b.inst), A = ia && ifaceOf(built, ia.part, m.a.iface), B = ib && ifaceOf(built, ib.part, m.b.iface);
    if (!A || !B) return { id: m.id, type: "?", kind: "Rompu", a: `${m.a.inst}/${m.a.iface}`, b: `${m.b.inst}/${m.b.iface}`, key: "", by: m.by || "", hardware: [], process: "une interface a disparu" };
    const hw = mateHardware(asm, built, m), snap = A.type === "planar" && [specs[ia.part], specs[ib.part]].some((s) => s && s.mold && (s.mold.closure === "clips" || s.mold.lifters > 0)), p = A.params || {};
    const process = A.type === "bolt_pattern" ? `${patternCount(p)} × ${p.screw}` : A.type === "bond" ? `film ${p.gap} mm · ${p.w} × ${p.h} mm · ${p.adhesive || "epoxy"} · préparation ${p.prep || "degrease"}${p.cure ? ` · ${p.cure}` : ""}` : A.type === "fit" ? `Ø ${p.d} ${p.fit || ""}`.trim() : A.type === "weld" || A.type === "contact" ? elecProcess(A.type, p, A.opts || {}) : snap ? "crochets dans les fenêtres" : "";
    return { id: m.id, type: A.type, kind: snap ? "Encliqueté" : A.type === "weld" && p.process === "wirebond" ? "Câblé par fils" : JOINT_KIND[A.type] || A.type, a: `${ia.part} · ${A.name || A.id}`, b: `${ib.part} · ${B.name || B.id}`, key: A.key || B.key || "", by: m.by || "", hardware: hw.map((h) => ({ name: h.name, qty: h.qty, unit: h.unit || "" })), process };
  });
}
const patternCount = (p) => { try { return patternPoints(p.pattern).length; } catch (e) { return "?"; } };
/** The register as a table for a spreadsheet. */
export function jointsCsv(rows) {
  const q = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)), health = rows.some((r) => r.health);      // the health columns appear when the register carries them
  return `\ufeff${[["N°", "Joint", "Pièce A · interface", "Pièce B · interface", "Clé", "Ce qui le tient", "Procédé", ...(health ? ["Santé", "Remarques"] : [])], ...rows.map((r) => [r.id, r.kind, r.a, r.b, r.key, r.hardware.map((h) => `${h.qty}${h.unit ? ` ${h.unit}` : " ×"} ${h.name}`).join(" + "), r.process, ...(health ? [r.health || "", (r.notes || []).join(" ")] : [])])].map((l) => l.map(q).join(";")).join("\r\n")}\r\n`;
}

/** After the shared params of an interface changed on one part: copy them to every linked partner (the dependency).
    Mutates `project`; returns the list of {part, iface} that were updated. */
export function syncLinked(project, partId, ifaceId) {
  const src = project.parts.find((p) => p.id === partId);
  const si = src && (src.interfaces || []).find((i) => i.id === ifaceId);
  if (!si) return [];
  const changed = [];
  for (const asm of project.assemblies || []) for (const m of asm.mates || []) {
    if (m.linked === false) continue;
    for (const [me, other] of [[m.a, m.b], [m.b, m.a]]) {
      const inst = instOf(asm, me.inst), oinst = instOf(asm, other.inst);
      if (!inst || !oinst || inst.part !== partId || me.iface !== ifaceId) continue;
      const target = project.parts.find((p) => p.id === oinst.part);
      const ti = target && (target.interfaces || []).find((i) => i.id === other.iface);
      if (!ti || JSON.stringify(ti.params || {}) === JSON.stringify(si.params || {})) continue;
      ti.params = clone(si.params || {});
      if (si.key && !ti.key) ti.key = si.key;
      changed.push({ part: target.id, iface: ti.id });
    }
  }
  return changed;
}

/** Linked mates whose two sides no longer share the same parameters (a broken dependency). */
export function brokenLinks(asm, built) {
  const out = [];
  for (const m of asm.mates || []) {
    const ia = instOf(asm, m.a.inst), ib = instOf(asm, m.b.inst);
    const fa = ia && ifaceOf(built, ia.part, m.a.iface), fb = ib && ifaceOf(built, ib.part, m.b.iface);
    if (fa && fb && fa.type === fb.type && interfaceSignature(fa) !== interfaceSignature(fb)) out.push({ mate: m.id, a: fa, b: fb, partA: ia.part, partB: ib.part });
  }
  return out;
}

/** Screws, inserts, nuts and pins one mate asks for. */
export function mateHardware(asm, built, m) {
  const ia = instOf(asm, m.a.inst), ib = instOf(asm, m.b.inst);
  const fa = ia && ifaceOf(built, ia.part, m.a.iface), fb = ib && ifaceOf(built, ib.part, m.b.iface);
  if (!fa || !fb) return [];
  const [A, B, pa] = fa.side === "B" ? [fb, fa, ib.part] : [fa, fb, ia.part];
  const body = (built[pa].bodies || []).find((x) => x.name === A.body);
  const bb = body ? body.bbox : built[pa].bbox, n = A.frame.n;                // grip = thickness of the body that carries side A
  const extent = Math.abs(n[0]) * (bb[3] - bb[0]) + Math.abs(n[1]) * (bb[4] - bb[1]) + Math.abs(n[2]) * (bb[5] - bb[2]);
  const grip = typeof A.opts.depth === "number" ? Math.min(A.opts.depth, extent) : extent;
  try { return interfaceType(A.type).hardware(A.params, A.opts || {}, B.opts || {}, grip) || []; } catch (e) { return []; }
}
/** Screws, inserts, nuts and pins implied by the mates. */
export function hardware(asm, built) {
  const rows = new Map();
  for (const m of asm.mates || []) {
    for (const h of mateHardware(asm, built, m)) {
      const r = rows.get(h.id) || { ...h, qty: 0, mates: [] };
      r.qty = Math.round((r.qty + h.qty) * 100) / 100; r.mates.push(m.id); r.mate = r.mates.join(", ");
      rows.set(h.id, r);
    }
  }
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const partRow = (project, built, pid, qty) => { const spec = project.parts.find((p) => p.id === pid) || {}, b = built[pid]; return { id: pid, name: spec.name || "", qty, material: spec.material || "", process: spec.process || "", mass: b ? b.mass : null, kind: "part" }; };
const hardwareRow = (h) => ({ id: h.id, name: `${h.name}${h.unit ? ` (${h.unit})` : ""}`, qty: h.qty, material: "", process: "purchased", mass: null, kind: "hardware" });
const numbered = (rows) => rows.map((r, k) => ({ item: k + 1, ...r }));
/** Bill of materials: parts (grouped by part number) then hardware. */
export function bom(project, asm, built) {
  const count = new Map();
  for (const i of asm.instances) count.set(i.part, (count.get(i.part) || 0) + 1);
  return numbered([...[...count].map(([pid, qty]) => partRow(project, built, pid, qty)), ...hardware(asm, built).map(hardwareRow)]);
}
/** The bill of materials of ONE LEVEL, as the drawing of an assembly lists it : each sub-assembly placed here is one line (it has
    its own drawing and its own list), then the parts placed at this level, then the hardware of the joints of this level — the
    joints inside a sub-assembly belong to its own list. `opened` : the assembly opened (flatAsm, solveLevels).
    A sub-assembly line : { kind: "assembly", id, name, qty, rev, parts (how many one of it holds), mass (of one), group (the first instance placed) }. */
export function bomTop(project, opened, built) {
  const subs = new Map(), parts = new Map();
  for (const [g, x] of Object.entries(opened.groups || {})) { const r = subs.get(x.asm) || { qty: 0, group: g }; r.qty += 1; subs.set(x.asm, r); }
  for (const i of opened.instances) if (!i.group) parts.set(i.part, (parts.get(i.part) || 0) + 1);
  const subRow = ([aid, r]) => { const doc = (project.assemblies || []).find((a) => a.id === aid) || {}, leaves = opened.instances.filter((i) => i.group === r.group);
    return { id: aid, name: doc.name || "", qty: r.qty, material: "", process: "assembly", mass: leaves.reduce((m, i) => m + (built[i.part] ? built[i.part].mass : 0), 0), kind: "assembly", rev: doc.revision || "A", parts: leaves.length, group: r.group }; };
  return numbered([...[...subs].map(subRow), ...[...parts].map(([pid, qty]) => partRow(project, built, pid, qty)), ...hardware({ ...opened, mates: (opened.mates || []).filter((m) => !m.of) }, built).map(hardwareRow)]);
}

/** Mass and centre of gravity of the placed assembly (parts only). */
export function massProps(asm, built, placements) {
  let mass = 0; const acc = [0, 0, 0];
  for (const i of asm.instances) {
    const b = built[i.part];
    if (!b || !placements[i.id]) continue;
    const c = matPoint(placements[i.id], b.cog);
    mass += b.mass; for (let k = 0; k < 3; k++) acc[k] += c[k] * b.mass;
  }
  return { mass, cog: mass > 0 ? acc.map((x) => x / mass) : [0, 0, 0] };
}
