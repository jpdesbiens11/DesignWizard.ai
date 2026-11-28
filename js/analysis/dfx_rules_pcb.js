/* DynamiteOrbit.ai — DFM rules: printed circuit boards (mechanical envelope + isolation-relevant copper) and purchased
   parts. PCB-01…05 come from the user's rule book; spacing uses IPC-2221B Table 6-1 (FUNCTIONAL spacing — the safety
   insulation, creepage and clearance, is the job of the isolation analysis). Copper zones are read from their bodies
   ("Cu:<net>#n"): a zone given as a free profile is approximated by its bounding rectangle. */

import { THREADS, PCB_THICKNESS } from "../cad/standards.js";
import { rule, num, round, groupBy, getPath } from "./dfx_core.js";

const S = {
  fab: "Capacités des fabricants de PCB (rule of thumb)", ipc: "IPC-2221B Table 6-1 (espacement fonctionnel des conducteurs)", prac: "Pratique PCB",
  iso: "ISO 4762 / ISO 7089 (tête de vis, rondelle) ; règle de pouce pour l'accès outil",
};
const R = {
  p00: rule("PCB-00", "Bloc « pcb » présent", "La carte est décrite dans le bloc « pcb » (size ou outline, t, components, zones, nets)", "warn", "Sans ce bloc, contour, composants et zones ne peuvent pas être vérifiés.", "DynamiteOrbit.ai part language"),
  p01: rule("PCB-01", "Trou au bord de carte", "Bord du trou au bord de carte ≥ épaisseur de la carte", "warn", "Le bord se fissure au détourage.", S.fab),
  p02: rule("PCB-02", "Couronne de tête de vis", "Couronne sans cuivre Ø ≈ rondelle (≈ 2 × trou) autour de chaque trou de fixation", "warn", "La tête de vis court-circuite le cuivre.", S.prac),
  p03: rule("PCB-03", "Rayon de détourage", "Angles intérieurs du contour ≥ R1,0 (fraise Ø2) ; angles extérieurs R1,0 conseillés", "warn", "La fraise de détourage ne fait pas d'angle vif intérieur ; un angle extérieur vif s'ébrèche.", S.fab, { fix: true }),
  p04: rule("PCB-04", "Carte plane", "Une carte est plane (épaisseur constante)", "error", "Un PCB ne se plie pas et ne s'usine pas en relief.", "Pratique PCB", { manual: true }),
  p05: rule("PCB-05", "Épaisseur standard", "0,8 · 1,0 · 1,2 · 1,6 · 2,0 · 2,4 mm (1,6 mm par défaut)", "warn", "Une autre épaisseur coûte plus cher et allonge le délai.", S.fab, { fix: true }),
  p06: rule("PCB-06", "Composant au bord de carte", "Composant à ≥ 2 mm du bord ; connecteurs et pièces hautes (≥ 5 mm) peuvent dépasser volontairement", "warn", "Dépanélisation, manutention et rails de convoyeur ont besoin d'une marge.", "IPC-2221 (edge clearance) ; règle de pouce", { fix: true }),
  p07: rule("PCB-07", "Composants superposés", "Deux empreintes du même côté ne se recouvrent pas", "warn", "Collision des boîtiers au placement.", S.prac),
  p08: rule("PCB-08", "Zones et nets déclarés", "Chaque zone de cuivre porte un net déclaré dans « pcb.nets » (tension)", "warn", "Sans tension déclarée, ni l'espacement IPC ni l'analyse d'isolation ne peuvent être vérifiés.", "DynamiteOrbit.ai part language"),
  p11: rule("PCB-11", "Espacement entre zones", "Distance ≥ IPC-2221B Table 6-1 à la tension entre les nets : B2 (externe nu), A5 (avec vernis), B1 (interne / à travers la carte)", "error", "Amorçage entre conducteurs.", S.ipc),
  p12: rule("PCB-12", "Cuivre au bord de carte", "Zone à ≥ 0,5 mm du bord, et ≥ espacement B2 à la tension du net (bord supposé au potentiel du châssis)", "warn", "Cuivre arraché au détourage ; amorçage vers un guide-carte ou le châssis.", `${S.ipc} ; ${S.fab}`),
  p13: rule("PCB-13", "Zones sous tension et trous de fixation", "Distance de la zone à la tête de vis ≥ IPC-2221B B2 à la tension du net", "warn", "La vis est au potentiel du châssis : arc vers la structure.", S.ipc),
  p20: rule("PCB-20", "Accès aux connecteurs", "Zone libre devant chaque connecteur (sens d'enfichage)", "warn", "La fiche du faisceau ne peut pas être insérée.", S.prac, { manual: true }),
  p21: rule("PCB-21", "Composants près des trous de fixation", "Rien sous la rondelle (+ 0,5 mm) ; pièces hautes (≥ 5 mm) à ≥ 2,5 mm de la rondelle (accès outil)", "warn", "La tête de vis ou la douille touche le composant.", S.iso),
  l01: rule("LIB-01", "Utiliser tel quel", "Aucune modification d'une pièce achetée", "info", "Garde la garantie et les données du fournisseur valides.", "Pratique courante"),
  l02: rule("LIB-02", "Modèle simplifié", "Pas de filets ni de moletage : encombrement et masse seulement", "info", "Un modèle détaillé alourdit l'assemblage sans rien apporter.", "Pratique courante"),
  l03: rule("LIB-03", "Visserie et aluminium", "Inox ou acier zingué avec l'aluminium : vérifier les couples galvaniques ; isoler le carbone de l'aluminium", "info", "Corrosion galvanique.", "Pratique courante", { manual: true }),
  l04: rule("LIB-04", "Référence fournisseur", "Fournisseur et référence exacte (MPN) renseignés", "info", "Sans référence, la pièce ne peut pas être commandée.", "Pratique courante"),
};
export const BOOK_PCB = [
  { process: "pcb", category: "DFM", steps: ["Carte de 1,6 mm sauf raison contraire", "Trous de fixation = une interface bolt_pattern, avec une couronne sans cuivre pour la tête de vis", "Contour : angles ≥ R1,0 pour la fraise Ø2",
    "Composants à ≥ 2 mm du bord, rien sous les têtes de vis", "Déclarer les nets (tension) : les zones HV respectent IPC-2221B"], rules: [R.p00, R.p01, R.p02, R.p03, R.p04, R.p05, R.p06, R.p07, R.p08, R.p11, R.p12, R.p13, R.p20, R.p21] },
  { process: "purchased", category: "DFx", steps: ["Choisir dans le catalogue avant de dessiner quoi que ce soit", "Vérifier la fiche technique de la référence exacte", "Connecteurs : télécharger le STEP du fournisseur"], rules: [R.l01, R.l02, R.l03, R.l04] },
];

