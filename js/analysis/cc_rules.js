// Creepage & clearance rules engine (IEC 60664-1): required distances of a net pair, from a rule set.
//
// Pure functions, no imports, no I/O: the module runs unchanged in the browser and in Node. A rule set is the JSON
// of BUILTIN (or an edited copy of it); its keys, and the keys of the results, stay in snake_case so that rule sets
// and results can be stored and exchanged as plain JSON. Every result carries the steps of its computation
// (`steps`), table by table, so a reviewer can follow it. The texts shown to the user are in French.
//
// STATUS « to verify »: the values were typed from the published tables (IEC 60664-1, annex F and the altitude
// table of annex A; numbering of the 2007 edition, unchanged in edition 3, 2020, as far as public excerpts show).
// Check them against a licensed copy of the standard before relying on them.
// Units: volts (r.m.s. or d.c.), kilovolts for impulse voltages, millimetres for distances, metres for altitude.

export const STANDARD = 'IEC 60664-1';
export const GROUPS = ['I', 'II', 'IIIa', 'IIIb'];
export const LEVELS = ['functional', 'basic', 'reinforced'];
export const OVC = ['I', 'II', 'III', 'IV'];
export const FIELDS = ['A', 'B'];
export const LEVEL_LABEL = { functional: 'Functional', basic: 'Basic', reinforced: 'Reinforced' };
export const DEFAULT_PARAMS = {
  pollution_degree: 2, altitude_m: 2000, ovc: 'II', impulse_kv: null, field: 'A', level: 'basic',
  voltage_factor: 1.0, floating_v: null,
};
export const FT_PER_M = 3.28084;

// Creepage distances to avoid failure due to tracking (Table F.4, 2007 numbering).
// Columns: working voltage (V r.m.s. or d.c.), printed wiring PD1 (all groups), printed wiring PD2 (all groups
// except IIIb), PD1 (all groups), PD2 group I, II, III, PD3 group I, II, III. null = no value in the table.
const CREEPAGE_COLUMNS = ['u_v', 'pw_pd1', 'pw_pd2', 'pd1', 'pd2_i', 'pd2_ii', 'pd2_iii', 'pd3_i', 'pd3_ii', 'pd3_iii'];
const CREEPAGE = [
  [10, 0.025, 0.04, 0.08, 0.4, 0.4, 0.4, 1.0, 1.0, 1.0],
  [12.5, 0.025, 0.04, 0.09, 0.42, 0.42, 0.42, 1.05, 1.05, 1.05],
  [16, 0.025, 0.04, 0.1, 0.45, 0.45, 0.45, 1.1, 1.1, 1.1],
  [20, 0.025, 0.04, 0.11, 0.48, 0.48, 0.48, 1.2, 1.2, 1.2],
  [25, 0.025, 0.04, 0.125, 0.5, 0.5, 0.5, 1.25, 1.25, 1.25],
  [32, 0.025, 0.04, 0.14, 0.53, 0.53, 0.53, 1.3, 1.3, 1.3],
  [40, 0.025, 0.04, 0.16, 0.56, 0.8, 1.1, 1.4, 1.6, 1.8],
  [50, 0.025, 0.04, 0.18, 0.6, 0.85, 1.2, 1.5, 1.7, 1.9],
  [63, 0.04, 0.063, 0.2, 0.63, 0.9, 1.25, 1.6, 1.8, 2.0],
  [80, 0.063, 0.1, 0.22, 0.67, 0.95, 1.3, 1.7, 1.9, 2.1],
  [100, 0.1, 0.16, 0.25, 0.71, 1.0, 1.4, 1.8, 2.0, 2.2],
  [125, 0.16, 0.25, 0.28, 0.75, 1.05, 1.5, 1.9, 2.1, 2.4],
  [160, 0.25, 0.4, 0.32, 0.8, 1.1, 1.6, 2.0, 2.2, 2.5],
  [200, 0.4, 0.63, 0.42, 1.0, 1.4, 2.0, 2.5, 2.8, 3.2],
  [250, 0.56, 1.0, 0.56, 1.25, 1.8, 2.5, 3.2, 3.6, 4.0],
  [320, 0.75, 1.6, 0.75, 1.6, 2.2, 3.2, 4.0, 4.5, 5.0],
  [400, 1.0, 2.0, 1.0, 2.0, 2.8, 4.0, 5.0, 5.6, 6.3],
  [500, 1.3, 2.5, 1.3, 2.5, 3.6, 5.0, 6.3, 7.1, 8.0],
  [630, 1.8, 3.2, 1.8, 3.2, 4.5, 6.3, 8.0, 9.0, 10.0],
  [800, 2.4, 4.0, 2.4, 4.0, 5.6, 8.0, 10.0, 11.0, 12.5],
  [1000, 3.2, 5.0, 3.2, 5.0, 7.1, 10.0, 12.5, 14.0, 16.0],
  [1250, null, null, 4.2, 6.3, 9.0, 12.5, 16.0, 18.0, 20.0],
  [1600, null, null, 5.6, 8.0, 11.0, 16.0, 20.0, 22.0, 25.0],
  [2000, null, null, 7.5, 10.0, 14.0, 20.0, 25.0, 28.0, 32.0],
  [2500, null, null, 10.0, 12.5, 18.0, 25.0, 32.0, 36.0, 40.0],
  [3200, null, null, 12.5, 16.0, 22.0, 32.0, 40.0, 45.0, 50.0],
  [4000, null, null, 16.0, 20.0, 28.0, 40.0, 50.0, 56.0, 63.0],
  [5000, null, null, 20.0, 25.0, 36.0, 50.0, 63.0, 71.0, 80.0],
  [6300, null, null, 25.0, 32.0, 45.0, 63.0, 80.0, 90.0, 100.0],
  [8000, null, null, 32.0, 40.0, 56.0, 80.0, 100.0, 110.0, 125.0],
  [10000, null, null, 40.0, 50.0, 71.0, 100.0, 125.0, 140.0, 160.0],
];

