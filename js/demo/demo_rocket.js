/* DynamiteOrbit.ai — example project : a sounding rocket with a hybrid motor, as a CAD exercise. 8 in (203,2 mm) in diameter,
   about 12 ft (3,66 m) long, four fixed fins. From the tail up : a nozzle cooled by a helical coil in which a little of the
   oxidiser expands, its skirt, the combustion chamber and its polyurethane fuel grain, the injector plate, the main valve
   of the nitrous oxide with its actuator, the oxidiser tank, the avionics bay (bulkhead, sled, control board, battery,
   harness), the recovery bay and the nose cone ; around them, three airframe sections, the fins and two rail buttons.
   Z is the axis of the rocket, the nozzle exit at z = 0 ; the nozzle is the ground of the assembly and every other part
   is held by a mate. Geometry of principle : nothing here is sized, checked or validated — neither the pressure vessel,
   nor the motor, nor the flight. Materials the library lacks are said in the notes of each part. */

import { WORDS_ROCKET } from "./demo_words.js";
import { withPaths } from "./demo_paths.js";

const cyl = (d, h, at, axis = "Z", extra = {}) => ({ op: "cylinder", d, h, at, axis, ...extra });
const box = (size, at, extra = {}) => ({ op: "box", size, at, ...extra });
const rev = (poly, extra = {}) => ({ op: "revolve", profile: { poly }, plane: "XZ", axis: "Z", angle: 360, ...extra });
const planar = (id, name, key, partner, side, face, at, w, h, o = {}) => ({ id, type: "planar", name, key, partner, side, face, at, params: { w, h }, ...o });
const fit = (id, name, key, partner, side, face, level, d, length) => ({ id, type: "fit", name, key, partner, side, face, at: [0, 0], level, params: { d, length, fit: "H7/g6" } });
const bolt = (id, name, key, partner, side, face, at, screw, pattern, o = {}) => ({ id, type: "bolt_pattern", name, key, partner, side, face, at, params: { screw, pattern }, ...o });
const OD = 203.2, ID = 196.8, WALL = 3.2, SPIGOT = ID - 2 * WALL;
const CAD = "Exemple de CAO : géométrie de principe, ni dimensionnée ni validée. Une fusée et son moteur se conçoivent, se construisent et s'essaient dans le cadre d'un club, avec ses règles de sécurité.";
const FLANGE = { type: "circle", n: 8, pcd: 150, start: 22.5 }, FIN_HOLES = { type: "points", pts: [[-8, -150], [8, -150], [-8, 0], [8, 0], [-8, 150], [8, 150]] };

const NOZZLE = { dw: "part/1", id: "FUS-1010", name: "Tuyère refroidie", family: "turned", process: "lpbf", material: "IN718", revision: "A",
  function: "Détend les gaz de la chambre ; son divergent est refroidi par un serpentin où se détend un peu de protoxyde d'azote.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [
    bolt("IF1", "Bride de la chambre", "fus_chamber", "Chambre de combustion", "A", "+Z", [0, 0], "M6", FLANGE, { level: 230, opts: { head: "none", depth: 23.5 } }),
    planar("IF2", "Épaulement de la coque arrière", "fus_aft_seat", "Coque arrière", "B", "+Z", [0, 0], OD, OD, { level: 215 }),
    planar("IF3", "Appui du collecteur du serpentin", "fus_coil", "Serpentin de refroidissement", "B", "-Z", [0, 0], 148, 148, { level: 207 }),
    planar("IF4", "Appui de la jupe", "fus_skirt", "Jupe de tuyère", "B", "-Z", [0, 0], OD, OD, { level: 207 })],
  stock: { form: "print" },
  features: [rev([[70, 0], [78, 0], [34, 150, 25], [63, 207], [OD / 2, 207], [OD / 2, 215], [ID / 2, 215], [ID / 2, 230], [55, 230], [22.5, 150, 18]], { id: "corps", name: "Convergent, col et divergent" }),
    { op: "hole", id: "passage", name: "Passage de la ligne de refroidissement", face: "+Z", at: [94, 0], d: 8, depth: 23.5, start: 230 }, { op: "interfaces" }],
  notes: [CAD, "Col de 45 mm, sortie de 140 mm : valeurs de dessin, pas un dimensionnement.", "Imprimée en alliage de nickel ; une tuyère d'amateur est plus souvent en graphite ou en composite ablatif, que la bibliothèque de matières n'a pas."] };

