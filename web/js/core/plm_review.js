/* DynamiteOrbit.ai — from a FROZEN revision to a RELEASED one (demande de JP : « "Libérer" doit être "Geler la révision"… le
   gel a besoin d'un approbateur et d'un cycle de revue de conception (lean) pour justifier et tracer le passage à
   "libérée" — l'état final d'un composant ou d'un assemblage gelé, par convention de l'industrie… on doit voir
   facilement l'état et le nom de la révision »).
   Freezing (core/plm.js) gives an item its number and fixes its content : that revision never changes again. It is not
   yet RELEASED : a lean design review decides. The choices of JP (menu, 20 November 2026) :
     - the approver is SOMEONE ELSE than the author of the revision ;
     - the review is a short list the tool fills itself where it can check — the frozen content is intact, every part an
       assembly holds is itself released, the electrical and fabrication rules of a board, what the screen measured (the DFx of
       a part, whether an assembly builds) — and the approver confirms the rest, writes the decision and the open points ;
     - once frozen, NOTHING changes : any change opens the next revision.
   A review ends in « libérée » or « refusée » ; a refused revision stays in the record, with the reason — the work goes on
   and the next freeze takes the next revision. Nothing is erased, nothing is decided by the tool : it prepares the list.
   Pure : no page. The caller applies decide() inside one undoable step. */

import { signature } from "./review.js";
import { releases } from "./plm.js";

/** The states of a revision : label (what the screens write), en, a tone, a pictogram, what it means. */
export const REV_STATES = {
  working: { label: "En travail", en: "In work", tone: "neutral", icon: "edit", color: "#64748b", text: "Le projet bouge encore : rien n'est figé." },
  frozen: { label: "Gelée", en: "Frozen", tone: "warn", icon: "lock", color: "#b45309", text: "Son contenu est figé sous un numéro et une révision. Elle attend sa revue de conception." },
  released: { label: "Libérée", en: "Released", tone: "ok", icon: "check", color: "#16a34a", text: "Revue et approuvée par quelqu'un d'autre que son auteur : c'est l'état final d'une révision." },
  rejected: { label: "Refusée", en: "Rejected", tone: "danger", icon: "cross", color: "#dc2626", text: "La revue ne l'a pas libérée ; elle reste au dossier, avec la raison. La suite se fait dans la révision suivante." },
};
/** The state of a revision in the record. One frozen before the review existed waits for its review, like any other. */
export const stateOf = (rec) => (rec && REV_STATES[rec.state] && rec.state !== "working" ? rec.state : "frozen");
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const recOf = (project, pn, rev) => releases(project).find((r) => r.pn === pn && r.rev === rev) || null;

/** Where an item of the project stands : its latest revision in the record, and whether the project moved on since.
    → { name ("PRT-… rév. B", or "sans numéro"), state ("working" | "frozen" | "released" | "rejected"), rec, moved (the item changed since that revision) } */
export function revisionOf(project, key, artefact) {
  const d = artefact || null, mine = releases(project).filter((r) => r.key === key), rec = mine.at(-1) || null;
  if (!rec) return { name: "sans numéro", state: "working", rec: null, moved: false };
  const moved = !!d && signature(d) !== rec.sig;
  return { name: `${rec.pn} rév. ${rec.rev}`, state: stateOf(rec), rec, moved };
}
/* what the approver confirms, by kind — the short list of a lean review */
const CONFIRM = {
  part: [["need", "La pièce répond à sa fonction et à ses interfaces"], ["drawing", "Son dessin de définition est à jour avec cette révision"], ["make", "Le procédé, la matière et les tolérances sont ceux que le fournisseur tient"]],
  assembly: [["need", "L'assemblage répond à sa fonction ; ses interfaces vers l'extérieur sont celles attendues"], ["build", "La gamme d'assemblage se déroule sans outillage manquant"], ["safety", "Isolation, lignes de fuite et distances dans l'air ont été regardées"]],
  board: [["need", "La carte répond à ses fonctions ; ses connecteurs sont ceux du reste du produit"], ["lab", "Le plan de test fonctionnel a été déroulé, ou son report est justifié"], ["fab", "Le dossier de fabrication est celui de cette révision"]],
};
/** The list of the review of a frozen revision. facts : what the screen could measure, each optional —
      { dfx: { errors, warns }, builds: { errors }, erc: { error, warn }, drc: { error, warn }, lab: { tests, measured } }
    → [{ id, label, how ("auto" : the tool checked it | "confirm" : the approver does), state ("ok" | "warn" | "fail" | "todo"), text, blocking }] */
