/* DynamiteOrbit — DFM rules: aluminium and plastic extrusion. They read facts.extrusion (profile metrics computed by
   profile_metrics.js): wall, gaps / tongue ratio, corners, hollows, circumscribing circle (CCD), envelopes.
   Limits: Aluminum Extruders Council (AEC) design guidance, EN 755-9 / EN 12020-2 tolerances; wall-vs-CCD values and
   plastic limits are rules of thumb to confirm with the extruder. */

import { PLANES } from "../cad/vec.js";
import { flattenLoop } from "../cad/profile.js";
import { convexHull } from "../cad/profile_metrics.js";
import { rule, num, round } from "./dfx_core.js";

const S = {
  aec: "Aluminum Extruders Council (AEC) — Aluminum Extrusion Manual, design guidelines", en: "EN 755-9 / EN 12020-2 (tolérances des profilés aluminium)",
  thumb: "Règle de pouce (rule of thumb), à confirmer avec l'extrudeur", pl: "Guides de conception d'extrusion plastique (rule of thumb)",
};
const R = {
  e00: rule("EXT-00", "Bloc « extrusion » présent", "La section est décrite dans « extrusion.profile »", "warn", "Sans la section, les règles de profil ne peuvent pas être vérifiées.", "DynamiteOrbit part language"),
  e01: rule("EXT-01", "Paroi minimale", "Aluminium : ≥ 1,2 mm (CCD ≤ 100), 1,5 mm (CCD ≤ 150), 2,0 mm au-delà ; plastique : ≥ 1,0 mm", "error", "Une paroi trop mince ne se remplit pas dans la filière et se déforme en sortie.", `${S.aec} ; ${S.thumb}`),
  e02: rule("EXT-02", "Parois uniformes", "Épaisseur maxi / mini ≤ 2:1", "warn", "Les zones épaisses sortent plus vite que les minces : vrillage, marques, retassures.", S.aec),
  e03: rule("EXT-03", "Rapport de languette (tongue ratio)", "Profondeur / largeur d'une gorge ≤ 3:1 (erreur au-delà de 4:1)", "warn", "La languette d'acier de la filière qui forme la gorge casse si elle est trop longue et étroite.", S.aec),
  e04: rule("EXT-04", "Rayons sur tous les angles", "Rayon ≥ 0,4 mm (0,5 mm conseillé), intérieur comme extérieur", "warn", "Un angle vif use la filière, concentre les contraintes et ne se remplit pas.", S.aec, { fix: true }),
  e05: rule("EXT-05", "Creux (hollows)", "Le moins de creux possible : chaque creux demande un mandrin (porthole / bridge die)", "info", "Filière plus chère, vitesse plus faible, lignes de soudure.", S.aec),
  e06: rule("EXT-06", "Cercle circonscrit (CCD)", "CCD ≤ 200 mm pour les presses courantes", "warn", "Au-delà, peu de presses et de fournisseurs.", `${S.aec} ; ${S.thumb}`),
  e07: rule("EXT-07", "Masse linéique", "Section × masse volumique (kg/m)", "info", "Base du prix matière et du choix de la presse.", S.aec),
  e08: rule("EXT-08", "Symétrie", "Section symétrique quand c'est possible", "info", "Un écoulement équilibré donne un profilé droit.", S.aec),
  e09: rule("EXT-09", "Enveloppes intérieures / extérieures", "Aucune enveloppe (carte, ventilateur, cellule) ne touche le profilé, jeu compris", "error", "Le composant ne rentre pas ou ne se pose pas.", "DynamiteOrbit part language (extrusion.inside / outside)"),
  e10: rule("EXT-10", "Longueur et barre standard", "Barres de 6 m en standard ; longueur de pièce ≤ 6 m", "info", "Les pièces sont débitées dans des barres : optimiser le nombre de pièces par barre.", S.thumb),
  e11: rule("EXT-11", "Tolérances d'extrusion", "Coupe à la scie ± 0,5 mm ; section selon EN 755-9 / EN 12020-2 (≈ ± 0,15 à ± 0,5 mm selon la cote)", "info", "Un profilé brut n'a pas les tolérances d'une pièce usinée.", S.en),
  e12: rule("EXT-12", "Plastique : pas de section massive", "Épaisseur ≤ 4 mm ; éviter les creux fermés", "warn", "Le plastique refroidit lentement : retassures, vides, déformation ; un creux demande un calibrage interne.", S.pl),
};
const STEPS = ["Dessiner la section autour de ce qu'elle doit contenir (enveloppes inside / outside)", "Parois uniformes, au-dessus du minimum", "Un rayon sur chaque angle (≥ 0,4 mm)",
  "Pas de gorge plus profonde que 3 × sa largeur", "Le moins de creux possible, section symétrique", "Usinages après extrusion (trous, découpes) dans features / interfaces"];
