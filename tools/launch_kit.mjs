/* DesignOrbit.ai — the launch kit, written : the one-page sheet in French and in English (PDF, and a picture of it), the texts to
   post (Markdown, and a Word document at the template of the platform's documents), the script of the teaser — and, when they are
   given, the two teasers and their subtitles under their names. Not part of the application ; it needs the Chromium of the session
   (Playwright) for the sheet. Every file is named « Sujet_AAAA-MM-JJ », as the deposit in Drive wants (CLAUDE.md).
     node tools/launch_kit.mjs <out folder> [--date AAAA-MM-JJ] [--teaser-fr film.mp4] [--teaser-en film.mp4]
   The words are in tools/launch/content.mjs ; the teaser is made by tools/film_teaser.mjs. */

import { createRequire } from "node:module"; import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync } from "node:fs"; import { join } from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
import { LANGS, POSTS, TAGLINES, USAGE, postsMarkdown, kitTexts, gainClaims } from "./launch/content.mjs";
import { sheetHtml } from "./launch/sheet.mjs";
import { SHEET } from "./launch/content.mjs";
import { teaserScript } from "./film/teaser.mjs";
import { logoSvg, stampText } from "../web/js/core/brand.js";
import { docx } from "../web/js/core/docx.js";

const root = fileURLToPath(new URL("..", import.meta.url)), at = (p) => join(root, p);
const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; }, out = args[0] && !args[0].startsWith("--") ? args[0] : null;
if (!out) { console.error("usage : node tools/launch_kit.mjs <out folder> [--date AAAA-MM-JJ] [--teaser-fr film.mp4] [--teaser-en film.mp4]"); process.exit(2); }
const date = flag("--date", new Date().toISOString().slice(0, 10)); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date ${date} : AAAA-MM-JJ`);
mkdirSync(out, { recursive: true });
for (const l of LANGS) { const said = kitTexts(l).flatMap((t) => gainClaims(t)); if (said.length) throw new Error(`the kit gives a figure of gain (${l}) : ${said.join(", ")} — nobody measured one`); }
const made = [], keep = (name, bytes) => { writeFileSync(join(out, name), bytes); made.push(name); };

/* ---------- the sheet : one page, both languages ---------- */
const { chromium } = createRequire(import.meta.url)("playwright"), browser = await chromium.launch();
const icons = readFileSync(at("web/img/icons.svg"), "utf8"), shot = pathToFileURL(at(`web/img/tour/${SHEET.shot.img}.jpg`)).href;
for (const l of LANGS) {
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 }), html = join(out, `fiche_${l}.html`);
  writeFileSync(html, sheetHtml(l, { icons, logo: logoSvg(44), shot, date }));      // a file, so that the picture of the screen is read from the disk
  await page.goto(pathToFileURL(html).href); await page.evaluate(() => document.fonts.ready);
  const over = await page.evaluate(() => { const p = document.querySelector(".page"); return p.scrollHeight - p.clientHeight; });
  if (over > 1) throw new Error(`the sheet (${l}) runs ${over} px past its page : shorten a line in tools/launch/content.mjs`);
  const name = `Fiche-une-page_${l.toUpperCase()}_${date}`;
  await page.pdf({ path: join(out, `${name}.pdf`), width: "8.5in", height: "11in", printBackground: true, pageRanges: "1" }); made.push(`${name}.pdf`);
  await page.screenshot({ path: join(out, `${name}.png`) }); made.push(`${name}.png`);
  await page.close();
}
await browser.close();

/* ---------- the texts to post : Markdown to copy from, Word to read and annotate ---------- */
keep(`Textes-de-publication_${date}.md`, stampText("textes.md", postsMarkdown(date)));
const blocks = [{ type: "h1", text: "Mode d'emploi · How to use" }, { type: "list", items: USAGE.fr }, { type: "list", items: USAGE.en }];
for (const p of POSTS) {
  blocks.push({ type: "h1", text: `${p.where.fr} · ${p.where.en}` }, { type: "p", style: "muted", text: `À joindre : ${p.attach.fr} · Attach: ${p.attach.en}` });
  for (const l of LANGS) { blocks.push({ type: "h2", text: l === "fr" ? "Français" : "English" }); for (const para of p[l].split("\n").filter((x) => x.trim())) blocks.push({ type: "p", text: para }); if (p.max) blocks.push({ type: "p", style: "muted", text: `${p[l].length} / ${p.max} ${l === "fr" ? "caractères" : "characters"}` }); }
}
blocks.push({ type: "h1", text: "Phrases d'accroche · Taglines" }, { type: "table", head: ["Français", "English"], rows: TAGLINES.map((t) => [t.fr, t.en]), widths: [50, 50] });
keep(`Textes-de-publication_${date}.docx`, docx({ title: "Textes de publication", subtitle: "Kit de lancement — ready-to-post texts, français et anglais", header: "Textes de publication — kit de lancement", kind: "Communication", reference: "DW-COM-001", revision: "A", date: new Date(`${date}T12:00:00Z`), project: "DesignOrbit.ai", organisation: "DynamiteAgile™", blocks }));
keep(`Bande-annonce_script_${date}.md`, stampText("script.md", teaserScript()));

/* ---------- the teasers, under their names ---------- */
for (const l of LANGS) {
  const film = flag(`--teaser-${l}`, null); if (!film) continue;
  if (!existsSync(film)) throw new Error(`${film} : no such teaser`);
  const name = `Bande-annonce_${l.toUpperCase()}_${date}`; copyFileSync(film, join(out, `${name}.mp4`)); made.push(`${name}.mp4`);
  const srt = film.replace(/\.mp4$/, ".srt"); if (existsSync(srt)) { copyFileSync(srt, join(out, `${name}.srt`)); made.push(`${name}.srt`); }
}
for (const n of made) console.log(`${n.padEnd(46)} ${(statSync(join(out, n)).size / 1024).toFixed(0).padStart(6)} Ko`);
console.log(`${made.length} file(s) in ${out}`);
