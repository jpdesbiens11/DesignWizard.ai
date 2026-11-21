/* DesignWizard.ai — PCBA: function blocks at the edge of the board — protected and isolated inputs, analogue front
   ends, actuators (relay, DC motor, stepper), user interface. An input that goes to the microcontroller asks for the
   next free digital input (pool DIN) or analogue input (pool AIN) ; a command asks for the next free output (DOUT). */

import { builder, P, eSeries, fr, ohm, farad } from "./blocks_util.js";
import { railName } from "./netnames.js";

const pw = (v, i) => ({ class: Math.abs(v) >= 60 ? "hv" : "power", voltage: v, current: i }), GND = { class: "ground" };
const upper = (s, d) => String(s || d).toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const din = { id: "din", name: "Entrée tout-ou-rien protégée", category: "Mesurer", function: "Lire l'entrée {name} ({vin} V)", desc: "Pont diviseur, écrêtage par Zener et filtre : une entrée d'automate ramenée au niveau logique.",
  params: { vin: P("Tension de l'entrée", "V", 24, 5, 60), vdd: P("Niveau logique", "V", 3.3, 1.8, 5), name: P("Nom de l'entrée", "", "ENTREE", null, null, { text: true }) },
  build(p) {
    const b = builder(), r2 = 10e3, r1 = eSeries(r2 * (p.vin / (0.9 * p.vdd) - 1), "E24", "up"), rth = r1 * r2 / (r1 + r2), fc = 1 / (2 * Math.PI * rth * 100e-9), name = upper(p.name, "ENTREE");
    b.part("R1", "R-0805", `${ohm(r1)} 1 %`, "Haut du pont : tient la tension de l'entrée").part("R2", "R-0603", `${ohm(r2)} 1 %`, "Bas du pont", { near: "R1" }).part("DZ", "D-ZEN-SOD123", `${fr(p.vdd)} V`, "Écrête les surtensions", { near: "R2" }).part("C", "C-0603", "100 nF", "Filtre les rebonds et les parasites", { near: "R2" });
    b.net("IN", ["R1.1"], { voltage: p.vin }).net("OUT", ["R1.2", "R2.1", "DZ.K", "C.1"]).net("GND", ["R2.2", "DZ.A", "C.2"], GND);
    b.port("IN", "IN", "in", `${name}_IN`).port("OUT", "OUT", "out", "DIN", { pool: true }).port("GND", "GND", "gnd", "GND");
    b.calc("Niveau à l'état haut", p.vin * r2 / (r1 + r2), "V", `V = Vin × R2 / (R1 + R2) = ${fr(p.vin)} × ${ohm(r2)} / (${ohm(r1)} + ${ohm(r2)}) = ${fr(p.vin * r2 / (r1 + r2))} V pour un niveau logique de ${fr(p.vdd)} V.`);
    b.calc("Courant d'entrée", 1000 * p.vin / (r1 + r2), "mA", `I = Vin / (R1 + R2) = ${fr(1000 * p.vin / (r1 + r2))} mA.`).calc("Fréquence de coupure", fc, "Hz", `fc = 1 / (2π (R1 ∥ R2) C) = ${fr(fc)} Hz.`);
    b.note("Résistance du haut près du connecteur : la tension élevée ne voyage pas sur la carte.");
    return b.out();
  } };

