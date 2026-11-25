/* DynamiteOrbit.ai — PCBA: the document of a complete electronic board ("DW board/1") and its resolved geometry.
   Every other module of the brick (library, synthesis, placement, routing, rules, fabrication files, review) reads
   and writes these two shapes and nothing else.

   Units: mm. Origin at the bottom-left corner of the board, X to the right, Y up. Angles in degrees, counter-clockwise
   seen from the top, multiples of 90 only. A part on the bottom side is mirrored about its own Y axis (local x → −x),
   then rotated, then moved to `at`.

   board document ("DW board/1")
   { dw: "board/1", id, name, description, revision,
     functions: [{ id, parent, name, kind: "principale" | "contrainte" | "technique", criteria: [{ name, level, flex }], block, note }],
     blocks:    [{ id, template, name, function, params: {…}, zone: [x, y, w, h] }],        // one solution per function; zone = floor plan
     parts:     [{ ref, comp, value, block, at: [x, y], rot, side: "top" | "bottom", mpn, dnp, fixed }],
     nets:      [{ name, class, voltage, current, pins: ["U1.3", "C2.VIN"] }],              // a pin is a pad number or a pin name
     board:     { size: [w, h], r, outline: [[x, y], …], t, layers: 2 | 4 | 6 | 8 | 10 | 12, copper: 35, finish, mask, silk,
                  coating: { type: "none" | "AR" | "UR" | "SR" | "XY", thickness, sides: "both" | "top" },
                  holes: [{ at: [x, y], d, plated, land, kind: "mount" | "tooling" }] },
     rules:     { fab: "standard" | "fin", classes: { <class>: { track, clearance, via: [d, drill] } } },
     tracks:    [{ net, layer, w, pts: [[x, y], …] }],
     vias:      [{ net, at: [x, y], d, drill }],
     planes:    [{ net, layer, inset }],                                                    // a copper plane over a whole layer
     library:   { <id>: component },                                                        // components added on top of the trade library
     part }                                                                                 // id of the mechanical twin (a "pcb" part)

   component (library entry)
   { id, kind, prefix, name, package, desc,
     pins: [{ n, name, type: "power_in" | "power_out" | "gnd" | "in" | "out" | "bidir" | "passive" | "nc" }],
     pads: [{ n, x, y, w, h, shape: "rect" | "round" | "oval", drill, plated }],            // n = pin number ; drill 0 or absent = SMD
     body: [w, h, z], courtyard: [w, h], coat, polar, ratings: { V, I, P }, price, mpn, maker }
     coat false = keep the conformal coating off (connectors, switches, test points) ; polar true = pin 1 is marked. */

import { ipcSpacing } from "../analysis/dfx_rules_pcb.js";

export const BOARD_VERSION = 1;
/** Copper layers of a board, from the top down. */
/** The copper counts a board can have (demande de JP, 25 novembre 2026 : « être capable de gérer le nombre de couches requis ») : even, 2 to 12. */
export const LAYER_COUNTS = [2, 4, 6, 8, 10, 12];
export const MAX_INNER = LAYER_COUNTS[LAYER_COUNTS.length - 1] - 2;
/** A count as the shop builds it : even, between 2 and 12 (an odd count goes up to the next even one). */
export const layerCount = (n) => { const k = Math.round(+n || 2); return k <= 2 ? 2 : Math.min(MAX_INNER + 2, k % 2 ? k + 1 : k); };
/** Copper layers of a board, from the top down : top, in1 … in(n − 2), bottom. */
export const copperLayers = (n) => { const k = layerCount(n); return ["top", ...Array.from({ length: k - 2 }, (_, i) => `in${i + 1}`), "bottom"]; };
export const LAYER_FR = { top: "Cuivre dessus", ...Object.fromEntries(Array.from({ length: MAX_INNER }, (_, i) => [`in${i + 1}`, `Cuivre interne ${i + 1}`])), bottom: "Cuivre dessous" };
/** The planes an n-layer board gets when its count is chosen : the ground on the first inner layer, the biggest rail on the last one ;
    the inner layers between stay for signals. 2 layers : none. */
