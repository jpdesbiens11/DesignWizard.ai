/* DesignOrbit.ai — PCBA : what a board still asks for, said to the guide of the top bar. Two lists, both pure.
   boardGuide(board) — what the board itself shows, cheap enough to run for every board of a project at every redraw : functions without a
   solution, drafts of an AI to read, an outline without size, parts to place, a high-voltage net without its voltage.
   boardChecksGuide(board, r) — what the checks found, read from results the screen has already computed : electrical rules, zones,
   placement, links to route, design rules.
   Four levels, as everywhere : error (à corriger), todo (à entrer), warn (à vérifier), tip (conseil). Every entry says the step of the flow
   — or the classic view — where it is settled (`step`), so that a click on its line goes there. */

import { draftsOf } from "../core/ai_draft.js";

const many = (n, one, more) => `${n} ${n > 1 ? more : one}`, some = (list, n = 3) => `${list.slice(0, n).join(", ")}${list.length > n ? "…" : ""}`;

/** What the board itself shows. → [{ level, text, step, field }] */
export function boardGuide(board) {
  const out = [], b = board || {}, id = b.id || "Carte", say = (level, text, step, field = null) => out.push({ level, text: `${id} — ${text}`, step, field });
  const fs = b.functions || [], blocks = b.blocks || [], parts = b.parts || [], nets = b.nets || [], bare = b.board || {};
  if (!fs.length && !blocks.length) { say("todo", "décrivez ce que la carte doit faire : ajoutez une première fonction, ou choisissez un bloc de circuit.", "fonctions", "functions"); return out; }
  const orphan = fs.filter((f) => !f.block && f.kind !== "contrainte" && !fs.some((c) => c.parent === f.id));
  if (orphan.length) say("todo", `${many(orphan.length, "fonction sans solution", "fonctions sans solution")} (${some(orphan.map((f) => f.id))}) : donnez-${orphan.length > 1 ? "leur" : "lui"} un bloc de circuit.`, "fonctions", "functions");
  const drafts = draftsOf(b), cited = drafts.filter((d) => d.norms.length).length;
  if (drafts.length) say("warn", `${many(drafts.length, "élément proposé par une IA attend", "éléments proposés par une IA attendent")} votre lecture : confirmez-${drafts.length > 1 ? "les" : "le"}${cited ? `, avec l'édition et la clause des normes citées (${cited})` : ""} — la revue ne passe pas avant.`, "fonctions", "drafts");
  const size = bare.size || [];
  if (!(size[0] > 0 && size[1] > 0)) say("error", "donnez la largeur et la hauteur de la carte nue.", "implantation", "size");
  else if (blocks.length && !(bare.holes || []).length) say("tip", "aucun trou de fixation : la carte ne se fixe à rien — ajoutez-en, ou liez-la à sa pièce mécanique.", "implantation", "holes");
  const unplaced = parts.filter((p) => !p.at);
  if (unplaced.length) say("todo", `${many(unplaced.length, "composant à placer", "composants à placer")} (${some(unplaced.map((p) => p.ref))}) : bouton « Placer » du layout.`, "layout", "place");
  const blind = nets.filter((n) => n.class === "hv" && !(n.voltage > 0));
  if (blind.length) say("warn", `${many(blind.length, "net haute tension sans tension", "nets haute tension sans tension")} (${some(blind.map((n) => n.name))}) : son isolement ne peut pas être dimensionné.`, "classes", "voltage");
  const noRef = parts.filter((p) => !p.mpn && !p.dnp);
  if (parts.length && !unplaced.length && noRef.length) say("tip", `${many(noRef.length, "composant sans référence de fabricant", "composants sans référence de fabricant")} : à choisir avant de commander (Nomenclature).`, "bom", "mpn");
  return out;
}

/** What the checks found. r : { erc, drc, zones : [text], placement : [{ message }], flow } — what the screen computed for its panels.
    → [{ level, text, step, field }] */
export function boardChecksGuide(board, r = {}) {
  const out = [], id = (board && board.id) || "Carte", say = (level, text, step, field = null) => out.push({ level, text: `${id} — ${text}`, step, field });
  const first = (list, sev) => { const f = (list || []).find((x) => x.severity === sev); return f ? `${f.rule} ${f.title}` : ""; }, done = (key) => !!(r.flow && (r.flow.steps.find((s) => s.key === key) || {}).state === "done");
  const erc = r.erc || { summary: { error: 0, warn: 0 }, findings: [] }, drc = r.drc || null, parts = (board && board.parts) || [];
  if (erc.summary.error) say("error", `${many(erc.summary.error, "erreur", "erreurs")} du contrôle électrique : ${first(erc.findings, "error")}${erc.summary.error > 1 ? "…" : ""}`, "architecture", "erc");
  if (erc.summary.warn) say("warn", `${many(erc.summary.warn, "avertissement", "avertissements")} du contrôle électrique : ${first(erc.findings, "warn")}${erc.summary.warn > 1 ? "…" : ""}`, "architecture", "erc");
  const zones = r.zones || [];
  if (zones.length && !done("implantation")) say("error", `${many(zones.length, "point à régler", "points à régler")} à l'implantation : ${zones[0]}`, "implantation", "zones");
  const placed = (r.placement || []).filter((p) => !/n'est pas encore placé/.test(p.message || ""));      // a part not placed yet is said once, by the board itself
  if (placed.length) say("error", `${many(placed.length, "défaut de placement", "défauts de placement")} : ${placed[0].message}`, "layout", "placement");
  const unplaced = parts.some((p) => !p.at), open = drc && drc.stats ? drc.stats.open : 0;
  if (parts.length && !unplaced && open > 0) say("todo", `${many(open, "liaison à router", "liaisons à router")} : bouton « Router », ou tracez-${open > 1 ? "les" : "la"} à la main.`, "layout", "route");
  if (drc && done("layout")) {      // before the layout is complete, the design rules speak of what is not drawn yet
    if (drc.summary.error) say("error", `${many(drc.summary.error, "erreur", "erreurs")} de règles de conception : ${first(drc.findings, "error")}${drc.summary.error > 1 ? "…" : ""}`, "verifs", "drc");
    if (drc.summary.warn) say("warn", `${many(drc.summary.warn, "avertissement", "avertissements")} des vérifications à examiner : ${first(drc.findings, "warn")}${drc.summary.warn > 1 ? "…" : ""}`, "verifs", "drc");
  }
  if (done("fabrication")) say("tip", "dossier de fabrication prêt : faites-le relire par l'atelier avant la première commande.", "fabrication", "fab");
  return out;
}
