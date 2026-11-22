/* DesignOrbit.ai — the storyline : one animated HTML file that tells, scene by scene, how a student takes a product from the
   idea to the result with the platform. Every screen is a real capture of the running application (the Rover example) ; a
   cursor moves on it where the story says the hand goes, the narration and the talk of the team run beside it.
   The story : tools/storyline_story.mjs. The file is self-contained (pictures inlined as WebP) and carries the brand note.

   node tools/storyline.mjs <base url of a running designwizard.py> <output .html>
   Chromium comes from the Playwright of the machine ; nothing is installed. */

import { createRequire } from "node:module"; import { writeFileSync } from "node:fs";
import { CAST, TITLE, END, SCENES } from "./storyline_story.mjs";
import { logoSvg, FOOT_NOTE, BRAND_LINE } from "../web/js/core/brand.js";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2], out = process.argv[3];
if (!base || !out) { console.error("usage : node tools/storyline.mjs <base url> <output .html>"); process.exit(2); }
const W = 1280, H = 800, QUALITY = 0.6;

const browser = await chromium.launch(), page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage(), wait = (ms) => page.waitForTimeout(ms);
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
/* a blank page turns the PNG of a capture into a lighter WebP */
const lab = await (await browser.newContext()).newPage(); await lab.setContent("<canvas></canvas>");
const webp = (buf) => lab.evaluate(async ([png, q]) => { const img = new Image(); img.src = png; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); return c.toDataURL("image/webp", q); }, [`data:image/png;base64,${buf.toString("base64")}`, QUALITY]);
/* the screen has settled when what it says of itself stops changing */
async function settle(max = 45000) { let last = "", same = 0; const t0 = Date.now(); while (Date.now() - t0 < max) { await wait(700); const now = await page.evaluate(() => `${document.querySelector(".status, .topbar .chip")?.textContent || ""}|${[...document.querySelectorAll(".view-status .chip")].map((c) => c.textContent).join("|")}|${document.querySelectorAll("canvas").length}`); if (now === last && !/Construction|en cours|…/.test(now)) { if (++same >= 3) return; } else same = 0; last = now; } }
/* where the cursor goes : the middle of the first thing on screen that each group names — CSS selectors, or « text:… » for what a button, a tab or a line says */
const spot = (group) => page.evaluate((sel) => { const seen = (n) => { const r = n.getBoundingClientRect(); return r.width > 6 && r.height > 6 && r.top >= 50 && r.bottom <= innerHeight - 4 && r.left >= 0 && r.right <= innerWidth ? [Math.round(r.left + Math.min(r.width / 2, 120)), Math.round(r.top + r.height / 2)] : null; };
  for (const s of sel.split(",").map((x) => x.trim())) { let all = [];
    if (s.startsWith("text:")) { const want = s.slice(5).toLowerCase(); all = [...document.querySelectorAll("button, a, summary, label, h2, h3, .cf-tile, .ft-row, .nav-item, .subtab, .chip, td, b")].filter((n) => (n.textContent || "").toLowerCase().includes(want)).sort((x, y) => x.textContent.length - y.textContent.length); }
    else { try { all = [...document.querySelectorAll(s)]; } catch (e) { continue; } }
    for (const n of all) { const p = seen(n); if (p) return p; } } return null; }, group);

