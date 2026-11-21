/* DesignWizard.ai — BM 8s8p - 21700 : the flex of a CORE, folded in a G (architecture of JP, 21 novembre 2026 : « un PCB flex joint au PCB rigide
   avec des branches qui se replient lors de l'assemblage comme un wrap par le top en forme de G (top, 2 côtés et 2 rabats vers le dessous des
   cellules pour prendre les mesures de température) » ; read : it comes down by the two short ends, in the gaps of 3 mm, 4 NTC per flap, and
   brings B− back). Drawn with the branched flexible circuit of the tool (core/flex_tree.js) : its core lies under the board, on a film of
   adhesive on the + busbar ; at each short end, four fingers — the flap, cut in four so that each one lies flat — leave the core, fold down
   in the gap of 3 mm, fold again under the CORE and run under the − busbar to the cell they watch : a thermistor at 3 mm from the tip, under
   the centre of the cell, its flat face on the busbar. Two more fingers bring B+ (on the + busbar, beside the core) and B− (under the −
   busbar) to the board : the voltage of the CORE. The geometry is in the frame of the CORE ; the core of the flex starts FLEX_X0 from its
   ends. Pure : the definition only — the part is written by treePart. */

import { treePart, treeChecks } from "../core/flex_tree.js";

export const FLEX_T = 0.2, ADH = 0.1, FLEX_X0 = 8, DOWN_X = 0.8;      // film ; adhesive (and the height of a weld tab) ; the core starts 8 mm in ; the descent, 0,8 mm from the end of the CORE

/** The flex of a CORE. o : { X, Y, H, t (copper of the busbars), grid (pitch of the cells), gap (3 mm), rows ([y of each row]) } → { def, part } */
export function coreFlex(o) {
  const a = FLEX_X0 - DOWN_X, drop = o.H + 2 * o.t + 2 * ADH + FLEX_T, x = (i) => o.gap + o.grid / 2 + i * o.grid, cellName = (i, j) => `c${j + 1}${i + 1}`;
  const finger = (edge, i, j, near) => {      // a finger to the cell (i, row j) : beside its axis, toward the end it comes from for the nearer cell
    const fromLow = edge === "-X", dx = fromLow ? x(i) - DOWN_X : o.X - DOWN_X - x(i), y = o.rows[j] + (near ? -4 : 4);
    return { id: `T${fromLow ? "A" : "B"}${j + 1}${near ? 1 : 2}`, edge, at: y, w: 5, legs: [{ L: a }, { L: drop, bend: -90 }, { L: dx + 3, bend: -90 }], end: "temp", side: -1, on: `Cellule ${cellName(i, j)}, sous le busbar −` };
  };
  const branches = [];
  for (const j of [0, 1]) { branches.push(finger("-X", 0, j, true), finger("-X", 1, j, false), finger("+X", 3, j, true), finger("+X", 2, j, false)); }
  const mid = (o.rows[0] + o.rows[1]) / 2;      // between the two rows : the gap of 3 mm, free of fingers
  branches.push({ id: "VP", edge: "-X", at: mid, w: 4, legs: [{ L: 4 }], end: "volt", net: "B+", side: -1, on: "Busbar + du CORE" },
    { id: "VN", edge: "+X", at: mid, w: 4, legs: [{ L: a }, { L: drop, bend: -90 }, { L: 8, bend: -90 }], end: "volt", net: "B−", side: -1, on: "Busbar − du CORE" });
  const def = { name: "Flex en G du CORE", t: FLEX_T, cu: 0.035, r: 2, layers: 1, gap: 0.3, core: { L: o.X - 2 * FLEX_X0, W: o.Y }, rigid: null, branches };
  const part = treePart(def, "BM-FLEX-G");
  part.name = "Flex en G du CORE";
  part.function = "Ramène à la carte les 8 températures du CORE (une CTN sous chaque cellule) et sa tension (B+ et B−) : son cœur sous la carte, ses doigts pliés en G par les deux petits bouts.";
  part.notes = [...part.notes, "Chaque rabat du G est découpé en 4 doigts, un par CTN, pour se poser à plat sous le busbar − ; la CTN est sous le doigt, sa face plate contre le busbar, au droit de l'axe de sa cellule (à 4 mm de côté).",
    "Une couche d'adhésif de 0,1 mm entre le flex et les busbars (dessus et dessous) : la hauteur d'une languette de soudure de prise de tension.",
    "Première itération : la largeur des doigts, le rayon des plis et le passage dans les jeux de 3 mm sont à itérer ; le joint soudé avec la carte rigide (J-FLEX-12) n'est pas dessiné."];
  return { def, part, checks: treeChecks(def) };
}
