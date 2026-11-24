/* DynamiteOrbit.ai — the demonstration board : the control board of the compact drive, designed from its functions
   (supply, compute, communicate, measure, signal, be testable) down to its routed copper. It is stored as .dwiz text —
   the format an engineer, a shop and an AI read the same way — and read back here. */

import { fromDwiz } from "../core/dwiz.js";
import { DEMO_PCBA_DESIGN } from "./demo_pcba_data.js";
import { DEMO_PCBA_COPPER } from "./demo_pcba_copper.js";

/** A fresh copy of the demonstration board ; without the mechanical part it loses its link to it. */
export function demoBoard(part = true) {
  const d = fromDwiz(`${DEMO_PCBA_DESIGN}\n${DEMO_PCBA_COPPER}`), board = Array.isArray(d) ? d[0] : d;
  for (const t of board.tracks || []) t.auto = true;
  for (const v of board.vias || []) v.auto = true;
  if (!part) delete board.part;
  return board;
}