const COIL = { dw: "part/1", id: "FUS-1020", name: "Serpentin de refroidissement", family: "purchased", process: "purchased", material: "CU-C110", revision: "A",
  function: "Enroulé en hélice sur le divergent : le protoxyde d'azote prélevé s'y détend et refroidit la tuyère.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [planar("IF1", "Dessus du collecteur", "fus_coil", "Tuyère", "A", "+Z", [0, 0], 148, 148, { level: 207 }),
    planar("IF2", "Raccord de la ligne de refroidissement", "fus_coolant", "Ligne de refroidissement", "B", "+Z", [94, 0], 6, 6, { level: 207 })],
  features: [{ op: "coil", id: "helice", name: "Onze spires sur le cône du divergent", d: 8, di: 6, r: 78.6, r1: 41.9, h: 125, turns: 11, at: [0, 0, 15], axis: "Z" },
    { op: "revolve", id: "collecteur", name: "Collecteur", profile: { rect: [64, 195, 10, 12] }, plane: "XZ", axis: "Z", angle: 360 },
    cyl(8, 31, [40, 0, 141], "X", { id: "sortie", name: "Sortie de l'hélice" }), cyl(8, 56, [69, 0, 141], "Z", { id: "montee", name: "Montée au collecteur" }),
    box([25, 12, 8], [72, -6, 199], { id: "raccord", name: "Raccord de la ligne" }), { op: "interfaces" }],
  notes: [CAD, "Tube de cuivre de 8 × 1 mm cintré en hélice conique, brasé sur le collecteur ; pièce sous-traitée.", "Le serpentin est un tube en hélice du langage de pièce (opération « coil »)."] };

const SKIRT = { dw: "part/1", id: "FUS-1030", name: "Jupe de tuyère", family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A",
  function: "Carène la tuyère et son serpentin jusqu'à 20 mm de la sortie.", elec: { kind: "conductor", net: "Chassis" }, look: { color: "#cfd6dc", opacity: 0.35 },
  interfaces: [planar("IF1", "Bord supérieur", "fus_skirt", "Tuyère", "A", "+Z", [0, 0], OD, OD, { level: 187 })],
  features: [cyl(OD, 187, [0, 0, 0], "Z", { id: "tube", name: "Tube" }), cyl(ID, 187, [0, 0, 0], "Z", { id: "alesage", name: "Alésage", mode: "cut" }), { op: "interfaces" }],
  notes: [CAD, "Montrée translucide pour laisser voir le serpentin ; tenue par des vis radiales, non dessinées."] };

const CHAMBER = { dw: "part/1", id: "FUS-2010", name: "Chambre de combustion", family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A",
  function: "Contient le bloc de combustible et la combustion ; porte la tuyère en bas, la plaque d'injection en haut.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [
    bolt("IF1", "Fond arrière — bride de la tuyère", "fus_chamber", "Tuyère", "B", "-Z", [0, 0], "M6", FLANGE, { level: 0, opts: { thread: "tapped", depth: 11 } }),
    planar("IF2", "Appui du bloc de combustible", "fus_grain", "Bloc de combustible", "B", "+Z", [0, 0], 168, 168, { level: 12 }),
    fit("IF3", "Alésage de la plaque d'injection", "fus_injector", "Plaque d'injection", "B", "+Z", 900, 170, 20)],
  features: [rev([[55, 0], [90, 0], [90, 900], [85, 900], [85, 12], [55, 12]], { id: "virole", name: "Virole et fond arrière" }), { op: "interfaces" }],
  notes: [CAD, "La plaque d'injection est retenue par un jonc d'arrêt, non dessiné.", "Protection thermique de la paroi (chemise) non dessinée."] };

const GRAIN = { dw: "part/1", id: "FUS-2020", name: "Bloc de combustible en polyuréthane", family: "turned", process: "purchased", material: "RESIN-SLA", revision: "A",
  function: "Le combustible solide du moteur hybride : un cylindre à canal central, brûlé par le protoxyde d'azote.", elec: { kind: "insulator" }, look: { color: "#d9c58a" },
  interfaces: [planar("IF1", "Face arrière", "fus_grain", "Chambre de combustion", "A", "-Z", [0, 0], 168, 168, { level: 0 })],
  features: [{ op: "revolve", id: "bloc", name: "Bloc à canal central", profile: { rect: [30, 0, 54, 860] }, plane: "XZ", axis: "Z", angle: 360 }, { op: "interfaces" }],
  notes: [CAD, "Polyuréthane coulé : la bibliothèque de matières n'en a pas — une résine rigide de densité voisine (1,18) est prise pour la masse.", "Diamètre 168 mm, canal de 60 mm, longueur 860 mm : valeurs de dessin."] };

