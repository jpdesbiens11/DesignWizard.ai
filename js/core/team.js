/* DesignWizard.ai — working together, in mirrors. There is no central copy of a shared project : each member keeps the
   whole project in their own storage (their mirror) and lets the others read it. A member's application reads the mirrors
   of the others and merges what changed into its own — artefact by artefact. Because every mirror is complete, each one is
   also a safety net for the others.
   What is kept for that, in the project itself :
     project.team = { id, owner (whose mirror this is), members: [{ handle, hash, mirror, since }],
                      stamps: { key: { at, by, sig, gone, was: [sig…] } },     each artefact : who gave it its present form, and its lineage
                      conflicts: [{ key, by, at, sig, doc, was }] }           the same artefact changed on both sides : a person decides
     project.talk = [{ id, at, by, on, text, mentions, done: { by, at },      messages, on an artefact or on the project
                      pin: { at: [x, y, z], inst }, re }]                     pinned on the 3D (a point of the part, of an instance in an assembly) ; an answer to a message
   The rule is the lineage : a version that counts mine among those it replaced is newer than mine and is taken without a
   word ; mine that counts theirs is kept ; neither — changed on both sides — is a conflict, and nothing is lost : mine
   stays, theirs waits beside it. The member who settles a conflict settles it for everyone : the choice is written in the
   lineage and arrives as an ordinary change. It holds for any number of members, whoever reads whom, in whatever order.
   Pure functions : the caller applies them in one undoable step. */

import { signature, REVIEW_KINDS } from "./review.js";

const LISTS = { part: "parts", assembly: "assemblies", board: "boards", physics: "physics", simulation: "simulations", case: "cases" };      // case : the load case of a part or an assembly, under its id (analysis/fea/case_store.js)
const KIND_NAMES = { case: "Cas de charge" };
const META = ["name", "description", "author", "drawing", "brief"], iso = (d) => (d || new Date()).toISOString();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const KEEP = 16, GONE = "gone", cur = (s) => (s.gone ? GONE : s.sig), later = (x, y) => (x.at !== y.at ? x.at > y.at : x.by > y.by);
/* the stamp an artefact has now : the recorded one while it still tells the truth, else a new one that remembers what it replaces */
function stampNow(stamps, key, sig, by, at) {
  const s = stamps[key]; if (s ? cur(s) === (sig === null ? GONE : sig) : sig === null) return s || null;
  const was = s ? [cur(s), ...(s.was || [])].slice(0, KEEP) : [];
  return { at, by, sig, ...(sig === null ? { gone: true } : {}), ...(was.length ? { was } : {}) };
}
export const HANDLE = /^[a-z0-9][a-z0-9_.-]{1,23}$/;
export const cleanHandle = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_.-]+/g, "").replace(/^[^a-z0-9]+/, "").slice(0, 24);

