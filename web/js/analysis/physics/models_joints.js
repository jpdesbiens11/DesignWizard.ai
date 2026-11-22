/* DynamiteOrbit — Physique, joints: metric bolted joint (torque → preload, bolt stress, shear, bearing, thread
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
    num("tol", "Tolérance sur la course (±) : bombé, butée, planéité", "mm", 0, 0, 1, 0.01, GEO),
    num("E", "Module d'Young des lames", "GPa", 131, 10, 400, 1, MAT), num("Re", "Limite élastique des lames", "MPa", 1000, 50, 3000, 10, MAT), num("rhoB", "Résistivité des lames", "nΩ·m", 78, 10, 2000, 1, MAT),
    opt("plating", "Revêtement des points de contact", "Ag", Object.entries(PLATINGS).map(([k, p]) => ({ value: k, label: `${p.fr} (${p.label})` })), PLC),
    num("I", "Courant porté par ce contact", "A", 180, 0, 5000, 1, PLC), num("Fmin", "Effort minimal par lame (percer les films)", "N", 1, 0.05, 50, 0.1, CRIT), num("Jmax", "Densité de courant repère dans une lame", "A/mm²", 15, 1, 100, 1, CRIT)],
  outputs: [out("F", "Effort total du contact à la butée", "N"), out("Fb", "Effort d'une lame à la butée", "N"), out("set", "Déformation permanente après démontage", "mm"), out("R", "Résistance du contact (points + lames)", "µΩ"),
    out("ds", "Course imposée par la butée", "mm"), out("dy", "Course élastique d'une lame", "mm"), out("k", "Raideur d'une lame", "N/mm"), out("Fy", "Effort de première plastification", "N"), out("Fp", "Effort de ruine (trois rotules)", "N"),
    out("Rc", "Résistance des points de contact (Holm)", "µΩ"), out("Rb", "Résistance des lames", "µΩ"), out("dU", "Chute de tension", "mV"), out("P", "Pertes", "W"), out("iMax", "Courant estimé admissible", "A"), out("J", "Densité de courant dans une lame", "A/mm²"),
    out("dsMax", "Course la plus longue (tolérance comprise)", "mm"), out("FbMin", "Effort d'une lame à la course la plus courte", "N")],
  assumptions: ["Une lame est une bande encastrée à ses deux pieds, poussée en son milieu : k = 192 E I / l³ avec I = w t³ / 12 ; le moment F l / 8 est le même aux pieds et au milieu.",
    "Première plastification quand σ = 12 E t δ / l² atteint Re : δy = Re l² / (12 E t). Charge de ruine des trois rotules plastiques : Fp = 1,5 Fy (section rectangulaire).",
    "Au-delà de δy, l'outil prend F = Fp − 0,5 Fy (δy / δ)² : même effort et même pente que la droite élastique en δy, et Fp à l'infini — une forme choisie, pas une solution exacte.",
    "Démontée, la lame revient de F / k : la déformation permanente est δ − F / k. Pas d'écrouissage, pas de fluage ni de relaxation à chaud (une lame en alliage de cuivre perd de l'effort avec le temps et la température).",
    "Un point de contact par lame, au sommet de son arche ; résistance de Holm ρ / (2 a) avec a = √(F / (π H)) ; le courant entre au sommet et se partage entre les deux demi-portées.",
    "La butée fixe l'écart entre les deux faces : la course ne dépend que du bombé, de la butée et de la planéité. Sa tolérance ± se vérifie aux deux bouts — l'effort minimal à la course la plus courte, l'élasticité à la plus longue."],
  validity: "Lames minces (t ≤ l / 10), plates avant cambrage, faces d'en face planes et rigides ; un ordre de grandeur pour dimensionner, à recaler par un essai d'écrasement et de résistance sur une couronne réelle.",
  reference: "Roark's Formulas for Stress and Strain — poutre bi-encastrée chargée en son milieu ; Neal, The Plastic Methods of Structural Analysis (rotules plastiques, Mp = 1,5 My) ; Holm, Electric Contacts (résistance de constriction)",
  fill: { t: "h" },
  compute(i) {
    const S = sheet(), P = PLATINGS[i.plating] || PLATINGS.Ag, nb = Math.max(1, Math.round(i.n)), E = i.E * 1e3, Ib = i.w * i.t ** 3 / 12, k = 192 * E * Ib / i.l ** 3;
    const dy = i.Re * i.l * i.l / (12 * E * i.t), Fy = k * dy, Fp = 1.5 * Fy, ds = Math.max(0, i.lift - i.hs), tol = Math.max(0, i.tol || 0), dsMax = ds + tol, dsMin = Math.max(0, ds - tol);
    const curve = (d) => (d <= 0 ? 0 : d <= dy ? k * d : Fp - 0.5 * Fy * (dy / d) ** 2), Fb = curve(ds), FbMin = curve(dsMin), set = ds > dy ? ds - Fb / k : 0, F = nb * Fb;
    const a = Math.sqrt(Math.max(Fb, 1e-9) / (PI * P.H)), rPoint = P.rho / (2 * a), Rc = rPoint / nb, Rb = (i.rhoB * 1e-9 * (i.l / 2) * 1e-3 / (i.w * i.t * 1e-6)) / 2 / nb, R = Rc + Rb;
    const iMax = 0.1 * P.soften / rPoint * nb * 0.8, J = i.I / nb / 2 / (i.w * i.t), sig = Math.min(i.Re, 12 * E * i.t * Math.min(ds, dy) / i.l ** 2);
    S.step(`Raideur d'une lame bi-encastrée : k = 192 E I / l³ = 192 × ${n(E)} × ${n(Ib)} / ${n(i.l)}³ = ${n(k)} N/mm (I = w t³ / 12 = ${n(Ib)} mm⁴).`);
    S.step(`Course élastique : δy = Re l² / (12 E t) = ${n(i.Re)} × ${n(i.l)}² / (12 × ${n(E)} × ${n(i.t)}) = ${n(dy)} mm ; effort de première plastification Fy = k δy = ${n(Fy)} N, de ruine Fp = 1,5 Fy = ${n(Fp)} N.`);
    S.step(`Course imposée par la butée : δ = bombé − butée = ${n(i.lift)} − ${n(i.hs)} = ${n(ds)} mm ; ${ds <= dy ? `élastique : F = k δ = ${n(Fb)} N par lame, contrainte ${n(sig)} MPa` : `au-delà de δy : F = Fp − 0,5 Fy (δy / δ)² = ${n(Fb)} N par lame ; démontée, la lame garde ${n(set, 3)} mm de déformation`}.`);
    S.step(`Effort total à la butée : F = n Fb = ${nb} × ${n(Fb)} = ${n(F)} N — l'effort que la butée ne prend pas : le reste de la compression du module passe par la butée.`);
    if (tol > 0) S.step(`Tolérance ± ${n(tol)} mm : la course va de ${n(dsMin)} à ${n(dsMax)} mm ; à la plus courte, ${n(FbMin)} N par lame ; à la plus longue, ${dsMax <= dy ? `toujours élastique (${n(dsMax / dy * 100)} % de δy)` : "la lame plastifie"}.`);
    S.step(`Résistance : points (Holm, ${P.fr.toLowerCase()}) a = √(F / (π H)) = ${n(a * 1e6)} µm, ρ / (2 a) = ${n(rPoint * 1e6)} µΩ par point, ${n(Rc * 1e6)} µΩ pour ${nb} ; lames ${n(Rb * 1e6)} µΩ (deux demi-portées en parallèle) ; total R = ${n(R * 1e6)} µΩ.`);
    S.step(`Au courant de ${n(i.I)} A : chute ΔU = R I = ${n(R * i.I * 1e3)} mV, pertes P = R I² = ${n(R * i.I * i.I)} W ; densité dans une demi-lame J = I / (2 n w t) = ${n(J)} A/mm².`);
    if (ds <= 0) S.warn("Le bombé ne dépasse pas la butée : les lames ne touchent pas la face d'en face, le contact ne passe que par la butée.");
    if (i.t > i.l / 10) S.warn("Lame épaisse (t > l / 10) : la flexion simple ne suffit plus, le cisaillement compte.");
    S.check("Effort par lame vs effort minimal", FbMin, i.Fmin, "N", { min: true, note: FbMin < i.Fmin ? "Trop peu d'effort pour percer les films d'oxyde : plus de bombé, une lame plus épaisse, ou de l'or." : "" });
    S.check("Courant vs courant estimé admissible (Holm)", i.I, iMax, "A");
    S.check("Course à la butée vs course élastique", dsMax, dy, "mm", { soft: true, note: dsMax > dy ? `Les lames plastifient à la première pose${set > 0 ? ` et gardent ${n(set, 3)} mm` : " au pire des cotes"} : voulu si la couronne doit se mettre en place une fois pour toutes, à éviter si elle doit se reprendre.` : "" });
    S.check("Densité de courant dans une lame vs repère", J, i.Jmax, "A/mm²", { soft: true, note: J > i.Jmax ? "Lames chargées : plus de lames, plus larges, ou un alliage plus conducteur." : "" });
    return S.set({ F, Fb, set, R: R * 1e6, ds, dy, k, Fy, Fp, Rc: Rc * 1e6, Rb: Rb * 1e6, dU: R * i.I * 1e3, P: R * i.I * i.I, iMax, J, dsMax, FbMin });
  } };

/* A louvred contact strip between two flat faces (JP, 21 novembre 2026 : « fais-les en lamelles unidirectionnelles, en te basant sur un cas réel
   de l'industrie ») : the rules the makers print, nothing more — n louvres = length / pitch, the joint resistance Rk / n, the joint current n ×
   the current of a louvre (The MULTILAM Principle, Multi-Contact AG 2011, p. 13) ; the drop and its classes (p. 9 : < 5 mV very good, 5–12 good,
   13–25 usable) ; the 12.5 mV limit of a rated current (Stäubli fork plugs catalogue, US, p. 10) ; the derating of the mating metal (Weftron
   LOUVER_tron datasheets, p. 2 : Cu 1, E-Al 0.75, CuZn39Pb3 0.60) ; the working height range of a strip (Weftron 112, p. 2 : 1.5–1.9 mm). The
   values of a louvre are those of a maker's sheet, typed with their source : the model does not invent them. */
