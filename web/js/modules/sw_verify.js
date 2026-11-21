/* DesignWizard.ai — Logiciel, étape 6 du V : la VÉRIFICATION (choix cliqué de JP, 21 novembre 2026 : « Cycle en V »). Route : #/swtest[/<test>].
   The same three places as every studio, under the V. Left : the card of the step, the tests — On / Off, a copy born Off, passed or failed —,
   the coverage of the model, the guide. Centre : the MATRIX of traceability — a row per requirement, a column per test, ✓ where a test that
   proves it passed, ✗ where it failed —, then what the tests never moved, and what the reference chosen asks of the code that the model cannot
   give (structural coverage, measured on the compiled C with a coverage tool). Right : the sheet of the test chosen — the requirements it
   proves, its scenario written in the unit of what each pin measures, what it expects, and what was found. Every change is one undoable step ;
   the tests run again on every change. The rules are in sw/sw_test.js and sw/sw_req.js. */

import { el, clear, btn, toast, icon, onOff, badge } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide } from "../core/app.js";
import { guideBox } from "../core/guide.js";
import { demoDesign } from "../sw/sw_design.js";
import { cpuOf } from "../sw/sw_cpu.js";
import { reqsOf, trace, reqGuide, TRACE_STATES, REQ_KINDS } from "../sw/sw_req.js";
import { testsOf, addTest, copyTest, setTest, runAll, modelCoverage, testGuide, pinScales, pointsText, parsePoints, outputsOf, expectText, OPS } from "../sw/sw_test.js";
import { stdAsks } from "../sw/sw_std.js";
import { vBand, stepCard, swShell, vHash } from "./sw_vband.js";
import { docRow } from "./sw_docs_ui.js";