/* IPC-2221B Table 6-1 — electrical conductor spacing (mm). Rows: upper voltage of the range (DC or AC peak);
   columns B1 internal, B2 external uncoated ≤ 3050 m, B3 external uncoated > 3050 m, B4 external polymer coated,
   A5 external conformal coated (assembly), A6 component lead uncoated, A7 component lead coated. Above 500 V: per-volt increment. */
const IPC_COLS = ["B1", "B2", "B3", "B4", "A5", "A6", "A7"];
const IPC_ROWS = [[15, [0.05, 0.1, 0.1, 0.05, 0.13, 0.13, 0.13]], [30, [0.05, 0.1, 0.1, 0.05, 0.13, 0.25, 0.13]], [50, [0.1, 0.6, 0.6, 0.13, 0.13, 0.4, 0.13]], [100, [0.1, 0.6, 1.5, 0.13, 0.13, 0.5, 0.13]],
  [150, [0.2, 0.6, 3.2, 0.4, 0.4, 0.8, 0.4]], [170, [0.2, 1.25, 3.2, 0.4, 0.4, 0.8, 0.4]], [250, [0.2, 1.25, 6.4, 0.4, 0.4, 0.8, 0.4]], [300, [0.2, 1.25, 12.5, 0.4, 0.4, 0.8, 0.8]], [500, [0.25, 2.5, 12.5, 0.8, 0.8, 1.5, 0.8]]];
