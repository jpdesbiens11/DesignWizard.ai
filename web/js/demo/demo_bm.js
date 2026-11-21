/* DesignWizard.ai — the project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026 : « créer un nouveau projet pour ces pièces et assembly
   qui s'appelle BM 8s8p - 21700 et tout mettre ce qui a trait au core 1s8p dedans… commencer un assembly des 8 cores pour voir où on en
   est, et après on itérera ensemble le design »).
   What it holds, from the architecture JP gave (CLAUDE.md, point 20) : a CORE is 8 cells 21700 in PARALLEL (1S8P), two rows of 4 — the
   cells of a row side by side, 3 mm at both ends of each row and between the two rows ; its board on top, of its size (the CORE board of
   the PCBA, demo/demo_core.js) ; a busbar + welded on the top of the cells, under the board, that comes down one long side, and a busbar −
   under the cells that comes up the other long side ; all the CORE the same way round, side by side : the + leg of one presses on the − leg
   of the next — the series connection by the surface of the busbars, the « briques d'énergie 2 × 4 » of JP. An insulating sheet between
   each leg and the cells. Then the module : 8 CORE in series, side by side along Y.
   Iterated with JP : 2 — the P45B read, the copper sized, the flex in G ; 3 — the cell holder ; 4 — the two L in one laminated busbar,
   the flex delivered flat and folded into a box, a thermistor under the centre of each cell through its washer (demo_bm_lam.js,
   demo_bm_box.js) ; 5 — the bottom holder with a floor and its washers molded in (demo_bm_holder.js, coreBase) ; 6 — the 4 contacts between
   two CORE, springs pressed to their stops (demo_bm_contacts.js) ; 7 — the HV contact elastic, the laser marking ; 8 — the HV crown crimped under its stop washer. Thicknesses, windows and holes are EXAMPLES (said on each part) ; the
   casing, the central BMS and the connectors are not drawn yet.
   Frame of a CORE : X along a row of 4 (92.8 mm), Y across the two rows (46.4 mm), Z up ; the cells stand on z = 0. Every part of the
   CORE is drawn in that frame, so its place in the CORE is the origin (the cells and the board excepted). */

import { cellPart } from "../core/elec_parts.js";
import { cell } from "../cad/elec_library.js";
import { coreBoard } from "./demo_core.js";
import { syncTwins } from "../pcba/twin.js";
import { LIBRARY } from "../pcba/library.js";
import { WORDS_BM } from "./demo_bm_words.js";
import { run, sessionDefaults } from "../analysis/physics/index.js";
import { coreBox, FLEX_T, FLEX_X0, NTC_H } from "./demo_bm_box.js";
import { coreLaminate, INS_T, WRAP_T } from "./demo_bm_lam.js";
import { coreHolder, coreBase } from "./demo_bm_holder.js";
import { STOP_H, contactLayout, springPart, stopPart, busbarContacts, contactSizing } from "./demo_bm_contacts.js";

/* Iteration 2 (JP, 21 novembre : « garder les L pressés » ; « le max de courant continu des 21700 P45B de Molicel, en décharge et en charge,
   la valeur la plus élevée — on est en 8s8p avec 8 CORE » ; then the flex in G). The cell is the Molicel INR-21700-P45B of the library, its
   sheet read : 45 A in continuous discharge at most, 9 A in continuous charge (p. 3) — 45 A is the higher : 8 × 45 = 360 A through every CORE.
   The grid of the CORE stays at 21.7 mm per cell (the generic envelope, the size of the board) : a P45B is at most 21.55 mm. */
const C = cell("21700-P45B"), D = 21.7, H = C.L, GAP = 3;
export const CORE_X = 4 * D + 2 * GAP, CORE_Y = 2 * D + GAP;      // 92.8 × 46.4 : the top of a CORE, and the size of its board
export const I_CORE = 8 * C.discharge[1];      // 360 A : the 8 cells in parallel, each at its largest continuous current
export const BB_T = 2.0, HOLDER_H = 8;      // the copper, sized for I_CORE (the calculation is kept in the project) ; the height of a cell holder (example)
export const CORE_PITCH = CORE_Y + 2 * (INS_T + BB_T) + STOP_H;      // one CORE to the next : 51.5 mm — the stop washers of the + leg of one on the − leg of the next
const BB_W = CORE_X - 2 * GAP;      // 86.8 : the busbar stops at the gaps of 3 mm of the short ends, where the panels of the flex rise
export const STACK = INS_T + BB_T + WRAP_T;      // paper, copper, film : above the + terminals
export const FLOOR_T = 1.5;      // the floor of the bottom holder, under the cans (example ; the PC/ABS walls of the tool : 1.2 to 3.5 mm)
export const BELOW = FLOOR_T + BB_T + WRAP_T;      // floor, copper, film : under the cans

const CELL = { ...cellPart(C, { id: "BM-CELL-21700" }), name: "Cellule 21700 du CORE" };
CELL.notes = [...CELL.notes, "Dans le CORE, la grille reste à 21,7 mm par cellule (la taille de la carte) : une P45B fait 21,55 mm au plus, il reste au moins 0,15 mm entre deux cellules."];

const at = (t) => ({ t, r: [0, 0, 0] });
const ROWS = [D / 2, D + GAP + D / 2], cellAt = (i, j) => [GAP + D / 2 + i * D, ROWS[j]];
/** Iteration 4 (JP, 21 novembre : the two L in one laminated busbar ; the flex delivered flat, folded into a box around CORE and busbar ; a
    thermistor under the centre of each cell, through a washer). Iteration 5 (JP, par menu : « support + rondelles en un ») : the bottom holder
    has a floor under the cells and its 8 washers molded in. The CORE : 8 cells, the top holder, the bottom holder with its washers, the
    laminated busbar, the flex in a box, its board on top — each at its place, the frame of the CORE at the origin. */
