/* DesignWizard.ai — Physique, thermal: 1-D conduction through a stack, junction temperature chain, plate-fin heat
   sink in natural and forced convection, lumped thermal mass. Inputs in mm, mm2, cm2, W, °C, K/W, g; SI inside. */

import { G0, SIGMA_SB, n, sheet, num, out, bisect, tempCheck, GEO, CRIT } from "./models_core.js";
import { FLUIDS } from "./props.js";

const INCROPERA = "Incropera, Fundamentals of Heat and Mass Transfer";
const HEAT = "Puissance et températures", LAYERS = "Couches", FINS = "Ailettes";

/* ---------- 1-D conduction through a wall or a stack ---------- */
const wall = { id: "conduction_stack", domain: "thermal", sketch: "wall", title: "1-D conduction through a wall or a stack", fr: "Conduction 1-D à travers une paroi ou un empilement", question: "Combien de degrés perd-on à travers cette paroi, cette interface thermique ?",
  inputs: [num("A", "Surface de passage de la chaleur", "mm²", 400, 0.01, 1e8, 10, GEO), num("P", "Puissance à évacuer", "W", 20, 0, 1e6, 1, HEAT), num("Tc", "Température du côté froid", "°C", 40, -273, 2000, 1, HEAT),
    num("Tmax", "Température admissible du côté chaud", "°C", 100, -273, 3000, 1, CRIT),
    num("t1", "Couche 1 : épaisseur", "mm", 3, 0, 1000, 0.1, LAYERS), num("k1", "Couche 1 : conductivité k", "W/m·K", 167, 0.001, 2500, 1, LAYERS),
    num("t2", "Couche 2 : épaisseur (0 = absente)", "mm", 0, 0, 1000, 0.1, LAYERS), num("k2", "Couche 2 : conductivité k", "W/m·K", 0.3, 0.001, 2500, 0.1, LAYERS),
    num("t3", "Couche 3 : épaisseur (0 = absente)", "mm", 0, 0, 1000, 0.1, LAYERS), num("k3", "Couche 3 : conductivité k", "W/m·K", 16, 0.001, 2500, 0.1, LAYERS),
    num("tim_t", "Interface thermique (TIM) : épaisseur", "mm", 0.1, 0, 20, 0.01, LAYERS), num("tim_k", "Interface thermique (TIM) : conductivité", "W/m·K", 3, 0.01, 100, 0.1, LAYERS),
    num("Rc", "Résistance de contact surfacique (0 = aucune)", "K·cm²/W", 0.2, 0, 100, 0.05, LAYERS)],
  outputs: [out("T_hot", "Température du côté chaud", "°C"), out("dT", "Écart de température", "K"), out("R_tot", "Résistance thermique totale", "K/W"), out("flux", "Densité de flux", "W/cm²"),
    out("R1", "Résistance de la couche 1", "K/W"), out("R2", "Résistance de la couche 2", "K/W"), out("R3", "Résistance de la couche 3", "K/W"), out("R_tim", "Résistance du TIM", "K/W"), out("R_contact", "Résistance de contact", "K/W")],
  assumptions: ["Flux de chaleur 1-D, uniforme sur toute la surface, en régime permanent ; conductivités constantes.", "Résistances en série : R = t / (k A) pour chaque couche, R = Rc″ / A pour un contact.",
    "La source couvre toute la surface : si elle est plus petite que la paroi, ajouter une résistance d'épanouissement (spreading).", "Contact sec métal / métal : 0,5 à 5 K·cm²/W selon la pression et l'état de surface ; avec pâte thermique : 0,1 à 0,3."],
  validity: "Paroi plane dont l'épaisseur est petite devant les dimensions de la surface (pas d'épanouissement latéral), sans source interne.",
  reference: `${INCROPERA} — chap. 3 (paroi plane composite, résistance de contact)`,
  fill: { t1: "h", k1: "k", A: "A_face" },
  compute(i) {
    const S = sheet(), A = i.A * 1e-6, R = (t, k) => (t > 0 ? t * 1e-3 / (k * A) : 0);
    const R1 = R(i.t1, i.k1), R2 = R(i.t2, i.k2), R3 = R(i.t3, i.k3), R_tim = R(i.tim_t, i.tim_k), R_contact = i.Rc * 1e-4 / A, R_tot = R1 + R2 + R3 + R_tim + R_contact;
    const dT = i.P * R_tot, T_hot = i.Tc + dT;
    [[i.t1, i.k1, R1, "Couche 1"], [i.t2, i.k2, R2, "Couche 2"], [i.t3, i.k3, R3, "Couche 3"], [i.tim_t, i.tim_k, R_tim, "Interface thermique"]].forEach(([t, k, r, name]) => {
      if (t > 0) S.step(`${name} : R = t / (k A) = ${n(t * 1e-3)} / (${n(k)} × ${n(A)}) = ${n(r)} K/W.`);
    });
    if (i.Rc > 0) S.step(`Contact : R = Rc″ / A = ${n(i.Rc * 1e-4)} / ${n(A)} = ${n(R_contact)} K/W.`);
    S.step(`Résistances en série : R totale = ${n(R_tot)} K/W (Incropera, chap. 3).`);
    S.step(`Écart de température : ΔT = P R = ${n(i.P)} × ${n(R_tot)} = ${n(dT)} K ; côté chaud : T = ${n(i.Tc)} + ${n(dT)} = ${n(T_hot)} °C ; densité de flux ${n(i.P / (i.A / 100))} W/cm².`);
    const tMax = Math.max(i.t1, i.t2, i.t3);
    if (tMax > Math.sqrt(i.A) / 2) S.warn("Épaisseur comparable aux dimensions de la surface : la chaleur s'épanouit latéralement, le modèle 1-D surestime l'écart de température.");
    tempCheck(S, "Température du côté chaud vs température admissible", T_hot, i.Tmax, i.Tc);
    return S.set({ T_hot, dT, R_tot, flux: i.P / (i.A / 100), R1, R2, R3, R_tim, R_contact });
  } };

