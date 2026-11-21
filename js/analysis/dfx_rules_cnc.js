/* DesignWizard.ai — DFM rules: CNC milling and CNC turning (3-axis mill / lathe, standard tooling).
   Limits are the usual published guidance (Protolabs Network / Hubs, Xometry, Machinery's Handbook); values marked
   "règle de pouce" are rules of thumb to confirm with the machine shop. */

import { THREADS, standardDrill, isStandardDrill } from "../cad/standards.js";
import { FACES } from "../cad/vec.js";
import { rule, num, round, exitDistance, edgeDistance, groupBy } from "./dfx_core.js";

const S = {
  hubs: "Protolabs Network (Hubs) — CNC machining design guidelines", xo: "Xometry — CNC machining design guide",
  mh: "Machinery's Handbook (drills, taps, thread engagement)", thumb: "Règle de pouce (rule of thumb), à confirmer avec l'usineur",
  bd: "Boothroyd-Dewhurst — Product Design for Manufacture and Assembly",
};
const R = {
  c01: rule("CNC-01", "Rayon intérieur des pockets", "R ≥ profondeur / 6 (outil L/D ≤ 3) et ≥ 0,5 mm (end mill Ø1) ; angle vif intérieur impossible", "error", "Une fraise est ronde : elle ne peut pas faire d'angle vif, et un petit rayon profond impose un outil long et fragile.", `${S.hubs} ; ${S.xo}`, { fix: true }),
  c02: rule("CNC-02", "Profondeur de pocket", "Profondeur ≤ 4 × la plus petite largeur (erreur au-delà de 6 ×)", "warn", "Outil en porte-à-faux, vibrations, copeaux difficiles à évacuer.", S.hubs),
  c03: rule("CNC-03", "Profondeur de perçage", "Profondeur ≤ 4 × Ø (standard) ; 10 × Ø maximum", "warn", "Au-delà de 4 × Ø il faut un cycle de débourrage ; au-delà de 10 × Ø le foret dévie et casse.", S.hubs),
  c04: rule("CNC-04", "Ø de perçage standard", "Ø dans la série des forets standard (pas de 0,1 mm jusqu'à Ø10, 0,5 mm au-delà)", "warn", "Un Ø hors série demande un outil spécial ou une interpolation : coût et délai.", S.mh, { fix: true }),
  c05: rule("CNC-05", "Longueur de filetage utile", "Longueur filetée ≤ 3 × d", "info", "Au-delà de 3 × d le filet n'apporte plus de résistance mais coûte du temps et casse des tarauds.", `${S.hubs} ; ${S.mh}`, { fix: true }),
  c06: rule("CNC-06", "Fond de trou borgne", "Matière sous le trou ≥ 0,3 × Ø (pointe du foret) + paroi mini (métal 0,8 mm, plastique 1,5 mm)", "warn", "La pointe du foret (118°) dépasse le fond théorique : le fond perce ou se déforme ; un taraud a besoin de dégagement.", S.thumb, { fix: true }),
  c07: rule("CNC-07", "Parois minces", "Métal ≥ 0,8 mm (0,5 mm limite) ; plastique ≥ 1,5 mm (1,0 mm limite)", "warn", "Une paroi mince vibre et se déforme à l'usinage.", S.hubs, { fix: true }),
  c08: rule("CNC-08", "Trou trop près d'un bord", "Matière entre le trou et le bord ≥ paroi mini (métal 0,8 mm, plastique 1,5 mm)", "warn", "Le voile entre le trou et le bord se déforme ou s'arrache.", S.xo),
  c09: rule("CNC-09", "Nombre de set-ups", "≤ 2 faces usinées conseillées ; avertissement à partir de 4", "info", "Chaque face usinée est une reprise en 3 axes : temps de réglage et cumul de tolérances.", S.bd),
  c10: rule("CNC-10", "Congés et chanfreins minuscules", "Congé ≥ R0,5 ; chanfrein ≥ 0,2 mm", "warn", "Un très petit congé demande un micro-outil ou un balayage 3D.", S.thumb, { fix: true }),
  c11: rule("CNC-11", "Brut (stock size)", "Brut standard = enveloppe + surépaisseur ; matière enlevée ≤ 90 %", "info", "Partir d'un format standard et limiter le volume de copeaux.", S.thumb),
  c12: rule("CNC-12", "Avant-trou de taraudage", "Ø d'avant-trou = Ø de perçage ISO du filetage (M4 : 3,3 mm)", "warn", "Avant-trou trop petit : le taraud casse ; trop grand : le filet est incomplet.", "ISO 2306 ; Machinery's Handbook", { fix: true }),
  t01: rule("TRN-01", "Élancement de la pièce tournée", "Longueur / Ø ≤ 4 sans contre-pointe", "warn", "Une pièce longue fléchit sous l'outil : conicité, broutement.", S.xo),
  t02: rule("TRN-02", "Pièce de révolution", "Les features hors axe demandent un tour à outils tournants (live tooling) ou une reprise en fraisage", "info", "Chaque reprise ajoute un set-up.", S.bd),
  t03: rule("TRN-03", "Angles vifs intérieurs du profil", "Rayon intérieur ≥ 0,4 mm (rayon de bec de plaquette) ou gorge de dégagement", "info", "La plaquette de tournage a un rayon de bec : un angle vif intérieur est impossible.", S.mh),
  t04: rule("TRN-04", "Barre standard", "Ø de barre standard immédiatement supérieur au Ø maxi", "info", "Limiter la matière enlevée.", S.thumb),
};

