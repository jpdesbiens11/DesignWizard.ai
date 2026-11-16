/* A pressure contact in its three forms : pointed bosses embossed in the bar (and, as an option, projection-welded), spring
   blades lanced in a thin bar, a band of lamellae laid between the lands — what each is made of, what the platform advises
   for a current, a voltage and a thickness, and the solids the kernel makes of them. */
import test from "node:test";
import assert from "node:assert/strict";
import { ELEC_INTERFACES, CONTACT_FORMS, CONTACT_BASES, PROJECTIONS, VOLTAGE_CLASSES, contactForm, projectionFor, voltageClass, bridgeSpring, contactLayout, contactAdvice, contactFacts, contactFormNotes, contactEstimate, elecProcess } from "../../web/js/cad/interfaces_elec.js";
import { blankBusbar, addContact, busbarPart, busbarChecks, contactParams } from "../../web/js/core/busbar.js";
import { buildPart } from "../../web/js/cad/build.js";
import { toFeatureScript } from "../../web/js/cad/featurescript.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test("a contact says its form ; one that says nothing is the band it always was", () => {
  assert.deepEqual(Object.keys(CONTACT_FORMS), ["cone", "bridge", "band"]); assert.ok(CONTACT_FORMS.cone.integral && CONTACT_FORMS.bridge.integral && !CONTACT_FORMS.band.integral);
  assert.equal(contactForm({}, {}), "band"); assert.equal(contactForm({}, { band: "insert" }), "band"); assert.equal(contactForm({}, { band: "integral" }), "cone");
  assert.equal(contactForm({ form: "bridge" }, { band: "insert" }), "bridge"); assert.equal(contactForm({ form: "nope" }), "band");
  const C = ELEC_INTERFACES.contact, p = { ...C.params };
  assert.equal(C.hardware(p, C.optsA).length, 1, "the band is a part to buy"); assert.equal(C.hardware({ ...p, form: "cone" }, C.optsA).length, 0); assert.equal(C.hardware({ ...p, form: "bridge" }, C.optsA).length, 0);
  assert.equal(C.signature(p), "20x8|n8|Ag", "an old contact keeps its key"); assert.equal(C.signature({ ...p, form: "cone" }), "20x8|n8|Ag|cone"); assert.equal(C.signature({ ...p, form: "cone", weld: "projection" }), "20x8|n8|Ag|cone|soudé");
});

