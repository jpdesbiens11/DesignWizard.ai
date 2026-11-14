/* DesignWizard.ai — PCBA: function blocks that compute, communicate, connect and signal. The microcontroller offers
   its pins as LAZY ports : a pin joins a net only when another block brings that net (CAN_TX, AIN0, I2C_SCL…), so an
   unused pin stays free instead of dangling on a net of its own. */

import { builder, P, eSeries, fr, ohm } from "./blocks_util.js";
import { railName, netClass } from "./netnames.js";

const pw = (v, i) => ({ class: "power", voltage: v, current: i }), GND = { class: "ground" };
const VDD = { 48: ["1", "24", "36", "48"], 32: ["1", "17"] };
/** Function of each pin a block may ask the microcontroller for : port name → [pin, net it joins, direction]. */
const MCU_PORTS = { SWDIO: ["SWDIO", "SWDIO", "bidir"], SWCLK: ["SWCLK", "SWCLK", "in"], CAN_TX: ["PA12", "CAN_TX", "out"], CAN_RX: ["PA11", "CAN_RX", "in"], I2C_SCL: ["PB6", "I2C_SCL", "out"], I2C_SDA: ["PB7", "I2C_SDA", "bidir"],
  UART_TX: ["PA9", "UART_TX", "out"], UART_RX: ["PA10", "UART_RX", "in"], RS485_DE: ["PB1", "RS485_DE", "out"], AIN0: ["PA0", "AIN0", "in"], AIN1: ["PA1", "AIN1", "in"], AIN2: ["PA2", "AIN2", "in"], AIN3: ["PA3", "AIN3", "in"],
  PWM_H: ["PA8", "PWM_H", "out"], PWM_L: ["PA7", "PWM_L", "out"], LED: ["PA15", "LED_STATUS", "out"], DOUT0: ["PB3", "DOUT0", "out"], DOUT1: ["PB4", "DOUT1", "out"], DOUT2: ["PB5", "DOUT2", "out"], IMU_INT: ["PB0", "IMU_INT", "in"] };

const mcu = { id: "mcu", name: "Microcontrôleur", category: "Calculer", function: "Calculer et piloter : microcontrôleur 32 bits, {pins} broches", desc: "Cœur, découplage par broche d'alimentation, quartz, remise à zéro, mode de démarrage.",
  params: { pins: P("Boîtier", "broches", 48, 32, 48, { options: [32, 48] }), xtal: P("Quartz (0 = aucun)", "MHz", 8, 0, 25), vdd: P("Alimentation", "V", 3.3, 1.8, 3.6) },
  build(p) {
    const b = builder(), n = +p.pins === 32 ? 32 : 48, vdd = VDD[n], gnd = ["U.VSS", ...(n === 48 ? ["U.VSSA"] : []), "CB.2", "CA1.2", "CA2.2", "CR.2", "RB.2"];
    b.part("U", `U-MCU-LQFP${n}`, "", "Calcule, mesure et commande", p.xtal ? {} : { nc: ["OSC_IN", "OSC_OUT"] });
    vdd.forEach((pin, i) => { b.part(`CD${i + 1}`, "C-0603", "100 nF", `Découplage de la broche ${pin}`, { near: "U", pin }); gnd.push(`CD${i + 1}.2`); });
    b.part("CB", "C-0805", "4,7 µF", "Réserve locale", { near: "U" }).part("FB", "FB-0603", "600 Ω à 100 MHz", "Isole l'alimentation analogique", { near: "U" });
    b.part("CA1", "C-0603", "1 µF", "Découplage analogique", { near: "U" }).part("CA2", "C-0603", "10 nF", "Découplage analogique", { near: "U" });
    b.part("RR", "R-0603", "10 kΩ", "Rappel de la remise à zéro", { near: "U" }).part("CR", "C-0603", "100 nF", "Filtre la remise à zéro", { near: "U" }).part("RB", "R-0603", "10 kΩ", "Démarrage sur la mémoire programme", { near: "U" });
    b.net("VDD", ["U.VDD", ...vdd.map((_, i) => `CD${i + 1}.1`), "CB.1", "FB.1", "RR.1"], pw(p.vdd, 0.15)).net("VDDA", ["U.VDDA", "FB.2", "CA1.1", "CA2.1"], pw(p.vdd, 0.02));
    b.net("NRST", ["U.NRST", "RR.2", "CR.1"]).net("BOOT0", ["U.BOOT0", "RB.1"]);
    if (p.xtal) {
      b.part("Y", "Y-3225", `${fr(p.xtal)} MHz`, "Base de temps", { near: "U" }).part("CX1", "C-0603", "15 pF", "Charge du quartz", { near: "Y" }).part("CX2", "C-0603", "15 pF", "Charge du quartz", { near: "Y" });
      b.net("OSC_IN", ["U.OSC_IN", "Y.X1", "CX1.1"]).net("OSC_OUT", ["U.OSC_OUT", "Y.X2", "CX2.1"]); gnd.push("Y.GND", "CX1.2", "CX2.2");
      b.calc("Condensateurs de charge du quartz", 15, "pF", "C = 2 × (CL − Cparasite) = 2 × (10 − 3) pF = 14 pF → 15 pF.");
    }
    b.net("GND", gnd, GND);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("NRST", "NRST", "bidir", "RESET_N");
    for (const [name, [pin, net, dir]] of Object.entries(MCU_PORTS)) b.port(name, null, dir, net, { lazy: true, pin: `U.${pin}` });
    b.calc("Découplage", vdd.length, "", `Un condensateur de 100 nF par broche d'alimentation (${vdd.length}) et 4,7 µF de réserve.`);
    b.calc("Remise à zéro", 1, "ms", "τ = R C = 10 kΩ × 100 nF = 1 ms : filtre les parasites sans retarder le démarrage.");
    b.note("Chaque condensateur de 100 nF contre sa broche d'alimentation, retour direct au plan de masse.").note("Quartz et ses condensateurs contre les broches d'oscillateur ; aucun signal dessous.").note("Connecteur de programmation accessible carte montée.");
    return b.out();
  } };

