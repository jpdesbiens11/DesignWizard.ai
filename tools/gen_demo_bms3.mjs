/* Builds the central BMS board of the module BM 8s8p, 3 in × 3 in (JP, 25 novembre 2026) — the second central board of the project, beside the
   85 × 62 mm one of iteration 14 that concept 2 houses. Written as .dwiz text in web/js/demo/demo_bms3_data.js and demo_bms3_data2.js.
   (Below, the header of the first generator : what this board grew from.)
   Builds the central BMS board of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central interroge les cartes, juge et agit —
   contactors, état envoyé au véhicule : normal, dératé, urgence, arrêt » ; 22 novembre : « le couvercle du fond… contient peut-être le BMS »)
   — from its functions to its copper — and writes it as .dwiz text in web/js/demo/demo_bms_data.js.
   Run : node tools/gen_demo_bms3.mjs   (--dry : build and check, write nothing) */
import { writeFileSync } from "node:fs";
import { emptyBoard } from "../web/js/pcba/model.js";
import { addBlock, addFunction } from "../web/js/pcba/synth.js";
import { floorplan, placeParts, placementProblems, zoneProblems } from "../web/js/pcba/place.js";
import { autoroute } from "../web/js/pcba/route.js";
import { erc } from "../web/js/pcba/erc.js";
import { checkBoard } from "../web/js/pcba/drc.js";
import { LIBRARY } from "../web/js/pcba/library.js";
import { toDwiz } from "../web/js/core/dwiz.js";

const W = Number(process.argv.find((a) => a.startsWith("--w="))?.slice(4) || 76.2), H = Number(process.argv.find((a) => a.startsWith("--h="))?.slice(4) || 76.2);
/* JP, 25 novembre 2026 : « une nouvelle carte BMS de 3 po × 3 po au plus, au fond du BM dans le couvercle du bas, avec le connecteur et le
   raccord des busbars vers les CORE ; la chaîne RS-485 des CORE est collectée par cette carte ; l'extérieur communique et prend ou envoie
   l'énergie, gérée et autorisée par elle ; en cas d'urgence elle ouvre le contacteur au bout du BM, près du connecteur HV/LV ». Choix de JP,
   par menu, le même jour : CAN FD isolé vers le véhicule et la borne ; contacteur + précharge + pyrofusible ; shunt sur la barre de retour ;
   alimentation par le module ou le 12 V, le premier présent. Les usages de l'industrie que l'outil suit sont dans Logiciel › Références.
   JP, 27 novembre 2026 : « faire le main PCBA 3"x3" with all relevant functions from requirements and architecture : monitoring, contactor, led,
   buzzer, connector combined LV + HV, rest over busbar, measure current, voltage, temperature at output, feed RS-485 stream to vehicle, actuator
   if any (cooling pump, fan), vehicle command, EFC » ; choix par menu, le même jour : le CAN FD isolé reste, et porte aussi le flux de la chaîne
   des 8 CORE. Added : the swap connector's LV contacts (12 V power, signals ; its HV contacts are on the busbars), the output voltage and the
   temperature of the output terminal (taps on the busbars), the pump and the fan, the commands of the vehicle (ENABLE, presence, acknowledge),
   three LEDs and the buzzer.
   JP, 27 novembre 2026 : « 2 pcb types that speak to each other when powered with 12 V… the main might not send anything to the core pcb » ; choix par
   menu : un tour fixe (CORE 1 ouvre, chacune après la précédente), chaque CORE équilibre seule au seuil, sans 12 V le principal veille sur le module
   et les CORE ne parlent pas : the isolated supply of their bus side takes the 12 V, not the 5 V rail. The transceiver is held in receive by its DE
   (RS485_DE, low) ; the texts say who speaks. */
