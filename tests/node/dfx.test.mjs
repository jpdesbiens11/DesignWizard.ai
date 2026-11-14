// Tests of the DFM / DFA / DFx rule engine: web/js/analysis/dfx_core.js, dfx_rules*.js, dfa_rules.js.
// Run from the repository root:  node --test tests/node/dfx.test.mjs
//
// 1. applyPatch, summarize, meshWallThickness (pure helpers).
// 2. Small parts built with the real kernel: the expected rule ids fire / do not fire.
// 3. Every one-click auto-fix: apply the patch, rebuild, the finding is gone.
// 4. The printable rule book, partial inputs, deterministic order.
// 5. A DFA case: two parts, one mate (clean, then with a broken interface link).
import test from 'node:test';
import assert from 'node:assert/strict';
import { kernel } from './kernel_helper.mjs';
import { buildPart } from '../../web/js/cad/build.js';
import { applyPatch, summarize, meshWallThickness } from '../../web/js/analysis/dfx_core.js';
import { RULEBOOK, checkPart } from '../../web/js/analysis/dfx_rules.js';
import { ipcSpacing, netVoltage } from '../../web/js/analysis/dfx_rules_pcb.js';
import { checkAssembly } from '../../web/js/analysis/dfa_rules.js';

const K = await kernel();

/** Build a part, tessellate its main body and run the rules. */
function check(spec, withMesh = true) {
  const built = buildPart(K, spec);
  const main = built.bodies.find((b) => b.name === built.main) || built.bodies[0];
  const mesh = withMesh && main ? K.tessellate(main.shape) : null;
  const res = checkPart(spec, built, mesh ? { mesh } : undefined);
  K.flush();
  return { built, mesh, ...res };
}
const ids = (res, severity) => res.findings.filter((f) => !severity || f.severity === severity).map((f) => f.id);
const find = (res, id) => res.findings.find((f) => f.id === id);
const sameFinding = (a) => (b) => b.id === a.id && b.feature === a.feature && b.iface === a.iface;

// ---- fixtures ---------------------------------------------------------------------------------------------------------
const heatSinkPoly = () => {                    // base 42 x 4 with 7 fins of 1 mm, 30 mm tall, 5.83 mm apart: thin walls, deep gaps, sharp corners
  const pts = [[0, 0], [42, 0]], n = 7, pitch = 41 / (n - 1);
  for (let i = n - 1; i >= 0; i--) { const x = i * pitch; pts.push([x + 1, i === n - 1 ? 0 : 4], [x + 1, 34], [x, 34], [x, i === 0 ? 0 : 4]); }
  return pts.filter((p, i) => !(i > 1 && p[1] === 0));      // the outer fins are flush with the base ends
};
const SPECS = {
  mill: { id: 'T-MILL', name: 'Bloc usiné', material: 'AL6061-T6', process: 'cnc_milling', elec: { kind: 'chassis' }, params: { r_corner: 0.2, L: 80 },
    features: [{ op: 'box', size: ['L', 50, 15] }, { op: 'pocket', face: '+Z', rect: [15, 12, 40, 26], r: 'r_corner', depth: 10 }, { op: 'hole', face: '+Z', at: [70, 25], d: 3.25, depth: 9 }] },
  sink: { id: 'T-SINK', name: 'Dissipateur', material: 'AL6063-T5', process: 'extrusion_al', elec: { kind: 'chassis' }, params: { L: 120 },
    extrusion: { length: 'L', profile: { poly: heatSinkPoly() } } },
  box: { id: 'T-BOX', name: 'Boîtier moulé', material: 'ABS', process: 'injection_molding', params: { wall: 0.6 },
    features: [{ op: 'box', size: [90, 60, 30] }, { op: 'fillet', r: 4, edges: 'vertical' }, { op: 'shell', t: 'wall', open: ['+Z'] }] },
  pcb: { id: 'T-PCB', name: 'Carte', material: 'FR4', process: 'pcb',
    pcb: { size: [80, 50], r: 2, t: 1.5, components: [{ ref: 'C1', kind: 'capacitor', at: [78, 25], size: [6, 4, 3] }, { ref: 'U1', kind: 'mcu', at: [40, 25], size: [10, 10, 1.6] }] },
    interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'pcb_mount', partner: 'Boîtier', side: 'A', face: '-Z', at: [40, 25], params: { screw: 'M3', pattern: { type: 'rect', nx: 2, ny: 2, dx: 70, dy: 40 } } }] },
  edge: { id: 'T-EDGE', name: 'Platine', material: 'AL6061-T6', process: 'cnc_milling', elec: { kind: 'chassis' }, features: [{ op: 'box', size: [60, 40, 8] }],
    interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'k1', partner: 'Capot', side: 'B', face: '+Z', at: [30, 20], params: { screw: 'M4', pattern: { type: 'rect', nx: 2, ny: 2, dx: 54, dy: 34 } } }] },
  clean: { id: 'T-CLEAN', name: 'Platine propre', material: 'AL6061-T6', process: 'cnc_milling', elec: { kind: 'chassis' }, params: { L: { value: 80, min: 40, max: 200 }, W: 50, t: 10 },
    features: [{ op: 'box', size: ['L', 'W', 't'] }, { op: 'pocket', face: '+Z', rect: [20, 12, 40, 26], r: 3, depth: 5 }, { op: 'hole', face: '+Z', at: [10, 25], d: 5, depth: 'through' }],
    interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'k2', partner: 'Socle', side: 'B', face: '+Z', at: ['L/2', 'W/2'], params: { screw: 'M4', pattern: { type: 'rect', nx: 2, ny: 2, dx: 64, dy: 34 } }, opts: { depth: 'through' } }] },
  house: { id: 'T-HOUSE', name: 'Boîtier imprimé', family: 'enclosure', material: 'PA12', process: 'mjf',
    features: [{ op: 'box', size: [120, 80, 40] }, { op: 'shell', t: 0.7, open: ['+Z'] }, { op: 'fillet', r: 0.3, edges: 'vertical' }],
    interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'pcb_mount', partner: 'Carte', side: 'B', face: '+Z', level: 10, at: [60, 40], params: { screw: 'M3', pattern: { type: 'rect', nx: 2, ny: 2, dx: 90, dy: 50 } }, opts: { standoff: { h: 9.3, d: 2.9 } } },
      { id: 'IF2', type: 'cutout', key: 'conn', partner: 'Connecteur', side: 'A', face: '-Y', at: [60, 20], params: { shape: 'rect', w: 20, h: 10, r: 1 } },
      { id: 'IF3', type: 'rail', key: 'guide', partner: 'Carte', side: 'B', face: '+X', at: [40, 20], params: { t: 1.6, depth: 0.4, length: 60 }, opts: { clearance: 0.1 } }] },
};
const R = Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, check(s)]));

