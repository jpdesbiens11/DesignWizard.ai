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
   two CORE, springs pressed to their stops ; 7 — the HV contact elastic, the laser marking ; 8 — the HV crown crimped under its stop washer ; 9 — louvred
   contact strips modelled on real ones, four LV contacts, their flex tails, the joint for the Isolation screen (demo_bm_contacts.js) ; 10 — the casing
   extruded in polycarbonate along the 8 CORE, its screw ports for the two lids, the channel of the return busbar, the two terminals of the module
   (demo_bm_case.js) ; 11 a — the return busbar and the top lid : interface ring in aluminium, cap, quarter-turn cam latch, springs on a
   pressure plate, a contact bridge that closes the loop by pressure (demo_bm_lid.js) ; 11 b — the bottom lid (demo_bm_bottom.js) ; 12 — the CORE
   remade (JP, 22 novembre) : the laminated busbar as the trade makes them, both layers stacked on top of the cells and welded by thin tongues,
   the welds drawn ; the joints between two CORE face against face, pressed by the springs of the lid (bounded with Holm) ; the sensors in the
   bottom support, on cones of a flex that slides into it. Thicknesses, windows and holes are EXAMPLES (said on each part).
   Frame of a CORE : X along a row of 4 (92.8 mm), Y across the two rows (46.4 mm), Z up ; the cells stand on z = 0. Every part of the
   CORE is drawn in that frame, so its place in the CORE is the origin (the cells and the board excepted). */

import { cellPart } from "../core/elec_parts.js";
import { cell } from "../cad/elec_library.js";
import { coreBoard } from "./demo_core.js";
import { syncTwins } from "../pcba/twin.js";
import { LIBRARY } from "../pcba/library.js";
import { WORDS_BM } from "./demo_bm_words.js";
import { run, sessionDefaults } from "../analysis/physics/index.js";
import { coreFlex, FLEX_T } from "./demo_bm_box.js";
import { coreLaminate, INS_T, WRAP_T, stackOf } from "./demo_bm_lam.js";
import { coreHolder, coreBase, coreClip } from "./demo_bm_holder.js";
import { contactLayout, busbarContacts, lvContactPart, tapParts, lvBody } from "./demo_bm_contacts.js";
import { casingPart, terminalParts, returnSizing, casingPaths } from "./demo_bm_case.js";
import { topEnd } from "./demo_bm_lid.js";
import { bottomEnd } from "./demo_bm_bottom.js";

/* Iteration 2 (JP, 21 novembre : « garder les L pressés » ; « le max de courant continu des 21700 P45B de Molicel, en décharge et en charge,
   la valeur la plus élevée — on est en 8s8p avec 8 CORE » ; then the flex in G). The cell is the Molicel INR-21700-P45B of the library, its
   sheet read : 45 A in continuous discharge at most, 9 A in continuous charge (p. 3) — 45 A is the higher : 8 × 45 = 360 A through every CORE.
   The grid of the CORE stays at 21.7 mm per cell (the generic envelope, the size of the board) : a P45B is at most 21.55 mm. */
const C = cell("21700-P45B"), D = 21.7, H = C.L, GAP = 3;
export const CORE_X = 4 * D + 2 * GAP, CORE_Y = 2 * D + GAP;      // 92.8 × 46.4 : the top of a CORE, and the size of its board
export const I_CORE = 8 * C.discharge[1];      // 360 A : the 8 cells in parallel, each at its largest continuous current
export const BB_T = 2.0, HOLDER_H = 8;      // the copper, sized for I_CORE (the calculation is kept in the project) ; the height of a cell holder (example)
export const CORE_PITCH = CORE_Y + 2 * (INS_T + BB_T);      // one CORE to the next : 50.9 mm — iteration 12 : the legs face against face, no gap
const BB_W = CORE_X - 2 * GAP;      // 86.8 : the busbar stops at the gaps of 3 mm of the short ends, where the panel of the flex rises
export const STACK = stackOf({ H: 0, ins: INS_T, t: BB_T, w: WRAP_T }).h;      // paper, − copper, paper, + copper, film : 4.6 mm above the cells
export const FLOOR_T = 1.5, SLOT = 0.4, CLIP_T = 1.9;      // the floor of the bottom support, the slot of the flex, the clipped plate (examples)
export const BELOW = FLOOR_T + SLOT + CLIP_T;      // 3.8 mm under the cans

const CELL = { ...cellPart(C, { id: "BM-CELL-21700" }), name: "Cellule 21700 du CORE" };
CELL.notes = [...CELL.notes, "Dans le CORE, la grille reste à 21,7 mm par cellule (la taille de la carte) : une P45B fait 21,55 mm au plus, il reste au moins 0,15 mm entre deux cellules."];

