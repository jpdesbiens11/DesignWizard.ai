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
   alimentation par le module ou le 12 V, le premier présent. Les usages de l'industrie que l'outil suit sont dans Logiciel › Références. */
const b = emptyBoard("BMS-CENTRAL-3X3", "BMS central 3 po × 3 po");
b.description = "Le BMS central du module BM 8s8p, 3 po × 3 po au plus, dans le couvercle du bas : vit sur le module ou sur le 12 V du véhicule (le premier présent), interroge les 8 cartes de CORE par la chaîne RS-485 isolée (il en alimente le côté bus), lit le courant du module sur le shunt de la barre de retour, autorise la charge et la décharge, commande le contacteur, sa précharge et le pyrofusible au bout du BM, et parle au véhicule et à la borne par CAN FD isolé.";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("Vivre sur le module ou sur le 12 V, le premier présent", [{ name: "Sources", level: "le module (8S : 24 à 34 V) ou le 12 V du véhicule ou de la borne (9 à 16 V, exemple à confirmer)", flex: "F1" }, { name: "Réveil", level: "par le véhicule ou la borne (ligne WAKE)", flex: "F1" }, { name: "Rails", level: "5 V, 1 A ; 3,3 V, 200 mA", flex: "F1" }]);
const f2 = F("Collecter la chaîne RS-485 des 8 cartes de CORE", [{ name: "Bus", level: "RS-485 demi-duplex isolé, en chaîne, 9 nœuds", flex: "F0" }, { name: "Côté bus", level: "alimenté par cette carte, 5 V isolés, 1 W", flex: "F0" }, { name: "Terminaison", level: "ici, à un bout de la chaîne", flex: "F0" }]);
const f3 = F("Lire le courant du module sur le shunt de la barre", [{ name: "Shunt", level: "pièce de la barre de retour, deux fils Kelvin vers la carte", flex: "F1" }, { name: "Plage", level: "± 400 A (360 A en décharge, 72 A en charge ; exemple)", flex: "F1" }]);
const f4 = F("Autoriser l'énergie : contacteur, précharge, pyrofusible", [{ name: "Contacteur", level: "bobine 12 V, 1 A au plus (enveloppe générique, fiche non lue)", flex: "F1" }, { name: "Précharge", level: "relais et résistance : le bus du véhicule chargé avant la fermeture du contacteur", flex: "F1" }, { name: "Pyrofusible", level: "amorce commandée par la carte en cas d'urgence, impulsion (exemple, fiche non lue)", flex: "F1" }, { name: "Relecture", level: "contact auxiliaire, entrée protégée", flex: "F0" }]);
const f5 = F("Parler au véhicule et à la borne", [{ name: "Liaison", level: "CAN FD isolé (exemple : 500 kbit/s, 2 Mbit/s en phase de données)", flex: "F1" }, { name: "États", level: "normal, dératé, urgence, arrêt ; demande de courant", flex: "F0" }]);
const f6 = F("Juger et décider", [{ name: "Calcul", level: "microcontrôleur : la machine à états du module, l'équilibrage commandé aux CORE", flex: "F1" }, { name: "Mémoire", level: "réglages et journal des défauts", flex: "F1" }]);
const f7 = F("Être testable et programmable", [{ name: "Accès", level: "connecteur de programmation, points de test, témoin", flex: "F1" }]);
F("Tenir dans le couvercle du bas", [{ name: "Carte", level: `${W} × ${H} mm au plus (3 po × 3 po)`, flex: "F0" }], "contrainte");
/* f1 — the two sources, each protected, joined by the first-present block ; the logic lives on VSYS, the coils on the 12 V */
addBlock(b, "conn_power", { v: 12, i: 3 }, { parent: f1 }); addBlock(b, "input_protection", { v: 12, i: 3 }, { parent: f1 });
addBlock(b, "conn_power", { v: 34, i: 1 }, { parent: f1 }); addBlock(b, "input_protection", { v: 34, i: 1 }, { parent: f1 });
addBlock(b, "power_or", { va: 34, vb: 12, i: 0.5 }, { parent: f1 });
addBlock(b, "buck", { vin: 34, vout: 5, iout: 1 }, { parent: f1, connect: { VIN: "VSYS" } }); addBlock(b, "ldo", { vin: 5, vout: 3.3, iout: 0.2 }, { parent: f1 }); addBlock(b, "supervisor", { vdd: 3.3 }, { parent: f1 });
addBlock(b, "din", { vin: 12, vdd: 3.3, name: "WAKE" }, { parent: f1 });
addBlock(b, "vbus_sense", { vbus: 34, vdd: 3.3 }, { parent: f1 });
/* f2 — the chain of the CORE boards, unchanged */
addBlock(b, "dcdc_iso", { vin: 5, vout: 5 }, { parent: f2 }); addBlock(b, "iso_digital", { v1: 3.3, v2: 5, uart: 1 }, { parent: f2 });
addBlock(b, "rs485", { term: 1, bias: 1, prot: 1, conn: 0, nodes: 9, iso: 1, vdd: 5 }, { parent: f2 });
addBlock(b, "conn_wire", { signals: "RS485_A,RS485_B,+5V_ISO,GND_ISO" }, { parent: f2 });
/* f3 — the shunt of the return busbar, read by its two Kelvin leads */
addBlock(b, "conn_wire", { signals: "SHUNT_P,SHUNT_N" }, { parent: f3 }); addBlock(b, "shunt", { ext: 1, imax: 400, vbus: 34, vdd: 3.3, gain: 100 }, { parent: f3 });
/* f4 — contactor, precharge, pyrofuse : the coils and the squib on the 12 V of the connector — the contactor only closes when plugged */
addBlock(b, "load_switch", { v: 12, i: 1, name: "CONTACTEUR" }, { parent: f4 }); addBlock(b, "load_switch", { v: 12, i: 0.5, name: "PRECHARGE" }, { parent: f4 });
addBlock(b, "load_switch", { v: 12, i: 2, name: "PYRO" }, { parent: f4 }); addBlock(b, "din", { vin: 12, vdd: 3.3, name: "AUX" }, { parent: f4 });
/* f5 — CAN FD, isolated : its own isolated supply and its own isolator, the transceiver on the far side */
addBlock(b, "dcdc_iso", { vin: 5, vout: 5 }, { parent: f5, connect: { VISO: "+5V_CISO", GNDISO: "GND_CISO" } });
addBlock(b, "iso_digital", { v1: 3.3, v2: 5, uart: 1 }, { parent: f5, connect: { INA: "CAN_TX", OUTA: "ISO_CAN_TX", INB: "GND", OUTB: "ISO_CAN_SPARE", IND: "ISO_CAN_RX", OUTD: "CAN_RX", VDD2: "+5V_CISO", GND2: "GND_CISO" } });
addBlock(b, "can", { term: 1, choke: 1, vio: 5 }, { parent: f5, connect: { VCC: "+5V_CISO", VIO: "+5V_CISO", GND: "GND_CISO", TXD: "ISO_CAN_TX", RXD: "ISO_CAN_RX" } });
addBlock(b, "conn_wire", { signals: "CAN_H,CAN_L,GND_CISO,WAKE_IN" }, { parent: f5 });
/* f6, f7 */
addBlock(b, "mcu", { pins: 48, xtal: 8, vdd: 3.3 }, { parent: f6 }); addBlock(b, "eeprom", { vdd: 3.3 }, { parent: f6 });
addBlock(b, "conn_swd", {}, { parent: f7 }); addBlock(b, "led", { v: 3.3, i: 2, color: "verte" }, { parent: f7 });
addBlock(b, "test", { nets: "VSYS,+3V3,GND,GND_ISO,GND_CISO", fiducials: 3 }, { parent: f7 });
Object.assign(b.board, { size: [W, H], layers: 4 });
b.review = { author: "", open: [
  "Choisir et lire les composants : microcontrôleur, émetteur-récepteur CAN FD isolé, contrôleur de diode idéale (au lieu des deux Schottky), pilote d'amorce du pyrofusible, amplificateur du shunt — leurs brochages sont ceux des séries génériques de l'outil, la fiche du composant monté fait foi.",
  "Le logiciel du module ne commande pas encore la précharge ni le pyrofusible : ajouter leurs blocs et leur séquence (précharge jusqu'à 90 à 95 % de la tension du module, puis le contacteur : TI SLVAF35A § 3, Références).",
  "Le contacteur ne se ferme que si le 12 V du connecteur est présent (ses bobines sont sur le 12 V) : à confirmer avec le véhicule et la borne.",
  "Valeurs d'exemple : réseau 12 V de 9 à 16 V, plage de courant ± 400 A, shunt de la barre, CAN FD à 500 kbit/s / 2 Mbit/s."], decisions: [] };
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
const lines = text.split("\n"), half = Math.ceil(lines.length / 2), parts = [lines.slice(0, half).join("\n") + "\n", lines.slice(half).join("\n")];      // two files : each source file stays under 500 lines
writeFileSync(new URL("../web/js/demo/demo_bms3_data.js", import.meta.url), `${head}\nexport const DEMO_BMS3_1 = \`${esc(parts[0])}\`;\n`);
writeFileSync(new URL("../web/js/demo/demo_bms3_data2.js", import.meta.url), `${head}\nexport const DEMO_BMS3_2 = \`${esc(parts[1])}\`;\n`);
console.log("lines:", text.split("\n").length, "bytes:", text.length);
