// The photo studio : lights one places, sets built around the product, and what a render keeps of them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { LIGHT_GROUPS, LIGHT_KINDS, LIGHT_SETUPS, DEFAULT_SETUP, MAX_LIGHTS, MAX_SHADOWS, tidyLight, tidyLights, setupLights, setupAmbient, addLight, copyLight, liveLights, shadowLights, lightDir, dirAngles, softAngle, kelvinRgb, kelvinHex, sampleDir, skyDir, plotXY, plotToLight, lightWords, lightGuide } from "../../web/js/core/photo_lights.js";
import { SET_GROUPS, SETS, validSet, setGroups, setHeight, setWet, paintSky, groundTile, groundFinish, facadeTile, setProps, setColors, vnoise, fbm } from "../../web/js/core/photo_sets.js";
import { SCENES, SHOTS, QUALITY, blankRender, renderOf, tidyRender, renderLights, shotAz, renderGuide } from "../../web/js/core/render_looks.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test("lights are grouped by nature ; each kind and each setup says what it is, in the words of the trade", () => {
  assert.deepEqual(LIGHT_GROUPS.map((g) => g.id), ["studio", "day"]); assert.equal(new Set(LIGHT_GROUPS.map((g) => g.color)).size, 2);
  assert.deepEqual(Object.keys(LIGHT_KINDS), ["key", "fill", "rim", "top", "sun"]);
  for (const [k, K] of Object.entries(LIGHT_KINDS)) { assert.ok(LIGHT_GROUPS.some((g) => g.id === K.group), k); assert.ok(K.label && K.fr && K.text, k); assert.ok(K.el >= 0 && K.el <= 90 && K.power > 0 && K.soft >= 0 && K.soft <= 1 && K.kelvin >= 2000 && K.kelvin <= 10000, k); }
  assert.deepEqual([LIGHT_KINDS.key.label, LIGHT_KINDS.fill.label, LIGHT_KINDS.rim.label, LIGHT_KINDS.sun.label], ["Key light", "Fill light", "Rim light", "Sun"]);
  assert.ok(LIGHT_SETUPS[DEFAULT_SETUP]); assert.ok(Object.keys(LIGHT_SETUPS).length >= 8);
  for (const [k, S] of Object.entries(LIGHT_SETUPS)) { assert.ok(S.label && S.fr && S.text, k); assert.ok(S.lights.length >= 1 && S.lights.length <= MAX_LIGHTS, k); assert.ok(S.ambient >= 0 && S.ambient <= 1.5, k); assert.ok(S.lights.some((l) => l.shadow), `${k} casts a shadow`); for (const l of S.lights) assert.ok(LIGHT_KINDS[l.kind], `${k} ${l.kind}`); }
  /* three-point, as it is taught : the key to one side and above, the fill on the other side, lower and weaker, the back light behind */
  const [key, fill, rim] = LIGHT_SETUPS["three-point"].lights; assert.ok(key.az < 0 && key.az >= -60 && key.el >= 30 && key.el <= 45); assert.ok(fill.az > 0 && fill.el < key.el && fill.power <= key.power / 2 + 1e-9 && !fill.shadow); assert.ok(Math.abs(rim.az) > 120 && rim.el > 20);
  /* the sun of a setup is low at the golden hour and high at noon, and warmer when low */
  const sun = (id) => LIGHT_SETUPS[id].lights.find((l) => l.kind === "sun"); assert.ok(sun("golden").el < 20 && sun("noon").el > 55 && sun("golden").kelvin < sun("noon").kelvin); assert.ok(!sun("overcast"));
});

test("a light is put back in its ranges ; a list keeps at most six, each with an id of its own", () => {
  assert.deepEqual(tidyLight({ kind: "nope", az: 540, el: 200, power: -3, soft: 9, kelvin: 123456, shadow: 0 }, 2), { id: "l3", kind: "key", az: 180, el: 90, power: 0, soft: 1, kelvin: 10000, shadow: false });
  assert.deepEqual(tidyLight({ id: "a", kind: "sun", az: -190 }), { id: "a", kind: "sun", az: 170, el: 42, power: 2.6, soft: 0.03, kelvin: 5400, shadow: true });
  assert.equal(tidyLight({ kind: "fill", off: 1 }).off, true); assert.equal("off" in tidyLight({ kind: "fill", off: false }), false);
  const many = tidyLights(Array.from({ length: 9 }, () => ({ id: "x", kind: "key" }))); assert.equal(many.length, MAX_LIGHTS); assert.equal(new Set(many.map((l) => l.id)).size, MAX_LIGHTS);
  assert.deepEqual(tidyLights("nope"), []); assert.deepEqual(tidyLights(null), []);
});

