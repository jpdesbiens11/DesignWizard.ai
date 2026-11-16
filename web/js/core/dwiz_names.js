/* DesignWizard.ai — the vocabulary of the .dwiz format: one notation for every object of a mechatronic product.
   The notation itself (core/dwiz.js) is generic; this file only gives each KIND of document its reading order and
   the words that turn lists into sentences ("interface IF1 bolt_pattern …", "do drill …", "place i2 DRV-PCB").
   A new module extends the format here — a new kind, or new words in an existing kind — and nowhere else. Unknown
   keys are always kept (written as plain « key value » lines), so older and newer files read each other.

   node = { head: [keys written without their name, in this order] ,  first: [names written first, for the reading order] ,
            word: the line word of each item of a list ,  keyed: true for a map of named items ,
            scalar: true for a list of plain values ,  kids: { key: node } for what is written on indented lines } */

export const DWIZ_VERSION = 1;
export const DWIZ_EXT = "dwiz";

/* The annotated routing sheet of a part, an assembly or a board : what was said about each phase, what is left to see. */
const PLAN = { kids: { notes: {}, points: { word: "point", scalar: true } } };
const part = {
  fr: "Pièce", en: "Part", module: "Atelier (Shop)", brick: "B3",
  sections: [
    ["Pourquoi — l'intention de conception", ["function", "intent", "order"]],
    ["À quoi elle se raccorde — ses interfaces, le contrat avec les pièces voisines", ["interfaces"]],
    ["De quoi elle est faite — matière, procédé, matière première, moulage", ["material", "process", "family", "finish", "elec", "stock", "mold", "print"]],
    ["Sa tôle — la base et ses bords pliés", ["folded"]],
    ["Ses poignées — les paramètres que l'on règle", ["params"]],
    ["Comment elle se fait — les opérations, dans l'ordre de l'atelier", ["extrusion", "pcb", "features", "bodies"]],
    ["Ce qu'il faut savoir — notes du dessin, révision, hypothèses", ["notes", "revision", "interview"]],
    ["De quoi elle a l'air à l'écran — sa couleur, pour la reconnaître (ce n'est pas une finition)", ["look"]],
    ["Ce qui se dit avec le fournisseur — la gamme annotée : une note par phase, les points à voir", ["plan"]],
  ],
  kids: {
    intent: {}, order: {}, elec: {}, mold: {}, print: {}, look: {}, characteristics: {}, library: {}, busbar: {}, laminate: {}, thermal: {}, fill: {}, flex: {},
    interfaces: { word: "interface", head: ["id", "type"], first: ["side", "face", "at", "level", "rot", "key", "partner", "name"], kids: { params: {}, opts: {} } },
    stock: { head: ["form"] },
    folded: { kids: { flanges: { word: "flange", head: ["side"] } } },
    params: { word: "param", keyed: true, head: ["value"] },
    features: { word: "do", head: ["op"], first: ["id", "face", "at"] },
    extrusion: { kids: { inside: { word: "inside" }, outside: { word: "outside" } } },
    pcb: { kids: { components: { word: "component", head: ["ref"] }, zones: { word: "zone" }, nets: { word: "net", keyed: true } } },
    bodies: { word: "body", keyed: true },
    notes: { word: "note", scalar: true },
    interview: { kids: { assumptions: { word: "assume", scalar: true }, questions: { word: "asked" } } },
    plan: PLAN,
  },
};
const assembly = {
  fr: "Assemblage", en: "Assembly", module: "Assemblage", brick: "B6",
  sections: [
    ["Ce qu'il contient — une ligne par pièce posée", ["instances"]],
    ["Ce qui les tient ensemble — les interfaces accouplées", ["mates"]],
    ["Ce que l'on vérifie — isolation électrique", ["isolation"]],
    ["Comment il se monte — la gamme d'assemblage annotée : l'ordre, une note par étape, les points à voir", ["plan"]],
  ],
  kids: {
    instances: { word: "place", head: ["id", "part"] },
    mates: { word: "mate", head: ["id"] },
    isolation: { kids: { nets: { word: "net", head: ["name"] }, params: {} } },
    plan: PLAN,
  },
};
const project = {
  fr: "Projet", en: "Project", module: "Accueil", brick: "B9",
  sections: [
    ["Le produit", ["description", "author", "drawing"]],
    ["La physique vérifiée — modèles analytiques et simulations gardés pour la revue", ["physics", "simulations"]],
    ["La revue de conception — ce que l'IA a retenu de l'entrevue, l'état de chaque artéfact, les itérations MVP et leurs revues", ["brief", "review", "mvp"]],
    ["L'équipe — les miroirs de chaque membre, ce qui a été fusionné, les messages", ["team", "talk"]],
    ["Les révisions libérées — numéros, contenus figés, ce avec quoi chaque assemblage a été libéré", ["plm"]],
    ["Journal", ["log"]],
  ],
  kids: { brief: { kids: { answers: { word: "answer" } } }, review: { kids: { items: {} } }, mvp: { kids: { iterations: { word: "iteration", head: ["n", "name"] } } }, team: {}, talk: { word: "message", head: ["id", "by"] }, plm: {}, drawing: {}, physics: { word: "physics", head: ["id", "model"] }, simulations: { word: "simulation", head: ["id", "kind"], first: ["target"], kids: { estimate: {}, result: {} } }, log: { word: "log" } },
  embed: { parts: "part", assemblies: "assembly", boards: "board" },   // documents carried inside a project file, one after the other
};
const board = {
  fr: "Carte électronique", en: "Board", module: "PCBA", brick: "B10",
  sections: [
    ["Pourquoi — les fonctions que la carte remplit", ["description", "revision", "functions"]],
    ["Comment — un bloc de circuit par fonction", ["blocks"]],
    ["Avec quoi — les composants, et les nets qui les relient", ["parts", "nets", "library"]],
    ["Sur quoi — la carte nue : couches, finition, vernis, trous, règles", ["board", "rules", "part"]],
    ["Le cuivre — plans, pistes et vias", ["planes", "tracks", "vias"]],
    ["Comment elle s'assemble — la gamme annotée et la revue", ["plan", "review"]],
  ],
  kids: {
    functions: { word: "function", head: ["id"], first: ["parent", "kind", "name", "block"], kids: { criteria: { word: "criterion" } } },
    blocks: { word: "block", head: ["id", "template"], first: ["name", "function", "zone"], kids: { params: {} } },
    parts: { word: "part", head: ["ref", "comp"], first: ["value", "block", "at", "rot", "side"] },
    nets: { word: "net", head: ["name"], first: ["class", "voltage", "current", "pins"] },
    library: { word: "component", keyed: true, first: ["kind", "prefix", "name", "package"], kids: { pins: { word: "pin", head: ["n", "name"] }, pads: { word: "pad", head: ["n"] }, ratings: {} } },
    board: { kids: { coating: {}, holes: { word: "hole" } } },
    rules: { kids: { classes: { word: "class", keyed: true } } },
    planes: { word: "plane", head: ["net", "layer"] },
    tracks: { word: "track", head: ["net", "layer"], first: ["w", "pts"] },
    vias: { word: "via", head: ["net"], first: ["at", "d", "drill"] },
    plan: PLAN,
  },
};