export const BOOK_CNC = [
  { process: "cnc_milling", category: "DFM",
    steps: ["Choisir la matière et un brut standard", "Limiter les faces usinées (set-ups) : tout faire par le dessus si possible", "Pockets : un rayon intérieur généreux, profondeur ≤ 4 × largeur",
      "Trous : Ø standard, profondeur ≤ 4 × Ø, taraudages débouchants si possible", "Parois ≥ 0,8 mm (métal) / 1,5 mm (plastique)", "Chanfreins plutôt que congés sur les arêtes extérieures"],
    rules: [R.c01, R.c02, R.c03, R.c04, R.c12, R.c05, R.c06, R.c07, R.c08, R.c09, R.c10, R.c11] },
  { process: "cnc_turning", category: "DFM",
    steps: ["Partir d'une barre standard", "Garder la pièce de révolution : les perçages hors axe et méplats sont des reprises", "Longueur ≤ 4 × Ø sans contre-pointe",
      "Rayons intérieurs ≥ 0,4 mm ou gorges de dégagement", "Trous : Ø standard, profondeur ≤ 4 × Ø"],
    rules: [R.t01, R.t02, R.t03, R.t04, R.c03, R.c04, R.c12, R.c05, R.c06, R.c07] },
];

export const wallLimits = (cls) => (cls === "plastic" ? { rec: 1.5, min: 1.0, what: "d'usinage (plastique)" } : { rec: 0.8, min: 0.5, what: "d'usinage (métal)" });
const holeGroups = (ctx) => groupBy(ctx.facts.holes, (h) => `${h.source}|${h.d}|${h.depth}`);
const holeLabel = (g) => `Trou Ø${num(g[0].d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${g[0].source} »`;
const holePath = (ctx, h, field) => { const f = ctx.feature(h.source); return f && f.op === "boss" ? `hole.${field}` : f && (f.op === "hole" || (f.op === "cylinder" && field === "d")) ? field : null; };

/** Hole diameters: standard drills and tap drills (also run for machining after extrusion). */
export function checkHoleSizes(ctx) {
  const groups = holeGroups(ctx);
  ctx.run("CNC-04", () => {
    for (const g of groups) {
      const h = g[0];
      if (h.iface || h.thread || h.fit || h.insert || !(h.d > 0) || h.d > 20 || isStandardDrill(h.d)) continue;
      const step = h.d <= 10 ? 0.1 : 0.5, lo = round(Math.floor(h.d / step + 1e-6) * step), hi = standardDrill(h.d);
      const pick = lo > 0 && h.d - lo < hi - h.d - 1e-9 ? lo : hi, path = holePath(ctx, h, "d");
      ctx.add("CNC-04", { value: h.d, limit: pick, unit: "mm", where: h.at, feature: h.source,
        message: `${holeLabel(g)} : Ø${num(h.d, 3)} n'est pas un foret standard (les plus proches : Ø${num(lo)} et Ø${num(hi)}). Correctif : passer à Ø${num(pick)}.`,
        fix: ctx.fix(`Passer à Ø${num(pick)} (foret standard)`, ctx.patch(h, path, pick)) });
    }
  });
  ctx.run("CNC-12", () => {
    for (const g of groups) {
      const h = g[0], th = h.thread ? THREADS[String(h.thread).toUpperCase()] : null;
      if (!th || h.iface || Math.abs(h.d - th.tap) <= 0.051) continue;
      ctx.add("CNC-12", { value: h.d, limit: th.tap, unit: "mm", where: h.at, feature: h.source,
        message: `${holeLabel(g)} taraudé ${h.thread} : l'avant-trou fait Ø${num(h.d)} au lieu de Ø${num(th.tap)} (perçage ISO pour ${h.thread}). Correctif : passer l'avant-trou à Ø${num(th.tap)}.`,
        fix: ctx.fix(`Passer l'avant-trou à Ø${num(th.tap)} (${h.thread})`, ctx.patch(h, holePath(ctx, h, "d"), th.tap)) });
    }
  });
}

