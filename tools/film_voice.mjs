/* DesignOrbit.ai — the voice of the film : each line of the narration (tools/film/script.mjs) said by a synthetic voice, set at its time,
   and laid over the picture. Not part of the application and not run by the tests : it needs ffmpeg, and an ElevenLabs account for the voice.
     node tools/film_voice.mjs voices <fr|en> [--library] [--search words]     the women's voices of the account, or of the shared library
     node tools/film_voice.mjs sample <voice id> <fr|en> <folder>              the first three lines, to listen to before the whole film
     node tools/film_voice.mjs make <voice id> <fr|en> <film without subtitles.mp4> <out.mp4> [--work folder] [--model id] [--dry]
   The key is never written here : it is read from ELEVENLABS_API_KEY and sent in the « xi-api-key » header. In a session whose network
   proxy holds the key, leave the variable unset : the proxy puts the real one in. Behind a proxy, Node wants NODE_USE_ENV_PROXY=1.
   --dry calls nobody : each line is a tone of a plausible length — the timing, the mix and the laying over are tried without a voice.
   Each line is kept in the work folder under a name made of what produced it : a line is asked for once, a changed line again — and
   a line said later because others were added before it keeps its recording (its `take`, in the timeline).
   A line longer than its room (to a breath before the next one) is sped up, at most by MAX_TEMPO ; beyond, the tool says which line to
   rewrite and stops, unless --force. The narration is text sent to ElevenLabs : nothing else of the project leaves. */

import { spawnSync } from "node:child_process"; import { createHash } from "node:crypto"; import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs"; import { join } from "node:path";
import { CUES, DURATION, LANGS, roomOf, fitLine } from "./film/script.mjs";

const API = "https://api.elevenlabs.io", KEY = process.env.ELEVENLABS_API_KEY || "proxy-injected";
const args = process.argv.slice(2), cmd = args[0], rest = args.slice(1).filter((a, i, l) => !a.startsWith("--") && !(l[i - 1] || "").match(/^--(work|model|search)$/)), has = (n) => args.includes(n), flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const usage = () => { console.error("usage : node tools/film_voice.mjs voices <fr|en> [--library] [--search words]\n        node tools/film_voice.mjs sample <voice id> <fr|en> <folder>\n        node tools/film_voice.mjs make <voice id> <fr|en> <film without subtitles.mp4> <out.mp4> [--work folder] [--model id] [--dry] [--force]"); process.exit(2); };
const run = (bin, a) => { const r = spawnSync(bin, a, { encoding: "utf8", maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`${bin} : ${(r.stderr || "").trim().split("\n").slice(-3).join(" | ")}`); return r.stdout; };
const seconds = (file) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim());
async function call(path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { "xi-api-key": KEY, ...(init.headers || {}) } });
  if (!r.ok) { let why = ""; try { const d = (await r.json()).detail; why = d && (d.message || d.status) ? `${d.status || ""} — ${d.message || ""}` : JSON.stringify(d).slice(0, 200); } catch (e) { why = r.statusText; } throw new Error(`ElevenLabs ${r.status} : ${why}`); }
  return r;
}
const MODEL = flag("--model", "eleven_multilingual_v2"), SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 };

