/* DesignWizard.ai — MVP iterations and their gate reviews. A product converges through as many iterations as it needs :
   each one aims at a maturity level (TRL), is FROZEN when it is ready (a snapshot of every artefact, of the dimensions,
   the functions and the interfaces), goes through at least one REVIEW — a detailed package read by an AI, or a session in
   front of colleagues — and is CLOSED with a decision. The next MVP opens only then. Between two frozen iterations the
   platform measures what moved : shapes, dimensions, functions, interfaces — convergence is a number, not an impression.
   project.mvp = { target, iterations: [{ n, name, goal, trl, gate, opened, frozen, snapshot, reviews: [{ id, kind, title,
     when, who, decision, notes, actions: [{ text, done }] }], closed, decision }] }
   Pure functions : the caller applies them inside one undoable step. */

import { reviewItems, reviewProgress, askRevision, REVIEW_KINDS } from "./review.js";
import { interfaceSignature } from "../cad/interfaces.js";

/** Technology readiness levels (ISO 16290), and what a review asks before saying the level is reached. */
export const TRL = {
  1: ["Principes de base observés", ["Le besoin et le principe physique sont-ils écrits ?"]],
  2: ["Concept formulé", ["Le concept répond-il à chaque fonction demandée ?", "Les interfaces avec l'extérieur du produit sont-elles nommées ?"]],
  3: ["Preuve de concept, par le calcul et par l'essai", ["Chaque fonction critique a-t-elle un calcul ou un essai qui la soutient ?", "Les hypothèses du calcul sont-elles écrites et plausibles ?"]],
  4: ["Composants validés en laboratoire", ["Chaque pièce se fabrique-t-elle avec le procédé choisi (DFx sans erreur) ?", "Les interfaces internes sont-elles toutes appariées et saines ?", "Le plan d'essai de laboratoire couvre-t-il les fonctions critiques ?"]],
  5: ["Composants validés en environnement représentatif", ["Les distances d'isolement et les lignes de fuite tiennent-elles aux tensions et à la pollution réelles ?", "La tenue thermique et mécanique est-elle montrée aux conditions d'emploi ?"]],
  6: ["Prototype démontré en environnement représentatif", ["L'assemblage complet se monte-t-il avec la gamme écrite, sans interférence ?", "Les écarts entre le prototype et la définition sont-ils consignés ?"]],
  7: ["Prototype démontré en environnement opérationnel", ["Les essais en conditions réelles couvrent-ils tous les cas d'emploi ?", "Les non-conformités ouvertes ont-elles un propriétaire et une date ?"]],
  8: ["Système complet et qualifié", ["Le dossier de qualification est-il complet et la définition figée ?"]],
  9: ["Système éprouvé en opération", ["Le retour d'expérience est-il repris dans la définition ?"]],
};
export const GATES = { iteration: "Revue d'itération", concept: "Revue de concept", pdr: "Revue préliminaire (PDR)", cdr: "Revue détaillée (CDR)", trr: "Revue d'aptitude aux essais (TRR)", qual: "Revue de qualification" };
export const DECISIONS = { go: { fr: "Accepté", tone: "ok" }, conditional: { fr: "Accepté avec réserves", tone: "warn" }, redo: { fr: "À refaire", tone: "danger" } };
export const REVIEW_MODES = { ai: "Dossier détaillé lu par une IA", humans: "Revue devant les collègues" };
export const SEVERITIES = { bloquant: 3, majeur: 2, mineur: 1, remarque: 0 };
const STATE_FR = { open: "Ouverte", frozen: "Gelée — soumise à la revue", reviewed: "Revue consignée", closed: "Close" };
const pct = (x) => `${Math.round(x * 100)} %`, iso = (d) => (d || new Date()).toISOString();

/** The record of a project, created on first use. */
export function mvpOf(project) { project.mvp = project.mvp || { target: 6, iterations: [] }; project.mvp.iterations = project.mvp.iterations || []; return project.mvp; }
const list = (project) => (project && project.mvp && project.mvp.iterations) || [];
export const iteration = (project, n) => list(project).find((x) => x.n === Number(n)) || null;
export const iterationState = (it) => (it.closed ? "closed" : (it.reviews || []).length ? "reviewed" : it.frozen ? "frozen" : "open");
export const stateLabel = (it) => STATE_FR[iterationState(it)];
/** The level reached : the highest one aimed by an iteration closed without « à refaire ». */
export const trlReached = (project) => list(project).filter((x) => x.closed && x.decision !== "redo").reduce((m, x) => Math.max(m, x.trl || 0), 0);

