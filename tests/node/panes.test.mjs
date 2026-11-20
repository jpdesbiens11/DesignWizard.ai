/* The side panels of a studio (their widths, folded or not, what the browser keeps) and the bodies of the isolation
   analysis grouped by type. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PANE, clampPane, readPanes, writePanes, dragPane, hasRightPane } from "../../web/js/core/panes.js";
import { bodyGroups, GROUP_COLORS } from "../../web/js/analysis/cc_groups.js";
import { netColor } from "../../web/js/cad/materials.js";

test("a panel takes the width it is dragged to, between what stays readable and what leaves room to the view", () => {
  assert.deepEqual([clampPane(50), clampPane(420), clampPane(5000), clampPane(NaN), clampPane(420.6)], [PANE.min, 420, PANE.max, PANE.min, 421]);
  assert.equal(clampPane(700, 900), 900 - PANE.view, "the view keeps its share of a narrow window"); assert.equal(clampPane(700, 400), PANE.min, "and a panel never goes under its smallest width");
  const st = { left: 300, right: 340, leftOff: false, rightOff: false };
  assert.deepEqual(dragPane(st, "left", 460, 1600), { ...st, left: 460 }); assert.deepEqual(dragPane(st, "right", 150, 1600), { ...st, right: PANE.min });
  assert.deepEqual(dragPane(st, "left", 60, 1600), { ...st, leftOff: true }, "pulled almost shut, it folds — and keeps its width for when it comes back");
  assert.deepEqual(dragPane({ ...st, leftOff: true }, "left", 380, 1600), { ...st, left: 380 }, "dragged out again, it is back");
});

test("the panels are remembered once, for every screen ; what cannot be read gives the defaults", () => {
  const blank = { left: PANE.left, right: PANE.right, leftOff: false, rightOff: false };
  for (const bad of ["", null, "{", "[1]", '"x"', '{"creepage":7}']) assert.deepEqual(readPanes(bad, "creepage"), blank, String(bad));
  let text = writePanes("", "creepage", { left: 480, right: 340, leftOff: false, rightOff: true });
  for (const screen of ["creepage", "fea", "parts"]) assert.deepEqual(readPanes(text, screen), { left: 480, right: 340, leftOff: false, rightOff: true }, `widened in the Isolation, the panel has the same width in « ${screen} »`);
  text = writePanes(text, "fea", { left: 260, right: 400, leftOff: true, rightOff: false });
  assert.deepEqual(readPanes(text, "creepage"), { left: 260, right: 400, leftOff: true, rightOff: false }, "hidden in one screen, hidden in the next : one button, one state");
  assert.deepEqual(readPanes('{"x":{"left":9999,"right":-4}}', "x"), { left: PANE.max, right: PANE.right, leftOff: false, rightOff: false }, "what an earlier version kept for one screen is a start ; a width out of range is brought back");
  assert.deepEqual(readPanes('{"x":{"left":500},"*":{"left":320}}', "x").left, 320, "the shared state wins over an old one");
  assert.deepEqual(Object.keys(JSON.parse(writePanes('{"creepage":{"left":480}}', "a", blank))), [PANE.all], "the old per-screen entries are dropped"); assert.equal(JSON.parse(writePanes("pas du json", "a", blank))[PANE.all].left, PANE.left);
});

test("Isolation : the bodies are grouped by what they are — conductors by potential, in the colour of their net", () => {
  const b = (id, kind, net) => ({ id, name: id, kind, net: net || null });
  const bodies = [b("boîtier", "insulator"), b("piste+", "conductor", "HV+"), b("vis", "floating"), b("piste-", "conductor", "HV-"), b("barre+", "conductor", "HV+"), b("cuivre nu", "conductor"), b("dissipateur", "conductor", "Chassis"), b("capot", "insulator"), b("étiquette", "ignore")];
  const g = bodyGroups(bodies, [{ name: "HV+" }, { name: "HV-" }, { name: "LV" }, { name: "Chassis" }]);
  assert.deepEqual(g.map((x) => [x.key, x.bodies.map((q) => q.id)]), [["net:HV+", ["piste+", "barre+"]], ["net:HV-", ["piste-"]], ["net:Chassis", ["dissipateur"]], ["noNet", ["cuivre nu"]], ["floating", ["vis"]], ["insulator", ["boîtier", "capot"]], ["ignore", ["étiquette"]]],
    "the potentials in the order of the nets, an empty one left out, then what waits for a potential, the floating metal, the insulators, the rest");
  assert.equal(g[0].color, netColor("HV+")); assert.equal(g[0].title, "Conducteurs — HV+"); assert.deepEqual(g.slice(3).map((x) => x.color), [GROUP_COLORS.noNet, GROUP_COLORS.floating, GROUP_COLORS.insulator, GROUP_COLORS.ignore]);
  assert.equal(g.reduce((n, x) => n + x.bodies.length, 0), bodies.length, "every body is in one group, once");
  assert.deepEqual(bodyGroups([b("x", "conductor", "AUX")], []).map((x) => x.key), ["net:AUX"], "a potential the list of nets does not know still gets its group"); assert.deepEqual(bodyGroups([], []), []); assert.deepEqual(bodyGroups(null), []);
});

test("every side panel of every page can be resized and hidden : a studio gets its borders wherever it stands, and a right panel that comes later too", () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), side = (right, hidden = false) => ({ hidden, classList: { contains: (c) => c === "side" || (right && c === "right") } });
  const studio = (kids, cls = []) => ({ children: kids, classList: { contains: (c) => cls.includes(c) } });
  assert.equal(hasRightPane(studio([side(false), {}, side(true)])), true); assert.equal(hasRightPane(studio([side(false), {}])), false);
  assert.equal(hasRightPane(studio([side(false), {}, side(true)], ["no-right"])), false, "a screen that says it goes without a right panel"); assert.equal(hasRightPane(studio([side(false), {}, side(true, true)])), false, "a right panel that is hidden for now"); assert.equal(hasRightPane(null), false);
  const panes = read("web/js/core/panes.js"), app = read("web/js/core/app.js");
  assert.match(app, /main\.querySelectorAll\("\.studio"\)\.forEach\(\(s\) => mountPanes\(s, key\)\)/, "a studio under a header of its own (the PCBA) has its borders too"); assert.match(app, /panesWatch\.observe\(main, \{ childList: true, subtree: true \}\)/);
  assert.match(panes, /const sync = \(\) => \{ const now = hasRightPane\(studio\); if \(now === right\) return;/); assert.match(panes, /new MutationObserver\(sync\)\.observe\(studio, \{ attributes: true, attributeFilter: \["class"\], childList: true \}\)/);
  /* a screen that has side panels builds them in a studio — the one structure the borders know */
  const dir = new URL("../../web/js/modules/", import.meta.url), withSides = readdirSync(dir).filter((f) => f.endsWith(".js") && /el\("aside", \{ class: "side/.test(readFileSync(new URL(f, dir), "utf8")));
  assert.ok(withSides.length >= 13 && withSides.includes("pcba.js") && withSides.includes("sw.js"), `${withSides.length} screens have side panels`);
  for (const f of withSides) assert.match(readFileSync(new URL(f, dir), "utf8"), /class: "studio/, `${f} : its side panels are in a studio`);
});
