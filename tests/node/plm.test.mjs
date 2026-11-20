/* Released revisions : a number, frozen revisions, form-fit-function deciding between the next revision and a new number,
   an assembly released with the revision of each of its parts. */
import test from "node:test";
import assert from "node:assert/strict";
import { serialParts, reference, newReference, releaseName, release, planRelease, lastRelease, releases, formFitFunction, f3Text, usesOf, outerInterfaces, compatibility, restore, releaseFiles, plmRows, subsOf, REF_TYPES } from "../../web/js/core/plm.js";
import { reviewItems, signature } from "../../web/js/core/review.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { joinTeam, forkMirror, stampLocal, mergeMirror } from "../../web/js/core/team.js";

const P = (value) => ({ value, min: 1, max: 500, step: 1, unit: "mm", label: "x" }), D = (n) => new Date(Date.UTC(2026, 0, 1, 12, n));
const part = (id) => ({ dw: "part/1", id, name: `Pièce ${id}`, function: "Porte la carte", family: "plate", process: "cnc_milling", material: "AL6061-T6", params: { L: P(100), mx: P(70) },
  interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation carte", key: `k-${id}`, side: "A", face: "+Z", at: ["L/2", 20], params: { screw: "M3", pattern: { type: "rect", dx: "mx", dy: 30 } } },
    { id: "IF2", type: "planar", name: "Appui", key: `a-${id}`, side: "A", face: "-Z", at: [50, 20], params: { w: 40, h: 20 } }], features: [{ op: "box", id: "b", size: ["L", 40, 5] }, { op: "interfaces" }] });
