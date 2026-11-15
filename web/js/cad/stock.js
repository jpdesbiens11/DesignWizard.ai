/* DesignWizard.ai — raw stock ("matière première"): what the craftsman takes from the rack before any operation.
   spec.stock = { form, ...finished dimensions of the blank, axis?, allowance? }
   The dimensions written in the part are those of the FINISHED blank (the body the operations start from). The
   platform then says which commercial size to buy (next standard size up), how it is cut, and how much of it ends
   up in the part (material utilisation, "buy-to-fly" ratio).
   Conventions: min corner at the origin, L along X, W along Y, thickness / height along Z; long products run along
   X (override with "axis"); round products are centred on their axis, Z by default.
   Sizes are common metric series held by distributors — to confirm with the supplier actually used. */

import { SHEET_GAUGES, PCB_THICKNESS } from "./standards.js";
import { sheetSeries, sheetWord } from "./special_processes.js";

export const PLATE_THICKNESS = [3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 25, 30, 35, 40, 50, 60, 80, 100];
export const ROUND_BARS = [4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 25, 28, 30, 32, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 150];
export const FLAT_THICKNESS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
export const FLAT_WIDTH = [10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 200];
export const ANGLE_LEGS = [15, 20, 25, 30, 40, 50, 60, 80, 100];
export const ANGLE_THICKNESS = [2, 3, 4, 5, 6, 8, 10];
export const TUBE_ROUND_OD = [6, 8, 10, 12, 15, 16, 18, 20, 22, 25, 28, 30, 32, 35, 40, 45, 50, 60, 70, 80, 100];
export const TUBE_RECT_SIZE = [20, 25, 30, 40, 50, 60, 80, 100, 120];
export const TUBE_WALL = [1, 1.5, 2, 2.5, 3, 4, 5];

const PLANE_OF = { X: "YZ", Y: "XZ", Z: "XY" };
const axisOf = (s, dflt) => { const a = String(s.axis || dflt).toUpperCase(); if (!PLANE_OF[a]) throw new Error(`stock.axis « ${s.axis} » inconnu (X, Y ou Z).`); return a; };
const boxAlong = (axis, w, h, L) => (axis === "X" ? [L, w, h] : axis === "Y" ? [w, L, h] : [w, h, L]);
const isStd = (list, v) => list.some((x) => Math.abs(x - v) < 1e-6);
/** Smallest standard value at or above `need` (null when the series does not go that far). */
export const nextStd = (list, need) => { const v = list.find((x) => x >= need - 1e-6); return v === undefined ? null : v; };
const f1 = (x) => (Math.abs(x) < 1 ? Math.round(x * 1000) / 1000 : Math.round(x * 10) / 10).toLocaleString("fr-CA", { maximumFractionDigits: 3 });      // a film of 0,13 mm is not « 0,1 mm »

