/* DesignWizard.ai — Aide: how the platform works, shortcuts, the wand's vocabulary, the part language, and how
   collaborators send their feedback. */

import { el, icon, btn, copyText, toast } from "../core/dom.js";
import { registerModule, app } from "../core/app.js";
import { store } from "../core/store.js";
import { NL_EXAMPLES } from "../core/nl.js";
import { LANGUAGE_REFERENCE } from "../cad/language_doc.js";

const REPO = "https://github.com/jpdesbiens11/DesignWizard.ai";
const KEYS = [["Ctrl + K", "La baguette : aller partout, lancer une commande, modifier la pièce en langage courant"], ["Ctrl + Z / Ctrl + Y", "Annuler / rétablir (60 étapes, par projet)"], ["Ctrl + S", "Enregistrer tout de suite (l'enregistrement est aussi automatique)"],
  ["Ctrl + V (hors d'un champ)", "Coller n'importe où : réponse d'entrevue JSON, pièce, profil, projet ou STEP — la plateforme reconnaît et range"], ["Glisser-déposer un fichier", "Importer un .json ou un .step"],
  ["Souris : glisser", "Tourner la vue (table tournante, Z vers le haut)"], ["Clic droit ou Maj + glisser", "Déplacer la vue"], ["Molette", "Zoom vers le curseur"],
  ["0 · 1 · 2 · 3 · 4 · 5 · 6", "Vues iso, face, arrière, gauche, droite, dessus, dessous"], ["F", "Cadrer tout"], ["X", "Rayons X"], ["S", "Plan de coupe"], ["Maj + S", "Inverser la coupe : montrer l'autre côté"], ["M", "Mesurer (deux points ou deux faces)"], ["E", "Vue éclatée (assemblage)"],
  ["Clic sur le modèle", "Sélectionner une face, une arête ou un point : la barre du bas dit ce qu'il mesure"], ["Ctrl + clic", "Sélection multiple : ajouter un élément, ou le retirer (deux faces, deux points : la distance)"], ["Clic droit", "Menu de ce qui se fait ici — sur une face, une arête, un perçage, ou dans le vide"],
  ["Double clic sur un perçage", "Ouvrir l'opération ou l'interface qui l'a percé"], ["H · T · P · B · I", "Sur la face choisie : trou, taraudage, poche, bossage, interface"], ["R · C", "Sur les arêtes choisies : congé, chanfrein"], ["N", "Regarder la face choisie de face"], ["Suppr", "Retirer l'opération du perçage choisi"], ["Échap", "Tout désélectionner"]];
const LIMITS = ["Les dessins cotent l'enveloppe et renvoient au tableau des trous ; les cotes de détail ne sont pas encore placées une à une.", "La tôlerie pliée (déplié, rayon de pliage) n'a pas encore sa famille dédiée : utilisez « extrude » d'un profil en L ou en U.",
  "Les contraintes d'assemblage sont les mates d'interfaces ; pas encore de contraintes libres (coaxial, distance) entre faces quelconques.", "L'envoi vers Onshape est testé contre un serveur simulé : la première utilisation sur un vrai compte est à faire sur un document d'essai.",
  "Les tables IEC 60664-1 intégrées sont à vérifier contre votre copie de la norme avant toute décision de certification.", "Une pièce importée en STEP est affichée, assemblée, analysée et exportée, mais n'a ni paramètres ni dessin."];
const ROADMAP = ["Entrevue directement dans l'app avec une clé d'API Claude (aujourd'hui : copier / coller).", "« Envelopper » : générer le boîtier autour des pièces choisies, avec colonnettes et découpes alignées sur leurs interfaces.", "Mates natifs Onshape et variables Onshape reliées aux paramètres de la plateforme.",
  "Chaînes de cotes (tolérancement statistique) calculées le long des interfaces.", "Bibliothèque de pièces standard (visserie, connecteurs, cellules) insérées en 3D depuis la BOM.", "Revue à plusieurs : commentaires épinglés sur le 3D et sur le rapport."];

