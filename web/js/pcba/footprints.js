/* DynamiteOrbit.ai — PCBA: land patterns. Each generator returns { pads, body: [w, h, z], courtyard: [w, h] } in the
   pad format of model.js. Dimensions are nominal patterns in the spirit of IPC-7351 (density level B): typical values,
   good for a prototype — the data sheet of the chosen part prevails.
   Conventions: the part is centred on its origin ; on two-row packages pin 1 is at the top of the left row and the
   numbering runs counter-clockwise ; pad 1 of a through-hole connector is square.
   The connectors of the electrical library have the land pattern of THEIR series (« JST-PH-4 », « MINIFIT-8 ») : built
   from the dimensions the maker publishes (cad/connector_series.js), which say how they were checked. */

import { SERIES, SERIES_PACKAGES } from "../cad/connector_series.js";
import { modelFootprint } from "../cad/connector_models.js";

const r3 = (v) => Math.round(v * 1000) / 1000;
const pad = (n, x, y, w, h, shape = "rect", drill = 0) => (drill ? { n: String(n), x: r3(x), y: r3(y), w, h, shape, drill } : { n: String(n), x: r3(x), y: r3(y), w, h, shape });

/** Two-terminal chip : pads centred at ±pitch/2. */
const chip = (pitch, w, h, body, court) => () => ({ pads: [pad(1, -pitch / 2, 0, w, h), pad(2, pitch / 2, 0, w, h)], body, courtyard: court });
/** Two rows of leads, left then right, numbered counter-clockwise ; `left`/`right` = leads per row. */
function dual(left, right, pitch, x, w, h, body, court) {
  const pads = [], col = (n0, cnt, sx, up) => { for (let i = 0; i < cnt; i++) { const y = ((cnt - 1) / 2 - i) * pitch; pads.push(pad(n0 + i, sx * x, up ? -y : y, w, h)); } };
  col(1, left, -1, false); col(left + 1, right, 1, true);
  return { pads, body, courtyard: court };
}
/** Four rows of leads (QFN, LQFP) numbered counter-clockwise from the top of the left row ; ep = exposed pad size. */
function quad(n, pitch, c, len, wid, body, court, ep) {
  const k = n / 4, pads = [], off = (i) => ((k - 1) / 2 - i) * pitch;
  for (let i = 0; i < k; i++) pads.push(pad(1 + i, -c, off(i), len, wid));
  for (let i = 0; i < k; i++) pads.push(pad(k + 1 + i, -off(i), -c, wid, len));
  for (let i = 0; i < k; i++) pads.push(pad(2 * k + 1 + i, c, -off(i), len, wid));
  for (let i = 0; i < k; i++) pads.push(pad(3 * k + 1 + i, off(i), c, wid, len));
  if (ep) pads.push(pad("EP", 0, 0, ep, ep));
  return { pads, body, courtyard: court };
}
/** Rows of through-hole pins : cols × rows, pitch p, land d, drill ; pin 1 square, numbering zigzag across the rows. */
function pins(cols, rows, p, d, drill, body, court) {
  const out = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const n = c * rows + r + 1;
    out.push(pad(n, (c - (cols - 1) / 2) * p, rows === 1 ? 0 : ((rows - 1) / 2 - r) * p, d, d, n === 1 ? "rect" : "round", drill));
  }
  return { pads: out, body, courtyard: court };
}