/* ---------- junction temperature chain ---------- */
const junction = { id: "junction_temperature", domain: "thermal", sketch: "chain", title: "Component junction temperature (Rjc + Rcs + Rsa chain)", fr: "Température de jonction d'un composant (chaîne Rjc + Rcs + Rsa)", question: "Le composant de puissance reste-t-il sous sa température de jonction maximale ?",
  inputs: [num("P", "Puissance dissipée", "W", 10, 0, 1e5, 0.5, HEAT), num("Ta", "Température ambiante", "°C", 40, -60, 300, 1, HEAT),
    num("Rjc", "Rjc jonction → boîtier (data sheet)", "K/W", 1, 0, 1000, 0.1, "Résistances thermiques"), num("Rcs", "Rcs boîtier → dissipateur (interface)", "K/W", 0.5, 0, 1000, 0.1, "Résistances thermiques"),
    num("Rsa", "Rsa dissipateur → air", "K/W", 5, 0, 1000, 0.1, "Résistances thermiques"), num("Tjmax", "Température de jonction admissible", "°C", 125, -40, 400, 5, CRIT)],
  outputs: [out("Tj", "Température de jonction", "°C"), out("Tc", "Température du boîtier", "°C"), out("Ts", "Température du dissipateur", "°C"), out("R_tot", "Résistance totale", "K/W"),
    out("Rsa_max", "Rsa maximale pour tenir Tj admissible", "K/W"), out("P_max", "Puissance maximale à cette Rsa", "W")],
  assumptions: ["Régime permanent : Tj = Ta + P × (Rjc + Rcs + Rsa).", "Toute la puissance passe par le boîtier vers le dissipateur (pas de fuite par les broches ni par le PCB).",
    "Rjc lue dans la data sheet (valeur maximale) ; Rcs dépend de l'isolant et de la pâte (0,1 à 1 K/W pour un TO-220 / TO-247).", "Bonne pratique : garder 20 à 25 K sous la Tj maximale de la data sheet (derating)."],
  validity: "Un seul composant par dissipateur (sinon additionner les puissances pour Rsa) ; puissance moyenne constante — en impulsions, utiliser l'impédance thermique transitoire Zth.",
  reference: `${INCROPERA} — chap. 3 (circuits thermiques équivalents) ; data sheet du composant`,
  fill: {},
  compute(i) {
    const S = sheet(), R_tot = i.Rjc + i.Rcs + i.Rsa, Tj = i.Ta + i.P * R_tot, Ts = i.Ta + i.P * i.Rsa, Tc = Ts + i.P * i.Rcs;
    const Rsa_max = i.P > 0 ? (i.Tjmax - i.Ta) / i.P - i.Rjc - i.Rcs : 999, P_max = R_tot > 0 ? Math.max(0, (i.Tjmax - i.Ta) / R_tot) : 0;
    S.step(`Résistance totale : R = Rjc + Rcs + Rsa = ${n(i.Rjc)} + ${n(i.Rcs)} + ${n(i.Rsa)} = ${n(R_tot)} K/W.`);
    S.step(`Température de jonction : Tj = Ta + P R = ${n(i.Ta)} + ${n(i.P)} × ${n(R_tot)} = ${n(Tj)} °C.`);
    S.step(`Points intermédiaires : dissipateur Ts = Ta + P Rsa = ${n(Ts)} °C ; boîtier Tc = Ts + P Rcs = ${n(Tc)} °C.`);
    S.step(`Dimensionnement : Rsa maximale = (Tj adm − Ta) / P − Rjc − Rcs = ${n(Rsa_max)} K/W ; puissance maximale avec cette chaîne = (Tj adm − Ta) / R = ${n(P_max)} W.`);
    if (Rsa_max < 0) S.warn("Même avec un dissipateur parfait (Rsa = 0), la jonction dépasse la limite : réduire la puissance, Rjc ou Rcs.");
    tempCheck(S, "Température de jonction vs température admissible", Tj, i.Tjmax, i.Ta, { sf: 1.1 });
    return S.set({ Tj, Tc, Ts, R_tot, Rsa_max: Math.max(-999, Math.min(999, Rsa_max)), P_max });
  } };

