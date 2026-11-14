/* DesignWizard.ai — Physique, fluid: flow in a round pipe (Hagen-Poiseuille, then Darcy-Weisbach above Re 2300) and
   flow through an orifice / restriction. Inputs in mm, L/min, °C, kPa, mPa.s; SI inside. */

import { PI, n, sheet, num, opt, out, GEO, CRIT } from "./models_core.js";
import { FLUIDS, FLUID_OPTIONS } from "./props.js";

const WHITE = "White, Fluid Mechanics";
const FL = "Fluide", FLOW = "Écoulement";
const fluidInputs = (def = "water") => [opt("fluid", "Fluide", def, FLUID_OPTIONS, FL), num("T", "Température du fluide", "°C", 20, -50, 300, 1, FL),
  num("rho_c", "Masse volumique ρ", "kg/m³", 1000, 0.01, 20000, 1, FL, { when: { fluid: ["custom"] } }), num("mu_c", "Viscosité dynamique μ", "mPa·s", 1, 1e-4, 1e6, 0.1, FL, { when: { fluid: ["custom"] } })];
/** Fluid state from the inputs (library fluid at T, or the user's rho and mu). */
function fluidOf(i, S) {
  if (i.fluid === "custom" || !FLUIDS[i.fluid]) {
    S.step(`Fluide saisi : ρ = ${n(i.rho_c)} kg/m³, μ = ${n(i.mu_c)} mPa·s.`);
    return { id: "custom", rho: i.rho_c, mu: i.mu_c * 1e-3, gas: i.rho_c < 20 };
  }
  const base = FLUIDS[i.fluid], f = base.at(i.T);
  if (i.T < base.range[0] || i.T > base.range[1]) S.warn(`Température hors de la plage des propriétés de « ${base.name} » (${base.range[0]} à ${base.range[1]} °C) : propriétés prises à ${n(f.T)} °C.`);
  S.step(`${f.name} à ${n(f.T)} °C : ρ = ${n(f.rho)} kg/m³, μ = ${n(f.mu * 1e3)} mPa·s (table des fluides, valeurs typiques).`);
  return { ...f, gas: f.id === "air" };
}

