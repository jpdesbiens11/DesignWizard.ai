/* The guide : what a project and the brief of the Shop lack or get wrong, read from the data alone. */
import test from "node:test";
import assert from "node:assert/strict";
import { partIssues, assemblyIssues, projectIssues, issuesHere, teamIssues } from "../../web/js/core/guide_checks.js";
import { briefIssues } from "../../web/js/core/shop_check.js";
import { guideCount, guideSort } from "../../web/js/core/guide.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const part = (more = {}) => ({ dw: "part/1", id: "P-1", name: "Platine", function: "Porte la carte", material: "AL6061-T6", process: "cnc_milling", params: { L: { value: 80, min: 20, max: 200, unit: "mm", label: "Longueur" } },
  interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation", key: "platine_base", side: "A" }], stock: { form: "plate", L: "L", W: 40, t: 5 }, features: [{ op: "interfaces" }], ...more });
const lv = (list) => list.map((x) => x.level);

test("the demonstration is clean : the guide only has advice for it", () => {
  const list = projectIssues(DEMO_DRIVE), c = guideCount(list);
  assert.deepEqual([c.error, c.todo, c.warn], [0, 0, 0], list.filter((x) => x.level !== "tip").map((x) => x.text).join(" | "));
  assert.ok(list.some((x) => /DRV-FOOT — dans le projet, mais dans aucun assemblage/.test(x.text)) && list.some((x) => /DRV-BRACKET/.test(x.text)));
  assert.ok(list.every((x) => x.hash && x.screen && x.text), "every entry says where to go");
  assert.deepEqual(projectIssues(null), []); assert.match(projectIssues({ parts: [], assemblies: [] })[0].text, /Le projet est vide/);
});

test("a part : no geometry, no material, an odd process, a parameter out of its own bounds, an interface nobody answers", () => {
  assert.deepEqual(partIssues(part(), new Set(["platine_base"])), [], "a complete part whose neighbour carries the key");
  assert.deepEqual(lv(partIssues(part())), ["tip"], "nobody carries the key : advice, not a fault"); assert.match(partIssues(part())[0].text, /interface IF1 « Fixation » libre/);
  assert.deepEqual(partIssues(part({ interfaces: [{ ...part().interfaces[0], external: true }] })), [], "an interface to the outside world waits for nobody");
  const bare = partIssues(part({ material: undefined, process: undefined, stock: undefined, features: [], function: "" }), new Set(["platine_base"]));
  assert.deepEqual(lv(guideSort(bare)), ["error", "error", "todo", "tip"]); assert.match(bare[0].text, /P-1 — aucune géométrie/); assert.ok(bare.every((x) => x.hash === "#/parts/P-1" && x.ref === "P-1" && x.screen === "parts"));
  assert.deepEqual(lv(partIssues(part({ process: "injection_molding" }), new Set(["platine_base"]))), ["warn"], "aluminium 6061 is not moulded by injection");
  assert.deepEqual(lv(partIssues(part({ material: "UNOBTAINIUM" }), new Set(["platine_base"]))), ["warn"]);
  assert.deepEqual(lv(partIssues(part({ process: "purchased", material: undefined, function: "" }), new Set(["platine_base"]))), ["tip"], "a bought part needs neither material nor purpose");
  const P = (v, min, max) => part({ params: { L: { value: v, min, max, unit: "mm", label: "Longueur" } } }), K = new Set(["platine_base"]);
  assert.match(partIssues(P(500, 20, 200), K)[0].text, /« Longueur » à 500, hors de ses bornes \(20 à 200\)/); assert.equal(partIssues(P(50, 200, 20), K)[0].level, "error"); assert.match(partIssues(P(0, undefined, undefined), K)[0].text, /nulle ou négative/);
  const two = partIssues(part({ interfaces: [part().interfaces[0], { id: "IF1", type: "planar", name: "Appui" }] }), K); assert.deepEqual(lv(guideSort(two)), ["error", "todo"]); assert.match(guideSort(two)[1].text, /sans clé/);
});