/* ---------- plate-fin heat sink ---------- */
const finInputs = () => [num("W", "Largeur de la base (en travers des ailettes)", "mm", 100, 2, 2000, 1, FINS), num("Lf", "Longueur des ailettes (sens de l'air)", "mm", 100, 2, 2000, 1, FINS), num("H", "Hauteur des ailettes", "mm", 25, 1, 500, 1, FINS),
  num("tf", "Épaisseur d'une ailette", "mm", 2, 0.1, 50, 0.1, FINS), num("N", "Nombre d'ailettes", "", 10, 2, 400, 1, FINS), num("k", "Conductivité du dissipateur", "W/m·K", 209, 0.1, 2500, 1, FINS)];
function finGeometry(i, S) {
  const N = Math.max(2, Math.round(i.N)), W = i.W * 1e-3, L = i.Lf * 1e-3, H = i.H * 1e-3, tf = i.tf * 1e-3, Hc = H + tf / 2;
  let s = (W - N * tf) / (N - 1);
  if (s <= 1e-4) { s = 1e-4; S.warn("Les ailettes ne tiennent pas dans la largeur de la base : pas pris égal à 0,1 mm, résultat sans valeur. Réduire le nombre ou l'épaisseur des ailettes."); }
  S.step(`Pas libre entre ailettes : s = (W − N t) / (N − 1) = (${n(i.W)} − ${N} × ${n(i.tf)}) / ${N - 1} = ${n(s * 1e3)} mm ; surfaces : ailettes Af = 2 N Hc L = ${n(2 * N * Hc * L * 1e4)} cm² (Hc = H + t / 2), base libre Ab = (N − 1) s L = ${n((N - 1) * s * L * 1e4)} cm².`);
  return { N, W, L, H, tf, Hc, s, Af: 2 * N * Hc * L, Ab: (N - 1) * s * L };
}
const finEff = (h, k, g) => { const m = Math.sqrt(2 * h / (k * g.tf)), x = m * g.Hc; return x > 1e-9 ? Math.tanh(x) / x : 1; };

