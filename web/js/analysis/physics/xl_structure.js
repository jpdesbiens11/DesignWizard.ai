/* DynamiteOrbit.ai — the formulas of the workbooks, structure : the four beams of Roark, the column (Euler / Johnson), the
   shaft in torsion, the plate under pressure (coefficients read between the points of Roark's table), two joined materials
   that do not expand alike. Same units as the models : mm, N, N·m, GPa, MPa, kPa, µm/m·K. See xl_tools.js for the braces. */

import { pick, between, upTo999 } from "./xl_tools.js";
import { ENDS } from "./models_structure.js";
import { PLATE } from "./models_structure_plate.js";

/* a section : rectangle, round bar, tube, or a profile typed in (Roark, table A.1) */
const ROUND = 'OR({section}="round",{section}="tube")', SEC = [
  { key: "di", label: "Diamètre intérieur", unit: "mm", f: 'IF({section}="tube",MAX(0,{d}-2*{t}),0)' },
  { key: "I", label: "Moment quadratique I", unit: "mm⁴", f: `IF(${ROUND},PI()*({d}^4-{h:di}^4)/64,IF({section}="custom",{Ic},{b}*{h}^3/12))` },
  { key: "A", label: "Aire de la section A", unit: "mm²", f: `IF(${ROUND},PI()*({d}^2-{h:di}^2)/4,IF({section}="custom",{Ac},{b}*{h}))` },
  { key: "c", label: "Distance à la fibre extrême c", unit: "mm", f: `IF(${ROUND},{d}/2,IF({section}="custom",{cc},{h}/2))` },
  { key: "ks", label: "Cisaillement maxi / moyen", unit: "", f: `IF(${ROUND},IF({h:di}>0,2,4/3),IF({section}="custom",1,1.5))` }];
const TUBE = { label: "Tube", f: 'IF(AND({section}="tube",{d}-2*{t}<0),"Paroi plus épaisse que le rayon : section calculée comme une barre pleine","Oui")' };

/* the four beams of Roark, table 8.1 : δ = dn F L³ / (dd E I), M = F L / md, V = kv F, f₁ = λ² / (2π L²) √(E I / ρ A) */
const beam = (dn, dd, md, kv, lam2) => ({ helpers: SEC,
  outputs: { delta: `${dn}*{F}*{L}^3/(${dd}*{E}*1000*{h:I})`, sigma: `({F}*{L}/${md})*{h:c}/{h:I}`, sf_yield: upTo999("{Re}", "{o:sigma}"), f1: `${lam2}/(2*PI()*({L}/1000)^2)*SQRT({E}*1000*{h:I}*0.000001/({rho}*{h:A}*0.000001))`,
    stiffness: `IF({F}>0,{F}/{o:delta},${dd}*{E}*1000*{h:I}/(${dn}*{L}^3))`, M: `{F}*{L}/${md}/1000`, tau: `{h:ks}*${kv}*{F}/{h:A}`, I: "{h:I}", mass: "{rho}*{h:A}*{L}*0.000001" },
  checks: [{ label: "Contrainte de flexion vs limite élastique", unit: "MPa", value: "{o:sigma}", limit: "{Re}", sf: "{sf}" }, { label: "Flèche vs flèche admissible", unit: "mm", value: "{o:delta}", limit: "{dlim}" }],
  flags: [{ label: "Poutre élancée (L / h ≥ 10)", f: 'IF({L}/(2*{h:c})<10,"NON : poutre courte, la flèche réelle est plus grande","Oui")' }, { label: "Petite flèche (δ ≤ L / 10)", f: 'IF({o:delta}>{L}/10,"NON : la formule linéaire sort de son domaine","Oui")' },
    { label: "Poids propre négligeable", f: 'IF(AND({F}>0,{o:mass}/1000*9.80665>0.2*{F}),"NON : le poids propre dépasse 20 % de la charge, l\'ajouter comme charge répartie","Oui")' }, TUBE] });

const buckling = {
  helpers: [...SEC.slice(0, 3), { key: "r", label: "Rayon de giration r = √(I / A)", unit: "mm", f: "SQRT({h:I}/{h:A})" }, { key: "K", label: "Coefficient de longueur K", unit: "", f: pick("ends", ENDS, 1) }],
  outputs: { Le: "{h:K}*{L}", lambda: "{o:Le}/{h:r}", lambda1: "SQRT(2*PI()^2*{E}*1000/{Re})", johnson: "IF({o:lambda}<{o:lambda1},1,0)",
    sigma_cr: "IF({o:lambda}<{o:lambda1},{Re}*(1-{Re}*{o:lambda}^2/(4*PI()^2*{E}*1000)),PI()^2*{E}*1000/{o:lambda}^2)", Pcr: "{o:sigma_cr}*{h:A}", sigma: "{F}/{h:A}", margin: upTo999("{o:Pcr}", "{F}") },
  checks: [{ label: "Effort de compression vs charge critique de flambement", unit: "N", value: "{F}", limit: "{o:Pcr}", sf: "{sf}" }, { label: "Contrainte de compression vs limite élastique", unit: "MPa", value: "{o:sigma}", limit: "{Re}" }],
  flags: [{ label: "Régime", ok: "Euler : flambement élastique", f: 'IF({o:johnson}=1,"Johnson : élancement sous la limite d\'Euler, flambement inélastique","Euler : flambement élastique")' }, { label: "Élancement (λ ≤ 200)", f: 'IF({o:lambda}>200,"NON : colonne très sensible aux défauts de rectitude","Oui")' }, TUBE],
};

