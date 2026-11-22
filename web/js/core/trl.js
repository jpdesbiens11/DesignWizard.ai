/* DesignOrbit.ai — TRL : the technology readiness scale as its publishers wrote it, so that a level means the same thing
   to everyone in the room. For each level : the definition of the NASA table and of the European Commission, quoted in
   English as read (the English is the official text ; the French beside it is a translation of the platform), what the
   NASA table says of the hardware and of the proof to show, a summary of the UK automotive guide, and two examples —
   one automotive, one aerospace — written by the platform as illustrations (the same technology followed from 1 to 9).
   Pure : the screen, the review package and the tests read the same table. See docs/ITERATIONS.md. */

/** What was read, and what was not. read : the text was opened and read whole in a working session of the platform. */
export const TRL_SOURCES = [
  { id: "nasa", org: "NASA", title: "Technology Readiness Level Definitions", detail: "tableau des neuf niveaux : définition, description du matériel, description du logiciel, critères de sortie", url: "https://www.nasa.gov/wp-content/uploads/2017/12/458490main_trl_definitions.pdf", read: true, how: "PDF lu en entier le 2026-11-16", use: "définitions « NASA », matériel et preuve de sortie de chaque niveau" },
  { id: "ec", org: "Commission européenne", title: "Horizon 2020 — Work Programme 2014-2015, General Annexes, G. Technology readiness levels (TRL)", detail: "extrait de la partie 19, décision C(2014)4995 ; l'édition 2016-2017 porte le même texte", url: "https://ec.europa.eu/research/participants/data/ref/h2020/wp/2014_2015/annexes/h2020-wp1415-annex-g-trl_en.pdf", read: true, how: "les deux éditions lues en entier le 2026-11-16", use: "définitions « Commission européenne »" },
  { id: "auto", org: "Low Carbon Vehicle Partnership, avec l'Automotive Council (Royaume-Uni)", title: "Automotive Technology and Manufacturing Readiness Levels — A guide to recognised stages of development within the Automotive Industry", detail: "janvier 2011 ; dix niveaux de maturité technologique, chacun avec son niveau de maturité de fabrication (MRL) habituel", url: "https://www.apcuk.co.uk/wp-content/uploads/2021/09/Automotive-Technology-and-Manufacturing-Readiness-Levels.pdf", read: true, how: "PDF lu en entier le 2026-11-16", use: "résumé « guide automobile » et MRL habituel de chaque niveau" },
  { id: "nasa-web", org: "NASA", title: "Technology Readiness Levels", detail: "page de présentation, un paragraphe par niveau (2023)", url: "https://www.nasa.gov/directorates/somd/space-communications-navigation-program/technology-readiness-levels/", read: true, how: "page lue le 2026-11-16", use: "lecture de contrôle ; aucun texte repris" },
  { id: "iso", org: "ISO", title: "ISO 16290:2013 — Space systems — Definition of the Technology Readiness Levels (TRLs) and their criteria of assessment", detail: "la norme internationale de l'échelle, avec sa version française", url: "", read: false, how: "non lue (norme payante)", use: "à consulter quand un contrat la cite : elle fait alors foi" },
  { id: "mankins", org: "NASA", title: "Mankins, J. C. — Technology Readiness Levels: A White Paper", detail: "1995 ; le texte d'origine de l'échelle à neuf niveaux", url: "", read: false, how: "non lu", use: "pour l'histoire de l'échelle" },
  { id: "npr", org: "NASA", title: "NPR 7123.1 — NASA Systems Engineering Processes and Requirements", detail: "l'annexe qui définit les niveaux pour les programmes de la NASA", url: "", read: false, how: "non lue", use: "à consulter pour un programme de la NASA" },
  { id: "gao", org: "U.S. Government Accountability Office", title: "Technology Readiness Assessment Guide (GAO-20-48G)", detail: "2020 ; comment conduire l'évaluation d'un niveau", url: "", read: false, how: "non lu", use: "pour la méthode d'évaluation" },
];

