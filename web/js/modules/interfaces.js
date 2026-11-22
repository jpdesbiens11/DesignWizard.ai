/* DesignOrbit.ai — Interfaces: the entry point of a part. The user names the part and its neighbours; the platform
   gathers the interfaces those neighbours already expose ("anticipated interfaces"), writes the generic prompt, and
   turns the pasted interview result into a built part. Second tab: the interface register of the project. */

import { el, clear, icon, btn, badge, field, toast, copyText, table, fmt } from "../core/dom.js";
import { registerModule, go, setStatus } from "../core/app.js";
import { store } from "../core/store.js";
import { openInstances } from "../core/asm_levels.js";
import { kernel } from "../cad/client.js";
import { partPrompt, anticipatedInterfaces, revisionPrompt } from "../core/prompts.js";
import { extractJson, kindOf, importPart } from "../core/importer.js";
import { validateSpec } from "../cad/build.js";
import { INTERFACE_TYPES, interfaceSignature } from "../cad/interfaces.js";
import { PROCESSES, materialMenu, materialLabel } from "../cad/materials.js";
import { Viewer } from "../core/viewer.js";
import { showBuilt } from "../core/viewport.js";
import { autoMate } from "../core/assembly_logic.js";

const draft = { name: "", fn: "", neighbours: [], extras: [], family: "", process: "", material: "", constraints: "", mode: "interview", answer: "", revise: "", request: "" };

function render(main, args) {
  const tab = args[0] === "registre" ? "registre" : "entrevue";
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Interfaces"),
    el("p", { class: "muted" }, "Une pièce commence par ses interfaces avec ses voisines. Décrivez-la, copiez le prompt générique dans Claude, répondez à l'entrevue, puis collez la réponse ici : la pièce est construite, prête à se mater."))),
    null);
  let cleanup = null;
  if (tab === "registre") register(page); else cleanup = interview(page);
  return cleanup;
}

