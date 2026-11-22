// Tests of the « Physique » brick: web/js/analysis/physics/ (props, models_*, index) and physicsSummary().
// Run from the repository root:  node --test tests/node/physics.test.mjs
//
// 1. Library shape, and every model runs on its defaults (finite numbers, never throws).
// 2. Every model against a textbook value computed by hand (the calculation is in the comment above each case).
// 3. Validity warnings (regime changes), monotonicity, robustness on bad inputs.
// 4. prefill() from a simple part, material and fluid properties, the report summary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, DOMAINS, model, defaults, run, prefill, partContext } from '../../web/js/analysis/physics/index.js';
import { props, FLUIDS, PROP_IDS } from '../../web/js/analysis/physics/props.js';
import { n, chk, interp, bisect } from '../../web/js/analysis/physics/models_core.js';
import { channelNatural } from '../../web/js/analysis/physics/models_thermal.js';
import { MATERIALS } from '../../web/js/cad/materials.js';

/** Relative comparison (default 0.5 %). */
function near(actual, expected, rel = 0.005, msg = '') {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= Math.abs(expected) * rel + 1e-12, `${msg} expected ${expected} ± ${rel * 100} %, got ${actual}`);
}
const STEEL = { E: 210, Re: 355, rho: 7850 };
const VERDICTS = ['ok', 'warn', 'fail'];

/* ---------- 1. library shape and defaults ---------- */
test('library: 22 models, unique ids, complete definitions', () => {
  assert.equal(new Set(MODELS.map((m) => m.id)).size, MODELS.length);
  const domains = DOMAINS.map((d) => d.id); assert.deepEqual(domains, ['structure', 'joints', 'fluid', 'thermal', 'electrical']);
  assert.deepEqual(Object.fromEntries(domains.map((d) => [d, MODELS.filter((m) => m.domain === d).length])), { structure: 8, joints: 5, fluid: 2, thermal: 5, electrical: 3 });
  for (const m of MODELS) {
    for (const k of ['id', 'title', 'question', 'sketch', 'validity', 'reference']) assert.ok(typeof m[k] === 'string' && m[k].length > 2, `${m.id}.${k}`); assert.ok(domains.includes(m.domain), m.id);
    assert.ok(m.question.trim().endsWith('?'), `${m.id}: the question ends with « ? »`); assert.ok(Array.isArray(m.assumptions) && m.assumptions.length >= 2 && typeof m.compute === 'function', m.id); assert.equal(model(m.id), m);
    const keys = new Set();
    for (const d of m.inputs) {
      assert.ok(d.key && d.label && typeof d.unit === 'string' && d.group, `${m.id}.${d.key}`); assert.ok(!keys.has(d.key), `${m.id}: duplicate input ${d.key}`); keys.add(d.key);
      if (d.options) assert.ok(d.options.some((o) => o.value === d.default), `${m.id}.${d.key}: default among the options`);
      else assert.ok(Number.isFinite(d.default) && d.min <= d.default && d.default <= d.max && d.step > 0, `${m.id}.${d.key}: min ≤ default ≤ max`);
    }
    for (const o of m.outputs) assert.ok(o.key && o.label && typeof o.unit === 'string', `${m.id} output`); for (const k of Object.keys(m.fill || {})) assert.ok(keys.has(k), `${m.id}: fill key ${k} is an input`);
  }
  assert.equal(model('nope'), null);
});

test('every model runs on its defaults: finite numbers, French steps, a verdict', () => {
  for (const m of MODELS) {
    const r = run(m.id, defaults(m.id)), again = run(m.id); assert.ok(VERDICTS.includes(r.verdict), m.id); assert.equal(r.verdict, 'ok', `${m.id}: the default case is a healthy example (${r.warnings.join(' | ')})`);
    assert.deepEqual(again.values, r.values, `${m.id}: run(id) uses the defaults`); assert.ok(Object.keys(r.values).length >= 4, m.id);
    for (const [k, v] of Object.entries(r.values)) {
      assert.ok(typeof v === 'number' && Number.isFinite(v), `${m.id}.${k} finite`); assert.ok(m.outputs.some((o) => o.key === k), `${m.id}: value ${k} is a declared output`);
    }
    assert.ok(m.outputs.slice(0, 4).every((o) => o.key in r.values), `${m.id}: the four main outputs are computed`); assert.ok(r.steps.length >= 3 && r.steps.every((s) => typeof s === 'string' && s.length > 10), `${m.id} steps`);
    assert.ok(r.steps.some((s) => / = /.test(s)), `${m.id}: steps show formulas`); assert.ok(r.checks.length >= 1, `${m.id}: at least one safety check`);
    for (const c of r.checks) {
      assert.ok(c.label && typeof c.unit === 'string' && typeof c.ok === 'boolean' && typeof c.note === 'string', `${m.id} check`);
      assert.ok(Number.isFinite(c.value) && Number.isFinite(c.limit) && Number.isFinite(c.margin) && c.margin >= 0, `${m.id} check numbers`); assert.equal(c.ok, c.margin >= 1, `${m.id}: ok means margin ≥ 1`);
    }
    assert.doesNotThrow(() => JSON.stringify(r));
  }
});

test('numbers of the steps use the decimal comma', () => {
  assert.equal(n(0.7619047), '0,7619'); assert.equal(n(1666.667), '1667'); assert.equal(n(60), '60'); assert.equal(n(1.724e-8), '1,724 × 10^-8'); assert.equal(n(2.5e7, 3), '2,5 × 10^7'); assert.equal(n(NaN), '—');
  const r = run('beam_cantilever_point', { ...STEEL, L: 200, F: 100 }); assert.ok(r.steps.some((s) => s.includes('= 0,7619 mm') && s.includes('Roark')), 'deflection step with its source table');
  assert.ok(r.steps.some((s) => s.includes('b h³ / 12') && s.includes('1667 mm⁴')));
});

/* ---------- 2. structure ---------- */
test('cantilever, end load (Roark 8.1 case 1a)', () => {
  // Steel 20 x 10 mm, L = 200 mm, F = 100 N, E = 210 GPa:
  //   I = b h^3 / 12 = 20 x 10^3 / 12 = 1666.7 mm4
  //   delta = F L^3 / (3 E I) = 100 x 8e6 / (3 x 210000 x 1666.7) = 0.7619 mm
  //   sigma = M c / I = 6 F L / (b h^2) = 6 x 100 x 200 / (20 x 100) = 60 MPa ; Re / sigma = 355 / 60 = 5.92
  //   f1 = 3.516 / (2 pi L^2) sqrt(E I / (rho A)) = 3.516 / (2 pi 0.04) x sqrt(350 / 1.57) = 13.99 x 14.93 = 208.9 Hz
  //   mass = 7850 x 200e-6 x 0.2 = 0.314 kg
  const r = run('beam_cantilever_point', { ...STEEL, section: 'rect', b: 20, h: 10, L: 200, F: 100, dlim: 1 }); near(r.values.I, 1666.67); near(r.values.delta, 0.7619); near(r.values.sigma, 60); near(r.values.sf_yield, 5.917);
  near(r.values.f1, 208.9); near(r.values.mass, 314); near(r.values.stiffness, 131.25); near(r.values.M, 20); assert.equal(r.verdict, 'ok'); assert.equal(r.checks.length, 2);
  near(r.checks[0].margin, 5.917, 0.002); near(r.checks[1].margin, 1 / 0.7619, 0.002);
});

