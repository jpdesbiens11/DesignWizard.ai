/* DesignWizard.ai — the project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026 : « créer un nouveau projet pour ces pièces et assembly
   qui s'appelle BM 8s8p - 21700 et tout mettre ce qui a trait au core 1s8p dedans… commencer un assembly des 8 cores pour voir où on en
   est, et après on itérera ensemble le design »).
   What it holds, from the architecture JP gave (CLAUDE.md, point 20) : a CORE is 8 cells 21700 in PARALLEL (1S8P), two rows of 4 — the
   cells of a row side by side, 3 mm at both ends of each row and between the two rows ; its board on top, of its size (the CORE board of
   the PCBA, demo/demo_core.js) ; a busbar + welded on the top of the cells, under the board, that comes down one long side, and a busbar −
   under the cells that comes up the other long side ; all the CORE the same way round, side by side : the + leg of one presses on the − leg
   of the next — the series connection by the surface of the busbars, the « briques d'énergie 2 × 4 » of JP. An insulating sheet between
   each leg and the cells. Then the module : 8 CORE in series, side by side along Y.
   FIRST ITERATION, to be iterated with JP : thicknesses, the height of the legs, the insulating sheets are EXAMPLES (said on each part) ;
   the flex folded in G, the cell holder, the welding windows, the casing, the central BMS and the connectors are not drawn yet.
   Frame of a CORE : X along a row of 4 (92.8 mm), Y across the two rows (46.4 mm), Z up ; the cells stand on z = 0. Every part of the
   CORE is drawn in that frame, so its place in the CORE is the origin (the cells and the board excepted). */

import { cellPart } from "../core/elec_parts.js";
import { cell } from "../cad/elec_library.js";
import { coreBoard } from "./demo_core.js";
import { syncTwins } from "../pcba/twin.js";
import { LIBRARY } from "../pcba/library.js";
import { WORDS_BM } from "./demo_bm_words.js";
import { run, sessionDefaults } from "../analysis/physics/index.js";
import { coreFlex, FLEX_T, ADH } from "./demo_bm_flex.js";

/* Iteration 2 (JP, 21 novembre : « garder les L pressés » ; « le max de courant continu des 21700 P45B de Molicel, en décharge et en charge,
   la valeur la plus élevée — on est en 8s8p avec 8 CORE » ; then the flex in G). The cell is the Molicel INR-21700-P45B of the library, its
   sheet read : 45 A in continuous discharge at most, 9 A in continuous charge (p. 3) — 45 A is the higher : 8 × 45 = 360 A through every CORE.
   The grid of the CORE stays at 21.7 mm per cell (the generic envelope, the size of the board) : a P45B is at most 21.55 mm. */
const C = cell("21700-P45B"), D = 21.7, H = C.L, GAP = 3;
export const CORE_X = 4 * D + 2 * GAP, CORE_Y = 2 * D + GAP;      // 92.8 × 46.4 : the top of a CORE, and the size of its board
export const I_CORE = 8 * C.discharge[1];      // 360 A : the 8 cells in parallel, each at its largest continuous current
export const BB_T = 2.0, ISO_T = 0.5;      // the copper, sized for I_CORE (the calculation is kept in the project) ; the insulating sheet (example)
export const CORE_PITCH = CORE_Y + 2 * (ISO_T + BB_T);      // one CORE to the next : 51.4 mm — the + leg of one on the − leg of the next
const BB_W = CORE_X - 2 * GAP;      // 86.8 : the busbars stop at the gaps of 3 mm of the short ends, where the flex comes down
const P = (value, label, o = {}) => ({ value, unit: "mm", label, step: 0.1, group: "CORE", ...o });
const envelope = () => ({ X: P(CORE_X, "Longueur du CORE (une rangée de 4)", { min: 80, max: 120 }), Y: P(CORE_Y, "Largeur du CORE (deux rangées)", { min: 40, max: 60 }),
  H: P(H, "Hauteur d'une cellule", { min: 65, max: 75 }), t: P(BB_T, "Épaisseur du cuivre (exemple)", { min: 0.2, max: 3, group: "Busbar" }),
  ti: P(ISO_T, "Épaisseur de l'isolant de flanc (exemple)", { min: 0.1, max: 2, group: "Busbar" }), z0: P(5, "Retrait de la jambe, en bas ou en haut (exemple)", { min: 1, max: 20, group: "Busbar" }),
  e: P(GAP, "Jeu aux petits bouts, laissé au flex", { min: 0, max: 10, group: "Busbar" }) });
