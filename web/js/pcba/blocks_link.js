/* DesignWizard.ai — PCBA: function blocks that link and keep — USB, serial links, isolation, level translation,
   memories, real-time clock — and the supplies around them : step-up converter, isolated supply, voltage reference,
   supply supervisor. */

import { builder, P, eSeries, fr, ohm, henry } from "./blocks_util.js";
import { railName, netClass } from "./netnames.js";

const pw = (v, i) => ({ class: Math.abs(v) >= 60 ? "hv" : "power", voltage: v, current: i }), GND = { class: "ground" };
const dec = (b, ref = "U", id = "C") => b.part(id, "C-0603", "100 nF", "Découplage", { near: ref });

const usb_c = { id: "usb_c", name: "Embase USB-C", category: "Raccorder", function: "Raccorder un hôte USB (appareil, {i} A)", desc: "Embase USB-C en appareil : résistances d'identification, protection ESD, fusible réarmable, blindage.",
  params: { i: P("Courant demandé à l'hôte", "A", 0.5, 0.1, 3) },
  build(p) {
    const b = builder(), bus = pw(5, p.i);
    b.part("J", "J-USB-C", "", "Embase USB-C", { edge: true }).part("RC1", "R-0603", "5,1 kΩ 1 %", "Annonce un appareil sur CC1", { near: "J" }).part("RC2", "R-0603", "5,1 kΩ 1 %", "Annonce un appareil sur CC2", { near: "J" });
    b.part("U", "U-ESD-USB-SOT23-6", "", "Protège les lignes de données et VBUS", { near: "J" }).part("F", "F-PTC-1210", `${fr(Math.max(0.5, eSeries(p.i * 1.5, "E6")))} A`, "Protège l'hôte d'un court-circuit", { near: "J" }).part("CB", "C-0805", "4,7 µF", "Réserve (10 µF au plus vus de l'hôte)", { near: "F" });
    b.part("RS", "R-0603", "1 MΩ", "Décharge du blindage", { near: "J" }).part("CS", "C-0603", "4,7 nF", "Blindage relié à la masse en haute fréquence", { near: "J" });
    b.net("VCON", ["J.VBUS", "F.1", "U.VBUS"], bus).net("VBUS", ["F.2", "CB.1"], bus).net("CC1", ["J.CC1", "RC1.1"]).net("CC2", ["J.CC2", "RC2.1"]).net("DP", ["J.DP", "U.IO1"]).net("DN", ["J.DN", "U.IO2"]);
    b.net("GND", ["J.GND", "RC1.2", "RC2.2", "U.GND", "CB.2", "RS.2", "CS.2"], { ...GND, current: p.i }).net("SHIELD", ["J.SHELL", "RS.1", "CS.1"]);
    b.port("VBUS", "VBUS", "power_out", "+5V_USB").port("DP", "DP", "bidir", "USB_DP").port("DN", "DN", "bidir", "USB_DN").port("GND", "GND", "gnd", "GND");
    b.calc("Résistances d'identification", 5.1, "kΩ", "Rd = 5,1 kΩ sur chaque ligne CC : l'hôte reconnaît un appareil et applique 5 V, quel que soit le sens de la fiche.");
    b.calc("Courant disponible", p.i, "A", p.i > 0.5 ? `Au-delà de 0,5 A, l'appareil doit lire la tension des lignes CC pour savoir ce que l'hôte offre (1,5 A ou 3 A) : demandé ${fr(p.i)} A.` : "0,5 A : ce que tout hôte USB 2.0 fournit sans négociation.");
    b.note("Paire D+ / D− courte, pistes côte à côte et de même longueur, sans via ni angle droit ; protection ESD entre l'embase et le reste.").note("Embase au bord de la carte ; pattes du blindage soudées dans des trous métallisés.");
    return b.out();
  } };

