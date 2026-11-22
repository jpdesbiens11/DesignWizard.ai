/* DesignOrbit.ai — DFM rules of two special processes of the Shop : precision laser cutting, by sheet material (LAS-), and
   3D printing, by process and by material (AM-1x). The figures live in cad/special_processes.js : the rule book prints
   them, the checks read them. The laser rules run after the flat-plate rules of dfx_rules_sheet.js (LC-, SM-, LAM-) ; the
   printing rules run after the housing rules of dfx_rules_plastic.js (HSG-) for a polymer, and alone for a metal. */

import { FACES } from "../cad/vec.js";
import { rule, num, round, groupBy } from "./dfx_core.js";
import { LASER_FAMILIES, laserProfile, laserLimits, AM_PROCESSES, AM_MATERIALS, amMaterial, amLimits } from "../cad/special_processes.js";
import { sheetThickness, holeSides } from "./dfx_rules_sheet.js";
import { PROCESSES, material, processName } from "../cad/materials.js";
import { supportReport, rankDirections, buildDir, DIR_WORDS } from "./am_supports.js";

const S = { laser: "Fabricants de machines laser, gazier, guide de conception des tôles découpées, publications sur la découpe laser des cartes — docs/PROCEDES.md",
  am: "ISO/ASTM 52911-1 (titre lu, texte non lu) ; guides de conception de fabricants de machines et de services d'impression — docs/PROCEDES.md",
  mat: "Norme de la matière imprimée (ASTM F2924, F3001, F3055, F3056, F3184, F3318 ; SAE AMS7000, AMS7028) — docs/PROCEDES.md", safe: "Fabricants de machines laser : matières interdites — docs/PROCEDES.md" };