// Clearances to withstand transient overvoltages (Table F.2): required impulse withstand voltage (kV) -> minimum
// clearance in air up to 2 000 m (mm), case A (inhomogeneous field) and case B (homogeneous field), values of
// pollution degree 1; PD2 and PD3 raise them to their minimum (PD_MIN).
const CLEARANCE = [
  [0.33, 0.01, 0.01], [0.4, 0.02, 0.02], [0.5, 0.04, 0.04], [0.6, 0.06, 0.06], [0.8, 0.1, 0.1],
  [1.0, 0.15, 0.15], [1.2, 0.25, 0.2], [1.5, 0.5, 0.3], [2.0, 1.0, 0.45], [2.5, 1.5, 0.6], [3.0, 2.0, 0.8],
  [4.0, 3.0, 1.2], [5.0, 4.0, 1.5], [6.0, 5.5, 2.0], [8.0, 8.0, 3.0], [10.0, 11.0, 3.5], [12.0, 14.0, 4.5],
  [15.0, 18.0, 5.5], [20.0, 25.0, 8.0], [25.0, 33.0, 10.0], [30.0, 40.0, 12.5], [40.0, 60.0, 17.0],
  [50.0, 75.0, 22.0], [60.0, 90.0, 27.0], [80.0, 130.0, 35.0], [100.0, 170.0, 45.0],
];
const PD_MIN = { 1: 0.0, 2: 0.2, 3: 0.8 };

// Rated impulse voltage (Table F.1): voltage line to neutral derived from the nominal a.c. or d.c. voltage, up to
// and including (V) -> rated impulse voltage (V) for overvoltage categories I, II, III, IV.
const IMPULSE = [
  [50, 330, 500, 800, 1500], [100, 500, 800, 1500, 2500], [150, 800, 1500, 2500, 4000],
  [300, 1500, 2500, 4000, 6000], [600, 2500, 4000, 6000, 8000], [1000, 4000, 6000, 8000, 12000],
];
// Preferred series of impulse voltages: reinforced insulation takes the next step (or 160 % off the series).
const IMPULSE_SERIES = [330, 500, 800, 1500, 2500, 4000, 6000, 8000, 12000];

// Altitude correction factors for clearances (Table A.2): altitude (m) -> factor (1.00 up to 2 000 m).
const ALTITUDE = [[2000, 1.0], [3000, 1.14], [4000, 1.29], [5000, 1.48], [6000, 1.70], [7000, 1.95], [8000, 2.25],
  [9000, 2.62], [10000, 3.02], [15000, 6.67], [20000, 14.5]];

