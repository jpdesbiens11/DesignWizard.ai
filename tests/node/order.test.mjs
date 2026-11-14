// Ordering a prototype: readiness, lead time, request for quotation, and the zip that carries the package.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { routing } from "../../web/js/cad/shop.js";
import { orderCheck, rfqText, LEAD } from "../../web/js/cad/order.js";
import { zip, crc32 } from "../../web/js/core/zip.js";
import { synthesize } from "../../web/js/core/shop_intent.js";
import { fromTemplate } from "../../web/js/cad/templates.js";
import { PROCESSES } from "../../web/js/cad/materials.js";

const clean = { summary: { errors: 0, warnings: 0 } };
const bolt = (screw, dx, dy, extra) => ({ type: "bolt_pattern", params: { screw, pattern: { type: "rect", nx: 2, ny: 2, dx, dy } }, ...extra });

test("a laser-cut sheet is an express prototype; finish, odd stock and set-ups each cost days", async () => {
  const K = await kernel();
  const { spec } = synthesize({ name: "Patte", material: "SS-304", form: "sheet", quantity: 5, interfaces: [bolt("M4", 60, 40, { side: "A", where: "+Z" })] }, "P-1");
  const b = buildPart(K, spec), r = routing(spec, b), c = orderCheck(spec, b, clean, r);
  assert.equal(c.ready, true); assert.equal(c.express, true); assert.deepEqual(c.days, [1, 3]); assert.equal(c.quantity, 5);
  assert.match(c.label, /Prête à commander — 1 à 3 jours/);
  const painted = orderCheck({ ...spec, finish: "Peinture poudre noire" }, b, clean, r);
  assert.deepEqual(painted.days, [3, 8]); assert.equal(painted.express, false); assert.ok(painted.drivers.some((d) => /commandez brut/.test(d)));
  const many = orderCheck(spec, b, clean, r, { quantity: 200 });
  assert.ok(many.days[1] > c.days[1] && many.quantity === 200);
  const odd = { ...spec, params: { ...spec.params, t: { ...spec.params.t, value: 2.2 } } }, bo = buildPart(K, odd), co = orderCheck(odd, bo, clean, routing(odd, bo));
  assert.ok(co.days[1] > c.days[1] && co.drivers.some((d) => /Brut/.test(d)), "a thickness that is not a stock gauge slows the order");
  K.flush();
});

test("DFx errors block the order; a tooling process is flagged as not a prototype route", async () => {
  const K = await kernel();
  const plate = fromTemplate("plate", "T-1"), b = buildPart(K, plate), r = routing(plate, b);
  const blocked = orderCheck(plate, b, { summary: { errors: 2, warnings: 1 } }, r);
  assert.equal(blocked.ready, false); assert.match(blocked.label, /À corriger/); assert.ok(blocked.blockers[0].includes("2 règle(s) DFx"));
  assert.ok(orderCheck(plate, b, null, r).cautions.some((x) => /non évaluées/.test(x)));
  const enc = fromTemplate("enclosure", "T-2"), be = buildPart(K, enc), ce = orderCheck(enc, be, clean, routing(enc, be));
  assert.equal(ce.ready, true); assert.equal(ce.express, false); assert.match(ce.label, /pas en délai de prototype/);
  assert.ok(ce.cautions.some((x) => /MJF PA12/.test(x)), "the fast route for a moulded part is said");
  assert.equal(orderCheck({ ...plate, material: "" }, b, clean, r).ready, false);
  for (const p of Object.keys(PROCESSES)) assert.ok(LEAD[p], `lead time missing for ${p}`);
  K.flush();
});

test("the request for quotation says what a shop needs, and nothing private", async () => {
  const K = await kernel();
  const { spec } = synthesize({ name: "Plaque d'adaptation", material: "AL6061-T6", quantity: 4, interfaces: [bolt("M5", 80, 50, { side: "A", where: "-Z" }), bolt("M3", 24, 18, { side: "B", where: "+Z" })] }, "PN-0042");
  const b = buildPart(K, spec), r = routing(spec, b), c = orderCheck(spec, b, clean, r), text = rfqText(spec, b, r, c, { need_by: "2026-12-01", note: "Essai de vibration" }, ["PN-0042.step", "PN-0042.pdf"]);
  for (const s of ["DEMANDE DE PRIX — PROTOTYPE", "PN-0042 — Plaque d'adaptation", "Quantité : 4", "Livraison souhaitée : 2026-12-01", "Aluminium 6061-T6", "Plaque de 5 mm", "tarauder M3", "Essai de vibration", "  - PN-0042.step", "prix unitaire, délai ferme"]) assert.ok(text.includes(s), `missing: ${s}`);
  assert.ok(!text.includes("@") && !/undefined|NaN/.test(text));
  K.flush();
});

test("zip: a valid archive that standard tools open", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const bytes = zip([{ name: "demande_de_prix.txt", bytes: "Bonjour — pièce n° 1\n" }, { name: "pièce/DW-1.stl", bytes: new Uint8Array([1, 2, 3, 255]) }, { name: "vide.txt", bytes: "" }]);
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  const file = path.join(mkdtempSync(path.join(tmpdir(), "dwzip-")), "t.zip");
  writeFileSync(file, bytes);
  const out = execFileSync("python3", ["-I", "-c", "import sys, zipfile\nz = zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint('|'.join(f'{i.filename}:{i.file_size}' for i in z.infolist()))\nprint(z.read('demande_de_prix.txt').decode('utf-8').strip())", file], { encoding: "utf8" }).trim().split("\n");
  assert.equal(out[0], "demande_de_prix.txt:25|pièce/DW-1.stl:4|vide.txt:0");
  assert.equal(out[1], "Bonjour — pièce n° 1");
});
