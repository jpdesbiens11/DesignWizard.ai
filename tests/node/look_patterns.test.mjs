/* A look carries a pattern — the camouflage sets — and a sheen ; an assembly says how a part, a block or all of it looks in it,
   and wins over the part (demande de JP). core/look_patterns.js, core/part_look.js, core/asm_levels.js, the views and the picker. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PATTERN_GROUPS, PATTERNS, SHEENS, DEFAULT_SHEEN, validPattern, validSheen, patternTile, patternRgba, patternShares, patternColor, patternGroups } from "../../web/js/core/look_patterns.js";
import { validHex, tidyLook, hasLook, lookOf, shownLook, setLook, overLook, lookWords } from "../../web/js/core/part_look.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { instanceMenu } from "../../web/js/core/asm_live.js";
import { signature } from "../../web/js/core/review.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { bodyLook, boxUv } from "../../web/js/core/render_looks.js";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ids = Object.keys(PATTERNS);

test("patterns : four to six camouflage sets, each a few colours of a terrain under a plain name — none the pattern of a force or of a maker", () => {
  assert.ok(ids.length >= 4 && ids.length <= 6, `${ids.length} sets`); assert.deepEqual(PATTERN_GROUPS.map((g) => g.id), ["camo"]);
  for (const need of ["camo-snow", "camo-forest", "camo-desert"]) assert.ok(PATTERNS[need], `${need} : asked for by name`);
  for (const [id, P] of Object.entries(PATTERNS)) {
    assert.match(id, /^camo-[a-z]+$/); assert.equal(P.group, "camo"); for (const k of ["label", "fr", "text"]) assert.ok(typeof P[k] === "string" && P[k].length > 2, `${id}.${k}`);
    assert.ok(P.colors.length >= 3 && P.colors.length <= 5 && P.colors.every((c) => validHex(c) === c), `${id} : its colours`); assert.equal(new Set(P.colors).size, P.colors.length);
    assert.equal(P.shares.length, P.colors.length); assert.ok(Math.abs(P.shares.reduce((a, b) => a + b, 0) - 1) < 1e-9, `${id} : the shares make the whole`); assert.ok(P.shares[0] >= Math.max(...P.shares.slice(1)), `${id} : the ground takes the most`);
    assert.ok(["blotch", "digital"].includes(P.style)); assert.ok(P.period >= 60 && P.period <= 300, `${id} : a tile every ${P.period} mm`);
    assert.doesNotMatch(`${id} ${P.label} ${P.fr} ${P.text}`, /multicam|marpat|cadpat|flecktarn|woodland|m81|dpm|tigerstripe|kryptek|a-tacs|atacs/i, `${id} : the name of a pattern that has an owner`);
  }
  assert.equal(new Set(Object.values(PATTERNS).map((p) => p.label)).size, ids.length); assert.ok(Object.values(PATTERNS).some((p) => p.style === "digital") && Object.values(PATTERNS).some((p) => p.style === "blotch"), "both ways to break a colour up");
  assert.equal(validPattern("camo-snow"), "camo-snow"); for (const bad of ["tartan", "", null, 3, "constructor", "toString"]) assert.equal(validPattern(bad), null);
  const G = patternGroups(); assert.equal(G.length, 1); assert.equal(G[0].items.length, ids.length); assert.ok(validHex(G[0].color)); assert.equal(G[0].items[0].id, ids[0]);
  assert.match(read("web/js/core/look_patterns.js"), /The patterns are GENERATED here, from noise : none reproduces the pattern of an armed force or of a maker/);
});

test("a tile : the same every time, every colour in about its share, and it repeats without a seam", () => {
  for (const id of ids) {
    const n = 96, t = patternTile(id, n), P = PATTERNS[id]; assert.equal(t.length, n * n); assert.deepEqual([...patternTile(id, n)], [...t], `${id} : deterministic`);
    assert.ok(t.every((v) => v < P.colors.length)); const s = patternShares(id, n); s.forEach((x, k) => assert.ok(Math.abs(x - P.shares[k]) < 0.07, `${id} : colour ${k} takes ${x.toFixed(2)} for ${P.shares[k]}`));
    /* a seam would show as many more changes of colour across the edge of the tile than across any other line */
    const across = (a, b, vertical) => { let c = 0; for (let k = 0; k < n; k++) if ((vertical ? t[k * n + a] : t[a * n + k]) !== (vertical ? t[k * n + b] : t[b * n + k])) c++; return c / n; };
    const inside = Math.max(...Array.from({ length: n - 1 }, (_, k) => Math.max(across(k, k + 1, true), across(k, k + 1, false)))), edge = Math.max(across(n - 1, 0, true), across(n - 1, 0, false));
    assert.ok(edge <= inside * 1.5 + 0.05, `${id} : ${Math.round(edge * 100)} % of the edge changes colour, ${Math.round(inside * 100)} % at most across a line inside`);
  }
  const a = patternTile("camo-forest", 64), b = patternTile("camo-jungle", 64); assert.notDeepEqual([...a], [...b], "two patterns are not the same patches in other colours");
  /* a digital pattern is made of square pixels : blocks of the tile hold one colour */
  const d = patternTile("camo-urban", 128); let whole = 0; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const v = d[j * 4 * 128 + i * 4]; let same = true; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (d[(j * 4 + y) * 128 + i * 4 + x] !== v) same = false; if (same) whole++; }
  assert.equal(whole, 32 * 32, "every 4 × 4 block of the urban tile is one colour");
  assert.equal(patternTile("nope", 16).length, 256); assert.ok(patternTile("nope", 16).every((v) => v === 0)); assert.deepEqual(patternShares("nope"), []);
});

