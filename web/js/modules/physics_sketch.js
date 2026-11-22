/* DesignOrbit.ai — Physique : the small diagram of each hand calculation (no text inside the SVG). The same drawing is the
   2D view of the model in the studio and, small, the pictogram of its tile in the list of models : a designer recognises
   a cantilever, a bolt or a row of fins faster than he reads their names. */

import { svg } from "../core/dom.js";

const ACC = "var(--hl-red)";   // loads, flows and heat: readable whatever the accent colour of the tab
const ln = (x1, y1, x2, y2, o = {}) => svg("line", { x1, y1, x2, y2, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6, "stroke-linecap": "round", "stroke-dasharray": o.dash });
const bx = (x, y, w, h, o = {}) => svg("rect", { x, y, width: w, height: h, rx: o.r === undefined ? 1.5 : o.r, fill: o.fill || "none", "fill-opacity": o.op, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6 });
const pa = (d, o = {}) => svg("path", { d, fill: o.fill || "none", "fill-opacity": o.op, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": o.dash });
const ci = (cx, cy, r, o = {}) => svg("circle", { cx, cy, r, fill: o.fill || "none", "fill-opacity": o.op, stroke: o.c || "currentColor", "stroke-width": o.w || 1.6 });
function arrow(x1, y1, x2, y2, c = ACC) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = (da) => `${(x2 - 7 * Math.cos(a + da)).toFixed(1)} ${(y2 - 7 * Math.sin(a + da)).toFixed(1)}`;
  return [ln(x1, y1, x2, y2, { c, w: 2 }), svg("path", { d: `M${x2} ${y2} L${p(0.42)} L${p(-0.42)} Z`, fill: c })];
}
const fixedWall = (x, y1, y2, side = -1) => [ln(x, y1, x, y2, { w: 2.6 }), ...Array.from({ length: Math.floor((y2 - y1) / 8) }, (_, k) => ln(x, y1 + 4 + k * 8, x + side * 7, y1 + 10 + k * 8, { w: 1 }))];
const support = (x, y) => [pa(`M${x} ${y} L${x - 8} ${y + 13} L${x + 8} ${y + 13} Z`), ln(x - 12, y + 16, x + 12, y + 16, { w: 1 })];
const udl = (x1, x2, y) => [ln(x1, y - 20, x2, y - 20, { c: ACC, w: 1.4 }), ...Array.from({ length: 7 }, (_, k) => arrow(x1 + k * (x2 - x1) / 6, y - 20, x1 + k * (x2 - x1) / 6, y - 2))];
const plates = () => [bx(40, 44, 130, 14, { fill: "currentColor", op: 0.08 }), bx(70, 58, 130, 14, { fill: "currentColor", op: 0.16 }), arrow(40, 51, 14, 51), arrow(200, 65, 226, 65)];
const resistor = (x) => pa(`M${x} 50 l8 0 l3 -7 l6 14 l6 -14 l6 14 l6 -14 l3 7 l8 0`);
const finRow = () => [bx(40, 80, 160, 10, { fill: "currentColor", op: 0.15 }), ...Array.from({ length: 8 }, (_, k) => bx(42 + k * 21.6, 34, 6, 46, { fill: "currentColor", op: 0.15 }))];
const pipeWalls = () => [ln(20, 38, 220, 38, { w: 2.4 }), ln(20, 72, 220, 72, { w: 2.4 }), arrow(2, 55, 26, 55)];
const SKETCH = {
  "cantilever-point": () => [fixedWall(34, 28, 84), bx(34, 50, 170, 10, { fill: "currentColor", op: 0.1 }), pa("M34 55 Q130 56 204 74", { dash: "4 4", w: 1.1 }), arrow(200, 14, 200, 47)],
  "cantilever-udl": () => [fixedWall(34, 28, 84), bx(34, 50, 170, 10, { fill: "currentColor", op: 0.1 }), pa("M34 55 Q130 56 204 70", { dash: "4 4", w: 1.1 }), udl(40, 200, 50)],
  "simple-point": () => [bx(30, 46, 180, 10, { fill: "currentColor", op: 0.1 }), support(38, 56), support(202, 56), pa("M38 51 Q120 68 202 51", { dash: "4 4", w: 1.1 }), arrow(120, 10, 120, 43)],
  "simple-udl": () => [bx(30, 46, 180, 10, { fill: "currentColor", op: 0.1 }), support(38, 56), support(202, 56), pa("M38 51 Q120 66 202 51", { dash: "4 4", w: 1.1 }), udl(40, 200, 46)],
  column: () => [bx(114, 24, 12, 68, { fill: "currentColor", op: 0.1 }), ln(90, 92, 150, 92, { w: 2.6 }), ...Array.from({ length: 7 }, (_, k) => ln(94 + k * 8, 92, 88 + k * 8, 99, { w: 1 })), pa("M120 24 Q148 58 120 92", { dash: "4 4", w: 1.1 }), arrow(120, 0, 120, 21)],
  shaft: () => [fixedWall(40, 24, 86), bx(40, 42, 150, 26, { fill: "currentColor", op: 0.1 }), svg("ellipse", { cx: 190, cy: 55, rx: 6, ry: 13, fill: "none", stroke: "currentColor", "stroke-width": 1.6 }),
    pa("M40 48 L190 62", { dash: "4 4", w: 1.1 }), pa("M204 34 A24 24 0 0 1 204 76", { c: ACC, w: 2 }), svg("path", { d: "M204 76 L212 73 L206 67 Z", fill: ACC })],
  plate: () => [pa("M30 78 L80 44 L214 44 L164 78 Z", { fill: "currentColor", op: 0.1 }), pa("M30 78 L30 84 L164 84 L164 78 M164 84 L214 50 L214 44"), ...[70, 105, 140, 175].map((x) => arrow(x, 10, x, 50)), ...[55, 90, 125].map((x) => arrow(x + 15, 26, x + 15, 66))],
  bimetal: () => [bx(40, 38, 150, 16, { fill: ACC, op: 0.25 }), bx(40, 54, 150, 16, { fill: "currentColor", op: 0.15 }), fixedWall(40, 30, 78), arrow(192, 46, 228, 46), arrow(192, 62, 208, 62, "currentColor")],
  bolt: () => [plates(), bx(104, 30, 32, 14, { fill: "currentColor", op: 0.35 }), bx(113, 44, 14, 44, { fill: "currentColor", op: 0.35 }), bx(104, 72, 32, 12, { fill: "currentColor", op: 0.35 }), arrow(120, 4, 120, 26), arrow(120, 108, 120, 90)],
  pressfit: () => [ci(70, 55, 40, { fill: "currentColor", op: 0.1 }), ci(70, 55, 19, { fill: "currentColor", op: 0.3 }), ...[0, 1, 2, 3].map((k) => { const a = k * Math.PI / 2 + Math.PI / 4; return arrow(70 + 34 * Math.cos(a), 55 + 34 * Math.sin(a), 70 + 22 * Math.cos(a), 55 + 22 * Math.sin(a)); }),
    bx(150, 24, 44, 62, { fill: "currentColor", op: 0.1 }), bx(132, 42, 96, 26, { fill: "currentColor", op: 0.3 })],
  spring: () => [bx(20, 78, 200, 14, { fill: "currentColor", op: 0.16 }), bx(20, 28, 200, 14, { fill: "currentColor", op: 0.08 }), bx(28, 66, 22, 12, { fill: "currentColor", op: 0.35 }), bx(190, 66, 22, 12, { fill: "currentColor", op: 0.35 }),
    pa("M70 78 Q120 30 170 78", { c: ACC, w: 2.2 }), pa("M70 78 Q120 56 170 78", { dash: "4 3" }), arrow(120, 6, 120, 26), ln(120, 42, 120, 54, { w: 1, dash: "2 2" })],
  louvre: () => [bx(20, 78, 200, 14, { fill: "currentColor", op: 0.16 }), bx(20, 18, 200, 14, { fill: "currentColor", op: 0.08 }), ...Array.from({ length: 9 }, (_, k) => pa(`M${38 + k * 20} 78 L${50 + k * 20} 32`, { c: ACC, w: 2.2 })),
    arrow(4, 85, 26, 85), arrow(214, 25, 238, 25), arrow(120, 4, 120, 16)],
  pin: () => [plates(), bx(114, 36, 12, 44, { fill: ACC, op: 0.45, r: 4 })],
  plasticscrew: () => [bx(84, 40, 72, 64, { fill: "currentColor", op: 0.14 }), bx(30, 92, 180, 12, { fill: "currentColor", op: 0.14 }), bx(112, 26, 16, 64, { fill: "currentColor", op: 0.5 }), bx(98, 18, 44, 8, { fill: "currentColor", op: 0.5 }),
    ...Array.from({ length: 6 }, (_, k) => pa(`M108 ${36 + k * 9} L132 ${41 + k * 9}`, { c: ACC, w: 1.4 })), arrow(120, 16, 120, 0)],
  facecam: () => [bx(40, 62, 130, 14, { fill: "currentColor", op: 0.2 }), pa("M40 62 L122 44 L170 44 L170 62 Z", { fill: "currentColor", op: 0.32 }), bx(138, 16, 12, 28, { fill: ACC, op: 0.45, r: 2 }), bx(40, 84, 130, 12, { fill: "currentColor", op: 0.08 }),
    ...arrow(196, 60, 196, 94), pa("M24 30 A22 22 0 0 1 62 18", { c: ACC, w: 2 }), svg("path", { d: "M62 18 L52 16 L57 25 Z", fill: ACC }), ln(150, 30, 214, 30, { dash: "3 3", w: 1 })],
  pipe: () => [pipeWalls(), pa("M70 40 Q118 55 70 70", { c: ACC }), ...[46, 55, 64].map((y) => arrow(70, y, y === 55 ? 92 : 84, y)), arrow(150, 55, 214, 55), ln(118, 30, 118, 80, { dash: "3 4", w: 1 })],
  orifice: () => [pipeWalls(), bx(116, 38, 6, 12, { fill: "currentColor", op: 0.5 }), bx(116, 60, 6, 12, { fill: "currentColor", op: 0.5 }), pa("M40 44 Q100 44 119 52 Q140 54 200 46", { c: ACC, w: 1.2 }), pa("M40 66 Q100 66 119 58 Q140 56 200 64", { c: ACC, w: 1.2 }), arrow(126, 55, 190, 55)],
  wall: () => [bx(74, 18, 34, 74, { fill: "currentColor", op: 0.2 }), bx(108, 18, 9, 74, { fill: ACC, op: 0.45 }), bx(117, 18, 50, 74, { fill: "currentColor", op: 0.08 }), arrow(24, 55, 70, 55), arrow(171, 55, 216, 55), pa("M74 28 L108 36 L117 62 L167 76", { dash: "4 4", w: 1.2 })],
  chain: () => [bx(8, 62, 44, 22, { fill: "currentColor", op: 0.3 }), ln(30, 62, 30, 50), ...[30, 90, 150, 210].map((x) => ci(x, 50, 3.5, { fill: "currentColor", op: 1 })), resistor(34), resistor(94), resistor(154), ln(210, 50, 210, 74), ln(198, 74, 222, 74, { w: 2.2 }), ln(203, 80, 217, 80), ln(207, 86, 213, 86), arrow(30, 30, 80, 30)],
  "fins-natural": () => [finRow(), ...[53, 96, 139, 182].map((x) => arrow(x + 0.6, 76, x + 0.6, 8))],
  "fins-forced": () => [bx(50, 76, 160, 10, { fill: "currentColor", op: 0.15 }), bx(50, 30, 160, 46, { fill: "currentColor", op: 0.08 }), pa("M50 74 Q110 64 210 60", { dash: "4 4", w: 1.1 }), ...[38, 52, 66].map((y) => arrow(8, y, 44, y))],
  lump: () => [bx(86, 36, 56, 44, { fill: "currentColor", op: 0.2, r: 6 }), arrow(114, 32, 114, 8), arrow(82, 58, 56, 58), arrow(146, 58, 168, 58), ln(180, 92, 232, 92, { w: 1 }), ln(180, 92, 180, 24, { w: 1 }), pa("M180 92 Q190 40 232 36", { c: ACC, w: 2 }), ln(180, 34, 232, 34, { dash: "3 4", w: 1 })],
  busbar: () => [pa("M30 52 L48 38 L218 38 L200 52 Z", { fill: "currentColor", op: 0.1 }), bx(30, 52, 170, 16, { fill: "currentColor", op: 0.22, r: 0 }), pa("M200 52 L218 38 L218 54 L200 68 Z", { fill: "currentColor", op: 0.3 }),
    svg("ellipse", { cx: 52, cy: 45, rx: 6, ry: 3, fill: "none", stroke: "currentColor", "stroke-width": 1.3 }), svg("ellipse", { cx: 192, cy: 45, rx: 6, ry: 3, fill: "none", stroke: "currentColor", "stroke-width": 1.3 }), arrow(2, 60, 26, 60), arrow(221, 46, 239, 46), ...[80, 120, 160].map((x) => pa(`M${x} 34 q4 -8 0 -14 q-4 -6 0 -12`, { c: ACC, w: 1.2 }))],
  trace: () => [bx(24, 64, 192, 18, { fill: "currentColor", op: 0.12 }), bx(46, 58, 148, 6, { fill: ACC, op: 0.7, r: 0 }), arrow(10, 50, 44, 50), arrow(196, 50, 230, 50), ...[90, 120, 150].map((x) => pa(`M${x} 52 q4 -8 0 -14 q-4 -6 0 -12`, { c: ACC, w: 1.2 }))],
  pulse: () => [ln(26, 92, 226, 92, { w: 1 }), ln(26, 92, 26, 12, { w: 1 }), pa("M26 92 L64 92 L64 30 L128 30 L128 92 L220 92", { c: ACC, w: 2.2 }), pa("M64 86 Q100 60 128 22 L220 24", { dash: "5 4", w: 1.4 })],
};
/** The diagram of a model. o : { fill: true (takes the room it is given — the 2D view of the studio), mini: true (the pictogram
    of a tile : as wide as its tile), color } ; otherwise 240 × 110. */
export function sketch(m, o = {}) {
  const draw = SKETCH[m.sketch], size = o.fill ? { width: "100%", height: "100%" } : o.mini ? { width: "100%" } : { width: 240, height: 110 };
  return svg("svg", { viewBox: "0 0 240 110", ...size, role: "img", "aria-label": `Schéma : ${m.title}`, class: "phys-sketch", style: `max-width:100%;color:${o.color || "var(--ink)"};flex:${o.fill ? "1 1 auto;min-height:0" : "0 0 auto"}` }, ...(draw ? draw().flat(Infinity) : []));
}

/* the pictogram of a physics : what is tested, in one drawing (24 × 24) */
const DOMAIN_ICON = {
  structure: () => [ln(4, 3, 4, 21, { w: 2.2 }), pa("M4 9 Q14 9 21 14", { w: 2.2 }), ln(20, 2, 20, 9, { c: ACC, w: 1.8 }), svg("path", { d: "M20 11.5 L17.6 7.6 L22.4 7.6 Z", fill: ACC })],
  joints: () => [bx(2, 9, 14, 4.5, { fill: "currentColor", op: 0.18, w: 1.4, r: 0.8 }), bx(8, 13.5, 14, 4.5, { fill: "currentColor", op: 0.32, w: 1.4, r: 0.8 }), bx(8.2, 4.5, 7.6, 4.5, { fill: "currentColor", op: 0.9, w: 1.2, r: 0.8 }), ln(12, 9, 12, 21.5, { w: 3 })],
  fluid: () => [pa("M12 2.5 C8 8.5 5.5 11.5 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 11.5 16 8.5 12 2.5 Z", { fill: "currentColor", op: 0.22, w: 1.8 }), pa("M8.6 15.4 a3.6 3.6 0 0 0 3 3.2", { w: 1.4 })],
  thermal: () => [ln(3, 20.5, 21, 20.5, { w: 2.4 }), ...[6.5, 12, 17.5].map((x) => pa(`M${x} 17 q3 -3 0 -6 q-3 -3 0 -7`, { c: ACC, w: 1.8 }))],
  electrical: () => [pa("M13.5 2 L5 13.5 H11.5 L10 22 L19 10 H12.5 Z", { fill: "currentColor", op: 0.28, w: 1.8 })],
};
/** The pictogram of a physics (structure, joints, fluid, thermal, electrical), in its colour. */
export function domainIcon(id, color, size = 22) {
  const draw = DOMAIN_ICON[id];
  return svg("svg", { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", class: "phys-dom-icon", style: `color:${color || "currentColor"};flex:none` }, ...(draw ? draw().flat(Infinity) : []));
}
