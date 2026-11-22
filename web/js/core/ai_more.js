/* DesignOrbit.ai — three more artefacts for the AI round trip (point 2 of the roadmap : « la feuille d'un dessin, un cas de charge, un
   réglage d'isolation comme artéfacts de la boucle »). The Dessins, Simulation and Isolation screens hand over what they show — not the part
   behind them : the drawing sheet of a part or an assembly, the load cases of a part or an assembly, the isolation settings of an assembly or a
   board. Each travels as a small document of its own kind (drawing/1, loadcase/1, isolation/1) with the id of what it belongs to ; the answer is
   read back, checked, and written into the project inside ONE step of the store. Pure : what the documents hold, what is wrong with an answer,
   and how it is written.
   Keys : drawing:part:<id> · drawing:assembly:<id> · case:<id> · iso:assembly:<id> · iso:board:<id>. */

import { blankCase, caseFrom, CASE_KEYS } from "../analysis/fea/case_store.js";
import { DEFAULT_PARAMS, LEVELS, OVC } from "../analysis/cc_rules.js";
import { DIM_CLASSES } from "../draw/dim_model.js";
import { netsOf } from "../analysis/cc_guide.js";
import { flatAsm } from "./asm_levels.js";
import { partTexts, drawingTexts } from "./drawing_words.js";
import { uosCheck } from "../draw/uos.js";
import { detailCheck } from "../draw/detail_view.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const LIST = { part: "parts", assembly: "assemblies", board: "boards" };
const find = (p, of, id) => ((p && p[LIST[of]]) || []).find((x) => x.id === id) || null;
const named = (x) => `« ${x.name || x.id} »`;
/** The title-block fields of the project's drawings : one block for every sheet of the project. */
export const SHEET_KEYS = ["projection", "hidden", "drawnBy", "checkedBy", "approvedBy", "status", "organisation", "confidentiality", "asmBom", "date", "uos", "notesOff"];
const UOS_VALUES = ["basis", "mm", "inch", "angle", "iso"];
export const CASE_KINDS = ["structure", "thermal", "thermo"], ROLES = ["conductor", "floating", "insulator", "ignore"];

/** What a key names. → { kind: "drawing" | "case" | "iso", of: "part" | "assembly" | "board", id } or null */
export function moreKey(key, project) {
  const m = /^(drawing|iso):(part|assembly|board):(.+)$/.exec(String(key || "")), c = /^case:(.+)$/.exec(String(key || ""));
  if (m && !(m[1] === "drawing" && m[2] === "board") && !(m[1] === "iso" && m[2] === "part")) return find(project, m[2], m[3]) ? { kind: m[1], of: m[2], id: m[3] } : null;
  if (c) { const of = find(project, "part", c[1]) ? "part" : find(project, "assembly", c[1]) ? "assembly" : null; return of ? { kind: "case", of, id: c[1] } : null; }
  return null;
}
/** How a screen names it. */
export function moreLabel(project, k) {
  const host = k && find(project, k.of, k.id); if (!host) return "";
  return { drawing: `la feuille de dessin de ${named(host)}`, case: `le cas de charge de ${named(host)}`, iso: `l'isolation de ${named(host)}` }[k.kind];
}

