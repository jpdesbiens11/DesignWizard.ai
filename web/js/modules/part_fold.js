/* DynamiteOrbit — the « Développé » tab of a folded sheet-metal part : the blank before the press brake. It draws the
   flat pattern computed by cad/family_folded.js — the outline and the holes the laser cuts, the bend lines it must not
   cut — gives the figures of the fold (thickness, inside radius, developed length of a bend, k factor) and each folded
   edge, and hands the DXF. The developed length uses a typical k factor : the panel says so, the shop corrects it. */

import { el, svg, btn, badge, download, toast } from "../core/dom.js";
import { flatHoles } from "../cad/family_folded.js";
import { makeArtifact } from "../core/artifacts.js";

const n = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("fr-CA");
export const BEND_COLOR = "#2563eb";
export const isFolded = (spec) => !!(spec && spec.folded);

/** The flat pattern as an SVG drawing (y up, as on the part). F = facts.folded, holes = facts.holes. */
export function flatSvg(F, holes) {
  const flat = F.flat, pad = Math.max(4, Math.max(...flat.size) * 0.06), [x0, y0] = flat.min, [w, h] = flat.size, H = flatHoles(F, holes);
  const Y = (y) => y0 + h - (y - y0), pts = flat.outline.map(([x, y]) => `${x},${Y(y)}`).join(" "), sw = Math.max(w, h) / 260;
  const root = svg("svg", { viewBox: `${x0 - pad} ${y0 - pad} ${w + 2 * pad} ${h + 2 * pad}`, class: "fold-flat", role: "img", "aria-label": `Développé de ${n(w, 1)} × ${n(h, 1)} mm, ${flat.bends.length} ligne(s) de pliage` });
  root.append(svg("polygon", { points: pts, fill: "var(--surface-2)", stroke: "var(--ink)", "stroke-width": sw * 1.4, "stroke-linejoin": "round" }));
  for (const c of H.list) root.append(svg("circle", { cx: c.x, cy: Y(c.y), r: c.d / 2, fill: "var(--surface)", stroke: "var(--ink)", "stroke-width": sw }));
  for (const b of flat.bends) root.append(svg("line", { x1: b.a[0], y1: Y(b.a[1]), x2: b.b[0], y2: Y(b.b[1]), stroke: BEND_COLOR, "stroke-width": sw * 1.2, "stroke-dasharray": `${sw * 7} ${sw * 3} ${sw * 1.5} ${sw * 3}` }));
  return { node: root, lost: H.lost };
}

export function foldPanel(body, ctx) {
  const { st } = ctx, F = st.built && st.built.facts && st.built.facts.folded;
  if (!F) { body.append(el("p", { class: "muted" }, st.built ? "Le bloc « folded » de cette pièce ne se construit pas : voir le journal de la pièce." : "La pièce se construit…")); return; }
  const d = flatSvg(F, st.built.facts.holes), key = (color, dash) => { const s = el("span", { class: "fold-key" + (dash ? " dash" : ""), "aria-hidden": "true" }); s.style.borderColor = color; return s; };
  body.append(el("div", { class: "fold-box" }, d.node),
    el("p", { class: "small", style: { margin: ".4rem 0" } }, key("var(--ink)"), " ce que le laser coupe   ", key(BEND_COLOR, true), " lignes de pliage : jamais coupées"),
    el("div", { class: "atelier-chips" }, el("span", { class: "chip" }, `Flan ${n(F.flat.size[0], 1)} × ${n(F.flat.size[1], 1)} mm`), el("span", { class: "chip" }, `Tôle ${n(F.t)} mm`), el("span", { class: "chip" }, `Rayon intérieur ${n(F.r)} mm`),
      el("span", { class: "chip", "data-tip": "Longueur de la fibre neutre dans un pli à 90° : π/2 × (R + k × t)" }, `Pli développé ${n(F.ba, 3)} mm`), el("span", { class: "chip", "data-tip": "Position de la fibre neutre dans l'épaisseur. Valeur typique : l'atelier a la sienne" }, `Facteur k ${n(F.k)}`),
      ...(F.corners ? [el("span", { class: "chip" }, `${F.corners} dégagement${F.corners > 1 ? "s" : ""} d'angle de ${n(F.relief)} mm`)] : [])),
    el("ul", { class: "decisions" }, F.flanges.map((f) => el("li", null, `Bord ${f.fr} : plié à 90° vers le ${f.dir === "up" ? "haut" : "bas"}, haut de ${n(f.h)} mm, ligne de pliage de ${n(f.to - f.from)} mm — ${n(f.flat, 3)} mm au développé.`))),
    ...(d.lost.length ? [el("p", { class: "atelier-hint warn" }, badge("À corriger", "warn"), ` Trou(s) dans un pli, absents du développé : ${d.lost.join(", ")}.`)] : []),
    el("p", { class: "muted small" }, "Développé indicatif : le facteur k de 0,44 est une valeur de départ courante, pas celle de votre atelier. Il corrige le flan avec sa table de pliage ; les lignes de pliage du DXF sont sur leur propre calque (BEND)."),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("DXF du développé", async () => { try { const f = await makeArtifact(st.spec.id, "unfold"); download(f.name, f.bytes, f.mime); for (const w of f.warnings) toast(w, "info", 6000); } catch (e) { toast(e.message, "error"); } },
      { icon: "download", tip: "Contour et perçages sur le calque CUT, lignes de pliage sur le calque BEND, sens et rayon de chaque pli en notes" })));
}
