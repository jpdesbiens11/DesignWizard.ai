/* DesignWizard.ai — the clips of the film, shot on the running application : frames of the real screens while something moves.
   Not part of the application and not run by the tests : it needs Playwright and a running local server on an empty data folder.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/film_shots.mjs http://127.0.0.1:8130 <clips folder>
   Two clips, each a folder of numbered JPEG frames (1600 × 1000, the size of the pictures of the guided tour) and a line in clips.json :
     rover   — the Rover assembly turning, opening into its exploded view and closing again ;
     stepper — a parameter of a part going up under a held arrow, faster and faster, while the part follows.
   The film itself is drawn by tools/film/ and rendered by tools/film_render.mjs. */

import { createRequire } from "node:module"; import { mkdirSync, writeFileSync } from "node:fs"; import { join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], out = process.argv[3];
if (!base || !out) { console.error("usage : node tools/film_shots.mjs <base url> <clips folder>"); process.exit(2); }
const browser = await chromium.launch(), errors = [], page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const wait = (ms) => page.waitForTimeout(ms), meta = {}, name = (i) => `${String(i + 1).padStart(4, "0")}.jpg`;
const shoot = async (dir, i) => page.screenshot({ path: join(out, dir, name(i)), type: "jpeg", quality: 88 });
const demo = async (pick) => { await page.goto(`${base}/#/home`); await page.waitForSelector(".hero"); const b = await pick(); await b.scrollIntoViewIfNeeded(); await b.click(); await wait(1500);
  if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button", { name: /neuve|Ouvrir/ }).first().click(); await wait(1200); } };
const idle = async () => { for (let i = 0; i < 400; i++) { await wait(150); if (!(await page.locator(".view-busy:not(.hidden)").count()) && i > 6) return; } };

/* ---------- the Rover : a turn, an exploded view, back together ---------- */
mkdirSync(join(out, "rover"), { recursive: true });
await demo(() => page.locator('[data-example="rover"]').first()); await page.goto(`${base}/#/assembly/RVR-ASM`); await idle(); await wait(2500); await page.mouse.move(820, 980);
const N = 150;
const far = await page.evaluate(() => { const v = [...document.querySelectorAll("*")].find((n) => n._viewer)._viewer; v.view("iso"); v.fit(1.75); const b = v.bbox(), s = b.max.clone().sub(b.min); window.__film = { v, d: v.dir.clone(), k: Math.max(25, (s.z + s.x) * 0.22) }; return window.__film.k; });
for (let i = 0; i < N; i++) {
  await page.evaluate(([k, n]) => { const { v, d, k: K } = window.__film, x = k / (n - 1), a = Math.atan2(d.y, d.x) - x * 2.3, h = Math.hypot(d.x, d.y), e = x < 0.3 ? 0 : x > 0.9 ? 0 : Math.sin(((x - 0.3) / 0.6) * Math.PI) ** 2;
    v.dir.set(Math.cos(a) * h, Math.sin(a) * h, d.z).normalize(); v.setExplode(K * e); v.invalidate(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, [i, N]);
  await shoot("rover", i);
}
meta.rover = { n: N, note: `orbit and exploded view, explode up to ${Math.round(far)} mm` }; console.log("rover :", N, "frames");

/* ---------- a parameter under a held arrow ---------- */
mkdirSync(join(out, "stepper"), { recursive: true });
await demo(() => page.getByRole("button", { name: /Charger la démonstration/ }).first()); await page.goto(`${base}/#/parts/DRV-BASE`); await idle(); await wait(2500);
const field = page.locator('#main .param input[type="number"]').first(); await field.hover(); await wait(400);
const box = await page.locator("#num-stepper .ns-up").boundingBox(), from = await field.inputValue(); let n = 0;
for (let i = 0; i < 8; i++) await shoot("stepper", n++);                                    // a beat before the arrow is pressed
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
const t0 = Date.now(); while (Date.now() - t0 < 4300) await shoot("stepper", n++);          // held : ×1, ×2, ×5, ×10
await page.mouse.up(); for (let i = 0; i < 26; i++) { await wait(60); await shoot("stepper", n++); }      // released : the part settles
meta.stepper = { n, note: `first parameter of DRV-BASE from ${from} to ${await field.inputValue()} under a held arrow` }; console.log("stepper :", n, "frames,", meta.stepper.note);

writeFileSync(join(out, "clips.json"), JSON.stringify(meta, null, 1));
console.log("errors :", errors.length ? errors.join(" || ") : "none");
await browser.close();
