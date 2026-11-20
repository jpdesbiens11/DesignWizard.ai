// The words of a battery system : each term names a published document and how it was read ; a house word is an alias, never
// a term ; nothing is said that was not read.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BATTERY_TERMS, BATTERY_SOURCES, BATTERY_READ, BATTERY_GROUPS, HOUSE_WORDS, BATTERY_BUSES, batteryGlossary, batteryTerm } from "../../web/js/core/battery_terms.js";
import { glossary } from "../../web/js/core/terms.js";
import { METHODS } from "../../web/js/core/methods.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("every term of a battery system stands on a published document, with its clause and its level of reading", () => {
  assert.deepEqual(Object.keys(BATTERY_TERMS), ["cell", "cellBlock", "module", "pack", "cellElectronics", "bms", "ess", "propulsion", "system", "contactor", "autoDisconnect", "reess"]);
  for (const [k, t] of Object.entries(BATTERY_TERMS)) { assert.ok(t.label && t.fr && t.text.length > 30 && BATTERY_GROUPS.some((g) => g.id === t.group), k); assert.ok(t.src.length >= 1, `${k} names a document`); for (const [s, where] of t.src) { assert.ok(BATTERY_SOURCES[s], `${k} → ${s}`); assert.ok(where.length >= 3, `${k} says where`); } }
  for (const [k, s] of Object.entries(BATTERY_SOURCES)) { assert.ok(BATTERY_READ[s.read], k); if (s.read !== "unread") assert.match(s.url, /^https:\/\//, `${k} : a document that was read says which page`); }
  assert.equal(BATTERY_SOURCES.do311.read, "unread", "DO-311A was not read, and says so"); assert.equal(BATTERY_SOURCES.iso12405.read, "preview"); assert.equal(BATTERY_SOURCES.air6897.read, "abstract");
  /* no term stands on a preview alone : each has at least one document that was opened and read */
  for (const [k, t] of Object.entries(BATTERY_TERMS)) { const levels = t.src.map(([s]) => BATTERY_SOURCES[s].read); assert.ok(levels.includes("read"), `${k} : at least one document was read (${levels.join(", ")})`); }
  assert.equal(batteryTerm("cellElectronics"), "Cell electronics — électronique de cellules (carte de mesure d'un module)"); assert.equal(batteryGlossary().length, 12); assert.ok(batteryGlossary().every((t) => t.sources.every((s) => s.name && s.where)));
});

test("a word of a house is an alias : what was found is said, and the tool writes the published term", () => {
  const w = Object.fromEntries(HOUSE_WORDS.map((x) => [x.word, x]));
  assert.equal(w.CMB.use, "cellElectronics"); assert.match(w.CMB.found, /Aucune norme ne le définit/); assert.equal(w.BM.use, "module"); assert.equal(w.EESS.use, "ess");
  assert.match(w.BMU.found, /battery monitoring unit/); assert.match(w.BMU.found, /toutes lettres/); assert.match(w.BCU.found, /battery charger unit/);
  assert.equal(w.EFC.use, ""); assert.match(w.EFC.found, /Rien d'établi/); assert.match(w.EFC.found, /par sa fonction/);
  for (const x of HOUSE_WORDS) assert.ok(x.use === "" || BATTERY_TERMS[x.use], x.word);
  const g = glossary(), en = (s) => g.find((r) => r.en === s);
  assert.equal(en("Cell electronics").fr, "électronique de cellules (carte de mesure d'un module)"); assert.match(en("CMB").fr, /mot de maison : écrire « Cell electronics »/); assert.match(en("EFC").fr, /rien d'établi/);
  /* the platform itself no longer writes the house word, except to say it is one */
  const hw = read("web/js/sw/bms_hw.js"); assert.ok(!/\bCMB\b/.test(hw), "the battery hardware model writes « cell electronics »"); assert.match(hw, /cell electronics \(ISO 12405-4/);
});

test("what is said about buses is what public documents say — and no more", () => {
  const all = BATTERY_BUSES.join(" "); assert.match(all, /ne nomment aucun bus/); assert.match(all, /ARINC 429/); assert.match(all, /MIL-PRF-29595A/); assert.match(all, /Rien de ce qui a été lu ne permet d'écrire que le RS-485 est le choix courant/); assert.match(all, /DO-311A et le texte de SAE AIR6897 n'ont pas été lus/);
  const m = Object.fromEntries(METHODS.filter((x) => /^(battery-terms|do-311a)/.test(x.id)).map((x) => [x.id, x.how])); assert.deepEqual(m, { "battery-terms-public": "read", "battery-terms-norms": "excerpt", "do-311a": "unread" });
  const src = read("web/js/core/battery_terms.js"); assert.match(src, /no text of a standard is copied/); assert.match(src, /No company's vocabulary is described here/);
  assert.match(read("web/js/modules/help.js"), /batteryCard\(args\[0\] === "batteries"\)/); assert.match(read("web/js/modules/battery_view.js"), /"data-battery-group": g\.id/);
});