/** Kinds of document the platform reads and writes today. */
export const KINDS = { part, assembly, project, board };

/** Names reserved for the modules to come, so every part of a mechatronic product ends up in the same format. */
export const RESERVED_KINDS = [
  { kind: "order", fr: "Commande", text: "Lot de pièces à faire fabriquer : quantités, date voulue, atelier, prix et délai reçus." },
  { kind: "test", fr: "Essai", text: "Plan d'essai de laboratoire : ce que l'on mesure, la valeur prévue par la physique, la valeur mesurée." },
  { kind: "schematic", fr: "Schéma", text: "Schéma électrique dessiné à la main, feuille par feuille — au-delà du schéma par blocs d'une carte." },
  { kind: "harness", fr: "Faisceau", text: "Câbles, connecteurs, longueurs et cheminement entre les interfaces électriques." },
  { kind: "firmware", fr: "Micrologiciel", text: "Brochage, périphériques et paramètres du CPU liés aux interfaces de la carte." },
  { kind: "requirement", fr: "Exigence", text: "Ce que le produit doit faire, relié aux pièces, aux analyses et aux essais qui le prouvent." },
  { kind: "review", fr: "Revue", text: "Décision de revue de conception : verdicts, réserves, signatures." },
];

/** Kind of a document from its « dw » field, or from its content when the field is missing. */
export function kindOfDoc(doc) {
  const k = String((doc && doc.dw) || "").split("/")[0];
  if (KINDS[k]) return k;
  if (doc && Array.isArray(doc.parts) && Array.isArray(doc.assemblies)) return "project";
  if (doc && Array.isArray(doc.instances)) return "assembly";
  if (doc && doc.board && Array.isArray(doc.nets)) return "board";
  return k || "part";
}
/** File name of a document: <id>.<kind>.dwiz */
export const dwizFileName = (doc) => `${String(doc.id || doc.name || "sans-nom").replace(/[\\/:*?"<>|\s]+/g, "_")}.${kindOfDoc(doc)}.${DWIZ_EXT}`;
