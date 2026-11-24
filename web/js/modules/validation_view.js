/* DynamiteOrbit.ai — the reference cases, on the screens (demande de JP : « des exemples de validation des équations qui sont
   référencées par une source existante… visibles dans l'interface »). For each published example replayed : where it comes from
   and how it was read, what the source gives, what it prints, what the tool finds and the gap — and, next to them, what the cases
   leave out. A model without a case says so. The analytical models replay their cases as the panel is drawn ; the simulation
   replays its own on request, under the veil (two seconds at most).
     validationSection(o) : the group « Validation » of a right panel — an analytical model, or a family of the simulation.
     validationMark(id)   : the small word of a model, for a tile or a chip.
     validationCard(...)  : the whole table, in the Help.
   The usage it follows : the verification manual of a calculation code — a published problem, the target, the result, the ratio. */

import { el, icon, btn, fmt } from "../core/dom.js";
import { runCase, casesFor, coverage, gapText, verdictOf, READ_LEVELS, HOW, FEA_KINDS } from "../analysis/validation.js";
import { CASES, GAPS, NONE, CONVERTED } from "../analysis/validation_cases.js";
import { FEA_CASES, FEA_GAPS, solveFea } from "../analysis/validation_fea.js";
import { MODELS, DOMAINS, shortTitle } from "../analysis/physics/index.js";
import { pageVeil, underVeil } from "../core/busy.js";

export const ALL_CASES = [...CASES, ...FEA_CASES];
const kept = new Map();      // case id → its result, for the session : an analytical case is replayed once, a case of the simulation when asked
const resultOf = (c) => { if (!kept.has(c.id) && c.kind !== "fea") kept.set(c.id, runCase(c)); return kept.get(c.id) || null; };
const show = (v) => { if (typeof v !== "number" || !Number.isFinite(v)) return "—"; const a = Math.abs(v); return fmt(v, a === 0 || a >= 10000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : Math.min(9, 3 - Math.floor(Math.log10(a)))); };
const gapsOf = (id) => GAPS[id] || FEA_GAPS[id] || "", frame = () => new Promise((r) => setTimeout(r, 30));

/** The word of a model on its cases. → { n (cases), ok, bad, waiting (cases of the simulation not replayed yet), tone, text } */
export function validationMark(id) {
  const list = casesFor(ALL_CASES, id), rs = list.map(resultOf), v = verdictOf(rs.filter(Boolean)), waiting = rs.filter((r) => !r).length;
  if (!list.length) return { n: 0, ok: 0, bad: 0, waiting: 0, tone: "neutral", text: "Sans cas de référence" };
  return { n: list.length, ok: v.ok, bad: v.bad, waiting, tone: v.bad ? "danger" : waiting ? "neutral" : "ok", text: v.bad ? v.text : waiting ? `${list.length} cas publié${list.length > 1 ? "s" : ""} à rejouer` : v.text };
}
/** Replay cases of the simulation, one after the other, under the veil of the page ; « Annuler » stops between two cases. */
export async function replayFea(list, after) {
  const todo = list.filter((c) => c.kind === "fea");
  await underVeil(pageVeil(), "Les cas de référence de la Simulation…", async (say, signal) => {
    for (let i = 0; i < todo.length && !signal.off; i++) { say(`Cas de référence ${i + 1} sur ${todo.length} — ${todo[i].title}`, i, todo.length); await frame(); if (signal.off) break; kept.set(todo[i].id, runCase(todo[i], { fea: solveFea })); }
  }, { kernel: false, cancelled: "Arrêté : les cas déjà rejoués gardent leur résultat." });
  if (after) after();
}

