/* DesignWizard.ai — the formulas of the workbooks, thermal : conduction through a stack, the junction chain, the lumped
   mass, and the two finned heat sinks — the forced one recomputed six times like the model, the natural one found by a
   bisection laid out in the sheet « Solveur » (the balance convection + radiation has no closed form). Air : Sutherland's
   law, as props.js. A temperature check compares RISES above the reference : `ref`. mm, mm², cm², W, °C, K/W, g. */

import { xn, filmK, AIR, finEta, bisection, substitutions } from "./xl_tools.js";

const SB = xn(5.670374e-8), G0 = "9.80665";
const layer = (t, k) => `IF({${t}}>0,{${t}}/1000/({${k}}*{h:A}),0)`;
const wall = {
  helpers: [{ key: "A", label: "Surface de passage", unit: "m²", f: "{A}*0.000001" }],
  outputs: { R1: layer("t1", "k1"), R2: layer("t2", "k2"), R3: layer("t3", "k3"), R_tim: layer("tim_t", "tim_k"), R_contact: "{Rc}*0.0001/{h:A}", R_tot: "{o:R1}+{o:R2}+{o:R3}+{o:R_tim}+{o:R_contact}", dT: "{P}*{o:R_tot}", T_hot: "{Tc}+{o:dT}", flux: "{P}/({A}/100)" },
  checks: [{ label: "Température du côté chaud vs température admissible", unit: "°C", value: "{o:T_hot}", limit: "{Tmax}", ref: "{Tc}" }],
  flags: [{ label: "Paroi mince devant la surface", f: 'IF(MAX({t1},{t2},{t3})>SQRT({A})/2,"NON : la chaleur s\'épanouit latéralement, le modèle 1-D surestime l\'écart de température","Oui")' }],
};

const junction = { helpers: [],
  outputs: { R_tot: "{Rjc}+{Rcs}+{Rsa}", Tj: "{Ta}+{P}*{o:R_tot}", Ts: "{Ta}+{P}*{Rsa}", Tc: "{o:Ts}+{P}*{Rcs}", Rsa_max: "IF({P}>0,MAX(-999,MIN(999,({Tjmax}-{Ta})/{P}-{Rjc}-{Rcs})),999)", P_max: "IF({o:R_tot}>0,MAX(0,({Tjmax}-{Ta})/{o:R_tot}),0)" },
  checks: [{ label: "Température de jonction vs température admissible", unit: "°C", value: "{o:Tj}", limit: "{Tjmax}", ref: "{Ta}", sf: "1.1" }],
  flags: [{ label: "Dissipateur possible", f: 'IF({o:Rsa_max}<0,"NON : même avec un dissipateur parfait (Rsa = 0) la jonction dépasse la limite — réduire la puissance, Rjc ou Rcs","Oui")' }],
};

const lumped = {
  helpers: [{ key: "m", label: "Masse", unit: "kg", f: "{m}/1000" }, { key: "A", label: "Surface d'échange", unit: "m²", f: "{A}*0.0001" }, { key: "hA", label: "Conductance vers l'air h A", unit: "W/K", f: "{h}*{h:A}" },
    { key: "dTinf", label: "Échauffement en régime permanent", unit: "K", f: "{P}/{h:hA}" }, { key: "room", label: "Échauffement admissible Tmax − Ta", unit: "K", f: "{Tmax}-{Ta}" }],
  outputs: { C: "{h:m}*{cp}", tau: "{o:C}/{h:hA}", T_inf: "{Ta}+{h:dTinf}", T_t: "{Ta}+{h:dTinf}*(1-EXP(-{time}/{o:tau}))", rate: "{P}/{o:C}", Bi: "{h}*({h:m}/{rho}/{h:A})/{k}", t_lim: 'IF(AND({h:dTinf}>{h:room},{h:room}>0),-{o:tau}*LN(1-{h:room}/{h:dTinf}),"—")' },
  checks: [{ label: "Température à la fin de la durée vs température admissible", unit: "°C", value: "{o:T_t}", limit: "{Tmax}", ref: "{Ta}" }, { label: "Température en régime permanent vs température admissible", unit: "°C", value: "{o:T_inf}", limit: "{Tmax}", ref: "{Ta}", soft: true }],
  flags: [{ label: "Température uniforme (Biot < 0,1)", f: 'IF({o:Bi}>0.1,"NON : le modèle à une seule masse sous-estime la température près de la source","Oui")' }, { label: "Service", f: 'IF({o:T_inf}>{Tmax},"Ne tient qu\'en service limité dans le temps : voir le temps pour atteindre la limite","Tient en régime permanent")' }],
};

