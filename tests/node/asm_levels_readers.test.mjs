/* Sub-assemblies, seen by what reads an assembly : what leaves with a part or a sub-assembly, the guide, the review and the
   revisions through the levels, the routing, the .dwiz text — and the wiring of the screens. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dropInstances, finder, openInstances } from "../../web/js/core/asm_levels.js";
import { assemblyIssues, projectIssues } from "../../web/js/core/guide_checks.js";
import { partsOf, whereUsed, staleParts } from "../../web/js/core/review.js";
import { assemblyPlan, assemblyOrder } from "../../web/js/core/asm_plan.js";
import { instanceMenu } from "../../web/js/core/asm_live.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const iface = (id, side, key) => ({ id, name: id, type: "planar", side, key, params: {}, opts: {} });
const project = () => ({ id: "p", name: "Essai", parts: [{ id: "BASE", name: "Base", interfaces: [iface("IF1", "A", "k1")] }, { id: "P1", name: "Semelle", interfaces: [iface("IF1", "B", "k1"), iface("IF3", "A", "k3")] }, { id: "P2", name: "Capot", interfaces: [iface("IF3", "B", "k3")] }, { id: "SOLO", name: "Seule" }],
  assemblies: [{ id: "SUB", name: "Module", instances: [{ id: "i1", part: "P1", fixed: true }, { id: "i2", part: "P2" }], mates: [{ id: "M1", a: { inst: "i1", iface: "IF3" }, b: { inst: "i2", iface: "IF3" } }] },
    { id: "TOP", name: "Produit", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "s1", asm: "SUB" }], mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "s1~i1", iface: "IF1" } }] }], log: [] });

test("removal : a part or a sub-assembly leaves every assembly, with the joints that went through it at any level", () => {
  const p = project(), big = { id: "BIG", instances: [{ id: "t", asm: "TOP" }, { id: "x", part: "SOLO" }], mates: [{ id: "M1", a: { inst: "x", iface: "a" }, b: { inst: "t~s1~i2", iface: "IF3" } }, { id: "M2", a: { inst: "x", iface: "b" }, b: { inst: "t~i1", iface: "IF1" } }] }; p.assemblies.push(big);
  assert.equal(dropInstances(p.assemblies, (i) => i.part === "P2"), 1);
  assert.deepEqual(p.assemblies[0].instances.map((i) => i.id), ["i1"]); assert.equal(p.assemblies[0].mates.length, 0, "its joint inside the sub-assembly");
  assert.deepEqual(p.assemblies[1].mates.map((m) => m.id), ["M1"], "the joint of TOP held to the other part : it stays"); assert.deepEqual(big.mates.map((m) => m.id), ["M2"], "two levels up, the joint that held to it is gone, the other stays");
  assert.equal(dropInstances(p.assemblies, (i) => i.asm === "SUB"), 1); assert.deepEqual(p.assemblies[1].instances.map((i) => i.id), ["i1"]); assert.equal(p.assemblies[1].mates.length, 0, "a sub-assembly leaves with every joint that went through it");
  assert.equal(dropInstances(p.assemblies, (i) => i.part === "NOPE"), 0);
  assert.match(read("web/js/core/store.js"), /dropInstances\(p\.assemblies, \(i\) => i\.part === id\);/); assert.match(read("web/js/core/store.js"), /removeAssembly\(id\) \{ return this\.commit\(`Assemblage supprimé : \$\{id\}`, \(p\) => \{ p\.assemblies = p\.assemblies\.filter\(\(x\) => x\.id !== id\); dropInstances\(p\.assemblies, \(i\) => i\.asm === id\); \}/);
});

test("guide : a sub-assembly is checked where it is — gone, holding itself, joined or not", () => {
  const p = project(), parts = new Map(p.parts.map((x) => [x.id, x])), find = finder(p), top = p.assemblies[1], say = (a) => assemblyIssues(a, parts, find).map((x) => `${x.level}: ${x.text}`);
  assert.deepEqual(say(top), [], "a sub-assembly held by one joint to one of its parts : nothing to say");
  assert.match(say({ ...top, mates: [] }).join("\n"), /warn: TOP — le sous-assemblage Module \(s1\) n'est accouplé à rien/);
  assert.match(say({ ...top, instances: [...top.instances, { id: "s9", asm: "GONE" }] }).join("\n"), /error: TOP — l'instance s9 renvoie au sous-assemblage « GONE », qui n'existe plus/);
  const loop = { id: "SUB", name: "Module", instances: [{ id: "i1", part: "P1", fixed: true }, { id: "z", asm: "TOP" }], mates: [] }, f2 = (id) => (id === "SUB" ? loop : find(id));
  assert.match(assemblyIssues(top, parts, f2).map((x) => x.text).join("\n"), /contient déjà cet assemblage : il se contiendrait lui-même/);
  assert.match(say({ ...top, mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "s1~i9", iface: "IF1" } }] }).join("\n"), /l'accouplement M1 vise l'instance « s1~i9 », qui n'existe plus/);
  assert.match(say({ ...top, mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "s1~i1", iface: "IF9" } }] }).join("\n"), /vise l'interface IF9 de P1, qui n'existe plus/, "the part inside is known : its interface is checked");
  assert.deepEqual(say({ id: "T", instances: [{ id: "s1", asm: "SUB", fixed: true }], mates: [] }), [], "a fixed sub-assembly is the ground");
  const all = projectIssues(p).map((x) => x.text); assert.ok(all.some((t) => /^SOLO — dans le projet, mais dans aucun assemblage/.test(t))); assert.ok(!all.some((t) => /^P2 — dans le projet, mais dans aucun/.test(t)), "a part of a sub-assembly is in an assembly");
});

test("review, where used : the parts of an assembly through its levels", () => {
  const p = project(), top = p.assemblies[1];
  assert.deepEqual(Object.keys(partsOf(p, top)), ["BASE", "P1", "P2"], "reviewed with the parts of its sub-assembly too");
  assert.deepEqual(whereUsed(p, "P2").map((u) => `${u.id}×${u.qty}`), ["SUB×1", "TOP×1"], "directly, and through a sub-assembly");
  const entry = { parts: partsOf(p, top) }; p.parts[2].name = "Capot renforcé"; assert.deepEqual(staleParts(p, top, entry).map((s) => s.part), ["P2"], "a part of the sub-assembly moved : the parent is to revalidate");
  assert.deepEqual(openInstances(top, finder(p)).map((i) => i.id), ["i1", "s1~i1", "s1~i2"]);
});

test("routing : a sub-assembly is one step, put together apart ; a joint to a part inside holds it", () => {
  const p = project(), top = p.assemblies[1], parts = new Map(p.parts.map((x) => [x.id, x]));
  assert.deepEqual(assemblyOrder(top, parts), ["i1", "s1"]);
  const plan = assemblyPlan(top, p), step = plan.phases[1];
  assert.deepEqual(plan.phases.map((ph) => ph.title), ["Préparer Base (BASE)", "Monter le sous-assemblage Module (SUB)", "Contrôle final"]);
  assert.equal(step.asm, "SUB"); assert.match(step.ops[0].text, /^Monter le sous-assemblage Module \(SUB\) à part, selon sa propre gamme$/);
  assert.ok(step.ops.some((o) => /en appui sur Base \(BASE\)/.test(o.text)), "then mounted by the joint that holds one of its parts"); assert.ok(step.checks.includes("Sous-assemblage complet et contrôlé avant de le monter"));
  assert.deepEqual(plan.facts.slice(0, 3), [["Pièces", "3"], ["Sous-assemblages", "1"], ["Étapes", "2"]]);
  assert.equal(assemblyPlan(p.assemblies[0], p).facts.some((f) => f[0] === "Sous-assemblages"), false, "an assembly without one does not speak of it");
});

test("menu and .dwiz : a sub-assembly says what it is", () => {
  const top = project().assemblies[1], menu = instanceMenu(top, "s1", "Module").map((x) => (x && x.label) || x);
  assert.ok(menu.includes("Ouvrir le sous-assemblage") && menu.includes("Mettre à Off (de côté, sans le retirer)") && menu.includes("Fixer (il porte les autres)"));
  assert.ok(instanceMenu(top, "i1", "Base").map((x) => (x && x.label) || x).includes("Ouvrir la pièce"));
  /* levels : any instance can go into a new block with others ; a block can give back what it holds */
  const acts = (id) => instanceMenu(top, id).filter((x) => x && x.act).map((x) => x.act); assert.ok(acts("s1").includes("form") && acts("s1").includes("dissolve")); assert.ok(acts("i1").includes("form") && !acts("i1").includes("dissolve"), "a part has nothing to dissolve");
  assert.ok(menu.includes("Former un sous-assemblage avec…") && menu.includes("Dissoudre ici (ses pièces remontent)"));
  const doc = { dw: "assembly/1", ...top }, text = toDwiz(doc); assert.match(text, /^place s1 asm=SUB$/m); assert.match(text, /b=\{inst: s1~i1, iface: IF1\}/); assert.deepEqual(fromDwiz(text), doc);
});

