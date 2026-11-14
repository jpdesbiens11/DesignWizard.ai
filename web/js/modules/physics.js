/* DesignWizard.ai — Physique: recognised hand calculations that answer « does the physics behind this part work? ».
   Left: the questions, grouped by domain. Right: the chosen model — part picker and prefill, inputs, live verdict,
   checks with margins, the calculation written like a hand calculation, assumptions, validity and reference.
   Route: #/physics or #/physics/<modelId>/<partId>. Runs added to the report live in project.physics. */

import { el, clear, btn, badge, field, table, fmt, toast, svg } from "../core/dom.js";
import { registerModule, setStatus, go } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { MODELS, DOMAINS, model, defaults, run, prefill, inputActive } from "../analysis/physics/index.js";

const memory = new Map();        // model id -> last inputs, kept while the page is open
const prefillNotes = new Map();  // model id -> { key: where the value comes from }
const VERDICT = { ok: ["OK", "ok"], warn: ["À vérifier", "warn"], fail: ["NON", "danger"] };
const verdictBadge = (v) => badge((VERDICT[v] || VERDICT.warn)[0], (VERDICT[v] || VERDICT.warn)[1]);

/** A number the way an engineer reads it: about 4 significant digits, French decimal comma. */
function show(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  return fmt(v, a === 0 || a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : Math.min(9, 3 - Math.floor(Math.log10(a))));
}

/** Rows of the design-review report: one per saved run (title, part, verdict, key result, tightest check). */
export function physicsSummary(project) {
  const parts = (project && project.parts) || [];
  return ((project && project.physics) || []).map((r) => {
    const m = model(r.model), values = r.values || {}, o = m && m.outputs.find((x) => typeof values[x.key] === "number");
    const worst = (r.checks || []).reduce((a, c) => (!a || c.margin < a.margin ? c : a), null), part = r.part ? parts.find((p) => p.id === r.part) : null;
    return { id: r.id, model: r.model, title: m ? m.title : r.model, question: m ? m.question : "", part: r.part || "", partName: part ? part.name || "" : "",
      verdict: r.verdict, verdictLabel: (VERDICT[r.verdict] || VERDICT.warn)[0], result: o ? `${o.label} : ${show(values[o.key])} ${o.unit}`.trim() : "—",
      worst: worst ? `${worst.label} — marge ${show(worst.margin)}` : "", when: r.when || "" };
  });
}

