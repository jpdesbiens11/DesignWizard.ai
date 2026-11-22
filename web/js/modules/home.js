/* DesignOrbit.ai — Accueil: projects, the two demonstration projects, and the journey from the design intent to the report. */

import { el, icon, btn, toast, modal, promptBox, confirmBox, fmt } from "../core/dom.js";
import { pageVeil } from "../core/busy.js";
import { registerModule, go, app, refresh, setStatus } from "../core/app.js";
import { store, freshName } from "../core/store.js";
import { DEMO_DRIVE } from "../demo/demo_drive.js";
import { demoBoard } from "../demo/demo_pcba.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../demo/demo_hvb.js";
import { WORDS_HVB } from "../demo/demo_words.js";
import { DEMO_ROVER } from "../demo/demo_rover.js";
import { DEMO_ROCKET } from "../demo/demo_rocket.js";
import { bmProject } from "../demo/demo_bm.js";
import { inverterProject } from "../demo/demo_inverter.js";
import { moldedProject } from "../demo/demo_molded.js";
import { firstSteps, firstStepsLine } from "../core/first_steps.js";
import { showFilm, filmLength } from "../core/film.js";

const STEPS = [
  ["shop", "Atelier", "Dites l'intention : à quoi sert la pièce, ses interfaces, sa matière, sa matière première. Elle se construit sous vos yeux, sans esquisse — ou par une entrevue avec Claude."],
  ["parts", "Pièces", "Ajustez la pièce avec ses curseurs, la baguette (Ctrl+K) ou l'arbre de construction. Le DFM se vérifie en direct ; l'onglet Artéfacts prépare le dossier de commande."],
  ["pcba", "PCBA", "Une carte électronique à partir de ses fonctions : blocs de circuit, layout conceptuel puis détaillé, règles, Gerber, rapport de revue."],
  ["elab", "Labo", "La carte essayée avant d'exister : chaque bloc sur un banc simulé — pistes qui s'allument, oscilloscopes — et le plan de test fonctionnel à dérouler au vrai laboratoire."],
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
  [0, "Intention", "À quoi sert la pièce, ses efforts, son milieu, la quantité.", "#/shop/new"],
  [1, "Interfaces", "Le contrat avec les pièces voisines, écrit avant la pièce.", "#/interfaces/registre"],
  [2, "Matière & procédé", "Matière première du commerce, opérations, gamme.", "#/shop/new"],
  [3, "Pièce", "Le solide exact et ses paramètres, dans le format .dwiz.", "#/parts"],
  [4, "Artéfacts & commande", "STEP, DXF, STL, PDF, FeatureScript — et le dossier de commande.", "#/parts"],
  [5, "Physique & simulation", "21 modèles à la main, puis des éléments finis simplifiés recoupés par eux.", "#/physics"],
  [6, "Assemblage", "Les interfaces identiques s'accouplent seules et restent liées.", "#/assembly"],
  [7, "Isolation & DFx", "Lignes de fuite, distances dans l'air, 119 règles de fabricabilité.", "#/dfx"],
  [8, "Dessins & rapport", "Dessin coté, GD&T tiré des interfaces, revue de conception.", "#/report"],
  [9, "Échange ouvert", "Votre Google Drive, Onshape, et un code libre sous licence MIT.", "#/account"],
];

const askDemo = (name) => new Promise((resolve) => { let out = null;
  const m = modal("Démonstration déjà chargée", [el("p", null, `« ${name} » est déjà dans vos projets. Ouvrir la vôtre, telle que vous l'avez laissée, ou en charger une neuve à côté ?`),
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("En charger une neuve", () => { out = "new"; m.close(); }, { icon: "plus" }), btn("Ouvrir la mienne", () => { out = "open"; m.close(); }, { primary: true, icon: "folder" }))], { onClose: () => resolve(out) }); });
/* One click, one project. Writing a project in Drive takes a few seconds : the click answers at once and a second one is ignored — it used
   to make a twin. A demonstration already among the projects is opened, unless the person asks for a fresh one, which is then numbered. */