const STRIP = "Bande à lamelles", SHEET = "Fiche de la bande (fabricant)", JOINT = "Joint et courant";
const MATES = { cu: { k: 1, label: "Cuivre argenté (1)" }, al: { k: 0.75, label: "Aluminium E-Al (0,75)" }, brass: { k: 0.6, label: "Laiton CuZn39Pb3 (0,60)" } };
const louvreStrip = { id: "louvre_strip", domain: "joints", sketch: "louvre", title: "Louvred contact strip between two flat faces", fr: "Bande de contact à lamelles entre deux faces planes",
  question: "Combien de lamelles faut-il pour porter le courant, avec quelle chute de tension, et la hauteur tenue reste-t-elle dans la plage de la bande ?",
  inputs: [num("strips", "Nombre de bandes dans le joint", "", 2, 1, 20, 1, STRIP), num("L", "Longueur d'une bande", "mm", 40, 2, 1000, 0.5, STRIP),
    num("p", "Pas des lamelles", "mm", 3.5, 0.3, 10, 0.05, SHEET), num("Il", "Courant assigné d'une lamelle", "A", 40, 0.01, 500, 0.5, SHEET),
    num("Rl", "Résistance de contact d'une lamelle", "µΩ", 300, 1, 100000, 1, SHEET), num("Fl", "Effort de contact d'une lamelle", "N", 7, 0.05, 200, 0.1, SHEET),
    num("hMin", "Hauteur de travail la plus basse de la bande", "mm", 1.5, 0.1, 20, 0.05, SHEET), num("hMax", "Hauteur de travail la plus haute de la bande", "mm", 1.9, 0.1, 20, 0.05, SHEET),
    opt("mate", "Matière de la face d'en face (déclassement)", "cu", Object.entries(MATES).map(([k, v]) => ({ value: k, label: v.label })), JOINT),
    num("h", "Hauteur tenue par les butées (l'écart entre les deux faces)", "mm", 1.7, 0.1, 20, 0.01, JOINT), num("tol", "Tolérance sur cette hauteur (±)", "mm", 0.05, 0, 2, 0.01, JOINT),
    num("I", "Courant porté par le joint", "A", 360, 0, 1e5, 1, JOINT), num("Umax", "Chute de tension admise", "mV", 12.5, 0.1, 100, 0.1, CRIT)],
  outputs: [out("n", "Nombre de lamelles du joint", ""), out("Irat", "Courant assigné du joint (déclassé)", "A"), out("R", "Résistance du joint", "µΩ"), out("dU", "Chute de tension", "mV"), out("P", "Pertes", "W"),
    out("F", "Effort pour fermer le joint", "N"), out("use", "Part du courant assigné utilisée", "%"), out("hLo", "Hauteur la plus basse (tolérance comprise)", "mm"), out("hHi", "Hauteur la plus haute (tolérance comprise)", "mm")],
  assumptions: ["Une lamelle par pas : n = nombre de bandes × partie entière de (longueur / pas) (The MULTILAM Principle, p. 13).",
    "Les lamelles sont en parallèle : R = Rk / n, I assigné = n × I d'une lamelle (même page) ; déclassé par la matière d'en face (fiches LOUVER_tron, p. 2).",
    "Chute de tension ΔU = R I : moins de 5 mV très bon, 5 à 12 bon, 13 à 25 utilisable (The MULTILAM Principle, p. 9) ; 12,5 mV est la limite qu'un fabricant prend pour son courant assigné (catalogue des fiches à fourche, p. 10).",
    "Effort pour fermer le joint : n × l'effort d'une lamelle — celui que les plaques de bout doivent fournir au moins ; les butées prennent le reste.",
    "La hauteur tenue par les butées, tolérance comprise, doit rester dans la plage de travail de la bande (fiche LOUVER_tron 112, p. 2 : 1,5 à 1,9 mm)."],
  validity: "Valeurs d'une lamelle lues sur la fiche du fabricant, contre du cuivre argenté propre, rugosité N6, à 20 °C (The MULTILAM Principle, p. 13) : la tenue en température, l'usure et le nombre de manœuvres se lisent sur la fiche du type choisi ; un essai sur le joint réel fait foi.",
  reference: "Multi-Contact AG (Stäubli), The MULTILAM Principle, 2011, p. 9, 13, 16 ; Stäubli, Fork plug connectors (US), p. 10 ; Weftron, LOUVER_tron 112, p. 2 — pages publiques lues",
  compute(i) {
    const S = sheet(), nb = Math.max(1, Math.round(i.strips)), per = Math.floor(i.L / i.p + 1e-9), nl = nb * per, k = (MATES[i.mate] || MATES.cu).k, Irat = nl * i.Il * k, R = nl ? i.Rl / nl : 1e9;      // no louvre : the joint does not conduct — a resistance that says so, not an infinity
    const dU = R * 1e-6 * i.I * 1e3, P = R * 1e-6 * i.I * i.I, F = nl * i.Fl, hLo = i.h - Math.max(0, i.tol || 0), hHi = i.h + Math.max(0, i.tol || 0);
    S.step(`Lamelles : ${nb} bande(s) × ⌊${n(i.L)} / ${n(i.p)}⌋ = ${nb} × ${per} = ${nl} lamelles en parallèle.`);
    S.step(`Courant assigné : n × I d'une lamelle × déclassement = ${nl} × ${n(i.Il)} × ${n(k)} = ${n(Irat)} A ; le joint en porte ${n(i.I)} A, soit ${n(i.I / Irat * 100)} %.`);
    S.step(`Résistance : Rk / n = ${n(i.Rl)} / ${nl} = ${n(R)} µΩ ; chute ΔU = R I = ${n(dU)} mV (${dU < 5 ? "très bon" : dU <= 12 ? "bon" : dU <= 25 ? "utilisable" : "au-delà de ce que la fiche classe"}), pertes P = R I² = ${n(P)} W.`);
    S.step(`Effort pour fermer le joint : n × F d'une lamelle = ${nl} × ${n(i.Fl)} = ${n(F)} N — au moins ce que la compression du module doit fournir.`);
    S.step(`Hauteur : ${n(i.h)} ± ${n(i.tol)} mm, soit ${n(hLo)} à ${n(hHi)} mm, pour une bande qui travaille de ${n(i.hMin)} à ${n(i.hMax)} mm.`);
    if (per < 1) S.warn("La bande est plus courte qu'un pas : aucune lamelle.");
    S.check("Courant du joint vs courant assigné", i.I, Irat, "A");
    S.check("Chute de tension vs chute admise", dU, i.Umax, "mV");
    S.check("Hauteur la plus basse vs plage de la bande", hLo, i.hMin, "mm", { min: true, note: hLo < i.hMin ? "La bande serait écrasée au-delà de sa plage : une butée plus haute." : "" });
    S.check("Hauteur la plus haute vs plage de la bande", hHi, i.hMax, "mm", { note: hHi > i.hMax ? "Les lamelles ne toucheraient plus assez : une butée plus basse." : "" });
    return S.set({ n: nl, Irat, R, dU, P, F, use: Irat > 0 ? i.I / Irat * 100 : 999, hLo, hHi });
  } };

