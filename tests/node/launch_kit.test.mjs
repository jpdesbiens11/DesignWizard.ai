/* The launch kit : the teaser cut from the film (tools/film/teaser.mjs), the one-page sheet and the texts to post
   (tools/launch/content.mjs, tools/launch/sheet.mjs). Its rules are those of the film : it tells, it does not read the screen ; both
   languages everywhere ; no figure of gain ; no brand of another product. */
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs"; import { fileURLToPath } from "node:url";
import { SCENES, DURATION, shownTexts } from "../../tools/film/script.mjs";
import { TEASER_CUTS, TEASER_LINES, TEASER_DURATION, teaserSpans, teaserRoom, teaserReads, teaserShotAt, teaserSrt, teaserScript } from "../../tools/film/teaser.mjs";
import { LANGS, LINKS, SHEET, POSTS, TAGLINES, USAGE, BRAND_FOOT, kitTexts, gainClaims, postsMarkdown } from "../../tools/launch/content.mjs";
import { sheetHtml } from "../../tools/launch/sheet.mjs";

const at = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url)), read = (p) => readFileSync(at(p), "utf8");
const both = (o, what) => { for (const l of LANGS) assert.ok(typeof o[l] === "string" && o[l].trim().length > 1, `${what} : no ${l}`); };

test("teaser — about half a minute, each shot a span of a scene of the film", () => {
  assert.ok(TEASER_DURATION >= 25 && TEASER_DURATION <= 35, `${TEASER_DURATION} s`); assert.ok(TEASER_CUTS.length >= 5);
  const spans = teaserSpans(); assert.equal(spans[0].at, 0); assert.equal(Math.round((spans[spans.length - 1].at + spans[spans.length - 1].len) * 1000) / 1000, TEASER_DURATION);
  spans.forEach((s, i) => {
    const scene = SCENES.find((x) => x.id === s.scene); assert.ok(scene, s.scene); assert.ok(s.a >= scene.t0 && s.b <= scene.t1 + 1e-9, `${s.scene} : ${s.a} → ${s.b} stays inside ${scene.t0} → ${scene.t1}`); assert.ok(s.b <= DURATION);
    assert.ok(s.len >= 2.5, `${s.scene} : long enough to be read`); if (i) { assert.equal(s.at, Math.round((spans[i - 1].at + spans[i - 1].len) * 1000) / 1000); assert.ok(s.a > spans[i - 1].a, "the order of the film is kept"); }
  });
  assert.equal(spans[0].scene, "problem"); assert.equal(spans[spans.length - 1].scene, "end", "it opens on the question and closes on the name");
  assert.equal(teaserShotAt(0).scene, "problem"); assert.equal(teaserShotAt(TEASER_DURATION - 0.01).scene, "end"); assert.equal(teaserShotAt(TEASER_DURATION + 1), null);
});

test("teaser — the voice tells, in both languages, inside its shots, without running and without reading the screen", () => {
  assert.equal(TEASER_LINES.length, TEASER_CUTS.length, "one breath a shot");
  TEASER_LINES.forEach((c, i) => {
    both(c, `line ${i + 1}`); assert.ok(c.t1 > c.t0 && c.t1 <= TEASER_DURATION); if (i) assert.ok(c.t0 >= TEASER_LINES[i - 1].t1, `line ${i + 1} starts after the one before`);
    const shot = teaserShotAt(c.t0); assert.ok(shot && c.t1 <= shot.at + shot.len + 1e-9, `line ${i + 1} stays inside its shot`); assert.ok(teaserRoom(i) > 1.5);
    for (const l of LANGS) { assert.deepEqual(teaserReads(c, l), [], `line ${i + 1} (${l}) reads the screen`); assert.ok(c[l].trim().split(/\s+/).length / (c.t1 - c.t0) <= 3.3, `line ${i + 1} (${l}) can be said without running`); assert.deepEqual(gainClaims(c[l]), []); }
  });
  for (const l of LANGS) { assert.ok(shownTexts(l).length > 20); assert.match(TEASER_LINES[TEASER_LINES.length - 1][l], /DesignOrbit\.ai/, "the name is said at the end"); }
  const srt = teaserSrt("fr"); assert.match(srt, /^1\n00:00:00,300 --> 00:00:02,900\nUne pièce commence par une question\.\n\n2\n/); assert.equal(srt.split("\n\n").length, TEASER_LINES.length);
  const script = teaserScript(); for (const c of TEASER_LINES) { assert.ok(script.includes(c.fr)); assert.ok(script.includes(c.en)); }
});

