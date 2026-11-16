/* DesignWizard.ai — rehearsal of the two-person trial through Google Drive, with a SIMULATED Google : two accounts, each
   with their own Drive, and the « drive.file » rule applied — an application reads a file only if it created it for that
   account, or if the person picked it in the file picker. No file is downloaded by hand. Six stages : share, join by the
   picker, first read by the picker, « Synchroniser » with no picker, a second round, and a read permission that is lost
   and designated again. The addresses are placeholders. What this cannot show is what the real Google does (the picker,
   the API key, the consent screen) : only a trial on two real accounts can. Not run by the tests : it needs Playwright.
     python3 designwizard.py --port 8130 --no-browser --data <an empty folder>
     node tools/team_drive_rehearsal.mjs http://127.0.0.1:8130 <output folder>
   See docs/EQUIPE.md. */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], out = process.argv[3];
if (!base || !out) { console.error("usage : node team_drive_e2e.mjs <base url> <output dir>"); process.exit(2); }

/* ---- the simulated Google ---- */
const files = new Map(), grants = new Set(); let n = 0;
const err = (status, message) => ({ __error: { status, message } }), FOLDER = "application/vnd.google-apps.folder";
const mk = (user, o) => { const f = { id: `f${++n}`, owner: user, readers: [], modifiedTime: new Date().toISOString(), webViewLink: `https://drive.example/${n}`, ...o }; files.set(f.id, f); grants.add(`${user}|${f.id}`); return f; };
const can = (user, f) => f && !f.trashed && grants.has(`${user}|${f.id}`) && (f.owner === user || f.readers.includes(user));
const pub = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, appProperties: f.appProperties, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink });
const google = {
  me: (user) => ({ email: user, name: user.split("@")[0] }),
  find: (user, [q = {}]) => [...files.values()].filter((f) => can(user, f) && (!q.role || f.appProperties.dw === q.role || Object.values(f.appProperties).includes(q.role)) && Object.entries(q.props || {}).every(([k, v]) => f.appProperties[k] === v) && (!q.parent || f.parents[0] === q.parent) && (!q.name || f.name === q.name) && (!q.mime || f.mimeType === q.mime)).map(pub),
  createFolder: (user, [o]) => pub(mk(user, { name: o.name, mimeType: FOLDER, parents: [o.parent || "root"], appProperties: { dw: o.role || "folder", ...(o.props || {}) } })),
  upload: (user, [o]) => pub(mk(user, { name: o.name, mimeType: o.mime, parents: [o.parent], content: o.bytes, appProperties: { dw: o.role, ...(o.props || {}) } })),
  replace: (user, [id, o]) => { const f = files.get(id); if (!can(user, f) || f.owner !== user) return err(404, "File not found"); f.content = o.bytes; f.modifiedTime = new Date().toISOString(); return pub(f); },
  rename: (user, [id, name]) => { const f = files.get(id); if (!can(user, f) || f.owner !== user) return err(404, "File not found"); f.name = name; return pub(f); },
  move: (user, [id, to]) => { const f = files.get(id); if (!can(user, f)) return err(404, "File not found"); f.parents = [to]; return pub(f); },
  trash: (user, [id]) => { const f = files.get(id); if (!can(user, f)) return err(404, "File not found"); f.trashed = true; return pub(f); },
  text: (user, [id]) => { const f = files.get(id); return can(user, f) ? f.content : err(404, `File not found: ${id}.`); },
  share: (user, [id, email]) => { const f = files.get(id); if (!can(user, f) || f.owner !== user) return err(404, "File not found"); if (!f.readers.includes(email)) f.readers.push(email); return { id: "perm" }; },
  /* the picker : Google itself shows what the PERSON may read — not what the application may read — and picking grants the application */
  pickerList: (user, [o = {}]) => [...files.values()].filter((f) => !f.trashed && f.mimeType !== FOLDER && (f.owner === user || f.readers.includes(user)) && (o.fileIds ? o.fileIds.includes(f.id) : (!o.mime || f.mimeType === o.mime) && (o.mine !== false || f.owner !== user))).map((f) => ({ id: f.id, name: f.name, owner: f.owner })),
  pickerPick: (user, [id]) => { grants.add(`${user}|${id}`); return true; },
};
const b = await chromium.launch(), errors = [];
async function open(user) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } }), page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errors.push(`${user}: ${m.text().slice(0, 300)}`); }); page.on("pageerror", (e) => errors.push(`${user}: ${String(e).slice(0, 300)}`));
  await page.exposeFunction("googleCall", (method, args) => { const fn = google[method]; return fn ? fn(user, args || []) : err(501, `not simulated : ${method}`); });
  await page.goto(base + "/#/home"); await page.waitForSelector(".hero");
  await page.evaluate(`(async () => {
    const { signIn, session } = await import("./js/core/access.js"), { store } = await import("./js/core/store.js");
    const call = async (m, a) => { const r = await window.googleCall(m, a); if (r && r.__error) throw Object.assign(new Error(r.__error.message), { status: r.__error.status }); return r; };
    const drive = new Proxy({}, { get: (_, m) => (...a) => call(m, a) }), auth = { signIn: async () => {}, chooseAccount: async () => {}, token: async () => "TOKEN", signedIn: () => true, signOut() {} };
    class DocsView { constructor() { this.o = {}; } setIncludeFolders() { return this; } setMode() { return this; } setFileIds(s) { this.o.fileIds = s.split(","); return this; } setMimeTypes(m) { this.o.mime = m; return this; } setOwnedByMe(v) { this.o.mine = v; return this; } }
    class PickerBuilder { addView(v) { this.view = v; return this; } setOAuthToken(t) { this.token = t; return this; } setAppId(a) { this.appId = a; return this; } setDeveloperKey() { return this; } setTitle(t) { this.title = t; return this; } setLocale() { return this; } setCallback(cb) { this.cb = cb; return this; }
      build() { return { setVisible: async () => { const list = await call("pickerList", [this.view.o]); window.__picker = { title: this.title, appId: this.appId, token: this.token, asked: this.view.o, shown: list.map((f) => f.name + " de " + f.owner) }; const f = list[0]; if (!f) { this.cb({ action: "cancel" }); return; } await call("pickerPick", [f.id]); this.cb({ action: "picked", docs: [{ id: f.id, name: f.name }] }); } }; } }
    window.google = { picker: { DocsView, PickerBuilder, ViewId: { DOCS: "all" }, DocsViewMode: { LIST: "list" }, Action: { PICKED: "picked", CANCEL: "cancel" }, Response: { ACTION: "action", DOCUMENTS: "docs" } } };
    await signIn({ deps: { auth, drive } }); store.useDrive(session.fs);
  })()`);
  return page;
}
const state = (page) => page.evaluate(`(async () => { const { store } = await import("./js/core/store.js"); const p = store.project, t = p.team || {}; const L = (id) => { const q = p.parts.find((x) => x.id === id); return q ? Object.values(q.params)[0].value : null; };
  return JSON.stringify({ me: t.owner, members: (t.members || []).map((m) => m.handle + (m.mirror ? "=" + m.mirror : "")), conflicts: (t.conflicts || []).map((c) => c.key), talk: (p.talk || []).map((m) => m.by + ":" + (m.done ? "fait" : "ouvert")), base: L("DRV-BASE"), cover: L("DRV-COVER"), sink: L("DRV-HEATSINK") }); })()`);
