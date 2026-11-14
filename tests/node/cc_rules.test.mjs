// Tests of the creepage & clearance rules engine, web/js/analysis/cc_rules.js.
// Run from the repository root:  node --test tests/node/cc_rules.test.mjs
//
// 1. The known-good values of the training deck, on its demo product DEMO-HVB.
// 2. The behaviour of each exported function.
// 3. A fixture of 40 requirement() results recorded from the Python reference engine the module was ported from:
//    the JS result must be the same JSON, key for key and character for character.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cc from '../../web/js/analysis/cc_rules.js';

const { BUILTIN, requirement } = cc;
const NNBSP = ' '; // narrow no-break space, the thousands separator of grouped()

// DEMO-HVB: PD2, 3000 m, OVC II, field case A; HV busbars at ±400 V DC, chassis at 0 V, LV sense at 12 V.
const DEMO = { pollution_degree: 2, altitude_m: 3000, ovc: 'II', impulse_kv: null, field: 'A', level: 'basic' };
const dc = (voltage, extra = {}) => ({ kind: 'dc', voltage, ...extra });
const ac = (voltage, extra = {}) => ({ kind: 'ac', voltage, ...extra });
const NETS = { 'HV+': dc(400), 'HV-': dc(-400), Chassis: dc(0), 'LV sense': dc(12) };
const demo = (a, b, level, params = {}, rules = BUILTIN) => requirement(rules, { ...DEMO, ...params }, NETS[a], NETS[b], level);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

// ---- 1. Training deck, DEMO-HVB ------------------------------------------------------------------------------------

test('DEMO-HVB: HV+ vs HV- (800 V, basic)', () => {
  const r = demo('HV+', 'HV-');
  assert.equal(r.u_rms, 800);
  assert.equal(r.u_peak, 800);
  assert.equal(r.u_analysis, 800);
  assert.equal(r.level, 'basic');
  assert.equal(r.impulse_kv, 6); // OVC II, up to 1000 V
  assert.equal(r.clearance_mm, 6.27); // 5.5 mm (Table F.2, 6 kV, case A) x 1.14 (3000 m)
  assert.equal(r.creepage_mm.II, 6.27); // 5.6 mm in Table F.4, raised to the clearance
  assert.deepEqual(r.creepage_mm, { I: 6.27, II: 6.27, IIIa: 8, IIIb: 8, PCB: 6.27 });
  assert.equal(r.x_mm, 1);
  assert.equal(r.tests.hipot_rms, 2600); // 2 x 800 V + 1000 V
  assert.equal(r.tests.hipot_peak, 3677);
  assert.equal(r.tests.dc_equivalent, 3677);
  assert.equal(r.tests.ratio, 3.25);
  assert.equal(r.tests.production_rms, 3120); // x 1.2
  assert.equal(r.tests.ir_min_ohm_dc, 80000); // 100 ohm/V
  assert.equal(r.tests.ir_min_ohm_ac, 400000); // 500 ohm/V
  assert.equal(r.tests.pd_extinction, 960); // 1.2 x 800 V
  assert.equal(r.tests.pd_initial, 1200); // x 1.25
  assert.equal(r.tests.clearance_mm, 3); // the hipot alone (3.677 kV peak, at sea level) would ask for 3 mm
  assert.deepEqual([r.tests.defaulted, r.tests.covers], [false, true]);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.steps, [
    'Tension de travail 800 V (peak 800 V) : |Va − Vb| = |400 − (−400)| V DC.',
    'Tension de choc 6 kV (OVC II · ≤ 1000 V).',
    'Clearance (Table F.2, cas A) : 5,5 mm (ligne 6).',
    `Altitude 3${NNBSP}000 m (9${NNBSP}843 ft) : × 1,14 (ligne 3000).`,
    'Clearance requise en service : 6,27 mm.',
    `Essai diélectrique 2${NNBSP}600 V rms (peak 3${NNBSP}677 V) : 3 mm suffisent, déjà couverts.`,
    'Creepage jamais inférieur à la clearance (6,27 mm).',
    'Rainure X = 1 mm (PD2) : plus étroite, elle est franchie en ligne droite.',
  ]);
  // The tables behind those numbers
  assert.deepEqual(cc.impulseFromOvc(BUILTIN, 800, 'II'), [6, 'OVC II · ≤ 1000 V']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 6, 2, 'A'), [5.5, '5,5 mm (ligne 6)']);
  assert.deepEqual(cc.altitudeFactor(BUILTIN, 3000), [1.14, 'ligne 3000']);
  assert.deepEqual(cc.creepageBasic(BUILTIN, 800, 2, 'II'), [5.6, '5,6 mm (pd2_ii, ligne 800)']);
});

test('DEMO-HVB: HV+ vs Chassis (400 V, basic)', () => {
  const r = demo('HV+', 'Chassis');
  assert.equal(r.u_rms, 400);
  assert.equal(r.impulse_kv, 4);
  assert.equal(r.clearance_mm, 3.42); // 3 mm x 1.14
  assert.deepEqual(r.creepage_mm, { I: 3.42, II: 3.42, IIIa: 4, IIIb: 4, PCB: 3.42 });
  assert.equal(r.tests.hipot_rms, 1800);
  assert.equal(r.tests.hipot_peak, 2546);
  assert.equal(r.tests.clearance_mm, 2);
});