// ---- 1. helpers ---------------------------------------------------------------------------------------------------------
test('applyPatch: parameters (short form, object form, range kept consistent)', () => {
  const spec = { id: 'P', params: { L: 80, W: { value: 50, min: 20, max: 60 }, half: { expr: 'L/2' } } };
  const out = applyPatch(spec, [{ target: 'param', id: 'L', value: 90 }, { target: 'param', id: 'W', value: 70 }, { target: 'param', id: 'half', value: 30 }, { target: 'param', id: 'W', path: 'label', value: 'Largeur' }]);
  assert.equal(out.params.L, 90);
  assert.deepEqual(out.params.W, { value: 70, min: 20, max: 70, label: 'Largeur' });
  assert.deepEqual(out.params.half, { value: 30 });
  assert.deepEqual(spec.params, { L: 80, W: { value: 50, min: 20, max: 60 }, half: { expr: 'L/2' } }, 'the input spec is not mutated');
});

test('applyPatch: features by explicit id and by implicit index, nested paths', () => {
  const spec = { features: [{ op: 'box', size: [10, 20, 3] }, { op: 'hole', id: 'h1', d: 3.25 }, { op: 'boss', d: 6, h: 5, hole: { d: 2.4 } }] };
  const out = applyPatch(spec, [{ target: 'feature', id: 'h1', path: 'd', value: 3.3 }, { target: 'feature', id: 'f1', path: 'size.2', value: 2 }, { target: 'feature', id: 'f3', path: 'hole.d', value: 2.5 }, { target: 'feature', id: 'f3', path: 'hole.depth', value: 'through' }]);
  assert.equal(out.features[1].d, 3.3);
  assert.deepEqual(out.features[0].size, [10, 20, 2]);
  assert.deepEqual(out.features[2].hole, { d: 2.5, depth: 'through' });
  assert.throws(() => applyPatch(spec, [{ target: 'feature', id: 'f9', path: 'd', value: 1 }]), /introuvable/);
  assert.throws(() => applyPatch(spec, [{ target: 'feature', id: 'f2', path: 'd', value: 1 }]), /introuvable/, '"f2" is not the implicit id of a feature that has its own id');
  assert.throws(() => applyPatch(spec, [{ target: 'nope', path: 'x', value: 1 }]), /cible inconnue/);
});

test('applyPatch: interfaces, root paths and the `part` field of assembly fixes', () => {
  const spec = { id: 'P1', material: 'ABS', pcb: { t: 1.5, components: [{ ref: 'C1', at: [1, 2] }] }, interfaces: [{ type: 'bolt_pattern', params: { screw: 'M3' } }, { id: 'lid', type: 'bolt_pattern', opts: { thread: 'tapped' } }] };
  const out = applyPatch(spec, [{ target: 'interface', id: 'IF1', path: 'opts.depth', value: 2.5 }, { target: 'interface', id: 'lid', path: 'opts.thread', value: 'insert' }, { target: 'interface', id: 'lid', path: 'params', value: { screw: 'M4' } },
    { target: 'spec', id: null, path: 'material', value: 'PC' }, { target: 'spec', path: 'pcb.t', value: 1.6 }, { target: 'spec', path: 'pcb.components.0.at', value: [5, 6] },
    { target: 'spec', part: 'OTHER', path: 'material', value: 'POM' }, { target: 'spec', part: 'P1', path: 'finish', value: 'brut' }]);
  assert.deepEqual(out.interfaces[0].opts, { depth: 2.5 });
  assert.deepEqual(out.interfaces[1], { id: 'lid', type: 'bolt_pattern', opts: { thread: 'insert' }, params: { screw: 'M4' } });
  assert.equal(out.material, 'PC', 'the entry for another part is skipped');
  assert.equal(out.finish, 'brut');
  assert.deepEqual(out.pcb, { t: 1.6, components: [{ ref: 'C1', at: [5, 6] }] });
});

