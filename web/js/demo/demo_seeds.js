/* DynamiteOrbit.ai — the demonstrations whose HISTORY grows from a version to the next : what a copy saved among one's projects is compared to,
   to offer the points it lacks (core/history_demo.js ; JP, 28 novembre 2026 : « où est le concept 5 ? »). A copy is known by the id the store
   gives it — the id of the demonstration, a dash, a time (store.create) — or by its name, a second copy being « … (2) ». The demonstration is
   rebuilt once per visit, when it is first asked for. */

import { bmProject } from "./demo_bm.js";

/** id : the id of the demonstration's project ; name : its name ; make() : the project, rebuilt — the same as its card on the home page opens. */
export const DEMO_SEEDS = [{ id: "bm-8s8p-21700", name: "BM 8s8p - 21700", make: () => bmProject({ branch: "c5" }) }];
/** The demonstration a project is a copy of. → a line of DEMO_SEEDS, or null */
export function seedOf(project) {
  const id = String((project && project.id) || ""), name = String((project && project.name) || "");
  return DEMO_SEEDS.find((d) => id === d.id || id.startsWith(`${d.id}-`) || name === d.name || name.startsWith(`${d.name} (`)) || null;
}
const built = new Map();
/** The demonstration is already rebuilt in this visit. */
export const seedReady = (seed) => built.has(seed.id);
/** The history of a demonstration, rebuilt once per visit. seed : a line of DEMO_SEEDS → its history ({ points, objects }) */
export function seedHistory(seed) { if (!built.has(seed.id)) built.set(seed.id, (seed.make().history) || null); return built.get(seed.id); }
/** A demonstration already rebuilt for its card : kept, so that the history does not rebuild it again. */
export function keepSeed(project) { const s = seedOf(project); if (s && project.history && !built.has(s.id)) built.set(s.id, project.history); }