test("a tile as a picture, and the one colour that stands for a pattern where a texture cannot go", () => {
  const n = 32, px = patternRgba("camo-desert", n), P = PATTERNS["camo-desert"], seen = new Set();
  assert.equal(px.length, n * n * 4); for (let i = 0; i < n * n; i++) { assert.equal(px[4 * i + 3], 255); seen.add(`#${[0, 1, 2].map((k) => px[4 * i + k].toString(16).padStart(2, "0")).join("")}`); }
  assert.deepEqual([...seen].sort(), [...P.colors].sort(), "only the colours of the set, all of them"); assert.equal(patternColor("camo-desert"), P.colors[0]); assert.equal(patternColor("nope"), null);
  assert.ok(patternRgba("nope", 4).every((v) => v === 0));
});

test("sheens : four ways a surface answers light ; satin is the view as it always was and is not kept", () => {
  assert.deepEqual(Object.keys(SHEENS), ["matte", "satin", "gloss", "metallic"]); assert.equal(DEFAULT_SHEEN, "satin"); assert.deepEqual([SHEENS.satin.rough, SHEENS.satin.metal], [0.62, 0.08], "the numbers the view always used");
  for (const [id, S] of Object.entries(SHEENS)) { assert.ok(S.label && S.fr && S.text, id); assert.ok(S.rough >= 0 && S.rough <= 1 && S.metal >= 0 && S.metal <= 1); }
  assert.ok(SHEENS.matte.rough > SHEENS.satin.rough && SHEENS.satin.rough > SHEENS.gloss.rough && SHEENS.metallic.metal > SHEENS.gloss.metal); assert.equal(validSheen("gloss"), "gloss"); assert.equal(validSheen("shiny"), null);
  assert.match(read("web/js/core/viewer.js"), /metalness: 0\.08, roughness: 0\.62/, "the view without a look is satin");
});