/** Hole depths: drilling ratio, useful thread length, bottom of blind holes. */
export function checkHoleDepths(ctx) {
  const groups = holeGroups(ctx), wl = wallLimits(ctx.cls);
  ctx.run("CNC-03", () => {
    for (const g of groups) {
      const h = g[0], exit = exitDistance(h.at, h.axis, ctx.bbox);
      const depth = h.through ? (ctx.hollow ? null : exit) : (exit > 0 ? Math.min(h.depth, exit) : h.depth);
      if (!(depth > 0) || !(h.d > 0)) continue;
      const ratio = depth / h.d;
      if (ratio <= 4 + 1e-9) continue;
      const over = ratio > 10;
      ctx.add("CNC-03", { severity: over ? (h.through ? "warn" : "error") : "info", value: round(ratio), limit: over ? 10 : 4, unit: "× Ø", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)} : profondeur ${num(depth)} mm = ${num(ratio, 1)} × Ø. Limite : 4 × Ø en standard (${num(4 * h.d)} mm), 10 × Ø au maximum (${num(10 * h.d)} mm). Correctif : ${over ? "réduire la profondeur, augmenter le Ø ou percer des deux côtés" : "prévoir un cycle de débourrage (peck drilling) ou réduire la profondeur"}.` });
    }
  });
  ctx.run("CNC-05", () => {
    for (const g of groups) {
      const h = g[0], th = h.thread ? THREADS[String(h.thread).toUpperCase()] : null;
      if (!th || h.through || !(h.depth > 3 * th.d + 1e-6)) continue;
      const to = round(3 * th.d, 1);
      ctx.add("CNC-05", { value: h.depth, limit: to, unit: "mm", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)} taraudé ${h.thread} : profondeur ${num(h.depth)} mm = ${num(h.depth / th.d, 1)} × d. Au-delà de 3 × d (${num(to)} mm) le filet n'apporte plus de résistance. Correctif : limiter la profondeur à ${num(to)} mm.`,
        fix: ctx.fix(`Limiter la profondeur à ${num(to)} mm (3 × d)`, ctx.patch(h, holePath(ctx, h, "depth"), to, "opts.depth")) });
    }
  });
  ctx.run("CNC-06", () => {
    for (const g of groups) {
      const h = g[0], exit = exitDistance(h.at, h.axis, ctx.bbox);
      if (h.through || !(h.depth > 0) || !(exit > 0) || !(h.d > 0)) continue;
      const left = exit - h.depth, lim = 0.3 * h.d + wl.rec;
      if (left <= 1e-6 || left >= lim - 1e-6) continue;       // left <= 0: the hole already opens on the far side
      ctx.add("CNC-06", { value: round(left), limit: round(lim), unit: "mm", where: h.at, feature: h.source, iface: h.iface,
        message: `${holeLabel(g)}${h.thread ? ` taraudé ${h.thread}` : ""} : il reste ${num(left)} mm de matière sous le fond du trou borgne, moins que ${num(lim)} mm (0,3 × Ø pour la pointe du foret + ${num(wl.rec)} mm de paroi). Correctif : rendre le trou débouchant (moins cher et sans risque de casse du taraud) ou réduire la profondeur.`,
        fix: ctx.fix("Rendre le trou débouchant (through)", ctx.patch(h, holePath(ctx, h, "depth"), "through", "opts.depth")) });
    }
  });
}