test('DEMO-HVB: HV- vs LV sense (412 V, reinforced), creepage of group II in PD2 and in PD3', () => {
  // Table F.4 alone, interpolated between 400 V and 500 V, x 2 for reinforced: the figures the deck quotes as
  // « 2 × F.4 », 5,79 mm in PD2 and 11,56 mm in PD3.
  const [pd2] = cc.creepageBasic(BUILTIN, 412, 2, 'II'); // 2.8 + (3.6 − 2.8) x 12 / 100 = 2.896
  const [pd3] = cc.creepageBasic(BUILTIN, 412, 3, 'II'); // 5.6 + (7.1 − 5.6) x 12 / 100 = 5.78
  close(2 * pd2, 5.792);
  close(2 * pd3, 11.56);
  assert.equal(cc.fmt(2 * pd2), '5,79');
  assert.equal(cc.fmt(2 * pd3), '11,56');

  // What the engine (like the reference engine) requires: those values rounded UP to 0.01 mm and never below the
  // clearance. The reinforced clearance is 6.27 mm in both pollution degrees (4 kV -> next step 6 kV -> 5.5 mm,
  // x 1.14). In PD2 the table-derived 5.792 mm is below it, so the requirement is 6.27 mm, not the deck's 5,79 mm
  // (which is the value before the « never below the clearance » rule). In PD3 the 11.56 mm stand.
  const r2 = demo('HV-', 'LV sense', 'reinforced');
  assert.equal(r2.u_rms, 412);
  assert.equal(r2.impulse_kv, 6);
  assert.equal(r2.clearance_mm, 6.27);
  assert.equal(r2.creepage_mm.II, 6.27);
  assert.deepEqual(r2.creepage_mm, { I: 6.27, II: 6.27, IIIa: 8.24, IIIb: 8.24, PCB: 6.27 });
  assert.ok(r2.steps.includes('Reinforced : 6 kV (pas suivant de la série).'));
  assert.ok(r2.steps.includes('Reinforced : creepage × 2.'));
  assert.ok(r2.steps.includes('Creepage jamais inférieur à la clearance (6,27 mm).'));
  assert.equal(cc.up(2 * pd2), 5.8); // without the clearance floor, rounded up

  const r3 = demo('HV-', 'LV sense', 'reinforced', { pollution_degree: 3 });
  assert.equal(r3.clearance_mm, 6.27);
  assert.equal(r3.creepage_mm.II, 11.56);
  assert.deepEqual(r3.creepage_mm, { I: 10.32, II: 11.56, IIIa: 13.01, IIIb: 13.01, PCB: 13.01 });
  assert.equal(r3.x_mm, 1.5);

  // The level can also come from the parameters
  assert.deepEqual(demo('HV-', 'LV sense', undefined, { level: 'reinforced' }), r2);
});

test('DEMO-HVB: LV sense vs Chassis (12 V, basic), the hipot peak drives the clearance', () => {
  const r = demo('LV sense', 'Chassis');
  assert.equal(r.u_rms, 12);
  assert.equal(r.impulse_kv, 0.5);
  assert.equal(r.tests.hipot_rms, 1024);
  assert.equal(r.tests.hipot_peak, 1448);
  assert.equal(r.tests.clearance_mm, 0.5); // 1.448 kV -> row 1.5 kV of Table F.2
  assert.equal(r.clearance_mm, 0.5); // in service: 0.04 mm -> PD2 minimum 0.2 mm -> x 1.14 = 0.23 mm only
  assert.equal(r.creepage_mm.II, 0.5); // 0.416 mm in Table F.4, raised to the clearance
  assert.equal(r.x_mm, 0.167); // one third of the clearance
  assert.ok(r.steps.includes('Clearance (Table F.2, cas A) : 0,04 mm, minimum PD2 → 0,2 mm.'));
  assert.ok(r.steps.includes('Clearance requise en service : 0,23 mm.'));
  assert.ok(r.steps.includes(
    `Essai diélectrique 1${NNBSP}024 V rms (peak 1${NNBSP}448 V, au sol) : la clearance doit le tenir → 0,5 mm.`,
  ));
  assert.ok(r.steps.includes('Rainure X = 0,167 mm (PD2) : plus étroite, elle est franchie en ligne droite.'));
});

test('altitude 7620 m (25 000 ft): factor 2.136, reinforced clearance 11.75 mm', () => {
  const [factor, how] = cc.altitudeFactor(BUILTIN, 7620);
  close(factor, 2.136); // 1.95 + (2.25 − 1.95) x 620 / 1000
  assert.equal(how, 'interpolé entre 7000 et 8000');
  const r = demo('HV-', 'LV sense', 'reinforced', { altitude_m: 7620 });
  assert.equal(r.clearance_mm, 11.75); // 5.5 mm x 2.136 = 11.748
  assert.deepEqual(r.creepage_mm, { I: 11.75, II: 11.75, IIIa: 11.75, IIIb: 11.75, PCB: 11.75 });
  assert.ok(r.steps.includes(`Altitude 7${NNBSP}620 m (25${NNBSP}000 ft) : × 2,136 (interpolé entre 7000 et 8000).`));
  assert.deepEqual(cc.altitudeFactor(BUILTIN, 0), [1, 'ligne 2000']);
  assert.deepEqual(cc.altitudeFactor(BUILTIN, '3000'), [1.14, 'ligne 3000']);
  assert.deepEqual(cc.altitudeFactor(BUILTIN, 20001), [null, 'au-delà de la table (20000 max.)']);
});

