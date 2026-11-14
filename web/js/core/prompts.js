/* DesignWizard.ai — the generic prompts. The platform does not call any AI itself: it writes the prompt, the user
   runs the interview in Claude (or another assistant) and pastes the answer back; the answer is a part in the
   DesignWizard part language, built at once. */

import { LANGUAGE_REFERENCE } from "../cad/language_doc.js";
import { evaluatedParams } from "./links.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";
import { PROCESSES } from "../cad/materials.js";

const j = (o) => JSON.stringify(o, null, 1);

/** The interfaces a new part must implement to meet its neighbours: opposite side, same type / key / params. */
export function anticipatedInterfaces(project, neighbourIds, onlyFree = true) {
  const used = new Set();
  for (const a of project.assemblies || []) for (const m of a.mates || []) for (const s of [m.a, m.b]) { const inst = a.instances.find((i) => i.id === s.inst); if (inst) used.add(`${inst.part}/${s.iface}`); }
  const out = [];
  for (const id of neighbourIds) {
    const part = (project.parts || []).find((p) => p.id === id);
    if (!part) continue;
    for (const it of part.interfaces || []) {
      if (onlyFree && used.has(`${id}/${it.id}`)) continue;
      const type = INTERFACE_TYPES[it.type];
      if (!type) continue;
      out.push({ from: { part: id, name: part.name || id, iface: it.id, side: it.side || "A" },
        iface: { type: it.type, key: it.key || `${id}_${it.id}`.toLowerCase(), name: it.name || type.fr, partner: part.name || id, side: (it.side || "A") === "A" ? "B" : "A", params: evaluatedParams(part, it.id) || it.params || {} },
        needsKey: !it.key });
    }
  }
  return out;
}

const METHOD_INTERVIEW = `MÉTHODE — une entrevue, puis la pièce
1. Pose-moi tes questions UNE À LA FOIS (8 au maximum), en français, dans cet ordre : la fonction exacte et les efforts ; les voisins et ce qui tient / positionne / relie la pièce à chacun (ses INTERFACES) ; l'enveloppe disponible ; l'environnement (température, vibration, tension, étanchéité) ; le procédé et le matériau visés, la quantité ; les contraintes de montage et de maintenance.
2. Propose toi-même une réponse par défaut à chaque question (je peux répondre « ok »).
3. Quand tu en sais assez, écris la pièce : UN SEUL objet JSON dans un bloc de code, dans le langage décrit plus bas. Consigne mes réponses dans "interview.questions" et tes hypothèses dans "interview.assumptions".`;
const METHOD_DIRECT = `MÉTHODE — directe
Ne pose pas de question : fais des hypothèses raisonnables, écris-les dans "interview.assumptions", et réponds tout de suite par UN SEUL objet JSON dans un bloc de code, dans le langage décrit plus bas.`;

/** Prompt for a new part. opts = {name, fn, neighbours:[ids], extras:[{type, partner}], family, process, material, constraints, mode} */
export function partPrompt(project, opts) {
  const ant = anticipatedInterfaces(project, opts.neighbours || []);
  const others = (project.parts || []).filter((p) => !(opts.neighbours || []).includes(p.id)).map((p) => `- ${p.id} — ${p.name || ""}${p.function ? ` : ${p.function}` : ""}`);
  const lines = [];
  lines.push(`Tu es un concepteur mécanique senior. Tu vas m'aider à définir UNE pièce d'un produit mécatronique pour la plateforme DesignWizard.ai, qui construira la pièce en 3D directement à partir de ta réponse. On commence toujours par les INTERFACES de la pièce avec ses voisines, puis on dessine la pièce autour.`);
  lines.push("");
  lines.push(`PROJET : ${project.name || "sans nom"}${project.description ? ` — ${project.description}` : ""}`);
  lines.push(`PIÈCE À CONCEVOIR : ${opts.name || "(à nommer)"}`);
  if (opts.fn) lines.push(`FONCTION : ${opts.fn}`);
  if (opts.family) lines.push(`FAMILLE ENVISAGÉE : ${opts.family}`);
  if (opts.process) lines.push(`PROCÉDÉ ENVISAGÉ : ${opts.process} (${(PROCESSES[opts.process] || {}).fr || ""})`);
  if (opts.material) lines.push(`MATÉRIAU ENVISAGÉ : ${opts.material}`);
  if (opts.constraints) lines.push(`CONTRAINTES ET CONTEXTE : ${opts.constraints}`);
  lines.push("");
  if (ant.length) {
    lines.push(`INTERFACES ANTICIPÉES — déjà définies par les pièces voisines. La nouvelle pièce DOIT les porter telles quelles (même "type", même "key", mêmes "params", le "side" indiqué) ; il te reste à choisir pour chacune la "face", la position "at", le "level" éventuel et les "opts" de ce côté :`);
    lines.push("```json");
    lines.push(j(ant.map((a) => a.iface)));
    lines.push("```");
  } else lines.push(`INTERFACES ANTICIPÉES : aucune pièce voisine n'existe encore dans le projet. Définis toi-même les interfaces (type, key explicite, params) : les prochaines pièces les reprendront.`);
  if ((opts.extras || []).length) {
    lines.push("");
    lines.push("INTERFACES SUPPLÉMENTAIRES À DÉFINIR pendant l'entrevue (voisins qui n'existent pas encore) :");
    for (const e of opts.extras) lines.push(`- ${INTERFACE_TYPES[e.type] ? INTERFACE_TYPES[e.type].fr : e.type} (${e.type}) avec « ${e.partner || "?"} »${e.note ? ` — ${e.note}` : ""}`);
  }
  if (others.length) { lines.push(""); lines.push("AUTRES PIÈCES DU PROJET (pour le contexte) :"); lines.push(...others.slice(0, 30)); }
  lines.push("");
  lines.push(opts.mode === "direct" ? METHOD_DIRECT : METHOD_INTERVIEW);
  lines.push("");
  lines.push("LANGAGE DE LA RÉPONSE (à respecter à la lettre) :");
  lines.push("");
  lines.push(LANGUAGE_REFERENCE);
  return lines.join("\n");
}

