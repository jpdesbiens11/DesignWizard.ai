/* DesignWizard.ai — flat pattern of a folded sheet-metal part, as a DXF the laser and the press brake both read.
   Layers : CUT (outline, holes, cut-outs — what the laser cuts), BEND (bend lines, centre linetype — never cut),
   NOTES (direction, angle and inside radius of each bend ; thickness, k factor and bend allowance of the whole sheet).
   The bend allowance comes from a typical k factor : the note says so, the shop corrects it for its tooling. */
import { DxfDoc } from "./dxf.js";
import { flatHoles, flatPoint } from "../cad/family_folded.js";
import { normalizeProfile, flattenLoop } from "../cad/profile.js";

const n3 = (x) => String(Math.round(x * 1000) / 1000);

/** Through cut-outs of the evaluated features, as closed polylines on the flat : { loops: [[[x, y]…]], lost: [ids in a bend] }. */
export function flatCutouts(F, features) {
  const loops = [], lost = [];
  for (const [i, f] of (features || []).entries()) {
    if (!f || f.suppressed || f.op !== "pocket") continue;
    const through = f.depth === "through" || f.depth === "traversant" || (typeof f.depth === "number" && f.depth >= F.t - 1e-6); if (!through) continue;
    const def = f.profile || (f.rect ? { rect: f.rect, r: f.r } : f.circle ? { circle: f.circle } : f.slot ? { slot: f.slot } : null); if (!def) continue;
    let P; try { P = normalizeProfile(def); } catch (e) { continue; }
    const face = String(f.face || "+Z"), pts = flattenLoop(P.outer, 0.02).map((p) => flatPoint(F, face, p));
    if (pts.some((p) => !p)) lost.push(f.id || `f${i + 1}`); else loops.push(pts);
  }
  return { loops, lost };
}

/** @param built  the built part (facts.folded, facts.holes)   @param features  the evaluated features of the spec (cut-outs)
    @returns { text, warnings: [French] } */
export function foldedDxf(built, features = []) {
  const F = built && built.facts && built.facts.folded;
  if (!F) throw new Error("DXF du développé : cette pièce n'a pas de bloc « folded » (tôle pliée).");
  const flat = F.flat, H = flatHoles(F, built.facts.holes), C = flatCutouts(F, features), label = [built.id, built.name].filter(Boolean).join(" ");
  const doc = new DxfDoc({ comment: `DesignWizard.ai - flat pattern${label ? " of " + label : ""} - thickness ${n3(F.t)} mm - inside radius ${n3(F.r)} mm - k ${n3(F.k)} (typical) - 1:1, units: millimetres` });
  doc.layer("CUT", 1, "CONTINUOUS"); doc.layer("BEND", 5, "CENTER"); doc.layer("NOTES", 8, "CONTINUOUS");
  doc.polyline(flat.outline, "CUT", true);
  for (const h of H.list) doc.circle(h.x, h.y, h.d / 2, "CUT");
  for (const lp of C.loops) doc.polyline(lp, "CUT", true);
  const th = Math.max(1.5, Math.min(3.5, Math.min(...flat.size) / 40));
  for (const b of flat.bends) {
    doc.line(b.a[0], b.a[1], b.b[0], b.b[1], "BEND");
    const mx = (b.a[0] + b.b[0]) / 2, my = (b.a[1] + b.b[1]) / 2;
    doc.text(mx + th * 0.4, my + th * 0.4, th, `PLI ${b.angle} ${b.dir === "up" ? "VERS LE HAUT" : "VERS LE BAS"} R${n3(b.r)}`, "NOTES");
  }
  const x0 = flat.min[0], y0 = flat.min[1] - 3 * th;
  doc.text(x0, y0, th, `DEVELOPPE ${n3(flat.size[0])} x ${n3(flat.size[1])} mm - TOLE ${n3(F.t)} mm - ${flat.bends.length} PLI(S) A 90`, "NOTES");
  doc.text(x0, y0 - 1.6 * th, th, `LONGUEUR DEVELOPPEE D'UN PLI ${n3(F.ba)} mm (FACTEUR K ${n3(F.k)}, VALEUR TYPIQUE : A CORRIGER PAR L'ATELIER)`, "NOTES");
  doc.text(x0, y0 - 3.2 * th, th, "FACE VUE : DESSUS DE LA BASE (+Z) - LIGNES BEND : NE PAS COUPER", "NOTES");
  const warnings = [];
  if (H.lost.length) warnings.push(`Trou(s) dans un pli, absents du développé : ${H.lost.join(", ")}. Les éloigner du pli ou les percer après pliage.`);
  if (C.lost.length) warnings.push(`Découpe(s) qui touchent un pli, absentes du développé : ${C.lost.join(", ")}.`);
  return { text: doc.toString(), warnings };
}