// Post-assembly validation: not part of the distance tables of IEC 60664-1, but what the product will be tested at.
// Dielectric withstand (« hipot ») 2 x U + 1000 V r.m.s. for 60 s on basic insulation (the usual rule of product
// standards, e.g. ISO 6469-3 for road-vehicle traction systems), x 2 for reinforced; production test x 1.2 for 1 to
// 2 s; DC equivalent = peak of the AC test voltage. The clearance must hold the peak of the test voltage at the test
// site (sea level) without flashover. Insulation resistance: in-service minimum in ohm per volt (ISO 6469-3 / UN ECE
// R100: 100 ohm/V DC, 500 ohm/V AC). Partial discharge test (IEC 60664-1 6.1.3.5, factors to be verified on a
// licensed copy): extinction voltage >= F1 x U peak (x F3 for reinforced), initial voltage F1 x F2 x U peak,
// charge <= 10 pC (IEC 60270), at the pressure of the maximum altitude.
const VALIDATION = {
  hipot: { a: 2.0, b: 1000.0, duration_s: 60, production_factor: 1.2, production_s: 2, reinforced_factor: 2.0 },
  clearance_covers_hipot: true,
  ir: { ohm_per_volt_dc: 100.0, ohm_per_volt_ac: 500.0 },
  pd: { f1: 1.2, f2: 1.25, f3_reinforced: 1.25, max_pc: 10.0 },
};

export const BUILTIN = {
  standard: STANDARD,
  creepage: { columns: CREEPAGE_COLUMNS, rows: CREEPAGE, interpolate: true },
  clearance: { columns: ['kv', 'case_a', 'case_b'], rows: CLEARANCE, interpolate: false, pd_min: PD_MIN },
  impulse: { columns: ['u_v', 'ovc_i', 'ovc_ii', 'ovc_iii', 'ovc_iv'], rows: IMPULSE, series: IMPULSE_SERIES },
  altitude: { columns: ['m', 'factor'], rows: ALTITUDE },
  // Minimum width X of a groove (mm) per pollution degree: a narrower groove is bridged (measured straight across).
  // When the associated clearance is below 3 mm, X may be reduced to one third of that clearance.
  groove_x: { 1: 0.25, 2: 1.0, 3: 1.5 },
  groove_x_reduce: true,
  reinforced: { creepage_factor: 2.0, impulse_step: true, impulse_factor: 1.6 },
  functional_factor: 1.0,
  margin_pct: { creepage: 0.0, clearance: 0.0 },
  validation: VALIDATION,
};
export const BUILTIN_NAME = 'IEC 60664-1 (intégrée)';

// ---- Material library: CTI -> material group, conductive flag; insulating sheets, films and coatings ------------
// An insulating part takes the group of its material; a creepage path takes the worst group it touches. The values
// are TYPICAL values of each family: the datasheet of the grade actually used prevails.
const TYPICAL = 'Valeur typique de la famille : vérifier la fiche matière du grade utilisé.';
const SEED = [ // name, conductive, CTI, printed wiring, note (insulators: TYPICAL unless another is given)
  ['Copper (Cu-ETP)', true], ['Copper, tin or nickel plated', true], ['Aluminium 6061', true],
  ['Steel / stainless steel', true], ['Brass', true],
  ['PA66-GF30', false, 400], ['PA6', false, 600], ['PBT-GF30', false, 250], ['PC', false, 250], ['PC/ABS', false, 250],
  ['PPS-GF40', false, 175], ['PEEK', false, 150], ['PEI (Ultem)', false, 150], ['PTFE', false, 600],
  ['PP', false, 600, false, `${TYPICAL} (joints de cellule, isolants de faisceau)`],
  ['Silicone rubber', false, 600], ['Epoxy potting', false, 200], ['Polyimide film (PI)', false, 150],
  ['Ceramic (Al2O3)', false, 600], ['Mica', false, 600],
  ['FR4 PCB (standard)', false, 175, true], ['FR4 PCB (high CTI 600)', false, 600, true],
  ['Unknown insulator (worst case)', false, 100, false,
    'Groupe IIIb : le cas le plus défavorable, en attendant la matière réelle.'],
];
const NOMEX = 'Arclin (ex-DuPont) Nomex® 410 Technical Data Sheet : rigidité AC rapid rise (ASTM D149) selon '
  + "l'épaisseur, UL 746A CTI = PLC 3 (175 à 249 V, on garde 175), RTI UL 220 °C.";
const KAPTON = "DuPont Kapton® HN data sheet : rigidité 60 Hz selon l'épaisseur ; CTI non publié (pris au pire, "
  + '100 V).';
