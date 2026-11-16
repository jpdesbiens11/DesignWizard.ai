/* DesignWizard.ai — electrical interfaces : how two conductors are joined.
   weld    : a permanent joint — laser, resistance spots, ultrasonic, or bonded wires (wirebonding) — between a thin side
             (a tab, the tongue of a busbar, the foot of a wire) and a terminal (the cap of a cell, a thick bar, a pad).
   contact : a pressure contact between two FLAT lands of solid conductors, in one of three forms (CONTACT_FORMS) : pointed
             bosses embossed in the bar itself (they can also be projection-welded), spring blades lanced and arched in a
             thin bar, or a band of stamped lamellae laid between the two lands. Pressed together, each point, blade or
             lamella makes one contact point. For a signal (a few milliamperes) as for power (hundreds of amperes).
   The figures are first-order estimates to size a first design — Holm's constriction resistance for a contact point, Preece's
   fusing current for a wire — never a rating : the test and the datasheet of the part bought prevail. No kernel, no DOM. */

const round2 = (x) => Math.round(x * 100) / 100, frn = (x, d = 2) => String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",");

/** Joining processes : what each asks before, how it is done, how it is checked. */
export const WELD_PROCESSES = {
  laser: { fr: "Soudure laser", unit: "cordon", prep: "Dégraisser les deux faces ; brider sans jeu (jeu ≤ 10 % de l'épaisseur de la languette)", tool: "Laser et bridage dédié", control: "Arrachement sur éprouvettes, coupe métallographique, résistance de la liaison en 4 fils",
    note: "Cuivre sur aluminium : composés intermétalliques fragiles — paramètres à qualifier, ou face nickelée." },
  resistance: { fr: "Soudure par résistance", unit: "point", prep: "Faces propres ; languette de 0,1 à 0,3 mm", tool: "Soudeuse par points à électrodes parallèles", control: "Arrachement de la languette : la matière doit se déchirer autour des points",
    note: "Pour des languettes minces sur des bornes de cellule ; au-delà de 0,3 mm, préférer le laser." },
  ultrasonic: { fr: "Soudure par ultrasons", unit: "empreinte", prep: "Faces propres et sèches ; enclume sous la pièce", tool: "Soudeuse à ultrasons, sonotrode adaptée", control: "Arrachement sur éprouvettes ; empreinte complète de la sonotrode",
    note: "Sans fusion : convient à l'aluminium sur le cuivre et aux feuillards." },
  wirebond: { fr: "Câblage par fils (wirebonding)", unit: "fil", prep: "Plages propres, planes, sans oxyde épais ; pièces bridées, sans vibration", tool: "Machine de câblage par fils (ultrasons)", control: "Essai de traction des fils (pull test) et de cisaillement des pieds",
    note: "Le fil sert souvent de fusible : son courant de fusion se choisit, il ne se subit pas." },
};
/** Bond wires : Preece's constant K (A / mm^1.5), fusing current I = K · d^1.5. */
export const BOND_WIRES = { Al: { fr: "aluminium", K: 59.2 }, Cu: { fr: "cuivre", K: 80 } };
/** Contact platings : resistivity (Ω·m), hardness (Pa), softening voltage (V) — textbook orders of magnitude — and the standards that specify them. */
export const PLATINGS = {
  Ag: { fr: "Argent", rho: 1.6e-8, H: 0.9e9, soften: 0.09, std: "ASTM B700, ISO 4521", use: "Puissance : la référence pour les contacts à fort courant", signal: false },
  Sn: { fr: "Étain", rho: 1.15e-7, H: 0.07e9, soften: 0.07, std: "ASTM B545, ISO 2093", use: "Économique ; sensible à l'usure par petits débattements (fretting) : effort élevé, peu de cycles", signal: false },
  Au: { fr: "Or dur sur nickel", rho: 3.5e-8, H: 1.8e9, soften: 0.08, std: "ASTM B488, ISO 27874 ; sous-couche nickel ASTM B689", use: "Signal et faibles courants : pas d'oxyde, faible effort", signal: true },
  Ni: { fr: "Nickel", rho: 7e-8, H: 3e9, soften: 0.22, std: "ASTM B689", use: "Barrière et tenue à la corrosion ; résistance de contact plus élevée", signal: false },
};
/** What a contact is formed in : conductivity (% IACS), Young's modulus E (GPa) and elastic limit Rp (MPa) — TYPICAL values of
    each family, written from practice and not read again on a data sheet — and the standard of the strip. */
