/* Builds the central BMS board of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central interroge les cartes, juge et agit —
   contactors, état envoyé au véhicule : normal, dératé, urgence, arrêt » ; 22 novembre : « le couvercle du fond… contient peut-être le BMS »)
   — from its functions to its copper — and writes it as .dwiz text in web/js/demo/demo_bms_data.js.
   Run : node tools/gen_demo_bms.mjs   (--dry : build and check, write nothing) */
import { writeFileSync } from "node:fs";
import { emptyBoard } from "../web/js/pcba/model.js";
import { addBlock, addFunction } from "../web/js/pcba/synth.js";
import { floorplan, placeParts, placementProblems, zoneProblems } from "../web/js/pcba/place.js";
import { autoroute } from "../web/js/pcba/route.js";
import { erc } from "../web/js/pcba/erc.js";
import { checkBoard } from "../web/js/pcba/drc.js";
import { LIBRARY } from "../web/js/pcba/library.js";
import { toDwiz } from "../web/js/core/dwiz.js";

const W = Number(process.argv.find((a) => a.startsWith("--w="))?.slice(4) || 85), H = Number(process.argv.find((a) => a.startsWith("--h="))?.slice(4) || 62);
const b = emptyBoard("BMS-CENTRAL-PCBA", "BMS central du module");
b.description = "Le BMS central du module BM 8s8p : alimenté par le 12 V du véhicule, il interroge les 8 cartes de CORE par la chaîne RS-485 isolée (il en alimente le côté bus), lit le courant du module sur un capteur posé sur la barre de retour, commande le contacteur et relit son contact auxiliaire, et dit au véhicule l'état du module par CAN : normal, dératé, urgence, arrêt (contacteur ouvert).";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("S'alimenter sur le 12 V du véhicule", [{ name: "Entrée", level: "9 à 16 V, le réseau 12 V du véhicule (exemple à confirmer)", flex: "F1" }, { name: "Rails", level: "5 V, 1 A ; 3,3 V, 200 mA", flex: "F1" }]);
const f2 = F("Interroger les 8 cartes de CORE", [{ name: "Bus", level: "RS-485 demi-duplex isolé, en chaîne, 9 nœuds", flex: "F0" }, { name: "Côté bus", level: "alimenté par cette carte, 5 V isolés, 1 W", flex: "F0" }, { name: "Terminaison", level: "ici et au bout de la chaîne (borne + du module)", flex: "F0" }]);
const f3 = F("Lire le courant du module", [{ name: "Capteur", level: "capteur à effet Hall en boucle fermée sur la barre de retour, hors carte, sortie analogique (exemple)", flex: "F1" }, { name: "Plage", level: "± 400 A (exemple à confirmer)", flex: "F1" }]);
const f4 = F("Commander le contacteur", [{ name: "Bobine", level: "12 V, 1 A au plus (enveloppe générique, fiche non lue)", flex: "F1" }, { name: "Relecture", level: "contact auxiliaire, entrée protégée", flex: "F0" }]);
const f5 = F("Dire l'état au véhicule", [{ name: "Liaison", level: "CAN, 500 kbit/s (exemple)", flex: "F1" }, { name: "États", level: "normal, dératé, urgence, arrêt", flex: "F0" }]);
const f6 = F("Juger et décider", [{ name: "Calcul", level: "microcontrôleur, la machine à états du module", flex: "F1" }, { name: "Mémoire", level: "réglages et journal des défauts", flex: "F1" }]);
const f7 = F("Être testable et programmable", [{ name: "Accès", level: "connecteur de programmation, points de test, témoin", flex: "F1" }]);
F("Tenir dans le couvercle du fond", [{ name: "Carte", level: `${W} × ${H} mm (exemple) : le volume réservé à l'itération 11 b, 30 × 48 mm, est trop petit`, flex: "F1" }], "contrainte");
addBlock(b, "conn_power", { v: 12, i: 2 }, { parent: f1 }); addBlock(b, "input_protection", { v: 16, i: 2 }, { parent: f1 });
addBlock(b, "buck", { vin: 12, vout: 5, iout: 1 }, { parent: f1 }); addBlock(b, "ldo", { vin: 5, vout: 3.3, iout: 0.2 }, { parent: f1 }); addBlock(b, "supervisor", { vdd: 3.3 }, { parent: f1 });
addBlock(b, "dcdc_iso", { vin: 5, vout: 5 }, { parent: f2 }); addBlock(b, "iso_digital", { v1: 3.3, v2: 5, uart: 1 }, { parent: f2 });
addBlock(b, "rs485", { term: 1, bias: 1, prot: 1, conn: 0, nodes: 9, iso: 1, vdd: 5 }, { parent: f2 });
addBlock(b, "conn_wire", { signals: "RS485_A,RS485_B,+5V_ISO,GND_ISO" }, { parent: f2 });
addBlock(b, "conn_wire", { signals: "+5V,ISENSE,GND" }, { parent: f3 }); addBlock(b, "amp", { gain: 1, fc: 100, vdd: 3.3, name: "ISENSE" }, { parent: f3 });
addBlock(b, "load_switch", { v: 12, i: 1, name: "CONTACTEUR" }, { parent: f4 }); addBlock(b, "din", { vin: 12, vdd: 3.3, name: "AUX" }, { parent: f4 });
addBlock(b, "can", { term: 1, choke: 1, vio: 3.3 }, { parent: f5 });
addBlock(b, "mcu", { pins: 48, xtal: 8, vdd: 3.3 }, { parent: f6 }); addBlock(b, "eeprom", { vdd: 3.3 }, { parent: f6 });
addBlock(b, "conn_swd", {}, { parent: f7 }); addBlock(b, "led", { v: 3.3, i: 2, color: "verte" }, { parent: f7 });
addBlock(b, "test", { nets: "+12V,+5V,+3V3,GND,+5V_ISO,GND_ISO,RS485_A,RS485_B", fiducials: 3 }, { parent: f7 });
Object.assign(b.board, { size: [W, H], layers: 4 });
b.review = { author: "", open: [
  "Le volume réservé dans le couvercle du fond (30 × 48 mm, itération 11 b) ne reçoit pas cette carte : agrandir le logement, ou mettre la carte le long du boîtier.",
  "Choisir et lire les composants : microcontrôleur, émetteur-récepteur CAN, alimentation isolée, capteur de courant de la barre de retour — leurs brochages sont ceux des séries génériques de l'outil, la fiche du composant monté fait foi.",
  "Le seuil de dératation vient du calcul du module fermé (95 A en continu dans l'air calme, itération 13) : à confirmer par un essai.",
  "Valeurs d'exemple : réseau 12 V de 9 à 16 V, plage de courant ± 400 A, CAN à 500 kbit/s."], decisions: [] };
