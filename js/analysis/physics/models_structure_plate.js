/* DynamiteOrbit.ai — Physique, structure (2/2): rectangular flat plate under uniform pressure (Roark coefficients),
   thermal expansion mismatch of two joined materials. Inputs in mm, kPa, GPa, MPa, µm/m.K, °C. */

import { n, sheet, num, opt, out, interp, MAT, GEO, LOAD, CRIT } from "./models_core.js";

/* Roark, table 11.4 (nu = 0.3): sigma_max = beta q b2 / t2, y_max = alpha q b4 / (E t3), b = short side, ratio = a / b.
   Case 1a: four edges simply supported (stress at the centre). Case 8a: four edges fixed (stress at the middle of the
   long edges). The last column is the infinitely long plate. */
export const PLATE = {
  ss: { r: [1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, 8], beta: [0.2874, 0.3762, 0.4530, 0.5172, 0.5688, 0.6102, 0.7134, 0.7410, 0.7476, 0.7500],
    alpha: [0.0444, 0.0616, 0.0770, 0.0906, 0.1017, 0.1110, 0.1335, 0.1400, 0.1417, 0.1421], cas: "1a", where: "au centre", name: "bords simplement appuyés" },
  fixed: { r: [1, 1.2, 1.4, 1.6, 1.8, 2, 4], beta: [0.3078, 0.3834, 0.4356, 0.4680, 0.4872, 0.4974, 0.5000],
    alpha: [0.0138, 0.0188, 0.0226, 0.0251, 0.0267, 0.0277, 0.0284], cas: "8a", where: "au milieu des grands bords", name: "bords encastrés" },
};

const plate = { id: "plate_pressure", domain: "structure", sketch: "plate", title: "Rectangular plate under uniform pressure", fr: "Plaque rectangulaire sous pression uniforme", question: "Le couvercle ou la paroi plate se bombe-t-il trop sous la pression ?",
  inputs: [num("a", "Grand côté a", "mm", 200, 1, 20000, 1, GEO), num("b", "Petit côté b", "mm", 150, 1, 20000, 1, GEO), num("t", "Épaisseur t", "mm", 3, 0.05, 500, 0.1, GEO),
    opt("edges", "Bords", "ss", [{ value: "ss", label: "Simplement appuyés (vissés, posés)" }, { value: "fixed", label: "Encastrés (soudés, bride rigide)" }], GEO),
    num("p", "Pression uniforme p", "kPa", 10, 0, 1e6, 1, LOAD), num("E", "Module d'Young E", "GPa", 69, 0.001, 500, 1, MAT), num("Re", "Limite élastique Re", "MPa", 276, 0.1, 3000, 1, MAT),
    num("dlim", "Flèche admissible", "mm", 1, 0.001, 1000, 0.1, CRIT), num("sf", "Coefficient de sécurité demandé", "", 1.5, 1, 10, 0.1, CRIT)],
  outputs: [out("y", "Flèche au centre", "mm"), out("sigma", "Contrainte maximale", "MPa"), out("sf_yield", "Marge Re / σ", ""), out("force", "Effort total p a b", "N"), out("beta", "Coefficient β", ""), out("alpha", "Coefficient α", "")],
  assumptions: ["Plaque mince, plane, d'épaisseur constante, matériau isotrope ; coefficients de Roark établis pour ν = 0,3.", "Pression uniforme sur toute la surface.",
    "Bords réels : un couvercle vissé se situe entre « appuyé » et « encastré » — le cas appuyé est le plus prudent pour la flèche.", "Coefficients interpolés linéairement selon a / b."],
  validity: "Plaque mince (t ≤ b / 4), petites flèches (y ≤ t / 2) : au-delà l'effet de membrane raidit la plaque et la formule surestime la flèche.",
  reference: "Roark's Formulas for Stress and Strain — table 11.4, cas 1a (bords appuyés) et 8a (bords encastrés)",
  fill: { a: "L", b: "b", t: "h", E: "E", Re: "Re" },
  compute(i) {
    const S = sheet(), a = Math.max(i.a, i.b), b = Math.min(i.a, i.b), q = i.p * 1e-3, E = i.E * 1e3;   // q in MPa
    const c = PLATE[i.edges] || PLATE.ss, ratio = a / b, beta = interp(c.r, c.beta, ratio), alpha = interp(c.r, c.alpha, ratio);
    const sigma = beta * q * b * b / (i.t * i.t), y = alpha * q * b ** 4 / (E * i.t ** 3);
    S.step(`Rapport des côtés : a / b = ${n(a)} / ${n(b)} = ${n(ratio, 3)} ; ${c.name} → β = ${n(beta)}, α = ${n(alpha)} (Roark, table 11.4, cas ${c.cas}, interpolation linéaire).`);
    S.step(`Contrainte maximale ${c.where} : σ = β p b² / t² = ${n(beta)} × ${n(q)} × ${n(b)}² / ${n(i.t)}² = ${n(sigma)} MPa (p = ${n(i.p)} kPa = ${n(q)} MPa).`);
    S.step(`Flèche au centre : y = α p b⁴ / (E t³) = ${n(alpha)} × ${n(q)} × ${n(b)}⁴ / (${n(E)} × ${n(i.t)}³) = ${n(y)} mm.`);
    S.step(`Marge Re / σ = ${n(i.Re)} / ${n(sigma)} = ${n(i.Re / sigma, 3)}.`);
    if (i.a < i.b) S.warn("Grand et petit côtés inversés : a est pris comme le plus grand des deux.");
    if (y > i.t / 2) S.warn(`Flèche y = ${n(y, 3)} mm > t / 2 : hors du domaine des petites flèches. La plaque réelle est plus raide (effet de membrane) ; le résultat est prudent pour la flèche.`);
    if (i.t > b / 4) S.warn("Plaque épaisse (t > b / 4) : la théorie des plaques minces ne s'applique plus.");
    S.check("Contrainte maximale vs limite élastique", sigma, i.Re, "MPa", { sf: i.sf });
    S.check("Flèche au centre vs flèche admissible", y, i.dlim, "mm");
    return S.set({ y, sigma, sf_yield: Math.min(999, i.Re / sigma), force: q * a * b, beta, alpha });
  } };

