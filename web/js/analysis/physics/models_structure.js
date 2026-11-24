/* DynamiteOrbit.ai — Physique, structure (1/2): straight beams (4 load cases), Euler / Johnson column, torsion of a
   round shaft. Inputs in mm, N, N.m, GPa, MPa, kg/m3; stresses computed in MPa (N/mm2). */

import { PI, SHEAR, n, sheet, num, opt, out, sectionInputs, sectionProps, MAT, GEO, LOAD, CRIT } from "./models_core.js";

const ROARK = "Roark's Formulas for Stress and Strain";
const SHIGLEY = "Shigley's Mechanical Engineering Design";
const matInputs = (rho) => [num("E", "Module d'Young E", "GPa", 69, 0.001, 500, 1, MAT), num("Re", "Limite élastique Re", "MPa", 276, 0.1, 3000, 1, MAT),
  ...(rho ? [num("rho", "Masse volumique ρ", "kg/m³", 2700, 1, 25000, 10, MAT)] : [])];
const sfInput = (def = 1.5) => num("sf", "Coefficient de sécurité demandé", "", def, 1, 10, 0.1, CRIT);

/* ---------- beams: delta = dn F L3 / (dd E I), M = F L / md, f1 = lam2 / (2 pi L2) sqrt(E I / rho A) ---------- */
const BEAMS = [
  { id: "beam_cantilever_point", sketch: "cantilever-point", title: "Cantilever beam, end load", fr: "Poutre encastrée, charge en bout (cantilever)", question: "La poutre en porte-à-faux plie-t-elle trop sous une charge en bout ?",
    sym: "F", load: "Force en bout F", dn: 1, dd: 3, md: 1, kv: 1, lam2: 3.516, cas: "1a", at: "en bout", mAt: "à l'encastrement", ends: "encastrée – libre" },
  { id: "beam_cantilever_udl", sketch: "cantilever-udl", title: "Cantilever beam, distributed load", fr: "Poutre encastrée, charge répartie (cantilever)", question: "Le porte-à-faux tient-il sous une charge répartie sur toute sa longueur ?",
    sym: "W", load: "Charge répartie totale W = q L", dn: 1, dd: 8, md: 2, kv: 1, lam2: 3.516, cas: "2a", at: "en bout", mAt: "à l'encastrement", ends: "encastrée – libre" },
  { id: "beam_simple_point", sketch: "simple-point", title: "Simply supported beam, center load", fr: "Poutre sur deux appuis, charge au centre", question: "La poutre posée sur deux appuis plie-t-elle trop sous une charge au milieu ?",
    sym: "F", load: "Force au centre F", dn: 1, dd: 48, md: 4, kv: 0.5, lam2: PI * PI, cas: "1e", at: "au centre", mAt: "au centre", ends: "appuyée – appuyée" },
  { id: "beam_simple_udl", sketch: "simple-udl", title: "Simply supported beam, distributed load", fr: "Poutre sur deux appuis, charge répartie", question: "La poutre posée sur deux appuis tient-elle sous une charge répartie ?",
    sym: "W", load: "Charge répartie totale W = q L", dn: 5, dd: 384, md: 8, kv: 0.5, lam2: PI * PI, cas: "2e", at: "au centre", mAt: "au centre", ends: "appuyée – appuyée" },
];

