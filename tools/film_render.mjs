/* DesignWizard.ai — renders the film : the page tools/film/film.html drawn frame by frame, each frame handed to ffmpeg.
   Not part of the application and not run by the tests : it needs Playwright, ffmpeg and the clips shot by tools/film_shots.mjs.
     node tools/film_render.mjs <clips folder> <output folder> [fr] [en] [--no-captions] [--crf n] [--from s] [--to s] [--poster]
   For each language it writes, in the output folder (web/video for the site) : designwizard_<lang>.mp4 (1280 × 720, H.264, no sound yet),
   designwizard_<lang>.jpg (the picture shown before the film plays) and designwizard_<lang>.vtt (the narration as subtitles) ; and, in
   docs/film, narration_<lang>.md (the script to record).
   --no-captions leaves the subtitles out of the picture, for the day a recorded voice says them ; --crf sets the weight (26 : about 11 MB) ;
   --from and --to render a piece, to look at it ; --poster writes the picture, the subtitles and the narration without drawing the film. The voice is laid over without drawing the film again :
     ffmpeg -i designwizard_fr_sans-sous-titres.mp4 -i voix_fr.wav -c:v copy -c:a aac -b:a 160k -shortest designwizard_fr.mp4 */

import { createRequire } from "node:module"; import { createServer } from "node:http"; import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises"; import { join, resolve, extname, normalize } from "node:path"; import { fileURLToPath } from "node:url";
import { DURATION, FPS, toVtt, toScript, LANGS } from "./film/script.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const args = process.argv.slice(2), flag = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const [clips, out] = args.filter((a) => !a.startsWith("--") && !LANGS.includes(a) && !/^\d+(\.\d+)?$/.test(a)), langs = LANGS.filter((l) => args.includes(l));
if (!clips || !out) { console.error("usage : node tools/film_render.mjs <clips folder> <output folder> [fr] [en] [--no-captions] [--crf n] [--from s] [--to s]"); process.exit(2); }
const repo = resolve(fileURLToPath(new URL("..", import.meta.url))), from = Number(flag("--from") || 0), to = Number(flag("--to") || DURATION), captions = !args.includes("--no-captions"), crf = flag("--crf") || "26";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
/* the film reads three places : the site (its pictures, its colours, its mark), its own folder, and the clips */
const roots = [["/web/", join(repo, "web")], ["/tools/film/", join(repo, "tools", "film")], ["/clips/", resolve(clips)]];
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname), hit = roots.find(([p]) => path.startsWith(p));
  try { if (!hit) throw new Error("outside"); const file = normalize(join(hit[1], path.slice(hit[0].length))); if (!file.startsWith(hit[1])) throw new Error("outside");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }); res.end(await readFile(file)); }
  catch (e) { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const lang of langs.length ? langs : LANGS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/tools/film/film.html?lang=${lang}&scale=0.8${captions ? "" : "&captions=0"}`); await page.waitForFunction(() => window.filmReady === true, null, { timeout: 120000 });
  const part = from > 0 || to < DURATION, still = args.includes("--poster"), file = join(out, `designwizard_${lang}${part ? `_${from}-${to}` : ""}${captions ? "" : "_sans-sous-titres"}.mp4`);
  const t0 = Date.now(), first = Math.round(from * FPS), last = Math.round(to * FPS);
  if (!still) {
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(FPS), file], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((ok, no) => { ff.on("close", (code) => (code === 0 ? ok() : no(new Error(`ffmpeg ended with ${code}`)))); ff.on("error", no); });
    for (let i = first; i < last; i++) {
      await page.evaluate((t) => window.filmSeek(t), i / FPS);
      const shot = await page.screenshot({ type: "jpeg", quality: 93 });
      if (!ff.stdin.write(shot)) await new Promise((r) => ff.stdin.once("drain", r));
      if ((i - first) % (FPS * 15) === 0 && i > first) console.log(`[${lang}] ${Math.round(i / FPS)} s of ${Math.round(to)} — ${Math.round((Date.now() - t0) / 1000)} s elapsed`);
    }
    ff.stdin.end(); await done;
  }
  if (!part) {
    await page.evaluate(async (t) => { await window.filmSeek(t); for (const c of [".caption", ".progress"]) document.querySelector(c).style.visibility = "hidden"; }, 21); await page.screenshot({ path: join(out, `designwizard_${lang}.jpg`), type: "jpeg", quality: 86 });      // the name and its slogan : what shows before the film plays
    await writeFile(join(out, `designwizard_${lang}.vtt`), toVtt(lang)); await mkdir(join(repo, "docs", "film"), { recursive: true }); await writeFile(join(repo, "docs", "film", `narration_${lang}.md`), toScript(lang));
  }
  console.log(`[${lang}] ${still ? "picture, subtitles and narration only" : file} — ${still ? 0 : last - first} frames in ${Math.round((Date.now() - t0) / 1000)} s${errors.length ? ` — page errors : ${errors.join(" || ")}` : ""}`);
  await page.context().close();
}
await browser.close(); server.close();
