/* DynamiteOrbit.ai — the BRANCHES of the history : drawn side by side with MAIN in the centre, a branch merged into MAIN in ONE block, and the
   work of a teammate read from their file as a branch of its own (demande de JP, 21 novembre 2026 : « faire des branches visuellement en
   parallèle et de pouvoir les merger ensemble au MAIN (la branche du centre)… des designs différents en équipe en parallèle (même si
   certaines pièces ne sont pas dans certaines variantes… elle apparaît en grisé et est désactivée mais on peut l'activer) » ; choices
   clicked the same day : the whole branch in one block ; a part that the side that wins does not have enters greyed, at Off, activatable).
   What it follows : the branches of a version-control client — a main line that is always there and named, side branches that leave it and
   come back through a merge point —, and its three-way merge, done here per ARTEFACT. The base of a branch is where it left MAIN, or its
   last point already merged. What the branch changed since its base is taken from the branch, whole ; what it did not touch stays as MAIN
   has it. When both changed the same artefact, the branch wins (JP's choice) and the preview names what MAIN loses. Nothing is deleted by a
   merge : an artefact the branch took out stays in MAIN ; an instance that MAIN's assembly has and the branch's lacks comes back at Off,
   with its mates, ready to be switched on. Pure : no page, no store. The naming of branches is in core/history.js. */

import { MAIN, pointOf, branchNames, tipOf, describe, docOf, storePieces, fingerprint, cut, historyOf, diffTrees, pathTo, addPoint, isNoise } from "./history.js";

const own = (tree) => (tree || []).filter(([k]) => !k.startsWith("list:") && !isNoise(k));
/* Two files of the same product may write an artefact with its keys in another order (a project read back from its .dwiz) : the same
   content. Matching a teammate's file compares artefacts up to the order of their keys. */
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const canonText = (t) => { try { return JSON.stringify(sortKeys(JSON.parse(t))); } catch (e) { return String(t || ""); } };
/** A key of a whole product, up to the order of the keys of each artefact. objects : fingerprint → text (core/history_demo.js uses it too) */
export function keyer(objects) {
  const memo = new Map(), text = (f) => (objects instanceof Map ? objects.get(f) : objects && objects[f]) || "";
  return (tree) => own(tree).map(([k, f]) => { if (!memo.has(f)) memo.set(f, fingerprint(canonText(text(f)))); return `${k}=${memo.get(f)}`; }).sort().join("|");
}
/** Their pieces, each artefact that is ours up to the order of its keys given OUR text : it is then stored once, and is no change. */
function settle(h, base, pieces) {
  const B = new Map((base && base.tree) || []);
  return pieces.map(([k, t]) => { const f = B.get(k), mine = f && h.objects[f]; return t && mine && t !== mine && canonText(t) === canonText(mine) ? [k, mine] : [k, t]; });
}
const mergedSet = (h) => new Map(((h && h.points) || []).filter((p) => p.merged).map((p) => [p.merged, p.id]));      // a point taken into MAIN → the merge point

/** Where a branch starts from, for a merge : walking back from its last point (or from the point `from`), the first point that is on MAIN or
    already merged into it. → point | null */
export function baseOf(h, name, from = null) {
  if (name === MAIN) return null;
  const names = branchNames(h), merged = mergedSet(h), seen = new Set();
  for (let p = from ? pointOf(h, from) : tipOf(h, name); p && !seen.has(p.id); p = pointOf(h, p.parent)) { seen.add(p.id); if (names.get(p.id) === MAIN || merged.has(p.id)) return p; }
  return null;
}
/** The branches, MAIN first. → [{ name, points, tip, fork, by, dropped, here, ahead (points not yet in MAIN), base, mergedAt, imported }] */
export function branchList(h) {
  const names = branchNames(h), merged = mergedSet(h), by = new Map();
  for (const p of [...((h && h.points) || [])].sort((a, b) => a.n - b.n)) { const b = names.get(p.id); if (!by.has(b)) by.set(b, []); by.get(b).push(p); }
  return [...by.entries()].sort(([a], [b]) => (a === MAIN ? -1 : b === MAIN ? 1 : 0)).map(([name, list]) => {
    const tip = list.at(-1), base = baseOf(h, name), from = base && names.get(base.id) === name ? base.n : 0;
    return { name, points: list.map((p) => p.id), tip: tip.id, fork: name === MAIN ? null : list[0].parent || null, by: list.find((p) => p.by) ? list.find((p) => p.by).by : "",
      dropped: list.every((p) => p.dropped), here: list.some((p) => p.id === (h && h.head)), ahead: name === MAIN ? 0 : list.filter((p) => p.n > from).length,
      base: base ? base.id : null, mergedAt: merged.get(tip.id) || null, imported: list.some((p) => p.kind === "import") };
  });
}
/** The tree laid out for drawing : a column per branch, MAIN in the centre — as many columns on its left as on its right — and the others
    on either side, in the order they opened (right, left, right…) ; a row per point, in the order they were posed. → { rows: [{ id, row, col, branch, parent, merged }], cols, main, lanes: [{ name, col, row }] } */
