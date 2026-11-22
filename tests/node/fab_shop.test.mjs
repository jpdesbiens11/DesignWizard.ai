/* Point 13 of the roadmap (JP, 21 novembre 2026) : the virtual fabrication shop — the scene of each phase (the part turned toward the tool, in
   the fixture of its station, made by the tool), the order of the phases chosen by the shop and what it breaks, the deck for the supplier.
     node --test tests/node/fab_shop.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sceneOf, placeFor, stationKind, solidBox, fixtureMeshes, STATIONS } from "../../web/js/core/fab_scene.js";
import { flowKeys, moveKey, dropKey, orderIssues, stepMeasures } from "../../web/js/core/fab_flow.js";
import { pptx } from "../../web/js/core/pptx.js";
import { processPlan, stateSpec } from "../../web/js/cad/process_plan.js";
import { buildPart } from "../../web/js/cad/build.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { kernel } from "./kernel_helper.mjs";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { aiTargetOf, stairOf, downOf } from "../../web/js/core/stairs.js";
import { NEWS } from "../../web/js/core/whats_new.js";
import { methodById } from "../../web/js/core/methods.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const inter = (a, b) => { let v = 1; for (let k = 0; k < 3; k++) { const o = Math.min(a[k + 3], b[k + 3]) - Math.max(a[k], b[k]); if (o <= 1e-6) return 0; v *= o; } return v; };
const PROCS = ["cnc_milling", "cnc_turning", "laser_cut", "sheet_metal", "injection_molding", "die_casting", "sand_casting", "fdm", "extrusion_al", "pcb"];
const KEYS = ["stock", "setup:+Z", "setup:-Z", "setup:+X", "setup:-X", "setup:+Y", "setup:-Y", "rework", "bend", "deburr", "surface", "check", "pack"];

test("each phase has its station : a vise under a spindle, a chuck, a press brake, a laser bed, a mould, a bench, a surface plate, a carton…", () => {
  assert.deepEqual([["stock", "cnc_milling"], ["stock", "laser_cut"], ["stock", "injection_molding"], ["stock", "fdm"], ["setup:+Z", "cnc_milling"], ["setup:+X", "cnc_turning"], ["bend", "sheet_metal"], ["deburr", "cnc_milling"], ["check", "x"], ["pack", "x"]].map(([k, p]) => stationKind({ key: k }, p)),
    ["saw", "laser", "mould", "print", "mill", "lathe", "brake", "bench", "metrology", "carton"]);
  for (const k of Object.keys(STATIONS)) assert.ok(STATIONS[k].label && STATIONS[k].fr, k);
});

test("the part is turned so the worked face looks at the tool, centred, set on z = 0 — and no fixture enters it, whatever the process and the phase", () => {
  const box = [0, 0, 0, 160, 110, 42];
  const up = placeFor({ key: "setup:-X" }, "cnc_milling", box); assert.deepEqual(up.box, [-21, -55, 0, 21, 55, 160], "the −X face up : the part stands on its +X face");
  const m = up.matrix, n = [-1, 0, 0], r = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]]; assert.deepEqual(r.map(Math.round), [0, 0, 1], "the normal of the worked face points up");
  assert.deepEqual(placeFor({ key: "setup:+Z" }, "cnc_turning", box).box.map(Math.round), [-21, -55, 0, 21, 55, 160], "a lathe : the axis of the part (its Z) along the spindle, the +Z end free");
  assert.deepEqual(placeFor({ key: "setup:free" }, "cnc_turning", box).box, placeFor({ key: "setup:+Z" }, "cnc_turning", box).box, "one set-up on a lathe : the part along the spindle, never across it");
  const rm = placeFor({ key: "setup:+Y" }, "cnc_turning", box).matrix; assert.deepEqual([rm[4], rm[5], rm[6]].map(Math.round), [0, 0, 1], "a radial face (live tooling) turned up");
  for (const proc of PROCS) for (const key of KEYS) { const s = sceneOf({ key }, proc, box); assert.ok(s.solids.length > 0, `${proc} ${key} has a fixture`);
    for (const x of s.solids.filter((q) => !q.around)) assert.ok(inter(solidBox(x), s.place.box) < 1e-3, `${proc} ${key} : ${x.id} stays out of the part`); }
  const ms = fixtureMeshes(sceneOf({ key: "setup:+Z" }, "cnc_milling", box).solids); assert.ok(ms.every((x) => x.mesh.pos.length > 0 && x.pickable === false && /^fab\//.test(x.id)));
});

test("the order is the shop's : kept in the part, honoured by the routing, its breaks said — and the part after each phase follows it", async () => {
  const K = await kernel(), spec = JSON.parse(JSON.stringify(DEMO_DRIVE.parts.find((p) => p.id === "DRV-HEATSINK"))), built = buildPart(K, spec);      // an extruded profile, cut to length, then machined
  const plan = processPlan(spec, built), keys = flowKeys(plan); assert.equal(keys[0], "stock"); assert.equal(keys[keys.length - 1], "pack"); assert.deepEqual(orderIssues(plan, spec.id), []);
  assert.deepEqual(moveKey(["a", "b", "c"], "a", -1), null); assert.deepEqual(dropKey(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  spec.plan = { order: ["stock", "deburr", ...keys.filter((k) => k !== "stock" && k !== "deburr")] };
  const again = processPlan(spec, built); assert.deepEqual(flowKeys(again).slice(0, 2), ["stock", "deburr"]); assert.deepEqual(again.phases.map((p) => p.n), again.phases.map((_, i) => (i + 1) * 10), "renumbered by tens");
  assert.match(orderIssues(again, spec.id).map((x) => x.text).join(" "), /ébavurage vient avant/);
  spec.plan = { order: [...keys.filter((k) => k !== "pack" && k !== "check"), "pack", "check"] }; assert.ok(orderIssues(processPlan(spec, built), "P").some((x) => /conditionnement n'est pas la dernière/.test(x.text)));
  const back = fromDwiz(toDwiz({ ...spec, plan: { order: ["stock", "pack"], comments: { stock: "Brut en stock, 2 semaines" } } })); assert.deepEqual(back.plan.comments, { stock: "Brut en stock, 2 semaines" }, "the supplier's answer travels in the .dwiz"); assert.deepEqual(back.plan.order, ["stock", "pack"]);
  const m = stepMeasures(built); assert.equal(m.size.length, 3); assert.ok(m.size.every((v) => v > 0));
  const p0 = processPlan({ ...spec, plan: {} }, built); assert.ok(p0.phases.some((p) => p.key.startsWith("setup:")), "the profile is taken up in setups"); assert.ok(stateSpec(spec, p0, 0), "the raw part of the first phase : without the operations of the setups");
  K.flush();
});

test("the deck for the supplier : one slide each, its picture, its text, the box for the answer — the mark and the note of the platform", () => {
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64"));
  const bytes = pptx({ title: "Gamme", confidential: "CONFIDENTIEL", slides: [{ title: "10 — Débit", image: { bytes: png, type: "png", w: 2, h: 2 }, bullets: ["10.1 Scier <à> la longueur & ébavurer"], box: { label: "Réponse du fournisseur :", text: "OK" } }, { title: "Questions", bullets: [] }] });
  const text = new TextDecoder("latin1").decode(bytes);
  for (const name of ["[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/media/image1.png", "ppt/theme/theme1.xml", "ppt/slideMasters/slideMaster1.xml", "ppt/slideLayouts/slideLayout1.xml"]) assert.ok(text.includes(name), name);
  assert.ok(!text.includes("ppt/media/image2"), "a slide without a picture has none");
  assert.ok(text.includes("Scier &lt;à&gt; la longueur &amp; ébavurer".normalize()) || text.includes("Scier &lt;"), "the text is escaped");
  assert.ok(/DynamiteOrbit/.test(text) && /CONFIDENTIEL/.test(text), "the mark and the note on the slides");
});

test("wired : the last screen of Mécanique, its stairs and its AI, the news, the register, the routing's AI told of the order", () => {
  assert.match(read("web/js/core/app.js"), /keys: \["shop", "parts", "assembly", "drawings", "physics", "fea", "fab"\]/); assert.match(read("web/js/main.js"), /import "\.\/modules\/fab\.js";/);
  const p = { parts: [{ id: "P1", name: "Pièce", process: "cnc_milling" }], assemblies: [], boards: [] };
  assert.equal(aiTargetOf("fab", ["P1"], p).key, "part:P1"); assert.match(stairOf("fab", ["P1"], p).hash, /P1/); assert.ok(downOf("parts", ["P1"], p).some((d) => d.hash === "#/fab/P1"));
  assert.ok(NEWS.some((n) => n.where === "#/fab")); assert.equal(methodById("fab-shop").how, "own");
  assert.match(read("web/js/modules/plan_view.js"), /« comments » porte la réponse du fournisseur/);
  const scr = read("web/js/modules/fab.js"); assert.match(scr, /draggable: "true"/); assert.match(scr, /fabDeck\(/); assert.match(scr, /recordFilm\(/); assert.match(scr, /Montage de PRINCIPE/);
});