const IPC_PER_V = [0.0025, 0.005, 0.025, 0.00305, 0.00305, 0.00305, 0.00305];
/** Minimum conductor spacing (mm) of IPC-2221B Table 6-1 for a voltage (V, DC or AC peak) and a column ("B1", "B2", "A5"…). */
export function ipcSpacing(voltage, col = "B2") {
  const c = IPC_COLS.indexOf(col), v = Math.abs(voltage);
  if (c < 0 || !Number.isFinite(v)) return null;
  const row = IPC_ROWS.find((r) => v <= r[0]);
  return row ? row[1][c] : round(IPC_ROWS[IPC_ROWS.length - 1][1][c] + (v - 500) * IPC_PER_V[c], 3);
}
const peak = (n) => (n && Number.isFinite(+n.voltage) ? (n.kind === "ac" ? Math.abs(n.voltage) * Math.SQRT2 : Math.abs(n.voltage)) : null);
/** Voltage between two nets {kind, voltage}: difference for DC, sum of the peaks as soon as one is AC; null if unknown. */
export function netVoltage(a, b) {
  if (!a || !b || !Number.isFinite(+a.voltage) || !Number.isFinite(+b.voltage)) return null;
  return a.kind === "ac" || b.kind === "ac" ? peak(a) + peak(b) : Math.abs(a.voltage - b.voltage);
}
const GROUND = /^(CHASSIS|GND|PE|EARTH|TERRE|MASSE)$/i;
const rectGap = (a, b) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]));
const pointGap = (p, r) => Math.hypot(Math.max(0, r[0] - p[0], p[0] - r[2]), Math.max(0, r[1] - p[1], p[1] - r[3]));
const compRect = (c) => [c.at[0] - c.size[0] / 2, c.at[1] - c.size[1] / 2, c.at[0] + c.size[0] / 2, c.at[1] + c.size[1] / 2];

