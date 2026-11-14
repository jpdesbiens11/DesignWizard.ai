/* A tiny library and a small board shared by the PCBA tests : enough to exercise every module without the trade library. */
import { emptyBoard } from "../../web/js/pcba/model.js";

const two = (pitch, w, h) => [{ n: "1", x: -pitch / 2, y: 0, w, h, shape: "rect" }, { n: "2", x: pitch / 2, y: 0, w, h, shape: "rect" }];
const passive = [{ n: "1", name: "1", type: "passive" }, { n: "2", name: "2", type: "passive" }];
export const LIB = {
  R0603: { id: "R0603", kind: "resistor", prefix: "R", name: "Résistance 0603", package: "0603", pins: passive, pads: two(1.6, 0.9, 0.95), body: [1.6, 0.8, 0.45], courtyard: [2.9, 1.5], price: 0.01 },
  C0603: { id: "C0603", kind: "capacitor", prefix: "C", name: "Condensateur céramique 0603", package: "0603", pins: passive, pads: two(1.6, 0.9, 0.95), body: [1.6, 0.8, 0.8], courtyard: [2.9, 1.5], price: 0.02, ratings: { V: 50 } },
  LED0603: { id: "LED0603", kind: "other", prefix: "D", name: "DEL 0603", package: "0603", polar: true, pins: [{ n: "1", name: "K", type: "passive" }, { n: "2", name: "A", type: "passive" }], pads: two(1.6, 0.9, 0.95), body: [1.6, 0.8, 0.6], courtyard: [2.9, 1.5], price: 0.05 },
  SOIC8: { id: "SOIC8", kind: "ic", prefix: "U", name: "Régulateur SOIC-8", package: "SOIC-8", polar: true,
    pins: [{ n: "1", name: "VIN", type: "power_in" }, { n: "2", name: "EN", type: "in" }, { n: "3", name: "NC", type: "nc" }, { n: "4", name: "GND", type: "gnd" }, { n: "5", name: "FB", type: "in" }, { n: "6", name: "NC2", type: "nc" }, { n: "7", name: "PG", type: "out" }, { n: "8", name: "VOUT", type: "power_out" }],
    pads: [1, 2, 3, 4].map((i) => ({ n: String(i), x: -2.7, y: 1.905 - (i - 1) * 1.27, w: 1.55, h: 0.6, shape: "rect" })).concat([5, 6, 7, 8].map((i) => ({ n: String(i), x: 2.7, y: -1.905 + (i - 5) * 1.27, w: 1.55, h: 0.6, shape: "rect" }))),
    body: [3.9, 4.9, 1.75], courtyard: [7.4, 5.4], price: 0.6, ratings: { V: 40, I: 1 } },
  HDR2: { id: "HDR2", kind: "connector", prefix: "J", name: "Barrette 2 broches 2,54", package: "1x02 2,54", coat: false, polar: true, pins: [{ n: "1", name: "1", type: "passive" }, { n: "2", name: "2", type: "passive" }],
    pads: [{ n: "1", x: -1.27, y: 0, w: 1.7, h: 1.7, shape: "rect", drill: 1.0 }, { n: "2", x: 1.27, y: 0, w: 1.7, h: 1.7, shape: "round", drill: 1.0 }], body: [5.08, 2.54, 8.5], courtyard: [5.6, 3.1], price: 0.1 },
};

/** A 40 × 30 mm two-layer board : 12 V in on J1, a regulator U1 with its capacitors, a LED on the 5 V rail, 5 V out on J2. Nothing is routed. */
export function smallBoard() {
  const b = emptyBoard("T-PCBA", "Carte d'essai");
  b.board.size = [40, 30]; b.board.holes = [{ at: [3, 3], d: 3.2, land: 6 }, { at: [37, 27], d: 3.2, land: 6 }];
  b.functions = [{ id: "F1", parent: null, name: "Alimenter la charge en 5 V", kind: "principale", criteria: [{ name: "Tension de sortie", level: "5 V ± 2 %", flex: "F0" }] },
    { id: "F1.1", parent: "F1", name: "Recevoir le 12 V", kind: "technique", block: "B1" }, { id: "F1.2", parent: "F1", name: "Abaisser 12 V vers 5 V", kind: "technique", block: "B2" }, { id: "F2", parent: null, name: "Signaler la présence du 5 V", kind: "principale", block: "B3" }];
  b.blocks = [{ id: "B1", template: "conn", name: "Entrée 12 V", function: "F1.1", params: {}, zone: [0, 8, 10, 14] }, { id: "B2", template: "reg", name: "Régulateur 5 V", function: "F1.2", params: {}, zone: [10, 4, 20, 22] }, { id: "B3", template: "led", name: "Témoin", function: "F2", params: {}, zone: [30, 4, 10, 22] }];
  b.parts = [{ ref: "J1", comp: "HDR2", block: "B1", at: [5, 15], rot: 90, fixed: true }, { ref: "U1", comp: "SOIC8", block: "B2", at: [20, 15] }, { ref: "C1", comp: "C0603", value: "10 µF", block: "B2", at: [13.5, 20] },
    { ref: "C2", comp: "C0603", value: "22 µF", block: "B2", at: [26.5, 20] }, { ref: "R1", comp: "R0603", value: "1 kΩ", block: "B3", at: [33, 18] }, { ref: "D1", comp: "LED0603", value: "verte", block: "B3", at: [33, 12] },
    { ref: "J2", comp: "HDR2", block: "B3", at: [36.5, 15], rot: 90, fixed: true }];
  b.nets = [{ name: "+12V", class: "power", voltage: 12, current: 1, pins: ["J1.1", "U1.VIN", "U1.EN", "C1.1"] }, { name: "+5V", class: "power", voltage: 5, current: 1, pins: ["U1.VOUT", "U1.FB", "C2.1", "R1.1", "J2.1"] },
    { name: "GND", class: "ground", pins: ["J1.2", "U1.GND", "C1.2", "C2.2", "D1.K", "J2.2"] }, { name: "LED_A", class: "signal", pins: ["R1.2", "D1.A"] }];
  return b;
}
