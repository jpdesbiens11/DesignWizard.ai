/* DesignOrbit.ai — the RS-485 example board : a small measuring node that answers on an RS-485 bus (demande de JP : « la
   fonction "communication" RS-485 avec un exemple concret : pièce, connecteur, traces, signaux et contribution au code
   logiciel »). The whole link on one board — terminal block, suppressor and series resistors, termination, bias, the
   transceiver, the three pins of the microcontroller — from its functions down to its routed copper. Stored as .dwiz text
   (tools/gen_demo_rs485.mjs writes it), read back here. */

import { fromDwiz } from "../core/dwiz.js";
import { DEMO_RS485 } from "./demo_rs485_data.js";

export const RS485_BOARD_ID = "NODE-485-PCBA";
/** A fresh copy of the example board. */
export function rs485Board() {
  const d = fromDwiz(DEMO_RS485), board = Array.isArray(d) ? d[0] : d;
  for (const t of board.tracks || []) t.auto = true;
  for (const v of board.vias || []) v.auto = true;
  return board;
}