test('applyPatch: a field holding an expression', () => {
  const spec = { params: { r_corner: { value: 0.2, min: 0, max: 5 }, L: 80, wall: 2 },
    features: [{ op: 'pocket', r: 'r_corner', depth: 'L/2 - 10' }, { op: 'shell', t: ' wall ' }, { op: 'hole', d: 'unknown_name', depth: 'wall' }] };
  const out = applyPatch(spec, [{ target: 'feature', id: 'f1', path: 'r', value: 2 }, { target: 'feature', id: 'f1', path: 'depth', value: 12 }, { target: 'feature', id: 'f2', path: 't', value: 1.2 },
    { target: 'feature', id: 'f3', path: 'd', value: 3.3 }, { target: 'feature', id: 'f3', path: 'depth', value: 'through' }]);
  assert.equal(out.features[0].r, 'r_corner', 'a bare parameter name is fixed at its source');
  assert.equal(out.params.r_corner.value, 2);
  assert.equal(out.features[0].depth, 12, 'any other expression is replaced by the number');
  assert.equal(out.params.L, 80);
  assert.equal(out.params.wall, 1.2);
  assert.equal(out.features[1].t, ' wall ');
  assert.equal(out.features[2].d, 3.3, 'a name that is not a parameter is replaced');
  assert.equal(out.features[2].depth, 'through', 'a non-numeric value replaces the field, not the parameter');
});

test('summarize: counts, score and status', () => {
  assert.deepEqual(summarize([]), { errors: 0, warnings: 0, infos: 0, score: 100, status: 'pass' });
  assert.deepEqual(summarize([{ severity: 'info' }]), { errors: 0, warnings: 0, infos: 1, score: 99, status: 'pass' });
  assert.deepEqual(summarize([{ severity: 'warn' }, { severity: 'warn' }, { severity: 'info' }]), { errors: 0, warnings: 2, infos: 1, score: 89, status: 'review' });
  assert.deepEqual(summarize([{ severity: 'error' }, { severity: 'warn' }]), { errors: 1, warnings: 1, infos: 0, score: 75, status: 'fail' });
  assert.equal(summarize(Array.from({ length: 30 }, () => ({ severity: 'info' }))).score, 90, 'infos never cost more than 10 points');
  assert.equal(summarize(Array.from({ length: 9 }, () => ({ severity: 'error' }))).score, 0);
});

test('meshWallThickness: solid plate, shelled box, bad input', () => {
  const plate = buildPart(K, { features: [{ op: 'box', size: [30, 20, 5] }] });
  const w = meshWallThickness(K.tessellate(plate.bodies[0].shape));
  assert.ok(Math.abs(w.min - 5) < 1e-3 && Math.abs(w.median - 5) < 1e-3 && Math.abs(w.max - 30) < 1e-3, JSON.stringify(w));
  assert.equal(w.at.length, 3);
  const { mesh } = R.box, s = meshWallThickness(mesh, { maxRays: 400 });
  assert.ok(Math.abs(s.min - 0.6) < 5e-3 && Math.abs(s.p10 - 0.6) < 5e-3 && Math.abs(s.median - 0.6) < 5e-3, JSON.stringify(s));
  assert.ok(s.rays > 100 && s.rays <= 400);
  assert.deepEqual([meshWallThickness(null).min, meshWallThickness({ pos: [], idx: [] }).min], [null, null]);
  K.flush();
});

test('IPC-2221B Table 6-1', () => {
  assert.deepEqual([ipcSpacing(12, 'B2'), ipcSpacing(48, 'B2'), ipcSpacing(400, 'B1'), ipcSpacing(400, 'B2'), ipcSpacing(400, 'A5'), ipcSpacing(800, 'B2')], [0.1, 0.6, 0.25, 2.5, 0.8, 4]);
  assert.equal(netVoltage({ kind: 'dc', voltage: 400 }, { kind: 'dc', voltage: -400 }), 800);
  assert.ok(Math.abs(netVoltage({ kind: 'ac', voltage: 230 }, { kind: 'dc', voltage: 0 }) - 230 * Math.SQRT2) < 1e-9);
  assert.equal(netVoltage({ kind: 'dc', voltage: 400 }, undefined), null);
});

// ---- 2. rules on real parts ----------------------------------------------------------------------------------------------
test('every fixture builds without a kernel error and no rule is skipped', () => {
  for (const [k, r] of Object.entries(R)) {
    assert.deepEqual(r.built.log.filter((l) => l.level === 'error'), [], k);
    assert.deepEqual(r.skipped, [], k);
    assert.ok(!ids(r).includes('KRN-01'), k);
  }
});

test('milled part: too-small pocket radius and non-standard hole', () => {
  const r = R.mill, c01 = find(r, 'CNC-01'), c04 = find(r, 'CNC-04');
  assert.equal(c01.severity, 'error');
  assert.equal(c01.feature, 'f2');
  assert.equal(c01.value, 0.2);
  assert.match(c01.message, /Rayon intérieur du pocket.*R0,2.*Limite.*Correctif : passer à R2/);
  assert.deepEqual(c01.fix.patch, [{ target: 'feature', id: 'f2', path: 'r', value: 2 }]);
  assert.equal(c04.severity, 'warn');
  assert.deepEqual(c04.where, [70, 25, 15]);
  assert.deepEqual(c04.fix, { label: 'Passer à Ø3,3 (foret standard)', patch: [{ target: 'feature', id: 'f3', path: 'd', value: 3.3 }] });
  assert.deepEqual(ids(r, 'error'), ['CNC-01']);
  for (const id of ['CNC-02', 'CNC-03', 'CNC-06', 'CNC-07', 'CNC-08', 'IF-01', 'GEN-01', 'GEN-03']) assert.ok(!ids(r).includes(id), id);
  assert.ok(['CNC-01', 'CNC-04', 'CNC-07', 'CNC-11', 'IF-01', 'GEN-03', 'KRN-01'].every((id) => r.rules.includes(id)), 'the list of rules that ran');
  assert.deepEqual(r.summary, { errors: 1, warnings: 1, infos: 2, score: 73, status: 'fail' });
});