const at = (t) => ({ t, r: [0, 0, 0] });
const ROWS = [D / 2, D + GAP + D / 2], cellAt = (i, j) => [GAP + D / 2 + i * D, ROWS[j]];
const ZB = Math.round((H + STACK + FLEX_T) * 1e6) / 1e6;      // the bottom of the board : on the panel of the flex, on the laminated busbar
/** The CORE, iteration 12 : 8 cells, the top holder, the bottom support and its clipped plate, the flex of the sensors in the slot between them,
    the laminated busbar on top, the LV contacts of both legs, the two voltage taps, the board — each at its place, the frame of the CORE at the origin. */
function coreAssembly(pcbPart, flex) {
  const cells = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const [x, y] = cellAt(i, j); cells.push({ id: `c${j + 1}${i + 1}`, part: CELL.id, fixed: true, placement: at([x, y, 0]) }); }
  return { dw: "assembly/1", id: "BM-CORE-ASM", name: "CORE 1S8P",
    instances: [...cells, { id: "supH", part: "BM-HOLDER", fixed: true, placement: at([0, 0, H - HOLDER_H]) }, { id: "supB", part: "BM-HOLDER-BASE", fixed: true, placement: at([0, 0, 0]) },
      { id: "plaque", part: "BM-BASE-CLIP", fixed: true, placement: at([0, 0, 0]) }, { id: "flex", part: "BM-FLEX-BASE", fixed: true, placement: at(flex.at) },
      { id: "bb", part: "BM-BB-LAM", fixed: true, placement: at([0, 0, 0]) }, { id: "lvp", part: "BM-LV-PLUS", fixed: true, placement: at([0, 0, 0]) }, { id: "lvm", part: "BM-LV-MOINS", fixed: true, placement: at([0, 0, 0]) },
      { id: "bplus", part: "BM-TAP-NI-P", fixed: true, placement: at([0, 0, 0]) }, { id: "bmoins", part: "BM-TAP-NI-M", fixed: true, placement: at([0, 0, 0]) },
      { id: "carte", part: pcbPart, fixed: true, placement: at([0, 0, ZB]) }],
    mates: [] };
}
/** The joint between two CORE, for the Isolation screen : the laminated busbar of a CORE and of the next, the LV contacts that meet there — each
    conductor with its own potential, for the highest CORE of the chain (CORE 7 → CORE 8, the bus referred to the − of the pack at the central BMS :
    an assumption, said). */
function jointAssembly(layout) {
  const V = (k) => Math.round(k * 4.2 * 10) / 10, P = Math.round(CORE_PITCH * 1e6) / 1e6;
  const ov = { "bb/plus": { kind: "conductor", net: "N7" }, "bb/moins": { kind: "ignore" }, "bb2/plus": { kind: "ignore" }, "bb2/moins": { kind: "conductor", net: "N7" },      // the far conductors of the two CORE (N6, N8) are left out : the islands face the copper of the joint
    ...Object.fromEntries(layout.lv.flatMap((c) => [[`lvp/${lvBody(c.net)}`, { kind: "conductor", net: c.net }], [`lvm2/${lvBody(c.net)}`, { kind: "conductor", net: c.net }]])) };
  return { dw: "assembly/1", id: "BM-JOINT-ASM", name: "Joint entre deux CORE (CORE 7 → CORE 8)", notes: ["Pour l'Isolation : le joint le plus haut de la chaîne — 29,4 V entre le cuivre du joint et la masse du bus. Les cellules n'y sont pas ; le bus RS-485 est supposé référencé au − du pack, au BMS central.", "Le conducteur − du CORE 7 (25,2 V) et le conducteur + du CORE 8 (33,6 V) sont laissés hors de l'analyse : ils sont de l'autre côté de leur CORE ; l'isolation à l'intérieur d'un CORE se regarde sur le CORE."],
    instances: [{ id: "bb", part: "BM-BB-LAM", fixed: true, placement: at([0, 0, 0]) }, { id: "lvp", part: "BM-LV-PLUS", fixed: true, placement: at([0, 0, 0]) },
      { id: "bb2", part: "BM-BB-LAM", fixed: true, placement: at([0, P, 0]) }, { id: "lvm2", part: "BM-LV-MOINS", fixed: true, placement: at([0, P, 0]) }], mates: [],
    isolation: { nets: [{ name: "N7", kind: "dc", voltage: V(7) }, { name: "+5V_ISO", kind: "dc", voltage: 5 }, { name: "RS485_A", kind: "dc", voltage: 5 }, { name: "RS485_B", kind: "dc", voltage: 5 }, { name: "GND_ISO", kind: "dc", voltage: 0 }],
      params: { pollution_degree: 2, altitude_m: 2000, ovc: "I", field: "A", level: "functional" }, overrides: ov } };
}
/* The casing runs from 11 mm beyond the studs of the − terminal to the room of the top lid : 52.2 mm more than the 8 CORE (iteration 12 : it follows
   the pitch). */
export const CASE_Y0 = -29, CASE_L = Math.round((8 * CORE_PITCH + 52.2) * 1e6) / 1e6;
/** The module : 8 CORE side by side along Y, all the same way round ; the + leg of each on the − leg of the next ; the − terminal before CORE 1,
    the + terminal after CORE 8, the casing around them all. */