test('house factor k = 3 at 800 V, PD2, group II: 17.2 mm of creepage', () => {
  assert.deepEqual(cc.creepageBasic(BUILTIN, 2400, 2, 'II'), [17.2, '17,2 mm (pd2_ii, interpolé entre 2000 et 2500)']);
  const r = demo('HV+', 'HV-', undefined, { voltage_factor: 3 });
  assert.equal(r.u_rms, 800);
  assert.equal(r.u_analysis, 2400);
  assert.equal(r.creepage_mm.II, 17.2);
  assert.deepEqual(r.creepage_mm, { I: 12, II: 17.2, IIIa: 24, IIIb: 24, PCB: null }); // printed wiring stops at 1000 V
  // 2400 V is beyond Table F.1: no impulse voltage, so the clearance only comes from the hipot (3 mm)
  assert.equal(r.impulse_kv, null);
  assert.equal(r.clearance_mm, 3);
  assert.deepEqual(r.warnings, ['Clearance non calculée : au-delà de 1000 V : saisissez la tension de choc (kV).']);
  assert.equal(r.steps[1], "Facteur maison × 3 : tension d'analyse 2400 V (tables F.1 et F.4).");
  assert.equal(r.tests.hipot_rms, 2600); // the tests keep the real working voltage
});

test('floating IT system: a floating net against the chassis takes the system voltage', () => {
  const plus = dc(400, { floating: true });
  const minus = dc(-400, { floating: true });
  const chassis = dc(0);
  const span = cc.floatingSpan([plus, minus, chassis, dc(12)]);
  assert.equal(span, 800);
  const u = cc.workingVoltage(plus, chassis, span);
  assert.equal(u.rms, 800);
  assert.equal(u.peak, 800);
  assert.equal(u.basis, "système HV flottant (IT) : après un premier défaut d'isolement, ce net peut se trouver à la "
    + 'tension du système, 800 V, du Chassis (différence nominale 400 V)');
  assert.deepEqual(cc.workingVoltage(chassis, minus, span), { ...u, rms: 800 }); // either order
  // Two nets of the same floating system, or no system voltage: the real difference
  assert.equal(cc.workingVoltage(plus, minus, span).rms, 800);
  assert.equal(cc.workingVoltage(plus, dc(200, { floating: true }), span).rms, 200);
  assert.equal(cc.workingVoltage(plus, chassis).rms, 400);
  assert.equal(cc.workingVoltage(plus, chassis, 300).rms, 400); // a system voltage below the difference changes nothing
  // requirement() takes it from params.floating_v: 400 V nominal is dimensioned as 800 V
  const r = requirement(BUILTIN, { ...DEMO, floating_v: span }, plus, chassis);
  assert.equal(r.u_rms, 800);
  assert.equal(r.clearance_mm, 6.27);
  assert.equal(r.tests.hipot_rms, 2600);
  assert.equal(requirement(BUILTIN, DEMO, plus, chassis).clearance_mm, 3.42);
  // floatingSpan: null under two potentials; an AC net counts for ± its peak
  assert.equal(cc.floatingSpan([plus, chassis]), null);
  assert.equal(cc.floatingSpan([]), null);
  assert.equal(cc.floatingSpan([ac(230, { floating: true })]), 650.538);
});

test('groove width X: 0.25 / 1 / 1.5 mm, reduced to a third of a clearance below 3 mm', () => {
  assert.equal(cc.grooveWidth(BUILTIN, 1, null), 0.25);
  assert.equal(cc.grooveWidth(BUILTIN, 2, 6.27), 1);
  assert.equal(cc.grooveWidth(BUILTIN, 3, 11.75), 1.5);
  assert.equal(cc.grooveWidth(BUILTIN, 3, 3), 1.5); // 3 mm is not below 3 mm
  close(cc.grooveWidth(BUILTIN, 3, 2.99), 2.99 / 3);
  close(cc.grooveWidth(BUILTIN, 2, 0.5), 0.5 / 3);
  close(cc.grooveWidth(BUILTIN, 1, 0.6), 0.2);
  assert.equal(cc.grooveWidth(BUILTIN, 1, 1), 0.25); // a third of the clearance is wider than X: X stands
  assert.equal(cc.grooveWidth({ ...BUILTIN, groove_x_reduce: false }, 2, 0.5), 1);
  assert.equal(demo('HV+', 'HV-', undefined, { pollution_degree: 1 }).x_mm, 0.25);
  assert.equal(demo('HV+', 'HV-', undefined, { pollution_degree: 3 }).x_mm, 1.5);
  assert.equal(demo('LV sense', 'Chassis', undefined, { pollution_degree: 3 }).x_mm, 0.307); // clearance 0.92 mm
});

// ---- 2. Functions --------------------------------------------------------------------------------------------------

test('materialGroup: thresholds 600 / 400 / 175', () => {
  assert.equal(cc.materialGroup(600), 'I');
  assert.equal(cc.materialGroup(1000), 'I');
  assert.equal(cc.materialGroup(599), 'II');
  assert.equal(cc.materialGroup(400), 'II');
  assert.equal(cc.materialGroup(399.99), 'IIIa');
  assert.equal(cc.materialGroup(175), 'IIIa');
  assert.equal(cc.materialGroup(174), 'IIIb');
  assert.equal(cc.materialGroup(100), 'IIIb');
  assert.equal(cc.materialGroup(0), 'IIIb');
  assert.equal(cc.materialGroup('600'), 'I');
  assert.equal(cc.materialGroup(null), null);
  assert.equal(cc.materialGroup(undefined), null);
  assert.equal(cc.materialGroup(''), null);
});

