/* DynamiteOrbit.ai — the central BMS board of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central interroge les cartes,
   juge et agit — contactors, état envoyé au véhicule ») : fed by the 12 V of the vehicle, it polls the 8 CORE boards on the isolated RS-485
   chain (it feeds their bus side), reads the current of the module on a sensor laid on the return busbar, drives the contactor and reads its
   auxiliary contact back, and tells the vehicle the state of the module on CAN. From its functions down to its routed copper. Stored as .dwiz
   text (tools/gen_demo_bms.mjs writes it), read back here. */

import { fromDwiz } from "../core/dwiz.js";
import { DEMO_BMS_1 } from "./demo_bms_data.js";
import { DEMO_BMS_2 } from "./demo_bms_data2.js";

export const BMS_BOARD_ID = "BMS-CENTRAL-PCBA";
/** A fresh copy of the board. */
export function bmsBoard() {
  const d = fromDwiz(DEMO_BMS_1 + DEMO_BMS_2), board = Array.isArray(d) ? d[0] : d;
  for (const t of board.tracks || []) t.auto = true;
  for (const v of board.vias || []) v.auto = true;
  return board;
}