function beam(c) {
  const dTxt = `${c.dn > 1 ? c.dn + " " : ""}${c.sym} L³ / (${c.dd} E I)`, mTxt = c.md > 1 ? `${c.sym} L / ${c.md}` : `${c.sym} L`;
  return { id: c.id, domain: "structure", title: c.title, fr: c.fr, question: c.question, sketch: c.sketch,
    inputs: [num("L", "Portée L", "mm", 200, 1, 50000, 1, GEO), ...sectionInputs(), num("F", c.load, "N", 50, 0, 1e7, 1, LOAD), ...matInputs(true),
      num("dlim", "Flèche admissible", "mm", 2, 0.001, 1000, 0.1, CRIT), sfInput()],
    outputs: [out("delta", "Flèche maximale", "mm"), out("sigma", "Contrainte de flexion", "MPa"), out("sf_yield", "Marge Re / σ", ""), out("f1", "1re fréquence propre", "Hz"),
      out("stiffness", "Raideur", "N/mm"), out("M", "Moment maximal", "N·m"), out("tau", "Cisaillement maximal", "MPa"), out("I", "Moment quadratique", "mm⁴"), out("mass", "Masse de la poutre", "g")],
    assumptions: ["Poutre d'Euler-Bernoulli : sections planes, flèche d'effort tranchant négligée.", "Section constante, matériau homogène, élastique linéaire.",
      "Charge statique ; le poids propre de la poutre n'est pas ajouté à la charge.", "Fréquence propre : poutre seule (masse propre), sans masse rapportée.",
      "Plastiques : le fluage sous charge permanente augmente la flèche (utiliser le module de fluage)."],
    validity: "Poutre élancée (L / h ≥ 10), petites flèches (δ ≤ L / 10), contrainte sous la limite élastique.",
    reference: `${ROARK} — table 8.1, cas ${c.cas} ; table 16.1 (fréquences propres)`,
    fill: { L: "L", b: "b", h: "h", d: "b", E: "E", Re: "Re", rho: "rho" },
    compute(i) {
      const S = sheet(), E = i.E * 1e3, L = i.L, F = i.F;                    // MPa, mm, N
      const s = sectionProps(i, S);
      const delta = c.dn * F * L ** 3 / (c.dd * E * s.I), M = F * L / c.md, sigma = M * s.c / s.I, tau = s.ks * c.kv * F / s.A;
      const mass = i.rho * s.A * L * 1e-9;                                    // kg
      const f1 = c.lam2 / (2 * PI * (L / 1e3) ** 2) * Math.sqrt(E * 1e6 * s.I * 1e-12 / (i.rho * s.A * 1e-6));
      S.step(`Flèche maximale ${c.at} : δ = ${dTxt} = ${c.dn > 1 ? c.dn + " × " : ""}${n(F)} × ${n(L)}³ / (${c.dd} × ${n(E)} × ${n(s.I)}) = ${n(delta)} mm (Roark, table 8.1, cas ${c.cas}).`);
      S.step(`Moment maximal ${c.mAt} : M = ${mTxt} = ${n(M)} N·mm.`);
      S.step(`Contrainte de flexion : σ = M c / I = ${n(M)} × ${n(s.c)} / ${n(s.I)} = ${n(sigma)} MPa ; marge Re / σ = ${n(i.Re)} / ${n(sigma)} = ${n(i.Re / sigma, 3)}.`);
      S.step(`Cisaillement maximal (fibre neutre) : τ = ${n(s.ks, 3)} × V / A = ${n(s.ks, 3)} × ${n(c.kv * F)} / ${n(s.A)} = ${n(tau)} MPa.`);
      S.step(`1re fréquence propre (poutre ${c.ends}, masse propre ${n(mass * 1e3)} g) : f₁ = λ² / (2π L²) × √(E I / (ρ A)) avec λ² = ${n(c.lam2)} → f₁ = ${n(f1)} Hz (Roark, table 16.1).`);
      if (L / (2 * s.c) < 10) S.warn(`Poutre courte : L / h = ${n(L / (2 * s.c), 3)} < 10. La flèche d'effort tranchant n'est plus négligeable : la flèche réelle est plus grande.`);
      if (delta > L / 10) S.warn(`Grande flèche : δ = ${n(delta)} mm > L / 10. La formule linéaire sort de son domaine.`);
      if (mass * 9.80665 > 0.2 * F && F > 0) S.warn(`Le poids propre (${n(mass * 9.80665, 3)} N) dépasse 20 % de la charge : ajoutez-le comme charge répartie.`);
      S.check("Contrainte de flexion vs limite élastique", sigma, i.Re, "MPa", { sf: i.sf });
      S.check("Flèche vs flèche admissible", delta, i.dlim, "mm");
      return S.set({ delta, sigma, sf_yield: Math.min(999, i.Re / sigma), f1, stiffness: F > 0 ? F / delta : c.dd * E * s.I / (c.dn * L ** 3), M: M / 1e3, tau, I: s.I, mass: mass * 1e3 });
    } };
}