const usb_uart = { id: "usb_uart", name: "Pont USB vers liaison série", category: "Communiquer", function: "Dialoguer avec un ordinateur par USB (port série)", desc: "Pont USB–UART sans quartz, découplage.",
  params: { vio: P("Niveau logique", "V", 3.3, 3.3, 5, { options: [3.3, 5] }) },
  build(p) {
    const b = builder(), lv = +p.vio < 4;
    b.part("U", "U-USBUART-SOIC16", "", "Traduit l'USB en liaison série", { nc: ["CTS", "DTR", "RTS"] }); dec(b); b.part("CV", "C-0603", "100 nF", "Régulateur interne 3,3 V", { near: "U" });
    b.net("VCC", ["U.VCC", "C.1", ...(lv ? ["U.V3", "CV.1"] : [])], pw(p.vio, 0.03)).net("GND", ["U.GND", "C.2", "CV.2"], GND).net("DP", ["U.DP"]).net("DN", ["U.DN"]).net("TXD", ["U.TXD"]).net("RXD", ["U.RXD"]);
    if (!lv) b.net("V3", ["U.V3", "CV.1"]);
    b.port("VCC", "VCC", "power_in", lv ? railName(p.vio) : "+5V_USB").port("GND", "GND", "gnd", "GND").port("DP", "DP", "bidir", "USB_DP").port("DN", "DN", "bidir", "USB_DN").port("TXD", "TXD", "out", "UART_RX").port("RXD", "RXD", "in", "UART_TX");
    b.calc("Croisement", 1, "", "La sortie TXD du pont va sur l'entrée RX du microcontrôleur, et inversement.");
    return b.out();
  } };

const boost = { id: "boost", name: "Régulateur élévateur", category: "Alimenter", function: "Élever {vin} V vers {vout} V, {iout} A", desc: "Convertisseur élévateur à interrupteur intégré : inductance, diode, pont de mesure.",
  params: { vin: P("Tension d'entrée", "V", 5, 2.7, 20), vout: P("Tension de sortie", "V", 12, 3.3, 28), iout: P("Courant de sortie", "A", 0.3, 0.01, 1) },
  build(p) {
    const b = builder(), vout = Math.max(p.vout, p.vin + 0.5), f = 1.2e6, d = 1 - p.vin * 0.9 / vout, il = p.iout / (1 - d), l = eSeries(p.vin * d / (f * 0.3 * Math.max(il, 0.1)), "E6", "up"), ipk = il + p.vin * d / (2 * f * l), r2 = 10e3, r1 = eSeries(r2 * (vout / 0.6 - 1), "E96");
    b.part("U", "U-BOOST-SOT23-6", "", "Hache le courant de l'inductance", { nc: ["NC"] }).part("L", ipk > 1.8 ? "L-6060" : "L-4040", henry(l), "Stocke l'énergie", { near: "U" }).part("D", "D-SCH-SMA", "", "Redresse vers la sortie", { near: "U" });
    b.part("CIN", "C-1206", "10 µF", "Réserve d'entrée", { near: "U" }).part("CO", "C-1210", "22 µF", "Lisse la sortie", { near: "D" }).part("R1", "R-0603", `${ohm(r1)} 1 %`, "Pont de mesure", { near: "U" }).part("R2", "R-0603", `${ohm(r2)} 1 %`, "Pont de mesure", { near: "U" });
    b.net("VIN", ["U.VIN", "U.EN", "CIN.1", "L.1"], pw(p.vin, il)).net("SW", ["U.SW", "L.2", "D.A"], pw(vout, il)).net("VOUT", ["D.K", "CO.1", "R1.1"], pw(vout, p.iout)).net("FB", ["U.FB", "R1.2", "R2.1"]).net("GND", ["U.GND", "CIN.2", "CO.2", "R2.2"], { ...GND, current: il });
    b.port("VIN", "VIN", "power_in", railName(p.vin)).port("VOUT", "VOUT", "power_out", railName(vout)).port("GND", "GND", "gnd", "GND");
    b.calc("Rapport cyclique", d, "", `D = 1 − η Vin / Vout = 1 − 0,9 × ${fr(p.vin)} / ${fr(vout)} = ${fr(d)}.`).calc("Courant dans l'inductance", il, "A", `IL = Iout / (1 − D) = ${fr(p.iout)} / ${fr(1 - d)} = ${fr(il)} A ; crête ${fr(ipk)} A${ipk > 2 ? " : au-delà des 2 A de l'interrupteur — réduisez le courant ou prenez un régulateur plus gros." : " (interrupteur : 2 A)."}`);
    b.calc("Inductance", l * 1e6, "µH", `L = Vin D / (f × 0,3 IL) = ${fr(p.vin)} × ${fr(d)} / (1,2 MHz × 0,3 × ${fr(Math.max(il, 0.1))} A) → ${henry(l)}.`).calc("Pont de mesure", r1 / 1000, "kΩ", `R1 = R2 (Vout / 0,6 − 1) = 10 kΩ × (${fr(vout)} / 0,6 − 1) → ${ohm(r1)}.`);
    b.note("Boucle interrupteur – diode – condensateur de sortie la plus courte possible : c'est elle qui rayonne.").note("Nœud de commutation petit ; pont de mesure loin de l'inductance.");
    return b.out();
  } };

