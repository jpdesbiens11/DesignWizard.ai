/* DesignOrbit.ai — the Shop companion for a FOLDED SHEET-METAL part. The designer says which sides of the base fold up
   (or down), or simply puts an interface on a side : that side becomes a folded edge that carries it. The part then
   writes itself as a « folded » block (cad/family_folded.js) : a base just large enough, one inside radius for every
   bend (the minimum of the material), edges high enough for the press brake and for what they carry, holes kept away
   from the bends, square reliefs where two folded edges meet. Figures are typical values of published sheet-metal
   design guides ; the thickness is the common one of thin sheet metal unless the designer picks another — it follows
   from the loads, not from the screws. Every decision is written down ; the shop's bend table prevails. */

import { material } from "../cad/materials.js";
import { sheetSeries } from "../cad/special_processes.js";
import { FOLD_SIDES } from "../cad/family_folded.js";

const r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ",");
export const FOLD_T = 1.5;                                       // thin sheet metal, when nothing is asked

/** What the press brake asks of the drawing, as the process screen shows it. Typical values : `basis` says what was read. */
export const FOLD_RULES = {
  label: "Sheet metal bending — laser cutting, then press brake", fr: "Tôlerie pliée — laser puis presse plieuse",
  chips: [["Rayon intérieur ≥ 1 × t", "Le minimum de chaque matière est dans sa fiche ; un seul rayon pour toute la pièce : un seul outil"], ["Bord plié ≥ 4 × t", "Hauteur extérieure. Des guides la lient plutôt au vé de la presse : environ 0,7 × son ouverture"],
    ["Trou à 2,5 × t + R d'un pli", "Du bord du trou à la ligne de pli. Des guides acceptent 2 × t + R pour un petit trou, d'autres demandent 3 × t + R"], ["Trou à 2 × t d'un bord libre"],
    ["Dégagement d'angle R + t + 0,5 mm", "Une entaille carrée là où deux bords pliés se rejoignent"], ["Pli développé = π/2 × (R + k × t), k = 0,44", "La longueur de la fibre neutre dans un pli à 90° ; k situe cette fibre dans l'épaisseur"]],
  notes: ["Le développé est indicatif : le facteur k de 0,44 est une valeur de départ courante (acier doux plié en l'air), pas une constante. L'atelier applique sa table de pliage et corrige le flan.",
    "Plis à 90°, un bord par côté de la base, vers le haut ou vers le bas. Pas de pli sur pli, pas d'ourlet, pas de pli en biais : ces formes ne sont pas dans le langage.",
    "Vé de la presse : de 6 à 12 × l'épaisseur selon l'atelier — il fixe le rayon réel et le plus petit bord pliable.", "Sens du laminage en travers des plis quand c'est possible ; tolérance d'angle à convenir (± 1° courant).",
    "Un trou percé « traversant » depuis un bord plié perce aussi le bord d'en face : donnez-lui la profondeur de la tôle."],
  basis: "Règles reprises du recueil de tôlerie du projet (SM-01 à SM-08). Pour cette brique, seuls des résumés de recherche de guides publiés ont été lus — bord minimal, distance du trou au pli, facteur k, ouverture du vé : ils confirment les ordres de grandeur et montrent que les guides ne s'accordent pas tous. Aucun guide n'a été lu en entier, aucune norme n'a été consultée, rien n'a été confronté à une table de pliage ni à une pièce réelle.",
};

/** A material folds on a press brake : a metal sold as sheet. */
export const canFold = (materialId) => { const m = material(materialId); return !!m && m.cls === "metal" && m.processes.includes("sheet_metal"); };
/** Sides the brief folds, in a fixed order : those asked for (brief.folds.sides) and those an interface sits on. */
export function foldSides(brief) {
  if (!brief || !canFold(brief.material)) return [];
  const s = new Set((brief.folds && brief.folds.sides) || []);
  for (const it of brief.interfaces || []) if (FOLD_SIDES[it.where]) s.add(it.where);
  return Object.keys(FOLD_SIDES).filter((k) => s.has(k));
}

