/* DynamiteOrbit — BM 8s8p : what the closed module asks of the screws of its lids, and of its heat (JP, 22 novembre 2026, la reprise du
   projet BM : « effort sur la pile et tenue des vis, échauffement du module fermé »). Pure : numbers, and the calculations kept in the project.
   - The screws : the four of each ring carry what the lid takes (lidForces) ; they hold in the polycarbonate by the thread they formed — the
     model « plastic_screw » (Engineers Edge), the hole of the EVO PT recommendation (0.85 d1, read) standing for the pitch diameter, the
     engaged length the recommendation asks at least (2 d1, read), the lobe of the casing as the boss.
   - The heat : the sources the tool can count — the cells (the AC resistance of their sheet, ≤ 8 mΩ at 1 kHz : a LOWER bound of their DC
     resistance), the planar joints and the pads of the top lid (Holm : an UPPER bound), the return busbar — against the casing in still air,
     the cells as the thermal mass (model « lumped_mass », medium « LI-ION-CELL »). Then the current the closed module carries for ever. */

import { run, sessionDefaults } from "../analysis/physics/index.js";
import { mediumProps } from "../analysis/physics/media.js";
import { cell } from "../cad/elec_library.js";
import { lidForces } from "./demo_bm_lid.js";
import { caseSection, RETURN } from "./demo_bm_case.js";

const C = cell("21700-P45B"), N_CELLS = 64, JOINTS = 9, H_AIR = 10, TA = 40;
const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v, d = 3) => String(Number(v.toPrecision(d))).replace(".", ",");

/** The screws of the lids : EVO PT 40 (d1 = 4 mm) in the lobes of the casing. → { d, Dp, L, Db, perScrew, bottom } */
export function lidScrews() {
  const S = caseSection(), F = lidForces();
  return { d: 4, Dp: 3.4, L: 8, Db: r3(2 * S.R), perScrew: F.perScrew, bottom: F.joint / 4 };
}
/** The pull-out of the screws, kept in the project : the worst ring (the top one), its load per screw. */
export function screwHolding() {
  const s = lidScrews(), inputs = { ...sessionDefaults("plastic_screw"), mat: "PC", d: s.d, Dp: s.Dp, L: s.L, Db: s.Db, F: s.perScrew, sf: 3 }, r = run("plastic_screw", inputs);
  return { id: "phy-bm-screws", name: `Vis des couvercles dans le boîtier — ${s.perScrew} N par vis`, model: "plastic_screw", part: "BM-CASING", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T14:00:00.000Z",
    why: `L'anneau du couvercle du haut prend ${lidForces().total} N (ressorts de la pile et des deux plots, lidForces) et les passe au boîtier par 4 vis EVO PT 40 : ${s.perScrew} N par vis ; celui du fond, ${s.bottom} N par vis. Trou de 3,4 mm (0,85 d1, recommandation lue) pour le diamètre sur flancs, prise de 8 mm (2 d1, le minimum recommandé), le lobe du boîtier (Ø${fr(s.Db)} mm) pour le bossage. Coefficient de 3 : le PC flue sous une charge tenue, et le module chauffe.` };
}

