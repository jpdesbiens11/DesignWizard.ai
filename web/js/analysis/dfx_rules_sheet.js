/* DynamiteOrbit.ai — DFM rules: sheet metal (laser cut + press brake) and flat cut plates (laser / waterjet / router),
   carried over from the user's rule book (SM-, MAT-, PL-, LAM- rules). A part with a « folded » block declares its bends :
   radius, edge heights, corner reliefs and holes near a bend are measured (dfx_rules_folded.js). Without the block, a
   shelled part is read as a folded tray (walls = flanges, shell t = sheet thickness) and the bend rules stay reminders
   (info) ; a part without shell is a flat blank whose thickness is its smallest dimension. */

import { SHEET_GAUGES } from "../cad/standards.js";
import { FACES } from "../cad/vec.js";
import { rule, num, round, groupBy } from "./dfx_core.js";
import { laserProfile, sheetSeries } from "../cad/special_processes.js";
import { checkFolded } from "./dfx_rules_folded.js";

const S = {
  sm: "Guides DFM de tôlerie (Protolabs, Xometry — sheet metal design guide), connus par résumés : à confirmer avec le tôlier", thumb: "Règle de pouce (rule of thumb), à confirmer avec le fournisseur",
  stock: "Liste des épaisseurs en stock (standards.js — SHEET_GAUGES)", comp: "Pratique composites — joints boulonnés, à confirmer avec les admissibles", router: "Pratique CNC router",
};
const R = {
  sm01: rule("SM-01", "Pli pas trop serré", "Rayon intérieur de pliage ≥ minimum matière (1 × t pour Al 5052-H32, cuivre, acier)", "warn", "Un pli trop serré fissure les fibres extérieures.", S.sm, { fix: true }),
  sm02: rule("SM-02", "Bord plié assez long", "Longueur extérieure du bord plié (flange) ≥ 4 × t", "error", "La matrice de la presse plieuse doit pouvoir tenir le bord.", `${S.sm} (Protolabs : 2,5 à 4 × t + R)`),
  sm03: rule("SM-03", "Trous loin des plis", "Bord du trou au pli ≥ 2,5 × t + R", "warn", "Un trou près d'un pli s'ovalise.", S.sm),
  sm04: rule("SM-04", "Trous loin des bords", "Bord du trou au bord de la pièce ≥ 2 × t", "warn", "Un pont de matière trop mince se déchire ou gonfle.", S.sm),
  sm05: rule("SM-05", "Matière entre les trous", "Voile entre deux trous ≥ 2 × t", "warn", "Un voile mince se déforme à la découpe ou au poinçonnage.", S.sm),
  sm06: rule("SM-06", "Trous pas trop petits", "Ø du trou ≥ t (poinçonnage) ; plus petit : laser seulement", "warn", "Un poinçon casse sous l'épaisseur de la tôle ; le laser perce mal un trou plus petit que t.", S.thumb),
  sm07: rule("SM-07", "Dégagements d'angle", "Dégagements carrés là où deux bords pliés se rejoignent (R + t + 0,5)", "warn", "Sans dégagement (corner relief) l'angle se déchire.", S.sm, { fix: true }),
  sm08: rule("SM-08", "Largeur des découpes", "Largeur d'une fente ou découpe ≥ t", "warn", "Une fente plus étroite que la tôle ne se découpe pas proprement.", S.thumb),
  mat01: rule("MAT-01", "Épaisseur en stock", "Épaisseur dans la liste standard (0,5 · 0,8 · 1 · 1,2 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 mm)", "warn", "Épaisseur spéciale : coût et délai.", S.stock, { fix: true }),
  pl01: rule("PL-01", "Pliage des plastiques", "Une plaque plastique ne se plie qu'à chaud", "warn", "Le pliage à froid fissure ou revient (spring back).", "Pratique fournisseur"),
  lam01: rule("LAM-01", "Stratifié : pas de pliage", "Un stratifié (FR4, carbone, verre) ne se plie pas", "error", "Les fibres cassent.", "Pratique composites", { fix: true }),
  lam02: rule("LAM-02", "Stratifié : distance au bord", "Axe du trou au bord ≥ 3 × D", "warn", "Rupture en matage / cisaillement au bord (bearing, shear-out).", S.comp),
  lam03: rule("LAM-03", "Stratifié : pas entre trous", "Entraxe ≥ 4 × D", "warn", "Rupture de section nette entre les trous.", S.comp),
  lam04: rule("LAM-04", "Rayon de fraise (router)", "Hors de portée du laser : angles intérieurs ≥ R1,5 (fraise Ø3)", "warn", "La fraise du router ne fait pas d'angle vif intérieur.", S.router, { fix: true }),
  lc01: rule("LC-01", "Découpe traversante seulement", "Pas de pocket ni de trou borgne, pas de lamage sur une plaque découpée", "warn", "Le laser et le jet d'eau coupent toute l'épaisseur : tout usinage borgne est une reprise.", S.thumb),
  lc02: rule("LC-02", "Pièce plate, épaisseur découpable", "Plaque plane ; épaisseur dans la plage du laser pour la matière (LAS-02), 25 mm au plus pour une matière sans fiche", "warn", "Au-delà, la coupe est conique et lente.", S.thumb),
};
const STEPS_SM = ["Choisir d'abord la tôle et l'épaisseur en stock", "Un seul rayon intérieur pour tous les plis (un outil)", "Les plis d'abord, les trous ensuite : trous loin des plis", "Vérifier le développé et les lignes de pliage (DXF)"];
const STEPS_PL = ["Matière et épaisseur en stock", "Contour et rayon d'angle", "Trous cotés depuis un angle, motifs pour les rangées", "Découpes avec rayon intérieur", "Stratifiés : jamais de pli, trous loin des bords et les uns des autres"];

