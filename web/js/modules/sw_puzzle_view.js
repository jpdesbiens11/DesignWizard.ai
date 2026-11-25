/* DynamiteOrbit.ai — Logiciel : the PUZZLE view, WITHOUT A WIRE (choix de JP, 24 novembre 2026 : « Casse-tête 2D » ; 25 novembre : « enlever les
   lignes pour connecter directement les blocs par l'interface physique… un keying qui diffère selon le type de compatibilité… dupliquer une
   fonction pour la mettre à 3 places mais pouvoir ouvrir un bloc d'interface où on voit la combinaison de tout… compris d'un coup d'œil par ma
   grand-mère »).
   Each ROW ends on an action ; what it needs is snapped against its left edge, the tab of one piece in the notch of the next, the shape and the
   colour of the key saying what it carries (a decision 0 / 1, a quantity, a state…) — a piece of the wrong type would not fit. A piece that
   takes two branches is as tall as both. A piece needed in several rows is laid once, and elsewhere as a TWIN (dashed, its value live) ; its
   « ×n » or a click on a twin opens the INTERFACE BLOCK (modules/sw_puzzle_iface.js) : what it takes, and every place it goes. Connecting
   stays two clicks : the plug of a piece, then the piece it feeds — the right ports are wired in the background (connectPieces).
   What it follows : ladder logic, one output per rung and a contact repeated as often as it is read ; the snapping stacks of block languages
   (Scratch) ; the view pans and zooms as every 2D view of the tool (core/view_bar.js). Same API as modules/sw_canvas.js. */

import { KINDS } from "../sw/sw_objects.js";
import { unsure } from "../sw/sw_design.js";
import { BANDS, SNAP, pieces, links, puzzleForest, connectPieces } from "../sw/sw_puzzle.js";
import { SIGNAL_TYPES, keyPath } from "../sw/sw_blocks.js";
import { swIface } from "./sw_puzzle_iface.js";
import { physText } from "../sw/sw_units.js";
import { viewBar, fitView, zoomView } from "../core/view_bar.js";

const NS = "http://www.w3.org/2000/svg", R = 16, KN = 11;
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const sprite = () => { const t = document.documentElement.dataset.theme; return `img/${t && t !== "carnet" ? "icons-crisp" : "icons"}.svg`; };
const band = (id) => BANDS.find((b) => b.id === id) || BANDS[1];
const cut = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
/** The outline of a piece : a knob out of its right edge when it gives, a socket into its left edge when it takes — the jigsaw. */
export function pieceOutline(w, h, knob, socket) {
  const m = h / 2, k = KN, f = (n) => Math.round(n * 100) / 100;
  const out = knob ? `L ${w} ${f(m - k * 0.55)} C ${f(w + k * 0.2)} ${f(m - k * 1.35)}, ${f(w + k * 1.9)} ${f(m - k * 1.35)}, ${f(w + k * 1.7)} ${m} C ${f(w + k * 1.9)} ${f(m + k * 1.35)}, ${f(w + k * 0.2)} ${f(m + k * 1.35)}, ${w} ${f(m + k * 0.55)}` : "";      // the knob : out of the right edge, going down
  const into = socket ? `L 0 ${f(m + k * 0.55)} C ${f(k * 0.2)} ${f(m + k * 1.35)}, ${f(k * 1.9)} ${f(m + k * 1.35)}, ${f(k * 1.7)} ${m} C ${f(k * 1.9)} ${f(m - k * 1.35)}, ${f(k * 0.2)} ${f(m - k * 1.35)}, 0 ${f(m - k * 0.55)}` : "";      // the socket : into the left edge, going up
  return `M ${R} 0 L ${w - R} 0 Q ${w} 0 ${w} ${R} ${out} L ${w} ${h - R} Q ${w} ${h} ${w - R} ${h} L ${R} ${h} Q 0 ${h} 0 ${h - R} ${into} L 0 ${R} Q 0 0 ${R} 0 Z`;
}

/** The outline of a SNAPPED piece (w × h) : the tab of what it gives out of its right edge, the notches of what it takes into its left edge —
    each keyed by its type (sw/sw_blocks.js keyPath), so that only a piece of the right type fits. ins : [{ y, type }] from the top. */
export function snapOutline(w, h, out, ins = [], r = 10) {
  const right = out ? keyPath(out, w, h / 2, 1, 7, 9) : "", left = [...ins].sort((a, b) => b.y - a.y).map((q) => keyPath(q.type, 0, q.y, -1, 7, 9)).join(" ");
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} ${right} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} ${left} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

