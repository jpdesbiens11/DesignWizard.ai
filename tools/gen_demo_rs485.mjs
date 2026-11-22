/* Builds the RS-485 example board — a small measuring node that answers on an RS-485 bus — from its functions to its
   copper, and writes it as .dwiz text in web/js/demo/demo_rs485_data.js. Run : node tools/gen_demo_rs485.mjs */
import { writeFileSync } from "node:fs";
import { emptyBoard } from "../web/js/pcba/model.js";
import { addBlock, addFunction } from "../web/js/pcba/synth.js";
import { floorplan, placeParts, placementProblems, zoneProblems } from "../web/js/pcba/place.js";
import { autoroute } from "../web/js/pcba/route.js";
import { erc } from "../web/js/pcba/erc.js";
import { checkBoard } from "../web/js/pcba/drc.js";
import { LIBRARY } from "../web/js/pcba/library.js";
import { toDwiz } from "../web/js/core/dwiz.js";

const b = emptyBoard("NODE-485-PCBA", "Nœud de mesure RS-485");
b.description = "Reçoit le 5 V, mesure une température, et répond sur un bus RS-485 demi-duplex (MODBUS RTU, 19 200 bit/s) : l'exemple de la liaison, du bornier au pilote.";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("Alimenter la logique à partir du 5 V", [{ name: "Rail", level: "3,3 V 0,2 A", flex: "F1" }]);
const f2 = F("Calculer et tenir la liaison", [{ name: "Liaison", level: "UART 19 200 bit/s, 8 bits, parité paire", flex: "F1" }]);
const f3 = F("Communiquer sur le bus RS-485", [{ name: "Bus", level: "demi-duplex, 8 nœuds, terminaison et polarisation sur cette carte", flex: "F1" }, { name: "Protocole", level: "MODBUS RTU (exemple)", flex: "F2" }]);
const f4 = F("Mesurer une température", [{ name: "Plage", level: "−20 à 100 °C, ± 2 K", flex: "F1" }]);
const f5 = F("Signaler l'état", [{ name: "Témoin", level: "visible", flex: "F2" }]);
const f6 = F("Être testable et programmable", [{ name: "Accès", level: "connecteur de programmation, points de test sur les rails et le bus", flex: "F1" }]);
F("Tenir sur une petite carte", [{ name: "Carte", level: "54 × 44 mm", flex: "F1" }], "contrainte");
addBlock(b, "conn_io", { signals: "+5V,GND" }, { parent: f1 }); addBlock(b, "ldo", { vin: 5, vout: 3.3, iout: 0.2 }, { parent: f1 });
addBlock(b, "mcu", { pins: 32, xtal: 8 }, { parent: f2 });
addBlock(b, "rs485", { term: 1, bias: 1, prot: 1, conn: 1, nodes: 8, vdd: 5 }, { parent: f3 });
addBlock(b, "ntc", { fc: 100 }, { parent: f4 }); addBlock(b, "led", { color: "verte" }, { parent: f5 });
addBlock(b, "conn_swd", {}, { parent: f6 }); addBlock(b, "test", { nets: "+5V,+3V3,GND,RS485_A,RS485_B", fiducials: 3 }, { parent: f6 });
Object.assign(b.board, { size: [54, 44], layers: 4 });
b.planes = [{ net: "GND", layer: "in1" }, { net: "+3V3", layer: "in2" }];
b.review = { author: "", open: ["Choisir la référence exacte de l'émetteur-récepteur : son brochage est celui des séries citées, sa fiche fait foi."], decisions: [] };
const fp = floorplan(b, LIBRARY), pl = placeParts(b, LIBRARY), rt = autoroute(b, LIBRARY, { maxMs: 90000, passes: 4 });
const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
console.log(`blocks ${b.blocks.length}, parts ${b.parts.length}, nets ${b.nets.length} | fill ${fp.fill.toFixed(1)} | placed ${pl.placed}, failed ${pl.failed} | routed ${rt.routed}/${rt.total} in ${rt.ms} ms, ${Math.round(rt.length)} mm, ${rt.vias} vias`);
console.log("zones", zoneProblems(b, LIBRARY), "placement", placementProblems(b, LIBRARY).length, "| erc", e.summary, "| drc", d.summary);
for (const f of [...e.findings, ...d.findings].filter((x) => x.severity !== "info")) console.log("  ", f.severity, f.rule, f.message.slice(0, 170));
for (const t of b.tracks) { t.pts = t.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]); delete t.auto; }
for (const v of b.vias) delete v.auto;
const text = toDwiz(b), esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const head = "/* DesignOrbit.ai — the RS-485 example board, written by tools/gen_demo_rs485.mjs : a small measuring node that answers on an\n   RS-485 bus, from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */\n";
writeFileSync(new URL("../web/js/demo/demo_rs485_data.js", import.meta.url), `${head}\nexport const DEMO_RS485 = \`${esc(text)}\`;\n`);
console.log("lines:", text.split("\n").length, "bytes:", text.length);
