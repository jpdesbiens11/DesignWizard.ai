/* DesignWizard.ai — the formulas of the workbooks, joints : the metric bolted joint (thread and class read from the tables
   of the model), the press fit of Lamé, the dowel pin in shear. A check that only makes sense with a load (an axial effort,
   a shear effort, a tapped hole) wakes up when its yellow cell is filled. mm, N, N·m, GPa, MPa, µm. */

import { pick, upTo999 } from "./xl_tools.js";
import { THREADS, BOLT_CLASSES } from "./models_joints.js";

const sizes = (k) => Object.fromEntries(Object.entries(THREADS).map(([s, v]) => [s, k < 0 ? Number(s.slice(1)) : v[k]])), cls = (k) => Object.fromEntries(Object.entries(BOLT_CLASSES).map(([c, v]) => [c, v[k]]));
const TAPPED = '{mode}="tapped"';
const bolt = {
  helpers: [{ key: "d", label: "Diamètre nominal d", unit: "mm", f: pick("size", sizes(-1), 6) }, { key: "P", label: "Pas P (ISO 261, pas gros)", unit: "mm", f: pick("size", sizes(0), 1) }, { key: "dh", label: "Trou de passage (ISO 273, moyen)", unit: "mm", f: pick("size", sizes(1), 6.6) },
    { key: "Sp", label: "Charge d'épreuve Sp (ISO 898-1)", unit: "MPa", f: pick("cls", cls("Sp"), 580) }, { key: "ReB", label: "Limite élastique de la vis Rp0,2", unit: "MPa", f: pick("cls", cls("Re"), 640) }, { key: "RmB", label: "Résistance de la vis Rm", unit: "MPa", f: pick("cls", cls("Rm"), 800) },
    { key: "As", label: "Section résistante As", unit: "mm²", f: "PI()/4*({h:d}-0.9382*{h:P})^2" }, { key: "nb", label: "Nombre de vis retenu", unit: "", f: "MAX(1,ROUND({nb},0))" },
    { key: "kb", label: "Raideur de la vis kb", unit: "N/mm", f: "{h:As}*205000/{lk}" }, { key: "km", label: "Raideur des pièces km (cône à 30°)", unit: "N/mm", f: "0.5774*PI()*{Em}*1000*{h:d}/(2*LN(5*(0.5774*{lk}+0.5*{h:d})/(0.5774*{lk}+2.5*{h:d})))" },
    { key: "Pb", label: "Effort axial par vis", unit: "N", f: "{Fa}/{h:nb}" }, { key: "Fm", label: "Serrage restant par vis", unit: "N", f: "{o:Fi}-(1-{o:C})*{h:Pb}" }, { key: "tauAdm", label: "Cisaillement admissible 0,577 Rp0,2", unit: "MPa", f: "0.577*{h:ReB}" }],
  outputs: { Fi: "{T}*1000/({K}*{h:d})", sigma_i: "{o:Fi}/{h:As}", proof_pct: "100*{o:sigma_i}/{h:Sp}", C: "{h:kb}/({h:kb}+{h:km})", Fb: "{o:Fi}+{o:C}*{h:Pb}", F_sep: "{h:nb}*{o:Fi}/(1-{o:C})", clamp: "{h:nb}*MAX(0,{h:Fm})", F_slip: "{mu}*{o:clamp}",
    tau: "{Fs}/({h:nb}*{h:As})", sigma_br: "{Fs}/({h:nb}*{h:d}*{tp})", p_head: "{o:Fi}/(PI()/4*((1.5*{h:d})^2-{h:dh}^2))", F_strip: `IF(${TAPPED},0.6*{Rm_t}*PI()*{h:d}*{Le}*0.875,"—")`, Le_min: `IF(${TAPPED},{h:RmB}*{h:As}/(0.6*{Rm_t}*PI()*{h:d}*0.875),"—")` },
  checks: [{ label: "Contrainte de précharge vs charge d'épreuve Sp", unit: "MPa", value: "{o:sigma_i}", limit: "{h:Sp}", sf: "1/0.9" },
    { label: "Pression sous tête vs limite élastique de la pièce", unit: "MPa", value: "{o:p_head}", limit: "{Re_p}", soft: true },
    { label: "Contrainte dans la vis sous charge vs Sp", unit: "MPa", value: "{o:Fb}/{h:As}", limit: "{h:Sp}", sf: "1.1", when: "{Fa}>0" },
    { label: "Décollement : effort axial vs effort de décollement", unit: "N", value: "{Fa}", limit: "{o:F_sep}", sf: "1.5", when: "{Fa}>0" },
    { label: "Glissement : effort tranchant vs frottement", unit: "N", value: "{Fs}", limit: "{o:F_slip}", soft: true, when: "{Fs}>0" },
    { label: "Cisaillement des vis vs 0,577 Rp0,2", unit: "MPa", value: "{o:tau}", limit: "{h:tauAdm}", sf: "1.5", when: "{Fs}>0" },
    { label: "Matage de la tôle vs limite élastique", unit: "MPa", value: "{o:sigma_br}", limit: "{Re_p}", sf: "1.25", when: "{Fs}>0" },
    { label: "Arrachement du taraudage vs effort dans la vis", unit: "N", value: "{o:Fb}", limit: "{o:F_strip}", sf: "1.5", when: TAPPED },
    { label: "Prise de filet vs prise « la vis casse avant le filet »", unit: "mm", value: "{Le}", limit: "{o:Le_min}", min: true, soft: true, when: TAPPED }],
  flags: [{ label: "Précharge (60 à 90 % de Sp)", info: true, f: 'IF({o:sigma_i}>{h:Sp},"NON : la vis plastifie au serrage",IF({o:sigma_i}>0.9*{h:Sp},"Au-dessus de 90 % de Sp : avec ± 25 % de dispersion la vis peut plastifier",IF({o:sigma_i}<0.4*{h:Sp},"Vis peu serrée (< 40 % de Sp) : risque de desserrage","Oui")))' },
    { label: "Assemblage serré sous la charge", info: true, f: 'IF({h:Fm}<=0,"NON : l\'assemblage se décolle, toute la charge passe dans les vis","Oui")' },
    { label: "Épaisseur serrée (≥ d)", f: 'IF({lk}<{h:d},"NON : vis courte, très raide, qui perd sa précharge au moindre tassement","Oui")' },
    { label: "Prise de filet (≤ 2,5 d)", f: `IF(AND(${TAPPED},{Le}>2.5*{h:d}),"Au-delà de 2,5 d les premiers filets portent l'essentiel : la longueur en plus ne sert presque plus","Oui")` }],
};

