/* The branched flexible circuit : a wide core, branches of their own widths leaving along X or Y, folded toward Z+ or Z−,
   each ending in a probe, a voltage tap, a clipped tongue or bare pads, and a rigid board shown over or under the core —
   its frames, its checks, the list it gives the guide, and the solids the kernel makes of it. */
import test from "node:test";
import assert from "node:assert/strict";
import { EDGES, ENDS, blankTree, exampleTree, isTree, tracksOf, widthNeeded, branchFrame, tipSpot, treeChecks, treeGuide, whereOn, centerLine, treePart, writeFlex, addBranch, tidyTree } from "../../web/js/core/flex_tree.js";
import { blankFlex, flexPart } from "../../web/js/core/flex.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { aiRead, aiDiff } from "../../web/js/core/ai_loop.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { kernel } from "./kernel_helper.mjs";

const one = (edge, legs, o = {}) => ({ ...blankTree(), core: { L: 50, W: 30 }, branches: [{ id: "B1", edge, at: 15, w: 4, legs, end: "temp", ...o }] });

test("a branch leaves its edge outward, and folds toward Z+ or Z−", () => {
  for (const [edge, axis, sign, origin] of [["+X", 0, 1, 50], ["-X", 0, -1, 0], ["+Y", 1, 1, 30], ["-Y", 1, -1, 0]]) {
    const up = one(edge, [{ L: 20 }, { L: 10, bend: 90 }]), down = one(edge, [{ L: 20 }, { L: 10, bend: -90 }]), a = centerLine(up, up.branches[0]), b = centerLine(down, down.branches[0]);
    assert.equal(a[0][axis], origin, `${edge} : the centre line starts on the edge of the core`);
    assert.equal(a[1][axis], origin + sign * 20, `${edge} : the first part runs 20 mm away from the core`);
    assert.equal(a[0][1 - axis], 15, `${edge} : at its place along the edge`);
    assert.equal(a[2][2] - a[1][2], 10, `${edge} : +90 climbs`); assert.equal(b[2][2] - b[1][2], -10, `${edge} : −90 goes down`);
    assert.equal(branchFrame(up, up.branches[0]).plane, axis === 0 ? "XZ" : "YZ");
  }
});
test("the tip of a branch says the face it offers", () => {
  const flat = one("+X", [{ L: 20 }]), s = tipSpot(flat, flat.branches[0], 3, 1);
  assert.equal(s.face, "+Z"); assert.equal(s.level, 0.2); assert.deepEqual(s.at, [67, 15]); assert.deepEqual(tipSpot(flat, flat.branches[0], 3, -1).face, "-Z");
  const up = one("+X", [{ L: 20 }, { L: 10, bend: 90 }]), u = tipSpot(up, up.branches[0], 3, 1);
  assert.equal(u.face, "-X", "after a fold toward Z+, the top face looks back at the core"); assert.equal(u.at[0], 15); assert.ok(u.along, "the leg runs along the second axis of that face");
  const y = one("-Y", [{ L: 20 }, { L: 10, bend: -90 }]), v = tipSpot(y, y.branches[0], 0, 1);
  assert.equal(v.face, "-Y"); assert.ok(v.p[2] < 0, "it went down");
});
test("each end asks for its tracks, and the tracks for a width", () => {
  assert.deepEqual(Object.keys(ENDS), ["temp", "volt", "slot", "free"]); assert.deepEqual(Object.keys(EDGES), ["+X", "-X", "+Y", "-Y"]);
  const d = blankTree();
  assert.equal(tracksOf({ end: "volt" }), 1); assert.equal(tracksOf({ end: "temp" }), 2); assert.equal(tracksOf({ end: "free", tracks: 8 }), 8);
  assert.equal(widthNeeded(d, { end: "volt" }), 1.3); assert.equal(widthNeeded(d, { end: "free", tracks: 8 }), 5.5);
});
test("the checks : width, edge, neighbours, folds, potential", () => {
  assert.deepEqual(treeChecks(blankTree()).notes, [], "the blank circuit is within the rules");
  const ex = treeChecks(exampleTree());
  assert.ok(ex.ok); assert.equal(ex.rows.length, 7); assert.equal(ex.tracks, 19); assert.deepEqual(ex.notes.map((n) => n.level), ["check"], "the example only asks to judge the isolation between its taps");
  const bad = (fn) => { const d = blankTree(); fn(d); return treeChecks(d).notes; };
  assert.match(bad((d) => { d.branches[0].w = 1; })[0].text, /1,3 mm de large/);
  assert.match(bad((d) => { d.branches[0].at = 29; })[0].text, /dépasse le bord \+X/);
  assert.match(bad((d) => { d.branches.push({ id: "B3", edge: "+X", at: 12, w: 4, legs: [{ L: 10 }], end: "free" }); })[0].text, /B1 et B3 se touchent/);
  assert.match(bad((d) => { d.layers = 2; })[0].text, /au moins 12 × l'épaisseur = 2,4 mm/);
  assert.match(bad((d) => { d.branches[0].legs[1].L = 4; })[0].text, /trop courte entre ses plis/);
  const net = bad((d) => { d.branches[0].net = ""; });
  assert.deepEqual(net.map((n) => [n.level, n.id, n.field]), [["todo", "B1", "net"]], "a tap with no potential is a value to enter, on its field");
  assert.match(bad((d) => { d.rigid.t = 0; })[0].text, /épaisseur de la carte rigide/);
  assert.match(bad((d) => { d.branches[1].id = "B1"; }).at(-1).text, /même repère/);
});
test("the guide takes the checks at its four levels", () => {
  assert.deepEqual(treeGuide(blankTree()), []);
  const d = blankTree(); d.branches[0].net = ""; d.branches[1].w = 1; d.rigid = null;
  assert.deepEqual(treeGuide(d).map((x) => [x.level, x.id, x.field]), [["todo", "B1", "net"], ["error", "B2", "w"], ["tip", null, "rigid"]]);
  const none = { ...blankTree(), branches: [] };
  assert.deepEqual(treeGuide(none).map((x) => [x.level, x.field]), [["todo", "add"]]);
});
test("a point of the view is on the core, near an edge, or over a branch", () => {
  const d = exampleTree();
  assert.deepEqual(whereOn(d, [10, 44, 0.2]), { edge: "+Y", at: 10 }); assert.deepEqual(whereOn(d, [2, 20, 0.2]), { edge: "-X", at: 20 });
  assert.deepEqual(whereOn(d, [80, 8, 0.2]), { branch: "B1" }); assert.deepEqual(whereOn(d, [100, 9, 8]), { branch: "B1" }, "a folded part is still its branch");
  assert.equal(whereOn(d, [80, 15, 0]), null, "between two branches : nothing");
});
test("a new branch takes the next number and the first free place of its edge", () => {
  const d = blankTree(), b = addBranch(d, "+X");
  assert.equal(b.id, "B3"); assert.equal(b.at, 13.5, "B1 sits at 8 and is 5 wide : 1 mm after it"); assert.deepEqual(treeChecks(d).notes, []);
  const c = addBranch(d, "+X", { w: 6 }); assert.equal(c.id, "B4"); assert.equal(c.at, 19.5, "after the one just added"); assert.deepEqual(treeChecks(d).notes, []);
  assert.equal(addBranch(d, "-Y", { end: "slot" }).end, "slot");
});
test("the part : a conductor per branch, what stands at each end, an interface per end and one for the core", () => {
  const p = treePart(exampleTree(), "FX1");
  assert.equal(validateSpec(p).errors.length, 0, validateSpec(p).errors.join(" "));
  assert.deepEqual(p.interfaces.map((i) => `${i.id}:${i.type}`), ["IF1:planar", "B1:weld", "B2:weld", "B3:planar", "B4:planar", "B5:rail", "B6:planar", "B7:weld"]);
  assert.equal(p.bodies.b1.net, "S1+"); assert.equal(p.bodies.vs_b1.kind, "conductor"); assert.equal(p.bodies.raid_b5.material, "FR4"); assert.equal(p.bodies.ts_b3.kind, "insulator"); assert.equal(p.bodies.carte.material, "FR4");
  assert.equal(p.interfaces[0].face, "+Z"); assert.equal(p.interfaces[0].level, 1.8, "the board sits on the core : the part is taken by the top of the board");
  const under = treePart({ ...exampleTree(), rigid: { side: "under", t: 1.6 } }, "FX1");
  assert.equal(under.interfaces[0].face, "-Z"); assert.equal(under.interfaces[0].level, -1.6); assert.deepEqual(under.features.find((f) => f.id === "carte").at, [0, 0, -1.6]);
  const bare = treePart({ ...exampleTree(), rigid: null }, "FX1");
  assert.equal(bare.bodies.carte, undefined); assert.equal(bare.interfaces[0].level, 0.2); assert.match(bare.interfaces[0].name, /pose sur la carte/);
  assert.match(p.notes[0], /7 branche\(s\), 19 piste\(s\), 7 pli\(s\)/); assert.match(p.notes.at(-1), /Géométrie de principe/);
});
test("writing a flexible circuit follows its kind, and keeps what the designer added", () => {
  assert.ok(isTree(blankTree())); assert.ok(!isTree(blankFlex()));
  assert.deepEqual(writeFlex(blankFlex(), "F1"), flexPart(blankFlex(), "F1"));
  const first = writeFlex(blankTree(), "F2"); first.look = { color: "#3355aa" }; first.interfaces.push({ id: "IF9", type: "planar", name: "Appui ajouté", face: "-Z", level: 0, at: [5, 5], params: { w: 4, h: 4 } });
  const again = writeFlex({ ...blankTree(), name: "Autre nom" }, "F2", first);
  assert.equal(again.name, "Autre nom"); assert.deepEqual(again.look, { color: "#3355aa" }); assert.ok(again.interfaces.some((i) => i.id === "IF9"), "an interface added by hand stays");
});
test("the definition travels in the file and comes back from an AI with its changes", () => {
  const p = treePart(exampleTree(), "FX1"), back = fromDwiz(toDwiz(p));
  assert.deepEqual(back.flex, p.flex); assert.deepEqual(aiDiff(p, back), [], "the round trip changes nothing");
  const answer = aiRead(`Voilà.\n\`\`\`dwiz\n${toDwiz(p).replace("end=volt net=S2+", "end=volt net=HV-")}\n\`\`\`\nB2 ramène maintenant HV-.`);
  assert.ok(isTree(answer.flex)); assert.equal(answer.flex.branches[1].net, "HV-"); assert.equal(aiDiff(p.flex, answer.flex).length, 1);
  assert.equal(treePart(answer.flex, "FX1", p).bodies.b2.net, "HV-");
});
test("the kernel builds the core, the branches, their ends and the board", async () => {
  const K = await kernel();
  const blank = buildPart(K, treePart(blankTree(), "T1")); K.flush();
  assert.deepEqual(blank.log.filter((l) => l.level === "error"), []); assert.deepEqual(blank.interfaces.map((i) => i.id), ["IF1", "B1", "B2"]);
  const ex = buildPart(K, treePart(exampleTree(), "T2")), names = ex.bodies.map((b) => b.name); K.flush();
  assert.deepEqual(ex.log.filter((l) => l.level === "error"), []);
  for (const n of ["carte", "b1", "b7", "vs_b1", "ts_b3", "ts_b4", "raid_b5"]) assert.ok(names.includes(n), `body ${n}`);
  const [x0, y0, z0, x1, y1, z1] = ex.bbox;
  assert.ok(x1 > 105 && x0 < -24 && y1 > 70 && y0 < -14, "branches leave the four edges"); assert.ok(z1 > 15 && z0 < -10, "some fold toward Z+, some toward Z−");
  const under = buildPart(K, treePart({ ...exampleTree(), rigid: { side: "under", t: 1.6 } }, "T3")); K.flush();
  assert.deepEqual(under.log.filter((l) => l.level === "error"), []);
  const zs = (b) => { const x = b.bodies.find((q) => q.name === "carte").bbox; return [Math.round(x[2] * 100) / 100, Math.round(x[5] * 100) / 100]; };
  assert.deepEqual(zs(ex), [0.2, 1.8], "over the core"); assert.deepEqual(zs(under), [-1.6, 0], "under the core");
});

test("spots on the core : a thermistor or a tab on the face toward what it watches — checked, counted, kept by tidying, built by the kernel", async () => {
  const d = { ...blankTree(), core: { L: 50, W: 30 }, rigid: null, branches: [], spots: [{ id: "T1", x: 10, y: 10, end: "temp", on: "Cellule" }, { id: "VN", x: 30, y: 15, end: "volt", net: "B-" }] };
  const ch = treeChecks(d); assert.ok(ch.ok, JSON.stringify(ch.notes)); assert.equal(ch.tracks, 3, "a thermistor has two tracks, a tap one");
  const p = treePart(d, "FX-S"), ts = p.features.find((f) => f.id === "sp_t1"), vn = p.features.find((f) => f.id === "sp_vn");
  assert.deepEqual(ts.at, [9.2, 9.6, d.t], "the thermistor stands on the top face, centred on its spot"); assert.equal(p.bodies.sp_vn.net, "B-"); assert.equal(vn.size[2], 0.1);
  const it = p.interfaces.find((i) => i.id === "T1"); assert.equal(it.face, "+Z"); assert.equal(it.level, d.t + 0.8, "the contact is the top of the thermistor (pressed through a pad)");
  assert.equal(p.interfaces.find((i) => i.id === "VN").type, "weld"); assert.ok(p.notes.some((n) => /2 point\(s\) sur le cœur/.test(n)));
  const out = treeChecks({ ...d, spots: [{ id: "T1", x: 49.9, y: 10, end: "temp" }, { id: "T2", x: 20, y: 10, end: "temp" }, { id: "T3", x: 21, y: 10, end: "temp" }, { id: "V", x: 5, y: 5, end: "volt" }] });
  assert.ok(out.notes.some((n) => n.id === "T1" && /sort du cœur/.test(n.text))); assert.ok(out.notes.some((n) => n.id === "T3" && /moins de 3 mm/.test(n.text))); assert.ok(out.notes.some((n) => n.level === "todo" && n.id === "V"));
  assert.ok(treeChecks({ ...d, branches: [{ id: "T1", edge: "+X", at: 10, w: 4, legs: [{ L: 10 }], end: "free" }] }).notes.some((n) => /même repère/.test(n.text)), "a spot and a branch never share a name");
  const back = tidyTree({ ...d, spots: [{ id: "", x: "12", y: 3, end: "nope", side: 7 }] }); assert.deepEqual(back.spots[0], { id: "S1", x: 12, y: 3, end: "temp", side: 1 });
  assert.equal("spots" in tidyTree(blankTree()), false, "a definition without spots stays without");
  const K = await kernel(), b = buildPart(K, p); assert.deepEqual(b.log.filter((l) => l.level === "error"), []); assert.ok(b.bodies.some((x) => x.name === "sp_t1") && b.bodies.some((x) => x.name === "sp_vn"));
});

test("a voltage tab can be narrower than its branch : a full-width panel takes its potential by a tab of 4 mm", () => {
  const d = one("+X", [{ L: 10 }, { L: 8, bend: 90 }], { end: "volt", net: "B+", w: 40, at: 20, tabW: 4 }); d.core = { L: 50, W: 44 };
  const p = treePart(d, "FX-T"), tab = p.features.find((f) => f.id === "vs_b1"), wide = treePart({ ...d, branches: [{ ...d.branches[0], tabW: undefined }] }, "FX-W").features.find((f) => f.id === "vs_b1");
  assert.equal(Math.min(...tab.size), 0.1); assert.ok(tab.size.includes(4), JSON.stringify(tab.size)); assert.ok(wide.size.includes(39), "without it, the tab takes the width of the branch less 1 mm");
  assert.equal(p.interfaces.find((i) => i.id === "B1").params.h, 4);
});
