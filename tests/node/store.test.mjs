/* The store : one click makes one project, however slow the storage is. */
import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
const { store, freshName } = await import("../../web/js/core/store.js");

test("a second click while a project is still being written in Drive gives the same project, not a twin", async () => {
  let saves = 0; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  store.useDrive({ saveProject: async () => { saves++; await wait(40); return {}; } });               // a Drive that takes its time, as the real one does
  const [a, b] = await Promise.all([store.create("DEMO-HVB", { id: "demo-hvb" }), store.create("DEMO-HVB", { id: "demo-hvb" })]);
  assert.equal(a, b, "one project"); assert.equal(saves, 1, "written once"); assert.match(a.id, /^demo-hvb-[a-z0-9]+$/);
  const c = await store.create("Autre"); assert.notEqual(c, a); assert.equal(c.name, "Autre"); assert.equal(saves, 2, "once the first is written, the next click makes a new project");
});

test("a fresh copy of something already there is numbered, so that two folders never bear the same name", () => {
  const demo = "Variateur compact 400 V (démonstration)";
  assert.equal(freshName(demo, []), demo); assert.equal(freshName(demo, [demo]), `${demo} (2)`); assert.equal(freshName(demo, [demo, `${demo} (2)`, "Autre"]), `${demo} (3)`);
});
