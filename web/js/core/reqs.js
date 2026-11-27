/* DynamiteOrbit.ai — the REQUIREMENTS of the product, for every discipline (demande de JP, 25 novembre 2026 : « ajouter le même genre de page
   Exigences 1. dans Mécanique et Électronique au même titre qu'on l'a dans Logiciel… faire concevoir l'IA basé sur les requis de DynamiteAgile
   au format requis dans cet outil… le format de DynamiteAgile sera éventuellement utilisé mec, elec et soft et tout le reste »).
   ONE list per product, read from the export of DynamiteAgile (Goldmine, « Exporter (.csv) ») AS IT IS : every column kept, so that it goes
   back to DynamiteAgile unchanged but for its « allocation » — the disciplines that carry each requirement. A need (kind Need) is the why ;
   a requirement (kind Requirement) derives from needs (« derived_from »). Where the list does not allocate a requirement, the tool PROPOSES
   the disciplines from its words — an example, to confirm, as every value the tool invents.
   A DRAFT, then the final version (JP, 27 novembre 2026 : « je vais aller loader en mode brouillon au début ; après, des itérations, on les envoie
   dans DynamiteAgile ; une fois terminés, on les exporte, on les ramène pour vraiment faire la structure du produit ») : the maturity of a line is
   its status in the Requirement Workflow of Goldmine — before « Accepted », a draft ; « Rejected », « Obsolete », out —, and the list is a draft
   while one live line is. A list read again is MERGED : each line found by its key, else by its external id (a draft made outside DynamiteAgile
   has no key until DynamiteAgile gives one), what changes said before it is applied, the allocations kept. Pure : no page. */


import { csvRows, reqPrompt } from "../sw/sw_req_import.js";

/** The columns of a DynamiteAgile export, in its order — the format of reference (file of the DEMO project, 25 novembre 2026). */
export const AGILE_COLUMNS = ["key", "external_id", "kind", "stakeholder", "derived_from", "title", "statement", "status", "source", "source_doc", "category", "lifecycle", "criticality",
  "verification_method", "acceptance_criteria", "allocation", "verification_ref", "test_ref", "test_source", "functions", "need_status", "revision", "received_at", "rationale",
  "client_summary", "implemented_by", "updated_at", "last_change"];