test("kit — every text in both languages, and none gives a figure of gain", () => {
  both(SHEET.kicker, "kicker"); both(SHEET.promise, "promise"); both(SHEET.shot.caption, "caption"); both(BRAND_FOOT, "foot"); both(SHEET.status.text, "status");
  for (const l of LANGS) { assert.equal(SHEET.slogan[l].length, 2); assert.equal(SHEET.story[l].length, 3); assert.equal(USAGE[l].length, USAGE.fr.length); }
  for (const p of POSTS) { both(p, p.id); both(p.where, `${p.id}.where`); both(p.attach, `${p.id}.attach`); if (p.max) for (const l of LANGS) assert.ok(p[l].length <= p.max, `${p.id} (${l}) : ${p[l].length} characters for ${p.max}`); }
  assert.equal(new Set(POSTS.map((p) => p.id)).size, POSTS.length); for (const t of TAGLINES) both(t, "tagline");
  for (const l of LANGS) { const texts = kitTexts(l); assert.ok(texts.length > 60); assert.deepEqual(texts.flatMap((t) => gainClaims(t)), [], `${l} : a figure of gain`); }
  /* the guard does see a gain when there is one — with accents, and in English */
  assert.deepEqual(gainClaims("Gagnez 30 % de temps, 3 fois plus vite : 2 heures gagnées. Productivité !"), ["30 %", "3 fois", "fois plus", "plus vite", "heures gagnées", "Productivité"]);
  assert.deepEqual(gainClaims("Saves hours, 2x faster — time saved."), ["2x", "faster", "Saves hours", "time saved"]); assert.deepEqual(gainClaims("La plateforme en vidéo (2 min 33), en 280 caractères."), [], "a length is not a gain");
  assert.ok(USAGE.fr.some((x) => /Aucun chiffre de gain/.test(x)) && USAGE.en.some((x) => /No figure of gain/.test(x)), "the usage notes say it too");
});