export const BOOK_SHEET = [
  { process: "sheet_metal", category: "DFM", steps: STEPS_SM, rules: [R.sm01, R.sm02, R.sm03, R.sm04, R.sm05, R.sm06, R.sm07, R.sm08, R.mat01, R.pl01, R.lam01] },
  { process: "laser_cut", category: "DFM", steps: STEPS_PL, rules: [R.sm04, R.sm05, R.sm06, R.sm08, R.mat01, R.lc01, R.lc02, R.pl01, R.lam01, R.lam02, R.lam03, R.lam04] },
];

const isLaminate = (ctx) => (ctx.mat && ctx.mat.cls === "pcb") || /FR-?4|G10|CFRP|GFRP|CARBON|LAMINATE/i.test(String(ctx.spec.material || ""));

/** Sheet thickness and where it comes from: {t, axis (thickness axis of a flat blank, -1 when folded), formed, patch}. */
export function sheetThickness(ctx) {
  const { facts, dims, spec } = ctx;
  if (spec.busbar && spec.busbar.t > 0) return { t: spec.busbar.t, axis: -1, formed: (spec.busbar.legs || []).length > 1, patch: () => null };      // a strip folded on its edge view : its thickness is the one it declares
  if (facts.folded) return { t: facts.folded.t, axis: -1, formed: true, folded: facts.folded, patch: (v) => ({ target: "spec", id: null, path: "folded.t", value: v }) };
  if (facts.shells.length) {
    const s = facts.shells.reduce((a, b) => (b.t < a.t ? b : a));
    return { t: s.t, axis: -1, formed: true, shell: s, patch: (v) => ctx.patch(s, "t", v) };
  }
  if (!dims) return null;
  const axis = dims.indexOf(Math.min(...dims)), t = dims[axis];
  const first = (spec.features || []).findIndex((f) => f && !f.suppressed && (f.op === "box" || f.op === "extrude") && (f.mode || "add") === "add");
  const f = first >= 0 ? spec.features[first] : null, id = f ? (f.id || `f${first + 1}`) : null, e = id ? ctx.efeature(id) : null;
  let patch = () => null;
  if (f && f.op === "box" && Array.isArray(f.size) && e && Math.abs(e.size[axis] - t) < 1e-6) patch = (v) => ({ target: "feature", id, path: `size.${axis}`, value: v });
  else if (f && f.op === "extrude" && e && { XY: 2, XZ: 1, YZ: 0 }[String(f.plane || "XY").toUpperCase()] === axis && Math.abs(Math.abs(e.length ?? e.h) - t) < 1e-6) patch = (v) => ({ target: "feature", id, path: f.length !== undefined ? "length" : "h", value: v });
  return { t, axis, formed: false, patch };
}
const nearestGauge = (t) => SHEET_GAUGES.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) - 1e-9 ? b : a));
const holeLabel = (g) => `Trou Ø${num(g[0].d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${g[0].source} »`;
const mainAxis = (v) => { let m = 0; for (let k = 1; k < 3; k++) if (Math.abs(v[k]) > Math.abs(v[m])) m = k; return m; };