const INJECTOR = { dw: "part/1", id: "FUS-2030", name: "Plaque d'injection", family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A",
  function: "Ferme l'avant de la chambre et y pulvérise le protoxyde d'azote par une couronne d'orifices.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [fit("IF1", "Portée dans la chambre", "fus_injector", "Chambre de combustion", "A", "-Z", 0, 170, 20), fit("IF2", "Orifice d'entrée", "fus_valve_out", "Vanne principale", "B", "+Z", 25, 25, 15)],
  features: [cyl(180, 10, [0, 0, 0], "Z", { id: "collerette", name: "Collerette" }), cyl(60, 15, [0, 0, 10], "Z", { id: "bossage", name: "Bossage d'entrée" }), { op: "interfaces" },
    cyl(50, 8, [0, 0, -3], "Z", { id: "plenum", name: "Chambre de répartition", mode: "cut" }), cyl(20, 7, [0, 0, 4], "Z", { id: "canal", name: "Canal d'entrée", mode: "cut" }),
    { op: "hole", id: "orifices", name: "Couronne de huit orifices", face: "-Z", at: { circle: { center: [0, 0], n: 8, d: 40, start: 0 } }, d: 3, depth: 18, start: -20 }],
  notes: [CAD, "Huit orifices de 3 mm : valeurs de dessin."] };

const VALVE = { dw: "part/1", id: "FUS-3010", name: "Vanne principale du protoxyde d'azote", family: "purchased", process: "purchased", material: "SS-304", revision: "A",
  function: "Ouvre le protoxyde d'azote vers la plaque d'injection, sur ordre de la carte de commande.", elec: { kind: "conductor", net: "Chassis" },
  bodies: { actionneur: { material: "AL6061-T6", kind: "conductor", label: "Actionneur hydraulique", color: "#c0392b" }, levier: { material: "SS-304", kind: "conductor", label: "Levier" } },
  interfaces: [fit("IF1", "Sortie vers la plaque d'injection", "fus_valve_out", "Plaque d'injection", "A", "-Z", 0, 25, 15), fit("IF2", "Entrée depuis le réservoir", "fus_tank_out", "Réservoir", "B", "+Z", 70, 25, 15)],
  features: [box([70, 70, 70], [-35, -35, 0], { id: "corps", name: "Corps de vanne à boisseau sphérique" }), cyl(10, 12, [35, 0, 35], "X", { id: "piquage", name: "Piquage du refroidissement" }), { op: "interfaces" },
    cyl(14, 100, [0, 0, -15], "Z", { id: "passage", name: "Passage", mode: "cut" }),
    cyl(36, 110, [-62, 0, -10], "Z", { id: "verin", name: "Vérin", body: "actionneur" }), box([27, 10, 8], [-62, -5, 31], { id: "levier", name: "Levier du boisseau", body: "levier" })],
  notes: [CAD, "Actionneur hydraulique montré. Variante pyrotechnique : une vanne à membrane ouverte par un initiateur prend sa place — non dessinée.", "Vanne achetée : enveloppe indicative."] };

const TANK = { dw: "part/1", id: "FUS-3020", name: "Réservoir de protoxyde d'azote", family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A",
  function: "Contient le comburant sous sa propre pression de vapeur ; alimente la vanne par le bas, se remplit et s'évente par le haut.", elec: { kind: "conductor", net: "Chassis" }, look: { color: "#7fa7c9" },
  interfaces: [fit("IF1", "Sortie vers la vanne", "fus_tank_out", "Vanne principale", "A", "-Z", 0, 25, 15), planar("IF2", "Appui de la cloison avionique", "fus_bulkhead", "Cloison avionique", "B", "+Z", [0, 0], 50, 50, { level: 1360 })],
  features: [rev([[0, 30], [25, 30], [90, 110, 60], [90, 1250, 60], [25, 1330], [0, 1330]], { id: "enveloppe", name: "Virole et fonds bombés" }),
    cyl(50, 30, [0, 0, 0], "Z", { id: "embout_bas", name: "Embout de sortie" }), cyl(50, 30, [0, 0, 1330], "Z", { id: "embout_haut", name: "Embout de remplissage et d'évent" }),
    { op: "revolve", id: "couple_bas", name: "Couple de centrage bas", profile: { rect: [89, 200, 9.4, 8] }, plane: "XZ", axis: "Z", angle: 360 }, { op: "revolve", id: "couple_haut", name: "Couple de centrage haut", profile: { rect: [89, 1100, 9.4, 8] }, plane: "XZ", axis: "Z", angle: 360 },
    { op: "interfaces" },
    rev([[0, 36], [21, 36], [85, 113, 55], [85, 1247, 55], [21, 1324], [0, 1324]], { id: "interieur", name: "Volume intérieur", mode: "cut" }), cyl(14, 60, [0, 0, -15], "Z", { id: "sortie", name: "Canal de sortie", mode: "cut" }), cyl(10, 40, [0, 0, 1322], "Z", { id: "remplissage", name: "Canal de remplissage", mode: "cut" }),
    box([12, 12, 920], [-100, -6, 195], { id: "encoche", name: "Passage du faisceau dans les couples", mode: "cut" })],
  notes: [CAD, "Récipient sous pression : il se calcule, se fabrique et s'éprouve selon son code — rien de cela n'est fait ici.", "Environ 30 litres ; diamètre 180 mm, paroi de 5 mm : valeurs de dessin."] };

