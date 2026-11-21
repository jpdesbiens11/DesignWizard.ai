/* Builds the CORE board — the small board laid on the top of a CORE of 8 cells 21700 in parallel (architecture de JP, 21 novembre
   2026) — from its functions to its copper, and writes it as .dwiz text in web/js/demo/demo_core_data.js.
   Run : node tools/gen_demo_core.mjs */
import { writeFileSync } from "node:fs";
import { emptyBoard } from "../web/js/pcba/model.js";
import { addBlock, addFunction } from "../web/js/pcba/synth.js";
import { floorplan, placeParts, placementProblems, zoneProblems } from "../web/js/pcba/place.js";
import { autoroute } from "../web/js/pcba/route.js";
import { erc } from "../web/js/pcba/erc.js";
import { checkBoard } from "../web/js/pcba/drc.js";
import { LIBRARY } from "../web/js/pcba/library.js";
import { toDwiz } from "../web/js/core/dwiz.js";

const b = emptyBoard("CORE-1S8P-PCBA", "Carte de CORE 1S8P");
b.description = "Posée sur le dessus d'un CORE de 8 cellules 21700 en parallèle (2 × 4) : mesure ses 8 températures — CTN sur les rabats du flex replié en G — et sa tension, équilibre sur ordre, et répond au BMS central du boîtier par RS-485 isolé, le côté bus alimenté par le faisceau, en chaîne d'un CORE au suivant.";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("S'alimenter sur le CORE", [{ name: "Entrée", level: "3,2 à 4,2 V, le cell block 1S8P (valeurs du projet)", flex: "F0" }, { name: "Rail", level: "3,0 V, 50 mA", flex: "F1" }]);
const f2 = F("Mesurer les 8 températures", [{ name: "Capteurs", level: "8 CTN 10 kΩ, une sous chaque cellule, sur les rabats du flex", flex: "F0" }, { name: "Plage", level: "−20 à 85 °C (exemple à confirmer)", flex: "F1" }]);
const f3 = F("Mesurer la tension du CORE", [{ name: "Plage", level: "3,2 à 4,2 V", flex: "F0" }, { name: "Condition", level: "équilibrage coupé pendant la mesure", flex: "F1" }]);
const f4 = F("Équilibrer sur ordre du BMS central", [{ name: "Purge", level: "≈ 90 mA à 4,2 V (exemple à confirmer)", flex: "F1" }]);
const f5 = F("Calculer et répondre", [{ name: "Liaison", level: "UART, une réponse par tour du BMS central", flex: "F1" }]);
const f6 = F("Communiquer avec le BMS central", [{ name: "Bus", level: "RS-485 demi-duplex isolé, côté bus alimenté par le faisceau, en chaîne", flex: "F0" }, { name: "Terminaison", level: "au BMS central et au bout de la chaîne, pas sur chaque carte", flex: "F1" }]);
const f7 = F("Être testable et programmable", [{ name: "Accès", level: "connecteur de programmation, points de test des deux côtés de la barrière", flex: "F1" }]);
F("Tenir sur le dessus du CORE", [{ name: "Carte", level: "92,8 × 46,4 mm, à l'enveloppe d'une 21700 (Ø 21,7 mm)", flex: "F0" }], "contrainte");
F("Une seule variante pour les 8 CORE", [{ name: "Adresse", level: "écrite en mémoire à l'assemblage, vérifiée au démarrage par le BMS central", flex: "F1" }], "contrainte");
const NTC = Array.from({ length: 8 }, (_, i) => `NTC${i}`).join(",");
addBlock(b, "conn_wire", { signals: `+4V2,+4V2,${NTC},GND,GND`, flex: 1 }, { parent: f1 });
addBlock(b, "ldo", { vin: 4.2, vout: 3.0, iout: 0.05 }, { parent: f1 });
for (let i = 0; i < 8; i++) addBlock(b, "ntc", { vref: 3.0, fc: 10, remote: 1 }, { parent: f2 });
addBlock(b, "vbus_sense", { vbus: 4.2, vdd: 3.0 }, { parent: f3 });
addBlock(b, "balance", { v: 4.2, i: 100 }, { parent: f4 });
addBlock(b, "mcu", { pins: 48, xtal: 8, vdd: 3.0 }, { parent: f5 });
addBlock(b, "iso_digital", { v1: 3.0, v2: 5, uart: 1 }, { parent: f6 });
addBlock(b, "rs485", { term: 0, bias: 0, prot: 1, conn: 0, nodes: 9, iso: 1, vdd: 5 }, { parent: f6 });
addBlock(b, "conn_wire", { signals: "RS485_A,RS485_B,+5V_ISO,GND_ISO" }, { parent: f6 });
addBlock(b, "conn_wire", { signals: "RS485_A,RS485_B,+5V_ISO,GND_ISO" }, { parent: f6 });
addBlock(b, "conn_swd", {}, { parent: f7 }); addBlock(b, "test", { nets: "+4V2,+3V,GND,+5V_ISO,GND_ISO,RS485_A,RS485_B", fiducials: 3 }, { parent: f7 });
Object.assign(b.board, { size: [92.8, 46.4], layers: 4 });      // four layers, no plane : a ground plane would run under the isolation barrier
b.review = { author: "", open: [
  "Choisir et lire les composants : microcontrôleur (≥ 10 voies de conversion sous 3,0 V), isolateur, émetteur-récepteur, régulateur — leurs brochages sont ceux des séries génériques de l'outil, la fiche du composant monté fait foi.",
  "Dimensionner la barrière et la distance de fuite à la tension du pack, pas à celle du CORE.",
  "Valeurs d'exemple : purge de 100 mA, plage de températures, filtre des CTN à 10 Hz."], decisions: [] };
const fp = floorplan(b, LIBRARY), pl = placeParts(b, LIBRARY), rt = autoroute(b, LIBRARY, { maxMs: 240000, passes: 8 });
const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
console.log(`blocks ${b.blocks.length}, parts ${b.parts.length}, nets ${b.nets.length} | fill ${fp.fill.toFixed(1)} | placed ${pl.placed}, failed ${pl.failed} | routed ${rt.routed}/${rt.total} in ${rt.ms} ms, ${Math.round(rt.length)} mm, ${rt.vias} vias`);
console.log("zones", zoneProblems(b, LIBRARY), "placement", placementProblems(b, LIBRARY).length, "| erc", e.summary, "| drc", d.summary);
for (const f of [...e.findings, ...d.findings].filter((x) => x.severity !== "info")) console.log("  ", f.severity, f.rule, f.message.slice(0, 170));
if (process.argv.includes("--dry")) process.exit(0);
for (const t of b.tracks) { t.pts = t.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]); delete t.auto; }
for (const v of b.vias) delete v.auto;
const text = toDwiz(b), esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const head = "/* DesignWizard.ai — the CORE board, written by tools/gen_demo_core.mjs : the small board laid on the top of a CORE of 8 cells\n   21700 in parallel, from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */";
const lines = text.split("\n"), half = Math.ceil(lines.length / 2), parts = [lines.slice(0, half).join("\n") + "\n", lines.slice(half).join("\n")];      // two files : each source file stays under 500 lines
writeFileSync(new URL("../web/js/demo/demo_core_data.js", import.meta.url), `${head}\nexport const DEMO_CORE_1 = \`${esc(parts[0])}\`;\n`);
writeFileSync(new URL("../web/js/demo/demo_core_data2.js", import.meta.url), `${head}\nexport const DEMO_CORE_2 = \`${esc(parts[1])}\`;\n`);
console.log("lines:", text.split("\n").length, "bytes:", text.length);