test("a look : a pattern and a sheen beside the colour — one paint at a time, nothing kept for what is ordinary", () => {
  const p = { id: "P-1" };
  setLook(p, { color: "#3d86e6" }); setLook(p, { pattern: "camo-forest" }); assert.deepEqual(p.look, { color: "#3d86e6", pattern: "camo-forest" }, "the colour is kept under the pattern : it comes back when the pattern leaves");
  assert.deepEqual(shownLook(p, "#b9c6ce"), { color: "#3d86e6", opacity: 1, pattern: "camo-forest", sheen: "satin", own: true }); assert.equal(lookWords(p.look), "Camouflage Forest");
  setLook(p, { sheen: "matte", opacity: 0.6 }); assert.deepEqual(p.look, { color: "#3d86e6", opacity: 0.6, pattern: "camo-forest", sheen: "matte" }); assert.equal(lookWords(p.look), "Camouflage Forest, mat, voilé");
  setLook(p, { sheen: "satin", opacity: 1 }); assert.deepEqual(p.look, { color: "#3d86e6", pattern: "camo-forest" }, "satin and opaque are the ordinary view : not kept");
  setLook(p, { color: "#e8554b" }); assert.deepEqual(p.look, { color: "#e8554b" }, "a plain colour chosen : the pattern leaves"); setLook(p, { color: "#e8554b", pattern: "camo-snow" }); assert.equal(p.look.pattern, "camo-snow", "both given : both kept");
  setLook(p, { pattern: "tartan" }); assert.equal(p.look.pattern, undefined, "an unknown pattern is no pattern"); setLook(p, { color: null }); assert.equal(p.look, undefined, "nothing left : no look at all");
  setLook(p, { sheen: "gloss" }); assert.deepEqual(p.look, { sheen: "gloss" }); assert.ok(hasLook(lookOf(p))); assert.equal(lookWords(p.look), "brillant"); setLook(p, { sheen: null }); assert.equal(p.look, undefined);
  assert.deepEqual(tidyLook(null), { color: null, opacity: null, pattern: null, sheen: null }); assert.equal(hasLook(tidyLook({})), false); assert.equal(hasLook(null), false); assert.equal(lookWords({}), ""); assert.equal(lookWords({ color: "#3d86e6", opacity: 0.3 }), "Bleu franc, transparent");
  /* the same on an instance of an assembly : anything that holds a look */
  const inst = { id: "i1", part: "P-1" }; setLook(inst, { pattern: "camo-navy", sheen: "metallic" }); assert.deepEqual(inst.look, { pattern: "camo-navy", sheen: "metallic" }); assert.deepEqual(lookOf(inst), { color: null, opacity: null, pattern: "camo-navy", sheen: "metallic" });
});

test("who wins : what an assembly says of a look covers what the part says — the paint whole, the opacity and the sheen each on their own", () => {
  const part = { color: "#3d86e6", pattern: "camo-forest", sheen: "matte", opacity: 0.6 };
  assert.deepEqual(overLook(part, null), { color: "#3d86e6", pattern: "camo-forest", opacity: 0.6, sheen: "matte" }, "nothing said : the part as it is");
  assert.deepEqual(overLook(part, { pattern: "camo-snow" }), { color: null, pattern: "camo-snow", opacity: 0.6, sheen: "matte" }, "a pattern given here : the paint of the assembly, the rest of the part");
  assert.deepEqual(overLook(part, { color: "#e8554b" }), { color: "#e8554b", pattern: null, opacity: 0.6, sheen: "matte" }, "a plain colour given here covers the pattern of the part");
  assert.deepEqual(overLook(part, { sheen: "gloss" }), { color: "#3d86e6", pattern: "camo-forest", opacity: 0.6, sheen: "gloss" }); assert.deepEqual(overLook(part, { opacity: 0.3 }).opacity, 0.3);
  assert.deepEqual(overLook({}, {}), { color: null, pattern: null, opacity: null, sheen: null }); assert.deepEqual(overLook(null, { color: "zzz", pattern: "tartan" }), { color: null, pattern: null, opacity: null, sheen: null }, "what cannot be read says nothing");
});

