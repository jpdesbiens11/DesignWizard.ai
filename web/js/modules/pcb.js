/* DesignOrbit.ai — PCB: boards as mechanical and electrical envelopes. The tab "Carte" edits the components (with
   their heights and nets), the copper zones that matter for isolation, and the nets; the board mates through a
   bolt_pattern interface like any other part, and its zones feed the isolation analysis of the assembly. */

import { el, clear, icon, btn, badge, field, toast } from "../core/dom.js";
import { registerModule } from "../core/app.js";
import { store } from "../core/store.js";
import { partStudio } from "./part_studio.js";
import { PCB_KINDS } from "../cad/family_pcb.js";
import { parseValue } from "../core/part_edit.js";
import { boardOfPart } from "../pcba/twin.js";

const show = (v) => (v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function cell(id, path, value, kind, width) {
  const input = el("input", { type: "text", value: show(value), spellcheck: false, style: { padding: ".12rem .3rem", fontSize: ".8rem", minWidth: width || "52px" },
    onChange: () => { try { const v = parseValue(input.value, kind); store.updatePart(id, (s) => { let o = s.pcb; for (const k of path.slice(0, -1)) o = o[k]; if (v === undefined) delete o[path[path.length - 1]]; else o[path[path.length - 1]] = v; }, `${id} : carte modifiée`); } catch (e) { input.classList.add("bad"); toast(e.message, "error"); } } });
  return input;
}
function boardTab(body, { st, id }) {
  const pcb = st.spec.pcb;
  if (!pcb) { body.append(el("p", { class: "muted" }, "Cette pièce n'a pas de bloc « pcb ».")); return; }
  body.append(el("div", { class: "form-row" }, field("Taille [l, h]", cell(id, ["size"], pcb.size, "json", "90px")), field("Épaisseur", cell(id, ["t"], pcb.t ?? 1.6, "num")), field("Rayon des coins", cell(id, ["r"], pcb.r ?? 0, "num"))));
  const comps = pcb.components || [], from = boardOfPart(store.project, id);
  if (from) body.append(el("p", { class: "atelier-hint", "data-twin-of": from.id }, icon("chip"), el("span", null, " Cette carte porte le PCBA ", el("a", { href: `#/pcba/${encodeURIComponent(from.id)}` }, `« ${from.name || from.id} »`), " : ses composants et ses nets en viennent, et suivent chaque changement fait là-bas. Le contour, l'épaisseur et les fixations se règlent ici.")));
  const sec = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Composants (${comps.length})`), btn("", () => store.updatePart(id, (s) => { s.pcb.components = s.pcb.components || []; s.pcb.components.push({ ref: `X${s.pcb.components.length + 1}`, name: "Composant", kind: "other", at: [10, 10], size: [8, 6, 3] }); }, `${id} : composant ajouté`), { small: true, icon: "plus", tip: "Ajouter un composant" })));
  comps.forEach((c, i) => {
    const kind = el("select", { style: { padding: ".12rem .2rem", fontSize: ".8rem" }, onChange: (e) => store.updatePart(id, (s) => { s.pcb.components[i].kind = e.target.value; }, `${id} : ${c.ref}`) }, Object.entries(PCB_KINDS).map(([k, v]) => el("option", { value: k, selected: k === (c.kind || "other") }, v.fr)));
    sec.append(el("div", { class: "card", style: { padding: ".4rem .5rem", marginBottom: ".4rem" } },
      el("div", { style: { display: "grid", gridTemplateColumns: "64px 1fr auto", gap: ".3rem", alignItems: "center" } }, cell(id, ["components", i, "ref"], c.ref, "text"), cell(id, ["components", i, "name"], c.name, "text"),
        el("button", { class: "icon-btn", type: "button", "aria-label": "Supprimer", "data-tip": "Supprimer ce composant", style: { fontSize: "1rem" }, onClick: () => store.updatePart(id, (s) => { s.pcb.components.splice(i, 1); }, `${id} : ${c.ref} supprimé`) }, icon("trash"))),
      el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".3rem", marginTop: ".3rem" } }, kind,
        el("select", { style: { padding: ".12rem .2rem", fontSize: ".8rem" }, onChange: (e) => store.updatePart(id, (s) => { s.pcb.components[i].side = e.target.value; }, `${id} : ${c.ref}`) }, ["top", "bottom"].map((k) => el("option", { value: k, selected: (c.side || "top") === k }, k === "top" ? "dessus" : "dessous")))),
      el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1.2fr 70px", gap: ".3rem", marginTop: ".3rem" } },
        el("label", { class: "field-hint" }, "Centre [x, y]", cell(id, ["components", i, "at"], c.at, "json")), el("label", { class: "field-hint" }, "Taille [l, h, z]", cell(id, ["components", i, "size"], c.size, "json")), el("label", { class: "field-hint" }, "Net", cell(id, ["components", i, "net"], c.net, "text")))));
  });
  body.append(sec);
  const zones = pcb.zones || [];
  const zsec = el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, `Zones de cuivre pour l'isolation (${zones.length})`), btn("", () => store.updatePart(id, (s) => { s.pcb.zones = s.pcb.zones || []; s.pcb.zones.push({ net: "HV+", side: "top", rect: [5, 5, 20, 15], name: "Zone" }); }, `${id} : zone ajoutée`), { small: true, icon: "plus", tip: "Ajouter une zone" })),
    el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Seules les zones qui comptent pour l'isolation (HV, LV, Chassis) sont utiles ici : elles deviennent des conducteurs de l'analyse creepage / clearance."));
  zones.forEach((z, i) => zsec.append(el("div", { style: { display: "grid", gridTemplateColumns: "62px 70px 1fr auto", gap: ".3rem", marginBottom: ".3rem", alignItems: "center" } }, cell(id, ["zones", i, "net"], z.net, "text"),
    el("select", { style: { padding: ".12rem .2rem", fontSize: ".8rem" }, onChange: (e) => store.updatePart(id, (s) => { s.pcb.zones[i].side = e.target.value; }, `${id} : zone`) }, ["top", "bottom"].map((k) => el("option", { value: k, selected: (z.side || "top") === k }, k === "top" ? "dessus" : "dessous"))),
    cell(id, ["zones", i, "rect"], z.rect, "json"), el("button", { class: "icon-btn", type: "button", "aria-label": "Supprimer la zone", style: { fontSize: "1rem" }, onClick: () => store.updatePart(id, (s) => { s.pcb.zones.splice(i, 1); }, `${id} : zone supprimée`) }, icon("trash")))));
  body.append(zsec);
  const nets = Object.entries(pcb.nets || {});
  body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, "Nets déclarés"), btn("", () => store.updatePart(id, (s) => { s.pcb.nets = s.pcb.nets || {}; s.pcb.nets[`NET${Object.keys(s.pcb.nets).length + 1}`] = { kind: "dc", voltage: 0 }; }, `${id} : net ajouté`), { small: true, icon: "plus" })),
    nets.map(([name, n]) => el("div", { style: { display: "grid", gridTemplateColumns: "1fr 80px auto", gap: ".3rem", marginBottom: ".3rem", alignItems: "center" } }, el("b", null, name), cell(id, ["nets", name, "voltage"], n.voltage, "num"),
      el("label", { class: "check", style: { fontSize: ".8rem" } }, el("input", { type: "checkbox", checked: !!n.floating, onChange: (e) => store.updatePart(id, (s) => { s.pcb.nets[name].floating = e.target.checked; }, `${id} : ${name}`) }), "IT"))),
    el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Tension en V DC. « IT » : net d'un système HV flottant.")));
}

registerModule({ key: "pcb", label: "PCB", icon: "pcb", tip: "Cartes : contour, composants, zones d'isolation et nets — fixées par leurs interfaces",
  render: (main, args) => partStudio(main, args, { key: "pcb", title: "Cartes PCB", mark: "pcb", filter: (p) => p.family === "pcb", templates: ["pcb"], defaultTab: "carte",
    emptyTitle: "Aucune carte pour l'instant", emptyText: "Partez du gabarit « Carte PCB », ou décrivez la carte par l'entrevue (famille pcb) : composants, hauteurs, zones HV / LV.", tabs: [{ key: "carte", label: "Carte", render: boardTab }] }) });