export const BOOK_EXTRUSION = [
  { process: "extrusion_al", category: "DFM", steps: STEPS, rules: [R.e00, R.e01, R.e02, R.e03, R.e04, R.e05, R.e06, R.e07, R.e08, R.e09, R.e10, R.e11] },
  { process: "extrusion_plastic", category: "DFM", steps: STEPS, rules: [R.e00, R.e01, R.e02, R.e03, R.e04, R.e05, R.e06, R.e07, R.e08, R.e09, R.e10, R.e12] },
];

/* Boundary samples of a normalised profile: [x, y, nx, ny] with (nx, ny) the unit normal pointing into the material. */
function boundarySamples(profile) {
  const loops = [profile.outer, ...(profile.holes || [])].map((lp) => flattenLoop(lp, 0.02));
  let per = 0;
  for (const pts of loops) for (let i = 0; i < pts.length; i++) { const b = pts[(i + 1) % pts.length]; per += Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]); }
  const pitch = Math.max(0.25, per / 1800), out = [];
  loops.forEach((pts, li) => { for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
    if (L < 1e-9) continue;
    const n = Math.max(1, Math.round(L / pitch));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push([a[0] + ex * t, a[1] + ey * t, -ey / L, ex / L, li]); }   // material is on the left of every loop
  } });
  return { samples: out, loops };
}
/** Thickest spot of a section = diameter of the largest circle inscribed in the material (tangent at a boundary sample). */
export function sectionMaxThickness(profile) {
  const { samples } = boundarySamples(profile);
  let tMax = 0, at = null;
  for (const p of samples) {
    let r = Infinity;
    for (const q of samples) {
      const dx = q[0] - p[0], dy = q[1] - p[1], dn = dx * p[2] + dy * p[3];
      if (dn > 1e-9) { const rr = (dx * dx + dy * dy) / (2 * dn); if (rr < r) r = rr; }
    }
    if (Number.isFinite(r) && 2 * r > tMax) { tMax = 2 * r; at = [p[0] + p[2] * r, p[1] + p[3] * r]; }
  }
  return { tMax, at };
}
/* Ray o + t d against a list of segments [a, b]: smallest t > 0, or Infinity. With minCos, a first hit on a wall that does
   not face the ray (more than 45° off for 0.7: a wedge, an acute corner) returns NaN: "no facing wall". */
function cast(o, d, segs, minCos = 0) {
  let best = Infinity, hit = null;
  for (const sg of segs) {
    const [a, b] = sg, ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const ax = a[0] - o[0], ay = a[1] - o[1], t = (ax * ey - ay * ex) / den, u = (ax * d[1] - ay * d[0]) / den;
    if (t > 1e-7 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) { best = t; hit = sg; }
  }
  if (hit && minCos > 0) { const ex = hit[1][0] - hit[0][0], ey = hit[1][1] - hit[0][1]; if (Math.abs(d[0] * ey - d[1] * ex) / (Math.hypot(ex, ey) || 1) < minCos) return NaN; }
  return best;
}
const toSegs = (pts) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
/** Wall thickness of a section measured between FACING walls only: {min, at (middle of the thinnest wall), median}; null if none.
    (The builder's metric also counts the rays that graze an acute corner, which would report a zero wall on a dovetail.) */
