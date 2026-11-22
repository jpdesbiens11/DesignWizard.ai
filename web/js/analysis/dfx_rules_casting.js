/* DynamiteOrbit — DFM rules: metal casting — high pressure die casting, low pressure die casting, permanent mold and
   sand casting (CST-). Wall limits come from the alloy (materials.js `wall`), or from the process when it has its own ; the other figures are the usual ones of foundry design guides — the
   foundry's own advice prevails. A cast part is a near-net shape : threads, bores and seating faces are machined
   afterwards, and the rules say so. */

import { FACES } from "../cad/vec.js";
import { rule, num, round, groupBy } from "./dfx_core.js";
import { checkBossRatio } from "./dfx_rules_general.js";
import { insideRadii } from "./dfx_rules_plastic.js";

const S = { nadca: "NADCA — Product Specification Standards for Die Castings", afs: "AFS — Casting design guides ; ISO 8062-3", bd: "Boothroyd-Dewhurst — Product Design for Manufacture and Assembly", thumb: "Règle de pouce de fondeur, à confirmer avec la fonderie" };
const C = {
  c01: rule("CST-01", "Paroi dans la plage de l'alliage", "Entre le mini et le maxi de l'alliage (A380 sous pression : 1,5 à 4,5 mm)", "error", "Trop mince : le métal fige avant de remplir ; trop épais : porosité et shrinkage (retassures) au cœur.", S.nadca, { fix: true }),
  c02: rule("CST-02", "Draft", "≥ 1° à l'extérieur, ≥ 2° sur les cores (gravité et low pressure : 2° et 3°)", "info", "Sans draft la pièce grippe dans le mold et se marque à l'éjection.", S.nadca),
  c03: rule("CST-03", "Rayons intérieurs", "Rayon intérieur ≥ 0,5 × paroi", "warn", "Un angle vif crée un point chaud, une fissure à chaud et use le moule.", S.afs, { fix: true }),
  c04: rule("CST-04", "Bossages", "Ø extérieur du bossage ≥ 2 × Ø du trou", "warn", "Un bossage trop mince autour d'un taraudage casse au serrage.", S.thumb),
  c05: rule("CST-05", "Reprises d'usinage", "Taraudages, alésages et plans d'appui usinés après coulée", "info", "Un filetage ne vient pas de fonderie ; une face brute n'est ni plane ni étanche.", S.bd),
  c06: rule("CST-06", "Trous venus de fonderie", "Ø ≥ 3 mm ; profondeur ≤ 3 × Ø (borgne), ≤ 6 × Ø (débouchant)", "warn", "Un core pin fin et long fléchit, chauffe et casse dans le mold.", S.nadca),
  c07: rule("CST-07", "Sections massives", "Épaisseur locale ≤ 2 × paroi", "warn", "Une masse se solidifie en dernier : porosité de retrait exactement là où l'on taraude.", S.afs),
  c08: rule("CST-08", "Side openings (slides)", "Aucune ouverture perpendiculaire au pull si possible", "info", "Chaque ouverture latérale demande un slide (un core en sand casting) : coût et usure du mold.", S.nadca),
};
export const BOOK_CASTING = [
  { process: "die_casting", category: "DFM", steps: ["Parois uniformes dans la plage de l'alliage", "Draft partout dans le sens du pull", "Rayons à tous les angles intérieurs", "Bossages reliés par des nervures, jamais noyés dans une masse", "Filetages et faces fonctionnelles repris en usinage"],
    rules: [C.c01, C.c02, C.c03, C.c04, C.c05, C.c06, C.c07, C.c08] },
  { process: "lp_die_casting", category: "DFM", steps: ["Parois régulières, 3 mm et plus, qui s'épaississent vers le gate du bas", "Draft 2° à l'extérieur, 3° sur les cores", "Gate au point bas, risers en haut sur les masses isolées", "Surépaisseurs d'usinage sur tout ce qui est fonctionnel"], rules: [C.c01, C.c02, C.c03, C.c04, C.c05, C.c07, C.c08] },
  { process: "permanent_mold", category: "DFM", steps: ["Parois épaisses et régulières (4 mm et plus)", "Draft 2° à l'extérieur, 3° sur les cores", "Gate au parting line, risers en haut sur les masses", "Surépaisseurs d'usinage sur tout ce qui est fonctionnel"], rules: [C.c01, C.c02, C.c03, C.c04, C.c05, C.c07, C.c08] },
  { process: "sand_casting", category: "DFM", steps: ["Parois épaisses et régulières (4 mm et plus)", "Draft 2° à l'extérieur, 3° sur les cores", "Grands rayons", "Surépaisseurs d'usinage sur tout ce qui est fonctionnel"], rules: [C.c01, C.c02, C.c03, C.c04, C.c05, C.c07] },
];