test('aluminium heat sink: thin walls, deep fin gap, sharp corners', () => {
  const r = R.sink;
  assert.equal(find(r, 'EXT-01').value, 1);
  assert.equal(find(r, 'EXT-01').limit, 1.2);
  assert.equal(find(r, 'EXT-03').severity, 'error');
  assert.ok(find(r, 'EXT-03').value > 5 && find(r, 'EXT-03').value < 5.3, 'gap 5.83 wide, 30 deep');
  assert.equal(find(r, 'EXT-03').where.length, 3);
  assert.deepEqual(find(r, 'EXT-04').fix.patch, [{ target: 'spec', id: null, path: 'extrusion.profile.r', value: 0.5 }]);
  for (const id of ['EXT-02', 'EXT-07', 'EXT-10', 'EXT-11']) assert.ok(ids(r).includes(id), id);
  for (const id of ['EXT-00', 'EXT-05', 'EXT-06', 'EXT-08', 'EXT-09', 'GEN-03', 'CNC-04']) assert.ok(!ids(r).includes(id), id);
});

test('moulded box: shell thinner than the material minimum', () => {
  const f = find(R.box, 'MLD-01');
  assert.equal(f.severity, 'error');
  assert.deepEqual([f.value, f.limit, f.feature], [0.6, 1.2, 'f3']);
  assert.match(f.message, /0,6 mm.*1,2 mm.*Correctif/);
  assert.equal(R.box.findings.filter((x) => x.id === 'MLD-01').length, 1, 'the mesh probe does not repeat the shell finding');
  assert.ok(ids(R.box).includes('MLD-02') && !ids(R.box).includes('MLD-04') && !ids(R.box).includes('MLD-07'));
});

test('PCB: component off the edge and non-standard thickness', () => {
  const r = R.pcb, p06 = find(r, 'PCB-06'), p05 = find(r, 'PCB-05');
  assert.equal(p06.severity, 'error');
  assert.equal(p06.feature, 'pcb.C1');
  assert.deepEqual(p06.fix.patch, [{ target: 'spec', id: null, path: 'pcb.components.0.at', value: [75, 25] }]);
  assert.deepEqual([p05.severity, p05.value, p05.limit], ['warn', 1.5, 1.6]);
  for (const id of ['PCB-01', 'PCB-03', 'PCB-07', 'PCB-21', 'IF-01', 'IF-07']) assert.ok(!ids(r).includes(id), id);
});

test('PCB: copper zones against IPC-2221B, screw heads and the board edge', () => {
  const spec = { id: 'T-PCB2', material: 'FR4', process: 'pcb',
    pcb: { size: [100, 60], r: 1, t: 1.6, components: [{ ref: 'J1', kind: 'connector', at: [3, 30], size: [12, 20, 11] }, { ref: 'U1', kind: 'ic', at: [50, 20], size: [10, 10, 2] }, { ref: 'U2', kind: 'ic', at: [55, 20], size: [10, 10, 2] }, { ref: 'Q1', kind: 'mosfet', at: [9, 8], size: [6, 6, 8] }],
      zones: [{ net: 'HV+', rect: [20, 40, 25, 15] }, { net: 'HV-', rect: [45.5, 40, 25, 15] }, { net: 'LV', rect: [75, 40, 10, 10] }, { net: 'X', rect: [60, 2, 5, 5] }],
      nets: { 'HV+': { kind: 'dc', voltage: 400 }, 'HV-': { kind: 'dc', voltage: 0 }, LV: { kind: 'dc', voltage: 12 } } },
    interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'm', partner: 'Boîtier', side: 'A', face: '-Z', at: [50, 30], params: { screw: 'M3', pattern: { type: 'rect', nx: 2, ny: 2, dx: 90, dy: 50 } } }] };
  const r = check(spec, false);
  const p11 = find(r, 'PCB-11');
  assert.deepEqual([p11.severity, p11.value, p11.limit], ['error', 0.5, 2.5], '0.5 mm between HV+ and HV- at 400 V: under A5 (0.8) and B2 (2.5)');
  assert.equal(find(r, 'PCB-08').severity, 'warn');
  assert.equal(find(r, 'PCB-07').feature, 'pcb.U1');
  assert.equal(find(r, 'PCB-06').severity, 'info', 'a connector may overhang on purpose');
  assert.equal(find(r, 'PCB-21').feature, 'pcb.Q1');
  assert.ok(!ids(r).includes('PCB-12') && !ids(r).includes('PCB-02'));
  const coated = check({ ...spec, pcb: { ...spec.pcb, coating: 'conformal', zones: [{ net: 'HV+', rect: [20, 40, 25, 15] }, { net: 'HV-', rect: [46, 40, 25, 15] }] } }, false);
  assert.ok(!ids(coated).includes('PCB-11'), '1 mm is enough at 400 V with a conformal coating (A5 = 0.8 mm)');
});

