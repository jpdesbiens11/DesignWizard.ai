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
   (demo_bm_case.js). Thicknesses, windows and holes are EXAMPLES (said on each part) ; the lids, the return busbar, the central BMS and the
   connectors are not drawn yet (iteration 11).
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
import { GAP as JOINT_GAP, STRIPS, contactLayout, stripPart, cagePart, stopPart, busbarContacts, contactSizing } from "./demo_bm_contacts.js";
import { casingPart, terminalParts, returnSizing, casingPaths } from "./demo_bm_case.js";

/* Iteration 2 (JP, 21 novembre : « garder les L pressés » ; « le max de courant continu des 21700 P45B de Molicel, en décharge et en charge,
   la valeur la plus élevée — on est en 8s8p avec 8 CORE » ; then the flex in G). The cell is the Molicel INR-21700-P45B of the library, its
   sheet read : 45 A in continuous discharge at most, 9 A in continuous charge (p. 3) — 45 A is the higher : 8 × 45 = 360 A through every CORE.
   The grid of the CORE stays at 21.7 mm per cell (the generic envelope, the size of the board) : a P45B is at most 21.55 mm. */
const C = cell("21700-P45B"), D = 21.7, H = C.L, GAP = 3;
export const CORE_X = 4 * D + 2 * GAP, CORE_Y = 2 * D + GAP;      // 92.8 × 46.4 : the top of a CORE, and the size of its board
export const I_CORE = 8 * C.discharge[1];      // 360 A : the 8 cells in parallel, each at its largest continuous current
export const BB_T = 2.0, HOLDER_H = 8;      // the copper, sized for I_CORE (the calculation is kept in the project) ; the height of a cell holder (example)
export const CORE_PITCH = CORE_Y + 2 * (INS_T + BB_T) + JOINT_GAP;      // one CORE to the next : 52.6 mm — the stops of the + leg of one on the − leg of the next hold the working height of the strips
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
  const [h1, h2] = layout.hv, lv = layout.lv, st = layout.stops, at3 = (dx, dz) => at([dx, 0, dz].map((v) => Math.round(v * 1e6) / 1e6));      // iteration 9 : each copy is moved along the leg from the first of its kind
  const cells = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const [x, y] = cellAt(i, j); cells.push({ id: `c${j + 1}${i + 1}`, part: CELL.id, fixed: true, placement: at([x, y, 0]) }); }
  return { dw: "assembly/1", id: "BM-CORE-ASM", name: "CORE 1S8P",
    instances: [...cells, { id: "supH", part: "BM-HOLDER", fixed: true, placement: at([0, 0, H - HOLDER_H]) }, { id: "supB", part: "BM-HOLDER-BASE", fixed: true, placement: at([0, 0, 0]) },
      { id: "bb", part: "BM-BB-LAM", fixed: true, placement: at([0, 0, 0]) }, { id: "flex", part: box.part.id, fixed: true, placement: at([FLEX_X0, 0, box.z]) },
      { id: "carte", part: pcbPart, fixed: true, placement: at([0, 0, H + STACK + FLEX_T]) },
      { id: "hv1", part: STRIPS.hv.id, fixed: true, placement: at3(0, 0) }, { id: "hv2", part: STRIPS.hv.id, fixed: true, placement: at3(h2.x - h1.x, h2.z0 - h1.z0) }, { id: "cadre", part: "BM-LAM-CAGE", fixed: true, placement: at3(0, 0) },
      ...st.map((p, k) => ({ id: `but${k + 1}`, part: "BM-STOP", fixed: true, placement: at3(p[0] - st[0][0], p[1] - st[0][1]) })),
      ...lv.map((c, k) => ({ id: `lv${k + 1}`, part: STRIPS.lv.id, fixed: true, placement: at3(c.x - lv[0].x, c.z - lv[0].z) }))],
    mates: [] };
}
/** The joint between two CORE, for the Isolation screen : the laminated busbar of a CORE and of the next, the strips, frame, stops and LV strips
    between them — each conductor with its own potential, for the highest CORE of the chain (CORE 7 → CORE 8, the bus referred to the − of the
    pack at the central BMS : an assumption, said). */
function jointAssembly(layout) {
  const asm = coreAssembly("—", { part: { id: "—" }, z: 0 }, layout), keep = new Set(["bb", "hv1", "hv2", "cadre", "but1", "but2", "but3", "but4", "lv1", "lv2", "lv3", "lv4"]);
  const inst = asm.instances.filter((x) => keep.has(x.id)), V = (k) => Math.round(k * 4.2 * 10) / 10;
  const ov = { "bb/plus": { kind: "conductor", net: "N7" }, "bb/moins": { kind: "ignore" }, "bb2/plus": { kind: "ignore" }, "bb2/moins": { kind: "conductor", net: "N7" },      // the far conductors of the two CORE (N6, N8) are left out : the islands face the copper of the joint
    "hv1/main": { kind: "conductor", net: "N7" }, "hv2/main": { kind: "conductor", net: "N7" }, ...Object.fromEntries([1, 2, 3, 4].map((k) => [`but${k}/main`, { kind: "conductor", net: "N7" }])),
    ...Object.fromEntries(layout.lv.map((c, k) => [`lv${k + 1}/main`, { kind: "conductor", net: c.net }])) };
  return { dw: "assembly/1", id: "BM-JOINT-ASM", name: "Joint entre deux CORE (CORE 7 → CORE 8)", notes: ["Pour l'Isolation : le joint le plus haut de la chaîne — 29,4 V entre le cuivre du joint et la masse du bus. Les cellules n'y sont pas ; le bus RS-485 est supposé référencé au − du pack, au BMS central.", "Le conducteur − du CORE 7 (25,2 V) et le conducteur + du CORE 8 (33,6 V) sont laissés hors de l'analyse : ils sont de l'autre côté de leur CORE ; l'isolation à l'intérieur d'un CORE se regarde sur le CORE."],
    instances: [...inst, { id: "bb2", part: "BM-BB-LAM", fixed: true, placement: at([0, CORE_PITCH, 0]) }], mates: [],
    isolation: { nets: [{ name: "N7", kind: "dc", voltage: V(7) }, { name: "+5V_ISO", kind: "dc", voltage: 5 }, { name: "RS485_A", kind: "dc", voltage: 5 }, { name: "RS485_B", kind: "dc", voltage: 5 }, { name: "GND_ISO", kind: "dc", voltage: 0 }],
      params: { pollution_degree: 2, altitude_m: 2000, ovc: "I", field: "A", level: "functional" }, overrides: ov } };
}
/* Iteration 10 : the casing runs from 11 mm beyond the studs of the − terminal to 11 mm beyond those of the + terminal — the room of the lids,
   an example until iteration 11 draws them. */