const ARAMID = "Papier aramide calandré : barrières, fonds d'encoche, cales.";
const POLYIMIDE = 'Film polyimide : ruban, enrubannage de busbar.';
const SHEETS = [ // name, form, CTI, thickness mm, dielectric strength kV/mm, thermal class °C, source, note
  ['Nomex 410 — 0.13 mm', 'sheet', 175, 0.13, 28, 220, NOMEX, ARAMID],
  ['Nomex 410 — 0.25 mm', 'sheet', 175, 0.25, 33, 220, NOMEX, ARAMID],
  ['Nomex 410 — 0.38 mm', 'sheet', 175, 0.38, 32, 220, NOMEX, ARAMID],
  ['Nomex 410 — 0.51 mm', 'sheet', 175, 0.51, 27, 220, NOMEX, ARAMID],
  ['Kapton HN — 0.025 mm (1 mil)', 'film', 100, 0.025, 303, null, KAPTON, POLYIMIDE],
  ['Kapton HN — 0.05 mm (2 mil)', 'film', 100, 0.05, 240, null, KAPTON, POLYIMIDE],
  ['Epoxy powder coating (busbar)', 'coating', 175, 0.3, null, null, '',
    'Revêtement poudre époxy : CTI et rigidité à saisir de la fiche du fournisseur.'],
  ['Conformal coating (IEC 60664-3)', 'coating', 175, 0.05, null, null, '',
    'IEC 60664-3 : type 1 → PD1 sous le revêtement ; type 2 → isolation solide. Valeurs de la fiche à saisir.'],
];
export const MATERIALS = [
  ...SEED.map(([name, conductive, cti = null, printedWiring = false, note = conductive ? '' : TYPICAL]) => ({
    name, conductive, cti, group: materialGroup(cti), printedWiring, form: 'part', thicknessMm: null,
    dielectricKvMm: null, thermalClassC: null, source: '', note,
  })),
  ...SHEETS.map(([name, form, cti, thicknessMm, dielectricKvMm, thermalClassC, source, note]) => ({
    name, conductive: false, cti, group: materialGroup(cti), printedWiring: false, form, thicknessMm, dielectricKvMm,
    thermalClassC, source, note,
  })),
];

// ---- Numbers: the rounding and the formatting of the Python reference engine --------------------------------------
// Python "{:.{digits}f}".format(value): correctly rounded like toFixed(), except that an exact tie goes to the even
// digit where toFixed() sends it away from zero (0.125 -> "0.12"; 12.25 -> "12.2" with one digit).
function fixed(value, digits) {
  const v = Number(value);
  const halves = Math.abs(v) * 2 ** (digits + 1); // exact: a tie is an odd multiple of 2^-(digits + 1)
  if (!Number.isInteger(halves) || halves % 2 === 0) return v.toFixed(digits);
  const below = Math.floor(Math.abs(v) * 10 ** digits);
  return (v < 0 ? '-' : '') + ((below + (below % 2)) / 10 ** digits).toFixed(digits);
}

// Python round(value, digits): correctly rounded, an exact tie to the even digit -- also for the integer volt and
// ohm values. Math.round would send a tie up and change real results: 412 V reinforced has a partial discharge
// initial voltage of 772.5 V, 772 V in the reference engine (773 V with Math.round).
const round = (value, digits = 0) => Number(fixed(value, digits)) + 0; // + 0: no negative zero

/** Round a distance UP to 0.01 mm (never round a requirement down). */
export function up(value) {
  return Math.ceil(value * 100 - 1e-9) / 100 + 0; // + 0: a zero distance is 0, not -0
}

/** 5,5 for 5.50: fixed decimals, trailing zeros of the fraction removed, decimal comma. */
export function fmt(value, digits = 2) {
  const text = fixed(value, digits);
  return (text.includes('.') ? text.replace(/\.?0+$/, '') : text).replace('.', ',');
}

/** −400 with a true minus sign; in parentheses after an operator. */
export function signed(value, wrap = false) {
  const text = fmt(Math.abs(value));
  if (value < 0) return wrap ? `(−${text})` : `−${text}`;
  return text;
}

/** 12 000 for 12000: rounded to the integer, thousands separated by a narrow no-break space (U+202F). */
export function grouped(value) {
  return fixed(value, 0).replace(/^-0$/, '0').replace(/\B(?=(\d{3})+$)/g, ' ');
}

/** 3 000 m (9 843 ft): the standards give metres, the aircraft industry speaks feet. */
export function altLabel(metres) {
  return `${grouped(metres)} m (${grouped(Number(metres) * FT_PER_M)} ft)`;
}

