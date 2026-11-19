/* The film of the platform : its timeline (tools/film/script.mjs), the files the site publishes (web/video), the pages that show them. */
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs"; import { fileURLToPath } from "node:url";
import { SCENES, CUES, DURATION, FPS, LANGS, SLOGANS, sceneAt, cueAt, pace, toVtt, toScript, toStoryline, shownTexts, readsScreen, plain, roomOf, fitLine, MAX_TEMPO } from "../../tools/film/script.mjs";
import { FILM, filmFiles, filmLength, filmLang, filmNote, subName } from "../../web/js/core/film.js";
import { subChoices, subDefault, subModes, subChoice, subTracks, subsBox } from "../../web/js/core/captions.js";

const at = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url)), read = (p) => readFileSync(at(p), "utf8");
const both = (o, what) => { for (const l of LANGS) assert.ok(typeof o[l] === "string" && o[l].trim().length > 1, `${what} : no ${l}`); };

test("film — the timeline : between two and three minutes, scenes end to end, both languages everywhere", () => {
  assert.ok(DURATION >= 120 && DURATION <= 180, `${DURATION} s`); assert.equal(FPS, 24); assert.deepEqual(LANGS, ["fr", "en"]);
  assert.equal(SCENES[0].t0, 0);
  SCENES.forEach((s, i) => {
    assert.ok(s.t1 > s.t0, s.id); if (i) assert.equal(s.t0, SCENES[i - 1].t1, `${s.id} starts where ${SCENES[i - 1].id} ends`);
    if (s.kind === "words") { both(s.big, `${s.id}.big`); both(s.small, `${s.id}.small`); }
    else if (s.kind === "logo" || s.kind === "end") { both(s.slogan, `${s.id}.slogan`); both(s.small, `${s.id}.small`); }
    else { assert.equal(s.kind, "shot"); both(s.station, `${s.id}.station`); both(s.title, `${s.id}.title`); }
  });
  assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length);
  assert.equal(sceneAt(0).id, "problem"); assert.equal(sceneAt(DURATION - 0.01).kind, "end"); assert.equal(sceneAt(DURATION + 5).kind, "end");
  assert.equal(sceneAt(SCENES[3].t0).id, SCENES[3].id);
});

test("film — a screen of the platform : its pictures cover the scene, each one exists, the words appear while it is shown", () => {
  const shots = SCENES.filter((s) => s.kind === "shot"), tool = read("tools/film_shots.mjs"); assert.ok(shots.length >= 6);
  for (const s of shots) {
    const len = s.t1 - s.t0; assert.equal(s.media[0].t0, 0, s.id); assert.equal(s.media[s.media.length - 1].t1, len, `${s.id} : shown to its end`);
    s.media.forEach((m, i) => {
      if (i) assert.equal(m.t0, s.media[i - 1].t1, `${s.id} : picture ${i} follows the one before`);
      if (m.img) assert.ok(existsSync(at(`web/img/tour/${m.img}.jpg`)), `${s.id} : web/img/tour/${m.img}.jpg`); else assert.ok(new RegExp(`\\b${m.clip}\\b`).test(tool), `${s.id} : clip ${m.clip} is shot by tools/film_shots.mjs`);
      for (const f of [m.from, m.to]) { assert.equal(f.length, 3); assert.ok(f[0] >= 0 && f[0] <= 1 && f[1] >= 0 && f[1] <= 1 && f[2] >= 1 && f[2] <= 2.2, `${s.id} : framing ${f}`); }
    });
    assert.ok(s.chips.length >= 2 && s.chips.length <= 4, s.id);
    for (const c of s.chips) { both(c, `${s.id} chip`); assert.ok(c.at > 0 && c.at < len - 2, `${s.id} : « ${c.fr} » has time to be read`); assert.ok(c.fr.length <= 40 && c.en.length <= 40, c.fr); }
  }
});

