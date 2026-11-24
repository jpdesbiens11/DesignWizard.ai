/* DynamiteOrbit.ai — exchange with DynamiteAgile, in its own file format. The functional analysis of a design leaves
   as a Project Starter file (format "dynamite-project-starter", version 1) : the functional tree, the functional
   structure (inputs, outputs, flows) and the parts on the functions — the "diamond" object that the « Commencer »
   screen of DynamiteAgile reads into Diamond. And the way back : the tree of such a file becomes the functions of a
   board, as drafts, without deleting anything.
   The rules checked here are those of that format, read in the repository of DynamiteAgile (core/starter_diamond.py) :
   the first function without a parent is the primary one (type usage) ; three levels, a « technique » function alone
   at the fourth ; a general flow links secondary functions and ports, from an input or a function to a function or an
   output ; parts sit on secondary or tertiary functions. */

import { functionalStructure } from "../pcba/structure.js";
import { addFunction } from "../pcba/synth.js";
import { LIBRARY } from "../pcba/library.js";

export const STARTER_FORMAT = "dynamite-project-starter";
export const STARTER_VERSION = 1;
const LIMITS = { functions: 120, ports: 40, flows: 200, parts: 80 };
const TYPES = ["usage", "estime", "technique", "contrainte"], KANO = ["", "B", "P", "I", "C"], IMPORTANCE = ["", "indispensable", "importante", "interessante"], KINDS = ["energy", "material", "information"], PART_KINDS = ["designed", "bought", "standard"];
const one = (s, n) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v) => (Array.isArray(v) ? v : []);

/** A Space key of DynamiteAgile from a name : 2 to 10 capitals or digits, a letter first. */
export function starterKey(name) {
  const k = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^[0-9]+/, "").slice(0, 10);
  return k.length >= 2 ? k : `${k}DW`.slice(0, 10);
}