test("kit — what it says of the project is what the project is : free, in development, on request ; no brand of another product", () => {
  for (const l of LANGS) {
    const all = kitTexts(l).join("\n");
    assert.match(all, l === "fr" ? /développement actif/ : /active development/); assert.match(all, l === "fr" ? /accès sur demande/ : /access on request/); assert.match(all, /MIT/);
    assert.doesNotMatch(all, /\b(?:Onshape|SolidWorks|Fusion ?360|CATIA|Inventor|Google|Microsoft|LinkedIn|Twitter|Facebook|Instagram)\b/i, `${l} : the name of another product`);
    assert.doesNotMatch(all, /\b(?:révolutionn\w+|revolutionar\w+|n° ?1|numéro un|world-class|best-in-class|le meilleur|the best)\b/i, `${l} : a claim nobody can hold`);
  }
  assert.match(LINKS.demo, /^https:\/\/[a-z0-9.-]+\/DynamiteOrbit\.ai\/$/); assert.match(LINKS.code, /^https:\/\/github\.com\//); assert.ok(read("web/vitrine.html").includes(LINKS.code), "the links are those of the showcase page");
  assert.match(POSTS.find((p) => p.id === "liens").fr, new RegExp(LINKS.demo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("kit — the sheet : three groups by nature, each its colour, each step a pictogram of the application and a short title", () => {
  const icons = read("web/img/icons.svg"); assert.equal(SHEET.groups.length, 3); assert.equal(new Set(SHEET.groups.map((g) => g.color)).size, 3);
  for (const g of SHEET.groups) { both(g.title, g.key); assert.ok(g.steps.length >= 3 && g.steps.length <= 4, `${g.key} : ${g.steps.length} steps`);
    for (const s of g.steps) { assert.ok(icons.includes(`id="i-${s.icon}"`), `no icon « ${s.icon} »`); both(s.title, s.icon); both(s.text, s.icon); for (const l of LANGS) { assert.ok(s.title[l].length <= 22, `${s.title[l]} : a short title`); assert.ok(s.text[l].length <= 100, `${s.text[l]} : one line`); } } }
  assert.equal(new Set(SHEET.groups.flatMap((g) => g.steps.map((s) => s.icon))).size, SHEET.groups.flatMap((g) => g.steps).length, "one pictogram a step");
  assert.ok(existsSync(at(`web/img/tour/${SHEET.shot.img}.jpg`)), "the screen shown is a real screen of the guided presentation");
  for (const l of LANGS) {
    const html = sheetHtml(l, { icons: "<svg></svg>", logo: "<svg id=\"logo\"></svg>", shot: "shot.jpg", date: "2026-11-18" });
    assert.match(html, /^<!doctype html><html lang="(fr|en)">/); assert.ok(html.includes(BRAND_FOOT[l].replace(/&/g, "&amp;"))); assert.ok(html.includes("2026-11-18")); assert.ok(html.includes("@page { size: Letter; margin: 0; }"));
    for (const k of ["site", "demo", "code"]) assert.ok(html.includes(LINKS[k].replace(/^https:\/\//, "").replace(/\/$/, "")), `${l} : the link « ${k} »`);
    for (const g of SHEET.groups) assert.ok(html.includes(`style="--c:${g.color}"`)); assert.equal((html.match(/<use href="#i-/g) || []).length, SHEET.groups.flatMap((g) => g.steps).length);
  }
  const fr = sheetHtml("fr", { icons: "", logo: "", shot: "", date: "" }); assert.ok(fr.includes("question : à quoi sert‑elle ?"), "French : no break before a high punctuation mark, nor inside « sert-elle »"); assert.ok(!sheetHtml("en", { icons: "", logo: "", shot: "", date: "" }).includes(" :"));
});

test("kit — the texts to post as Markdown, and the tool that writes the files under « Sujet_AAAA-MM-JJ »", () => {
  const md = postsMarkdown("2026-11-18"); for (const p of POSTS) { assert.ok(md.includes(p.fr)); assert.ok(md.includes(p.en)); assert.ok(md.includes(`## ${p.where.fr} · ${p.where.en}`)); }
  for (const t of TAGLINES) assert.ok(md.includes(`| ${t.fr} | ${t.en} |`));
  const tool = read("tools/launch_kit.mjs"), teaser = read("tools/film_teaser.mjs");
  for (const name of ["`Fiche-une-page_${l.toUpperCase()}_${date}`", "`Textes-de-publication_${date}.md`", "`Textes-de-publication_${date}.docx`", "`Bande-annonce_${l.toUpperCase()}_${date}`", "`Bande-annonce_script_${date}.md`"]) assert.ok(tool.includes(name), name);
  assert.match(tool, /the kit gives a figure of gain/, "the tool refuses to write a kit that gives one"); assert.match(tool, /runs \$\{over\} px past its page/, "and a sheet that no longer fits its page");
  assert.match(tool, /docx\(\{ title: "Textes de publication"/, "the Word document is written by the platform's own writer, at its template"); assert.match(tool, /stampText\(/);
  assert.doesNotMatch(teaser, /xi-api-key": "(?!\$)[^"K]/, "no key in the tool"); assert.match(teaser, /const API = "https:\/\/api\.elevenlabs\.io", KEY = process\.env\.ELEVENLABS_API_KEY \|\| "proxy-injected";/);
  assert.match(teaser, /trim=start=\$\{s\.a\}:end=\$\{s\.b\}/, "the picture is cut from the film, not drawn again"); assert.match(teaser, /teaserSrt\(lang\)/);
  const doc = read("docs/LANCEMENT.md"); for (const w of ["Bande-annonce", "Fiche-une-page", "Textes-de-publication", "tools/launch_kit.mjs", "tools/film_teaser.mjs", "Aucun chiffre de gain"]) assert.ok(doc.includes(w), `docs/LANCEMENT.md : ${w}`);
});

test("the QR code of the sheet and of the film opens the welcome page : the address it carries is LINKS.home (remade by tools/make_qr.py)", () => {
  const svg = readFileSync(new URL("../../web/img/qr/home.svg", import.meta.url), "utf8");
  assert.match(svg, /viewBox="0 0 \d+ \d+"/, "it scales"); assert.equal((svg.match(/<desc>([^<]*)<\/desc>/) || [])[1], LINKS.home, "the code says the address the kit gives");
  assert.match(LINKS.home, /^https:\/\/[^ ]+\/#\/home$/);
});
