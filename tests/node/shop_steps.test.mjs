/* A new part, one question at a time (demande de JP) : six questions over the same fields, a memo of what has been said. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STEPS, stepOf, moveStep, stepMemo, stepState, stepIssues } from "../../web/js/core/shop_steps.js";

const blank = { name: "", fn: "", loads: "", environment: "", quantity: 10, priority: "", material: "AL6061-T6", form: "", neighbours: [], interfaces: [] };
test("six questions, each with what it asks and the fields it fills — every field of the intent has its question", () => {
  assert.equal(STEPS.length, 6); for (const s of STEPS) assert.ok(s.key && s.title && /\?$/.test(s.ask) && s.hint.length > 30, s.key);
  for (const f of ["name", "fn", "loads", "environment", "quantity", "priority", "neighbours", "interfaces", "proposed", "material", "form"]) assert.ok(stepOf(f) !== null, f);
  assert.equal(stepOf("name"), 0); assert.equal(stepOf("loads"), 1); assert.equal(stepOf("neighbours"), 2); assert.equal(stepOf("proposed"), 3); assert.equal(stepOf("material"), 4); assert.equal(stepOf("nope"), null);
  assert.equal(new Set(STEPS.flatMap((s) => s.fields)).size, STEPS.flatMap((s) => s.fields).length, "a field belongs to one question only");
  assert.equal(moveStep(0, -1), 0); assert.equal(moveStep(0, 1), 1); assert.equal(moveStep(5, 1), 5); assert.equal(moveStep(undefined, 1), 1);
});
test("the memo says what has been said, what waits, and what is only an example", () => {
  const m0 = stepMemo(blank, { issues: [{ level: "todo", field: "name" }, { level: "check", field: "material" }], material: "Aluminium 6061-T6", stock: "Plate" });
  assert.equal(m0.length, 7); assert.deepEqual(m0.map((x) => x.step), [0, 0, 1, 2, 3, 4, 5]);
  assert.equal(m0[0].state, "todo"); assert.equal(m0[1].state, "skip"); assert.equal(m0[3].value, "aucune"); assert.equal(m0[5].state, "eg", "the material the tool chose is an example until it is confirmed"); assert.match(m0[5].value, /Aluminium 6061-T6 — Plate/); assert.equal(m0[6].state, "skip");
  const full = { ...blank, name: "Équerre", fn: "Tient le capteur", loads: "20 N", environment: "−20 à 60 °C", priority: "mass", neighbours: ["A", "B"], interfaces: [{}, {}] };
  const m1 = stepMemo(full, { parts: [{ id: "A", name: "Carte" }, { id: "B" }], issues: [], built: true });
  assert.deepEqual(m1.map((x) => x.state), ["done", "done", "done", "done", "done", "done", "done"]); assert.equal(m1[3].value, "Carte, B"); assert.equal(m1[4].value, "2 interfaces"); assert.match(m1[2].value, /20 N · −20 à 60 °C · 10 pièces · la masse d'abord/); assert.match(m1[6].value, /proposée/);
  assert.equal(stepMemo({ ...full, name: "x".repeat(200) })[0].value.length, 70, "a long answer is cut on the memo, not in the brief"); assert.equal(stepMemo(null).length, 7);
  assert.equal(stepMemo(full, { issues: [{ level: "todo", field: "interfaces" }] })[4].state, "todo");
});
test("a dot of the rail : answered, waiting, or open", () => {
  const m = stepMemo({ ...blank, name: "Équerre" }, { issues: [{ level: "todo", field: "material" }] });
  assert.equal(stepState(0, m), "done"); assert.equal(stepState(1, m), "open"); assert.equal(stepState(4, m), "todo"); assert.equal(stepState(5, m), "open"); assert.equal(stepState(0, stepMemo(blank)), "todo");
  assert.deepEqual(stepIssues([{ field: "name" }, { field: "material" }, { field: "fn" }], 0).map((x) => x.field), ["name", "fn"]); assert.deepEqual(stepIssues(null, 0), []);
});
test("in the screen : the questions are laid over the fields of the intent, which stay the same", () => {
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8"), shop = read("shop.js"), ui = read("shop_steps.js"), css = readFileSync(new URL("../../web/css/shop.css", import.meta.url), "utf8");
  for (let i = 0; i < 5; i++) assert.match(shop, new RegExp(`"data-step": "${i}"`), `the block of question ${i + 1}`);
  for (const k of ["name", "fn", "loads", "environment"]) assert.match(shop, new RegExp(`text\\("${k}"`), k);
  assert.match(shop, /steps = mountSteps\(\{ left, all, memo:/); assert.match(shop, /if \(steps\) steps\.show\(x\.field\)/, "a line of the guide opens the question it speaks of"); assert.match(shop, /args\[1\] === "all"/);
  assert.match(ui, /aria-current": i === now \? "step" : null/); assert.match(ui, /e\.key !== "Enter"/); assert.match(ui, /"Tout voir sur une page"/); assert.match(ui, /"Revenir au pas à pas"/);
  assert.match(css, /\[data-mode="steps"\] \[data-step\]:not\(\.now-step\) \{ display: none; \}/);
});
