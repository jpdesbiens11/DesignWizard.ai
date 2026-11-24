/* DynamiteOrbit.ai — the rocket of the marketing material (JP, 24 November : « la fusée en vue iso… seulement une partie du bout
   de la tuyère et des ailerons avec un peu de la coque… ça va faire encore plus "on bâtit la fusée en plein vol" » ; view chosen
   by JP from a menu : seen from below, climbing to the right like the rocket of the logo).
   It is the example rocket of the tool (web/js/demo/demo_rocket.js) in its Assembly screen : nothing is drawn by hand.
   Not part of the application and not run by the tests : it needs Playwright and a running local server.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/marketing_rocket.mjs http://127.0.0.1:8130
   Writes web/img/tour/fusee.jpg (the screen, 1600 × 1000, like the other pictures of the tour) and web/img/marketing/fusee.png
   (the view alone, transparent, trimmed — for the sheet, the presentation, the showcase page and the film). */

import { createRequire } from "node:module"; import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2];
if (!base) { console.error("usage : node tools/marketing_rocket.mjs <base url>"); process.exit(2); }
/** The view : centre of the frame on the axis (mm from the nozzle exit), its span (mm), azimuth, elevation and roll (degrees). */
export const ROCKET_VIEW = { z: 550, span: 1150, az: -40, el: -30, roll: 35 };
const root = new URL("..", import.meta.url), running = JSON.parse(readFileSync(new URL("web/version.json", root), "utf8")).version;
const shoot = async (scale) => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale });
  await ctx.addInitScript((v) => { try { localStorage.setItem("dw.news.review", JSON.stringify({ base: v, seen: {} })); } catch (e) { /* the marks stay */ } }, running);      // a picture shows the screens, not the « Nouveau » marks of a review
  const p = await ctx.newPage(), wait = (ms) => p.waitForTimeout(ms), errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(`${base}/#/home`); await p.waitForSelector(".hero"); await p.locator('[data-example="rocket"]').first().click(); await wait(1500);
  if (await p.locator(".modal").count()) { await p.locator(".modal").getByRole("button").first().click(); await wait(1200); }
  await p.goto(`${base}/#/assembly/FUS-ASM`);
  for (let i = 0; i < 300; i++) { await wait(200); if (i > 10 && !(await p.locator(".view-busy:not(.hidden)").count())) break; }
  await wait(2500); await p.mouse.move(1430, 640);      // off the view : its edge band stays dark
  const png = await p.evaluate(async (V) => {
    const v = [...document.querySelectorAll("*")].find((n) => n._viewer)._viewer, rad = Math.PI / 180;
    v.view("iso"); v.dir.set(Math.cos(V.el * rad) * Math.cos(V.az * rad), Math.cos(V.el * rad) * Math.sin(V.az * rad), Math.sin(V.el * rad)).normalize();
    const d = v.dir, rn = Math.hypot(d.y, d.x) || 1, r = V.roll * rad;
    v.camera.up.set(Math.sin(r) * d.y / rn, -Math.sin(r) * d.x / rn, Math.cos(r));
    v.focus([0, 0, V.z], V.span); v.invalidate();
    [...document.querySelectorAll("body *")].filter((n) => /^Volumes communs/.test(n.textContent.trim()) && n.children.length < 3).forEach((n) => { n.style.display = "none"; });
    await new Promise((ok) => setTimeout(ok, 1500));
    /* the view alone, trimmed to what is drawn */
    const img = new Image(); img.src = v.snapshot(); await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const t = document.createElement("canvas"); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1; t.getContext("2d").drawImage(c, -x0, -y0);
    return t.toDataURL("image/png");
  }, ROCKET_VIEW);
  await wait(800);
  return { p, b, png, errors };
};
const one = await shoot(1);
mkdirSync(new URL("web/img/marketing/", root), { recursive: true });
await one.p.screenshot({ path: new URL("web/img/tour/fusee.jpg", root).pathname, type: "jpeg", quality: 82 });
await one.b.close();
const two = await shoot(2);      // the view alone, twice as fine : it is printed on the sheet and shown large in the film
writeFileSync(new URL("web/img/marketing/fusee.png", root), Buffer.from(two.png.split(",")[1], "base64"));
await two.b.close();
console.log("web/img/tour/fusee.jpg, web/img/marketing/fusee.png", [...one.errors, ...two.errors].length ? "errors : " + [...one.errors, ...two.errors].join(" | ") : "errors : none");