test("film — the narration : one breath after another, sayable, and it names the platform", () => {
  assert.ok(CUES.length >= 18);
  CUES.forEach((c, i) => {
    both(c, `cue ${i + 1}`); assert.ok(c.t0 >= 0 && c.t1 <= DURATION && c.t1 - c.t0 >= 2, `cue ${i + 1}`);
    if (i) assert.ok(c.t0 >= CUES[i - 1].t1 + 0.15, `cue ${i + 1} leaves a breath after the one before`);
    for (const l of LANGS) assert.ok(pace(c, l) <= 3, `cue ${i + 1} (${l}) : ${pace(c, l).toFixed(2)} words a second`);
    assert.ok(sceneAt(c.t0) === sceneAt(c.t1 - 0.01), `cue ${i + 1} stays in its scene`);
  });
  for (const l of LANGS) assert.equal(CUES.filter((c) => c[l].includes("DesignWizard.ai")).length, 2, `${l} : the name is said when it appears and at the very end`);
  assert.ok(CUES[CUES.length - 1].fr.endsWith("DesignWizard.ai.") && CUES[CUES.length - 1].en.endsWith("DesignWizard.ai."), "the last word of the film is its name");
  assert.equal(cueAt(1).fr, CUES[0].fr); assert.equal(cueAt(CUES[0].t1 + 0.05), null); assert.equal(cueAt(DURATION + 1), null);
  const words = (l) => CUES.reduce((n, c) => n + c[l].trim().split(/\s+/).length, 0);
  assert.ok(words("fr") > 150 && words("fr") < 380 && words("en") > 150 && words("en") < 380, "a narration of under three minutes");
  CUES.forEach((c, i) => { if (c.take) { assert.ok(Number.isInteger(c.take) && c.take >= 1 && c.take <= i, `cue ${i + 1} : a line said later keeps the number it was first recorded under`); if (i && CUES[i - 1].take) assert.ok(c.take > CUES[i - 1].take); } });
  assert.match(read("tools/film_voice.mjs"), /const k = \(CUES\[i\]\.take \|\| i \+ 1\) - 1;/, "the voice tool keeps the recording of a line that only moved");
});

test("film — a story, not a reading (demande de JP) : the voice never says word for word what the screen writes", () => {
  for (const l of LANGS) {
    const shown = shownTexts(l); assert.ok(shown.length >= 40, `${shown.length} texts on screen (${l})`);
    for (const x of [SLOGANS.open[l], SLOGANS.close[l], SCENES[0].big[l], SCENES[3].title[l], SCENES[3].chips[0][l], SCENES[3].station[l]]) assert.ok(shown.includes(x), `« ${x} » is counted as on screen`);
    CUES.forEach((c, i) => assert.deepEqual(readsScreen(c, l), [], `line ${i + 1} (${l}) reads the screen : « ${c[l]} »`));
  }
  /* the check does catch a reading : a title, a chip or a slogan said as written, whatever the case and the punctuation */
  assert.deepEqual(readsScreen({ fr: `Voici : ${SCENES[3].title.fr.toUpperCase()} !` }, "fr"), [SCENES[3].title.fr]);
  assert.deepEqual(readsScreen({ en: `And then, ${SCENES[4].chips[2].en}.` }, "en"), [SCENES[4].chips[2].en]);
  assert.deepEqual(readsScreen({ fr: SLOGANS.close.fr }, "fr"), [SLOGANS.close.fr]); assert.deepEqual(readsScreen({ fr: "La pièce part à l'atelier." }, "fr"), [], "one word of the screen is not a reading");
  assert.equal(plain("Le dessin se fait seul — et reste à jour"), "le dessin se fait seul et reste à jour");
  /* the thread of the story : it opens on a question and closes on the answer */
  assert.match(CUES[0].fr, /question/); assert.match(CUES[0].en, /question/); assert.match(CUES[CUES.length - 2].fr, /question/); assert.match(CUES[CUES.length - 1].fr, /réponse/); assert.match(CUES[CUES.length - 1].en, /answer/);
  assert.ok(!CUES.some((c) => /\d/.test(c.fr + c.en)), "no figure in the narration : no time saved was measured");
});