export function branchLayout(h) {
  const names = branchNames(h), pts = [...((h && h.points) || [])].sort((a, b) => a.n - b.n), order = [MAIN], first = new Map();
  pts.forEach((p, row) => { const b = names.get(p.id); if (!order.includes(b)) order.push(b); if (!first.has(b)) first.set(b, row); });
  const slot = new Map([[MAIN, 0]]); order.slice(1).forEach((b, i) => slot.set(b, i % 2 ? -((i + 1) / 2) : i / 2 + 1));
  const half = Math.max(0, ...[...slot.values()].map(Math.abs)), col = (b) => slot.get(b) + half;      // as many columns on each side : MAIN stays in the middle
  return { rows: pts.map((p, row) => ({ id: p.id, row, col: col(names.get(p.id)), branch: names.get(p.id), parent: p.parent || null, merged: p.merged || null })),
    cols: 2 * half + 1, main: half, lanes: order.filter((b) => first.has(b)).map((b) => ({ name: b, col: col(b), row: first.get(b) })) };
}

/** What merging a branch into MAIN would do, in one block. → { branch, tip, main, base, take, lost, kept, offs, doc, nothing } | null
    take : what comes from the branch (added or changed) ; lost : what MAIN had changed too, and gives up ; kept : what the branch took out
    and MAIN keeps ; offs : the instances that come back at Off ; doc : the product after the merge. at : a point of the branch to merge up to
    (JP, 22 novembre : « à partir du point d'une branche, on merge avec le MAIN ») — its last point when omitted ; the points after it stay in
    the branch. */
export function mergePlan(h, name, at = null) {
  const pick = at && pointOf(h, at), tip = name !== MAIN && (pick && branchNames(h).get(pick.id) === name ? pick : at ? null : tipOf(h, name)), main = tipOf(h, MAIN), base = tip && baseOf(h, name, tip.id);
  if (!tip || !main || !base) return null;
  const B = new Map(base.tree), T = new Map(tip.tree), M = new Map(main.tree), texts = h.objects, extra = {}, R = new Map(main.tree);
  const take = [], lost = [], kept = [], offs = [];
  for (const [k, f] of T) {
    if (k.startsWith("list:")) { if (!R.has(k)) R.set(k, f); continue; }
    if (isNoise(k)) continue;                                          // the date the project was made : never taken from a branch
    if (B.get(k) === f || M.get(k) === f) continue;                   // untouched by the branch, or already the same in MAIN
    R.set(k, f); take.push({ key: k, how: B.has(k) ? "changed" : "added", ...describe(k, texts[f]) });
    if (M.has(k) && M.get(k) !== B.get(k)) lost.push({ key: k, ...describe(k, texts[M.get(k)]) });
  }
  for (const [k] of B) if (!k.startsWith("list:") && !isNoise(k) && !T.has(k) && M.has(k)) kept.push({ key: k, ...describe(k, texts[M.get(k)]) });
  for (const t of take) {
    if (t.kind !== "assembly" || !M.has(t.key)) continue;
    const mine = JSON.parse(texts[M.get(t.key)]), theirs = JSON.parse(texts[T.get(t.key)]), ids = new Set((theirs.instances || []).map((i) => i && i.id));
    const back = (mine.instances || []).filter((i) => i && !ids.has(i.id)); if (!back.length) continue;
    const backIds = new Set(back.map((i) => i.id)), all = new Set([...ids, ...backIds]), mateIds = new Set((theirs.mates || []).map((m) => m.id));
    const mates = (mine.mates || []).filter((m) => m && m.a && m.b && (backIds.has(m.a.inst) || backIds.has(m.b.inst)) && all.has(m.a.inst) && all.has(m.b.inst))
      .map((m) => (mateIds.has(m.id) ? { ...m, id: `${m.id}-MAIN` } : m));
    theirs.instances = [...(theirs.instances || []), ...back.map((i) => ({ ...i, off: true }))]; if (mates.length) theirs.mates = [...(theirs.mates || []), ...mates];
    const text = JSON.stringify(theirs), fp = fingerprint(text); extra[fp] = text; R.set(t.key, fp);
    for (const i of back) offs.push({ asm: t.id, asmName: t.name, inst: i.id, part: i.part || i.asm || "" });
  }
  return { branch: name, tip: tip.id, main: main.id, base: base.id, take, lost, kept, offs, doc: docOf({ ...texts, ...extra }, [...R.entries()]), nothing: !take.length };
}

