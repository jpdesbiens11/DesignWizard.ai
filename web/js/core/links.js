/* DynamiteOrbit — the dependency between mated interfaces.
   When a part changes, every interface it shares through a linked mate is compared (evaluated values) with the other
   side; where they differ, the other part ADAPTS: if its interface field is driven by one of its own parameters
   (e.g. "dx": "pcbL"), that parameter takes the new value — the whole part follows; otherwise the field is overwritten.
   Runs inside the same undoable step as the edit that caused it. Pure functions (no DOM, no kernel). */

import { resolveParams, evalDeep } from "../cad/expr.js";
import { openInstances, finder } from "./asm_levels.js";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : JSON.stringify(a) === JSON.stringify(b));

function scopeOf(spec) { try { return resolveParams(spec.params || {}).scope; } catch (e) { return null; } }
export function evaluatedParams(spec, ifaceId) {
  const it = (spec.interfaces || []).find((i) => i.id === ifaceId), scope = scopeOf(spec);
  if (!it || !scope) return null;
  try { return evalDeep(it.params || {}, scope); } catch (e) { return null; }
}

/** Write the evaluated values `src` into the raw params `dst` of the partner; returns the list of things changed. */
function assign(src, dst, dstEval, partner, path, changes) {
  for (const [k, v] of Object.entries(src)) {
    const cur = dstEval ? dstEval[k] : undefined, where = path ? `${path}.${k}` : k;
    if (isObj(v)) { if (!isObj(dst[k])) dst[k] = {}; assign(v, dst[k], isObj(cur) ? cur : null, partner, where, changes); continue; }
    if (same(v, cur)) continue;
    const raw = dst[k];
    if (typeof v === "number" && typeof raw === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.trim())) {
      const name = raw.trim(), def = partner.params && partner.params[name];
      if (def !== undefined && !(isObj(def) && def.expr !== undefined)) {                 // a plain parameter drives this field: move the parameter
        if (isObj(def)) { def.value = v; if (typeof def.min === "number" && v < def.min) def.min = v; if (typeof def.max === "number" && v > def.max) def.max = v; }
        else partner.params[name] = v;
        changes.push({ param: name, value: v, field: where });
        continue;
      }
    }
    dst[k] = Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v;
    changes.push({ field: where, value: v });
  }
}

/** Propagate the interfaces of `partId` to their linked partners. Mutates the project; returns [{part, iface, from, changes}]. */
export function propagate(project, partId, visited = new Set()) {
  const out = [];
  if (visited.has(partId) || visited.size > 12) return out;
  visited.add(partId);
  const src = (project.parts || []).find((p) => p.id === partId);
  if (!src) return out;
  const touched = new Set();
  for (const asm of project.assemblies || []) { const open = openInstances(asm, finder(project));      // a joint may hold to a part inside a sub-assembly
   for (const m of asm.mates || []) {
    if (m.linked === false) continue;
    for (const [me, other] of [[m.a, m.b], [m.b, m.a]]) {
      const inst = open.find((i) => i.id === me.inst), oinst = open.find((i) => i.id === other.inst);
      if (!inst || !oinst || inst.part !== partId || oinst.part === partId) continue;
      const partner = project.parts.find((p) => p.id === oinst.part);
      const pi = partner && (partner.interfaces || []).find((i) => i.id === other.iface);
      const values = evaluatedParams(src, me.iface);
      if (!pi || !values) continue;
      const changes = [];
      pi.params = pi.params || {};
      assign(values, pi.params, evaluatedParams(partner, pi.id), partner, "", changes);
      if (changes.length) { out.push({ part: partner.id, iface: pi.id, from: `${partId}/${me.iface}`, mate: m.id, changes }); touched.add(partner.id); }
    }
   } }
  for (const id of touched) out.push(...propagate(project, id, visited));
  return out;
}

/** Linked mates whose two sides do not hold the same evaluated values (should be empty after propagation). */
export function outOfSync(project, asm) {
  const out = [];
  const open = openInstances(asm, finder(project));
  for (const m of asm.mates || []) {
    const ia = open.find((i) => i.id === m.a.inst), ib = open.find((i) => i.id === m.b.inst);
    const pa = ia && project.parts.find((p) => p.id === ia.part), pb = ib && project.parts.find((p) => p.id === ib.part);
    if (!pa || !pb) continue;
    const va = evaluatedParams(pa, m.a.iface), vb = evaluatedParams(pb, m.b.iface);
    if (va && vb && Object.keys(va).some((k) => !same(va[k], vb[k]) && vb[k] !== undefined)) out.push({ mate: m.id, a: pa.id, b: pb.id });
  }
  return out;
}

/** Store hook: after an edit of a part, adapt the linked partners in the same undo step. */
export function linkHook(project, extra) {
  if (!extra || !extra.part || extra.noLink) return;
  const ch = propagate(project, extra.part);
  if (ch.length) extra.linked = ch;
}