const can = { id: "can", name: "Interface CAN", category: "Communiquer", function: "Communiquer sur le bus CAN", desc: "Émetteur-récepteur, terminaison scindée, protection des lignes.",
  params: { term: P("Terminaison 120 Ω", "", 1, 0, 1, { options: [1, 0], labels: ["oui", "non"] }), choke: P("Inductance de mode commun", "", 0, 0, 1, { options: [0, 1], labels: ["non", "oui"] }), vio: P("Tension logique", "V", 3.3, 1.8, 5) },
  build(p) {
    const b = builder(), t = +p.term === 1, c = +p.choke === 1, bus = { voltage: 24 };
    b.part("U", "U-CAN-SOIC8", "", "Traduit les niveaux logiques en niveaux du bus").part("CV", "C-0603", "100 nF", "Découplage 5 V", { near: "U" }).part("CIO", "C-0603", "100 nF", "Découplage logique", { near: "U" });
    b.part("D", "D-TVS-CAN-SOT23", "24 V", "Protège les deux lignes");
    b.net("VCC", ["U.VCC", "CV.1"], pw(5, 0.08)).net("VIO", ["U.VIO", "CIO.1"], pw(p.vio, 0.01)).net("GND", ["U.GND", "U.STB", "CV.2", "CIO.2", "D.GND"], GND).net("TXD", ["U.TXD"]).net("RXD", ["U.RXD"]);
    if (c) { b.part("LC", "L-CMC-4532", "51 µH", "Filtre le mode commun", { near: "U" }); b.net("CANH_IC", ["U.CANH", "LC.1"], bus).net("CANL_IC", ["U.CANL", "LC.2"], bus).net("CANH", ["LC.4", "D.IO1"], bus).net("CANL", ["LC.3", "D.IO2"], bus); }
    else b.net("CANH", ["U.CANH", "D.IO1"], bus).net("CANL", ["U.CANL", "D.IO2"], bus);
    if (t) {
      b.part("RT1", "R-1206", "60,4 Ω 1 %", "Demi-terminaison").part("RT2", "R-1206", "60,4 Ω 1 %", "Demi-terminaison", { near: "RT1" }).part("CT", "C-0603", "4,7 nF", "Point milieu de la terminaison", { near: "RT1" });
      b.net("CANH", ["RT1.1"]).net("CANL", ["RT2.1"]).net("TERM", ["RT1.2", "RT2.2", "CT.1"]).net("GND", ["CT.2"]);
      b.calc("Terminaison", 120.8, "Ω", "2 × 60,4 Ω = 120,8 Ω entre les lignes ; le point milieu à la masse par 4,7 nF filtre le mode commun au-delà de 1 / (2π × 30 Ω × 4,7 nF) ≈ 1,1 MHz.");
    }
    b.port("VCC", "VCC", "power_in", "+5V").port("VIO", "VIO", "power_in", railName(p.vio)).port("GND", "GND", "gnd", "GND");
    b.port("TXD", "TXD", "in", "CAN_TX").port("RXD", "RXD", "out", "CAN_RX").port("CANH", "CANH", "bidir", "CAN_H").port("CANL", "CANL", "bidir", "CAN_L");
    b.note("CAN_H et CAN_L routées ensemble, même longueur, jusqu'au connecteur.").note("Protection des lignes contre le connecteur, avant l'émetteur-récepteur.");
    return b.out();
  } };

