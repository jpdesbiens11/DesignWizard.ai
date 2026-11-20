/* DesignWizard.ai — the pilot trial : one hour, eleven stations, for someone who has never seen the tool (essai pilote, choix de JP).
   One source for everything that tells the path : the guide of the repository (docs/ESSAI_PILOTE.md), the two documents handed to a
   tester (the path, the feedback sheet — tools/pilot_kit.mjs), and the robot that walks it (tools/pilot_walk.mjs).
   The rule that holds it together : a step names what is on the screen « between quotation marks », and every word so named is in the
   `words` of its station — which the robot looks for on the real screen. A label that changes makes the walk fail, not the tester.
   No figure of gain, no time saved : nobody measured one — the trial is there to find out. Pure. */

export const LINKS = { demo: "https://jpdesbiens11.github.io/DesignWizard.ai/", code: "https://github.com/jpdesbiens11/DesignWizard.ai", issue: "https://github.com/jpdesbiens11/DesignWizard.ai/issues/new/choose" };
export const PILOT = { minutes: 60, title: "Essai pilote", subtitle: "Une heure avec DesignWizard.ai, sur la démonstration « Variateur compact 400 V »",
  aim: "Savoir où un nouveau venu hésite, ce qu'il comprend seul et ce qui lui manque en premier. Ce n'est pas un examen de la personne : c'est l'outil que l'on essaie.",
  honest: "L'outil est un logiciel libre en développement actif. Rien de ce qu'il calcule ne remplace la vérification d'un ingénieur ; chaque méthode dit dans l'Aide ce qui a été lu, testé ou repris de mémoire." };

/** What one needs before the hour starts. */
export const BEFORE = [
  "Un ordinateur avec Chrome ou Edge, une fenêtre d'au moins 1366 px de large, une souris à molette. L'outil n'a pas été essayé au toucher, ni sur Firefox et Safari.",
  `L'outil, de l'une de ces deux façons. En ligne : ${LINKS.demo} — connexion Google ; à la première visite l'écran montre une « empreinte d'accès » et un bouton « Demander l'accès » : l'administrateur l'approuve, puis la porte s'ouvre. Sur votre poste : Python 3.9 ou plus récent, « git clone ${LINKS.code}.git », puis « python designwizard.py » dans le dossier — rien d'autre à installer, rien ne quitte votre poste.`,
  "Une heure sans interruption. Ne préparez rien : c'est le premier contact que l'on veut voir.",
  "La fiche de retour, à côté de vous. Notez au fil de l'eau : où vous avez hésité, ce que vous avez cherché sans le trouver.",
  "Rien de confidentiel : l'essai se fait sur la démonstration, pas sur vos produits.",
];
/** For the one who watches a tester. */
export const HOST = [
  "Laissez la personne lire et cliquer seule. Si elle bloque, attendez trente secondes avant de dire quoi que ce soit — puis notez la question qu'elle a posée, pas la réponse.",
  "Demandez-lui de dire tout haut ce qu'elle cherche. Notez ses mots : ce sont ceux que l'écran devrait employer.",
  "Notez l'heure au début de chaque station. Une station qui déborde se coupe : passez à la suivante, et notez-le.",
  "À la fin, la fiche de retour d'abord, la discussion ensuite : la fiche se remplit mieux avant d'avoir entendu l'avis des autres.",
];

/* A station : { id, minutes, title, screen (where it is in the top bar), goal, steps, look, ask,
     checks : [{ go (hash), click (a label to click first), words (what must be on the screen then) }] } */