test('numbers are formatted like the reference engine', () => {
  assert.equal(cc.fmt(5.5), '5,5');
  assert.equal(cc.fmt(6), '6');
  assert.equal(cc.fmt(1000), '1000');
  assert.equal(cc.fmt(0.004), '0');
  assert.equal(cc.fmt(2.136, 3), '2,136');
  assert.equal(cc.fmt(817.21, 1), '817,2');
  assert.equal(cc.fmt(12.35, 1), '12,3'); // 12.35 is stored just below 12.35
  // An exact tie goes to the even digit, as in Python (toFixed alone gives 0,13 / 12,3)
  assert.equal(cc.fmt(0.125), '0,12');
  assert.equal(cc.fmt(0.375), '0,38');
  assert.equal(cc.fmt(12.25, 1), '12,2');
  assert.equal(cc.fmt(800, 0), '800'); // only the zeros of the fraction are removed
  assert.equal(cc.signed(-400), '−400'); // U+2212, not a hyphen
  assert.equal(cc.signed(-400, true), '(−400)');
  assert.equal(cc.signed(12, true), '12');
  assert.equal(cc.signed(0), '0');
  assert.equal(cc.grouped(999), '999');
  assert.equal(cc.grouped(3677), `3${NNBSP}677`);
  assert.equal(cc.grouped(1234567), `1${NNBSP}234${NNBSP}567`);
  assert.equal(cc.grouped('3000'), `3${NNBSP}000`);
  assert.deepEqual([cc.grouped(2.5), cc.grouped(3.5), cc.grouped(-0.4)], ['2', '4', '0']);
  assert.equal(cc.altLabel(3000), `3${NNBSP}000 m (9${NNBSP}843 ft)`);
  assert.equal(cc.altLabel(7620), `7${NNBSP}620 m (25${NNBSP}000 ft)`);
});

test('up: a distance is rounded up to 0.01 mm, never down', () => {
  assert.equal(cc.up(5.792), 5.8);
  assert.equal(cc.up(0.228), 0.23);
  assert.equal(cc.up(6.27), 6.27);
  assert.equal(cc.up(5.5 * 1.14), 6.27); // 6.2700000000000005 in binary: not 6.28
  assert.equal(cc.up(2.0000000001), 2.01);
  assert.equal(cc.up(0), 0);
  assert.ok(Object.is(cc.up(0), 0)); // not -0
});

test('workingVoltage and netPeak: DC, AC and mixed pairs', () => {
  assert.deepEqual(cc.workingVoltage(dc(400), dc(-400)), { rms: 800, peak: 800, basis: '|Va − Vb| = |400 − (−400)| V DC' });
  assert.equal(cc.workingVoltage(dc(-400), dc(12)).basis, '|Va − Vb| = |−400 − 12| V DC');
  assert.equal(cc.workingVoltage(dc(5), dc(822.21)).basis, '|Va − Vb| = |5 − 822,21| V DC');
  // Two AC nets of unknown phase: sum of the RMS values, sum of the peaks (a given peak wins over V x √2)
  const two = cc.workingVoltage(ac(230), ac(230, { peak: 400 }));
  assert.equal(two.rms, 460);
  close(two.peak, 230 * Math.SQRT2 + 400);
  assert.equal(two.basis, 'deux réseaux AC, phases inconnues : somme des valeurs RMS (cas le plus défavorable)');
  // DC + AC, in either order: √(Vdc² + Vac²), peak |Vdc| + AC peak
  for (const u of [cc.workingVoltage(dc(-300), ac(400)), cc.workingVoltage(ac(400), dc(-300))]) {
    assert.equal(u.rms, 500);
    close(u.peak, 300 + 400 * Math.SQRT2);
    assert.equal(u.basis, 'DC + AC : √(Vdc² + Vac,rms²)');
  }
  assert.equal(cc.netPeak(dc(-400)), 400);
  close(cc.netPeak(ac(230)), 325.2691193458119);
  assert.equal(cc.netPeak(ac(230, { peak: 400 })), 400);
  close(cc.netPeak(ac(230, { peak: 0 })), 325.2691193458119); // no peak given
});

test('lookup: first row below the table, next row or interpolation inside, null above', () => {
  const points = [[10, 1], [20, 3], [50, 4.5]];
  assert.deepEqual(cc.lookup(points, 5, true), [1, 'ligne 10']);
  assert.deepEqual(cc.lookup(points, 10, false), [1, 'ligne 10']);
  assert.deepEqual(cc.lookup(points, 20, true), [3, 'ligne 20']);
  assert.deepEqual(cc.lookup(points, 15, true), [2, 'interpolé entre 10 et 20']);
  assert.deepEqual(cc.lookup(points, 15, false), [3, 'ligne supérieure 20']);
  assert.deepEqual(cc.lookup(points, 50, false), [4.5, 'ligne 50']);
  assert.deepEqual(cc.lookup(points, 50.01, true), [null, 'au-delà de la table (50 max.)']);
  assert.deepEqual(cc.lookup([], 5, true), [null, 'table vide']);
});

