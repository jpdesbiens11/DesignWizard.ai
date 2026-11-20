/* The levels of the Shop, the work tabs and the step up of every screen (demandes de JP) : where a screen stands, where a click
   leads, what a tab keeps. Pure functions, and what holds the mechanism in place in the screens. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { NATURES, natureKey, natureOf, studioOf, partHash, natureHash, natureGroups, assemblyGroups, levelsOf, partChoices, natureChoices } from "../../web/js/core/shop_levels.js";
import { pinTab, closeTab, isPinned, keepTabs, tabRow, tabFace, loadTabs, saveTabs, MAX_TABS } from "../../web/js/core/work_tabs.js";
import { stairOf, aiTargetOf, addressOf } from "../../web/js/core/stairs.js";
import { glossary } from "../../web/js/core/terms.js";

const P = { id: "P1", name: "Variateur", parts: [
  { id: "BASE", name: "Base", process: "injection_molding", family: "enclosure" }, { id: "PLATE", name: "Plaque", process: "cnc_milling", family: "plate" },
  { id: "SINK", name: "Dissipateur", process: "extrusion_al", family: "extrusion" }, { id: "FOOT", name: "Patte", process: "sheet_metal", family: "sheet", folded: {} },
  { id: "ISO", name: "Isolant", process: "laser_cut" }, { id: "BRK", name: "Étrier", process: "lpbf" }, { id: "BB1", name: "Busbar +", busbar: {}, family: "busbar", process: "purchased" },
  { id: "LAM", name: "Busbar laminé", family: "busbar", process: "purchased" }, { id: "FLX", name: "Nappe", flex: {}, family: "flex", process: "purchased" }, { id: "PCB1", name: "Carte", family: "pcb", process: "pcb" },
  { id: "J1", name: "Connecteur", family: "connector", process: "purchased" }, { id: "IMP", name: "Importée", step: "…" }, { id: "X", name: "Sans procédé" }],
  assemblies: [{ id: "SUB", name: "Module", instances: [{ id: "i1", part: "BB1" }, { id: "i2", part: "PCB1" }] }, { id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE" }, { id: "i2", part: "BASE" }, { id: "S", asm: "SUB" }] }],
  boards: [{ id: "BRD", name: "Carte de commande" }] };
const part = (id) => P.parts.find((p) => p.id === id);

test("a part has one nature : what it is, then how it is made", () => {
  const want = { BASE: "molded", PLATE: "machined", SINK: "extrusion", FOOT: "sheet", ISO: "laser", BRK: "printed", BB1: "busbar", LAM: "busbar", FLX: "flex", PCB1: "pcb", J1: "bought", IMP: "imported", X: "other" };
  for (const [id, k] of Object.entries(want)) assert.equal(natureKey(part(id)), k, id);
  assert.equal(natureKey(null), "other"); assert.equal(natureOf(part("BB1")).label, "Busbars");
  for (const n of NATURES) { assert.ok(n.label && n.fr && n.icon && /^#[0-9a-f]{6}$/.test(n.color), n.key); assert.ok(["parts", "pcb", "extrusion", "busbar", "flex"].includes(n.studio), n.key); }
  assert.equal(new Set(NATURES.map((n) => n.color)).size, NATURES.length, "a colour per nature");
});
test("a part opens in the studio of its nature — a laminated busbar, which has no legs, in the part studio", () => {
  assert.equal(studioOf(part("BB1")), "busbar"); assert.equal(studioOf(part("LAM")), "parts"); assert.equal(studioOf(part("FLX")), "flex"); assert.equal(studioOf(part("PCB1")), "pcb"); assert.equal(studioOf(part("SINK")), "extrusion"); assert.equal(studioOf(part("BASE")), "parts");
  assert.equal(partHash(part("BB1")), "#/busbar/BB1"); assert.equal(partHash({ id: "A B" }), "#/parts/A%20B"); assert.equal(natureHash("busbar"), "#/shop/n/busbar");
});
test("the floor lists every part once by nature, in the order of the natures, and by assembly", () => {
  const g = natureGroups(P.parts); assert.equal(g.reduce((s, x) => s + x.items.length, 0), P.parts.length);
  assert.deepEqual(g.map((x) => x.key), NATURES.map((n) => n.key).filter((k) => g.some((x) => x.key === k)));
  assert.equal(g.find((x) => x.key === "busbar").items.length, 2); assert.equal(g.find((x) => x.key === "busbar").items[0].hash, "#/busbar/BB1");
  const a = assemblyGroups(P); assert.deepEqual(a.map((x) => x.key), ["asm:SUB", "asm:ASM", "~free"]);
  assert.deepEqual(a[1].items.map((x) => x.id), ["BASE"], "a part used twice is listed once ; a sub-assembly is not a part");
  assert.equal(a[2].items.length, P.parts.length - 3); assert.equal(a[0].hash, "#/assembly/SUB");
});
test("where a screen stands : the Shop, a nature, a part — and the way up", () => {
  const L = (k, a) => levelsOf(k, a, P), names = (k, a) => L(k, a).crumbs.map((c) => `${c.level}:${c.label}`);
  assert.deepEqual(names("shop", []), ["1:Atelier"]); assert.equal(L("shop", []).up, null); assert.equal(L("shop", []).crumbs[0].on, true);
  assert.deepEqual(names("shop", ["n", "busbar"]), ["1:Atelier", "2:Busbars"]); assert.equal(L("shop", ["n", "busbar"]).up, "#/shop");
  assert.deepEqual(names("busbar", ["BB1"]), ["1:Atelier", "2:Busbars", "3:Busbar +"]); assert.equal(L("busbar", ["BB1"]).up, "#/shop/n/busbar");
  assert.deepEqual(names("busbar", ["PLATE"]), ["1:Atelier", "2:Busbars", "3:Busbar +"], "the busbar studio shows its first busbar when the part named is not one");
  assert.deepEqual(names("parts", ["PLATE"]), ["1:Atelier", "2:Machined", "3:Plaque"]); assert.deepEqual(names("parts", []), ["1:Atelier", "2:Molded", "3:Base"], "the part studio opens on its first part");
  assert.deepEqual(names("pcb", []), ["1:Atelier", "2:PCB", "3:Carte"]); assert.deepEqual(names("extrusion", ["claude"]).slice(0, 2), ["1:Atelier", "2:Extrusion"]);
  assert.equal(L("shop", ["new"]).up, "#/shop"); assert.equal(L("interfaces", ["registre"]).crumbs[1].label, "Registre des interfaces"); assert.equal(L("library", []).up, "#/shop"); assert.equal(L("process", ["laser"]).crumbs[1].label, "Procédés spéciaux");
  const last = L("parts", ["PLATE"]).crumbs; assert.equal(last[0].hash, "#/shop"); assert.equal(last[1].hash, "#/shop/n/machined"); assert.equal(last[2].hash, null); assert.equal(last[1].drop, "natures"); assert.equal(last[2].drop, "parts");
  assert.equal(L("assembly", ["ASM"]).assembly.id, "ASM"); assert.equal(L("assembly", []).assembly.id, "SUB"); assert.equal(L("dfx", []), null); assert.equal(levelsOf("shop", [], null), null);
  const empty = { parts: [], assemblies: [] }; assert.deepEqual(levelsOf("busbar", [], empty).crumbs.map((c) => c.label), ["Atelier", "Busbars"]); assert.equal(levelsOf("parts", [], empty).crumbs[1].label, "Pièces");
});
test("from a part : its sisters first, then the others ; from a nature : the natures that have parts", () => {
  const c = partChoices(P.parts, part("BB1")); assert.match(c[0].label, /Busbars — dans ce studio/); assert.deepEqual(c[0].items.map((x) => x.id), ["BB1", "LAM"]); assert.equal(c.reduce((s, g) => s + g.items.length, 0), P.parts.length);
  const n = natureChoices(P.parts)[0].items; assert.ok(n.some((x) => x.id === "busbar" && /2 pièces/.test(x.sub))); assert.ok(n.some((x) => x.id === "pcb" && /1 pièce$/.test(x.sub)));
});
test("work tabs : kept on purpose, closed towards the neighbour, a passing tab for what is only looked at", () => {
  let t = pinTab([], { kind: "part", id: "BASE" }); t = pinTab(t, { kind: "part", id: "SINK" }); t = pinTab(t, { kind: "asm", id: "ASM" });
  assert.deepEqual(pinTab(t, { kind: "part", id: "BASE" }), t, "a tab already kept keeps its place"); assert.ok(isPinned(t, { kind: "asm", id: "ASM" })); assert.ok(!isPinned(t, { kind: "part", id: "ASM" }));
  assert.deepEqual(closeTab(t, { kind: "part", id: "SINK" }).next, { kind: "asm", id: "ASM" }, "the right neighbour"); assert.deepEqual(closeTab(t, { kind: "asm", id: "ASM" }).next, { kind: "part", id: "SINK" }, "else the left one"); assert.equal(closeTab([t[0]], t[0]).next, null);
  let many = []; for (let i = 0; i < MAX_TABS + 3; i++) many = pinTab(many, { kind: "part", id: `P${i}` }); assert.equal(many.length, MAX_TABS); assert.equal(many[0].id, "P3", "the oldest goes");
  assert.deepEqual(keepTabs([...t, { kind: "part", id: "GONE" }, { kind: "x", id: "BASE" }], P), t);
  const row = tabRow(t, { kind: "part", id: "FLX" }, P); assert.equal(row.length, 4); assert.ok(row[3].passing && row[3].on && row[3].hash === "#/flex/FLX"); assert.ok(!row[0].passing && !row[0].on);
  const on = tabRow(t, { kind: "part", id: "SINK" }, P); assert.equal(on.length, 3); assert.ok(on[1].on && !on[1].passing);
  assert.equal(tabFace({ kind: "part", id: "BB1" }, P).icon, "power"); assert.equal(tabFace({ kind: "asm", id: "ASM" }, P).hash, "#/assembly/ASM"); assert.equal(tabFace({ kind: "part", id: "GONE" }, P), null);
  const box = new Map(), storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) }; saveTabs("P1", t, storage); assert.deepEqual(loadTabs("P1", storage), t); assert.deepEqual(loadTabs("P2", storage), []);
  box.set("dwiz.tabs.P3", "{not json"); assert.deepEqual(loadTabs("P3", storage), []); assert.deepEqual(loadTabs("P1", null), []);
});
test("the step up of every screen leads to what the screen is made from — one step, never two", () => {
  const S = (k, a) => stairOf(k, a, P), to = (k, a) => (S(k, a) || {}).hash || null;
  assert.equal(to("elab", ["BRD"]), "#/pcba/BRD"); assert.equal(S("elab", []).tip, "Ouvrir la carte dans le PCBA"); assert.equal(S("elab", []).icon, "chip");
  assert.equal(to("fea", ["PLATE"]), "#/parts/PLATE"); assert.equal(to("fea", ["ASM"]), "#/assembly/ASM"); assert.equal(to("fea", []), "#/parts/BASE");
  assert.equal(to("drawings", ["BB1"]), "#/busbar/BB1"); assert.equal(to("drawings", ["asm", "ASM"]), "#/assembly/ASM"); assert.equal(to("physics", ["beam", "PLATE"]), "#/parts/PLATE"); assert.equal(to("physics", ["beam"]), null);
  for (const k of ["creepage", "render", "labels"]) assert.equal(to(k, ["ASM"]), "#/assembly/ASM", k);
  assert.equal(to("parts", ["PLATE"]), "#/shop/n/machined"); assert.equal(S("parts", ["PLATE"]).icon, "mill"); assert.equal(to("busbar", ["BB1"]), "#/shop/n/busbar"); assert.equal(to("shop", ["n", "busbar"]), "#/shop"); assert.equal(S("shop", ["n", "busbar"]).icon, "atelier");
  assert.equal(to("shop", []), null); assert.equal(to("library", []), "#/shop"); assert.equal(to("assembly", ["ASM"]), null, "a top assembly hangs from nothing"); assert.equal(to("assembly", ["SUB"]), "#/assembly/ASM", "a sub-assembly : the assembly it is mounted in");
  assert.equal(to("dfx", ["points", "PLATE"]), "#/parts/PLATE"); assert.equal(to("dfx", []), null); assert.equal(to("mvp", []), "#/review"); assert.equal(to("media", []), "#/physics"); assert.equal(to("home", []), null); assert.equal(stairOf("elab", [], null), null);
  for (const [k, a] of [["elab", []], ["fea", ["PLATE"]], ["drawings", ["PLATE"]], ["creepage", []], ["parts", ["PLATE"]], ["shop", ["new"]]]) { const s = S(k, a); assert.ok(s.icon && s.label && s.tip.length > 12, k); }
  assert.deepEqual(addressOf("#/busbar/A%20B/x"), { key: "busbar", args: ["A B", "x"] }); assert.deepEqual(addressOf(""), { key: "home", args: [] });
});
test("every functional screen hands its artefact to an AI — the part, the assembly or the board it shows, the project otherwise", () => {
  const T = (k, a) => (aiTargetOf(k, a, P) || {}).key;
  assert.equal(T("parts", ["PLATE"]), "part:PLATE"); assert.equal(T("busbar", ["BB1"]), "part:BB1"); assert.equal(T("pcb", []), "part:PCB1"); assert.equal(T("assembly", ["SUB"]), "assembly:SUB");
  assert.equal(T("fea", ["PLATE"]), "part:PLATE"); assert.equal(T("fea", ["ASM"]), "assembly:ASM"); assert.equal(T("fea", []), "part:BASE"); assert.equal(T("drawings", ["BB1"]), "part:BB1"); assert.equal(T("drawings", ["asm", "ASM"]), "assembly:ASM");
  assert.equal(T("pcba", ["BRD"]), "board:BRD"); assert.equal(T("elab", []), "board:BRD"); for (const k of ["creepage", "render", "labels"]) assert.equal(T(k, ["ASM"]), "assembly:ASM", k);
  assert.equal(T("physics", ["beam", "PLATE"]), "part:PLATE"); assert.equal(T("physics", ["beam"]), "project"); assert.equal(T("dfx", ["points", "PLATE"]), "part:PLATE"); assert.equal(T("dfx", []), "project"); assert.equal(T("shop", []), "project"); assert.equal(aiTargetOf("parts", [], null), null);
  assert.match(aiTargetOf("parts", ["PLATE"], P).label, /la pièce « Plaque »/); assert.match(aiTargetOf("review", [], P).label, /tout le projet/);
  const app = readFileSync(new URL("../../web/js/core/app.js", import.meta.url), "utf8"), nav = [...app.matchAll(/keys: \[([^\]]+)\]/g)].flatMap((m) => m[1].split(",").map((x) => x.trim().replace(/"/g, "")));
  assert.ok(nav.length >= 12, "the screens of the top bar are read from NAV"); for (const k of nav) assert.ok(aiTargetOf(k, [], P), `${k} : a screen of the top bar hands something to an AI`);
  assert.match(app, /installStairs\(\{ ai: \(key\) => app\.aiLoop && app\.aiLoop\(key\) \}\)/); const ui = readFileSync(new URL("../../web/js/core/stairs_ui.js", import.meta.url), "utf8"); assert.match(ui, /class: "btn btn-small head-ai"/);
  assert.match(readFileSync(new URL("../../web/js/modules/ai_loop.js", import.meta.url), "utf8"), /aiTargetOf\(key, args, store\.project\)/, "the top bar and the head of the panel follow one rule");
});
test("the mechanism holds in the screens : one bar, one step, no row of sub-tabs left", () => {
  const read = (f) => readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8");
  assert.ok(!existsSync(new URL("../../web/js/modules/shop_tabs.js", import.meta.url)), "the row of sub-tabs of the Shop is gone");
  for (const f of ["modules/extrusion.js", "modules/interfaces.js", "modules/library.js", "modules/shop_special.js", "modules/shop.js"]) assert.ok(!/shopTabs/.test(read(f)), f);
  const app = read("core/app.js"); assert.match(app, /id: "levels"/); assert.match(app, /app\.levels\(key, parts\.slice\(1\)\)[\s\S]*m\.render\(main/, "the bar is drawn before the screen, which then measures the room it has"); assert.match(app, /installStairs\(/);
  assert.ok(!/Ouvrir la carte dans le PCBA/.test(read("modules/elab.js")), "the Labo no longer has a step of its own : it has the common one");
  for (const f of ["modules/part_studio.js", "modules/busbar.js", "modules/flex.js", "modules/fea.js", "modules/drawings.js", "modules/creepage.js", "modules/render.js", "modules/labels.js", "modules/elab.js", "modules/physics.js"]) assert.match(read(f), /class: "side-head"/, `${f} : the step up settles in the head of its left panel`);
  const css = readFileSync(new URL("../../web/css/app.css", import.meta.url), "utf8"); assert.match(css, /\.studio \{[^}]*var\(--levels-h, 0px\)/, "a studio leaves room for the bar");
  const words = glossary().filter((r) => r.group === "process").map((r) => r.en); for (const w of ["Machined", "Molded", "Busbars", "Flex PCB", "Off the shelf"]) assert.ok(words.includes(w), w);
});
