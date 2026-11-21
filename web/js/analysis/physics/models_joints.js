/* DesignWizard.ai — Physique, joints: metric bolted joint (torque → preload, bolt stress, shear, bearing, thread
   stripping, separation), interference fit (Lamé), dowel pin in shear. Inputs in mm, N, N.m, GPa, MPa, µm. */

import { PI, SHEAR, n, sheet, num, opt, out, MAT, GEO, LOAD, CRIT } from "./models_core.js";
import { PLATINGS } from "../../cad/interfaces_elec.js";

const SHIGLEY = "Shigley's Mechanical Engineering Design";

/* ISO 68-1 / ISO 261 coarse threads: [pitch P, clearance hole ISO 273 medium]. As = pi/4 (d - 0.9382 P)^2 (ISO 898-1). */
export const THREADS = { M2: [0.4, 2.4], "M2.5": [0.45, 2.9], M3: [0.5, 3.4], M4: [0.7, 4.5], M5: [0.8, 5.5], M6: [1, 6.6], M8: [1.25, 9], M10: [1.5, 11], M12: [1.75, 13.5], M16: [2, 17.5], M20: [2.5, 22], M24: [3, 26], M30: [3.5, 33] };
/* ISO 898-1 (d ≤ 16 mm) and ISO 3506 (A2-70): proof strength Sp, yield Rp0.2, tensile Rm, in MPa. */
export const BOLT_CLASSES = { "4.8": { Sp: 310, Re: 340, Rm: 420 }, "8.8": { Sp: 580, Re: 640, Rm: 800 }, "10.9": { Sp: 830, Re: 940, Rm: 1040 }, "12.9": { Sp: 970, Re: 1100, Rm: 1220 }, "A2-70": { Sp: 450, Re: 450, Rm: 700 } };
const E_BOLT = 205e3;   // MPa
const TQ = "Serrage", PL = "Pièces serrées", TAP = "Taraudage";

