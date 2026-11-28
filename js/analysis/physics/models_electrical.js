/* DynamiteOrbit.ai — Physique, electrical: busbar / conductor (resistance, voltage drop, Joule loss, temperature rise),
   PCB trace ampacity (IPC-2221), short-time adiabatic heating (I2t, Onderdonk). Inputs in mm, µm, A, nΩ.m, °C. */

import { SIGMA_SB, n, sheet, num, opt, out, bisect, tempCheck, MAT, GEO, CRIT } from "./models_core.js";

const CUR = "Courant et températures";
const condInputs = () => [num("rho20", "Résistivité à 20 °C", "nΩ·m", 17.24, 1, 2000, 0.1, MAT), num("alpha", "Coefficient de température α₂₀", "1/K", 0.00393, 0, 0.01, 0.0001, MAT)];

/* ---------- busbar or conductor ---------- */
const busbar = { id: "busbar", domain: "electrical", sketch: "busbar", title: "Busbar: resistance, voltage drop, temperature rise", fr: "Barre conductrice (busbar) : résistance, chute de tension, échauffement", question: "La barre conductrice chauffe-t-elle trop à ce courant ?",
  inputs: [num("w", "Largeur w (côté vertical, barre sur chant)", "mm", 20, 0.1, 500, 0.5, GEO), num("t", "Épaisseur t", "mm", 3, 0.05, 100, 0.1, GEO), num("L", "Longueur L", "mm", 200, 1, 1e5, 5, GEO),
    num("I", "Courant permanent (DC ou efficace)", "A", 100, 0, 1e5, 5, CUR), num("Ta", "Température ambiante autour de la barre", "°C", 40, -60, 200, 1, CUR),
    num("eps", "Émissivité (cuivre nu oxydé 0,4 ; étamé 0,1 ; peint ou gainé 0,9)", "", 0.4, 0, 1, 0.05, CUR), num("hc", "Coefficient de convection imposé (0 = calculé)", "W/m²·K", 0, 0, 1000, 1, CUR), ...condInputs(),
    num("Tmax", "Température admissible de la barre", "°C", 90, -40, 500, 5, CRIT), num("Jmax", "Densité de courant repère", "A/mm²", 2.5, 0.1, 50, 0.1, CRIT)],
  outputs: [out("T", "Température de la barre", "°C"), out("dT", "Échauffement", "K"), out("J", "Densité de courant", "A/mm²"), out("dU", "Chute de tension", "mV"), out("P", "Pertes Joule", "W"),
    out("R", "Résistance à chaud", "µΩ"), out("R20", "Résistance à 20 °C", "µΩ"), out("h", "Coefficient de convection", "W/m²·K")],
  assumptions: ["Résistance R = ρ₂₀ [1 + α (T − 20)] L / (w t), courant uniforme dans la section (DC, ou 50 / 60 Hz avec t < 8 mm pour le cuivre : pas d'effet de peau).",
    "Bilan en régime permanent : I² R = h A (T − Ta) + ε σ A (T⁴ − Ta⁴), avec A = 2 (w + t) L (les extrémités n'évacuent rien).",
    "Convection naturelle de l'air sur une plaque verticale, formule simplifiée h = 1,42 (ΔT / w)^¼ (régime laminaire), sauf si h est imposé.",
    "Barre seule, à l'air libre dans l'ambiante indiquée : dans un coffret fermé, prendre la température interne du coffret ; des barres voisines ou des connexions chaudes ajoutent de l'échauffement.",
    "Les résistances de contact des connexions vissées ne sont pas comprises."],
  validity: "Barre rectangulaire isolée en convection naturelle laminaire ; résultat à ± 20 % — pour une barre critique, vérifier par un essai d'échauffement.",
  reference: "Incropera, Fundamentals of Heat and Mass Transfer — chap. 1 (bilan d'énergie) ; Holman, Heat Transfer — table 7-2 (convection naturelle simplifiée de l'air) ; Copper Development Association, Copper for Busbars",
  fill: { L: "L", w: "b", t: "h", I: "I_bus", eps: "eps_bus", rho20: "rhoE_n", alpha: "alphaE" },
  compute(i) {
    const S = sheet(), w = i.w * 1e-3, t = i.t * 1e-3, L = i.L * 1e-3, Ac = w * t, As = 2 * (w + t) * L, rho20 = i.rho20 * 1e-9, Ta = i.Ta, J = i.I / (i.w * i.t);
    const R = (T) => rho20 * (1 + i.alpha * (T - 20)) * L / Ac, h = (dT) => (i.hc > 0 ? i.hc : 1.42 * (dT / w) ** 0.25);
    const loss = (dT) => h(dT) * As * dT + i.eps * SIGMA_SB * As * ((Ta + dT + 273.15) ** 4 - (Ta + 273.15) ** 4);
    const dT = i.I > 0 ? bisect((x) => loss(x) - i.I * i.I * R(Ta + x), 1e-6, 3000) : 0, T = Ta + dT, Rt = R(T), P = i.I * i.I * Rt, R20 = R(20);
    S.step(`Section : A = w t = ${n(i.w)} × ${n(i.t)} = ${n(i.w * i.t)} mm² ; densité de courant J = I / A = ${n(J)} A/mm².`);
    S.step(`Résistance à 20 °C : R₂₀ = ρ₂₀ L / A = ${n(rho20)} × ${n(L)} / ${n(Ac)} = ${n(R20 * 1e6)} µΩ.`);
    S.step(`Bilan thermique I² R(T) = h A (T − Ta) + ε σ A (T⁴ − Ta⁴), surface A = 2 (w + t) L = ${n(As * 1e4)} cm², résolu par itération : T = ${n(T)} °C (ΔT = ${n(dT)} K), h = ${n(h(Math.max(dT, 1e-6)))} W/m²·K.`);
    S.step(`Résistance à chaud : R = R₂₀ [1 + α (T − 20)] = ${n(R20 * 1e6)} × [1 + ${n(i.alpha)} × (${n(T)} − 20)] = ${n(Rt * 1e6)} µΩ.`);
    S.step(`Chute de tension : ΔU = R I = ${n(Rt * i.I * 1e3)} mV ; pertes Joule : P = R I² = ${n(P)} W, dont ${n(i.eps * SIGMA_SB * As * ((T + 273.15) ** 4 - (Ta + 273.15) ** 4))} W par rayonnement.`);
    if (dT >= 2999) S.warn("Aucun équilibre thermique : la barre s'emballe (la résistance croît plus vite que le refroidissement). Augmenter la section.");
    if (i.t > 8) S.warn("Épaisseur supérieure à 8 mm : en courant alternatif 50 / 60 Hz l'effet de peau augmente la résistance (non compris).");
    tempCheck(S, "Température de la barre vs température admissible", T, i.Tmax, Ta);
    S.check("Densité de courant vs densité repère", J, i.Jmax, "A/mm²", { soft: true, note: J > i.Jmax ? "Au-dessus du repère de dimensionnement : c'est l'échauffement calculé qui décide." : "" });
    return S.set({ T, dT, J, dU: Rt * i.I * 1e3, P, R: Rt * 1e6, R20: R20 * 1e6, h: h(Math.max(dT, 1e-6)) });
  } };

