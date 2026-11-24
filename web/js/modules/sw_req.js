/* DynamiteOrbit.ai — Logiciel, étape 1 du V : les EXIGENCES (choix cliqué de JP, 21 novembre 2026 : « Cycle en V »). Route : #/swreq.
   The same three places as every studio, under the V (modules/sw_vband.js). Left : the card of the step, the requirements grouped by kind —
   a colour and a pictogram per kind, On / Off and a copy born Off on each line —, what the tiles say they do (the requirements of the lower
   level, drawn from the design), the guide. Centre : the trace — requirements, tiles, tests (modules/sw_trace_map.js). Right : the sheet of
   the requirement chosen — its sentence read again by the tool, its kind, how it is proven, the tiles that carry it out, the tests that prove
   it ; « Confirmer » for an example the tool proposed ; « Signer » for what an analysis or a review proves. Every change is one undoable step.
   The rules are in sw/sw_req.js. */

import { el, clear, btn, toast, icon, onOff, badge } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide } from "../core/app.js";
import { guideBox } from "../core/guide.js";
import { KINDS, NATURES } from "../sw/sw_objects.js";
import { demoDesign } from "../sw/sw_design.js";
import { cpuOf } from "../sw/sw_cpu.js";
import { REQ_KINDS, VERIFY, TRACE_STATES, reqsOf, addReq, copyReq, setReq, reqQuality, designReqs, trace, reqGuide } from "../sw/sw_req.js";
import { runAll, testsOf } from "../sw/sw_test.js";
import { stdAsks } from "../sw/sw_std.js";
import { vBand, stepCard, swShell, vHash } from "./sw_vband.js";
import { traceMap } from "./sw_trace_map.js";
import { docRow } from "./sw_docs_ui.js";
import { openImport } from "./sw_lib_ui.js";
import { shows } from "../sw/sw_levels.js";
import { level } from "./sw_level_ui.js";

