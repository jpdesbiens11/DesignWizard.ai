/* DesignWizard.ai — the glossary : the technical terms of the platform, as the trade says them — in English — with their
   French equivalent. The screens show the English term (`label` in each vocabulary table) ; the French one (`fr`) lives
   here, for whoever learned the trade in French. Pure : it gathers the tables, and adds the words of the mold, which belong
   to no table. A new brick that brings terms brings them with both names. */

import { PROCESSES, MATERIALS } from "../cad/materials.js";
import { INTERFACE_TYPES, ADHESIVES } from "../cad/interfaces.js";
import { WELD_PROCESSES, PLATINGS, CONTACT_FORMS, CONTACT_BASES } from "../cad/interfaces_elec.js";
import { STOCK_FORMS } from "../cad/stock.js";
import { SHOP_VERBS } from "../cad/shop.js";
import { AM_PROCESSES, LASER_FAMILIES } from "../cad/special_processes.js";
import { GATES } from "./mold_plan.js";
import { ENDS } from "./flex_tree.js";
import { INSULATIONS } from "./busbar.js";
import { LABEL_KINDS } from "./labels.js";
import { FINISHES } from "./render_looks.js";
import { PATTERNS, SHEENS } from "./look_patterns.js";
import { MODEL_WORDS } from "../cad/connector_series.js";
import { RULE_TITLES } from "../analysis/dfx_titles.js";
import { MODELS } from "../analysis/physics/index.js";

