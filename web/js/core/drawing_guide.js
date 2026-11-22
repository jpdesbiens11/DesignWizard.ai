/* DesignOrbit.ai — drawings : what a sheet still asks for before it goes out, said to the guide. Pure. The title block first — who drew,
   who checked, who approved, and a status that does not say more than the names do — then the review : a sheet whose artefact changed
   after its review is to be reviewed again. The English of the texts of the project has its own list (core/drawing_words.js). */

const ISSUED = /^(?:émis|emis|issued|released|approuvé|approuve|approved|libéré|libere)/i;

/** d : project.drawing ; o : { id (the part or the assembly drawn), author (of the project), state (its review state today : "ok", "changed", …) }.
    → [{ level, text, field }] */
export function drawingIssues(d, o = {}) {
  const out = [], x = d || {}, id = o.id || "Dessin", say = (level, text, field) => out.push({ level, text: `${id} — dessin : ${text}`, field });
  const has = (k) => !!String(x[k] || "").trim(), drawn = has("drawnBy") || !!String(o.author || "").trim(), missing = [has("checkedBy") ? null : "vérificateur", has("approvedBy") ? null : "approbateur"].filter(Boolean), status = String(x.status || "").trim();
  if (!drawn) say("todo", "le cartouche n'a pas de dessinateur — entrez « Dessiné ».", "drawnBy");
  if (ISSUED.test(status) && missing.length) say("error", `le statut dit « ${status} », mais le cartouche n'a pas de ${missing.join(" ni d'")} — nommez-${missing.length > 1 ? "les" : "le"}, ou revenez à un statut de travail.`, missing[0] === "vérificateur" ? "checkedBy" : "approvedBy");
  else if (missing.length) say("tip", `« ${missing.length > 1 ? "Vérifié » et « Approuvé » sont" : missing[0] === "vérificateur" ? "Vérifié » est" : "Approuvé » est"} à remplir avant d'émettre le dessin.`, missing[0] === "vérificateur" ? "checkedBy" : "approvedBy");
  if (o.state === "changed") say("warn", "l'artéfact a changé depuis sa revue — le cartouche dit « To revalidate » : repassez-le en revue.", "status");
  if (!has("organisation")) say("tip", "aucune organisation au cartouche : la note de confidentialité ne dit pas à qui appartient le document.", "organisation");
  return out;
}
