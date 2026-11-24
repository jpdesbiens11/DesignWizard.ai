/* The two documents of a software, and the same in its C package (point 25 de la suite : « une spécification et un rapport d'essais en
   Word / PDF ; les exigences, les essais et la trace dans le paquet C »).
     node --test tests/node/sw_docs.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { KINDS } from "../../web/js/sw/sw_objects.js";
import { demoDesign } from "../../web/js/sw/sw_design.js";
import { cFiles } from "../../web/js/sw/sw_c.js";
import { cpuOf } from "../../web/js/sw/sw_cpu.js";
import { srsDoc, svrDoc, vDocFiles, vPackage, filesOf } from "../../web/js/sw/sw_docs.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { docx } from "../../web/js/core/docx.js";
import { METHODS } from "../../web/js/core/methods.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const D = new Date("2026-11-21T12:00:00Z");
const text = (doc) => doc.blocks.map((b) => [b.text, ...(b.items || []), ...(b.rows || []).flat().map((c) => (c && typeof c === "object" ? c.text : c)), ...(b.head || []), b.caption].filter(Boolean).join(" ")).join("\n");
const rowsOf = (doc, head0) => doc.blocks.filter((b) => b.type === "table" && b.head && b.head[0] === head0).flatMap((b) => b.rows);
const sure = (d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, sure: KINDS[o.kind].params.map((p) => p.key) })) });

test("the specification : every requirement, its kind, proof, tiles and state ; the reference as read ; the low-level requirements ; the trace down to the files", () => {
  const d = demoDesign(), S = srsDoc(d, { date: D, author: "Rédacteur" }), all = text(S);
  assert.deepEqual(S.blocks.filter((b) => b.type === "h1").map((b) => b.text.replace(/^\d+\. /, "")), ["Objet du document", "La référence suivie", "Les exigences du logiciel", "Ce que l'outil a trouvé dans les phrases", "Les exigences de bas niveau — ce que fait chaque tuile", "La traçabilité", "Ce qui est vérifié, ce qui ne l'est pas"]);
  assert.equal(S.reference, `${d.id}-SRS`); assert.match(S.title, /Spécification des exigences du logiciel/);
  const R = rowsOf(S, "N°").filter((r) => /^SWR-/.test(r[0])); assert.deepEqual(R.map((r) => r[0].split(" ")[0]).sort(), ["SWR-001", "SWR-002", "SWR-003", "SWR-004", "SWR-005", "SWR-006"]);
  assert.ok(R.every((r) => /\(exemple\)/.test(r[0])), "an example says so on its line"); assert.match(all, /6 exigences.*sont des exemples proposés par l'outil/);
  assert.equal(R.find((r) => r[0].startsWith("SWR-001"))[4].text, "Vérifiée", "the state is read from the trace, with its tests run");
  assert.match(all, /Aucun référentiel choisi/); assert.match(all, /DO-178C — Wikipedia/);
  const L = rowsOf(S, "Tuile"); assert.equal(L.length, d.objects.length); assert.ok(L.every((r) => /app\/bms_app\.c/.test(r[3])), "each tile names the files of C that carry it");
  const Tr = rowsOf(S, "Exigence"); assert.match(Tr.find((r) => r[0] === "SWR-001")[2], /lib\/dw_limit\.c/); assert.equal(Tr.find((r) => r[0] === "SWR-001")[3], "TC-001");
  assert.match(all, /aucun gabarit d'une norme n'a été lu/); assert.match(all, /Aucune prétention de conformité/);
  const x = demoDesign(); x.std = { ref: "do178c", level: "A" }; x.reqs[1].text = "Le logiciel doit fermer rapidement."; x.reqs[2].on = false; x.reqs[1].objs = x.reqs[1].objs.filter((o) => o !== "req");
  const X = text(srsDoc(x, { date: D })); assert.match(X, /71 objectifs, dont 30 avec indépendance/); assert.match(X, /Mot vague « rapidement »/); assert.match(X, /Mises de côté \(Off\)/); assert.match(X, /Tuiles qu'aucune exigence ne demande : Entrée : demande de fermeture/);
  assert.ok(!rowsOf(srsDoc(x, { date: D }), "Exigence").some((r) => r[0] === "SWR-003"), "a requirement Off leaves the trace");
});

test("the report : the run on the model, each test with its scenario and its checks, the matrix, the coverage of the model, the list of delivery", () => {
  const d = demoDesign(), V = svrDoc(d, { date: D, version: "0.129.0" }), all = text(V);
  assert.equal(V.reference, `${d.id}-SVR`); assert.equal(V.run.passed, 5);
  assert.deepEqual(V.blocks.filter((b) => b.type === "h2").map((b) => b.text.split(" — ")[0]), ["TC-001", "TC-002", "TC-003", "TC-004", "TC-005"]);
  assert.match(all, /5 réussis, 0 échoué, 0 qui n'attend rien — sur 5/); assert.match(all, /5 sur 5/); assert.match(all, /0 sur 1/, "the analysis not signed yet");
  assert.match(all, /ont tourné sur le MODÈLE.*version 0\.129\.0/); assert.match(all, /Ils n'ont tourné ni sur la carte ni sur le CPU/);
  const checks = rowsOf(V, "Ce que l'on attend"); assert.ok(checks.length >= 9 && checks.every((r) => r[2].text === "réussi"));
  const sc = rowsOf(V, "Broche"); assert.ok(sc.some((r) => r[1] === "mV" && /^0 : \d+ ; 500 : \d+$/.test(r[2])), "the scenario in the unit the pin measures");
  assert.match(all, /couverture structurelle.*n'est pas mesurée ici/); assert.match(all, /Prêt à livrer non/);
  assert.equal(rowsOf(V, "Point").length, 9);
  const late = demoDesign(); late.tests[0].expect[1].within = [500, 520]; const L = svrDoc(late, { date: D }); assert.match(text(L), /TC-001 échoue : l'exigence qu'il prouve n'est pas tenue/); assert.equal(rowsOf(L, "Exigence").find((r) => r[0].startsWith("SWR-001"))[4].text, "Essai échoué");
});

test("both documents are written by the template of the platform : a PDF and a Word file, branded", () => {
  const d = demoDesign();
  for (const doc of [srsDoc(d, { date: D }), svrDoc(d, { date: D })]) {
    const p = pdfDoc(doc), w = docx(doc), head = (b) => String.fromCharCode(...new Uint8Array(b.buffer || b).slice(0, 4));
    assert.equal(head(p), "%PDF"); assert.equal(head(w), "PK\u0003\u0004"); assert.ok((p.length || p.byteLength) > 10000);
  }
  const ui = read("web/js/modules/sw_docs_ui.js"); assert.match(ui, /\.\.\.docMeta\(\)/, "the identity of the project : title block, approvals, confidentiality"); assert.match(ui, /download\(/); assert.doesNotMatch(ui, /new Blob/);
});

test("the package carries the requirements and the verification, in plain ASCII, and still compiles back to back", () => {
  const d = demoDesign(), cpu = cpuOf(d), F = vPackage(d, cpu), C = cFiles(d, { cpu });
  assert.equal(F.length, C.length + 2); const req = F.find((f) => f.name === "bms/doc/REQUIREMENTS.md").text, ver = F.find((f) => f.name === "bms/doc/VERIFICATION.md").text;
  for (const t of [req, ver]) { assert.doesNotMatch(t, /[^\n\x20-\x7e]/, "plain ASCII, as every file of the package"); assert.match(t, /DynamiteOrbit.ai\(TM\)/); }
  for (const id of ["SWR-001", "SWR-002", "SWR-003", "SWR-004", "SWR-005", "SWR-006"]) assert.match(req, new RegExp(`\\| ${id} \\(example\\) \\|`));
  assert.match(req, /\| SWR-001 \(example\) \| Safety \|.*lib\/dw_limit\.c.*\| TC-001 \|/); assert.match(req, /none chosen yet/);
  assert.match(ver, /did NOT run on the board nor on the CPU/); assert.match(ver, /5 passed, 0 failed/); assert.match(ver, /## TC-003/); assert.match(ver, /structural coverage of the C/);
  assert.match(F.find((f) => f.name === "bms/README.md").text, /doc\/REQUIREMENTS\.md/);
  assert.equal(vPackage({ ...d, reqs: [], tests: [] }, cpu).length, C.length, "a design without requirements nor tests : the package as before");
  assert.deepEqual(filesOf({ kind: "pin_dout" }), ["io/bms_io.h", "hal/hal.h", "app/bms_app.c"]);
  const cc = spawnSync("cc", ["--version"]); if (cc.status !== 0) return;      // no compiler on this computer : the back to back is held elsewhere
  const s = sure(demoDesign()), dir = mkdtempSync(join(tmpdir(), "dwdocs-")); for (const f of vPackage(s, cpuOf(s))) { const p = join(dir, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  const b = join(dir, "bms"), r = spawnSync("sh", ["-c", "cc -std=c99 -Wall -Wextra -pedantic -Werror -Ilib -Icfg -Iio -Iapp -Ihal lib/*.c cfg/*.c app/*.c hal/host/*.c test/*.c -o bms_test && ./bms_test > got.txt && cmp got.txt test/expected.txt"], { cwd: b, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("wired : three screens, the package, the sources and the news", () => {
  assert.match(read("web/js/modules/sw_req.js"), /docRow\(d, "srs"\)/); assert.match(read("web/js/modules/sw_verify.js"), /docRow\(d, "svr"\)/);
  const sw = read("web/js/modules/sw.js"); assert.match(sw, /docsSection\(d\)/); assert.match(sw, /vPackage\(d, cpuOf\(d\)\)/); assert.doesNotMatch(sw, /cFiles\(/, "the screen writes the package with its documents");
  const m = METHODS.find((x) => x.id === "sw-docs"); assert.ok(m && m.how === "usual" && /aucun gabarit/.test(m.check));
  assert.ok(NEWS.some((n) => n.v === "0.129.0" && n.where === "#/swrel" && /data-sw-docs/.test(n.sel)));
  assert.match(read("docs/LOGICIEL.md"), /doc\/REQUIREMENTS\.md/);
});
