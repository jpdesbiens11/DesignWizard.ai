/* DynamiteOrbit — the English of the demonstrations, in a workbook to review. Every text a demonstration writes on its drawings (the
   name of a part, a finish, an interface, a parameter, a note), the English it arrives with (web/js/demo/demo_words.js), and two yellow
   columns for whoever knows the trade : the correction, a remark. One sheet per demonstration, and a notice.
   Usage : node tools/words_review.mjs <out.xlsx> [logo.png]
   The corrections come back by hand into demo_words.js : the tests keep every text of a demonstration translated. */

import { readFileSync, writeFileSync } from "node:fs";
import { xlsx } from "../web/js/core/xlsx.js";
import { FOOT_NOTE } from "../web/js/core/brand.js";
import { tidyWords } from "../web/js/core/drawing_words.js";
import { DEMO_DRIVE } from "../web/js/demo/demo_drive.js";
import { DEMO_ROVER } from "../web/js/demo/demo_rover.js";
import { DEMO_ROCKET } from "../web/js/demo/demo_rocket.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../web/js/demo/demo_hvb.js";
import { WORDS_HVB } from "../web/js/demo/demo_words.js";

const out = process.argv[2], logoFile = process.argv[3];
if (!out) { console.error("usage : node tools/words_review.mjs <out.xlsx> [logo.png]"); process.exit(2); }
const HVB = { id: "demo-hvb", name: "DEMO-HVB — busbars 800 V (référence creepage)", parts: DEMO_HVB_PARTS, assemblies: [DEMO_HVB_ASSEMBLY], drawing: { words: WORDS_HVB } };
const DEMOS = [["Variateur", "Variateur compact", DEMO_DRIVE], ["Rover", "Rover", DEMO_ROVER], ["Fusee", "Fusée à moteur hybride", DEMO_ROCKET], ["HVB", "Busbars 800 V (référence d'isolation)", HVB]];
const KINDS = ["Nom du projet", "Nom d'assemblage", "Nom de pièce", "Finition", "Interface", "Paramètre", "Note"];

/** Where each text of a project is written : text → { kind, where : [ids] }, the first kind found wins (a name before a note). */
function uses(p) {
  const map = new Map(), put = (text, kind, id) => { if (typeof text !== "string" || !text.trim()) return; const t = text.trim(), u = map.get(t) || { kind, where: [] }; if (KINDS.indexOf(kind) < KINDS.indexOf(u.kind)) u.kind = kind; if (id && !u.where.includes(id)) u.where.push(id); map.set(t, u); };
  put(p.name, "Nom du projet", "");
  for (const a of p.assemblies || []) { put(a.name, "Nom d'assemblage", a.id); for (const n of a.notes || []) put(n, "Note", a.id); }
  for (const s of p.parts || []) { put(s.name, "Nom de pièce", s.id); put(s.finish, "Finition", s.id); for (const it of s.interfaces || []) put(it.name, "Interface", s.id);
    for (const v of Object.values(s.params || {})) put(v && typeof v === "object" ? v.label : null, "Paramètre", s.id); for (const n of s.notes || []) put(n, "Note", s.id); }
  return map;
}

