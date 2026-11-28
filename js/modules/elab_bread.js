/* DynamiteOrbit.ai — Labo, the breadboard DRAWN beside the board (pcba/lab_breadboard.js gives where everything goes ; nothing is
   decided here). A breadboard as the prototyping tools draw it : a pale body, rows of five holes tied by their metal strip, the
   ground row dark ; on each row, at its left, the tag of the point of the board it comes from (reference . pin · signal) ; the
   jumper from the pad of the board to the first hole of its row, a dot soldered on the pad ; the leads of the instruments in the
   next holes — each a dot in the colour of its lead, with its letter — and their tags (« Alim. + », « Osc. S ») at the end of the
   row. The leads are the marks the cords of the bench look for (.lab-mark[data-gear] .lab-mark-dot, modules/elab_bench.js) : the
   cords of the instruments come down to the holes by themselves. Drawn in the coordinates of the view (y down), in millimetres. */

import { svg } from "../core/dom.js";

const P = (q) => `${q[0]},${-q[1]}`;

/** Draws the layout L (breadLayout) into g, the layer of the marks of the board view. */
export function drawBread(g, L) {
  if (!L || !L.rows.length) return;
  const h = L.hole, f = L.font, [x0, y0, x1, y1] = L.box, root = svg("g", { class: "lab-bb", "data-bread": "" });
  root.append(svg("rect", { x: x0, y: -y1, width: x1 - x0, height: y1 - y0, rx: L.pitch * 0.3, class: "lab-bb-body", "stroke-width": f * 0.12 }),
    svg("text", { x: x0 + L.pitch * 0.35, y: -y1 + f * 1.45, "font-size": f * 1.05, class: "lab-bb-title" }, L.title));
  /* the rows : their strip, their holes, the tag of the point of the board */
  for (const r of L.rows) { const y = -r.y, a = r.holes[0][0], b = r.holes[r.holes.length - 1][0];
    root.append(svg("line", { x1: a - h * 0.42, y1: y, x2: b + h * 0.42, y2: y, class: `lab-bb-strip${r.ground ? " ground" : ""}`, "stroke-width": h * 0.74 }));
    for (const q of r.holes) root.append(svg("rect", { x: q[0] - h * 0.16, y: y - h * 0.16, width: h * 0.32, height: h * 0.32, class: "lab-bb-hole" }));
    root.append(svg("text", { x: L.cols.tag, y: y - f * 0.66, "font-size": f, class: "lab-bb-tag", "data-row": r.key }, svg("tspan", { class: "ref" }, r.key), r.signal ? svg("tspan", { class: "sig" }, ` · ${r.signal}`) : null)); }
  /* the jumpers : from the pad to the first hole of the row, over the board, each in its own lane */
  for (const j of L.jumpers) { const pts = j.pts.map(P).join(" ");
    root.append(svg("polyline", { points: pts, class: "lab-bb-wire-halo", "stroke-width": f * 0.5 }), svg("polyline", { points: pts, class: "lab-bb-wire", stroke: j.color, "stroke-width": f * 0.24, "data-wire": j.key }),
      svg("circle", { cx: j.pts[0][0], cy: -j.pts[0][1], r: f * 0.34, fill: j.color, class: "lab-bb-solder" }), svg("circle", { cx: j.pts[0][0], cy: -j.pts[0][1], r: f * 0.75, stroke: j.color, "stroke-width": f * 0.14, class: "lab-mark-ring" }),
      svg("circle", { cx: j.pts[j.pts.length - 1][0], cy: -j.pts[j.pts.length - 1][1], r: h * 0.26, fill: j.color, class: "lab-bb-plug" })); }
  /* the leads of the instruments, in the holes of their row, and their tags at its end */
  for (const r of L.rows) {
    for (const l of r.leads) { const x = l.hole[0], y = -l.hole[1];
      root.append(svg("g", { class: "lab-mark lab-bb-lead", "data-mark": `${l.ref}.${l.pin}`, "data-lead": l.lead, "data-gear": l.gear, ...(l.role ? { "data-role": l.role } : {}), ...(l.movable ? { "data-movable": "" } : {}) }, svg("circle", { cx: x, cy: y, r: h * 0.44, fill: l.color, class: "lab-mark-dot", "stroke-width": f * 0.1 }),
        svg("text", { x, y: y + f * 0.3, "text-anchor": "middle", "font-size": f * 0.82, class: "lab-mark-letter" }, l.label))); }
    const tags = svg("text", { x: L.cols.gear, y: -r.y + f * 0.34, "font-size": f * 0.92, class: "lab-bb-gear" });
    r.leads.forEach((l, i) => tags.append(svg("tspan", { fill: l.color === "#111827" ? "#1f2937" : l.color, "data-gear": l.gear }, `${i ? "  " : ""}${l.tag}`))); root.append(tags); }
  g.append(root);
}
