// Where am I : the project, then what the screen shows — read from the address and the project (core/where.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { whereOf } from "../../web/js/core/where.js";

const P = { name: "Rover", parts: [{ id: "P-1", name: "Plaque" }, { id: "P-2", name: "Cale" }], assemblies: [{ id: "A-1", name: "Châssis", instances: [{ part: "P-1" }] }], boards: [{ id: "B-1", name: "Carte" }], software: [{ id: "S", name: "BMS" }] };

test("the project, then the artefact the screen shows — nothing without a project or on the home page", () => {
  assert.equal(whereOf("parts", ["P-1"], null), null); assert.equal(whereOf("home", [], P), null);
  assert.deepEqual(whereOf("parts", ["P-1"], P), { project: "Rover", kind: "Pièce", icon: "part", name: "Plaque", id: "P-1" });
  assert.equal(whereOf("pcba", ["B-1"], P).kind, "Carte"); assert.equal(whereOf("sw", [], P).name, "BMS"); assert.equal(whereOf("swreq", [], { name: "X" }).name, "");
  assert.equal(whereOf("drawings", ["asm", "A-1"], P).kind, "Dessin d'assemblage"); assert.equal(whereOf("creepage", ["board", "B-1"], P).kind, "Isolation de la carte");
  assert.deepEqual(whereOf("review", [], P), { project: "Rover", kind: "", icon: "", name: "", id: "" }, "a screen about the whole project names the project only");
});

test("drawn once under the head of every left panel ; Physique and Simulation share a tile", () => {
  const app = readFileSync(new URL("../../web/js/core/app.js", import.meta.url), "utf8"), ui = readFileSync(new URL("../../web/js/core/where_ui.js", import.meta.url), "utf8");
  assert.match(app, /installWhere\(\);/); assert.match(ui, /side\.after\(el\("div", \{ class: "where-line"/); assert.match(ui, /!h\.closest\("\.side\.right, \.split\.right"\)/);
  assert.match(app, /tiles: \{ physics: \{ label: "Physique · Simulation"/);
});