test("a setup is laid relative to the camera ; a light added stands where its kind usually does ; a copy is born Off", () => {
  const a = setupLights("three-point", 0), b = setupLights("three-point", 90);
  assert.deepEqual(a.map((l) => [l.id, l.kind, l.az]), [["l1", "key", -45], ["l2", "fill", 50], ["l3", "rim", 150]]); assert.deepEqual(b.map((l) => l.az), [45, 140, -120]);
  assert.equal(setupAmbient("low-key"), LIGHT_SETUPS["low-key"].ambient); assert.deepEqual(setupLights("nope", 0), setupLights(DEFAULT_SETUP, 0));
  const more = addLight(a, "sun", 10); assert.equal(more.length, 4); assert.deepEqual([more[3].id, more[3].kind, more[3].az], ["l4", "sun", 10 + LIGHT_KINDS.sun.az]);
  assert.equal(addLight(tidyLights(Array.from({ length: 6 }, () => ({ kind: "key" }))), "fill", 0).length, 6); assert.equal(addLight(a, "laser", 0).length, 3);
  const c = copyLight(a, "l1"); assert.equal(c.length, 4); assert.deepEqual([c[1].kind, c[1].off, c[1].az, c[1].id], ["key", true, -25, "l4"]); assert.equal(c[0].off, undefined); assert.equal(copyLight(a, "zz").length, 3);
  assert.equal(liveLights(c).length, 3); assert.equal(liveLights([{ kind: "key", power: 0 }]).length, 0);
  /* the three strongest lights that cast a shadow are the ones that do */
  const five = tidyLights([1, 3, 2, 5, 4].map((p, i) => ({ id: `s${i}`, kind: "key", power: p, shadow: true }))); assert.deepEqual(shadowLights(five), ["s3", "s4", "s1"]); assert.equal(MAX_SHADOWS, 3);
  assert.deepEqual(shadowLights([{ id: "a", kind: "key", shadow: true, off: true }, { id: "b", kind: "fill" }]), []);
});

test("where a light is : its direction, its size, its colour, and the samples that make its shadow soft", () => {
  assert.ok(near(lightDir(0, 0)[0], 1) && near(lightDir(90, 0)[1], 1) && near(lightDir(33, 90)[2], 1));
  for (const [az, el] of [[-80, 40], [150, 12], [10, 75]]) { const d = dirAngles(lightDir(az, el)); assert.ok(near(d.az, az, 1e-9) && near(d.el, el, 1e-9)); }
  assert.ok(near(softAngle(0), 0.25) && near(softAngle(1), 16) && softAngle(0.3) < softAngle(0.6)); assert.ok(softAngle(LIGHT_KINDS.sun.soft) < 0.5, "the sun is about half a degree across");
  /* colour temperature : 6500 K is the white of the screen, lower is warmer, higher is colder */
  assert.deepEqual(kelvinRgb(6500), [1, 1, 1]); assert.equal(kelvinHex(6500), "#ffffff");
  const warm = kelvinRgb(3200), cold = kelvinRgb(9000); assert.ok(warm[0] === 1 && warm[0] > warm[1] && warm[1] > warm[2]); assert.ok(cold[2] === 1 && cold[2] > cold[1] && cold[1] > cold[0]);
  assert.deepEqual(kelvinRgb(100), kelvinRgb(2000)); assert.deepEqual(kelvinRgb("x"), [1, 1, 1]);
  /* one sample is the centre of the lamp ; many stay inside its disc, fill it, and average to its centre */
  const key = { az: -45, el: 40, soft: 0.5 }, c = lightDir(-45, 40); assert.deepEqual(sampleDir(key, 0, 1), c);
  const N = 64, S = Array.from({ length: N }, (_, i) => sampleDir(key, i, N)), cone = (softAngle(0.5) * Math.PI) / 180, ang = (d) => Math.acos(Math.min(1, d[0] * c[0] + d[1] * c[1] + d[2] * c[2]));
  for (const d of S) { assert.ok(near(Math.hypot(...d), 1, 1e-9)); assert.ok(ang(d) <= cone + 1e-9); }
  assert.ok(Math.max(...S.map(ang)) > cone * 0.9, "the samples reach the rim of the source"); const mean = [0, 1, 2].map((k) => S.reduce((s, d) => s + d[k], 0) / N); assert.ok(ang(mean.map((x) => x / Math.hypot(...mean))) < cone * 0.08);
  const hard = Array.from({ length: 16 }, (_, i) => ang(sampleDir({ az: -45, el: 40, soft: 0 }, i, 16))); assert.ok(Math.max(...hard) < 0.005, "a hard light barely moves");
  /* the sky : every sample above the horizon, all around, and as many high as low per unit of sky */
  const K = Array.from({ length: 400 }, (_, i) => skyDir(i)); for (const d of K) { assert.ok(near(Math.hypot(...d), 1, 1e-9)); assert.ok(d[2] > Math.sin((4 * Math.PI) / 180) - 1e-9); }
  assert.ok(near(K.reduce((s, d) => s + d[2], 0) / 400, 0.535, 0.03), "the mean height is that of an even sky"); for (const q of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) assert.ok(K.filter((d) => d[0] * q[0] > 0 && d[1] * q[1] > 0).length > 80);
});