test('bolt pattern too close to the edge', () => {
  const f = find(R.edge, 'IF-01');
  assert.deepEqual([f.severity, f.value, f.limit, f.iface], ['warn', 3, 6, 'IF1']);
  assert.deepEqual(f.fix.patch, [{ target: 'interface', id: 'IF1', path: 'params.pattern.dx', value: 48 }, { target: 'interface', id: 'IF1', path: 'params.pattern.dy', value: 28 }]);
  assert.deepEqual(ids(R.edge, 'error'), []);
});

test('clean part: no error, no warning', () => {
  assert.deepEqual(ids(R.clean, 'error'), []);
  assert.deepEqual(ids(R.clean, 'warn'), []);
  assert.equal(R.clean.summary.status, 'pass');
  assert.ok(R.clean.summary.score >= 95);
});

test('printed housing: walls, bosses, inserts, assembly gap', () => {
  const r = R.house;
  for (const id of ['HSG-01', 'HSG-07', 'HSG-12', 'HSG-13', 'HSG-14', 'IF-02', 'IF-03', 'IF-06']) assert.ok(ids(r).includes(id), id);
  assert.deepEqual(find(r, 'IF-02').fix.patch, [{ target: 'interface', id: 'IF1', path: 'opts.thread', value: 'insert' }]);
  assert.equal(find(r, 'HSG-02').severity, 'info');
  assert.ok(!ids(r).includes('HSG-05') && !ids(r).includes('IF-07'));
});

// ---- 3. auto-fixes ------------------------------------------------------------------------------------------------------------
test('every auto-fix makes its finding disappear after a rebuild', () => {
  let n = 0;
  const seen = new Set();
  for (const [k, r] of Object.entries(R)) {
    for (const f of r.findings.filter((x) => x.fix)) {
      assert.ok(f.fix.label.length > 3 && f.fix.patch.every((op) => ['param', 'feature', 'interface', 'spec'].includes(op.target)), `${k} ${f.id}`);
      const fixed = applyPatch(SPECS[k], f.fix.patch), again = check(fixed);
      assert.deepEqual(again.built.log.filter((l) => l.level === 'error'), [], `${k} ${f.id}: the fixed part builds`);
      assert.ok(!again.findings.some(sameFinding(f)), `${k} ${f.id}: still there after « ${f.fix.label} »`);
      assert.ok(again.summary.score >= r.summary.score, `${k} ${f.id}: the score does not get worse`);
      seen.add(f.id); n++;
    }
  }
  for (const id of ['CNC-01', 'CNC-04', 'EXT-04', 'MLD-01', 'PCB-05', 'PCB-06', 'IF-01', 'HSG-01', 'HSG-07', 'HSG-12', 'HSG-13', 'HSG-14', 'IF-02', 'IF-03', 'IF-06']) assert.ok(seen.has(id), `fix of ${id} exercised`);
  assert.ok(n >= 15);
});

test('fixes go to the parameter behind an expression', () => {
  const mill = applyPatch(SPECS.mill, find(R.mill, 'CNC-01').fix.patch);
  assert.equal(mill.params.r_corner, 2);
  assert.equal(mill.features[1].r, 'r_corner');
  const box = applyPatch(SPECS.box, find(R.box, 'MLD-01').fix.patch);
  assert.equal(box.params.wall, 1.2);
  const all = check(applyPatch(applyPatch(SPECS.mill, find(R.mill, 'CNC-01').fix.patch), find(R.mill, 'CNC-04').fix.patch));
  assert.deepEqual([all.summary.errors, all.summary.warnings, all.summary.status], [0, 0, 'pass']);
});

// ---- 4. rule book, robustness, order ---------------------------------------------------------------------------------------------
test('RULEBOOK: every process, complete entries, every finding documented', () => {
  const procs = RULEBOOK.map((b) => b.process);
  for (const p of ['cnc_milling', 'cnc_turning', 'sheet_metal', 'laser_cut', 'extrusion_al', 'extrusion_plastic', 'injection_molding', 'fdm', 'mjf', 'pcb', 'purchased', 'interfaces', 'general', 'assembly']) assert.ok(procs.includes(p), p);
  const known = new Set();
  for (const b of RULEBOOK) {
    assert.ok(b.title && b.fr && b.steps.length >= 3 && b.rules.length >= 3, b.process);
    for (const r of b.rules) {
      assert.match(r.id, /^[A-Z]+-\d\d$/);
      assert.ok(r.title && r.limit && r.why !== undefined && r.source !== undefined && ['error', 'warn', 'info'].includes(r.severity), r.id);
      known.add(r.id);
    }
  }
  for (const id of ['SM-01', 'SM-07', 'MAT-01', 'LAM-02', 'PL-01', 'PCB-01', 'PCB-05', 'MLD-01', 'HSG-01', 'HSG-13', 'ASM-01', 'KRN-01', 'KRN-02']) assert.ok(known.has(id), id);
  for (const [k, r] of Object.entries(R)) {
    for (const f of r.findings) {
      assert.ok(known.has(f.id), `${k} ${f.id} is in the rule book`);
      assert.ok(f.title && f.source !== undefined && ['DFM', 'DFA', 'DFx'].includes(f.category), f.id);
      assert.match(f.message, /Correctif/i, `${f.id}: the message gives a fix`);
      if (f.fix) assert.equal(RULEBOOK.flatMap((b) => b.rules).find((x) => x.id === f.id).fix, true, `${f.id} is flagged as auto-fixable in the rule book`);
    }
    for (const id of r.rules) assert.ok(known.has(id), `${k}: rule ${id} that ran is in the rule book`);
  }
});

