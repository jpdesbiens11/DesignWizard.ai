// First steps : eight steps that tick themselves off the project, and the help of each screen in the guide.
import test from "node:test";
import assert from "node:assert/strict";
import { FIRST_STEPS, STEP_GROUPS, firstSteps, firstStepHere, firstStepsLine } from "../../web/js/core/first_steps.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const demo = () => JSON.parse(JSON.stringify(typeof DEMO_DRIVE === "function" ? DEMO_DRIVE() : DEMO_DRIVE));

test("the steps are grouped by what one does, each group with its colour and its pictogram, each step with its words", () => {
  assert.deepEqual(STEP_GROUPS.map((g) => g.id), ["start", "design", "check", "deliver"]); assert.equal(new Set(STEP_GROUPS.map((g) => g.color)).size, STEP_GROUPS.length); assert.ok(STEP_GROUPS.every((g) => g.label && g.hint && g.icon && /^#[0-9a-f]{6}$/.test(g.color)));
  assert.equal(FIRST_STEPS.length, 8); assert.equal(new Set(FIRST_STEPS.map((s) => s.id)).size, 8); assert.equal(new Set(FIRST_STEPS.map((s) => s.screen)).size, 8, "a step, a screen");
  for (const s of FIRST_STEPS) { assert.ok(STEP_GROUPS.some((g) => g.id === s.group), s.id); assert.ok(s.title.length > 8 && s.title.length < 48 && s.what.length > 30 && s.icon && typeof s.done === "function", s.id); assert.ok(s.how.length >= 2 && s.how.every((h) => h.length > 30), `${s.id} : how`); }
  assert.deepEqual(FIRST_STEPS.map((s) => s.group), ["start", "design", "design", "design", "check", "check", "deliver", "deliver"], "the groups follow one another");
});

test("a step is done when the project shows it — nothing is declared by hand", () => {
  const none = firstSteps(null); assert.deepEqual([none.done, none.total, none.next.id], [0, 8, "project"]); assert.equal(firstStepsLine(none), "0 étape sur 8 — ensuite : ouvrir un projet");
  const empty = firstSteps({ parts: [], assemblies: [] }); assert.deepEqual([empty.done, empty.next.id], [1, "part"]); assert.equal(empty.steps.find((s) => s.id === "rules").done, false, "an empty project has corrected nothing");
  const p = demo(), F = firstSteps(p); assert.deepEqual(F.steps.map((s) => s.done), [true, true, true, true, false, true, false, false], "the demonstration : a product designed, nothing kept, reviewed or released yet"); assert.equal(F.next.id, "physics"); assert.equal(F.steps.filter((s) => s.next).length, 1);
  assert.equal(firstStepsLine(F), "5 étapes sur 8 — ensuite : la physique, par un modèle simple"); assert.deepEqual(F.groups.map((g) => g.steps.length), [1, 3, 2, 2]); assert.ok(F.steps.every((s) => s.hash === `#/${s.screen}` && s.color && s.groupLabel));
  p.physics = [{ id: "r1", model: "beam_cantilever_point" }]; assert.equal(firstSteps(p).next.id, "review");
  p.review = { items: { "part:DRV-BASE": { state: "ok" } } }; assert.equal(firstSteps(p).next.id, "release"); p.review.items["part:DRV-BASE"].state = "changed"; assert.equal(firstSteps(p).next.id, "review", "a review that no longer holds is to be done again");
  p.review.items["part:DRV-BASE"].state = "ok"; p.releases = [{ pn: "100-0001", rev: "A" }]; const all = firstSteps(p); assert.deepEqual([all.done, all.next], [8, null]); assert.equal(firstStepsLine(all), "Les 8 étapes sont faites");
  const q = demo(); q.assemblies[0].mates = []; assert.equal(firstSteps(q).steps.find((s) => s.id === "asm").done, false, "parts side by side are not an assembly"); for (const x of q.parts) x.interfaces = []; assert.equal(firstSteps(q).steps.find((s) => s.id === "iface").done, false);
  const r = demo(); delete r.parts[0].material; assert.equal(firstSteps(r).steps.find((s) => s.id === "rules").done, false, "a part without a material is still to be corrected");
});

test("the guide repeats the step of a screen, with how to do it, until the project shows it is done", () => {
  const p = demo(), tip = firstStepHere(p, "physics");
  assert.deepEqual([tip.level, tip.screen, tip.hash, tip.step], ["tip", "physics", "#/start", "physics"]); assert.match(tip.text, /^Premiers pas \(5\/8\) — La physique, par un modèle simple\. .*Choisissez un média/);
  assert.equal(firstStepHere(p, "assembly"), null, "a step that is done says nothing"); assert.equal(firstStepHere(p, "library"), null, "a screen that is no step says nothing"); assert.equal(firstStepHere(null, "home").step, "project");
  p.physics = [{ id: "r1" }]; assert.equal(firstStepHere(p, "physics"), null);
});