function render(main, args) {
  clear(main);
  const { head, left, view, right } = swShell(main, "sw-view"), page = el("div", { class: "sw-pagehost" }); view.append(page);
  const design = () => (store.project && (store.project.software || [])[0]) || null;
  const change = (label, fn) => store.commit(`Vérification : ${label}`, (p) => { const d = (p.software || [])[0]; if (d) fn(d); });
  const st = { sel: args[0] || null }; let run = null;
  const pick = (id) => { st.sel = id; try { history.replaceState(null, "", `${vHash("verify")}/${encodeURIComponent(id)}`); } catch (e) { /* a page without history */ } draw(); };
  const status = (t) => { const r = run && run.results[t.id]; return !(t.expect || []).length ? ["N'attend rien", "warn"] : !r ? ["Pas lancé", "neutral"] : r.ok ? ["Réussi", "ok"] : ["Échoue", "danger"]; };

  function drawLeft(d) {
    clear(left); const cpu = d ? cpuOf(d) : null;
    left.append(el("div", { class: "side-head" }, el("h2", null, "Vérification")));
    if (d) left.append(el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" },
      (() => { const b = btn("Lancer les essais", () => { run = runAll(d); draw(); toast(`${run.passed} réussi${run.passed > 1 ? "s" : ""}, ${run.failed} en échec${run.empty ? `, ${run.empty} qui n'attendent rien` : ""} — sur le modèle.`, run.failed ? "error" : "success", 5000); }, { primary: true, small: true, icon: "play", tip: "Les essais tournent aussi seuls à chaque changement" }); b.dataset.swRun = ""; return b; })(),
      btn("Nouvel essai", () => { let t = null; change("nouvel essai", (x) => { t = addTest(x, { name: "Nouvel essai", reqs: [] }); }); if (t) pick(t.id); }, { small: true, icon: "plus", tip: "Il part du scénario du banc ; dites ce que vous attendez" })), docRow(d, "svr")));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    scroll.append(stepCard(d, cpu, "verify", "", run, () => {}));
    if (!d) return;
    const T = testsOf(d);
    scroll.append(el("div", { class: "side-section", "data-fold-note": run ? `${run.passed} réussis, ${run.failed} en échec` : "" }, el("h3", null, "Les essais"),
      T.length ? el("ul", { class: "swr-list" }, T.map((t) => { const [fr, tone] = status(t); return el("li", { class: `${t.on === false ? "off" : ""}${st.sel === t.id ? " on" : ""}`, style: `--dom:${tone === "ok" ? "#16a34a" : tone === "danger" ? "#dc2626" : "#94a3b8"}` },
        onOff(t.on !== false, (on) => change(`${t.id} ${on ? "On" : "Off"}`, (x) => setTest(x, t.id, { on })), t.id),
        el("button", { type: "button", class: "swr-pick", "data-test": t.id, onClick: () => pick(t.id) }, el("b", null, t.id), " ", el("span", null, t.name), t.sure === false ? el("small", { class: "swr-ex" }, " exemple") : null),
        badge(fr, tone), btn("", () => change(`${t.id} copié`, (x) => copyTest(x, t.id)), { small: true, icon: "copy", tip: "Copier — la copie naît à Off" })); })) : el("p", { class: "muted small" }, "Aucun essai : « Nouvel essai ».")));
    const C = modelCoverage(d, run ? run.results : {});
    scroll.append(el("div", { class: "side-section", "data-fold-note": `${C.full} sur ${C.of}` }, el("h3", null, "Couverture du modèle"),
      el("div", { class: "sw-meter" }, el("span", null, "Décisions 0 / 1 qui ont pris leurs deux valeurs"), el("div", { class: "sw-meter-bar" }, el("i", { style: { width: `${Math.round(100 * C.ratio)}%` } })), el("b", null, `${C.full} / ${C.of}`)),
      el("ul", { class: "small" }, C.outs.filter((x) => !(x.seen0 && x.seen1)).map((x) => el("li", null, `${x.name} — n'a jamais valu ${x.seen1 ? "0" : x.seen0 ? "1" : "ni 0 ni 1"}`))),
      el("p", { class: "muted small" }, "C'est la couverture du MODÈLE. Celle du code (instructions, décisions, MC/DC) se mesure sur le C compilé, avec un outil de couverture.")));
    const g = [...testGuide(d, run).map((x) => ({ ...x, go: x.test ? () => pick(x.test) : null })), ...reqGuide(d, run.results).filter((x) => x.level === "error")];
    scroll.append(el("div", { class: "side-section", "data-fold-note": `${g.length}` }, el("h3", null, "À régler — le guide"), guideBox(g, { quiet: "Chaque essai attend quelque chose, prouve une exigence et réussit." })));
  }
  function matrix(d) {
    const T = trace(d, run.results), tests = testsOf(d).filter((t) => t.on !== false), rows = T.rows.filter((x) => x.state !== "off"), cell = (r, t) => { if (!(t.reqs || []).includes(r.req.id)) return el("td", { class: "swm-none" }, "");
      const x = run.results[t.id], ok = x && x.ok && (t.expect || []).length; return el("td", { class: ok ? "swm-ok" : "swm-ko", "data-tip": `${t.id} — ${ok ? "réussi" : "échoue ou n'attend rien"}` }, ok ? "✓" : "✗"); };
    return el("section", { class: "sw-card" }, el("h3", null, "La matrice de traçabilité"), el("p", { class: "muted small" }, "Une ligne par exigence, une colonne par essai : ✓ un essai qui la prouve a réussi, ✗ il échoue. La dernière colonne dit l'état de l'exigence."),
      el("div", { class: "table-wrap" }, el("table", { class: "data swm", "data-sw-matrix": "" }, el("thead", null, el("tr", null, el("th", null, "Exigence"), tests.map((t) => el("th", null, el("button", { type: "button", class: "linklike", onClick: () => pick(t.id) }, t.id))), el("th", null, "État"))),
        el("tbody", null, rows.map((r) => { const [fr, tone] = TRACE_STATES[r.state]; return el("tr", null, el("th", { style: `box-shadow: inset 4px 0 0 ${REQ_KINDS[r.req.kind].color}` }, el("a", { href: vHash("req") }, r.req.id), el("small", null, ` ${REQ_KINDS[r.req.kind].fr}`)), tests.map((t) => cell(r, t)), el("td", null, badge(fr, tone))); })))));
  }
  function drawCentre(d) {
    const A = stdAsks(d), C = modelCoverage(d, run.results);
    page.replaceChildren(el("div", { class: "sw-page" }, el("h2", null, icon("check"), " Ce qui est prouvé, ce qui ne l'est pas"),
      matrix(d),
      el("section", { class: "sw-card" }, el("h3", null, "Ce que les essais n'ont jamais fait bouger"), C.outs.some((x) => !(x.seen0 && x.seen1)) ? el("ul", null, C.outs.filter((x) => !(x.seen0 && x.seen1)).map((x) => el("li", null, `${x.name} — n'a jamais valu ${x.seen1 ? "0" : x.seen0 ? "1" : "ni 0 ni 1"} : un essai de plus le ferait basculer.`)))
        : el("p", { class: "lab-note" }, icon("check"), " Chaque décision 0 / 1 du modèle a pris ses deux valeurs.")),
      el("section", { class: "sw-card" }, el("h3", null, "Ce que la référence demande au code"), el("ul", null, A.lines.map((l) => el("li", null, l))),
        el("p", { class: "muted small" }, "Le modèle prouve le comportement ; la couverture structurelle se mesure sur le C compilé pour la cible, avec un outil de couverture, et ne se déduit pas d'ici. Rien ici ne rend un logiciel conforme : une norme se tient par un processus, des revues indépendantes et une autorité."))));
  }
  function testSheet(body, d, t) {
    const r = run.results[t.id], S = pinScales(d), outs = outputsOf(d), [fr, tone] = status(t);
    body.append(el("div", { class: "side-section", "data-fold-note": fr }, el("h3", null, "L'essai"),
      el("input", { type: "text", value: t.name, "data-test-name": "", onChange: (e) => change(`${t.id} renommé`, (x) => setTest(x, t.id, { name: e.target.value.trim() || t.name, sure: true })) }),
      el("p", null, badge(fr, tone), t.sure === false ? " " : null, t.sure === false ? btn("Confirmer l'essai", () => change(`${t.id} confirmé`, (x) => setTest(x, t.id, { sure: true })), { small: true, primary: true, icon: "check", tip: "Un essai d'exemple : relu, il devient celui du projet" }) : null),
      el("h3", null, "Les exigences qu'il prouve"), el("div", { class: "swr-chips" }, reqsOf(d).filter((q) => q.on !== false && q.verify === "test").map((q) => { const on = (t.reqs || []).includes(q.id);
        return el("button", { type: "button", class: `swr-chip${on ? " on" : ""}`, style: `--dom:${REQ_KINDS[q.kind].color}`, "aria-pressed": on ? "true" : "false", "data-tip": q.text, onClick: () => change(`${t.id} ${on ? "sans" : "avec"} ${q.id}`, (x) => setTest(x, t.id, { reqs: on ? t.reqs.filter((z) => z !== q.id) : [...(t.reqs || []), q.id] })) }, on ? "✓ " : "", q.id); }))));
    const dur = el("input", { type: "number", min: 1, max: 2000, step: 1, value: String(t.steps), "data-test-steps": "", onChange: (e) => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 2000) change(`${t.id} : ${v} pas`, (x) => setTest(x, t.id, { steps: v })); } });
    body.append(el("div", { class: "side-section", "data-fold-note": `${t.steps * (d.period || 10)} ms` }, el("h3", null, "Le scénario"),
      el("p", { class: "muted small" }, `Ce que lit chaque broche, instant après instant : « instant en ms : valeur », séparés par « ; » — dans l'unité de ce qu'elle mesure. Durée : nombre de pas de ${d.period || 10} ms.`),
      el("label", { class: "field" }, el("span", { class: "field-label" }, "Durée (pas)"), dur),
      Object.entries(S).map(([id, sc]) => { const p = (t.pins || {})[id] || { points: [[0, 0]] };
        if (p.follows) return el("label", { class: "field" }, el("span", { class: "field-label" }, `${sc.name} — suit ${p.follows}`), el("select", { "data-test-pin": id, onChange: (e) => change(`${t.id} : ${id}`, (x) => { const q = { ...p }; if (e.target.value === "") delete q.stuck; else q.stuck = Number(e.target.value); setTest(x, t.id, { pins: { ...t.pins, [id]: q } }); }) },
          el("option", { value: "", selected: p.stuck === undefined }, "suit sa bobine"), el("option", { value: "0", selected: p.stuck === 0 }, "coincé ouvert (0)"), el("option", { value: "1", selected: p.stuck === 1 }, "soudé fermé (1)")));
        return el("label", { class: "field" }, el("span", { class: "field-label" }, `${sc.name} (${sc.unit})`), el("input", { type: "text", value: pointsText(p.points, sc), "data-test-pin": id, onChange: (e) => { const q = parsePoints(e.target.value, sc); if (q.error) { toast(q.error, "error", 6000); e.target.classList.add("need"); return; } change(`${t.id} : ${sc.name}`, (x) => setTest(x, t.id, { pins: { ...t.pins, [id]: { points: q.points } } })); } })); })));
    const E = t.expect || [], setE = (i, o) => change(`${t.id} : attendu ${i + 1}`, (x) => setTest(x, t.id, { expect: E.map((e, k) => (k === i ? { ...o } : e)) }));
    body.append(el("div", { class: "side-section", "data-fold-note": `${E.length} attendu${E.length > 1 ? "s" : ""}` }, el("h3", null, "Ce que l'on attend"),
      el("ol", { class: "swt-expect" }, E.map((e, i) => { const c = r && r.checks[i];
        const ref = el("select", { onChange: (ev) => setE(i, { ...e, ref: ev.target.value }) }, outs.map((o) => el("option", { value: o.ref, selected: o.ref === e.ref }, o.name)));
        const mode = el("select", { onChange: (ev) => setE(i, ev.target.value === "within" ? { ref: e.ref, becomes: e.value ?? e.becomes ?? 1, within: [0, 100] } : { ref: e.ref, op: "==", value: e.becomes ?? e.value ?? 0, at: (e.within || [0, 0])[1] || 0 }) }, el("option", { value: "at", selected: !e.within }, "vaut, à un instant"), el("option", { value: "within", selected: !!e.within }, "passe à, dans une fenêtre"));
        const num = (v, fn, tip) => el("input", { type: "number", value: String(v), "aria-label": tip, onChange: (ev) => fn(Number(ev.target.value)) });
        return el("li", { class: c ? (c.ok ? "ok" : "ko") : "" }, ref, mode, e.within ? [el("span", null, " → "), num(e.becomes, (v) => setE(i, { ...e, becomes: v }), "valeur"), el("span", null, " entre "), num(e.within[0], (v) => setE(i, { ...e, within: [v, e.within[1]] }), "de (ms)"), el("span", null, " et "), num(e.within[1], (v) => setE(i, { ...e, within: [e.within[0], v] }), "à (ms)"), el("span", null, " ms")]
          : [el("select", { onChange: (ev) => setE(i, { ...e, op: ev.target.value }) }, Object.entries(OPS).map(([k, w]) => el("option", { value: k, selected: e.op === k }, w))), num(e.value, (v) => setE(i, { ...e, value: v }), "valeur"), el("span", null, " à "), num(e.at, (v) => setE(i, { ...e, at: v }), "instant (ms)"), el("span", null, " ms")],
          el("p", { class: "small" }, c ? [icon(c.ok ? "check" : "warning"), ` ${expectText(d, e)} — ${c.got}`] : expectText(d, e)), btn("", () => change(`${t.id} : attendu retiré`, (x) => setTest(x, t.id, { expect: E.filter((_, k) => k !== i) })), { small: true, icon: "trash", tip: "Retirer cet attendu" })); })),
      btn("Ajouter un attendu", () => change(`${t.id} : attendu ajouté`, (x) => setTest(x, t.id, { expect: [...E, { ref: outs[0] ? outs[0].ref : "", op: "==", value: 0, at: 0 }] })), { small: true, icon: "plus" })));
  }
  function drawRight(d) {
    clear(right); if (!d) return; const t = st.sel ? testsOf(d).find((x) => x.id === st.sel) : null;
    right.append(el("div", { class: "side-head" }, el("h2", null, t ? `${t.id} — ${t.name}` : "Un essai")));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (t) testSheet(body, d, t); else body.append(el("p", { class: "muted small" }, "Choisissez un essai dans la liste ou dans la matrice : son scénario, ce qu'il attend et ce qu'il a trouvé s'ouvrent ici."));
  }
  function draw() {
    const d = design(), cpu = d ? cpuOf(d) : null; run = d ? runAll(d) : null;
    head.replaceChildren(vBand(d, cpu, "verify", run, d ? stdAsks(d).lines[0] : "Le logiciel n'existe pas encore."));
    if (!d) { page.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Prouver chaque exigence"), el("p", null, "Un essai rejoue un scénario sur le modèle et dit si ce que l'on attend arrive. L'exemple en apporte cinq."),
      (() => { const b = btn("Partir de l'exemple", () => store.commit("Logiciel : exemple posé", (p) => { p.software = [demoDesign()]; }), { primary: true, icon: "play" }); b.dataset.swDemo = ""; return b; })())); drawLeft(null); clear(right); setGuide([]); return; }
    drawCentre(d); drawLeft(d); drawRight(d);
    setGuide([...testGuide(d, run).map((x) => ({ ...x, go: x.test ? () => pick(x.test) : null })), ...reqGuide(d, run.results).filter((x) => x.level === "error")]);
  }
  const off = store.on("change", () => draw());
  draw();
  return () => { off(); setGuide([]); };
}
registerModule({ key: "swtest", label: "Vérification", icon: "check", tip: "6. Prouver chaque exigence — Verification", render });