const torsion = {
  helpers: [{ key: "dint", label: "Diamètre intérieur retenu", unit: "mm", f: "IF({di}>={do},0,{di})" }, { key: "J", label: "Moment quadratique polaire J", unit: "mm⁴", f: "PI()*({do}^4-{h:dint}^4)/32" }, { key: "tauY", label: "Limite en cisaillement 0,577 Re", unit: "MPa", f: "0.577*{Re}" }],
  outputs: { tau: "{T}*1000*({do}/2)/{h:J}", theta: "{T}*1000*{L}/({G}*1000*{h:J})*180/PI()", sf_yield: upTo999("{h:tauY}", "{o:tau}"), kt: "{G}*1000*{h:J}/{L}/1000", J: "{h:J}" },
  checks: [{ label: "Cisaillement vs limite élastique en cisaillement (0,577 Re)", unit: "MPa", value: "{o:tau}", limit: "{h:tauY}", sf: "{sf}" }, { label: "Angle de torsion vs angle admissible", unit: "°", value: "{o:theta}", limit: "{theta_lim}" }],
  flags: [{ label: "Diamètres", f: 'IF({di}>={do},"Diamètre intérieur ≥ diamètre extérieur : arbre calculé plein","Oui")' }, { label: "Paroi du tube (t ≥ d / 20)", f: 'IF(AND({h:dint}>0,({do}-{h:dint})/2<{do}/20),"NON : paroi très mince, vérifier aussi le voilement en torsion","Oui")' }],
};

const coef = (name) => `IF({edges}="fixed",${between(PLATE.fixed.r, PLATE.fixed[name], "{h:ratio}")},${between(PLATE.ss.r, PLATE.ss[name], "{h:ratio}")})`;
const plate = {
  helpers: [{ key: "a", label: "Grand côté retenu", unit: "mm", f: "MAX({a},{b})" }, { key: "b", label: "Petit côté retenu", unit: "mm", f: "MIN({a},{b})" }, { key: "ratio", label: "Rapport des côtés a / b", unit: "", f: "{h:a}/{h:b}" }, { key: "q", label: "Pression p", unit: "MPa", f: "{p}/1000" }],
  outputs: { beta: coef("beta"), alpha: coef("alpha"), sigma: "{o:beta}*{h:q}*{h:b}^2/{t}^2", y: "{o:alpha}*{h:q}*{h:b}^4/({E}*1000*{t}^3)", sf_yield: upTo999("{Re}", "{o:sigma}"), force: "{h:q}*{h:a}*{h:b}" },
  checks: [{ label: "Contrainte maximale vs limite élastique", unit: "MPa", value: "{o:sigma}", limit: "{Re}", sf: "{sf}" }, { label: "Flèche au centre vs flèche admissible", unit: "mm", value: "{o:y}", limit: "{dlim}" }],
  flags: [{ label: "Côtés", f: 'IF({a}<{b},"Grand et petit côtés inversés : a est pris comme le plus grand des deux","Oui")' }, { label: "Petite flèche (y ≤ t / 2)", f: 'IF({o:y}>{t}/2,"NON : la plaque réelle est plus raide (effet de membrane), le résultat est prudent pour la flèche","Oui")' },
    { label: "Plaque mince (t ≤ b / 4)", f: 'IF({t}>{h:b}/4,"NON : la théorie des plaques minces ne s\'applique plus","Oui")' }],
};

const mismatch = {
  helpers: [{ key: "da", label: "Écart de dilatation Δα", unit: "1/K", f: "({cte1}-{cte2})*0.000001" }, { key: "eps", label: "Déformation libre |Δα ΔT|", unit: "", f: "ABS({h:da}*{o:dT})" }, { key: "left", label: "Dilatation à absorber après le jeu", unit: "mm", f: "MAX(0,ABS({o:delta})-{play})" }],
  outputs: { dT: "{T}-{T0}", delta: "{h:da}*{o:dT}*{L}", force: "({h:left}/{L})/(1/({E1}*1000*{A1})+1/({E2}*1000*{A2}))", sigma1: "{o:force}/{A1}", sigma2: "{o:force}/{A2}", sigma1_blocked: "{E1}*1000*{h:eps}", sigma2_blocked: "{E2}*1000*{h:eps}" },
  checks: [{ label: "Contrainte dans le matériau 1 vs limite élastique", unit: "MPa", value: "{o:sigma1}", limit: "{Re1}", sf: "{sf}" }, { label: "Contrainte dans le matériau 2 vs limite élastique", unit: "MPa", value: "{o:sigma2}", limit: "{Re2}", sf: "{sf}" },
    { label: "Dilatation différentielle vs jeu disponible", unit: "mm", value: "ABS({o:delta})", limit: "{play}", soft: true, when: "{play}>0" }],
  flags: [{ label: "Écart de température (|ΔT| ≤ 150 K)", f: 'IF(ABS({o:dT})>150,"NON : les coefficients de dilatation et les modules varient, prendre des valeurs moyennes sur la plage","Oui")' },
    { label: "Jeu aux fixations", info: true, f: 'IF({play}>0,IF(ABS({o:delta})>{play},"Le jeu ne suffit pas : les pièces se contraignent","Le jeu absorbe toute la dilatation"),"Liaison rigide")' }],
};

export const XL_STRUCTURE = { beam_cantilever_point: beam(1, 3, 1, 1, 3.516), beam_cantilever_udl: beam(1, 8, 2, 1, 3.516), beam_simple_point: beam(1, 48, 4, 0.5, "PI()^2"), beam_simple_udl: beam(5, 384, 8, 0.5, "PI()^2"),
  column_buckling: buckling, shaft_torsion: torsion, plate_pressure: plate, thermal_mismatch: mismatch };
