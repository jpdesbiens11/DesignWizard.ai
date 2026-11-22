/* DesignOrbit.ai — Assemblage : a mate, shown. When a joint is chosen, the view shows what it is made of — every screw with
   its head, its insert or its nut, every dowel pin, the shaft of a fit, the outline of the contact area — inside its two
   parts made see-through, with the frame of the interface ; its card shows the joint in section and the facts that
   define it, side A and side B. One code for every kind of interface : core/mate_view.js. */

import { el, svg, table, badge } from "../core/dom.js";
import { cylMesh } from "../analysis/physics/scene3d.js";
import { mateSolids, mateSection, MATE_COLORS } from "../core/mate_view.js";

const faded = new WeakMap();           // viewer → the objects made see-through for the mate on show, with the opacity they had
/** Takes the mate off the view : its hardware, its outline, and gives the parts their own look back. */
export function clearMate(viewer) {
  for (const k of [...viewer.objects.keys()]) if (k.startsWith("matehw/")) viewer.remove(k);
  viewer.clearOverlays("matedef");
  for (const [id, op] of faded.get(viewer) || []) if (viewer.objects.has(id)) viewer.setOpacity(id, op);
  faded.delete(viewer);
}
/** Shows a mate in the view. def : mateDefinition(…). */
export function showMate(viewer, def) {
  clearMate(viewer); if (!def) return;
  const was = []; for (const [id, o] of viewer.objects) if (id.startsWith(`${def.A.inst}/`) || id.startsWith(`${def.B.inst}/`)) { was.push([id, o.opacity ?? 1]); viewer.setOpacity(id, Math.min(o.opacity ?? 1, 0.32)); }
  faded.set(viewer, was);
  mateSolids(def).forEach((s, k) => { if (s.shape === "cyl") viewer.add({ id: `matehw/${k}`, name: s.what, mesh: cylMesh(s.a, s.b, s.r, 20), color: s.color, pickable: false }); else viewer.addPath(s.pts, s.color, "matedef", 0.7); });
  viewer.addFrame(def.frame, MATE_COLORS.A, "matedef");
  viewer.addLabel(def.frame.o, `${def.id} — ${def.label}`, "matedef", "iface");
}
/** The cross-section of a mate, drawn from its primitives. */
export function sectionNode(sec) {
  const kids = sec.items.map((p) => (p.t === "rect" ? svg("rect", { x: p.x, y: p.y, width: p.w, height: p.h, fill: p.fill, stroke: p.stroke === "none" ? "none" : p.stroke, "stroke-width": 1 })
    : p.t === "line" ? svg("line", { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, stroke: p.stroke, "stroke-width": p.width || 1 })
      : p.t === "poly" ? svg("polygon", { points: p.pts.map((q) => q.join(",")).join(" "), fill: p.fill, stroke: p.stroke, "stroke-width": 1 })
        : (() => { const t = svg("text", { x: p.x, y: p.y, "font-size": p.size, "text-anchor": p.anchor, fill: p.fill, "font-weight": p.weight || 400, "font-family": "inherit" }); t.textContent = p.s; return t; })()));
  return svg("svg", { viewBox: `0 0 ${sec.w} ${sec.h}`, class: "mate-sec", role: "img", "aria-label": "Coupe schématique du joint" }, ...kids);
}
/** What the card of a chosen mate adds : the section, the two sides, the facts. */
export function mateDetail(def) {
  if (!def) return null;
  return el("div", { class: "mate-def", "data-mate-def": def.id },
    sectionNode(mateSection(def)),
    el("p", { class: "small", style: { margin: ".3rem 0 .2rem" } }, badge("A", "info"), ` ${def.A.name} — ${def.A.title} (${def.A.iface}) `, badge("B", "ok"), ` ${def.B.name} — ${def.B.title} (${def.B.iface})`),
    table(["", ""], def.facts.map(([k, v]) => [el("b", null, k), v]), "mate-facts"),
    el("p", { class: "muted small", style: { margin: ".25rem 0 0" } }, "Coupe schématique : les valeurs écrites sont celles du joint, pas les proportions. Dans la vue : les deux pièces en transparence, la visserie et les goupilles à leur place."));
}
