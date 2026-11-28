/* DynamiteOrbit.ai — Historique : the TREE of the restore points, drawn as a version-control client draws its commit graph — a COLUMN per
   branch, MAIN in the centre and drawn heavier (demande de JP, 21 novembre 2026 : « la MAIN branche au centre clairement identifiée »), the
   other branches on either side in the order they opened ; a row per point. The newest point on top by default, as GitHub Desktop, Sourcetree
   and GitKraken show a history ; « Plus ancien en haut » turns it over, and the choice is kept in this browser (JP, 28 novembre 2026, by menu :
   « Plus récent en haut, bascule »). A title is written whole, on as many lines as it needs (three at most, the rest in its tooltip) ; the name
   of a branch is said once, at the head of its run of rows ; the line under a title says the date, and the author or the MVP iteration only
   when they change (same day, by menu : « Titres complets, branche une fois ») — the rows : core/history_view.js treeRows.
   A merge point on MAIN takes a second line from the end of the branch it took in. The point « vous êtes ici » ringed, as the snapshot manager
   of a virtual machine shows it ; at the newest end, dashed, what changed since and is kept by no point yet — in the lane it will go into.
   A point is a button : a click or Entrée chooses it, ↑ ↓ go to the row above or below, and the view follows. A branch set aside is drawn pale.
   The page pans and zooms like every 2D view (modules/svg_view.js) ; a tall tree opens fitted to its width, at its newest end. Draws ; decides nothing. */

import { svgView } from "./svg_view.js";
import { el } from "../core/dom.js";
import { POINT_KINDS, MAIN } from "../core/history.js";
import { treeRows } from "../core/history_view.js";

