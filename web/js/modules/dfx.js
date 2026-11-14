/* DesignWizard.ai — DFx: the health of the whole project at a glance (DFM of every part, DFA of every assembly),
   and the printable rule book. The checks themselves run live in the studios; this page gathers them. */

import { el, clear, icon, btn, badge, table, fmt } from "../core/dom.js";
import { registerModule, setStatus } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { runDfx, runDfa, rulebook } from "../analysis/dfx_api.js";
import { buildAssembly } from "../core/asm_scene.js";
import { PROCESSES } from "../cad/materials.js";

/** DFM findings of every part and DFA findings of every assembly (used by this page and by the report). */
export async function projectDfx(onProgress) {
  const parts = [], asms = [];
  for (const spec of store.parts) {
    if (onProgress) onProgress(`DFM : ${spec.id}`);
    try { const built = await kernel.build(spec); parts.push({ spec, built, res: await runDfx(spec, built) }); }
    catch (e) { parts.push({ spec, built: null, res: { findings: [{ id: "KRN-01", severity: "error", title: "Construction impossible", message: e.message }], summary: { errors: 1, warnings: 0, infos: 0, score: 0 } } }); }
  }
  for (const a of store.assemblies) {
    if (onProgress) onProgress(`DFA : ${a.id}`);
    try {
      const ctx = await buildAssembly(a);
      const res = await runDfa(ctx.asm, { parts: Object.fromEntries(Object.keys(ctx.built).map((k) => [k, { spec: store.part(k), built: ctx.built[k] }])), hardware: ctx.hardware, interference: null, placements: ctx.sol.placements });
      asms.push({ asm: a, ctx, res });
    } catch (e) { asms.push({ asm: a, ctx: null, res: { findings: [], summary: null, metrics: {} }, error: e.message }); }
  }
  return { parts, asms };
}
const sevBadge = (s) => (s && s.errors ? badge(`${s.errors} à corriger`, "danger") : s && s.warnings ? badge(`${s.warnings} à vérifier`, "warn") : badge("conforme", "ok"));

function render(main, args) {
  const tab = args[0] === "regles" ? "regles" : "bilan";
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "DFx"), el("p", { class: "muted" }, "Design for Manufacturing, Assembly et autres : chaque pièce est vérifiée contre les règles de son procédé dès qu'elle change, chaque assemblage contre les règles de montage. Les correctifs en un clic sont dans le Part Studio (onglet DFx)."))),
    el("div", { class: "subtabs" }, el("a", { class: "subtab" + (tab === "bilan" ? " active" : ""), href: "#/dfx" }, "Bilan du projet"), el("a", { class: "subtab" + (tab === "regles" ? " active" : ""), href: "#/dfx/regles" }, "Livre des règles")));
  const box = el("div");
  page.append(box);
  let alive = true;
  if (tab === "regles") {
    rulebook().then((book) => {
      if (!alive) return;
      if (!book.length) { box.append(el("p", { class: "muted" }, "Le livre des règles n'est pas chargé dans cette version.")); return; }
      box.append(el("div", { class: "form-actions no-print" }, btn("Imprimer le livre des règles", () => window.print(), { icon: "pdf" })));
      for (const b of book) box.append(el("div", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, b.fr || b.title || b.process), b.steps && el("p", { class: "muted" }, `Étapes de conception : ${b.steps.join(" → ")}`),
        table(["Règle", "Titre", "Limite", "Niveau", "Pourquoi", "Source"], (b.rules || []).map((r) => [el("code", null, r.id), r.title, r.limit || "", badge(r.severity === "error" ? "à corriger" : r.severity === "warn" ? "à vérifier" : "conseil", r.severity === "error" ? "danger" : r.severity === "warn" ? "warn" : "info"), r.why || "", el("small", { class: "muted" }, r.source || "")]))));
    });
    return () => { alive = false; };
  }
  box.append(el("p", { class: "muted" }, "Évaluation des pièces et des assemblages…"));
  projectDfx((t) => setStatus(t, "busy")).then(({ parts, asms }) => {
    if (!alive) return;
    clear(box); setStatus("Bilan DFx à jour", "done");
    const tot = parts.reduce((a, p) => ({ e: a.e + ((p.res.summary || {}).errors || 0), w: a.w + ((p.res.summary || {}).warnings || 0) }), { e: 0, w: 0 });
    const scores = parts.map((p) => (p.res.summary || {}).score).filter((x) => typeof x === "number");
    box.append(el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, String(parts.length)), el("span", null, "Pièces vérifiées")), el("div", { class: "kpi" }, el("b", null, String(tot.e)), el("span", null, "Points à corriger")), el("div", { class: "kpi" }, el("b", null, String(tot.w)), el("span", null, "Points à vérifier")),
      el("div", { class: "kpi" }, el("b", null, scores.length ? fmt(scores.reduce((a, b) => a + b, 0) / scores.length, 0) : "—"), el("span", null, "Score DFx moyen / 100"))));
    box.append(el("h2", null, "Pièces — DFM"), table(["Pièce", "Procédé", "Score", "État", "Principales remarques"], parts.map((p) => [el("a", { href: `#/${p.spec.family === "pcb" ? "pcb" : p.spec.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(p.spec.id)}` }, `${p.spec.id} — ${p.spec.name || ""}`),
      (PROCESSES[p.spec.process] || {}).fr || "—", p.res.summary && typeof p.res.summary.score === "number" ? String(p.res.summary.score) : "—", p.res.unavailable ? badge("moteur absent", "neutral") : sevBadge(p.res.summary),
      el("span", { style: { fontSize: ".82rem" } }, p.res.findings.filter((f) => f.severity !== "info").slice(0, 3).map((f) => `${f.id} ${f.title}`).join(" · ") || "—")])));
    box.append(el("h2", { style: { marginTop: "1.2rem" } }, "Assemblages — DFA"));
    for (const a of asms) {
      const m = a.res.metrics || {};
      box.append(el("div", { class: "card", style: { marginBottom: ".8rem" } }, el("h3", null, el("a", { href: `#/assembly/${encodeURIComponent(a.asm.id)}` }, `${a.asm.id} — ${a.asm.name || ""}`), " ", a.error ? badge("erreur", "danger") : sevBadge(a.res.summary)),
        a.error && el("p", { class: "form-error" }, a.error), Object.keys(m).length ? el("p", { class: "muted", style: { fontSize: ".86rem" } }, Object.entries({ instances: "pièces", uniqueParts: "pièces uniques", fasteners: "fixations", fastenerTypes: "types de fixation", directions: "directions de montage", dfaIndex: "indice DFA" }).filter(([k]) => m[k] !== undefined).map(([k, l]) => `${typeof m[k] === "number" ? fmt(m[k], 1) : m[k]} ${l}`).join(" · ")) : null,
        a.res.findings.map((f) => el("div", { class: `finding ${f.severity}` }, el("span", { class: "sev" }), el("div", null, el("b", null, f.title), el("span", { class: "id" }, f.id)), el("p", null, f.message)))));
    }
    if (!asms.length) box.append(el("p", { class: "muted" }, "Aucun assemblage."));
  });
  return () => { alive = false; };
}

registerModule({ key: "dfx", label: "DFx", icon: "dfx", tip: "Bilan DFM / DFA du projet et livre des règles", render });
