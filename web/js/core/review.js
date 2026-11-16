/* DesignWizard.ai — the design review ledger. Every artefact of a project — part, assembly, board, analysis — is
   in one of a few states : it came from an AI and nobody has read it (« Brouillon IA »), it has never been reviewed,
   the reviewer asks for a change (« À réviser », with a note), or it is reviewed. A reviewed artefact remembers its
   signature : when its content changes afterwards — by hand or through an AI — it says so, and approving it again
   makes the next revision (A → B) with a line in its history.
   project.review = { items: { "part:ID": { state, note, sig, rev, when, by, history: [{ rev, when, note }], parts } } }
   An assembly also remembers WHICH REVISION OF EACH PART it was reviewed with (parts : { id: { rev, sig } }) : when a part
   moves on, every assembly that uses it says so and asks to be reviewed again — its own next revision. A drawing always
   carries the revision of what it draws. This is the baseline of the product structure : where used, reviewed with what.
   Pure functions : the caller applies them inside one undoable step. */

import { model } from "../analysis/physics/index.js";
import { material, PROCESSES, processName } from "../cad/materials.js";

export const REVIEW_STATES = {
  draft: { fr: "Brouillon IA", tone: "warn", text: "écrit ou modifié par une IA, pas encore relu" },
  todo: { fr: "À revoir", tone: "neutral", text: "jamais passé en revue" },
  revise: { fr: "À réviser", tone: "danger", text: "la revue demande une modification" },
  changed: { fr: "Modifié depuis la revue", tone: "warn", text: "revu, puis modifié : à revoir pour valider la révision suivante" },
  ok: { fr: "Revu", tone: "ok", text: "relu et validé par une personne" },
};
export const REVIEW_KINDS = { part: "Pièce", assembly: "Assemblage", board: "Carte", physics: "Analyse", simulation: "Simulation" };
const LISTS = { part: "parts", assembly: "assemblies", board: "boards", physics: "physics", simulation: "simulations" };
const VOLATILE = new Set(["revision", "when", "updated", "log", "pn", "derivedFrom", "look"]);     // what changes without the design changing : its revision, its number (core/plm.js), its colour on screen (core/part_look.js)
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).filter((k) => !VOLATILE.has(k)).sort().map((k) => [k, canon(v[k])])) : v);

/** A short signature of the content of an artefact : the same content gives the same signature, whatever the order of its keys. */
export function signature(doc) {
  const s = JSON.stringify(canon(doc)) || "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16).padStart(8, "0")}-${s.length.toString(36)}`;
}
/** The revision after this one : A → B, Z → AA. */
export function nextRevision(rev) {
  const r = String(rev || "A").toUpperCase().replace(/[^A-Z]/g, "") || "A";
  let i = r.length - 1, out = r.split("");
  while (i >= 0 && out[i] === "Z") out[i--] = "A";
  if (i < 0) out.unshift("A"); else out[i] = String.fromCharCode(out[i].charCodeAt(0) + 1);
  return out.join("");
}
const split = (key) => { const k = String(key), i = k.indexOf(":"); return [k.slice(0, i), k.slice(i + 1)]; };
/** The artefact a key names, or null. */
export function artefactOf(project, key) { const [kind, id] = split(key); return ((project && project[LISTS[kind]]) || []).find((x) => String(x.id) === id) || null; }
const ledger = (project) => { project.review = project.review || { items: {} }; project.review.items = project.review.items || {}; return project.review.items; };

