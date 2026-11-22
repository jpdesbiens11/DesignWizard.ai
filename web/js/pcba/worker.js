/* DesignOrbit.ai — PCBA: the long jobs — floor plan, placement, routing — run here, off the page. The board comes in,
   the same board goes back with its zones, positions or copper, and what the job has to say. */

import { LIBRARY } from "./library.js";
import { floorplan, placeParts } from "./place.js";
import { autoroute, clearRoutes } from "./route.js";
import { moveGroup, pruneCopper } from "./move.js";

self.onmessage = (e) => {
  const { id, cmd, board, opts = {} } = e.data;
  try {
    let info = {};
    if (cmd === "floorplan") info = floorplan(board, LIBRARY, opts);
    else if (cmd === "place") { clearRoutes(board); info = placeParts(board, LIBRARY, opts); }
    else if (cmd === "route") info = autoroute(board, LIBRARY, { ...opts, onProgress: (p) => self.postMessage({ id, progress: p }) });
    else if (cmd === "move") {                                  // a brick moves, then the board reconnects itself : one job, one undo step
      const m = moveGroup(board, LIBRARY, opts.refs || [], opts);
      if (m.refused) throw new Error(m.refused);
      const r = m.nets.length ? autoroute(board, LIBRARY, { maxMs: 20000, passes: 2, ...(opts.route || {}), nets: m.nets, keep: true, onProgress: (p) => self.postMessage({ id, progress: p }) }) : { routed: 0, total: 0, open: 0, failed: [], complete: true, ms: 0 };
      pruneCopper(board, LIBRARY, m.nets);
      info = { ...m, route: r };
    }
    else throw new Error(`Commande inconnue « ${cmd} ».`);
    self.postMessage({ id, ok: true, board, info });
  } catch (err) { self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) }); }
};
