/* DynamiteOrbit.ai — Logiciel : the boards, as the software sees them. A battery management system is two kinds of boards :
   the cell electronics (ISO 12405-4 ; a « cell monitoring board ») on each module — it measures the voltage of every cell and a few temperatures, bleeds a cell
   on demand, and answers on an isolated link — and one BMS board that reads the pack current and the two voltages across the
   contactors, drives the contactors and reads them back, watches the interlock loop, and speaks to the vehicle over low voltage
   (a CAN bus, a few discrete lines). This file is that hardware / software interface : what each signal is (the « HSI »), how a
   true value of the plant becomes a number the software reads — a resolution, a small offset, a refresh — and what a FAULT of
   the hardware does to it. The faults are the ones a bench injects : a sense wire cut, a probe open, a link lost, a reference
   that drifts, a contactor welded.
   The figures are typical of such boards, said as such — never those of a component reference. Pure : no page. */

import { packVoltage } from "./plant.js";

/** What can be broken on the bench. on : what it applies to ; value : what it takes (with its unit and an example). */
export const FAULT_KINDS = {
  openWire: { label: "Open wire", fr: "fil de mesure coupé", on: "cell", text: "Le fil de mesure d'une cellule est coupé : l'électronique de cellules lit 0 V sur cette voie." },
  refDrift: { label: "Reference drift", fr: "dérive de la référence de mesure", on: "module", value: ["%", 3], text: "La référence de tension de l'électronique de cellules d'un module a dérivé : toutes ses cellules se lisent trop haut ou trop bas." },
  ntcOpen: { label: "NTC open", fr: "sonde de température coupée", on: "ntc", text: "Une sonde est coupée : sa résistance est infinie, l'électronique de cellules lit le froid extrême." },
  ntcShort: { label: "NTC short", fr: "sonde en court-circuit", on: "ntc", text: "Une sonde est en court-circuit : l'électronique de cellules lit le chaud extrême." },
  linkLoss: { label: "Link loss", fr: "liaison perdue avec l'électronique de cellules d'un module", on: "module", text: "L'électronique de cellules d'un module ne répond plus : ses mesures ne sont plus rafraîchies." },
  currentOffset: { label: "Current sensor offset", fr: "décalage du capteur de courant", on: "bms", value: ["A", 5], text: "Le capteur de courant a un décalage : le compte des ampères-heures dérive." },
  weld: { label: "Welded contactor", fr: "contacteur soudé", on: "contactor", text: "Les contacts sont soudés : le contacteur ne s'ouvre plus." },
  stuckOpen: { label: "Contactor stuck open", fr: "contacteur qui ne ferme pas", on: "contactor", text: "La bobine est commandée, les contacts ne se ferment pas." },
  hvilOpen: { label: "HVIL open", fr: "boucle d'interverrouillage ouverte", on: "bms", text: "Un connecteur haute tension est débranché : la boucle d'interverrouillage s'ouvre." },
  busShort: { label: "Bus short", fr: "court-circuit côté véhicule", on: "bus", text: "Le bus du véhicule est en court-circuit : la précharge n'arrive jamais à sa tension." },
  hotModule: { label: "Module heating", fr: "module qui chauffe", on: "module", value: ["W", 300], text: "Un module reçoit de la chaleur qu'il n'évacue pas (cellule en défaut, refroidissement perdu)." },
};
const active = (faults, t, kind) => (faults || []).filter((f) => f && f.kind === kind && t + 1e-9 >= (f.at || 0));
/** What the faults of the moment do to the plant itself (the rest only changes what is measured). → { weld, stuckOpen, busShort } and the heat per module */
export function plantFaults(faults, t, spec) {
  const heat = new Float64Array(spec.m); for (const f of active(faults, t, "hotModule")) heat[Math.min(spec.m - 1, f.module || 0)] += f.value ?? 300;
  return { faults: { weld: active(faults, t, "weld").map((f) => f.contactor || "mainP"), stuckOpen: active(faults, t, "stuckOpen").map((f) => f.contactor || "mainP"), busShort: active(faults, t, "busShort").length > 0 }, heat };
}
const q = (v, step) => Math.round(v / step) * step;
/** What the software holds between two readings : the last frame of the cell electronics of each module. */
export const hwMemo = (spec) => ({ cells: new Float64Array(spec.cells), temps: new Float64Array(spec.m * spec.ntc), first: true });

