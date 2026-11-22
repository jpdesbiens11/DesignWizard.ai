/* DesignOrbit.ai — the project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026 : « créer un nouveau projet pour ces pièces et assembly
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
import { bmsBoard, BMS_BOARD_ID } from "./demo_bms.js";
import { putBoard } from "../pcba/lab_table.js";
import { moduleDesign } from "../sw/sw_bm_design.js";
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
import { screwHolding, heatCalcs } from "./demo_bm_heat.js";
import { conceptTwo, camLayout, camCalc } from "./demo_bm_c2.js";
import { ENV3, laminateC3, louvrePart, terminalsC3, lidForcesC3, pressPlateC3, discPart, calcsC3, F3 } from "./demo_bm_c3.js";
import { CORE_ENV } from "./demo_bm_case.js";
import { lidForks, lidForkFeatures, bridgeC3, lidBandsPart } from "./demo_bm_c3_lid.js";
import { run as runCalc, sessionDefaults as calcDefaults } from "../analysis/physics/index.js";
import { addPoint, restoreInto, putDefinition, withoutHistory, tipOf } from "../core/history.js";

/** The branch of concept 2 (JP, 22 novembre : « commence un point de sauvegarde du MAIN et fait une branche parallèle (concept 2 - consumer
    product interface) »). */
export const C2_BRANCH = "concept 2 - consumer product interface";
/** The branch of concept 3 (JP, 22 novembre : « une 3e branche, partie du concept 1… contacts haute puissance à lames… commencer simple ») ;
    his choices by menu : « Lame dans une pince », from the whole of concept 1. */
export const C3_BRANCH = "concept 3 - blade and fork";

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

/** The project, new each time : the CORE board with its mechanical twin, the parts of the CORE, the CORE and the module — and its history :
    concept 1 kept on MAIN, concept 2 and concept 3 on their own branches. o : { branch (true or "c2" : the project opens on concept 2 ; "c3" :
    on concept 3 ; else on MAIN) } */
export function bmProject(opts = {}) {
  const p = { dw: "project/1", id: "bm-8s8p-21700", name: "BM 8s8p - 21700", author: "DesignOrbit.ai",
    description: "Module de batterie 8s8p en cellules 21700 : 8 CORE 1S8P en série, côte à côte, chacun avec sa carte de mesure posée dessus. Douzième itération : le CORE refait — busbar laminé industriel sur le dessus, soudures laser dessinées, joints plans pressés par les ressorts du couvercle, capteurs dans le support du bas.",
    parts: [JSON.parse(JSON.stringify(CELL))], assemblies: [], boards: [coreBoard(), bmsBoard()], drawing: { words: WORDS_BM }, physics: [busbarSizing(), returnSizing(I_CORE), screwHolding(), ...heatCalcs(CASE_L)], log: [] };
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
  const bms = p.parts.find((x) => x.id === p.boards[1].part);
  bms.name = "BMS central du module"; bms.function = "Le BMS central : interroge les 8 cartes de CORE par la chaîne RS-485, lit le courant du module, commande le contacteur et dit l'état au véhicule par CAN. Pas encore posé : le logement du couvercle du fond est trop petit.";
  putBoard(p, BMS_BOARD_ID); putBoard(p, p.boards[0].id);
  p.software = [moduleDesign()];
  withConceptTwo(p, true); withConceptThree(p);
  restoreInto(p, opts.branch === "c3" ? tipOf(p.history, C3_BRANCH).id : opts.branch ? "P2" : "P1");      // the software of the central BMS : its state machine, run on its bench, written in C      // the lab table : the central BMS and one CORE board, linked by the four wires of the chain
  return p;
}

/** The history of the project : a point on MAIN that keeps concept 1 as it stands (iteration 15), then the branch of concept 2 — the same boards
    and their twins, the parts and the assemblies of concept 2 (demo_bm_c2.js), the calculations that still speak of its parts. back : the
    project stays on concept 2 ; else it goes back to MAIN (concept 1, what every screen opened on until now). */
