/* DesignWizard.ai — PCBA: function blocks that bring power in, protect it, convert it and switch it. Each template
   sizes its own parts the way a designer does it by hand, and says so in `calc`. Typical values : the data sheet of
   the chosen references prevails. */

import { builder, P, eSeries, fr, ohm, farad, henry } from "./blocks_util.js";
import { railName } from "./netnames.js";

const up = (list, v) => list.find((x) => x >= v) || list[list.length - 1];
const pw = (v, i) => ({ class: Math.abs(v) >= 60 ? "hv" : "power", voltage: v, current: i });
const GND = { class: "ground" };

const conn_power = { id: "conn_power", name: "Bornier d'alimentation", category: "Raccorder", function: "Recevoir l'alimentation {v} V, {i} A", desc: "Bornier à vis au bord de la carte.",
  params: { v: P("Tension", "V", 24, 3, 100), i: P("Courant", "A", 5, 0.1, 16) },
  build(p) {
    const b = builder(), big = p.i > 8;
    b.part("J", big ? "J-TB-2-5.08" : "J-TB-2-3.5", `${fr(p.v)} V`, "Entrée d'alimentation", { edge: true });
    b.net("VIN", ["J.1"], pw(p.v, p.i)).net("GND", ["J.2"], { ...GND, current: p.i });
    b.port("VIN", "VIN", "power_out", `${railName(p.v)}_IN`).port("GND", "GND", "gnd", "GND");
    b.calc("Courant par contact", p.i, "A", `${fr(p.i)} A demandés pour ${big ? 16 : 8} A admissibles par contact (pas ${big ? "5,08" : "3,5"} mm).`);
    b.note("Bornier au bord de la carte, vis accessibles ; repérer + et − en sérigraphie.");
    return b.out();
  } };

const input_protection = { id: "input_protection", name: "Protection d'entrée", category: "Protéger", function: "Protéger l'entrée {v} V contre l'inversion, la surtension et le court-circuit", desc: "Fusible, MOSFET P contre l'inversion de polarité, diode TVS, réservoir.",
  params: { v: P("Tension", "V", 24, 5, 60), i: P("Courant", "A", 3, 0.1, 15) },
  build(p) {
    const b = builder(), fuse = up([0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20], 1.5 * p.i), small = p.i <= 2.5 && p.v <= 24, rds = small ? 0.06 : 0.04;
    const tvs = up([5, 12, 15, 18, 24, 28, 33, 36, 48, 58, 64, 70], 1.15 * p.v), cv = up([16, 25, 35, 50, 63, 100], 1.5 * p.v), zener = p.v > 15;
    b.part("F", "F-1206", `${fr(fuse)} A rapide`, "Coupe en cas de court-circuit").part("Q", small ? "Q-PMOS-SOT23" : "Q-PMOS-DPAK", "", "Bloque si la polarité est inversée", { near: "F" });
    b.part("RG", "R-0603", "100 kΩ", "Tire la grille à la masse", { near: "Q" });
    if (zener) b.part("DZ", "D-ZEN-SOD123", "12 V", "Limite la tension grille-source", { near: "Q" });
    b.part("TVS", "D-TVS-SMB", `${fr(tvs)} V`, "Écrête les surtensions").part("CB", cv > 63 ? "CE-D10" : "CE-D8", `100 µF ${cv} V`, "Réservoir d'entrée").part("C", "C-1206", "1 µF 100 V", "Découplage haute fréquence", { near: "CB" });
    b.net("IN", ["F.1"], pw(p.v, p.i)).net("FUSED", ["F.2", "Q.D"], pw(p.v, p.i)).net("OUT", ["Q.S", "TVS.K", "CB.+", "C.1", ...(zener ? ["DZ.K"] : [])], pw(p.v, p.i));
    b.net("GATE", ["Q.G", "RG.1", ...(zener ? ["DZ.A"] : [])], { voltage: p.v }).net("GND", ["RG.2", "TVS.A", "CB.-", "C.2"], { ...GND, current: p.i });
    b.port("IN", "IN", "power_in", `${railName(p.v)}_IN`).port("OUT", "OUT", "power_out", railName(p.v)).port("GND", "GND", "gnd", "GND");
    b.calc("Calibre du fusible", fuse, "A", `1,5 × ${fr(p.i)} A = ${fr(1.5 * p.i)} A → calibre normalisé ${fr(fuse)} A.`);
    b.calc("Tension de veille de la TVS", tvs, "V", `≥ 1,15 × ${fr(p.v)} V = ${fr(1.15 * p.v)} V → ${fr(tvs)} V : elle ne conduit pas en service.`);
    b.calc("Pertes du MOSFET", p.i * p.i * rds, "W", `P = I² R = ${fr(p.i)}² × ${fr(rds)} Ω = ${fr(p.i * p.i * rds)} W.`);
    b.note("Fusible et TVS au plus près du connecteur d'entrée : la surtension ne doit pas traverser la carte.").note("Piste d'entrée dimensionnée pour le calibre du fusible, pas pour le courant nominal.");
    return b.out();
  } };