/* ---------- what some scenes do before they are captured ---------- */
const PREP = {
  async firstDesign() { await page.getByRole("button", { name: /Premier design avec une IA/ }).first().click(); await wait(900); const t = page.locator(".modal textarea").first(); if (await t.count()) await t.fill("Un robot autonome d'apprentissage sur un châssis tout-terrain 1:16 : il roule seul dans un corridor, s'arrête devant un obstacle, et se coupe d'un coup de paume. Plaque porte-modules découpée au laser, boîtier imprimé, Raspberry Pi, trois capteurs à ultrasons."); await wait(600); },
  async sticker() { await page.evaluate(async () => { const { store } = await import("/js/core/store.js"); const { blankLabel } = await import("/js/core/labels.js");
    store.updateAssembly("RVR-ASM", (a) => { a.labels = [{ ...blankLabel("E1"), name: "Autocollant de l'équipe", w: 84, h: 28, inst: "boitier", on: { p: [55, 48, 48], n: [0, 0, 1] }, art: { type: "text", text: "ROVER 7", sub: "UdeS · génie mécanique", ink: "#1b2733", paper: "#ffffff", shape: "round" } },
      { ...blankLabel("E2"), name: "Tension de la batterie", kind: "plate", w: 60, h: 14, inst: "batterie", on: { p: [52, 17, 17], n: [0, 0, 1] }, art: { type: "text", text: "7,4 V — LiPo", sub: "", ink: "#ffffff", paper: "#c2410c", shape: "rect" } }]; }, "Étiquettes de l'équipe"); }); await wait(500); },
  async dress() { await page.evaluate(async () => { const { store } = await import("/js/core/store.js");
    store.updateAssembly("RVR-ASM", (a) => { a.render = { scene: "dark", shot: "hero", size: "hd", ground: true, labels: true, view: null, looks: { "RVR-2210-01": { finish: "paint-gloss", color: "#f0b429" }, "RVR-3160-01": { finish: "rubber" }, "RVR-2200-04": { finish: "clear-plastic" }, "RVR-1010-W": { finish: "paint-satin", color: "#d9d4c7" }, "RVR-1020-01": { finish: "metal-brushed" } } }; }, "Rendu de l'équipe"); }); await wait(500); },
};

/* ---------- the captures ---------- */
await page.goto(`${base}/#/home`); await page.waitForSelector(".hero"); await page.locator("[data-example='rover']").click(); await wait(2500);
if (await page.locator(".modal").count()) { await page.locator(".modal").getByRole("button", { name: /neuve/ }).click().catch(() => {}); await wait(1500); }
await page.waitForFunction(() => /assembly/.test(location.hash), null, { timeout: 30000 }).catch(() => {}); await settle();
/* one capture : the route, what must be ready, where the cursor goes, the click and what follows it */
async function capture(S) {
  if (await page.locator(".modal").count()) { await page.keyboard.press("Escape"); await wait(300); }
  await page.goto(`${base}/${S.go}`); await wait(1200); await page.evaluate(() => window.scrollTo(0, 0));
  if (S.prep === "firstDesign") await PREP.firstDesign(); else await settle();
  if (S.ready) { await page.waitForFunction(S.ready, null, { timeout: 180000 }).catch(() => console.log(`${S.id} : not ready in time, captured as it is`)); await wait(1500); }
  if (S.scroll) { await page.evaluate((sel) => { for (const s of sel.split(",").map((x) => x.trim())) { const n = document.querySelector(s); if (n) { n.scrollIntoView({ block: "start" }); const box = n.closest(".side-scroll, main, .page") || document.scrollingElement; box.scrollTop = Math.max(0, box.scrollTop - 70); return; } } }, S.scroll); await wait(500); }
  const pts = []; for (const g of S.point || []) { const p = await spot(g); if (p && !pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 24)) pts.push(p); }
  const frames = [await webp(await page.screenshot())]; let clicked = false;
  if (S.click) { const target = page.locator(S.click).first(); if (await target.count()) { const b = await target.boundingBox(); if (b) { pts.push([Math.round(b.x + Math.min(b.width / 2, 120)), Math.round(b.y + b.height / 2)]); await target.click().catch(() => {}); await wait(1600); frames.push(await webp(await page.screenshot())); clicked = true; } } }
  if (!pts.length) pts.push([Math.round(W * 0.5), Math.round(H * 0.45)]);
  console.log(`${S.id.padEnd(13)} ${frames.length} capture(s) · ${pts.length} point(s) · ${Math.round(frames.reduce((a, f) => a + f.length, 0) / 1024)} Ko`);
  return { id: S.id, day: S.day, title: S.title, go: S.go, text: S.text, chat: S.chat, frames, pts: pts.map(([x, y]) => [Math.round(x / W * 1000) / 10, Math.round(y / H * 1000) / 10]), click: clicked };
}
/* what the team adds along the story (its labels, its render) is laid first ; a heavy screen (« early ») is captured before the others, while the page holds nothing else */
for (const k of [...new Set(SCENES.map((S) => S.prep).filter((k) => k && k !== "firstDesign"))]) await PREP[k]();
const done = new Map(); for (const S of SCENES.filter((x) => x.early)) done.set(S.id, await capture(S));
const scenes = []; for (const S of SCENES) scenes.push(done.get(S.id) || await capture(S));
await browser.close();

