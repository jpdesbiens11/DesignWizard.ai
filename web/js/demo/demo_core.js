/* DynamiteOrbit.ai — the CORE board example : the small board laid on the top of a CORE of 8 cells 21700 in parallel (architecture de
   JP, 21 novembre 2026 : une carte par CORE, posée sur son dessus et de sa taille ; RS-485 isolé vers le BMS central, côté bus alimenté
   par le faisceau ; équilibrage passif ; les 8 CTN sur les rabats d'un flex replié en G). From its functions down to its routed copper.
   Stored as .dwiz text (tools/gen_demo_core.mjs writes it), read back here. */

import { fromDwiz } from "../core/dwiz.js";
import { DEMO_CORE_1 } from "./demo_core_data.js";
import { DEMO_CORE_2 } from "./demo_core_data2.js";

export const CORE_BOARD_ID = "CORE-1S8P-PCBA";
/** A fresh copy of the example board. */
export function coreBoard() {
  const d = fromDwiz(DEMO_CORE_1 + DEMO_CORE_2), board = Array.isArray(d) ? d[0] : d;
  for (const t of board.tracks || []) t.auto = true;
  for (const v of board.vias || []) v.auto = true;
  return board;
}