const LINE = { dw: "part/1", id: "FUS-3030", name: "Ligne de refroidissement", family: "purchased", process: "purchased", material: "SS-304", revision: "A",
  function: "Amène du piquage de la vanne au serpentin la part de protoxyde d'azote qui refroidit la tuyère.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [planar("IF1", "Raccord bas", "fus_coolant", "Serpentin de refroidissement", "A", "-Z", [0, 0], 6, 6, { level: 0 })],
  features: [cyl(6, 986, [0, 0, 0], "Z", { id: "descente", name: "Descente le long de la chambre" }), cyl(6, 47, [0, 0, 983], "-X", { id: "coude", name: "Retour vers le piquage de la vanne" }), { op: "interfaces" }],
  notes: [CAD, "Tube de 6 mm, montré plein ; il passe par un trou de la bride de la tuyère, entre la chambre et la coque."] };

const side = (face) => (face === "+X" ? [1, 0] : face === "-X" ? [-1, 0] : face === "+Y" ? [0, 1] : [0, -1]);
const AIR_A = { dw: "part/1", id: "FUS-4010", name: "Coque arrière porte-ailerons", family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A",
  function: "Enveloppe la chambre et la vanne ; porte les quatre ailerons sur des méplats.", elec: { kind: "conductor", net: "Chassis" }, look: { color: "#f4f4f2" },
  interfaces: [planar("IF1", "Appui sur l'épaulement de la tuyère", "fus_aft_seat", "Tuyère", "A", "-Z", [0, 0], OD, OD, { level: 0 }),
    ...["+X", "-X", "+Y", "-Y"].map((face, k) => bolt(`IF${k + 2}`, `Méplat d'aileron ${face}`, "fus_fin", "Aileron", "B", face, [0, 240], "M4", FIN_HOLES, { level: (face[0] === "+" ? 1 : -1) * 108, opts: { thread: "tapped", depth: 9 } })),
    fit("IF6", "Emboîtement de la coque centrale", "fus_joint_ab", "Coque centrale", "B", "+Z", 1085, ID, 60)],
  features: [cyl(OD, 1085, [0, 0, 0], "Z", { id: "tube", name: "Tube" }),
    ...["+X", "-X", "+Y", "-Y"].map((face) => { const [sx, sy] = side(face); return box(sx ? [12, 24, 400] : [24, 12, 400], sx ? [sx > 0 ? 96 : -108, -12, 40] : [-12, sy > 0 ? 96 : -108, 40], { id: `meplat_${face[1].toLowerCase()}${face[0] === "+" ? "p" : "m"}`, name: `Méplat ${face}` }); }),
    { op: "interfaces" }, cyl(ID, 1085, [0, 0, 0], "Z", { id: "alesage", name: "Alésage", mode: "cut" })],
  notes: [CAD, "Les ailerons sont calés à 45° des boutons de rail.", "Tenue sur la tuyère par des vis radiales, non dessinées."] };

const FIN = { dw: "part/1", id: "FUS-4020", name: "Aileron fixe", family: "prismatic", process: "cnc_milling", material: "AL6061-T6", revision: "A",
  function: "Stabilise la fusée en vol ; quatre par fusée, fixes.", elec: { kind: "conductor", net: "Chassis" }, look: { color: "#1f4e79" },
  intent: { loads: "Efforts aérodynamiques et flottement", environment: "Vol atmosphérique", quantity: 4, priority: "stiffness" },
  interfaces: [bolt("IF1", "Semelle de l'aileron", "fus_fin", "Coque arrière", "A", "-X", [0, 200], "M4", FIN_HOLES, { level: 0, opts: { head: "none", depth: 4.5 } })],
  features: [box([4, 24, 400], [0, -12, 0], { id: "semelle", name: "Semelle" }), { op: "extrude", id: "voile", name: "Voile", profile: { poly: [[4, 0], [4, 400], [190, 250], [190, 70]] }, plane: "XZ", at: -2.5, length: 5 }, { op: "interfaces" }],
  notes: [CAD, "Emplanture de 400 mm, saumon de 180 mm, envergure de 190 mm, épaisseur de 5 mm : valeurs de dessin, sans étude de stabilité ni de flottement."] };

const airframe = (id, name, fn, L, below, above, extra = [], more = {}) => ({ dw: "part/1", id, name, family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A", function: fn, elec: { kind: "conductor", net: "Chassis" }, look: { color: "#f4f4f2" },
  interfaces: [fit("IF1", "Manchon d'emboîtement", below[0], below[1], "A", "-Z", 0, ID, below[2]), fit("IF2", above[3] || "Emboîtement", above[0], above[1], "B", "+Z", L, ID, above[2]), ...(more.interfaces || [])],
  features: [cyl(OD, L, [0, 0, 0], "Z", { id: "tube", name: "Tube" }), { op: "interfaces" }, cyl(ID, L, [0, 0, 0], "Z", { id: "alesage", name: "Alésage", mode: "cut" }), cyl(SPIGOT, below[2] + 1, [0, 0, -below[2]], "Z", { id: "manchon", name: "Alésage du manchon", mode: "cut" }), ...extra],
  notes: [CAD, "Les emboîtements sont tenus par des vis radiales, non dessinées.", ...(more.notes || [])] });
