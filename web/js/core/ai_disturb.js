/* DynamiteOrbit — what an answer of an AI DISTURBS, before it is applied (points 2 and 9 c of the plan agreed with JP : « à l'import,
   l'aperçu actuel plus "ce que cela dérange" — interfaces qui ne s'accordent plus, accouplements rompus, écarts de DFx, cas à relancer,
   dessins à refaire —, accepté artéfact par artéfact »).
   The preview of an answer says what it creates and changes (core/ai_door.js planAnswer, the diff of the common loop). This file says what
   that change does to the REST of the product, read from the project itself : an interface another part carries that changes or goes ; a
   mate of an assembly that names an interface the part no longer has ; a DFx finding the part did not have ; an analysis or a load case
   that reads the part ; a drawing whose detail views were placed on the old shape ; a frozen or released revision ; the assemblies that
   mount it ; the twin of a board, the readings of its lab whose block went. Nothing is decided here : each line says what to look at, and
   the person accepts the change, or not, artefact by artefact.
   Three levels, as a review would sort them : « break » (something no longer holds), « redo » (to run or make again), « check » (to look at).
   Pure : no page, no store. */

import { partIssues, assemblyIssues } from "./guide_checks.js";
import { revisionOf } from "./plm_review.js";
import { isSub } from "./asm_levels.js";

export const DISTURB_LEVELS = {
  break: { fr: "Rompu", one: "rompu", many: "rompus", color: "#dc2626", icon: "warning", why: "ce qui tenait ne tient plus" },
  redo: { fr: "À refaire", one: "à refaire", many: "à refaire", color: "#d97706", icon: "refresh", why: "à relancer ou à refaire avec la nouvelle version" },
  check: { fr: "À regarder", one: "à regarder", many: "à regarder", color: "#2563eb", icon: "info", why: "à relire : rien n'est faux, quelque chose a bougé" },
};
const LIST = { part: "parts", assembly: "assemblies", board: "boards" };
/* the same content, whatever the order of its keys : a .dwiz read back writes them in its own order */
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a ?? null)) === JSON.stringify(canon(b ?? null));
/* what makes the shape of a part : a change there touches what reads its geometry ; a new name or a note does not */
const SHAPE = ["ops", "params", "material", "process", "stock", "interfaces", "variants", "variant", "spec", "kind"];
const shapeMoved = (a, b) => SHAPE.some((k) => !same(a && a[k], b && b[k]));
const ifaceOf = (part) => new Map(((part && part.interfaces) || []).filter((i) => i && i.id).map((i) => [i.id, i]));
const keyed = (part) => new Map(((part && part.interfaces) || []).filter((i) => i && i.key).map((i) => [i.key, i]));
const strip = (i) => { const { id, name, note, ...rest } = i || {}; void id; void name; void note; return rest; };

/** What putting `doc` in the project, as the artefact `kind` / `id`, disturbs elsewhere. project : as it is now ; doc : the new artefact
    (null : the artefact goes). → [{ level, kind ("interface" | "mate" | "dfx" | "analysis" | "case" | "drawing" | "revision" | "assembly" | "twin" | "lab" | "isolation"), text, target: { kind, id } }] */
