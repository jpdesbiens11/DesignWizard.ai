/* DynamiteOrbit — Labo, the instruments of the bench as small drawings : what one sets on the front of each, for a step of
   « Manipulation en labo » (demande de JP : « l'appareil et son réglage dessinés »). The setting comes from the step
   (pcba/lab_manip.js, `gear`) : a supply shows its voltage, its current limit and whether its output is on ; a multimeter
   shows the position of its dial ; an oscilloscope shows the channel in use. Generic instruments, drawn by the tool : no
   maker, no model. Nothing is decided here. */

import { svg } from "../core/dom.js";
import { eng } from "../pcba/lab_bench.js";

const fr = (x) => String(+(+x).toPrecision(3)).replace(".", ",");
const frame = (...kids) => svg("svg", { viewBox: "0 0 190 104", class: "gear-pic", role: "img" }, svg("rect", { x: 2, y: 6, width: 186, height: 92, rx: 8, fill: "#e5e7eb", stroke: "#374151", "stroke-width": 2 }), ...kids.flat().filter(Boolean));
const screen = (x, y, w, h) => svg("rect", { x, y, width: w, height: h, rx: 3, fill: "#0b1410", stroke: "#111827" });
const txt = (x, y, s, o = {}) => svg("text", { x, y, "font-size": o.size || 11, fill: o.fill || "#d1fae5", "font-family": "ui-monospace, monospace", "font-weight": o.bold ? 700 : 400, "text-anchor": o.anchor || "start" }, s);
const jack = (x, y, color, label) => [svg("circle", { cx: x, cy: y, r: 6.5, fill: color, stroke: "#111827", "stroke-width": 1.5 }), svg("circle", { cx: x, cy: y, r: 2.2, fill: "#0b0f14" }), svg("text", { x, y: y - 9, "font-size": 9, "text-anchor": "middle", fill: "#111827", "font-weight": 700 }, label)];
const lamp = (x, y, on, label) => [svg("rect", { x: x - 22, y: y - 9, width: 44, height: 18, rx: 9, fill: on ? "#16a34a" : "#9ca3af", stroke: "#111827" }), svg("text", { x, y: y + 3.5, "font-size": 9, "text-anchor": "middle", fill: "#fff", "font-weight": 700 }, label)];