/** One reading of every board. P : the plant ; inputs : what the vehicle side sets — { wake, drive, chargerOn, hvil (default true) } ;
    → { cells (V, one per cell), temps (°C, ntc per module), fresh (per module : its cell electronics answered this time), i (A), vPack, vBus (V),
        fb: { mainP, mainN, pre }, hvil, wake, drive, chargerOn } */
export function measure(P, spec, faults, inputs, memo) {
  const t = P.t, lost = new Set(active(faults, t, "linkLoss").map((f) => f.module || 0)), fresh = new Uint8Array(spec.m);
  for (let m = 0; m < spec.m; m++) {
    if (lost.has(m) && !memo.first) continue;      // cell electronics that do not answer : the software keeps what it last heard
    fresh[m] = lost.has(m) ? 0 : 1; if (!fresh[m]) continue;
    const gain = 1 + active(faults, t, "refDrift").filter((f) => (f.module || 0) === m).reduce((s, f) => s + (f.value ?? 3) / 100, 0);
    for (let c = 0; c < spec.s; c++) { const g = m * spec.s + c, cut = active(faults, t, "openWire").some((f) => (f.module || 0) === m && (f.cell || 0) === c); memo.cells[g] = cut ? 0 : q(P.v[g] * gain + 0.0015 * Math.sin(2.3 * g + 1), 0.001); }      // 1 mV, and each channel its own small offset
    for (let n = 0; n < spec.ntc; n++) { const open = active(faults, t, "ntcOpen").some((f) => (f.module || 0) === m && (f.ntc || 0) === n), short = active(faults, t, "ntcShort").some((f) => (f.module || 0) === m && (f.ntc || 0) === n);
      memo.temps[m * spec.ntc + n] = open ? -40 : short ? 150 : q(P.temp[m] + 0.4 * Math.sin(1.3 * (m * spec.ntc + n)), 0.5); }
  }
  memo.first = false;
  const off = active(faults, t, "currentOffset").reduce((s, f) => s + (f.value ?? 5), 0), hvil = (inputs.hvil ?? true) && !active(faults, t, "hvilOpen").length;
  return { cells: memo.cells, temps: memo.temps, fresh, i: Math.max(-spec.iRange, Math.min(spec.iRange, q(P.i + off, 0.05))), vPack: q(packVoltage(P), 0.1), vBus: q(P.vBus, 0.1),
    fb: { mainP: P.k.mainP, mainN: P.k.mainN, pre: P.k.pre }, hvil, wake: !!inputs.wake, drive: !!inputs.drive, chargerOn: !!inputs.chargerOn };
}

/** The hardware / software interface : every signal the software reads or drives, board by board.
    → [{ board ("cell electronics" | "BMS"), name, dir ("in" | "out" | "bus"), kind, unit, range, step, period (s), count, diag (how a wrong value is caught) }] */
