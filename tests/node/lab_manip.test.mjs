// Labo, « Manipulation en labo » : a test of the plan as the steps one does at the bench — their order, the pads they point
// at, the locks, what the notebook of the board keeps, and the screen that shows them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { boardSheets, labOf, testKey, setTick, setPass, setNote, setReading } from "../../web/js/pcba/lab_plan.js";
import { manipSteps, manipState, lockReason, placedPoints, padOf, readingSays, readUnit, LEADS } from "../../web/js/pcba/lab_manip.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { NEWS } from "../../web/js/core/whats_new.js";
import { manipDoc, manipBlocks, stepFigure } from "../../web/js/pcba/lab_manip_doc.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const board = demoBoard(), sheets = boardSheets(board), R = resolveBoard(board, LIBRARY);
const at = (S, id) => S.findIndex((s) => s.id === id), kinds = (S) => S.map((s) => s.kind);

test("the steps of every test of the demo board : the order that protects the board", () => {
  assert.ok(sheets.length >= 20);
  for (const s of sheets) { const S = manipSteps(s), ids = S.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${s.id} : each step has its own id`);
    assert.equal(S[0].kind, "safety", `${s.id} starts with what to check before touching the board`); assert.equal(S[S.length - 1].kind, "off", `${s.id} ends with the power off`);
    assert.equal(S.filter((x) => x.kind === "read").length, s.rows.length, `${s.id} : one step per reading`);
    assert.ok(S.every((x) => x.title && x.text && ["tick", "reading"].includes(x.needs)), `${s.id} : every step says what to do`);
    if (s.noSim) { assert.ok(!kinds(S).includes("power"), `${s.id} is done with the board off : no power step`); continue; }
    const power = S.findIndex((x) => x.kind === "power"), guard = at(S, "guard"), firstRead = S.findIndex((x) => x.kind === "read"), connects = S.map((x, i) => (x.id.startsWith("con-") ? i : -1)).filter((i) => i >= 0), sets = S.map((x, i) => (x.id.startsWith("set-") ? i : -1)).filter((i) => i >= 0), fed = s.links.some((l) => l.instr === "supply");
    assert.ok(power > 0 && guard > 0 && guard < power, `${s.id} : the search for a short circuit comes before the power`);
    assert.ok(sets.length > 0 && sets.every((i) => i < Math.min(...connects)), `${s.id} : every source is set before anything is connected`);
    assert.equal(S[power].id, fed ? "power" : "gen-on", `${s.id} : what powers the circuit is the supply, or the generator when there is none`); assert.equal(S.filter((x) => x.danger).length, 1, `${s.id} : one step is the moment of the power`); assert.equal(S[S.length - 1].gear.kind, fed ? "supply" : "generator");
    assert.ok(connects.every((i) => i < power), `${s.id} : every lead of a source is on the board before the power`);
    assert.ok(firstRead < 0 || firstRead > power, `${s.id} : one reads once the board is powered`);
    assert.equal(S[power].gear.on, true); assert.equal(S[sets[0]].gear.on, false, "a source is set with its output off");
  }
});

test("a step points at the board : every point named on a part is a pad one can find", () => {
  let n = 0, named = 0;
  for (const s of sheets) for (const step of manipSteps(s)) for (const p of step.points) { n++; assert.ok(LEADS[p.lead], `${s.id}/${step.id} : a lead one knows`); if (!p.ref) continue; named++; assert.ok(padOf(R, p), `${s.id}/${step.id} : ${p.ref}.${p.pin} is a pad of the board`); }
  assert.ok(n > 200 && named / n > 0.95, `${named} points on ${n} are pads of the board`);
  const s = sheets.find((x) => !x.noSim && x.links.some((l) => l.instr === "supply")), con = manipSteps(s).find((x) => x.id === "con-supply-0"), pp = placedPoints(R, con);
  assert.deepEqual(con.points.map((p) => p.lead), ["minus", "plus"], "the black lead first");
  assert.ok(pp.points.every((p) => p.at && p.color && p.label && p.word) && pp.box, "each point has its place, its colour and its word");
  const w = pp.box[2] - pp.box[0], bw = Math.max(R.bbox[2] - R.bbox[0], R.bbox[3] - R.bbox[1]); assert.ok(w >= 0.39 * bw && w <= 1.2 * bw, "the view keeps enough of the board around the points to know where one is");
  assert.ok(pp.points.every((p) => p.at.x > pp.box[0] && p.at.x < pp.box[2] && p.at.y > pp.box[1] && p.at.y < pp.box[3]), "and the points are inside it");
  assert.deepEqual(placedPoints(R, { points: [] }), { points: [], box: null }); assert.equal(padOf(R, { ref: "ZZ9", pin: "1" }), null);
  /* a voltage is read between two points : the black tip is shown too */
  const v = sheets.flatMap((x) => manipSteps(x).filter((q) => q.kind === "read" && !x.noSim && x.rows[q.row].unit === "V" && x.rows[q.row].points.length === 1)); assert.ok(v.length > 5 && v.every((q) => q.points.length === 2), "a voltage read at one point shows the ground tip as well");
  /* a continuity is read between the pin and its net */
  const c = sheets.find((x) => x.noSim); assert.ok(manipSteps(c).filter((q) => q.kind === "read").every((q) => q.points.length >= 1 && q.gear.mode === "cont"));
});

test("the locks : a step opens when the ones before it are done, and a reading out of its band stops the test", () => {
  const s = sheets.find((x) => x.test === "power" && x.rows.length >= 2), S = manipSteps(s), key = testKey(s.blockId, s.test); let b = { ...board, lab: undefined };
  let st = manipState(s, S, labOf(b), key); assert.equal(st.at, 0); assert.deepEqual([st.steps[0].state, st.steps[1].state, st.done, st.finished, st.stopped], ["now", "locked", 0, false, null]);
  assert.match(lockReason(st, 3), /D'abord : « Avant de toucher la carte »/); assert.equal(lockReason(st, 0), "");
  /* ticking out of order opens nothing : the step before still waits */
  b = { ...b, lab: setTick(b, key, S[2].id, true) }; st = manipState(s, S, labOf(b), key); assert.equal(st.at, 0); assert.equal(st.steps[2].state, "locked", "a tick ahead of its turn does not count");
  const first = S.findIndex((x) => x.needs === "reading");
  for (let i = 0; i < first; i++) b = { ...b, lab: setTick(b, key, S[i].id, true, "2026-11-20T10:00:00.000Z") };
  st = manipState(s, S, labOf(b), key); assert.equal(st.at, first); assert.equal(st.done, first); assert.equal(st.steps[first].state, "now");
  const row = s.rows[S[first].row];
  /* out of its band : stopped, and the next step says why */
  b = { ...b, lab: setReading(b, key, row.label, row.band.high * 3 + 1) }; st = manipState(s, S, labOf(b), key);
  assert.equal(st.stopped, S[first].id); assert.equal(st.steps[first].verdict, "out"); assert.equal(st.steps[first + 1].state, "locked"); assert.match(lockReason(st, first + 1), /hors de sa plage : l'essai est arrêté/);
  const says = readingSays(row, row.band.high * 3 + 1); assert.equal(says.v, "out"); assert.match(says.action, /COUPEZ l'alimentation/); assert.match(says.action, /on ne corrige jamais un relevé/);
  /* a supervisor lets it pass, by name : the test goes on, and the notebook says who */
  assert.equal(labOf({ lab: setPass(b, key, S[first].id, "  ", "sans nom") }).passes.length, 0, "a pass without a name is not a pass");
  b = { ...b, lab: setPass(b, key, S[first].id, "A. Tremblay", "mesure refaite au second multimètre", "2026-11-20T10:05:00.000Z") }; st = manipState(s, S, labOf(b), key);
  assert.equal(st.stopped, null); assert.equal(st.steps[first].state, "done"); assert.equal(st.steps[first].pass.by, "A. Tremblay"); assert.equal(st.at, first + 1);
  /* inside its band : done without anyone */
  const r2 = s.rows[S[first + 1].row]; b = { ...b, lab: setReading(b, key, r2.label, r2.expected) }; st = manipState(s, S, labOf(b), key); assert.equal(st.steps[first + 1].verdict, "ok"); assert.equal(readingSays(r2, r2.expected).v, "ok");
  /* to the end */
  for (const x of S) { if (x.needs === "tick") b = { ...b, lab: setTick(b, key, x.id, true) }; else { const r = s.rows[x.row]; if (!labOf(b).readings.some((q) => q.test === key && q.what === r.label)) b = { ...b, lab: setReading(b, key, r.label, r.expected) }; } }
  st = manipState(s, S, labOf(b), key); assert.ok(st.finished && st.done === S.length);
  /* unticking a step closes the ones after it */
  b = { ...b, lab: setTick(b, key, S[1].id, false) }; st = manipState(s, S, labOf(b), key); assert.equal(st.at, 1); assert.equal(st.steps[2].state, "locked"); assert.ok(!st.finished);
  /* another test of the board is not touched */
  const other = sheets.find((x) => x !== s && !x.noSim), k2 = testKey(other.blockId, other.test); assert.equal(manipState(other, manipSteps(other), labOf(b), k2).done, 0);
});

test("the notebook of the board : ticks, passes and the notes of a step are kept, and travel in a .dwiz", () => {
  const s = sheets.find((x) => x.test === "power"), key = testKey(s.blockId, s.test); let b = { ...board };
  b = { ...b, lab: setTick(b, key, "safety", true, "2026-11-20T10:00:00.000Z") }; b = { ...b, lab: setPass(b, key, "read-0", "A. Tremblay", "refait", "2026-11-20T10:05:00.000Z") };
  b = { ...b, lab: { ...labOf(b), notes: [{ test: key, text: "Remarque d'une revue." }] } }; b = { ...b, lab: setNote(b, key, "power", "Le courant monte à 12 mA puis redescend.") };
  let L = labOf(b); assert.deepEqual(L.ticks, [{ test: key, step: "safety", when: "2026-11-20T10:00:00.000Z" }]); assert.equal(L.notes.length, 2, "the note of a step leaves the remark of a review alone");
  b = { ...b, lab: setNote(b, key, "power", "Corrigé.") }; L = labOf(b); assert.deepEqual(L.notes.filter((n) => n.step).map((n) => n.text), ["Corrigé."], "one note per step"); assert.equal(L.notes.filter((n) => !n.step).length, 1);
  b = { ...b, lab: setNote(b, key, "power", "  ") }; assert.equal(labOf(b).notes.length, 1, "an empty note is taken away");
  b = { ...b, lab: setNote(b, key, "power", "Le courant monte à 12 mA.") };
  const back = fromDwiz(toDwiz(b)), LB = labOf(back); assert.deepEqual(LB.ticks, labOf(b).ticks); assert.deepEqual(LB.passes, labOf(b).passes); assert.deepEqual(LB.notes, labOf(b).notes);
  assert.match(toDwiz(b), /\n\s*tick /); assert.match(toDwiz(b), /\n\s*pass /);
  assert.deepEqual(labOf({ lab: { ticks: [{ test: 3 }, { test: "a", step: 4 }], passes: [{ test: "a", step: "s" }] } }), { gears: [], readings: [], skips: [], notes: [], ticks: [], passes: [] }, "what is not whole is dropped");
});

test("a reading is typed in the unit one reads it in", () => {
  assert.deepEqual(readUnit(0.0033, "A"), { k: 1e3, label: "mA" }); assert.deepEqual(readUnit(24, "V"), { k: 1, label: "V" }); assert.deepEqual(readUnit(4700, "Ω"), { k: 1e-3, label: "kΩ" }); assert.deepEqual(readUnit(2e-5, "s"), { k: 1e6, label: "µs" }); assert.deepEqual(readUnit(0, "V"), { k: 1, label: "V" }); assert.deepEqual(readUnit(5, ""), { k: 1, label: "" });
  assert.deepEqual(readingSays({ band: { low: 1, high: 2, text: "1 à 2" } }, null), { v: "none", text: "", action: "" });
});

test("the screen : a dialog over the Labo, one action per step, nothing an answer of an AI can rewrite", () => {
  const screen = read("web/js/modules/elab_manip.js"), lab = read("web/js/modules/elab.js"), view = read("web/js/modules/elab_view.js"), gear = read("web/js/modules/elab_gear.js"), css = read("web/css/pcba.css");
  for (const [name, src] of [["elab_manip", screen], ["elab", lab], ["elab_view", view], ["elab_gear", gear], ["lab_manip", read("web/js/pcba/lab_manip.js")], ["lab_plan", read("web/js/pcba/lab_plan.js")], ["lab_bench", read("web/js/pcba/lab_bench.js")]]) assert.ok(src.split("\n").length < 500, `${name} stays under 500 lines`);
  assert.match(screen, /role: "dialog", "aria-modal": "true"/); assert.match(screen, /e\.key === "Escape"/); assert.match(screen, /requestFullscreen/); assert.match(screen, /if \(opener && opener\.isConnected/);
  assert.match(screen, /store\.updateBoard\(id, \(b\) => \{ b\.lab = fn\(b\); \}, label\)/, "every tick, reading and note is one step of the store");
  assert.match(screen, /if \(down\) pending = true; else later\(\)/, "the screen is redrawn after the click, not under it");
  assert.ok(!/fetch\(|XMLHttpRequest|SpeechRecognition|getUserMedia/.test(screen), "no service is called, no microphone is opened : a note is a text field");
  assert.match(lab, /m\.dataset\.manip = ""/); assert.match(lab, /openManip\(\{ boardId: id, key: k, sheet: s/);
  assert.match(lab, /readings: mine\.readings, ticks: mine\.ticks, passes: mine\.passes, notes: \[\.\.\.theirs\.notes\.filter\(\(n\) => !n\.step\), \.\.\.mine\.notes\.filter\(\(n\) => n\.step\)\]/, "an answer of an AI rewrites neither a reading, nor a tick, nor a pass, nor a note of the bench");
  assert.match(view, /mark\(points = \[\], box = null\)/); assert.match(css, /\.manip \{ position: fixed; inset: 0;/); assert.match(css, /prefers-reduced-motion: reduce\) \{ \.lab-mark-ring \{ animation: none; \}/);
  for (const k of ["supply", "meter", "scope", "generator", "load"]) assert.match(gear, new RegExp(`\\b${k}: \\(g\\) =>`), `the ${k} has its drawing`);
  const gears = new Set(sheets.flatMap((s) => manipSteps(s).map((x) => x.gear && x.gear.kind).filter(Boolean))); assert.deepEqual([...gears].sort(), ["generator", "load", "meter", "scope", "supply"], "and every instrument a step names is one that is drawn");
  assert.ok(NEWS.some((n) => n.id === "lab-manip" && n.sel === "[data-manip]" && n.where === "#/elab"), "what is new is marked on the button");
});

test("on paper : the procedure of a test with a picture of the board per step — empty it is the procedure, filled it is the report", () => {
  const s = sheets.find((x) => x.test === "power" && x.rows.length >= 2), key = testKey(s.blockId, s.test), S = manipSteps(s); let b = { ...board };
  /* the picture of a step : only when the step touches the board ; its marks stay inside the picture */
  const con = S.find((x) => x.id === "con-supply-0"), fig = stepFigure(R, placedPoints(R, con)); assert.ok(fig && fig.width === 120 && fig.height > 20 && fig.height <= 95); assert.match(fig.caption, /le cordon noir \(−\) → /); assert.equal(stepFigure(R, placedPoints(R, S[0])), null, "a step done on the instrument has no picture");
  const calls = []; const rec = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, a]); } }); fig.draw(rec, 10, 20, 120, fig.height);
  const marks = calls.filter(([k, a]) => k === "text" && ["+", "−"].includes(a[2])); assert.equal(marks.length, 2, "one letter per lead"); assert.ok(marks.every(([, a]) => a[0] >= 10 && a[0] <= 130 && a[1] >= 20 && a[1] <= 20 + fig.height), "the marks are inside the picture");
  assert.ok(calls.some(([k, a]) => k === "text" && /^[A-Z]+\d+ · /.test(a[2])), "the pin is written beside its lead"); assert.ok(calls.filter(([k]) => k === "rect").length > 10, "the parts and the pads around are drawn");
  /* empty : boxes to tick, a box per reading, lines for the notes */
  let blocks = manipBlocks(b, R, s), text = JSON.stringify(blocks); assert.equal(blocks.filter((x) => x.type === "h3").length, S.length, "one heading per step"); assert.equal(blocks.filter((x) => x.type === "figure").length, S.filter((x) => stepFigure(R, placedPoints(R, x))).length);
  assert.equal(blocks.filter((x) => x.type === "table" && x.head[0] === "Relevé").length, s.rows.length, "one box per reading"); assert.ok(text.includes("[     ]  Fait.") && text.includes("Notes : ____") && !text.includes("[ X ]")); assert.ok(blocks.some((x) => x.type === "signatures"));
  /* filled : what the notebook of the board holds is on the page */
  for (const id of ["safety", "set-supply-0"]) b = { ...b, lab: setTick(b, key, id, true, "2026-11-20T10:02:00.000Z") }; b = { ...b, lab: setNote(b, key, "safety", "Bracelet vérifié au testeur.") };
  const first = S.find((x) => x.needs === "reading"), row = s.rows[first.row]; b = { ...b, lab: setReading(b, key, row.label, row.band.high * 3 + 1) }; b = { ...b, lab: setPass(b, key, first.id, "A. Tremblay", "mesure refaite", "2026-11-20T10:30:00.000Z") };
  text = JSON.stringify(manipBlocks(b, R, s)); for (const w of ["[ X ]  Fait à 10 h 02.", "Notes : Bracelet vérifié au testeur.", "HORS PLAGE", "Laissé passer par A. Tremblay à 10 h 30 — mesure refaite", "COUPEZ l'alimentation"]) assert.ok(text.includes(w), w);
  /* the document : one test, or the whole plan ; it carries the house template through the PDF writer */
  const one = manipDoc(b, R, [s], { date: new Date(Date.UTC(2026, 10, 20)) }); assert.match(one.name, /-manipulations-e-\d+$/); assert.match(one.reference, /-MANIP-E-\d+$/); assert.ok(one.blocks.some((x) => x.type === "toc"));
  assert.ok(JSON.stringify(one.blocks).includes("comportement TYPIQUE") && JSON.stringify(one.blocks).includes("Les règles de sécurité de votre établissement passent avant ce cahier"));
  const pdf = pdfDoc({ ...one, kind: "Manipulations en laboratoire" }); assert.ok(pdf.length > 20000); assert.equal(String.fromCharCode(...pdf.slice(0, 5)), "%PDF-");
  const all = manipDoc(b, R, sheets.slice(0, 4), {}); assert.equal(all.blocks.filter((x) => x.type === "h1" && /^E-\d+ — /.test(x.text)).length, 4); assert.match(all.name, /-manipulations$/);
  const lab = read("web/js/modules/elab.js"), screen2 = read("web/js/modules/elab_manip.js"); assert.match(lab, /pdf: manipPdf/); assert.match(lab, /cancelled: "Manipulations : aucun fichier n'a été enregistré\."/, "the whole plan is written under the veil, and can be cancelled"); assert.match(screen2, /b\.dataset\.manipPdf = "one"/); assert.match(screen2, /b\.dataset\.manipPdf = "all"/);
  assert.ok(NEWS.some((n) => n.id === "lab-manip-pdf" && n.sel === "[data-manip-pdf]"));
});