const buck = { id: "buck", name: "Régulateur abaisseur", category: "Alimenter", function: "Abaisser {vin} V vers {vout} V, {iout} A", desc: "Convertisseur à découpage synchrone : inductance, condensateurs, pont de contre-réaction.",
  params: { vin: P("Tension d'entrée", "V", 24, 4.5, 60), vout: P("Tension de sortie", "V", 5, 0.8, 24), iout: P("Courant de sortie", "A", 1, 0.05, 3), ripple: P("Ondulation de courant", "%", 30, 10, 50) },
  build(p) {
    const b = builder(), small = p.iout <= 1, f = small ? 500e3 : 400e3, dI0 = p.ripple / 100 * p.iout, L0 = p.vout * (p.vin - p.vout) / (p.vin * f * dI0), L = eSeries(L0, "E6", "up");
    const dI = p.vout * (p.vin - p.vout) / (p.vin * f * L), ipk = p.iout + dI / 2, r2 = 10e3, r1 = eSeries(r2 * (p.vout / 0.8 - 1), "E96"), vreal = 0.8 * (1 + r1 / r2);
    const cv = (v) => up([10, 16, 25, 50, 100], 1.5 * v), iin = p.vout * p.iout / (0.9 * p.vin), loss = p.vout * p.iout * (1 / 0.9 - 1);
    b.part("U", small ? "U-BUCK-SOT23-6" : "U-BUCK-SOIC8", "", "Découpe la tension d'entrée").part("L", ipk <= 1.6 ? "L-4040" : ipk <= 4 ? "L-6060" : "L-1040", henry(L), "Lisse le courant", { near: "U" });
    b.part("CIN", "C-1210", `10 µF ${cv(p.vin)} V`, "Fournit le courant pulsé d'entrée", { near: "U" }).part("CHF", "C-1206", "100 nF 100 V", "Découplage haute fréquence de l'entrée", { near: "U" });
    b.part("COUT1", "C-1206", `22 µF ${cv(p.vout)} V`, "Filtre la sortie", { near: "L" }).part("COUT2", "C-1206", `22 µF ${cv(p.vout)} V`, "Filtre la sortie", { near: "L" });
    b.part("CBST", "C-0603", "100 nF", "Alimente le transistor côté haut", { near: "U" }).part("RFB1", "R-0603", `${ohm(r1)} 1 %`, "Pont de contre-réaction, haut", { near: "U" }).part("RFB2", "R-0603", `${ohm(r2)} 1 %`, "Pont de contre-réaction, bas", { near: "U" });
    b.part("REN", "R-0603", "100 kΩ", "Valide le régulateur dès la mise sous tension", { near: "U" });
    b.net("VIN", ["U.VIN", "CIN.1", "CHF.1", "REN.1"], pw(p.vin, iin)).net("SW", ["U.SW", "L.1", "CBST.2"], pw(p.vin, p.iout)).net("BST", ["U.BST", "CBST.1"], { voltage: p.vin });
    b.net("VOUT", ["L.2", "COUT1.1", "COUT2.1", "RFB1.1"], pw(p.vout, p.iout)).net("FB", ["U.FB", "RFB1.2", "RFB2.1"]).net("EN", ["U.EN", "REN.2"], { voltage: p.vin });
    b.net("GND", ["U.GND", "CIN.2", "CHF.2", "COUT1.2", "COUT2.2", "RFB2.2"], { ...GND, current: p.iout });
    if (!small) {
      b.part("CSS", "C-0603", "10 nF", "Démarrage progressif", { near: "U" }).part("RC", "R-0603", "10 kΩ", "Compensation de la boucle", { near: "U" }).part("CC", "C-0603", "4,7 nF", "Compensation de la boucle", { near: "U" });
      b.net("SS", ["U.SS", "CSS.1"]).net("COMP", ["U.COMP", "RC.1"]).net("COMPRC", ["RC.2", "CC.1"]).net("GND", ["CSS.2", "CC.2"]);
    }
    b.port("VIN", "VIN", "power_in", railName(p.vin)).port("VOUT", "VOUT", "power_out", railName(p.vout)).port("GND", "GND", "gnd", "GND");
    b.calc("Rapport cyclique", p.vout / p.vin, "", `D = Vs / Ve = ${fr(p.vout)} / ${fr(p.vin)} = ${fr(p.vout / p.vin)}.`);
    b.calc("Inductance", L * 1e6, "µH", `L = Vs (Ve − Vs) / (Ve f ΔI) = ${fr(p.vout)} × ${fr(p.vin - p.vout)} / (${fr(p.vin)} × ${fr(f / 1e3)} kHz × ${fr(dI0)} A) = ${henry(L0)} → valeur normalisée ${henry(L)}.`);
    b.calc("Courant de crête dans l'inductance", ipk, "A", `Is + ΔI / 2 = ${fr(p.iout)} + ${fr(dI)} / 2 = ${fr(ipk)} A : le courant de saturation de l'inductance doit le dépasser de 20 %.`);
    b.calc("Tension de sortie réelle", vreal, "V", `Vs = 0,8 V × (1 + R1 / R2) = 0,8 × (1 + ${ohm(r1)} / ${ohm(r2)}) = ${fr(vreal, 4)} V.`);
    b.calc("Pertes estimées", loss, "W", `Rendement supposé de 90 % : ${fr(loss)} W à évacuer par le cuivre.`);
    b.note("Boucle d'entrée (CIN – U – masse) la plus courte possible : c'est elle qui rayonne.").note("Nœud de commutation SW petit et loin du pont de contre-réaction.").note("Plan de masse continu sous le régulateur ; la piste FB part de la sortie, après les condensateurs.");
    return b.out();
  } };

