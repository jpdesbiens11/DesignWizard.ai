/* DesignOrbit.ai — the first board of the Labo (point 4 of the roadmap : « une pile, deux boutons, une DEL rouge et une DEL jaune ») : a coin
   cell, and two buttons that light their LED by themselves. Its copper is written by tools/gen_demo_first.mjs (demo_first_data.js). */
import { fromDwiz } from "../core/dwiz.js";
import { DEMO_FIRST } from "./demo_first_data.js";

export const FIRST_BOARD_ID = "FIRST-PCBA";
/** The board, as a new document : its tracks and vias marked as routed by the tool, so they can be routed again. */
export function firstBoard() {
  const d = fromDwiz(DEMO_FIRST), b = Array.isArray(d) ? d[0] : d;
  for (const t of b.tracks || []) t.auto = true;
  for (const v of b.vias || []) v.auto = true;
  return b;
}
