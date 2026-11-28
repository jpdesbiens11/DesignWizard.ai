/* DynamiteOrbit.ai — the analytical models stay ALIVE in a spreadsheet : their formulas written for Excel, so that a young
   engineer changes a yellow cell offline and reads the answer. Every model has its formulas : here the two flows, and the
   four families gathered — structure, joints, thermal, electrical. A formula names what it reads between braces :
   {key} an input of the model, {p:prop} a property of the fluid, {h:key} an intermediate cell, {o:key} a result,
   {s:key} a cell of the sheet « Solveur » (xl_tools.js).
   XL[model id] = { helpers [{ key, label, unit, f }], grid (a root found step by step, in its own sheet), outputs { key : formula },
     checks [{ label (the one of the model), unit, value, limit (formulas), sf (formula), min, soft, ref (a temperature check : the reference), when (formula : the check exists) }],
     flags [{ label, f, ok (the words that mean « inside the domain » : "Oui" unless said), out (formula : outside the domain, when the words do not say it), info (a word of
       context the model does not count as a limit) }] — the validity of the model, said in words ; a line outside its domain turns the verdict to « JUSTE », as on the screen } */

import { XL_STRUCTURE } from "./xl_structure.js";
import { XL_JOINTS } from "./xl_joints.js";
import { XL_THERMAL } from "./xl_thermal.js";
import { XL_ELECTRICAL } from "./xl_electrical.js";

const PIPE_A = { key: "A", label: "Section de passage A", unit: "m²", f: "PI()*({d}/1000)^2/4" }, FLOW_Q = { key: "Qs", label: "Débit Q", unit: "m³/s", f: "{Q}/60000" };
const LOSS = [{ label: "Perte de charge vs perte de charge admissible", unit: "kPa", value: "{o:dp_kPa}", limit: "{dp_max}", when: "{dp_max}>0" }];
const pipe = {
  helpers: [PIPE_A, FLOW_Q],
  outputs: { v: "{h:Qs}/{h:A}", Re: "{p:rho}*{o:v}*({d}/1000)/({p:mu_mPa}/1000)", turbulent: "IF({o:Re}>2300,1,0)",
    f: "IF({o:Re}<=2300,IF({o:Re}>0,64/{o:Re},0),IF(AND({eps}<=0,{o:Re}<100000),0.316/{o:Re}^0.25,0.25/LOG10({eps}*0.000001/(3.7*{d}/1000)+5.74/{o:Re}^0.9)^2))",
    dp: "IF({o:Re}<=2300,128*({p:mu_mPa}/1000)*({L}/1000)*{h:Qs}/(PI()*({d}/1000)^4),{o:f}*({L}/{d})*{p:rho}*{o:v}^2/2)", dp_kPa: "{o:dp}/1000", Le: "IF({o:Re}<=2300,0.06*{o:Re}*{d},4.4*{o:Re}^(1/6)*{d})", power: "{o:dp}*{h:Qs}" },
  checks: LOSS,
  flags: [{ label: "Régime", ok: "Laminaire : Hagen-Poiseuille", f: 'IF({o:Re}<=2300,"Laminaire : Hagen-Poiseuille",IF({o:Re}<4000,"Transition (2300 à 4000) : frottement incertain à ± 30 %","Turbulent : Darcy-Weisbach, Hagen-Poiseuille ne s\'applique plus"))' },
    { label: "Écoulement établi", f: 'IF(AND({o:Re}<=2300,{o:Le}>0.5*{L}),"NON : la longueur d\'établissement dépasse la moitié du tube, la perte réelle est plus élevée","Oui")' },
    { label: "Gaz : écoulement incompressible", f: 'IF(AND({p:rho}<20,{o:v}>100),"NON : plus de 100 m/s dans un gaz (> 0,3 Mach), le résultat n\'est qu\'un ordre de grandeur",IF(AND({p:rho}<20,{o:dp}>10000),"NON : perte de charge supérieure à 10 kPa dans un gaz, la masse volumique varie le long du tube","Oui"))' }],
};
const orifice = {
  helpers: [PIPE_A, FLOW_Q, { key: "beta", label: "Rapport β = d / D", unit: "", f: "IF(AND({D}>0,{d}<{D}),{d}/{D},0)" }, { key: "E2", label: "1 − β⁴", unit: "", f: "1-{h:beta}^4" }],
  outputs: { v: "{h:Qs}/{h:A}", dp: "{p:rho}*{h:E2}/2*({h:Qs}/({Cd}*{h:A}))^2", dp_kPa: "{o:dp}/1000", Re: "{p:rho}*{o:v}*({d}/1000)/({p:mu_mPa}/1000)", beta: "{h:beta}", Q_max: "{Cd}*{h:A}*SQRT(2*{dp_max}*1000/({p:rho}*{h:E2}))*60000" },
  checks: LOSS,
  flags: [{ label: "Coefficient Cd constant", f: 'IF(AND({o:Re}<10000,{Q}>0),"NON : Re < 10 000 dans l\'orifice, Cd dépend de Re","Oui")' }, { label: "Restriction", f: 'IF({h:beta}>0.7,"β > 0,7 : la formule de l\'orifice devient imprécise","Oui")' },
    { label: "Diamètre amont", f: 'IF(AND({D}>0,{d}>={D}),"Diamètre amont ≤ diamètre de l\'orifice : pas de restriction, calcul fait avec β = 0","Oui")' },
    { label: "Gaz : écoulement incompressible", f: 'IF(AND({p:rho}<20,{o:dp}>10000),"NON : gaz et Δp > 10 kPa, l\'écoulement est compressible (facteur de détente, blocage sonique possible)","Oui")' }],
};
export const XL = { ...XL_STRUCTURE, ...XL_JOINTS, pipe_flow: pipe, orifice_flow: orifice, ...XL_THERMAL, ...XL_ELECTRICAL };
/** The models whose spreadsheet recalculates : all of them. */
export const XL_LIVE = Object.keys(XL);
