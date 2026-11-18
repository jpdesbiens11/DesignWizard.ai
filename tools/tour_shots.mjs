/* DesignWizard.ai — the screenshots of the guided presentation (web/img/tour/*.jpg), taken on the demonstration projects.
   Not part of the application and not run by the tests : it needs Playwright and a running local server.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/tour_shots.mjs http://127.0.0.1:8130 web/img/tour [names, comma separated]
   Each picture is the window of the application, 1600 × 1000, JPEG. Run it again after a release that changes a screen. */

import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], out = process.argv[3], only = process.argv[4] ? process.argv[4].split(",") : null;
if (!base || !out) { console.error("usage : node tools/tour_shots.mjs <base url> <output dir> [names]"); process.exit(2); }
const browser = await chromium.launch(), errors = [];
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const wait = (ms) => page.waitForTimeout(ms), want = (name) => !only || only.includes(name);
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 }); console.log("shot", name); };
const open = async (hash, ms) => { await page.goto(`${base}/${hash}`); await wait(ms); };
/* loads a demonstration ; when it is already there, the dialog offers to open it : the first button */
const demo = async (label) => { await open("#/home", 600); await page.waitForSelector(".hero"); await page.getByText(label).first().click(); await wait(1800);
  if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button").first().click(); await wait(1500); } };
const tab = async (text) => { await page.locator(".subtab", { hasText: text }).first().click().catch(() => {}); await wait(2500); };

await demo("Charger la démonstration");
if (want("idee")) { await open("#/home", 1200); await page.getByText("Premier design avec une IA").first().click(); await wait(1500); await shot("idee"); await page.keyboard.press("Escape"); }
if (want("atelier")) { await open("#/shop", 2500); await page.getByRole("button", { name: /Je me visse sur/ }).click(); await wait(800); await page.getByRole("button", { name: /arbre/ }).first().click().catch(() => {}); await wait(9000); await shot("atelier"); }
if (want("procedes")) { await open("#/process/impression", 1500); await shot("procedes"); }
if (want("piece")) {      // the interface at work : groups folded in the panel, the pivot of the turn and its arcs, the automatic rotation with two ways at once
  await open("#/parts/DRV-BASE", 11000); for (const t of ["Interfaces", "Variantes"]) await page.locator(".side:not(.right) .side-section > h3", { hasText: t }).first().click().catch(() => {}); await wait(400);
  const c = await page.locator(".viewport canvas").first().boundingBox(), x = c.x + c.width * 0.5, y = c.y + c.height * 0.55; await page.mouse.move(x, y); await page.mouse.down(); await wait(2300); await page.mouse.up(); await wait(300);
  for (const n of ["Tourner vers la droite", "Basculer vers le haut"]) await page.locator(".dw-auto").getByRole("button", { name: n }).click(); await wait(1600); await page.mouse.move(x - 260, y + 230); await shot("piece"); await page.keyboard.press("Escape"); }
if (want("commande")) { await open("#/parts/DRV-BASE", 9000); await tab("Artéfacts"); await shot("commande"); }
if (want("gamme")) { await open("#/parts/DRV-HEATSINK", 9000); await tab("Gamme"); await shot("gamme"); }
if (want("pcba")) { await open("#/pcba", 6000); await shot("pcba"); }
if (want("unites")) {      // the same board read in the imperial system : mil and inches — the choice is kept by the browser, so the page is loaded again around it
  await page.evaluate(() => localStorage.setItem("dw.units", JSON.stringify({ system: "imperial" }))); await page.reload(); await open("#/pcba", 4000);
  await page.locator(".pf-node", { hasText: "Implantation" }).first().click(); await wait(3000); await page.mouse.move(820, 620); await shot("unites");
  await page.evaluate(() => localStorage.removeItem("dw.units")); await page.reload(); await wait(1500); }
if (want("assemblage")) { await open("#/assembly/DRV-ASM", 14000); await shot("assemblage"); }
if (want("simulation")) { await open("#/fea", 9000); await shot("simulation"); }
if (want("cas")) {      // two load cases in one model : a copy of the effort, twice its value, solved after the first — the runs side by side
  await open("#/fea", 9000); const left = page.locator(".side:not(.right)").first(), right = page.locator(".side.right").first(), item = (id) => left.locator(`.bc-item[data-bc="${id}"]`);
  const confirm = async () => { for (let i = 0; i < 6 && await left.locator("input.need:visible").count(); i++) { await left.locator("input.need:visible").first().focus(); await page.keyboard.press("Enter"); await wait(600); } };
  const run = async (n) => { await right.locator(".side-actions").getByRole("button", { name: /Lancer la simulation|Relancer/ }).click(); await page.waitForFunction((k) => new RegExp(`R[ée]sultat ${k}`, "i").test(document.querySelector(".side.right .side-section h3")?.textContent || ""), n, { timeout: 180000 }); await wait(1500); };
  await confirm(); await run(1); const back = right.locator(".side-actions").getByRole("button", { name: /Revenir au modèle/ }); if (await back.count()) { await back.click(); await wait(900); }
  await item("E1").getByRole("button", { name: "Dupliquer E1" }).click(); await wait(900); const v = left.locator('.bc-edit input[type="number"]').first(), was = parseFloat(await v.inputValue()); await v.fill(String(was * 2)); await page.keyboard.press("Enter"); await wait(900);
  await item("E2").locator(".switch").click({ modifiers: ["Alt"] }); await wait(900); await confirm(); await run(2); await page.mouse.move(820, 560); await shot("cas");
  await page.evaluate(async () => { const { store } = await import("./js/core/store.js"); store.commit("capture : cas remis à zéro", (p) => { delete p.cases; }); }); }
if (want("modules")) {      // a product put together by modules : the heat sink and its insulator as a sub-assembly of the drive, two variants kept
  await page.evaluate(async () => { const { store } = await import("./js/core/store.js"); const a = store.assembly("DRV-ASM"), hs = a.instances.find((i) => i.part === "DRV-HEATSINK"), iso = a.instances.find((i) => i.part === "DRV-ISO"); if (!hs || !iso) return;
    const inner = a.mates.find((m) => [m.a.inst, m.b.inst].includes(hs.id) && [m.a.inst, m.b.inst].includes(iso.id)), outer = a.mates.find((m) => [m.a.inst, m.b.inst].includes(hs.id) && m !== inner), sid = store.addAssembly("Module de refroidissement"), re = (k, m) => ({ ...m[k], inst: m[k].inst === hs.id ? "i1" : "i2" });
    store.updateAssembly(sid, (s) => { s.instances = [{ id: "i1", part: "DRV-HEATSINK", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "DRV-ISO", placement: { t: [0, 0, 0], r: [0, 0, 0] } }]; s.mates = [{ ...inner, id: "M1", a: re("a", inner), b: re("b", inner) }]; }, "capture : sous-assemblage");
    store.updateAssembly("DRV-ASM", (x) => { x.instances = x.instances.filter((i) => i.id !== hs.id && i.id !== iso.id); x.instances.push({ id: "s1", asm: sid, placement: { t: [0, 0, 0], r: [0, 0, 0] } });
      x.mates = x.mates.filter((m) => m.id !== inner.id).map((m) => (m.id === outer.id ? { ...m, a: m.a.inst === hs.id ? { ...m.a, inst: "s1~i1" } : m.a, b: m.b.inst === hs.id ? { ...m.b, inst: "s1~i1" } : m.b } : m));
      x.variants = [{ name: "Complet", off: [] }, { name: "Sans couvercle", off: [x.instances.find((i) => i.part === "DRV-COVER").id] }]; }, "capture : modules et variantes"); });
  await open("#/assembly/DRV-ASM", 14000); await page.locator('.side [data-inst][data-kind="sub"]').first().click(); await wait(1200); await page.mouse.move(820, 620); await shot("modules");
  await page.evaluate(async () => { const { store } = await import("./js/core/store.js"); for (let i = 0; i < 3; i++) store.undo(); }); await wait(800); }      // the demonstration as it was, for the pictures that follow
if (want("calcul")) { await open("#/physics/heatsink_natural", 2500); const all = page.getByRole("button", { name: /Tout confirmer/ }); if (await all.count()) { await all.first().click(); await wait(600); } await page.locator(".phys-tabs [data-tab='result']").click().catch(() => {}); await wait(1500); await shot("calcul"); }
if (want("dfx")) { await open("#/dfx", 12000); await shot("dfx"); }
if (want("dessin")) { await open("#/drawings/DRV-BASE", 14000); await shot("dessin"); }
if (want("revue")) { await open("#/review", 6000); await shot("revue"); }
if (want("rapport")) { await open("#/report", 15000); await shot("rapport"); }
if (want("isolation") || want("busbar")) {
  await demo("DEMO-HVB");
  if (want("isolation")) { await open("#/creepage/DEMO-HVB", 9000); await page.getByRole("button", { name: /Analyser/ }).first().click(); await page.mouse.move(760, 520); await wait(25000); await shot("isolation"); }      // the pointer leaves the button : its tip would hide a heading
  if (want("busbar")) { await open("#/busbar", 2500); await page.getByRole("button", { name: /Nouveau busbar/ }).first().click(); await wait(9000); await shot("busbar"); }
}
console.log("errors:", errors.length ? errors.join(" || ") : "none");
await browser.close();
