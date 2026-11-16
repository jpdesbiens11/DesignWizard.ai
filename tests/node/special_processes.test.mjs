/* The special processes of the Shop : precision laser cutting by sheet material, 3D printing by process and by material —
   the library, the Shop companion, the routing sheet, the DFx rules, the words handed to an AI. Real kernel. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { MATERIALS, PROCESSES, material } from "../../web/js/cad/materials.js";
import { LASER_FAMILIES, laserProfile, laserLimits, sheetSeries, sheetDefault, sheetWord, AM_PROCESSES, AM_MATERIALS, amMaterial, amLimits, printProcess, printSteps, cutStep, processSheet, processBrief, specialRows, SOURCES } from "../../web/js/cad/special_processes.js";
import { synthesize, recommend } from "../../web/js/core/shop_intent.js";
import { routing } from "../../web/js/cad/shop.js";
import { orderCheck } from "../../web/js/cad/order.js";
import { RULEBOOK, checkPart, ruleInfo } from "../../web/js/analysis/dfx_rules.js";
import { applyPatch } from "../../web/js/analysis/dfx_core.js";
import { shopPrompt } from "../../web/js/core/prompts.js";
import { PAPER_THICKNESS } from "../../web/js/core/busbar_lam.js";

const K = await kernel();
const check = (spec) => { const built = buildPart(K, spec), main = built.bodies.find((b) => b.name === built.main) || built.bodies[0], res = checkPart(spec, built, main ? { mesh: K.tessellate(main.shape) } : undefined); K.flush(); return { built, ...res }; };
const find = (r, id, sev) => r.findings.find((f) => f.id === id && (!sev || f.severity === sev)), ids = (r) => r.findings.map((f) => f.id);
const bolt = (o = {}) => ({ type: "bolt_pattern", side: "A", name: "Fixation", where: "+Z", params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } }, ...o });
const windowIn = (r) => ({ type: "cutout", side: "A", name: "Fenêtre", where: "+Z", params: { shape: "rect", w: 20, h: 10, r } });
const shop = (brief) => synthesize({ name: "Essai", quantity: 5, ...brief }, "T-1").spec;
const flatPart = (material_, t, features = []) => ({ dw: "part/1", id: "T-FLAT", name: "Feuille", material: material_, process: "laser_cut", params: {}, interfaces: [], features: [{ op: "box", size: [60, 40, t] }, ...features] });
const printed = (material_, process, features) => ({ dw: "part/1", id: "T-AM", name: "Imprimée", material: material_, process, elec: { kind: "none" }, params: {}, interfaces: [], features });

test("the library holds together : every laser material has its sheet, every printing material its process, every figure its basis", () => {
  for (const m of MATERIALS) if (m.processes.includes("laser_cut")) assert.ok(laserProfile(m.id) && laserProfile(m.id).verdict === "ok", `${m.id} is offered for laser cutting : it needs a sheet that says it cuts`);
  for (const [id, e] of Object.entries(AM_MATERIALS)) { const m = material(id); assert.ok(m && m.processes.includes(e.process) && AM_PROCESSES[e.process] && PROCESSES[e.process], id); assert.ok(e.use && Array.isArray(e.post) && Array.isArray(e.watch), id); assert.equal((AM_PROCESSES[e.process].kind === "metal"), m.cls === "metal", `${id} : a metal prints in a metal process`); }
  for (const [k, f] of Object.entries(LASER_FAMILIES)) { assert.ok(f.fr && f.short && f.source && f.cut && f.basis && f.edge !== undefined, k); if (f.verdict === "ok") assert.ok(f.t[1] > f.t[0] && f.kerf[1] >= f.kerf[0] && f.hole.min > 0 && f.slot.min > 0 && f.web.min > 0 && f.tol > 0, k); else assert.ok(f.why && f.instead, k); }
  for (const P of Object.values(AM_PROCESSES)) assert.ok(P.fr && P.basis && P.wall > 0 && P.wallRec >= P.wall && P.hole > 0 && P.build.length === 3 && P.make && P.clean);
  assert.deepEqual([...new Set(SOURCES.map((s) => s.how))].sort(), ["lu", "page", "résumé"]); assert.ok(SOURCES.every((s) => s.title && s.by && s.gives) && new Set(SOURCES.map((s) => s.id)).size === SOURCES.length);
  assert.deepEqual(["PVC-U", "PTFE", "pvc", "UNOBTAINIUM", ""].map((id) => (laserProfile(id) || {}).verdict || null), ["forbidden", "forbidden", "forbidden", null, null]);
  assert.deepEqual([laserProfile("PC").verdict, laserProfile("NOMEX-410").key, laserProfile("PI-FILM").key, laserProfile("FR4-CTI600").key, laserProfile("CU-C110").key, laserProfile("TI-6AL-4V").key], ["caution", "aramid", "film", "laminate", "copper", "titanium"]);
  for (const id of ["NOMEX-410", "PI-FILM", "PET-FILM", "FR4", "PMMA", "POM", "SS-304"]) { const s = sheetSeries(id); assert.deepEqual(s, [...s].sort((a, b) => a - b), id); }
  assert.equal(PAPER_THICKNESS, sheetSeries("NOMEX-410"), "the laminated busbar and the Shop read the same thicknesses of paper");
  assert.deepEqual([sheetWord("SS-304"), sheetWord("NOMEX-410"), sheetWord("FR4"), sheetWord("PMMA")], ["Tôle", "Feuille", "Plaque", "Plaque"]); assert.deepEqual([sheetDefault("SS-304"), sheetDefault("NOMEX-410"), sheetDefault("FR4"), sheetDefault("PMMA")], [null, 0.25, 1.6, null]);
});

test("the smallest details of a laser cut : against the thickness in a thick sheet, an absolute minimum in a thin one", () => {
  const steel = laserProfile("SS-304"), paper = laserProfile("NOMEX-410");
  assert.deepEqual(laserLimits(steel, 6), { hole: 3, slot: 6, web: 6 }); assert.deepEqual(laserLimits(steel, 0.5), { hole: 0.5, slot: 1, web: 1.6 });
  assert.deepEqual(laserLimits(paper, 0.25), { hole: 0.5, slot: 0.5, web: 1.5 }); assert.deepEqual(laserLimits(paper, 0.05), laserLimits(paper, 0.76), "a paper : the same minimum at every thickness");
  assert.deepEqual([laserProfile("SS-304").t[1], laserProfile("AL5052-H32").t[1], laserProfile("CU-C110").t[1], laserProfile("FR4").t[1]], [20, 15, 10, 1.6], "what a 6 kW fibre laser and a UV laser cut, as read");
});

test("a sheet material goes to the laser in the Shop : its own thicknesses, its own cutting line, no deburring of a paper", () => {
  assert.deepEqual([recommend({ material: "NOMEX-410", interfaces: [bolt()] }).form, recommend({ material: "FR4", interfaces: [] }).process, recommend({ material: "PI-FILM" }).form], ["sheet", "laser_cut", "sheet"]);
  const paper = shop({ material: "NOMEX-410", interfaces: [bolt()] });
  assert.deepEqual([paper.process, paper.family, paper.params.t.value, paper.stock.form], ["laser_cut", "sheet", 0.25, "sheet"]); assert.ok(paper.params.t.min <= 0.05 && paper.params.t.max >= 0.76 && paper.params.t.step < 0.05);
  assert.match(paper.interview.assumptions.join(" "), /Feuille de 0,25 mm : l'épaisseur courante.*Découpe : laser CO2/s); assert.match(paper.notes.join(" "), /non carbonisé/);
  const thin = shop({ material: "NOMEX-410", t: 0.13, interfaces: [bolt(), windowIn(1)] }), b = buildPart(K, thin), r = routing(thin, b).steps.map((s) => s.text);
  assert.equal(thin.params.t.value, 0.13); assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.match(b.facts.stock.label, /^Feuille de 0,13 mm/); assert.equal(b.facts.stock.exact, true, "0,13 mm is a thickness the paper is sold in");
  assert.match(r[1], /^Découper le contour au laser CO2/); assert.ok(r.some((x) => /Découper l'ouverture 20 × 10 dans la même passe/.test(x)), "a window in a cut sheet is cut, not milled"); assert.ok(!r.some((x) => /casser les angles vifs/.test(x)) && r.some((x) => /non carbonisé/.test(x)), r.join(" | "));
  assert.equal(shop({ material: "FR4", interfaces: [bolt()] }).params.t.value, 1.6); assert.equal(shop({ material: "PMMA", form: "sheet", interfaces: [bolt()] }).params.t.value, 4, "an acrylic : 3,2 mm under an M4 head, so the next plate it is sold in");
  const cu = shop({ material: "CU-C110", form: "sheet", interfaces: [] }); assert.equal(cu.params.t.value, 1, "a metal sheet : the gauges of the Shop"); assert.match(buildPart(K, cu).facts.stock.label, /^Tôle de 1 mm/); assert.equal(cutStep("CU-C110"), "Découper le contour au laser à fibre, ébavurer le dos");
  assert.deepEqual([cutStep("FR4").includes("laser UV"), cutStep("PVC-U").includes("jamais au laser"), cutStep("UNOBTAINIUM")], [true, true, "Découper le contour au laser / jet d'eau"]); K.flush();
});

test("DFx of a laser cut, by material : forbidden, to avoid, too thick, too small, too close, sharp, and what the edge is", () => {
  const paper = check(shop({ material: "NOMEX-410", interfaces: [bolt(), windowIn(0)] }));
  assert.equal(paper.summary.errors, 0); assert.ok(!ids(paper).includes("MAT-01") && !ids(paper).includes("LAM-04") && !ids(paper).includes("LC-02"), ids(paper).join(" "));
  const sharp = find(paper, "LAS-05"); assert.ok(sharp && sharp.severity === "warn" && sharp.limit === 0.5 && sharp.fix, "a sharp inside corner tears a paper"); assert.match(sharp.message, /amorce une déchirure/);
  assert.match(find(paper, "LAS-06").message, /Isolant découpé au laser \(papier aramide\).*ne compte pas dans une ligne de fuite/);
  const fixed = applyPatch(shop({ material: "NOMEX-410", interfaces: [bolt(), windowIn(0)] }), sharp.fix.patch); assert.ok(!find(check(fixed), "LAS-05"), "one click rounds the corners");
  // an odd thickness of paper is not in ITS series ; the fix goes to the nearest one
  const odd = check(flatPart("NOMEX-410", 0.2)); assert.equal(find(odd, "MAT-01").limit, 0.18); assert.ok(!find(check(flatPart("NOMEX-410", 0.38)), "MAT-01"));
  // too small, too close : the absolute minimum of a thin sheet
  const tiny = check(flatPart("NOMEX-410", 0.25, [{ op: "hole", id: "petit", face: "+Z", at: [30, 20], d: 0.3 }, { op: "hole", id: "bord", face: "+Z", at: [1.5, 20], d: 1 }]));
  assert.deepEqual([find(tiny, "LAS-03").limit, find(tiny, "LAS-03").feature, !!find(tiny, "LAS-03").fix], [0.5, "petit", true]); assert.deepEqual([find(tiny, "LAS-04").value, find(tiny, "LAS-04").limit, find(tiny, "LAS-04").feature], [1, 1.5, "bord"]);
  // a thick metal sheet : the thickness rules of the plate speak, not the laser ones
  const steel = check(flatPart("SS-304", 3, [{ op: "hole", id: "h", face: "+Z", at: [30, 20], d: 2 }])); assert.ok(ids(steel).includes("SM-06") && !ids(steel).includes("LAS-03") && !ids(steel).includes("LAS-06"), ids(steel).join(" "));
  // too thick for the laser of the material
  assert.match(find(check(flatPart("FR4", 3.2)), "LAS-02").message, /laser UV.*1,6 mm.*détourage à la fraise/); assert.equal(find(check(flatPart("AL5052-H32", 16)), "LAS-02").limit, 15); assert.ok(!find(check(flatPart("SS-304", 6)), "LAS-02"));
  // never, and badly
  const pvc = check(flatPart("PVC-U", 3)); assert.equal(find(pvc, "LAS-01").severity, "error"); assert.match(find(pvc, "LAS-01").message, /chlorure d'hydrogène/); assert.equal(pvc.summary.status, "fail"); assert.ok(!find(pvc, "LAS-02") && !find(pvc, "LAS-06"));
  const pc = check(flatPart("PC", 2)); assert.equal(find(pc, "LAS-01").severity, "warn"); assert.match(find(pc, "LAS-01").message, /acrylique/); assert.ok(find(pc, "LAS-02"));
  assert.equal(find(check(flatPart("UNOBTAINIUM", 2)), "LAS-01").severity, "info");
  // a conductor is deburred before it is insulated ; a plain copper sheet says nothing
  const bar = check({ ...flatPart("CU-C110", 2), elec: { kind: "conductor", net: "HV+" } }); assert.match(find(bar, "LAS-06").message, /Conducteur découpé au laser.*ébavurer/s); assert.ok(!find(check(flatPart("CU-C110", 2)), "LAS-06"));
  // a board : the copper stays back from the cut
  assert.match(find(check(flatPart("FR4", 1.6)), "LAS-06").message, /cuivre et composants en retrait.*0,2 mm.*aucune distance normalisée/s);
});

test("a printing material goes to its process in the Shop, and its routing sheet carries what it asks after the print", () => {
  assert.deepEqual(["TI-6AL-4V", "IN718", "ALSI10MG", "PA12", "PEI-9085", "RESIN-SLA", "AL6061-T6", "NOMEX-410"].map(printProcess), ["lpbf", "lpbf", "lpbf", "mjf", "fdm", "sla", null, null]);
  assert.deepEqual([recommend({ material: "ALSI10MG", interfaces: [bolt()] }).form, recommend({ material: "TI-6AL-4V", interfaces: [bolt()] }).form, recommend({ material: "RESIN-SLA", interfaces: [bolt()], quantity: 3 }).process], ["print", "plate", "sla"], "a printing-only alloy prints ; a titanium that also machines keeps its plate until the designer says print");
  const ti = shop({ material: "TI-6AL-4V", form: "print", interfaces: [bolt(), { type: "fit", side: "B", name: "Palier", where: "+Z", params: { d: 12, length: 8 } }] }), b = buildPart(K, ti), route = routing(ti, b), t = route.steps.map((s) => s.text);
  assert.equal(ti.process, "lpbf"); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  const at = (re) => t.findIndex((x) => re.test(x)), order = [/^Fusionner sur lit de poudre/, /^Détendre sur le plateau, sous vide/, /^Séparer du plateau/, /^Pièce en fatigue : compaction isostatique/, /^Usiner les surfaces fonctionnelles/].map(at);
  assert.ok(order.every((i) => i > 0) && order.every((i, k) => !k || i > order[k - 1]), `relief before the part leaves its plate, compaction before machining : ${t.join(" | ")}`);
  const res = checkPart(ti, b, { mesh: K.tessellate(b.bodies[0].shape) }); assert.equal(res.summary.errors, 0); assert.match(find(res, "AM-16").message, /« Palier ».*Ra 5 à 10 µm.*à convenir avec l'atelier/s); assert.match(find(res, "AM-17").message, /ASTM F2924.*ASTM F3001.*ELI/s);
  const o = orderCheck(ti, b, res, route, { quantity: 2 }); assert.deepEqual(o.days, [7, 15]); assert.equal(o.ready, true);
  assert.deepEqual(printSteps("lpbf", "IN625").slice(1, 5), ["Détendre sur le plateau", "Séparer du plateau (fil ou scie), retirer les supports", "Recuit de mise en solution", "Pièce en fatigue : compaction isostatique à chaud (CIC / HIP), avant le recuit — c'est l'état de la spécification aéronautique"]);
  assert.deepEqual(printSteps("mjf", "PA12"), ["Imprimer en MJF / SLS", "Dépoudrer et microbiller", "Teindre ou étancher si la pièce voit un fluide"]); assert.deepEqual(printSteps("fdm", "TI-6AL-4V"), ["Imprimer en FDM (orienter la plus grande face sur le plateau)", "Retirer les supports"], "a material out of its process brings nothing"); assert.deepEqual(printSteps("cnc_milling", "PA12"), []);
  assert.equal(amLimits("lpbf", "SS-316L").overhang, 55); assert.equal(amLimits("lpbf", "TI-6AL-4V").overhang, 45); assert.equal(amLimits("fdm", "SS-316L").overhang, 45); assert.equal(amMaterial("pa12").id, "PA12"); assert.equal(amMaterial("AL6061-T6"), null); K.flush();
});

test("DFx of a printed metal part : the material in its process, walls, holes, supports, powder, plate", () => {
  const block = [{ op: "box", size: [60, 40, 30] }];
  const wrong = check(printed("TI-6AL-4V", "fdm", block)); assert.equal(find(wrong, "AM-10").severity, "error"); assert.match(find(wrong, "AM-10").message, /s'imprime en « Metal 3D printing/); assert.equal(applyPatch(printed("TI-6AL-4V", "fdm", block), find(wrong, "AM-10").fix.patch).process, "lpbf", "one click sends the titanium to its process");
  assert.equal(find(check(printed("AL6061-T6", "lpbf", block)), "AM-10").severity, "warn", "a metal the library does not print : to confirm"); assert.equal(find(check(printed("PA12", "lpbf", block)), "AM-10").severity, "error"); assert.ok(!find(check(printed("IN718", "lpbf", block)), "AM-10"));
  const thin = check(printed("IN718", "lpbf", [{ op: "box", size: [60, 40, 30] }, { op: "shell", id: "coque", t: 0.3, open: ["+Z"] }])); assert.deepEqual([find(thin, "AM-11").severity, find(thin, "AM-11").limit, !!find(thin, "AM-11").fix], ["error", 1, true]);
  assert.equal(find(check(printed("IN718", "lpbf", [{ op: "box", size: [60, 40, 30] }, { op: "shell", id: "coque", t: 0.7, open: ["+Z"] }])), "AM-11").severity, "warn", "between what prints and what is advised");
  const holes = check(printed("SS-316L", "lpbf", [...block, { op: "hole", id: "fin", face: "+Z", at: [10, 10], d: 0.6, depth: 5 }, { op: "hole", id: "filet", face: "+Z", at: [30, 20], d: 3.3, depth: 8, thread: "M4" }, { op: "hole", id: "travers", face: "-Y", at: [30, 15], d: 12, depth: "through" }]));
  const small = holes.findings.find((f) => f.id === "AM-12" && f.severity === "warn"); assert.deepEqual([small.feature, small.limit, !!small.fix], ["fin", 1, true]); assert.match(holes.findings.find((f) => f.id === "AM-12" && f.severity === "info").message, /1 trou\(s\) taraudé\(s\) \(M4\).*taraudé en reprise/s);
  const sup = find(holes, "AM-13"); assert.match(sup.message, /Imprimée dessus vers le haut \(\+Z\) : \d+ mm² de surfaces à moins de 55° du plateau.*il n'en reste que 0 mm².*goutte d'eau/s, "measured on the mesh ; 316L carries itself from 55° only");
  assert.match(JSON.stringify(sup.fix.patch), /"path":"print\.dir","value":"[+-]Y"/, "one click turns the part so that the cross hole stands up");
  const turned = applyPatch(printed("SS-316L", "lpbf", [...block, { op: "hole", id: "travers", face: "-Y", at: [30, 15], d: 12, depth: "through" }]), sup.fix.patch); assert.ok(!find(check(turned), "AM-13"), "printed that way, nothing to support");
  assert.ok(!find(check(printed("SS-316L", "lpbf", [...block, { op: "hole", id: "h", face: "-Y", at: [30, 15], d: 6, depth: "through" }])), "AM-13"));
  assert.equal(find(check(printed("ALSI10MG", "lpbf", [{ op: "box", size: [320, 100, 40] }])), "AM-15").severity, "error"); assert.ok(!find(check(printed("ALSI10MG", "lpbf", [{ op: "box", size: [240, 240, 290] }])), "AM-15"));
  // a resin part : the housing rules read the limits of stereolithography ; a polyamide says what it asks after
  const resin = check(printed("RESIN-SLA", "sla", [{ op: "box", size: [60, 40, 30] }, { op: "shell", id: "coque", t: 0.4, open: ["+Z"] }])); assert.equal(find(resin, "HSG-01").limit, 0.6); assert.match(find(resin, "AM-17").message, /post-cuire aux UV/);
  assert.match(find(check(printed("PA12", "mjf", block)), "AM-17").message, /reprend l'humidité/); assert.ok(!find(check(printed("ABS", "fdm", block)), "AM-10"));
});

test("the rule book : one entry per process, the laser sheet after the flat plate, the new processes printed", () => {
  const by = (p) => RULEBOOK.filter((b) => b.process === p);
  for (const p of ["laser_cut", "fdm", "mjf", "sla", "lpbf"]) { assert.equal(by(p).length, 1, p); const r = by(p)[0].rules.map((x) => x.id); assert.equal(new Set(r).size, r.length, `${p} : no rule twice`); assert.ok(by(p)[0].steps.length >= 4 && by(p)[0].fr, p); }
  const cut = by("laser_cut")[0].rules.map((x) => x.id); assert.ok(cut.indexOf("LC-01") >= 0 && cut.indexOf("LAS-01") > cut.indexOf("LC-01") && ["LAS-02", "LAS-03", "LAS-04", "LAS-05", "LAS-06", "LAM-04"].every((id) => cut.includes(id)));
  assert.deepEqual(by("lpbf")[0].rules.map((x) => x.id), ["AM-10", "AM-11", "AM-12", "AM-13", "AM-14", "AM-15", "AM-16", "AM-17"]); assert.ok(by("sla")[0].rules.some((x) => x.id === "HSG-01") && by("sla")[0].rules.some((x) => x.id === "AM-14") && by("fdm")[0].rules.some((x) => x.id === "AM-17"));
  assert.match(ruleInfo("LAS-02", "laser_cut").limit, /acier ≤ 20 mm · aluminium ≤ 15 mm · cuivre et laiton ≤ 10 mm.*FR-4 ≤ 1,6 mm/); assert.match(ruleInfo("AM-13", "lpbf").limit, /45° du plateau \(55° pour l'inox 316L\), pont ≤ 2 mm, trou horizontal rond ≤ Ø8/);
  assert.match(ruleInfo("AM-16", "lpbf").why, /Aucune surépaisseur chiffrée n'est publiée/, "what was not found is said, not invented"); assert.match(ruleInfo("HSG-01", "sla").limit, /SLA ≥ 0,6 mm/);
});

test("the sheet of a process goes to an AI : in the prompt of the Shop, and as a whole from the screen of the special processes", () => {
  const paper = processSheet("laser_cut", "NOMEX-410", 0.25); assert.match(paper.join("\n"), /laser CO2.*Dans 0,25 mm : trou ≥ Ø0,5, fente ≥ 0,5 mm, pont de matière ≥ 1,5 mm, angles rentrants R ≥ 0,5 mm/s);
  assert.match(processSheet("laser_cut", "CU-C110", 2).join("\n"), /laser à fibre.*Dans 2 mm : trou ≥ Ø2 \(Ø1 possible au laser\), fente ≥ 2 mm, pont de matière ≥ 4 mm/s); assert.equal(processSheet("laser_cut", "PVC-U").length, 2);
  assert.match(processSheet("lpbf", "TI-6AL-4V").join("\n"), /Paroi ≥ 0,4 mm \(1 mm conseillé\).*Supports sous 45° du plateau.*2 ouvertures ≥ Ø3.*Pièce en fatigue : compaction isostatique/s); assert.deepEqual(processSheet("cnc_milling", "AL6061-T6"), []);
  const spec = shop({ material: "NOMEX-410", interfaces: [bolt()] }), prompt = shopPrompt({ name: "Module" }, { fn: "Isoler" }, spec); assert.match(prompt, /CE QUE LE PROCÉDÉ DEMANDE À CETTE MATIÈRE \(Precision laser cutting.*Dans 0,25 mm : trou ≥ Ø0,5/s);
  assert.ok(!/CE QUE LE PROCÉDÉ DEMANDE/.test(shopPrompt({ name: "Module" }, {}, shop({ material: "AL6061-T6", interfaces: [bolt()] }))), "a milled part : nothing added");
  const cut = processBrief("laser", MATERIALS), am = processBrief("impression", MATERIALS);
  assert.match(cut, /^Voici ce que la DÉCOUPE LASER DE PRÉCISION/); for (const id of ["NOMEX-410", "FR4", "CU-C110", "PMMA", "PVC-U", "TI-6AL-4V"]) assert.ok(cut.includes(`## ${id} — `), id); assert.ok(!cut.includes("## SILICONE"));
  const rows = specialRows([{ id: "ISO-1", name: "Intercalaire", process: "laser_cut", material: "NOMEX-410" }, { id: "BRK-1", process: "lpbf", material: "TI-6AL-4V" }, { id: "X", process: "cnc_milling", material: "AL6061-T6" }, { id: "P", process: "laser_cut", material: "PVC-U" }, { id: "Q", process: "fdm", material: "UNOBTAINIUM" }]);
  assert.deepEqual(rows.map((r) => r[0]), ["ISO-1", "BRK-1", "P", "Q"], "the report lists the laser-cut and the printed parts, not the milled ones"); assert.match(rows[0].join(" | "), /Precision laser cutting \| Nomex.*laser CO2.*Épaisseur ≤ 0,76 mm/); assert.match(rows[1].join(" | "), /ASTM F2924.*Paroi ≥ 0,4 mm.*détendre sur le plateau.*compaction/s); assert.match(rows[2].join(" | "), /Jamais au laser/); assert.match(rows[3][6], /à confirmer avec le fournisseur/);
  assert.match(am, /^Voici ce que l'IMPRESSION 3D/); for (const id of Object.keys(AM_MATERIALS)) assert.ok(am.includes(`## ${id} — `), id); assert.match(am, /## IN718 — .*\(process « lpbf »\)/); assert.ok(!am.includes("## NOMEX-410"));
});

test("the demonstration shows both processes : a laser-cut insulator mated on the heat sink, a printed titanium bracket", async () => {
  const { DEMO_DRIVE } = await import("../../web/js/demo/demo_drive.js"), by = (id) => DEMO_DRIVE.parts.find((p) => p.id === id), iso = by("DRV-ISO"), br = by("DRV-BRACKET"), sink = by("DRV-HEATSINK");
  assert.deepEqual([iso.process, iso.material, iso.params.t.value, br.process, br.material], ["laser_cut", "NOMEX-410", 0.25, "lpbf", "TI-6AL-4V"]);
  const a = check(iso), b = check(br);
  assert.equal(a.built.log.filter((l) => l.level === "error").length, 0); assert.equal(a.summary.errors + a.summary.warnings, 0, ids(a).join(" ")); assert.match(find(a, "LAS-06").message, /papier aramide/); assert.match(a.built.facts.stock.label, /^Feuille de 0,25 mm/);
  assert.equal(b.summary.errors, 0, ids(b).join(" ")); assert.match(find(b, "AM-17").message, /compaction isostatique/); assert.match(b.findings.find((f) => f.id === "AM-12" && f.severity === "info").message, /2 trou\(s\) taraudé\(s\) \(M4\)/);
  assert.match(routing(br, b.built).steps.map((s) => s.text).join(" | "), /Fusionner sur lit de poudre.*Détendre.*Séparer du plateau.*Tarauder 2 × M4 en reprise/s);
  /* the insulator fits the thermal window of the base with a clearance, and shares its key with the seat on the heat sink */
  const base = by("DRV-BASE"); assert.ok(iso.params.L.value < base.params.winL.value && iso.params.W.value < base.params.winW.value);
  const seat = sink.interfaces.find((i) => i.key === "thermal_iso_seat"), foot = iso.interfaces[0]; assert.deepEqual([seat.side, foot.side, seat.type, foot.type, foot.key], ["B", "A", "planar", "planar", "thermal_iso_seat"]);
  const asm = DEMO_DRIVE.assemblies[0]; assert.ok(asm.instances.some((i) => i.part === "DRV-ISO") && asm.mates.some((m) => m.a.inst === "i6" && m.b.inst === "i5")); assert.ok(!asm.instances.some((i) => i.part === "DRV-BRACKET"), "the bracket is a variant : in the project, not yet in the assembly");
  assert.deepEqual(specialRows(DEMO_DRIVE.parts).map((r) => [r[0], r[2]]), [["DRV-ISO", "Precision laser cutting"], ["DRV-BRACKET", "Laser powder bed fusion, metal (LPBF)"], ["DRV-FOOT", "Sheet metal bending"]], "the report of the demonstration has its section of special processes");
});

test("which cut edges the isolation analysis leaves out : insulating sheets cut by laser, nothing else", async () => {
  const { charredEdge } = await import("../../web/js/cad/special_processes.js"), p = (process, material_) => ({ process, material: material_ });
  assert.deepEqual([["laser_cut", "NOMEX-410"], ["laser_cut", "FR4"], ["laser_cut", "PI-FILM"], ["laser_cut", "PMMA"], ["laser_cut", "CU-C110"], ["laser_cut", "PVC-U"], ["cnc_milling", "FR4"], ["pcb", "FR4"]].map(([a, b]) => charredEdge(p(a, b))),
    [true, true, true, false, false, false, false, false], "paper, laminate and film cut by laser ; not an acrylic, not a metal, not a routed or a fabricated board");
  assert.equal(charredEdge(null), false); assert.equal(charredEdge({}), false);
});
