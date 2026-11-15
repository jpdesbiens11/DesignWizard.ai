/* DesignWizard.ai — DFx rules that apply to every process: bolted joints and the other interfaces (IF-), general checks
   (GEN-: material, process, parameters, mass, electrical role) and the report of the builder itself (KRN-).
   Sources: ISO 273 (clearance holes), Machinery's Handbook (thread engagement), ASME Y14.5 fixed-fastener rule,
   insert suppliers' boss guidance; edge distances and slenderness limits are rules of thumb. */

import { THREADS, clearanceHole } from "../cad/standards.js";
import { MATERIALS, PROCESSES } from "../cad/materials.js";
import { patternPoints } from "../cad/interfaces.js";
import { rule, num, round, groupBy } from "./dfx_core.js";

const S = {
  mh: "Machinery's Handbook (longueur de filet en prise) ; règle de pouce : 1 × d acier, 1,5 à 2 × d aluminium", iso: "ISO 273 (trous de passage) ; ASME Y14.5 annexe B (fixed fastener rule)",
  thumb: "Règle de pouce (rule of thumb) pour les assemblages boulonnés", ins: "Données des fournisseurs d'inserts (heat-set inserts) ; Covestro part design guide", lang: "DesignWizard part language",
  mat: "materials.js (matières et process associés)",
};
const R = {
  i01: rule("IF-01", "Vis trop près du bord", "Axe de vis au bord de la pièce ≥ 1,5 × d", "warn", "Arrachement du bord (tear-out), pas de place pour la tête ou la rondelle.", S.thumb, { fix: true }),
  i02: rule("IF-02", "Longueur de filet en prise", "Acier / inox ≥ 1 × d ; aluminium, cuivre, laiton ≥ 1,5 × d ; plastique : insert conseillé", "warn", "Un filet trop court ou taillé dans le plastique s'arrache.", S.mh, { fix: true }),
  i03: rule("IF-03", "Élancement des colonnettes et bossages", "Hauteur ≤ 3 × Ø extérieur", "warn", "Une colonnette élancée fléchit ou casse au vissage.", S.thumb, { fix: true }),
  i04: rule("IF-04", "Paroi autour des inserts", "Ø extérieur du bossage ≥ 2 × Ø du trou d'insert", "warn", "Le bossage éclate à la pose à chaud de l'insert ou au serrage.", S.ins, { fix: true }),
  i05: rule("IF-05", "Jeu des trous de passage", "Motif de plusieurs vis : jeu « medium » (ISO 273) → tolérance de position ≥ 0,2 mm", "warn", "Un jeu « close » sur plusieurs vis impose une tolérance de position très serrée (T = (H − F) / 2).", S.iso, { fix: true }),
  i06: rule("IF-06", "Trous de passage sur pièce creuse", "Côté A sur une pièce creuse : « opts.depth » = paroi + 0,5 mm", "warn", "Sans profondeur, les trous traversent toute la pièce.", S.lang, { fix: true }),
  i07: rule("IF-07", "Interface sans clé ni partenaire", "Chaque interface porte « key » et « partner »", "info", "Sans clé, l'assemblage ne peut pas lier automatiquement les deux côtés.", S.lang),
};
const G = {
  g01: rule("GEN-01", "Matière connue", "« material » dans la liste des matières", "warn", "Masse, règles DFM et analyse d'isolation deviennent approximatives.", S.mat),
  g02: rule("GEN-02", "Process connu", "« process » dans la liste des process", "warn", "Sans process, aucune règle DFM ne peut être choisie.", S.mat),
  g03: rule("GEN-03", "Matière adaptée au process", "La matière est proposée pour ce process", "warn", "Ex. : le 6061 s'usine, le 6063 s'extrude, le 5052 se plie.", S.mat, { fix: true }),
  g04: rule("GEN-04", "Budget de masse", "Masse ≤ budget déclaré (« mass_budget », g)", "info", "Suivre la masse dès la conception.", "Pratique DFx"),
  g05: rule("GEN-05", "Rôle électrique des pièces conductrices", "Une pièce conductrice déclare « elec » (net ou châssis)", "info", "L'analyse d'isolation a besoin du potentiel de chaque conducteur.", "Analyse d'isolation (creepage & clearance)"),
  g06: rule("GEN-06", "Paramètres dans leur plage", "min ≤ valeur ≤ max pour chaque paramètre", "warn", "Une valeur hors plage sort du domaine validé par le concepteur.", S.lang, { fix: true }),
  k01: rule("KRN-01", "Erreur de construction", "Le noyau construit toutes les features", "error", "Ce qui n'est pas construit n'existe pas dans la pièce.", "Noyau géométrique (OpenCascade)"),
  k02: rule("KRN-02", "Avertissement de construction", "Aucun avertissement du noyau", "warn", "Une feature partiellement construite (congé refusé, sélection vide).", "Noyau géométrique (OpenCascade)"),
};
export const BOOK_GENERAL = [
  { process: "interfaces", title: "Interfaces (bolted joints)", fr: "Interfaces et assemblages vissés", category: "DFx",
    steps: ["Les interfaces d'abord : lister les voisins et ce qui tient, positionne et relie la pièce", "Même « key », même « type », mêmes « params » des deux côtés", "Vis à ≥ 1,5 × d des bords, filet en prise suffisant", "Inserts dans les plastiques, colonnettes trapues"],
    rules: [R.i01, R.i02, R.i03, R.i04, R.i05, R.i06, R.i07] },
  { process: "general", title: "General DFx", fr: "DFx général", category: "DFx",
    steps: ["Matière et process déclarés et compatibles", "Tout ce qui se règle est un paramètre, dans sa plage", "Masse suivie, rôle électrique déclaré", "Aucune erreur ni avertissement du noyau"],
    rules: [G.g01, G.g02, G.g03, G.g04, G.g05, G.g06, G.k01, G.k02] },
];