export const STATIONS = [
  { id: "entrer", minutes: 5, title: "Entrer", screen: "Accueil", goal: "Ouvrir l'outil, charger la démonstration, repérer la barre du haut.",
    steps: ["Ouvrez l'outil (en ligne ou sur votre poste). Vous êtes sur l'accueil.",
      "Cliquez « Charger la démonstration ». L'assemblage du variateur s'ouvre.",
      "Regardez la barre du haut : trois groupes — « Mécanique », « Électronique », « Produit ». Cliquez-en un : ses écrans se déplient, numérotés dans l'ordre où l'on conçoit. Échap referme.",
      "À droite de la barre, le bouton « Guide » dit ce qui manque ou cloche sur l'écran ouvert ; le point d'interrogation ouvre l'Aide."],
    look: "Sur l'accueil, « Le parcours » liste les écrans dans l'ordre d'une conception.",
    ask: "Avez-vous su où cliquer en premier ? Qu'attendiez-vous de trouver sur l'accueil ?",
    checks: [{ go: "#/home", words: ["Charger la démonstration", "Le parcours"] }, { go: "#/assembly/DRV-ASM", words: ["Mécanique", "Électronique", "Produit", "Guide"] }] },
  { id: "assemblage", minutes: 7, title: "L'assemblage", screen: "Mécanique › 3 Assemblage", goal: "Voir un produit entier, monté par ses interfaces.",
    steps: ["Tournez la vue en glissant dans la vue ; la molette zoome. Sous la vue, essayez « Vue éclatée » (le curseur écarte les pièces), « Rayons X » et, dans le menu de coupe, « Coupe X ».",
      "Volet de droite, onglet « Mates » : cliquez un accouplement — ses deux interfaces se montrent dans la vue.",
      "Onglet « BOM » : la nomenclature, visserie comprise. Onglet « Gamme » : la gamme d'assemblage, phase par phase.",
      "Volet de gauche : mettez le « Couvercle » à Off par son interrupteur. Il reste dans la liste, mais ne compte plus. Remettez-le à On — ou faites Ctrl + Z.",
      "Cliquez « Interférences » : l'outil cherche les volumes communs entre les pièces."],
    look: "Chaque accouplement est né de deux interfaces qui se correspondent : personne ne l'a posé à la main.",
    ask: "Les accouplements faits seuls sont-ils ceux que vous auriez posés ? Un geste de la vue 3D vous a-t-il manqué ?",
    checks: [{ go: "#/assembly/DRV-ASM", words: ["Vue éclatée", "Rayons X", "Coupe X", "Mates", "BOM", "Gamme", "Couvercle", "Interférences"] }] },
  { id: "atelier", minutes: 8, title: "L'Atelier : une pièce née de l'intention", screen: "Mécanique › 1 Atelier", goal: "Faire une pièce sans esquisse : dire à quoi elle sert, l'outil propose.",
    steps: ["Ouvrez l'Atelier, puis la porte « Pas à pas ».",
      "Étape 1 : dans « Nom de la pièce », tapez un nom (par exemple : Équerre de capteur), et dites en une phrase à quoi elle sert.",
      "Étape 2 : cliquez « Je me visse sur… », puis « On se visse sur moi ». La pièce se dessine à mesure.",
      "Étape 3 : choisissez un matériau, par exemple « Aluminium 6061-T6 » ; ce que le procédé choisi ne sait pas travailler est grisé.",
      "Étape 4 : lisez « Gamme de fabrication » et « Ce que le compagnon a décidé ».",
      "« Créer la pièce » : elle arrive dans le projet, prête à être ajustée."],
    look: "Changez une interface de face, ou la matière première : la pièce, la gamme et les décisions changent ensemble.",
    ask: "La pièce proposée est-elle celle qu'un artisan aurait faite ? Qu'auriez-vous voulu dire à l'outil, sans le pouvoir ?",
    checks: [{ go: "#/shop", words: ["Créer une pièce", "Pas à pas", "Avec l'IA", "Les pièces du produit", "Les étagères"] }, { go: "#/shop/new", words: ["Nom de la pièce", "Je me visse sur…", "On se visse sur moi", "Aluminium 6061-T6", "Gamme de fabrication", "Ce que le compagnon a décidé", "Créer la pièce"] }] },
  { id: "pieces", minutes: 6, title: "Une pièce : ses cotes, ses règles, son dossier", screen: "Mécanique › 2 Pièces", goal: "Ajuster une pièce, et voir ce que l'outil en vérifie et en tire.",
    steps: ["Ouvrez les Pièces, puis la Base du boîtier dans la liste de gauche.",
      "Onglet « Paramètres » : changez « Longueur » avec les flèches du champ — tenues, elles accélèrent. La pièce se reconstruit ; le couvercle, lié par ses interfaces, suit.",
      "Volet de gauche, « Arbre de construction » : mettez l'opération posts à Off, puis à On — les colonnettes disparaissent, puis reviennent.",
      "Onglet « DFx » : cliquez un constat pour le situer sur la pièce.",
      "Onglet « Artéfacts » : « STEP » enregistre le fichier d'échange, « Dossier de commande (.zip) » réunit ce qu'un atelier demande."],
    look: "Ctrl + Z annule chaque geste, un à la fois, et dit lequel.",
    ask: "Les constats de fabrication sont-ils justes pour vos procédés ? Lesquels manquent ?",
    checks: [{ go: "#/parts/DRV-BASE", words: ["Paramètres", "Longueur", "Arbre de construction", "DFx", "Artéfacts"] }, { click: "Artéfacts", words: ["STEP", "Dossier de commande (.zip)"] }] },
  { id: "physique", minutes: 5, title: "Le calcul à la main", screen: "Mécanique › 5 Physique", goal: "Poser une question de physique simple, et lire le calcul pas à pas.",
    steps: ["Ouvrez la Physique. À droite, choisissez « Structure », puis « Cantilever · end load ».",
      "À gauche, « Reprendre ses dimensions » lit la longueur, la section et le matériau sur une pièce du projet.",
      "Groupe « Matériau » : une propriété ne se tape pas — elle vient d'un média choisi dans la base.",
      "Changez la charge, dans « Chargement ». Lisez ensuite les onglets « Résultat », « Calcul » (pas à pas) et « Rapport » (note de calcul, classeur)."],
    look: "Les calculs restent en SI, quel que soit le système d'unités choisi pour la conception.",
    ask: "Le calcul pas à pas est-il celui que vous feriez à la main ?",
    checks: [{ go: "#/physics", words: ["Structure", "Cantilever · end load"] }, { click: "Cantilever · end load", words: ["Reprendre ses dimensions", "Matériau", "Chargement", "Résultat", "Calcul", "Rapport"] }] },
  { id: "simulation", minutes: 6, title: "La simulation, après l'estimation", screen: "Mécanique › 6 Simulation", goal: "Lancer un calcul par éléments finis, et le recouper avec une estimation.",
    steps: ["Ouvrez la Simulation ; la Base du boîtier est choisie, avec son « Cas de charge ».",
      "Un champ clignote : la pression est un exemple que l'outil a inventé. Tapez la vôtre, ou gardez-la par le bouton « Garder 0.002 MPa » à côté du champ. Tant que ce n'est pas fait, l'action attend.",
      "Lisez « Avant de calculer — l'estimation à la main » : l'ordre de grandeur attendu, avant tout calcul.",
      "« Lancer la simulation » : un voile dit ce qui se fait et depuis combien de temps ; son bouton d'annulation arrête vraiment.",
      "Onglet « Résultat » : la carte des contraintes, et le recoupement avec l'estimation."],
    look: "Une valeur inventée par l'outil n'est jamais prise pour une décision : elle clignote jusqu'à ce que vous la confirmiez.",
    ask: "L'estimation à la main vous aide-t-elle à croire le résultat — ou à en douter ?",
    checks: [{ go: "#/fea/DRV-BASE", words: ["Cas de charge", "Garder 0.002 MPa", "Avant de calculer — l'estimation à la main", "Lancer la simulation", "Résultat"] }] },
  { id: "isolation", minutes: 5, title: "L'isolation électrique", screen: "Électronique › 4 Isolation", goal: "Mesurer les distances d'isolement sur le produit entier.",
    steps: ["Ouvrez l'Isolation.",
      "« Analyser » : l'outil mesure, pour chaque paire de potentiels, la distance dans l'air et la ligne de fuite sur l'assemblage complet.",
      "Dans « Paires de nets », une paire sort non conforme : l'écart entre les deux zones haute tension de la carte de puissance est volontairement trop court. Cliquez-la : son chemin se trace dans la vue.",
      "« Rôle des corps » : chaque corps est le conducteur d'un potentiel, ou un isolant."],
    look: "Les valeurs requises viennent de tables saisies, « à vérifier » contre votre copie de la norme : l'Aide le dit.",
    ask: "Le résultat correspond-il à ce que vous mesureriez à la main ?",
    checks: [{ go: "#/creepage", words: ["Analyser", "Paires de nets", "Rôle des corps"] }] },
  { id: "carte", minutes: 7, title: "La carte électronique et son Labo", screen: "Électronique › 2 PCBA, puis 3 Labo", goal: "Voir une carte conçue par ses fonctions, puis l'essayer sur un banc simulé.",
    steps: ["Ouvrez le PCBA : en haut, le parcours de la carte ; dessous, les vues classiques — « Schéma », « Carte et couches », « Nomenclature ».",
      "Cliquez « Labo », dans l'en-tête de la carte.",
      "Un essai joue : les pistes et les composants du régulateur s'allument, deux oscilloscopes montrent ce qui commute et ce qui sort. La barre d'espace arrête et relance.",
      "À gauche, choisissez « Témoin lumineux », puis l'essai « Clignotement » : la DEL s'allume et s'éteint sur la carte.",
      "À droite, onglet « Fiche » : pourquoi cet essai, à quoi s'attendre, le montage, les étapes. Onglet « Relevés » : ce que l'on mesurera au vrai laboratoire se tape à côté de l'attendu.",
      "« Plan de test (.docx) » écrit le plan de test fonctionnel de toute la carte."],
    look: "Les circuits intégrés sont simulés par leur comportement typique, dit comme tel sur chaque fiche.",
    ask: "La fiche d'essai est-elle celle que vous donneriez à un stagiaire ? Et si l'électronique n'est pas votre métier : avez-vous compris ce que fait la carte ?",
    checks: [{ go: "#/pcba", words: ["Schéma", "Carte et couches", "Nomenclature", "Labo"] }, { go: "#/elab", words: ["Témoin lumineux", "Fiche", "Relevés", "Plan de test (.docx)"] }, { click: "Témoin lumineux", words: ["Clignotement"] }] },
  { id: "dessins", minutes: 4, title: "Le dessin", screen: "Mécanique › 4 Dessins", goal: "Lire le dessin que l'outil a tracé, et l'enregistrer.",
    steps: ["Ouvrez les Dessins, puis la Base du boîtier.",
      "Le dessin est déjà tracé : vues, cotes à bulles, tolérances tirées des interfaces, cartouche. Ctrl + molette zoome la feuille ; « Agrandir » aussi.",
      "À droite : « Cotes », « Cartouche », et les références de tolérancement. « PDF » enregistre le dessin."],
    look: "Tout ce que l'outil écrit sur un dessin est en anglais, comme le métier le fait.",
    ask: "Le dessin est-il un bon point de départ ? Qu'y changeriez-vous d'abord ?",
    checks: [{ go: "#/drawings/DRV-BASE", words: ["Agrandir", "Cotes", "Cartouche", "PDF"] }] },
  { id: "revue", minutes: 4, title: "La revue et son dossier", screen: "Produit › 1 DFx, 2 Revue, 3 Rapport", goal: "Voir ce qu'une revue de conception trouve prêt.",
    steps: ["DFx : « Points à régler » réunit ce que les règles ont trouvé dans tout le projet ; un clic mène à l'endroit.",
      "Revue : chaque pièce, assemblage et carte se marque « Revu » ou « À réviser », avec une note.",
      "Rapport : le dossier de revue de conception — « PDF » ou « Word »."],
    look: "Le rapport dit, pour chaque carte, où en est son plan de test.",
    ask: "Présenteriez-vous ce dossier en revue de conception ? Que lui manque-t-il ?",
    checks: [{ go: "#/dfx", words: ["Points à régler"] }, { go: "#/review", words: ["Revu", "À réviser"] }, { go: "#/report", words: ["PDF", "Word"] }] },
  { id: "ia", minutes: 3, title: "Confier une tâche à une IA", screen: "Le bouton à étincelle de la barre du haut", goal: "Voir comment une tâche part vers un assistant, et revient.",
    steps: ["Sur l'écran d'une pièce, cliquez le bouton à étincelle de la barre du haut — « Confier à l'IA » : la pièce s'exporte avec une demande, formulée comme à un technicien.",
      "Avec un assistant sous la main : collez la demande, puis collez sa réponse dans l'outil. Chaque changement est listé ; vous acceptez ou non — en une seule étape, annulable.",
      "Sans assistant : lisez seulement la demande. Cette station est facultative."],
    look: "Rien ne s'applique sans que vous ayez vu la liste des changements.",
    ask: "Confieriez-vous une tâche de cette façon ? Laquelle en premier ?",
    checks: [{ go: "#/parts/DRV-BASE", words: ["Confier à l'IA"] }] },
];