export const TERM_GROUPS = [
  { id: "process", label: "Procédés", hint: "comment la pièce se fabrique", icon: "cast", color: "#ee8a32" },
  { id: "mold", label: "Mold : moulage et fonderie", hint: "le moule, ce qui y entre, ce qu'il laisse", icon: "cast", color: "#e5484d" },
  { id: "operation", label: "Opérations et formes", hint: "les verbes de l'atelier, les formes d'une pièce", icon: "mill", color: "#3d86e6" },
  { id: "stock", label: "Matière première", hint: "ce que l'on prend sur l'étagère", icon: "plate", color: "#8a7df0" },
  { id: "interface", label: "Interfaces et assemblage", hint: "ce qui tient, positionne et relie", icon: "interface", color: "#25ad9f" },
  { id: "electrical", label: "Électrique", hint: "revêtements, contacts, capteurs, isolants", icon: "chip", color: "#46b97c" },
  { id: "finish", label: "Finitions et marquage", hint: "l'aspect, les étiquettes", icon: "palette", color: "#b45309" },
  { id: "analysis", label: "Calculs analytiques", hint: "le nom de chaque modèle de calcul", icon: "ruler", color: "#2563eb" },
  { id: "rules", label: "Règles DFx, DFA et carte", hint: "ce que chaque règle vérifie", icon: "interface", color: "#64748b" },
];
/* the words of the mold : [English, French, what it is] */
const MOLD_TERMS = [
  ["Mold / die", "moule", "l'outillage qui donne sa forme à la pièce ; « die » pour le métal sous pression"], ["Cavity", "empreinte", "la moitié fixe du moule : elle forme l'extérieur de la pièce"], ["Core", "noyau", "la moitié mobile, ou une pièce rapportée : elle forme l'intérieur, un creux"],
  ["Core pin", "broche de noyau", "une tige du moule qui forme un trou"], ["Parting line", "plan de joint (ligne de joint)", "où les deux moitiés du moule se rencontrent ; il laisse une ligne sur la pièce"], ["Pull", "sens de démoulage", "la direction dans laquelle le moule s'ouvre et la pièce sort"],
  ["Draft", "dépouille", "l'angle donné aux parois pour que la pièce sorte du moule"], ["Undercut", "contre-dépouille", "une forme qui empêche la pièce de sortir dans le pull"], ["Slide", "tiroir", "une partie du moule qui recule de côté pour libérer une forme latérale"],
  ["Lifter", "éjecteur incliné (cale montante)", "il démoule une contre-dépouille intérieure, un crochet"], ["Ejector pin", "éjecteur", "la tige qui pousse la pièce hors du moule ; elle laisse une pastille ronde"], ["Gate", "seuil d'injection ; attaque de coulée", "le point par où la matière entre dans l'empreinte"],
  ["Sprue", "carotte ; descente de coulée", "le canal par où la matière arrive de la buse ou du bassin"], ["Runner", "canal d'alimentation", "le canal qui mène la matière du sprue au gate"], ["Ingate", "attaque de coulée", "l'entrée du métal dans l'empreinte, en fonderie"],
  ["Riser", "masselotte", "une réserve de métal liquide qui nourrit la pièce pendant son retrait"], ["Riser tube (stalk)", "tube de remontée", "en low pressure, le tube par où le métal monte du four dans le moule"], ["Overflow", "talon de lavage", "en die casting, une poche qui reçoit l'air et le premier métal, froid"],
  ["Vent", "évent", "un passage fin par où l'air sort de l'empreinte"], ["Cope / drag", "châssis du dessus / du dessous", "les deux moitiés d'un moule en sable"], ["Pattern", "modèle de fonderie", "la forme autour de laquelle on serre le sable"],
  ["Flash", "bavure", "la matière qui s'échappe au plan de joint"], ["Sink mark", "retassure", "un creux en surface, en face d'une masse"], ["Shrinkage porosity", "porosité de retrait", "les vides laissés au cœur d'une masse qui fige en dernier"],
  ["Gate vestige", "trace du seuil", "ce qui reste du gate sur la pièce"], ["Witness mark", "trace de moule (témoin)", "toute marque que le moule laisse sur la pièce"], ["Trim die", "outil de détourage", "la presse qui cisaille le runner, l'ingate et les overflows d'une pièce en die casting"],
  ["Buffing", "ponçage, polissage", "la reprise qui efface une trace : gate, riser"], ["Machining allowance", "surépaisseur d'usinage", "la matière laissée sur une face reprise après coulée"], ["Open / close mold", "moule à deux moitiés", "un moule sans slide ni lifter"],
];
const GATE_FR = { pin: "seuil capillaire ; buse chaude", edge: "seuil latéral", sub: "seuil sous-marin (en tunnel)", sprue: "seuil direct (carotte)", valve: "buse à obturateur", ingate: "attaque de coulée, canal et talons de lavage", stalk: "attaque par le bas (tube de remontée)", gravity: "descente de coulée, canal et attaque" };
const FEATURES = [["Box", "bloc"], ["Cylinder", "cylindre"], ["Coil (helical tube)", "serpentin (tube en hélice)"], ["Extrude", "extrusion de profil"], ["Revolve", "révolution"], ["Hole", "trou"], ["Pocket", "poche"], ["Pad", "bossage plat"], ["Slot", "rainure"], ["Boss", "bossage cylindrique"],
  ["Arch (spring blade)", "lame en pont"], ["Shell", "coque"], ["Fillet", "congé"], ["Chamfer", "chanfrein"], ["Rib", "nervure"], ["Gusset", "gousset"], ["Standoff", "colonnette"], ["Bend", "pli"], ["Flange", "bord plié"], ["Flat pattern", "développé à plat"], ["Bend relief", "dégagement d'angle"]];

/** The tables a term comes from : every entry carries `label` (English) and `fr`. For the tests, and for the next brick. */
export const TERM_TABLES = { MODEL_WORDS, PROCESSES, INTERFACE_TYPES, ADHESIVES, WELD_PROCESSES, PLATINGS, CONTACT_FORMS, CONTACT_BASES, STOCK_FORMS, SHOP_VERBS, AM_PROCESSES, LASER_FAMILIES, ENDS, INSULATIONS, LABEL_KINDS, FINISHES };