// ---- Nets and working voltage -------------------------------------------------------------------------------------
/** IEC 60664-1 material group from the comparative tracking index (V): 'I' | 'II' | 'IIIa' | 'IIIb' | null. */
export function materialGroup(cti) {
  if (cti === null || cti === undefined || String(cti).trim() === '') return null;
  const value = Number(cti);
  if (Number.isNaN(value)) return null;
  if (value >= 600) return 'I';
  if (value >= 400) return 'II';
  return value >= 175 ? 'IIIa' : 'IIIb';
}

/** Peak voltage of a net {kind: 'dc' | 'ac', voltage, peak?}: |V| in DC; the given peak, else V rms x √2, in AC. */
export function netPeak(net) {
  if (net.kind === 'dc') return Math.abs(Number(net.voltage));
  return net.peak ? Number(net.peak) : Number(net.voltage) * Math.SQRT2;
}

function nominalVoltage(a, b) {
  const va = Number(a.voltage);
  const vb = Number(b.voltage);
  if (a.kind === 'dc' && b.kind === 'dc') {
    const u = Math.abs(va - vb);
    return { rms: u, peak: u, basis: `|Va − Vb| = |${signed(va)} − ${signed(vb, true)}| V DC` };
  }
  if (a.kind === 'ac' && b.kind === 'ac') {
    const basis = 'deux réseaux AC, phases inconnues : somme des valeurs RMS (cas le plus défavorable)';
    return { rms: Math.abs(va) + Math.abs(vb), peak: netPeak(a) + netPeak(b), basis };
  }
  const [vdc, vac, ac] = a.kind === 'dc' ? [va, vb, b] : [vb, va, a];
  const basis = 'DC + AC : √(Vdc² + Vac,rms²)';
  return { rms: Math.sqrt(vdc * vdc + vac * vac), peak: Math.abs(vdc) + netPeak(ac), basis };
}

/**
 * Working voltage between two nets -> {rms, peak, basis}: r.m.s. (or d.c.) for creepage, peak for the record.
 * A net of a floating HV system (IT, isolated from the chassis and watched by an IMD: `floating` on the net) against
 * a net referenced to the chassis takes at least the system voltage `floatingV`: after a first insulation fault
 * elsewhere in the system it can sit at that voltage from the chassis. Two floating nets keep their real difference.
 */
export function workingVoltage(a, b, floatingV = null) {
  const u = nominalVoltage(a, b);
  const raised = floatingV && Boolean(a.floating) !== Boolean(b.floating) && Number(floatingV) > u.rms;
  if (!raised) return u;
  return {
    rms: Number(floatingV),
    peak: Math.max(Number(floatingV), u.peak),
    basis: "système HV flottant (IT) : après un premier défaut d'isolement, ce net peut se trouver à la tension "
      + `du système, ${grouped(floatingV)} V, du Chassis (différence nominale ${fmt(u.rms, 1)} V)`,
  };
}

/** System voltage of the floating (IT) nets: highest minus lowest potential (DC, or ± peak for AC); else null. */
export function floatingSpan(nets) {
  const values = nets.filter((net) => net.floating)
    .flatMap((net) => (net.kind === 'dc' ? [Number(net.voltage)] : [netPeak(net), -netPeak(net)]));
  return values.length > 1 ? round(Math.max(...values) - Math.min(...values), 3) : null;
}

// ---- Tables -------------------------------------------------------------------------------------------------------
// [x, value] points of one named column of a table, without the rows that have no value in it.
function column(table, name) {
  const index = table.columns.indexOf(name);
  if (index < 0) throw new Error(`cc_rules: no column "${name}" in the table`);
  return table.rows.filter((row) => row[index] !== null && row[index] !== undefined).map((row) => [row[0], row[index]]);
}
const flag = (value, fallback) => (value === undefined ? fallback : value); // dict.get(key, fallback) of a JSON flag

/** Value at x of a table (x ascending) -> [value, how]. Below the first row: first value. Above the last: null. */
export function lookup(points, x, interpolate) {
  if (!points || !points.length) return [null, 'table vide'];
  if (x <= points[0][0]) return [points[0][1], `ligne ${fmt(points[0][0])}`];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x === x1) return [y1, `ligne ${fmt(x1)}`];
    if (x0 < x && x < x1) {
      if (!interpolate) return [y1, `ligne supérieure ${fmt(x1)}`];
      return [y0 + (y1 - y0) * (x - x0) / (x1 - x0), `interpolé entre ${fmt(x0)} et ${fmt(x1)}`];
    }
  }
  return [null, `au-delà de la table (${fmt(points[points.length - 1][0])} max.)`];
}

