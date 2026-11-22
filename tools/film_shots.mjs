/* DynamiteOrbit — the clips of the film, shot on the running application : frames of the real screens while something moves.
   Not part of the application and not run by the tests : it needs Playwright and a running local server on an empty data folder.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/film_shots.mjs http://127.0.0.1:8130 <clips folder> [names, comma separated]
   Three clips, each a folder of numbered JPEG frames (1600 × 1000, the size of the pictures of the guided tour) and a line in clips.json :
     rover    — the Rover, put together by modules, turning, opening into its exploded view — the blocks, then their parts — and closing again ;
     stepper  — a parameter of a part going up under a held arrow, faster and faster, while the part follows ;
     variants — a part that keeps three cousins under a name : a click on a name, and the whole part follows.
   The film itself is drawn by tools/film/ and rendered by tools/film_render.mjs. */

import { createRequire } from "node:module"; import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs"; import { join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], out = process.argv[3], only = process.argv[4] ? process.argv[4].split(",") : null, want = (n) => !only || only.includes(n);
if (!base || !out) { console.error("usage : node tools/film_shots.mjs <base url> <clips folder> [names]"); process.exit(2); }
const browser = await chromium.launch(), errors = [], page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const wait = (ms) => page.waitForTimeout(ms), meta = existsSync(join(out, "clips.json")) ? JSON.parse(readFileSync(join(out, "clips.json"), "utf8")) : {}, name = (i) => `${String(i + 1).padStart(4, "0")}.jpg`;
const shoot = async (dir, i) => page.screenshot({ path: join(out, dir, name(i)), type: "jpeg", quality: 88 });
const demo = async (pick) => { await page.goto(`${base}/#/home`); await page.waitForSelector(".hero"); const b = await pick(); await b.scrollIntoViewIfNeeded(); await b.click(); await wait(1500);
  if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button", { name: /neuve|Ouvrir/ }).first().click(); await wait(1200); } };
const idle = async () => { for (let i = 0; i < 400; i++) { await wait(150); if (!(await page.locator(".view-busy:not(.hidden)").count()) && i > 6) return; } };

/* ---------- the Rover : a turn, an exploded view, back together ---------- */
if (want("rover")) {
mkdirSync(join(out, "rover"), { recursive: true });
await demo(() => page.locator('[data-example="rover"]').first()); await page.goto(`${base}/#/assembly/RVR-ASM`); await idle(); await wait(2500); await page.mouse.move(2, 520);      // off the view : its edge band lights up under the pointer
const N = 198;
const far = await page.evaluate(() => { const v = [...document.querySelectorAll("*")].find((n) => n._viewer)._viewer; v.view("iso"); v.fit(1.75); const b = v.bbox(), s = b.max.clone().sub(b.min); window.__film = { v, d: v.dir.clone(), k: Math.max(25, (s.z + s.x) * 0.22) }; return window.__film.k; });
for (let i = 0; i < N; i++) {
  await page.evaluate(([k, n]) => { const { v, d, k: K } = window.__film, x = k / (n - 1), a = Math.atan2(d.y, d.x) - x * 2.3, h = Math.hypot(d.x, d.y), e = x < 0.3 ? 0 : x > 0.9 ? 0 : Math.sin(((x - 0.3) / 0.6) * Math.PI) ** 2;
    v.dir.set(Math.cos(a) * h, Math.sin(a) * h, d.z).normalize(); v.setExplode(K * e); v.invalidate(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, [i, N]);
  await shoot("rover", i);
}
meta.rover = { n: N, note: `orbit and exploded view of the Rover by modules, explode up to ${Math.round(far)} mm` }; console.log("rover :", N, "frames");
}

/* ---------- a parameter under a held arrow ---------- */
if (want("stepper")) {
mkdirSync(join(out, "stepper"), { recursive: true });
await demo(() => page.getByRole("button", { name: /Charger la démonstration/ }).first()); await page.goto(`${base}/#/parts/DRV-BASE`); await idle(); await wait(2500);
const field = page.locator('#main .param input[type="number"]').first(); await field.hover(); await wait(400);
const box = await page.locator("#num-stepper .ns-up").boundingBox(), from = await field.inputValue(); let n = 0;
for (let i = 0; i < 8; i++) await shoot("stepper", n++);                                    // a beat before the arrow is pressed
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
const t0 = Date.now(); while (Date.now() - t0 < 4300) await shoot("stepper", n++);          // held : ×1, ×2, ×5, ×10
await page.mouse.up(); for (let i = 0; i < 26; i++) { await wait(60); await shoot("stepper", n++); }      // released : the part settles
meta.stepper = { n, note: `first parameter of DRV-BASE from ${from} to ${await field.inputValue()} under a held arrow` }; console.log("stepper :", n, "frames,", meta.stepper.note);
}

/* ---------- a family in one part : three cousins under a name, a click on each ---------- */
if (want("variants")) {
  mkdirSync(join(out, "variants"), { recursive: true });
  await demo(() => page.getByRole("button", { name: /Charger la démonstration/ }).first());
  /* the cousins of the base of the drive : as it is, longer, and without the window of its heat sink */
  const kept = await page.evaluate(async () => {
    const { store } = await import("./js/core/store.js"), { keepVariant, variantOf } = await import("./js/core/variants.js");
    const s = store.part("DRV-BASE"), now = variantOf(s), [k, v] = Object.entries(now.params).find(([, x]) => typeof x === "number" && x >= 100), win = (s.features || []).find((f) => f.id === "window");
    store.updatePart("DRV-BASE", (x) => { x.variants = keepVariant(x, "Standard"); x.variants.push({ name: "Longue", off: [], params: { ...now.params, [k]: Math.round(v * 1.25) } }); if (win) x.variants.push({ name: "Sans fenêtre", off: [win.id], params: { ...now.params } }); }, "film : trois variantes");
    return store.part("DRV-BASE").variants.map((x) => x.name);
  });
  await page.goto(`${base}/#/parts/DRV-BASE`); await idle(); await wait(2500);
  const left = page.locator(".side:not(.right)").first(), group = (t) => left.locator(".side-section > h3", { hasText: t }).first();
  for (const t of ["Pièces", "Arbre de construction"]) { await group(t).click().catch(() => {}); await wait(250); }      // folded : the variants come up beside the part
  await group("Variantes").scrollIntoViewIfNeeded(); await page.mouse.move(2, 520); await wait(600);
  let n = 0; const hold = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) await shoot("variants", n++); };
  await hold(900);
  for (const v of [...kept.slice(1), kept[0]]) {      // each cousin in turn, then back to the first
    const row = left.locator(`[data-variant="${v}"]`); await row.hover(); await hold(450); await row.click({ position: { x: 60, y: 14 } }); await hold(2300);
  }
  meta.variants = { n, note: `DRV-BASE through its variants : ${kept.join(", ")}` }; console.log("variants :", n, "frames,", meta.variants.note);
}

writeFileSync(join(out, "clips.json"), JSON.stringify(meta, null, 1));
console.log("errors :", errors.length ? errors.join(" || ") : "none");
await browser.close();
