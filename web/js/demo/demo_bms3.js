/* DynamiteOrbit.ai — the central BMS board 3 in × 3 in of the module BM 8s8p (JP, 25 novembre 2026 : « une nouvelle carte BMS de 3 po × 3 po
   au plus, au fond du BM dans le couvercle du bas, avec le connecteur et le raccord des busbars vers les CORE… la chaîne RS-485 des CORE est
   collectée par cette carte ; l'extérieur communique et prend ou envoie l'énergie, gérée et autorisée par elle ; en cas d'urgence elle ouvre
   le contacteur au bout du BM »). Choix de JP, par menu : CAN FD isolé ; contacteur + précharge + pyrofusible ; shunt sur la barre de retour ;
   le module ou le 12 V, le premier présent ; puis le connecteur d'échange monté sur la carte (la place dans le couvercle : itération suivante).
   It stands beside the 85 × 62 mm board of iteration 14, which concept 2 houses. Stored as .dwiz text (tools/gen_demo_bms3.mjs writes it). */

import { fromDwiz } from "../core/dwiz.js";
import { DEMO_BMS3_1 } from "./demo_bms3_data.js";
import { DEMO_BMS3_2 } from "./demo_bms3_data2.js";

export const BMS3_BOARD_ID = "BMS-CENTRAL-3X3";
/** A fresh copy of the board. */
export function bms3Board() {
  const d = fromDwiz(DEMO_BMS3_1 + DEMO_BMS3_2), board = Array.isArray(d) ? d[0] : d;
  for (const t of board.tracks || []) t.auto = true;
  for (const v of board.vias || []) v.auto = true;
  return board;
}
