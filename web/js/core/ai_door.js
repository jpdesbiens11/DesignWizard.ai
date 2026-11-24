/* DynamiteOrbit.ai — the door « Avec l'IA » of the Shop (demandes de JP : « propose seulement le bouton IA avec une proposition
   de prompt qui doit être envoyé à Claude… réinjecter l'information… quels artéfacts vont être créés en apportant le résultat du
   prompt, qui peut être un .zip ou n'importe quelle forme de fichier » ; « pouvoir revenir en arrière si l'IA n'a pas bien compris »).
   The tool calls no AI : it WRITES the instruction, the person carries it to an assistant, and brings the answer back as a file
   or a pasted text. This file is everything that is not the page :
     - the instruction proposed, for one part, several, or a whole assembly ;
     - the reading of an answer, whatever its shape (.dwiz, JSON, several files of a .zip) ;
     - the PLAN : what would be created, what would be changed, what is set aside and why, and WHERE each thing goes in the
       structure of the product — shown before anything is applied ;
     - the application, as one step, and the journal that allows going back to before.
   An answer can CREATE and MODIFY (choix de JP). Pure : no page, no store. */

import { findDwiz, fromDwiz } from "./dwiz.js";
import { anticipatedInterfaces } from "./prompts.js";
import { aiDiff } from "./ai_loop.js";
import { natureOf } from "./shop_levels.js";
import { validateSpec } from "../cad/build.js";
import { LANGUAGE_REFERENCE } from "../cad/language_doc.js";
import { BLOCKS } from "../pcba/blocks.js";
import { moreKey, moreCheck, moreApply } from "./ai_more.js";

/** What one may ask for. */
export const SCOPES = [
  { key: "part", label: "Une pièce", say: "UNE pièce" },
  { key: "parts", label: "Plusieurs pièces", say: "PLUSIEURS pièces qui vont ensemble" },
  { key: "assembly", label: "Un assemblage complet", say: "un ASSEMBLAGE complet : ses pièces, et l'assemblage qui les réunit" },
];
const scopeOf = (k) => SCOPES.find((s) => s.key === k) || SCOPES[0];
const j = (o) => JSON.stringify(o, null, 1);

/** The instruction to carry to an assistant. o : { ask (one sentence, the person's words), scope, context (give the parts of the project and their
    free interfaces), questions (the assistant asks before it answers) } → text */
