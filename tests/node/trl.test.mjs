/* The readiness scale : the official wording is quoted as read, every level has its two examples, and the references say
   what was read and what was not. */
import test from "node:test";
import assert from "node:assert/strict";
import { TRL_LEVELS, TRL_GROUPS, TRL_SOURCES, TRL_EXAMPLES, trlLevel, trlGroup, trlFocus, trlText, trlProblems } from "../../web/js/core/trl.js";
import { TRL } from "../../web/js/core/mvp.js";

test("the scale is whole : nine levels, each with its official definitions, what to show and two examples", () => {
  assert.deepEqual(trlProblems(), []);
  assert.deepEqual(Object.keys(TRL_LEVELS).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const t of Object.values(TRL_LEVELS)) { assert.notEqual(t.auto, t.aero); assert.ok(t.auto.length > 60 && t.aero.length > 60, `TRL ${t.n} : the examples say something`); assert.ok(/[.»]$/.test(t.fr)); }
  assert.deepEqual(TRL_GROUPS.flatMap((g) => g.levels), [1, 2, 3, 4, 5, 6, 7, 8, 9]); assert.equal(new Set(TRL_GROUPS.map((g) => g.color)).size, 3);
  assert.equal(trlGroup(5).id, "validate"); assert.equal(trlGroup(12), null); assert.equal(trlLevel("7").n, 7); assert.equal(trlLevel(0), null);
  assert.ok(TRL_EXAMPLES.auto.subject && TRL_EXAMPLES.aero.subject);
});

test("the wording is the one of the publishers, as read", () => {
  assert.equal(TRL_LEVELS[1].nasa, "Basic principles observed and reported.");
  assert.equal(TRL_LEVELS[4].nasa, "Component and/or breadboard validation in laboratory environment.");
  assert.equal(TRL_LEVELS[7].nasa, "System prototype demonstration in an operational environment.");
  assert.equal(TRL_LEVELS[9].nasa, "Actual system flight proven through successful mission operations.");
  assert.equal(TRL_LEVELS[3].ec, "experimental proof of concept"); assert.equal(TRL_LEVELS[8].ec, "system complete and qualified");
  assert.match(TRL_LEVELS[5].ec, /^technology validated in relevant environment/); assert.match(TRL_LEVELS[6].ec, /^technology demonstrated in relevant environment/);
  // where the sources disagree, the page says so instead of choosing in silence
  assert.match(TRL_LEVELS[6].nasa, /operational environment/); assert.match(TRL_LEVELS[6].hw, /operated in a relevant environment/); assert.match(TRL_LEVELS[6].caution, /ne disent pas la même chose/);
  assert.deepEqual(Object.values(TRL_LEVELS).filter((t) => t.caution).map((t) => t.n), [6]);
  // the manufacturing level the automotive guide pairs with each level
  assert.deepEqual(Object.values(TRL_LEVELS).map((t) => t.mrl || 0), [0, 0, 1, 2, 3, 4, 5, 6, 7]);
});

test("the labels of the iterations are the short form of the official definitions", () => {
  for (let n = 1; n <= 9; n++) assert.equal(TRL[n][0], TRL_LEVELS[n].short);
  assert.equal(TRL[6][0], "Prototype du système démontré en environnement représentatif"); assert.ok(TRL[6][1].length >= 1);
});

test("a page opens on the level the project is working on", () => {
  assert.equal(trlFocus({ live: 4, reached: 3, target: 6 }), 4); assert.equal(trlFocus({ reached: 3, target: 6 }), 4); assert.equal(trlFocus({ reached: 9, target: 9 }), 9); assert.equal(trlFocus(), 1);
});

test("a review reads the official wording : the text of a level carries both definitions and the proof to show", () => {
  const t = trlText(5);
  assert.equal(t[0], "TRL 5 — Composant ou maquette validé en environnement représentatif");
  assert.ok(t.some((x) => x.includes("« Component and/or breadboard validation in relevant environment. »")) && t.some((x) => x.includes("Commission européenne")) && t.some((x) => /^Preuve attendue/.test(x)) && t.some((x) => /^À ne pas confondre/.test(x)));
  assert.ok(trlText(6).some((x) => /^Attention/.test(x))); assert.deepEqual(trlText(11), []);
});

test("the references say what was read and what was not", () => {
  const read = TRL_SOURCES.filter((s) => s.read), not = TRL_SOURCES.filter((s) => !s.read);
  assert.deepEqual(read.map((s) => s.id), ["nasa", "ec", "auto", "nasa-web"]); assert.ok(read.every((s) => /^https:\/\//.test(s.url) && /2026-11-16/.test(s.how)));
  assert.deepEqual(not.map((s) => s.id), ["iso", "mankins", "npr", "gao"]); assert.ok(not.every((s) => /^non lu/.test(s.how) && !s.url));
});
