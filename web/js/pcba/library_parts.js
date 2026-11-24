/* DynamiteOrbit.ai — PCBA: the entries of the trade library, as short specifications that library.js completes with
   their land pattern (makeComponent). Generic classes only : no manufacturer, no reference. A pin is "NAME",
   "NAME:type" or "NAME@number" ; a part without a pin list takes the pad numbers as pin names. */

const R = (pkg, P, V, price) => ({ id: `R-${pkg}`, kind: "resistor", name: `Résistance ${pkg}`, package: pkg, desc: `Couche épaisse 1 %, ${String(P).replace(".", ",")} W, ${V} V`, ratings: { P, V }, price, polar: false });
const C = (pkg, V, price) => ({ id: `C-${pkg}`, kind: "capacitor", name: `Condensateur céramique ${pkg}`, package: pkg, desc: `Céramique X7R, jusqu'à ${V} V`, ratings: { V }, price, polar: false });
const CE = (d, V, price) => ({ id: `CE-D${d}`, kind: "capacitor", name: `Condensateur électrolytique Ø ${String(d).replace(".", ",")} mm`, package: `CAP-D${d}`, pins: ["+:passive", "-:passive"], desc: `Aluminium CMS, jusqu'à ${V} V, 105 °C`, ratings: { V }, price, polar: true });
const L = (pkg, I, price, size) => ({ id: `L-${pkg}`, kind: "inductor", name: `Inductance de puissance ${size}`, package: `IND-${pkg}`, desc: `Blindée, courant de saturation jusqu'à ${I} A`, ratings: { I }, price, polar: false });
const D = (id, name, pkg, desc, ratings, price) => ({ id, kind: "diode", name, package: pkg, pins: ["K:passive", "A:passive"], desc, ratings, price });
const Q = (id, name, pkg, desc, ratings, price, pins = ["G", "S:passive", "D:passive"]) => ({ id, kind: "mosfet", name, package: pkg, pins, desc, ratings, price });
const QP = ["G", "D:passive", "S:passive"];                     // power packages : 1 gate, 2 drain (tab), 3 source
const U = (id, name, pkg, pins, desc, ratings, price, kind = "ic") => ({ id, kind, name, package: pkg, pins, desc, ratings, price });
const J = (id, name, pkg, price, kind = "connector", I = 3, V = 250) => ({ id, kind, name, package: pkg, desc: `${I} A par contact, ${V} V`, ratings: { I, V }, price });

const MCU48 = ["VDD", "PC13", "PC14", "PC15", "OSC_IN", "OSC_OUT", "NRST", "VSSA", "VDDA", "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1", "PB2", "PB10", "PB11", "VSS", "VDD",
  "PB12", "PB13", "PB14", "PB15", "PA8", "PA9", "PA10", "PA11", "PA12", "SWDIO", "VSS", "VDD", "SWCLK", "PA15", "PB3", "PB4", "PB5", "PB6", "PB7", "BOOT0", "PB8", "PB9", "VSS", "VDD"];
const MCU32 = ["VDD", "OSC_IN", "OSC_OUT", "NRST", "VDDA", "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1", "VSS", "VDD", "PA8", "PA9", "PA10", "PA11", "PA12", "SWDIO", "SWCLK", "PA15", "PB3", "PB4", "PB5", "PB6", "PB7", "BOOT0", "VSS"];

