/* DynamiteOrbit — Extrusion: profiled parts (aluminium or plastic). The cross-section can come from a generator,
   from a template, or from Claude: the prompt lists what must fit INSIDE and what sits OUTSIDE the profile. The tab
   "Profil" shows the section with those envelopes and the measurements the extrusion DFM rules use. */

import { el, clear, icon, btn, badge, field, toast, copyText, fmt, svg as S } from "../core/dom.js";
import { registerModule, go, app } from "../core/app.js";
import { store } from "../core/store.js";
import { partStudio, newPartDialog } from "./part_studio.js";
import { extrusionPrompt } from "../core/prompts.js";
import { importAny } from "../core/importer.js";
import { profileToSvgPath } from "../cad/profile.js";
import { materialOrDefault } from "../cad/materials.js";

const draft = { name: "", fn: "", length: 120, process: "extrusion_al", constraints: "", inside: [], outside: [] };

function profileTab(body, { st }) {
  const ex = st.built && st.built.facts.extrusion;
  if (!ex) { body.append(el("p", { class: "muted" }, "Cette pièce n'a pas de bloc « extrusion ».")); return; }
  const m = ex.metrics, bb = m.bbox, pad = Math.max(m.width, m.height) * 0.12 + 2, rho = materialOrDefault(st.spec.material).rho;
  const vb = `${bb[0] - pad} ${-bb[3] - pad} ${m.width + 2 * pad} ${m.height + 2 * pad}`, sw = Math.max(m.width, m.height) / 220;
  const g = S("svg", { viewBox: vb, class: "sheet-view", style: "width:100%;max-height:300px;background:#fff" });
  g.append(S("path", { d: profileToSvgPath(ex.profile, true), fill: "#b9c6ce", "fill-rule": "evenodd", stroke: "#26323f", "stroke-width": sw }));
  for (const e of ex.envelopes) g.append(S("rect", { x: e.at[0] - e.w / 2, y: -e.at[1] - e.h / 2, width: e.w, height: e.h, fill: e.collides ? "rgba(255,90,79,.35)" : e.kind === "inside" ? "rgba(95,208,138,.35)" : "rgba(255,138,61,.3)", stroke: e.collides ? "#ff5a4f" : e.kind === "inside" ? "#216e4e" : "#b85c00", "stroke-width": sw, "stroke-dasharray": `${sw * 4} ${sw * 3}` }));
  if (m.ccdCenter) g.append(S("circle", { cx: m.ccdCenter[0], cy: -m.ccdCenter[1], r: m.ccd / 2, fill: "none", stroke: "#4d8dff", "stroke-width": sw * 0.7, "stroke-dasharray": `${sw * 2} ${sw * 4}` }));
  if (m.wallAt) g.append(S("circle", { cx: m.wallAt[0], cy: -m.wallAt[1], r: sw * 4, fill: "#ff5a4f" }));
  if (m.tongueAt && m.tongueRatio > 2.5) g.append(S("circle", { cx: m.tongueAt[0], cy: -m.tongueAt[1], r: sw * 4, fill: "#ffb020" }));
  body.append(g, el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Point rouge : paroi la plus mince · point jaune : gorge la plus profonde · cercle bleu : cercle circonscrit (CCD) · vert : éléments dedans · orange : éléments dehors."));
  const rows = [["Largeur × hauteur", `${fmt(m.width, 1)} × ${fmt(m.height, 1)} mm`], ["Aire de la section", `${fmt(m.area, 0)} mm²`], ["Masse linéique", `${fmt(m.area * rho / 1000, 2)} kg/m`], ["Cercle circonscrit (CCD)", `Ø ${fmt(m.ccd, 1)} mm`],
    ["Paroi la plus mince", m.wallMin === null ? "—" : `${fmt(m.wallMin, 2)} mm`], ["Paroi médiane", `${fmt(m.wallMedian, 2)} mm`], ["Gorge la plus étroite", m.gapMin === null ? "—" : `${fmt(m.gapMin, 2)} mm`],
    ["Rapport profondeur / largeur de gorge", fmt(m.tongueRatio, 2)], ["Cavités fermées", String(m.hollows)], ["Rayon le plus petit", `${fmt(m.rMin, 2)} mm`], ["Coins vifs", String(ex.sharp)], ["Longueur", `${fmt(ex.length, 1)} mm`]];
  body.append(el("table", { class: "data" }, el("tbody", null, rows.map(([k, v]) => el("tr", null, el("td", null, k), el("td", { class: "num" }, v))))));
  if (ex.envelopes.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Éléments dedans / dehors"), ex.envelopes.map((e) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, badge(e.kind === "inside" ? "dedans" : "dehors", e.collides ? "danger" : "ok"), ` ${e.name} — ${fmt(e.w, 1)} × ${fmt(e.h, 1)} mm${e.collides ? " : touche le profil" : ""}`))));
  body.append(el("p", { class: "muted", style: { fontSize: ".8rem", marginTop: ".6rem" } }, "Le profil se modifie par ses paramètres, par l'onglet JSON (bloc « extrusion »), ou en redemandant une section à Claude (page Extrusion sans pièce sélectionnée → « Profil par Claude »)."));
}

/* The request form: what goes inside / outside, then the prompt. */
function claudeForm(page) {
  const p = store.project;
  const name = el("input", { type: "text", value: draft.name, placeholder: "Ex. : Corps du contrôleur" }), fn = el("input", { type: "text", value: draft.fn, placeholder: "Ex. : Loge deux cartes et évacue 40 W" });
  const len = el("input", { type: "number", value: draft.length }), proc = el("select", null, el("option", { value: "extrusion_al" }, "Extrusion aluminium"), el("option", { value: "extrusion_plastic", selected: draft.process === "extrusion_plastic" }, "Extrusion plastique"));
  const cons = el("input", { type: "text", value: draft.constraints, placeholder: "Fixations en bout, étanchéité, face d'appui, encombrement maximal…" });
  const lists = { inside: el("div"), outside: el("div") }, out = el("div", { class: "prompt-box" });
  const addRow = (kind) => {
    const sel = el("select", null, el("option", { value: "" }, "Élément libre…"), p.parts.map((x) => el("option", { value: x.id }, `${x.id} — ${x.name || ""}`)));
    const nm = el("input", { type: "text", placeholder: "Nom" }), w = el("input", { type: "number", placeholder: "l", step: "any" }), h = el("input", { type: "number", placeholder: "h", step: "any" }), c = el("input", { type: "number", placeholder: "jeu", step: "any", value: "0.3" });
    sel.addEventListener("change", () => { const s = store.part(sel.value); if (!s) return; nm.value = s.name || s.id; const sz = s.pcb && s.pcb.size; if (sz) { w.value = typeof sz[0] === "number" ? sz[0] : (s.params[sz[0]] && s.params[sz[0]].value) || ""; h.value = s.pcb.t || 1.6; } });
    return el("div", { class: "form-row" }, field("Pièce du projet", sel), field("Nom", nm), field("Largeur", w), field("Hauteur", h), field("Jeu", c),
      btn("Ajouter", () => { if (!nm.value || !w.value || !h.value) { toast("Donnez un nom, une largeur et une hauteur (section de l'élément vue en bout).", "warn"); return; } draft[kind].push({ name: nm.value, w: +w.value, h: +h.value, clearance: +c.value || 0 }); update(); }, { icon: "plus", small: true }));
  };
  const update = () => {
    for (const k of ["inside", "outside"]) { clear(lists[k]); draft[k].forEach((e, i) => lists[k].append(el("p", { style: { margin: "0 0 .25rem", fontSize: ".86rem" } }, badge(k === "inside" ? "dedans" : "dehors", "info"), ` ${e.name} — ${e.w} × ${e.h} mm, jeu ${e.clearance} `, el("button", { class: "link-btn", type: "button", onClick: () => { draft[k].splice(i, 1); update(); } }, "retirer")))); if (!draft[k].length) lists[k].append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Rien pour l'instant.")); }
    Object.assign(draft, { name: name.value, fn: fn.value, length: +len.value || 100, process: proc.value, constraints: cons.value });
    out.textContent = extrusionPrompt(p, draft);
  };
  for (const i of [name, fn, len, proc, cons]) i.addEventListener("input", update);
  page.append(el("div", { class: "two-col" },
    el("div", { class: "card taped" }, el("h2", null, "1. Le profilé et ce qui l'entoure"), el("div", { class: "form-row" }, field("Nom", name), field("Procédé", proc), field("Longueur (mm)", len)), field("Fonction", fn), field("Contraintes", cons),
      el("h3", null, "Ce qui va DEDANS"), lists.inside, addRow("inside"), el("h3", { style: { marginTop: ".6rem" } }, "Ce qui se fixe DEHORS"), lists.outside, addRow("outside")),
    el("div", { class: "card taped" }, el("h2", null, "2. Le prompt pour Claude"), out, el("div", { class: "form-actions" }, el("a", { class: "btn", href: "https://claude.ai/new", target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Ouvrir Claude"),
      btn("Copier le prompt", async () => toast((await copyText(out.textContent)) ? "Prompt copié." : "Copie impossible.", "success"), { primary: true, icon: "copy" })),
      el("h2", { style: { marginTop: "1rem" } }, "3. La réponse"), el("p", { class: "muted", style: { fontSize: ".86rem" } }, "Copiez la réponse de Claude puis cliquez : le profilé est créé, extrudé et vérifié."),
      btn("Coller la réponse et créer le profilé", async () => { try { const r = await importAny(await navigator.clipboard.readText()); if (r) app.onImported(r); } catch (e) { toast("Presse-papiers inaccessible : collez avec Ctrl+V n'importe où dans la page.", "warn"); } }, { primary: true, icon: "paste" }))));
  update();
}

function render(main, args) {
  if (args[0] === "new" && app.pendingProfile) {
    const id = store.addPart({ dw: "part/1", id: store.nextPartId("EXT"), name: "Profilé importé", family: "extrusion", process: "extrusion_al", material: "AL6063-T5", params: { L: { value: 100, min: 10, max: 1000, step: 1, unit: "mm", label: "Longueur" } },
      extrusion: { axis: "Y", length: "L", profile: app.pendingProfile }, features: [], interfaces: [] }, "Profilé créé depuis un profil collé");
    app.pendingProfile = null; go(`#/extrusion/${encodeURIComponent(id)}`); return null;
  }
  const has = store.parts.some((p) => p.family === "extrusion");
  if (args[0] === "claude" || !has) {
    const page = el("div", { class: "page" });
    main.append(page);
    page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Profilés extrudés"), el("p", { class: "muted" }, "Un procédé spécial de l'Atelier, comme le moulage. Un profilé se dessine autour de ce qu'il contient et de ce qu'il porte. Décrivez ces éléments : Claude propose la section, la plateforme l'extrude et vérifie les règles d'extrusion (parois, gorges, cavités, CCD).")),
      has && el("a", { class: "btn", href: "#/extrusion" }, "Retour aux profilés"), el("a", { class: "btn", href: "#/process/extrusion", "data-tip": "Ce que la filière demande au dessin, par matière — et le profilé dessiné seul par l'Atelier" }, "Règles de l'extrusion"), btn("Partir d'un gabarit", () => newPartDialog({ templates: ["heatsink", "cardbox"] }), { icon: "plus" })),
      null);
    claudeForm(page);
    return null;
  }
  return partStudio(main, args, { key: "extrusion", title: "Profilés", mark: "extrusion", filter: (p) => p.family === "extrusion", templates: ["heatsink", "cardbox"], defaultTab: "profil",
    tabs: [{ key: "profil", label: "Profil", render: profileTab }], onBuilt: null });
}

registerModule({ key: "extrusion", label: "Profilés extrudés", icon: "extrusion", tip: "Profilés extrudés aluminium ou plastique : section dessinée autour de ce qui va dedans et dehors", render });