test("through the levels : the look given to a block covers the looks inside it ; the outer assembly wins ; a look is not a change of the design", () => {
  const project = { assemblies: [
    { id: "TOP", instances: [{ id: "i1", part: "BASE", fixed: true, look: { color: "#e8554b" } }, { id: "s1", asm: "MOD", look: { pattern: "camo-desert", sheen: "matte" } }, { id: "s2", asm: "MOD" }], mates: [] },
    { id: "MOD", instances: [{ id: "a", part: "PLATE", fixed: true, look: { pattern: "camo-snow", opacity: 0.6 } }, { id: "b", part: "BOARD" }, { id: "c", asm: "CORE", look: { color: "#3d86e6" } }], mates: [] },
    { id: "CORE", instances: [{ id: "x", part: "CELL", look: { sheen: "gloss" } }], mates: [] }] };
  const find = (id) => project.assemblies.find((a) => a.id === id), flat = flatAsm(find("TOP"), find), look = (id) => tidyLook((flat.instances.find((i) => i.id === id) || {}).look);
  assert.deepEqual(flat.instances.map((i) => i.id), ["i1", "s1~a", "s1~b", "s1~c~x", "s2~a", "s2~b", "s2~c~x"]);
  assert.deepEqual(look("i1"), { color: "#e8554b", opacity: null, pattern: null, sheen: null }, "an instance of this level keeps what it was given");
  assert.deepEqual(look("s1~a"), { color: null, opacity: 0.6, pattern: "camo-desert", sheen: "matte" }, "the block in desert : the snow of its plate is covered, its opacity stays");
  assert.deepEqual(look("s1~b"), { color: null, opacity: null, pattern: "camo-desert", sheen: "matte" }, "a part that said nothing wears the look of the block");
  assert.deepEqual(look("s1~c~x"), { color: null, opacity: null, pattern: "camo-desert", sheen: "matte" }, "two levels down : the outermost assembly that says something wins, sheen included");
  assert.deepEqual(look("s2~a"), { color: null, opacity: 0.6, pattern: "camo-snow", sheen: null }, "the same block placed again, without a look : it shows what it says of itself");
  assert.deepEqual(look("s2~c~x"), { color: "#3d86e6", opacity: null, pattern: null, sheen: "gloss" }, "the blue of the inner block, the gloss of the part instance");
  assert.equal(find("MOD").instances[0].look.pattern, "camo-snow", "the documents are not changed by being opened");
  /* neither a review nor a release sees a look — on a part, on an instance, a pattern or a sheen */
  const bare = JSON.parse(JSON.stringify(find("TOP"))); for (const i of bare.instances) delete i.look; assert.equal(signature(find("TOP")), signature(bare)); const p = { id: "P", features: [{ id: "f1", op: "box", size: [1, 1, 1] }] }, was = signature(p); setLook(p, { pattern: "camo-urban", sheen: "metallic" }); assert.equal(signature(p), was);
  /* and it travels in the file */
  const text = toDwiz({ dw: "project/1", id: "p", name: "E", parts: [{ id: "P", name: "p", look: p.look, features: [] }], assemblies: project.assemblies.map((a) => ({ name: a.id, ...a })), log: [] }), back = fromDwiz(text);
  assert.match(text, /look pattern=camo-urban sheen=metallic/); assert.deepEqual(back.parts[0].look, { pattern: "camo-urban", sheen: "metallic" }); assert.deepEqual(back.assemblies[0].instances.map((i) => i.look), find("TOP").instances.map((i) => i.look));
});

test("the built part carries its pattern and its sheen on its main body ; where a texture cannot go, the ground colour stands for it", async () => {
  const K = await kernel(), spec = { id: "P-1", material: "AL6061-T6", features: [{ id: "f1", op: "box", size: [20, 10, 5] }, { id: "f2", op: "box", size: [4, 4, 4], at: [0, 0, 5], body: "plot", mode: "new" }], bodies: { plot: { color: "#111111" } } };
  const b = buildPart(K, { ...spec, look: { color: "#3d86e6", pattern: "camo-forest", sheen: "gloss" } }), main = b.bodies.find((x) => x.name === "main"), plot = b.bodies.find((x) => x.name === "plot");
  assert.equal(main.pattern, "camo-forest"); assert.equal(main.sheen, "gloss"); assert.equal(main.color, PATTERNS["camo-forest"].colors[0], "the colour a STEP file keeps : the ground of the pattern");
  assert.equal(plot.pattern, null); assert.equal(plot.color, "#111111", "a body with a colour of its own keeps it"); const plain = buildPart(K, spec).bodies.find((x) => x.name === "main"); assert.equal(plain.pattern, null); assert.equal(plain.sheen, null);
  /* texture coordinates for a mesh that has none : one tile every period, along the face each vertex leans to */
  const pos = new Float32Array([0, 0, 5, 150, 300, 5, 20, 75, 0, 20, 75, 30]), nrm = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0]), uv = boxUv(pos, nrm, PATTERNS["camo-forest"].period);
  assert.deepEqual([...uv].map((v) => Math.round(v * 100) / 100), [0, 0, 1, 2, 0.5, 0, 0.5, 0.2], "a face that looks up is laid in X and Y, one that looks along X in Y and Z — one tile every 150 mm");
});