function rowOf(x, c) {
  const conv = c.converted || !String(x.printed).includes(String(x.expected).slice(0, 3)), tip = "L'écart entre ce que l'outil trouve et ce que la source imprime. La tolérance suit les chiffres que la source imprime : un résultat imprimé avec deux chiffres ne se retrouve pas à 0,1 % près.";
  return el("div", { class: `val-row ${x.ok ? "ok" : "bad"}`, "data-key": x.key }, el("div", { class: "val-row-head" }, el("b", { class: "grow" }, x.label), el("span", { class: `badge badge-${x.ok ? "ok" : "danger"}`, "data-tip": tip }, gapText(x.gap))),
    el("small", null, el("span", { class: "val-src" }, "source : ", el("b", null, x.printed)), conv ? el("span", { class: "muted" }, ` (${show(x.expected)}${x.unit ? ` ${x.unit}` : ""})`) : null, " · ", el("span", { class: "val-got" }, "outil : ", el("b", null, `${show(x.obtained)}${x.unit ? ` ${x.unit}` : ""}`))),
    el("small", { class: "muted" }, `tolérance ± ${String(Number((x.tol * 100).toFixed(2))).replace(".", ",")} %${x.note ? ` — ${x.note}` : ""}`));
}
/** One case : its title, its source, what the source gives, the rows — or what is left to do. o : { load(c), replay(c) } */
export function caseCard(c, o = {}) {
  const r = resultOf(c), lvl = READ_LEVELS[c.source.read], how = HOW[c.how];
  const head = el("div", { class: "val-head" }, icon(r ? (r.ok ? "check" : "warning") : "play"), el("b", { class: "grow" }, c.title), el("span", { class: "badge badge-neutral", "data-tip": how.text }, how.label));
  const src = el("p", { class: "val-source small" }, el("a", { href: c.source.url, target: "_blank", rel: "noopener noreferrer", "data-tip": "Ouvrir la page de la source, dans un autre onglet" }, icon("external"), c.source.name), ` — ${c.source.where}. `,
    el("span", { class: `badge badge-${c.source.read === "read" ? "ok" : "warn"}`, "data-tip": lvl.text }, lvl.label), c.source.licence ? el("span", { class: "muted" }, ` ${c.source.licence}`) : null);
  const given = el("p", { class: "val-given small" }, el("b", null, "La source donne : "), c.given.join(" ; "), ".");
  const notes = [c.mesh ? ["Le maillage", c.mesh] : null, c.free ? ["Le reste", c.free] : null, c.converted ? ["Unités", CONVERTED] : null].filter(Boolean).map(([k, t]) => el("p", { class: "muted small" }, el("b", null, `${k} : `), t));
  const body = !r ? [el("p", { class: "muted small" }, "Ce cas se rejoue avec le solveur, dans la page : deux secondes au plus."), o.replay ? btn("Rejouer ce cas", () => o.replay(c), { small: true, primary: true, icon: "play", tip: "Mailler l'exemple de la source, le résoudre, et comparer avec ce qu'elle imprime" }) : null]
    : [...r.rows.map((x) => rowOf(x, c)), ...r.unfaithful.map((t) => el("p", { class: "atelier-hint warn" }, icon("warning"), ` Le cas n'est pas rejoué fidèlement — ${t}.`)),
      ...(r.warnings.length ? [el("details", { class: "val-warn" }, el("summary", null, `Le modèle signale ${r.warnings.length} limite${r.warnings.length > 1 ? "s" : ""} de validité sur cet exemple`), r.warnings.map((w) => el("p", { class: "muted small" }, w)))] : [])];
  return el("article", { class: `val-case ${r ? (r.ok ? "ok" : "bad") : "todo"}`, "data-case": c.id }, head, src, given, ...body.filter(Boolean), ...notes,
    o.load && c.kind !== "fea" ? el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Charger ce cas dans le modèle", () => o.load(c), { small: true, icon: "edit", tip: "Mettre les données de la source dans les champs du modèle, pour le voir rejoué — « Valeurs par défaut » y revient" })) : null);
}
/** The group « Validation » of a right panel. o : { id (a model, or "fea:structure"…), ids (several families at once), load(c), redraw() } */
export function validationSection(o) {
  const ids = o.ids || [o.id], list = ids.flatMap((id) => casesFor(ALL_CASES, id)), marks = ids.map(validationMark), waiting = marks.reduce((s, m) => s + m.waiting, 0), bad = marks.reduce((s, m) => s + m.bad, 0), ok = marks.reduce((s, m) => s + m.ok, 0);
  const note = !list.length ? "aucun cas publié" : bad ? `${bad} hors tolérance` : waiting ? `${list.length} cas à rejouer` : `${ok} cas retrouvé${ok > 1 ? "s" : ""}`, replay = (cs) => replayFea(cs, o.redraw);
  const sec = el("div", { class: "side-section val-section", "data-fold-note": note, "data-validation": ids.join(" ") }, el("h3", null, "Validation"));
  if (!list.length) { sec.append(el("p", { class: "atelier-hint warn" }, icon("warning"), ` ${NONE[ids[0]] || "Aucun exemple publié n'a encore été rejoué pour ce modèle."}`), el("p", { class: "muted small" }, "Sa formule vient de la référence ci-dessus ; elle n'est pas recoupée ici par un exemple chiffré d'une autre source.")); return sec; }
  sec.append(el("p", { class: "muted small" }, "Des exemples chiffrés publiés par d'autres, rejoués par l'outil : ce que la source imprime, ce que l'outil trouve, l'écart. La valeur attendue n'est jamais calculée ici."));
  if (waiting > 1) sec.append(el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn(`Rejouer les ${waiting} cas`, () => replay(list.filter((c) => !resultOf(c))), { small: true, primary: true, icon: "play" })));
  for (const c of list) sec.append(caseCard(c, { load: o.load, replay: (x) => replay([x]) }));
  const gaps = ids.map(gapsOf).filter(Boolean);
  if (gaps.length) sec.append(el("p", { class: "val-gaps small" }, el("b", null, "Ce que ces cas ne couvrent pas : "), gaps.join(" ")));
  return sec;
}

