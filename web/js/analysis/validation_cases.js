/* DynamiteOrbit — the reference cases of the analytical models (validation.js runs them ; the simulation has its own in
   validation_fea.js). Each case is a worked example somebody else published : the given values and the printed result were read
   on the page named in `source.url` on 20 November 2026, and copied as printed (`given`, `printed`). Nothing else is taken from a
   source : no text, no figure.
     how : "direct" (the data of the source in, its result compared), "inverse" (the source looks for a datum the model asks for :
           its printed result goes in, its printed datum is found again) or "table" (coefficients compared with a published table).
     inputs : only what the source gives ; the other inputs keep the values of the model, and `free` says why they change nothing.
     expect : { key (an output of the model), value (in the unit of the model), printed (as the source prints it), tol }.
              The tolerance follows the digits the source prints : a result printed with two digits cannot be found to 0,1 %.
   Imperial examples are converted with the exact definitions below, and say so (`converted`).
   A model without a case, or with cases that leave something out, says it in GAPS : nothing is validated by default. */

const IN = 25.4, LBF = 4.4482216152605, PSI = 0.006894757293168, IN4 = IN ** 4, INLBF = IN * LBF / 1000;   // mm, N, MPa, mm⁴, N·m
export const CONVERTED = "Unités impériales de la source converties avec les définitions exactes : 1 in = 25,4 mm ; 1 lbf = 4,448 222 N ; 1 psi = 6,894 757 kPa.";

const OX = (book, page, where) => ({ name: `OpenStax, ${book}`, where, url: `https://openstax.org/books/${page}`, read: "read", licence: "CC BY-NC-SA 4.0" });
const CP = "College Physics 2e", UP1 = "University Physics, Volume 1", UP2 = "University Physics, Volume 2";
const ET = (title, year, page, where) => ({ name: `The Engineering ToolBox (${year}), « ${title} »`, where, url: `https://www.engineeringtoolbox.com/${page}`, read: "read", licence: "page publique, citée comme elle le demande" });
const UB = ["Poutre en I UB 305 × 127 × 42, acier", "L = 5000 mm", "I = 8196 cm⁴ (81 960 000 mm⁴)", "E = 200 GPa", "distance de la fibre extrême à l'axe neutre : 150 mm"];
const W12 = ["Poutre en I W 12 × 35, acier", "L = 100 in", "I = 285 in⁴", "E = 29 000 000 psi", "distance de la fibre extrême : 6,25 in"];
const NO_AREA = "L'aire de la section n'est pas donnée par la source : elle ne change ni la flèche, ni le moment, ni la contrainte de flexion (seuls le cisaillement, la masse et la fréquence propre en dépendent, et ils ne sont pas comparés).";
const custom = (I, c) => ({ section: "custom", Ic: I, cc: c });

