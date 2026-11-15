/* DesignWizard.ai — a first complete design, written by an AI after an interview.
   The engineer gives a detailed description ; firstDesignPrompt() wraps it in an interview led block by block, with
   answers to click, in the manner of the Project Starter of DynamiteAgile ; the assistant ends with ONE file : every
   part, the assemblies, the board by its functions and blocks, the analyses to run, its assumptions.
   readFirstDesign() reads that file and makes a project of it WITHOUT believing it : every part goes through the
   part language, a board is built again from its blocks, the analyses are computed here — never taken from the
   answer — and everything arrives as a draft for the design review. Nothing is created : the caller shows the
   preview, the human decides. */

import { LANGUAGE_REFERENCE } from "../cad/language_doc.js";
import { validateSpec } from "../cad/build.js";
import { FEATURE_OPS } from "../cad/features.js";
import { isShopVerb } from "../cad/shop.js";
import { BLOCKS } from "../pcba/blocks.js";
import { emptyBoard, resolveBoard } from "../pcba/model.js";
import { addBlock, addFunction } from "../pcba/synth.js";
import { inheritFromPart } from "../pcba/twin.js";
import { LIBRARY } from "../pcba/library.js";
import { MODELS, model, run, defaults, prefill } from "../analysis/physics/index.js";
import { findDwiz, fromDwiz } from "./dwiz.js";