/* ---------- the feedback sheet ---------- */
export const SCALE = ["1", "2", "3", "4", "5"], SCALE_ENDS = ["pas du tout", "tout à fait"];
export const STATEMENTS = [
  "J'ai su quoi faire sur chaque écran, sans aide.",
  "L'outil montre clairement ce qu'il a supposé et ce que j'ai décidé.",
  "La pièce née de l'intention est une pièce que je pourrais faire fabriquer.",
  "Les vérifications — fabrication, isolation, calcul — sont celles que je ferais.",
  "Les documents produits — dessin, gamme, plan de test, dossier de revue — sont un bon point de départ.",
  "Je referais un essai sur l'un de mes propres produits.",
];
export const OPEN = ["Trois choses qui m'ont plu.", "Trois endroits où j'ai hésité ou été arrêté.", "Ce qui m'a manqué en premier, par rapport à mes outils habituels.", "Ce que je n'ai pas cru, ou que j'aurais voulu vérifier moi-même.", "Un mot pour décrire l'outil à un collègue."];
export const PROFILE = ["Métier (mécanique, électronique, fabrication, autre)", "Années de pratique", "Outils de conception habituels", "Date de l'essai", "Outil ouvert en ligne ou sur mon poste ; navigateur"];
export const SEND = [`Un ticket « Retour d'essai » : ${LINKS.issue} — ou la fiche remise à la personne qui vous a invité.`, "Joignez si vous le pouvez une image de l'écran où vous avez hésité (bouton à appareil photo de la vue).", "N'envoyez rien de confidentiel."];