test('creepageColumn and creepageBasic: Table F.4', () => {
  assert.equal(cc.creepageColumn(1, 'II', false), 'pd1');
  assert.equal(cc.creepageColumn(1, 'IIIb', true), 'pw_pd1');
  assert.equal(cc.creepageColumn(2, 'I', false), 'pd2_i');
  assert.equal(cc.creepageColumn(2, 'IIIa', true), 'pw_pd2');
  assert.equal(cc.creepageColumn(2, 'IIIb', true), 'pd2_iii'); // printed wiring PD2 excludes group IIIb
  assert.equal(cc.creepageColumn(3, 'IIIa', true), 'pd3_iii'); // no printed-wiring column in PD3
  assert.equal(cc.creepageColumn('3', 'IIIb', false), 'pd3_iii');
  assert.deepEqual(cc.creepageBasic(BUILTIN, 800, 2, 'IIIa', true), [4, '4 mm (pw_pd2, ligne 800)']);
  assert.deepEqual(cc.creepageBasic(BUILTIN, 25, 1, 'I'), [0.125, '0,12 mm (pd1, ligne 25)']);
  assert.deepEqual(cc.creepageBasic(BUILTIN, 5, 3, 'IIIb'), [1, '1 mm (pd3_iii, ligne 10)']);
  assert.deepEqual(cc.creepageBasic(BUILTIN, 1250, 2, 'IIIa', true), [null, '— (pw_pd2, au-delà de la table (1000 max.))']);
  assert.deepEqual(cc.creepageBasic(BUILTIN, 10001, 2, 'I'), [null, '— (pd2_i, au-delà de la table (10000 max.))']);
  const stepped = { ...BUILTIN, creepage: { ...BUILTIN.creepage, interpolate: false } };
  assert.deepEqual(cc.creepageBasic(stepped, 412, 2, 'II'), [3.6, '3,6 mm (pd2_ii, ligne supérieure 500)']);
  assert.throws(() => cc.creepageBasic(BUILTIN, 400, 2, 'IV'), /no column/);
});

test('impulseFromOvc and reinforcedImpulse: Table F.1 and the preferred series', () => {
  assert.deepEqual(cc.impulseFromOvc(BUILTIN, 50, 'I'), [0.33, 'OVC I · ≤ 50 V']);
  assert.deepEqual(cc.impulseFromOvc(BUILTIN, 50.1, 'IV'), [2.5, 'OVC IV · ≤ 100 V']);
  assert.deepEqual(cc.impulseFromOvc(BUILTIN, 600, 'III'), [6, 'OVC III · ≤ 600 V']);
  assert.deepEqual(cc.impulseFromOvc(BUILTIN, 1000.5, 'III'), [null, 'au-delà de 1000 V : saisissez la tension de choc (kV)']);
  assert.deepEqual(cc.reinforcedImpulse(BUILTIN, 4), [6, 'pas suivant de la série']);
  assert.deepEqual(cc.reinforcedImpulse(BUILTIN, 0.33), [0.5, 'pas suivant de la série']);
  const [off, how] = cc.reinforcedImpulse(BUILTIN, 7); // not in the series: x 1.6
  close(off, 11.2);
  assert.equal(how, '× 1,6');
  close(cc.reinforcedImpulse(BUILTIN, 12)[0], 19.2); // last step of the series: x 1.6
  const noStep = { ...BUILTIN, reinforced: { ...BUILTIN.reinforced, impulse_step: false } };
  close(cc.reinforcedImpulse(noStep, 4)[0], 6.4);
});

test('clearanceBasic: Table F.2, field cases A and B, pollution degree minimum', () => {
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 6, 2, 'B'), [2, '2 mm (ligne 6)']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 3.677, 2, 'A'), [3, '3 mm (ligne supérieure 4)']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 0.5, 1, 'A'), [0.04, '0,04 mm (ligne 0,5)']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 0.5, 2, 'A'), [0.2, '0,04 mm, minimum PD2 → 0,2 mm']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 0.5, 3, 'a'), [0.8, '0,04 mm, minimum PD3 → 0,8 mm']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 0.1, 1, 'A'), [0.01, '0,01 mm (ligne 0,33)']);
  assert.deepEqual(cc.clearanceBasic(BUILTIN, 101, 1, 'A'), [null, 'au-delà de la table (100 max.)']);
});

test('validationTests: hipot, insulation resistance, partial discharge', () => {
  assert.deepEqual(cc.validationTests(BUILTIN, 412, 412, 'reinforced', 2, 'A'), {
    defaulted: false, covers: true, hipot_rms: 3648, hipot_peak: 5159, dc_equivalent: 5159, ratio: 8.85, duration_s: 60,
    production_rms: 4378, production_s: 2, clearance_mm: 5.5, clearance_how: '5,5 mm (ligne supérieure 6)',
    ir_min_ohm_dc: 41200, ir_min_ohm_ac: 206000, pd_extinction: 618, pd_initial: 772, pd_max_pc: 10,
  });
  // Integer volts round like Python's round(), an exact tie to the even integer: 618 V x 1.25 = 772.5 V -> 772 V
  // above (Math.round would give 773 V), and 2 x 12.25 V + 1000 V = 1024.5 V -> 1024 V here.
  const tie = cc.validationTests(BUILTIN, 12.25, 12.25, 'basic', 2, 'A');
  assert.deepEqual([tie.hipot_rms, tie.hipot_peak, tie.ir_min_ohm_dc, tie.pd_extinction], [1024, 1449, 1225, 15]);
  assert.equal(cc.validationTests(BUILTIN, 0, 0, 'basic', 2, 'A').ratio, null);
});

