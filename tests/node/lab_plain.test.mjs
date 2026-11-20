/* The Labo, said plainly — and the bench reads what the screen draws (demande de JP : « simplifier et expliquer comme à un enfant de 16 ans…
   il semble y avoir des différences entre les mesures virtuelles du labo et ce qui est demandé dans le labo réel »). */
import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../../web/js/pcba/blocks.js";
import { blockTests } from "../../web/js/pcba/lab_bench.js";
import { testSheet, boardSheets } from "../../web/js/pcba/lab_plan.js";
import { manipSteps, LEADS } from "../../web/js/pcba/lab_manip.js";
import { manipBlocks, manipDoc } from "../../web/js/pcba/lab_manip_doc.js";
import { WORDS, wordsIn, signalSays, plainStep, plainReading, screenToBench, whyDifferent } from "../../web/js/pcba/lab_plain.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { rs485Board } from "../../web/js/demo/demo_rs485.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const every = []; for (const tpl of Object.keys(BLOCKS)) for (const t of blockTests(tpl)) every.push([`${tpl}/${t.id}`, testSheet(tpl, t.id)]);
const node = rs485Board(), sheets = boardSheets(node), mcu = sheets.find((s) => s.tpl === "mcu" && s.test === "power"), gnd = (n) => /GND/i.test(n || "");