/** May a new MVP open ? Not while the last one is waiting for its review or its decision. */
export function canOpen(project) {
  const last = list(project).at(-1);
  if (!last) return { ok: true, why: "" };
  if (last.closed) return { ok: true, why: "" };
  const s = iterationState(last);
  return { ok: false, why: s === "open" ? `${last.name} est ouverte : gelez-la et passez-la en revue avant d'ouvrir la suivante.` : s === "frozen" ? `${last.name} est gelée mais n'a pas encore de revue consignée.` : `${last.name} a sa revue : il reste à la clore par une décision.` };
}
export function openIteration(project, o = {}) {
  const c = canOpen(project); if (!c.ok) throw new Error(c.why);
  const m = mvpOf(project), last = m.iterations.at(-1), n = (last ? last.n : 0) + 1;
  const it = { n, name: o.name || `MVP ${n}`, goal: o.goal || "", trl: Number(o.trl) || Math.min(9, Math.max(1, last ? (last.decision === "redo" ? last.trl : last.trl + 1) : 3)), gate: GATES[o.gate] ? o.gate : "iteration", opened: iso(o.date), reviews: [] };
  m.iterations.push(it); return it;
}

/** What a project is made of, in a form two iterations can be compared by. */
export function snapshot(project) {
  const arts = {}, params = {}, functions = {}, interfaces = {}, sides = {};
  for (const x of reviewItems(project)) arts[x.key] = x.sig;
  let total = 0, external = 0;
  for (const p of project.parts || []) {
    params[p.id] = Object.fromEntries(Object.entries(p.params || {}).filter(([, v]) => v && typeof v.value === "number").map(([k, v]) => [k, v.value]));
    if (p.function) functions[`part:${p.id}`] = String(p.function);
    for (const i of p.interfaces || []) { total++; if (i.external) external++; const k = i.key || `${p.id}/${i.id}`; let sig = i.type; try { sig = `${i.type}|${interfaceSignature(i)}`; } catch (e) { /* expressions : the type is enough */ }
      interfaces[k] = sig; (sides[k] = sides[k] || { A: 0, B: 0, ext: false })[i.side === "B" ? "B" : "A"]++; if (i.external) sides[k].ext = true; }
  }
  for (const b of project.boards || []) for (const f of b.functions || []) functions[`board:${b.id}:${f.id}`] = String(f.name || f.id);
  const paired = Object.values(sides).filter((s) => s.A && s.B).length, alone = Object.values(sides).filter((s) => !(s.A && s.B) && !s.ext).length, prog = reviewProgress(project);
  return { arts, params, functions, interfaces, metrics: { parts: (project.parts || []).length, assemblies: (project.assemblies || []).length, boards: (project.boards || []).length, joints: (project.assemblies || []).reduce((n, a) => n + (a.mates || []).length, 0),
    interfaces: total, paired, alone, external, functions: Object.keys(functions).length, reviewed: prog.ok, artefacts: prog.total } };
}
export function freeze(project, n, o = {}) {
  const it = iteration(project, n); if (!it) return null; if (it.closed) throw new Error(`${it.name} est close.`);
  it.frozen = iso(o.date); it.snapshot = snapshot(project); return it;
}
/** A frozen iteration goes back to work as long as no review was recorded on it. */
export function thaw(project, n) { const it = iteration(project, n); if (!it || it.closed || (it.reviews || []).length) return false; delete it.frozen; delete it.snapshot; return true; }

const axis = (a = {}, b = {}) => { const ka = Object.keys(a), kb = Object.keys(b), added = kb.filter((k) => !(k in a)).length, removed = ka.filter((k) => !(k in b)).length, changed = kb.filter((k) => k in a && a[k] !== b[k]).length, base = Math.max(ka.length, kb.length);
  return { added, removed, changed, same: kb.length - added - changed, total: kb.length, churn: base ? (added + removed + changed) / base : 0 }; };
