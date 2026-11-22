/* DesignWizard.ai — demonstration : a TRACTION INVERTER, three phases, mounted on its motor (point 7 of the plan agreed with JP : « boîtier moulé
   d'un onduleur triphasé de traction monté par une bride sur le cylindre d'un moteur ; côtés courbes, pans coupés, cavités de hauteurs
   différentes ; couvercle embouti à rabats avec joint silicone collé ; petit couvercle dessous ; potting ; connecteurs (trois AC, DC + / −),
   filtre, carte de commande, carte de puissance sous les IGBT, IGBT, condensateur de bus, busbars laminés »).
   The PRINCIPLES of a commercial inverter, drawn by the tool : no brand, no drawing copied, no real module, connector or capacitor — every
   bought item is a generic envelope, said as such. Everything is drawn in one frame (X along the motor axis, Z up, the motor axis on X at
   y = 0, z = 0) and placed where it is drawn ; the numbers are examples of the scale of such a product, not values read anywhere.
   Read from the bottom up : the motor casing and its two pairs of pads ; the die-cast housing sits on them through four lugs, its underside a
   saddle that follows the cylinder ; three cavities of different depths — the power stage (floor 118), the DC-link capacitor (125), the
   filter (140) ; under the overhang beyond the motor, the AC compartment closed by a small cover ; in the power cavity : standoffs, the
   power board, the three IGBT modules ON it, the potting around them ; the laminated DC busbar over the modules and the capacitor, through a
   notch of the wall ; the control board on top ; the glued silicone gasket ; the stamped cover with its flanges. Pure : data only. */

const r3 = (x) => Math.round(x * 1000) / 1000;
const box = (id, name, at, size, mode) => ({ op: "box", id, name, at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });
const cyl = (id, name, at, d, h, axis, mode) => ({ op: "cylinder", id, name, at: at.map(r3), d, h: r3(h), axis, ...(mode ? { mode } : {}) });
const ext = (id, name, profile, at, length, mode) => ({ op: "extrude", id, name, profile, plane: "XY", at: r3(at), length: r3(length), ...(mode ? { mode } : {}) });

/* the plan of the housing : chamfered corners on the connector end (pans coupés), a curved end over the motor (côté courbe) — convex, counter-clockwise */
export const MOTOR = { d: 220, L: 200 }, Z0 = 70, ZTOP = 200;
function outlinePts() {
  const pts = [[30, -90], [225, -90], [250, -65], [250, 65], [225, 90], [30, 90]], R = 160, cx = 30 + Math.sqrt(R * R - 90 * 90), a0 = Math.atan2(90, 30 - cx), a1 = 2 * Math.PI - a0;
  for (let k = 1; k < 12; k++) { const a = a0 + ((a1 - a0) * k) / 12; pts.push([cx + R * Math.cos(a), R * Math.sin(a)]); }
  return pts;
}
/** The outline offset by m (outward when m > 0) : each vertex moved along the bisector of its two edges (a convex polygon). */
export function outline(m = 0) {
  const P = outlinePts(), n = P.length, N = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dy / l, -dx / l]; };
  return { poly: P.map((p, i) => { const a = N(P[(i - 1 + n) % n], p), b = N(p, P[(i + 1) % n]), s = [a[0] + b[0], a[1] + b[1]], l = Math.hypot(s[0], s[1]), k = m / Math.max(0.3, (a[0] * s[0] + a[1] * s[1]) / l); return [r3(p[0] + (s[0] / l) * k), r3(p[1] + (s[1] / l) * k)]; }) };
}
const LUGS = [[35, 101], [35, -101], [165, 101], [165, -101]], AC = [60, 105, 150], DC = [25, -25], STANDOFF = [[48, -74], [160, -74], [48, 74], [160, 74]];
const MOD_X = [48, 88, 128], MOD = { w: 36, y0: -55, y1: 55, z0: 125.6, z1: 141.6 };
const part = (id, name, family, process, material, features, more = {}) => ({ dw: "part/1", id, name, family, process, material, revision: "A", params: {}, interfaces: [], features, ...more });

