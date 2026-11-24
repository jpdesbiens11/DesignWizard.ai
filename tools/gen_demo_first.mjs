/* Builds the first board of the Labo — a coin cell, two buttons, a red LED and a yellow LED (point 4 of the roadmap) — from its functions to its
   copper, and writes it as .dwiz text in web/js/demo/demo_first_data.js. Each button lights its LED by itself : no microcontroller, nothing to
   program ; what one learns is the circuit, the measurements and the order that protects a board. Run : node tools/gen_demo_first.mjs */
import { writeFileSync } from "node:fs";
import { emptyBoard } from "../web/js/pcba/model.js";
import { addBlock, addFunction } from "../web/js/pcba/synth.js";
import { floorplan, placeParts, placementProblems, zoneProblems } from "../web/js/pcba/place.js";
import { autoroute } from "../web/js/pcba/route.js";
import { erc } from "../web/js/pcba/erc.js";
import { checkBoard } from "../web/js/pcba/drc.js";
import { LIBRARY } from "../web/js/pcba/library.js";
import { toDwiz } from "../web/js/core/dwiz.js";

const b = emptyBoard("FIRST-PCBA", "Première carte : une pile, deux boutons, deux DEL");
b.description = "La carte la plus simple du Labo : une pile bouton, et deux boutons qui allument chacun leur DEL — rouge pour S1, jaune pour S2. Rien à programmer : on y apprend le circuit, les mesures, et l'ordre qui protège une carte.";
const F = (name, criteria = [], kind = "principale") => addFunction(b, { name, kind, criteria });
const f1 = F("Alimenter la carte par une pile", [{ name: "Source", level: "pile bouton CR2032, 3 V", flex: "F1" }, { name: "Consommation au repos", level: "aucune", flex: "F0" }]);
const f2 = F("Allumer la DEL rouge tant que l'on appuie sur S1", [{ name: "Courant", level: "2 mA", flex: "F1" }]);
const f3 = F("Allumer la DEL jaune tant que l'on appuie sur S2", [{ name: "Courant", level: "2 mA", flex: "F1" }]);
const f4 = F("Être mesurable par un débutant", [{ name: "Accès", level: "points de test sur la pile et la masse", flex: "F1" }]);
F("Tenir dans la main", [{ name: "Carte", level: "50 × 34 mm, deux couches", flex: "F1" }], "contrainte");
addBlock(b, "battery", { v: 3, i: 4 }, { parent: f1 });
addBlock(b, "push_led", { v: 3, i: 2, color: "rouge", name: "S1" }, { parent: f2 });
addBlock(b, "push_led", { v: 3, i: 2, color: "jaune", name: "S2" }, { parent: f3 });
addBlock(b, "test", { nets: "+3V,GND", fiducials: 3 }, { parent: f4 });
Object.assign(b.board, { size: [50, 34], layers: 2 });
b.review = { author: "", open: ["Vérifier sur la fiche de la DEL choisie sa tension directe à 2 mA : la résistance en dépend.", "Vérifier sur la fiche de la pile son courant continu admissible."], decisions: [] };
const fp = floorplan(b, LIBRARY), pl = placeParts(b, LIBRARY), rt = autoroute(b, LIBRARY, { maxMs: 60000, passes: 4 });
const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
console.log(`blocks ${b.blocks.length}, parts ${b.parts.length}, nets ${b.nets.length} | fill ${fp.fill.toFixed(1)} | placed ${pl.placed}, failed ${pl.failed} | routed ${rt.routed}/${rt.total} in ${rt.ms} ms, ${Math.round(rt.length)} mm, ${rt.vias} vias`);
console.log("zones", zoneProblems(b, LIBRARY), "placement", placementProblems(b, LIBRARY).length, "| erc", e.summary, "| drc", d.summary);
for (const f of [...e.findings, ...d.findings].filter((x) => x.severity !== "info")) console.log("  ", f.severity, f.rule, f.message.slice(0, 170));
if (process.argv.includes("--dry")) process.exit(0);
for (const t of b.tracks) { t.pts = t.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]); delete t.auto; }
for (const v of b.vias) delete v.auto;
const text = toDwiz(b), esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const head = "/* DynamiteOrbit.ai — the first board of the Labo, written by tools/gen_demo_first.mjs : a coin cell, two buttons, a red LED and a yellow\n   LED, from its functions to its copper, in the .dwiz format. Do not edit by hand : change the tool and run it again. */\n";
writeFileSync(new URL("../web/js/demo/demo_first_data.js", import.meta.url), `${head}\nexport const DEMO_FIRST = \`${esc(text)}\`;\n`);
console.log("lines:", text.split("\n").length, "bytes:", text.length);