test("the marketing render shows the look a part wears — unless a finish was chosen for it", () => {
  const body = { name: "main", material: "AL6061-T6", color: "#55683a", opacity: 1, pattern: "camo-forest", sheen: "matte" };
  const worn = bodyLook(body, null, "main"); assert.equal(worn.pattern, "camo-forest"); assert.equal(worn.period, PATTERNS["camo-forest"].period); assert.equal(worn.color, "#ffffff"); assert.equal(worn.rough, SHEENS.matte.rough);
  const here = bodyLook(body, null, "main", { pattern: "camo-snow", sheen: "gloss" }); assert.equal(here.pattern, "camo-snow", "what the assembly says here wins"); assert.equal(here.rough, SHEENS.gloss.rough); assert.ok(here.coat > 0);
  assert.equal(bodyLook(body, null, "main", { color: "#e8554b" }).color, "#e8554b"); assert.notEqual(bodyLook(body, null, "main", { color: "#e8554b" }).pattern, "camo-forest", "a plain colour here covers the camouflage");
  const chosen = bodyLook(body, { finish: "paint-gloss", color: "#3d86e6" }, "main", { pattern: "camo-snow" }); assert.equal(chosen.finish, "paint-gloss"); assert.equal(chosen.color, "#3d86e6"); assert.equal(chosen.pattern, null, "a finish chosen for the picture is the picture's own choice");
  assert.notEqual(bodyLook({ ...body, name: "plot" }, null, "main").pattern, "camo-forest", "only the main body wears the look");
  const plain = bodyLook({ name: "main", material: "AL6061-T6", color: "#b9c6ce", opacity: 1 }, null, "main"); assert.equal(plain.finish, "metal-brushed"); assert.equal(plain.pattern, "brushed", "a part without a look : the finish of its material, as before");
});

test("wiring : the views lay the look on, the assembly says its own, one picker for a part, an instance and a whole assembly", () => {
  const viewer = read("web/js/core/viewer.js"), paint = read("web/js/core/look_paint.js"), port = read("web/js/core/viewport.js"), scene = read("web/js/core/asm_scene.js"), ui = read("web/js/modules/part_look.js"), asm = read("web/js/modules/assembly.js"), css = read("web/css/app.css");
  assert.match(viewer, /if \(def\.look && !map\) paintLook\(mesh, def\.mesh, def\.look\);/); assert.match(paint, /boxUv\(src\.pos, src\.nrm, P\.period\)/); assert.match(paint, /t\.wrapS = t\.wrapT = THREE\.RepeatWrapping/); assert.match(paint, /m\.roughness = S\.rough; m\.metalness = S\.metal;/);
  assert.match(port, /const look = o\.looks && b\.name in o\.looks \? o\.looks\[b\.name\] : b\.pattern \|\| b\.sheen \? \{ pattern: b\.pattern, sheen: b\.sheen \} : null;/, "a built part shows the pattern of its look in every view");
  assert.match(scene, /const L = overLook\(\{ color: main\.color, opacity: main\.opacity, pattern: main\.pattern, sheen: main\.sheen \}, here\);/, "the assembly wins over the part"); assert.match(scene, /colors\[body\.name\] = c; looks\[body\.name\] = null;/, "a screen that paints by its own rule shows no pattern");
  assert.match(read("web/js/core/asm_levels.js"), /if \(i\.look\) c\.look = overLook\(c\.look, i\.look\);/);
  for (const fn of ["openLookPicker", "openInstLookPicker", "openAsmLookPicker", "lookSwatch", "instSwatch", "asmLookTools", "instLookSection"]) assert.match(ui, new RegExp(`export (?:function|const) ${fn}\\b`), fn);
  assert.match(ui, /\.\.\.patternGroups\(\)\.map\(\(g\) => el\("div", \{ class: "look-patterns"/, "the patterns by group, each under its name and its colour"); assert.match(ui, /"data-pattern": id, "aria-pressed"/); assert.match(ui, /"data-sheen": id, "aria-pressed"/);
  assert.match(ui, /store\.updateAssembly\(asmId, \(a\) => \{ for \(const i of a\.instances \|\| \[\]\) setLook\(i, patch\); \}/, "the whole assembly in one undoable step");
  assert.match(asm, /asmLookTools\(\{ asm: a, id \}\)/); assert.match(asm, /instSwatch\(id, inst\)/); assert.equal((asm.match(/instLookSection\(id, inst\)/g) || []).length, 2, "the card of a part and the card of a sub-assembly");
  assert.ok(instanceMenu({ instances: [{ id: "i1", part: "A" }, { id: "i2", part: "B" }] }, "i1").some((x) => x && x.act === "look"), "the menu of an instance offers its look here"); assert.match(asm, /look: \(\) => openInstLookPicker\(id, iid,/);
  for (const c of [".look-patterns", ".look-pat", ".look-tile", ".look-sheen"]) assert.ok(css.includes(`${c} `) || css.includes(`${c}.`) || css.includes(`${c}:`), c);
});