const project = () => ({ dw: "project/1", id: "P", name: "Module", parts: [part("BASE"), part("CAPOT")], boards: [],
  assemblies: [{ dw: "assembly/1", id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT" }], mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "i2", iface: "IF1" } }] }] });
const form = (L = 100) => ({ size: [L, 40, 5], mass: L * 0.54 });

test("a number is the moment it was given, the way the Reference Generator of DynamiteAgile writes it — and is never given twice", () => {
  assert.deepEqual(serialParts(new Date(Date.UTC(2026, 0, 1, 12, 0, 0))), [46023, 50000], "days since 1899-12-30, then the time of day in 1/100 000 of a day");
  assert.deepEqual(serialParts(new Date(Date.UTC(1900, 0, 1))), [2, 0]); assert.equal(reference("PRT", 46023, 50000), "PRT-46023-50000"); assert.equal(reference("ASM", 7, 12), "ASM-00007-00012");
  assert.deepEqual(serialParts(new Date(Date.UTC(2026, 0, 1, 23, 59, 59, 900))), [46024, 0], "the last instant of a day is the first of the next");
  const p = project(), a = newReference(p, "part", D(0)); p.parts[0].pn = a; const b = newReference(p, "part", D(0)); assert.deepEqual([a, b], ["PRT-46023-50000", "PRT-46023-50001"], "the slot was taken : the next one");
  assert.equal(newReference(p, "assembly", D(0)), "ASM-46023-50000"); assert.deepEqual(REF_TYPES, { part: "PRT", assembly: "ASM", board: "PCB" });
  assert.equal(releaseName("PRT-46023-50000", "B", "Base : boîtier / v2"), "PRT-46023-50000_B Base - boîtier - v2");
});

test("a part is released : its number, its revision frozen ; then form, fit and function decide — the next revision, or a new number", () => {
  const p = project(), key = "part:BASE", base = p.parts[0];
  assert.deepEqual([planRelease(p, key).action, planRelease(p, "physics:x"), lastRelease(p, key)], ["first", null, null]);
  let r = release(p, key, { date: D(1), by: "jp", form: form() }); assert.deepEqual([r.action, r.pn, r.rev, r.done], ["first", "PRT-46023-50069", "A", true]); assert.deepEqual([base.pn, base.revision], ["PRT-46023-50069", "A"]);
  assert.equal(reviewItems(p).find((x) => x.key === key).state, "todo", "freezing is not validating : the frozen revision waits for its review"); assert.equal(releases(p).at(-1).state, "frozen"); assert.equal(release(p, key, { date: D(2) }).done, false, "nothing changed : nothing to release");
  /* a change inside : a note, a hole that touches no interface — the same number, revision B */
  base.notes = ["Ébavurer."]; base.features.splice(1, 0, { op: "hole", id: "h", face: "+Z", at: [10, 10], d: 3, depth: 2 }); base.name = "Base du boîtier";
  let plan = planRelease(p, key, { form: form() }); assert.deepEqual([plan.action, plan.rev, plan.f3.ok], ["revision", "B", true]);
  r = release(p, key, { date: D(3), form: form() }); assert.deepEqual([r.pn, r.rev, base.revision, releases(p).length], ["PRT-46023-50069", "B", "B", 2]);
  assert.deepEqual(releases(p)[0].doc.notes, undefined, "revision A is still what it was"); assert.equal(releases(p)[0].doc.name, "Pièce BASE");
  /* the screw pattern moves through its parameter : the fit is broken — a new number, revision A, which says where it comes from */
  base.params.mx.value = 72; plan = planRelease(p, key, { form: form() }); assert.deepEqual([plan.action, plan.f3.fit, plan.from], ["number", ["interface « Fixation carte » modifiée"], { pn: "PRT-46023-50069", rev: "B" }]);
  r = release(p, key, { date: D(4), form: form() }); assert.deepEqual([r.pn, r.rev], ["PRT-46023-50278", "A"]); assert.deepEqual(base.derivedFrom, { pn: "PRT-46023-50069", rev: "B", why: "Ajustement : interface « Fixation carte » modifiée" });
  assert.deepEqual(releases(p).map((x) => x.id), ["PRT-46023-50069_A", "PRT-46023-50069_B", "PRT-46023-50278_A"], "the old number keeps its two revisions"); assert.equal(lastRelease(p, key).id, "PRT-46023-50278_A");
  assert.match(p.review.items[key].history.at(-1).note, /nouveau numéro, dérivé de PRT-46023-50069 rév\. B : Ajustement/);
});

test("form, fit, function : what breaks each, and what breaks none", () => {
  const p = project(), key = "part:BASE", base = p.parts[0]; release(p, key, { date: D(1), form: form(100) }); const rel = lastRelease(p, key), f = (o) => formFitFunction(p, "part", rel, base, o);
  assert.deepEqual([f({ form: form(100) }).ok, f({ form: form(100) }).judged.form, f({}).judged.form], [true, true, false]);
  assert.deepEqual(f({ form: form(105) }).form, ["longueur hors tout 100 → 105 mm", "masse 54 → 56,7 g"]); assert.deepEqual(f({ form: { size: [100, 40, 5], mass: 54.5 } }).form, [], "under 2 % of mass and 0,05 mm : the same form");
  base.material = "PA66-GF30"; base.function = "Porte   la carte "; assert.deepEqual(f({}).fn, ["matériau AL6061-T6 → PA66-GF30"], "spaces in a sentence are not a change"); base.material = "AL6061-T6";
  base.elec = { kind: "conductor", net: "HV+" }; assert.deepEqual(f({}).fn, ["rôle électrique modifié"]); delete base.elec; base.function = "Tient le capot"; assert.deepEqual(f({}).fn, ["fonction réécrite"]); base.function = "Porte la carte";
  base.interfaces.push({ id: "IF3", type: "planar", name: "Plage", key: "z", side: "A", face: "+X", at: [0, 0], params: { w: 5, h: 5 } }); base.interfaces[1].name = "Appui renommé"; base.interfaces = base.interfaces.filter((i) => i.id !== "IF1");
  assert.deepEqual(f({}).fit, ["interface « Fixation carte » retirée", "interface « Plage » ajoutée"], "a new name alone is not a change ; one more interface is : the old part cannot take the place of the new one");
  assert.equal(f3Text(f({})), "Ajustement : interface « Fixation carte » retirée, interface « Plage » ajoutée"); base.process = "laser_cut"; base.finish = "Anodisé"; assert.equal(f({}).fn.length, 0, "how it is made is not what it is");
});

test("an assembly is released with the revision of each of its parts : they are pinned, and a part that moves on is not taken as compatible", () => {
  const p = project(), key = "assembly:ASM", asm = p.assemblies[0];
  assert.deepEqual(planRelease(p, key).blockers, ["BASE : jamais gelée — la geler d'abord", "CAPOT : jamais gelée — la geler d'abord"]); assert.throws(() => release(p, key, { date: D(1) }), /Avant de geler : BASE : jamais gelée/);
  release(p, "part:BASE", { date: D(1) }); release(p, "part:CAPOT", { date: D(2) }); let r = release(p, key, { date: D(3) });
  assert.deepEqual([r.pn, r.rev, r.release.uses], ["ASM-46023-50208", "A", { BASE: { pn: "PRT-46023-50069", rev: "A" }, CAPOT: { pn: "PRT-46023-50139", rev: "A" } }]);
  assert.deepEqual([...outerInterfaces(p, asm).keys()], ["i1/IF2", "i2/IF2"], "what the assembly offers outside : the interfaces no mate uses"); assert.ok(compatibility(p, key).every((x) => x.ok));
  /* the base gets a note and its revision B : the same number, yet not the assembly that was released */
  p.parts[0].notes = ["Ébavurer."]; assert.deepEqual(compatibility(p, key).map((x) => [x.part, x.state]), [["BASE", "working"], ["CAPOT", "same"]]); assert.match(planRelease(p, key).blockers[0], /BASE : modifiée depuis sa dernière révision gelée/);
  release(p, "part:BASE", { date: D(4) }); const c = compatibility(p, key)[0]; assert.deepEqual([c.state, c.pinned.rev, c.now.rev, c.ok], ["revision", "A", "B", false]); assert.match(c.text, /pas validée dans cette révision de l'assemblage/);
  let plan = planRelease(p, key); assert.deepEqual([plan.action, plan.rev, plan.moved], ["revision", "B", ["BASE"]], "the assembly itself is unchanged outside : its next revision takes the base rev. B");
  r = release(p, key, { date: D(5) }); assert.deepEqual([r.rev, r.release.uses.BASE], ["B", { pn: "PRT-46023-50069", rev: "B" }]); assert.ok(compatibility(p, key).every((x) => x.ok)); assert.equal(releases(p).find((x) => x.id === "ASM-46023-50208_A").uses.BASE.rev, "A", "revision A of the assembly still says rev. A of the base");
  /* a mated interface of the cover moves : the cover gets a new number ; outside, the assembly is the same → its revision C */
  p.parts[1].params.mx.value = 60; r = release(p, "part:CAPOT", { date: D(6) }); assert.deepEqual([r.action, r.rev], ["number", "A"]); assert.equal(compatibility(p, key)[1].state, "number");
  r = release(p, key, { date: D(7) }); assert.deepEqual([r.action, r.rev, r.release.uses.CAPOT.pn], ["revision", "C", "PRT-46023-50417"]);
  /* an outer interface of the base moves : the base gets a new number, and so does the assembly */
  p.parts[0].interfaces[1].params.w = 44; release(p, "part:BASE", { date: D(8) }); r = release(p, key, { date: D(9) });
  assert.deepEqual([r.action, r.rev, asm.derivedFrom.pn, asm.derivedFrom.rev], ["number", "A", "ASM-46023-50208", "C"]); assert.match(asm.derivedFrom.why, /Ajustement : interface extérieure « Pièce BASE — Appui » modifiée/);
});

test("an earlier revision can be taken back ; each release has its folder ; the whole survives the file", () => {
  const p = project(), key = "part:BASE"; release(p, key, { date: D(1), form: form() }); p.parts[0].notes = ["v2"]; release(p, key, { date: D(2), form: form() }); p.parts[0].notes = ["v3 en cours"];
  const back = restore(p, "PRT-46023-50069_A"); assert.deepEqual([back.notes, back.revision, back.pn, p.parts[0] === back], [undefined, "A", "PRT-46023-50069", true]); assert.equal(restore(p, "nobody"), null);
  assert.equal(planRelease(p, key).action, "revision", "taken back to A while B exists : releasing it makes C, nothing is rewritten");
  const files = releaseFiles(p, toDwiz); assert.deepEqual(files.map((f) => [f.path.join("/"), f.name]), [["06_Revisions/PRT-46023-50069_A Pièce BASE", "PRT-46023-50069_A Pièce BASE.dwiz"], ["06_Revisions/PRT-46023-50069_B Pièce BASE", "PRT-46023-50069_B Pièce BASE.dwiz"]]);
  assert.equal(fromDwiz(files[1].bytes).notes[0], "v2", "the file of a revision is the part as it was"); assert.deepEqual(plmRows(p)[0].slice(0, 8), ["PRT-46023-50069", "B", "Pièce BASE", "Gelée", "—", "2026-01-01", "—", "3F conservé"]);
  const again = fromDwiz(toDwiz(p)); assert.deepEqual(again.plm, p.plm, "the released revisions travel in the project file"); assert.equal(signature(again.parts[0]), signature(p.parts[0]));
  assert.deepEqual(usesOf(p, p.assemblies[0]).BASE.released, true); p.parts[0].notes = ["encore"]; assert.equal(usesOf(p, p.assemblies[0]).BASE.released, false);
});

test("released revisions travel in the mirror : the other member receives the release, and the part takes its number", () => {
  const jp = project(); joinTeam(jp, { handle: "jp" }, D(0)); stampLocal(jp, "jp", D(0)); const ami = forkMirror(fromDwiz(toDwiz(jp)), { handle: "ami" }, D(1));
  release(jp, "part:BASE", { date: D(2), by: "jp" }); stampLocal(jp, "jp", D(3));
  const r = mergeMirror(ami, fromDwiz(toDwiz(jp)), "ami", D(4)); assert.deepEqual([r.releases, r.taken, r.conflicts, r.nothing], [1, [], [], false], "the content did not change : only the release arrives");
  assert.deepEqual([ami.parts[0].pn, ami.parts[0].revision, releases(ami).map((x) => x.id)], ["PRT-46023-50139", "A", ["PRT-46023-50139_A"]]); assert.equal(planRelease(ami, "part:BASE").action, "none", "for her too it is released, up to date");
  assert.equal(mergeMirror(ami, fromDwiz(toDwiz(jp)), "ami", D(5)).releases, 0, "a release is never taken twice");
});

test("a sub-assembly is released first, and pinned in the release of its parent ; when it moves on, the parent asks for its next release", () => {
  const p = project(); p.parts.push(part("SOCLE")); const sub = p.assemblies[0];      // ASM (BASE + CAPOT) goes into TOP, next to SOCLE
  p.assemblies.push({ dw: "assembly/1", id: "TOP", name: "Produit", instances: [{ id: "i1", part: "SOCLE", fixed: true }, { id: "s1", asm: "ASM" }, { id: "s2", asm: "ASM" }], mates: [{ id: "J1", a: { inst: "i1", iface: "IF2" }, b: { inst: "s1~i1", iface: "IF2" } }] });
  const key = "assembly:TOP";
  assert.deepEqual(subsOf(p, p.assemblies[1]), { ASM: { pn: null, rev: "A", released: false } }, "each sub-assembly once, whatever the number of times it is placed");
  assert.deepEqual(planRelease(p, key).blockers, ["SOCLE : jamais gelée — la geler d'abord", "BASE : jamais gelée — la geler d'abord", "CAPOT : jamais gelée — la geler d'abord", "ASM : sous-assemblage jamais gelé — le geler d'abord"], "the parts first — through the levels —, then the sub-assembly");
  for (const [k, id] of ["BASE", "CAPOT", "SOCLE"].entries()) release(p, `part:${id}`, { date: D(k + 1) });
  assert.deepEqual(planRelease(p, key).blockers, ["ASM : sous-assemblage jamais gelé — le geler d'abord"], "its parts are released : the sub-assembly itself is not"); assert.throws(() => release(p, key, { date: D(4) }), /ASM : sous-assemblage jamais gelé/);
  release(p, "assembly:ASM", { date: D(5) }); assert.equal(subsOf(p, p.assemblies[1]).ASM.released, true);
  let r = release(p, key, { date: D(6) }); assert.equal(r.done, true); assert.deepEqual(r.release.subs, { ASM: { pn: sub.pn, rev: "A" } }, "pinned : its number and its revision"); assert.deepEqual(Object.keys(r.release.uses).sort(), ["BASE", "CAPOT", "SOCLE"], "and every part, through the levels");
  assert.equal(planRelease(p, key).action, "none"); assert.ok(compatibility(p, key).every((x) => x.ok)); assert.deepEqual(compatibility(p, key).filter((x) => x.kind === "assembly").map((x) => [x.part, x.state]), [["ASM", "same"]]);
  assert.ok(!("subs" in lastRelease(p, "assembly:ASM")), "an assembly without a sub-assembly keeps the record it always had");
  /* the sub-assembly changes : it is no longer a released state, and the parent says so */
  sub.notes = ["Serrer en croix"]; assert.equal(subsOf(p, p.assemblies[1]).ASM.released, false);
  assert.deepEqual(compatibility(p, key).find((x) => x.part === "ASM").state, "working"); assert.equal(compatibility(p, key).find((x) => x.part === "ASM").text, "sous-assemblage modifié, pas encore gelé");
  assert.deepEqual(planRelease(p, key).blockers, ["ASM : sous-assemblage modifié depuis sa dernière révision gelée — le geler d'abord"]);
  /* released again : revision B of the sub-assembly — not the one the parent was released with */
  r = release(p, "assembly:ASM", { date: D(7) }); assert.deepEqual([r.action, r.rev], ["revision", "B"]);
  const c = compatibility(p, key).find((x) => x.part === "ASM"); assert.deepEqual([c.state, c.pinned.rev, c.now.rev, c.ok], ["revision", "A", "B", false]); assert.match(c.text, /pas validée dans cette révision de l'assemblage/);
  const plan = planRelease(p, key); assert.deepEqual([plan.action, plan.rev, plan.moved, plan.blockers], ["revision", "B", ["ASM"], []], "the parent itself did not change : its sub-assembly moved on");
  r = release(p, key, { date: D(8) }); assert.deepEqual(r.release.subs, { ASM: { pn: sub.pn, rev: "B" } }); assert.equal(planRelease(p, key).action, "none");
  /* a part inside moves on : the sub-assembly first, then the parent */
  p.parts[0].notes = ["Ébavurer"]; assert.deepEqual(planRelease(p, key).blockers, ["BASE : modifiée depuis sa dernière révision gelée — la geler d'abord", "ASM : sous-assemblage modifié depuis sa dernière révision gelée — le geler d'abord"]);
  release(p, "part:BASE", { date: D(9) }); assert.deepEqual(planRelease(p, key).blockers, ["ASM : sous-assemblage modifié depuis sa dernière révision gelée — le geler d'abord"], "the sub-assembly was released with the earlier revision of the part");
  release(p, "assembly:ASM", { date: D(10) }); assert.deepEqual([planRelease(p, key).action, planRelease(p, key).moved.sort()], ["revision", ["ASM", "BASE"]]);
  /* taken out : the parent is no longer what was released */
  release(p, key, { date: D(11) }); p.assemblies[1].instances = p.assemblies[1].instances.filter((i) => !i.asm); p.assemblies[1].mates = [];
  assert.deepEqual(compatibility(p, key).find((x) => x.part === "ASM").state, "removed"); assert.notEqual(planRelease(p, key).action, "none");
  assert.match(plmRows(p).find((row) => row[2] === "Produit")[8], /^ASM = ASM-\d{5}-\d{5} rév\. C · /, "the report names the sub-assembly first, then the parts");
});
