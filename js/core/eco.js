/* DesignWizard.ai — the ECOSYSTEM of a product, packed for an AI (point 9 b of the plan agreed with JP : « voir un projet pièce / assemblage /
   PCBA / logiciel / DFx comme un écosystème balancé sur des compromis » ; choices clicked on 20 November : the frame given to the AI is the rules
   the tool already checks, plus those the project writes).
   What a single artefact cannot say, the package says : WHAT DEPENDS ON WHAT (the map — an assembly mounts a part, two parts share an interface
   key and adapt to each other, a board has its mechanical twin, an analysis or a load case reads a part), WHERE THE CHECKS STAND (the guide, the
   review, the MVP iteration, the revisions), and THE FRAME — the rules the tool checks, each with how far it was verified, and the rules of the
   project, each On or Off. The request is framed by the screen one comes from, written as an interview (what one wants, what must not move,
   how one will know it worked) ; the system's dictation types in those fields — the tool calls no AI and opens no microphone.
   Pure : no page, no store. The package itself is a list of text files (ecoFiles) ; the screen zips them (modules/eco.js). */

import { flatAsm, isSub } from "./asm_levels.js";
import { natureOf } from "./shop_levels.js";
import { projectIssues } from "./guide_checks.js";
import { reviewItems, REVIEW_STATES } from "./review.js";
import { contextOf, withoutHistory } from "./history.js";
import { GATES } from "./mvp.js";
import { methodById } from "./methods.js";

const STEP_MARK = "(géométrie STEP importée, non modifiable — gardée par l'outil)";
/** What a link between two artefacts means, with its colour. */
export const EDGE_KINDS = {
  mounts: { fr: "monte", color: "#475569", why: "l'assemblage pose cette pièce : la changer change l'assemblage" },
  contains: { fr: "contient", color: "#334155", why: "un sous-assemblage, porté d'un seul bloc" },
  key: { fr: "partage l'interface", color: "#2563eb", why: "deux pièces qui portent la même clé d'interface s'adaptent l'une à l'autre" },
  mate: { fr: "accouplée à", color: "#7c3aed", why: "un accouplement de l'assemblage les tient ensemble" },
  twin: { fr: "jumeau mécanique", color: "#16a34a", why: "la pièce « pcb » suit la carte à chaque changement" },
  reads: { fr: "calcule", color: "#a16207", why: "un modèle analytique lit cette pièce : à refaire quand elle change" },
  case: { fr: "cas de charge", color: "#dc2626", why: "une simulation lit cette pièce : à relancer quand elle change" },
};
export const NODE_KINDS = { assembly: { fr: "Assemblage", color: "#475569", icon: "assembly" }, part: { fr: "Pièce", color: "#2563eb", icon: "part" }, board: { fr: "Carte (PCBA)", color: "#16a34a", icon: "chip" },
  software: { fr: "Logiciel", color: "#0891b2", icon: "code" }, analysis: { fr: "Calcul", color: "#a16207", icon: "physics" }, case: { fr: "Cas de charge", color: "#dc2626", icon: "physics" } };

/** The map of the product. → { nodes: [{ key, kind, id, name, color, icon, nature? }], edges: [{ from, to, kind, label }] } — an edge goes from what
    depends to what it depends on (an assembly → its part : the assembly depends on the part). */