const ldo = { id: "ldo", name: "Régulateur linéaire", category: "Alimenter", function: "Réguler {vin} V vers {vout} V, {iout} A, sans bruit de découpage", desc: "Régulateur à faible chute et ses deux condensateurs.",
  params: { vin: P("Tension d'entrée", "V", 5, 1.8, 15), vout: P("Tension de sortie", "V", 3.3, 0.8, 12), iout: P("Courant de sortie", "A", 0.2, 0.01, 1) },
  build(p) {
    const b = builder(), loss = (p.vin - p.vout) * p.iout, small = p.iout <= 0.3 && p.vin <= 6 && loss * 200 <= 60, theta = small ? 200 : 60, rise = loss * theta;      // the small package only while it stays cool
    b.part("U", small ? "U-LDO-SOT23-5" : "U-LDO-SOT223", `${fr(p.vout)} V`, "Régule la tension", small ? { nc: ["NC"] } : {});
    b.part("CIN", "C-0603", "1 µF 16 V", "Stabilise l'entrée", { near: "U" }).part("COUT", "C-0805", small ? "2,2 µF 16 V" : "10 µF 16 V", "Stabilise la sortie", { near: "U" });
    b.net("VIN", ["U.VIN", "CIN.1", ...(small ? ["U.EN"] : [])], pw(p.vin, p.iout)).net("VOUT", ["U.VOUT", "COUT.1"], pw(p.vout, p.iout)).net("GND", ["U.GND", "CIN.2", "COUT.2"], GND);
    b.port("VIN", "VIN", "power_in", railName(p.vin)).port("VOUT", "VOUT", "power_out", railName(p.vout)).port("GND", "GND", "gnd", "GND");
    b.calc("Puissance dissipée", loss, "W", `P = (Ve − Vs) × Is = (${fr(p.vin)} − ${fr(p.vout)}) × ${fr(p.iout)} = ${fr(loss)} W.`);
    b.calc("Échauffement de la jonction", rise, "K", `ΔT = P × Rth = ${fr(loss)} W × ${theta} K/W = ${fr(rise)} K${rise > 60 ? " : trop chaud — baissez la tension d'entrée ou prenez un régulateur à découpage." : "."}`);
    b.note("Condensateur de sortie contre la broche de sortie : la stabilité en dépend.");
    return b.out();
  } };