test("the plot : the camera at the bottom, a light on the right of the camera on the right, straight above at the centre", () => {
  const cam = -35; let p = plotXY(cam, 0, cam, 100); assert.ok(near(p[0], 0, 1e-9) && near(p[1], 100, 1e-9), "a light behind the camera is at the bottom");
  p = plotXY(cam + 90, 0, cam, 100); assert.ok(near(p[0], 100, 1e-9) && near(p[1], 0, 1e-9), "+90° is to the right of the camera"); p = plotXY(cam + 180, 0, cam, 100); assert.ok(near(p[1], -100, 1e-9));
  assert.ok(near(Math.hypot(...plotXY(12, 90, cam, 100)), 0, 1e-9)); assert.ok(near(Math.hypot(...plotXY(12, 45, cam, 100)), 50, 1e-9));
  for (const [az, el] of [[-80, 40], [115, 10], [20, 70]]) { const [x, y] = plotXY(az, el, cam, 88), back = plotToLight(x, y, cam, 88); assert.ok(near(back.az, az, 0.51) && near(back.el, el, 0.51), `${az}/${el}`); }
  assert.deepEqual(plotToLight(500, 0, 0, 88), { az: 90, el: 0 }, "past the rim : on the horizon");
  assert.match(lightWords({ az: cam - 45, el: 40, soft: 0.4 }, cam), /^à gauche · 40° de haut · douce$/); assert.match(lightWords({ az: cam + 150, el: 8, soft: 0.05 }, cam), /^derrière, à droite · rasante · dure$/); assert.match(lightWords({ az: cam + 178, el: 80, soft: 0.9 }, cam), /^derrière le produit · au-dessus · très douce$/);
});

test("the guide of the lighting : nothing lit, everything Off, no shadow, too many shadows, a light on the horizon", () => {
  const g = (l, a) => lightGuide(l, a).map((x) => `${x.level}${x.id ? `:${x.id}` : ""}`);
  assert.deepEqual(g(setupLights("three-point"), 0.35), []); assert.deepEqual(g([], 0.05), ["error"]); assert.deepEqual(g([], 0.8), []);
  assert.deepEqual(g([{ kind: "key", off: true }], 0.05), ["error"]); assert.deepEqual(g([{ kind: "key", off: true }], 0.6), ["warn"]);
  assert.deepEqual(g([{ kind: "fill" }], 0.3), ["tip"]); assert.deepEqual(g([1, 2, 3, 4].map(() => ({ kind: "key" })), 0.3), ["warn"]); assert.deepEqual(g([{ id: "s", kind: "sun", el: 2 }], 0.4), ["warn:s"]);
  for (const x of lightGuide([], 0)) assert.equal(x.field, "lights");
});