test("the bosses follow the series read in ISO/FDIS 8167 : a height of a quarter of the diameter", () => {
  assert.deepEqual(PROJECTIONS[1], [2, 0.5]); assert.ok(PROJECTIONS.every(([d, a]) => Math.abs(a - d / 4) <= 0.03), "a = d1 / 4, to the rounding of the series");
  assert.deepEqual(projectionFor(0.5), { d1: 2, a: 0.5, exact: true }); assert.deepEqual(projectionFor(0.8), { d1: 3.2, a: 0.8, exact: true });
  assert.deepEqual(projectionFor(0.8, 2.2), { d1: 2, a: 0.5, exact: false }, "no room for the 3,2 : the 2 mm one, and it is said"); assert.equal(projectionFor(5).d1, 8); assert.equal(projectionFor(0.1, 1).d1, 1.6);
  const f = ELEC_INTERFACES.contact.compile("A", { w: 20, h: 8, n: 8, gap: 0.5, form: "cone" }, {});
  assert.equal(f.length, 1); assert.deepEqual([f[0].op, f[0].d, f[0].tip, f[0].h, f[0].lift, f[0].uv.length], ["boss", 2, 0.6, 0.5, 0.5, 8]);
  assert.deepEqual(ELEC_INTERFACES.contact.compile("B", { w: 20, h: 8, n: 8, gap: 0.5, form: "cone" }, {}), [], "the other side is a flat land");
  assert.match(contactFacts({ w: 20, h: 8, n: 8, gap: 0.5, form: "cone" })[0], /8 bossages Ø 2 mm en pointe \(sommet Ø 0,6\), hauts de 0,5 mm — série de l'ISO 8167/);
  assert.deepEqual(contactFormNotes({ w: 20, h: 8, n: 8, gap: 0.65, form: "cone" }), [], "0,65 for 0,63 : the height of the series, near enough");
  assert.match(contactFormNotes({ w: 20, h: 8, n: 8, gap: 1.4, form: "cone" })[0], /Hauteur de 1,4 mm : le bossage normalisé le plus proche fait Ø 3,2 × 0,8 mm/);
});

test("the voltage classes are those of ISO 6469-3, table 1", () => {
  assert.deepEqual([VOLTAGE_CLASSES.A.dc, VOLTAGE_CLASSES.A.ac, VOLTAGE_CLASSES.B1.dc, VOLTAGE_CLASSES.B1.ac, VOLTAGE_CLASSES.B2.dc, VOLTAGE_CLASSES.B2.ac], [60, 30, 75, 50, 1500, 1000]);
  assert.deepEqual([12, 48, 60, 60.1, 75, 76, 400, 1500, 1501].map((u) => voltageClass(u)), ["A", "A", "A", "B1", "B1", "B2", "B2", "B2", "over"]);
  assert.deepEqual([24, 30, 31, 50, 51, 1000, 1001].map((u) => voltageClass(u, true)), ["A", "A", "B1", "B1", "B2", "B2", "over"]); assert.equal(voltageClass(0), null); assert.equal(voltageClass("x"), null);
});

test("a spring blade is a beam built in at both feet : it springs back only so far", () => {
  // CuBe, span 6, width 2, thickness 0,3 : I = 2 × 0,027 / 12 = 0,0045 mm⁴ ; k = 192 × 131000 × 0,0045 / 216 = 524 N/mm ;
  // elastic deflection = Rp L² / (12 E t) = 1000 × 36 / (12 × 131000 × 0,3) = 0,0763 mm ; force there = 40 N ; stress = 0,75 F L / (w t²) = 1000 MPa
  const s = bridgeSpring({ l: 6, w: 2, t: 0.3, base: "CuBe" });
  assert.ok(near(s.k, 524) && near(s.deflMax, 0.07634) && near(s.forceMax, 40) && s.limit === 1000); assert.ok(near(0.75 * s.forceMax * 6 / (2 * 0.3 ** 2), 1000));
  const cu = bridgeSpring({ l: 6, w: 2, t: 0.3, base: "Cu" }); assert.ok(cu.deflMax < s.deflMax / 3, "soft copper springs back far less than a spring alloy");
  assert.ok(bridgeSpring({ l: 12, w: 2, t: 0.3, base: "CuBe" }).deflMax > 3.9 * s.deflMax, "twice the span, four times the travel");
  assert.ok(Object.values(CONTACT_BASES).every((b) => b.E > 100 && b.Rp >= 250 && b.std));
  const L = contactLayout({ w: 20, h: 16, n: 5 }); assert.deepEqual([L.n, L.rows, L.per, L.pitch, L.l], [5, 1, 5, 4, 12]);
  const f = ELEC_INTERFACES.contact.compile("A", { w: 20, h: 16, n: 5, gap: 0.8, form: "bridge", t: 0.5 }, {});
  assert.deepEqual([f[0].op, f[0].l, f[0].w, f[0].h, f[0].t, f[0].lift, f[0].uv.length], ["arch", 12, 2.2, 0.8, 0.5, 0.8, 5]); assert.deepEqual(f[0].dirUV, [0, 1], "the blades span the width of the land");
  const notes = contactFormNotes({ w: 20, h: 8, n: 6, gap: 0.6, form: "bridge", t: 0.3, base: "Cu", force: 2, duty: "power" });
  assert.ok(notes.some((t) => /Moins de 0,03 mm de course élastique/.test(t)) && notes.some((t) => /l'effort se relâche à chaud/.test(t)));
  assert.match(contactFacts({ w: 20, h: 8, n: 6, gap: 0.6, form: "bridge", t: 0.3, base: "CuBe" })[0], /6 lames de 6,8 × 1,83 × 0,3 mm, cuivre-béryllium : chacune fléchit et revient jusqu'à environ 0,098 mm/);
  assert.deepEqual(contactFormNotes({ w: 20, h: 12, n: 6, gap: 0.6, form: "bridge", t: 0.15, base: "CuBe", force: 2, duty: "signal" }), []);
});

test("what the platform would choose : by the thickness of the bar, the current and the voltage", () => {
  const a = contactAdvice({ i: 40, u: 48, t: 2 }); assert.deepEqual([a.cls, a.form, a.plating], ["A", "cone", "Ag"]); assert.ok(contactEstimate({ n: a.n, force: 2, plating: "Ag", i: 40 }).iMax >= 40 && a.n >= 2);
  assert.match(a.standards.join(" "), /USCAR-2, LV 214/); assert.doesNotMatch(a.why.join(" "), /hors d'atteinte/);
  const thin = contactAdvice({ i: 20, u: 12, t: 0.5 }); assert.equal(thin.form, "bridge"); assert.match(thin.why[0], /Barre de 0,5 mm : sous 1 mm/);
  const hv = contactAdvice({ i: 250, u: 400, t: 3 }); assert.deepEqual([hv.cls, hv.form, hv.plating], ["B2", "band", "Ag"]); assert.ok(hv.n > a.n);
  assert.match(hv.why.join(" "), /hors d'atteinte/); assert.match(hv.standards.join(" "), /ISO 6469-3.*USCAR-37, LV 215-1.*IEC 60664-1/);
  const sig = contactAdvice({ i: 0.02, u: 5, t: 1.5, duty: "signal" }); assert.deepEqual([sig.form, sig.plating, sig.n], ["cone", "Au", 2]);
  assert.equal(contactAdvice({ i: 40 }).cls, null, "no voltage given : no class claimed");
});

test("welding the bosses is an option, and it is said what it costs", () => {
  const n = contactFormNotes({ w: 20, h: 8, n: 8, gap: 0.5, form: "cone", weld: "projection" });
  assert.ok(n.some((t) => /liaison devient permanente/.test(t) && /pas le cuivre ni l'aluminium/.test(t)) && n.some((t) => /5 % près/.test(t)));
  assert.match(contactFormNotes({ w: 20, h: 8, n: 8, gap: 0.6, form: "band", weld: "projection" }).join(" "), /demande des bossages/);
  assert.match(elecProcess("contact", { w: 20, h: 8, n: 8, plating: "Ag", form: "cone", weld: "projection" }), /8 bossages soudés par bossage · argent · zone 20 × 8 mm · liaison permanente, à qualifier/);
  assert.match(elecProcess("contact", { w: 20, h: 8, n: 8, plating: "Ag", force: 2, form: "bridge" }), /^lames à ressort · 8 points · argent/); assert.match(elecProcess("contact", { w: 20, h: 8, n: 8, plating: "Ag", force: 2 }), /^bande de lamelles rapportée · 8 points/);
});

test("the kernel makes the bosses and the blades : a pointed boss is a cone, a blade is an arch with daylight under it", async () => {
  const K = await kernel(), vol = (features) => { const b = buildPart(K, { id: "T", material: "CU-C110", features }); assert.deepEqual(b.log.filter((l) => l.level === "error"), []); return b; };
  const flat = [{ id: "a", op: "box", size: [30, 12, 1] }], base = vol(flat).volume;
  const cone = vol([...flat, { id: "b", op: "boss", face: "+Z", at: [[5, 6], [15, 6]], d: 2, tip: 0.6, h: 0.5 }]);
  assert.ok(near(cone.volume - base, 2 * Math.PI * 0.5 / 3 * (1 + 0.3 + 0.09), 1e-3), "two frustums : π h / 3 × (R² + R r + r²)"); assert.ok(near(cone.bbox[5], 1.5));
  const R = (9 + 0.36) / 1.2, th = 2 * Math.asin(3 / R), seg = R * R / 2 * (th - Math.sin(th));
  for (const [face, at, size] of [["+Z", [15, 6], [30, 12, 1]], ["-Z", [15, 6], [30, 12, 1]], ["+X", [6, 4], [30, 12, 8]], ["-Y", [15, 4], [30, 12, 8]]]) {
    const b = vol([{ id: "a", op: "box", size }, { id: "b", op: "arch", face, at: [at], l: 6, w: 2, h: 0.6 }]); assert.ok(near(b.volume - size[0] * size[1] * size[2], seg * 2, 1e-3), `a solid arch on ${face} is a segment of a circle, 2 wide`); }
  const blade = vol([...flat, { id: "b", op: "arch", face: "+Z", at: [[15, 6]], l: 6, w: 2, h: 0.6, t: 0.2, dir: [0, 1] }]).volume - base;
  assert.ok(blade > 0.3 * seg * 2 && blade < 0.7 * seg * 2, "the blade alone : less than the solid arch");
  const bad = buildPart(K, { id: "T", material: "CU-C110", features: [...flat, { id: "b", op: "boss", at: [5, 5], d: 2, tip: 3, h: 1 }, { id: "c", op: "arch", at: [5, 5], l: 2, w: 1, h: 1.5 }] }).log.filter((l) => l.level === "error").map((l) => l.msg).join(" ");
  assert.match(bad, /« tip » \(3\) doit être plus petit que « d » \(2\)/); assert.match(bad, /la flèche \(1.5\) doit rester sous la moitié de la portée \(2\)/);
  // the pointed boss goes to Onshape as a cone ; the blade is left to be formed there, and it is said
  const fs = toFeatureScript({ id: "T", name: "T", material: "CU-C110", features: [...flat, { id: "b", op: "boss", face: "+Z", at: [[5, 6]], d: 2, tip: 0.6, h: 0.5 }, { id: "c", op: "arch", face: "+Z", at: [[15, 6]], l: 6, w: 2, h: 0.6 }] });
  const code = typeof fs === "string" ? fs : fs.code; assert.ok(code.includes("fCone(context, id + (\"boss")); assert.match(code, /lame en pont \(arch\) : à former dans Onshape/);
});

test("on a busbar, a new contact takes the form the bar calls for, and a blade is as thick as the bar", async () => {
  const K = await kernel(), thick = blankBusbar(), c = addContact(thick, { leg: 0, side: 1, s: 35 });
  assert.deepEqual([c.form, c.gap, c.base], ["cone", 0.5, "Cu"]); assert.equal(busbarPart(thick, "BB-1").interfaces.find((i) => i.id === c.id).name, "Contact à bossages CT1 — HV+");
  const thin = { ...blankBusbar(), t: 0.5, W: 24, I: 30, legs: [{ L: 60 }], terminals: [] }, b = addContact(thin, { leg: 0, side: 1, s: 30 }); Object.assign(b, { w: 20, h: 16, n: 5, gap: 0.8 });
  assert.equal(b.form, "bridge"); assert.equal(contactParams(thin, b).t, 0.5); assert.equal(contactParams(thick, c).t, undefined, "a boss needs no blade thickness");
  const part = busbarPart(thin, "BB-2"), I = part.interfaces.find((i) => i.id === b.id); assert.equal(I.name, "Contact à lames CT1 — HV+"); assert.deepEqual(I.opts, { band: "integral" });
  const built = buildPart(K, part); assert.deepEqual(built.log.filter((l) => l.level === "error"), []); assert.ok(near(built.bbox[5] - built.bbox[2], 0.5 + 0.8, 1e-2), "the blades stand 0,8 mm above a bar of 0,5");
  assert.ok(busbarChecks(thin).notes.some((n) => /Lames formées dans le cuivre de la barre/.test(n.text)));
  const heavy = { ...blankBusbar(), I: 250 }; assert.equal(addContact(heavy, { leg: 0, side: 1, s: 35 }).form, "band"); assert.equal(busbarPart(heavy, "BB-3").interfaces.find((i) => i.type === "contact").name, "Contact à lamelles CT1 — HV+");
  // a contact stored before the forms existed is still a band
  const old = { ...blankBusbar(), contacts: [{ id: "CT1", leg: 0, side: 1, s: 35, y: 10, turn: 0, role: "A", w: 18, h: 8, n: 8, gap: 0.6, force: 2, plating: "Ag", base: "CuBe", duty: "power", i: 100 }] };
  const O = busbarPart(old, "BB-4").interfaces.find((i) => i.id === "CT1"); assert.equal(O.name, "Contact à lamelles CT1 — HV+"); assert.deepEqual(O.opts, { band: "insert" }); assert.equal("form" in O.params, false);
});