/* ---------- small diagrams (no text inside the SVG) ---------- */
const ACC = "var(--hl-red)";   // loads, flows and heat: readable whatever the accent colour of the tab
const ln = (x1, y1, x2, y2, o = {}) => svg("line", { x1, y1, x2, y2, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6, "stroke-linecap": "round", "stroke-dasharray": o.dash });
const bx = (x, y, w, h, o = {}) => svg("rect", { x, y, width: w, height: h, rx: o.r === undefined ? 1.5 : o.r, fill: o.fill || "none", "fill-opacity": o.op, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6 });
const pa = (d, o = {}) => svg("path", { d, fill: o.fill || "none", "fill-opacity": o.op, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": o.dash });
const ci = (cx, cy, r, o = {}) => svg("circle", { cx, cy, r, fill: o.fill || "none", "fill-opacity": o.op, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6 });
function arrow(x1, y1, x2, y2, c = ACC) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = (da) => `${(x2 - 7 * Math.cos(a + da)).toFixed(1)} ${(y2 - 7 * Math.sin(a + da)).toFixed(1)}`;
  return [ln(x1, y1, x2, y2, { c, w: 2 }), svg("path", { d: `M${x2} ${y2} L${p(0.42)} L${p(-0.42)} Z`, fill: c })];
}
const fixedWall = (x, y1, y2, side = -1) => [ln(x, y1, x, y2, { w: 2.6 }), ...Array.from({ length: Math.floor((y2 - y1) / 8) }, (_, k) => ln(x, y1 + 4 + k * 8, x + side * 7, y1 + 10 + k * 8, { w: 1 }))];
const support = (x, y) => [pa(`M${x} ${y} L${x - 8} ${y + 13} L${x + 8} ${y + 13} Z`), ln(x - 12, y + 16, x + 12, y + 16, { w: 1 })];
const udl = (x1, x2, y) => [ln(x1, y - 20, x2, y - 20, { c: ACC, w: 1.4 }), ...Array.from({ length: 7 }, (_, k) => arrow(x1 + k * (x2 - x1) / 6, y - 20, x1 + k * (x2 - x1) / 6, y - 2))];
const plates = () => [bx(40, 44, 130, 14, { fill: "currentColor", op: 0.08 }), bx(70, 58, 130, 14, { fill: "currentColor", op: 0.16 }), arrow(40, 51, 14, 51), arrow(200, 65, 226, 65)];
const resistor = (x) => pa(`M${x} 50 l8 0 l3 -7 l6 14 l6 -14 l6 14 l6 -14 l3 7 l8 0`);
const finRow = () => [bx(40, 80, 160, 10, { fill: "currentColor", op: 0.15 }), ...Array.from({ length: 8 }, (_, k) => bx(42 + k * 21.6, 34, 6, 46, { fill: "currentColor", op: 0.15 }))];
const pipeWalls = () => [ln(20, 38, 220, 38, { w: 2.4 }), ln(20, 72, 220, 72, { w: 2.4 }), arrow(2, 55, 26, 55)];
const SKETCH = {
  "cantilever-point": () => [fixedWall(34, 28, 84), bx(34, 50, 170, 10, { fill: "currentColor", op: 0.1 }), pa("M34 55 Q130 56 204 74", { dash: "4 4", w: 1.1 }), arrow(200, 14, 200, 47)],
  "cantilever-udl": () => [fixedWall(34, 28, 84), bx(34, 50, 170, 10, { fill: "currentColor", op: 0.1 }), pa("M34 55 Q130 56 204 70", { dash: "4 4", w: 1.1 }), udl(40, 200, 50)],
  "simple-point": () => [bx(30, 46, 180, 10, { fill: "currentColor", op: 0.1 }), support(38, 56), support(202, 56), pa("M38 51 Q120 68 202 51", { dash: "4 4", w: 1.1 }), arrow(120, 10, 120, 43)],
  "simple-udl": () => [bx(30, 46, 180, 10, { fill: "currentColor", op: 0.1 }), support(38, 56), support(202, 56), pa("M38 51 Q120 66 202 51", { dash: "4 4", w: 1.1 }), udl(40, 200, 46)],
  column: () => [bx(114, 24, 12, 68, { fill: "currentColor", op: 0.1 }), ln(90, 92, 150, 92, { w: 2.6 }), ...Array.from({ length: 7 }, (_, k) => ln(94 + k * 8, 92, 88 + k * 8, 99, { w: 1 })), pa("M120 24 Q148 58 120 92", { dash: "4 4", w: 1.1 }), arrow(120, 0, 120, 21)],
  shaft: () => [fixedWall(40, 24, 86), bx(40, 42, 150, 26, { fill: "currentColor", op: 0.1 }), svg("ellipse", { cx: 190, cy: 55, rx: 6, ry: 13, fill: "none", stroke: "currentColor", "stroke-width": 1.6 }),
    pa("M40 48 L190 62", { dash: "4 4", w: 1.1 }), pa("M204 34 A24 24 0 0 1 204 76", { c: ACC, w: 2 }), svg("path", { d: "M204 76 L212 73 L206 67 Z", fill: ACC })],
  plate: () => [pa("M30 78 L80 44 L214 44 L164 78 Z", { fill: "currentColor", op: 0.1 }), pa("M30 78 L30 84 L164 84 L164 78 M164 84 L214 50 L214 44"), ...[70, 105, 140, 175].map((x) => arrow(x, 10, x, 50)), ...[55, 90, 125].map((x) => arrow(x + 15, 26, x + 15, 66))],
  bimetal: () => [bx(40, 38, 150, 16, { fill: ACC, op: 0.25 }), bx(40, 54, 150, 16, { fill: "currentColor", op: 0.15 }), fixedWall(40, 30, 78), arrow(192, 46, 228, 46), arrow(192, 62, 208, 62, "currentColor")],
  bolt: () => [plates(), bx(104, 30, 32, 14, { fill: "currentColor", op: 0.35 }), bx(113, 44, 14, 44, { fill: "currentColor", op: 0.35 }), bx(104, 72, 32, 12, { fill: "currentColor", op: 0.35 }), arrow(120, 4, 120, 26), arrow(120, 108, 120, 90)],
  pressfit: () => [ci(70, 55, 40, { fill: "currentColor", op: 0.1 }), ci(70, 55, 19, { fill: "currentColor", op: 0.3 }), ...[0, 1, 2, 3].map((k) => { const a = k * Math.PI / 2 + Math.PI / 4; return arrow(70 + 34 * Math.cos(a), 55 + 34 * Math.sin(a), 70 + 22 * Math.cos(a), 55 + 22 * Math.sin(a)); }),
    bx(150, 24, 44, 62, { fill: "currentColor", op: 0.1 }), bx(132, 42, 96, 26, { fill: "currentColor", op: 0.3 })],
  pin: () => [plates(), bx(114, 36, 12, 44, { fill: ACC, op: 0.45, r: 4 })],
  pipe: () => [pipeWalls(), pa("M70 40 Q118 55 70 70", { c: ACC }), ...[46, 55, 64].map((y) => arrow(70, y, y === 55 ? 92 : 84, y)), arrow(150, 55, 214, 55), ln(118, 30, 118, 80, { dash: "3 4", w: 1 })],
  orifice: () => [pipeWalls(), bx(116, 38, 6, 12, { fill: "currentColor", op: 0.5 }), bx(116, 60, 6, 12, { fill: "currentColor", op: 0.5 }), pa("M40 44 Q100 44 119 52 Q140 54 200 46", { c: ACC, w: 1.2 }), pa("M40 66 Q100 66 119 58 Q140 56 200 64", { c: ACC, w: 1.2 }), arrow(126, 55, 190, 55)],
  wall: () => [bx(74, 18, 34, 74, { fill: "currentColor", op: 0.2 }), bx(108, 18, 9, 74, { fill: ACC, op: 0.45 }), bx(117, 18, 50, 74, { fill: "currentColor", op: 0.08 }), arrow(24, 55, 70, 55), arrow(171, 55, 216, 55), pa("M74 28 L108 36 L117 62 L167 76", { dash: "4 4", w: 1.2 })],
  chain: () => [bx(8, 62, 44, 22, { fill: "currentColor", op: 0.3 }), ln(30, 62, 30, 50), ...[30, 90, 150, 210].map((x) => ci(x, 50, 3.5, { fill: "currentColor", op: 1 })), resistor(34), resistor(94), resistor(154), ln(210, 50, 210, 74), ln(198, 74, 222, 74, { w: 2.2 }), ln(203, 80, 217, 80), ln(207, 86, 213, 86), arrow(30, 30, 80, 30)],
  "fins-natural": () => [finRow(), ...[53, 96, 139, 182].map((x) => arrow(x + 0.6, 76, x + 0.6, 8))],
  "fins-forced": () => [bx(50, 76, 160, 10, { fill: "currentColor", op: 0.15 }), bx(50, 30, 160, 46, { fill: "currentColor", op: 0.08 }), pa("M50 74 Q110 64 210 60", { dash: "4 4", w: 1.1 }), ...[38, 52, 66].map((y) => arrow(8, y, 44, y))],
  lump: () => [bx(86, 36, 56, 44, { fill: "currentColor", op: 0.2, r: 6 }), arrow(114, 32, 114, 8), arrow(82, 58, 56, 58), arrow(146, 58, 168, 58), ln(180, 92, 232, 92, { w: 1 }), ln(180, 92, 180, 24, { w: 1 }), pa("M180 92 Q190 40 232 36", { c: ACC, w: 2 }), ln(180, 34, 232, 34, { dash: "3 4", w: 1 })],
  busbar: () => [pa("M30 52 L48 38 L218 38 L200 52 Z", { fill: "currentColor", op: 0.1 }), bx(30, 52, 170, 16, { fill: "currentColor", op: 0.22, r: 0 }), pa("M200 52 L218 38 L218 54 L200 68 Z", { fill: "currentColor", op: 0.3 }),
    svg("ellipse", { cx: 52, cy: 45, rx: 6, ry: 3, fill: "none", stroke: "currentColor", "stroke-width": 1.3 }), svg("ellipse", { cx: 192, cy: 45, rx: 6, ry: 3, fill: "none", stroke: "currentColor", "stroke-width": 1.3 }), arrow(2, 60, 26, 60), arrow(221, 46, 239, 46), ...[80, 120, 160].map((x) => pa(`M${x} 34 q4 -8 0 -14 q-4 -6 0 -12`, { c: ACC, w: 1.2 }))],
  trace: () => [bx(24, 64, 192, 18, { fill: "currentColor", op: 0.12 }), bx(46, 58, 148, 6, { fill: ACC, op: 0.7, r: 0 }), arrow(10, 50, 44, 50), arrow(196, 50, 230, 50), ...[90, 120, 150].map((x) => pa(`M${x} 52 q4 -8 0 -14 q-4 -6 0 -12`, { c: ACC, w: 1.2 }))],
  pulse: () => [ln(26, 92, 226, 92, { w: 1 }), ln(26, 92, 26, 12, { w: 1 }), pa("M26 92 L64 92 L64 30 L128 30 L128 92 L220 92", { c: ACC, w: 2.2 }), pa("M64 86 Q100 60 128 22 L220 24", { dash: "5 4", w: 1.4 })],
};
function sketch(m) {
  const draw = SKETCH[m.sketch];
  return svg("svg", { viewBox: "0 0 240 110", width: 240, height: 110, role: "img", "aria-label": `Schéma : ${m.title}`, style: "max-width:100%;color:var(--ink);flex:0 0 auto" }, ...(draw ? draw().flat(Infinity) : []));
}

/* ---------- the screen ---------- */
function render(main, args) {
  const cur = model(args[0]), partId = args[1] && store.part(args[1]) ? args[1] : "";
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Physique"),
    el("p", { class: "muted" }, "Des modèles analytiques reconnus et simples — une poutre, un tube, une vis, une ailette — qui répondent à 80 % de la question « la physique derrière cette pièce fonctionne-t-elle ? ». Chaque calcul montre ses formules, ses hypothèses et sa source ; la simulation par éléments finis simplifiés, puis l'essai, confirment le reste.")),
    el("div", { class: "subtabs" }, el("a", { class: "subtab active", href: "#/physics" }, "Modèles analytiques"), el("a", { class: "subtab", href: "#/fea" }, "Simulation"))));
  const left = el("div", { style: { flex: "0 1 300px", minWidth: "230px" } }), right = el("div", { style: { flex: "1 1 560px", minWidth: "0" } });
  page.append(el("div", { style: { display: "flex", flexWrap: "wrap", gap: "1.2rem", alignItems: "flex-start" } }, left, right));
  for (const d of DOMAINS) {
    left.append(el("h3", { style: { margin: ".7rem 0 .4rem" } }, d.label));
    for (const m of MODELS.filter((x) => x.domain === d.id)) {
      left.append(el("a", { class: "card lift", href: `#/physics/${m.id}${partId ? "/" + encodeURIComponent(partId) : ""}`, "aria-current": cur && cur.id === m.id ? "page" : null,
        style: { padding: ".5rem .7rem", marginBottom: ".45rem", borderColor: cur && cur.id === m.id ? "var(--acc)" : null, borderWidth: cur && cur.id === m.id ? "2.4px" : null } },
      el("b", { style: { display: "block", fontSize: ".9rem", lineHeight: "1.3" } }, m.question), el("small", { class: "muted" }, m.title)));
    }
  }
  const savedBox = el("div", { style: { marginTop: "1.2rem" } });
  const drawSaved = () => {
    clear(savedBox);
    const rows = physicsSummary(store.project);
    savedBox.append(el("h2", null, "Calculs ajoutés au rapport"));
    if (!rows.length) { savedBox.append(el("p", { class: "muted" }, "Aucun calcul enregistré. Le bouton « Ajouter au rapport » garde un calcul, avec ses données et son verdict, dans le projet.")); return; }
    savedBox.append(table(["Calcul", "Pièce", "Verdict", "Résultat principal", "Marge la plus faible", "Date", ""], rows.map((r) => [
      el("a", { href: `#/physics/${r.model}${r.part ? "/" + encodeURIComponent(r.part) : ""}` }, r.title), r.part ? `${r.part}${r.partName ? " — " + r.partName : ""}` : "—", verdictBadge(r.verdict), r.result,
      el("small", null, r.worst || "—"), el("small", { class: "muted" }, r.when ? new Date(r.when).toLocaleDateString("fr-CA") : ""),
      el("span", { class: "nowrap" }, btn("Rouvrir", () => { const s = (store.project.physics || []).find((x) => x.id === r.id); if (s) { memory.set(s.model, { ...defaults(s.model), ...s.inputs }); prefillNotes.delete(s.model); go(`#/physics/${s.model}${s.part ? "/" + encodeURIComponent(s.part) : ""}`); } }, { small: true, tip: "Reprendre les données de ce calcul" }), " ",
        btn("", () => store.commit("Physique : calcul retiré du rapport", (p) => { p.physics = (p.physics || []).filter((x) => x.id !== r.id); }), { small: true, danger: true, icon: "trash", tip: "Retirer ce calcul du rapport" }))])));
  };
  const off = store.on("change", drawSaved);
  drawSaved();
  if (!cur) {
    right.append(el("div", { class: "card" }, el("h2", null, "Choisissez une question"), el("p", null, "Chaque carte de gauche est une question de conception. Choisissez-en une : saisissez les dimensions ou reprenez celles d'une pièce du projet, et le verdict se met à jour à chaque frappe."),
      el("p", { class: "muted" }, `${MODELS.length} modèles : ${DOMAINS.map((d) => `${d.label.toLowerCase()} (${MODELS.filter((m) => m.domain === d.id).length})`).join(", ")}.`)), savedBox);
    return off;
  }
  let alive = true;
  if (!memory.has(cur.id)) memory.set(cur.id, defaults(cur.id));
  const inputs = memory.get(cur.id);
  const formBox = el("div", { class: "card" }), resultBox = el("div", { class: "card" }), detailBox = el("div", { class: "two-col", style: { marginTop: "1rem" } });
  right.append(el("div", { class: "card", style: { display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1rem" } },
    el("div", { style: { flex: "1 1 280px" } }, badge((DOMAINS.find((d) => d.id === cur.domain) || {}).label || cur.domain, "info"), el("h2", { style: { margin: ".35rem 0 .2rem", fontSize: "1.25rem" } }, cur.question), el("p", { class: "muted", style: { margin: 0 } }, cur.title)), sketch(cur)),
  el("div", { class: "two-col" }, formBox, resultBox), detailBox, savedBox);

  /* results: verdict, KPIs, warnings, checks — then the calculation, the assumptions and the reference */
  function update() {
    const r = run(cur.id, inputs);
    clear(resultBox); clear(detailBox);
    resultBox.append(el("div", { style: { display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".7rem" } }, el("h2", { style: { margin: 0 } }, "Verdict"), verdictBadge(r.verdict),
      el("span", { class: "muted", style: { fontSize: ".84rem" } }, r.verdict === "ok" ? "Toutes les vérifications passent, dans le domaine de validité." : r.verdict === "warn" ? "Marge faible ou limite de validité : à regarder de près." : "Au moins une limite est dépassée.")));
    resultBox.append(el("div", { class: "kpis" }, cur.outputs.slice(0, 4).map((o) => el("div", { class: "kpi" }, el("b", null, show(r.values[o.key]), o.unit ? el("small", { style: { fontSize: ".6em", fontWeight: 500 } }, " " + o.unit) : null), el("span", null, o.label)))));
    for (const w of r.warnings) resultBox.append(el("div", { class: "finding warn" }, el("span", { class: "sev" }), el("div", null, el("b", null, "Limite de validité")), el("p", null, w)));
    if (r.checks.length) resultBox.append(table(["Vérification", "Valeur", "Limite", "Marge", "État"], r.checks.map((c) => [el("div", null, c.label, c.note ? el("small", { class: "muted", style: { display: "block" } }, c.note) : null), `${show(c.value)} ${c.unit}`, `${show(c.limit)} ${c.unit}`,
      el("b", null, c.margin >= 999 ? "> 999" : show(c.margin)), c.ok ? (c.tight ? badge("juste", "warn") : badge("OK", "ok")) : c.soft ? badge("à vérifier", "warn") : badge("NON", "danger")])));
    else resultBox.append(el("p", { class: "muted" }, "Aucun critère à vérifier avec ces données : le calcul donne les valeurs ci-dessus."));
    if (cur.outputs.length > 4) resultBox.append(el("h3", { style: { marginTop: ".9rem" } }, "Autres résultats"), table(["Grandeur", "Valeur"], cur.outputs.slice(4).map((o) => [o.label, `${show(r.values[o.key])} ${o.unit}`])));
    resultBox.append(el("div", { class: "form-actions" }, btn("Ajouter au rapport", () => {
      const entry = { id: `phy-${Date.now().toString(36)}`, model: cur.id, part: partId || null, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: new Date().toISOString() };
      store.commit(`Physique : ${cur.title}`, (p) => { p.physics = p.physics || []; p.physics.push(entry); });
      toast("Calcul ajouté au rapport du projet.", "success");
    }, { primary: true, icon: "plus", tip: "Garde ce calcul (données, résultats, verdict) dans le projet, pour le rapport de revue de conception" })));
    detailBox.append(el("div", { class: "card" }, el("h2", null, "Calcul"), el("ol", { style: { margin: 0, paddingLeft: "1.3rem", fontSize: ".9rem", lineHeight: "1.55" } }, r.steps.map((s) => el("li", { style: { marginBottom: ".35rem" } }, s)))),
      el("div", { class: "card" }, el("h2", null, "Hypothèses"), el("ul", { style: { margin: "0 0 .8rem", paddingLeft: "1.2rem", fontSize: ".9rem" } }, cur.assumptions.map((a) => el("li", null, a))),
        el("h3", null, "Domaine de validité"), el("p", { style: { fontSize: ".9rem" } }, cur.validity), el("h3", null, "Référence"), el("p", { class: "muted", style: { fontSize: ".9rem", margin: 0 } }, cur.reference)));
  }

  /* form: part picker and prefill, then the inputs by group */
  function drawForm() {
    clear(formBox);
    const notes = prefillNotes.get(cur.id) || {}, rows = new Map();
    const pick = el("select", { "aria-label": "Pièce du projet", onChange: (e) => go(`#/physics/${cur.id}${e.target.value ? "/" + encodeURIComponent(e.target.value) : ""}`) },
      el("option", { value: "" }, "— aucune pièce —"), store.parts.map((p) => el("option", { value: p.id, selected: p.id === partId }, `${p.id} — ${p.name || ""}`)));
    const take = btn("Reprendre les dimensions de la pièce", async (e, b) => {
      const spec = store.part(partId);
      if (!spec) return;
      let built = null;
      b.disabled = true; setStatus("Construction de la pièce…", "busy");
      try { built = await kernel.build(spec); } catch (err) { toast(`La pièce n'a pas pu être construite (${err.message}) : seules les propriétés du matériau sont reprises.`, "error"); }
      setStatus("Prêt");
      if (!alive) return;
      const pf = prefill(cur.id, { spec, built });
      Object.assign(inputs, pf.inputs); prefillNotes.set(cur.id, pf.notes);
      toast(Object.keys(pf.inputs).length ? `${Object.keys(pf.inputs).length} valeur(s) reprise(s) de ${spec.id} : vérifiez-les, l'enveloppe n'est pas toujours la section utile.` : "Ce modèle ne reprend aucune valeur de cette pièce.", Object.keys(pf.inputs).length ? "success" : "info");
      drawForm(); update();
    }, { icon: "ruler", disabled: !partId, tip: "Longueur, section, épaisseur et propriétés du matériau lues sur la pièce choisie" });
    formBox.append(el("h2", null, "Données"), el("div", { class: "form-row" }, field("Pièce du projet (facultatif)", pick, store.parts.length ? null : "Aucune pièce dans le projet : saisissez les données à la main."), el("div", { style: { marginBottom: ".75rem" } }, take)));
    const used = Object.keys(notes);
    if (used.length) formBox.append(el("p", { class: "muted", style: { fontSize: ".84rem", marginTop: 0 } }, `Repris de la pièce : ${used.map((k) => (cur.inputs.find((d) => d.key === k) || { label: k }).label).join(", ")}. L'origine de chaque valeur est écrite sous son champ.`));
    const sync = () => { for (const d of cur.inputs) rows.get(d.key).style.display = inputActive(d, inputs) ? "" : "none"; };
    let group = null, row = null;
    for (const d of cur.inputs) {
      if (d.group !== group) { group = d.group; row = el("div", { class: "form-row" }); formBox.append(el("h3", { style: { marginTop: ".5rem" } }, group || "Données"), row); }
      let input;
      if (d.options) input = el("select", { onChange: (e) => { inputs[d.key] = e.target.value; sync(); update(); } }, d.options.map((o) => el("option", { value: o.value, selected: o.value === String(inputs[d.key]) }, o.label)));
      else {
        input = el("input", { type: "number", inputmode: "decimal", value: inputs[d.key] === null || inputs[d.key] === undefined ? "" : String(inputs[d.key]), min: String(d.min), max: String(d.max), step: String(d.step || "any"), class: notes[d.key] ? "flash" : null });
        input.addEventListener("input", () => {
          const v = input.value === "" ? null : Number(input.value);
          inputs[d.key] = v;
          input.classList.toggle("bad", v === null || !Number.isFinite(v) || v < d.min || v > d.max);
          update();
        });
      }
      const f = field(d.unit ? `${d.label} (${d.unit})` : d.label, input, notes[d.key] ? `↳ ${notes[d.key]}` : null);
      rows.set(d.key, f); row.append(f);
    }
    sync();
    formBox.append(el("div", { class: "form-actions" }, btn("Valeurs par défaut", () => { Object.assign(inputs, defaults(cur.id)); prefillNotes.delete(cur.id); drawForm(); update(); }, { small: true, icon: "refresh", tip: "Revenir aux valeurs d'exemple du modèle" })));
  }
  drawForm(); update();
  return () => { alive = false; off(); };
}

registerModule({ key: "physics", label: "Physique", icon: "physics", tip: "Modèles analytiques reconnus : poutre, flambement, vis, tube, dissipateur, busbar… avec verdict, marges et calcul détaillé", render });
