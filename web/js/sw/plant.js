/* DynamiteOrbit — Logiciel : the battery the embedded software is tried against, before the boards and the pack exist
   (demande de JP : « on embarque un logiciel… et on simule l'interface avec le matériel »). This is the PLANT of the bench :
   cells in series in modules (a « BM »), modules in series in a pack, three contactors and a precharge resistor, the capacitor
   of the vehicle side, a load and a charger. It is deliberately simple — one resistance and one open-circuit curve per cell,
   one temperature per module — and it says so : the curves are TYPICAL shapes of a chemistry, never those of a cell reference.
   Sign : a current is positive when it leaves the pack (discharge), negative when it charges it.
   Units : V, A, Ω, s, °C, Ah, J/K, K/W. Pure : no page. */

import { CELLS } from "../cad/elec_library.js";

/** The chemistries : a typical open-circuit voltage against the state of charge (0 to 1), and what goes with it. */
export const CHEMISTRIES = {
  nmc: { label: "NMC / NCA", fr: "nickel-manganèse-cobalt, nickel-cobalt-aluminium", vMax: 4.2, vMin: 2.5, r0: 0.025, cp: 1000,
    ocv: [[0, 3.0], [0.05, 3.3], [0.1, 3.45], [0.2, 3.55], [0.3, 3.62], [0.4, 3.68], [0.5, 3.74], [0.6, 3.82], [0.7, 3.9], [0.8, 3.99], [0.9, 4.08], [1, 4.2]], basis: "Forme typique d'une cellule cylindrique NMC, écrite de mémoire : la courbe de la fiche de la cellule fait foi." },
  lfp: { label: "LFP", fr: "lithium-fer-phosphate", vMax: 3.65, vMin: 2.0, r0: 0.02, cp: 1100,
    ocv: [[0, 2.5], [0.05, 3.0], [0.1, 3.2], [0.2, 3.25], [0.5, 3.29], [0.8, 3.32], [0.9, 3.34], [0.97, 3.4], [1, 3.6]], basis: "Forme typique d'une cellule LFP — un long plateau —, écrite de mémoire : la courbe de la fiche de la cellule fait foi." },
};
const lerp = (table, x, a, b) => { if (x <= table[0][a]) return table[0][b]; for (let i = 1; i < table.length; i++) if (x <= table[i][a]) { const p = table[i - 1], q = table[i]; return p[b] + (q[b] - p[b]) * (x - p[a]) / ((q[a] - p[a]) || 1); } return table[table.length - 1][b]; };
/** Open-circuit voltage of a cell at a state of charge, and the state of charge a rest voltage tells. */
export const ocvOf = (chem, soc) => lerp((CHEMISTRIES[chem] || CHEMISTRIES.nmc).ocv, soc, 0, 1);
export const socOf = (chem, v) => lerp((CHEMISTRIES[chem] || CHEMISTRIES.nmc).ocv, v, 1, 0);

/** The pack a piece of software is written for, as the project keeps it. */
export const blankPack = () => ({ cell: "21700", chem: "nmc", series: 12, parallel: 4, modules: 4, ntc: 3, rPre: 100, cBus: 0.001, rBal: 33, rth: 2, iRange: 200 });
/** Everything the plant and the software need to know of a pack, worked out once. pack : blankPack() with the designer's values. */
export function packSpec(pack) {
  const p = { ...blankPack(), ...(pack || {}) }, cell = CELLS.find((c) => c.id === p.cell) || CELLS[0], chem = CHEMISTRIES[p.chem] ? p.chem : "nmc", C = CHEMISTRIES[chem];
  const s = Math.max(1, Math.round(p.series)), par = Math.max(1, Math.round(p.parallel)), m = Math.max(1, Math.round(p.modules)), cap = (cell.capacity[0] + cell.capacity[1]) / 2, mass = (cell.mass[0] + cell.mass[1]) / 2 / 1000;
  return { chem, cell: cell.id, s, p: par, m, cells: s * m, ntc: Math.max(1, Math.round(p.ntc)), qAh: cap * par, r0: C.r0 / par, vMax: C.vMax, vMin: C.vMin, vNom: lerp(C.ocv, 0.5, 0, 1) * s * m, vTop: C.vMax * s * m,
    cth: mass * par * s * C.cp, rth: p.rth, rPre: p.rPre, cBus: p.cBus, rBal: p.rBal, iRange: p.iRange, iCell: cell.discharge[0] * par, tAct: 0.02 };      // cth : J/K of a module ; iCell : what its cells may give continuously ; tAct : how long a contactor takes to move
}
export const KONTACTS = ["mainP", "mainN", "pre"];

