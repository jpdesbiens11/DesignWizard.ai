/* DesignWizard.ai — Accueil: projects, the two demonstration projects, and the journey from the design intent to the report. */

import { el, icon, btn, toast, promptBox, confirmBox, fmt } from "../core/dom.js";
import { registerModule, go, app, refresh } from "../core/app.js";
import { store } from "../core/store.js";
import { DEMO_DRIVE } from "../demo/demo_drive.js";
import { demoBoard } from "../demo/demo_pcba.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../demo/demo_hvb.js";

const STEPS = [
  ["shop", "Atelier", "Dites l'intention : à quoi sert la pièce, ses interfaces, sa matière, sa matière première. Elle se construit sous vos yeux, sans esquisse — ou par une entrevue avec Claude."],
  ["parts", "Pièces", "Ajustez la pièce avec ses curseurs, la baguette (Ctrl+K) ou l'arbre de construction. Le DFM se vérifie en direct ; l'onglet Artéfacts prépare le dossier de commande."],
  ["pcba", "PCBA", "Une carte électronique à partir de ses fonctions : blocs de circuit, layout conceptuel puis détaillé, règles, Gerber, rapport de revue."],
  ["assembly", "Assemblage", "Ajoutez les pièces : les interfaces identiques se matent seules et restent liées. Changez un côté, l'autre suit."],
  ["physics", "Physique", "Une poutre, une vis, un tube, une ailette : des modèles simples disent si la physique fonctionne. La simulation par éléments finis simplifiés confirme, sur la vraie géométrie."],
  ["creepage", "Isolation", "Creepage et clearance mesurés sur l'assemblage complet, comparés à IEC 60664-1."],
  ["dfx", "DFx", "DFM par procédé, DFA de l'assemblage, correctifs en un clic."],
  ["drawings", "Dessins", "Vues, cotes, GD&T tiré des interfaces, cartouche et notes — en PDF."],
  ["review", "Revue", "Chaque pièce, assemblage, carte et analyse : son état, vos notes, sa révision. Une IA écrit le premier jet ou la révision ; vous validez."],
  ["report", "Rapport", "Le dossier de design review : images, analyses, verdicts."],
];

/* The technology bricks, from the intent to the open exchange: [number, name, what it brings, where it lives]. */
const BRICKS = [
  [0, "Intention", "À quoi sert la pièce, ses efforts, son milieu, la quantité.", "#/shop"],
  [1, "Interfaces", "Le contrat avec les pièces voisines, écrit avant la pièce.", "#/interfaces/registre"],
  [2, "Matière & procédé", "Matière première du commerce, opérations, gamme.", "#/shop"],
  [3, "Pièce", "Le solide exact et ses paramètres, dans le format .dwiz.", "#/parts"],
  [4, "Artéfacts & commande", "STEP, DXF, STL, PDF, FeatureScript — et le dossier de commande.", "#/parts"],
  [5, "Physique & simulation", "21 modèles à la main, puis des éléments finis simplifiés recoupés par eux.", "#/physics"],
  [6, "Assemblage", "Les interfaces identiques s'accouplent seules et restent liées.", "#/assembly"],
  [7, "Isolation & DFx", "Lignes de fuite, distances dans l'air, 118 règles de fabricabilité.", "#/dfx"],
  [8, "Dessins & rapport", "Dessin coté, GD&T tiré des interfaces, revue de conception.", "#/report"],
  [9, "Échange ouvert", "Votre Google Drive, Onshape, et un code libre sous licence MIT.", "#/account"],
];

async function loadDemo(seed, target) {
  const p = await store.create(seed.name, seed === DEMO_DRIVE ? { ...seed, boards: [demoBoard()] } : seed);       // the drive comes with its control board, designed from its functions
  toast(`Projet « ${p.name} » chargé.`, "success");
  go(target);
}
const HVB_PROJECT = { dw: "project/1", id: "demo-hvb", name: "DEMO-HVB — busbars 800 V (référence creepage)", author: "DesignWizard.ai",
  description: "Le produit d'exemple de la formation Creepage & Clearance : distances connues par construction (16,56 / 26 mm entre HV+ et HV-).", parts: DEMO_HVB_PARTS, assemblies: [DEMO_HVB_ASSEMBLY], log: [] };