export function checkPcb(ctx) {
  const pcb = ctx.facts.pcb, spec = ctx.spec, raw = spec.pcb || {};
  if (!pcb) { ctx.run("PCB-00", () => ctx.add("PCB-00", { value: "absent", limit: "bloc pcb", message: "Le process est « pcb » mais la pièce n'a pas de bloc « pcb » : contour, épaisseur, composants et zones ne peuvent pas être vérifiés (attendu : « pcb.size » ou « pcb.outline »). Correctif : décrire la carte dans le bloc « pcb »." })); return; }
  const t = pcb.t, bb = pcb.bbox, comps = pcb.components || [], nets = pcb.nets || {}, coated = /conformal|vernis/i.test(String(raw.coating || raw.coat || ""));
  const zones = (pcb.zones || []).map((z, i) => { const b = (ctx.built.bodies || []).find((x) => x.name === z.body); return b && b.bbox ? { ...z, i, rect: [b.bbox[0], b.bbox[1], b.bbox[3], b.bbox[4]], exact: !!(raw.zones && raw.zones[i] && raw.zones[i].rect) } : null; }).filter(Boolean);
  // mounting holes: screw size from the bolt_pattern interface (washer = keep-out), else ring Ø ≈ 2 × hole
  const ifaces = new Map((ctx.built.interfaces || []).map((i) => [i.id, i]));
  const mounts = ctx.facts.holes.filter((h) => h.at && h.d > 0).map((h) => {
    const it = h.iface ? ifaces.get(h.iface) : null, th = it && it.type === "bolt_pattern" && it.params ? THREADS[String(it.params.screw).toUpperCase()] : null;
    return { h, ring: th ? th.washer : 2 * h.d, screw: th ? it.params.screw : null };
  });

  ctx.run("PCB-05", () => {
    if (PCB_THICKNESS.some((s) => Math.abs(s - t) < 1e-6)) return;
    const to = PCB_THICKNESS.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) - 1e-9 ? b : a));
    ctx.add("PCB-05", { value: t, limit: to, unit: "mm", feature: "board",
      message: `Épaisseur de carte ${num(t, 3)} mm : hors standard (${PCB_THICKNESS.map((s) => num(s)).join(" · ")} mm). Correctif : passer à ${num(to)} mm.`,
      fix: ctx.fix(`Passer à ${num(to)} mm (épaisseur standard)`, { target: "spec", id: null, path: "pcb.t", value: to }) });
  });
  ctx.run("PCB-03", () => {
    const board = ctx.facts.extrudes.find((e) => e.source === "board"), loop = board && board.profile && board.profile.outer;
    if (!loop) return;
    let concave = 0, convex = 0, rIn = Infinity;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      if (a.t === "L" && b.t === "L") { const c = (a.b[0] - a.a[0]) * (b.b[1] - b.a[1]) - (a.b[1] - a.a[1]) * (b.b[0] - b.a[0]); if (Math.abs(c) > 1e-9) { if (c < 0) concave++; else convex++; } }
      if (a.t === "A" && a.ccw === false) rIn = Math.min(rIn, a.r);            // clockwise arc on a counter-clockwise outline = inside corner
    }
    const path = raw.outline ? (raw.outline.poly || raw.outline.rect ? "pcb.outline.r" : null) : raw.size ? "pcb.r" : null;
    const fix = path ? ctx.fix("Arrondir les angles du contour à R1,0", { target: "spec", id: null, path, value: 1 }) : null;
    if (concave || rIn < 1 - 1e-6) ctx.add("PCB-03", { value: concave ? 0 : round(rIn), limit: 1, unit: "mm", feature: "board",
      message: `Contour de carte : ${concave ? `${concave} angle(s) intérieur(s) vif(s)` : `rayon intérieur R${num(rIn)}`}. Limite : R ≥ 1,0 mm (fraise de détourage Ø2). Correctif : donner R1,0 aux angles intérieurs du contour.`, fix });
    else if (convex && !(board.rMin >= 1 - 1e-6)) ctx.add("PCB-03", { severity: "info", value: 0, limit: 1, unit: "mm", feature: "board",
      message: `Contour de carte : ${convex} angle(s) extérieur(s) vif(s) (R0). Conseil : R ≥ 1,0 mm (un angle vif s'ébrèche et blesse à la manutention). Correctif : donner R1,0 aux angles de la carte.`, fix });
  });
  ctx.run("PCB-01", () => {
    for (const g of groupBy(mounts, (m) => `${m.h.source}|${m.h.d}`)) {
      let worst = null;
      for (const { h } of g) { const gap = Math.min(h.at[0] - bb[0], bb[2] - h.at[0], h.at[1] - bb[1], bb[3] - h.at[1]) - h.d / 2; if (!worst || gap < worst.gap) worst = { gap, h }; }
      if (worst && worst.gap < t - 1e-6) ctx.add("PCB-01", { value: round(worst.gap), limit: t, unit: "mm", where: worst.h.at, feature: worst.h.source, iface: worst.h.iface,
        message: `Trou Ø${num(worst.h.d)}${g.length > 1 ? ` (× ${g.length})` : ""} « ${worst.h.source} » à ${num(worst.gap)} mm du bord de carte (bord du trou). Limite : ≥ épaisseur de la carte = ${num(t)} mm. Correctif : éloigner le trou du bord de ${num(t - worst.gap)} mm.` });
    }
  });
  ctx.run("PCB-06", () => {
    comps.forEach((c, i) => {
      if (!(c.edge < 2 - 1e-6)) return;
      const free = c.kind === "connector" || c.kind === "terminal" || c.size[2] >= 5, over = c.edge < -1e-6;
      const clamp = (v, half, lo, hi) => (hi - lo < 2 * half + 4 ? null : Math.min(Math.max(v, lo + half + 2), hi - half - 2));
      const x = clamp(c.at[0], c.size[0] / 2, bb[0], bb[2]), y = clamp(c.at[1], c.size[1] / 2, bb[1], bb[3]);
      ctx.add("PCB-06", { severity: free ? "info" : over ? "error" : "warn", value: round(c.edge), limit: 2, unit: "mm", where: [c.at[0], c.at[1], t], feature: `pcb.${c.ref}`,
        message: `${c.ref}${c.name ? ` (${c.name})` : ""} ${over ? `dépasse du bord de carte de ${num(-c.edge)} mm` : `à ${num(c.edge)} mm du bord de carte`}. Limite : ≥ 2 mm${free ? " — toléré pour un connecteur ou une pièce haute (≥ 5 mm) qui dépasse volontairement" : ""}. Correctif : ${free ? "confirmer que le dépassement est voulu, sinon reculer le composant" : "reculer le composant à 2 mm du bord"}.`,
        fix: !free && x !== null && y !== null && raw.components && raw.components[i] ? ctx.fix("Reculer le composant à 2 mm du bord", { target: "spec", id: null, path: `pcb.components.${i}.at`, value: [round(x, 3), round(y, 3)] }) : null });
    });
  });
  ctx.run("PCB-07", () => {
    for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) {
      const a = comps[i], b = comps[j], ra = compRect(a), rb = compRect(b);
      if (a.side !== b.side) continue;
      const ox = Math.min(ra[2], rb[2]) - Math.max(ra[0], rb[0]), oy = Math.min(ra[3], rb[3]) - Math.max(ra[1], rb[1]);
      if (ox > 0.01 && oy > 0.01) ctx.add("PCB-07", { severity: a.kind === "heatsink" || b.kind === "heatsink" ? "info" : "warn", value: round(Math.min(ox, oy)), limit: 0, unit: "mm", where: [(Math.max(ra[0], rb[0]) + Math.min(ra[2], rb[2])) / 2, (Math.max(ra[1], rb[1]) + Math.min(ra[3], rb[3])) / 2, t], feature: `pcb.${a.ref}`,
        message: `${a.ref} et ${b.ref} se recouvrent de ${num(ox)} × ${num(oy)} mm du même côté (${a.side}) ; limite : aucun recouvrement${a.kind === "heatsink" || b.kind === "heatsink" ? " (toléré pour un dissipateur posé sur son composant)" : ""}. Correctif : écarter l'un des deux d'au moins ${num(Math.min(ox, oy))} mm.` });
    }
  });
  ctx.run("PCB-08", () => {
    const bad = zones.filter((z) => !z.net || !nets[z.net] || !Number.isFinite(+nets[z.net].voltage));
    if (bad.length) ctx.add("PCB-08", { value: bad.length, limit: 0, unit: "zones",
      message: `${bad.length} zone(s) de cuivre sans net déclaré (${bad.map((z) => z.net || `zone ${z.i + 1} sans net`).join(", ")}) ; limite : 0 — sans tension, l'espacement IPC-2221B et l'analyse d'isolation ne peuvent pas les traiter. Correctif : donner un « net » à chaque zone et déclarer sa tension dans « pcb.nets » (ex. "HV+": {"kind":"dc","voltage":400}).` });
  });
  ctx.run("PCB-11", () => {
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i], b = zones[j], V = a.net !== b.net ? netVoltage(nets[a.net], nets[b.net]) : null;
      if (V === null || V <= 0) continue;
      const same = a.side === b.side, d = same ? rectGap(a.rect, b.rect) : (rectGap(a.rect, b.rect) > 0 ? null : t);
      if (d === null) continue;
      const b2 = ipcSpacing(V, "B2"), a5 = ipcSpacing(V, "A5"), b1 = ipcSpacing(V, "B1"), need = same ? (coated ? a5 : b2) : b1;
      if (d >= need - 1e-6) continue;
      const hard = (same ? d < a5 - 1e-6 : true) && a.exact && b.exact;
      ctx.add("PCB-11", { severity: hard ? "error" : "warn", value: round(d), limit: need, unit: "mm", where: [(a.rect[0] + a.rect[2] + b.rect[0] + b.rect[2]) / 4, (a.rect[1] + a.rect[3] + b.rect[1] + b.rect[3]) / 4, t], feature: `pcb.zone${a.i + 1}`,
        message: same ? `Zones ${a.net} et ${b.net} (${num(V, 0)} V entre elles) distantes de ${num(d)} mm côté ${a.side}. Limite IPC-2221B Table 6-1 : ${num(b2)} mm sans vernis (B2), ${num(a5)} mm avec vernis (A5)${coated ? " — carte déclarée vernie" : ""}. Correctif : écarter les zones à ${num(need)} mm${!coated && d >= a5 ? ", ou vernir la carte (« pcb.coating »: \"conformal\")" : ""}.`
          : `Zones ${a.net} (${a.side}) et ${b.net} (${b.side}) superposées de part et d'autre de la carte (${num(V, 0)} V) : ${num(t)} mm de FR4 entre elles. Limite IPC-2221B B1 : ${num(b1)} mm. Correctif : épaissir la carte ou décaler les zones.` });
    }
  });
  ctx.run("PCB-12", () => {
    for (const z of zones) {
      const edge = Math.min(z.rect[0] - bb[0], bb[2] - z.rect[2], z.rect[1] - bb[1], bb[3] - z.rect[3]), V = GROUND.test(z.net || "") ? 0 : peak(nets[z.net]);
      const need = Math.max(0.5, V ? ipcSpacing(V, coated ? "A5" : "B2") : 0);
      if (edge < need - 1e-6) ctx.add("PCB-12", { value: round(edge), limit: need, unit: "mm", where: [(z.rect[0] + z.rect[2]) / 2, (z.rect[1] + z.rect[3]) / 2, t], feature: `pcb.zone${z.i + 1}`,
        message: `Zone ${z.net || z.i + 1} à ${num(edge)} mm du bord de carte. Limite : ≥ ${num(need)} mm (${V ? `IPC-2221B ${coated ? "A5" : "B2"} à ${num(V, 0)} V, bord supposé au potentiel du châssis ; ` : ""}0,5 mm mini pour le détourage). Correctif : reculer la zone de ${num(need - edge)} mm.` });
    }
  });
  for (const id of ["PCB-02", "PCB-13"]) ctx.run(id, () => {
    for (const z of zones) {
      if (GROUND.test(z.net || "")) continue;                   // a grounding pad under the screw is intended
      const V = peak(nets[z.net]);
      let worst = null;
      for (const m of mounts) { const gap = pointGap(m.h.at, z.rect) - m.ring / 2; if (!worst || gap < worst.gap) worst = { gap, m }; }
      if (!worst) continue;
      const m = worst.m, need = V ? ipcSpacing(V, coated ? "A5" : "B2") : 0;
      if (id === "PCB-02" && worst.gap < -1e-6) ctx.add("PCB-02", { severity: V >= 60 ? "error" : "warn", value: round(worst.gap), limit: 0, unit: "mm", where: m.h.at, feature: `pcb.zone${z.i + 1}`, iface: m.h.iface,
        message: `Zone ${z.net || z.i + 1}${V ? ` (${num(V, 0)} V)` : ""} sous la tête de vis du trou « ${m.h.source} » : elle entre de ${num(-worst.gap)} mm dans la couronne Ø${num(m.ring)}${m.screw ? ` (rondelle ${m.screw})` : " (2 × trou)"}. Limite : aucun cuivre dans la couronne. Correctif : reculer la zone de ${num(-worst.gap + need)} mm ou déplacer le trou.` });
      if (id === "PCB-13" && worst.gap >= -1e-6 && worst.gap < need - 1e-6) ctx.add("PCB-13", { value: round(worst.gap), limit: need, unit: "mm", where: m.h.at, feature: `pcb.zone${z.i + 1}`, iface: m.h.iface,
        message: `Zone ${z.net} (${num(V, 0)} V) à ${num(worst.gap)} mm de la tête de vis du trou « ${m.h.source} » (vis au potentiel du châssis). Limite IPC-2221B ${coated ? "A5" : "B2"} : ${num(need)} mm. Correctif : reculer la zone de ${num(need - worst.gap)} mm.` });
    }
  });
  ctx.run("PCB-21", () => {
    for (const c of comps) {
      let worst = null;
      for (const m of mounts) { const gap = pointGap(m.h.at, compRect(c)) - m.ring / 2; if (!worst || gap < worst.gap) worst = { gap, m }; }
      if (!worst) continue;
      const under = worst.gap < 0.5 - 1e-6, tall = c.size[2] >= 5 && worst.gap < 2.5 - 1e-6;
      if (!under && !tall) continue;
      ctx.add("PCB-21", { severity: under ? "warn" : "info", value: round(worst.gap), limit: under ? 0.5 : 2.5, unit: "mm", where: [c.at[0], c.at[1], t], feature: `pcb.${c.ref}`, iface: worst.m.h.iface,
        message: under ? `${c.ref} ${worst.gap < 0 ? `empiète de ${num(-worst.gap)} mm sur` : `à ${num(worst.gap)} mm de`} la couronne Ø${num(worst.m.ring)} du trou de fixation « ${worst.m.h.source} »${worst.m.screw ? ` (rondelle ${worst.m.screw})` : ""} : la tête de vis ou la rondelle le touche. Limite : ≥ 0,5 mm. Correctif : écarter le composant de ${num(0.5 - worst.gap)} mm.`
          : `${c.ref} (hauteur ${num(c.size[2])} mm) à ${num(worst.gap)} mm de la rondelle du trou « ${worst.m.h.source} » : accès de l'outil gêné. Limite : ≥ 2,5 mm pour une pièce haute (≥ 5 mm). Correctif : écarter le composant de ${num(2.5 - worst.gap)} mm.` });
    }
  });
}