export function reviewItems(project, rec, facts = {}) {
  const kind = rec.key.split(":")[0], out = [], auto = (id, label, state, text, blocking = state === "fail") => out.push({ id, label, how: "auto", state, text, blocking });
  auto("intact", "Le contenu gelé est intact", signature(rec.doc) === rec.sig ? "ok" : "fail", signature(rec.doc) === rec.sig ? "La révision gardée est bien celle qui a été gelée." : "La révision gardée ne correspond plus à sa signature : elle a été altérée.");
  if (kind === "assembly") { const held = [...Object.entries(rec.uses || {}), ...Object.entries(rec.subs || {})], not = held.filter(([, u]) => { const r = recOf(project, u.pn, u.rev); return !r || stateOf(r) !== "released"; });
    auto("children", "Chaque pièce et sous-assemblage qu'il contient est libéré", !held.length ? "warn" : not.length ? "fail" : "ok", !held.length ? "Cet assemblage n'épingle aucune pièce." : not.length ? `Pas encore libéré : ${not.map(([id, u]) => `${id} (${u.pn} rév. ${u.rev})`).join(", ")}. Un assemblage ne se libère qu'avec des pièces libérées.` : `${held.length} révision(s) épinglée(s), toutes libérées.`); }
  if (kind === "assembly" && facts.builds) auto("builds", "L'assemblage gelé se construit", facts.builds.errors ? "fail" : "ok", facts.builds.errors ? `${facts.builds.errors} erreur(s) à la construction.` : "Toutes ses pièces se construisent et se posent.");
  if (kind !== "board" && facts.dfx) auto("dfx", "Bilan DFx", facts.dfx.errors ? "fail" : facts.dfx.warns ? "warn" : "ok", facts.dfx.errors ? `${facts.dfx.errors} point(s) à corriger.` : facts.dfx.warns ? `Aucun point bloquant ; ${facts.dfx.warns} à vérifier.` : "Aucun point relevé.");
  if (kind === "board") { if (facts.erc) auto("erc", "Règles électriques", facts.erc.error ? "fail" : facts.erc.warn ? "warn" : "ok", facts.erc.error ? `${facts.erc.error} erreur(s).` : facts.erc.warn ? `Aucune erreur ; ${facts.erc.warn} avertissement(s).` : "Aucune erreur, aucun avertissement.");
    if (facts.drc) auto("drc", "Règles de fabrication", facts.drc.error ? "fail" : facts.drc.warn ? "warn" : "ok", facts.drc.error ? `${facts.drc.error} erreur(s).` : facts.drc.warn ? `Aucune erreur ; ${facts.drc.warn} avertissement(s).` : "Aucune erreur, aucun avertissement.");
    if (facts.lab) auto("lab-read", "Relevés du laboratoire", facts.lab.measured ? "ok" : "warn", facts.lab.measured ? `${facts.lab.measured} essai(s) sur ${facts.lab.tests} ont des relevés.` : `Aucun des ${facts.lab.tests} essais n'a de relevé : la carte n'a pas été mesurée.`, false); }
  const earlier = releases(project).filter((r) => r.key === rec.key && r !== rec && r.review && (r.review.open || []).length).at(-1);
  if (earlier) out.push({ id: "open", label: "Les points ouverts de la revue précédente sont fermés", how: "confirm", state: "todo", text: `Revue de ${earlier.pn} rév. ${earlier.rev} : ${earlier.review.open.join(" ; ")}`, blocking: true });
  for (const [id, label] of CONFIRM[kind] || []) out.push({ id, label, how: "confirm", state: "todo", text: "", blocking: true });
  return out;
}
/** What stands in the way of a decision. o : { by (the approver), decision ("released" | "rejected"), why, ticks: { id: true | "na" } } → [text] */
export function reviewProblems(rec, items, o = {}) {
  const out = [], by = String(o.by || "").trim(), why = String(o.why || "").trim(), ticks = o.ticks || {};
  if (stateOf(rec) !== "frozen") out.push(`Cette révision est déjà ${REV_STATES[stateOf(rec)].label.toLowerCase()} : sa revue est close.`);
  if (!by) out.push("L'approbateur n'est pas nommé."); else if (rec.by && same(by, rec.by)) out.push(`L'approbateur doit être quelqu'un d'autre que l'auteur de la révision (${rec.by}).`);
  if (!rec.by) out.push("L'auteur de la révision n'est pas nommé : on ne peut pas dire que l'approbateur est quelqu'un d'autre.");
  if (!why) out.push(o.decision === "rejected" ? "La raison du refus n'est pas écrite." : "La justification de la décision n'est pas écrite.");
  if (o.decision === "rejected") return out;
  for (const it of items) { if (it.how === "auto" && it.blocking) out.push(`${it.label} — ${it.text}`); else if (it.how === "confirm" && !ticks[it.id]) out.push(`À confirmer : ${it.label}.`); }
  return out;
}
/** The decision of a review, written on the frozen revision. o : { by, decision, why, open: [text], ticks, items (as shown), date }
    → the record. Throws when something stands in the way. */