/** Three steps of the ladder — a grouping of the platform, to read the scale at a glance (not part of the definitions). */
export const TRL_GROUPS = [
  { id: "prove", levels: [1, 2, 3], label: "Comprendre et prouver", hint: "du principe à la preuve de concept", color: "#3d86e6" },
  { id: "validate", levels: [4, 5, 6], label: "Valider et démontrer", hint: "du laboratoire à l'environnement représentatif", color: "#ee8a32" },
  { id: "operate", levels: [7, 8, 9], label: "Qualifier et exploiter", hint: "de l'environnement opérationnel au service", color: "#46b97c" },
];
/** The technology the two examples follow from level 1 to level 9. */
export const TRL_EXAMPLES = { auto: { label: "Automobile", subject: "un onduleur de traction à transistors au carbure de silicium (SiC)" }, aero: { label: "Aéronautique", subject: "un actionneur électromécanique de gouverne, à la place d'un vérin hydraulique" } };

const L = (n, short, word, o) => ({ n, short, word, ...o });
export const TRL_LEVELS = {
  1: L(1, "Principes de base observés et rapportés", "Principe", { nasa: "Basic principles observed and reported.", fr: "Principes de base observés et rapportés.", ec: "basic principles observed", ecFr: "principes de base observés",
    hw: "Scientific knowledge generated underpinning hardware technology concepts/applications.", hwFr: "Des connaissances scientifiques sont produites, sur lesquelles reposent les concepts et les applications de la technologie.",
    exit: "Peer reviewed publication of research underlying the proposed concept/application.", exitFr: "Publication, revue par des pairs, de la recherche qui fonde le concept ou l'application proposés.",
    unit: "Connaissance scientifique", env: "Publication", guide: "Principes de base observés et rapportés ; études sur papier et expériences scientifiques ; une performance est prédite.",
    auto: "Des travaux publiés montrent qu'un transistor au carbure de silicium commute avec moins de pertes qu'un transistor au silicium. Personne n'a encore dit où s'en servir dans un véhicule.",
    aero: "Des travaux publiés montrent qu'une vis à rouleaux entraînée par un moteur sans balais peut fournir l'effort d'un vérin hydraulique. Rien n'est encore appliqué à une gouverne.",
    not: "Un principe observé n'est pas encore une idée d'application : elle vient au TRL 2." }),
  2: L(2, "Concept ou application de la technologie formulé", "Concept", { nasa: "Technology concept and/or application formulated.", fr: "Concept ou application de la technologie formulé.", ec: "technology concept formulated", ecFr: "concept technologique formulé",
    hw: "Invention begins, practical application is identified but is speculative, no experimental proof or detailed analysis is available to support the conjecture.", hwFr: "L'invention commence : une application pratique est identifiée, mais elle reste spéculative — ni preuve expérimentale ni analyse détaillée ne soutient encore l'hypothèse.",
    exit: "Documented description of the application/concept that addresses feasibility and benefit.", exitFr: "Description écrite de l'application ou du concept, qui traite de sa faisabilité et de son bénéfice.",
    unit: "Concept sur papier", env: "Papier", guide: "Des applications possibles sont identifiées, encore spéculatives ; simulations ou expériences propres à l'application ; les prédictions de performance sont affinées.",
    auto: "L'équipe formule le concept d'un onduleur de traction 800 V à transistors SiC et estime sur papier le gain d'autonomie et de masse. Aucun essai ne le soutient encore.",
    aero: "L'équipe formule le concept d'un actionneur électromécanique pour un aileron ; la masse, la puissance et le risque de grippage sont estimés sur papier.",
    not: "Un concept formulé n'est soutenu par aucun essai : la première preuve vient au TRL 3." }),
  3: L(3, "Preuve de concept, analytique et expérimentale", "Preuve", { nasa: "Analytical and experimental critical function and/or characteristic proof of concept.", fr: "Preuve de concept, analytique et expérimentale, de la fonction ou de la caractéristique critique.", ec: "experimental proof of concept", ecFr: "preuve de concept expérimentale",
    hw: "Analytical studies place the technology in an appropriate context and laboratory demonstrations, modeling and simulation validate analytical prediction.", hwFr: "Des études analytiques situent la technologie dans son contexte ; des démonstrations en laboratoire, la modélisation et la simulation valident la prédiction analytique.",
    exit: "Documented analytical/experimental results validating predictions of key parameters.", exitFr: "Résultats analytiques et expérimentaux consignés, qui valident les prédictions des paramètres clés.",
    unit: "Éléments séparés, non intégrés", env: "Calcul et laboratoire", mrl: 1, guide: "L'analyse et l'essai ont identifié les fonctions et les caractéristiques critiques ; des éléments séparés, pas encore intégrés ni représentatifs, valident physiquement les prédictions.",
    auto: "Un bras de pont SiC commute sur une table d'essai ; les pertes mesurées confirment le calcul. Le refroidissement et la commande sont étudiés à part : rien n'est encore assemblé.",
    aero: "Le moteur et la vis, essayés séparément au banc, fournissent l'effort et la vitesse calculés ; le modèle thermique est recalé sur l'essai.",
    not: "Une preuve sur des éléments séparés n'est pas une maquette qui fonctionne d'un bloc : c'est le TRL 4." }),
  4: L(4, "Composant ou maquette validé en laboratoire", "Laboratoire", { nasa: "Component and/or breadboard validation in laboratory environment.", fr: "Validation du composant ou de la maquette (breadboard) en laboratoire.", ec: "technology validated in lab", ecFr: "technologie validée en laboratoire",
    hw: "A low fidelity system/component breadboard is built and operated to demonstrate basic functionality and critical test environments, and associated performance predictions are defined relative to the final operating environment.", hwFr: "Une maquette de basse fidélité du système ou du composant est construite et mise en marche pour montrer la fonction de base ; les environnements d'essai critiques et les performances attendues sont définis par rapport à l'environnement final d'emploi.",
    exit: "Documented test performance demonstrating agreement with analytical predictions. Documented definition of relevant environment.", exitFr: "Performances d'essai consignées, en accord avec les prédictions analytiques. Définition écrite de l'environnement représentatif.",
    unit: "Maquette de basse fidélité (breadboard)", env: "Laboratoire", mrl: 2, guide: "Le composant ou le sous-système de base est validé en laboratoire ou en centre d'essais ; les exigences et les interactions avec les systèmes du véhicule sont établies.",
    auto: "Un onduleur de laboratoire — cartes et modules câblés sur table, refroidis par un circuit d'atelier — entraîne un moteur sur banc. L'environnement que la pièce devra tenir dans le véhicule est écrit.",
    aero: "Une maquette de l'actionneur — moteur, vis et électronique de laboratoire — déplace une charge au banc. L'environnement de vol à tenir (température, altitude, vibrations) est écrit.",
    not: "Validé en laboratoire : pas encore dans un environnement représentatif de l'emploi (TRL 5)." }),
  5: L(5, "Composant ou maquette validé en environnement représentatif", "Représentatif", { nasa: "Component and/or breadboard validation in relevant environment.", fr: "Validation du composant ou de la maquette en environnement représentatif.", ec: "technology validated in relevant environment (industrially relevant environment in the case of key enabling technologies)", ecFr: "technologie validée en environnement représentatif (environnement industriel représentatif pour les technologies clés génériques)",
    hw: "A medium fidelity system/component brassboard is built and operated to demonstrate overall performance in a simulated operational environment with realistic support elements that demonstrates overall performance in critical areas. Performance predictions are made for subsequent development phases.", hwFr: "Une maquette de fidélité moyenne (brassboard) est construite et mise en marche pour montrer la performance d'ensemble dans un environnement opérationnel simulé, avec des éléments de soutien réalistes. Les performances des phases suivantes sont prédites.",
    exit: "Documented test performance demonstrating agreement with analytical predictions. Documented definition of scaling requirements.", exitFr: "Performances d'essai consignées, en accord avec les prédictions analytiques. Définition écrite des exigences de mise à l'échelle.",
    unit: "Maquette de fidélité moyenne (brassboard)", env: "Opérationnel simulé", mrl: 3, guide: "Le composant ou le sous-système est validé en environnement représentatif, au besoin sur un véhicule mulet ou un véhicule de série adapté ; les règles de conception sont établies ; les résultats permettent de le proposer à un nouveau programme de véhicule.",
    auto: "L'onduleur, dans un boîtier représentatif avec son vrai refroidissement, tient les cycles de température et les vibrations au banc, puis roule dans un véhicule mulet.",
    aero: "L'actionneur, en version représentative, tient son effort en chambre climatique, en altitude simulée et sous vibrations, avec une alimentation et une commande réalistes.",
    not: "Un composant ou une maquette en conditions représentatives n'est pas encore un prototype du système complet (TRL 6)." }),
  6: L(6, "Prototype du système démontré en environnement représentatif", "Prototype", { nasa: "System/sub-system model or prototype demonstration in an operational environment.", fr: "Démonstration d'un modèle ou d'un prototype du système ou du sous-système dans un environnement opérationnel.", ec: "technology demonstrated in relevant environment (industrially relevant environment in the case of key enabling technologies)", ecFr: "technologie démontrée en environnement représentatif (environnement industriel représentatif pour les technologies clés génériques)",
    hw: "A high fidelity system/component prototype that adequately addresses all critical scaling issues is built and operated in a relevant environment to demonstrate operations under critical environmental conditions.", hwFr: "Un prototype de haute fidélité du système ou du composant, qui traite toutes les questions critiques de mise à l'échelle, est construit et mis en marche dans un environnement représentatif pour démontrer le fonctionnement dans les conditions d'environnement critiques.",
    exit: "Documented test performance demonstrating agreement with analytical predictions.", exitFr: "Performances d'essai consignées, en accord avec les prédictions analytiques.",
    unit: "Prototype de haute fidélité", env: "Représentatif, conditions critiques", mrl: 4, guide: "Un modèle ou un prototype du système est démontré comme partie d'un véhicule, en centre d'essais, sur piste ou dans un environnement opérationnel semblable ; la viabilité est validée pour une classe de véhicule.",
    auto: "Un prototype complet de l'onduleur, monté dans un véhicule prototype, démontre toutes ses spécifications sur piste d'essai, du froid extrême à la pleine charge.",
    aero: "Un prototype complet de l'actionneur, à l'échelle et aux interfaces de l'avion, démontre ses performances sur un banc d'intégration, avec la gouverne et ses charges.",
    caution: "Les sources ne disent pas la même chose ici. Le tableau de la NASA écrit « operational environment » dans sa colonne de définition, mais sa propre description du matériel dit « operated in a relevant environment » ; la Commission européenne dit « relevant environment ». La plateforme retient : TRL 6, environnement représentatif ; TRL 7, environnement opérationnel réel.",
    not: "Un prototype sur banc, en chambre ou sur piste n'est pas une démonstration sur la plateforme réelle, en conditions réelles (TRL 7)." }),
  7: L(7, "Prototype du système démontré en environnement opérationnel", "Démonstration", { nasa: "System prototype demonstration in an operational environment.", fr: "Démonstration d'un prototype du système dans un environnement opérationnel.", ec: "system prototype demonstration in operational environment", ecFr: "démonstration d'un prototype du système en environnement opérationnel",
    hw: "A high fidelity engineering unit that adequately addresses all critical scaling issues is built and operated in a relevant environment to demonstrate performance in the actual operational environment and platform (ground, airborne, or space).", hwFr: "Une unité d'ingénierie de haute fidélité, qui traite toutes les questions critiques de mise à l'échelle, est construite et mise en marche dans un environnement représentatif pour démontrer la performance dans l'environnement opérationnel réel et sur la plateforme réelle (sol, air ou espace).",
    exit: "Documented test performance demonstrating agreement with analytical predictions.", exitFr: "Performances d'essai consignées, en accord avec les prédictions analytiques.",
    unit: "Unité d'ingénierie de haute fidélité", env: "Opérationnel réel, plateforme réelle", mrl: 5, guide: "Plusieurs prototypes sont démontrés en environnement opérationnel, sur véhicule ; les essais aux limites sont faits ; la technologie peut entrer dans le développement d'une plateforme de véhicule.",
    auto: "Plusieurs prototypes de l'onduleur roulent sur route ouverte dans une flotte d'essai, été comme hiver ; les limites de performance sont établies.",
    aero: "Le prototype de l'actionneur vole sur un avion d'essai : la gouverne est commandée en vol réel, dans le domaine de vol visé.",
    not: "Un prototype démontré en conditions réelles n'est pas le produit final qualifié (TRL 8)." }),
  8: L(8, "Système réel achevé et qualifié par essais et démonstration", "Qualifié", { nasa: "Actual system completed and \"flight qualified\" through test and demonstration.", fr: "Système réel achevé et « qualifié pour le vol » par essais et démonstration.", ec: "system complete and qualified", ecFr: "système complet et qualifié",
    hw: "The final product in its final configuration is successfully demonstrated through test and analysis for its intended operational environment and platform (ground, airborne, or space).", hwFr: "Le produit final, dans sa configuration finale, est démontré avec succès, par essai et par analyse, pour l'environnement opérationnel et la plateforme auxquels il est destiné (sol, air ou espace).",
    exit: "Documented test performance verifying analytical predictions.", exitFr: "Performances d'essai consignées, qui vérifient les prédictions analytiques.",
    unit: "Produit final, configuration finale", env: "Qualification pour l'emploi visé", mrl: 6, guide: "Les essais et les démonstrations sont terminés à la satisfaction du client ; la technologie fonctionne dans sa forme finale et dans les conditions attendues.",
    auto: "L'onduleur, dans sa forme finale et sorti de l'outillage de série, a réussi sa validation de conception et de procédé, à la satisfaction du constructeur ; le véhicule est homologué avec lui.",
    aero: "L'actionneur de série a réussi ses essais de qualification — environnement, endurance, sécurité — et l'avion est certifié avec lui.",
    not: "Qualifié par essais : pas encore éprouvé par l'exploitation (TRL 9)." }),
  9: L(9, "Système réel éprouvé en opération", "En service", { nasa: "Actual system flight proven through successful mission operations.", fr: "Système réel éprouvé en vol par des opérations de mission réussies.", ec: "actual system proven in operational environment (competitive manufacturing in the case of key enabling technologies; or in space)", ecFr: "système réel éprouvé en environnement opérationnel (fabrication compétitive pour les technologies clés génériques ; ou dans l'espace)",
    hw: "The final product is successfully operated in an actual mission.", hwFr: "Le produit final est exploité avec succès dans une mission réelle.",
    exit: "Documented mission operational results.", exitFr: "Résultats d'exploitation de la mission consignés.",
    unit: "Produit final en service", env: "Mission réelle", mrl: 7, guide: "Le système est qualifié par l'expérience en exploitation, dans sa forme finale et en conditions réelles ; le véhicule ou le produit est lancé sur le marché.",
    auto: "L'onduleur est en service dans des véhicules vendus ; les kilomètres parcourus et le retour de garantie confirment la tenue en clientèle.",
    aero: "L'actionneur est en service en compagnie ; les heures de vol accumulées et le retour d'exploitation confirment la fiabilité annoncée.",
    not: "La NASA et la Commission européenne s'arrêtent à 9. Le guide automobile ajoute un TRL 10 : en service dans plusieurs applications, plateformes de véhicule et régions." }),
};