function render(main) {
  clear(main);
  const { head, left, view, right } = swShell(main, "sw-view swt-view"), host = el("div", { class: "swt-host" }), empty = el("div", { class: "page", hidden: true }); view.append(empty, host);
  const design = () => (store.project && (store.project.software || [])[0]) || null;
  const change = (label, fn) => store.commit(`Exigences : ${label}`, (p) => { const d = (p.software || [])[0]; if (d) fn(d); });
  const st = { sel: null }; let run = null;
  const map = traceMap(host, { onPick: (s) => { st.sel = s; draw(); } });

  function drawLeft(d, T) {
    clear(left); const cpu = d ? cpuOf(d) : null;
    left.append(el("div", { class: "side-head" }, el("h2", null, "Exigences")));
    const imp = btn("Importer (DynamiteAgile, IA)…", () => openImport({ design }), { primary: !d || !reqsOf(d).length, small: true, icon: "upload", tip: "L'export .csv des exigences de DynamiteAgile, ou la réponse d'un assistant au format standard (le prompt : bouton « IA »)" }); imp.dataset.swReqImport = "";
    left.append(el("div", { class: "side-actions" }, imp));
    if (d) left.append(el("div", { class: "side-actions" }, (() => { const b = btn("Nouvelle exigence", () => { let r = null; change("nouvelle exigence", (x) => { r = addReq(x, { text: "" }); }); if (r) { st.sel = { req: r.id }; draw(); const f = right.querySelector("[data-req-text]"); if (f) f.focus(); } }, { primary: true, small: true, icon: "plus" }); b.dataset.reqAdd = ""; return b; })(), docRow(d, "srs")));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    scroll.append(stepCard(d, cpu, "req", "", run, () => {}));
    if (!d) return;
    const R = reqsOf(d), ST = Object.fromEntries(T.rows.map((x) => [x.req.id, x.state]));
    scroll.append(el("div", { class: "side-section", "data-fold-note": `${R.filter((r) => r.on !== false).length} sur ${R.length}` }, el("h3", null, "Les exigences"),
      R.length ? Object.entries(REQ_KINDS).map(([k, K]) => { const L = R.filter((r) => r.kind === k); return L.length ? [el("p", { class: "ft-label rd-group", style: `--dom:${K.color}` }, icon(K.icon), ` ${K.fr} — ${K.label}`),
        el("ul", { class: "swr-list" }, L.map((r) => { const [stFr, tone] = TRACE_STATES[ST[r.id]] || ["", "neutral"]; return el("li", { class: `${r.on === false ? "off" : ""}${st.sel && st.sel.req === r.id ? " on" : ""}`, style: `--dom:${K.color}` },
          onOff(r.on !== false, (on) => change(`${r.id} ${on ? "On" : "Off"}`, (x) => setReq(x, r.id, { on })), r.id),
          el("button", { type: "button", class: "swr-pick", "data-req": r.id, onClick: () => { st.sel = { req: r.id }; draw(); } }, el("b", null, r.id), " ", el("span", null, r.text || "(vide)"), r.sure === false ? el("small", { class: "swr-ex" }, " exemple") : null),
          badge(stFr, tone), btn("", () => change(`${r.id} copiée`, (x) => copyReq(x, r.id)), { small: true, icon: "copy", tip: "Copier — la copie naît à Off" })); }))] : null; })
        : el("p", { class: "muted small" }, "Aucune exigence : « Nouvelle exigence », une phrase avec « doit »."),
      T.orphans.length ? el("p", { class: "atelier-hint warn" }, `${T.orphans.length} tuile${T.orphans.length > 1 ? "s" : ""} qu'aucune exigence ne demande : entourée${T.orphans.length > 1 ? "s" : ""} d'ambre au centre.`) : null));
    const D = designReqs(d), lv = level();
    if (shows(lv, "reqLower")) scroll.append(el("div", { class: "side-section", "data-fold-note": `${D.length} tuiles` }, el("h3", null, "Ce que disent les tuiles"),
      el("p", { class: "muted small" }, "Les exigences de bas niveau : chaque tuile dit en une phrase ce qu'elle fait, tirée de la conception. Elles partent dans les fichiers C, au-dessus de chaque réglage."),
      el("ul", { class: "swr-llr" }, D.map((x) => { const N = NATURES.find((n) => n.id === KINDS[x.kind].nature); return el("li", { style: `--dom:${N.color}` }, el("button", { type: "button", class: "linklike", onClick: () => { st.sel = { obj: x.obj }; draw(); } }, x.name), el("span", { class: "muted small" }, ` — ${x.text}`)); }))));
    const g = reqGuide(d, run ? run.results : null).map((x) => ({ ...x, go: x.req ? () => { st.sel = { req: x.req }; draw(); } : null }));
    if (shows(lv, "guideList")) scroll.append(el("div", { class: "side-section", "data-fold-note": `${g.length}` }, el("h3", null, "À régler — le guide"), guideBox(g, { quiet: "Les exigences sont écrites, allouées et confirmées." })));
  }
  function reqSheet(body, d, r, T) {
    const row = T.rows.find((x) => x.req.id === r.id), [stFr, tone] = TRACE_STATES[row.state], Q = reqQuality(r), objs = (d.objects || []).filter((x) => !x.off && KINDS[x.kind]), tests = testsOf(d).filter((t) => (t.reqs || []).includes(r.id));
    body.append(el("div", { class: "side-section", "data-fold-note": stFr }, el("h3", null, "La phrase"),
      el("textarea", { rows: "4", "data-req-text": "", placeholder: "Le logiciel doit… (un nombre et son unité quand c'est une performance ou une sécurité)", onChange: (e) => change(`${r.id} réécrite`, (x) => setReq(x, r.id, { text: e.target.value.trim(), sure: true })) }, r.text),
      Q.length ? el("ul", { class: "swr-quality" }, Q.map((q) => el("li", { class: q.level }, icon(q.level === "tip" ? "info" : "warning"), " ", q.text))) : el("p", { class: "lab-note" }, icon("check"), " Bien écrite : une exigence, un « doit », rien de vague."),
      r.sure === false ? (() => { const b = btn("Confirmer l'exigence", () => change(`${r.id} confirmée`, (x) => setReq(x, r.id, { sure: true })), { small: true, primary: true, icon: "check", tip: "Une exigence d'exemple, proposée par l'outil : relue, elle devient celle du projet" }); b.dataset.reqConfirm = ""; return el("p", null, b); })() : null,
      el("p", null, badge(stFr, tone))));
    body.append(el("div", { class: "side-section", "data-fold-note": REQ_KINDS[r.kind].fr }, el("h3", null, "Son genre"),
      el("div", { class: "swr-kinds" }, Object.entries(REQ_KINDS).map(([k, K]) => el("button", { type: "button", class: `swr-kind${r.kind === k ? " on" : ""}`, style: `--dom:${K.color}`, "aria-pressed": r.kind === k ? "true" : "false", "data-tip": K.text, onClick: () => change(`${r.id} : ${K.fr}`, (x) => setReq(x, r.id, { kind: k })) }, icon(K.icon), el("span", null, K.fr))))));
    body.append(el("div", { class: "side-section", "data-fold-note": VERIFY[r.verify].fr }, el("h3", null, "Comment on la prouve"),
      el("div", { class: "seg" }, Object.entries(VERIFY).map(([k, v]) => btn(v.fr, () => change(`${r.id} prouvée par ${v.fr.toLowerCase()}`, (x) => setReq(x, r.id, { verify: k })), { small: true, cls: r.verify === k ? "on" : "", tip: v.text }))),
      el("p", { class: "muted small" }, VERIFY[r.verify].text),
      r.verify === "test" ? el("div", null, tests.length ? el("ul", { class: "small" }, tests.map((t) => el("li", null, el("a", { href: `${vHash("verify")}/${encodeURIComponent(t.id)}` }, `${t.id} — ${t.name}`)))) : el("p", { class: "atelier-hint warn" }, "Aucun essai ne la prouve encore : étape 6, Vérification."))
        : (() => { const who = el("input", { type: "text", placeholder: "Votre nom", "data-req-signer": "", value: r.signed ? r.signed.by : "" });
          return r.signed ? el("p", { class: "lab-note" }, icon("check"), ` Signée par ${r.signed.by} le ${String(r.signed.at).slice(0, 10)}. `, btn("Retirer la signature", () => change(`${r.id} : signature retirée`, (x) => { const q = reqsOf(x).find((y) => y.id === r.id); if (q) delete q.signed; }), { small: true }))
            : el("div", { class: "swr-sign" }, who, btn("Signer", () => { if (!who.value.trim()) { who.focus(); toast("Nommez qui signe : la vérification par analyse ou par revue se trace par une personne.", "info", 5000); return; } change(`${r.id} signée`, (x) => { const q = reqsOf(x).find((y) => y.id === r.id); q.signed = { by: who.value.trim(), at: new Date().toISOString() }; }); }, { small: true, icon: "edit" })); })()));
    body.append(el("div", { class: "side-section", "data-fold-note": `${row.objs.length} tuiles` }, el("h3", null, "Les tuiles qui la réalisent"),
      el("p", { class: "muted small" }, "Un clic ajoute ou retire une tuile : c'est l'allocation, le premier fil de la traçabilité."),
      NATURES.map((N) => { const L = objs.filter((x) => KINDS[x.kind].nature === N.id); return L.length ? [el("p", { class: "ft-label rd-group", style: `--dom:${N.color}` }, `${N.fr} — ${N.label}`), el("div", { class: "swr-chips" }, L.map((x) => { const on = (r.objs || []).includes(x.id);
        return el("button", { type: "button", class: `swr-chip${on ? " on" : ""}`, style: `--dom:${N.color}`, "aria-pressed": on ? "true" : "false", "data-req-obj": x.id, onClick: () => change(`${r.id} ${on ? "sans" : "avec"} ${x.id}`, (y) => setReq(y, r.id, { objs: on ? (r.objs || []).filter((z) => z !== x.id) : [...(r.objs || []), x.id] })) }, on ? "✓ " : "", x.name); }))] : null; })));
  }
  function drawRight(d, T) {
    clear(right); if (!d) return;
    const r = st.sel && st.sel.req ? reqsOf(d).find((x) => x.id === st.sel.req) : null, o = st.sel && st.sel.obj ? d.objects.find((x) => x.id === st.sel.obj) : null;
    right.append(el("div", { class: "side-head" }, el("h2", null, r ? r.id : o ? o.name : "Une exigence")));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (r) return reqSheet(body, d, r, T);
    if (o) { const by = reqsOf(d).filter((x) => (x.objs || []).includes(o.id)); body.append(el("div", { class: "side-section" }, el("h3", null, "Ce que la tuile fait"), el("p", null, designReqs(d).find((x) => x.obj === o.id).text),
      el("h3", null, "Les exigences qui la demandent"), by.length ? el("ul", { class: "small" }, by.map((x) => el("li", null, el("button", { type: "button", class: "linklike", onClick: () => { st.sel = { req: x.id }; draw(); } }, x.id), ` — ${x.text}`))) : el("p", { class: "atelier-hint warn" }, "Aucune : une fonction que personne n'a demandée se justifie par une exigence, ou se retire."),
      el("p", null, el("a", { href: vHash("design", "objects") }, "Ouvrir la tuile dans la Conception →")))); return; }
    body.append(el("p", { class: "muted small" }, "Choisissez une exigence dans la liste ou au centre : sa phrase, son genre, sa preuve et ses tuiles s'ouvrent ici."), el("ul", { class: "small sw-asks" }, stdAsks(d).lines.map((l) => el("li", null, l))));
  }
  function draw() {
    const d = design(), cpu = d ? cpuOf(d) : null; run = d ? runAll(d) : null; const T = d ? trace(d, run.results) : null;
    head.replaceChildren(vBand(d, cpu, "req", run, d ? stdAsks(d).lines[0] : "Le logiciel n'existe pas encore."));
    empty.hidden = !!d; host.hidden = !d;
    if (!d) { empty.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Le logiciel commence par ses exigences"), el("p", null, "Une exigence dit, en une phrase mesurable, ce que le logiciel doit faire. Importez la liste de DynamiteAgile (son export .csv), ou une réponse d'IA au format standard — le prompt est sous le bouton « IA » —, ou partez de l'exemple."),
      (() => { const b = btn("Importer mes exigences…", () => openImport({ design }), { primary: true, icon: "upload" }); b.dataset.swReqStart = ""; return b; })(), " ",
      (() => { const b = btn("Partir de l'exemple", () => store.commit("Logiciel : exemple posé", (p) => { p.software = [demoDesign()]; }), { icon: "play" }); b.dataset.swDemo = ""; return b; })())); drawLeft(null, null); clear(right); setGuide([]); return; }
    map.draw(d, run, st.sel); drawLeft(d, T); drawRight(d, T);
    setGuide(reqGuide(d, run.results).map((x) => ({ ...x, go: x.req ? () => { st.sel = { req: x.req }; draw(); } : null })));
  }
  const off = store.on("change", () => draw());
  draw();
  return () => { off(); map.destroy(); setGuide([]); };
}
registerModule({ key: "swreq", label: "Exigences", icon: "report", tip: "1. Écrire ce que le logiciel doit faire — Requirements", render });
