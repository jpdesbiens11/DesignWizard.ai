/* DesignWizard.ai — the dimension model of a drawing : every dimension the design defines, numbered once and for all the
   time the part does not change. A drawing shows them either on a view (overall sizes, the basic dimensions that locate a
   bolt pattern) or in a table (the other design parameters, the dimensions of the interfaces, the holes) : in both cases the
   dimension carries a round balloon with its number, and may be classed — normal, reference ( ), special characteristic
   (SC) or critical special characteristic (CSC). Classes live on the part : spec.characteristics = { key: "ref" | "sc" | "csc" }.
   Pure : no kernel, no DOM. */

import { patternPoints } from "../cad/interfaces.js";
import { evaluate } from "../cad/expr.js";
import { faceKey } from "../cad/vec.js";

export const DIM_CLASSES = {
  normal: { fr: "Normale", short: "" },
  ref: { fr: "Référence ( )", short: "REF" },
  sc: { fr: "SC — caractéristique spéciale", short: "SC" },
  csc: { fr: "CSC — caractéristique spéciale critique", short: "CSC" },
};
/** The view that looks at a face, and the two world axes it shows. */
export const VIEW_OF_FACE = { "+Z": ["top", 0, 1], "-Z": ["top", 0, 1], "+Y": ["front", 0, 2], "-Y": ["front", 0, 2], "+X": ["right", 1, 2], "-X": ["right", 1, 2] };
const AXIS = ["X", "Y", "Z"], OVERALL = ["Overall length", "Overall width", "Overall height"];
const PARAM_FR = { w: "width", h: "height", d: "diameter", length: "length", depth: "depth", t: "thickness", r: "radius", gap: "bond line", pitch: "pitch", pcd: "bolt circle Ø" };      // the words of a drawing, in English
export const f2 = (v) => (Math.round(v * 100) / 100).toString();      // a drawing is written in English : a decimal point
const uniq = (list) => [...new Set(list.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
const even = (u) => u.length < 3 || u.slice(2).every((x, i) => Math.abs((x - u[i + 1]) - (u[1] - u[0])) < 0.01);

/** Where the design parameters show on the views. A parameter that an operation uses as it stands — the size of a pocket, the wall of a
    shell, the radius of a corner, the centre of a window written « centre - size / 2 » — is dimensioned on the view that faces that
    operation. What is only reached through a formula stays in the table. → Map(param → { on, dir, p1, p2 } | { on, leader: [x, y] }) */
export function locateParams(spec, built) {
  const P = new Map(Object.entries(spec.params || {}).filter(([, p]) => p && typeof p.value === "number" && p.unit === "mm").map(([k, p]) => [k, p.value])), scope = Object.fromEntries(Object.entries(spec.params || {}).map(([k, p]) => [k, p && typeof p === "object" ? p.value : p]));
  const out = new Map(), bb = built.bbox || [0, 0, 0, 0, 0, 0], txt = (e) => (typeof e === "string" ? e.trim() : null), bare = (e) => (P.has(txt(e)) ? txt(e) : null);
  const num = (e) => { try { const v = typeof e === "number" ? e : evaluate(String(e), scope); return Number.isFinite(v) ? v : null; } catch (x) { return null; } };
  const centre = (e, size) => { const m = /^([A-Za-z_]\w*)\s*-\s*([A-Za-z_]\w*)\s*\/\s*2$/.exec(txt(e) || ""); return m && P.has(m[1]) && m[2] === txt(size) ? m[1] : null; };
  const put = (k, d) => { if (k && !out.has(k)) out.set(k, d); }, atEdge = (i) => Math.abs(bb[i]) < 0.005;      // a position is read from the datum edge : the origin of the part must be on it
  /* a rectangle [x, y, w, h] drawn on the plane a view shows (world axes a, b) */
  const rect = (view, a, b, r) => { const [x, y, w, h] = r.map(num); if ([x, y, w, h].some((v) => v === null)) return;
    put(bare(r[2]), { on: view, dir: "h", p1: [x, y + h], p2: [x + w, y + h] }); put(bare(r[3]), { on: view, dir: "v", p1: [x + w, y], p2: [x + w, y + h] });
    if (atEdge(a)) { put(centre(r[0], r[2]), { on: view, dir: "h", p1: [bb[a], y + h / 2], p2: [x + w / 2, y + h / 2] }); put(bare(r[0]), { on: view, dir: "h", p1: [bb[a], y], p2: [x, y] }); }
    if (atEdge(b)) { put(centre(r[1], r[3]), { on: view, dir: "v", p1: [x + w / 2, bb[b]], p2: [x + w / 2, y + h / 2] }); put(bare(r[1]), { on: view, dir: "v", p1: [x, bb[b]], p2: [x, y] }); }
  };
  for (const f of spec.features || []) {
    const def = f.profile && Array.isArray(f.profile.rect) ? f.profile : Array.isArray(f.rect) ? { rect: f.rect, r: f.r } : null;
    if ((f.op === "pocket" || f.op === "pad") && def) { const V = VIEW_OF_FACE[faceKey(f.face || "+Z")]; if (V) rect(V[0], V[1], V[2], def.rect); }
    else if (f.op === "extrude" && def && (f.plane || "XY") === "XY") { rect("top", 0, 1, def.rect);
      const q = def.rect.map(num), R = bare(def.r) ? P.get(bare(def.r)) : null; if (R && q.every((v) => v !== null)) { const k = R * (1 - Math.SQRT1_2); put(bare(def.r), { on: "top", leader: [q[0] + q[2] - k, q[1] + k], radius: true }); } }      // the corner nearest the front view : the leader leaves into the free space between the views
    else if (f.op === "shell" && bare(f.t) && (f.open || ["+Z"]).map(faceKey).includes("+Z")) put(bare(f.t), { on: "top", dir: "h", p1: [bb[0], (bb[1] + bb[4]) / 2], p2: [bb[0] + P.get(bare(f.t)), (bb[1] + bb[4]) / 2] });
    else if (f.op === "box" && Array.isArray(f.size) && f.mode !== "cut") { const z = f.size.map(num), a = (f.at || [0, 0, 0]).map(num); if ([...z, ...a].some((v) => v === null)) continue;
      put(bare(f.size[0]), { on: "top", dir: "h", p1: [a[0], a[1] + z[1]], p2: [a[0] + z[0], a[1] + z[1]] }); put(bare(f.size[1]), { on: "top", dir: "v", p1: [a[0] + z[0], a[1]], p2: [a[0] + z[0], a[1] + z[1]] });
      put(bare(f.size[2]), { on: "front", dir: "v", p1: [a[0] + z[0], a[2]], p2: [a[0] + z[0], a[2] + z[2]] }); }
  }
  return out;
}

/** Every dimension of a part. → [{ n, key, kind, label, value, text, cls, on (view) + dir + p1 + p2 for a dimension drawn on a view
    (or `leader` for a radius), table ("def" | "holes") for a tabulated one, basic (boxed : located by a position tolerance) }]
    kind : overall · pattern · detail (a design parameter shown where its operation is) · hole · param · iface */
export function dimensionList(spec, built) {
  const out = [], bb = built.bbox || [0, 0, 0, 0, 0, 0], cls = spec.characteristics || {}, ext = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]], taken = new Set();
  const add = (key, d) => out.push({ key, cls: DIM_CLASSES[cls[key]] ? cls[key] : "normal", ...d });
  const params = Object.entries(spec.params || {}).filter(([, p]) => p && typeof p.value === "number" && (p.unit === "mm" || p.unit === "°"));
  /* overall sizes : a design parameter that IS an overall size gives it its name */
  for (let i = 0; i < 3; i++) {
    const hit = params.find(([k, p]) => p.unit === "mm" && !taken.has(k) && Math.abs(p.value - ext[i]) < 0.005); if (hit) taken.add(hit[0]);
    add(`bbox:${AXIS[i]}`, { kind: "overall", axis: i, value: ext[i], text: f2(ext[i]), label: hit ? `${hit[1].label || hit[0]} — ${OVERALL[i].toLowerCase()}` : OVERALL[i], on: i === 1 ? "top" : "front", dir: i === 2 ? "v" : i === 1 ? "v" : "h", param: hit ? hit[0] : undefined });
  }
  /* bolt patterns : the basic dimensions that locate the group — spacing, then the first hole from the datum edges */
  const holes = (built.facts && built.facts.holes) || [];
  for (const it of built.interfaces || []) {
    if (it.type !== "bolt_pattern") continue;
    const V = VIEW_OF_FACE[it.face], mine = holes.filter((h) => h.iface === it.id); if (!V || !mine.length) continue;
    const [view, a, b] = V, us = uniq(mine.map((h) => h.at[a])), vs = uniq(mine.map((h) => h.at[b])), circle = it.params && it.params.pattern && it.params.pattern.type === "circle";
    if (circle) { add(`iface:${it.id}:pcd`, { kind: "iface", table: "def", value: it.params.pattern.pcd, text: `Ø ${f2(it.params.pattern.pcd)}`, basic: true, label: `${it.name} — bolt circle Ø, ${mine.length} equally spaced holes` }); }
    else {
      if (us.length > 1 && even(us)) add(`iface:${it.id}:du`, { kind: "pattern", on: view, dir: "h", p1: [us[0], vs.at(-1)], p2: [us[1], vs.at(-1)], value: us[1] - us[0], text: `${us.length > 2 ? `${us.length - 1}× ` : ""}${f2(us[1] - us[0])}`, basic: true, label: `${it.name} — pitch ${AXIS[a]}` });
      if (vs.length > 1 && even(vs)) add(`iface:${it.id}:dv`, { kind: "pattern", on: view, dir: "v", p1: [us.at(-1), vs[0]], p2: [us.at(-1), vs[1]], value: vs[1] - vs[0], text: `${vs.length > 2 ? `${vs.length - 1}× ` : ""}${f2(vs[1] - vs[0])}`, basic: true, label: `${it.name} — pitch ${AXIS[b]}` });
    }
    const u0 = circle && it.frame ? it.frame.o[a] : us[0], v0 = circle && it.frame ? it.frame.o[b] : vs[0], what = circle ? "centre" : "first hole";
    add(`iface:${it.id}:u`, { kind: "pattern", on: view, dir: "h", p1: [bb[a], v0], p2: [u0, v0], value: u0 - bb[a], text: f2(u0 - bb[a]), basic: true, label: `${it.name} — ${what} from edge ${AXIS[a]}` });
    add(`iface:${it.id}:v`, { kind: "pattern", on: view, dir: "v", p1: [u0, bb[b]], p2: [u0, v0], value: v0 - bb[b], text: f2(v0 - bb[b]), basic: true, label: `${it.name} — ${what} from edge ${AXIS[b]}` });
  }
  /* holes, by group : same face, same diameter, same making */
  const groups = new Map();
  for (const h of holeRows(built)) { const k = `${h.face}:${f2(h.d)}:${h.desc}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }
  for (const [k, l] of groups) add(`hole:${k}`, { kind: "hole", table: "holes", value: l[0].d, text: `${l.length > 1 ? `${l.length}× ` : ""}Ø ${f2(l[0].d)}`, label: `${l[0].desc || "hole"} — face ${l[0].face}`, tags: l.length > 1 ? `${l[0].tag}–${l.at(-1).tag}` : l[0].tag, face: l[0].face, holes: l });
  /* the other design parameters, then what each interface defines */
  const where = locateParams(spec, built);                                                    // a parameter that shows on a view is a detail dimension, drawn there
  for (const [k, p] of params) if (!taken.has(k)) { const w = where.get(k);
    add(`param:${k}`, w ? { kind: "detail", ...w, value: p.value, text: `${w.radius ? "R " : ""}${f2(p.value)}`, label: p.label || k, param: k } : { kind: "param", table: "def", value: p.value, text: `${f2(p.value)}${p.unit === "°" ? "°" : ""}`, label: p.label || k, param: k }); }
  for (const it of built.interfaces || []) {
    if (it.type === "bolt_pattern") continue;
    for (const [k, v] of Object.entries(it.params || {})) if (typeof v === "number" && k !== "n" && PARAM_FR[k]) add(`iface:${it.id}:${k}`, { kind: "iface", table: "def", value: v, text: `${k === "d" ? "Ø " : ""}${f2(v)}${k === "d" && it.params.fit ? ` ${it.params.fit}` : ""}`, label: `${it.name || it.id} — ${PARAM_FR[k]}` });
  }
  out.forEach((d, i) => { d.n = i + 1; });
  return out;
}
/** Every drilled hole with its tag (A1, A2… B1…), grouped by face. */
export function holeRows(built) {
  const rows = [], byFace = new Map();
  for (const h of (built.facts && built.facts.holes) || []) { const k = h.face || "?"; if (!byFace.has(k)) byFace.set(k, []); byFace.get(k).push(h); }
  let g = 0;
  for (const [face, list] of byFace) {
    const letter = String.fromCharCode(65 + g++), V = VIEW_OF_FACE[face];
    list.forEach((h, i) => {
      const desc = [h.thread ? `${h.thread} tapped` : null, h.fit === "insert" ? "heat-set insert" : null, h.fit && /^[A-Z]\d$/.test(h.fit) ? h.fit : null, h.through ? "through" : `depth ${f2(h.depth)}`,
        h.cbore ? `counterbore Ø${f2(h.cbore.d)} × ${f2(h.cbore.depth)}` : null, h.csink ? `countersink Ø${f2(h.csink.d)} × ${h.csink.angle || 90}°` : null].filter(Boolean).join(", ");
      rows.push({ tag: `${letter}${i + 1}`, face, x: V ? h.at[V[1]] : h.at[0], y: V ? h.at[V[2]] : h.at[1], d: h.d, desc, at: h.at, iface: h.iface });
    });
  }
  return rows;
}
/** The text of a dimension as the drawing writes it : a reference dimension is in brackets. */
export const dimText = (d) => (d.cls === "ref" ? `(${d.text})` : d.text);
/** Sets the class of a dimension on the part (normal removes the entry). */
export function setDimClass(spec, key, cls) {
  spec.characteristics = spec.characteristics || {};
  if (!DIM_CLASSES[cls] || cls === "normal") delete spec.characteristics[key]; else spec.characteristics[key] = cls;
  if (!Object.keys(spec.characteristics).length) delete spec.characteristics;
  return spec;
}
/** What the notes say about the classes in use. */
export function classNotes(dims) {
  const n = (c) => dims.filter((d) => d.cls === c).length, out = [];
  if (n("sc")) out.push(`Diamond “SC”: special characteristic (${n("sc")}) — to be monitored in production per the design FMEA.`);
  if (n("csc")) out.push(`Triangle “CSC”: critical special characteristic (${n("csc")}) — 100 % inspection or demonstrated capability.`);
  if (n("ref")) out.push("Dimensions in parentheses are reference dimensions: they are not to be inspected.");
  return out;
}