/* form -> { fr, icon, dims: [[key, label]], processes it suits, features(s): structural kernel features, raw(s, a): commercial size } */
export const STOCK_FORMS = {
  plate: { fr: "Plaque", icon: "plate", hint: "Plaque laminée, débitée à la scie ou au jet d'eau puis usinée.", dims: [["L", "Longueur"], ["W", "Largeur"], ["t", "Épaisseur"]],
    processes: ["cnc_milling", "laser_cut"], flat: true, features: (s) => [{ op: "box", size: [s.L, s.W, s.t ?? s.H] }],
    raw: (s, a) => flatRaw("Plaque", s, s.t ?? s.H, PLATE_THICKNESS, a, true) },
  sheet: { fr: "Tôle ou feuille", icon: "sheet", hint: "Tôle, feuille isolante, stratifié ou plaque mince découpés au laser de précision ; l'épaisseur reste celle du brut.", dims: [["L", "Longueur"], ["W", "Largeur"], ["t", "Épaisseur"]],
    processes: ["sheet_metal", "laser_cut"], flat: true, features: (s) => [{ op: "box", size: [s.L, s.W, s.t] }],
    raw: (s, a, mat) => flatRaw(sheetWord(mat), s, s.t, mat ? sheetSeries(mat) : SHEET_GAUGES, 0, false) },
  block: { fr: "Bloc scié", icon: "block", hint: "Bloc débité dans une plaque épaisse ou un méplat, usiné sur plusieurs faces.", dims: [["L", "Longueur"], ["W", "Largeur"], ["H", "Hauteur"]],
    processes: ["cnc_milling"], features: (s) => [{ op: "box", size: [s.L, s.W, s.H ?? s.t] }],
    raw: (s, a) => flatRaw("Bloc dans plaque", s, s.H ?? s.t, PLATE_THICKNESS, a, true) },
  bar_flat: { fr: "Méplat / carré", icon: "bar", hint: "Barre rectangulaire étirée ou laminée, coupée à longueur.", dims: [["w", "Largeur de section"], ["h", "Hauteur de section"], ["L", "Longueur"]],
    processes: ["cnc_milling"], features: (s) => [{ op: "box", size: boxAlong(axisOf(s, "X"), s.w, s.h, s.L) }],
    raw(s, a) {
      const lo = Math.min(s.w, s.h), hi = Math.max(s.w, s.h), T = nextStd(FLAT_THICKNESS, lo), Wd = nextStd(FLAT_WIDTH, hi) ?? nextStd(PLATE_THICKNESS, hi);
      const exact = T !== null && Wd !== null && isStd(FLAT_THICKNESS, lo) && (isStd(FLAT_WIDTH, hi) || isStd(FLAT_THICKNESS, hi));
      const rt = T ?? lo, rw = exact ? hi : (Wd ?? hi), L = s.L + a, advice = [];
      if (!exact) advice.push(`Section ${f1(s.w)} × ${f1(s.h)} mm hors série : méplat de ${f1(rt)} × ${f1(rw)} mm à usiner sur les flancs. Correctif : visez une section du commerce pour garder les faces brutes.`);
      return { label: `Méplat ${f1(rt)} × ${f1(rw)} mm, coupé à ${f1(L)} mm`, size: { w: rw, h: rt, L }, volume: rt * rw * L, exact, standard: T !== null && Wd !== null, advice };
    } },
  bar_round: { fr: "Rond", icon: "bar", hint: "Barre ronde étirée : la matière première du tour.", dims: [["d", "Diamètre"], ["L", "Longueur"]], processes: ["cnc_turning", "cnc_milling"], round: true,
    features: (s) => [{ op: "cylinder", d: s.d, h: s.L, at: [0, 0, 0], axis: axisOf(s, "Z") }],
    raw(s, a) {
      const D = nextStd(ROUND_BARS, s.d), exact = D !== null && isStd(ROUND_BARS, s.d), d = D ?? s.d, L = s.L + a;
      return { label: `Rond Ø${f1(d)} mm, coupé à ${f1(L)} mm`, size: { d, L }, volume: Math.PI * d * d / 4 * L, exact, standard: D !== null,
        advice: exact ? [] : [`Ø${f1(s.d)} mm n'est pas un rond du commerce : partir du Ø${f1(d)} et charioter. Correctif : Ø${f1(prevStd(ROUND_BARS, s.d) ?? d)} ou Ø${f1(d)} garde le brut d'étirage.`] };
    } },
  tube_round: { fr: "Tube rond", icon: "tube", hint: "Tube étiré ou soudé, coupé à longueur.", dims: [["d", "Diamètre extérieur"], ["t", "Paroi"], ["L", "Longueur"]], processes: ["cnc_turning", "cnc_milling"], round: true,
    features: (s) => [{ op: "extrude", profile: { gen: "round_tube", D: s.d, t: s.t }, plane: PLANE_OF[axisOf(s, "Z")], length: s.L }],
    raw(s, a) { const ok = isStd(TUBE_ROUND_OD, s.d) && isStd(TUBE_WALL, s.t), L = s.L + a;
      return { label: `Tube Ø${f1(s.d)} × ${f1(s.t)} mm, coupé à ${f1(L)} mm`, size: { d: s.d, t: s.t, L }, volume: Math.PI * (s.d * s.d - (s.d - 2 * s.t) ** 2) / 4 * L, exact: ok, standard: ok,
        advice: ok ? [] : [`Tube Ø${f1(s.d)} × ${f1(s.t)} mm hors série courante. Correctif : diamètres ${TUBE_ROUND_OD.slice(0, 8).join(", ")}… et parois ${TUBE_WALL.join(", ")} mm.`] }; } },
  tube_rect: { fr: "Tube rectangulaire", icon: "tube", hint: "Tube carré ou rectangulaire : léger et rigide en flexion.", dims: [["w", "Largeur"], ["h", "Hauteur"], ["t", "Paroi"], ["L", "Longueur"]], processes: ["cnc_milling"],
    features: (s) => [{ op: "extrude", profile: { gen: "tube", W: s.w, H: s.h, t: s.t }, plane: PLANE_OF[axisOf(s, "X")], length: s.L }],
    raw(s, a) { const ok = isStd(TUBE_RECT_SIZE, s.w) && isStd(TUBE_RECT_SIZE, s.h) && isStd(TUBE_WALL, s.t), L = s.L + a;
      return { label: `Tube ${f1(s.w)} × ${f1(s.h)} × ${f1(s.t)} mm, coupé à ${f1(L)} mm`, size: { w: s.w, h: s.h, t: s.t, L }, volume: (s.w * s.h - (s.w - 2 * s.t) * (s.h - 2 * s.t)) * L, exact: ok, standard: ok,
        advice: ok ? [] : [`Tube ${f1(s.w)} × ${f1(s.h)} × ${f1(s.t)} mm hors série courante. Correctif : côtés ${TUBE_RECT_SIZE.join(", ")} mm, parois ${TUBE_WALL.join(", ")} mm.`] }; } },
  angle: { fr: "Cornière", icon: "bar", hint: "Profilé en L du commerce : une équerre sans usinage de masse.", dims: [["a", "Aile horizontale"], ["b", "Aile verticale"], ["t", "Épaisseur"], ["L", "Longueur"]], processes: ["cnc_milling"],
    features: (s) => [{ op: "extrude", profile: { gen: "angle", A: s.a, B: s.b, t: s.t }, plane: PLANE_OF[axisOf(s, "X")], length: s.L }],
    raw(s, a) { const ok = isStd(ANGLE_LEGS, s.a) && isStd(ANGLE_LEGS, s.b) && isStd(ANGLE_THICKNESS, s.t), L = s.L + a;
      return { label: `Cornière ${f1(s.a)} × ${f1(s.b)} × ${f1(s.t)} mm, coupée à ${f1(L)} mm`, size: { a: s.a, b: s.b, t: s.t, L }, volume: (s.a + s.b - s.t) * s.t * L, exact: ok, standard: ok,
        advice: ok ? [] : [`Cornière ${f1(s.a)} × ${f1(s.b)} × ${f1(s.t)} mm hors série. Correctif : ailes ${ANGLE_LEGS.join(", ")} mm, épaisseurs ${ANGLE_THICKNESS.join(", ")} mm — sinon usiner dans un bloc.`] }; } },
  profile: { fr: "Profilé sur mesure", icon: "extrusion", hint: "Section extrudée dessinée pour la pièce (filière dédiée).", dims: [["L", "Longueur"]], processes: ["extrusion_al", "extrusion_plastic"],
    features: (s) => [{ op: "extrude", profile: s.profile, plane: PLANE_OF[axisOf(s, "X")], length: s.L }],
    raw(s, a) { return { label: `Profilé sur mesure, coupé à ${f1(s.L + a)} mm`, size: { L: s.L + a }, volume: null, exact: true, standard: false, advice: [] }; } },
  laminate: { fr: "Stratifié (PCB)", icon: "sheet", hint: "Stratifié FR4 détouré : l'épaisseur est celle du panneau.", dims: [["L", "Longueur"], ["W", "Largeur"], ["t", "Épaisseur"]], processes: ["pcb"], flat: true,
    features: (s) => [{ op: "box", size: [s.L, s.W, s.t] }],
    raw: (s) => flatRaw("Stratifié", s, s.t, PCB_THICKNESS, 0, false) },
  molded: { fr: "Moulage", icon: "cast", hint: "Aucun brut : la matière remplit un moule. La pièce se dessine d'elle-même autour de ce qu'elle contient, avec les règles du mouleur — injection pour un plastique, fonderie pour un métal.", dims: [], processes: ["injection_molding", "die_casting", "sand_casting"], additive: true,
    features: () => [], raw: () => ({ label: "Matière à mouler (granulés ou lingots de la nuance) — aucun brut à débiter", size: {}, volume: null, exact: true, standard: true, advice: [] }) },
  print: { fr: "Fabrication additive", icon: "print3d", hint: "Aucun brut : la forme est déposée couche par couche, les opérations ajoutent la matière.", dims: [], processes: ["fdm", "mjf", "sla", "lpbf", "injection_molding"], additive: true,
    features: () => [], raw: () => ({ label: "Aucun brut : forme obtenue au plus près (near net shape)", size: {}, volume: null, exact: true, standard: true, advice: [] }) },
};
function prevStd(list, v) { const below = list.filter((x) => x < v - 1e-6); return below.length ? below[below.length - 1] : null; }
function flatRaw(word, s, t, series, a, canFace) {
  const T = nextStd(series, t), exact = T !== null && isStd(series, t), rt = T ?? t, L = s.L + 2 * a, W = s.W + 2 * a, advice = [], lower = prevStd(series, t);
  const choice = lower !== null && T !== null ? `${f1(lower)} ou ${f1(T)} mm` : `${f1(T ?? lower ?? t)} mm`;
  if (T === null) advice.push(`${word} de ${f1(t)} mm : au-delà des épaisseurs courantes (${series[series.length - 1]} mm), à commander sur mesure.`);
  else if (!exact && canFace) advice.push(`Épaisseur ${f1(t)} mm hors série : ${word.toLowerCase()} de ${f1(rt)} mm à surfacer (${f1(rt - t)} mm à enlever). Correctif : ${choice} garde les faces brutes et supprime un posage.`);
  else if (!exact) advice.push(`Épaisseur ${f1(t)} mm hors série et impossible à surfacer pour ce brut. Correctif : prenez ${choice}.`);
  return { label: `${word} de ${f1(rt)} mm, débit ${f1(L)} × ${f1(W)} mm`, size: { t: rt, L, W }, volume: rt * L * W, exact, standard: T !== null, advice };
}

