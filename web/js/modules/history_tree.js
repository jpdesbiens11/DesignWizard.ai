/* DynamiteOrbit.ai — Historique : the TREE of the restore points, drawn as a version-control client draws its commit graph — a COLUMN per
   branch, named at its head, MAIN in the centre and drawn heavier (demande de JP, 21 novembre 2026 : « la MAIN branche au centre clairement
   identifiée »), the other branches on either side in the order they opened ; a row per point, in the order they were posed (the first at the
   top). A merge point on MAIN takes a second line from the end of the branch it took in. The point « vous êtes ici » ringed, as the snapshot
   manager of a virtual machine shows it ; below, dashed, what changed since and is kept by no point yet — in the lane it will go into.
   A point is a button : a click or Entrée chooses it, ↑ ↓ go from a point to the next. A branch set aside is drawn pale.
   The page pans and zooms like every 2D view (modules/svg_view.js). Draws ; decides nothing. Layout : core/history_branches.js branchLayout. */

import { svgView } from "./svg_view.js";
import { POINT_KINDS, MAIN } from "../core/history.js";
import { branchLayout } from "../core/history_branches.js";

const NS = "http://www.w3.org/2000/svg", ROW = 58, LANE = 34, X0 = 30, HEAD = 46, R = 9, TEXT_W = 430;
const LANES = ["#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0891b2", "#dc2626"], MAIN_COLOR = "#0f766e";
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
/** The colour of a branch : MAIN its own, the others in the order they opened. */
export function laneColor(lanes, name) { if (name === MAIN) return MAIN_COLOR; const i = lanes.filter((l) => l.name !== MAIN).findIndex((l) => l.name === name); return LANES[Math.max(0, i) % LANES.length]; }

/** host : where it is drawn ; o : { onPick(id) } → { draw(h, sel, pending, next), focus(id), destroy() } — pending : how many artefacts changed
    since « ici » ; next : the branch the next point goes into */