/* ---------- a thread-forming screw in a plastic boss (JP, 22 novembre 2026 : the screws of the lids of the BM go into the extruded polycarbonate
   « des vis autotaraudeuses y font leurs filets au premier assemblage ») : the pull-out force as one public page prints it, F = Ss π Dp L with
   Ss = St / √3 (Engineers Edge, « Self Tapping Screws Installation Design », read on 22 November 2026) ; its rules of thumb said as warnings —
   the engaged length where the stripping torque levels off (about 2.5 Dp), the boss of about 2.5 d. The page prints no worked example. ---------- */
const plasticScrew = { id: "plastic_screw", domain: "joints", sketch: "plasticscrew", title: "Thread-forming screw in a plastic boss (pull-out)", fr: "Vis autotaraudeuse dans un bossage plastique (arrachement)",
  question: "La vis tient-elle dans le plastique sans arracher le filet qu'elle y a formé ?",
  inputs: [num("d", "Diamètre nominal de la vis d", "mm", 4, 1, 20, 0.1, GEO), num("Dp", "Diamètre sur flancs Dp (le trou égale Dp)", "mm", 3.4, 0.5, 20, 0.05, GEO),
    num("L", "Longueur de filet en prise L", "mm", 10, 0.5, 100, 0.5, GEO), num("Db", "Diamètre extérieur du bossage", "mm", 10, 1, 100, 0.5, GEO),
    num("F", "Effort axial par vis F", "N", 200, 0, 1e6, 10, LOAD), num("St", "Limite élastique en traction du plastique", "MPa", 62, 1, 500, 1, MAT), num("sf", "Coefficient de sécurité demandé", "", 3, 1, 20, 0.1, CRIT)],
  outputs: [out("Ss", "Cisaillement admis St / √3", "MPa"), out("A", "Aire cisaillée π Dp L", "mm²"), out("F_pull", "Effort d'arrachement", "N"), out("sf_pull", "Marge à l'arrachement", ""),
    out("F_max", "Effort admissible par vis (au coefficient demandé)", "N"), out("L_Dp", "Prise rapportée au diamètre sur flancs L / Dp", ""), out("Db_d", "Bossage rapporté à la vis Db / d", "")],
  assumptions: ["Arrachement : le plastique se cisaille le long du cylindre de diamètre Dp sur la longueur en prise — F = Ss π Dp L, avec Ss = St / √3 (Engineers Edge, page « Self Tapping Screws Installation Design »).",
    "Le trou du bossage égale le diamètre sur flancs de la vis (même page) ; le filet est formé sur toute la longueur L.",
    "Charge axiale statique, à la température où St est donnée : le fluage sous charge tenue et la chaleur abaissent la tenue — d'où un coefficient demandé plus fort que pour un métal (3 par défaut : un exemple, choix de l'outil).",
    "Ni le couple de vissage, ni le couple de foirage, ni la pression du filet sur la paroi du bossage ne sont calculés."],
  validity: "Plastique ductile, vis pour plastiques à filet formant, charge axiale statique ; la page ne donne ni coefficient de sécurité ni exemple chiffré.",
  reference: "Engineers Edge — Self Tapping Screws Installation Design (page web lue le 22 novembre 2026)",
  fill: {},
  compute(i) {
    const S = sheet(), Ss = i.St / Math.sqrt(3), A = PI * i.Dp * i.L, F_pull = Ss * A, L_Dp = i.L / i.Dp, Db_d = i.Db / i.d;
    S.step(`Cisaillement admis : Ss = St / √3 = ${n(i.St)} / 1,732 = ${n(Ss)} MPa (Engineers Edge).`);
    S.step(`Aire cisaillée : A = π Dp L = π × ${n(i.Dp)} × ${n(i.L)} = ${n(A)} mm².`);
    S.step(`Effort d'arrachement : F = Ss A = ${n(Ss)} × ${n(A)} = ${n(F_pull)} N${i.F > 0 ? `, pour ${n(i.F)} N par vis : marge ${n(F_pull / i.F, 3)}` : ""}.`);
    if (i.Dp >= i.d) S.warn("Le diamètre sur flancs est au moins le diamètre de la vis : vérifier les deux valeurs.");
    if (L_Dp < 2.5) S.warn(`Prise de ${n(L_Dp, 3)} Dp : selon la page, le couple de foirage ne plafonne que vers 2,5 Dp — une prise plus longue laisse plus de marge au vissage.`);
    if (Db_d < 2.5) S.warn(`Bossage de ${n(Db_d, 3)} d : la page conseille environ 2,5 fois le diamètre de la vis — un bossage plus mince peut fendre sous la pression du filet formé.`);
    S.check("Effort par vis vs effort d'arrachement", i.F, F_pull, "N", { sf: i.sf });
    return S.set({ Ss, A, F_pull, sf_pull: i.F > 0 ? Math.min(999, F_pull / i.F) : 999, F_max: F_pull / i.sf, L_Dp, Db_d });
  } };

