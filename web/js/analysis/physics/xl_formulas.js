/* DesignWizard.ai — the analytical models that stay ALIVE in a spreadsheet : their formulas written for Excel, so that a
   young engineer changes a yellow cell offline and reads the answer. A formula names what it reads between braces :
   {key} an input of the model, {p:prop} a property of the fluid, {h:key} an intermediate cell, {o:key} a result.
   Each intermediate cell also says how it is computed here (js), so that the file opens with the right numbers before
   any recalculation. A model that is not listed leaves with its results as values, and its sweeps.
   XL[model id] = { helpers [{ key, label, unit, f, js(i, p, h) }], outputs { key : formula }, checks [{ value, limit, sf, when, min }], flags [{ label, f }] } */

const PIPE_A = { key: "A", label: "Section de passage A", unit: "m²", f: "PI()*({d}/1000)^2/4", js: (i) => Math.PI * (i.d / 1000) ** 2 / 4 }, FLOW_Q = { key: "Qs", label: "Débit Q", unit: "m³/s", f: "{Q}/60000", js: (i) => i.Q / 60000 };
const pipe = {
  helpers: [PIPE_A, FLOW_Q],
  outputs: { v: "{h:Qs}/{h:A}", Re: "{p:rho}*{o:v}*({d}/1000)/({p:mu_mPa}/1000)", turbulent: "IF({o:Re}>2300,1,0)",
    f: "IF({o:Re}<=2300,IF({o:Re}>0,64/{o:Re},0),IF(AND({eps}<=0,{o:Re}<100000),0.316/{o:Re}^0.25,0.25/LOG10({eps}*0.000001/(3.7*{d}/1000)+5.74/{o:Re}^0.9)^2))",
    dp: "IF({o:Re}<=2300,128*({p:mu_mPa}/1000)*({L}/1000)*{h:Qs}/(PI()*({d}/1000)^4),{o:f}*({L}/{d})*{p:rho}*{o:v}^2/2)", dp_kPa: "{o:dp}/1000", Le: "IF({o:Re}<=2300,0.06*{o:Re}*{d},4.4*{o:Re}^(1/6)*{d})", power: "{o:dp}*{h:Qs}" },
  checks: [{ value: "dp_kPa", limit: "dp_max", when: "{dp_max}>0" }],
  flags: [{ label: "Régime", f: 'IF({o:Re}<=2300,"Laminaire : Hagen-Poiseuille",IF({o:Re}<4000,"Transition (2300 à 4000) : frottement incertain à ± 30 %","Turbulent : Darcy-Weisbach"))' },
    { label: "Écoulement établi", f: 'IF({o:Le}>0.5*{L},"NON : la longueur d\'établissement dépasse la moitié du tube, la perte réelle est plus élevée","Oui")' }],
};
const orifice = {
  helpers: [PIPE_A, FLOW_Q, { key: "beta", label: "Rapport β = d / D", unit: "", f: "IF(AND({D}>0,{d}<{D}),{d}/{D},0)", js: (i) => (i.D > 0 && i.d < i.D ? i.d / i.D : 0) }, { key: "E2", label: "1 − β⁴", unit: "", f: "1-{h:beta}^4", js: (i, p, h) => 1 - h.beta ** 4 }],
  outputs: { v: "{h:Qs}/{h:A}", dp: "{p:rho}*{h:E2}/2*({h:Qs}/({Cd}*{h:A}))^2", dp_kPa: "{o:dp}/1000", Re: "{p:rho}*{o:v}*({d}/1000)/({p:mu_mPa}/1000)", beta: "{h:beta}", Q_max: "{Cd}*{h:A}*SQRT(2*{dp_max}*1000/({p:rho}*{h:E2}))*60000" },
  checks: [{ value: "dp_kPa", limit: "dp_max", when: "{dp_max}>0" }],
  flags: [{ label: "Coefficient Cd constant", f: 'IF(AND({o:Re}<10000,{Q}>0),"NON : Re < 10 000 dans l\'orifice, Cd dépend de Re","Oui")' }, { label: "Restriction", f: 'IF({h:beta}>0.7,"β > 0,7 : la formule de l\'orifice devient imprécise","Oui")' }],
};
/* the four beams of Roark, table 8.1 : δ = dn F L³ / (dd E I), M = F L / md, V = kv F, f₁ = λ² / (2π L²) √(E I / ρ A) */
const ROUND = 'OR({section}="round",{section}="tube")', SEC = [
  { key: "di", label: "Diamètre intérieur", unit: "mm", f: 'IF({section}="tube",MAX(0,{d}-2*{t}),0)', js: (i) => (i.section === "tube" ? Math.max(0, i.d - 2 * i.t) : 0) },
  { key: "I", label: "Moment quadratique I", unit: "mm⁴", f: `IF(${ROUND},PI()*({d}^4-{h:di}^4)/64,IF({section}="custom",{Ic},{b}*{h}^3/12))`, js: (i, p, h) => (i.section === "round" || i.section === "tube" ? Math.PI * (i.d ** 4 - h.di ** 4) / 64 : i.section === "custom" ? i.Ic : i.b * i.h ** 3 / 12) },
  { key: "A", label: "Aire de la section A", unit: "mm²", f: `IF(${ROUND},PI()*({d}^2-{h:di}^2)/4,IF({section}="custom",{Ac},{b}*{h}))`, js: (i, p, h) => (i.section === "round" || i.section === "tube" ? Math.PI * (i.d ** 2 - h.di ** 2) / 4 : i.section === "custom" ? i.Ac : i.b * i.h) },
  { key: "c", label: "Distance à la fibre extrême c", unit: "mm", f: `IF(${ROUND},{d}/2,IF({section}="custom",{cc},{h}/2))`, js: (i) => (i.section === "round" || i.section === "tube" ? i.d / 2 : i.section === "custom" ? i.cc : i.h / 2) },
  { key: "ks", label: "Cisaillement maxi / moyen", unit: "", f: `IF(${ROUND},IF({h:di}>0,2,4/3),IF({section}="custom",1,1.5))`, js: (i, p, h) => (i.section === "round" || i.section === "tube" ? (h.di > 0 ? 2 : 4 / 3) : i.section === "custom" ? 1 : 1.5) }];