const NS = "http://www.w3.org/2000/svg", LANE = 34, X0 = 30, HEAD = 62, R = 9, TEXT_W = 540, ORDER_KEY = "dw.history.order";
const LANES = ["#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0891b2", "#dc2626"], MAIN_COLOR = "#0f766e";
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
/** The colour of a branch : MAIN its own, the others in the order they opened. */
export function laneColor(lanes, name) { if (name === MAIN) return MAIN_COLOR; const i = lanes.filter((l) => l.name !== MAIN).findIndex((l) => l.name === name); return LANES[Math.max(0, i) % LANES.length]; }
/** Newest on top ? What this browser keeps ; newest first when nothing is kept. */
export const newestFirst = () => { try { return localStorage.getItem(ORDER_KEY) !== "old"; } catch (e) { return true; } };
const keepOrder = (newest) => { try { localStorage.setItem(ORDER_KEY, newest ? "new" : "old"); } catch (e) { /* a private window keeps nothing : the switch still works for the visit */ } };
/** The width of a text in the font of the tree (a canvas measures it ; a rough width without one). */
function measurer() {
  let ctx = null; try { ctx = document.createElement("canvas").getContext("2d"); } catch (e) { ctx = null; }
  const family = (v, or) => (typeof getComputedStyle === "function" && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || or;
  return (font, v = "--font") => { const f = `${font} ${family(v, v === "--mono" ? "monospace" : "system-ui, sans-serif")}`; return (s) => { if (!ctx) return String(s).length * 7.6; ctx.font = f; return ctx.measureText(String(s)).width; }; };
}

/** host : where it is drawn ; o : { onPick(id) } → { draw(h, sel, pending, next), focus(id), fit(), destroy() } — pending : how many artefacts
    changed since « ici » ; next : the branch the next point goes into */
export function historyTree(host, o = {}) {
  const view = svgView(host, { cls: "hist-tree", label: "l'arbre de l'historique", data: "data-history-tree", fitTip: "Ajuster à la fenêtre : la largeur de l'arbre, son point le plus récent en vue", grab: "[data-point]",
    tall: () => (newestFirst() ? "top" : "bottom") }), svg = view.svg, M = measurer(), label = M("600 14px"), mono = M("700 13px", "--mono");
  let order = [], places = new Map(), last = null;
  const focus = (id) => { const g = svg.querySelector(`[data-point="${CSS.escape(id)}"]`); if (g) g.focus({ preventScroll: true }); const r = places.get(id); if (r) view.reveal(r.top, r.top + r.h); };

  /* the order of the rows, on the view : « Plus récent en haut · Plus ancien en haut » — the same two-way switch as « Plié · À plat » */
  const seg = el("div", { class: "seg text hist-order", role: "group", "aria-label": "Ordre des points de l'arbre", "data-history-order": "" });
  for (const [key, text, tip] of [["new", "↓ Plus récent en haut", "Le dernier point posé en haut de l'arbre, comme l'historique d'un client de gestion de versions"], ["old", "↑ Plus ancien en haut", "Le premier point en haut, le dernier en bas"]]) {
    const b = el("button", { type: "button", class: "seg-btn", "data-order": key, "data-tip": tip }, text);
    b.addEventListener("click", () => { if ((key === "new") === newestFirst()) return; keepOrder(key === "new"); if (last) { draw(...last); view.fit(); } }); seg.append(b);
  }
  host.append(seg);
  const paintSeg = () => { for (const b of seg.children) { const on = (b.dataset.order === "new") === newestFirst(); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } };

  function draw(h, sel, pending = 0, next = null) {
    last = [h, sel, pending, next]; paintSeg();
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const newest = newestFirst(), T = treeRows(h, { newest, width: TEXT_W, measure: label, idWidth: (id) => mono(`${id}  `), hereWidth: label("  ◀ vous êtes ici") + 6, when, pending });
    const pts = new Map((h.points || []).map((p) => [p.id, p])), byId = new Map(T.rows.filter((r) => r.id).map((r) => [r.id, r])), head = byId.get(h.head);
    const lanes = T.lanes.slice(), known = lanes.find((l) => l.name === next), fresh = pending && next && !known;
    if (fresh) lanes.push({ name: next, col: T.cols });
    const cols = T.cols + (fresh ? 1 : 0), X = (col) => X0 + col * LANE, Y = (y) => HEAD + 8 + y, tx = X0 + cols * LANE + 10, box = { w: tx + TEXT_W + 20, h: Y(T.height) + 10 };
    const color = (name) => laneColor(lanes, name);
    const guides = S("g", { class: "hist-guides" }), edges = S("g", { class: "hist-edges" }), nodes = S("g", { class: "hist-nodes" }), heads = S("g", { class: "hist-heads" });
    svg.append(S("rect", { class: "hist-back", x: -5000, y: -5000, width: box.w + 10000, height: box.h + 10000 }), guides, edges, nodes, heads);
    const tag = (name, x, y, anchor, small = false) => { const w = Math.max(40, label(name) * (small ? 0.84 : 0.92) + 18), hh = small ? 9 : 11, x0 = anchor === "middle" ? x - w / 2 : x;      // a branch named : a pill in its colour
      return S("g", { class: `hist-lane-name${name === MAIN ? " main" : ""}${small ? " small" : ""}`, "data-lane": name, transform: `translate(${x0} ${y})` },
        S("title", null, name === MAIN ? "MAIN : la branche principale, au centre — les autres y reviennent par une fusion" : `Branche « ${name} »`),
        S("rect", { x: 0, y: -hh, width: w, height: 2 * hh, rx: hh, fill: color(name) }), S("text", { x: w / 2, y: small ? 3.8 : 4.5, "text-anchor": "middle" }, name)); };
    for (const l of lanes) {      // the column of each branch ; MAIN in the centre, heavier, named at its head
      const x = X(l.col), main = l.name === MAIN;
      guides.append(S("line", { class: `hist-lane${main ? " main" : ""}`, x1: x, x2: x, y1: HEAD - 2, y2: box.h - 6, stroke: color(l.name) }));
      if (main) heads.append(tag(MAIN, x, HEAD - 24, "middle"));
    }
    /* a line from a point to the next one : it leaves the parent toward the child, turns into the child's column at once, then runs in it */
    const curve = (a, b, cls, stroke) => { const px = X(a.col), py = Y(a.dotY), cx = X(b.col), cy = Y(b.dotY), d = Math.sign(cy - py) || 1;
      edges.append(S("path", { d: px === cx ? `M${px} ${py}V${cy}` : `M${px} ${py}C${px} ${py + d * 24} ${cx} ${py + d * 12} ${cx} ${py + d * 36}V${cy}`, stroke, class: cls })); };
    for (const r of T.rows) {
      if (!r.id) continue;
      if (r.parent && byId.has(r.parent)) curve(byId.get(r.parent), r, `hist-edge${r.branch === MAIN ? " main" : ""}${pts.get(r.id).dropped ? " dropped" : ""}`, color(r.branch));
      if (r.merged && byId.has(r.merged)) { const a = byId.get(r.merged), ax = X(a.col), ay = Y(a.dotY), mx = X(r.col), my = Y(r.dotY), d = Math.sign(my - ay) || 1;
        edges.append(S("path", { d: `M${ax} ${ay}V${my - d * 36}C${ax} ${my - d * 12} ${mx} ${my - d * 24} ${mx} ${my}`, stroke: color(a.branch), class: "hist-edge merge" })); }
    }
    order = []; places = new Map();
    for (const r of T.rows) {
      if (!r.id) continue;
      const p = pts.get(r.id), K = POINT_KINDS[p.kind] || POINT_KINDS.manual, x = X(r.col), y = Y(r.dotY), here = p.id === h.head, on = sel === p.id;
      const idw = mono(`${p.id}  `), full = `${p.id} — ${p.label}${here ? " — vous êtes ici" : ""}\nBranche : ${r.branch}${p.note ? `\n\n${p.note.length > 400 ? `${p.note.slice(0, 400)} …` : p.note}` : ""}`;
      const g = S("g", { class: `hist-node${here ? " here" : ""}${on ? " sel" : ""}${p.dropped ? " dropped" : ""}${p.demo ? " demo" : ""}`, tabindex: "0", role: "button", "aria-pressed": on ? "true" : "false", "data-point": p.id, "data-branch": r.branch,
        "aria-label": `${p.id} — ${p.label} — ${r.branch}${here ? " — vous êtes ici" : ""}`,
        onClick: () => o.onPick && o.onPick(p.id),
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.onPick && o.onPick(p.id); } else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const i = order.indexOf(p.id), nx = order[i + (e.key === "ArrowDown" ? 1 : -1)]; if (nx) { o.onPick && o.onPick(nx); requestAnimationFrame(() => focus(nx)); } } } },
        S("title", null, full),
        S("rect", { class: "hist-hit", x: x - R - 6, y: Y(r.top) + 3, width: tx + TEXT_W + 10 - (x - R - 6), height: r.h - 6, rx: 8 }),
        here ? S("circle", { class: "hist-ring", cx: x, cy: y, r: R + 5 }) : null,
        S("circle", { class: `hist-dot${r.branch === MAIN ? " main" : ""}`, cx: x, cy: y, r: R, fill: K.color }),
        p.kind === "ai" ? S("path", { class: "hist-glyph", d: `M${x} ${y - 4.5}L${x + 1.4} ${y - 1.4}L${x + 4.5} ${y}L${x + 1.4} ${y + 1.4}L${x} ${y + 4.5}L${x - 1.4} ${y + 1.4}L${x - 4.5} ${y}L${x - 1.4} ${y - 1.4}Z` })
          : p.kind === "before" ? S("path", { class: "hist-glyph line", d: `M${x + 3.5} ${y + 2}A4 4 0 1 0 ${x - 3.5} ${y + 2}M${x - 3.5} ${y + 2}l-1.5 -3M${x - 3.5} ${y + 2}l3 -1` })
          : p.kind === "merge" ? S("path", { class: "hist-glyph line", d: `M${x - 4} ${y - 4}L${x} ${y}L${x + 4} ${y - 4}M${x} ${y}V${y + 4.5}` })
          : p.kind === "import" ? S("path", { class: "hist-glyph line", d: `M${x} ${y - 4.5}V${y + 2}M${x - 3} ${y - 1}L${x} ${y + 2}L${x + 3} ${y - 1}M${x - 4} ${y + 4.5}H${x + 4}` }) : null,
        r.head ? tag(r.branch, tx, Y(r.pillY), "start", true) : null,      // the name of the branch, once, at the head of its run of rows
        ...r.lines.map((line, i) => S("text", { class: "hist-label", x: i ? tx + idw : tx, y: Y(r.lineY[i]) }, i ? null : S("tspan", { class: "hist-id" }, `${p.id}  `), line,
          here && i === r.lines.length - 1 ? S("tspan", { class: "hist-here" }, "  ◀ vous êtes ici") : null)),
        S("text", { class: "hist-sub", x: tx, y: Y(r.subY) }, r.sub.join(" · ")));
      nodes.append(g); order.push(p.id); places.set(p.id, { top: Y(r.top), h: r.h });
    }
    const now = T.rows.find((r) => r.now);
    if (now) {      // what changed since « ici », kept by no point yet — in the lane the next point goes into
      const lane = lanes.find((l) => l.name === next) || (head ? { col: head.col } : { col: T.main }), y = Y(now.dotY), x = X(lane.col);
      if (head) curve(head, { col: lane.col, dotY: now.dotY }, "hist-edge pending", null);
      nodes.append(S("g", { class: "hist-node now", "data-history-now": "" }, S("circle", { class: "hist-dot now", cx: x, cy: y, r: R }),
        S("text", { class: "hist-label", x: tx, y: Y(now.lineY[0]) }, `Maintenant — ${pending} artéfact${pending > 1 ? "s ont" : " a"} changé depuis le point « ici »`),
        S("text", { class: "hist-sub", x: tx, y: Y(now.subY) }, `Aucun point ne les garde encore ; le prochain ira dans ${next === MAIN ? "MAIN" : `« ${next} »`}${fresh ? " (nouvelle branche)" : ""}`)));
    }
    view.setBox(box.w, box.h);
  }
  return { draw, focus, fit: view.fit, destroy: () => { seg.remove(); view.destroy(); } };
}