/** The heat of the closed module at the current I (A). L : the length of the casing (mm). → { I, sources [{ id, label, W }], P, k (Ω : P = k I²), A (cm²), m (g) } */
export function moduleHeat(I, L) {
  const S = caseSection(), Ic = I / 8, F = lidForces(I), rho = mediumProps("CU-C110").rhoE_n * 1e-9;
  const sources = [
    { id: "cells", label: `${N_CELLS} cellules — ${fr(Ic)} A chacune, ${C.rAc} mΩ (résistance AC de la fiche : une borne basse)`, W: N_CELLS * Ic * Ic * C.rAc * 1e-3 },
    { id: "joints", label: `${JOINTS} joints plans — borne − / CORE 1, 7 entre deux CORE, CORE 8 / borne + (borne haute de Holm à ${F.joint} N)`, W: JOINTS * F.jointR.R * I * I },
    { id: "pads", label: `Deux plots du couvercle du haut (borne haute de Holm à ${F.padA} N)`, W: (F.padAR.R + F.padBR.R) * I * I },
    { id: "return", label: `Busbar de retour ${RETURN.w} × ${RETURN.t} × ${RETURN.L} mm (cuivre à 20 °C)`, W: rho * (RETURN.L * 1e-3) / (RETURN.w * RETURN.t * 1e-6) * I * I },
  ];
  const P = sources.reduce((s, x) => s + x.W, 0), w = S.outer.x1 - S.outer.x0, h = S.outer.z1 - S.outer.z0;
  return { I, sources, P, k: I > 0 ? P / (I * I) : 0, A: r3((2 * (w * h + w * L + h * L)) / 100), m: N_CELLS * C.mass[1] };
}
/** The current the closed module carries for ever : the heat it gives equals what the casing loses at the limit of the cells. */
export function sustainedCurrent(L, Tmax = C.skinDis[1], Ta = TA, h = H_AIR) {
  const ref = moduleHeat(8 * C.discharge[1], L), Pmax = h * ref.A * 1e-4 * (Tmax - Ta);
  return { I: Math.sqrt(Pmax / ref.k), Pmax };
}
const heatInputs = (H, time) => ({ ...sessionDefaults("lumped_mass"), mat: "LI-ION-CELL", P: r3(H.P), Ta: TA, time: Math.round(time), Tmax: C.skinDis[1], m: H.m, A: H.A, h: H_AIR });
/** The two calculations of the heat, kept in the project : the module at the full current of its cells, for one discharge ; and at the current
    it carries for ever (rounded down to 5 A), for two hours. */
export function heatCalcs(L) {
  const full = moduleHeat(8 * C.discharge[1], L), tFull = (C.capacity[1] / C.discharge[1]) * 3600, sus = sustainedCurrent(L), Is = Math.floor(sus.I / 5) * 5, low = moduleHeat(Is, L);
  const share = (H) => H.sources.map((x) => `${x.label} : ${fr(x.W)} W`).join(" ; ");
  const kept = (id, name, H, time, why) => { const r = run("lumped_mass", heatInputs(H, time)); return { id, name, model: "lumped_mass", part: "BM-CASING", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T14:00:00.000Z", why }; };
  return [
    kept("phy-bm-heat", `Module fermé — ${full.I} A, une décharge (${Math.round(tFull / 60)} min)`, full, tFull,
      `Ce qui chauffe à ${full.I} A (${C.discharge[1]} A par cellule, le plus que la fiche permet) : ${share(full)}. Total ${fr(full.P)} W, compté au plus bas pour les cellules (leur résistance en courant continu est plus forte que la valeur AC de la fiche). Masse : les ${N_CELLS} cellules seules (${full.m} g) ; surface : le boîtier dehors (${fr(full.A)} cm²), dans l'air calme (h = ${H_AIR} W/m²·K), à ${TA} °C. Limite : ${C.skinDis[1]} °C, la surface de la cellule en décharge (fiche p. 3). Optimiste : l'air enfermé et la paroi de PC ajoutent une résistance que le modèle ne compte pas.`),
    kept("phy-bm-heat-cont", `Module fermé — ${Is} A en continu`, low, 7200,
      `Le courant que le module fermé tient pour toujours dans l'air calme à ${TA} °C : ${fr(sus.I)} A, arrondi à ${Is} A (${fr(Is / 8)} A par cellule) — ${fr(sus.Pmax)} W, ce que le boîtier perd quand les cellules sont à ${C.skinDis[1]} °C. Au-delà, le BMS doit limiter la durée ou le courant (état « dératé »). Avec la vraie résistance des cellules, plus forte, ce courant est plus bas : à mesurer.`),
  ];
}
