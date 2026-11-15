/* A DOM node given `null` writes the word « null » on the screen : `box.append(a, cond ? b : null)` is a mistake that shows.
   Children that may be missing go through el(), which drops them, or through `...[…].filter(Boolean)`. This reads every source file. */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../web/js/", import.meta.url).pathname;
const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === "vendor" ? [] : files(p)) : n.endsWith(".js") ? [p] : []; });
/* the index after a string that opens at i ; a template is followed through its ${ … } parts */
function afterString(s, i) {
  const q = s[i]; let j = i + 1;
  while (j < s.length) {
    if (s[j] === "\\") { j += 2; continue; }
    if (s[j] === q) return j + 1;
    if (q === "`" && s[j] === "$" && s[j + 1] === "{") { let depth = 1; j += 2; while (j < s.length && depth) { if ("\"'`".includes(s[j])) { j = afterString(s, j); continue; } if (s[j] === "{") depth++; else if (s[j] === "}") depth--; j++; } continue; }
    j++;
  }
  return j;
}
/* the arguments of a call whose opening parenthesis is just before i : each as [whole text, text at the top level only] */
function argsAt(s, i) {
  const out = []; let depth = 0, whole = "", top = "", j = i;
  const push = () => { out.push([whole.trim(), top.trim()]); whole = ""; top = ""; };
  while (j < s.length) {
    const c = s[j];
    if ("\"'`".includes(c)) { const k = afterString(s, j); whole += s.slice(j, k); j = k; continue; }
    if ("([{".includes(c)) depth++; else if (")]}".includes(c)) { if (!depth) { push(); return out; } depth--; } else if (c === "," && !depth) { push(); j++; continue; }
    whole += c; if (!depth && !")]}".includes(c)) top += c;
    j++;
  }
  return out;
}
export function nullChildren(source) {
  const hits = [];
  for (const m of source.matchAll(/\.(append|replaceChildren|prepend)\(/g)) for (const [whole, top] of argsAt(source, m.index + m[0].length)) {
    if (top.startsWith("...")) continue;                                                     // a spread list : filtered where it is built
    if (/:\s*(null|false|undefined)$/.test(top) || top.includes("&&")) hits.push({ line: source.slice(0, m.index).split("\n").length, arg: whole.slice(0, 90) });
  }
  return hits;
}

test("the reader itself : it sees a child that may be null, and lets pass what is safe", () => {
  assert.equal(nullChildren("box.append(el(\"p\"), msg ? el(\"p\", null, msg) : null, el(\"div\"));").length, 1);
  assert.equal(nullChildren("box.append(a && el(\"p\"));").length, 1);
  assert.equal(nullChildren("box.append(...[el(\"p\"), msg ? el(\"p\") : null].filter(Boolean));").length, 0);
  assert.equal(nullChildren("box.append(el(\"p\", null, msg ? el(\"b\") : null), el(\"div\", { x: a && b }));").length, 0, "inside el(), a missing child is dropped");
  assert.equal(nullChildren("box.append(el(\"p\", null, `${a ? \"x\" : null} : null`));").length, 0, "text inside a string is not code");
});

test("no screen can write the word « null » : no DOM call is given a child that may be missing", () => {
  const found = files(ROOT).flatMap((f) => nullChildren(readFileSync(f, "utf8")).map((h) => `${f.slice(ROOT.length)}:${h.line} — ${h.arg}`));
  assert.deepEqual(found, [], "wrap the children : box.append(...[a, cond ? b : null].filter(Boolean))");
});