test('a rule set without a validation block: default tests, clearance not raised', () => {
  const { validation, ...legacy } = BUILTIN;
  assert.ok(validation);
  const tests = cc.validationTests(legacy, 12, 12, 'basic', 2, 'A');
  assert.deepEqual([tests.defaulted, tests.covers, tests.hipot_rms, tests.clearance_mm], [true, false, 1024, 0.5]);
  const r = demo('LV sense', 'Chassis', undefined, {}, legacy);
  assert.equal(r.clearance_mm, 0.23); // the in-service clearance, not the 0.5 mm of the hipot
  assert.deepEqual(r.creepage_mm, { I: 0.42, II: 0.42, IIIa: 0.42, IIIb: 0.42, PCB: 0.23 });
  assert.equal(r.x_mm, 0.077);
  assert.ok(!r.steps.some((step) => step.startsWith('Essai diélectrique')));
  // A block that does not ask the clearance to cover the hipot behaves the same, without being `defaulted`
  const uncovered = { ...BUILTIN, validation: { ...validation, clearance_covers_hipot: false } };
  assert.equal(demo('LV sense', 'Chassis', undefined, {}, uncovered).clearance_mm, 0.23);
  assert.equal(demo('LV sense', 'Chassis', undefined, {}, uncovered).tests.defaulted, false);
});

test('layerCheck: breakdown of a solid insulation layer against the hipot peak', () => {
  const note = { ok: "Marge ≥ × 2 sur le pic de l'essai.", fail: "Claquerait pendant l'essai diélectrique : épaisseur insuffisante." };
  assert.deepEqual(cc.layerCheck({ thickness_mm: 0.25 }, { dielectric_kv_mm: 33 }, 3677),
    { status: 'ok', withstand_kv: 8.25, ratio: 2.24, note: note.ok });
  assert.deepEqual(cc.layerCheck({ thickness_mm: 0.13 }, { dielectric_kv_mm: 28 }, 3677),
    { status: 'fail', withstand_kv: 3.64, ratio: 0.99, note: note.fail });
  const warn = cc.layerCheck({ thickness_mm: 0.13 }, { dielectric_kv_mm: 28 }, 2546);
  assert.deepEqual([warn.status, warn.ratio], ['warn', 1.43]);
  assert.equal(warn.note, "Tient l'essai, mais marge < × 2 : épaissir ou doubler la couche.");
  assert.deepEqual(cc.layerCheck({ thickness_mm: 0.05 }, { dielectric_kv_mm: 240 }, null), {
    status: 'info', withstand_kv: 12, ratio: null, note: "Pièce sans net : aucune paire ne fixe d'essai pour cette couche.",
  });
  for (const material of [null, {}, { dielectric_kv_mm: null }, { dielectric_kv_mm: 0 }]) {
    assert.deepEqual(cc.layerCheck({ thickness_mm: 0.3 }, material, 3677), {
      status: 'unknown', withstand_kv: null, ratio: null,
      note: 'Rigidité diélectrique absente de la fiche matériau : saisissez-la (kV/mm) dans Matériaux.',
    });
  }
  // An entry of MATERIALS (camelCase keys) can be passed as it is, also as the layer
  const nomex = cc.MATERIALS.find((m) => m.name === 'Nomex 410 — 0.25 mm');
  assert.equal(cc.layerCheck({ thickness_mm: 0.25 }, nomex, 3677).ratio, 2.24);
  assert.equal(cc.layerCheck(nomex, nomex, 3677).withstand_kv, 8.25);
});

