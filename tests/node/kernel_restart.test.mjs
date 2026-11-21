/* A kernel that has failed is not the part's fault (bug seen by JP, 21 novembre 2026 : a connector added from the library, « 32 erreur(s)
   de construction » in 3 ms — its 32 features, every one refused at once). The worker asks the kernel for a unit cube ; when it cannot,
   the page puts the kernel down, gives what was waiting to a fresh one, and builds the part once more.
     node --test tests/node/kernel_restart.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { whyOf } from "../../web/js/cad/features.js";

const workers = [];
class FakeWorker {                                   // the first kernel is sick, the next ones are well
  constructor() { this.n = workers.length; this.dead = false; this.got = []; workers.push(this); }
  postMessage(m) {
    this.got.push(m.cmd);
    setTimeout(() => {
      if (this.dead) return;
      if (m.spec && m.spec.crash && (m.spec.crash === "always" || this.n === m.spec.at)) { this.onerror({ message: "out of memory" }); return; }
      const sick = this.n === 0 || (m.spec && m.spec.alwaysSick);
      const result = m.cmd === "build" ? (sick ? { sick: true, log: [{ level: "error", msg: "Feature « a » : le noyau CAO a refusé cette géométrie (erreur interne)" }] } : { bodies: [{ name: "main" }], log: [], by: this.n }) : { by: this.n };
      this.onmessage({ data: { id: m.id, ok: true, result } });
    }, 5);
  }
  terminate() { this.dead = true; }
}
globalThis.Worker = FakeWorker;
const client = await import("../../web/js/cad/client.js");

test("a sick kernel is put down, a fresh one builds the part, and takes what was waiting", async () => {
  const [a, other] = await Promise.all([client.build({ id: "CN-1" }), client.call("ping")]);
  assert.equal(a.bodies.length, 1); assert.equal(a.by, 1, "built by the fresh kernel");
  assert.equal(other.by, 1, "the call that waited behind the build was given to the fresh kernel"); assert.equal(client.kernelRestarts(), 1);
  assert.ok(workers[0].dead); assert.deepEqual(workers[0].got, ["build", "ping"]); assert.deepEqual(workers[1].got, ["ping", "build"], "what waited goes first, then the build once more");
  assert.equal(await client.build({ id: "CN-1" }), a, "the same part is not built twice");
});

test("a kernel that stays sick says so, once, and asks for the page to be reloaded", async () => {
  await assert.rejects(client.build({ id: "CN-2", alwaysSick: true }), /ne construit plus rien, même relancé.*rechargez la page/);
  assert.equal(client.kernelRestarts(), 2, "one restart, not a loop");
});

test("an exception of the kernel itself is said in words ; the worker asks for a cube before blaming the kernel ; the studio shows the first error", () => {
  assert.equal(whyOf(new Error("Boîte de taille nulle")), "Boîte de taille nulle");
  assert.match(whyOf(123456), /erreur interne/); assert.equal(whyOf("x"), "x");
  const w = readFileSync(new URL("../../web/js/cad/worker.js", import.meta.url), "utf8");
  assert.match(w, /function healthy\(\)/); assert.match(w, /!built\.bodies\.length && .*!healthy\(\)\) return \{ result: \{ sick: true/);
  assert.match(readFileSync(new URL("../../web/js/modules/part_studio.js", import.meta.url), "utf8"), /info\.dataset\.tip = built\.log\.find/);
});

test("a kernel that stops altogether is started again once and takes what was waiting ; twice in a row, it says so", async () => {
  const at = workers.length - 1, r = await client.build({ id: "CN-3", crash: "once", at });
  assert.equal(r.by, at + 1, "built by the kernel started after the crash"); assert.equal(client.kernelRestarts(), 3);
  await assert.rejects(client.build({ id: "CN-4", crash: "always" }), /s'est arrêté : out of memory.*rechargez la page/);
});