const opto_in = { id: "opto_in", name: "Entrée isolée par optocoupleur", category: "Mesurer", function: "Lire l'entrée isolée {name} ({vin} V)", desc: "Optocoupleur, résistance de la DEL, diode anti-inversion, rappel et filtre côté logique.",
  params: { vin: P("Tension de l'entrée", "V", 24, 5, 60), vdd: P("Niveau logique", "V", 3.3, 1.8, 5), name: P("Nom de l'entrée", "", "ENTREE_ISO", null, null, { text: true }) },
  build(p) {
    const b = builder(), r = eSeries((p.vin - 1.2) / 0.005, "E24"), i = (p.vin - 1.2) / r, name = upper(p.name, "ENTREE_ISO");
    b.part("U", "U-OPTO-SOP4", "", "Franchit la barrière d'isolement").part("RIN", "R-1206", ohm(r), "Fixe le courant de la DEL", { near: "U" }).part("DR", "D-SIG-SOD323", "", "Protège la DEL d'une inversion", { near: "U" });
    b.part("RP", "R-0603", "10 kΩ", "Rappel de la sortie", { near: "U" }).part("CF", "C-0603", "100 nF", "Filtre", { near: "U" });
    b.net("INP", ["RIN.1"], { voltage: p.vin }).net("LED", ["RIN.2", "U.A", "DR.K"]).net("INN", ["U.K", "DR.A"]).net("OUT", ["U.C", "RP.2", "CF.1"]).net("VDD", ["RP.1"], pw(p.vdd, 0.001)).net("GND", ["U.E", "CF.2"], GND);
    b.port("INP", "INP", "in", `${name}_P`).port("INN", "INN", "in", `${name}_N`).port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "DIN", { pool: true });
    b.calc("Courant de la DEL", i * 1000, "mA", `I = (Vin − 1,2 V) / R = (${fr(p.vin)} − 1,2) / ${ohm(r)} = ${fr(i * 1000)} mA ; puissance dans la résistance : ${fr(i * i * r * 1000)} mW (boîtier 1206 : 250 mW).`);
    b.note("Rien ne franchit la fente sous l'optocoupleur : ni cuivre, ni sérigraphie.").note("La sortie est inversée : niveau bas quand l'entrée est alimentée.");
    return b.out();
  } };

const amp = { id: "amp", name: "Amplificateur et filtre", category: "Mesurer", function: "Amplifier le signal {name} (gain {gain}) et le filtrer à {fc} Hz", desc: "Amplificateur non inverseur, filtre passe-bas d'entrée.",
  params: { gain: P("Gain", "", 2, 1, 200), fc: P("Fréquence de coupure", "Hz", 1000, 1, 100000), vdd: P("Alimentation", "V", 3.3, 2.7, 5), name: P("Nom du signal", "", "SIGNAL", null, null, { text: true }) },
  build(p) {
    const b = builder(), r1 = 10e3, r2 = p.gain > 1.001 ? eSeries(r1 * (p.gain - 1), "E96") : 0, g = 1 + r2 / r1, c = eSeries(1 / (2 * Math.PI * 10e3 * p.fc), "E6"), name = upper(p.name, "SIGNAL");
    b.part("U", "U-OPAMP-SOT23-5", "", "Amplifie sans charger la source").part("RIN", "R-0603", "10 kΩ", "Filtre d'entrée", { near: "U" }).part("CIN", "C-0603", farad(c), "Filtre d'entrée", { near: "U" }).part("C", "C-0603", "100 nF", "Découplage", { near: "U" });
    if (r2) b.part("R1", "R-0603", `${ohm(r1)} 1 %`, "Fixe le gain", { near: "U" }).part("R2", "R-0603", `${ohm(r2)} 1 %`, "Fixe le gain", { near: "U" });
    b.net("IN", ["RIN.1"]).net("INP", ["RIN.2", "CIN.1", "U.IN+"]).net("VDD", ["U.V+", "C.1"], pw(p.vdd, 0.005)).net("GND", ["U.V-", "C.2", "CIN.2", ...(r2 ? ["R1.2"] : [])], GND);
    if (r2) b.net("FB", ["U.IN-", "R1.1", "R2.1"]).net("OUT", ["U.OUT", "R2.2"]); else b.net("OUT", ["U.OUT", "U.IN-"]);
    b.port("IN", "IN", "in", `${name}_IN`).port("OUT", "OUT", "out", "AIN", { pool: true }).port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND");
    b.calc("Gain", g, "", r2 ? `G = 1 + R2 / R1 = 1 + ${ohm(r2)} / ${ohm(r1)} = ${fr(g)}.` : "Suiveur : gain 1, la source n'est pas chargée.").calc("Fréquence de coupure", 1 / (2 * Math.PI * 10e3 * c), "Hz", `fc = 1 / (2π R C) = 1 / (2π × 10 kΩ × ${farad(c)}) = ${fr(1 / (2 * Math.PI * 10e3 * c))} Hz.`);
    b.note("Entrée de l'amplificateur courte et loin des pistes de commutation.");
    return b.out();
  } };