export const trlLevel = (n) => TRL_LEVELS[Number(n)] || null;
export const trlGroup = (n) => TRL_GROUPS.find((g) => g.levels.includes(Number(n))) || null;
/** The level a page opens on : the one under review, else the next one to reach, else the target of the project. */
export function trlFocus({ live = null, reached = 0, target = 6 } = {}) {
  const n = live || (reached < 9 ? reached + 1 : 9);
  return trlLevel(n) ? n : trlLevel(target) ? target : 1;
}
/** The definition of a level as plain lines, for a review package or a report : whoever reviews reads the official wording. */
export function trlText(n) {
  const t = trlLevel(n);
  if (!t) return [];
  return [`TRL ${t.n} — ${t.short}`, `Définition (NASA, texte officiel) : « ${t.nasa} »`, `Définition (Commission européenne, Horizon 2020, annexe G) : « ${t.ec} »`,
    `Ce que l'on essaie : ${t.unit} · où : ${t.env}`, `Preuve attendue pour dire le niveau atteint (NASA, traduit) : ${t.exitFr}`, ...(t.caution ? [`Attention : ${t.caution}`] : []), `À ne pas confondre : ${t.not}`];
}
/** What is wrong in the table itself ([] when it is whole) : the tests keep it honest. */
export function trlProblems() {
  const out = [], need = ["short", "word", "nasa", "fr", "ec", "ecFr", "hw", "hwFr", "exit", "exitFr", "unit", "env", "guide", "auto", "aero", "not"];
  for (let n = 1; n <= 9; n++) { const t = TRL_LEVELS[n]; if (!t) { out.push(`TRL ${n} : absent`); continue; }
    for (const k of need) if (typeof t[k] !== "string" || !t[k].trim()) out.push(`TRL ${n} : « ${k} » manque`);
    if (!trlGroup(n)) out.push(`TRL ${n} : sans groupe`); }
  if (Object.keys(TRL_LEVELS).length !== 9) out.push("L'échelle compte neuf niveaux");
  for (const s of TRL_SOURCES) { if (!s.title || !s.org || !s.how) out.push(`Source ${s.id} : incomplète`); if (s.read && !s.url) out.push(`Source ${s.id} : lue, sans adresse`); if (!s.read && !/^non lu/.test(s.how)) out.push(`Source ${s.id} : non lue, à dire`); }
  return out;
}
