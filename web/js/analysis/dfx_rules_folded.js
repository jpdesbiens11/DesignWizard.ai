/* DynamiteOrbit.ai — rules of a folded sheet-metal part (spec.folded) : measured on what the block declares — the inside
   radius, the height of each folded edge, the corner reliefs — and on the holes of the built part, told apart as near a
   bend or near a free edge. Called by the sheet-metal check when the part carries the block ; the limits are the ones of
   the sheet rule book (SM-01, SM-02, SM-03, SM-04, SM-07), typical values of published design guides. */
import { num, round, groupBy } from "./dfx_core.js";
import { holeToBend, holeToEdge } from "../cad/family_folded.js";

const at = (path, value) => ({ target: "spec", id: null, path, value });
const holeLabel = (g) => `Trou Ø${num(g[0].d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${g[0].source} »`;

export function checkFolded(ctx, T) {
  const F = T.folded, t = F.t, kMin = (ctx.mat && ctx.mat.rMinT) || 1, rMin = round(kMin * t, 3), mat = ctx.spec.material || "la matière";
  ctx.run("SM-01", () => {
    if (F.r >= rMin - 1e-6) return;
    ctx.add("SM-01", { value: round(F.r, 3), limit: rMin, unit: "mm", feature: "folded",
      message: `Rayon intérieur de pliage de ${num(F.r)} mm sur une tôle de ${num(t)} mm : sous le minimum de ${num(kMin)} × t = ${num(rMin)} mm pour ${mat}, les fibres extérieures fissurent. Correctif : porter le rayon à ${num(rMin)} mm.`,
      fix: ctx.fix(`Rayon de pliage à ${num(rMin)} mm`, at("folded.r", rMin)) });
  });
  ctx.run("SM-02", () => {
    const lim = round(4 * t, 3);
    for (const f of F.flanges) if (f.h < lim - 1e-6) ctx.add("SM-02", { value: round(f.h), limit: lim, unit: "mm", feature: f.id,
      message: `Bord plié ${f.fr} haut de ${num(f.h)} mm pour une tôle de ${num(t)} mm : la matrice de la presse plieuse ne peut pas le tenir. Limite : ≥ 4 × t = ${num(lim)} mm. Correctif : porter la hauteur à ${num(lim)} mm, ou réduire l'épaisseur.`,
      fix: ctx.fix(`Bord ${f.fr} à ${num(lim)} mm`, at(`folded.flanges.${f.index}.h`, lim)) });
  });
  ctx.run("SM-07", () => {
    const lim = round(Math.max(F.r, rMin) + t + 0.5, 3);            // with the radius the sheet asks for : one pass of fixes is enough
    if (F.corners > 0 && F.relief < lim - 1e-6) ctx.add("SM-07", { value: round(F.relief, 3), limit: lim, unit: "mm", feature: "folded",
      message: `${F.corners} angle(s) où deux bords pliés se rejoignent, dégagés de ${num(F.relief)} mm : sous R + t + 0,5 = ${num(lim)} mm l'angle se déchire ou gonfle au pliage. Correctif : porter le dégagement à ${num(lim)} mm.`,
      fix: ctx.fix(`Dégagement d'angle à ${num(lim)} mm`, at("folded.relief", lim)) });
  });
  const groups = groupBy(ctx.facts.holes.filter((h) => h.at && h.axis && h.d > 0), (h) => `${h.source}|${h.d}`);
  ctx.run("SM-03", () => {
    const lim = round(2.5 * t + F.r, 3);
    for (const g of groups) {
      let worst = null; for (const h of g) { const b = holeToBend(F, h); if (b && (!worst || b.gap < worst.gap)) worst = { ...b, h }; }
      if (!worst || worst.gap >= lim - 1e-6) continue;
      const side = (F.flanges.find((f) => f.side === worst.side) || {}).fr || worst.side;
      ctx.add("SM-03", { value: round(worst.gap), limit: lim, unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
        message: worst.gap < 0 ? `${holeLabel(g)} dans le pli ${side} : il se déforme au pliage et n'est pas reporté au développé. Limite : bord du trou à ${num(lim)} mm du pli (2,5 × t + R). Correctif : l'éloigner du pli de ${num(lim - worst.gap)} mm, ou le percer après pliage.`
          : `${holeLabel(g)} à ${num(worst.gap)} mm du pli ${side} (bord du trou à la ligne de pli). Limite : ≥ 2,5 × t + R = ${num(lim)} mm, sinon le trou s'ovalise. Correctif : l'éloigner du pli de ${num(lim - worst.gap)} mm, ou le percer après pliage.` });
    }
  });
  ctx.run("SM-04", () => {
    const lim = round(2 * t, 3);
    for (const g of groups) {
      let worst = null; for (const h of g) { const gap = holeToEdge(F, h); if (gap !== null && (!worst || gap < worst.gap)) worst = { gap, h }; }
      if (!worst || worst.gap >= lim - 1e-6) continue;
      ctx.add("SM-04", { value: round(worst.gap), limit: lim, unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
        message: `${holeLabel(g)} à ${num(worst.gap)} mm du bord libre de la tôle (bord du trou). Limite : ≥ 2 × t = ${num(lim)} mm. Correctif : éloigner le trou du bord de ${num(lim - worst.gap)} mm.` });
    }
  });
}
