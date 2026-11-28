/* DynamiteOrbit.ai — the points a DEMONSTRATION has gained since a copy of it was saved (JP, 28 novembre 2026, on the history of his « BM
   8s8p - 21700 », stopped at P8 : « où est le concept 5 ? … met à jour l'historique pour plus de clarté » ; by menu : « Proposer, aperçu
   d'abord »). A demonstration is rebuilt from the code at every version ; a copy saved among the person's projects keeps the history it had
   that day. When the demonstration has points the copy lacks — posed after the last point both have —, they are offered : each keeps its
   branch and hangs from the point of the copy that IS the same point of the demonstration ; nothing of the copy moves — its points,
   « vous êtes ici », what changed since.
   Which point is « the same » : a point of a demonstration is dated by hand, once, and signed (`at`, `by`) — that is its identity. Its content
   is not : the older points of a demonstration are rebuilt by the tool of the day, and what the tool writes into a part or a board drifts from
   a version to the next (measured : a copy made at v0.200 differs from today's on 8 artefacts of every point, labels and dates equal). The
   preview says when the point it hangs from has drifted ; the copy's point stays as it is.
   What it follows : fetching the new commits of a remote in a version-control client — they come beside one's own work, one's branch and
   working copy do not move ; one goes to them when one chooses. Pure : no page, no store. The seed is the history of the demonstration project. */

import { MAIN, branchNames, historyOf, pointOf, childrenOf } from "./history.js";
import { keyer } from "./history_branches.js";

/** The identity of a point of a demonstration : its date, its author, its kind. */
export const demoKey = (p) => `${(p && p.at) || ""}|${(p && p.by) || ""}|${(p && p.kind) || "manual"}`;
const byN = (a, b) => (a.n || 0) - (b.n || 0);
const freeIn = (used, want) => { const clean = String(want || "Branche").replace(/\s+/g, " ").trim().slice(0, 40) || "Branche"; if (!used.has(clean) && clean !== MAIN) return clean; let n = 2; while (used.has(`${clean} (${n})`)) n++; return `${clean} (${n})`; };

/** What the demonstration has that this history lacks. h : the history of the copy ; seed : the history of the demonstration, rebuilt.
    → { fresh: [{ seed, id, n, parent, branch, label, at, by, onto }], anchors: [{ seed, mine, label, drift }], present, last, none, nothing }
    fresh : the points to add, in their order — `seed` their id in the demonstration, `id` the one they get here, `parent` the point here they
    hang from, `onto` how it was found : "same" (the same point), "fresh" (a point added with them), "ancestor" (the same point as an older one ;
    the one between is not in the copy), "root" (nothing in common : the first point of the copy — to be checked) ; anchors : the points of the
    copy that new points hang from, `drift` true when their content is no longer the demonstration's ; present : how many points both have ;
    last : the most recent of them (an id of the copy) ; none : the copy shares no point with the demonstration (not a copy of it). */