function describe(project, kind, d) {
  if (kind === "part") { const m = material(d.material); return { name: d.name || "", facts: [PROCESSES[d.process] ? processName(d.process) : d.process, m ? m.name : d.material].filter(Boolean).join(" · ") }; }
  if (kind === "assembly") return { name: d.name || "", facts: `${(d.instances || []).length} pièce(s), ${(d.mates || []).length} liaison(s)` };
  if (kind === "board") return { name: d.name || "", facts: `${(d.functions || []).filter((f) => !f.parent).length} fonction(s), ${(d.parts || []).length} composant(s)` };
  if (kind === "physics") { const m = model(d.model); return { name: m ? m.title : d.model, facts: [d.part, d.why].filter(Boolean).join(" — ") }; }
  return { name: `${d.kind || "structure"} — ${d.target || ""}`, facts: d.cells ? `${d.cells} cellules` : "" };
}
/** The parts an assembly uses, each with its revision and its signature as they are now. */
export function partsOf(project, asm) {
  const out = {};
  for (const id of new Set((asm.instances || []).map((i) => i.part))) { const p = (project.parts || []).find((x) => x.id === id); if (p) out[id] = { rev: p.revision || "A", sig: signature(p) }; }
  return out;
}
/** What moved under an assembly since it was reviewed : [{ part, from, to }] (from : the revision it was reviewed with ; to : the one of today ; gone : the part left the project). */
export function staleParts(project, asm, entry) {
  const was = (entry && entry.parts) || null; if (!was) return [];
  const now = partsOf(project, asm), out = [];
  for (const [id, w] of Object.entries(was)) { const n = now[id]; if (!n) { if (!(asm.instances || []).some((i) => i.part === id)) continue; out.push({ part: id, from: w.rev, to: null, gone: true }); } else if (n.sig !== w.sig) out.push({ part: id, from: w.rev, to: n.rev }); }
  for (const id of Object.keys(now)) if (!was[id]) out.push({ part: id, from: null, to: now[id].rev });
  return out;
}
const staleText = (list) => list.map((x) => (x.gone ? `${x.part} retirée` : x.from === null ? `${x.part} ajoutée` : x.from === x.to ? `${x.part} modifiée (rév. ${x.to} pas encore revue)` : `${x.part} rév. ${x.from} → ${x.to}`)).join(", ");
/** Every artefact of the project with its review state. → [{ key, kind, id, name, facts, rev, state, note, when, by, history, sig, stale }] */
export function reviewItems(project) {
  const out = [], items = (project && project.review && project.review.items) || {};
  for (const kind of Object.keys(LISTS)) for (const d of (project && project[LISTS[kind]]) || []) {
    const key = `${kind}:${d.id}`, e = items[key] || {}, sig = signature(d), stale = kind === "assembly" ? staleParts(project, d, e) : [], desc = describe(project, kind, d);
    const state = e.state === "ok" ? ((e.sig && e.sig !== sig) || stale.length ? "changed" : "ok") : e.state === "draft" || e.state === "revise" ? e.state : "todo";
    if (stale.length && e.state === "ok") desc.facts += ` · à revalider : ${staleText(stale)}`;
    out.push({ key, kind, id: String(d.id), ...desc, rev: d.revision || (kind === "physics" || kind === "simulation" ? "" : "A"), state, note: e.note || "", when: e.when || "", by: e.by || "", history: e.history || [], sig, stale });
  }
  return out;
}
/** Where a part is used : each assembly, how many times, and whether that assembly was reviewed with the part as it is today. */
export function whereUsed(project, partId) {
  const items = (project.review && project.review.items) || {}, p = (project.parts || []).find((x) => x.id === partId), now = p ? signature(p) : null;
  return (project.assemblies || []).filter((a) => (a.instances || []).some((i) => i.part === partId)).map((a) => { const e = items[`assembly:${a.id}`] || {}, w = e.state === "ok" && e.parts ? e.parts[partId] : null;
    return { id: a.id, name: a.name || "", qty: a.instances.filter((i) => i.part === partId).length, rev: a.revision || "A", reviewedWith: w ? w.rev : null, upToDate: !!w && w.sig === now }; });
}
/** The product structure with its revisions, for the report : one row per part. */
export function revisionRows(project) {
  const state = new Map(reviewItems(project).map((x) => [x.key, x]));
  return (project.parts || []).map((p) => { const it = state.get(`part:${p.id}`), used = whereUsed(project, p.id);
    return [p.id, p.name || "", p.revision || "A", it ? REVIEW_STATES[it.state].fr : "—", used.length ? used.map((u) => `${u.id} rév. ${u.rev}${u.qty > 1 ? ` (× ${u.qty})` : ""} — ${u.reviewedWith === null ? "pas encore revu" : u.upToDate ? `revu avec la rév. ${u.reviewedWith}` : `revu avec la rév. ${u.reviewedWith} : à revalider`}`).join(" ; ") : "aucun assemblage"]; });
}
/** How far the review is. → { total, ok, draft, todo, revise, changed, left, ratio } */
export function reviewProgress(project) {
  const p = { total: 0, ok: 0, draft: 0, todo: 0, revise: 0, changed: 0 };
  for (const it of reviewItems(project)) { p.total++; p[it.state]++; }
  return { ...p, left: p.total - p.ok, ratio: p.total ? p.ok / p.total : 0 };
}

/** The reviewer validates an artefact. When it had already been validated with another content, this makes its next
    revision. → { rev, bumped } or null when the artefact does not exist. */