const comparator = { id: "comparator", name: "Détection de seuil", category: "Mesurer", function: "Détecter le dépassement de {vth} V sur {name}", desc: "Comparateur à sortie à drain ouvert, seuil par pont diviseur, hystérésis.",
  params: { vth: P("Seuil", "V", 1.65, 0.05, 4.5), hyst: P("Hystérésis", "mV", 50, 0, 500), vdd: P("Alimentation", "V", 3.3, 2.7, 5), name: P("Nom du signal", "", "SIGNAL", null, null, { text: true }) },
  build(p) {
    const b = builder(), r2 = 10e3, r1 = eSeries(r2 * (p.vdd / Math.min(p.vth, p.vdd * 0.95) - 1), "E96"), vth = p.vdd * r2 / (r1 + r2), rh = p.hyst > 0 ? eSeries(10e3 * p.vdd / (p.hyst / 1000), "E24") : 0, name = upper(p.name, "SIGNAL");
    b.part("U", "U-COMP-SOT23-5", "", "Compare le signal au seuil").part("R1", "R-0603", `${ohm(r1)} 1 %`, "Seuil", { near: "U" }).part("R2", "R-0603", `${ohm(r2)} 1 %`, "Seuil", { near: "U" }).part("RIN", "R-0603", "10 kΩ", "Entrée", { near: "U" });
    b.part("RP", "R-0603", "10 kΩ", "Rappel de la sortie", { near: "U" }).part("C", "C-0603", "100 nF", "Découplage", { near: "U" });
    if (rh) b.part("RH", "R-0603", ohm(rh), "Hystérésis", { near: "U" });
    b.net("IN", ["RIN.1"]).net("INP", ["RIN.2", "U.IN+", ...(rh ? ["RH.1"] : [])]).net("REF", ["U.IN-", "R1.2", "R2.1"]).net("OUT", ["U.OUT", "RP.2", ...(rh ? ["RH.2"] : [])]).net("VDD", ["U.V+", "R1.1", "RP.1", "C.1"], pw(p.vdd, 0.002)).net("GND", ["U.V-", "R2.2", "C.2"], GND);
    b.port("IN", "IN", "in", `${name}_IN`).port("OUT", "OUT", "out", "DIN", { pool: true }).port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND");
    b.calc("Seuil", vth, "V", `Vs = Vdd × R2 / (R1 + R2) = ${fr(p.vdd)} × ${ohm(r2)} / (${ohm(r1)} + ${ohm(r2)}) = ${fr(vth)} V.`);
    if (rh) b.calc("Hystérésis", 1000 * p.vdd * 10e3 / rh, "mV", `ΔV ≈ Vdd × Rin / Rh = ${fr(p.vdd)} × 10 kΩ / ${ohm(rh)} = ${fr(1000 * p.vdd * 10e3 / rh)} mV.`);
    return b.out();
  } };

const hall_current = { id: "hall_current", name: "Mesure de courant isolée", category: "Mesurer", function: "Mesurer le courant jusqu'à ±{imax} A, isolé du circuit de puissance", desc: "Capteur à effet Hall traversé par le courant, filtre de sortie.",
  params: { imax: P("Courant maximal", "A", 15, 1, 20), vbus: P("Tension de la ligne", "V", 48, 0, 400), vdd: P("Alimentation du capteur", "V", 3.3, 3, 5) },
  build(p) {
    const b = builder(), sens = 0.066 * p.vdd / 5, line = pw(p.vbus, p.imax);
    b.part("U", "U-HALLI-SOIC8", "±20 A", "Mesure le champ du courant qui le traverse").part("C", "C-0603", "100 nF", "Découplage", { near: "U" }).part("CFI", "C-0603", "1 nF", "Bande passante du capteur", { near: "U" }).part("RF", "R-0603", "1 kΩ", "Filtre de sortie", { near: "U" }).part("CO", "C-0603", "10 nF", "Filtre de sortie", { near: "RF" });
    b.net("IN", ["U.IP+"], line).net("LOAD", ["U.IP-"], line).net("VDD", ["U.VCC", "C.1"], pw(p.vdd, 0.015)).net("GND", ["U.GND", "C.2", "CFI.2", "CO.2"], GND).net("FILT", ["U.FILTER", "CFI.1"]).net("SENSE", ["U.VIOUT", "RF.1"]).net("OUT", ["RF.2", "CO.1"]);
    b.port("IN", "IN", "power_in", railName(p.vbus)).port("LOAD", "LOAD", "power_out", `${railName(p.vbus)}_MES`).port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "AIN", { pool: true });
    b.calc("Sensibilité", sens * 1000, "mV/A", `S = 66 mV/A × Vdd / 5 V = ${fr(sens * 1000)} mV/A ; zéro à Vdd / 2 = ${fr(p.vdd / 2)} V.`).calc("Excursion", sens * p.imax, "V", `±${fr(p.imax)} A donnent ±${fr(sens * p.imax)} V autour de ${fr(p.vdd / 2)} V${p.vdd / 2 + sens * p.imax > p.vdd - 0.2 ? " : la sortie sature — prenez un calibre plus grand." : "."}`);
    b.note("Cuivre de puissance large et court sous les quatre broches du courant ; rien d'autre sous le boîtier côté puissance.").note("Ligne de fuite entre les broches de puissance et le reste : celle du boîtier, à ne pas réduire par une piste.");
    return b.out();
  } };

