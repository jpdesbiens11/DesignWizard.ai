/* DesignWizard.ai — the day the film speaks : what the site publishes goes from « silent, its narration drawn in the picture » to
   « speaking, its subtitles a track shown only while the sound is off » (web/js/core/captions.js). Not part of the application and not
   run by the tests : it needs the two spoken films, made by tools/film_voice.mjs over pictures rendered with --no-captions.
     node tools/film_speak.mjs <spoken fr.mp4> <spoken en.mp4> [--root folder]
   It copies the films over web/video/designwizard_<lang>.mp4, sets FILM.voice, and gives the showcase page its subtitle tracks, its one
   script, the right to run it, a « no sound » box under each player and the words that go with them. Every change is found exactly once or nothing is written ; a site that
   already speaks only takes the new films. tests/node/film.test.mjs then checks the whole state.
   Before publishing a synthetic voice, check that the plan it was made under allows the use (docs/VIDEO.md). */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs"; import { join, resolve } from "node:path"; import { fileURLToPath } from "node:url";
import { LANGS } from "./film/script.mjs";

const args = process.argv.slice(2), at = args.indexOf("--root"), root = resolve(at < 0 ? fileURLToPath(new URL("..", import.meta.url)) : args[at + 1]);
const films = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--root");
if (films.length !== LANGS.length || films.some((f) => !existsSync(f))) { console.error("usage : node tools/film_speak.mjs <spoken fr.mp4> <spoken en.mp4> [--root folder]"); process.exit(2); }
const NAMES = { fr: "Français", en: "English" };
/* under each player, the « no sound » box : written hidden, shown by the page's script, which makes it work */
const BOX = { fr: ["téléchargez-la</a>.\n  </video>\n", '  <label class="mute" hidden><input type="checkbox"> Sans son <small>— les sous-titres apparaissent</small></label>\n'], en: ["download it</a>.\n  </video>\n", '  <label class="mute" hidden><input type="checkbox"> No sound <small>— the subtitles appear</small></label>\n'] };
/** One change of a text, found exactly once. */
const once = (text, from, to, what) => { const n = text.split(from).length - 1; if (n !== 1) throw new Error(`${what} : found ${n} time(s), expected once — nothing was written`); return text.replace(from, to); };

const modPath = join(root, "web/js/core/film.js"), pagePath = join(root, "web/vitrine.html"); let mod = readFileSync(modPath, "utf8"), page = readFileSync(pagePath, "utf8");
const spoke = /\bvoice: true,/.test(mod);
if (!spoke) {
  mod = once(mod, "voice: false,", "voice: true,", "FILM.voice");
  page = once(page, "media-src 'self';", "media-src 'self'; script-src 'self';", "the right to run the house's script");
  for (const l of LANGS) page = once(page, `    <source src="video/designwizard_${l}.mp4" type="video/mp4">\n`, `    <source src="video/designwizard_${l}.mp4" type="video/mp4">\n    <track kind="subtitles" srclang="${l}" label="${NAMES[l]}" src="video/designwizard_${l}.vtt">\n`, `the ${l} player`);
  for (const l of LANGS) page = once(page, BOX[l][0], BOX[l][0] + BOX[l][1], `the « no sound » box of the ${l} player`);
  page = once(page, "Sans son pour l'instant :\n    la narration se lit à l'écran.", "Avec la voix ; cochez « Sans son »\n    sous le film et les sous-titres apparaissent.", "the French sentence about the sound");
  page = once(page, "No sound yet: the narration reads on screen.", "With a voice; tick “No sound” under the film and the subtitles appear.", "the English sentence about the sound");
  page = once(page, "Page statique, sans script, sans ressource externe, sans traceur.", "Page statique, sans ressource externe, sans traceur ; un seul script, maison, pour les sous-titres de la vidéo.", "the footer");
  page = once(page, "</body>", '<script type="module" src="js/vitrine.js"></script>\n</body>', "the end of the page");
  writeFileSync(modPath, mod); writeFileSync(pagePath, page);
}
LANGS.forEach((l, i) => copyFileSync(films[i], join(root, `web/video/designwizard_${l}.mp4`)));
console.log(`${spoke ? "The site already spoke : only the films were replaced" : "The site speaks : FILM.voice, the tracks and the script of the showcase page are set"} — ${LANGS.map((l, i) => `${l} ← ${films[i]}`).join(" ; ")}.`);
console.log("Next : node --test tests/node/film.test.mjs ; then the docs that still say « sans son » (docs/VIDEO.md, README.md, web/css/vitrine.css).");