function coreAssembly(pcbPart, box, layout) {
  const [hv1, hv2, lva, lvb] = layout, d = (a, b) => [a.x - b.x, 0, a.z - b.z].map((v) => Math.round(v * 1e6) / 1e6);      // iteration 6 : each crown is drawn at the first contact of its kind ; its copy moves along the leg
  const cells = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const [x, y] = cellAt(i, j); cells.push({ id: `c${j + 1}${i + 1}`, part: CELL.id, fixed: true, placement: at([x, y, 0]) }); }
  return { dw: "assembly/1", id: "BM-CORE-ASM", name: "CORE 1S8P",
    instances: [...cells, { id: "supH", part: "BM-HOLDER", fixed: true, placement: at([0, 0, H - HOLDER_H]) }, { id: "supB", part: "BM-HOLDER-BASE", fixed: true, placement: at([0, 0, 0]) },
      { id: "bb", part: "BM-BB-LAM", fixed: true, placement: at([0, 0, 0]) }, { id: "flex", part: box.part.id, fixed: true, placement: at([FLEX_X0, 0, box.z]) },
      { id: "carte", part: pcbPart, fixed: true, placement: at([0, 0, H + STACK + FLEX_T]) },
      { id: "hv1", part: "BM-SPRING-HV", fixed: true, placement: at([0, 0, 0]) }, { id: "hv2", part: "BM-SPRING-HV", fixed: true, placement: at(d(hv2, hv1)) },
      { id: "st1", part: "BM-STOP-HV", fixed: true, placement: at([0, 0, 0]) }, { id: "st2", part: "BM-STOP-HV", fixed: true, placement: at(d(hv2, hv1)) },
      { id: "lva", part: "BM-SPRING-LV", fixed: true, placement: at([0, 0, 0]) }, { id: "lvb", part: "BM-SPRING-LV", fixed: true, placement: at(d(lvb, lva)) }],
    mates: [] };
}
/** The module : 8 CORE side by side along Y, all the same way round ; the + leg of each on the − leg of the next. */
function moduleAssembly() {
  return { dw: "assembly/1", id: "BM-8S8P-ASM", name: "BM 8s8p - 21700",
    instances: Array.from({ length: 8 }, (_, k) => ({ id: `core${k + 1}`, asm: "BM-CORE-ASM", fixed: true, placement: at([0, k * CORE_PITCH, 0]) })), mates: [] };
}

/** The calculation that sized the copper, kept in the project under the name of the laminated busbar : the analytic model of the tool (a bar in
    natural convection), its inputs and its verdict. */
export function busbarSizing() {
  const inputs = { ...sessionDefaults("busbar"), w: BB_W, t: BB_T, L: 100, I: I_CORE, Ta: 40, Tmax: C.envDis[1] }, r = run("busbar", inputs);
  return { id: "phy-bm-busbar", name: `Busbar laminé du CORE — ${I_CORE} A (8 × ${C.discharge[1]} A, P45B)`, model: "busbar", part: "BM-BB-LAM", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-21T18:00:00.000Z",
    why: `Courant : la plus grande valeur continue de la P45B, ${C.discharge[1]} A en décharge (contre ${C.charge} A en charge, fiche p. 3), × 8 cellules en parallèle. Limite : ${C.envDis[1]} °C, l'ambiante admissible en décharge (fiche p. 3) — le busbar touche les cellules. Section : la jambe, ${BB_W} mm × l'épaisseur. Barre seule en convection naturelle : dans le module fermé, l'échauffement réel est plus fort.` };
}

/** The project, new each time : the CORE board with its mechanical twin, the parts of the CORE, the CORE and the module. */
export function bmProject() {
  const p = { dw: "project/1", id: "bm-8s8p-21700", name: "BM 8s8p - 21700", author: "DesignWizard.ai",
    description: "Module de batterie 8s8p en cellules 21700 : 8 CORE 1S8P en série, côte à côte, chacun avec sa carte de mesure posée dessus. Huitième itération de l'architecture du projet, à itérer.",
    parts: [JSON.parse(JSON.stringify(CELL))], assemblies: [], boards: [coreBoard()], drawing: { words: WORDS_BM }, physics: [busbarSizing(), ...contactSizing(I_CORE)], log: [] };
  const o = { X: CORE_X, Y: CORE_Y, H, t: BB_T, ins: INS_T, w: WRAP_T, floor: FLOOR_T, e: GAP, grid: D, gap: GAP, rows: ROWS }, box = coreBox(o), hold = { X: CORE_X, Y: CORE_Y, grid: D, gap: GAP, h: HOLDER_H };
  const layout = contactLayout(CORE_X, H), contacts = busbarContacts(layout, { Y: CORE_Y, ins: INS_T, t: BB_T });
  p.parts.push(coreLaminate({ ...o, taps: box.taps, contacts }), box.part, coreHolder(hold), coreBase({ ...hold, floor: FLOOR_T, below: BB_T + WRAP_T - NTC_H, washer: { d: 5 } }),
    springPart("hv", layout[0], contacts.faces.plus), stopPart(layout[0], contacts.faces.plus), springPart("lv", layout[2], contacts.faces.lv));
  syncTwins(p, LIBRARY);
  const board = p.boards[0], twin = p.parts.find((x) => x.id === board.part);
  twin.name = "Carte de CORE 1S8P"; twin.function = "La carte de mesure du CORE, posée sur le busbar laminé : 8 températures, la tension du CORE, l'équilibrage, RS-485 isolé.";
  p.assemblies = [moduleAssembly(), coreAssembly(twin.id, box, layout)];
  return p;
}
