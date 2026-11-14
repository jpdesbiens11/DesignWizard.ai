/* DesignWizard.ai — PCBA: the design-review report of a board, as a neutral document model that docx.js and pdfdoc.js
   both render. Two reviews : the PRELIMINARY one (is the concept right : functions, architecture, conceptual layout)
   and the DETAILED one (can the board be built : layout, checks, fabrication package).
   doc = { title, subtitle, subject, author, date, reference, revision, header, footer, blocks: [
     { type: "h1" | "h2" | "h3", text }, { type: "p", text, style }, { type: "list", items, ordered }, { type: "kv", rows },
     { type: "table", head, rows, widths, caption }, { type: "figure", png, pngSize, draw, width, height, caption },
     { type: "checklist", items: [{ text, state }] }, { type: "signatures", roles }, { type: "pagebreak" }, { type: "toc" } ] } */

import { COATINGS, FAB, CLASSES } from "./model.js";
import { draftsOf } from "../core/ai_draft.js";

export const REVIEW_KINDS = {
  PDR: { label: "Revue de conception préliminaire", short: "RCP", text: "Le concept est-il le bon ? Fonctions, architecture, implantation conceptuelle, nomenclature préliminaire, risques." },
  CDR: { label: "Revue de conception détaillée", short: "RCD", text: "La carte peut-elle partir en fabrication ? Layout, règles et vérifications, dossier de fabrication, nomenclature finale." },
};
const fr = (v, d = 2) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",") : "—");
const SEV = { error: "Erreur", warn: "Avertissement", info: "Remarque" }, FILL = { error: "error", warn: "warn", info: "muted" };
const crit = (c) => (c || []).map((x) => `${x.name} : ${x.level}${x.flex ? ` (${x.flex})` : ""}`).join(" ; ");

/** Is the board ready for this review ? → { ready, blockers, cautions, checklist: [{ text, state }] } */
export function reviewVerdict(d) {
  const tree = d.tree || [], erc = d.erc || { summary: { error: 0, warn: 0 }, findings: [] }, drc = d.drc || { summary: { error: 0, warn: 0 }, findings: [], stats: { open: null } }, b = d.board.board || {}, items = [], blockers = [], cautions = [];
  const ok = (text, good, why, hard = true) => { items.push({ text, state: good ? "ok" : "open" }); if (!good) (hard ? blockers : cautions).push(why || text); };
  const orphan = tree.filter((r) => r.leaf && !r.block && r.kind !== "contrainte"), noValue = (d.bom || []).filter((l) => !l.value && ["resistor", "capacitor", "inductor"].includes(l.kind));
  ok("Chaque fonction a une solution", tree.length > 0 && !orphan.length, orphan.length ? `Sans solution : ${orphan.map((r) => r.id).join(", ")}.` : "Aucune fonction décrite.");
  ok("Les critères des fonctions principales sont chiffrés", tree.filter((r) => r.kind === "principale").every((r) => r.criteria.length || r.block), "Des fonctions principales n'ont ni critère ni solution.", false);
  ok("Le contrôle électrique ne signale aucune erreur", !erc.summary.error, `${erc.summary.error} erreur(s) au contrôle électrique.`);
  ok("Les alimentations et les masses sont définies (tension, courant)", (d.resolved.nets || []).filter((n) => n.class === "power").every((n) => n.voltage), "Des rails n'ont pas de tension.", false);
  ok("Les interfaces mécaniques sont fixées (contour, trous de fixation)", (b.holes || []).length >= 2, "Moins de deux trous de fixation.", false);
  const waiting = draftsOf(d.board, "board"), named = [...new Set(waiting.flatMap((w) => w.norms))];
  ok("Ce qu'une IA a proposé a été confirmé par un humain", !waiting.length, `En « Brouillon IA » : ${waiting.map((w) => w.key).join(", ")}${named.length ? ` ; normes à confirmer (édition, clause) : ${named.join(", ")}` : ""}.`);
  ok("L'implantation conceptuelle est cohérente (une zone par bloc)", !(d.zones || []).length, `${(d.zones || []).length} point(s) à régler dans les zones.`);
  ok("La nomenclature n'a pas de valeur manquante", !noValue.length, `Valeur manquante : ${noValue.flatMap((l) => l.refs).join(", ")}.`, false);
  if (d.kind === "CDR") {
    ok("Tous les composants sont placés, sans recouvrement", !(d.placement || []).length, `${(d.placement || []).length} défaut(s) de placement.`);
    ok("Le routage est complet", drc.stats.open === 0, `${drc.stats.open ?? "?"} liaison(s) à router.`);
    ok("Le contrôle des règles de conception ne signale aucune erreur", !drc.summary.error, `${drc.summary.error} erreur(s) aux règles de conception.`);
    ok("Les avertissements sont traités ou acceptés", !drc.summary.warn && !erc.summary.warn, `${drc.summary.warn + erc.summary.warn} avertissement(s) à examiner.`, false);
    ok("Mires de placement et points de test présents", !drc.findings.some((f) => f.rule === "PCBA-33" || f.rule === "PCBA-40"), "Mires ou points de test à compléter.", false);
    ok("Le dossier de fabrication est généré", !!(d.fab && d.fab.files && d.fab.files.length), "Dossier de fabrication non généré.");
    if (b.coating && b.coating.type && b.coating.type !== "none") ok("Les zones à épargner du vernis sont définies", (d.coatingKeepouts || []).length > 0, "Aucune zone épargnée pour le vernis.", false);
  }
  for (const t of d.open || []) cautions.push(t);
  return { ready: !blockers.length, blockers, cautions, checklist: items };
}