/* ---------- column buckling: Euler above the transition slenderness, Johnson parabola below ---------- */
export const ENDS = { pp: 1, ff: 2, fp: 0.7, fx: 0.5 };
const buckling = { id: "column_buckling", domain: "structure", sketch: "column", title: "Column buckling (Euler / Johnson)", fr: "Flambement d'une colonne (Euler / Johnson)", question: "La pièce comprimée flambe-t-elle avant de s'écraser ?",
  inputs: [num("L", "Longueur L", "mm", 300, 1, 50000, 1, GEO),
    opt("ends", "Liaisons aux extrémités", "pp", [{ value: "pp", label: "Articulée – articulée (K = 1)" }, { value: "ff", label: "Encastrée – libre (K = 2)" },
      { value: "fp", label: "Encastrée – articulée (K = 0,7)" }, { value: "fx", label: "Encastrée – encastrée (K = 0,5)" }], GEO),
    ...sectionInputs(), num("F", "Effort de compression F", "N", 1000, 0, 1e8, 10, LOAD), ...matInputs(false), sfInput(3)],
  outputs: [out("Pcr", "Charge critique", "N"), out("margin", "Marge Pcr / F", ""), out("lambda", "Élancement Le / r", ""), out("lambda1", "Élancement de transition", ""),
    out("sigma_cr", "Contrainte critique", "MPa"), out("sigma", "Contrainte de compression", "MPa"), out("Le", "Longueur de flambement", "mm"), out("johnson", "Régime (0 Euler, 1 Johnson)", "")],
  assumptions: ["Colonne droite, charge centrée, section constante ; pour une section rectangulaire h est le petit côté (axe faible).",
    "Longueurs de flambement théoriques Le = K L ; un encastrement réel n'est jamais parfait : prendre K plus grand en cas de doute.",
    "Sous l'élancement de transition λ₁ (σcr = Re / 2), la parabole de J. B. Johnson remplace Euler.", "Un coefficient de sécurité de 3 couvre les défauts de rectitude et d'excentricité usuels."],
  validity: "Flambement élastique (Euler) pour λ ≥ λ₁ = √(2 π² E / Re) ; Johnson pour λ < λ₁ ; au-delà de λ = 200 la colonne est très sensible aux défauts.",
  reference: `Euler ; ${SHIGLEY} — chap. 4 (colonnes : Euler et parabole de Johnson)`,
  fill: { L: "L", b: "b", h: "h", d: "b", E: "E", Re: "Re" },
  compute(i) {
    const S = sheet(), E = i.E * 1e3, K = ENDS[i.ends] || 1;
    const s = sectionProps(i, S), Le = K * i.L, lambda = Le / s.r, lambda1 = Math.sqrt(2 * PI * PI * E / i.Re), johnson = lambda < lambda1;
    const sigma_cr = johnson ? i.Re * (1 - i.Re * lambda * lambda / (4 * PI * PI * E)) : PI * PI * E / (lambda * lambda);
    const Pcr = sigma_cr * s.A, sigma = i.F / s.A;
    S.step(`Rayon de giration : r = √(I / A) = √(${n(s.I)} / ${n(s.A)}) = ${n(s.r)} mm.`);
    S.step(`Longueur de flambement : Le = K L = ${n(K, 3)} × ${n(i.L)} = ${n(Le)} mm ; élancement λ = Le / r = ${n(lambda)}.`);
    S.step(`Élancement de transition : λ₁ = √(2 π² E / Re) = √(2 π² × ${n(E)} / ${n(i.Re)}) = ${n(lambda1)} (Shigley, chap. 4).`);
    if (johnson) S.step(`λ < λ₁ : parabole de Johnson, σcr = Re [1 − Re λ² / (4 π² E)] = ${n(i.Re)} × [1 − ${n(i.Re)} × ${n(lambda)}² / (4 π² × ${n(E)})] = ${n(sigma_cr)} MPa.`);
    else S.step(`λ ≥ λ₁ : Euler, σcr = π² E / λ² = π² × ${n(E)} / ${n(lambda)}² = ${n(sigma_cr)} MPa (soit Pcr = π² E I / Le²).`);
    S.step(`Charge critique : Pcr = σcr A = ${n(sigma_cr)} × ${n(s.A)} = ${n(Pcr)} N ; marge Pcr / F = ${n(Pcr / i.F, 3)}.`);
    if (johnson) S.warn(`Élancement λ = ${n(lambda, 3)} inférieur à la limite d'Euler λ₁ = ${n(lambda1, 3)} : la parabole de Johnson est utilisée (flambement inélastique).`);
    if (lambda > 200) S.warn(`Colonne très élancée (λ = ${n(lambda, 3)} > 200) : très sensible aux défauts de rectitude.`);
    S.check("Effort de compression vs charge critique de flambement", i.F, Pcr, "N", { sf: i.sf });
    S.check("Contrainte de compression vs limite élastique", sigma, i.Re, "MPa");
    return S.set({ Pcr, margin: Math.min(999, Pcr / i.F), lambda, lambda1, sigma_cr, sigma, Le, johnson: johnson ? 1 : 0 });
  } };

