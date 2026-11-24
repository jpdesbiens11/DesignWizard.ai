/* DynamiteOrbit.ai — Logiciel : the page of BLOCKS (demande de JP, 24 novembre 2026 : « a SW block system with key shape (like lego block) and
   color, a design view from left to right, input output, similar to labview in a way but with more ergonomic blocks »). It replaces the
   linked tiles of v0.121 ; what a block is and what a wire may join are unchanged (sw/sw_objects.js, sw/sw_design.js).
   What one sees, from left to right as the signal flows : the RAIL of the board's inputs (the pins the CPU reads, tagged with the board and
   its net), the blocks that acquire, decide, regulate and command — each in the colour of its family —, then the RAIL of the board's
   outputs. Each port is a KEY : an output a tab, an input a notch of the same shape (sw/sw_blocks.js keyPath), so what fits is seen before
   it is tried ; the wire takes the colour of its type and plugs into the notch. Under the head of a block, its HARDWARE TAG (green : the net
   of the board is chosen ; amber : to link) ; at its foot, its VALUES, each in the colour of where it comes from (requirement, confirmed,
   reference). Each output shows what it is worth in a small display, as an instrument would ; live, the wires that carry a 1 light up and
   those whose quantity moves flow, as the tracks of the Labo do.
   What it follows : a node editor as block-diagram tools have them (LabVIEW colours its wires by type ; puzzle-shaped blocks are the
   convention of visual programming for beginners) — a block is dragged by its head ; a wire is a click on an output THEN a click on an
   input (a port is a button : Tab reaches it, Enter picks it, Échap gives up) — no gesture hidden behind a key alone ; « Ranger » lays the
   blocks out from left to right, one undoable step. The page PANS and ZOOMS (core/view_bar.js) : the wheel zooms about the pointer, a
   drag of the background pans, « Ajuster » fits. values() refreshes the displays without redrawing — a live run calls it often. */

import { KINDS, portsOf } from "../sw/sw_objects.js";
import { liveWires, split } from "../sw/sw_design.js";
import { BLOCK, SIGNAL_TYPES, VALUE_SOURCES, VIEW, tagH, typeOf, keyPath, familyOf, blockBox, portY, valueChips, chipLayout, snapAt, docked } from "../sw/sw_blocks.js";
import { viewBar, fitView, zoomView } from "../core/view_bar.js";
import { DEVICES } from "../sw/sw_devices.js";
import { physText, shownUnit } from "../sw/sw_units.js";
import { el } from "../core/dom.js";

const NS = "http://www.w3.org/2000/svg", K = 9, A = 7, R = 10;
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const sprite = () => { const t = document.documentElement.dataset.theme; return `img/${t && t !== "carnet" ? "icons-crisp" : "icons"}.svg`; };
const show = (v) => (v === undefined || v === null ? "" : String(v).replace("-", "−"));
const cut = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
/** The outline of a block : tabs on the right edge (its outputs), notches in the left edge (its inputs). */
export function blockOutline(o) {
  const b = blockBox(o), P = portsOf(o), w = b.w, h = b.h; let d = `M ${R} 0 L ${w - R} 0 Q ${w} 0 ${w} ${R}`;
  for (const p of P.out) d += ` ${keyPath(typeOf(p.unit), w, portY(o, "out", p.key), 1, A, K)}`;
  d += ` L ${w} ${h - R} Q ${w} ${h} ${w - R} ${h} L ${R} ${h} Q 0 ${h} 0 ${h - R}`;
  for (const p of [...P.in].reverse()) d += ` ${keyPath(typeOf(p.unit), 0, portY(o, "in", p.key), -1, A, K)}`;
  return `${d} L 0 ${R} Q 0 0 ${R} 0 Z`;
}
/** The legend of the keys and of the colours of the values : what a beginner needs to read a block. */
export function legend() {
  const key = (t) => S("svg", { viewBox: "-2 -10 16 20", width: 18, height: 20, "aria-hidden": "true" }, S("path", { d: `M 0 -10 ${keyPath(t, 0, 0, 1, A, K)} L 0 10`, fill: SIGNAL_TYPES[t].color, stroke: "none" }));
  return el("details", { class: "swb-legend", "data-sw-legend": "" }, el("summary", null, "Lire un bloc"),
    el("p", { class: "swb-leg-h" }, "La clé d'un port = ce qu'il porte"),
    el("ul", null, Object.values(SIGNAL_TYPES).map((t) => el("li", { "data-tip": t.text }, key(t.key), el("span", { style: `color:${t.color}` }, "━ "), t.fr))),
    el("p", { class: "swb-leg-h" }, "La couleur d'une valeur = d'où elle vient"),
    el("ul", null, Object.values(VALUE_SOURCES).map((s) => el("li", { "data-tip": s.text }, el("i", { class: `swb-chip-dot ${s.key}` }), s.fr))));
}