/* Number of corners of a rectangular pocket that are really INSIDE the part (a pocket open on a side has no inside corner there). */
function insideCorners(ctx, p) {
  const f = ctx.efeature(p.source), F = FACES[p.face], bb = ctx.bbox;
  const rect = f && (f.rect || (f.profile && f.profile.rect));
  if (!rect || !F || !bb || rect.length < 4 || rect.some((v) => typeof v !== "number")) return 4;
  const [a, b] = F.plane, xs = [rect[0], rect[0] + rect[2]], ys = [rect[1], rect[1] + rect[3]];
  let n = 0;
  for (const x of xs) for (const y of ys) if (x > bb[a] + 1e-6 && x < bb[3 + a] - 1e-6 && y > bb[b] + 1e-6 && y < bb[3 + b] - 1e-6) n++;
  return n;
}
function pocketDepth(ctx, p) {
  if (!p.through) return p.depth;
  if (ctx.hollow) return Math.min(...ctx.facts.shells.map((s) => s.t));       // a cut-out through a wall
  const F = FACES[p.face];
  return F && ctx.bbox ? ctx.bbox[3 + F.axis] - ctx.bbox[F.axis] : null;
}
function pocketRadiusPath(ctx, p) {
  const f = ctx.feature(p.source);
  if (!f || f.op !== "pocket") return null;
  if (f.rect) return "r";
  return f.profile && (f.profile.rect || (f.profile.poly && f.profile.poly.every((q) => q.length < 3))) ? "profile.r" : null;
}

