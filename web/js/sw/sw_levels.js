/* DynamiteOrbit.ai — Logiciel : THREE LEVELS of understanding (demande de JP, 24 novembre 2026 : « pour un ingénieur mécanique, il y a vraiment
   beaucoup trop de texte et d'étapes… le premier niveau doit être très fonctionnel, avec des couleurs et des icônes qui parlent comme à un enfant
   de 6 ans qui apprend les blocs LEGO… trois niveaux de compréhension : novice, intermédiaire et expert… 7 étapes, c'est intense pour un
   débutant… fais des choix logiques pour la majeure partie du design en mode novice ; l'expert gratte ensuite en export / import avec une IA »).
   The software and its rules do not change with the level : only what is SHOWN, and how many choices the tool makes on its own.
     novice        3 steps — what it must do, the blocks, try it ; one sentence a step ; the blocks bare (name, keys, display) ; the tool
                   places and keys the blocks it is given ; sensors and actuators rather than raw pins
     intermediate  5 steps — + the code and the proof ; the tags of the board and the values on the blocks ; the domains of the library ;
                   the words of the trade folded under each step
     expert        the 7 steps of the V, everything, as before
   Pure : the choice itself is kept by the browser of each person (modules/sw_level_ui.js) — a level is a person's, not the project's. */

export const LEVELS = {
  novice: { key: "novice", n: 1, fr: "Novice", label: "Novice", color: "#16a34a", icon: "star", says: "3 étapes, des blocs à emboîter : l'outil fait les choix pour vous." },
  intermediate: { key: "intermediate", n: 2, fr: "Intermédiaire", label: "Intermediate", color: "#d97706", icon: "param", says: "5 étapes : les valeurs, la carte, le code et la preuve s'ajoutent." },
  expert: { key: "expert", n: 3, fr: "Expert", label: "Expert", color: "#dc2626", icon: "code", says: "Le cycle en V complet, chaque détail, l'aller-retour avec une IA." },
};
export const DEFAULT_LEVEL = "novice";
export const levelOf = (k) => LEVELS[k] || LEVELS[DEFAULT_LEVEL];

/** The steps a level shows, in order : keys of the V (sw/sw_steps.js VSTEPS), each with the words a beginner reads. */
const KID = {
  req: { kid: "Ce qu'il doit faire", says: "La liste de ce que le produit doit faire. Elle vient de DynamiteAgile ou d'une IA.", icon: "report", color: "#2563eb" },
  arch: { kid: "Le cerveau", says: "Le petit ordinateur de la carte, et à quel rythme il réfléchit.", icon: "chip", color: "#b45309" },
  design: { kid: "Les blocs", says: "Emboîtez les blocs : un capteur, une décision, un actionneur.", icon: "brick", color: "#7c3aed" },
  sim: { kid: "Essayer", says: "Tournez les boutons du banc et regardez les blocs réagir.", icon: "play", color: "#dc2626" },
  code: { kid: "Le code", says: "L'outil écrit le programme tout seul ; on peut le lire.", icon: "code", color: "#475569" },
  verify: { kid: "La preuve", says: "Chaque exigence a son essai : vert, c'est prouvé.", icon: "check", color: "#16a34a" },
  release: { kid: "Livrer", says: "Le paquet part vers la carte quand tout est vert.", icon: "download", color: "#0f766e" },
};
const STEPS_OF = { novice: ["req", "design", "sim"], intermediate: ["req", "design", "sim", "code", "verify"], expert: ["req", "arch", "design", "sim", "code", "verify", "release"] };
export const levelSteps = (level) => (STEPS_OF[level] || STEPS_OF[DEFAULT_LEVEL]).map((key, i) => ({ key, n: i + 1, ...KID[key] }));
export const kidOf = (key) => KID[key] || null;

/** What a level shows. */
const SHOW = {
  novice: { vband: false, words: false, blockTags: false, blockChips: false, rank: false, packs: false, planned: false, rawPins: false, sheetIO: false, sheetReq: false, guideList: false, reqLower: false, lanes: 6, autoPlace: true },
  intermediate: { vband: false, words: "fold", blockTags: true, blockChips: true, rank: false, packs: true, planned: true, rawPins: true, sheetIO: true, sheetReq: false, guideList: true, reqLower: false, lanes: 10, autoPlace: true },
  expert: { vband: true, words: true, blockTags: true, blockChips: true, rank: true, packs: true, planned: true, rawPins: true, sheetIO: true, sheetReq: true, guideList: true, reqLower: true, lanes: 14, autoPlace: false },
};
export const shows = (level, what) => (SHOW[level] || SHOW[DEFAULT_LEVEL])[what];
/** The blocks a novice is offered : sensors and actuators (they bring their pins), the common decisions, and the blocks of the domain the
    software already uses. kinds : the kinds of the design. → (library entry) → boolean */
export const NOVICE_KINDS = new Set(["limit", "debounce", "on_delay", "logic", "fault_latch", "pid", "ramp", "state_lamp"]);
export const noviceOffers = (kinds) => (x) => !x.planned && (x.device || NOVICE_KINDS.has(x.kind) || (x.pack !== "core" && x.pack !== "io" && kinds.has(x.kind)));