/* ---------- PCB trace, IPC-2221: I = k dT^0.44 A^0.725 (A in mil2) ---------- */
const MIL2 = 1 / (0.0254 * 0.0254);    // mil2 per mm2
const trace = { id: "pcb_trace", domain: "electrical", sketch: "trace", title: "PCB trace: current capacity (IPC-2221)", fr: "Piste de PCB : courant admissible (IPC-2221)", question: "Cette piste de circuit imprimé supporte-t-elle le courant ?",
  inputs: [num("I", "Courant permanent", "A", 2, 0, 100, 0.1, CUR), num("Ta", "Température ambiante de la carte", "°C", 40, -60, 150, 1, CUR), num("dTmax", "Échauffement admissible de la piste", "K", 10, 1, 100, 1, CRIT),
    num("w", "Largeur de la piste", "mm", 1, 0.05, 50, 0.05, GEO), num("tcu", "Épaisseur de cuivre (35 µm = 1 oz)", "µm", 35, 5, 500, 5, GEO), num("L", "Longueur de la piste", "mm", 50, 0.1, 5000, 1, GEO),
    opt("layer", "Couche", "external", [{ value: "external", label: "Externe (k = 0,048)" }, { value: "internal", label: "Interne (k = 0,024)" }], GEO)],
  outputs: [out("I_max", "Courant admissible à l'échauffement admissible", "A"), out("dT", "Échauffement au courant demandé", "K"), out("w_min", "Largeur minimale pour ce courant", "mm"), out("T", "Température de la piste", "°C"),
    out("R", "Résistance de la piste à chaud", "mΩ"), out("dU", "Chute de tension", "mV"), out("P", "Pertes Joule", "W"), out("area", "Section de cuivre", "mm²")],
  assumptions: ["IPC-2221 : I = k ΔT^0,44 A^0,725 avec A en mil² ; k = 0,048 (couche externe), 0,024 (couche interne).", "Piste isolée, sans plan de cuivre voisin ni vias thermiques : un plan proche améliore nettement le refroidissement (résultat prudent).",
    "Épaisseur de cuivre finie nominale (les couches externes reçoivent en plus le cuivre de métallisation).", "Résistance calculée avec le cuivre à la température de la piste : ρ = 17,24 nΩ·m × [1 + 0,00393 (T − 20)]."],
  validity: "Abaques IPC-2221 : courant ≤ 35 A, largeur ≤ 10 mm (400 mil), cuivre 17,5 à 105 µm (0,5 à 3 oz), échauffement 10 à 100 K. L'IPC-2152, plus récente, donne des valeurs moins sévères pour les couches internes.",
  reference: "IPC-2221 (Generic Standard on Printed Board Design), § 6.2 — abaques de courant admissible",
  fill: {},
  compute(i) {
    const S = sheet(), k = i.layer === "internal" ? 0.024 : 0.048, area = i.w * i.tcu * 1e-3, mil2 = area * MIL2;
    const I_max = k * i.dTmax ** 0.44 * mil2 ** 0.725, dT = i.I > 0 ? (i.I / (k * mil2 ** 0.725)) ** (1 / 0.44) : 0, w_min = (i.I / (k * i.dTmax ** 0.44)) ** (1 / 0.725) / MIL2 / (i.tcu * 1e-3);
    const T = i.Ta + dT, rho = 1.724e-8 * (1 + 0.00393 * (Math.min(T, 1000) - 20)), R = rho * (i.L * 1e-3) / (area * 1e-6), P = R * i.I * i.I;
    S.step(`Section de cuivre : A = w × t = ${n(i.w)} × ${n(i.tcu * 1e-3)} = ${n(area)} mm² = ${n(mil2)} mil² (1 mm² = 1550 mil²).`);
    S.step(`Courant admissible pour ΔT = ${n(i.dTmax)} K : I = k ΔT^0,44 A^0,725 = ${n(k)} × ${n(i.dTmax)}^0,44 × ${n(mil2)}^0,725 = ${n(I_max)} A (IPC-2221, couche ${i.layer === "internal" ? "interne" : "externe"}).`);
    S.step(`Échauffement au courant demandé : ΔT = [I / (k A^0,725)]^(1/0,44) = [${n(i.I)} / (${n(k)} × ${n(mil2 ** 0.725)})]^2,273 = ${n(dT)} K → piste à ${n(T)} °C.`);
    S.step(`Largeur minimale pour ${n(i.I)} A à ΔT = ${n(i.dTmax)} K : A = [I / (k ΔT^0,44)]^(1/0,725) → w = ${n(w_min)} mm.`);
    S.step(`Résistance à chaud : R = ρ L / A = ${n(rho)} × ${n(i.L * 1e-3)} / ${n(area * 1e-6)} = ${n(R * 1e3)} mΩ ; chute de tension ${n(R * i.I * 1e3)} mV ; pertes ${n(P)} W.`);
    if (i.I > 35 || i.w > 10.16 || i.tcu < 17 || i.tcu > 106 || i.dTmax < 10) S.warn("Hors du domaine des abaques IPC-2221 (courant ≤ 35 A, largeur ≤ 10 mm, cuivre 17,5 à 105 µm, ΔT ≥ 10 K) : valeur extrapolée.");
    if (dT > 100) S.warn(`Échauffement calculé de ${n(dT, 3)} K, au-delà de 100 K : hors abaque, la piste risque de se décoller ou de brûler la carte.`);
    S.check("Courant demandé vs courant admissible (IPC-2221)", i.I, I_max, "A");
    return S.set({ I_max, dT, w_min, T, R: R * 1e3, dU: R * i.I * 1e3, P, area });
  } };