export const FIRST_DESIGN_BLOCKS = [
  ["Le produit et son usage", ["ce que fait le produit, en une phrase que tu reformules et fais valider", "où il vit : intérieur, extérieur, véhicule, atelier ; températures ; eau et poussière", "son énergie et ses tensions (pile, 5 V, 12 / 24 V, secteur, haute tension : l'isolation en dépend)", "la quantité visée (1 à 10 prototypes, une centaine, des milliers) : elle choisit les procédés", "ce qui compte le plus : coût, masse, robustesse, délai, aspect"]],
  ["L'architecture", ["l'enveloppe hors tout disponible (L × l × h) et la masse visée", "la liste des pièces que tu proposes — tableau : repère, nom, fonction, procédé, matière, conçue ou achetée — à faire valider", "les pièces achetées (moteur, roulement, connecteur, écran…) et leurs cotes d'interface", "l'ordre de montage et ce qui doit rester démontable"]],
  ["Les interfaces", ["le tableau des interfaces entre pièces — qui tient, positionne ou guide quoi ; type ; vis ; clé commune — à faire valider", "comment le produit se fixe à son environnement", "les ouvertures : connecteurs, voyants, ventilation, accès"]],
  ["L'électronique (à sauter s'il n'y a pas de carte)", ["l'arbre des fonctions de la carte (un verbe et un complément, avec un critère chiffré) à faire valider", "les blocs du catalogue qui réalisent chaque fonction, avec leurs paramètres", "les dimensions de la carte, ses fixations, ses connecteurs vers l'extérieur"]],
  ["Les efforts et la physique", ["les charges : forces, couples, chocs, vibrations, pression", "la chaleur : puissance dissipée, par où elle sort", "le tableau des analyses que tu proposes — modèle du catalogue, pièce, données — à faire valider"]],
  ["La fabrication", ["le procédé confirmé pièce par pièce (usinage, tôle, moulage, impression, extrusion) et la matière première", "les finitions et l'aspect ; ce qui doit être prêt à commander en prototype rapide"]],
];
const HOW = [
  "Lis la description en entier. Ne redemande rien de ce qu'elle dit déjà : commence par reformuler le produit en trois lignes, puis ne pose que les questions qui manquent.",
  "Une seule question par message, numérotée « Question 4 / 16 ». De 10 à 20 questions, dans l'ordre des blocs ci-dessous.",
  "Des réponses à cliquer, pas à écrire. Si ton interface a un outil de questions à choix (dans Claude : un menu de réponses à toucher), utilise-le à chaque question : 2 à 4 choix courts, le conseillé en premier avec « (Recommandé) », et toujours « Je ne sais pas — choisis pour moi ». Sinon numérote les choix, pour qu'on réponde par un chiffre.",
  "Pour faire valider une proposition (pièces, interfaces, fonctions de la carte, analyses) : montre-la en tableau, puis offre « C'est bon (Recommandé) », « Plus simple », « Plus complet », « Refaire autrement ».",
  "« Je ne sais pas » : prends la valeur la plus raisonnable, dis-la en une ligne, range-la dans les hypothèses, continue.",
  "Récapitule chaque bloc dans un petit tableau avant de passer au suivant.",
  "Ne demande jamais de mot de passe, de clé ni de donnée personnelle. Une norme ne se cite que si tu es sûr de son numéro ; son édition et sa clause seront confirmées par un humain.",
];
const DESIGN = [
  "Les INTERFACES d'abord. Deux pièces qui se touchent partagent une interface : même \"type\", même \"key\", mêmes \"params\" ; \"side\": \"A\" sur l'une, \"B\" sur l'autre. C'est ce qui permet à l'assemblage de s'accoupler seul : une clé qui n'apparaît que sur une pièce est une interface vers l'extérieur du produit.",
  "Une interface qui regarde l'extérieur du produit (châssis du client, mur, câble) porte \"external\": true. Un collage est une interface de type \"bond\" (plage w × h, film \"gap\", \"adhesive\", \"prep\") : la plateforme y met les plots de calage et compte la colle.",
  "Chaque cote utile est un paramètre nommé (\"params\"), jamais un nombre répété. Les repères sont courts et en majuscules, avec un préfixe commun au produit (ex. CAP-BOITIER, CAP-CARTE).",
  "Reste sobre pour un premier jet : 3 à 12 pièces conçues. Une pièce achetée est une pièce de \"family\": \"purchased\" réduite à son enveloppe et à ses interfaces.",
  "Chaque pièce dit sa \"function\" en une phrase, sa matière, son procédé et sa matière première (\"stock\") : une plaque, une tôle, un rond du commerce, ou \"molded\" pour une pièce moulée.",
  "La carte électronique s'écrit par ses FONCTIONS et les BLOCS du catalogue qui les réalisent : la plateforme en tire composants, nets, placement et routage. N'écris ni composant ni piste. Sa pièce mécanique (\"family\": \"pcb\", contour et trous de fixation) figure parmi les pièces ; \"part\" les relie.",
  "Les analyses : choisis-les dans le catalogue et donne leurs données d'entrée dans les unités indiquées. Ne donne AUCUN résultat : la plateforme calcule. Une donnée que tu estimes se dit dans \"why\".",
  "Dans \"brief\", écris les réponses de l'entrevue, tes hypothèses, et les questions ouvertes : ce dont tu n'es pas sûr est ce que l'ingénieur doit regarder en premier.",
];
const SKELETON = `{
 "dw": "project/1", "name": "Nom du produit", "description": "Deux ou trois phrases.",
 "brief": { "answers": [{ "q": "Question posée", "a": "Réponse retenue" }], "assumptions": ["Hypothèse prise sans réponse"], "open": ["Question ouverte pour la revue de conception"] },
 "parts": [ { "dw": "part/1", "id": "XXX-BOITIER", "name": "…", "function": "…", "…": "une pièce complète du langage ci-dessous" } ],
 "assemblies": [ { "dw": "assembly/1", "id": "XXX-ASM", "name": "Assemblage général", "instances": [ { "id": "i1", "part": "XXX-BOITIER", "fixed": true }, { "id": "i2", "part": "XXX-CARTE" } ] } ],
 "boards": [ { "id": "XXX-PCBA", "name": "Carte de contrôle", "part": "XXX-CARTE", "description": "…",
   "functions": [ { "name": "Alimenter la logique à partir du 24 V", "criteria": [{ "name": "Tension d'entrée", "level": "18 à 30 V" }],
     "blocks": [ { "template": "buck", "params": { "vin": 24, "vout": 5, "iout": 1 } } ] } ] } ],
 "physics": [ { "model": "bolted_joint", "part": "XXX-BOITIER", "why": "Tenue des quatre vis du couvercle sous 50 N", "inputs": { } } ]
}`;

const unit = (u) => (u ? ` ${u}` : "");
/** The block templates an assistant may pick, one per line. */
export const blockCatalogue = () => Object.values(BLOCKS).map((t) => `- ${t.id} — ${t.name} [${t.category}]${Object.keys(t.params || {}).length ? ` : ${Object.entries(t.params).map(([k, p]) => `${k}=${p.default ?? "…"}${unit(p.unit)}`).join(", ")}` : ""}`).join("\n");
/** The analytical models an assistant may ask for, with their inputs and units. */
export const physicsCatalogue = () => MODELS.map((m) => `- ${m.id} — ${m.title} : ${m.inputs.map((i) => `${i.key}${i.unit ? ` [${i.unit}]` : ""}`).join(", ")}`).join("\n");