/* ---------- plate-fin heat sinks : the geometry they share ---------- */
const FINS = [{ key: "N", label: "Nombre d'ailettes retenu", unit: "", f: "MAX(2,ROUND({N},0))" }, { key: "Wm", label: "Largeur de la base", unit: "m", f: "{W}/1000" }, { key: "Lm", label: "Longueur des ailettes", unit: "m", f: "{Lf}/1000" }, { key: "Hm", label: "Hauteur des ailettes", unit: "m", f: "{H}/1000" },
  { key: "tfm", label: "Épaisseur d'une ailette", unit: "m", f: "{tf}/1000" }, { key: "Hc", label: "Hauteur corrigée Hc = H + t / 2", unit: "m", f: "{h:Hm}+{h:tfm}/2" }, { key: "s", label: "Pas libre entre ailettes", unit: "m", f: "MAX(0.0001,({h:Wm}-{h:N}*{h:tfm})/({h:N}-1))" },
  { key: "Af", label: "Surface des ailettes Af", unit: "m²", f: "2*{h:N}*{h:Hc}*{h:Lm}" }, { key: "Ab", label: "Surface libre de la base Ab", unit: "m²", f: "({h:N}-1)*{h:s}*{h:Lm}" }];
const FIT = { label: "Les ailettes tiennent dans la base", f: 'IF(({h:Wm}-{h:N}*{h:tfm})/({h:N}-1)<=0.0001,"NON : pas pris égal à 0,1 mm, résultat sans valeur — réduire le nombre ou l\'épaisseur des ailettes","Oui")' };
const BASE = [{ label: "Température de la base vs température admissible", unit: "°C", value: "{o:Ts}", limit: "{Tmax}", ref: "{Ta}" }];

/* natural convection between vertical plates (Bar-Cohen & Rohsenow) : Ra_s s / L, then h — at a rise x, the air at the film temperature K */
const chanX = (x, K) => `${G0}/${K}*${x}*{h:s}^3/(${AIR.nu(K)}*${AIR.alpha(K)})*{h:s}/{h:Lm}`, chanH = (X, K) => `1/SQRT(576/${X}^2+2.87/SQRT(${X}))*${AIR.k(K)}/{h:s}`;
const radiated = (x) => `{eps}*${SB}*{h:Arad}*(({Ta}+${x}+273.15)^4-({Ta}+273.15)^4)`, convected = (h, x) => `${h}*(${finEta(h, "{k}", "{h:tfm}", "{h:Hc}")}*{h:Af}+{h:Ab})*${x}`;
const NAT = bisection("dT", "l'échauffement de la base", 0.001, 1500, 36, [{ key: "Tk", label: "Température de film [K]", f: (x) => filmK(`{Ta}+${x}/2`) }, { key: "X", label: "Ra s / L", f: (x, at) => chanX(x, at("Tk")) },
  { key: "h", label: "h [W/m²·K]", f: (x, at) => chanH(at("X"), at("Tk")) }, { key: "f", label: "Bilan Qconv + Qray − P [W]", f: (x, at) => `${convected(at("h"), x)}+${radiated(x)}-{P}` }]);