/** Natural convection between vertical isothermal plates (Bar-Cohen & Rohsenow). Returns { h, Nu, Ra, X, air }. */
export function channelNatural(dT, Ta, s, L) {
  const air = FLUIDS.air.at(Ta + dT / 2), Ra = G0 * air.beta * dT * s ** 3 / (air.nu * air.alpha), X = Ra * s / L;
  const Nu = 1 / Math.sqrt(576 / (X * X) + 2.87 / Math.sqrt(X));
  return { h: Nu * air.k / s, Nu, Ra, X, air };
}
const sinkNatural = { id: "heatsink_natural", domain: "thermal", sketch: "fins-natural", title: "Finned heat sink, natural convection", fr: "Dissipateur à ailettes en convection naturelle", question: "Ce dissipateur à ailettes verticales évacue-t-il la puissance sans ventilateur ?",
  inputs: [num("P", "Puissance à évacuer", "W", 20, 0, 1e5, 1, HEAT), num("Ta", "Température ambiante", "°C", 25, -40, 200, 1, HEAT), num("eps", "Émissivité de la surface (0 = sans rayonnement)", "", 0.8, 0, 1, 0.05, HEAT),
    num("Tmax", "Température admissible de la base", "°C", 80, -40, 500, 5, CRIT), ...finInputs()],
  outputs: [out("Ts", "Température de la base", "°C"), out("Rsa", "Résistance thermique dissipateur → air", "K/W"), out("dT", "Échauffement", "K"), out("h", "Coefficient de convection", "W/m²·K"), out("eta", "Rendement d'ailette", ""),
    out("s", "Pas libre entre ailettes", "mm"), out("s_opt", "Pas optimal", "mm"), out("Q_conv", "Puissance par convection", "W"), out("Q_rad", "Puissance par rayonnement", "W"), out("Ra_s", "Rayleigh de canal", "")],
  assumptions: ["Ailettes rectangulaires verticales, base verticale, air libre au repos ; base et ailettes supposées isothermes pour la corrélation.",
    "Canaux entre ailettes : corrélation de Bar-Cohen et Rohsenow pour plaques parallèles isothermes, Nu = [576 / (Ra s/L)² + 2,87 / (Ra s/L)^½]^−½ ; elle tend vers la plaque verticale isolée quand le pas est grand.",
    "Rendement d'ailette η = tanh(m Hc) / (m Hc), m = √(2 h / (k t)), Hc = H + t / 2.", "Rayonnement simplifié : seule l'enveloppe extérieure L × (W + 2 H) rayonne vers l'ambiante (les faces en regard se voient entre elles).",
    "Pas optimal (puissance maximale à volume donné) : s opt = 2,71 [g β ΔT / (α ν L)]^−¼. Propriétés de l'air à la température de film."],
  validity: "Écoulement laminaire (Rayleigh sur la hauteur < 10⁹), ailettes verticales. Ailettes horizontales ou base vers le bas : compter 30 à 50 % de résistance thermique en plus. Résistance d'épanouissement dans la base non comprise.",
  reference: `${INCROPERA} — chap. 9 (plaque verticale : Churchill-Chu ; canaux à plaques parallèles : Bar-Cohen & Rohsenow) et chap. 3 (ailettes)`,
  fill: { W: "b", Lf: "L", k: "k" },
  compute(i) {
    const S = sheet(), g = finGeometry(i, S), Ta = i.Ta, Arad = g.L * (g.W + 2 * g.H);
    const at = (dT) => { const c = channelNatural(dT, Ta, g.s, g.L), eta = finEff(c.h, i.k, g); return { ...c, eta, Qc: c.h * (eta * g.Af + g.Ab) * dT, Qr: i.eps * SIGMA_SB * Arad * ((Ta + dT + 273.15) ** 4 - (Ta + 273.15) ** 4) }; };
    const dT = i.P > 0 ? bisect((x) => { const r = at(x); return r.Qc + r.Qr - i.P; }, 1e-3, 1500) : 1e-3, r = at(dT), Ts = Ta + dT, air = r.air;
    const s_opt = 2.71 * (G0 * air.beta * dT / (air.alpha * air.nu * g.L)) ** -0.25, RaL = G0 * air.beta * dT * g.L ** 3 / (air.nu * air.alpha);
    const hPlate = (0.68 + 0.670 * RaL ** 0.25 / (1 + (0.492 / air.Pr) ** (9 / 16)) ** (4 / 9)) * air.k / g.L;
    S.step(`Résolution itérative du bilan P = Q convection + Q rayonnement : échauffement ΔT = ${n(dT)} K, base à ${n(Ts)} °C. Détail à cette température :`);
    S.step(`Air à la température de film ${n(Ta + dT / 2)} °C : k = ${n(air.k)} W/m·K, ν = ${n(air.nu)} m²/s, α = ${n(air.alpha)} m²/s, β = 1 / T = ${n(air.beta)} 1/K.`);
    S.step(`Rayleigh de canal : Ra_s = g β ΔT s³ / (ν α) = ${n(r.Ra)} ; Ra_s × s / L = ${n(r.X)} ; Nu_s = [576 / (Ra s/L)² + 2,87 / (Ra s/L)^½]^−½ = ${n(r.Nu)} → h = Nu k / s = ${n(r.h)} W/m²·K (Incropera, chap. 9).`);
    S.step(`Pour comparaison, plaque verticale isolée (Churchill-Chu, Ra_L = ${n(RaL)}) : h = ${n(hPlate)} W/m²·K.`);
    S.step(`Rendement d'ailette : m = √(2 h / (k t)) = ${n(Math.sqrt(2 * r.h / (i.k * g.tf)))} 1/m ; η = tanh(m Hc) / (m Hc) = ${n(r.eta)}.`);
    S.step(`Convection : Q = h (η Af + Ab) ΔT = ${n(r.h)} × (${n(r.eta)} × ${n(g.Af)} + ${n(g.Ab)}) × ${n(dT)} = ${n(r.Qc)} W ; rayonnement : Q = ε σ A (Ts⁴ − Ta⁴) = ${n(r.Qr)} W (A = ${n(Arad * 1e4)} cm²).`);
    S.step(`Résistance thermique : Rsa = ΔT / P = ${n(dT / i.P)} K/W ; pas optimal : s opt = 2,71 [g β ΔT / (α ν L)]^−¼ = ${n(s_opt * 1e3)} mm (pas actuel ${n(g.s * 1e3)} mm).`);
    if (g.s < 0.7 * s_opt) S.warn(`Ailettes trop serrées : pas de ${n(g.s * 1e3, 3)} mm pour un optimum de ${n(s_opt * 1e3, 3)} mm. L'air ne circule plus entre les ailettes : en retirer améliore le refroidissement.`);
    if (RaL > 1e9) S.warn("Rayleigh sur la hauteur > 10⁹ : couche limite turbulente, corrélation laminaire hors domaine.");
    if (dT > 150) S.warn("Échauffement supérieur à 150 K : hors du domaine d'usage d'un dissipateur à air libre, résultat indicatif.");
    tempCheck(S, "Température de la base vs température admissible", Ts, i.Tmax, Ta);
    return S.set({ Ts, Rsa: i.P > 0 ? dT / i.P : 0, dT, h: r.h, eta: r.eta, s: g.s * 1e3, s_opt: s_opt * 1e3, Q_conv: r.Qc, Q_rad: r.Qr, Ra_s: r.Ra });
  } };

