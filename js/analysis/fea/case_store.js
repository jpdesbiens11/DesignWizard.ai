/* DynamiteOrbit.ai — the load case of a simulation, kept in the project (demande de JP : « finir On / Off »). The supports, the
   efforts, the zones, the planes, their copies and what is Off lived for the time of a visit : closing the page lost them.
   Now the cases of a part or an assembly are in the file of the project — one entry per document, holding the case IN USE and,
   beside it, the other cases kept under a name (demande de JP : « plusieurs cas de charge nommés par pièce ») :
     project.cases = [{ id (the part or the assembly), name?, kind, cells, fsTarget, fixed, loads, power, fixedT, conv, thermo,
                        cuts, zones, places, placeSeq, sensors, others?: [{ name, …the same keys }], at? }]
   `sensors` : the instruments put on the product (sensors.js) — they are read on a result and change nothing in the calculation.
   `name` is the name of the case in use (« Cas 1 » when nobody named it) ; `at` is its place among the others, so that the list
   keeps its order whichever case is in use. One is always in use — a case is a living document, not a snapshot : what the screen
   changes goes to it, the others wait as they were left. A file written before the names reads as before : one case, « Cas 1 ».
   The screen works on its own copy (its `st`) ; every change is written back as one undoable step, and an undo is read back.
   A case nobody touched is not written : visiting the Simulation does not change the project. Pure : no page, no store. */

const clone = (x) => JSON.parse(JSON.stringify(x));
/** The case of a model nobody has set yet. */
export const blankCase = () => ({ kind: "structure", cells: 3000, fsTarget: 1.5, fixed: [], loads: [], power: [], fixedT: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 }, cuts: [], zones: [], places: {}, placeSeq: 0, sensors: [] });
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
/** Do two states ask the solver for the same thing ? Their instruments may differ : a sensor is read on the result, it is not solved. */
export const sameSolve = (a, b) => JSON.stringify({ ...caseFrom(a), sensors: 0 }) === JSON.stringify({ ...caseFrom(b), sensors: 0 });
/** The case kept for a part or an assembly — a copy, or null. */
export function caseOf(project, id) { const c = ((project && project.cases) || []).find((x) => x.id === id); return c ? clone(c) : null; }
/** Puts a case into the state of the screen (null : a blank one) ; what the state holds besides — its target, its view — is left. */
export function takeCase(st, c) { const b = blankCase(), from = c || {}; for (const k of CASE_KEYS) st[k] = clone(from[k] ?? b[k]); return st; }
/* ---------- several cases under a name : one in use, the others beside it ---------- */
export const FIRST_CASE = "Cas 1";
const tidy = (name) => String(name || "").replace(/\s+/g, " ").trim();
const entryOf = (project, id) => ((project && project.cases) || []).find((x) => x.id === id) || null;
/** The name of the case in use of an entry (« Cas 1 » when nobody named it). */
export const caseName = (entry) => tidy(entry && entry.name) || FIRST_CASE;
/* every case of a document, in the order of its list, each { name, …case } — and the place of the one in use */
function pieces(project, id) {
  const e = entryOf(project, id), others = (e && e.others) || [], k = e && Number.isInteger(e.at) ? Math.max(0, Math.min(others.length, e.at)) : 0, own = (c) => ({ name: tidy(c.name) || FIRST_CASE, ...caseFrom(c) });
  return { all: [...others.slice(0, k).map(own), { name: caseName(e), ...caseFrom(e || {}) }, ...others.slice(k).map(own)], k };
}
/* writes them back : the one in use at the top of the entry, the others beside ; nothing at all for a single blank « Cas 1 » */
function writeList(project, id, all, k) {
  const cur = all[k], others = all.filter((_, i) => i !== k), plain = !others.length && cur.name === FIRST_CASE && isBlankCase(cur);
  const entry = plain ? null : { id, ...(others.length || cur.name !== FIRST_CASE ? { name: cur.name } : {}), ...caseFrom(cur), ...(others.length ? { others: others.map((c) => ({ name: c.name, ...caseFrom(c) })), at: k } : {}) };
  const list = (project.cases || []).slice(), i = list.findIndex((x) => x.id === id);
  if (i >= 0) { if (entry) list[i] = entry; else list.splice(i, 1); } else if (entry) list.push(entry);
  if (list.length) project.cases = list; else delete project.cases;
}
/** Writes the case IN USE of `id` in the project, as the screen has it : in its place, or added — or taken away when nothing is
    left of it (a single case, without a name, with nothing set). Its name and the other cases of the document are kept. The cases
    of parts and assemblies that are gone leave with them. → true when the project changed. */
