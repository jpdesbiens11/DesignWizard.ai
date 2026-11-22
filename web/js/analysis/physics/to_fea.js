/* DesignWizard.ai — from an analytical model to the simulation, with the same geometry (demande de JP : « passer du module
   Analytique au module Simulation avec la même géométrie, même si ce n'est pas une pièce du produit, et faire un FEA simple »).
   A hand calculation and a simulation of the same thing are worth more together : this file turns the model on the screen —
   its dimensions, its material, its supports and its load — into a small part and its load case, which the Simulation opens
   as it opens any part. The part is a « simplified model » (`study`), an aid to design : it belongs to no assembly, and the
   Shop files it last, under its own nature. One per analytical model : simulating again updates it.
   Only what the simulation can hold exactly is carried : a support is a face, a load is a force or a pressure on a face, one
   material per part. What it cannot hold — a simple support on a line, a torque, a stack of materials, a section given by its
   inertia — is said, and nothing is made. Pure : no page, no store. */

import { model, shortTitle } from "./index.js";
import { medium } from "./media.js";
import { blankCase } from "../fea/case_store.js";

const r3 = (v) => Math.round(v * 1000) / 1000, no = (why) => ({ ok: false, why });
const SHORT = { beam_cantilever_point: "CANT", beam_cantilever_udl: "CANT-UDL", plate_pressure: "PLATE", conduction_stack: "WALL" };
/** The id of the simplified model of an analytical model. */
export const studyId = (modelId) => `MS-${SHORT[modelId] || String(modelId).toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
const structure = (fixed, loads) => ({ ...blankCase(), kind: "structure", fixed, loads });

/* a model → { features, bbox words, case } ; each one says what it cannot carry */
const MAKERS = {
  beam_cantilever_point(i) {
    if (i.section === "rect") return { features: [{ op: "box", id: "bar", name: "Poutre", size: [r3(i.L), r3(i.b), r3(i.h)] }], case: structure(["face:-X"], [{ region: "face:+X", mode: "force", F: i.F, dir: "-Z", p: 0.1 }]), says: `Poutre ${r3(i.L)} × ${r3(i.b)} × ${r3(i.h)} mm le long de X, encastrée sur sa face −X, ${r3(i.F)} N vers −Z sur sa face +X.` };
    if (i.section === "round") return { features: [{ op: "cylinder", id: "bar", name: "Barreau", d: r3(i.d), h: r3(i.L), at: [0, 0, 0], axis: "X" }], case: structure(["face:-X"], [{ region: "face:+X", mode: "force", F: i.F, dir: "-Z", p: 0.1 }]), says: `Barreau rond de ${r3(i.d)} mm et de ${r3(i.L)} mm le long de X, encastré sur sa face −X, ${r3(i.F)} N vers −Z sur sa face +X. Une section ronde est dessinée en escalier par les mailles cubiques : prévoyez une dizaine de mailles dans le diamètre.` };
    return no(i.section === "tube" ? "Un tube ne se reporte pas encore : choisissez une section rectangulaire ou ronde pleine." : "Une section donnée par son inertie n'a pas de forme : la simulation a besoin d'une géométrie. Choisissez une section rectangulaire ou ronde.");
  },
  beam_cantilever_udl(i) {
    if (i.section !== "rect") return no("La charge répartie se reporte comme une pression sur la face du dessus : il faut une section rectangulaire.");
    const p = i.F / (i.L * i.b);
    return { features: [{ op: "box", id: "bar", name: "Poutre", size: [r3(i.L), r3(i.b), r3(i.h)] }], case: structure(["face:-X"], [{ region: "face:+Z", mode: "pressure", F: 100, p: Number(p.toPrecision(6)) }]), says: `Poutre ${r3(i.L)} × ${r3(i.b)} × ${r3(i.h)} mm le long de X, encastrée sur sa face −X ; la charge répartie de ${r3(i.F)} N devient une pression de ${Number(p.toPrecision(4))} MPa sur sa face +Z.` };
  },
  plate_pressure(i) {
    if (i.edges !== "fixed") return no("Des bords simplement appuyés (une ligne sous chaque bord) ne se posent pas d'office dans la simulation : choisissez des bords encastrés, ou posez les appuis à la main.");
    const a = Math.max(i.a, i.b), b = Math.min(i.a, i.b);
    return { features: [{ op: "box", id: "plate", name: "Plaque", size: [r3(a), r3(b), r3(i.t)] }], case: structure(["face:-X", "face:+X", "face:-Y", "face:+Y"], [{ region: "face:+Z", mode: "pressure", F: 100, p: Number((i.p / 1000).toPrecision(6)) }]), cells: 6000,
      says: `Plaque ${r3(a)} × ${r3(b)} × ${r3(i.t)} mm, encastrée sur ses quatre chants, ${Number((i.p / 1000).toPrecision(4))} MPa sur sa face +Z. Une plaque mince demande un maillage fin : au moins deux mailles dans l'épaisseur.` };
  },
  conduction_stack(i) {
    if (i.t2 > 0 || i.t3 > 0 || i.tim_t > 0 || i.Rc > 0) return no("Une pièce de la simulation n'a qu'un matériau : un empilement de couches, une interface thermique ou une résistance de contact se simule comme un assemblage. Mettez les autres couches à zéro pour simuler la première seule.");
    const s = Math.sqrt(i.A);
    return { features: [{ op: "box", id: "wall", name: "Paroi", size: [r3(s), r3(s), r3(i.t1)] }], mat: "mat1", case: { ...blankCase(), kind: "thermal", conv: { on: false, h: 10, Tamb: 25 }, fixedT: [{ region: "face:-Z", T: i.Tc }], power: [{ region: "face:+Z", P: i.P }] },
      says: `Paroi de ${r3(i.A)} mm² (${r3(s)} × ${r3(s)} mm) et de ${r3(i.t1)} mm d'épaisseur : ${r3(i.Tc)} °C imposés sur sa face −Z, ${r3(i.P)} W sur sa face +Z, sans convection.` };
  },
};
/** Which analytical models the simulation can replay. */
export const STUDY_MODELS = Object.keys(MAKERS);
const WHY_NOT = { plastic_screw: "Un filet formé dans un plastique, et son arrachement par cisaillement, ne sont pas un modèle que la simulation tient : elle n'a ni contact ni rupture.", louvre_strip: "Une bande à lamelles se calcule par les valeurs d'une lamelle lues sur la fiche du fabricant : sa géométrie torsadée et ses points de contact ne sont pas un modèle que la simulation tient.", spring_stop: "Le solveur de la simulation est élastique et linéaire : ni la plastification d'une lame, ni le contact qui s'établit à la butée ne s'y calculent.", beam_simple_point: "Des appuis simples (une ligne sous chaque bout) ne se posent pas encore d'office dans la simulation.", beam_simple_udl: "Des appuis simples (une ligne sous chaque bout) ne se posent pas encore d'office dans la simulation.",
  column_buckling: "La simulation est statique et linéaire : elle ne cherche pas la charge de flambement.", shaft_torsion: "La simulation n'applique pas encore de couple.", thermal_mismatch: "Une pièce de la simulation n'a qu'un matériau : deux matériaux assemblés se simulent comme un assemblage." };