const bodyBBox = (ctx, it) => { const b = (ctx.built.bodies || []).find((x) => x.name === it.body); return (b && b.bbox) || ctx.bbox; };
const plastic = (ctx) => ctx.cls === "plastic";

/** Boss outside diameter against its hole (inserts everywhere, every hole in a plastic part). Shared by IF-04, MLD-03, HSG-07. */
export function checkBossRatio(ctx, id) {
  for (const g of groupBy(ctx.facts.holes.filter((h) => h.inBoss > 0 && h.d > 0), (h) => `${h.source}|${h.d}|${h.inBoss}`)) {
    const h = g[0];
    if (!(h.insert || plastic(ctx)) || h.inBoss >= 2 * h.d - 1e-6) continue;
    const to = Math.ceil(2 * h.d * 2 - 1e-9) / 2, raw = ctx.feature(h.source);
    ctx.add(id, { value: h.inBoss, limit: round(2 * h.d), unit: "mm", where: h.at, feature: h.source, iface: h.iface,
      message: `Bossage Ø${num(h.inBoss)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${h.source} » autour d'un trou${h.insert ? " d'insert" : ""} Ø${num(h.d)} : il reste ${num((h.inBoss - h.d) / 2)} mm de paroi. Limite : Ø extérieur ≥ 2 × Ø du trou = ${num(2 * h.d)} mm. Correctif : passer le bossage à Ø${num(to)}.`,
      fix: ctx.fix(`Passer le bossage à Ø${num(to)}`, ctx.patch(h, raw && raw.op === "boss" ? "d" : null, to, "opts.standoff.d")) });
  }
}

/* New pitch of a bolt pattern so that every screw keeps `keep` from the edges; null when the pattern cannot be fixed by its pitch. */
function patternFix(it, bb, keep, d) {
  const pat = (it.params && it.params.pattern) || {}, f = it.frame, type = pat.type || (pat.pcd ? "circle" : pat.nx || pat.ny ? "rect" : "single");
  const inPlane = [0, 1, 2].filter((k) => Math.abs(f.n[k]) < 0.5), half = (k) => Math.min(f.o[k] - bb[k], bb[3 + k] - f.o[k]) - keep;
  if (type === "circle") {
    const h = Math.min(...inPlane.map(half)), pcd = Math.floor(2 * h * 10 + 1e-6) / 10;
    return pcd >= 2.5 * d ? { ops: [{ path: "params.pattern.pcd", value: pcd }], text: `PCD ${num(pcd)} mm` } : null;
  }
  if (type !== "rect") return null;
  const ops = [], text = [];
  for (const [key, dir, n] of [["dx", f.u, Math.max(1, Math.round(pat.nx || 2))], ["dy", f.v, Math.max(1, Math.round(pat.ny || 2))]]) {
    const k = inPlane.find((a) => Math.abs(dir[a]) > 0.99);
    if (k === undefined) return null;                           // rotated pattern: no one-click fix
    const h = half(k), need = (n - 1) / 2 * (pat[key] || 0);
    if (need <= h + 1e-6) continue;
    if (n < 2) return null;
    const pitch = Math.floor(2 * h / (n - 1) * 10 + 1e-6) / 10;
    if (pitch < 2.5 * d) return null;
    ops.push({ path: `params.pattern.${key}`, value: pitch }); text.push(`${key} = ${num(pitch)} mm`);
  }
  return ops.length ? { ops, text: text.join(", ") } : null;
}