test("film — a voice : the room each line has, and how a recorded line is made to fit", () => {
  CUES.forEach((c, i) => { const room = roomOf(i); assert.ok(room >= c.t1 - c.t0 - 1e-9, `line ${i + 1} : the voice has at least the time of its subtitle`); assert.ok(c.t0 + room <= (i + 1 < CUES.length ? CUES[i + 1].t0 : DURATION) - 0.1, `line ${i + 1} ends a breath before the next`); });
  assert.ok(Math.abs(roomOf(0) - (CUES[1].t0 - 0.15 - CUES[0].t0)) < 1e-9); assert.ok(Math.abs(roomOf(CUES.length - 1) - (DURATION - 0.3 - CUES[CUES.length - 1].t0)) < 1e-9);
  assert.deepEqual(fitLine(4, 5), { tempo: 1, ok: true, over: 0 }, "a line that fits is left as it was said"); assert.deepEqual(fitLine(5.5, 5), { tempo: 1.1, ok: true, over: 0 });
  assert.equal(fitLine(5 * MAX_TEMPO, 5).ok, true, "at the limit"); const long = fitLine(6, 5); assert.equal(long.ok, false); assert.equal(long.tempo, MAX_TEMPO); assert.ok(long.over > 0.3 && long.over < 0.4, "a line too long says by how much");
  assert.ok(MAX_TEMPO > 1 && MAX_TEMPO <= 1.15, "a voice is not hurried");
});

