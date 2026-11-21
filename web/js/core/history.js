/* DesignWizard.ai — the HISTORY of a design : restore points, and the tree of their branches (point 9 of the plan agreed with JP, choices
   clicked on 20 November 2026 : « un point de restauration garde la définition complète du produit, les fichiers lourds rangés une seule
   fois et cités par chaque point… commencer par les points et l'arbre »).
   A point keeps the WHOLE definition of the product — every part, assembly, board, and every ledger (review, MVP, revisions, cases) —
   cut into artefacts, each stored ONCE under the fingerprint of its content (`objects`) : a point that changes one part costs that part
   only, and an imported STEP that never changes is stored once for every point that cites it. A point says when, why (posed by hand, after
   an answer of an AI, before a return), what was done since the point before (its own journal), the MVP iteration open then and the
   revisions frozen then.
   Going back to a point and continuing opens a BRANCH : the history is a tree. A branch can be set aside (« abandonnée ») and taken up again ;
   nothing is deleted. What it follows : the snapshot manager of a virtual machine (a tree, « vous êtes ici »), the commit graph of a
   version-control client (a lane per branch). The history is not part of the undo : Ctrl + Z undoes a change, not a point.
   Pure : no page, no store. project.history = { v: 1, head, objects: { fingerprint: text }, points: [...] } */

import { iterationState, stateLabel } from "./mvp.js";
import { releases } from "./plm.js";
import { stateOf, REV_STATES } from "./plm_review.js";

const SKIP = new Set(["history", "log", "updated", "id"]);           // what is not the definition : the history itself, the activity log, the clock, the name of the file
const LISTS = { part: "parts", assembly: "assemblies", board: "boards" };
const LIST_KIND = Object.fromEntries(Object.entries(LISTS).map(([k, v]) => [v, k]));
const KEEP_JOURNAL = 40;

/** The kinds of point, with their pictogram and their colour. */
export const POINT_KINDS = {
  manual: { label: "Point posé", fr: "posé à la main", icon: "save", color: "#2563eb" },
  ai: { label: "Après une réponse d'IA", fr: "automatique, après une réponse d'IA appliquée", icon: "sparkle", color: "#7c3aed" },
  before: { label: "Avant un retour", fr: "automatique, avant de revenir à un autre point", icon: "undo", color: "#64748b" },
  merge: { label: "Fusion dans MAIN", fr: "une branche reprise d'un bloc dans MAIN", icon: "branch", color: "#0f766e" },
  import: { label: "Branche importée", fr: "le travail d'un coéquipier, lu dans son fichier", icon: "download", color: "#c2410c" },
};
/** The branch that is always there, in the centre : where the product is when the branches come back. */
export const MAIN = "MAIN";
/** The words of an artefact, by its kind. */
export const ART_KINDS = { part: { fr: "Pièce", color: "#2563eb" }, assembly: { fr: "Assemblage", color: "#475569" }, board: { fr: "Carte", color: "#16a34a" }, other: { fr: "Registre", color: "#a16207" } };
const OTHER_FR = { review: "registre de revue", mvp: "itérations MVP", plm: "révisions", team: "équipe", talk: "messages", cases: "cas de charge", aiJournal: "journal de l'IA", name: "nom du produit", description: "description", drawing: "réglages des dessins", sw: "logiciel" };

/** A fingerprint of a text : two 32-bit hashes (cyrb53) and the length. Equal texts, equal fingerprints ; for different ones a collision is
    beyond what a design history meets (53 bits and the length). */