/** A plant at rest. init : { soc (0 to 1, every cell), spread (the cells are spread ± this around soc, each its own way), temp, ambient } */
export function makePlant(spec, init = {}) {
  const soc0 = init.soc ?? 0.5, sp = init.spread || 0, soc = new Float64Array(spec.cells);
  for (let c = 0; c < soc.length; c++) soc[c] = Math.min(1, Math.max(0, soc0 + sp * Math.sin(1.7 * c + 0.6)));      // a fixed pattern : the same pack at every run
  return { t: 0, soc, v: Float64Array.from(soc, (x) => ocvOf(spec.chem, x)), temp: new Float64Array(spec.m).fill(init.temp ?? 25), k: { mainP: 0, mainN: 0, pre: 0 }, want: { mainP: 0, mainN: 0, pre: 0 }, since: { mainP: 0, mainN: 0, pre: 0 }, vBus: 0, i: 0, ambient: init.ambient ?? init.temp ?? 25 };
}
export const packVoltage = (P) => { let s = 0; for (let c = 0; c < P.v.length; c++) s += P.v[c]; return s; };

/** One step of the plant. cmd : what the boards drive — { mainP, mainN, pre (0 | 1), bal (one flag per cell, or null) } ;
    env : { load (A the vehicle draws, negative when it gives back), charger: { on, iReq, vReq, iMax } | null, heat (W added to each module,
    one per module, or null), faults: { weld: [contactor…], stuckOpen: [contactor…], busShort } }. → the plant, changed in place */
export function stepPlant(P, spec, cmd, env, dt) {
  const f = (env && env.faults) || {}, weld = f.weld || [], stuck = f.stuckOpen || [];
  for (const k of KONTACTS) {      // a contactor follows its coil after its travel time — unless it is welded shut, or will not close
    const want = cmd && cmd[k] ? 1 : 0; if (want !== P.want[k]) { P.want[k] = want; P.since[k] = 0; } else P.since[k] += dt;
    if (P.since[k] + 1e-9 >= spec.tAct) P.k[k] = want;
    if (stuck.includes(k)) P.k[k] = 0; if (weld.includes(k) && (P.k[k] || P.welded?.[k])) { P.k[k] = 1; (P.welded = P.welded || {})[k] = 1; }
  }
  let voc = 0; for (let c = 0; c < spec.cells; c++) voc += ocvOf(spec.chem, P.soc[c]);
  const R = spec.cells * spec.r0, ch = env && env.charger && env.charger.on ? env.charger : null, load = (env && env.load) || 0;
  let i = 0;
  if (P.k.mainP && P.k.mainN) {      // the pack is on the bus : the vehicle draws its load, the charger gives what is asked — never above the voltage asked
    const give = ch ? Math.max(0, Math.min(ch.iReq || 0, ch.iMax ?? Infinity, ((ch.vReq || 0) - voc) / R)) : 0;
    i = load - give; P.vBus = f.busShort ? 0 : voc - i * R;
  } else if (P.k.pre && P.k.mainN) {      // precharge : the bus capacitor fills through the resistor
    const target = f.busShort ? 0 : voc; i = (voc - P.vBus) / (spec.rPre + R);
    if (!f.busShort) P.vBus += (target - P.vBus) * (1 - Math.exp(-dt / (spec.rPre * spec.cBus)));
  } else P.vBus *= Math.exp(-dt / 0.5);      // nothing feeds the bus : it bleeds down
  P.i = i;
  const k = dt / (spec.qAh * 3600);
  for (let c = 0; c < spec.cells; c++) { const bleed = cmd && cmd.bal && cmd.bal[c] ? P.v[c] / spec.rBal : 0; P.soc[c] = Math.min(1.02, Math.max(-0.02, P.soc[c] - (i + bleed) * k)); P.v[c] = ocvOf(spec.chem, P.soc[c]) - i * spec.r0; }
  for (let m = 0; m < spec.m; m++) P.temp[m] += ((i * i * spec.r0 * spec.s + ((env && env.heat && env.heat[m]) || 0)) - (P.temp[m] - P.ambient) / spec.rth) * dt / spec.cth;
  P.t += dt;
  return P;
}