const half_bridge = { id: "half_bridge", name: "Demi-pont de puissance", category: "Commander", function: "Commuter la phase {phase} : {vbus} V, {i} A", desc: "Pilote de grille à amorçage, deux MOSFET N, découplage du bus.",
  params: { vbus: P("Tension du bus", "V", 48, 12, 80), i: P("Courant de phase", "A", 20, 1, 60), vdrv: P("Tension de commande", "V", 12, 10, 15), phase: P("Nom de la phase", "", "U", null, null, { text: true }) },
  build(p) {
    const b = builder(), big = p.i > 25, rds = big ? 0.008 : 0.025, loss = p.i * p.i * rds / 2, bus = pw(p.vbus, p.i);
    b.part("U", "U-GATE-HB-SOIC8", "", "Pilote les deux grilles").part("QH", big ? "Q-NMOS-D2PAK" : "Q-NMOS-DPAK", "", "Interrupteur côté haut").part("QL", big ? "Q-NMOS-D2PAK" : "Q-NMOS-DPAK", "", "Interrupteur côté bas", { near: "QH" });
    b.part("RGH", "R-0805", "10 Ω", "Résistance de grille, haut", { near: "QH" }).part("RGL", "R-0805", "10 Ω", "Résistance de grille, bas", { near: "QL" });
    b.part("RPH", "R-0603", "10 kΩ", "Maintient le MOSFET bloqué au repos", { near: "QH" }).part("RPL", "R-0603", "10 kΩ", "Maintient le MOSFET bloqué au repos", { near: "QL" });
    b.part("DBST", "D-SIG-SOD123", "100 V rapide", "Recharge le condensateur d'amorçage", { near: "U" }).part("CBST", "C-0805", "1 µF 25 V", "Alimentation flottante du côté haut", { near: "U" }).part("CVCC", "C-0805", "1 µF 25 V", "Découplage du pilote", { near: "U" });
    b.part("CDC", "CE-D10", "100 µF 100 V", "Réservoir du bus", { near: "QH" }).part("CHF", "C-1210", "1 µF 100 V", "Boucle de commutation", { near: "QH" });
    b.net("VBUS", ["QH.D", "CDC.+", "CHF.1"], bus).net("PHASE", ["QH.S", "QL.D", "U.VS", "CBST.2", "RPH.2"], bus).net("GND", ["QL.S", "U.COM", "CDC.-", "CHF.2", "CVCC.2", "RPL.2"], { ...GND, current: p.i });
    b.net("VDRV", ["U.VCC", "CVCC.1", "DBST.A"], pw(p.vdrv, 0.1)).net("BST", ["U.VB", "DBST.K", "CBST.1"], { voltage: p.vbus + p.vdrv });
    b.net("GH", ["U.HO", "RGH.1"], { voltage: p.vbus + p.vdrv }).net("GHQ", ["RGH.2", "QH.G", "RPH.1"], { voltage: p.vbus + p.vdrv }).net("GL", ["U.LO", "RGL.1"]).net("GLQ", ["RGL.2", "QL.G", "RPL.1"]);
    b.net("HIN", ["U.HIN"]).net("LIN", ["U.LIN"]);
    b.port("VBUS", "VBUS", "power_in", railName(p.vbus)).port("VDRV", "VDRV", "power_in", railName(p.vdrv)).port("GND", "GND", "gnd", "GND");
    b.port("HIN", "HIN", "in", "PWM_H").port("LIN", "LIN", "in", "PWM_L").port("OUT", "PHASE", "power_out", `PHASE_${String(p.phase || "U").toUpperCase()}`);
    b.calc("Pertes par conduction, par MOSFET", loss, "W", `P = I² Rds / 2 = ${fr(p.i)}² × ${fr(rds * 1000)} mΩ / 2 = ${fr(loss)} W (rapport cyclique 50 %) : prévoir le cuivre ou le dissipateur.`);
    b.calc("Condensateur d'amorçage", 1, "µF", "C ≥ 10 × Qg / ΔV : 1 µF couvre une charge de grille de 100 nC avec 1 V de chute.");
    b.note("Boucle de commutation (CHF – QH – QL – masse) la plus courte possible, du même côté de la carte.").note("Retour du pilote (COM) pris sur la source du MOSFET bas, pas sur le plan de masse éloigné.").note("Pistes de grille courtes et larges ; nœud PHASE en cuivre large, loin des mesures.");
    return b.out();
  } };

