/* DesignWizard.ai — what a project lacks or gets wrong, read from its data alone : a part with no material, a parameter
   outside its own bounds, an interface no neighbour answers, an assembly that floats, a part placed nowhere… Pure : the
   guide of the top bar shows the list on every screen and takes the designer to the place ; a screen adds what only it
   knows (the brief of the Shop, the load case of a simulation).
   An entry : { level ("error" | "todo" | "warn" | "tip"), text, screen (module key), ref (id of the part or assembly),
   hash (where to go) }. Levels are those of core/guide.js. */

import { material, PROCESSES, processName } from "../cad/materials.js";
import { moldPlan, moldGuide } from "./mold_plan.js";

const paramValue = (p) => (p !== null && typeof p === "object" ? p.value : p);
const GEOMETRY = ["features", "stock", "folded", "extrusion", "pcb", "step", "busbar"];

/** The entries of one part. others : the keys of the interfaces of the other parts of the project (Set). */
export function partIssues(part, others = new Set()) {
  const out = [], id = part.id || "?", hash = `#/parts/${encodeURIComponent(id)}`, add = (level, text) => out.push({ level, text: `${id} — ${text}`, screen: "parts", ref: id, hash });
  const mat = part.material ? material(part.material) : null, bought = part.process === "purchased" || part.family === "purchased";
  if (!GEOMETRY.some((k) => (Array.isArray(part[k]) ? part[k].length : part[k]))) add("error", "aucune géométrie : ni matière première, ni opération. Correctif : repartez de l'Atelier, ou ajoutez une opération dans son arbre.");
  if (!part.material) add(bought ? "tip" : "error", "aucune matière : ni masse, ni règles de fabrication, ni simulation. Correctif : choisissez-la dans ses paramètres.");
  else if (!mat) add("warn", `matière « ${part.material} » inconnue de la bibliothèque : ses propriétés ne seront pas trouvées.`);
  if (!part.process) add("todo", "aucun procédé : le DFx et la gamme ne savent pas comment elle se fabrique.");
  else if (!PROCESSES[part.process]) add("warn", `procédé « ${part.process} » inconnu.`);
  else if (mat && !bought && Array.isArray(mat.processes) && !mat.processes.includes(part.process)) add("warn", `${processName(part.process)} n'est pas un procédé courant pour ${mat.name}. Vérifiez la matière ou le procédé.`);
  if (part.family === "connector" && part.library && !part.step) { const d = part.library.dims;      // a connector of the library : how far its shape can be trusted
    if (d === "typed") add("warn", "connecteur modélisé d'après une enveloppe saisie de mémoire, non relue sur la fiche. Correctif : comparez-le au dessin du fabricant, ou déposez son modèle 3D officiel, avant de figer son logement ou son empreinte.");
    else if (d === "part") add("warn", "connecteur dont le pas et les rangées sont lus, mais le corps saisi de mémoire. Correctif : comparez le corps au dessin du fabricant avant de figer son logement ou son empreinte.");
    else if (!d) add("tip", "connecteur à la forme indicative de son genre : déposez le modèle 3D du fabricant quand la référence est choisie."); }
  for (const [k, p] of Object.entries(part.params || {})) {
    if (p === null || typeof p !== "object") continue;
    const v = p.value, label = p.label || k;
    if (typeof p.min === "number" && typeof p.max === "number" && p.min > p.max) add("error", `paramètre « ${label} » : son minimum (${p.min}) dépasse son maximum (${p.max}).`);
    else if (typeof v === "number" && ((typeof p.min === "number" && v < p.min - 1e-9) || (typeof p.max === "number" && v > p.max + 1e-9))) add("warn", `paramètre « ${label} » à ${v}, hors de ses bornes (${p.min ?? "…"} à ${p.max ?? "…"}).`);
    else if (typeof v === "number" && v <= 0 && (p.unit === "mm" || !p.unit) && !/angle|jeu|décalage|offset/i.test(label)) add("warn", `paramètre « ${label} » à ${v} mm : une dimension nulle ou négative.`);
  }
  const seen = new Set();
  for (const it of part.interfaces || []) {
    if (!it || typeof it !== "object") continue;
    if (it.id && seen.has(it.id)) add("error", `deux interfaces portent le numéro ${it.id}.`); seen.add(it.id);
    if (!it.key) add("todo", `interface ${it.id || ""} « ${it.name || it.type} » sans clé : aucune pièce voisine ne pourra s'y accoupler.`);
    else if (!it.external && !others.has(it.key)) add("tip", `interface ${it.id || ""} « ${it.name || it.type} » libre : aucune autre pièce du projet ne porte sa clé. Créez la voisine dans l'Atelier (elle la reprendra), ou marquez l'interface « externe ».`);
  }
  for (const g of moldGuide(moldPlan(part))) if (g.field) add(g.level === "check" ? "warn" : g.level, `mold : ${g.text}`);      // a moulded part : its gate to confirm, its slides, what marks a face that must stay clean
  if (!part.function && !bought) add("tip", "à quoi sert-elle ? Une phrase (« function ») aide la revue, et l'IA quand vous lui confiez la pièce.");
  return out;
}