/** The project as a Project Starter file. → { file, notes: [what was left out or shortened] } */
export function toProjectStarter(project, o = {}) {
  const functions = [], ports = [], flows = [], parts = [], notes = [], boards = list(project.boards), many = boards.length > 1;
  const first = one(String(project.description || "").split(/(?<=[.!?])\s/)[0], 160);
  functions.push({ ref: "F0", text: first || one(`Remplir la fonction du produit ${project.name || ""}`, 160), type: "usage", parent: null, notes: one(`Fonction primaire du produit « ${project.name || ""} », exportée de DynamiteOrbit.ai : à reformuler par l'équipe (un verbe et un complément).`, 1500) });
  const top = new Map();                                        // board function id → ref of its secondary ancestor, per board
  boards.forEach((b, n) => {
    const pre = many ? `C${n + 1}-` : "", ref = (id) => one(`${pre}${id}`, 24), fns = list(b.functions), byId = new Map(fns.map((f) => [f.id, f])), depth = (f) => (f.parent && byId.has(f.parent) ? depth(byId.get(f.parent)) + 1 : 2);
    const note = (f) => one([...(list(f.criteria).map((c) => `${c.name} : ${c.level}${c.flex ? ` (${c.flex})` : ""}`)), f.block ? `Bloc ${f.block}` : "", f.note || "", f.ai && f.ai.draft ? "Brouillon IA : à relire par l'équipe." : ""].filter(Boolean).join(" · "), 1500);
    const walk = (f) => { const d = depth(f); if (d > 4) { notes.push(`${b.id} ${f.id} : au-delà du quatrième niveau, laissée de côté`); return; }
      functions.push({ ref: ref(f.id), text: one(f.name, 160) || ref(f.id), type: d === 4 || f.kind === "technique" ? "technique" : f.kind === "contrainte" ? "contrainte" : "usage", parent: d === 2 ? "F0" : ref(f.parent), ...(f.kind === "contrainte" ? { kano: "C" } : {}), ...(note(f) ? { notes: note(f) } : {}) });
      let a = f; while (a.parent && byId.has(a.parent)) a = byId.get(a.parent); top.set(`${b.id}|${f.id}`, ref(a.id));
      for (const k of fns.filter((x) => x.parent === f.id)) walk(k); };
    for (const f of fns.filter((x) => !x.parent || !byId.has(x.parent))) walk(f);
    /* the functional structure : connectors at the edge become ports, block-to-block flows become flows between secondary functions */
    let S = null; try { S = (o.structure || ((x) => functionalStructure(x, LIBRARY)))(b); } catch (e) { notes.push(`${b.id} : structure fonctionnelle non calculée (${e.message})`); }
    if (!S) return;
    const fnOf = new Map(list(b.blocks).map((x) => [x.id, top.get(`${b.id}|${x.function}`)])), port = new Map(), secondary = new Set(functions.filter((f) => f.parent === "F0").map((f) => f.ref));
    for (const x of S.blocks.filter((k) => k.external && k.side)) { const mine = S.flows.filter((f) => f.from === x.id || f.to === x.id), info = mine.filter((f) => f.kind === "information").length * 2 > mine.length;
      const p = { ref: one(`${pre}${x.side === "in" ? "E" : "S"}${port.size + 1}`, 24), side: x.side, label: one(x.name, 80) || x.id, kind: info ? "information" : "energy" }; port.set(x.id, p); ports.push(p); }
    const seen = new Set();
    for (const f of S.flows) {
      const src = port.has(f.from) ? port.get(f.from) : null, dst = port.has(f.to) ? port.get(f.to) : null, a = src ? src.ref : fnOf.get(f.from), z = dst ? dst.ref : fnOf.get(f.to), kind = f.kind === "information" ? "information" : "energy";
      if (!a || !z || a === z || (src && dst) || (src && src.side !== "in") || (dst && dst.side !== "out") || (!src && !secondary.has(a)) || (!dst && !secondary.has(z)) || seen.has(`${a}|${z}|${kind}`)) continue;
      seen.add(`${a}|${z}|${kind}`); flows.push({ view: "general", kind, label: one(list(f.nets).join(" "), 60), src: a, dst: z });
    }
  });
  /* the mechanical parts : each one carries its function, as a secondary function of the product ; the board part sits on the functions of its board */
  let m = 0;
  for (const p of list(project.parts)) {
    const board = boards.find((b) => b.part === p.id), kind = p.family === "purchased" || p.process === "purchased" ? "bought" : "designed", on = [];
    if (board) on.push(...functions.filter((f) => f.parent === "F0" && boards.length && (many ? f.ref.startsWith(`C${boards.indexOf(board) + 1}-`) : !/^M\d+$/.test(f.ref))).map((f) => f.ref));
    else if (one(p.function, 160)) { const ref = `M${++m}`; functions.push({ ref, text: one(p.function, 160), type: "usage", parent: "F0", notes: one(`Fonction de la pièce ${p.id}${p.name ? ` « ${p.name} »` : ""}.`, 1500) }); on.push(ref); }
    parts.push({ ref: one(p.id, 24), name: one(`${p.id} — ${p.name || ""}`.replace(/ — $/, ""), 80), kind, notes: one([p.process, p.material, p.revision ? `rév. ${p.revision}` : ""].filter(Boolean).join(" · "), 1000), functions: on });
  }
  for (const [k, arr] of [["functions", functions], ["ports", ports], ["flows", flows], ["parts", parts]]) if (arr.length > LIMITS[k]) { notes.push(`${k} : ${arr.length} éléments, ${LIMITS[k]} gardés (limite du format)`); arr.length = LIMITS[k]; }
  const kept = new Set(functions.map((f) => f.ref)), ends = new Set([...kept, ...ports.map((p) => p.ref)]);
  const file = { format: STARTER_FORMAT, format_version: STARTER_VERSION, language: "fr", generated_by: "DynamiteOrbit.ai", generated_at: (o.date || new Date()).toISOString().slice(0, 10),
    project: { key: starterKey(o.key || project.name), name: one(project.name, 120) || "Produit", description: one(project.description, 4000) },
    diamond: { functions: functions.filter((f) => f.parent === null || kept.has(f.parent)), ports, flows: flows.filter((f) => ends.has(f.src) && ends.has(f.dst)), parts: parts.map((p) => ({ ...p, functions: p.functions.filter((r) => kept.has(r)) })) } };
  return { file, notes };
}

