/* The groups of a side panel fold on demand, and a panel drawn anew stays where it was : the pure halves of core/fold.js and
   core/panel_keep.js, and what wires them to every studio. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foldKey, screenOf, readFolds, writeFolds, setFold, soloFold, headingText, isFolded, fold } from "../../web/js/core/fold.js";
import { fieldSign, sameField, tabFrom, backTo } from "../../web/js/core/panel_keep.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, map: m }; };

test("fold : a group is remembered by its screen, its panel and its title", () => {
  assert.equal(foldKey("fea", "left", "Cas de charge"), "fea.left:cas de charge");
  assert.equal(foldKey("fea", "left", "  Zones   de\nraffinement "), "fea.left:zones de raffinement", "spaces and case do not make another group");
  assert.notEqual(foldKey("fea", "left", "Matériau"), foldKey("fea", "right", "Matériau"), "the same title in the other panel is another group");
  assert.notEqual(foldKey("fea", "left", "Matériau"), foldKey("parts", "left", "Matériau"), "and on another screen too");
  assert.equal(foldKey("", "left", "x"), "home.left:x");
});

test("fold : the screen is read from the location, whatever follows it", () => {
  assert.equal(screenOf("#/fea/DRV-BASE"), "fea");
  assert.equal(screenOf("#/fea"), "fea");
  assert.equal(screenOf("#/parts/DRV-BASE?x=1"), "parts");
  assert.equal(screenOf(""), "home");
  assert.equal(screenOf("#/"), "home");
});

test("fold : what is folded is kept, and anything else reads as nothing folded", () => {
  const s = store();
  assert.deepEqual(readFolds(s), {});
  assert.ok(writeFolds(s, { "fea.left:cas de charge": 1 }));
  assert.deepEqual(readFolds(s), { "fea.left:cas de charge": 1 });
  assert.deepEqual(readFolds(store({ "dw.fold": "not json" })), {});
  assert.deepEqual(readFolds(store({ "dw.fold": "[1,2]" })), {});
  assert.deepEqual(readFolds(store({ "dw.fold": '{"a":1,"b":0,"c":true}' })), { a: 1, c: 1 }, "only what is folded is kept");
  assert.deepEqual(readFolds(null), {});
  assert.equal(writeFolds({ setItem() { throw new Error("private window"); } }, {}), false, "a browser that keeps nothing does not break the folding");
});

test("fold : folding one group, opening it, keeping one alone open", () => {
  const a = setFold({}, "k1", true);
  assert.deepEqual(a, { k1: 1 });
  assert.deepEqual(setFold(a, "k1", false), {}, "an open group leaves nothing behind");
  assert.deepEqual(a, { k1: 1 }, "the map given is not changed");
  assert.deepEqual(soloFold({ k3: 1 }, ["k1", "k2", "k3"], "k3"), { k1: 1, k2: 1 }, "the others fold, the one clicked opens");
  assert.deepEqual(soloFold({ other: 1 }, ["k1", "k2"], "k1"), { other: 1, k2: 1 }, "the groups of another panel are left alone");
});

test("fold : the title of a group is its words, without its buttons, badges and counters", () => {
  const text = (t) => ({ nodeType: 3, textContent: t }), node = (cls, t) => ({ nodeType: 1, textContent: t, matches: (sel) => sel.split(",").map((x) => x.trim()).includes(cls) });
  assert.equal(headingText({ childNodes: [text("Le recoupement "), node(".badge", "cohérent")] }), "Le recoupement");
  assert.equal(headingText({ childNodes: [node("span", "Zones de raffinement"), node("button", "+")] }), "Zones de raffinement");
  assert.equal(headingText({ childNodes: [text("  Cas   de charge ")] }), "Cas de charge");
  assert.equal(headingText(null), "");
});

test("fold : a screen that draws groups of its own asks and says by key, before the page is there", () => {
  assert.equal(isFolded("test.own:group"), false);
  fold("test.own:group", true); assert.equal(isFolded("test.own:group"), true);
  fold("test.own:group", false); assert.equal(isFolded("test.own:group"), false);
});

test("panel : the field of a panel drawn anew that stands for the one just left", () => {
  const z = (card, field) => fieldSign({ tag: "INPUT", type: "number", label: `${field} (mm)`, field, card });
  const signs = [z("Z1", "size"), z("Z1", "length"), z("Z2", "size"), z("Z2", "length")];
  assert.equal(sameField(signs, z("Z2", "size"), 0), 2, "the same field of the same card");
  assert.equal(sameField(signs, z("Z3", "size"), 0), -1, "a card that is gone has no field");
  const bare = fieldSign({ tag: "INPUT", type: "number" }), three = [bare, bare, bare];
  assert.equal(sameField(three, bare, 1), 1, "fields that nothing names are told apart by their order");
  assert.equal(sameField(three, bare, 7), 2, "one less of them : the nearest");
  assert.equal(fieldSign({ tag: "INPUT", label: " a  b " }), fieldSign({ tag: "INPUT", label: "a b" }), "spaces do not make another field");
  assert.notEqual(fieldSign({ tag: "INPUT", label: "a" }), fieldSign({ tag: "SELECT", label: "a" }));
});

test("panel : Tab goes to the next stop, Shift + Tab to the one before, and stays at the ends", () => {
  assert.equal(tabFrom(2, 5, false), 3);
  assert.equal(tabFrom(2, 5, true), 1);
  assert.equal(tabFrom(4, 5, false), -1);
  assert.equal(tabFrom(0, 5, true), -1);
  assert.equal(tabFrom(-1, 5, false), -1, "a field that is not a stop goes nowhere");
});

test("panel : it is put back where it was, never further than its end, and not at all when it was at its top", () => {
  assert.equal(backTo(640, 0, 900), 640, "drawn anew, it came back at the top : back to where it was");
  assert.equal(backTo(640, 640, 900), null, "already there");
  assert.equal(backTo(640, 639.5, 900), null, "half a pixel is not a move");
  assert.equal(backTo(640, 0, 500), 500, "shorter than before : its end");
  assert.equal(backTo(640, 500, 500), null);
  assert.equal(backTo(0, 0, 900), null, "a panel at its top stays there");
});

test("wiring : every studio gets the folding and the panel that stays, the guide opens what it sends to, the styles are there", () => {
  const app = read("web/js/core/app.js");
  assert.match(app, /installFolds\(\);/); assert.match(app, /installPanelKeep\(\);/);
  assert.ok(app.indexOf("installFolds();") < app.indexOf("installPanelKeep();"), "the groups take their height before the panel is put back in place");
  assert.match(read("web/js/core/guide.js"), /unfoldAround\(node\)/, "nudge opens the folded group it sends the designer to");
  const css = read("web/css/app.css");
  assert.match(css, /\.folded > \.fold-head::before \{ transform: rotate\(-45deg\)/, "the chevron of a folded group points to the right");
  assert.match(css, /\.side-section\.folded > :not\(\.fold-head\), \[data-fold-key\]\.folded > :not\(\.fold-head\) \{ display: none !important; \}/);
  assert.match(css, /\.side-actions \{/);
});

test("wiring : the Simulation says what its groups hold, folds the types of its load case, and keeps what one does at the top", () => {
  const fea = read("web/js/modules/fea.js"), tree = read("web/js/modules/fea_tree.js"), zones = read("web/js/modules/fea_zones.js"), result = read("web/js/modules/fea_result.js");
  assert.match(fea, /el\("h3", null, "Modèle"\)/, "the first group of the left panel has a title to fold it by");
  assert.ok((fea.match(/data-fold-note/g) || []).length >= 4);
  assert.match(tree, /"data-fold-key": key/); assert.match(tree, /bc-ghead fold-head/);
  assert.match(fea, /class: "side-actions"/, "launch and the switch of view are pinned at the top of the right panel");
  assert.ok(fea.indexOf("resultPanel(body") < fea.lastIndexOf("body.append(hand, method);"), "once there is a result it comes before the hand estimate");
  assert.match(result, /`Résultat \$\{last\.n\}`/);
  assert.match(zones, /Volumes de raffinement dans la vue/, "the eye that hides or shows the volumes of the zones");
  assert.match(fea, /st\.view === "result" \? st\.show\.zonesResult === true : st\.show\.zones !== false/, "shown on the model, put away on the result, unless asked");
});