const FIXED = {
  "0402": chip(1.0, 0.6, 0.6, [1.0, 0.5, 0.35], [1.9, 1.0]), "0603": chip(1.6, 0.9, 0.95, [1.6, 0.8, 0.45], [2.9, 1.5]),
  "0805": chip(1.9, 1.0, 1.45, [2.0, 1.25, 0.6], [3.4, 2.0]), "1206": chip(2.9, 1.15, 1.8, [3.2, 1.6, 0.6], [4.6, 2.3]),
  "1210": chip(2.9, 1.15, 2.7, [3.2, 2.5, 1.8], [4.6, 3.2]), "2512": chip(5.9, 1.4, 3.35, [6.3, 3.2, 0.6], [8.0, 3.9]),
  "SOD-123": chip(3.3, 0.9, 1.2, [2.7, 1.6, 1.1], [4.7, 2.1]), SMA: chip(4.2, 2.2, 1.8, [4.3, 2.6, 2.2], [6.9, 3.2]),
  SMB: chip(4.3, 2.3, 2.3, [4.3, 3.6, 2.3], [7.2, 4.2]), SMC: chip(6.9, 2.7, 3.3, [6.9, 5.9, 2.3], [10.2, 6.5]),
  "IND-4040": chip(3.0, 1.4, 3.4, [4.0, 4.0, 2.0], [4.9, 4.5]), "IND-6060": chip(4.4, 2.2, 5.2, [6.0, 6.0, 3.0], [7.1, 6.5]), "IND-1040": chip(7.7, 3.2, 4.2, [11.0, 10.0, 4.0], [11.5, 10.5]),
  "CAP-D6.3": chip(5.5, 3.5, 1.6, [6.6, 6.6, 7.7], [9.5, 7.1]), "CAP-D8": chip(6.6, 4.0, 1.9, [8.3, 8.3, 10.5], [11.1, 8.8]), "CAP-D10": chip(8.4, 4.4, 2.0, [10.3, 10.3, 10.5], [13.3, 10.8]),
  "SOT-23": () => dual(2, 1, 1.9, 1.1, 1.0, 0.6, [1.3, 2.9, 1.1], [3.7, 3.4]),
  "SOT-323": () => dual(2, 1, 1.3, 0.95, 0.9, 0.5, [1.25, 2.0, 1.0], [3.3, 2.5]), "SOT-363": () => dual(3, 3, 0.65, 0.95, 0.9, 0.4, [1.25, 2.0, 1.0], [3.3, 2.5]),
  "SOD-323": chip(2.4, 0.8, 0.7, [1.7, 1.25, 0.95], [3.7, 1.7]), "XTAL-3215": chip(2.5, 1.0, 1.8, [3.2, 1.5, 0.9], [4.0, 2.3]), "BAT-CR2032": chip(29.3, 2.6, 4.0, [22.0, 16.0, 5.4], [32.5, 16.5]),
  "SOT-23-5": () => { const f = dual(3, 3, 0.95, 1.2, 1.0, 0.6, [1.6, 2.9, 1.1], [3.9, 3.4]); f.pads.splice(4, 1); f.pads[4].n = "5"; return f; },   // no lead in the middle of the right row
  "SOT-23-6": () => dual(3, 3, 0.95, 1.2, 1.0, 0.6, [1.6, 2.9, 1.1], [3.9, 3.4]),
  "SOT-223": () => { const f = dual(3, 0, 2.3, 3.15, 2.2, 1.2, [3.5, 6.5, 1.6], [8.9, 7.0]); f.pads.push(pad(4, 3.15, 0, 2.2, 3.6)); return f; },
  "SOIC-8": () => dual(4, 4, 1.27, 2.7, 1.55, 0.6, [3.9, 4.9, 1.75], [7.4, 5.4]), "SOIC-14": () => dual(7, 7, 1.27, 2.7, 1.55, 0.6, [3.9, 8.65, 1.75], [7.4, 9.2]),
  "SOIC-16": () => dual(8, 8, 1.27, 2.7, 1.55, 0.6, [3.9, 9.9, 1.75], [7.4, 10.4]), "SOIC-16W": () => dual(8, 8, 1.27, 4.65, 2.0, 0.6, [7.5, 10.3, 2.65], [11.8, 10.8]),
  "SOP-4": () => dual(2, 2, 2.54, 3.4, 1.6, 1.0, [4.4, 4.1, 2.0], [8.9, 4.6]), "MSOP-8": () => dual(4, 4, 0.65, 2.2, 1.4, 0.4, [3.0, 3.0, 1.1], [6.1, 3.5]),
  "TSSOP-14": () => dual(7, 7, 0.65, 2.85, 1.45, 0.4, [4.4, 5.0, 1.2], [7.6, 5.5]), "TSSOP-16": () => dual(8, 8, 0.65, 2.85, 1.45, 0.4, [4.4, 5.0, 1.2], [7.6, 5.5]),
  "TSSOP-20": () => dual(10, 10, 0.65, 2.85, 1.45, 0.4, [4.4, 6.5, 1.2], [7.6, 7.0]),
  "TSSOP-24": () => dual(12, 12, 0.65, 2.85, 1.45, 0.4, [4.4, 7.8, 1.2], [7.6, 8.3]), "TSSOP-28": () => dual(14, 14, 0.65, 2.85, 1.45, 0.4, [4.4, 9.7, 1.2], [7.6, 10.2]),
  "HTSSOP-28": () => { const f = dual(14, 14, 0.65, 2.85, 1.45, 0.4, [4.4, 9.7, 1.2], [7.6, 10.2]); f.pads.push(pad("EP", 0, 0, 3.0, 5.5)); return f; },      // thermal pad underneath
  "SOIC-8W": () => dual(4, 4, 1.27, 4.65, 2.0, 0.6, [7.5, 5.85, 2.65], [11.8, 6.4]),
  // no-lead packages : the courtyard leaves room around the lands for the tracks and vias that leave them (nothing passes under)
  "QFN-16": () => quad(16, 0.5, 1.45, 0.75, 0.28, [3.0, 3.0, 0.9], [5.4, 5.4], 1.7), "QFN-24": () => quad(24, 0.5, 1.95, 0.75, 0.28, [4.0, 4.0, 0.9], [6.4, 6.4], 2.6),
  "QFN-32": () => quad(32, 0.5, 2.45, 0.75, 0.28, [5.0, 5.0, 0.9], [7.4, 7.4], 3.4), "QFN-48": () => quad(48, 0.5, 3.45, 0.75, 0.28, [7.0, 7.0, 0.9], [9.4, 9.4], 5.2),
  "DFN-8": () => { const f = dual(4, 4, 0.65, 1.45, 0.8, 0.35, [3.0, 3.0, 0.9], [4.2, 3.5]); f.pads.push(pad("EP", 0, 0, 1.5, 2.4)); return f; },
  "LQFP-32": () => quad(32, 0.8, 4.25, 1.5, 0.5, [7.0, 7.0, 1.6], [10.5, 10.5]), "LQFP-48": () => quad(48, 0.5, 4.25, 1.5, 0.3, [7.0, 7.0, 1.6], [10.5, 10.5]),
  "LQFP-64": () => quad(64, 0.5, 5.75, 1.5, 0.3, [10.0, 10.0, 1.6], [13.5, 13.5]),
  DPAK: () => ({ pads: [pad(1, -4.6, 2.28, 2.2, 1.2), pad(3, -4.6, -2.28, 2.2, 1.2), pad(2, 1.6, 0, 6.0, 6.2)], body: [9.9, 6.6, 2.3], courtyard: [11.2, 7.4] }),
  D2PAK: () => ({ pads: [pad(1, -6.9, 2.54, 3.2, 1.6), pad(3, -6.9, -2.54, 3.2, 1.6), pad(2, 1.9, 0, 9.5, 10.8)], body: [15.0, 10.2, 4.5], courtyard: [16.6, 11.4] }),
  "TO-220": () => ({ pads: [pad(1, -2.54, 0, 1.8, 1.8, "rect", 1.1), pad(2, 0, 0, 1.8, 1.8, "round", 1.1), pad(3, 2.54, 0, 1.8, 1.8, "round", 1.1)], body: [10.2, 4.6, 16.0], courtyard: [10.8, 5.2] }),
  "LGA-14": () => {                                             // 2.5 × 3.0 mm, 0.5 mm pitch : 4 pads left, 3 bottom, 4 right, 3 top
    const p = [];
    [0.75, 0.25, -0.25, -0.75].forEach((y, i) => p.push(pad(1 + i, -1.0125, y, 0.475, 0.25)));
    [-0.5, 0, 0.5].forEach((x, i) => p.push(pad(5 + i, x, -1.2625, 0.25, 0.475)));
    [-0.75, -0.25, 0.25, 0.75].forEach((y, i) => p.push(pad(8 + i, 1.0125, y, 0.475, 0.25)));
    [0.5, 0, -0.5].forEach((x, i) => p.push(pad(12 + i, x, 1.2625, 0.25, 0.475)));
    return { pads: p, body: [2.5, 3.0, 0.86], courtyard: [3.0, 3.5] };
  },
  "XTAL-3225": () => ({ pads: [pad(1, -1.1, 0.8, 1.4, 1.15), pad(2, -1.1, -0.8, 1.4, 1.15), pad(3, 1.1, -0.8, 1.4, 1.15), pad(4, 1.1, 0.8, 1.4, 1.15)], body: [3.2, 2.5, 0.8], courtyard: [4.1, 3.3] }),
  "CMC-4532": () => ({ pads: [pad(1, -1.9, 1.0, 1.2, 1.0), pad(2, -1.9, -1.0, 1.2, 1.0), pad(3, 1.9, -1.0, 1.2, 1.0), pad(4, 1.9, 1.0, 1.2, 1.0)], body: [4.5, 3.2, 2.8], courtyard: [5.5, 3.7] }),
  "SW-TACT-6": () => ({ pads: [pad(1, -4.0, 2.25, 2.1, 1.4), pad(2, 4.0, 2.25, 2.1, 1.4), pad(3, -4.0, -2.25, 2.1, 1.4), pad(4, 4.0, -2.25, 2.1, 1.4)], body: [6.2, 6.2, 4.3], courtyard: [10.6, 6.7] }),
  "RELAY-SPDT": () => ({ pads: [pad(1, -6.1, 6.0, 2.5, 2.5, "rect", 1.3), pad(2, -6.1, -6.0, 2.5, 2.5, "round", 1.3), pad(3, -8.1, 0, 2.5, 2.5, "round", 1.3), pad(4, 6.1, 6.0, 2.5, 2.5, "round", 1.3), pad(5, 6.1, -6.0, 2.5, 2.5, "round", 1.3)], body: [19.5, 15.5, 15.5], courtyard: [20.0, 16.0] }),
  "BUZZER-12": () => ({ pads: [pad(1, -3.8, 0, 1.8, 1.8, "rect", 1.0), pad(2, 3.8, 0, 1.8, 1.8, "round", 1.0)], body: [12.0, 12.0, 9.5], courtyard: [12.5, 12.5] }),
  "USB-C-2.0": () => {                                          // receptacle for USB 2.0 : 12 signal lands (the two rows of the plug joined), 4 shell legs
    const p = [], row = [["A1", -3.2, 0.6], ["A4", -2.4, 0.6], ["B8", -1.75, 0.3], ["A5", -1.25, 0.3], ["B7", -0.75, 0.3], ["A6", -0.25, 0.3], ["A7", 0.25, 0.3], ["B6", 0.75, 0.3], ["A8", 1.25, 0.3], ["B5", 1.75, 0.3], ["B4", 2.4, 0.6], ["B1", 3.2, 0.6]];
    for (const [n, x, w] of row) p.push(pad(n, x, 3.1, w, 1.3));
    [[-4.32, 2.05], [4.32, 2.05], [-4.32, -2.1], [4.32, -2.1]].forEach(([x, y], i) => p.push(pad(`S${i + 1}`, x, y, 1.2, 1.9, "round", 0.7)));
    return { pads: p, body: [8.94, 7.3, 3.2], courtyard: [10.4, 8.4] };
  },
  "TP-1.0": () => ({ pads: [pad(1, 0, 0, 1.0, 1.0, "round")], body: [1.0, 1.0, 0.05], courtyard: [1.5, 1.5] }),
  "FID-1.0": () => ({ pads: [pad(1, 0, 0, 1.0, 1.0, "round")], body: [1.0, 1.0, 0.04], courtyard: [3.0, 3.0] }),
};
/** Families whose pin count is part of the name : "HDR-1x06-2.54", "HDR-2x05-1.27", "TB-3-5.08". */
const FAMILIES = [
  [/^HDR-1x(\d+)-2\.54$/, (n) => pins(n, 1, 2.54, 1.7, 1.0, [n * 2.54, 2.54, 8.5], [n * 2.54 + 0.5, 3.1])],
  [/^HDR-2x(\d+)-2\.54$/, (n) => pins(n, 2, 2.54, 1.7, 1.0, [n * 2.54, 5.08, 8.5], [n * 2.54 + 0.5, 5.6])],
  [/^HDR-2x(\d+)-1\.27$/, (n) => pins(n, 2, 1.27, 1.0, 0.65, [n * 1.27 + 0.6, 3.4, 5.5], [n * 1.27 + 1.1, 3.9])],
  [/^TB-(\d+)-5\.08$/, (n) => pins(n, 1, 5.08, 2.6, 1.3, [n * 5.08, 8.0, 10.0], [n * 5.08 + 0.5, 8.5])],
  [/^TB-(\d+)-3\.5$/, (n) => pins(n, 1, 3.5, 2.0, 1.1, [n * 3.5, 7.0, 8.5], [n * 3.5 + 0.5, 7.5])],
  [/^WTB-(\d+)-2\.0$/, (n) => pins(n, 1, 2.0, 1.25, 0.75, [n * 2.0 + 1.9, 4.5, 6.0], [n * 2.0 + 2.4, 5.0])],       // wire-to-board, 2 mm pitch
  [/^SIP-(\d+)$/, (n) => pins(n, 1, 2.54, 1.7, 1.0, [n * 2.54 + 1.5, 6.0, 10.0], [n * 2.54 + 2.0, 6.5])],          // single-in-line module
  [/^FLEXJ-(\d+)-1\.0$/, (n) => ({ pads: Array.from({ length: n }, (_, i) => pad(i + 1, (i - (n - 1) / 2) * 1.0, 0, 0.6, 2.0)), body: [n * 1.0 + 1.0, 3.0, 0.2], courtyard: [n * 1.0 + 1.6, 3.6] })],      // the soldered joint of a flex tail, 1 mm pitch
];

