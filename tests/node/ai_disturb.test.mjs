/* Points 2 and 9 c (JP, 20 novembre 2026) : at the import of an answer of an AI, the preview says also WHAT IT DISTURBS — interfaces that no
   longer match, broken mates, DFx findings, cases to run again, drawings to redo — and the answer is accepted artefact by artefact.
     node --test tests/node/ai_disturb.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { disturbs, planDisturbs, disturbWords, acceptRows, DISTURB_LEVELS } from "../../web/js/core/ai_disturb.js";
import { planAnswer, readAnswer } from "../../web/js/core/ai_door.js";
import { toDwiz } from "../../web/js/core/dwiz.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const project = () => JSON.parse(JSON.stringify(DEMO_DRIVE));
const clone = (x) => JSON.parse(JSON.stringify(x));

test("a part : an interface another part carries that goes or changes, a mate that names it, the assemblies that mount it", () => {
  const P = project(), base = P.parts.find((p) => p.id === "DRV-BASE"), doc = clone(base);
  doc.interfaces = doc.interfaces.filter((i) => i.id !== "IF2");
  const D = disturbs(P, "part", "DRV-BASE", doc);
  const gone = D.find((x) => x.kind === "interface" && x.level === "break"); assert.ok(gone, "the interface goes"); assert.match(gone.text, /DRV-CTRL-PCB la porte encore/); assert.deepEqual(gone.target, { kind: "part", id: "DRV-CTRL-PCB" });
  const mate = D.find((x) => x.kind === "mate"); assert.ok(mate); assert.match(mate.text, /DRV-ASM \(M2\)/); assert.equal(mate.level, "break");
  const same = disturbs(P, "part", "DRV-BASE", clone(base)); assert.deepEqual(same, [], "the same part disturbs nothing");
  const back = readAnswer([{ name: "x", text: toDwiz(base) }]).docs[0].doc; assert.deepEqual(disturbs(P, "part", "DRV-BASE", back), [], "nor the same part read back from a .dwiz, its keys in another order");
  const renamed = clone(base); renamed.name = "Socle"; assert.deepEqual(disturbs(P, "part", "DRV-BASE", renamed), [], "a new name moves no geometry");
  const moved = clone(base); moved.ops = [...(moved.ops || []), { op: "fillet", r: 1 }]; const M = disturbs(P, "part", "DRV-BASE", moved);
  assert.ok(M.some((x) => x.kind === "assembly" && /DRV-ASM monte cette pièce/.test(x.text)), "the assembly that mounts it is to look at");
  assert.deepEqual(disturbs(P, "part", "NEW-PART", doc), [], "a new artefact disturbs nothing that exists");
});

test("what reads the part : its analysis, its load case, its detail views, its frozen revision", () => {
  const P = project(), base = P.parts.find((p) => p.id === "DRV-BASE");
  P.physics = [{ id: "C1", model: "beam", part: "DRV-BASE", name: "Flexion du socle" }]; P.cases = [{ id: "DRV-BASE", conds: [] }]; base.details = [{ id: "D", on: true }];
  P.plm = { releases: [{ key: "part:DRV-BASE", pn: "PRT-1", rev: "A", sig: "x", state: "frozen" }] };
  const doc = clone(base); doc.ops = [...(doc.ops || []), { op: "fillet", r: 2 }]; const D = disturbs(P, "part", "DRV-BASE", doc), kinds = D.map((x) => x.kind);
  for (const k of ["analysis", "case", "drawing", "revision"]) assert.ok(kinds.includes(k), k);
  assert.match(D.find((x) => x.kind === "analysis").text, /Flexion du socle.*à refaire/); assert.equal(D.find((x) => x.kind === "case").level, "redo"); assert.match(D.find((x) => x.kind === "revision").text, /PRT-1 rév\. A est gelée/);
});

test("an assembly : occurrences taken out, the assembly above, the case, the isolation, the drawing", () => {
  const P = project(), a = P.assemblies[0], doc = clone(a); doc.instances = doc.instances.slice(0, -1); doc.mates = doc.mates.slice(0, -1);
  P.assemblies.push({ id: "TOP", instances: [{ id: "s1", asm: a.id }], mates: [] }); P.cases = [{ id: a.id }];
  const D = disturbs(P, "assembly", a.id, doc), t = D.map((x) => x.text).join("\n");
  assert.match(t, /1 occurrence retirée \(i6\) : ce qui la nommait/); assert.match(t, /TOP porte cet assemblage/); assert.match(t, /simulation de cet assemblage : à relancer/); assert.match(t, /dessin d'ensemble/);
});

test("a board : its twin follows, the readings of a block it takes out, its isolation and its lab to redo", () => {
  const P = project(); P.boards = [{ id: "B", part: "DRV-PWR-PCB", board: { w: 50 }, blocks: [{ id: "B1", template: "ldo" }, { id: "B2", template: "led" }], parts: [], nets: [], tracks: [], isolation: { at: 1 }, lab: { readings: [{ test: "B2/levels", what: "x", value: 1 }, { test: "BOARD/powerup", what: "y", value: 2 }] } }];
  const doc = clone(P.boards[0]); doc.blocks = [doc.blocks[0]]; doc.board = { w: 60 }; doc.parts = [{ ref: "R1" }];
  const D = disturbs(P, "board", "B", doc), t = D.map((x) => x.text).join("\n");
  assert.match(t, /jumeau mécanique DRV-PWR-PCB suivra/); assert.match(t, /1 relevé du Labo appartient à un bloc que la réponse retire/); assert.match(t, /isolation de la carte/); assert.match(t, /essais du Labo des blocs changés/);
});

test("a whole plan : what each modified row disturbs ; the words ; the levels each with a colour", () => {
  const P = project(), base = clone(P.parts.find((p) => p.id === "DRV-BASE")); base.interfaces = base.interfaces.filter((i) => i.id !== "IF2");
  const rows = planAnswer(P, [{ kind: "part", doc: base }, { kind: "part", doc: { dw: "part/1", id: "NEW-1", name: "Nouvelle", ops: [{ op: "box", w: 10, d: 10, h: 2 }] } }]);
  const M = planDisturbs(P, rows); assert.ok(M.get("part:DRV-BASE").length >= 2); assert.equal(M.has("part:NEW-1"), false, "a creation disturbs nothing");
  assert.match(disturbWords(M.get("part:DRV-BASE")), /^\d+ rompus?(, \d+ à (refaire|regarder))*$/); assert.equal(disturbWords([{ level: "break" }, { level: "break" }, { level: "redo" }]), "2 rompus, 1 à refaire");
  assert.equal(disturbWords([]), "rien ailleurs");
  for (const l of Object.values(DISTURB_LEVELS)) assert.ok(/^#[0-9a-f]{6}$/.test(l.color) && l.icon && l.fr);
});

test("accepted artefact by artefact : a creation refused takes with it what needs it — an assembly that mounts it, a drawing of it", () => {
  const R = acceptRows([{ kind: "part", id: "P-9", action: "create", doc: {}, off: true }, { kind: "part", id: "P-8", action: "create", doc: {} }, { kind: "assembly", id: "A9", action: "create", doc: { instances: [{ id: "i1", part: "P-8" }, { id: "i2", part: "P-9" }] } }, { kind: "drawing", id: "A9 · feuille", action: "modify", of: "assembly", target: "A9", doc: {} }, { kind: "assembly", id: "A8", action: "create", doc: { instances: [{ id: "i1", part: "P-8" }] } }]);
  assert.deepEqual(R.map((r) => [r.id, !!r.off, r.offBy || ""]), [["P-9", true, ""], ["P-8", false, ""], ["A9", true, "P-9"], ["A9 · feuille", true, "A9"], ["A8", false, ""]]);
});

test("wired : the door shows each row's disturbances and an On / Off per artefact ; the common loop shows them too", () => {
  const door = read("web/js/modules/shop_ai.js"), loop = read("web/js/modules/ai_loop.js");
  assert.match(door, /planDisturbs\(/); assert.match(door, /acceptRows\(/); assert.match(door, /onOff\(/); assert.match(door, /\.filter\(\(r\) => !r\.off\)/, "only what is accepted is applied");
  assert.match(loop, /disturbBox\(/); assert.match(read("web/js/modules/ai_disturb_ui.js"), /DISTURB_LEVELS/);
});
