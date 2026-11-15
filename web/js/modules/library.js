/* DesignWizard.ai — Bibliothèque électrique : connectors (low voltage, high voltage and power) and cylindrical cells, taken
   from real families of major manufacturers and from published standards. The designer filters by what the connection
   must carry — current, voltage, sealing, interlock — picks a family, says how many poles, which potential, and whether
   the connection leaves the product ; the part is created with its conductors, its nets and its interfaces. Route : #/library. */

import { el, btn, badge, field, toast, modal, table, icon } from "../core/dom.js";
import { registerModule, go } from "../core/app.js";
import { store } from "../core/store.js";
import { importPart } from "../core/importer.js";
import { CONNECTORS, CELLS, ELEC_STANDARDS, CONNECTOR_KINDS, pickConnectors } from "../cad/elec_library.js";
import { connectorPart, cellPart, connectorEnvelope, poleNets } from "../core/elec_parts.js";
import { WELD_PROCESSES } from "../cad/interfaces_elec.js";
import { thermalPadPart } from "../core/busbar_lam.js";
import { shopTabs } from "./shop_tabs.js";

const filter = { domain: "", amps: "", volts: "", sealed: false, hvil: false };
const SEEN = { read: ["lu", "ok", "Valeurs lues sur la fiche ou la page du fabricant"], excerpt: ["extrait", "warn", "Valeurs vues en extrait de la page du fabricant : à relire sur la fiche"] };
const fr = (x) => String(x).replace(".", ",");
/** Adds the part to the project, and to its first assembly when asked : it arrives unmated, ready to be placed. */
function create(spec, toAsm) {
  const r = importPart(spec, { replace: false });
  if (r.errors && r.errors.length) { toast(r.errors.join(" "), "error", 7000); return null; }
  const a = store.project.assemblies[0];
  if (toAsm && a) store.updateAssembly(a.id, (x) => { x.instances.push({ id: `i${Date.now().toString(36)}`, part: r.id, placement: { t: [0, 0, 0], r: [0, 0, 0] } }); x.pendingAutoMate = true; }, `${r.id} ajoutée à ${a.id}`);
  toast(`${r.id} créée depuis la bibliothèque${toAsm && a ? ` et posée dans ${a.id}` : ""}.`, "success", 5000);
  return r.id;
}
function addConnector(c) {
  const hv = c.domain === "hv", st = { poles: hv ? 2 : 4, net: hv ? "HV" : "LV", mount: hv || c.kind === "circular" || c.sealed ? "panel" : "board", external: hv, partner: "", toAsm: !!store.project.assemblies.length };
  const info = el("p", { class: "muted small" }), draw = () => { const E = connectorEnvelope(c, st.poles); info.textContent = `Potentiels : ${poleNets(c, st.poles, st.net).join(", ")} · enveloppe indicative ${fr(E.L)} × ${fr(E.W)} × ${fr(E.H)} mm (à remplacer par le modèle du fabricant).`; };
  const num = el("input", { type: "number", min: 1, max: 60, step: 1, value: st.poles, onInput: (e) => { st.poles = Math.max(1, parseInt(e.target.value, 10) || 1); draw(); } });
  const net = el("input", { type: "text", value: st.net, onInput: (e) => { st.net = e.target.value.trim() || (hv ? "HV" : "LV"); draw(); } }), partner = el("input", { type: "text", placeholder: hv ? "Ex. : onduleur, chargeur, batterie" : "Ex. : capteur de température, carte de commande", onInput: (e) => { st.partner = e.target.value; } });
  const mount = el("select", { onChange: (e) => { st.mount = e.target.value; } }, [["panel", "Sur une paroi (bride, passage, vis)"], ["board", "Sur une carte"]].map(([k, l]) => el("option", { value: k, selected: k === st.mount }, l)));
  const ext = el("input", { type: "checkbox", checked: st.external, onChange: (e) => { st.external = e.target.checked; } }), asm = el("input", { type: "checkbox", checked: st.toAsm, onChange: (e) => { st.toAsm = e.target.checked; } });
  draw();
  const m = modal(`${c.maker} ${c.series}`, [el("p", null, `${CONNECTOR_KINDS[c.kind]} — ${fr(c.a)} A par contact${c.v ? `, ${c.v} V` : ""}${c.pos ? ` · ${c.pos} pôles` : ""}${c.wire ? ` · ${c.wire}` : ""}. `, badge(SEEN[c.seen][0], SEEN[c.seen][1])), c.note ? el("p", { class: "muted small" }, `${c.note.charAt(0).toUpperCase()}${c.note.slice(1)}.`) : null,
    el("div", { class: "form-row" }, field("Nombre de pôles", num, c.pos ? `La famille existe en ${c.pos}` : ""), field(hv ? "Potentiel (HV donne HV+ et HV−)" : "Potentiel", net), field("Montage", mount)),
    field("Vers quoi", partner), el("label", { class: "check" }, ext, "Le raccordement sort du produit : interface externe, vers un appareil qui n'est pas dans l'assemblage"),
    store.project.assemblies.length ? el("label", { class: "check" }, asm, `Poser la pièce dans ${store.project.assemblies[0].id}`) : null, info,
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("Ajouter au projet", () => { const id = create(connectorPart(c, { id: store.nextPartId(), poles: st.poles, net: st.net, mount: st.mount, external: st.external, partner: st.partner.trim() || undefined }), st.toAsm); if (id) { m.close(); go(`#/parts/${encodeURIComponent(id)}`); } }, { primary: true, icon: "plus" }))], { wide: true });
}
function addCell(c) {
  const st = { net: "CELL", process: "laser", toAsm: !!store.project.assemblies.length };
  const m = modal(c.name, [el("p", null, `${c.iec} (IEC 61960-3) — Ø ${fr(c.d)} × ${fr(c.L)} mm au plus, ${c.mass[0]} à ${c.mass[1]} g, ${fr(c.capacity[0])} à ${fr(c.capacity[1])} Ah, ${fr(c.vNom)} V nominal, décharge continue ${c.discharge[0]} à ${c.discharge[1]} A selon le modèle.`),
    el("div", { class: "form-row" }, field("Potentiel de la cellule", el("input", { type: "text", value: st.net, onInput: (e) => { st.net = e.target.value.trim() || "CELL"; } }), "Un nom par groupe en parallèle : S1, S2…"),
      field("Liaison des bornes", el("select", { onChange: (e) => { st.process = e.target.value; } }, Object.entries(WELD_PROCESSES).map(([k, w]) => el("option", { value: k, selected: k === st.process }, w.fr))), "Chaque borne est une interface soudée : la languette ou le busbar la reprendra")),
    store.project.assemblies.length ? el("label", { class: "check" }, el("input", { type: "checkbox", checked: st.toAsm, onChange: (e) => { st.toAsm = e.target.checked; } }), `Poser la cellule dans ${store.project.assemblies[0].id}`) : null,
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("Ajouter au projet", () => { const id = create(cellPart(c, { id: store.nextPartId(), net: st.net, process: st.process }), st.toAsm); if (id) { m.close(); go(`#/parts/${encodeURIComponent(id)}`); } }, { primary: true, icon: "plus" }))], { wide: true });
}