export function ecoMap(project) {
  const p = project || {}, parts = p.parts || [], asms = p.assemblies || [], nodes = [], edges = [], has = new Set(), pid = new Map(parts.map((x) => [x.id, x]));
  const node = (n) => { if (!has.has(n.key)) { has.add(n.key); nodes.push(n); } }, edge = (from, to, kind, label = "") => { if (from !== to && has.has(from) && has.has(to) && !edges.some((e) => e.from === from && e.to === to && e.kind === kind)) edges.push({ from, to, kind, label }); };
  for (const a of asms) node({ key: `assembly:${a.id}`, kind: "assembly", id: a.id, name: a.name || "", ...pick(NODE_KINDS.assembly) });
  for (const x of parts) { const n = natureOf(x); node({ key: `part:${x.id}`, kind: "part", id: x.id, name: x.name || "", color: n.color, icon: n.icon, nature: n.label }); }
  for (const b of p.boards || []) node({ key: `board:${b.id}`, kind: "board", id: b.id, name: b.name || "", ...pick(NODE_KINDS.board) });
  for (const s of p.software || []) node({ key: `software:${s.id}`, kind: "software", id: s.id, name: s.name || "", ...pick(NODE_KINDS.software) });
  for (const c of p.physics || []) if (c && c.id) node({ key: `analysis:${c.id}`, kind: "analysis", id: c.id, name: c.name || c.model || "", ...pick(NODE_KINDS.analysis) });
  for (const c of p.cases || []) if (c && c.id) node({ key: `case:${c.id}`, kind: "case", id: c.id, name: c.name || "cas en cours", ...pick(NODE_KINDS.case) });
  const find = (id) => asms.find((x) => x.id === id) || null;
  for (const a of asms) {
    const counts = new Map(); for (const i of a.instances || []) { if (isSub(i)) edge(`assembly:${a.id}`, `assembly:${i.asm}`, "contains"); else counts.set(i.part, (counts.get(i.part) || 0) + 1); }
    for (const [part, n] of counts) edge(`assembly:${a.id}`, `part:${part}`, "mounts", n > 1 ? `× ${n}` : "");
    let flat = null; try { flat = flatAsm(a, find); } catch (e) { flat = null; }
    const inst = new Map(((flat && flat.instances) || a.instances || []).filter((i) => !isSub(i)).map((i) => [i.id, i.part]));
    for (const m of (flat && flat.mates) || a.mates || []) { const A = inst.get(m.a && m.a.inst), B = inst.get(m.b && m.b.inst); if (A && B && A !== B) edge(`part:${A}`, `part:${B}`, "mate", m.id || ""); }
  }
  const byKey = new Map(); for (const x of parts) for (const i of x.interfaces || []) if (i && i.key) (byKey.get(i.key) || byKey.set(i.key, new Set()).get(i.key)).add(x.id);
  for (const [k, set] of byKey) { const ids = [...set]; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) edge(`part:${ids[i]}`, `part:${ids[j]}`, "key", k); }
  for (const b of p.boards || []) if (b.part && pid.has(b.part)) edge(`part:${b.part}`, `board:${b.id}`, "twin");
  for (const c of p.physics || []) if (c && c.part && pid.has(c.part)) edge(`analysis:${c.id}`, `part:${c.part}`, "reads");
  for (const c of p.cases || []) if (c && c.id) edge(`case:${c.id}`, pid.has(c.id) ? `part:${c.id}` : `assembly:${c.id}`, "case");
  return { nodes, edges };
}
function pick(k) { return { color: k.color, icon: k.icon }; }
/** What is touched when `key` changes : everything that depends on it, near or far (an assembly that mounts the part, the assembly above it, a
    part that shares an interface key — both ways —, the analyses and cases that read it). → [{ key, depth, via }] */
export function ecoImpact(map, key) {
  const out = new Map(), seen = new Set([key]); let front = [key], depth = 0;
  const near = (k) => map.edges.filter((e) => e.to === k || ((e.kind === "key" || e.kind === "mate" || e.kind === "twin") && e.from === k)).map((e) => ({ k: e.to === k ? e.from : e.to, kind: e.kind }));
  while (front.length && depth < 6) { depth++; const next = [];
    for (const k of front) for (const n of near(k)) if (!seen.has(n.k)) { seen.add(n.k); out.set(n.k, { key: n.k, depth, via: n.kind }); next.push(n.k); }
    front = next; }
  return [...out.values()];
}

/** Where the checks of the project stand. → { issues: { error, todo, warn, tip, list: [{ level, text }] }, review: { counts, open: [{ key, state, name }] }, mvp, revs } */
export function ecoChecks(project) {
  const list = projectIssues(project), issues = { error: 0, todo: 0, warn: 0, tip: 0, list: list.map((x) => ({ level: x.level, text: x.text })) };
  for (const x of list) if (issues[x.level] !== undefined) issues[x.level]++;
  const R = reviewItems(project), counts = Object.fromEntries(Object.keys(REVIEW_STATES).map((s) => [s, R.filter((r) => r.state === s).length]));
  const c = contextOf(project);
  return { issues, review: { counts, open: R.filter((r) => r.state !== "ok").map((r) => ({ key: r.key, state: r.state, name: r.name || r.id })) }, mvp: c.mvp, revs: c.revs };
}