/* ---------- short-time adiabatic heating (I2t) ---------- */
const pulse = { id: "adiabatic_pulse", domain: "electrical", sketch: "pulse", title: "Short-time adiabatic heating (I²t, Onderdonk)", fr: "Échauffement adiabatique de courte durée (I²t, Onderdonk)", question: "Le conducteur survit-il à ce court-circuit ou à cette impulsion de courant ?",
  inputs: [num("I", "Courant pendant l'impulsion (efficace)", "A", 1000, 0, 1e7, 50, CUR), num("time", "Durée", "s", 1, 1e-6, 100, 0.1, CUR), num("Ti", "Température initiale du conducteur", "°C", 40, -60, 500, 5, CUR),
    num("A", "Section du conducteur", "mm²", 10, 0.0001, 1e5, 0.5, GEO), ...condInputs(), num("rho", "Masse volumique", "kg/m³", 8890, 100, 25000, 10, MAT), num("cp", "Capacité thermique massique cp", "J/kg·K", 385, 50, 5000, 5, MAT),
    num("Tmelt", "Température de fusion", "°C", 1083, 100, 4000, 10, MAT), num("Tmax", "Température finale admissible (isolant, brasure)", "°C", 250, 0, 4000, 10, CRIT)],
  outputs: [out("Tf", "Température finale", "°C"), out("dT", "Échauffement", "K"), out("I_adm", "Courant admissible pour cette durée", "A"), out("t_adm", "Durée admissible à ce courant", "s"), out("A_min", "Section minimale", "mm²"),
    out("I_fuse", "Courant de fusion pour cette durée", "A"), out("i2t", "Intégrale de Joule I²t", "A²·s"), out("Kc", "Constante du matériau K", "A·√s/mm²")],
  assumptions: ["Échauffement adiabatique : aucune chaleur ne quitte le conducteur pendant l'impulsion (cas le plus sévère).",
    "Résistivité croissante avec la température : (I / A)² t = K² ln[(Tf + β) / (Ti + β)], avec β = 1 / α₂₀ − 20 et K² = ρ cp / (ρ₂₀ α₂₀) ; pour le cuivre β = 234,5 °C et K ≈ 226 A·√s/mm² (IEC 60949).",
    "C'est l'équation d'Onderdonk : avec Tf = température de fusion elle donne le courant de fusion d'un fil ou d'une piste.", "Courant efficace constant pendant la durée ; cp et masse volumique constants.",
    "Limites usuelles : 160 °C isolant PVC, 250 °C XLPE / silicone, 200 à 220 °C brasure tendre, 1083 °C fusion du cuivre."],
  validity: "Durée courte devant la constante de temps thermique du conducteur (typiquement ≤ 5 s) ; au-delà le conducteur se refroidit pendant l'impulsion et le résultat est pessimiste.",
  reference: "Onderdonk (1928), équation de fusion des conducteurs ; IEC 60949 (courants de court-circuit admissibles, échauffement adiabatique)",
  fill: { A: "A_sec", rho20: "rhoE_n", alpha: "alphaE", rho: "rho", cp: "cp" },
  compute(i) {
    const S = sheet(), B = 1 / Math.max(i.alpha, 1e-6) - 20, K2 = i.rho * i.cp / (i.rho20 * 1e-9 * Math.max(i.alpha, 1e-6)), K = Math.sqrt(K2) * 1e-6, J = i.I / i.A;     // K in A.sqrt(s)/mm2
    const x = Math.min(40, J * J * i.time / (K * K)), Tf = (i.Ti + B) * Math.exp(x) - B, ln = (T) => Math.log(Math.max(1 + 1e-9, (T + B) / (i.Ti + B)));
    const I_adm = i.A * K * Math.sqrt(ln(i.Tmax) / i.time), t_adm = i.I > 0 ? Math.min(1e9, (i.A * K / i.I) ** 2 * ln(i.Tmax)) : 1e9, I_fuse = i.A * K * Math.sqrt(ln(i.Tmelt) / i.time), A_min = i.I * Math.sqrt(i.time) / (K * Math.sqrt(ln(i.Tmax)));
    S.step(`Constantes du matériau : β = 1 / α₂₀ − 20 = ${n(B)} °C ; K = √(ρ cp / (ρ₂₀ α₂₀)) = √(${n(i.rho)} × ${n(i.cp)} / (${n(i.rho20 * 1e-9)} × ${n(i.alpha)})) = ${n(K)} A·√s/mm² (IEC 60949 : 226 pour le cuivre).`);
    S.step(`Densité de courant : J = I / A = ${n(i.I)} / ${n(i.A)} = ${n(J)} A/mm² ; intégrale de Joule I² t = ${n(i.I * i.I * i.time)} A²·s.`);
    S.step(`Température finale : Tf = (Ti + β) × exp(J² t / K²) − β = (${n(i.Ti)} + ${n(B)}) × exp(${n(J)}² × ${n(i.time)} / ${n(K)}²) − ${n(B)} = ${n(Tf)} °C (échauffement ${n(Tf - i.Ti)} K).`);
    S.step(`Courant admissible pendant ${n(i.time)} s jusqu'à ${n(i.Tmax)} °C : I = A K √(ln[(Tmax + β) / (Ti + β)] / t) = ${n(I_adm)} A ; durée admissible à ${n(i.I)} A : ${n(t_adm)} s ; section minimale : ${n(A_min)} mm².`);
    S.step(`Courant de fusion (Onderdonk, Tf = ${n(i.Tmelt)} °C) pour cette durée : ${n(I_fuse)} A.`);
    if (Tf >= i.Tmelt) S.warn(`La température calculée atteint la fusion (${n(i.Tmelt)} °C) : le conducteur fond pendant l'impulsion, comme un fusible.`);
    if (i.time > 5) S.warn("Durée supérieure à 5 s : l'hypothèse adiabatique devient pessimiste (le conducteur évacue de la chaleur pendant l'impulsion).");
    tempCheck(S, "Température finale vs température admissible", Tf, i.Tmax, i.Ti);
    return S.set({ Tf, dT: Tf - i.Ti, I_adm, t_adm, A_min, I_fuse, i2t: i.I * i.I * i.time, Kc: K });
  } };

export const ELECTRICAL = [busbar, trace, pulse];