/** The whole table, in the Help : every model and every family of the simulation, with its cases — or the word that it has none. */
export function validationCard(focus = "") {
  const host = el("div"), sum = el("p", { class: "muted" });
  const draw = () => {
    const cov = coverage(ALL_CASES), rows = (ids) => ids.map((m) => { const k = validationMark(m.id), list = casesFor(ALL_CASES, m.id);
      return el("details", { class: "src-item val-item", "data-model": m.id, open: focus === m.id ? "" : null }, el("summary", null, icon(k.n ? (k.bad ? "warning" : "check") : "minus"), el("b", null, m.name), el("span", { class: "src-title" }, m.title), el("span", { class: `badge badge-${k.tone === "ok" ? "ok" : k.tone === "danger" ? "danger" : k.n ? "neutral" : "warn"}` }, k.text)),
        el("div", { class: "src-body" }, validationSection({ id: m.id, redraw: draw }), el("p", { class: "src-links" }, el("a", { href: m.href }, icon("chevron-right"), m.fea ? "Ouvrir la Simulation" : "Ouvrir ce modèle")))); });
    const groups = [...DOMAINS.map((d) => ({ ...d, list: MODELS.filter((m) => m.domain === d.id).map((m) => ({ id: m.id, name: shortTitle(m), title: m.fr || m.title, href: `#/physics/${m.id}` })) })),
      { id: "fea", label: "Simulation", color: "#475569", icon: "physics", hint: "Le solveur, sur un petit maillage", list: FEA_KINDS.map((k) => ({ id: k.id, name: k.short, title: k.title, href: "#/fea", fea: true })) }];
    const waiting = FEA_CASES.filter((c) => !resultOf(c));
    sum.replaceChildren(`${cov.covered} des ${cov.total} modèles ont au moins un exemple publié rejoué (${cov.cases} cas, dont ${cov.read} lus sur la page de leur source) ; ${cov.total - cov.covered} n'en ont pas, et le disent. `,
      ...(waiting.length ? [btn(`Rejouer les ${waiting.length} cas de la Simulation`, () => replayFea(waiting, draw), { small: true, icon: "play", tip: "Les cas de la Simulation se résolvent dans la page : quelques secondes" })] : []));
    host.replaceChildren(...groups.map((g) => el("section", { class: "src-group", style: `--dom:${g.color}`, "data-group": g.id }, el("header", { class: "src-group-head" }, icon(g.icon), el("div", { class: "grow" }, el("b", null, g.label), el("small", null, g.hint)), el("span", { class: "src-count" }, String(g.list.length))), rows(g.list))));
  };
  draw();
  const card = el("section", { class: "card src-card val-card", id: "validation", style: { marginBottom: "1rem" } }, el("h2", null, "Validation des calculs"),
    el("p", { class: "muted" }, "Chaque modèle de calcul est rejoué contre des exemples chiffrés que d'autres ont publiés — un manuel libre, une page d'ingénierie, des notes de cours. La valeur attendue est celle que la source imprime, jamais une valeur recalculée ici ; seuls ses nombres et sa référence sont repris. Un modèle sans exemple le dit : rien n'est tenu pour validé d'office. Un cas retrouvé dit que la formule est bien écrite ; il ne dit pas qu'elle s'applique à votre pièce."), sum, host);
  if (focus) setTimeout(() => { const node = card.querySelector(`[data-model="${focus}"]`) || card; if (node.scrollIntoView) node.scrollIntoView({ block: "start" }); }, 0);
  return card;
}
