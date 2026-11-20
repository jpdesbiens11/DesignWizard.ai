// The daily gestures of a long list : choosing one line in a list one can search, choosing several with Ctrl and Shift ;
// and the look palette that settles in the right margin.
//   node --test tests/node/daily_ui.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickStep, modsOf, isMulti, keepChosen, chosenWords } from "../../web/js/core/multi_select.js";
import { partGroups, partMark, GROUP_COLORS } from "../../web/js/core/part_groups.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const order = ["a", "b", "c", "d", "e"], C = { ctrl: true }, S = { shift: true };

test("several lines at once — a click takes one, Ctrl adds or takes away, Shift takes the run from the last click", () => {
  let r = pickStep([], order, "b"); assert.deepEqual(r, { ids: ["b"], anchor: "b" });
  r = pickStep(r.ids, order, "d", C, r.anchor); assert.deepEqual(r, { ids: ["b", "d"], anchor: "d" }, "Ctrl + click adds a line");
  r = pickStep(r.ids, order, "a", C, r.anchor); assert.deepEqual(r.ids, ["a", "b", "d"], "what is chosen stays in the order of the list");
  r = pickStep(r.ids, order, "b", { meta: true }, r.anchor); assert.deepEqual(r.ids, ["a", "d"], "⌘ counts as Ctrl ; a chosen line clicked again is let go");
  r = pickStep(["b"], order, "e", S, "b"); assert.deepEqual(r, { ids: ["b", "c", "d", "e"], anchor: "b" }, "Shift + click : the whole run, and the start of the run stays");
  r = pickStep(["b", "c", "d", "e"], order, "a", S, "b"); assert.deepEqual(r.ids, ["a", "b"], "the run can go upwards, from the same start");
  r = pickStep(["a"], order, "e", { shift: true, ctrl: true }, "d"); assert.deepEqual(r.ids, ["a", "d", "e"], "Ctrl + Shift adds the run to what was chosen");
  r = pickStep(["c"], order, "e", S, null); assert.deepEqual(r.ids, ["c", "d", "e"], "no start kept : the run starts at the last line chosen");
  assert.deepEqual(pickStep(["a", "z"], order, "q", C, "a"), { ids: ["a"], anchor: "a" }, "a line that is not in the list changes nothing, and what is gone is dropped");
  assert.deepEqual(pickStep(["a", "b"], order, "c").ids, ["c"], "a plain click starts again from one line");
  assert.deepEqual(keepChosen(["a", "x", "d"], order), ["a", "d"]); assert.deepEqual(keepChosen(undefined, order), []);
  assert.ok(isMulti({ ctrlKey: true }) && isMulti({ metaKey: true }) && isMulti({ shiftKey: true }) && !isMulti({}) && !isMulti(null)); assert.deepEqual(modsOf({ ctrlKey: 1 }), { ctrl: true, meta: false, shift: false });
  assert.equal(chosenWords(3, "pièce", "pièces", true), "3 pièces choisies"); assert.equal(chosenWords(2, "élément", "éléments"), "2 éléments choisis"); assert.equal(chosenWords(1, "pièce", "pièces", true), "1 pièce choisie");
});