export function historyTree(host, o = {}) {
  const view = svgView(host, { cls: "hist-tree", label: "l'arbre de l'historique", data: "data-history-tree", fitTip: "Ajuster à la fenêtre : tout l'arbre se voit", grab: "[data-point]" }), svg = view.svg;
  let order = [];
  const focus = (id) => { const g = svg.querySelector(`[data-point="${CSS.escape(id)}"]`); if (g) g.focus({ preventScroll: true }); };

  function draw(h, sel, pending = 0, next = null) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const G = branchLayout(h), byId = new Map(G.rows.map((r) => [r.id, r])), pts = new Map((h.points || []).map((p) => [p.id, p])), head = byId.get(h.head);
    const lanes = G.lanes.slice(), known = lanes.find((l) => l.name === next), fresh = pending && next && !known;
    if (fresh) lanes.push({ name: next, col: G.cols, row: G.rows.length });
    const cols = G.cols + (fresh ? 1 : 0), X = (col) => X0 + col * LANE, Y = (row) => HEAD + 22 + row * ROW, tx = X0 + cols * LANE + 10;
    const rows = G.rows.length + (pending ? 1 : 0), box = { w: tx + TEXT_W, h: Y(Math.max(1, rows)) };
    const color = (name) => laneColor(lanes, name);
    const guides = S("g", { class: "hist-guides" }), edges = S("g", { class: "hist-edges" }), nodes = S("g", { class: "hist-nodes" }), heads = S("g", { class: "hist-heads" });
    svg.append(S("rect", { class: "hist-back", x: -5000, y: -5000, width: box.w + 10000, height: box.h + 10000 }), guides, edges, nodes, heads);
    const tag = (name, x, y, anchor, small = false) => { const w = Math.max(40, name.length * (small ? 6.6 : 7.4) + 16), hh = small ? 9 : 11, x0 = anchor === "middle" ? x - w / 2 : x;      // a branch named : a pill in its colour
      return { w, g: S("g", { class: `hist-lane-name${name === MAIN ? " main" : ""}${small ? " small" : ""}`, "data-lane": name, transform: `translate(${x0} ${y})` },
        S("title", null, name === MAIN ? "MAIN : la branche principale, au centre — les autres y reviennent par une fusion" : `Branche « ${name} » — son dernier point`),
        S("rect", { x: 0, y: -hh, width: w, height: 2 * hh, rx: hh, fill: color(name) }), S("text", { x: w / 2, y: small ? 3.8 : 4.5, "text-anchor": "middle" }, name)) }; };
    for (const l of lanes) {      // the column of each branch ; MAIN in the centre, heavier, named at its head ; every branch named on its last point
      const x = X(l.col), main = l.name === MAIN;
      guides.append(S("line", { class: `hist-lane${main ? " main" : ""}`, x1: x, x2: x, y1: HEAD - 2, y2: box.h - 6, stroke: color(l.name) }));
      if (main) heads.append(tag(MAIN, x, HEAD - 24, "middle").g);
    }
    const tips = new Map(); for (const r of G.rows) tips.set(r.branch, r.id);
    const curve = (a, b, cls, stroke) => { const px = X(a.col), py = Y(a.row), cx = X(b.col), cy = Y(b.row);
      edges.append(S("path", { d: px === cx ? `M${px} ${py}V${cy}` : `M${px} ${py}C${px} ${py + ROW * 0.55} ${cx} ${py + ROW * 0.3} ${cx} ${py + ROW * 0.85}V${cy}`, stroke, class: cls })); };
    for (const r of G.rows) {
      if (r.parent && byId.has(r.parent)) curve(byId.get(r.parent), r, `hist-edge${r.branch === MAIN ? " main" : ""}${pts.get(r.id).dropped ? " dropped" : ""}`, color(r.branch));
      if (r.merged && byId.has(r.merged)) { const a = byId.get(r.merged); edges.append(S("path", { d: `M${X(a.col)} ${Y(a.row)}C${X(a.col)} ${Y(r.row) - ROW * 0.6} ${X(r.col)} ${Y(r.row) - ROW * 0.5} ${X(r.col)} ${Y(r.row)}`, stroke: color(a.branch), class: "hist-edge merge" })); }
    }
    order = [];
    for (const r of G.rows) {
      const p = pts.get(r.id), K = POINT_KINDS[p.kind] || POINT_KINDS.manual, x = X(r.col), y = Y(r.row), here = p.id === h.head, on = sel === p.id, c = p.context || {};
      const sub = [when(p.at), r.branch === MAIN ? "MAIN" : `branche « ${r.branch} »`, K.label, p.by || "", c.mvp ? c.mvp.name : ""].filter(Boolean).join(" · ");
      const g = S("g", { class: `hist-node${here ? " here" : ""}${on ? " sel" : ""}${p.dropped ? " dropped" : ""}`, tabindex: "0", role: "button", "aria-pressed": on ? "true" : "false", "data-point": p.id, "data-branch": r.branch,
        "aria-label": `${p.id} — ${p.label} — ${r.branch}${here ? " — vous êtes ici" : ""}`,
        onClick: () => o.onPick && o.onPick(p.id),
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.onPick && o.onPick(p.id); } else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = order.indexOf(p.id), nx = order[i + (e.key === "ArrowDown" ? 1 : -1)]; if (nx) { o.onPick && o.onPick(nx); requestAnimationFrame(() => focus(nx)); } } } },
        S("rect", { class: "hist-hit", x: x - R - 6, y: y - ROW / 2 + 4, width: tx + TEXT_W - x + R, height: ROW - 8, rx: 8 }),
        here ? S("circle", { class: "hist-ring", cx: x, cy: y, r: R + 5 }) : null,
        S("circle", { class: `hist-dot${r.branch === MAIN ? " main" : ""}`, cx: x, cy: y, r: R, fill: K.color }),
        p.kind === "ai" ? S("path", { class: "hist-glyph", d: `M${x} ${y - 4.5}L${x + 1.4} ${y - 1.4}L${x + 4.5} ${y}L${x + 1.4} ${y + 1.4}L${x} ${y + 4.5}L${x - 1.4} ${y + 1.4}L${x - 4.5} ${y}L${x - 1.4} ${y - 1.4}Z` })
          : p.kind === "before" ? S("path", { class: "hist-glyph line", d: `M${x + 3.5} ${y + 2}A4 4 0 1 0 ${x - 3.5} ${y + 2}M${x - 3.5} ${y + 2}l-1.5 -3M${x - 3.5} ${y + 2}l3 -1` })
          : p.kind === "merge" ? S("path", { class: "hist-glyph line", d: `M${x - 4} ${y - 4}L${x} ${y}L${x + 4} ${y - 4}M${x} ${y}V${y + 4.5}` })
          : p.kind === "import" ? S("path", { class: "hist-glyph line", d: `M${x} ${y - 4.5}V${y + 2}M${x - 3} ${y - 1}L${x} ${y + 2}L${x + 3} ${y - 1}M${x - 4} ${y + 4.5}H${x + 4}` }) : null,
        ...(() => { const t = tips.get(r.branch) === p.id && lanes.length > 1 ? tag(r.branch, tx, y - 8, "start", true) : null, lx = t ? tx + t.w + 8 : tx;      // the last point of a branch carries its name
          return [t ? t.g : null, S("text", { class: "hist-label", x: lx, y: y - 3 }, S("tspan", { class: "hist-id" }, `${p.id}  `), p.label, here ? S("tspan", { class: "hist-here" }, "  ◀ vous êtes ici") : null)]; })(),
        S("text", { class: "hist-sub", x: tx, y: y + 13 }, sub));
      nodes.append(g); order.push(p.id);
    }
    if (pending) {      // what changed since « ici », kept by no point yet — in the lane the next point goes into
      const lane = lanes.find((l) => l.name === next) || (head ? { col: head.col } : { col: G.main }), y = Y(G.rows.length), x = X(lane.col);
      if (head) curve(head, { col: lane.col, row: G.rows.length }, "hist-edge pending", null);
      nodes.append(S("g", { class: "hist-node now", "data-history-now": "" }, S("circle", { class: "hist-dot now", cx: x, cy: y, r: R }),
        S("text", { class: "hist-label", x: tx, y: y - 3 }, "Maintenant"),
        S("text", { class: "hist-sub", x: tx, y: y + 13 }, `${pending} artéfact${pending > 1 ? "s ont" : " a"} changé depuis le point « ici » — le prochain point ira dans ${next === MAIN ? "MAIN" : `« ${next} »`}${fresh ? " (nouvelle branche)" : ""}`)));
    }
    view.setBox(box.w, box.h);
  }
  return { draw, focus, fit: view.fit, destroy: view.destroy };
}