/** host, o : { onPick({ obj } | { wire } | null), onConnect(fromPiece, toPiece), onMove? } → { draw(design, R, k, sel), values(get), fit(), destroy() } */
export function swPuzzle(host, o = {}) {
  const svg = S("svg", { class: "sw-canvas swp", role: "group", "aria-label": "Le logiciel en pièces de casse-tête emboîtées, sans fil : chaque rangée finit sur une action" }); host.append(svg);
  let last = null, pending = null, cb = { w: 900, h: 520 }, prev = {}; const vw = { x: 0, y: 0, z: 1, moved: false, fitted: false };
  const size = () => [Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)];
  const apply = () => { const [W, H] = size(); svg.setAttribute("viewBox", `${vw.x} ${vw.y} ${W / vw.z} ${H / vw.z}`); svg.style.width = `${W}px`; svg.style.height = `${H}px`; bar.update(); };
  const fit = (user) => { const [W, H] = size(); Object.assign(vw, fitView(W, H, cb, 24, 1.3, 0.2), { moved: false, fitted: user ? true : vw.fitted }); apply(); };
  const zoomAt = (k, px, py) => { const [W, H] = size(); Object.assign(vw, zoomView(vw, k, px ?? W / 2, py ?? H / 2, 0.2, 4), { moved: true }); apply(); };
  const bar = viewBar({ label: "les pièces du logiciel", zoomOut: () => zoomAt(1 / 1.25), zoomIn: () => zoomAt(1.25), fit: () => fit(true), actual: () => zoomAt(1 / vw.z), text: () => `${Math.round(vw.z * 100)} %`, fitTip: "Ajuster à la fenêtre : toutes les pièces se voient" });
  bar.node.classList.add("sw-viewbar"); host.append(bar.node);
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-240, Math.min(240, e.deltaY)) * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let pan = null;
  svg.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.target.closest(".swp-piece")) return; pan = { x: e.clientX, y: e.clientY, vx: vw.x, vy: vw.y, on: false, id: e.pointerId }; });
  svg.addEventListener("pointermove", (e) => { if (!pan || e.pointerId !== pan.id) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.on) { if (Math.hypot(dx, dy) < 4) return; pan.on = true; try { svg.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } } vw.x = pan.vx - dx / vw.z; vw.y = pan.vy - dy / vw.z; vw.moved = true; apply(); });
  svg.addEventListener("pointerup", () => { if (pan && !pan.on) { pending = null; if (o.onPick) o.onPick(null); if (last) draw(...last); } pan = null; });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!vw.moved) fit(false); else apply(); }) : null; if (ro) ro.observe(host);
  const onKey = (e) => { if (e.key === "Escape" && pending) { pending = null; if (last) draw(...last); } }; svg.addEventListener("keydown", onKey);

  function draw(d, Rn, k, sel) {
    last = [d, Rn, k, sel]; svg.replaceChildren(); const P = pieces(d), L = links(d, P), F = puzzleForest(d, P, L), by = Object.fromEntries(P.map((p) => [p.id, p])); cb = { w: F.w, h: F.h + 46 };
    if (!vw.fitted && host.clientWidth > 1) { fit(false); vw.fitted = true; } else apply();
    const val = (ref) => (Rn && Rn.ports[ref] ? Rn.ports[ref][Math.min(k || 0, Rn.ports[ref].length - 1)] : undefined);
    svg.append(S("defs", null, S("filter", { id: "swp-shadow", x: "-10%", y: "-10%", width: "130%", height: "140%" }, S("feDropShadow", { dx: 0, dy: 2, stdDeviation: 2, "flood-opacity": 0.16 }))));
    /* the legend, once : the three colours, and the keys */
    const lg = S("g", { class: "swp-legend", "aria-hidden": "true", transform: `translate(0 ${F.h})` }); let lx = 20;
    BANDS.forEach((b, i) => { lg.append(S("rect", { x: lx, y: 10, width: 112, height: 26, rx: 13, style: `--dom:${b.color}`, class: "swp-chip" }), S("text", { x: lx + 56, y: 28, "text-anchor": "middle", class: "swp-chip-t", style: `--dom:${b.color}` }, `${i + 1} ${b.fr}`)); lx += 122; });
    const seen = [...new Set(F.nodes.map((n) => n.type).filter(Boolean))]; lx += 14;
    for (const t of seen) { const T = SIGNAL_TYPES[t]; lg.append(S("path", { d: `M ${lx} 11 L ${lx + 20} 11 ${keyPath(t, lx + 20, 23, 1, 7, 9)} L ${lx + 20} 35 L ${lx} 35 Z`, class: "swp-key", style: `--key:${T.color}` }), S("text", { x: lx + 34, y: 28, class: "swp-key-t" }, T.fr)); lx += 48 + T.fr.length * 6.6; }
    svg.append(lg);
    /* each row : the action at its right end, everything it needs snapped against its left */
    for (const r of F.rows) svg.append(S("rect", { x: 8, y: r.y - 8, width: F.w - 16, height: r.h + 16, rx: 14, class: "swp-row" }));
    const pend = pending ? new Set(P.filter((p) => p.id !== pending && connectPieces(d, pending, p.id).wires.length).map((p) => p.id)) : null;
    const ask = {}; for (const u of unsure(d)) ask[u.obj] = (ask[u.obj] || 0) + 1;
    for (const n of F.nodes) { const p = by[n.id]; if (!p) continue; const B = band(p.band), v = p.show ? val(p.show.ref) : undefined, isBool = p.show && p.show.unit === "0/1", H = SNAP.H, cy = n.h / 2;
      const cls = `swp-piece${n.twin ? " twin" : ""}${sel && sel.obj && p.members.includes(sel.obj) ? " sel" : ""}${pending === p.id ? " from" : ""}${pend && pend.has(p.id) ? " can" : ""}${pend && !pend.has(p.id) && pending !== p.id ? " nope" : ""}${isBool && v === 1 ? " lit" : ""}`;
      const g = S("g", { class: cls, "data-piece": p.id, "data-obj": p.id, "data-node": n.key, ...(n.twin ? { "data-twin": "" } : {}), transform: `translate(${n.x} ${n.y})`, style: `--dom:${B.color}`, tabindex: 0, role: "button", "aria-label": `${p.title}${n.twin ? " — jumeau" : ""} — ${B.fr}`,
        onClick: (e) => { e.stopPropagation(); if (pending && pending !== p.id) { const from = pending; pending = null; if (o.onConnect) o.onConnect(from, p.id); else draw(...last); return; } if (n.twin) { openIface(p.id); return; } if (o.onPick) o.onPick({ obj: p.id }); }, onKeydown: (e) => { if (e.key === "Enter") g.dispatchEvent(new MouseEvent("click")); } });
      const top = Math.max(0, cy - H / 2);      // a tall piece : its face in the middle, the body as tall as what it takes
      g.append(...[S("path", { d: snapOutline(n.w, n.h, n.type, n.ins), class: "swp-body", filter: n.twin ? null : "url(#swp-shadow)" }),
        n.type ? S("path", { d: keyPath(n.type, n.w, cy, 1, 7, 9).replace(/^L/, "M"), class: "swp-tab", style: `--key:${SIGNAL_TYPES[n.type].color}` }) : null,
        ...n.ins.map((q) => S("path", { d: keyPath(q.type, 0, q.y, -1, 7, 9).replace(/^L/, "M"), class: "swp-tab", style: `--key:${SIGNAL_TYPES[q.type].color}` })),
        S("circle", { cx: 30, cy: top + 26, r: 17, class: "swp-ico-bg" }), S("use", { href: `${sprite()}#i-${p.icon || B.icon}`, x: 19, y: top + 15, width: 22, height: 22, class: "swp-ico" }),
        S("text", { x: 54, y: top + 24, class: "swp-title" }, `${n.loop ? "↺ " : ""}${cut(p.title, n.loop ? 15 : 17)}`),
        S("title", null, n.twin ? `${p.title} — jumeau : la même pièce, posée ${F.copies[p.id] > 2 ? `à ${F.copies[p.id]} endroits` : "à deux endroits"}${n.loop ? " ; ici, sa valeur du pas d'avant (une boucle)" : ""}. Cliquer : le bloc d'interface.` : `${p.title} — ${KINDS[p.kind] ? KINDS[p.kind].fr : ""}${p.members.length > 1 ? ` (${p.members.length} blocs en arrière-plan)` : ""}`)].filter(Boolean));
      if (p.show) { const t = isBool ? (v === 1 ? "ACTIF" : "repos") : physText(v, p.show.unit); g.append(S("g", { class: `swp-lcd${isBool ? " bool" : ""}`, "data-lcd": p.show.ref }, S("rect", { x: 54, y: top + 34, width: 104, height: 20, rx: 6 }), isBool ? S("circle", { cx: 66, cy: top + 44, r: 4.5, class: "swp-lamp" }) : null, S("text", { x: isBool ? 76 : 61, y: top + 49, class: "sw-val", "data-val": p.show.ref, "data-unit": p.show.unit }, t))); }
      if (F.copies[p.id] > 1) g.append(S("g", { class: "swp-copies", "data-copies": p.id, tabindex: 0, role: "button", "aria-label": `${p.title} : ${F.copies[p.id]} endroits — ouvrir le bloc d'interface`, transform: `translate(${n.w - 34} ${top - 9})`, onClick: (e) => { e.stopPropagation(); openIface(p.id); }, onKeydown: (e) => { if (e.key === "Enter") { e.stopPropagation(); openIface(p.id); } } },
        S("rect", { width: 24, height: 18, rx: 9 }), S("text", { x: 12, y: 13, "text-anchor": "middle" }, `×${F.copies[p.id]}`), S("title", null, "Cette pièce sert à plusieurs endroits : voir la combinaison")));
      { const c = p.members.reduce((t, m) => t + (ask[m] || 0), 0), first = p.members.find((m) => ask[m]);      // « ? » : values of its blocks still to approve
        if (c && !n.twin) g.append(S("g", { class: "sw-ask", "data-sw-ask": p.id, tabindex: 0, role: "button", "aria-label": `${c} valeur${c > 1 ? "s" : ""} de ${p.title} à approuver`, transform: `translate(${n.w - 52} ${top})`, onClick: (e) => { e.stopPropagation(); if (o.onAsk) o.onAsk(first); }, onKeydown: (e) => { if (e.key === "Enter" && o.onAsk) { e.stopPropagation(); o.onAsk(first); } } },
          S("circle", { r: 10 }), S("text", { y: 4.5, "text-anchor": "middle" }, "?"), S("title", null, `${c} valeur${c > 1 ? "s" : ""} à approuver — cliquer pour le questionnaire`))); }
      if (!n.twin && p.band !== "act") g.append(S("circle", { cx: n.w - 12, cy: top + H - 12, r: 8, class: "swp-plug", tabindex: 0, role: "button", "aria-label": `Brancher ${p.title} sur une autre pièce : cliquez ici, puis sur la pièce qu'elle nourrit`,
        onClick: (e) => { e.stopPropagation(); pending = pending === p.id ? null : p.id; draw(...last); } }, S("title", null, "Brancher : cliquez ici, puis sur la pièce à nourrir — l'outil choisit les bonnes prises")));
      svg.append(g); }
    if (pending) svg.append(S("text", { x: 20, y: F.h + 62, class: "sw-hint" }, "Cliquez la pièce à nourrir — celles qui ne peuvent pas la prendre sont grisées. Échap pour renoncer."));
  }
  const openIface = (id) => { if (!last) return; swIface(host, last[0], id, { onPick: o.onPick, value: (ref) => { const [, Rn, k] = last; return Rn && Rn.ports[ref] ? Rn.ports[ref][Math.min(k || 0, Rn.ports[ref].length - 1)] : undefined; } }); };
  function values(get) {
    for (const t of svg.querySelectorAll("[data-val]")) { const ref = t.getAttribute("data-val"), u = t.getAttribute("data-unit"), v = get(ref); t.textContent = u === "0/1" ? (v === 1 ? "ACTIF" : "repos") : physText(v, u); const g = t.closest(".swp-piece"); if (g && u === "0/1") g.classList.toggle("lit", v === 1); }
    for (const l of svg.querySelectorAll(".swp-link")) { const fs = (l.getAttribute("data-froms") || "").split(" ").filter(Boolean), vs = fs.map((f) => get(f)), moved = fs.some((f, i) => prev[f] !== undefined && prev[f] !== vs[i]); l.classList.toggle("on", vs.some((v) => v === 1)); l.classList.toggle("flow", moved); fs.forEach((f, i) => { prev[f] = vs[i]; }); }
  }
  return { draw, values, fit: () => fit(true), get zoom() { return vw.z; }, get pending() { return pending; }, destroy() { svg.removeEventListener("keydown", onKey); if (ro) ro.disconnect(); svg.remove(); bar.node.remove(); } };
}