export function checkMilling(ctx) {
  const { facts, bbox } = ctx, wl = wallLimits(ctx.cls);
  ctx.run("CNC-01", () => {
    for (const p of facts.pockets) {
      const small = Math.min(p.w, p.h);
      if (!(small > 0) || p.rMin >= small / 2 - 1e-3 || insideCorners(ctx, p) === 0) continue;   // round pocket / slot / open step
      const depth = pocketDepth(ctx, p);
      if (!(depth > 0)) continue;
      const need = Math.max(0.5, depth / 6), sharp = p.rMin < 1e-6;
      if (!sharp && p.rMin >= need - 1e-6) continue;
      let to = Math.max(1, Math.ceil(need * 2 - 1e-9) / 2);
      if (to > small / 2 - 0.01) to = Math.floor((small / 2 - 0.01) * 10) / 10;
      const rail = p.iface && !pocketRadiusPath(ctx, p) && !(ctx.built.interfaces || []).some((i) => i.id === p.iface && i.type === "cutout");
      const fix = to >= need - 1e-6 ? ctx.fix(`Passer le rayon intérieur à R${num(to)}`, ctx.patch(p, pocketRadiusPath(ctx, p), to, rail ? null : "params.r")) : null;
      ctx.add("CNC-01", { severity: rail ? "warn" : sharp || depth / (2 * p.rMin) > 10 ? "error" : "warn", value: p.rMin, limit: round(need), unit: "mm", feature: p.source, iface: p.iface,
        message: sharp
          ? `Pocket « ${p.source} » (${num(p.w)} × ${num(p.h)}, profondeur ${num(depth)} mm) : angles intérieurs vifs (R0), impossibles à fraiser. Limite : R ≥ ${num(need)} mm (profondeur / 6, mini 0,5 mm). Correctif : ${fix ? `donner un rayon R${num(to)}` : "donner un rayon d'outil aux angles, déboucher le pocket sur les bords ou prévoir des dégagements (dog-bone)"}.`
          : `Rayon intérieur du pocket « ${p.source} » trop petit : R${num(p.rMin)} pour ${num(depth)} mm de profondeur (outil Ø${num(2 * p.rMin)}, L/D = ${num(depth / (2 * p.rMin), 1)}). Limite : R ≥ ${num(need)} mm (profondeur / 6, mini 0,5 mm). Correctif : ${fix ? `passer à R${num(to)}` : "élargir le pocket ou réduire sa profondeur"}.`,
        fix });
    }
  });
  ctx.run("CNC-02", () => {
    for (const p of facts.pockets) {
      const small = Math.min(p.w, p.h), depth = p.through && ctx.hollow ? null : pocketDepth(ctx, p);
      if (!(small > 0) || !(depth > 0) || (p.rMin >= small / 2 - 1e-3 && Math.abs(p.w - p.h) < 1e-3) || depth <= 4 * small + 1e-9) continue;   // a round pocket is a bore
      ctx.add("CNC-02", { severity: depth > 6 * small ? "error" : "warn", value: round(depth / small), limit: 4, unit: "× largeur", feature: p.source, iface: p.iface,
        message: `Pocket « ${p.source} » : profondeur ${num(depth)} mm = ${num(depth / small, 1)} × sa largeur (${num(small)} mm). Limite : 4 × la largeur (${num(4 * small)} mm). Correctif : élargir le pocket, réduire sa profondeur ou l'ouvrir sur un côté.` });
    }
  });
  checkHoleDepths(ctx);
  checkHoleSizes(ctx);
  ctx.run("CNC-07", () => ctx.checkWalls("CNC-07", wl));
  ctx.run("CNC-08", () => {
    const bolt = new Set((ctx.built.interfaces || []).filter((i) => i.type === "bolt_pattern").map((i) => i.id));
    for (const g of holeGroups(ctx)) {
      let worst = null;
      for (const h of g) {
        if (h.iface && bolt.has(h.iface)) continue;            // bolt patterns: rule IF-01
        const e = edgeDistance(h.at, h.axis, bbox), dEff = Math.max(h.d, (h.cbore && h.cbore.d) || 0, (h.csink && h.csink.d) || 0);
        if (e === null) continue;
        const wall = e - dEff / 2;
        if (!worst || wall < worst.wall) worst = { wall, h };
      }
      if (!worst || worst.wall >= wl.rec - 1e-6) continue;
      const out = worst.wall <= 0.05, h = worst.h;
      ctx.add("CNC-08", { severity: out ? "warn" : worst.wall < wl.min ? "error" : "warn", value: round(worst.wall), limit: wl.rec, unit: "mm", where: h.at, feature: h.source, iface: h.iface,
        message: out ? `${holeLabel(g)} : le trou débouche sur le bord de la pièce (${num(worst.wall)} mm de matière). Limite : ≥ ${num(wl.rec)} mm entre le trou et le bord. Correctif : éloigner le trou du bord, ou confirmer que l'encoche est voulue.`
          : `${holeLabel(g)} : il ne reste que ${num(worst.wall)} mm de matière entre le trou et le bord. Limite : ≥ ${num(wl.rec)} mm. Correctif : éloigner le trou du bord d'au moins ${num(wl.rec - worst.wall)} mm ou réduire son Ø.` });
    }
  });
  ctx.run("CNC-09", () => {
    const blind = new Set(), through = new Set();
    const faceOf = (x) => x.face || (x.axis ? Object.keys(FACES).find((k) => FACES[k].n.every((v, i) => Math.abs(v + x.axis[i]) < 1e-6)) : null);
    for (const x of [...facts.holes, ...facts.pockets]) { const f = faceOf(x); if (f) (x.through ? through : blind).add(f); }
    for (const f of through) if (!blind.has(f) && !blind.has((f[0] === "+" ? "-" : "+") + f[1])) blind.add(f);    // a through feature is machined from either side
    const n = blind.size;
    if (n > 2) ctx.add("CNC-09", { severity: n >= 4 ? "warn" : "info", value: n, limit: 2, unit: "faces",
      message: `${n} faces usinées (${[...blind].sort().join(", ")}) : au moins ${n} set-ups en 3 axes. Conseil : ≤ 2 faces. Correctif : regrouper trous et pockets sur une ou deux faces, ou prévoir un centre 5 axes.` });
  });
  ctx.run("CNC-10", () => {
    for (const [list, lim, to, what, key] of [[facts.fillets, 0.5, 0.5, "Congé", "r"], [facts.chamfers, 0.2, 0.3, "Chanfrein", "d"]]) {
      for (const f of list) {
        if (!(f.size < lim - 1e-6)) continue;
        const raw = ctx.feature(f.source), path = raw ? (key === "d" && raw.d === undefined && raw.c !== undefined ? "c" : key) : null;
        ctx.add("CNC-10", { severity: key === "r" ? "warn" : "info", value: f.size, limit: lim, unit: "mm", feature: f.source,
          message: `${what} « ${f.source} » de ${num(f.size)} mm sur ${f.count} arête(s) : sous ${num(lim)} mm il faut un micro-outil ou un balayage 3D. Limite : ≥ ${num(lim)} mm. Correctif : passer à ${num(to)} mm, ou remplacer par la note générale « casser les angles 0,2 à 0,5 ».`,
          fix: ctx.fix(`Passer à ${num(to)} mm`, ctx.patch(f, path, to)) });
      }
    }
  });
  ctx.run("CNC-11", () => {
    if (!ctx.dims || !(ctx.built.volume > 0)) return;
    const STOCK = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 150, 200];
    const d = ctx.dims.slice().sort((a, b) => b - a), t = STOCK.find((s) => s >= d[2] - 1e-6) || Math.ceil(d[2] / 10) * 10;
    const stock = [Math.ceil(d[0] + 4), Math.ceil(d[1] + 4), t], removed = 1 - ctx.built.volume / (stock[0] * stock[1] * stock[2]);
    ctx.add("CNC-11", { severity: removed > 0.9 ? "warn" : "info", value: round(removed * 100, 0), limit: 90, unit: "% enlevé",
      message: `Brut conseillé ≈ ${stock[0]} × ${stock[1]} × ${num(stock[2])} mm (épaisseur standard ${num(t)} mm pour une pièce de ${num(d[2])} mm) ; ${num(removed * 100, 0)} % de la matière part en copeaux. Limite : ≤ 90 %. Correctif : ${removed > 0.9 ? "revoir le découpage (pièce assemblée, extrusion, tôle) pour enlever moins de matière" : "ajuster l'épaisseur de la pièce sur une épaisseur de brut standard si possible"}.` });
  });
}

