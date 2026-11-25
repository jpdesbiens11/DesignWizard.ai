/* DynamiteOrbit.ai — the REQUIREMENTS of the product, for every discipline (demande de JP, 25 novembre 2026 : « ajouter le même genre de page
   Exigences 1. dans Mécanique et Électronique au même titre qu'on l'a dans Logiciel… faire concevoir l'IA basé sur les requis de DynamiteAgile
   au format requis dans cet outil… le format de DynamiteAgile sera éventuellement utilisé mec, elec et soft et tout le reste »).
   ONE list per product, read from the export of DynamiteAgile (Goldmine, « Exporter (.csv) ») AS IT IS : every column kept, so that it goes
   back to DynamiteAgile unchanged but for its « allocation » — the disciplines that carry each requirement. A need (kind Need) is the why ;
   a requirement (kind Requirement) derives from needs (« derived_from »). Where the list does not allocate a requirement, the tool PROPOSES
   the disciplines from its words — an example, to confirm, as every value the tool invents. Pure : no page. */

import { csvRows } from "../sw/sw_req_import.js";

/** The columns of a DynamiteAgile export, in its order — the format of reference (file of the DEMO project, 25 novembre 2026). */
export const AGILE_COLUMNS = ["key", "external_id", "kind", "stakeholder", "derived_from", "title", "statement", "status", "source", "source_doc", "category", "lifecycle", "criticality",
  "verification_method", "acceptance_criteria", "allocation", "verification_ref", "test_ref", "test_source", "functions", "need_status", "revision", "received_at", "rationale",
  "client_summary", "implemented_by", "updated_at", "last_change"];
export const DISCIPLINES = [
  { id: "mech", label: "Mechanical", fr: "Mécanique", short: "M", color: "#2563eb", icon: "part", screen: "mreq" },
  { id: "elec", label: "Electronics", fr: "Électronique", short: "E", color: "#16a34a", icon: "chip", screen: "ereq" },
  { id: "sw", label: "Software", fr: "Logiciel", short: "L", color: "#0891b2", icon: "code", screen: "swreq" },
];
/** The categories of DynamiteAgile : a colour and a pictogram each (the list is grouped by them). */
export const CATEGORIES = {
  Functional: { fr: "Fonction", color: "#2563eb", icon: "flow" }, Performance: { fr: "Performance", color: "#ea580c", icon: "bolt" }, Safety: { fr: "Sécurité", color: "#dc2626", icon: "warning" },
  "Personnel Safety": { fr: "Sécurité des personnes", color: "#b91c1c", icon: "warning" }, Environmental: { fr: "Environnement", color: "#0d9488", icon: "sensor" },
  "Standard / Regulatory": { fr: "Normes et règlements", color: "#475569", icon: "report" }, Interface: { fr: "Interface", color: "#7c3aed", icon: "link" },
};
export const categoryOf = (c) => CATEGORIES[c] || { fr: c || "Autre", color: "#64748b", icon: "info" };
/** What the letters of « verification_method » mean (DynamiteAgile : T, D, A, I). */
export const VERIFY = { T: { label: "Test", fr: "Essai" }, D: { label: "Demonstration", fr: "Démonstration" }, A: { label: "Analysis", fr: "Analyse" }, I: { label: "Inspection", fr: "Inspection" } };
/** Criticality A (highest) to D. */
export const CRIT = { A: "#dc2626", B: "#ea580c", C: "#ca8a04", D: "#64748b" };