const FIRST = "Deuxième itération : le cuivre est dimensionné pour 360 A (8 × 45 A, fiche de la P45B) ; l'isolant et la hauteur des jambes restent des exemples.";

const CELL = { ...cellPart(C, { id: "BM-CELL-21700" }), name: "Cellule 21700 du CORE" };
CELL.notes = [...CELL.notes, "Dans le CORE, la grille reste à 21,7 mm par cellule (la taille de la carte) : une P45B fait 21,55 mm au plus, il reste au moins 0,15 mm entre deux cellules."];

const BB_POS = { dw: "part/1", id: "BM-BB-POS", name: "Busbar + du CORE", function: "Relie les bornes + des 8 cellules, soudé au laser sous la carte, et descend le long d'un grand côté pour presser la jambe − du CORE voisin.",
  family: "busbar", process: "sheet_metal", material: "CU-C110", revision: "A", params: envelope(),
  features: [{ op: "box", id: "plaque", name: "Plaque du dessus", at: ["e", 0, "H"], size: ["X - 2 * e", "Y + ti + t", "t"] },
    { op: "box", id: "jambe", name: "Jambe du flanc +Y", at: ["e", "Y + ti", "z0"], size: ["X - 2 * e", "t", "H - z0"] }, { op: "interfaces" }],
  interfaces: [], notes: [FIRST, "Les fenêtres de soudure laser sur les bornes + ne sont pas encore dessinées ; le flex est collé dessus (0,1 mm d'adhésif)."] };
const BB_NEG = { dw: "part/1", id: "BM-BB-NEG", name: "Busbar − du CORE", function: "Relie les fonds (bornes −) des 8 cellules, sous le CORE, et monte le long de l'autre grand côté : sa jambe reçoit la jambe + du CORE voisin.",
  family: "busbar", process: "sheet_metal", material: "CU-C110", revision: "A", params: envelope(),
  features: [{ op: "box", id: "plaque", name: "Plaque du dessous", at: ["e", "-(ti + t)", "-t"], size: ["X - 2 * e", "Y + ti + t", "t"] },
    { op: "box", id: "jambe", name: "Jambe du flanc -Y", at: ["e", "-(ti + t)", "-t"], size: ["X - 2 * e", "t", "H - z0 + t"] }, { op: "interfaces" }],
  interfaces: [], notes: [FIRST, "Les fenêtres de soudure laser sur les fonds des cellules ne sont pas encore dessinées ; les doigts du flex passent dessous, CTN contre le cuivre."] };
const ISO = { dw: "part/1", id: "BM-ISO-SIDE", name: "Isolant de flanc du CORE", function: "Sépare une jambe de busbar des godets des cellules, sur un grand côté du CORE.",
  family: "insulator", process: "laser_cut", material: "NOMEX-410", revision: "A", params: envelope(),
  features: [{ op: "box", id: "feuille", name: "Feuille", at: [0, 0, 0], size: ["X", "ti", "H"] }, { op: "interfaces" }],
  interfaces: [], notes: [FIRST, "Papier aramide d'exemple ; le choix de l'isolant (matière, épaisseur, rigidité) reste à faire."] };