const OWN_WALL = { lp_die_casting: [3, 10] };      // a process that has its own wall range, whatever the alloy says for gravity (core/shop_mold.js)
export function checkCasting(ctx) {
  const { facts, dims } = ctx, gravity = ctx.process !== "die_casting", lim = OWN_WALL[ctx.process] || (ctx.mat && ctx.mat.wall) || (gravity ? [4, 12] : [1.5, 4.5]), name = (ctx.mat && ctx.mat.name) || "l'alliage", t = facts.shells.length ? Math.min(...facts.shells.map((s) => s.t)) : null;
  ctx.run("CST-01", () => {
    /* the ring left round a hole drilled and tapped after casting is not a cast wall : the boss is poured solid */
    const cut = facts.holes.filter((h) => (h.thread || h.fit) && Array.isArray(h.at)), machined = (q) => cut.some((h) => { const ax = FACES[h.face] ? FACES[h.face].axis : 2; return Math.hypot(q[(ax + 1) % 3] - h.at[(ax + 1) % 3], q[(ax + 2) % 3] - h.at[(ax + 2) % 3]) <= h.d / 2 + lim[0] + 0.2; });
    ctx.checkWalls("CST-01", { rec: lim[0], min: lim[0], what: `de fonderie pour ${name}`, ignore: machined });
    for (const s of facts.shells) if (s.t > lim[1] + 1e-6) ctx.add("CST-01", { severity: "warn", value: s.t, limit: lim[1], unit: "mm", feature: s.source,
      message: `Paroi (« ${s.source} ») de ${num(s.t)} mm : au-dessus du maximum pour ${name} (${num(lim[1])} mm) — porosité au cœur, cycle long. Correctif : ramener la paroi à ${num(lim[1])} mm et raidir par des nervures.`, fix: ctx.fix(`Ramener la paroi à ${num(lim[1])} mm`, ctx.patch(s, "t", lim[1])) });
  });
  ctx.run("CST-02", () => {
    if (!dims) return;
    const m = ctx.spec.mold || {}, out = m.draft || (gravity ? 2 : 1), inn = m.draft_inside || (gravity ? 3 : 2), pull = facts.shells.length && FACES[facts.shells[0].open && facts.shells[0].open[0]] ? FACES[facts.shells[0].open[0]].axis : 2, Hh = dims[pull];
    const made = (facts.drafts || []).length ? Math.min(...facts.drafts.map((d) => d.angle)) : 0;
    if (made > 0) { ctx.add("CST-02", { severity: made < inn - 1e-9 ? "warn" : "info", value: made, limit: inn, unit: "°", feature: facts.drafts[0].source,
      message: `Draft modélisé : ${num(made)}° sur les parois, dehors comme sur les cores (une seule paroi, un seul angle). Limite : ${num(out)}° à l'extérieur, ${num(inn)}° sur les cores ; sur ${num(Hh)} mm de démoulage, ${num(made)}° représentent ${num(Hh * Math.tan(made * Math.PI / 180))} mm par face, déjà dans le modèle.${made < inn - 1e-9 ? ` Correctif : porter le draft à ${num(inn)}°.` : ""}` }); return; }
    ctx.add("CST-02", { value: 0, limit: out, unit: "°", message: `Draft : le modèle reste droit (0°). À porter au mold : ${num(out)}° à l'extérieur, ${num(inn)}° sur les cores ; sur ${num(Hh)} mm de démoulage, ${num(inn)}° représentent ${num(Hh * Math.tan(inn * Math.PI / 180))} mm par face — à compter dans les jeux.` });
  });
  ctx.run("CST-03", () => insideRadii(ctx, "CST-03", null));
  ctx.run("CST-04", () => checkBossRatio(ctx, "CST-04"));
  ctx.run("CST-05", () => {
    const taps = facts.holes.filter((h) => h.thread), fits = facts.holes.filter((h) => h.fit), seats = (ctx.built.interfaces || []).filter((i) => i.type === "planar"), skim = (ctx.spec.mold && ctx.spec.mold.machined) || (gravity ? 2.5 : 0.5);
    if (taps.length || fits.length || seats.length) ctx.add("CST-05", { value: taps.length + fits.length + seats.length, limit: null, unit: "reprises",
      message: `À reprendre en usinage après coulée : ${[taps.length ? `${taps.length} taraudage(s)` : null, fits.length ? `${fits.length} alésage(s) ajusté(s)` : null, seats.length ? `${seats.length} plan(s) d'appui` : null].filter(Boolean).join(", ")}. Prévoir ${num(skim)} mm de surépaisseur sur ces faces et un posage commun pour les usiner.` });
  });
  ctx.run("CST-06", () => {
    if (gravity) return;
    for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}|${h.depth}`)) {
      const h = g[0], k = h.through ? 6 : 3, depth = h.through ? (ctx.hollow ? t : null) : h.depth, label = `Trou Ø${num(h.d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${h.source} »`;
      if (h.d > 0 && h.d < 3 - 1e-6 && !h.thread) ctx.add("CST-06", { value: h.d, limit: 3, unit: "mm", where: h.at, feature: h.source, iface: h.iface, message: `${label} : trop petit pour venir de fonderie (core pin de moins de 3 mm). Correctif : le percer en reprise, ou passer à Ø3.` });
      else if (depth > 0 && h.d > 0 && depth > k * h.d + 1e-6 && !h.thread) ctx.add("CST-06", { value: round(depth / h.d), limit: k, unit: "× Ø", where: h.at, feature: h.source, iface: h.iface, message: `${label} : profondeur de ${num(depth)} mm, soit ${num(depth / h.d, 1)} × Ø. Limite : ${k} × Ø pour un core pin. Correctif : le percer en reprise ou le raccourcir.` });
    }
  });
  ctx.run("CST-07", () => {
    const w = ctx.wall(); if (!w || !(t > 0) || !(w.p90 > 0)) return;
    if (w.p90 > 2 * t + 1e-6) ctx.add("CST-07", { value: round(w.p90), limit: round(2 * t), unit: "mm", where: w.at, message: `Zones de ${num(w.p90)} mm d'épaisseur pour une paroi de ${num(t)} mm (plus de 2 fois) : elles figent en dernier et gardent la porosité. Correctif : évider ces masses, détacher les bossages des parois et les relier par des nervures.` });
  });
  ctx.run("CST-08", () => {
    const pull = facts.shells.length && FACES[facts.shells[0].open && facts.shells[0].open[0]] ? FACES[facts.shells[0].open[0]].axis : 2, side = new Set();
    for (const x of [...facts.holes, ...facts.pockets]) if (x.face && FACES[x.face] && FACES[x.face].axis !== pull) side.add(x.face);
    if (side.size) ctx.add("CST-08", { severity: side.size >= 3 ? "warn" : "info", value: side.size, limit: 0, unit: "faces latérales", message: `Ouvertures ou trous sur ${side.size} face(s) latérale(s) (${[...side].sort().join(", ")}) : chacune demande un slide dans le mold (un core en sand casting), ou une reprise d'usinage. Correctif : les ouvrir jusqu'au parting line, ou les usiner après coulée.` });
  });
}
