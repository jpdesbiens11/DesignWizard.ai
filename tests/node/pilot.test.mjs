// The pilot trial : one hour, eleven stations ; the path names what is on the screen, and the robot looks for what it names.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { PILOT, STATIONS, BEFORE, HOST, STATEMENTS, OPEN, PROFILE, SEND, LINKS, quoted, wordsOf, clock, pilotMarkdown, pilotDoc, feedbackDoc, pilotTexts } from "../../tools/pilot/content.mjs";
import { gainClaims } from "../../tools/launch/content.mjs";
import { NAV } from "../../web/js/core/app.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("the path : eleven stations that make one hour, each with a goal, steps, something to notice and a question", () => {
  assert.equal(STATIONS.length, 11); assert.equal(STATIONS.reduce((s, x) => s + x.minutes, 0), PILOT.minutes); assert.equal(PILOT.minutes, 60);
  assert.equal(new Set(STATIONS.map((s) => s.id)).size, STATIONS.length); const c = clock(); assert.deepEqual([c[0].from, c[c.length - 1].to], [0, 60]); assert.ok(c.every((x, i) => !i || x.from === c[i - 1].to));
  for (const s of STATIONS) { assert.ok(s.minutes >= 3 && s.minutes <= 8, `${s.id} : a station is short`); assert.ok(s.title && s.screen && s.goal.length > 20 && s.look.length > 20, s.id); assert.ok(s.steps.length >= 3 && s.steps.length <= 6, `${s.id} : three to six steps`); assert.match(s.ask, /\?$/, `${s.id} ends on a question for the sheet`); assert.ok(s.checks.length >= 1 && s.checks[0].go, `${s.id} opens a screen`); }
  assert.ok(BEFORE.length >= 4 && BEFORE.some((x) => /Python 3\.9/.test(x)) && BEFORE.some((x) => /Demander l'accès/.test(x)) && BEFORE.some((x) => /confidentiel/.test(x)), "how to get in, online or on one's own machine");
  assert.ok(HOST.some((x) => /trente secondes/.test(x)), "the one who watches lets the tester look for it");
});

test("the path is held to the screen : every label a step names is one the robot looks for, on a screen that exists", () => {
  const groups = new Set(NAV.flatMap((g) => g.keys)); let named = 0;
  for (const s of STATIONS) { const words = wordsOf(s); for (const q of s.steps.flatMap(quoted)) { named++; assert.ok(words.includes(q), `${s.id} : « ${q} » is named in a step, and the robot does not look for it`); }
    for (const c of s.checks) { assert.ok(c.words.length >= 1, s.id); if (c.go) { const key = c.go.slice(2).split("/")[0]; assert.ok(existsSync(new URL(`../../web/js/modules/${key}.js`, import.meta.url)), `${s.id} → ${c.go}`); assert.ok(key === "home" || groups.has(key), `${c.go} is a screen of the top bar`); } else assert.ok(c.click, `${s.id} : a check goes somewhere or clicks something`); } }
  assert.ok(named >= 60, `${named} labels named`); assert.deepEqual(quoted("cliquez « A », puis « B c »"), ["A", "B c"]);
  /* what the steps say of the top bar is what the top bar is */
  const tile = (s) => [...s.screen.matchAll(/(\d) (\p{Lu}\p{L}+)/gu)].map((m) => [Number(m[1]), m[2]]), LABEL = { shop: "Atelier", parts: "Pièces", assembly: "Assemblage", drawings: "Dessins", physics: "Physique", fea: "Simulation", pcb: "PCB", pcba: "PCBA", elab: "Labo", creepage: "Isolation", dfx: "DFx", review: "Revue", report: "Rapport" };
  for (const s of STATIONS) { const g = NAV.find((x) => s.screen.startsWith(x.label)); if (!g) continue; for (const [n, name] of tile(s)) assert.equal(LABEL[g.keys[n - 1]], name, `${s.id} : « ${s.screen} » — the tile ${n} of ${g.label} is ${LABEL[g.keys[n - 1]]}`); }
  const walk = read("tools/pilot_walk.mjs"); assert.match(walk, /import \{ STATIONS \} from "\.\/pilot\/content\.mjs";/); assert.match(walk, /process\.exit\(missing \? 1 : 0\)/, "a missing word fails the walk");
});

