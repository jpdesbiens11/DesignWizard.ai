/* The register of sources : every line says what it covers, what the tool takes from it and how it was checked — and never
   claims more than what the repository states elsewhere. */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { METHODS, METHOD_GROUPS, METHOD_HOW, METHOD_KINDS, methodsByGroup, methodCounts, methodById, methodProblems } from "../../web/js/core/methods.js";
import { TRL_SOURCES } from "../../web/js/core/trl.js";

test("the register is whole : every line has its group, its nature, its level of checking and its three texts", () => {
  assert.deepEqual(methodProblems(), []);
  assert.ok(METHODS.length >= 50); assert.equal(new Set(METHODS.map((m) => m.id)).size, METHODS.length);
  assert.equal(methodsByGroup().reduce((n, g) => n + g.methods.length, 0), METHODS.length); assert.ok(methodsByGroup().every((g) => g.methods.length >= 5 && g.color && g.icon));
  assert.equal(Object.values(methodCounts()).reduce((a, b) => a + b, 0), METHODS.length);
  assert.equal(new Set(METHOD_GROUPS.map((g) => g.color)).size, METHOD_GROUPS.length); assert.ok(Object.values(METHOD_KINDS).every((k) => k.icon && k.label));
  assert.ok(Object.values(METHOD_HOW).every((h) => h.label && h.text && ["ok", "info", "warn", "neutral"].includes(h.tone)));
});

test("the tools and the documents a line points at exist", () => {
  const keys = new Set(["creepage", "drawings", "physics", "fea", "dfx", "shop", "interfaces", "assembly", "pcba", "flex", "library", "busbar", "mvp", "plm", "parts", "report", "onshape", "review", "labels", "render"]);
  for (const m of METHODS) { if (m.where) assert.ok(keys.has(m.where.slice(2).split("/")[0]), `${m.id} → ${m.where}`); if (m.doc) assert.ok(existsSync(new URL(`../../${m.doc}`, import.meta.url)), `${m.id} → ${m.doc}`); }
  for (const k of keys) assert.ok(existsSync(new URL(`../../web/js/modules/${k}.js`, import.meta.url)), `module ${k}`);
});

test("what the page says of a standard is what the code says of it", () => {
  // the insulation tables were typed, not checked against the standard : the register may not say more
  const iec = methodById("iec-60664-1"); assert.equal(iec.how, "typed"); assert.match(iec.check, /À vérifier contre votre copie de la norme/);
  assert.match(readFileSync(new URL("../../web/js/analysis/cc_rules.js", import.meta.url), "utf8"), /STATUS « to verify »/);
  // GD&T : applied from practice, the hexagonal flag is the platform's own marking
  const gdt = methodById("asme-y14-5"); assert.equal(gdt.how, "typed"); assert.match(gdt.check, /choix de la plateforme/);
  assert.match(readFileSync(new URL("../../web/js/draw/part_drawing.js", import.meta.url), "utf8"), /repère propre à ce dessin, pas un symbole de la norme/);
  // folded sheet metal : summaries only
  assert.equal(methodById("dfx-sheet").how, "excerpt"); assert.match(readFileSync(new URL("../../docs/TOLERIE.md", import.meta.url), "utf8"), /aucun guide n'a été lu en entier/);
  // a standard nobody read is never marked « lu » : the only lines marked read are the ones a document was opened for
  assert.deepEqual(METHODS.filter((m) => m.how === "read").map((m) => m.id).sort(), ["connector-series", "laser-guides", "onshape", "trl"]);
  assert.ok(TRL_SOURCES.filter((s) => s.read).length >= 3); assert.match(methodById("trl").check, /ISO 16290 n'a pas été lue/);
  // the glue well is a workshop rule, said so
  assert.equal(methodById("glue-well").how, "own"); assert.equal(methodById("nothing"), null);
});

test("no rule of the DFx book is left without a source", async () => {
  const { RULEBOOK } = await import("../../web/js/analysis/dfx_rules.js"), { BOOK_ASSEMBLY } = await import("../../web/js/analysis/dfa_rules.js");
  const rules = [...RULEBOOK, ...BOOK_ASSEMBLY].flatMap((g) => g.rules || []);
  assert.ok(rules.length >= 130); assert.deepEqual(rules.filter((r) => !String(r.source || "").trim()).map((r) => r.id), []);
});