test('cantilever with uniform load, simply supported beams (Roark 8.1 cases 2a, 1e, 2e)', () => {
  // Same steel bar, total load W = 100 N, E I = 210000 x 1666.7 = 3.5e8 N.mm2:
  //   cantilever UDL : delta = W L^3 / (8 E I) = 8e8 / 2.8e9 = 0.2857 mm ; M = W L / 2 = 10000 -> sigma = 30 MPa
  //   supported, centre load : delta = F L^3 / (48 E I) = 8e8 / 1.68e10 = 0.04762 mm ; M = F L / 4 = 5000 -> 15 MPa
  //   supported, UDL : delta = 5 W L^3 / (384 E I) = 4e9 / 1.344e11 = 0.02976 mm ; M = W L / 8 = 2500 -> 7.5 MPa
  //   supported f1 = pi / (2 L^2) sqrt(E I / (rho A)) = 39.27 x 14.93 = 586.3 Hz
  const inp = { ...STEEL, L: 200, F: 100 };
  const a = run('beam_cantilever_udl', inp).values, b = run('beam_simple_point', inp).values, c = run('beam_simple_udl', inp).values;
  near(a.delta, 0.28571); near(a.sigma, 30); near(a.f1, 208.9); near(b.delta, 0.047619); near(b.sigma, 15); near(b.f1, 586.3); near(c.delta, 0.029762); near(c.sigma, 7.5);
});

test('beam sections: round, tube, custom', () => {
  // Round d = 10: I = pi 10^4 / 64 = 490.87 mm4, A = 78.54 mm2. Tube 20 x 2 (di = 16): I = pi (160000 - 65536) / 64 = 4637.0 mm4, A = pi (400 - 256) / 4 = 113.10 mm2.
  // Custom I = 8500, c = 10: sigma = F L c / I = 100 x 200 x 10 / 8500 = 23.53 MPa.
  near(run('beam_cantilever_point', { section: 'round', d: 10 }).values.I, 490.87);
  const t = run('beam_cantilever_point', { ...STEEL, section: 'tube', d: 20, t: 2, L: 200, F: 100 }).values;
  near(t.I, 4637.0); near(t.mass, 7850 * 113.10e-6 * 0.2 * 1000); near(run('beam_cantilever_point', { section: 'custom', Ic: 8500, cc: 10, Ac: 150, L: 200, F: 100 }).values.sigma, 23.529);
});

test('beams: monotonicity and validity warnings', () => {
  const d = (o) => run('beam_cantilever_point', { ...STEEL, L: 200, F: 100, ...o }).values.delta; assert.ok(d({ L: 300 }) > d({}) && d({ F: 200 }) > d({}) && d({ h: 12 }) < d({}) && d({ E: 69 }) > d({}));
  near(d({ L: 400 }) / d({}), 8, 1e-9);                                     // delta ~ L^3
  const short = run('beam_cantilever_point', { ...STEEL, L: 50, h: 10, F: 100 }); assert.ok(short.warnings.some((w) => w.includes('L / h')) && short.verdict === 'warn', 'L / h < 10 warns');
  const soft = run('beam_cantilever_point', { E: 2.3, Re: 43, rho: 1050, L: 200, F: 100, dlim: 100 }); assert.ok(soft.warnings.some((w) => w.includes('L / 10')), 'large deflection warns');
  assert.equal(soft.verdict, 'fail', 'ABS bar: stress beyond yield'); assert.equal(run('beam_cantilever_point', { ...STEEL, L: 200, F: 100, dlim: 0.5 }).verdict, 'fail', 'deflection limit exceeded');
  const tight = run('beam_cantilever_point', { ...STEEL, L: 200, F: 500, dlim: 10, sf: 1.5 });   // sigma = 300 MPa, margin 1.18 < 1.5
  assert.equal(tight.verdict, 'warn'); assert.ok(tight.checks[0].ok && tight.checks[0].tight);
});

test('column buckling: Euler, Johnson below the transition slenderness, end conditions', () => {
  // Steel rod d = 10 mm, pinned-pinned, E = 210 GPa, Re = 355 MPa: I = 490.87 mm4, A = 78.54 mm2, r = d / 4 = 2.5 mm.
  //   L = 500: lambda = 200 > lambda1 = sqrt(2 pi^2 E / Re) = sqrt(11676.7) = 108.06 -> Euler
  //     Pcr = pi^2 E I / L^2 = 9.8696 x 210000 x 490.87 / 250000 = 4069.6 N
  //   L = 200: lambda = 80 < 108.06 -> Johnson: sigma_cr = Re (1 - Re lambda^2 / (4 pi^2 E)) = 355 x (1 - 0.27405) = 257.71 MPa
  //     Pcr = 257.71 x 78.54 = 20240 N (Euler would wrongly give 25435 N)
  const base = { ...STEEL, section: 'round', d: 10, F: 1000, ends: 'pp' };
  const e = run('column_buckling', { ...base, L: 500 }); near(e.values.lambda, 200); near(e.values.lambda1, 108.06, 0.001); near(e.values.Pcr, 4069.6, 0.001);
  assert.equal(e.values.johnson, 0); assert.equal(e.warnings.length, 0); assert.equal(e.verdict, 'ok');
  const j = run('column_buckling', { ...base, L: 200 });
  near(j.values.lambda, 80); near(j.values.sigma_cr, 257.71, 0.001); near(j.values.Pcr, 20240, 0.001); assert.equal(j.values.johnson, 1); assert.ok(j.warnings.some((w) => w.includes('Johnson')), 'the Johnson regime is announced');
  assert.ok(j.steps.some((s) => s.includes('Johnson')) && e.steps.some((s) => s.includes('Euler')));
  // Fixed-free of 250 mm = pinned-pinned of 500 mm (Le = 2 L); fixed-fixed of 1000 mm too (Le = L / 2).
  near(run('column_buckling', { ...base, L: 250, ends: 'ff' }).values.Pcr, 4069.6, 0.001); near(run('column_buckling', { ...base, L: 1000, ends: 'fx' }).values.Pcr, 4069.6, 0.001);
  near(run('column_buckling', { ...base, L: 500, ends: 'fp' }).values.Le, 350); assert.equal(run('column_buckling', { ...base, L: 500, F: 5000 }).verdict, 'fail', 'load above the critical load');
  assert.equal(run('column_buckling', { ...base, L: 500, F: 2000 }).verdict, 'warn', 'margin 2.03 below the requested 3');
  // The critical stress is continuous at the transition (both formulas give Re / 2).
  const at = run('column_buckling', { ...base, L: 108.06 * 2.5 }).values; near(at.sigma_cr, 355 / 2, 0.002);
});

test('torsion of a round shaft', () => {
  // Steel shaft d = 20 mm, L = 500 mm, T = 100 N.m, G = 80 GPa:
  //   J = pi d^4 / 32 = 15708 mm4 ; tau = 16 T / (pi d^3) = 1.6e6 / 25133 = 63.66 MPa
  //   theta = T L / (G J) = 1e5 x 500 / (80000 x 15708) = 0.03979 rad = 2.280 deg ; 0.577 x 355 / 63.66 = 3.218
  const r = run('shaft_torsion', { do: 20, di: 0, L: 500, T: 100, G: 80, Re: 355, theta_lim: 3 });
  near(r.values.J, 15708, 0.001); near(r.values.tau, 63.662, 0.001); near(r.values.theta, 2.2797, 0.001); near(r.values.sf_yield, 3.2175, 0.001); assert.equal(r.verdict, 'ok');
  // Tube 20 / 16: J = pi (160000 - 65536) / 32 = 9274 mm4 -> tau = 1e5 x 10 / 9274 = 107.8 MPa
  near(run('shaft_torsion', { do: 20, di: 16, L: 500, T: 100, G: 80, Re: 355 }).values.tau, 107.83, 0.001); assert.ok(run('shaft_torsion', { do: 20, di: 25 }).warnings.length > 0, 'inner diameter above the outer one is reported');
});