export function checkTurning(ctx) {
  const { facts, dims } = ctx;
  const same = (a, b) => Math.abs(a - b) <= 0.02 * Math.max(a, b, 1e-9);
  const axis = dims ? (same(dims[0], dims[1]) ? 2 : same(dims[0], dims[2]) ? 1 : same(dims[1], dims[2]) ? 0 : -1) : -1;
  const D = axis >= 0 ? Math.max(...dims.filter((_, i) => i !== axis)) : null, L = axis >= 0 ? dims[axis] : null;
  ctx.run("TRN-01", () => {
    if (!(D > 0) || L / D <= 4 + 1e-9) return;
    ctx.add("TRN-01", { value: round(L / D), limit: 4, unit: "L/Ø",
      message: `Pièce tournée longue : ${num(L)} mm pour Ø${num(D)}, soit L/Ø = ${num(L / D, 1)}. Limite : 4 sans contre-pointe${L / D > 10 ? " ; au-delà de 10 il faut une lunette" : ""}. Correctif : prévoir un centre pour la contre-pointe, raccourcir la pièce ou augmenter son Ø.` });
  });
  ctx.run("TRN-02", () => {
    const off = [];
    if (axis < 0 && dims) off.push("enveloppe non cylindrique");
    for (const h of facts.holes) { if (axis < 0 || !h.axis) continue; const onAxis = Math.abs(h.axis[axis]) > 0.999 && [0, 1, 2].every((k) => k === axis || Math.abs(h.at[k] - (ctx.bbox[k] + ctx.bbox[3 + k]) / 2) < 0.01); if (!onAxis) off.push(`trou « ${h.source} »`); }
    for (const p of facts.pockets) off.push(`pocket « ${p.source} »`);
    const list = [...new Set(off)];
    if (list.length) ctx.add("TRN-02", { value: list.length, limit: 0, unit: "features hors axe",
      message: `${list.length} élément(s) ne sont pas de révolution (${list.slice(0, 5).join(", ")}${list.length > 5 ? "…" : ""}) ; limite conseillée : 0. Correctif : les placer sur l'axe, ou prévoir un tour à outils tournants (live tooling) / une reprise en fraisage.` });
  });
  ctx.run("TRN-03", () => {
    for (const r of facts.revolves) if (r.rMin < 0.4 - 1e-6) ctx.add("TRN-03", { value: r.rMin, limit: 0.4, unit: "mm", feature: r.source,
      message: `Profil de révolution « ${r.source} » : plus petit rayon R${num(r.rMin)}${r.rMin < 1e-6 ? " (angles vifs)" : ""}. Limite : R ≥ 0,4 mm dans les angles intérieurs (rayon de bec de la plaquette). Correctif : donner R0,4 aux angles intérieurs ou prévoir une gorge de dégagement.` });
  });
  ctx.run("TRN-04", () => {
    if (!(D > 0)) return;
    const BARS = [3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 25, 28, 30, 32, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200];
    const bar = BARS.find((b) => b >= D + 0.5 - 1e-6) || Math.ceil((D + 1) / 10) * 10;
    ctx.add("TRN-04", { value: D, limit: bar, unit: "mm", message: `Ø maxi de la pièce : ${num(D)} mm ; barre standard conseillée : Ø${bar} (longueur ${num(L)} mm + tronçonnage). Correctif : si possible, caler le Ø maxi sur une barre standard pour limiter la matière enlevée.` });
  });
  checkHoleDepths(ctx);
  checkHoleSizes(ctx);
  ctx.run("CNC-07", () => ctx.checkWalls("CNC-07", wallLimits(ctx.cls)));
}