export function withCase(project, id, st) {
  const before = JSON.stringify(project.cases || []), there = new Set([...(project.parts || []), ...(project.assemblies || [])].map((x) => x.id));
  if (project.cases) project.cases = project.cases.filter((x) => there.has(x.id) || x.id === id);
  const { all, k } = pieces(project, id); all[k] = { name: all[k].name, ...caseFrom(st) };
  writeList(project, id, all, k);
  return JSON.stringify(project.cases || []) !== before;
}
/** The cases a part or an assembly keeps, in their order : [{ name, on (the one in use), note }]. A document nobody set has one,
    « Cas 1 ». st : the state of the screen, when given — the note of the case in use is then that of the screen. */
export function caseList(project, id, st) { const { all, k } = pieces(project, id); return all.map((c, i) => ({ name: c.name, on: i === k, note: caseNote(i === k && st ? st : c) })); }
/** A name nobody uses yet : « Cas 3 ». */
export function freshCaseName(list) { const names = new Set((list || []).map((c) => c.name)); let n = (list || []).length + 1; while (names.has(`Cas ${n}`)) n++; return `Cas ${n}`; }
/** Can a case take this name ? → the name, tidied — or null when it is empty or taken (by another case than `except`). */
export function caseNameFree(project, id, name, except) { const n = tidy(name); return n && !pieces(project, id).all.some((c) => c.name === n && c.name !== except) ? n : null; }
/** A new case under `name`, a COPY of the one in use as the screen has it : it comes in use, right after the one it was copied
    from, which is kept as it was. Nothing changes on the screen but the name. → the name given, or null (empty, or taken). */
export function addCase(project, id, st, name) {
  const n = caseNameFree(project, id, name); if (!n) return null;
  const { all, k } = pieces(project, id); all[k] = { name: all[k].name, ...caseFrom(st) }; all.splice(k + 1, 0, { name: n, ...caseFrom(st) });
  writeList(project, id, all, k + 1); return n;
}
/** Brings the case `name` in use : the one in use goes beside, as the screen has it, at its place of the list.
    → the case to put on the screen (a copy), or null when there is no such case aside. */
export function useCase(project, id, st, name) {
  const { all, k } = pieces(project, id), j = all.findIndex((c, i) => i !== k && c.name === name); if (j < 0) return null;
  all[k] = { name: all[k].name, ...caseFrom(st) }; writeList(project, id, all, j);
  return caseFrom(all[j]);
}
/** Renames a case, in use or aside. → true when it was renamed. */
export function renameCase(project, id, st, from, to) {
  const n = caseNameFree(project, id, to, from), { all, k } = pieces(project, id), j = all.findIndex((c) => c.name === from); if (!n || j < 0 || n === from) return false;
  all[k] = { name: all[k].name, ...caseFrom(st) }; all[j].name = n; writeList(project, id, all, k); return true;
}
/** Takes a case away. Aside : the screen keeps its case. In use : the next of the list comes in use (the one before, for the last) ;
    the only case of a document is emptied instead — a document always has a case.
    → { gone: true, take: the case to put on the screen, or null when the screen keeps its own } — or null when there is no such case. */
export function dropCase(project, id, st, name) {
  const { all, k } = pieces(project, id), j = all.findIndex((c) => c.name === name); if (j < 0) return null;
  all[k] = { name: all[k].name, ...caseFrom(st) };
  if (all.length === 1) { writeList(project, id, [{ name: FIRST_CASE, ...blankCase() }], 0); return { gone: true, take: blankCase() }; }
  all.splice(j, 1); const now = j === k ? Math.min(j, all.length - 1) : j < k ? k - 1 : k;
  writeList(project, id, all, now); return { gone: true, take: j === k ? caseFrom(all[now]) : null };
}
/** « 2 appuis · 1 effort (1 à Off) · 1 zone · 1 plan » : what a kept case holds, for a list or a note. */
export function caseNote(c) {
  if (!c) return "";
  const part = (list, one, many) => { const n = (list || []).length, off = (list || []).filter((x) => x && x.off).length; return n ? `${n} ${n > 1 ? many : one}${off ? ` (${off} à Off)` : ""}` : ""; };
  return [part(c.fixed, "appui", "appuis"), part(c.loads, "effort", "efforts"), part(c.power, "source", "sources"), part(c.fixedT, "température", "températures"), part(c.zones, "zone", "zones"), part(c.cuts, "plan", "plans"), ...[["temp", "capteur", "capteurs"], ["gauge", "jauge", "jauges"]].map(([k, one, many]) => part((c.sensors || []).filter((s) => s && s.kind === k), one, many))].filter(Boolean).join(" · ");
}
