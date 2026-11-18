/* DesignWizard.ai — the load case of a simulation, kept in the project (demande de JP : « finir On / Off »). The supports, the
   efforts, the zones, the planes, their copies and what is Off lived for the time of a visit : closing the page lost them.
   Now there is one case per part or assembly, in the file of the project :
     project.cases = [{ id (the part or the assembly), kind, cells, fsTarget, fixed, loads, power, fixedT, conv, thermo,
                        cuts, zones, places, placeSeq }]
   The screen works on its own copy (its `st`) ; every change is written back as one undoable step, and an undo is read back.
   A case nobody touched is not written : visiting the Simulation does not change the project. Pure : no page, no store. */

const clone = (x) => JSON.parse(JSON.stringify(x));
/** The case of a model nobody has set yet. */
export const blankCase = () => ({ kind: "structure", cells: 3000, fsTarget: 1.5, fixed: [], loads: [], power: [], fixedT: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 }, cuts: [], zones: [], places: {}, placeSeq: 0 });
export const CASE_KEYS = Object.keys(blankCase());

/** The case a screen state holds, as it is written : a copy, without the working marks of the screen — what a place was found to
    be on the mesh (`region`), and whether the geometry still has it (`gone`) are worked out again at each visit. */
export function caseFrom(st) {
  const b = blankCase(), c = {};
  for (const k of CASE_KEYS) if (k !== "places") c[k] = clone(st[k] ?? b[k]);
  c.places = Object.fromEntries(Object.entries(st.places || {}).map(([k, p]) => [k, clone({ ...p, region: undefined, gone: undefined })]));
  return Object.fromEntries(CASE_KEYS.map((k) => [k, c[k]]));
}
/** Nothing was set : no condition, no zone, no plane, and the settings as they come. */
export const isBlankCase = (st) => JSON.stringify(caseFrom(st)) === JSON.stringify(blankCase());
/** Do two states hold the same case ? */
export const sameCase = (a, b) => JSON.stringify(caseFrom(a)) === JSON.stringify(caseFrom(b));
/** The case kept for a part or an assembly — a copy, or null. */
export function caseOf(project, id) { const c = ((project && project.cases) || []).find((x) => x.id === id); return c ? clone(c) : null; }
/** Puts a case into the state of the screen (null : a blank one) ; what the state holds besides — its target, its view — is left. */
export function takeCase(st, c) { const b = blankCase(), from = c || {}; for (const k of CASE_KEYS) st[k] = clone(from[k] ?? b[k]); return st; }
/** Writes the case of `id` in the project : in its place, or added — or taken away when nothing is left of it. The cases of parts
    and assemblies that are gone leave with them. → true when the project changed. */
export function withCase(project, id, st) {
  const before = JSON.stringify(project.cases || []), there = new Set([...(project.parts || []), ...(project.assemblies || [])].map((x) => x.id));
  const mine = isBlankCase(st) ? null : { id, ...caseFrom(st) }, list = (project.cases || []).filter((x) => there.has(x.id) || x.id === id);
  const at = list.findIndex((x) => x.id === id);
  if (at >= 0) { if (mine) list[at] = mine; else list.splice(at, 1); } else if (mine) list.push(mine);
  if (list.length) project.cases = list; else delete project.cases;
  return JSON.stringify(project.cases || []) !== before;
}
/** « 2 appuis · 1 effort (1 à Off) · 1 zone · 1 plan » : what a kept case holds, for a list or a note. */
export function caseNote(c) {
  if (!c) return "";
  const part = (list, one, many) => { const n = (list || []).length, off = (list || []).filter((x) => x && x.off).length; return n ? `${n} ${n > 1 ? many : one}${off ? ` (${off} à Off)` : ""}` : ""; };
  return [part(c.fixed, "appui", "appuis"), part(c.loads, "effort", "efforts"), part(c.power, "source", "sources"), part(c.fixedT, "température", "températures"), part(c.zones, "zone", "zones"), part(c.cuts, "plan", "plans")].filter(Boolean).join(" · ");
}