/* ---------- the interview ---------- */
function interview(page) {
  const p = store.project;
  let viewer = null, preview = null;
  const steps = el("ol", { class: "steps" }, ["Décrire la pièce et ses voisins", "Copier le prompt dans Claude", "Coller la réponse", "Créer la pièce"].map((s) => el("li", null, s)));
  const cols = el("div", { class: "two-col" });
  page.append(steps, cols);
  const mark = (n) => [...steps.children].forEach((li, i) => { li.className = i < n ? "done" : i === n ? "now" : ""; });

  /* 1. describe */
  const name = el("input", { type: "text", value: draft.name, placeholder: "Ex. : Support de capteur de position" });
  const fn = el("input", { type: "text", value: draft.fn, placeholder: "Ex. : Tient le capteur face à l'aimant du rotor, réglable de ± 1 mm" });
  const cons = el("textarea", { rows: 3, value: draft.constraints, placeholder: "Enveloppe disponible, efforts, température, tension, quantité, étanchéité…" });
  cons.style.fontFamily = "var(--font)"; cons.style.fontSize = ".9rem";
  const proc = el("select", null, el("option", { value: "" }, "Laisser Claude proposer"), Object.entries(PROCESSES).filter(([k]) => k !== "purchased").map(([k, v]) => el("option", { value: k, selected: k === draft.process }, v.label)));
  const mat = el("select", null, el("option", { value: "" }, "Laisser Claude proposer"), materialMenu((m) => m.id !== "GENERIC-COMPONENT").map((f) => el("optgroup", { label: f.family }, f.list.map((m) => el("option", { value: m.id, selected: m.id === draft.material }, materialLabel(m))))));
  const neigh = el("div");
  for (const part of p.parts) {
    const cb = el("input", { type: "checkbox", checked: draft.neighbours.includes(part.id), onChange: () => { draft.neighbours = cb.checked ? [...draft.neighbours, part.id] : draft.neighbours.filter((x) => x !== part.id); update(); } });
    neigh.append(el("label", { class: "check", style: { display: "flex" } }, cb, el("span", null, `${part.name || part.id} `, el("small", { class: "muted" }, `${part.id} · ${(part.interfaces || []).length} interface(s)`))));
  }
  if (!p.parts.length) neigh.append(el("p", { class: "muted" }, "Aucune pièce dans le projet : cette pièce définira les premières interfaces."));
  const antBox = el("div"), extraBox = el("div");
  const exType = el("select", null, Object.entries(INTERFACE_TYPES).map(([k, t]) => el("option", { value: k }, t.label))), exPartner = el("input", { type: "text", placeholder: "Voisin à venir (ex. : moteur, capot, faisceau)" });
  const modeSel = el("select", null, el("option", { value: "interview", selected: draft.mode !== "direct" }, "Entrevue : Claude pose ses questions d'abord"), el("option", { value: "direct", selected: draft.mode === "direct" }, "Direct : Claude répond tout de suite avec ses hypothèses"));
  const left = el("div", { class: "card taped" }, el("h2", null, "1. La pièce et ses voisins"),
    el("div", { class: "form-row" }, field("Nom de la pièce", name), field("Procédé envisagé", proc), field("Matériau envisagé", mat)),
    field("Fonction (une phrase)", fn), field("Contexte et contraintes", cons),
    el("h3", null, "Pièces voisines déjà dans le projet"), neigh,
    el("h3", { style: { marginTop: ".8rem" } }, "Interfaces anticipées ", el("small", { class: "muted" }, "(générées depuis les voisins cochés)")), antBox,
    el("h3", { style: { marginTop: ".8rem" } }, "Autres interfaces à prévoir"), extraBox,
    el("div", { class: "form-row" }, field("Type", exType), field("Avec", exPartner), btn("Ajouter", () => { draft.extras.push({ type: exType.value, partner: exPartner.value.trim() || "?" }); exPartner.value = ""; update(); }, { icon: "plus" })),
    field("Déroulement", modeSel));

  /* 2. prompt */
  const promptBox = el("div", { class: "prompt-box", tabindex: "0" });
  const right = el("div", null,
    el("div", { class: "card taped", style: { marginBottom: "1rem" } }, el("h2", null, "2. Le prompt générique"),
      el("p", { class: "muted", style: { fontSize: ".86rem" } }, "Copiez-le dans une conversation avec Claude (claude.ai ou l'application). Il contient le projet, les interfaces anticipées et le langage de la réponse."),
      promptBox, el("div", { class: "form-actions" }, el("span", { class: "muted", id: "prompt-size", style: { marginRight: "auto", fontSize: ".8rem" } }),
        el("a", { class: "btn", href: "https://claude.ai/new", target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Ouvrir Claude"),
        btn("Copier le prompt", async () => { toast((await copyText(promptBox.textContent)) ? "Prompt copié : collez-le dans Claude." : "Copie impossible : sélectionnez le texte à la main.", "success"); mark(2); }, { primary: true, icon: "copy" }))));

  /* 3. paste the answer */
  const answer = el("textarea", { rows: 8, spellcheck: false, value: draft.answer, "aria-label": "Réponse de Claude à coller", placeholder: "Collez ici la réponse complète de Claude (le bloc JSON suffit, le reste du texte est ignoré)." });
  const verdict = el("div"), holder = el("div", { class: "viewport", style: { height: "300px", border: "1.4px dashed rgba(38,50,63,.3)", borderRadius: "14px", marginTop: ".6rem" } });
  holder.classList.add("hidden");
  const create = btn("Créer la pièce", () => createPart(), { primary: true, icon: "check", disabled: true });
  const mateBox = el("input", { type: "checkbox", checked: true });
  right.append(el("div", { class: "card taped" }, el("h2", null, "3. La réponse de l'entrevue"), answer,
    el("div", { class: "form-actions" }, btn("Coller", async () => { try { answer.value = await navigator.clipboard.readText(); check(); } catch (e) { toast("Presse-papiers inaccessible : collez avec Ctrl+V dans la zone.", "warn"); } }, { icon: "paste" }),
      btn("Vérifier et prévisualiser", () => check(), { icon: "play" })),
    verdict, holder,
    el("div", { class: "form-actions" }, p.assemblies.length ? el("label", { class: "check", style: { marginRight: "auto" } }, mateBox, `Ajouter à l'assemblage ${p.assemblies[0].id} et mater ses interfaces`) : null, create)));
  cols.append(left, right);

  for (const [input, key] of [[name, "name"], [fn, "fn"], [cons, "constraints"], [proc, "process"], [mat, "material"], [modeSel, "mode"]]) input.addEventListener("input", () => { draft[key] = input.value; update(); });
  answer.addEventListener("input", () => { draft.answer = answer.value; });

  function update() {
    const ant = anticipatedInterfaces(p, draft.neighbours);
    clear(antBox);
    if (!ant.length) antBox.append(el("p", { class: "muted", style: { fontSize: ".86rem" } }, draft.neighbours.length ? "Les voisins cochés n'ont pas d'interface libre." : "Cochez les voisins : leurs interfaces libres deviennent les interfaces imposées de la nouvelle pièce."));
    for (const a of ant) antBox.append(el("p", { style: { margin: "0 0 .3rem", fontSize: ".86rem" } }, badge(`côté ${a.iface.side}`, a.iface.side === "B" ? "b" : "a"), " ", el("b", null, a.iface.name), ` — ${INTERFACE_TYPES[a.iface.type].label}, clé `, el("code", null, a.iface.key), ` (face à ${a.from.name})`));
    clear(extraBox);
    draft.extras.forEach((e, i) => extraBox.append(el("p", { style: { margin: "0 0 .3rem", fontSize: ".86rem" } }, badge("à définir", "warn"), ` ${INTERFACE_TYPES[e.type].label} avec « ${e.partner} » `, el("button", { class: "link-btn", type: "button", onClick: () => { draft.extras.splice(i, 1); update(); } }, "retirer"))));
    const text = partPrompt(p, draft);
    promptBox.textContent = text;
    page.querySelector("#prompt-size").textContent = `${text.length.toLocaleString("fr-CA")} caractères`;
    mark(draft.answer ? 2 : 1 - (draft.name ? 0 : 1) + (draft.name ? 0 : 0));
  }

  async function check() {
    clear(verdict); create.disabled = true; preview = null;
    const obj = extractJson(answer.value), kind = kindOf(obj);
    if (kind !== "part") { verdict.append(el("p", { class: "form-error" }, obj ? "Ce document n'est pas une pièce DesignOrbit.ai (il manque « stock », « features », « extrusion » ou « pcb »). Correctif : demandez à Claude « réponds par la pièce part/1 complète »." : extractJson.error ? `Document .dwiz illisible — ${extractJson.error}` : "Aucune pièce trouvée dans le texte collé (ni JSON, ni .dwiz). Correctif : collez la réponse entière, bloc de code compris.")); return; }
    const v = validateSpec(obj);
    if (v.errors.length) { verdict.append(el("p", { class: "form-error" }, v.errors.join("\n"))); return; }
    if (!obj.id) obj.id = store.nextPartId();
    verdict.append(el("p", { class: "muted" }, "Construction de l'aperçu…"));
    try {
      const built = await kernel.build(obj, null, "~preview");
      clear(verdict);
      const errs = built.log.filter((l) => l.level === "error"), warns = built.log.filter((l) => l.level === "warn");
      const ant = anticipatedInterfaces(p, draft.neighbours), got = built.interfaces;
      const matched = ant.filter((a) => got.some((g) => g.key === a.iface.key && g.type === a.iface.type && g.side === a.iface.side && interfaceSignature(g) === interfaceSignature({ type: a.iface.type, params: a.iface.params })));
      verdict.append(el("p", null, badge(errs.length ? `${errs.length} erreur(s)` : "Pièce construite", errs.length ? "danger" : "ok"), " ", el("b", null, `${obj.id} — ${obj.name || ""}`), ` · ${fmt(built.mass, 1)} g · ${got.length} interface(s)`,
        ant.length ? ` · ${matched.length} / ${ant.length} interface(s) anticipée(s) respectée(s)` : ""));
      for (const a of ant.filter((x) => !matched.includes(x))) verdict.append(el("p", { class: "form-error" }, `Interface anticipée non respectée : « ${a.iface.name} » (clé ${a.iface.key}, côté ${a.iface.side}). Correctif : demandez à Claude de reprendre exactement son "type", sa "key" et ses "params".`));
      for (const l of [...errs, ...warns]) verdict.append(el("p", { class: l.level === "error" ? "form-error" : "muted", style: { fontSize: ".84rem" } }, l.msg));
      for (const w of v.warnings) verdict.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, w));
      holder.classList.remove("hidden");
      if (!viewer) viewer = new Viewer(holder, {});
      viewer.clear(); showBuilt(viewer, built, { prefix: "prev" });
      for (const it of built.interfaces) { viewer.addFrame(it.frame, it.side === "A" ? "#9b7bff" : "#2ec4b6"); viewer.addLabel(it.frame.o, `${it.id} · ${it.side}`, "label", "iface"); }
      viewer.view("iso");
      if (built.bodies.length) { preview = obj; create.disabled = false; mark(3); }
      setStatus("Aperçu construit", "done");
    } catch (e) { clear(verdict); verdict.append(el("p", { class: "form-error" }, e.message)); }
  }

  function createPart() {
    if (!preview) return;
    const r = importPart(preview, { replace: true });
    if (r.errors.length) { toast(r.errors.join(" "), "error"); return; }
    if (mateBox.checked && p.assemblies.length && !r.replaced) {
      const asm = p.assemblies[0];
      store.updateAssembly(asm.id, (a) => { a.instances.push({ id: `i${Date.now().toString(36)}`, part: r.id, placement: { t: [0, 0, 0], r: [0, 0, 0] } }); a.pendingAutoMate = true; }, `${r.id} ajoutée à ${asm.id}`);
    }
    draft.answer = ""; draft.name = ""; draft.fn = ""; draft.extras = [];
    toast(`Pièce ${r.id} ${r.replaced ? "mise à jour" : "créée"}.`, "success");
    const s = store.part(r.id);
    go(mateBox.checked && p.assemblies.length && !r.replaced ? `#/assembly/${encodeURIComponent(p.assemblies[0].id)}` : `#/${s.family === "pcb" ? "pcb" : s.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(r.id)}`);
  }

  /* revise an existing part */
  const revSel = el("select", null, el("option", { value: "" }, "Choisir une pièce…"), p.parts.filter((x) => !x.step).map((x) => el("option", { value: x.id }, `${x.id} — ${x.name || ""}`)));
  const revReq = el("input", { type: "text", placeholder: "Ex. : ajoute deux nervures sous la semelle et passe les vis en M4" });
  page.append(el("div", { class: "card", style: { marginTop: "1rem" } }, el("h2", null, "Modifier une pièce existante avec Claude"),
    el("p", { class: "muted", style: { fontSize: ".86rem" } }, "Le prompt contient la pièce actuelle et votre demande. Collez ensuite la réponse dans la zone 3 : la pièce est mise à jour (même numéro), ses liens d'interface sont conservés."),
    el("div", { class: "form-row" }, field("Pièce", revSel), field("Demande", revReq),
      btn("Copier le prompt de modification", async () => { const s = store.part(revSel.value); if (!s) { toast("Choisissez la pièce à modifier.", "warn"); return; } toast((await copyText(revisionPrompt(p, s, revReq.value))) ? "Prompt de modification copié." : "Copie impossible.", "success"); }, { icon: "copy" }))));
  update();
  return () => { if (viewer) viewer.dispose(); kernel.forget("~preview").catch(() => {}); };
}