function withConceptTwo(p, onBranch) {
  addPoint(p, { kind: "manual", label: "Concept 1 — itération 15", when: "2026-11-22T12:00:00.000Z", by: "DesignOrbit.ai",
    note: "Le module tel que les itérations 1 à 15 l'ont fait : 8 CORE debout côte à côte, busbar laminé à jambes pliées, joints plans pressés par le couvercle du haut à came quart de tour, couvercle du fond à anneau usiné." });
  const doc = JSON.parse(JSON.stringify(withoutHistory(p))), twins = new Set(p.boards.map((b) => b.part)), c2 = conceptTwo({ core: p.boards[0].part, bms: p.boards[1].part });
  doc.parts = [...doc.parts.filter((x) => twins.has(x.id)), ...c2.parts]; doc.assemblies = c2.assemblies;
  const ids = new Set(doc.parts.map((x) => x.id)); doc.physics = [...(doc.physics || []).filter((c) => !c.part || ids.has(c.part)), camCalc()];
  doc.description = `Concept 2 « consumer product interface » : les 8 CORE couchés en ligne, pressés comme des piles dans une lampe — bandes à lamelles sur la face − de chaque CORE, plaque + rigide à bossages ; poignée quart de tour à came double lobe (${camLayout().preload.toFixed(0)} N sur la pile) ; couvercle du fond actif (connecteur, contacteur, carte BMS). Premier jet, à itérer.`;
  delete doc.id; delete doc.log; delete doc.updated; putDefinition(p, doc);
  addPoint(p, { kind: "manual", branch: C2_BRANCH, label: "Concept 2 — premier jet : CORE 2.0 en ligne, poignée à came", when: "2026-11-22T12:30:00.000Z", by: "DesignOrbit.ai",
    note: "D'après les documents et les réponses de JP : CORE en ligne pressés, bandes à lamelles sur la face −, + rigide à bossages, poignée quart de tour à came double lobe, couvercle du fond actif." });
  if (!onBranch) restoreInto(p, "P1");
}

/** Concept 3, on its branch from MAIN (P1) : concept 1 whole, its joints made of a blade and a fork, its terminals likewise, the springs of the
    top lid as disc springs, the casing and the lids 10 mm wider at +X (demo_bm_c3.js). */
