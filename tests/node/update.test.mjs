/* A page kept open says when a newer version is published : the pure half of core/update_check.js, and the four places where
   the version is written, which must say the same. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseVersion, newer, versionOf, dueCheck, ownFiles } from "../../web/js/core/update_check.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("update : a version is newer by its numbers, not by its letters", () => {
  assert.deepEqual(parseVersion("0.86.1"), [0, 86, 1]);
  assert.equal(newer("0.86.1", "0.86.0"), true); assert.equal(newer("0.86.0", "0.86.1"), false); assert.equal(newer("0.86.0", "0.86.0"), false);
  assert.equal(newer("0.100.0", "0.99.9"), true, "100 is after 99"); assert.equal(newer("1.0.0", "0.99.9"), true); assert.equal(newer("0.86", "0.86.0"), false); assert.equal(newer("0.86.0.1", "0.86"), true);
  assert.equal(newer("", "0.86.0"), false); assert.equal(newer(null, "0.1.0"), false);
});

test("update : only a version.json that is one is believed", () => {
  assert.equal(versionOf({ version: "0.86.1" }), "0.86.1"); assert.equal(versionOf({ version: " 0.86.1\n" }), "0.86.1");
  for (const bad of [null, {}, { version: 86 }, { version: "latest" }, { version: "0.86.1-beta" }, { version: "<html>" }, "0.86.1"]) assert.equal(versionOf(bad), null);
});

test("update : the page does not ask more often than every two minutes", () => {
  assert.equal(dueCheck(1000, 0), true, "never asked : now"); assert.equal(dueCheck(200000, 100000), false); assert.equal(dueCheck(230000, 100000), true);
});

test("update : what is fetched anew is what the page had loaded from this site — scripts, styles, pictures drawn as text", () => {
  const o = "https://example.test", got = ownFiles([`${o}/app/js/core/app.js`, `${o}/app/js/core/app.js?t=3`, `${o}/app/css/app.css`, `${o}/app/img/icons.svg#i-plus`, `${o}/app/kernel/occt.wasm`, `${o}/app/video/film.mp4`, "https://accounts.google.com/gsi/client", `${o}/app/acces.json`], o);
  assert.deepEqual(got, [`${o}/app/js/core/app.js`, `${o}/app/css/app.css`, `${o}/app/img/icons.svg`, `${o}/app/acces.json`], "each once, without its query ; not the heavy kernel, not another site");
  assert.deepEqual(ownFiles(null, o), []);
});

test("version : the four places where it is written say the same", () => {
  const app = (read("web/js/core/app.js").match(/APP_VERSION = "([\d.]+)"/) || [])[1];
  assert.ok(app, "APP_VERSION is in web/js/core/app.js");
  assert.equal(JSON.parse(read("package.json")).version, app, "package.json");
  assert.equal(versionOf(JSON.parse(read("web/version.json"))), app, "web/version.json — what an open page reads to offer the update");
  assert.ok(read("README.md").includes(`(v${app} : `), "the head of the README names the version");
});

test("wiring : the top bar carries the update button, the application watches, the browser remembers every file", () => {
  const app = read("web/js/core/app.js");
  assert.match(app, /updateButton\(\), newsButton\(\), guideButton\(\)/); assert.match(app, /installUpdateCheck\(\{ running: APP_VERSION, save:/);
  assert.match(read("web/js/boot.js"), /setResourceTimingBufferSize\(3000\)/);
  assert.match(read("web/js/core/update_check.js"), /fetch\(`version\.json\?t=\$\{last\}`, \{ cache: "no-store" \}\)/);
});
