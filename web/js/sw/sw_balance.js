/* DynamiteOrbit.ai — Logiciel : CHARGE AND PASSIVE BALANCING of a module, seen cell block by cell block (demande de JP, 24 novembre 2026 : « pour le
   profil de charge, on doit partir avec les batteries à 3,0 V — plage de 100 % de SOC de 2,5 V à 4,2 V — et aussi avoir une opération du mode de
   balancement passif visuel entre plusieurs cellules débalancées ; probablement que la charge ralentit pendant ce temps, et on passe de 0,1 C à
   2 C, et on peut voir en mode accéléré ce que ça donne »).
   The plant : N cell blocks in series (the CORE of the module, each 8 cells in parallel), each with its own capacity and its own state of
   charge — unbalanced at the start —, a typical open-circuit curve (0 % = 2,5 V, 100 % = 4,2 V : the range JP gives), one resistance. The
   charger : 0.1 C to begin with, then 2 C (the most the cell sheet allows : 9 A per cell, 8 in parallel), then constant voltage at 4,2 V on the
   highest block. The resistors bleed WHILE it charges — what the reference manual of a monitor of the trade allows, « during charging or at
   rest » (refs ti-bq76952-trm, sw/sw_refs.js) ; slowing the charge while they bleed is a choice the screen offers (cBal), no source read asks it. THE DECISION of each block is the step of the « Passive balancing » block of the
   software — the same step as the C —, run once per block with its own voltage, the lowest one, and the current.
   Everything is TYPICAL : the curve is written from memory, the resistance and the spread are examples ; the screen says so. Pure : no page. */

import { KINDS, cfgOf } from "./sw_objects.js";

/* a typical NMC open-circuit curve spread over the range JP gives — the sheet of the cell holds the real one */
export const OCV = [[0, 2.5], [0.02, 2.85], [0.05, 3.05], [0.1, 3.3], [0.2, 3.5], [0.3, 3.6], [0.4, 3.66], [0.5, 3.72], [0.6, 3.8], [0.7, 3.9], [0.8, 3.99], [0.9, 4.08], [1, 4.2]];
const lerp = (T, x, a, b) => { if (x <= T[0][a]) return T[0][b]; for (let i = 1; i < T.length; i++) if (x <= T[i][a]) { const p = T[i - 1], q = T[i]; return p[b] + (q[b] - p[b]) * (x - p[a]) / ((q[a] - p[a]) || 1); } return T[T.length - 1][b]; };
export const ocv = (soc) => lerp(OCV, soc, 0, 1);
export const socAt = (v) => lerp(OCV, v, 1, 0);

/* the module of JP : 8 CORE of 8 Molicel P45B in parallel (4,5 Ah each, sheet p. 3) ; a spread of state of charge and of capacity, as a pack
   that has lived ; the resistance of a block is an example (8 cells of about 25 mΩ of direct-current resistance in parallel) */
export const BALANCE_DEFAULTS = { n: 8, capAh: 36, start: 3.0, spread: [0, -0.02, 0.03, 0.01, -0.025, 0.04, 0.005, -0.01], capSpread: [1, 0.98, 1.01, 0.99, 1.02, 0.97, 1, 1.015],
  r: 0.0032, rBal: 8.2, cLow: 0.1, cHigh: 2, cBal: 2, vTop: 4.2, soft: 120, ramp: 60, endC: 0.05, dt: 1 };
const MS = { v_min: 3900, delta: 20, hyst: 10 };
/* THE RULE OF A CORE BOARD THAT BALANCES ALONE (choix de JP, par menu, 27 novembre 2026 : « chaque CORE équilibre seul au seuil » ; « le
   principal n'envoie rien aux cartes de CORE ») : each board reads only its own block — no lowest, no current — and bleeds while it stands at
   or above `on`, until it is back to `off`. After a charge, every block above the threshold comes down to it : they meet there. Examples, to
   confirm ; the firmware of the CORE board is not drawn yet (one software per project), the plant runs its rule. */
export const CORE_BALANCE = { on: 4150, off: 4130 };
/** The rule a design's module gives its CORE boards (`design.plant.balance`), or null : the software of the design balances, or nothing does. */
export const localRule = (d) => (d && d.plant && d.plant.balance && d.plant.balance.on ? d.plant.balance : null);
/** One block under the rule of its own board : its voltage in mV, whether it bleeds now. → 0 | 1 */
export const coreBleed = (on, mv, R) => (on ? (mv > R.off ? 1 : 0) : mv >= R.on ? 1 : 0);