const pressfit = {
  helpers: [{ key: "Do", label: "Diamètre extérieur du moyeu retenu", unit: "mm", f: "IF({Do}<={d},2*{d},{Do})" }, { key: "dint", label: "Diamètre intérieur de l'arbre retenu", unit: "mm", f: "IF({di}>={d},0,{di})" },
    { key: "kh", label: "Coefficient de Lamé du moyeu", unit: "", f: "({h:Do}^2+{d}^2)/({h:Do}^2-{d}^2)" }, { key: "ks", label: "Coefficient de Lamé de l'arbre", unit: "", f: "({d}^2+{h:dint}^2)/({d}^2-{h:dint}^2)" }],
  outputs: { p: "({delta}/1000)/({d}*(({h:kh}+{nuh})/({Eh}*1000)+({h:ks}-{nus})/({Es}*1000)))", sigma_hoop: "{o:p}*{h:kh}", vm_hub: "SQRT({o:sigma_hoop}^2+{o:sigma_hoop}*{o:p}+{o:p}^2)", vm_shaft: "IF({h:dint}>0,2*{o:p}*{d}^2/({d}^2-{h:dint}^2),{o:p})",
    force: "PI()*{d}*{L}*{mu}*{o:p}", torque: "{o:force}*{d}/2/1000" },
  checks: [{ label: "von Mises à l'alésage du moyeu vs limite élastique", unit: "MPa", value: "{o:vm_hub}", limit: "{Re_h}", sf: "1.2" }, { label: "von Mises dans l'arbre vs limite élastique", unit: "MPa", value: "{o:vm_shaft}", limit: "{Re_s}", sf: "1.2" },
    { label: "Couple à transmettre vs couple transmissible", unit: "N·m", value: "{Treq}", limit: "{o:torque}", sf: "{sf}", when: "{Treq}>0" }, { label: "Effort axial à tenir vs effort transmissible", unit: "N", value: "{Freq}", limit: "{o:force}", sf: "{sf}", when: "{Freq}>0" }],
  flags: [{ label: "Moyeu", f: 'IF({Do}<={d},"Diamètre extérieur du moyeu ≤ diamètre de l\'ajustement : calcul fait avec Do = 2 d","Oui")' }, { label: "Arbre", f: 'IF({di}>={d},"Diamètre intérieur de l\'arbre ≥ diamètre de l\'ajustement : arbre calculé plein","Oui")' },
    { label: "Proportions (L / d de 0,3 à 3)", f: 'IF(OR({L}/{d}<0.3,{L}/{d}>3),"NON : hors de la plage usuelle 0,5 à 2 (pression non uniforme, effets de bord)","Oui")' }],
};