test('requirement: parameters, levels and limits', () => {
  // null parameters keep the defaults: PD2, 2000 m, OVC II, case A, basic
  const nulls = { pollution_degree: null, altitude_m: null, ovc: null, impulse_kv: null, field: null, level: null };
  const r = requirement(BUILTIN, nulls, NETS['HV+'], NETS['HV-']);
  assert.deepEqual(r, requirement(BUILTIN, null, NETS['HV+'], NETS['HV-']));
  assert.deepEqual(r, requirement(BUILTIN, cc.DEFAULT_PARAMS, NETS['HV+'], NETS['HV-']));
  assert.deepEqual([r.level, r.impulse_kv, r.clearance_mm, r.x_mm], ['basic', 6, 5.5, 1]);
  assert.deepEqual(r.creepage_mm, { I: 5.5, II: 5.6, IIIa: 8, IIIb: 8, PCB: 5.5 });
  // Same potential: nothing to require
  assert.deepEqual(demo('LV sense', 'LV sense'), {
    u_rms: 0, u_peak: 0, basis: '|Va − Vb| = |12 − 12| V DC', level: 'basic', steps: [],
    warnings: ['Même potentiel : aucune distance requise.'], clearance_mm: null, creepage_mm: {}, x_mm: null,
    impulse_kv: null, u_analysis: 0, tests: null,
  });
  // An entered impulse voltage replaces Table F.1; here the hipot then asks for more than the service
  const entered = demo('HV+', 'HV-', undefined, { impulse_kv: 2.5 });
  assert.equal(entered.steps[1], 'Tension de choc 2,5 kV (tension de choc saisie).');
  assert.deepEqual([entered.impulse_kv, entered.clearance_mm], [2.5, 3]);
  assert.deepEqual(entered.creepage_mm, { I: 4, II: 5.6, IIIa: 8, IIIb: 8, PCB: 4 });
  // Beyond the tables: warnings, no number invented
  assert.deepEqual(demo('HV+', 'HV-', undefined, { impulse_kv: 150 }).warnings,
    ['Clearance non calculée : 150 kV au-delà de la table (100 max.).']);
  assert.deepEqual(demo('HV+', 'HV-', undefined, { altitude_m: 25000 }).warnings,
    [`Altitude 25${NNBSP}000 m (82${NNBSP}021 ft) au-delà de la table (20000 max.).`]);
  const pd3 = demo('HV+', 'HV-', undefined, { pollution_degree: 3 });
  assert.deepEqual(pd3.warnings, ['PD3 au-delà de 630 V : material group IIIb non recommandé.']);
  assert.deepEqual(pd3.creepage_mm, { I: 10, II: 11, IIIa: 12.5, IIIb: 12.5, PCB: 12.5 });
  const beyond = requirement(BUILTIN, DEMO, dc(12000), dc(0));
  assert.deepEqual(beyond.creepage_mm, { I: null, II: null, IIIa: null, IIIb: null, PCB: null });
  assert.ok(beyond.warnings.includes('Creepage hors table : — (pd2_i, au-delà de la table (10000 max.)).'));
  // Functional insulation: factor 1 in the built-in rule set, so the same distances as basic
  assert.deepEqual(demo('HV+', 'HV-', 'functional').creepage_mm, demo('HV+', 'HV-').creepage_mm);
  assert.equal(demo('HV+', 'HV-', 'functional').level, 'functional');
});

test('house margins of a rule set: « Marge maison »', () => {
  const r = demo('HV+', 'Chassis', undefined, {}, { ...BUILTIN, margin_pct: { creepage: 10, clearance: 15 } });
  assert.equal(r.clearance_mm, 3.94); // 3.42 mm + 15 %
  assert.deepEqual(r.creepage_mm, { I: 3.94, II: 3.94, IIIa: 4.4, IIIb: 4.4, PCB: 3.94 }); // 4 mm + 10 %
  assert.equal(r.steps[4], 'Marge maison clearance : + 15 %.');
  assert.equal(r.steps[7], 'Marge maison creepage : + 10 %.');
});

test('constants and the built-in rule set', () => {
  assert.equal(cc.STANDARD, 'IEC 60664-1');
  assert.equal(cc.BUILTIN_NAME, 'IEC 60664-1 (intégrée)');
  assert.deepEqual(cc.GROUPS, ['I', 'II', 'IIIa', 'IIIb']);
  assert.deepEqual(cc.LEVELS, ['functional', 'basic', 'reinforced']);
  assert.deepEqual(cc.OVC, ['I', 'II', 'III', 'IV']);
  assert.deepEqual(cc.FIELDS, ['A', 'B']);
  assert.deepEqual(cc.LEVEL_LABEL, { functional: 'Functional', basic: 'Basic', reinforced: 'Reinforced' });
  assert.deepEqual(cc.DEFAULT_PARAMS, {
    pollution_degree: 2, altitude_m: 2000, ovc: 'II', impulse_kv: null, field: 'A', level: 'basic', voltage_factor: 1,
    floating_v: null,
  });
  assert.equal(cc.FT_PER_M, 3.28084);
  assert.deepEqual(Object.keys(BUILTIN), ['standard', 'creepage', 'clearance', 'impulse', 'altitude', 'groove_x',
    'groove_x_reduce', 'reinforced', 'functional_factor', 'margin_pct', 'validation']);
  assert.deepEqual(JSON.parse(JSON.stringify(BUILTIN)), BUILTIN); // a rule set is plain JSON
  // Every table: full rows, first column ascending, no value decreasing down a column
  const sizes = {};
  for (const name of ['creepage', 'clearance', 'impulse', 'altitude']) {
    const { columns, rows } = BUILTIN[name];
    sizes[name] = rows.length;
    rows.forEach((row, i) => {
      assert.equal(row.length, columns.length, `${name}, row ${i}`);
      if (i === 0) return;
      assert.ok(row[0] > rows[i - 1][0], `${name}, row ${i}: first column ascending`);
      row.forEach((value, c) => {
        const above = rows[i - 1][c];
        if (value !== null && above !== null) assert.ok(value >= above, `${name}, row ${i}, column ${columns[c]}`);
      });
    });
  }
  assert.deepEqual(sizes, { creepage: 31, clearance: 26, impulse: 6, altitude: 11 });
  assert.deepEqual(BUILTIN.creepage.rows[19], [800, 2.4, 4, 2.4, 4, 5.6, 8, 10, 11, 12.5]);
  assert.deepEqual(BUILTIN.creepage.rows[21].slice(0, 3), [1250, null, null]); // printed wiring stops at 1000 V
  assert.deepEqual(BUILTIN.clearance.pd_min, { 1: 0, 2: 0.2, 3: 0.8 });
  assert.deepEqual(BUILTIN.groove_x, { 1: 0.25, 2: 1, 3: 1.5 });
  assert.deepEqual(BUILTIN.impulse.series, [330, 500, 800, 1500, 2500, 4000, 6000, 8000, 12000]);
  assert.deepEqual(BUILTIN.reinforced, { creepage_factor: 2, impulse_step: true, impulse_factor: 1.6 });
  assert.deepEqual(BUILTIN.validation.hipot,
    { a: 2, b: 1000, duration_s: 60, production_factor: 1.2, production_s: 2, reinforced_factor: 2 });
});