const b = emptyBoard("BMS-CENTRAL-3X3", "BMS central 3 po × 3 po");
b.description = "Le BMS central du module BM 8s8p, 3 po × 3 po au plus, dans le couvercle du bas : vit sur le module ou sur le 12 V du véhicule (le premier présent), écoute les 8 CORE boards, qui transmettent en round-robin sur la daisy chain RS-485 isolée (il en alimente le bus side, depuis le 12 V seulement, et ne leur transmet rien), mesure la sortie — courant sur le shunt de la barre de retour, tension du module et de la sortie, température de la borne — et compte l'énergie (EFC), autorise l'énergie (contacteur, précharge, pyrofusible), refroidit (pompe, ventilateur), signale l'état (trois témoins, avertisseur) et parle au véhicule par le CAN FD isolé, qui porte aussi le flux des CORE ; le connecteur d'échange est combiné : ses contacts LV sur la carte, ses contacts HV sur les barres";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("Vivre sur le module ou sur le 12 V, le premier présent", [{ name: "Sources", level: "le module (8S : 24 à 34 V, prise sur la barre B+) ou le 12 V du véhicule ou de la borne par le connecteur d'échange (9 à 16 V, exemple à confirmer)", flex: "F1" }, { name: "Wake-up", level: "par le véhicule (WAKE) ou par la charging station", flex: "F1" }, { name: "Sans 12 V", level: "standby : elle vit sur le module et le surveille avec ses propres sensors (module voltage, output terminal NTC) ; les CORE boards sont silent — leur bus side ne vit que du 12 V — ; le contactor reste ouvert (sa coil est sur le 12 V)", flex: "F1" }]);
const f2 = F("Écouter le round-robin des 8 CORE boards (RS-485)", [{ name: "Bus", level: "RS-485 half-duplex isolé, daisy chain, 9 nodes", flex: "F0" }, { name: "Bus side", level: "alimenté par cette carte depuis le 12 V seulement : 5 V isolés, 1 W — sans 12 V, les CORE boards sont silent", flex: "F0" }, { name: "Termination", level: "120 Ω sur cette carte et sur la borne + du module", flex: "F1" }, { name: "Round-robin", level: "CORE 1 ouvre le cycle, chaque CORE transmet dans son slot après avoir entendu la précédente ; un cycle qui ne revient pas = timeout, emergency", flex: "F0" }, { name: "Frame", level: "par CORE, dans son slot : cell block voltage, 8 NTC, balancing actif ; vers les CORE : rien", flex: "F0" }, { name: "Transceiver", level: "en receive mode : DE bas par le microcontroller, pull-down sur DE au reset", flex: "F1" }]);
const f3 = F("Mesurer la sortie : courant, tension, température — et compter l'énergie (EFC)", [{ name: "Courant", level: "shunt de la barre de retour, deux fils Kelvin ; ± 400 A (360 A en décharge, 72 A en charge ; exemple)", flex: "F1" }, { name: "Tension", level: "du module (prise B+) et de la sortie après le contacteur (prise sur la barre de sortie) : précharge et contacteur soudé", flex: "F1" }, { name: "Température", level: "une CTN sur la borne de sortie, par les prises des barres", flex: "F1" }, { name: "Énergie", level: "energy flow counter : tension × courant intégrés par le logiciel", flex: "F1" }]);
const f4 = F("Autoriser l'énergie : contacteur, précharge, pyrofusible", [{ name: "Contacteur", level: "bobine 12 V, 1 A au plus (enveloppe générique, fiche non lue), contact auxiliaire relu", flex: "F1" }, { name: "Précharge", level: "relais et résistance : le bus du véhicule chargé avant le contacteur", flex: "F1" }, { name: "Pyrofusible", level: "amorce sur le 12 V, en dernier recours", flex: "F1" }]);
const f5 = F("Parler au véhicule et à la borne, en recevoir les ordres", [{ name: "Liaison", level: "CAN FD isolé (exemple : 500 kbit/s, 2 Mbit/s en phase de données)", flex: "F1" }, { name: "Flux", level: "le stream des 8 CORE (voltages, temperatures, balancing), le module state, le courant, l'énergie comptée", flex: "F0" }, { name: "Ordres câblés", level: "ENABLE (le véhicule autorise l'énergie), présence (le module est dans sa cavité), acquittement d'un défaut", flex: "F0" }]);
const f6 = F("Juger et décider", [{ name: "Calcul", level: "microcontroller : la state machine du module, d'après les frames des CORE et les sensors de la carte (output, 12 V, vehicle commands) — le balancing est local à chaque CORE", flex: "F1" }, { name: "Mémoire", level: "réglages, énergie comptée et journal des défauts", flex: "F1" }]);
const f7 = F("Être testable et programmable", [{ name: "Accès", level: "connecteur de programmation, points de test", flex: "F1" }]);
const f8 = F("Signaler l'état du module", [{ name: "Témoins", level: "vert normal, jaune dératé, rouge urgence ou arrêt (state lamp)", flex: "F1" }, { name: "Alarme", level: "avertisseur piézo", flex: "F1" }]);
const f9 = F("Refroidir : pompe et ventilateur", [{ name: "Pompe", level: "12 V, 2 A au plus (exemple)", flex: "F1" }, { name: "Ventilateur", level: "12 V, 1 A au plus (exemple)", flex: "F1" }]);
const f10 = F("Le connecteur d'échange, combiné LV + HV", [{ name: "HV", level: "les deux contacts de puissance du module sont sur les barres, par des découpes de la carte : aucun courant de puissance dans le cuivre de la carte", flex: "F0" }, { name: "LV", level: "contacts de puissance 12 V et contacts de signal soudés sur la carte", flex: "F0" }, { name: "Ordre", level: "le contact de présence s'établit en dernier et rompt en premier", flex: "F0" }]);
F("Tenir dans le couvercle du bas", [{ name: "Carte", level: `${W} × ${H} mm au plus (3 po × 3 po)`, flex: "F0" }], "contrainte");
/* f10 / f1 — the swap connector : its LV power contacts (12 V) and its signal contacts ; the module itself by its tap on the B+ busbar */
addBlock(b, "conn_power", { v: 12, i: 6 }, { parent: f10 }); addBlock(b, "input_protection", { v: 12, i: 6 }, { parent: f1 });
addBlock(b, "conn_power", { v: 34, i: 1 }, { parent: f1 }); addBlock(b, "input_protection", { v: 34, i: 1 }, { parent: f1 });
addBlock(b, "power_or", { va: 34, vb: 12, i: 0.5 }, { parent: f1 });
addBlock(b, "buck", { vin: 34, vout: 5, iout: 1 }, { parent: f1, connect: { VIN: "VSYS" } }); addBlock(b, "ldo", { vin: 5, vout: 3.3, iout: 0.2 }, { parent: f1 }); addBlock(b, "supervisor", { vdd: 3.3 }, { parent: f1 });
addBlock(b, "din", { vin: 12, vdd: 3.3, name: "WAKE" }, { parent: f1 });
addBlock(b, "vbus_sense", { vbus: 34, vdd: 3.3 }, { parent: f3 });
/* f2 — the chain of the CORE boards, unchanged */
/* JP, 27 novembre, par menu : without the 12 V the CORE boards are silent — the isolated supply of their bus side takes the 12 V */
addBlock(b, "dcdc_iso", { vin: 12, vout: 5 }, { parent: f2, connect: { VIN: "+12V" } }); addBlock(b, "iso_digital", { v1: 3.3, v2: 5, uart: 1 }, { parent: f2 });
addBlock(b, "rs485", { term: 1, bias: 1, prot: 1, conn: 0, nodes: 9, iso: 1, vdd: 5 }, { parent: f2 });
addBlock(b, "conn_wire", { signals: "RS485_A,RS485_B,+5V_ISO,GND_ISO" }, { parent: f2 });
/* f3 — the taps on the busbars : the shunt by its two Kelvin leads, the output voltage after the contactor, the NTC of the output terminal */
addBlock(b, "conn_wire", { signals: "SHUNT_P,SHUNT_N,VOUT_TAP,NTC0,GND" }, { parent: f3 }); addBlock(b, "shunt", { ext: 1, imax: 400, vbus: 34, vdd: 3.3, gain: 100 }, { parent: f3 });
addBlock(b, "vbus_sense", { vbus: 34, vdd: 3.3 }, { parent: f3, connect: { VBUS: "VOUT_TAP" } }); addBlock(b, "ntc", { vref: 3.3, fc: 10, remote: 1 }, { parent: f3 });
/* f4 — contactor, precharge, pyrofuse : the coils and the squib on the 12 V of the connector — the contactor only closes when plugged */
addBlock(b, "load_switch", { v: 12, i: 1, name: "CONTACTEUR" }, { parent: f4 }); addBlock(b, "load_switch", { v: 12, i: 0.5, name: "PRECHARGE" }, { parent: f4 });
addBlock(b, "load_switch", { v: 12, i: 2, name: "PYRO" }, { parent: f4 }); addBlock(b, "din", { vin: 12, vdd: 3.3, name: "AUX" }, { parent: f4 });
/* f9 — the cooling : the pump of the liquid loop and the fan of its radiator, each its low-side switch on the 12 V */
addBlock(b, "load_switch", { v: 12, i: 2, name: "PUMP" }, { parent: f9 }); addBlock(b, "load_switch", { v: 12, i: 1, name: "FAN" }, { parent: f9 });
/* f5 — CAN FD, isolated : its own isolated supply and its own isolator, the transceiver on the far side ; the orders of the vehicle, wired */
addBlock(b, "dcdc_iso", { vin: 5, vout: 5 }, { parent: f5, connect: { VISO: "+5V_CISO", GNDISO: "GND_CISO" } });
addBlock(b, "iso_digital", { v1: 3.3, v2: 5, uart: 1 }, { parent: f5, connect: { INA: "CAN_TX", OUTA: "ISO_CAN_TX", INB: "GND", OUTB: "ISO_CAN_SPARE", IND: "ISO_CAN_RX", OUTD: "CAN_RX", VDD2: "+5V_CISO", GND2: "GND_CISO" } });
addBlock(b, "can", { term: 1, choke: 1, vio: 5 }, { parent: f5, connect: { VCC: "+5V_CISO", VIO: "+5V_CISO", GND: "GND_CISO", TXD: "ISO_CAN_TX", RXD: "ISO_CAN_RX" } });
addBlock(b, "din", { vin: 12, vdd: 3.3, name: "ENABLE" }, { parent: f5 }); addBlock(b, "din", { vin: 12, vdd: 3.3, name: "PRES" }, { parent: f5 }); addBlock(b, "din", { vin: 12, vdd: 3.3, name: "ACK" }, { parent: f5 });
/* f10 — the signal contacts of the swap connector : the CAN FD, the wake-up and the three wired orders */
addBlock(b, "conn_wire", { signals: "CAN_H,CAN_L,GND_CISO,WAKE_IN,ENABLE_IN,PRES_IN,ACK_IN,GND" }, { parent: f10 });
/* f6, f7, f8 */
addBlock(b, "mcu", { pins: 48, xtal: 8, vdd: 3.3 }, { parent: f6 }); addBlock(b, "eeprom", { vdd: 3.3 }, { parent: f6 });
addBlock(b, "conn_swd", {}, { parent: f7 }); addBlock(b, "test", { nets: "VSYS,+3V3,GND,GND_ISO,GND_CISO", fiducials: 3 }, { parent: f7 });
addBlock(b, "led", { v: 3.3, i: 2, color: "verte" }, { parent: f8 }); addBlock(b, "led", { v: 3.3, i: 2, color: "jaune" }, { parent: f8, connect: { IN: "LED_WARN" } });
addBlock(b, "led", { v: 3.3, i: 2, color: "rouge" }, { parent: f8, connect: { IN: "LED_FAULT" } }); addBlock(b, "buzzer", { v: 5 }, { parent: f8 });
Object.assign(b.board, { size: [W, H], layers: Number(process.argv.find((a) => a.startsWith("--layers="))?.slice(9) || 6) });
b.review = { author: "", open: [
  "Choisir et lire les composants : microcontrôleur, émetteur-récepteur CAN FD isolé, contrôleur de diode idéale (au lieu des deux Schottky), pilote d'amorce du pyrofusible, amplificateur du shunt — leurs brochages sont ceux des séries génériques de l'outil, la fiche du composant monté fait foi.",
  "Le logiciel du module ne commande pas encore la précharge ni le pyrofusible : ajouter leurs blocs et leur séquence (précharge jusqu'à 90 à 95 % de la tension du module, puis le contacteur : TI SLVAF35A § 3, Références).",
  "Le contacteur ne se ferme que si le 12 V du connecteur est présent (ses bobines sont sur le 12 V) : à confirmer avec le véhicule et la borne.",
  "Valeurs d'exemple : réseau 12 V de 9 à 16 V, plage de courant ± 400 A, shunt de la barre, CAN FD à 500 kbit/s / 2 Mbit/s.",
  "Connecteur d'échange combiné LV + HV (JP, 27 novembre) : la bibliothèque n'a pas cette pièce — la carte porte ses contacts LV en deux blocs (12 V de puissance, signaux), ses contacts HV sont sur les barres, par des découpes non dessinées ; la série du commerce est à choisir et à lire.",
  "La tension de sortie (après le contacteur) servira à la précharge et à une seconde détection du contacteur collé ; le flux des 8 CORE, l'état et l'énergie comptée (EFC) partent au véhicule par le CAN FD : les blocs logiciels qui le font sont à venir.",
  "Pompe et ventilateur : 2 A et 1 A sur le 12 V (exemples) ; la CTN de la borne de sortie est collée sur la barre, à préciser avec la mécanique.",
  "Standby sans 12 V (JP, par menu, 27 novembre : les CORE boards sont silent) : seule cette carte tire alors sur le module — chiffrer ce standby current. Le DC-DC isolé du bus side prend le 12 V (9 à 16 V) : un module unregulated suit son entrée — en choisir un à wide input et sortie regulated, et lire sa datasheet."], decisions: [] };
