/* PCBA: the function tree and the functional structure of a board, as editable draw.io pages and as a table. */
import test from "node:test";
import assert from "node:assert/strict";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { functionRows } from "../../web/js/pcba/synth.js";
import { functionalStructure, structureCsv, structureDiagram, treeDiagram } from "../../web/js/pcba/structure.js";
import { drawio } from "../../web/js/core/drawio.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";

test("functional structure : sub-systems, what enters and leaves, flows of energy and of information read from the nets", () => {
  const b = demoBoard(), S = functionalStructure(b, LIBRARY), id = (t) => b.blocks.find((x) => x.template === t).id, flow = (a, c, kind) => S.flows.find((f) => f.from === id(a) && f.to === id(c) && f.kind === kind);
  assert.equal(S.blocks.length, 12); assert.deepEqual(S.blocks.filter((x) => x.external).map((x) => x.id).sort(), [id("conn_io"), id("conn_board"), id("conn_swd")].sort());
  assert.ok(flow("buck", "ldo", "énergie").nets.includes("+5V"), "the step-down converter feeds the linear regulator"); assert.ok(flow("ldo", "mcu", "énergie").nets.includes("+3V3"));
  assert.ok(flow("mcu", "can", "information").nets.includes("CAN_TX")); assert.ok(flow("can", "mcu", "information").nets.includes("CAN_RX"), "each direction is its own flow"); assert.ok(flow("ntc", "mcu", "information"));
  assert.ok(flow("conn_io", "input_protection", "énergie"), "the supply enters by the connector"); assert.equal(S.blocks.find((x) => x.id === id("conn_io")).side, "in");
  assert.ok(S.flows.every((f) => f.from !== f.to && f.nets.length && !f.nets.includes("GND")), "grounds are not flows");
  const table = structureCsv(S).split("\r\n"); assert.equal(table[0].replace("﻿", ""), "De;Bloc;Vers;Bloc;Flux;Nets"); assert.equal(table.length - 2, S.flows.length);
});

test("draw.io : two editable pages, every arrow between two boxes that exist, labels safe for XML", () => {
  const b = demoBoard(); b.functions[0].name = "Alimenter <la logique> & \"le reste\""; const rows = functionRows(b, LIBRARY), tree = treeDiagram(rows, b.id, new Set([rows[1].id])), st = structureDiagram(functionalStructure(b, LIBRARY)), text = drawio([tree, st]);
  assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile')); assert.equal((text.match(/<diagram /g) || []).length, 2); assert.ok(text.includes('name="Arbre des fonctions"') && text.includes('name="Structure fonctionnelle"'));
  const cells = [...text.matchAll(/<mxCell id="([^"]+)"[^>]*?(?:vertex="1"|edge="1")[^>]*>/g)], ids = new Set(cells.map((m) => m[1])); assert.ok(ids.size >= rows.length + 12);
  for (const m of text.matchAll(/source="([^"]+)" target="([^"]+)"/g)) assert.ok(ids.has(m[1]) && ids.has(m[2]), `${m[1]} → ${m[2]}`);
  assert.ok(text.includes("Alimenter &amp;lt;la logique&amp;gt; &amp;amp; &quot;le reste&quot;"), "a label is HTML inside an XML attribute"); assert.ok(!/value="[^"]*<(?!\/?br)/.test(text.replace(/&lt;br&gt;/g, "")));
  assert.ok(text.includes("comment ?") && text.includes("pourquoi ?") && text.includes("quand ?")); assert.ok(text.includes(`${rows[1].id} · brouillon IA`)); assert.equal((text.match(/<mxCell/g) || []).length, (text.match(/<\/mxCell>|<mxCell id="[01]"[^>]*\/>/g) || []).length, "every cell is closed");
  // a parent stands in the middle of its children ; a solved function has its block to its right ; an unsolved one says so
  const kids = rows.filter((r) => r.parent === rows[0].id), n = (k) => tree.nodes.find((q) => q.id === k); if (kids.length > 1) assert.ok(Math.abs(n(rows[0].id).y - (n(kids[0].id).y + n(kids[kids.length - 1].id).y) / 2) < 1);
  const solved = rows.find((r) => r.block); assert.ok(n(`s_${solved.id}`).x > n(solved.id).x && n(`s_${solved.id}`).y === n(solved.id).y);
  b.functions.push({ id: "F50", parent: null, name: "Fonction sans solution", kind: "principale", criteria: [], block: null }); assert.ok(treeDiagram(functionRows(b, LIBRARY)).nodes.some((q) => q.id === "s_F50" && q.text === "sans solution"));
  assert.deepEqual(drawio([{ name: "vide", nodes: [], edges: [{ from: "a", to: "b" }] }]).match(/edge="1"/g), null, "an arrow to nowhere is left out");
});