const temp_analog = { id: "temp_analog", name: "Capteur de température sur la carte", category: "Mesurer", function: "Mesurer la température de la carte", desc: "Capteur analogique 10 mV/K, découplage et filtre.",
  params: { vdd: P("Alimentation", "V", 3.3, 2.7, 5) },
  build(p) {
    const b = builder();
    b.part("U", "U-TEMP-SOT23", "10 mV/K", "Capteur de température").part("C", "C-0603", "100 nF", "Découplage", { near: "U" }).part("RF", "R-0603", "1 kΩ", "Filtre", { near: "U" }).part("CF", "C-0603", "100 nF", "Filtre", { near: "RF" });
    b.net("VDD", ["U.VDD", "C.1"], pw(p.vdd, 0.001)).net("GND", ["U.GND", "C.2", "CF.2"], GND).net("SENSE", ["U.OUT", "RF.1"]).net("OUT", ["RF.2", "CF.1"]);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "AIN", { pool: true });
    b.calc("Tension à 25 °C", 0.75, "V", "V = 500 mV + 10 mV/K × T : 0,75 V à 25 °C, 1,5 V à 100 °C.");
    b.note("Capteur près de ce que l'on surveille (étage de puissance), relié par du cuivre au même plan.");
    return b.out();
  } };

const encoder_in = { id: "encoder_in", name: "Entrées de codeur ou de capteurs Hall", category: "Mesurer", function: "Lire le codeur ou les capteurs Hall du moteur (3 voies)", desc: "Connecteur fil à carte, alimentation du capteur, rappels, résistances série et filtres.",
  params: { vsens: P("Alimentation du capteur", "V", 5, 3.3, 12), vdd: P("Niveau logique", "V", 3.3, 1.8, 5), fc: P("Fréquence de coupure", "kHz", 150, 1, 1000) },
  build(p) {
    const b = builder(), c = eSeries(1 / (2 * Math.PI * 1e3 * p.fc * 1e3), "E6"), ch = ["A", "B", "Z"];
    b.part("J", "J-WTB-5", "", "Vers le codeur ou les capteurs Hall", { edge: true });
    ch.forEach((k, i) => { b.part(`RP${k}`, "R-0603", "4,7 kΩ", `Rappel de la voie ${k} (sorties à collecteur ouvert)`, { near: "J" }).part(`RS${k}`, "R-0603", "1 kΩ", `Protège l'entrée ${k}`, { near: "J" }).part(`C${k}`, "C-0603", farad(c), `Filtre la voie ${k}`, { near: `RS${k}` });
      b.net(`RAW_${k}`, [`J.${i + 3}`, `RP${k}.2`, `RS${k}.1`]).net(k, [`RS${k}.2`, `C${k}.1`]).port(k, k, "out", "DIN", { pool: true }); });
    b.net("VSENS", ["J.1"], pw(p.vsens, 0.05)).net("VDD", ch.map((k) => `RP${k}.1`), pw(p.vdd, 0.003)).net("GND", ["J.2", ...ch.map((k) => `C${k}.2`)], GND);
    b.port("VSENS", "VSENS", "power_in", railName(p.vsens)).port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND");
    b.calc("Fréquence de coupure", 1 / (2 * Math.PI * 1e3 * c) / 1000, "kHz", `fc = 1 / (2π × 1 kΩ × ${farad(c)}) = ${fr(1 / (2 * Math.PI * 1e3 * c) / 1000)} kHz : au-dessus de la fréquence des fronts du codeur à la vitesse maximale.`);
    b.note("Pour un codeur rapide, relier les voies A et B aux entrées de capture d'une minuterie plutôt qu'à des entrées ordinaires.");
    return b.out();
  } };