/* ---------- what is made of it ---------- */
const total = () => STATIONS.reduce((s, x) => s + x.minutes, 0);
/** Every label a step names « between quotation marks » — for the test that holds the path to the screen. */
export const quoted = (text) => [...String(text).matchAll(/« ([^»]+?) »/g)].map((m) => m[1]);
/** The words the robot looks for at a station. */
export const wordsOf = (s) => s.checks.flatMap((c) => c.words);
/** The clock of the path : [{ id, from, to }] in minutes. */
export function clock() { let t = 0; return STATIONS.map((s) => { const from = t; t += s.minutes; return { id: s.id, from, to: t }; }); }

/** The guide of the repository (docs/ESSAI_PILOTE.md), written from the stations. */
export function pilotMarkdown() {
  const c = clock(), L = [];
  L.push("# Essai pilote — une heure avec DesignWizard.ai", "", "> Ce fichier est écrit par `node tools/pilot_kit.mjs --docs` à partir de `tools/pilot/content.mjs` : changez le contenu là, pas ici.", `> Le robot \`tools/pilot_walk.mjs\` suit ce parcours sur l'outil et vérifie que chaque mot cité « entre guillemets » est bien à l'écran.`, "",
    PILOT.aim, "", PILOT.honest, "", "## Avant de commencer", "", ...BEFORE.map((x) => `- ${x}`), "", "## Le parcours", "", "| | Station | Où | Durée |", "|---|---|---|---|",
    ...STATIONS.map((s, i) => `| ${i} | ${s.title} | ${s.screen} | ${c[i].from} – ${c[i].to} min |`), "", `Total : ${total()} minutes.`, "");
  STATIONS.forEach((s, i) => { L.push(`### ${i}. ${s.title} — ${s.minutes} min`, "", `*${s.screen}.* ${s.goal}`, "", ...s.steps.map((x, k) => `${k + 1}. ${x}`), "", `**À remarquer.** ${s.look}`, "", `**À noter sur la fiche.** ${s.ask}`, ""); });
  L.push("## La fiche de retour", "", "Pour chaque station : faite ou non, et où l'on a hésité. Puis six affirmations, de 1 (pas du tout) à 5 (tout à fait) :", "", ...STATEMENTS.map((x, i) => `${i + 1}. ${x}`), "", "Et cinq questions ouvertes :", "", ...OPEN.map((x) => `- ${x}`), "",
    "Les deux documents — le parcours et la fiche, en Word et en PDF — s'écrivent par `node tools/pilot_kit.mjs <dossier>`.", "", "## Envoyer son avis", "", ...SEND.map((x) => `- ${x}`), "", "## Pour la personne qui anime", "", ...HOST.map((x) => `- ${x}`), "",
    "## Ce qui est vérifié, ce qui ne l'est pas", "",
    "- **Vérifié** : le robot ouvre chaque écran du parcours sur la démonstration, dans Chromium, et y trouve chaque mot que les étapes citent (`node tools/pilot_walk.mjs <adresse> <dossier>`). Un test tient que chaque mot cité est de ceux que le robot cherche, et que les durées font une heure.",
    "- **Non vérifié** : le parcours n'a encore été suivi par personne d'autre que son auteur et son robot. Les durées sont une estimation : le premier essai les corrigera. Rien n'a été mesuré sur le temps gagné ou perdu avec l'outil, et ce parcours ne promet rien là-dessus.", "");
  return L.join("\n");
}
/** The path, as a document handed to a tester (core/docx.js, core/pdfdoc.js). */
export function pilotDoc() {
  const c = clock(), out = [];
  out.push({ type: "h1", text: "Avant de commencer" }, { type: "p", text: PILOT.aim }, { type: "p", text: PILOT.honest, style: "muted" }, { type: "list", items: BEFORE },
    { type: "h1", text: "Le parcours, en une page" }, { type: "table", head: ["", "Station", "Où", "Minutes"], widths: [6, 44, 36, 14], rows: STATIONS.map((s, i) => [String(i), s.title, s.screen, `${c[i].from} – ${c[i].to}`]) });
  STATIONS.forEach((s, i) => { out.push({ type: i % 2 ? "h2" : "h2", text: `${i}. ${s.title} — ${s.minutes} min` }, { type: "kv", rows: [["Où", s.screen], ["But", s.goal]] }, { type: "checklist", items: s.steps.map((text) => ({ text, state: "todo" })) }, { type: "p", text: `À remarquer. ${s.look}` }, { type: "p", text: `À noter sur la fiche. ${s.ask}`, style: "muted" }); });
  out.push({ type: "h1", text: "Après l'heure" }, { type: "list", items: ["Remplissez la fiche de retour avant d'en parler avec quelqu'un.", ...SEND] });
  return out;
}
/** The feedback sheet. */
export function feedbackDoc() {
  const out = [];
  out.push({ type: "p", text: "Une fiche par personne. Il n'y a pas de bonne réponse : un endroit où vous avez hésité est exactement ce que l'on cherche." },
    { type: "h1", text: "Qui essaie" }, { type: "table", head: null, widths: [45, 55], rows: PROFILE.map((x) => [x, ""]), rowHeight: 9 },
    { type: "h1", text: "Station par station" }, { type: "table", head: ["", "Station", "Faite", "Où j'ai hésité, ce que j'ai cherché"], widths: [5, 30, 11, 54], rows: STATIONS.map((s, i) => [String(i), `${s.title} (${s.minutes} min)`, "oui / non", ""]), rowHeight: 13 },
    { type: "h1", text: "Mon avis, de 1 à 5" }, { type: "p", text: `Entourez un chiffre : 1, ${SCALE_ENDS[0]} — 5, ${SCALE_ENDS[1]}.`, style: "muted" }, { type: "table", head: ["", ...SCALE], widths: [70, 6, 6, 6, 6, 6], rows: STATEMENTS.map((x) => [x, ...SCALE]) },
    { type: "h1", text: "En quelques mots" });
  for (const q of OPEN) out.push({ type: "table", head: [q], widths: [100], rows: [[""]], rowHeight: 24 });
  out.push({ type: "h1", text: "Envoyer la fiche" }, { type: "list", items: SEND });
  return out;
}
/** Everything the kit says, as one text — for the rules that hold on all of it. */
export const pilotTexts = () => [PILOT.aim, PILOT.honest, ...BEFORE, ...HOST, ...STATIONS.flatMap((s) => [s.title, s.goal, ...s.steps, s.look, s.ask]), ...STATEMENTS, ...OPEN, ...SEND].join("\n");