/** The settings : the defaults, the values of the « Passive balancing » block of the software when it has one, and what the screen changed. */
export function balanceSpec(design, over = {}) {
  const o = ((design && design.objects) || []).find((x) => !x.off && x.kind === "balancing"), cfg = o ? cfgOf(o) : MS, R = !o && localRule(design);
  if (R) return { ...BALANCE_DEFAULTS, ...over, cfg: { v_min: R.on, delta: MS.delta, hyst: MS.hyst }, local: { on: R.on, off: R.off }, from: "la carte de chaque CORE, seule, au seuil" };
  return { ...BALANCE_DEFAULTS, ...over, cfg: { v_min: cfg.v_min, delta: cfg.delta, hyst: cfg.hyst }, from: o ? o.name : null };
}
/** A charge at its start : every block from `start` volts at rest, spread as given. */
export function balanceStart(S) {
  const base = socAt(S.start), soc = Array.from({ length: S.n }, (_, k) => Math.min(1, Math.max(0, base + (S.spread[k % S.spread.length] || 0) * 0.5)));
  const B = { S, t: 0, soc, cap: Array.from({ length: S.n }, (_, k) => S.capAh * (S.capSpread[k % S.capSpread.length] || 1)), bleed: new Array(S.n).fill(0), mem: Array.from({ length: S.n }, () => KINDS.balancing.init()),
    i: 0, phase: "soft", done: false, bledAh: new Array(S.n).fill(0), trace: [] };
  B.v = soc.map((x) => ocv(x)); sample(B); return B;
}
const PHASES = { soft: "Départ doux à 0,1 C", ramp: "Montée vers 2 C", cc: "Charge rapide à 2 C", bal: "Équilibrage : la charge ralentie", cv: "Tension constante à 4,2 V", done: "Chargé et équilibré",
  top: "Chargé : chaque CORE au-dessus du seuil se décharge seule", full: "Chargé : le chargeur s'est arrêté" };
export const phaseText = (p) => PHASES[p] || p;
/** Runs n steps of S.dt seconds. → B */
export function balanceStep(B, n = 1) {
  const S = B.S, C1 = S.capAh;
  for (let q = 0; q < n && !B.done; q++) {
    const ocvs = B.soc.map(ocv), hi = Math.max(...ocvs), cv = Math.max(0, (S.vTop - hi) / S.r), anyBleed = B.bleed.some(Boolean);
    let want = B.t < S.soft ? S.cLow * C1 : B.t < S.soft + S.ramp ? (S.cLow + (S.cHigh - S.cLow) * (B.t - S.soft) / S.ramp) * C1 : S.cHigh * C1;
    const free = want; if (anyBleed) want = Math.min(want, S.cBal * C1);      // balancing runs WITH the charge (TI BQ76952 TRM § 10.1 : « during charging or at rest ») ; slowing it is a choice of the project (cBal)
    const I = B.ended ? 0 : Math.min(want, cv);      // charging current, A (into the pack) ; a charge that ended gives nothing
    B.phase = B.ended ? (anyBleed ? "top" : "done") : I < want - 1e-9 ? "cv" : anyBleed && want < free - 1e-9 ? "bal" : B.t < S.soft ? "soft" : B.t < S.soft + S.ramp ? "ramp" : "cc"; B.i = I;
    for (let k = 0; k < S.n; k++) { const ib = B.bleed[k] ? B.v[k] / S.rBal : 0, ic = I - ib;
      B.soc[k] = Math.min(1, Math.max(0, B.soc[k] + ic * S.dt / 3600 / B.cap[k])); B.v[k] = ocv(B.soc[k]) + I * S.r; B.bledAh[k] += ib * S.dt / 3600; }
    /* the software decides, block by block : the step of its « Passive balancing » block, in mV and mA — on voltages corrected of the drop
       the current makes in each block (current × resistance), as a BMS does, so that 2 C does not make it beat around its floor voltage.
       A CORE board that balances ALONE reads its own terminal, current and all : it knows nothing else (S.local) */
    const vr = B.v.map((x) => Math.round((x - I * S.r) * 1000)), low = Math.min(...vr);
    if (S.local) for (let k = 0; k < S.n; k++) B.bleed[k] = coreBleed(B.bleed[k], Math.round(B.v[k] * 1000), S.local);
    else for (let k = 0; k < S.n; k++) B.bleed[k] = KINDS.balancing.step(B.mem[k], S.cfg, { v: vr[k], low, i: -Math.round(I * 1000) }, S.dt * 1000).bleed;
    B.t += S.dt;
    const spread = Math.max(...vr) - Math.min(...vr);
    /* the charger stops at the end of its constant voltage ; under a central balancing it waits for the blocks to meet, under boards that balance
       alone it stops and they come down to their threshold by themselves, at rest */
    if (S.local) { if (!B.ended && I < S.endC * C1 && B.phase === "cv") B.ended = true; if (B.ended && !B.bleed.some(Boolean)) { B.done = true; B.phase = "done"; B.i = 0; } }
    else if (I < S.endC * C1 && B.phase === "cv" && !B.bleed.some(Boolean) && spread <= S.cfg.delta) { B.done = true; B.phase = "done"; B.i = 0; }
    if (B.t % 10 === 0 || B.done) sample(B);
  }
  return B;
}
function sample(B) { B.trace.push({ t: B.t, i: B.i, v: [...B.v], soc: [...B.soc], bleed: [...B.bleed], phase: B.phase }); if (B.trace.length > 4000) B.trace.splice(0, B.trace.length - 4000); }
/** What the screen tells : the spread, the blocks that bleed, the energy the resistors turned into heat. */
export function balanceSummary(B) {
  const mv = B.v.map((x) => Math.round((x - B.i * B.S.r) * 1000)), spread = Math.max(...mv) - Math.min(...mv), heat = B.bledAh.reduce((s, a, k) => s + a * (B.v[k] || 4), 0);
  return { t: B.t, phase: B.phase, text: phaseText(B.phase), cRate: B.i / B.S.capAh, i: B.i, spread, bleeding: B.bleed.filter(Boolean).length, heatWh: heat, socMean: B.soc.reduce((s, x) => s + x, 0) / B.soc.length };
}
