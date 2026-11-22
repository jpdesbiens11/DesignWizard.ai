/* DesignOrbit.ai — the floor of the Shop : levels 1 and 2 of the path (core/shop_levels.js).
   Level 1, `#/shop` : every part of the product, by nature or by assembly, the doors to create one — step by step, with an AI,
   off the shelf, or straight in a studio — and the shelves one consults from anywhere (interface register, special processes,
   electrical library).
   Level 2, `#/shop/n/<nature>` : the parts of one nature, what its process asks, and a new part of that nature.
   A line opens its part in the studio of its nature ; Ctrl + click, or the small control at its end, keeps it as a work tab
   (modules/levels_bar.js). The usage it follows : the home page of a file explorer — folders by kind, a search, shortcuts. */

import { el, icon, btn, toast } from "../core/dom.js";
import { app, go } from "../core/app.js";
import { store } from "../core/store.js";
import { NATURES, nature, natureGroups, assemblyGroups, natureHash, natureKey } from "../core/shop_levels.js";
import { filterGroups } from "../core/pick_list.js";
import { importPart } from "../core/importer.js";
import { blankBusbar, busbarPart } from "../core/busbar.js";
import { materialOrDefault } from "../cad/materials.js";
import { newPartDialog } from "./part_studio.js";
import { tabButton, tabClick } from "./levels_bar.js";

const st = { mode: "nature", q: "" };
const newBusbar = () => { const r = importPart(busbarPart(blankBusbar(), store.nextPartId()), { replace: false }); if (r.errors && r.errors.length) { toast(r.errors.join(" "), "error"); return; } go(`#/busbar/${encodeURIComponent(r.id)}`); };
/* a new part of each nature : where it is made — the words of the button, what it does */
const MAKE = {
  machined: ["Nouvelle pièce, pas à pas", () => go("#/shop/new")], molded: ["Choisir la matière à mouler", () => go("#/process/moulage")], extrusion: ["Nouveau profilé", () => go("#/extrusion/claude")],
  sheet: ["Choisir la tôle à plier", () => go("#/process/pliage")], laser: ["Choisir la matière à découper", () => go("#/process/laser")], printed: ["Choisir la matière à imprimer", () => go("#/process/impression")],
  busbar: ["Nouveau busbar", newBusbar], flex: ["Nouveau circuit flexible", () => { app.pendingNew = "flex"; go("#/flex"); }], pcb: ["Nouvelle carte, d'un gabarit", () => newPartDialog({ templates: ["pcb"] })],
  bought: ["Choisir dans la bibliothèque", () => go("#/library")], imported: ["Importer un fichier…", () => app.pickFile && app.pickFile()], other: ["Nouvelle pièce, pas à pas", () => go("#/shop/new")],
};
const DOORS = [
  ["#/shop/new", "intent", "#2563eb", "Pas à pas", "Son rôle, ses voisines, ses interfaces, sa matière : la pièce naît à droite, à mesure des réponses.", true],
  ["#/shop/ai", "sparkle", "#7c3aed", "Avec l'IA", "Une phrase : l'outil écrit la consigne. La réponse revient en fichier — une pièce, plusieurs, ou tout un assemblage — et se relit avant d'entrer.", false],
  ["#/library", "library", "#64748b", "Du commerce", "Connecteurs LV et HV, cellules : la pièce arrive avec ses interfaces et ses potentiels.", false],
];
const STUDIOS = ["extrusion", "busbar", "flex", "molded", "sheet", "laser", "printed", "pcb"];
const SHELVES = [["#/interfaces/registre", "interfaces", "Registre des interfaces", "Toutes les interfaces du produit, par clé"], ["#/process", "cast", "Procédés spéciaux", "Ce que chaque matière demande au dessin"], ["#/library", "library", "Bibliothèque électrique", "Connecteurs, cellules, joints soudés"]];
const LEVELS = [
  [1, "L'Atelier — toutes les pièces du produit", "On y voit tout, par nature ou par assemblage. On y crée : pas à pas, avec l'IA, du commerce, ou dans un studio.", "un clic sur une nature, ou sur une pièce"],
  [2, "Une nature de pièce", "Profilé, busbar, flex, moulée, tôle, carte… On y voit les sœurs et ce que le procédé demande ; on y crée une pièce de cette nature.", "un clic sur une pièce"],
  [3, "Une pièce, dans son studio", "Ses opérations, ses interfaces, sa matière, ses variantes ; la confier à l'IA.", null],
];