test("sets are grouped by nature ; each says what it is ; nothing names a real place, a ship or a mark", () => {
  assert.deepEqual(SET_GROUPS.map((g) => g.id), ["studio", "land", "sea", "city"]); assert.equal(new Set(SET_GROUPS.map((g) => g.color)).size, 4);
  for (const want of ["studio", "dark", "desert", "country", "seaside", "boat", "carrier", "city", "roof"]) assert.ok(SETS[want], want);
  assert.equal(SCENES, SETS, "the scenes of a render are the sets"); assert.deepEqual(setGroups().map((g) => g.items.length).reduce((a, b) => a + b), Object.keys(SETS).length);
  for (const [k, S] of Object.entries(SETS)) { assert.ok(SET_GROUPS.some((g) => g.id === S.group), k); assert.ok(S.fr && S.text, k); assert.ok(LIGHT_SETUPS[S.setup], `${k} comes with a lighting`); assert.ok(S.fog[1] > S.fog[0], k); assert.match(S.sky.top, /^#[0-9a-f]{6}$/); assert.ok(groundFinish(S.ground.kind).rough > 0, k); assert.equal(setColors(k).length, 4); }
  assert.equal(validSet("constructor"), null); assert.equal(validSet("desert"), "desert"); assert.equal(validSet(3), null);
  /* studios are lit by lamps, the outdoors by the sun */
  for (const [k, S] of Object.entries(SETS)) assert.equal(LIGHT_SETUPS[S.setup].group, S.sky.sun ? "day" : "studio", k);
  const words = read("web/js/core/photo_sets.js").toLowerCase(); for (const bad of ["nimitz", "uss ", "sahara", "manhattan", "paris", "tesla", "hdri", ".jpg", ".png", ".hdr", "http"]) assert.ok(!words.includes(bad), bad);
  /* no picture of a set enters the repository : everything is made by the tool */
  const imgs = readdirSync(new URL("../../web/img", import.meta.url), { recursive: true }).map(String).filter((f) => /sky|hdr|backplate|desert|dune|carrier/i.test(f)); assert.deepEqual(imgs, []);
});

test("the ground of a set : flat where the product stands, the same every time, and nothing rises between the camera and the product", () => {
  for (const id of Object.keys(SETS)) { for (const [x, y] of [[0, 0], [0.9, 0], [-0.6, 0.8], [0, -1.1]]) assert.ok(Math.abs(setHeight(id, x, y, 1.25)) < 1e-9, `${id} is flat under the product`); assert.equal(setHeight(id, 31.4, -17.2), setHeight(id, 31.4, -17.2)); }
  assert.equal(setHeight("nope", 5, 5), 0); for (const id of ["boat", "carrier", "roof"]) assert.equal(setHeight(id, 50, 50), 0, `${id} is a floor`);
  /* within the reach of a camera (ten radii), the land is never higher than a tenth of the product ; in the desert it falls away : the product is on a height */
  for (const id of ["desert", "country", "snow", "seaside"]) for (let a = 0; a < 360; a += 15) for (const d of [2, 4, 7, 10]) { const h = setHeight(id, d * Math.cos((a * Math.PI) / 180), d * Math.sin((a * Math.PI) / 180), 1.25); assert.ok(h < 0.12, `${id} ${a}° ${d} : ${h.toFixed(2)}`); }
  let low = 0; for (let a = 0; a < 360; a += 10) if (setHeight("desert", 14 * Math.cos((a * Math.PI) / 180), 14 * Math.sin((a * Math.PI) / 180), 1.25) < -0.8) low++; assert.ok(low >= 30, `the dune falls away on most sides (${low} of 36)`);
  const far = []; for (let a = 0; a < 360; a += 3) far.push(setHeight("desert", 90 * Math.cos((a * Math.PI) / 180), 90 * Math.sin((a * Math.PI) / 180))); assert.ok(Math.max(...far) - Math.min(...far) > 3, "far away, dunes");
  /* the shore : the land goes down to the water on one side, and is wet near it */
  const S = SETS.seaside, t = (S.shore.az * Math.PI) / 180, toSea = (d) => setHeight("seaside", d * Math.cos(t), d * Math.sin(t), 1.25); assert.ok(toSea(60) < S.water.level && toSea(120) < toSea(60)); assert.ok(setHeight("seaside", -40 * Math.cos(t), -40 * Math.sin(t), 1.25) > S.water.level, "dry land on the other side");
  assert.equal(setWet("seaside", 0, 0), 0); assert.equal(setWet("seaside", 80 * Math.cos(t), 80 * Math.sin(t)), 1); assert.equal(setWet("desert", 9, 9), 0); assert.equal(setWet("boat", 9, 9), 0);
  for (const [x, y] of [[0.3, 0.7], [12.5, -4.2]]) { const v = vnoise(x, y, 3), f = fbm(x, y, 3); assert.ok(v >= 0 && v <= 1 && f >= 0 && f <= 1); assert.equal(v, vnoise(x, y, 3)); }
});

test("the sky : the zenith on top, the sun where its light stands, the same picture every time ; the matter of a ground repeats without a seam", () => {
  const sky = SETS.desert.sky, sun = { az: -60, el: 34, kelvin: 5000 }, w = 256, h = 128, px = paintSky(sky, sun, w, h), at = (az, el) => { const x = Math.floor((((az / 360 + 0.5) % 1) + 1) % 1 * w), y = Math.floor(((90 - el) / 180) * h), o = 4 * (Math.min(h - 1, y) * w + x); return [px[o], px[o + 1], px[o + 2], px[o + 3]]; };
  assert.equal(px.length, w * h * 4); assert.deepEqual(Array.from(paintSky(sky, sun, w, h)), Array.from(px)); assert.equal(at(0, 50)[3], 255);
  const lum = (c) => c[0] + c[1] + c[2], hex = (c) => `#${c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  assert.ok(lum(at(-60, 34)) >= lum(at(120, 34)) && lum(at(-60, 34)) > 700, "the brightest place of the sky is the sun"); assert.ok(at(120, 85)[2] > at(120, 85)[0], "blue overhead"); assert.equal(hex(at(120, -40)), sky.horizon, "under the horizon, its colour : the ground melts in it");
  const none = paintSky(SETS.studio.sky, sun, 64, 32); assert.ok(none.every((v, i) => i % 4 === 3 || v > 200), "a studio has no sun, whatever the light");
  const cloudy = paintSky({ ...sky, cloud: 0.9 }, null, 128, 64), clear = paintSky({ ...sky, cloud: 0 }, null, 128, 64); let diff = 0; for (let i = 0; i < 128 * 30 * 4; i += 4) if (Math.abs(cloudy[i] - clear[i]) > 12) diff++; assert.ok(diff > 300, "clouds show in a cloudy sky");
  for (const kind of ["sand", "grass", "snow", "asphalt", "deck", "concrete", "planks", "seamless"]) {
    const n = 64, T = groundTile(kind, n); assert.equal(T.rgba.length, n * n * 4); assert.equal(T.bump.length, n * n); assert.deepEqual(Array.from(groundTile(kind, n).bump), Array.from(T.bump), kind);
    let mean = 0; for (let i = 0; i < n * n; i++) mean += T.rgba[4 * i + 1]; mean /= n * n; assert.ok(mean > (kind === "planks" ? 150 : 170), `${kind} is a tint, not a dark picture (${mean.toFixed(0)})`);
    if (kind === "seamless") continue;
    /* the step across the edge of the tile is no larger than the largest step inside it */
    let inside = 0, across = 0; for (let y = 0; y < n; y++) { for (let x = 0; x < n - 1; x++) inside = Math.max(inside, Math.abs(T.bump[y * n + x] - T.bump[y * n + x + 1])); across = Math.max(across, Math.abs(T.bump[y * n] - T.bump[y * n + n - 1])); } assert.ok(across <= inside + 2, `${kind} : ${across} across, ${inside} inside`);
  }
  const F = facadeTile(64, 4, 4, 3); assert.equal(F.length, 64 * 64 * 4); assert.ok(new Set(Array.from({ length: 64 * 64 }, (_, i) => F[4 * i])).size >= 3, "wall, dark and lit windows");
});

test("what stands around : boxes, posts, trees, painted lines — the same every time, and never where the product is", () => {
  for (const id of Object.keys(SETS)) {
    const P = setProps(id); assert.deepEqual(setProps(id), P, id); if (!SETS[id].props) { assert.equal(P.length, 0, id); continue; } assert.ok(P.length > 4, id);
    for (const p of P) { assert.ok(["box", "post", "bar", "paint", "tree", "rock"].includes(p.type), `${id} ${p.type}`);
      if (p.type === "paint") continue;                                          // a line is on the ground : the product may stand on it
      const at = p.at || [(p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2], half = p.type === "box" ? Math.max(p.size[0], p.size[1]) / 2 : 0.5;
      if (p.type !== "box" || p.at[2] + p.size[2] / 2 > 0.2) assert.ok(Math.hypot(at[0], at[1]) > 2.2 || Math.abs(at[0]) > 1.6 + (p.type === "box" ? p.size[0] / 2 : 0) || Math.abs(at[1]) > 1.6 + (p.type === "box" ? p.size[1] / 2 : 0) || half > 30, `${id} ${p.type} at ${at.map((v) => v.toFixed(1))} is on the product`); }
  }
  assert.ok(setProps("city").filter((p) => p.facade).length > 40); assert.ok(setProps("country").some((p) => p.type === "tree") && setProps("country").some((p) => p.type === "bar")); assert.ok(setProps("snow").every((p) => p.kind === "fir")); assert.ok(setProps("carrier").filter((p) => p.type === "paint").length > 20);
});

test("a render keeps its set, its lighting and its picture — and writes only what was chosen", () => {
  assert.deepEqual(tidyRender(null), blankRender()); assert.deepEqual(Object.keys(QUALITY), ["draft", "fine", "max"]); assert.ok(QUALITY.draft.n < QUALITY.fine.n && QUALITY.fine.n < QUALITY.max.n);
  const said = tidyRender({ scene: "desert", setup: "golden", ambient: 9, scale: 99, quality: "ultra", exposure: -7, lights: [{ kind: "sun", az: 400 }] });
  assert.deepEqual([said.scene, said.setup, said.ambient, said.scale, said.exposure, "quality" in said], ["desert", "golden", 1.5, 2.5, -2, false]); assert.deepEqual(said.lights, [{ id: "l1", kind: "sun", az: 40, el: 42, power: 2.6, soft: 0.03, kelvin: 5400, shadow: true }]);
  const plain = tidyRender({ scene: "city", setup: "nope", ambient: null, scale: 1, quality: "fine", exposure: 0, lights: null }); for (const k of ["setup", "lights", "ambient", "scale", "quality", "exposure"]) assert.equal(k in plain, false, k);
  const R = renderOf({ render: { scene: "desert" } }); assert.deepEqual([R.setup, R.lights, R.ambient, R.scale, R.quality, R.exposure], [null, null, null, 1, "fine", 0]);
  /* a render that says nothing of its lights follows the lighting of its set, laid for its camera */
  let L = renderLights(R); assert.deepEqual([L.setup, L.own, L.ambient], [SETS.desert.setup, false, LIGHT_SETUPS[SETS.desert.setup].ambient]); assert.deepEqual(L.lights, setupLights(SETS.desert.setup, SHOTS.hero.az));
  L = renderLights(renderOf({ render: { scene: "desert", shot: "front", setup: "golden" } })); assert.equal(L.setup, "golden"); assert.deepEqual(L.lights, setupLights("golden", SHOTS.front.az)); assert.equal(shotAz({ shot: "side", view: { az: 12, el: 3, dist: 9 } }), 12);
  /* lights placed by hand stay where they are, whatever the camera does ; the ambient light can be chosen on its own */
  L = renderLights(renderOf({ render: { scene: "desert", shot: "front", lights: [{ id: "k", kind: "key", az: 77 }], ambient: 0.9 } })); assert.deepEqual([L.own, L.lights[0].az, L.ambient], [true, 77, 0.9]);
  assert.deepEqual(renderLights(renderOf({ render: { lights: [] } })).lights, [], "no light at all is a choice too");
  /* the guide of the render also says what the lighting asks for */
  const g = (r) => renderGuide({ render: r }, []).filter((x) => x.level !== "tip").map((x) => `${x.level}:${x.field}`);      // (a render with no finish chosen gets a tip : not the matter here) assert.deepEqual(g({ scene: "desert" }), []); assert.deepEqual(g({ lights: [], ambient: 0 }), ["error:lights"]); assert.deepEqual(g({ scene: "atlantis" }), ["error:scene"]);
  /* it travels in the text of the assembly, and comes back the same */
  const asm = { dw: "assembly/1", id: "A", name: "A", instances: [], mates: [], render: tidyRender({ scene: "boat", shot: "road", setup: "noon", ambient: 0.7, scale: 1.5, exposure: 0.5, quality: "max", lights: [{ id: "l1", kind: "sun", az: -95, el: 30, power: 2.4, soft: 0.05, kelvin: 4800, shadow: true }, { id: "l2", kind: "fill", az: 20, el: 15, off: true }] }) };
  const text = toDwiz(asm); assert.match(text, /\nrender scene=boat shot=road size=hd ground=true labels=true setup=noon ambient=0.7 scale=1.5 quality=max exposure=0.5\n/); assert.match(text, /\n {2}light l1 sun az=-95 el=30 power=2.4 soft=0.05 kelvin=4800 shadow=true\n/);
  assert.deepEqual(tidyRender(fromDwiz(text).render), asm.render);
});

test("wiring : the stage draws the set and the lamps and refines the picture ; the screen places them ; the Assembly opens it", () => {
  const stage = read("web/js/core/render_stage.js"), rig = read("web/js/core/photo_rig.js"), acc = read("web/js/core/photo_accum.js"), build = read("web/js/core/photo_set_build.js"), screen = read("web/js/modules/render.js"), panel = read("web/js/modules/render_lights.js");
  assert.match(stage, /buildSet\(id, \{ pad: 1\.25 \* scale, ground: !!ground \}\)/); assert.match(stage, /new LightRig\(this\.scene\)/); assert.match(stage, /new Accum\(this\.renderer\)/);
  assert.match(stage, /this\.rig\.sample\(i, n\)/); assert.match(stage, /setViewOffset\(/, "each frame of a refined picture looks through another part of the pixel"); assert.match(stage, /async shoot\(w, h, o = \{\}\)/); assert.match(stage, /this\.rig\.show\(false\)/, "the lamps are never in the picture");
  assert.match(stage, /Math\.max\(floor, /, "a camera does not go under the ground");
  assert.match(rig, /sampleDir\(l, i, n\)/); assert.match(rig, /skyDir\(i\)/); assert.match(rig, /shadowLights\(this\.lights\)/); assert.match(rig, /for \(let i = 0; i < MAX_LIGHTS; i\+\+\)/, "every lamp exists from the start : no material is compiled again");
  assert.match(acc, /HalfFloatType/); assert.match(acc, /1 \/ \(this\.n \+ 1\)/, "each frame weighs as much as another"); assert.match(acc, /toneMapped: false/);
  assert.match(build, /receiveShadow = true/); assert.match(build, /setHeight\(id, x, y, pad\)/); assert.doesNotMatch(build, /TextureLoader|\.jpg|\.png|\.hdr|https?:/);
  assert.match(screen, /underVeil\(veil, /, "the picture is taken under a veil that can be given up"); assert.match(screen, /stop: \(\) => signal\.off/); assert.match(screen, /download\(`\$\{id\}_photo_/);
  assert.match(screen, /oneLight\(lid, "Lumière déplacée"/); assert.match(screen, /copyLight\(own\(x\), lid\)/); assert.match(screen, /setGroups\(\)\.map/); assert.match(screen, /lightsPanel\(\{/);
  assert.match(panel, /onOff\(on, \(next\) => o\.toggle\(l\.id, next\)/, "a light has the On \/ Off of every list"); assert.match(panel, /type: "number"/); assert.match(panel, /ArrowLeft: \[-step, 0\]/, "a lamp of the plot moves with the arrows too");
  assert.match(read("web/js/modules/assembly.js"), /href: `#\/render\/\$\{encodeURIComponent\(id\)\}`, "data-photo": ""/); assert.match(read("web/js/core/app.js"), /key === "render" \|\| key === "labels" \? "assembly"/);
  assert.match(read("web/js/core/app.js"), /e\.key === "Escape"\) \{ const open = document\.querySelector\("\.topbar \.menu"\)/, "Escape closes a menu of the top bar, the guide too");
  for (const f of ["web/js/core/photo_lights.js", "web/js/core/photo_sets.js"]) assert.doesNotMatch(read(f), /document\.|from "\.\.\/\.\.\/vendor/, `${f} is pure`);
});