/** Prompt to revise an existing part from a request in plain words. */
export function revisionPrompt(project, spec, request) {
  const light = JSON.parse(JSON.stringify(spec));
  if (light.step) light.step = "(géométrie STEP importée, non modifiable)";
  return [`Tu es un concepteur mécanique senior. Voici une pièce du projet « ${project.name || ""} » dans le langage DesignWizard (DW part/1). Modifie-la selon ma demande, sans changer son "id" ni les "key" de ses interfaces, et sans toucher à ce qui n'est pas concerné.`,
    "", `DEMANDE : ${request || "(décrire la modification)"}`, "", "PIÈCE ACTUELLE :", "```json", j(light), "```", "",
    "Réponds par UN SEUL objet JSON complet (la pièce entière, modifiée) dans un bloc de code, puis une liste courte de ce que tu as changé.", "", "LANGAGE :", "", LANGUAGE_REFERENCE].join("\n");
}

/** Prompt for an extrusion profile designed around what goes inside / outside it. */
export function extrusionPrompt(project, opts) {
  const env = (list) => (list || []).map((e) => `- ${e.name} : ${e.w} × ${e.h} mm${e.clearance ? `, jeu ${e.clearance} mm` : ""}${e.note ? ` — ${e.note}` : ""}`).join("\n") || "- (rien)";
  return [`Tu es un concepteur de profilés extrudés (${opts.process === "extrusion_plastic" ? "plastique" : "aluminium"}). Dessine la SECTION d'un profilé pour la plateforme DesignWizard.ai, qui l'extrudera en 3D et vérifiera les règles d'extrusion à partir de ta réponse.`,
    "", `PROJET : ${project.name || ""}`, `PROFILÉ : ${opts.name || "(à nommer)"}`, `FONCTION : ${opts.fn || "(à préciser)"}`, `LONGUEUR : ${opts.length || "à définir"} mm · MATÉRIAU : ${opts.material || (opts.process === "extrusion_plastic" ? "PVC-U" : "AL6063-T5")}`,
    "", "CE QUI DOIT ALLER DEDANS (dimensions de la section de chaque élément, vues dans le plan de la section) :", env(opts.inside),
    "", "CE QUI SE FIXE OU S'APPUIE DEHORS :", env(opts.outside),
    opts.constraints ? `\nCONTRAINTES : ${opts.constraints}` : "",
    "", "MÉTHODE", "1. Si une information manque pour placer les éléments (sens de montage, jeux, fixation, dissipation, étanchéité), pose-moi au plus 5 questions, une à la fois, avec une réponse par défaut.",
    "2. Dessine la section autour des éléments : glissières pour les cartes (type \"rail\"), logements, ailettes, vis auto-taraudeuses en bout (canaux ouverts Ø selon la vis), rainures en T si utile.",
    "3. Respecte les règles d'extrusion : parois uniformes (aluminium ≥ 1,2 mm, plastique ≥ 1,0 mm), rayons ≥ 0,4 mm partout, aucune gorge plus profonde que 3 fois sa largeur, le moins de cavités fermées possible, symétrie si possible.",
    "4. Réponds par UN SEUL objet JSON « part/1 » avec family \"extrusion\", le bloc \"extrusion\" (profile en \"poly\" avec rayons par sommet, ou \"path\" SVG, ou {\"outer\", \"holes\"}), ses \"inside\" / \"outside\" placés (centre \"at\" et taille), des \"params\" pour chaque dimension utile, et les \"interfaces\" avec les voisins.",
    "", "LANGAGE DE LA RÉPONSE :", "", LANGUAGE_REFERENCE].join("\n");
}
