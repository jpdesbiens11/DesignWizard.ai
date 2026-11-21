/* DesignWizard.ai — DFx : the health of the whole project (DFM of every part, DFA of every assembly), and the printable
   rule book. The page opens on WHAT HAS TO BE SETTLED : the counts at the top are buttons — a click shows the points they
   count, each with what was measured, why the rule exists, and its fix in one click when there is one. What is in order
   is kept apart, behind its own count. Routes : #/dfx (the points to settle), #/dfx/points/<reference> (those of one part
   or assembly), #/dfx/regles (the rule book), #/dfx/regles/<rule> (one rule in the book). */

import { el, clear, icon, btn, badge, table, fmt, inUnits, toast, debounce } from "../core/dom.js";
import { busyVeil } from "../core/busy.js";
import { registerModule, setStatus } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { runDfx, runDfa, rulebook, applyFix } from "../analysis/dfx_api.js";
import { buildAssembly } from "../core/asm_scene.js";
import { PROCESSES, processName } from "../cad/materials.js";
import { nudge } from "../core/guide.js";
import { DFX_FILTERS, DFX_STATES, PROCESS_ICON, dfxItems, dfxCounts, dfxView, dfxHash, ruleOf, measureText, fixOutcome } from "../analysis/dfx_board.js";

/** DFM findings of every part and DFA findings of every assembly (used by this page and by the report). */
export async function projectDfx(onProgress) {
  const parts = [], asms = [], total = store.parts.length + store.assemblies.length; let n = 0;      // onProgress(text, done, total) ; an operation the user cancelled ends the analysis at once
  for (const spec of store.parts) {
    if (onProgress) onProgress(`DFM ${n + 1} / ${total} : ${spec.id}`, n, total); n++;
    try { const built = await kernel.build(spec); parts.push({ spec, built, res: await runDfx(spec, built) }); }
    catch (e) { if (e && e.cancelled) throw e; parts.push({ spec, built: null, res: { findings: [{ id: "KRN-01", severity: "error", title: "Construction impossible", message: e.message }], summary: { errors: 1, warnings: 0, infos: 0, score: 0 } } }); }
  }
  for (const a of store.assemblies) {
    if (onProgress) onProgress(`DFA ${n + 1} / ${total} : ${a.id}`, n, total); n++;
    try {
      const ctx = await buildAssembly(a);
      const res = await runDfa(ctx.asm, { parts: Object.fromEntries(Object.keys(ctx.built).map((k) => [k, { spec: store.part(k), built: ctx.built[k] }])), hardware: ctx.hardware, interference: null, placements: ctx.sol.placements });
      asms.push({ asm: a, ctx, res });
    } catch (e) { if (e && e.cancelled) throw e; asms.push({ asm: a, ctx: null, res: { findings: [], summary: null, metrics: {} }, error: e.message }); }
  }
  return { parts, asms };
}
const SEV = { error: ["à corriger", "danger"], warn: ["à vérifier", "warn"], info: ["conseil", "info"] };
const ui = { filter: "todo" };      // the filter is kept while the page is open

