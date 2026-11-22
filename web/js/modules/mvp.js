/* DesignOrbit.ai — Itérations MVP : how a product converges, iteration after iteration, toward the maturity it aims at.
   Each MVP is frozen, reviewed — by a detailed package handed to an AI, or in front of colleagues — and closed with a
   decision before the next one opens. Between two frozen iterations the platform says what moved : shapes, dimensions,
   functions, interfaces. Route : #/mvp (reached from the Review screen and the project menu). */

import { el, btn, badge, toast, icon, modal, field, table, copyText, confirmBox } from "../core/dom.js";
import { registerModule } from "../core/app.js";
import { store } from "../core/store.js";
import { toDwiz } from "../core/dwiz.js";
import { mvpOf, canOpen, openIteration, freeze, thaw, trend, criteria, recordReview, toggleAction, closeIteration, iterationState, stateLabel, trlReached, reviewPackage, readReviewAnswer, applyReview, agenda,
  TRL, GATES, DECISIONS, REVIEW_MODES, TREND_FR } from "../core/mvp.js";
import { trlFocus } from "../core/trl.js";
import { trlScale, trlReferences } from "./mvp_trl.js";

const pct = (x) => `${Math.round(x * 100)} %`, day = (s) => String(s || "").slice(0, 10);
const STATE_TONE = { open: "info", frozen: "warn", reviewed: "warn", closed: "ok" };
/** The design alone, as text : the ledgers stay here, the package carries the facts the platform computed from them. */
const designText = (p) => { const d = JSON.parse(JSON.stringify(p)); delete d.review; delete d.mvp; delete d.log; delete d.history; return toDwiz(d); };
const act = (label, fn) => { try { store.commit(label, fn); return true; } catch (e) { toast(e.message, "error", 6000); return false; } };

function pasteAnswer(n) {
  const area = el("textarea", { rows: 10, placeholder: "Collez ici la réponse de l'assistant : elle contient un bloc ```revue, une ligne par constat." }), out = el("div");
  let parsed = null;
  const apply = btn("Consigner cette revue", () => { if (!parsed) return; if (act(`Revue IA consignée sur MVP ${n}`, (x) => { const r = applyReview(x, n, parsed); toast(`Revue ${r.review.id} consignée : ${r.actions} action(s), ${r.asked} artéfact(s) passés « À réviser ».`, "success", 6000); })) m.close(); }, { primary: true, icon: "check", disabled: true });
  const read = () => {
    parsed = readReviewAnswer(area.value); out.replaceChildren(); apply.disabled = !parsed.findings.length && !parsed.decision;
    if (!area.value.trim()) return;
    for (const t of parsed.problems) out.append(el("p", { class: "form-error" }, t));
    if (parsed.decision) out.append(el("p", null, "Décision proposée : ", badge(DECISIONS[parsed.decision].fr, DECISIONS[parsed.decision].tone), parsed.why ? ` — ${parsed.why}` : ""));
    if (parsed.findings.length) out.append(table(["Artéfact", "Gravité", "Constat", "Action proposée"], parsed.findings.map((f) => [f.target, badge(f.severity, f.severity === "bloquant" ? "danger" : f.severity === "majeur" ? "warn" : "neutral"), f.text, f.action || "—"])),
      el("p", { class: "muted small" }, "En consignant : les constats bloquants et majeurs deviennent des actions de l'itération, et les artéfacts qu'ils nomment passent « À réviser » avec leur note. Une seule étape, annulable."));
  };
  area.addEventListener("input", read);
  const m = modal(`Réponse de la revue IA — MVP ${n}`, [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), apply)], { wide: true });
}
function humanReview(n, it) {
  const who = el("input", { type: "text", placeholder: "Ex. : 6 personnes — mécanique, électronique, essais, qualité (des rôles, pas de noms)" }), notes = el("textarea", { rows: 4, placeholder: "Ce qui a été dit, ce qui a été décidé." });
  const acts = el("textarea", { rows: 4, placeholder: "Une action par ligne, avec son porteur : « Refaire le calcul thermique du busbar — électronique »" });
  const dec = el("select", null, Object.entries(DECISIONS).map(([k, d]) => el("option", { value: k, selected: k === "conditional" }, d.fr)));
  const m = modal(`${GATES[it.gate]} devant les collègues — ${it.name}`, [field("Qui était là", who), field("Décision", dec), field("Compte rendu", notes), field("Actions", acts),
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("Consigner la revue", () => { if (act(`Revue consignée sur ${it.name}`, (x) => recordReview(x, n, { kind: "humans", who: who.value, decision: dec.value, notes: notes.value, actions: acts.value.split("\n").map((t) => t.trim()).filter(Boolean) }))) m.close(); }, { primary: true, icon: "check" }))], { wide: true });
}