/* ---------- a face cam turned by a handle (JP, 22 novembre 2026, his notes « Rotative handle that have a keying with a cam » and his choice by menu :
   a quarter turn, two lobes) : the ramp of the cam is a wedge — the same mechanics as a square-thread power screw whose lead per radian is
   rm tan α. Raising : T = F rm tan(α + φ) ; lowering : T = F rm tan(φ − α) ; φ = atan μ — plus the friction of the thrust bearing between the
   cam and what it pushes, F μb rb (the collar term of a power screw). The ramp holds itself when the lowering torque is not negative. ---------- */
const CAM = "Came", STACK = "Ce qu'elle presse", FRIC = "Frottement";
const faceCam = { id: "face_cam", domain: "joints", sketch: "facecam", title: "Face cam turned by a handle (stroke, torque, self-locking)", fr: "Came de face tournée par une poignée (course, couple, auto-blocage)",
  question: "Un tour de poignée donne-t-il l'effort demandé, la main y suffit-elle, et la poignée reste-t-elle en place sous la charge ?",
  inputs: [num("rm", "Rayon moyen de la rampe", "mm", 15, 1, 500, 0.5, CAM), num("alpha", "Pente de la rampe α", "°", 5.5, 0.5, 30, 0.5, CAM),
    num("turn", "Rotation de la poignée", "°", 90, 5, 360, 5, CAM), num("dwell", "Plateau de fin de course (dans la rotation)", "°", 15, 0, 180, 1, CAM),
    num("lobes", "Nombre de lobes (rampes)", "", 2, 1, 6, 1, CAM), num("lever", "Longueur du levier (axe → main)", "mm", 35, 5, 1000, 1, CAM),
    num("k", "Raideur de ce que la came écrase (rondelles, ressorts)", "N/mm", 200, 0, 1e6, 10, STACK), num("F0", "Effort déjà là au pied de la rampe", "N", 0, 0, 1e6, 10, STACK),
    num("Freq", "Effort que la pile demande", "N", 280, 0, 1e6, 10, STACK),
    num("mu", "Frottement de la rampe μ (goupilles sur la rampe)", "", 0.1, 0.005, 0.8, 0.005, FRIC), num("muB", "Frottement de la butée μb (aiguilles ≈ 0,005 ; PEEK, bronze ≈ 0,1)", "", 0.005, 0, 0.8, 0.005, FRIC),
    num("rb", "Rayon moyen de la butée rb", "mm", 11, 0, 500, 0.5, FRIC), num("Fhand", "Effort à la main admis", "N", 50, 1, 2000, 5, CRIT)],
  outputs: [out("s", "Course de la came", "mm"), out("F", "Effort sur la pile en fin de course", "N"), out("Fl", "Effort par lobe", "N"), out("T_up", "Couple au haut de la rampe", "N·m"),
    out("F_up", "Effort à la main au haut de la rampe", "N"), out("T_down", "Couple pour redescendre la rampe (< 0 : la pile ramène la poignée)", "N·m"),
    out("T_rel", "Couple pour quitter le plateau", "N·m"), out("F_rel", "Effort à la main pour ouvrir", "N"), out("alphaLock", "Pente la plus forte qui tient seule", "°"), out("eta", "Rendement de la came", "%")],
  assumptions: ["La rampe est un coin enroulé : course s = θ rm tan α, θ la rotation de la rampe sans le plateau, en radians — la vis de manœuvre à filet carré dont le pas par radian est rm tan α.",
    "Couple pour monter : T = F rm tan(α + φ) + F μb rb, φ = atan μ ; pour redescendre : T = F rm tan(φ − α) + F μb rb — les formules d'une vis à filet carré avec le frottement de son collet (page Wikipédia « Leadscrew »).",
    "La rampe tient seule quand le couple pour redescendre n'est pas négatif : α ≤ φ + atan(μb rb / rm). Sinon c'est le plateau de fin de course (pente nulle) qui garde la pile pressée.",
    "Les lobes se partagent l'effort ; ils ne changent ni la course ni le couple — deux lobes opposés équilibrent la poussée autour de l'arbre.",
    "L'effort croît le long de la rampe comme la raideur de ce que la came écrase : F = F0 + k s ; on le prend au haut de la rampe, là où il est le plus grand."],
  validity: "Frottement de Coulomb constant, rampe rigide, contacts au rayon moyen ; ni l'usure, ni la pression de contact sur la rampe, ni la tenue de la clavette ne sont calculées. Les coefficients de frottement sont des valeurs d'usage, à lire sur la fiche de la butée et à mesurer sur la rampe.",
  reference: "Vis de manœuvre à filet carré et frottement du collet — page Wikipédia « Leadscrew » (lue)",
  fill: {},
  compute(i) {
    const S = sheet(), rad = (d) => d * PI / 180, deg = (r) => r * 180 / PI, nl = Math.max(1, Math.round(i.lobes)), th = Math.max(0, i.turn - i.dwell), phi = Math.atan(i.mu), ta = Math.tan(rad(i.alpha));
    const s = rad(th) * i.rm * ta, F = i.F0 + i.k * s, coll = i.muB * i.rb, T_up = F * (i.rm * Math.tan(rad(i.alpha) + phi) + coll) / 1000, T_down = F * (i.rm * Math.tan(phi - rad(i.alpha)) + coll) / 1000;
    const T_rel = F * (i.mu * i.rm + coll) / 1000, alphaLock = deg(phi + Math.atan(coll / i.rm)), lev = i.lever / 1000, eta = T_up > 0 ? F * i.rm * ta / 1000 / T_up * 100 : 0;
    S.step(`Course : s = θ rm tan α = ${n(th)}° × π/180 × ${n(i.rm)} × tan ${n(i.alpha)}° = ${n(s)} mm (la rotation ${n(i.turn)}°, moins le plateau ${n(i.dwell)}°).`);
    S.step(`Effort en fin de course : F = F0 + k s = ${n(i.F0)} + ${n(i.k)} × ${n(s)} = ${n(F)} N, soit ${n(F / nl)} N par lobe (${nl} lobe${nl > 1 ? "s" : ""}).`);
    S.step(`Couple au haut de la rampe : T = F (rm tan(α + φ) + μb rb) = ${n(F)} × (${n(i.rm)} × tan(${n(i.alpha)}° + ${n(deg(phi))}°) + ${n(i.muB)} × ${n(i.rb)}) / 1000 = ${n(T_up)} N·m, soit ${n(T_up / lev)} N au bout d'un levier de ${n(i.lever)} mm.`);
    S.step(`Pour redescendre : T = F (rm tan(φ − α) + μb rb) = ${n(T_down)} N·m — ${T_down >= 0 ? "positif : la rampe tient seule" : "négatif : sous la charge, la pile ramène la poignée si on la lâche sur la rampe"} ; la pente qui tient seule est ${n(alphaLock)}°.`);
    S.step(`Pour quitter le plateau (pente nulle) : T = F (μ rm + μb rb) = ${n(T_rel)} N·m, soit ${n(T_rel / lev)} N à la main ; rendement de la came ${n(eta)} %.`);
    if (i.dwell >= i.turn) S.warn("Le plateau prend toute la rotation : la came ne monte pas.");
    if (i.turn > 360 / nl) S.warn(`Avec ${nl} lobes, une rampe tient dans ${n(360 / nl)}° : la rotation de ${n(i.turn)}° la dépasse.`);
    if (nl === 1) S.warn("Un seul lobe : la poussée est d'un seul côté de l'arbre, qui fléchit ; deux lobes opposés l'équilibrent.");
    if (i.dwell <= 0) S.warn("Sans plateau, la poignée s'arrête sur la pente : c'est le frottement seul qui doit la tenir.");
    S.check("Effort sur la pile vs effort demandé", F, i.Freq, "N", { min: true, note: F < i.Freq ? "Pas assez d'effort : une rampe plus longue ou plus raide, ou des rondelles plus raides." : "" });
    S.check("Effort à la main vs effort admis", T_up / lev, i.Fhand, "N", { note: T_up / lev > i.Fhand ? "Trop dur à tourner : un levier plus long, une rampe moins raide, ou une butée à aiguilles." : "" });
    S.check(`Pente de la rampe vs pente qui tient seule (${i.dwell > 0 ? "le plateau tient la pile" : "sans plateau"})`, i.alpha, alphaLock, "°", { soft: i.dwell > 0, note: i.alpha > alphaLock ? (i.dwell > 0 ? "La rampe ne tient pas seule : le plateau de fin de course garde la pile pressée — ne pas laisser la poignée sur la pente." : "Sans plateau, la poignée revient seule : une pente plus douce, ou un plateau.") : "" });
    return S.set({ s, F, Fl: F / nl, T_up, F_up: T_up / lev, T_down, T_rel, F_rel: T_rel / lev, alphaLock, eta });
  } };

export const JOINTS = [bolt, pressfit, pin, springStop, louvreStrip, plasticScrew, faceCam];
