/* The side panels of a studio (their widths, folded or not, what the browser keeps) and the bodies of the isolation
   analysis grouped by type. */
import test from "node:test";
import assert from "node:assert/strict";
import { PANE, clampPane, readPanes, writePanes, dragPane } from "../../web/js/core/panes.js";
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

test("each screen remembers its own panels ; what cannot be read gives the defaults", () => {
  const blank = { left: PANE.left, right: PANE.right, leftOff: false, rightOff: false };
  for (const bad of ["", null, "{", "[1]", '"x"', '{"creepage":7}']) assert.deepEqual(readPanes(bad, "creepage"), blank, String(bad));
  let text = writePanes("", "creepage", { left: 480, right: 340, leftOff: false, rightOff: true }); text = writePanes(text, "fea", { left: 260, right: 400, leftOff: true, rightOff: false });
  assert.deepEqual(readPanes(text, "creepage"), { left: 480, right: 340, leftOff: false, rightOff: true }); assert.deepEqual(readPanes(text, "fea"), { left: 260, right: 400, leftOff: true, rightOff: false }); assert.deepEqual(readPanes(text, "parts"), blank);
  assert.deepEqual(readPanes('{"x":{"left":9999,"right":-4}}', "x"), { left: PANE.max, right: PANE.right, leftOff: false, rightOff: false }, "a width out of range is brought back");
  assert.equal(JSON.parse(writePanes("pas du json", "a", blank)).a.left, PANE.left);
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