function render(main, args) {
  const tab = args[0] === "regles" ? "regles" : "bilan", only = args[0] === "points" && args[1] ? args[1] : null;
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "DFx"), el("p", { class: "muted" }, "Design for Manufacturing, Assembly et autres : chaque pièce est vérifiée contre les règles de son procédé dès qu'elle change, chaque assemblage contre les règles de montage."))),
    el("div", { class: "subtabs" }, el("a", { class: "subtab" + (tab === "bilan" ? " active" : ""), href: "#/dfx" }, "Points du projet"), el("a", { class: "subtab" + (tab === "regles" ? " active" : ""), href: "#/dfx/regles" }, "Livre des règles")));
  const box = el("div");
  page.append(box);
  let alive = true;
  if (tab === "regles") {
    rulebook().then((book) => {
      if (!alive) return;
      if (!book.length) { box.append(el("p", { class: "muted" }, "Le livre des règles n'est pas chargé dans cette version.")); return; }
      box.append(el("div", { class: "form-actions no-print" }, btn("Imprimer le livre des règles", () => window.print(), { icon: "pdf" })));
      for (const b of book) box.append(el("div", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, b.fr || b.title || b.process), b.steps && el("p", { class: "muted" }, `Étapes de conception : ${b.steps.join(" → ")}`),
        table(["Règle", "Titre", "Limite", "Niveau", "Pourquoi", "Source"], (b.rules || []).map((r) => [el("code", { id: `rule-${r.id}` }, r.id), r.title, inUnits(r.limit || ""), badge(SEV[r.severity === "error" || r.severity === "warn" ? r.severity : "info"][0], SEV[r.severity === "error" || r.severity === "warn" ? r.severity : "info"][1]), r.why || "", el("small", { class: "muted" }, r.source || "")]))));
      if (args[1]) setTimeout(() => { const at = document.getElementById(`rule-${args[1]}`); if (alive && at) nudge(at.closest("tr") || at); }, 80);
    });
    return () => { alive = false; };
  }
  const veil = busyVeil(page, "sheet-busy");      // what the analysis of the whole project is doing, and a button to cancel it
  if (only) ui.filter = "todo";
  const top = el("div", { class: "dfx-top" }), list = el("div", { class: "dfx-list" });
  box.append(top, list);
  list.append(el("p", { class: "muted" }, "Évaluation des pièces et des assemblages…"));
  let items = [], book = [], token = 0;

  function drawTop() {
    clear(top);
    const c = dfxCounts(items), tile = (key, n, label, tone, ico, tip) => el("button", { class: `kpi dfx-kpi ${tone}${ui.filter === key ? " on" : ""}`, type: "button", "data-filter": key, "aria-pressed": ui.filter === key ? "true" : "false", "data-tip": tip,
      onClick: () => { ui.filter = key; drawTop(); drawList(); nudge(list.querySelector(".dfx-item, .dfx-pass, .dfx-none")); } }, el("b", null, icon(ico), String(n)), el("span", null, label));
    top.append(el("div", { class: "kpis dfx-kpis" }, tile("todo", c.todo, "Points à régler", c.error ? "danger" : c.warn ? "warn" : "ok", "search", "Tout ce qui est à corriger ou à vérifier : un clic montre chaque point, avec son explication et son correctif"),
      tile("error", c.error, "À corriger", c.error ? "danger" : "none", "cross", "Les points qui empêchent de fabriquer ou de monter"), tile("warn", c.warn, "À vérifier", c.warn ? "warn" : "none", "warning", "Les points qui se fabriquent, mais coûtent ou surprennent"),
      tile("info", c.info, "Conseils", "info", "info", "Ce qui peut s'améliorer, sans obligation"), tile("pass", `${c.pass} / ${c.items}`, "Conformes", "ok", "check", "Les pièces et les assemblages sans point à corriger ni à vérifier"),
      el("div", { class: "kpi" }, el("b", null, c.score === null ? "—" : String(c.score)), el("span", null, "Score DFx moyen / 100"))),
    ...[only ? el("p", { class: "dfx-only" }, icon("search"), ` Seuls les points de ${only} sont montrés. `, el("a", { href: "#/dfx" }, "Voir tout le projet")) : null].filter(Boolean));
  }
  const head = (it) => { const st = DFX_STATES[it.state], m = it.metrics || {}, proc = it.kind === "part" ? processName(it.process) || "procédé non défini" : "assemblage";
    const metrics = Object.entries({ instances: "pièces", uniqueParts: "pièces uniques", fasteners: "fixations", fastenerTypes: "types de fixation", directions: "directions de montage", dfaIndex: "indice DFA" }).filter(([k]) => m[k] !== undefined).map(([k, l]) => `${typeof m[k] === "number" ? fmt(m[k], 1) : m[k]} ${l}`).join(" · ");
    return el("header", { class: "dfx-head" }, icon(it.kind === "assembly" ? "assembly" : PROCESS_ICON[it.process] || "part"), el("div", { class: "grow" }, el("b", null, `${it.ref}${it.name ? " — " + it.name : ""}`), el("small", null, [proc, it.score === null ? "" : `score ${it.score} / 100`, metrics].filter(Boolean).join(" · "))),
      ...[it.errors ? badge(`${it.errors} à corriger`, "danger") : null, it.warnings ? badge(`${it.warnings} à vérifier`, "warn") : null, it.state === "pass" ? badge(it.unavailable ? "moteur absent" : st.fr, it.unavailable ? "neutral" : "ok") : null].filter(Boolean),
      el("a", { class: "btn btn-small", href: dfxHash(it), "data-tip": it.kind === "assembly" ? "Ouvrir l'assemblage" : "Ouvrir la pièce sur son onglet DFx : le point s'y voit sur le modèle" }, icon("external"), el("span", null, "Ouvrir"))); };
  function point(it, f) {
    const r = ruleOf(book, f.id), measured = measureText(f, (v) => fmt(v, 3));
    const card = el("div", { class: `finding ${f.severity} dfx-point`, "data-rule": f.id }, el("span", { class: "sev" }), el("div", null, el("b", null, f.title), el("a", { class: "id", href: `#/dfx/regles/${encodeURIComponent(f.id)}`, "data-tip": "La règle, dans le livre des règles" }, f.id), " ", badge(SEV[f.severity][0], SEV[f.severity][1])), el("p", null, inUnits(f.message)),
      ...[measured ? el("p", { class: "dfx-measure" }, inUnits(measured)) : null, r && r.why ? el("p", { class: "dfx-why" }, el("b", null, "Pourquoi — "), inUnits(r.why), r.source ? el("small", { class: "muted" }, ` (${r.source})`) : null) : null].filter(Boolean));
    if (it.kind === "part" && f.fix && f.fix.patch) card.append(btn(inUnits(f.fix.label) || "Appliquer le correctif", (e, b) => tryFix(it, f, card, b), { small: true, primary: true, icon: "sparkle", cls: "fix", tip: "Essaie le correctif, puis l'applique ici même s'il ne crée rien à corriger (annulable avec Ctrl+Z)" }));
    return card;
  }
  /* a fix is tried before it is applied : one that would create a point to fix is held back, and says why */
  async function tryFix(it, f, card, b) {
    const label = `Correctif ${f.id} : ${f.fix.label || ""}`, apply = () => { try { store.updatePart(it.ref, (x) => applyFix(x, f.fix.patch), label); toast(`Correctif appliqué à ${it.ref} : ${f.fix.label || f.id} (Ctrl+Z pour annuler)`, "success"); } catch (err) { toast(err.message, "error"); } };
    b.disabled = true; setStatus("Essai du correctif…", "busy");
    let out = null, why = "";
    try { const next = applyFix(store.part(it.ref), f.fix.patch), built = await kernel.build(next), broken = built.log.filter((l) => l.level === "error");
      if (broken.length || !built.bodies.length) why = `la pièce ne se construirait plus (${broken.map((l) => l.msg).join(" · ") || "aucun corps"})`; else out = fixOutcome(it.points, (await runDfx(next, built)).findings, f);
    } catch (err) { why = `la pièce ne se construirait plus (${err.message})`; }
    setStatus("Prêt"); if (!alive || !card.isConnected) return;
    if (out && out.ok) { apply(); return; }
    b.disabled = false; card.querySelectorAll(".dfx-held").forEach((x) => x.remove());
    card.append(el("div", { class: "dfx-held" }, el("p", null, el("b", null, "Correctif retenu — "), why ? `${why}.` : `il créerait ${out.added.length} point${out.added.length > 1 ? "s" : ""} à corriger : ${out.added.slice(0, 2).map((x) => `${x.id} ${x.title} — ${x.message}`).join(" · ")}`),
      el("div", { class: "form-actions" }, el("a", { class: "btn btn-small", href: dfxHash(it) }, icon("external"), el("span", null, "Le régler dans la pièce")), ...[why ? null : btn("Appliquer quand même", apply, { small: true, tip: "Applique le correctif malgré ce qu'il crée (annulable avec Ctrl+Z)" })].filter(Boolean))));
    nudge(card.querySelector(".dfx-held"));
  }
  function drawList() {
    clear(list);
    const view = dfxView(items, ui.filter, only), title = (DFX_FILTERS.find(([k]) => k === ui.filter) || DFX_FILTERS[0])[1];
    if (ui.filter === "pass") {
      list.append(el("h2", null, `Conformes (${view.length})`), view.length ? el("div", { class: "dfx-passes" }, view.map((it) => el("a", { class: "dfx-pass", href: dfxHash(it), "data-tip": `${processName(it.process) || (it.kind === "assembly" ? "assemblage" : "")}${it.infos ? ` · ${it.infos} conseil${it.infos > 1 ? "s" : ""}` : ""}` }, icon("check"), el("b", null, it.ref), el("span", null, it.name), it.score === null ? null : el("small", null, String(it.score)))))
        : el("p", { class: "dfx-none muted" }, "Rien n'est encore conforme : les points à régler sont sous « Points à régler »."));
      return;
    }
    list.append(el("h2", null, ui.filter === "todo" ? "Points à régler" : title));
    if (!view.length || view.every((it) => !it.points.length && ui.filter !== "all")) { list.append(el("p", { class: "dfx-none" }, icon("check"), ui.filter !== "todo" ? ` Aucun point « ${title.toLowerCase()} »${only ? ` sur ${only}` : ""}.` : only ? ` Rien à régler sur ${only} : les règles évaluées sont respectées.` : " Rien à régler : les pièces et les assemblages respectent les règles évaluées.")); return; }
    for (const it of view) list.append(el("section", { class: `dfx-item ${it.state}`, "data-item": it.key }, head(it), it.points.length ? it.points.map((f) => point(it, f)) : el("p", { class: "muted small" }, "Aucune remarque : les règles évaluées sont respectées.")));
  }
  async function refresh() {
    const mine = ++token, y = window.scrollY, first = !items.length;      // the first analysis of a project is the long one : it shows its veil ; the next ones update the page quietly
    const stop = () => { token++; kernel.cancel(); setStatus("Bilan DFx annulé", ""); veil.set("Bilan annulé : les points du projet ne sont pas affichés.", { stopped: true, retry: refresh }); };
    if (first) veil.set("Analyse du projet…", { cancel: stop });
    let run, rules;
    try { [run, rules] = await Promise.all([projectDfx((t, done, total) => { setStatus(t, "busy"); if (first && mine === token) veil.set(t, { done, total, cancel: stop }); }), rulebook()]); }
    catch (e) { if (e && e.cancelled) return; if (mine === token) veil.set(""); throw e; }
    if (!alive || mine !== token) return;
    veil.set("");
    items = dfxItems(run); book = rules; setStatus("Points DFx à jour", "done");
    drawTop(); drawList(); window.scrollTo(0, y);
    if (only) setTimeout(() => { if (alive) nudge(list.querySelector(".dfx-item")); }, 60);
  }
  const off = store.on("change", debounce(() => { if (alive) refresh(); }, 350));
  refresh();
  return () => { alive = false; off(); veil.dispose(); };
}

registerModule({ key: "dfx", label: "DFx", icon: "dfx", tip: "Les points DFM / DFA à régler dans le projet, et le livre des règles", render });
