/* DesignWizard.ai — what an analytical calculation leaves with : a REPORT, as the neutral document model the house
   template prints (core/docx.js, core/pdfdoc.js — cartridge on every page, title page, approval, revision log), and a
   WORKBOOK for a spreadsheet (core/xlsx.js) laid out like the tool : the media to choose and what they give, the yellow
   cells to fill, the results, the checks and their verdict, then one sweep per input with its curve and a cell to try a
   value, the base of media the model reads, the method. A model listed in xl_formulas.js leaves ALIVE : its results are
   formulas ; the others leave with their values, their sweeps and the interpolation between them. Pure. */

import { model, run, defaults, inputActive, shortTitle } from "./index.js";
import { MEDIA, MEDIA_PROPS, MEDIA_STATES, medium, mediumProps } from "./media.js";
import { XL } from "./xl_formulas.js";
import { cellRef, colName } from "../../core/xlsx.js";
import { MARK, FOOT_NOTE } from "../../core/brand.js";

const VERDICT = { ok: "OK", warn: "À vérifier", fail: "NON" }, sig = (v, n = 4) => (typeof v === "number" && Number.isFinite(v) ? Number(v.toPrecision(n)) : v);
const fr = (v) => (typeof v === "number" && Number.isFinite(v) ? String(sig(v)).replace(".", ",") : String(v ?? "—"));
const optLabel = (d, v) => ((d.options || []).find((o) => o.value === String(v)) || {}).label || String(v ?? "");

/** The runs of a report, computed again from what was kept. runs : [{ id, name, model, part, inputs, when }] */
function replay(runs) { return (runs || []).map((s) => ({ saved: s, m: model(s.model), r: model(s.model) ? run(s.model, { ...defaults(s.model), ...(s.inputs || {}) }) : null })).filter((x) => x.m); }