export function hsiSignals(spec) {
  const n = (v) => String(v).replace(".", ",");
  return [
    { board: "cell electronics", name: "CELL_V", dir: "in", kind: "tension de cellule", unit: "V", range: "0 à 5", step: "1 mV", period: 0.1, count: spec.s, diag: "plausibilité (0,5 à 5 V) ; somme des cellules contre la tension du pack" },
    { board: "cell electronics", name: "NTC_T", dir: "in", kind: "température du module", unit: "°C", range: "−40 à 125", step: "0,5 °C", period: 0.1, count: spec.ntc, diag: "plausibilité (−35 à 120 °C) : sonde coupée ou en court-circuit" },
    { board: "cell electronics", name: "BAL", dir: "out", kind: "équilibrage : décharge d'une cellule", unit: "—", range: "0 / 1", step: "", period: 0.1, count: spec.s, diag: `résistance de ${n(spec.rBal)} Ω par cellule` },
    { board: "cell electronics", name: "ISO_LINK", dir: "bus", kind: "liaison isolée vers la carte BMS", unit: "trame", range: "", step: "", period: 0.1, count: 1, diag: "délai sans réponse (timeout)" },
    { board: "BMS", name: "I_PACK", dir: "in", kind: "courant du pack", unit: "A", range: `± ${n(spec.iRange)}`, step: "0,05 A", period: 0.01, count: 1, diag: "seuils de surintensité ; courant nul contacteurs ouverts" },
    { board: "BMS", name: "V_PACK", dir: "in", kind: "tension du pack, avant les contacteurs", unit: "V", range: `0 à ${n(Math.ceil(spec.vTop * 1.15))}`, step: "0,1 V", period: 0.01, count: 1, diag: "contre la somme des cellules" },
    { board: "BMS", name: "V_BUS", dir: "in", kind: "tension du bus, après les contacteurs", unit: "V", range: `0 à ${n(Math.ceil(spec.vTop * 1.15))}`, step: "0,1 V", period: 0.01, count: 1, diag: "fin de précharge : 95 % de la tension du pack" },
    { board: "BMS", name: "K_MAIN_P / K_MAIN_N / K_PRE", dir: "out", kind: "bobines des contacteurs", unit: "—", range: "0 / 1", step: "", period: 0.01, count: 3, diag: "relecture des contacts auxiliaires" },
    { board: "BMS", name: "FB_MAIN_P / FB_MAIN_N / FB_PRE", dir: "in", kind: "contacts auxiliaires", unit: "—", range: "0 / 1", step: "", period: 0.01, count: 3, diag: "écart commande / relecture : contacteur soudé, ou qui ne ferme pas" },
    { board: "BMS", name: "HVIL", dir: "in", kind: "boucle d'interverrouillage", unit: "—", range: "0 / 1", step: "", period: 0.01, count: 1, diag: "boucle ouverte : ouverture immédiate" },
    { board: "BMS", name: "WAKE / DRIVE_REQ / CHG_PRESENT", dir: "in", kind: "demandes du véhicule et du chargeur (basse tension)", unit: "—", range: "0 / 1", step: "", period: 0.01, count: 3, diag: "" },
    { board: "BMS", name: "BMS_OK", dir: "out", kind: "ligne de défaut vers le véhicule (basse tension)", unit: "—", range: "0 / 1", step: "", period: 0.01, count: 1, diag: "à 0 dès qu'un défaut est retenu" },
    { board: "BMS", name: "CAN_VEH", dir: "bus", kind: "bus vers le véhicule : état, mesures, limites, défauts", unit: "trame", range: "", step: "", period: 0.1, count: VEHICLE_FRAMES.length, diag: "compteur de trames et somme de contrôle : à écrire dans le protocole" },
    { board: "BMS", name: "CAN_CHG", dir: "bus", kind: "bus vers le chargeur : courant et tension demandés", unit: "trame", range: "", step: "", period: 0.1, count: 1, diag: "le chargeur n'applique que ce qui est demandé" },
  ];
}
/** What the BMS says to the vehicle over low voltage : the frames of its bus (identifiers of an example — the vehicle's protocol decides). */
export const VEHICLE_FRAMES = [
  { id: "0x100", name: "BMS_STATUS", period: 0.1, signals: [["state", "état du logiciel"], ["ok", "BMS_OK"], ["mainP", "contacteur +"], ["mainN", "contacteur −"], ["pre", "précharge"]] },
  { id: "0x101", name: "BMS_MEAS", period: 0.1, signals: [["vPack", "tension du pack, V"], ["i", "courant, A"], ["soc", "état de charge, %"], ["vmin", "cellule la plus basse, V"], ["vmax", "cellule la plus haute, V"], ["tmax", "température la plus haute, °C"]] },
  { id: "0x102", name: "BMS_LIMITS", period: 0.1, signals: [["limDis", "courant de décharge permis, A"], ["limChg", "courant de charge permis, A"]] },
  { id: "0x103", name: "BMS_FAULTS", period: 0.1, signals: [["faults", "défauts retenus"]] },
];
