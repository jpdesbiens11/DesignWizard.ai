/* DesignOrbit.ai — PCBA: function blocks that measure — temperature, current, bus voltage, motion. A measurement that
   goes to the microcontroller asks for the next free analogue input (ports with `pool`). */

import { builder, P, eSeries, fr, ohm, farad } from "./blocks_util.js";
import { railName } from "./netnames.js";

const pw = (v, i) => ({ class: Math.abs(v) >= 60 ? "hv" : "power", voltage: v, current: i }), GND = { class: "ground" };

const ntc = { id: "ntc", name: "Mesure de température par CTN", category: "Mesurer", function: "Mesurer la température (CTN 10 kΩ), filtre à {fc} Hz", desc: "Pont diviseur avec une CTN, filtre RC avant le convertisseur.",
  params: { vref: P("Tension de référence", "V", 3.3, 1.8, 5), rp: P("Résistance du pont", "kΩ", 10, 1, 100), fc: P("Fréquence de coupure", "Hz", 100, 1, 10000),
    remote: P("CTN déportée sur un flex, par son joint", "", 0, 0, 1, { options: [0, 1], labels: ["non", "oui"] }) },
  build(p) {
    const b = builder(), rp = p.rp * 1e3, c = eSeries(1 / (2 * Math.PI * 1e3 * p.fc), "E6"), fc = 1 / (2 * Math.PI * 1e3 * c), v25 = p.vref * 1e4 / (1e4 + rp), remote = +p.remote === 1;
    if (!remote) b.part("RT", "NTC-0603", "10 kΩ B 3950", "Sonde de température");
    b.part("RP", "R-0603", `${ohm(rp)} 1 %`, "Haut du pont diviseur", remote ? {} : { near: "RT" }).part("RF", "R-0603", "1 kΩ", "Filtre anti-repliement", { near: "RT" }).part("CF", "C-0603", farad(c), "Filtre anti-repliement", { near: "RF" });
    b.net("VREF", ["RP.1"], pw(p.vref, 0.001)).net("DIV", ["RP.2", ...(remote ? [] : ["RT.1"]), "RF.1"]).net("OUT", ["RF.2", "CF.1"]).net("GND", [...(remote ? [] : ["RT.2"]), "CF.2"], GND);
    b.port("VREF", "VREF", "power_in", railName(p.vref)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "AIN", { pool: true });
    if (remote) { b.port("NTC", "DIV", "bidir", "NTC", { pool: true }); b.note("La CTN est sur le flex : sa piste va du joint au pont ; son retour rejoint la masse au joint, loin des courants de la carte."); }
    b.calc("Tension à 25 °C", v25, "V", `V = Vref × R25 / (R25 + Rp) = ${fr(p.vref)} × 10 kΩ / (10 kΩ + ${ohm(rp)}) = ${fr(v25)} V.`);
    b.calc("Fréquence de coupure", fc, "Hz", `fc = 1 / (2π R C) = 1 / (2π × 1 kΩ × ${farad(c)}) = ${fr(fc)} Hz.`);
    b.note("CTN contre la pièce dont on mesure la température, loin des sources de chaleur parasites.");
    return b.out();
  } };

const shunt = { id: "shunt", name: "Mesure de courant par shunt", category: "Mesurer", function: "Mesurer le courant jusqu'à {imax} A", desc: "Résistance de mesure quatre fils et amplificateur de gain 20.",
  params: { imax: P("Courant maximal", "A", 10, 0.1, 60), vbus: P("Tension de la ligne", "V", 24, 0, 80), vdd: P("Alimentation de la mesure", "V", 3.3, 2.7, 5) },
  build(p) {
    const b = builder(), gain = 20, r = eSeries(0.9 * p.vdd / (gain * p.imax), "E24", "down"), power = p.imax * p.imax * r, line = pw(p.vbus, p.imax);
    b.part("RS", "R-SHUNT-2512", `${ohm(r)} 1 %`, "Convertit le courant en tension").part("U", "U-CSA-SOT23-5", "gain 20", "Amplifie la tension du shunt", { near: "RS" }).part("C", "C-0603", "100 nF", "Découplage", { near: "U" });
    b.part("RF", "R-0603", "100 Ω", "Filtre de sortie", { near: "U" }).part("CF", "C-0603", "10 nF", "Filtre de sortie", { near: "RF" });
    b.net("IN", ["RS.1", "U.IN+"], line).net("LOAD", ["RS.2", "U.IN-"], line).net("VDD", ["U.VS", "C.1"], pw(p.vdd, 0.005)).net("GND", ["U.GND", "C.2", "CF.2"], GND).net("AMP", ["U.OUT", "RF.1"]).net("OUT", ["RF.2", "CF.1"]);
    b.port("IN", "IN", "power_in", railName(p.vbus)).port("LOAD", "LOAD", "power_out", `${railName(p.vbus)}_MES`).port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "AIN", { pool: true });
    b.calc("Résistance de mesure", r * 1000, "mΩ", `R = 0,9 × Vdd / (gain × Imax) = 0,9 × ${fr(p.vdd)} / (${gain} × ${fr(p.imax)}) = ${ohm(0.9 * p.vdd / (gain * p.imax))} → ${ohm(r)}.`);
    b.calc("Puissance dans le shunt", power, "W", `P = Imax² R = ${fr(p.imax)}² × ${ohm(r)} = ${fr(power)} W${power > 1.5 ? " : au-delà de 75 % des 2 W du boîtier 2512 — mettez deux shunts en parallèle ou réduisez la résistance." : " (boîtier 2512 : 2 W)."}`);
    b.calc("Pleine échelle", gain * r * p.imax, "V", `Vs = gain × R × Imax = ${gain} × ${ohm(r)} × ${fr(p.imax)} A = ${fr(gain * r * p.imax)} V.`);
    b.note("Prises de mesure quatre fils : les deux pistes vers l'amplificateur partent de l'intérieur des pastilles du shunt, côte à côte.").note("Cuivre de puissance large de part et d'autre du shunt.");
    return b.out();
  } };