test("an assembly : a part that is gone, nothing fixed, a broken mate, a part mated to nothing", () => {
  const parts = new Map([["A", part({ id: "A" })], ["B", part({ id: "B" })]]);
  const asm = (more = {}) => ({ id: "ASM", instances: [{ id: "i1", part: "A", fixed: true }, { id: "i2", part: "B" }], mates: [{ id: "M1", a: { inst: "i2", iface: "IF1" }, b: { inst: "i1", iface: "IF1" } }], ...more });
  assert.deepEqual(assemblyIssues(asm(), parts), []); assert.deepEqual(lv(assemblyIssues({ id: "ASM", instances: [] }, parts)), ["todo"]);
  assert.deepEqual(lv(assemblyIssues(asm({ instances: [{ id: "i1", part: "A" }, { id: "i2", part: "B" }] }), parts)), ["warn"]); assert.match(assemblyIssues(asm({ instances: [{ id: "i1", part: "A" }, { id: "i2", part: "B" }] }), parts)[0].text, /aucune pièce fixe/);
  const gone = assemblyIssues(asm({ instances: [{ id: "i1", part: "A", fixed: true }, { id: "i2", part: "Z" }] }), parts); assert.equal(gone[0].level, "error"); assert.match(gone[0].text, /« Z », qui n'existe plus/);
  assert.match(assemblyIssues(asm({ mates: [{ id: "M1", a: { inst: "i2", iface: "IF9" }, b: { inst: "i1", iface: "IF1" } }] }), parts)[0].text, /M1 vise l'interface IF9 de B, qui n'existe plus : il est rompu/);
  assert.match(assemblyIssues(asm({ mates: [{ id: "M1", a: { inst: "i7", iface: "IF1" }, b: { inst: "i1", iface: "IF1" } }] }), parts)[0].text, /l'instance « i7 »/);
  const loose = assemblyIssues(asm({ mates: [] }), parts); assert.deepEqual(lv(loose), ["warn"]); assert.match(loose[0].text, /B \(i2\) n'est accouplée à rien/); assert.equal(loose[0].hash, "#/assembly/ASM");
});

test("a screen takes what concerns it : its kind, and the part or assembly it shows", () => {
  const list = [{ level: "warn", text: "a", screen: "parts", ref: "P-1" }, { level: "tip", text: "b", screen: "parts", ref: "P-2" }, { level: "warn", text: "c", screen: "assembly", ref: "ASM" }, { level: "tip", text: "d", screen: "shop", ref: null }];
  assert.deepEqual(issuesHere(list, "parts", "P-1").map((x) => x.text), ["a"]); assert.deepEqual(issuesHere(list, "parts", null).map((x) => x.text), ["a", "b"]);
  assert.deepEqual(issuesHere(list, "assembly", "ASM").map((x) => x.text), ["c"]); assert.deepEqual(issuesHere(list, "shop", null).map((x) => x.text), ["a", "b", "d"]); assert.deepEqual(issuesHere(list, "fea", null), []); assert.deepEqual(issuesHere(null, "parts"), []);
});

test("the brief of the Shop : a name first, then what does not go together", () => {
  const brief = (more = {}) => ({ name: "Support", fn: "Porte le capteur", quantity: 10, material: "AL6061-T6", form: "", interfaces: [{ type: "bolt_pattern", name: "Fixation" }], ...more }), at = (b, p) => briefIssues(b, p).map((x) => `${x.level}:${x.field}`);
  assert.deepEqual(briefIssues(brief()), []);
  assert.deepEqual(at(brief({ name: "  ", fn: "", interfaces: [] })), ["todo:name", "warn:interfaces", "tip:fn"]); assert.equal(guideCount(briefIssues(brief({ name: "" }))).blocking, 1, "a part with no name is not created");
  assert.deepEqual(at(brief({ name: "couvercle" }), { parts: [{ name: "Couvercle" }] }), ["warn:name"]);
  assert.deepEqual(at(brief({ quantity: 0 })), ["warn:quantity"]); assert.deepEqual(at(brief({ quantity: 2.5 })), ["tip:quantity"]);
  assert.deepEqual(at(brief({ material: "AL-A380", form: "sheet" })), ["warn:form"], "a casting alloy is not sold as sheet"); assert.match(briefIssues(brief({ form: "print" }))[0].text, /ne s'imprime pas/); assert.match(briefIssues(brief({ form: "profile", material: "PA12" }))[0].text, /ne s'extrude pas/);
  assert.deepEqual(at(brief({ material: "AL5052-H32", form: "sheet" })), []); assert.deepEqual(at(brief({ material: "NOMEX-410", form: "block" })), ["warn:form"]); assert.deepEqual(at(brief({ material: "PA12", form: "print" })), []);
  assert.deepEqual(at(brief({ interfaces: [], folds: { sides: ["+X"] }, material: "AL5052-H32", form: "sheet" })), [], "a folded edge is reason enough for a part");
  assert.deepEqual(at(brief({ interfaces: [{ name: "Vis" }, { name: "vis" }] })), ["tip:interfaces"]); assert.deepEqual(at(brief({ envelope: { L: 100, W: 0, H: 20 } })), ["warn:envelope"]); assert.deepEqual(at(brief({ material: "XX" })), ["warn:material"]);
  assert.deepEqual(briefIssues(null).map((x) => x.field), ["name", "interfaces", "quantity", "fn"]);
});

test("the team : a conflict to settle and a message that waits are said on every screen", () => {
  assert.deepEqual(teamIssues({ parts: [] }), []); assert.deepEqual(teamIssues({ team: { owner: "jp", members: [{ handle: "jp" }] }, talk: [] }), []);
  const p = { team: { owner: "jp", members: [{ handle: "jp" }, { handle: "ami" }], conflicts: [{ key: "part:DRV-BASE", by: "ami" }] },
    talk: [{ id: "m1", by: "ami", text: "@jp regarde", mentions: ["jp"] }, { id: "m2", by: "ami", text: "@jp vu ?", mentions: ["jp"], done: { by: "jp" } }, { id: "m3", by: "jp", text: "@ami ok", mentions: ["ami"] }] };
  const list = teamIssues(p); assert.deepEqual(list.map((x) => [x.level, x.hash, x.screen]), [["warn", "#/team", "team"], ["tip", "#/team", "team"]]);
  assert.match(list[0].text, /1 conflit à trancher : DRV-BASE \(@ami\)/); assert.match(list[1].text, /1 message vous attend, de @ami/);
  assert.ok(projectIssues({ parts: [], assemblies: [], ...p }).some((x) => x.screen === "team"), "the project list carries them, so the top bar shows them anywhere");
  assert.deepEqual(issuesHere(list, "team", null).length, 2);
});

test("the Shop : a stock form chosen by hand greys the materials its process cannot work", async () => {
  const { formTakes, materialChoices, MATERIAL_CLASSES } = await import("../../web/js/core/shop_check.js");
  const ok = (form, id) => formTakes(form, id).ok;
  assert.deepEqual([ok("print", "PA12"), ok("print", "AL6061-T6"), ok("print", "TI-6AL-4V"), ok("molded", "PA66-GF30"), ok("molded", "AL6061-T6"), ok("profile", "AL6063-T5"), ok("profile", "SS-304"), ok("sheet", "NOMEX-410"), ok("sheet", "AL-A380")], [true, false, true, true, false, true, false, true, false]);
  assert.deepEqual([ok("plate", "AL6061-T6"), ok("plate", "NOMEX-410"), ok("plate", "PA12"), ok("bar_round", "BRASS-360"), ok("angle", "POM"), ok("angle", "STEEL-1018"), ok("block", "AL-A380")], [true, false, false, true, false, true, false]);
  assert.match(formTakes("print", "AL6061-T6").why, /ne s'imprime pas/); assert.match(formTakes("plate", "PA12").why, /ne s'usine pas dans la masse, d'après la bibliothèque/); assert.match(formTakes("block", "FR4").why, /matière en feuille/);
  assert.deepEqual(formTakes("", "PA12"), { ok: true, why: "" }, "no form chosen by hand : nothing is held back"); assert.deepEqual(formTakes("print", "NOPE"), { ok: true, why: "" });
  const free = materialChoices(""), printed = materialChoices("print"), by = (g, cls) => g.find((x) => x.cls === cls);
  assert.deepEqual(free.map((g) => g.cls), MATERIAL_CLASSES.map((g) => g.cls)); assert.ok(free.every((g) => g.possible === g.list.length && g.list.length > 0 && /^#[0-9a-f]{6}$/.test(g.color) && g.icon)); assert.equal(new Set(MATERIAL_CLASSES.map((g) => g.color)).size, 4);
  assert.ok(!free.some((g) => g.list.some((m) => m.id === "EPOXY" || m.id === "GENERIC-COMPONENT")), "what is bought ready-made is not a choice of the Shop"); assert.ok(free.every((g) => g.list.every((m) => /^#[0-9a-f]{6}$/.test(m.color))), "every material has its swatch");
  assert.deepEqual(by(printed, "plastic").list.filter((m) => m.ok).map((m) => m.id), ["PC", "ABS", "PEI-9085", "PEKK", "PA12", "PA11", "RESIN-SLA"]); assert.equal(by(printed, "sheet").possible, 0); assert.equal(by(printed, "pcb").possible, 0);
  assert.deepEqual(by(printed, "metal").list.filter((m) => m.ok).map((m) => m.id), ["SS-316L", "SS-17-4PH", "ALSI10MG", "TI-6AL-4V", "IN718", "IN625"]); assert.match(by(printed, "metal").list.find((m) => m.id === "CU-C110").why, /ne s'imprime pas/);
  assert.equal(by(materialChoices("print", (id) => id === "CU-C110"), "metal").list.find((m) => m.id === "CU-C110").ok, true, "a material the companion itself would put in this form is never greyed");
});