const relay = { id: "relay", name: "Relais de puissance", category: "Commander", function: "Commuter {name} par relais : contact {i} A", desc: "Relais inverseur, transistor de commande, diode de roue libre, bornier des contacts.",
  params: { vcoil: P("Tension de la bobine", "V", 12, 5, 24, { options: [5, 12, 24] }), i: P("Courant du contact", "A", 5, 0.1, 10), vload: P("Tension commutée", "V", 230, 5, 250), name: P("Nom de la charge", "", "CHARGE", null, null, { text: true }) },
  build(p) {
    const b = builder(), ic = 0.4 / p.vcoil, sw = { class: p.vload >= 60 ? "hv" : "power", voltage: p.vload, current: p.i }, name = upper(p.name, "CHARGE");
    b.part("K", "K-RELAY-SPDT", `bobine ${fr(p.vcoil)} V`, "Isole et commute la charge").part("Q", "Q-NMOS-SOT23", "", "Alimente la bobine", { near: "K" }).part("D", "D-SCH-SOD123", "", "Roue libre de la bobine", { near: "K" });
    b.part("RG", "R-0603", "100 Ω", "Limite le courant de grille", { near: "Q" }).part("RPD", "R-0603", "100 kΩ", "Relais au repos pendant le démarrage", { near: "Q" }).part("J", "J-TB-3-5.08", "", "Contacts : commun, travail, repos", { edge: true });
    b.net("VCOIL", ["K.A1", "D.K"], pw(p.vcoil, ic)).net("COIL", ["K.A2", "D.A", "Q.D"], pw(p.vcoil, ic)).net("GATE", ["RG.2", "Q.G", "RPD.1"]).net("IN", ["RG.1"]).net("GND", ["Q.S", "RPD.2"], GND);
    b.net("COM", ["K.COM", "J.1"], sw).net("NO", ["K.NO", "J.2"], sw).net("NC", ["K.NC", "J.3"], sw);
    b.port("VCOIL", "VCOIL", "power_in", railName(p.vcoil)).port("IN", "IN", "in", "DOUT", { pool: true }).port("GND", "GND", "gnd", "GND").port("COM", "COM", "bidir", `${name}_COM`).port("NO", "NO", "bidir", `${name}_NO`).port("NC", "NC", "bidir", `${name}_NC`);
    b.calc("Courant de la bobine", ic * 1000, "mA", `I = 0,4 W / ${fr(p.vcoil)} V = ${fr(ic * 1000)} mA : dans les limites du transistor (0,3 A).`);
    b.note(p.vload >= 60 ? "Tension dangereuse sur les contacts : fente ou distance d'isolement entre les contacts et la bobine, aucun cuivre de commande sous le relais." : "Pistes des contacts dimensionnées pour le courant commuté.");
    return b.out();
  } };