const cuts = Object.values(LASER_FAMILIES).filter((f) => f.verdict === "ok"), thin = cuts.filter((f) => f.hole.k === 0);
const mm = (v) => `${num(v, 3)} mm`;
const L = {
  l01: rule("LAS-01", "Matière qui se découpe au laser", "Jamais de PVC, de PTFE ni de matière chlorée ou fluorée (gaz toxiques et corrosifs) ; polycarbonate : feuille mince seulement, bord décoloré", "error", "Certaines matières dégagent un gaz toxique et corrosif sous le faisceau ; d'autres se décolorent au lieu de se couper net.", S.safe),
  l02: rule("LAS-02", "Épaisseur dans la plage du laser, par matière", cuts.map((f) => `${f.short} ≤ ${mm(f.t[1])}`).join(" · "), "warn", "Au-delà, la coupe devient conique, lente, et le bord brûle : la pièce part au jet d'eau ou à l'usinage.", S.laser),
  l03: rule("LAS-03", "Plus petit détail découpé", `Métaux : trou ≥ 0,5 × épaisseur, fente ≥ l'épaisseur et ≥ 1 mm. Feuilles minces, trou et fente : ${thin.map((f) => `${f.short} ${mm(f.hole.min)}`).join(" · ")}`, "warn", "Sous cette taille, le trait de coupe mange le détail ou la matière brûle autour.", S.laser, { fix: true }),
  l04: rule("LAS-04", "Pont de matière entre deux découpes", `Métaux : ≥ l'épaisseur et ≥ 1,6 mm. Feuilles minces : ${thin.map((f) => `${f.short} ${mm(f.web.min)}`).join(" · ")}`, "warn", "Un pont trop étroit chauffe et se déforme, ou se déchire à la manipulation dans une feuille mince.", S.laser),
  l05: rule("LAS-05", "Angles rentrants arrondis (matières fragiles et feuilles minces)", `R intérieur ≥ ${cuts.filter((f) => f.corner > 0).map((f) => `${mm(f.corner)} (${f.short})`).join(" · ")}`, "warn", "Un angle rentrant vif amorce une fissure dans un stratifié ou un acrylique, une déchirure dans un papier ou un film.", "Pratique d'atelier, à confirmer avec le fournisseur", { fix: true }),
  l06: rule("LAS-06", "État du bord coupé", "Isolant : bord bruni ou carbonisé, hors des lignes de fuite ; conducteur : bavure retirée avant d'isoler ; carte : cuivre en retrait du trait de coupe", "info", "Le laser coupe par la chaleur : le chant n'a plus les propriétés de la matière. Sur une carte, un bord carbonisé abaisse la résistance de surface et la tenue en tension.", S.laser),
};
const P0 = AM_PROCESSES.lpbf;
const A = {
  a10: rule("AM-10", "Matière et procédé d'impression accordés", "Chaque matière s'imprime dans son procédé : métaux en fusion sur lit de poudre, polyamides en lit de poudre, PEI et PEKK en dépôt de fil, résines en stéréolithographie", "error", "Une matière demandée dans un procédé qui ne la transforme pas ne se commande pas.", S.am),
  a11: rule("AM-11", "Paroi minimale (métal)", `Paroi ≥ ${mm(P0.wall)} ; ${mm(P0.wallRec)} conseillé — sous ${mm(P0.wallRec)}, risque de défaut de fabrication`, "error", "Une paroi trop mince se déforme ou ne se fusionne pas d'un seul tenant.", S.am, { fix: true }),
  a12: rule("AM-12", "Trous et filetages (métal)", `Ø du trou ≥ ${mm(P0.hole)} ; un filetage se taraude en reprise ; un alésage ajusté se reprend`, "warn", "Un petit trou se referme ; un filet brut de fusion n'a ni la forme ni l'état de surface.", S.am, { fix: true }),
  a13: rule("AM-13", "Surplombs et supports", `Métal : surplomb ≥ ${P0.overhang}° du plateau (55° pour l'inox 316L), pont ≤ ${mm(P0.bridge)}, trou horizontal rond ≤ Ø${num(P0.hHole)}. Résine : ≥ ${AM_PROCESSES.sla.overhang}° , débord ≤ ${mm(AM_PROCESSES.sla.bridge)}`, "info", "Sous cet angle il faut des supports : en métal, de la matière soudée à retirer, une surface marquée, une reprise.", S.am),
  a14: rule("AM-14", "Cavités : la poudre ou la résine doit sortir", `Aucune cavité fermée. Poudre : ${P0.escapes} ouvertures ≥ Ø${num(P0.escape)} (métal) ou ≥ Ø${num(AM_PROCESSES.mjf.escape)} sur des faces opposées (polymère) ; résine : ouverture ≥ Ø${num(AM_PROCESSES.sla.escape)}`, "error", "La poudre ou la résine emprisonnée alourdit la pièce, et ressort plus tard.", S.am),
  a15: rule("AM-15", "Tient sur le plateau (métal)", `Pièce dans le volume d'une machine courante (${P0.build.join(" × ")} mm) — à confirmer avec l'atelier`, "error", "Ne se fabrique pas en une pièce : la découper, ou chercher une grande machine.", "Ordre de grandeur d'une machine de taille moyenne, non vérifié"),
  a16: rule("AM-16", "Surfaces fonctionnelles reprises en usinage (métal)", `Portées, ajustements, plans de joint : de la matière en plus et une reprise ; brut de fusion Ra ${P0.ra[0]} à ${P0.ra[1]} µm, cote à ${P0.tol}`, "info", "Brut de fusion, une surface ne tient ni un ajustement ni une étanchéité. Aucune surépaisseur chiffrée n'est publiée par les grands guides : elle se convient avec l'atelier.", S.am),
  a17: rule("AM-17", "Ce que la matière demande après l'impression", "Métaux : détente sur le plateau, compaction isostatique à chaud pour la fatigue, traitement de l'alliage ; polymères : post-cuisson, recuit, étanchéité selon la matière", "info", "La pièce n'a ses propriétés qu'après ces étapes : elles se commandent et se contrôlent.", S.mat),
};
export const LASER_RULES = Object.values(L), ADDITIVE_RULES = Object.values(A);
const STEPS_LASER = ["La matière dit le laser : fibre pour un métal, UV pour une carte ou un film polyimide, CO2 pour un papier ou un plastique", "Épaisseur dans la plage de la matière, prise dans la série du commerce", "Détails et ponts au-dessus du minimum de la matière",
  "Angles rentrants arrondis dans les matières fragiles et les feuilles minces", "Dire ce que le bord doit être : sans oxyde, ébavuré, non carbonisé"];
const STEPS_METAL = ["Choisir la matière pour sa norme et son traitement, pas pour sa fiche brute de fusion", "Orienter la pièce : ce qui se porte seul n'a pas de support", "Parois régulières, aucune cavité fermée, des ouvertures pour la poudre",
  "Laisser de la matière sur chaque surface fonctionnelle, et dire comment la pièce se reprend", "Écrire la chaîne après fusion : détente, séparation, compaction, traitement, usinage, contrôle"];
