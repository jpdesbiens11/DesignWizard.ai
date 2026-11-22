/* DesignWizard.ai — BM 8s8p - 21700 : the flex of the sensors of a CORE, iteration 12 (JP, 22 novembre 2026 : « maybe instead of a punctual
   thermal sensor attached to the flex PCB, there is a way to integrate the thermal measurement into the bottom cell support… a flex PCB that
   slides into the bottom support bracket and reaches for the cell bottom, and the cell sits on top of the sensor location… cone shape but
   part of the flex PCB »).
   What it is : a flat flex that slides into the slot between the bottom support and its clipped plate (demo_bm_holder.js), from the −X end.
   Under the centre of each cell, the film is formed into a CONE that rises through the hole of the floor ; its thermistor sits on the tip and
   touches the bottom of the can — the cell stands on it, a pad of silicone foam under the cone keeps it pressed. One panel, the full width,
   rises at the −X end along the CORE and folds over the top : it carries the 8 temperatures to the board and continues into it (a rigid-flex).
   The voltage of the CORE is no longer taken by the flex : two nickel tabs welded on the layers of the laminated busbar rise to the edge of the
   board (BM-TAP-NI). The LV contacts have their own tails (demo_bm_contacts.js). Drawn with the branched flexible circuit of the tool
   (core/flex_tree.js) ; the cones are formed after the flex is made : the flat pattern has none. Pure : the definitions only. */

import { treePart, treeChecks } from "../core/flex_tree.js";
import { SENSOR_KINDS } from "../core/flex.js";

export const FLEX_T = 0.2, FLEX_X0 = 8, DOWN_X = 0.8, EDGE = 1.2;      // film ; the flex starts 8 mm in ; its panel rises 0.8 mm from the end of the CORE ; it stays 1.2 mm from the long sides (the rims of the plate)
export const NTC_H = SENSOR_KINDS.temp.size[2];
/** The cone under each cell (examples) : its foot, its tip, where the thermistor sits. */
export const CONE = { d: 5, tip: 2.2 };

/** The flex of the sensors of a CORE. o : { X, Y, H, top (the height of the laminated busbar over the cells), floor, grid, gap, rows }
    → { def, part, checks, at (the place of the flex in the CORE), cone (its height) } */
export function coreFlex(o) {
  const W = o.Y - 2 * EDGE, a = FLEX_X0 - DOWN_X, rise = o.H + o.top + o.floor + FLEX_T, over = o.X - DOWN_X - 9, coneH = Math.round((o.floor - NTC_H) * 1000) / 1000;
  const x = (i) => o.gap + o.grid / 2 + i * o.grid, spots = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) spots.push({ id: `T${j + 1}${i + 1}`, x: x(i) - FLEX_X0, y: o.rows[j] - EDGE, end: "temp", side: 1, on: `Cellule c${j + 1}${i + 1} — fond du godet, sur la pointe du cône` });
  const branches = [{ id: "PA", edge: "-X", at: W / 2, w: W - 3, r: 1.2, legs: [{ L: a }, { L: rise, bend: 90 }, { L: over, bend: 90 }], end: "free", tracks: 16, on: "Carte de CORE — le flex continue dans la carte (rigid-flex)" }];
  const def = { name: "Flex des capteurs du CORE", t: FLEX_T, cu: 0.035, r: 2, layers: 1, gap: 0.3, core: { L: o.X - 2 * FLEX_X0, W }, rigid: null, branches, spots };
  const part = treePart(def, "BM-FLEX-BASE");
  /* the cones : formed after the flex is made, each one under its thermistor, which rises with it */
  for (const f of part.features) if (/^sp_t\d+$/.test(f.id) && Array.isArray(f.at)) f.at = [f.at[0], f.at[1], Math.round((f.at[2] + coneH) * 1000) / 1000];
  for (const i of part.interfaces || []) if (/^T\d+$/.test(i.id) && typeof i.level === "number") i.level = Math.round((i.level + coneH) * 1000) / 1000;
  const marker = part.features.findIndex((f) => f.op === "interfaces"), cones = { op: "boss", id: "cones", name: "Cônes formés sous les cellules, chacun portant sa thermistance", face: "+Z", start: FLEX_T, d: CONE.d, tip: CONE.tip, h: coneH, at: spots.map((p) => [p.x, p.y]) };
  part.features.splice(marker < 0 ? part.features.length : marker, 0, cones);
  part.name = "Flex des capteurs du CORE";
  part.function = "Ramène à la carte les 8 températures du CORE : glissé dans la fente du support du bas, il porte sous chaque cellule un cône formé dont la pointe et sa thermistance touchent le fond du godet ; un panneau monte au bout −X et continue dans la carte.";
  part.notes = [...part.notes, "Itération 12 (idée de JP) : le flex glisse dans la fente entre le support du bas et sa plaque clipsée, par le bout −X ; la cellule se pose sur son capteur.",
    `Sous le centre de chaque cellule, le film est formé en cône (Ø${String(CONE.d).replace(".", ",")} au pied, Ø${String(CONE.tip).replace(".", ",")} en tête, ${String(coneH).replace(".", ",")} mm de haut, exemples) : il monte par le trou du fond du support, la thermistance sur sa pointe touche le fond du godet ; une pastille de mousse dans la plaque clipsée le presse.`,
    "Les cônes se forment après la fabrication du flex (formage à chaud d'un polyimide, raidisseur sous la pointe — à voir avec le fabricant du flex) : le développé à plat n'en a pas.",
    "Un seul panneau, pleine largeur, au bout −X : il monte le long du CORE et se rabat sur le busbar laminé, où il continue dans la carte (rigid-flex). La tension du CORE et les signaux LV n'y passent plus : languettes de nickel et queues des contacts LV."];
  return { def, part, checks: treeChecks(def), at: [FLEX_X0, EDGE, -(o.floor + FLEX_T)], cone: coneH };
}
