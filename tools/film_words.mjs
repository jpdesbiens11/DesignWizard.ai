/* DesignOrbit.ai — the words of the film, written everywhere they are read, from the one timeline (tools/film/script.mjs) : the subtitle
   tracks of the site (web/video/designorbit_<lang>.vtt), the scripts to record (docs/film/narration_<lang>.md), the storyline — what
   the screen shows and what the voice tells over it, both languages side by side (docs/film/storyline.md) — and the narration given as
   text under each player of the showcase page (web/vitrine.html). Run it after changing the narration ; the picture is not drawn again
   (a new voice is then laid over it : tools/film_voice.mjs). tests/node/film.test.mjs checks that every one of these files is up to date.
     node tools/film_words.mjs */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"; import { join } from "node:path"; import { fileURLToPath } from "node:url";
import { CUES, LANGS, toVtt, toScript, toStoryline } from "./film/script.mjs";

const root = fileURLToPath(new URL("..", import.meta.url)), at = (p) => join(root, p);
mkdirSync(at("docs/film"), { recursive: true });
for (const l of LANGS) { writeFileSync(at(`web/video/designorbit_${l}.vtt`), toVtt(l)); writeFileSync(at(`docs/film/narration_${l}.md`), toScript(l)); }
writeFileSync(at("docs/film/storyline.md"), toStoryline());

/* the narration as text, under each player : the lists of the page, in the order of its players (French, then English) */
let page = readFileSync(at("web/vitrine.html"), "utf8"), n = 0;
page = page.replace(/(<details class="said">\n\s*<summary>[^<]*<\/summary>\n\s*<ol>\n)([\s\S]*?)(\s*<\/ol>)/g, (all, head, old, tail) => { const l = LANGS[n++]; return l ? `${head}${CUES.map((c) => `      <li>${c[l]}</li>`).join("\n")}${tail}` : all; });
if (n !== LANGS.length) throw new Error(`web/vitrine.html : ${n} narration list(s) found, ${LANGS.length} expected — nothing was written to the page`);
writeFileSync(at("web/vitrine.html"), page);
console.log(`${CUES.length} lines : ${LANGS.map((l) => `designorbit_${l}.vtt, narration_${l}.md`).join(", ")}, storyline.md and the ${LANGS.length} lists of web/vitrine.html written.`);
