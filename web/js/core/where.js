/* DynamiteOrbit.ai — where am I (demande de JP, 23 novembre : « une fois un projet sélectionné, il faudrait en naviguant avoir un
   rappel du projet / pièce-assy ou autre artéfact où on est par une indication textuelle qui est toujours sous le titre du module
   et des icônes dans la marge de gauche… plus facile de savoir où on est si on travaille sur plusieurs projets »).
   Pure : the address and the project give two lines — the project, then what the screen shows (aiTargetOf : the same artefact
   the « IA » button hands over). core/where_ui.js draws them, once, under the head of every left panel. The usage it follows :
   the « current file » line of a CAD tool's model tree, under its title. */

import { aiTargetOf } from "./stairs.js";

const KIND = {
  part: { word: "Pièce", icon: "part" }, assembly: { word: "Assemblage", icon: "assembly" }, board: { word: "Carte", icon: "chip" },
  drawing: { word: "Dessin", icon: "drawing" }, case: { word: "Cas de charge", icon: "physics" }, iso: { word: "Isolation", icon: "creepage" },
};
const SW = new Set(["sw", "swreq", "swarch", "swsim", "swcode", "swtest", "swrel"]);

/** → null (no project, or a page without a place), or { project, kind, icon, name, id } — kind, name and id empty when the
    screen shows the whole project. */
export function whereOf(key, args, project) {
  if (!project || !key || key === "home" || key === "help" || key === "account" || key === "start") return null;
  const out = { project: project.name || "Projet sans nom", kind: "", icon: "", name: "", id: "" };
  if (SW.has(key)) { const sw = (project.software || [])[0]; return sw ? { ...out, kind: "Logiciel", icon: "code", name: sw.name || sw.id || "logiciel du projet", id: "" } : out; }
  const t = aiTargetOf(key, args, project); if (!t || t.key === "project") return out;
  const [kind, a, b] = t.key.split(":"), id = b || a, of = kind === "drawing" || kind === "iso" ? a : null;
  const pool = kind === "board" || of === "board" ? project.boards : kind === "assembly" || of === "assembly" ? project.assemblies : kind === "case" ? [...(project.parts || []), ...(project.assemblies || [])] : project.parts;
  const x = (pool || []).find((y) => y.id === id), K = KIND[kind] || { word: "", icon: "" };
  if (!x) return out;
  const word = of === "assembly" && kind === "drawing" ? "Dessin d'assemblage" : of === "board" ? "Isolation de la carte" : K.word;
  return { ...out, kind: word, icon: K.icon, name: x.name || x.id, id: x.name && x.name !== x.id ? x.id : "" };
}