let loading = false;
async function loadDemo(seed, target) {
  if (loading) return;
  loading = true; setStatus("Chargement de la démonstration…", "busy");
  const veil = pageVeil(), drive = store.mode === "drive" ? "drive" : ""; let off = false;
  const stop = () => { off = true; store.cancelOpen(); veil.set(""); setStatus("Chargement annulé", ""); toast("Chargement annulé : votre projet en cours n'a pas changé.", "info"); };
  try {
    veil.set(drive ? "Lecture de vos projets dans Google Drive…" : "Lecture de vos projets…", { cancel: stop, kind: drive });
    const list = await store.list(), mine = list.filter((x) => x.name === seed.name || String(x.name).startsWith(`${seed.name} (`)); if (off) return;
    veil.set("");
    const choice = mine.length ? await askDemo(seed.name) : "new";
    if (!choice) { setStatus("Prêt", ""); return; }
    if (choice === "open") { veil.set(`Ouverture de « ${mine[0].name} »…`, { cancel: stop, kind: drive }); await store.open(mine[0].id); veil.set(""); toast(`« ${mine[0].name} » ouvert, tel que vous l'avez laissé.`, "info"); go(target); return; }
    veil.set(drive ? "Écriture du projet dans votre Google Drive…" : "Création du projet…", { kind: drive });      // no cancel here : a project half written would be worse than a wait
    const name = freshName(seed.name, list.map((x) => x.name)), words = seed.drawing && seed.drawing.words, tail = name.startsWith(seed.name) ? name.slice(seed.name.length) : "";
    const named = words && words[seed.name] && tail ? { ...seed, drawing: { ...seed.drawing, words: Object.fromEntries(Object.entries(words).map(([k, v]) => (k === seed.name ? [name, v + tail] : [k, v]))) } } : seed;      // a second copy is « … (2) » : its drawings say its name in English too
    const p = await store.create(name, seed === DEMO_DRIVE ? { ...named, boards: [demoBoard()] } : named);       // the drive comes with its control board, designed from its functions
    veil.set(""); toast(`Projet « ${p.name} » chargé.`, "success");
    go(target);
  } catch (e) { veil.set(""); if (!(e && e.cancelled) && !off) { toast(e.message || String(e), "error", 7000); setStatus("Prêt", ""); } } finally { loading = false; }
}
const HVB_PROJECT = { dw: "project/1", id: "demo-hvb", name: "DEMO-HVB — busbars 800 V (référence creepage)", author: "DesignOrbit.ai",
  description: "Le produit d'exemple de la formation Creepage & Clearance : distances connues par construction (16,56 / 26 mm entre HV+ et HV-).", parts: DEMO_HVB_PARTS, assemblies: [DEMO_HVB_ASSEMBLY], drawing: { words: WORDS_HVB }, log: [] };