test("a list one chooses in — the parts grouped by the way they are made, a colour per group, the imported ones last", () => {
  const parts = [{ id: "P1", name: "Base", process: "injection_molding", material: "PC-ABS" }, { id: "P2", name: "Cover", process: "injection_molding", material: "PC-ABS", look: { color: "#ff0000" } }, { id: "P3", process: "cnc_milling", material: "AL6061-T6" },
    { id: "P4", name: "Board", family: "pcb", process: "pcb", material: "FR4" }, { id: "P5", name: "Bought", step: "…" }, { id: "P6", name: "Unknown" }];
  const g = partGroups(parts), labels = g.map((x) => x.label);
  assert.equal(g.reduce((n, x) => n + x.items.length, 0), 6, "every part is in one group"); assert.deepEqual(labels.slice(-2).sort(), ["Imported (STEP)", "Procédé à définir"], "what has no process, and what was imported, come last");
  const mold = g.find((x) => x.key === "injection_molding"); assert.equal(mold.label, "Injection molding", "a group carries the trade name of its process"); assert.deepEqual(mold.items.map((i) => i.id), ["P1", "P2"]);
  assert.equal(mold.items[1].dot, "#ff0000", "a part shows the colour it was given"); assert.match(mold.items[0].sub, /^P1 · /); assert.equal(g.find((x) => x.key === "cnc_milling").items[0].title, "P3", "a part without a name shows its number");
  assert.ok(g.every((x, i) => x.color === GROUP_COLORS[i % GROUP_COLORS.length]) && new Set(g.map((x) => x.color)).size === g.length, "a colour per group");
  assert.equal(partMark(parts[3]), "pcb"); assert.equal(partMark(parts[4]), "step"); assert.equal(partMark({ family: "extrusion" }), "extrusion"); assert.equal(partMark({}), "part"); assert.deepEqual(partGroups([]), []); assert.deepEqual(partGroups(undefined), []);
});

test("wiring — the part studio opens on a drop-down list, the whole list sits under the tree, the palette settles in the right margin", () => {
  const studio = read("web/js/modules/part_studio.js"), list = read("web/js/modules/part_list.js"), pick = read("web/js/core/pick_list.js"), look = read("web/js/modules/part_look.js"), asm = read("web/js/modules/assembly.js"), css = read("web/css/shop.css");
  assert.match(studio, /partPicker\(\{ parts: parts\(\), id, key: cfg\.key \}\)\);/, "the picker is at the head of the left panel"); assert.ok(studio.indexOf("scroll.append(tree);") < studio.lastIndexOf("scroll.append(everyPart());"), "the whole list comes after the construction tree");
  assert.match(pick, /role: "combobox", "aria-haspopup": "listbox"/); assert.match(pick, /role: "listbox"/); assert.match(pick, /role: "option"/); for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"]) assert.ok(pick.includes(`"${key}"`), `the list answers ${key}`);
  assert.match(pick, /normalize\("NFD"\)/, "accents do not count when one searches"); assert.match(list, /if \(!isMulti\(e\)\) \{ st\.multi = \[\]; st\.anchor = p\.id; return; \}/, "a plain click still opens the part");
  assert.match(list, /openPartsLookPicker\(ids, b\)/); assert.match(list, /store\.commit\(`\$\{n\} pièces : matériau \$\{m\}`/, "one undoable step for the material of several parts");
  assert.match(asm, /if \(iid && isMulti\(e\)\) choose\(iid, e\);/, "Ctrl + click on a part in the 3D view chooses it too"); assert.match(asm, /btn\("Grouper", \(\) => formFrom\(ids\)/); assert.match(asm, /if \(k === "escape" && st\.multi\.length\)/);
  assert.match(look, /document\.querySelector\("\.studio > \.side\.right"\)/, "the palette looks for the right margin"); assert.match(look, /const away = \(ev\) => \{ if \(!host && !pop\.contains\(ev\.target\)\) close\(\); \}/, "in the margin a click elsewhere does not close it");
  assert.match(look, /new MutationObserver\(\(\) => \{ if \(!host\.isConnected\) close\(\); else if \(!pop\.isConnected\) host\.append\(pop\); \}\)/, "it comes back over the margin when the margin is drawn again");
  assert.match(css, /\.look-pop\.docked \{ position: absolute; inset: 0;/); assert.match(css, /\.nav-item\.multi \{/); assert.match(css, /\.batch-bar \{/);
  for (const f of ["web/js/core/multi_select.js", "web/js/core/part_groups.js"]) assert.doesNotMatch(read(f), /\bdocument\.[a-zA-Z]|\bwindow\.[a-zA-Z]/, `${f} is pure`);
});
