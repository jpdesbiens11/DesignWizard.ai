/* Folders in a list, and the rule of a choice of several (demandes de JP) : a folder ranges and changes nothing ; a setting
   touched while several entries are chosen applies to all of them. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { folderOf, folderNames, nextFolderName, folderRows, setFolder, renameFolder, dropFolder, folderState, isFolded, setFolded } from "../../web/js/core/folders.js";
import { signature } from "../../web/js/core/review.js";
import { TEXT_KEYS } from "../../web/js/cad/expr.js";

const F = (id, folder, more = {}) => ({ id, op: "hole", ...(folder ? { folder } : {}), ...more });
test("a folder is a name on the entries it holds", () => {
  const list = [F("f1"), F("f2", "Perçages"), F("f3", "Perçages"), F("f4"), F("f5", " Finition ")];
  assert.equal(folderOf(list[1]), "Perçages"); assert.equal(folderOf(list[0]), ""); assert.equal(folderOf(list[4]), "Finition"); assert.equal(folderOf(null), ""); assert.equal(folderOf({ folder: 3 }), "");
  assert.deepEqual(folderNames(list), ["Perçages", "Finition"]); assert.equal(nextFolderName(list), "Dossier 1"); assert.equal(nextFolderName([F("a", "Dossier 1"), F("b", "Dossier 2")]), "Dossier 3");
});
test("an ordered list shows each RUN of a folder — the order of construction stays true ; another list gathers a folder at its first entry", () => {
  const list = [F("f1", "A"), F("f2", "A"), F("f3"), F("f4", "A"), F("f5", "B")];
  const runs = folderRows(list, { runs: true });
  assert.deepEqual(runs.map((r) => (r.kind === "folder" ? `${r.key}:${r.rows.map((x) => x.item.id).join("+")}` : r.item.id)), ["A:f1+f2", "f3", "A#2:f4", "B:f5"]);
  assert.deepEqual(runs.flatMap((r) => (r.kind === "folder" ? r.rows.map((x) => x.index) : [r.index])), [0, 1, 2, 3, 4], "every entry once, in its order");
  const sets = folderRows(list);
  assert.deepEqual(sets.map((r) => (r.kind === "folder" ? `${r.key}:${r.rows.map((x) => x.item.id).join("+")}` : r.item.id)), ["A:f1+f2+f4", "f3", "B:f5"]);
  assert.deepEqual(folderRows([]), []); assert.deepEqual(folderRows(null), []);
});
test("ranging, renaming and undoing a folder touch nothing but the name", () => {
  const list = [F("f1", null, { d: 3 }), F("f2", null, { suppressed: true }), F("f3")], put = setFolder(list, (f) => f.id !== "f3", "  Mes   trous ");
  assert.deepEqual(put.map(folderOf), ["Mes trous", "Mes trous", ""]); assert.equal(put[0].d, 3); assert.equal(put[1].suppressed, true); assert.equal(put.length, 3); assert.notEqual(put[0], list[0], "a new list, the document is not touched in place");
  assert.deepEqual(put.map((f) => f.id), ["f1", "f2", "f3"], "nothing moves"); assert.equal(list[0].folder, undefined);
  const ren = renameFolder(put, "Mes trous", "Perçages"); assert.deepEqual(ren.map(folderOf), ["Perçages", "Perçages", ""]); assert.deepEqual(renameFolder(put, "Mes trous", "  "), put, "an empty name renames nothing");
  const gone = dropFolder(ren, "Perçages"); assert.ok(gone.every((f) => !("folder" in f))); assert.equal(gone[1].suppressed, true);
  assert.equal(setFolder(list, () => true, "x".repeat(80))[0].folder.length, 48, "a name stays short");
  const s = folderState([{ item: { off: true } }, { item: { hidden: true } }, { item: {} }], { offKey: "off", hideKey: "hidden" }); assert.equal(s.n, 3); assert.equal(s.off, 1); assert.equal(s.allOff, false); assert.match(s.note, /^3 · 1 à Off · 1 masqué$/);
  assert.equal(folderState([{ item: { suppressed: true } }], { offKey: "suppressed" }).allOff, true);
});
test("a folder does not change the design : the signature of a part and of an assembly ignores it", () => {
  const part = { id: "P", features: [F("f1"), F("f2")] }, ranged = { ...part, features: setFolder(part.features, () => true, "Perçages") };
  assert.equal(signature(ranged), signature(part)); assert.notEqual(signature({ ...part, features: [F("f1"), F("f2", null, { d: 9 })] }), signature(part));
  const asm = { id: "A", instances: [{ id: "i1", part: "P" }, { id: "i2", part: "P" }] }; assert.equal(signature({ ...asm, instances: setFolder(asm.instances, () => true, "Visserie") }), signature(asm));
  assert.ok(TEXT_KEYS.has("folder"), "the name of a folder is a text, never read as a formula");
});
test("the folded state is a state of the view, kept per list and folder", () => {
  const box = new Map(), storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  assert.equal(isFolded("part:P", "A", storage), false); setFolded("part:P", "A", true, storage); assert.equal(isFolded("part:P", "A", storage), true); assert.equal(isFolded("part:Q", "A", storage), false); assert.equal(isFolded("part:P", "A#2", storage), false);
  setFolded("part:P", "A", false, storage); assert.equal(isFolded("part:P", "A", storage), false); assert.equal(isFolded("x", "y", null), false); box.set("dwiz.folded", "[broken"); assert.equal(isFolded("part:P", "A", storage), false);
});
test("in the screens : a setting touched on a chosen line is for the whole choice, and the lists read their folders", () => {
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8"), asm = read("assembly.js"), group = read("asm_group.js"), tree = read("part_tree.js"), look = read("part_look.js");
  assert.match(asm, /instSwatch\(id, inst, \{ group: \(\) => G\.of\(inst\.id\) \}\)/, "the swatch of a line paints the whole choice");
  assert.match(asm, /G\.off\(G\.of\(inst\.id\), !on, name\)/, "the On / Off of a line"); assert.match(asm, /G\.flag\(G\.of\(inst\.id\), "hidden"/, "the eye of a line");
  assert.match(asm, /if \(iid && G\.of\(iid\)\.length > 1\) return G\.menu\(G\.of\(iid\)\)/, "the menu of the right click, on the line and in the view"); assert.match(asm, /if \(st\.multi\.length > 1\) \{ G\.card\(body\); return; \}/, "the card of the right panel");
  assert.match(asm, /sec\.append\(\.\.\.G\.rows\(a\.instances, line\)\)/); assert.match(group, /st\.multi\.length > 1 && st\.multi\.includes\(iid\) \? st\.multi\.slice\(\) : \[iid\]/);
  assert.equal((group.match(/store\.updateAssembly\(/g) || []).length >= 5, true); assert.ok(!/store\.commit\(/.test(group), "each group action is one step of the assembly");
  assert.match(look, /o\.group \? o\.group\(\) : null; if \(ids && ids\.length > 1\) openPicker\(partsTarget\(ids\)/); assert.match(look, /ids && ids\.length > 1 \? instsTarget\(asmId, ids\) : T/);
  assert.match(tree, /folderRows\(feats, \{ runs: true \}\)/, "the operations of a part : runs, so the order stays the order of construction"); assert.match(tree, /"data-batch": "features"/);
  for (const w of ["Dupliquer", "Dossier", "Supprimer"]) assert.ok(tree.includes(`btn("${w}"`), w);
  assert.match(read("part_studio.js"), /tree\.append\(\.\.\.featureRows\(/); assert.match(read("part_list.js"), /lookSwatch\(p, \{ group:/);
});
