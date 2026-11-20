/* DesignWizard.ai — the ergonomics audit : opens every screen of the application at three window sizes (laptop, desk, large)
   on the demonstration project, and lists what gets in the way of reading and clicking — a page that overflows, a text cut
   by an ellipsis, a button with neither name nor tooltip, a target under 22 px, a control cut by the edge of the window, a
   field with no label ; it also counts the drop-down lists of each screen. Not part of the application and not run by the
   tests : it needs Playwright and a running local server.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/ergo_audit.mjs http://127.0.0.1:8130 <output folder> [screens, comma separated]
   It writes report.json and one picture per screen and size in the output folder, and prints a summary. See docs/ERGONOMIE.md. */
import { createRequire } from "node:module"; import { writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], out = process.argv[3], only = process.argv[4] ? process.argv[4].split(",") : null;
if (!base || !out) { console.error("usage : node ergo_audit.mjs <base url> <output dir> [screens]"); process.exit(2); }
const SIZES = [[1366, 768, "portable"], [1600, 1000, "bureau"], [1920, 1080, "grand"]];
const SCREENS = [["home", "#/home", 1500], ["shop", "#/shop", 2000], ["shop-nature", "#/shop/n/molded", 1500], ["shop-new", "#/shop/new", 3500], ["shop-new-all", "#/shop/new/all", 3500], ["shop-ai", "#/shop/ai", 1500], ["interview", "#/interview", 2000], ["interfaces", "#/interfaces", 2500], ["process", "#/process/pliage", 1500], ["extrusion", "#/extrusion", 4000], ["library", "#/library", 2000], ["busbar", "#/busbar", 3000], ["flex", "#/flex", 3000],
  ["parts", "#/parts/DRV-BASE", 9000], ["pcba", "#/pcba", 6000], ["elab", "#/elab", 7000], ["assembly", "#/assembly/DRV-ASM", 11000], ["physics", "#/physics", 2500], ["fea", "#/fea/DRV-BASE", 10000], ["creepage", "#/creepage", 7000], ["dfx", "#/dfx", 9000], ["drawings", "#/drawings/DRV-BASE", 11000],
  ["review", "#/review", 4000], ["mvp", "#/mvp", 3000], ["team", "#/team", 2500], ["plm", "#/plm", 2500], ["report", "#/report", 9000], ["help", "#/help", 1500], ["account", "#/account", 1500]].filter((s) => !only || only.includes(s[0]));
const probe = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
  const where = (e) => { const p = e.closest(".side.right") ? "volet droit" : e.closest(".side") ? "volet gauche" : e.closest(".topbar") ? "barre du haut" : e.closest(".view-tools, .viewport") ? "vue" : e.closest(".modal") ? "fenêtre" : "page"; return p; };
  const name = (e) => (e.getAttribute("aria-label") || e.dataset.tip || e.title || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const res = { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, truncated: [], unnamed: [], small: [], clipped: [], unlabeled: [], selects: 0 };
  const W = innerWidth, H = innerHeight;
  for (const e of document.querySelectorAll("body *")) {
    if (!vis(e) || e.closest("svg") || e.closest(".toasts")) continue;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (e.children.length === 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      if ((s.overflowX === "hidden" || s.textOverflow === "ellipsis") && e.scrollWidth > e.clientWidth + 2 && e.textContent.trim().length > 3 && !e.matches("input, select, textarea")) res.truncated.push(`${where(e)} · ${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""} · « ${e.textContent.replace(/\s+/g, " ").trim().slice(0, 50)} » (${e.clientWidth}/${e.scrollWidth}px)`);
    }
    if (e.matches("button, a[href], [role=button]")) {
      if (!name(e)) res.unnamed.push(`${where(e)} · ${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")}`);
      else if (!e.textContent.trim() && !e.getAttribute("aria-label") && !e.dataset.tip && !e.title) res.unnamed.push(`${where(e)} · icône seule ${String(e.className).split(" ").slice(0, 2).join(".")}`);
      if ((r.width < 22 || r.height < 22) && r.top >= 0 && r.top < H && !e.closest("p, li, small, td")) res.small.push(`${where(e)} · « ${name(e).slice(0, 30)} » ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    if (e.matches("button, input, select, .chip, h1, h2, h3") && r.right > W + 2 && r.left < W && r.top >= 0 && r.top < H && !e.closest(".side-scroll, .table-wrap, .tabs")) res.clipped.push(`${where(e)} · « ${name(e).slice(0, 40)} » dépasse de ${Math.round(r.right - W)}px`);
    if (e.matches("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea") && !e.getAttribute("aria-label") && !e.closest("label") && !(e.id && document.querySelector(`label[for="${e.id}"]`)) && !e.closest(".field")) res.unlabeled.push(`${where(e)} · ${e.tagName.toLowerCase()}${e.type ? "[" + e.type + "]" : ""} ${String(e.className).split(" ")[0]} ${e.placeholder || ""}`.trim());
    if (e.matches("select")) res.selects++;
  }
  for (const k of ["truncated", "unnamed", "small", "clipped", "unlabeled"]) res[k] = [...new Set(res[k])];
  return res;
};
const b = await chromium.launch(), report = [], errors = [];
for (const [w, h, label] of SIZES) {
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); page.on("pageerror", (e) => errors.push(`${label} : ${String(e).slice(0, 160)}`)); page.on("console", (m) => { if (m.type() === "error") errors.push(`${label} : ${m.text().slice(0, 160)}`); });
  const wait = (ms) => page.waitForTimeout(ms);
  await page.goto(base + "/#/home"); await page.waitForSelector(".hero"); await page.getByRole("button", { name: /Charger la démonstration/ }).first().click(); await wait(2000);
  if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button").first().click().catch(() => {}); await wait(1500); }
  for (const [key, hash, ms] of SCREENS) {
    await page.goto(base + "/" + hash); await wait(label === "bureau" ? ms : Math.min(ms, 6000));
    const r = await page.evaluate(probe); report.push({ size: label, w, h, screen: key, ...r });
    if (label !== "bureau") await page.screenshot({ path: `${out}/${key}_${label}.png` });
  }
  await page.context().close();
}
await b.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
const sum = (k) => report.reduce((n, r) => n + (Array.isArray(r[k]) ? r[k].length : r[k] > 2 ? 1 : 0), 0);
console.log("screens × sizes :", report.length, "| page overflow :", sum("overflowX"), "| truncated :", sum("truncated"), "| unnamed :", sum("unnamed"), "| small :", sum("small"), "| clipped :", sum("clipped"), "| unlabeled :", sum("unlabeled"));
for (const r of report) { const n = r.truncated.length + r.unnamed.length + r.small.length + r.clipped.length + r.unlabeled.length + (r.overflowX > 2 ? 1 : 0); if (n) console.log(`${r.screen.padEnd(11)} ${r.size.padEnd(8)} overflow ${String(r.overflowX).padStart(4)} · tronqués ${r.truncated.length} · sans nom ${r.unnamed.length} · petits ${r.small.length} · coupés ${r.clipped.length} · sans étiquette ${r.unlabeled.length} · listes ${r.selects}`); }
console.log("errors :", errors.length ? [...new Set(errors)].slice(0, 8).join(" || ") : "none");
