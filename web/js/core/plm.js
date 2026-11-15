/* DesignWizard.ai — released revisions : what a product is made of, frozen. A part, an assembly or a board is RELEASED : it
   receives its number, its content is frozen as a revision, and that revision never changes again. Working goes on in the
   project ; the next release asks one question — form, fit, function (3F) : may the item of today take the place of the
   released one, and the released one its place, everywhere ?
     yes → the same number, the next revision (A → B) ;
     no  → a NEW number, revision A, which remembers the number and the revision it derives from (quality traceability).
   An assembly is released WITH the revision of each of its parts : those are pinned. A part that moves on afterwards is
   not taken as compatible with that assembly revision — it is in the next release of the assembly, or it is not.
   Numbers follow the Reference Generator of DynamiteAgile : TYPE-DDDDD-TTTTT, the Excel serial of the moment (UTC) —
   days since 1899-12-30, then the time of day in 1/100 000 of a day. A number is never reused, a release never erased.
     artefact.pn, artefact.revision, artefact.derivedFrom = { pn, rev, why }
     project.plm = { releases: [{ id, key, pn, rev, name, at, by, sig, doc (the frozen artefact), form: { size, mass },
                                  uses: { part id: { pn, rev } }, ext (assembly : its outer interfaces), from: { pn, rev }, f3 }] }
   Pure functions : the caller applies them inside one undoable step. */

import { signature, nextRevision, artefactOf, partsOf } from "./review.js";
import { resolveParams, evalDeep } from "../cad/expr.js";

export const REF_TYPES = { part: "PRT", assembly: "ASM", board: "PCB" };
export const F3 = { form: "Forme", fit: "Ajustement", fn: "Fonction" };
const DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30), UNITS = 100000, clone = (x) => JSON.parse(JSON.stringify(x)), r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ",");
const plmOf = (project) => { project.plm = project.plm || { releases: [] }; project.plm.releases = project.plm.releases || []; return project.plm; };
export const releases = (project) => (project && project.plm && project.plm.releases) || [];

/** The Excel serial of a moment, UTC : [days since 1899-12-30, time of day in 1/100 000 of a day]. */
export function serialParts(date) { const days = (date.getTime() - EPOCH) / DAY; let d = Math.floor(days), t = Math.round((days - d) * UNITS); if (t >= UNITS) { d += 1; t = 0; } return [d, t]; }
export const reference = (type, d, t) => `${type}-${String(d).padStart(5, "0")}-${String(t).padStart(5, "0")}`;
/** A number nobody bears : the serial of the moment, or the next free one. */
export function newReference(project, kind, date = new Date()) {
  const type = REF_TYPES[kind], taken = new Set([...releases(project).map((r) => r.pn), ...["parts", "assemblies", "boards"].flatMap((l) => (project[l] || []).map((x) => x.pn))].filter(Boolean));
  let [d, t] = serialParts(date); while (taken.has(reference(type, d, t))) { t += 1; if (t >= UNITS) { d += 1; t = 0; } }
  return reference(type, d, t);
}
/** « number_revision title » : the name of the folder and of the file of a released revision. */
export const releaseName = (pn, rev, title) => `${pn}_${rev}${title ? ` ${String(title).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim()}` : ""}`;

/* ---------- form, fit, function ---------- */
const IFACE = ["type", "key", "side", "face", "level", "at", "rot", "body", "params", "opts", "external"];
/** The interfaces of a part as numbers : an interface moved by a parameter has moved. → Map(id → { name, sig }) */
function interfacesOf(part) {
  let scope = {}; try { scope = resolveParams(part.params || {}).scope; } catch (e) { scope = {}; }
  return new Map((part.interfaces || []).map((i) => { let v = i; try { v = evalDeep(i, scope); } catch (e) { v = i; } return [String(i.id), { name: i.name || String(i.id), sig: signature(Object.fromEntries(IFACE.filter((k) => v[k] !== undefined).map((k) => [k, v[k]]))) }]; }));
}
/** The interfaces an assembly offers to what is around it : those of its parts that no mate uses. → Map("instance/interface" → { name, sig }) */
export function outerInterfaces(project, asm) {
  const used = new Set((asm.mates || []).flatMap((m) => [m.a, m.b].filter(Boolean).map((e) => `${e.inst}/${e.iface}`))), out = new Map();
  for (const inst of asm.instances || []) { const p = (project.parts || []).find((x) => x.id === inst.part); if (!p) continue; for (const [id, v] of interfacesOf(p)) if (!used.has(`${inst.id}/${id}`)) out.set(`${inst.id}/${id}`, { name: `${p.name || p.id} — ${v.name}`, sig: v.sig }); }
  return out;
}
const sameText = (a, b) => String(a || "").replace(/\s+/g, " ").trim() === String(b || "").replace(/\s+/g, " ").trim();
function mapDiff(was, now, what) {
  const out = []; for (const [id, w] of was) { const n = now.get(id); if (!n) out.push(`${what} « ${w.name} » retirée`); else if (n.sig !== w.sig) out.push(`${what} « ${n.name} » modifiée`); }
  for (const [id, n] of now) if (!was.has(id)) out.push(`${what} « ${n.name} » ajoutée`);
  return out;
}
/** Form, fit, function between a release and the artefact of today. o.form : { size: [x, y, z], mass } of today, from the kernel.
    → { ok, form: [reasons], fit: [reasons], fn: [reasons], judged: { form } } — a reason on any of the three breaks interchangeability. */
