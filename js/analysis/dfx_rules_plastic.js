/* DesignWizard.ai — DFM rules: injection moulding (MLD-) and 3D-printed parts, FDM and MJF / SLS (HSG-, AM-), carried
   over from the user's rule book and made generic. Wall limits of moulding come from materials.js (`wall`); printing
   limits are typical process data (industrial FDM, HP MJF PA12) — the data sheet of the printer actually used prevails. */

import { FACES } from "../cad/vec.js";
import { rule, num, round, groupBy } from "./dfx_core.js";
import { checkBossRatio } from "./dfx_rules_general.js";
import { AM_PROCESSES } from "../cad/special_processes.js";

const S = {
  wall: "Malloy — Plastic Part Design for Injection Molding ; Covestro part design guide", pl: "Protolabs — injection molding design guidelines",
  cov: "Covestro (Bayer) — Engineering Plastics part design guide", bd: "Boothroyd-Dewhurst — Product Design for Manufacture and Assembly", ul: "UL 94, fiche matière du fournisseur",
  thumb: "Règle de pouce (rule of thumb), à confirmer avec le mouliste", proc: "Fiches process (Stratasys FDM, HP Multi Jet Fusion design guide)",
  ge: "eFunda ; Stratasys Direct ; GE Plastics design guide", rm: "Rapidmade MJF design guide",
};
const M = {
  m01: rule("MLD-01", "Paroi dans la plage matière", "Entre le mini et le maxi de la matière (ex. ABS 1,2 à 3,5 mm)", "error", "Trop mince : la pièce ne se remplit pas ; trop épais : sink marks (retassures), vides, cycle long.", S.wall, { fix: true }),
  m02: rule("MLD-02", "Draft", "≥ 0,5° (1° conseillé), + 1° par 0,025 mm de grain", "info", "Sans draft la pièce frotte et se marque à l'éjection.", S.pl, { manual: true }),
  m03: rule("MLD-03", "Bossages", "Ø extérieur du bossage ≥ 2 × Ø du trou", "warn", "Un bossage trop mince éclate au vissage ou à la pose de l'insert.", S.cov, { fix: true }),
  m04: rule("MLD-04", "Rayons intérieurs", "Rayon intérieur ≥ 0,5 × paroi", "warn", "Un angle vif concentre les contraintes et gêne l'écoulement.", S.cov, { fix: true }),
  m05: rule("MLD-05", "UL94 à l'épaisseur réelle", "La classe de flamme (V-0…) n'est valable qu'à partir de l'épaisseur testée", "info", "Un boîtier électrique doit tenir sa classe à sa paroi la plus mince.", S.ul),
  m06: rule("MLD-06", "Longueur d'écoulement", "Longueur d'écoulement / paroi ≤ 150:1", "warn", "Au-delà, le front de matière fige avant de remplir (short shot).", S.thumb),
  m07: rule("MLD-07", "Undercuts (side actions)", "Aucune ouverture sur les faces latérales si possible", "info", "Chaque ouverture latérale demande un slide : coût et entretien du mold.", S.bd),
  m08: rule("MLD-08", "Parois uniformes", "Épaisseurs dans un rapport ≤ 1,5:1 (transition progressive, ≤ 1,25 entre parois voisines)", "warn", "Retassures, vides et gauchissement aux changements d'épaisseur.", S.wall),
  m10: rule("MLD-10", "Core pins", "Trou borgne : profondeur ≤ 3 × Ø ; trou débouchant : ≤ 6 × Ø", "warn", "Un core pin long et fin fléchit sous la pression d'injection.", S.thumb),
  m11: rule("MLD-11", "Clips élastiques", "Déformation de la lame ε = 1,5 × épaisseur × flèche / longueur² ≤ 2 % (1 % pour une matière chargée de fibres)", "warn", "Au-delà la lame blanchit, se déforme pour de bon ou casse au premier encliquetage.", S.thumb),
};
const H = {
  h01: rule("HSG-01", "Paroi au-dessus du minimum du process", "FDM ≥ 1,0 mm ; MJF PA12 ≥ 0,9 mm ; SLA ≥ 0,6 mm", "error", "Trous et casse dans la pièce imprimée.", S.proc, { fix: true }),
  h02: rule("HSG-02", "Classe de flamme", "PEI ULTEM 9085 : résultats UL94 V-0 à 1,5 mm → paroi ≥ 1,5 mm ; PA12 (MJF) et ABS : UL94 HB seulement", "warn", "Comportement au feu non démontré sous l'épaisseur testée.", "Stratasys ULTEM 9085 ; UL 94", { fix: true }),
  h04: rule("HSG-04", "Jeu avec le contenu / ajustements", "Jeu ≥ tolérance du process + 0,2 mm ; un ajustement ISO n'est pas tenu brut d'impression", "info", "Le contenu peut ne pas rentrer.", S.proc),
  h05: rule("HSG-05", "Tient dans la machine", "Pièce dans le volume d'impression (FDM 914 × 610 × 914 mm ; MJF 380 × 284 × 380 mm ; SLA 145 × 145 × 185 mm)", "error", "Ne s'imprime pas en une pièce.", "Données machine"),
  h07: rule("HSG-07", "Bossages", "Ø extérieur ≈ 2 à 2,5 × Ø du trou d'insert", "warn", "Le trou débouche ou le bossage éclate à la pose de l'insert.", S.rm, { fix: true }),
  h08: rule("HSG-08", "Trous", "Ø ≥ minimum du process (FDM 1,5 mm ; MJF 1,0 mm ; SLA 0,5 mm)", "warn", "Un petit trou se referme à l'impression.", S.proc, { fix: true }),
  h10: rule("HSG-10", "Orientation et supports", "FDM : surplombs > 45° et trous horizontaux > Ø6 demandent des supports", "info", "Les supports marquent les surfaces et coûtent du temps.", S.proc),
  h12: rule("HSG-12", "Jeu d'assemblage", "Jeu ≥ jeu d'assemblage du process par côté (FDM 0,3 mm ; MJF 0,2 mm ; SLA 0,2 mm)", "warn", "Les pièces ne s'emboîtent pas.", "HP MJF design guide (0,4 mm entre pièces assemblées)", { fix: true }),
  h13: rule("HSG-13", "Angles intérieurs arrondis", "R intérieur ≥ 0,5 × paroi (erreur sous 0,25 × paroi)", "warn", "Sous R/T = 0,5 la concentration de contraintes est forte : les fissures partent des angles vifs.", S.ge, { fix: true }),
  h14: rule("HSG-14", "Congé imprimable", "R ≥ minimum machine (FDM 1,0 mm ; MJF et SLA 0,5 mm)", "warn", "Un rayon plus petit s'imprime en marches.", S.rm, { fix: true }),
  a02: rule("AM-02", "Sections massives (MJF)", "Épaisseur ≤ 10 mm : évider au-delà", "info", "Accumulation de chaleur, retrait et coût de poudre.", "HP MJF design guide"),
};
export const BOOK_PLASTIC = [
  { process: "injection_molding", category: "DFM", steps: ["Parois uniformes dans la plage de la matière", "Draft sur toutes les parois parallèles au pull", "Nervures et bossages : 40 à 60 % de la paroi, bossage Ø ≥ 2 × trou",
    "Rayons intérieurs ≥ 0,5 × paroi", "Pas d'ouverture latérale (slides) si possible", "Classe de flamme à l'épaisseur réelle"], rules: [M.m01, M.m08, M.m02, M.m03, M.m04, M.m05, M.m06, M.m07, M.m10, M.m11] },
  { process: "fdm", category: "DFM", steps: ["Blocs de ce qui entre dans la pièce, du bas vers le haut", "Paroi ≥ minimum du process (≥ 1,5 mm pour la tenue au feu)", "Orienter pour limiter les supports", "Bossages hors de la cavité, inserts à chaud",
    "Jeux d'assemblage ≥ 0,3 mm par côté"], rules: [H.h01, H.h02, H.h04, H.h05, H.h07, H.h08, H.h10, H.h12, H.h13, H.h14] },
  { process: "mjf", category: "DFM", steps: ["Paroi ≥ 0,9 mm, sections ≤ 10 mm (évider)", "Trous ≥ Ø1, prévoir le dépoudrage des cavités", "Jeux d'assemblage ≥ 0,2 mm par côté", "Rayons intérieurs ≥ 0,5 × paroi", "PA12 : UL94 HB seulement"],
    rules: [H.h01, H.h02, H.h04, H.h05, H.h07, H.h08, H.h12, H.h13, H.h14, H.a02] },
  { process: "sla", category: "DFM", steps: ["Paroi ≥ 0,6 mm, 1 mm conseillé", "Incliner la pièce : les supports hors des faces vues", "Une pièce creuse laisse couler la résine : ouverture en point bas", "Post-cuire aux UV avant de mesurer ou de charger",
    "Résine : pas de pièce de structure durable"], rules: [H.h01, H.h02, H.h04, H.h05, H.h07, H.h08, H.h12, H.h13, H.h14] },
];
/* printing limits : one source, cad/special_processes.js */
const PRINT = Object.fromEntries(Object.entries(AM_PROCESSES).map(([k, p]) => [k, { name: p.short, wallMin: p.wall, filMin: p.fillet, holeMin: p.hole, gap: p.gap, build: p.build }]));
const isElectrical = (ctx) => !!ctx.spec.elec || ctx.spec.family === "enclosure" || (ctx.built.interfaces || []).some((i) => i.type === "cutout" || i.type === "rail");
const minShell = (ctx) => (ctx.facts.shells.length ? Math.min(...ctx.facts.shells.map((s) => s.t)) : null);
const holeLabel = (g) => `Trou Ø${num(g[0].d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${g[0].source} »`;

