/* DesignOrbit.ai — rehearsal of the two-person trial, by file, without Google : two browsers on one local server play
   « jp » and « ami ». jp shares the demonstration ; ami joins from his mirror, changes two parts and writes to him ; jp
   changes one of the same parts (a conflict) and another, merges, settles, ticks the message ; ami merges back. At the
   end the two projects must say the same thing. Not part of the application and not run by the tests : it needs Playwright.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/team_rehearsal.mjs http://127.0.0.1:8130 <output folder>
   Run it before a real trial : what it prints is what each member should see. See docs/EQUIPE.md. */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], dl = process.argv[3];
if (!base || !dl) { console.error("usage : node team_e2e.mjs <base url> <output dir>"); process.exit(2); }
const b = await chromium.launch(), errors = [];
const open = async () => { const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true }), page = await ctx.newPage(); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); }); page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message)); return page; };
const state = (page) => page.evaluate(`(async () => { const { store } = await import("./js/core/store.js"); const p = store.project, t = p.team || {}; const L = (id) => { const q = p.parts.find((x) => x.id === id); return q ? Object.values(q.params)[0].value : null; };
  return JSON.stringify({ owner: t.owner, members: (t.members || []).map((m) => m.handle), conflicts: (t.conflicts || []).map((c) => c.key + "@" + c.by), talk: (p.talk || []).map((m) => m.by + ":" + (m.done ? "fait" : "ouvert")), base: L("DRV-BASE"), cover: L("DRV-COVER"), sink: L("DRV-HEATSINK") }); })()`);
const bump = (page, id, d) => page.evaluate(`(async () => { const { store } = await import("./js/core/store.js"); store.commit("essai", (x) => { const q = x.parts.find((k) => k.id === ${JSON.stringify(id)}); const k = Object.keys(q.params)[0]; q.params[k].value += ${d}; }); })()`);
const mirror = async (page, name) => { const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Télécharger mon miroir" }).click()]); const path = `${dl}/${name}.dwiz`; await d.saveAs(path); return path; };
const mergeIn = async (page, path) => { const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Fusionner un fichier…" }).click()]); await fc.setFiles(path); await page.waitForSelector(".modal"); const text = (await page.locator(".modal").innerText()).replace(/\s+/g, " ").slice(0, 330); await page.locator(".modal .btn-primary").click(); await page.waitForTimeout(900); return text; };
// jp shares the demo project
const A = await open(); await A.goto(base + "/#/home"); await A.waitForSelector(".hero"); await A.getByText("Charger la démonstration").first().click(); await A.waitForTimeout(2000); if (await A.locator(".modal").count()) { await A.locator(".modal").getByRole("button", { name: /neuve/ }).click().catch(() => A.locator(".modal").getByRole("button").first().click()); } await A.waitForTimeout(5000);
await A.goto(base + "/#/review"); await A.waitForTimeout(1200); await A.locator(".subtab", { hasText: "Équipe" }).click(); await A.waitForTimeout(500);
await A.locator("input[type='text']").first().fill("jp"); await A.getByRole("button", { name: "Partager ce projet" }).click(); await A.waitForTimeout(900);
console.log("jp shares:", await state(A)); const m1 = await mirror(A, "jp1");
// ami joins from jp's mirror
const B = await open(); await B.goto(base + "/#/home"); await B.waitForSelector(".hero");
await B.locator(".menu-wrap", { hasText: "Projet" }).locator("button").first().click(); const [fc] = await Promise.all([B.waitForEvent("filechooser"), B.getByRole("menuitem", { name: "Rejoindre un projet partagé (fichier)…" }).click()]); await fc.setFiles(m1);
await B.waitForSelector(".modal input"); await B.locator(".modal input").fill("ami"); await B.locator(".modal .btn-primary").click(); await B.waitForFunction(() => location.hash.startsWith("#/team")); await B.waitForTimeout(1500);
console.log("ami joined:", await state(B));
await bump(B, "DRV-COVER", 3); await bump(B, "DRV-BASE", 4); await B.waitForTimeout(400);
await B.locator("select[aria-label='Sujet du message']").selectOption("part:DRV-COVER"); await B.locator("input[aria-label='Message']").fill("@jp j'ai allongé le couvercle de 3 mm, regarde le jeu avec la base."); await B.keyboard.press("Enter"); await B.waitForTimeout(700);
const m2 = await mirror(B, "ami1");
// jp changed the base too (a conflict) and the heatsink (his alone), then merges ami's mirror
await bump(A, "DRV-BASE", -2); await bump(A, "DRV-HEATSINK", 5); await A.waitForTimeout(400);
console.log("jp preview:", await mergeIn(A, m2)); console.log("jp after merge:", await state(A));
console.log("jp inbox:", (await A.locator(".badge").filter({ hasText: "pour moi" }).allTextContents()).join(","), "| conflict cards:", await A.locator("[data-conflict]").count(), "|", (await A.locator("[data-conflict]").first().innerText()).replace(/\s+/g, " ").slice(0, 150));
await A.screenshot({ path: `${dl}/team.png`, fullPage: true });
await A.locator("[data-conflict] .btn-primary").first().click(); await A.waitForTimeout(700);
await A.locator("[data-msg] input[type='checkbox']").first().check(); await A.waitForTimeout(600);
console.log("jp settled:", await state(A)); const m3 = await mirror(A, "jp2");
// ami merges jp's mirror back : the two agree
console.log("ami preview:", await mergeIn(B, m3)); console.log("ami after merge:", await state(B));
await A.goto(base + "/#/report"); await A.waitForTimeout(6000); console.log("report:", (await A.locator("section.card").filter({ hasText: "Équipe et messages" }).innerText()).replace(/\s+/g, " ").slice(0, 200));
console.log("errors:", errors.length ? errors.join("\n") : "none");
await b.close();