export function checkInterfaces(ctx) {
  const { facts } = ctx, ifaces = (ctx.built.interfaces || []).filter((i) => i && i.frame), bolts = ifaces.filter((i) => i.type === "bolt_pattern" && i.params);
  ctx.run("IF-01", () => {
    if (ctx.process === "pcb") return;                          // boards: PCB-01
    for (const it of bolts) {
      const th = THREADS[String(it.params.screw).toUpperCase()], bb = bodyBBox(ctx, it), f = it.frame;
      if (!th || !bb || (it.opts && it.opts.port)) continue;      // a screw port of an extruded profile : the screw is held by its boss, not by an edge distance
      const sign = it.side === "B" ? -1 : 1, o = it.opts || {};
      const holeR = (it.side === "A" || o.thread === "clearance" ? clearanceHole(it.params.screw, o.fit || "medium") : o.thread === "insert" ? th.insert[0] : th.tap) / 2;
      let worst = null;
      for (const [pu, pv] of patternPoints(it.params.pattern)) {
        const P = [0, 1, 2].map((k) => f.o[k] + f.u[k] * pu + f.v[k] * pv * sign);
        const e = Math.min(...[0, 1, 2].filter((k) => Math.abs(f.n[k]) < 0.5).flatMap((k) => [P[k] - bb[k], bb[3 + k] - P[k]]));
        if (!worst || e < worst.e) worst = { e, P };
      }
      const lim = 1.5 * th.d;
      if (!worst || worst.e >= lim - 1e-6) continue;
      const fx = patternFix(it, bb, lim, th.d);
      ctx.add("IF-01", { severity: worst.e < holeR + 0.05 ? "error" : "warn", value: round(worst.e), limit: round(lim), unit: "mm", where: worst.P, iface: it.id,
        message: `Interface « ${it.id} » (${it.params.screw}) : une vis est à ${num(worst.e)} mm du bord de la pièce (axe de la vis)${worst.e < holeR + 0.05 ? " — le trou coupe le bord" : ""}. Limite : ≥ 1,5 × d = ${num(lim)} mm. Correctif : ${fx ? `resserrer le motif (${fx.text}) — les « params » sont partagés avec la pièce d'en face` : "éloigner le motif du bord (« at ») ou agrandir la pièce"}.`,
        fix: fx ? { label: `Resserrer le motif : ${fx.text}`, patch: fx.ops.map((op) => ({ target: "interface", id: it.id, ...op })) } : null });
    }
  });
  ctx.run("IF-02", () => {
    const soft = /^(AL|CU|BRASS)/i.test(String(ctx.spec.material || "")), k = soft ? 1.5 : 1, moulded = ["injection_molding", "fdm", "mjf"].includes(ctx.process);
    for (const it of bolts) {
      const o = it.opts || {}, th = THREADS[String(it.params.screw).toUpperCase()];
      if (it.side !== "B" || !th || (o.thread || "tapped") !== "tapped") continue;
      if (plastic(ctx)) {
        ctx.add("IF-02", { severity: moulded ? "warn" : "info", value: "tapped", limit: "insert", where: it.frame.o, iface: it.id,
          message: `Interface « ${it.id} » : filetage ${it.params.screw} taillé directement dans le plastique (${ctx.spec.material}) ; attendu : un insert — un filet plastique s'arrache après quelques démontages. Correctif : passer en insert (heat-set insert, « opts.thread »: "insert").`,
          fix: { label: `Passer en insert ${it.params.screw}`, patch: [{ target: "interface", id: it.id, path: "opts.thread", value: "insert" }] } });
        continue;
      }
      if (ctx.cls !== "metal") continue;
      const bb = bodyBBox(ctx, it), ax = [0, 1, 2].find((a) => Math.abs(it.frame.n[a]) > 0.5), span = bb ? bb[3 + ax] - bb[ax] : Infinity;
      let depth = typeof o.depth === "number" ? o.depth : o.depth === "through" ? span : 2.5 * th.d;
      if (o.standoff && o.standoff.h > 0) depth = Math.min(depth, o.standoff.h + (o.standoff.into || 0));
      const eng = Math.min(depth, span), lim = k * th.d;
      if (eng >= lim - 1e-6) continue;
      const thin = span < lim - 1e-6, to = Math.ceil(lim * 2 - 1e-9) / 2;
      ctx.add("IF-02", { value: round(eng), limit: round(lim), unit: "mm", where: it.frame.o, iface: it.id,
        message: `Interface « ${it.id} » : ${num(eng)} mm de filet ${it.params.screw} en prise dans ${ctx.spec.material}. Limite : ≥ ${num(k, 1)} × d = ${num(lim)} mm. Correctif : ${thin ? `la pièce ne fait que ${num(span)} mm d'épaisseur : prévoir un écrou (« opts.thread »: "clearance"), un insert serti ou épaissir localement` : `porter la profondeur à ${num(to)} mm`}.`,
        fix: thin || (o.standoff && o.standoff.h > 0) ? null : { label: `Porter la profondeur de filet à ${num(to)} mm`, patch: [{ target: "interface", id: it.id, path: "opts.depth", value: to }] } });
    }
    if (ctx.cls !== "metal") return;
    for (const g of groupBy(facts.holes.filter((h) => h.thread && !h.iface && !h.through && h.depth > 0), (h) => `${h.source}|${h.depth}`)) {
      const h = g[0], th = THREADS[String(h.thread).toUpperCase()], raw = ctx.feature(h.source);
      if (!th || h.depth >= k * th.d - 1e-6) continue;
      const to = Math.ceil(k * th.d * 2 - 1e-9) / 2;
      ctx.add("IF-02", { value: h.depth, limit: round(k * th.d), unit: "mm", where: h.at, feature: h.source,
        message: `Taraudage ${h.thread} « ${h.source} »${g.length > 1 ? ` (× ${g.length})` : ""} : ${num(h.depth)} mm de filet en prise dans ${ctx.spec.material}. Limite : ≥ ${num(k, 1)} × d = ${num(k * th.d)} mm. Correctif : porter la profondeur à ${num(to)} mm.`,
        fix: ctx.fix(`Porter la profondeur à ${num(to)} mm`, ctx.patch(h, raw && raw.op === "boss" ? "hole.depth" : raw && raw.op === "hole" ? "depth" : null, to)) });
    }
  });
  ctx.run("IF-03", () => {
    for (const g of groupBy(facts.bosses.filter((b) => b.d > 0 && b.h > 0), (b) => `${b.source}|${b.d}|${b.h}`)) {
      const b = g[0];
      if (b.h <= 3 * b.d + 1e-6) continue;
      const to = Math.ceil(b.h / 3 * 2 - 1e-9) / 2, raw = ctx.feature(b.source);
      ctx.add("IF-03", { value: round(b.h / b.d), limit: 3, unit: "× Ø", where: b.at, feature: b.source, iface: b.iface,
        message: `${b.iface ? "Colonnette (standoff)" : "Bossage"} « ${b.source} »${g.length > 1 ? ` (× ${g.length})` : ""} : hauteur ${num(b.h)} mm pour Ø${num(b.d)}, soit ${num(b.h / b.d, 1)} × Ø. Limite : 3 × Ø. Correctif : passer le Ø à ${num(to)} mm, réduire la hauteur ou relier la colonnette à une paroi par une nervure.`,
        fix: ctx.fix(`Passer le Ø à ${num(to)} mm`, ctx.patch(b, raw && raw.op === "boss" ? "d" : null, to, "opts.standoff.d")) });
    }
  });
  ctx.run("IF-04", () => { if (!["injection_molding", "fdm", "mjf"].includes(ctx.process)) checkBossRatio(ctx, "IF-04"); });   // moulded / printed parts: MLD-03, HSG-07
  ctx.run("IF-05", () => {
    for (const it of bolts) {
      const o = it.opts || {}, th = THREADS[String(it.params.screw).toUpperCase()], n = patternPoints(it.params.pattern).length;
      if (it.side !== "A" || !th || n < 2 || !["close", "fine"].includes(o.fit)) continue;
      const T = (clearanceHole(it.params.screw, "close") - th.d) / 2, Tm = (clearanceHole(it.params.screw, "medium") - th.d) / 2;
      if (T >= 0.2 - 1e-6) continue;
      ctx.add("IF-05", { value: round(T), limit: 0.2, unit: "mm", where: it.frame.o, iface: it.id,
        message: `Interface « ${it.id} » : ${n} vis ${it.params.screw} avec un jeu « close » (Ø${num(clearanceHole(it.params.screw, "close"))}) → tolérance de position de ${num(T)} mm seulement (T = (H − F) / 2). Limite conseillée : ≥ 0,2 mm. Correctif : passer en jeu « medium » (Ø${num(clearanceHole(it.params.screw, "medium"))}, T = ${num(Tm)} mm) et confier la position à des goupilles si elle doit être précise.`,
        fix: { label: `Passer en jeu « medium » (Ø${num(clearanceHole(it.params.screw, "medium"))})`, patch: [{ target: "interface", id: it.id, path: "opts.fit", value: "medium" }] } });
    }
  });
  ctx.run("IF-06", () => {
    if (!ctx.hollow) return;
    const t = Math.min(...facts.shells.map((s) => s.t));
    for (const it of ifaces) {
      const o = it.opts || {};
      if (it.side !== "A" || !["bolt_pattern", "cutout", "pins"].includes(it.type) || typeof o.depth === "number") continue;
      ctx.add("IF-06", { value: "through", limit: round(t + 0.5), unit: "mm", where: it.frame.o, iface: it.id,
        message: `Interface « ${it.id} » côté A sur une pièce creuse sans « opts.depth » : les trous traversent toute la pièce au lieu de la seule paroi (${num(t)} mm) ; attendu : paroi + 0,5 mm. Correctif : donner « opts.depth » = ${num(t + 0.5)} mm.`,
        fix: { label: `Limiter la profondeur à ${num(t + 0.5)} mm (paroi + 0,5)`, patch: [{ target: "interface", id: it.id, path: "opts.depth", value: round(t + 0.5) }] } });
    }
  });
  ctx.run("IF-07", () => {
    const bad = (ctx.built.interfaces || []).filter((i) => i && (!i.key || !i.partner));
    if (bad.length) ctx.add("IF-07", { value: bad.length, limit: 0, unit: "interfaces",
      message: `${bad.length} interface(s) sans « key » ou sans « partner » : ${bad.map((i) => `${i.id} (${[!i.key && "key", !i.partner && "partner"].filter(Boolean).join(" + ")})`).join(", ")} ; limite : 0. Correctif : donner à chaque interface la même « key » que sur la pièce d'en face et le nom du voisin dans « partner ».` });
  });
}

