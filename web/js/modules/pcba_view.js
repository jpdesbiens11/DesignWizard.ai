/* DynamiteOrbit — PCBA screen: the board canvas. Draws the artwork of art.js layer by layer (the same primitives the
   Gerber files hold), the zones of the conceptual layout, the connections still to route and the findings ; lets the
   designer zoom, pan, pick a net, drag a zone or a part. Board millimetres, Y up. */

import { el, svg } from "../core/dom.js";
import { viewBar } from "../core/view_bar.js";
import { boardProse } from "../pcba/board_units.js";

export const LAYER_STYLE = { bottom: ["#2f6fc8", 0.8], in2: ["#3fa36b", 0.55], in1: ["#c89b2f", 0.55], top: ["#c8402f", 0.85], mask_bottom: ["#1f7a4d", 0.35], mask_top: ["#1f7a4d", 0.35], paste_bottom: ["#8a8f98", 0.8], paste_top: ["#8a8f98", 0.8],
  silk_bottom: ["#7c6fb0", 0.9], silk_top: ["#3b3f46", 0.95], coat_bottom: ["#27a7c9", 0.22], coat_top: ["#27a7c9", 0.22], fab_bottom: ["#7c6fb0", 0.9], fab_top: ["#5a6472", 0.95], outline: ["#20242a", 1] };
export const DRAW_ORDER = ["coat_bottom", "bottom", "mask_bottom", "paste_bottom", "silk_bottom", "fab_bottom", "in2", "in1", "top", "mask_top", "paste_top", "silk_top", "fab_top", "coat_top", "outline"];
const pts = (list) => list.map((p) => `${p[0]},${p[1]}`).join(" ");
let uid = 0;

/** One primitive as an SVG node. */
function shape(p, color) {
  if (p.t === "pad") return (p.shape || "rect") === "rect" ? svg("rect", { x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h, fill: color }) : svg("rect", { x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h, rx: Math.min(p.w, p.h) / 2, fill: color });
  if (p.t === "circle") return svg("circle", { cx: p.x, cy: p.y, r: p.d / 2, fill: color });
  if (p.t === "region") return svg("polygon", { points: pts(p.pts), fill: color });
  return p.pts.length < 2 || (p.pts.length === 2 && p.pts[0][0] === p.pts[1][0] && p.pts[0][1] === p.pts[1][1]) ? svg("circle", { cx: p.pts[0][0], cy: p.pts[0][1], r: p.w / 2, fill: color })
    : svg("polyline", { points: pts(p.pts), fill: "none", stroke: color, "stroke-width": p.w, "stroke-linecap": "round", "stroke-linejoin": "round" });
}
/** A layer as a group ; what comes before the last clearing primitive is drawn through a mask that the clearings cut. */
function layerGroup(key, prims, bbox, net) {
  const [color, alpha] = LAYER_STYLE[key] || ["#666", 0.8], g = svg("g", { class: `pv-layer pv-${key}`, opacity: alpha }), last = prims.reduce((k, p, i) => (p.clear ? i : k), -1);
  if (last >= 0) {
    const id = `pvm${++uid}`, mask = svg("mask", { id, maskUnits: "userSpaceOnUse", x: bbox[0] - 2, y: bbox[1] - 2, width: bbox[2] - bbox[0] + 4, height: bbox[3] - bbox[1] + 4 }, svg("rect", { x: bbox[0] - 2, y: bbox[1] - 2, width: bbox[2] - bbox[0] + 4, height: bbox[3] - bbox[1] + 4, fill: "#fff" }));
    const under = svg("g", { mask: `url(#${id})`, opacity: key.startsWith("coat") ? 1 : 0.45 });
    prims.slice(0, last + 1).forEach((p) => (p.clear ? mask : under).append(shape(p, p.clear ? "#000" : color)));
    g.append(svg("defs", null, mask), under);
  }
  for (const p of prims.slice(last + 1)) { const n = shape(p, net && p.net === net ? "#f5b301" : color); if (p.net) n.dataset.net = p.net; if (p.pin) n.dataset.pin = p.pin; if (p.ti !== undefined) n.dataset.track = p.ti; if (p.vi !== undefined) n.dataset.via = p.vi; g.append(n); }
  return g;
}

/** The canvas. → { show(scene), fit(), focus([x, y]), destroy() }
    scene : { R, art, board, layers: Set, zones, ratsnest, findings, net, ref, mode: "zones" | "parts" | "blocks" | "trace" | null, block,
              corners: { pts, w } (handles on a track), onPick, onHover(at), onMoveZone, onMovePart, onMoveBlock, onMoveCorner(index, delta) } */
