/* A long operation says where it stands : a count read in its own words, the bytes of the kernel on its way, the time it has been running,
   and a word when nothing moves. What the veil of core/busy.js shows is worked out here. */
import test from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { countIn, ratioOf, bytesText, elapsedText, stallHint, STALL_MS, busyView } from "../../web/js/core/progress.js";
import { KERNEL_BYTES } from "../../web/js/cad/occ.js";

test("the count an operation writes in its words, and how far that is", () => {
  assert.deepEqual(countIn("Construction 1 / 24 : RVR-1010-01"), { done: 0, total: 24 }, "the first is being built : nothing is done yet"); assert.deepEqual(countIn("Mesure des chemins 5 / 12 : HV+ ↔ LV"), { done: 4, total: 12 });
  assert.deepEqual(countIn("Construction 24/24"), { done: 23, total: 24 }); assert.equal(countIn("Résolution… itération 40"), null); assert.equal(countIn("Construction de l'assemblage…"), null); assert.equal(countIn("7 / 3"), null, "a count past its total is no count"); assert.equal(countIn(""), null);
  assert.equal(ratioOf(0, 24), 0); assert.equal(ratioOf(12, 24), 0.5); assert.equal(ratioOf(30, 24), 1); assert.equal(ratioOf(-1, 24), 0); assert.equal(ratioOf(3, 0), null); assert.equal(ratioOf(undefined, 24), null);
});

test("bytes and time, as one reads them", () => {
  assert.equal(bytesText(8400000, 22980267), "8,4 / 23 Mo"); assert.equal(bytesText(0, 22980267), "0 / 23 Mo"); assert.equal(bytesText(22980267, 22980267), "23 / 23 Mo");
  assert.equal(elapsedText(0), ""); assert.equal(elapsedText(2999), "", "nothing for an operation that is quick"); assert.equal(elapsedText(3000), "3 s"); assert.equal(elapsedText(59999), "59 s"); assert.equal(elapsedText(65000), "1 min 05 s"); assert.equal(elapsedText(600000), "10 min 00 s"); assert.equal(elapsedText(NaN), "");
  assert.equal(stallHint(STALL_MS - 1, "download"), ""); assert.match(stallHint(STALL_MS, "download"), /Le téléchargement n'avance plus .* VPN .* annuler, puis réessayer/); assert.match(stallHint(STALL_MS, "work"), /plus long que prévu.*annuler/);
  assert.match(stallHint(STALL_MS, "drive"), /^Google Drive tarde à répondre : vérifiez la connexion\. Vous pouvez annuler/); assert.match(stallHint(STALL_MS, "drive", false), /Laissez-la finir : l'arrêter maintenant laisserait un travail à moitié écrit\.$/, "what must not be stopped half-way says so, and offers no cancel");
  assert.equal(stallHint(100, "drive", false), "");
});

test("what a veil shows : the kernel on its way first, then the operation, with its time and a word when nothing moves", () => {
  const t0 = 1000000;
  let v = busyView({ text: "Construction 1 / 24 : RVR-1010-01", stage: { text: "Chargement du noyau CAO", done: 8400000, total: 22980267 }, startedAt: t0, changedAt: t0 + 4000, now: t0 + 5000 });
  assert.equal(v.title, "Construction 1 / 24 : RVR-1010-01"); assert.equal(v.kind, "download"); assert.equal(v.sub, "Chargement du noyau CAO — 8,4 / 23 Mo, une seule fois"); assert.ok(Math.abs(v.ratio - 8400000 / 22980267) < 1e-9, "while the kernel arrives, the bar is the kernel's"); assert.equal(v.elapsed, "5 s"); assert.equal(v.hint, "");
  v = busyView({ text: "Construction 1 / 24 : RVR-1010-01", stage: { text: "Chargement du noyau CAO (une seule fois, environ 23 Mo)…", done: 0, total: 0 }, startedAt: t0, changedAt: t0, now: t0 + 20000 });
  assert.equal(v.ratio, null, "no byte yet : the bar says only that it waits"); assert.equal(v.kind, "download"); assert.match(v.sub, /environ 23 Mo/); assert.equal(v.elapsed, "20 s"); assert.match(v.hint, /Le téléchargement n'avance plus/, "what is awaited is the kernel : the veil says so");
  v = busyView({ text: "Construction 1 / 24 : RVR-1010-01", stage: { text: "Chargement du noyau CAO", done: 5000000, total: 22980267 }, startedAt: t0, changedAt: t0 + 2000, now: t0 + 2000 + STALL_MS });
  assert.match(v.hint, /Le téléchargement n'avance plus/, "bytes that stopped coming : the download is named");
  v = busyView({ text: "Construction 13 / 24 : RVR-2210-01", stage: { text: "", done: 0, total: 0 }, startedAt: t0, changedAt: t0 + 9000, now: t0 + 9500 });
  assert.equal(v.ratio, 0.5); assert.equal(v.sub, ""); assert.equal(v.kind, "work"); assert.equal(v.elapsed, "9 s"); assert.equal(v.hint, "");
  v = busyView({ text: "Mesure des chemins…", done: 3, total: 4, now: t0, startedAt: t0 }); assert.equal(v.ratio, 0.75, "numbers given win over the words");
  v = busyView({ text: "Résolution… itération 12", now: t0 + 1000, startedAt: t0 }); assert.equal(v.ratio, null, "no count : the bar says only that it runs"); assert.equal(v.elapsed, "");
  v = busyView({ text: "Écriture du projet dans votre Google Drive…", kind: "drive", canCancel: false, startedAt: t0, changedAt: t0, now: t0 + 16000 });
  assert.equal(v.kind, "drive"); assert.equal(v.ratio, null); assert.equal(v.elapsed, "16 s"); assert.match(v.hint, /Google Drive tarde à répondre.*Laissez-la finir/);
  v = busyView({ text: "Lecture de vos projets…", kind: "drive", stage: { text: "Chargement du noyau CAO", done: 100, total: 22980267 }, startedAt: t0, changedAt: t0, now: t0 + 16000 }); assert.equal(v.kind, "download", "the kernel on its way is what is awaited, whatever the screen was doing");
  v = busyView({ stage: { text: "Préparation du noyau CAO…", done: 22980267, total: 22980267 }, now: t0, startedAt: t0 }); assert.equal(v.title, "Préparation du noyau CAO…"); assert.equal(v.kind, "work", "all its bytes are here : the kernel is being prepared"); assert.equal(busyView().title, "En cours…");
});

test("the size the kernel download counts towards is the size of the file", () => {
  assert.equal(statSync(new URL("../../web/vendor/occ/replicad_single.wasm", import.meta.url)).size, KERNEL_BYTES);
});
