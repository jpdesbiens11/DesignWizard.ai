/* Point 6 (JP, 20 novembre 2026) : the Labo with several boards — the table and the schema of the links ; a cable is changed there and the
   tool refuses the incompatible ; two boards whose interfaces match are linked at once.
     node --test tests/node/lab_table.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { portsOf, linkCheck, autoLinks, putBoard, takeBoard, addLink, removeLink, setLinkOn, tableOf, tableLinks, tableIssues, benchFeeds, portOf, PORT_KINDS } from "../../web/js/pcba/lab_table.js";
import { rs485Board } from "../../web/js/demo/demo_rs485.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const project = () => ({ dw: "project/1", id: "t", name: "T", parts: [], assemblies: [], boards: [rs485Board(), { ...rs485Board(), id: "NODE-485-B" }, demoBoard()] });

test("the ports of a board : the pins of its connectors, each with its net, its kind and its voltage ; a programming header is said", () => {
  const P = portsOf(rs485Board()), a = P.find((p) => p.net === "RS485_A"), sw = P.find((p) => p.net === "SWDIO");
  assert.equal(a.kind, "signal"); assert.equal(P.find((p) => p.net === "+5V").kind, "power"); assert.equal(P.find((p) => p.net === "+5V").volts, 5); assert.equal(P.find((p) => p.pin === "J1.2").kind, "ground");
  assert.equal(sw.debug, true); assert.ok(P.every((p) => PORT_KINDS[p.kind]));
});

test("the tool refuses the incompatible, and says why", () => {
  const P = project(), p = (k) => portOf(P, k);
  assert.equal(linkCheck(p("NODE-485-PCBA:J2.1"), p("NODE-485-B:J2.1")).ok, true, "A on A");
  assert.match(linkCheck(p("NODE-485-PCBA:J2.1"), p("NODE-485-B:J2.2")).why, /croisés/);
  assert.match(linkCheck(p("DRV-CTRL-PCBA:J1.1"), p("NODE-485-B:J1.1")).why, /deux tensions différentes/);
  assert.match(linkCheck(p("NODE-485-PCBA:J1.2"), p("NODE-485-B:J1.1")).why, /masse ne se relie qu'à une masse/);
  assert.match(linkCheck(p("NODE-485-PCBA:J1.1"), p("NODE-485-B:J2.1")).why, /alimentation sur un signal/);
  assert.match(linkCheck(p("NODE-485-PCBA:J2.1"), p("DRV-CTRL-PCBA:J1.3")).why, /deux liaisons différentes/);
  assert.match(linkCheck(p("NODE-485-PCBA:J3.2"), p("NODE-485-B:J3.2")).why, /connecteur de programmation/);
  assert.match(linkCheck(p("NODE-485-PCBA:J2.1"), p("NODE-485-PCBA:J1.1")).why, /même carte/);
});

test("two boards whose connectors carry the same nets are linked at once — one ground, never the programming header", () => {
  const L = autoLinks(rs485Board(), { ...rs485Board(), id: "NODE-485-B" }).map((l) => `${l.a}>${l.b}`);
  assert.deepEqual(L.sort(), ["NODE-485-PCBA:J1.1>NODE-485-B:J1.1", "NODE-485-PCBA:J1.2>NODE-485-B:J1.2", "NODE-485-PCBA:J2.1>NODE-485-B:J2.1", "NODE-485-PCBA:J2.2>NODE-485-B:J2.2"].sort());
  const P = project(); assert.deepEqual(putBoard(P, "NODE-485-PCBA"), []); assert.equal(putBoard(P, "NODE-485-B").length, 4); assert.equal(putBoard(P, "DRV-CTRL-PCBA").length, 4, "the control board feeds 5 V to both nodes");
  assert.deepEqual(putBoard(P, "DRV-CTRL-PCBA"), [], "a board is on the table once");
  assert.ok(tableLinks(P).every((l) => l.ok)); assert.deepEqual(tableIssues(P), []);
  assert.deepEqual(benchFeeds(P).map((f) => `${f.board} ${f.port.net} ${f.volts}`), ["DRV-CTRL-PCBA +24V_IN 24"], "the lab supply feeds what no board feeds");
});

test("a cable laid by hand, set at Off, taken away ; a board taken off goes with its cables ; the table travels in a .dwiz", () => {
  const P = project(); putBoard(P, "NODE-485-PCBA"); putBoard(P, "DRV-CTRL-PCBA");
  const r = addLink(P, "NODE-485-PCBA:J2.1", "DRV-CTRL-PCBA:J2.3"); assert.equal(r.ok, false);
  assert.equal(addLink(P, "NODE-485-PCBA:J1.1", "DRV-CTRL-PCBA:J2.1").ok, false, "already laid at once");
  const n = tableOf(P).links.length; setLinkOn(P, "C1", false); assert.equal(tableOf(P).links.find((l) => l.id === "C1").on, false); removeLink(P, "C1"); assert.equal(tableOf(P).links.length, n - 1);
  assert.deepEqual(JSON.parse(JSON.stringify(tableOf(fromDwiz(toDwiz(P))))), JSON.parse(JSON.stringify(tableOf(P))));
  takeBoard(P, "DRV-CTRL-PCBA"); assert.deepEqual(tableOf(P).boards, ["NODE-485-PCBA"]); assert.equal(tableOf(P).links.length, 0);
  const lone = project(); putBoard(lone, "NODE-485-PCBA"); putBoard(lone, "DRV-CTRL-PCBA"); removeLink(lone, "C1"); removeLink(lone, "C2"); assert.match(tableIssues(lone).map((x) => x.text).join(" "), /sans aucun câble/);
});

test("wired : the Labo opens the table ; both views ; a cable checked before it is laid", () => {
  const scr = read("web/js/modules/elab_table.js"); assert.match(scr, /linkCheck\(portOf\(P\(\), a\), portOf\(P\(\), key\)\)/); assert.match(scr, /Montage verrouillé/); assert.match(scr, /if \(!st\.open\)/, "locked, a pin says what it carries and nothing changes"); assert.doesNotMatch(scr, /svg\("g", \{[^}]*onClick/, "svg() writes attributes : events are taken on the view"); assert.match(scr, /"schema", "Schéma des liaisons"/); assert.match(scr, /benchFeeds\(P\(\)\)/); assert.match(scr, /Câblage, pas simulation/);
  assert.match(read("web/js/modules/elab.js"), /tableScreen\(main\)/);
});