const dcdc_iso = { id: "dcdc_iso", name: "Alimentation isolée 1 W", category: "Alimenter", function: "Fournir {vout} V isolés à partir de {vin} V (1 W)", desc: "Module convertisseur isolé, condensateurs d'entrée et de sortie, charge minimale.",
  params: { vin: P("Tension d'entrée", "V", 5, 3.3, 15, { options: [3.3, 5, 12] }), vout: P("Tension isolée", "V", 5, 3.3, 15, { options: [3.3, 5, 12, 15] }) },
  build(p) {
    const b = builder(), io = 1 / p.vout, rl = eSeries(p.vout / (0.1 * io), "E24");
    b.part("U", "U-DCDC-ISO-SIP4", `${fr(p.vin)} V → ${fr(p.vout)} V`, "Franchit la barrière d'isolement").part("CI", "C-0805", "4,7 µF", "Réserve d'entrée", { near: "U" }).part("CO", "C-0805", "4,7 µF", "Lisse la sortie", { near: "U" }).part("RL", "R-0805", ohm(rl), "Charge minimale (10 %) : la sortie non régulée ne s'envole pas à vide", { near: "CO" });
    b.net("VIN", ["U.VIN", "CI.1"], pw(p.vin, 1.3 / p.vin)).net("GND", ["U.GND1", "CI.2"], GND).net("VISO", ["U.VOUT", "CO.1", "RL.1"], pw(p.vout, io)).net("GNDISO", ["U.GND2", "CO.2", "RL.2"], GND);
    b.port("VIN", "VIN", "power_in", railName(p.vin)).port("GND", "GND", "gnd", "GND").port("VISO", "VISO", "power_out", `${railName(p.vout)}_ISO`).port("GNDISO", "GNDISO", "gnd", "GND_ISO");
    b.calc("Courant disponible", io * 1000, "mA", `I = 1 W / ${fr(p.vout)} V = ${fr(io * 1000)} mA ; sortie non régulée : ±10 % selon la charge.`);
    b.note("Fente ou distance d'isolement sous le module, entre les deux masses : aucun cuivre ne la franchit.").note("Tout ce qui est alimenté par la sortie isolée reste de son côté de la barrière.");
    return b.out();
  } };