const bolt = { id: "bolted_joint", domain: "joints", sketch: "bolt", title: "Metric bolted joint (torque → preload)", fr: "Assemblage vissé métrique (couple → précharge)", question: "La vis tient-elle, et l'assemblage reste-t-il serré sous la charge ?",
  inputs: [opt("size", "Vis", "M6", Object.keys(THREADS).map((k) => ({ value: k, label: `${k} × ${String(THREADS[k][0]).replace(".", ",")}` })), TQ),
    opt("cls", "Classe de qualité", "8.8", Object.keys(BOLT_CLASSES).map((k) => ({ value: k, label: k })), TQ),
    num("T", "Couple de serrage", "N·m", 8, 0, 5000, 0.1, TQ), num("K", "Coefficient de serrage K (nut factor)", "", 0.2, 0.05, 0.5, 0.01, TQ), num("nb", "Nombre de vis", "", 4, 1, 200, 1, TQ),
    num("Fa", "Effort axial extérieur total", "N", 0, 0, 1e7, 10, LOAD), num("Fs", "Effort tranchant extérieur total", "N", 0, 0, 1e7, 10, LOAD),
    num("lk", "Épaisseur serrée totale (grip)", "mm", 10, 0.5, 500, 0.5, PL), num("Em", "Module d'Young des pièces serrées", "GPa", 69, 0.5, 500, 1, PL),
    num("tp", "Épaisseur de la tôle la plus mince", "mm", 3, 0.1, 500, 0.1, PL), num("Re_p", "Limite élastique des pièces serrées", "MPa", 276, 1, 3000, 1, PL), num("mu", "Frottement entre les pièces", "", 0.15, 0.01, 1, 0.01, PL),
    opt("mode", "La vis se visse dans", "tapped", [{ value: "tapped", label: "un taraudage dans la pièce" }, { value: "nut", label: "un écrou (pas de vérification du taraudage)" }], TAP),
    num("Le", "Longueur de filet en prise", "mm", 9, 0.2, 200, 0.5, TAP, { when: { mode: ["tapped"] } }), num("Rm_t", "Résistance à la traction Rm de la pièce taraudée", "MPa", 310, 1, 3000, 1, TAP, { when: { mode: ["tapped"] } })],
  outputs: [out("Fi", "Précharge par vis", "N"), out("sigma_i", "Contrainte dans la vis", "MPa"), out("proof_pct", "Taux de charge d'épreuve", "%"), out("clamp", "Effort de serrage total", "N"),
    out("F_sep", "Effort axial de décollement (total)", "N"), out("C", "Rapport de raideur C", ""), out("Fb", "Effort maximal dans une vis", "N"), out("F_slip", "Effort tranchant tenu par frottement", "N"),
    out("tau", "Cisaillement dans la vis", "MPa"), out("sigma_br", "Pression de matage", "MPa"), out("p_head", "Pression sous tête", "MPa"), out("F_strip", "Effort d'arrachement du taraudage", "N"), out("Le_min", "Prise mini pour casser la vis avant le filet", "mm")],
  assumptions: ["Précharge par le couple : Fi = T / (K d). K = 0,2 pour une vis zinguée sèche, 0,15 à 0,18 lubrifiée ; dispersion réelle ± 25 % à la clé dynamométrique.",
    "Section résistante As = π/4 (d − 0,9382 P)² (ISO 898-1) ; la torsion due au serrage n'est pas ajoutée à la traction.",
    "Raideur des pièces par le cône de pression à 30° (Shigley éq. 8-22, un seul matériau), vis filetée sur toute la longueur serrée : C = kb / (kb + km).",
    "Cisaillement repris par le filetage (cas prudent), limite 0,577 Rp0,2 ; matage contre la limite élastique de la tôle la plus mince.",
    "Arrachement du taraudage : aire cisaillée π d Le × 0,875 (profil ISO nominal), résistance 0,6 Rm. Règle pratique : 1,5 d en prise dans l'aluminium, 2 à 2,5 d ou un insert dans un plastique.",
    "Charges statiques, vis uniformément chargées ; pas de fatigue, pas de fluage du plastique sous la tête."],
  validity: "Vis ISO à pas gros M2 à M30, serrage au couple dans le domaine élastique (précharge ≤ 90 % de la charge d'épreuve), assemblage sans joint souple.",
  reference: `VDI 2230 (simplified) ; ${SHIGLEY} — chap. 8 (éq. 8-22, 8-24, 8-27) ; ISO 898-1 ; ISO 3506`,
  fill: { size: "screw", tp: "h", lk: "h", Em: "E", Re_p: "Re", Rm_t: "Rm" },
  compute(i) {
    const S = sheet(), [P, dh] = THREADS[i.size] || THREADS.M6, d = Number(String(i.size).slice(1)) || 6, c = BOLT_CLASSES[i.cls] || BOLT_CLASSES["8.8"];
    const As = PI / 4 * (d - 0.9382 * P) ** 2, Fi = i.T * 1e3 / (i.K * d), sigma_i = Fi / As, Em = i.Em * 1e3, nb = Math.max(1, Math.round(i.nb));
    const kb = As * E_BOLT / i.lk, km = 0.5774 * PI * Em * d / (2 * Math.log(5 * (0.5774 * i.lk + 0.5 * d) / (0.5774 * i.lk + 2.5 * d))), C = kb / (kb + km);
    const Pb = i.Fa / nb, Fb = Fi + C * Pb, Fm = Fi - (1 - C) * Pb, F_sep = nb * Fi / (1 - C), clamp = nb * Math.max(0, Fm), F_slip = i.mu * clamp;
    const tau = i.Fs / (nb * As), tauAdm = SHEAR * c.Re, sigma_br = i.Fs / (nb * d * i.tp);
    S.step(`Vis ${i.size} classe ${i.cls} : pas P = ${n(P)} mm, section résistante As = π/4 (d − 0,9382 P)² = π/4 × (${n(d)} − 0,9382 × ${n(P)})² = ${n(As)} mm² ; Sp = ${c.Sp} MPa, Rp0,2 = ${c.Re} MPa, Rm = ${c.Rm} MPa (ISO 898-1 / ISO 3506).`);
    S.step(`Précharge : Fi = T / (K d) = ${n(i.T)} / (${n(i.K)} × ${n(d / 1e3)}) = ${n(Fi)} N par vis (Shigley, éq. 8-27).`);
    S.step(`Contrainte dans la vis : σ = Fi / As = ${n(Fi)} / ${n(As)} = ${n(sigma_i)} MPa, soit ${n(100 * sigma_i / c.Sp, 3)} % de la charge d'épreuve Sp (visé : 60 à 90 %).`);
    S.step(`Raideurs : kb = As E / l = ${n(kb)} N/mm ; km (cône à 30°) = ${n(km)} N/mm ; C = kb / (kb + km) = ${n(C, 3)} (Shigley, éq. 8-22).`);
    S.step(`Effort axial par vis P = Fa / n = ${n(Pb)} N : vis Fb = Fi + C P = ${n(Fb)} N ; serrage restant Fm = Fi − (1 − C) P = ${n(Fm)} N ; décollement à Fa = n Fi / (1 − C) = ${n(F_sep)} N (Shigley, éq. 8-24).`);
    S.step(`Effort de serrage total : ${n(clamp)} N ; effort tranchant tenu par frottement : μ × serrage = ${n(i.mu)} × ${n(clamp)} = ${n(F_slip)} N.`);
    S.check("Contrainte de précharge vs charge d'épreuve Sp", sigma_i, c.Sp, "MPa", { sf: 1 / 0.9, note: sigma_i > 0.9 * c.Sp && sigma_i <= c.Sp ? "Précharge au-dessus de 90 % de Sp : avec ± 25 % de dispersion la vis peut plastifier." : sigma_i < 0.4 * c.Sp ? "Vis peu serrée (< 40 % de Sp) : risque de desserrage." : "" });
    const p_head = Fi / (PI / 4 * ((1.5 * d) ** 2 - dh ** 2));
    S.step(`Pression sous tête (appui Ø 1,5 d = ${n(1.5 * d)} mm sur trou de passage Ø ${n(dh)} mm) : p = Fi / [π/4 (dw² − dh²)] = ${n(p_head)} MPa.`);
    S.check("Pression sous tête vs limite élastique de la pièce", p_head, i.Re_p, "MPa", { soft: true, note: p_head > i.Re_p ? "La tête marque la pièce et la précharge se perd : ajouter une rondelle ou une tête à embase." : "" });
    if (i.Fa > 0) {
      S.check("Contrainte dans la vis sous charge vs Sp", Fb / As, c.Sp, "MPa", { sf: 1.1 });
      S.check("Décollement : effort axial vs effort de décollement", i.Fa, F_sep, "N", { sf: 1.5, note: Fm <= 0 ? "L'assemblage se décolle : toute la charge passe dans les vis." : "" });
    }
    if (i.Fs > 0) {
      S.step(`Cisaillement dans le filetage : τ = Fs / (n As) = ${n(i.Fs)} / (${nb} × ${n(As)}) = ${n(tau)} MPa, admissible 0,577 Rp0,2 = ${n(tauAdm)} MPa ; matage : σ = Fs / (n d t) = ${n(sigma_br)} MPa.`);
      S.check("Glissement : effort tranchant vs frottement", i.Fs, F_slip, "N", { soft: true, note: i.Fs > F_slip ? "Les pièces glissent : les vis travaillent en cisaillement (prévoir pions ou vis ajustées)." : "Le frottement reprend l'effort tranchant." });
      S.check("Cisaillement des vis vs 0,577 Rp0,2", tau, tauAdm, "MPa", { sf: 1.5 });
      S.check("Matage de la tôle vs limite élastique", sigma_br, i.Re_p, "MPa", { sf: 1.25 });
    }
    const values = { Fi, sigma_i, proof_pct: 100 * sigma_i / c.Sp, clamp, F_sep, C, Fb, F_slip, tau, sigma_br, p_head };
    if (i.mode === "tapped") {
      const tauT = 0.6 * i.Rm_t, F_strip = tauT * PI * d * i.Le * 0.875, Le_min = c.Rm * As / (tauT * PI * d * 0.875);
      S.step(`Arrachement du taraudage : F = 0,6 Rm × π d Le × 0,875 = ${n(tauT)} × π × ${n(d)} × ${n(i.Le)} × 0,875 = ${n(F_strip)} N ; prise mini pour que la vis casse avant le filet : Le = Rm,vis As / (0,6 Rm π d × 0,875) = ${n(Le_min)} mm (${n(Le_min / d, 3)} d).`);
      S.check("Arrachement du taraudage vs effort dans la vis", Fb, F_strip, "N", { sf: 1.5 });
      S.check("Prise de filet vs prise « la vis casse avant le filet »", i.Le, Le_min, "mm", { min: true, soft: true, note: i.Le < Le_min ? "Le taraudage cède avant la vis en cas de surserrage : allonger la prise ou poser un insert." : "" });
      if (i.Le > 2.5 * d) S.warn("Prise supérieure à 2,5 d : les premiers filets portent l'essentiel de l'effort, la longueur en plus ne sert presque plus.");
      Object.assign(values, { F_strip, Le_min });
    }
    if (i.lk < d) S.warn(`Épaisseur serrée (${n(i.lk)} mm) inférieure au diamètre de la vis : vis courte, très raide, qui perd sa précharge au moindre tassement.`);
    return S.set(values);
  } };