const PASSES = Number(process.argv.find((a) => a.startsWith("--passes="))?.slice(9) || 8), MS = Number(process.argv.find((a) => a.startsWith("--ms="))?.slice(5) || 300000);
const fp = floorplan(b, LIBRARY), pl = placeParts(b, LIBRARY), rt = autoroute(b, LIBRARY, { maxMs: MS, passes: PASSES, grid: Number(process.argv.find((a) => a.startsWith("--grid="))?.slice(7) || 0.25) });
const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
console.log(`blocks ${b.blocks.length}, parts ${b.parts.length}, nets ${b.nets.length} | fill ${fp.fill.toFixed(1)} | placed ${pl.placed}, failed ${pl.failed} | routed ${rt.routed}/${rt.total} in ${rt.ms} ms, ${Math.round(rt.length)} mm, ${rt.vias} vias`);
console.log("zones", zoneProblems(b, LIBRARY), "placement", placementProblems(b, LIBRARY).length, "| erc", e.summary, "| drc", d.summary);
for (const f of [...e.findings, ...d.findings].filter((x) => x.severity !== "info")) console.log("  ", f.severity, f.rule, f.message.slice(0, 170));
if (process.argv.includes("--dry")) process.exit(0);
for (const t of b.tracks) { t.pts = t.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]); delete t.auto; }
for (const v of b.vias) delete v.auto;
const text = toDwiz(b), esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const head = "/* DynamiteOrbit.ai — the central BMS board 3 in × 3 in of the module BM 8s8p, written by tools/gen_demo_bms3.mjs, from its functions to its copper, in the\n   .dwiz format. Do not edit by hand : change the generator and run it again. */";
/* three files : each source file stays under 500 lines (the board of 27 novembre 2026 has 160 parts) */
const lines = text.split("\n"), third = Math.ceil(lines.length / 3), parts = [0, 1, 2].map((k) => lines.slice(k * third, (k + 1) * third).join("\n") + (k < 2 ? "\n" : ""));
["", "2", "3"].forEach((n, k) => writeFileSync(new URL(`../web/js/demo/demo_bms3_data${n}.js`, import.meta.url), `${head}\nexport const DEMO_BMS3_${k + 1} = \`${esc(parts[k])}\`;\n`));
console.log("lines:", text.split("\n").length, "bytes:", text.length);
