/* DesignWizard.ai — PCBA: the design flow of a board, and where a board stands in it. Functions first, then the
   architecture (one block per function), the conceptual layout, a preliminary review ; then the detailed layout, the
   checks, the fabrication package and the detailed review. The screen draws this as a diagram. */

export const FLOW = [
  { key: "fonctions", label: "Fonctions", text: "Ce que la carte doit faire" },
  { key: "architecture", label: "Architecture", text: "Un bloc par fonction, les nets qui les relient" },
  { key: "implantation", label: "Implantation", text: "Carte nue, interfaces, une zone par bloc" },
  { key: "pdr", gate: true, label: "Revue préliminaire", text: "Le concept est-il le bon ?" },
  { key: "layout", label: "Layout", text: "Placement, routage, couches" },
  { key: "verifs", label: "Vérifications", text: "Règles électriques, règles de conception, DFx" },
  { key: "fabrication", label: "Fabrication", text: "Gerber, perçage, placement, nomenclature" },
  { key: "cdr", gate: true, label: "Revue détaillée", text: "La carte peut-elle partir en fabrication ?" },
];
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** State of every step. r : { erc, zones: [problems], placement: [problems], drc } (results of the other modules).
    → { steps: [{ key, gate, label, text, state: "done" | "todo" | "blocked", detail }], current } */
export function flowStatus(board, r = {}) {
  const fs = board.functions || [], blocks = board.blocks || [], parts = board.parts || [], b = board.board || {}, erc = r.erc || { summary: { error: 0, warn: 0 } }, drc = r.drc || null;
  const orphan = fs.filter((f) => !f.block && f.kind !== "contrainte" && !fs.some((c) => c.parent === f.id)).length, zones = r.zones || [], placement = r.placement || [], open = drc ? drc.stats.open : null, st = {};
  st.fonctions = { ok: fs.length > 0 && !orphan, detail: fs.length ? `${plural(fs.length, "fonction", "fonctions")}${orphan ? `, ${orphan} sans solution` : ""}` : "à décrire" };
  st.architecture = { ok: blocks.length > 0 && !erc.summary.error, bad: erc.summary.error > 0, detail: blocks.length ? `${plural(blocks.length, "bloc", "blocs")} · ${parts.length} comp.${erc.summary.error ? ` · ${plural(erc.summary.error, "erreur", "erreurs")}` : ""}` : "aucun bloc" };
  st.implantation = { ok: blocks.length > 0 && !zones.length, detail: blocks.length && !zones.length ? `${String((b.size || [0, 0])[0]).replace(".", ",")} × ${String((b.size || [0, 0])[1]).replace(".", ",")} mm, ${b.layers || 2} couches` : blocks.length ? plural(zones.length, "point à régler", "points à régler") : "après l'architecture" };
  st.pdr = { ok: st.fonctions.ok && st.architecture.ok && st.implantation.ok, detail: "" };
  st.pdr.detail = st.pdr.ok ? "prête" : "pas encore";
  const unplaced = parts.filter((p) => !p.at).length;
  st.layout = { ok: parts.length > 0 && !unplaced && !placement.length && open === 0, detail: !parts.length ? "—" : unplaced ? `${plural(unplaced, "composant", "composants")} à placer` : placement.length ? plural(placement.length, "défaut de placement", "défauts de placement") : open ? `${plural(open, "liaison", "liaisons")} à router` : open === 0 ? "placé et routé" : "—" };
  const errors = (drc ? drc.summary.error : 0) + erc.summary.error, warns = (drc ? drc.summary.warn : 0) + erc.summary.warn;
  st.verifs = { ok: !!drc && st.layout.ok && !errors, bad: !!drc && st.layout.ok && errors > 0, detail: !drc || !parts.length ? "—" : !st.layout.ok ? "après le layout" : errors ? `${plural(errors, "erreur", "erreurs")}${warns ? `, ${plural(warns, "avertissement", "avertissements")}` : ""}` : warns ? plural(warns, "avertissement", "avertissements") : "aucune remarque" };
  st.fabrication = { ok: st.verifs.ok, detail: st.verifs.ok ? "dossier prêt" : "après les vérifications" };
  st.cdr = { ok: st.pdr.ok && st.fabrication.ok, detail: st.pdr.ok && st.fabrication.ok ? "prête" : "pas encore" };
  const steps = FLOW.map((f) => ({ ...f, state: st[f.key].ok ? "done" : st[f.key].bad ? "blocked" : "todo", detail: st[f.key].detail }));
  return { steps, current: (steps.find((s) => !s.gate && s.state !== "done") || steps[steps.length - 2]).key };
}