const bump = (page, id, d) => page.evaluate(`(async () => { const { store } = await import("./js/core/store.js"); store.commit("essai", (x) => { const q = x.parts.find((k) => k.id === ${JSON.stringify(id)}); const k = Object.keys(q.params)[0]; q.params[k].value += ${d}; }); })()`);
const picker = (page) => page.evaluate(() => JSON.stringify(window.__picker));
const answer = async (page, text) => { await page.waitForSelector(".modal input"); await page.locator(".modal input").fill(text); await page.locator(".modal .btn-primary").click(); };
const drivecol = (page) => page.evaluate(() => [...document.querySelectorAll("section.card.taped table tbody tr")].map((r) => r.cells[0].innerText.replace(/\s+/g, " ").trim() + " → " + r.cells[3].innerText.replace(/\s+/g, " ").trim()).join(" | "));
const modalText = async (page) => { await page.waitForSelector(".modal"); return (await page.locator(".modal").innerText()).replace(/\s+/g, " ").slice(0, 520); };
const team = async (page) => { await page.goto(base + "/#/home"); await page.waitForTimeout(300); await page.goto(base + "/#/team"); await page.waitForTimeout(1800); };
const quiet = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. jp : the demo project, shared, his mirror offered to ami in Drive
const A = await open("jp@example.test"); await A.getByText("Charger la démonstration").first().click(); await A.waitForTimeout(2500); if (await A.locator(".modal").count()) { await A.locator(".modal").getByRole("button", { name: /neuve/ }).click().catch(() => A.locator(".modal").getByRole("button").first().click()); } await A.waitForTimeout(6000);
await A.goto(base + "/#/team"); await A.waitForTimeout(800); await A.locator("input[type='text']").first().fill("jp"); await A.getByRole("button", { name: "Partager ce projet" }).click(); await A.waitForTimeout(900);
await A.getByRole("button", { name: "Partager mon miroir dans Drive…" }).click(); await answer(A, "ami@example.test"); await A.waitForTimeout(2500);
console.log("1 jp shared   :", await state(A)); console.log("  jp's Drive  :", [...files.values()].filter((f) => f.appProperties.dw === "project-file").map((f) => `${f.id} ${f.name} lu par [${f.readers}]`).join(" ; "));