const sinkForced = { id: "heatsink_forced", domain: "thermal", sketch: "fins-forced", title: "Finned heat sink, forced convection", fr: "Dissipateur à ailettes en convection forcée", question: "Avec ce débit d'air entre les ailettes, le dissipateur tient-il la température ?",
  inputs: [num("P", "Puissance à évacuer", "W", 50, 0, 1e6, 1, HEAT), num("Ta", "Température de l'air à l'entrée", "°C", 25, -40, 200, 1, HEAT), num("v", "Vitesse de l'air entre les ailettes", "m/s", 3, 0.05, 100, 0.1, HEAT),
    num("Tmax", "Température admissible de la base", "°C", 80, -40, 500, 5, CRIT), ...finInputs()],
  outputs: [out("Ts", "Température de la base", "°C"), out("Rsa", "Résistance thermique dissipateur → air", "K/W"), out("dT", "Échauffement de la base", "K"), out("h", "Coefficient de convection", "W/m²·K"), out("eta", "Rendement d'ailette", ""),
    out("ReL", "Reynolds sur la longueur", ""), out("dT_air", "Échauffement de l'air", "K"), out("flow", "Débit d'air entre les ailettes", "m³/h"), out("s", "Pas libre entre ailettes", "mm")],
  assumptions: ["Chaque face d'ailette est une plaque plane isotherme en écoulement parallèle : laminaire Nu = 0,664 Re^½ Pr^⅓ (Re < 5 × 10⁵), mixte Nu = (0,037 Re^0,8 − 871) Pr^⅓ au-delà.",
    "La vitesse est celle de l'air ENTRE les ailettes : avec un ventilateur non caréné, une partie du débit contourne le dissipateur (bypass).",
    "Échauffement de l'air ΔT air = P / (ṁ cp) ; la base est calculée par rapport à la température moyenne de l'air : Ts = Ta + ΔT air / 2 + P / (h (η Af + Ab)).",
    "Rendement d'ailette η = tanh(m Hc) / (m Hc). Rayonnement négligé. Propriétés de l'air à la température de film."],
  validity: "Couches limites séparées (épaisseur 5 L / √Re inférieure au demi-pas) ; sinon l'écoulement est un écoulement de canal établi et le résultat n'est qu'approché. Résistance d'épanouissement dans la base non comprise.",
  reference: `${INCROPERA} — chap. 7 (plaque plane en écoulement parallèle, éq. 7.30 et 7.38) et chap. 3 (ailettes)`,
  fill: { W: "b", Lf: "L", k: "k" },
  compute(i) {
    const S = sheet(), g = finGeometry(i, S), Ta = i.Ta, flow = i.v * (g.N - 1) * g.s * g.H;
    let dT = 20, air, ReL, Nu, h, eta, dT_air;
    for (let it = 0; it < 6; it++) {
      air = FLUIDS.air.at(Ta + dT / 2); ReL = i.v * g.L / air.nu;
      Nu = ReL < 5e5 ? 0.664 * Math.sqrt(ReL) * air.Pr ** (1 / 3) : (0.037 * ReL ** 0.8 - 871) * air.Pr ** (1 / 3);
      h = Nu * air.k / g.L; eta = finEff(h, i.k, g); dT_air = i.P / (air.rho * flow * air.cp); dT = dT_air / 2 + i.P / (h * (eta * g.Af + g.Ab));
    }
    const Ts = Ta + dT, bl = 5 * g.L / Math.sqrt(ReL);
    S.step(`Air à la température de film ${n(Ta + dT / 2)} °C : k = ${n(air.k)} W/m·K, ν = ${n(air.nu)} m²/s, Pr = ${n(air.Pr)}.`);
    S.step(`Reynolds sur la longueur d'ailette : Re_L = v L / ν = ${n(i.v)} × ${n(g.L)} / ${n(air.nu)} = ${n(ReL)} (${ReL < 5e5 ? "laminaire" : "couche limite mixte"}).`);
    S.step(ReL < 5e5 ? `Nusselt moyen : Nu = 0,664 Re^½ Pr^⅓ = ${n(Nu)} → h = Nu k / L = ${n(h)} W/m²·K (Incropera, éq. 7.30).` : `Nusselt moyen : Nu = (0,037 Re^0,8 − 871) Pr^⅓ = ${n(Nu)} → h = Nu k / L = ${n(h)} W/m²·K (Incropera, éq. 7.38).`);
    S.step(`Rendement d'ailette : η = tanh(m Hc) / (m Hc) avec m = √(2 h / (k t)) = ${n(Math.sqrt(2 * h / (i.k * g.tf)))} 1/m → η = ${n(eta)}.`);
    S.step(`Débit entre ailettes : ${n(flow * 3600)} m³/h ; échauffement de l'air : ΔT air = P / (ρ Q cp) = ${n(dT_air)} K.`);
    S.step(`Base : ΔT = ΔT air / 2 + P / (h (η Af + Ab)) = ${n(dT_air / 2)} + ${n(i.P)} / (${n(h)} × ${n(eta * g.Af + g.Ab)}) = ${n(dT)} K → Ts = ${n(Ts)} °C ; Rsa = ${n(dT / i.P)} K/W.`);
    if (2 * bl > g.s) S.warn(`Couches limites jointives : épaisseur 5 L / √Re = ${n(bl * 1e3, 3)} mm pour un demi-pas de ${n(g.s * 500, 3)} mm. L'écoulement entre ailettes est un écoulement de canal : résultat approché (± 30 %).`);
    if (dT_air > 0.5 * dT) S.warn("L'air s'échauffe de plus de la moitié de l'échauffement de la base : le débit d'air limite le refroidissement, augmenter la vitesse ou le pas.");
    if (i.v > 15) S.warn("Vitesse d'air supérieure à 15 m/s : bruit et perte de charge élevés, hors de la pratique courante.");
    tempCheck(S, "Température de la base vs température admissible", Ts, i.Tmax, Ta);
    return S.set({ Ts, Rsa: i.P > 0 ? dT / i.P : 0, dT, h, eta, ReL, dT_air, flow: flow * 3600, s: g.s * 1e3 });
  } };