/** The text to paste into an AI assistant. o = { description, name }. */
export function firstDesignPrompt(o = {}) {
  const n = FIRST_DESIGN_BLOCKS.reduce((s, b) => s + b[1].length, 0), text = String(o.description || "").trim();
  return [
    "# Premier design complet — entrevue pour DesignWizard.ai", "",
    "Tu es un bureau d'études mécatronique à toi seul : concepteur mécanique senior, électronicien et ingénieur de fabrication. À partir de la description ci-dessous et d'une courte entrevue, tu écris le PREMIER DESIGN COMPLET d'un produit pour la plateforme DesignWizard.ai : toutes ses pièces, ses assemblages, sa carte électronique et les analyses à faire.",
    "La plateforme construit chaque pièce en 3D à partir de ton fichier, calcule elle-même les analyses et les règles de fabrication, et présente le tout à l'ingénieur comme un BROUILLON à passer en revue de conception, pièce par pièce. Tu proposes ; l'outil calcule ; l'humain décide.", "",
    `## Le produit${o.name ? ` — ${o.name}` : ""}`, "", "Description donnée par l'ingénieur :", "", '"""', text || "(aucune description : commence par demander ce qu'est le produit, en une phrase, et le problème qu'il règle)", '"""', "",
    "## Comment mener l'entrevue", "", ...HOW.map((t, i) => `${i + 1}. ${t}`), "",
    `## Les blocs de l'entrevue (${n} sujets ; saute ceux que la description règle déjà)`, "",
    ...FIRST_DESIGN_BLOCKS.flatMap(([title, qs], i) => [`Bloc ${i + 1} — ${title}`, ...qs.map((q) => `- ${q}`), ""]),
    "Termine par un récapitulatif d'une page, fais-le valider, puis écris le fichier.", "",
    "## Règles de conception", "", ...DESIGN.map((t, i) => `${i + 1}. ${t}`), "",
    "## Le fichier à rendre", "",
    "UN SEUL objet JSON, complet, valide (aucun commentaire, aucune virgule finale) : en fichier à télécharger si ton interface le permet (nom : premier_design.json), sinon dans un seul bloc de code. S'il est long, ne le résume pas : écris-le en entier. Sa forme :", "",
    "```json", SKELETON, "```", "",
    "Après le fichier, donne en dix lignes au plus ce que l'ingénieur doit vérifier en premier.", "",
    "## Catalogue des blocs de carte (\"template\" et ses \"params\" par défaut)", "", blockCatalogue(), "",
    "## Catalogue des analyses (\"model\" et ses \"inputs\")", "", physicsCatalogue(), "",
    "## Langage des pièces (à respecter à la lettre)", "", LANGUAGE_REFERENCE,
  ].join("\n");
}