/* ---------- the register (ICD) ---------- */
function register(page) {
  const p = store.project, rows = [], mated = new Map();
  for (const a of p.assemblies) for (const m of a.mates || []) for (const [me, other] of [[m.a, m.b], [m.b, m.a]]) {
    const open = openInstances(a, (x) => store.assembly(x)), inst = open.find((i) => i.id === me.inst), o = open.find((i) => i.id === other.inst);      // through the levels
    if (inst && o) mated.set(`${inst.part}/${me.iface}`, `${o.part} (${a.id}${m.linked === false ? ", non liée" : ""})`);
  }
  const byKey = new Map();
  for (const part of p.parts) for (const it of part.interfaces || []) { const k = it.key || `(sans clé) ${part.id}/${it.id}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push({ part, it }); }
  for (const [key, list] of byKey) for (const { part, it } of list) {
    const t = INTERFACE_TYPES[it.type], link = mated.get(`${part.id}/${it.id}`);
    rows.push([el("code", null, key), t ? t.fr : it.type, badge(`côté ${it.side || "A"}`, it.side === "B" ? "b" : "a"), el("a", { href: `#/parts/${encodeURIComponent(part.id)}` }, `${part.id} — ${part.name || ""}`), it.name || "", it.partner || "—",
      link ? badge(`liée à ${link}`, "ok") : list.length > 1 ? badge("prête à mater", "info") : badge("libre", "warn")]);
  }
  page.append(el("p", { class: "muted" }, "Toutes les interfaces du projet, regroupées par clé : le document de contrôle des interfaces (ICD) se tient tout seul. « Libre » = aucun voisin ne la porte encore ; cochez la pièce comme voisine dans l'entrevue de la pièce suivante."));
  if (!rows.length) page.append(el("div", { class: "empty" }, el("h2", null, "Aucune interface pour l'instant"), el("p", null, "Créez une première pièce par l'entrevue ou depuis un gabarit.")));
  else page.append(table(["Clé", "Type", "Côté", "Pièce", "Nom", "Voisin attendu", "État"], rows));
}

registerModule({ key: "interfaces", label: "Interfaces", icon: "interfaces", hidden: true, tip: "Le point d'entrée d'une pièce : interfaces anticipées, prompt générique, réinjection de l'entrevue", render });