/* ---------- the rules the project writes : On / Off, copied born Off ---------- */
export const rulesOf = (project) => (project && project.frame && project.frame.rules) || [];
const frameOf = (project) => { project.frame = project.frame || {}; project.frame.rules = project.frame.rules || []; return project.frame; };
const nextId = (rules) => `R${rules.reduce((m, r) => Math.max(m, Number(String(r.id).slice(1)) || 0), 0) + 1}`;
export function addRule(project, text) { const f = frameOf(project), r = { id: nextId(f.rules), text: String(text || "").trim().slice(0, 400), on: true }; f.rules.push(r); return r; }
export function copyRule(project, id) { const f = frameOf(project), r = f.rules.find((x) => x.id === id); if (!r) return null; const c = { ...r, id: nextId(f.rules), on: false }; f.rules.splice(f.rules.indexOf(r) + 1, 0, c); return c; }
export function setRule(project, id, o) { const r = frameOf(project).rules.find((x) => x.id === id); if (!r) return null; if (o.text !== undefined) r.text = String(o.text).slice(0, 400); if (o.on !== undefined) r.on = !!o.on; return r; }
export function removeRule(project, id) { const f = frameOf(project), n = f.rules.length; f.rules = f.rules.filter((x) => x.id !== id); return f.rules.length < n; }

/** The frame of the design : the rules the tool checks — the DFx of the processes the product uses, interfaces, isolation, units, MVP gates —
    each with how far the tool verified it, and the rules of the project that are On. rulebook : RULEBOOK of analysis/dfx_rules.js (given, so that
    this stays light). → [{ id, title, how, lines: [text] }] */
export function ecoFrame(project, rulebook = []) {
  const p = project || {}, used = new Set((p.parts || []).map((x) => x.process).filter(Boolean)), out = [];
  const how = (id) => { const m = methodById(id); return m ? m.how : ""; };
  for (const b of rulebook.filter((x) => used.has(x.process) || x.process === "interfaces" || x.process === "general" || (x.process === "assembly" && (p.assemblies || []).length)))
    out.push({ id: `dfx-${b.process}`, title: `DFx — ${b.title}${b.fr && b.fr !== b.title ? ` (${b.fr})` : ""}`, how: "own", lines: b.rules.map((r) => `${r.id} ${r.title}${r.limit ? ` — ${r.limit}` : ""}${r.manual ? " (documentée, non vérifiée par l'outil)" : ""}${r.why ? ` · ${r.why}` : ""}`) });
  const keys = new Map(); for (const x of p.parts || []) for (const i of x.interfaces || []) if (i && i.key) (keys.get(i.key) || keys.set(i.key, []).get(i.key)).push(`${x.id}/${i.id} (${i.type})`);
  out.push({ id: "interfaces", title: "Interfaces", how: "own", lines: ["Une interface porte une clé (key) : deux pièces qui partagent une clé s'adaptent l'une à l'autre — garde les clés, et change les deux côtés ensemble.", "Le type et les paramètres d'une interface s'accordent de part et d'autre (vis, motif de perçage, contact) ; un accouplement de l'assemblage se fait sur ces interfaces.",
    ...[...keys].map(([k, l]) => `${k} : ${l.join(" ↔ ")}`)] });
  const iec = methodById("iec-60664-1");
  out.push({ id: "isolation", title: "Isolation (creepage, clearance)", how: how("iec-60664-1"), lines: ["Les distances d'isolement se vérifient par paire de potentiels, entre conducteurs de tensions différentes ; un isolant ou une distance ne se réduit pas sans refaire l'analyse.", iec ? `Tables utilisées : ${iec.name} — ${iec.check}` : ""].filter(Boolean) });
  out.push({ id: "units", title: "Unités", how: "own", lines: ["Le projet est en millimètres et en SI : un .dwiz s'écrit en mm, les calculs restent en SI. Ne convertis rien en pouces dans un artéfact."] });
  const its = (p.mvp && p.mvp.iterations) || [], it = its.filter((x) => !x.closed).at(-1) || null;
  out.push({ id: "mvp", title: "Jalons MVP", how: how("trl"), lines: [it ? `Itération en cours : ${it.name || `MVP ${it.n}`}, TRL ${it.trl || "?"} visé, revue de passage : ${GATES[it.gate] || it.gate || "—"}.` : "Aucune itération MVP ouverte.", "Ce qui est gelé (une révision, une itération) ne change plus : un changement ouvre la révision ou l'itération suivante."] });
  const own = rulesOf(p).filter((r) => r.on !== false && r.text);
  out.push({ id: "project", title: "Règles du projet", how: "project", lines: own.length ? own.map((r) => `${r.id} ${r.text}`) : ["Le projet n'a écrit aucune règle à lui."] });
  return out;
}

