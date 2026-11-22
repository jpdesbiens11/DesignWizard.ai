/* Point 17 (JP, 20 novembre 2026) : the panel of the automatic rotation moves or docks into the right margin ; an animation of a view is
   recorded and downloaded ; « Partager » on every studio — the link, the files the screen makes, grouped by nature, an animation.
     node --test tests/node/share.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatOf, shareGroups, shareName, animationFile, turnSeconds, SHARE_GROUPS, FORMATS } from "../../web/js/core/share.js";
import { placeOf, clampPlace } from "../../web/js/core/auto_dock.js";
import { AUTO_SPEEDS } from "../../web/js/core/view_orbit.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("a file is known by its label, then its tip : STEP, PDF, Word, Excel, Gerber, .dwiz, ZIP, video…", () => {
  const k = (l, t) => formatOf(l, t).key;
  assert.equal(k("STEP"), "step"); assert.equal(k("PDF"), "pdf"); assert.equal(k("Fiche (.docx)"), "docx"); assert.equal(k("Word"), "docx"); assert.equal(k("Excel"), "xlsx");
  assert.equal(k("Plan de test (.docx)"), "docx"); assert.equal(k("Le dossier (.zip)"), "zip"); assert.equal(k("Paquet pour l'IA (.zip)"), "zip"); assert.equal(k(".dwiz"), "dwiz");
  assert.equal(k("Fichiers Gerber"), "gerber"); assert.equal(k("Film (.webm)"), "webm"); assert.equal(k("Fichier HTML autonome"), "html");
  assert.equal(k("Télécharger", "Télécharger le STEP AP214 de l'assemblage"), "step", "the tip names it when the label does not");
  assert.equal(k("Bidule"), "other");
  for (const f of FORMATS) assert.ok(SHARE_GROUPS.some((g) => g.key === f.group), `${f.key} : a group of its own`);
});

test("the exports of a screen, grouped by nature in a set order, each group with its colour ; the same label once", () => {
  const items = [{ label: "PDF" }, { label: "STEP" }, { label: "Excel" }, { label: "Word" }, { label: "PDF" }, { label: "" }, { label: "Fichiers Gerber" }];
  const g = shareGroups(items);
  assert.deepEqual(g.map((x) => x.key), ["3d", "doc", "fab", "data"]); assert.deepEqual(g.find((x) => x.key === "doc").items.map((x) => x.label), ["PDF", "Word"]);
  assert.ok(g.every((x) => /^#[0-9a-f]{6}$/.test(x.color) && x.fr && x.label)); assert.deepEqual(shareGroups([]), []);
});

test("the name of what is shared, and of a recorded animation ; one turn at each speed", () => {
  assert.equal(shareName("#/assembly/BM-8S8P-ASM"), "BM-8S8P-ASM"); assert.equal(shareName("#/parts/A%20B"), "A_B"); assert.equal(shareName("#/shop"), "shop"); assert.equal(shareName(""), "vue");
  assert.equal(animationFile("#/assembly/BM-8S8P-ASM", new Date(2026, 10, 22, 4, 12)), "BM-8S8P-ASM_animation_2026-11-22_0412.webm");
  assert.deepEqual(AUTO_SPEEDS.map((s) => turnSeconds(s.deg)), [40, 360 / 27, 5]); assert.equal(turnSeconds(0), 0);
});

test("the panel of the rotation : a place kept, docked or floating, always whole inside the view", () => {
  assert.deepEqual(placeOf('{"dock":true}'), { dock: true }); assert.deepEqual(placeOf({ x: 12.4, y: 30.6 }), { x: 12, y: 31 }); assert.equal(placeOf("nope"), null); assert.equal(placeOf({ x: "a" }), null);
  assert.deepEqual(clampPlace({ x: -50, y: 900 }, { w: 800, h: 600 }, { w: 196, h: 220 }), { x: 8, y: 372 }); assert.deepEqual(clampPlace({ x: 100, y: 100 }, { w: 800, h: 600 }, { w: 196, h: 220 }), { x: 100, y: 100 });
});

test("wired : « Partager » installed once, after « IA » ; the panel moves, docks, records ; the film leaves through download() with the mark", () => {
  const app = read("web/js/core/app.js"), ui = read("web/js/core/share_ui.js"), orbit = read("web/js/core/view_orbit.js"), rec = read("web/js/core/view_record.js"), dock = read("web/js/core/auto_dock.js");
  assert.match(app, /installShare\(\)/); assert.match(ui, /\.head-ai/); assert.match(ui, /it\.ref\.click\(\)/, "a file is made by the button of its screen"); assert.match(ui, /navigator\.clipboard\.writeText/);
  assert.match(orbit, /mountAutoDock\(panel, head, viewer, dockBtn\)/); assert.match(orbit, /dw-auto-record/); assert.match(orbit, /oneTurn/); assert.match(orbit, /!panel\.dataset\.placed/, "a panel put somewhere stays there");
  assert.match(rec, /download\(animationFile/); assert.match(rec, /BRAND_LINE/); assert.match(dock, /aside\.side\.right/); assert.match(read("web/js/core/viewer.js"), /container\.dwViewer = this/);
  assert.match(read("web/css/nav.css"), /\.share-menu/); assert.match(read("web/css/app.css"), /\.dw-auto\.docked/);
});