/** Column of Table F.4 for a pollution degree, a material group and printed wiring or not. */
export function creepageColumn(pd, group, printed) {
  const degree = String(pd);
  if (printed && degree === '1') return 'pw_pd1';
  if (printed && degree === '2' && group !== 'IIIb') return 'pw_pd2';
  if (degree === '1') return 'pd1';
  return `pd${degree}_${{ I: 'i', II: 'ii', IIIa: 'iii', IIIb: 'iii' }[group]}`; // an unknown group has no column
}

/** Creepage of basic insulation (Table F.4) -> [mm | null, how]. */
export function creepageBasic(rules, uRms, pd, group, printed = false) {
  const table = rules.creepage;
  const col = creepageColumn(pd, group, printed);
  const [value, how] = lookup(column(table, col), uRms, flag(table.interpolate, true));
  return [value, `${value !== null ? `${fmt(value)} mm` : '—'} (${col}, ${how})`];
}

/** Rated impulse voltage (Table F.1) of an overvoltage category -> [kV | null, how]. */
export function impulseFromOvc(rules, uRms, ovc) {
  const points = column(rules.impulse, `ovc_${ovc.toLowerCase()}`);
  const row = points.find(([limit]) => uRms <= limit);
  if (row) return [row[1] / 1000, `OVC ${ovc} · ≤ ${fmt(row[0])} V`];
  return [null, `au-delà de ${fmt(points[points.length - 1][0])} V : saisissez la tension de choc (kV)`];
}

/** Impulse voltage of reinforced insulation: next step of the preferred series, else x the factor -> [kV, how]. */
export function reinforcedImpulse(rules, kv) {
  const spec = rules.reinforced;
  const series = rules.impulse.series || [];
  const at = series.indexOf(round(kv * 1000));
  const step = flag(spec.impulse_step, true) && at >= 0 && at < series.length - 1;
  if (step) return [series[at + 1] / 1000, 'pas suivant de la série'];
  const factor = Number(spec.impulse_factor ?? 1.6);
  return [kv * factor, `× ${fmt(factor)}`];
}

/** Altitude correction factor of the clearance (Table A.2, interpolated) -> [factor | null, how]. */
export function altitudeFactor(rules, altitudeM) {
  return lookup(rules.altitude.rows, Number(altitudeM), true);
}

/** Clearance in air up to 2 000 m (Table F.2, field case 'A' | 'B'), raised to the PD minimum -> [mm | null, how]. */
export function clearanceBasic(rules, kv, pd, field) {
  const table = rules.clearance;
  const [value, how] = lookup(column(table, `case_${field.toLowerCase()}`), kv, flag(table.interpolate, false));
  if (value === null) return [null, how];
  const floor = Number((table.pd_min || {})[String(pd)] ?? 0);
  if (floor > value) return [floor, `${fmt(value)} mm, minimum PD${pd} → ${fmt(floor)} mm`];
  return [value, `${fmt(value)} mm (${how})`];
}

/** Minimum width X of a groove (mm); one third of the clearance when that clearance is below 3 mm. */
export function grooveWidth(rules, pd, clearanceMm) {
  const x = Number(rules.groove_x[String(pd)]);
  const reduce = flag(rules.groove_x_reduce, true) && typeof clearanceMm === 'number' && clearanceMm < 3.0;
  return reduce ? Math.min(x, clearanceMm / 3.0) : x;
}

// ---- Post-assembly validation tests -------------------------------------------------------------------------------
/**
 * Tests of a net pair: dielectric withstand (« hipot »), insulation resistance, partial discharge -- the voltages
 * the assembled product will be TESTED at, not the voltages it works at: the 60 s test, 3 to 4 times the working
 * voltage, reveals on every unit the weaknesses that voltage would only reveal after years. A rule set without a
 * `validation` block gets the default tests (`defaulted`), but its clearance is not raised to hold them (`covers`).
 */
