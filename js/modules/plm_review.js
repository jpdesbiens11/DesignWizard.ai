/* DynamiteOrbit.ai — Révisions : the state of a revision, shown so that it cannot be missed, and the lean design review that
   takes a FROZEN revision to RELEASED (core/plm_review.js). The dialog prepares the list — what the tool could check itself,
   measured here on the frozen content (the DFx of a part, whether an assembly builds, the rules of a board) — and the
   approver, someone else than the author, confirms the rest, writes the decision and the open points. One undoable step.
   What it follows : a review form with a sign-off (a modal dialog, labelled fields, the action disabled until it can be
   done, and the reasons listed). Nothing is decided here. */

import { el, btn, badge, icon, toast, modal, download, field } from "../core/dom.js";
import { docMeta } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { buildAssembly } from "../core/asm_scene.js";
import { runDfx } from "../analysis/dfx_api.js";
import { erc } from "../pcba/erc.js";
import { checkBoard } from "../pcba/drc.js";
import { LIBRARY } from "../pcba/library.js";
import { labSummary } from "../pcba/lab_plan.js";
import { pdfDoc } from "../core/pdfdoc.js";
import { REV_STATES, stateOf, reviewItems, reviewProblems, decide, reviewDoc } from "../core/plm_review.js";

/** The name and the state of a revision, as one chip : « PRT-… rév. B · Gelée ». moved : the project changed since. */
export function revisionChip(info) {
  const S = REV_STATES[info.state], chip = el("span", { class: `rev-chip ${info.state}`, style: `--dom:${S.color}`, "data-rev-state": info.state, "data-tip": `${S.label} (${S.en}) — ${S.text}${info.moved ? " Le projet a changé depuis : la suite se gèlera dans la révision suivante." : ""}` }, icon(S.icon), el("code", null, info.name), el("b", null, S.label), info.moved ? el("small", null, "+ en travail") : null);
  return chip;
}
/* what the tool can measure by itself, on the FROZEN content */
async function factsOf(rec) {
  const kind = rec.key.split(":")[0], f = {};
  try {
    if (kind === "part") { const b = await kernel.build(rec.doc), r = await runDfx(rec.doc, b), n = (s) => (r.findings || []).filter((x) => x.severity === s).length; if (!r.unavailable) f.dfx = { errors: n("error"), warns: n("warn") }; }
    else if (kind === "assembly") { const c = await buildAssembly(rec.doc); f.builds = { errors: (c.errors || []).length }; }
    else { f.erc = erc(rec.doc, LIBRARY).summary; f.drc = checkBoard(rec.doc, LIBRARY).summary; const L = labSummary(rec.doc); f.lab = { tests: L.tests, measured: L.measured }; }
  } catch (e) { /* what could not be measured is left to the approver : the list says so by not having the line */ }
  return f;
}
const MARK = { ok: ["conforme", "ok"], warn: ["à vérifier", "warn"], fail: ["non conforme", "bad"], todo: ["à confirmer", "neutral"], na: ["sans objet", "neutral"] };
const sheet = (rec, facts) => { const d = reviewDoc(store.project, rec, { date: new Date(), facts }); download(`${rec.pn}_${rec.rev}-revue-de-conception.pdf`, pdfDoc({ ...d, kind: "Revue de conception", ...docMeta() }), "application/pdf"); };