const AIR_B = airframe("FUS-4030", "Coque centrale", "Enveloppe le réservoir ; porte les deux boutons de rail.", 1350, ["fus_joint_ab", "Coque arrière", 60], ["fus_joint_bc", "Coque avant", 50, "Emboîtement de la coque avant"], [], {
  interfaces: [[150, "bas"], [1100, "haut"]].map(([z, where], k) => bolt(`IF${k + 3}`, `Bouton de rail ${where}`, "fus_button", "Bouton de rail", "B", "-Y", [0, z], "M5", { type: "single" }, { level: -OD / 2, opts: { thread: "insert", depth: 3.2 } })),
  notes: ["Boutons de rail sur des écrous à sertir, dans l'épaisseur de la coque."] });
const AIR_C = airframe("FUS-4040", "Coque avant — avionique et récupération", "Enveloppe la baie avionique et le parachute ; l'ogive s'y emboîte et s'en sépare à l'apogée.", 400, ["fus_joint_bc", "Coque centrale", 50], ["fus_nose", "Ogive", 60, "Emboîtement de l'ogive"],
  [{ op: "hole", id: "events", name: "Évents du capteur de pression", face: "+X", at: [[0, 120], [0, 135], [0, 150]], d: 3, depth: 4 }], { notes: ["Trois évents de 3 mm pour l'altimètre barométrique de la carte de commande."] });

const BUTTON = { dw: "part/1", id: "FUS-4050", name: "Bouton de rail", family: "purchased", process: "purchased", material: "POM", revision: "A",
  function: "Guide la fusée sur son rail de lancement ; deux par fusée.", elec: { kind: "insulator" },
  interfaces: [bolt("IF1", "Pied du bouton", "fus_button", "Coque centrale", "A", "-Z", [0, 0], "M5", { type: "single" }, { level: 0, opts: { head: "csink", depth: "through" } })],
  features: [cyl(16, 3, [0, 0, 0], "Z", { id: "pied", name: "Pied" }), cyl(9, 5, [0, 0, 3], "Z", { id: "gorge", name: "Gorge" }), cyl(16, 4, [0, 0, 8], "Z", { id: "tete", name: "Tête" }), { op: "interfaces" }] };

const NOSE = { dw: "part/1", id: "FUS-4060", name: "Ogive", family: "turned", process: "cnc_turning", material: "AL6061-T6", revision: "A",
  function: "Fend l'air ; se sépare à l'apogée pour libérer le parachute.", elec: { kind: "conductor", net: "Chassis" }, look: { color: "#d6453d" },
  interfaces: [fit("IF1", "Épaulement de l'ogive", "fus_nose", "Coque avant", "A", "-Z", 0, ID, 60)],
  features: [{ op: "revolve", id: "ogive", name: "Ogive tangente", profile: { path: "M0 0 L101.6 0 A1881.8 1881.8 0 0 1 0 610 Z" }, plane: "XZ", axis: "Z", angle: 360 }, { op: "interfaces" },
    { op: "revolve", id: "creux", name: "Évidement", profile: { poly: [[0, -61], [SPIGOT / 2, -61], [SPIGOT / 2, 0], [94, 120], [81, 250], [59, 380], [30, 500], [0, 560]] }, plane: "XZ", axis: "Z", angle: 360, mode: "cut" }],
  notes: [CAD, "Ogive tangente de 610 mm, trois fois le diamètre ; paroi d'environ 4 mm.", "Une ogive d'amateur est plus souvent en composite, que la bibliothèque de matières n'a pas."] };

const BULKHEAD = { dw: "part/1", id: "FUS-5010", name: "Cloison avionique", family: "plate", process: "cnc_milling", material: "AL6061-T6", revision: "A",
  function: "Sépare le réservoir de la baie avionique ; porte la platine et laisse passer le faisceau.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [planar("IF1", "Appui sur l'embout du réservoir", "fus_bulkhead", "Réservoir", "A", "-Z", [0, 0], 50, 50, { level: 0 }),
    bolt("IF2", "Pieds de la platine avionique", "fus_sled_foot", "Platine avionique", "B", "+Z", [0, 0], "M4", { type: "points", pts: [[-55, 0], [55, 0]] }, { level: 6, opts: { thread: "tapped", depth: 6 } }),
    planar("IF3", "Passe-fil du faisceau", "fus_harness", "Faisceau de commande", "B", "+Z", [-92.6, 0], 10, 10, { level: 6 })],
  features: [cyl(196.4, 6, [0, 0, 0], "Z", { id: "disque", name: "Disque" }), { op: "hole", id: "passe_fil", name: "Trou du passe-fil", face: "+Z", at: [-92.6, 0], d: 5, depth: "through" }, { op: "interfaces" }],
  notes: [CAD] };

