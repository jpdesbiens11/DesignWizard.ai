/* Builds the demonstration board — the control board of the compact drive — from its functions to its copper, and
   writes it as .dwiz text in web/js/demo/demo_pcba_data.js. Run : node tools/gen_demo_pcba.mjs */
import { writeFileSync } from "node:fs";
import { emptyBoard } from "../web/js/pcba/model.js";
import { addBlock, addFunction } from "../web/js/pcba/synth.js";
import { inheritFromPart } from "../web/js/pcba/twin.js";
import { floorplan, placeParts, placementProblems, zoneProblems } from "../web/js/pcba/place.js";
import { autoroute } from "../web/js/pcba/route.js";
import { erc } from "../web/js/pcba/erc.js";
import { checkBoard } from "../web/js/pcba/drc.js";
import { LIBRARY } from "../web/js/pcba/library.js";
import { DEMO_DRIVE } from "../web/js/demo/demo_drive.js";
import { toDwiz } from "../web/js/core/dwiz.js";

const b = emptyBoard("DRV-CTRL-PCBA", "Carte de contrôle du variateur");
b.description = "Reçoit le 24 V, alimente la logique, calcule et pilote l'étage de puissance, mesure la température et le mouvement, communique en CAN.";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("Alimenter la logique à partir du 24 V", [{ name: "Tension d'entrée", level: "18 à 30 V", flex: "F0" }, { name: "Rails", level: "5 V 1 A ; 3,3 V 0,3 A", flex: "F1" }]);
const f2 = F("Calculer et piloter l'étage de puissance", [{ name: "Fréquence de découpage", level: "20 kHz", flex: "F1" }]);
const f3 = F("Communiquer avec le système", [{ name: "Bus", level: "CAN 500 kbit/s, terminaison commutable", flex: "F1" }]);
const f4 = F("Mesurer la température et le mouvement", [{ name: "Température", level: "−20 à 100 °C, ± 2 K", flex: "F1" }]);
const f5 = F("Signaler l'état", [{ name: "Témoin", level: "visible capot fermé", flex: "F2" }]);
const f6 = F("Être testable, programmable et fabricable en prototype rapide", [{ name: "Délai", level: "carte montée en 10 jours ouvrables", flex: "F1" }]);
F("Tenir dans le boîtier", [{ name: "Carte", level: "60 × 90 mm, 4 vis M3, composants ≤ 9 mm", flex: "F0" }], "contrainte");
F("Résister à l'environnement", [{ name: "Vernis", level: "acrylique 50 µm, deux faces", flex: "F1" }], "contrainte");
addBlock(b, "conn_io", { signals: "+24V_IN,GND,CAN_H,CAN_L" }, { parent: f3 });
addBlock(b, "input_protection", { v: 24, i: 1 }, { parent: f1 }); addBlock(b, "buck", { vin: 24, vout: 5, iout: 1 }, { parent: f1 }); addBlock(b, "ldo", { vin: 5, vout: 3.3, iout: 0.3 }, { parent: f1 });
addBlock(b, "mcu", { pins: 48, xtal: 8 }, { parent: f2 }); addBlock(b, "conn_board", { signals: "+5V,GND,PWM_H,PWM_L,AIN1,AIN2,DOUT0,GND" }, { parent: f2 });
addBlock(b, "can", { term: 1, choke: 0 }, { parent: f3 }); addBlock(b, "ntc", { fc: 100 }, { parent: f4 }); addBlock(b, "imu", {}, { parent: f4 }); addBlock(b, "led", { color: "verte" }, { parent: f5 });
addBlock(b, "conn_swd", {}, { parent: f6 }); addBlock(b, "test", { nets: "+24V,+5V,+3V3,GND", fiducials: 3 }, { parent: f6 });
inheritFromPart(b, DEMO_DRIVE.parts.find((p) => p.id === "DRV-CTRL-PCB"));
Object.assign(b.board, { layers: 4, coating: { type: "AR", thickness: 50, sides: "both" } });
b.planes = [{ net: "GND", layer: "in1" }, { net: "+3V3", layer: "in2" }];
b.review = { author: "", open: ["Choisir la référence exacte du microcontrôleur et de l'émetteur-récepteur CAN."], decisions: [] };
const fp = floorplan(b, LIBRARY), pl = placeParts(b, LIBRARY), rt = autoroute(b, LIBRARY, { maxMs: 120000, passes: 4 });
const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
console.log(`blocks ${b.blocks.length}, parts ${b.parts.length}, nets ${b.nets.length} | fill ${fp.fill.toFixed(1)} | placed ${pl.placed}, failed ${pl.failed} | routed ${rt.routed}/${rt.total} in ${rt.ms} ms, ${Math.round(rt.length)} mm, ${rt.vias} vias`);
console.log("zones", zoneProblems(b, LIBRARY), "placement", placementProblems(b, LIBRARY).length, "| erc", e.summary, "| drc", d.summary);
for (const f of [...e.findings, ...d.findings].filter((x) => x.severity !== "info")) console.log("  ", f.severity, f.rule, f.message.slice(0, 160));
for (const t of b.tracks) { t.pts = t.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]); delete t.auto; }
for (const v of b.vias) delete v.auto;
const text = toDwiz(b), lines = text.split("\n"), cut = lines.findIndex((l) => l.startsWith("# Le cuivre"));
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const head = "/* DynamiteOrbit — the demonstration board, written by tools/gen_demo_pcba.mjs : the control board of the compact drive,\n   from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */\n";
writeFileSync(new URL("../web/js/demo/demo_pcba_data.js", import.meta.url), `${head}\nexport const DEMO_PCBA_DESIGN = \`${esc(lines.slice(0, cut).join("\n"))}\`;\n`);
writeFileSync(new URL("../web/js/demo/demo_pcba_copper.js", import.meta.url), `${head}\nexport const DEMO_PCBA_COPPER = \`${esc(lines.slice(cut).join("\n"))}\`;\n`);
console.log("lines:", cut, lines.length - cut);