function withConceptThree(p) {
  restoreInto(p, "P1");
  const env = ENV3(CORE_ENV), find = (id) => p.parts.find((x) => x.id === id), DISC = 3, S = topEnd({ land: 0, end: 0, y0: 0 }).layout.springs.plate;
  const lam = laminateC3(find("BM-BB-LAM"), { Y: CORE_Y, ins: INS_T, t: BB_T }), louv = louvrePart(-(INS_T + BB_T));
  const t3 = terminalsC3(find("BM-TERM-NEG"), find("BM-TERM-POS"), { Y: CORE_Y, ins: INS_T, t: BB_T, pitch: CORE_PITCH });
  const casing = casingPart({ L: CASE_L, env }); casing.plan = { paths: casingPaths(CASE_L, env) };
  casing.notes = [...casing.notes, `Concept 3 : la cavité s'élargit de ${r6(F3.jawOut[1] - CORE_ENV.x1)} mm au bout +X pour les pinces ; les nervures de ce côté font face à leur mâchoire extérieure, 0,5 mm de jeu. La quille et les rails restent sous le CORE.`];
  const top = topEnd({ env, lipX1: 92.4, land: r6(8 * CORE_PITCH - (INS_T + BB_T) + 2), end: r6(CASE_Y0 + CASE_L), y0: CASE_Y0 - 16 });
  const negLand = r6(CORE_Y + INS_T + BB_T - CORE_PITCH - 2), bottom = bottomEnd({ env, end: CASE_Y0, land: negLand, back: r6(negLand - 3), barEnd: CASE_Y0 - 16 });
  const F = lidForcesC3(64 * C.mass[0] / 1000), plate = pressPlateC3(top.layout, S, DISC), disc = discPart(DISC, F.stack / 4);
  const fresh = new Map([...top.parts, ...bottom.parts, casing, lam, t3.neg, t3.pos, plate].map((x) => [x.id, x]));
  p.parts = [...p.parts.filter((x) => x.id !== "BM-SPRING-PLATE").map((x) => fresh.get(x.id) || x), louv, disc];
  const core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM"), lid = top.assembly();
  core.instances.push({ id: "lamelles", part: "BM3-LAMELLES", fixed: true, placement: at([0, 0, 0]) });
  mod.instances.splice(mod.instances.findIndex((i) => i.id === "borne_plus") + 1, 0, { id: "lamelles_plus", part: "BM3-LAMELLES", fixed: true, placement: at([0, r6(8 * CORE_PITCH), 0]) });
  lid.instances = lid.instances.map((i) => (i.part === "BM-SPRING-PLATE" ? { ...i, part: "BM3-DISCS", placement: at([i.placement.t[0], r6(top.layout.ring1 - DISC), i.placement.t[2]]) } : i));
  p.assemblies = p.assemblies.map((a) => (a.id === lid.id ? lid : a.id === "BM-LID-BOT-ASM" ? bottom.assembly : a));
  p.physics = [...p.physics.filter((c) => ["phy-bm-busbar", "phy-bm-return"].includes(c.id)), ...calcsC3(I_CORE, F)];
  p.description = `Concept 3 « blade and fork » : le concept 1 entier, mais chaque joint entre deux CORE est une lame dans une pince à deux bandes à lamelles — l'effort de contact reste dans la pince, la pile n'est plus pressée pour ses contacts ; rondelles ressorts au couvercle du haut ; boîtier ${r6(F3.jawOut[1] - CORE_ENV.x1)} mm plus large au bout +X. Premier jet, à itérer.`;
  addPoint(p, { kind: "manual", branch: C3_BRANCH, label: "Concept 3 — premier jet : lame dans une pince", when: "2026-11-22T18:00:00.000Z", by: "DesignOrbit.ai",
    note: "Choix de JP par menu : lame dans une pince, à partir du concept 1 complet. Joints entre CORE et bornes en lame et pince à bandes à lamelles ; rondelles ressorts au couvercle ; boîtier élargi au bout +X." });
  topLidC3(p, env, DISC);
  addPoint(p, { kind: "manual", branch: C3_BRANCH, label: "Concept 3 — couvercle du haut : pinces côté module, pont rigide", when: "2026-11-22T19:00:00.000Z", by: "DesignOrbit.ai",
    note: "Choix de JP par menu : « Couvercle du haut », puis « Pinces côté module ». La borne + et la languette de retour portent chacune une pince en creux ; le couvercle, un pont de cuivre rigide à deux lames. Plus de shunt souple ni de ressort de plot." });
}

/** Concept 3, its top lid (JP, by menu : « Couvercle du haut », « Pinces côté module ») : fork A on the back of the + terminal, fork B on the tab of
    the return busbar (brought 6.6 mm nearer the stack, the window of the casing with it), a rigid bridge with two blades in the lid ; the
    springs and the strap of the pads gone ; the disc springs alone hold the stack. */
