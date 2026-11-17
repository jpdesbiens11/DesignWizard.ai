/* A send to Onshape that the person stops : nothing more is sent, what Onshape already holds stays, and the result says so. */
import test from "node:test";
import assert from "node:assert/strict";
import { pushToOnshape } from "../../web/js/onshape/push.js";

/* a double of the Onshape client : it counts what is asked of it, and can flip the signal at a chosen call */
function double(signal, stopAt) {
  const calls = [], hit = (name) => { calls.push(name); if (stopAt && stopAt(name, calls)) signal.off = true; };
  let n = 0;
  return { calls,
    status: async () => ({ baseUrl: "https://cad.example" }),
    listElements: async () => { hit("list"); return n++ === 0 ? [] : [{ id: "ps1", name: "P-1 Base", elementType: "PARTSTUDIO" }, { id: "ps2", name: "P-2 Cover", elementType: "PARTSTUDIO" }, { id: "as1", name: "ASM Demo", elementType: "ASSEMBLY" }]; },
    importFile: async (o) => { hit(`import:${o.kind}`); return o.kind === "step" ? { translationId: "t1" } : { elementId: `pdf${calls.length}` }; },
    waitTranslation: async (tid, o) => { hit("translate"); o.onTick({ elapsedMs: 1500 }); return { state: "DONE", resultElementIds: ["ps1", "ps2", "as1"] }; },
    partsOf: async (did, wid, eid) => { hit("parts"); return [{ partId: `${eid}-p`, name: eid === "ps1" ? "P-1 Base" : "P-2 Cover" }]; },
    createDrawing: async () => { hit("drawing"); return { elementId: `dr${calls.length}`, warnings: [] }; },
    modifyDrawing: async () => { hit("annotate"); return { requestId: "r1" }; },
    waitModify: async () => ({ state: "DONE", output: { results: [] } }),
    setMetadata: async () => { hit("metadata"); return { skipped: [] }; } };
}
const job = (signal) => ({ did: "d1", wid: "w1", assemblyName: "ASM Demo", stepText: "ISO-10303-21;", signal, options: { nativeDrawings: true, attachPdf: true, setMetadata: true },
  parts: [{ id: "P-1", name: "P-1 Base", revision: "A", material: "Al", pdfBytes: new Uint8Array([37, 80, 68, 70]) }, { id: "P-2", name: "P-2 Cover", revision: "A", material: "Al", pdfBytes: new Uint8Array([37, 80, 68, 70]) }] });
const count = (calls, name) => calls.filter((c) => c === name).length;

test("Onshape — a send that nobody stops goes to its end", async () => {
  const signal = { off: false }, A = double(signal), said = [];
  const res = await pushToOnshape(job(signal), (p) => said.push(p), A);
  assert.equal(res.ok, true); assert.equal(res.stopped, undefined); assert.equal(res.elements.pdfs.length, 2); assert.equal(res.elements.drawings.length, 2);
  assert.equal(count(A.calls, "metadata"), 2); assert.equal(said[said.length - 1].label, "Envoi vers Onshape terminé"); assert.ok(!res.warnings.some((w) => /arrêté/.test(w)));
  const plain = await pushToOnshape({ ...job(), signal: undefined }, null, double({ off: false })); assert.equal(plain.ok, true, "a job without a signal is sent as before");
});

test("Onshape — stopped while the PDF drawings go : the one in flight ends, nothing follows, and the result says what is already there", async () => {
  const signal = { off: false }, A = double(signal, (name, calls) => name === "import:pdf" && count(calls, "import:pdf") === 1), said = [];
  const res = await pushToOnshape(job(signal), (p) => said.push(p), A);
  assert.equal(res.stopped, true); assert.equal(res.ok, true, "the STEP had been converted : the document holds the 3D");
  assert.equal(res.elements.pdfs.length, 1, "the PDF in flight is counted"); assert.equal(count(A.calls, "import:pdf"), 1); assert.equal(count(A.calls, "drawing"), 0); assert.equal(count(A.calls, "metadata"), 0);
  assert.equal(res.warnings.filter((w) => /^Envoi arrêté à votre demande/.test(w)).length, 1, "said once"); assert.match(res.warnings.find((w) => /^Envoi arrêté/.test(w)), /déjà créé dans Onshape y reste.*Correctif : relancez l'envoi/);
  assert.equal(said[said.length - 1].label, "Envoi vers Onshape arrêté"); assert.equal(said[said.length - 1].done, said[said.length - 1].total);
});

test("Onshape — stopped while Onshape converts the STEP, or before anything left : the wait ends there", async () => {
  let signal = { off: false }, A = double(signal, (name) => name === "translate");
  let res = await pushToOnshape(job(signal), null, A);
  assert.equal(res.stopped, true); assert.equal(res.ok, false, "the conversion was not waited for"); assert.equal(count(A.calls, "import:pdf"), 0); assert.equal(count(A.calls, "parts"), 0);
  assert.ok(!res.warnings.some((w) => /^Conversion du STEP/.test(w)), "a wait that was stopped is not reported as a failure of Onshape");
  signal = { off: true }; A = double(signal); res = await pushToOnshape(job(signal), null, A);
  assert.equal(res.stopped, true); assert.equal(count(A.calls, "import:step"), 0, "stopped before the STEP left : nothing was sent"); assert.equal(res.warnings.length, 1);
});