export function boardView(host) {
  host.classList.add("pcba-view");
  const root = svg("svg", { class: "pv-svg", preserveAspectRatio: "xMidYMid meet" }), world = svg("g", { transform: "scale(1,-1)" });
  root.append(world); host.append(root);
  let scene = null, vb = null, drag = null, vbFit = null;
  /* the bar of the view (core/view_bar.js) : − % + , « Ajuster », the magnifier ; 100 % is the board fitted in the window */
  const zoomBy = (k) => { if (!vb) return; const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, w = Math.min(600, Math.max(4, vb[2] * k)), s = w / vb[2]; vb = [cx - w / 2, cy - (vb[3] * s) / 2, w, vb[3] * s]; setVb(); };
  const bar = viewBar({ label: "la carte", zoomOut: () => zoomBy(1.25), zoomIn: () => zoomBy(1 / 1.25), fit: () => fit(), text: () => (vb && vbFit ? `${Math.round((100 * vbFit[2]) / vb[2])} %` : "100 %"), fitTip: "Ajuster à la fenêtre : toute la carte se voit" });
  bar.node.classList.add("view-float"); host.append(bar.node);
  const setVb = () => { root.setAttribute("viewBox", `${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}`); bar.update(); };
  const toBoard = (e) => { const r = root.getBoundingClientRect(), k = Math.max(vb[2] / r.width, vb[3] / r.height), ox = (r.width * k - vb[2]) / 2, oy = (r.height * k - vb[3]) / 2; return [vb[0] - ox + (e.clientX - r.left) * k, -(vb[1] - oy + (e.clientY - r.top) * k)]; };
  const fit = () => { if (!scene) return; const b = scene.R.bbox, m = 4; vb = [b[0] - m, -b[3] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m]; vbFit = [...vb]; setVb(); };
  root.addEventListener("wheel", (e) => { if (!vb) return; e.preventDefault(); const p = toBoard(e), k = e.deltaY > 0 ? 1.2 : 1 / 1.2, w = Math.min(600, Math.max(4, vb[2] * k)), s = w / vb[2]; vb = [p[0] - (p[0] - vb[0]) * s, -p[1] - (-p[1] - vb[1]) * s, w, vb[3] * s]; setVb(); }, { passive: false });
  root.addEventListener("pointerdown", (e) => {
    if (!scene) return;
    const t = e.target, p = toBoard(e), hit = t.closest && t.closest("[data-drag]");
    root.setPointerCapture(e.pointerId);
    if (hit && scene.mode) { drag = { kind: hit.dataset.drag, id: hit.dataset.id, node: hit, from: p, moved: false, grip: hit.dataset.grip === "1" };
      if (scene.mode === "blocks" && hit.dataset.block) { drag.block = hit.dataset.block; drag.group = [...world.querySelectorAll("[data-drag='part']")].filter((n) => n.dataset.block === drag.block); } }      // a block moves as one brick
    else drag = { kind: "pan", from: [e.clientX, e.clientY], vb: [...vb], moved: false, target: t };
  });
  let hoverAt = null, hoverTick = 0;
  root.addEventListener("pointermove", (e) => {
    if (!drag) { if (scene && scene.onHover) { hoverAt = toBoard(e); if (!hoverTick) hoverTick = requestAnimationFrame(() => { hoverTick = 0; if (scene && scene.onHover && hoverAt) scene.onHover(hoverAt); }); } return; }
    if (drag.kind === "pan") { const r = root.getBoundingClientRect(), k = Math.max(vb[2] / r.width, vb[3] / r.height), dx = e.clientX - drag.from[0], dy = e.clientY - drag.from[1]; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; vb = [drag.vb[0] - dx * k, drag.vb[1] - dy * k, vb[2], vb[3]]; setVb(); return; }
    const p = toBoard(e), d = [p[0] - drag.from[0], p[1] - drag.from[1]]; drag.delta = d; if (Math.abs(d[0]) + Math.abs(d[1]) > 0.2) drag.moved = true;
    if (drag.grip) { const r = drag.node.parentNode.querySelector("rect"); r.setAttribute("width", Math.max(3, +r.dataset.w + d[0])); r.setAttribute("y", +r.dataset.y + Math.min(d[1], +r.dataset.h - 3)); r.setAttribute("height", Math.max(3, +r.dataset.h - d[1])); }
    else for (const n of drag.group || [drag.kind === "zone" ? drag.node.parentNode : drag.node]) n.setAttribute("transform", `translate(${d[0]},${d[1]})`);
  });
  root.addEventListener("pointerup", (e) => {
    const d = drag; drag = null; if (!d || !scene) return;
    if (d.kind === "pan") { if (!d.moved && scene.onPick) { const t = d.target, ds = t.dataset || {}; scene.onPick({ net: ds.net || null, pin: ds.pin || null, track: ds.track !== undefined ? +ds.track : undefined, via: ds.via !== undefined ? +ds.via : undefined, at: toBoard(e) }); } return; }
    if (d.kind === "corner") { if (d.moved && scene.onMoveCorner) scene.onMoveCorner(+d.id, d.delta); return; }
    if (!d.moved) { if (d.kind === "part" && scene.onPick) scene.onPick({ ref: d.id, block: d.block || null, at: toBoard(e) }); return; }
    if (d.kind === "zone" && scene.onMoveZone) scene.onMoveZone(d.id, d.delta, d.grip);
    if (d.kind === "part" && d.group && scene.onMoveBlock) scene.onMoveBlock(d.block, d.delta);
    else if (d.kind === "part" && scene.onMovePart) scene.onMovePart(d.id, d.delta);
  });

  function show(s) {
    const first = !scene || scene.R.id !== s.R.id || scene.R.w !== s.R.w || scene.R.h !== s.R.h; scene = s;
    while (world.firstChild) world.removeChild(world.firstChild);
    const { R, art } = s, on = s.layers || new Set(DRAW_ORDER);
    world.append(svg("polygon", { class: "pv-board", points: pts(R.outline) }));
    for (const h of R.holes) world.append(svg("circle", { class: "pv-hole-land", cx: h.x, cy: h.y, r: h.land / 2 }));
    for (const key of DRAW_ORDER) if (on.has(key) && art.layers[key] && art.layers[key].length) world.append(layerGroup(key, art.layers[key], R.bbox, s.net));
    for (const d of art.drills) world.append(svg("circle", { class: "pv-drill", cx: d.x, cy: d.y, r: d.d / 2 }));
    if (s.zones) for (const b of s.board.blocks || []) {
      if (!Array.isArray(b.zone)) continue;
      const z = b.zone, g = svg("g", { class: "pv-zone" }), r = svg("rect", { x: z[0], y: z[1], width: z[2], height: z[3], "data-drag": s.mode === "zones" ? "zone" : null, "data-id": b.id, "data-w": z[2], "data-h": z[3], "data-y": z[1] });
      g.append(r, svg("text", { x: z[0] + 0.8, y: -(z[1] + z[3] - 2.4), transform: "scale(1,-1)", class: "pv-zone-name" }, `${b.id} ${b.name}`.slice(0, Math.max(3, Math.floor(z[2] / 1.2)))));
      if (s.mode === "zones") g.append(svg("rect", { class: "pv-grip", x: z[0] + z[2] - 1.6, y: z[1], width: 1.6, height: 1.6, "data-drag": "zone", "data-id": b.id, "data-grip": "1" }));
      world.append(g);
    }
    const grab = s.mode === "parts" || s.mode === "blocks";
    if (grab || s.ref) for (const p of R.parts) {
      const sel = p.ref === s.ref, mate = s.mode === "blocks" && s.block && p.block === s.block;
      if (grab || sel) world.append(svg("rect", { class: `pv-part${sel ? " sel" : ""}${mate ? " blk" : ""}${p.fixed ? " fixed" : ""}`, x: p.box[0], y: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1], "data-drag": grab && !p.fixed ? "part" : null, "data-id": p.ref, "data-block": p.block || null }, svg("title", null, `${p.ref} — ${p.def.name}${p.value ? ` — ${p.value}` : ""}`)));
    }
    if (s.corners) s.corners.pts.forEach((q, k) => world.append(svg("circle", { class: "pv-corner", cx: q[0], cy: q[1], r: Math.max(0.3, s.corners.w * 0.8), "data-drag": "corner", "data-id": k }, svg("title", null, "Glissez ce sommet"))));
    for (const l of s.ratsnest || []) world.append(svg("line", { class: "pv-rat", x1: l.a[0], y1: l.a[1], x2: l.b[0], y2: l.b[1] }));
    for (const f of s.findings || []) if (f.at) world.append(svg("circle", { class: `pv-mark ${f.severity}${f === s.focus ? " focus" : ""}`, cx: f.at[0], cy: f.at[1], r: f === s.focus ? 2.2 : 1.3 }, svg("title", null, boardProse(`${f.title} — ${f.message}`))));
    world.append(pen);
    if (first || !vb) fit();
  }
  /** What is being drawn by hand, on top of everything, without drawing the board again : [{ pts, w, color } | { at, d, color }]. */
  const pen = svg("g", { class: "pv-pen" });
  const sketch = (items) => { while (pen.firstChild) pen.removeChild(pen.firstChild); for (const it of items || []) pen.append(it.pts ? svg("polyline", { points: pts(it.pts), fill: "none", stroke: it.color, "stroke-width": it.w, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.85 }) : svg("circle", { cx: it.at[0], cy: it.at[1], r: it.d / 2, fill: it.color, opacity: 0.85 })); };
  const focus = (at, span = 24) => { if (!at) return; vb = [at[0] - span / 2, -at[1] - span / 2, span, span]; setVb(); };
  return { show, fit, focus, sketch, destroy: () => { root.remove(); bar.node.remove(); host.classList.remove("pcba-view"); }, node: root };
}

/** The layer list with its eyes. onChange(Set). */
export function layerList(art, visible, onChange) {
  const box = el("div", { class: "pv-layers" });
  for (const key of [...DRAW_ORDER].reverse()) {
    if (!art.layers[key] || (!art.layers[key].length && !["top", "bottom", "in1", "in2"].includes(key))) continue;
    box.append(el("label", { class: "pv-layer-row" }, el("input", { type: "checkbox", checked: visible.has(key), onChange: (e) => { if (e.target.checked) visible.add(key); else visible.delete(key); onChange(visible); } }),
      el("i", { style: { background: (LAYER_STYLE[key] || ["#666"])[0] } }), el("span", null, art.names[key] || key)));
  }
  return box;
}
