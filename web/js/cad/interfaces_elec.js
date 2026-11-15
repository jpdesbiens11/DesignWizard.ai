/* DesignWizard.ai — electrical interfaces : how two conductors are joined.
   weld    : a permanent joint — laser, resistance spots, ultrasonic, or bonded wires (wirebonding) — between a thin side
             (a tab, the tongue of a busbar, the foot of a wire) and a terminal (the cap of a cell, a thick bar, a pad).
   contact : a pressure contact between two FLAT lands of solid conductors : a band of stamped lamellae on one side, a plated
             flat land on the other ; pressed together, each lamella deflects and makes one contact point. For a signal
             (a few milliamperes) as for power (tens of amperes).
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
/** Spring alloys the lamellae are stamped from : conductivity (% IACS) and the standard of the strip. */
export const CONTACT_BASES = {
  CuBe: { fr: "Cuivre-béryllium (C17200)", iacs: 22, std: "ASTM B194", use: "Le ressort de référence : forte élasticité, tient l'effort dans le temps" },
  CuNiSi: { fr: "Cuivre-nickel-silicium (C70250)", iacs: 40, std: "ASTM B422", use: "Bon compromis ressort / conductivité, sans béryllium" },
  CuSn: { fr: "Bronze phosphoreux (C51900)", iacs: 15, std: "ASTM B103", use: "Économique, pour les signaux et les petits courants" },
};
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
    label: "Lamella pressure contact", fr: "Contact à lamelles",
    doc: "Contact à pression entre deux plages PLANES de conducteurs massifs (busbars) : zone de w × h. A = le côté qui porte la bande de lamelles estampées (« n » points) ; B = la plage plane revêtue. Pressées l'une sur l'autre, les lamelles fléchissent : « gap » est la hauteur comprimée, « force » l'effort par point (N). « plating » : Ag, Sn, Au, Ni ; « base » : CuBe, CuNiSi, CuSn ; « duty » : power ou signal ; « i » : courant à porter (A). Un serrage (vis, clip) doit tenir les deux barres.",
    params: { w: 20, h: 8, n: 8, gap: 0.6, force: 2, plating: "Ag", base: "CuBe", duty: "power", i: 40 }, optsA: { band: "insert" }, optsB: {},
    compile(side, p) {                                             // the lamellae stand on side A : one bump per contact point, the mating plane on their tops
      if (side !== "A" || !(p.gap > 0)) return [];
      const n = Math.max(1, Math.min(24, Math.round(p.n || 1))), rows = n > 6 && p.h >= 6 ? 2 : 1, per = Math.ceil(n / rows), pitch = p.w / per, d = round2(Math.max(0.6, Math.min(pitch * 0.6, p.h / rows * 0.7, 3))), pts = [];
      for (let r = 0; r < rows; r++) for (let k = 0; k < per && pts.length < n; k++) pts.push([round2(-p.w / 2 + pitch * (k + 0.5)), round2(rows === 1 ? 0 : (r - 0.5) * p.h / 2)]);
      return [{ op: "boss", uv: pts, d, h: p.gap, lift: p.gap }];
    },
    hardware(p, oA = {}) { const B = CONTACT_BASES[p.base] || CONTACT_BASES.CuBe, P = PLATINGS[p.plating] || PLATINGS.Ag;
      return oA.band === "integral" ? [] : [{ id: `CONTACT-BAND-${Math.round(p.n || 1)}-${p.base || "CuBe"}-${p.plating || "Ag"}`, name: `Bande de contact à lamelles, ${Math.round(p.n || 1)} points, ${B.fr.split(" (")[0].toLowerCase()}, ${P.fr.toLowerCase()}`, qty: 1, kind: "contact" }]; },
    gdt: () => ({ symbol: "flatness", tolerance: 0.05 }),
    signature: (p) => `${round2(p.w || 0)}x${round2(p.h || 0)}|n${Math.round(p.n || 1)}|${p.plating || "Ag"}`,
  },
};
/** What the joint register says of an electrical joint. */
export function elecProcess(type, p) {
  if (type === "weld") { const W = WELD_PROCESSES[p.process] || WELD_PROCESSES.laser, e = weldEstimate(p);
    return `${W.fr} · ${Math.round(p.n || 1)} ${W.unit}${p.n > 1 ? "s" : ""}${p.process === "wirebond" ? ` Ø ${frn(p.wire || 0.3)} mm en ${(BOND_WIRES[p.wireMat] || BOND_WIRES.Al).fr} · fusion ≈ ${frn(e.fuseTotal, 1)} A` : ` · zone ${frn(p.w)} × ${frn(p.h)} mm`}`; }
  const e = contactEstimate(p), P = PLATINGS[p.plating] || PLATINGS.Ag;
  return `${Math.round(p.n || 1)} points · ${P.fr.toLowerCase()} · ${frn(p.force || 1, 1)} N par point · ≈ ${frn(e.rTotal, 3)} mΩ · ≈ ${frn(e.iMax, 1)} A (estimation)`;
}