export function checkGeneral(ctx) {
  const { spec, built } = ctx;
  ctx.run("GEN-01", () => {
    if (!spec.material) ctx.add("GEN-01", { value: "absent", limit: "material", message: "« material » manquant : la masse et les règles DFx sont approximatives ; attendu : une matière de la liste. Correctif : renseigner « material » (ex. AL6061-T6, PA66-GF30, FR4)." });
    else if (!ctx.mat) ctx.add("GEN-01", { value: spec.material, limit: "liste des matières", message: `Matière inconnue « ${spec.material} » : masse calculée à 1 g/cm³ et règles DFM approximatives ; attendu : une matière de la liste. Correctif : choisir parmi ${MATERIALS.slice(0, 8).map((m) => m.id).join(", ")}…` });
  });
  ctx.run("GEN-02", () => {
    if (!spec.process) ctx.add("GEN-02", { value: "absent", limit: "process", message: "« process » manquant : aucune règle DFM de procédé n'a pu être appliquée ; attendu : un process de la liste. Correctif : renseigner « process » (cnc_milling, sheet_metal, extrusion_al, injection_molding, pcb…)." });
    else if (!PROCESSES[spec.process]) ctx.add("GEN-02", { value: spec.process, limit: "liste des process", message: `Process inconnu « ${spec.process} » : aucune règle DFM de procédé n'a pu être appliquée ; attendu : un process de la liste. Correctif : choisir parmi ${Object.keys(PROCESSES).join(", ")}.` });
  });
  ctx.run("GEN-03", () => {
    if (!ctx.mat || !PROCESSES[spec.process] || spec.process === "purchased" || (ctx.mat.processes || []).includes(spec.process)) return;
    const alt = MATERIALS.find((m) => m.cls === ctx.mat.cls && (m.processes || []).includes(spec.process));
    ctx.add("GEN-03", { value: spec.material, limit: spec.process,
      message: `${ctx.mat.name} n'est pas une matière courante pour « ${PROCESSES[spec.process].fr} » (ses process : ${(ctx.mat.processes || []).join(", ") || "aucun"}). Correctif : ${alt ? `passer à ${alt.id} (${alt.name})` : "choisir une matière proposée pour ce process"}, ou changer de process.`,
      fix: alt ? { label: `Passer à ${alt.id}`, patch: [{ target: "spec", id: null, path: "material", value: alt.id }] } : null });
  });
  ctx.run("GEN-04", () => {
    if (!(built.mass > 0)) return;
    const budget = [spec.mass_budget, spec.mass_max, spec.budget && spec.budget.mass, spec.targets && spec.targets.mass].find((v) => typeof v === "number" && v > 0);
    const over = budget !== undefined && built.mass > budget + 1e-9;
    ctx.add("GEN-04", { severity: over ? "warn" : "info", value: round(built.mass, 1), limit: budget ?? null, unit: "g",
      message: `Masse : ${num(built.mass, 1)} g (${ctx.mat ? ctx.mat.name : "matière inconnue, 1 g/cm³"}, ${num(built.volume / 1000, 1)} cm³)${budget !== undefined ? ` ; budget : ${num(budget, 1)} g` : " ; aucun budget déclaré (« mass_budget », en grammes)"}. Correctif : ${over ? `alléger de ${num(built.mass - budget, 1)} g (parois, pockets d'allègement, matière)` : "aucun"}.` });
  });
  ctx.run("GEN-05", () => {
    const bare = (built.bodies || []).filter((b) => b.conductive && !b.net && !["chassis", "none"].includes(b.elecKind || ""));
    if (bare.length) ctx.add("GEN-05", { value: bare.length, limit: 0, unit: "corps conducteurs",
      message: `${bare.length} corps conducteur(s) sans rôle électrique (${bare.slice(0, 5).map((b) => b.name).join(", ")}${bare.length > 5 ? "…" : ""}) ; attendu : un « net » ou le rôle châssis. Correctif : déclarer « elec » ({"kind":"chassis"}, {"kind":"conductor","net":"HV+"} ou {"kind":"none"}) pour que l'analyse d'isolation connaisse leur potentiel.` });
  });
  ctx.run("GEN-06", () => {
    const defs = (built.params && built.params.defs) || {};
    for (const [name, d] of Object.entries(defs)) {
      const v = d.resolved;
      if (typeof v !== "number" || d.derived) continue;
      const lo = typeof d.min === "number" && v < d.min - 1e-9, hi = typeof d.max === "number" && v > d.max + 1e-9;
      if (!lo && !hi) continue;
      const to = lo ? d.min : d.max;
      ctx.add("GEN-06", { value: v, limit: to, unit: d.unit || "", feature: name,
        message: `Paramètre « ${name} »${d.label ? ` (${d.label})` : ""} = ${num(v, 3)} : hors de sa plage [${num(d.min, 3)} ; ${num(d.max, 3)}]. Correctif : le ramener à ${num(to, 3)}, ou élargir la plage si la valeur est voulue.`,
        fix: { label: `Ramener « ${name} » à ${num(to, 3)}`, patch: [{ target: "param", id: name, path: "value", value: to }] } });
    }
  });
  ctx.run("KRN-01", () => { for (const l of built.log || []) if (l && l.level === "error") ctx.add("KRN-01", { value: l.feature || null, message: `${l.msg} (Attendu : chaque feature construite ; correctif : corriger cette feature puis reconstruire.)`, feature: l.feature || null }); });
  ctx.run("KRN-02", () => { for (const l of built.log || []) if (l && l.level === "warn") ctx.add("KRN-02", { value: l.feature || null, message: `${l.msg} (Attendu : aucun avertissement ; correctif : ajuster la valeur ou la sélection de cette feature.)`, feature: l.feature || null }); });
}