function moduleAssembly() {
  return { dw: "assembly/1", id: "BM-8S8P-ASM", name: "BM 8s8p - 21700",
    instances: [{ id: "boitier", part: "BM-CASING", fixed: true, placement: at([0, CASE_Y0, 0]) }, { id: "borne_moins", part: "BM-TERM-NEG", fixed: true, placement: at([0, 0, 0]) },
      ...Array.from({ length: 8 }, (_, k) => ({ id: `core${k + 1}`, asm: "BM-CORE-ASM", fixed: true, placement: at([0, Math.round(k * CORE_PITCH * 1e6) / 1e6, 0]) })),
      { id: "borne_plus", part: "BM-TERM-POS", fixed: true, placement: at([0, Math.round(7 * CORE_PITCH * 1e6) / 1e6, 0]) },
      { id: "retour", part: "BM-RETURN-BB", fixed: true, placement: at([0, 0, 0]) }, { id: "couvercle_haut", asm: "BM-LID-TOP-ASM", fixed: true, placement: at([0, 0, 0]) },
      { id: "couvercle_fond", asm: "BM-LID-BOT-ASM", fixed: true, placement: at([0, 0, 0]) }], mates: [] };
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
    description: "Module de batterie 8s8p en cellules 21700 : 8 CORE 1S8P en série, côte à côte, chacun avec sa carte de mesure posée dessus. Douzième itération : le CORE refait — busbar laminé industriel sur le dessus, soudures laser dessinées, joints plans pressés par les ressorts du couvercle, capteurs dans le support du bas.",
    parts: [JSON.parse(JSON.stringify(CELL))], assemblies: [], boards: [coreBoard()], drawing: { words: WORDS_BM }, physics: [busbarSizing(), returnSizing(I_CORE)], log: [] };
  const layout = contactLayout(CORE_X, D), z = stackOf({ H, ins: INS_T, t: BB_T, w: WRAP_T });
  const o = { X: CORE_X, Y: CORE_Y, H, t: BB_T, ins: INS_T, w: WRAP_T, e: GAP, grid: D, gap: GAP, rows: ROWS };
  const contacts = busbarContacts(layout, { Y: CORE_Y, ins: INS_T, t: BB_T, H, top: z.zF1 }), flex = coreFlex({ ...o, top: STACK, floor: FLOOR_T });
  const hold = { X: CORE_X, Y: CORE_Y, grid: D, gap: GAP, h: HOLDER_H, rows: ROWS };
  p.parts.push(coreLaminate({ ...o, contacts }), flex.part, coreHolder(hold), coreBase({ ...hold, floor: FLOOR_T, cone: 6 }),
    coreClip({ ...hold, floor: FLOOR_T, slot: SLOT, t: CLIP_T, flexT: FLEX_T, pad: { d: 5, pocket: 1 } }),
    lvContactPart("p", layout, { Y: CORE_Y, ins: INS_T, t: BB_T, zb: ZB }), lvContactPart("m", layout, { Y: CORE_Y, ins: INS_T, t: BB_T, zb: ZB }),
    ...tapParts({ X: CORE_X, Y: CORE_Y, ins: INS_T, t: BB_T, zP1: z.zP1, zM1: z.zM1, zb: ZB, boardT: 1.6 }));
  const ends = terminalParts({ X: CORE_X, Y: CORE_Y, ins: INS_T, t: BB_T, gap: 0 }), casing = casingPart({ L: CASE_L });
  casing.plan = { paths: casingPaths(CASE_L) };
  const top = topEnd({ land: Math.round((8 * CORE_PITCH - (INS_T + BB_T) + 2) * 1e6) / 1e6, end: Math.round((CASE_Y0 + CASE_L) * 1e6) / 1e6, y0: CASE_Y0 - 16 });      // the back of the + terminal ; the end of the casing ; the bottom end of the return busbar
  const negLand = Math.round((CORE_Y + INS_T + BB_T - CORE_PITCH - 2) * 1e6) / 1e6, bottom = bottomEnd({ end: CASE_Y0, land: negLand, back: Math.round((negLand - 3) * 1e6) / 1e6, barEnd: CASE_Y0 - 16 });      // the − terminal : its copper, then its backing plate ; the return busbar ends inside the bottom lid
  p.parts.push(casing, ends.neg, ends.pos, ...top.parts, ...bottom.parts);
  syncTwins(p, LIBRARY);
  const board = p.boards[0], twin = p.parts.find((x) => x.id === board.part);
  twin.name = "Carte de CORE 1S8P"; twin.function = "La carte de mesure du CORE, posée sur le busbar laminé : 8 températures, la tension du CORE, l'équilibrage, RS-485 isolé.";
  p.assemblies = [moduleAssembly(), coreAssembly(twin.id, flex), top.assembly(), bottom.assembly, jointAssembly(layout)];
  return p;
}