const sledFeet = (level, face) => bolt(face === "+Z" ? "IF4" : "IF1", face === "+Z" ? "Pattes hautes — cloison de récupération" : "Pieds — cloison avionique", face === "+Z" ? "fus_sled_top" : "fus_sled_foot", face === "+Z" ? "Cloison de récupération" : "Cloison avionique", "A", face, [0, 0], "M4", { type: "points", pts: [[-55, 0], [55, 0]] }, { level, opts: { head: "none", depth: 3 } });
const SLED = { dw: "part/1", id: "FUS-5020", name: "Platine avionique", family: "prismatic", process: "cnc_milling", material: "AL6061-T6", revision: "A",
  function: "Porte la carte de commande d'un côté, la batterie de l'autre, entre les deux cloisons.", elec: { kind: "conductor", net: "Chassis" },
  interfaces: [sledFeet(0, "-Z"),
    bolt("IF2", "Colonnettes de la carte de commande", "fus_pcb", "Carte de commande", "B", "+Y", [0, 115], "M3", { type: "rect", nx: 2, ny: 2, dx: 90, dy: 150 }, { level: 9.5, opts: { thread: "tapped", depth: 6, standoff: { h: 8, d: 6 } } }),
    planar("IF3", "Appui de la batterie", "fus_battery", "Batterie", "B", "-Y", [0, 60], 70, 40, { level: -1.5 }), sledFeet(230, "+Z")],
  features: [box([150, 3, 230], [-75, -1.5, 0], { id: "ame", name: "Âme" }), ...[[-65, 0], [45, 0], [-65, 227], [45, 227]].map(([x, z], k) => box([20, 24, 3], [x, -12, z], { id: `patte${k + 1}`, name: z ? "Patte haute" : "Pied" })), { op: "interfaces" }],
  notes: [CAD] };

const PCB = { dw: "part/1", id: "FUS-5030", name: "Carte de commande", family: "pcb", process: "pcb", material: "FR4", revision: "A",
  function: "Mesure l'altitude et l'attitude, ordonne l'ouverture de la vanne et la sortie du parachute, garde et transmet les mesures.",
  interfaces: [bolt("IF1", "Fixation de la carte", "fus_pcb", "Platine avionique", "A", "-Z", [50, 80], "M3", { type: "rect", nx: 2, ny: 2, dx: 90, dy: 150 })],
  pcb: { size: [100, 160], r: 3, t: 1.6,
    zones: [{ net: "LV", side: "top", name: "Logique 3,3 V et puissance 12 V", rect: [8, 12, 84, 136] }],
    components: [
      { ref: "U1", name: "Microcontrôleur", kind: "mcu", at: [50, 92], size: [14, 14, 1.6] }, { ref: "U2", name: "Capteur de pression (altimètre)", kind: "sensor", at: [24, 120], size: [5, 3, 1.2] },
      { ref: "U3", name: "Centrale inertielle", kind: "sensor", at: [76, 120], size: [4, 4, 1.2] }, { ref: "U4", name: "Récepteur de position", kind: "other", at: [26, 62], size: [16, 12.2, 2.4] },
      { ref: "U5", name: "Module radio de télémesure", kind: "other", at: [74, 60], size: [16, 16, 3] }, { ref: "U6", name: "Mémoire des mesures", kind: "other", at: [50, 118], size: [8, 6, 1.5] },
      { ref: "Q1", name: "Commande de la vanne", kind: "power", at: [30, 30], size: [10, 9, 4.5] }, { ref: "Q2", name: "Commande de l'éjection", kind: "power", at: [50, 30], size: [10, 9, 4.5] },
      { ref: "J1", name: "Connecteur de la batterie", kind: "connector", at: [16, 10], size: [12, 8, 9] }, { ref: "J2", name: "Connecteur du faisceau de la vanne", kind: "connector", at: [50, 10], size: [16, 8, 9] },
      { ref: "J3", name: "Connecteur de la récupération", kind: "connector", at: [84, 10], size: [12, 8, 9] }, { ref: "BZ1", name: "Avertisseur sonore", kind: "other", at: [76, 32], size: [12, 12, 8] }],
    nets: { LV: { kind: "dc", voltage: 12 } } },
  features: [], notes: [CAD, "FR4 1,6 mm, 4 couches. Carte de principe : ses fonctions se détaillent dans l'écran des cartes."] };