/* Inside radii of a hollow part against its wall: a fillet made BEFORE the shell leaves r − t inside, one made after leaves r. */
export function insideRadii(ctx, id, errBelow) {
  const { facts } = ctx, t = minShell(ctx);
  if (!(t > 0)) return;
  const shellAt = Math.min(...facts.shells.map((s) => ctx.featureIndex(s.source)).filter((i) => i >= 0), Infinity);
  if (!facts.fillets.length) {
    ctx.add(id, { severity: "warn", value: 0, limit: round(0.5 * t), unit: "mm", feature: facts.shells[0].source,
      message: `Pièce creuse (paroi ${num(t)} mm) sans aucun congé : les angles intérieurs sont vifs (R0). Limite : R intérieur ≥ 0,5 × paroi = ${num(0.5 * t)} mm. Correctif : ajouter un « fillet » de R${num(1.5 * t)} sur les arêtes verticales avant le « shell » (il laisse R${num(0.5 * t)} à l'intérieur).` });
    return;
  }
  for (const f of facts.fillets) {
    const i = ctx.featureIndex(f.source), before = i >= 0 && i < shellAt, inner = before ? f.size - t : f.size, need = before ? 1.5 * t : 0.5 * t;
    if (inner >= 0.5 * t - 1e-6) continue;
    const to = Math.ceil(need * 10 - 1e-9) / 10;
    ctx.add(id, { severity: errBelow && inner < errBelow * t ? "error" : "warn", value: round(Math.max(inner, 0)), limit: round(0.5 * t), unit: "mm", feature: f.source,
      message: `Congé « ${f.source} » R${num(f.size)}${before ? ` fait avant le shell : il ne laisse que R${num(Math.max(inner, 0))} à l'intérieur` : ""} pour une paroi de ${num(t)} mm. Limite : R intérieur ≥ 0,5 × paroi = ${num(0.5 * t)} mm. Correctif : passer le congé à R${num(to)}.`,
      fix: ctx.fix(`Passer le congé à R${num(to)}`, ctx.patch(f, "r", to)) });
  }
}