/* ---------- the drawing sheet ---------- */
function drawingDoc(p, k, host) {
  const d = p.drawing || {}, texts = k.of === "part" ? partTexts(host, p) : drawingTexts(p, `assembly:${k.id}`), w = d.words || {};
  return { dw: "drawing/1", id: k.id, of: k.of, title: host.name || host.id, sheet: Object.fromEntries(SHEET_KEYS.filter((x) => d[x] !== undefined).map((x) => [x, d[x]])),
    words: Object.fromEntries(texts.map((t) => [t, w[t] || ""])), notes: [...(host.notes || [])],
    ...(k.of === "part" ? { section: host.section ?? null, characteristics: { ...(host.characteristics || {}) } } : {}), details: clone(host.details || []) };      // detail views : on a part and on an assembly
}
function drawingCheck(p, k, d) {
  const out = [], block = (text) => out.push({ severity: "block", text }), warn = (text) => out.push({ severity: "warn", text }), s = d.sheet || {};
  for (const x of Object.keys(s)) if (!SHEET_KEYS.includes(x)) warn(`Cartouche : « ${x} » n'est pas un champ du cartouche — ignoré.`);
  if (s.projection !== undefined && !["third", "first"].includes(s.projection)) block(`Projection « ${s.projection} » : « third » (troisième dièdre) ou « first » (premier dièdre).`);
  if (s.asmBom !== undefined && !["flat", ""].includes(s.asmBom)) block(`Nomenclature « ${s.asmBom} » : « flat » (à plat) ou vide (ce niveau).`);
  if (s.hidden !== undefined && typeof s.hidden !== "boolean") block("Arêtes cachées : true ou false.");
  for (const x of SHEET_KEYS.filter((q) => !["projection", "asmBom", "hidden", "uos", "notesOff"].includes(q))) if (s[x] !== undefined && s[x] !== null && typeof s[x] !== "string") block(`Cartouche : « ${x} » est un texte.`);
  for (const t of uosCheck(s.uos)) block(`Bloc de tolérances : ${t}`);
  if (s.notesOff !== undefined && s.notesOff !== null && !(Array.isArray(s.notesOff) && s.notesOff.every((n) => typeof n === "string"))) block("« notesOff » : la liste des clés des notes générales mises à Off (standard, material, marks, class1…, rule1…).");
  const cur = (p.drawing || {}).uos;
  if (s.uos && UOS_VALUES.some((q) => JSON.stringify((cur || {})[q]) !== JSON.stringify(s.uos[q]))) out.push({ severity: "warn", text: "Le bloc « UNLESS OTHERWISE SPECIFIED » change : ses valeurs restent des exemples jusqu'à ce que le projet les confirme à l'écran — une réponse ne les confirme pas." });
  if (!Array.isArray(d.notes) || d.notes.some((n) => typeof n !== "string")) block("Les notes sont une liste de textes.");
  if (d.words && (typeof d.words !== "object" || Object.values(d.words).some((v) => typeof v !== "string"))) block("L'anglais des textes (« words ») est une table texte → texte.");
  else if (d.words) { const bad = Object.values(d.words).filter((v) => /[àâçéèêëîïôûùüÿœ]/i.test(v)); if (bad.length) warn(`${bad.length} texte(s) anglais portent des accents : « ${bad[0].slice(0, 40)} »… — un dessin s'écrit en anglais.`); }
  if (k.of === "part") {
    const c = d.section;
    if (c !== null && c !== undefined && !(typeof c === "object" && ["x", "y", "none"].includes(c.axis) && (c.at === undefined || Number.isFinite(c.at)))) block("Coupe : null (choisie par l'outil), { axis: \"x\" | \"y\", at: nombre } ou { axis: \"none\" }.");
    const ch = d.characteristics || {}; if (typeof ch !== "object") block("Caractéristiques : une table cote → classe.");
    else for (const [dim, v] of Object.entries(ch)) if (!DIM_CLASSES[v]) block(`Cote ${dim} : la classe « ${v} » n'existe pas (${Object.keys(DIM_CLASSES).join(", ")}).`);
    for (const t of detailCheck(d.details)) block(`Vues de détail : ${t}`);
  }
  if (Object.keys(s).length || Object.keys((p.drawing || {})).some((x) => SHEET_KEYS.includes(x))) out.push({ severity: "info", text: "Le cartouche vaut pour toutes les feuilles du projet ; la coupe, les classes de cotes et les notes ne valent que pour ce dessin." });
  return out;
}
function drawingApply(p, k, d) {
  const host = find(p, k.of, k.id), w = { ...((p.drawing || {}).words || {}) }, sheet = d.sheet || {};
  p.drawing = { ...(p.drawing || {}) };
  const cur = p.drawing.uos;
  for (const x of SHEET_KEYS) { const v = sheet[x]; if (v === undefined || v === null || v === "") { delete p.drawing[x]; continue; }
    if (x === "uos") { const same = cur && UOS_VALUES.every((q) => JSON.stringify(cur[q]) === JSON.stringify(v[q])); p.drawing.uos = same ? cur : { ...Object.fromEntries(UOS_VALUES.filter((q) => v[q] !== undefined).map((q) => [q, clone(v[q])])), sure: false }; continue; }      // an answer never confirms the values of the block
    p.drawing[x] = x === "notesOff" ? [...v] : v; }
  for (const [t, v] of Object.entries(d.words || {})) { if (String(v).trim()) w[t] = String(v).trim(); else delete w[t]; }
  if (Object.keys(w).length) p.drawing.words = w; else delete p.drawing.words;
  host.notes = [...(d.notes || [])]; if (!host.notes.length) delete host.notes;
  if (k.of === "part") {
    if (d.section === null || d.section === undefined) delete host.section; else host.section = clone(d.section);
    const ch = Object.fromEntries(Object.entries(d.characteristics || {}).filter(([, v]) => v && v !== "normal"));
    if (Object.keys(ch).length) host.characteristics = ch; else delete host.characteristics;
  }
  if (Array.isArray(d.details) && d.details.length) host.details = clone(d.details).map((x) => ({ ...x, id: x.id || `det-${x.letter}` })); else delete host.details;
}

