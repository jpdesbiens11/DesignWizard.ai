/* A class that makes a floating window is used by its window only (JP, 26 novembre 2026, sur une capture de la Vérification : « bug… ») : the
   traceability matrix was a table of class « swm » — the same name as the monitoring window, `position: fixed`, dark, 25 rem wide — so the
   table floated over the page. Every class whose rule fixes it to the screen is listed here with the files that may use it ; a new user is said.
   node --test tests/node/css_fixed_classes.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const WEB = new URL("../../web/", import.meta.url).pathname;
/* the floating windows, and the files that draw them */
const OWNERS = { "modal-backdrop": ["dom.js"], toasts: ["dom.js"], "sk-tip": ["dom.js"], "ctx-menu": ["view_select.js"], "code-view": ["code_view.js"], "look-pop": ["part_look.js"],
  "new-flag": ["whats_new_ui.js"], manip: ["elab_manip.js", "sw_hil_ui.js"], "pick-pop": ["pick_list.js"], "lib-stage": ["library_preview.js"], swm: ["sw_monitor_ui.js", "sw_balance_ui.js"],
  "swf-card": ["sw_fix_ui.js"], "swf-quiz": ["sw_fix_ui.js"], panel: ["panes.js", "whats_new_ui.js"] };
const files = (d, ext) => { const out = []; const walk = (x) => { for (const f of readdirSync(x)) { const p = join(x, f); if (statSync(p).isDirectory()) walk(p); else if (ext.test(f)) out.push(p); } }; walk(d); return out; };

test("every class that floats a window over the page is used by that window only", () => {
  const css = files(join(WEB, "css"), /\.css$/).map((f) => readFileSync(f, "utf8")).join("\n"), fixed = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) if (/position:\s*fixed/.test(m[2])) for (const sel of m[1].split(",")) { const c = /^\s*\.([\w-]+)\s*$/.exec(sel); if (c) fixed.add(c[1]); }
  const js = files(join(WEB, "js"), /\.m?js$/).map((f) => [basename(f), readFileSync(f, "utf8")]), bad = [];
  for (const c of fixed) { const re = new RegExp(`class(?:Name)?\\s*[:=]\\s*[\`"'][^\`"']*(?<![-\\w])${c}(?![-\\w])`);
    for (const [name, text] of js) if (re.test(text) && !(OWNERS[c] || []).includes(name)) bad.push(`${name} uses « ${c} », a floating window (position: fixed) — give it a name of its own`); }
  assert.deepEqual(bad, []);
});