export function formFitFunction(project, kind, rel, now, o = {}) {
  const was = rel.doc, form = [], fit = [], fn = [];
  if (kind === "assembly") fit.push(...mapDiff(new Map(rel.ext || []), outerInterfaces(project, now), "interface extérieure"));
  else fit.push(...mapDiff(interfacesOf(was), interfacesOf(now), "interface"));
  if (rel.form && o.form) { const a = rel.form.size, b = o.form.size, names = ["longueur", "largeur", "hauteur"];
    for (let i = 0; i < 3; i++) if (Math.abs(a[i] - b[i]) > 0.05) form.push(`${names[i]} hors tout ${fr(a[i])} → ${fr(b[i])} mm`);
    if (rel.form.mass > 0 && Math.abs(o.form.mass - rel.form.mass) / rel.form.mass > 0.02) form.push(`masse ${fr(rel.form.mass)} → ${fr(o.form.mass)} g`); }
  if (kind !== "assembly" && (was.material || "") !== (now.material || "")) fn.push(`matériau ${was.material || "—"} → ${now.material || "—"}`);
  if (!sameText(was.function, now.function)) fn.push("fonction réécrite");
  if (signature(was.elec || {}) !== signature(now.elec || {})) fn.push("rôle électrique modifié");
  if (was.library || now.library) { const a = was.library || {}, b = now.library || {}; if (["ref", "a", "v", "poles"].some((k) => a[k] !== b[k])) fn.push("composant de bibliothèque ou valeurs nominales modifiés"); }
  return { ok: !form.length && !fit.length && !fn.length, form, fit, fn, judged: { form: !!(rel.form && o.form) } };
}
/** The reasons of a 3F verdict, in one line. */
export const f3Text = (f3) => ["form", "fit", "fn"].filter((k) => f3[k].length).map((k) => `${F3[k]} : ${f3[k].join(", ")}`).join(" · ");

/* ---------- releasing ---------- */
/** The last release of the number an artefact bears. */
export function lastRelease(project, key) { const d = artefactOf(project, key); return d && d.pn ? releases(project).filter((r) => r.pn === d.pn).at(-1) || null : null; }
/** The parts of an assembly, each with the number and the revision it has now, and whether that is a released state. */
export function usesOf(project, asm) {
  const out = {};
  for (const id of new Set((asm.instances || []).map((i) => i.part))) { const p = (project.parts || []).find((x) => x.id === id); if (!p) continue;
    const rec = p.pn ? releases(project).find((r) => r.pn === p.pn && r.rev === (p.revision || "A")) : null;      // released : the part is, to the letter, one of the revisions of its number — the latest or an earlier one taken back
    out[id] = { pn: p.pn || null, rev: p.revision || "A", released: !!rec && rec.sig === signature(p) }; }
  return out;
}
/** What releasing an artefact would do, without doing it. → { action : "first" | "none" | "revision" | "number", pn, rev, from, f3, blockers } */
export function planRelease(project, key, o = {}) {
  const d = artefactOf(project, key), kind = key.split(":")[0]; if (!d || !REF_TYPES[kind]) return null;
  const last = lastRelease(project, key), blockers = [], uses = kind === "assembly" ? usesOf(project, d) : null;
  if (uses) for (const [id, u] of Object.entries(uses)) if (!u.released) blockers.push(`${id} : ${u.pn ? "modifiée depuis sa dernière révision libérée" : "jamais libérée"} — la libérer d'abord`);
  if (!last) return { action: "first", pn: d.pn || null, rev: d.revision || "A", blockers, f3: null };
  const moved = uses ? Object.entries(uses).filter(([id, u]) => !last.uses || !last.uses[id] || last.uses[id].pn !== u.pn || last.uses[id].rev !== u.rev).map(([id]) => id) : [];
  if (last.sig === signature(d) && !moved.length && !blockers.length && (!uses || Object.keys(last.uses || {}).every((id) => uses[id]))) return { action: "none", pn: d.pn, rev: last.rev, blockers: [], f3: null };
  const f3 = formFitFunction(project, kind, last, d, o);
  return f3.ok ? { action: "revision", pn: d.pn, rev: nextRevision(last.rev), f3, blockers, moved } : { action: "number", pn: null, rev: "A", from: { pn: last.pn, rev: last.rev }, f3, blockers, moved };
}
/** Releases an artefact : its number the first time ; then the next revision when form, fit and function hold, a new number when
    they do not. The content is frozen. o : { date, by, form: { size, mass } }. → the plan, with `release` (the record) and done. */