/** A name of branch that is not taken yet. */
export function freeName(h, want) {
  const used = new Set(branchNames(h).values()), clean = String(want || "").replace(/\s+/g, " ").trim().slice(0, 40) || "Branche";
  if (!used.has(clean) && clean !== MAIN) return clean;
  let n = 2; while (used.has(`${clean} (${n})`)) n++; return `${clean} (${n})`;
}
/** The name a new branch is offered : « Branche N », the first one free. */
export function branchSuggestion(h) { const used = new Set(branchNames(h).values()); let n = 2; while (used.has(`Branche ${n}`)) n++; return `Branche ${n}`; }
/** « Nouvelle branche ici » (JP, 22 novembre 2026 : « je ne vois pas le bouton pour commencer une branche parallèle ») — as a version-control
    client creates a branch at a commit : a branch opens where « vous êtes ici » is, at ANY point, the last one of MAIN included. Its first point,
    « Départ de … », keeps the product as it stands — what changed since « ici » goes with the branch — and the points after it continue the
    branch ; the branch the point left does not move. Go to the point first (a return, undoable) to open a branch from an older one.
    o : { by, context, when } → the point, or null without a point to leave from */
export function startBranch(project, name, o = {}) {
  const h = historyOf(project); if (!pointOf(h, h.head)) return null;
  const b = freeName(h, name || branchSuggestion(h));
  return addPoint(project, { kind: "manual", branch: b, label: `Départ de « ${b} »`, ...(o.by ? { by: o.by } : {}), ...(o.context ? { context: o.context } : {}), ...(o.when ? { when: o.when } : {}) }).point;
}
/** What reading a teammate's product as a branch would do. other : the project read from their file (with its history or without).
    The branch leaves the most recent of OUR points whose product one of THEIR points also had (the files share a past) ; without one,
    the point of ours closest to their product (the most artefacts the same) — said as such. → { base, how ("common" | "closest" | "none"), theirs (their point), name, changes, same } */
export function importPlan(h, other, o = {}) {
  const ours = [...((h && h.points) || [])].sort((a, b) => a.n - b.n), ourKey = keyer(h.objects), byKey = new Map(ours.map((p) => [ourKey(p.tree), p]));
  const raw = cut(other), rawTree = raw.map(([k, t]) => [k, t ? fingerprint(t) : ""]), rawTexts = new Map(raw.map(([, t]) => [t ? fingerprint(t) : "", t]));
  let base = byKey.get(keyer(rawTexts)(rawTree)) || null, theirs = null, how = base ? "common" : "none";      // their product is one of our points : nothing to bring
  const oh = other && other.history, theirKey = keyer(oh && oh.objects), mine = oh ? pathTo(oh, oh.head).reverse() : [], rest = [...((oh && oh.points) || [])].sort((a, b) => b.n - a.n);
  for (const q of base ? [] : [...mine, ...rest]) { const p = byKey.get(theirKey(q.tree)); if (p) { base = p; theirs = q; how = "common"; break; } }      // along the path to their « ici » first
  if (!base && ours.length) {
    const want = new Map(own(rawTree).map(([k, f]) => [k, canonText(rawTexts.get(f))])); let best = -1;
    for (const p of ours) { const score = own(p.tree).filter(([k, f]) => want.get(k) === canonText(h.objects[f])).length; if (score >= best) { best = score; base = p; } }
    how = "closest";
  }
  const pieces = settle(h, base, raw), now = pieces.map(([k, t]) => [k, t ? fingerprint(t) : ""]), texts = new Map(pieces.map(([, t]) => [t ? fingerprint(t) : "", t]));
  const changes = base ? diffTrees(base.tree, now, h.objects, texts) : null;
  return { base: base ? base.id : null, how, theirs: theirs ? { id: theirs.id, at: theirs.at } : null, name: freeName(h, o.name || `Branche de ${o.by || "l'équipe"}`), changes,
    same: !!changes && !changes.added.length && !changes.removed.length && !changes.changed.length };
}
/** Add a teammate's product as a point of a new branch, leaving the base of the plan. « Vous êtes ici » does not move. → the point */
export function importBranch(project, other, plan, o = {}) {
  const h = historyOf(project), n = h.points.reduce((m, p) => Math.max(m, p.n || 0), 0) + 1, at = o.when || new Date().toISOString(), since = (plan.theirs && plan.theirs.at) || "";
  const journal = ((other && other.log) || []).filter((x) => x && (!since || String(x.when) > since)).map((x) => ({ when: x.when, text: x.text })).slice(-40);
  const point = { id: `P${n}`, n, parent: plan.base, branch: plan.name, at, kind: "import", label: String(o.label || `Travail de ${o.by || "l'équipe"}`).slice(0, 120),
    ...(o.by ? { by: String(o.by).slice(0, 80) } : {}), ...(o.note ? { note: String(o.note).slice(0, 2000) } : {}), from: plan.how, journal, tree: storePieces(h, settle(h, pointOf(h, plan.base), cut(other))) };
  h.points.push(point);
  return point;
}