function render(main) {
  const page = el("div", { class: "page" }), body = el("div");
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Bibliothèque électrique"),
    el("p", { class: "muted" }, "Des familles réelles de connecteurs — basse tension pour les capteurs et les signaux, haute tension et puissance pour ce qui sort du produit — et les cellules cylindriques. Filtrez par ce que la liaison doit porter, choisissez, dites le nombre de pôles et le potentiel : la pièce arrive avec ses conducteurs, ses potentiels et ses interfaces.")),
    shopTabs("library")), body);
  function draw() {
    const need = { domain: filter.domain || undefined, amps: parseFloat(filter.amps) || undefined, volts: parseFloat(filter.volts) || undefined, sealed: filter.sealed, hvil: filter.hvil }, list = filter.domain === "cells" ? [] : pickConnectors(need);
    const set = (k) => (e) => { filter[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; draw(); };
    const bar = el("section", { class: "card taped" }, el("h2", null, "Ce que la liaison doit porter"), el("div", { class: "form-row" },
      field("Domaine", el("select", { onChange: set("domain") }, [["", "Tout"], ["lv", "Basse tension — capteurs, signaux, alimentation de carte"], ["hv", "Haute tension et puissance"], ["cells", "Cellules Li-ion"]].map(([k, l]) => el("option", { value: k, selected: k === filter.domain }, l)))),
      field("Courant par contact, au moins (A)", el("input", { type: "number", min: 0, step: "any", value: filter.amps, onChange: set("amps") })), field("Tension assignée, au moins (V)", el("input", { type: "number", min: 0, step: "any", value: filter.volts, onChange: set("volts") }), "Les familles sans tension publiée sont alors écartées"),
      el("div", null, el("label", { class: "check" }, el("input", { type: "checkbox", checked: filter.sealed, onChange: set("sealed") }), "Étanche"), el("label", { class: "check" }, el("input", { type: "checkbox", checked: filter.hvil, onChange: set("hvil") }), "Interverrouillage (HVIL)"))),
      el("p", { class: "muted small" }, "Valeurs nominales publiées par les fabricants, par contact, à la condition indiquée : elles se déclassent avec le nombre de pôles, le fil et la température. « lu » : relevé sur la fiche ; « extrait » : vu en extrait seulement. La fiche de la référence achetée fait foi."));
    const sections = [bar];
    if (filter.domain !== "cells") sections.push(el("section", { class: "card" }, el("h2", null, `Connecteurs `, el("small", { class: "muted" }, `${list.length} famille(s), la plus petite qui convient d'abord`)),
      list.length ? table(["Fabricant ou norme", "Série", "Genre", "Pas / contact", "Pôles", "A", "V", "Fil", "Étanchéité", "Normes", "Usage", "", ""], list.map((c) => [c.maker, el("b", null, c.series), CONNECTOR_KINDS[c.kind], c.pitch ? `${fr(c.pitch)} mm` : c.contact || "—", c.pos || "—", el("span", { "data-tip": c.note || null }, fr(c.a)), c.v ? String(c.v) : "—", c.wire || "—",
        c.sealed ? `${c.sealed}${c.hvil ? " · HVIL" : ""}${c.shielded ? " · blindé" : ""}` : c.hvil ? "HVIL" : "—", c.std || "—", c.use || "", el("span", { "data-tip": SEEN[c.seen][2] }, badge(SEEN[c.seen][0], SEEN[c.seen][1])), btn("Ajouter", () => addConnector(c), { small: true, icon: "plus", primary: true })]))
        : el("p", { class: "atelier-hint" }, icon("info"), " Aucune famille de la bibliothèque ne porte ce courant sous cette tension avec ces options : relâchez un critère, ou mettez plusieurs contacts en parallèle.")));
    if (!filter.domain || filter.domain === "cells") sections.push(el("section", { class: "card" }, el("h2", null, "Cellules Li-ion cylindriques"),
      table(["Format", "Désignation IEC", "Ø × L au plus", "Masse", "Capacité", "Tension", "Décharge continue", "Essais", ""], CELLS.map((c) => [el("b", null, c.id), c.iec, `${fr(c.d)} × ${fr(c.L)} mm`, `${c.mass[0]}–${c.mass[1]} g`, `${fr(c.capacity[0])}–${fr(c.capacity[1])} Ah`, `${fr(c.vMin)}–${fr(c.vMax)} V (${fr(c.vNom)} nominal)`, `${c.discharge[0]}–${c.discharge[1]} A`, c.std, btn("Ajouter", () => addCell(c), { small: true, icon: "plus", primary: true })])),
      el("p", { class: "muted small" }, "Plages relevées sur les fiches de plusieurs fabricants ; l'enveloppe est la plus grande publiée, pour dimensionner le logement. « 18650 » et « 21700 » sont des noms d'usage : la désignation de la norme arrondit les dimensions au-dessus.")));
    if (!filter.domain) { const pad = { L: 40, W: 40, t: 1 }, n = (k, label, step = 1) => field(label, el("input", { type: "number", value: pad[k], step, min: 0.1, onInput: (e) => { const v = parseFloat(e.target.value); if (v > 0) pad[k] = v; } }));
      sections.push(el("section", { class: "card" }, el("h2", null, "Interface thermique"), el("p", { class: "muted small" }, "Un pad thermique entre deux faces planes : dessiné écrasé de 20 %, avec sa résistance thermique. Les busbars, nus, isolés ou laminés, se dessinent dans l'écran Busbars."),
        el("div", { class: "form-row" }, n("L", "Longueur"), n("W", "Largeur"), n("t", "Épaisseur libre", 0.1), el("div", { class: "form-actions", style: { alignItems: "flex-end" } }, btn("Ajouter le pad", () => { const id = create(thermalPadPart({ id: store.nextPartId(), ...pad }), !!store.project.assemblies.length); if (id) go(`#/parts/${encodeURIComponent(id)}`); }, { primary: true, icon: "plus" }))))); }
    sections.push(el("details", { class: "card" }, el("summary", null, el("b", null, "Les normes citées")), table(["Norme", "Titre", "Ce qu'elle couvre", ""], ELEC_STANDARDS.map((s) => [s.id, s.title, s.covers, badge(SEEN[s.seen][0], SEEN[s.seen][1])]))));
    body.replaceChildren(...sections);
  }
  draw();
  return null;
}

registerModule({ key: "library", label: "Bibliothèque", icon: "power", tip: "Bibliothèque électrique : connecteurs basse et haute tension de familles réelles, cellules Li-ion — la pièce arrive avec ses potentiels et ses interfaces", render });
export { CONNECTORS };
