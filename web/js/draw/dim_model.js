/* DesignWizard.ai — the dimension model of a drawing : every dimension the design defines, numbered once and for all the
   time the part does not change. A drawing shows them either on a view (overall sizes, the basic dimensions that locate a
   bolt pattern) or in a table (the other design parameters, the dimensions of the interfaces, the holes) : in both cases the
   dimension carries a round balloon with its number, and may be classed — normal, reference ( ), special characteristic
   (SC) or critical special characteristic (CSC). Classes live on the part : spec.characteristics = { key: "ref" | "sc" | "csc" }.
   Pure : no kernel, no DOM. */

import { patternPoints } from "../cad/interfaces.js";

export const DIM_CLASSES = {
  normal: { fr: "Normale", short: "" },
  ref: { fr: "Référence ( )", short: "REF" },
  sc: { fr: "SC — caractéristique spéciale", short: "SC" },
  csc: { fr: "CSC — caractéristique spéciale critique", short: "CSC" },
};
/** The view that looks at a face, and the two world axes it shows. */
export const VIEW_OF_FACE = { "+Z": ["top", 0, 1], "-Z": ["top", 0, 1], "+Y": ["front", 0, 2], "-Y": ["front", 0, 2], "+X": ["right", 1, 2], "-X": ["right", 1, 2] };
const AXIS = ["X", "Y", "Z"], OVERALL = ["Longueur hors tout", "Largeur hors tout", "Hauteur hors tout"];
const PARAM_FR = { w: "largeur", h: "hauteur", d: "diamètre", length: "longueur", depth: "profondeur", t: "épaisseur", r: "rayon", gap: "film", pitch: "entraxe", pcd: "Ø de perçage" };
export const f2 = (v) => (Math.round(v * 100) / 100).toString().replace(".", ",");
const uniq = (list) => [...new Set(list.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
const even = (u) => u.length < 3 || u.slice(2).every((x, i) => Math.abs((x - u[i + 1]) - (u[1] - u[0])) < 0.01);

/** Every dimension of a part. → [{ n, key, kind, label, value, text, cls, on (view) + dir + p1 + p2 for a dimension drawn on a view,
    table ("def" | "holes") for a tabulated one, basic (boxed : located by a position tolerance) }] */
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
    if (circle) { add(`iface:${it.id}:pcd`, { kind: "iface", table: "def", value: it.params.pattern.pcd, text: `Ø ${f2(it.params.pattern.pcd)}`, basic: true, label: `${it.name} — Ø de perçage, ${mine.length} trous équidistants` }); }
    else {
      if (us.length > 1 && even(us)) add(`iface:${it.id}:du`, { kind: "pattern", on: view, dir: "h", p1: [us[0], vs.at(-1)], p2: [us[1], vs.at(-1)], value: us[1] - us[0], text: `${us.length > 2 ? `${us.length - 1}× ` : ""}${f2(us[1] - us[0])}`, basic: true, label: `${it.name} — entraxe ${AXIS[a]}` });
      if (vs.length > 1 && even(vs)) add(`iface:${it.id}:dv`, { kind: "pattern", on: view, dir: "v", p1: [us.at(-1), vs[0]], p2: [us.at(-1), vs[1]], value: vs[1] - vs[0], text: `${vs.length > 2 ? `${vs.length - 1}× ` : ""}${f2(vs[1] - vs[0])}`, basic: true, label: `${it.name} — entraxe ${AXIS[b]}` });
    }
    const u0 = circle && it.frame ? it.frame.o[a] : us[0], v0 = circle && it.frame ? it.frame.o[b] : vs[0], what = circle ? "centre" : "premier trou";
    add(`iface:${it.id}:u`, { kind: "pattern", on: view, dir: "h", p1: [bb[a], v0], p2: [u0, v0], value: u0 - bb[a], text: f2(u0 - bb[a]), basic: true, label: `${it.name} — ${what} depuis le bord ${AXIS[a]}` });
    add(`iface:${it.id}:v`, { kind: "pattern", on: view, dir: "v", p1: [u0, bb[b]], p2: [u0, v0], value: v0 - bb[b], text: f2(v0 - bb[b]), basic: true, label: `${it.name} — ${what} depuis le bord ${AXIS[b]}` });
  }
  /* holes, by group : same face, same diameter, same making */
  const groups = new Map();
  for (const h of holeRows(built)) { const k = `${h.face}:${f2(h.d)}:${h.desc}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }
  for (const [k, l] of groups) add(`hole:${k}`, { kind: "hole", table: "holes", value: l[0].d, text: `${l.length > 1 ? `${l.length}× ` : ""}Ø ${f2(l[0].d)}`, label: `${l[0].desc || "trou"} — face ${l[0].face}`, tags: l.length > 1 ? `${l[0].tag}–${l.at(-1).tag}` : l[0].tag, face: l[0].face, holes: l });
  /* the other design parameters, then what each interface defines */
  for (const [k, p] of params) if (!taken.has(k)) add(`param:${k}`, { kind: "param", table: "def", value: p.value, text: `${f2(p.value)}${p.unit === "°" ? "°" : ""}`, label: p.label || k, param: k });
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
      const desc = [h.thread ? `${h.thread} taraudé` : null, h.fit === "insert" ? "insert à chaud" : null, h.fit && /^[A-Z]\d$/.test(h.fit) ? h.fit : null, h.through ? "débouchant" : `prof. ${f2(h.depth)}`,
        h.cbore ? `lamage Ø${f2(h.cbore.d)} × ${f2(h.cbore.depth)}` : null, h.csink ? `fraisure Ø${f2(h.csink.d)} × ${h.csink.angle || 90}°` : null].filter(Boolean).join(", ");
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
  if (n("sc")) out.push(`Losange « SC » : caractéristique spéciale (${n("sc")}) — à suivre en fabrication selon l'AMDEC de conception.`);
  if (n("csc")) out.push(`Triangle « CSC » : caractéristique spéciale critique (${n("csc")}) — contrôle à 100 % ou capabilité démontrée.`);
  if (n("ref")) out.push("Les cotes entre parenthèses sont des cotes de référence : elles ne sont pas à contrôler.");
  return out;
}