/* Rules shared by folded sheet metal and flat plates. */
function common(ctx, T) {
  const { facts, bbox } = ctx, t = T.t, groups = groupBy(facts.holes, (h) => `${h.source}|${h.d}`);
  ctx.run("MAT-01", () => {
    const GAUGES = sheetSeries(ctx.spec.material);                // a paper, a film, a laminate are sold in their own thicknesses ; a metal in the gauges of the Shop
    if (GAUGES.some((g) => Math.abs(g - t) < 1e-6)) return;
    const to = GAUGES.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) - 1e-9 ? b : a)), big = t > GAUGES[GAUGES.length - 1] + 1e-6;
    ctx.add("MAT-01", { value: round(t, 3), limit: to, unit: "mm", feature: T.shell ? T.shell.source : null,
      message: `Épaisseur ${num(t, 3)} mm : hors de la liste en stock (${GAUGES.map((g) => num(g, 3)).join(" · ")} mm). ${big ? `Au-delà de ${num(GAUGES[GAUGES.length - 1])} mm, vérifier le stock de plaque du fournisseur. ` : ""}Correctif : passer à ${num(to, 3)} mm.`,
      fix: big ? null : ctx.fix(`Passer à ${num(to, 3)} mm (épaisseur en stock)`, T.patch(to)) });
  });
  ctx.run("SM-06", () => {
    for (const g of groups) {
      const h = g[0];
      if (!(h.d > 0) || h.d >= t - 1e-6) continue;
      ctx.add("SM-06", { value: h.d, limit: round(t, 3), unit: "mm", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)} plus petit que l'épaisseur de la tôle (${num(t)} mm). Limite : Ø ≥ t. Correctif : agrandir le trou à Ø${num(t)} ou plus, ou le percer en reprise.` });
    }
  });
  ctx.run("SM-08", () => {
    for (const p of facts.pockets) {
      const w = Math.min(p.w, p.h);
      if (w > 0 && w < t - 1e-6) ctx.add("SM-08", { value: round(w), limit: round(t, 3), unit: "mm", feature: p.source, iface: p.iface,
        message: `Découpe « ${p.source} » large de ${num(w)} mm, plus étroite que la tôle (${num(t)} mm). Limite : largeur ≥ t. Correctif : élargir la découpe à ${num(t)} mm ou plus.` });
    }
  });
  ctx.run("SM-05", () => {
    const hs = facts.holes.filter((h) => h.at && h.axis && h.d > 0).slice(0, 400);
    let worst = null, count = 0;
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i], b = hs[j], m = mainAxis(a.axis);
      if (m !== mainAxis(b.axis)) continue;
      const d = Math.hypot(...[0, 1, 2].filter((k) => k !== m).map((k) => a.at[k] - b.at[k]));
      if (d < 1e-6) continue;                                   // same position: counterbore / coaxial holes
      const web = d - (a.d + b.d) / 2;
      if (web < 2 * t - 1e-6) { count++; if (!worst || web < worst.web) worst = { web, a, b }; }
    }
    if (worst) ctx.add("SM-05", { value: round(worst.web), limit: round(2 * t), unit: "mm", where: worst.a.at.map((v, k) => (v + worst.b.at[k]) / 2), feature: worst.a.source, iface: worst.a.iface,
      message: `${count} paire(s) de trous trop proches : le voile le plus mince fait ${num(worst.web)} mm entre « ${worst.a.source} » et « ${worst.b.source} ». Limite : ≥ 2 × t = ${num(2 * t)} mm. Correctif : écarter ces trous d'au moins ${num(2 * t - worst.web)} mm.` });
  });
}