const levelsCard = (here) => el("section", { class: "card floor-levels" }, el("h2", null, icon("layers"), "Trois niveaux, un seul chemin"),
  LEVELS.flatMap(([n, title, text, down]) => [el("div", { class: "floor-level" + (n === here ? " here" : ""), "aria-current": n === here ? "true" : null }, el("i", { "aria-hidden": "true" }, String(n)), el("div", null, el("b", null, title), el("span", null, text))),
    down ? el("div", { class: "floor-down", "aria-hidden": "true" }, icon("chevron-down"), down) : null]),
  el("p", { class: "muted small" }, "Monter : le fil d'Ariane du haut (un clic), le bouton « Monter », ou Alt + ↑. Passer d'une pièce à l'autre sans monter : le chevron du fil d'Ariane, ou un onglet de travail."));
const shelvesCard = () => el("section", { class: "card" }, el("h2", null, el("span", { class: "step-no" }, "C"), "Les étagères", el("small", { class: "floor-sub" }, "ce que l'on consulte, de partout")),
  SHELVES.map(([href, pict, title, text]) => el("a", { class: "floor-shelf", href }, icon(pict), el("span", null, title, el("small", null, text)))));
const row = (it, color) => el("div", { class: "floor-row", style: { "--g": it.color || color } }, el("a", { class: "floor-go", href: it.hash, "data-part": it.id, onClick: (e) => tabClick(e, "part", it.id) }, icon(it.icon), el("span", { class: "grow" }, it.title), el("small", null, it.sub)), tabButton("part", it.id, it.title));

