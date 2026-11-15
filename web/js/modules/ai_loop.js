/* DesignWizard.ai — the AI round trip, as a dialogue : pick an artefact, say what you want done the way you would
   ask a technician or a trainee, copy the request with the artefact, paste the answer, read the list of changes,
   apply — or not. One undoable step ; the human stays in the loop. It works from every screen, on the artefact the
   screen shows or on any other artefact of the project : a part, an assembly, a board, or the whole project. */

import { el, btn, badge, toast, modal, copyText, download } from "../core/dom.js";
import { aiBrief, aiRead, aiDiff } from "../core/ai_loop.js";
import { toDwiz } from "../core/dwiz.js";
import { dwizFileName } from "../core/dwiz_names.js";
import { store } from "../core/store.js";
import { validateSpec } from "../cad/build.js";
import { markAiDraft } from "../core/ai_draft.js";
import { markDrafts, changedKeys } from "../core/review.js";
import { adoptIteration } from "../core/first_design.js";

/* What an answer changes goes back to « Brouillon IA » in the review ledger, inside the very step that applies it. */
let applying = null;
store.hooks.push((p) => { if (applying) markDrafts(p, applying); });
/** The whole project, without its review ledger : the notes travel in the request, the ledger stays here. */
const shed = (d) => { delete d.review; delete d.mvp; delete d.team; delete d.talk; return d; };      // the ledgers — review states, MVP iterations — stay here

const STEP_MARK = "(géométrie STEP importée, non modifiable)";
/** A copy fit for reading : the imported STEP geometry of a part is replaced by a note. */
function lighten(doc) {
  const d = JSON.parse(JSON.stringify(doc));
  for (const p of d.parts && Array.isArray(d.parts) && d.dw && /^project/.test(d.dw) ? d.parts : [d]) if (p && p.step && typeof p.step === "object" && String(p.step.text || "").length > 2000) p.step = STEP_MARK;
  return d;
}
/** Puts back what lighten() took away, part by part. */
function restoreSteps(doc, original) {
  const src = new Map((original.parts && /^project/.test(original.dw || "") ? original.parts : [original]).map((p) => [p.id, p]));
  for (const p of doc.parts && /^project/.test(doc.dw || "") ? doc.parts : [doc]) if (p && p.step === STEP_MARK) { if (src.get(p.id) && src.get(p.id).step) p.step = src.get(p.id).step; else delete p.step; }
  return doc;
}
const replace = (target, doc) => { for (const k of Object.keys(target)) if (k !== "id") delete target[k]; Object.assign(target, doc, { id: target.id }); };
const partCheck = (d) => { const v = validateSpec(d); return [...v.errors.map((t) => ({ severity: "block", text: `${d.id || "Pièce"} : ${t}` })), ...v.warnings.map((t) => ({ severity: "warn", text: `${d.id || "Pièce"} : ${t}` }))]; };
const asmCheck = (d, parts) => (d.instances || []).filter((i) => !parts.has(i.part)).map((i) => ({ severity: "block", text: `${d.id} : la pièce « ${i.part} » n'existe pas dans le projet.` }));

