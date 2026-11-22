/* The project « BM 8s8p - 21700 », iteration 11 b (JP, 22 novembre 2026 : « celui du fond aura le connecteur LV et HV qui se connecte quand le BM
   est swappé dans sa cavité d'installation ou la station de recharge, et contient aussi [peut-être] la carte BMS principale, et le contacteur
   interne du BM » ; the interface rings in machined aluminium) : the bottom lid.
     node --test tests/node/bm_bottom.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, CASE_Y0 } from "../../web/js/demo/demo_bm.js";
import { buildPart } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { matFromPlacement } from "../../web/js/cad/vec.js";
import { fabPlayable } from "../../web/js/core/fab_path.js";
import { caseSection } from "../../web/js/demo/demo_bm_case.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const BOT = ["BM-LID-RING-BOT", "BM-POST", "BM-LID-BOT", "BM-SWAP-CONN", "BM-CONTACTOR", "BM-BMS-BOARD", "BM-LID-STRAPS"];
let cache = null;
async function bottom() {
  if (cache) return cache;
  const K = await kernel(), p = bmProject(), find = (id) => p.assemblies.find((a) => a.id === id), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  const flat = flatAsm(find("BM-8S8P-ASM"), find), place = (i) => ({ id: i.id, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, matFromPlacement(i.placement)) })) });
  const near1 = flat.instances.filter((i) => /^(couvercle_fond~|retour$|boitier$|borne_moins$|core1~)/.test(i.id)).map(place);
  cache = { K, p, built, near1, box: (id, body) => { const x = near1.find((q) => q.id === id); return K.bbox((body ? x.bodies.find((b) => b.name === body) : x.bodies[0]).shape); } }; return cache;
}

test("the bottom lid builds : no error ; the machined ring and spacers, the molded housing pass their DFx rules", async () => {
  const { p, built } = await bottom();
  for (const id of BOT) assert.deepEqual(built.get(id).log.filter((l) => l.level === "error"), [], id);
  for (const id of ["BM-LID-RING-BOT", "BM-POST", "BM-LID-BOT"]) { const f = checkPart(p.parts.find((s) => s.id === id), built.get(id)); assert.deepEqual((f.findings || f).filter((x) => x.severity === "error" || x.severity === "warn").map((x) => x.id || x.rule), [], id); }
  assert.equal(p.parts.find((s) => s.id === "BM-LID-RING-BOT").material, "AL6061-T6");
  for (const id of ["BM-SWAP-CONN", "BM-CONTACTOR", "BM-BMS-BOARD", "BM-LID-STRAPS"]) assert.equal(fabPlayable(p.parts.find((s) => s.id === id)).ok, false, `${id} : bought, not played`);
});

test("the bottom end closes : nothing goes through anything — ring, spacers, housing, connector, contactor, BMS volume, straps, return busbar, − terminal, casing, CORE 1", async () => {
  const { K, near1 } = await bottom(), bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  for (let i = 0; i < near1.length; i++) for (let j = i + 1; j < near1.length; j++) { const A = near1[i], B = near1[j]; if (A.id.startsWith("core1~") && B.id.startsWith("core1~")) continue;
    for (const a of A.bodies) for (const b of B.bodies) { if (!ov(bb(a.shape), bb(b.shape))) continue; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${A.id}/${a.name} × ${B.id}/${b.name} : ${v.toFixed(3)}`); } }
  assert.deepEqual(out, []);
});

test("the push of the stack ends on the ring : each spacer from the backing plate of the − terminal to a tab of the ring ; the ring on the end of the casing", async () => {
  const { box } = await bottom(), backer = box("borne_moins", "appui"), ring = box("couvercle_fond~anneau");
  near(ring[4], CASE_Y0, "the ring on the end of the casing"); near(box("couvercle_fond~couvercle")[4], ring[1], "the housing on the ring");
  for (const k of [1, 2, 3, 4]) { const s = box(`couvercle_fond~entretoise_${k}`); near(s[4], backer[1], `spacer ${k} on the backing plate`); near(s[1], ring[4], `spacer ${k} on the ring`);
    assert.ok(s[0] < backer[3] && s[3] > backer[0], `spacer ${k} under the backing plate`); }
});

test("the power path : return busbar → contactor (PACK+), contactor → HV+ pin, − terminal → HV− pin ; the connector out of the bottom face", async () => {
  const { box, p } = await bottom(), straps = p.parts.find((s) => s.id === "BM-LID-STRAPS"), conn = p.parts.find((s) => s.id === "BM-SWAP-CONN"), cont = p.parts.find((s) => s.id === "BM-CONTACTOR");
  assert.equal(straps.bodies.plus.net, "PACK+"); assert.equal(straps.bodies.hv.net, "HV+"); assert.equal(straps.bodies.moins.net, "PACK-");
  assert.equal(cont.bodies.borne_a.net, "PACK+"); assert.equal(cont.bodies.borne_b.net, "HV+"); assert.equal(conn.bodies.hv_plus.net, "HV+"); assert.equal(conn.bodies.hv_moins.net, "PACK-");
  const bar = box("retour"), foot = box("couvercle_fond~barres", "plus"), top = caseSection().channel.z1 - 0.5;      // the bar in its channel : 0.5 mm under the floor
  near(foot[2], top, "the PACK+ strap stands on the return busbar"); assert.ok(foot[1] <= bar[1] + 1e-6, "it reaches the end of the return busbar");
  near(box("couvercle_fond~barres", "moins")[4], box("borne_moins", "plaque")[1], "the PACK− strap on the bare land of the − terminal");
  const pins = [box("couvercle_fond~connecteur", "hv_plus"), box("couvercle_fond~connecteur", "hv_moins")]; near(pins[0][4], box("couvercle_fond~barres", "hv")[1], "the HV+ pin meets its strap"); near(pins[1][4], box("couvercle_fond~barres", "moins")[1], "the HV− pin meets its strap");
  assert.ok(box("couvercle_fond~connecteur")[1] < box("couvercle_fond~couvercle")[1], "the connector stands out of the bottom face : it engages blind in the cavity");
  assert.match(conn.notes.join(" "), /aucune série/); assert.match(cont.notes.join(" "), /rien de cela n'a été lu/); assert.match(p.parts.find((s) => s.id === "BM-BMS-BOARD").notes.join(" "), /30 × 48/);
});