/** The series a land pattern name belongs to : « MINIFIT-8 » → { id: "molex-minifit", n: 8, S } ; null for any other name. */
export function seriesPackage(name) { const m = /^([A-Z0-9]+(?:-[A-Z]+)?)-(\d+)$/.exec(String(name)), id = m && SERIES_PACKAGES[m[1]]; return id && +m[2] >= 1 && +m[2] <= 100 ? { id, n: +m[2], S: SERIES[id] } : null; }
/** Land pattern of a package name, or null when the name is unknown. */
export function footprint(name) {
  if (FIXED[name]) return FIXED[name]();
  for (const [re, make] of FAMILIES) { const m = re.exec(String(name)); if (m && +m[1] >= 1 && +m[1] <= 40) return make(+m[1]); }
  const P = seriesPackage(name);
  return P ? modelFootprint(P.S, P.n) : null;
}
/** Package names a user can pick ; the families are shown with « N » for the pin count. */
export const packageList = () => [...Object.keys(FIXED), "HDR-1xN-2.54", "HDR-2xN-2.54", "HDR-2xN-1.27", "TB-N-5.08", "TB-N-3.5", "WTB-N-2.0", "SIP-N", "FLEXJ-N-1.0", ...Object.keys(SERIES_PACKAGES).map((p) => `${p}-N`)];
export const PACKAGES = FIXED;