const load_switch = { id: "load_switch", name: "Commande de charge côté bas", category: "Commander", function: "Commander la charge {name} : {v} V, {i} A", desc: "MOSFET N, résistance de grille, rappel et diode de roue libre.",
  params: { v: P("Tension de la charge", "V", 24, 3, 60), i: P("Courant de la charge", "A", 1, 0.05, 15), name: P("Nom de la charge", "", "CHARGE", null, null, { text: true }) },
  build(p) {
    const b = builder(), small = p.v <= 20 && p.i <= 3, rds = small ? 0.03 : 0.025, name = String(p.name || "CHARGE").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    b.part("Q", small ? "Q-NMOS-SOT23-P" : "Q-NMOS-DPAK", "", "Ferme le circuit de la charge").part("RG", "R-0603", "100 Ω", "Limite le courant de grille", { near: "Q" }).part("RPD", "R-0603", "100 kΩ", "Charge coupée tant que le microcontrôleur démarre", { near: "Q" });
    b.part("D", "D-SCH-SMA", "60 V 2 A", "Roue libre d'une charge inductive", { near: "Q" });
    b.net("VLOAD", ["D.K"], pw(p.v, p.i)).net("OUT", ["Q.D", "D.A"], pw(p.v, p.i)).net("GATE", ["RG.2", "Q.G", "RPD.1"]).net("IN", ["RG.1"]).net("GND", ["Q.S", "RPD.2"], { ...GND, current: p.i });
    b.port("VLOAD", "VLOAD", "power_in", railName(p.v)).port("OUT", "OUT", "out", `${name}_OUT`).port("IN", "IN", "in", "DOUT", { pool: true }).port("GND", "GND", "gnd", "GND");
    b.calc("Pertes du MOSFET", p.i * p.i * rds, "W", `P = I² Rds = ${fr(p.i)}² × ${fr(rds * 1000)} mΩ = ${fr(p.i * p.i * rds)} W.`);
    b.note("Diode de roue libre au plus près du connecteur de la charge.");
    return b.out();
  } };