export const DISCIPLINES = [
  { id: "mech", label: "Mechanical", fr: "Mécanique", to: "à la mécanique", the: "la mécanique", short: "M", color: "#2563eb", icon: "part", screen: "mreq" },
  { id: "elec", label: "Electronics", fr: "Électronique", to: "à l'électronique", the: "l'électronique", short: "E", color: "#16a34a", icon: "chip", screen: "ereq" },
  { id: "sw", label: "Software", fr: "Logiciel", to: "au logiciel", the: "le logiciel", short: "L", color: "#0891b2", icon: "code", screen: "lreq" },
];
/** The columns of DynamiteAgile in French, as the screens say them. */
export const COLUMN_FR = { key: "Clé", external_id: "Identifiant", kind: "Nature", stakeholder: "Partie prenante", derived_from: "Dérivée de", title: "Titre", statement: "Énoncé", status: "Statut",
  source: "Source", source_doc: "Document source", category: "Catégorie", lifecycle: "Cycle de vie", criticality: "Criticité", verification_method: "Preuve", acceptance_criteria: "Critère d'acceptation",
  allocation: "Allocation", verification_ref: "Référence de vérification", test_ref: "Essai", test_source: "Source de l'essai", functions: "Fonctions", need_status: "Statut du besoin", revision: "Révision",
  received_at: "Reçue le", rationale: "Pourquoi", client_summary: "Résumé client", implemented_by: "Réalisée par", updated_at: "Mise à jour", last_change: "Dernier changement" };
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
  mech: /\b(chute|choc|vibration|roue|pièce|arête|mouvement|engrenage|tournevis|matéria|marche|gazon|gravier|trottoir|ipx|éclabouss|étanch|boîtier|masse|poids|dimension|fixation|vis\b|coût des pièces|doigt d'essai|drop|wheel|housing|enclosure|mechanical|mass|weight|poignée|cavité|glisser|verrouill|démont|propagation|refroidiss|busbar|connecteur|plastique)/i,
  elec: /\b(batter|tension|voltage|courant|émission|radio|wi-?fi|rohs|électroni|ipx|éclabouss|capteur|sensor|obstacle|moteur|motor|alimentation|emergency stop|bouton|power|charge|accumulateur|lithium|pile|schéma|coût des pièces|autonomie|fcc|ic\b|classe b|contactor|cell\b|cells\b|thermistor|rs-485|can\b|isol|hipot|précharge|fusible|bms\b)/i,
  sw: /\b(application|logiciel|software|firmware|affich|liaison|perdue|code|navigateur|rafraîch|telemetry|décision|contourner|détecter|vitesse|prêt à rouler|surveill|watchdog|alerte|reprendre son cap|s'arrêter|derated|emergency|shutdown|acquitt|journal|soc\b|soh\b|do-178)/i,
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

/* ---------- a draft, then the final version : the Requirement Workflow of Goldmine (DynamiteAgile, modules/agile/goldmine.py STATUSES) ---------- */
/** The statuses of a line, in the order of the workflow, and what each is here : a draft (received, analysed, a question to the customer), firm
    (accepted and after), out (rejected, obsolete). */
export const FLOW = [["Received", "draft"], ["In Analysis", "draft"], ["Customer Clarification", "draft"], ["Accepted", "firm"], ["Allocated", "firm"], ["Implemented", "firm"],
  ["In Verification", "firm"], ["Verified", "firm"], ["Rejected", "out"], ["Obsolete", "out"]];
const FLOW_OF = new Map(FLOW.map(([s, m]) => [s.toLowerCase(), m]));
/** The maturity of a line : « draft » before « Accepted » (and a line without status : not yet in DynamiteAgile), « out » rejected or obsolete,
    « firm » otherwise (a status of another workflow is DynamiteAgile's word : firm). */
export function maturityOf(r) { const s = String((r && r.status) || "").trim(); return FLOW_OF.get(s.toLowerCase()) || (s ? "firm" : "draft"); }
/** A value nobody has decided yet, in the statement or the acceptance criteria : TBD (to be determined), TBC (to be confirmed), « à définir ». */
export const hasTbd = (r) => /\bTB[DC]\b|à définir/i.test(`${(r && r.statement) || ""} ${(r && r.acceptance_criteria) || ""}`);
export const STAGES = {
  draft: { fr: "Brouillon", label: "Draft", color: "#d97706", icon: "edit", says: "Les exigences s'itèrent encore : des lignes sont Received, In Analysis ou Customer Clarification dans DynamiteAgile." },
  final: { fr: "Version finale", label: "Baseline", color: "#16a34a", icon: "check", says: "Toutes les exigences en vigueur sont acceptées dans DynamiteAgile : la structure du produit se bâtit sur elles." },
};
/** Where the list stands. → { stage ("draft" | "final"), draft, firm, out, tbd, live, draftKeys, tbdKeys } */
export function stageOf(R) {
  const rows = (R && R.rows) || [], live = rows.filter((r) => maturityOf(r) !== "out"), draft = live.filter((r) => maturityOf(r) === "draft"), tbd = live.filter(hasTbd);
  return { stage: draft.length || !live.length ? "draft" : "final", draft: draft.length, firm: live.length - draft.length, out: rows.length - live.length, tbd: tbd.length, live: live.length, draftKeys: draft.map(keyOf), tbdKeys: tbd.map(keyOf) };
}
/** One reading of the list, for the trail of its iterations. */
export function loadOf(R, file = "", when = "") { const S = stageOf(R); return { file, when, stage: S.stage, rows: R.rows.length, draft: S.draft, tbd: S.tbd }; }
/* ---------- read again : an export of DynamiteAgile merged into the list the project holds ---------- */
const NOISE = new Set(["key", "updated_at", "last_change", "implemented_by", "test_source"]);      // the key is said apart (DynamiteAgile gives it) ; the clock and the stamp change at every touch ; « test_source » is written by Goldmine from « test_ref »
const sameCell = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();
/** What a new reading does to the list : each line found by its key, else by its external id. → { added: [row], removed: [row], changed: [{ key,
    was, row, fields: [{ h, from, to }] }], keyed: [{ from, to }] (the keys DynamiteAgile gave), same (lines unchanged), pairs: [[old, new]] } */
export function mergePlan(R, list) {
  const old = (R && R.rows) || [], used = new Set(), low = (v) => String(v || "").trim().toLowerCase(), out = { added: [], removed: [], changed: [], keyed: [], same: 0, pairs: [] };
  const find = (r) => old.find((o) => !used.has(o) && ((low(r.key) && low(o.key) === low(r.key)) || (low(r.external_id) && low(o.external_id) === low(r.external_id))));
  const head = [...new Set([...(list.head || []), ...((R && R.head) || [])])];
  for (const r of list.rows) {
    const o = find(r); if (!o) { out.added.push(r); continue; }
    used.add(o); out.pairs.push([o, r]); if (keyOf(o) !== keyOf(r)) out.keyed.push({ from: keyOf(o), to: keyOf(r) });
    const fields = head.filter((h) => !NOISE.has(h) && !sameCell(o[h], r[h])).map((h) => ({ h, from: o[h] ?? "", to: r[h] ?? "" }));
    if (fields.length) out.changed.push({ key: keyOf(r), was: keyOf(o), row: r, fields }); else out.same++;
  }
  out.removed = old.filter((o) => !used.has(o));
  return out;
}
/** The list read again : the lines of the new reading ; an allocation the new file does not say is kept from the line it was (confirmed or not) ;
    the trail of the readings grows by one. → { R, plan } */
export function mergeReqs(R, list, file = "", when = "") {
  const plan = mergePlan(R, list), next = makeReqs(list, file, when), was = new Map(plan.pairs.map(([o, r]) => [r, o]));
  for (const r of list.rows) { const o = was.get(r); if (isNeed(r) || !o || proposeAlloc(r).said || !R.alloc[keyOf(o)]) continue; next.alloc[keyOf(r)] = { ...R.alloc[keyOf(o)] }; }
  /* the reading a person confirmed (core/req_oracle.js) follows its line — unless the statement changed : then it is to read again */
  plan.reread = [];
  for (const [o, r] of plan.pairs) { const kept = R && R.oracles && R.oracles[keyOf(o)]; if (!kept) continue;
    if (kept.statement === (r.statement || "")) (next.oracles = next.oracles || {})[keyOf(r)] = kept; else plan.reread.push(keyOf(r)); }
  next.loads = [...((R && R.loads) || []), ...next.loads];
  return { R: next, plan };
}
/** The disciplines of a requirement : the « allocation » column when it says, otherwise proposed from its words. → { mech, elec, sw, said } */
export function proposeAlloc(r) {
  const a = r.allocation || "", said = Object.values(ALLOC).some((x) => x.test(a));
  if (said) return { mech: ALLOC.mech.test(a), elec: ALLOC.elec.test(a), sw: ALLOC.sw.test(a), said: true };
  const t = `${r.title} ${r.statement} ${r.acceptance_criteria} ${r.rationale} ${r.source_doc}`, out = { mech: WORDS.mech.test(t), elec: WORDS.elec.test(t), sw: WORDS.sw.test(t), said: false };
  if (!out.mech && !out.elec && !out.sw) out.mech = out.elec = out.sw = true;      // nothing to go by : every discipline, to sort by hand
  return out;
}
/** The product's list as the project keeps it : the rows, and for each requirement its disciplines and whether a person confirmed them. */
export function makeReqs(list, file = "", when = "") {
  const alloc = {}; for (const r of list.rows) if (!isNeed(r)) { const p = proposeAlloc(r); alloc[keyOf(r)] = { mech: p.mech, elec: p.elec, sw: p.sw, sure: p.said }; }
  const R = { from: "DynamiteAgile", file, head: list.head, rows: list.rows, alloc };
  R.loads = [loadOf(R, file, when)]; return R;
}
/** The requirements of a discipline (each with its alloc), and the needs they derive from. */
export function forDiscipline(R, disc) {
  if (!R) return { needs: [], reqs: [] };
  const reqs = R.rows.filter((r) => !isNeed(r) && maturityOf(r) !== "out" && R.alloc[keyOf(r)] && R.alloc[keyOf(r)][disc]);
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
  if (!reqs.length) out.push({ level: "warn", text: `Aucune exigence n'est allouée ${DISCIPLINES.find((d) => d.id === disc).to} : vérifiez l'allocation des exigences du produit.` });
  if (guess.length) out.push({ level: "warn", text: `${guess.length} exigence${guess.length > 1 ? "s" : ""} : la discipline est proposée par l'outil d'après les mots — confirmez-la.`, keys: guess.map(keyOf) });
  const S = stageOf(R);
  if (S.stage === "draft") out.push({ level: "tip", text: `Brouillon : ${S.draft} ligne${S.draft > 1 ? "s" : ""} avant « Accepted » dans DynamiteAgile. Envoyez la liste (« Vers DynamiteAgile »), itérez-la là-bas, puis relisez l'export de Goldmine : la structure du produit se bâtit sur la version finale.`, keys: S.draftKeys });
  for (const r of reqs) if (hasTbd(r)) out.push({ level: "todo", text: `${keyOf(r)} : une valeur est à définir (TBD) — à fixer dans DynamiteAgile.`, key: keyOf(r) });
  for (const r of reqs) { if (!r.verification_method) out.push({ level: "todo", text: `${keyOf(r)} : comment la prouver ? (essai, démonstration, analyse, inspection)`, key: keyOf(r) });
    if (!r.acceptance_criteria) out.push({ level: "tip", text: `${keyOf(r)} : un critère d'acceptation dit quand elle est tenue.`, key: keyOf(r) }); }
  return out;
}
/* a draft is not designed : it is tried — the answer serves to iterate the requirements, not yet to fix the structure of the product */
function draftNote(R) {
  const S = stageOf(R); if (S.stage !== "draft") return [];
  return ["## Attention : un BROUILLON", `Ces exigences sont en brouillon dans DynamiteAgile (${S.draft} ligne${S.draft > 1 ? "s" : ""} avant « Accepted »${S.tbd ? `, ${S.tbd} valeur${S.tbd > 1 ? "s" : ""} TBD` : ""}). Propose une ÉBAUCHE qui les éprouve : dis ce qui manque, ce qui se contredit, et propose une valeur pour chaque TBD, avec sa raison — ta réponse sert à itérer les exigences dans DynamiteAgile, pas encore à fixer la structure du produit.`, ""];
}
/** The prompt that asks an assistant to DESIGN the discipline from its requirements — the needs and the requirements as DynamiteAgile writes
    them, and what to give back, in the format this tool reads (the door « Avec l'IA » : a .dwiz or its JSON). */
export function designPrompt(R, disc, project = {}) {
  const D = DISCIPLINES.find((d) => d.id === disc), { needs, reqs } = forDiscipline(R, disc), row = (r) => `- ${keyOf(r)}${r.external_id && r.external_id !== keyOf(r) ? ` (${r.external_id})` : ""} [${r.category || "—"}${r.criticality ? `, criticité ${r.criticality}` : ""}${r.verification_method ? `, preuve ${r.verification_method}` : ""}] ${r.statement}${r.acceptance_criteria ? `\n  Critère d'acceptation : ${r.acceptance_criteria}` : ""}${r.rationale ? `\n  Pourquoi : ${r.rationale}` : ""}`;
  const what = { mech: "les pièces et l'assemblage : pour chaque pièce, sa nature (usinée, moulée, tôle, impression 3D, achetée), sa matière, ses cotes principales et ses interfaces ; l'assemblage qui les monte", elec: "les cartes : pour chaque carte, ses fonctions et ses blocs (alimentation, capteurs, commande des moteurs, liaisons), ses connecteurs et son contour", sw: "le logiciel : ses blocs et leurs liaisons" }[disc];
  return [`Tu conçois la partie ${D.fr.toLowerCase()} (${D.label}) du produit « ${project.name || "sans nom"} » dans DynamiteOrbit.ai, À PARTIR DE SES EXIGENCES. Elles viennent de DynamiteAgile ; les clés (${reqs.slice(0, 2).map(keyOf).join(", ")}…) sont stables : cite-les.`,
    "", "## Les besoins (le pourquoi)", ...needs.map(row), "", `## Les exigences allouées ${D.to}`, ...reqs.map(row), "",
    ...draftNote(R), "## Ce que tu rends",
    ...(disc === "sw" ? ["Les exigences ci-dessus sont celles du PRODUIT allouées au logiciel : convertis-les au format standard du Logiciel de DynamiteOrbit.ai, décrit ci-dessous — une exigence par clé citée (`id` = la clé), son bloc, ses valeurs, ses entrées et ses sorties. L'outil relit ta réponse par le bouton « IA » du Logiciel (« Coller la réponse »), montre les blocs qu'il poserait, et attend qu'une personne l'applique.", "", reqPrompt()]
      : [`Propose ${what}.`, "Pour chaque élément, la liste des clés d'exigences qu'il tient (`req: [\"…\"]`) ; une exigence que rien ne tient, dis-le.",
        "Réponds par UN bloc ```json``` au format de DynamiteOrbit.ai (un .dwiz : `parts`, `assemblies`, `boards`) ; l'outil le relit par la porte « Avec l'IA », montre ce qui serait créé, et attend qu'une personne l'applique."]),
    "Une valeur que tu choisis sans qu'une exigence la donne est un EXEMPLE : écris-la, et dis-le. N'invente aucune référence de fabricant."].join("\n");
}
