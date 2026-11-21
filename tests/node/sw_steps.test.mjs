/* The software, step by step (demande de JP : « mettre ça pas à pas, comme si la partie logiciel était faite pour un étudiant de 16 ans…
   tester la routine de démarrage, l'initialisation, la mémoire logicielle… une vraie simulation logicielle en temps réel… l'important, c'est
   de voir le package final, puis de savoir comment il serait téléchargé dans le microprocesseur »).
     node --test tests/node/sw_steps.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { KINDS } from "../../web/js/sw/sw_objects.js";
import { demoDesign, simulate, machine, pinRead } from "../../web/js/sw/sw_design.js";
import { cFiles, memoryPlan, structSize } from "../../web/js/sw/sw_c.js";
import { CPUS, cpuOf } from "../../web/js/sw/sw_cpu.js";
import { STEPS, stepStates, nextStep, WORDS, wordsIn, ioRows, kindShape, rankOf } from "../../web/js/sw/sw_steps.js";
import { liveInputs, liveStart, liveSet, liveStep, due } from "../../web/js/sw/sw_live.js";
import { startSequence, memoryReport, startupTest } from "../../web/js/sw/sw_start.js";
import { loadChain, loadDoc, LOAD_SOURCES } from "../../web/js/sw/sw_load.js";
import { METHODS } from "../../web/js/core/methods.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const sure = (d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, sure: KINDS[o.kind].params.map((p) => p.key) })) });
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("seven steps, in the order one makes software for a board ; each says what it is in plain words, and where it stands — read from the design", () => {
  assert.deepEqual(STEPS.map((s) => s.key), ["cpu", "objects", "values", "start", "live", "code", "load"]); assert.deepEqual(STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
  for (const s of STEPS) { assert.ok(s.title && s.long && s.icon && /^#[0-9a-f]{6}$/.test(s.color), s.key); assert.ok(s.plain.length > 120 && s.do.length > 40, `${s.key} : what it is, and what one does`); assert.ok(wordsIn(`${s.plain} ${s.do}`).length >= 1, `${s.key} unfolds the words of the trade it uses`); }
  for (const w of WORDS) assert.ok(w.word && w.en && w.says.length > 40 && w.re instanceof RegExp, w.id);
  const none = stepStates(null, null); assert.equal(none.cpu.state, "todo"); assert.ok(STEPS.slice(1).every((s) => none[s.key].state === "wait"), "before a design, every step after the first waits");
  const d = demoDesign(), S = stepStates(d, cpuOf(d)); assert.deepEqual(STEPS.map((s) => S[s.key].state), ["done", "done", "todo", "info", "info", "info", "info"]); assert.match(S.values.text, /39 valeurs d'exemple/); assert.equal(nextStep(d, cpuOf(d)), "values");
  const ok = sure(demoDesign()); assert.deepEqual([stepStates(ok, cpuOf(ok)).values.state, stepStates(ok, cpuOf(ok)).code.state], ["done", "done"]); assert.equal(nextStep(ok, cpuOf(ok)), "live", "nothing left to do : the live simulation");
  const gen = { ...demoDesign(), cpu: "generic" }; assert.equal(stepStates(gen, cpuOf(gen)).cpu.state, "todo", "a generic sheet is not a CPU chosen");
  const cut = demoDesign(); cut.wires = cut.wires.filter((w) => w.to !== "ov.value"); const C = stepStates(cut, cpuOf(cut)); assert.equal(C.objects.state, "todo"); assert.match(C.objects.text, /Over-voltage : l'entrée « value » n'est reliée à rien/); assert.equal(C.live.state, "wait", "the bench waits for a design without error");
});

test("what enters and what leaves an object : one line each, where it comes from, where it goes, what it is worth", () => {
  const d = demoDesign(), ov = d.objects.find((o) => o.id === "ov"), R = simulate(d), v = Object.fromEntries(Object.entries(R.ports).map(([r, y]) => [r, y[70]])), io = ioRows(d, ov, v);
  assert.deepEqual(io.in.map((p) => [p.key, p.unit, p.from]), [["value", "mV", "Cell voltage · value"]]); assert.deepEqual(io.out.map((p) => [p.key, p.unit, p.to]), [["trip", "0/1", ["Fault latch · a"]]]);
  assert.equal(io.in[0].value, v["ov.value"]); assert.equal(io.out[0].value, 1, "at 700 ms the over-voltage has tripped");
  const latch = ioRows(d, d.objects.find((o) => o.id === "latch")); assert.deepEqual(latch.in.map((p) => [p.key, p.from, p.free, p.delay]), [["a", "Over-voltage · trip", false, false], ["b", "Contactor K+ · fault", true, true], ["c", "", true, false], ["reset", "", true, false]], "an input left free says so ; a wire that carries the step before too");
  assert.equal(kindShape("pin_adc"), "lit le CPU → 1 sortie"); assert.equal(kindShape("contactor"), "3 entrées → 2 sorties"); assert.equal(kindShape("pin_dout"), "1 entrée → écrit le CPU");
  const r = rankOf(d); assert.ok(r.cell_v < r.ov && r.ov < r.latch && r.latch < r.k_pos && r.k_pos < r.k_drv, "the rank is the order of the step");
  const cv = read("web/js/modules/sw_canvas.js"); assert.match(cv, /"ENTRÉES" : "lit une broche du CPU"/); assert.match(cv, /"SORTIES" : "écrit une broche du CPU"/); assert.match(cv, /M -7 \$\{y - 7\} L 6 \$\{y\} L -7 \$\{y \+ 7\} Z/, "an input is an arrowhead that points INTO the tile");
  assert.match(read("web/js/modules/sw_sheet.js"), /sec\("Ses entrées et ses sorties", "", ioTable\(d, o, c\.values\)\)/);
});

test("the live simulation : the very step the scenario replays, one period at a time, against a bench one drives", () => {
  const d = demoDesign(), sc = d.scenario, m = machine(d), R = simulate(d), refs = Object.keys(R.ports);
  for (let k = 0; k < sc.steps; k++) { m.step((id, kk, now, drove) => pinRead(sc.pins[id], kk, now, drove, m.dt)); for (const ref of refs) assert.equal(m.last[ref], R.ports[ref][k], `${ref} at step ${k}`); }
  const I = liveInputs(d); assert.deepEqual(I.map((i) => [i.id, i.kind, i.unit]), [["adc_cell", "analog", "mV"], ["req", "digital", "0/1"], ["k_fb", "contact", "0/1"], ["adc_i", "analog", "mA"], ["adc_v", "analog", "mV"]], "one control per input pin, in the unit of the measure it feeds");
  const cell = I[0]; assert.deepEqual([cell.min, cell.max, cell.lo, cell.hi, cell.full], [0, 6600, 500, 5000, 4095]); assert.equal(cell.toCounts(4400), 2730); assert.equal(cell.toCounts(99999), 4095, "a value beyond the pin is clamped");
  const cur = I[3]; for (const v of [-400000, -400, 0, 12345, 400000]) { const n = cur.toCounts(v), back = Math.trunc(Math.trunc(n * 3300 / 4095) * 400) - 660000; assert.ok(Math.abs(back - v) <= 400 * 3300 / 4095 + 400, `${v} mA → ${n} counts → ${back}`); }
  const L = liveStart(d); assert.equal(L.m.k, 0); assert.equal(L.set.k_fb, "follows"); liveSet(L, "req", 1); liveStep(L, 2); assert.equal(L.m.last["k_pos.drive"], 1, "asked to close : the coil is driven at the next steps");
  liveStep(L, 10); assert.equal(L.m.last["k_fb.level"], 1, "the contact follows its coil, 20 ms later"); liveSet(L, "adc_cell", 4400); liveStep(L, 30);
  assert.deepEqual([L.m.last["ov.trip"], L.m.last["latch.fault"], L.m.last["k_pos.drive"]], [1, 1, 0], "the cell past its limit : trip, fault kept, contactor opened");
  assert.ok(L.log.some((e) => e.ref === "ov.trip" && e.to === 1) && L.log.some((e) => e.ref === "k_pos.drive" && e.to === 0), "the journal logs what changed");
  const W = liveStart(d); liveSet(W, "req", 1); liveSet(W, "k_fb", "closed"); liveStep(W, 1); liveSet(W, "req", 0); liveStep(W, 10); assert.equal(W.m.last["k_pos.fault"], 1, "a contact welded : the software sees it does not follow");
  assert.deepEqual(liveSet(liveStart(d), "k_fb", "nonsense").set.k_fb, "follows"); assert.equal(liveSet(liveStart(d), "adc_cell", 1e9).set.adc_cell, 6600);
  assert.deepEqual(due(100, 10, 1, 0), { n: 10, rest: 0 }); assert.equal(due(100, 10, 0.2, 0).n, 2); const a = due(15, 10, 1, 0); assert.equal(a.n, 1); assert.equal(due(15, 10, 1, a.rest).n, 2, "a remainder is carried"); assert.equal(due(1e6, 10, 1, 0).n, 400, "a tab left asleep does not run thousands of steps at once");
  const T = liveStart(d, 50); liveStep(T, 80); assert.equal(T.trace.t.length, 50); assert.equal(T.trace.t[49], 790, "the trace keeps the last steps only");
  const b = read("web/js/modules/sw_bench.js"); assert.match(b, /"Marche"/); assert.match(b, /"Un pas"/); assert.match(b, /"Redémarrer"/); assert.match(b, /\["follows", "suit la bobine"\], \["open", "coincé ouvert"\], \["closed", "soudé fermé"\]/);
});

test("start-up : the CPU first (read in its data sheet), then the software — and a test that nothing moves on its own", () => {
  const p = CPUS.tms570ls1224_pge; assert.equal(p.boot.total, p.boot.phases.reduce((n, x) => n + x[1], 0), "3497 cycles : the four phases of table 6-3"); assert.match(p.boot.page, /p\. 52/); assert.equal(CPUS.generic.boot, null);
  const d = demoDesign(), seq = startSequence(d, p); assert.deepEqual(seq.map((s) => s.who), ["cpu", "hal", "app", "step"]); assert.match(seq[0].text, /3497/); assert.equal(seq[3].items.length, 13); assert.match(startSequence(d, CPUS.generic)[0].text, /aucune n'a été lue pour ce CPU/);
  const T = startupTest(d, p); assert.equal(T.ok, true); assert.deepEqual(T.checks.map((c) => [c.id, c.ok]), [["order", true], ["zero", true], ["outputs", true], ["rest", true], ["moves", null], ["valid", null], ["ram", true], ["delay", null]]);
  assert.match(T.checks.find((c) => c.id === "valid").text, /3 mesures se disent « non vraisemblable »/, "nothing connected : a measure at 0 is not believed, as it should");
  /* an under-voltage that drives an output at rest : the test says so */
  const O = (id, kind, params = {}) => ({ id, kind, name: id, params, sure: [], x: 0, y: 0 }), bad = { id: "UV", name: "UV", cpu: "generic", period: 10, objects: [O("a", "pin_adc"), O("m", "analog_in", { lo: 0 }), O("uv", "limit", { above: 0, trip: 100, clear: 200, delay: 30 }), O("led", "pin_dout")],
    wires: [{ from: "a.counts", to: "m.counts" }, { from: "m.value", to: "uv.value" }, { from: "uv.trip", to: "led.level" }] };
  const B = startupTest(bad, CPUS.generic); assert.equal(B.ok, false); assert.equal(B.checks.find((c) => c.id === "rest").ok, false); assert.match(B.checks.find((c) => c.id === "rest").detail, /led/); assert.match(B.checks.find((c) => c.id === "moves").text, /uv \(trip\) passe à 1 à 20 ms/);
  assert.equal(startupTest({ objects: [], wires: [] }, null).ok, false);
});