/** The faults of a Project Starter file, by the rules of its "diamond" object. → [text] (empty : the file holds). */
export function checkStarter(file) {
  const out = [], bad = (path, t) => out.push(`${path} : ${t}`);
  if (!file || typeof file !== "object") return ["fichier : objet JSON attendu"];
  if (file.format !== STARTER_FORMAT) bad("format", `« ${file.format} » — attendu « ${STARTER_FORMAT} »`);
  if (!Number.isInteger(file.format_version) || file.format_version < 1 || file.format_version > STARTER_VERSION) bad("format_version", `version ${file.format_version} non prise en charge`);
  const p = file.project || {}; if (!/^[A-Z][A-Z0-9]{1,9}$/.test(String(p.key || ""))) bad("project.key", `clé « ${p.key} » invalide (2 à 10 majuscules ou chiffres, une lettre d'abord)`); if (!one(p.name, 999)) bad("project.name", "champ obligatoire vide");
  const d = file.diamond || {}, level = new Map(), refs = new Set(); let primary = null;
  for (const k of Object.keys(LIMITS)) if (list(d[k]).length > LIMITS[k]) bad(`diamond.${k}`, `${d[k].length} éléments (au plus ${LIMITS[k]})`);
  list(d.functions).forEach((f, i) => { const path = `diamond.functions[${i}]`, type = f.type || "usage", parent = f.parent || null;
    if (!one(f.ref, 99) || one(f.ref, 99).length > 24 || refs.has(f.ref)) bad(`${path}.ref`, `« ${f.ref} » vide, trop longue ou déjà utilisée`); refs.add(f.ref);
    if (!one(f.text, 999) || one(f.text, 999).length > 160) bad(`${path}.text`, "vide ou de plus de 160 caractères"); if (/<.*>/.test(String(f.text))) bad(`${path}.text`, "balise HTML");
    if (!TYPES.includes(type)) bad(`${path}.type`, `« ${type} » inconnu`); if (!KANO.includes(f.kano || "")) bad(`${path}.kano`, `« ${f.kano} » inconnu`); if (!IMPORTANCE.includes(f.importance || "")) bad(`${path}.importance`, `« ${f.importance} » inconnue`);
    if (parent && !level.has(parent)) { bad(`${path}.parent`, `fonction « ${parent} » introuvable plus haut`); return; }
    if (!parent && primary === null) { if (type !== "usage") bad(path, "la première fonction sans parent est la fonction primaire, de type usage"); primary = f.ref; }
    const depth = parent ? level.get(parent).depth + 1 : 1, tree = f.ref === primary || (!!parent && level.get(parent).tree);
    if (depth > 4 || (depth === 4 && type !== "technique")) bad(`${path}.parent`, `niveau ${depth} : trois niveaux, une fonction technique seule au quatrième`);
    level.set(f.ref, { depth, tree, type, parent }); });
  if (list(d.functions).length && primary === null) bad("diamond.functions", "aucune fonction primaire");
  if (!list(d.functions).length && ["ports", "flows", "parts"].some((k) => list(d[k]).length)) bad("diamond.functions", "structure ou pièces sans arbre fonctionnel");
  const inTree = [...level].filter(([, v]) => v.tree), second = new Set(inTree.filter(([, v]) => v.depth === 2).map(([r]) => r)), third = inTree.filter(([, v]) => v.depth === 3 && v.type !== "technique"), withKids = new Set(third.map(([, v]) => v.parent));
  const views = { general: second, detail: new Set([...third.map(([r]) => r), ...[...second].filter((r) => !withKids.has(r))]) }, side = new Map();
  list(d.ports).forEach((x, i) => { const path = `diamond.ports[${i}]`; if (!one(x.ref, 99) || refs.has(x.ref)) bad(`${path}.ref`, `« ${x.ref} » vide ou déjà utilisée`); refs.add(x.ref);
    if (!["in", "out"].includes(x.side)) bad(`${path}.side`, `« ${x.side} » inconnu`); if (!one(x.label, 999) || one(x.label, 999).length > 80) bad(`${path}.label`, "vide ou de plus de 80 caractères"); if (!KINDS.includes(x.kind || "energy")) bad(`${path}.kind`, `« ${x.kind} » inconnu`); side.set(x.ref, x.side); });
  list(d.flows).forEach((f, i) => { const path = `diamond.flows[${i}]`, view = f.view || "general";
    if (!views[view]) { bad(`${path}.view`, `« ${view} » inconnue`); return; } if (!KINDS.includes(f.kind || "energy")) bad(`${path}.kind`, `« ${f.kind} » inconnu`); if (one(f.label, 999).length > 60) bad(`${path}.label`, "plus de 60 caractères");
    for (const end of ["src", "dst"]) { const r = f[end]; if (side.has(r)) { if ((end === "src") !== (side.get(r) === "in")) bad(`${path}.${end}`, `« ${r} » est une ${side.get(r) === "in" ? "entrée" : "sortie"}`); } else if (!views[view].has(r)) bad(`${path}.${end}`, `« ${r} » n'est pas une fonction de la vue ${view}`); }
    if (f.src === f.dst) bad(path, "flux d'un élément vers lui-même"); if (side.has(f.src) && side.has(f.dst)) bad(path, "flux d'une entrée directement vers une sortie"); });
  const taggable = new Set([...views.general, ...views.detail]);
  list(d.parts).forEach((x, i) => { const path = `diamond.parts[${i}]`; if (!one(x.name, 999) || one(x.name, 999).length > 80) bad(`${path}.name`, "vide ou de plus de 80 caractères"); if (!PART_KINDS.includes(x.kind || "designed")) bad(`${path}.kind`, `« ${x.kind} » inconnu`);
    if (!Array.isArray(x.functions || []) || list(x.functions).some((r) => !taggable.has(r))) bad(`${path}.functions`, "fonction hors de la structure (secondaires ou tertiaires de l'arbre)"); });
  return out;
}

