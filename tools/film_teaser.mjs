/* DesignOrbit.ai — the teaser, made : the shots of tools/film/teaser.mjs cut from a film already rendered (its picture only — the
   voice of the film is left behind), the seven lines of the teaser said by a synthetic voice and laid over, and its subtitles beside
   it. Not part of the application and not run by the tests : it needs ffmpeg, and an ElevenLabs account for the voice.
     node tools/film_teaser.mjs make <voice id> <fr|en> <film.mp4> <out.mp4> [--work folder] [--model id] [--kbps n] [--dry] [--force]
   The film given is the one of the same language : what it writes on screen is in that language. The key is never written here : it
   is read from ELEVENLABS_API_KEY and sent in the « xi-api-key » header ; in a session whose network proxy holds the key, leave the
   variable unset (Node then wants NODE_USE_ENV_PROXY=1). --dry calls nobody : each line is a tone of a plausible length.
   Only the text of the narration goes to ElevenLabs : nothing else of the project leaves. A line longer than its room is sped up, at
   most by MAX_TEMPO ; beyond, the tool says which line to rewrite and stops, unless --force. */

import { spawnSync } from "node:child_process"; import { createHash } from "node:crypto"; import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs"; import { join } from "node:path";
import { DURATION, LANGS, fitLine } from "./film/script.mjs";
import { TEASER_LINES, TEASER_DURATION, teaserSpans, teaserRoom, teaserSrt } from "./film/teaser.mjs";

const API = "https://api.elevenlabs.io", KEY = process.env.ELEVENLABS_API_KEY || "proxy-injected";
const args = process.argv.slice(2), cmd = args[0], rest = args.slice(1).filter((a, i, l) => !a.startsWith("--") && !(l[i - 1] || "").match(/^--(work|model|kbps)$/)), has = (n) => args.includes(n), flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const usage = () => { console.error("usage : node tools/film_teaser.mjs make <voice id> <fr|en> <film.mp4> <out.mp4> [--work folder] [--model id] [--kbps n] [--dry] [--force]"); process.exit(2); };
const run = (bin, a) => { const r = spawnSync(bin, a, { encoding: "utf8", maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`${bin} : ${(r.stderr || "").trim().split("\n").slice(-3).join(" | ")}`); return r.stdout; };
const seconds = (file) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim());
const MODEL = flag("--model", "eleven_multilingual_v2"), SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 };

/** One line said : the file of its sound, trimmed of the silence around it. Kept under a name made of what produced it. */
async function line(voice, lang, i, dir, dry) {
  const text = TEASER_LINES[i][lang], body = { text, model_id: MODEL, voice_settings: SETTINGS, seed: 6150 + i, previous_text: i ? TEASER_LINES[i - 1][lang] : undefined, next_text: i + 1 < TEASER_LINES.length ? TEASER_LINES[i + 1][lang] : undefined };
  if (MODEL !== "eleven_multilingual_v2") body.language_code = lang;
  const id = createHash("sha1").update(JSON.stringify([dry ? "dry" : voice, body])).digest("hex").slice(0, 10), raw = join(dir, `teaser_${lang}_${String(i + 1).padStart(2, "0")}_${id}.mp3`), cut = raw.replace(/\.mp3$/, ".wav");
  if (!existsSync(raw)) {
    if (dry) run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `sine=frequency=${220 + 14 * i}:duration=${(text.trim().split(/\s+/).length / 2.7 + 0.35).toFixed(2)}`, "-af", "volume=0.25", raw]);
    else {
      const r = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { let why = r.statusText; try { const d = (await r.json()).detail; why = d && (d.message || d.status) ? `${d.status || ""} — ${d.message || ""}` : JSON.stringify(d).slice(0, 200); } catch (e) { /* the status says enough */ } throw new Error(`ElevenLabs ${r.status} : ${why}`); }
      writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
    }
  }
  if (!existsSync(cut)) run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.06:start_threshold=-50dB,areverse", "-ar", "44100", "-ac", "1", cut]);
  return cut;
}