const pipe = { id: "pipe_flow", domain: "fluid", sketch: "pipe", title: "Écoulement dans un tube rond (Hagen-Poiseuille / Darcy-Weisbach)", question: "Quelle perte de charge dans ce canal, et l'écoulement est-il laminaire ?",
  inputs: [...fluidInputs(), num("d", "Diamètre intérieur d", "mm", 4, 0.01, 2000, 0.1, GEO), num("L", "Longueur L", "mm", 1000, 0.1, 1e6, 10, GEO), num("eps", "Rugosité de paroi ε (0 = lisse)", "µm", 1.5, 0, 5000, 0.5, GEO),
    num("Q", "Débit volumique Q", "L/min", 0.1, 0, 1e5, 0.05, FLOW), num("dp_max", "Perte de charge admissible (0 = sans objet)", "kPa", 10, 0, 1e5, 1, CRIT)],
  outputs: [out("dp_kPa", "Perte de charge", "kPa"), out("Re", "Nombre de Reynolds", ""), out("v", "Vitesse moyenne", "m/s"), out("f", "Coefficient de frottement (Darcy)", ""), out("Le", "Longueur d'établissement", "mm"),
    out("power", "Puissance hydraulique Δp Q", "W"), out("dp", "Perte de charge", "Pa"), out("turbulent", "Régime (0 laminaire, 1 turbulent)", "")],
  assumptions: ["Tube rond droit de section constante, écoulement établi, incompressible, isotherme, fluide newtonien.", "Laminaire (Re ≤ 2300) : Hagen-Poiseuille, Δp = 128 μ L Q / (π d⁴), soit f = 64 / Re.",
    "Au-delà de Re = 2300 : Darcy-Weisbach Δp = f (L / d) ρ v² / 2 avec f de Blasius (tube lisse, Re < 10⁵) ou de Swamee-Jain (tube rugueux).",
    "Pertes singulières (coudes, raccords, entrée, sortie) non comprises : ajouter Σ K ρ v² / 2.", "Canal non circulaire : utiliser le diamètre hydraulique 4 A / P (approximation à ± 20 % en laminaire)."],
  validity: "Laminaire pour Re ≤ 2300 ; transition incertaine de 2300 à 4000 ; turbulent au-delà (Swamee-Jain : 5000 < Re < 10⁸, ε / d < 0,01). Gaz : vitesse < 0,3 Mach et Δp < 10 % de la pression absolue.",
  reference: `${WHITE} — chap. 6 (Hagen-Poiseuille, Blasius, longueur d'établissement) ; Swamee & Jain (1976)`,
  fill: { d: "d_hole", L: "L" },
  compute(i) {
    const S = sheet(), F = fluidOf(i, S), d = i.d * 1e-3, L = i.L * 1e-3, Q = i.Q / 60000, A = PI * d * d / 4, v = Q / A, Re = F.rho * v * d / F.mu, turbulent = Re > 2300;
    let f, dp, Le;
    S.step(`Vitesse moyenne : v = Q / (π d² / 4) = ${n(Q)} / ${n(A)} = ${n(v)} m/s (Q = ${n(i.Q)} L/min = ${n(Q)} m³/s).`);
    S.step(`Nombre de Reynolds : Re = ρ v d / μ = ${n(F.rho)} × ${n(v)} × ${n(d)} / ${n(F.mu)} = ${n(Re)}.`);
    if (!turbulent) {
      dp = 128 * F.mu * L * Q / (PI * d ** 4); f = Re > 0 ? 64 / Re : 0; Le = 0.06 * Re * d;
      S.step(`Régime laminaire (Re ≤ 2300), Hagen-Poiseuille : Δp = 128 μ L Q / (π d⁴) = 128 × ${n(F.mu)} × ${n(L)} × ${n(Q)} / (π × ${n(d)}⁴) = ${n(dp)} Pa (White, chap. 6) ; f = 64 / Re = ${n(f)}.`);
      S.step(`Longueur d'établissement : Le = 0,06 Re d = ${n(Le * 1e3)} mm.`);
      if (Le > 0.5 * L) S.warn(`Longueur d'établissement (${n(Le * 1e3, 3)} mm) supérieure à la moitié du tube : l'écoulement n'est pas établi, la perte de charge réelle est plus élevée.`);
    } else {
      const blasius = i.eps <= 0 && Re < 1e5;
      f = blasius ? 0.316 / Re ** 0.25 : 0.25 / Math.log10(i.eps * 1e-6 / (3.7 * d) + 5.74 / Re ** 0.9) ** 2;
      dp = f * (L / d) * F.rho * v * v / 2; Le = 4.4 * Re ** (1 / 6) * d;
      S.warn(`Re = ${n(Re, 3)} > 2300 : l'écoulement n'est plus laminaire, Hagen-Poiseuille ne s'applique pas. Résultat donné par Darcy-Weisbach avec le coefficient de ${blasius ? "Blasius" : "Swamee-Jain"}.`);
      if (Re < 4000) S.warn("Zone de transition (2300 < Re < 4000) : le coefficient de frottement est incertain (± 30 %).");
      S.step(blasius ? `Coefficient de frottement (Blasius, tube lisse) : f = 0,316 / Re^0,25 = ${n(f)}.` : `Coefficient de frottement (Swamee-Jain) : f = 0,25 / [log₁₀(ε / (3,7 d) + 5,74 / Re^0,9)]² avec ε / d = ${n(i.eps * 1e-6 / d)} → f = ${n(f)}.`);
      S.step(`Darcy-Weisbach : Δp = f (L / d) ρ v² / 2 = ${n(f)} × ${n(L / d)} × ${n(F.rho)} × ${n(v)}² / 2 = ${n(dp)} Pa (White, chap. 6).`);
      S.step(`Longueur d'établissement turbulente : Le ≈ 4,4 Re^(1/6) d = ${n(Le * 1e3)} mm.`);
    }
    if (F.gas && v > 100) S.warn(`Vitesse de ${n(v, 3)} m/s dans un gaz (> 0,3 Mach) : l'écoulement est compressible, le résultat n'est qu'un ordre de grandeur.`);
    if (F.gas && dp > 1e4) S.warn("Perte de charge supérieure à 10 kPa dans un gaz : la masse volumique varie le long du tube.");
    S.step(`Puissance hydraulique : P = Δp Q = ${n(dp)} × ${n(Q)} = ${n(dp * Q)} W.`);
    if (i.dp_max > 0) S.check("Perte de charge vs perte de charge admissible", dp / 1e3, i.dp_max, "kPa");
    return S.set({ dp_kPa: dp / 1e3, Re, v, f, Le: Le * 1e3, power: dp * Q, dp, turbulent: turbulent ? 1 : 0 });
  } };