/** The simplified model of an analytical model, with its load case.
    inputs : those of the run (run(...).inputs — the values the model really used, media included).
    → { ok: true, id, part (a part/1 document, flagged `study`), case (as project.cases holds it), says (what was carried, in a sentence), notes: [text] }
      or { ok: false, why } */
export function studyOf(modelId, inputs) {
  const m = model(modelId), make = MAKERS[modelId];
  if (!m) return no(`Modèle « ${modelId} » inconnu.`);
  if (!make) return no(WHY_NOT[modelId] || "Ce modèle n'a pas de géométrie que la simulation sache reprendre telle quelle.");
  const made = make(inputs || {}); if (made.ok === false) return made;
  const id = studyId(modelId), slot = made.mat || "mat", med = medium(inputs && inputs[slot]), notes = [];
  if (!med || med.state !== "solid") notes.push("Le calcul utilise des valeurs de matière tapées, pas un média de la base : la simulation prend l'aluminium 6061-T6. Choisissez le média dans le modèle pour que les deux calculs portent sur la même matière.");
  const part = { dw: "part/1", id, name: `Modèle simplifié — ${shortTitle(m)}`, family: "prismatic", process: "cnc_milling", material: med && med.state === "solid" ? med.id : "AL6061-T6", function: `Aide à la conception : la géométrie du modèle analytique « ${m.title} », pour la simuler. Ce n'est pas une pièce du produit.`,
    study: { model: modelId, inputs: JSON.parse(JSON.stringify(inputs || {})) }, params: {}, interfaces: [], features: made.features, notes: ["Modèle simplifié, fait à partir d'un modèle analytique : il n'entre dans aucun assemblage."] };
  return { ok: true, id, part, case: { id, ...made.case, cells: made.cells || made.case.cells }, says: made.says, notes };
}
/** Puts the simplified model and its case into a project (inside ONE step of the store) : the part is made, or updated when it exists ; its case is replaced.
    → the id of the part */
export function putStudy(project, study) {
  const parts = project.parts || (project.parts = []), i = parts.findIndex((p) => p.id === study.id);
  if (i >= 0) parts[i] = { ...parts[i], ...study.part, look: parts[i].look, revision: parts[i].revision || study.part.revision }; else parts.push(study.part);
  project.cases = (project.cases || []).filter((c) => c.id !== study.id); project.cases.push(study.case);
  return study.id;
}
