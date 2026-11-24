/* DynamiteOrbit.ai — Logiciel : the PUZZLE view (choix cliqué de JP, 24 novembre 2026 : « Casse-tête 2D, 1 lien » — « une vue simplifiée… qui
   branche en arrière-plan ses bonnes interfaces… mais qui montre un seul lien en UI, comme Node-RED pour les débutants »).
   Three bands, left to right — CAPTER, DÉCIDER, AGIR — and in them the PIECES of the software (sw/sw_puzzle.js) : a jigsaw piece each, its
   knob on the right (what it gives), its socket on the left (what it takes), a big pictogram, a short name, and what it is worth NOW in the
   units of physics, or its lamp. ONE link joins two pieces, however many wires it stands for ; it lights and flows when what it carries
   moves. To connect : a click on the knob of a piece, then on the piece it feeds — the right ports are wired in the background
   (connectPieces) ; the pieces that cannot take it are greyed. A click on a piece opens its sheet ; on a link, what it carries.
   What it follows : the flow editors made for beginners (Node-RED : one wire between two nodes, a node a box with its name) and the jigsaw
   of visual programming ; the view pans and zooms as every 2D view of the tool (core/view_bar.js). Same API as modules/sw_canvas.js. */

import { KINDS } from "../sw/sw_objects.js";
import { BANDS, PIECE, pieces, links, puzzleLayout, connectPieces } from "../sw/sw_puzzle.js";
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