export function checkMolding(ctx) {
  const { facts, dims } = ctx, lim = (ctx.mat && ctx.mat.wall) || [1.0, 4.0], name = (ctx.mat && ctx.mat.name) || "plastique (plage générique)", t = minShell(ctx);
  ctx.run("MLD-01", () => {
    ctx.checkWalls("MLD-01", { rec: lim[0], min: lim[0], what: `de moulage pour ${name}` });
    for (const s of facts.shells) if (s.t > lim[1] + 1e-6) ctx.add("MLD-01", { severity: "warn", value: s.t, limit: lim[1], unit: "mm", feature: s.source,
      message: `Paroi (shell « ${s.source} ») de ${num(s.t)} mm : au-dessus du maximum de moulage pour ${name} (${num(lim[1])} mm) — sink marks, vides, cycle long. Correctif : ramener la paroi à ${num(lim[1])} mm et rigidifier par des nervures.`,
      fix: ctx.fix(`Ramener la paroi à ${num(lim[1])} mm`, ctx.patch(s, "t", lim[1])) });
    const w = ctx.wall(), solid = !facts.shells.length ? (w ? w.median : dims ? Math.min(...dims) : null) : null;
    if (solid > lim[1] + 1e-6) ctx.add("MLD-01", { severity: "warn", value: round(solid), limit: lim[1], unit: "mm",
      message: `Pièce massive : épaisseur ${w ? "médiane" : "mini de l'enveloppe"} de ${num(solid)} mm, au-dessus du maximum de moulage pour ${name} (${num(lim[1])} mm). Correctif : évider la pièce (« shell » ou pockets) pour garder des parois de ${num(lim[0])} à ${num(lim[1])} mm.` });
  });
  ctx.run("MLD-08", () => {
    const w = ctx.wall();
    if (!w || !(w.p10 > 0) || w.p10 > lim[1]) return;           // massive part: already reported by MLD-01
    const ratio = w.p90 / w.median;                              // against the wall itself : a rib or a lip at half the wall is thin on purpose, a mass is not
    if (ratio > 1.5 + 1e-6) ctx.add("MLD-08", { value: round(ratio), limit: 1.5, unit: ": 1", where: w.at,
      message: `Épaisseurs non uniformes : des zones de ${num(w.p90)} mm (10 % les plus épaisses) pour une paroi de ${num(w.median)} mm, soit ${num(ratio, 1)}:1. Limite : 1,5:1. Correctif : évider les zones épaisses (core-out) et raccorder les épaisseurs progressivement.` });
  });
  ctx.run("MLD-02", () => {
    if (!dims) return;
    const pull = facts.shells.length && FACES[facts.shells[0].open && facts.shells[0].open[0]] ? FACES[facts.shells[0].open[0]].axis : 2, Hh = dims[pull];
    const made = (facts.drafts || []).length ? Math.min(...facts.drafts.map((d) => d.angle)) : 0;
    if (made > 0) { ctx.add("MLD-02", { severity: made < 0.5 - 1e-9 ? "warn" : "info", value: made, limit: 0.5, unit: "°", feature: facts.drafts[0].source,
      message: `Draft modélisé : ${num(made)}° (${facts.drafts.map((d) => d.what).filter((v, i, all) => v && all.indexOf(v) === i).join(", ") || "corps"}) ; les bossages et nervures qui portent « draft » penchent aussi. Limite : ≥ 0,5° (1° conseillé, + 1° par 0,025 mm de grain) ; sur ${num(Hh)} mm de démoulage, ${num(made)}° représentent ${num(Hh * Math.tan(made * Math.PI / 180))} mm par face, déjà dans le modèle.${made < 0.5 - 1e-9 ? " Correctif : porter le draft à 1°." : ""}` }); return; }
    ctx.add("MLD-02", { value: 0, limit: 0.5, unit: "°",
      message: `Draft : le modèle reste droit (0° modélisé). Limite : ≥ 0,5° (1° conseillé, + 1° par 0,025 mm de grain) ; sur ${num(Hh)} mm de hauteur de démoulage, 1° représente ${num(Hh * Math.tan(Math.PI / 180))} mm par face. Correctif : porter la dépouille au plan et en tenir compte dans les jeux.` });
  });
  ctx.run("MLD-03", () => checkBossRatio(ctx, "MLD-03"));
  ctx.run("MLD-04", () => insideRadii(ctx, "MLD-04", null));
  ctx.run("MLD-05", () => {
    if (!isElectrical(ctx)) return;
    const w = ctx.wall(), thin = Math.min(t ?? Infinity, w ? w.min : Infinity);
    ctx.add("MLD-05", { value: Number.isFinite(thin) ? round(thin) : null, limit: (ctx.mat && ctx.mat.ul94) || "?", unit: "mm",
      message: `Boîtier électrique en ${name} : classe UL94 « ${(ctx.mat && ctx.mat.ul94) || "inconnue"} » ; la classe n'est valable qu'à partir de l'épaisseur testée${Number.isFinite(thin) ? ` (paroi la plus mince ici : ${num(thin)} mm)` : ""}. Correctif : choisir un grade classé V-0 à cette épaisseur, ou épaissir la paroi jusqu'à l'épaisseur classée.` });
  });
  ctx.run("MLD-06", () => {
    const w = ctx.wall(), wallT = t ?? (w ? w.median : null);
    if (!(wallT > 0) || !dims) return;
    const flow = Math.hypot(...dims) / 2, ratio = flow / wallT;
    if (ratio > 150) ctx.add("MLD-06", { value: round(ratio, 0), limit: 150, unit: ": 1",
      message: `Longueur d'écoulement ≈ ${num(flow, 0)} mm (demi-diagonale, seuil central) pour une paroi de ${num(wallT)} mm, soit ${num(ratio, 0)}:1. Limite : 150:1. Correctif : épaissir la paroi à ${num(Math.ceil(flow / 150 * 10) / 10)} mm, ajouter des seuils d'injection ou réduire la pièce.` });
  });
  ctx.run("MLD-07", () => {
    const pull = facts.shells.length && FACES[facts.shells[0].open && facts.shells[0].open[0]] ? FACES[facts.shells[0].open[0]].axis : 2;
    const side = new Set();
    for (const x of [...facts.holes, ...facts.pockets]) if (x.face && FACES[x.face] && FACES[x.face].axis !== pull) side.add(x.face);
    if (side.size) ctx.add("MLD-07", { severity: side.size >= 3 ? "warn" : "info", value: side.size, limit: 0, unit: "faces latérales",
      message: `Ouvertures ou trous sur ${side.size} face(s) latérale(s) (${[...side].sort().join(", ")}), perpendiculaires au pull (axe ${"XYZ"[pull]}) : chaque face demande un slide (side action) ; limite conseillée : 0. Correctif : déplacer ces ouvertures sur la face de démoulage, les ouvrir jusqu'au parting line (encoche en U), ou accepter le coût du tiroir.` });
  });
  ctx.run("MLD-11", () => {
    const c = ctx.spec.mold && ctx.spec.mold.clips; if (!c || !(c.lb > 0)) return;
    const strain = 1.5 * c.t * c.y / (c.lb * c.lb), limit = c.limit || 0.02, over = strain > limit + 1e-9, need = Math.ceil(Math.sqrt(1.5 * c.t * c.y / limit) * 2) / 2;
    ctx.add("MLD-11", { severity: over ? "warn" : "info", value: round(100 * strain), limit: round(100 * limit), unit: "%",
      message: `Clips : lame de ${num(c.t)} mm d'épaisseur, ${num(c.lb)} mm de long, flèche de ${num(c.y)} mm → déformation ${num(100 * strain, 1)} % pour ${num(100 * limit, 1)} % admis.${over ? ` Correctif : allonger la lame à ${num(need)} mm, l'amincir ou réduire le crochet.` : ""}` });
  });
  ctx.run("MLD-10", () => {
    for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}|${h.depth}`)) {
      const h = g[0], k = h.through ? 6 : 3, depth = h.through ? (ctx.hollow ? t : null) : h.depth;
      if (!(depth > 0) || !(h.d > 0) || depth <= k * h.d + 1e-6) continue;
      ctx.add("MLD-10", { value: round(depth / h.d), limit: k, unit: "× Ø", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)} ${h.through ? "débouchant" : "borgne"} : profondeur ${num(depth)} mm = ${num(depth / h.d, 1)} × Ø. Limite : ${k} × Ø (${num(k * h.d)} mm), sinon le core pin fléchit. Correctif : réduire la profondeur à ${num(k * h.d)} mm ou augmenter le Ø.` });
    }
  });
}

