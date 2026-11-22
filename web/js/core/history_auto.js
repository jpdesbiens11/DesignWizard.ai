/* DesignOrbit.ai — the AUTOMATIC restore point after an answer of an AI (choice clicked by JP, 20 November 2026 : « des points de restauration
   datés — manuels, et automatiques après chaque import d'une réponse d'IA »). Whatever door the answer came through — the common loop of a
   studio (modules/ai_loop.js) or the door « Avec l'IA » of the Shop (modules/shop_ai.js) —, an answer applied writes a new first line in
   project.aiJournal ; when that line appears, a point « Après l'IA » is posed. An undo, or the opening of a project, only sets what is known.
   Installed once (main.js). The rule of a point is in core/history.js. */

import { store } from "./store.js";
import { addPoint, contextOf, newAiAnswer } from "./history.js";

const top = (p) => (((p && p.aiJournal) || [])[0] || {}).id || null;
export function installHistoryAuto() {
  let seen = null, pid = null;
  store.on("change", (e) => {
    const p = store.project; if (!p) return;
    if (p.id !== pid || (e && e.label === "open")) { pid = p.id; seen = top(p); return; }
    if (e && (e.undo || e.history)) { seen = top(p); return; }
    const a = newAiAnswer(p, seen); if (!a) return; seen = a.id;
    store.writeHistory("Point automatique après une réponse d'IA", (x) => addPoint(x, { kind: "ai", label: `Après l'IA : ${a.ask || "réponse appliquée"}`.slice(0, 120), ai: a.id, context: contextOf(x) }));
  });
}