export const newTeamId = () => `t-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
/** The record of a project, created on first use. */
export function teamOf(project) {
  const t = project.team || (project.team = {});
  t.id = t.id || newTeamId();
  for (const [k, v] of [["members", []], ["stamps", {}], ["conflicts", []]]) t[k] = t[k] || v;
  project.talk = project.talk || [];
  return t;
}
export const isShared = (project) => !!(project && project.team && (project.team.members || []).length > 1);
/** Every artefact of a project by its key — the parts, assemblies, boards and analyses, then what the project says of itself and its iterations. */
export function artefacts(project) {
  const out = new Map();
  for (const [kind, list] of Object.entries(LISTS)) for (const d of project[list] || []) out.set(`${kind}:${d.id}`, d);
  const meta = {}; for (const k of META) if (project[k] !== undefined) meta[k] = project[k];
  out.set("project:meta", meta); if (project.mvp) out.set("project:mvp", project.mvp);
  return out;
}
function put(project, key, doc) {
  const i = key.indexOf(":"), kind = key.slice(0, i), id = key.slice(i + 1);
  if (key === "project:meta") { for (const k of META) { if (doc && doc[k] !== undefined) project[k] = clone(doc[k]); else delete project[k]; } return; }
  if (key === "project:mvp") { if (doc) project.mvp = clone(doc); else delete project.mvp; return; }
  const list = project[LISTS[kind]] || (project[LISTS[kind]] = []), at = list.findIndex((x) => String(x.id) === id);
  if (!doc) { if (at >= 0) list.splice(at, 1); } else if (at >= 0) list[at] = clone(doc); else list.push(clone(doc));
}
/** A readable name for a key. */
export function labelOf(project, key) {
  if (key === "project:meta") return "Le projet (nom, description, cartouche)"; if (key === "project:mvp") return "Les itérations MVP"; if (key === "project") return "Le projet";
  const i = key.indexOf(":"), d = artefacts(project).get(key); return `${REVIEW_KINDS[key.slice(0, i)] || KIND_NAMES[key.slice(0, i)] || key.slice(0, i)} ${key.slice(i + 1)}${d && d.name ? ` — ${d.name}` : ""}`;
}

/** A member joins, or updates what the team knows of them. → the member. */
export function joinTeam(project, m, date) {
  const t = teamOf(project), handle = cleanHandle(m.handle); if (!HANDLE.test(handle)) throw new Error("Un nom d'équipe a 2 à 24 caractères : lettres sans accent, chiffres, point, tiret.");
  const clash = t.members.find((x) => x.handle === handle && m.hash && x.hash && x.hash !== m.hash); if (clash) throw new Error(`« @${handle} » est déjà pris dans cette équipe.`);
  let x = t.members.find((q) => (m.hash && q.hash === m.hash) || q.handle === handle);
  if (!x) { x = { handle, since: iso(date) }; t.members.push(x); }
  Object.assign(x, { handle, ...(m.hash ? { hash: m.hash } : {}), ...(m.mirror ? { mirror: m.mirror } : {}) });
  return x;
}
/** A member who joins starts from the mirror of the one who invited them : a copy of their own, lineage included. → the new project. */
export function forkMirror(theirs, m, date) {
  const from = theirs && theirs.team && theirs.team.owner; if (!from) throw new Error("Ce fichier n'est pas le miroir d'un membre : il ne dit pas à qui il est.");
  const p = clone(theirs), t = teamOf(p);
  for (const [k, d] of artefacts(p)) { const x = stampNow(t.stamps, k, signature(d), from, iso(date)); if (x) t.stamps[k] = x; }
  t.conflicts = []; t.pulled = { [from]: iso(date) };
  joinTeam(p, m, date); t.owner = cleanHandle(m.handle);
  return p;
}
export const memberOf = (project, hash) => ((project.team && project.team.members) || []).find((m) => hash && m.hash === hash) || null;

/** Before a mirror is written or merged : what I changed since the last stamp is stamped with my name and the time. → the keys stamped. */
export function stampLocal(project, me, date) {
  const t = teamOf(project), A = artefacts(project), out = [], at = iso(date);
  t.owner = me;
  for (const key of new Set([...A.keys(), ...Object.keys(t.stamps)])) { const d = A.get(key), s = stampNow(t.stamps, key, d ? signature(d) : null, me, at); if (s && s !== t.stamps[key]) { t.stamps[key] = s; out.push(key); } }
  return out;
}
/** Merges the mirror of another member into mine. Mutates `mine` ; `theirs` is only read.
    → { from, added, taken, removed, kept, conflicts (keys), messages (new ones), members (new ones), releases (new ones), nothing } */
export function mergeMirror(mine, theirs, me, date) {
  const from = theirs && theirs.team && theirs.team.owner; if (!from) throw new Error("Ce fichier n'est pas le miroir d'un membre : il ne dit pas à qui il est.");
  if (from === me) throw new Error("C'est votre propre miroir.");
  const T = teamOf(mine); if (theirs.team.id && T.id !== theirs.team.id && T.members.length > 1) throw new Error("Ce miroir est celui d'une autre équipe ou d'un autre projet.");
  if (theirs.team.id && T.members.length <= 1) T.id = theirs.team.id;
  stampLocal(mine, me, date);
  const A = artefacts(mine), B = artefacts(theirs), TS = theirs.team.stamps || {}, at = iso(date), rep = { from, added: [], taken: [], removed: [], kept: [], conflicts: [], messages: 0, members: [] };
  const settle = (key) => { T.conflicts = T.conflicts.filter((c) => !(c.key === key && c.by === from)); };
  for (const key of new Set([...A.keys(), ...B.keys(), ...Object.keys(T.stamps), ...Object.keys(TS)])) {
    const a = A.get(key), b = B.get(key), sa = a ? signature(a) : null, sb = b ? signature(b) : null;
    if (sa === sb) { settle(key); continue; }
    /* x : my stamp ; y : theirs, as it would read had they stamped their mirror a moment ago. A side that never knew the artefact has none. */
    const x = T.stamps[key], y = stampNow(TS, key, sb, from, at), mineIsNewer = !!(x && y) && (x.was || []).includes(cur(y)), theirsIsNewer = !!(x && y) && (y.was || []).includes(cur(x));
    const take = !x || (theirsIsNewer && (!mineIsNewer || later(y, x))), keep = !take && (!y || mineIsNewer);
    if (take) { put(mine, key, b); T.stamps[key] = clone(y); (b ? (a ? rep.taken : rep.added) : rep.removed).push(key); settle(key); }
    else if (keep) { rep.kept.push(key); settle(key); }
    else { T.conflicts = [...T.conflicts.filter((c) => !(c.key === key && c.by === from)), { key, by: from, at: y.at, sig: sb, doc: b ? clone(b) : null, ...(y.was ? { was: y.was } : {}) }]; rep.conflicts.push(key); }
  }
  /* what is only added to : messages, members, the review of each artefact (the latest word stands) */
  const have = new Map(mine.talk.map((m) => [m.id, m]));
  for (const m of theirs.talk || []) { const x = have.get(m.id); if (!x) { mine.talk.push(clone(m)); rep.messages++; } else if (m.done && (!x.done || m.done.at > x.done.at)) x.done = clone(m.done); else if (!m.done && x.done && m.undone && m.undone > x.done.at) { delete x.done; x.undone = m.undone; } }
  mine.talk.sort((p, q) => (p.at < q.at ? -1 : p.at > q.at ? 1 : 0));
  for (const m of theirs.team.members || []) { const known = T.members.find((x) => x.handle === m.handle || (m.hash && x.hash === m.hash)); if (!known) { T.members.push(clone(m)); rep.members.push(m.handle); } else if (m.handle === from) Object.assign(known, clone(m)); else if (m.mirror && !known.mirror) known.mirror = m.mirror; }
  const R = (theirs.review && theirs.review.items) || {};
  if (Object.keys(R).length) { mine.review = mine.review || { items: {} }; mine.review.items = mine.review.items || {}; for (const [k, e] of Object.entries(R)) { const x = mine.review.items[k]; if (!x || String(e.when || "") > String(x.when || "")) mine.review.items[k] = clone(e); } }
  /* the released revisions : a release is never erased, so theirs are added to mine ; the artefact whose content is the one a release froze takes its number and its revision */
  const theirRel = (theirs.plm && theirs.plm.releases) || []; rep.releases = 0;
  if (theirRel.length) { mine.plm = mine.plm || { releases: [] }; mine.plm.releases = mine.plm.releases || []; const got = new Set(mine.plm.releases.map((r) => r.id)), now = artefacts(mine);
    for (const r of theirRel) { if (got.has(r.id)) continue; mine.plm.releases.push(clone(r)); got.add(r.id); rep.releases++; }
    mine.plm.releases.sort((p, q) => (p.at < q.at ? -1 : p.at > q.at ? 1 : 0));
    for (const r of mine.plm.releases) { const d = now.get(r.key); if (d && signature(d) === r.sig) { d.pn = r.pn; d.revision = r.rev; if (r.doc && r.doc.derivedFrom) d.derivedFrom = clone(r.doc.derivedFrom); else delete d.derivedFrom; } } }
  T.pulled = { ...(T.pulled || {}), [from]: iso(date) };
  rep.nothing = !rep.added.length && !rep.taken.length && !rep.removed.length && !rep.conflicts.length && !rep.messages && !rep.members.length && !rep.releases;
  return rep;
}
/** A person settles a conflict : keep mine, or take theirs. Either way the version kept is written as the one that replaces the
    other, so the choice reaches every member as an ordinary change. */
export function resolveConflict(project, key, by, choice, me, date) {
  const T = teamOf(project), c = T.conflicts.find((x) => x.key === key && x.by === by); if (!c) return false;
  stampLocal(project, me, date);
  const x = T.stamps[key], theirs = c.sig === null ? GONE : c.sig, at = iso(date), line = (first, rest) => { const was = [first, ...rest].filter((v, i, l) => v && l.indexOf(v) === i).slice(0, KEEP); return was.length ? { was } : {}; };
  if (choice === "theirs") { put(project, key, c.doc); T.stamps[key] = { at, by: me, sig: c.sig, ...(c.doc ? {} : { gone: true }), ...line(x ? cur(x) : null, c.was || []) }; }
  else if (x) T.stamps[key] = { at, by: me, sig: x.sig, ...(x.gone ? { gone: true } : {}), ...line(theirs, x.was || []) };
  T.conflicts = T.conflicts.filter((q) => q !== c);
  return true;
}

/** A message, on an artefact or on the project ; « @name » calls a member. o.pin : where it is pinned on the 3D — { at: [x, y, z] } in the
    coordinates of the part, with `inst` when the part is an instance of an assembly. o.re : the message it answers. → the message. */
export function post(project, o) {
  teamOf(project); const text = String(o.text || "").trim(); if (!text) throw new Error("Un message vide ne dit rien.");
  const parent = o.re ? project.talk.find((x) => x.id === o.re) : null; if (o.re && !parent) throw new Error("Le message auquel vous répondez n'existe plus.");
  let pin = null;
  if (o.pin && !parent) { const at = (o.pin.at || []).map(Number); if (at.length !== 3 || !at.every(Number.isFinite)) throw new Error("Un message épinglé demande un point de la pièce.");
    pin = { at: at.map((v) => Math.round(v * 100) / 100 + 0), ...(o.pin.inst ? { inst: String(o.pin.inst) } : {}) }; }
  const known = new Set((project.team.members || []).map((m) => m.handle)), mentions = [...new Set((text.match(/@([a-z0-9][a-z0-9_.-]{1,23})/gi) || []).map((x) => x.slice(1).toLowerCase().replace(/[.-]+$/, "")))].filter((h) => known.has(h));
  const at = iso(o.date), m = { id: `${o.by}-${Date.parse(at).toString(36)}-${project.talk.filter((x) => x.by === o.by).length + 1}`, at, by: o.by, on: parent ? parent.on : o.on || "project", text, mentions, ...(pin ? { pin } : {}), ...(parent ? { re: parent.id } : {}) };
  project.talk.push(m); return m;
}
/** The messages pinned on the 3D of an artefact, numbered in the order they were written, each with its answers. → [{ n, msg, replies, open }] */
export function pinsOf(project, key) {
  const talk = (project && project.talk) || [];
  return talk.filter((m) => m.on === key && m.pin).map((msg, i) => ({ n: i + 1, msg, replies: talk.filter((x) => x.re === msg.id), open: !msg.done }));
}
export function setDone(project, id, by, on = true, date) { const m = (project.talk || []).find((x) => x.id === id); if (!m) return false; if (on) { m.done = { by, at: iso(date) }; delete m.undone; } else { delete m.done; m.undone = iso(date); } return true; }
/** What waits for a member : the open messages that call them. */
export const inbox = (project, handle) => (project.talk || []).filter((m) => !m.done && m.by !== handle && (m.mentions || []).includes(handle));
/** Messages by subject, the most recently active first. → [{ on, label, items, open }] */
export function threads(project) {
  const by = new Map(); for (const m of project.talk || []) { if (!by.has(m.on)) by.set(m.on, []); by.get(m.on).push(m); }
  return [...by].map(([on, items]) => ({ on, label: labelOf(project, on), items, open: items.filter((m) => !m.done).length, last: items.at(-1).at })).sort((p, q) => (p.last < q.last ? 1 : -1));
}
/** Rows for the report : members, then the messages still open. */
export function teamRows(project) {
  const t = project.team || {}, talk = project.talk || [];
  return { members: (t.members || []).map((m) => [`@${m.handle}`, String(m.since || "").slice(0, 10), (t.pulled || {})[m.handle] ? String(t.pulled[m.handle]).slice(0, 16).replace("T", " ") : m.handle === t.owner ? "ce miroir" : "jamais", String(talk.filter((x) => x.by === m.handle).length)]),
    open: talk.filter((m) => !m.done).map((m) => [String(m.at).slice(0, 10), `@${m.by}`, `${labelOf(project, m.on)}${m.pin ? " — épinglé sur le 3D" : ""}`, m.text]), conflicts: (t.conflicts || []).length };
}