const at = (t) => ({ t, r: [0, 0, 0] });
/** The CORE : 8 cells, two busbars, two insulating sheets, its board on top — each at its place, the frame of the CORE at the origin. */
function coreAssembly(pcbPart, flexPart) {
  const cells = []; for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) cells.push({ id: `c${j + 1}${i + 1}`, part: CELL.id, fixed: true, placement: at([GAP + D / 2 + i * D, D / 2 + j * (D + GAP), 0]) });
  return { dw: "assembly/1", id: "BM-CORE-ASM", name: "CORE 1S8P",
    instances: [...cells, { id: "bbp", part: BB_POS.id, fixed: true, placement: at([0, 0, 0]) }, { id: "bbn", part: BB_NEG.id, fixed: true, placement: at([0, 0, 0]) },
      { id: "isop", part: ISO.id, fixed: true, placement: at([0, CORE_Y, 0]) }, { id: "ison", part: ISO.id, fixed: true, placement: at([0, -ISO_T, 0]) },
      { id: "flex", part: flexPart, fixed: true, placement: at([coreFlexAt(), 0, H + BB_T + ADH]) },
      { id: "carte", part: pcbPart, fixed: true, placement: at([0, 0, H + BB_T + ADH + FLEX_T]) }],
    mates: [] };
}
/** The module : 8 CORE side by side along Y, all the same way round ; the + leg of each on the − leg of the next. */
function moduleAssembly() {
  return { dw: "assembly/1", id: "BM-8S8P-ASM", name: "BM 8s8p - 21700",
    instances: Array.from({ length: 8 }, (_, k) => ({ id: `core${k + 1}`, asm: "BM-CORE-ASM", fixed: true, placement: at([0, k * CORE_PITCH, 0]) })), mates: [] };
}

const coreFlexAt = () => 8;      // FLEX_X0 : the core of the flex starts 8 mm from the end of the CORE
/** The calculation that sized the copper, kept in the project under the name of the + busbar : the analytic model of the tool (a bar in
    natural convection), its inputs and its verdict. */
export function busbarSizing() {
  const inputs = { ...sessionDefaults("busbar"), w: BB_W, t: BB_T, L: 100, I: I_CORE, Ta: 40, Tmax: C.envDis[1] }, r = run("busbar", inputs);
  return { id: "phy-bm-busbar", name: `Busbar + du CORE — ${I_CORE} A (8 × ${C.discharge[1]} A, P45B)`, model: "busbar", part: "BM-BB-POS", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-21T18:00:00.000Z",
    why: `Courant : la plus grande valeur continue de la P45B, ${C.discharge[1]} A en décharge (contre ${C.charge} A en charge, fiche p. 3), × 8 cellules en parallèle. Limite : ${C.envDis[1]} °C, l'ambiante admissible en décharge (fiche p. 3) — le busbar touche les cellules. Section : la jambe, ${BB_W} mm × l'épaisseur. Barre seule en convection naturelle : dans le module fermé, l'échauffement réel est plus fort.` };
}

/** The project, new each time : the CORE board with its mechanical twin, the parts of the CORE, the CORE and the module. */
export function bmProject() {
  const p = { dw: "project/1", id: "bm-8s8p-21700", name: "BM 8s8p - 21700", author: "DesignWizard.ai",
    description: "Module de batterie 8s8p en cellules 21700 : 8 CORE 1S8P en série, côte à côte, chacun avec sa carte de mesure posée dessus. Première itération de l'architecture du projet, à itérer.",
    parts: [CELL, BB_POS, BB_NEG, ISO].map((x) => JSON.parse(JSON.stringify(x))), assemblies: [], boards: [coreBoard()], drawing: { words: WORDS_BM }, physics: [busbarSizing()], log: [] };
  const flex = coreFlex({ X: CORE_X, Y: CORE_Y, H, t: BB_T, grid: D, gap: GAP, rows: [D / 2, D + GAP + D / 2] }).part; p.parts.push(flex);
  syncTwins(p, LIBRARY);
  const board = p.boards[0], twin = p.parts.find((x) => x.id === board.part);
  twin.name = "Carte de CORE 1S8P"; twin.function = "La carte de mesure du CORE, posée sur le busbar + : 8 températures, la tension du CORE, l'équilibrage, RS-485 isolé.";
  p.assemblies = [moduleAssembly(), coreAssembly(twin.id, flex.id)];
  return p;
}
