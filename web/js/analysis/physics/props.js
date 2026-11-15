/* DesignWizard.ai — Physique: engineering properties of the materials of cad/materials.js and of the usual fluids.
   TYPICAL values of each family (room temperature, the usual temper or a dry / as-moulded plastic): they size a part,
   they do not certify it. The data sheet of the grade actually bought prevails.
   E GPa · nu · Re (yield, Rp0.2), Rm, fatigue (endurance hint) MPa · cte µm/m.K · k W/m.K · cp J/kg.K · rho kg/m3 ·
   rhoE ohm.m at 20 °C · alphaE 1/K (temperature coefficient of resistivity) · Tmax °C (continuous service, plastics). */

import { material } from "../../cad/materials.js";

export const PROPS_NOTE = "Valeur typique de la famille : à confirmer avec la fiche technique (data sheet) de la nuance achetée.";

const TABLE = {
  "AL6061-T6": { E: 69, nu: 0.33, Re: 276, Rm: 310, fatigue: 96, cte: 23.6, k: 167, cp: 896, rho: 2700, rhoE: 3.99e-8, alphaE: 0.0036 },
  "AL6063-T5": { E: 69, nu: 0.33, Re: 145, Rm: 186, fatigue: 68, cte: 23.4, k: 209, cp: 900, rho: 2700, rhoE: 3.16e-8, alphaE: 0.0039 },
  "AL5052-H32": { E: 70, nu: 0.33, Re: 193, Rm: 228, fatigue: 117, cte: 23.8, k: 138, cp: 880, rho: 2680, rhoE: 4.99e-8, alphaE: 0.0033 },
  "AL-A380": { E: 71, nu: 0.33, Re: 159, Rm: 317, fatigue: 138, cte: 21.8, k: 96, cp: 963, rho: 2710, rhoE: 7.5e-8, alphaE: 0.0020 },     // as cast ; elongation about 3 % : no plastic reserve
  "ZAMAK-3": { E: 86, nu: 0.30, Re: 221, Rm: 283, fatigue: 48, cte: 27.4, k: 113, cp: 419, rho: 6600, rhoE: 6.4e-8, alphaE: 0.0030 },      // creeps under sustained load above 50 °C
  "AL-A356-T6": { E: 72, nu: 0.33, Re: 165, Rm: 228, fatigue: 60, cte: 21.5, k: 151, cp: 963, rho: 2680, rhoE: 4.4e-8, alphaE: 0.0030 },   // sand cast ; permanent mould: Re about 185
  "CU-C110": { E: 117, nu: 0.34, Re: 250, Rm: 290, fatigue: 90, cte: 17.0, k: 388, cp: 385, rho: 8890, rhoE: 1.724e-8, alphaE: 0.00393 },   // H02 (half hard); annealed: Re ~ 70
  "BRASS-360": { E: 97, nu: 0.34, Re: 310, Rm: 400, fatigue: 140, cte: 20.5, k: 115, cp: 380, rho: 8500, rhoE: 6.6e-8, alphaE: 0.0015 },
  "SS-304": { E: 193, nu: 0.29, Re: 215, Rm: 505, fatigue: 240, cte: 17.3, k: 16, cp: 500, rho: 8000, rhoE: 7.2e-7, alphaE: 0.00094 },
  "STEEL-1018": { E: 205, nu: 0.29, Re: 370, Rm: 440, fatigue: 200, cte: 11.7, k: 52, cp: 486, rho: 7870, rhoE: 1.59e-7, alphaE: 0.0045 },
  "SS-316L": { E: 193, nu: 0.29, Re: 205, Rm: 515, fatigue: 240, cte: 16.0, k: 15, cp: 500, rho: 7980, rhoE: 7.4e-7, alphaE: 0.00094 },       // wrought, annealed ; as printed : Re about 450, then lower once stress relieved
  "SS-17-4PH": { E: 197, nu: 0.27, Re: 1000, Rm: 1100, fatigue: 500, cte: 10.8, k: 18, cp: 460, rho: 7800, rhoE: 8.0e-7, alphaE: 0.0009 },   // condition H1025 ; H900 : Re about 1170
  "ALSI10MG": { E: 70, nu: 0.33, Re: 230, Rm: 350, fatigue: 90, cte: 21.0, k: 130, cp: 900, rho: 2670, rhoE: 5.0e-8, alphaE: 0.0030 },       // printed, stress relieved ; elongation about 6 %
  "TI-6AL-4V": { E: 114, nu: 0.34, Re: 830, Rm: 900, fatigue: 500, cte: 8.6, k: 6.7, cp: 526, rho: 4430, rhoE: 1.7e-6, alphaE: 0.0004 },      // annealed ; printed : fatigue only after hot isostatic pressing and machined surfaces
  "IN718": { E: 200, nu: 0.29, Re: 1030, Rm: 1240, fatigue: 500, cte: 13.0, k: 11.4, cp: 435, rho: 8190, rhoE: 1.25e-6, alphaE: 0.0001 },     // solution treated and aged ; as printed : Re about 650
  "IN625": { E: 207, nu: 0.28, Re: 415, Rm: 830, fatigue: 350, cte: 12.8, k: 9.8, cp: 410, rho: 8440, rhoE: 1.29e-6, alphaE: 0.0001 },       // annealed
  "PA66-GF30": { E: 9.0, nu: 0.35, Re: 130, Rm: 170, cte: 30, k: 0.35, cp: 1500, rho: 1360, Tmax: 120 },
  "PC": { E: 2.35, nu: 0.37, Re: 62, Rm: 65, cte: 68, k: 0.20, cp: 1200, rho: 1200, Tmax: 115 },
  "PC-ABS": { E: 2.5, nu: 0.36, Re: 55, Rm: 55, cte: 75, k: 0.20, cp: 1300, rho: 1150, Tmax: 90 },
  "ABS": { E: 2.3, nu: 0.35, Re: 43, Rm: 45, cte: 90, k: 0.17, cp: 1400, rho: 1050, Tmax: 80 },
  "PBT-GF30": { E: 9.5, nu: 0.36, Re: 120, Rm: 135, cte: 30, k: 0.28, cp: 1250, rho: 1530, Tmax: 130 },
  "PPS-GF40": { E: 14, nu: 0.36, Re: 160, Rm: 185, cte: 20, k: 0.30, cp: 1000, rho: 1650, Tmax: 200 },
  "POM": { E: 2.8, nu: 0.35, Re: 65, Rm: 67, cte: 110, k: 0.31, cp: 1470, rho: 1410, Tmax: 90 },
  "PEEK": { E: 3.7, nu: 0.38, Re: 95, Rm: 100, cte: 47, k: 0.25, cp: 1340, rho: 1300, Tmax: 250 },
  "PEI-9085": { E: 2.2, nu: 0.36, Re: 47, Rm: 70, cte: 65, k: 0.22, cp: 1100, rho: 1340, Tmax: 150 },     // FDM, weakest (Z) direction for Re
  "PEKK": { E: 3.0, nu: 0.38, Re: 60, Rm: 90, cte: 40, k: 0.25, cp: 1300, rho: 1280, Tmax: 150 },          // FDM, weakest (Z) direction for Re
  "PA11": { E: 1.6, nu: 0.40, Re: 46, Rm: 48, cte: 110, k: 0.28, cp: 1700, rho: 1040, Tmax: 80 },
  "RESIN-SLA": { E: 2.8, nu: 0.40, Re: 50, Rm: 65, cte: 90, k: 0.20, cp: 1400, rho: 1180, Tmax: 50 },      // standard rigid resin, post-cured ; creeps under sustained load
  "PMMA": { E: 3.2, nu: 0.37, Re: 70, Rm: 72, cte: 70, k: 0.19, cp: 1470, rho: 1190, Tmax: 80 },
  "PA12": { E: 1.8, nu: 0.40, Re: 48, Rm: 48, cte: 100, k: 0.30, cp: 1650, rho: 1010, Tmax: 80 },
  "PVC-U": { E: 3.0, nu: 0.38, Re: 50, Rm: 52, cte: 70, k: 0.16, cp: 1000, rho: 1400, Tmax: 60 },
  "SILICONE": { E: 0.005, nu: 0.48, Re: null, Rm: 8, cte: 250, k: 0.20, cp: 1250, rho: 1150, Tmax: 200 },
  "FR4": { E: 22, nu: 0.15, Re: 310, Rm: 310, cte: 15, k: 0.30, cp: 1100, rho: 1850, Tmax: 130 },         // in-plane E and cte, through-plane k, Tmax = Tg
  "FR4-CTI600": { E: 22, nu: 0.15, Re: 310, Rm: 310, cte: 15, k: 0.30, cp: 1100, rho: 1850, Tmax: 130 },
  "NOMEX-410": { E: 3.0, nu: 0.30, Re: 80, Rm: 100, cte: 20, k: 0.14, cp: 1300, rho: 960, Tmax: 220 },
  "PET-FILM": { E: 4.5, nu: 0.38, Re: 100, Rm: 170, cte: 20, k: 0.15, cp: 1200, rho: 1390, Tmax: 130 },
  "PI-FILM": { E: 2.5, nu: 0.34, Re: 69, Rm: 230, cte: 20, k: 0.12, cp: 1090, rho: 1420, Tmax: 240 },
  "THERMAL-PAD": { E: 0.001, nu: 0.45, Re: 0.2, Rm: 0.3, cte: 200, k: 3.0, cp: 1000, rho: 2500, Tmax: 150 },
  "GAP-FILLER": { E: 0.001, nu: 0.45, Re: 0.2, Rm: 0.3, cte: 150, k: 2.5, cp: 1000, rho: 2800, Tmax: 150 },
  "EPOXY": { E: 8.0, nu: 0.30, Re: 60, Rm: 60, cte: 35, k: 0.80, cp: 1000, rho: 1800, Tmax: 130 },
  "LI-ION-CELL": { E: 1.0, nu: 0.30, Re: 50, Rm: 50, cte: 20, k: 3.0, cp: 1000, rho: 2650, Tmax: 60 },      // homogenised : radial conductivity of a jelly roll, the usual upper temperature of use
  "GENERIC-COMPONENT": { E: 15, nu: 0.30, Re: 100, Rm: 100, cte: 20, k: 0.70, cp: 900, rho: 1600, Tmax: 125 },
};