function topLidC3(p, env, DISC) {
  const end = r6(CASE_Y0 + CASE_L), TAB = 413.5, top = topEnd({ env, lipX1: 92.4, land: r6(8 * CORE_PITCH - (INS_T + BB_T) + 2), end, y0: CASE_Y0 - 16, tab: TAB }), L = top.layout;
  const K = lidForks({ rootA: L.land, rootB: L.tab1, cap: L.ring1 }), find = (id) => p.parts.find((x) => x.id === id), P7 = r6(7 * CORE_PITCH);
  const pos = JSON.parse(JSON.stringify(find("BM-TERM-POS"))), ret = top.parts.find((x) => x.id === "BM-RETURN-BB");
  pos.features.push(...lidForkFeatures(K, K.A, "plaque", "a", -P7));
  pos.notes = [...pos.notes.filter((n) => !/plot A du couvercle/.test(n)), "Concept 3 : au dos, en haut, la pince A — deux mâchoires horizontales et leurs bandes à lamelles — reçoit la lame A du pont du couvercle ; couvercle retiré, elle reste en retrait."];
  ret.features.push(...lidForkFeatures(K, K.B, "main", "b"));
  ret.notes = [...ret.notes.filter((n) => !/plot B se pose/.test(n)), `Concept 3 : la languette est à ${r6(L.tab)} mm (6,6 mm plus près de la pile qu'au concept 1) ; au dos, la pince B reçoit la lame B du pont du couvercle.`];
  const casing = JSON.parse(JSON.stringify(find("BM-CASING"))), win = casing.features.find((f) => f.id === "fenetre_retour");
  win.at[1] = r6(L.tab - CASE_Y0 - 0.6); win.size[1] = r6(CASE_L + 1 - win.at[1]);
  const F = lidForcesC3(64 * C.mass[0] / 1000, { stack: 4 * 175, pads: 0 }), disc = discPart(DISC, F.stack / 4);
  const fresh = new Map([pos, ret, casing, bridgeC3(K), disc].map((x) => [x.id, x]));
  p.parts = [...p.parts.filter((x) => !["BM-SPRING-PAD-A", "BM-SPRING-PAD-B"].includes(x.id)).map((x) => fresh.get(x.id) || x), lidBandsPart(K)];
  const lid = p.assemblies.find((a) => a.id === "BM-LID-TOP-ASM");
  lid.instances = [...lid.instances.filter((i) => !/^ressort_[ab]\d/.test(i.id)), { id: "lamelles_haut", part: "BM3-LAMELLES-HAUT", fixed: true, placement: at([0, 0, 0]) }];
  const n = Math.floor((K.bandX[1] - K.bandX[0]) / K.p + 1e-9), keep = (id, name, model, part, inputs, why) => { const r = runCalc(model, { ...calcDefaults(model), ...inputs }); return { id, name, model, part, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T19:00:00.000Z", why }; };
  p.physics = [...p.physics.filter((c) => c.id !== "phy-bm3-screws"), ...calcsC3(I_CORE, F).filter((c) => c.id === "phy-bm3-screws"),
    keep("phy-bm3-lidfork", `Pinces du couvercle du haut — 2 bandes × ${n} lamelles chacune, ${I_CORE} A`, "louvre_strip", "BM3-LAMELLES-HAUT", { strips: 2, L: K.bandX[1] - K.bandX[0], p: K.p, Il: F3.band.Il, Rl: F3.band.Rl, Fl: F3.band.Fl, h: F3.band.h, tol: 0.05, I: I_CORE },
      `Une pince du bout haut (A ou B) : deux bandes de ${K.bandX[1] - K.bandX[0]} mm contre les deux faces d'une lame du pont. Le courant du module passe par les deux, l'une après l'autre : la boucle en compte deux fois la résistance.`),
    keep("phy-bm3-lidjaw", `Mâchoire d'une pince du bout haut — ${n} lamelles à ${F3.band.F112[1]} N`, "beam_cantilever_udl", "BM-TERM-POS", { mat: "CU-C110", L: K.A.mouth, section: "rect", b: K.x[1] - K.x[0], h: F3.jawIn[1] - F3.jawIn[0] - F3.groove, F: n * F3.band.F112[1], dlim: 0.1, sf: 1.5 },
      `Les mâchoires des pinces du bout haut sont encastrées à leur racine — le dos de la borne + ou de la languette — et libres à la bouche : ${K.A.mouth} mm de long, ${K.x[1] - K.x[0]} mm de large, ${r6(F3.jawIn[1] - F3.jawIn[0] - F3.groove)} mm derrière le logement. Charge : ${n} ponts à ${F3.band.F112[1]} N, le plus fort de la fiche de la 112 ; flèche admise 0,1 mm.`)];
  p.description = p.description.replace("rondelles ressorts au couvercle du haut", "au couvercle du haut, un pont rigide à deux lames dans les pinces de la borne + et du busbar de retour, et des rondelles ressorts");
}
const r6 = (v) => Math.round(v * 1e6) / 1e6;