export const CONTACT_BASES = {
  CuBe: { fr: "Cuivre-béryllium (C17200)", iacs: 22, E: 131, Rp: 1000, std: "ASTM B194", use: "Le ressort de référence : forte élasticité, tient l'effort dans le temps" },
  CuNiSi: { fr: "Cuivre-nickel-silicium (C70250)", iacs: 40, E: 131, Rp: 650, std: "ASTM B422", use: "Bon compromis ressort / conductivité, sans béryllium" },
  CuSn: { fr: "Bronze phosphoreux (C51900)", iacs: 15, E: 118, Rp: 500, std: "ASTM B103", use: "Économique, pour les signaux et les petits courants" },
  Cu: { fr: "Cuivre de la barre (demi-dur)", iacs: 100, E: 117, Rp: 250, std: "nuance de la barre", use: "La lame ou le bossage est formé dans la barre elle-même : rien à rapporter, mais le cuivre garde mal son effort à chaud" },
};
/** The forms a pressure contact takes. integral : formed in the bar itself (nothing to buy). */
export const CONTACT_FORMS = {
  cone: { fr: "Bossages coniques", name: "Contact à bossages", unit: "bossage", integral: true, text: "Des bossages emboutis en pointe dans la barre elle-même : chaque pointe fait un point de contact, et peut servir de bossage de soudage. Pour une barre de 1 mm et plus." },
  bridge: { fr: "Lames à ressort", name: "Contact à lames", unit: "lame", integral: true, text: "Des lames découpées et cambrées en pont dans une barre mince : chaque lame fléchit et rattrape les défauts de planéité." },
  band: { fr: "Bande de lamelles rapportée", name: "Contact à lamelles", unit: "lamelle", integral: false, text: "Une bande de lamelles en alliage à ressort, revêtue, posée entre les deux plages : beaucoup de points en parallèle, pour les forts courants." },
};
/** The form of a contact : the one it says, else the one its old option meant (a band, unless it was marked integral). */
export const contactForm = (p = {}, o = {}) => (CONTACT_FORMS[p.form] ? p.form : o && o.band === "integral" ? "cone" : "band");
/** Embossed projections of the spherical type — [diameter d1, height a] in mm — as read in the preview of ISO/FDIS 8167:2021, table 1.
    The standard covers steels, stainless steels and nickel alloys up to 3 mm : for copper it is a starting point, to qualify. */
export const PROJECTIONS = [[1.6, 0.4], [2, 0.5], [2.5, 0.63], [3.2, 0.8], [4, 1], [5, 1.25], [6.3, 1.6], [8, 2]];
/** The projection of the series for a standing height, no wider than the room : { d1, a, exact (the height is the one of the series) }. */
export function projectionFor(gap, room = Infinity) {
  const fit = PROJECTIONS.filter(([d]) => d <= room), list = fit.length ? fit : [PROJECTIONS[0]];
  const [d1, a] = list.reduce((best, x) => (Math.abs(x[1] - gap) < Math.abs(best[1] - gap) ? x : best), list[0]);
  return { d1, a, exact: Math.abs(a - gap) <= 0.15 * a };
}
/** Voltage classes of ISO 6469-3 (table 1, as read in the preview of ISO/DIS 6469-3:2020) : maximum working voltage, d.c. and a.c. r.m.s. */
export const VOLTAGE_CLASSES = { A: { dc: 60, ac: 30, fr: "classe A (jusqu'à 60 V continu, 30 V alternatif)" }, B1: { dc: 75, ac: 50, fr: "classe B1 (60 à 75 V continu)" }, B2: { dc: 1500, ac: 1000, fr: "classe B2 (75 à 1500 V continu)" } };
export function voltageClass(u, ac = false) {
  const v = Number(u); if (!(v > 0)) return null;
  for (const [k, c] of Object.entries(VOLTAGE_CLASSES)) if (v <= (ac ? c.ac : c.dc)) return k;
  return "over";
}
export const CONTACT_TESTS = "Résistance de contact : IEC 60512-2-1 ; courant admissible et échauffement : IEC 60512-5-2";