/* ---------- interference fit (Lamé thick cylinders) ---------- */
const HUB = "Moyeu", SHAFT = "Arbre";
const pressfit = { id: "press_fit", domain: "joints", sketch: "pressfit", title: "Press fit of a hub on a shaft (Lamé)", fr: "Emmanchement serré d'un moyeu sur un arbre (Lamé)", question: "Le frettage transmet-il le couple sans fendre le moyeu ?",
  inputs: [num("d", "Diamètre nominal de l'ajustement d", "mm", 20, 0.5, 2000, 0.5, GEO), num("L", "Longueur emmanchée L", "mm", 20, 0.5, 2000, 0.5, GEO), num("delta", "Serrage diamétral δ", "µm", 20, 0, 2000, 1, GEO),
    num("mu", "Coefficient de frottement", "", 0.12, 0.01, 1, 0.01, GEO),
    num("Do", "Diamètre extérieur du moyeu", "mm", 40, 0.6, 5000, 0.5, HUB), num("Eh", "Module d'Young du moyeu", "GPa", 205, 0.01, 500, 1, HUB), num("nuh", "Coefficient de Poisson du moyeu", "", 0.29, 0, 0.5, 0.01, HUB), num("Re_h", "Limite élastique du moyeu", "MPa", 370, 1, 3000, 1, HUB),
    num("di", "Diamètre intérieur de l'arbre (0 = plein)", "mm", 0, 0, 2000, 0.5, SHAFT), num("Es", "Module d'Young de l'arbre", "GPa", 205, 0.01, 500, 1, SHAFT), num("nus", "Coefficient de Poisson de l'arbre", "", 0.29, 0, 0.5, 0.01, SHAFT), num("Re_s", "Limite élastique de l'arbre", "MPa", 370, 1, 3000, 1, SHAFT),
    num("Treq", "Couple à transmettre (0 = sans objet)", "N·m", 0, 0, 1e6, 1, CRIT), num("Freq", "Effort axial à tenir (0 = sans objet)", "N", 0, 0, 1e8, 10, CRIT), num("sf", "Coefficient de sécurité demandé", "", 1.5, 1, 10, 0.1, CRIT)],
  outputs: [out("p", "Pression de contact", "MPa"), out("torque", "Couple transmissible", "N·m"), out("force", "Effort axial transmissible (= effort de montage)", "N"), out("sigma_hoop", "Contrainte tangentielle du moyeu", "MPa"),
    out("vm_hub", "von Mises à l'alésage du moyeu", "MPa"), out("vm_shaft", "von Mises dans l'arbre", "MPa")],
  assumptions: ["Cylindres épais de Lamé, même longueur, pression de contact uniforme (pas d'effet de bord).", "Serrage diamétral effectif : la perte par écrasement des rugosités (≈ 0,8 (Rz₁ + Rz₂)) est à retirer du serrage mesuré.",
    "Frottement sec acier / acier 0,10 à 0,15 ; aluminium ou montage huilé : prendre 0,08.", "Pas de force centrifuge ni de dilatation différentielle (à ajouter si les matériaux diffèrent et que la température varie)."],
  validity: "Domaine élastique (von Mises < Re des deux pièces) ; L / d entre 0,5 et 2 environ ; calculer aux serrages mini et maxi de l'ajustement.",
  reference: `${SHIGLEY} — chap. 3 (press and shrink fits) et chap. 7 (éq. 7-39 à 7-41) ; Lamé`,
  fill: { Do: "b", L: "h", Eh: "E", Re_h: "Re", nuh: "nu" },
  compute(i) {
    const S = sheet(), d = i.d, dl = i.delta * 1e-3, Eh = i.Eh * 1e3, Es = i.Es * 1e3;
    let Do = i.Do, di = i.di;
    if (Do <= d) { Do = 2 * d; S.warn("Diamètre extérieur du moyeu ≤ diamètre de l'ajustement : calcul fait avec Do = 2 d."); }
    if (di >= d) { di = 0; S.warn("Diamètre intérieur de l'arbre ≥ diamètre de l'ajustement : arbre calculé plein."); }
    const kh = (Do * Do + d * d) / (Do * Do - d * d), ks = (d * d + di * di) / (d * d - di * di);
    const p = dl / (d * ((kh + i.nuh) / Eh + (ks - i.nus) / Es)), hoop = p * kh, vmH = Math.sqrt(hoop * hoop + hoop * p + p * p), vmS = di > 0 ? 2 * p * d * d / (d * d - di * di) : p;
    const force = PI * d * i.L * i.mu * p, torque = force * d / 2 / 1e3;
    S.step(`Coefficients de Lamé : moyeu (Do² + d²) / (Do² − d²) = ${n(kh)} ; arbre (d² + dᵢ²) / (d² − dᵢ²) = ${n(ks)}.`);
    S.step(`Pression de contact : p = δ / { d [ (${n(kh)} + ν_m) / E_m + (${n(ks)} − ν_a) / E_a ] } = ${n(dl)} / { ${n(d)} × [ ${n((kh + i.nuh) / Eh)} + ${n((ks - i.nus) / Es)} ] } = ${n(p)} MPa (Shigley, éq. 7-39).`);
    S.step(`Moyeu, à l'alésage : σt = p (Do² + d²) / (Do² − d²) = ${n(hoop)} MPa, σr = −p ; von Mises = √(σt² + σt p + p²) = ${n(vmH)} MPa.`);
    S.step(`Arbre : ${di > 0 ? `σt = −2 p d² / (d² − dᵢ²) = −${n(vmS)} MPa à l'alésage` : `σt = σr = −p, von Mises = ${n(vmS)} MPa`}.`);
    S.step(`Effort axial : F = π d L μ p = π × ${n(d)} × ${n(i.L)} × ${n(i.mu)} × ${n(p)} = ${n(force)} N ; couple : T = F d / 2 = ${n(torque)} N·m (Shigley, éq. 7-40 et 7-41).`);
    S.check("von Mises à l'alésage du moyeu vs limite élastique", vmH, i.Re_h, "MPa", { sf: 1.2 });
    S.check("von Mises dans l'arbre vs limite élastique", vmS, i.Re_s, "MPa", { sf: 1.2 });
    if (i.Treq > 0) S.check("Couple à transmettre vs couple transmissible", i.Treq, torque, "N·m", { sf: i.sf });
    if (i.Freq > 0) S.check("Effort axial à tenir vs effort transmissible", i.Freq, force, "N", { sf: i.sf });
    if (i.L / d < 0.3 || i.L / d > 3) S.warn(`L / d = ${n(i.L / d, 3)} : hors de la plage usuelle 0,5 à 2 (pression non uniforme, effets de bord).`);
    return S.set({ p, torque, force, sigma_hoop: hoop, vm_hub: vmH, vm_shaft: vmS });
  } };

/* ---------- dowel pin in shear ---------- */
const pin = { id: "dowel_pin", domain: "joints", sketch: "pin", title: "Dowel or locating pin in shear", fr: "Goupille ou pion de centrage en cisaillement", question: "La goupille reprend-elle l'effort tranchant sans se cisailler ni mater les pièces ?",
  inputs: [num("d", "Diamètre de la goupille d", "mm", 6, 0.5, 100, 0.5, GEO), num("np", "Nombre de goupilles", "", 1, 1, 50, 1, GEO),
    opt("planes", "Plans de cisaillement", "1", [{ value: "1", label: "Simple cisaillement (2 pièces)" }, { value: "2", label: "Double cisaillement (chape)" }], GEO),
    num("t", "Épaisseur portante la plus faible", "mm", 6, 0.1, 500, 0.5, GEO), num("F", "Effort tranchant total F", "N", 2000, 0, 1e8, 10, LOAD),
    num("Re_pin", "Limite élastique de la goupille", "MPa", 600, 1, 3000, 10, MAT), num("Re_p", "Limite élastique des pièces", "MPa", 276, 1, 3000, 1, MAT), num("sf", "Coefficient de sécurité demandé", "", 2, 1, 10, 0.1, CRIT)],
  outputs: [out("tau", "Cisaillement moyen", "MPa"), out("sf_shear", "Marge en cisaillement", ""), out("sigma_br", "Pression de matage", "MPa"), out("F_max", "Effort admissible (cisaillement, au coefficient demandé)", "N")],
  assumptions: ["Cisaillement moyen τ = F / (n × plans × π d² / 4), comparé à 0,577 Re de la goupille (von Mises).", "Goupille ajustée serrée, sans jeu : pas de flexion de la goupille ; les goupilles se partagent également l'effort.",
    "Matage : pression moyenne F / (n d t) sur l'épaisseur portante la plus faible, comparée à la limite élastique des pièces.", "Goupille en acier trempé (ISO 8734) : Re ≥ 1000 MPa ; inox A1 (ISO 2338) : ≈ 210 MPa — saisir la valeur du fournisseur."],
  validity: "Charge statique ; épaisseur portante ≥ d / 2 ; distance au bord ≥ 1,5 d (sinon vérifier l'arrachement du bord).",
  reference: `${SHIGLEY} — chap. 3 (cisaillement direct) et chap. 8 (joints en cisaillement)`,
  fill: { t: "h", Re_p: "Re", d: "d_hole" },
  compute(i) {
    const S = sheet(), np = Math.max(1, Math.round(i.np)), planes = i.planes === "2" ? 2 : 1, A = PI * i.d * i.d / 4;
    const tau = i.F / (np * planes * A), tauAdm = SHEAR * i.Re_pin, sigma_br = i.F / (np * i.d * i.t);
    S.step(`Section d'une goupille : A = π d² / 4 = π × ${n(i.d)}² / 4 = ${n(A)} mm².`);
    S.step(`Cisaillement moyen : τ = F / (n × plans × A) = ${n(i.F)} / (${np} × ${planes} × ${n(A)}) = ${n(tau)} MPa ; admissible 0,577 Re = ${n(tauAdm)} MPa ; marge = ${n(tauAdm / tau, 3)} (Shigley, chap. 3).`);
    S.step(`Matage des pièces : σ = F / (n d t) = ${n(i.F)} / (${np} × ${n(i.d)} × ${n(i.t)}) = ${n(sigma_br)} MPa pour Re = ${n(i.Re_p)} MPa.`);
    if (i.t < i.d / 2) S.warn("Épaisseur portante inférieure à d / 2 : le matage et la flexion de la goupille dominent.");
    S.check("Cisaillement de la goupille vs 0,577 Re", tau, tauAdm, "MPa", { sf: i.sf });
    S.check("Matage des pièces vs limite élastique", sigma_br, i.Re_p, "MPa", { sf: 1.25 });
    return S.set({ tau, sf_shear: Math.min(999, tauAdm / tau), sigma_br, F_max: tauAdm * np * planes * A / i.sf });
  } };

/* ---------- a pressure contact of spring blades, pressed until its stop : a crown of lanced bridge blades (JP, 21 novembre 2026 : « simuler le
   déplacement, la déformation plastique de ces contacts jusqu'à ce qu'on arrive à des butées ») ----------
   Each blade is a strip built in at both feet and pushed at mid-span by the face in front : elastic up to the first yield (the moment F l / 8 at
   the feet and at mid-span reaches My), then the force climbs toward the collapse load of the three plastic hinges, 1.5 × the first-yield load for
   a rectangular section. Between the two, the tool takes F = Fp − 0.5 Fy (δy / δ)², which joins the elastic line with the same slope and tends to
   Fp : a shape chosen by the tool, not an exact solution. Held at the stop, the blade carries F(δ) ; taken apart, it springs back by F / k. */
const PLC = "Revêtement et courant";
const springStop = { id: "spring_stop", domain: "joints", sketch: "spring", title: "Spring-blade contact pressed to its stop", fr: "Contact à lames pressé jusqu'à sa butée",
  question: "Les lames du contact restent-elles élastiques jusqu'à la butée, et le contact porte-t-il son courant ?",
  inputs: [num("n", "Nombre de lames de la couronne", "", 12, 1, 48, 1, GEO), num("l", "Portée d'une lame, entre ses deux pieds", "mm", 8, 1, 40, 0.5, GEO),
    num("w", "Largeur d'une lame", "mm", 2.5, 0.2, 10, 0.1, GEO), num("t", "Épaisseur d'une lame", "mm", 0.25, 0.05, 1.5, 0.01, GEO),
    num("lift", "Bombé libre d'une lame, au-dessus de son pied", "mm", 0.5, 0.05, 5, 0.05, GEO), num("hs", "Hauteur de la butée, au-dessus du pied des lames", "mm", 0.35, 0, 5, 0.05, GEO),
    num("E", "Module d'Young des lames", "GPa", 131, 10, 400, 1, MAT), num("Re", "Limite élastique des lames", "MPa", 1000, 50, 3000, 10, MAT), num("rhoB", "Résistivité des lames", "nΩ·m", 78, 10, 2000, 1, MAT),
    opt("plating", "Revêtement des points de contact", "Ag", Object.entries(PLATINGS).map(([k, p]) => ({ value: k, label: `${p.fr} (${p.label})` })), PLC),
    num("I", "Courant porté par ce contact", "A", 180, 0, 5000, 1, PLC), num("Fmin", "Effort minimal par lame (percer les films)", "N", 1, 0.05, 50, 0.1, CRIT), num("Jmax", "Densité de courant repère dans une lame", "A/mm²", 15, 1, 100, 1, CRIT)],
  outputs: [out("F", "Effort total du contact à la butée", "N"), out("Fb", "Effort d'une lame à la butée", "N"), out("set", "Déformation permanente après démontage", "mm"), out("R", "Résistance du contact (points + lames)", "µΩ"),
    out("ds", "Course imposée par la butée", "mm"), out("dy", "Course élastique d'une lame", "mm"), out("k", "Raideur d'une lame", "N/mm"), out("Fy", "Effort de première plastification", "N"), out("Fp", "Effort de ruine (trois rotules)", "N"),
    out("Rc", "Résistance des points de contact (Holm)", "µΩ"), out("Rb", "Résistance des lames", "µΩ"), out("dU", "Chute de tension", "mV"), out("P", "Pertes", "W"), out("iMax", "Courant estimé admissible", "A"), out("J", "Densité de courant dans une lame", "A/mm²")],
  assumptions: ["Une lame est une bande encastrée à ses deux pieds, poussée en son milieu : k = 192 E I / l³ avec I = w t³ / 12 ; le moment F l / 8 est le même aux pieds et au milieu.",
    "Première plastification quand σ = 12 E t δ / l² atteint Re : δy = Re l² / (12 E t). Charge de ruine des trois rotules plastiques : Fp = 1,5 Fy (section rectangulaire).",
    "Au-delà de δy, l'outil prend F = Fp − 0,5 Fy (δy / δ)² : même effort et même pente que la droite élastique en δy, et Fp à l'infini — une forme choisie, pas une solution exacte.",
    "Démontée, la lame revient de F / k : la déformation permanente est δ − F / k. Pas d'écrouissage, pas de fluage ni de relaxation à chaud (une lame en alliage de cuivre perd de l'effort avec le temps et la température).",
    "Un point de contact par lame, au sommet de son arche ; résistance de Holm ρ / (2 a) avec a = √(F / (π H)) ; le courant entre au sommet et se partage entre les deux demi-portées."],
  validity: "Lames minces (t ≤ l / 10), plates avant cambrage, faces d'en face planes et rigides ; un ordre de grandeur pour dimensionner, à recaler par un essai d'écrasement et de résistance sur une couronne réelle.",
  reference: "Roark's Formulas for Stress and Strain — poutre bi-encastrée chargée en son milieu ; Neal, The Plastic Methods of Structural Analysis (rotules plastiques, Mp = 1,5 My) ; Holm, Electric Contacts (résistance de constriction)",
  fill: { t: "h" },
  compute(i) {
    const S = sheet(), P = PLATINGS[i.plating] || PLATINGS.Ag, nb = Math.max(1, Math.round(i.n)), E = i.E * 1e3, Ib = i.w * i.t ** 3 / 12, k = 192 * E * Ib / i.l ** 3;
    const dy = i.Re * i.l * i.l / (12 * E * i.t), Fy = k * dy, Fp = 1.5 * Fy, ds = Math.max(0, i.lift - i.hs);
    const Fb = ds <= 0 ? 0 : ds <= dy ? k * ds : Fp - 0.5 * Fy * (dy / ds) ** 2, set = ds > dy ? ds - Fb / k : 0, F = nb * Fb;
    const a = Math.sqrt(Math.max(Fb, 1e-9) / (PI * P.H)), rPoint = P.rho / (2 * a), Rc = rPoint / nb, Rb = (i.rhoB * 1e-9 * (i.l / 2) * 1e-3 / (i.w * i.t * 1e-6)) / 2 / nb, R = Rc + Rb;
    const iMax = 0.1 * P.soften / rPoint * nb * 0.8, J = i.I / nb / 2 / (i.w * i.t), sig = Math.min(i.Re, 12 * E * i.t * Math.min(ds, dy) / i.l ** 2);
    S.step(`Raideur d'une lame bi-encastrée : k = 192 E I / l³ = 192 × ${n(E)} × ${n(Ib)} / ${n(i.l)}³ = ${n(k)} N/mm (I = w t³ / 12 = ${n(Ib)} mm⁴).`);
    S.step(`Course élastique : δy = Re l² / (12 E t) = ${n(i.Re)} × ${n(i.l)}² / (12 × ${n(E)} × ${n(i.t)}) = ${n(dy)} mm ; effort de première plastification Fy = k δy = ${n(Fy)} N, de ruine Fp = 1,5 Fy = ${n(Fp)} N.`);
    S.step(`Course imposée par la butée : δ = bombé − butée = ${n(i.lift)} − ${n(i.hs)} = ${n(ds)} mm ; ${ds <= dy ? `élastique : F = k δ = ${n(Fb)} N par lame, contrainte ${n(sig)} MPa` : `au-delà de δy : F = Fp − 0,5 Fy (δy / δ)² = ${n(Fb)} N par lame ; démontée, la lame garde ${n(set, 3)} mm de déformation`}.`);
    S.step(`Effort total à la butée : F = n Fb = ${nb} × ${n(Fb)} = ${n(F)} N — l'effort que la butée ne prend pas : le reste de la compression du module passe par la butée.`);
    S.step(`Résistance : points (Holm, ${P.fr.toLowerCase()}) a = √(F / (π H)) = ${n(a * 1e6)} µm, ρ / (2 a) = ${n(rPoint * 1e6)} µΩ par point, ${n(Rc * 1e6)} µΩ pour ${nb} ; lames ${n(Rb * 1e6)} µΩ (deux demi-portées en parallèle) ; total R = ${n(R * 1e6)} µΩ.`);
    S.step(`Au courant de ${n(i.I)} A : chute ΔU = R I = ${n(R * i.I * 1e3)} mV, pertes P = R I² = ${n(R * i.I * i.I)} W ; densité dans une demi-lame J = I / (2 n w t) = ${n(J)} A/mm².`);
    if (ds <= 0) S.warn("Le bombé ne dépasse pas la butée : les lames ne touchent pas la face d'en face, le contact ne passe que par la butée.");
    if (i.t > i.l / 10) S.warn("Lame épaisse (t > l / 10) : la flexion simple ne suffit plus, le cisaillement compte.");
    S.check("Effort par lame vs effort minimal", Fb, i.Fmin, "N", { min: true, note: Fb < i.Fmin ? "Trop peu d'effort pour percer les films d'oxyde : plus de bombé, une lame plus épaisse, ou de l'or." : "" });
    S.check("Courant vs courant estimé admissible (Holm)", i.I, iMax, "A");
    S.check("Course à la butée vs course élastique", ds, dy, "mm", { soft: true, note: ds > dy ? `Les lames plastifient à la première pose et gardent ${n(set, 3)} mm : voulu si la couronne doit se mettre en place une fois pour toutes, à éviter si elle doit se reprendre.` : "" });
    S.check("Densité de courant dans une lame vs repère", J, i.Jmax, "A/mm²", { soft: true, note: J > i.Jmax ? "Lames chargées : plus de lames, plus larges, ou un alliage plus conducteur." : "" });
    return S.set({ F, Fb, set, R: R * 1e6, ds, dy, k, Fy, Fp, Rc: Rc * 1e6, Rb: Rb * 1e6, dU: R * i.I * 1e3, P: R * i.I * i.I, iMax, J });
  } };

export const JOINTS = [bolt, pressfit, pin, springStop];