test("film — subtitles and script : written from the timeline, and the files of the site and of the docs are those", () => {
  const vtt = toVtt("fr"), blocks = vtt.trim().split("\n\n");
  assert.equal(blocks[0], "WEBVTT"); assert.equal(blocks.length, CUES.length + 1);
  assert.equal(blocks[1], `1\n00:00:00.500 --> 00:00:03.900\n${CUES[0].fr}`);
  for (const b of blocks.slice(1)) assert.match(b, /^\d+\n\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}\n\S/);
  assert.match(toScript("en"), /^# DesignWizard\.ai — video narration\n\nLength: 2 min 50 s\./); assert.ok(toScript("fr").includes(`**00:00.5 → 00:03.9** ${CUES[0].fr}`));
  for (const l of LANGS) { assert.equal(read(`web/video/designwizard_${l}.vtt`), toVtt(l), `web/video/designwizard_${l}.vtt is out of date : render the film again`); assert.equal(read(`docs/film/narration_${l}.md`), toScript(l), `docs/film/narration_${l}.md is out of date : node tools/film_words.mjs`); }
  /* the storyline : every scene with what it writes on screen, every line of the voice in both languages */
  const story = toStoryline(); assert.equal(read("docs/film/storyline.md"), story, "docs/film/storyline.md is out of date : node tools/film_words.mjs");
  assert.equal((story.match(/^## /gm) || []).length, SCENES.length); for (const c of CUES) assert.ok(story.includes(`| ${c.fr} | ${c.en} |`), c.fr);
  for (const s of SCENES) if (s.title) { assert.ok(story.includes(s.title.fr) && story.includes(s.title.en)); for (const chip of s.chips) assert.ok(story.includes(chip.fr)); }
  assert.match(read("tools/film_words.mjs"), /toVtt\(l\)[\s\S]*toScript\(l\)[\s\S]*toStoryline\(\)/, "one tool writes the words everywhere they are read");
});

test("film — the files the site publishes : an MP4 of the length of the timeline, ready to play before it is all loaded, and light", () => {
  assert.equal(FILM.seconds, DURATION); assert.deepEqual(FILM.langs, LANGS); assert.equal(filmLength(), "2 min 50"); assert.equal(filmLength(125), "2 min 05");
  assert.equal(filmLang("en-CA"), "en"); assert.equal(filmLang("fr-CA"), "fr"); assert.equal(filmLang("de"), "fr"); assert.equal(filmLang(undefined), "fr");
  assert.deepEqual(filmFiles("zz"), filmFiles("fr")); assert.equal(filmFiles("en").src, "video/designwizard_en.mp4");
  for (const l of LANGS) {
    const f = filmFiles(l, "web/video/"), mp4 = readFileSync(at(f.src)), jpg = readFileSync(at(f.poster)); both(FILM.silent, "silent"); assert.ok(FILM.names[l]);
    assert.equal(mp4.toString("latin1", 4, 8), "ftyp"); assert.ok(statSync(at(f.src)).size < 14e6, `${f.src} : ${(mp4.length / 1e6).toFixed(1)} MB — a film the repository can carry`);
    const moov = mp4.indexOf("moov", 0, "latin1"), mdat = mp4.indexOf("mdat", 0, "latin1"), mvhd = mp4.indexOf("mvhd", 0, "latin1");
    assert.ok(moov > 0 && moov < mdat, `${f.src} : the index comes before the pictures (faststart)`);
    const v = mp4[mvhd + 4], scale = mp4.readUInt32BE(mvhd + (v === 1 ? 24 : 16)), dur = v === 1 ? Number(mp4.readBigUInt64BE(mvhd + 28)) : mp4.readUInt32BE(mvhd + 20);
    assert.ok(Math.abs(dur / scale - DURATION) < 0.2, `${f.src} lasts ${(dur / scale).toFixed(2)} s`);
    assert.deepEqual([jpg[0], jpg[1]], [0xff, 0xd8]); assert.ok(jpg.length < 250e3);
  }
});

test("film — where it is shown : the showcase page without a script, the home screen in a dialog", () => {
  const page = read("web/vitrine.html"), home = read("web/js/modules/home.js"), css = read("web/css/vitrine.css");
  assert.match(page, /Content-Security-Policy" content="default-src 'none';[^"]*media-src 'self'/);
  const players = page.match(/<video [^>]*>/g) || []; assert.equal(players.length, LANGS.length);
  for (const v of players) { assert.match(v, /controls/); assert.match(v, /preload="none"/); assert.match(v, /poster="video\/designwizard_(fr|en)\.jpg"/); }      // nothing of a film is loaded before someone asks for it
  for (const l of LANGS) {
    assert.ok(page.includes(`<source src="video/designwizard_${l}.mp4" type="video/mp4">`), l); assert.ok(page.includes(SLOGANS.open[l]), `the slogan, ${l}`);
    for (const c of CUES) assert.ok(page.includes(`<li>${c[l]}</li>`), `the page gives the narration as text : « ${c[l]} »`);
  }
  assert.ok(page.includes('href="#film"') && page.includes('id="film"')); assert.match(css, /\bvideo \{[^}]*aspect-ratio: 16 \/ 9/);
  assert.match(home, /import \{ showFilm, filmLength \} from "\.\.\/core\/film\.js"/); assert.match(home, /showFilm\(\)/);
  assert.match(css, /video::cue \{/); assert.match(read("web/css/app.css"), /\.film-video::cue \{/);
  const stage = read("tools/film/film.js"), style = read("tools/film/film.css"), app = read("web/css/app.css");
  for (const cls of stage.match(/"fm-[a-z]+"/g).map((x) => x.slice(1, -1))) { assert.ok(style.includes(`.${cls}`), cls); assert.ok(!app.includes(`.${cls}`), `${cls} is the film's alone`); }
});

test("film — a film that speaks : its subtitles stay on with the voice, in the film's language, the other one, both or none", () => {
  assert.deepEqual(subChoices(LANGS), ["fr", "en", "both", "off"]); assert.deepEqual(subChoices(["fr"]), ["fr", "off"], "one language : nothing to combine");
  assert.equal(subDefault("fr", LANGS), "fr", "what is said is what is read"); assert.equal(subDefault("en", LANGS), "en"); assert.equal(subDefault("de", LANGS), "fr"); assert.equal(subDefault("fr", []), "off");
  assert.deepEqual(subModes("fr", LANGS), { fr: "showing", en: "disabled" }); assert.deepEqual(subModes("en", LANGS), { fr: "disabled", en: "showing" }, "listen in French, read in English");
  assert.deepEqual(subModes("both", LANGS), { fr: "showing", en: "showing" }); assert.deepEqual(subModes("off", LANGS), { fr: "disabled", en: "disabled" });
  for (const c of subChoices(LANGS)) assert.equal(subChoice(subModes(c, LANGS), LANGS), c, `${c} : read back from the tracks`);
  assert.equal(subChoice({ fr: "hidden", en: "showing" }, LANGS), "en", "a track loaded but not drawn is not shown"); assert.equal(subChoice({ fr: "hidden", en: "hidden" }, LANGS), "off");
  for (const l of LANGS) { assert.equal(filmNote(l, false), FILM.silent[l]); assert.equal(filmNote(l, true), FILM.spoken[l]); assert.notEqual(FILM.spoken[l], FILM.silent[l]); }
  assert.equal(filmNote("de", true), FILM.spoken.fr); assert.equal(filmNote("fr"), FILM.voice ? FILM.spoken.fr : FILM.silent.fr);
  assert.equal(subName("fr", "en"), "Français"); assert.equal(subName("en", "fr"), "English"); assert.equal(subName("both", "fr"), "Les deux"); assert.equal(subName("off", "en"), "None"); assert.equal(subName("both", "de"), "Les deux");
  for (const l of LANGS) for (const w of ["voice", "subs", "both", "off"]) assert.ok(FILM.words[l][w].length > 2, `${l}.${w}`);
  assert.ok(!/^import /m.test(read("web/js/core/captions.js")), "the rule stands alone : the showcase page loads nothing else of the application");
  assert.deepEqual(read("web/js/vitrine.js").match(/^import .*$/gm), ['import { subsBox } from "./core/captions.js";']);
  /* the choice next to a player : the buttons set the tracks, and a change made from the player's own menu comes back to the buttons */
  const on = {}, track = (language) => ({ kind: "subtitles", language, mode: "disabled" }), list = [track("fr"), track("en"), { kind: "metadata", language: "fr", mode: "hidden" }];
  list.addEventListener = (n, f) => { on[`tracks ${n}`] = f; };
  const video = { textTracks: list, addEventListener: (n, f) => { on[n] = f; } }, radios = subChoices(LANGS).map((value) => ({ value, checked: false, addEventListener(n, f) { this.fire = f; } }));
  const modes = () => list.slice(0, 2).map((t) => t.mode).join(" "), checked = () => radios.filter((r) => r.checked).map((r) => r.value).join(" ");
  assert.deepEqual(Object.keys(subTracks(video)), ["fr", "en"], "only the subtitle tracks");
  const box = subsBox(video, radios, "fr"); assert.equal(modes(), "showing disabled", "the film's language from the start — with the voice, nothing waits for the sound to go off"); assert.equal(checked(), "fr"); assert.equal(list[2].mode, "hidden", "a track that is not subtitles is left alone");
  radios[2].checked = true; radios[2].fire(); assert.equal(modes(), "showing showing", "both at once"); assert.equal(box.now(), "both"); assert.equal(checked(), "both");
  radios[1].checked = true; radios[1].fire(); assert.equal(modes(), "disabled showing", "the other language"); radios[3].checked = true; radios[3].fire(); assert.equal(modes(), "disabled disabled", "none");
  list[0].mode = "showing"; on["tracks change"](); assert.equal(box.now(), "fr", "turned on from the player's own menu"); assert.equal(checked(), "fr", "… and the buttons say so");
  box.set("en"); assert.equal(modes(), "disabled showing"); assert.equal(checked(), "en"); list[1].mode = "disabled"; on.loadedmetadata(); assert.equal(modes(), "disabled showing", "a new film loaded in the player keeps the choice");
  const app = read("web/js/core/film.js"); assert.match(app, /for \(const l of FILM\.langs\) video\.append\(el\("track", \{ kind: "subtitles", srclang: l,/, "the dialog : a track per language on the one player");
  assert.match(app, /subs\.now\(\) === subDefault\(now\.lang, FILM\.langs\)\) subs\.set\(subDefault\(l, FILM\.langs\)\)/, "subtitles that followed the voice follow it to the other language ; a choice of the viewer stays");
  assert.ok(!/muted|volume/.test(read("web/js/core/captions.js").replace(/\/\*[\s\S]*?\*\//g, "")), "the sound of the player no longer decides anything");
});

test("film — one state at a time : silent with its narration drawn and a page without a script, or speaking with the subtitle tracks of both languages on every player", () => {
  const page = read("web/vitrine.html"), tracks = page.match(/<track [^>]*>/g) || [], csp = page.match(/Content-Security-Policy" content="([^"]*)"/)[1];
  if (!FILM.voice) {
    assert.ok(!/<script/i.test(page), "silent : the showcase page stays without a script"); assert.equal(tracks.length, 0, "silent : the narration is in the picture, a track would write it twice");
    assert.ok(!/script-src/.test(csp)); assert.ok(page.includes("Sans son") && page.includes("No sound yet"), "the page says the film is silent"); assert.ok(!page.includes('class="subs"'), "silent : no subtitles to choose");
  } else {
    const players = page.split("<video ").slice(1).map((p) => p.split("</video>")[0]); assert.equal(players.length, LANGS.length);
    players.forEach((p, i) => {
      const own = LANGS[i], mine = p.match(/<track [^>]*>/g) || []; assert.equal(mine.length, LANGS.length, `the ${own} player carries the subtitles of every language`);
      for (const l of LANGS) assert.ok(p.includes(`<track kind="subtitles" srclang="${l}" label="${FILM.names[l]}" src="video/designwizard_${l}.vtt"${l === own ? " default" : ""}>`), `the ${own} player : its ${l} track${l === own ? ", shown from the start even without the script" : ""}`);
    });
    assert.equal(tracks.length, LANGS.length * LANGS.length); assert.equal(tracks.filter((t) => /\bdefault\b/.test(t)).length, LANGS.length, "one track on by itself per player : its own language");
    assert.deepEqual(page.match(/<script[^>]*>/gi), ['<script type="module" src="js/vitrine.js">'], "one script, the house's own"); assert.match(csp, /script-src 'self'/); assert.ok(!/unsafe|https?:/.test(csp));
    assert.ok(!page.includes("Sans son") && !page.includes("No sound") && !page.includes("sans script") && !page.includes('class="mute"'), "the page no longer says the film is silent, nor that the subtitles wait for the sound to go off");
    const boxes = page.match(/<\/video>\n  <div class="subs" role="radiogroup" aria-label="(Sous-titres|Subtitles)" hidden><span>\1<\/span>\n(    <label><input type="radio" name="subs-(fr|en)" value="(fr|en|both|off)"( checked)?> [^<]+<\/label>\n){4}  <\/div>/g) || [];
    assert.equal(boxes.length, LANGS.length, "the choice of subtitles under each player, hidden until the script makes it work");
    boxes.forEach((b, i) => { assert.equal((b.match(/ checked/g) || []).length, 1); assert.ok(b.includes(`name="subs-${LANGS[i]}" value="${LANGS[i]}" checked`), `${LANGS[i]} : the film's own language is the one checked`); assert.equal(new Set(b.match(/value="[a-z]+"/g)).size, 4); });
    const css = read("web/css/vitrine.css"); assert.match(css, /\.subs:not\(\[hidden\]\) \{/, "the choice stays hidden without the script"); assert.ok(!/\.mute\b/.test(css));
    assert.match(read("web/css/app.css"), /\.film-subs \{/); assert.ok(!/film-mute/.test(read("web/css/app.css") + read("web/js/core/film.js")));
  }
});
