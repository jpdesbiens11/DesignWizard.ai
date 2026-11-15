/* The guided presentation (web/presentation.html) : every slide is complete, every picture exists, nothing comes from
   outside, the rail knows its stations — read from the files, without a browser. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { STAGES, stationAt, markerAt, clampSlide, fitScale, STAGE_W, STAGE_H } from "../../web/js/presentation.js";

const web = new URL("../../web/", import.meta.url), read = (f) => readFileSync(new URL(f, web), "utf8");
const html = read("presentation.html"), css = read("css/presentation.css");
const slides = html.split('<section class="slide').slice(1).map((s) => s.slice(0, s.indexOf("</section>")));
const attr = (s, name) => (new RegExp(`${name}="([^"]*)"`).exec(s) || [])[1];

test("the deck : every slide has its title, its notes and a station of the rail ; the modules come in the order of a design", () => {
  assert.ok(slides.length >= 20 && slides.length <= 30, `${slides.length} slides`);
  const keys = new Set(STAGES.map(([k]) => k)); let last = -1;
  slides.forEach((s, i) => {
    assert.ok(/<h[12][ >]|class="big/.test(s), `slide ${i + 1} : a title`); assert.ok(/<aside class="notes"><ul><li>/.test(s), `slide ${i + 1} : notes for the presenter`);
    const st = attr(s, "data-stage"); assert.ok(st === "debut" || st === "fin" || keys.has(st), `slide ${i + 1} : station « ${st} »`);
    const at = st === "debut" ? -1 : st === "fin" ? STAGES.length : STAGES.findIndex(([k]) => k === st); assert.ok(at >= last, `slide ${i + 1} : the rail never goes back`); last = at;
  });
  for (const [k] of STAGES) assert.ok(slides.some((s) => attr(s, "data-stage") === k), `a slide for the station « ${k} »`);
  assert.equal(slides.filter((s) => /data-annex/.test(s)).length, 1); assert.ok(/data-annex/.test(slides[slides.length - 1]), "the annex comes last");
  const modules = slides.filter((s) => /class="cols"/.test(s)); assert.ok(modules.length >= 12);
  for (const s of modules) { assert.ok(/class="shot r"><img src="img\/tour\/[a-z]+\.jpg" alt="[^"]{20,}"/.test(s), "a module shows the tool, with a described picture"); assert.ok(/class="before r"/.test(s) && /class="go r" href="index\.html#\/[a-z]+"/.test(s) && /class="take r"/.test(s), "today, here, a link to the demo, what to remember"); }
});

test("nothing comes from outside : pictures, style and script are files of the site, and the page allows nothing else", () => {
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'"/);
  assert.ok(!/ style="/.test(html) && !/<style/.test(html) && !/ on[a-z]+="/.test(html), "no inline style, no inline handler : the policy would block them");
  const srcs = [...html.matchAll(/(?:src|href)="([^"#]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
  for (const u of srcs) { if (/^https:\/\/github\.com\//.test(u)) continue; assert.ok(!/^[a-z]+:/i.test(u) && !u.startsWith("//"), `${u} : a file of the site`); assert.ok(existsSync(new URL(u, web)), `${u} exists`); }
  assert.ok(!/url\(|@import|https?:/.test(css), "the style sheet loads nothing");
  for (const m of html.matchAll(/src="(img\/tour\/[a-z]+\.jpg)"/g)) assert.ok(statSync(new URL(m[1], web)).size < 400000, `${m[1]} stays light`);
  assert.ok(html.split("\n").length < 500 && css.split("\n").length < 500);
  assert.ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(html.replace(/@page|@media|@keyframes/g, "")), "no e-mail address in the page");
});

test("the rail and the stage : stations spread from the idea to the order, the marker follows, the stage fits any window", () => {
  assert.equal(STAGES.length, 12); assert.deepEqual([STAGES[0][0], STAGES[11][0]], ["idee", "commande"]);
  assert.deepEqual([stationAt(0), stationAt(11), markerAt("debut"), markerAt(""), markerAt("fin"), markerAt("idee"), markerAt("commande")], [4, 96, 0, 0, 100, 4, 96]);
  for (let i = 1; i < STAGES.length; i++) assert.ok(stationAt(i) > stationAt(i - 1));
  assert.deepEqual([clampSlide(-3, 26), clampSlide(99, 26), clampSlide(4.4, 26), clampSlide(NaN, 26)], [0, 25, 4, 0]);
  assert.deepEqual([fitScale(STAGE_W, STAGE_H), fitScale(800, 900), fitScale(3200, 900)], [1, 0.5, 1]);
});