export function inverterParts() {
  const housing = part("INV-HOUSING", "Boîtier moulé de l'onduleur", "enclosure", "die_casting", "AL-A380", [
    ext("corps", "Corps", outline(0), Z0, ZTOP - Z0),
    cyl("selle", "Selle sur le moteur", [0, 0, 0], MOTOR.d, MOTOR.L, "X", "cut"),
    ...LUGS.map(([x, y], k) => box(`patte_${k + 1}`, "Patte de la bride", [x - 15, y > 0 ? 90 : -112, Z0], [30, 22, 12])),
    { op: "hole", id: "trous_pattes", name: "Trous des vis de la bride", face: "+Z", at: LUGS, d: 9, depth: 12, start: Z0 + 12 },
    { op: "pocket", id: "cavite_puissance", name: "Cavité de l'étage de puissance", face: "+Z", rect: [40, -84, 128, 168], r: 6, depth: ZTOP - 118 },
    { op: "pocket", id: "cavite_condensateur", name: "Cavité du condensateur de bus", face: "+Z", rect: [176, -84, 38, 168], r: 6, depth: ZTOP - 125 },
    { op: "pocket", id: "cavite_filtre", name: "Cavité du filtre", face: "+Z", rect: [222, -60, 22, 120], r: 6, depth: ZTOP - 140 },
    { op: "pocket", id: "passage_busbar", name: "Passage du busbar dans la paroi", face: "+Z", rect: [166, -46, 12, 92], depth: ZTOP - 148 },
    { op: "pocket", id: "compartiment_ac", name: "Compartiment AC, ouvert dessous", face: "-Z", rect: [205, -55, 38, 110], r: 4, depth: 45 },
    { op: "boss", id: "entretoises", name: "Entretoises de la carte de puissance", face: "+Z", at: STANDOFF, d: 7, h: 6, start: 118 },
    ...DC.map((y, k) => cyl(`passage_dc_${k + 1}`, "Passage d'un connecteur DC", [243, y, 165], 20, 9, "X", "cut")),
    ...AC.map((x, k) => cyl(`passage_ac_${k + 1}`, "Passage d'un connecteur AC", [x, 82, 165], 28, 10, "Y", "cut")),
  ], { notes: ["Principe d'un boîtier d'onduleur : cotes d'exemple, aucune référence de produit.", "Dépouilles, rayons et épaisseurs à reprendre avec le fondeur."], finish: "Brut de fonderie, plans d'appui usinés" });
  const motor = part("INV-MOTOR", "Carter du moteur (contexte)", "turned", "purchased", "AL-A356-T6", [
    cyl("carter", "Carter", [0, 0, 0], MOTOR.d, MOTOR.L, "X"),
    ...LUGS.map(([x, y], k) => box(`appui_${k + 1}`, "Appui de la bride", [x - 15, y > 0 ? 88 : -114, 40], [30, 26, Z0 - 40])),
    { op: "hole", id: "taraudages", name: "Taraudages de la bride", face: "+Z", at: LUGS, thread: "M8", depth: 15, start: Z0 },
  ], { notes: ["Le moteur n'est là que pour situer l'onduleur : son enveloppe, ses appuis."] });
  const gasket = part("INV-GASKET", "Joint silicone collé", "plate", "purchased", "SILICONE", [ext("cordon", "Cordon", { outer: outline(-0.5), holes: [outline(-3.5)] }, ZTOP, 2)], { notes: ["Cordon déposé et collé sur le plan de joint du boîtier."] });
  const cover = part("INV-COVER", "Couvercle embouti à rabats", "sheet", "sheet_metal", "AL5052-H32", [
    ext("fond", "Fond", outline(2.5), ZTOP + 2, 1.5), ext("rabats", "Rabats", { outer: outline(2.5), holes: [outline(1)] }, ZTOP - 6, 8),
  ], { notes: ["Embouti en une passe ; les rabats couvrent le joint de 6 mm (exemple)."] });
  const bottom = part("INV-COVER-BOT", "Petit couvercle du compartiment AC", "plate", "cnc_milling", "AL6061-T6", [box("plaque", "Plaque", [202, -60, Z0 - 3], [45, 120, 3])]);
  const powerBoard = part("INV-PWR-PCB", "Carte de puissance (sous les IGBT)", "purchased", "purchased", "FR4", [box("carte", "Carte", [44, -78, 124], [120, 156, 1.6])], { notes: ["Enveloppe : la carte se conçoit dans le PCBA."] });
  const igbt = part("INV-IGBT", "Module IGBT demi-pont (enveloppe)", "purchased", "purchased", "PPS-GF40", [
    box("corps", "Corps", [MOD_X[0], MOD.y0, MOD.z0], [MOD.w, MOD.y1 - MOD.y0, MOD.z1 - MOD.z0]),
    ...[-30, 0, 30].map((y, k) => cyl(`borne_${k + 1}`, "Borne", [MOD_X[0] + MOD.w / 2, y, MOD.z1], 7, 150 - MOD.z1, "Z")),
  ], { notes: ["Enveloppe générique d'un module demi-pont : aucune série copiée."] });
  const potting = part("INV-POTTING", "Potting de l'étage de puissance", "plate", "purchased", "SILICONE", [
    ext("masse", "Masse coulée", { rect: [41, -83, 126, 166], r: 5 }, 118, 14),
    box("logement_carte", "Logement de la carte", [44, -78, 124], [120, 156, 1.6], "cut"),
    ...MOD_X.map((x, k) => box(`logement_module_${k + 1}`, "Logement d'un module", [x, MOD.y0, MOD.z0], [MOD.w, MOD.y1 - MOD.y0, 132 - MOD.z0], "cut")),
    ...STANDOFF.map(([x, y], k) => cyl(`logement_entretoise_${k + 1}`, "Logement d'une entretoise", [x, y, 117], 7, 8, "Z", "cut")),
  ], { notes: ["Gel coulé jusqu'à 14 mm au-dessus du fond de la cavité : il couvre la carte de puissance et le pied des modules."] });
  const cap = part("INV-DCLINK", "Condensateur de bus (enveloppe)", "purchased", "purchased", "PBT-GF30", [box("bloc", "Bloc", [177, -78, 125], [36, 156, 23])], { notes: ["Condensateur film : enveloppe générique."] });
  const plate = (id, name, z, t, mat, w) => part(id, name, "busbar", "laser_cut", mat, [box("plaque", "Plaque", [50, -w / 2, z], [162, w, t])]);
  const busP = plate("INV-BB-DCP", "Busbar DC + (laminé)", 150, 2, "CU-C110", 80), film = plate("INV-BB-FILM", "Film isolant du busbar", 152, 0.3, "PEI-9085", 84), busN = plate("INV-BB-DCN", "Busbar DC − (laminé)", 152.3, 2, "CU-C110", 80);
  const filter = part("INV-FILTER", "Filtre CEM (enveloppe)", "purchased", "purchased", "PBT-GF30", [box("bloc", "Bloc", [223, -50, 140], [20, 100, 40])]);
  const ctrl = part("INV-CTRL-PCB", "Carte de commande", "purchased", "purchased", "FR4", [box("carte", "Carte", [42, -80, 190], [124, 160, 1.6])], { notes: ["Enveloppe : la carte se conçoit dans le PCBA."] });
  const acConn = part("INV-CONN-AC", "Connecteur AC (enveloppe)", "purchased", "purchased", "PA66-GF30", [cyl("corps", "Corps", [AC[0], 85, 165], 27.6, 33, "Y"), cyl("collerette", "Collerette", [AC[0], 90, 165], 38, 3, "Y")], { notes: ["Enveloppe générique : aucune série copiée."] });
  const dcConn = part("INV-CONN-DC", "Connecteur DC (enveloppe)", "purchased", "purchased", "PA66-GF30", [cyl("corps", "Corps", [246, DC[0], 165], 19.6, 34, "X"), cyl("collerette", "Collerette", [250, DC[0], 165], 30, 3, "X")], { notes: ["Enveloppe générique : aucune série copiée."] });
  return [motor, housing, gasket, cover, bottom, powerBoard, igbt, potting, cap, busP, film, busN, filter, ctrl, acConn, dcConn];
}
const at = (t = [0, 0, 0]) => ({ t, r: [0, 0, 0] });
export function inverterAssembly() {
  const one = (id, part) => ({ id, part, fixed: true, placement: at() });
  return { dw: "assembly/1", id: "INV-ASM", name: "Onduleur de traction sur son moteur", notes: ["Démonstration de principe : enveloppes génériques, cotes d'exemple.", "Les liaisons AC des modules aux connecteurs ne sont pas dessinées."], instances: [
    one("moteur", "INV-MOTOR"), one("boitier", "INV-HOUSING"), one("joint", "INV-GASKET"), one("couvercle", "INV-COVER"), one("couvercle_dessous", "INV-COVER-BOT"),
    one("carte_puissance", "INV-PWR-PCB"), ...MOD_X.map((x, k) => ({ id: `igbt_${k + 1}`, part: "INV-IGBT", fixed: true, placement: at([r3(x - MOD_X[0]), 0, 0]) })), one("potting", "INV-POTTING"),
    one("condensateur", "INV-DCLINK"), one("busbar_plus", "INV-BB-DCP"), one("film", "INV-BB-FILM"), one("busbar_moins", "INV-BB-DCN"), one("filtre", "INV-FILTER"), one("carte_commande", "INV-CTRL-PCB"),
    ...AC.map((x, k) => ({ id: `ac_${k + 1}`, part: "INV-CONN-AC", fixed: true, placement: at([r3(x - AC[0]), 0, 0]) })), ...DC.map((y, k) => ({ id: `dc_${k + 1}`, part: "INV-CONN-DC", fixed: true, placement: at([0, r3(y - DC[0]), 0]) })),
  ], mates: [] };
}
export const WORDS_INV = {
  "Boîtier moulé de l'onduleur": "Die-cast inverter housing", "Carter du moteur (contexte)": "Motor casing (context)", "Joint silicone collé": "Glued silicone gasket", "Couvercle embouti à rabats": "Stamped cover with flanges",
  "Petit couvercle du compartiment AC": "AC compartment small cover", "Carte de puissance (sous les IGBT)": "Power board (under the IGBTs)", "Module IGBT demi-pont (enveloppe)": "IGBT half-bridge module (envelope)", "Potting de l'étage de puissance": "Power stage potting",
  "Condensateur de bus (enveloppe)": "DC-link capacitor (envelope)", "Busbar DC + (laminé)": "DC+ busbar (laminated)", "Film isolant du busbar": "Busbar insulating film", "Busbar DC − (laminé)": "DC− busbar (laminated)", "Filtre CEM (enveloppe)": "EMC filter (envelope)",
  "Carte de commande": "Control board", "Connecteur AC (enveloppe)": "AC connector (envelope)", "Connecteur DC (enveloppe)": "DC connector (envelope)", "Onduleur de traction sur son moteur": "Traction inverter on its motor", "Onduleur de traction": "Traction inverter",
  "Principe d'un boîtier d'onduleur : cotes d'exemple, aucune référence de produit.": "Principle of an inverter housing: example dimensions, no product reference.", "Dépouilles, rayons et épaisseurs à reprendre avec le fondeur.": "Drafts, radii and thicknesses to be reviewed with the foundry.",
  "Brut de fonderie, plans d'appui usinés": "As cast, seating faces machined", "Le moteur n'est là que pour situer l'onduleur : son enveloppe, ses appuis.": "The motor only locates the inverter: its envelope, its pads.", "Cordon déposé et collé sur le plan de joint du boîtier.": "Bead dispensed and glued on the housing sealing face.",
  "Embouti en une passe ; les rabats couvrent le joint de 6 mm (exemple).": "Drawn in one pass; the flanges overlap the gasket by 6 mm (example).", "Enveloppe : la carte se conçoit dans le PCBA.": "Envelope: the board is designed in the PCBA.", "Enveloppe générique d'un module demi-pont : aucune série copiée.": "Generic envelope of a half-bridge module: no series copied.",
  "Gel coulé jusqu'à 14 mm au-dessus du fond de la cavité : il couvre la carte de puissance et le pied des modules.": "Gel poured 14 mm above the cavity floor: it covers the power board and the foot of the modules.", "Condensateur film : enveloppe générique.": "Film capacitor: generic envelope.", "Enveloppe générique : aucune série copiée.": "Generic envelope: no series copied.",
  "Démonstration de principe : enveloppes génériques, cotes d'exemple.": "Principle demonstration: generic envelopes, example dimensions.", "Les liaisons AC des modules aux connecteurs ne sont pas dessinées.": "The AC links from the modules to the connectors are not drawn.",
};
/** The project : the parts, the assembly, the English of the drawings. */
export function inverterProject() {
  return { dw: "project/1", id: "INV-DEMO", name: "Onduleur de traction", description: "Démonstration de principe : un onduleur triphasé de traction monté sur son moteur — boîtier moulé à cavités de hauteurs différentes, couvercle embouti et joint collé, étage de puissance potté, busbar laminé, cartes et connecteurs en enveloppes génériques. Aucune marque, aucun dessin copié.",
    parts: inverterParts(), assemblies: [inverterAssembly()], boards: [], drawing: { words: WORDS_INV }, log: [] };
}