// 2. ami : joins from Drive (the picker shows what was shared with her), works, offers her mirror to jp
const B = await open("ami@example.test");
await B.locator(".menu-wrap", { hasText: "Projet" }).locator("button").first().click(); await B.getByRole("menuitem", { name: "Rejoindre un projet partagé (Drive)…" }).click();
await answer(B, "ami"); await B.waitForFunction(() => location.hash.startsWith("#/team")); await B.waitForTimeout(3500);
console.log("2 ami joined  :", await state(B)); console.log("  her picker  :", await picker(B));
await bump(B, "DRV-COVER", 3); await bump(B, "DRV-BASE", 4); await B.waitForTimeout(400);
await B.locator("select[aria-label='Sujet du message']").selectOption("part:DRV-COVER"); await B.locator("input[aria-label='Message']").fill("@jp j'ai allongé le couvercle de 3 mm."); await B.keyboard.press("Enter"); await B.waitForTimeout(600);
await B.getByRole("button", { name: "Partager mon miroir dans Drive…" }).click(); await answer(B, "jp@example.test"); await B.waitForTimeout(3000);
console.log("  ami shared  :", await state(B));

// 3. jp : works too, « Synchroniser » finds nothing linked yet, then points once at ami's mirror
await bump(A, "DRV-BASE", -2); await bump(A, "DRV-HEATSINK", 5); await A.waitForTimeout(300);
await A.getByRole("button", { name: "Synchroniser" }).click(); await A.waitForTimeout(2500); console.log("3 jp sync #1  :", (await A.locator(".toast").allTextContents()).map((t) => t.slice(0, 90)).join(" / "));
await A.getByRole("button", { name: "Lire un miroir dans Drive…" }).click(); console.log("  jp preview  :", await modalText(A)); console.log("  his picker  :", await picker(A));
await A.locator(".modal .btn-primary").click(); await A.waitForTimeout(3500); console.log("  jp merged   :", await state(A)); console.log("  jp's table  :", await drivecol(A));
await A.locator("[data-conflict] .btn-primary").first().click(); await A.waitForTimeout(500); await A.locator("[data-msg] input[type='checkbox']").first().check(); await A.waitForTimeout(3500);
console.log("  jp settled  :", await state(A));

// 4. ami : opening the screen looks at jp's mirror alone ; « Synchroniser » shows it and merges — no file, no picker
await B.evaluate(() => { window.__picker = null; }); await team(B); console.log("4 ami's table :", await drivecol(B), "|", (await B.locator(".atelier-hint").allTextContents()).join(" ").slice(0, 120));
await B.getByRole("button", { name: "Synchroniser" }).click(); console.log("  ami preview :", await modalText(B)); await B.locator(".modal .btn-primary").click(); await B.waitForTimeout(3500);
console.log("  ami merged  :", await state(B), "| picker used :", await picker(B));

// 5. later : jp changes a part, his store saves it in his Drive by itself ; ami synchronises
await bump(A, "DRV-COVER", 1); await quiet(5000); await team(B); console.log("5 ami's table :", await drivecol(B));
await B.getByRole("button", { name: "Synchroniser" }).click(); console.log("  ami preview :", (await modalText(B)).slice(0, 200)); await B.locator(".modal .btn-primary").click(); await B.waitForTimeout(3000);
await team(A); await A.getByRole("button", { name: "Synchroniser" }).click(); await A.waitForTimeout(2500); console.log("  jp sync     :", (await A.locator(".toast").allTextContents()).map((t) => t.slice(0, 90)).join(" / "), "| dialog :", await A.locator(".modal").count());
console.log("  jp  :", await state(A)); console.log("  ami :", await state(B));

// 6. the permission is not there (another member's file never pointed at) : said plainly, and repaired by pointing once
const amiFile = [...files.values()].find((f) => f.owner === "ami@example.test" && f.appProperties.dw === "project-file"); grants.delete(`jp@example.test|${amiFile.id}`);
await bump(B, "DRV-COVER", 2); await quiet(5000); await team(A); console.log("6 jp's table  :", await drivecol(A));
await A.getByRole("button", { name: "Synchroniser" }).click(); console.log("  jp preview  :", (await modalText(A)).slice(0, 260)); await A.locator(".modal .btn").first().click(); await A.waitForTimeout(600);
await A.evaluate(() => { window.__picker = null; }); await A.getByRole("button", { name: "Désigner…" }).click(); console.log("  jp preview  :", (await modalText(A)).slice(0, 200)); console.log("  his picker  :", await picker(A));
await A.locator(".modal .btn-primary").click(); await A.waitForTimeout(3000); console.log("  jp  :", await state(A)); console.log("  ami :", await state(B));
await A.screenshot({ path: `${out}/team_drive.png`, fullPage: true });
console.log("errors:", errors.length ? errors.join(" || ") : "none"); await b.close();
