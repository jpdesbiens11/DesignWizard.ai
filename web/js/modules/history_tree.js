/* DesignWizard.ai — Historique : the TREE of the restore points, drawn as a version-control client draws its commit graph — a row per point,
   in the order they were posed (the first at the top), a lane per branch, the first child of a point in its lane, another one in a new lane ;
   the point « vous êtes ici » ringed, as the snapshot manager of a virtual machine shows it ; below it, dashed, what changed since and is
   kept by no point yet. A point is a button : a click or Entrée chooses it, ↑ ↓ go from a point to the next. A branch set aside is drawn pale.
   The page pans and zooms like every 2D view (core/view_bar.js) : wheel, drag of the background, − % + · Ajuster · Loupe. Draws ; decides nothing. */

import { viewBar, fitView, zoomView } from "../core/view_bar.js";
import { layout, POINT_KINDS } from "../core/history.js";

const NS = "http://www.w3.org/2000/svg", ROW = 58, LANE = 30, X0 = 26, Y0 = 30, R = 9, TEXT_W = 430;
const LANES = ["#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0891b2", "#dc2626"];
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };

/** host : where it is drawn ; o : { onPick(id) } → { draw(h, sel, pending), focus(id), destroy() } — pending : how many artefacts changed since « ici » */
export function historyTree(host, o = {}) {
  const svg = S("svg", { class: "hist-tree", role: "group", "aria-label": "L'arbre des points de restauration", "data-history-tree": "" }); host.append(svg);
  const vw = { x: 0, y: 0, z: 1, moved: false }, size = () => [Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)];
  let box = { w: 600, h: 300 }, order = [];
  const apply = () => { const [W, H] = size(); svg.setAttribute("viewBox", `${vw.x} ${vw.y} ${W / vw.z} ${H / vw.z}`); svg.style.width = `${W}px`; svg.style.height = `${H}px`; bar.update(); };
  const fit = () => { const [W, H] = size(); Object.assign(vw, fitView(W, H, box, 20, 1.25, 0.2), { moved: false }); apply(); };
  const zoomAt = (k, px, py) => { const [W, H] = size(); Object.assign(vw, zoomView(vw, k, px ?? W / 2, py ?? H / 2, 0.2, 4), { moved: true }); apply(); };
  const bar = viewBar({ label: "l'arbre de l'historique", zoomOut: () => zoomAt(1 / 1.25), zoomIn: () => zoomAt(1.25), fit, actual: () => zoomAt(1 / vw.z), text: () => `${Math.round(vw.z * 100)} %`, fitTip: "Ajuster à la fenêtre : tout l'arbre se voit" });
  bar.node.classList.add("view-float"); host.append(bar.node);
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-240, Math.min(240, e.deltaY)) * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("[data-point]")) return;
    const x0 = e.clientX, y0 = e.clientY, v0 = { ...vw }; let moved = false; svg.setPointerCapture(e.pointerId);
    const move = (ev) => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; host.classList.add("panning"); vw.x = v0.x - dx / vw.z; vw.y = v0.y - dy / vw.z; vw.moved = true; apply(); };
    const up = () => { host.classList.remove("panning"); svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerup", up); svg.removeEventListener("pointercancel", up); };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!vw.moved) fit(); else apply(); }) : null; if (ro) ro.observe(host);
  const focus = (id) => { const g = svg.querySelector(`[data-point="${CSS.escape(id)}"]`); if (g) g.focus({ preventScroll: true }); };

  function draw(h, sel, pending = 0) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const L = layout(h), byId = new Map(L.rows.map((r) => [r.id, r])), pts = new Map((h.points || []).map((p) => [p.id, p])), head = byId.get(h.head);
    const nowLane = head ? (L.rows.some((r) => r.parent === head.id) ? L.lanes : head.lane) : 0, lanes = L.lanes + (head && nowLane === L.lanes && pending ? 1 : 0);
    const X = (lane) => X0 + lane * LANE, Y = (row) => Y0 + row * ROW, tx = X0 + lanes * LANE + 10;
    const rows = L.rows.length + (pending ? 1 : 0); box = { w: tx + TEXT_W, h: Y0 + Math.max(1, rows) * ROW };
    const edges = S("g", { class: "hist-edges" }), nodes = S("g", { class: "hist-nodes" }); svg.append(S("rect", { class: "hist-back", x: -5000, y: -5000, width: box.w + 10000, height: box.h + 10000 }), edges, nodes);
    const edge = (a, b, lane, cls) => { const px = X(a.lane), py = Y(a.row), cx = X(lane), cy = Y(b.row);
      edges.append(S("path", { d: px === cx ? `M${px} ${py}V${cy}` : `M${px} ${py}C${px} ${py + ROW * 0.55} ${cx} ${py + ROW * 0.3} ${cx} ${py + ROW * 0.85}V${cy}`, stroke: LANES[lane % LANES.length], class: cls })); };
    for (const r of L.rows) if (r.parent && byId.has(r.parent)) edge(byId.get(r.parent), r, r.lane, pts.get(r.id).dropped ? "hist-edge dropped" : "hist-edge");
    order = [];
    for (const r of L.rows) {
      const p = pts.get(r.id), K = POINT_KINDS[p.kind] || POINT_KINDS.manual, x = X(r.lane), y = Y(r.row), here = p.id === h.head, on = sel === p.id, c = p.context || {};
      const sub = [when(p.at), K.label, c.mvp ? c.mvp.name : "", c.revs && c.revs.frozen + c.revs.released ? `${c.revs.frozen + c.revs.released} révision(s) gelée(s)` : ""].filter(Boolean).join(" · ");
      const g = S("g", { class: `hist-node${here ? " here" : ""}${on ? " sel" : ""}${p.dropped ? " dropped" : ""}`, tabindex: "0", role: "button", "aria-pressed": on ? "true" : "false", "data-point": p.id,
        "aria-label": `${p.id} — ${p.label}${here ? " — vous êtes ici" : ""}`,
        onClick: () => o.onPick && o.onPick(p.id),
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.onPick && o.onPick(p.id); } else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = order.indexOf(p.id), nx = order[i + (e.key === "ArrowDown" ? 1 : -1)]; if (nx) { o.onPick && o.onPick(nx); requestAnimationFrame(() => focus(nx)); } } } },
        S("rect", { class: "hist-hit", x: x - R - 6, y: y - ROW / 2 + 4, width: tx + TEXT_W - x + R, height: ROW - 8, rx: 8 }),
        here ? S("circle", { class: "hist-ring", cx: x, cy: y, r: R + 5 }) : null,
        S("circle", { class: "hist-dot", cx: x, cy: y, r: R, fill: K.color }),
        p.kind === "ai" ? S("path", { class: "hist-glyph", d: `M${x} ${y - 4.5}L${x + 1.4} ${y - 1.4}L${x + 4.5} ${y}L${x + 1.4} ${y + 1.4}L${x} ${y + 4.5}L${x - 1.4} ${y + 1.4}L${x - 4.5} ${y}L${x - 1.4} ${y - 1.4}Z` }) : p.kind === "before" ? S("path", { class: "hist-glyph line", d: `M${x + 3.5} ${y + 2}A4 4 0 1 0 ${x - 3.5} ${y + 2}M${x - 3.5} ${y + 2}l-1.5 -3M${x - 3.5} ${y + 2}l3 -1` }) : null,
        S("text", { class: "hist-label", x: tx, y: y - 3 }, S("tspan", { class: "hist-id" }, `${p.id}  `), p.label, here ? S("tspan", { class: "hist-here" }, "  ◀ vous êtes ici") : null),
        S("text", { class: "hist-sub", x: tx, y: y + 13 }, sub));
      nodes.append(g); order.push(p.id);
    }
    if (pending) {      // what changed since « ici », kept by no point yet
      const y = Y(L.rows.length), x = X(nowLane);
      if (head) edges.append(S("path", { d: X(head.lane) === x ? `M${x} ${Y(head.row)}V${y}` : `M${X(head.lane)} ${Y(head.row)}C${X(head.lane)} ${Y(head.row) + ROW * 0.55} ${x} ${Y(head.row) + ROW * 0.3} ${x} ${Y(head.row) + ROW * 0.85}V${y}`, class: "hist-edge pending" }));
      nodes.append(S("g", { class: "hist-node now", "data-history-now": "" }, S("circle", { class: "hist-dot now", cx: x, cy: y, r: R }),
        S("text", { class: "hist-label", x: tx, y: y - 3 }, "Maintenant"), S("text", { class: "hist-sub", x: tx, y: y + 13 }, `${pending} artéfact${pending > 1 ? "s ont" : " a"} changé depuis le point « ici » — aucun point ne les garde encore`)));
    }
    if (!vw.moved) fit(); else apply();
  }
  return { draw, focus, fit, destroy: () => { if (ro) ro.disconnect(); bar.node.remove(); svg.remove(); } };
}