function render(main) {
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Aide"), el("p", { class: "muted" }, `DesignWizard.ai by DynamiteAgile™ · version ${app.version} · ${store.mode === "server" ? "serveur local (projets sur le disque, Onshape disponible)" : "mode navigateur (aucun serveur)"}`))));
  const card = (title, ...kids) => el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, title), kids);
  page.append(el("div", { class: "two-col" },
    card("L'idée en une minute", el("p", null, "Une pièce ne commence pas par un croquis mais par ses ", el("b", null, "interfaces"), " : ce qui la tient, la positionne ou la relie à ses voisines. Chaque interface a deux côtés (A et B) et des paramètres partagés."),
      el("ol", { style: { paddingLeft: "1.1rem" } }, el("li", null, el("b", null, "Interfaces"), " — décrivez la pièce et cochez ses voisins ; copiez le prompt générique dans Claude ; collez sa réponse : la pièce est construite."),
        el("li", null, el("b", null, "Pièces"), " — curseurs, baguette, arbre de construction ; DFM en direct avec correctifs en un clic."), el("li", null, el("b", null, "Assemblage"), " — les interfaces identiques se matent seules et restent liées : changez un côté, l'autre s'adapte."),
        el("li", null, el("b", null, "Isolation, DFx, Dessins"), " — analyses sur l'assemblage complet, dessins générés avec GD&T."), el("li", null, el("b", null, "Rapport"), " — le dossier de design review, puis l'envoi vers Onshape."))),
    card("Vos commentaires (collaborateurs)", el("p", null, "Cette version est une première itération : tout retour est utile, surtout ce qui vous bloque ou vous surprend."),
      el("ul", { style: { paddingLeft: "1.1rem" } }, el("li", null, "Un problème ou une idée : ouvrez un ticket avec le gabarit « Retour d'essai » ou « Idée »."), el("li", null, "Joignez le projet (menu Projet → Exporter) et une image de la vue (bouton appareil photo)."), el("li", null, "Dites ce que vous vouliez faire, ce que vous avez fait, ce qui s'est passé.")),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, el("a", { class: "btn btn-primary", href: `${REPO}/issues/new/choose`, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Ouvrir un ticket sur GitHub"), el("a", { class: "btn", href: REPO, target: "_blank", rel: "noopener noreferrer" }, "Le dépôt")))));
  page.append(card("Travailler avec une IA", el("p", null, "Tout artéfact du projet — une pièce, un assemblage, une carte, ou le projet entier — peut partir vers une IA et en revenir. Le bouton à l'étincelle, dans la barre du haut, prend ce que montre l'écran ; une liste permet d'en choisir un autre."),
    el("ol", { style: { paddingLeft: "1.1rem" } }, el("li", null, "Écrivez votre demande, comme à un technicien ou à un stagiaire."), el("li", null, "Copiez la demande et l'artéfact (.dwiz), collez-les dans votre assistant."), el("li", null, "Collez sa réponse : l'écran liste chaque ajout, modification et retrait, et signale ce que les vérifications refusent."), el("li", null, "Appliquez — ou non. C'est une seule étape, que Ctrl + Z annule."))));
  page.append(card("Gammes : parler avec le fournisseur et avec le prototypage", el("p", null, "L'onglet « Gamme » d'une pièce écrit sa fabrication phase par phase — poste, prise de pièce, opérations, outils, contrôles — avec les questions à poser au fournisseur. Celui d'un assemblage écrit le montage, une étape par pièce, avec les vis, les couples indicatifs et les clés ; l'étape « Fabrication » du PCBA porte la gamme d'assemblage de la carte."),
    el("ul", { style: { paddingLeft: "1.1rem" } }, el("li", null, "Cliquez une phase : la vue montre la pièce après cette phase, ou le produit à cette étape du montage."), el("li", null, "Notez ce qui se dit sous chaque phase, ajoutez vos points à discuter : ils restent dans l'artéfact."), el("li", null, "Sortez la gamme en Word, en PDF (images de chaque étape, colonne « Réponse », signatures) ou en texte pour un courriel."), el("li", null, "Ce sont des propositions : la gamme de l'atelier fait foi."))));
  page.append(card("Raccourcis", el("table", { class: "data" }, el("tbody", null, KEYS.map(([k, t]) => el("tr", null, el("td", { class: "nowrap" }, k.split(" · ").map((x, i) => [i ? " · " : "", el("kbd", null, x)])), el("td", null, t)))))));
  page.append(el("div", { class: "two-col" },
    card("La baguette comprend", el("p", { class: "muted" }, "Dans une pièce, ouvrez la baguette (Ctrl + K) et écrivez ce que vous voulez. Elle annonce ce qu'elle va faire avant de le faire ; Ctrl + Z l'annule."), el("ul", { style: { paddingLeft: "1.1rem" } }, NL_EXAMPLES.map((x) => el("li", null, el("code", null, x))))),
    card("Limites connues de cette itération", el("ul", { style: { paddingLeft: "1.1rem" } }, LIMITS.map((x) => el("li", null, x))), el("h3", null, "Ensuite"), el("ul", { style: { paddingLeft: "1.1rem" } }, ROADMAP.map((x) => el("li", null, x))))));
  const ref = el("div", { class: "prompt-box", style: { maxHeight: "60vh" } }, LANGUAGE_REFERENCE);
  page.append(card("Le langage de pièce (DW part/1)", el("p", { class: "muted" }, "C'est le langage que Claude écrit à la fin de l'entrevue et que le Part Studio montre dans l'onglet JSON. Il est donné tel quel à l'assistant dans le prompt générique."), ref,
    el("div", { class: "form-actions" }, btn("Copier la référence", async () => toast((await copyText(LANGUAGE_REFERENCE)) ? "Référence copiée." : "Copie impossible."), { icon: "copy" }))));
  page.append(card("Composants tiers", el("p", null, "Noyau géométrique : Open CASCADE Technology (LGPL 2.1 avec exception), compilé en WebAssembly par opencascade.js / replicad. Vue 3D : three.js (MIT). Aucune ressource n'est chargée d'Internet : tout est dans le dépôt.")));
}

registerModule({ key: "help", label: "Aide", icon: "help", hidden: true, tip: "Aide, raccourcis et retours des collaborateurs", render });