const hbridge = { id: "hbridge", name: "Pont en H pour moteur à courant continu", category: "Commander", function: "Piloter un moteur à courant continu : {vm} V, {i} A, deux sens", desc: "Pont intégré, limitation de courant, condensateur de réserve, bornier du moteur.",
  params: { vm: P("Tension du moteur", "V", 24, 6, 40), i: P("Courant limité à", "A", 2, 0.2, 3.5) },
  build(p) {
    const b = builder(), rl = eSeries(64 / p.i, "E96") * 1e3, m = pw(p.vm, p.i);
    b.part("U", "U-HBRIDGE-SOIC8", "", "Quatre interrupteurs et leur commande").part("CM", "CE-D8", "100 µF", "Réserve : absorbe le courant renvoyé par le moteur", { near: "U" }).part("C", "C-0805", "100 nF", "Découplage", { near: "U" }).part("RL", "R-0603", `${ohm(rl)} 1 %`, "Fixe la limite de courant", { near: "U" });
    b.part("J", "J-TB-2-5.08", "", "Vers le moteur", { edge: true });
    b.net("VM", ["U.VM", "CM.+", "C.1"], m).net("GND", ["U.GND", "U.PGND", "CM.-", "C.2", "RL.2"], { ...GND, current: p.i }).net("ILIM", ["U.ILIM", "RL.1"]).net("OUT1", ["U.OUT1", "J.1"], m).net("OUT2", ["U.OUT2", "J.2"], m).net("IN1", ["U.IN1"]).net("IN2", ["U.IN2"]);
    b.port("VM", "VM", "power_in", railName(p.vm)).port("GND", "GND", "gnd", "GND").port("IN1", "IN1", "in", "PWM_A").port("IN2", "IN2", "in", "PWM_B");
    b.calc("Résistance de limitation", rl / 1000, "kΩ", `R = 64 kΩ·A / Ilim = 64 / ${fr(p.i)} = ${ohm(rl)} (constante typique de cette classe de pont : à confirmer sur la fiche technique).`);
    b.calc("Pertes du pont", p.i * p.i * 0.57, "W", `P ≈ I² × (Rds haut + Rds bas) = ${fr(p.i)}² × 0,57 Ω = ${fr(p.i * p.i * 0.57)} W : prévoir du cuivre sous le boîtier.`);
    b.note("Condensateur de réserve contre la broche d'alimentation du moteur ; retour de puissance séparé du retour logique jusqu'au plan.");
    return b.out();
  } };

