/* DynamiteOrbit — Revue : the design review of the whole project, artefact by artefact. What an AI wrote arrives
   here as « Brouillon IA » ; the engineer opens each piece, reads what the tool finds (does it build ? what does DFx
   say ? what verdict for the analysis ?), writes what must change, and either validates it, sends that one piece to an
   AI, or sends every note at once for one complete outside iteration. A validated piece that changes afterwards says
   so, and validating it again makes its next revision. Route : #/review. */

import { el, btn, badge, toast, icon, promptBox, table } from "../core/dom.js";
import { registerModule, app } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { runDfx } from "../analysis/dfx_api.js";
import { reviewItems, reviewProgress, approve, askRevision, setNote, iterationRequest, artefactOf, REVIEW_STATES, REVIEW_KINDS } from "../core/review.js";

const checked = new Map();                                     // `${key}|${signature}` → { text, tone } : what the tool found, kept while the artefact does not change
const PLURAL = { part: "Pièces", assembly: "Assemblages", board: "Cartes électroniques", physics: "Analyses — modèles de physique", simulation: "Simulations" };
const VERDICT = { ok: ["conforme", "ok"], warn: ["à vérifier", "warn"], fail: ["non conforme", "danger"] };

function hrefOf(it, d) {
  const id = encodeURIComponent(it.id);
  if (it.kind === "part") return `#/${d.family === "pcb" ? "pcb" : d.family === "extrusion" ? "extrusion" : "parts"}/${id}`;
  if (it.kind === "assembly") return `#/assembly/${id}`;
  if (it.kind === "board") return `#/pcba/${id}`;
  if (it.kind === "physics") return `#/physics/${encodeURIComponent(d.model)}${d.part ? `/${encodeURIComponent(d.part)}` : ""}`;
  return `#/fea/${encodeURIComponent(d.target || "")}`;
}
const aiKey = (it) => (it.kind === "physics" || it.kind === "simulation" ? "project" : it.key);