function card(p, it, T) {
  const s = iterationState(it), n = it.n, crit = criteria(p, n), t = T.get(n), closed = s === "closed", snap = it.snapshot;
  const edit = (key, node) => { node.addEventListener("change", () => act(`${it.name} : ${key}`, (x) => { const q = mvpOf(x).iterations.find((k) => k.n === n); q[key] = key === "trl" ? Number(node.value) : node.value; })); return node; };
  const head = el("h2", null, `${it.name} `, badge(stateLabel(it), STATE_TONE[s]), " ", el("small", { class: "muted" }, `TRL ${it.trl} — ${TRL[it.trl][0]} · ${GATES[it.gate]}`), closed ? el("span", null, " ", badge(DECISIONS[it.decision].fr, DECISIONS[it.decision].tone)) : null);
  const sec = el("section", { class: "card taped", "data-mvp": n }, head);
  if (closed) sec.append(el("p", null, it.goal || "—"));
  else sec.append(el("div", { class: "form-row" }, field("Ce que cette itération doit montrer", edit("goal", el("input", { type: "text", value: it.goal || "", placeholder: "Ex. : le module se monte, tient ses 48 V et se fabrique en tôle" }))),
    field("Niveau visé", edit("trl", el("select", { disabled: s !== "open" }, Object.keys(TRL).map((k) => el("option", { value: k, selected: Number(k) === it.trl }, `TRL ${k} — ${TRL[k][0]}`))))),
    field("Revue de passage", edit("gate", el("select", { disabled: s !== "open" }, Object.entries(GATES).map(([k, l]) => el("option", { value: k, selected: k === it.gate }, l)))))));
  if (snap) { const m = snap.metrics; sec.append(el("div", { class: "atelier-chips" }, [`gelée le ${day(it.frozen)}`, `${m.parts} pièce(s) · ${m.assemblies} assemblage(s) · ${m.boards} carte(s)`, `${m.joints} joint(s)`, `${m.paired} interface(s) appariée(s), ${m.alone} seule(s), ${m.external} externe(s)`, `${m.functions} fonction(s)`].map((x) => el("span", { class: "chip" }, x)))); }
  if (t) { const c = t.c, row = (name, a, extra) => [name, String(a.added), String(a.removed), String(a.changed), pct(a.churn), extra || ""];
    sec.append(el("h3", null, `Ce qui a bougé depuis MVP ${t.from}`), table(["", "Ajouté", "Retiré", "Modifié", "Part qui a bougé", ""], [row("Formes — pièces, assemblages, cartes, analyses", c.shapes), ["Dimensions — cotes des pièces communes", "—", "—", `${c.dims.changed} / ${c.dims.total}`, pct(c.dims.churn), c.dims.changed ? `${pct(c.dims.mean)} d'écart moyen` : ""], row("Fonctions", c.functions), row("Interfaces", c.interfaces)]),
      el("p", { class: `atelier-hint${t.verdict === "diverge" ? " warn" : ""}` }, icon(t.verdict === "diverge" ? "warning" : "check"), ` ${TREND_FR[t.verdict]} (${pct(c.churn)} en tout).`)); }
  sec.append(el("h3", null, "Avant de clore"), el("ul", { class: "decisions" }, crit.map((c) => el("li", { style: { color: c.ok ? null : c.blocking ? "var(--danger, #c0392b)" : null } }, c.ok ? "✓ " : "○ ", c.text, el("small", { class: "muted" }, ` — ${c.value}${c.blocking && !c.ok ? " (obligatoire)" : ""}`)))));
  for (const r of it.reviews || []) sec.append(el("div", { class: "card", style: { padding: ".55rem .7rem", marginBottom: ".5rem" } },
    el("div", { style: { display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, r.id), badge(REVIEW_MODES[r.kind], r.kind === "ai" ? "info" : "neutral"), badge(DECISIONS[r.decision].fr, DECISIONS[r.decision].tone), el("small", { class: "muted" }, `${day(r.when)}${r.who ? ` · ${r.who}` : ""}`)),
    r.notes ? el("p", { class: "small", style: { whiteSpace: "pre-wrap", margin: ".3rem 0" } }, r.notes) : null,
    r.actions.length ? el("div", null, r.actions.map((a, i) => el("label", { class: "check small", style: { display: "flex" } }, el("input", { type: "checkbox", checked: a.done, onChange: () => act(`${it.name} : action ${a.done ? "rouverte" : "close"}`, (x) => toggleAction(x, n, r.id, i)) }), el("span", { style: a.done ? { textDecoration: "line-through" } : null }, a.text)))) : null));
  const actions = el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } });
  if (s === "open") actions.append(btn("Geler et soumettre à la revue", () => act(`${it.name} gelée`, (x) => freeze(x, n)), { primary: true, icon: "lock", tip: "Prend un instantané de chaque artéfact, des cotes, des fonctions et des interfaces : la revue porte sur cet état, et l'itération suivante s'y comparera" }));
  if (s === "frozen" || s === "reviewed") actions.append(
    btn("Copier le dossier de revue pour une IA", async () => toast((await copyText(reviewPackage(store.project, n, { dwiz: designText(store.project) }))) ? "Dossier copié : collez-le dans l'assistant de votre choix, puis collez ici sa réponse." : "Copie impossible.", "success", 6000), { icon: "sparkle", primary: s === "frozen", tip: "Le design entier en texte, les faits calculés par la plateforme, les questions du niveau visé et la forme de la réponse attendue" }),
    btn("Coller la réponse de l'IA…", () => pasteAnswer(n), { icon: "wizard", tip: "Aperçu des constats, puis une seule étape annulable : la revue, ses actions, et les artéfacts à réviser" }),
    btn("Ordre du jour", async () => toast((await copyText(agenda(store.project, n))) ? "Ordre du jour copié : ce que l'itération contient et ce que la revue doit trancher." : "Copie impossible.", "success", 5000), { icon: "copy", tip: "Pour une revue devant les collègues : court, à lire à voix haute" }),
    btn("Consigner une revue devant les collègues…", () => humanReview(n, it), { icon: "check" }));
  if (s === "frozen") actions.append(btn("Dégeler", () => act(`${it.name} dégelée`, (x) => { thaw(x, n); }), { icon: "refresh", tip: "Tant qu'aucune revue n'est consignée, l'itération peut retourner au travail" }));
  if (s === "reviewed") actions.append(el("span", { class: "muted small", style: { width: "100%" } }, "Clore l'itération :"), ...Object.entries(DECISIONS).map(([k, d]) => btn(d.fr, async () => { if (await confirmBox(`Clore ${it.name}`, `Décision : ${d.fr.toLowerCase()}. ${k === "redo" ? "Le MVP suivant visera le même niveau." : `Le produit atteint TRL ${it.trl}.`}`, "Clore")) act(`${it.name} close : ${d.fr.toLowerCase()}`, (x) => closeIteration(x, n, k)); }, { primary: k === "go", danger: k === "redo", icon: k === "redo" ? "refresh" : "check" })));
  sec.append(actions);
  return sec;
}