/** The glossary : [{ group, en, fr, note }], in the order of the groups, then of the alphabet. */
export function glossary() {
  const rows = [], add = (group, en, fr, note = "") => { if (en && fr && !rows.some((r) => r.group === group && r.en.toLowerCase() === String(en).toLowerCase())) rows.push({ group, en: String(en), fr: String(fr), note }); };
  const all = (group, table, note) => { for (const v of Object.values(table)) add(group, v.label, v.fr, typeof note === "function" ? note(v) : note || ""); };
  all("process", PROCESSES); all("process", AM_PROCESSES, "impression 3D"); add("process", "Sheet metal bending", "tôlerie pliée", "laser, puis presse plieuse"); add("process", "Press brake", "presse plieuse"); add("process", "Heat treatment", "traitement thermique");
  for (const [en, fr, note] of MOLD_TERMS) add("mold", en, fr, note);
  for (const [k, g] of Object.entries(GATES)) add("mold", g.label, GATE_FR[k], "type de gate");
  all("operation", SHOP_VERBS, "verbe d'atelier"); for (const [en, fr] of FEATURES) add("operation", en, fr, "forme");
  all("stock", STOCK_FORMS); all("stock", LASER_FAMILIES, "matière en feuille, au laser");
  all("interface", INTERFACE_TYPES, "type d'interface"); all("interface", ADHESIVES, "colle"); all("interface", WELD_PROCESSES, "soudage"); add("interface", "Mate", "accouplement"); add("interface", "Dowel pin", "goupille de positionnement"); add("interface", "Heat-set insert", "insert posé à chaud"); add("interface", "Clearance hole", "trou de passage"); add("interface", "Tapped hole", "trou taraudé"); add("interface", "Counterbore", "lamage"); add("interface", "Countersink", "fraisure"); add("interface", "Slip fit / press fit", "ajustement glissant / serré");
  all("electrical", MODEL_WORDS, "modèle de connecteur"); all("electrical", PLATINGS, "revêtement"); all("electrical", CONTACT_FORMS, "forme de contact"); all("electrical", CONTACT_BASES, "matière de contact"); all("electrical", ENDS, "circuit flexible"); all("electrical", INSULATIONS, "isolant de busbar");
  all("finish", FINISHES, "finition du rendu"); all("finish", LABEL_KINDS, "étiquette"); all("finish", PATTERNS, "camouflage, motif d'une pièce à l'écran"); all("finish", SHEENS, "finition à l'écran");
  for (const m of MATERIALS) if (m.fr) add("stock", m.name, m.fr, "matière");
  for (const m of Array.isArray(MODELS) ? MODELS : Object.values(MODELS)) add("analysis", m.title, m.fr, "modèle de calcul");
  add("analysis", "Refinement zone", "zone de raffinement", "simulation : un volume où les cubes du maillage sont plus petits"); add("analysis", "Mesh refinement", "raffinement du maillage", "simulation"); add("analysis", "Tied node (hanging node)", "nœud lié (nœud suspendu)", "simulation : un nœud fin, au bord d'une zone, qui suit le cube sur lequel il repose");
  for (const [fr, en] of Object.entries(RULE_TITLES)) add("rules", en, fr, /^(Short|Net-to|Trace|Unrouted|Drill|Insufficient annular|Holes too|Via|Component|Under the|Unplaced|Solder|Through-hole|Fiducials|Polarized|Bill|Decoupling|Test access|Board thickness|Four|Heavy|Large|Mounting|High voltage|Conformal|Coating|Tests before|Power net|Block|Unconnected|IC |Two sources|Inconsistent|Function|Single-pin|Net name|Insufficient voltage|Missing)/.test(en) ? "règle de carte" : "règle DFx");
  const order = TERM_GROUPS.map((g) => g.id);
  return rows.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.en.localeCompare(b.en, "en"));
}
/** The glossary by group : [{ ...group, terms }]. find : text looked for in either language. */
export function glossaryByGroup(find = "") {
  const q = String(find || "").trim().toLowerCase(), all = glossary().filter((r) => !q || r.en.toLowerCase().includes(q) || r.fr.toLowerCase().includes(q));
  return TERM_GROUPS.map((g) => ({ ...g, terms: all.filter((r) => r.group === g.id) })).filter((g) => g.terms.length);
}
