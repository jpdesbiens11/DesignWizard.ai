/* DynamiteOrbit.ai — Logiciel : two pieces of the left panel (demande de JP, 24 novembre 2026).
   THE LIBRARY, as bricks : a row of packs — « Commun embarqué » first, then the domains (battery, robot, power drive, standalone device) —,
   then the bricks of the pack chosen, grouped by family in the order of the flow (board inputs → acquire → decide → regulate → command →
   board outputs), each brick in the colour of its family with the keys of its inputs and outputs. A brick the tool cannot run yet is shown
   dashed, « à venir », and is not placed. The usage followed : the palette of a block-diagram tool, grouped by category.
   THE REQUIREMENTS IN : « Copier le prompt (format standard) » gives an assistant what it needs to turn the project's own requirements into
   `dynamiteorbit/sw-requirements@1` ; « Importer des exigences… » reads the answer (pasted or a .json file), shows what would be made — the
   blocks, their values coloured by where they come from, the planned blocks, the notes — and applies it in ONE undoable step. */

import { el, icon, btn, toast, copyText, modal, field } from "../core/dom.js";
import { store } from "../core/store.js";
import { KINDS, portsOf } from "../sw/sw_objects.js";
import { LIBRARY, PACKS, FAMILIES, SIGNAL_TYPES, typeOf } from "../sw/sw_blocks.js";
import { reqPrompt, parseReqs, planImport, REQ_FORMAT } from "../sw/sw_req_import.js";
import { DEVICES } from "../sw/sw_devices.js";
import { applyAnswer } from "./ai_loop.js";