export function checkPrinting(ctx) {
  const { facts, dims } = ctx, P = PRINT[ctx.process] || PRINT.fdm, t = minShell(ctx), id = String(ctx.spec.material || "").toUpperCase();
  ctx.run("HSG-01", () => ctx.checkWalls("HSG-01", { rec: P.wallMin, min: P.wallMin, what: `d'impression ${P.name}` }));
  ctx.run("HSG-02", () => {
    if (/PEI|ULTEM/.test(id)) {
      for (const s of facts.shells) if (s.t >= P.wallMin - 1e-6 && s.t < 1.5 - 1e-6) ctx.add("HSG-02", { value: s.t, limit: 1.5, unit: "mm", feature: s.source,
        message: `Paroi (shell « ${s.source} ») de ${num(s.t)} mm en PEI ULTEM 9085 : les résultats UL94 V-0 sont donnés à 1,5 mm. Limite : ≥ 1,5 mm pour revendiquer la tenue au feu. Correctif : passer la paroi à 1,5 mm.`,
        fix: ctx.fix("Passer la paroi à 1,5 mm (UL94 V-0)", ctx.patch(s, "t", 1.5)) });
    } else if (isElectrical(ctx) && ctx.mat && /HB/.test(ctx.mat.ul94 || "")) {
      ctx.add("HSG-02", { severity: "info", value: ctx.mat.ul94, limit: "V-0",
        message: `Boîtier électrique en ${ctx.mat.name} : matière classée UL94 ${ctx.mat.ul94} seulement (limite visée pour un boîtier électrique : V-0). Correctif : si une tenue au feu est exigée, passer en PEI ULTEM 9085 (FDM, V-0 à 1,5 mm) ou en matière moulée V-0.` });
    }
  });
  ctx.run("HSG-05", () => {
    if (!dims) return;
    const d = dims.slice().sort((a, b) => b - a), bv = P.build.slice().sort((a, b) => b - a);
    if (d.some((v, i) => v > bv[i] + 1e-6)) ctx.add("HSG-05", { value: d.map((v) => num(v, 0)).join(" × "), limit: P.build.join(" × "), unit: "mm",
      message: `La pièce (${d.map((v) => num(v, 0)).join(" × ")} mm) ne tient pas dans le volume d'impression ${P.name} (${P.build.join(" × ")} mm). Correctif : découper la pièce en deux parties assemblées ou changer de process.` });
  });
  ctx.run("HSG-07", () => checkBossRatio(ctx, "HSG-07"));
  ctx.run("HSG-08", () => {
    for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}`)) {
      const h = g[0];
      if (!(h.d > 0) || h.d >= P.holeMin - 1e-6) continue;
      const f = ctx.feature(h.source);
      ctx.add("HSG-08", { value: h.d, limit: P.holeMin, unit: "mm", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)} : sous le Ø minimum imprimable en ${P.name} (${num(P.holeMin)} mm), il se referme à l'impression. Correctif : passer à Ø${num(P.holeMin)} ou percer en reprise.`,
        fix: f && f.op === "hole" && !h.thread ? ctx.fix(`Passer à Ø${num(P.holeMin)}`, ctx.patch(h, "d", P.holeMin)) : null });
    }
  });
  ctx.run("HSG-10", () => {
    if (ctx.process !== "fdm" || (ctx.geo && ctx.geo.mesh)) return;      // with the mesh of the part, AM-13 measures the supports instead of guessing them
    const items = [...groupBy(facts.holes.filter((h) => h.axis && Math.abs(h.axis[2]) < 0.5 && h.d > 6), (h) => h.source).map((g) => `trou horizontal Ø${num(g[0].d)} « ${g[0].source} »`),
      ...facts.pockets.filter((p) => p.face && FACES[p.face] && FACES[p.face].axis !== 2 && Math.min(p.w, p.h) > AM_PROCESSES.fdm.bridge).map((p) => `ouverture latérale « ${p.source} »`),
      ...[...facts.holes, ...facts.pockets, ...facts.bosses].filter((x) => x.face === "-Z" && !x.through).slice(0, 1).map(() => "features sur la face du dessous (−Z)")];
    if (items.length) ctx.add("HSG-10", { value: items.length, limit: 0, unit: "zones à supports",
      message: `Impression FDM, pièce orientée Z vers le haut : ${items.slice(0, 4).join(", ")}${items.length > 4 ? "…" : ""} demandent des supports (limite : surplomb à 45° du plateau au moins, pont ≤ ${num(AM_PROCESSES.fdm.bridge)} mm, trou horizontal ≤ Ø6). Correctif : dessiner les trous horizontaux en goutte d'eau (teardrop), chanfreiner les surplombs à 45° ou réorienter la pièce.` });
  });
  ctx.run("HSG-12", () => {
    for (const it of ctx.built.interfaces || []) {
      if (it.type !== "rail" || it.side !== "B") continue;
      const c = (it.opts && it.opts.clearance) ?? 0.2;
      if (c < P.gap - 1e-6) ctx.add("HSG-12", { value: c, limit: P.gap, unit: "mm", where: it.frame && it.frame.o, iface: it.id,
        message: `Glissière « ${it.id} » : jeu de ${num(c)} mm par côté, sous le jeu d'assemblage ${P.name} (${num(P.gap)} mm). Correctif : passer le jeu à ${num(P.gap)} mm.`,
        fix: ctx.fix(`Passer le jeu à ${num(P.gap)} mm`, { target: "interface", id: it.id, path: "opts.clearance", value: P.gap }) });
    }
  });
  ctx.run("HSG-04", () => {
    for (const it of ctx.built.interfaces || []) if (it.type === "fit") ctx.add("HSG-04", { value: (it.params && it.params.fit) || "H7/g6", limit: `jeu ≥ ${num(P.gap)} mm`, where: it.frame && it.frame.o, iface: it.id,
      message: `Ajustement « ${it.id} » ${(it.params && it.params.fit) || "H7/g6"} sur une pièce imprimée ${P.name} : la précision brute (≈ ± 0,2 à 0,3 mm) ne tient pas un ajustement ISO ; limite : jeu ≥ ${num(P.gap)} mm par côté brut d'impression. Correctif : prévoir une reprise (alésage) ou une bague rapportée.` });
  });
  ctx.run("HSG-13", () => insideRadii(ctx, "HSG-13", 0.25));
  ctx.run("HSG-14", () => {
    for (const f of facts.fillets) if (f.size < P.filMin - 1e-6) ctx.add("HSG-14", { value: f.size, limit: P.filMin, unit: "mm", feature: f.source,
      message: `Congé « ${f.source} » R${num(f.size)} : sous le rayon minimum imprimable en ${P.name} (R${num(P.filMin)}), il sort en marches. Correctif : passer à R${num(P.filMin)}.`,
      fix: ctx.fix(`Passer à R${num(P.filMin)}`, ctx.patch(f, "r", P.filMin)) });
  });
  ctx.run("AM-02", () => {
    if (ctx.process !== "mjf" || ctx.hollow) return;
    const w = ctx.wall(), solid = w ? w.median : dims ? Math.min(...dims) : null;
    if (solid > 10 + 1e-6) ctx.add("AM-02", { value: round(solid), limit: 10, unit: "mm",
      message: `Section massive de ${num(solid)} mm en MJF. Limite conseillée : ≤ 10 mm (chaleur, retrait, coût de poudre). Correctif : évider la pièce (« shell » de 2 à 3 mm) et prévoir deux trous de dépoudrage ≥ Ø5.` });
  });
}
