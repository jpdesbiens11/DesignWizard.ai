/* DesignWizard.ai — BM 8s8p - 21700 : the flex of a CORE, delivered flat and folded into a box (JP, 21 novembre 2026 : « même stratégie
   PCBA + PCB flex, mais il arriverait en feuille avec des pré-plis pour le rabattre en forme de boîte, en déposant le core + busbar sur la
   section centrale, et ensuite l'assemblage PCB serait replié jusqu'à ce que le PCB rigide soit déposé sur le top des busbars » ; « joindre
   les panneaux verticaux du flex même si les traces ne font pas la largeur, pour faciliter le pli, l'alignement et l'assemblage des côtés » ;
   the sensors under the cells, reading the centre of the bottom face, through washers).
   Read : the central section lies under the CORE, on the film of the laminated busbar ; a thermistor on it under the centre of each cell,
   in the hole of the − plate, its washer — a thermal pad — on it up to the can ; B− taken by a tab through a window of the film. Two
   panels of the full width rise at the short ends (the long sides belong to the busbar legs, which press the next CORE) ; one folds over
   the top and carries the rigid board — one piece, a rigid-flex : the joint of the iteration 2 is gone —, the other folds a short flap
   over the top that takes B+ through a window of the film. Drawn with the branched flexible circuit of the tool (core/flex_tree.js : the
   core, its branches, its spots). Pure : the definitions only — the parts are written by treePart. */

import { treePart, treeChecks, tipSpot } from "../core/flex_tree.js";
import { SENSOR_KINDS } from "../core/flex.js";

export const FLEX_T = 0.2, FLEX_X0 = 8, DOWN_X = 0.8, FLAP = 8;      // film ; the central section starts 8 mm in ; the panels rise 0.8 mm from the end of the CORE ; the flap of the B+ side
export const NTC_H = SENSOR_KINDS.temp.size[2];      // the height of a thermistor on the flex, under its washer

/** The flex of a CORE. o : { X, Y, H, t (copper), ins (paper), w (film), grid, gap, rows ([y of each row]) }
    → { def, part, checks, taps: { top, bottom } (where B+ and B− are taken, in the frame of the CORE), z (the place of the flex in the CORE) } */
export function coreBox(o) {
  const stack = o.ins + o.t + o.w, a = FLEX_X0 - DOWN_X, rise = o.H + 2 * stack + FLEX_T, top = o.X - 2 * DOWN_X - FLAP - 1.5, wide = o.Y - 2.4;
  const x = (i) => o.gap + o.grid / 2 + i * o.grid, z = -stack - FLEX_T;
  const spots = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) spots.push({ id: `T${j + 1}${i + 1}`, x: x(i) - FLEX_X0, y: o.rows[j], end: "temp", side: 1, on: `Cellule c${j + 1}${i + 1} — centre du fond, par sa rondelle` });
  spots.push({ id: "VN", x: o.X / 2 - FLEX_X0, y: (o.rows[0] + o.rows[1]) / 2, end: "volt", net: "B−", side: 1, on: "Busbar − du CORE (fenêtre de l'enveloppe)" });
  const branches = [
    { id: "PA", edge: "-X", at: o.Y / 2, w: wide, legs: [{ L: a }, { L: rise, bend: 90 }, { L: top, bend: 90 }], end: "free", tracks: 18, on: "Carte de CORE — le flex continue dans la carte (rigid-flex)" },
    { id: "PB", edge: "+X", at: o.Y / 2, w: wide, legs: [{ L: a }, { L: rise, bend: 90 }, { L: FLAP, bend: 90 }], end: "volt", net: "B+", tabW: 4, side: 1, tracks: 2, on: "Busbar + du CORE (fenêtre de l'enveloppe)" }];
  const def = { name: "Flex en boîte du CORE", t: FLEX_T, cu: 0.035, r: 2, layers: 1, gap: 0.3, core: { L: o.X - 2 * FLEX_X0, W: o.Y }, rigid: null, branches, spots };
  const part = treePart(def, "BM-FLEX-BOX");
  part.name = "Flex en boîte du CORE";
  part.function = "Ramène à la carte les 8 températures du CORE (une CTN sous le centre de chaque cellule) et sa tension (B+ et B−) : livré à plat, il se replie en boîte autour du CORE et de son busbar, jusqu'à poser la carte rigide sur le dessus.";
  part.notes = [...part.notes, "Livré à plat avec ses pré-plis : on pose le CORE et son busbar sur la section centrale, on relève les deux panneaux des petits bouts, puis on rabat la carte rigide sur le busbar +.",
    "Panneaux pleine largeur, même si les pistes n'en demandent pas tant : le pli, l'alignement et la pose des côtés en sont plus sûrs.",
    "Chaque CTN est sous le centre de sa cellule, dans le trou de la plaque − ; sa rondelle thermique la presse contre le godet.",
    "Le panneau X− continue dans la carte rigide (un rigid-flex, plus de joint flex-carte) ; le rabat X+ prend B+ par une fenêtre de l'enveloppe."];
  const pb = tipSpot(def, branches[1], 3, 1).p, toCore = (p) => [p[0] + FLEX_X0, p[1], p[2] + z];
  return { def, part, checks: treeChecks(def), taps: { top: toCore(pb).slice(0, 2), bottom: [o.X / 2, (o.rows[0] + o.rows[1]) / 2] }, z };
}

/** The washer of a thermistor : a disc of thermal pad in the hole of the − plate, between the thermistor and the centre of the can. o : { d, h } */
export function corePuck(o) {
  return { dw: "part/1", id: "BM-PUCK", name: "Rondelle thermique d'une CTN", function: "Remplit le trou de la plaque − sous le centre d'une cellule : elle presse la CTN du flex contre le fond du godet, conduit la chaleur et isole.",
    family: "thermal", process: "purchased", material: "THERMAL-PAD", revision: "A",
    params: { d: { value: o.d, unit: "mm", label: "Diamètre de la rondelle (exemple)", step: 0.1, group: "Rondelle", min: 2, max: 9 }, h: { value: o.h, unit: "mm", label: "Épaisseur posée, CTN dessous (exemple)", step: 0.05, group: "Rondelle", min: 0.5, max: 5 } },
    features: [{ op: "cylinder", id: "rondelle", name: "Rondelle", d: "d", h: "h", at: [0, 0, 0], axis: "Z" }, { op: "interfaces" }], interfaces: [],
    notes: ["Pad thermique silicone chargé, découpé (exemple) : souple, il se déforme autour de la CTN — dessiné posé dessus.",
      "Posée sur la CTN quand le flex est encore à plat ; le trou de la plaque − la centre quand le CORE descend dessus."] };
}
