// Loads the vendored OpenCascade kernel in Node for the tests.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { makeKernel } from "../../web/js/cad/occ.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const occDir = path.resolve(here, "../../web/vendor/occ");
let cached = null;
export async function kernel() {
  if (cached) return cached;
  const mod = await import(pathToFileURL(path.join(occDir, "replicad_single.js")).href);
  const oc = await mod.default({ wasmBinary: readFileSync(path.join(occDir, "replicad_single.wasm")), print: () => {}, printErr: () => {} });
  cached = makeKernel(oc);
  return cached;
}