export const BOOK_SPECIAL = [
  { process: "laser_cut", category: "DFM", steps: STEPS_LASER, rules: LASER_RULES },
  { process: "fdm", category: "DFM", steps: [], rules: [A.a10, A.a13, A.a17] }, { process: "mjf", category: "DFM", steps: [], rules: [A.a10, A.a14, A.a17] },
  { process: "sla", category: "DFM", steps: [], rules: [A.a10, A.a13, A.a14, A.a17] },
  { process: "lpbf", category: "DFM", steps: STEPS_METAL, rules: [A.a10, A.a11, A.a12, A.a13, A.a14, A.a15, A.a16, A.a17] },
];

const holeLabel = (g) => `Trou Ø${num(g[0].d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${g[0].source} »`;
const nameOf = (ctx) => (ctx.mat ? ctx.mat.name : ctx.spec.material || "matière non définie");
const isConductor = (ctx) => !!ctx.spec.busbar || (ctx.spec.elec && ctx.spec.elec.kind === "conductor");
const materialsOf = (proc) => Object.entries(AM_MATERIALS).filter(([, e]) => e.process === proc).map(([id]) => (material(id) || { name: id }).name).join(", ");
const low = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Precision laser cutting : what the sheet material of the part asks. */
export function checkLaser(ctx) {
  const T = sheetThickness(ctx), P = laserProfile(ctx.spec.material), { facts } = ctx;
  ctx.run("LAS-01", () => {
    if (!P) { if (ctx.spec.material) ctx.add("LAS-01", { severity: "info", value: ctx.spec.material, limit: "matière connue au laser", message: `« ${nameOf(ctx)} » n'a pas de fiche de découpe laser dans la bibliothèque (limite : une matière dont la tenue au faisceau est connue). Correctif : demander à l'atelier la source laser, l'épaisseur maximale et l'état du bord.` }); return; }
    if (P.verdict === "forbidden") ctx.add("LAS-01", { value: ctx.spec.material, limit: "aucune matière chlorée ou fluorée", message: `${nameOf(ctx)} ne se découpe jamais au laser : ${P.why}. Correctif : ${P.instead}.` });
    else if (P.verdict === "caution") ctx.add("LAS-01", { severity: "warn", value: ctx.spec.material, limit: "matière qui se coupe net", message: `${nameOf(ctx)} se découpe mal au laser : ${P.why}. Limite : feuille mince (${mm(P.t[1])} au plus), hors des faces vues. Correctif : ${P.instead}.` });
  });
  if (!P || P.verdict === "forbidden" || !T || !(T.t > 0)) return;
  const t = T.t, lim = laserLimits(P, t), src = P.source.split(" ;")[0].split(" (")[0].split(" —")[0];
  ctx.run("LAS-02", () => {
    if (t > P.t[1] + 1e-6) ctx.add("LAS-02", { value: round(t, 3), limit: P.t[1], unit: "mm", message: `${nameOf(ctx)} de ${mm(t)} : au-delà de ce que le ${src} découpe proprement dans cette matière (${mm(P.t[1])}). Correctif : réduire l'épaisseur, ou passer au jet d'eau ou à l'usinage${P.key === "laminate" ? " (détourage à la fraise)" : ""}.` });
  });
  ctx.run("LAS-03", () => {
    if (lim.hole > t + 1e-6) for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}`)) {      // thicker sheets : the hole-against-thickness rule (SM-06) is the stricter one
      const h = g[0]; if (!(h.d > 0) || h.d >= lim.hole - 1e-6) continue;
      const f = ctx.feature(h.source);
      ctx.add("LAS-03", { value: h.d, limit: lim.hole, unit: "mm", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)} dans ${P.short} de ${mm(t)} : sous le plus petit trou que le laser laisse net dans cette matière (Ø${num(lim.hole)}). Correctif : passer à Ø${num(lim.hole)} ou plus.`,
        fix: f && f.op === "hole" && !h.thread ? ctx.fix(`Passer à Ø${num(lim.hole)}`, ctx.patch(h, "d", lim.hole)) : null });
    }
    if (lim.slot > t + 1e-6) for (const p of facts.pockets) { const w = Math.min(p.w, p.h);                // same for the slot-against-thickness rule (SM-08)
      if (w > 0 && w < lim.slot - 1e-6) ctx.add("LAS-03", { value: round(w), limit: lim.slot, unit: "mm", feature: p.source, iface: p.iface,
        message: `Découpe « ${p.source} » large de ${mm(w)} dans ${P.short} de ${mm(t)} : sous la plus petite fente que le laser laisse nette (${mm(lim.slot)}). Correctif : élargir la découpe à ${mm(lim.slot)} ou plus.` }); }
  });
  ctx.run("LAS-04", () => {
    if (!(lim.web > 2 * t + 1e-6) || !ctx.bbox) return;            // thicker sheets : the 2 × t rules (SM-04, SM-05) are stricter
    const hs = facts.holes.filter((h) => h.at && h.axis && h.d > 0).slice(0, 400); let worst = null;
    const keep = (gap, h, what) => { if (gap < lim.web - 1e-6 && (!worst || gap < worst.gap)) worst = { gap, h, what }; };
    for (const h of hs) for (const s of holeSides(ctx, h, T)) keep(s.dist - h.d / 2, h, "le bord de la feuille");
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) { const d = Math.hypot(hs[i].at[0] - hs[j].at[0], hs[i].at[1] - hs[j].at[1], hs[i].at[2] - hs[j].at[2]); if (d > 1e-6) keep(d - (hs[i].d + hs[j].d) / 2, hs[i], `« ${hs[j].source} »`); }
    if (worst) { const gap = Math.max(worst.gap, 0); ctx.add("LAS-04", { value: round(gap), limit: lim.web, unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
      message: `Pont de ${mm(gap)} entre « ${worst.h.source} » et ${worst.what}, dans ${P.short} de ${mm(t)}. Limite : ≥ ${mm(lim.web)} — plus étroit, il se déchire à la manipulation ou brûle à la coupe. Correctif : écarter de ${mm(lim.web - gap)}.` }); }
  });
  ctx.run("LAS-05", () => {
    if (!(P.corner > 0)) return;
    for (const p of facts.pockets) {
      const small = Math.min(p.w, p.h); if (!(small > 0) || !(p.through || p.depth >= t - 1e-6) || p.rMin >= P.corner - 1e-3) continue;
      const f = ctx.feature(p.source), path = f && f.op === "pocket" ? (f.rect ? "r" : f.profile && (f.profile.rect || f.profile.poly) ? "profile.r" : null) : null;
      const cut = p.iface && (ctx.built.interfaces || []).some((i) => i.id === p.iface && i.type === "cutout"), can = small / 2 > P.corner;
      ctx.add("LAS-05", { value: p.rMin, limit: P.corner, unit: "mm", feature: p.source, iface: p.iface,
        message: `Découpe « ${p.source} » dans ${P.short} : angles rentrants R${num(p.rMin)}${p.rMin < 1e-6 ? " (vifs)" : ""}. Limite : R ≥ ${mm(P.corner)} — un angle vif amorce ${P.key === "aramid" || P.key === "film" ? "une déchirure" : "une fissure"}. Correctif : ${can ? `passer les angles à R${num(P.corner)}` : `élargir la découpe à plus de ${mm(2 * P.corner)}`}.`,
        fix: can ? ctx.fix(`Passer les angles à R${num(P.corner)}`, ctx.patch(p, path, P.corner, cut ? "params.r" : null)) : null });
    }
  });
  ctx.run("LAS-06", () => {
    if (["laminate", "aramid", "film"].includes(P.key)) ctx.add("LAS-06", { value: P.short, limit: "bord non carbonisé", message: `Isolant découpé au laser (${P.short}) : ${P.edge} Limite : un chant carbonisé ne compte pas dans une ligne de fuite${P.keepOut ? ` ; cuivre et composants en retrait du trait de coupe (des essais publiés ont tenu la tension dès ${mm(P.keepOut)}, aucune distance normalisée)` : ""}. Correctif : garder le débord d'isolant prévu au-delà des conducteurs, demander un bord propre (${src}) et le contrôler à la réception. L'analyse d'Isolation longe ce chant sans le compter (réglable dans ses conditions).` });
    else if (isConductor(ctx)) ctx.add("LAS-06", { value: P.short, limit: "arêtes ébavurées", message: `Conducteur découpé au laser (${P.short}) : ${P.edge} Limite : aucune bavure sous un isolant. Correctif : ébavurer et arrondir les arêtes avant d'isoler ou de laminer ; nettoyer les plages de contact et de soudure.` });
  });
}