export const PARTS = [
  R("0402", 0.063, 50, 0.01), R("0603", 0.1, 75, 0.01), R("0805", 0.125, 150, 0.02), R("1206", 0.25, 200, 0.03), R("2512", 1, 200, 0.08),
  { ...R("2512", 2, 200, 0.45), id: "R-SHUNT-2512", name: "Résistance de mesure 2512", desc: "Shunt métallique 1 %, 2 W, faible coefficient de température" },
  C("0402", 25, 0.01), C("0603", 50, 0.02), C("0805", 50, 0.04), C("1206", 100, 0.1), C("1210", 100, 0.35),
  CE(6.3, 63, 0.35), CE(8, 63, 0.5), CE(10, 100, 0.9),
  L("4040", 2, 0.45, "4 × 4 mm"), L("6060", 5, 0.7, "6 × 6 mm"), L("1040", 12, 1.6, "10 × 10 mm"),
  { id: "FB-0603", kind: "inductor", name: "Perle de ferrite 0603", package: "0603", desc: "600 Ω à 100 MHz, 1 A", ratings: { I: 1 }, price: 0.03, polar: false },
  { id: "L-CMC-4532", kind: "inductor", name: "Inductance de mode commun 4532", package: "CMC-4532", desc: "Bus CAN : 51 µH, enroulements 1–4 et 2–3", ratings: { I: 0.3, V: 50 }, price: 0.8, polar: true },
  { id: "NTC-0603", kind: "sensor", name: "CTN 10 kΩ 0603", package: "0603", desc: "Thermistance 10 kΩ à 25 °C, B = 3950 K", ratings: { P: 0.1 }, price: 0.08, polar: false },
  D("D-SIG-SOD123", "Diode de signal SOD-123", "SOD-123", "Commutation rapide 100 V, 0,2 A", { V: 100, I: 0.2 }, 0.04),
  D("D-SCH-SOD123", "Diode Schottky 40 V 1 A SOD-123", "SOD-123", "Faible chute, roue libre ou anti-retour", { V: 40, I: 1 }, 0.1),
  D("D-SCH-SMA", "Diode Schottky 60 V 2 A SMA", "SMA", "Roue libre de charge inductive", { V: 60, I: 2 }, 0.15),
  D("D-SCH-SMC", "Diode Schottky 100 V 5 A SMC", "SMC", "Redressement et roue libre de puissance", { V: 100, I: 5 }, 0.45),
  D("D-ZEN-SOD123", "Diode Zener SOD-123", "SOD-123", "Écrêtage, 0,5 W", { P: 0.5 }, 0.05),
  D("D-TVS-SMA", "Diode TVS 400 W SMA", "SMA", "Écrêteur de surtension unidirectionnel", { P: 400, V: 60 }, 0.2),
  D("D-TVS-SMB", "Diode TVS 600 W SMB", "SMB", "Écrêteur de surtension unidirectionnel", { P: 600, V: 80 }, 0.3),
  { id: "D-TVS-485-SOT23", kind: "diode", name: "Double TVS bidirectionnel pour bus RS-485 SOT-23", package: "SOT-23", pins: ["IO1:passive", "IO2:passive", "GND"], desc: "Protection des deux lignes, tension de veille de 12 V ou plus", ratings: { V: 12 }, price: 0.3 },
  { id: "D-TVS-CAN-SOT23", kind: "diode", name: "Double TVS pour bus CAN SOT-23", package: "SOT-23", pins: ["IO1:passive", "IO2:passive", "GND"], desc: "Protection des deux lignes, 24 V", ratings: { V: 24 }, price: 0.25 },
  { id: "LED-0603", kind: "led", name: "DEL 0603", package: "0603", pins: ["K:passive", "A:passive"], desc: "Témoin, 2 V typique à 2 mA (couleur dans la valeur)", ratings: { I: 0.02 }, price: 0.06 },
  Q("Q-NMOS-SOT23", "MOSFET N 60 V 0,3 A SOT-23", "SOT-23", "Commutation de signal et de petites charges", { V: 60, I: 0.3 }, 0.08),
  Q("Q-NMOS-SOT23-P", "MOSFET N 30 V 4 A SOT-23", "SOT-23", "Petite charge de puissance, 30 mΩ", { V: 30, I: 4 }, 0.18),
  Q("Q-PMOS-SOT23", "MOSFET P −30 V 3 A SOT-23", "SOT-23", "Interrupteur côté haut, protection d'inversion", { V: 30, I: 3 }, 0.18),
  Q("Q-PMOS-DPAK", "MOSFET P −60 V 20 A DPAK", "DPAK", "Protection contre l'inversion de polarité", { V: 60, I: 20 }, 0.9, QP),
  Q("Q-NMOS-DPAK", "MOSFET N 100 V 30 A DPAK", "DPAK", "Étage de puissance, 25 mΩ", { V: 100, I: 30 }, 0.8, QP),
  Q("Q-NMOS-D2PAK", "MOSFET N 100 V 80 A D2PAK", "D2PAK", "Étage de puissance, 8 mΩ", { V: 100, I: 80 }, 1.9, QP),
  Q("Q-NMOS-TO220", "MOSFET N 100 V 60 A TO-220", "TO-220", "Étage de puissance traversant, sur dissipateur", { V: 100, I: 60 }, 1.6, QP),
  { id: "Q-NPN-SOT23", kind: "transistor", name: "Transistor NPN 45 V 0,1 A SOT-23", package: "SOT-23", pins: ["B", "E:passive", "C:passive"], desc: "Petit signal", ratings: { V: 45, I: 0.1 }, price: 0.04 },
  U("U-BUCK-SOT23-6", "Régulateur abaisseur synchrone 60 V 1 A SOT-23-6", "SOT-23-6", ["BST:passive", "GND", "FB", "EN", "VIN", "SW"], "Référence 0,8 V, 500 kHz", { V: 60, I: 1 }, 1.4),
  U("U-BUCK-SOIC8", "Régulateur abaisseur synchrone 60 V 3 A SOIC-8", "SOIC-8", ["BST:passive", "VIN", "EN", "SS:passive", "FB", "COMP:passive", "GND", "SW"], "Référence 0,8 V, 400 kHz, démarrage progressif", { V: 60, I: 3 }, 2.6),
  U("U-LDO-SOT223", "Régulateur linéaire 1 A SOT-223", "SOT-223", ["GND", "VOUT", "VIN", "VOUT@4"], "Faible chute, sortie fixe", { V: 15, I: 1 }, 0.45),
  U("U-LDO-SOT23-5", "Régulateur linéaire 0,3 A SOT-23-5", "SOT-23-5", ["VIN", "GND", "EN", "NC", "VOUT"], "Faible chute, faible bruit, sortie fixe", { V: 6, I: 0.3 }, 0.3),
  U("U-GATE-HB-SOIC8", "Pilote de grille demi-pont 100 V SOIC-8", "SOIC-8", ["VCC", "HIN", "LIN", "COM", "LO", "VS:passive", "HO", "VB:passive"], "Alimentation flottante par condensateur d'amorçage", { V: 100, I: 2 }, 1.5),
  U("U-MCU-LQFP48", "Microcontrôleur 32 bits LQFP-48", "LQFP-48", MCU48, "Cœur 32 bits, CAN, minuteries de commande moteur, convertisseur 12 bits", { V: 3.6 }, 4.5, "mcu"),
  U("U-MCU-LQFP32", "Microcontrôleur 32 bits LQFP-32", "LQFP-32", MCU32, "Cœur 32 bits, version compacte", { V: 3.6 }, 2.8, "mcu"),
  U("U-CAN-SOIC8", "Émetteur-récepteur CAN SOIC-8", "SOIC-8", ["TXD", "GND", "VCC", "RXD", "VIO", "CANL", "CANH", "STB"], "CAN haute vitesse, lignes tolérantes ±58 V", { V: 5.5 }, 1.1),
  U("U-RS485-SOIC8", "Émetteur-récepteur RS-485 SOIC-8", "SOIC-8", ["RO", "RE_N", "DE", "DI", "GND", "A:bidir", "B:bidir", "VCC"], "Demi-duplex, 3,3 V", { V: 5.5 }, 0.9),
  U("U-ISO-SOIC16W", "Isolateur numérique 4 voies SOIC-16 large", "SOIC-16W", ["VDD1", "GND1", "INA", "INB", "INC", "OUTD", "EN1", "GND1", "GND2", "EN2", "IND", "OUTC", "OUTB", "OUTA", "GND2", "VDD2"], "3 voies aller, 1 retour ; ligne de fuite 8 mm", { V: 5.5 }, 3.2),
  U("U-OPTO-SOP4", "Optocoupleur SOP-4", "SOP-4", ["A:passive", "K:passive", "E:passive", "C:passive"], "Sortie transistor, isolation 3,75 kV", { V: 80 }, 0.35, "optocoupler"),
  U("U-CSA-SOT23-5", "Amplificateur de mesure de courant SOT-23-5", "SOT-23-5", ["OUT", "GND", "IN+", "IN-", "VS:power_in"], "Gain 20 V/V, mode commun jusqu'à 80 V", { V: 80 }, 1.2),
  U("U-OPAMP-SOT23-5", "Amplificateur opérationnel SOT-23-5", "SOT-23-5", ["OUT", "V-", "IN+", "IN-", "V+"], "Rail à rail, 10 MHz", { V: 5.5 }, 0.5),
  U("U-OPAMP2-SOIC8", "Double amplificateur opérationnel SOIC-8", "SOIC-8", ["OUTA", "INA-", "INA+", "V-", "INB+", "INB-", "OUTB", "V+"], "Rail à rail", { V: 5.5 }, 0.7),
  U("U-COMP-SOT23-5", "Comparateur SOT-23-5", "SOT-23-5", ["OUT", "V-", "IN+", "IN-", "V+"], "Sortie à drain ouvert, 100 ns", { V: 5.5 }, 0.45),
  U("U-IMU-LGA14", "Centrale inertielle 6 axes LGA-14", "LGA-14", ["SDO", "NC", "NC", "INT1", "VDDIO", "GND", "GND", "VDD", "INT2", "NC", "NC", "CS", "SCL", "SDA"], "Accéléromètre et gyromètre, I²C ou SPI", { V: 3.6 }, 3.5, "sensor"),
  U("U-TEMP-SOT23", "Capteur de température analogique SOT-23", "SOT-23", ["VDD", "OUT", "GND"], "10 mV/K, ±1 K", { V: 5.5 }, 0.5, "sensor"),
  U("U-HALL-SOT23", "Capteur à effet Hall SOT-23", "SOT-23", ["VCC", "OUT", "GND"], "Sortie numérique à drain ouvert", { V: 24 }, 0.6, "sensor"),
  U("U-EEPROM-SOIC8", "Mémoire EEPROM I²C SOIC-8", "SOIC-8", ["A0", "A1", "A2", "GND", "SDA", "SCL", "WP", "VCC"], "64 kbit, paramètres et étalonnage", { V: 5.5 }, 0.4),
  U("U-REF-SOT23", "Référence de tension SOT-23", "SOT-23", ["VIN", "VOUT", "GND"], "2,5 V ou 3,0 V, 0,1 %", { V: 12 }, 0.9),
  U("U-SUP-SOT23", "Superviseur d'alimentation SOT-23", "SOT-23", ["GND", "RESET_N", "VCC"], "Remise à zéro sous le seuil, drain ouvert", { V: 5.5 }, 0.3),
  { id: "Y-3225", kind: "crystal", name: "Quartz 3225", package: "XTAL-3225", pins: ["X1:passive", "GND", "X2:passive", "GND@4"], desc: "8 à 25 MHz, charge 10 pF", ratings: {}, price: 0.35, polar: false },
  { id: "F-1206", kind: "fuse", name: "Fusible CMS 1206", package: "1206", desc: "Rapide, 63 V (calibre dans la valeur)", ratings: { V: 63, I: 5 }, price: 0.3, polar: false },
  { id: "F-PTC-1210", kind: "fuse", name: "Fusible réarmable 1210", package: "1210", desc: "PTC polymère, 30 V", ratings: { V: 30, I: 2 }, price: 0.25, polar: false },
  ...[2, 3, 4, 5, 6, 8].map((n) => J(`J-HDR-1x${String(n).padStart(2, "0")}`, `Barrette ${n} broches, pas 2,54`, `HDR-1x${String(n).padStart(2, "0")}-2.54`, 0.05 * n)),
  J("J-HDR-2x05", "Barrette 2 × 5 broches, pas 2,54", "HDR-2x05-2.54", 0.4), J("J-HDR-2x10", "Liaison carte à carte 2 × 10, pas 2,54", "HDR-2x10-2.54", 0.9),
  J("J-SWD-2x05", "Connecteur de programmation 2 × 5, pas 1,27", "HDR-2x05-1.27", 0.8, "connector", 1, 50),
  J("J-TB-2-5.08", "Bornier à vis 2 pôles, pas 5,08", "TB-2-5.08", 0.6, "terminal", 16, 300), J("J-TB-3-5.08", "Bornier à vis 3 pôles, pas 5,08", "TB-3-5.08", 0.9, "terminal", 16, 300),
  J("J-TB-2-3.5", "Bornier à vis 2 pôles, pas 3,5", "TB-2-3.5", 0.45, "terminal", 8, 150), J("J-TB-4-3.5", "Bornier à vis 4 pôles, pas 3,5", "TB-4-3.5", 0.85, "terminal", 8, 150),
  { id: "SW-TACT-6", kind: "switch", name: "Bouton-poussoir 6 × 6 mm", package: "SW-TACT-6", pins: ["A:passive", "A:passive", "B:passive", "B:passive"], desc: "Tactile CMS, 50 mA", ratings: { I: 0.05, V: 12 }, price: 0.15, polar: false },
  { id: "TP-1.0", kind: "testpoint", name: "Point de test Ø 1 mm", package: "TP-1.0", pins: ["TP:passive"], desc: "Pastille nue pour la pointe d'essai", ratings: {}, price: 0, polar: false },
  { id: "FID-1.0", kind: "fiducial", name: "Mire de placement Ø 1 mm", package: "FID-1.0", pins: ["F:nc"], desc: "Repère optique pour la machine de placement", ratings: {}, price: 0, polar: false },
];