const PICS = {
  supply: (g) => frame(screen(12, 16, 96, 46), txt(18, 35, g.v !== null && g.v !== undefined ? `${fr(g.v)} V` : "— V", { size: 15, bold: true }), txt(18, 54, g.ilim ? `lim. ${eng(g.ilim, "A")}` : "lim. —", { size: 11, fill: "#fde68a" }),
    lamp(148, 28, g.on, g.on ? "SORTIE" : "COUPÉE"), jack(132, 78, "#111827", "−"), jack(164, 78, "#dc2626", "+"), svg("text", { x: 14, y: 84, "font-size": 9, fill: "#374151" }, g.on ? "sortie active" : "sortie coupée")),
  meter: (g) => { const pos = { cont: [-58, "Ω ·)))"], ohm: [-25, "Ω"], vdc: [25, "V ⎓"], adc: [58, "A ⎓"] }[g.mode] || [0, ""], a = (pos[0] * Math.PI) / 180;
    return frame(screen(12, 14, 100, 30), txt(104, 35, pos[1], { size: 15, bold: true, anchor: "end" }), svg("circle", { cx: 62, cy: 72, r: 19, fill: "#374151", stroke: "#111827", "stroke-width": 1.5 }), svg("line", { x1: 62, y1: 72, x2: 62 + 17 * Math.sin(a), y2: 72 - 17 * Math.cos(a), stroke: "#fbbf24", "stroke-width": 3.5, "stroke-linecap": "round" }),
      ...[["Ω·))", -58], ["Ω", -25], ["V", 25], ["A", 58]].map(([l, d]) => svg("text", { x: 62 + 29 * Math.sin((d * Math.PI) / 180), y: 75 - 27 * Math.cos((d * Math.PI) / 180), "font-size": 8, "text-anchor": "middle", fill: "#111827", "font-weight": 700 }, l)),
      jack(138, 66, "#111827", "COM"), jack(166, 66, "#dc2626", "VΩ")); },
  scope: (g) => frame(screen(12, 14, 104, 76), svg("path", { d: "M12 52 H116 M64 14 V90", stroke: "rgba(160,200,180,.4)", fill: "none" }), svg("path", { d: "M16 66 H38 V36 H62 V66 H86 V36 H112", stroke: "#ffd60a", "stroke-width": 2, fill: "none" }),
    ...[1, 2].map((c) => [svg("circle", { cx: 122 + c * 20, cy: 34, r: 8, fill: g.ch === c || !g.ch ? (c === 1 ? "#ffd60a" : "#5ac8fa") : "#9ca3af", stroke: "#111827", "stroke-width": 1.5 }), svg("text", { x: 122 + c * 20, y: 55, "font-size": 9, "text-anchor": "middle", fill: "#111827", "font-weight": 700 }, `CH${c}`)]), svg("text", { x: 152, y: 82, "font-size": 9, "text-anchor": "middle", fill: "#374151" }, "sonde ×10")),
  generator: (g) => frame(screen(12, 16, 96, 46), svg("path", { d: "M18 39 Q30 12 42 39 T66 39 T90 39 T102 39", stroke: "#5ac8fa", "stroke-width": 2, fill: "none" }), lamp(148, 28, g.on, g.on ? "SORTIE" : "COUPÉE"), jack(148, 74, "#2563eb", "50 Ω"), svg("text", { x: 14, y: 84, "font-size": 9, fill: "#374151" }, g.on ? "sortie active" : "sortie coupée")),
  load: (g) => frame(svg("path", { d: "M20 52 H54 L60 38 L72 66 L84 38 L96 66 L108 38 L114 52 H170", stroke: "#111827", "stroke-width": 3, fill: "none", "stroke-linejoin": "round" }), svg("text", { x: 95, y: 88, "font-size": 13, "text-anchor": "middle", fill: "#111827", "font-weight": 700 }, g.r ? eng(g.r, "Ω") : "charge")),
  wire: (g) => PICS.load(g),
  cell: () => frame(svg("circle", { cx: 70, cy: 52, r: 30, fill: "#cbd5e1", stroke: "#374151", "stroke-width": 2 }), svg("circle", { cx: 70, cy: 52, r: 22, fill: "none", stroke: "#94a3b8", "stroke-width": 1.5 }), svg("text", { x: 70, y: 58, "font-size": 18, "text-anchor": "middle", fill: "#111827", "font-weight": 700 }, "+"),
    svg("text", { x: 70, y: 96, "font-size": 9, "text-anchor": "middle", fill: "#374151" }, "pile bouton"), jack(150, 52, "#dc2626", "+")),
  press: (g) => frame(svg("rect", { x: 40, y: 58, width: 56, height: 26, rx: 4, fill: "#374151" }), svg("rect", { x: 52, y: g.down ? 50 : 40, width: 32, height: g.down ? 10 : 20, rx: 4, fill: g.down ? "#16a34a" : "#9ca3af", stroke: "#111827" }),
    svg("path", { d: `M68 ${g.down ? 48 : 38} C 64 22, 80 14, 92 20 L 120 32`, stroke: "#b45309", "stroke-width": 9, fill: "none", "stroke-linecap": "round" }), lamp(150, 30, !!g.down, g.down ? "APPUYÉ" : "RELÂCHÉ"), jack(150, 74, "#0891b2", "•")),
};
/** Where each lead leaves the drawing of its instrument (viewBox 190 × 104) : the jack its cord is plugged in — a cord is drawn from there to the board. */
export const JACKS = {
  supply: { minus: [132, 78], plus: [164, 78] }, meter: { black: [138, 66], red: [166, 66] }, scope: { probe: [142, 34], probe2: [162, 34], clip: [142, 34], probeRef: [142, 34] },
  generator: { hot: [148, 74], back: [148, 74] }, load: { load: [[20, 52], [170, 52]] }, wire: { load: [[20, 52], [170, 52]] }, cell: { plus: [150, 52] }, press: { part: [150, 74] },
};
/** The drawing of an instrument as a step sets it. gear : { kind, … } (pcba/lab_manip.js) → an svg node, or null. */
export function gearPic(gear, label = "") { const make = gear && PICS[gear.kind]; if (!make) return null; const node = make(gear); node.setAttribute("aria-label", label || "Appareil du banc"); return node; }