/* Distance from a hole to each of the 4 sides of its face, told apart as free edges or bends. */
export function holeSides(ctx, h, T) {
  const m = mainAxis(h.axis), bb = ctx.bbox, out = [];
  const open = new Set(T.formed && T.shell ? T.shell.open || [] : []);
  for (let k = 0; k < 3; k++) {
    if (k === m) continue;
    for (const [sign, dist] of [["-", h.at[k] - bb[k]], ["+", bb[3 + k] - h.at[k]]]) out.push({ dist, bend: T.formed && !open.has(sign + "XYZ"[k]) });
  }
  return out;
}

export function checkSheet(ctx) {
  const T = sheetThickness(ctx);
  if (!T || !(T.t > 0)) return;
  const { facts } = ctx, t = T.t, rIn = ((ctx.mat && ctx.mat.rMinT) || 1) * t;
  ctx.run("LAM-01", () => { if (isLaminate(ctx)) ctx.add("LAM-01", { value: ctx.spec.material, limit: "métal", message: `Matériau « ${ctx.spec.material} » : un stratifié ne se plie pas (limite : aucun pli). Correctif : passer en process « laser_cut » (plaque plane) ou choisir une tôle métallique.`, fix: ctx.fix("Passer en plaque découpée (laser_cut)", { target: "spec", id: null, path: "process", value: "laser_cut" }) }); });
  ctx.run("PL-01", () => { if (ctx.cls === "plastic" && T.formed) ctx.add("PL-01", { value: ctx.spec.material, limit: "pliage à chaud", message: `Pièce pliée en « ${ctx.spec.material} » : une plaque plastique ne se plie qu'à chaud (limite : pas de pliage à froid). Correctif : prévoir un pliage à chaud (rayon ≥ 2 × t) ou passer en métal / en moulage.` }); });
  common(ctx, T);
  if (T.folded) return checkFolded(ctx, T);
  ctx.run("SM-01", () => { if (T.formed) ctx.add("SM-01", { severity: "info", value: round(rIn), limit: round(rIn), unit: "mm", feature: T.shell.source, message: `Pièce pliée (épaisseur ${num(t)} mm) : cette pièce ne déclare pas ses plis (bloc « folded »), vérifier au plan un rayon intérieur ≥ ${num(rIn)} mm (${num(rIn / t)} × t pour ${ctx.spec.material || "la matière"}). Correctif : imposer un seul rayon intérieur ≥ ${num(rIn)} mm pour tous les plis.` }); });
  ctx.run("SM-07", () => { if (T.formed) ctx.add("SM-07", { severity: "info", value: 0, limit: round(rIn + t + 0.5), unit: "mm", feature: T.shell.source, message: `Angles de la pièce pliée : aucun dégagement (corner relief) n'est modélisé ; limite : dégagement carré de R + t + 0,5 = ${num(rIn + t + 0.5)} mm là où deux bords pliés se rejoignent. Correctif : les ajouter au développé (DXF).` }); });
  ctx.run("SM-02", () => {
    if (!T.formed || !ctx.dims) return;
    for (const o of T.shell.open || []) {
      const F = FACES[o]; if (!F) continue;
      const flange = ctx.dims[F.axis], lim = 4 * t;
      if (flange < lim - 1e-6) ctx.add("SM-02", { value: round(flange), limit: round(lim), unit: "mm", feature: T.shell.source,
        message: `Bords pliés hauts de ${num(flange)} mm pour une tôle de ${num(t)} mm : la presse plieuse ne peut pas les tenir. Limite : ≥ 4 × t = ${num(lim)} mm. Correctif : porter la hauteur à ${num(lim)} mm ou plus, ou réduire l'épaisseur.` });
    }
  });
  for (const [id, bend] of [["SM-03", true], ["SM-04", false]]) ctx.run(id, () => {
    if (T.formed && !T.shell) return;                             // a strip bent on its edge view (busbar) : its bends are not sides of a tray
    for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}`)) {
      let worst = null;
      for (const h of g) { if (!h.at || !h.axis || !ctx.bbox) continue; for (const s of holeSides(ctx, h, T)) { if (s.bend !== bend) continue; const gap = s.dist - h.d / 2 - (bend ? t + rIn : 0); if (!worst || gap < worst.gap) worst = { gap, h }; } }
      const lim = bend ? 2.5 * t + rIn : 2 * t;
      if (!worst || worst.gap >= lim - 1e-6) continue;
      ctx.add(id, { value: round(worst.gap), limit: round(lim), unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
        message: bend ? `${holeLabel(g)} à ${num(Math.max(worst.gap, 0))} mm du pli le plus proche (bord du trou à la ligne de pli). Limite : ≥ 2,5 × t + R = ${num(lim)} mm, sinon le trou s'ovalise. Correctif : éloigner le trou du pli de ${num(lim - worst.gap)} mm, ou le percer après pliage.`
          : `${holeLabel(g)} à ${num(worst.gap)} mm du bord de la pièce (bord du trou). Limite : ≥ 2 × t = ${num(lim)} mm. Correctif : éloigner le trou du bord de ${num(lim - worst.gap)} mm.` });
    }
  });
}

