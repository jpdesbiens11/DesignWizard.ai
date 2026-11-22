/* Point 6 (JP, 20 novembre 2026) : each board has a role — « Produit » or « Banc d'essai » ; only the first enter the assembly, the isolation
   and the report.
     node --test tests/node/board_role.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOARD_ROLES, roleOf, setRole, productBoards, benchBoards, roleIssues } from "../../web/js/pcba/board_role.js";
import { syncTwins } from "../../web/js/pcba/twin.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { firstBoard } from "../../web/js/demo/demo_first.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("a board is of the product unless it says otherwise ; the role is written only when it is the bench", () => {
  const b = firstBoard(); assert.equal(roleOf(b), "product"); setRole(b, "bench"); assert.equal(b.role, "bench"); assert.equal(roleOf(b), "bench"); setRole(b, "product"); assert.equal("role" in b, false);
  const P = { boards: [{ id: "A" }, { id: "B", role: "bench" }] }; assert.deepEqual(productBoards(P).map((x) => x.id), ["A"]); assert.deepEqual(benchBoards(P).map((x) => x.id), ["B"]);
  for (const R of Object.values(BOARD_ROLES)) assert.ok(/^#[0-9a-f]{6}$/.test(R.color) && R.icon && R.fr && R.says);
});

test("no twin is born for a board of the bench ; a bench board mounted in the product is said", () => {
  const prod = firstBoard(), bench = { ...firstBoard(), id: "BENCH-1", role: "bench" }, P = { parts: [], boards: [prod, bench], assemblies: [] };
  const made = syncTwins(P, LIBRARY); assert.deepEqual(made.map((m) => m.board), [prod.id], "only the board of the product has its twin"); assert.equal(bench.part, undefined);
  bench.part = "TW-9"; P.assemblies.push({ id: "ASM", instances: [{ id: "i1", part: "TW-9" }] }); const I = roleIssues(P); assert.equal(I.length, 1); assert.match(I[0].text, /carte de banc d'essai.*ASM/);
});

test("wired : the role in the head of the PCBA ; the isolation, the guide and the report keep the boards of the product", () => {
  assert.match(read("web/js/modules/pcba.js"), /roleSwitch\(board/); assert.match(read("web/js/modules/pcba.js"), /role: "radiogroup"/);
  assert.match(read("web/js/modules/creepage_board.js"), /productBoards\(store\.project\)\.map/); assert.match(read("web/js/core/guide_checks.js"), /roleIssues\(project\)/);
  assert.match(read("web/js/modules/report.js"), /data-bench-boards/); assert.match(read("web/js/pcba/twin.js"), /roleOf\(b\) === "bench"/);
});