function render(main) {
  const page = el("div", { class: "page" }), body = el("div");
  main.append(page); page.append(body);
  let picked = null;   // the level the reader opened (null : the one the project is working on)
  function draw() {
    const p = store.project, m = (p.mvp && p.mvp.iterations) || [], target = (p.mvp && p.mvp.target) || 6, reached = trlReached(p), open = canOpen(p), T = new Map(trend(p).map((t) => [t.n, t])), live = m.at(-1);
    const head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Itérations MVP"),
      el("p", { class: "muted" }, "Le produit converge par itérations. Chaque MVP est gelé, passé en revue — par un dossier détaillé confié à une IA, ou devant les collègues — et clos par une décision avant que le suivant s'ouvre. Entre deux itérations, la plateforme mesure ce qui a bougé.")),
      el("div", { class: "subtabs", style: { width: "100%" } }, el("a", { class: "subtab", href: "#/review" }, "Artéfacts"), el("a", { class: "subtab active", href: "#/mvp" }, "Itérations MVP"), el("a", { class: "subtab", href: "#/team" }, "Équipe"), el("a", { class: "subtab", href: "#/plm" }, "Révisions")));
    const liveTrl = live && !live.closed ? live.trl : 0, sel = picked || trlFocus({ live: liveTrl, reached, target });
    const ladder = trlScale({ sel, reached, target, live: liveTrl, pick: (k) => { picked = k; draw(); } });
    const sum = el("section", { class: "card taped" }, el("h2", null, reached ? `TRL ${reached} atteint — ${TRL[reached][0]}` : "Aucun niveau atteint encore"),
      el("p", { class: "muted small" }, "L'échelle des niveaux de maturité, telle que la NASA et la Commission européenne l'ont écrite. Cliquez un niveau : sa définition officielle, ce qu'il faut montrer, et deux exemples."), ...ladder,
      el("div", { class: "form-row" }, field("Niveau visé par le projet", el("select", { onChange: (e) => act(`Cible du projet : TRL ${e.target.value}`, (x) => { mvpOf(x).target = Number(e.target.value); }) }, Object.keys(TRL).map((k) => el("option", { value: k, selected: Number(k) === target }, `TRL ${k} — ${TRL[k][0]}`))), "Il n'y a pas de nombre fixe d'itérations : autant qu'il en faut pour atteindre ce niveau, chacune avec sa revue."),
        el("div", { class: "form-actions", style: { alignItems: "flex-end" } }, btn(m.length ? "Ouvrir le MVP suivant" : "Ouvrir le premier MVP", () => act("Nouvelle itération MVP", (x) => openIteration(x)), { primary: open.ok, icon: "plus", disabled: !open.ok, tip: open.ok ? "Une nouvelle itération, un niveau plus haut que la précédente" : open.why }))),
      open.ok ? null : el("p", { class: "atelier-hint" }, icon("lock"), ` ${open.why}`));
    const sections = [head, sum, ...[...m].reverse().map((it) => card(p, it, T))];
    if (!m.length) sections.push(el("div", { class: "empty" }, el("h2", null, "Pas encore d'itération"), el("p", null, "Ouvrez le premier MVP, dites ce qu'il doit montrer et le niveau qu'il vise. Quand le design est prêt, gelez-le : c'est cet état qui passe en revue.")));
    sections.push(trlReferences());
    body.replaceChildren(...sections);
  }
  const off = store.on("change", () => { if (store.project) draw(); });
  draw();
  return () => off();
}

registerModule({ key: "mvp", label: "Itérations", icon: "check", tip: "Itérations MVP : geler, passer en revue, clore — et mesurer la convergence d'une itération à l'autre", render });