const PASSES = Number(process.argv.find((a) => a.startsWith("--passes="))?.slice(9) || 8), MS = Number(process.argv.find((a) => a.startsWith("--ms="))?.slice(5) || 300000);
const fp = floorplan(b, LIBRARY), pl = placeParts(b, LIBRARY), rt = autoroute(b, LIBRARY, { maxMs: MS, passes: PASSES });
const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
console.log(`blocks ${b.blocks.length}, parts ${b.parts.length}, nets ${b.nets.length} | fill ${fp.fill.toFixed(1)} | placed ${pl.placed}, failed ${pl.failed} | routed ${rt.routed}/${rt.total} in ${rt.ms} ms, ${Math.round(rt.length)} mm, ${rt.vias} vias`);
console.log("zones", zoneProblems(b, LIBRARY), "placement", placementProblems(b, LIBRARY).length, "| erc", e.summary, "| drc", d.summary);
for (const f of [...e.findings, ...d.findings].filter((x) => x.severity !== "info")) console.log("  ", f.severity, f.rule, f.message.slice(0, 170));
if (process.argv.includes("--dry")) process.exit(0);
for (const t of b.tracks) { t.pts = t.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]); delete t.auto; }
for (const v of b.vias) delete v.auto;
const text = toDwiz(b), esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const head = "/* DynamiteOrbit — the central BMS board of the module BM 8s8p, written by tools/gen_demo_bms.mjs, from its functions to its copper, in the\n   .dwiz format. Do not edit by hand : change the generator and run it again. */";
const lines = text.split("\n"), half = Math.ceil(lines.length / 2), parts = [lines.slice(0, half).join("\n") + "\n", lines.slice(half).join("\n")];      // two files : each source file stays under 500 lines
writeFileSync(new URL("../web/js/demo/demo_bms_data.js", import.meta.url), `${head}\nexport const DEMO_BMS_1 = \`${esc(parts[0])}\`;\n`);
writeFileSync(new URL("../web/js/demo/demo_bms_data2.js", import.meta.url), `${head}\nexport const DEMO_BMS_2 = \`${esc(parts[1])}\`;\n`);
console.log("lines:", text.split("\n").length, "bytes:", text.length);