/** The entries of one assembly. parts : Map(id → part) of the project. */
export function assemblyIssues(asm, parts = new Map()) {
  const out = [], id = asm.id || "?", hash = `#/assembly/${encodeURIComponent(id)}`, add = (level, text) => out.push({ level, text: `${id} — ${text}`, screen: "assembly", ref: id, hash });
  const inst = asm.instances || [], mates = asm.mates || [], byId = new Map(inst.map((i) => [i.id, i]));
  if (!inst.length) { add("todo", "aucune pièce : ajoutez-en depuis la liste, les accouplements se posent seuls par les clés d'interface."); return out; }
  for (const i of inst) if (!parts.has(i.part)) add("error", `l'instance ${i.id} renvoie à la pièce « ${i.part} », qui n'existe plus. Correctif : retirez l'instance ou recréez la pièce.`);
  if (!inst.some((i) => i.fixed)) add("warn", "aucune pièce fixe : l'assemblage flotte dans l'espace. Correctif : fixez la pièce qui porte les autres (clic droit → « Fixer »).");
  const mated = new Set();
  for (const m of mates) {
    for (const end of [m.a, m.b]) {
      const i = end && byId.get(end.inst), p = i && parts.get(i.part);
      if (!i) { add("error", `l'accouplement ${m.id} vise l'instance « ${end && end.inst} », qui n'existe plus.`); continue; }
      mated.add(i.id);
      if (p && !(p.interfaces || []).some((x) => x.id === end.iface)) add("error", `l'accouplement ${m.id} vise l'interface ${end.iface} de ${i.part}, qui n'existe plus : il est rompu. Correctif : « Mates automatiques », ou retirez-le.`);
    }
  }
  for (const i of inst) if (!i.fixed && !mated.has(i.id) && parts.has(i.part)) add("warn", `${i.part} (${i.id}) n'est accouplée à rien : elle reste où elle a été posée. Correctif : « Mates automatiques », ou vérifiez les clés de ses interfaces.`);
  return out;
}

/** What the team asks of this member : conflicts to settle, messages that wait for him. Pure. */
export function teamIssues(project) {
  const out = [], t = project && project.team; if (!t || !t.owner) return out;
  const hash = "#/team", add = (level, text) => out.push({ level, text, screen: "team", ref: null, hash });
  const conflicts = t.conflicts || [], mine = (project.talk || []).filter((m) => m && !m.done && m.by !== t.owner && (m.mentions || []).includes(t.owner));
  if (conflicts.length) add("warn", `Équipe — ${conflicts.length} conflit${conflicts.length > 1 ? "s" : ""} à trancher : ${conflicts.slice(0, 3).map((c) => `${String(c.key).replace(/^[a-z]+:/, "")} (@${c.by})`).join(", ")}${conflicts.length > 3 ? "…" : ""}. Le vôtre est en place, le sien attend : « Garder le mien » ou « Prendre le sien ».`);
  if (mine.length) add("tip", `Équipe — ${mine.length} message${mine.length > 1 ? "s vous attendent" : " vous attend"}${mine[0].by ? `, de @${[...new Set(mine.map((m) => m.by))].slice(0, 3).join(", @")}` : ""}.`);
  return out;
}

/** Every entry of a project, the most serious first inside each part and assembly. */
export function projectIssues(project) {
  const out = []; if (!project) return out;
  const parts = project.parts || [], asms = project.assemblies || [], byId = new Map(parts.map((p) => [p.id, p]));
  if (!parts.length) out.push({ level: "tip", text: "Le projet est vide : dites l'intention d'une première pièce dans l'Atelier, ou chargez la démonstration depuis l'accueil.", screen: "shop", ref: null, hash: "#/shop" });
  for (const p of parts) {
    const others = new Set(); for (const q of parts) if (q !== p) for (const it of q.interfaces || []) if (it && it.key) others.add(it.key);
    out.push(...partIssues(p, others));
  }
  for (const a of asms) out.push(...assemblyIssues(a, byId));
  out.push(...teamIssues(project));
  if (asms.length) { const placed = new Set(asms.flatMap((a) => (a.instances || []).map((i) => i.part)));
    for (const p of parts) if (!placed.has(p.id)) out.push({ level: "tip", text: `${p.id} — dans le projet, mais dans aucun assemblage.`, screen: "assembly", ref: p.id, hash: `#/assembly/${encodeURIComponent(asms[0].id)}` }); }
  return out;
}
/** The entries that concern a screen : those of its kind, narrowed to the part or assembly it shows when there is one. */
export function issuesHere(list, screen, ref) {
  const kind = screen === "parts" || screen === "shop" ? "parts" : screen;
  return (list || []).filter((x) => (x.screen === kind || (screen === "shop" && x.screen === "shop")) && (!ref || !x.ref || x.ref === ref));
}