/** A pressure contact, to first order. p : { n, force (N per point), plating, i (A) }. → { a (µm), rPoint, rTotal (mΩ), iPoint, iMax (A), drop (mV), loss (W), ok, notes } */
export function contactEstimate(p) {
  const P = PLATINGS[p.plating] || PLATINGS.Ag, n = Math.max(1, Math.round(p.n || 1)), F = Math.max(0.05, Number(p.force) || 1), i = Math.max(0, Number(p.i) || 0);
  const a = Math.sqrt(F / (Math.PI * P.H)), rPoint = P.rho / (2 * a), rTotal = rPoint / n, iPoint = 0.1 * P.soften / rPoint, iMax = iPoint * n * 0.8;      // a tenth of the softening voltage across a point ; 80 % : the points never share evenly
  const notes = [];
  if (p.duty === "signal" && !P.signal) notes.push(`${P.fr} pour un signal : la couche d'oxyde peut couper un courant de quelques milliampères — or dur sur nickel conseillé.`);
  if (p.plating === "Sn" && F < 1) notes.push("Étain : au moins 1 N par point pour percer l'oxyde.");
  if (i > iMax) notes.push(`${frn(i, 1)} A demandés pour environ ${frn(iMax, 1)} A estimés : plus de points, plus d'effort, ou argent.`);
  if (n < 2) notes.push("Un seul point de contact : aucune redondance.");
  return { a: a * 1e6, rPoint: rPoint * 1e3, rTotal: rTotal * 1e3, iPoint, iMax, drop: i * rTotal * 1e3, loss: i * i * rTotal, ok: !notes.length, notes };
}
/** A lanced spring blade, as a beam built in at both feet and pushed at mid-span : δ = F L³ / (192 E I), M = F L / 8, so that
    the stress is 12 E t δ / L² — eight times that of a free finger of the same length. p : { l (span), w, t (mm), base }.
    → { k (N/mm), deflMax (mm : the deflection it takes and springs back from), forceMax (N, at that deflection), limit (MPa) } */
export function bridgeSpring(p) {
  const B = CONTACT_BASES[p.base] || CONTACT_BASES.Cu, l = Math.max(0.5, Number(p.l) || 6), w = Math.max(0.2, Number(p.w) || 2), t = Math.max(0.05, Number(p.t) || 0.3);
  const k = 192 * B.E * 1e3 * (w * t ** 3 / 12) / l ** 3, deflMax = B.Rp * l * l / (12 * B.E * 1e3 * t);
  return { k, deflMax, forceMax: k * deflMax, limit: B.Rp };
}
/** The blades or the bosses of a land : how many per row, their pitch and their size. → { n, rows, per, pitch, d (boss), l, w (blade) } */
export function contactLayout(p) {
  const n = Math.max(1, Math.min(24, Math.round(p.n || 1))), rows = n > 6 && p.h >= 6 ? 2 : 1, per = Math.ceil(n / rows), pitch = p.w / per, lane = p.h / rows;
  return { n, rows, per, pitch, lane, d: round2(Math.max(0.6, Math.min(pitch * 0.6, lane * 0.7, 3))), l: round2(Math.max(1.5, Math.min(lane * 0.85, 12))), w: round2(Math.max(0.5, pitch * 0.55)) };
}
/** What the platform would choose for a current, a voltage and a bar thickness — a starting point, with its reasons. The
    thresholds (150 A, 1 mm) are the platform's own marks ; the 1 mm one follows what ISO 8167 says of spherical projections.
    p : { i (A), u (V d.c.), t (bar thickness, mm), duty, force }. → { cls, form, plating, n, why: [text], standards: [text] } */
