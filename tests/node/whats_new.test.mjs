// What is new on the screens, from one version to the next : the lines, the review and its marks.
//   node --test tests/node/whats_new.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { NEWS, FIRST_SPAN, firstBase, tidyReview, reviewLines, byVersion, reviewCount, markSeen, nextReview, previousReview, lineProblems, getReview } from "../../web/js/core/whats_new.js";
import { newer } from "../../web/js/core/update_check.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const RUNNING = read("web/js/core/app.js").match(/APP_VERSION = "([\d.]+)"/)[1];
const sources = ["core", "modules", "analysis", "pcba", "cad"].flatMap((d) => readdirSync(new URL(`../../web/js/${d}`, import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => read(`web/js/${d}/${f}`))).join("\n");

test("every line says what is new, in which version, on which screen and on which element — and that element exists", () => {
  assert.equal(new Set(NEWS.map((n) => n.id)).size, NEWS.length, "ids are unique");
  for (const n of NEWS) {
    assert.deepEqual(lineProblems(n), [], n.id); assert.ok(!newer(n.v, RUNNING), `${n.id} : version ${n.v} is not after the running one (${RUNNING})`);
    for (const t of n.sel.match(/[.#][A-Za-z][\w-]*|\[[a-z-]+/g) || []) { const word = t.replace(/^[.#[]/, ""); assert.ok(sources.includes(word), `${n.id} : « ${word} » of its selector is written somewhere in the screens`); }
    if (n.where) { const key = n.where.replace(/^#\//, "").split("/")[0], file = { swreq: "sw_req", swarch: "sw", swsim: "sw", swcode: "sw", swtest: "sw_verify", swrel: "sw" }[key] || key; assert.ok(existsSync(new URL(`../../web/js/modules/${file}.js`, import.meta.url)), `${n.id} leads to a screen that exists (${key})`); }      // the steps of the V live in a few modules
  }
  assert.ok(lineProblems({ id: "X y", v: "1", title: "", text: "court", sel: "" }).length >= 5);
  for (let i = 1; i < NEWS.length; i++) assert.ok(!newer(NEWS[i].v, NEWS[i - 1].v), "newest first");
});

test("the running version says what it changed on the screens", () => {
  assert.ok(NEWS.some((n) => n.v === RUNNING), `no line for the version ${RUNNING} : a version that changes a screen adds its lines to core/whats_new.js (one that changes none takes the lines of the version before as they are)`);
});

test("a review : the marks stay while it is open, a tick is kept, only a new review puts them away", () => {
  assert.equal(firstBase("0.114.0"), "0.110.0"); assert.equal(firstBase("0.2.0"), "0.0.0"); assert.equal(FIRST_SPAN, 4);
  const R = tidyReview(null, "0.114.0"); assert.deepEqual(R, { base: "0.110.0", seen: {}, before: null });
  const L = reviewLines(R, "0.114.0"); assert.ok(L.length >= 9 && L.every((n) => newer(n.v, "0.110.0") && n.seen === "")); assert.ok(!L.some((n) => n.id === "head-ai"), "what the base already had is not in the review");
  assert.deepEqual(byVersion(L).map((g) => g.v), ["0.114.0", "0.113.0", "0.112.0", "0.111.0"]); assert.equal(reviewCount(L).text, `0 vue sur ${L.length}`);
  // a tick is a trace : the line stays in the review, marked
  const seen = markSeen(R, "sim-chip", true, "2026-11-20T12:00:00Z"), L2 = reviewLines(seen, "0.114.0"); assert.equal(L2.length, L.length, "nothing leaves the review when it is ticked"); assert.equal(L2.find((n) => n.id === "sim-chip").seen, "2026-11-20T12:00:00Z");
  assert.equal(reviewCount(L2).seen, 1); assert.equal(markSeen(seen, "sim-chip", true, "later").seen["sim-chip"], "2026-11-20T12:00:00Z", "the first date is kept"); assert.equal(reviewLines(markSeen(seen, "sim-chip", false), "0.114.0").find((n) => n.id === "sim-chip").seen, "");
  // a version published during the review joins it
  assert.ok(reviewLines(R, "0.113.0").length < L.length); assert.ok(reviewLines(R, "0.113.0").every((n) => n.v !== "0.114.0"));
  // a new review : nothing left ; the one before is kept, and returns with its ticks
  const next = nextReview(seen, "0.114.0", "2026-11-20T13:00:00Z"); assert.deepEqual(reviewLines(next, "0.114.0"), []); assert.deepEqual(next.before, { base: "0.110.0", seen: { "sim-chip": "2026-11-20T12:00:00Z" }, closed: "2026-11-20T13:00:00Z" });
  assert.equal(reviewCount([]).text, "Aucune nouveauté à revoir");
  const back = previousReview(next); assert.equal(back.base, "0.110.0"); assert.equal(back.seen["sim-chip"], "2026-11-20T12:00:00Z"); assert.equal(previousReview(back), back, "nothing before : nothing changes");
  // what is kept in the browser is tidied : an unknown line, a base from the future
  assert.deepEqual(tidyReview({ base: "9.9.9", seen: { ghost: "x", "val-chip": "d" } }, "0.114.0"), { base: "0.110.0", seen: { "val-chip": "d" }, before: null });
  assert.equal(getReview("0.114.0").base, "0.110.0", "without a browser : a first review");
});

test("the marks are on the screens : one layer above the page, a button in the top bar, the list, the Help", () => {
  const ui = read("web/js/core/whats_new_ui.js"), app = read("web/js/core/app.js"), css = read("web/css/nav.css");
  assert.match(app, /installWhatsNew\(\{ running: APP_VERSION \}\)/); assert.match(app, /updateButton\(\), newsButton\(\)/); assert.match(read("web/js/modules/help.js"), /newsCard\(args\[0\] === "news"\)/);
  assert.match(ui, /id: "news-layer"/); assert.match(ui, /elementFromPoint/, "a mark shows only when its element can be seen"); assert.match(ui, /Passer à une nouvelle revue/); assert.match(ui, /Rouvrir la revue depuis la/);
  assert.match(ui, /n\.seen \? "Vu" : "Nouveau"/, "a ticked line keeps its mark"); assert.ok(!/remove\(\)[^\n]*markSeen/.test(ui));
  assert.match(css, /\.new-flag \{/); assert.match(css, /\.new-flag\.seen \{/); assert.match(css, /#news-layer \{ position: fixed; inset: 0; z-index: 60; pointer-events: none; \}/);
});
