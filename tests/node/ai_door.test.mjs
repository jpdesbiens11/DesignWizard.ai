/* The door « Avec l'IA » of the Shop (demandes de JP) : the instruction proposed, the answer read whatever its shape, the plan
   shown before anything enters — what is created, changed, set aside, and where — one step to apply, and the way back. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { SCOPES, doorPrompt, readAnswer, planAnswer, planWords, planApplies, applyPlan, revertEntry, journalLines } from "../../web/js/core/ai_door.js";
import { unzip, unzipTexts } from "../../web/js/core/unzip.js";
import { zip, crc32 } from "../../web/js/core/zip.js";
import { toDwiz } from "../../web/js/core/dwiz.js";
import { levelsOf } from "../../web/js/core/shop_levels.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const demo = () => JSON.parse(JSON.stringify(DEMO_DRIVE)), copy = (o) => JSON.parse(JSON.stringify(o));
const fresh = (P, id, name) => ({ ...copy(P.parts.find((p) => p.id === "DRV-FOOT")), id, name });

test("the instruction : the sentence, what to return, what the project gives, and the language of a part", () => {
  const P = demo(), t = doorPrompt(P, { ask: "un capot de ventilation", scope: "assembly" });
  assert.match(t, /CE QUE JE VEUX : un capot de ventilation/); assert.match(t, /un ASSEMBLAGE complet/); assert.match(t, /"assemblies": \[/); assert.match(t, /DRV-BASE — Base du boîtier/); assert.match(t, /INTERFACES LIBRES/);
  assert.match(t, /pose-moi tes questions UNE À UNE/); assert.match(t, /LANGAGE D'UNE PIÈCE/); assert.match(t, /à confirmer/); assert.ok(t.split("\n").length > 80, "the language of a part is joined");
  const bare = doorPrompt(P, { ask: "x", scope: "part", context: false, questions: false }); assert.ok(!/DRV-BASE/.test(bare) && !/INTERFACES LIBRES/.test(bare) && !/UNE À UNE/.test(bare)); assert.match(bare, /UNE pièce/); assert.ok(!/"assemblies"/.test(bare));
  assert.match(doorPrompt(P, {}), /\(à dire en une phrase\)/); assert.deepEqual(SCOPES.map((s) => s.key), ["part", "parts", "assembly"]); assert.ok(!/@|https?:\/\//.test(t.split("LANGAGE D'UNE PIÈCE")[0]), "no address, no link in what the tool writes around the project");
});
test("an answer is read whatever its shape : .dwiz, JSON in a code block, a project, a list — and what is not one is said", () => {
  const P = demo(), part = fresh(P, "NEW-1", "Équerre"), asm = { dw: "assembly/1", id: "ASM-N", name: "Ens", instances: [{ id: "i1", part: "DRV-BASE", fixed: true }, { id: "i2", part: "NEW-1" }] };
  const a = readAnswer([{ name: "r.md", text: "Voici la réponse :\n```json\n" + JSON.stringify({ parts: [part], assemblies: [asm] }) + "\n```\nÀ vérifier : l'épaisseur." }]);
  assert.deepEqual(a.docs.map((d) => `${d.kind}:${d.doc.id}`), ["part:NEW-1", "assembly:ASM-N"]); assert.equal(a.errors.length, 0); assert.equal(a.docs[0].from, "r.md");
  const b = readAnswer([{ name: "p.dwiz", text: toDwiz(part) }, { name: "a.json", text: JSON.stringify(asm) }, { name: "vide.txt", text: "  " }]); assert.deepEqual(b.docs.map((d) => d.kind), ["part", "assembly"]); assert.equal(b.docs[0].doc.id, "NEW-1");
  assert.deepEqual(readAnswer([{ name: "l.json", text: JSON.stringify([part, { ...part, id: "NEW-2" }]) }]).docs.map((d) => d.doc.id), ["NEW-1", "NEW-2"]);
  const bad = readAnswer([{ name: "bla.txt", text: "Je n'ai pas compris la demande." }, { name: "o.json", text: JSON.stringify({ hello: 1 }) }]); assert.equal(bad.docs.length, 0); assert.equal(bad.errors.length, 2); assert.match(bad.errors[0].message, /ni \.dwiz ni JSON/); assert.match(bad.errors[1].message, /ni une pièce ni un assemblage/);
  assert.deepEqual(readAnswer(null), { docs: [], errors: [] });
});
test("the plan says what would be created, changed, left as it is or set aside — and where each thing goes", () => {
  const P = demo(), part = fresh(P, "NEW-1", "Équerre"), changed = { ...copy(P.parts.find((p) => p.id === "DRV-COVER")), name: "Couvercle ventilé" }, same = copy(P.parts.find((p) => p.id === "DRV-ISO"));
  const broken = { id: "BAD-1", name: "Cassée", dw: "assembly/9", features: "non" }, twice = fresh(P, "NEW-1", "Doublon");
  const asmOk = { id: "ASM-N", name: "Ensemble", instances: [{ id: "i1", part: "DRV-BASE", fixed: true }, { id: "i2", part: "NEW-1" }] }, asmLost = { id: "ASM-X", instances: [{ id: "i1", part: "NOPE" }] };
  const docs = [part, changed, same, twice].map((doc) => ({ kind: "part", doc })).concat([{ kind: "part", doc: broken }, { kind: "assembly", doc: asmOk }, { kind: "assembly", doc: asmLost }, { kind: "assembly", doc: { id: "ASM-0", instances: [] } }]);
  const rows = planAnswer(P, docs), by = (id, k = 0) => rows.filter((r) => r.id === id)[k];
  assert.equal(by("NEW-1").action, "create"); assert.match(by("NEW-1").where, /^Atelier ▸ Sheet metal$/); assert.match(by("NEW-1").detail, /Pièce nouvelle/); assert.equal(by("NEW-1", 1).action, "skip"); assert.match(by("NEW-1", 1).why, /deux fois/);
  assert.equal(by("DRV-COVER").action, "modify"); assert.equal(by("DRV-COVER").changes, 1); assert.match(by("DRV-COVER").where, /Atelier ▸ Molded/); assert.equal(by("DRV-ISO").action, "same"); assert.equal(by("DRV-ISO").doc, null);
  assert.equal(by("BAD-1").action, "skip"); assert.ok(by("BAD-1").why.length > 10); assert.equal(by("ASM-N").action, "create"); assert.equal(by("ASM-N").where, "Mécanique ▸ Assemblage"); assert.equal(by("ASM-N").doc.pendingAutoMate, true, "no mate given : the assembly mates by its interfaces when it opens");
  assert.equal(by("ASM-X").action, "skip"); assert.match(by("ASM-X").why, /pièce absente : NOPE/); assert.match(by("ASM-0").why, /aucune pièce/);
  assert.equal(planWords(rows), "2 créations, 1 modification, 1 sans changement, 4 écarts"); assert.ok(planApplies(rows)); assert.ok(!planApplies(rows.filter((r) => r.action === "skip"))); assert.equal(planWords([]), "rien à appliquer");
  assert.deepEqual(P, demo(), "the plan changes nothing");
  const noId = planAnswer(P, [{ kind: "part", doc: { ...part, id: "" } }])[0]; assert.match(noId.id, /^P-\d{3}$/); assert.equal(noId.action, "create");
});
test("applying is one change of the project ; the journal goes back to before, and keeps what something else came to use", () => {
  const P = demo(), before = copy(P), part = fresh(P, "NEW-1", "Équerre"), changed = { ...copy(P.parts.find((p) => p.id === "DRV-COVER")), name: "Couvercle ventilé" };
  const rows = planAnswer(P, [{ kind: "part", doc: part }, { kind: "part", doc: changed }, { kind: "assembly", doc: { id: "ASM-N", name: "Ens", instances: [{ id: "i1", part: "NEW-1", fixed: true }] } }]);
  const e = applyPlan(P, rows, { ask: "un capot", when: "2026-11-20T10:00:00.000Z" });
  assert.deepEqual(e.created.map((c) => c.id), ["NEW-1", "ASM-N"]); assert.deepEqual(e.modified.map((m) => m.id), ["DRV-COVER"]); assert.equal(P.parts.find((p) => p.id === "DRV-COVER").name, "Couvercle ventilé"); assert.equal(P.parts.length, before.parts.length + 1); assert.equal(P.assemblies.length, before.assemblies.length + 1);
  assert.deepEqual(journalLines(P), [{ id: e.id, when: "2026-11-20T10:00:00.000Z", ask: "un capot", words: "2 créés, 1 modifié" }]); assert.doesNotThrow(() => toDwiz(P), "a project with its journal still writes as .dwiz");
  const back = revertEntry(P, e.id); assert.deepEqual(back, { removed: ["ASM-N", "NEW-1"], restored: ["DRV-COVER"], kept: [] }); assert.deepEqual(P.parts, before.parts); assert.deepEqual(P.assemblies, before.assemblies); assert.deepEqual(P.aiJournal, []);
  const Q = demo(), e2 = applyPlan(Q, planAnswer(Q, [{ kind: "part", doc: fresh(Q, "NEW-2", "Patte") }]), {}); Q.assemblies[0].instances.push({ id: "i99", part: "NEW-2" });
  const kept = revertEntry(Q, e2.id); assert.deepEqual(kept.kept, [{ id: "NEW-2", why: `montée dans ${Q.assemblies[0].id}` }]); assert.ok(Q.parts.some((p) => p.id === "NEW-2"), "a part an assembly mounts is not taken away under it");
  assert.deepEqual(revertEntry(Q, "nope"), { removed: [], restored: [], kept: [] });
  const R = demo(); for (let i = 0; i < 25; i++) applyPlan(R, planAnswer(R, [{ kind: "part", doc: fresh(R, `N-${i}`, "x") }]), {}); assert.equal(R.aiJournal.length, 20, "the journal keeps the last twenty answers");
});
test("a .zip is read without a library : stored and deflated entries, what a system adds is left, and a file that is not one is said", async () => {
  const stored = zip([{ name: "consigne.md", bytes: "bonjour" }, { name: "pieces/a.dwiz", bytes: "dwiz part/1\n" }, { name: "image.png", bytes: new Uint8Array([1, 2, 3]) }, { name: "__MACOSX/x", bytes: "x" }, { name: ".DS_Store", bytes: "x" }]);
  const a = await unzip(stored); assert.deepEqual(a.files.map((f) => f.name), ["consigne.md", "pieces/a.dwiz", "image.png"]);
  const t = await unzipTexts(stored); assert.deepEqual(t.texts, [{ name: "consigne.md", text: "bonjour" }, { name: "pieces/a.dwiz", text: "dwiz part/1\n" }]); assert.deepEqual(t.skipped, [{ name: "image.png", why: "ni .dwiz, ni .json, ni texte" }]);
  /* one deflated entry, written by hand : local header, data, central directory, end */
  const name = new TextEncoder().encode("r.json"), raw = new TextEncoder().encode(JSON.stringify({ parts: [], note: "é".repeat(400) })), data = new Uint8Array(deflateRawSync(raw)), crc = crc32(raw);
  const local = new DataView(new ArrayBuffer(30)); local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(8, 8, true); local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, raw.length, true); local.setUint16(26, name.length, true);
  const cen = new DataView(new ArrayBuffer(46)); cen.setUint32(0, 0x02014b50, true); cen.setUint16(10, 8, true); cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, raw.length, true); cen.setUint16(28, name.length, true); cen.setUint32(42, 0, true);
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, 1, true); end.setUint16(10, 1, true); end.setUint32(12, 46 + name.length, true); end.setUint32(16, 30 + name.length + data.length, true);
  const z = new Uint8Array([...new Uint8Array(local.buffer), ...name, ...data, ...new Uint8Array(cen.buffer), ...name, ...new Uint8Array(end.buffer)]);
  assert.ok(data.length < raw.length, "the entry really is compressed"); const d = await unzipTexts(z); assert.equal(d.texts.length, 1); assert.equal(JSON.parse(d.texts[0].text).note.length, 400);
  assert.deepEqual((await unzip(z, { maxBytes: 100 })).skipped, [{ name: "r.json", why: "fichier trop gros" }]);
  await assert.rejects(() => unzip(new TextEncoder().encode("ceci n'est pas une archive, mais un texte assez long pour être lu")), /pas une archive \.zip/);
});
test("in the screens : the door of the floor leads to the page, which has its place on the path and gives its list to the guide", async () => {
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8"), ui = read("shop_ai.js");
  assert.match(read("shop.js"), /args\[0\] === "ai" \? aiDoor\(main\)/); assert.match(read("shop_floor.js"), /\["#\/shop\/ai", "sparkle"/);
  assert.deepEqual(levelsOf("shop", ["ai"], demo()).crumbs.map((c) => c.label), ["Atelier", "Nouvelles pièces · avec l'IA"]);
  assert.match(ui, /store\.commit\(`Réponse d'IA appliquée/, "one step"); assert.equal((ui.match(/applyPlan\(/g) || []).length, 1); assert.match(ui, /revertEntry\(x, l\.id\)/); assert.match(ui, /setGuide\(doorIssues\(st\)/); assert.match(ui, /download\(`/, "a file leaves by download()"); assert.ok(!/fetch\(|XMLHttpRequest/.test(ui), "the tool calls no AI");
  const { doorIssues } = await import("../../web/js/modules/shop_ai.js").catch(() => ({ doorIssues: null }));
  if (doorIssues) { assert.equal(doorIssues({ ask: "" })[0].level, "todo"); assert.ok(doorIssues({ ask: "x", rows: [{ action: "skip" }] }).some((x) => x.level === "check")); assert.ok(doorIssues({ ask: "x", errors: [{ from: "a", message: "b" }] }).some((x) => x.level === "error")); }
});
