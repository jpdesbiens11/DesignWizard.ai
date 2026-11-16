/* DesignWizard.ai — Physique : the right panel of the studio. « Modèles » : the hand calculations as tiles, grouped by
   physics — a colour and a pictogram per physics, the diagram of each model as its pictogram, a few words under it ;
   the long title and the question come once the tile is chosen. « Résultat » : the verdict, the key values, the checks
   with their margins. « Calcul » : the steps written like a hand calculation, the assumptions, the validity and the
   source. « Rapport » : the runs kept in the project. */

import { el, btn, badge, table, fmt, icon, toast } from "../core/dom.js";
import { MODELS, DOMAINS, model, shortTitle, runsByPart } from "../analysis/physics/index.js";
import { sketch, domainIcon } from "./physics_sketch.js";
import { getUnits, quantity, toShown, shownUnit, dualOf, pressureEquivalents } from "../core/units.js";

export const VERDICT = { ok: ["OK", "ok"], warn: ["À vérifier", "warn"], fail: ["NON", "danger"] };
export const verdictBadge = (v) => badge((VERDICT[v] || VERDICT.warn)[0], (VERDICT[v] || VERDICT.warn)[1]);
export const VERDICT_TEXT = { ok: "Toutes les vérifications passent, dans le domaine de validité.", warn: "Marge faible ou limite de validité : à regarder de près.", fail: "Au moins une limite est dépassée." };
export const domainOf = (m) => DOMAINS.find((d) => d.id === (m && m.domain)) || { id: "", label: "", color: "var(--acc)" };

/** A number the way an engineer reads it : about 4 significant digits, French decimal comma. */
export function show(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return fmt(v, a === 0 || a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : Math.min(9, 3 - Math.floor(Math.log10(a))));
}

/** A value with its unit, in the units the designer chose (core/units.js) : « 0,096 psi », « 1,83 kg (4,03 lb) ». */
export const qty = (v, unit, U = getUnits()) => quantity(v, unit, U, show);

/** Rows of the design-review report : one per saved run (title, part, verdict, key result, tightest check). */
export function physicsSummary(project, U = getUnits()) {
  const parts = (project && project.parts) || [];
  return ((project && project.physics) || []).map((r) => {
    const m = model(r.model), values = r.values || {}, o = m && m.outputs.find((x) => typeof values[x.key] === "number");
    const worst = (r.checks || []).reduce((a, c) => (!a || c.margin < a.margin ? c : a), null), part = r.part ? parts.find((p) => p.id === r.part) : null;
    return { id: r.id, name: r.name || "", model: r.model, title: m ? m.title : r.model, question: m ? m.question : "", part: r.part || "", partName: part ? part.name || "" : "",
      verdict: r.verdict, verdictLabel: (VERDICT[r.verdict] || VERDICT.warn)[0], result: o ? `${o.label} : ${qty(values[o.key], o.unit, U)}` : "—",
      worst: worst ? `${worst.label} — marge ${show(worst.margin)}` : "", when: r.when || "" };
  });
}

/** The models as tiles, by physics. o : { cur (the chosen model), saved (rows of physicsSummary), pick(id) } */
export function modelTiles(body, o) {
  const rank = { fail: 3, warn: 2, ok: 1 }, kept = new Map();
  for (const r of o.saved || []) { const k = kept.get(r.model); if (!k || (rank[r.verdict] || 0) > (rank[k.verdict] || 0)) kept.set(r.model, { verdict: r.verdict, n: (k ? k.n : 0) + 1 }); else k.n++; }
  for (const d of DOMAINS) {
    const list = MODELS.filter((m) => m.domain === d.id);
    body.append(el("section", { class: "phys-group", style: `--dom:${d.color}`, "data-domain": d.id },
      el("header", { class: "phys-group-head" }, domainIcon(d.id, d.color, 26), el("div", { class: "grow" }, el("b", null, d.label), el("small", null, d.hint)), el("span", { class: "phys-count", "data-tip": `${list.length} modèles` }, String(list.length))),
      el("div", { class: "phys-tiles" }, list.map((m) => {
        const on = o.cur && o.cur.id === m.id, k = kept.get(m.id);
        return el("button", { class: `phys-tile${on ? " sel" : ""}`, type: "button", "data-model": m.id, "aria-pressed": on ? "true" : "false", "data-tip": m.question, onClick: () => o.pick(m.id) },
          sketch(m, { mini: true, color: d.color }), el("span", { class: "phys-tile-name" }, shortTitle(m)),
          ...[k ? el("i", { class: `phys-kept ${k.verdict || "warn"}`, "data-tip": `${k.n} calcul${k.n > 1 ? "s" : ""} au rapport — ${(VERDICT[k.verdict] || VERDICT.warn)[0]}` }, String(k.n)) : null].filter(Boolean));
      }))));
  }
}

