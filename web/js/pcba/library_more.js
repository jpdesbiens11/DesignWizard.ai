/* DynamiteOrbit — PCBA: more entries of the trade library — what the usual sub-circuits of an embedded board ask for
   beyond the core list of library_parts.js : USB, isolated supply, motor and relay drive, memories, clock, serial
   links, user interface. Same rules : generic classes with the pinout usual for the class, no manufacturer, no
   reference ; the data sheet of the part finally chosen prevails. */

const U = (id, name, pkg, pins, desc, ratings, price, kind = "ic") => ({ id, kind, name, package: pkg, pins, desc, ratings, price });
const D = (id, name, pkg, desc, ratings, price) => ({ id, kind: "diode", name, package: pkg, pins: ["K:passive", "A:passive"], desc, ratings, price });
const J = (id, name, pkg, price, I = 3, V = 250) => ({ id, kind: "connector", name, package: pkg, desc: `${I} A par contact, ${V} V`, ratings: { I, V }, price });

export const MORE_PARTS = [
  D("D-SIG-SOD323", "Diode de signal SOD-323", "SOD-323", "Commutation rapide 75 V, 0,15 A", { V: 75, I: 0.15 }, 0.03),
  D("D-ESD-SOD323", "Diode de protection ESD SOD-323", "SOD-323", "Écrêteur 5 V, faible capacité, pour une ligne de signal", { V: 5 }, 0.06),
  { id: "D-BRIDGE-SOP4", kind: "diode", name: "Pont redresseur 0,8 A SOP-4", package: "SOP-4", pins: ["+:passive", "AC1:passive", "AC2:passive", "-:passive"], desc: "Pont de Graetz 600 V, 0,8 A", ratings: { V: 600, I: 0.8 }, price: 0.25 },
  { id: "Q-PNP-SOT23", kind: "transistor", name: "Transistor PNP 45 V 0,1 A SOT-23", package: "SOT-23", pins: ["B", "E:passive", "C:passive"], desc: "Petit signal", ratings: { V: 45, I: 0.1 }, price: 0.04 },
  { id: "Q-NMOS2-SOT363", kind: "mosfet", name: "Double MOSFET N 50 V 0,2 A SOT-363", package: "SOT-363", pins: ["S1:passive", "G1:in", "D2:passive", "S2:passive", "G2:in", "D1:passive"], desc: "Translation de niveaux bidirectionnelle (I²C)", ratings: { V: 50, I: 0.2 }, price: 0.12 },
  U("U-BOOST-SOT23-6", "Régulateur élévateur 1,2 MHz SOT-23-6", "SOT-23-6", ["SW", "GND", "FB", "EN", "VIN", "NC"], "Interrupteur intégré 2 A, sortie jusqu'à 28 V, référence 0,6 V", { V: 28, I: 2 }, 0.9),
  U("U-DCDC-ISO-SIP4", "Convertisseur isolé 1 W SIP-4", "SIP-4", ["GND1:gnd", "VIN", "GND2:gnd", "VOUT"], "Module isolé non régulé, 1 W, isolation 1,5 kV", { V: 15, P: 1 }, 3.5),
  U("U-ISO2-SOIC8", "Isolateur numérique 2 voies SOIC-8", "SOIC-8", ["VDD1", "INA", "INB", "GND1", "GND2", "OUTB", "OUTA", "VDD2"], "2 voies dans le même sens, isolation fonctionnelle", { V: 5.5 }, 1.6),
  U("U-GATE-ISO-SOIC8W", "Pilote de grille isolé SOIC-8 large", "SOIC-8W", ["VCC1:power_in", "IN+", "IN-", "GND1", "GND2", "OUT", "OUT", "VCC2:power_in"], "Sortie 4 A, isolation renforcée, ligne de fuite 8 mm", { V: 30, I: 4 }, 3.4),
  U("U-HBRIDGE-SOIC8", "Pont en H pour moteur à courant continu SOIC-8", "SOIC-8", ["GND", "IN2", "IN1", "ILIM:passive", "VM", "OUT1", "PGND", "OUT2"], "45 V, 3,5 A crête, limitation de courant réglable", { V: 45, I: 3.5 }, 2.2),
  U("U-STEP-HTSSOP28", "Pilote de moteur pas à pas HTSSOP-28", "HTSSOP-28", ["CPL:passive", "CPH:passive", "VCP:passive", "VM", "AOUT1", "AISEN:passive", "AOUT2", "BOUT2", "BISEN:passive", "BOUT1", "VM", "VREF:in", "NC", "GND", "V3P3:power_out", "SLEEP_N:in", "FAULT_N:out", "DECAY:in", "DIR:in", "EN_N:in", "STEP:in", "NC", "M0:in", "M1:in", "NC", "NC", "NC", "GND", "GND@EP"], "Bipolaire 2 A par phase, micro-pas jusqu'à 1/16, 45 V, plage thermique dessous", { V: 45, I: 2 }, 3.8),
  U("U-HALLI-SOIC8", "Capteur de courant à effet Hall SOIC-8", "SOIC-8", ["IP+:passive", "IP+:passive", "IP-:passive", "IP-:passive", "GND", "FILTER:passive", "VIOUT:out", "VCC"], "±20 A, isolé, 66 mV/A (5 V) — sortie centrée sur Vcc / 2", { V: 5.5, I: 20 }, 3.2, "sensor"),
  U("U-USBUART-SOIC16", "Pont USB vers UART SOIC-16", "SOIC-16", ["GND", "TXD", "RXD", "V3:passive", "DP:bidir", "DN:bidir", "NC", "NC", "CTS:in", "NC", "NC", "NC", "DTR:out", "RTS:out", "NC", "VCC"], "USB 2.0 pleine vitesse, sans quartz", { V: 5.5 }, 1.2),
  U("U-ESD-USB-SOT23-6", "Protection ESD des lignes USB SOT-23-6", "SOT-23-6", ["IO1:passive", "GND", "IO2:passive", "IO2:passive", "VBUS:passive", "IO1:passive"], "Deux lignes de données et VBUS, 0,5 pF", { V: 5.5 }, 0.3, "diode"),
  U("U-FLASH-SOIC8", "Mémoire flash SPI SOIC-8", "SOIC-8", ["CS", "MISO", "WP", "GND", "MOSI", "SCK", "HOLD_N:in", "VCC"], "NOR 16 Mbit : journal, micrologiciel de secours", { V: 3.6 }, 0.7),
  U("U-RTC-SOIC8", "Horloge temps réel I²C SOIC-8", "SOIC-8", ["X1:passive", "X2:passive", "VBAT:power_in", "GND", "SDA", "SCL", "INT:out", "VCC"], "Calendrier, alarme, bascule sur pile", { V: 5.5 }, 1.1),
  { id: "Y-32K-3215", kind: "crystal", name: "Quartz 32,768 kHz 3215", package: "XTAL-3215", pins: ["X1:passive", "X2:passive"], desc: "Quartz d'horloge, charge 9 pF", ratings: {}, price: 0.3, polar: false },
  U("U-RS232-SOIC16", "Émetteur-récepteur RS-232 SOIC-16", "SOIC-16", ["C1+:passive", "VS+:passive", "C1-:passive", "C2+:passive", "C2-:passive", "VS-:passive", "T2OUT:out", "R2IN:in", "R2OUT:out", "T2IN:in", "T1IN:in", "R1OUT:out", "R1IN:in", "T1OUT:out", "GND", "VCC"], "2 émetteurs, 2 récepteurs, pompe de charge, 3 à 5,5 V", { V: 5.5 }, 0.9),
  U("U-LIN-SOIC8", "Émetteur-récepteur LIN SOIC-8", "SOIC-8", ["RXD", "EN", "WAKE:in", "TXD", "GND", "LIN:bidir", "VS:power_in", "INH:out"], "LIN 2.x, 20 kbit/s, tenue 40 V", { V: 40 }, 0.8),
  U("U-SR-TSSOP16", "Registre à décalage 8 sorties TSSOP-16", "TSSOP-16", ["QB:out", "QC:out", "QD:out", "QE:out", "QF:out", "QG:out", "QH:out", "GND", "QHS:out", "SRCLR_N:in", "SRCLK:in", "RCLK:in", "OE_N:in", "SER:in", "QA:out", "VCC"], "Série vers parallèle, sorties verrouillées", { V: 5.5 }, 0.3),
  { id: "K-RELAY-SPDT", kind: "relay", name: "Relais 1 contact inverseur, bobine 12 ou 24 V", package: "RELAY-SPDT", pins: ["A1:passive", "A2:passive", "COM:passive", "NO:passive", "NC:passive"], desc: "Contact 10 A 250 V, bobine 0,4 W", ratings: { I: 10, V: 250 }, price: 1.4, polar: false },
  { id: "BZ-12", kind: "other", prefix: "BZ", name: "Avertisseur piézo Ø 12 mm", package: "BUZZER-12", pins: ["+:passive", "-:passive"], desc: "Sans oscillateur : à piloter à 2 à 4 kHz", ratings: { V: 12 }, price: 0.6, polar: true },
  { id: "BAT-CR2032", kind: "connector", prefix: "BT", name: "Support de pile CR2032", package: "BAT-CR2032", pins: ["+:power_out", "-:passive"], desc: "Pile bouton 3 V, 220 mAh", ratings: { V: 3 }, price: 0.5, polar: true },
  { id: "J-USB-C", kind: "connector", name: "Embase USB-C (USB 2.0)", package: "USB-C-2.0", pins: ["GND@A1", "VBUS:passive@A4", "SBU2:nc@B8", "CC1:passive@A5", "DN:bidir@B7", "DP:bidir@A6", "DN:bidir@A7", "DP:bidir@B6", "SBU1:nc@A8", "CC2:passive@B5", "VBUS:passive@B4", "GND@B1", "SHELL:passive@S1", "SHELL:passive@S2", "SHELL:passive@S3", "SHELL:passive@S4"], desc: "16 contacts, 3 A sur VBUS, blindage traversant", ratings: { I: 3, V: 20 }, price: 0.6 },
  ...[2, 3, 4, 5, 6, 8].map((n) => J(`J-WTB-${n}`, `Connecteur fil à carte ${n} contacts, pas 2,0`, `WTB-${n}-2.0`, 0.12 + 0.03 * n, 2, 100)),
  ...Array.from({ length: 19 }, (_, k) => k + 2).map((n) => J(`J-FLEX-${n}`, `Joint de circuit flexible ${n} pistes, pas 1,0 (pastilles soudées)`, `FLEXJ-${n}-1.0`, 0, 0.5, 50)),      // no part to buy : the flex itself is soldered there
];