export function checkPurchased(ctx) {
  const spec = ctx.spec;
  ctx.run("LIB-01", () => {
    const cuts = (spec.features || []).filter((f) => f && !f.suppressed && (f.mode === "cut" || ["hole", "pocket", "slot"].includes(f.op))).length;
    if (cuts) ctx.add("LIB-01", { value: cuts, limit: 0, unit: "usinages", message: `Pièce achetée avec ${cuts} feature(s) d'enlèvement de matière (trous, pockets) ; limite : 0 modification. Correctif : vérifier que ces formes existent sur la pièce du fournisseur — si c'est une reprise, créer une pièce « modifiée » avec son propre process.` });
  });
  ctx.run("LIB-02", () => {
    const n = (spec.features || []).length + ctx.facts.fillets.length;
    if (n > 12) ctx.add("LIB-02", { value: n, limit: 12, unit: "features", message: `Modèle de pièce achetée détaillé (${n} features) ; repère : ≤ 12 — encombrement, interfaces et masse suffisent. Correctif : simplifier (pas de filets, de moletage ni de congés décoratifs).` });
  });
  ctx.run("LIB-04", () => {
    const ref = getPath(spec, "supplier") || getPath(spec, "mpn") || getPath(spec, "purchase.mpn") || getPath(spec, "purchase.supplier");
    if (!ref) ctx.add("LIB-04", { value: "absent", limit: "supplier + mpn", message: "Pièce achetée sans fournisseur ni référence (« supplier », « mpn ») ; attendu : la référence exacte. Correctif : renseigner « supplier » et « mpn » dans la pièce, ou les indiquer dans « notes »." });
  });
}