test('rectangular plate under pressure (Roark 11.4, interpolated)', () => {
  // Steel square plate 200 x 200 x 2 mm, p = 10 kPa = 0.01 MPa, E = 210 GPa:
  //   simply supported (a / b = 1: beta = 0.2874, alpha = 0.0444):
  //     sigma = beta p b^2 / t^2 = 0.2874 x 0.01 x 40000 / 4 = 28.74 MPa ; y = alpha p b^4 / (E t^3) = 0.0444 x 0.01 x 1.6e9 / 1.68e6 = 0.4229 mm
  //   clamped (beta = 0.3078, alpha = 0.0138): sigma = 30.78 MPa ; y = 0.1314 mm
  const base = { a: 200, b: 200, t: 2, p: 10, E: 210, Re: 355 };
  const ss = run('plate_pressure', { ...base, edges: 'ss' }).values, fx = run('plate_pressure', { ...base, edges: 'fixed' }).values;
  near(ss.sigma, 28.74); near(ss.y, 0.42286); near(fx.sigma, 30.78); near(fx.y, 0.13143); near(ss.force, 400);
  // a / b = 1.5: beta = (0.4530 + 0.5172) / 2 = 0.4851 ; alpha = (0.0770 + 0.0906) / 2 = 0.0838
  const mid = run('plate_pressure', { ...base, a: 300, edges: 'ss' }).values; near(mid.beta, 0.4851); near(mid.alpha, 0.0838);
  near(run('plate_pressure', { ...base, a: 5000, edges: 'ss' }).values.beta, 0.75);          // very long plate
  near(run('plate_pressure', { ...base, a: 150, b: 300 }).values.beta, run('plate_pressure', { ...base, a: 300, b: 150 }).values.beta);   // sides swapped
  const big = run('plate_pressure', { ...base, p: 100 }); assert.ok(big.warnings.some((w) => w.includes('t / 2')), 'deflection above t / 2 warns'); assert.equal(interp([1, 2], [10, 20], 1.25), 12.5);
});

test('thermal expansion mismatch', () => {
  // Aluminium (23.6 um/m.K, 69 GPa) on steel (11.7, 205 GPa), L = 300 mm, 20 -> 80 °C, sections 100 mm2 each:
  //   free differential expansion = (23.6 - 11.7)e-6 x 60 x 300 = 0.2142 mm (strain 7.14e-4)
  //   fully restrained: sigma_al = E d_alpha dT = 69000 x 7.14e-4 = 49.27 MPa ; steel: 205000 x 7.14e-4 = 146.4 MPa
  //   rigid joint, shared: F = 7.14e-4 / (1 / 6.9e6 + 1 / 2.05e7) = 3686 N -> 36.86 MPa in each
  const r = run('thermal_mismatch', { L: 300, cte1: 23.6, cte2: 11.7, E1: 69, E2: 205, A1: 100, A2: 100, T0: 20, T: 80 });
  near(r.values.delta, 0.2142); near(r.values.sigma1_blocked, 49.266); near(r.values.sigma2_blocked, 146.37); near(r.values.force, 3685.9); near(r.values.sigma1, 36.859);
  // A slot that takes the whole expansion relieves the parts.
  const slot = run('thermal_mismatch', { L: 300, T: 80, play: 0.3 }); assert.equal(slot.values.force, 0); assert.ok(slot.checks.some((c) => c.label.includes('jeu') && c.ok));
  assert.ok(run('thermal_mismatch', { T: 200 }).values.sigma1 > run('thermal_mismatch', { T: 100 }).values.sigma1);
  // Aluminium held by a much stiffer steel frame, + 380 K: 69000 x 11.9e-6 x 380 = 312 MPa > Re = 276 MPa.
  const hot = run('thermal_mismatch', { A2: 1e6, T: 400 }); near(hot.values.sigma1, 312, 0.01); assert.equal(hot.verdict, 'fail'); assert.ok(hot.warnings.some((w) => w.includes('150 K')));
});

/* ---------- joints ---------- */
test('bolted joint: preload, bolt stress, shear, bearing, stripping, separation', () => {
  // M6 x 1, class 8.8, T = 10 N.m, K = 0.2:
  //   Fi = T / (K d) = 10 / (0.2 x 0.006) = 8333 N (8.33 kN)
  //   As = pi / 4 (6 - 0.9382 x 1)^2 = 20.12 mm2 ; sigma = 8333 / 20.12 = 414.1 MPa = 71.4 % of Sp = 580 MPa
  //   shear Fs = 4000 N on 4 bolts: tau = 4000 / (4 x 20.12) = 49.69 MPa ; bearing on 3 mm: 4000 / (4 x 6 x 3) = 55.56 MPa
  //   stripping of a 9 mm tapped hole in 6061-T6 (Rm 310): 0.6 x 310 x pi x 6 x 9 x 0.875 = 27610 N
  //   bolt breaks before the thread from Le = 800 x 20.12 / (0.6 x 310 x pi x 6 x 0.875) = 5.25 mm
  const r = run('bolted_joint', { size: 'M6', cls: '8.8', T: 10, K: 0.2, nb: 4, Fs: 4000, Fa: 8000, tp: 3, Le: 9, Rm_t: 310 });
  near(r.values.Fi, 8333.3, 0.001); near(r.values.sigma_i, 414.1, 0.001); near(r.values.proof_pct, 71.4, 0.002);
  near(r.values.tau, 49.69, 0.001); near(r.values.sigma_br, 55.556, 0.001); near(r.values.F_strip, 27610, 0.001); near(r.values.Le_min, 5.248, 0.001);
  // Stiffness ratio between 0 and 1; bolt load Fb = Fi + C P and separation at n Fi / (1 - C), with P = 8000 / 4 = 2000 N.
  const C = r.values.C; assert.ok(C > 0.05 && C < 0.6);
  const Fi = 10000 / 1.2; near(r.values.Fb, Fi + C * 2000, 1e-9); near(r.values.F_sep, 4 * Fi / (1 - C), 1e-9); near(r.values.clamp, 4 * (Fi - (1 - C) * 2000), 1e-9);
  near(r.values.F_slip, 0.15 * r.values.clamp, 1e-9); assert.ok(r.steps.some((s) => s.includes('T / (K d)')));
  // Preload grows with the torque and falls with K; classes follow ISO 898-1.
  assert.ok(run('bolted_joint', { T: 12 }).values.Fi > run('bolted_joint', { T: 10 }).values.Fi); assert.ok(run('bolted_joint', { K: 0.15 }).values.Fi > run('bolted_joint', { K: 0.2 }).values.Fi);
  assert.equal(run('bolted_joint', { T: 20 }).verdict, 'fail', '20 N.m on M6 8.8: 828 MPa > Sp'); assert.notEqual(run('bolted_joint', { T: 20, cls: '12.9', mode: 'nut', Re_p: 900 }).verdict, 'fail', '12.9 takes it (Sp = 970 MPa)');
  near(run('bolted_joint', { size: 'M8', T: 24, K: 0.2 }).values.sigma_i, 24000 / (0.2 * 8) / 36.61, 0.002);   // As(M8 x 1.25) = 36.6 mm2
  // Tapped ABS (Rm 45): 0.6 x 45 x pi x 6 x 9 x 0.875 = 4008 N < 8333 N -> the thread strips.
  const abs = run('bolted_joint', { T: 10, Rm_t: 45, Le: 9 }); near(abs.values.F_strip, 4008, 0.002); assert.equal(abs.verdict, 'fail');
  // With a nut the thread checks disappear.
  const nut = run('bolted_joint', { T: 10, mode: 'nut' }); assert.ok(!('F_strip' in nut.values) && !nut.checks.some((c) => c.label.includes('taraudage')));
  // An axial load above the separation load opens the joint.
  const open = run('bolted_joint', { T: 10, Fa: 80000 }); assert.equal(open.verdict, 'fail'); assert.equal(open.values.clamp, 0);
});

