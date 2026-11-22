/* DesignOrbit.ai — the code behind what a screen shows. Every element has a text form : a part reads as FeatureScript
   (the same definition Onshape runs — it can be pasted there as it is) and as its .dwiz specification ; an assembly, a
   board, the project read as .dwiz, and an assembly also carries the FeatureScript of its parts. The same text can go to
   an AI, behind a short formal request : how to run the interview, and what must come back so that DesignOrbit.ai can
   take it in again. Pure : no DOM. */

import { toDwiz } from "./dwiz.js";
import { partCounts, finder } from "./asm_levels.js";
import { toFeatureScript } from "../cad/featurescript.js";
import { expandSpec } from "../cad/shop.js";

const PART_SCREENS = new Set(["parts", "extrusion", "pcb", "fea", "dfx", "busbar", "flex"]);
const KIND_FR = { part: "la pièce", assembly: "l'assemblage", board: "la carte", project: "le projet" };
const light = (d) => { const c = JSON.parse(JSON.stringify(d && d.history ? { ...d, history: undefined } : d));      // the restore points are not the definition (core/history.js)
  for (const p of c.parts && /^project/.test(c.dw || "") ? c.parts : [c]) if (p && p.step && typeof p.step === "object" && String(p.step.text || "").length > 2000) p.step = "(géométrie STEP importée)"; if (/^project/.test(c.dw || "")) { delete c.review; delete c.mvp; delete c.log; delete c.team; delete c.talk; delete c.plm; } return c; };

/** What the screen at `hash` shows. context : what the screen itself declared (the part being edited, the proposal of the Shop). → { kind, id, label, doc } */
export function elementFor(project, hash, context = {}) {
  const a = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent), part = (id) => (project.parts || []).find((p) => p.id === id), asm = (id) => (project.assemblies || []).find((x) => x.id === id) || (project.assemblies || [])[0];
  const P = (d, label) => ({ kind: "part", id: d.id, label: label || `Pièce ${d.id}${d.name ? ` — ${d.name}` : ""}`, doc: d }), A = (d) => ({ kind: "assembly", id: d.id, label: `Assemblage ${d.id}${d.name ? ` — ${d.name}` : ""}`, doc: d });
  if (a[0] === "shop" && context.spec) return P(context.spec, `Proposition de l'Atelier — ${context.spec.name || context.spec.id}`);
  if (a[0] === "drawings") { if (a[1] === "asm" && asm(a[2])) return A(asm(a[2])); if (part(a[1])) return P(part(a[1])); if ((project.parts || [])[0]) return P(project.parts[0]); }
  if (PART_SCREENS.has(a[0])) { if (part(a[1])) return P(part(a[1])); if (context.spec && context.spec.id) return P(context.spec); }
  if ((a[0] === "assembly" || a[0] === "creepage") && asm(a[1])) return A(asm(a[1]));
  if (a[0] === "pcba") { const b = (project.boards || []).find((x) => x.id === a[1]) || (project.boards || [])[0]; if (b) return { kind: "board", id: b.id, label: `Carte ${b.id}${b.name ? ` — ${b.name}` : ""}`, doc: b }; }
  return { kind: "project", id: project.id, label: `Projet — ${project.name || project.id}`, doc: project };
}
function fsOf(spec) {
  if (spec.step) return { text: `// ${spec.id} : géométrie STEP importée — pas de FeatureScript, la pièce n'a pas d'arbre de construction.\n`, notes: ["Géométrie importée : rien à convertir."] };
  try { const r = toFeatureScript(expandSpec(JSON.parse(JSON.stringify(spec)))); return { text: r.code, notes: [`${r.converted} opération(s) sur ${r.total} converties${r.skipped.length ? ` ; ${r.skipped.length} non converties` : ""}.`, ...r.warnings] }; }
  catch (e) { return { text: `// ${spec.id} : FeatureScript impossible — ${e.message}\n`, notes: [e.message] }; }
}
/** The text forms of an element. → [{ key, label, text, file, notes }] — FeatureScript first when the element has a geometry of its own. */
export function codeSources(project, e) {
  const dwiz = { key: "dwiz", label: ".dwiz", text: toDwiz(light(e.doc)), file: `${e.id || "projet"}.dwiz`, notes: ["La spécification de haut niveau : c'est elle que DesignOrbit.ai relit, et qu'une IA doit rendre."] };
  if (e.kind === "part") { const f = fsOf(e.doc); return [{ key: "fs", label: "FeatureScript", text: f.text, file: `${e.id}.fs`, notes: ["La même définition qu'Onshape : collez-la dans un Feature Studio, puis insérez la fonction dans un Part Studio.", ...f.notes] }, dwiz]; }
  if (e.kind === "assembly") { const ids = [...partCounts(e.doc, finder(project)).keys()], parts = ids.map((id) => (project.parts || []).find((p) => p.id === id)).filter(Boolean);
    return [dwiz, { key: "fs", label: "FeatureScript des pièces", text: parts.map((p) => `// ===== ${p.id} — ${p.name || ""} =====\n${fsOf(p).text}`).join("\n"), file: `${e.id}_pieces.fs`, notes: [`Un assemblage se définit par ses liaisons, pas par du FeatureScript : voici celui de ses ${parts.length} pièce(s), l'une après l'autre.`] }]; }
  return [dwiz];
}
/** The request that goes before the code when it is handed to an AI : the interview, then the form of the answer that comes back. */
export function aiCodePrompt(project, e, source) {
  const what = `${KIND_FR[e.kind]} « ${e.id} »`, fs = source.key === "fs", dwiz = fs ? codeSources(project, e).find((s) => s.key === "dwiz") : null;
  return [`Tu es l'assistant de conception de DesignOrbit.ai. Voici ${what}${project.name ? ` du produit « ${project.name} »` : ""}, sous forme de ${fs ? "FeatureScript Onshape" : "spécification .dwiz"}.`,
    "", "ENTREVUE — avant de modifier quoi que ce soit, pose-moi au plus cinq questions, une à la fois, sur ce que je veux changer et pourquoi : fonction, interfaces, matière, procédé, quantité. Attends chaque réponse. Résume ensuite en trois lignes ce que tu vas faire, et attends mon accord.",
    "", `RÉPONSE ATTENDUE — un seul bloc de code \`\`\`dwiz qui contient ${what} EN ENTIER dans le format .dwiz : mêmes repères, mêmes « key » d'interface, une instruction par ligne.${fs ? " Le FeatureScript te donne la géométrie exacte ; tu peux me rendre à part un FeatureScript corrigé pour Onshape, mais c'est le bloc dwiz qui revient dans DesignOrbit.ai." : ""} Après le bloc, liste en clair ce que tu as changé. Ne donne aucun résultat d'analyse : la plateforme les recalcule.`,
    "", "RETOUR — je colle ta réponse dans DesignOrbit.ai (« Confier à l'IA », puis réimporter) : j'y vois chaque changement avant de l'appliquer.",
    "", `----- ${source.label} -----`, source.text.trimEnd(), ...(dwiz ? ["", "----- .dwiz — le format de ta réponse -----", dwiz.text.trimEnd()] : [])].join("\n");
}