/** The report of one or several analytical calculations, as a document model. meta : { date, author, project, figures { run id : figure } } */
export function physicsDoc(runs, project, meta = {}) {
  const list = replay(runs), date = meta.date || new Date(0), parts = (project && project.parts) || [], out = [], one = list.length === 1 ? list[0] : null;
  const partOf = (s) => { const p = s.part ? parts.find((x) => x.id === s.part) : null; return p ? `${p.id} — ${p.name || ""}` : s.part || "aucune"; }, nameOf = (x) => x.saved.name || shortTitle(x.m);
  if (!one) out.push({ type: "h1", text: "Synthèse" }, { type: "table", head: ["Calcul", "Pièce", "Modèle", "Résultat", "Verdict"], widths: [28, 18, 20, 22, 12],
    rows: list.map((x) => { const o = x.m.outputs[0]; return [{ text: nameOf(x), bold: true }, partOf(x.saved), shortTitle(x.m), `${o.label} : ${fr(x.r.values[o.key])} ${o.unit}`.trim(), { text: VERDICT[x.r.verdict], fill: x.r.verdict === "ok" ? "ok" : x.r.verdict === "fail" ? "error" : "warn" }]; }) });
  list.forEach((x, k) => { const { m, r, saved } = x, n = one ? "" : `${k + 1}. `, fig = meta.figures && meta.figures[saved.id];
    out.push({ type: "h1", text: `${n}${nameOf(x)}` }, { type: "p", text: m.question, style: "note" },
      { type: "kv", rows: [["Modèle", m.title], ["Pièce", partOf(saved)], ["Date du calcul", String(saved.when || "").slice(0, 10) || date.toISOString().slice(0, 10)], ["Verdict", VERDICT[r.verdict]], ...r.media.shown.map((s) => [(m.media.find((q) => q.key === s.slot) || {}).label || "Média", `${s.name}${s.T !== null ? ` à ${fr(s.T)} °C` : ""} — base des médias`])] });
    if (fig) out.push({ type: "figure", ...fig });
    out.push({ type: "h2", text: "Données" }, { type: "table", head: ["Donnée", "Valeur", "Unité", "Origine"], widths: [44, 16, 12, 28],
      rows: [...m.inputs.filter((d) => inputActive(d, r.inputs)).map((d) => [d.label, { text: d.options ? optLabel(d, r.inputs[d.key]) : fr(r.inputs[d.key]), align: d.options ? "left" : "right" }, d.unit || "", r.media.from[d.key] ? `média : ${r.media.from[d.key].name}` : d.options ? "choix" : "entrée"]),
        ...r.media.shown.flatMap((s) => s.rows.map(([label, value, unit]) => [label, { text: fr(value), align: "right" }, unit, `média : ${s.name}${s.T !== null ? ` à ${fr(s.T)} °C` : ""}`]))] },
      { type: "h2", text: "Résultats" }, { type: "table", head: ["Grandeur", "Valeur", "Unité"], widths: [58, 24, 18], rows: m.outputs.map((o, i) => [{ text: o.label, bold: i < 4 }, { text: fr(r.values[o.key]), align: "right", bold: i < 4 }, o.unit || ""]) });
    if (r.checks.length) out.push({ type: "h2", text: "Vérifications" }, { type: "table", head: ["Vérification", "Valeur", "Limite", "Marge", "Verdict"], widths: [42, 16, 16, 12, 14],
      rows: r.checks.map((c) => [c.label, { text: `${fr(c.value)} ${c.unit}`, align: "right" }, { text: `${fr(c.limit)} ${c.unit}`, align: "right" }, { text: c.margin >= 999 ? "> 999" : fr(c.margin), align: "right" }, { text: c.ok ? (c.tight ? "JUSTE" : "OK") : c.soft ? "À vérifier" : "NON", fill: c.ok ? (c.tight ? "warn" : "ok") : c.soft ? "warn" : "error" }]) });
    if (r.warnings.length) out.push({ type: "h2", text: "Limites de validité" }, ...r.warnings.map((w) => ({ type: "p", text: w, style: "warn" })));
    out.push({ type: "h2", text: "Calcul" }, { type: "list", ordered: true, items: r.steps }, { type: "h2", text: "Hypothèses et domaine de validité" }, { type: "list", items: m.assumptions }, { type: "p", text: m.validity }, { type: "p", text: `Référence : ${m.reference}`, style: "muted" });
    if (k < list.length - 1) out.push({ type: "pagebreak" }); });
  out.push({ type: "h1", text: "Accord" }, { type: "p", text: "Un calcul analytique répond à l'essentiel de la question en une page ; une simulation par éléments finis, puis un essai, confirment le reste. Les propriétés des médias sont des valeurs typiques : la fiche de la nuance ou du fluide acheté fait foi.", style: "muted" }, { type: "signatures", roles: ["Préparé par", "Vérifié par"] });
  const id = one ? String(one.saved.part || one.m.id).toUpperCase() : String((project && project.id) || "PROJET").toUpperCase();
  return { title: one ? `Note de calcul — ${nameOf(one)}` : "Notes de calcul analytique", subtitle: one ? one.m.title : `${list.length} calculs gardés dans le projet`, subject: "Note de calcul", kind: "Note de calcul", author: meta.author || "", date, project: meta.project || "",
    reference: `${id}-CALC`, revision: meta.revision || "A", header: one ? nameOf(one) : "Notes de calcul analytique", blocks: [...(one ? [] : [{ type: "toc" }, { type: "pagebreak" }]), ...out] };
}

/** One input swept around its value, the others kept : [{ x, values }]. n points from half to one and a half of the value, inside what the model accepts. */
export function sweep(modelId, inputs, key, n = 11) {
  const m = model(modelId), d = m && m.inputs.find((x) => x.key === key), v = d && inputs[key];
  if (!d || d.options || !Number.isFinite(v) || v === 0) return [];
  const lo = Math.max(d.min, Math.min(v * 0.5, v * 1.5)), hi = Math.min(d.max, Math.max(v * 0.5, v * 1.5)); if (!(hi > lo)) return [];
  return Array.from({ length: n }, (_, k) => { const x = sig(lo + (hi - lo) * k / (n - 1), 6), r = run(modelId, { ...inputs, [key]: x }); return { x, values: r.values }; });
}

/** The workbook of a calculation. inputs : those of the screen (with the media chosen) ; meta : { name, part, date, author, project, version, logo (PNG bytes), confidential }.
    → the model xlsx() takes, with `live` (true when the results are formulas) and `cells` (where each named cell is — for the tests). */