const stepper = { id: "stepper", name: "Pilote de moteur pas à pas", category: "Commander", function: "Piloter un moteur pas à pas bipolaire : {vm} V, {i} A par phase", desc: "Pilote à micro-pas, résistances de mesure, réglage du courant, bornier du moteur.",
  params: { vm: P("Tension du moteur", "V", 24, 8, 45), i: P("Courant par phase", "A", 1, 0.2, 2), micro: P("Micro-pas", "", 16, 1, 16, { options: [1, 4, 16] }) },
  build(p) {
    const b = builder(), rs = 0.2, vref = Math.min(3.3, 5 * rs * p.i), r2 = 10e3, r1 = eSeries(r2 * (3.3 / vref - 1), "E96"), m = pw(p.vm, p.i), hi = +p.micro === 16 ? ["U.M0", "U.M1"] : +p.micro === 4 ? ["U.M1"] : [], lo = ["U.M0", "U.M1"].filter((x) => !hi.includes(x));
    b.part("U", "U-STEP-HTSSOP28", "", "Hache le courant des deux phases").part("CM", "CE-D8", "100 µF", "Réserve", { near: "U" }).part("C", "C-0805", "100 nF", "Découplage", { near: "U" }).part("CCP", "C-0603", "10 nF", "Pompe de charge", { near: "U" }).part("CVCP", "C-0603", "100 nF", "Réserve de la pompe de charge", { near: "U" });
    b.part("CV3", "C-0603", "470 nF", "Découplage du régulateur interne", { near: "U" }).part("RSA", "R-1206", `${ohm(rs)} 1 %`, "Mesure du courant, phase A", { near: "U" }).part("RSB", "R-1206", `${ohm(rs)} 1 %`, "Mesure du courant, phase B", { near: "U" });
    b.part("R1", "R-0603", `${ohm(r1)} 1 %`, "Réglage du courant", { near: "U" }).part("R2", "R-0603", `${ohm(r2)} 1 %`, "Réglage du courant", { near: "U" }).part("RF", "R-0603", "10 kΩ", "Rappel du signal de défaut", { near: "U" }).part("J", "J-TB-4-3.5", "", "Vers le moteur : A1, A2, B1, B2", { edge: true });
    b.net("VM", ["U.VM", "CM.+", "C.1", "CVCP.2"], m).net("VCP", ["U.VCP", "CVCP.1"]).net("CPL", ["U.CPL", "CCP.1"]).net("CPH", ["U.CPH", "CCP.2"]).net("AISEN", ["U.AISEN", "RSA.1"], m).net("BISEN", ["U.BISEN", "RSB.1"], m);
    b.net("V3P3", ["U.V3P3", "CV3.1", "R1.1", "U.SLEEP_N", "RF.1", ...hi], pw(3.3, 0.01)).net("VREF", ["U.VREF", "R1.2", "R2.1"]).net("GND", ["U.GND", "RSA.2", "RSB.2", "CM.-", "C.2", "CV3.2", "R2.2", "U.DECAY", ...lo], { ...GND, current: 2 * p.i });
    b.net("A1", ["U.AOUT1", "J.1"], m).net("A2", ["U.AOUT2", "J.2"], m).net("B1", ["U.BOUT1", "J.3"], m).net("B2", ["U.BOUT2", "J.4"], m).net("STEP", ["U.STEP"]).net("DIR", ["U.DIR"]).net("EN", ["U.EN_N"]).net("FAULT", ["U.FAULT_N", "RF.2"]);
    b.port("VM", "VM", "power_in", railName(p.vm)).port("GND", "GND", "gnd", "GND").port("STEP", "STEP", "in", "DOUT", { pool: true }).port("DIR", "DIR", "in", "DOUT", { pool: true }).port("EN", "EN", "in", "DOUT", { pool: true }).port("FAULT", "FAULT", "out", "DIN", { pool: true });
    b.calc("Tension de réglage", vref, "V", `Vref = 5 × Rs × I = 5 × ${ohm(rs)} × ${fr(p.i)} A = ${fr(vref)} V (gain de 5 typique de cette classe de pilote : à confirmer sur la fiche technique).`);
    b.calc("Puissance par résistance de mesure", p.i * p.i * rs, "W", `P = I² Rs = ${fr(p.i)}² × ${ohm(rs)} = ${fr(p.i * p.i * rs)} W${p.i * p.i * rs > 0.2 ? " : au-delà de 80 % d'un boîtier 1206 — passez en 2512." : " (boîtier 1206 : 0,25 W)."}`);
    b.note("Plage thermique sous le boîtier reliée au plan de masse par des vias.").note("Résistances de mesure contre le boîtier, retour direct au plan : leur piste porte tout le courant de la phase.");
    return b.out();
  } };

const button = { id: "button", name: "Bouton-poussoir", category: "Signaler", function: "Recevoir une commande de l'opérateur : bouton {name}", desc: "Bouton, rappel, filtre anti-rebond.",
  params: { vdd: P("Niveau logique", "V", 3.3, 1.8, 5), name: P("Nom du bouton", "", "BOUTON", null, null, { text: true }) },
  build(p) {
    const b = builder();
    b.part("SW", "SW-TACT-6", "", "Bouton de l'opérateur").part("RP", "R-0603", "10 kΩ", "Rappel", { near: "SW" }).part("RS", "R-0603", "1 kΩ", "Protège l'entrée", { near: "SW" }).part("C", "C-0603", "100 nF", "Anti-rebond", { near: "RS" });
    b.net("VDD", ["RP.1"], pw(p.vdd, 0.001)).net("KEY", ["SW.A", "RP.2", "RS.1"]).net("OUT", ["RS.2", "C.1"]).net("GND", ["SW.B", "C.2"], GND);
    b.port("VDD", "VDD", "power_in", railName(p.vdd)).port("GND", "GND", "gnd", "GND").port("OUT", "OUT", "out", "DIN", { pool: true });
    b.calc("Constante de temps", 1.1, "ms", "τ = (Rp + Rs) × C = 11 kΩ × 100 nF = 1,1 ms : absorbe les rebonds du contact ; niveau bas quand le bouton est enfoncé.");
    b.note("Bouton accessible carte montée ; pas de composant haut à côté.");
    return b.out();
  } };

