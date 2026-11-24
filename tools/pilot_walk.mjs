/* DynamiteOrbit.ai — the pilot trial, walked : a robot opens each screen of the path on the demonstration and looks for every word the
   steps name (tools/pilot/content.mjs). A label that changed makes this walk fail — before a tester meets it. Not part of the
   application and not run by the tests : it needs Playwright and a running server.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/pilot_walk.mjs http://127.0.0.1:8130 <output folder> [stations, comma separated] [--width 1366]
   It prints one line per check, writes one picture per station in the output folder, and ends with 1 when a word is missing. */
import { createRequire } from "node:module"; import { mkdirSync } from "node:fs";
import { STATIONS } from "./pilot/content.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; }, plain = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--")), [base, out, only] = plain;
if (!base || !out) { console.error("usage : node tools/pilot_walk.mjs <base url> <output dir> [stations] [--width 1366]"); process.exit(2); }
mkdirSync(out, { recursive: true }); const width = Number(flag("--width", 1600));
const WAIT = { home: 1500, assembly: 9000, shop: 3000, parts: 8000, physics: 2500, fea: 9000, creepage: 6000, pcba: 5000, elab: 6000, drawings: 9000, dfx: 8000, review: 4000, report: 8000 };
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), page = await (await browser.newContext({ viewport: { width, height: Math.round(width * 0.6) }, locale: "fr-CA" })).newPage(), wait = (ms) => page.waitForTimeout(ms);
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 240)));
/* everything a person can read or be told on the screen : texts, tooltips, names, the choices of a menu */
const onScreen = () => page.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, out = [];
  for (const e of document.querySelectorAll("body *")) { if (!vis(e)) continue; for (const a of ["aria-label", "data-tip", "title", "placeholder"]) { const v = e.getAttribute(a); if (v) out.push(v); } if (e.tagName === "SELECT") out.push(e.textContent); else for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) out.push(n.textContent); }
  return out.join(" \n ").replace(/\s+/g, " ").toLowerCase(); });
await page.goto(base + "/#/home"); await page.waitForSelector(".hero");
let missing = 0, done = 0;
for (const [i, s] of STATIONS.entries()) { if (only && !only.split(",").includes(s.id)) continue;
  for (const c of s.checks) {
    if (c.go) { if (c.go !== "#/home" && !done) { await page.getByRole("button", { name: /Charger la démonstration/ }).first().click(); await wait(3000); if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button", { name: /neuve/ }).first().click().catch(() => {}); await wait(2500); } done = 1; }
      await page.goto(base + "/" + c.go); await wait(WAIT[c.go.slice(2).split("/")[0]] || 3000); }
    if (c.click) { await page.getByText(c.click, { exact: false }).first().click({ timeout: 8000 }).catch((e) => { console.log(`  FAIL ${s.id} : « ${c.click} » cannot be clicked (${String(e.message).split("\n")[0]})`); missing++; }); await wait(2000); }
    const seen = await onScreen(), lost = c.words.filter((w) => !seen.includes(w.replace(/\s+/g, " ").toLowerCase())); missing += lost.length;
    console.log(`${lost.length ? "FAIL" : "ok  "} ${i}. ${s.id} ${c.go || `→ « ${c.click} »`} : ${c.words.length - lost.length} / ${c.words.length}${lost.length ? ` — not on the screen : ${lost.map((w) => `« ${w} »`).join(", ")}` : ""}`); }
  await page.screenshot({ path: `${out}/${String(i).padStart(2, "0")}_${s.id}.png` }); }
console.log(`\n${missing ? `${missing} word(s) missing` : "every word of the path is on its screen"} — window ${width} px ; errors : ${errors.length ? errors.slice(0, 4).join(" | ") : "none"}`);
await browser.close(); process.exit(missing ? 1 : 0);