export function demoPlan(h, seed) {
  const mine = [...((h && h.points) || [])].sort(byN), S = [...((seed && seed.points) || [])].sort(byN), out = { fresh: [], anchors: [], present: 0, last: null, none: true, nothing: true };
  if (!mine.length || !S.length) return out;
  const byKey = new Map(); for (const p of mine) if (!byKey.has(demoKey(p))) byKey.set(demoKey(p), p);
  const present = new Map(S.filter((q) => byKey.has(demoKey(q))).map((q) => [q.id, byKey.get(demoKey(q))]));
  if (!present.size) return out;
  const lastSeed = S.filter((q) => present.has(q.id)).reduce((a, q) => (String(q.at) > String(a.at) ? q : a)), seedOf = new Map(S.map((q) => [q.id, q]));
  Object.assign(out, { none: false, present: present.size, last: present.get(lastSeed.id).id });
  const seedNames = branchNames(seed), names = branchNames(h), used = new Set(names.values()), decided = new Map(), added = new Map(), continued = new Set();
  let n = mine.reduce((m, p) => Math.max(m, p.n || 0), 0);
  const anchors = new Map();
  for (const q of S.filter((x) => !present.has(x.id) && String(x.at) > String(lastSeed.at))) {
    let parent = null, onto = "root", from = null;
    for (let s = q.parent, seen = new Set(); s && !seen.has(s); s = seedOf.get(s) && seedOf.get(s).parent) {
      seen.add(s);
      if (added.has(s)) { parent = added.get(s); onto = "fresh"; break; }
      if (present.has(s)) { parent = present.get(s).id; from = s; onto = s === q.parent ? "same" : "ancestor"; break; }
    }
    if (!parent) parent = mine[0].id;
    const sb = seedNames.get(q.id) || MAIN; let branch = decided.get(sb);
    if (!branch) {
      const anchorName = names.get(parent), tip = onto === "same" && !childrenOf(h, parent).length && !continued.has(parent);      // the copy's branch ends there : the demonstration continues it
      branch = tip && seedNames.get(q.parent) === sb && anchorName ? anchorName : freeIn(used, sb);
      decided.set(sb, branch); used.add(branch);
    }
    continued.add(parent); n += 1; const id = `P${n}`; added.set(q.id, id);
    out.fresh.push({ seed: q.id, id, n, parent, branch, label: q.label, at: q.at, by: q.by || "", onto });
    if (from && !anchors.has(from)) anchors.set(from, present.get(from));
  }
  const kMine = keyer(h.objects), kSeed = keyer(seed.objects);
  out.anchors = [...anchors.entries()].map(([s, p]) => ({ seed: s, mine: p.id, label: p.label, drift: kMine(p.tree) !== kSeed(seedOf.get(s).tree) }));
  out.nothing = !out.fresh.length;
  return out;
}

/** Add the points of the plan to the copy : each with its branch, its parent, its journal, its tree — the texts of its artefacts stored once.
    « Vous êtes ici » and the product do not move. o : { when (ISO) } → the points added */
export function addDemoPoints(project, seed, plan, o = {}) {
  const h = historyOf(project), seedOf = new Map(((seed && seed.points) || []).map((q) => [q.id, q])), ids = new Map(plan.fresh.map((f) => [f.seed, f.id])), when = o.when || new Date().toISOString(), out = [];
  for (const f of plan.fresh) {
    const q = seedOf.get(f.seed); if (!q || pointOf(h, f.id)) continue;
    for (const [, fp] of q.tree || []) if (fp && !(fp in h.objects) && seed.objects[fp] !== undefined) h.objects[fp] = seed.objects[fp];
    const merged = q.merged && (ids.get(q.merged) || null);
    const point = { id: f.id, n: f.n, parent: f.parent, branch: f.branch, at: q.at, kind: q.kind || "manual", label: q.label, ...(merged ? { merged } : {}), ...(q.note ? { note: q.note } : {}), ...(q.by ? { by: q.by } : {}),
      ...(q.context ? { context: q.context } : {}), journal: (q.journal || []).slice(), tree: (q.tree || []).map(([k, fp]) => [k, fp]), demo: when };
    h.points.push(point); out.push(point);
  }
  return out;
}

/** The plan in a few words : « 3 points nouveaux — concept 5 - U handle and asymmetric cams, P9 à P11 ». */
export function demoLine(plan) {
  const F = (plan && plan.fresh) || []; if (!F.length) return "";
  const br = [...new Set(F.map((f) => f.branch))], ns = F.map((f) => f.n), run = ns.every((x, i) => !i || x === ns[i - 1] + 1);
  const ids = F.length === 1 ? F[0].id : run ? `${F[0].id} à ${F.at(-1).id}` : F.map((f) => f.id).join(", ");
  return `${F.length} point${F.length > 1 ? "s nouveaux" : " nouveau"} — ${br.join(", ")}, ${ids}`;
}