export function doorPrompt(project, o = {}) {
  const S = scopeOf(o.scope), P = project || {}, parts = P.parts || [], L = [];
  L.push(`Tu es un concepteur mécanique senior. Tu vas m'aider à définir ${S.say} d'un produit mécatronique pour la plateforme DynamiteOrbit.ai, qui construira chaque pièce en 3D directement à partir de ta réponse. On commence toujours par les INTERFACES : ce qu'une pièce relie la définit.`);
  L.push("", `CE QUE JE VEUX : ${String(o.ask || "").trim() || "(à dire en une phrase)"}`, "", `PROJET : ${P.name || "sans nom"}${P.description ? ` — ${P.description}` : ""}`);
  if (o.context !== false && parts.length) {
    L.push("", "PIÈCES DÉJÀ DANS LE PROJET :", ...parts.slice(0, 60).map((p) => `- ${p.id} — ${p.name || ""}${p.function ? ` : ${p.function}` : ""}`));
    const ant = anticipatedInterfaces(P, parts.map((p) => p.id));
    if (ant.length) L.push("", "INTERFACES LIBRES de ces pièces — une nouvelle pièce qui s'y raccorde DOIT porter la même (même \"type\", même \"key\", mêmes \"params\", le \"side\" indiqué) :", "```json", j(ant.slice(0, 40).map((a) => ({ from: `${a.from.part}/${a.from.iface}`, ...a.iface }))), "```");
  }
  L.push("", "MÉTHODE :");
  if (o.questions !== false) L.push("- AVANT de produire quoi que ce soit, pose-moi tes questions UNE À UNE — le rôle de chaque pièce, ce qu'elle relie, ses efforts, son milieu, sa matière, son procédé — jusqu'à ce que l'intention soit claire. Propose une réponse à chaque question : je confirme ou je corrige.");
  L.push("- Ne donne jamais pour sûre une valeur que tu supposes : écris-la dans les \"notes\" de la pièce, avec « à confirmer ».",
    "- Pour MODIFIER une pièce du projet, renvoie-la ENTIÈRE avec le même \"id\" ; ne renvoie pas ce que tu ne changes pas.",
    "- Une pièce NOUVELLE porte un \"id\" nouveau, différent de ceux du projet.",
    "- Deux pièces qui se raccordent portent la MÊME interface (même \"type\", même \"key\", mêmes \"params\"), l'une côté A, l'autre côté B : la plateforme les accouple seule.");
  L.push("", "RÉPONSE ATTENDUE — à la fin de l'entrevue, UN SEUL objet JSON dans un bloc de code, puis la liste courte de ce qui reste à vérifier par un humain :", "```json",
    S.key === "assembly" ? `{ "parts": [ { …pièce complète… }, … ],\n  "assemblies": [ { "dw": "assembly/1", "id": "ASM-…", "name": "…", "instances": [ { "id": "i1", "part": "<id d'une pièce>", "fixed": true }, { "id": "i2", "part": "…" } ] } ] }`
      : S.key === "parts" ? `{ "parts": [ { …pièce complète… }, { …pièce complète… } ] }` : `{ "parts": [ { …pièce complète… } ] }`, "```",
    "", "Si je t'ai aussi confié une carte électronique (« dw »: \"board/1\") ou la feuille d'un dessin (« dw »: \"drawing/1\"), renvoie-la ENTIÈRE, avec son \"id\", dans \"boards\" ou \"drawings\" du même objet : la plateforme les relit comme les pièces.",
    "", "LANGAGE D'UNE PIÈCE (à respecter à la lettre) :", "", LANGUAGE_REFERENCE);
  return L.join("\n");
}