test('interference fit (Lamé)', () => {
  // Steel hub Do = 40 on a solid steel shaft d = 20, L = 20, diametral interference 20 um, E = 210 GPa, nu = 0.3, mu = 0.12:
  //   p = delta / { d [ (1/E)((Do2 + d2) / (Do2 - d2) + nu) + (1/E)(1 - nu) ] } = 0.02 / (20 x 2.6667 / 210000) = 78.75 MPa
  //   hub hoop stress = p (Do2 + d2) / (Do2 - d2) = 78.75 x 2000 / 1200 = 131.25 MPa ; von Mises = sqrt(131.25^2 + 131.25 x 78.75 + 78.75^2) = 183.75 MPa
  //   F = pi d L mu p = pi x 20 x 20 x 0.12 x 78.75 = 11875 N ; T = F d / 2 = 118.75 N.m
  const r = run('press_fit', { d: 20, Do: 40, di: 0, L: 20, delta: 20, mu: 0.12, Eh: 210, Es: 210, nuh: 0.3, nus: 0.3, Re_h: 355, Re_s: 355 });
  near(r.values.p, 78.75, 0.001); near(r.values.sigma_hoop, 131.25, 0.001); near(r.values.vm_hub, 183.75, 0.001); near(r.values.force, 11875, 0.001); near(r.values.torque, 118.75, 0.001); assert.equal(r.verdict, 'ok');
  assert.ok(run('press_fit', { delta: 40 }).values.p > run('press_fit', { delta: 20 }).values.p); assert.ok(run('press_fit', { di: 12 }).values.p < run('press_fit', { di: 0 }).values.p, 'a hollow shaft is softer');
  assert.equal(run('press_fit', { delta: 80, Re_h: 250 }).verdict, 'fail', 'hub yields'); assert.equal(run('press_fit', { Treq: 500 }).verdict, 'fail', 'torque above the holding torque');
});

test('dowel pin in shear', () => {
  // Pin d = 6 mm, F = 5000 N, single shear: A = pi 36 / 4 = 28.27 mm2 ; tau = 5000 / 28.27 = 176.8 MPa ; bearing on 6 mm: 5000 / 36 = 138.9 MPa
  const r = run('dowel_pin', { d: 6, F: 5000, planes: '1', np: 1, t: 6, Re_pin: 600, Re_p: 276 }); near(r.values.tau, 176.84, 0.001); near(r.values.sigma_br, 138.89, 0.001); near(r.values.sf_shear, 0.577 * 600 / 176.84, 0.001);
  near(run('dowel_pin', { d: 6, F: 5000, planes: '2' }).values.tau, 88.42, 0.001); near(run('dowel_pin', { d: 6, F: 5000, np: 2 }).values.tau, 88.42, 0.001); assert.equal(run('dowel_pin', { d: 3, F: 5000 }).verdict, 'fail');
});

/* ---------- fluid ---------- */
test('laminar pipe flow (Hagen-Poiseuille)', () => {
  // Water at 20 °C (rho = 998.2, mu = 1.002e-3), d = 4 mm, L = 1 m, Q = 0.1 L/min = 1.667e-6 m3/s:
  //   v = Q / (pi d^2 / 4) = 1.667e-6 / 1.2566e-5 = 0.1326 m/s ; Re = rho v d / mu = 998.2 x 0.1326 x 0.004 / 1.002e-3 = 529 (≈ 530)
  //   dp = 128 mu L Q / (pi d^4) = 128 x 1.002e-3 x 1 x 1.667e-6 / (pi x 2.56e-10) = 265.8 Pa (≈ 265 Pa)
  //   entry length = 0.06 Re d = 0.06 x 529 x 4 = 127 mm ; f = 64 / Re = 0.121
  const r = run('pipe_flow', { fluid: 'water', T: 20, d: 4, L: 1000, Q: 0.1 });
  near(r.values.v, 0.13263, 0.001); near(r.values.Re, 529, 0.005); near(r.values.dp, 265.8, 0.005); near(r.values.Le, 127, 0.01); near(r.values.f, 64 / r.values.Re, 1e-9);
  assert.equal(r.values.turbulent, 0); assert.equal(r.warnings.length, 0); assert.equal(r.verdict, 'ok'); assert.ok(r.steps.some((s) => s.includes('Hagen-Poiseuille')));
  // dp ~ Q, ~ L, ~ 1 / d^4 in the laminar regime.
  const dp = (o) => run('pipe_flow', { d: 4, L: 1000, Q: 0.1, ...o }).values.dp; near(dp({ Q: 0.2 }) / dp({}), 2, 1e-9); near(dp({ L: 500 }) / dp({}), 0.5, 1e-9); near(dp({ d: 8 }) / dp({}), 1 / 16, 1e-9);
  assert.ok(dp({ T: 60 }) < dp({}), 'warm water is thinner'); assert.ok(dp({ fluid: 'glycol50' }) > dp({}) && dp({ fluid: 'oil32' }) > dp({ fluid: 'glycol50' }));
  near(dp({ fluid: 'custom', rho_c: 1000, mu_c: 2 }), 128 * 2e-3 * 1 * (0.1 / 60000) / (Math.PI * 0.004 ** 4), 1e-9);
});

test('pipe flow above Re 2300: warning and Darcy-Weisbach answer', () => {
  // Same pipe at 5 L/min: v = 8.333e-5 / 1.2566e-5 = 6.631 m/s ; Re = 998.2 x 6.631 x 0.004 / 1.002e-3 = 26430 -> turbulent
  //   smooth pipe, Blasius: f = 0.316 / Re^0.25 = 0.316 / 12.75 = 0.02478
  //   dp = f (L / d) rho v^2 / 2 = 0.02478 x 250 x 998.2 x 6.631^2 / 2 = 136.0 kPa (Hagen-Poiseuille would give 13.3 kPa)
  const r = run('pipe_flow', { d: 4, L: 1000, Q: 5, eps: 0, dp_max: 500 }); near(r.values.Re, 26430, 0.005); near(r.values.f, 0.02478, 0.003); near(r.values.dp_kPa, 136.0, 0.005); assert.equal(r.values.turbulent, 1);
  assert.ok(r.warnings.some((w) => w.includes('2300') && w.includes('Blasius')), 'regime change announced'); assert.equal(r.verdict, 'warn');
  // Rough pipe: Swamee-Jain, f = 0.25 / log10(eps / (3.7 d) + 5.74 / Re^0.9)^2, higher than the smooth pipe.
  const rough = run('pipe_flow', { d: 4, L: 1000, Q: 5, eps: 50, dp_max: 500 }); near(rough.values.f, 0.25 / Math.log10(50e-6 / (3.7 * 0.004) + 5.74 / rough.values.Re ** 0.9) ** 2, 1e-9);
  assert.ok(rough.values.f > r.values.f && rough.warnings.some((w) => w.includes('Swamee-Jain')));
  // The switch happens at Re = 2300 and the pressure drop keeps growing with the flow.
  assert.equal(run('pipe_flow', { Q: 0.4 }).values.turbulent, 0);      // Re ≈ 2115
  assert.equal(run('pipe_flow', { Q: 0.5 }).values.turbulent, 1);      // Re ≈ 2643
  assert.ok(run('pipe_flow', { Q: 0.5 }).warnings.some((w) => w.includes('transition')));
  let last = 0;
  for (const Q of [0.05, 0.1, 0.2, 0.4, 0.5, 1, 2, 5]) { const v = run('pipe_flow', { Q }).values.dp; assert.ok(v > last, `dp grows with Q (${Q})`); last = v; }
  assert.equal(run('pipe_flow', { Q: 5, dp_max: 10 }).verdict, 'fail'); assert.ok(run('pipe_flow', { fluid: 'air', d: 2, Q: 30 }).warnings.some((w) => w.includes('Mach')), 'air at 159 m/s');
});

test('orifice flow', () => {
  // Water at 20 °C through a sharp-edged d = 2 mm orifice from a large volume (beta = 0), Cd = 0.61, Q = 1 L/min = 1.667e-5 m3/s:
  //   A = pi x 0.002^2 / 4 = 3.1416e-6 m2 ; Q / (Cd A) = 8.697 m/s ; dp = rho / 2 x 8.697^2 = 499.1 x 75.64 = 37.75 kPa
  //   flow at 100 kPa: Q = Cd A sqrt(2 dp / rho) = 0.61 x 3.1416e-6 x 14.155 = 2.713e-5 m3/s = 1.628 L/min
  const r = run('orifice_flow', { fluid: 'water', T: 20, d: 2, D: 0, Cd: 0.61, Q: 1, dp_max: 100 }); near(r.values.dp_kPa, 37.75, 0.002); near(r.values.Q_max, 1.628, 0.002); near(r.values.v, 5.305, 0.002);
  // In a 4 mm pipe (beta = 0.5) the approach velocity lowers dp by (1 - beta^4) = 0.9375.
  near(run('orifice_flow', { d: 2, D: 4, Q: 1 }).values.dp_kPa / r.values.dp_kPa, 0.9375, 1e-6); near(run('orifice_flow', { d: 2, Q: 2 }).values.dp / r.values.dp, 4, 1e-9);
  assert.ok(run('orifice_flow', { d: 2, Q: 0.2 }).warnings.some((w) => w.includes('Cd')), 'low Reynolds: Cd not constant'); assert.equal(run('orifice_flow', { d: 1, Q: 1 }).verdict, 'fail');
});