export function approve(project, key, o = {}) {
  const d = artefactOf(project, key); if (!d) return null;
  const items = ledger(project), e = items[key] || (items[key] = {}), sig = signature(d), [kind] = split(key), lettered = kind !== "physics" && kind !== "simulation", when = (o.date || new Date()).toISOString();
  const stale = kind === "assembly" ? staleParts(project, d, e) : [], bumped = !!(lettered && e.sig && (e.sig !== sig || stale.length));
  e.history = e.history || [];
  if (bumped) { const from = d.revision || "A"; d.revision = nextRevision(from); e.history.push({ rev: d.revision, when, note: e.note || o.note || `Révision ${d.revision} validée (suite de la ${from})${stale.length ? ` — ${staleText(stale)}` : ""}` }); }
  else if (!e.sig) { if (lettered) d.revision = d.revision || "A"; e.history.push({ rev: lettered ? d.revision : "", when, note: e.note || o.note || "Première revue" }); }
  Object.assign(e, { state: "ok", sig: signature(d), when, note: "", ...(o.by ? { by: o.by } : {}), ...(lettered ? { rev: d.revision } : {}), ...(kind === "assembly" ? { parts: partsOf(project, d) } : {}) });
  return { rev: lettered ? d.revision : "", bumped };
}
/** The reviewer asks for a change, in plain words. */
export function askRevision(project, key, note) {
  if (!artefactOf(project, key)) return false;
  const items = ledger(project), e = items[key] || (items[key] = {});
  Object.assign(e, { state: "revise", note: String(note || "").trim() });
  return true;
}
/** Keeps a note without changing the state. */
export function setNote(project, key, note) {
  if (!artefactOf(project, key)) return false;
  const items = ledger(project), e = items[key] || (items[key] = { state: undefined });
  e.note = String(note || "").trim(); if (!e.state) delete e.state;
  return true;
}
/** Keys of the artefacts an edit added or changed (signatures compared). */
export function changedKeys(before, after) {
  const A = new Map(reviewItems(before).map((x) => [x.key, x.sig]));
  return reviewItems(after).filter((x) => A.get(x.key) !== x.sig).map((x) => x.key);
}
/** What an AI wrote or changed goes back to « Brouillon IA » ; its signature and history stay, so that the next approval makes the next revision. */
export function markDrafts(project, keys) {
  const items = ledger(project); let n = 0;
  for (const key of keys) { if (!artefactOf(project, key)) continue; const e = items[key] || (items[key] = {}); e.state = "draft"; n++; }
  for (const key of Object.keys(items)) if (!artefactOf(project, key)) delete items[key];        // an artefact that left the project leaves the ledger
  return n;
}

/** The request for one complete outside iteration : every note of the review, artefact by artefact, and what must not move. "" when the review asks for nothing. */
export function iterationRequest(project) {
  const all = reviewItems(project), ask = all.filter((x) => x.state === "revise" && x.note), notes = all.filter((x) => x.state !== "revise" && x.note), keep = all.filter((x) => x.state === "ok");
  if (!ask.length && !notes.length) return "";
  const line = (x) => `- ${REVIEW_KINDS[x.kind]} ${x.id}${x.rev ? ` (rév. ${x.rev})` : ""}${x.name ? ` « ${x.name} »` : ""} : ${x.note}`;
  return ["Itération complète après la revue de conception. Applique chaque demande à l'artéfact nommé, et reporte ses conséquences sur ses voisins (une interface changée change des deux côtés, avec la même clé).",
    ...(ask.length ? ["", "À RÉVISER :", ...ask.map(line)] : []), ...(notes.length ? ["", "REMARQUES À PRENDRE EN COMPTE :", ...notes.map(line)] : []),
    ...(keep.length ? ["", `DÉJÀ REVUS — ne les modifie que si une demande ci-dessus l'impose : ${keep.map((x) => x.id).join(", ")}.`] : []),
    "", "Ne retire aucun artéfact, ne change aucun repère. Les analyses seront recalculées par la plateforme : ne donne aucun résultat."].join("\n");
}
/** Rows for the review report : one per artefact. */
export function reviewRows(project) {
  return reviewItems(project).map((x) => [REVIEW_KINDS[x.kind], x.id, x.name, x.rev || "—", REVIEW_STATES[x.state].fr, x.note || (x.history.length ? x.history[x.history.length - 1].note : "")]);
}