test('other processes run their own rules', () => {
  const tray = check({ id: 'T-TRAY', material: 'AL5052-H32', process: 'sheet_metal', features: [{ op: 'box', size: [100, 60, 6] }, { op: 'shell', t: 1.3, open: ['+Z'] }, { op: 'hole', face: '-Z', at: [[4, 30], [50, 30], [53.5, 30]], d: 1, depth: 2 }] }, false);
  for (const id of ['MAT-01', 'SM-01', 'SM-03', 'SM-05', 'SM-06', 'SM-07']) assert.ok(ids(tray).includes(id), id);
  assert.deepEqual(find(tray, 'MAT-01').fix.patch, [{ target: 'feature', id: 'f2', path: 't', value: 1.2 }]);
  const plate = check({ id: 'T-PLATE', material: 'AL5052-H32', process: 'laser_cut', features: [{ op: 'box', size: [100, 60, 2.2] }, { op: 'pocket', face: '+Z', rect: [60, 20, 10, 10], r: 2, depth: 1 }, { op: 'hole', face: '+Z', at: [3, 30], d: 4 }] }, false);
  for (const id of ['MAT-01', 'LC-01', 'SM-04']) assert.ok(ids(plate).includes(id), id);
  assert.deepEqual(find(plate, 'MAT-01').fix.patch, [{ target: 'feature', id: 'f1', path: 'size.2', value: 2 }]);
  const turned = check({ id: 'T-TURN', material: 'BRASS-360', process: 'cnc_turning', features: [{ op: 'cylinder', d: 10, h: 60 }, { op: 'hole', face: '+Z', at: [0, 0], d: 3.3, depth: 40, thread: 'M4' }] }, false);
  for (const id of ['TRN-01', 'TRN-04', 'CNC-03', 'CNC-05']) assert.ok(ids(turned).includes(id), id);
  assert.equal(find(turned, 'CNC-03').severity, 'error');
  const wrong = check({ id: 'T-WRONG', material: 'AL6061-T6', process: 'extrusion_al', params: { L: { value: 500, min: 10, max: 100 } }, features: [{ op: 'box', size: ['L', 10, 10] }, { op: 'pocket', face: '+Z' }] }, false);
  for (const id of ['EXT-00', 'GEN-03', 'GEN-06', 'KRN-01']) assert.ok(ids(wrong).includes(id), id);
  assert.ok(ids(check({ id: 'T-NOPCB', material: 'FR4', process: 'pcb', features: [{ op: 'box', size: [50, 40, 1.6] }] }, false)).includes('PCB-00'));
  const tube = (clearance) => check({ id: 'T-TUBE', material: 'AL6063-T5', process: 'extrusion_al', elec: { kind: 'chassis' },
    extrusion: { length: 200, profile: { outer: { rect: [0, 0, 60, 30], r: 2 }, holes: [{ rect: [2, 2, 56, 26], r: 1 }] }, inside: [{ name: 'Carte', w: 54, h: 1.6, at: [30, 15], clearance }] } }, false);
  assert.ok(!ids(tube(0.5)).includes('EXT-09') && ids(tube(0.5)).includes('EXT-05'), 'a 55 mm envelope fits in a 56 mm hollow');
  assert.deepEqual([find(tube(1.5), 'EXT-09').severity, find(tube(1.5), 'EXT-09').value], ['error', 'Carte'], 'a 57 mm envelope does not');
  const vee = check({ id: 'T-VEE', material: 'AL6063-T5', process: 'extrusion_al', elec: { kind: 'chassis' }, extrusion: { length: 100, profile: { poly: [[0, 0], [40, 0], [40, 20], [24, 20], [20, 8], [16, 20], [0, 20]], r: 0.5 } } }, false);
  assert.ok(!ids(vee).includes('EXT-03') && !ids(vee).includes('EXT-01') && !ids(vee).includes('EXT-04'), 'a V groove 8 mm wide and 12 mm deep is not a deep gap, its pointed bottom is not a thin wall');
  assert.deepEqual(ids(vee, 'error'), []);
  assert.deepEqual(find(wrong, 'GEN-03').fix.patch, [{ target: 'spec', id: null, path: 'material', value: 'AL6063-T5' }]);
  assert.equal(find(wrong, 'KRN-01').severity, 'error');
});

test('partial or missing facts never crash', () => {
  const cases = [[undefined, undefined], [{}, {}], [{ process: 'cnc_milling' }, { facts: {} }], [{ process: 'pcb', material: 'FR4' }, { facts: { pcb: { t: 1.6, bbox: [0, 0, 10, 10] } }, bodies: [] }, { mesh: { pos: [], idx: [] } }],
    [{ process: 'extrusion_al' }, { facts: { extrusion: { metrics: {} } } }], [{ process: 'sheet_metal' }, { bbox: [0, 0, 0, 1, 1, 1], facts: { holes: [{ d: 2 }] } }],
    [{ process: 'injection_molding', interfaces: [{}] }, { interfaces: [{ type: 'bolt_pattern' }, null], facts: { holes: [{}, null], shells: [{}], bosses: [{}], pockets: [{}], fillets: [{}] }, log: [{}, null] }]];
  for (const [spec, built, geo] of cases) {
    const r = checkPart(spec, built, geo);
    assert.deepEqual(r.skipped, [], JSON.stringify(spec));
    assert.ok(Array.isArray(r.findings) && r.summary && Array.isArray(r.rules));
    assert.deepEqual(ids(r, 'error'), [], 'no error without facts');
  }
  assert.deepEqual(ids(checkPart({}, {})), ['GEN-01', 'GEN-02']);
});

