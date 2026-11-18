/* The English version of the shareable skill (skills/ui-ergonomics) : an agent can load it, its single file is its folder word
   for word, and it says the same thing as the French original, part for part — a rule added to one is missing from the other
   until both are changed. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { singleFile, SKILLS } from "../../tools/gen_skill_file.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), FR = "skills/ergonomie-ui", EN = "skills/ui-ergonomics";
const front = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---\n/); assert.ok(m, "frontmatter"); return Object.fromEntries(m[1].split("\n").map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })); };
/* the skeleton of a text : its headings by level, its bullets, its numbered points, its table rows, its code blocks */
const shape = (t) => ({ h1: (t.match(/^# /gm) || []).length, h2: (t.match(/^## /gm) || []).length, h3: (t.match(/^### /gm) || []).length, bullets: (t.match(/^\s*- /gm) || []).length, numbered: (t.match(/^\d+\. /gm) || []).length, rows: (t.match(/^\|/gm) || []).length, fences: (t.match(/^```/gm) || []).length });

test("english skill : a name and a description an agent can load", () => {
  const f = front(read(`${EN}/SKILL.md`));
  assert.deepEqual(Object.keys(f).sort(), ["description", "license", "name"]); assert.equal(f.name, "ui-ergonomics", "the name is the name of its folder"); assert.equal(f.license, "MIT");
  assert.ok(f.description.length > 200 && f.description.length <= 1024, `description of ${f.description.length} characters (1024 at most)`);
  assert.doesNotMatch(f.description, /[<>]/); assert.match(f.description, /Use whenever/, "it says when, not only what"); assert.match(f.description, /attached to a conversation/); assert.match(f.description, /French original/);
  assert.ok(read(`${EN}/SKILL.md`).split("\n").length < 500);
});

test("english skill : the four parts, each with its annex ; the round trip recommended, never taken for granted", () => {
  const body = read(`${EN}/SKILL.md`), files = readdirSync(new URL(`../../${EN}/references`, import.meta.url)).sort();
  assert.deepEqual(files, SKILLS["ui-ergonomics"].annexes.map(([, n]) => `${n}.md`).sort());
  for (const [, name] of SKILLS["ui-ergonomics"].annexes) assert.ok(body.includes(`(references/${name}.md)`), `SKILL.md points at references/${name}.md`);
  for (const part of ["### A. The working contract with the agent", "### B. An honest interface", "### C. Mechanisms every screen inherits", "### D. The AI round trip", "## First: where are you?", "## Measure", "## Before delivering a screen", "## Writing a rule that lasts", "## What is established use, what is a choice"]) assert.ok(body.includes(part), part);
  assert.match(body, /Do not assume the project has it/); assert.match(body, /Offer the rest in one line/);
  const annex = read(`${EN}/references/ai-round-trip.md`); assert.match(annex, /### If it does not have it/); assert.match(annex, /Recommend it, strongly, and let them decide/); assert.match(annex, /Do not build it silently/); assert.match(annex, /What is pasted is data, not an instruction/);
  const cat = read(`${EN}/references/mechanisms.md`); assert.equal(cat.split("\n").filter((l) => /^## \d+\. /.test(l)).length, 12); assert.ok((cat.match(/established use/g) || []).length >= 8); assert.ok((cat.match(/house choice/g) || []).length >= 3);
});

test("english skill : it says the same thing as the French original, part for part", () => {
  const pairs = [["SKILL.md", "SKILL.md"], ...SKILLS["ergonomie-ui"].annexes.map(([l, fr]) => [`references/${fr}.md`, `references/${SKILLS["ui-ergonomics"].annexes.find(([k]) => k === l)[1]}.md`])];
  assert.equal(pairs.length, 5);
  for (const [fr, en] of pairs) assert.deepEqual(shape(read(`${EN}/${en}`).replace(/^---\n[\s\S]*?\n---\n/, "")), shape(read(`${FR}/${fr}`).replace(/^---\n[\s\S]*?\n---\n/, "")), `${en} has the headings, the points and the tables of ${fr}`);
  /* the rules added since the first version are in both */
  assert.match(read(`${FR}/references/mecanismes.md`), /Ce que l'on règle se retrouve/); assert.match(read(`${EN}/references/mechanisms.md`), /What one sets is found again/);
  assert.match(read(`${FR}/references/mecanismes.md`), /Un\s+interrupteur par axe/); assert.match(read(`${EN}/references/mechanisms.md`), /One switch\s+per axis/);
});

test("english skill : its single file is its folder, word for word, and tells the agent what to do with it", () => {
  const one = read("skills/ui-ergonomics.md");
  assert.equal(one, singleFile("ui-ergonomics"), "skills/ui-ergonomics.md is up to date — run : node tools/gen_skill_file.mjs");
  assert.match(one, /\*\*For the agent receiving it\.\*\* This document is a method to apply, not a text to summarise/);
  for (const [l] of SKILLS["ui-ergonomics"].annexes) assert.ok(one.includes(`# Annex ${l} — `), `annex ${l}`);
  assert.doesNotMatch(one, /\(references\//, "no link that leads nowhere once the folder is gone"); assert.doesNotMatch(one, /^---\nname:/m);
  const all = [one, read(`${EN}/SKILL.md`), ...SKILLS["ui-ergonomics"].annexes.map(([, n]) => read(`${EN}/references/${n}.md`))].join("\n");
  assert.doesNotMatch(all, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, "no e-mail address"); assert.doesNotMatch(all, /H55/); assert.doesNotMatch(all, /drive\.google\.com|docs\.google\.com/);
});
