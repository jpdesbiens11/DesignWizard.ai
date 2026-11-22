/* DesignOrbit.ai — reference cases (demande de JP : « pour tous les modèles dans la simulation physique… des exemples de
   validation des équations qui sont référencées par une source existante… qu'on est capable de reproduire des exemples simples
   pour chacun des modèles : analytique, thermique, structural »).
   A reference case is a worked example PUBLISHED by someone else — an open textbook, a public engineering page, course notes —
   with its given values and its printed result. The tool replays it with its own model and shows, side by side, what the source
   prints and what the tool finds, with the gap. The rules, held by tests :
     - the expected value is the one the SOURCE prints, never one worked out here from the same formula ;
     - a source is « read » only when its page was opened and the numbers copied from it — otherwise « to verify » ;
     - a case is replayed faithfully : an input the model had to bring back inside its range makes the case fail ;
     - a model without a case says so, and a model with cases says what they do not cover : nothing is validated by default.
   Only numbers and the reference are taken from a source : no text, no figure. The cases are in validation_cases.js (the
   analytical models) and validation_fea.js (the simulation) ; this file runs them. Pure : no page. */

import { run, model, MODELS } from "./physics/index.js";

/** How the reading of a source is said. */
export const READ_LEVELS = {
  read: { label: "page lue", text: "La page de la source a été ouverte, et ses nombres copiés tels qu'imprimés." },
  table: { label: "table lue", text: "Une table de coefficients a été lue sur une page publique qui cite l'ouvrage ; l'ouvrage lui-même n'a pas été ouvert." },
  toVerify: { label: "à vérifier", text: "La source est nommée, sa page n'a pas pu être ouverte ici : les nombres sont à relire avant de s'y fier." },
};
/** How a case is replayed. */
export const HOW = {
  direct: { label: "rejoué tel quel", text: "Les données de la source sont entrées, son résultat est comparé." },
  inverse: { label: "rejoué à l'envers", text: "La source cherche une donnée que le modèle demande : son résultat imprimé est entré, et c'est sa donnée imprimée qui est retrouvée." },
  table: { label: "coefficients comparés", text: "Les coefficients du modèle sont comparés à ceux d'une table publiée ; aucun exemple chiffré complet n'a été rejoué." },
};
/** The three families of the simulation, beside the analytical models. */
export const FEA_KINDS = [{ id: "fea:structure", title: "Simulation — structure", short: "Structure" }, { id: "fea:thermal", title: "Simulation — thermique", short: "Thermique" }, { id: "fea:thermo", title: "Simulation — thermo-mécanique", short: "Thermo-mécanique" }];
const gapOf = (got, want) => (want === 0 ? (got === 0 ? 0 : Infinity) : (got - want) / Math.abs(want));
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)) : String(a) === String(b));

/** Replay one case. solvers : { fea: (c) → { key: value } } for the cases the simulation solves (left out, such a case is « not run »).
    → { id, ok (every row inside its tolerance, replayed faithfully), ran, rows: [{ key, label, unit, expected, printed, obtained, gap (relative), tol, ok, note }], warnings, unfaithful: [text] } */
export function runCase(c, solvers = {}) {
  let values = null, warnings = [], unfaithful = [];
  const m = c.kind === "fea" ? null : model(c.model);
  if (c.kind === "fea") {
    if (!solvers.fea) return { id: c.id, ok: false, ran: false, rows: [], warnings: ["Ce cas se rejoue avec le solveur de la Simulation."], unfaithful };
    try { values = solvers.fea(c); } catch (e) { return { id: c.id, ok: false, ran: true, rows: [], warnings: [`Calcul impossible : ${e.message}`], unfaithful }; }
  } else {
    const r = run(c.model, c.inputs); values = r.values; warnings = r.warnings || [];
    for (const [k, v] of Object.entries(c.inputs || {})) if (!same(r.inputs[k], v)) unfaithful.push(`« ${k} » : ${v} entré, ${r.inputs[k]} retenu par le modèle`);      // brought back inside the range of the model, or unknown to it
    for (const [k, v] of Object.entries(c.requires || {})) if (!same(values[k], v)) unfaithful.push(`« ${k} » vaut ${values[k]}, ${v} attendu pour que le cas soit celui de la source`);
  }
  const outOf = (key) => (m ? m.outputs.find((o) => o.key === key) : null) || {};
  const rows = c.expect.map((e) => { const got = values[e.key], gap = typeof got === "number" && Number.isFinite(got) ? gapOf(got, e.value) : NaN;
    return { key: e.key, label: e.label || outOf(e.key).label || e.key, unit: e.unit !== undefined ? e.unit : outOf(e.key).unit || "", expected: e.value, printed: e.printed, obtained: got, gap, tol: e.tol, ok: Number.isFinite(gap) && Math.abs(gap) <= e.tol, note: e.note || "" }; });
  return { id: c.id, ok: rows.length > 0 && rows.every((x) => x.ok) && !unfaithful.length, ran: true, rows, warnings, unfaithful };
}
/** The cases of a model (an analytical model by its id ; the simulation by "fea:structure", "fea:thermal", "fea:thermo"). */
export const casesFor = (cases, modelId) => (cases || []).filter((c) => c.model === modelId);
/** What is covered and what is not, among the analytical models and the families of the simulation.
    → { models: [{ id, title, cases, fea }], total, covered, missing: [{ id, title }], cases, read (cases whose source page was read) } */