test("the kit promises nothing nobody measured, and says what was not checked", () => {
  assert.deepEqual(gainClaims(pilotTexts()), []); assert.doesNotMatch(pilotTexts(), /gagn(e|ez|er) du temps|plus vite|fois plus|\d+ ?%/i);
  const md = pilotMarkdown(); assert.match(md, /n'a encore été suivi par personne d'autre que son auteur et son robot/); assert.match(md, /Les durées sont une estimation/); assert.match(md, /Rien n'a été mesuré sur le temps gagné ou perdu/);
  assert.match(PILOT.honest, /ne remplace la vérification d'un ingénieur/); assert.doesNotMatch(pilotTexts(), /@[a-z0-9.-]+\.[a-z]{2,}/i, "no address");
  assert.equal(LINKS.demo, "https://jpdesbiens11.github.io/DynamiteOrbit.ai/");
});

test("the guide of the repository is the path, word for word ; the old guide points to it", () => {
  assert.equal(read("docs/ESSAI_PILOTE.md"), pilotMarkdown(), "docs/ESSAI_PILOTE.md is written by « node tools/pilot_kit.mjs --docs »");
  const md = pilotMarkdown(); for (const s of STATIONS) { assert.ok(md.includes(s.title), s.id); for (const x of s.steps) assert.ok(md.includes(x), s.id); } for (const q of [...STATEMENTS, ...OPEN]) assert.ok(md.includes(q));
  const old = read("docs/GUIDE_COLLABORATEURS.md"); assert.match(old, /\[ESSAI_PILOTE\.md\]\(ESSAI_PILOTE\.md\)/); assert.doesNotMatch(old, /20 minutes|version 0\.2/, "the trial of the first versions is gone"); assert.match(old, /python designwizard\.py/);
  assert.match(read("README.md"), /docs\/ESSAI_PILOTE\.md/); assert.match(read("web/js/modules/help.js"), /blob\/main\/docs\/ESSAI_PILOTE\.md/, "the Help leads to the trial"); assert.match(read(".github/ISSUE_TEMPLATE/retour-essai.md"), /ESSAI_PILOTE\.md/);
  assert.match(read("web/js/modules/home.js"), /\["elab", "Labo", /, "the path of the home page knows the lab");
});

test("the two documents handed to a tester : the path to tick, the sheet to fill — at the template of the platform", () => {
  const path = pilotDoc(), sheet = feedbackDoc();
  assert.equal(path.filter((b) => b.type === "checklist").length, STATIONS.length, "each station is a list one ticks"); assert.equal(path.filter((b) => b.type === "checklist").flatMap((b) => b.items).length, STATIONS.reduce((s, x) => s + x.steps.length, 0));
  const tables = sheet.filter((b) => b.type === "table" && b.head); assert.equal(sheet.filter((b) => b.type === "table" && !b.head).length, 1, "who tries : a table without a heading"); assert.equal(tables.find((t) => t.head.includes("Faite")).rows.length, STATIONS.length); assert.equal(tables.find((t) => t.head.includes("5")).rows.length, STATEMENTS.length); assert.equal(tables.filter((t) => t.head.length === 1).length, OPEN.length, "room to write, one box per open question"); assert.ok(sheet.filter((b) => b.type === "table" && b.rowHeight).length >= OPEN.length + 2); assert.match(read("web/js/core/pdfdoc.js"), /Math\.max\(isHead \? 0 : o\.height \|\| 0,/, "a tall row keeps a heading of ordinary height"); assert.doesNotMatch(pilotTexts(), /→/, "no arrow a PDF font lacks");
  assert.equal(STATEMENTS.length, 6); assert.ok(PROFILE.length >= 4 && SEND.some((x) => /confidentiel/.test(x)));
  const meta = { kind: "Essai pilote", revision: "A", date: new Date("2026-11-19T12:00:00Z"), project: "DynamiteOrbit", title: "Essai pilote", reference: "DW-PIL-001" };
  for (const blocks of [path, sheet]) { const w = docx({ ...meta, blocks }), p = pdfDoc({ ...meta, blocks }); assert.ok(w.length > 20000 && w[0] === 0x50 && w[1] === 0x4b); assert.ok(p.length > 15000 && String.fromCharCode(...p.slice(0, 5)) === "%PDF-"); }
  assert.doesNotMatch(JSON.stringify([path, sheet]), /☐|✓/, "no glyph a PDF font lacks");
  const kit = read("tools/pilot_kit.mjs"); assert.match(kit, /Essai-pilote_Parcours/); assert.match(kit, /Essai-pilote_Fiche-de-retour/); assert.match(kit, /gainClaims\(pilotTexts\(\)\)/);
  /* a table one writes in : both templates take the height of its rows */
  assert.match(read("web/js/core/pdfdoc.js"), /b\.rowHeight \? \{ height: b\.rowHeight \} : \{\}/); assert.match(read("web/js/core/pdfdoc.js"), /if \(b\.rowHeight\) need\(b\.rowHeight \+ 7\);/, "the question stays with its box"); assert.match(read("web/js/core/docx.js"), /b\.rowHeight \? \{ height: Math\.round\(b\.rowHeight \* 56\.7\) \} : \{\}/);
});