export function physicsBook(modelId, inputs, meta = {}) {
  const m = model(modelId); if (!m) return null;
  const r = run(modelId, inputs), I = r.inputs, X = XL[modelId] || null, date = meta.date || new Date(0), names = [], cells = {}, taken = new Set();
  const nm = (prefix, key) => { let s = `${prefix}_${key}`.replace(/[^A-Za-z0-9_]/g, "_"); while (taken.has(s.toLowerCase())) s += "_"; taken.add(s.toLowerCase()); return s; };
  /* ---------- the media the model reads : one row each, the properties in columns ---------- */
  const states = [...new Set(m.media.flatMap((s) => s.states))], order = MEDIA_STATES.map((s) => s.id), T = Number.isFinite(I.T) ? I.T : 20, pk = Object.keys(MEDIA_PROPS);
  const base = MEDIA.filter((x) => states.includes(x.state)), mRows = [[{ v: "Média", s: "th" }, { v: "État", s: "th" }, ...pk.map((k) => ({ v: `${MEDIA_PROPS[k].label}${MEDIA_PROPS[k].unit ? ` [${MEDIA_PROPS[k].unit}]` : ""}`, s: "th" }))],
    ...base.map((x) => { const P = mediumProps(x.id, x.at ? T : undefined); return [{ v: x.name, s: "tdl" }, { v: MEDIA_STATES[order.indexOf(x.state)].one, s: "tdl" }, ...pk.map((k) => (Number.isFinite(P[k]) ? { v: P[k], s: "td" } : { v: "", s: "td" }))]; })];
  const rangeOf = (slot) => { const idx = base.map((x, k) => (slot.states.includes(x.state) ? k : -1)).filter((k) => k >= 0); return idx.length ? [idx[0] + 2, idx[idx.length - 1] + 2] : null; };       // rows of the sheet, 1-based
  const live = !!X && m.media.every((s) => !s.own || (medium(I[s.key]) && rangeOf(s)));      // a fluid typed by hand before the base of media : the formulas have nothing to read
  const lookup = (slot, prop, cell) => { const rg = rangeOf(slot), c = colName(2 + pk.indexOf(prop)); return `INDEX(Medias!$${c}$${rg[0]}:$${c}$${rg[1]},MATCH(${cell},Medias!$A$${rg[0]}:$A$${rg[1]},0))`; };
  /* ---------- the sheet of the calculation ---------- */
  const rows = [], limits = [], verdicts = [], merges = [], S = "Calcul", at = () => rows.length, put = (cellsOfRow, h) => { rows.push(h ? { h, cells: cellsOfRow } : cellsOfRow); return rows.length - 1; };
  const named = (name, col, row) => { names.push({ name, ref: `${S}!${cellRef(col, row, true)}` }); cells[name] = cellRef(col, row); return name; };
  put([null, { v: MARK, s: "brand" }], 34); merges.push("B1:F1");
  put([{ v: m.question, s: "title" }], 26); merges.push("A2:F2");
  put([{ v: `${m.title} · ${meta.name || shortTitle(m)}${meta.part ? ` · pièce ${meta.part}` : ""} · ${date.toISOString().slice(0, 10)}`, s: "sub" }]); merges.push("A3:F3");
  const vRow = put([{ v: "Verdict", s: "head" }, { v: VERDICT[r.verdict] === "À vérifier" ? "JUSTE" : VERDICT[r.verdict], s: "verdict" }, null, { v: live ? "Ce classeur est vivant : changez une case jaune, les résultats suivent." : "Résultats figés à l'export ; la feuille Iterations permet d'essayer une valeur à la fois.", s: "note" }]); merges.push(`D${vRow + 1}:F${vRow + 1}`);
  put([]); put([{ v: "DONNÉES — les cases jaunes se modifient", s: "head" }, { v: "Valeur", s: "head" }, { v: "Unité", s: "head" }, { v: "Plage du modèle, origine", s: "head" }]);
  const inName = {}, propName = {}, slotCell = {}, before = new Map(m.media.map((s) => [s.own ? s.key : (m.inputs.find((d) => s.gives[d.key]) || {}).key, s]));
  let group = null;
  for (const d of m.inputs) {
    const idle = !inputActive(d, I), old = idle && Object.keys(d.when || {}).some((k) => m.media.some((s) => s.own && s.key === k));      // a value typed for a fluid, from before the base of media
    if (idle && (!live || old)) continue;                        // a workbook that is alive keeps every other input : the choice that wakes it can be made offline
    if (d.group !== group) { group = d.group; put([{ v: group || "Données", s: "group" }, { v: "", s: "group" }, { v: "", s: "group" }, { v: "", s: "group" }]); }
    const slot = before.get(d.key), chosen = slot && medium(I[slot.key]);
    if (slot && chosen && rangeOf(slot)) { const row = put([{ v: slot.label, s: "label" }, { v: chosen.name, s: "choice" }, { v: "média", s: "unit" }, { v: "Choisir dans la liste : la feuille Medias donne ses propriétés", s: "note" }]), rg = rangeOf(slot);
      slotCell[slot.key] = cellRef(1, row, true); named(nm("m", slot.key), 1, row); limits.push({ ref: cellRef(1, row), listRef: `Medias!$A$${rg[0]}:$A$${rg[1]}`, text: "Choisir un média de la feuille Medias." });
      for (const prop of slot.shows || []) { const P = mediumProps(chosen.id, chosen.at ? T : undefined), pr = put([{ v: MEDIA_PROPS[prop].label, s: "label" }, { v: P[prop], f: lookup(slot, prop, slotCell[slot.key]), s: "prop" }, { v: MEDIA_PROPS[prop].unit, s: "unit" }, { v: `donné par le média${chosen.at ? `, à ${fr(T)} °C` : ""}`, s: "note" }]); propName[prop] = named(nm("p", prop), 1, pr); } }
    if (slot && slot.own) continue;
    const from = r.media.from[d.key], fluidT = d.key === "T" && m.media.some((s) => s.own);
    const row = put([{ v: d.label, s: "label" }, from && slotCell[from.slot] ? { v: I[d.key], f: lookup(m.media.find((s) => s.key === from.slot), from.prop, slotCell[from.slot]), s: "prop" } : { v: d.options ? String(I[d.key]) : I[d.key], s: fluidT ? "value" : d.options ? "choice" : "input" }, { v: d.unit || "", s: "unit" },
      { v: idle ? `sert quand ${Object.entries(d.when).map(([k, list]) => `${k} = ${list.join(" ou ")}`).join(", ")}` : from ? `donné par le média — ${from.name} à l'export` : fluidT ? "figée à l'export : les propriétés des fluides de la feuille Medias sont à cette température" : d.options ? d.options.map((o) => `${o.value} = ${o.label}`).join(" ; ") : `de ${fr(d.min)} à ${fr(d.max)}`, s: "note" }]);
    inName[d.key] = named(nm("in", d.key), 1, row);
    if (!from && !fluidT) limits.push(d.options ? { ref: cellRef(1, row), list: d.options.filter((o) => !o.legacy).map((o) => o.value), text: "Choisir une des valeurs de la liste." } : { ref: cellRef(1, row), min: d.min, max: d.max, text: `${d.label} : le modèle accepte de ${d.min} à ${d.max} ${d.unit || ""}.` });
  }
  /* ---------- the results : formulas for a model that is alive, values otherwise ---------- */
  const outName = {}, helpName = {}, hv = {}, tok = (f) => f.replace(/\{(p:|h:|o:)?([A-Za-z0-9_]+)\}/g, (all, kind, key) => (kind === "p:" ? propName[key] : kind === "h:" ? helpName[key] : kind === "o:" ? outName[key] : inName[key]) || "0");
  put([]); put([{ v: "RÉSULTATS", s: "head" }, { v: "Valeur", s: "head" }, { v: "Unité", s: "head" }, { v: live ? "Formule vivante" : "Valeur à l'export", s: "head" }]);
  const props = Object.fromEntries(m.media.flatMap((s) => { const c = medium(I[s.key]); return c ? Object.entries(mediumProps(c.id, c.at ? T : undefined)) : []; }));
  if (live) for (const h of X.helpers) { hv[h.key] = h.js(I, props, hv); const row = put([{ v: h.label, s: "label" }, { v: hv[h.key], f: tok(h.f), s: "helper" }, { v: h.unit, s: "unit" }, { v: "valeur intermédiaire", s: "note" }]); helpName[h.key] = named(nm("h", h.key), 1, row); }
  const outRow = {};
  for (const o of m.outputs) { outRow[o.key] = at(); outName[o.key] = nm("o", o.key); put([{ v: o.label, s: "label" }, null, { v: o.unit || "", s: "unit" }, null]); named(outName[o.key], 1, outRow[o.key]); }
  for (const o of m.outputs) { const row = outRow[o.key], f = live && X.outputs[o.key] ? tok(X.outputs[o.key]) : null, cellsOfRow = Array.isArray(rows[row]) ? rows[row] : rows[row].cells, ref = cellRef(1, row);
    cellsOfRow[1] = f ? { v: r.values[o.key], f, s: "output" } : { v: r.values[o.key], s: "output" };
    cellsOfRow[3] = o.unit === "kPa" ? { v: `${fr(r.values[o.key] / 6.894757293168361)} psi · ${fr(r.values[o.key] / 100)} bar · ${fr(r.values[o.key] / 101.325)} atm`, f: `TEXT(${ref}/6.894757293168361,"0.0000")&" psi · "&TEXT(${ref}/100,"0.00000")&" bar · "&TEXT(${ref}/101.325,"0.00000")&" atm"`, s: "note" } : { v: f ? `= ${X.outputs[o.key].replace(/\{(?:p:|h:|o:)?([A-Za-z0-9_]+)\}/g, "$1")}`.slice(0, 140) : "", s: "note" }; }
  /* ---------- the checks, and the verdict they give ---------- */
  if (r.checks.length) { put([]); put(["VÉRIFICATIONS", "Valeur", "Limite", "Unité", "Marge", "Verdict"].map((v) => ({ v, s: "head" })));
    r.checks.forEach((c, k) => { const row = at(), x = live && X.checks[k], R = row + 1, word = c.ok ? (c.tight ? "JUSTE" : "OK") : "NON";
      const val = x ? { v: c.value, f: outName[x.value], s: "value" } : { v: c.value, s: "value" }, lim = x ? { v: c.limit, f: inName[x.limit], s: "value" } : { v: c.limit, s: "value" }, sf = x && x.sf ? tok(x.sf) : "1";
      put([{ v: c.label, s: "label" }, val, lim, { v: c.unit, s: "unit" }, x ? { v: c.margin, f: x.min ? `IF(C${R}>0,MIN(999,B${R}/C${R}),0)` : `IF(B${R}>0,MIN(999,C${R}/B${R}),999)`, s: "value" } : { v: c.margin, s: "value" },
        x ? { v: word, f: `IF(E${R}<1,"NON",IF(E${R}<${sf},"JUSTE","OK"))`, s: "verdict" } : { v: word, s: "verdict" }]); verdicts.push({ ref: `F${R}` }); });
    const first = verdicts[0].ref, last = verdicts[verdicts.length - 1].ref, vc = Array.isArray(rows[vRow]) ? rows[vRow] : rows[vRow].cells;
    if (live) vc[1] = { v: vc[1].v, f: `IF(COUNTIF(${first}:${last},"NON")>0,"NON",IF(COUNTIF(${first}:${last},"JUSTE")>0,"JUSTE","OK"))`, s: "verdict" }; }
  verdicts.push({ ref: `B${vRow + 1}` });
  if (live && X.flags.length) { put([]); put([{ v: "DOMAINE DE VALIDITÉ", s: "head" }, { v: "", s: "head" }, { v: "", s: "head" }, { v: "", s: "head" }]); for (const f of X.flags) { const row = put([{ v: f.label, s: "label" }, { v: "", f: tok(f.f), s: "text" }]); merges.push(`B${row + 1}:F${row + 1}`); } }
  if (r.warnings.length) { put([]); put([{ v: "LIMITES DE VALIDITÉ RELEVÉES À L'EXPORT", s: "head" }]); for (const w of r.warnings) { const row = put([{ v: w, s: "warn" }], 30); merges.push(`A${row + 1}:F${row + 1}`); } }
  put([]); { const row = put([{ v: FOOT_NOTE, s: "note" }], 28); merges.push(`A${row + 1}:F${row + 1}`); }
  /* ---------- the sweeps : one input at a time, a curve, and a cell to try a value ---------- */
  const it = [{ h: 34, cells: [null, { v: MARK, s: "brand" }] }, [{ v: "Itérations — une donnée à la fois, les autres gardées", s: "title" }], [{ v: "Chaque tableau a été calculé par la plateforme à l'export. La case jaune essaie une valeur : le résultat est interpolé entre deux points du tableau.", s: "note" }], []], itMerges = ["B1:J1", "A2:J2", "A3:J3"], itLimits = [], charts = [];
  const keys = m.inputs.filter((d) => !d.options && d.group !== "Critères" && !r.media.from[d.key] && inputActive(d, I) && Number.isFinite(I[d.key]) && I[d.key] !== 0 && !(d.key === "T" && m.media.some((s) => s.own))).map((d) => d.key).slice(0, 8), outs = m.outputs.slice(0, 3), swept = [];      // a limit one sets changes no result : it is not swept
  for (const key of keys) { const d = m.inputs.find((x) => x.key === key), pts = sweep(modelId, I, key); if (pts.length < 2) continue;
    const top = it.length, first = top + 4, last = first + pts.length - 1, X1 = `$A$${first}:$A$${last}`, tryRef = `$B$${top + 2}`, n = pts.length;
    it.push([{ v: `${d.label}${d.unit ? ` [${d.unit}]` : ""}`, s: "head" }, { v: "", s: "head" }, ...outs.map(() => ({ v: "", s: "head" }))]);
    it.push([{ v: "Essayer la valeur →", s: "label" }, { v: I[key], s: "input" }, ...outs.map((o, j) => { const c = colName(2 + j), Y = `$${c}$${first}`; return { v: sig(r.values[o.key], 6), f: `IF(OR(${tryRef}<$A$${first},${tryRef}>$A$${last}),"hors du tableau",FORECAST(${tryRef},OFFSET(${Y},MIN(MATCH(${tryRef},${X1},1),${n - 1})-1,0,2,1),OFFSET($A$${first},MIN(MATCH(${tryRef},${X1},1),${n - 1})-1,0,2,1)))`, s: "output" }; })]);
    it.push([{ v: d.unit ? `${key} [${d.unit}]` : key, s: "th" }, { v: "", s: "th" }, ...outs.map((o) => ({ v: `${o.label}${o.unit ? ` [${o.unit}]` : ""}`, s: "th" }))]);
    for (const p of pts) it.push([{ v: p.x, s: "td" }, { v: "", s: "td" }, ...outs.map((o) => ({ v: sig(p.values[o.key], 6), s: "td" }))]);
    itLimits.push({ ref: `B${top + 2}`, min: pts[0].x, max: pts[n - 1].x, text: `Le tableau va de ${pts[0].x} à ${pts[n - 1].x}.` });
    charts.push({ title: `${outs[0].label} selon ${d.label}`, x: `Iterations!$A$${first}:$A$${last}`, y: [{ name: outs[0].label, ref: `Iterations!$C$${first}:$C$${last}` }], xTitle: `${d.label}${d.unit ? ` [${d.unit}]` : ""}`, yTitle: `${outs[0].label}${outs[0].unit ? ` [${outs[0].unit}]` : ""}`, from: [6, top], to: [13, last + 1] });
    swept.push({ key, top, first, last }); it.push([], []); }
  it.push([{ v: "Journal des itérations", s: "head" }, ...["Ce qui change", "Valeur essayée", "Résultat", "Décision"].map((v) => ({ v, s: "head" }))]); for (let k = 0; k < 10; k++) it.push([{ v: "", s: "tdl" }, { v: "", s: "tdl" }, { v: "", s: "td" }, { v: "", s: "td" }, { v: "", s: "tdl" }]);
  /* ---------- the method, and what this file is ---------- */
  const me = [{ h: 34, cells: [null, { v: MARK, s: "brand" }] }, [{ v: `Méthode — ${m.title}`, s: "title" }], [], [{ v: "CALCUL, ÉTAPE PAR ÉTAPE (valeurs à l'export)", s: "head" }], ...r.steps.map((s, k) => ({ h: 30, cells: [{ v: `${k + 1}. ${s}`, s: "text" }] })), [], [{ v: "HYPOTHÈSES", s: "head" }], ...m.assumptions.map((a) => ({ h: 30, cells: [{ v: a, s: "text" }] })), [],
    [{ v: "DOMAINE DE VALIDITÉ", s: "head" }], { h: 30, cells: [{ v: m.validity, s: "text" }] }, [], [{ v: "RÉFÉRENCE", s: "head" }], [{ v: m.reference, s: "text" }]];
  const notice = [{ h: 34, cells: [null, { v: MARK, s: "brand" }] }, [{ v: "Ce classeur", s: "title" }], [],
    ...[["Ce que c'est", `Le calcul « ${meta.name || shortTitle(m)} » de la plateforme, à emporter : mêmes données, mêmes résultats, mêmes vérifications que l'écran des modèles analytiques.`],
      ["Feuille Calcul", live ? "Vivante : les résultats, les marges et le verdict sont des formules. Changez une case jaune, tout suit. Les cases pâles viennent du média choisi : changez le média, pas la valeur." : "Les résultats sont les valeurs calculées par la plateforme à l'export : ce modèle n'a pas encore ses formules dans le classeur. Pour un autre jeu de données, utilisez la feuille Iterations, ou relancez le calcul dans la plateforme."],
      ["Feuille Iterations", "Un tableau par donnée, calculé par la plateforme : la donnée varie de la moitié à une fois et demie sa valeur, les autres sont gardées. La case jaune essaie une valeur ; le résultat est interpolé entre deux points — exact aux points, approché entre eux, et une seule donnée à la fois."],
      ["Feuille Medias", `La base des médias que ce modèle lit, avec leurs propriétés${m.media.some((s) => s.own) ? ` — pour les fluides, à ${fr(T)} °C, la température de l'export` : ""}. Valeurs typiques : la fiche de la nuance ou du fluide acheté fait foi.`],
      ["Feuille Methode", "Le calcul écrit étape par étape avec les valeurs de l'export, ses hypothèses, son domaine de validité et sa référence."],
      ["Unités", "Celles du modèle : mm, N, MPa, GPa, kPa, °C, L/min. Une pression en kPa est aussi donnée en psi, bar et atm."],
      ["Limites", "Un calcul analytique répond à l'essentiel de la question ; il ne remplace ni une simulation, ni un essai. Hors du domaine de validité, le résultat n'est qu'un ordre de grandeur."],
      ["Projet", `${meta.project || "—"}${meta.part ? ` · pièce ${meta.part}` : ""} · ${date.toISOString().slice(0, 10)}${meta.version ? ` · DesignWizard.ai ${meta.version}` : ""}`], ...(meta.confidential ? [["Confidentialité", meta.confidential]] : []), ["Marque", FOOT_NOTE]].map(([a, b]) => ({ h: 44, cells: [{ v: a, s: "head" }, { v: b, s: "text" }] }))];
  const pic = meta.logo ? [{ png: meta.logo, col: 0, row: 0, w: 10, h: 10 }] : [];
  return { title: `${meta.name || shortTitle(m)} — ${m.title}`, subject: "Calcul analytique", author: meta.author || "", date, live, cells, swept,
    names, sheets: [{ name: S, cols: [46, 26, 12, 56, 12, 12], rows, merges, limits, verdicts, pictures: pic, freeze: 4 },
      { name: "Iterations", cols: [34, 16, 22, 22, 22, 4, 12, 12, 12, 12, 12, 12, 12, 12], rows: it, merges: itMerges, limits: itLimits, pictures: pic, charts },
      { name: "Medias", cols: [38, 12, ...pk.map(() => 17)], rows: mRows, freeze: 1 }, { name: "Methode", cols: [10, 124], rows: me.map((x, k) => (k < 1 ? x : Array.isArray(x) ? [null, ...x] : { ...x, cells: [null, ...x.cells] })), pictures: pic }, { name: "Notice", cols: [24, 110], rows: notice, pictures: pic }] };
}
