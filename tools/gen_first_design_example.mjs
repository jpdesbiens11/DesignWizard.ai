/* Writes the worked example of a « first complete design » : the description an engineer would give, and the file an
   assistant gives back after the interview. The parts are written with the Shop companion standing in for the
   assistant, neighbour after neighbour, so that every interface key is shared and every part builds ; the board is
   given by its functions and blocks, the analyses by their inputs — exactly what the prompt asks an assistant for.
   Run : node tools/gen_first_design_example.mjs → web/js/demo/demo_first_design.js */
import { writeFileSync } from "node:fs";
import { synthesize } from "../web/js/core/shop_intent.js";
import { anticipatedInterfaces } from "../web/js/core/prompts.js";
import { fromTemplate } from "../web/js/cad/templates.js";

const DESCRIPTION = `Module de mesure de température à quatre voies pour une armoire de machine.
Quatre sondes NTC câblées arrivent sur un bornier ; le module mesure, filtre et publie les quatre températures sur un bus CAN à 500 kbit/s.
Alimentation : le 24 V de l'armoire (18 à 30 V), moins de 2 W.
Mécanique : un boîtier plastique fermé par un couvercle vissé, posé sur une platine vissée au fond de l'armoire. La carte fait 90 × 60 mm et tient par quatre vis M3. Une ouverture laisse passer le connecteur. Un voyant d'état.
Milieu : intérieur d'armoire, 0 à 60 °C, poussière, pas d'eau.
Série visée : 2 000 pièces par an ; un prototype fonctionnel en dix jours.`;

const fit = (list, test, where) => list.filter((a) => test(a.iface)).map((a) => ({ from: a.from, type: a.iface.type, name: a.iface.name, partner: a.iface.partner, key: a.iface.key, side: a.iface.side, params: a.iface.params, where }));
const housing = synthesize({ name: "Boîtier du module", fn: "Loge et protège la carte de mesure, la tient par quatre vis et se pose sur la platine.", quantity: 2000, environment: "0 à 60 °C, poussière", material: "PC-ABS", form: "molded", envelope: { L: 100, W: 68, H: 24 },
  interfaces: [{ type: "bolt_pattern", side: "B", name: "Fixation de la carte", partner: "Carte de mesure", key: "tmp_carte", where: "+Z", inside: true, params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 80, dy: 50 } } },
    { type: "cutout", side: "A", name: "Passage du connecteur", partner: "Bornier de la carte", key: "tmp_connecteur", where: "-Y", external: true, params: { shape: "rect", w: 24, h: 10, r: 1 } },
    { type: "bolt_pattern", side: "A", name: "Fixation sur la platine", partner: "Platine", key: "tmp_platine", where: "-Z", params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 1, dx: 50, dy: 0 } } }] }, "TMP-BOITIER").spec;
const free = anticipatedInterfaces({ parts: [housing], assemblies: [] }, ["TMP-BOITIER"]);
const cover = synthesize({ name: "Couvercle", fn: "Ferme le boîtier et laisse voir le voyant.", quantity: 2000, material: "PC", form: "plate", interfaces: fit(free, (i) => /couvercle/.test(i.key), "-Z") }, "TMP-COUVERCLE").spec;
const plate = synthesize({ name: "Platine de fixation", fn: "Porte le boîtier et se visse au fond de l'armoire.", quantity: 2000, loads: "Poids du module et effort des câbles : 30 N", material: "AL6061-T6", form: "plate",
  interfaces: [...fit(free, (i) => i.key === "tmp_platine", "+Z"), { type: "bolt_pattern", side: "A", name: "Fixation à l'armoire", partner: "Fond de l'armoire", key: "tmp_armoire", where: "+Z", external: true, params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 1, dx: 110, dy: 0 } } }] }, "TMP-PLATINE").spec;
const card = fromTemplate("pcb", "TMP-CARTE");
Object.assign(card, { name: "Carte de mesure", function: "Mesure quatre températures et les publie sur le bus CAN." });
card.params.L.value = 90; card.params.W.value = 60; card.params.pcbL.value = 80; card.params.pcbW.value = 50;
Object.assign(card.interfaces[0], { key: "tmp_carte", partner: "Boîtier du module" });