export function coverage(cases) {
  const list = [...MODELS.map((m) => ({ id: m.id, title: m.title, fea: false })), ...FEA_KINDS.map((k) => ({ id: k.id, title: k.title, fea: true }))], n = (id) => casesFor(cases, id).length;
  const models = list.map((m) => ({ ...m, cases: n(m.id) }));
  return { models, total: models.length, covered: models.filter((m) => m.cases).length, missing: models.filter((m) => !m.cases).map((m) => ({ id: m.id, title: m.title })), cases: (cases || []).length, read: (cases || []).filter((c) => c.source.read === "read").length };
}
/** A case is well formed : it names its source and where in it, says how it was read and how it is replayed, gives what the source gives and prints. → [problems] */
export function caseProblems(c) {
  const out = [], s = c.source || {}, m = c.kind === "fea" ? null : model(c.model);
  if (!c.id || !c.title) out.push("sans nom");
  if (c.kind === "fea" ? !FEA_KINDS.some((k) => k.id === c.model) || typeof c.solve !== "function" : !m) out.push(`modèle « ${c.model} » inconnu`);
  if (!s.name || !s.where) out.push("source sans nom ou sans endroit");
  if (!READ_LEVELS[s.read]) out.push("niveau de lecture absent");
  if (s.read !== "toVerify" && !/^https:\/\//.test(s.url || "")) out.push("une source lue dit quelle page");
  if (!HOW[c.how]) out.push("façon de rejouer absente");
  if (!(c.given || []).length) out.push("les données de la source manquent");
  if (!(c.expect || []).length) out.push("aucune valeur attendue");
  for (const k of Object.keys(c.inputs || {})) if (m && !m.inputs.some((d) => d.key === k)) out.push(`« ${k} » n'est pas une entrée du modèle`);
  for (const e of c.expect || []) {
    if (typeof e.value !== "number" || !e.printed) out.push(`« ${e.key} » : la valeur attendue se cite telle qu'imprimée (printed)`);
    if (!(e.tol > 0 && e.tol <= 0.1)) out.push(`« ${e.key} » : tolérance absente ou trop large`);
    if (m && !m.outputs.some((o) => o.key === e.key)) out.push(`« ${e.key} » n'est pas un résultat du modèle`);
  }
  return out;
}
/** A gap as a text : « +0,4 % ». */
export function gapText(g) { if (!Number.isFinite(g)) return "—"; const t = (Math.abs(g) * 100).toFixed(Math.abs(g) < 0.0995 ? 1 : 0); return `${Number(t) === 0 ? "" : g > 0 ? "+" : "−"}${t.replace(".", ",")} %`; }
/** The word of a set of cases replayed : → { n, ok, bad, text } */
export function verdictOf(results) {
  const ran = (results || []).filter((r) => r.ran), ok = ran.filter((r) => r.ok).length, bad = ran.length - ok;
  return { n: ran.length, ok, bad, text: !ran.length ? "Aucun cas rejoué" : bad ? `${bad} cas sur ${ran.length} hors tolérance` : `${ok} cas publié${ok > 1 ? "s" : ""} retrouvé${ok > 1 ? "s" : ""}` };
}