function partsCard(p, only) {
  const list = el("div", { class: "floor-groups" + (only ? " one" : "") }), count = el("small", { class: "floor-sub" });
  const search = el("input", { type: "search", class: "floor-search", placeholder: "Chercher une pièce, un numéro…", "aria-label": "Chercher une pièce", value: st.q, onInput: (e) => { st.q = e.target.value; draw(); } });
  const segs = [["nature", "Par nature"], ["assembly", "Par assemblage"]].map(([k, label]) => el("button", { type: "button", "data-k": k, onClick: () => { st.mode = k; mark(); draw(); } }, label));
  const mark = () => segs.forEach((b) => { const on = b.dataset.k === st.mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  function draw() {
    const parts = only ? p.parts.filter((x) => natureKey(x) === only.key) : p.parts, groups = filterGroups(st.mode === "assembly" && !only ? assemblyGroups(p) : natureGroups(parts).map((g) => ({ ...g, hash: natureHash(g.key) })), st.q), shown = new Set(groups.flatMap((g) => g.items.map((it) => it.id))).size;
    count.textContent = `${parts.length} pièce${parts.length > 1 ? "s" : ""}${st.q ? ` · ${shown} montrée${shown > 1 ? "s" : ""}` : ""}`;
    list.replaceChildren(...(groups.length ? groups.map((g) => el("div", { class: "floor-group", style: { "--g": g.color } },
      only ? null : el("h3", null, g.hash ? el("a", { href: g.hash, "data-tip": g.key.startsWith("asm:") ? "Ouvrir cet assemblage" : `Niveau 2 — ${g.label} : ses pièces, les règles de son procédé` }, icon(g.icon), g.label, g.fr ? el("small", null, `· ${g.fr}`) : null) : el("span", null, icon(g.icon), g.label), el("b", null, String(g.items.length)), g.key.startsWith("asm:") ? tabButton("asm", g.key.slice(4), g.label) : null),
      g.items.map((it) => row(only ? { ...it, sub: `${it.sub} · ${materialOrDefault((store.part(it.id) || {}).material).name}` } : it, g.color)))) : [el("p", { class: "muted" }, parts.length ? "Rien ne correspond à ce que vous cherchez." : only ? "Aucune pièce de cette nature pour l'instant." : "Aucune pièce pour l'instant : les trois portes ci-dessus en créent une.")]));
  }
  const card = el("section", { class: "card" }, el("h2", null, el("span", { class: "step-no" }, "B"), only ? "Les pièces de cette nature" : "Les pièces du produit", count),
    el("div", { class: "floor-tools" }, el("label", { class: "floor-find" }, icon("search"), search), only ? null : el("span", { class: "seg", role: "group", "aria-label": "Ranger les pièces" }, segs),
      only ? null : btn("Importer…", () => app.pickFile && app.pickFile(), { small: true, icon: "upload", tip: "Importer une pièce : .dwiz, JSON ou STEP" })),
    list, el("p", { class: "muted small" }, "Un clic ouvre la pièce dans le studio de sa nature. Ctrl + clic, ou ", icon("external"), " au bout de la ligne : la garder en onglet de travail, sans quitter cette page."));
  mark(); draw();
  return { card, draw };
}

/** Levels 1 and 2. args : [] for the Shop, ["n", nature] for one nature of part. */
export function floor(main, args) {
  const p = store.project, only = args[0] === "n" && NATURES.some((n) => n.key === args[1]) ? nature(args[1]) : null, page = el("div", { class: "page floor" });
  main.append(page);
  const parts = partsCard(p, only), left = el("div"), right = el("div");
  if (!only) {
    page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Atelier"), el("p", { class: "muted" }, "Là où les pièces naissent, et d'où l'on voit toutes celles du produit."))));
    left.append(el("section", { class: "card" }, el("h2", null, el("span", { class: "step-no" }, "A"), "Créer une pièce", el("small", { class: "floor-sub" }, "trois portes — ou un studio, pour une pièce d'une nature précise")),
      el("div", { class: "floor-doors" }, DOORS.map(([href, pict, color, title, text, main1]) => el("a", { class: "floor-door" + (main1 ? " main" : ""), href, style: { "--g": color } }, icon(pict), el("b", null, title), el("small", null, text)))),
      el("div", { class: "floor-studios" }, el("span", { class: "muted" }, "Ou dans un studio :"), STUDIOS.map((k) => { const n = nature(k); return el("button", { class: "floor-chip", type: "button", style: { "--g": n.color }, "data-tip": `${MAKE[k][0]} — ${n.label} (${n.fr})`, onClick: MAKE[k][1] }, icon(n.icon), n.label); }))));
  } else {
    const n = only.rules, mine = p.parts.filter((x) => natureKey(x) === only.key).length;
    page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", { class: "floor-h1", style: { "--g": only.color } }, icon(only.icon), only.label), el("p", { class: "muted" }, `${only.fr[0].toUpperCase()}${only.fr.slice(1)} — ${mine} pièce${mine > 1 ? "s" : ""} dans ce produit. Niveau 2 : les pièces de cette nature, ce que son procédé demande, et une nouvelle pièce de cette nature.`)),
      btn(MAKE[only.key][0], MAKE[only.key][1], { primary: true, icon: "plus" }), n ? el("a", { class: "btn", href: `#/process/${n}`, "data-tip": "Ce que ce procédé demande au dessin, matière par matière" }, icon("cast"), "Règles du procédé") : null));
  }
  left.append(parts.card); right.append(levelsCard(only ? 2 : 1), shelvesCard());
  page.append(el("div", { class: "floor-grid" }, left, right));
  const off = store.on("change", () => { if (document.body.contains(page)) parts.draw(); });
  return () => off();
}
