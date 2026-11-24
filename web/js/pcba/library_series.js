/* DynamiteOrbit.ai — PCBA: the connectors of the electrical library, ready for a board. Each series that sits on a board
   (cad/connector_series.js) comes in its usual numbers of circuits, with the land pattern of the series — its pitch, its
   rows, its holes — and the ratings of the family (cad/elec_library.js). Maker and series are named in text, as a
   reference of compatibility ; the price is a typical one, an example. The data sheet of the part bought prevails. */

import { CONNECTORS } from "../cad/elec_library.js";
import { SERIES, MODEL_WORDS, DIMS_LEVELS } from "../cad/connector_series.js";
import { modelFootprint } from "../cad/connector_models.js";

/* the numbers of circuits offered for a series : what its model allows, among the usual ones */
const COUNTS = { shroud: [2, 3, 4, 5, 6, 8, 10, 12], strip: [2, 3, 4, 6, 8, 10], terminal: [2, 3, 4, 6], dsub: [9, 15, 25], ffc: [10, 20, 30, 40], mezz: [40, 60, 80, 100] };
const fr = (x) => String(x).replace(".", ",");
/* the pins of a series : one per circuit ; a solder tab, a peg or a fixing hole carries no signal */
const pinsOf = (S, n) => modelFootprint(S, n).pads.map((p) => ({ n: p.n, name: p.n, type: /^MP/.test(p.n) ? "nc" : "passive" }));
const span = (c) => { const n = String(c.pos || "").match(/\d+/g); return n ? [+n[0], +n[n.length - 1]] : [1, 100]; };

/** The connectors of the series as entries of the trade library : « J-JST-PH-4 », package « JST-PH-4 ». */
export const SERIES_PARTS = CONNECTORS.flatMap((c) => { const S = SERIES[c.id]; if (!S || !S.pkg) return [];
  const [lo, hi] = span(c), list = (COUNTS[S.model] || []).filter((n) => n >= lo && n <= hi && modelFootprint(S, n));
  return list.map((n) => ({ id: `J-${S.pkg}-${n}`, kind: S.model === "terminal" ? "terminal" : "connector", name: `${c.maker} ${c.series}, ${n} circuits${c.pitch ? `, pas ${fr(c.pitch)}` : ""}`, package: `${S.pkg}-${n}`, pins: pinsOf(S, n),
    desc: `${fr(c.a)} A par contact${c.v ? `, ${c.v} V` : ""} · ${MODEL_WORDS[S.model].label} · ${DIMS_LEVELS[S.dims].label}`, ratings: { I: c.a, ...(c.v ? { V: c.v } : {}) }, price: Math.round((0.1 + 0.02 * (c.pitch || 2.5) * n + (c.a > 5 ? 0.25 : 0)) * 100) / 100, series: c.id, dims: S.dims })); });
