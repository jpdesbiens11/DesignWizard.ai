/* DynamiteOrbit — the pictures of the photo studio, taken by the application itself : one demonstration in each set, each
   picture made by the button « Faire l'image » of the screen — refined, with the mark of the platform — and saved under
   « <Produit>_<décor>_<AAAA-MM-JJ>.png ». Not part of the application and not run by the tests : it needs Playwright and a
   running local server.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/photo_shots.mjs http://127.0.0.1:8130 <output folder> [--sets desert,city,…] [--quality draft|fine|max] [--size hd|square|portrait|wide|uhd]
                                [--shot road|hero|…] [--demo rover|rocket|drive] [--date AAAA-MM-JJ] [--render '<json merged into the render>']
   Without a graphics card (a container, a CI machine) the browser draws by software : a refined picture then takes minutes,
   not a second — « draft » is the quality to ask for there. See docs/MARKETING.md. */
import { createRequire } from "node:module"; import { mkdirSync } from "node:fs";
import { SETS } from "../web/js/core/photo_sets.js";
const { chromium } = createRequire(import.meta.url)("playwright");
const args = process.argv.slice(2), base = args[0], out = args[1], opt = (k, d) => { const i = args.indexOf(`--${k}`); return i > 0 && args[i + 1] ? args[i + 1] : d; };
if (!base || !out) { console.error("usage : node tools/photo_shots.mjs <base url> <output dir> [--sets a,b] [--quality draft] [--size hd] [--shot road] [--demo rover] [--date AAAA-MM-JJ] [--render '{…}']"); process.exit(2); }
const DEMOS = { rover: { pick: '[data-example="rover"]', asm: "RVR-ASM", name: "Rover" }, rocket: { pick: '[data-example="rocket"]', asm: "FUS-ASM", name: "Fusee" }, drive: { pick: null, asm: "DRV-ASM", name: "Variateur" } };
const demo = DEMOS[opt("demo", "rover")] || DEMOS.rover, sets = opt("sets", Object.keys(SETS).join(",")).split(",").filter((s) => SETS[s]), quality = opt("quality", "draft"), size = opt("size", "hd"), shot = opt("shot", "road"), date = opt("date", new Date().toISOString().slice(0, 10)), more = JSON.parse(opt("render", "{}"));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), page = await (await browser.newContext({ viewport: { width: 1500, height: 900 }, locale: "fr-CA", acceptDownloads: true })).newPage(), wait = (ms) => page.waitForTimeout(ms);
const errors = []; page.on("pageerror", (e) => errors.push(String(e.stack || e).slice(0, 300)));
await page.goto(base + "/#/home"); await page.waitForSelector(".hero");
if (demo.pick) await page.locator(demo.pick).first().click(); else await page.getByRole("button", { name: /Charger la démonstration/ }).first().click();
await wait(2500); if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button", { name: /neuve|Ouvrir/ }).first().click().catch(() => {}); await wait(1500); }
const ready = () => page.waitForFunction(() => { const v = document.querySelector(".rd-view"), s = v && v._stage; return s && s.items.size > 0 && !s.dirty && !s.skyStale && s.refined >= 1; }, null, { timeout: 900000, polling: 400 });
let first = true;
for (const scene of sets) {
  const t0 = Date.now();
  await page.evaluate(async ([id, render]) => { const { store } = await import("./js/core/store.js"); store.updateAssembly(id, (a) => { a.render = { ...(a.render || {}), lights: null, setup: null, ambient: null, view: null, ...render }; }, "Séance photo"); }, [demo.asm, { scene, shot, size, quality, ...more }]);
  if (first) { await page.goto(`${base}/#/render/${demo.asm}`); first = false; }
  await page.waitForSelector("[data-shoot]"); await wait(1200); await ready();
  const dl = page.waitForEvent("download", { timeout: 3600000 }); await page.locator("[data-shoot]").evaluate((b) => b.click()); const file = await dl, name = `${demo.name}_${SETS[scene].fr.replace(/\s*—\s*/g, "-").replace(/\s+/g, "-")}_${date}.png`;
  await file.saveAs(`${out}/${name}`); console.log(`${name} — ${Math.round((Date.now() - t0) / 1000)} s`);
}
if (errors.length) console.log("errors :", [...new Set(errors)].slice(0, 5).join(" || "));
await browser.close();