const rs485 = { id: "rs485", name: "Interface RS-485", category: "Communiquer", function: "Communiquer en RS-485 demi-duplex", desc: "Émetteur-récepteur, découplage, terminaison.",
  params: { term: P("Terminaison 120 Ω", "", 1, 0, 1, { options: [1, 0], labels: ["oui", "non"] }), vdd: P("Alimentation", "V", 3.3, 3, 5) },
  build(p) {
    const b = builder();
    b.part("U", "U-RS485-SOIC8", "", "Traduit l'UART en paire différentielle").part("C", "C-0603", "100 nF", "Découplage", { near: "U" });
    b.net("VCC", ["U.VCC", "C.1"], pw(p.vdd, 0.06)).net("GND", ["U.GND", "C.2"], GND).net("DI", ["U.DI"]).net("RO", ["U.RO"]).net("DE", ["U.DE", "U.RE_N"]).net("A", ["U.A"], { voltage: 12 }).net("B", ["U.B"], { voltage: 12 });
    if (+p.term === 1) { b.part("RT", "R-1206", "120 Ω", "Terminaison de ligne", { near: "U" }); b.net("A", ["RT.1"]).net("B", ["RT.2"]); }
    b.port("VCC", "VCC", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("DI", "DI", "in", "UART_TX").port("RO", "RO", "out", "UART_RX").port("DE", "DE", "in", "RS485_DE").port("A", "A", "bidir", "RS485_A").port("B", "B", "bidir", "RS485_B");
    b.note("Terminaison seulement aux deux extrémités de la ligne.");
    return b.out();
  } };

const conn_swd = { id: "conn_swd", name: "Connecteur de programmation", category: "Tester", function: "Programmer et déboguer le microcontrôleur", desc: "Connecteur 2 × 5 au pas de 1,27 mm : référence de tension, SWDIO, SWCLK, remise à zéro.",
  params: { vdd: P("Tension de référence", "V", 3.3, 1.8, 5) },
  build(p) {
    const b = builder();
    b.part("J", "J-SWD-2x05", "", "Liaison avec la sonde de programmation", { nc: ["6", "7", "8"] });
    b.net("VREF", ["J.1"], pw(p.vdd, 0.01)).net("SWDIO", ["J.2"]).net("SWCLK", ["J.4"]).net("NRST", ["J.10"]).net("GND", ["J.3", "J.5", "J.9"], GND);
    b.port("VREF", "VREF", "power_in", railName(p.vdd)).port("SWDIO", "SWDIO", "bidir", "SWDIO").port("SWCLK", "SWCLK", "out", "SWCLK").port("NRST", "NRST", "bidir", "RESET_N").port("GND", "GND", "gnd", "GND");
    b.note("Connecteur accessible carte montée dans son boîtier ; broche 1 repérée en sérigraphie.");
    return b.out();
  } };

const HDR = [2, 3, 4, 5, 6, 8];
function connector(id, name, fn, desc, def, comp) {
  return { id, name, category: "Raccorder", function: fn, desc, params: { signals: P("Signaux, dans l'ordre des broches", "", def, null, null, { text: true }) },
    build(p) {
      const b = builder(), sig = String(p.signals || "").split(",").map((s) => s.trim().toUpperCase()), part = comp(sig.length), count = part.count, nc = [];
      b.part("J", part.id, "", "Liaison vers l'extérieur de la carte", { edge: true });
      for (let i = 1; i <= count; i++) {
        const s = sig[i - 1];
        if (!s || s === "NC") { nc.push(String(i)); continue; }
        b.net(`P${i}`, [`J.${i}`], { class: netClass(s), voltage: /^\+(\d+)V/.test(s) ? +/^\+(\d+)V/.exec(s)[1] : 0 }).port(`P${i}`, `P${i}`, "bidir", s);
      }
      const out = b.out(); out.parts[0].nc = nc;
      out.notes.push("Connecteur au bord de la carte, sens d'enfichage dégagé ; broche 1 repérée en sérigraphie.");
      return out;
    } };
}
const conn_io = connector("conn_io", "Connecteur d'entrées-sorties", "Raccorder la carte : {signals}", "Barrette au pas de 2,54 mm, une broche par signal.", "CAN_H,CAN_L,+24V_IN,GND",
  (n) => { const k = HDR.find((x) => x >= n) || 8; return { id: `J-HDR-1x${String(k).padStart(2, "0")}`, count: k }; });
const conn_board = connector("conn_board", "Liaison carte à carte", "Relier la carte voisine : {signals}", "Connecteur 2 × 10 au pas de 2,54 mm.", "+12V,+12V,GND,GND,PWM_H,PWM_L,AIN0,AIN1", () => ({ id: "J-HDR-2x10", count: 20 }));

const led = { id: "led", name: "Témoin lumineux", category: "Signaler", function: "Signaler l'état par une DEL {color}", desc: "DEL et sa résistance.",
  params: { v: P("Tension de commande", "V", 3.3, 1.8, 48), i: P("Courant", "mA", 2, 0.5, 20), color: P("Couleur", "", "verte", null, null, { text: true }) },
  build(p) {
    const b = builder(), vf = /bleu|blanc/.test(String(p.color)) ? 3 : 2, r = eSeries(Math.max(10, (p.v - vf) / (p.i / 1000)), "E24"), i = (p.v - vf) / r;
    b.part("D", "LED-0603", String(p.color || "verte"), "Témoin").part("R", "R-0603", ohm(r), "Fixe le courant", { near: "D" });
    b.net("IN", ["R.1"], { voltage: p.v }).net("A", ["R.2", "D.A"]).net("GND", ["D.K"], GND);
    b.port("IN", "IN", "in", "LED_STATUS").port("GND", "GND", "gnd", "GND");
    b.calc("Résistance de la DEL", r, "Ω", `R = (V − Vf) / I = (${fr(p.v)} − ${fr(vf)}) / ${fr(p.i)} mA = ${ohm((p.v - vf) / (p.i / 1000))} → ${ohm(r)} : ${fr(i * 1000)} mA, ${fr(i * i * r * 1000)} mW.`);
    return b.out();
  } };

const test = { id: "test", name: "Points de test et mires", category: "Tester", function: "Rendre la carte testable et plaçable en machine", desc: "Un point de test par net à sonder, et les mires optiques de la machine de placement.",
  params: { nets: P("Nets à sonder", "", "+5V,+3V3,GND", null, null, { text: true }), fiducials: P("Mires", "", 3, 0, 4) },
  build(p) {
    const b = builder(), nets = String(p.nets || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    nets.forEach((n, i) => { b.part(`TP${i + 1}`, "TP-1.0", n, `Accès de mesure à ${n}`); b.net(`T${i + 1}`, [`TP${i + 1}.TP`], { class: netClass(n) }).port(`T${i + 1}`, `T${i + 1}`, "bidir", n); });
    for (let i = 1; i <= Math.round(p.fiducials); i++) b.part(`FID${i}`, "FID-1.0", "", "Repère optique de placement", { corner: i });
    b.calc("Mires", Math.round(p.fiducials), "", "Trois mires non alignées par face à composants montés en surface : la machine corrige position, rotation et échelle.");
    b.note("Mires aux coins, à 3 mm au moins des bords, sans cuivre ni sérigraphie dans un rayon de 1 mm.").note("Points de test sur une seule face, espacés de 2,54 mm si un lit à pointes est envisagé.");
    return b.out();
  } };

export const CONTROL_BLOCKS = [conn_io, conn_board, conn_swd, mcu, can, rs485, led, test];