export function validationTests(rules, uRms, uPeak, level, pd, field) {
  const block = rules.validation;
  const defaulted = block === null || block === undefined;
  const v = !defaulted && Object.keys(block).length ? block : VALIDATION; // an empty block reads as the default one
  const { hipot: h, pd: pdv, ir } = v;
  let rms = Number(h.a) * uRms + Number(h.b);
  if (level === 'reinforced') rms *= Number(h.reinforced_factor);
  const peak = rms * Math.SQRT2;
  const [clr, how] = clearanceBasic(rules, peak / 1000, pd, field);
  const f3 = level === 'reinforced' ? Number(pdv.f3_reinforced) : 1.0;
  const extinction = Number(pdv.f1) * f3 * uPeak;
  const ohm = (perVolt) => round(Number(perVolt) * uRms);
  return {
    defaulted,
    covers: Boolean(v.clearance_covers_hipot) && !defaulted,
    hipot_rms: round(rms), hipot_peak: round(peak), dc_equivalent: round(peak),
    ratio: uRms ? round(rms / uRms, 2) : null,
    duration_s: h.duration_s, production_rms: round(rms * Number(h.production_factor)), production_s: h.production_s,
    clearance_mm: clr !== null ? up(clr) : null, clearance_how: how,
    ir_min_ohm_dc: ohm(ir.ohm_per_volt_dc), ir_min_ohm_ac: ohm(ir.ohm_per_volt_ac),
    pd_extinction: round(extinction), pd_initial: round(extinction * Number(pdv.f2)), pd_max_pc: pdv.max_pc,
  };
}

const LAYER_NOTES = {
  unknown: 'Rigidité diélectrique absente de la fiche matériau : saisissez-la (kV/mm) dans Matériaux.',
  info: "Pièce sans net : aucune paire ne fixe d'essai pour cette couche.",
  ok: "Marge ≥ × 2 sur le pic de l'essai.",
  warn: "Tient l'essai, mais marge < × 2 : épaissir ou doubler la couche.",
  fail: "Claquerait pendant l'essai diélectrique : épaisseur insuffisante.",
};

/**
 * Solid insulation of a layer {thickness_mm} of a material {dielectric_kv_mm} (or an entry of MATERIALS): typical
 * rapid-rise breakdown (thickness x strength) vs the peak of the test (V). Datasheet strengths are short-time values
 * of a flat sample: practice keeps at least x 2 (edges, folds, ageing, temperature); below x 1 the layer breaks down.
 */
export function layerCheck(layer, material, hipotPeak) {
  const result = (status, withstand, ratio) => ({ status, withstand_kv: withstand, ratio, note: LAYER_NOTES[status] });
  const strength = material ? material.dielectric_kv_mm ?? material.dielectricKvMm : null;
  if (!strength) return result('unknown', null, null);
  const withstand = Number(strength) * Number(layer.thickness_mm ?? layer.thicknessMm);
  if (!hipotPeak) return result('info', round(withstand, 2), null);
  const ratio = withstand * 1000 / hipotPeak;
  return result(ratio >= 2 ? 'ok' : ratio >= 1 ? 'warn' : 'fail', round(withstand, 2), round(ratio, 2));
}

// ---- Requirement of a net pair ------------------------------------------------------------------------------------
/**
 * Required clearance and creepage (per material group, and on printed wiring) between nets a and b, groove width X
 * and post-assembly tests. `params` overrides DEFAULT_PARAMS (null keeps the default), `level` overrides its level.
 * -> {u_rms, u_peak, basis, level, steps, warnings, clearance_mm, creepage_mm: {I, II, IIIa, IIIb, PCB}, x_mm,
 * impulse_kv, u_analysis, tests}
 */
