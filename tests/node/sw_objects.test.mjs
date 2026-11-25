/* The software of an embedded BMS, as objects one links — and the C the tool writes from them (demande de JP : « une approche de design
   logiciel via des objets visuels adaptés qui se codent tout seuls en librairie, module et structure de fichiers pour un CPU de BMS
   embarqué, sachant les in/out à gérer, leurs plages et le CPU choisi »). */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { KINDS, NATURES, cfgOf, portsOf, portOf } from "../../web/js/sw/sw_objects.js";
import { demoDesign, wireCheck, order, problems, unsure, ready, simulate, events, pinCount, liveWires } from "../../web/js/sw/sw_design.js";
import { cFiles, cExpected, requirement, LIB } from "../../web/js/sw/sw_c.js";
import { CPUS, CPU_SOURCES, cpuOf, cpuList } from "../../web/js/sw/sw_cpu.js";

const sure = (d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, sure: KINDS[o.kind].params.map((p) => p.key) })) });
const at = (R, ref, ms) => R.ports[ref][R.t.indexOf(ms)];

test("the objects : grouped by nature, each with its English name, its French one, its ports and what it proposes", () => {
  assert.deepEqual(NATURES.map((n) => n.id), ["pin", "measure", "decide", "control", "command"]); assert.ok(NATURES.every((n) => n.label && n.fr && /^#[0-9a-f]{6}$/.test(n.color) && n.icon && n.text));
  for (const [k, K] of Object.entries(KINDS)) { assert.ok(NATURES.some((n) => n.id === K.nature), k); assert.ok(K.label && K.fr && K.icon && K.text.length > 30, `${k} says what it is`); assert.ok(K.pin || (K.init && K.step && LIB[k]), `${k} : a behaviour written once, and its C`);
    for (const p of [...K.ports.in, ...K.ports.out]) assert.ok(p.key && p.label && p.unit, `${k}.${p.key}`); for (const p of K.params) assert.ok(p.key && p.label && p.value !== undefined, `${k} : ${p.key} has an example`); }
  /* a port takes the unit and the range its object chose */
  const cell = demoDesign().objects.find((o) => o.id === "cell_v"); assert.deepEqual(portOf(cell, "out", "value"), { key: "value", label: "value", unit: "mV", min: 500, max: 5000 }); assert.equal(cfgOf(cell).bits, 12, "what the object does not say is what its kind proposes"); assert.equal(portsOf(cell).in[0].unit, "counts");
});

test("a wire : the units must agree, a range that does not fit is said, a loop is opened by the value of the step before", () => {
  const d = demoDesign(); assert.deepEqual(wireCheck(d, "cell_v.value", "ov.value"), { ok: true, level: "", text: "" });
  const bad = wireCheck(d, "cell_v.value", "efc.i"); assert.equal(bad.ok, false); assert.match(bad.text, /unités ne s'accordent pas : « value » de Cell voltage est en mV, « current » de Energy counter attend des mA/);
  const wide = wireCheck(d, "i_pack.value", "efc.i"); assert.deepEqual([wide.ok, wide.level], [true, ""]); d.objects.find((o) => o.id === "i_pack").params.hi = 5000000; const w2 = wireCheck(d, "i_pack.value", "efc.i"); assert.deepEqual([w2.ok, w2.level], [true, "warn"]); assert.match(w2.text, /La plage ne tient pas/);
  assert.equal(wireCheck(d, "ov.value", "cell_v.value").ok, false, "from an output, to an input"); assert.equal(wireCheck(d, "latch.fault", "latch.a").ok, false, "not to itself");
  const e = demoDesign(), o = order(e); assert.deepEqual(o.loop, []); assert.ok(o.ids.indexOf("cell_v") < o.ids.indexOf("ov") && o.ids.indexOf("latch") < o.ids.indexOf("k_pos") && o.ids.indexOf("k_pos") < o.ids.indexOf("k_drv"), "what feeds runs before what reads");
  e.wires.find((w) => w.delay).delay = false; assert.deepEqual(order(e).loop.sort(), ["k_drv", "k_pos", "latch"]); assert.ok(problems(e, null).some((p) => p.level === "error" && /en boucle/.test(p.text) && /valeur du pas d'avant/.test(p.text)));
});

test("the guide : what is missing, what is wrong, what is only an example — and the files wait", () => {
  const d = demoDesign(), cpu = cpuOf(d); assert.deepEqual(problems(d, cpu).map((p) => p.level), ["check"]); assert.match(problems(d, cpu)[0].text, /39 valeurs sont des exemples/); assert.equal(unsure(d).length, 39); assert.equal(ready(d, cpu), false, "an example not confirmed : the files wait");
  const s = sure(d); assert.deepEqual(problems(s, cpu), []); assert.equal(ready(s, cpu), true); assert.deepEqual(pinCount(s), { ain: 3, din: 2, dout: 1 });
  const open = sure(demoDesign()); open.wires = open.wires.filter((w) => w.to !== "k_pos.feedback"); assert.ok(problems(open, cpu).some((p) => p.level === "error" && /Contactor K\+ : l'entrée « feedback » n'est reliée à rien/.test(p.text))); assert.equal(ready(open, cpu), false);
  const two = sure(demoDesign()); two.wires.push({ from: "req.level", to: "latch.a" }); assert.ok(problems(two, cpu).some((p) => /Deux fils arrivent sur la même entrée/.test(p.text)));
  const inv = sure(demoDesign()); inv.objects.find((o) => o.id === "ov").params.clear = 4300; assert.ok(problems(inv, cpu).some((p) => p.field === "clear" && /il bat/.test(p.text)));
  const small = { ...CPUS.generic, adc: { bits: 10, channels: 2 }, gio: 2 }, ps = problems(s, small).map((p) => p.text).join("\n"); assert.match(ps, /lit 3 voies analogiques ; le CPU choisi .* en a 2/); assert.match(ps, /prend 3 broches logiques ; le CPU choisi en offre 2/); assert.match(ps, /résolution de 12 bits, alors que le convertisseur du CPU choisi en a 10/);
  assert.deepEqual(problems({ objects: [] }, null).map((p) => p.level), ["todo"]); const off = sure(demoDesign()); off.objects.find((o) => o.id === "efc").off = true; assert.equal(liveWires(off).length, liveWires(d).length - 2, "an object put off takes its wires with it"); assert.equal(ready(off, cpu), true);
});

test("the model, run : the cell climbs past its limit, the software opens the contactor, the energy is counted", () => {
  const d = demoDesign(), R = simulate(d); assert.equal(R.t.length, 120); assert.equal(R.ok, true);
  assert.equal(at(R, "cell_v.value", 0), 3900, "2420 counts x 3300 mV / 4095 x 2"); assert.equal(at(R, "v_pack.value", 0), 400000); assert.equal(at(R, "i_pack.value", 200), 100000, "1900 mV x 400 - 660 000 : 100 A");
  const ev = events(d, R).map((e) => `${e.t} ${e.ref} ${e.to}`); assert.deepEqual(ev, ["50 req.level 1", "50 k_pos.drive 1", "80 k_fb.level 1", "600 ov.trip 1", "600 latch.fault 1", "600 k_pos.drive 0", "630 k_fb.level 0", "910 ov.trip 0"].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.split(" ")[1].localeCompare(b.split(" ")[1])));
  assert.equal(at(R, "latch.fault", 1190), 1, "the fault stays once the cell is back : it waits for an acknowledgement"); assert.equal(at(R, "k_pos.fault", 1190), 0, "the contact followed the order in time : no fault of the contactor");
  assert.ok(at(R, "efc.e_out", 1190) > 5000 && at(R, "efc.e_out", 1190) === at(R, "efc.e_out", 900), "40 kW for half a second, then nothing flows"); assert.ok(at(R, "efc.e_in", 1190) < 100, "the 0.4 A the sensor reads at rest is counted as it is");
  /* a contactor whose contact does not follow : welded, or its coil cut */
  const stuck = demoDesign(); stuck.scenario.pins.k_fb = { follows: "k_drv", delay: 20, stuck: 0 }; const S = simulate(stuck); assert.equal(at(S, "k_pos.fault", 90), 0); assert.equal(at(S, "k_pos.fault", 100), 1, "50 ms without its contact : a fault"); assert.equal(at(S, "k_pos.drive", 100), 0); assert.equal(at(S, "latch.fault", 100), 0); assert.equal(at(S, "latch.fault", 110), 1, "kept by the latch, one step later (the value of the step before)");
});

test("the C : a library, modules and a file structure — and, compiled, it prints what the model gives", (t) => {
  const d = sure(demoDesign()), cpu = cpuOf(d), files = cFiles(d, { cpu }), names = files.map((f) => f.name);
  for (const n of ["bms/lib/dw_types.h", "bms/lib/dw_analog.c", "bms/lib/dw_limit.c", "bms/lib/dw_latch.c", "bms/lib/dw_contactor.c", "bms/lib/dw_energy.c", "bms/cfg/bms_cfg.c", "bms/io/bms_io.h", "bms/app/bms_app.c", "bms/hal/hal.h", "bms/hal/tms570ls1224_pge/hal_tms570ls1224_pge.c", "bms/hal/host/hal_host.c", "bms/test/bms_test.c", "bms/test/expected.txt", "bms/doc/TRACE.md", "bms/README.md"]) assert.ok(names.includes(n), n);
  assert.ok(files.every((f) => /DynamiteOrbit\.ai/.test(f.text) || f.name.endsWith("expected.txt")), "every file carries the note of the platform"); assert.ok(files.filter((f) => /\.[ch]$/.test(f.name)).every((f) => !/malloc|float|double/.test(f.text) && /^[\x00-\x7f]*$/.test(f.text)), "no allocation, no floating point, plain ASCII");
  const get = (n) => files.find((f) => f.name === `bms/${n}`).text; assert.match(get("cfg/bms_cfg.c"), /const dw_limit_cfg_t BMS_CFG_OV = \{ 1U, 4250, 4150, 100U \};/); assert.match(get("io/bms_io.h"), /#define BMS_ADC_ADC_CELL \(0U\)/); assert.match(get("app/bms_app.c"), /dw_latch_step\(&s_latch, bms\.ov_trip, bms\.k_pos_fault, 0U, 0U\);/);
  assert.match(get("hal/tms570ls1224_pge/hal_tms570ls1224_pge.c"), /initialize the registers of BOTH CPUs/); assert.match(get("README.md"), /It has run on no microcontroller\. No claim of certification is made/); assert.match(get("doc/TRACE.md"), /Over-voltage shall trip when Cell voltage stays at or above 4250 mV for 100 ms/);
  assert.doesNotMatch(get("cfg/bms_cfg.c"), /EXAMPLE VALUES NOT CONFIRMED/); assert.match(cFiles(demoDesign(), { cpu }).find((f) => f.name === "bms/cfg/bms_cfg.c").text, /EXAMPLE VALUES NOT CONFIRMED BY THE PROJECT : 39/, "a file written before the values are confirmed says so");
  assert.match(requirement(d, d.objects.find((o) => o.id === "k_pos")), /raise a fault when its feedback has not followed the order for 50 ms/);
  const want = cExpected(d); assert.equal(want.split("\n").length, 122); assert.match(want, /^t_ms;adc_cell_counts;cell_v_value;cell_v_valid;ov_trip;latch_fault;/);
  const cc = spawnSync("cc", ["--version"]); if (cc.error || cc.status !== 0) { t.diagnostic("no C compiler here : the back-to-back run is skipped"); return; }
  const dir = mkdtempSync(join(tmpdir(), "dwsw-")); for (const f of files) { const p = join(dir, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  const B = join(dir, "bms"), src = files.filter((f) => /\.c$/.test(f.name) && !/hal\/tms/.test(f.name)).map((f) => join(dir, f.name)), inc = ["lib", "cfg", "io", "app", "hal"].map((x) => `-I${join(B, x)}`);
  const made = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", ...inc, ...src, "-o", join(dir, "t")], { encoding: "utf8" }); assert.equal(made.status, 0, `the C compiles without a warning : ${made.stderr}`);
  const ran = spawnSync(join(dir, "t"), [], { encoding: "utf8" }); assert.equal(ran.status, 0); assert.equal(ran.stdout, want, "back to back : the C prints, character for character, what the model gives");
  const hal = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", ...inc, "-c", join(B, "hal/tms570ls1224_pge/hal_tms570ls1224_pge.c"), "-o", join(dir, "hal.o")], { encoding: "utf8" }); assert.equal(hal.status, 0, `the skeleton of the CPU compiles : ${hal.stderr}`);
  /* another scenario, the same proof : a contact that does not follow */
  const st = sure(demoDesign()); st.scenario.pins.k_fb = { follows: "k_drv", delay: 20, stuck: 0 }; const f2 = cFiles(st, { cpu }), dir2 = mkdtempSync(join(tmpdir(), "dwsw-")); for (const f of f2) { const p = join(dir2, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  const B2 = join(dir2, "bms"), m2 = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", ...["lib", "cfg", "io", "app", "hal"].map((x) => `-I${join(B2, x)}`), ...f2.filter((f) => /\.c$/.test(f.name) && !/hal\/tms/.test(f.name)).map((f) => join(dir2, f.name)), "-o", join(dir2, "t")], { encoding: "utf8" }); assert.equal(m2.status, 0, m2.stderr);
  assert.equal(spawnSync(join(dir2, "t"), [], { encoding: "utf8" }).stdout, cExpected(st), "and for a contactor whose contact stays open");
});

test("the CPU : a sheet read in a public data sheet, each figure with its page — and what the data sheet does not say is said", () => {
  assert.deepEqual(cpuList().map((c) => c.key), ["tms570ls1224_pge", "tms570ls1224_zwt", "generic"]); const p = CPUS.tms570ls1224_pge, z = CPUS.tms570ls1224_zwt;
  assert.deepEqual([p.lockstep, p.clock, p.flash, p.ram, p.adc.bits, p.adc.channels, p.gio, p.gioIrq, p.can, p.uart], [true, 160, 1280, 192, 12, 24, 64, 10, 3, 2]); assert.deepEqual([z.clock, z.gio, z.gioIrq], [180, 101, 16]);
  assert.ok(p.facts.length >= 10 && p.facts.every((f) => f.what && f.value && /p\. \d|tableau/.test(f.page)), "every fact says its page"); assert.match(p.says, /ne cite AUCUNE norme : ni ISO 26262, ni IEC 61508/); assert.match(CPU_SOURCES[0].doc, /SPNS190B/); assert.match(CPU_SOURCES[0].read, /^Lue : 172 pages/);
  assert.equal(cpuOf({ cpu: "nope" }).key, "generic"); assert.match(CPUS.generic.says, /celles d'aucun composant/); assert.equal(CPUS.generic.facts.length, 0);
});

test("wiring : the screen is in the menu, in the stairs and in the registers — and what is new is marked", async () => {
  const { readFileSync } = await import("node:fs"), read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"), app = read("web/js/core/app.js"), main = read("web/js/main.js"), sw = read("web/js/modules/sw.js"), cv = read("web/js/modules/sw_canvas.js");
  assert.match(app, /keys: \["pcb", "pcba", "elab", "creepage"\]/, "the group Électronique keeps its first four tiles : the numbers a path names do not move"); assert.match(app, /id: "soft", label: "Logiciel"[^\n]*keys: \["swreq", "swarch", "sw", "swsim", "swcode", "swtest", "swrel", "swref"\]/, "the software is a group of its own, in the order of the V"); assert.match(main, /import "\.\/modules\/sw\.js";/); assert.match(sw, /registerModule\(\{ key: V\.mod, label: V\.title/);
  assert.match(sw, /disabled: !ok/, "the files wait for the design to be ready"); assert.match(read("web/js/modules/sw_sheet.js"), /needField\(input/, "a value the tool proposed blinks"); assert.match(sw, /setGuide\(guide\(\)\)/); assert.match(read("web/js/modules/sw_sheet.js"), /sure: \(p \? p\.sure \|\| \[\] : \[\]\)\.filter\(\(k\) => c0\[k\] === c1\[k\]\)/, "a value an answer changed is an example again");
  assert.match(cv, /role: "button", "data-port": ref/, "a port is a button : a wire is made with the keyboard too"); assert.match(cv, /e\.key === "Escape" && pending/);
  const { NEWS } = await import("../../web/js/core/whats_new.js"), { METHODS } = await import("../../web/js/core/methods.js"), { glossary } = await import("../../web/js/core/terms.js");
  assert.ok(NEWS.some((n) => n.id === "sw-objects" && n.v === "0.121.0" && n.where === "#/sw")); assert.deepEqual(METHODS.filter((m) => m.id.startsWith("sw-")).map((m) => [m.id, m.how]), [["sw-objects", "own"], ["sw-v", "usual"], ["sw-std", "excerpt"], ["sw-req", "usual"], ["sw-test", "own"], ["sw-docs", "usual"], ["sw-load", "page"], ["sw-cpu", "read"]]); assert.match(METHODS.find((m) => m.id === "sw-cpu").check, /ne cite AUCUNE norme/);
  assert.ok(glossary().some((g) => g.en === "Contactor driver" && g.fr === "commande d'un contactor") && glossary().some((g) => g.en === "Energy counter"));
});