if (cmd !== "make") usage();
const [voice, lang, film, out] = rest; if (!voice || !LANGS.includes(lang) || !film || !out) usage();
const dir = flag("--work", join(out, "..", "teaser_work")), dry = has("--dry"), kbps = Number(flag("--kbps", "560")); mkdirSync(dir, { recursive: true });
if (Math.abs(seconds(film) - DURATION) > 0.3) throw new Error(`${film} lasts ${seconds(film).toFixed(1)} s, the timeline of the film ${DURATION} s : the cuts would fall beside their scenes.`);
const spans = teaserSpans(), rows = [];
for (let i = 0; i < TEASER_LINES.length; i++) { const file = await line(voice, lang, i, dir, dry), took = seconds(file), room = teaserRoom(i), fit = fitLine(took, room); rows.push({ n: i + 1, at: TEASER_LINES[i].t0, room: Math.round(room * 100) / 100, took: Math.round(took * 100) / 100, ...fit, file, text: TEASER_LINES[i][lang] }); }
for (const r of rows) console.log(`${String(r.n).padStart(2)}  at ${String(r.at).padStart(5)} s  room ${r.room.toFixed(2).padStart(5)}  said in ${r.took.toFixed(2).padStart(5)}${r.tempo > 1 ? `  ×${r.tempo}` : "       "}${r.ok ? "" : `  TOO LONG by ${r.over} s`}  ${r.text.slice(0, 70)}`);
writeFileSync(join(dir, `teaser_${lang}.json`), JSON.stringify({ voice, model: MODEL, dry, spans, lines: rows.map(({ file, ...r }) => r) }, null, 1));
const late = rows.filter((r) => !r.ok);
if (late.length && !has("--force")) { console.error(`${late.length} line(s) do not fit their time (${late.map((r) => r.n).join(", ")}) : shorten them in tools/film/teaser.mjs, or pass --force to hear it as it is.`); process.exit(1); }
/* the picture : each span of the film, end to end, with a short fade at both ends of the teaser ; the voice : every line at its time */
const T = TEASER_DURATION, n = spans.length;
const video = `${spans.map((s, k) => `[0:v]trim=start=${s.a}:end=${s.b},setpts=PTS-STARTPTS[v${k}]`).join(";")};${spans.map((s, k) => `[v${k}]`).join("")}concat=n=${n}:v=1:a=0,fade=t=in:st=0:d=0.25,fade=t=out:st=${(T - 0.35).toFixed(2)}:d=0.35,format=yuv420p[pic]`;
const audio = `${rows.map((r, k) => `[${k + 1}:a]${r.tempo > 1 ? `atempo=${r.tempo},` : ""}adelay=${Math.round(r.at * 1000)}:all=1[a${k}]`).join(";")};${rows.map((r, k) => `[a${k}]`).join("")}amix=inputs=${rows.length}:normalize=0:dropout_transition=0,apad=whole_dur=${T},atrim=0:${T},loudnorm=I=-16:TP=-1.5:LRA=11[voice]`;
run("ffmpeg", ["-y", "-loglevel", "error", "-i", film, ...rows.flatMap((r) => ["-i", r.file]), "-filter_complex", `${video};${audio}`, "-map", "[pic]", "-map", "[voice]",
  "-c:v", "libx264", "-preset", "slow", "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.5)}k`, "-bufsize", `${kbps * 3}k`, "-r", "24", "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", "-t", String(T), out]);
writeFileSync(out.replace(/\.mp4$/, ".srt"), teaserSrt(lang));
console.log(`${out} — ${seconds(out).toFixed(2)} s, ${(readFileSync(out).length / 1e6).toFixed(2)} MB${dry ? " — DRY : tones, not a voice" : ` — voice ${voice}, model ${MODEL}`} ; subtitles : ${out.replace(/\.mp4$/, ".srt")}`);