/* the words that propose a discipline when the list does not say — French and English, as a DynamiteAgile list is written */
const WORDS = {
  mech: /\b(chute|choc|vibration|roue|pièce|arête|mouvement|engrenage|tournevis|matéria|marche|gazon|gravier|trottoir|ipx|éclabouss|étanch|boîtier|masse|poids|dimension|fixation|vis\b|coût des pièces|doigt d'essai|drop|wheel|housing|enclosure|mechanical|mass|weight)/i,
  elec: /\b(batter|tension|voltage|courant|émission|radio|wi-?fi|rohs|électroni|ipx|éclabouss|capteur|sensor|obstacle|moteur|motor|alimentation|emergency stop|bouton|power|charge|accumulateur|lithium|pile|schéma|coût des pièces|autonomie|fcc|ic\b|classe b)/i,
  sw: /\b(application|logiciel|software|firmware|affich|liaison|perdue|code|navigateur|rafraîch|telemetry|décision|contourner|détecter|vitesse|prêt à rouler|surveill|watchdog|alerte|reprendre son cap|s'arrêter)/i,
};
const ALLOC = { mech: /\b(mech|méca|mecha)/i, elec: /\b(elec|élec|hw|hardware|pcb)/i, sw: /\b(sw|software|logiciel|firmware|fw|embedded|embarqu)/i };

/** Reads an export of DynamiteAgile. → { ok, list?: { head, rows }, errors: [text] } — rows keep every column, in its order. */
export function readAgile(text) {
  const rows = csvRows(text); if (rows.length < 2) return { ok: false, errors: ["Le fichier est vide, ou ce n'est pas un .csv."] };
  const head = rows[0].map((h) => String(h).trim()), low = head.map((h) => h.toLowerCase());
  if (!low.includes("statement") || !(low.includes("key") || low.includes("external_id"))) return { ok: false, errors: ["Ce n'est pas un export de DynamiteAgile : les colonnes « key » et « statement » manquent."] };
  const list = rows.slice(1).map((r) => Object.fromEntries(low.map((h, i) => [h, String(r[i] ?? "").trim()]))).filter((r) => r.statement || r.title);
  return { ok: list.length > 0, list: { head: low, rows: list }, errors: list.length ? [] : ["Aucune ligne n'a d'énoncé."] };
}
export const isNeed = (r) => /^need$/i.test(r.kind || "");
export const keyOf = (r) => r.key || r.external_id;
/** The disciplines of a requirement : the « allocation » column when it says, otherwise proposed from its words. → { mech, elec, sw, said } */
export function proposeAlloc(r) {
  const a = r.allocation || "", said = Object.values(ALLOC).some((x) => x.test(a));
  if (said) return { mech: ALLOC.mech.test(a), elec: ALLOC.elec.test(a), sw: ALLOC.sw.test(a), said: true };
  const t = `${r.title} ${r.statement} ${r.acceptance_criteria} ${r.rationale} ${r.source_doc}`, out = { mech: WORDS.mech.test(t), elec: WORDS.elec.test(t), sw: WORDS.sw.test(t), said: false };
  if (!out.mech && !out.elec && !out.sw) out.mech = out.elec = out.sw = true;      // nothing to go by : every discipline, to sort by hand
  return out;
}
/** The product's list as the project keeps it : the rows, and for each requirement its disciplines and whether a person confirmed them. */
export function makeReqs(list, file = "") {
  const alloc = {}; for (const r of list.rows) if (!isNeed(r)) { const p = proposeAlloc(r); alloc[keyOf(r)] = { mech: p.mech, elec: p.elec, sw: p.sw, sure: p.said }; }
  return { from: "DynamiteAgile", file, head: list.head, rows: list.rows, alloc };
}
/** The requirements of a discipline (each with its alloc), and the needs they derive from. */
export function forDiscipline(R, disc) {
  if (!R) return { needs: [], reqs: [] };
  const reqs = R.rows.filter((r) => !isNeed(r) && R.alloc[keyOf(r)] && R.alloc[keyOf(r)][disc]);
  const needs = R.rows.filter(isNeed).filter((n) => reqs.some((r) => parentsOf(R, r).includes(n)));
  return { needs, reqs };
}
/** The needs a requirement derives from. « derived_from » may carry another prefix than the keys (an export renumbered : DEMO-16 for
    DEMO2-16) : the same number then, and it is said by `loose`. */
export function parentsOf(R, r) {
  const ids = String(r.derived_from || "").split(/[,;]\s*/).filter(Boolean), num = (s) => (String(s).match(/(\d+)$/) || [])[1];
  return ids.map((id) => R.rows.find((x) => keyOf(x) === id || x.external_id === id) || R.rows.find((x) => isNeed(x) && num(keyOf(x)) === num(id))).filter(Boolean);
}
/** The allocation column, as written back to DynamiteAgile. */
export const allocText = (a) => DISCIPLINES.filter((d) => a && a[d.id]).map((d) => d.label).join(", ");
/** Back to DynamiteAgile : every column as read, the allocation filled. `only` : the rows of one discipline (and their needs). */
export function toAgileCsv(R, only = null) {
  const head = R.head && R.head.length ? R.head : AGILE_COLUMNS, keep = only ? new Set([...only.needs, ...only.reqs]) : null, q = (v) => (/[",\n;]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [head.join(",")]; for (const r of R.rows) { if (keep && !keep.has(r)) continue; const a = R.alloc[keyOf(r)]; lines.push(head.map((h) => q(h === "allocation" && a ? allocText(a) : r[h] ?? "")).join(",")); }
  return `﻿${lines.join("\r\n")}\r\n`;
}
/** What is missing or odd, for the guide (levels of core/guide.js). */
export function reqsGuide(R, disc) {
  if (!R) return [{ level: "todo", text: "Importez la liste d'exigences du produit : l'export .csv de DynamiteAgile (Goldmine → Exporter)." }];
  const { reqs } = forDiscipline(R, disc), out = [], guess = reqs.filter((r) => !R.alloc[keyOf(r)].sure);
  if (!reqs.length) out.push({ level: "warn", text: `Aucune exigence n'est allouée à la ${DISCIPLINES.find((d) => d.id === disc).fr.toLowerCase()} : vérifiez l'allocation des exigences du produit.` });
  if (guess.length) out.push({ level: "warn", text: `${guess.length} exigence${guess.length > 1 ? "s" : ""} : la discipline est proposée par l'outil d'après les mots — confirmez-la.`, keys: guess.map(keyOf) });
  for (const r of reqs) { if (!r.verification_method) out.push({ level: "todo", text: `${keyOf(r)} : comment la prouver ? (essai, démonstration, analyse, inspection)`, key: keyOf(r) });
    if (!r.acceptance_criteria) out.push({ level: "tip", text: `${keyOf(r)} : un critère d'acceptation dit quand elle est tenue.`, key: keyOf(r) }); }
  return out;
}
/** The prompt that asks an assistant to DESIGN the discipline from its requirements — the needs and the requirements as DynamiteAgile writes
    them, and what to give back, in the format this tool reads (the door « Avec l'IA » : a .dwiz or its JSON). */
export function designPrompt(R, disc, project = {}) {
  const D = DISCIPLINES.find((d) => d.id === disc), { needs, reqs } = forDiscipline(R, disc), row = (r) => `- ${keyOf(r)}${r.external_id && r.external_id !== keyOf(r) ? ` (${r.external_id})` : ""} [${r.category || "—"}${r.criticality ? `, criticité ${r.criticality}` : ""}${r.verification_method ? `, preuve ${r.verification_method}` : ""}] ${r.statement}${r.acceptance_criteria ? `\n  Critère d'acceptation : ${r.acceptance_criteria}` : ""}${r.rationale ? `\n  Pourquoi : ${r.rationale}` : ""}`;
  const what = { mech: "les pièces et l'assemblage : pour chaque pièce, sa nature (usinée, moulée, tôle, impression 3D, achetée), sa matière, ses cotes principales et ses interfaces ; l'assemblage qui les monte", elec: "les cartes : pour chaque carte, ses fonctions et ses blocs (alimentation, capteurs, commande des moteurs, liaisons), ses connecteurs et son contour", sw: "le logiciel : ses blocs et leurs liaisons" }[disc];
  return [`Tu conçois la partie ${D.fr.toLowerCase()} (${D.label}) du produit « ${project.name || "sans nom"} » dans DynamiteOrbit.ai, À PARTIR DE SES EXIGENCES. Elles viennent de DynamiteAgile ; les clés (${reqs.slice(0, 2).map(keyOf).join(", ")}…) sont stables : cite-les.`,
    "", "## Les besoins (le pourquoi)", ...needs.map(row), "", `## Les exigences allouées à la ${D.fr.toLowerCase()}`, ...reqs.map(row), "",
    "## Ce que tu rends", `Propose ${what}.`,
    "Pour chaque élément, la liste des clés d'exigences qu'il tient (`req: [\"…\"]`) ; une exigence que rien ne tient, dis-le.",
    "Réponds par UN bloc ```json``` au format de DynamiteOrbit.ai (un .dwiz : `parts`, `assemblies`, `boards`) ; l'outil le relit par la porte « Avec l'IA », montre ce qui serait créé, et attend qu'une personne l'applique.",
    "Une valeur que tu choisis sans qu'une exigence la donne est un EXEMPLE : écris-la, et dis-le. N'invente aucune référence de fabricant."].join("\n");
}