/** Writes the folded part. all = prepared interfaces (shop_intent.prepare) ; T = { arrange, ifaceOut, tapped, P, off, up } of
    shop_intent. brief.folds = { sides: ["+X"…], h (asked height), dir: "up" | "down" }. → the core of a spec. */
export function foldedSheet(brief, all, log, T) {
  const sides = foldSides(brief), mat = material(brief.material), dir = brief.folds && brief.folds.dir === "down" ? "down" : "up", env = brief.envelope || {};
  const base = all.filter((it) => !FOLD_SIDES[it.where]).map((it) => ({ ...it, where: it.where === "-Z" ? "-Z" : "+Z" })), lay = T.arrange(base);
  const walls = sides.map((s) => { const on = all.filter((it) => it.where === s); return { side: s, on, lay: T.arrange(on) }; });
  const series = sheetSeries(brief.material), asked = Number(brief.t) > 0 ? Number(brief.t) : null, t = asked || FOLD_T;
  log.push(asked ? `Tôle de ${fr(t)} mm : épaisseur choisie${series.some((x) => Math.abs(x - t) < 1e-6) ? ", dans la série du commerce" : " — hors de la série du commerce"}.`
    : `Tôle de ${fr(t)} mm : l'épaisseur courante en tôlerie fine pliée — elle se choisit pour la tenue (onglet Simulation), pas pour les vis.`);
  const k = (mat && mat.rMinT) || 1, r = r2(k * t), R = r + t, clear = r2(2.5 * t + r), relief = r2(r + t + 0.5);
  log.push(`Un seul rayon intérieur de ${fr(r)} mm pour tous les plis (${fr(k)} × l'épaisseur, le minimum de ${mat ? mat.name : "la matière"}) : un seul outil sur la presse plieuse.`);
  const has = (s) => sides.includes(s), edge = Math.max(lay.edge, 2 * t), m = (a, b) => Math.max(edge, has(a) || has(b) ? clear : 0);
  let L = T.up(Math.max(lay.w + 2 * m("-X", "+X"), env.L || 0, 20)), W = T.up(Math.max(lay.h + 2 * m("-Y", "+Y"), env.W || 0, 15)), h = Math.max(4 * t + r, Number(brief.folds && brief.folds.h) || 0, env.H || 0);
  for (const w of walls) {
    const run = w.lay.w + 2 * Math.max(w.lay.edge, 2 * t) + 2 * relief;
    if (FOLD_SIDES[w.side].axis === 0) W = Math.max(W, T.up(run)); else L = Math.max(L, T.up(run));
    w.top = Math.max(w.lay.edge, 2 * t); if (w.on.length) h = Math.max(h, R + clear + w.lay.h + w.top);
    log.push(...w.lay.notes);
  }
  h = T.up(h, 1);
  const names = sides.map((s) => FOLD_SIDES[s].fr).join(", ");
  log.push(...lay.notes, `Base de ${fr(L)} × ${fr(W)} mm, ${sides.length} bord${sides.length > 1 ? "s pliés" : " plié"} à 90° vers le ${dir === "up" ? "haut" : "bas"} (${names}), hauts de ${fr(h)} mm : au moins 4 × l'épaisseur + le rayon pour que la presse plieuse les tienne${walls.some((w) => w.on.length) ? ", et la place de ce qu'ils portent" : ""}.`,
    `Trous à ${fr(clear)} mm au moins de chaque pli (2,5 × l'épaisseur + le rayon) : ils ne s'ovalisent pas.`);
  if (sides.length > 1 && walls.some((w) => walls.some((v) => v !== w && FOLD_SIDES[v.side].axis !== FOLD_SIDES[w.side].axis))) log.push(`Dégagement carré de ${fr(relief)} mm (rayon + épaisseur + 0,5) aux angles où deux bords pliés se rejoignent : l'angle ne se déchire pas.`);
  if (all.some((it) => it.type === "bolt_pattern" && it.side === "B")) log.push(`Taraudage dans une tôle de ${fr(t)} mm : un ou deux filets seulement en prise. Correctif : un écrou à sertir ou un insert à sertir, ou une tôle plus épaisse.`);
  /* an interface of the base sits on the base, not on the top of the folded edges ; one of a folded edge is centred in the flat
     of that edge and only pierces that edge ("through" would also pierce the edge across) */
  const zOf = (w) => { const zc = `(${T.off("h", r2(R + clear - w.top))})/2`; return dir === "up" ? zc : `t - ${zc}`; }, thin = (it) => (it.opts && it.opts.depth !== undefined ? {} : { opts: { ...(it.opts || {}), depth: "t + 0.5" } });
  const interfaces = [...base.map((it) => T.ifaceOut(it, it.where, [T.off("L/2", it.du), T.off("W/2", it.dv)], { ...T.tapped(it, true), level: it.where === "+Z" ? "t" : 0 })),
    ...walls.flatMap((w) => w.on.map((it) => T.ifaceOut(it, w.side, [T.off(FOLD_SIDES[w.side].axis === 0 ? "W/2" : "L/2", it.du), zOf(w)], it.type === "bolt_pattern" ? thin(it) : {})))];
  return { family: "sheet", process: "sheet_metal",
    params: { L: T.P(L, 20, Math.max(400, 2 * L), "Longueur de la base"), W: T.P(W, 15, Math.max(300, 2 * W), "Largeur de la base"), h: T.P(h, Math.ceil(4 * t + r), Math.max(100, 2 * h), "Hauteur des bords pliés"),
      t: { value: t, min: Math.min(series[0], t), max: Math.max(series[series.length - 1], t), step: 0.5, unit: "mm", label: "Épaisseur", group: "Enveloppe" }, r: { value: r, min: 0, max: Math.max(6, 2 * r), step: 0.5, unit: "mm", label: "Rayon intérieur de pliage", group: "Enveloppe" } },
    folded: { base: ["L", "W"], t: "t", r: "r", flanges: sides.map((s) => ({ side: s, h: "h", dir })) },
    features: [{ op: "interfaces" }, { op: "deburr", id: "ebavurage" }],
    notes: [`Plis à 90° ± 1°, rayon intérieur ${fr(r)} mm ; sens du laminage en travers des plis si possible`, "Développé indicatif (facteur k 0,44, valeur typique) : l'atelier applique ses propres pertes au pli", "Casser les angles vifs 0,2 à 0,5 mm"],
    interfaces };
}