const BATTERY = { dw: "part/1", id: "FUS-5040", name: "Batterie 3S", family: "purchased", process: "purchased", material: "LI-ION-CELL", revision: "A",
  function: "Alimente la carte de commande, l'actionneur de la vanne et l'éjection.", elec: { kind: "insulator" }, look: { color: "#2c3e63" },
  interfaces: [planar("IF1", "Dessous de la batterie", "fus_battery", "Platine avionique", "A", "-Z", [35, 20], 70, 40, { level: 0 })],
  features: [{ op: "extrude", id: "pack", name: "Pack", profile: { rect: [0, 0, 70, 40], r: 3 }, plane: "XY", length: 24 }, { op: "interfaces" }], notes: ["Batterie achetée : enveloppe indicative, tenue par une sangle."] };

const HARNESS = { dw: "part/1", id: "FUS-5050", name: "Faisceau de commande", family: "purchased", process: "purchased", material: "CU-C110", revision: "A",
  function: "Les fils de la carte de commande à l'actionneur de la vanne, le long du réservoir.", elec: { kind: "conductor", net: "LV" }, look: { color: "#e08a2e" },
  bodies: { passe_fil: { material: "SILICONE", kind: "insulator", label: "Passe-fil" } },
  interfaces: [planar("IF1", "Passe-fil sur la cloison", "fus_harness", "Cloison avionique", "A", "-Z", [0, 0], 10, 10, { level: 0 })],
  features: [cyl(4, 1470, [0, 0, -1420], "Z", { id: "torons", name: "Fils torsadés" }), cyl(4, 12.6, [-2, 0, -1418], "X", { id: "depart", name: "Départ vers l'actionneur" }),
    cyl(4, 12, [0, -2, 48], "Y", { id: "renvoi", name: "Renvoi côté carte" }), cyl(4, 40, [0, 8, 48], "X", { id: "arrivee", name: "Arrivée vers la carte" }), cyl(10, 3, [0, 0, 0], "Z", { id: "passe_fil", name: "Passe-fil", body: "passe_fil" }), { op: "interfaces" }],
  notes: [CAD, "Trois fils torsadés montrés comme un seul toron de 4 mm, cuivre nu pour la masse : gaine non dessinée."] };

const REC_BULKHEAD = { dw: "part/1", id: "FUS-6010", name: "Cloison de récupération", family: "plate", process: "cnc_milling", material: "AL6061-T6", revision: "A",
  function: "Ferme la baie avionique ; reprend l'effort du parachute par son étrier.", elec: { kind: "conductor", net: "Chassis" },
  bodies: { anneau: { material: "SS-304", kind: "conductor", label: "Étrier d'ancrage" } },
  interfaces: [bolt("IF1", "Fixation sur les pattes de la platine", "fus_sled_top", "Platine avionique", "B", "-Z", [0, 0], "M4", { type: "points", pts: [[-55, 0], [55, 0]] }, { level: 0, opts: { thread: "tapped", depth: 6 } }),
    planar("IF2", "Appui du parachute", "fus_chute", "Parachute", "B", "+Z", [0, 0], 144, 144, { level: 6 })],
  features: [cyl(196, 6, [0, 0, 0], "Z", { id: "disque", name: "Disque" }), { op: "interfaces" }, cyl(6, 24, [-12, 0, 6], "Z", { id: "branche_1", name: "Branche de l'étrier", body: "anneau" }), cyl(6, 24, [12, 0, 6], "Z", { id: "branche_2", name: "Branche de l'étrier", body: "anneau" }),
    cyl(6, 30, [-15, 0, 30], "X", { id: "pont", name: "Pont de l'étrier", body: "anneau" })],
  notes: [CAD] };

const CHUTE = { dw: "part/1", id: "FUS-6020", name: "Parachute plié dans sa gaine", family: "purchased", process: "purchased", material: "PA12", revision: "A",
  function: "Freine la descente ; sort quand l'ogive se sépare, à l'apogée.", elec: { kind: "insulator" }, look: { color: "#f08a24" },
  interfaces: [planar("IF1", "Dessous de la gaine", "fus_chute", "Cloison de récupération", "A", "-Z", [0, 0], 144, 144, { level: 0 })],
  features: [{ op: "revolve", id: "gaine", name: "Gaine", profile: { rect: [28, 0, 44, 110], r: 12 }, plane: "XZ", axis: "Z", angle: 360 }, { op: "interfaces" }],
  notes: [CAD, "Toile de polyamide : PA12 pris pour la masse. Le dispositif qui sépare l'ogive n'est pas dessiné."] };

/* the sticker of the platform, wrapped on the central airframe, reading up the rocket — on the side the three-quarter view of the render looks at */
const STICKER = { id: "E1", name: "Sticker DynamiteOrbit.ai", kind: "sticker", inst: "coque_centrale", w: 420, h: 120, turn: 90, on: { p: [58.28, 83.23, 760], axis: [0, 0, 1], c: [0, 0, 0], r: 101.6 },
  art: { type: "logo", text: "DynamiteOrbit.ai", sub: "by DynamiteAgile™", ink: "#26323f", paper: "#ffffff", shape: "round" } };
