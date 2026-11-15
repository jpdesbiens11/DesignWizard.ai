/* DesignWizard.ai — the screens of the Shop (« Atelier » in French), in one row of sub-tabs shared by all of them. The
   studios reached from here (extruded profiles, busbars, flexible circuits) keep the Shop tab lit : SHOP_SCREENS in core/app.js. */

import { el } from "../core/dom.js";

const TABS = [
  ["shop", "#/shop", "Intention d'abord", "La pièce naît de ce qu'elle relie : interfaces, matière, matière première du commerce"],
  ["entrevue", "#/interfaces", "Entrevue avec Claude", "La pièce décrite en mots : le prompt, l'entrevue, la réponse collée"],
  ["registre", "#/interfaces/registre", "Registre des interfaces", "Toutes les interfaces du projet, par clé"],
  ["process", "#/process", "Procédés spéciaux", "Moulage, extrusion, découpe laser de précision, impression 3D : ce que chaque matière demande au dessin"],
  ["extrusion", "#/extrusion", "Profilés extrudés", "Le studio des profilés : la section, ce qui va dedans et dehors, ses règles de filière"],
  ["library", "#/library", "Bibliothèque électrique", "Connecteurs basse et haute tension de familles réelles, cellules Li-ion"],
  ["busbar", "#/busbar", "Busbars", "Un conducteur plié et poinçonné, ses bornes et ses contacts à lamelles"],
  ["flex", "#/flex", "Circuits flexibles", "Une bande souple pliée, ses pistes et ses capteurs"],
];
/** The row of sub-tabs of the Shop, `active` lit. */
export const shopTabs = (active) => el("div", { class: "subtabs" }, TABS.map(([key, href, label, tip]) => el("a", { class: "subtab" + (key === active ? " active" : ""), href, "data-tip": tip }, label)));