/** Every artefact of the open project that can make the round trip : [{ key, label, open() }]. */
export function aiTargets() {
  const p = store.project, out = [];
  if (!p) return out;
  for (const b of p.boards || []) out.push({ key: `board:${b.id}`, label: `Carte ${b.id} — ${b.name || ""}`, open: async () => { const { boardAiHelp, boardAiCheck } = await import("./pcba_out.js"); return { doc: b, title: `Confier la carte ${b.id} à l'IA`, help: boardAiHelp(), check: (d) => boardAiCheck(b, d), draft: (d) => markAiDraft(b, d, "board"), apply: (d) => store.updateBoard(b.id, (x) => replace(x, d), `Carte ${b.id} mise à jour par l'IA`) }; } });
  for (const a of p.assemblies || []) out.push({ key: `assembly:${a.id}`, label: `Assemblage ${a.id} — ${a.name || ""}`, open: async () => ({ doc: a, title: `Confier l'assemblage ${a.id} à l'IA`, help: ["Une ligne « place » par pièce posée ; une ligne « mate » par paire d'interfaces accouplées. Ne cite que des pièces du projet."],
    check: (d) => asmCheck(d, new Set(store.parts.map((x) => x.id))), apply: (d) => store.updateAssembly(a.id, (x) => replace(x, d), `Assemblage ${a.id} mis à jour par l'IA`) }) });
  for (const s of p.parts || []) out.push({ key: `part:${s.id}`, label: `Pièce ${s.id} — ${s.name || ""}`, open: async () => ({ doc: lighten(s), title: `Confier la pièce ${s.id} à l'IA`, help: ["Garde les « key » des interfaces : elles lient la pièce à ses voisines.", "Une cote s'écrit par un paramètre (param) plutôt que par un nombre répété."],
    check: partCheck, apply: (d) => store.updatePart(s.id, (x) => replace(x, restoreSteps(d, s)), `Pièce ${s.id} mise à jour par l'IA`) }) });
  out.push({ key: "project", label: `Projet entier — ${p.name || p.id}`, open: async () => ({ doc: shed(lighten(p)), title: "Confier le projet à l'IA",
    help: ["Le projet porte ses pièces, ses assemblages et ses cartes à la suite, chacun commençant par sa ligne « dwiz … » ; ses analyses (physics, simulation) sont dans le premier document.", "Ne retire aucun document sans que la demande le dise ; garde les numéros.", "Pour une analyse (physics), ne change que ses données d'entrée (inputs) : la plateforme recalcule ses résultats."],
    check: async (d) => {
      const notes = [], ids = new Set((d.parts || []).map((x) => x.id));
      for (const x of d.parts || []) notes.push(...partCheck(x.step === STEP_MARK ? { ...x, step: undefined } : x));
      for (const a of d.assemblies || []) notes.push(...asmCheck(a, ids));
      if ((d.boards || []).length) { const { boardAiCheck } = await import("./pcba_out.js"); for (const b of d.boards) notes.push(...boardAiCheck((p.boards || []).find((q) => q.id === b.id) || { blocks: [] }, b).filter((n) => n.severity === "block").map((n) => ({ ...n, text: `${b.id} : ${n.text}` }))); }
      return notes;
    }, draft: (d) => { const all = { drafts: [], norms: [] }; for (const nb of d.boards || []) { const m = markAiDraft((p.boards || []).find((q) => q.id === nb.id) || {}, nb, "board"); all.drafts.push(...m.drafts.map((x) => ({ ...x, key: `${nb.id} ${x.key}` }))); all.norms.push(...m.norms); } return all; },
      apply: (d) => store.commit("Projet mis à jour par l'IA", (x) => { const before = JSON.parse(JSON.stringify(x)); replace(x, adoptIteration(before, restoreSteps(d, p))); markDrafts(x, changedKeys(before, x)); }) }) });
  return out;
}
/** Key of the artefact the current screen shows. */
export function currentAiTarget() {
  const [key, id] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (key === "pcba" && store.boards.length) return `board:${(store.board(id) || store.boards[0]).id}`;
  if (id && store.part(id)) return `part:${id}`;
  if (id && store.assembly(id)) return `assembly:${id}`;
  return "project";
}

/** opts : { doc, title, help: [lines], check(newDoc) → [{ severity, text }] (may be async), draft(newDoc) → { drafts, norms }
    (tags what the answer adds or changes as « Brouillon IA »), apply(newDoc), targets, target }. */