export function defaultPlanes(board, n) {
  const k = layerCount(n); if (k < 4) return [];
  const gnd = (board.nets || []).find((x) => x.class === "ground"), rail = (board.nets || []).filter((x) => x.class === "power").sort((p, q) => q.pins.length - p.pins.length)[0];
  return [gnd && { net: gnd.name, layer: "in1" }, rail && { net: rail.name, layer: `in${k - 2}` }].filter(Boolean);
}

/** What a board shop holds without a surcharge ("standard") or with its fine-line service ("fin"). Typical values:
    the capabilities sheet of the chosen shop prevails. */
export const FAB = {
  standard: { label: "Prototype standard", track: 0.15, space: 0.15, drill: 0.3, ring: 0.15, viaD: 0.6, edge: 0.3, holeGap: 0.5, maskDam: 0.1, maskExp: 0.05, silk: 0.15, silkH: 1.0 },
  fin: { label: "Classe fine", track: 0.1, space: 0.1, drill: 0.2, ring: 0.125, viaD: 0.45, edge: 0.25, holeGap: 0.4, maskDam: 0.08, maskExp: 0.05, silk: 0.12, silkH: 0.8 },
};
/** Net classes every board starts with ; a board may redefine them or add its own in rules.classes. `track` is the
    width the router prefers, `clearance` the smallest gap to other nets ; both grow with the current and the voltage
    of each net (netRules). Clearances stay within what a 0.5 mm pitch package allows. */
export const CLASSES = {
  signal: { label: "Signal", track: 0.25, clearance: 0.15, via: [0.6, 0.3] },
  power: { label: "Puissance", track: 0.5, clearance: 0.2, via: [0.8, 0.4] },
  ground: { label: "Masse", track: 0.5, clearance: 0.2, via: [0.8, 0.4] },
  hv: { label: "Haute tension", track: 0.6, clearance: 0.6, via: [0.8, 0.4] },
};
export const COATINGS = { none: "Aucun vernis", AR: "Acrylique (AR)", UR: "Polyuréthane (UR)", SR: "Silicone (SR)", XY: "Parylène (XY)" };

/** Track width (mm) that carries I amperes with a temperature rise dT, IPC-2221 : I = k dT^0.44 A^0.725 (A in mil²). */
export function trackForCurrent(I, copper = 35, dT = 10, inner = false) {
  if (!(I > 0)) return 0;
  const k = inner ? 0.024 : 0.048, area = (I / (k * dT ** 0.44)) ** (1 / 0.725), mil = copper / 25.4;      // copper µm → mil
  return Math.round(area / mil * 0.0254 * 100) / 100;
}

const quarter = (rot) => (((Math.round((rot || 0) / 90) % 4) + 4) % 4);
/** Local point of a part → board coordinates. */
export function place(pt, part) {
  let x = pt[0], y = pt[1];
  if ((part.side || "top") === "bottom") x = -x;
  for (let q = quarter(part.rot); q > 0; q--) [x, y] = [-y, x];
  return [x + part.at[0], y + part.at[1]];
}
/** Size [w, h] of a local rectangle once the part is rotated. */
export const turned = (w, h, rot) => (quarter(rot) % 2 ? [h, w] : [w, h]);

/** Outline of the board as a closed polygon, counter-clockwise ; rounded corners become 8 chords each. */
export function outlineOf(b) {
  if (Array.isArray(b.outline) && b.outline.length >= 3) return b.outline.map((p) => [+p[0], +p[1]]);
  const [w, h] = b.size || [50, 50], r = Math.max(0, Math.min(b.r || 0, w / 2, h / 2));
  if (!r) return [[0, 0], [w, 0], [w, h], [0, h]];
  const pts = [], corner = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = (a0 + i * 90 / 8) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  corner(w - r, r, -90); corner(w - r, h - r, 0); corner(r, h - r, 90); corner(r, r, 180);
  return pts;
}