/* ---------- thermal expansion mismatch ---------- */
const G1 = "Matériau 1", G2 = "Matériau 2", TH = "Températures";
const expansion = { id: "thermal_mismatch", domain: "structure", sketch: "bimetal", title: "Differential thermal expansion of two joined materials", fr: "Dilatation différentielle de deux matériaux assemblés", question: "Les deux pièces assemblées se déchirent-elles quand la température change ?",
  inputs: [num("L", "Longueur entre fixations L", "mm", 200, 0.1, 50000, 1, GEO), num("play", "Jeu disponible aux fixations (0 = liaison rigide)", "mm", 0, 0, 50, 0.05, GEO),
    num("cte1", "Coefficient de dilatation α₁", "µm/m·K", 23.6, 0, 400, 0.1, G1), num("E1", "Module d'Young E₁", "GPa", 69, 0.001, 500, 1, G1), num("A1", "Section A₁", "mm²", 100, 0.001, 1e7, 1, G1), num("Re1", "Limite élastique Re₁", "MPa", 276, 0.1, 3000, 1, G1),
    num("cte2", "Coefficient de dilatation α₂", "µm/m·K", 11.7, 0, 400, 0.1, G2), num("E2", "Module d'Young E₂", "GPa", 205, 0.001, 500, 1, G2), num("A2", "Section A₂", "mm²", 100, 0.001, 1e7, 1, G2), num("Re2", "Limite élastique Re₂", "MPa", 370, 0.1, 3000, 1, G2),
    num("T0", "Température d'assemblage", "°C", 20, -273, 1500, 1, TH), num("T", "Température de service", "°C", 80, -273, 1500, 1, TH), num("sf", "Coefficient de sécurité demandé", "", 1.5, 1, 10, 0.1, CRIT)],
  outputs: [out("delta", "Dilatation différentielle libre", "mm"), out("sigma1", "Contrainte dans 1 (liaison rigide)", "MPa"), out("sigma2", "Contrainte dans 2 (liaison rigide)", "MPa"), out("force", "Effort dans la liaison", "N"),
    out("sigma1_blocked", "Contrainte dans 1 si totalement bridé", "MPa"), out("sigma2_blocked", "Contrainte dans 2 si totalement bridé", "MPa"), out("dT", "Écart de température", "K")],
  assumptions: ["Température uniforme dans les deux pièces ; coefficients de dilatation constants sur la plage.", "Liaison rigide : les deux pièces gardent la même longueur ; l'effort se partage selon les raideurs E A (traction-compression pure).",
    "La flexion de l'ensemble (effet bilame) et le cisaillement dans une colle ne sont pas calculés.", "Cas totalement bridé : l'autre pièce est supposée infiniment raide (enveloppe, σ = E Δα ΔT).",
    "Signe : la pièce qui se dilate le plus est comprimée à chaud, l'autre est tendue."],
  validity: "Comportement élastique ; pas de flambement de la pièce comprimée (à vérifier avec le modèle de flambement si elle est mince).",
  reference: "Roark's Formulas for Stress and Strain — chap. 15 (contraintes thermiques) ; Shigley's Mechanical Engineering Design — chap. 3 (thermal stresses)",
  fill: { L: "L", cte1: "cte", E1: "E", Re1: "Re", A1: "A_sec" },
  compute(i) {
    const S = sheet(), dT = i.T - i.T0, da = (i.cte1 - i.cte2) * 1e-6, E1 = i.E1 * 1e3, E2 = i.E2 * 1e3;
    const delta = da * dT * i.L, eps = Math.abs(da * dT), left = Math.max(0, Math.abs(delta) - i.play), epsR = left / i.L;   // strain left after the play is used
    const force = epsR / (1 / (E1 * i.A1) + 1 / (E2 * i.A2)), sigma1 = force / i.A1, sigma2 = force / i.A2, s1b = E1 * eps, s2b = E2 * eps;
    S.step(`Écart de température : ΔT = T − T₀ = ${n(i.T)} − ${n(i.T0)} = ${n(dT)} K ; Δα = α₁ − α₂ = ${n(i.cte1)} − ${n(i.cte2)} = ${n(i.cte1 - i.cte2)} µm/m·K.`);
    S.step(`Dilatation différentielle libre : Δ = Δα ΔT L = ${n(da)} × ${n(dT)} × ${n(i.L)} = ${n(delta)} mm.`);
    if (i.play > 0) S.step(`Jeu disponible ${n(i.play)} mm : il reste ${n(left)} mm à absorber par déformation des pièces.`);
    S.step(`Liaison rigide, partage selon les raideurs : F = (Δ / L) / (1 / (E₁ A₁) + 1 / (E₂ A₂)) = ${n(epsR)} / (1 / (${n(E1)} × ${n(i.A1)}) + 1 / (${n(E2)} × ${n(i.A2)})) = ${n(force)} N.`);
    S.step(`Contraintes : σ₁ = F / A₁ = ${n(sigma1)} MPa ; σ₂ = F / A₂ = ${n(sigma2)} MPa.`);
    S.step(`Enveloppe « totalement bridé » (jeu nul, autre pièce infiniment raide) : σ = E Δα ΔT → σ₁ = ${n(E1)} × ${n(eps)} = ${n(s1b)} MPa ; σ₂ = ${n(s2b)} MPa (Roark, chap. 15).`);
    if (Math.abs(dT) > 150) S.warn("Écart de température supérieur à 150 K : les coefficients de dilatation et les modules varient, utiliser des valeurs moyennes sur la plage.");
    S.check("Contrainte dans le matériau 1 vs limite élastique", sigma1, i.Re1, "MPa", { sf: i.sf });
    S.check("Contrainte dans le matériau 2 vs limite élastique", sigma2, i.Re2, "MPa", { sf: i.sf });
    if (i.play > 0) S.check("Dilatation différentielle vs jeu disponible", Math.abs(delta), i.play, "mm", { soft: true, note: Math.abs(delta) > i.play ? "Le jeu ne suffit pas : les pièces se contraignent." : "Le jeu absorbe toute la dilatation." });
    return S.set({ delta, sigma1, sigma2, force, sigma1_blocked: s1b, sigma2_blocked: s2b, dT });
  } };

export const STRUCTURE_B = [plate, expansion];