const iso_digital = { id: "iso_digital", name: "Isolation de signaux numériques", category: "Communiquer", function: "Isoler une liaison numérique (3 voies aller, 1 retour)", desc: "Isolateur numérique 4 voies au boîtier large, un découplage par côté.",
  params: { v1: P("Alimentation côté logique", "V", 3.3, 2.5, 5), v2: P("Alimentation côté isolé", "V", 5, 2.5, 5) },
  build(p) {
    const b = builder(), fwd = [["A", "SPI_SCK"], ["B", "SPI_MOSI"], ["C", "SPI_CS"]];
    b.part("U", "U-ISO-SOIC16W", "", "Franchit la barrière d'isolement"); dec(b, "U", "C1"); dec(b, "U", "C2");
    b.net("VDD1", ["U.VDD1", "U.EN1", "C1.1"], pw(p.v1, 0.01)).net("GND1", ["U.GND1", "C1.2"], GND).net("VDD2", ["U.VDD2", "U.EN2", "C2.1"], pw(p.v2, 0.01)).net("GND2", ["U.GND2", "C2.2"], GND);
    for (const [k, s] of fwd) b.net(`IN${k}`, [`U.IN${k}`]).net(`OUT${k}`, [`U.OUT${k}`]).port(`IN${k}`, `IN${k}`, "in", s).port(`OUT${k}`, `OUT${k}`, "out", `ISO_${s}`);
    b.net("IND", ["U.IND"]).net("OUTD", ["U.OUTD"]).port("IND", "IND", "in", "ISO_SPI_MISO").port("OUTD", "OUTD", "out", "SPI_MISO");
    b.port("VDD1", "VDD1", "power_in", railName(p.v1)).port("GND1", "GND1", "gnd", "GND").port("VDD2", "VDD2", "power_in", `${railName(p.v2)}_ISO`).port("GND2", "GND2", "gnd", "GND_ISO");
    b.calc("Ligne de fuite", 8, "mm", "Boîtier large : 8 mm entre les deux rangées de broches. La carte ne doit pas faire moins — voir l'analyse d'isolation de l'assemblage.");
    b.note("Fente ou zone sans cuivre sous le boîtier, sur toutes les couches.");
    return b.out();
  } };

const level_shift = { id: "level_shift", name: "Translation de niveaux I²C", category: "Communiquer", function: "Relier un bus I²C {vlo} V à des circuits {vhi} V", desc: "Deux MOSFET N et quatre rappels : translation bidirectionnelle.",
  params: { vlo: P("Côté bas", "V", 3.3, 1.8, 3.6), vhi: P("Côté haut", "V", 5, 3.3, 12) },
  build(p) {
    const b = builder();
    b.part("Q", "Q-NMOS2-SOT363", "", "Un transistor par ligne");
    for (const [k, s] of [["1", "SCL"], ["2", "SDA"]]) { b.part(`RL${k}`, "R-0603", "4,7 kΩ", `Rappel ${s}, côté bas`, { near: "Q" }).part(`RH${k}`, "R-0603", "4,7 kΩ", `Rappel ${s}, côté haut`, { near: "Q" });
      b.net(`${s}_LO`, [`Q.S${k}`, `RL${k}.2`]).net(`${s}_HI`, [`Q.D${k}`, `RH${k}.2`]).port(`${s}_LO`, `${s}_LO`, "bidir", `I2C_${s}`).port(`${s}_HI`, `${s}_HI`, "bidir", `I2CH_${s}`); }
    b.net("VLO", ["Q.G1", "Q.G2", "RL1.1", "RL2.1"], pw(p.vlo, 0.002)).net("VHI", ["RH1.1", "RH2.1"], pw(p.vhi, 0.003));
    b.port("VLO", "VLO", "power_in", railName(p.vlo)).port("VHI", "VHI", "power_in", railName(p.vhi));
    b.calc("Principe", 1, "", "Grilles au niveau bas : une ligne tirée à 0 d'un côté fait conduire le transistor, qui tire l'autre côté ; au repos, chaque côté remonte à sa propre tension.");
    return b.out();
  } };