/* ---------- lumped thermal mass ---------- */
const lumped = { id: "lumped_mass", domain: "thermal", sketch: "lump", title: "Lumped thermal mass: time constant and temperature rise", fr: "Masse thermique : constante de temps et échauffement", question: "En combien de temps cette pièce chauffe-t-elle, et jusqu'où ?",
  inputs: [num("P", "Puissance dissipée dans la pièce", "W", 5, 0, 1e6, 1, HEAT), num("Ta", "Température ambiante (et initiale)", "°C", 25, -273, 1000, 1, HEAT), num("time", "Durée de fonctionnement", "s", 600, 0, 1e7, 10, HEAT),
    num("Tmax", "Température admissible", "°C", 80, -273, 3000, 5, CRIT),
    num("m", "Masse de la pièce", "g", 100, 0.001, 1e7, 1, "Pièce"), num("cp", "Capacité thermique massique cp", "J/kg·K", 896, 50, 5000, 10, "Pièce"), num("k", "Conductivité k", "W/m·K", 167, 0.01, 2500, 1, "Pièce"),
    num("rho", "Masse volumique ρ", "kg/m³", 2700, 1, 25000, 10, "Pièce"), num("A", "Surface d'échange avec l'air", "cm²", 100, 0.001, 1e6, 1, "Pièce"), num("h", "Coefficient d'échange h (convection + rayonnement)", "W/m²·K", 10, 0.1, 1e5, 1, "Pièce")],
  outputs: [out("T_t", "Température à la fin de la durée", "°C"), out("T_inf", "Température en régime permanent", "°C"), out("tau", "Constante de temps", "s"), out("rate", "Vitesse d'échauffement initiale", "K/s"),
    out("t_lim", "Temps pour atteindre la limite", "s"), out("Bi", "Nombre de Biot", ""), out("C", "Capacité thermique m cp", "J/K")],
  assumptions: ["Pièce à température uniforme (corps mince thermiquement, lumped capacitance).", "Échange linéaire avec l'ambiante : h constant (convection naturelle + rayonnement : 8 à 12 W/m²·K ; convection forcée : 25 à 100).",
    "T(t) = Ta + (P / (h A)) × (1 − e^(−t/τ)) avec τ = m cp / (h A) ; au début, dT/dt = P / (m cp) (échauffement adiabatique).", "La pièce part de la température ambiante."],
  validity: "Nombre de Biot Bi = h Lc / k < 0,1 avec Lc = volume / surface : sinon la température n'est pas uniforme dans la pièce.",
  reference: `${INCROPERA} — chap. 5 (méthode de la capacité thermique globale, lumped capacitance)`,
  fill: { m: "mass", cp: "cp", k: "k", rho: "rho", A: "area_cm2" },
  compute(i) {
    const S = sheet(), m = i.m * 1e-3, A = i.A * 1e-4, C = m * i.cp, hA = i.h * A, tau = C / hA, dTinf = i.P / hA, dT = dTinf * (1 - Math.exp(-i.time / tau));
    const Lc = m / i.rho / A, Bi = i.h * Lc / i.k, T_t = i.Ta + dT, T_inf = i.Ta + dTinf, room = i.Tmax - i.Ta;
    S.step(`Capacité thermique : C = m cp = ${n(m)} × ${n(i.cp)} = ${n(C)} J/K ; conductance vers l'air : h A = ${n(i.h)} × ${n(A)} = ${n(hA)} W/K.`);
    S.step(`Constante de temps : τ = m cp / (h A) = ${n(C)} / ${n(hA)} = ${n(tau)} s (${n(tau / 60, 3)} min) ; régime permanent atteint à 95 % après 3 τ.`);
    S.step(`Échauffement en régime permanent : ΔT∞ = P / (h A) = ${n(i.P)} / ${n(hA)} = ${n(dTinf)} K → ${n(T_inf)} °C.`);
    S.step(`Après t = ${n(i.time)} s : ΔT = ΔT∞ (1 − e^(−t/τ)) = ${n(dTinf)} × (1 − e^(−${n(i.time / tau)})) = ${n(dT)} K → ${n(T_t)} °C (Incropera, chap. 5).`);
    S.step(`Vitesse d'échauffement initiale : P / (m cp) = ${n(i.P / C)} K/s ; Biot : Bi = h (V / A) / k = ${n(i.h)} × ${n(Lc)} / ${n(i.k)} = ${n(Bi)}.`);
    const values = { T_t, T_inf, tau, rate: i.P / C, Bi, C };
    if (dTinf > room && room > 0) { values.t_lim = -tau * Math.log(1 - room / dTinf); S.step(`Temps pour atteindre ${n(i.Tmax)} °C : t = −τ ln(1 − (Tmax − Ta) / ΔT∞) = ${n(values.t_lim)} s.`); }
    if (Bi > 0.1) S.warn(`Biot = ${n(Bi, 3)} > 0,1 : la température n'est pas uniforme dans la pièce, le modèle à une seule masse sous-estime la température près de la source.`);
    tempCheck(S, "Température à la fin de la durée vs température admissible", T_t, i.Tmax, i.Ta);
    tempCheck(S, "Température en régime permanent vs température admissible", T_inf, i.Tmax, i.Ta, { soft: true, note: T_inf > i.Tmax ? "Ne tient qu'en service limité dans le temps (voir le temps pour atteindre la limite)." : "" });
    return S.set(values);
  } };

export const THERMAL = [wall, junction, sinkNatural, sinkForced, lumped];
