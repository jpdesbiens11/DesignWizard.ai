/* DesignWizard.ai — Labo : the electronics lab, before the board exists (demande de JP : « un laboratoire d'électronique virtuel
   pour pré-tester les cartes avant de les faire fabriquer… avec les mêmes setup »). Left, the bench : the board, the block
   under test, the test, how fast it plays. Centre, what one looks at : the board whose tracks and parts light up with the
   current, and two oscilloscopes — what goes in, what comes out — or the transfer function. Right, what one gets : the
   sheet of the test (why, what to expect, the set-up, the steps) and the readings — expected, accepted, measured.
   The whole plan leaves as a Word or a PDF document. The numbers : pcba/lab_bench.js, pcba/lab_plan.js.
   Route : #/elab/<board>. */

import { el, clear, icon, svg, btn, badge, field, toast, modal, copyText, download, onOff } from "../core/dom.js";
import { registerModule, go, setStatus, setGuide, docMeta } from "../core/app.js";
import { store } from "../core/store.js";
import { resolveBoard } from "../pcba/model.js";
import { LIBRARY } from "../pcba/library.js";
import { BLOCKS, BLOCK_CATEGORIES } from "../pcba/blocks.js";
import { NATURES, blockTests, eng } from "../pcba/lab_bench.js";
import { testSheet, boardSheets, boardSheet, sheetJobs, jobSheet, expectedText, gapText, labPlanDoc, labGuide, labOf, setReading, setSkip, skipped, verdict, labStatus, testKey } from "../pcba/lab_plan.js";
import { labBoard, scope, bode } from "./elab_view.js";
import { screenToBench } from "../pcba/lab_plain.js";
import { benchTable, whyList } from "./elab_plain.js";
import { openManip } from "./elab_manip.js";
import { manipDoc } from "../pcba/lab_manip_doc.js";
import { readUnit as unitOf } from "../pcba/lab_manip.js";
import { boardTests, BOARD_KEY } from "../pcba/lab_board.js";
import { docx } from "../core/docx.js";
import { pdfDoc } from "../core/pdfdoc.js";
import { toDwiz } from "../core/dwiz.js";
import { aiRead, aiDiff } from "../core/ai_loop.js";
import { guideBox, nudge } from "../core/guide.js";
import { busyVeil, pageVeil, underVeil } from "../core/busy.js";
import { demoBoard } from "../demo/demo_pcba.js";
import { rs485Board } from "../demo/demo_rs485.js";
import { firstBoard } from "../demo/demo_first.js";