/** The sheet of the process for an AI : what the press brake asks, the block of the language, the instruction. */
export function foldBrief() {
  return ["Voici ce que la TÔLERIE PLIÉE demande au dessin, tel que la plateforme DesignOrbit.ai l'applique (règles SM-01 à SM-08, bloc « folded » du langage de pièce).",
    "Quand tu proposes ou modifies une pièce pliée (process « sheet_metal », bloc « folded »), respecte ces limites : un seul rayon intérieur, des bords assez hauts, des trous loin des plis et des bords, des dégagements aux angles. Dis ce que tu n'as pas pu respecter.",
    "Valeurs typiques de guides publiés : la table de pliage de l'atelier fait foi.", "", ...FOLD_RULES.chips.map(([text, tip]) => `- ${text}${tip ? ` — ${tip}` : ""}`), "", ...FOLD_RULES.notes.map((x) => `- ${x}`), "",
    "Le bloc de la pièce : \"folded\": { \"base\": [\"L\", \"W\"], \"t\": \"t\", \"r\": \"r\", \"flanges\": [ { \"side\": \"+X\", \"h\": \"h\", \"dir\": \"up\" } ], \"relief\": 3.5, \"k\": 0.44 } — sans « stock » : le flan est le développé, calculé par la plateforme.",
    `D'où viennent ces valeurs : ${FOLD_RULES.basis}`].join("\n");
}