/* ---------- thermal ---------- */
test('conduction through a stack', () => {
  // 20 W through 400 mm2: 3 mm of aluminium (k = 167): R = 0.003 / (167 x 4e-4) = 0.04491 K/W
  //   + 0.1 mm of TIM (k = 3): R = 1e-4 / (3 x 4e-4) = 0.08333 K/W -> total 0.12824 K/W, dT = 2.565 K
  //   + contact 0.2 K.cm2/W: R = 0.2e-4 / 4e-4 = 0.05 K/W -> total 0.17824 K/W, dT = 3.565 K ; flux = 20 / 4 cm2 = 5 W/cm2
  const base = { A: 400, P: 20, Tc: 40, t1: 3, k1: 167, t2: 0, t3: 0, tim_t: 0.1, tim_k: 3 };
  const a = run('conduction_stack', { ...base, Rc: 0 }).values, b = run('conduction_stack', { ...base, Rc: 0.2 }).values;
  near(a.R1, 0.04491, 0.001); near(a.R_tim, 0.083333, 0.001); near(a.R_tot, 0.12824, 0.001); near(a.dT, 2.5649, 0.001); near(a.T_hot, 42.565, 0.001); near(b.R_contact, 0.05); near(b.dT, 3.5649, 0.001); near(b.flux, 5);
  // A 1.6 mm FR4 layer (k = 0.3) dominates: R = 0.0016 / (0.3 x 4e-4) = 13.33 K/W.
  const fr4 = run('conduction_stack', { ...base, Rc: 0, t2: 1.6, k2: 0.3 }); near(fr4.values.R2, 13.333, 0.001); assert.equal(fr4.verdict, 'fail');
});

test('junction temperature chain', () => {
  // P = 10 W, Rjc = 1, Rcs = 0.5, Rsa = 5 K/W, Ta = 40 °C: Tj = 40 + 10 x 6.5 = 105 °C ; sink 90 °C ; case 95 °C
  //   Rsa max for Tj = 125 °C: (125 - 40) / 10 - 1.5 = 7 K/W ; P max = 85 / 6.5 = 13.08 W
  const r = run('junction_temperature', { P: 10, Rjc: 1, Rcs: 0.5, Rsa: 5, Ta: 40, Tjmax: 125 }); near(r.values.Tj, 105); near(r.values.Ts, 90); near(r.values.Tc, 95); near(r.values.Rsa_max, 7); near(r.values.P_max, 13.077, 0.001);
  near(r.checks[0].margin, 85 / 65, 0.001);                                 // margin on the temperature rises
  assert.equal(run('junction_temperature', { P: 15 }).verdict, 'fail'); assert.ok(run('junction_temperature', { P: 100 }).warnings.length > 0, 'no heat sink can save it');
});

test('plate-fin heat sink, natural convection (Bar-Cohen & Rohsenow)', () => {
  // Channel between two vertical plates s = 10 mm, L = 100 mm, plates 40 K above air at 20 °C (film 40 °C:
  // nu = 1.70e-5 m2/s, alpha = 2.35e-5 m2/s, k = 0.0266 W/m.K, beta = 1 / 313.15):
  //   Ra_s = g beta dT s^3 / (nu alpha) = 9.807 x 3.193e-3 x 40 x 1e-6 / 3.99e-10 = 3140 ; Ra_s s / L = 314
  //   Nu_s = [576 / 314^2 + 2.87 / sqrt(314)]^-1/2 = [0.00584 + 0.1620]^-1/2 = 2.44 ; h = 2.44 x 0.0266 / 0.01 = 6.5 W/m2.K
  const c = channelNatural(40, 20, 0.01, 0.1); near(c.Ra, 3140, 0.02); near(c.Nu, 2.44, 0.01); near(c.h, 6.5, 0.02);
  // Wide channel: the correlation tends to the isolated plate, Nu_s = 0.59 (Ra_s s / L)^1/4.
  const wide = channelNatural(40, 20, 0.05, 0.1); near(wide.Nu, 0.59 * wide.X ** 0.25, 0.02);
  // Full heat sink: the energy balance closes, the detail matches the formulas at the solved temperature.
  const inp = { P: 20, Ta: 25, eps: 0.8, W: 100, Lf: 100, H: 25, tf: 2, N: 10, k: 209, Tmax: 80 };
  const r = run('heatsink_natural', inp), v = r.values;
  near(v.Q_conv + v.Q_rad, 20, 1e-6); near(v.s, (100 - 10 * 2) / 9, 1e-9); near(v.Rsa, v.dT / 20, 1e-9);
  const ch = channelNatural(v.dT, 25, v.s / 1000, 0.1), m = Math.sqrt(2 * ch.h / (209 * 0.002)), Hc = 0.025 + 0.001, eta = Math.tanh(m * Hc) / (m * Hc); near(v.h, ch.h, 1e-9); near(v.eta, eta, 1e-9);
  near(v.Q_conv, ch.h * (eta * 2 * 10 * Hc * 0.1 + 9 * (v.s / 1000) * 0.1) * v.dT, 1e-9); near(v.Q_rad, 0.8 * 5.670374e-8 * 0.1 * (0.1 + 0.05) * ((25 + v.dT + 273.15) ** 4 - 298.15 ** 4), 1e-9);
  near(v.s_opt / 1000, 2.71 * (9.80665 * ch.air.beta * v.dT / (ch.air.alpha * ch.air.nu * 0.1)) ** -0.25, 1e-9);
  assert.ok(v.Rsa > 1.5 && v.Rsa < 3 && v.s_opt > 5 && v.s_opt < 8, `a 100 x 100 x 25 mm sink is about 2 K/W in free air (${v.Rsa})`);
  // More power is hotter; no radiation is hotter; too many fins choke the channels.
  assert.ok(run('heatsink_natural', { ...inp, P: 40 }).values.Ts > v.Ts && run('heatsink_natural', { ...inp, eps: 0 }).values.Ts > v.Ts);
  const dense = run('heatsink_natural', { ...inp, N: 30 });
  assert.ok(dense.warnings.some((w) => w.includes('trop serrées')) && dense.values.Ts > v.Ts, '30 fins are worse than 10'); assert.equal(run('heatsink_natural', { ...inp, P: 60 }).verdict, 'fail');
});