export function disturbs(project, kind, id, doc) {
  const P = project || {}, list = P[LIST[kind]] || [], old = list.find((x) => x.id === id) || null, out = [], add = (level, k, text, target) => out.push({ level, kind: k, text, target: target || { kind, id } });
  if (!old) return out;      // a new artefact disturbs nothing that exists ; what it needs is checked by the preview
  const parts = P.parts || [], asms = P.assemblies || [], findAsm = (x) => asms.find((a) => a.id === x) || null;
  if (kind === "part") {
    const moved = !doc || shapeMoved(old, doc), was = keyed(old), now = keyed(doc);
    /* an interface key another part carries : the two adapt to each other */
    for (const [k, i] of was) { const others = parts.filter((q) => q.id !== id && (q.interfaces || []).some((j) => j && j.key === k)).map((q) => q.id); if (!others.length) continue;
      if (!now.has(k)) add("break", "interface", `L'interface « ${i.name || k} » disparaît : ${others.join(", ")} la porte${others.length > 1 ? "nt" : ""} encore — ${others.length > 1 ? "elles n'ont" : "elle n'a"} plus de vis-à-vis.`, { kind: "part", id: others[0] });
      else if (!same(strip(i), strip(now.get(k)))) add("check", "interface", `L'interface « ${i.name || k} » change : ${others.join(", ")}, qui la porte${others.length > 1 ? "nt" : ""} aussi, ${others.length > 1 ? "s'y accordent-elles" : "s'y accorde-t-elle"} encore ?`, { kind: "part", id: others[0] }); }
    /* a mate of an assembly that names an interface this part no longer has */
    const ids = ifaceOf(doc);
    for (const a of asms) { const mine = new Set((a.instances || []).filter((x) => !isSub(x) && x.part === id).map((x) => x.id)); if (!mine.size) continue;
      const lost = (a.mates || []).filter((m) => [m.a, m.b].some((s) => s && mine.has(s.inst) && s.iface && !ids.has(s.iface)));
      if (lost.length) add("break", "mate", `${lost.length} accouplement${lost.length > 1 ? "s" : ""} de ${a.id} (${lost.map((m) => m.id).slice(0, 4).join(", ")}) nomme${lost.length > 1 ? "nt" : ""} une interface que la pièce n'a plus : rompu${lost.length > 1 ? "s" : ""}.`, { kind: "assembly", id: a.id });
      else if (moved) add("check", "assembly", `${a.id} monte cette pièce : sa construction et ses interférences sont à revoir.`, { kind: "assembly", id: a.id }); }
    /* the DFx findings it did not have */
    if (doc) { const others = new Set(); for (const q of parts) if (q.id !== id) for (const i of q.interfaces || []) if (i && i.key) others.add(i.key);
      const before = new Set(safe(() => partIssues(old, others)).map((x) => x.text)), fresh = safe(() => partIssues(doc, others)).filter((x) => (x.level === "error" || x.level === "warn" || x.level === "todo") && !before.has(x.text));
      for (const x of fresh.slice(0, 4)) add(x.level === "error" ? "break" : "check", "dfx", `Nouveau point du guide : ${x.text}`); }
    if (moved) {
      for (const c of P.physics || []) if (c && c.part === id) add("redo", "analysis", `Le calcul « ${c.name || c.model || c.id} » lit cette pièce : à refaire.`, { kind: "analysis", id: c.id });
      for (const c of P.cases || []) if (c && c.id === id) add("redo", "case", "La simulation de cette pièce (son cas de charge et ses essais) : à relancer — un essai gardé est celui d'avant.", { kind: "case", id: c.id });
      const det = (old.details || []).length; if (det) add("redo", "drawing", `Le dessin se refait de lui-même, mais ${det} vue${det > 1 ? "s" : ""} de détail ${det > 1 ? "ont été tracées" : "a été tracée"} sur l'ancienne forme : à revoir.`, { kind: "part", id });
      for (const b of P.boards || []) if (b && b.part === id) add("check", "twin", `Cette pièce est le jumeau mécanique de la carte ${b.id} : la carte la remet à jour à son prochain changement — ce qui est à elle (contour, fixations) suit la carte.`, { kind: "board", id: b.id });
    }
  }
  if (kind === "assembly") {
    const before = new Set(((old && old.instances) || []).map((i) => i.id)), after = new Set(((doc && doc.instances) || []).map((i) => i.id)), gone = [...before].filter((x) => !after.has(x));
    if (gone.length) { add("check", "assembly", `${gone.length} occurrence${gone.length > 1 ? "s" : ""} retirée${gone.length > 1 ? "s" : ""} (${gone.slice(0, 5).join(", ")}) : ce qui ${gone.length > 1 ? "les" : "la"} nommait — ordre de gamme, étiquettes, épingles — ${gone.length > 1 ? "les" : "la"} perd.`); }
    for (const p of asms) if (p.id !== id && (p.instances || []).some((i) => isSub(i) && i.asm === id)) add("check", "assembly", `${p.id} porte cet assemblage d'un seul bloc : à revoir.`, { kind: "assembly", id: p.id });
    if (doc) { const byId = new Map(parts.map((p) => [p.id, p])), was = new Set(safe(() => assemblyIssues(old, byId, findAsm)).map((x) => x.text)), fresh = safe(() => assemblyIssues(doc, byId, findAsm)).filter((x) => (x.level === "error" || x.level === "warn") && !was.has(x.text));
      for (const x of fresh.slice(0, 4)) add(x.level === "error" ? "break" : "check", "mate", `Nouveau point du guide : ${x.text}`); }
    if (!doc || !same(old.instances, doc.instances) || !same(old.mates, doc.mates)) {
      for (const c of P.cases || []) if (c && c.id === id) add("redo", "case", "La simulation de cet assemblage : à relancer.", { kind: "case", id });
      if (old.isolation || (P.isolation && P.isolation[id])) add("redo", "isolation", "L'isolation (lignes de fuite et distances dans l'air) de cet assemblage : à refaire.");
      add("redo", "drawing", "Le dessin d'ensemble et sa nomenclature se refont d'eux-mêmes : bulles et vues à relire.");
    }
  }
  if (kind === "board") {
    if (old.part && doc && (!same(old.board, doc.board) || !same(old.parts, doc.parts))) add("check", "twin", `Le jumeau mécanique ${old.part} suivra la carte (contour, épaisseur, fixations) dans l'étape même.`, { kind: "part", id: old.part });
    const blocks = new Set(((doc && doc.blocks) || []).map((b) => b.id)), lab = (old.lab && Array.isArray(old.lab.readings) ? old.lab.readings : []).filter((r) => r && typeof r.test === "string" && !r.test.startsWith("BOARD/") && !blocks.has(r.test.split("/")[0]));
    if (lab.length) add("break", "lab", `${lab.length} relevé${lab.length > 1 ? "s" : ""} du Labo appartien${lab.length > 1 ? "nent" : "t"} à un bloc que la réponse retire : gardé${lab.length > 1 ? "s" : ""}, mais sans essai.`);
    if (old.isolation && doc && (!same(old.nets, doc.nets) || !same(old.tracks, doc.tracks) || !same(old.parts, doc.parts))) add("redo", "isolation", "L'isolation de la carte (cuivre réel, par potentiel) : à refaire.");
    if (doc && !same(old.blocks, doc.blocks)) add("redo", "lab", "Les essais du Labo des blocs changés : à simuler de nouveau, et le plan de test à refaire.");
  }
  /* a frozen or released revision never changes : the change goes to a new one */
  const rv = safe(() => revisionOf(P, `${kind}:${id}`, old), null); if (rv && (rv.state === "frozen" || rv.state === "released")) add("check", "revision", `${rv.name} est ${rv.state === "frozen" ? "gelée" : "libérée"} : elle ne change pas — ce changement ira dans une nouvelle révision.`);
  return out;
}
function safe(fn, dflt = []) { try { const v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } }

/** What a whole plan disturbs, row by row (each row of core/ai_door.js planAnswer that modifies) : → Map(row id → [disturbances]) ; the
    project is taken as it would be with the rows accepted before it, so that two changes that go together are read together. */
export function planDisturbs(project, rows) {
  const out = new Map(); if (!project) return out;
  for (const r of rows || []) if (r && r.action === "modify" && LIST[r.kind] && r.doc) out.set(`${r.kind}:${r.id}`, disturbs(project, r.kind, r.id, r.doc));
  return out;
}
/** A list of disturbances, counted by level : « 1 rompu, 2 à refaire ». */
export function disturbWords(list) {
  const n = (l) => (list || []).filter((x) => x.level === l).length, w = (k, l) => (k ? `${k} ${k > 1 ? DISTURB_LEVELS[l].many : DISTURB_LEVELS[l].one}` : "");
  return [w(n("break"), "break"), w(n("redo"), "redo"), w(n("check"), "check")].filter(Boolean).join(", ") || "rien ailleurs";
}
/** Rows the person keeps : a row refused takes with it the rows that need it (an assembly that mounts a part the answer creates and that
    was refused, the sheet of a drawing of it). rows : planAnswer rows, each possibly { off: true }. → the rows, with off set and `offBy` said. */
export function acceptRows(rows) {
  const R = (rows || []).map((r) => ({ ...r })), refused = () => new Set(R.filter((r) => r.off && r.action === "create").map((r) => `${r.kind}:${r.id}`));
  let changed = true;
  while (changed) { changed = false; const no = refused();
    for (const r of R) { if (r.off || !r.doc || (r.action !== "create" && r.action !== "modify")) continue;
      const needs = r.kind === "assembly" ? (r.doc.instances || []).map((i) => (isSub(i) ? `assembly:${i.asm}` : `part:${i.part}`)) : r.kind === "drawing" ? [`${r.of}:${r.target}`] : [];
      const by = needs.find((k) => no.has(k)); if (by) { r.off = true; r.offBy = by.split(":")[1]; changed = true; } } }
  return R;
}