function render(main) {
  const page = el("div", { class: "page" });
  main.append(page);
  const p = store.project;
  page.append(el("section", { class: "hero" },
    el("div", null, el("p", { class: "hero-title" }, "De l'", el("mark", null, "intention"), " à la pièce, de la pièce au système."),
      el("p", null, "DesignOrbit.ai réinvente la conception mécatronique : une pièce naît de son intention — ses interfaces, sa matière, sa matière première — comme dans l'atelier d'un artisan. Les assemblages se montent d'eux-mêmes, la physique se vérifie par des modèles simples, et les règles DFM, DFA et d'isolation s'appliquent dès la première minute. Libre, sous licence MIT."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } },
        btn("Charger la démonstration « Variateur 400 V »", () => loadDemo(DEMO_DRIVE, "#/assembly/DRV-ASM"), { primary: true, icon: "sparkle", tip: "Boîtier moulé, deux PCB, dissipateur extrudé : tout est déjà relié par ses interfaces" }),
        btn("Premier design avec une IA…", () => app.firstDesign(), { icon: "wizard", tip: "Décrivez le produit : l'assistant de votre choix mène l'entrevue et rend un premier design complet — pièces, assemblage, carte, analyses — à passer en revue ici" }),
        btn("Nouveau projet", async () => { const name = await promptBox("Nouveau projet", "Nom du projet", "Mon produit"); if (name) { await store.create(name); go("#/shop"); } }, { icon: "plus" }),
        btn(`Voir la vidéo (${filmLength()})`, () => showFilm(), { icon: "play", tip: "La plateforme en deux minutes et demie, sur ses vrais écrans — en français ou en anglais" }),
        el("a", { class: "btn", href: "presentation.html", target: "_blank", rel: "noopener", "data-tip": "De la conception d'aujourd'hui à l'assemblage prêt à commander, brique par brique — une vingtaine de pages à faire défiler" }, icon("eye"), "Présentation guidée"),
        btn("Importer…", () => app.pickFile(), { icon: "upload", tip: "Projet .json, pièce JSON d'une entrevue, ou fichier STEP — vous pouvez aussi coller (Ctrl+V) ou déposer un fichier n'importe où" }),
        el("a", { class: "btn btn-primary gh", href: "https://github.com/jpdesbiens11/DynamiteOrbit.ai", target: "_blank", rel: "noopener noreferrer", "data-tip": "Le code source, sous licence MIT" }, "GitHub"))),
    el("img", { src: `img/sketch/hero-${document.documentElement.dataset.theme || "carnet"}.svg`, alt: "" })));

  /* first steps : where this project stands, and the next thing to do */
  { const F = firstSteps(p), strip = el("a", { class: "fs-strip", href: "#/start", "data-first-steps": `${F.done}/${F.total}`, "data-tip": "Les huit étapes, de la page blanche à la révision libérée — elles se cochent d'après le projet" },
      icon("sparkle"), el("span", { class: "grow" }, el("b", null, "Premiers pas"), el("small", null, `${firstStepsLine(F)}.`)),
      el("span", { class: "fs-bar", "aria-hidden": "true" }, F.steps.map((s) => { const d = el("span", { class: "fs-tick" + (s.done ? " done" : s.next ? " next" : "") }); d.style.setProperty("--dom", s.color); return d; })), el("span", { class: "btn btn-small" }, F.next ? "Continuer" : "Revoir"));
    page.append(strip); }
  page.append(el("h2", null, "Les briques"),
    el("p", { class: "muted", style: { marginTop: "-.3rem" } }, "L'objectif : commander en quelques jours des pièces faisables, prototyper la physique du produit, l'essayer au laboratoire — et fermer la boucle de conception avant de lancer la série."),
    el("div", { class: "bricks" }, BRICKS.map(([n, title, text, href]) => el(href ? "a" : "div", { class: "brick", href }, icon(`b${n}`), el("b", null, el("i", null, `B${n}`), title), el("small", null, text)))));
  page.append(el("h2", null, "Le parcours"));
  page.append(el("div", { class: "grid", style: { marginBottom: "1.6rem" } }, STEPS.map(([key, title, text], i) => el("a", { class: "card lift", href: `#/${key}`, style: { "--acc": `var(--tab-acc)` }, "data-key": key },
    el("h3", null, icon(app.modules.get(key).icon), ` ${i + 1}. ${title}`), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, text)))));

  const head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Projets"),
    el("p", { class: "muted" }, store.mode === "server" ? "Projets enregistrés sur ce poste par le serveur local." : store.mode === "drive" ? "Vos projets vivent dans votre Google Drive, un dossier par produit sous « DesignOrbit.ai » : pièces, assemblages, analyses, rapports et commandes y sont rangés par numéro." : "Mode navigateur : les projets restent dans ce navigateur. Exportez-les (menu Projet) pour les partager ou les sauvegarder.")));
  page.append(head);
  const grid = el("div", { class: "grid" });
  page.append(grid);
  store.list().then((list) => {
    for (const it of list) {
      const open = p && p.id === it.id;
      grid.append(el("div", { class: "card taped" + (open ? "" : " lift"), onClick: async () => { if (open) return; const veil = pageVeil(), kind = store.mode === "drive" ? "drive" : "";      // a project of one's own, opened : said, timed, and called off while it is still being read
          veil.set(`Ouverture de « ${it.name || it.id} »…`, { kind, cancel: () => { store.cancelOpen(); veil.set(""); toast("Ouverture annulée : votre projet en cours n'a pas changé.", "info"); } });
          try { await store.open(it.id); veil.set(""); refresh(); } catch (e) { veil.set(""); if (!(e && e.cancelled)) toast(e.message || String(e), "error", 7000); } } },
        el("h3", null, it.name || it.id), el("p", { class: "muted", style: { fontSize: ".82rem" } }, `${it.updated ? new Date(it.updated).toLocaleString("fr-CA") : ""}${it.parts !== undefined ? ` · ${it.parts} pièce(s)` : ""}`),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, open ? el("a", { class: "btn btn-small btn-primary", href: "#/parts" }, "Projet ouvert → Pièces") : btn("Ouvrir", null, { small: true }),
          btn("", async (e) => { e.stopPropagation(); if (await confirmBox("Supprimer le projet", `Supprimer « ${it.name || it.id} » ?${store.mode === "server" ? " Il est déplacé dans la corbeille du dossier data." : store.mode === "drive" ? " Son dossier va dans la corbeille de Google Drive (récupérable 30 jours)." : ""}`, "Supprimer", true)) { await store.remove(it.id); refresh(); } }, { small: true, icon: "trash", danger: true, tip: "Supprimer ce projet" }))));
    }
    if (!list.length) grid.append(el("div", { class: "empty", style: { gridColumn: "1 / -1" } }, el("h2", null, "Le carnet attend sa première page"), el("p", null, "Chargez la démonstration ou créez un projet pour commencer.")));
  });

  page.append(el("h2", { style: { marginTop: "1.6rem" } }, "Exemples"));
  page.append(el("div", { class: "grid" },
    el("button", { class: "card lift", type: "button", onClick: () => loadDemo(DEMO_DRIVE, "#/assembly/DRV-ASM") }, el("h3", null, icon("power"), " Variateur compact 400 V"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Puissance, contrôle, capteurs, CPU, deux PCB, boîtier, dissipateur extrudé. L'écart HV+ / HV- est volontairement juste : l'analyse d'isolation le trouve.")),
    el("button", { class: "card lift", type: "button", "data-example": "rover", onClick: () => loadDemo(DEMO_ROVER, "#/assembly/RVR-ASM") }, el("h3", null, icon("assembly"), " Rover — véhicule autonome"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Le Rover de la visite guidée de DynamiteAgile, en 3D : châssis 1:16, plaque découpée au laser, boîtier et pare-chocs imprimés, Raspberry Pi, capteurs. Vingt-quatre pièces, trente instances, toutes accouplées par leurs interfaces.")),
    el("button", { class: "card lift", type: "button", "data-example": "rocket", onClick: () => loadDemo(DEMO_ROCKET, "#/assembly/FUS-ASM") }, el("h3", null, icon("sparkle"), " Fusée à moteur hybride"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Ø 8 po, 3,66 m : bloc de polyuréthane, réservoir de protoxyde d'azote, vanne, tuyère refroidie par un serpentin en hélice, carte de commande, parachute, quatre ailerons fixes. Un exercice de CAO, ni dimensionné ni validé.")),
    el("button", { class: "card lift", type: "button", "data-example": "molded", onClick: () => loadDemo(moldedProject(), "#/parts/EDU-IM-SHELL") }, el("h3", null, icon("part"), " Deux pièces moulées"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Pour apprendre : une coque injectée en plastique (paroi unique, dépouilles, nervures, bossages, point d'injection) et une équerre en aluminium injecté sous pression, reprise en usinage — de la conception à la gamme jouée, au dessin et à ce qui part au fournisseur.")),
    el("button", { class: "card lift", type: "button", "data-example": "inverter", onClick: () => loadDemo(inverterProject(), "#/assembly/INV-ASM") }, el("h3", null, icon("power"), " Onduleur de traction"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Un onduleur triphasé monté sur son moteur, par ses principes : boîtier moulé à cavités de hauteurs différentes, côté courbe et pans coupés, couvercle embouti à rabats et joint collé, petit couvercle dessous, étage de puissance potté sous un busbar laminé, cartes et connecteurs en enveloppes génériques. Aucune marque, aucun dessin copié.")),
    el("button", { class: "card lift", type: "button", "data-example": "bm", onClick: () => loadDemo(bmProject({ branch: "c3" }), "#/assembly/BM-8S8P-ASM") }, el("h3", null, icon("power"), " BM 8s8p - 21700"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Module de batterie : 8 CORE de 8 cellules 21700 en parallèle, en série côte à côte, face contre face ; chaque CORE avec sa carte de mesure, son busbar laminé soudé sur le dessus et ses capteurs dans le support du bas, dans un boîtier extrudé ; le couvercle du haut ferme la boucle. S'ouvre sur le concept 3 (chaque joint, une lame dans une pince) ; les concepts 1 et 2 sont dans l'historique.")),
    el("button", { class: "card lift", type: "button", onClick: () => loadDemo(HVB_PROJECT, "#/creepage/DEMO-HVB") }, el("h3", null, icon("creepage"), " DEMO-HVB — busbars 800 V"), el("p", { class: "muted", style: { margin: 0, fontSize: ".86rem" } }, "Le produit d'exemple de la formation Creepage & Clearance : nervure, fente, rainure, capot. Distances connues par construction."))));
  if (p) page.append(el("p", { class: "muted", style: { marginTop: "1.2rem", fontSize: ".84rem" } }, `Projet ouvert : ${p.name} — ${p.parts.length} pièce(s), ${p.assemblies.length} assemblage(s), ${fmt(JSON.stringify(p).length / 1024, 0)} Ko.`));
}

registerModule({ key: "home", label: "Accueil", icon: "home", tip: "Projets, exemples et parcours", render });
