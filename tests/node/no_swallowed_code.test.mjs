/* A line comment never swallows code (JP, 25 novembre 2026, sur une capture : « je ne vois plus rien dans l'interface de bloc logiciel ») : a comment
   written at the end of a long line, before more code, turned that code into comment — the button of the BM update was never made, the next
   line called it, and the whole screen stopped. Three times in a day : every line of web/js is read, and code after a `//` is refused.
   node --test tests/node/no_swallowed_code.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../web/js/", import.meta.url).pathname;
const CODE = /(\b(const|let) [A-Za-z_$][\w$]* (=|of) )|(\b(else|return)\b [\w$.]+\([^)]*\);)|(\) \{ [\w$]+[.(= ])|(\}\);?\s*$)/;
/** The lines where a `//` comment carries what reads as code. → ["file:line: text"] */
export function swallowed(text, name = "") {
  const out = []; text.split("\n").forEach((line, i) => { const m = /(?:^|[;,){}\]]\s+)\/\/ (.*)$/.exec(line); if (m && CODE.test(m[1])) out.push(`${name}:${i + 1}: ${m[1].slice(0, 120)}`); }); return out;
}
test("the guard sees the three cases of the day, and lets a plain comment be", () => {
  assert.equal(swallowed(`  if (x) { a(); }      // older than its profiles (v0.195.0) const u = btn("x");`).length, 1);
  assert.equal(swallowed(`  ok(); }      // the usage profile (modules/sw_story_ui.js) else stopBench();`).length, 1);
  assert.equal(swallowed(`  mode = 1;      // a file is a software ; for (const b of box.children) { b.on = 1; }`).length, 1);
  assert.equal(swallowed(`  const a = 1;      // the time, in ms : one step of the period`).length, 0);
});
test("no line of web/js hides code behind a `//`", () => {
  const files = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.m?js$/.test(f)) files.push(p); } }; walk(ROOT);
  assert.deepEqual(files.flatMap((f) => swallowed(readFileSync(f, "utf8"), f.slice(ROOT.length))), []);
});
