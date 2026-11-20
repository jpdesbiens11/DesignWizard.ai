/* DesignWizard.ai — Logiciel : the page of linked tiles (choix de JP, sur maquette : « Tuiles reliées » — entrées à gauche, sorties à
   droite, un fil d'une sortie à une entrée). One tile per object, its colour that of its nature ; a wire is a curve from an output to
   an input — dashed when it carries the value of the step before. Each output shows what it is worth at the instant of the timeline.
   What it follows : a node editor as block-diagram tools have them — a tile is dragged by its head ; a wire is made by a click on an
   output THEN a click on an input (a port is a button : Tab reaches it, Enter picks it, Échap gives up) — no gesture hidden behind a
   key alone. Nothing is decided here : the screen says whether a wire is allowed (sw/sw_design.js). */

import { KINDS, NATURES, portsOf } from "../sw/sw_objects.js";
import { liveWires, split } from "../sw/sw_design.js";

const NS = "http://www.w3.org/2000/svg", W = 190, HEAD = 26, ROW = 20;
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const color = (o) => (NATURES.find((n) => n.id === (KINDS[o.kind] || {}).nature) || { color: "#64748b" }).color;
/** The size of a tile, and where a port of it is. */
export const tileBox = (o) => { const p = portsOf(o), rows = Math.max(1, p.in.length, p.out.length); return { x: o.x || 0, y: o.y || 0, w: W, h: HEAD + rows * ROW + 8 }; };
export const portAt = (o, dir, key) => { const p = portsOf(o)[dir], i = Math.max(0, p.findIndex((x) => x.key === key)), b = tileBox(o); return { x: dir === "in" ? b.x : b.x + b.w, y: b.y + HEAD + i * ROW + ROW / 2 + 2 }; };
const show = (v, unit) => (v === undefined ? "" : unit === "0/1" ? String(v) : `${String(v).replace("-", "−")}`);