export function stockForm(name) {
  const f = STOCK_FORMS[String(name || "").toLowerCase()];
  if (!f) throw new Error(`Matière première inconnue « ${name} ». Formes : ${Object.keys(STOCK_FORMS).join(", ")}.`);
  return f;
}
/** Structural kernel features of the blank (values may still be expressions of the part parameters). */
export function stockFeatures(stock) {
  const form = stockForm(stock.form);
  return form.features(stock).map((f) => ({ id: "stock", name: `Brut : ${form.fr.toLowerCase()}`, ...f, shop: "stock" }));
}
/** Commercial size, cutting and advice for an EVALUATED stock block. allowance = machining stock per cut face (mm).
    materialId : a sheet is sold in the thicknesses of its material (paper, film, laminate, metal gauges). */
export function stockFacts(stock, process, materialId) {
  const form = stockForm(stock.form);
  for (const [k] of form.dims) if (typeof stock[k] !== "number" || !(stock[k] > 0)) {
    if (k === "t" && typeof stock.H === "number") continue;
    if (k === "H" && typeof stock.t === "number") continue;
    throw new Error(`stock.${k} doit être un nombre positif (reçu ${JSON.stringify(stock[k])}).`);
  }
  const cutClean = process === "laser_cut" || process === "sheet_metal" || process === "pcb";
  const a = typeof stock.allowance === "number" ? stock.allowance : (cutClean || form.additive ? 0 : form.flat || stock.form === "block" ? 2 : 2);
  const raw = form.raw(stock, a, materialId);
  return { form: stock.form, formName: form.fr, label: raw.label, raw: raw.size, rawVolume: raw.volume, exact: raw.exact, standard: raw.standard, allowance: a, advice: raw.advice, additive: !!form.additive };
}
/** The blank of a folded sheet-metal part (facts of family_folded.js) : the sheet at its thickness, cut to the flat pattern. */
export function foldedStock(F, materialId) {
  const series = materialId ? sheetSeries(materialId) : SHEET_GAUGES, [a, b] = F.flat.size;
  return { form: "sheet", formName: STOCK_FORMS.sheet.fr, label: `${sheetWord(materialId)} de ${f1(F.t)} mm, flan développé ${f1(a)} × ${f1(b)} mm`, raw: { t: F.t, L: a, W: b }, rawVolume: F.t * a * b,
    exact: true, standard: isStd(series, F.t), allowance: 0, advice: [], additive: false, folded: true };
}
/** Stock forms that suit a process, best first (used by the Shop). */
export function formsFor(process) {
  return Object.entries(STOCK_FORMS).filter(([, f]) => f.processes.includes(process)).map(([k]) => k);
}
