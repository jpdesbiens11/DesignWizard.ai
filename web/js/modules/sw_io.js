/* DynamiteOrbit.ai — Logiciel, step 2 of the lean path : the HARDWARE INTERFACES of the software (JP, 27 novembre 2026 : « lean tout ce qui n'est
   pas des requis, interfaces HW, fonctions »). Each input and each output of the software, under the function of the board that carries it —
   its direction, its net and its pin, its range in the units of physics, the device behind it — then what other boards SAY in their frames.
   Read from the software and its board (sw/sw_lean.js interfacesOf) : nothing is typed here ; a pin is changed in the board (PCBA) or, at the
   Expert level, in the blocks. What it follows : a pin list of an interface control document, grouped by function. Route : #/swio. */

import { el, icon, btn, clear } from "../core/dom.js";
import { registerModule, setGuide, go } from "../core/app.js";
import { store } from "../core/store.js";
import { interfacesOf, leanOf } from "../sw/sw_lean.js";
import { swShell } from "./sw_vband.js";
import { leanHead, leanDesign } from "./sw_lean_ui.js";

const DIR = { ain: { fr: "Mesure", icon: "sensor", color: "#2563eb" }, din: { fr: "Entrée logique", icon: "power", color: "#7c3aed" }, dout: { fr: "Sortie logique", icon: "bolt", color: "#ea580c" } };
const GROUP_COL = ["#2563eb", "#b45309", "#dc2626", "#7c3aed", "#16a34a", "#0891b2", "#be185d", "#475569"];

function render(main) {
  const { page, head, left, view, right } = swShell(main, "swi-view");
  function draw() {
    const d = leanDesign(); head.replaceChildren(leanHead("io", d));
    if (!d) { page.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Les interfaces du logiciel"), el("p", null, "Le projet n'a pas encore de logiciel : ses entrées et ses sorties viendront de la carte qui le porte."))); setGuide([]); return; }
    const I = interfacesOf(store.project, d), n = I.groups.reduce((a, g) => a + g.items.length, 0), L = leanOf("io");
    clear(left); left.append(el("div", { class: "side-head" }, el("h2", null, "Interfaces")),
      el("div", { class: "side-scroll" }, el("div", { class: "side-section", "data-fold-note": `${n} interfaces` }, el("h3", null, "Ce que l'écran montre"), el("p", { class: "small" }, L.says),
        el("p", { class: "small" }, I.board ? [`Carte : `, el("b", null, I.board.id), ` — ${I.board.name || ""}.`] : "Aucune carte du produit ne porte ce logiciel."),
        el("p", { class: "small muted" }, "Rien ne se tape ici : une broche change dans la carte (PCBA) ; les blocs détaillés sont au niveau Expert.")),
        el("div", { class: "side-section", "data-fold-note": "3 sortes" }, el("h3", null, "Les sortes"), Object.values(DIR).map((D) => el("p", { class: "swi-key small", style: `--g:${D.color}` }, icon(D.icon), ` ${D.fr}`))),
        el("div", { class: "side-actions" }, I.board ? btn("Ouvrir la carte", () => go(`#/pcba/${encodeURIComponent(I.board.id)}`), { small: true, icon: "chip" }) : null, btn("Les cartes en marche", () => go("#/elab/table"), { small: true, icon: "play", tip: "La table du Labo, vue « En marche » : la carte et ses voisines, alimentées, chaque fonction exercée" }))));
    view.replaceChildren(el("div", { class: "swi-grid", "data-sw-io": "" }, I.groups.map((g, gi) => { const col = g.fn === "frames" ? "#0f766e" : GROUP_COL[gi % GROUP_COL.length];
      return el("section", { class: "swi-group", style: `--g:${col}`, "data-sw-io-group": g.fn }, el("h3", null, icon(g.fn === "frames" ? "link" : "chip"), ` ${g.name}`, el("small", null, ` ${g.items.length}`)),
        g.items.map((x) => { const D = DIR[x.dir] || DIR.din;
          return el("div", { class: "swi-row", style: `--d:${D.color}`, "data-sw-io-item": x.id }, el("span", { class: "swi-dir", "data-tip": D.fr }, icon(D.icon)),
            el("span", { class: "grow" }, el("b", null, x.name), el("small", null, x.from === "frame" ? ` ${x.source}` : x.reads ? ` → ${x.reads}` : x.device ? ` · ${x.device}` : "")),
            x.net ? el("code", { class: "swi-net" }, `${x.net} · ${x.pin}`) : el("code", { class: "swi-net frame" }, "frame"), el("span", { class: "swi-range" }, x.text),
            x.vehicle ? el("span", { class: "chip small", "data-tip": "Passé au véhicule" }, `→ ${x.vehicle}`) : null); })); })));
    clear(right); const bad = I.problems.filter((x) => x.level === "error" || x.level === "check"), tips = I.problems.filter((x) => x.level === "tip");
    right.append(el("div", { class: "side-head" }, el("h2", null, "À regarder")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": `${bad.length}` }, el("h3", null, "À corriger"), bad.length ? bad.map((x) => el("p", { class: "small" }, icon("warning"), ` ${x.text}`)) : el("p", { class: "small muted" }, "Chaque broche est sur un net de la carte qui fait ce qu'elle fait, ou dite par une autre carte.")),
      el("div", { class: "side-section", "data-fold-note": `${tips.length}` }, el("h3", null, "Ce que la carte porte encore"), tips.length ? tips.map((x) => el("p", { class: "small" }, icon("info"), ` ${x.text}`)) : el("p", { class: "small muted" }, "Rien d'autre."))));
    setGuide(I.problems.map((x) => ({ level: x.level === "check" ? "check" : x.level, text: x.text })));
  }
  const off = store.on("change", () => draw()); draw();
  return () => { off(); setGuide([]); };
}
registerModule({ key: "swio", label: "Interfaces", icon: "chip", tip: "2. Les interfaces HW du logiciel : chaque entrée et chaque sortie sur son net et sa broche", render });
