/* The film of the platform : its timeline (tools/film/script.mjs), the files the site publishes (web/video), the pages that show them. */
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs"; import { fileURLToPath } from "node:url";
import { SCENES, CUES, DURATION, FPS, LANGS, SLOGANS, sceneAt, cueAt, pace, toVtt, toScript, roomOf, fitLine, MAX_TEMPO } from "../../tools/film/script.mjs";
import { FILM, filmFiles, filmLength, filmLang, filmNote } from "../../web/js/core/film.js";
import { wantCaptions, captionMode, muteBox } from "../../web/js/core/captions.js";

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
    assert.ok(s.chips.length >= 2 && s.chips.length <= 3, s.id);
    for (const c of s.chips) { both(c, `${s.id} chip`); assert.ok(c.at > 0 && c.at < len - 2, `${s.id} : « ${c.fr} » has time to be read`); assert.ok(c.fr.length <= 40 && c.en.length <= 40, c.fr); }
  }
});

test("film — the narration : one breath after another, sayable, and it says the two slogans", () => {
  assert.ok(CUES.length >= 18);
  CUES.forEach((c, i) => {
    both(c, `cue ${i + 1}`); assert.ok(c.t0 >= 0 && c.t1 <= DURATION && c.t1 - c.t0 >= 2, `cue ${i + 1}`);
    if (i) assert.ok(c.t0 >= CUES[i - 1].t1 + 0.15, `cue ${i + 1} leaves a breath after the one before`);
    for (const l of LANGS) assert.ok(pace(c, l) <= 3, `cue ${i + 1} (${l}) : ${pace(c, l).toFixed(2)} words a second`);
    assert.ok(sceneAt(c.t0) === sceneAt(c.t1 - 0.01), `cue ${i + 1} stays in its scene`);
  });
  for (const l of LANGS) { const all = CUES.map((c) => c[l]).join(" "); assert.ok(all.includes(SLOGANS.open[l]), l); assert.ok(all.includes(SLOGANS.close[l]), l); assert.ok(all.includes("DesignWizard.ai")); }
  assert.equal(cueAt(1).fr, CUES[0].fr); assert.equal(cueAt(CUES[0].t1 + 0.05), null); assert.equal(cueAt(DURATION + 1), null);
  const words = (l) => CUES.reduce((n, c) => n + c[l].trim().split(/\s+/).length, 0);
  assert.ok(words("fr") > 150 && words("fr") < 330 && words("en") > 150 && words("en") < 330, "a narration of two and a half minutes");
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
  assert.equal(blocks[1], `1\n00:00:00.600 --> 00:00:05.200\n${CUES[0].fr}`);
  for (const b of blocks.slice(1)) assert.match(b, /^\d+\n\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}\n\S/);
  assert.match(toScript("en"), /^# DesignWizard\.ai — video narration\n\nLength: 2 min 33 s\./); assert.ok(toScript("fr").includes(`**00:00.6 → 00:05.2** ${CUES[0].fr}`));
  for (const l of LANGS) { assert.equal(read(`web/video/designwizard_${l}.vtt`), toVtt(l), `web/video/designwizard_${l}.vtt is out of date : render the film again`); assert.equal(read(`docs/film/narration_${l}.md`), toScript(l), `docs/film/narration_${l}.md is out of date`); }
});

