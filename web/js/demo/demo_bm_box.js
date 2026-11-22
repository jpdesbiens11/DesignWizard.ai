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
   core, its branches, its spots). Iteration 5 : the washers are molded in the bottom holder (demo_bm_holder.js, coreBase) ; under the cans,
   its floor replaces the paper. Pure : the definitions only — the parts are written by treePart. */

import { treePart, treeChecks, tipSpot } from "../core/flex_tree.js";
import { SENSOR_KINDS } from "../core/flex.js";

export const FLEX_T = 0.2, FLEX_X0 = 8, DOWN_X = 0.8, FLAP = 8;      // film ; the central section starts 8 mm in ; the panels rise 0.8 mm from the end of the CORE ; the flap of the B+ side
export const NTC_H = SENSOR_KINDS.temp.size[2];
/** The bend radius of a tail : it wraps the rounded edge of the − conductor (ROUND of the laminated busbar, + the film) — over 6 × its thickness, the static bend of a single-layer flex. */
export const TAIL_R = 1.9;      // the height of a thermistor on the flex, under its washer

/** The flex of a CORE. o : { X, Y, H, t (copper), ins (paper), w (film), floor (of the bottom holder ; 0 : the paper is under the cans), grid, gap, rows ([y of each row]) }
    → { def, part, checks, taps: { top, bottom } (where B+ and B− are taken, in the frame of the CORE), z (the place of the flex in the CORE) } */
export function coreBox(o) {
  const above = o.ins + o.t + o.w, below = (o.floor > 0 ? o.floor : o.ins) + o.t + o.w, a = FLEX_X0 - DOWN_X, rise = o.H + above + below + FLEX_T, top = o.X - 2 * DOWN_X - FLAP - 1.5, wide = o.Y - 2.4;
  const x = (i) => o.gap + o.grid / 2 + i * o.grid, z = -below - FLEX_T;
  const spots = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) spots.push({ id: `T${j + 1}${i + 1}`, x: x(i) - FLEX_X0, y: o.rows[j], end: "temp", side: 1, on: `Cellule c${j + 1}${i + 1} — centre du fond, par sa rondelle` });
  spots.push({ id: "VN", x: o.X / 2 - FLEX_X0, y: (o.rows[0] + o.rows[1]) / 2, end: "volt", net: "B−", side: 1, on: "Busbar − du CORE (fenêtre de l'enveloppe)" });
  const branches = [
    { id: "PA", edge: "-X", at: o.Y / 2, w: wide, legs: [{ L: a }, { L: rise, bend: 90 }, { L: top, bend: 90 }], end: "free", tracks: 18, on: "Carte de CORE — le flex continue dans la carte (rigid-flex)" },
    { id: "PB", edge: "+X", at: o.Y / 2, w: wide, legs: [{ L: a }, { L: rise, bend: 90 }, { L: FLAP, bend: 90 }], end: "volt", net: "B+", tabW: 4, side: 1, tracks: 2, on: "Busbar + du CORE (fenêtre de l'enveloppe)" }];
  /* iteration 9 : a tail from each long edge of the central section up the outer face of each leg, to the bottom of each LV island — the 4 signals
     of the chain (RS-485 A and B, +5V_ISO, GND_ISO) on both legs, carried to the board through the section and the panel X− */
  for (const c of o.lv || []) for (const [edge, side] of [["+Y", "p"], ["-Y", "m"]]) branches.push({ id: `L${side.toUpperCase()}${c.mark}`, edge, at: c.x - FLEX_X0, w: 3, r: TAIL_R,
    legs: [{ L: o.ins + o.t + FLEX_T / 2 }, { L: c.z - 5.2 - (z + FLEX_T / 2), bend: 90 }], end: "free", net: c.net, tracks: 1, on: `Îlot ${c.net} de la jambe ${side === "p" ? "+" : "−"} — brasé sur la languette de sa plage` });
  if (o.lv && o.lv.length) branches[0].tracks += 2 * o.lv.length;
  const def = { name: "Flex en boîte du CORE", t: FLEX_T, cu: 0.035, r: 2, layers: 1, gap: 0.3, core: { L: o.X - 2 * FLEX_X0, W: o.Y }, rigid: null, branches, spots };
  const part = treePart(def, "BM-FLEX-BOX");
  part.name = "Flex en boîte du CORE";
  part.function = "Ramène à la carte les 8 températures du CORE (une CTN sous le centre de chaque cellule) et sa tension (B+ et B−) : livré à plat, il se replie en boîte autour du CORE et de son busbar, jusqu'à poser la carte rigide sur le dessus.";
  part.notes = [...part.notes, "Livré à plat avec ses pré-plis : on pose le CORE et son busbar sur la section centrale, on relève les deux panneaux des petits bouts, puis on rabat la carte rigide sur le busbar +.",
    "Panneaux pleine largeur, même si les pistes n'en demandent pas tant : le pli, l'alignement et la pose des côtés en sont plus sûrs.",
    "Chaque CTN est sous le centre de sa cellule, dans le trou de la plaque − ; la rondelle thermique moulée dans le support du bas la presse contre le godet.",
    "Le panneau X− continue dans la carte rigide (un rigid-flex, plus de joint flex-carte) ; le rabat X+ prend B+ par une fenêtre de l'enveloppe.",
    ...(o.lv && o.lv.length ? [`Itération 9 : ${2 * o.lv.length} queues montent des grands côtés de la section centrale, contre la face extérieure de chaque jambe, jusqu'au bas de chaque îlot LV — les ${o.lv.length} signaux de la chaîne des deux côtés. Elles passent dans l'écart de 1,7 mm entre deux CORE, chacune contre sa jambe ; le bout de la queue se brase sur la languette de la plage, qui sort de l'insert par une encoche (non dessinée). Les deux connecteurs de chaîne de la carte deviennent ces pistes : à reporter dans le PCBA.`] : [])];
  const pb = tipSpot(def, branches[1], 3, 1).p, toCore = (p) => [p[0] + FLEX_X0, p[1], p[2] + z];
  return { def, part, checks: treeChecks(def), taps: { top: toCore(pb).slice(0, 2), bottom: [o.X / 2, (o.rows[0] + o.rows[1]) / 2] }, z };
}