export function fingerprint(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}.${s.length.toString(36)}`;
}
/** The project cut into artefacts, in its order. → [[key, text]] — key « part:ID », « assembly:ID », « board:ID », « key:NAME » */
export function cut(project) {
  const out = [];
  for (const [k, v] of Object.entries(project || {})) {
    if (SKIP.has(k) || v === undefined) continue;
    if (LIST_KIND[k] && Array.isArray(v)) { for (const x of v) out.push([`${LIST_KIND[k]}:${x && x.id}`, JSON.stringify(x)]); out.push([`list:${k}`, ""]); }      // « list:parts » keeps the place of an empty list
    else out.push([`key:${k}`, JSON.stringify(v)]);
  }
  return out;
}
/** The history of a project, made when it has none. */
export function historyOf(project) {
  const h = (project.history = project.history && typeof project.history === "object" ? project.history : {});
  h.v = 1; h.objects = h.objects || {}; h.points = Array.isArray(h.points) ? h.points : []; if (h.head === undefined) h.head = null;
  return h;
}
export const pointOf = (h, id) => ((h && h.points) || []).find((p) => p.id === id) || null;
const treeOf = (h, pieces) => pieces.map(([k, t]) => { if (!t) return [k, ""]; const f = fingerprint(t); if (h && !(f in h.objects)) h.objects[f] = t; return [k, f]; });
const sameTree = (a, b) => !!a && !!b && a.length === b.length && a.every(([k, f], i) => b[i][0] === k && b[i][1] === f);
/** The tree of the project as it stands, without storing anything. */
export const treeNow = (project) => cut(project).map(([k, t]) => [k, t ? fingerprint(t) : ""]);

/** Pose a point. o : { kind, label, note, by, when (ISO), ai (id of the AI answer), context ({ mvp, revs }) }
    → { point, same } — same : the product has not changed since the point « vous êtes ici » ; a point is posed all the same when asked by hand. */
export function addPoint(project, o = {}) {
  const h = historyOf(project), head = pointOf(h, h.head), tree = treeOf(h, cut(project)), same = !!head && sameTree(head.tree, tree);
  if (same && o.kind !== "manual") return { point: head, same: true };
  const n = h.points.reduce((m, p) => Math.max(m, p.n || 0), 0) + 1, when = o.when || new Date().toISOString();
  const since = head ? head.at : "", journal = ((project.log || []).filter((x) => x && (!since || String(x.when) > since)).map((x) => ({ when: x.when, text: x.text }))).slice(-KEEP_JOURNAL);
  const branch = o.branch || nextBranch(h); if (h.on && branch === h.on) delete h.on;
  const point = { id: `P${n}`, n, parent: h.head, branch, at: when, kind: POINT_KINDS[o.kind] ? o.kind : "manual", label: String(o.label || "").trim().slice(0, 120) || `Point ${n}`, ...(o.merged ? { merged: o.merged } : {}),
    ...(o.note ? { note: String(o.note).slice(0, 2000) } : {}), ...(o.by ? { by: String(o.by).slice(0, 80) } : {}), ...(o.ai ? { ai: o.ai } : {}), ...(o.context ? { context: o.context } : {}), journal, tree };
  h.points.push(point); h.head = point.id;
  return { point, same };
}
/** The product of a point, whole. → an object with every key of the definition (no id, no log, no history) */
export function rebuild(h, id) { const pt = pointOf(h, id); return pt ? docOf(h.objects, pt.tree) : null; }
/** A product from a tree and the texts of its artefacts. texts : fingerprint → text */
export function docOf(texts, tree) {
  const doc = {}, lists = {};
  for (const [k, f] of tree) {
    const [kind, ...rest] = k.split(":"), name = rest.join(":");
    if (kind === "key") doc[name] = JSON.parse(texts[f]);
    else if (kind === "list") { doc[name] = lists[name] || []; }
    else if (LISTS[kind]) (lists[LISTS[kind]] = lists[LISTS[kind]] || []).push(JSON.parse(texts[f]));
  }
  for (const [k, v] of Object.entries(lists)) doc[k] = v;
  return doc;
}
/** The tree of a product, its artefacts stored in the history (each once). → [[key, fingerprint]] */
export const storedTree = (h, doc) => treeOf(h, cut(doc));
/** The same, from pieces already cut ([[key, text]]). */
export const storePieces = (h, pieces) => treeOf(h, pieces);
/** The definition of the project becomes `doc` ; its id, its log and its history stay. */
export function putDefinition(project, doc) { for (const k of Object.keys(project)) if (!SKIP.has(k)) delete project[k]; Object.assign(project, doc); return project; }
/** Go back to a point : the definition of the project becomes that of the point, its history and its log stay, « vous êtes ici » moves there.
    To be called INSIDE one step of the store (the return is undoable ; the history is not). → the point, or null */
export function restoreInto(project, id) {
  const h = historyOf(project), doc = rebuild(h, id); if (!doc) return null;
  putDefinition(project, doc); h.head = id;
  return pointOf(h, id);
}
/** What an artefact is, in words. */
export function describe(key, text) {
  const [kind, ...rest] = key.split(":"), id = rest.join(":");
  if (LISTS[kind]) { let name = ""; try { name = (JSON.parse(text) || {}).name || ""; } catch (e) { /* unreadable : the id is enough */ } return { kind, id, name, fr: ART_KINDS[kind].fr }; }
  return { kind: "other", id, name: OTHER_FR[id] || id, fr: ART_KINDS.other.fr };
}
/** What differs from a tree to another. a, b : trees ([[key, fingerprint]]) ; texts : fingerprint → text (h.objects), now : the texts of the project
    when one side is the project as it stands. → { added, removed, changed } — each [{ key, kind, id, name, fr }] ; « list:… » and the order are not changes */
export function diffTrees(a, b, texts, now = null) {
  const A = new Map((a || []).filter(([k]) => !k.startsWith("list:"))), B = new Map((b || []).filter(([k]) => !k.startsWith("list:"))), out = { added: [], removed: [], changed: [] };
  const text = (f) => (texts && texts[f]) || (now && now.get(f)) || "";
  for (const [k, f] of B) { if (!A.has(k)) out.added.push({ key: k, ...describe(k, text(f)) }); else if (A.get(k) !== f) out.changed.push({ key: k, ...describe(k, text(f)) }); }
  for (const [k, f] of A) if (!B.has(k)) out.removed.push({ key: k, ...describe(k, text(f)) });
  return out;
}
/** What changed since a point, in the project as it stands. → { added, removed, changed } */
export function sinceThen(project, id) {
  const h = historyOf(project), pt = pointOf(h, id); if (!pt) return { added: [], removed: [], changed: [] };
  const pieces = cut(project), now = new Map(pieces.map(([, t]) => [t ? fingerprint(t) : "", t]));
  return diffTrees(pt.tree, pieces.map(([k, t]) => [k, t ? fingerprint(t) : ""]), h.objects, now);
}
export const changeCount = (d) => d.added.length + d.removed.length + d.changed.length;
/* ---------- named branches, MAIN in the centre (demande de JP, 21 novembre 2026 ; core/history_branches.js merges and imports) ----------
   Every point belongs to a branch, by name. The first point is on MAIN ; a point continues the branch of its parent when the parent is the
   last point of that branch ; going back to a point that is not the end of its branch and going on opens a NEW branch. A point kept
   before branches had names takes them by the same rule : the first child of a point continues its branch, another opens « Branche 2 »… */
/** The branch of every point. → Map(id → name) */
export function branchNames(h) {
  const out = new Map(), pts = [...((h && h.points) || [])].sort((a, b) => a.n - b.n), used = new Set(pts.map((p) => p.branch).filter(Boolean)), ends = new Map();      // ends : branch → its last point so far
  let k = 1; const fresh = () => { let n; do n = `Branche ${++k}`; while (used.has(n)); used.add(n); return n; };
  for (const p of pts) {
    const parent = p.parent && out.get(p.parent), name = p.branch || (!p.parent ? MAIN : ends.get(parent) === p.parent ? parent : fresh());
    out.set(p.id, name); ends.set(name, p.id);
  }
  return out;
}
/** The last point of a branch. → point | null */
export function tipOf(h, name) { const names = branchNames(h); return [...((h && h.points) || [])].sort((a, b) => b.n - a.n).find((p) => names.get(p.id) === name) || null; }
/** The branch the next point goes into : the branch of « vous êtes ici » when it is its last point ; a new one otherwise (its name : `h.on`
    when one was given and is free, « Branche N » else). */
export function nextBranch(h) {
  const head = pointOf(h, h && h.head); if (!head) return MAIN;
  const names = branchNames(h), b = names.get(head.id), tip = tipOf(h, b);
  if (tip && tip.id === head.id) return b;
  const used = new Set(names.values()), want = String((h && h.on) || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (want && !used.has(want)) return want;
  let n = 1, name; do name = `Branche ${++n}`; while (used.has(name)); return name;
}
/** The points from the first to this one. → [point] */
export function pathTo(h, id) { const out = []; const seen = new Set(); for (let p = pointOf(h, id); p && !seen.has(p.id); p = pointOf(h, p.parent)) { seen.add(p.id); out.unshift(p); } return out; }
export const childrenOf = (h, id) => ((h && h.points) || []).filter((p) => p.parent === id);
/** The tree laid out as a version-control client draws it : a row per point, in the order they were posed ; a lane per branch — the first child
    of a point stays in its lane, another one opens a new lane. → { rows: [{ id, row, lane, parent }], lanes } */
export function layout(h) {
  const pts = [...((h && h.points) || [])].sort((a, b) => a.n - b.n), lane = new Map(); let lanes = 0;
  const rows = pts.map((p, row) => {
    const sibs = childrenOf(h, p.parent).sort((a, b) => a.n - b.n), first = p.parent && sibs[0] && sibs[0].id === p.id && lane.has(p.parent);
    const l = first ? lane.get(p.parent) : lanes++; lane.set(p.id, l); return { id: p.id, row, lane: l, parent: p.parent };
  });
  return { rows, lanes: Math.max(1, lanes) };
}
/** The branches : one per point that has no child. → [{ tip, points (from the fork), dropped, here (holds « vous êtes ici ») }] */
export function branches(h) {
  const pts = (h && h.points) || [], here = new Set(pathTo(h, h && h.head).map((p) => p.id));
  return pts.filter((p) => !childrenOf(h, p.id).length).map((tip) => {
    const own = []; for (let p = tip; p; p = pointOf(h, p.parent)) { own.unshift(p); const q = pointOf(h, p.parent); if (!q || childrenOf(h, q.id).length > 1) break; }
    return { tip: tip.id, points: own.map((p) => p.id), dropped: own.every((p) => p.dropped), here: own.some((p) => here.has(p.id)) };
  });
}
/** Set a branch aside, or take it up again — its own points, from where it leaves the trunk. The branch of « vous êtes ici » cannot be set aside.
    → true when something changed */
export function setDropped(project, tip, on = true) {
  const h = historyOf(project), b = branches(h).find((x) => x.tip === tip); if (!b || (on && b.here)) return false;
  for (const id of b.points) { const p = pointOf(h, id); if (on) p.dropped = true; else delete p.dropped; }
  return true;
}
/** What a point weighs, and what the history weighs. → { points, objects, bytes } — bytes : what the history adds to the file */
export function weight(h) {
  const objs = Object.values((h && h.objects) || {}); let bytes = 0; for (const t of objs) bytes += t.length;
  for (const p of (h && h.points) || []) bytes += JSON.stringify(p).length;
  return { points: ((h && h.points) || []).length, objects: objs.length, bytes };
}
/** A point as a project of its own, to be written as a .dwiz file that stands alone. → a project document (no history) */
export function pointProject(project, id) {
  const h = historyOf(project), pt = pointOf(h, id), doc = rebuild(h, id); if (!doc) return null;
  return { dw: "project/1", ...doc, id: `${project.id}-${pt.id}`, name: `${doc.name || project.name || "Projet"} — ${pt.id} ${pt.label}`.slice(0, 160), updated: pt.at, log: (pt.journal || []).slice() };
}
/** Where the design stands when a point is posed : the MVP iteration open (or the last one), and the revisions — how many frozen, released,
    rejected, and the last ones. → { mvp: { n, name, trl, state, fr } | null, revs: { frozen, released, rejected, last: [{ key, pn, rev, state, fr }] } } */
export function contextOf(project) {
  const its = (project && project.mvp && project.mvp.iterations) || [], it = its.filter((x) => !x.closed).at(-1) || its.at(-1) || null;
  const rel = releases(project), count = (st) => rel.filter((r) => stateOf(r) === st).length;
  return { mvp: it ? { n: it.n, name: it.name || `MVP ${it.n}`, trl: it.trl || null, state: iterationState(it), fr: stateLabel(it) } : null,
    revs: { frozen: count("frozen"), released: count("released"), rejected: count("rejected"), last: rel.slice(-6).map((r) => ({ key: r.key, pn: r.pn, rev: r.rev, state: stateOf(r), fr: (REV_STATES[stateOf(r)] || {}).label || "" })) } };
}
/** The lines of the report : one per point, the first first. → [[point, posé le, genre, nom, vient de, MVP, révisions, état]] */
export function historyRows(project) {
  const h = (project && project.history) || null; if (!h || !(h.points || []).length) return [];
  return [...h.points].sort((a, b) => a.n - b.n).map((p) => { const c = p.context || {}, r = c.revs || {};
    return [p.id + (p.id === h.head ? " ◀ ici" : ""), String(p.at).slice(0, 16).replace("T", " "), (POINT_KINDS[p.kind] || POINT_KINDS.manual).label, p.label, p.parent || "—",
      c.mvp ? `${c.mvp.name} · ${c.mvp.fr}` : "—", `${r.frozen || 0} gelée(s) · ${r.released || 0} libérée(s)`, p.dropped ? "Branche abandonnée" : "Gardé"]; });
}
/** The project without its history : what goes to an AI, a team mirror, a review package. */
export function withoutHistory(project) { const { history, ...rest } = project || {}; return rest; }
/** A new answer of an AI was applied since `seen` (the id of the last answer known) ? → the answer, or null */
export function newAiAnswer(project, seen) { const a = ((project && project.aiJournal) || [])[0]; return a && a.id !== seen ? a : null; }
/** What the guide says on the screen of the history. → [{ level, text }] */
export function historyGuide(project) {
  const h = (project && project.history) || null, out = [];
  if (!h || !(h.points || []).length) return [{ level: "tip", text: "Aucun point de restauration : posez-en un avant un changement que vous voudriez pouvoir défaire d'un bloc." }];
  const head = pointOf(h, h.head), d = head ? sinceThen(project, head.id) : null, n = d ? changeCount(d) : 0;
  if (n) out.push({ level: "tip", text: `${n} artéfact${n > 1 ? "s ont" : " a"} changé depuis « ${head.label} » (${head.id}) : un point les garderait.` });
  const dropped = branches(h).filter((b) => b.dropped).length;
  if (dropped) out.push({ level: "tip", text: `${dropped} branche${dropped > 1 ? "s abandonnées sont" : " abandonnée est"} gardée${dropped > 1 ? "s" : ""} : on peut la reprendre.` });
  return out;
}