export const CASES = [
  /* ---------- structure ---------- */
  { id: "cantilever-end-ub", model: "beam_cantilever_point", how: "direct", title: "Poutre en I de 5 m encastrée, 3 kN en bout",
    source: ET("Cantilever Beam Calculations: Formulas, Loads & Deflections", 2013, "cantilever-beams-d_1848.html", "exemple « Cantilever Beam with Single Load at the End, Metric Units »"),
    given: [...UB, "F = 3000 N en bout"], inputs: { L: 5000, ...custom(81960000, 150), F: 3000, E: 200 }, free: NO_AREA,
    expect: [{ key: "delta", value: 7.6, printed: "7.6 mm", tol: 0.01 }, { key: "M", value: 15000, printed: "1.5×10⁴ Nm", tol: 0.005 }, { key: "sigma", value: 27.4, printed: "27.4 MPa", tol: 0.01 }] },
  { id: "cantilever-udl-round", model: "beam_cantilever_udl", how: "direct", title: "Barreau rond de 1 in encastré, 100 lbf/in sur 10 in", converted: true,
    source: { name: "MechaniCalc, « Beam Analysis Validation »", where: "cas « Cantilever Beam, Uniform Distributed Force » (valeurs attendues du calcul à la main)", url: "https://mechanicalc.com/calculators/beam-analysis/validation", read: "read", licence: "© MechaniCalc, Inc. — nombres cités avec la référence" },
    given: ["Barreau rond, aluminium 6061-T6, diamètre 1 in", "L = 10 in", "w = 100 lbf/in (1000 lbf au total)", "E = 9.9e6 psi"], inputs: { L: 10 * IN, section: "round", d: IN, F: 1000 * LBF, E: 9.9e6 * PSI / 1000 },
    expect: [{ key: "delta", value: 0.2572 * IN, printed: "0.2572 in", tol: 0.005 }, { key: "M", value: 5000 * INLBF, printed: "5000 in-lbf", tol: 0.005 }] },
  { id: "simple-point-w12", model: "beam_simple_point", how: "direct", title: "Poutre en I de 100 in sur deux appuis, 10 000 lb au centre", converted: true,
    source: ET("Beams Supported at Both Ends with Continuous and Point Loads: Stress, Deflection, Formulas and Calculators", 2009, "beam-stress-deflection-d_1312.html", "exemple « Beam with a Single Center Load »"),
    given: [...W12, "F = 10 000 lb au centre"], inputs: { L: 100 * IN, ...custom(285 * IN4, 6.25 * IN), F: 10000 * LBF, E: 29e6 * PSI / 1000 }, free: NO_AREA,
    expect: [{ key: "sigma", value: 5482 * PSI, printed: "5482 psi", tol: 0.005 }, { key: "delta", value: 0.025 * IN, printed: "0.025 in", tol: 0.03, note: "la source imprime deux chiffres" }] },
  { id: "simple-udl-ub", model: "beam_simple_udl", how: "direct", title: "Poutre en I de 5 m sur deux appuis, 6 N/mm répartis",
    source: ET("Beams Supported at Both Ends with Continuous and Point Loads: Stress, Deflection, Formulas and Calculators", 2009, "beam-stress-deflection-d_1312.html", "exemple « Beam with Uniform Load, Metric Units »"),
    given: [...UB, "q = 6 N/mm (30 000 N au total)"], inputs: { L: 5000, ...custom(81960000, 150), F: 30000, E: 200 }, free: NO_AREA,
    expect: [{ key: "sigma", value: 34.3, printed: "34.3 MPa", tol: 0.005 }, { key: "delta", value: 2.98, printed: "2.98 mm", tol: 0.005 }] },
  { id: "euler-fixed-fixed", model: "column_buckling", how: "direct", title: "Colonne en I d'aluminium de 5 m, encastrée aux deux bouts",
    source: ET("Euler Column Buckling: Formula, Theory & Calculator", 2012, "euler-column-formula-d_1813.html", "exemple « A Column Fixed in both Ends »"),
    given: ["L = 5 m, encastrée aux deux bouts (facteur n = 4, soit K = 0,5)", "I = 241×10⁻⁸ m⁴ (5,78 in⁴)", "E = 69 GPa"], inputs: { L: 5000, ends: "fx", section: "custom", Ic: 2410000, Ac: 3000, E: 69 }, requires: { johnson: 0 },
    free: "L'aire de la section et la limite élastique ne sont pas données par la source : elles ne changent pas la charge d'Euler, elles disent seulement que la colonne est assez élancée pour qu'Euler s'applique. Aire prise : 3000 mm² ; limite élastique : celle du modèle. Le cas échoue si le modèle passe à la parabole de Johnson.",
    expect: [{ key: "Pcr", value: 262594, printed: "262594 N = 263 kN", tol: 0.005 }] },
  { id: "torsion-solid", model: "shaft_torsion", how: "direct", title: "Arbre plein de 50 mm, 1000 N·m sur 1 m",
    source: ET("Shafts Torsion", 2005, "torsion-shafts-d_947.html", "exemple « Shear Stress and Angular Deflection in a Solid Cylinder »"),
    given: ["T = 1000 Nm", "D = 50 mm, arbre plein", "L = 1 m", "G = 79 GPa"], inputs: { do: 50, di: 0, L: 1000, T: 1000, G: 79 },
    expect: [{ key: "tau", value: 40.8, printed: "40.8 MPa", tol: 0.01 }, { key: "theta", value: 1.2, printed: "1.2° (0.021 rad)", tol: 0.05, note: "la source imprime deux chiffres" }] },
  { id: "torsion-hollow", model: "shaft_torsion", how: "direct", title: "Arbre creux 50 × 30 mm, 1000 N·m sur 1 m",
    source: ET("Shafts Torsion", 2005, "torsion-shafts-d_947.html", "exemple « Shear Stress and Angular Deflection in a Hollow Cylinder »"),
    given: ["T = 1000 Nm", "D = 50 mm, d = 30 mm", "L = 1 m", "G = 79 GPa"], inputs: { do: 50, di: 30, L: 1000, T: 1000, G: 79 },
    expect: [{ key: "tau", value: 46.8, printed: "46.8 MPa", tol: 0.005 }, { key: "theta", value: 1.4, printed: "1.4° (0.023 rad)", tol: 0.05, note: "la source imprime deux chiffres" }] },
  ...[[1, 0.2874, 0.0444], [2, 0.6102, 0.111]].map(([r, beta, alpha]) => ({ id: `plate-ss-${r}`, model: "plate_pressure", how: "table", title: `Plaque appuyée sur ses quatre bords, a / b = ${r}`,
    source: { name: "Engineers Edge, « Flat Rectangular Plate with All Edges Simply Supported »", where: "table des coefficients β et α selon a / b, donnée pour ν = 0,3 d'après Roark, 7ᵉ édition", url: "https://engineersedge.com/calculators/flat_rectangular_plate_with_all_edges_simply_supported_15090.htm", read: "table", licence: "© Engineers Edge, LLC — coefficients cités avec la référence" },
    given: [`a / b = ${r}`, "ν = 0,3"], inputs: { a: 150 * r, b: 150, edges: "ss" }, free: "Seuls les coefficients sont comparés : l'épaisseur, la pression et la matière gardent les valeurs du modèle et n'y changent rien.",
    expect: [{ key: "beta", value: beta, printed: String(beta), tol: 0.002 }, { key: "alpha", value: alpha, printed: String(alpha).padEnd(6, "0"), tol: 0.002 }] })),
  ...[["ss", 0.75, "x simply supported -> 0.75, max in center", "appuyée"], ["fixed", 0.5, "x clamped -> 0.5 max at side mid long length", "encastrée"]].map(([edges, k, printed, word]) => ({ id: `plate-long-${edges}`, model: "plate_pressure", how: "table", title: `Plaque très longue ${word} : coefficient de la contrainte`,
    source: { name: "MIT OpenCourseWare, 2.082 Ship Structural Analysis & Design, notes 24 « Solution of Plate Bending Equation »", where: "dernière page : « k in relation stress = k*p*(b/t)^2 », ν = 0,3", url: "https://ocw.mit.edu/courses/2-082-ship-structural-analysis-design-13-122-spring-2003/fb7861b5166b983233284631dcfdafb2_notes_24_plate_bendin.pdf", read: "read", licence: "MIT OpenCourseWare" },
    given: ["plaque longue (a / b = 10 dans les notes)", "ν = 0,3"], inputs: { a: 1500, b: 150, edges }, free: "Seul le coefficient est comparé : l'épaisseur, la pression et la matière gardent les valeurs du modèle et n'y changent rien.",
    expect: [{ key: "beta", value: k, printed, tol: 0.01 }] })),
  { id: "blocked-concrete", model: "thermal_mismatch", how: "direct", title: "Dalles de béton posées sans jeu, de 5 °C à 38 °C",
    source: OX(UP2, "university-physics-volume-2/pages/1-3-thermal-expansion", "§ 1.3, Example 1.4"),
    given: ["dalles qui ne peuvent pas se dilater", "5 °C à la pose, 38 °C en été", "Y = 20 × 10⁹ N/m²", "α = 12 × 10⁻⁶ /°C"], inputs: { cte1: 12, E1: 20, cte2: 0, T0: 5, T: 38 },
    free: "Le matériau 2 du modèle joue le sol qui ne se dilate pas (α₂ = 0) ; la longueur et les sections ne changent rien à la contrainte « totalement bridé ».",
    expect: [{ key: "sigma1_blocked", value: 7.9, printed: "7.9 × 10⁶ N/m²", tol: 0.02, note: "la source imprime deux chiffres" }] },
  /* ---------- joints ---------- */
  { id: "bolt-m30-proof", model: "bolted_joint", how: "inverse", title: "Vis M30 classe 8.8 serrée à sa charge d'épreuve",
    source: ET("Bolt Torque Calculator: Loads & Preloads Data and Calculator", 2018, "bolt-torque-load-calculator-d_2065.html", "exemple « Required torque for tightening a Metric bolt to proof load »"),
    given: ["vis M30, classe 8.8, sèche (K = 0,2)", "charge d'épreuve à atteindre : 337 000 N", "résultat de la source : couple de 2022 Nm"], inputs: { size: "M30", cls: "8.8", T: 2022, K: 0.2 },
    free: "Seule la relation couple → précharge est comparée ; les pièces serrées et le taraudage gardent les valeurs du modèle.",
    expect: [{ key: "Fi", value: 337000, printed: "337000 N", tol: 0.002 }] },
  { id: "shrink-fit-tubes", model: "press_fit", how: "direct", title: "Deux tubes d'acier frettés, 0,01 mm de serrage au rayon",
    source: { name: "Université de Bassorah, génie mécanique, notes de cours « Mechanics of Materials — Chapter Ten : Thick Cylinders »", where: "Example 10.4, p. 89-90", url: "https://faculty.uobasrah.edu.iq/uploads/teaching/1632208077.pdf", read: "read", licence: "notes de cours publiques, sans licence dite" },
    given: ["tube extérieur : diamètre intérieur 100 mm, paroi 25 mm", "tube intérieur : diamètre extérieur 100 mm, paroi 25 mm", "serrage au rayon : 0,01 mm (0,02 mm au diamètre)", "E = 208 GN/m² pour les deux"], inputs: { d: 100, Do: 150, di: 50, delta: 20, Eh: 208, Es: 208 },
    free: "Les deux tubes sont du même acier : le coefficient de Poisson, pris égal des deux côtés, s'annule dans la pression de contact.",
    expect: [{ key: "p", value: 9.74, printed: "9.74 MN/m²", tol: 0.005 }] },
  { id: "pin-single-shear", model: "dowel_pin", how: "direct", title: "Goupille de 12 mm d'un assemblage à recouvrement, 20 kN",
    source: { name: "Jönköping University, « Applied Mechanics » (M. Cenanovic)", where: "§ 8.4 Shear stress, Example 2", url: "https://mechanics.ju.se/SolidMechanics/ShearStress.html", read: "read", licence: "CC BY 4.0" },
    given: ["P = 20 kN", "d = 12 mm", "une goupille, un plan de cisaillement"], inputs: { d: 12, np: 1, planes: "1", F: 20000 },
    expect: [{ key: "tau", value: 176.8, printed: "176.8 MPa", tol: 0.002 }] },
  { id: "pin-double-shear", model: "dowel_pin", how: "inverse", title: "Axe en double cisaillement, 200 lb", converted: true,
    source: { name: "Engineering LibreTexts, « Strength of Materials » (Lord, Richardson, Davison, Dillard)", where: "chap. 2 Stress, Example 2.4", url: "https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Strength_of_Materials/02%3A_Stress", read: "read", licence: "CC BY-NC-SA 4.0" },
    given: ["charge de 200 lb, axe en double cisaillement", "contrainte de cisaillement admise : 3 ksi", "résultat de la source : diamètre de 0,206 in"], inputs: { d: 0.206 * IN, np: 1, planes: "2", F: 200 * LBF },
    expect: [{ key: "tau", value: 3000 * PSI, printed: "3 ksi", tol: 0.01 }] },
  { id: "screw-efficiency-square", model: "face_cam", how: "direct", title: "Rendement d'une vis à filet carré : λ = 10°, μ = 0,30",
    source: { name: "Engineers Edge, « Power Screws Design »", where: "paragraphe sur le rendement (efficiency) : « for λ = 10 degrees and µ = 0.05 » puis « µ = 0.30 »", url: "https://engineersedge.com/mechanics_machines/power_screws_design_13982.htm", read: "read", licence: "© Engineers Edge, LLC — nombres cités avec la référence" },
    given: ["angle d'hélice λ = 10°", "frottement du filet μ = 0,30", "filet carré", "rendement imprimé : 35 % (et « plus de 75 % » pour μ = 0,05)"], inputs: { alpha: 10, mu: 0.3, muB: 0 },
    free: "La rampe d'une came est le filet déroulé d'une vis : sa pente α est l'angle d'hélice λ. Sans frottement de butée (μb = 0, l'exemple n'en a pas), le rendement ne dépend que de α et de μ — le rayon, l'effort, la rotation et le levier n'y changent rien. L'autre exemple de la page (μ = 0,05) n'imprime qu'une borne, « plus de 75 % » : il n'est pas comparé.",
    expect: [{ key: "eta", value: 35, printed: "η = 35 percent", tol: 0.015, note: "la source imprime deux chiffres" }] },
  /* ---------- fluids ---------- */
  { id: "poiseuille-needle", model: "pipe_flow", how: "direct", title: "Aiguille de 0,30 mm : solution saline à 0,120 cm³/s",
    source: OX(CP, "college-physics-2e/pages/12-4-viscosity-and-laminar-flow-poiseuilles-law", "§ 12.4, Example 12.8"),
    given: ["Q = 0,120 cm³/s", "rayon 0,150 mm, longueur 2,50 cm", "η = 1,00 × 10⁻³ N·s/m² (eau à 20 °C)"], inputs: { fluid: "custom", rho_c: 1000, mu_c: 1, d: 0.3, L: 25, eps: 0, Q: 0.0072 }, requires: { turbulent: 0 },
    free: "La masse volumique (1000 kg/m³, celle de l'eau) ne sert qu'à dire que l'écoulement est laminaire.",
    expect: [{ key: "dp", value: 16200 - 1066, printed: "P₂ − P₁ = 1.62 × 10⁴ − 1.066 × 10³ N/m²", tol: 0.01, note: "différence de deux nombres imprimés" }] },
  { id: "poiseuille-duct", model: "pipe_flow", how: "inverse", title: "Conduit d'air de 18 cm et de 20 m, écoulement laminaire",
    source: OX(UP1, "university-physics-volume-1/pages/14-7-viscosity-and-turbulence", "§ 14.7, Examples 14.8 et 14.9"),
    given: ["pression de 0,054 Pa", "diamètre 18,00 cm, longueur 20 m", "η = 0,0181 mPa·s", "ρ = 1,23 kg/m³ (Example 14.9)", "résultat de la source : Q = 3,84 × 10⁻³ m³/s (elle prend π = 3,14)"], inputs: { fluid: "custom", rho_c: 1.23, mu_c: 0.0181, d: 180, L: 20000, eps: 0, Q: 230.4 }, requires: { turbulent: 0 },
    expect: [{ key: "dp", value: 0.054, printed: "0.054 Pa", tol: 0.01 }, { key: "Re", value: 1835, printed: "1835", tol: 0.02, note: "la source arrondit la vitesse à 0,15 m/s" }] },
  { id: "nozzle-bernoulli", model: "orifice_flow", how: "direct", title: "Lance d'arrosage : de 18 mm à 5 mm, 0,500 L/s",
    source: OX(CP, "college-physics-2e/pages/12-2-bernoullis-equation", "§ 12.1, Example 12.2 et § 12.2, Example 12.4"),
    given: ["rayon du tuyau 0,900 cm, rayon de la buse 0,250 cm", "Q = 0,500 L/s", "ρ = 10³ kg/m³", "écoulement de niveau et sans frottement"], inputs: { fluid: "custom", rho_c: 1000, mu_c: 1, d: 5, D: 18, Cd: 1, Q: 30 },
    free: "« Sans frottement » se rejoue avec Cd = 1 ; la viscosité ne sert qu'au nombre de Reynolds.",
    expect: [{ key: "v", value: 25.5, printed: "25.5 m/s", tol: 0.005 }, { key: "dp", value: 424000 - 101000, printed: "P₁ − P₂ = 4.24 × 10⁵ − 1.01 × 10⁵ N/m²", tol: 0.01, note: "différence de deux nombres imprimés" }] },
  { id: "orifice-plate", model: "orifice_flow", how: "direct", title: "Diaphragme de 50 mm dans un tube de 102 mm, 20 kPa",
    source: ET("Orifice, Nozzle, and Venturi Flow Meters: Principles, Calculations & Data", 2004, "orifice-nozzle-venturi-d_590.html", "exemple « Orifice Flow »"),
    given: ["orifice de 50 mm, tube de 102 mm", "coefficient de décharge ≈ 0,6", "eau, 1000 kg/m³", "différence de pression : 20 kPa"], inputs: { fluid: "custom", rho_c: 1000, mu_c: 1, d: 50, D: 102, Cd: 0.6, Q: 462, dp_max: 20 },
    free: "Le débit comparé est celui que le modèle donne « à la perte de charge admissible », réglée ici à 20 kPa ; le débit entré (celui de la source) ne sert qu'au nombre de Reynolds.",
    expect: [{ key: "Q_max", value: 462, printed: "7.7 kg/s (462 L/min d'eau)", tol: 0.02, note: "la source imprime deux chiffres" }] },
  /* ---------- heat ---------- */
  { id: "pan-conduction", model: "conduction_stack", how: "direct", title: "Fond de casserole en aluminium de 8 mm, 2256 W",
    source: OX(CP, "college-physics-2e/pages/14-5-conduction", "§ 14.5, Example 14.6"),
    given: ["épaisseur 0,800 cm", "aire 1,54 × 10⁻² m² (diamètre 14,0 cm)", "k = 220 J/s·m·°C", "Q/t = 2256 J/s"], inputs: { A: 15400, P: 2256, t1: 8, k1: 220, t2: 0, t3: 0, tim_t: 0, Rc: 0 },
    expect: [{ key: "dT", value: 5.33, printed: "5.33 °C", tol: 0.005 }] },
  { id: "two-rods-conduction", model: "conduction_stack", how: "inverse", title: "Barreau d'acier et barreau d'aluminium bout à bout, de 100 °C à 20 °C",
    source: OX(UP2, "university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer", "§ 1.6, Example 1.11"),
    given: ["deux barreaux de 25,0 cm, aire 7,85 × 10⁻⁵ m²", "acier k = 80 W/m·°C, côté 100 °C", "aluminium k = 220 W/m·°C, côté 20 °C", "résultat de la source : 1,47 W"], inputs: { A: 78.5, P: 1.47, Tc: 20, t1: 250, k1: 80, t2: 250, k2: 220, t3: 0, tim_t: 0, Rc: 0 },
    expect: [{ key: "dT", value: 80, printed: "100 °C − 20 °C", tol: 0.01 }] },
  /* ---------- electricity ---------- */
  { id: "copper-wire-resistance", model: "busbar", how: "direct", title: "Fil de cuivre de 3,31 mm² et de 5 m",
    source: OX(UP2, "university-physics-volume-2/pages/9-3-resistivity-and-resistance", "§ 9.3, Example 9.5"),
    given: ["L = 5,00 m", "A = 3,31 mm² (fil rond de 2,053 mm)", "ρ = 1,68 × 10⁻⁸ Ω·m", "I = 10 mA"], inputs: { w: 3.31, t: 1, L: 5000, I: 0.01, rho20: 16.8 },
    free: "Le fil rond est rejoué comme une barre de même section (3,31 mm × 1 mm) : la résistance et la densité de courant ne dépendent que de l'aire. L'échauffement n'est pas comparé.",
    expect: [{ key: "R20", value: 25000, printed: "0.025 Ω", tol: 0.03, note: "la source imprime deux chiffres" }, { key: "J", value: 0.00302, printed: "3.02 × 10³ A/m²", tol: 0.005 }] },
];