/** The request, framed by the screen one comes from. o : { target: { key, label }, screen (the name of the screen), ask, keep, done, questions } → text */
export function ecoBrief(project, o = {}, map = ecoMap(project)) {
  const t = o.target || { key: "project", label: "tout le projet" }, impact = t.key === "project" ? [] : ecoImpact(map, t.key);
  const say = (s, alt) => (String(s || "").trim() || alt);
  return [`# Consigne — paquet d'écosystème de « ${(project && project.name) || "projet"} »`, "",
    "Tu reçois TOUT le produit, pour comprendre les compromis entre ses pièces, ses assemblages, ses cartes, son logiciel et ses vérifications — et la demande, qui porte sur un artéfact.", "",
    "## La demande", "", `- Écran d'où elle vient : ${o.screen || "—"}`, `- Artéfact visé : ${t.label} (${t.key})`, `- Ce que je veux : ${say(o.ask, "(à préciser — pose-moi la question)")}`, `- Ce qui ne doit pas bouger : ${say(o.keep, "(rien de dit — demande-le)")}`, `- Comment je saurai que c'est réussi : ${say(o.done, "(rien de dit — propose un critère)")}`, "",
    "## Ce que l'artéfact visé dérange s'il change", "", ...(impact.length ? impact.map((x) => `- ${x.key} (${EDGE_KINDS[x.via] ? EDGE_KINDS[x.via].fr : x.via}${x.depth > 1 ? `, à ${x.depth} pas` : ""})`) : ["- (rien n'en dépend, ou la demande porte sur tout le projet)"]), "",
    "## Comment travailler", "",
    "1. Lis `cadre.md` : les règles que l'outil vérifie (avec leur niveau de vérification) et celles du projet. Une règle du projet l'emporte sur une habitude.",
    "2. Lis `dependances.md` : avant de changer un artéfact, regarde ce qui en dépend ; dis le compromis quand une règle en gêne une autre.",
    "3. Lis `verifications.md` et `etat.md` : ce qui est à corriger, ce qui est revu, ce qui est gelé — ne touche pas à ce qui est gelé.",
    o.questions ? "4. Pose-moi tes questions d'abord, une à la fois, avant de rendre quoi que ce soit." : "4. Si une information manque, dis-le plutôt que de l'inventer ; une valeur que tu proposes est un exemple à confirmer.",
    "5. Rends SEULEMENT les artéfacts que tu crées ou modifies, chacun complet, en .dwiz (une ligne « dwiz … » en tête) : garde les id et les clés (key) des interfaces ; une pièce importée en STEP ne se modifie pas.",
    "6. Termine par « Ce que cela dérange » : les artéfacts qui dépendent de ce que tu as changé, et ce qu'il faut y revoir (interfaces, accouplements, DFx, cas à relancer, dessins à refaire).", "",
    "## Comment la réponse revient", "", "La personne rapporte ta réponse dans DesignWizard.ai : le bouton « IA » de l'écran pour un artéfact, ou la porte « Avec l'IA » de l'Atelier pour plusieurs pièces et assemblages (.dwiz, .json ou .zip). Elle voit un aperçu, applique en une étape annulable ; un point de restauration se pose tout seul.", ""].join("\n");
}

const md = (rows) => rows.join("\n");
/** The files of the package. o : as ecoBrief, plus rulebook, language (the reference of the part language), toDwiz (a writer of .dwiz).
    → [{ name, text }] */
