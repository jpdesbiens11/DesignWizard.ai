/* DesignWizard.ai — assembly logic (pure functions, no DOM, no kernel): interface matching, automatic mates,
   placement solving, linked parameters, hardware and BOM.
   asm = { id, name, instances:[{id, part, fixed, placement:{t,r}, hidden}], mates:[{id, a:{inst,iface}, b:{inst,iface}, linked, flip, angle, offset}] }
   `built` = map partId -> result of the kernel build (interfaces with frames, bbox, mass...). */

import { frameMatrix, matMul, matInvRigid, matFromPlacement, matRotAxis, matTranslate, matDir, matPoint, v3, IDENTITY } from "../cad/vec.js";
import { compatible, interfaceType, interfaceSignature } from "../cad/interfaces.js";

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

/** Solve the placements: fixed instances keep theirs, the others follow their mates (breadth first). */
export function solve(asm, built) {
  const placements = {}, explode = {}, placedBy = {}, problems = [];
  const queue = [];
  let seeds = asm.instances.filter((i) => i.fixed);
  if (!seeds.length && asm.instances.length) seeds = [asm.instances[0]];          // nothing fixed: the first instance is the ground
  for (const i of seeds) { placements[i.id] = matFromPlacement(i.placement); explode[i.id] = [0, 0, 0]; placedBy[i.id] = null; queue.push(i.id); }
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
      placements[to.inst] = T; placedBy[to.inst] = m.id;
      const n = matDir(placements[cur], fa.frame.n);
      explode[to.inst] = v3.add(explode[cur], n);
      queue.push(to.inst);
    }
  }
  const floating = [];
  for (const i of asm.instances) if (!placements[i.id]) { placements[i.id] = matFromPlacement(i.placement); explode[i.id] = [0, 0, 0]; placedBy[i.id] = null; floating.push(i.id); }
  return { placements, explode, placedBy, floating, problems };
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
  for (const inst of asm.instances) for (const it of (built[inst.part] && built[inst.part].interfaces) || []) if (!used.has(`${inst.id}/${it.id}`)) out.push({ inst: inst.id, part: inst.part, iface: it });
  return out;
}

/** Possible mates between free interfaces of different instances, best first. */
export function candidates(asm, built) {
  const free = freeInterfaces(asm, built), out = [];
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
    const x = free[i], y = free[j];
    if (x.inst === y.inst) continue;
    const c = compatible(x.iface, y.iface);
    if (!c.ok) continue;
    const [a, b] = x.iface.side === "B" ? [y, x] : [x, y];              // side A first
    out.push({ a: { inst: a.inst, iface: a.iface.id }, b: { inst: b.inst, iface: b.iface.id }, by: c.by, same: c.same, type: a.iface.type,
      score: (c.by === "key" ? 4 : 2) + (c.same ? 1 : 0), label: `${a.iface.name} ↔ ${b.iface.name}` });
  }
  return out.sort((p, q) => q.score - p.score);
}

/** Add every unambiguous mate (each interface used once, best score first). Returns the mates added. */
export function autoMate(asm, built) {
  const added = [], used = new Set();
  let n = (asm.mates || []).reduce((mx, m) => Math.max(mx, parseInt(String(m.id).replace(/\D/g, ""), 10) || 0), 0);
  asm.mates = asm.mates || [];
  for (const c of candidates(asm, built)) {
    const ka = `${c.a.inst}/${c.a.iface}`, kb = `${c.b.inst}/${c.b.iface}`;
    if (used.has(ka) || used.has(kb)) continue;
    used.add(ka); used.add(kb);
    const mate = { id: `M${++n}`, a: c.a, b: c.b, linked: true, by: c.by };
    asm.mates.push(mate); added.push(mate);
  }
  return added;
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

/** Screws, inserts, nuts and pins implied by the mates. */
export function hardware(asm, built) {
  const rows = new Map();
  for (const m of asm.mates || []) {
    const ia = instOf(asm, m.a.inst), ib = instOf(asm, m.b.inst);
    const fa = ia && ifaceOf(built, ia.part, m.a.iface), fb = ib && ifaceOf(built, ib.part, m.b.iface);
    if (!fa || !fb) continue;
    const [A, B, pa] = fa.side === "B" ? [fb, fa, ib.part] : [fa, fb, ia.part];
    const body = (built[pa].bodies || []).find((x) => x.name === A.body);
    const bb = body ? body.bbox : built[pa].bbox, n = A.frame.n;                // grip = thickness of the body that carries side A
    const extent = Math.abs(n[0]) * (bb[3] - bb[0]) + Math.abs(n[1]) * (bb[4] - bb[1]) + Math.abs(n[2]) * (bb[5] - bb[2]);
    const grip = typeof A.opts.depth === "number" ? Math.min(A.opts.depth, extent) : extent;
    let list = [];
    try { list = interfaceType(A.type).hardware(A.params, A.opts || {}, B.opts || {}, grip) || []; } catch (e) { list = []; }
    for (const h of list) {
      const r = rows.get(h.id) || { ...h, qty: 0, mates: [] };
      r.qty += h.qty; r.mates.push(m.id);
      rows.set(h.id, r);
    }
  }
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Bill of materials: parts (grouped by part number) then hardware. */
export function bom(project, asm, built) {
  const rows = [], count = new Map();
  for (const i of asm.instances) count.set(i.part, (count.get(i.part) || 0) + 1);
  let item = 1;
  for (const [pid, qty] of count) {
    const spec = project.parts.find((p) => p.id === pid) || {}, b = built[pid];
    rows.push({ item: item++, id: pid, name: spec.name || "", qty, material: spec.material || "", process: spec.process || "", mass: b ? b.mass : null, kind: "part" });
  }
  for (const h of hardware(asm, built)) rows.push({ item: item++, id: h.id, name: h.name, qty: h.qty, material: "", process: "purchased", mass: null, kind: "hardware" });
  return rows;
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