/* ---------- torsion of a round or tubular shaft ---------- */
const torsion = { id: "shaft_torsion", domain: "structure", sketch: "shaft", title: "Torsion of a round or tubular shaft", fr: "Torsion d'un arbre rond ou tubulaire", question: "L'arbre transmet-il le couple sans se vriller ni céder ?",
  inputs: [num("do", "Diamètre extérieur", "mm", 12, 0.1, 2000, 0.5, GEO), num("di", "Diamètre intérieur (0 = arbre plein)", "mm", 0, 0, 2000, 0.5, GEO), num("L", "Longueur sollicitée L", "mm", 150, 1, 50000, 1, GEO),
    num("T", "Couple T", "N·m", 10, 0, 1e6, 0.5, LOAD), num("G", "Module de cisaillement G", "GPa", 26, 0.0005, 200, 1, MAT), num("Re", "Limite élastique Re", "MPa", 276, 0.1, 3000, 1, MAT),
    num("theta_lim", "Angle de torsion admissible", "°", 2, 0.001, 360, 0.1, CRIT), sfInput()],
  outputs: [out("tau", "Cisaillement maximal", "MPa"), out("theta", "Angle de torsion", "°"), out("sf_yield", "Marge 0,577 Re / τ", ""), out("kt", "Raideur en torsion", "N·m/rad"), out("J", "Moment quadratique polaire", "mm⁴")],
  assumptions: ["Section circulaire (pleine ou tube à paroi épaisse) : les sections restent planes, pas de gauchissement.", "Limite élastique en cisaillement = 0,577 Re (von Mises).",
    "Pas de concentration de contrainte : rainure de clavette, épaulement ou trou transversal multiplient τ par 1,5 à 3.", "Couple statique ; en fatigue, comparer à la limite d'endurance."],
  validity: "Arbre rond de section constante, matériau élastique linéaire (τ < 0,577 Re). Ne s'applique pas aux sections non circulaires.",
  reference: `${SHIGLEY} — chap. 3 (torsion) ; ${ROARK} — table 10.1, cas 1 et 10`,
  fill: { L: "L", do: "b", G: "G", Re: "Re" },
  compute(i) {
    const S = sheet(), T = i.T * 1e3, G = i.G * 1e3;                         // N.mm, MPa
    let di = i.di;
    if (di >= i.do) { di = 0; S.warn("Diamètre intérieur ≥ diamètre extérieur : arbre calculé plein."); }
    const J = PI * (i.do ** 4 - di ** 4) / 32, tau = T * (i.do / 2) / J, th = T * i.L / (G * J), theta = th * 180 / PI, tauY = SHEAR * i.Re;
    S.step(`Moment quadratique polaire : J = π (d⁴ − dᵢ⁴) / 32 = π × (${n(i.do)}⁴ − ${n(di)}⁴) / 32 = ${n(J)} mm⁴ (Roark, table 10.1).`);
    S.step(`Cisaillement maximal en surface : τ = T r / J = ${n(T)} × ${n(i.do / 2)} / ${n(J)} = ${n(tau)} MPa (pour un arbre plein : 16 T / (π d³)).`);
    S.step(`Angle de torsion : θ = T L / (G J) = ${n(T)} × ${n(i.L)} / (${n(G)} × ${n(J)}) = ${n(th)} rad = ${n(theta)}°.`);
    S.step(`Limite en cisaillement : τ adm = 0,577 Re = ${n(tauY)} MPa ; marge = ${n(tauY / tau, 3)} (Shigley, énergie de distorsion).`);
    if (di > 0 && (i.do - di) / 2 < i.do / 20) S.warn("Tube à paroi très mince (t < d / 20) : vérifier aussi le voilement en torsion.");
    S.check("Cisaillement vs limite élastique en cisaillement (0,577 Re)", tau, tauY, "MPa", { sf: i.sf });
    S.check("Angle de torsion vs angle admissible", theta, i.theta_lim, "°");
    return S.set({ tau, theta, sf_yield: Math.min(999, tauY / tau), kt: G * J / i.L / 1e3, J });
  } };

export const STRUCTURE_A = [...BEAMS.map(beam), buckling, torsion];