/** Engineering properties of a material id of materials.js (null when unknown). G is derived: E / (2 (1 + nu)). */
export function props(materialId) {
  const id = TABLE[materialId] ? materialId : String(materialId || "").toUpperCase();
  const t = TABLE[id];
  if (!t) return null;
  const m = material(id) || {};
  return { id, name: m.name || id, cls: m.cls || null, conductive: !!m.conductive, fatigue: null, rhoE: null, alphaE: null, Tmax: null, ...t,
    G: Number((t.E / (2 * (1 + t.nu))).toPrecision(4)), typical: true, note: PROPS_NOTE };
}
export const PROP_IDS = Object.keys(TABLE);

/* ---------- fluids: values at 20 °C and 1 atm, with at(T °C) where the variation matters ---------- */
const K0 = 273.15;
function state(id, name, T, rho, mu, k, cp, beta) {
  return { id, name, T, rho, mu, k, cp, nu: mu / rho, alpha: k / (rho * cp), Pr: mu * cp / k, beta };
}
const AT = {
  /* Ideal gas at 101 325 Pa, Sutherland law for mu and k (White, Fluid Mechanics, chap. 1). */
  air: (T) => {
    const Tk = T + K0, r = (Tk / K0) ** 1.5;
    return state("air", "Air (1 atm)", T, 352.98 / Tk, 1.716e-5 * r * (K0 + 110.4) / (Tk + 110.4), 0.02364 * r * (K0 + 194) / (Tk + 194), 1007, 1 / Tk);
  },
  /* Water: Kell-type density, Vogel viscosity mu = 2.414e-5 x 10^(247.8 / (T_K - 140)), quadratic k (0..100 °C). */
  water: (T) => {
    const rho = 1000 * (1 - (T + 288.9414) / (508929.2 * (T + 68.12963)) * (T - 3.9863) ** 2);
    return state("water", "Eau", T, rho, 2.414e-5 * 10 ** (247.8 / (T + K0 - 140)), 0.561 + 2.0175e-3 * T - 8.375e-6 * T * T, 4182, 2.07e-4 + 1.0e-5 * (T - 20));
  },
  /* Ethylene glycol 50 % vol in water (ASHRAE Fundamentals tables), Arrhenius viscosity fitted on 20 and 80 °C. */
  glycol50: (T) => state("glycol50", "Eau-glycol 50 % (éthylène glycol)", T, 1071 - 0.65 * (T - 20), 3.94e-3 * Math.exp(2349 * (1 / (T + K0) - 1 / 293.15)),
    0.380 + 5e-4 * (T - 20), 3283 + 3.8 * (T - 20), 5.7e-4),
  /* Mineral oil ISO VG 32 (32 cSt at 40 °C, 5.4 cSt at 100 °C): Walther / ASTM D341 viscosity-temperature law. */
  oil32: (T) => {
    const rho = 870 - 0.65 * (T - 20), cSt = 10 ** (10 ** (9.53038 - 3.7464 * Math.log10(T + K0))) - 0.7;
    return state("oil32", "Huile ISO VG 32", T, rho, cSt * 1e-6 * rho, 0.133 - 7e-5 * (T - 20), 1880 + 3.6 * (T - 20), 7.0e-4);
  },
};
const RANGE = { air: [-50, 300], water: [0, 100], glycol50: [-30, 110], oil32: [-10, 120] };

/** FLUIDS[id] = { id, name, rho kg/m3, mu Pa.s, k W/m.K, cp J/kg.K, Pr, nu m2/s, alpha m2/s, beta 1/K (at 20 °C), range [Tmin, Tmax], at(T °C) }. */
export const FLUIDS = Object.fromEntries(Object.keys(AT).map((id) => [id, { ...AT[id](20), range: RANGE[id],
  at: (T) => AT[id](Math.min(RANGE[id][1], Math.max(RANGE[id][0], Number.isFinite(T) ? T : 20))) }]));
export const FLUID_OPTIONS = [...Object.values(FLUIDS).map((f) => ({ value: f.id, label: f.name })), { value: "custom", label: "Autre fluide (ρ et μ saisis)" }];