const checkState = (c) => (c.ok ? (c.tight ? ["juste", "warn"] : ["OK", "ok"]) : c.soft ? ["à vérifier", "warn"] : ["NON", "danger"]);
/** The result of the run. o : { cur, r (the run), waits (text : why the report must wait, or ""), save(), blocked() } */
export function resultPanel(body, o) {
  const { cur, r } = o, U = getUnits();
  if (!cur || !r) { body.append(el("p", { class: "muted" }, "Choisissez d'abord un modèle : le verdict, les valeurs et les marges s'écrivent ici pendant que vous tapez.")); return; }
  body.append(el("div", { class: `phys-verdict ${r.verdict}` }, verdictBadge(r.verdict), el("span", null, VERDICT_TEXT[r.verdict] || "")));
  if (o.waits) body.append(el("p", { class: "phys-eg small" }, o.waits));
  body.append(el("div", { class: "kpis phys-kpis" }, cur.outputs.slice(0, 4).map((x) => { const v = r.values[x.key], u = shownUnit(x.unit, U), d = dualOf(v, x.unit, U), eq = x.unit === "kPa" ? pressureEquivalents(v, U).slice(1) : [];      // a pressure also reads in the three other units
    return el("div", { class: "kpi", "data-out": x.key }, el("b", null, show(toShown(v, x.unit, U)), u ? el("small", null, " " + u) : null, ...(d ? [el("small", null, ` (${show(d[0])} ${d[1]})`)] : [])), el("span", null, x.label),
      ...(eq.length ? [el("small", { class: "phys-equiv", "data-tip": "La même pression dans les autres unités" }, eq.map(([k, e]) => `${show(e)} ${k}`).join(" · "))] : [])); })));
  for (const w of r.warnings) body.append(el("div", { class: "finding warn" }, el("span", { class: "sev" }), el("div", null, el("b", null, "Limite de validité")), el("p", null, w)));
  if (r.checks.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Vérifications"), r.checks.map((c) => { const [word, kind] = checkState(c);
    return el("div", { class: `phys-check ${kind}` }, el("div", { class: "grow" }, el("b", null, c.label), el("small", null, `${qty(c.value, c.unit, U)} · limite ${qty(c.limit, c.unit, U)}`), ...[c.note ? el("small", { class: "muted" }, c.note) : null].filter(Boolean)),
      el("div", { class: "phys-margin" }, badge(word, kind), el("small", null, `marge ${c.margin >= 999 ? "> 999" : show(c.margin)}`))); })));
  else body.append(el("p", { class: "muted small" }, "Aucun critère à vérifier avec ces données : le calcul donne les valeurs ci-dessus."));
  if (cur.outputs.length > 4) body.append(el("div", { class: "side-section" }, el("h3", null, "Autres résultats"), table(["Grandeur", "Valeur"], cur.outputs.slice(4).map((x) => [x.label, qty(r.values[x.key], x.unit, U)]))));
  body.append(el("label", { class: "field phys-name" }, el("span", { class: "field-label" }, "Nom du calcul à garder"), el("input", { type: "text", value: o.name || "", "data-tip": "Le nom de la pièce d'abord : ses calculs se rangent ensemble, et vous pouvez en garder plusieurs au fil du temps", onInput: (e) => o.setName && o.setName(e.target.value) })));
  body.append(el("div", { class: "form-actions" }, btn("Garder ce calcul", () => (o.waits ? o.blocked() : o.save()), { primary: true, icon: "plus",
    tip: o.waits ? "Entrez ou confirmez d'abord les valeurs que le guide demande : un calcul au rapport ne garde que vos valeurs" : "Garde ce calcul sous ce nom (données, résultats, verdict) dans le projet, au nom de la pièce : il va au rapport de revue, et sa fiche est rangée dans Drive quand le projet y est" })));
  if (o.out) body.append(exportBar(o.out, o.waits ? o.blocked : null, "Ce calcul, à emporter"));
}
/** The documents a calculation leaves with : the note in Word and in PDF, at the template of the house, and the workbook to iterate offline.
    out : { word(), pdf(), excel() } — excel only for one calculation ; gate : what to do instead while the guide still asks for values. */