test("film — the files the site publishes : an MP4 of the length of the timeline, ready to play before it is all loaded, and light", () => {
  assert.equal(FILM.seconds, DURATION); assert.deepEqual(FILM.langs, LANGS); assert.equal(filmLength(), "2 min 33"); assert.equal(filmLength(125), "2 min 05");
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

test("film — a film that speaks : no subtitles while it is heard, subtitles as soon as the sound of the player is off", () => {
  assert.equal(wantCaptions({ muted: false, volume: 1 }), false, "heard : no subtitles"); assert.equal(wantCaptions({ muted: false, volume: 0.05 }), false);
  assert.equal(wantCaptions({ muted: true, volume: 1 }), true, "muted"); assert.equal(wantCaptions({ muted: false, volume: 0 }), true, "volume at zero");
  assert.equal(wantCaptions(null), false); assert.equal(wantCaptions({ muted: false }), true, "a player that does not say its volume is taken as silent");
  assert.equal(captionMode({ muted: true, volume: 1 }), "showing"); assert.equal(captionMode({ muted: false, volume: 0.6 }), "hidden", "loaded, not drawn : the viewer's own button still turns them on");
  for (const l of LANGS) { assert.equal(filmNote(l, false), FILM.silent[l]); assert.equal(filmNote(l, true), FILM.spoken[l]); assert.notEqual(FILM.spoken[l], FILM.silent[l]); }
  assert.equal(filmNote("de", true), FILM.spoken.fr); assert.equal(filmNote("fr"), FILM.voice ? FILM.spoken.fr : FILM.silent.fr);
  assert.ok(!/^import /m.test(read("web/js/core/captions.js")), "the rule stands alone : the showcase page loads nothing else of the application");
  assert.deepEqual(read("web/js/vitrine.js").match(/^import .*$/gm), ['import { followSound, muteBox } from "./core/captions.js";']);
  /* the « no sound » box : it mutes the player, and follows the player's own mute button */
  const on = {}, video = { muted: false, addEventListener: (n, f) => { on[n] = f; } }, input = { checked: true, addEventListener: (n, f) => { on[`box ${n}`] = f; } };
  muteBox(video, input); assert.equal(input.checked, false, "a player that is heard : the box is not checked");
  input.checked = true; on["box change"](); assert.equal(video.muted, true, "checked : the player is muted"); assert.equal(wantCaptions({ ...video, volume: 1 }), true, "… and its subtitles show");
  input.checked = false; on["box change"](); assert.equal(video.muted, false); video.muted = true; on.volumechange(); assert.equal(input.checked, true, "muted from the player : the box says so");
  for (const l of LANGS) assert.ok(FILM.mute[l].length > 3);
  assert.match(read("web/js/core/film.js"), /FILM\.voice \? el\("track", \{ kind: "subtitles" \}\) : null/);
});

test("film — one state at a time : silent with its narration drawn and a page without a script, or speaking with a subtitle track on every player", () => {
  const page = read("web/vitrine.html"), tracks = page.match(/<track [^>]*>/g) || [], csp = page.match(/Content-Security-Policy" content="([^"]*)"/)[1];
  if (!FILM.voice) {
    assert.ok(!/<script/i.test(page), "silent : the showcase page stays without a script"); assert.equal(tracks.length, 0, "silent : the narration is in the picture, a track would write it twice");
    assert.ok(!/script-src/.test(csp)); assert.ok(page.includes("Sans son") && page.includes("No sound yet"), "the page says the film is silent"); assert.ok(!page.includes('class="mute"'), "silent : nothing to mute");
  } else {
    for (const l of LANGS) assert.ok(page.includes(`<track kind="subtitles" srclang="${l}" label="${FILM.names[l]}" src="video/designwizard_${l}.vtt">`), `the ${l} player has its subtitle track`);
    assert.equal(tracks.length, LANGS.length); assert.ok(tracks.every((t) => !/\bdefault\b/.test(t)), "no track is on by itself : the sound decides");
    assert.deepEqual(page.match(/<script[^>]*>/gi), ['<script type="module" src="js/vitrine.js">'], "one script, the house's own"); assert.match(csp, /script-src 'self'/); assert.ok(!/unsafe|https?:/.test(csp));
    assert.ok(!page.includes("Sans son pour l'instant") && !page.includes("No sound yet") && !page.includes("sans script"), "the page no longer says the film is silent, nor that it has no script");
    const boxes = page.match(/<\/video>\n  <label class="mute" hidden><input type="checkbox"> (Sans son|No sound) <small>[^<]+<\/small><\/label>/g) || []; assert.equal(boxes.length, LANGS.length, "a « no sound » box under each player, hidden until the script makes it work");
    assert.match(read("web/css/vitrine.css"), /\.mute:not\(\[hidden\]\) \{/, "the box stays hidden without the script");
  }
});
