/* DesignOrbit.ai — Logiciel : the page of linked tiles (choix de JP, sur maquette : « Tuiles reliées » — entrées à gauche, sorties à
   droite, un fil d'une sortie à une entrée). One tile per object, its colour that of its nature ; a wire is a curve from an output to
   an input — dashed when it carries the value of the step before. Each output shows what it is worth at the instant of the timeline.
   What it follows : a node editor as block-diagram tools have them — a tile is dragged by its head ; a wire is made by a click on an
   output THEN a click on an input (a port is a button : Tab reaches it, Enter picks it, Échap gives up) — no gesture hidden behind a
   key alone. Nothing is decided here : the screen says whether a wire is allowed (sw/sw_design.js).
   What enters and what leaves is SAID on the tile (demande de JP : « ce n'est pas clair quels sont les entrées et les sorties des blocs ») : a
   line « ENTRÉES … SORTIES » under its head, an input drawn as an arrowhead that points INTO the tile, an output as a dot that leaves it,
   each with its unit ; the number in the head is the rank of the object in the step. values() refreshes what the outputs are worth without
   redrawing — a live simulation calls it many times a second.
   The page PANS and ZOOMS (demande de JP : « pouvoir redimensionner la vue des blocs aussi, pan, zoom, ajuster à la fenêtre, loupe ») as the
   board views of the tool do : the wheel zooms about the pointer, a drag of the background pans, and the bar of the view (core/view_bar.js)
   gives − % + , « Ajuster » and the magnifier. The view first fits the tiles in the window, and fits them again while it was not moved. */

import { KINDS, NATURES, portsOf } from "../sw/sw_objects.js";
import { liveWires, split } from "../sw/sw_design.js";
import { viewBar, fitView, zoomView } from "../core/view_bar.js";

const NS = "http://www.w3.org/2000/svg", W = 190, HEAD = 26, CAP = 15, ROW = 20;
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const color = (o) => (NATURES.find((n) => n.id === (KINDS[o.kind] || {}).nature) || { color: "#64748b" }).color;
/** The size of a tile, and where a port of it is. */
export const tileBox = (o) => { const p = portsOf(o), rows = Math.max(1, p.in.length, p.out.length); return { x: o.x || 0, y: o.y || 0, w: W, h: HEAD + CAP + rows * ROW + 8 }; };
export const portAt = (o, dir, key) => { const p = portsOf(o)[dir], i = Math.max(0, p.findIndex((x) => x.key === key)), b = tileBox(o); return { x: dir === "in" ? b.x : b.x + b.w, y: b.y + HEAD + CAP + i * ROW + ROW / 2 + 2 }; };
const show = (v, unit) => (v === undefined ? "" : unit === "0/1" ? String(v) : `${String(v).replace("-", "−")}`);

/** The page. host : where it is drawn ; o : { onMove(id, x, y), onWire(from, to), onPick({ obj } | { wire } | null), rank(design) → { id: n } }
    → { draw(design, R, k, sel), values(get : ref → value), destroy() } */
