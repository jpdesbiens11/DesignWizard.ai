/* DynamiteOrbit.ai — Logiciel : the « IA » button of the group (demande de JP, 24 novembre 2026 : « dans Exigences, l'option d'importer une liste
   d'exigences SW de DynamiteAgile et te la donner en 1 ; il faut que tu me donnes le prompt du format souhaité via l'icône IA, comme les autres
   pages… l'expert gratte en export / import avec une IA LLM externe, puis on réinjecte par la fonction IA »).
   Two moves, as on every page : 1. COPY what goes to the assistant — the standard structure of the requirements, the blocks of the library,
   and what the project already has (its requirements with their ids, its pins, the nets of its board) ; 2. PASTE what comes back — the answer
   of the assistant, or straight the CSV export of the requirements of DynamiteAgile — : a preview, then one undoable step, written in the journal
   of the answers (core/ai_door.js). For the expert, the whole software as JSON, its round trip as before (modules/sw_sheet.js).
   The tool calls no assistant : the text is copied, the answer pasted. */

import { el, btn, toast, copyText, modal, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { reqPromptWith, REQ_FORMAT } from "../sw/sw_req_import.js";
import { hostBoard, mcuNets } from "../sw/sw_blocks.js";
import { openImport } from "./sw_lib_ui.js";
import { aiText, reimport } from "./sw_sheet.js";
import { level } from "./sw_level_ui.js";

const design = () => (store.project && (store.project.software || [])[0]) || null;
/** key : "sw:req" (the requirements) or "sw:design" (the software). */
export function openSwAi(key) {
  if (!store.project) { toast("Ouvrez d'abord un projet.", "info"); return null; }
  const d = design(), b = hostBoard(store.project, d), nets = mcuNets(b), m0 = { close() {} };
  const card = (n, color, ic, title, says, ...actions) => el("div", { class: "swai-card", style: `--dom:${color}` }, el("span", { class: "swai-n" }, String(n)), icon(ic, "swai-ico"), el("div", null, el("b", null, title), el("p", null, says), el("div", { class: "form-actions" }, ...actions)));
  const copy = btn("Copier le prompt", async () => toast((await copyText(reqPromptWith(d, b, nets))) ? "Copié : collez-le dans votre assistant, avec votre liste d'exigences (ou l'export de DynamiteAgile)." : "Copie impossible.", "success", 6000), { primary: true, icon: "copy" }); copy.dataset.swAiPrompt = "";
  const paste = btn("Coller la réponse ou un fichier…", () => { m.close(); openImport({ design }); }, { primary: true, icon: "upload" }); paste.dataset.swAiImport = "";
  const expert = key === "sw:design" || level() === "expert";
  const m = modal(key === "sw:req" ? "IA — les exigences du logiciel" : "IA — le logiciel", [
    el("p", { class: "muted small" }, `Format standard : « ${REQ_FORMAT} ». Vos exigences restent chez vous ; l'assistant les convertit, l'outil pose les blocs.`),
    card(1, "#2563eb", "sparkle", "Copier le prompt", `La consigne, la liste des blocs, et ce que le projet a déjà : ${(d && (d.reqs || []).length) || 0} exigence(s), ${b ? `la carte « ${b.name || b.id} » et ses ${nets.length} nets` : "aucune carte avec un microcontrôleur"}. Collez-le dans votre assistant avec votre liste — ou l'export .csv de DynamiteAgile.`, copy),
    card(2, "#16a34a", "upload", "Coller la réponse", "La réponse de l'assistant, ou directement l'export .csv des exigences de DynamiteAgile (Goldmine → Exporter). Vous voyez ce qui sera posé avant d'appliquer — une seule étape, annulable.", paste),
    expert && d ? card(3, "#dc2626", "code", "Expert — tout le logiciel", "Les blocs, les fils, le CPU et la consigne, pour une revue complète par un assistant ; la réponse revient avec l'aperçu de chaque changement.",
      btn("Copier tout le logiciel", async () => toast((await copyText(aiText(d))) ? "Copié : le logiciel entier et la consigne." : "Copie impossible.", "success", 4000), { small: true, icon: "copy" }),
      btn("Réimporter…", () => { m.close(); reimport(design, (label, fn) => store.commit(label, (p) => { if (p.software && p.software[0]) fn(p.software[0]); })); }, { small: true, icon: "upload" })) : null].filter(Boolean), { wide: true });
  return m || m0;
}