test('deterministic order: errors, then warnings, then infos', () => {
  for (const [k, spec] of Object.entries(SPECS)) {
    const rank = R[k].findings.map((f) => ({ error: 0, warn: 1, info: 2 })[f.severity]);
    assert.deepEqual(rank, rank.slice().sort((a, b) => a - b), k);
    const again = check(spec);
    assert.deepEqual(again.findings.map((f) => [f.id, f.feature, f.message]), R[k].findings.map((f) => [f.id, f.feature, f.message]), k);
  }
});

// ---- 5. DFA ---------------------------------------------------------------------------------------------------------------------
const pattern = (dx) => ({ screw: 'M3', pattern: { type: 'rect', nx: 2, ny: 2, dx, dy: 40 } });
const BASE = { id: 'T-BASE', name: 'Socle', material: 'AL6061-T6', process: 'cnc_milling', elec: { kind: 'chassis' }, features: [{ op: 'box', size: [100, 60, 10] }],
  interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'lid', partner: 'Capot', side: 'B', face: '+Z', at: [50, 30], params: pattern(80) }] };
const LID = { id: 'T-LID', name: 'Capot', material: 'PC', process: 'cnc_milling', features: [{ op: 'box', size: [100, 60, 4] }],
  interfaces: [{ id: 'IF1', type: 'bolt_pattern', key: 'lid', partner: 'Socle', side: 'A', face: '-Z', at: [50, 30], params: pattern(80) }] };
const ASM = { id: 'T-ASM', name: 'Socle + capot', instances: [{ id: 'base', part: 'T-BASE', fixed: true }, { id: 'lid', part: 'T-LID' }],
  mates: [{ id: 'm1', a: { inst: 'base', iface: 'IF1' }, b: { inst: 'lid', iface: 'IF1' }, linked: true }] };
const UP10 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 10, 1];
const partsOf = (...specs) => Object.fromEntries(specs.map((s) => [s.id, { spec: s, built: buildPart(K, s) }]));

test('DFA: two parts, one mate', () => {
  const r = checkAssembly(ASM, { parts: partsOf(BASE, LID), placements: { lid: UP10 }, interference: [] });
  assert.deepEqual(r.skipped, []);
  assert.deepEqual([r.summary.errors, r.summary.warnings, r.summary.status], [0, 0, 'pass']);
  assert.deepEqual(ids(r), ['DFA-05']);
  const m = r.metrics;
  assert.deepEqual([m.parts, m.instances, m.uniqueParts, m.fasteners, m.fastenerTypes, m.directions, m.topDown, m.theoreticalMin, m.mates], [6, 2, 2, 4, 1, 1, 1, 2, 1]);
  assert.ok(Math.abs(m.mass_g - (60 * 2.7 + 24 * 1.2)) < 2, 'mass of the two parts, screw holes removed');
  assert.ok(Math.abs(m.cog[0] - 50) < 0.01 && Math.abs(m.cog[1] - 30) < 0.01 && m.cog[2] > 5 && m.cog[2] < 12, 'centre of gravity in world coordinates');
  assert.equal(m.dfaIndex, Math.round(100 * 3 * 2 / (2 * 6 + 4 * 8)));
  for (const id of ['ASM-01', 'DFA-01', 'DFA-03', 'DFA-07', 'DFA-10']) assert.ok(r.rules.includes(id), id);
  K.flush();
});

test('DFA: broken interface link, fixed by copying the params of A onto B', () => {
  const lid = { ...LID, material: 'AL6061-T6', interfaces: [{ ...LID.interfaces[0], params: pattern(70) }] };
  const r = checkAssembly(ASM, { parts: partsOf(BASE, lid), placements: { lid: UP10 }, interference: [{ a: 'base', b: 'lid', volume: 12.5 }] });
  const f = find(r, 'DFA-03');
  assert.equal(f.severity, 'error');
  assert.equal(f.category, 'DFA');
  assert.match(f.message, /Liaison « m1 » rompue.*Correctif/);
  assert.deepEqual(f.fix.patch, [{ target: 'interface', part: 'T-LID', id: 'IF1', path: 'params', value: pattern(80) }]);
  assert.equal(find(r, 'ASM-01').severity, 'error');
  assert.ok(ids(r).includes('DFA-06'), 'same material, rigidly fastened: candidates for merging');
  assert.equal(r.metrics.theoreticalMin, 1);
  const fixed = applyPatch(lid, f.fix.patch);
  assert.deepEqual(applyPatch(BASE, f.fix.patch), BASE, 'the patch only touches the part it names');
  const again = checkAssembly(ASM, { parts: partsOf(BASE, fixed), placements: { lid: UP10 } });
  assert.ok(!ids(again).includes('DFA-03') && !again.rules.includes('nope'));
  assert.deepEqual(ids(again, 'error'), []);
  K.flush();
});

