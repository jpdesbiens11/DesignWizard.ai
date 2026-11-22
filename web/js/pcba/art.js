/* DesignOrbit.ai — PCBA: the artwork of every layer of a resolved board — what the screen draws, what the Gerber
   files hold and what the review report prints, from one single description.
   A primitive is, in board millimetres (Y up) :
     { t: "pad", x, y, w, h, shape, net, ref, pin, clear }     a flashed land
     { t: "track", w, pts, net, clear }                        a stroke with a round pen (copper, silkscreen, text)
     { t: "circle", x, y, d, net, clear }                      a filled disc
     { t: "region", pts, net, clear }                          a filled polygon
   `clear: true` removes what is under it (negative polarity) ; the order of the primitives of a layer matters. */

import { textStrokes, textWidth } from "./strokefont.js";
import { COATINGS } from "./model.js";

export const LAYER_NAMES = { top: "Cuivre dessus", in1: "Cuivre interne 1", in2: "Cuivre interne 2", bottom: "Cuivre dessous", mask_top: "Vernis épargne dessus", mask_bottom: "Vernis épargne dessous",
  paste_top: "Pâte à braser dessus", paste_bottom: "Pâte à braser dessous", silk_top: "Sérigraphie dessus", silk_bottom: "Sérigraphie dessous", coat_top: "Vernis de tropicalisation dessus",
  coat_bottom: "Vernis de tropicalisation dessous", fab_top: "Plan d'assemblage dessus", fab_bottom: "Plan d'assemblage dessous", outline: "Contour de la carte" };
const BARE = { connector: "connecteur : les contacts doivent rester nus", terminal: "bornier : les contacts doivent rester nus", switch: "organe de commande", testpoint: "point de test", fiducial: "mire de placement" };

const hit = (a, b, m = 0) => a[0] < b[2] + m && b[0] < a[2] + m && a[1] < b[3] + m && b[1] < a[3] + m;
const rect = (b, extra = {}) => ({ t: "region", pts: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], ...extra });
const ring = (x, y, r, w, n = 32) => ({ t: "track", w, pts: Array.from({ length: n + 1 }, (_, i) => [x + r * Math.cos(2 * Math.PI * i / n), y + r * Math.sin(2 * Math.PI * i / n)]) });
const closed = (o) => [...o, o[0]];
const sides = (board) => { const c = (board.board || {}).coating || {}; return !c.type || c.type === "none" ? [] : c.sides === "top" ? ["top"] : ["top", "bottom"]; };

/** Areas the conformal coating must leave bare. → [{ ref | hole, side, box, why }] */
export function coatingKeepouts(R, board) {
  const out = [];
  for (const side of sides(board)) {
    for (const p of R.parts) if (!p.coat && p.side === side) out.push({ ref: p.ref, side, box: [p.box[0] - 1, p.box[1] - 1, p.box[2] + 1, p.box[3] + 1], why: BARE[p.kind] || "ne doit pas être verni" });
    R.holes.forEach((h, i) => out.push({ hole: i + 1, side, box: [h.x - h.land / 2 - 0.5, h.y - h.land / 2 - 0.5, h.x + h.land / 2 + 0.5, h.y + h.land / 2 + 0.5], why: "appui de la tête de vis" }));
  }
  return out;
}

/** The lines of a rectangle outline, cut wherever they would cross one of the boxes. */
function outlineCut(b, boxes, min = 0.3) {
  const segs = [[[b[0], b[1]], [b[2], b[1]]], [[b[2], b[1]], [b[2], b[3]]], [[b[2], b[3]], [b[0], b[3]]], [[b[0], b[3]], [b[0], b[1]]]], out = [];
  for (const [p, q] of segs) {
    const horiz = Math.abs(p[1] - q[1]) < 1e-9, ax = horiz ? 0 : 1, fixed = p[1 - ax], lo = Math.min(p[ax], q[ax]), hi = Math.max(p[ax], q[ax]);
    let free = [[lo, hi]];
    for (const k of boxes) {
      if (fixed <= k[1 - ax] || fixed >= k[3 - ax]) continue;
      free = free.flatMap(([a, c]) => (k[ax] >= c || k[2 + ax] <= a ? [[a, c]] : [[a, Math.min(c, k[ax])], [Math.max(a, k[2 + ax]), c]].filter(([u, v]) => v - u > 1e-9)));
    }
    for (const [a, c] of free) if (c - a >= min) out.push(horiz ? [[a, fixed], [c, fixed]] : [[fixed, a], [fixed, c]]);
  }
  return out;
}