export function contactAdvice(p = {}) {
  const i = Math.max(0, Number(p.i) || 0), t = Number(p.t) || 0, cls = voltageClass(p.u), signal = p.duty === "signal" || (i > 0 && i < 1);
  const form = i > 150 ? "band" : t > 0 && t < 1 ? "bridge" : "cone", plating = signal ? "Au" : "Ag", why = [];
  let n = 2; while (n < 24 && contactEstimate({ n, force: p.force || 2, plating, i }).iMax < i) n++;
  why.push(form === "band" ? `${frn(i, 0)} A : au-delà de 150 A, beaucoup de points en parallèle — une bande de lamelles rapportée.` : form === "bridge" ? `Barre de ${frn(t)} mm : sous 1 mm, un bossage s'écrase — des lames cambrées, qui fléchissent.` : "Barre de 1 mm et plus : des bossages emboutis en pointe dans la barre.");
  why.push(signal ? "Signal : or dur sur nickel, pas d'oxyde à percer ; deux points au moins." : `Puissance : argent ; ${n} points au moins pour ${frn(i, 0)} A à ${frn(p.force || 2, 1)} N par point (estimation de Holm).`);
  if (cls && cls !== "A") why.push(`${cls === "over" ? "Au-delà de la classe B" : VOLTAGE_CLASSES[cls].fr} : la plage nue doit être hors d'atteinte (capot, gaine à fenêtre) et les distances d'isolement se vérifient dans l'outil Isolation.`);
  const standards = cls && cls !== "A" ? ["ISO 6469-3 (classe de tension B : protection contre le contact direct, marquage)", "USCAR-37, LV 215-1 (connecteurs haute tension)", "IEC 60664-1 (distances d'isolement)", CONTACT_TESTS] : ["USCAR-2, LV 214 (connecteurs basse tension)", CONTACT_TESTS];
  return { cls, form, plating, n, why, standards };
}
/** What the form of a contact is made of, in a line or two : the size of its bosses or of its blades, and what a blade can take. */
export function contactFacts(p = {}, o = {}) {
  const form = contactForm(p, o), L = contactLayout(p);
  if (form === "cone") { const pr = projectionFor(p.gap || 0.5, Math.min(L.pitch, L.lane) * 0.8); return [`${L.n} bossages Ø ${frn(pr.d1)} mm en pointe (sommet Ø ${frn(round2(pr.d1 * 0.3))}), hauts de ${frn(p.gap || 0.5)} mm — série de l'ISO 8167, type sphérique (Ø ${frn(pr.d1)} × ${frn(pr.a)}).`]; }
  if (form === "bridge") { const base = p.base || "Cu", sp = bridgeSpring({ l: L.l, w: L.w, t: p.t || 0.3, base }), B = CONTACT_BASES[base] || CONTACT_BASES.Cu;
    return [`${L.n} lames de ${frn(L.l)} × ${frn(L.w)} × ${frn(p.t || 0.3)} mm, ${B.fr.split(" (")[0].toLowerCase()} : chacune fléchit et revient jusqu'à environ ${frn(sp.deflMax, 3)} mm, pour ${frn(sp.forceMax, 1)} N ; au-delà elle se met en place une fois pour toutes.`]; }
  return [`Une bande de ${L.n} lamelles rapportée entre les deux plages : les lamelles travaillent en parallèle.`];
}
/** What the form of a contact asks to check, beyond its resistance. p : the parameters of the contact ; o : its options. */
export function contactFormNotes(p = {}, o = {}) {
  const form = contactForm(p, o), L = contactLayout(p), notes = [];
  if (form === "cone") { const pr = projectionFor(p.gap || 0.5, Math.min(L.pitch, L.lane) * 0.8);
    if (!pr.exact) notes.push(`Hauteur de ${frn(p.gap || 0.5)} mm : le bossage normalisé le plus proche fait Ø ${frn(pr.d1)} × ${frn(pr.a)} mm (ISO 8167, type sphérique).`);
    if (p.weld === "projection") notes.push("Soudé par bossage : la liaison devient permanente. L'ISO 8167 couvre les aciers, les inox et les alliages de nickel jusqu'à 3 mm, pas le cuivre ni l'aluminium : paramètres à qualifier avec le soudeur, par arrachement.", "Soudage de plusieurs bossages à la fois : leurs hauteurs à 5 % près les unes des autres."); }
  if (form === "bridge") { const base = p.base || "Cu", sp = bridgeSpring({ l: L.l, w: L.w, t: p.t || 0.3, base });
    if (sp.forceMax < (p.force || 2)) notes.push(`${frn(p.force || 2, 1)} N demandés par point : la lame en donne ${frn(sp.forceMax, 1)} avant de se déformer — une lame plus épaisse ou plus courte, ou un alliage à ressort.`);
    else if (sp.deflMax < 0.03) notes.push("Moins de 0,03 mm de course élastique : la planéité des deux plages doit être meilleure que cela — une lame plus longue ou plus mince rattrape davantage.");
    if (base === "Cu" && p.duty !== "signal") notes.push("Lames formées dans le cuivre de la barre : l'effort se relâche à chaud — à vérifier par un essai d'échauffement, ou rapporter une bande en alliage à ressort."); }
  if (p.weld === "projection" && form !== "cone") notes.push("Le soudage par bossage demande des bossages : choisir la forme « bossages coniques ».");
  return notes;
}
/** A welded or wire-bonded joint, to first order. → { area (mm²), fuse (A per wire), fuseTotal (A), notes } */
export function weldEstimate(p) {
  const out = { area: round2((p.w || 0) * (p.h || 0)), notes: [] };
  if (p.process === "wirebond") { const W = BOND_WIRES[p.wireMat] || BOND_WIRES.Al, d = Number(p.wire) || 0.3, n = Math.max(1, Math.round(p.n || 1));
    out.fuse = W.K * d ** 1.5; out.fuseTotal = out.fuse * n;
    if (p.i > 0.5 * out.fuseTotal) out.notes.push(`${frn(p.i, 1)} A pour un courant de fusion d'environ ${frn(out.fuseTotal, 1)} A : en service on reste nettement en dessous — plus de fils, ou un fil plus gros.`); }
  else if (p.process === "resistance" && p.t > 0.3) out.notes.push(`Languette de ${frn(p.t)} mm : la soudure par résistance convient jusqu'à 0,3 mm environ — au-delà, laser.`);
  return out;
}

