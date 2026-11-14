/* DesignWizard.ai — PCBA: the long jobs — floor plan, placement, routing — run here, off the page. The board comes in,
   the same board goes back with its zones, positions or copper, and what the job has to say. */

import { LIBRARY } from "./library.js";
import { floorplan, placeParts } from "./place.js";
import { autoroute, clearRoutes } from "./route.js";

self.onmessage = (e) => {
  const { id, cmd, board, opts = {} } = e.data;
  try {
    let info = {};
    if (cmd === "floorplan") info = floorplan(board, LIBRARY, opts);
    else if (cmd === "place") { clearRoutes(board); info = placeParts(board, LIBRARY, opts); }
    else if (cmd === "route") info = autoroute(board, LIBRARY, { ...opts, onProgress: (p) => self.postMessage({ id, progress: p }) });
    else throw new Error(`Commande inconnue « ${cmd} ».`);
    self.postMessage({ id, ok: true, board, info });
  } catch (err) { self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) }); }
};
