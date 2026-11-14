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

const part = {
  fr: "Pièce", en: "Part", module: "Atelier (Shop)", brick: "B3",
  sections: [
    ["Pourquoi — l'intention de conception", ["function", "intent", "order"]],
    ["À quoi elle se raccorde — ses interfaces, le contrat avec les pièces voisines", ["interfaces"]],
    ["De quoi elle est faite — matière, procédé, matière première", ["material", "process", "family", "finish", "elec", "stock"]],
    ["Ses poignées — les paramètres que l'on règle", ["params"]],
    ["Comment elle se fait — les opérations, dans l'ordre de l'atelier", ["extrusion", "pcb", "features", "bodies"]],
    ["Ce qu'il faut savoir — notes du dessin, révision, hypothèses", ["notes", "revision", "interview"]],
  ],
  kids: {
    intent: {}, order: {}, elec: {},
    interfaces: { word: "interface", head: ["id", "type"], first: ["side", "face", "at", "level", "rot", "key", "partner", "name"], kids: { params: {}, opts: {} } },
    stock: { head: ["form"] },
    params: { word: "param", keyed: true, head: ["value"] },
    features: { word: "do", head: ["op"], first: ["id", "face", "at"] },
    extrusion: { kids: { inside: { word: "inside" }, outside: { word: "outside" } } },
    pcb: { kids: { components: { word: "component", head: ["ref"] }, zones: { word: "zone" }, nets: { word: "net", keyed: true } } },
    bodies: { word: "body", keyed: true },
    notes: { word: "note", scalar: true },
    interview: { kids: { assumptions: { word: "assume", scalar: true }, questions: { word: "asked" } } },
  },
};
const assembly = {
  fr: "Assemblage", en: "Assembly", module: "Assemblage", brick: "B6",
  sections: [
    ["Ce qu'il contient — une ligne par pièce posée", ["instances"]],
    ["Ce qui les tient ensemble — les interfaces accouplées", ["mates"]],
    ["Ce que l'on vérifie — isolation électrique", ["isolation"]],
  ],
  kids: {
    instances: { word: "place", head: ["id", "part"] },
    mates: { word: "mate", head: ["id"] },
    isolation: { kids: { nets: { word: "net", head: ["name"] }, params: {} } },
  },
};
const project = {
  fr: "Projet", en: "Project", module: "Accueil", brick: "B9",
  sections: [
    ["Le produit", ["description", "author", "drawing"]],
    ["La physique vérifiée — modèles analytiques gardés pour la revue", ["physics"]],
    ["Journal", ["log"]],
  ],
  kids: { drawing: {}, physics: { word: "physics", head: ["id", "model"] }, log: { word: "log" } },
  embed: { parts: "part", assemblies: "assembly" },            // documents carried inside a project file, one after the other
};

/** Kinds of document the platform reads and writes today. */
export const KINDS = { part, assembly, project };

/** Names reserved for the modules to come, so every part of a mechatronic product ends up in the same format. */
export const RESERVED_KINDS = [
  { kind: "order", fr: "Commande", text: "Lot de pièces à faire fabriquer : quantités, date voulue, atelier, prix et délai reçus." },
  { kind: "test", fr: "Essai", text: "Plan d'essai de laboratoire : ce que l'on mesure, la valeur prévue par la physique, la valeur mesurée." },
  { kind: "board", fr: "Carte", text: "Carte électronique complète : schéma, empilage, placement — au-delà du bloc « pcb » d'une pièce." },
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
  return k || "part";
}
/** File name of a document: <id>.<kind>.dwiz */
export const dwizFileName = (doc) => `${String(doc.id || doc.name || "sans-nom").replace(/[\\/:*?"<>|\s]+/g, "_")}.${kindOfDoc(doc)}.${DWIZ_EXT}`;