export const ELEC_INTERFACES = {
  weld: {
    label: "Welded or wire-bonded joint", fr: "Joint soudé ou câblé par fils",
    doc: "Liaison électrique permanente entre deux conducteurs sur une zone de w × h. A = le côté mince (languette, bout de busbar, départ des fils) ; B = la borne (capot de cellule, barre épaisse, plage). « process » : laser, resistance, ultrasonic, wirebond. « n » : cordons, points ou fils ; « t » : épaisseur de la languette ; « wire » et « wireMat » (Al, Cu) pour le wirebonding ; « i » : courant à porter (A). Aucune géométrie ajoutée.",
    params: { process: "laser", w: 8, h: 4, n: 2, t: 0.3, wire: 0.3, wireMat: "Al", i: 0 }, optsA: {}, optsB: {},
    compile: () => [],
    hardware(p) { const W = BOND_WIRES[p.wireMat] || BOND_WIRES.Al; return p.process === "wirebond" ? [{ id: `WIRE-${String(p.wireMat || "Al").toUpperCase()}-${Math.round((p.wire || 0.3) * 1000)}`, name: `Fil de câblage en ${W.fr} Ø ${frn(p.wire || 0.3)} mm`, qty: Math.max(1, Math.round(p.n || 1)), kind: "wire" }] : []; },
    gdt: () => ({ symbol: "flatness", tolerance: 0.05 }),
    signature: (p) => `${p.process || "laser"}|${round2(p.w || 0)}x${round2(p.h || 0)}|n${Math.round(p.n || 1)}`,
  },
  contact: {
    label: "Pressure contact", fr: "Contact à pression",
    doc: "Contact à pression entre deux plages PLANES de conducteurs massifs (busbars) : zone de w × h. A = le côté qui porte les points de contact (« n ») ; B = la plage plane revêtue. « form » : cone (bossages emboutis en pointe dans la barre, de 1 mm et plus), bridge (lames cambrées en pont dans une barre mince ; « t » épaisseur de la lame) ou band (bande de lamelles rapportée). « gap » : la hauteur comprimée ; « force » : l'effort par point (N). « plating » : Ag, Sn, Au, Ni ; « base » : Cu, CuBe, CuNiSi, CuSn ; « duty » : power ou signal ; « i » : courant (A) ; « u » : tension de service (V continu). « weld » : projection — les bossages servent de bossages de soudage (option). Un serrage (vis, clip) doit tenir les deux barres.",
    params: { w: 20, h: 8, n: 8, gap: 0.6, force: 2, plating: "Ag", base: "CuBe", duty: "power", i: 40 }, optsA: { band: "insert" }, optsB: {},
    compile(side, p, o) {                                          // the points stand on side A ; the mating plane is on their tops
      if (side !== "A" || !(p.gap > 0)) return [];
      const L = contactLayout(p), form = contactForm(p, o), pts = [];
      for (let r = 0; r < L.rows; r++) for (let k = 0; k < L.per && pts.length < L.n; k++) pts.push([round2(-p.w / 2 + L.pitch * (k + 0.5)), round2(L.rows === 1 ? 0 : (r - 0.5) * p.h / 2)]);
      if (form === "cone") { const pr = projectionFor(p.gap, Math.min(L.pitch, L.lane) * 0.8); return [{ op: "boss", uv: pts, d: pr.d1, tip: round2(pr.d1 * 0.3), h: p.gap, lift: p.gap }]; }
      if (form === "bridge") return [{ op: "arch", uv: pts, dirUV: [0, 1], l: L.l, w: L.w, h: p.gap, t: Math.min(p.t || 0.3, p.gap), lift: p.gap }];
      return [{ op: "boss", uv: pts, d: L.d, h: p.gap, lift: p.gap }];
    },
    hardware(p, oA = {}) { const B = CONTACT_BASES[p.base] || CONTACT_BASES.CuBe, P = PLATINGS[p.plating] || PLATINGS.Ag;
      return contactForm(p, oA) !== "band" ? [] : [{ id: `CONTACT-BAND-${Math.round(p.n || 1)}-${p.base || "CuBe"}-${p.plating || "Ag"}`, name: `Bande de contact à lamelles, ${Math.round(p.n || 1)} points, ${B.fr.split(" (")[0].toLowerCase()}, ${P.fr.toLowerCase()}`, qty: 1, kind: "contact" }]; },
    gdt: () => ({ symbol: "flatness", tolerance: 0.05 }),
    signature: (p) => `${round2(p.w || 0)}x${round2(p.h || 0)}|n${Math.round(p.n || 1)}|${p.plating || "Ag"}${p.form ? `|${p.form}` : ""}${p.weld === "projection" ? "|soudé" : ""}`,
  },
};
/** What the joint register says of an electrical joint. */
export function elecProcess(type, p, o = {}) {
  if (type === "weld") { const W = WELD_PROCESSES[p.process] || WELD_PROCESSES.laser, e = weldEstimate(p);
    return `${W.fr} · ${Math.round(p.n || 1)} ${W.unit}${p.n > 1 ? "s" : ""}${p.process === "wirebond" ? ` Ø ${frn(p.wire || 0.3)} mm en ${(BOND_WIRES[p.wireMat] || BOND_WIRES.Al).fr} · fusion ≈ ${frn(e.fuseTotal, 1)} A` : ` · zone ${frn(p.w)} × ${frn(p.h)} mm`}`; }
  const e = contactEstimate(p), P = PLATINGS[p.plating] || PLATINGS.Ag, form = CONTACT_FORMS[contactForm(p, o)];
  if (p.weld === "projection" && form === CONTACT_FORMS.cone) return `${Math.round(p.n || 1)} bossages soudés par bossage · ${P.fr.toLowerCase()} · zone ${frn(p.w)} × ${frn(p.h)} mm · liaison permanente, à qualifier`;
  return `${form.fr.toLowerCase()} · ${Math.round(p.n || 1)} points · ${P.fr.toLowerCase()} · ${frn(p.force || 1, 1)} N par point · ≈ ${frn(e.rTotal, 3)} mΩ · ≈ ${frn(e.iMax, 1)} A (estimation)`;
}