export function requirement(rules, params, a, b, level) {
  const given = Object.entries(params || {}).filter(([key, value]) => (value ?? null) !== null || key === 'impulse_kv');
  const p = { ...DEFAULT_PARAMS, ...Object.fromEntries(given) };
  const pd = Math.trunc(Number(p.pollution_degree));
  level = level || p.level;
  const k = Number(p.voltage_factor || 1.0);
  const u = workingVoltage(a, b, p.floating_v);
  const out = {
    u_rms: round(u.rms, 3), u_peak: round(u.peak, 3), basis: u.basis, level, steps: [], warnings: [],
    clearance_mm: null, creepage_mm: {}, x_mm: null, impulse_kv: null, u_analysis: round(u.rms * k, 3), tests: null,
  };
  if (u.rms <= 0) return { ...out, warnings: ['Même potentiel : aucune distance requise.'] };
  const { steps } = out;
  const ua = u.rms * k;
  steps.push(`Tension de travail ${fmt(u.rms, 1)} V (peak ${fmt(u.peak, 1)} V) : ${u.basis}.`);
  if (k !== 1.0) steps.push(`Facteur maison × ${fmt(k)} : tension d'analyse ${fmt(ua, 1)} V (tables F.1 et F.4).`);
  // Clearance: impulse withstand voltage -> Table F.2 -> PD minimum -> altitude -> margin
  let [kv, how] = p.impulse_kv ? [Number(p.impulse_kv), 'tension de choc saisie'] : impulseFromOvc(rules, ua, p.ovc);
  if (kv === null) {
    out.warnings.push(`Clearance non calculée : ${how}.`);
  } else {
    steps.push(`Tension de choc ${fmt(kv)} kV (${how}).`);
    if (level === 'reinforced') {
      [kv, how] = reinforcedImpulse(rules, kv);
      steps.push(`Reinforced : ${fmt(kv)} kV (${how}).`);
    }
    out.impulse_kv = round(kv, 3);
    const [clearance, source] = clearanceBasic(rules, kv, pd, p.field);
    if (clearance === null) {
      out.warnings.push(`Clearance non calculée : ${fmt(kv)} kV ${source}.`);
    } else {
      steps.push(`Clearance (Table F.2, cas ${p.field}) : ${source}.`);
      const [factor, row] = altitudeFactor(rules, p.altitude_m);
      if (factor === null) {
        out.warnings.push(`Altitude ${altLabel(p.altitude_m)} ${row}.`);
      } else {
        if (factor !== 1.0) steps.push(`Altitude ${altLabel(p.altitude_m)} : × ${fmt(factor, 3)} (${row}).`);
        const margin = Number((rules.margin_pct || {}).clearance || 0);
        if (margin) steps.push(`Marge maison clearance : + ${fmt(margin)} %.`);
        out.clearance_mm = up(margin ? clearance * factor * (1 + margin / 100) : clearance * factor);
        steps.push(`Clearance requise en service : ${fmt(out.clearance_mm)} mm.`);
      }
    }
  }
  // Post-assembly tests: the clearance must also hold the peak of the dielectric test, at the test site
  const tests = validationTests(rules, u.rms, u.peak, level, pd, p.field);
  out.tests = tests;
  if (tests.covers && tests.clearance_mm !== null) {
    const hipot = `Essai diélectrique ${grouped(tests.hipot_rms)} V rms (peak ${grouped(tests.hipot_peak)} V`;
    if (out.clearance_mm === null || tests.clearance_mm > out.clearance_mm) {
      out.clearance_mm = tests.clearance_mm;
      steps.push(`${hipot}, au sol) : la clearance doit le tenir → ${fmt(tests.clearance_mm)} mm.`);
    } else {
      steps.push(`${hipot}) : ${fmt(tests.clearance_mm)} mm suffisent, déjà couverts.`);
    }
  }
  // Creepage: Table F.4 per material group -> level factor -> margin -> never below the clearance
  let factor = 1.0;
  if (level === 'reinforced') factor = Number(rules.reinforced.creepage_factor ?? 2.0);
  if (level === 'functional') factor = Number(rules.functional_factor ?? 1.0);
  const margin = Number((rules.margin_pct || {}).creepage || 0);
  for (const [key, group, printed] of [...GROUPS.map((g) => [g, g, false]), ['PCB', 'IIIa', true]]) {
    const [basic, source] = creepageBasic(rules, ua, pd, group, printed);
    if (basic === null) {
      out.creepage_mm[key] = null;
      if (key === 'I') out.warnings.push(`Creepage hors table : ${source}.`);
    } else {
      const value = basic * (factor * (1 + margin / 100));
      out.creepage_mm[key] = up(out.clearance_mm !== null ? Math.max(value, out.clearance_mm) : value);
    }
  }
  if (factor !== 1.0) steps.push(`${LEVEL_LABEL[level]} : creepage × ${fmt(factor)}.`);
  if (margin) steps.push(`Marge maison creepage : + ${fmt(margin)} %.`);
  if (out.clearance_mm !== null) {
    steps.push(`Creepage jamais inférieur à la clearance (${fmt(out.clearance_mm)} mm).`);
  }
  if (pd === 3 && ua > 630) out.warnings.push('PD3 au-delà de 630 V : material group IIIb non recommandé.');
  out.x_mm = round(grooveWidth(rules, pd, out.clearance_mm), 3);
  steps.push(`Rainure X = ${fmt(out.x_mm, 3)} mm (PD${pd}) : plus étroite, elle est franchie en ligne droite.`);
  return out;
}