/* ---------- the load cases ---------- */
function caseDoc(p, k, host) {
  const entry = ((p.cases || []).find((x) => x.id === k.id)) || null, now = entry ? clone(entry) : { ...blankCase() };
  delete now.id;
  return { dw: "loadcase/1", id: k.id, of: k.of, title: host.name || host.id, ...now };
}
const CASE_DOC_KEYS = new Set([...CASE_KEYS, "dw", "id", "of", "title", "name", "others", "at"]);
function caseCheck(p, k, d) {
  const out = [], block = (text) => out.push({ severity: "block", text }), all = [d, ...(Array.isArray(d.others) ? d.others : [])];
  for (const x of Object.keys(d)) if (!CASE_DOC_KEYS.has(x)) out.push({ severity: "warn", text: `« ${x} » n'est pas un champ d'un cas de charge — ignoré.` });
  if (d.others !== undefined && !Array.isArray(d.others)) block("« others » : la liste des autres cas, chacun avec son nom.");
  all.forEach((c, i) => {
    const who = i ? `Cas « ${c.name || i + 1} »` : `Cas en cours${d.name ? ` « ${d.name} »` : ""}`;
    if (!CASE_KINDS.includes(c.kind)) block(`${who} : le genre « ${c.kind} » n'existe pas (${CASE_KINDS.join(", ")}).`);
    for (const x of ["fixed", "loads", "power", "fixedT", "cuts", "zones", "sensors"]) if (c[x] !== undefined && !Array.isArray(c[x])) block(`${who} : « ${x} » est une liste.`);
    if (c.cells !== undefined && !(Number.isFinite(c.cells) && c.cells >= 100 && c.cells <= 200000)) block(`${who} : « cells » (le nombre de mailles visé) entre 100 et 200 000.`);
    if (c.fsTarget !== undefined && !(Number.isFinite(c.fsTarget) && c.fsTarget > 0)) block(`${who} : le facteur de sécurité visé est un nombre positif.`);
    if (i && !String(c.name || "").trim()) block(`L'autre cas n° ${i} n'a pas de nom.`);
  });
  const names = all.map((c, i) => String(c.name || (i ? "" : "Cas 1")).trim()).filter(Boolean);
  if (new Set(names).size !== names.length) block("Deux cas portent le même nom.");
  out.push({ severity: "info", text: "Les simulations gardées dans le projet ne sont pas refaites : relancez le calcul du cas changé à l'écran Simulation." });
  return out;
}
function caseApply(p, k, d) {
  const entry = { id: k.id, ...(d.name ? { name: String(d.name).trim() } : {}), ...caseFrom(d) };
  const others = (Array.isArray(d.others) ? d.others : []).map((c) => ({ name: String(c.name).trim(), ...caseFrom(c) }));
  if (others.length) entry.others = others; if (d.at !== undefined) entry.at = d.at;
  p.cases = (p.cases || []).filter((x) => x.id !== k.id); p.cases.push(entry);
}