function render(main) {
  const page = el("div", { class: "page" });
  main.append(page);
  const p = store.project;
  page.append(el("section", { class: "hero" },
    el("div", null, el("p", { class: "hero-title" }, "De l'", el("mark", null, "intention"), " à la pièce, de la pièce au système."),
      el("p", null, "DesignWizard.ai réinvente la conception mécatronique : une pièce naît de son intention — ses interfaces, sa matière, sa matière première — comme dans l'atelier d'un artisan. Les assemblages se montent d'eux-mêmes, la physique se vérifie par des modèles simples, et les règles DFM, DFA et d'isolation s'appliquent dès la première minute. Libre, sous licence MIT."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } },
        btn("Charger la démonstration « Variateur 400 V »", () => loadDemo(DEMO_DRIVE, "#/assembly/DRV-ASM"), { primary: true, icon: "sparkle", tip: "Boîtier moulé, deux PCB, dissipateur extrudé : tout est déjà relié par ses interfaces" }),
        btn("Premier design avec une IA…", () => app.firstDesign(), { icon: "wizard", tip: "Décrivez le produit : l'assistant de votre choix mène l'entrevue et rend un premier design complet — pièces, assemblage, carte, analyses — à passer en revue ici" }),
        btn("Nouveau projet", async () => { const name = await promptBox("Nouveau projet", "Nom du projet", "Mon produit"); if (name) { await store.create(name); go("#/shop"); } }, { icon: "plus" }),
        btn("Importer…", () => app.pickFile(), { icon: "upload", tip: "Projet .json, pièce JSON d'une entrevue, ou fichier STEP — vous pouvez aussi coller (Ctrl+V) ou déposer un fichier n'importe où" }))),
    el("img", { src: `img/sketch/hero-${document.documentElement.dataset.theme || "carnet"}.svg`, alt: "" })));

  page.append(el("h2", null, "Les briques"),
    el("p", { class: "muted", style: { marginTop: "-.3rem" } }, "L'objectif : commander en quelques jours des pièces faisables, prototyper la physique du produit, l'essayer au laboratoire — et fermer la boucle de conception avant de lancer la série."),
    el("div", { class: "bricks" }, BRICKS.map(([n, title, text, href]) => el(href ? "a" : "div", { class: "brick", href }, icon(`b${n}`), el("b", null, el("i", null, `B${n}`), title), el("small", null, text)))));
  page.append(el("h2", null, "Le parcours"));
  page.append(el("div", { class: "grid", style: { marginBottom: "1.6rem" } }, STEPS.map(([key, title, text], i) => el("a", { class: "card lift", href: `#/${key}`, style: { "--acc": `var(--tab-acc)` }, "data-key": key },
    el("h3", null, icon(app.modules.get(key).icon), ` ${i + 1}. ${title}`), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, text)))));

  const head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Projets"),
    el("p", { class: "muted" }, store.mode === "server" ? "Projets enregistrés sur ce poste par le serveur local." : store.mode === "drive" ? "Vos projets vivent dans votre Google Drive, un dossier par produit sous « DesignWizard.ai » : pièces, assemblages, analyses, rapports et commandes y sont rangés par numéro." : "Mode navigateur : les projets restent dans ce navigateur. Exportez-les (menu Projet) pour les partager ou les sauvegarder.")));
  page.append(head);
  const grid = el("div", { class: "grid" });
  page.append(grid);
  store.list().then((list) => {
    for (const it of list) {
      const open = p && p.id === it.id;
      grid.append(el("div", { class: "card taped" + (open ? "" : " lift"), onClick: async () => { if (!open) { await store.open(it.id); refresh(); } } },
        el("h3", null, it.name || it.id), el("p", { class: "muted", style: { fontSize: ".82rem" } }, `${it.updated ? new Date(it.updated).toLocaleString("fr-CA") : ""}${it.parts !== undefined ? ` · ${it.parts} pièce(s)` : ""}`),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, open ? el("a", { class: "btn btn-small btn-primary", href: "#/parts" }, "Projet ouvert → Pièces") : btn("Ouvrir", null, { small: true }),
          btn("", async (e) => { e.stopPropagation(); if (await confirmBox("Supprimer le projet", `Supprimer « ${it.name || it.id} » ?${store.mode === "server" ? " Il est déplacé dans la corbeille du dossier data." : store.mode === "drive" ? " Son dossier va dans la corbeille de Google Drive (récupérable 30 jours)." : ""}`, "Supprimer", true)) { await store.remove(it.id); refresh(); } }, { small: true, icon: "trash", danger: true, tip: "Supprimer ce projet" }))));
    }
    if (!list.length) grid.append(el("div", { class: "empty", style: { gridColumn: "1 / -1" } }, el("h2", null, "Le carnet attend sa première page"), el("p", null, "Chargez la démonstration ou créez un projet pour commencer.")));
  });

  page.append(el("h2", { style: { marginTop: "1.6rem" } }, "Exemples"));
  page.append(el("div", { class: "grid" },
    el("button", { class: "card lift", type: "button", onClick: () => loadDemo(DEMO_DRIVE, "#/assembly/DRV-ASM") }, el("h3", null, icon("power"), " Variateur compact 400 V"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Puissance, contrôle, capteurs, CPU, deux PCB, boîtier, dissipateur extrudé. L'écart HV+ / HV- est volontairement juste : l'analyse d'isolation le trouve.")),
    el("button", { class: "card lift", type: "button", onClick: () => loadDemo(HVB_PROJECT, "#/creepage/DEMO-HVB") }, el("h3", null, icon("creepage"), " DEMO-HVB — busbars 800 V"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Le produit d'exemple de la formation Creepage & Clearance : nervure, fente, rainure, capot. Distances connues par construction."))));
  if (p) page.append(el("p", { class: "muted", style: { marginTop: "1.2rem", fontSize: ".84rem" } }, `Projet ouvert : ${p.name} — ${p.parts.length} pièce(s), ${p.assemblies.length} assemblage(s), ${fmt(JSON.stringify(p).length / 1024, 0)} Ko.`));
}

registerModule({ key: "home", label: "Accueil", icon: "home", tip: "Projets, exemples et parcours", render });