test("what the bench reads is what the screen draws : in a test done with a multimeter, every curve has its reading", () => {
  assert.ok(every.length >= 85);
  let meter = 0, ends = 0;
  for (const [id, s] of every) { if (s.noSim || s.gearIds.includes("scope") || s.result.kind !== "tran") continue; meter++;
    for (const r of s.rows) { if (/^(s|Hz)$/.test(r.unit)) assert.ok(r.optional && /oscilloscope/.test(r.needs), `${id} « ${r.label} » : a time is not read with a multimeter — the row asks for an oscilloscope, and is not owed`); if (r.end) ends++; }
    const read = new Set(s.rows.filter((r) => !r.optional).flatMap((r) => r.points.map((p) => p.signal)));
    for (const l of s.links.filter((x) => x.instr === "scope")) assert.ok(read.has(l.to), `${id} : the curve of ${l.to} is read by a row of the sheet`);
    assert.ok(s.rows.findIndex((r) => r.optional) < 0 || s.rows.slice(s.rows.findIndex((r) => r.optional)).every((r) => r.optional), `${id} : what asks for another instrument comes last`);
    assert.doesNotMatch([...s.setup, ...s.settings].join("\n"), /Oscilloscope|sonde ×10/, `${id} lists no oscilloscope in its set-up`); }
  assert.ok(meter >= 40 && ends >= 40, `${meter} tests done with a multimeter, ${ends} curves read at their end`);
  /* the test of JP's screenshot : the first power-up of the microcontroller */
  assert.deepEqual(mcu.rows.map((r) => [r.label, r.unit, !!r.optional, r.end || 0]), [["Courant absorbé sur VDD", "A", false, 0], ["Tension sur VDD, une fois établie", "V", false, 1], ["Tension sur NRST, une fois établie", "V", false, 2], ["Retard de NRST sur l'alimentation (à mi-hauteur)", "s", true, 0]]);
  assert.ok(Math.abs(mcu.rows[1].expected - 3.3) < 0.02 && /^3,13 V à 3,46 V$/.test(mcu.rows[1].band.text)); assert.equal(mcu.rows[3].needs, "un oscilloscope"); assert.match(mcu.steps.join("\n"), /fin de la courbe jaune \(CH1\)/); assert.match(mcu.steps.join("\n"), /« Retard de NRST[^»]*» demande un oscilloscope : si le banc n'en a pas/);
  /* a curve that still moves at its end is what one sweeps by hand : no reading is made of it */
  const sweep = sheets.find((s) => s.test === "thresholds"); assert.ok(sweep && !sweep.rows.some((r) => r.end)); assert.equal(testSheet("ldo", "power").rows.filter((r) => r.end).length, 1, "an output already read is not read twice");
  /* a test with an oscilloscope is left as it was */
  assert.ok(every.filter(([, s]) => s.gearIds.includes("scope")).every(([, s]) => !s.rows.some((r) => r.end || r.scope)));
});

test("the steps : one multimeter, one measure at a time ; the ground clip of an oscilloscope never goes on a signal", () => {
  for (const [id, s] of every) { const S = manipSteps(s), scoped = s.gearIds.includes("scope"), returns = new Set(s.links.filter((l) => /supply|generator|logic/.test(l.instr)).map((l) => l.back));      // where a source already has its return : the reference of that side of the circuit
    if (!scoped) assert.ok(!S.some((x) => /^probe-/.test(x.id)), `${id} : no step puts the tips down for nothing — each reading says where they go`);
    for (const x of S) { for (const p of x.points) { assert.ok(LEADS[p.lead], `${id}/${x.id} : a lead one knows`); if (p.lead === "clip") assert.ok(gnd(p.signal) || returns.has(p.signal), `${id}/${x.id} : the ground clip is on ${p.signal} — it goes on a ground, or where a source already has its return, never on a signal`); }
      if (x.kind === "read" && x.gear && x.gear.kind === "scope") assert.equal(x.points.filter((p) => p.lead === "clip").length <= 1 && x.points.filter((p) => /^probe/.test(p.lead)).length >= 1, true, `${id}/${x.id} : probes on the signals, one clip`); } }
  const S = manipSteps(mcu), read = (re) => S.find((x) => x.kind === "read" && re.test(x.title));
  assert.deepEqual(read(/Tension sur VDD/).points.map((p) => [p.lead, p.signal]), [["black", "GND"], ["red", "VDD"]], "the black tip first, on the ground"); assert.match(read(/Tension sur VDD/).text, /Un seul multimètre, une mesure à la fois/); assert.match(read(/Tension sur NRST/).text, /fin de la courbe bleue \(CH2\)/);
  const delay = read(/Retard de NRST/); assert.equal(delay.gear.kind, "scope"); assert.deepEqual(delay.points.map((p) => [p.lead, p.signal]), [["clip", "GND"], ["probe", "VDD"], ["probe2", "NRST"]]); assert.match(delay.text, /^Demande un oscilloscope : si le banc n'en a pas, passez cette étape/); assert.match(delay.text, /Le temps se lit entre les deux courbes/);
  assert.match(read(/Courant absorbé/).text, /^Lisez le courant sur l'afficheur de l'alimentation et inscrivez-le\./); assert.equal(read(/Courant absorbé/).points.length, 0);
  const tune = S.find((x) => x.id === "tune"); assert.match(tune.text, /borne COM/); assert.doesNotMatch(tune.text, /cycles/, "a multimeter is not set like an oscilloscope");
  /* a difference between two points is read with the two tips ; a threshold swept by hand is WATCHED at one point and read on the supply */
  const idle = manipSteps(sheets.find((s) => s.test === "idle")).find((x) => /Écart A − B/.test(x.title)); assert.deepEqual(idle.points.map((p) => [p.lead, p.signal]), [["red", "A"], ["black", "B"]]); assert.match(idle.text, /l'écart entre les deux/);
  const sw = manipSteps(sheets.find((s) => s.test === "thresholds")).find((x) => x.kind === "read"); assert.deepEqual(sw.points.map((p) => p.lead), ["black", "red"]); assert.match(sw.text, /SURVEILLE/); assert.match(sw.text, /afficheur de l'ALIMENTATION/);
  /* a voltage between two live points — the two ends of a motor winding : never the earthed clip, and the sheet says so */
  const st = testSheet("stepper", "switch"), fl = manipSteps(st).filter((x) => x.float); assert.equal(fl.length, 2); assert.deepEqual(fl[0].points.map((p) => p.lead), ["probeRef", "probe"]); assert.match(fl[0].text, /Ne posez JAMAIS la pince de masse/); assert.match(plainStep(fl[0]), /INTERDITE/); assert.match(st.setup.join("\n"), /sonde différentielle[^\n]*JAMAIS la pince de masse sur A2/); assert.ok(st.links.filter((l) => l.float).length === 2 && !testSheet("opto_in", "switch").links.some((l) => l.float), "where a source has its return is a reference, not a live point");
  /* with an oscilloscope, two signals take two probes */
  const lv = manipSteps(testSheet("rs485", "levels")).find((x) => /Écart A − B pour un 1/.test(x.title)); assert.deepEqual(lv.points.filter((p) => p.lead !== "clip").map((p) => p.lead), ["probe", "probe2"]);
});

test("said plainly : every step of every test has its sentence, and every word of the bench it uses is explained", () => {
  const jargon = /\b(tension|courant|court-circuit|continuité|masse|alimentation|multimètre|oscilloscope|sonde|générateur|antistatique|broche|condensateur)\b/i;
  let n = 0;
  for (const [id, s] of every) for (const x of manipSteps(s)) { n++; const plain = plainStep(x); assert.ok(plain.length > 40 && plain.length < 330, `${id}/${x.id} : a short plain sentence (${plain.length})`); assert.doesNotMatch(plain, /calibre|couplage|déclenchement|impédance|différentiel/i, `${id}/${x.id} : no word of the trade in the plain sentence`);
    const text = [x.title, x.text, ...(x.list || []), x.why].join(" "); if (jargon.test(text)) assert.ok(wordsIn(text).length > 0, `${id}/${x.id} : its words are in the lexicon`);
    if (x.needs === "reading") assert.ok(plainReading(s.rows[x.row]).length > 20); }
  assert.ok(n > 900, `${n} steps`);
  assert.ok(WORDS.length >= 15 && WORDS.every((w) => w.id && w.word && w.en && w.says.length > 60 && w.says.length < 260 && w.re instanceof RegExp)); assert.equal(new Set(WORDS.map((w) => w.id)).size, WORDS.length);
  assert.deepEqual(wordsIn("Bracelet antistatique relié au poste.").map((w) => w.id), ["esd"]); assert.deepEqual(wordsIn(""), []);
  assert.match(WORDS.find((w) => w.id === "tension").says, /pression/); assert.match(WORDS.find((w) => w.id === "courant").says, /débit/);
  /* a signal name says what it is */
  for (const [name, re] of [["GND", /point zéro/], ["NRST", /remise à zéro/], ["VDD", /apporte l'énergie/], ["+3V3", /apporte l'énergie/], ["+24V_IN", /apporte l'énergie/], ["VOUT", /sortie/], ["A", /bus/], ["DE", /c'est moi qui parle/], ["XYZ9", /fil du circuit/]]) assert.match(signalSays(name), re, name);
  for (const s of sheets) for (const x of manipSteps(s)) for (const p of x.points) assert.ok(signalSays(p.signal).length > 10);
});

test("the screen and the bench : how one maps to the other, and why they differ", () => {
  const map = screenToBench(mcu); assert.deepEqual(map.map((m) => m.kind), ["end", "end", "amps", "replay"]);
  assert.match(map[0].screen, /^La courbe jaune \(CH1\) : « VDD »/); assert.match(map[0].bench, /pointe rouge du multimètre sur C3, broche 1, la noire sur la masse : vous lisez UN chiffre, 3,3 V — la fin de la courbe/); assert.equal(map[0].value, "3,3 V"); assert.match(map[1].screen, /bleue \(CH2\) : « NRST »/);
  const why = whyDifferent(mcu); assert.deepEqual(why.map((w) => w.id), ["curves", "slow", "amps", "more", "scope", "typical", "perfect"]); assert.ok(why.every((w) => w.title.length < 80 && w.text.length > 80 && w.text.length < 520));
  assert.match(why.find((w) => w.id === "scope").text, /multimètre met une demi-seconde/); assert.match(why.find((w) => w.id === "slow").text, /30 ms/);
  /* with an oscilloscope the bench shows the same curves ; swept by hand, the curve is the knob of the supply ; board off, nothing is drawn */
  const frame = sheets.find((s) => s.test === "frame"); assert.ok(screenToBench(frame).filter((m) => m.ch).every((m) => m.kind === "probe" && /vous voyez la même courbe/.test(m.bench))); assert.ok(!whyDifferent(frame).some((w) => w.id === "curves"));
  const sweep = sheets.find((s) => s.test === "thresholds"), sm = screenToBench(sweep); assert.deepEqual(sm.filter((m) => m.ch).map((m) => m.kind), ["hand", "watch"]); assert.deepEqual(whyDifferent(sweep).map((w) => w.id).slice(0, 2), ["hand", "slow"]); assert.ok(whyDifferent(sweep).some((w) => w.id === "program"));
  const cont = sheets.find((s) => s.noSim); assert.deepEqual(screenToBench(cont), []); assert.deepEqual(whyDifferent(cont).map((w) => w.id), ["nosim"]);
  assert.ok(whyDifferent(testSheet("buck", "ripple")).some((w) => w.id === "gear"), "an instrument not every bench has");
  /* every test of the two example boards : each curve of the screen is given its place at the bench */
  for (const b of [node, demoBoard()]) for (const s of boardSheets(b)) { const m = screenToBench(s), w = whyDifferent(s); assert.ok(w.length >= 1 && (s.noSim || w.length >= 3), `${b.id} ${s.id}`); const chans = new Set(s.links.filter((l) => l.instr === "scope").map((l) => l.to)); assert.equal(m.filter((x) => x.ch).length, chans.size, `${b.id} ${s.id} : a line per curve`); }
});

test("on paper and on the page : the plain sentence, the map, the words — and what is new is marked", () => {
  const R = resolveBoard(node, LIBRARY), blocks = manipBlocks(node, R, mcu), text = blocks.map((b) => [b.text, ...(b.items || []), ...(b.rows || []).flat()].filter(Boolean).join("\n")).join("\n");
  assert.equal(blocks.filter((b) => b.type === "p" && /^En clair\. /.test(b.text)).length, manipSteps(mcu).length, "a plain sentence per step"); assert.ok(blocks.some((b) => b.type === "h2" && b.text === "L'écran du Labo et le vrai banc")); assert.ok(blocks.some((b) => b.type === "table" && b.head[0] === "À l'écran du Labo" && b.rows.length === 4)); assert.match(text, /Un temps très court ne se lit pas au multimètre/);
  const doc = manipDoc(node, R, [mcu], { date: new Date("2026-11-20") }), words = doc.blocks.find((b) => b.type === "table" && b.head[0] === "Mot"); assert.equal(words.rows.length, WORDS.length); assert.match(words.rows[0][0], /Tension \(volts, V\) — voltage/); assert.ok(doc.blocks.some((b) => b.type === "table" && b.rows.some((r) => r[0] === "S2")));
  assert.ok(NEWS.some((n) => n.id === "lab-plain" && n.v === "0.119.0" && n.sel === "[data-manip-plain]" && n.where === "#/elab")); assert.ok(NEWS.some((n) => n.id === "lab-bench" && n.sel === "[data-bench-note]"));
});
