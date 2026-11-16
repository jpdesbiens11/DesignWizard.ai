// The connectors modelled series by series : the published dimensions come out of the generators as they went in, each
// series has a look of its own, a land pattern ready for a board, and says how its dimensions were checked.
import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTORS } from "../../web/js/cad/elec_library.js";
import { SERIES, MODEL_WORDS, DIMS_LEVELS, SERIES_PACKAGES, seriesOf, makerSite, dimsCount } from "../../web/js/cad/connector_series.js";
import { layout, modelSolids, modelEnvelope, modelFootprint, solidsBox, MODEL_KINDS, onBoard } from "../../web/js/cad/connector_models.js";
import { connectorPart, connectorBuild, seriesPoles, defaultPoles, useMakerModel, dropMakerModel } from "../../web/js/core/elec_parts.js";
import { footprint, seriesPackage, packageList } from "../../web/js/pcba/footprints.js";
import { SERIES_PARTS } from "../../web/js/pcba/library_series.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { partIssues } from "../../web/js/core/guide_checks.js";

const fam = (id) => CONNECTORS.find((c) => c.id === id), near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what} : ${a} for ${b}`);

test("every connector of the library has its series, and every series says what it is built on and how it was checked", () => {
  assert.deepEqual(CONNECTORS.filter((c) => !SERIES[c.id]).map((c) => c.id), [], "no family left with the shape of its kind");
  assert.deepEqual(Object.keys(SERIES).filter((id) => !fam(id)), [], "no series without a family");
  for (const [id, S] of Object.entries(SERIES)) { assert.ok(MODEL_KINDS.includes(S.model) && MODEL_WORDS[S.model], `${id} : model`); assert.ok(DIMS_LEVELS[S.dims], `${id} : dims`); assert.ok(S.ref && /^#[0-9a-f]{6}$/.test(S.color), `${id} : ref, colour`); assert.ok(String(S.basis).length > 60, `${id} : basis`); }
  for (const w of Object.values(MODEL_WORDS)) assert.ok(w.label && w.fr && w.label !== w.fr, "a model has its English name and its French word");
  for (const S of Object.values(SERIES)) { if (S.dims === "typed") assert.match(S.basis, /saisi|mémoire/, "a typed series says it was typed"); if (S.dims === "read") assert.match(S.basis, /Fiche|Catalogue|Dessin/, "a read series names the document"); if (S.dims === "part") assert.match(S.basis, /lus/); }
  const n = dimsCount(); assert.equal(n.read + n.part + n.typed, CONNECTORS.length); assert.deepEqual([n.read, n.part, n.typed], [15, 6, 29], "what was read on a data sheet, no more claimed");
  assert.deepEqual(Object.entries(SERIES).filter(([, S]) => S.dims === "read").map(([id]) => id).sort(), ["amass-xt60", "amass-xt90", "anderson-pp120", "anderson-pp180", "anderson-pp45", "anderson-pp75", "anderson-sb175", "anderson-sb350", "hirose-df13", "hirose-fh12", "jst-ph", "jst-xh", "molex-minifit", "molex-picoblade", "staubli-mc4"]);
  assert.equal(makerSite("Molex"), "https://www.molex.com"); assert.equal(makerSite("MIL-DTL-38999"), null, "a standard has no maker's site"); assert.equal(seriesOf("nope"), null);
});

test("the dimensions read on the data sheets come out of the generators as they went in", () => {
  const len = (id, n) => layout(SERIES[id], n).L;
  for (const [n, B] of [[2, 5.9], [4, 9.9], [8, 17.9], [16, 33.9]]) near(len("jst-ph", n), B, `JST PH, B for ${n} circuits`);
  for (const [n, B] of [[2, 7.4], [6, 17.4], [20, 52.4]]) near(len("jst-xh", n), B, `JST XH, B for ${n} circuits`);
  for (const [n, B] of [[2, 4.15], [8, 11.65], [15, 20.4]]) near(len("hirose-df13", n), B, `Hirose DF13, B for ${n} contacts`);
  for (const [n, C] of [[6, 7.1], [10, 9.1], [53, 30.6]]) near(len("hirose-fh12", n), C, `Hirose FH12, C for ${n} contacts`);
  for (const [n, A] of [[2, 5.4], [4, 9.6], [8, 18.0], [24, 51.6]]) near(len("molex-minifit", n), A, `Mini-Fit Jr., A for ${n} circuits`);
  for (const [n, A] of [[2, 4.25], [4, 6.75], [9, 13], [15, 20.5]]) near(len("molex-picoblade", n), A, `PicoBlade, A for ${n} circuits`);
  assert.equal(modelSolids(SERIES["molex-picoblade"], 3).filter((s) => /^fente/.test(s.id)).length, 1, "one locking window for 2 and 3 circuits"); assert.equal(modelSolids(SERIES["molex-picoblade"], 4).filter((s) => /^fente/.test(s.id)).length, 2, "two from 4");
  const box = (id, n) => { const B = solidsBox(modelSolids(SERIES[id], n)); return [B.L, B.W, B.H]; };
  assert.deepEqual(box("amass-xt60", 2), [15.4, 23.8, 9.2]); assert.deepEqual(box("amass-xt90", 2), [21.3, 30.7, 10.7]); assert.deepEqual(box("anderson-sb175", 2), [55.6, 79.6, 25.4]); assert.deepEqual(box("anderson-sb350", 2), [69.9, 107.9, 33.3]); assert.deepEqual(box("staubli-mc4", 1), [18.8, 61, 18.8]);
  const xt = modelSolids(SERIES["amass-xt60"], 2).filter((s) => /^p\d/.test(s.id)); near(xt[1].at[0] - xt[0].at[0], 7.2, "XT60, contacts 7,2 apart");
  assert.deepEqual([SERIES["anderson-pp45"].block, SERIES["anderson-pp75"].block, SERIES["anderson-pp120"].block, SERIES["anderson-pp180"].block], [[7.9, 7.9, 24.6], [15.9, 15.9, 47.9], [22.2, 22.2, 69.9], [28.6, 28.6, 82.6]]);
  assert.deepEqual(box("te-hva280", 2).filter((v, i) => i !== 1), [45.4, 40.6], "HVA 280 header : 45,4 × 40,6 overall"); const hva = modelSolids(SERIES["te-hva280"], 2).filter((s) => /^p\d/.test(s.id)); near((hva[1].at[0] + hva[1].size[0] / 2) - (hva[0].at[0] + hva[0].size[0] / 2), 10.4, "HVA 280, poles 10,4 apart");
  const E = (id, n) => modelEnvelope(SERIES[id], n);
  assert.deepEqual([E("jst-ph", 4).W, E("jst-ph", 4).H], [4.5, 6]); assert.deepEqual([E("jst-xh", 4).W, E("jst-xh", 4).H], [5.75, 7]); assert.deepEqual([E("hirose-df13", 4).W, E("hirose-df13", 4).H], [3.4, 4.3]);
  assert.deepEqual([E("hirose-fh12", 10).W, E("hirose-fh12", 10).H], [5.6, 2]); assert.deepEqual([E("molex-minifit", 8).W, E("molex-minifit", 8).H], [9.6, 12.8]);
  const G = layout(SERIES["jst-ph"], 4); assert.deepEqual(G.xy(0, 0), [1.95, 1.7], "the first pin : 1,95 from the end, 1,7 from the side"); assert.deepEqual(G.xy(3, 0), [7.95, 1.7]);
  const M = layout(SERIES["molex-minifit"], 8); assert.deepEqual([M.cols, M.rows], [4, 2]); assert.deepEqual(M.xy(0, 0), [2.7, 1.85], "2,7 from the end, 1,85 from the latch side"); near(M.xy(0, 1)[1] - M.xy(0, 0)[1], 5.5, "rows"); assert.deepEqual([M.num(0, 0), M.num(3, 0), M.num(0, 1)], [1, 4, 5], "circuits numbered row after row");
  const tail = modelSolids(SERIES["jst-xh"], 3).filter((s) => /^p\d/.test(s.id)); assert.equal(tail.length, 3); assert.ok(tail.every((s) => s.at[2] === -3.4 && s.size[0] === 0.64), "a 0,64 square pin, 3,4 under the board");
});

test("no two series look alike : each has its own make-up, size and colour", () => {
  const sig = CONNECTORS.map((c) => { const S = SERIES[c.id], n = seriesPoles(S, defaultPoles(c)), solids = modelSolids(S, n), B = solidsBox(solids); return `${S.model}|${solids.length}|${B.L}×${B.W}×${B.H}|${S.color}`; });
  assert.equal(new Set(sig).size, CONNECTORS.length);
  for (const c of CONNECTORS) { const S = SERIES[c.id], n = seriesPoles(S, defaultPoles(c)), solids = modelSolids(S, n), E = modelEnvelope(S, n), B = solidsBox(solids);
    assert.ok(solids.length >= 3 && solids.every((s) => (s.shape === "box" ? s.size.every((v) => v > 0) : s.d > 0 && s.h > 0)), `${c.id} : no solid of no size`); assert.equal(new Set(solids.map((s) => s.id)).size, solids.length, `${c.id} : ids`);
    assert.ok(solids.some((s) => s.body) && solids.some((s) => s.color || s.tone), `${c.id} : contacts, colour`); assert.ok([E.L, E.W, E.H].every((v) => v > 0 && Number.isFinite(v)) && B.L >= E.L * 0.9, `${c.id} : envelope`);
    assert.equal(onBoard(S), !!S.pkg, `${c.id} : a series on a board has its land pattern`); }
  assert.equal(modelSolids(SERIES["hirose-df40"], 100).filter((s) => /^peigne/.test(s.id)).length, 2, "past 24 circuits, the leads of a fine pitch are one comb a side"); assert.deepEqual(modelSolids(null, 4), []);
});

test("a series is ready for a board : its land pattern, by name", () => {
  const ph = footprint("JST-PH-4"); assert.equal(ph.pads.length, 4); assert.deepEqual(ph.pads.map((p) => p.drill), [0.7, 0.7, 0.7, 0.7]); assert.deepEqual([ph.pads[0].shape, ph.pads[1].shape], ["rect", "round"]); near(ph.pads[1].x - ph.pads[0].x, 2.0, "pitch"); assert.deepEqual(ph.body, [9.9, 4.5, 6]);
  const mf = footprint("MINIFIT-8"), at = (n) => mf.pads.find((p) => p.n === String(n)); near(at(2).x - at(1).x, 4.2, "pitch"); near(at(5).y - at(1).y, 5.5, "rows"); near(at(5).x, at(1).x, "circuit 5 under circuit 1"); assert.equal(at(1).drill, 1.4); assert.equal(footprint("MINIFIT-7"), null, "two rows take an even number");
  const d9 = footprint("DSUB-9"); assert.equal(d9.pads.filter((p) => /^\d+$/.test(p.n)).length, 9); near(d9.pads.find((p) => p.n === "MP2").x - d9.pads.find((p) => p.n === "MP1").x, 24.99, "fixing holes"); assert.equal(footprint("DSUB-10"), null);
  const gh = footprint("JST-GH-4"); assert.ok(gh.pads.filter((p) => /^MP/.test(p.n)).length === 2 && gh.pads.every((p) => !p.drill), "a surface-mount header : leads and two solder tabs");
  assert.deepEqual(seriesPackage("MINIFIT-8"), { id: "molex-minifit", n: 8, S: SERIES["molex-minifit"] }); assert.equal(seriesPackage("SOIC-8"), null); assert.equal(footprint("NOPE-3"), null);
  assert.ok(Object.keys(SERIES_PACKAGES).every((p) => packageList().includes(`${p}-N`)));
  assert.ok(SERIES_PARTS.length >= 60); assert.equal(new Set(SERIES_PARTS.map((p) => p.id)).size, SERIES_PARTS.length);
  for (const p of SERIES_PARTS) { const f = footprint(p.package), L = LIBRARY[p.id]; assert.ok(f && L, p.id); assert.equal(L.pins.filter((x) => x.type !== "nc").length, +p.package.match(/(\d+)$/)[1], `${p.id} : a pin per circuit`); assert.ok(fam(p.series) && p.ratings.I === fam(p.series).a && DIMS_LEVELS[p.dims]);
    for (let i = 0; i < f.pads.length; i++) for (let j = i + 1; j < f.pads.length; j++) { const a = f.pads[i], b = f.pads[j], gx = Math.abs(a.x - b.x) - (a.w + b.w) / 2, gy = Math.abs(a.y - b.y) - (a.h + b.h) / 2; assert.ok(Math.max(gx, gy) > 0.1, `${p.id} : pads ${a.n} and ${b.n} too close (${Math.max(gx, gy).toFixed(3)})`); } }
});

test("the part of a connector is the model of its series, with what it is worth written on it", () => {
  const s = connectorPart(fam("jst-ph"), { id: "CN-1", poles: 6 });
  assert.deepEqual([s.library.shape, s.library.dims, s.library.pkg, s.library.poles], ["shroud", "read", "JST-PH-6", 6]); assert.equal(s.look.color, SERIES["jst-ph"].color); assert.deepEqual([s.params.L.expr, s.params.W.expr, s.params.H.expr], ["13.9", "4.5", "6"], "the envelope is the maker's : not a slider");
  assert.ok(s.features.filter((f) => f.op === "box" && typeof f.size[0] === "number").length >= 8); assert.match(s.notes.join(" "), /Modélisé d'après les cotes publiées de la série — Shrouded header, B\*B-PH-K-S .* — cotes lues\. Fiche JST/); assert.match(s.notes.join(" "), /Modèle 3D officiel : sur le site du fabricant \(https:\/\/www\.jst-mfg\.com\)/);
  assert.deepEqual(s.interfaces.map((i) => i.face), ["-Z", "+Z"], "a header sits on a board"); assert.deepEqual(connectorPart(fam("te-deutsch-dt"), { id: "CN-2" }).interfaces[0].params.fix, undefined, "a harness housing has no flange to screw"); assert.ok(connectorPart(fam("te-hvp800"), { id: "CN-3" }).interfaces[0].params.fix.screw);
  assert.equal(seriesPoles(SERIES["d-sub"], 10), 9); assert.equal(seriesPoles(SERIES["d-sub"], 30), 25); assert.equal(seriesPoles(SERIES["molex-microfit"], 3), 4); assert.equal(seriesPoles(SERIES["amass-xt60"], 5), 2); assert.equal(seriesPoles(SERIES["staubli-mc4"], 3), 1); assert.equal(seriesPoles(null, 3), 3);
  assert.deepEqual(connectorBuild(fam("d38999-power"), {}).solids.filter((x) => x.body).map((x) => x.body), ["pole1", "pole2"], "a potential per contact when the poles differ"); assert.equal(connectorBuild(fam("jst-ph"), { indicative: true }).S, null);
  const issue = (id, o) => partIssues(connectorPart(fam(id), { id: "CN-9", ...o })).filter((x) => /connecteur/.test(x.text));
  assert.deepEqual(issue("jst-ph"), []); assert.deepEqual(issue("molex-microfit").map((x) => x.level), ["warn"]); assert.match(issue("te-hvp800")[0].text, /saisie de mémoire, non relue sur la fiche/); assert.deepEqual(issue("jst-ph", { indicative: true }).map((x) => x.level), ["tip"]);
  const hv = connectorPart(fam("te-hvp800"), { id: "CN-9" }), notes = [...hv.notes]; useMakerModel(hv, "ISO-10303-21;\nEND-ISO-10303-21;\n", "hvp.stp"); assert.ok(!hv.notes.some((n) => /^Modélisé d'après/.test(n))); assert.deepEqual(partIssues(hv).filter((x) => /connecteur/.test(x.text)), [], "the maker's model settles it");
  dropMakerModel(hv); assert.deepEqual([...hv.notes].sort(), notes.sort(), "the notes of the series come back with its model");
});