/** The review document. */
export function reviewDoc(d) {
  const K = REVIEW_KINDS[d.kind] || REVIEW_KINDS.PDR, bd = d.board, b = bd.board || {}, R = d.resolved, V = reviewVerdict(d), out = [], cdr = d.kind === "CDR", fig = d.figures || {}, bom = d.bom || [];
  const h1 = (t) => out.push({ type: "h1", text: t }), h2 = (t) => out.push({ type: "h2", text: t }), p = (t, style) => out.push({ type: "p", text: t, style }), figure = (f) => { if (f) out.push({ type: "figure", ...f }); };
  const cost = bom.reduce((s, l) => s + l.total, 0), date = d.date || new Date(0), coat = b.coating && b.coating.type && b.coating.type !== "none" ? b.coating : null;
  let n = 0; const sec = (t) => h1(`${++n}. ${t}`);
  out.push({ type: "toc" }, { type: "pagebreak" });

  sec("Objet et périmètre");
  p(`${K.label} de la carte ${bd.id} « ${bd.name || ""} ». ${K.text}`);
  out.push({ type: "kv", rows: [["Projet", `${(d.project && d.project.name) || "—"}`], ["Carte", `${bd.id} — ${bd.name || ""}`], ["Révision", bd.revision || "A"], ["Rédacteur", d.author || "—"], ["Date", date.toISOString().slice(0, 10)],
    ["État", V.ready ? `Prête pour la ${K.label.toLowerCase()}` : `${V.blockers.length} point(s) bloquant(s) avant la revue`], ["Description", bd.description || "—"]] });
  if (!V.ready) out.push({ type: "list", items: V.blockers });

  sec("Besoin et arbre fonctionnel");
  p("Chaque fonction est remplie par un bloc de circuit ; les critères disent à quoi on reconnaît qu'elle l'est. Flexibilité : F0 impératif, F1 peu négociable, F2 négociable, F3 libre.", "muted");
  out.push({ type: "table", head: ["Repère", "Fonction", "Type", "Critères", "Solution retenue"], widths: [8, 38, 11, 23, 20],
    rows: (d.tree || []).map((r) => [{ text: r.id, bold: r.level === 1 }, { text: `${"   ".repeat(r.level - 1)}${r.name}`, bold: r.level === 1 }, r.kind, crit(r.criteria) || "—", r.block ? `${r.block} — ${r.templateName}` : r.kind === "contrainte" ? "Vérifiée en revue" : r.leaf ? { text: "Sans solution", fill: "warn" } : "—"]) });

  sec("Architecture");
  figure(fig.blocks);
  out.push({ type: "table", head: ["Bloc", "Ce qu'il fait", "Composants", "Coût"], widths: [22, 48, 18, 12], rows: (d.blocks || []).map((k) => [`${k.id} — ${k.name}`, k.function || "", `${k.parts.length} (${k.parts.slice(0, 4).join(", ")}${k.parts.length > 4 ? "…" : ""})`, `${fr(k.cost)} $`]) });
  h2("Dimensionnement");
  for (const k of d.blocks || []) if (k.calc && k.calc.length) { out.push({ type: "h3", text: `${k.id} — ${k.name}` }); out.push({ type: "list", items: k.calc.map((c) => `${c.label} : ${c.text}`) }); }
  h2("Alimentations et nets");
  out.push({ type: "table", head: ["Net", "Classe", "Tension", "Courant", "Piste", "Isolement", "Broches"], widths: [20, 16, 12, 12, 12, 14, 14],
    rows: R.nets.filter((x) => x.class !== "signal" || cdr).map((x) => [x.name, (CLASSES[x.class] || { label: x.class }).label, x.voltage ? `${fr(x.voltage)} V` : "—", x.current ? `${fr(x.current)} A` : "—", `${fr(x.rules.track)} mm`, `${fr(x.rules.clearance)} mm`, String(x.pads.length)]) });
  h2("Interfaces");
  out.push({ type: "list", items: [...R.parts.filter((x) => ["connector", "terminal"].includes(x.kind)).map((x) => `${x.ref} — ${x.def.name}${x.fixed ? " (position imposée)" : ""}`), `${R.holes.length} trou(s) de fixation${R.holes.length ? ` Ø ${fr(R.holes[0].d)} mm` : ""}${bd.part ? `, repris de la pièce ${bd.part}` : ""}.`] });

  sec("Implantation conceptuelle");
  figure(fig.floorplan);
  out.push({ type: "kv", rows: [["Dimensions", `${fr(R.w)} × ${fr(R.h)} mm, épaisseur ${fr(R.t)} mm`], ["Couches de cuivre", `${R.layers.length}${R.planes.length ? ` — plans : ${R.planes.map((x) => x.net).join(", ")}` : ""}`], ["Cuivre et finition", `${b.copper || 35} µm, ${b.finish || "ENIG"}`],
    ["Classe de fabrication", (FAB[(bd.rules || {}).fab || "standard"] || FAB.standard).label], ["Vernis de tropicalisation", coat ? `${COATINGS[coat.type]}, ${coat.thickness || 50} µm, ${coat.sides === "top" ? "dessus" : "deux faces"}` : "aucun"]] });
  if (d.stack) out.push({ type: "table", head: ["Couche", "Matière", "Épaisseur"], widths: [40, 35, 25], caption: "Empilage, de dessus en dessous", rows: d.stack.map((s) => [s.layer, s.material, `${fr(s.thickness, 3)} mm`]) });
  const notes = (d.blocks || []).flatMap((k) => (k.notes || []).map((t) => `${k.id} — ${t}`));
  if (notes.length) { h2("Contraintes d'implantation"); out.push({ type: "list", items: notes }); }

  if (cdr) {
    sec("Implantation détaillée");
    figure(fig.top); figure(fig.bottom);
    const st = d.drc.stats, rt = d.route || {};
    out.push({ type: "kv", rows: [["Composants", `${R.parts.length} (${st.smd} pastilles en surface, ${st.tht} traversantes)`], ["Faces équipées", st.sides.map((s) => (s === "top" ? "dessus" : "dessous")).join(" et ") || "—"], ["Pistes et vias", `${st.tracks} pistes, ${fr(st.length, 0)} mm ; ${st.vias} vias`],
      ["Longueur par couche", Object.entries(rt.byLayer || {}).map(([k, v]) => `${k} ${fr(v, 0)} mm`).join(" ; ") || "—"], ["Liaisons restant à router", String(st.open)], ["Plus petite piste / isolement", `${fr(st.minTrack)} mm / ${fr(st.minSpace)} mm`], ["Plus petit perçage / couronne", `${fr(st.minDrill)} mm / ${fr(st.minRing, 3)} mm`]] });
    sec("Règles de conception et vérifications");
    const all = [...(d.erc.findings || []), ...(d.drc.findings || [])], hard = all.filter((f) => f.severity !== "info");
    p(d.drc.summary.error + d.erc.summary.error ? `${d.drc.summary.error + d.erc.summary.error} erreur(s) à corriger avant la fabrication.` : hard.length ? `Aucune erreur ; ${hard.length} avertissement(s) à examiner en revue.` : "Aucune erreur, aucun avertissement.", d.drc.summary.error + d.erc.summary.error ? "warn" : "normal");
    if (all.length) out.push({ type: "table", head: ["Règle", "Gravité", "Constat"], widths: [22, 13, 65], rows: all.map((f) => [`${f.rule} ${f.title}`, { text: SEV[f.severity], fill: FILL[f.severity] }, f.message]) });
    sec("Conformité : fonctions, solutions, vérifications");
    const bad = new Set(all.filter((f) => f.severity === "error").flatMap((f) => [...(f.nets || []), ...(f.refs || [])]));
    out.push({ type: "table", head: ["Fonction", "Bloc", "Composants", "Vérification"], widths: [40, 20, 14, 26], rows: (d.tree || []).filter((r) => r.block).map((r) => { const hit = [...r.parts, ...r.nets].filter((x) => bad.has(x)); return [`${r.id} ${r.name}`, `${r.block} — ${r.templateName}`, String(r.parts.length), hit.length ? { text: `À corriger : ${hit.slice(0, 4).join(", ")}`, fill: "error" } : { text: "Conforme", fill: "ok" }]; }) });
    sec("Dossier de fabrication");
    if (d.fab && d.fab.files) out.push({ type: "table", head: ["Fichier", "Contenu"], widths: [50, 50], rows: d.fab.files.map((f) => [f.name, f.label]) });
    if (coat && (d.coatingKeepouts || []).length) { h2("Vernis de tropicalisation : zones à épargner"); out.push({ type: "list", items: d.coatingKeepouts.map((k) => `${k.ref || `Trou ${k.hole}`} (${k.side === "top" ? "dessus" : "dessous"}) — ${k.why}`) }); }
  }

  sec(cdr ? "Nomenclature" : "Nomenclature préliminaire");
  p(`${bom.length} lignes, ${bom.reduce((s, l) => s + l.qty, 0)} composants, ${bom.filter((l) => l.tht).reduce((s, l) => s + l.qty, 0)} traversant(s) ; coût des composants estimé à ${fr(cost)} $ par carte (prix unitaires typiques de prototype).`);
  out.push({ type: "table", head: ["N°", "Qté", "Repères", "Valeur", "Désignation", "Boîtier", "Référence", "Prix"], widths: [5, 5, 20, 14, 26, 10, 11, 9], rows: bom.map((l, i) => [String(i + 1), String(l.qty), l.refs.join(" "), l.value || "—", l.name, l.package, l.mpn || (l.dnp ? "non monté" : "à choisir"), `${fr(l.total)} $`]) });

  if (!cdr) { sec("Risques et points ouverts"); const risks = [...(d.erc.findings || []).filter((f) => f.severity !== "info").map((f) => `${f.rule} — ${f.message}`), ...(d.zones || []), ...V.cautions]; out.push(risks.length ? { type: "list", items: risks } : { type: "p", text: "Aucun risque relevé à ce stade.", style: "muted" }); }
  sec(`Liste de vérification de la ${K.label.replace("Revue de conception ", "revue ")}`);
  out.push({ type: "checklist", items: V.checklist });
  sec("Décisions, réserves et signatures");
  out.push((d.decisions || []).length ? { type: "list", items: d.decisions } : { type: "p", text: "Décisions à consigner en séance.", style: "muted" });
  if ((d.open || []).length) { h2("Points ouverts"); out.push({ type: "list", items: d.open }); }
  out.push({ type: "signatures", roles: ["Concepteur", "Relecteur", cdr ? "Responsable de la fabrication" : "Responsable du projet"] });

  return { title: `${K.label} — ${bd.id}`, subtitle: bd.name || "", subject: K.label, author: d.author || "", date, reference: `${bd.id}-${K.short}`, revision: bd.revision || "A", header: `${bd.id} rév. ${bd.revision || "A"} — ${K.label}`, footer: "DesignWizard.ai", blocks: out };
}