const beam = (dn, dd, md, kv, lam2) => ({ helpers: SEC,
  outputs: { delta: `${dn}*{F}*{L}^3/(${dd}*{E}*1000*{h:I})`, sigma: `({F}*{L}/${md})*{h:c}/{h:I}`, sf_yield: "MIN(999,{Re}/{o:sigma})", f1: `${lam2}/(2*PI()*({L}/1000)^2)*SQRT({E}*1000*{h:I}*0.000001/({rho}*{h:A}*0.000001))`,
    stiffness: `IF({F}>0,{F}/{o:delta},${dd}*{E}*1000*{h:I}/(${dn}*{L}^3))`, M: `{F}*{L}/${md}/1000`, tau: `{h:ks}*${kv}*{F}/{h:A}`, I: "{h:I}", mass: "{rho}*{h:A}*{L}*0.000001" },
  checks: [{ value: "sigma", limit: "Re", sf: "{sf}" }, { value: "delta", limit: "dlim" }],
  flags: [{ label: "Poutre élancée (L / h ≥ 10)", f: 'IF({L}/(2*{h:c})<10,"NON : poutre courte, la flèche réelle est plus grande","Oui")' }, { label: "Petite flèche (δ ≤ L / 10)", f: 'IF({o:delta}>{L}/10,"NON : la formule linéaire sort de son domaine","Oui")' }] });
export const XL = { pipe_flow: pipe, orifice_flow: orifice, beam_cantilever_point: beam(1, 3, 1, 1, 3.516), beam_cantilever_udl: beam(1, 8, 2, 1, 3.516), beam_simple_point: beam(1, 48, 4, 0.5, "PI()^2"), beam_simple_udl: beam(5, 384, 8, 0.5, "PI()^2") };
/** The models whose spreadsheet recalculates. */
export const XL_LIVE = Object.keys(XL);
