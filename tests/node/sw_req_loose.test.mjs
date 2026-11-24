/* The requirements in, with no loose end (JP, 24 novembre 2026 : « je l'ai essayé et il y a des bouts libres ») : a block names all its inputs and
   outputs, a gate takes the ids its sentence quotes, the scaling of a declared signal carries its requirement, and what stays loose is listed.
   Then the screens : the tour of what to fix, the questionnaire, the « ? » of a block.   node --test tests/node/sw_req_loose.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planImport, looseEnds, reqPrompt } from "../../web/js/sw/sw_req_import.js";
import { problems } from "../../web/js/sw/sw_design.js";

const FILE = { format: "dynamiteorbit/sw-requirements@1", system: { name: "Test", domain: "bms", period_ms: 10 },
  signals: [{ id: "v", name: "Cell voltage", dir: "in", type: "analog", unit: "mV", min: 0, max: 5000 }, { id: "t", name: "Cell temperature", dir: "in", type: "analog", unit: "0.1 °C", min: -400, max: 1250 },
    { id: "lost", name: "Chain silent", dir: "in", type: "digital" }, { id: "ack", name: "Acknowledge", dir: "in", type: "digital" }, { id: "kfb", name: "Auxiliary contact", dir: "in", type: "digital" }, { id: "k", name: "Contactor coil", dir: "out", type: "digital" }, { id: "emerg", name: "Emergency flag", dir: "out", type: "digital" }],
  requirements: [
    { id: "R-1", text: "The software shall execute with a fixed period of 10 ms.", kind: "performance", verify: "test" },
    { id: "R-2", text: "The software shall average the temperature over 4 samples.", block: "analog_in", input: "t", values: { n: 4 } },
    { id: "R-3", text: "Over-voltage fault above 4.25 V.", block: "limit", input: "v", values: { above: 1, trip: 4250, clear: 4150, delay: 100 } },
    { id: "R-4", text: "Over-temperature fault above 60 °C.", block: "limit", input: "R-2", values: { above: 1, trip: 600, clear: 550, delay: 1000 } },
    { id: "R-5", text: "Combine the faults (R-3 OR R-4).", block: "logic", input: "R-3", values: { op: "OR" } },
    { id: "R-6", text: "Latch the fault.", block: "fault_latch", inputs: { a: "R-5", reset: "ack" } },
    { id: "R-7", text: "Manage the state.", block: "module_state", inputs: { fault: "R-6", lost: "lost", reset: "ack" }, outputs: { emergency: "emerg" } },
    { id: "R-8", text: "Drive the contactor.", block: "contactor", inputs: { request: "R-7.close", inhibit: "R-6", feedback: "kfb" }, outputs: { drive: "k" } },
    { id: "R-9", text: "Refresh the watchdog.", block: "watchdog" }] };

test("an import names every input and output : a gate takes the ids its sentence quotes ; the scaling of a signal carries its requirement ; « id.port » ; the period is held by the architecture", () => {
  const P = planImport(FILE, null), d = P.design, W = d.wires.map((w) => `${w.from}>${w.to}`), id = (r) => d.reqs.find((x) => x.id === r).objs[0];
  assert.equal(d.objects.filter((o) => o.kind === "analog_in").length, 2, "R-2 is carried by the scaling of the signal t, not by a second block");
  assert.equal(d.objects.find((o) => o.id === id("R-2")).params.n, 4);
  assert.ok(W.includes(`${id("R-4")}.trip>${id("R-5")}.b`), "R-5 quotes R-4 : its second input");
  assert.ok(W.includes(`${id("R-7")}.close>${id("R-8")}.request`), "« R-7.close » names the port");
  assert.ok(W.some((w) => w.startsWith(`${id("R-7")}.emergency>`)), "outputs : the emergency flag is driven");
  const L = looseEnds(d, FILE); assert.deepEqual(L.filter((x) => x.kind !== "planned" && x.kind !== "none").map((x) => x.text), [], "no loose end : every signal read or driven, every input wired");
  assert.deepEqual(problems(d).filter((p) => p.level === "error"), []);
  assert.ok(!L.some((x) => x.id === "R-1"), "the period of 10 ms is held by the architecture");
  assert.ok(L.some((x) => x.kind === "planned" && x.id === "R-9"), "a block to come is said");
});

test("the loose ends are listed : a signal read by no block, an output driven by none, an input left unwired — and the guide says a pin read by nothing", () => {
  const bare = { ...FILE, requirements: FILE.requirements.filter((r) => !["R-7", "R-8"].includes(r.id)) }, P = planImport(bare, null), L = P.loose;
  assert.ok(L.some((x) => x.kind === "signal-out" && /Contactor coil/.test(x.text)) && L.some((x) => x.kind === "signal-in" && /Chain silent/.test(x.text)));
  assert.ok(problems(P.design).some((p) => p.level === "check" && /Chain silent : la broche est lue par aucun bloc/.test(p.text)));
  assert.match(reqPrompt(), /"inputs": \{ "a": "SWR-017", "b": "SWR-018" \}/); assert.match(reqPrompt(), /NO input of a block unwired/);
});

test("the screens : the counters and the tour, the questionnaire with Approve at the top, the « ? » on a block, the choice new / complete", () => {
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8");
  const fix = read("sw_fix_ui.js"); for (const re of [/swFixTour/, /swQuiz/, /quizApprove/, /Plus tard/, /Aller au bloc/]) assert.match(fix, re);
  assert.match(read("sw_canvas.js"), /data-sw-ask/); assert.match(read("sw_puzzle_view.js"), /data-sw-ask/);
  assert.match(read("sw_lib_ui.js"), /Un logiciel neuf, fait de ce fichier/); assert.match(read("sw.js"), /swFix\(/);
});