export function decide(project, id, o = {}) {
  const rec = releases(project).find((r) => r.id === id); if (!rec) throw new Error("Révision introuvable.");
  const decision = o.decision === "rejected" ? "rejected" : "released", items = o.items || reviewItems(project, rec, o.facts || {}), problems = reviewProblems(rec, items, { ...o, decision });
  if (problems.length) throw new Error(problems.join(" "));
  const when = (o.date || new Date()).toISOString(), ticks = o.ticks || {};
  rec.state = decision; rec.review = { by: String(o.by).trim(), at: when, decision, why: String(o.why).trim(), open: (o.open || []).map((t) => String(t).trim()).filter(Boolean), items: items.map((it) => ({ id: it.id, label: it.label, how: it.how, state: it.how === "confirm" ? (ticks[it.id] === "na" ? "na" : ticks[it.id] ? "ok" : "todo") : it.state, ...(it.text ? { text: it.text } : {}) })) };
  /* the review ledger follows : a released revision is a validated one */
  project.review = project.review || { items: {} }; project.review.items = project.review.items || {}; const e = project.review.items[rec.key] || (project.review.items[rec.key] = {});
  e.history = [...(e.history || []), { rev: rec.rev, when, note: `${rec.id} ${decision === "released" ? "libérée" : "refusée"} par ${rec.review.by} — ${rec.review.why}` }];
  if (decision === "released" && e.sig === rec.sig) Object.assign(e, { state: "ok", when, by: rec.review.by });
  return rec;
}
/** The sheet of a review, as a document (core/pdfdoc.js, core/docx.js). */
export function reviewDoc(project, rec, o = {}) {
  const st = REV_STATES[stateOf(rec)], rv = rec.review || null, out = [], date = o.date || new Date(0), items = rv ? rv.items : reviewItems(project, rec, o.facts || {}), word = { ok: "conforme", warn: "à vérifier", fail: "NON CONFORME", todo: "à confirmer", na: "sans objet" };
  out.push({ type: "h1", text: "La révision" }, { type: "kv", rows: [["Numéro et révision", `${rec.pn} rév. ${rec.rev}`], ["Désignation", rec.name || "—"], ["État", `${st.label} (${st.en})`], ["Gelée le", String(rec.at).slice(0, 10)], ["Auteur de la révision", rec.by || "—"], ["Dérive de", rec.from ? `${rec.from.pn} rév. ${rec.from.rev}` : "—"], ["Forme · ajustement · fonction", rec.f3 ? (rec.f3.ok ? "conservés" : `rompus — ${rec.f3.text}`) : "première révision"]] });
  const held = [...Object.entries(rec.subs || {}), ...Object.entries(rec.uses || {})]; if (held.length) out.push({ type: "h2", text: "Gelée avec" }, { type: "table", head: ["Élément", "Numéro", "Révision"], widths: [40, 40, 20], rows: held.map(([id, u]) => [id, u.pn, u.rev]) });
  out.push({ type: "h1", text: "La revue de conception" }, { type: "p", text: "Une revue courte : ce que l'outil a pu vérifier lui-même, puis ce que l'approbateur confirme. Une fois gelée, une révision ne change plus : tout changement ouvre la révision suivante.", style: "muted" },
    { type: "table", head: ["Point", "Vérifié par", "Résultat", "Détail"], widths: [36, 14, 14, 36], rows: items.map((it) => [it.label, it.how === "auto" ? "l'outil" : "l'approbateur", word[it.state] || it.state, it.text || ""]) });
  out.push({ type: "h1", text: "La décision" }, { type: "kv", rows: [["Décision", rv ? (rv.decision === "released" ? "LIBÉRÉE" : "REFUSÉE") : "en attente"], ["Approbateur", rv ? rv.by : "—"], ["Date", rv ? String(rv.at).slice(0, 10) : "—"], ["Justification", rv ? rv.why : "—"]] });
  if (rv && rv.open.length) out.push({ type: "h2", text: "Points ouverts" }, { type: "list", items: rv.open });
  out.push({ type: "signatures", roles: ["Auteur de la révision", "Approbateur"] });
  return { title: `Revue de conception — ${rec.pn} rév. ${rec.rev}`, subtitle: rec.name || "", subject: "Revue de conception", author: rv ? rv.by : "", date, reference: `${rec.pn}-REV-${rec.rev}`, revision: rec.rev, header: `${rec.pn} rév. ${rec.rev} — Revue de conception`, footer: "DynamiteOrbit.ai", blocks: out };
}