export function release(project, key, o = {}) {
  const plan = planRelease(project, key, o); if (!plan) throw new Error("Cet artéfact ne se libère pas : seuls une pièce, un assemblage ou une carte portent un numéro.");
  if (plan.blockers.length) throw new Error(`Avant de libérer : ${plan.blockers.join(" ; ")}.`);
  if (plan.action === "none") return { ...plan, done: false };
  const d = artefactOf(project, key), kind = key.split(":")[0], date = o.date || new Date(), when = date.toISOString();
  if (plan.action === "first") { d.pn = d.pn || newReference(project, kind, date); d.revision = d.revision || "A"; }
  else if (plan.action === "revision") d.revision = plan.rev;
  else { d.derivedFrom = { pn: plan.from.pn, rev: plan.from.rev, why: f3Text(plan.f3) }; d.pn = newReference(project, kind, date); d.revision = "A"; }
  const rec = { id: `${d.pn}_${d.revision}`, key, pn: d.pn, rev: d.revision, name: d.name || "", at: when, ...(o.by ? { by: o.by } : {}), sig: signature(d), doc: clone(d), ...(o.form ? { form: { size: o.form.size.map(r2), mass: r2(o.form.mass) } } : {}),
    ...(kind === "assembly" ? { uses: Object.fromEntries(Object.entries(usesOf(project, d)).map(([id, u]) => [id, { pn: u.pn, rev: u.rev }])), ext: [...outerInterfaces(project, d)] } : {}), ...(plan.action === "number" ? { from: plan.from } : {}), ...(plan.f3 ? { f3: { ok: plan.f3.ok, text: f3Text(plan.f3) } } : {}) };
  plmOf(project).releases.push(rec);
  /* the review ledger follows : a released revision is a validated one */
  project.review = project.review || { items: {} }; project.review.items = project.review.items || {};
  const e = project.review.items[key] || (project.review.items[key] = {}), note = plan.action === "number" ? `${rec.id} libérée — nouveau numéro, dérivé de ${plan.from.pn} rév. ${plan.from.rev} : ${f3Text(plan.f3)}` : `${rec.id} libérée${plan.action === "revision" ? " — forme, ajustement et fonction conservés" : ""}`;
  e.history = [...(e.history || []), { rev: d.revision, when, note }]; Object.assign(e, { state: "ok", sig: signature(d), when, note: "", rev: d.revision, ...(o.by ? { by: o.by } : {}), ...(kind === "assembly" ? { parts: partsOf(project, d) } : {}) });
  return { ...plan, pn: d.pn, rev: d.revision, done: true, release: rec };
}
/** Is the assembly of today the one that was released ? Each part : the revision pinned in the last release of the assembly, the one
    it has now, and what that means. A part that moved on is NOT taken as compatible with the released assembly. */
export function compatibility(project, key) {
  const asm = artefactOf(project, key), last = lastRelease(project, key); if (!asm) return [];
  const now = usesOf(project, asm), pinned = (last && last.uses) || {};
  return [...new Set([...Object.keys(pinned), ...Object.keys(now)])].map((id) => { const w = pinned[id] || null, n = now[id] || null;
    const state = !last ? "unreleased" : !n ? "removed" : !w ? "added" : !n.released ? "working" : w.pn !== n.pn ? "number" : w.rev !== n.rev ? "revision" : "same";
    return { part: id, pinned: w, now: n, state, text: { unreleased: "assemblage jamais libéré", removed: "retirée de l'assemblage", added: "ajoutée depuis la libération", working: "modifiée, pas encore libérée", number: "nouveau numéro : 3F rompu, à requalifier dans un nouvel assemblage",
      revision: "révision plus récente : interchangeable par la règle 3F, mais pas validée dans cette révision de l'assemblage", same: "celle de l'assemblage libéré" }[state], ok: state === "same" }; });
}
/** The working artefact goes back to a released revision (the caller makes it one undoable step). → the artefact, or null. */
export function restore(project, id) {
  const rec = releases(project).find((r) => r.id === id); if (!rec) return null;
  const [kind, aid] = rec.key.split(":"), list = project[{ part: "parts", assembly: "assemblies", board: "boards" }[kind]] || [], at = list.findIndex((x) => String(x.id) === aid); if (at < 0) return null;
  list[at] = clone(rec.doc); return list[at];
}
/** What the released revisions give to keep apart : a folder each, named after its number and revision, with the frozen file. toText : artefact → .dwiz */
export const releaseFiles = (project, toText, root = "06_Revisions") => releases(project).map((r) => { const name = releaseName(r.pn, r.rev, r.name); return { path: [root, name], name: `${name}.dwiz`, mime: "text/plain", bytes: toText(r.doc), release: r.id }; });
/** Rows for the report : every release, the latest of each number first. */
export function plmRows(project) {
  return [...releases(project)].reverse().map((r) => [r.pn, r.rev, r.name, String(r.at).slice(0, 10), r.from ? `${r.from.pn} rév. ${r.from.rev}` : "—", r.f3 ? (r.f3.ok ? "3F conservé" : `3F rompu — ${r.f3.text}`) : "première libération",
    r.uses ? Object.entries(r.uses).map(([id, u]) => `${id} = ${u.pn} rév. ${u.rev}`).join(" · ") : ""]);
}
