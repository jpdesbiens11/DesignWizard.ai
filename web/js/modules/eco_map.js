/* DynamiteOrbit.ai — Écosystème : the MAP of what depends on what. Four columns, in the order a product is built : the assemblies, the parts
   (grouped by the way they are made, a colour per group), the boards and the software, the analyses and the load cases. A link is a curve in the
   colour of its kind ; links between parts of the same column (a shared interface key, a mate) bow out on the right, as an arc diagram draws
   them. The artefact handed to the AI is ringed ; what it disturbs when it changes is outlined in amber, with how many steps away ; the rest
   fades. A node is a button : a click or Entrée makes it the artefact handed over. The page pans and zooms (modules/svg_view.js). */

import { svgView } from "./svg_view.js";
import { EDGE_KINDS, NODE_KINDS, ecoImpact } from "../core/eco.js";

const NS = "http://www.w3.org/2000/svg", W = 230, H = 42, GAP = 12, COLX = [20, 330, 640, 950], TOP = 46;
const COL = { assembly: 0, part: 1, board: 2, software: 2, analysis: 3, case: 3 };
const HEAD = ["Assemblages", "Pièces", "Cartes et logiciel", "Calculs et cas"];
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const cut = (s, n) => (String(s || "").length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ""));

/** host : the box ; o : { onPick(key) } → { draw(map, target, show), destroy() } — show : the kinds of link drawn ({ kind: true }) */
export function ecoMapView(host, o = {}) {
  const view = svgView(host, { cls: "eco-map", label: "La carte des dépendances", data: "data-eco-map", fitTip: "Ajuster à la fenêtre : toute la carte se voit", grab: "[data-eco-node]", maxFit: 1.1 }), svg = view.svg;
  function draw(map, target, show = {}) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const cols = [[], [], [], []];
    for (const n of map.nodes) cols[COL[n.kind] ?? 3].push(n);
    cols[1].sort((a, b) => String(a.nature).localeCompare(String(b.nature)) || a.id.localeCompare(b.id));
    const used = cols.map((c, i) => (c.length ? i : -1)).filter((i) => i >= 0), X = (i) => COLX[Math.max(0, used.indexOf(i))];      // an empty column takes no room
    const at = new Map(); cols.forEach((c, i) => c.forEach((n, j) => at.set(n.key, { x: X(i), y: TOP + j * (H + GAP), col: i })));
    const rows = Math.max(1, ...cols.map((c) => c.length)), box = { w: COLX[Math.max(0, used.length - 1)] + W + 60, h: TOP + rows * (H + GAP) + 20 };
    const impact = target && target !== "project" ? new Map(ecoImpact(map, target).map((x) => [x.key, x])) : null;
    const lit = (k) => !impact || k === target || impact.has(k);
    svg.append(S("rect", { class: "eco-back", x: -5000, y: -5000, width: box.w + 10000, height: box.h + 10000 }));
    for (const i of used) svg.append(S("text", { class: "eco-head", x: X(i), y: TOP - 18 }, `${HEAD[i]} (${cols[i].length})`));
    const edges = S("g", { class: "eco-edges" }); svg.append(edges);
    for (const e of map.edges) {
      if (show[e.kind] === false) continue;
      const a = at.get(e.from), b = at.get(e.to); if (!a || !b) continue;
      const K = EDGE_KINDS[e.kind] || { color: "#64748b" }, on = lit(e.from) && lit(e.to);
      let d;
      if (a.col === b.col) { const x = a.x + W, y1 = a.y + H / 2, y2 = b.y + H / 2, bow = 26 + Math.min(120, Math.abs(y2 - y1) * 0.35); d = `M${x} ${y1}C${x + bow} ${y1} ${x + bow} ${y2} ${x} ${y2}`; }
      else { const [l, r] = a.x < b.x ? [a, b] : [b, a], x1 = l.x + W, y1 = l.y + H / 2, x2 = r.x, y2 = r.y + H / 2, mid = (x1 + x2) / 2; d = `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`; }
      edges.append(S("path", { d, stroke: K.color, class: `eco-edge ${e.kind}${on ? "" : " faded"}` }, S("title", null, `${e.from} ${K.fr} ${e.to}${e.label ? ` (${e.label})` : ""}`)));
    }
    const nodes = S("g", { class: "eco-nodes" }); svg.append(nodes);
    for (const n of map.nodes) {
      const p = at.get(n.key), me = n.key === target, hit = impact && impact.get(n.key), kind = NODE_KINDS[n.kind] || { fr: n.kind };
      nodes.append(S("g", { class: `eco-node${me ? " target" : ""}${hit ? " hit" : ""}${lit(n.key) ? "" : " faded"}`, tabindex: "0", role: "button", "data-eco-node": n.key, "aria-pressed": me ? "true" : "false",
        "aria-label": `${kind.fr} ${n.id}${n.name ? ` — ${n.name}` : ""}${me ? " — confié à l'IA" : hit ? ` — dérangé si l'artéfact confié change (${hit.depth} pas)` : ""}`,
        onClick: () => o.onPick && o.onPick(n.key), onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.onPick && o.onPick(n.key); } } },
        S("rect", { class: "eco-box", x: p.x, y: p.y, width: W, height: H, rx: 7 }),
        S("rect", { x: p.x, y: p.y, width: 6, height: H, rx: 3, fill: n.color || "#64748b" }),
        S("text", { class: "eco-id", x: p.x + 14, y: p.y + 17 }, cut(n.id, 26)),
        S("text", { class: "eco-sub", x: p.x + 14, y: p.y + 33 }, cut(`${n.nature ? `${n.nature} · ` : ""}${n.name}`, 38)),
        hit ? S("text", { class: "eco-depth", x: p.x + W - 8, y: p.y + 17, "text-anchor": "end" }, `${hit.depth}`) : null));
    }
    view.setBox(box.w, box.h);
  }
  return { draw, fit: view.fit, destroy: view.destroy };
}