export function swCanvas(host, o = {}) {
  const svg = S("svg", { class: "sw-canvas", role: "group", "aria-label": "Les objets du logiciel et leurs fils" }); host.append(svg);
  let pending = null, last = null, cb = { w: 900, h: 520 };
  /* the view : z pixels per unit of the page, (x, y) the corner shown ; moved : the user zoomed or panned — no refit on a resize */
  const vw = { x: 0, y: 0, z: 1, moved: false, fitted: false }, ZMIN = 0.15, ZMAX = 4, size = () => [Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)];
  const apply = () => { const [W, H] = size(); svg.setAttribute("viewBox", `${vw.x} ${vw.y} ${W / vw.z} ${H / vw.z}`); svg.style.width = `${W}px`; svg.style.height = `${H}px`; bar.update(); };
  const fit = (user) => { const [W, H] = size(); Object.assign(vw, fitView(W, H, cb, 24, 1.4, ZMIN), { moved: false, fitted: !user ? vw.fitted : true }); apply(); };
  const zoomAt = (k, px, py) => { const [W, H] = size(); Object.assign(vw, zoomView(vw, k, px ?? W / 2, py ?? H / 2, ZMIN, ZMAX), { moved: true }); apply(); };
  const bar = viewBar({ label: "les tuiles du logiciel", zoomOut: () => zoomAt(1 / 1.25), zoomIn: () => zoomAt(1.25), fit: () => fit(true), actual: () => zoomAt(1 / vw.z), text: () => `${Math.round(vw.z * 100)} %`, fitTip: "Ajuster à la fenêtre : toutes les tuiles se voient" });
  bar.node.classList.add("sw-viewbar"); host.append(bar.node);
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-240, Math.min(240, e.deltaY)) * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  /* a drag of the background pans ; a click on it (no move) chooses nothing */
  let pan = null;
  svg.addEventListener("pointerdown", (e) => { if (e.button !== 0 || !(e.target === svg || (e.target.classList && e.target.classList.contains("sw-back")))) return; pan = { x: e.clientX, y: e.clientY, vx: vw.x, vy: vw.y, on: false, id: e.pointerId }; });
  svg.addEventListener("pointermove", (e) => { if (!pan || e.pointerId !== pan.id) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.on) { if (Math.hypot(dx, dy) < 4) return; pan.on = true; host.classList.add("panning"); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone */ } }
    vw.x = pan.vx - dx / vw.z; vw.y = pan.vy - dy / vw.z; vw.moved = true; apply(); });
  const drop = (e) => { if (!pan || (e && e.pointerId !== pan.id)) return; const moved = pan.on; pan = null; host.classList.remove("panning"); if (!moved) { pending = null; if (o.onPick) o.onPick(null); } };
  svg.addEventListener("pointerup", drop); svg.addEventListener("pointercancel", drop);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!vw.moved) fit(false); else apply(); }) : null; if (ro) ro.observe(host);
  const onKey = (e) => { if (e.key === "Escape" && pending) { pending = null; if (last) draw(...last); } }; svg.addEventListener("keydown", onKey);
  function draw(d, R, k, sel) {
    last = [d, R, k, sel]; svg.replaceChildren(); const objs = (d.objects || []).filter((x) => KINDS[x.kind]), O = Object.fromEntries(objs.map((x) => [x.id, x])), wires = liveWires({ ...d, objects: objs.map((x) => ({ ...x, off: false })) });
    const boxes = objs.map(tileBox), wx = Math.max(400, ...boxes.map((b) => b.x + b.w + 60)), hy = Math.max(300, ...boxes.map((b) => b.y + b.h + 40)); cb = { w: wx, h: hy };
    if (!vw.fitted && host.clientWidth > 1) { fit(false); vw.fitted = true; } else apply();      // the first time : the whole page in the window
    svg.append(S("rect", { x: -5000, y: -5000, width: wx + 10000, height: hy + 10000, class: "sw-back" }));
    const val = (ref) => (R && R.ports[ref] ? R.ports[ref][Math.min(k || 0, R.ports[ref].length - 1)] : undefined), rank = o.rank ? o.rank(d) : {};
    /* the wires first : the tiles are drawn over their ends */
    for (const w of wires) { const [a, ap] = split(w.from), [b, bp] = split(w.to), p = portAt(O[a], "out", ap), q = portAt(O[b], "in", bp), dx = Math.max(40, Math.abs(q.x - p.x) / 2), hot = val(w.from) === 1 && portsOf(O[a]).out.find((x) => x.key === ap).unit === "0/1", off = O[a].off || O[b].off;
      const path = `M ${p.x} ${p.y} C ${p.x + dx} ${p.y}, ${q.x - dx} ${q.y}, ${q.x} ${q.y}`, picked = sel && sel.wire && sel.wire.from === w.from && sel.wire.to === w.to, pick = (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ wire: w }); };
      svg.append(S("path", { d: path, class: "sw-wire-hit", onClick: pick }), S("path", { d: path, class: `sw-wire${hot ? " hot" : ""}${w.delay ? " delay" : ""}${picked ? " sel" : ""}${off ? " off" : ""}`, "data-wire": `${w.from}>${w.to}`, "data-from": w.from, "data-bool": portsOf(O[a]).out.find((x) => x.key === ap).unit === "0/1" ? "1" : null, tabindex: 0, role: "button", "aria-label": `Fil de ${O[a].name} (${ap}) à ${O[b].name} (${bp})${w.delay ? " — valeur du pas d'avant" : ""}`, onClick: pick, onKeydown: (e) => { if (e.key === "Enter") pick(e); } }));
      if (w.delay) svg.append(S("text", { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 5, class: "sw-delay", "text-anchor": "middle" }, "pas d'avant")); }
    for (const x of objs) { const b = tileBox(x), P = portsOf(x), c = color(x), K = KINDS[x.kind], g = S("g", { class: `sw-tile${sel && sel.obj === x.id ? " sel" : ""}${x.off ? " off" : ""}`, "data-obj": x.id, transform: `translate(${b.x} ${b.y})`, style: `--dom:${c}` });
      g.append(...[S("rect", { width: b.w, height: b.h, rx: 8, class: "sw-body", onClick: (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ obj: x.id }); } }), S("rect", { width: b.w, height: HEAD, rx: 8, class: "sw-head" }), S("rect", { y: HEAD - 8, width: b.w, height: 8, class: "sw-head" }),
        S("text", { x: 9, y: 17, class: "sw-name" }, x.name.length > 21 ? `${x.name.slice(0, 20)}…` : x.name), S("title", null, `${x.name} — ${K.label} (${K.fr}) : ${K.text}`),
        rank[x.id] ? S("text", { x: b.w - 9, y: 17, class: "sw-rank", "text-anchor": "end" }, S("title", null, `Calculé en n° ${rank[x.id]} à chaque pas`), `n° ${rank[x.id]}`) : null,
        S("text", { x: 9, y: HEAD + 11, class: "sw-cap" }, P.in.length ? "ENTRÉES" : "lit une broche du CPU"), S("text", { x: b.w - 9, y: HEAD + 11, class: "sw-cap", "text-anchor": "end" }, P.out.length ? "SORTIES" : "écrit une broche du CPU")].filter(Boolean));
      /* the head : what one takes the tile by */
      const grip = S("rect", { width: b.w, height: HEAD, class: "sw-grip", tabindex: 0, role: "button", "aria-label": `${x.name} — ${K.label}. Glisser pour déplacer, Entrée pour ouvrir sa fiche, flèches pour déplacer de 10.` });
      grip.addEventListener("pointerdown", (e) => { e.preventDefault(); const pt = svg.getScreenCTM().inverse(), at = (ev) => ({ x: ev.clientX * pt.a + pt.e, y: ev.clientY * pt.d + pt.f }), s0 = at(e); let moved = false, nx = b.x, ny = b.y; grip.setPointerCapture(e.pointerId);
        const mv = (ev) => { const s1 = at(ev); nx = Math.max(0, Math.round((b.x + s1.x - s0.x) / 10) * 10); ny = Math.max(0, Math.round((b.y + s1.y - s0.y) / 10) * 10); if (nx !== b.x || ny !== b.y) moved = true; g.setAttribute("transform", `translate(${nx} ${ny})`); };
        const up = () => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); if (moved && o.onMove) o.onMove(x.id, nx, ny); else if (o.onPick) o.onPick({ obj: x.id }); }; grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); });
      grip.addEventListener("keydown", (e) => { const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]; if (step && o.onMove) { e.preventDefault(); o.onMove(x.id, Math.max(0, b.x + step[0]), Math.max(0, b.y + step[1])); } else if (e.key === "Enter" && o.onPick) o.onPick({ obj: x.id }); });
      g.append(grip);
      const port = (p, dir, i) => { const ref = `${x.id}.${p.key}`, y = HEAD + CAP + i * ROW + ROW / 2 + 2, cx = dir === "in" ? 0 : b.w, v = val(ref), on = pending === ref, can = dir === "in" && pending, unit = p.unit !== "0/1" && p.unit !== p.label ? ` · ${p.unit}` : "";
        const hit = (e) => { e.stopPropagation(); if (dir === "out") { pending = on ? null : ref; draw(...last); } else if (pending) { const from = pending; pending = null; if (o.onWire) o.onWire(from, ref); else draw(...last); } else if (o.onPick) o.onPick({ obj: x.id }); };
        g.append(S("text", { x: dir === "in" ? 12 : b.w - 10, y: y + 4, class: "sw-port", "text-anchor": dir === "in" ? "start" : "end" }, `${p.label}${unit}`),
          S(dir === "in" ? "path" : "circle", { ...(dir === "in" ? { d: `M -7 ${y - 7} L 6 ${y} L -7 ${y + 7} Z` } : { cx, cy: y, r: 6 }), "data-bool": p.unit === "0/1" ? "1" : null, class: `sw-dot ${dir}${on ? " on" : ""}${can ? " can" : ""}${v === 1 && p.unit === "0/1" ? " hot" : ""}`, tabindex: 0, role: "button", "data-port": ref, "data-dir": dir, "aria-label": `${dir === "in" ? "Entrée" : "Sortie"} « ${p.label} » de ${x.name}, en ${p.unit}${dir === "out" ? " — Entrée pour en tirer un fil" : pending ? " — Entrée pour y amener le fil" : ""}`, onClick: hit, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hit(e); } } }));
        if (dir === "out") g.append(S("text", { x: b.w + 10, y: y - 6, class: "sw-val", "data-val": ref }, show(v, p.unit))); };
      P.in.forEach((p, i) => port(p, "in", i)); P.out.forEach((p, i) => port(p, "out", i)); svg.append(g); }
    if (pending) svg.append(S("text", { x: 12, y: hy - 12, class: "sw-hint" }, "Cliquez l'entrée où amener le fil — Échap pour renoncer."));
  }
  /* what every output is worth now, without redrawing : the numbers, the wires and the ports that carry a 1 */
  function values(get) {
    for (const t of svg.querySelectorAll("[data-val]")) { const v = get(t.getAttribute("data-val")); t.textContent = v === undefined || v === null ? "" : String(v).replace("-", "−"); }
    for (const w of svg.querySelectorAll(".sw-wire[data-bool]")) w.classList.toggle("hot", get(w.getAttribute("data-from")) === 1);
    for (const p of svg.querySelectorAll(".sw-dot[data-bool]")) p.classList.toggle("hot", get(p.getAttribute("data-port")) === 1);
  }
  return { draw, values, fit: () => fit(true), get zoom() { return vw.z; }, destroy() { svg.removeEventListener("keydown", onKey); if (ro) ro.disconnect(); svg.remove(); bar.node.remove(); }, get pending() { return pending; } };
}