export function checkPlate(ctx) {
  const T = sheetThickness(ctx);
  if (!T || !(T.t > 0)) return;
  const { facts } = ctx, t = T.t, lam = isLaminate(ctx), soft = lam || ctx.cls === "plastic", LP = laserProfile(ctx.spec.material), byLaser = !!LP && LP.verdict === "ok" && t <= LP.t[1] + 1e-6;      // the laser sheet of the material (LAS- rules) then says the thickness and the inside radii
  ctx.run("LC-02", () => {
    const notFlat = [facts.folded && "bords pliés (folded)", facts.shells.length && "shell", facts.bosses.length && "boss", facts.revolves.length && "revolve"].filter(Boolean);
    if (notFlat.length) ctx.add("LC-02", { value: notFlat.join(", "), limit: "plaque plane", message: `La pièce contient ${notFlat.join(", ")} : une plaque découpée est plane (limite : épaisseur constante, aucune forme 3D). Correctif : retirer ces features, ou changer de process (sheet_metal, cnc_milling).` });
    else if (!LP && t > 25 + 1e-6) ctx.add("LC-02", { value: round(t), limit: 25, unit: "mm", message: `Épaisseur ${num(t)} mm : au-delà de 25 mm la découpe laser n'est plus possible (jet d'eau : coupe conique et lente). Limite : ≤ 25 mm. Correctif : réduire l'épaisseur ou usiner la pièce (cnc_milling).` });
  });
  ctx.run("LC-01", () => {
    const blind = [...facts.pockets.filter((p) => !p.through && p.depth < t - 1e-6).map((p) => `pocket « ${p.source} »`),
      ...groupBy(facts.holes.filter((h) => (!h.through && h.depth < t - 1e-6) || h.cbore || h.csink), (h) => h.source).map((g) => `${g[0].cbore ? "lamage" : g[0].csink ? "fraisure" : "trou borgne"} « ${g[0].source} »`)];
    if (blind.length) ctx.add("LC-01", { value: blind.length, limit: 0, unit: "usinages borgnes",
      message: `${blind.length} usinage(s) non traversant(s) (${blind.slice(0, 4).join(", ")}${blind.length > 4 ? "…" : ""}) sur une plaque découpée ; limite : 0, le laser / jet d'eau coupe toute l'épaisseur. Correctif : rendre ces features traversantes, ou prévoir une reprise d'usinage (process « cnc_milling »).` });
  });
  ctx.run("PL-01", () => { if (ctx.cls === "plastic" && !lam) ctx.add("PL-01", { severity: "info", value: ctx.spec.material, limit: "plaque plane", message: `Plaque en « ${ctx.spec.material} » : elle reste plane (limite : pas de pliage à froid, pliage à chaud seulement avec R ≥ 2 × t). Correctif : si un pli est nécessaire, le prévoir à chaud ou assembler deux plaques.` }); });
  common(ctx, T);
  ctx.run("SM-04", () => {
    if (lam) return;                                            // laminates: LAM-02 is stricter
    for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}`)) {
      let worst = null;
      for (const h of g) { if (!h.at || !h.axis || !ctx.bbox) continue; for (const s of holeSides(ctx, h, T)) { const gap = s.dist - h.d / 2; if (!worst || gap < worst.gap) worst = { gap, h }; } }
      if (worst && worst.gap < 2 * t - 1e-6) ctx.add("SM-04", { value: round(worst.gap), limit: round(2 * t), unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
        message: `${holeLabel(g)} à ${num(worst.gap)} mm du bord de la plaque (bord du trou). Limite : ≥ 2 × t = ${num(2 * t)} mm. Correctif : éloigner le trou du bord de ${num(2 * t - worst.gap)} mm.` });
    }
  });
  ctx.run("LAM-02", () => {
    if (!lam) return;
    for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}`)) {
      let worst = null;
      for (const h of g) { if (!h.at || !h.axis || !ctx.bbox) continue; for (const s of holeSides(ctx, h, T)) if (!worst || s.dist < worst.dist) worst = { dist: s.dist, h }; }
      if (worst && worst.dist < 3 * g[0].d - 1e-6) ctx.add("LAM-02", { value: round(worst.dist), limit: round(3 * g[0].d), unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
        message: `${holeLabel(g)} dans un stratifié : axe à ${num(worst.dist)} mm du bord. Limite : ≥ 3 × D = ${num(3 * g[0].d)} mm (matage, cisaillement au bord). Correctif : éloigner le trou du bord de ${num(3 * g[0].d - worst.dist)} mm.` });
    }
  });
  ctx.run("LAM-03", () => {
    if (!lam) return;
    const hs = facts.holes.filter((h) => h.at && h.d > 0).slice(0, 400);
    let worst = null;
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const d = Math.hypot(hs[i].at[0] - hs[j].at[0], hs[i].at[1] - hs[j].at[1], hs[i].at[2] - hs[j].at[2]), lim = 4 * Math.max(hs[i].d, hs[j].d);
      if (d > 1e-6 && d < lim - 1e-6 && (!worst || d / lim < worst.d / worst.lim)) worst = { d, lim, a: hs[i], b: hs[j] };
    }
    if (worst) ctx.add("LAM-03", { value: round(worst.d), limit: round(worst.lim), unit: "mm", where: worst.a.at, feature: worst.a.source, iface: worst.a.iface,
      message: `Stratifié : entraxe de ${num(worst.d)} mm entre « ${worst.a.source} » et « ${worst.b.source} ». Limite : ≥ 4 × D = ${num(worst.lim)} mm (section nette entre les trous). Correctif : écarter ces trous de ${num(worst.lim - worst.d)} mm.` });
  });
  ctx.run("LAM-04", () => {
    if (!soft || byLaser) return;                               // metal laser / waterjet : the kerf radius is enough ; a laminate or a plastic within reach of the laser has no cutter radius either (LAS-05)
    for (const p of facts.pockets) {
      const small = Math.min(p.w, p.h);
      if (!(small > 0) || p.rMin >= 1.5 - 1e-3) continue;
      const f = ctx.feature(p.source), path = f && f.op === "pocket" ? (f.rect ? "r" : f.profile && (f.profile.rect || f.profile.poly) ? "profile.r" : null) : null;
      const cut = p.iface && (ctx.built.interfaces || []).some((i) => i.id === p.iface && i.type === "cutout");
      ctx.add("LAM-04", { value: p.rMin, limit: 1.5, unit: "mm", feature: p.source, iface: p.iface,
        message: `Découpe « ${p.source} » (${num(p.w)} × ${num(p.h)} mm) : angles intérieurs R${num(p.rMin)}${p.rMin < 1e-6 ? " (vifs)" : ""}, impossibles au router. Limite : R ≥ 1,5 mm (fraise Ø3). Correctif : ${small / 2 > 1.5 ? "passer les angles à R1,5" : "élargir la découpe à plus de 3 mm"}.`,
        fix: small / 2 > 1.5 ? ctx.fix("Passer les angles à R1,5", ctx.patch(p, path, 1.5, cut ? "params.r" : null)) : null });
    }
  });
}