test('MATERIALS: the seed library', () => {
  const { MATERIALS } = cc;
  assert.equal(MATERIALS.length, 31);
  assert.equal(new Set(MATERIALS.map((m) => m.name)).size, 31);
  const keys = ['name', 'conductive', 'cti', 'group', 'printedWiring', 'form', 'thicknessMm', 'dielectricKvMm',
    'thermalClassC', 'source', 'note'];
  for (const m of MATERIALS) {
    assert.deepEqual(Object.keys(m), keys, m.name);
    assert.equal(m.group, cc.materialGroup(m.cti), m.name);
    assert.equal(m.conductive, m.cti === null, m.name); // a conductor has no CTI, an insulator always has one
    assert.ok(['part', 'sheet', 'film', 'coating'].includes(m.form), m.name);
    assert.equal(m.form === 'part', m.thicknessMm === null, m.name); // sheets, films and coatings have a thickness
  }
  const byName = Object.fromEntries(MATERIALS.map((m) => [m.name, m]));
  assert.deepEqual(MATERIALS.filter((m) => m.conductive).map((m) => m.name),
    ['Copper (Cu-ETP)', 'Copper, tin or nickel plated', 'Aluminium 6061', 'Steel / stainless steel', 'Brass']);
  assert.deepEqual(byName['PA66-GF30'], {
    name: 'PA66-GF30', conductive: false, cti: 400, group: 'II', printedWiring: false, form: 'part', thicknessMm: null,
    dielectricKvMm: null, thermalClassC: null, source: '',
    note: 'Valeur typique de la famille : vérifier la fiche matière du grade utilisé.',
  });
  assert.equal(byName['Copper (Cu-ETP)'].note, '');
  assert.equal(byName.PP.note,
    'Valeur typique de la famille : vérifier la fiche matière du grade utilisé. (joints de cellule, isolants de faisceau)');
  assert.deepEqual(MATERIALS.filter((m) => m.printedWiring).map((m) => [m.name, m.group]),
    [['FR4 PCB (standard)', 'IIIa'], ['FR4 PCB (high CTI 600)', 'I']]);
  assert.equal(byName['Unknown insulator (worst case)'].group, 'IIIb');
  const nomex = byName['Nomex 410 — 0.25 mm'];
  assert.deepEqual([nomex.form, nomex.cti, nomex.group, nomex.thicknessMm, nomex.dielectricKvMm, nomex.thermalClassC],
    ['sheet', 175, 'IIIa', 0.25, 33, 220]);
  assert.ok(nomex.source.startsWith('Arclin (ex-DuPont) Nomex® 410 Technical Data Sheet'));
  const kapton = byName['Kapton HN — 0.05 mm (2 mil)'];
  assert.deepEqual([kapton.form, kapton.group, kapton.dielectricKvMm, kapton.thermalClassC], ['film', 'IIIb', 240, null]);
  assert.deepEqual(MATERIALS.filter((m) => m.form === 'coating').map((m) => m.dielectricKvMm), [null, null]);
});

// ---- 3. Fixture recorded from the Python reference engine ----------------------------------------------------------
// Each line: [rule set, params, net a, net b, level, result of rules.requirement(rule set, params, a, b, level)].
// The first 20 cases are chosen to reach every branch and every text of the engine (the first two are DEMO-HVB
// pairs), the last 20 are random. The texts are those of the reference engine, except that its house-margin steps
// read « Marge maison » here; U+202F is written as an escape to stay visible. The rule sets are BUILTIN and the five
// variants below.
const { validation: validationBlock, ...legacyRules } = BUILTIN;
const RULE_SETS = {
  builtin: BUILTIN,
  margin: { ...BUILTIN, margin_pct: { creepage: 10, clearance: 15 } },
  legacy: legacyRules, // saved before the validation block existed
  empty_validation: { ...BUILTIN, validation: {} },
  no_cover: { ...BUILTIN, validation: { ...validationBlock, clearance_covers_hipot: false } },
  stepless: {
    ...BUILTIN,
    reinforced: { creepage_factor: 2.5, impulse_step: false, impulse_factor: 1.6 },
    creepage: { ...BUILTIN.creepage, interpolate: false },
    clearance: { ...BUILTIN.clearance, interpolate: true },
    groove_x_reduce: false,
    functional_factor: 0.8,
  },
};
/* eslint-disable */
const FIXTURE = [
/*FIXTURE*/
];
/* eslint-enable */

FIXTURE.forEach(([rules, params, a, b, level, expected], index) => {
  const label = `${rules}, ${a.kind} ${a.voltage} V vs ${b.kind} ${b.voltage} V, ${level || 'level of the parameters'}`;
  test(`reference fixture ${String(index + 1).padStart(2, '0')}: ${label}`, () => {
    const actual = requirement(RULE_SETS[rules], params, a, b, level);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
    assert.equal(JSON.stringify(actual), JSON.stringify(expected)); // and the keys in the same order
  });
});