const keys = (kind, dir) => { const P = portsOf({ kind, params: {} })[dir]; return el("span", null, P.map((p) => { const t = SIGNAL_TYPES[typeOf(p.unit)]; return el("i", { class: t.shape, style: `--wt:${t.color}`, title: `${p.label} — ${t.fr}` }); })); };
/** The library. o : { pack (an id of PACKS or "all"), setPack(id), add(kind), used (Set of kinds in the design) } → a side-section */
export function libraryPalette(o) {
  const pack = o.packs === false ? "all" : o.pack || "all", items = LIBRARY.filter((x) => (pack === "all" || x.pack === pack) && (o.planned !== false || !x.planned) && (o.rawPins !== false || !(x.kind && KINDS[x.kind] && KINDS[x.kind].pin) && x.kind !== "analog_in") && (!o.only || o.only(x)));
  const chip = (id, label, color, ic) => el("button", { type: "button", class: `swb-pack${pack === id ? " on" : ""}`, style: `--dom:${color}`, "aria-pressed": pack === id ? "true" : "false", "data-sw-pack": id, onClick: () => o.setPack(id) }, ic ? icon(ic) : null, label);
  const brick = (x) => { const F = FAMILIES.find((f) => f.id === x.family), P = PACKS.find((p) => p.id === x.pack);
    if (x.planned) return el("button", { type: "button", class: "swb-brick planned", style: `--dom:${F.color}`, "aria-disabled": "true", "data-sw-planned": x.id, "data-tip": `${x.label} (${x.fr}) — ${x.text} Pas encore dans l'outil : il ne se pose pas. Une exigence peut déjà le nommer.`, onClick: () => toast(`« ${x.label} » est à venir : l'outil ne sait pas encore le faire tourner ni l'écrire en C. Une exigence importée qui le nomme est gardée, allouée à rien.`, "info", 6000) },
      el("span", { class: "swb-soon" }, "à venir"), el("b", null, icon(F.icon), x.label), el("small", null, `${x.fr} · ${P.fr}`));
    if (x.device) { const D = DEVICES[x.device], k = D.side === "actuator" ? "pin_dout" : D.measure ? "analog_in" : D.debounce ? "debounce" : D.pin;
      return el("button", { type: "button", class: "swb-brick device", style: `--dom:${F.color}`, "data-device": x.device, "data-tip": `${D.label} (${D.fr}) — ${D.text} Un clic pose ${D.side === "actuator" ? "la broche qui le commande" : "sa broche et ce qui la lit, reliés"} ; ses valeurs typiques sont à confirmer.`, onClick: () => o.addDevice(x.device) },
        el("b", null, icon(D.icon || F.icon), D.label), el("small", null, D.fr), el("span", { class: "swb-keys" }, D.side === "actuator" ? keys("pin_dout", "in") : el("span"), D.side === "actuator" ? el("span") : keys(k, "out"))); }
    const K = KINDS[x.kind]; return el("button", { type: "button", class: `swb-brick${o.used && o.used.has(x.kind) ? " used" : ""}`, style: `--dom:${F.color}`, "data-kind": x.kind, "data-tip": `${K.label} (${K.fr}) — ${K.text} Un clic le pose.`, onClick: () => o.add(x.kind) },
      el("b", null, icon(K.icon || F.icon), K.label), el("small", null, K.fr), el("span", { class: "swb-keys" }, keys(x.kind, "in"), keys(x.kind, "out"))); };
  return el("div", { class: "side-section", "data-box": "kinds", "data-fold-note": `${items.filter((x) => !x.planned).length} briques · ${items.filter((x) => x.planned).length} à venir` }, el("h3", null, "La bibliothèque de blocs"),
    el("p", { class: "muted small" }, o.packs === false ? "Un clic pose la brique : elle s'emboîte toute seule. Un capteur mesure, une décision choisit, un actionneur agit." : "Le commun d'abord — ce que tout logiciel embarqué porte —, puis les blocs d'un domaine. Les clés à gauche et à droite d'une brique disent ce qu'elle reçoit et ce qu'elle donne."),
    o.packs === false ? null : el("div", { class: "swb-packs", role: "group", "aria-label": "Les domaines de la bibliothèque" }, chip("all", "Tout", "#475569"), PACKS.map((p) => chip(p.id, p.fr, p.color, p.icon))),
    FAMILIES.map((F) => { const mine = items.filter((x) => x.family === F.id); return mine.length ? [el("p", { class: "swb-fam", style: `--dom:${F.color}`, "data-tip": F.text }, `${F.fr} — ${F.label}`), el("div", { class: "swb-lib" }, mine.map(brick))] : null; }));
}

