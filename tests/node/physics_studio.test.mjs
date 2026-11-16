// Tests of the studio of the hand calculations : the 3D scene of each model, the tiles (a colour and a pictogram per physics,
// a few words per model) and what the guide says about the inputs.
// Run from the repository root:  node --test tests/node/physics_studio.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODELS, DOMAINS, model, defaults, run, shortTitle, exampleKeys, inputIssues } from "../../web/js/analysis/physics/index.js";
import { sceneOf, sceneBox, boxMesh, cylMesh } from "../../web/js/analysis/physics/scene3d.js";

const finite = (a) => Array.from(a).every(Number.isFinite);

test("every model has a 3D scene : solids with sound meshes, marks that point somewhere, labels that say the numbers", () => {
  for (const m of MODELS) {
    const sc = sceneOf(m, defaults(m.id)), box = sceneBox(sc);
    assert.ok(sc.solids.length >= 1, `${m.id} : at least one solid`); assert.ok(sc.labels.length >= 1, `${m.id} : at least one label`);
    for (const s of sc.solids) { const { pos, nrm, idx, epos } = s.mesh;
      assert.ok(pos.length >= 9 && pos.length === nrm.length && idx.length % 3 === 0 && epos.length % 6 === 0, `${m.id}/${s.id} : shape of the mesh`);
      assert.ok(finite(pos) && finite(nrm) && finite(epos) && Math.max(...idx) < pos.length / 3, `${m.id}/${s.id} : finite, indices in range`); assert.ok(s.opacity > 0 && s.opacity <= 1); }
    for (const k of sc.marks) assert.ok(["arrow", "clamp", "gem"].includes(k.t) && finite(k.at) && finite(k.dir) && Math.hypot(...k.dir) > 0.99 && /^#[0-9a-f]{6}$/.test(k.color), `${m.id} : mark ${k.t}`);
    for (const l of sc.labels) assert.ok(finite(l.at) && l.text.length > 2 && !/NaN|undefined|null/.test(l.text), `${m.id} : label « ${l.text} »`);
    assert.ok(box && box.slice(0, 3).every((v, k) => box[k + 3] - v > 0), `${m.id} : a box with a volume`);
  }
  assert.deepEqual(sceneOf(null, {}), { solids: [], marks: [], labels: [] }); assert.equal(sceneBox({ solids: [] }), null);
});

test("the scene is drawn with the typed dimensions : a number out of proportion shows", () => {
  const span = (id, inputs, k) => { const b = sceneBox(sceneOf(model(id), { ...defaults(id), ...inputs })); return b[k + 3] - b[k]; };
  const beam = { section: "rect", b: 20, h: 10 };
  assert.ok(Math.abs(span("beam_cantilever_point", { ...beam, L: 400 }, 0) / span("beam_cantilever_point", { ...beam, L: 200 }, 0) - 2) < 0.05, "twice the span, twice as long");
  const sc = sceneOf(model("beam_cantilever_point"), { ...defaults("beam_cantilever_point"), ...beam, L: 250, F: 75 }), bar = sc.solids[0].mesh.pos, ext = (k) => { let lo = Infinity, hi = -Infinity; for (let i = k; i < bar.length; i += 3) { lo = Math.min(lo, bar[i]); hi = Math.max(hi, bar[i]); } return hi - lo; };
  assert.deepEqual([ext(0), ext(1), ext(2)], [250, 20, 10]); assert.ok(sc.labels.some((l) => l.text === "L = 250 mm") && sc.labels.some((l) => /F = 75 N/.test(l.text)));
  assert.equal(sceneOf(model("heatsink_natural"), { ...defaults("heatsink_natural"), N: 12 }).solids.length, 13, "a base and twelve fins");
  assert.equal(sceneOf(model("dowel_pin"), { ...defaults("dowel_pin"), np: 3, planes: "2" }).solids.length, 6, "three plates and three pins");
  assert.equal(sceneOf(model("beam_simple_udl"), defaults("beam_simple_udl")).marks.filter((k) => k.t === "arrow").length, 6); assert.equal(sceneOf(model("beam_simple_point"), defaults("beam_simple_point")).marks.filter((k) => k.t === "clamp").length, 2);
  assert.match(sceneOf(model("pipe_flow"), { ...defaults("pipe_flow"), d: 4, L: 5000 }).labels[0].text, /raccourci à l'écran/); assert.match(sceneOf(model("pcb_trace"), defaults("pcb_trace")).labels[0].text, /épaissi à l'écran/);
  for (const bad of [{ L: null }, { L: NaN }, { L: -5 }, {}]) assert.ok(finite(sceneOf(model("beam_cantilever_point"), bad).solids[0].mesh.pos), "a missing value never breaks the view");
  assert.equal(boxMesh([0, 0, 0], [2, 4, 6]).pos.length, 72); assert.equal(cylMesh([0, 0, 0], [0, 0, 5], 1, 12).idx.length, 12 * 12);
});

test("visual, symbol, colour : every physics has its colour and its pictogram, every model a few words and a diagram", () => {
  const src = readFileSync(new URL("../../web/js/modules/physics_sketch.js", import.meta.url), "utf8"), icons = /const DOMAIN_ICON = \{([\s\S]*?)\n\};/.exec(src)[1], sketches = /const SKETCH = \{([\s\S]*?)\n\};/.exec(src)[1];
  assert.equal(new Set(DOMAINS.map((d) => d.color)).size, DOMAINS.length, "one colour per physics");
  for (const d of DOMAINS) { assert.match(d.color, /^#[0-9a-f]{6}$/); assert.ok(d.hint.length > 5 && d.hint.length < 40, d.id); assert.ok(new RegExp(`\\n  ${d.id}: \\(\\) =>`).test("\n" + icons), `a pictogram for ${d.id}`); assert.ok(MODELS.some((m) => m.domain === d.id)); }
  for (const m of MODELS) { const s = shortTitle(m);
    assert.ok(s && s.length <= 32 && s !== m.title, `${m.id} : « ${s} »`); assert.ok(DOMAINS.some((d) => d.id === m.domain), m.id);
    assert.ok(new RegExp(`\\n  "?${m.sketch}"?: \\(\\) =>`).test("\n" + sketches), `a diagram for ${m.id} (${m.sketch})`); }
  assert.equal(new Set(MODELS.map(shortTitle)).size, MODELS.length, "no two tiles with the same words"); assert.equal(shortTitle(null), "");
});

test("the guide of a model : what is out of range, the examples still to enter, what was read on a part", () => {
  const m = model("beam_cantilever_point"), i = defaults(m.id), all = exampleKeys(m, i, []);
  assert.deepEqual(all, ["L", "b", "h", "F", "E", "Re", "rho", "dlim", "sf"], "every number shown of a fresh model is an example ; the hidden ones and the choices are not");
  assert.deepEqual(exampleKeys(m, { ...i, section: "tube" }, new Set(["L", "F"])), ["d", "t", "E", "Re", "rho", "dlim", "sf"]); assert.deepEqual(exampleKeys(m, i, all), []); assert.deepEqual(exampleKeys(null, {}, []), []);
  const fresh = inputIssues(m, i, run(m.id, i), { examples: all });
  assert.deepEqual(fresh.map((x) => [x.level, x.field]), [["todo", "L"]]); assert.match(fresh[0].text, /^9 valeurs d'exemple à entrer ou à confirmer : Portée L, Largeur b, /); assert.deepEqual(fresh[0].examples, all);
  const bad = inputIssues(m, { ...i, L: null, F: 1e12 }, null, { examples: all, read: ["E", "t"], part: "DRV-BASE" });
  assert.deepEqual(bad.map((x) => [x.level, x.field]), [["error", "L"], ["error", "F"], ["todo", "b"], ["warn", "E"]], "a value in error is not also counted as an example ; a hidden field read on the part is not named");
  assert.match(bad[0].text, /Portée L : entrez une valeur \(de 1 à 50000 mm\)/); assert.match(bad[1].text, /hors de ce que le modèle accepte/); assert.match(bad[3].text, /1 valeur reprise de la pièce DRV-BASE \(Module d'Young E\)/);
  assert.deepEqual(inputIssues(m, i, run(m.id, i), { examples: [] }), [], "all entered, all in range, within validity : nothing to say");
  const slender = run("column_buckling", defaults("column_buckling")), w = inputIssues(model("column_buckling"), defaults("column_buckling"), { warnings: ["hors domaine"] });
  assert.ok(Array.isArray(slender.warnings)); assert.deepEqual(w, [{ level: "warn", text: "Limite de validité — hors domaine" }]);
  assert.deepEqual(inputIssues(null).map((x) => x.level), ["tip"]);
});

test("a busbar carries its strip, its current and its finish into the heating model ; kept runs are named after their part", async () => {
  const { prefill, runName, runsByPart, runSheet } = await import("../../web/js/analysis/physics/index.js"), { blankBusbar, busbarPart } = await import("../../web/js/core/busbar.js");
  const def = { ...blankBusbar(), W: 25, t: 4, I: 180, finish: "none" }, spec = busbarPart(def, "BB-1"), pf = prefill("busbar", { spec, built: null });
  assert.deepEqual([pf.inputs.w, pf.inputs.t, pf.inputs.I, pf.inputs.eps], [25, 4, 180, 0.4], "the strip, the current, bare copper"); assert.equal(pf.inputs.L, def.legs.reduce((t, l) => t + l.L, 0), "the length along the middle fibre : the sum of the legs, not the envelope");
  assert.equal(pf.inputs.mat, "CU-C110", "its copper is its medium : the resistivity follows"); assert.equal(run("busbar", { ...defaults("busbar"), ...pf.inputs }).inputs.rho20, 17.24); assert.match(pf.notes.I, /busbar BB-1 : courant déclaré/); assert.match(pf.notes.eps, /cuivre nu — valeur typique/);
  assert.equal(prefill("busbar", { spec: busbarPart({ ...def, finish: "Sn" }, "BB-2"), built: null }).inputs.eps, 0.1); assert.equal(prefill("busbar", { spec: busbarPart({ ...def, insulation: { material: "PI-FILM", t: 0.1 } }, "BB-3"), built: null }).inputs.eps, 0.9, "a covered bar radiates like its cover");
  assert.equal(prefill("beam_cantilever_point", { spec, built: null }).inputs.I, undefined, "a model takes only what it asks for");
  /* several runs per part, each with its name ; the list is by part */
  const project = { parts: [spec, { id: "P-2", name: "Capot" }], physics: [] }, keep = (model, part, when) => { const r = run(model, defaults(model)), e = { id: `phy-${project.physics.length + 1}`, name: runName(project, model, part), model, part, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when }; project.physics.push(e); return e; };
  const a = keep("busbar", "BB-1", "2026-11-10T10:00:00Z"), b = keep("busbar", "BB-1", "2026-11-16T10:00:00Z"), c = keep("adiabatic_pulse", "BB-1", "2026-11-12T10:00:00Z"), d = keep("plate_pressure", "P-2", "2026-11-11T10:00:00Z"), e = keep("pipe_flow", null, "2026-11-09T10:00:00Z"), gone = keep("busbar", "GONE", "2026-11-08T10:00:00Z");
  assert.deepEqual([a.name, b.name, c.name, d.name, e.name], ["Busbar — Busbar", "Busbar — Busbar (2)", "Busbar — Impulsion de courant", "Capot — Plaque sous pression", "Sans pièce — Tube · perte de charge"]);
  assert.deepEqual(runsByPart(project).map((g) => [g.part, g.name, g.runs.map((r) => r.id)]), [["BB-1", "Busbar", [b.id, c.id, a.id]], ["P-2", "Capot", [d.id]], ["", "Sans pièce", [e.id, gone.id]]], "by part, in the order of the project, the latest first ; a run whose part is gone is kept, without a part");
  const sheet = runSheet(b, project); for (const re of [/^Busbar — Busbar \(2\)\n/, /Pièce : BB-1 — Busbar/, /Verdict : (OK|À VÉRIFIER|NON)/, /DONNÉES\n  Largeur w/, /RÉSULTATS\n  Température de la barre : /, /VÉRIFICATIONS\n/, /CALCUL\n  1\. /, /HYPOTHÈSES\n  - /, /Référence : Incropera/]) assert.match(sheet, re);
  assert.match(runSheet({ name: "X", model: "nope" }, project), /inconnu de cette version/); assert.deepEqual(runsByPart({}), []);
});