/** What moved between two snapshots. churn : the share that was added, removed or changed (0 = nothing moved). */
export function convergence(prev, cur) {
  const shapes = axis(prev.arts, cur.arts), functions = axis(prev.functions, cur.functions), interfaces = axis(prev.interfaces, cur.interfaces);
  let total = 0, changed = 0, sum = 0;
  for (const [id, now] of Object.entries(cur.params || {})) { const was = (prev.params || {})[id]; if (!was) continue;
    for (const [k, v] of Object.entries(now)) { if (!(k in was)) continue; total++; if (Math.abs(v - was[k]) > 1e-9) { changed++; sum += Math.abs(v - was[k]) / Math.max(Math.abs(was[k]), 1e-9); } } }
  const dims = { changed, total, mean: changed ? sum / changed : 0, churn: total ? changed / total : 0 };
  return { shapes, dims, functions, interfaces, churn: (shapes.churn + dims.churn + functions.churn + interfaces.churn) / 4 };
}
/** The convergence of each frozen iteration against the one frozen before it, with its trend. */
export function trend(project) {
  const frozen = list(project).filter((x) => x.snapshot), out = [];
  for (let i = 1; i < frozen.length; i++) { const c = convergence(frozen[i - 1].snapshot, frozen[i].snapshot), before = out.length ? out.at(-1).c.churn : null;
    out.push({ n: frozen[i].n, from: frozen[i - 1].n, c, verdict: c.churn < 0.05 ? "stable" : before === null ? "first" : c.churn < before - 0.02 ? "converge" : c.churn > before + 0.02 ? "diverge" : "plateau" }); }
  return out;
}
export const TREND_FR = { stable: "Stable : presque plus rien ne bouge", first: "Premier écart mesuré", converge: "Converge : moins de changements qu'à l'itération d'avant", diverge: "Diverge : plus de changements qu'à l'itération d'avant", plateau: "Plateau : autant de changements qu'avant" };

/** What must be true before an iteration is closed. → [{ id, text, ok, value, blocking }] */
export function criteria(project, n) {
  const it = iteration(project, n); if (!it) return [];
  const live = snapshot(project), m = (it.closed && it.snapshot ? it.snapshot : live).metrics, prog = reviewProgress(project), acts = (it.reviews || []).flatMap((r) => r.actions || []), t = trend(project).find((x) => x.n === it.n);
  return [
    { id: "frozen", text: "L'itération est gelée", ok: !!it.frozen, value: it.frozen ? String(it.frozen).slice(0, 10) : "non", blocking: true },
    { id: "review", text: "Au moins une revue est consignée", ok: (it.reviews || []).length > 0, value: `${(it.reviews || []).length}`, blocking: true },
    { id: "reviewed", text: "Tous les artéfacts sont revus", ok: prog.total > 0 && prog.left === 0, value: `${prog.ok} / ${prog.total}` },
    { id: "revise", text: "Aucune demande de révision ouverte", ok: prog.revise === 0, value: `${prog.revise}` },
    { id: "draft", text: "Aucun brouillon d'IA non relu", ok: prog.draft === 0, value: `${prog.draft}` },
    { id: "paired", text: "Chaque interface interne a sa jumelle", ok: m.alone === 0, value: `${m.paired} appariée(s), ${m.alone} seule(s), ${m.external} externe(s)` },
    { id: "actions", text: "Les actions de revue sont closes", ok: acts.every((a) => a.done), value: `${acts.filter((a) => a.done).length} / ${acts.length}` },
    ...(t ? [{ id: "trend", text: "Le design converge", ok: t.verdict !== "diverge", value: `${pct(t.c.churn)} de changement depuis MVP ${t.from}` }] : []),
  ];
}

export function recordReview(project, n, o = {}) {
  const it = iteration(project, n); if (!it) return null; if (!it.frozen) throw new Error("Gelez l'itération avant d'y consigner une revue : la revue porte sur un état figé.");
  it.reviews = it.reviews || [];
  const r = { id: `R${it.reviews.length + 1}`, kind: REVIEW_MODES[o.kind] ? o.kind : "humans", title: o.title || GATES[it.gate], when: iso(o.date), who: String(o.who || ""), decision: DECISIONS[o.decision] ? o.decision : "conditional", notes: String(o.notes || ""),
    actions: (o.actions || []).map((a) => (typeof a === "string" ? { text: a, done: false } : { text: String(a.text || ""), done: !!a.done })).filter((a) => a.text) };
  it.reviews.push(r); return r;
}
export function toggleAction(project, n, rid, i) { const it = iteration(project, n), r = it && (it.reviews || []).find((x) => x.id === rid), a = r && r.actions[i]; if (!a) return false; a.done = !a.done; return true; }
export function closeIteration(project, n, decision, o = {}) {
  const it = iteration(project, n); if (!it) return null;
  const miss = criteria(project, n).filter((c) => c.blocking && !c.ok); if (miss.length) throw new Error(`${it.name} ne peut pas être close : ${miss.map((c) => c.text.toLowerCase()).join(" ; ")} — pas encore.`);
  it.closed = iso(o.date); it.decision = DECISIONS[decision] ? decision : "conditional"; return it;
}