test('DFA: floating instance, unmated interface, bottom-up mate, bad input', () => {
  const asm = { ...ASM, instances: [...ASM.instances, { id: 'lid2', part: 'T-LID' }] };
  const flipped = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 60, 0, 1];       // lid turned upside down under the base: the screws go up
  const r = checkAssembly(asm, { parts: partsOf(BASE, LID), placements: { lid: flipped } });
  assert.equal(find(r, 'DFA-01').feature, 'lid2');
  assert.equal(find(r, 'DFA-02').feature, 'lid2');
  assert.equal(find(r, 'DFA-08').value, 0);
  assert.equal(r.metrics.topDown, 0);
  assert.deepEqual(checkAssembly(null).summary, { errors: 0, warnings: 0, infos: 0, score: 100, status: 'pass' });
  const bad = checkAssembly({ instances: [{ id: 'x', part: 'nope' }], mates: [{ id: 'm' }, { id: 'n', a: { inst: 'x', iface: 'q' }, b: {} }] }, {});
  assert.deepEqual(bad.skipped, []);
  assert.deepEqual(ids(bad, 'error'), ['DFA-11', 'DFA-11']);
  K.flush();
});

test('DFA: fastener variety, assembly directions, heavy part, poka-yoke', () => {
  const bp = (id, key, side, face, at, screw, pattern) => ({ id, type: 'bolt_pattern', key, partner: 'x', side, face, at, params: { screw, pattern } });
  const sq = { type: 'rect', nx: 2, ny: 2, dx: 100, dy: 100 }, tri = { type: 'circle', n: 3, pcd: 60 };
  const plate = (id, size, at, key, screw, pattern) => ({ id, name: id, material: 'AL6061-T6', process: 'cnc_milling', features: [{ op: 'box', size }], interfaces: [bp('IF1', key, 'A', '-Z', at, screw, pattern)] });
  const specs = [{ id: 'FRAME', name: 'Châssis', material: 'STEEL-1018', process: 'cnc_milling', features: [{ op: 'box', size: [300, 300, 300] }, { op: 'shell', t: 20, open: ['+Z'] }],
    interfaces: [bp('TOP', 'top', 'B', '+Z', [150, 150], 'M6', { ...sq, dx: 270, dy: 270 }), bp('LEFT', 'left', 'B', '-X', [150, 150], 'M5', sq), bp('RIGHT', 'right', 'B', '+X', [150, 150], 'M4', sq),
      bp('FRONT', 'front', 'B', '-Y', [150, 150], 'M3', sq), bp('BACK', 'back', 'B', '+Y', [150, 150], 'M2.5', tri)] },
  { ...plate('COVER', [300, 300, 30], [150, 150], 'top', 'M6', { ...sq, dx: 270, dy: 270 }), material: 'STEEL-1018' }, plate('SIDE5', [140, 160, 6], [60, 80], 'left', 'M5', sq),
  plate('SIDE4', [140, 140, 6], [70, 70], 'right', 'M4', sq), plate('SIDE3', [140, 140, 6], [70, 70], 'front', 'M3', sq), plate('SIDE25', [80, 80, 3], [40, 40], 'back', 'M2.5', tri)];
  const rotY = (s, t) => [0, 0, -s, 0, 0, 1, 0, 0, s, 0, 0, 0, ...t, 1], rotX = (s, t) => [1, 0, 0, 0, 0, 0, s, 0, 0, -s, 0, 0, ...t, 1];      // ± 90° about Y / X
  const placements = { cover: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 300, 1], s5: rotY(1, [0, 0, 0]), s4: rotY(-1, [300, 0, 0]), s3: rotX(-1, [0, 0, 0]), s25: rotX(1, [0, 300, 0]) };
  const asm = { id: 'BOX', instances: [{ id: 'frame', part: 'FRAME', fixed: true }, { id: 'cover', part: 'COVER' }, { id: 's5', part: 'SIDE5' }, { id: 's4', part: 'SIDE4' }, { id: 's3', part: 'SIDE3' }, { id: 's25', part: 'SIDE25' }],
    mates: [['m1', 'TOP', 'cover'], ['m2', 'LEFT', 's5'], ['m3', 'RIGHT', 's4'], ['m4', 'FRONT', 's3'], ['m5', 'BACK', 's25']].map(([id, f, i]) => ({ id, a: { inst: 'frame', iface: f }, b: { inst: i, iface: 'IF1' } })) };
  const r = checkAssembly(asm, { parts: partsOf(...specs), placements });
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(ids(r), ['DFA-04', 'DFA-07', 'DFA-09', 'DFA-05', 'DFA-06', 'DFA-08', 'DFA-10']);
  assert.deepEqual([r.metrics.fasteners, r.metrics.fastenerTypes, r.metrics.screwSizes, r.metrics.directions, r.metrics.topDown, r.metrics.theoreticalMin], [19, 5, 5, 5, 0.2, 5]);
  assert.equal(find(r, 'DFA-07').severity, 'warn');
  assert.equal(find(r, 'DFA-09').feature, 'cover');
  assert.equal(find(r, 'DFA-10').feature, 's5', 'only the plate whose pattern is off-centre can be mounted the wrong way round');
  const fix = find(r, 'DFA-04').fix;
  assert.equal(fix.label, 'Passer les motifs M2.5 en M3');
  assert.deepEqual(fix.patch.map((op) => [op.part, op.id, op.path, op.value]), [['FRAME', 'BACK', 'params.screw', 'M3'], ['SIDE25', 'IF1', 'params.screw', 'M3']]);
  const again = checkAssembly(asm, { parts: partsOf(...specs.map((s) => applyPatch(s, fix.patch))), placements });
  assert.equal(again.metrics.screwSizes, 4, 'one screw size less after the fix');
  assert.ok(!ids(again).includes('DFA-03'), 'both sides of the mate were patched together');
  K.flush();
});