/** The page. host : where it is drawn ; o : { onMove(id, x, y), onWire(from, to), onPick({ obj } | { wire } | null), rank(design) → { id: n },
    tag(object) → { state, text } (sw/sw_blocks.js hwTag), onArrange() } → { draw(design, R, k, sel), values(get), fit(), destroy() } */
export function swCanvas(host, o = {}) {
  const svg = S("svg", { class: "sw-canvas swb", role: "group", "aria-label": "Les blocs du logiciel et leurs fils, de gauche à droite" }); host.append(svg);
  let pending = null, last = null, cb = { w: 900, h: 520 }; const was = {};
  const vw = { x: 0, y: 0, z: 1, moved: false, fitted: false }, ZMIN = 0.15, ZMAX = 4, size = () => [Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)];
  const apply = () => { const [W, H] = size(); svg.setAttribute("viewBox", `${vw.x} ${vw.y} ${W / vw.z} ${H / vw.z}`); svg.style.width = `${W}px`; svg.style.height = `${H}px`; bar.update(); };
  const fit = (user) => { const [W, H] = size(); Object.assign(vw, fitView(W, H, cb, 24, 1.4, ZMIN), { moved: false, fitted: !user ? vw.fitted : true }); apply(); };
  const zoomAt = (k, px, py) => { const [W, H] = size(); Object.assign(vw, zoomView(vw, k, px ?? W / 2, py ?? H / 2, ZMIN, ZMAX), { moved: true }); apply(); };
  const bar = viewBar({ label: "les blocs du logiciel", zoomOut: () => zoomAt(1 / 1.25), zoomIn: () => zoomAt(1.25), fit: () => fit(true), actual: () => zoomAt(1 / vw.z), text: () => `${Math.round(vw.z * 100)} %`, fitTip: "Ajuster à la fenêtre : tous les blocs se voient" });
  bar.node.classList.add("sw-viewbar"); host.append(bar.node);
  const tools = el("div", { class: "swb-tools" }, legend(), o.onArrange ? el("button", { type: "button", class: "btn small", "data-sw-arrange": "", "data-tip": "Ranger les blocs de gauche à droite, dans le sens du signal : les entrées de la carte, ce qui les lit, ce qui décide, ce qui commande, les sorties — une étape annulable", onClick: () => o.onArrange() }, "⇢ Ranger de gauche à droite") : null);
  host.append(tools);
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-240, Math.min(240, e.deltaY)) * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let pan = null;
  svg.addEventListener("pointerdown", (e) => { if (e.button !== 0 || !(e.target === svg || (e.target.classList && (e.target.classList.contains("sw-back") || e.target.classList.contains("swb-rail"))))) return; pan = { x: e.clientX, y: e.clientY, vx: vw.x, vy: vw.y, on: false, id: e.pointerId }; });
  svg.addEventListener("pointermove", (e) => { if (!pan || e.pointerId !== pan.id) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.on) { if (Math.hypot(dx, dy) < 4) return; pan.on = true; host.classList.add("panning"); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone */ } }
    vw.x = pan.vx - dx / vw.z; vw.y = pan.vy - dy / vw.z; vw.moved = true; apply(); });
  const drop = (e) => { if (!pan || (e && e.pointerId !== pan.id)) return; const moved = pan.on; pan = null; host.classList.remove("panning"); if (!moved) { pending = null; if (o.onPick) o.onPick(null); } };
  svg.addEventListener("pointerup", drop); svg.addEventListener("pointercancel", drop);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!vw.moved) fit(false); else apply(); }) : null; if (ro) ro.observe(host);
  const onKey = (e) => { if (e.key === "Escape" && pending) { pending = null; if (last) draw(...last); } }; svg.addEventListener("keydown", onKey);

  function draw(d, Rn, k, sel) {
    last = [d, Rn, k, sel]; svg.replaceChildren(); const objs = (d.objects || []).filter((x) => KINDS[x.kind]), O = Object.fromEntries(objs.map((x) => [x.id, x])), wires = liveWires({ ...d, objects: objs.map((x) => ({ ...x, off: false })) });
    const boxes = objs.map(blockBox), wx = Math.max(400, ...boxes.map((b) => b.x + b.w + 120)), hy = Math.max(300, ...boxes.map((b) => b.y + b.h + 40)); cb = { w: wx, h: hy };
    if (!vw.fitted && host.clientWidth > 1) { fit(false); vw.fitted = true; } else apply();
    svg.append(S("defs", null, S("filter", { id: "swb-glow", x: "-20%", y: "-50%", width: "140%", height: "200%" }, S("feGaussianBlur", { stdDeviation: 3, result: "b" }), S("feMerge", null, S("feMergeNode", { in: "b" }), S("feMergeNode", { in: "SourceGraphic" })))));
    svg.append(S("rect", { x: -5000, y: -5000, width: wx + 10000, height: hy + 10000, class: "sw-back" }));
    const val = (ref) => (Rn && Rn.ports[ref] ? Rn.ports[ref][Math.min(k || 0, Rn.ports[ref].length - 1)] : undefined), rank = o.rank ? o.rank(d) : {};
    /* the rails of the board : its inputs on the left, its outputs on the right */
    for (const [side, test, word] of [["in", (x) => KINDS[x.kind].pin && KINDS[x.kind].pin !== "dout", "ENTRÉES DE LA CARTE"], ["out", (x) => KINDS[x.kind].pin === "dout", "SORTIES DE LA CARTE"]]) {
      const all = objs.filter(test).map(blockBox); if (!all.length) continue; const edge = side === "in" ? Math.min(...all.map((b) => b.x)) : Math.max(...all.map((b) => b.x)), list = all.filter((b) => Math.abs(b.x - edge) <= 40);      // the rail holds the pins lined up at the edge ; « Ranger » brings the others
      const x0 = Math.min(...list.map((b) => b.x)) - 14, x1 = Math.max(...list.map((b) => b.x + b.w)) + 14 + (side === "out" ? 0 : K), y0 = Math.min(0, ...list.map((b) => b.y)) - 34, y1 = Math.max(hy - 10, ...list.map((b) => b.y + b.h + 14));
      const t = o.tag && objs.find(test) ? o.tag(objs.find(test)) : null;
      svg.append(S("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 14, class: `swb-rail ${side}`, "data-sw-rail": side }), S("text", { x: x0 + 12, y: y0 + 20, class: "swb-rail-t" }, `${side === "in" ? "⇥" : "⇤"} ${word}${t && t.board ? ` · ${cut(t.board, 26)}` : ""}`)); }
    /* the wires : the colour of their type, plugged into the notch (the plugs drawn over the blocks) */
    const plugs = [], dockedIn = new Set(), dockedOut = new Set();
    for (const w of wires) { const [a, ap] = split(w.from), [b, bp] = split(w.to), ba = blockBox(O[a]), bb = blockBox(O[b]), port = portsOf(O[a]).out.find((x) => x.key === ap), type = typeOf(port.unit);
      const p = { x: ba.x + ba.w + K, y: ba.y + portY(O[a], "out", ap) }, q = { x: bb.x, y: bb.y + portY(O[b], "in", bp) }, dx = Math.max(50, Math.abs(q.x - p.x) / 2), hot = type === "bool" && val(w.from) === 1, off = O[a].off || O[b].off;
      if (docked(d, w)) { dockedIn.add(w.to); dockedOut.add(w.from); continue; }      // keyed : the tab sits in the notch, no wire to draw
      const path = `M ${p.x} ${p.y} C ${p.x + dx} ${p.y}, ${q.x - dx} ${q.y}, ${q.x} ${q.y}`, picked = sel && sel.wire && sel.wire.from === w.from && sel.wire.to === w.to, pick = (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ wire: w }); };
      svg.append(S("path", { d: path, class: "sw-wire-hit", onClick: pick }), S("path", { d: path, class: `sw-wire swb-wire t-${type}${hot ? " hot" : ""}${w.delay ? " delay" : ""}${picked ? " sel" : ""}${off ? " off" : ""}`, style: `--wt:${SIGNAL_TYPES[type].color}`, "data-wire": `${w.from}>${w.to}`, "data-from": w.from, "data-type": type, "data-bool": type === "bool" ? "1" : null, tabindex: 0, role: "button", "aria-label": `Fil ${SIGNAL_TYPES[type].fr} de ${O[a].name} (${ap}) à ${O[b].name} (${bp})${w.delay ? " — valeur du pas d'avant" : ""}`, onClick: pick, onKeydown: (e) => { if (e.key === "Enter") pick(e); } }),
);
      plugs.push(S("path", { d: `M ${q.x} ${q.y - A + 1.5} ${keyPath(type, q.x, q.y, 1, A - 1.5, K - 2)} Z`, class: "swb-plug", style: `--wt:${SIGNAL_TYPES[type].color}`, "data-plug": w.to }));
      if (w.delay) svg.append(S("text", { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 6, class: "sw-delay", "text-anchor": "middle" }, "pas d'avant")); }
    /* the blocks */
    for (const x of objs) { const b = blockBox(x), P = portsOf(x), F = familyOf(x.kind, x), Kd = KINDS[x.kind], Dv = x.device && DEVICES[x.device], tag = o.tag ? o.tag(x) : null, chips = VIEW.chips ? valueChips(x, d) : [], lit = P.out.some((p) => typeOf(p.unit) === "bool" && val(`${x.id}.${p.key}`) === 1);
      const g = S("g", { class: `swb-block sw-tile${sel && sel.obj === x.id ? " sel" : ""}${x.off ? " off" : ""}${lit ? " lit" : ""}`, "data-obj": x.id, "data-family": F.id, transform: `translate(${b.x} ${b.y})`, style: `--dom:${F.color}` });
      const choose = (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ obj: x.id }); };
      g.append(...[S("path", { d: blockOutline(x), class: "swb-body", onClick: choose }), S("path", { d: `M ${R} 0 L ${b.w - R} 0 Q ${b.w} 0 ${b.w} ${R} L ${b.w} ${BLOCK.HEAD} L 0 ${BLOCK.HEAD} L 0 ${R} Q 0 0 ${R} 0 Z`, class: "swb-head" }),
        S("use", { href: `${sprite()}#i-${(Dv && Dv.icon) || Kd.icon || F.icon}`, x: 9, y: 8, width: 16, height: 16, class: "swb-ico" }),
        S("text", { x: 31, y: 21, class: "swb-name" }, cut(x.name, 24)), S("title", null, Dv ? `${x.name} — ${Dv.label} (${Dv.fr}) : ${Dv.text} Vu du logiciel : ${Kd.label}.` : `${x.name} — ${Kd.label} (${Kd.fr}) : ${Kd.text}`),
        rank[x.id] && o.showRank !== false ? S("text", { x: b.w - 9, y: 20, class: "swb-rank", "text-anchor": "end" }, S("title", null, `Calculé en n° ${rank[x.id]} à chaque pas`), `${rank[x.id]}`) : null].filter(Boolean));
      if (tag && VIEW.tags) { const tg = S("g", { class: `swb-tag ${tag.state}`, "data-sw-tag": tag.state, onClick: choose }, S("rect", { x: 8, y: BLOCK.HEAD + 3, width: b.w - 16, height: 16, rx: 8 }), S("text", { x: 16, y: BLOCK.HEAD + 14.5 }, `${tag.state === "missing" ? "⚠ " : tag.state === "linked" ? "⛓ " : "▣ "}${cut(tag.text, 34)}`), S("title", null, tag.state === "missing" ? "Broche pas encore reliée à un net de la carte : sa fiche le choisit." : tag.state === "linked" ? "Reliée à ce net de la carte du projet." : "Le logiciel tourne sur cette carte du projet.")); g.append(tg); }
      /* the head : what one takes the block by */
      const grip = S("rect", { width: b.w, height: BLOCK.HEAD, class: "sw-grip", tabindex: 0, role: "button", "aria-label": `${x.name} — ${Kd.label}. Glisser pour déplacer, Entrée pour ouvrir sa fiche, flèches pour déplacer de 10.` });
      grip.addEventListener("pointerdown", (e) => { e.preventDefault(); const pt = svg.getScreenCTM().inverse(), at = (ev) => ({ x: ev.clientX * pt.a + pt.e, y: ev.clientY * pt.d + pt.f }), s0 = at(e); let moved = false, nx = b.x, ny = b.y; grip.setPointerCapture(e.pointerId);
        const mv = (ev) => { const s1 = at(ev); nx = Math.max(0, Math.round((b.x + s1.x - s0.x) / 10) * 10); ny = Math.max(0, Math.round((b.y + s1.y - s0.y) / 10) * 10); if (nx !== b.x || ny !== b.y) moved = true; const sn = snapAt(d, x.id, nx, ny); if (sn) { nx = sn.x; ny = sn.y; } g.classList.toggle("snapping", !!sn); g.setAttribute("transform", `translate(${nx} ${ny})`); };
        const up = () => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); if (moved && o.onMove) o.onMove(x.id, nx, ny); else if (o.onPick) o.onPick({ obj: x.id }); }; grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); });
      grip.addEventListener("keydown", (e) => { const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key]; if (step && o.onMove) { e.preventDefault(); o.onMove(x.id, Math.max(0, b.x + step[0]), Math.max(0, b.y + step[1])); } else if (e.key === "Enter" && o.onPick) o.onPick({ obj: x.id }); });
      g.append(grip);
      /* the ports : a key each ; an output shows what it is worth */
      const pendingType = pending ? (() => { const [pa, pk] = split(pending), src = O[pa] && portsOf(O[pa]).out.find((q) => q.key === pk); return src ? typeOf(src.unit) : null; })() : null;
      const port = (p, dir) => { const ref = `${x.id}.${p.key}`, y = portY(x, dir, p.key), type = typeOf(p.unit), v = val(ref), on = pending === ref, can = dir === "in" && pending && pendingType === type, nope = dir === "in" && pending && pendingType !== type, unit = p.unit !== "0/1" && p.unit !== p.label ? shownUnit(p.unit) : "";
        const hit = (e) => { e.stopPropagation(); if (dir === "out") { pending = on ? null : ref; draw(...last); } else if (pending) { const from = pending; pending = null; if (o.onWire) o.onWire(from, ref); else draw(...last); } else if (o.onPick) o.onPick({ obj: x.id }); };
        g.append(S("text", { x: dir === "in" ? K + 7 : b.w - 8, y: y + 4, class: "swb-port", "text-anchor": dir === "in" ? "start" : "end" }, p.label, unit ? S("tspan", { class: "swb-unit" }, ` ${unit}`) : null));
        g.append(S("path", { d: dir === "in" ? `M 0 ${y - A} ${keyPath(type, 0, y, 1, A, K)} Z` : `M ${b.w} ${y - A} ${keyPath(type, b.w, y, 1, A, K)} Z`, class: `sw-dot swb-key ${dir}${(dir === "in" ? dockedIn : dockedOut).has(ref) ? " docked" : ""}${on ? " on" : ""}${can ? " can" : ""}${nope ? " nope" : ""}${type === "bool" && v === 1 ? " hot" : ""}`, style: `--wt:${SIGNAL_TYPES[type].color}`, "data-bool": type === "bool" ? "1" : null, "data-type": type,
          tabindex: 0, role: "button", "data-port": ref, "data-dir": dir, "aria-label": `${dir === "in" ? "Entrée" : "Sortie"} « ${p.label} » de ${x.name} — ${SIGNAL_TYPES[type].fr}, en ${p.unit}${dir === "out" ? " — Entrée pour en tirer un fil" : pending ? (can ? " — Entrée pour y amener le fil" : " — ne reçoit pas ce type") : ""}`, onClick: hit, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hit(e); } } }));
        if (dir === "out") { const tx = physText(v, p.unit), lw = Math.max(26, tx.length * 7 + 12), dy = dockedOut.has(ref) ? -21 : 0, lx = dockedOut.has(ref) ? b.w - lw - 4 : b.w + K + 5;      // a keyed output shows its value above the joint
          g.append(S("g", { class: "swb-lcd", "data-lcd": ref }, S("rect", { x: lx, y: y - 9 + dy, width: lw, height: 18, rx: 4 }), S("text", { x: lx + 6, y: y + 4 + dy, class: "sw-val", "data-val": ref, "data-unit": p.unit }, tx))); } };
      P.in.forEach((p) => port(p, "in")); P.out.forEach((p) => port(p, "out"));
      /* the values, each in the colour of where it comes from */
      if (chips.length) { const top = BLOCK.HEAD + tagH() + Math.max(1, P.in.length, P.out.length) * BLOCK.ROW + 2;
        for (const c of chipLayout(x, d)) { const cy = top + c.row * 20;
          g.append(S("g", { class: `swb-chip ${c.source}${c.pending ? " pending" : ""}`, "data-sw-chip": `${x.id}.${c.key}`, "data-source": c.source, onClick: (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ obj: x.id, field: c.key }); } }, S("rect", { x: c.x, y: cy, width: c.w, height: 16, rx: 8 }), S("text", { x: c.x + 7, y: cy + 11.5 }, c.text), S("title", null, `${c.label} : ${physText(c.value, c.unit)} — ${VALUE_SOURCES[c.source].text}`))); } }
      svg.append(g); }
    svg.append(...plugs);
    if (pending) svg.append(S("text", { x: 12, y: hy - 12, class: "sw-hint" }, "Cliquez une entrée de la même clé — Échap pour renoncer."));
  }
  /* what every output is worth now, without redrawing : the displays, the wires that carry a 1, the quantities that move */
  function values(get) {
    for (const t of svg.querySelectorAll("[data-val]")) { const v = get(t.getAttribute("data-val")), s = physText(v, t.getAttribute("data-unit")); t.textContent = s; const r = t.previousSibling; if (r) r.setAttribute("width", String(Math.max(26, s.length * 7 + 12))); }
    for (const w of svg.querySelectorAll(".sw-wire[data-from]")) { const v = get(w.getAttribute("data-from")), f = w.getAttribute("data-from"); if (w.dataset.bool) w.classList.toggle("hot", v === 1); else { w.classList.toggle("flow", was[f] !== undefined && was[f] !== v); } }
    for (const w of svg.querySelectorAll(".sw-wire[data-from]")) was[w.getAttribute("data-from")] = get(w.getAttribute("data-from"));
    for (const p of svg.querySelectorAll(".sw-dot[data-bool][data-dir='out']")) p.classList.toggle("hot", get(p.getAttribute("data-port")) === 1);
    for (const g of svg.querySelectorAll(".swb-block")) g.classList.toggle("lit", [...g.querySelectorAll(".sw-dot[data-bool][data-dir='out']")].some((p) => get(p.getAttribute("data-port")) === 1));
  }
  return { draw, values, fit: () => fit(true), get zoom() { return vw.z; }, destroy() { svg.removeEventListener("keydown", onKey); if (ro) ro.disconnect(); svg.remove(); bar.node.remove(); tools.remove(); }, get pending() { return pending; } };
}