test('plate-fin heat sink, forced convection (flat-plate correlations)', () => {
  // Air at 3 m/s along 100 mm fins, film temperature ≈ 47 °C (nu ≈ 1.76e-5 m2/s, k ≈ 0.0272 W/m.K, Pr ≈ 0.72):
  //   Re_L = v L / nu = 3 x 0.1 / 1.76e-5 = 17000 (laminar) ; Nu = 0.664 Re^1/2 Pr^1/3 = 0.664 x 130.5 x 0.896 = 77.6
  //   h = Nu k / L = 77.6 x 0.0272 / 0.1 = 21 W/m2.K
  const inp = { P: 50, Ta: 25, v: 3, W: 100, Lf: 100, H: 25, tf: 2, N: 10, k: 209 };
  const r = run('heatsink_forced', inp), v = r.values, air = FLUIDS.air.at(25 + v.dT / 2); near(v.ReL, 17000, 0.03); near(v.h, 21, 0.03);
  near(v.ReL, 3 * 0.1 / air.nu, 1e-6); near(v.h, 0.664 * Math.sqrt(v.ReL) * air.Pr ** (1 / 3) * air.k / 0.1, 1e-6);
  // Air heating: flow = v (N - 1) s H = 3 x 9 x 8.889e-3 x 0.025 = 6.0e-3 m3/s = 21.6 m3/h ; dT_air = P / (rho Q cp).
  near(v.flow, 21.6, 1e-6); near(v.dT_air, 50 / (air.rho * 6.0e-3 * air.cp), 1e-6);
  const Hc = 0.026, m = Math.sqrt(2 * v.h / (209 * 0.002)), eta = Math.tanh(m * Hc) / (m * Hc);
  near(v.dT, v.dT_air / 2 + 50 / (v.h * (eta * 2 * 10 * Hc * 0.1 + 9 * (80 / 9 / 1000) * 0.1)), 1e-6); assert.ok(run('heatsink_forced', { ...inp, v: 6 }).values.Ts < v.Ts && run('heatsink_forced', { ...inp, P: 80 }).values.Ts > v.Ts);
  assert.ok(v.Rsa < run('heatsink_natural', { ...inp, P: 20 }).values.Rsa, 'a fan beats free convection');
  // Long fins at 10 m/s: Re_L = 10 x 2 / 1.7e-5 ≈ 1.2e6 > 5e5 -> mixed boundary layer, Nu = (0.037 Re^0.8 - 871) Pr^1/3.
  const t = run('heatsink_forced', { ...inp, Lf: 2000, v: 10, P: 500 }), a2 = FLUIDS.air.at(25 + t.values.dT / 2); assert.ok(t.values.ReL > 5e5 && t.steps.some((s) => s.includes('0,037')));
  near(t.values.h, (0.037 * t.values.ReL ** 0.8 - 871) * a2.Pr ** (1 / 3) * a2.k / 2, 1e-6); assert.ok(t.warnings.some((w) => w.includes('Couches limites')), 'merged boundary layers are reported');
});

test('lumped thermal mass', () => {
  // 10 W in 100 g (cp = 900 J/kg.K), h = 10 W/m2.K on 100 cm2: C = 90 J/K, h A = 0.1 W/K
  //   tau = C / (h A) = 900 s ; dT_inf = P / (h A) = 100 K ; after t = tau: 100 x (1 - 1/e) = 63.21 K -> 88.21 °C from 25 °C
  //   initial rate = P / C = 0.1111 K/s ; time to reach 80 °C: -900 ln(1 - 55 / 100) = 718.7 s
  const r = run('lumped_mass', { P: 10, m: 100, cp: 900, h: 10, A: 100, Ta: 25, time: 900, Tmax: 80 });
  near(r.values.tau, 900); near(r.values.T_inf, 125); near(r.values.T_t, 88.212, 0.001); near(r.values.rate, 0.11111, 0.001); near(r.values.t_lim, 718.66, 0.001); assert.equal(r.verdict, 'fail');
  // Short duty: fine at 300 s (25 + 100 x (1 - e^-1/3) = 53.3 °C) but not in steady state -> "warn".
  const duty = run('lumped_mass', { P: 10, m: 100, cp: 900, h: 10, A: 100, Ta: 25, time: 300, Tmax: 80 }); near(duty.values.T_t, 53.35, 0.001); assert.equal(duty.verdict, 'warn');
  // A plastic block is not isothermal: Bi = h (V / A) / k = 10 x (1e-4 m3 / 0.01 m2) / 0.2 = 0.5 > 0.1.
  const bi = run('lumped_mass', { m: 105, rho: 1050, k: 0.2, A: 100, h: 10 }); near(bi.values.Bi, 0.5, 0.001); assert.ok(bi.warnings.some((w) => w.includes('Biot')));
});

/* ---------- electrical ---------- */
test('busbar: resistance, voltage drop, Joule loss, temperature rise', () => {
  // Copper 20 x 3 mm, L = 200 mm, rho20 = 17.24 nOhm.m: R20 = 1.724e-8 x 0.2 / 60e-6 = 57.47 uOhm ; J = 100 / 60 = 1.667 A/mm2
  //   at 100 A and 20 °C: dU = 5.75 mV, P = 0.575 W ; hot: R = R20 (1 + 0.00393 (T - 20))
  const inp = { w: 20, t: 3, L: 200, I: 100, Ta: 40, eps: 0.4, hc: 0, rho20: 17.24, alpha: 0.00393 };
  const r = run('busbar', inp), v = r.values;
  near(v.R20, 57.467, 0.001); near(v.J, 1.6667, 0.001); near(v.R, v.R20 * (1 + 0.00393 * (v.T - 20)), 1e-9); near(v.dU, v.R * 1e-6 * 100 * 1e3, 1e-9); near(v.P, 1e4 * v.R * 1e-6, 1e-9);
  // Energy balance at the solved temperature: I2 R = h A dT + eps sigma A (T^4 - Ta^4), A = 2 (w + t) L = 92 cm2, h = 1.42 (dT / w)^1/4.
  const As = 2 * 0.023 * 0.2, h = 1.42 * (v.dT / 0.02) ** 0.25; near(v.h, h, 1e-6); near(v.P, h * As * v.dT + 0.4 * 5.670374e-8 * As * ((v.T + 273.15) ** 4 - 313.15 ** 4), 1e-6);
  assert.ok(v.dT > 3 && v.dT < 15, `100 A in 60 mm2 of copper heats by a few kelvins (${v.dT})`);
  // Imposed h = 10 W/m2.K, no radiation: dT = P / (h A) -> closed form with the hot resistance.
  const fixed = run('busbar', { ...inp, eps: 0, hc: 10 }).values; near(fixed.dT, fixed.P / (10 * As), 1e-6);
  let last = 0;
  for (const I of [50, 100, 200, 400]) { const T = run('busbar', { ...inp, I }).values.T; assert.ok(T > last); last = T; }
  assert.equal(run('busbar', { ...inp, I: 600 }).verdict, 'fail'); assert.equal(run('busbar', { ...inp, I: 200 }).verdict, 'warn', '3.3 A/mm2: above the rule of thumb, temperature still fine');
});

test('PCB trace ampacity (IPC-2221)', () => {
  // 1 mm wide, 35 um (1 oz) external trace, dT = 10 K: A = 0.035 mm2 = 54.25 mil2
  //   I = 0.048 x 10^0.44 x 54.25^0.725 = 0.048 x 2.754 x 18.09 = 2.39 A ; internal layer (k = 0.024): 1.20 A
  const r = run('pcb_trace', { I: 2, w: 1, tcu: 35, layer: 'external', dTmax: 10, L: 50, Ta: 40 }), v = r.values; near(v.area, 0.035); near(v.I_max, 2.39, 0.003);
  near(run('pcb_trace', { I: 1, w: 1, tcu: 35, layer: 'internal', dTmax: 10 }).values.I_max, 1.196, 0.003);
  // Inverse relations: at I = I_max the rise is dTmax and the minimum width is the width.
  const at = run('pcb_trace', { I: v.I_max, w: 1, tcu: 35, dTmax: 10 }).values; near(at.dT, 10, 1e-6); near(at.w_min, 1, 1e-6);
  // 2 A: dT = (2 / (0.048 x 18.09))^(1 / 0.44) = 2.303^2.273 = 6.66 K ; R = rho(46.7 °C) x 0.05 / 0.035e-6 = 27.2 mOhm
  near(v.dT, 6.66, 0.003); near(v.R, 1.724e-8 * (1 + 0.00393 * (v.T - 20)) * 0.05 / 0.035e-6 * 1e3, 1e-9); near(v.R, 27.2, 0.003); assert.equal(r.verdict, 'ok'); assert.equal(run('pcb_trace', { I: 3 }).verdict, 'fail');
  assert.ok(run('pcb_trace', { w: 2 }).values.I_max > v.I_max && run('pcb_trace', { tcu: 70 }).values.I_max > v.I_max);
  assert.ok(run('pcb_trace', { I: 40, w: 20, tcu: 105 }).warnings.some((w) => w.includes('IPC-2221')), 'outside the charts');
});