function render(main) {
  const page = el("div", { class: "page" }), body = el("div");
  main.append(page); page.append(body);
  let alive = true, run = 0;
  const cells = new Map();
  const paint = (it) => { const cell = cells.get(it.key), c = checked.get(`${it.key}|${it.sig}`); if (!cell || !c) return; cell.replaceChildren(...c.map((x) => el(x.href ? "a" : "span", { class: `chip ${x.tone === "ok" ? "done" : x.tone === "danger" ? "bad" : ""}`, href: x.href || null, "data-tip": x.href ? `${x.tip ? x.tip + " — " : ""}un clic mène aux points, expliqués un à un` : x.tip || null }, x.text))); };
  /** Builds each part and asks the rule engine, one after the other : the review reads facts, not promises. */
  async function check(items) {
    const mine = ++run;
    for (const it of items.filter((x) => x.kind === "part" && !checked.has(`${x.key}|${x.sig}`))) {
      const spec = artefactOf(store.project, it.key); if (!spec) continue;
      try {
        const built = await kernel.build(spec), errs = built.log.filter((l) => l.level === "error"), dfx = await runDfx(spec, built), s = dfx && dfx.summary;
        checked.set(`${it.key}|${it.sig}`, [errs.length || !built.bodies.length ? { text: "ne se construit pas", tone: "danger", tip: errs.map((e) => e.msg).join(" · ") } : { text: "construite", tone: "ok" },
          ...(s ? [{ text: s.errors ? `DFx : ${s.errors} à corriger` : s.warnings ? `DFx : ${s.warnings} à vérifier` : "DFx : fabricable", tone: s.errors ? "danger" : s.warnings ? "warn" : "ok", href: s.errors || s.warnings ? `#/dfx/points/${encodeURIComponent(spec.id)}` : null, tip: dfx.findings.filter((f) => f.severity !== "info").slice(0, 4).map((f) => f.message).join(" · ") || null }] : [])]);
      } catch (e) { checked.set(`${it.key}|${it.sig}`, [{ text: "ne se construit pas", tone: "danger", tip: e.message }]); }
      if (!alive || mine !== run) return;
      paint(it);
    }
  }
  const act = (label, fn, extra) => { try { store.commit(label, fn, extra); } catch (e) { toast(e.message, "error"); } };
  let iter = null;                                             // the « complete iteration » button : it follows the notes without the table being drawn again
  const follow = () => { if (!iter) return; const ask = iterationRequest(store.project); iter.disabled = !ask; iter.classList.toggle("btn-primary", !!ask); };

  function draw() {
    const p = store.project, items = reviewItems(p), prog = reviewProgress(p), ask = iterationRequest(p), brief = p.brief || {}, shared = !!(p.team && p.team.owner);
    cells.clear();
    const bar = el("div", { class: "review-bar", role: "img", "aria-label": `${prog.ok} artéfact(s) revus sur ${prog.total}` }, ["ok", "changed", "revise", "draft", "todo"].filter((k) => prog[k]).map((k) => el("span", { class: `rv-${k}`, style: { flexGrow: prog[k] }, "data-tip": `${prog[k]} — ${REVIEW_STATES[k].fr}` })));
    const head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Revue de conception"),
      el("p", { class: "muted" }, "Chaque artéfact du projet, son état de revue et ce que l'outil y constate. Ouvrez-le, écrivez ce qui doit changer, validez-le — ou confiez la révision à une IA, une pièce à la fois ou tout le projet d'un coup.")),
      el("div", { class: "form-actions" },
        btn("Premier design avec une IA…", () => import("./first_design.js").then((m) => m.openFirstDesign()), { icon: "wizard", tip: "Une description détaillée, une entrevue menée par l'assistant de votre choix, et un premier design complet à passer en revue" }),
        (iter = btn("Itération complète avec l'IA", () => app.aiLoop("project", { ask: iterationRequest(store.project) }), { primary: !!ask, icon: "sparkle", disabled: !ask, tip: "Envoie le projet entier avec toutes les notes de la revue ; la réponse revient avec la liste de ses changements, à appliquer en une étape. Écrivez d'abord une note sur au moins un artéfact." })),
        el("a", { class: "btn", href: "#/report", "data-tip": "Le dossier de revue de conception, à imprimer" }, icon("report"), el("span", null, "Rapport"))),
      el("div", { class: "subtabs", style: { width: "100%" } }, el("a", { class: "subtab active", href: "#/review" }, "Artéfacts"), el("a", { class: "subtab", href: "#/mvp", "data-tip": "Geler une itération, la passer en revue, la clore — et mesurer la convergence d'un MVP à l'autre" }, "Itérations MVP"),
        el("a", { class: "subtab", href: "#/team", "data-tip": "Travailler à plusieurs en miroir, et s'écrire sur chaque artéfact" }, "Équipe"), el("a", { class: "subtab", href: "#/plm", "data-tip": "Libérer : numéro, révisions figées, règle forme · ajustement · fonction" }, "Révisions")));
    const sum = el("section", { class: "card taped" }, el("h2", null, `${prog.ok} / ${prog.total} revus`), bar,
      el("div", { class: "atelier-chips" }, ["draft", "revise", "changed", "todo", "ok"].filter((k) => prog[k]).map((k) => el("span", { class: "chip", "data-tip": REVIEW_STATES[k].text }, `${prog[k]} ${REVIEW_STATES[k].fr.toLowerCase()}`))),
      prog.total && !prog.left ? el("p", { class: "atelier-hint" }, icon("check"), " Tout est revu : le rapport peut partir en revue de conception.") : null);
    const sections = [head, sum];
    if ((brief.assumptions || []).length || (brief.open || []).length || (brief.answers || []).length) {
      const col = (title, list, cls) => (list && list.length ? el("div", null, el("h3", null, title), el("ul", { class: cls }, list.map((t) => el("li", null, typeof t === "string" ? t : el("span", null, el("b", null, t.q), " — ", t.a))))) : null);
      sections.push(el("section", { class: "card" }, el("h2", null, "Ce que l'IA a retenu de l'entrevue"), el("p", { class: "muted small" }, "À lire en premier : ses questions ouvertes sont ce dont elle n'est pas sûre, ses hypothèses ce qu'elle a décidé sans vous."),
        el("div", { class: "review-brief" }, col("Questions ouvertes", brief.open, "decisions"), col("Hypothèses", brief.assumptions, "decisions"), col("Réponses de l'entrevue", brief.answers, "decisions")),
        brief.description ? el("details", null, el("summary", { class: "muted small" }, "La description donnée"), el("p", { class: "small", style: { whiteSpace: "pre-wrap" } }, brief.description)) : null));
    }
    if (!items.length) sections.push(el("div", { class: "empty" }, el("h2", null, "Rien à revoir encore"), el("p", null, "Créez une pièce dans l'Atelier, ou demandez un premier design complet à une IA.")));
    for (const kind of Object.keys(PLURAL)) {
      const list = items.filter((x) => x.kind === kind); if (!list.length) continue;
      const rows = list.map((it) => {
        const d = artefactOf(p, it.key), S = REVIEW_STATES[it.state], facts = el("div", { class: "review-facts" }), note = el("input", { type: "text", value: it.note, placeholder: "Ce qu'il faut revoir, en clair…", "aria-label": `Note de revue de ${it.id}`, onChange: (e) => act(`Revue : note sur ${it.id}`, (x) => setNote(x, it.key, e.target.value), { reviewNote: true }) });     // no redraw : the button about to be clicked must stay under the mouse
        if (kind === "part") { cells.set(it.key, facts); facts.append(el("span", { class: "muted small" }, "vérification…")); }
        else if (d.verdict) facts.append(badge((VERDICT[d.verdict] || VERDICT.warn)[0], (VERDICT[d.verdict] || VERDICT.warn)[1]));
        const hist = it.history.map((h) => `${h.rev ? `rév. ${h.rev} — ` : ""}${String(h.when).slice(0, 10)} : ${h.note}`).join(" · ");
        return { attrs: { class: `rv-row rv-${it.state}`, "data-key": it.key }, cells: [badge(S.fr, S.tone), el("a", { href: hrefOf(it, d), "data-tip": "Ouvrir dans son écran" }, el("code", null, it.id)), el("div", null, it.name, shared ? el("a", { class: "chip", style: { marginLeft: ".4rem" }, href: `#/team/${encodeURIComponent(it.key)}`, "data-tip": "Les messages de l'équipe sur cet artéfact" }, `@ ${(p.talk || []).filter((m) => m.on === it.key && !m.done).length}`) : null, el("small", { class: "muted", style: { display: "block" } }, it.facts)),
          it.rev ? el("span", { class: "chip", "data-tip": hist || "Pas encore revue" }, `rév. ${it.rev}`) : el("span", { class: "muted", "data-tip": hist || null }, "—"), facts, note,
          el("span", { class: "nowrap" },
            btn("Revu", () => { act(`Revue : ${it.id} validé`, (x) => { const r = approve(x, it.key); if (r && r.bumped) toast(`${it.id} : révision ${r.rev} validée.`, "success"); }); }, { small: true, primary: it.state !== "ok", icon: "check", disabled: it.state === "ok", tip: it.state === "changed" ? "Valider ce qui a changé : crée la révision suivante" : "Je l'ai lu et je le valide" }),
            btn("À réviser", async () => { const t = note.value.trim() || await promptBox(`Réviser ${it.id}`, "Ce qui doit changer", "", "En clair, comme à un technicien : « épaissir la paroi à 3 mm », « passer les vis en M4 »."); if (t) act(`Revue : ${it.id} à réviser`, (x) => askRevision(x, it.key, t)); }, { small: true, tip: "Garde la note et marque l'artéfact : il partira dans la prochaine itération" }),
            btn("", () => app.aiLoop(aiKey(it), { ask: note.value.trim() || it.note }), { small: true, icon: "sparkle", tip: kind === "physics" || kind === "simulation" ? "Les analyses font l'aller-retour avec le projet entier" : "Confier cette révision à une IA : seule cette pièce part, la réponse revient avec ses changements" }))] };
      });
      sections.push(el("section", { class: "card" }, el("h2", null, `${PLURAL[kind]} `, el("small", { class: "muted" }, `${list.filter((x) => x.state === "ok").length} / ${list.length}`)), table(["État", "Repère", REVIEW_KINDS[kind], "Rév.", "Ce que l'outil constate", "Note de revue", ""], rows, "review-table")));
    }
    body.replaceChildren(...sections);
    for (const it of items) paint(it);
    check(items);
  }
  const off = store.on("change", (c) => { if (!store.project) return; if (c && c.reviewNote) follow(); else draw(); });
  draw();
  return () => { alive = false; off(); };
}

registerModule({ key: "review", label: "Revue", icon: "check", tip: "Revue de conception : chaque pièce, assemblage, carte et analyse, son état, vos notes — et l'aller-retour avec une IA, une pièce à la fois ou tout le projet", render });