const facts = (project, it) => { const m = (it.snapshot || snapshot(project)).metrics, t = trend(project).find((x) => x.n === it.n), out = [`${m.parts} pièce(s), ${m.assemblies} assemblage(s), ${m.boards} carte(s), ${m.joints} joint(s)`,
  `${m.interfaces} interface(s) : ${m.paired} paire(s), ${m.alone} interne(s) sans jumelle, ${m.external} externe(s)`, `${m.functions} fonction(s) nommée(s)`, `revue des artéfacts : ${m.reviewed} / ${m.artefacts}`];
  if (t) out.push(`depuis MVP ${t.from} — formes : ${t.c.shapes.added} ajoutée(s), ${t.c.shapes.removed} retirée(s), ${t.c.shapes.changed} modifiée(s) ; dimensions : ${t.c.dims.changed} / ${t.c.dims.total} cotes changées${t.c.dims.changed ? ` (${pct(t.c.dims.mean)} en moyenne)` : ""} ; fonctions : ${t.c.functions.added + t.c.functions.removed + t.c.functions.changed} changement(s) ; interfaces : ${t.c.interfaces.added + t.c.interfaces.removed + t.c.interfaces.changed} changement(s) — ${TREND_FR[t.verdict]}`);
  return out; };
/** What is put on the table for a review in front of colleagues : short, to read aloud. */
export function agenda(project, n) {
  const it = iteration(project, n); if (!it) return "";
  const notes = reviewItems(project).filter((x) => x.note);
  return [`${it.name} — ${GATES[it.gate]}`, `Objectif : ${it.goal || "à dire"}`, `Niveau visé : TRL ${it.trl} — ${TRL[it.trl][0]} (cible du projet : TRL ${mvpOf(project).target})`, "", "CE QUE L'ITÉRATION CONTIENT", ...facts(project, it).map((x) => `- ${x}`),
    "", "CE QUE LA REVUE DOIT TRANCHER", ...TRL[it.trl][1].map((q) => `- ${q}`), ...criteria(project, n).filter((c) => !c.ok && !c.blocking).map((c) => `- ${c.text} ? Aujourd'hui : ${c.value}.`),
    ...(notes.length ? ["", "NOTES DÉJÀ ÉCRITES", ...notes.map((x) => `- ${REVIEW_KINDS[x.kind]} ${x.id} : ${x.note}`)] : []), "", "DÉCISION : accepté · accepté avec réserves · à refaire — et les actions, chacune avec son porteur."].join("\n");
}
/** The detailed package an AI reviews : the frozen design as text (dwiz : given by the caller), the facts the platform computed, the
    questions of the level aimed, and the form of the answer the platform reads back. */