const isAsm = (o) => String(o.dw || "").startsWith("assembly/") || (Array.isArray(o.instances) && !o.features);
const isBoard = (o) => String(o.dw || "").startsWith("board/") || (Array.isArray(o.blocks) && Array.isArray(o.nets) && !!o.board);      // a PCBA (pcba/model.js)
const isSheet = (o) => String(o.dw || "") === "drawing/1";      // the sheet of a drawing (core/ai_more.js)
const isPart = (o) => String(o.dw || "").startsWith("part/") || !!(o.features || o.stock || o.extrusion || o.pcb || o.busbar || o.flex || o.folded || o.process);
function parseText(text) {
  const t = String(text || ""), dw = findDwiz(t);
  if (dw && !/^\s*[[{]/.test(t)) { const d = fromDwiz(dw); return Array.isArray(d) ? d : [d]; }
  const fenced = [...t.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((m) => m[1]).sort((a, b) => b.length - a.length);
  for (const raw of [...fenced, t]) { try { const v = JSON.parse(raw.trim()); if (v && typeof v === "object") return [v]; } catch { /* the next candidate */ } }
  throw new Error("ni .dwiz ni JSON : la réponse doit contenir l'objet complet, dans un bloc de code");
}
/** What an answer holds. texts : [{ name, text }] (a pasted text, or the files of a folder). → { docs: [{ kind: "part" | "assembly" | "board" | "drawing", doc, from }], errors: [{ from, message }] } */
export function readAnswer(texts) {
  const docs = [], errors = [];
  const take = (o, from) => {
    if (Array.isArray(o)) { for (const x of o) take(x, from); return; }
    if (!o || typeof o !== "object") return;
    if (isSheet(o)) { docs.push({ kind: "drawing", doc: o, from }); return; }
    if (isBoard(o)) { docs.push({ kind: "board", doc: o, from }); return; }      // before the lists : a board has « parts » of its own — its components
    if (Array.isArray(o.parts) || Array.isArray(o.assemblies) || Array.isArray(o.boards) || Array.isArray(o.drawings)) { for (const k of ["parts", "assemblies", "boards", "drawings"]) for (const x of o[k] || []) take(x, from); return; }
    if (isAsm(o)) docs.push({ kind: "assembly", doc: o, from }); else if (isPart(o)) docs.push({ kind: "part", doc: o, from });
    else errors.push({ from, message: `« ${o.id || o.name || "objet"} » : ni une pièce, ni un assemblage, ni une carte, ni une feuille de dessin` });
  };
  for (const f of texts || []) { if (!f || !String(f.text || "").trim()) continue; try { take(parseText(f.text), f.name || "réponse"); } catch (e) { errors.push({ from: f.name || "réponse", message: e.message }); } }
  return { docs, errors };
}

const cleanId = (s) => String(s || "").replace(/[^A-Za-z0-9_\-]/g, "-").slice(0, 40);
/** The plan of an answer : what each document would do, and where it goes. Nothing is changed.
    → [{ kind, id, name, action: "create" | "modify" | "same" | "skip", where, detail, why (when set aside), changes (how many, when modified), doc }] */
export function planAnswer(project, docs) {
  const P = project || {}, have = new Set((P.parts || []).map((p) => p.id)), coming = new Set(), rows = [];
  let n = (P.parts || []).length;
  const fresh = () => { let id; do { id = `P-${String(++n).padStart(3, "0")}`; } while (have.has(id) || coming.has(id)); return id; };
  for (const d of (docs || []).filter((x) => x.kind === "part")) {
    const v = validateSpec(d.doc), doc = { ...d.doc, dw: "part/1", id: cleanId(d.doc.id) || fresh() }, nat = natureOf(doc), name = doc.name || doc.id, where = `Atelier ▸ ${nat.label}`;
    if (v.errors.length) { rows.push({ kind: "part", id: doc.id, name, action: "skip", where: "écartée", detail: "", why: v.errors.join(" "), doc: null, nature: nat }); continue; }
    if (coming.has(doc.id)) { rows.push({ kind: "part", id: doc.id, name, action: "skip", where: "écartée", detail: "", why: `le numéro ${doc.id} est donné deux fois dans la réponse`, doc: null, nature: nat }); continue; }
    coming.add(doc.id);
    const old = (P.parts || []).find((p) => p.id === doc.id), nI = (doc.interfaces || []).length, detail = `${nI} interface${nI > 1 ? "s" : ""}${doc.material ? ` · ${doc.material}` : ""}${v.warnings.length ? ` · ${v.warnings.length} point${v.warnings.length > 1 ? "s" : ""} à vérifier` : ""}`;
    if (!old) { rows.push({ kind: "part", id: doc.id, name, action: "create", where, detail: `Pièce nouvelle · ${detail}`, doc, nature: nat, warnings: v.warnings }); continue; }
    const diff = aiDiff(old, doc).length;
    rows.push({ kind: "part", id: doc.id, name, action: diff ? "modify" : "same", where, detail: diff ? `Modifiée : ${diff} changement${diff > 1 ? "s" : ""} · ${detail}` : "Identique à la pièce du projet", changes: diff, doc: diff ? doc : null, nature: nat, warnings: v.warnings });
  }
  const known = (id) => have.has(id) || coming.has(id), asmIds = new Set((P.assemblies || []).map((a) => a.id));
  for (const d of (docs || []).filter((x) => x.kind === "assembly")) {
    const doc = { mates: [], ...d.doc, dw: "assembly/1", id: cleanId(d.doc.id) || `ASM-${String(asmIds.size + 1).padStart(3, "0")}` }, name = doc.name || doc.id, inst = doc.instances || [];
    const lost = [...new Set(inst.filter((i) => i && !i.asm && !known(i.part)).map((i) => i.part || "?"))], set = rows.filter((r) => r.action === "skip" && inst.some((i) => i.part === r.id)).map((r) => r.id);
    if (!inst.length || lost.length) { rows.push({ kind: "assembly", id: doc.id, name, action: "skip", where: "écarté", detail: "", why: !inst.length ? "aucune pièce dedans" : `nomme ${lost.length > 1 ? "des pièces absentes" : "une pièce absente"} : ${lost.join(", ")}${set.length ? " (écartée plus haut)" : ""}`, doc: null }); continue; }
    const old = (P.assemblies || []).find((a) => a.id === doc.id), detail = `${inst.length} pièce${inst.length > 1 ? "s" : ""}${(doc.mates || []).length ? ` · ${doc.mates.length} accouplement${doc.mates.length > 1 ? "s" : ""}` : " · accouplée par ses interfaces à l'ouverture"}`;
    if (!old) { rows.push({ kind: "assembly", id: doc.id, name, action: "create", where: "Mécanique ▸ Assemblage", detail: `Assemblage nouveau · ${detail}`, doc: (doc.mates || []).length ? doc : { ...doc, pendingAutoMate: true } }); continue; }
    const diff = aiDiff(old, doc).length;
    rows.push({ kind: "assembly", id: doc.id, name, action: diff ? "modify" : "same", where: "Mécanique ▸ Assemblage", detail: diff ? `Modifié : ${diff} changement${diff > 1 ? "s" : ""} · ${detail}` : "Identique à l'assemblage du projet", changes: diff, doc: diff ? doc : null });
  }
  /* boards : a PCBA whole, by its id — its blocks must be templates of the library */
  const boardIds = new Set();
  for (const d of (docs || []).filter((x) => x.kind === "board")) {
    const doc = { functions: [], blocks: [], parts: [], nets: [], tracks: [], vias: [], planes: [], ...d.doc, dw: String(d.doc.dw || "").startsWith("board/") ? d.doc.dw : "board/1", id: cleanId(d.doc.id) || `PCBA-${String((P.boards || []).length + boardIds.size + 1).padStart(3, "0")}` }, name = doc.name || doc.id;
    const unknown = [...new Set((doc.blocks || []).map((b) => b && b.template).filter((t) => !BLOCKS[t]))];
    if (boardIds.has(doc.id)) { rows.push({ kind: "board", id: doc.id, name, action: "skip", where: "écartée", detail: "", why: `la carte ${doc.id} est donnée deux fois dans la réponse`, doc: null }); continue; }
    if (unknown.length || !doc.board || typeof doc.board !== "object") { rows.push({ kind: "board", id: doc.id, name, action: "skip", where: "écartée", detail: "", why: unknown.length ? `bloc${unknown.length > 1 ? "s" : ""} inconnu${unknown.length > 1 ? "s" : ""} de la bibliothèque : ${unknown.join(", ")}` : "pas de contour de carte (« board »)", doc: null }); continue; }
    boardIds.add(doc.id);
    const old = (P.boards || []).find((b) => b.id === doc.id), detail = `${doc.blocks.length} bloc${doc.blocks.length > 1 ? "s" : ""} · ${doc.parts.length} composant${doc.parts.length > 1 ? "s" : ""} · ${doc.nets.length} net${doc.nets.length > 1 ? "s" : ""}`;
    if (!old) { rows.push({ kind: "board", id: doc.id, name, action: "create", where: "Électronique ▸ PCBA", detail: `Carte nouvelle · ${detail}`, doc }); continue; }
    const diff = aiDiff(old, doc).length;
    rows.push({ kind: "board", id: doc.id, name, action: diff ? "modify" : "same", where: "Électronique ▸ PCBA", detail: diff ? `Modifiée : ${diff} changement${diff > 1 ? "s" : ""} · ${detail}` : "Identique à la carte du projet", changes: diff, doc: diff ? doc : null });
  }
  /* drawing sheets : the sheet of a part or an assembly — of the project, or created by this same answer — checked as the common loop checks it */
  const ahead = { ...P, parts: [...(P.parts || []), ...rows.filter((r) => r.kind === "part" && r.action === "create").map((r) => r.doc)], assemblies: [...(P.assemblies || []), ...rows.filter((r) => r.kind === "assembly" && r.action === "create").map((r) => r.doc)] };
  for (const d of (docs || []).filter((x) => x.kind === "drawing")) {
    const of = d.doc.of === "assembly" ? "assembly" : "part", key = `drawing:${of}:${d.doc.id}`, k = moreKey(key, ahead), id = `${d.doc.id} · feuille`, name = `Feuille de dessin de ${d.doc.title || d.doc.id}`;
    if (!k) { rows.push({ kind: "drawing", id, name, action: "skip", where: "écartée", detail: "", why: `ni le projet ni la réponse n'ont ${of === "part" ? "la pièce" : "l'assemblage"} ${d.doc.id}`, doc: null }); continue; }
    const blocks = moreCheck(ahead, key, d.doc).filter((n) => n.severity === "block");
    if (blocks.length) { rows.push({ kind: "drawing", id, name, action: "skip", where: "écartée", detail: "", why: blocks.map((b) => b.text).join(" "), doc: null }); continue; }
    rows.push({ kind: "drawing", id, name, of, target: d.doc.id, action: "modify", where: "Mécanique ▸ Dessins", detail: "Cartouche du projet, notes, coupe, classes de cotes, vues de détail de ce dessin", doc: d.doc });
  }
  return rows;
}
/** How a plan reads in one line : « 3 créations, 1 modification, 1 écart ». */
export function planWords(rows) {
  const n = (a) => (rows || []).filter((r) => r.action === a).length, w = (k, one, many) => (k ? `${k} ${k > 1 ? many : one}` : "");
  return [w(n("create"), "création", "créations"), w(n("modify"), "modification", "modifications"), w(n("same"), "sans changement", "sans changement"), w(n("skip"), "écart", "écarts")].filter(Boolean).join(", ") || "rien à appliquer";
}
export const planApplies = (rows) => (rows || []).some((r) => r.action === "create" || r.action === "modify");

const LIST = { part: "parts", assembly: "assemblies", board: "boards", case: "cases" }, KEEP = 20;      // the load cases of the Simulation are a list by id too ; the title block of the drawings is one object (« sheet »)
/** What a project holds, artefact by artefact — taken BEFORE a change, to tell afterwards what the change did (the common AI loop : modules/ai_loop.js). */
export function snapshotLists(project) { const out = { journal: (project && project.aiJournal) || [] }; for (const [kind, key] of Object.entries(LIST)) out[kind] = new Map(((project && project[key]) || []).map((x) => [x.id, JSON.stringify(x)])); out.sheet = JSON.stringify((project && project.drawing) ?? null); return out; }
/** The journal entry of a change made between a snapshot and now : what appeared, what changed, what went. Written in project.aiJournal ; null when nothing changed.
    To be called inside the step that makes the change (a hook of the store). */
export function journalChange(before, project, o = {}) {
  const entry = { id: `ai-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, when: o.when || new Date().toISOString(), ask: String(o.ask || "").slice(0, 300), created: [], modified: [], removed: [] };
  for (const [kind, key] of Object.entries(LIST)) {
    const now = project[key] || [], seen = new Set();
    for (const x of now) { seen.add(x.id); const was = before[kind].get(x.id); if (was === undefined) entry.created.push({ kind, id: x.id }); else if (was !== JSON.stringify(x)) entry.modified.push({ kind, id: x.id, before: JSON.parse(was) }); }
    for (const [id, was] of before[kind]) if (!seen.has(id)) entry.removed.push({ kind, id, before: JSON.parse(was) });
  }
  if (before.sheet !== undefined && before.sheet !== JSON.stringify(project.drawing ?? null)) entry.modified.push({ kind: "sheet", id: "cartouche", before: JSON.parse(before.sheet) });
  if (!entry.created.length && !entry.modified.length && !entry.removed.length) return null;
  project.aiJournal = [entry, ...(project.aiJournal || before.journal || [])].slice(0, KEEP);
  return entry;
}
/** Apply a plan to a project — to be called INSIDE one step of the store : the parts first, then the assemblies, the boards, and the drawing sheets
    (a sheet may belong to a part this answer creates). → the entry written in the journal (project.aiJournal) — what appeared, what changed, the title block included */
export function applyPlan(project, rows, o = {}) {
  const before = snapshotLists(project), go = (rows || []).filter((r) => r.doc && (r.action === "create" || r.action === "modify")), order = ["part", "assembly", "board", "drawing"];
  for (const r of [...go].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) {
    if (r.kind === "drawing") { moreApply(project, `drawing:${r.of}:${r.target}`, JSON.parse(JSON.stringify(r.doc))); continue; }
    const list = (project[LIST[r.kind]] = project[LIST[r.kind]] || []), i = list.findIndex((x) => x.id === r.id), doc = JSON.parse(JSON.stringify(r.doc));
    if (i >= 0) list[i] = doc; else list.push(doc);
  }
  return journalChange(before, project, o) || { id: `ai-${Date.now().toString(36)}`, when: o.when || new Date().toISOString(), ask: String(o.ask || "").slice(0, 300), created: [], modified: [], removed: [] };
}
/** Go back to before an answer — to be called inside one step of the store. What it created goes, unless something else came to use it since
    (an assembly that mounts it) ; what it changed gets back what it was. → { removed, restored, kept: [{ id, why }] } */
export function revertEntry(project, entryId) {
  const J = project.aiJournal || [], e = J.find((x) => x.id === entryId), out = { removed: [], restored: [], kept: [] };
  if (!e) return out;
  const mine = new Set(e.created.filter((c) => c.kind === "assembly").map((c) => c.id));
  for (const c of e.created.filter((x) => x.kind === "assembly")) { project.assemblies = (project.assemblies || []).filter((a) => a.id !== c.id); out.removed.push(c.id); }
  for (const c of e.created.filter((x) => x.kind === "board")) { project.boards = (project.boards || []).filter((b) => b.id !== c.id); out.removed.push(c.id); }
  for (const c of e.created.filter((x) => x.kind === "case")) { project.cases = (project.cases || []).filter((b) => b.id !== c.id); out.removed.push(`cas de ${c.id}`); }
  for (const r of e.removed || []) { const list = (project[LIST[r.kind]] = project[LIST[r.kind]] || []); if (!list.some((x) => x.id === r.id)) { list.push(JSON.parse(JSON.stringify(r.before))); out.restored.push(r.id); } }      // what the answer took away comes back
  for (const c of e.created.filter((x) => x.kind === "part")) {
    const user = (project.assemblies || []).find((a) => !mine.has(a.id) && (a.instances || []).some((i) => i.part === c.id));
    if (user) { out.kept.push({ id: c.id, why: `montée dans ${user.id}` }); continue; }
    project.parts = (project.parts || []).filter((p) => p.id !== c.id); out.removed.push(c.id);
  }
  for (const m of e.modified.filter((x) => x.kind === "sheet")) { if (m.before === null || m.before === undefined) delete project.drawing; else project.drawing = JSON.parse(JSON.stringify(m.before)); out.restored.push("cartouche"); }
  for (const m of e.modified.filter((x) => x.kind !== "sheet")) { const list = project[LIST[m.kind]] || [], i = list.findIndex((x) => x.id === m.id); if (i >= 0) { list[i] = JSON.parse(JSON.stringify(m.before)); out.restored.push(m.id); } }
  project.aiJournal = J.filter((x) => x.id !== entryId);
  return out;
}
/** The journal, for its lines : → [{ id, when, ask, words }] */
export const journalLines = (project) => ((project && project.aiJournal) || []).map((e) => { const n = (k, one, many) => ((e[k] || []).length ? `${e[k].length} ${e[k].length > 1 ? many : one}` : "");
  return { id: e.id, when: e.when, ask: e.ask, words: [n("created", "créé", "créés"), n("modified", "modifié", "modifiés"), n("removed", "retiré", "retirés")].filter(Boolean).join(", "), what: [...(e.created || []), ...(e.modified || []), ...(e.removed || [])].map((x) => x.id).slice(0, 6).join(", ") }; });