const clean = (id, fallback) => (String(id || fallback || "").trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)) || fallback;
const list = (v) => (Array.isArray(v) ? v : []);
function parse(text) {
  if (text && typeof text === "object") return text;
  const src = String(text || ""), dw = findDwiz(src);
  if (dw && !/^\s*[[{]/.test(src) && !/```json/i.test(src)) { const d = fromDwiz(dw); return Array.isArray(d) ? d[0] : d; }
  const fences = [...src.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim()).sort((a, b) => b.length - a.length);
  for (const f of [...fences, src.trim(), src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1)]) { try { const v = JSON.parse(f); if (v && typeof v === "object") return v; } catch (e) { /* next candidate */ } }
  throw new Error("Aucun design trouvé dans ce texte : il doit contenir le fichier complet rendu par l'assistant (un objet JSON commençant par { \"dw\": \"project/1\" …, ou un document .dwiz). Correctif : demandez à l'assistant « redonne le fichier complet, dans un seul bloc de code ».");
}

/** One board of the answer, built here from its functions and blocks. A board that already carries components is kept as it is. */
function readBoard(src, k, parts, item) {
  const id = clean(src.id, `CARTE-${k + 1}`);
  if (list(src.parts).length && list(src.nets).length) { const b = { ...JSON.parse(JSON.stringify(src)), id, dw: "board/1" }, R = resolveBoard(b, LIBRARY); item.problems.push(...R.problems); item.facts = `${b.parts.length} composants, ${b.nets.length} nets (gardés tels quels)`; return b; }
  const b = emptyBoard(id, src.name || "Carte électronique"), twin = src.part ? parts.find((p) => p.id === clean(src.part)) : null;
  b.description = String(src.description || "");
  if (src.part && !twin) item.notes.push(`pièce « ${src.part} » introuvable : le contour par défaut (60 × 40 mm) est gardé`);
  if (twin && !inheritFromPart(b, twin) && !twin.pcb) item.notes.push(`« ${twin.id} » n'est pas une pièce de famille « pcb » : contour par défaut`);
  if (src.board && typeof src.board === "object") for (const key of ["layers", "copper", "t", "finish"]) if (src.board[key] !== undefined) b.board[key] = src.board[key];
  let made = 0;
  for (const f of list(src.functions)) {
    if (!f || !String(f.name || "").trim()) { item.notes.push("une fonction sans nom est laissée de côté"); continue; }
    const fid = addFunction(b, { name: String(f.name).trim(), kind: f.kind === "contrainte" ? "contrainte" : "principale", criteria: list(f.criteria).filter((c) => c && c.name).map((c) => ({ name: String(c.name), level: String(c.level ?? ""), flex: c.flex || "F1" })), note: f.note });
    for (const blk of list(f.blocks)) {
      if (!blk || !BLOCKS[blk.template]) { item.problems.push(`bloc « ${blk && blk.template} » inconnu sous « ${f.name} » (catalogue : ${Object.keys(BLOCKS).slice(0, 6).join(", ")}…)`); continue; }
      try { addBlock(b, blk.template, blk.params && typeof blk.params === "object" ? blk.params : {}, { parent: fid, connect: blk.connect && typeof blk.connect === "object" ? blk.connect : undefined }); made++; }
      catch (e) { item.problems.push(`bloc « ${blk.template} » sous « ${f.name} » : ${e.message}`); }
    }
  }
  for (const f of b.functions) f.ai = { draft: true };                                  // every function waits for a human, as on DynamiteAgile
  for (const x of b.blocks) x.ai = { draft: true };
  const R = resolveBoard(b, LIBRARY); item.problems.push(...R.problems);
  item.facts = `${b.functions.filter((f) => !f.parent).length} fonctions, ${made} blocs → ${b.parts.length} composants, ${b.nets.length} nets ; placement et routage à lancer`;
  if (!made) item.notes.push("aucun bloc : la carte est vide, à composer dans l'écran PCBA");
  return b;
}

/** Reads the file an assistant gave back. → { project (ready to become one), items: [{ key, kind, id, name, facts, problems, notes }],
    refused, counts, fix (the request to paste back to the assistant when something was refused, or "") }. Throws when no design is found. */
export function readFirstDesign(text, o = {}) {
  const raw = parse(text), when = (o.date || new Date()).toISOString();
  if (!raw || (!Array.isArray(raw.parts) && !raw.features)) throw new Error("Ce fichier n'est pas un premier design : il lui manque la liste « parts ». Correctif : demandez à l'assistant le fichier complet décrit dans le prompt.");
  const src = Array.isArray(raw.parts) ? raw : { name: raw.name, parts: [raw] };
  const project = { dw: "project/1", name: String(src.name || o.name || "Premier design").slice(0, 80), description: String(src.description || ""), parts: [], assemblies: [], boards: [], physics: [],
    brief: { source: "premier design par entrevue IA", when, description: String(o.description || (src.brief && src.brief.description) || "").slice(0, 6000), answers: list(src.brief && src.brief.answers).filter((a) => a && a.q).map((a) => ({ q: String(a.q), a: String(a.a ?? "") })), assumptions: list(src.brief && src.brief.assumptions).map(String), open: list(src.brief && src.brief.open).map(String) },
    review: { items: {} } };
  const items = [], refused = [], seen = new Set();
  const item = (kind, id, name) => { const it = { key: `${kind}:${id}`, kind, id, name: name || "", facts: "", problems: [], notes: [] }; items.push(it); return it; };

  for (const [k, s0] of list(src.parts).entries()) {
    if (!s0 || typeof s0 !== "object") continue;
    const s = JSON.parse(JSON.stringify(s0)); s.dw = "part/1"; s.id = clean(s.id, `PIECE-${k + 1}`);
    if (seen.has(s.id)) { refused.push({ kind: "part", id: s.id, why: "repère en double" }); continue; }
    const v = validateSpec(s), odd = [...new Set(list(s.features).map((f) => f && f.op).filter((op) => op !== "interfaces" && !FEATURE_OPS.includes(op) && !isShopVerb(op)))];
    if (odd.length) v.errors.push(`opération(s) inconnue(s) du langage : ${odd.map((x) => `« ${x} »`).join(", ")}.`);       // caught here rather than at the first build
    if (v.errors.length) { refused.push({ kind: "part", id: s.id, why: v.errors.join(" ") }); continue; }
    seen.add(s.id); s.revision = s.revision || "A"; project.parts.push(s);
    const it = item("part", s.id, s.name); it.notes.push(...v.warnings); it.facts = [s.process, s.material, `${list(s.interfaces).length} interface(s)`].filter(Boolean).join(" · ");
  }
  /* an interface key met once looks outside the product ; met twice it must face itself : A against B, same type */
  const keys = new Map();
  for (const p of project.parts) for (const i of list(p.interfaces)) if (i.key) (keys.get(i.key) || keys.set(i.key, []).get(i.key)).push({ part: p.id, side: i.side || "A", type: i.type, external: !!i.external });
  let pairs = 0; const outside = [];
  for (const [key, uses] of keys) {
    if (uses.length === 1) { outside.push(`${uses[0].part} « ${key} »`); if (!uses[0].external) items.find((x) => x.key === `part:${uses[0].part}`).notes.push(`interface « ${key} » sans vis-à-vis dans le fichier : si elle regarde l'extérieur du produit, la marquer "external": true`); }
    else if (uses.length === 2 && uses[0].side !== uses[1].side && uses[0].type === uses[1].type) pairs++;
    else for (const u of uses) items.find((x) => x.key === `part:${u.part}`).notes.push(`interface « ${key} » : ${uses.length} pièces la portent (${uses.map((x) => `${x.part} côté ${x.side}`).join(", ")}) — attendu : deux pièces, un côté A et un côté B, même type`);
  }

  for (const [k, a0] of list(src.assemblies).entries()) {
    if (!a0 || typeof a0 !== "object") continue;
    const a = { dw: "assembly/1", id: clean(a0.id, `ASM-${k + 1}`), name: String(a0.name || "Assemblage"), instances: [], mates: [] }, it = item("assembly", a.id, a.name);
    if (seen.has(a.id)) a.id = `${a.id}-ASM`; it.id = a.id; it.key = `assembly:${a.id}`; seen.add(a.id);
    for (const [n, i] of list(a0.instances).entries()) {
      const pid = clean(i && i.part);
      if (!project.parts.some((p) => p.id === pid)) { it.problems.push(`pièce « ${i && i.part} » absente du fichier : retirée de l'assemblage`); continue; }
      a.instances.push({ id: String((i && i.id) || `i${n + 1}`), part: pid, ...(i.fixed ? { fixed: true } : {}), placement: i.placement && Array.isArray(i.placement.t) ? i.placement : { t: [0, 0, 0], r: [0, 0, 0] } });
    }
    if (a.instances.length && !a.instances.some((i) => i.fixed)) a.instances[0].fixed = true;
    if (a0.isolation && typeof a0.isolation === "object") a.isolation = a0.isolation;
    it.facts = `${a.instances.length} pièce(s) posée(s) ; accouplement automatique par les clés d'interface à l'ouverture`;
    if (a.instances.length) project.assemblies.push(a); else { items.pop(); refused.push({ kind: "assembly", id: a.id, why: "aucune de ses pièces n'existe dans le fichier" }); }
  }
  if (!project.assemblies.length && project.parts.length > 1) {
    const a = { dw: "assembly/1", id: clean(`${project.parts[0].id.split("-")[0]}-ASM`, "ASM-1"), name: "Assemblage général", instances: project.parts.map((p, n) => ({ id: `i${n + 1}`, part: p.id, ...(n ? {} : { fixed: true }), placement: { t: [0, 0, 0], r: [0, 0, 0] } })), mates: [] };
    project.assemblies.push(a); item("assembly", a.id, a.name).notes.push("le fichier ne donnait pas d'assemblage : toutes les pièces sont posées ensemble");
  }

  for (const [k, b0] of list(src.boards).entries()) {
    if (!b0 || typeof b0 !== "object") continue;
    const it = item("board", clean(b0.id, `CARTE-${k + 1}`), b0.name);
    try { const b = readBoard(b0, k, project.parts, it); project.boards.push(b); } catch (e) { items.pop(); refused.push({ kind: "board", id: it.id, why: e.message }); }
  }

  for (const [k, r] of list(src.physics).entries()) {
    const m = r && model(r.model), id = `phy-${k + 1}`;
    if (!m) { refused.push({ kind: "physics", id, why: `modèle « ${r && r.model} » inconnu (catalogue : ${MODELS.slice(0, 5).map((x) => x.id).join(", ")}…)` }); continue; }
    const spec = r.part ? project.parts.find((p) => p.id === clean(r.part)) : null, given = Object.fromEntries(Object.entries(r.inputs && typeof r.inputs === "object" ? r.inputs : {}).filter(([key]) => m.inputs.some((i) => i.key === key)));
    const ignored = Object.keys(r.inputs || {}).filter((key) => !(key in given));
    try {
      const res = run(m.id, { ...defaults(m.id), ...(spec ? prefill(m.id, { spec }).inputs : {}), ...given });   // computed here : a result written by the assistant is never read
      project.physics.push({ id, model: m.id, part: spec ? spec.id : null, why: String(r.why || ""), inputs: res.inputs, values: res.values, checks: res.checks, verdict: res.verdict, when, ai: { draft: true } });
      const it = item("physics", id, m.title); it.facts = `${spec ? `${spec.id} · ` : ""}verdict calculé : ${res.verdict}`; if (r.why) it.notes.push(String(r.why));
      if (ignored.length) it.notes.push(`donnée(s) inconnue(s) du modèle, ignorée(s) : ${ignored.join(", ")}`);
      if (r.part && !spec) it.notes.push(`pièce « ${r.part} » introuvable : calcul gardé sans pièce`);
    } catch (e) { refused.push({ kind: "physics", id, why: `${m.id} : ${e.message}` }); }
  }
  for (const it of items) project.review.items[it.key] = { state: "draft" };
  const counts = { parts: project.parts.length, assemblies: project.assemblies.length, boards: project.boards.length, physics: project.physics.length, pairs, outside: outside.length, refused: refused.length, problems: items.reduce((s, x) => s + x.problems.length, 0) };
  const KIND = { part: "pièce", assembly: "assemblage", board: "carte", physics: "analyse" };
  const fix = refused.length || counts.problems ? ["Le fichier que tu m'as rendu a été relu par DesignWizard.ai. Corrige les points suivants et redonne le fichier COMPLET, dans un seul bloc de code, sans rien changer d'autre :",
    ...refused.map((x) => `- ${KIND[x.kind]} « ${x.id} » refusée : ${x.why}`), ...items.flatMap((x) => x.problems.map((t) => `- ${KIND[x.kind]} « ${x.id} » : ${t}`))].join("\n") : "";
  return { project, items, refused, counts, outside, fix };
}

/** A whole project coming back from one complete outside iteration. The ledger and the brief stay those of the
    project ; an analysis whose inputs changed, or that arrives without result, is computed again here ; `before` tells
    what was there. Mutates and returns `after`. */
export function adoptIteration(before, after, o = {}) {
  const when = (o.date || new Date()).toISOString(), old = new Map(list(before.physics).map((r) => [String(r.id), r]));
  for (const k of ["review", "brief", "mvp", "team", "talk", "plm"]) { if (before[k] !== undefined) after[k] = JSON.parse(JSON.stringify(before[k])); else delete after[k]; }
  after.physics = list(after.physics).filter((r) => r && model(r.model)).map((r, k) => {
    const prev = old.get(String(r.id)), same = prev && prev.model === r.model && JSON.stringify(prev.inputs) === JSON.stringify(r.inputs);
    if (same) return prev;                                                       // untouched : the result computed here stays
    const m = model(r.model), given = Object.fromEntries(Object.entries(r.inputs || {}).filter(([key]) => m.inputs.some((i) => i.key === key)));
    try { const res = run(m.id, { ...defaults(m.id), ...given }); return { id: r.id || `phy-${Date.now().toString(36)}-${k}`, model: m.id, part: r.part || null, why: r.why || (prev && prev.why) || "", inputs: res.inputs, values: res.values, checks: res.checks, verdict: res.verdict, when }; }
    catch (e) { return prev || null; }
  }).filter(Boolean);
  if (!after.physics.length && before.physics === undefined) delete after.physics;
  return after;
}