export const CASE_Y0 = -29, CASE_L = 473;
/** The − terminal of the module, with what its face carries : the strips, their frame, the stops and the LV strips of a + leg, one pitch before
    CORE 1 (every part in the frame of CORE 1). */
function terminalAssembly(layout) {
  const core = coreAssembly("—", { part: { id: "—" }, z: 0 }, layout), keep = new Set(["hv1", "hv2", "cadre", "but1", "but2", "but3", "but4", "lv1", "lv2", "lv3", "lv4"]);
  const moved = core.instances.filter((x) => keep.has(x.id)).map((x) => ({ ...x, placement: at([x.placement.t[0], Math.round((x.placement.t[1] - CORE_PITCH) * 1e6) / 1e6, x.placement.t[2]]) }));
  return { dw: "assembly/1", id: "BM-TERM-NEG-ASM", name: "Borne − du module, avec ses contacts", instances: [{ id: "borne", part: "BM-TERM-NEG", fixed: true, placement: at([0, 0, 0]) }, ...moved], mates: [] };
}
/** The module : 8 CORE side by side along Y, all the same way round ; the + leg of each on the − leg of the next ; the − terminal before CORE 1,
    the + terminal after CORE 8, the casing around them all. */
function moduleAssembly() {
  return { dw: "assembly/1", id: "BM-8S8P-ASM", name: "BM 8s8p - 21700",
    instances: [{ id: "boitier", part: "BM-CASING", fixed: true, placement: at([0, CASE_Y0, 0]) }, { id: "borne_moins", asm: "BM-TERM-NEG-ASM", fixed: true, placement: at([0, 0, 0]) },
      ...Array.from({ length: 8 }, (_, k) => ({ id: `core${k + 1}`, asm: "BM-CORE-ASM", fixed: true, placement: at([0, k * CORE_PITCH, 0]) })),
      { id: "borne_plus", part: "BM-TERM-POS", fixed: true, placement: at([0, Math.round(7 * CORE_PITCH * 1e6) / 1e6, 0]) }], mates: [] };
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
    description: "Module de batterie 8s8p en cellules 21700 : 8 CORE 1S8P en série, côte à côte, chacun avec sa carte de mesure posée dessus. Dixième itération : le boîtier extrudé le long des 8 CORE et les deux bornes du module, à itérer.",
    parts: [JSON.parse(JSON.stringify(CELL))], assemblies: [], boards: [coreBoard()], drawing: { words: WORDS_BM }, physics: [busbarSizing(), ...contactSizing(I_CORE), returnSizing(I_CORE)], log: [] };
  const layout = contactLayout(CORE_X), contacts = busbarContacts(layout, { Y: CORE_Y, ins: INS_T, t: BB_T });
  const o = { X: CORE_X, Y: CORE_Y, H, t: BB_T, ins: INS_T, w: WRAP_T, floor: FLOOR_T, e: GAP, grid: D, gap: GAP, rows: ROWS, lv: layout.lv }, box = coreBox(o), hold = { X: CORE_X, Y: CORE_Y, grid: D, gap: GAP, h: HOLDER_H };
  p.parts.push(coreLaminate({ ...o, taps: box.taps, contacts, round: 1.8 }), box.part, coreHolder(hold), coreBase({ ...hold, floor: FLOOR_T, below: BB_T + WRAP_T - NTC_H, washer: { d: 5 } }),
    stripPart("hv", layout.hv[0].x, layout.hv[0].z0, contacts.faces.plus), cagePart(layout, contacts.faces.plus), stopPart(layout.stops[0], contacts.faces.plus), stripPart("lv", layout.lv[0].x, layout.lv[0].z - STRIPS.lv.L / 2, contacts.faces.lv));
  const ends = terminalParts({ X: CORE_X, Y: CORE_Y, ins: INS_T, t: BB_T, gap: JOINT_GAP }), casing = casingPart({ L: CASE_L });
  casing.plan = { paths: casingPaths(CASE_L) };
  p.parts.push(casing, ends.neg, ends.pos);
  syncTwins(p, LIBRARY);
  const board = p.boards[0], twin = p.parts.find((x) => x.id === board.part);
  twin.name = "Carte de CORE 1S8P"; twin.function = "La carte de mesure du CORE, posée sur le busbar laminé : 8 températures, la tension du CORE, l'équilibrage, RS-485 isolé.";
  p.assemblies = [moduleAssembly(), coreAssembly(twin.id, box, layout), terminalAssembly(layout), jointAssembly(layout)];
  return p;
}