/** host, o : { onPick({ obj } | { wire } | null), onConnect(fromPiece, toPiece), onMove? } → { draw(design, R, k, sel), values(get), fit(), destroy() } */
export function swPuzzle(host, o = {}) {
  const svg = S("svg", { class: "sw-canvas swp", role: "group", "aria-label": "Le logiciel en pièces de casse-tête : capter, décider, agir — un lien par paire de pièces" }); host.append(svg);
  let last = null, pending = null, cb = { w: 900, h: 520 }, prev = {}; const vw = { x: 0, y: 0, z: 1, moved: false, fitted: false };
  const size = () => [Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)];
  const apply = () => { const [W, H] = size(); svg.setAttribute("viewBox", `${vw.x} ${vw.y} ${W / vw.z} ${H / vw.z}`); svg.style.width = `${W}px`; svg.style.height = `${H}px`; bar.update(); };
  const fit = (user) => { const [W, H] = size(); Object.assign(vw, fitView(W, H, cb, 24, 1.3, 0.2), { moved: false, fitted: user ? true : vw.fitted }); apply(); };
  const zoomAt = (k, px, py) => { const [W, H] = size(); Object.assign(vw, zoomView(vw, k, px ?? W / 2, py ?? H / 2, 0.2, 4), { moved: true }); apply(); };
  const bar = viewBar({ label: "les pièces du logiciel", zoomOut: () => zoomAt(1 / 1.25), zoomIn: () => zoomAt(1.25), fit: () => fit(true), actual: () => zoomAt(1 / vw.z), text: () => `${Math.round(vw.z * 100)} %`, fitTip: "Ajuster à la fenêtre : toutes les pièces se voient" });
  bar.node.classList.add("sw-viewbar"); host.append(bar.node);
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-240, Math.min(240, e.deltaY)) * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let pan = null;
  svg.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.target.closest(".swp-piece, .swp-link")) return; pan = { x: e.clientX, y: e.clientY, vx: vw.x, vy: vw.y, on: false, id: e.pointerId }; });
  svg.addEventListener("pointermove", (e) => { if (!pan || e.pointerId !== pan.id) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!pan.on) { if (Math.hypot(dx, dy) < 4) return; pan.on = true; try { svg.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } } vw.x = pan.vx - dx / vw.z; vw.y = pan.vy - dy / vw.z; vw.moved = true; apply(); });
  svg.addEventListener("pointerup", () => { if (pan && !pan.on) { pending = null; if (o.onPick) o.onPick(null); if (last) draw(...last); } pan = null; });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!vw.moved) fit(false); else apply(); }) : null; if (ro) ro.observe(host);
  const onKey = (e) => { if (e.key === "Escape" && pending) { pending = null; if (last) draw(...last); } }; svg.addEventListener("keydown", onKey);

  function draw(d, Rn, k, sel) {
    last = [d, Rn, k, sel]; svg.replaceChildren(); const P = pieces(d), L = links(d, P), Y = puzzleLayout(d, P, L), at = (id) => Y.layout[id]; cb = { w: Y.w, h: Y.h };
    if (!vw.fitted && host.clientWidth > 1) { fit(false); vw.fitted = true; } else apply();
    const val = (ref) => (Rn && Rn.ports[ref] ? Rn.ports[ref][Math.min(k || 0, Rn.ports[ref].length - 1)] : undefined);
    svg.append(S("defs", null, S("filter", { id: "swp-shadow", x: "-10%", y: "-10%", width: "130%", height: "140%" }, S("feDropShadow", { dx: 0, dy: 3, stdDeviation: 2.5, "flood-opacity": 0.18 })), S("filter", { id: "swp-glow", x: "-20%", y: "-60%", width: "140%", height: "220%" }, S("feGaussianBlur", { stdDeviation: 3.5 }))));
    /* the bands : what senses, what decides, what acts */
    const spans = BANDS.map((b) => { const cs = Y.cols.filter((c) => c.band === b.id); return { b, x0: Math.min(...cs.map((c) => c.x)) - 14, x1: Math.max(...cs.map((c) => c.x)) + PIECE.W + 30 }; });
    spans.forEach(({ b, x0, x1 }, i) => svg.append(S("g", { class: "swp-band", style: `--dom:${b.color}`, "data-band": b.id }, S("rect", { x: x0, y: 0, width: x1 - x0, height: Y.h, rx: 22 }),
      S("circle", { cx: x0 + 26, cy: 26, r: 15 }), S("text", { x: x0 + 26, y: 31, class: "swp-band-n", "text-anchor": "middle" }, String(i + 1)), S("use", { href: `${sprite()}#i-${b.icon}`, x: x0 + 48, y: 15, width: 22, height: 22, class: "swp-band-ico" }), S("text", { x: x0 + 76, y: 33, class: "swp-band-t" }, b.fr.toUpperCase()), S("title", null, b.says))));
    /* the links : one per pair of pieces */
    const pend = pending ? new Set(P.filter((p) => p.id !== pending && connectPieces(d, pending, p.id).wires.length).map((p) => p.id)) : null;
    for (const l of L) { const a = at(l.from), b = at(l.to); if (!a || !b) continue; const x1 = a.x + PIECE.W + KN * 1.7, y1 = a.y + PIECE.H / 2, x2 = b.x, y2 = b.y + PIECE.H / 2, back = x2 <= x1;
      const path = back ? `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x1 + 60} ${Math.max(y1, y2) + PIECE.H}, ${(x1 + x2) / 2} ${Math.max(y1, y2) + PIECE.H} S ${x2 - 60} ${y2}, ${x2} ${y2}` : `M ${x1} ${y1} C ${x1 + (x2 - x1) / 2} ${y1}, ${x2 - (x2 - x1) / 2} ${y2}, ${x2} ${y2}`;
      const on = l.wires.some((w) => val(w.from) === 1), pick = (e) => { e.stopPropagation(); if (o.onPick) o.onPick({ wire: l.wires[0], link: l }); }, picked = sel && sel.wire && l.wires.some((w) => w.from === sel.wire.from && w.to === sel.wire.to);
      const g = S("g", { class: `swp-link${on ? " on" : ""}${back ? " back" : ""}${picked ? " sel" : ""}`, "data-link": `${l.from}>${l.to}`, "data-froms": l.wires.map((w) => w.from).join(" "), tabindex: 0, role: "button", "aria-label": `Lien de ${l.from} vers ${l.to} : ${l.wires.length} liaison${l.wires.length > 1 ? "s" : ""}`, onClick: pick, onKeydown: (e) => { if (e.key === "Enter") pick(e); } },
        S("path", { d: path, class: "swp-hit" }), S("path", { d: path, class: "swp-line" }), S("title", null, `${l.wires.length} liaison${l.wires.length > 1 ? "s" : ""} en arrière-plan : ${l.wires.map((w) => `${w.from} → ${w.to}`).join(", ")}${back ? " — la valeur du pas d'avant (une boucle)" : ""}`));
      if (l.wires.length > 1) { const mx = back ? (x1 + x2) / 2 : (x1 + x2) / 2, my = back ? Math.max(y1, y2) + PIECE.H : (y1 + y2) / 2; g.append(S("rect", { x: mx - 13, y: my - 10, width: 26, height: 20, rx: 10, class: "swp-count" }), S("text", { x: mx, y: my + 4.5, "text-anchor": "middle", class: "swp-count-t" }, `×${l.wires.length}`)); }
      svg.append(g); }
    /* the pieces */
    for (const p of P) { const q = at(p.id); if (!q) continue; const B = band(p.band), gives = L.some((l) => l.from === p.id) || p.band !== "act", takes = p.band !== "sense" || L.some((l) => l.to === p.id), v = p.show ? val(p.show.ref) : undefined, isBool = p.show && p.show.unit === "0/1";
      const cls = `swp-piece${sel && sel.obj && p.members.includes(sel.obj) ? " sel" : ""}${pending === p.id ? " from" : ""}${pend && pend.has(p.id) ? " can" : ""}${pend && !pend.has(p.id) && pending !== p.id ? " nope" : ""}${isBool && v === 1 ? " lit" : ""}`;
      const g = S("g", { class: cls, "data-piece": p.id, "data-obj": p.id, transform: `translate(${q.x} ${q.y})`, style: `--dom:${B.color}`, tabindex: 0, role: "button", "aria-label": `${p.title} — ${B.fr}`,
        onClick: (e) => { e.stopPropagation(); if (pending && pending !== p.id) { const from = pending; pending = null; if (o.onConnect) o.onConnect(from, p.id); else draw(...last); return; } if (o.onPick) o.onPick({ obj: p.id }); }, onKeydown: (e) => { if (e.key === "Enter") g.dispatchEvent(new MouseEvent("click")); } });
      g.append(...[S("path", { d: pieceOutline(PIECE.W, PIECE.H, gives, takes), class: "swp-body", filter: "url(#swp-shadow)" }),
        S("circle", { cx: 34, cy: PIECE.H / 2, r: 22, class: "swp-ico-bg" }), S("use", { href: `${sprite()}#i-${p.icon || B.icon}`, x: 20, y: PIECE.H / 2 - 14, width: 28, height: 28, class: "swp-ico" }),
        S("text", { x: 64, y: 30, class: "swp-title" }, cut(p.title, 17)), p.title.length > 17 ? S("text", { x: 64, y: 47, class: "swp-title" }, cut(p.title.slice(16), 17)) : null,
        S("title", null, `${p.title} — ${KINDS[p.kind] ? KINDS[p.kind].fr : ""}${p.members.length > 1 ? ` (${p.members.length} blocs en arrière-plan)` : ""}`)].filter(Boolean));
      if (p.show) { const t = isBool ? (v === 1 ? "ACTIF" : "repos") : physText(v, p.show.unit); g.append(S("g", { class: `swp-lcd${isBool ? " bool" : ""}`, "data-lcd": p.show.ref }, S("rect", { x: 64, y: PIECE.H - 34, width: 112, height: 22, rx: 6 }), isBool ? S("circle", { cx: 77, cy: PIECE.H - 23, r: 5, class: "swp-lamp" }) : null, S("text", { x: isBool ? 88 : 72, y: PIECE.H - 18, class: "sw-val", "data-val": p.show.ref, "data-unit": p.show.unit }, t))); }
      if (gives) { const knob = S("circle", { cx: PIECE.W + KN * 0.95, cy: PIECE.H / 2, r: KN * 0.9, class: "swp-knob", tabindex: 0, role: "button", "aria-label": `Relier ${p.title} à une autre pièce : cliquez ici, puis sur la pièce qu'elle nourrit`,
          onClick: (e) => { e.stopPropagation(); pending = pending === p.id ? null : p.id; draw(...last); } }, S("title", null, "Cliquez ici, puis sur la pièce à nourrir : l'outil branche les bonnes interfaces")); g.append(knob); }
      svg.append(g); }
    if (pending) svg.append(S("text", { x: 20, y: Y.h + 22, class: "sw-hint" }, "Cliquez la pièce à nourrir — celles qui ne peuvent pas la prendre sont grisées. Échap pour renoncer."));
  }
  function values(get) {
    for (const t of svg.querySelectorAll("[data-val]")) { const ref = t.getAttribute("data-val"), u = t.getAttribute("data-unit"), v = get(ref); t.textContent = u === "0/1" ? (v === 1 ? "ACTIF" : "repos") : physText(v, u); const g = t.closest(".swp-piece"); if (g && u === "0/1") g.classList.toggle("lit", v === 1); }
    for (const l of svg.querySelectorAll(".swp-link")) { const fs = (l.getAttribute("data-froms") || "").split(" ").filter(Boolean), vs = fs.map((f) => get(f)), moved = fs.some((f, i) => prev[f] !== undefined && prev[f] !== vs[i]); l.classList.toggle("on", vs.some((v) => v === 1)); l.classList.toggle("flow", moved); fs.forEach((f, i) => { prev[f] = vs[i]; }); }
  }
  return { draw, values, fit: () => fit(true), get zoom() { return vw.z; }, get pending() { return pending; }, destroy() { svg.removeEventListener("keydown", onKey); if (ro) ro.disconnect(); svg.remove(); bar.node.remove(); } };
}