test('short-time adiabatic heating (I2t, Onderdonk)', () => {
  // Copper: beta = 1 / 0.00393 - 20 = 234.45 °C ; K = sqrt(8890 x 385 / (1.724e-8 x 0.00393)) = 2.248e8 A.sqrt(s)/m2 = 224.8 A.sqrt(s)/mm2
  // (IEC 60949 gives 226). 1000 A for 1 s in 10 mm2 from 40 °C: (J / K)^2 t = (100 / 224.8)^2 = 0.1979
  //   Tf = (40 + 234.45) x exp(0.1979) - 234.45 = 274.45 x 1.2189 - 234.45 = 100.1 °C
  const r = run('adiabatic_pulse', { I: 1000, time: 1, A: 10, Ti: 40, Tmax: 250 }), v = r.values; near(v.Kc, 224.8, 0.001); near(v.Kc, 226, 0.01); near(v.Tf, 100.1, 0.002); near(v.i2t, 1e6); assert.equal(r.verdict, 'ok');
  // The classic short-circuit constant of XLPE cable, 90 -> 250 °C: K sqrt(ln(484.5 / 324.5)) = 226 x 0.633 = 143 A.sqrt(s)/mm2.
  near(run('adiabatic_pulse', { I: 100, time: 1, A: 1, Ti: 90, Tmax: 250 }).values.I_adm, 143, 0.01);
  // Consistency: at I_adm the final temperature is Tmax; at t_adm too; A_min carries I up to Tmax.
  near(run('adiabatic_pulse', { I: v.I_adm, time: 1, A: 10, Ti: 40, Tmax: 250 }).values.Tf, 250, 1e-6); near(run('adiabatic_pulse', { I: 1000, time: v.t_adm, A: 10, Ti: 40, Tmax: 250 }).values.Tf, 250, 1e-6);
  near(run('adiabatic_pulse', { I: 1000, time: 1, A: v.A_min, Ti: 40, Tmax: 250 }).values.Tf, 250, 1e-6);
  // Onderdonk fusing current: Tf = melting point. I2t scaling: twice the current for a quarter of the time.
  near(run('adiabatic_pulse', { I: v.I_fuse, time: 1, A: 10, Ti: 40, Tmax: 250 }).values.Tf, 1083, 1e-6); near(run('adiabatic_pulse', { I: 2000, time: 0.25, A: 10, Ti: 40 }).values.Tf, v.Tf, 1e-9);
  const melt = run('adiabatic_pulse', { I: 5000, time: 1, A: 10 }); assert.equal(melt.verdict, 'fail'); assert.ok(melt.warnings.some((w) => w.includes('fusion') || w.includes('fond')));
});

/* ---------- 3. robustness ---------- */
test('run() never throws: unknown model, partial, hostile or absurd inputs', () => {
  const bad = run('does_not_exist', { a: 1 }); assert.equal(bad.verdict, 'fail'); assert.ok(bad.warnings[0].includes('inconnu')); assert.deepEqual(bad.values, {});
  const junk = [{}, null, undefined, { L: 'abc', F: -5, b: null, h: '12,5', section: 'star' }, { L: NaN, F: Infinity, E: 0, Re: 0 }, { L: 1e99, F: 1e99 }];
  for (const m of MODELS) {
    for (const inp of junk) {
      let r; assert.doesNotThrow(() => { r = run(m.id, inp); }, `${m.id} ${JSON.stringify(inp)}`); assert.ok(VERDICTS.includes(r.verdict) && Array.isArray(r.steps) && Array.isArray(r.checks) && Array.isArray(r.warnings));
      for (const v of Object.values(r.values)) assert.ok(Number.isFinite(v), `${m.id}: only finite values are returned`);
    }
    // Every numeric input at its minimum, then at its maximum.
    for (const pick of ['min', 'max']) {
      const inp = Object.fromEntries(m.inputs.filter((d) => !d.options).map((d) => [d.key, d[pick]])); assert.doesNotThrow(() => run(m.id, inp), `${m.id} at ${pick}`);
    }
    // Every option of every select.
    for (const d of m.inputs.filter((x) => x.options)) for (const o of d.options) assert.ok(VERDICTS.includes(run(m.id, { [d.key]: o.value }).verdict), `${m.id} ${d.key}=${o.value}`);
  }
  const r = run('beam_cantilever_point', { L: 'abc', F: -5, b: null, h: '12,5', section: 'star' });
  assert.equal(r.inputs.L, 200); assert.equal(r.inputs.F, 0); assert.equal(r.inputs.b, 20); assert.equal(r.inputs.h, 12.5); assert.equal(r.inputs.section, 'rect'); assert.equal(r.warnings.length, 4, 'each repaired input is reported');
  assert.equal(run('beam_cantilever_point', { L: 250 }).inputs.F, 50, 'missing keys take the default silently'); assert.equal(run('beam_cantilever_point', { L: 250 }).warnings.length, 0);
});

test('helpers: chk margins, bisect', () => {
  assert.deepEqual([chk('a', 50, 100, 'MPa').margin, chk('a', 150, 100, 'MPa').ok, chk('a', 80, 100, 'MPa', { sf: 1.5 }).tight], [2, false, true]); assert.equal(chk('a', 9, 6, 'mm', { min: true }).margin, 1.5);
  assert.equal(chk('a', 0, 100, 'MPa').margin, 999); assert.equal(chk('a', NaN, 100, 'MPa').ok, false); near(bisect((x) => x * x - 2, 0, 2), Math.SQRT2, 1e-9);
});

/* ---------- 4. prefill, properties, summary ---------- */
const PART = { spec: { id: 'P1', name: 'Bras', material: 'AL6061-T6', interfaces: [{ id: 'IF1', type: 'bolt_pattern', params: { screw: 'M4' } }] },
  built: { bbox: [0, -10, 0, 200, 10, 10], mass: 108, volume: 40000, bodies: [{ area: 12400 }], facts: { holes: [{ d: 4.5 }, { d: 4.5 }, { d: 3 }] }, interfaces: [] } };

