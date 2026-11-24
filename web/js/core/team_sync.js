/* DynamiteOrbit.ai — reading the mirrors where they live. Each member keeps their mirror in their own storage ; when that
   storage is a Drive, a member's entry in the team carries the id of their file (`mirror`). Whoever was given the right
   to read that file can then fetch every mirror in one go and see, before anything is applied, what each would bring.
   The reader is injected (`read(id) → text`) : this module knows nothing of Google, and is tested without network. */

import { fromDwiz } from "./dwiz.js";
import { mergeMirror, teamOf } from "./team.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

/** The project a mirror file holds. Throws when the text is not the mirror of a member. */
export function parseMirror(text) {
  const t = String(text || ""); let d;
  try { d = /^\s*\{/.test(t) ? JSON.parse(t) : fromDwiz(t); } catch (e) { throw new Error("Ce fichier ne se lit pas comme un projet DynamiteOrbit.ai."); }
  if (Array.isArray(d)) d = d[0];
  if (!d || !d.team || !d.team.owner) throw new Error("Ce fichier n'est pas le miroir d'un membre : il ne dit pas à qui il est.");
  return d;
}
/** The mirrors I know where to find : [{ handle, id }], mine left out. */
export const linksOf = (project, me) => ((project.team && project.team.members) || []).filter((m) => m.handle !== me && m.mirror).map((m) => ({ handle: m.handle, id: m.mirror }));
/** Remembers where a member's mirror is. */
export function linkMirror(project, handle, id) { const m = teamOf(project).members.find((x) => x.handle === handle); if (!m || !id) return false; m.mirror = id; return true; }

/** Reads every mirror I know where to find and merges them, in order, into a COPY of the project.
    → { results: [{ handle, id, state, error, theirs, report }], dry (the copy, as the project would be) }
    state : "ok" · "denied" (this account may not read the file yet : the person must point at it once) ·
            "other" (the file is someone else's mirror) · "error" */
export async function readMirrors(project, me, read, date) {
  const dry = clone(project), results = [];
  for (const l of linksOf(project, me)) {
    let text;
    try { text = await read(l.id); } catch (e) { results.push({ ...l, state: e && (e.status === 403 || e.status === 404) ? "denied" : "error", error: (e && e.message) || String(e) }); continue; }
    try {
      const theirs = parseMirror(text);
      if (theirs.team.owner !== l.handle) results.push({ ...l, state: "other", error: `Ce fichier est le miroir de @${theirs.team.owner}, pas celui de @${l.handle}.` });
      else results.push({ ...l, state: "ok", theirs, report: mergeMirror(dry, theirs, me, date) });
    } catch (e) { results.push({ ...l, state: "error", error: e.message }); }
  }
  return { results, dry };
}
/** Applies what readMirrors read, in the same order. Mutates the project ; the caller makes it one undoable step. → the reports. */
export const applyMirrors = (project, results, me, date) => results.filter((r) => r.state === "ok").map((r) => mergeMirror(project, r.theirs, me, date));
/** True when at least one mirror read brings something. */
export const bringsSomething = (results) => results.some((r) => r.state === "ok" && !r.report.nothing);