/** Opens the review of a revision : to decide when it is frozen, to read when its review is closed. */
export async function openReview(rec) {
  const closed = stateOf(rec) !== "frozen", body = el("div", { class: "rev-review" }, el("p", { class: "muted" }, icon("info"), " La liste se prépare : l'outil vérifie ce qu'il sait vérifier sur le contenu gelé…")), m = modal(`Revue de conception — ${rec.pn} rév. ${rec.rev}`, [body], { wide: true });
  const facts = closed ? {} : await factsOf(rec), items = closed ? rec.review.items : reviewItems(store.project, rec, facts), ticks = {};
  const list = (onTick) => el("ul", { class: "rev-items" }, items.map((it) => { const M = MARK[it.state] || MARK.todo, box = it.how === "confirm" && !closed ? el("input", { type: "checkbox", "data-rev-tick": it.id, "aria-label": it.label, onChange: (e) => { ticks[it.id] = e.target.checked; onTick(); } }) : null;
    return el("li", { class: `rev-item ${it.state}`, "data-rev-item": it.id }, box ? el("label", { class: "check" }, box, el("span", null, el("b", null, it.label))) : el("span", null, el("b", null, it.label)), badge(it.how === "auto" ? "vérifié par l'outil" : "à confirmer par l'approbateur", "neutral"), closed || it.how === "auto" ? badge(M[0], M[1]) : null, it.text ? el("small", { class: "muted" }, it.text) : null); }));
  if (closed) { const rv = rec.review, S = REV_STATES[stateOf(rec)];
    body.replaceChildren(...[el("p", null, revisionChip({ name: `${rec.pn} rév. ${rec.rev}`, state: stateOf(rec) }), ` ${S.text}`), el("p", null, el("b", null, rv.decision === "released" ? "Libérée" : "Refusée"), ` le ${String(rv.at).slice(0, 10)} par ${rv.by} — auteur de la révision : ${rec.by || "—"}.`), el("p", { class: "lab-why" }, el("b", null, "Justification. "), rv.why), list(() => {}),
      rv.open.length ? el("div", null, el("h3", null, "Points ouverts"), el("ul", { class: "decisions" }, rv.open.map((t) => el("li", null, t)))) : null, el("div", { class: "form-actions" }, btn("Fermer", () => m.close()), btn("Fiche de revue (PDF)", () => sheet(rec, {}), { icon: "pdf", primary: true }))].filter(Boolean));
    return; }
  const by = el("input", { type: "text", "data-rev-by": "", placeholder: "Nom de l'approbateur", autocomplete: "off" }), why = el("textarea", { rows: 2, "data-rev-why": "", placeholder: "Ce qui justifie la décision" }), open = el("textarea", { rows: 2, "data-rev-open": "", placeholder: "Un point ouvert par ligne (ils reviendront à la revue suivante)" }), problems = el("ul", { class: "decisions rev-problems", "aria-live": "polite" });
  const go = (decision) => { try { let done = null; store.commit(`${rec.pn} rév. ${rec.rev} ${decision === "released" ? "libérée" : "refusée"}`, (p) => { done = decide(p, rec.id, { by: by.value, decision, why: why.value, open: open.value.split("\n"), ticks, items, date: new Date() }); }); m.close(); toast(`${rec.pn} rév. ${rec.rev} ${decision === "released" ? "libérée" : "refusée"} par ${done.review.by}.`, decision === "released" ? "success" : "info", 7000); } catch (e) { toast(e.message, "error", 9000); } };
  const release = btn("Libérer la révision", () => go("released"), { primary: true, icon: "check" }), refuse = btn("Refuser", () => go("rejected"), { icon: "cross", tip: "La révision reste au dossier, avec la raison ; la suite se fait dans la révision suivante" }); release.dataset.revRelease = ""; refuse.dataset.revRefuse = "";
  const check = () => { const o = { by: by.value, why: why.value, ticks }, pr = reviewProblems(rec, items, { ...o, decision: "released" }), pj = reviewProblems(rec, items, { ...o, decision: "rejected" }); release.disabled = pr.length > 0; refuse.disabled = pj.length > 0; problems.replaceChildren(...pr.slice(0, 6).map((t) => el("li", null, t))); };
  for (const n of [by, why]) n.addEventListener("input", check);
  body.replaceChildren(el("p", { class: "muted" }, `Gelée le ${String(rec.at).slice(0, 10)} par ${rec.by || "— (auteur non nommé)"}. Une révision gelée ne change plus : la revue la libère, ou la refuse ; tout changement ouvre la révision suivante.`),
    el("h3", null, "La liste de la revue"), list(check), el("h3", null, "La décision"), field("Approbateur — quelqu'un d'autre que l'auteur", by), field("Justification", why), field("Points ouverts", open),
    el("h3", null, "Ce qui retient la libération"), problems, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("Fiche (PDF)", () => sheet(rec, facts), { icon: "pdf", tip: "La fiche de la revue telle qu'elle est préparée, à signer" }), refuse, release));
  check(); by.focus();
}