const buzzer = { id: "buzzer", name: "Avertisseur sonore", category: "Signaler", function: "Avertir par un signal sonore", desc: "Avertisseur piézo, transistor de commande, résistance de décharge.",
  params: { v: P("Alimentation de l'avertisseur", "V", 5, 3, 12) },
  build(p) {
    const b = builder();
    b.part("BZ", "BZ-12", "", "Avertisseur piézo").part("Q", "Q-NMOS-SOT23", "", "Commute l'avertisseur", { near: "BZ" }).part("RD", "R-0603", "1 kΩ", "Décharge la capacité du piézo à chaque période", { near: "BZ" }).part("RG", "R-0603", "100 Ω", "Limite le courant de grille", { near: "Q" }).part("RPD", "R-0603", "100 kΩ", "Silence pendant le démarrage", { near: "Q" });
    b.net("VCC", ["BZ.+", "RD.1"], pw(p.v, 0.03)).net("DRAIN", ["BZ.-", "RD.2", "Q.D"]).net("GATE", ["RG.2", "Q.G", "RPD.1"]).net("IN", ["RG.1"]).net("GND", ["Q.S", "RPD.2"], GND);
    b.port("VCC", "VCC", "power_in", railName(p.v)).port("IN", "IN", "in", "DOUT", { pool: true }).port("GND", "GND", "gnd", "GND");
    b.calc("Fréquence de pilotage", 2.7, "kHz", "Signal carré de 2 à 4 kHz produit par une minuterie du microcontrôleur : le piézo n'a pas d'oscillateur.");
    return b.out();
  } };

/* a button that lights its LED by itself — no microcontroller : the switch closes the circuit of the LED. The first board of a beginner
   (point 4 of the roadmap). The forward voltage of an LED by its colour is the one the Labo uses (pcba/lab_devices.js : LED_VF). */
const VF = { rouge: 1.9, verte: 2.1, jaune: 2.0, orange: 2.0, bleue: 3.0, blanche: 3.0 };
const push_led = { id: "push_led", name: "Bouton et témoin", category: "Signaler", function: "Allumer la DEL {color} tant que l'on appuie sur le bouton {name}", desc: "Bouton-poussoir, résistance et DEL en série : l'appui ferme le circuit.",
  params: { v: P("Tension de la pile", "V", 3, 1.8, 12), i: P("Courant de la DEL", "mA", 2, 0.5, 20), color: P("Couleur", "", "rouge", null, null, { text: true }), name: P("Nom du bouton", "", "S", null, null, { text: true }) },
  build(p) {
    const b = builder(), c = String(p.color || "rouge").toLowerCase(), vf = VF[Object.keys(VF).find((k) => c.startsWith(k.slice(0, 4)))] ?? 2, r = eSeries(Math.max(10, (p.v - vf) / (p.i / 1000)), "E24"), i = (p.v - vf) / r;
    b.part("SW", "SW-TACT-6", "", `Bouton ${p.name || ""}`.trim()).part("R", "R-0603", ohm(r), "Fixe le courant de la DEL", { near: "SW" }).part("D", "LED-0603", c, `Témoin ${c}`, { near: "R" });
    b.net("VDD", ["SW.A"], pw(p.v, i)).net("LIT", ["SW.B", "R.1"]).net("A", ["R.2", "D.A"]).net("GND", ["D.K"], GND);
    b.port("VDD", "VDD", "power_in", railName(p.v)).port("GND", "GND", "gnd", "GND");
    b.calc("Résistance de la DEL", r, "Ω", `R = (V − Vf) / I = (${fr(p.v)} − ${fr(vf)}) / ${fr(p.i)} mA = ${ohm((p.v - vf) / (p.i / 1000))} → ${ohm(r)} (série E24) : ${fr(i * 1000)} mA. Vf = ${fr(vf)} V : tension typique d'une DEL ${c}, la fiche de la DEL fait foi.`);
    b.calc("Courant de la DEL", i, "A", `I = (${fr(p.v)} − ${fr(vf)}) / ${ohm(r)} = ${fr(i * 1000)} mA, seulement tant que le bouton est enfoncé.`);
    b.note("Bouton accessible carte montée ; la DEL à côté de son bouton, pour que l'on voie lequel allume quoi.");
    return b.out();
  } };
export const IO_BLOCKS = [din, opto_in, amp, comparator, hall_current, temp_analog, encoder_in, relay, hbridge, stepper, button, buzzer, push_led];