const pin = {
  helpers: [{ key: "np", label: "Nombre de goupilles retenu", unit: "", f: "MAX(1,ROUND({np},0))" }, { key: "planes", label: "Plans de cisaillement", unit: "", f: 'IF(OR({planes}="2",{planes}=2),2,1)' }, { key: "A", label: "Section d'une goupille", unit: "mm²", f: "PI()*{d}^2/4" },
    { key: "tauAdm", label: "Cisaillement admissible 0,577 Re", unit: "MPa", f: "0.577*{Re_pin}" }],
  outputs: { tau: "{F}/({h:np}*{h:planes}*{h:A})", sf_shear: upTo999("{h:tauAdm}", "{o:tau}"), sigma_br: "{F}/({h:np}*{d}*{t})", F_max: "{h:tauAdm}*{h:np}*{h:planes}*{h:A}/{sf}" },
  checks: [{ label: "Cisaillement de la goupille vs 0,577 Re", unit: "MPa", value: "{o:tau}", limit: "{h:tauAdm}", sf: "{sf}" }, { label: "Matage des pièces vs limite élastique", unit: "MPa", value: "{o:sigma_br}", limit: "{Re_p}", sf: "1.25" }],
  flags: [{ label: "Épaisseur portante (≥ d / 2)", f: 'IF({t}<{d}/2,"NON : le matage et la flexion de la goupille dominent","Oui")' }],
};

/* the crown of spring blades pressed to its stop : elastic to δy, then F = Fp − 0.5 Fy (δy / δ)² ; Holm for the points (the plating's
   resistivity, hardness and softening voltage, from the table of the platings) */
const PLAT = (key) => { const m = { rho: [1.6e-8, 1.15e-7, 3.5e-8, 7e-8], H: [0.9e9, 0.07e9, 1.8e9, 3e9], soften: [0.09, 0.07, 0.08, 0.22] }[key];
  return `IF({plating}="Sn",${m[1]},IF({plating}="Au",${m[2]},IF({plating}="Ni",${m[3]},${m[0]})))`; };
const springStop = {
  helpers: [{ key: "nb", label: "Nombre de lames retenu", unit: "", f: "MAX(1,ROUND({n},0))" }, { key: "E", label: "Module d'Young", unit: "MPa", f: "{E}*1000" }, { key: "I", label: "Moment quadratique d'une lame w t³ / 12", unit: "mm⁴", f: "{w}*{t}^3/12" },
    { key: "rho", label: "Résistivité du revêtement", unit: "Ω·m", f: PLAT("rho") }, { key: "H", label: "Dureté du revêtement", unit: "Pa", f: PLAT("H") }, { key: "soften", label: "Tension de ramollissement", unit: "V", f: PLAT("soften") },
    { key: "a", label: "Rayon d'un point de contact (Holm)", unit: "m", f: "SQRT(MAX({o:Fb},0.000000001)/(PI()*{h:H}))" }, { key: "rp", label: "Résistance d'un point ρ / (2 a)", unit: "Ω", f: "{h:rho}/(2*{h:a})" }],
  outputs: { k: "192*{h:E}*{h:I}/{l}^3", dy: "{Re}*{l}^2/(12*{h:E}*{t})", Fy: "{o:k}*{o:dy}", Fp: "1.5*{o:Fy}", ds: "MAX(0,{lift}-{hs})",
    Fb: "IF({o:ds}<=0,0,IF({o:ds}<={o:dy},{o:k}*{o:ds},{o:Fp}-0.5*{o:Fy}*({o:dy}/{o:ds})^2))", F: "{h:nb}*{o:Fb}", set: "IF({o:ds}>{o:dy},{o:ds}-{o:Fb}/{o:k},0)",
    Rc: "{h:rp}/{h:nb}*1000000", Rb: "{rhoB}*0.000000001*({l}/2)*0.001/({w}*{t}*0.000001)/2/{h:nb}*1000000", R: "{o:Rc}+{o:Rb}", dU: "{o:R}/1000000*{I}*1000", P: "{o:R}/1000000*{I}^2",
    iMax: "0.1*{h:soften}/{h:rp}*{h:nb}*0.8", J: "{I}/{h:nb}/2/({w}*{t})" },
  checks: [{ label: "Effort par lame vs effort minimal", unit: "N", value: "{o:Fb}", limit: "{Fmin}", min: true }, { label: "Courant vs courant estimé admissible (Holm)", unit: "A", value: "{I}", limit: "{o:iMax}" },
    { label: "Course à la butée vs course élastique", unit: "mm", value: "{o:ds}", limit: "{o:dy}", soft: true }, { label: "Densité de courant dans une lame vs repère", unit: "A/mm²", value: "{o:J}", limit: "{Jmax}", soft: true }],
  flags: [{ label: "Les lames touchent la face d'en face", f: 'IF({lift}<={hs},"NON : le bombé ne dépasse pas la butée, le contact ne passe que par la butée","Oui")' },
    { label: "Lames minces (t ≤ l / 10)", f: 'IF({t}>{l}/10,"NON : lame épaisse, le cisaillement compte","Oui")' }],
};

export const XL_JOINTS = { bolted_joint: bolt, press_fit: pressfit, dowel_pin: pin, spring_stop: springStop };