/* ---------- the isolation settings ---------- */
const finder = (p) => (id) => find(p, "assembly", id);
function isoDoc(p, k, host) {
  const iso = host.isolation || {};
  if (k.of === "board") return { dw: "isolation/1", id: k.id, of: "board", title: host.name || host.id, kinds: { ...(iso.kinds || {}) }, params: { ...DEFAULT_PARAMS, level: "functional", ...(iso.params || {}) }, levels: { ...(iso.levels || {}) } };
  const nets = netsOf(flatAsm(host, finder(p)) || host, (id) => find(p, "part", id));
  return { dw: "isolation/1", id: k.id, of: "assembly", title: host.name || host.id, nets, params: { ...DEFAULT_PARAMS, ...(iso.params || {}) }, levels: { ...(iso.levels || {}) }, overrides: clone(iso.overrides || {}) };
}
function isoCheck(p, k, d) {
  const out = [], block = (text) => out.push({ severity: "block", text }), warn = (text) => out.push({ severity: "warn", text }), q = d.params || {};
  for (const x of Object.keys(q)) if (!(x in DEFAULT_PARAMS) && x !== "cut_edge") warn(`Paramètre « ${x} » inconnu — ignoré.`);
  if (q.pollution_degree !== undefined && ![1, 2, 3, 4].includes(q.pollution_degree)) block("Degré de pollution : 1, 2, 3 ou 4.");
  if (q.ovc !== undefined && !OVC.includes(q.ovc)) block(`Catégorie de surtension : ${OVC.join(", ")}.`);
  if (q.field !== undefined && !["A", "B"].includes(q.field)) block("Champ : « A » (inhomogène, l'usage) ou « B » (homogène).");
  if (q.level !== undefined && !LEVELS.includes(q.level)) block(`Isolation par défaut : ${LEVELS.join(", ")}.`);
  for (const x of ["altitude_m", "voltage_factor"]) if (q[x] !== undefined && !(Number.isFinite(q[x]) && q[x] >= 0)) block(`« ${x} » est un nombre positif.`);
  for (const [pair, v] of Object.entries(d.levels || {})) if (!LEVELS.includes(v)) block(`Paire ${pair} : « ${v} » n'est pas un niveau (${LEVELS.join(", ")}).`);
  if (k.of === "assembly") {
    const nets = Array.isArray(d.nets) ? d.nets : null, names = new Set((nets || []).map((n) => n.name));
    if (!nets) block("« nets » : la liste des potentiels, chacun { name, kind, voltage }.");
    else { for (const n of nets) { if (!String(n.name || "").trim()) block("Un potentiel n'a pas de nom."); if (!["dc", "ac"].includes(n.kind)) block(`${n.name} : « kind » vaut « dc » ou « ac ».`); if (!Number.isFinite(n.voltage)) block(`${n.name} : la tension est un nombre (V).`); }
      if (names.size !== nets.length) block("Deux potentiels portent le même nom."); }
    for (const pair of Object.keys(d.levels || {})) if (nets && pair.split("|").some((n) => !names.has(n))) warn(`Paire ${pair} : un de ses potentiels n'existe pas.`);
    const a = find(p, "assembly", k.id), insts = new Set(((flatAsm(a, finder(p)) || a).instances || []).map((i) => i.id));
    for (const [body, o] of Object.entries(d.overrides || {})) {
      if (!insts.has(body.split("/")[0])) warn(`Rôle de ${body} : cette occurrence n'est pas dans l'assemblage.`);
      if (o && o.kind && !ROLES.includes(o.kind)) block(`Rôle de ${body} : « ${o.kind} » (${ROLES.join(", ")}).`);
      if (o && o.net && nets && !names.has(o.net)) block(`Rôle de ${body} : le potentiel « ${o.net} » n'existe pas.`);
    }
  } else for (const [lv, v] of Object.entries(d.kinds || {})) if (!["dc", "ac"].includes(v)) block(`Potentiel ${lv} : « dc » ou « ac ».`);
  if (k.of === "board") out.push({ severity: "info", text: "Les potentiels et leurs tensions viennent du PCBA : ils se changent là, pas ici." });
  out.push({ severity: "info", text: "Les résultats de la dernière analyse seront retirés : ils ne valent plus pour ces réglages — relancez « Analyser » à l'écran Isolation." });
  return out;
}
function isoApply(p, k, d) {
  const host = find(p, k.of, k.id), was = host.isolation || {}, params = Object.fromEntries(Object.entries(d.params || {}).filter(([x]) => x in DEFAULT_PARAMS || x === "cut_edge"));
  const next = { ...was, params, levels: { ...(d.levels || {}) } };
  if (k.of === "assembly") { next.nets = clone(d.nets || []); next.overrides = clone(d.overrides || {}); } else next.kinds = { ...(d.kinds || {}) };
  delete next.results; host.isolation = next;
}