export function ecoFiles(project, o = {}) {
  const map = ecoMap(project), checks = ecoChecks(project), frame = ecoFrame(project, o.rulebook || []), c = contextOf(project), lvl = { error: "à corriger", todo: "à entrer", warn: "à vérifier", tip: "conseil" };
  const name = (k) => { const n = map.nodes.find((x) => x.key === k); return n ? `${n.id}${n.name ? ` — ${n.name}` : ""}` : k; };
  const files = [{ name: "consigne.md", text: ecoBrief(project, o, map) }];
  const doc = lightSteps(withoutHistory(project));
  files.push({ name: "projet.dwiz", text: o.toDwiz ? o.toDwiz(doc) : JSON.stringify(doc, null, 1) });
  files.push({ name: "dependances.md", text: md([`# Ce qui dépend de quoi — ${map.nodes.length} artéfacts, ${map.edges.length} liens`, "", "Un lien va de ce qui dépend vers ce dont il dépend.", "",
    ...Object.entries(EDGE_KINDS).flatMap(([k, e]) => { const l = map.edges.filter((x) => x.kind === k); return l.length ? [`## ${e.fr} — ${e.why}`, "", ...l.map((x) => `- ${name(x.from)} → ${name(x.to)}${x.label ? ` (${x.label})` : ""}`), ""] : []; })]) });
  files.push({ name: "dependances.json", text: JSON.stringify(map, null, 1) });
  files.push({ name: "verifications.md", text: md(["# Où en sont les vérifications", "", `Guide : ${checks.issues.error} à corriger, ${checks.issues.todo} à entrer, ${checks.issues.warn} à vérifier, ${checks.issues.tip} conseils.`, "",
    ...checks.issues.list.map((x) => `- [${lvl[x.level] || x.level}] ${x.text}`), "", "## Revue", "", ...Object.entries(checks.review.counts).map(([s, n]) => `- ${REVIEW_STATES[s].fr} : ${n}`), "",
    ...checks.review.open.slice(0, 80).map((r) => `- ${r.key} — ${REVIEW_STATES[r.state].fr}`), ""]) });
  files.push({ name: "cadre.md", text: md(["# Le cadre de conception", "", "Les règles que l'outil vérifie, chacune avec son niveau de vérification (own : choix de l'outil ; typed : saisie, à vérifier contre la norme ; read : lue), puis celles du projet.", "",
    ...frame.flatMap((s) => [`## ${s.title}${s.how ? ` — ${s.how}` : ""}`, "", ...s.lines.map((l) => `- ${l}`), ""])]) });
  files.push({ name: "etat.md", text: md(["# État du produit", "", `- Itération MVP : ${c.mvp ? `${c.mvp.name} — ${c.mvp.fr}` : "aucune"}`, `- Révisions : ${c.revs.frozen} gelée(s), ${c.revs.released} libérée(s), ${c.revs.rejected} refusée(s)`,
    ...c.revs.last.map((r) => `  - ${r.key} : ${r.pn} rév. ${r.rev} (${r.fr}) — ne change plus`), `- Point de restauration « ici » : ${project.history && project.history.head ? project.history.head : "aucun"}`, ""]) });
  if (o.language) files.push({ name: "langage.md", text: o.language });
  return files;
}
/** An imported STEP part keeps its geometry here : the package carries a mark in its place. */
function lightSteps(doc) { const d = JSON.parse(JSON.stringify(doc)); for (const p of d.parts || []) if (p && p.step && typeof p.step === "object" && String(p.step.text || "").length > 2000) p.step = STEP_MARK; return d; }
/** What the guide says on the screen of the ecosystem. → [{ level, text }] */
export function ecoGuide(project, target) {
  const out = [], own = rulesOf(project).filter((r) => r.on !== false && r.text);
  if (!own.length) out.push({ level: "tip", text: "Le projet n'a écrit aucune règle à lui : une règle du projet (« le boîtier reste en aluminium moulé », « pas de pièce plus large que 120 mm ») cadre l'IA mieux qu'une habitude." });
  if (rulesOf(project).some((r) => !String(r.text || "").trim())) out.push({ level: "todo", text: "Une règle du projet est vide : écrivez-la ou retirez-la." });
  const c = ecoChecks(project); if (c.issues.error) out.push({ level: "warn", text: `${c.issues.error} point${c.issues.error > 1 ? "s" : ""} à corriger dans le projet : l'IA les verra dans verifications.md.` });
  if (target && target.key !== "project") { const n = ecoImpact(ecoMap(project), target.key).length; if (n) out.push({ level: "tip", text: `${n} artéfact${n > 1 ? "s dépendent" : " dépend"} de ${target.key} : la consigne les nomme.` }); }
  return out;
}
/** The lines of the report. → [[règle, texte, état]] */
export const ecoRows = (project) => rulesOf(project).map((r) => [r.id, r.text, r.on === false ? "Off" : "On"]);