const orifice = { id: "orifice_flow", domain: "fluid", sketch: "orifice", title: "Orifice ou restriction (coefficient de décharge Cd)", question: "Quelle perte de charge crée ce trou calibré, ou quel débit laisse-t-il passer ?",
  inputs: [...fluidInputs(), num("d", "Diamètre de l'orifice d", "mm", 2, 0.01, 1000, 0.1, GEO), num("D", "Diamètre du tube amont D (0 = grand volume)", "mm", 0, 0, 5000, 0.5, GEO),
    num("Cd", "Coefficient de décharge Cd", "", 0.61, 0.1, 1, 0.01, GEO), num("Q", "Débit volumique Q", "L/min", 1, 0, 1e5, 0.1, FLOW), num("dp_max", "Perte de charge admissible (0 = sans objet)", "kPa", 100, 0, 1e5, 1, CRIT)],
  outputs: [out("dp_kPa", "Perte de charge", "kPa"), out("Q_max", "Débit à la perte de charge admissible", "L/min"), out("v", "Vitesse dans l'orifice", "m/s"), out("Re", "Reynolds dans l'orifice", ""), out("beta", "Rapport d / D", ""), out("dp", "Perte de charge", "Pa")],
  assumptions: ["Orifice en paroi mince à arête vive : Cd ≈ 0,61 ; trou long (L / d de 2 à 4) : 0,8 ; arête arrondie ou buse : 0,95 à 0,98.", "Q = Cd A √(2 Δp / (ρ (1 − β⁴))) avec β = d / D (vitesse d'approche) ; β = 0 pour un grand volume amont.",
    "Écoulement incompressible, permanent ; Δp est la différence de pression mesurée de part et d'autre (la perte permanente est un peu plus faible).", "Pas de cavitation (liquides) ni de blocage sonique (gaz)."],
  validity: "Cd constant pour Re dans l'orifice > 10⁴ environ ; β ≤ 0,7 ; gaz : Δp < 10 % de la pression absolue amont.",
  reference: `${WHITE} — chap. 6 (débitmètres à obstruction) ; ISO 5167 (forme de l'équation)`,
  fill: { d: "d_hole" },
  compute(i) {
    const S = sheet(), F = fluidOf(i, S), d = i.d * 1e-3, A = PI * d * d / 4, Q = i.Q / 60000;
    let beta = i.D > 0 ? i.d / i.D : 0;
    if (beta >= 1) { beta = 0; S.warn("Diamètre amont ≤ diamètre de l'orifice : il n'y a pas de restriction, calcul fait avec β = 0."); }
    const E2 = 1 - beta ** 4, v = Q / A, dp = F.rho * E2 / 2 * (Q / (i.Cd * A)) ** 2, Re = F.rho * v * d / F.mu, Q_max = i.Cd * A * Math.sqrt(2 * i.dp_max * 1e3 / (F.rho * E2)) * 60000;
    S.step(`Section de l'orifice : A = π d² / 4 = ${n(A)} m² ; β = d / D = ${n(beta, 3)} ; vitesse v = Q / A = ${n(v)} m/s ; Re = ρ v d / μ = ${n(Re)}.`);
    S.step(`Perte de charge : Δp = ρ (1 − β⁴) / 2 × [Q / (Cd A)]² = ${n(F.rho)} × ${n(E2)} / 2 × [${n(Q)} / (${n(i.Cd)} × ${n(A)})]² = ${n(dp)} Pa (White, chap. 6).`);
    if (i.dp_max > 0) S.step(`Débit à Δp admissible : Q = Cd A √(2 Δp / (ρ (1 − β⁴))) = ${n(Q_max)} L/min.`);
    if (Re < 1e4 && Q > 0) S.warn(`Re = ${n(Re, 3)} < 10⁴ dans l'orifice : le coefficient Cd n'est plus constant (il dépend de Re et de la géométrie).`);
    if (beta > 0.7) S.warn("β = d / D > 0,7 : restriction faible, la formule de l'orifice devient imprécise.");
    if (F.gas && dp > 1e4) S.warn("Gaz et Δp > 10 kPa : l'écoulement est compressible (facteur de détente à appliquer, blocage sonique possible).");
    if (i.dp_max > 0) S.check("Perte de charge vs perte de charge admissible", dp / 1e3, i.dp_max, "kPa");
    return S.set({ dp_kPa: dp / 1e3, Q_max, v, Re, beta, dp });
  } };

export const FLUID = [pipe, orifice];