const vbus_sense = { id: "vbus_sense", name: "Mesure de la tension du bus", category: "Mesurer", function: "Mesurer la tension du bus {vbus} V", desc: "Pont diviseur de précision et filtre.",
  params: { vbus: P("Tension nominale du bus", "V", 24, 3, 100), vdd: P("Pleine échelle du convertisseur", "V", 3.3, 1.8, 5) },
  build(p) {
    const b = builder(), r2 = 10e3, r1 = eSeries(r2 * (1.25 * p.vbus / (0.9 * p.vdd) - 1), "E96", "up"), ratio = r2 / (r1 + r2);
    b.part("R1", "R-0805", `${ohm(r1)} 1 %`, "Haut du pont diviseur").part("R2", "R-0603", `${ohm(r2)} 1 %`, "Bas du pont diviseur", { near: "R1" }).part("C", "C-0603", "100 nF", "Filtre et réservoir du convertisseur", { near: "R2" });
    b.net("VBUS", ["R1.1"], pw(p.vbus, 0.001)).net("OUT", ["R1.2", "R2.1", "C.1"]).net("GND", ["R2.2", "C.2"], GND);
    b.port("VBUS", "VBUS", "power_in", railName(p.vbus)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "AIN", { pool: true });
    b.calc("Rapport du pont", ratio, "", `R2 / (R1 + R2) = ${ohm(r2)} / (${ohm(r1)} + ${ohm(r2)}) = ${fr(ratio, 4)} : ${fr(p.vbus)} V donnent ${fr(p.vbus * ratio)} V, la pleine échelle est atteinte à ${fr(p.vdd / ratio)} V.`);
    b.note("Résistance du haut en boîtier 0805 pour sa tenue en tension ; garder la distance d'isolement autour du net du bus.");
    return b.out();
  } };

const imu = { id: "imu", name: "Centrale inertielle", category: "Mesurer", function: "Mesurer l'accélération et la rotation (6 axes, I²C)", desc: "Capteur, découplage, résistances de rappel du bus I²C.",
  params: { vdd: P("Alimentation", "V", 3.3, 1.8, 3.6), pull: P("Rappels du bus I²C", "", 1, 0, 1, { options: [1, 0], labels: ["oui", "non"] }) },
  build(p) {
    const b = builder(), pull = +p.pull === 1;
    b.part("U", "U-IMU-LGA14", "", "Accéléromètre et gyromètre", { nc: ["INT2"] }).part("CV", "C-0603", "100 nF", "Découplage", { near: "U" }).part("CIO", "C-0603", "100 nF", "Découplage des entrées-sorties", { near: "U" });
    if (pull) b.part("RSCL", "R-0603", "4,7 kΩ", "Rappel de l'horloge I²C", { near: "U" }).part("RSDA", "R-0603", "4,7 kΩ", "Rappel des données I²C", { near: "U" });
    b.net("VDD", ["U.VDD", "U.VDDIO", "U.CS", "CV.1", "CIO.1", ...(pull ? ["RSCL.1", "RSDA.1"] : [])], pw(p.vdd, 0.005)).net("GND", ["U.GND", "U.SDO", "CV.2", "CIO.2"], GND);
    b.net("SCL", ["U.SCL", ...(pull ? ["RSCL.2"] : [])]).net("SDA", ["U.SDA", ...(pull ? ["RSDA.2"] : [])]).net("INT1", ["U.INT1"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("SCL", "SCL", "in", "I2C_SCL").port("SDA", "SDA", "bidir", "I2C_SDA").port("INT1", "INT1", "out", "IMU_INT");
    if (pull) b.calc("Rappels I²C", 4.7, "kΩ", `I = Vdd / R = ${fr(p.vdd)} V / 4,7 kΩ = ${fr(p.vdd / 4.7)} mA par ligne : convient jusqu'à 400 kHz sur une carte.`);
    b.note("Capteur loin des vis, des bords de carte et des pièces chaudes : les contraintes mécaniques décalent sa mesure.").note("Aucune piste ni via sous le boîtier.");
    return b.out();
  } };

export const SENSE_BLOCKS = [ntc, shunt, vbus_sense, imu];