const answer = {
  dw: "project/1", name: "Module de température CAN", description: "Module de mesure de température à quatre voies pour armoire de machine : boîtier moulé, couvercle, platine, carte de mesure sur bus CAN.",
  brief: {
    answers: [{ q: "Où vit le produit ?", a: "Dans une armoire de machine, 0 à 60 °C, poussière, pas d'eau." }, { q: "Quelle quantité ?", a: "2 000 pièces par an : boîtier moulé par injection ; prototype usiné ou imprimé." },
      { q: "Qu'est-ce qui compte le plus ?", a: "Le coût en série, puis le délai du prototype." }, { q: "Comment se fixe-t-il ?", a: "Sur une platine en aluminium, deux vis M5 au fond de l'armoire." },
      { q: "Quelle liaison ?", a: "CAN 500 kbit/s, terminaison commutable." }, { q: "Quelles sondes ?", a: "Quatre NTC 10 kΩ, filtrées à 100 Hz." }],
    assumptions: ["Paroi de 2,5 mm en PC/ABS, classe de flamme à confirmer à cette épaisseur.", "Couvercle en polycarbonate, usiné dans une plaque pour le prototype ; moulé en série.", "Vis du couvercle M3 dans des inserts posés à chaud.", "Consommation de la carte estimée à 1,2 W, dont 0,4 W dans le régulateur abaisseur."],
    open: ["La hauteur intérieure de 24 mm suffit-elle au bornier choisi ?", "Faut-il un joint sous le couvercle (poussière) ?", "Référence exacte du microcontrôleur et de l'émetteur-récepteur CAN.", "Le voyant est-il vu à travers le couvercle (guide de lumière) ou par une ouverture ?"],
  },
  parts: [housing, cover, card, plate],
  assemblies: [{ dw: "assembly/1", id: "TMP-ASM", name: "Module de température — assemblage général", instances: [{ id: "i1", part: "TMP-BOITIER", fixed: true }, { id: "i2", part: "TMP-CARTE" }, { id: "i3", part: "TMP-COUVERCLE" }, { id: "i4", part: "TMP-PLATINE" }] }],
  boards: [{ id: "TMP-PCBA", name: "Carte de mesure 4 voies", part: "TMP-CARTE", description: "Reçoit le 24 V, alimente la logique, mesure quatre sondes NTC et publie sur le bus CAN.",
    functions: [
      { name: "Raccorder l'alimentation et le bus", criteria: [{ name: "Bornier", level: "24 V, GND, CAN H, CAN L" }], blocks: [{ template: "conn_io", params: { signals: "+24V_IN,GND,CAN_H,CAN_L" } }] },
      { name: "Alimenter la logique à partir du 24 V", criteria: [{ name: "Tension d'entrée", level: "18 à 30 V" }, { name: "Rails", level: "5 V 0,5 A ; 3,3 V 0,2 A" }], blocks: [{ template: "input_protection", params: { v: 24, i: 1 } }, { template: "buck", params: { vin: 24, vout: 5, iout: 0.5 } }, { template: "ldo", params: { vin: 5, vout: 3.3, iout: 0.2 } }] },
      { name: "Mesurer quatre températures", criteria: [{ name: "Plage", level: "0 à 100 °C, ± 1 K" }, { name: "Filtre", level: "100 Hz" }], blocks: [{ template: "ntc", params: { fc: 100 } }, { template: "ntc", params: { fc: 100 } }, { template: "ntc", params: { fc: 100 } }, { template: "ntc", params: { fc: 100 } }] },
      { name: "Calculer et publier sur le bus", criteria: [{ name: "Bus", level: "CAN 500 kbit/s, terminaison commutable" }], blocks: [{ template: "mcu", params: { pins: 48, xtal: 8 } }, { template: "can", params: { term: 1, choke: 0 } }] },
      { name: "Signaler l'état", criteria: [{ name: "Voyant", level: "vert, visible couvercle fermé" }], blocks: [{ template: "led", params: { color: "verte" } }] },
      { name: "Être programmable et testable", criteria: [{ name: "Accès", level: "SWD et points de test des rails" }], blocks: [{ template: "conn_swd", params: {} }, { template: "test", params: { nets: "+24V,+5V,+3V3,GND", fiducials: 3 } }] },
      { name: "Tenir dans le boîtier", kind: "contrainte", criteria: [{ name: "Carte", level: "90 × 60 mm, quatre vis M3, composants ≤ 12 mm" }] }] }],
  physics: [
    { model: "bolted_joint", part: "TMP-COUVERCLE", why: "Quatre vis M3 du couvercle dans des inserts : précharge et tenue sous 20 N d'arrachement.", inputs: { size: "M3", cls: "8.8", T: 0.5, nb: 4, Fa: 20, lk: 3, tp: 3, Em: 2.5, Re_p: 55, Le: 5.8, Rm_t: 55 } },
    { model: "beam_cantilever_point", part: "TMP-PLATINE", why: "La platine en porte-à-faux de 30 mm sous 30 N (poids et câbles).", inputs: { L: 30, section: "rect", b: 60, h: 3, F: 30, dlim: 0.5, sf: 2 } },
    { model: "junction_temperature", part: "TMP-CARTE", why: "Régulateur abaisseur : 0,4 W estimés, sans dissipateur, armoire à 60 °C.", inputs: { P: 0.4, Ta: 60, Rjc: 20, Rcs: 0, Rsa: 60, Tjmax: 125 } },
    { model: "pcb_trace", part: "TMP-CARTE", why: "Piste du 24 V : 0,5 A permanents.", inputs: { I: 0.5, Ta: 60, dTmax: 10, w: 0.5, tcu: 35, L: 60, layer: "external" } },
  ],
};
/* one line per part, assembly, board function and analysis : a file that stays short and that a person can still read */
const row = (list) => `[\n${list.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n ]`;
const compact = (a) => `{\n ${Object.entries(a).map(([k, v]) => `${JSON.stringify(k)}: ${Array.isArray(v) ? row(v) : JSON.stringify(v)}`).join(",\n ")}\n}`;
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
writeFileSync(new URL("../web/js/demo/demo_first_design.js", import.meta.url), `/* DesignWizard.ai — the worked example of a first complete design, written by tools/gen_first_design_example.mjs :
   the description an engineer gives, and the file an assistant gives back after the interview. Do not edit by hand. */

export const FIRST_DESIGN_DESCRIPTION = \`${esc(DESCRIPTION)}\`;

export const FIRST_DESIGN_ANSWER = \`${esc(compact(answer))}\`;
`);
console.log("parts", answer.parts.map((p) => `${p.id} ${p.process} ${(p.interfaces || []).map((i) => `${i.key}/${i.side}`).join(" ")}`).join("\n      "));