export function sectionWalls(profile) {
  const { samples, loops } = boundarySamples(profile), segs = loops.flatMap(toSegs), ts = [];
  let min = Infinity, at = null;
  for (const s of samples) {
    const t = cast(s, [s[2], s[3]], segs, 0.7);
    if (!Number.isFinite(t)) continue;
    ts.push(t);
    if (t < min) { min = t; at = [s[0] + s[2] * t / 2, s[1] + s[3] * t / 2]; }
  }
  ts.sort((x, y) => x - y);
  return ts.length ? { min, at, median: ts[ts.length >> 1] } : null;
}
/** Deepest open gap of the outer contour: {ratio = depth / width of the mouth, width, depth, at} — the "tongue ratio" of the
    die. On each wall that faces another wall, the deepest point is kept; depth = distance from the middle of the gap to its
    mouth (convex hull) along the gap, width = opening measured just inside the mouth (a V groove is judged on its opening,
    not on its pointed bottom). A fin gap standing on a base plate is measured from its bottom (profile_metrics measures
    from the hull, which the base plate brings close). */
export function gapRatio(profile) {
  const { samples, loops } = boundarySamples(profile), segs = loops.flatMap(toSegs), hull = toSegs(convexHull(loops[0])), picks = [];
  let run = null;
  const flush = () => { if (run) picks.push(run); run = null; };
  for (const s of samples) {
    const out = [-s[2], -s[3]], w = s[4] === 0 ? cast(s, out, segs, 0.7) : NaN;
    if (!Number.isFinite(w) || w < 1e-6) { flush(); continue; }
    const mid = [s[0] + out[0] * w / 2, s[1] + out[1] * w / 2], open = [[-out[1], out[0]], [out[1], -out[0]]].filter((d) => !Number.isFinite(cast(mid, d, segs)));
    const depth = open.length === 1 ? cast(mid, open[0], hull) : NaN;      // not 1: closed pocket, or a channel open at both ends
    if (!Number.isFinite(depth)) { flush(); continue; }
    if (!run || depth > run.depth) run = { s, out, w, mid, dir: open[0], depth };
  }
  flush();
  let best = { ratio: 0, width: null, depth: null, at: null };
  for (const c of picks) {
    let mouth = c.w;
    for (let k = 1; k <= 12; k++) {
      const q = [c.mid[0] + c.dir[0] * c.depth * k / 12, c.mid[1] + c.dir[1] * c.depth * k / 12], l = cast(q, c.out, segs), r = cast(q, [-c.out[0], -c.out[1]], segs);
      if (!Number.isFinite(l) || !Number.isFinite(r)) break;
      mouth = l + r;
    }
    if (c.depth / mouth > best.ratio) best = { ratio: c.depth / mouth, width: mouth, depth: c.depth, at: [c.s[0], c.s[1]] };
  }
  return best;
}
/* Does the profile boundary cross the envelope rectangle grown by its clearance? (the builder only probes 9 points) */
function envelopeHit(profile, e) {
  const hw = e.w / 2 + (e.clearance || 0) - 1e-6, hh = e.h / 2 + (e.clearance || 0) - 1e-6, x0 = e.at[0] - hw, x1 = e.at[0] + hw, y0 = e.at[1] - hh, y1 = e.at[1] + hh;
  for (const pts of boundarySamples(profile).loops) for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1];
    let t0 = 0, t1 = 1, out = false;                            // Liang–Barsky clipping of the segment against the rectangle
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) out = true; continue; }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    }
    if (!out && t0 <= t1) return true;
  }
  return false;
}
/* Area centroid of the section (holes are clockwise, so their signed area is negative). */
function centroid(profile) {
  let A = 0, cx = 0, cy = 0;
  for (const pts of boundarySamples(profile).loops) for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = a[0] * b[1] - b[0] * a[1];
    A += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c;
  }
  return Math.abs(A) > 1e-9 ? [cx / (3 * A), cy / (3 * A)] : null;
}