test("the memory : read from the structures the files declare — and equal to what a C compiler lays out", (t) => {
  assert.deepEqual(structSize([{ name: "a", type: "uint8_t" }, { name: "b", type: "int32_t" }]).size, 8); assert.equal(structSize("uint8_t k; int64_t sum; dw_bool p;").size, 24); assert.equal(structSize("int32_t buf[16]; uint8_t k;").size, 68);
  const d = sure(demoDesign()), M = memoryPlan(d), R = memoryReport(d, CPUS.tms570ls1224_pge); assert.equal(M.ram, 377); assert.equal(M.rom, 116); assert.equal(R.cpuRam, 192 * 1024); assert.ok(R.ramShare < 0.01); assert.match(R.note, /taille du CODE/);
  assert.deepEqual(M.objects.map((o) => [o.id, o.ram, o.rom]), [["cell_v", 96, 32], ["ov", 8, 16], ["latch", 1, 0], ["k_pos", 12, 4], ["i_pack", 96, 32], ["v_pack", 96, 32], ["efc", 24, 0]]);
  const cc = spawnSync("cc", ["--version"]); if (cc.error || cc.status !== 0) { t.diagnostic("no C compiler here : the sizes are not compared with sizeof"); return; }
  const files = cFiles(d, { cpu: cpuOf(d) }), dir = mkdtempSync(join(tmpdir(), "dwmem-")); for (const f of files) { const p = join(dir, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  const mods = [...new Set(M.objects.map((o) => o.mod))], prog = `#include <stdio.h>\n#include "bms_app.h"\n${mods.map((m) => `#include "${m}.h"`).join("\n")}\nint main(void) {\n${mods.map((m) => `  printf("${m} %u", (unsigned)sizeof(${m}_t));\n${M.objects.find((o) => o.mod === m).rom ? `  printf(" %u", (unsigned)sizeof(${m}_cfg_t));\n` : ""}  printf("\\n");`).join("\n")}\n  printf("signals %u\\n", (unsigned)sizeof(bms_signals_t));\n  return 0;\n}\n`;
  writeFileSync(join(dir, "size.c"), prog); const B = join(dir, "bms"), made = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", ...["lib", "app"].map((x) => `-I${join(B, x)}`), join(dir, "size.c"), "-o", join(dir, "size")], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr); const out = spawnSync(join(dir, "size"), [], { encoding: "utf8" }).stdout.trim().split("\n").map((l) => l.split(" "));
  for (const [m, ram, rom] of out.slice(0, -1)) { const o = M.objects.find((x) => x.mod === m); assert.equal(Number(ram), o.ram, `sizeof(${m}_t)`); if (rom) assert.equal(Number(rom), o.rom, `sizeof(${m}_cfg_t)`); }
  assert.equal(Number(out.at(-1)[1]), M.signals.size, "sizeof(bms_signals_t)");
});

test("from the package to the CPU : seven steps, what the maker publishes with where it was read — also written in the package", () => {
  const C = loadChain(CPUS.tms570ls1224_pge), G = loadChain(CPUS.generic); assert.equal(C.known, true); assert.deepEqual(C.steps.map((s) => s.key), ["pack", "hal", "project", "build", "wire", "flash", "check"]);
  for (const s of C.steps) { assert.ok(s.title && s.plain.length > 80 && s.does.length > 30, s.key); for (const r of s.read) { assert.ok(LOAD_SOURCES.some((x) => x.id === r.src), `${s.key} : its source is listed`); assert.ok(!r.where || /p\. \d+/.test(r.where), r.where); assert.ok(r.en && /^[\x20-\x7e]+$/.test(r.en), `${s.key} : said in English for the package`); } }
  assert.equal(C.steps.reduce((n, s) => n + s.read.length, 0), 14); assert.ok(LOAD_SOURCES.every((s) => /^https:\/\/www\.ti\.com\//.test(s.url) && /lue/.test(s.read)));
  const all = C.steps.flatMap((s) => s.read.map((r) => r.text)).join(" "); for (const q of ["On board USB XDS110 debug", "14-pin TI-JTAG header (not populated)", "word-invariant big-endian [BE32]", "can be imported into CCS, IAR Workbench, or Keil uVision"]) assert.ok(all.includes(q), `quoted as the maker writes it : ${q}`);
  assert.match(all, /au plus 13 s/); assert.match(all, /108, 112, 110, 111, 109 et 113/); assert.match(all, /Le certificat lui-même n'a pas été lu ; la fiche technique, elle, ne cite aucune norme/);
  assert.equal(G.known, false); assert.ok(G.steps.every((s) => !s.read.length)); assert.match(G.note, /aucun document n'a été lu/);
  const doc = loadDoc(CPUS.tms570ls1224_pge, "X"); assert.match(doc, /^# X - from these files to the microcontroller/); assert.match(doc, /none of it was tried/); assert.ok(/^[\n\x20-\x7e]+$/.test(doc), "plain ASCII");
  const files = cFiles(sure(demoDesign()), { cpu: CPUS.tms570ls1224_pge }); assert.equal(files.length, 24); assert.match(files.find((f) => f.name === "bms/doc/LOADING.md").text, /On board USB XDS110 debug/);
  const m = METHODS.find((x) => x.id === "sw-load"); assert.ok(m && m.how === "page" && /HALCoGen/.test(m.title) && /n'ont PAS été lus/.test(m.check) && /rien n'a été chargé dans un CPU/.test(m.check), "the register says what was read, and that nothing was tried");
});

test("the screen : the card of the step in the left panel, the page in the address, the guide where one is, the pages one reads in the centre", () => {
  const sw = read("web/js/modules/sw.js"), pages = read("web/js/modules/sw_pages.js");
  assert.match(sw, /stepCard\(d, cpu, V\.key, st\.step, run, open\)/, "the card of the step of the V, at the head of the left panel"); assert.match(sw, /history\.replaceState\(null, "", vHash\(V\.key, st\.step\)\)/, "the page in the address");
  assert.match(sw, /location\.replace\(vHash\(elsewhere\.key, args\[0\]\)\)/, "an address of before the V leads to its step");
  assert.match(sw, /"À régler — le guide"/, "the guide is in the left panel of every step"); assert.match(sw, /setGuide\(guide\(\)\)/); assert.match(sw, /disabled: !ok/);
  assert.match(pages, /href: `\$\{url\}#page=\$\{m\[1\]\}`/, "a page of the data sheet is a link to it"); assert.match(pages, /"Page de la fiche"/); assert.match(pages, /el\("pre", \{ class: "sw-ln"/, "the code with its line numbers");
  for (const id of ["sw-steps", "sw-live", "sw-load"]) { const n = NEWS.find((x) => x.id === id); assert.ok(n && n.v === "0.124.0" && /^#\/sw/.test(n.where), id); }
});