export function exportBar(out, gate, title) {
  const go = (fn) => async (e, b) => { if (gate) return gate(); b.disabled = true; try { await fn(); } catch (err) { console.error(err); toast(`Export : ${err.message}`, "error", 7000); } b.disabled = false; };
  return el("div", { class: "side-section phys-out" }, el("h3", null, title), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
    btn("Word", go(out.word), { small: true, icon: "download", tip: "La note de calcul en .docx, au gabarit des documents de la plateforme : cartouche, page de titre, approbation, données, résultats, vérifications, calcul" }),
    btn("PDF", go(out.pdf), { small: true, icon: "pdf", tip: "La même note en PDF" }),
    ...(out.excel ? [btn("Excel", go(out.excel), { small: true, primary: true, icon: "download", tip: "Un classeur .xlsx pour itérer hors ligne : cases jaunes à remplir, résultats, vérifications, balayages avec leurs courbes, base des médias, méthode" })] : [])),
    ...(out.note ? [el("p", { class: "muted small", style: { margin: ".3rem 0 0" } }, out.note)] : []));
}

/** The calculation written like a hand calculation, with what it assumes and where it comes from. */
export function calcPanel(body, o) {
  const { cur, r } = o;
  if (!cur || !r) { body.append(el("p", { class: "muted" }, "Le calcul d'un modèle s'écrit ici, étape par étape, avec ses hypothèses et sa source.")); return; }
  body.append(el("div", { class: "side-section" }, el("h3", null, "Calcul"), ...(getUnits().system === "imperial" ? [el("p", { class: "muted small" }, "Le calcul s'écrit en SI, comme dans sa source ; les résultats et les vérifications sont convertis à l'affichage.")] : []), el("ol", { class: "phys-steps" }, r.steps.map((s) => el("li", null, s)))),
    el("div", { class: "side-section" }, el("h3", null, "Hypothèses"), el("ul", { class: "phys-steps" }, cur.assumptions.map((a) => el("li", null, a)))),
    el("div", { class: "side-section" }, el("h3", null, "Domaine de validité"), el("p", { class: "small" }, cur.validity)),
    el("div", { class: "side-section" }, el("h3", null, "Référence"), el("p", { class: "muted small" }, cur.reference)));
}

/** The runs kept in the project, by part. o : { rows (physicsSummary), project, reopen(id), remove(id) } */
export function savedPanel(body, o) {
  if (!o.rows.length) { body.append(el("p", { class: "muted" }, "Aucun calcul gardé. « Garder ce calcul », sous le résultat, le garde dans le projet sous son nom, au nom de sa pièce : plusieurs par pièce, au fil du temps.")); return; }
  if (o.out) body.append(exportBar(o.out, null, `Les ${o.rows.length} calcul${o.rows.length > 1 ? "s gardés" : " gardé"}, en un document`));
  const rowOf = new Map(o.rows.map((r) => [r.id, r]));
  for (const g of runsByPart(o.project)) {
    body.append(el("div", { class: "side-section" }, el("h3", null, icon(g.part ? "part" : "folder"), el("span", { class: "grow" }, g.part ? `${g.name} · ${g.part}` : g.name), el("small", null, String(g.runs.length))), g.runs.map((run) => { const r = rowOf.get(run.id), m = model(run.model), d = domainOf(m);
      return el("div", { class: "phys-saved", style: `--dom:${d.color}`, "data-run": run.id }, ...[m ? domainIcon(d.id, d.color, 20) : null].filter(Boolean),
        el("div", { class: "grow" }, el("b", null, run.name || (m ? shortTitle(m) : run.model)), el("small", null, [m ? shortTitle(m) : run.model, r.when ? new Date(r.when).toLocaleDateString("fr-CA") : ""].filter(Boolean).join(" · ")), el("small", null, r.result), ...[r.worst ? el("small", { class: "muted" }, r.worst) : null].filter(Boolean)),
        el("div", { class: "phys-margin" }, verdictBadge(r.verdict), el("span", { class: "nowrap" }, btn("", () => o.reopen(r.id), { small: true, icon: "edit", tip: "Rouvrir : reprendre les données de ce calcul" }), btn("", () => o.remove(r.id), { small: true, danger: true, icon: "trash", tip: "Retirer ce calcul du projet" })))); })));
  }
}

/** The tabs of the right panel. tabs : [[key, label, count?, verdict?]] — a count after the word, a dot of the colour of the verdict */
export function tabBar(tabs, cur, pick) {
  return el("div", { class: "subtabs phys-tabs", role: "tablist" }, tabs.map(([k, label, n, verdict]) => el("button", { class: `subtab${k === cur ? " active" : ""}`, type: "button", role: "tab", "aria-selected": k === cur ? "true" : "false", "data-tab": k, onClick: () => pick(k) },
    ...[verdict ? el("i", { class: `phys-dot ${verdict}`, "aria-label": (VERDICT[verdict] || VERDICT.warn)[0] }) : null].filter(Boolean), label, ...[n ? el("small", { class: "phys-n" }, String(n)) : null].filter(Boolean))));
}