/** One line said : the file of its sound, trimmed of the silence around it. */
async function line(voice, lang, i, dir, dry) {
  const k = (CUES[i].take || i + 1) - 1;      // the number the line was first recorded under : a line added before it does not ask for it again
  const text = CUES[i][lang], body = { text, model_id: MODEL, voice_settings: SETTINGS, seed: 5150 + k, previous_text: i ? CUES[i - 1][lang] : undefined, next_text: i + 1 < CUES.length ? CUES[i + 1][lang] : undefined };
  if (MODEL !== "eleven_multilingual_v2") body.language_code = lang;      // the multilingual v2 model reads the language from the text
  const id = createHash("sha1").update(JSON.stringify([dry ? "dry" : voice, body])).digest("hex").slice(0, 10), raw = join(dir, `${lang}_${String(k + 1).padStart(2, "0")}_${id}.mp3`), cut = raw.replace(/\.mp3$/, ".wav");
  if (!existsSync(raw)) {
    if (dry) run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `sine=frequency=${200 + 12 * i}:duration=${(text.trim().split(/\s+/).length / 2.7 + 0.35).toFixed(2)}`, "-af", "volume=0.25", raw]);
    else writeFileSync(raw, Buffer.from(await (await call(`/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).arrayBuffer()));
  }
  if (!existsSync(cut)) run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.06:start_threshold=-50dB,areverse", "-ar", "44100", "-ac", "1", cut]);
  return cut;
}

if (cmd === "voices") {
  const lang = rest[0]; if (!LANGS.includes(lang)) usage();
  const search = flag("--search", ""), q = (o) => Object.entries(o).filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  if (has("--library")) {
    const d = await (await call(`/v1/shared-voices?${q({ gender: "female", language: lang, page_size: 30, sort: "usage_character_count_1y", search })}`)).json();
    console.log(`${d.voices.length} voice(s) of the shared library — women, ${lang} (the most used first). A voice of the library is added to the account before it speaks.`);
    for (const v of d.voices) console.log([v.voice_id, v.name, v.accent, v.age, v.descriptive, v.use_case, v.category, v.free_users_allowed ? "free plan : yes" : "free plan : no", v.preview_url || ""].join(" | "));
  } else {
    const d = await (await call(`/v2/voices?${q({ page_size: 100, search })}`)).json(), speaks = (v) => (v.verified_languages || []).some((x) => x.language === lang);
    const list = d.voices.filter((v) => ((v.labels || {}).gender || "").toLowerCase() === "female").sort((a, b) => speaks(b) - speaks(a));
    console.log(`${list.length} woman's voice(s) in the account, of ${d.voices.length} — those verified in ${lang} first.`);
    for (const v of list) { const l = v.labels || {}; console.log([v.voice_id, v.name, v.category, l.accent, l.age, l.descriptive || l.description, l.use_case, speaks(v) ? `speaks ${lang}` : `${lang} not verified`, v.preview_url || ""].join(" | ")); }
  }
} else if (cmd === "sample") {
  const [voice, lang, dir] = rest; if (!voice || !LANGS.includes(lang) || !dir) usage(); mkdirSync(dir, { recursive: true });
  const parts = []; for (const i of [0, 1, 4]) parts.push(await line(voice, lang, i, dir, has("--dry")));      // the problem in two breaths, then the slogan
  const out = join(dir, `sample_${lang}_${voice}.mp3`);
  run("ffmpeg", ["-y", "-loglevel", "error", ...parts.flatMap((f) => ["-i", f]), "-filter_complex", `${parts.map((f, k) => `[${k}:a]apad=pad_dur=0.45[a${k}]`).join(";")};${parts.map((f, k) => `[a${k}]`).join("")}concat=n=${parts.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11`, "-b:a", "128k", out]);
  console.log(`${out} — ${seconds(out).toFixed(1)} s : « ${[0, 1, 4].map((i) => CUES[i][lang]).join(" » « ")} »`);
} else if (cmd === "make") {
  const [voice, lang, film, out] = rest; if (!voice || !LANGS.includes(lang) || !film || !out) usage();
  const dir = flag("--work", join(out, "..", "voice_work")), dry = has("--dry"); mkdirSync(dir, { recursive: true });
  if (Math.abs(seconds(film) - DURATION) > 0.3) throw new Error(`${film} lasts ${seconds(film).toFixed(1)} s, the timeline ${DURATION} s : render the film again.`);
  const rows = [];
  for (let i = 0; i < CUES.length; i++) { const file = await line(voice, lang, i, dir, dry), took = seconds(file), room = roomOf(i), fit = fitLine(took, room); rows.push({ n: i + 1, at: CUES[i].t0, room: Math.round(room * 100) / 100, took: Math.round(took * 100) / 100, ...fit, file, text: CUES[i][lang] }); }
  for (const r of rows) console.log(`${String(r.n).padStart(2)}  at ${String(r.at).padStart(6)} s  room ${r.room.toFixed(2).padStart(5)}  said in ${r.took.toFixed(2).padStart(5)}${r.tempo > 1 ? `  ×${r.tempo}` : "       "}${r.ok ? "" : `  TOO LONG by ${r.over} s`}  ${r.text.slice(0, 64)}`);
  const late = rows.filter((r) => !r.ok); writeFileSync(join(dir, `voice_${lang}.json`), JSON.stringify({ voice, model: MODEL, dry, lines: rows.map(({ file, ...r }) => r) }, null, 1));
  if (late.length && !has("--force")) { console.error(`${late.length} line(s) do not fit their time (${late.map((r) => r.n).join(", ")}) : shorten them in tools/film/script.mjs, or pass --force to hear it as it is.`); process.exit(1); }
  /* every line at its time, mixed, levelled for the web, then laid over the picture — which is not drawn again */
  const graph = `${rows.map((r, k) => `[${k + 1}:a]${r.tempo > 1 ? `atempo=${r.tempo},` : ""}adelay=${Math.round(r.at * 1000)}:all=1[a${k}]`).join(";")};${rows.map((r, k) => `[a${k}]`).join("")}amix=inputs=${rows.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DURATION},atrim=0:${DURATION},loudnorm=I=-16:TP=-1.5:LRA=11[voice]`;
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", film, ...rows.flatMap((r) => ["-i", r.file]), "-filter_complex", graph, "-map", "0:v", "-map", "[voice]", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", "-t", String(DURATION), out]);
  console.log(`${out} — ${seconds(out).toFixed(2)} s, ${(readFileSync(out).length / 1e6).toFixed(1)} MB${dry ? " — DRY : tones, not a voice" : ` — voice ${voice}, model ${MODEL}`}`);
} else usage();