/* Patch entries that give a radius to every sharp corner of the profile definition (poly / rect, also inside outer + holes). */
function cornerFix(def, base, r, ops = []) {
  if (!def || typeof def !== "object") return ops;
  if (def.outer) { cornerFix(def.outer, `${base}.outer`, r, ops); (def.holes || []).forEach((h, i) => cornerFix(h, `${base}.holes.${i}`, r, ops)); }
  else if ((Array.isArray(def.poly) && def.poly.every((q) => Array.isArray(q) && q.length < 3)) || Array.isArray(def.rect)) ops.push({ target: "spec", id: null, path: `${base}.r`, value: r });
  return ops;
}

export function checkExtrusion(ctx) {
  const ex = ctx.facts.extrusion, m = ex && ex.metrics, al = ctx.process === "extrusion_al", what = al ? "aluminium" : "plastique";
  ctx.run("EXT-00", () => { if (!m) ctx.add("EXT-00", { value: "absent", limit: "extrusion.profile", message: "Le process est une extrusion mais la pièce n'a pas de bloc « extrusion » : la section (paroi, rayons, gorges) ne peut pas être vérifiée ; attendu : « extrusion.profile ». Correctif : décrire la section dans « extrusion.profile » et la longueur dans « extrusion.length »." }); });
  if (!m) return;
  const P = PLANES[{ Y: "XZ", X: "YZ", Z: "XY" }[ex.axis] || "XZ"], len = ex.length || 0;
  const at3 = (p) => (Array.isArray(p) ? [0, 1, 2].map((k) => P.u[k] * p[0] + P.v[k] * p[1] + P.n[k] * len / 2) : null);
  let thick = null, sw;
  const walls = () => { if (sw === undefined) { try { sw = ex.profile ? sectionWalls(ex.profile) : null; } catch (e) { sw = null; } } return sw || (m.wallMin > 0 ? { min: m.wallMin, at: m.wallAt, median: m.wallMedian } : null); };
  const maxT = () => { if (thick === null) { try { thick = ex.profile ? sectionMaxThickness(ex.profile) : { tMax: 0, at: null }; } catch (e) { thick = { tMax: 0, at: null }; } } return thick; };

  ctx.run("EXT-01", () => {
    const w = walls(), lim = al ? (m.ccd <= 100 ? 1.2 : m.ccd <= 150 ? 1.5 : 2.0) : 1.0;
    if (w && w.min < lim - 1e-6) ctx.add("EXT-01", { severity: w.min < 0.8 * lim ? "error" : "warn", value: round(w.min), limit: lim, unit: "mm", where: at3(w.at), feature: "extrusion",
      message: `Paroi la plus mince de la section : ${num(w.min)} mm (voir le marqueur). Limite ${what} : ≥ ${num(lim)} mm${al ? ` pour un cercle circonscrit (CCD) de ${num(m.ccd, 0)} mm` : ""}. Correctif : épaissir cette paroi à ${num(lim)} mm dans « extrusion.profile ».` });
  });
  ctx.run("EXT-02", () => {
    const w = walls();
    if (!w) return;
    const t = maxT(), tMax = t.tMax > 0 ? t.tMax : w.median, ratio = tMax / w.min;
    if (ratio > 2 + 1e-6) ctx.add("EXT-02", { value: round(ratio), limit: 2, unit: ": 1", where: at3(t.at), feature: "extrusion",
      message: `Parois non uniformes : la zone la plus épaisse fait ${num(tMax)} mm, la plus mince ${num(w.min)} mm, soit ${num(ratio, 1)}:1. Limite : 2:1. Correctif : amincir ou évider la zone épaisse, épaissir la paroi mince, et raccorder les épaisseurs par des rayons.` });
  });
  ctx.run("EXT-03", () => {
    let g = null;
    try { if (ex.profile) g = gapRatio(ex.profile); } catch (e) { /* fall back on the metric of the builder */ }
    // the builder's tongueRatio divides by the LOCAL width (a V groove looks infinitely deep): used only as a fallback, never as an error
    const r = g ? g.ratio : m.tongueRatio, warnAt = al ? 3 : 4;
    if (!(r > warnAt + 1e-6)) return;
    ctx.add("EXT-03", { severity: al && g && r > 4 ? "error" : "warn", value: round(r), limit: warnAt, unit: ": 1", where: at3(g ? g.at : m.tongueAt), feature: "extrusion",
      message: `Gorge trop profonde pour sa largeur : ${g ? `${num(g.depth)} mm de profondeur pour ${num(g.width)} mm d'ouverture, soit ` : "rapport profondeur / largeur = "}${num(r, 1)}:1. Limite : ${warnAt}:1${al ? " (4:1 avec précaution)" : ""}, sinon la languette de la filière casse. `
        + "Correctif : élargir la gorge, réduire sa profondeur (ailettes plus courtes ou plus espacées) ou ajouter un rayon en fond de gorge." });
  });
  ctx.run("EXT-04", () => {
    const small = m.rMin > 0 && m.rMin < 0.4 - 1e-6;
    if (!(ex.sharp > 0) && !small) return;
    const ops = cornerFix(ctx.spec.extrusion && ctx.spec.extrusion.profile, "extrusion.profile", 0.5);
    ctx.add("EXT-04", { value: ex.sharp > 0 ? 0 : round(m.rMin), limit: 0.4, unit: "mm", feature: "extrusion",
      message: `${ex.sharp > 0 ? `${ex.sharp} angle(s) vif(s) dans la section` : `Plus petit rayon de la section : R${num(m.rMin)}`}. Limite : R ≥ 0,4 mm sur tous les angles (0,5 mm conseillé). Correctif : ${ops.length ? "donner R0,5 à tous les angles du profil" : "donner un rayon ≥ 0,5 mm à chaque sommet du profil (3e valeur du point : [x, y, r])"}.`,
      fix: ops.length ? { label: "Arrondir tous les angles du profil à R0,5", patch: ops } : null });
  });
  ctx.run("EXT-05", () => {
    if (!(m.hollows > 0)) return;
    ctx.add("EXT-05", { severity: !al || m.hollows > 3 ? "warn" : "info", value: m.hollows, limit: al ? 3 : 0, unit: "creux", feature: "extrusion",
      message: al ? `${m.hollows} creux fermé(s) dans la section : chacun demande un mandrin (filière à pont, porthole die) — outillage plus cher, lignes de soudure. Conseil : le moins possible (avertissement au-delà de 3). Correctif : ouvrir les creux qui n'ont pas besoin d'être fermés (forme en U ou en C).`
        : `${m.hollows} creux fermé(s) dans une extrusion plastique : chaque creux demande un calibrage interne (air ou vide) ; limite conseillée : 0. Correctif : ouvrir la section (U, C) ou confirmer la faisabilité avec l'extrudeur.` });
  });
  ctx.run("EXT-06", () => {
    if (m.ccd > 200 + 1e-6) ctx.add("EXT-06", { value: round(m.ccd, 1), limit: 200, unit: "mm", feature: "extrusion",
      message: `Cercle circonscrit (CCD) de ${num(m.ccd, 0)} mm : au-delà de 200 mm, peu de presses peuvent sortir la section${m.ccd > 350 ? " (au-delà de 350 mm : presses exceptionnelles)" : ""}. Limite : ≤ 200 mm. Correctif : réduire la section ou la découper en deux profilés assemblés.` });
  });
  ctx.run("EXT-07", () => {
    const rho = ctx.mat ? ctx.mat.rho : null;
    if (!rho || !(m.area > 0)) return;
    const kgm = m.area * rho / 1000;
    ctx.add("EXT-07", { value: round(kgm, 3), limit: null, unit: "kg/m", feature: "extrusion",
      message: `Masse linéique : ${num(kgm, 3)} kg/m (section ${num(m.area, 0)} mm² × ${num(rho)} g/cm³) ; pas de limite, c'est la base du prix matière. Correctif : aucun — pour alléger, réduire la section là où la paroi dépasse le minimum.` });
  });
  ctx.run("EXT-08", () => {
    if (!ex.profile || !m.bbox) return;
    const c = centroid(ex.profile);
    if (!c) return;
    const ox = Math.abs(c[0] - (m.bbox[0] + m.bbox[2]) / 2) / (m.width || 1), oy = Math.abs(c[1] - (m.bbox[1] + m.bbox[3]) / 2) / (m.height || 1);
    if (ox > 0.01 && oy > 0.01) ctx.add("EXT-08", { value: round(Math.max(ox, oy) * 100, 1), limit: 1, unit: "% de décalage", where: at3(c), feature: "extrusion",
      message: `Section sans axe de symétrie : son centre de gravité est décalé de ${num(ox * 100, 0)} % en largeur et ${num(oy * 100, 0)} % en hauteur par rapport au centre de l'enveloppe (repère : < 1 %). Correctif : si la fonction le permet, rendre la section symétrique par rapport à un axe (écoulement équilibré, profilé plus droit).` });
  });
  ctx.run("EXT-09", () => {
    const hit = (e) => { try { return !!ex.profile && Array.isArray(e.at) && envelopeHit(ex.profile, e); } catch (err) { return false; } };
    for (const e of ex.envelopes || []) if (e.collides || hit(e)) ctx.add("EXT-09", { value: e.name, limit: `jeu ${num(e.clearance)} mm`, where: at3(e.at), feature: "extrusion",
      message: `L'enveloppe ${e.kind === "inside" ? "intérieure" : "extérieure"} « ${e.name} » (${num(e.w)} × ${num(e.h)} mm, jeu ${num(e.clearance)} mm) touche la matière du profilé ; limite : aucune interférence, jeu compris. Correctif : ${e.kind === "inside" ? "agrandir le logement dans la section" : "dégager la section à cet endroit"} ou déplacer l'enveloppe (« at »).` });
  });
  ctx.run("EXT-10", () => {
    if (!(len > 0)) return;
    const BAR = 6000, KERF = 4, n = Math.floor((BAR + KERF) / (len + KERF));
    ctx.add("EXT-10", { severity: len > BAR ? "warn" : "info", value: len, limit: BAR, unit: "mm", feature: "extrusion",
      message: len > BAR ? `Longueur ${num(len, 0)} mm : plus longue qu'une barre standard. Limite : 6 000 mm. Correctif : couper la pièce en deux tronçons ou consulter l'extrudeur pour une longueur spéciale.`
        : `Longueur ${num(len, 1)} mm : ${n} pièce(s) par barre standard de 6 m (trait de scie 4 mm, chute ${num(BAR - n * len - (n - 1) * KERF, 0)} mm) ; limite : 6 000 mm. Correctif : aucun — ajuster la longueur de quelques millimètres peut ajouter une pièce par barre.` });
  });
  ctx.run("EXT-11", () => {
    if (al && len > 0) ctx.add("EXT-11", { value: len, limit: 0.5, unit: "mm (± coupe)", feature: "extrusion",
      message: `Tolérances d'un profilé brut : longueur ${num(len, 1)} mm coupée à la scie ± 0,5 mm ; cotes de section selon EN 755-9 / EN 12020-2 (≈ ± 0,15 à ± 0,5 mm), rectitude ≈ 1,5 mm/m. Correctif : n'indiquer une tolérance plus serrée que sur les surfaces reprises en usinage (features / interfaces).` });
  });
  ctx.run("EXT-12", () => {
    if (al) return;
    const t = maxT();
    if (t.tMax > 4 + 1e-6) ctx.add("EXT-12", { value: round(t.tMax), limit: 4, unit: "mm", where: at3(t.at), feature: "extrusion",
      message: `Section plastique massive : ${num(t.tMax)} mm d'épaisseur au plus épais. Limite : ≤ 4 mm (retassures, vides, refroidissement lent). Correctif : évider la zone épaisse en gardant des parois de 1 à 3 mm.` });
  });
}