const CAT = { Raccorder: ["#64748b", "link"], "Protéger": ["#b45309", "lock"], Alimenter: ["#d6453d", "power"], Calculer: ["#7c3aed", "chip"], Mesurer: ["#2563eb", "sensor"], Commander: ["#ea580c", "bolt"], Communiquer: ["#0891b2", "cloud"], Signaler: ["#16a34a", "star"], Tester: ["#475569", "check"] };
const pic = (...kids) => svg("svg", { viewBox: "0 0 30 30", width: 30, height: 30, class: "cf-icon", "aria-hidden": "true" }, ...kids.flat(Infinity));
const stroke = { fill: "none", stroke: "var(--dom)", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };
/* a test of a nature, as a small drawing of what one looks at */
const naturePic = (id) => ({
  power: () => pic(svg("path", { d: "M15 4 V13 M9 8 A9 9 0 1 0 21 8", ...stroke })),
  static: () => pic(svg("path", { d: "M5 21 A10 10 0 0 1 25 21", ...stroke }), svg("path", { d: "M15 21 L21 11", ...stroke }), svg("circle", { cx: 15, cy: 21, r: 1.8, fill: "var(--dom)" })),
  dynamic: () => pic(svg("path", { d: "M3 20 H9 V10 H15 V20 H21 V10 H27", ...stroke })),
  frequency: () => pic(svg("path", { d: "M3 10 H14 Q19 10 27 23", ...stroke }), svg("path", { d: "M17 6 V26", fill: "none", stroke: "var(--dom)", "stroke-width": 1, "stroke-dasharray": "2 2" })),
  function: () => pic(svg("rect", { x: 5, y: 10, width: 20, height: 10, rx: 5, ...stroke }), svg("circle", { cx: 20, cy: 15, r: 3.4, fill: "var(--dom)" })),
  bus: () => pic(svg("path", { d: "M3 11 H8 L10 19 H15 L17 11 H22 L24 19 H27", ...stroke }), svg("path", { d: "M3 24 H27", fill: "none", stroke: "var(--dom)", "stroke-width": 1 })),
})[id]();
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}${o.off ? " off" : ""}`, type: "button", "aria-pressed": o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label), o.small ? el("small", null, o.small) : null);

function render(main, args) {
  const boards = store.boards, id = args[0] && store.board(args[0]) ? args[0] : (boards[0] && boards[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div", { class: "viewport lab-view" }), root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--right-w", "430px"); main.append(root);
  if (!id) { root.classList.add("no-right"); right.remove(); left.append(el("div", { class: "side-head" }, el("h2", null, "Labo")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Le laboratoire essaie une carte"), el("p", null, "Avant de la faire fabriquer : chaque bloc de la carte est mis sur un banc simulé — alimentation, générateur, oscilloscope — et le plan de test sort avec les valeurs à retrouver au vrai laboratoire."),
      el("div", { class: "form-actions", style: { justifyContent: "center" } }, btn("Charger la carte de démonstration", () => { const nid = store.addBoard(demoBoard()); go(`#/elab/${encodeURIComponent(nid)}`); }, { primary: true, icon: "sparkle" }), btn("Exemple : première carte", () => { const nid = store.addBoard(firstBoard()); go(`#/elab/${encodeURIComponent(nid)}`); }, { icon: "cloud", tip: "Une pile, deux boutons, une DEL rouge et une DEL jaune : la carte la plus simple, pour apprendre le banc pas à pas", cls: "first-example" }), btn("Exemple : nœud RS-485", () => { const nid = store.addBoard(rs485Board()); go(`#/elab/${encodeURIComponent(nid)}`); }, { icon: "cloud", tip: "La liaison RS-485 du bornier au microcontrôleur, avec ses essais" }), btn("Ouvrir le PCBA", () => go("#/pcba"), { icon: "chip" }))))); return null; }
  const st = { block: null, test: null, sheet: null, q: 0, playing: true, speed: 1, tab: "sheet", alive: true, raf: 0, last: 0, sheets: null }, board = () => store.board(id);
  const blocks = () => (board().blocks || []).filter((b) => BLOCKS[b.template]), refsOf = (b) => Object.fromEntries((board().parts || []).filter((p) => p.block === b.id && p.local).map((p) => [p.local, p.ref]));
  const boardHost = el("div", { class: "lab-board-host" }), bar = el("div", { class: "lab-bar" }), scopes = el("div", { class: "lab-scopes bottom-body" }), veil = busyVeil(view); view.append(boardHost, el("div", { class: "lab-bottom bottom-pane", "data-bottom": "lab" }, bar, scopes));      // the bar and the oscilloscopes : a panel whose height is dragged at its top edge (core/panes.js mountBottom)
  const pcb = labBoard(boardHost); let S1 = null, S2 = null, BD = null, stateNodes = [];
  const key = () => (st.block && st.test ? testKey(st.block, st.test) : null), whole = () => st.block === BOARD_KEY, cur = () => (whole() ? { id: BOARD_KEY, whole: true } : blocks().find((b) => b.id === st.block) || null);
  const testsOf = (b) => (!b ? [] : b.whole ? boardTests(board()) : blockTests(b.template));
  /* the net of the board that a net of the block is : found through a pin they share */
  const netOf = (b, built, local) => { const refs = refsOf(b), n = built.nets.find((x) => x.name === local); if (!n) return null; for (const pin of n.pins) { const dot = pin.indexOf("."), ref = refs[pin.slice(0, dot)]; if (!ref) continue; const bn = (board().nets || []).find((x) => (x.pins || []).includes(`${ref}.${pin.slice(dot + 1)}`)); if (bn) return bn.name; } return null; };
  function frame() {
    const s = st.sheet, R = s && s.result, b = cur(); if (!R || !b) return { parts: {}, nets: {}, states: [] }; const mine = b.whole ? null : refsOf(b), refs = mine || new Proxy({}, { get: (_, k) => k }), out = { parts: {}, nets: {}, states: [], quiet: !!b.whole };
    if (R.kind === "tran") { const q = Math.min(R.frames - 1, Math.round(st.q * (R.frames - 1)));
      for (const [local, a] of Object.entries(R.activity)) if (refs[local]) out.parts[refs[local]] = a.a[q];
      for (const [local, n] of Object.entries(R.nets)) { const bn = b.whole ? local : st.netMap[local]; if (bn) out.nets[bn] = n.pp > 1e-3 ? n.a[q] : Math.abs(n.mean) > 0.05 ? 0.22 : 0; }
      out.states = R.states.map((x) => ({ ref: refs[x.part], kind: x.kind, label: x.label, ...x.at(q) })).filter((x) => x.ref); }
    else for (const p of R.built && !b.whole ? R.built.parts : []) if (refs[p.id]) out.parts[refs[p.id]] = R.kind === "ac" ? 0.3 + 0.5 * Math.abs(Math.sin(st.q * Math.PI * 6)) : 0.25;
    return out;
  }
  function paint() {
    const s = st.sheet, R = s && s.result; if (!R) return; const f = frame(); pcb.light(f);
    if (R.kind === "tran" && S1) { S1.draw(R.t, R.ch1.y, st.q, { ac: R.ch1.ac }); S2.draw(R.t, R.ch2.y, st.q, { ac: R.ch2.ac }); } else if (R.kind === "ac" && BD) BD.draw(R.ac, R.cut, st.q);
    stateNodes.forEach((n, i) => { const x = f.states[i]; if (!x) return; n.classList.toggle("on", !!x.on); n.lastChild.textContent = ` ${x.text}`; });
    const pos = bar.querySelector("[data-pos]"); if (pos && document.activeElement !== pos) pos.value = String(Math.round(st.q * 1000));
  }
  function tick(now) { if (!st.alive) return; if (st.playing && st.sheet && st.sheet.result.kind !== "none") { const dt = st.last ? Math.min(0.1, (now - st.last) / 1000) : 0; st.q += (dt * st.speed) / 5; if (st.q > 1) st.q = 0; paint(); } st.last = now; st.raf = requestAnimationFrame(tick); }
  /* runs the test of the block on the simulated bench — under the veil, for the longer ones */
  function run() {
    const b = cur(); if (!b || !st.test) return; veil.set(`Essai simulé : ${b.whole ? "la carte entière" : BLOCKS[b.template].name}…`, {}); setStatus("Simulation…", "busy");
    setTimeout(() => { if (!st.alive) return; let sheet = null; try { sheet = b.whole ? boardSheet(board(), st.test) : testSheet(b.template, st.test, b.params || {}, { refs: refsOf(b), name: `${b.name || BLOCKS[b.template].name} (${b.id})` }); } catch (e) { toast(`Essai : ${e.message}`, "error", 8000); }
      veil.set(""); if (!sheet) { setStatus("Essai impossible", "error"); return; } st.sheet = { ...sheet, blockId: b.id }; st.q = 0; st.netMap = b.whole ? {} : Object.fromEntries(sheet.result.built.nets.map((n) => [n.name, netOf(b, sheet.result.built, n.name)]));
      setStatus(sheet.ok ? "Essai simulé" : "Essai non abouti", sheet.ok ? "done" : "error"); pcb.show(resolveBoard(board(), LIBRARY), b.whole ? {} : { focus: new Set(Object.values(refsOf(b))) }); centre(); renderRight(); renderLeft(); paint(); tell(); }, 30);
  }
  function centre() {
    const R = st.sheet && st.sheet.result; clear(scopes); clear(bar); S1 = S2 = BD = null; if (!R) return;
    const scoped = st.sheet.gearIds.includes("scope"), map = scoped ? [] : screenToBench(st.sheet), endOf = (ch) => (map.find((m) => m.ch === ch && m.value) || {}).value || null;      // a test done with a multimeter : the END of each curve is the number it shows
    const bench = (text) => { const b = btn("Pourquoi ?", () => { st.tab = "sheet"; renderRight(); const x = right.querySelector('[data-box="bench"]'); if (x) { x.scrollIntoView({ block: "start" }); nudge(x); } }, { small: true, icon: "info", tip: "Ce que l'écran montre, ce que l'on fait au vrai banc, et pourquoi les deux diffèrent" }); return el("p", { class: "atelier-hint lab-bench-note", "data-bench-note": scoped ? "scope" : "meter" }, icon("sensor"), el("span", { class: "grow" }, text), b); };
    if (R.kind === "tran") { S1 = scope({ ch: 1, label: R.ch1.label, color: "#ffd60a", end: endOf(1) }); S2 = scope({ ch: 2, label: R.ch2.label, color: "#5ac8fa", end: endOf(2) }); scopes.append(S1.node, S2.node, bench(scoped ? " Au vrai banc, l'oscilloscope montre ces mêmes courbes : une sonde par voie, posée où la fiche le dit." : " Au vrai banc, cet essai se fait au multimètre : pas de courbe — UN chiffre par courbe, sa fin (l'anneau blanc, à droite).")); }
    else if (R.kind === "ac") { BD = bode(); scopes.append(BD.node, bench(" Au vrai banc, cette courbe se refait point par point : une fréquence, une mesure, puis la suivante.")); }
    else scopes.append(el("p", { class: "atelier-hint lab-none" }, icon("info"), " Essai hors tension : rien ne circule, rien à simuler. La fiche, à droite, dit où poser les pointes du multimètre."));
    if (R.kind === "none") return;
    const play = btn(st.playing ? "Pause" : "Rejouer", () => { st.playing = !st.playing; centre(); }, { small: true, icon: st.playing ? "minus" : "play", tip: "Espace : arrêter ou relancer la lecture" }); play.dataset.play = "";
    bar.append(play, el("input", { type: "range", min: 0, max: 1000, value: Math.round(st.q * 1000), "data-pos": "", "aria-label": "Position dans l'essai", onInput: (e) => { st.playing = false; st.q = Number(e.target.value) / 1000; paint(); const p = bar.querySelector("[data-play]"); if (p) p.lastChild.textContent = "Rejouer"; } }),
      el("label", { class: "lab-speed" }, "Vitesse", el("select", { "data-speed": "", onChange: (e) => { st.speed = Number(e.target.value); } }, [[0.25, "÷ 4"], [0.5, "÷ 2"], [1, "× 1"], [2, "× 2"]].map(([v, l]) => el("option", { value: v, selected: v === st.speed }, l)))),
      el("span", { class: "chip", "data-window": "" }, R.kind === "tran" ? `Fenêtre : ${eng(R.t[R.t.length - 1] - R.t[0], "s")} — rejouée au ralenti` : `De ${eng(R.ac.f[0], "Hz")} à ${eng(R.ac.f[R.ac.f.length - 1], "Hz")}`));
  }
  const guide = () => { const out = labGuide(board()).map((g) => ({ ...g })), s = st.sheet; if (s) { if (!s.ok) out.unshift({ level: "error", text: `${s.title} : la simulation n'a pas abouti — le montage de cet essai est à revoir.`, field: "lab" });
      const k = key(), L = labOf(board()); for (const r of s.rows) { const x = L.readings.find((q) => q.test === k && q.what === r.label); if (x && verdict(r, x.value) === "out") out.unshift({ level: "warn", text: `${s.title} — « ${r.label} » : ${eng(x.value, r.unit)} mesuré, hors de la plage attendue (${r.band.text}).`, field: "lab", go: () => { st.tab = "read"; renderRight(); const f = right.querySelector(`[data-read="${CSS.escape(r.label)}"]`); if (f) nudge(f); } }); } }
    return out; };
  const tell = () => setGuide(guide());
  function pick(blockId, testId) { st.block = blockId; const b = cur(), tests = testsOf(b); if (b && b.whole && !testId && tests.length) testId = tests[0].id; st.test = testId && tests.some((t) => t.id === testId) ? testId : (["dynamic", "bus", "function", "frequency"].map((n) => tests.find((t) => t.nature === n)).find(Boolean) || tests.find((t) => !t.noSim && t.nature !== "power") || tests[0] || {}).id || null; st.playing = true; renderLeft(); run(); }
  /* the plan : every test of the board is simulated, one at a time — the veil says which, and « Annuler » stops between two */
  async function plan(kind) {
    try { const b = board(), jobs = sheetJobs(b), pause = () => new Promise((ok) => setTimeout(ok, 0));
      const sheets = await underVeil(pageVeil(), "Plan de test : simulation de chaque essai…", async (say, signal) => { const out = [];
        for (let i = 0; i < jobs.length; i++) { say(`Plan de test — essai ${i + 1} / ${jobs.length} : ${jobs[i].name}, ${jobs[i].title}`, i, jobs.length); await pause(); if (signal.off) return null; const s = jobSheet(jobs[i]); if (s) out.push(s); }
        say("Plan de test : écriture du document…", jobs.length, jobs.length, { hold: true }); await pause(); return out; }, { kernel: false, cancelled: "Plan de test annulé : aucun fichier n'a été enregistré." });
      if (!sheets) return; st.sheets = sheets;
      const doc = labPlanDoc(b, { date: new Date(), project: { id: store.project.id, name: store.project.name }, sheets }), name = `${b.id}-rev${b.revision || "A"}-plan-de-test`, full = { ...doc, kind: "Plan de test fonctionnel", ...docMeta() };
      if (kind === "docx") download(`${name}.docx`, docx(full), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); else download(`${name}.pdf`, pdfDoc(full), "application/pdf");
      toast(`Plan de test : ${doc.sheets.length} fiches, enregistré.`, "success", 5000); } catch (e) { toast(`Plan de test : ${e.message}`, "error", 8000); }
  }
  /* the test chosen, done at the real bench : one step per screen, pointed at the board (modules/elab_manip.js) */
  function manip() { const s = st.sheet, k = key(); if (!s || !k) return; st.playing = false; centre(); st.manip = openManip({ boardId: id, key: k, sheet: s, pdf: manipPdf, onClose: () => { st.manip = null; const b = left.querySelector("[data-manip]"); if (b) b.focus(); } }); }
  /* the procedure on paper — a picture of the board per step ; filled with what the notebook of the board holds, it is the report (pcba/lab_manip_doc.js) */
  async function manipPdf(all) {
    try { const b = board(), R = resolveBoard(b, LIBRARY), pause = () => new Promise((ok) => setTimeout(ok, 0)); let sheets = st.sheet ? [st.sheet] : [];
      if (all) { const jobs = sheetJobs(b); sheets = await underVeil(pageVeil(), "Manipulations : simulation de chaque essai…", async (say, signal) => { const out = []; for (let i = 0; i < jobs.length; i++) { say(`Manipulations — essai ${i + 1} / ${jobs.length} : ${jobs[i].name}, ${jobs[i].title}`, i, jobs.length); await pause(); if (signal.off) return null; const s = jobSheet(jobs[i]); if (s) out.push({ ...s, blockId: jobs[i].blockId }); } say("Manipulations : écriture du document…", jobs.length, jobs.length, { hold: true }); await pause(); return out; }, { kernel: false, cancelled: "Manipulations : aucun fichier n'a été enregistré." }); if (!sheets) return; }
      if (!sheets.length) return; const d = manipDoc(b, R, sheets, { date: new Date(), project: { id: store.project.id, name: store.project.name } }); download(`${d.name}.pdf`, pdfDoc({ ...d, kind: "Manipulations en laboratoire", ...docMeta() }), "application/pdf"); toast(`Manipulations : ${sheets.length} essai${sheets.length > 1 ? "s" : ""}, enregistré.`, "success", 5000);
    } catch (e) { toast(`Manipulations : ${e.message}`, "error", 8000); }
  }
  const request = () => { const b = board(), s = st.sheet; return ["Tu es l'assistant de conception de DesignWizard.ai. Voici une carte électronique et, plus bas, la fiche d'un essai de laboratoire préparé par simulation. Seul le bloc « lab » de la carte se modifie.",
    "TA TÂCHE — relis l'essai comme le ferait un ingénieur d'essais : ce qui manque au montage, une étape risquée, une valeur attendue qui te paraît fausse, un essai à mettre de côté. Dis-le en quelques lignes, puis attends mon accord.",
    "RÉPONSE ATTENDUE — un seul bloc ```dwiz avec la carte entière, bloc « lab » à jour : une ligne « note » par remarque (test = « bloc/essai », text = ta remarque en une phrase), une ligne « skip » par essai à mettre de côté (test). Ne change ni les pièces, ni les nets, ni les relevés (lignes « reading » : ce sont des mesures faites au laboratoire).",
    "", s ? `ESSAI — ${s.block} : ${s.title} (${key()})\nPourquoi : ${s.why}\nÀ quoi s'attendre : ${s.expect}\nMontage :\n- ${s.setup.join("\n- ")}\nRelevés attendus :\n- ${s.rows.map((r) => `${r.label} : ${expectedText(r)} (${r.ceiling ? "plafond : " : "plage "}${r.band.text})`).join("\n- ")}` : "", "", toDwiz(b).trimEnd()].join("\n"); };
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient la carte dans un bloc ```dwiz." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; store.updateBoard(id, (b) => { b.lab = next; }, "Labo : notes de l'IA"); m.close(); toast("Notes et mises de côté reprises de la réponse de l'IA.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const doc = aiRead(area.value); if (!doc || !doc.lab) throw new Error("La réponse ne contient pas de bloc « lab »."); const mine = labOf(board()), theirs = labOf(doc), d = { ...theirs, readings: mine.readings, ticks: mine.ticks, passes: mine.passes, notes: [...theirs.notes.filter((n) => !n.step), ...mine.notes.filter((n) => n.step)] }, diff = aiDiff(mine, d);      // what was read, ticked, let pass and noted at the bench is the lab's : an answer cannot rewrite it
        out.append(el("p", null, diff.length ? `${diff.length} changement(s) :` : "Aucun changement."), el("ul", { class: "decisions" }, diff.slice(0, 30).map((x) => el("li", null, `${x.path} — ${x.text}`)))); if (diff.length) { next = d; ok.disabled = false; }
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal("Réimporter les notes du laboratoire depuis une IA", [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function renderLeft() {
    clear(left); const b = cur(), all = blocks();
    left.append(el("div", { class: "side-head" }, el("h2", null, "Labo"))      /* the step up to the PCBA of this board comes with every screen : core/stairs.js */,
      el("div", { class: "side-actions" }, (() => { const m = btn("Manipulation en labo", () => manip(), { primary: true, small: true, icon: "play", disabled: !st.sheet, tip: "L'essai choisi, fait au vrai banc : une étape par écran, pointée sur la carte, en plein écran — relevés et notes gardés dans le carnet de la carte" }); m.dataset.manip = ""; return m; })(), btn("Plan de test (.docx)", () => plan("docx"), { small: true, icon: "download", tip: "Le plan de test fonctionnel de la carte : une fiche par essai — comprendre, puis faire — au gabarit des documents" }), btn("PDF", () => plan("pdf"), { small: true, icon: "pdf", tip: "Le même plan, en PDF" })));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    if (boards.length > 1) scroll.append(el("div", { class: "side-section", "data-fold-note": String(boards.length) }, el("h3", null, "La carte"), boards.map((x) => el("a", { class: "nav-item" + (x.id === id ? " active" : ""), href: `#/elab/${encodeURIComponent(x.id)}` }, icon("chip"), el("span", { class: "grow" }, x.name || x.id)))));
    scroll.append(el("div", { class: "side-section", "data-box": "block", "data-fold-note": !b ? "à choisir" : b.whole ? "la carte entière" : b.name || BLOCKS[b.template].name }, el("h3", null, "Le bloc à l'essai"),
      boardTests(board()).length ? [el("p", { class: "ft-label rd-group", style: "--dom:#0f172a" }, "Ensemble"), el("div", { class: "cf-tiles lab-blocks" }, tile({ sel: whole(), color: "#0f172a", label: "La carte entière", small: "tous les blocs reliés", tip: "Les blocs simulés ensemble, reliés par les nets de la carte : l'alimentation de laboratoire à l'entrée, chaque rail né du précédent", pic: icon("pcb", "lab-cat"), data: { "data-block": BOARD_KEY }, run: () => pick(BOARD_KEY) }))] : null,
      all.length ? BLOCK_CATEGORIES.filter((c) => all.some((x) => BLOCKS[x.template].category === c)).map((c) => [el("p", { class: "ft-label rd-group", style: `--dom:${CAT[c][0]}` }, c), el("div", { class: "cf-tiles lab-blocks" }, all.filter((x) => BLOCKS[x.template].category === c).map((x) => tile({ sel: x.id === st.block, color: CAT[c][0], label: x.name || BLOCKS[x.template].name, small: x.id, tip: BLOCKS[x.template].desc, pic: icon(CAT[c][1], "lab-cat"), data: { "data-block": x.id }, run: () => pick(x.id) })))])
        : el("p", { class: "atelier-hint" }, icon("info"), " Cette carte n'a pas encore de bloc : ajoutez-en dans le PCBA.")));
    if (b) { const tests = testsOf(b);
      scroll.append(el("div", { class: "side-section", "data-box": "test", "data-fold-note": `${tests.length}` }, el("h3", null, "L'essai"), tests.length ? el("div", { class: "lab-tests" }, tests.map((t) => { const N = NATURES.find((n) => n.id === t.nature), k = testKey(b.id, t.id), off = skipped(board(), k);
        return el("div", { class: `lab-test${t.id === st.test ? " sel" : ""}${off ? " off" : ""}`, style: `--dom:${N.color}`, "data-test": t.id }, onOff(!off, (on) => store.updateBoard(id, (x) => { x.lab = setSkip(x, k, !on); }, `Essai ${on ? "repris dans" : "mis de côté du"} plan`), t.title, off ? "Cet essai est de côté : il n'est pas dans le plan — cliquer pour le reprendre" : "Cet essai est dans le plan — cliquer pour le mettre de côté"),
          el("button", { class: "lab-test-name", type: "button", "aria-pressed": t.id === st.test ? "true" : "false", onClick: () => pick(b.id, t.id) }, naturePic(t.nature), el("span", null, el("b", null, t.title), el("small", null, `${N.label} — ${N.fr}`)))); })) : el("p", { class: "atelier-hint" }, icon("info"), " Aucun essai n'est écrit pour ce bloc.")));
    }
    const g = guideBox(guide(), { title: "Ce que le laboratoire demande", quiet: "Rien à signaler sur cet essai." }); if (g) scroll.append(el("div", { class: "side-section" }, el("h3", null, "À régler"), g));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Avec une IA"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier pour une IA", async () => toast((await copyText(request())) ? "Copié : la carte, la fiche de l'essai et la consigne." : "Copie impossible.", "success", 5000), { small: true, icon: "sparkle", tip: "Faire relire l'essai : la carte, la fiche et la consigne" }), btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))));
  }
  function renderRight() {
    clear(right); stateNodes = []; const s = st.sheet;
    right.append(el("div", { class: "side-head" }, el("h2", null, s ? s.title : "L'essai")), el("div", { class: "subtabs", style: { margin: "0 .6rem" }, role: "tablist" }, [["sheet", "Fiche"], ["read", "Relevés"]].map(([k, l]) => el("button", { class: "subtab" + (st.tab === k ? " active" : ""), type: "button", role: "tab", "aria-selected": st.tab === k ? "true" : "false", "data-tab": k, onClick: () => { st.tab = k; renderRight(); paint(); } }, l))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (!s) { body.append(el("p", { class: "atelier-hint" }, icon("info"), " Choisissez un bloc, à gauche : son essai se joue ici.")); return; }
    const sec = (title, note, ...kids) => { const x = el("div", { class: "side-section", "data-fold-note": note }, el("h3", null, title), ...kids.flat().filter(Boolean)); body.append(x); return x; }, R = s.result, k = key(), L = labOf(board()), note = L.notes.filter((n) => n.test === k && !n.step);
    if (st.tab === "sheet") {
      body.append(el("p", { class: "lab-nature", style: `--dom:${s.nature.color}` }, naturePic(s.nature.id), el("span", null, el("b", null, `${s.nature.label} — ${s.nature.fr}`), el("small", null, `${s.block} · ${s.gear.map((g) => g.label).join(", ")} · ${s.minutes} min au laboratoire`))));
      sec("Comprendre", "pourquoi, à quoi s'attendre", el("p", { class: "lab-why" }, el("b", null, "Pourquoi cet essai. "), s.why), el("p", { class: "lab-why" }, el("b", null, "À quoi s'attendre. "), s.expect), note.map((n) => el("p", { class: "lab-note" }, icon("sparkle"), " ", n.text)));
      sec("L'écran et le vrai banc", "ce qui change", el("p", { class: "muted small" }, "L'écran est une simulation : il connaît chaque fil, à chaque instant. Le banc est une vraie carte, lue avec un appareil à la fois."), benchTable(s), el("p", { class: "ft-label" }, "Pourquoi ce n'est pas pareil"), whyList(s)).dataset.box = "bench";
      if (s.setup.length) sec("Le montage", `${s.setup.length} branchement(s)`, el("ul", { class: "lab-list" }, s.setup.map((t) => el("li", null, t))));
      if (s.settings.length) sec("Les réglages", `${s.settings.length}`, el("ul", { class: "lab-list" }, s.settings.map((t) => el("li", null, t))));
      sec("Les étapes", `${s.steps.length}`, el("ol", { class: "lab-list" }, s.steps.map((t) => el("li", null, t))));
      sec("Si le résultat s'écarte", "", el("ul", { class: "lab-list" }, s.traps.map((t) => el("li", null, t))), el("p", { class: "lab-why" }, el("b", null, "À retenir. "), s.learn));
      if (s.notes.length) sec("Hypothèses de la simulation", `${s.notes.length}`, el("ul", { class: "lab-list muted" }, s.notes.map((t) => el("li", null, t))), el("p", { class: "muted small" }, "Comportements typiques : la fiche technique du composant monté fait foi. ", el("a", { href: "#/help/sources/elec" }, "Sources")));
    } else {
      if (R.states && R.states.length) sec("États", "en direct", el("div", { class: "lab-states" }, R.states.map((x) => { const n = el("span", { class: `lab-state ${x.kind}`, "data-state-row": x.part }, el("i"), el("b", null, `${x.label} (${(cur() && !cur().whole ? refsOf(cur()) : {})[x.part] || x.part})`), " —"); stateNodes.push(n); return n; })));
      sec("Relevés", `${s.rows.length}`, el("p", { class: "muted small" }, "« Attendu » : ce que la simulation donne avec ce montage. « Mesuré » : ce que vous lisez au vrai laboratoire — la valeur se tape dans l'unité affichée."),
        el("div", { class: "lab-rows" }, s.rows.map((r) => { const x = L.readings.find((q) => q.test === k && q.what === r.label), U = unitOf(r.ceiling ? r.band.high : r.expected, r.unit), v = verdict(r, x ? x.value : null);
          return el("div", { class: `lab-row ${v}`, "data-row": r.label }, el("b", null, r.label), r.optional ? el("small", { class: "muted" }, `Demande ${r.needs} — facultatif`) : null, el("span", { class: "lab-exp" }, r.ceiling ? "Simulé " : "Attendu ", el("strong", null, expectedText(r)), el("small", null, r.ceiling ? ` · plafond : ${r.band.text}` : ` · plage ${r.band.text}`)),
            r.design !== null && r.design !== undefined ? el("span", { class: "lab-design" }, `Calcul de conception : ${eng(r.design, r.unit)}`, r.gap !== null && Math.abs(r.gap) > 0.15 ? badge(`écart ${gapText(r.gap)}`, "warn") : null) : null,
            el("label", { class: "lab-meas" }, `Mesuré (${U.label || "—"})`, el("input", { type: "number", step: "any", value: x ? String(+(x.value * U.k).toPrecision(6)) : "", "data-read": r.label, onChange: (e) => { const raw = e.target.value.trim(), val = raw === "" ? null : Number(raw.replace(",", ".")) / U.k; store.updateBoard(id, (b) => { b.lab = setReading(b, k, r.label, val); }, `Relevé : ${r.label}`); } }), v === "ok" ? badge("conforme", "ok") : v === "out" ? badge("hors plage", "bad") : null)); })));
      if (s.table) sec(`Selon ${s.table.label.toLowerCase()}`, `${s.table.rows.length} points`, el("table", { class: "data lab-table" }, el("thead", null, el("tr", null, el("th", null, `${s.table.label} (${s.table.unit})`), el("th", null, `${s.table.rows[0].col} — attendu`))), el("tbody", null, s.table.rows.map((q) => el("tr", null, el("td", null, String(+(+q.x).toPrecision(4)).replace(".", ",")), el("td", null, eng(q.y, q.unit)))))));
      if (R.kind === "ac") sec("Fonction de transfert", "", el("p", { class: "lab-why" }, `Coupure à −3 dB : ${eng(R.cut, "Hz")}. Gain aux basses fréquences : ${String(+R.ac.gain[0].toPrecision(3)).replace(".", ",")}.`));
    }
  }
  const onKey = (e) => { if (e.key === " " && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement && document.activeElement.tagName) && st.sheet) { e.preventDefault(); st.playing = !st.playing; centre(); } };
  document.addEventListener("keydown", onKey);
  const off = store.on("change", () => { if (!store.board(id)) { go("#/elab"); return; } if (st.block && !cur()) { st.block = null; st.sheet = null; } renderLeft(); renderRight(); tell(); paint(); });
  pcb.show(resolveBoard(board(), LIBRARY)); renderLeft(); renderRight(); tell(); st.raf = requestAnimationFrame(tick);
  const lively = (b, natures) => blockTests(b.template).some((t) => natures.includes(t.nature)), cyc = blocks().find((b) => blockTests(b.template).some((t) => t.id === "ripple")), first = cyc || blocks().find((b) => lively(b, ["dynamic", "bus"])) || blocks().find((b) => lively(b, ["function", "frequency", "static"])) || blocks()[0]; if (first) pick(first.id, cyc ? "ripple" : undefined);      // it opens on a test where something moves — a chopper first : tracks that beat, a square wave, a ripple
  view._lab = { st, run, labStatus: () => labStatus(board(), st.sheets || (st.sheets = boardSheets(board()))) };      // for whoever inspects the page (tests, the console)
  return () => { st.alive = false; if (st.manip) st.manip.close(); cancelAnimationFrame(st.raf); document.removeEventListener("keydown", onKey); off(); setGuide([]); veil.dispose(); pcb.destroy(); };
}
registerModule({ key: "elab", label: "Labo", icon: "sensor", tip: "Laboratoire d'électronique : chaque bloc de la carte sur un banc simulé — pistes qui s'allument, oscilloscopes — et le plan de test fonctionnel", render });