/** 3D printing : the process against the material, then what the process asks — supports, cavities, and for a metal : walls, holes, plate, machining. */
export function checkAdditive(ctx) {
  const proc = ctx.process, P = amLimits(proc, ctx.spec.material), { facts, dims } = ctx, M = amMaterial(ctx.spec.material);
  if (!P) return;
  const metal = P.kind === "metal";
  ctx.run("AM-10", () => {
    const m = ctx.mat;
    if (!m || (m.processes || []).includes(proc)) return;
    if (M && M.process !== proc) ctx.add("AM-10", { value: processName(proc), limit: processName(M.process), message: `${m.name} en « ${processName(proc)} » : cette matière s'imprime en « ${processName(M.process)} ». Correctif : changer de procédé, ou choisir une matière du procédé (${materialsOf(proc)}).`,
      fix: ctx.fix(`Passer en ${M.proc.short}`, { target: "spec", id: null, path: "process", value: M.process }) });
    else ctx.add("AM-10", { severity: (m.cls === "metal") !== metal ? "error" : "warn", value: m.name, limit: materialsOf(proc), message: `${m.name} n'est pas une matière « ${P.label} » de la bibliothèque. Matières du procédé : ${materialsOf(proc)}. Correctif : choisir l'une d'elles, ou confirmer avec le fournisseur que la sienne s'imprime.` });
  });
  if (metal) {
    ctx.run("AM-11", () => ctx.checkWalls("AM-11", { rec: P.wallRec, min: P.wall, what: `de fusion laser (${P.short})` }));
    ctx.run("AM-12", () => {
      for (const g of groupBy(facts.holes, (h) => `${h.source}|${h.d}`)) {
        const h = g[0]; if (!(h.d > 0) || h.d >= P.hole - 1e-6 || h.thread) continue;
        const f = ctx.feature(h.source);
        ctx.add("AM-12", { value: h.d, limit: P.hole, unit: "mm", where: h.at, feature: h.source, iface: h.iface,
          message: `${holeLabel(g)} : sous le Ø qui sort ouvert et rond en ${P.short} (${mm(P.hole)}). Correctif : passer à Ø${num(P.hole)}, ou le percer en reprise.`,
          fix: f && f.op === "hole" ? ctx.fix(`Passer à Ø${num(P.hole)}`, ctx.patch(h, "d", P.hole)) : null });
      }
      const threads = groupBy(facts.holes.filter((h) => h.thread), (h) => `${h.source}|${h.thread}`), n = threads.reduce((k, g) => k + g.length, 0);
      if (n) ctx.add("AM-12", { severity: "info", value: n, limit: 0, unit: "filets bruts de fusion",
        message: `${n} trou(s) taraudé(s) (${[...new Set(threads.map((g) => String(g[0].thread).toUpperCase()))].slice(0, 4).join(", ")}) : un filet ne sort pas de la machine. Limite : filetage taraudé en reprise. Correctif : les laisser pleins ou en avant-trou réduit, et les tarauder après traitement.` });
    });
    ctx.run("AM-15", () => {
      if (!dims) return;
      const d = dims.slice().sort((a, b) => b - a), bv = P.build.slice().sort((a, b) => b - a);
      if (d.some((v, i) => v > bv[i] + 1e-6)) ctx.add("AM-15", { value: d.map((v) => num(v, 0)).join(" × "), limit: P.build.join(" × "), unit: "mm",
        message: `La pièce (${d.map((v) => num(v, 0)).join(" × ")} mm) ne tient pas dans le volume d'une machine ${P.short} courante (${P.build.join(" × ")} mm). Correctif : la découper en deux pièces assemblées, ou consulter un atelier équipé d'une grande machine.` });
    });
    ctx.run("AM-16", () => {
      const fn = (ctx.built.interfaces || []).filter((i) => ["fit", "planar", "contact", "pins", "bond"].includes(i.type));
      if (fn.length) ctx.add("AM-16", { value: fn.length, limit: 0, unit: "surfaces brutes de fusion",
        message: `${fn.length} interface(s) portent sur une surface (${fn.slice(0, 4).map((i) => `« ${i.name || i.id} »`).join(", ")}${fn.length > 4 ? "…" : ""}) : brut de fusion, Ra ${P.ra[0]} à ${P.ra[1]} µm et cote à ${P.tol}. Limite : surface fonctionnelle reprise en usinage. Correctif : laisser de la matière sur ces surfaces dans le modèle de fabrication (valeur à convenir avec l'atelier) et coter la surface finie au dessin.` });
    });
  }
  ctx.run("AM-13", () => {
    if (!P.supports) return;
    const mesh = ctx.geo && ctx.geo.mesh;
    if (mesh && mesh.pos && mesh.idx) {                          // measured on the real geometry, in the direction the part is printed
      const dir = buildDir(ctx.spec), o = { hole: P.hHole }, R = supportReport(mesh, dir, P.overhang, o), best = rankDirections(mesh, P.overhang, o)[0], better = best.dir !== dir && best.area < 0.8 * R.area - 1;
      if (R.area < 1) return;
      ctx.add("AM-13", { value: Math.round(R.area), limit: 0, unit: "mm² à supporter",
        message: `Imprimée ${DIR_WORDS[dir]} : ${num(R.area, 0)} mm² de surfaces à moins de ${P.overhang}° du plateau demandent des supports (${num(100 * R.share, 0)} % de la surface de la pièce${R.faces ? `, sur ${R.faces} face(s)` : ""}) ; hauteur de fabrication ${num(R.height, 1)} mm. Limite : surplomb ≥ ${P.overhang}° du plateau.${better ? ` Imprimée ${DIR_WORDS[best.dir]}, il n'en reste que ${num(best.area, 0)} mm².` : ""} Correctif : ${better ? "changer le sens d'impression (onglet Impression), ou " : ""}${metal ? "chanfreiner les surplombs, dessiner les trous horizontaux en goutte d'eau — chaque support est du métal à retirer" : "chanfreiner les surplombs, ou accepter les marques de supports hors des faces vues"}.`,
        fix: better ? ctx.fix(`Imprimer ${DIR_WORDS[best.dir]}`, { target: "spec", id: null, path: "print.dir", value: best.dir }) : null });
      return;
    }
    if (proc === "fdm") return;                                  // no mesh : for FDM the housing rule HSG-10 reads the operations
    const big = P.hHole;
    const items = [...(big > 0 ? groupBy(facts.holes.filter((h) => h.axis && Math.abs(h.axis[2]) < 0.5 && h.d > big), (h) => h.source).map((g) => `trou horizontal Ø${num(g[0].d)} « ${g[0].source} »`) : []),
      ...facts.pockets.filter((p) => p.face && FACES[p.face] && FACES[p.face].axis !== 2 && Math.min(p.w, p.h) > P.bridge).map((p) => `ouverture latérale « ${p.source} » (linteau de ${mm(Math.min(p.w, p.h))})`),
      ...[...facts.holes, ...facts.pockets, ...facts.bosses].filter((x) => x.face === "-Z" && !x.through).slice(0, 1).map(() => "formes sur la face du dessous (−Z)")];
    if (items.length) ctx.add("AM-13", { value: items.length, limit: 0, unit: "zones à supports",
      message: `Impression ${P.short}, pièce orientée Z vers le haut : ${items.slice(0, 4).join(", ")}${items.length > 4 ? "…" : ""} demandent des supports (limite : surplomb ≥ ${P.overhang}° du plateau, portée libre ≤ ${mm(P.bridge)}${big ? `, trou horizontal rond ≤ Ø${num(big)}` : ""}). Correctif : ${metal ? "dessiner les trous horizontaux en goutte d'eau, chanfreiner les surplombs, ou réorienter la pièce — chaque support est du métal à retirer" : "réorienter la pièce, ou accepter les marques de supports hors des faces vues"}.` });
  });
  ctx.run("AM-14", () => {
    if (!P.escape) return;
    const what = P.powder ? "poudre" : "résine", need = `${P.escapes > 1 ? `${P.escapes} ouvertures` : "une ouverture"} ≥ Ø${num(P.escape)}`;
    for (const s of facts.shells) if (!(s.open || []).length) ctx.add("AM-14", { value: 0, limit: P.escapes, unit: "ouvertures", feature: s.source,
      message: `Cavité fermée (shell « ${s.source} ») : la ${what} y reste emprisonnée. Limite : ${need}. Correctif : ouvrir une face, ou percer ces ouvertures et les reboucher après.` });
  });
  ctx.run("AM-17", () => {
    if (!M || M.process !== proc) return;
    const chain = [M.relief, ...M.post, M.critical ? `pour une pièce en fatigue, ${M.critical}` : null].filter(Boolean);
    if (!chain.length && !M.watch.length) return;
    ctx.add("AM-17", { value: M.std && M.std !== "—" ? M.std.split(" (")[0].split(" ;")[0] : ctx.spec.material, limit: "étapes commandées et contrôlées",
      message: `${nameOf(ctx)} imprimé en ${P.short}${chain.length ? ` — après l'impression : ${chain.map(low).join(" ; ")}` : ""}. ${M.watch.join(" ")}${M.std && M.std !== "—" ? ` Référence : ${M.std}.` : ""} Correctif : porter ces étapes sur le dessin et la commande, et demander les certificats (matière, traitement).` });
  });
}