/** Rules of one net : its class (the board's own, else the defaults), widened for its current and its voltage. */
export function netRules(board, net) {
  const b = board.board || {}, own = (board.rules && board.rules.classes) || {}, name = (net && net.class) || "signal";
  const c = { ...(CLASSES[name] || CLASSES.signal), ...(own[name] || {}) }, fab = FAB[(board.rules && board.rules.fab) || "standard"] || FAB.standard;
  const coated = b.coating && b.coating.type && b.coating.type !== "none";
  const need = net && net.current > 0 ? trackForCurrent(net.current, b.copper || 35) : 0, gap = net && Math.abs(net.voltage) > 0 ? ipcSpacing(Math.abs(net.voltage), coated ? "A5" : "B2") : 0;
  return { class: name, track: Math.max(c.track, need, fab.track), clearance: Math.max(c.clearance, gap || 0, fab.space), via: [Math.max(c.via[0], fab.viaD), Math.max(c.via[1], fab.drill)], need, gap: gap || 0 };
}

/** The library seen by a board : the trade library, then the board's own components over it. */
export const libraryOf = (board, lib = {}) => ({ ...lib, ...((board && board.library) || {}) });

/** Pads of the pin `key` (a pad number or a pin name) of a component. */
export function padsOfPin(comp, key) {
  const k = String(key), ns = new Set((comp.pins || []).filter((p) => String(p.n) === k || p.name === k).map((p) => String(p.n)));
  if (!ns.size) ns.add(k);
  return (comp.pads || []).filter((p) => ns.has(String(p.n)));
}

/** A board document → absolute geometry, ready to draw, check, route and manufacture.
    { w, h, outline, bbox, layers, parts, pads, holes, tracks, vias, planes, nets, netOf, rules, fab, problems }
    parts: [{ ref, comp, def, kind, value, block, x, y, rot, side, w, h, z, box: [x0, y0, x1, y1], coat, dnp, fixed }]
    pads:  [{ ref, pin: "U1.3", n, name, type, net, x, y, w, h, shape, drill, plated, layers: [copper layers], side }]
    nets:  [{ name, class, voltage, current, pads: [indices in pads], rules }]  */
export function resolveBoard(board, lib = {}) {
  const L = libraryOf(board, lib), b = board.board || {}, layers = copperLayers(b.layers || 2), outline = outlineOf(b), problems = [];
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]), bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const parts = [], pads = [], byRef = new Map();
  for (const p of board.parts || []) {
    const def = L[p.comp];
    if (!def) { problems.push(`${p.ref} : composant « ${p.comp} » absent de la bibliothèque.`); continue; }
    if (byRef.has(p.ref)) { problems.push(`Repère « ${p.ref} » utilisé deux fois.`); continue; }
    const part = { ...p, at: p.at || [0, 0], side: p.side || "top", rot: quarter(p.rot) * 90 }, [bw, bh] = turned(def.body[0], def.body[1], part.rot), cy = def.courtyard || [def.body[0] + 0.5, def.body[1] + 0.5], [cw, ch] = turned(cy[0], cy[1], part.rot);
    const out = { ref: p.ref, comp: p.comp, def, kind: def.kind, value: p.value || "", block: p.block || null, x: part.at[0], y: part.at[1], rot: part.rot, side: part.side, w: bw, h: bh, z: def.body[2],
      box: [part.at[0] - cw / 2, part.at[1] - ch / 2, part.at[0] + cw / 2, part.at[1] + ch / 2], coat: def.coat !== false, dnp: !!p.dnp, fixed: !!p.fixed, pads: [] };
    byRef.set(p.ref, out); parts.push(out);
    for (const pad of def.pads || []) {
      const [x, y] = place([pad.x, pad.y], part), [w, h] = turned(pad.w, pad.h, part.rot), pin = (def.pins || []).find((q) => String(q.n) === String(pad.n)) || {}, tht = pad.drill > 0;
      out.pads.push(pads.length);
      pads.push({ ref: p.ref, pin: `${p.ref}.${pad.n}`, n: String(pad.n), name: pin.name || String(pad.n), type: pin.type || "passive", net: null, x, y, w, h, shape: pad.shape || "rect",
        drill: pad.drill || 0, plated: tht ? pad.plated !== false : false, layers: tht ? layers : [part.side === "bottom" ? "bottom" : "top"], side: part.side });
    }
  }
  const nets = [], netOf = new Map();
  for (const n of board.nets || []) {
    const net = { name: n.name, class: n.class || "signal", voltage: n.voltage || 0, current: n.current || 0, pads: [], rules: netRules(board, n) };
    for (const pin of n.pins || []) {
      const dot = String(pin).indexOf("."), ref = String(pin).slice(0, dot), key = String(pin).slice(dot + 1), part = byRef.get(ref);
      if (!part) { problems.push(`Net ${n.name} : repère « ${ref} » inconnu.`); continue; }
      const found = padsOfPin(part.def, key);
      if (!found.length) { problems.push(`Net ${n.name} : ${ref} n'a pas de broche « ${key} ».`); continue; }
      for (const i of part.pads) {
        if (!found.some((f) => String(f.n) === pads[i].n)) continue;
        if (pads[i].net && pads[i].net !== n.name) { problems.push(`${pads[i].pin} est sur deux nets : ${pads[i].net} et ${n.name}.`); continue; }
        if (!pads[i].net) { pads[i].net = n.name; net.pads.push(i); netOf.set(pads[i].pin, n.name); }
      }
    }
    nets.push(net);
  }
  const byNet = new Map(nets.map((n) => [n.name, n])), fab = FAB[(board.rules && board.rules.fab) || "standard"] || FAB.standard;
  const of = (name) => (byNet.get(name) || { rules: netRules(board, null) }).rules;
  return { id: board.id, w: bbox[2] - bbox[0], h: bbox[3] - bbox[1], t: b.t || 1.6, outline, bbox, layers, parts, pads,
    holes: (b.holes || []).map((x) => ({ x: x.at[0], y: x.at[1], d: x.d, plated: !!x.plated, land: x.land || 2 * x.d, kind: x.kind || "mount" })),
    tracks: (board.tracks || []).map((t) => ({ net: t.net, layer: t.layer, w: t.w, pts: t.pts })), vias: (board.vias || []).map((v) => ({ net: v.net, x: v.at[0], y: v.at[1], d: v.d, drill: v.drill })),
    planes: (board.planes || []).map((p) => ({ net: p.net, layer: p.layer, inset: p.inset ?? 0.5 })), nets, netOf, fab, problems,
    rules: { of, clearance: (a, c) => (a && a === c ? 0 : Math.max(of(a).clearance, of(c).clearance)) } };
}