const PARTS = [NOZZLE, COIL, SKIRT, CHAMBER, GRAIN, INJECTOR, VALVE, TANK, LINE, AIR_A, FIN, AIR_B, BUTTON, AIR_C, NOSE, BULKHEAD, SLED, PCB, BATTERY, HARNESS, REC_BULKHEAD, CHUTE];
/* instance, its part, then the mate that holds it : [its interface, the instance it meets, the interface there, options of the mate] */
const BUILD = [
  ["tuyere", NOZZLE], ["serpentin", COIL, "IF1", "tuyere", "IF3"], ["jupe", SKIRT, "IF1", "tuyere", "IF4"], ["chambre", CHAMBER, "IF1", "tuyere", "IF1"], ["combustible", GRAIN, "IF1", "chambre", "IF2"],
  ["injection", INJECTOR, "IF1", "chambre", "IF3"], ["vanne", VALVE, "IF1", "injection", "IF2"], ["reservoir", TANK, "IF1", "vanne", "IF2"], ["ligne", LINE, "IF1", "serpentin", "IF2"],
  ["coque_arriere", AIR_A, "IF1", "tuyere", "IF2", { angle: 45 }], ...["IF2", "IF3", "IF4", "IF5"].map((f, k) => [`aileron_${k + 1}`, FIN, "IF1", "coque_arriere", f, { angle: 180 }]),
  ["coque_centrale", AIR_B, "IF1", "coque_arriere", "IF6", { angle: 45 }], ["bouton_bas", BUTTON, "IF1", "coque_centrale", "IF3"], ["bouton_haut", BUTTON, "IF1", "coque_centrale", "IF4"],
  ["cloison_avionique", BULKHEAD, "IF1", "reservoir", "IF2"], ["platine", SLED, "IF1", "cloison_avionique", "IF2"], ["carte", PCB, "IF1", "platine", "IF2"], ["batterie", BATTERY, "IF1", "platine", "IF3"],
  ["faisceau", HARNESS, "IF1", "cloison_avionique", "IF3"], ["cloison_recuperation", REC_BULKHEAD, "IF1", "platine", "IF4"], ["parachute", CHUTE, "IF1", "cloison_recuperation", "IF2"],
  ["coque_avant", AIR_C, "IF1", "coque_centrale", "IF2"], ["ogive", NOSE, "IF1", "coque_avant", "IF2"]];

export const DEMO_ROCKET = {
  dw: "project/1", id: "demo-fusee", name: "Fusée à moteur hybride (exemple)", author: "DynamiteOrbit.ai",
  description: "Une fusée-sonde de 8 po de diamètre et d'environ 12 pi de long, à moteur hybride : bloc de combustible en polyuréthane, réservoir de protoxyde d'azote, vanne principale, tuyère refroidie par un serpentin hélicoïdal, carte de commande et faisceau, parachute, quatre ailerons fixes. Un exercice de CAO : géométrie de principe, ni dimensionnée ni validée.",
  parts: withPaths(PARTS),      // a disc drilled and tapped, a tube turned and bored : tool paths written by an AI for the fabrication shop (demo_paths.js)
  assemblies: [{ dw: "assembly/1", id: "FUS-ASM", name: "Fusée hybride — assemblage général",
    instances: BUILD.map(([id, p], k) => ({ id, part: p.id, ...(k ? {} : { fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }) })),
    mates: BUILD.slice(1).map(([id, , mine, to, theirs, o], k) => ({ id: `M${k + 1}`, a: { inst: id, iface: mine }, b: { inst: to, iface: theirs }, linked: true, by: "key", ...(o || {}) })),
    labels: [STICKER],
    render: { scene: "studio", shot: "hero", size: "portrait", ground: true, labels: true, view: null, looks: {
      "FUS-4010": { finish: "paint-gloss", color: "#f4f4f2" }, "FUS-4030": { finish: "paint-gloss", color: "#f4f4f2" }, "FUS-4040": { finish: "paint-gloss", color: "#f4f4f2" }, "FUS-4060": { finish: "paint-gloss", color: "#d6453d" },
      "FUS-4020": { finish: "metal-anodized", color: "#1f4e79" }, "FUS-1010": { finish: "metal-blasted" }, "FUS-1020": { finish: "metal-polished" }, "FUS-1030": { finish: "clear-plastic" }, "FUS-3020": { finish: "metal-brushed" } } },
    plan: { order: BUILD.map(([id]) => id) } }],
  drawing: { words: WORDS_ROCKET },      // the English of what its drawings write (demo_words.js)
  log: [],
};