const rs232 = { id: "rs232", name: "Interface RS-232", category: "Communiquer", function: "Communiquer en RS-232", desc: "Émetteur-récepteur à pompe de charge, quatre condensateurs, barrette de sortie.",
  params: { vdd: P("Alimentation", "V", 3.3, 3, 5.5) },
  build(p) {
    const b = builder();
    b.part("U", "U-RS232-SOIC16", "", "Traduit les niveaux logiques en ±6 V", { nc: ["R2IN", "R2OUT", "T2OUT"] }); dec(b);
    for (const k of ["C1", "C2", "CP", "CN"]) b.part(k, "C-0603", "100 nF", "Pompe de charge", { near: "U" });
    b.part("J", "J-HDR-1x03", "", "TX, RX, masse", { edge: true });
    b.net("VDD", ["U.VCC", "C.1"], pw(p.vdd, 0.01)).net("GND", ["U.GND", "C.2", "CP.2", "CN.1", "U.T2IN", "J.3"], GND).net("C1P", ["U.C1+", "C1.1"]).net("C1N", ["U.C1-", "C1.2"]).net("C2P", ["U.C2+", "C2.1"]).net("C2N", ["U.C2-", "C2.2"]).net("VSP", ["U.VS+", "CP.1"]).net("VSN", ["U.VS-", "CN.2"]);
    b.net("TX", ["U.T1OUT", "J.1"], { voltage: 12 }).net("RX", ["U.R1IN", "J.2"], { voltage: 12 }).net("TIN", ["U.T1IN"]).net("ROUT", ["U.R1OUT"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("TIN", "TIN", "in", "UART2_TX").port("ROUT", "ROUT", "out", "UART2_RX").port("TX", "TX", "out", "RS232_TX").port("RX", "RX", "in", "RS232_RX");
    b.note("Les quatre condensateurs de la pompe de charge contre leurs broches.");
    return b.out();
  } };

const lin = { id: "lin", name: "Interface LIN", category: "Communiquer", function: "Communiquer sur le bus LIN ({role})", desc: "Émetteur-récepteur LIN, rappel de maître, filtre de ligne.",
  params: { vbat: P("Tension du véhicule", "V", 12, 8, 28), role: P("Rôle", "", "maître", null, null, { text: true }) },
  build(p) {
    const b = builder(), master = /ma[iî]tre|master/i.test(String(p.role));
    b.part("U", "U-LIN-SOIC8", "", "Traduit les niveaux logiques en niveaux du bus", { nc: ["INH", "WAKE"] }).part("CV", "C-0805", "100 nF", "Découplage", { near: "U" }).part("CL", "C-0603", master ? "1 nF" : "220 pF", "Filtre de la ligne", { near: "U" });
    if (master) b.part("DM", "D-SCH-SOD123", "", "Empêche la ligne d'alimenter la carte", { near: "U" }).part("RM", "R-1206", "1 kΩ", "Rappel du maître", { near: "U" });
    b.net("VS", ["U.VS", "CV.1", ...(master ? ["DM.A"] : [])], pw(p.vbat, 0.05)).net("GND", ["U.GND", "CV.2", "CL.2"], GND).net("LIN", ["U.LIN", "CL.1", ...(master ? ["RM.2"] : [])], { voltage: p.vbat }).net("TXD", ["U.TXD"]).net("RXD", ["U.RXD"]).net("EN", ["U.EN"]);
    if (master) b.net("PULL", ["DM.K", "RM.1"]);
    b.port("VS", "VS", "power_in", railName(p.vbat)).port("GND", "GND", "gnd", "GND").port("LIN", "LIN", "bidir", "LIN_BUS").port("TXD", "TXD", "in", "UART2_TX").port("RXD", "RXD", "out", "UART2_RX").port("EN", "EN", "in", "DOUT", { pool: true });
    if (master) b.calc("Rappel du maître", 1, "kΩ", `1 kΩ en série avec une diode vers ${fr(p.vbat)} V : ${fr(p.vbat * p.vbat / 1000 * 1000)} mW au pire dans la résistance (boîtier 1206 : 250 mW).`);
    return b.out();
  } };

const eeprom = { id: "eeprom", name: "Mémoire de paramètres", category: "Calculer", function: "Garder les paramètres et l'étalonnage (EEPROM I²C)", desc: "Mémoire EEPROM, découplage, adresse et protection en écriture fixées.",
  params: { vdd: P("Alimentation", "V", 3.3, 1.8, 5.5) },
  build(p) {
    const b = builder(); b.part("U", "U-EEPROM-SOIC8", "64 kbit", "Mémoire non volatile"); dec(b);
    b.net("VDD", ["U.VCC", "C.1"], pw(p.vdd, 0.003)).net("GND", ["U.GND", "U.A0", "U.A1", "U.A2", "U.WP", "C.2"], GND).net("SCL", ["U.SCL"]).net("SDA", ["U.SDA"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("SCL", "SCL", "in", "I2C_SCL").port("SDA", "SDA", "bidir", "I2C_SDA");
    b.calc("Adresse", 0x50, "", "A2 A1 A0 à la masse : adresse 0x50. Le bus I²C a besoin de rappels (bloc de la centrale inertielle, ou deux résistances de 4,7 kΩ).");
    return b.out();
  } };

const flash_spi = { id: "flash_spi", name: "Mémoire flash", category: "Calculer", function: "Enregistrer les données (flash SPI 16 Mbit)", desc: "Mémoire flash NOR, découplage, rappel de la sélection.",
  params: { vdd: P("Alimentation", "V", 3.3, 2.7, 3.6) },
  build(p) {
    const b = builder(); b.part("U", "U-FLASH-SOIC8", "16 Mbit", "Mémoire non volatile"); dec(b); b.part("RCS", "R-0603", "10 kΩ", "Mémoire désélectionnée pendant le démarrage", { near: "U" });
    b.net("VDD", ["U.VCC", "U.WP", "U.HOLD_N", "C.1", "RCS.1"], pw(p.vdd, 0.025)).net("GND", ["U.GND", "C.2"], GND).net("CS", ["U.CS", "RCS.2"]).net("SCK", ["U.SCK"]).net("MOSI", ["U.MOSI"]).net("MISO", ["U.MISO"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("CS", "CS", "in", "SPI_CS").port("SCK", "SCK", "in", "SPI_SCK").port("MOSI", "MOSI", "in", "SPI_MOSI").port("MISO", "MISO", "out", "SPI_MISO");
    b.note("Horloge SPI courte ; une résistance série de 33 Ω près du microcontrôleur si la piste dépasse 50 mm.");
    return b.out();
  } };

const rtc = { id: "rtc", name: "Horloge temps réel", category: "Calculer", function: "Garder la date et l'heure, carte éteinte", desc: "Horloge I²C, quartz 32,768 kHz, pile de sauvegarde.",
  params: { vdd: P("Alimentation", "V", 3.3, 1.8, 5.5) },
  build(p) {
    const b = builder(); b.part("U", "U-RTC-SOIC8", "", "Compte le temps", { nc: ["INT"] }).part("Y", "Y-32K-3215", "32,768 kHz", "Base de temps", { near: "U" }).part("BT", "BAT-CR2032", "CR2032", "Alimente l'horloge carte éteinte"); dec(b); dec(b, "U", "CB");
    b.net("VDD", ["U.VCC", "C.1"], pw(p.vdd, 0.001)).net("GND", ["U.GND", "C.2", "CB.2", "BT.-"], GND).net("VBAT", ["U.VBAT", "BT.+", "CB.1"], pw(3, 0.0001)).net("X1", ["U.X1", "Y.X1"]).net("X2", ["U.X2", "Y.X2"]).net("SCL", ["U.SCL"]).net("SDA", ["U.SDA"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("SCL", "SCL", "in", "I2C_SCL").port("SDA", "SDA", "bidir", "I2C_SDA");
    b.calc("Autonomie sur pile", 220 / 0.0005 / 8760, "ans", "220 mAh / 0,5 µA ≈ 50 ans sur le papier : la pile vieillit avant (comptez 8 à 10 ans).");
    b.note("Quartz contre ses broches, entouré de masse, aucun signal dessous.").note("Support de pile accessible, loin des sources de chaleur.");
    return b.out();
  } };

const supervisor = { id: "supervisor", name: "Surveillance de l'alimentation", category: "Protéger", function: "Tenir le microcontrôleur en remise à zéro sous {vth} V", desc: "Superviseur à sortie à drain ouvert sur la ligne de remise à zéro.",
  params: { vdd: P("Alimentation surveillée", "V", 3.3, 1.8, 5), vth: P("Seuil", "V", 2.93, 1.6, 4.7) },
  build(p) {
    const b = builder(); b.part("U", "U-SUP-SOT23", `seuil ${fr(p.vth)} V`, "Surveille la tension"); dec(b);
    b.net("VDD", ["U.VCC", "C.1"], pw(p.vdd, 0.001)).net("GND", ["U.GND", "C.2"], GND).net("RST", ["U.RESET_N"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("RST", "RST", "out", "RESET_N");
    b.calc("Marge", (p.vdd - p.vth) / p.vdd * 100, "%", `Seuil à ${fr(p.vth)} V pour ${fr(p.vdd)} V : ${fr((p.vdd - p.vth) / p.vdd * 100)} % sous la tension nominale, au-dessus du minimum du microcontrôleur.`);
    return b.out();
  } };

const vref = { id: "vref", name: "Référence de tension", category: "Alimenter", function: "Fournir une référence de {vout} V au convertisseur", desc: "Référence de précision, condensateurs d'entrée et de sortie.",
  params: { vin: P("Alimentation", "V", 5, 3, 12), vout: P("Référence", "V", 2.5, 1.2, 4.1, { options: [2.5, 3] }) },
  build(p) {
    const b = builder(); b.part("U", "U-REF-SOT23", `${fr(p.vout)} V 0,1 %`, "Référence de tension").part("CI", "C-0603", "100 nF", "Découplage d'entrée", { near: "U" }).part("CO", "C-0603", "1 µF", "Stabilité et bruit", { near: "U" });
    b.net("VIN", ["U.VIN", "CI.1"], pw(p.vin, 0.002)).net("VREF", ["U.VOUT", "CO.1"], pw(p.vout, 0.002)).net("GND", ["U.GND", "CI.2", "CO.2"], GND);
    b.port("VIN", "VIN", "power_in", railName(p.vin)).port("VREF", "VREF", "power_out", `${railName(p.vout)}_REF`).port("GND", "GND", "gnd", "GND");
    b.calc("Résolution", p.vout / 4096 * 1000, "mV", `Convertisseur 12 bits : ${fr(p.vout)} V / 4096 = ${fr(p.vout / 4096 * 1000)} mV par pas ; erreur de la référence : ${fr(p.vout)} mV (0,1 %).`);
    return b.out();
  } };

const WTB = [2, 3, 4, 5, 6, 8];
const conn_wire = { id: "conn_wire", name: "Connecteur fil à carte", category: "Raccorder", function: "Raccorder un faisceau : {signals}", desc: "Connecteur détrompé au pas de 2 mm, une broche par signal.",
  params: { signals: P("Signaux, dans l'ordre des broches", "", "+5V,GND,AIN3", null, null, { text: true }) },
  build(p) {
    const b = builder(), sig = String(p.signals || "").split(",").map((s) => s.trim().toUpperCase()), n = WTB.find((x) => x >= sig.length) || 8, nc = [];
    b.part("J", `J-WTB-${n}`, "", "Liaison vers le faisceau", { edge: true });
    for (let i = 1; i <= n; i++) { const s = sig[i - 1]; if (!s || s === "NC") { nc.push(String(i)); continue; } b.net(`P${i}`, [`J.${i}`], { class: netClass(s), voltage: /^\+(\d+)V/.test(s) ? +/^\+(\d+)V/.exec(s)[1] : 0 }).port(`P${i}`, `P${i}`, "bidir", s); }
    const out = b.out(); out.parts[0].nc = nc; out.notes.push("Connecteur détrompé au bord de la carte ; 2 A par contact au plus.");
    return out;
  } };

export const LINK_BLOCKS = [usb_c, conn_wire, usb_uart, rs232, lin, iso_digital, level_shift, boost, dcdc_iso, vref, supervisor, eeprom, flash_spi, rtc];