export function openAiLoop(opts) {
  const ask = el("textarea", { rows: 3, placeholder: "Ce que vous demanderiez à un technicien : « passe le régulateur à 2 A », « ajoute quatre trous M4 aux coins », « renomme les nets du bus CAN »…", style: { width: "100%" } });
  const answer = el("textarea", { rows: 7, placeholder: "Collez ici la réponse de l'IA (l'artéfact complet, commençant par « dwiz … »).", spellcheck: false, style: { width: "100%", fontFamily: "var(--mono, monospace)", fontSize: ".78rem" } });
  const out = el("div", { class: "ai-diff" }), go = btn("Importer les changements", null, { primary: true, icon: "check", disabled: true });
  let next = null, turn = 0, m = null;
  const read = async () => {
    const mine = ++turn; out.replaceChildren(); next = null; go.disabled = true;
    if (!answer.value.trim()) return;
    try {
      const doc = aiRead(answer.value);
      if (doc.id !== opts.doc.id) out.append(el("p", { class: "atelier-hint warn" }, `La réponse porte le numéro « ${doc.id} » : il est ramené à « ${opts.doc.id} ».`));
      doc.id = opts.doc.id; if (opts.doc.dw && !doc.dw) doc.dw = opts.doc.dw;
      const notes = opts.check ? await opts.check(doc) : [], diff = aiDiff(opts.doc, doc);     // check() may complete the answer (a block built again) : the list shows the whole consequence
      if (mine !== turn) return;
      out.append(el("p", null, el("b", null, diff.length ? `${diff.length} changement(s)` : "Aucun changement"), " ", ...["added", "changed", "removed"].map((k) => { const n = diff.filter((d) => d.kind === k).length; return n ? badge(`${n} ${{ added: "ajout(s)", changed: "modification(s)", removed: "retrait(s)" }[k]}`, { added: "ok", changed: "warn", removed: "danger" }[k]) : null; })));
      out.append(el("ul", { class: "small" }, diff.slice(0, 60).map((d) => el("li", { class: `ai-${d.kind}` }, d.text)), diff.length > 60 ? el("li", { class: "muted" }, `… et ${diff.length - 60} autres`) : null));
      for (const n of notes) out.append(el("p", { class: `atelier-hint ${n.severity === "info" ? "" : "warn"}` }, n.text));
      const dr = opts.draft ? opts.draft(JSON.parse(JSON.stringify(doc))) : null;      // an essai à blanc : what would arrive as a draft, which standards the answer names
      if (dr && dr.drafts.length) out.append(el("p", { class: "atelier-hint" }, `${dr.drafts.length} élément(s) de l'arbre fonctionnel arriveront en « Brouillon IA » (${dr.drafts.slice(0, 8).map((x) => x.key).join(", ")}${dr.drafts.length > 8 ? "…" : ""}) : à confirmer par un humain avant la revue.`));
      if (dr && dr.norms.length) out.append(el("p", { class: "atelier-hint warn" }, `Normes citées par l'IA : ${dr.norms.join(", ")}. Aucune n'est tenue pour référence tant que vous n'avez pas confirmé son édition et sa clause.`));
      if (diff.length && !notes.some((n) => n.severity === "block")) { next = doc; go.disabled = false; }
      else if (notes.some((n) => n.severity === "block")) out.append(el("p", { class: "form-error" }, "La réponse ne peut pas être appliquée telle quelle : corrigez-la ou redemandez-la."));
    } catch (e) { if (mine === turn) out.append(el("p", { class: "form-error" }, e.message)); }
  };
  answer.addEventListener("input", read);
  const pick = opts.targets && opts.targets.length > 1 ? el("label", { class: "field" }, el("span", { class: "field-label" }, "Artéfact"), el("select", { onChange: async (e) => { const t = opts.targets.find((x) => x.key === e.target.value); if (!t) return; const text = ask.value; m.close(); const again = await openAiLoopFor(t.key); if (again && text) again.ask.value = text; } }, opts.targets.map((t) => el("option", { value: t.key, selected: t.key === opts.target }, t.label)))) : null;
  m = modal(opts.title || "Confier à l'IA", el("div", { class: "ai-loop" },
    opts.context ? el("p", { class: "atelier-hint" }, "La gamme calculée part avec l'artéfact, pour référence : l'IA peut l'annoter (notes par phase, points à discuter) ou modifier ce qui la produit.") : null,
    el("p", { class: "muted small" }, "Le même geste partout, comme sur DynamiteAgile : on copie pour l'IA, on travaille avec l'assistant de son choix, on réimporte avec un aperçu. L'artéfact part en texte lisible (.dwiz) ; rien ne quitte votre poste sans votre geste. Au retour, la vérification est un essai à blanc : chaque changement se voit avant d'être importé — une seule étape, annulable."),
    pick, el("h3", null, "1. Votre demande"), ask,
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Copier pour l'IA", async () => { await copyText(aiBrief(opts.doc, ask.value, opts.help || [], opts.context)); toast("Copié : collez-le dans votre assistant IA.", "success"); }, { primary: true, icon: "copy" }),
      btn("Télécharger l'artéfact (.dwiz)", () => download(dwizFileName(opts.doc), toDwiz(opts.doc), "text/plain"), { icon: "download" })),
    el("h3", null, "2. Importer d'une IA"), answer, out,
    el("div", { class: "form-actions" }, go)), { wide: true });
  go.addEventListener("click", () => { if (!next) return; try { const dr = opts.draft ? opts.draft(next) : null; opts.apply(next); toast(dr && dr.drafts.length ? `Importé : ${dr.drafts.length} élément(s) en « Brouillon IA » à confirmer dans l'arbre fonctionnel${dr.norms.length ? `, ${dr.norms.length} norme(s) à confirmer` : ""}. Ctrl+Z pour revenir en arrière.` : "Changements importés (Ctrl+Z pour revenir en arrière).", "success", 7000); m.close(); } catch (e) { toast(e.message, "error"); } });
  return { ...m, ask, answer };
}

/** The round trip on one artefact of the project, with the list of the others to switch to.
    more : { help: [lines], context: text } — what the calling screen adds (a routing sheet given for reference…). */
export async function openAiLoopFor(key, more = {}) {
  if (!store.project) { toast("Ouvrez d'abord un projet.", "info"); return null; }
  const targets = aiTargets(), t = targets.find((x) => x.key === key) || targets[targets.length - 1], o = await t.open();
  const apply = o.apply, own = t.key === "project" ? null : [t.key];           // the project marks its own changes, artefact by artefact
  const dlg = openAiLoop({ ...o, apply: (d) => { applying = own; try { return apply(d); } finally { applying = null; } }, help: [...(o.help || []), ...(more.help || [])], context: more.context || "", targets, target: t.key });
  if (more.ask && dlg) dlg.ask.value = more.ask;                                // the note of the review becomes the request
  return dlg;
}
/** The round trip for whatever the current screen shows : a board, a part, an assembly — otherwise the whole project. */
export const openCurrentAiLoop = () => openAiLoopFor(currentAiTarget());