test("wiring : the builder opens the levels, the screen treats a sub-assembly as one block, the readers go through the levels", () => {
  const scene = read("web/js/core/asm_scene.js"), a = read("web/js/modules/assembly.js"), sub = read("web/js/modules/asm_sub.js");
  assert.match(scene, /const \{ asm: usable, sol \} = solveLevels\(asm, built, find\);/); assert.match(scene, /levels: bomLevels\(asm, find\)/);
  assert.match(a, /st\.sel = hit && hit\.def\.data\.inst \? topOf\(hit\.def\.data\.inst\) : null;/, "a click on a part of a sub-assembly selects the sub-assembly");
  assert.match(a, /const keysOf = \(iid\) => \[\.\.\.vp\.viewer\.objects\.keys\(\)\]\.filter\(\(k\) => ownsKey\(iid, k\)\);/); assert.doesNotMatch(a, /startsWith\(/, "no key of the view is matched by hand");
  assert.equal((a.match(/autoMate\(p\.assemblies\.find\(\(x\) => x\.id === id\), [a-z.]*built, (st\.)?ctx\.asm\)/g) || []).length, 3, "the automatic joints are found through the levels");
  assert.match(a, /const without = \(x, iid\) => \{ x\.instances = x\.instances\.filter\(\(q\) => q\.id !== iid\); x\.mates = \(x\.mates \|\| \[\]\)\.filter\(\(k\) => topOf\(k\.a\.inst\) !== iid && topOf\(k\.b\.inst\) !== iid\); \};/);
  assert.match(a, /if \(isSub\(inst\)\) \{ subTab\(body, \{ inst, ctx: st\.ctx,/); assert.match(a, /el\("h3", \{ class: "pick-head"/, "the dialog groups its choices by nature");
  assert.match(a, /store\.removeAssembly\(id\); go\("#\/assembly"\);/); assert.match(a, /"Sous-assemblage de : "/);
  assert.match(sub, /export function subTab\(body, o\)/); assert.match(sub, /disabled: !ok, "data-sub": x\.id/, "an assembly that holds this one is offered greyed, with the reason");
  for (const [f, re] of [["web/js/core/review.js", /partCounts\(asm, finder\(project\)\)/], ["web/js/core/plm.js", /partCounts\(asm, finder\(project\)\)\.keys\(\)/], ["web/js/core/links.js", /openInstances\(asm, finder\(project\)\)/], ["web/js/core/prompts.js", /openInstances\(a, finder\(project\)\)/],
    ["web/js/modules/render.js", /flatAsm\(asm\(\), \(x\) => store\.assembly\(x\)\)/], ["web/js/modules/labels.js", /openInstances\(asm\(\), \(x\) => store\.assembly\(x\)\)/], ["web/js/modules/creepage.js", /netsOf\(flatAsm\(asm, /], ["web/js/modules/asm_gamme.js", /ownsKey\(iid, k\)/],
    ["web/js/modules/ai_loop.js", /un assemblage ne peut pas se contenir lui-même/], ["web/js/core/code_sources.js", /partCounts\(e\.doc, finder\(project\)\)/]]) assert.match(read(f), re, f);
  assert.match(read("web/css/app.css"), /\.pick-head \{ display: flex;/);
});