/** Puts a plan in the project : the design of the software replaced by what the import makes of it, one undoable step. */
function apply(plan, label) { applyAnswer([], label, () => store.commit(label, (p) => { p.software = p.software || []; if (p.software[0]) p.software[0] = plan.design; else p.software.push(plan.design); })); }      // into the journal of the answers : « Revenir à avant » undoes it even later (core/ai_door.js)
/** The box of the requirements in. o : { design() → the design or null } → a side-section */
export function reqImportSection(o) {
  const copy = btn("Copier le prompt (format standard)", async () => toast((await copyText(reqPrompt())) ? "Copié : collez-le dans votre assistant, avec votre document d'exigences. Sa réponse s'importe ici." : "Copie impossible.", "success", 6000), { small: true, icon: "sparkle", tip: `La consigne qui fait d'un document d'exigences le format standard « ${REQ_FORMAT} », avec la liste des blocs et de leurs valeurs` });
  const imp = btn("Importer des exigences…", () => openImport(o), { small: true, primary: !o.design(), icon: "upload", tip: "Coller la réponse ou ouvrir un .json : l'aperçu dit ce qui serait créé, puis une seule étape annulable" });
  copy.dataset.swReqPrompt = ""; imp.dataset.swReqImport = "";
  return el("div", { class: "side-section swb-import", "data-box": "reqin", "data-fold-note": "format standard" }, el("h3", null, "Partir des exigences"),
    el("p", { class: "muted small" }, "Vos exigences restent chez vous. L'outil les lit dans une structure standard : un assistant y convertit votre document avec le prompt, puis l'outil pose les blocs, leurs valeurs et leurs fils, de gauche à droite."),
    el("div", { class: "side-actions" }, copy, imp),
    el("p", { class: "small" }, el("span", { class: "swb-val req" }, "vert"), " donné par une exigence · ", el("span", { class: "swb-val ref" }, "ambre"), " valeur de référence à confirmer · ", el("span", { class: "swb-val sure" }, "bleu"), " confirmé"));
}
/* the loose ends the import would leave, said before anything is applied (sw/sw_req_import.js looseEnds) */
const LOOSE = { "signal-in": "Signal lu par aucun bloc", "signal-out": "Sortie commandée par aucun bloc", input: "Entrée de bloc reliée à rien", planned: "Bloc encore à venir", none: "Exigence portée par aucun bloc" };
function looseBox(list = []) {
  const real = list.filter((x) => x.kind !== "planned" && x.kind !== "none"), rest = list.length - real.length;
  return el("div", { class: `swb-loose ${real.length ? "bad" : "ok"}`, "data-sw-loose": String(real.length) },
    el("p", null, icon(real.length ? "warning" : "check"), real.length ? ` ${real.length} bout${real.length > 1 ? "s" : ""} libre${real.length > 1 ? "s" : ""} : des signaux ou des entrées que le fichier ne relie pas.` : " Aucun bout libre : chaque signal est lu ou commandé, chaque entrée de bloc est reliée.", rest ? ` ${rest} exigence${rest > 1 ? "s" : ""} sans bloc qui tourne (à venir, ou à vérifier par analyse).` : ""),
    list.length ? el("ul", { class: "small" }, list.map((x) => el("li", { class: x.kind }, el("b", null, LOOSE[x.kind]), " — ", x.text))) : null);
}
export function openImport(o) {
  const area = el("textarea", { rows: 10, placeholder: `Collez la réponse de l'assistant (un bloc \`\`\`json au format ${REQ_FORMAT}) ou l'export .csv des exigences de DynamiteAgile — ou ouvrez le fichier.`, "data-sw-req-text": "" }), out = el("div", { "data-sw-req-plan": "" });
  const file = el("input", { type: "file", accept: ".json,.csv,application/json,text/csv,text/plain", onChange: async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; area.value = await f.text(); read(); } });
  let plan = null, mode = null;
  /* into the software there is, or a new software made of this file alone — what JP tried : a list merged into the BM left loose ends */
  const modeBox = el("div", { class: "swb-mode", role: "radiogroup", "aria-label": "Où vont ces exigences", hidden: true });
  const setMode = (m2) => { mode = m2; for (const b of modeBox.children) { const on = b.dataset.mode === m2; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); } read(true); };
  for (const [k, t, tip] of [["new", "Un logiciel neuf, fait de ce fichier", "Le logiciel actuel est remplacé — une étape annulable (Ctrl + Z, ou « Revenir à avant » du journal)"], ["merge", "Compléter le logiciel actuel", "Ses blocs sont gardés ; une exigence déjà là (même identifiant) reçoit son bloc si elle n'en a pas"]])
    modeBox.append(el("button", { type: "button", role: "radio", "data-mode": k, "data-tip": tip, onClick: () => setMode(k) }, t));
  const ok = btn("Poser les blocs", () => { if (!plan) return; apply(plan, `Logiciel : ${plan.counts.reqs} exigences importées`); m.close(); toast(`${plan.counts.blocks} blocs posés de gauche à droite, ${plan.counts.reqs} exigences à confirmer. Ctrl + Z pour revenir.`, "success", 6000); }, { primary: true, icon: "check", disabled: true }); ok.dataset.swReqApply = "";
  function read(keep) {
    plan = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return; const r = parseReqs(area.value);
    if (!r.ok) { out.append(el("ul", { class: "form-error" }, r.errors.map((t) => el("li", null, t)))); return; }
    const d0 = o.design(); modeBox.hidden = !d0;
    if (d0 && !keep) { const whole = Array.isArray(r.data.signals) && r.data.signals.length > 0; mode = whole ? "new" : "merge"; /* a file that declares its signals IS a software : a new one ; a bare list of requirements completes the one there is */ for (const b of modeBox.children) { const on = b.dataset.mode === mode; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); } }
    plan = planImport(r.data, d0 && mode === "merge" ? d0 : null); if (d0 && mode === "new") plan.design.cpu = d0.cpu; ok.disabled = !plan.counts.reqs;
    const C = plan.counts, box = (n, t) => el("div", null, el("b", null, String(n)), el("span", null, t));
    out.append(...[el("div", { class: "swb-counts" }, box(C.reqs, "exigences"), box(C.blocks, "blocs posés"), box(plan.signals.length, "signaux de la carte"), box(C.fromReq, "valeurs données"), box(C.reference, "valeurs de référence"), box(C.planned, "blocs à venir")),
      r.from === "dynamiteagile" ? el("p", { class: "lab-note", "data-sw-agile": "" }, icon("check"), ` Export de DynamiteAgile lu. ${(r.notes || []).join(" ")} Aucun bloc n'est encore nommé : posez-les, ou passez la liste à l'IA (bouton « IA », étape 1).`) : null,
      o.design() && mode === "merge" ? el("p", { class: "small" }, icon("info"), " Le logiciel existant est gardé : une exigence déjà là (même identifiant) n'est pas doublée — elle reçoit son bloc si elle n'en a pas. Ses propres blocs et ceux du fichier ne se relient pas d'eux-mêmes : attendez-vous à des bouts libres.") : null,
      looseBox(plan.loose),
      el("ul", { class: "swb-plan" }, plan.rows.map((row) => { const K = KINDS[row.block];
        return el("li", { class: row.state, "data-sw-plan-row": row.id }, el("b", null, row.id), " — ", row.text,
          el("div", { class: "small muted" }, row.state === "kept" ? "→ déjà là, avec son bloc : gardée telle quelle" : row.state === "made" ? `→ bloc « ${K.label} »` : row.state === "planned" ? `→ « ${row.block} » est à venir : l'exigence est gardée, allouée à rien` : "→ aucun bloc nommé : l'exigence est gardée"),
          row.values.length ? el("div", { class: "swb-vals" }, row.values.map((v) => el("span", { class: `swb-val ${v.source}`, title: v.source === "req" ? "Donnée par l'exigence" : "Valeur de référence du bloc : à confirmer" }, `${v.key} ${v.value}`))) : null); })),
      plan.notes.length ? el("ul", { class: "small", "data-sw-req-notes": String(plan.notes.length) }, plan.notes.map((t) => el("li", null, icon("warning"), " ", t))) : null].filter(Boolean));
  }
  area.addEventListener("input", () => read());
  const m = modal("Partir des exigences — format standard", [el("p", { class: "muted small" }, "Les exigences importées arrivent « à confirmer » : elles sont passées par un assistant, et la réponse d'un assistant ne confirme rien. Confirmer une exigence (étape 1) confirme les valeurs qu'elle donne."),
    field("Réponse de l'assistant ou fichier", area), modeBox, el("label", { class: "field" }, el("span", { class: "field-label" }, "Ou un fichier (.json, ou .csv de DynamiteAgile)"), file), out,
    el("div", { class: "form-actions" }, btn("Copier le prompt", async () => toast((await copyText(reqPrompt())) ? "Prompt copié." : "Copie impossible.", "success"), { small: true, icon: "sparkle" }), btn("Annuler", () => m.close()), ok)], { wide: true });
  if (o.text) { area.value = o.text; read(); }      // the requirements of the product allocated to the software (modules/reqs_page.js) : read at once, applied only by « Poser les blocs »
  return m;
}