/* Passive balancing of one cell block (choix de JP, 21 novembre 2026 : « équilibrage passif » sur la carte de chaque CORE) : on
   command of the central BMS, a MOSFET puts two resistors across the cells ; a block a little more charged than the others gives its
   extra charge away as heat. Sized from the current asked at the full voltage : R = V / I, P = V² / R, shared by two resistors. The
   voltage of the block is measured with the balancing off : its current flows in the same leads. */
const balance = { id: "balance", name: "Équilibrage passif", category: "Commander", function: "Équilibrer le cell block : {i} mA à {v} V", desc: "MOSFET N côté bas, deux résistances de purge, résistance de grille et rappel qui tient la purge coupée au démarrage.",
  params: { v: P("Tension pleine du cell block", "V", 4.2, 2.5, 5), i: P("Courant d'équilibrage", "mA", 100, 10, 300) },
  build(p) {
    const b = builder(), i = p.i / 1000, r1 = eSeries(2 * p.v / i, "E24", "up"), req = r1 / 2, iReal = p.v / req, pw1 = (p.v * p.v / req) / 2, big = pw1 > 0.25 * 0.5, pkg = big ? "R-2512" : "R-1206";
    b.part("Q", "Q-NMOS-SOT23-P", "", "Ferme la purge sur ordre du BMS central").part("RB1", pkg, `${ohm(r1)} 1 %`, "Purge du cell block", { near: "Q" }).part("RB2", pkg, `${ohm(r1)} 1 %`, "Purge du cell block", { near: "RB1" });
    b.part("RG", "R-0603", "100 Ω", "Limite le courant de grille", { near: "Q" }).part("RPD", "R-0603", "100 kΩ", "Purge coupée tant que le microcontrôleur démarre", { near: "Q" });
    b.net("VCELL", ["RB1.1", "RB2.1"], pw(p.v, iReal)).net("BLEED", ["RB1.2", "RB2.2", "Q.D"], pw(p.v, iReal)).net("GATE", ["RG.2", "Q.G", "RPD.1"]).net("IN", ["RG.1"]).net("GND", ["Q.S", "RPD.2"], { ...GND, current: iReal });
    b.port("VCELL", "VCELL", "power_in", railName(p.v)).port("IN", "IN", "in", "DOUT", { pool: true }).port("GND", "GND", "gnd", "GND");      // a logic output of the microcontroller
    b.calc("Résistances de purge", r1, "Ω", `Deux en parallèle : R = 2 × V / I = 2 × ${fr(p.v)} V / ${fr(p.i)} mA = ${ohm(2 * p.v / i)}, valeur normalisée au-dessus : ${ohm(r1)} chacune, ${ohm(req)} ensemble.`);
    b.calc("Courant de purge à pleine tension", +(iReal * 1000).toFixed(1), "mA", `I = V / R = ${fr(p.v)} V / ${ohm(req)} = ${fr(iReal * 1000)} mA.`);
    b.calc("Puissance dans chaque résistance", +pw1.toFixed(3), "W", `P = V² / R / 2 = ${fr(p.v)}² / ${ohm(req)} / 2 = ${fr(pw1, 3)} W : boîtier ${big ? "2512" : "1206"}, à moins de la moitié de sa puissance nominale (valeur typique : la fiche du composant monté fait foi).`);
    b.note("Les résistances de purge chauffent : loin des CTN et du microcontrôleur, au-dessus d'une large surface de cuivre.").note("Mesurer la tension du cell block purge coupée : son courant passe dans les mêmes fils.");
    return b.out();
  } };

export const POWER_BLOCKS = [conn_power, input_protection, buck, ldo, half_bridge, load_switch, balance];
export { farad };