/* ---------- the file ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const data = JSON.stringify({ cast: CAST, title: TITLE, end: END, scenes }).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITLE.title)} — une storyline DesignOrbit.ai</title>
<style>
:root { --paper: #fbfaf6; --ink: #1f2a37; --soft: #5b6673; --line: #d9d5c9; --note: #fff7d6; --blue: #0c66e4; --yellow: #ffd23f; --card: #ffffff; }
* { box-sizing: border-box; } html, body { height: 100%; margin: 0; }
body { background: var(--paper); color: var(--ink); font: 16px/1.5 "Inter", "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif; display: grid; grid-template-rows: auto 1fr auto; background-image: linear-gradient(#0000 23px, #1f2a3708 24px), linear-gradient(90deg, #0000 23px, #1f2a3708 24px); background-size: 24px 24px; }
header { display: flex; align-items: center; gap: .7rem; padding: .55rem 1rem; border-bottom: 2px solid var(--ink); background: var(--paper); } header b { font-size: 1.05rem; } header small { color: var(--soft); } header .grow { flex: 1; }
header .day { font-weight: 650; background: var(--yellow); padding: .1rem .55rem; border-radius: 4px 9px 5px 8px; }
main { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(300px, 1fr); gap: 1rem; padding: 1rem; min-height: 0; }
.stage { position: relative; align-self: start; border: 2px solid var(--ink); border-radius: 10px 14px 9px 12px; background: var(--card); box-shadow: 4px 5px 0 #1f2a3722; overflow: hidden; }
.bar { display: flex; align-items: center; gap: .4rem; padding: .3rem .6rem; border-bottom: 1.5px solid var(--line); font-size: .78rem; color: var(--soft); } .bar i { width: 9px; height: 9px; border-radius: 50%; background: var(--line); display: inline-block; } .bar span { margin-left: .5rem; background: #f1efe7; border-radius: 99px; padding: .05rem .7rem; }
.screen { position: relative; aspect-ratio: ${W} / ${H}; background: #eef0f2; } .screen img { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity .6s; } .screen img.on { opacity: 1; }
.cursor { position: absolute; width: 26px; height: 26px; left: 50%; top: 50%; margin: -3px 0 0 -4px; transition: left 1.1s cubic-bezier(.5, .05, .2, 1), top 1.1s cubic-bezier(.5, .05, .2, 1); z-index: 3; filter: drop-shadow(1px 2px 1px #0005); pointer-events: none; }
.ring { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; border: 3px solid var(--blue); opacity: 0; z-index: 2; pointer-events: none; } .ring.go { animation: ring .7s ease-out; } @keyframes ring { from { opacity: .9; transform: scale(.6); } to { opacity: 0; transform: scale(4.2); } }
.side { display: flex; flex-direction: column; gap: .7rem; min-height: 0; } .side h1 { margin: 0; font-size: 1.45rem; line-height: 1.2; } .side h1 mark { background: linear-gradient(transparent 55%, var(--yellow) 55%); color: inherit; }
.tell { margin: 0; font-size: 1rem; } .chat { display: flex; flex-direction: column; gap: .5rem; overflow: auto; padding-right: .2rem; }
.say { display: grid; grid-template-columns: 34px 1fr; gap: .5rem; opacity: 0; transform: translateY(8px); transition: opacity .45s, transform .45s; } .say.on { opacity: 1; transform: none; }
.who { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: .9rem; border: 2px solid var(--ink); } .who.ai { border-radius: 9px; }
.bub { background: var(--card); border: 1.5px solid var(--line); border-radius: 4px 12px 12px 12px; padding: .4rem .6rem; font-size: .92rem; } .bub b { display: block; font-size: .74rem; letter-spacing: .02em; } .bub small { color: var(--soft); font-weight: 400; } .say.ai .bub { background: var(--note); border-color: #e5d48a; }
.card { grid-column: 1 / -1; align-self: center; justify-self: center; max-width: 880px; text-align: center; background: var(--card); border: 2px solid var(--ink); border-radius: 12px 18px 11px 16px; box-shadow: 5px 6px 0 #1f2a3722; padding: 2rem 2.2rem; }
.card h1 { font-size: 2.6rem; margin: .2rem 0; } .card .kick { color: var(--soft); text-transform: uppercase; letter-spacing: .12em; font-size: .78rem; } .card p { font-size: 1.05rem; } .cast { display: flex; flex-wrap: wrap; gap: .8rem 1.4rem; justify-content: center; margin: 1.2rem 0 .4rem; text-align: left; }
.cast .say { opacity: 1; transform: none; grid-template-columns: 34px auto; align-items: center; } .card ul { text-align: left; display: inline-block; margin: .4rem 0 0; } .card li { margin: .25rem 0; } .card img { max-width: 100%; border: 1.5px solid var(--line); border-radius: 8px; margin-top: 1rem; }
footer { display: grid; grid-template-columns: 1fr auto; gap: .4rem 1rem; align-items: center; padding: .5rem 1rem .6rem; border-top: 2px solid var(--ink); background: var(--paper); }
.dots { display: flex; gap: 4px; flex-wrap: wrap; } .dots button { width: 22px; height: 8px; border-radius: 4px; border: 0; background: var(--line); cursor: pointer; padding: 0; } .dots button.on { background: var(--blue); } .dots button.done { background: var(--ink); }
.ctl { display: flex; gap: .4rem; } .ctl button { font: inherit; font-weight: 650; padding: .3rem .8rem; border: 2px solid var(--ink); border-radius: 6px 10px 7px 9px; background: var(--card); cursor: pointer; } .ctl button.main { background: var(--yellow); }
.note { grid-column: 1 / -1; margin: 0; font-size: .7rem; color: var(--soft); }
@media (max-width: 900px) { main { grid-template-columns: 1fr; } .card h1 { font-size: 1.9rem; } }
@media (prefers-reduced-motion: reduce) { .cursor, .say, .screen img { transition: none; } }
</style>
</head>
<body>
<header>${logoSvg(30)}<b>${esc(TITLE.title)}</b><small>une storyline ${esc(BRAND_LINE)}</small><span class="grow"></span><span class="day" id="day"></span></header>
<main id="main"></main>
<footer><div class="dots" id="dots" role="tablist" aria-label="Scènes"></div><div class="ctl"><button id="prev" aria-label="Scène précédente">←</button><button id="play" class="main">Lire</button><button id="next" aria-label="Scène suivante">→</button></div>
<p class="note">Fiction : Hugo, Léa, Samuel et Davide sont des personnages ; Claude est l'assistant IA de l'histoire. Chaque écran est une capture réelle de la plateforme. ${esc(FOOT_NOTE)}</p></footer>
<script>
const D = ${data};
const $ = (tag, cls, ...kids) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const k of kids) n.append(k); return n; };
const main = document.getElementById("main"), dots = document.getElementById("dots"), day = document.getElementById("day"), playBtn = document.getElementById("play");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches, N = D.scenes.length + 2;                 // the title, the scenes, the end
let at = 0, playing = false, timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, still ? 0 : ms)), stop = () => { timers.forEach(clearTimeout); timers = []; };
const face = (who) => { const c = D.cast[who], n = $("div", "who" + (who === "claude" ? " ai" : ""), c.name[0]); n.style.background = c.color; return n; };
const say = (who, text) => { const c = D.cast[who], name = $("b", "", c.name + " "); name.append($("small", "", "— " + c.role)); return $("div", "say" + (who === "claude" ? " ai" : ""), face(who), $("div", "bub", name, text)); };
function titleCard() { const t = D.title, cast = $("div", "cast"); for (const k of Object.keys(D.cast)) { const c = D.cast[k], name = $("b", "", c.name + " "); name.append($("small", "", "— " + c.role)); cast.append($("div", "say", face(k), $("div", "", name))); }
  main.replaceChildren($("div", "card", $("div", "kick", t.kicker), $("h1", "", t.title), $("p", "", $("b", "", t.sub)), $("p", "", t.lead), cast)); day.textContent = "Prologue"; return 7000; }
function endCard() { const e = D.end, ul = $("ul"); for (const l of e.learned) ul.append($("li", "", l)); const last = D.scenes.find((s) => s.id === "rendu"), img = last ? Object.assign($("img"), { src: last.frames[0], alt: "Le rendu du Rover, dans la plateforme" }) : "";
  main.replaceChildren($("div", "card", $("div", "kick", "Épilogue"), $("h1", "", e.title), $("p", "", e.text), ul, img)); day.textContent = "Épilogue"; return 12000; }
function scene(S) {
  const screen = $("div", "screen"), imgs = S.frames.map((f, k) => Object.assign($("img", k ? "" : "on"), { src: f, alt: k ? "L'écran, après le clic" : "Capture de la plateforme : " + S.title }));
  const cur = $("div", "cursor"); cur.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 2 L4 21 L9.5 16.5 L13 24 L16.2 22.5 L12.8 15.2 L20 15 Z" fill="#fff" stroke="#1f2a37" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const ring = $("div", "ring"); cur.style.left = "88%"; cur.style.top = "86%"; screen.append(...imgs, ring, cur);
  const bar = $("div", "bar", $("i"), $("i"), $("i"), $("span", "", "DesignOrbit.ai — " + S.go));
  const chat = $("div", "chat"), h = $("h1"); h.append($("mark", "", S.title));
  main.replaceChildren($("div", "stage", bar, screen), $("div", "side", h, $("p", "tell", S.text), chat)); day.textContent = S.day;
  let t = 900;
  S.pts.forEach((p, k) => { later(t, () => { cur.style.left = p[0] + "%"; cur.style.top = p[1] + "%"; }); t += 1500;
    if (S.click && k === S.pts.length - 1) { later(t, () => { ring.style.left = p[0] + "%"; ring.style.top = p[1] + "%"; ring.classList.remove("go"); void ring.offsetWidth; ring.classList.add("go"); if (imgs[1]) { imgs[0].classList.remove("on"); imgs[1].classList.add("on"); } }); t += 900; } else t += 500; });
  let c = 1600; S.chat.forEach(([who, text]) => { const n = say(who, text); chat.append(n); later(c, () => { n.classList.add("on"); n.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" }); }); c += 2600; });
  return Math.max(t, c) + 3200;
}
function show(i) { stop(); at = Math.max(0, Math.min(N - 1, i)); [...dots.children].forEach((d, k) => { d.className = k === at ? "on" : k < at ? "done" : ""; });
  const ms = at === 0 ? titleCard() : at === N - 1 ? endCard() : scene(D.scenes[at - 1]); history.replaceState(null, "", "#" + at);
  if (playing) later(ms, () => { if (at < N - 1) show(at + 1); else setPlay(false); }); }
function setPlay(on) { playing = on; playBtn.textContent = on ? "Pause" : at >= N - 1 ? "Rejouer" : "Lire"; if (on) show(at >= N - 1 ? 0 : at); else stop(); }
for (let k = 0; k < N; k++) { const b = $("button"); b.title = k === 0 ? "Prologue" : k === N - 1 ? "Épilogue" : D.scenes[k - 1].title; b.setAttribute("aria-label", b.title); b.onclick = () => show(k); dots.append(b); }
document.getElementById("prev").onclick = () => show(at - 1); document.getElementById("next").onclick = () => show(at + 1); playBtn.onclick = () => setPlay(!playing);
addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "PageDown") show(at + 1); else if (e.key === "ArrowLeft" || e.key === "PageUp") show(at - 1); else if (e.key === " ") { e.preventDefault(); setPlay(!playing); } });
const start = Math.min(N - 1, parseInt(location.hash.slice(1), 10) || 0); show(start); if (!still && !start) setPlay(true);      // opened on a scene (…html#7) : it waits there ; opened plain : it plays
</script>
</body>
</html>
`;
writeFileSync(out, html);
console.log(`${out} — ${scenes.length} scènes, ${Math.round(html.length / 1024)} Ko${errors.length ? ` — erreurs de page : ${errors.join(" | ")}` : ""}`);