/** The page. host : where it is drawn ; o : { onMove(id, x, y), onWire(from, to), onPick({ obj } | { wire } | null) } → { draw(design, R, k, sel), destroy() } */
export function swCanvas(host, o = {}) {
  const svg = S("svg", { class: "sw-canvas", role: "group", "aria-label": "Les objets du logiciel et leurs fils" }); host.append(svg);
  let pending = null, last = null;
  const onKey = (e) => { if (e.key === "Escape" && pending) { pending = null; if (last) draw(...last); } }; svg.addEventListener("keydown", onKey);
  function draw(d, R, k, sel) {
    last = [d, R, k, sel]; svg.replaceChildren(); const objs = (d.objects || []).filter((x) => KINDS[x.kind]), O = Object.fromEntries(objs.map((x) => [x.id, x])), wires = liveWires({ ...d, objects: objs.map((x) => ({ ...x, off: false })) });
    const boxes = objs.map(tileBox), wx = Math.max(900, ...boxes.map((b) => b.x + b.w + 60)), hy = Math.max(520, ...boxes.map((b) => b.y + b.h + 40)); svg.setAttribute("viewBox", `0 0 ${wx} ${hy}`); svg.style.width = `${wx}px`; svg.style.height = `${hy}px`;      // at its true size : a tile one can read ; the centre scrolls, the magnifier of the top bar enlarges
    svg.append(S("rect", { x: 0, y: 0, width: wx, height: hy, class: "sw-back", onClick: () => { pending = null; if (o.onPick) o.onPick(null); } }));
    const val = (ref) => (R && R.ports[ref] ? R.ports[ref][Math.min(k || 0, R.ports[ref].length - 1)] : undefined);
    /* the wires first : the tiles are drawn over their ends */
    for (const w of wires) { const [a, ap] = split(w.from), [b, bp] = split(w.to), p = portAt(O[a], "out", ap), q = portAt(O[b], "in", bp), dx = Math.max(40, Math.abs(q.x - p.x) / 2), hot = val(w.from) === 1 && portsOf(O[a]).out.find((x) => x.key === ap).unit === "0/1", off = O[a].off || O[b].off;
      const path = `M ${p.x} ${p.y} C ${p.x + dx} ${p.y}, ${q.x - dx} ${q.y}, ${q.x} ${q.y}`, picked = sel && sel.wire && sel.wire.from === w.from && sel.wire.to === w.to, pick = (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ wire: w }); };
      svg.append(S("path", { d: path, class: "sw-wire-hit", onClick: pick }), S("path", { d: path, class: `sw-wire${hot ? " hot" : ""}${w.delay ? " delay" : ""}${picked ? " sel" : ""}${off ? " off" : ""}`, "data-wire": `${w.from}>${w.to}`, tabindex: 0, role: "button", "aria-label": `Fil de ${O[a].name} (${ap}) à ${O[b].name} (${bp})${w.delay ? " — valeur du pas d'avant" : ""}`, onClick: pick, onKeydown: (e) => { if (e.key === "Enter") pick(e); } }));
      if (w.delay) svg.append(S("text", { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 5, class: "sw-delay", "text-anchor": "middle" }, "pas d'avant")); }
    for (const x of objs) { const b = tileBox(x), P = portsOf(x), c = color(x), K = KINDS[x.kind], g = S("g", { class: `sw-tile${sel && sel.obj === x.id ? " sel" : ""}${x.off ? " off" : ""}`, "data-obj": x.id, transform: `translate(${b.x} ${b.y})`, style: `--dom:${c}` });
      g.append(S("rect", { width: b.w, height: b.h, rx: 8, class: "sw-body", onClick: (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ obj: x.id }); } }), S("rect", { width: b.w, height: HEAD, rx: 8, class: "sw-head" }), S("rect", { y: HEAD - 8, width: b.w, height: 8, class: "sw-head" }),
        S("text", { x: 9, y: 17, class: "sw-name" }, x.name.length > 26 ? `${x.name.slice(0, 25)}…` : x.name), S("title", null, `${x.name} — ${K.label} (${K.fr}) : ${K.text}`));
      /* the head : what one takes the tile by */
      const grip = S("rect", { width: b.w, height: HEAD, class: "sw-grip", tabindex: 0, role: "button", "aria-label": `${x.name} — ${K.label}. Glisser pour déplacer, Entrée pour ouvrir sa fiche, flèches pour déplacer de 10.` });
      grip.addEventListener("pointerdown", (e) => { e.preventDefault(); const pt = svg.getScreenCTM().inverse(), at = (ev) => ({ x: ev.clientX * pt.a + pt.e, y: ev.clientY * pt.d + pt.f }), s0 = at(e); let moved = false, nx = b.x, ny = b.y; grip.setPointerCapture(e.pointerId);
        const mv = (ev) => { const s1 = at(ev); nx = Math.max(0, Math.round((b.x + s1.x - s0.x) / 10) * 10); ny = Math.max(0, Math.round((b.y + s1.y - s0.y) / 10) * 10); if (nx !== b.x || ny !== b.y) moved = true; g.setAttribute("transform", `translate(${nx} ${ny})`); };
        const up = () => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); if (moved && o.onMove) o.onMove(x.id, nx, ny); else if (o.onPick) o.onPick({ obj: x.id }); }; grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); });
      grip.addEventListener("keydown", (e) => { const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]; if (step && o.onMove) { e.preventDefault(); o.onMove(x.id, Math.max(0, b.x + step[0]), Math.max(0, b.y + step[1])); } else if (e.key === "Enter" && o.onPick) o.onPick({ obj: x.id }); });
      g.append(grip);
      const port = (p, dir, i) => { const ref = `${x.id}.${p.key}`, y = HEAD + i * ROW + ROW / 2 + 2, cx = dir === "in" ? 0 : b.w, v = val(ref), on = pending === ref, can = dir === "in" && pending;
        const hit = (e) => { e.stopPropagation(); if (dir === "out") { pending = on ? null : ref; draw(...last); } else if (pending) { const from = pending; pending = null; if (o.onWire) o.onWire(from, ref); else draw(...last); } else if (o.onPick) o.onPick({ obj: x.id }); };
        g.append(S("text", { x: dir === "in" ? 10 : b.w - 10, y: y + 4, class: "sw-port", "text-anchor": dir === "in" ? "start" : "end" }, `${p.label}${p.unit !== "0/1" && p.unit !== p.label && dir === "out" ? ` · ${p.unit}` : ""}`),
          S("circle", { cx, cy: y, r: 6, class: `sw-dot ${dir}${on ? " on" : ""}${can ? " can" : ""}${v === 1 && p.unit === "0/1" ? " hot" : ""}`, tabindex: 0, role: "button", "data-port": ref, "data-dir": dir, "aria-label": `${dir === "in" ? "Entrée" : "Sortie"} « ${p.label} » de ${x.name}, en ${p.unit}${dir === "out" ? " — Entrée pour en tirer un fil" : pending ? " — Entrée pour y amener le fil" : ""}`, onClick: hit, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hit(e); } } }));
        if (dir === "out" && v !== undefined) g.append(S("text", { x: b.w + 10, y: y - 6, class: "sw-val", "data-val": ref }, show(v, p.unit))); };
      P.in.forEach((p, i) => port(p, "in", i)); P.out.forEach((p, i) => port(p, "out", i)); svg.append(g); }
    if (pending) svg.append(S("text", { x: 12, y: hy - 12, class: "sw-hint" }, "Cliquez l'entrée où amener le fil — Échap pour renoncer."));
  }
  return { draw, destroy() { svg.removeEventListener("keydown", onKey); svg.remove(); }, get pending() { return pending; } };
}