/** What the cases of a model leave out — or why it has none. Said on the screen, next to the cases. */
export const GAPS = {
  beam_cantilever_point: "La fréquence propre et le cisaillement ne sont pas comparés.", beam_cantilever_udl: "La contrainte, la fréquence propre et le cisaillement ne sont pas comparés.",
  beam_simple_point: "La fréquence propre et le cisaillement ne sont pas comparés.", beam_simple_udl: "La fréquence propre et le cisaillement ne sont pas comparés.",
  column_buckling: "La parabole de Johnson (colonnes peu élancées) n'a pas de cas ; les autres liaisons d'extrémité non plus.",
  shaft_torsion: "La marge au cisaillement (0,577 Re) n'est pas comparée.",
  plate_pressure: "Aucun exemple chiffré complet (dimensions et pression → contrainte et flèche) n'a été trouvé en lecture libre : seuls les coefficients sont recoupés, et ceux de la plaque encastrée seulement à l'élancement infini.",
  thermal_mismatch: "Le partage de l'effort entre deux matériaux de raideurs différentes et le jeu aux fixations n'ont pas de cas.",
  bolted_joint: "Seule la relation couple → précharge est comparée : la raideur des pièces, le décollement, le glissement et l'arrachement du taraudage n'ont pas de cas.",
  press_fit: "Le couple et l'effort transmissibles (frottement) et les contraintes de von Mises ne sont pas comparés.",
  dowel_pin: "Le matage des pièces n'est pas comparé.",
  face_cam: "Seul le rendement de la rampe est comparé (un exemple de vis à filet carré) : la course, le frottement de la butée, le couple de retour et l'auto-blocage n'ont pas de cas chiffré — la formule de la descente et la condition d'auto-blocage sont celles que la page Wikipédia « Leadscrew » imprime, sans exemple.",
  pipe_flow: "Le régime turbulent (Blasius, Swamee-Jain) n'a pas de cas : l'exemple publié trouvé donne le coefficient de frottement, que le modèle calcule lui-même.",
  orifice_flow: "La variation de Cd avec le nombre de Reynolds et les gaz n'ont pas de cas.",
  conduction_stack: "L'interface thermique (TIM) et la résistance de contact n'ont pas de cas.",
  busbar: "L'échauffement (convection, rayonnement, résistance à chaud) n'a pas de cas : seules la résistance à 20 °C et la densité de courant sont comparées.",
};
/** Why a model has no case yet. */
export const NONE = {
  junction_temperature: "Aucun exemple publié n'a encore été rejoué. La chaîne de résistances est une simple somme ; elle n'est pas validée ici.",
  heatsink_natural: "Aucun exemple publié d'un dissipateur complet en convection naturelle n'a été trouvé en lecture libre. Le modèle enchaîne plusieurs corrélations (Churchill-Chu, Bar-Cohen & Rohsenow, ailettes) dont aucune n'a été recoupée ici.",
  heatsink_forced: "Aucun exemple publié d'un dissipateur complet en convection forcée n'a été trouvé en lecture libre. Les corrélations de la plaque plane et le rendement d'ailette ne sont pas recoupés ici.",
  lumped_mass: "Aucun exemple publié n'a encore été rejoué.",
  pcb_trace: "La norme IPC-2221 n'est pas en lecture libre, et aucun exemple publié n'a encore été rejoué.",
  adiabatic_pulse: "Aucun exemple publié n'a encore été rejoué.",
  louvre_strip: "Aucun exemple chiffré publié n'a encore été rejoué : les règles sont celles que les fabricants impriment (n = longueur / pas, R = Rk / n, I = n × I d'une lamelle) ; le catalogue d'un cadre porte-lamelles (Stäubli ClipLam) imprime des joints entiers — 400 A et 50 µΩ, 800 A et 25 µΩ, 1600 A et 13 µΩ — sans dire le nombre de lamelles de chacun.",
  plastic_screw: "Aucun exemple chiffré publié n'a été trouvé en lecture libre : la page qui imprime la formule (Engineers Edge) n'en donne pas, et les guides des fabricants de vis et de plastiques consultés ce jour-là n'ont pas pu être lus. La formule n'est donc pas validée ici.",
  spring_stop: "Aucun exemple publié n'a encore été rejoué. La partie élastique est la poutre bi-encastrée chargée en son milieu ; au-delà, la courbe qui rejoint la charge de ruine est une forme choisie par l'outil, pas une solution exacte ; la résistance de contact est l'estimation de Holm. Un essai d'écrasement sur une couronne réelle doit la recaler.",
};