const KINDS = { drawing: { doc: drawingDoc, check: drawingCheck, apply: drawingApply }, case: { doc: caseDoc, check: caseCheck, apply: caseApply }, iso: { doc: isoDoc, check: isoCheck, apply: isoApply } };
/** The document of a key, fit for the round trip ; null when it names nothing. */
export function moreDoc(project, key) { const k = moreKey(key, project), host = k && find(project, k.of, k.id); return host ? KINDS[k.kind].doc(project, k, host) : null; }
/** What is wrong with an answer. → [{ severity: "block" | "warn" | "info", text }] */
export function moreCheck(project, key, doc) {
  const k = moreKey(key, project); if (!k) return [{ severity: "block", text: "Cet artéfact n'existe plus dans le projet." }];
  if (doc && doc.of && doc.of !== k.of) return [{ severity: "block", text: `La réponse parle d'un·e « ${doc.of} », pas d'un·e « ${k.of} ».` }];
  return KINDS[k.kind].check(project, k, doc || {});
}
/** Writes an answer into the project — to be called INSIDE one step of the store. */
export function moreApply(project, key, doc) { const k = moreKey(key, project); if (!k) throw new Error("Cet artéfact n'existe plus dans le projet."); KINDS[k.kind].apply(project, k, doc); }
/** What the request says to the AI, kind by kind. */
export const MORE_HELP = {
  drawing: ["« sheet » est le cartouche du projet : il vaut pour toutes ses feuilles. « words » donne l'anglais de chaque texte que le dessin écrit : remplissez les vides, en anglais, sans accents.",
    "« section » : null (l'outil choisit), { \"axis\": \"x\" | \"y\", \"at\": mm } ou { \"axis\": \"none\" } ; « characteristics » : cote → normal | ref | sc | csc. Les vues, l'échelle et le format sont calculés : ils ne se changent pas ici.",
    "« sheet.uos » est le bloc « UNLESS OTHERWISE SPECIFIED » : basis (asme | iso2768), mm [X, X.X, X.XX], inch [X.XX, X.XXX], angle (°), iso (classe, ex. mK) ; vos valeurs restent des exemples jusqu'à ce que le projet les confirme. « details » : les vues de détail { letter, view (front | top | right), at [u, v] dans le plan de la vue, r (mm), scale, on }. « sheet.notesOff » : les notes générales mises à Off."],
  case: ["Le cas en cours est au premier niveau ; « others » liste les autres cas, chacun avec son « name ». « kind » : structure, thermal ou thermo.",
    "Gardez les « places » (les faces nommées) que le cas utilise : une condition s'y accroche. Une valeur que vous proposez sans source est un exemple : dites-le dans « name »."],
  iso: ["« params » : degré de pollution (1 à 4), altitude (m), catégorie de surtension (I à IV), champ (A ou B), isolation par défaut (functional, basic, reinforced). « levels » : le niveau d'une paire « A|B » de potentiels.",
    "Les distances ne se tapent pas : l'outil les mesure sur la géométrie. Ne recopiez aucun texte de norme ; une valeur tirée d'une norme dit son article."] };