/** The functional tree of a Project Starter file read into a board. Nothing is deleted : a function already there
    (same name under the same parent) is left alone, the others arrive as drafts. dry = true only counts.
    → { added, same, primary, problems } */
export function importDiamond(board, file, dry = false) {
  const problems = checkStarter(file).filter((t) => /^(format|diamond\.functions)/.test(t)); if (problems.length) return { added: 0, same: 0, primary: "", problems };
  const fns = list(file.diamond && file.diamond.functions), made = new Map(), norm = (s) => one(s, 999).toLowerCase(), have = new Map(list(board.functions).map((x) => [`${x.parent || ""}|${norm(x.name)}`, x.id])); let added = 0, same = 0, primary = "", seenPrimary = false;
  for (const f of fns) {
    if (!f.parent && !seenPrimary) { seenPrimary = true; primary = one(f.text, 160); made.set(f.ref, null); continue; }                        // the primary function is the product itself, not a function of the board
    const parent = f.parent ? made.get(f.parent) ?? null : null, name = one(f.text, 160), sign = `${parent || ""}|${norm(name)}`;
    if (have.has(sign)) { same++; made.set(f.ref, have.get(sign)); continue; }                 // already there, or twice in the file
    added++; if (dry) { made.set(f.ref, `~${f.ref}`); have.set(sign, `~${f.ref}`); continue; }
    const id = addFunction(board, { parent, name, kind: f.type === "contrainte" ? "contrainte" : f.type === "technique" ? "technique" : "principale", criteria: [], note: one([f.notes, f.type === "estime" ? "Fonction d'estime." : "", f.critical ? "Critique." : ""].filter(Boolean).join(" "), 1500) || undefined });
    const fn = board.functions.find((x) => x.id === id); fn.ai = { draft: true }; made.set(f.ref, id); have.set(sign, id);
  }
  if (!dry && primary && !board.description) board.description = primary;
  return { added, same, primary, problems: [] };
}
