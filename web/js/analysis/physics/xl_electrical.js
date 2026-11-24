/* DynamiteOrbit.ai — the formulas of the workbooks, electrical : the busbar (its temperature found by a bisection laid out in
   the sheet « Solveur » : Joule heating against convection and radiation), the PCB trace of IPC-2221, the short pulse of
   Onderdonk. mm, µm, A, nΩ·m, °C. */

import { xn, bisection } from "./xl_tools.js";

const SB = xn(5.670374e-8);
const hBar = (x) => `IF({hc}>0,{hc},1.42*(${x}/{h:w})^0.25)`, hot = (T) => `{h:R20}*(1+{alpha}*(${T}-20))`;
const BAR = bisection("dT", "l'échauffement de la barre", 0.000001, 3000, 40, [{ key: "h", label: "h [W/m²·K]", f: (x) => hBar(x) },
  { key: "f", label: "Bilan évacué − Joule [W]", f: (x, at) => `${at("h")}*{h:As}*${x}+{eps}*${SB}*{h:As}*(({Ta}+${x}+273.15)^4-({Ta}+273.15)^4)-{I}^2*${hot(`{Ta}+${x}`)}` }]);
const busbar = { grid: BAR.grid,
  helpers: [{ key: "w", label: "Largeur", unit: "m", f: "{w}/1000" }, { key: "L", label: "Longueur", unit: "m", f: "{L}/1000" }, { key: "Ac", label: "Section du conducteur", unit: "m²", f: "{h:w}*{t}/1000" }, { key: "As", label: "Surface d'échange 2 (w + t) L", unit: "m²", f: "2*({h:w}+{t}/1000)*{h:L}" },
    { key: "R20", label: "Résistance à 20 °C", unit: "Ω", f: "{rho20}*0.000000001*{h:L}/{h:Ac}" }, { key: "dT", label: "Échauffement trouvé (feuille Solveur)", unit: "K", f: `IF({I}>0,${BAR.root},0)` }],
  outputs: { dT: "{h:dT}", T: "{Ta}+{h:dT}", R20: "{h:R20}*1000000", R: `${hot("{o:T}")}*1000000`, P: "{I}^2*{o:R}/1000000", dU: "{o:R}/1000000*{I}*1000", J: "{I}/({w}*{t})", h: hBar("MAX({h:dT},0.000001)") },
  checks: [{ label: "Température de la barre vs température admissible", unit: "°C", value: "{o:T}", limit: "{Tmax}", ref: "{Ta}" }, { label: "Densité de courant vs densité repère", unit: "A/mm²", value: "{o:J}", limit: "{Jmax}", soft: true }],
  flags: [{ label: "Équilibre thermique", f: 'IF({h:dT}>=2999,"NON : la barre s\'emballe (la résistance croît plus vite que le refroidissement) — augmenter la section","Oui")' },
    { label: "Effet de peau négligeable (t ≤ 8 mm)", f: 'IF({t}>8,"NON : en courant alternatif 50 / 60 Hz l\'effet de peau augmente la résistance (non compris)","Oui")' }],
};

const MIL2 = xn(1 / (0.0254 * 0.0254));
const trace = {
  helpers: [{ key: "k", label: "Constante k (IPC-2221)", unit: "", f: 'IF({layer}="internal",0.024,0.048)' }, { key: "mil2", label: "Section de cuivre", unit: "mil²", f: `{o:area}*${MIL2}` }],
  outputs: { area: "{w}*{tcu}/1000", I_max: "{h:k}*{dTmax}^0.44*{h:mil2}^0.725", dT: "IF({I}>0,({I}/({h:k}*{h:mil2}^0.725))^(1/0.44),0)", w_min: `({I}/({h:k}*{dTmax}^0.44))^(1/0.725)/${MIL2}/({tcu}/1000)`, T: "{Ta}+{o:dT}",
    R: "0.00000001724*(1+0.00393*(MIN({o:T},1000)-20))*({L}/1000)/({o:area}*0.000001)*1000", dU: "{o:R}*{I}", P: "{o:R}/1000*{I}^2" },
  checks: [{ label: "Courant demandé vs courant admissible (IPC-2221)", unit: "A", value: "{I}", limit: "{o:I_max}" }],
  flags: [{ label: "Dans les abaques IPC-2221", f: 'IF(OR({I}>35,{w}>10.16,{tcu}<17,{tcu}>106,{dTmax}<10),"NON : valeur extrapolée (courant ≤ 35 A, largeur ≤ 10 mm, cuivre 17,5 à 105 µm, ΔT ≥ 10 K)","Oui")' },
    { label: "Échauffement (≤ 100 K)", f: 'IF({o:dT}>100,"NON : hors abaque, la piste risque de se décoller ou de brûler la carte","Oui")' }],
};

const logTo = (T) => `LN(MAX(1.000000001,(${T}+{h:B})/({Ti}+{h:B})))`;
const pulse = {
  helpers: [{ key: "a", label: "Coefficient de température retenu", unit: "1/K", f: "MAX({alpha},0.000001)" }, { key: "B", label: "β = 1 / α₂₀ − 20", unit: "°C", f: "1/{h:a}-20" }, { key: "K", label: "Constante du matériau K", unit: "A·√s/mm²", f: "SQRT({rho}*{cp}/({rho20}*0.000000001*{h:a}))*0.000001" },
    { key: "J", label: "Densité de courant J", unit: "A/mm²", f: "{I}/{A}" }, { key: "x", label: "Exposant J² t / K² (au plus 40)", unit: "", f: "MIN(40,{h:J}^2*{time}/{h:K}^2)" }, { key: "lnmax", label: "ln[(Tmax + β) / (Ti + β)]", unit: "", f: logTo("{Tmax}") }, { key: "lnmelt", label: "ln[(Tfusion + β) / (Ti + β)]", unit: "", f: logTo("{Tmelt}") }],
  outputs: { Tf: "({Ti}+{h:B})*EXP({h:x})-{h:B}", dT: "{o:Tf}-{Ti}", I_adm: "{A}*{h:K}*SQRT({h:lnmax}/{time})", t_adm: "IF({I}>0,MIN(1000000000,({A}*{h:K}/{I})^2*{h:lnmax}),1000000000)", A_min: "{I}*SQRT({time})/({h:K}*SQRT({h:lnmax}))",
    I_fuse: "{A}*{h:K}*SQRT({h:lnmelt}/{time})", i2t: "{I}^2*{time}", Kc: "{h:K}" },
  checks: [{ label: "Température finale vs température admissible", unit: "°C", value: "{o:Tf}", limit: "{Tmax}", ref: "{Ti}" }],
  flags: [{ label: "Le conducteur ne fond pas", f: 'IF({o:Tf}>={Tmelt},"NON : la température calculée atteint la fusion, le conducteur fond pendant l\'impulsion, comme un fusible","Oui")' },
    { label: "Impulsion courte (≤ 5 s)", f: 'IF({time}>5,"NON : l\'hypothèse adiabatique devient pessimiste, le conducteur évacue de la chaleur pendant l\'impulsion","Oui")' }],
};

export const XL_ELECTRICAL = { busbar, pcb_trace: trace, adiabatic_pulse: pulse };