/** Artwork of a resolved board. → { layers: { key: [primitives] }, drills, order, names, notes } */
export function layerArt(R, board) {
  const fab = R.fab, e = fab.maskExp, layers = {}, notes = [], coat = sides(board), b = board.board || {};
  const order = [...R.layers, "mask_top", "mask_bottom", "paste_top", "paste_bottom", "silk_top", "silk_bottom", ...coat.map((s) => `coat_${s}`), "fab_top", "fab_bottom", "outline"];
  for (const k of order) layers[k] = [];
  const kindOf = new Map(R.parts.map((p) => [p.ref, p])), onSide = (pad, side) => pad.layers.includes(side);

  /* ---------- copper : planes first (with their clearances), then lands, tracks and vias ---------- */
  for (const pl of R.planes) {
    const L = layers[pl.layer]; if (!L) continue;
    L.push({ t: "region", pts: R.outline, net: pl.net }, { t: "track", w: 2 * Math.max(pl.inset, fab.edge), pts: closed(R.outline), clear: true });
    const gapTo = (net) => R.rules.clearance(pl.net, net);
    for (const p of R.pads) if (p.net !== pl.net && onSide(p, pl.layer)) L.push({ t: "pad", x: p.x, y: p.y, w: p.w + 2 * gapTo(p.net), h: p.h + 2 * gapTo(p.net), shape: p.shape === "rect" ? "rect" : p.shape, clear: true });
    for (const v of R.vias) if (v.net !== pl.net) L.push({ t: "circle", x: v.x, y: v.y, d: v.d + 2 * gapTo(v.net), clear: true });
    for (const t of R.tracks) if (t.layer === pl.layer && t.net !== pl.net) L.push({ t: "track", w: t.w + 2 * gapTo(t.net), pts: t.pts, clear: true });
    for (const h of R.holes) L.push({ t: "circle", x: h.x, y: h.y, d: Math.max(h.land, h.d) + 1, clear: true });
  }
  for (const p of R.pads) for (const l of p.layers) if (layers[l]) layers[l].push({ t: "pad", x: p.x, y: p.y, w: p.w, h: p.h, shape: p.shape, net: p.net, ref: p.ref, pin: p.pin });
  R.tracks.forEach((t, k) => { if (layers[t.layer]) layers[t.layer].push({ t: "track", w: t.w, pts: t.pts, net: t.net, ti: k }); });      // ti, vi : which track, which via — so that a screen can pick one
  R.vias.forEach((v, k) => { for (const l of R.layers) layers[l].push({ t: "circle", x: v.x, y: v.y, d: v.d, net: v.net, vi: k }); });
  for (const h of R.holes) if (h.plated) for (const l of R.layers) layers[l].push({ t: "circle", x: h.x, y: h.y, d: h.land, net: null });

  /* ---------- solder mask openings, paste, silkscreen, assembly drawing : one pass per side ---------- */
  for (const side of ["top", "bottom"]) {
    const mask = layers[`mask_${side}`], paste = layers[`paste_${side}`], silk = layers[`silk_${side}`], asm = layers[`fab_${side}`], open = [], mirror = side === "bottom";
    for (const p of R.pads) {
      if (!onSide(p, side)) continue;
      const part = kindOf.get(p.ref), fid = part && part.kind === "fiducial";
      if (fid) { mask.push({ t: "circle", x: p.x, y: p.y, d: 2 * p.w }); open.push([p.x - p.w, p.y - p.w, p.x + p.w, p.y + p.w]); continue; }
      mask.push({ t: "pad", x: p.x, y: p.y, w: p.w + 2 * e, h: p.h + 2 * e, shape: p.shape });
      open.push([p.x - p.w / 2 - e, p.y - p.h / 2 - e, p.x + p.w / 2 + e, p.y + p.h / 2 + e]);
      if (!p.drill && part && !part.dnp && part.kind !== "testpoint") paste.push({ t: "pad", x: p.x, y: p.y, w: p.w, h: p.h, shape: p.shape });
    }
    for (const h of R.holes) { const d = h.plated ? h.land + 2 * e : h.d + 0.2; mask.push({ t: "circle", x: h.x, y: h.y, d }); open.push([h.x - d / 2, h.y - d / 2, h.x + d / 2, h.y + d / 2]); asm.push(ring(h.x, h.y, h.d / 2, 0.1)); }
    const here = R.parts.filter((p) => p.side === side), bodies = here.map((p) => [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2]), texts = [], keep = open.map((k) => [k[0] - 0.1 - fab.silk / 2, k[1] - 0.1 - fab.silk / 2, k[2] + 0.1 + fab.silk / 2, k[3] + 0.1 + fab.silk / 2]);
    const inside = (k) => k[0] >= R.bbox[0] + 0.3 && k[1] >= R.bbox[1] + 0.3 && k[2] <= R.bbox[2] - 0.3 && k[3] <= R.bbox[3] - 0.3;
    const freeBox = (k, self) => inside(k) && !keep.some((o) => hit(k, o)) && !texts.some((o) => hit(k, o, 0.15)) && !bodies.some((o, i) => i !== self && hit(k, o, 0.1));
    const write = (L, text, x, y, h, rot = 0) => { for (const pts of textStrokes(text, { x, y, h, rot, mirror, align: "center" })) L.push({ t: "track", w: Math.max(fab.silk, h * 0.13), pts }); };
    here.forEach((p, i) => {
      const body = bodies[i], h = fab.silkH, w = textWidth(p.ref, h), tall = p.h > p.w * 1.3;
      if (p.kind !== "fiducial" && p.kind !== "testpoint") for (const pts of outlineCut([body[0] - 0.15, body[1] - 0.15, body[2] + 0.15, body[3] + 0.15], keep)) silk.push({ t: "track", w: fab.silk, pts });
      const p1 = p.def.polar && p.pads.length ? R.pads[p.pads[0]] : null;
      if (p1) {                                                    // pin 1 : a dot outside the body corner nearest to it
        const cx = p1.x < p.x ? body[0] - 0.55 : body[2] + 0.55, cy = p1.y < p.y ? body[1] - 0.55 : body[3] + 0.55, k = [cx - 0.3, cy - 0.3, cx + 0.3, cy + 0.3];
        if (freeBox(k, i)) { silk.push({ t: "circle", x: cx, y: cy, d: 0.5 }); texts.push(k); }
        asm.push({ t: "circle", x: p1.x < p.x ? body[0] + Math.min(0.5, p.w / 4) : body[2] - Math.min(0.5, p.w / 4), y: p1.y < p.y ? body[1] + Math.min(0.5, p.h / 4) : body[3] - Math.min(0.5, p.h / 4), d: Math.min(0.4, p.w / 4, p.h / 4) });
      }
      const spots = p.kind === "fiducial" ? [] : [[p.x, p.box[3] + 0.2], [p.x, p.box[1] - 0.2 - h], [p.box[2] + 0.3 + w / 2, p.y - h / 2], [p.box[0] - 0.3 - w / 2, p.y - h / 2], [p.x, body[3] + 0.3], [p.x, body[1] - 0.3 - h]];
      const spot = spots.find(([x, y]) => freeBox([x - w / 2 - 0.1, y - 0.1, x + w / 2 + 0.1, y + h + 0.1], i));
      if (spot) { write(silk, p.ref, spot[0], spot[1], h); texts.push([spot[0] - w / 2 - 0.1, spot[1] - 0.1, spot[0] + w / 2 + 0.1, spot[1] + h + 0.1]); }
      else if (p.kind !== "fiducial") notes.push(`Repère ${p.ref} non sérigraphié (${side === "top" ? "dessus" : "dessous"}) : pas de place libre à côté du composant.`);
      asm.push({ t: "track", w: 0.1, pts: closed(rect(body).pts) });
      const fh = Math.min(1.2, 0.6 * Math.min(p.w, p.h) + 0.2, 0.9 * (tall ? p.h : p.w) * 6 / (p.ref.length * 6 - 2));
      if (fh >= 0.35) write(asm, p.ref, p.x + (tall ? (mirror ? -fh / 2 : fh / 2) : 0), p.y - (tall ? 0 : fh / 2), fh, tall ? 90 : 0);
    });
    const tag = `${R.id || ""} REV ${board.revision || "A"}`, th = 1.2, tw = textWidth(tag, th);              // board number and revision, once, near a free corner
    if (side === "top") { const at = [[R.bbox[0] + 4 + tw / 2, R.bbox[1] + 1], [R.bbox[2] - 4 - tw / 2, R.bbox[1] + 1], [R.bbox[0] + 4 + tw / 2, R.bbox[3] - 1 - th], [R.bbox[2] - 4 - tw / 2, R.bbox[3] - 1 - th], [(R.bbox[0] + R.bbox[2]) / 2, R.bbox[1] + 1]].find(([x, y]) => freeBox([x - tw / 2 - 0.2, y - 0.2, x + tw / 2 + 0.2, y + th + 0.2], -1));
      if (at) write(silk, tag, at[0], at[1], th); else notes.push("Numéro et révision de la carte non sérigraphiés : pas de place libre."); }
    asm.push({ t: "track", w: 0.1, pts: closed(R.outline) });
  }

  /* ---------- conformal coating : everything, except what must stay bare ---------- */
  for (const side of coat) { const L = layers[`coat_${side}`]; L.push({ t: "region", pts: R.outline }); for (const k of coatingKeepouts(R, board)) if (k.side === side) L.push(rect(k.box, { clear: true })); }
  layers.outline.push({ t: "track", w: 0.1, pts: closed(R.outline) });

  const drills = [];
  for (const p of R.pads) if (p.drill) drills.push({ x: p.x, y: p.y, d: p.drill, plated: p.plated, kind: "pad", ref: p.ref, net: p.net });
  for (const v of R.vias) drills.push({ x: v.x, y: v.y, d: v.drill, plated: true, kind: "via", net: v.net });
  for (const h of R.holes) drills.push({ x: h.x, y: h.y, d: h.d, plated: h.plated, kind: "hole" });
  if (coat.length) notes.push(`Vernis de tropicalisation ${COATINGS[b.coating.type] || b.coating.type}, ${b.coating.thickness || 50} µm, ${coat.length === 2 ? "deux faces" : "dessus seulement"} : ${coatingKeepouts(R, board).length} zone(s) à épargner.`);
  return { layers, drills, order, names: LAYER_NAMES, notes };
}
