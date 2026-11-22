/* DesignOrbit.ai — PCBA: one line per board for the design-review report of the project — what it holds, where it
   stands in its flow, what the checks say, which review it is ready for. */

import { LIBRARY } from "./library.js";
import { erc } from "./erc.js";
import { checkBoard } from "./drc.js";
import { zoneProblems, placementProblems } from "./place.js";
import { flowStatus } from "./status.js";
import { boardAssemblyPlan } from "./assembly_plan.js";
import { planSummary } from "../core/plan_doc.js";
import { labSummary } from "./lab_plan.js";

/** → [{ id, name, content, stage, checks, errors, warns, assembly, lab, review }] */
export function boardSummary(project, lib = LIBRARY) {
  return ((project && project.boards) || []).map((b) => {
    const e = erc(b, lib), d = checkBoard(b, lib), flow = flowStatus(b, { erc: e, zones: zoneProblems(b, lib), placement: placementProblems(b, lib), drc: d }), st = Object.fromEntries(flow.steps.map((s) => [s.key, s])), cur = st[flow.current];
    const errors = e.summary.error + (st.layout.state === "done" ? d.summary.error : 0), warns = e.summary.warn + (st.layout.state === "done" ? d.summary.warn : 0);
    return { id: b.id, name: b.name || "", content: `${(b.functions || []).length} fonctions, ${(b.blocks || []).length} blocs, ${(b.parts || []).length} composants, ${(b.board || {}).layers || 2} couches`,
      stage: st.cdr.state === "done" ? "Dossier de fabrication prêt" : `${cur.label} : ${cur.detail}`, checks: errors ? `${errors} erreur(s)` : warns ? `${warns} avertissement(s)` : st.layout.state === "done" ? "aucune remarque" : "contrôle électrique sans erreur",
      errors, warns, assembly: planSummary(boardAssemblyPlan(b, lib)), lab: labSummary(b).text, review: st.cdr.state === "done" ? "Prête pour la revue détaillée" : st.pdr.state === "done" ? "Prête pour la revue préliminaire" : "Pas encore prête" };
  });
}