const sinkNatural = { grid: NAT.grid,
  helpers: [...FINS, { key: "Arad", label: "Enveloppe qui rayonne", unit: "m²", f: "{h:Lm}*({h:Wm}+2*{h:Hm})" }, { key: "dT", label: "Échauffement trouvé (feuille Solveur)", unit: "K", f: `IF({P}>0,${NAT.root},0.001)` },
    { key: "Tk", label: "Température de film", unit: "K", f: filmK("{Ta}+{h:dT}/2") }, { key: "X", label: "Ra s / L", unit: "", f: chanX("{h:dT}", "{h:Tk}") }],
  outputs: { dT: "{h:dT}", Ts: "{Ta}+{h:dT}", Rsa: "IF({P}>0,{h:dT}/{P},0)", h: chanH("{h:X}", "{h:Tk}"), eta: finEta("{o:h}", "{k}", "{h:tfm}", "{h:Hc}"), s: "{h:s}*1000", s_opt: `2.71*(${G0}/{h:Tk}*{h:dT}/(${AIR.alpha("{h:Tk}")}*${AIR.nu("{h:Tk}")}*{h:Lm}))^-0.25*1000`,
    Q_conv: "{o:h}*({o:eta}*{h:Af}+{h:Ab})*{h:dT}", Q_rad: radiated("{h:dT}"), Ra_s: "{h:X}*{h:Lm}/{h:s}" },
  checks: BASE,
  flags: [FIT, { label: "Pas des ailettes", f: 'IF({o:s}<0.7*{o:s_opt},"Ailettes trop serrées : l\'air ne circule plus entre elles, en retirer améliore le refroidissement","Oui")' },
    { label: "Écoulement laminaire (Rayleigh sur la hauteur < 10⁹)", f: `IF(${G0}/{h:Tk}*{h:dT}*{h:Lm}^3/(${AIR.nu("{h:Tk}")}*${AIR.alpha("{h:Tk}")})>1000000000,"NON : couche limite turbulente, corrélation laminaire hors domaine","Oui")` },
    { label: "Échauffement (≤ 150 K)", f: 'IF({h:dT}>150,"NON : hors du domaine d\'usage d\'un dissipateur à air libre, résultat indicatif","Oui")' }, { label: "Bilan fermé", f: `IF(AND({P}>0,ABS({o:Q_conv}+{o:Q_rad}-{P})>0.001*{P}),"NON : la dichotomie n'a pas convergé","Oui")` }],
};

/* forced convection : a flat plate in parallel flow (Incropera 7.30, 7.38), six passes from 20 K like the model */
const FOR = substitutions("dT", "l'échauffement de la base", 20, 6, [{ key: "Tk", label: "Température de film [K]", f: (prev) => filmK(`{Ta}+${prev}/2`) }, { key: "Re", label: "Reynolds Re_L", f: (prev, at) => `{v}*{h:Lm}/${AIR.nu(at("Tk"))}` },
  { key: "h", label: "h [W/m²·K]", f: (prev, at) => `IF(${at("Re")}<500000,0.664*SQRT(${at("Re")}),0.037*${at("Re")}^0.8-871)*${AIR.Pr(at("Tk"))}^(1/3)*${AIR.k(at("Tk"))}/{h:Lm}` }, { key: "eta", label: "Rendement d'ailette", f: (prev, at) => finEta(at("h"), "{k}", "{h:tfm}", "{h:Hc}") },
  { key: "air", label: "Échauffement de l'air [K]", f: (prev, at) => `{P}/(${AIR.rho(at("Tk"))}*{h:flow}*1007)` }, { key: "dT", label: "Échauffement de la base [K]", f: (prev, at) => `${at("air")}/2+{P}/(${at("h")}*(${at("eta")}*{h:Af}+{h:Ab}))` }]);
const sinkForced = { grid: FOR.grid,
  helpers: [...FINS, { key: "flow", label: "Débit d'air entre les ailettes", unit: "m³/s", f: "{v}*({h:N}-1)*{h:s}*{h:Hm}" }],
  outputs: { dT: FOR.last("dT"), Ts: "{Ta}+{o:dT}", Rsa: "IF({P}>0,{o:dT}/{P},0)", h: FOR.last("h"), eta: FOR.last("eta"), ReL: FOR.last("Re"), dT_air: FOR.last("air"), flow: "{h:flow}*3600", s: "{h:s}*1000" },
  checks: BASE,
  flags: [FIT, { label: "Couches limites séparées", f: 'IF(2*5*{h:Lm}/SQRT({o:ReL})>{h:s},"NON : couches limites jointives, écoulement de canal — résultat approché (± 30 %)","Oui")' },
    { label: "Débit d'air suffisant", f: 'IF({o:dT_air}>0.5*{o:dT},"NON : l\'air s\'échauffe de plus de la moitié de l\'échauffement de la base — augmenter la vitesse ou le pas","Oui")' }, { label: "Vitesse d'air (≤ 15 m/s)", f: 'IF({v}>15,"NON : bruit et perte de charge élevés, hors de la pratique courante","Oui")' }],
};

export const XL_THERMAL = { conduction_stack: wall, junction_temperature: junction, heatsink_natural: sinkNatural, heatsink_forced: sinkForced, lumped_mass: lumped };