export function reviewPackage(project, n, o = {}) {
  const it = iteration(project, n); if (!it) return "";
  return [`Tu mènes la revue de conception de « ${project.name || "ce produit"} », itération ${it.name} (${GATES[it.gate]}).`,
    "Tu es un comité de revue exigeant : mécanique, électronique de puissance, fabrication, assemblage, sécurité électrique, essais. Tu lis TOUT le dossier, pièce par pièce, et tu cherches ce qui empêcherait d'atteindre le niveau visé.",
    "", `OBJECTIF DE L'ITÉRATION : ${it.goal || "non précisé"}`, `NIVEAU VISÉ : TRL ${it.trl} — ${TRL[it.trl][0]}. Cible du projet : TRL ${mvpOf(project).target}.`,
    "", "FAITS CALCULÉS PAR LA PLATEFORME (ne les recalcule pas, appuie-toi dessus) :", ...facts(project, it).map((x) => `- ${x}`), ...(o.facts || []).map((x) => `- ${x}`),
    "", "QUESTIONS DE CE NIVEAU :", ...TRL[it.trl][1].map((q) => `- ${q}`),
    "", "AXES À COUVRIR, DANS L'ORDRE : 1) les fonctions — chacune est-elle portée par une pièce, une carte ou un calcul ? 2) les formes et les dimensions — cohérentes entre pièces voisines ? 3) les interfaces — même clé, mêmes paramètres des deux côtés ; externes déclarées ? 4) la fabrication de chaque pièce avec son procédé ; 5) l'assemblage et son ordre ; 6) l'isolement électrique et la thermique ; 7) ce qui reste à prouver par l'essai.",
    "", "FORME DE TA RÉPONSE — un seul bloc, une ligne par constat, champs séparés par « | » :", "```revue", "constat | <repère de l'artéfact, ou projet> | <bloquant, majeur, mineur ou remarque> | <ce que tu constates, avec la valeur en cause> | <l'action proposée>", "decision | <accepté, accepté avec réserves ou à refaire> | <pourquoi, en une phrase>", "```",
    "Un constat par problème. N'invente aucun résultat d'analyse : si une preuve manque, écris-le comme un constat. Ne réécris pas le design : la révision se fera ensuite, artéfact par artéfact.",
    "", "LE DOSSIER :", o.dwiz || "(joindre le projet exporté en .dwiz)"].join("\n");
}
/** Reads the answer of an AI review. → { findings: [{ target, severity, text, action }], decision, why, problems } */
export function readReviewAnswer(text) {
  const src = String(text || ""), block = /```\s*revue\s*\n([\s\S]*?)```/i.exec(src), body = block ? block[1] : src, findings = [], problems = []; let decision = null, why = "";
  for (const raw of body.split("\n")) {
    const f = raw.split("|").map((x) => x.trim()), head = (f[0] || "").toLowerCase().replace(/^[-*\s]+/, "");
    if (head === "constat" && f.length >= 4) { const sev = (f[2] || "").toLowerCase(); if (!(sev in SEVERITIES)) problems.push(`Gravité inconnue « ${f[2]} » : lue comme une remarque.`);
      findings.push({ target: f[1] || "projet", severity: sev in SEVERITIES ? sev : "remarque", text: f[3], action: f[4] || "" }); }
    else if (head === "decision" || head === "décision") { const d = (f[1] || "").toLowerCase(); decision = /refaire/.test(d) ? "redo" : /réserve|reserve/.test(d) ? "conditional" : /accept/.test(d) ? "go" : null; why = f[2] || ""; if (!decision) problems.push(`Décision illisible « ${f[1]} ».`); }
  }
  if (!findings.length && !decision) problems.push("Aucun constat ni décision trouvés : la réponse doit contenir un bloc ```revue.");
  return { findings, decision, why, problems };
}
/** Applies an AI review the engineer accepted : a review on the iteration, an action per finding that asks for one, and a
    request for revision on each artefact a blocking or major finding names. → { review, actions, asked } */
export function applyReview(project, n, parsed, o = {}) {
  const byId = new Map(reviewItems(project).map((x) => [x.id.toLowerCase(), x.key])), heavy = parsed.findings.filter((f) => SEVERITIES[f.severity] >= 2); let asked = 0;
  const blocking = parsed.findings.some((f) => f.severity === "bloquant"), decision = parsed.decision || (blocking ? "redo" : heavy.length ? "conditional" : "go");
  const review = recordReview(project, n, { kind: "ai", title: o.title, who: o.who || "assistant IA, relu par l'ingénieur", decision, date: o.date, notes: [parsed.why, ...parsed.findings.filter((f) => SEVERITIES[f.severity] < 2).map((f) => `${f.target} — ${f.severity} : ${f.text}`)].filter(Boolean).join("\n"),
    actions: heavy.map((f) => `${f.target} — ${f.severity} : ${f.action || f.text}`) });
  const notes = new Map();
  for (const f of heavy) { const key = byId.get(String(f.target).toLowerCase()); if (key) notes.set(key, [...(notes.get(key) || []), f.action ? `${f.text} → ${f.action}` : f.text]); }
  for (const [key, t] of notes) if (askRevision(project, key, t.join(" ; "))) asked++;
  return { review, actions: review.actions.length, asked };
}
/** Rows for the report : one per iteration. */
export function mvpRows(project) {
  const T = new Map(trend(project).map((t) => [t.n, t]));
  return list(project).map((it) => [it.name, it.goal || "—", `TRL ${it.trl}`, GATES[it.gate], it.frozen ? String(it.frozen).slice(0, 10) : "—", (it.reviews || []).map((r) => `${r.id} ${r.kind === "ai" ? "IA" : "collègues"} : ${DECISIONS[r.decision].fr.toLowerCase()}`).join(" ; ") || "—",
    T.has(it.n) ? `${pct(T.get(it.n).c.churn)} — ${TREND_FR[T.get(it.n).verdict].split(" :")[0]}` : "—", it.closed ? DECISIONS[it.decision].fr : stateLabel(it)]);
}