const logo = logoFile ? [{ png: new Uint8Array(readFileSync(logoFile)), col: 0, row: 0, w: 10, h: 10 }] : [], date = new Date().toISOString().slice(0, 10), counts = [];
const sheets = DEMOS.map(([name, title, p]) => {
  const words = tidyWords(p.drawing && p.drawing.words), use = uses(p), list = Object.entries(words).map(([fr, en]) => ({ fr, en, ...(use.get(fr) || { kind: "(plus écrit sur un dessin)", where: [] }) }));
  list.sort((a, b) => (KINDS.indexOf(a.kind) + 99) % 99 - (KINDS.indexOf(b.kind) + 99) % 99 || 0);
  const same = list.filter((x) => x.fr === x.en).length, missing = [...use.keys()].filter((t) => !Object.prototype.hasOwnProperty.call(words, t));
  counts.push([title, list.length, same, missing.length]);
  const rows = [[null, { v: `Anglais des dessins — ${title}`, s: "title" }], [null, { v: `${list.length} textes · ${p.id} · ${date}. Colonnes jaunes : la correction (l'anglais à écrire à la place) et une remarque. Une case laissée vide veut dire « d'accord ».`, s: "sub" }], [],
    ["N°", "Nature", "Où (pièce ou assemblage)", "Français — tel que tapé dans le projet", "English — tel qu'écrit sur le dessin", "Correction", "Remarque"].map((v) => ({ v, s: "th" })),
    ...list.map((x, i) => { const where = x.where.slice(0, 2).join(", ") + (x.where.length > 2 ? ` … (${x.where.length} en tout)` : ""), lines = Math.max(1, Math.ceil(Math.max(x.fr.length, x.en.length) / 62), Math.ceil(where.length / 30));      // a row as tall as its longest cell
      return { h: lines > 1 ? 15 * lines : 18, cells: [{ v: i + 1, s: "tdl" }, { v: x.kind, s: "tdl" }, { v: where, s: "tdl" }, { v: x.fr, s: "tdl" }, { v: x.en, s: "tdl" }, { v: "", s: "choice" }, { v: "", s: "choice" }] }; })];
  return { name, cols: [6, 18, 30, 62, 62, 50, 40], rows, merges: ["B1:G1", "B2:G2"], pictures: logo, freeze: 4 };
});
const notice = [[{ v: "", s: "plain" }, { v: "Anglais des dessins des démonstrations — à relire", s: "title" }], [null, { v: `DynamiteOrbit · ${date}`, s: "sub" }], [],
  ...[["Ce que c'est", "Les dessins de la plateforme sont écrits en anglais. Ce que chaque démonstration a tapé en français — noms de pièces, finitions, interfaces, paramètres, notes — s'y écrit avec l'anglais de ce classeur. Ces traductions ont été proposées par l'outil d'IA : elles n'ont pas encore été relues par quelqu'un du métier."],
    ["Ce qui est demandé", "Lire chaque ligne en anglais de dessin technique, vocabulaire d'atelier (ASME Y14.5). Si l'anglais convient, ne rien écrire. Sinon, écrire dans « Correction » l'anglais à mettre à la place ; « Remarque » sert à dire pourquoi, ou à poser une question."],
    ["À garder", "Les références, les nombres, les unités et les désignations (M4, ISO 2768-mK, 6061-T6, Ra 3,2) ne se traduisent pas. Un terme court vaut mieux qu'une phrase : le dessin a peu de place."],
    ["Les feuilles", counts.map(([t, n, same]) => `${t} : ${n} textes${same ? ` (dont ${same} déjà en anglais)` : ""}`).join(" · ")],
    ["Après la relecture", "Renvoyez le classeur : les corrections sont reportées dans les démonstrations (web/js/demo/demo_words.js), et les dessins suivent. Dans un projet à vous, le même travail se fait à l'écran des Dessins, bouton « anglais du dessin »."],
    ["Marque", FOOT_NOTE]].map(([a, b]) => ({ h: 58, cells: [{ v: a, s: "head" }, { v: b, s: "text" }] }))];
const bytes = xlsx({ title: "Anglais des dessins des démonstrations — à relire", subject: "Traductions français → anglais à valider", author: "DynamiteOrbit", date: new Date(), names: [], sheets: [{ name: "Notice", cols: [24, 120], rows: notice, pictures: logo }, ...sheets] });
writeFileSync(out, bytes);
for (const [t, n, same, missing] of counts) console.log(`${t} : ${n} textes, ${same} déjà en anglais, ${missing} sans anglais`);
console.log(`${out} : ${bytes.length} octets`);
