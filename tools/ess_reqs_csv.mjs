// Writes the test base of the ESS requirements, in the format of a DynamiteAgile export, from its source (web/js/demo/demo_ess_reqs.js).
//   node tools/ess_reqs_csv.mjs        → web/examples/exemple_exigences_ess.csv (a test holds the two equal)
import { writeFileSync } from "node:fs";
import { essList, ESS_FILE } from "../web/js/demo/demo_ess_reqs.js";
import { toAgileCsv } from "../web/js/core/reqs.js";

const L = essList(), out = new URL(`../web/examples/${ESS_FILE}`, import.meta.url);
writeFileSync(out, toAgileCsv({ head: L.head, rows: L.rows, alloc: {} }), "utf8");
console.log(`${ESS_FILE} : ${L.rows.length} lignes (${L.rows.filter((r) => r.kind === "Need").length} besoins, ${L.rows.filter((r) => r.kind !== "Need").length} exigences)`);
