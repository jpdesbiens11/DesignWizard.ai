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

import { towerOf, usedPath } from "../../web/js/core/tower.js";
const T = { name: "Prod", parts: [{ id: "P", name: "Plaque", process: "laser" }, { id: "Q", name: "Cale" }],
  assemblies: [{ id: "TOP", name: "Tête", instances: [{ id: "i1", asm: "SUB" }, { id: "i2", part: "Q" }] }, { id: "SUB", name: "Bloc", instances: [{ id: "s1", part: "P" }] }],
  boards: [{ id: "B", name: "Carte", part: "Q" }] };

test("the launch tower : the project at the foot, the assemblies that hold the artefact, the artefact, the screen at the top", () => {
  assert.deepEqual(usedPath(T, { part: "P" }).map((a) => a.id), ["TOP", "SUB"], "from the top assembly down to the one that holds the part");
  assert.deepEqual(usedPath(T, { asm: "SUB" }).map((a) => a.id), ["TOP"]); assert.equal(usedPath(T, { asm: "TOP" }), null);
  const f = towerOf("drawings", ["P"], T, { screen: "Dessins", hash: "#/drawings/P", issues: [{ ref: "P", level: "warn" }, { ref: "P", level: "tip" }] });
  assert.deepEqual(f.map((x) => x.kind), ["Projet", "Assemblage", "Sous-assemblage", "Pièce", "Écran"]); assert.ok(f[0].pad && f[4].here && !f[3].here);
  assert.equal(f[3].light, "warn"); assert.equal(f[3].count, 1); assert.equal(f[1].hash, "#/assembly/TOP");
  const own = towerOf("assembly", ["SUB"], T, { screen: "Assemblage" }); assert.deepEqual(own.map((x) => x.label), ["Prod", "Tête", "Bloc"], "its own studio adds no screen floor"); assert.ok(own[2].here);
  assert.deepEqual(towerOf("elab", ["B"], T, { screen: "Labo" }).map((x) => x.kind), ["Projet", "Assemblage", "Carte (PCB)", "Carte (PCBA)", "Écran"], "a board stands on its twin part");
  assert.equal(towerOf("home", [], T), null); assert.equal(towerOf("parts", ["P"], null), null);
  const ui = readFileSync(new URL("../../web/js/core/where_ui.js", import.meta.url), "utf8"); assert.match(ui, /const KEY = "dw\.tower"/); assert.match(ui, /"aria-expanded": open \? "true" : "false"/);
});
