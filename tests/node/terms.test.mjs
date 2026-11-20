/* The technical terms : every vocabulary table names its entries in English — what the screens show — and keeps the French
   equivalent for the glossary. No screen reads the French name of such a table any more. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { TERM_TABLES, TERM_GROUPS, glossary, glossaryByGroup } from "../../web/js/core/terms.js";
import { processName } from "../../web/js/cad/materials.js";
import { FEATURE_LABEL } from "../../web/js/core/part_edit.js";
import { MOLDS, GATES } from "../../web/js/core/mold_plan.js";

const FRENCH = /[éèêëàâçùûîïôœ]/i, files = (dir) => readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") ? [p] : []; });

test("every vocabulary table names its entries in English and keeps the French word", () => {
  assert.deepEqual(Object.keys(TERM_TABLES), ["SW_KINDS", "BATTERY_TERMS", "MODEL_WORDS", "PROCESSES", "INTERFACE_TYPES", "ADHESIVES", "WELD_PROCESSES", "PLATINGS", "CONTACT_FORMS", "CONTACT_BASES", "STOCK_FORMS", "SHOP_VERBS", "AM_PROCESSES", "LASER_FAMILIES", "ENDS", "INSULATIONS", "LABEL_KINDS", "FINISHES"]);
  let n = 0;
  for (const [name, table] of Object.entries(TERM_TABLES)) for (const [k, v] of Object.entries(table)) { n++; assert.ok(typeof v.label === "string" && v.label.length > 1, `${name}.${k} has an English term`); assert.ok(typeof v.fr === "string" && v.fr.length > 1, `${name}.${k} keeps its French word`); assert.ok(!FRENCH.test(v.label), `${name}.${k} : « ${v.label} » is English`); }
  assert.ok(n >= 110, `${n} terms in the tables`);
  for (const [k, v] of Object.entries(FEATURE_LABEL)) assert.ok(v && !FRENCH.test(v), `feature ${k} : « ${v} »`); assert.deepEqual([FEATURE_LABEL.hole, FEATURE_LABEL.pocket, FEATURE_LABEL.fillet, FEATURE_LABEL.drill, FEATURE_LABEL.cbore], ["Hole", "Pocket", "Fillet", "Drill", "Counterbore"]);
  for (const M of Object.values(MOLDS)) assert.ok(!FRENCH.test(M.label) && !FRENCH.test(M.tool)); for (const G of Object.values(GATES)) assert.ok(!FRENCH.test(G.label));
  // the examples the owner of the project gave
  assert.equal(processName("die_casting"), "High pressure die casting (HPDC)"); assert.equal(processName("lp_die_casting"), "Low pressure die casting (LPDC)"); assert.equal(processName("sand_casting"), "Sand casting"); assert.equal(processName("permanent_mold"), "Permanent mold casting");
});

test("the glossary gives every term its French equivalent, by nature, and finds a word in either language", () => {
  const g = glossary(), ids = TERM_GROUPS.map((x) => x.id);
  assert.ok(g.length >= 170, `${g.length} terms`); assert.deepEqual(ids, ["process", "mold", "operation", "stock", "interface", "electrical", "finish", "analysis", "rules"]); assert.ok(TERM_GROUPS.every((x) => x.label && x.hint && x.icon && /^#[0-9a-f]{6}$/.test(x.color)));
  for (const r of g) { assert.ok(ids.includes(r.group) && r.en && r.fr, JSON.stringify(r)); assert.ok(!FRENCH.test(r.en.replace(/Lamé/g, "Lame")), `« ${r.en} » is the English side`); }      // a proper name keeps its accent
  assert.equal(new Set(g.map((r) => `${r.group}|${r.en.toLowerCase()}`)).size, g.length, "a term is listed once in its group"); assert.deepEqual(g.map((r) => r.group), [...g.map((r) => r.group)].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)), "in the order of the groups");
  const fr = (en) => (g.find((r) => r.en === en) || {}).fr;
  assert.equal(fr("High pressure die casting (HPDC)"), "Fonderie sous pression (haute pression)"); assert.equal(fr("Sand casting"), "Moulage au sable"); assert.equal(fr("Permanent mold casting"), "Moulage en coquille par gravité (moule permanent)"); assert.match(fr("Low pressure die casting (LPDC)"), /basse pression/);
  assert.equal(fr("Riser"), "masselotte"); assert.equal(fr("Slide"), "tiroir"); assert.equal(fr("Draft"), "dépouille"); assert.match(fr("Parting line"), /plan de joint/); assert.match(fr("Gate"), /seuil d'injection/); assert.equal(fr("Bolt pattern"), "Motif de vis"); assert.equal(fr("Counterbore"), "Lamer"); assert.equal(fr("Laser welding"), "Soudure laser");
  assert.deepEqual(glossaryByGroup("tiroir").flatMap((x) => x.terms.map((t) => t.en)), ["Slide"]); assert.ok(glossaryByGroup("riser").flatMap((x) => x.terms).length >= 3); assert.deepEqual(glossaryByGroup("zzz"), []); assert.equal(glossaryByGroup().reduce((s, x) => s + x.terms.length, 0), g.length);
});

test("no screen reads the French name of a vocabulary table", () => {
  const names = Object.keys(TERM_TABLES).join("|"), direct = new RegExp(`\\b(${names})(\\[[^\\]]+\\]|\\.[A-Za-z_]+)\\)?(\\s*\\|\\|\\s*\\{[^}]*\\}\\))?\\.fr\\b`), found = [];
  for (const f of files(new URL("../../web/js", import.meta.url).pathname)) { if (/core\/terms\.js$/.test(f)) continue; readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (direct.test(l)) found.push(`${f.split("/web/js/")[1]}:${i + 1}`); }); }
  assert.deepEqual(found, [], "these lines still show a French name");
});
