/* DesignWizard.ai — Accueil: projects, the two demonstration projects, and the journey from interfaces to report. */

import { el, icon, btn, toast, promptBox, confirmBox, fmt } from "../core/dom.js";
import { registerModule, go, app, refresh } from "../core/app.js";
import { store } from "../core/store.js";
import { DEMO_DRIVE } from "../demo/demo_drive.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../demo/demo_hvb.js";

const STEPS = [
  ["interfaces", "Interfaces", "Listez les voisins de la pièce. Le prompt générique mène l'entrevue avec Claude ; collez sa réponse : la pièce est créée."],
  ["parts", "Pièces", "Ajustez la pièce avec ses curseurs, la baguette (Ctrl+K) ou l'arbre de construction. Le DFM se vérifie en direct."],
  ["assembly", "Assemblage", "Ajoutez les pièces : les interfaces identiques se matent seules et restent liées. Changez un côté, l'autre suit."],
  ["creepage", "Isolation", "Creepage et clearance mesurés sur l'assemblage complet, comparés à IEC 60664-1."],
  ["dfx", "DFx", "DFM par procédé, DFA de l'assemblage, correctifs en un clic."],
  ["drawings", "Dessins", "Vues, cotes, GD&T tiré des interfaces, cartouche et notes — en PDF."],
  ["report", "Rapport", "Le dossier de design review : images, analyses, verdicts."],
];

async function loadDemo(seed, target) {
  const p = await store.create(seed.name, seed);
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
    el("div", null, el("p", { class: "hero-title" }, "Des ", el("mark", null, "interfaces"), " à la pièce, à l'assemblage, au dossier de revue."),
      el("p", null, "DesignWizard.ai est une plateforme de développement de produit mécatronique : chaque pièce naît de ses interfaces, les assemblages se montent d'eux-mêmes, et les règles DFM, DFA, DFx et d'isolation (creepage / clearance) sont vérifiées dès la conception."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } },
        btn("Charger la démonstration « Variateur 400 V »", () => loadDemo(DEMO_DRIVE, "#/assembly/DRV-ASM"), { primary: true, icon: "sparkle", tip: "Boîtier moulé, deux PCB, dissipateur extrudé : tout est déjà relié par ses interfaces" }),
        btn("Nouveau projet", async () => { const name = await promptBox("Nouveau projet", "Nom du projet", "Mon produit"); if (name) { await store.create(name); go("#/interfaces"); } }, { icon: "plus" }),
        btn("Importer…", () => app.pickFile(), { icon: "upload", tip: "Projet .json, pièce JSON d'une entrevue, ou fichier STEP — vous pouvez aussi coller (Ctrl+V) ou déposer un fichier n'importe où" }))),
    el("img", { src: "img/sketch/hero.svg", alt: "" })));

  page.append(el("h2", null, "Le parcours"));
  page.append(el("div", { class: "grid", style: { marginBottom: "1.6rem" } }, STEPS.map(([key, title, text], i) => el("a", { class: "card lift", href: `#/${key}`, style: { "--acc": `var(--tab-acc)` }, "data-key": key },
    el("h3", null, icon(app.modules.get(key).icon), ` ${i + 1}. ${title}`), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, text)))));

  const head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Projets"),
    el("p", { class: "muted" }, store.mode === "server" ? "Projets enregistrés sur ce poste par le serveur local." : "Mode navigateur : les projets restent dans ce navigateur. Exportez-les (menu Projet) pour les partager ou les sauvegarder.")));
  page.append(head);
  const grid = el("div", { class: "grid" });
  page.append(grid);
  store.list().then((list) => {
    for (const it of list) {
      const open = p && p.id === it.id;
      grid.append(el("div", { class: "card taped" + (open ? "" : " lift"), onClick: async () => { if (!open) { await store.open(it.id); refresh(); } } },
        el("h3", null, it.name || it.id), el("p", { class: "muted", style: { fontSize: ".82rem" } }, `${it.updated ? new Date(it.updated).toLocaleString("fr-CA") : ""}${it.parts !== undefined ? ` · ${it.parts} pièce(s)` : ""}`),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, open ? el("a", { class: "btn btn-small btn-primary", href: "#/parts" }, "Projet ouvert → Pièces") : btn("Ouvrir", null, { small: true }),
          btn("", async (e) => { e.stopPropagation(); if (await confirmBox("Supprimer le projet", `Supprimer « ${it.name || it.id} » ?${store.mode === "server" ? " Il est déplacé dans la corbeille du dossier data." : ""}`, "Supprimer", true)) { await store.remove(it.id); refresh(); } }, { small: true, icon: "trash", danger: true, tip: "Supprimer ce projet" }))));
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