/** An empty board, with the defaults of a quick prototype : 2 layers, 1.6 mm, 35 µm, lead-free finish, acrylic coating off. */
export function emptyBoard(id, name = "Nouvelle carte") {
  return { dw: `board/${BOARD_VERSION}`, id, name, description: "", revision: "A", functions: [], blocks: [], parts: [], nets: [],
    board: { size: [60, 40], r: 1, t: 1.6, layers: 2, copper: 35, finish: "ENIG", mask: "vert", silk: "blanc", coating: { type: "none", thickness: 50, sides: "both" }, holes: [] },
    rules: { fab: "standard", classes: {} }, tracks: [], vias: [], planes: [] };
}

/** Bill of materials : one line per component and value, repères grouped. */
export function boardBom(board, lib = {}) {
  const L = libraryOf(board, lib), lines = new Map();
  for (const p of board.parts || []) {
    const def = L[p.comp]; if (!def) continue;
    const key = `${p.comp}|${p.value || ""}|${p.mpn || ""}|${p.dnp ? 1 : 0}`;
    if (!lines.has(key)) lines.set(key, { comp: p.comp, kind: def.kind, name: def.name, package: def.package || "", value: p.value || "", mpn: p.mpn || def.mpn || "", maker: def.maker || "", refs: [], qty: 0, price: def.price || 0, dnp: !!p.dnp, tht: (def.pads || []).some((x) => x.drill > 0) });
    const l = lines.get(key); l.refs.push(p.ref); l.qty++;
  }
  const natural = (a, c) => a.localeCompare(c, "fr", { numeric: true });
  return [...lines.values()].map((l) => ({ ...l, refs: l.refs.sort(natural), total: l.dnp ? 0 : l.qty * l.price })).sort((a, c) => natural(a.refs[0], c.refs[0]));
}

/** Next free repère for a prefix : "R" → "R7". */
export function nextRef(board, prefix) {
  let n = 0;
  for (const p of board.parts || []) { const m = new RegExp(`^${prefix}(\\d+)$`).exec(p.ref); if (m) n = Math.max(n, +m[1]); }
  return `${prefix}${n + 1}`;
}