test('prefill() takes the envelope and the material of a part, with the origin of each value', () => {
  const beam = prefill('beam_cantilever_point', PART); assert.deepEqual(beam.inputs, { mat: 'AL6061-T6', L: 200, b: 20, h: 10, d: 20 }, 'the part gives its medium : E, Re and ρ follow from it');
  for (const k of Object.keys(beam.inputs)) assert.ok(typeof beam.notes[k] === 'string' && beam.notes[k].length > 8, `note for ${k}`);
  assert.ok(beam.notes.L.includes('enveloppe') && beam.notes.mat.includes('6061') && beam.notes.mat.includes('matière de la pièce'));
  const ran = run('beam_cantilever_point', beam.inputs); assert.deepEqual([ran.inputs.E, ran.inputs.Re, ran.inputs.rho, ran.inputs.mat], [69, 276, 2700, 'AL6061-T6']); assert.equal(ran.media.from.E.name, 'Aluminium 6061-T6');
  // The prefilled case is the hand case: delta = 50 x 200^3 / (3 x 69000 x 1666.7) = 1.159 mm.
  near(run('beam_cantilever_point', beam.inputs).values.delta, 1.1594, 0.001); assert.deepEqual(prefill('bolted_joint', PART).inputs, { mat: 'AL6061-T6', size: 'M4', tp: 10, lk: 10 });
  assert.ok(prefill('bolted_joint', PART).notes.size.includes('IF1')); assert.deepEqual(prefill('lumped_mass', PART).inputs, { mat: 'AL6061-T6', m: 108, A: 124 });
  assert.deepEqual(prefill('pipe_flow', PART).inputs, { d: 4.5, L: 200 }); assert.deepEqual(prefill('conduction_stack', PART).inputs, { mat1: 'AL6061-T6', t1: 10, A: 4000 });
  assert.equal(prefill('thermal_mismatch', PART).inputs.A1, 200);          // volume / length
  const cu = prefill('busbar', { spec: { material: 'CU-C110' }, built: { bbox: [0, 0, 0, 3, 150, 25] } }); assert.deepEqual(cu.inputs, { mat: 'CU-C110', L: 150, w: 25, t: 3 }); assert.deepEqual([run('busbar', cu.inputs).inputs.rho20, run('busbar', cu.inputs).inputs.alpha], [17.24, 0.00393]);
  // Plastics have no resistivity; an unknown material gives the geometry only; no part gives nothing.
  assert.deepEqual(Object.keys(prefill('busbar', { spec: { material: 'ABS' }, built: PART.built }).inputs), ['mat', 'L', 'w', 't']); assert.ok(run('busbar', { ...prefill('busbar', { spec: { material: 'ABS' }, built: PART.built }).inputs }).warnings.some((w) => /ABS : résistivité électrique à 20 °C inconnue de la base des médias/.test(w)), 'a plastic has no resistivity : the run says so');
  assert.deepEqual(Object.keys(prefill('beam_simple_udl', { spec: { material: 'UNOBTAINIUM' }, built: PART.built }).inputs), ['L', 'b', 'h', 'd']);
  assert.deepEqual(Object.keys(prefill('beam_simple_udl', { spec: PART.spec }).inputs), ['mat']); assert.deepEqual(prefill('beam_simple_udl', {}), { inputs: {}, notes: {} });
  assert.deepEqual(prefill('beam_simple_udl'), { inputs: {}, notes: {} }); assert.deepEqual(prefill('nope', PART), { inputs: {}, notes: {} }); assert.deepEqual(prefill('junction_temperature', PART).inputs, {});
  // Every model accepts its own prefill and still computes.
  for (const m of MODELS) {
    const pf = prefill(m.id, PART); assert.deepEqual(Object.keys(pf.inputs).sort(), Object.keys(pf.notes).sort(), m.id); for (const k of Object.keys(pf.inputs)) assert.ok(m.inputs.some((d) => d.key === k) || m.media.some((x) => x.key === k), `${m.id}.${k}`);
    assert.ok(VERDICTS.includes(run(m.id, pf.inputs).verdict), m.id);
  }
  assert.equal(partContext(PART.spec, PART.built).screw.v, 'M4'); assert.equal(partContext(null, { facts: { holes: [{ d: 5, thread: 'M6' }] } }).screw.v, 'M6');
});

test('material properties cover materials.js and stay consistent with it', () => {
  assert.deepEqual([...PROP_IDS].sort(), MATERIALS.map((m) => m.id).sort());
  for (const m of MATERIALS) {
    const p = props(m.id); assert.ok(p && p.typical && p.note.includes('fiche technique'), m.id); for (const k of ['E', 'nu', 'G', 'cte', 'k', 'cp', 'rho', 'Rm']) assert.ok(Number.isFinite(p[k]) && p[k] > 0, `${m.id}.${k}`);
    near(p.rho, m.rho * 1000, 0.02, `${m.id} density`); near(p.G, p.E / (2 * (1 + p.nu)), 0.001); if (m.E) assert.equal(p.E, m.E, `${m.id}: same E as materials.js`); if (m.k) assert.equal(p.k, m.k, `${m.id}: same k as materials.js`);
    if (m.rhoE) assert.equal(p.rhoE, m.rhoE); if (m.cls === 'metal') assert.ok(p.Re > 50 && p.Rm >= p.Re && p.rhoE > 1e-8 && p.rhoE < 2e-6 && p.alphaE > 0, `${m.id} metal`);
    if (m.cls === 'plastic') assert.ok(p.Tmax >= 50 && p.Tmax <= 260 && p.rhoE === null, `${m.id} plastic`);
  }
  assert.equal(props('al6061-t6').id, 'AL6061-T6'); assert.equal(props('UNOBTAINIUM'), null); assert.equal(props(undefined), null);
});

test('fluid properties at 20 °C and their variation with temperature', () => {
  // Reference values (Incropera / White tables, ASHRAE for glycol): water 998.2 kg/m3, 1.002 mPa.s, 0.598 W/m.K, Pr 7.0 ;
  // air 1.204 kg/m3, 1.82e-5 Pa.s, 0.0257 W/m.K, Pr 0.71-0.73 ; glycol 50 %: 1071 kg/m3, 3.94 mPa.s ; ISO VG 32: 32 cSt at 40 °C.
  const { water, air, glycol50, oil32 } = FLUIDS; near(water.rho, 998.2, 0.001); near(water.mu, 1.002e-3, 0.005); near(water.k, 0.598, 0.005); near(water.Pr, 7.0, 0.01);
  near(air.rho, 1.204, 0.002); near(air.mu, 1.82e-5, 0.01); near(air.k, 0.0255, 0.02); assert.ok(air.Pr > 0.70 && air.Pr < 0.74); near(glycol50.rho, 1071, 0.001); near(glycol50.mu, 3.94e-3, 0.001); near(glycol50.Pr, 34, 0.01);
  near(oil32.at(40).nu, 32e-6, 0.01); near(oil32.at(100).nu, 5.4e-6, 0.02); near(oil32.rho, 870, 0.001); near(water.at(60).mu, 0.467e-3, 0.02); near(water.at(60).rho, 983.2, 0.001); near(water.at(80).k, 0.670, 0.01);
  near(air.at(100).rho, 0.946, 0.005); near(air.at(100).mu, 2.18e-5, 0.01); near(air.at(100).k, 0.0314, 0.02);
  for (const f of Object.values(FLUIDS)) {
    for (const k of ['rho', 'mu', 'k', 'cp', 'Pr', 'nu', 'alpha', 'beta']) assert.ok(Number.isFinite(f[k]) && f[k] > 0, `${f.id}.${k}`); near(f.Pr, f.mu * f.cp / f.k, 1e-9);
    const hot = f.at(60);
    if (f.phase === 'gas') assert.ok(hot.mu > f.mu && hot.rho < f.rho, `${f.id}: a gas gets more viscous when hot`); else assert.ok(hot.mu < f.mu && hot.rho < f.rho, `${f.id}: a liquid gets thinner when hot`);
    assert.ok(Number.isFinite(f.at(NaN).mu) && Number.isFinite(f.at(1e6).mu) && Number.isFinite(f.at(-1e6).mu), 'clamped to the valid range');
  }
});

test('physicsSummary(): rows of the design-review report', async () => {
  const { physicsSummary } = await import('../../web/js/modules/physics.js');
  const a = run('beam_cantilever_point', { ...STEEL, L: 200, F: 100, dlim: 0.5 }), b = run('pipe_flow', {});
  const project = { parts: [{ id: 'P1', name: 'Bras' }], physics: [
    { id: 'phy-1', model: 'beam_cantilever_point', part: 'P1', inputs: a.inputs, values: a.values, checks: a.checks, verdict: a.verdict, when: '2026-11-14T10:00:00.000Z' },
    { id: 'phy-2', model: 'pipe_flow', part: null, inputs: b.inputs, values: b.values, checks: b.checks, verdict: b.verdict, when: '2026-11-14T11:00:00.000Z' },
    { id: 'phy-3', model: 'removed_model', part: 'GONE', values: {}, checks: [], verdict: 'warn' }] };
  const rows = physicsSummary(JSON.parse(JSON.stringify(project))); assert.equal(rows.length, 3);
  assert.deepEqual([rows[0].title, rows[0].part, rows[0].partName, rows[0].verdict, rows[0].verdictLabel], ['Cantilever beam, end load', 'P1', 'Bras', 'fail', 'NON']);
  assert.ok(rows[0].result.includes('Flèche maximale') && rows[0].result.includes('0,7619') && rows[0].result.endsWith('mm'), rows[0].result);
  assert.ok(rows[0].worst.includes('Flèche') && rows[0].worst.includes('0,656'), rows[0].worst); assert.deepEqual([rows[1].part, rows[1].verdictLabel], ['', 'OK']); assert.ok(rows[1].result.startsWith('Perte de charge'));
  assert.deepEqual([rows[2].title, rows[2].result, rows[2].verdictLabel], ['removed_model', '—', 'À vérifier']); assert.deepEqual(physicsSummary({}), []); assert.deepEqual(physicsSummary(null), []);
});
