/* DesignWizard.ai — example project : the Rover, the product that DynamiteAgile carries through its guided tour — an
   autonomous learning vehicle built on a 1:16 all-terrain RC chassis. Same parts and part numbers (RVR-…) as its bill of
   materials there : the bought chassis, motor, servo and modules, the three parts the team designs (laser-cut module
   plate, printed enclosure, printed bumper) and the sensors. Every part carries the interfaces that tie it to its
   neighbours : the assembly below is nothing but instances and mates. X forward, Y to the left, Z up ; the chassis is
   the ground of the assembly. Shapes and sizes are indicative — the purchased parts are envelopes, not supplier models.
   What the library of materials lacks is said in the notes of the part (PETG → ABS, EPDM → silicone, NdFeB → steel). */

import { WORDS_ROVER } from "./demo_words.js";

const box = (size, at, extra = {}) => ({ op: "box", size, at, ...extra });
const cyl = (d, h, at, axis = "Z", extra = {}) => ({ op: "cylinder", d, h, at, axis, ...extra });
const part = (id, name, fn, material, o = {}) => ({ dw: "part/1", id, name, function: fn, family: "purchased", process: "purchased", material, ...o });
const comp = (label, color) => ({ material: "GENERIC-COMPONENT", kind: "insulator", label, ...(color ? { color } : {}) });
const bolt = (id, name, key, partner, side, face, at, screw, pattern, o = {}) => ({ id, type: "bolt_pattern", name, key, partner, side, face, at, params: { screw, pattern }, ...o });
const planar = (id, name, key, partner, side, face, at, w, h, o = {}) => ({ id, type: "planar", name, key, partner, side, face, at, params: { w, h }, ...o });
const rect = (dx, dy) => ({ type: "rect", nx: 2, ny: 2, dx, dy }), ONE = { type: "single" };
const PETG = "Nomenclature du Rover : PETG. La bibliothèque de matières n'a pas le PETG : ABS pris ici (1,05 contre environ 1,27 g/cm³) — la masse est sous-estimée.";

/** An electronic module : a board on four nylon spacers, its larger components as blocks ; a screw crosses the board, the spacer and the plate, a nut under it.
    comps : [label, size, [x, y], colour]. */
function module(id, name, fn, L, W, key, comps = [], o = {}) {
  const h = 5, m = 2.5, bodies = {}, features = [box([L, W, 1.6], [0, 0, h], { id: "carte", name: "Carte" })];
  for (const [k, [x, y]] of [[m, m], [L - m, m], [m, W - m], [L - m, W - m]].entries()) features.push(cyl(4.5, h, [x, y, 0], "Z", { id: `ent${k + 1}`, name: "Entretoise" }));
  comps.forEach(([label, size, at, color], k) => { bodies[`c${k + 1}`] = comp(label, color); features.push(box(size, [at[0], at[1], h + 1.6], { id: `c${k + 1}`, name: label, body: `c${k + 1}` })); });
  return part(id, name, fn, "FR4", { elec: { kind: "insulator" }, bodies, features: [...features, { op: "interfaces" }], look: { color: o.color || "#2f7d4f" },
    interfaces: [bolt("IF1", `Fixation — ${name}`, key, o.partner || "Plaque porte-modules", "A", "-Z", [L / 2, W / 2], "M2.5", rect(L - 2 * m, W - 2 * m), { level: 0, opts: { head: "none", depth: "through" } })],
    notes: ["Module acheté : enveloppe indicative, sur quatre entretoises en nylon de 5 mm ; vis traversante et écrou sous la plaque.", ...(o.notes || [])] });
}
/** The seat of a module on the plate : the same interface, on the side of the nut — a plain hole through the plate. */
const seat = (id, mod, face, at, o = {}) => ({ ...mod.interfaces[0], id, name: `Emplacement — ${mod.name}`, partner: mod.name, side: "B", face, at, level: undefined, opts: { thread: "clearance" }, ...o });

const PI = module("RVR-5050-01", "Raspberry Pi 4 modèle B 2 Go", "Calcule la navigation et l'évitement, parle en Wi-Fi ; porte le logiciel RVR-SW-001 sur sa carte microSD RVR-5060-01.", 85, 56, "rover_pi",
  [["Ports USB", [17.5, 13.2, 16], [70.5, 2]], ["Ports USB", [17.5, 13.2, 16], [70.5, 20]], ["Ethernet", [21, 16, 13.5], [67, 37.5]], ["Processeur", [15, 15, 2.4], [22, 25], "#9aa3aa"], ["Connecteur GPIO", [51, 5, 8.5], [7, 50]], ["Carte microSD RVR-5060-01", [15, 11, 1], [-2.5, 22.5], "#c9a94f"]],
  { notes: ["Wi-Fi intégré déjà certifié.", "Les trous de la carte sont au pas de 58 × 49 mm ; l'interface reprend ce motif."] });
PI.interfaces[0] = bolt("IF1", "Fixation — Raspberry Pi 4", "rover_pi", "Plaque porte-modules", "A", "-Z", [32.5, 28], "M2.5", rect(58, 49), { level: 0, opts: { head: "none", depth: "through" } });
PI.features = PI.features.map((f) => (/^ent/.test(f.id || "") ? { ...f, at: [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]][+f.id.slice(3) - 1].concat(0) } : f));
const PWM = module("RVR-5170-01", "Carte PWM PCA9685", "Fabrique les signaux du variateur et du servo, en I2C, sans charger le processeur.", 62, 25.4, "rover_pwm", [["Borniers des canaux", [44, 7.5, 9], [9, 15]], ["Bornier d'alimentation", [10, 8, 10], [26, 2], "#3b6fb5"]]);
const IMU = module("RVR-3130-01", "Centrale inertielle ICM-20948 sur carte", "Donne le cap pendant le contournement.", 25.4, 25.4, "rover_imu", [["Capteur", [3, 3, 1], [11.2, 11.2]]]);
const DIV = module("RVR-P11", "Carte des diviseurs de l'écho", "Ramène l'écho des capteurs à ultrasons de 5 V à 3,3 V pour les entrées du Raspberry Pi.", 20, 15, "rover_div", [["Résistances", [12, 6, 1.2], [4, 4.5]]],
  { notes: ["Petite carte faite par l'équipe : référence « à créer dans l'ERP »."] });
const BUCK = module("RVR-5080-01", "Convertisseur abaisseur 5 V 5 A", "Alimente le Raspberry Pi et les capteurs ; le moteur reste sur 7,4 V.", 46, 25, "rover_buck", [["Inductance", [12, 12, 7], [17, 6.5], "#4a4a4f"], ["Condensateur", [8, 8, 8], [34, 8.5]]]);
const INA = module("RVR-5090-02", "Moniteur de tension et courant INA219", "Mesure la tension et le courant de la batterie, en I2C.", 25.5, 22, "rover_ina", [["Bornier", [10, 7.5, 10], [7.7, 12], "#3b6fb5"]]);
const FET = module("RVR-5180-01", "MOSFET de coupure de traction sur carte", "Coupe le signal et l'alimentation du variateur ; ouvert par défaut.", 33, 24, "rover_fet", [["MOSFET", [10, 9, 4.5], [11.5, 7.5]]]);

const CHASSIS = part("RVR-1010-01", "Châssis 1:16 tout-terrain", "Porte tout le robot ; transmission aux quatre roues, suspensions.", "PA66-GF30", { elec: { kind: "insulator" },
  bodies: { arbres: { material: "STEEL-1018", kind: "conductor", label: "Essieux et arbre de transmission" } },
  interfaces: [
    bolt("IF1", "Colonnettes de la plaque porte-modules", "rover_plate", "Plaque porte-modules", "B", "+Z", [135, 50], "M3", rect(180, 84), { level: 53, opts: { thread: "insert", depth: 6, standoff: { h: 50, d: 8 } } }),
    planar("IF2", "Appui de la batterie", "rover_battery", "Batterie", "B", "+Z", [147.5, 23], 105, 34, { level: 3 }),
    bolt("IF3", "Platine du moteur", "rover_motor", "Moteur", "A", "+X", [78, 20], "M3", { type: "points", pts: [[-8, 0], [8, 0]] }, { level: 64, opts: { depth: 4.5, head: "none" } }),
    bolt("IF4", "Colonnettes du servo", "rover_servo", "Servo de direction", "B", "+Z", [183, 78], "M3", rect(48, 10), { level: 31, opts: { thread: "insert", depth: 6, standoff: { h: 28, d: 6 } } }),
    planar("IF5", "Appui du variateur", "rover_esc", "Variateur", "B", "+Z", [127.5, 77], 35, 22, { level: 3 }),
    ...[["IF6", "+Y", 40, 117, "arrière gauche"], ["IF7", "+Y", 226, 117, "avant gauche"], ["IF8", "-Y", 40, -17, "arrière droite"], ["IF9", "-Y", 226, -17, "avant droite"]].map(([id, face, x, level, where]) =>
      ({ id, type: "fit", name: `Fusée de roue ${where}`, key: "rover_wheel", partner: "Roue", side: "A", face, at: [x, 12], level, params: { d: 5, length: 18, fit: "H7/g6" } })),
    { id: "IF10", type: "pins", name: "Tiges de pivot du pare-chocs", key: "rover_bumper", partner: "Pare-chocs avant", side: "B", face: "+X", at: [50, 9], level: 270, params: { d: 3, pitch: 110, n: 2, length: 10 } },
    bolt("IF11", "Bossage du support du capteur à effet Hall", "rover_hall", "Support du capteur à effet Hall", "B", "+Z", [153, 64], "M3", ONE, { level: 6, opts: { thread: "insert", depth: 6, standoff: { h: 3, d: 8 } } }),
    planar("IF12", "Collier de l'arbre — aimant", "rover_magnet", "Aimant", "B", "+Z", [153, 50], 6, 6, { level: 16 }),
    planar("IF13", "Appui du microrupteur droit", "rover_switch", "Microrupteur", "B", "+Z", [262, 22], 20, 6.4, { level: 15 }),
    planar("IF14", "Appui du microrupteur gauche", "rover_switch", "Microrupteur", "B", "+Z", [262, 78], 20, 6.4, { level: 15 })],
  features: [
    { op: "extrude", id: "plancher", name: "Plancher", profile: { rect: [0, 0, 258, 100], r: 10 }, plane: "XY", length: 3 },
    box([220, 4, 14], [22, 0, 3], { id: "longeron_d", name: "Longeron droit" }), box([220, 4, 14], [22, 96, 3], { id: "longeron_g", name: "Longeron gauche" }),
    box([40, 44, 30], [20, 28, -4], { id: "pont_ar", name: "Carter du pont arrière" }), box([30, 44, 24], [211, 28, -4], { id: "pont_av", name: "Carter du pont avant" }),
    cyl(10, 134, [40, -17, 12], "Y", { id: "trompette_ar", name: "Trompettes arrière" }), cyl(10, 134, [226, -17, 12], "Y", { id: "trompette_av", name: "Trompettes avant" }),
    box([4, 36, 32], [60, 60, 3], { id: "platine", name: "Platine du moteur" }), cyl(10, 6, [59, 78, 20], "X", { id: "passage", name: "Passage de l'arbre du moteur", mode: "cut" }),
    box([4, 70, 34], [16, 15, 3], { id: "tour_ar", name: "Tour d'amortisseurs arrière" }), box([4, 70, 30], [243, 15, 3], { id: "tour_av", name: "Tour d'amortisseurs avant" }),
    box([12, 124, 12], [258, -12, 3], { id: "traverse", name: "Traverse avant" }),
    cyl(5, 151, [60, 50, 10], "X", { id: "arbre", name: "Arbre de transmission", body: "arbres" }), cyl(12, 6, [150, 50, 10], "X", { id: "collier", name: "Collier de l'aimant", body: "arbres" }),
    box([6, 6, 6], [150, 47, 10], { id: "meplat", name: "Méplat du collier", body: "arbres" }),
    { op: "interfaces" }],
  notes: ["Pièce achetée (avec moteur et servo, dans la nomenclature) : enveloppe indicative, sans la cinématique des suspensions ni de la direction.", "Les colonnettes de la plaque et du servo, la platine du moteur et la traverse avant sont les reprises ajoutées par l'équipe."] });

const WHEEL = part("RVR-1010-W", "Roue tout-terrain", "Transmet l'effort au sol ; fait partie du châssis RVR-1010-01 (quatre par robot).", "ABS", { elec: { kind: "insulator" }, look: { color: "#d9d4c7" },
  bodies: { pneu: { material: "SILICONE", kind: "insulator", label: "Pneu", color: "#26282b" } },
  interfaces: [{ id: "IF1", type: "fit", name: "Moyeu", key: "rover_wheel", partner: "Châssis", side: "B", face: "-Z", at: [0, 0], level: 0, params: { d: 5, length: 18, fit: "H7/g6" } }],
  features: [cyl(46, 32, [0, 0, 0], "Z", { id: "jante", name: "Jante" }), cyl(76, 28, [0, 0, 2], "Z", { id: "pneu", name: "Pneu", body: "pneu" }), cyl(46, 28, [0, 0, 2], "Z", { id: "creux", body: "pneu", mode: "cut" }), { op: "interfaces" }],
  notes: ["Pneu en caoutchouc : silicone pris ici pour la masse, la bibliothèque n'ayant pas d'autre élastomère."] });

const MOTOR = part("RVR-1020-01", "Moteur à balais type 390", "Entraîne les quatre roues par la transmission du châssis.", "STEEL-1018", { elec: { kind: "conductor", net: "Chassis" },
  bodies: { arbre: { material: "STEEL-1018", kind: "conductor", label: "Arbre et pignon" }, flasque: comp("Flasque et balais", "#3a3d42") },
  interfaces: [bolt("IF1", "Face avant du moteur", "rover_motor", "Châssis", "B", "-Z", [0, 0], "M3", { type: "points", pts: [[-8, 0], [8, 0]] }, { level: 0, opts: { thread: "tapped", depth: 4 } })],
  features: [cyl(28, 34, [0, 0, 0], "Z", { id: "carcasse", name: "Carcasse" }), cyl(26, 5, [0, 0, 34], "Z", { id: "flasque", name: "Flasque arrière", body: "flasque" }), cyl(2.3, 9, [0, 0, -9], "Z", { id: "arbre", name: "Arbre", body: "arbre" }), cyl(7, 5, [0, 0, -8], "Z", { id: "pignon", name: "Pignon", body: "arbre" }), { op: "interfaces" }] });

const SERVO = part("RVR-1040-02", "Servo de direction 9 kg·cm", "Braque les roues avant de ± 30°.", "GENERIC-COMPONENT", { elec: { kind: "insulator" }, look: { color: "#30343a" },
  bodies: { palonnier: { material: "ABS", kind: "insulator", label: "Palonnier", color: "#e8e3d8" } },
  interfaces: [bolt("IF1", "Pattes du servo", "rover_servo", "Châssis", "A", "-Z", [0, 0], "M3", rect(48, 10), { level: 26, opts: { head: "none", depth: 2.5 } })],
  features: [box([40, 20, 36], [-20, -10, 0], { id: "corps", name: "Corps" }), box([54, 20, 2.5], [-27, -10, 26], { id: "pattes", name: "Pattes" }), cyl(6, 4, [10, 0, 36], "Z", { id: "sortie", name: "Sortie" }),
    box([32, 6, 2], [-6, -3, 40], { id: "palonnier", name: "Palonnier", body: "palonnier" }), { op: "interfaces" }] });

const ESC = part("RVR-5030-01", "Variateur à balais 20 A", "Règle la vitesse du moteur, commandé par un signal PWM de 50 Hz.", "GENERIC-COMPONENT", { elec: { kind: "insulator" }, look: { color: "#1f4e79" },
  bodies: { radiateur: { material: "AL6061-T6", kind: "conductor", label: "Radiateur" } },
  interfaces: [planar("IF1", "Dessous du variateur", "rover_esc", "Châssis", "A", "-Z", [17.5, 11], 35, 22, { level: 0 })],
  features: [box([35, 22, 10], [0, 0, 0], { id: "corps", name: "Corps" }), box([20, 18, 4], [7.5, 2, 10], { id: "radiateur", name: "Radiateur", body: "radiateur" }), { op: "interfaces" }], notes: ["Tenu par un adhésif double face sur le plancher."] });

const BATTERY = part("RVR-5070-01", "Batterie LiPo 2S 2 200 mAh XT60", "Fournit 7,4 V au moteur et, par le convertisseur, 5 V à l'électronique.", "LI-ION-CELL", { elec: { kind: "insulator" }, look: { color: "#2c3e63" },
  bodies: { prise: comp("Connecteur XT60", "#e0b422") },
  interfaces: [planar("IF1", "Dessous de la batterie", "rover_battery", "Châssis", "A", "-Z", [52.5, 17], 105, 34, { level: 0 })],
  features: [{ op: "extrude", id: "pack", name: "Pack", profile: { rect: [0, 0, 105, 34], r: 3 }, plane: "XY", length: 17 }, box([16, 8, 8], [105, 13, 4], { id: "prise", name: "Connecteur XT60", body: "prise" }), { op: "interfaces" }],
  notes: ["Certifiée IEC 62133-2 et UN 38.3 dans la nomenclature du Rover.", "Enveloppe gainée : matière homogénéisée pour la masse ; tenue par une sangle auto-agrippante."] });

const PLATE_SEATS = [seat("IF3", PI, "+Z", [52.5, 46]), seat("IF4", PWM, "+Z", [51, 89.7]), seat("IF5", IMU, "+Z", [120.7, 89.7]), seat("IF6", DIV, "+Z", [95, 89.5]), seat("IF7", BUCK, "-Z", [112, 33]), seat("IF8", INA, "-Z", [150, 33]), seat("IF9", FET, "-Z", [104, 58])];
const PLATE = { dw: "part/1", id: "RVR-2200-04", name: "Plaque porte-modules découpée laser", family: "sheet", process: "laser_cut", material: "PMMA", revision: "A",
  function: "Porte l'électronique au-dessus du châssis ; transparente, elle laisse voir le câblage.", elec: { kind: "insulator" }, intent: { loads: "Masse des modules, chocs de roulage", environment: "Intérieur et cour d'école", quantity: 30, priority: "cost" },
  interfaces: [
    bolt("IF1", "Fixation sur les colonnettes du châssis", "rover_plate", "Châssis", "A", "-Z", [105, 60], "M3", rect(180, 84), { opts: { head: "none", depth: "through" } }),
    bolt("IF2", "Fixation du boîtier électronique", "rover_box", "Boîtier électronique", "A", "+Z", [81, 60], "M3", rect(134, 80), { opts: { head: "none", depth: "through" } }),
    ...PLATE_SEATS,
    ...[["IF10", [198, 60], 0, "centre"], ["IF11", [176, 104], 45, "gauche"], ["IF12", [176, 16], -45, "droite"]].map(([id, at, rot, where]) => bolt(id, `Capteur à ultrasons — ${where}`, "rover_us", "Capteur à ultrasons", "B", "+Z", at, "M3", ONE, { rot, opts: { thread: "clearance" } })),
    bolt("IF13", "Capteur à temps de vol, sous le bord avant", "rover_tof", "Capteur ToF", "B", "-Z", [203, 60], "M2.5", ONE, { opts: { thread: "clearance" } })],
  stock: { form: "sheet", L: 210, W: 120, t: 4 },
  features: [{ op: "outline", id: "contour", name: "Contour", profile: { poly: [[0, 0, 6], [185, 0, 6], [210, 25, 6], [210, 95, 6], [185, 120, 6], [0, 120, 6]] } },
    { op: "pocket", id: "passe_cables", name: "Passage des câbles", face: "+Z", slot: [163, 45, 163, 75, 8], depth: "through" }, { op: "interfaces" }, { op: "deburr", id: "chants", note: "Chants polis par le laser : retirer le film de protection après montage" }],
  notes: ["PMMA coulé de 4 mm, découpe laser CO2 ; trous au diamètre de passage.", "Pans coupés à 45° à l'avant : les capteurs à ultrasons de gauche et de droite regardent le long de leur normale."] };

const ENCLOSURE = { dw: "part/1", id: "RVR-2210-01", name: "Boîtier électronique", family: "enclosure", process: "fdm", material: "ABS", revision: "B",
  function: "Protège le Raspberry Pi et ses cartes des chocs et des projections ; ouvert vers le bas pour l'air.", elec: { kind: "insulator" }, look: { color: "#f0b429" },
  intent: { loads: "Chocs de roulage, appui sur le bouton d'arrêt", environment: "Intérieur et cour d'école, projections", quantity: 30, priority: "lead_time" },
  interfaces: [
    bolt("IF1", "Fixation sur la plaque", "rover_box", "Plaque porte-modules", "B", "-Z", [75, 48], "M3", rect(134, 80), { level: 0, opts: { thread: "insert", depth: 8 } }),
    planar("IF2", "Gorge du cordon de joint", "rover_gasket", "Cordon de joint", "B", "-Z", [75, 48], 150, 96, { level: 1.5 }),
    { id: "IF3", type: "cutout", name: "Passage du bouton d'arrêt d'urgence", key: "rover_estop", partner: "Bouton d'arrêt d'urgence", side: "A", face: "+Z", at: [120, 30], params: { shape: "round", d: 16 }, opts: { depth: 4.5 } },
    { id: "IF4", type: "cutout", name: "Passage de la DEL d'état", key: "rover_led", partner: "DEL RGB d'état", side: "A", face: "+Z", at: [120, 62], params: { shape: "round", d: 5 }, opts: { depth: 4.5 } }],
  stock: { form: "print" },
  features: [{ op: "extrude", id: "volume", name: "Volume extérieur", profile: { rect: [0, 0, 150, 96], r: 6 }, plane: "XY", length: 48 }, { op: "shell", id: "coque", name: "Coque", t: 4, open: ["-Z"] },
    ...[[4, 4], [138, 4], [4, 84], [138, 84]].map(([x, y], k) => box([8, 8, 44.5], [x, y, 0], { id: `colonne${k + 1}`, name: "Colonne de fixation" })),
    { op: "pocket", id: "gorge", name: "Gorge du joint", face: "-Z", profile: { outer: { rect: [1, 1, 148, 94], r: 5 }, holes: [{ rect: [3, 3, 144, 90], r: 3 }] }, depth: 1.5 },
    { op: "pocket", id: "encoche", name: "Encoche des câbles", face: "+X", rect: [38, 0, 20, 8], depth: 4.5 }, { op: "interfaces" }],
  notes: [PETG, "Prototype imprimé (FDM), puis moulé en PC/ABS en série, selon la nomenclature du Rover.", "Rouge sur fond jaune pour le bouton d'arrêt : le boîtier est jaune."] };

const GASKET = part("RVR-2211-01", "Cordon de joint du boîtier", "Ferme le bord du boîtier sur la plaque.", "SILICONE", { elec: { kind: "insulator" }, look: { color: "#2b2b2e" },
  interfaces: [planar("IF1", "Fond de la gorge", "rover_gasket", "Boîtier électronique", "A", "+Z", [75, 48], 150, 96, { level: 1.5 })],
  features: [{ op: "extrude", id: "cordon", name: "Cordon", profile: { outer: { rect: [1, 1, 148, 94], r: 5 }, holes: [{ rect: [3, 3, 144, 90], r: 3 }] }, plane: "XY", length: 1.5 }, { op: "interfaces" }],
  notes: ["Nomenclature du Rover : cordon EPDM de 2 mm. La bibliothèque n'a pas l'EPDM : silicone pris ici ; cordon montré comprimé, au ras du bord."] });

const ESTOP = part("RVR-5190-03", "Bouton d'arrêt d'urgence à verrouillage 16 mm", "Coupe la traction d'un coup de paume ; en série avec les microrupteurs du pare-chocs.", "GENERIC-COMPONENT", { elec: { kind: "insulator" },
  bodies: { champignon: { material: "ABS", kind: "insulator", label: "Champignon", color: "#d6453d" }, collerette: { material: "ABS", kind: "insulator", label: "Collerette", color: "#f0d21f" } },
  interfaces: [{ id: "IF1", type: "cutout", name: "Appui de la collerette", key: "rover_estop", partner: "Boîtier électronique", side: "B", face: "-Z", at: [0, 0], level: 0, params: { shape: "round", d: 16 } }],
  features: [cyl(15.6, 28, [0, 0, -28], "Z", { id: "corps", name: "Corps" }), cyl(22, 2, [0, 0, 0], "Z", { id: "collerette", name: "Collerette", body: "collerette" }), cyl(24, 11, [0, 0, 5], "Z", { id: "champignon", name: "Champignon", body: "champignon" }), cyl(12, 3, [0, 0, 2], "Z", { id: "tige", name: "Tige", body: "champignon" }), { op: "interfaces" }] });

const LED = part("RVR-5220-01", "DEL RGB d'état", "Vert : prêt ; bleu : roule ; ambre : contourne ; rouge : arrêt ou batterie basse.", "PC", { elec: { kind: "insulator" }, look: { color: "#7fd6a0", opacity: 0.8 },
  interfaces: [{ id: "IF1", type: "cutout", name: "Appui de la DEL", key: "rover_led", partner: "Boîtier électronique", side: "B", face: "-Z", at: [0, 0], level: 0, params: { shape: "round", d: 5 } }],
  features: [cyl(6, 1, [0, 0, 0], "Z", { id: "collerette", name: "Collerette" }), cyl(4.8, 7, [0, 0, -5], "Z", { id: "dome", name: "Dôme" }), { op: "interfaces" }] });

const US = part("RVR-3100-01", "Capteur à ultrasons HC-SR04", "Mesure la distance des obstacles durs : gauche, centre, droite à ± 45°.", "FR4", { elec: { kind: "insulator" }, look: { color: "#2a5db0" },
  bodies: { transducteurs: { material: "AL6061-T6", kind: "conductor", label: "Transducteurs" }, equerre: { material: "STEEL-1018", kind: "conductor", label: "Équerre" } },
  interfaces: [bolt("IF1", "Pied de l'équerre", "rover_us", "Plaque porte-modules", "A", "-Z", [-5, 0], "M3", ONE, { level: 0, opts: { head: "none", depth: 1.5 } })],
  features: [box([1.6, 45, 20], [2, -22.5, 3], { id: "carte", name: "Carte" }), cyl(16, 12, [3.6, -13, 13], "X", { id: "t1", name: "Émetteur", body: "transducteurs" }), cyl(16, 12, [3.6, 13, 13], "X", { id: "t2", name: "Récepteur", body: "transducteurs" }),
    box([12, 20, 1.5], [-10, -10, 0], { id: "pied", name: "Pied", body: "equerre" }), box([1.5, 20, 14], [0.5, -10, 0], { id: "montant", name: "Montant", body: "equerre" }), { op: "interfaces" }],
  notes: ["Trois par robot ; l'équerre vient du kit de visserie RVR-1230-01."] });

const TOF = part("RVR-3120-01", "Capteur ToF VL53L1X sur carte", "Voit, dans l'axe, de 4 cm à 4 m, les obstacles mous que les ultrasons ratent.", "FR4", { elec: { kind: "insulator" }, look: { color: "#7a2a8c" },
  bodies: { equerre: { material: "STEEL-1018", kind: "conductor", label: "Équerre" }, optique: comp("Optique", "#111316") },
  interfaces: [bolt("IF1", "Dessus de l'équerre", "rover_tof", "Plaque porte-modules", "A", "+Z", [-5, 0], "M2.5", ONE, { level: 0, opts: { head: "none", depth: 1.5 } })],
  features: [box([1.6, 18, 13], [1.5, -9, -14], { id: "carte", name: "Carte" }), box([10, 12, 1.5], [-9, -6, -1.5], { id: "pied", name: "Pied", body: "equerre" }), box([1.5, 12, 14], [0, -6, -14], { id: "montant", name: "Montant", body: "equerre" }),
    box([1.2, 5, 2.5], [3.1, -2.5, -9], { id: "optique", name: "Optique", body: "optique" }), { op: "interfaces" }] });

const HALL = { dw: "part/1", id: "RVR-3140-02", name: "Support du capteur à effet Hall", family: "prismatic", process: "fdm", material: "ABS", revision: "C",
  function: "Tient le capteur à effet Hall au-dessus de l'aimant de l'arbre : une impulsion par tour, la vitesse des roues.", elec: { kind: "insulator" }, look: { color: "#e8554b" },
  bodies: { capteur: comp("Capteur à effet Hall") },
  interfaces: [bolt("IF1", "Pied du support", "rover_hall", "Châssis", "A", "-Z", [0, 0], "M3", ONE, { level: 0, opts: { head: "none", depth: 3 } })],
  stock: { form: "print" },
  features: [box([14, 10, 3], [-7, -5, 0], { id: "pied", name: "Pied" }), box([14, 3, 18], [-7, -8, 0], { id: "montant", name: "Montant" }), box([14, 12.5, 3], [-7, -17.5, 15], { id: "bras", name: "Bras" }),
    box([4, 3, 1.5], [-2, -15.5, 13.5], { id: "capteur", name: "Capteur", body: "capteur" }), { op: "interfaces" }],
  notes: [PETG, "Entrefer d'environ 0,5 mm entre le capteur et l'aimant : à régler au montage."] };

const MAGNET = part("RVR-3141-01", "Aimant néodyme Ø6 × 3 mm", "Tourne avec l'arbre de transmission : il passe sous le capteur à chaque tour.", "STEEL-1018", { elec: { kind: "conductor" }, look: { color: "#c8cdd3" },
  interfaces: [planar("IF1", "Face collée", "rover_magnet", "Châssis", "A", "-Z", [0, 0], 6, 6, { level: 0 })],
  features: [cyl(6, 3, [0, 0, 0], "Z", { id: "aimant", name: "Aimant" }), { op: "interfaces" }], notes: ["NdFeB N42 dans la nomenclature du Rover ; acier pris ici pour la masse (7,87 contre environ 7,5 g/cm³).", "Collé sur le méplat du collier de l'arbre."] });

const SWITCH = part("RVR-3150-02", "Microrupteur à levier", "Détecte le contact du pare-chocs ; câblé en série avec l'arrêt d'urgence.", "GENERIC-COMPONENT", { elec: { kind: "insulator" },
  bodies: { levier: { material: "SS-304", kind: "conductor", label: "Levier" } },
  interfaces: [planar("IF1", "Dessous du microrupteur", "rover_switch", "Châssis", "A", "-Z", [0, 0], 20, 6.4, { level: 0 })],
  features: [box([20, 6.4, 10], [-10, -3.2, 0], { id: "corps", name: "Corps" }), box([10, 4, 0.5], [9, -2, 8], { id: "levier", name: "Levier", body: "levier" }), box([0.5, 4, 6], [18.5, -2, 2.5], { id: "palette", name: "Palette", body: "levier" }), { op: "interfaces" }], notes: ["Deux par robot."] });

const BUMPER = { dw: "part/1", id: "RVR-3160-01", name: "Pare-chocs avant", family: "prismatic", process: "fdm", material: "ABS", revision: "A",
  function: "Encaisse le choc et, en pivotant sur ses deux tiges, appuie sur les microrupteurs.", elec: { kind: "insulator" }, look: { color: "#30343a" },
  intent: { loads: "Choc frontal à 3 m/s contre un mur", environment: "Intérieur et cour d'école", quantity: 30, priority: "lead_time" },
  interfaces: [{ id: "IF1", type: "pins", name: "Alésages des tiges de pivot", key: "rover_bumper", partner: "Châssis", side: "A", face: "-X", at: [0, 11], level: 0, params: { d: 3, pitch: 110, n: 2, length: 10 } }],
  stock: { form: "print" },
  features: [{ op: "extrude", id: "arc", name: "Arc", profile: { poly: [[0, -80, 3], [12, -80, 5], [26, -50, 22], [26, 50, 22], [12, 80, 5], [0, 80, 3], [0, 45, 2], [14, 38, 8], [14, -38, 8], [0, -45, 2]] }, plane: "XY", length: 22 }, { op: "interfaces" }],
  notes: [PETG, "Prototype imprimé (FDM), puis moulé en TPU en série, selon la nomenclature du Rover."] };

const PARTS = [CHASSIS, WHEEL, MOTOR, SERVO, ESC, BATTERY, PLATE, ENCLOSURE, GASKET, PI, PWM, IMU, DIV, BUCK, INA, FET, US, TOF, HALL, MAGNET, SWITCH, BUMPER, ESTOP, LED];
/* instance, its part, then the mate that holds it : [its interface, the instance it meets, the interface there, options of the mate] */
const BUILD = [
  ["chassis", CHASSIS], ["plaque", PLATE, "IF1", "chassis", "IF1"], ["batterie", BATTERY, "IF1", "chassis", "IF2"], ["moteur", MOTOR, "IF1", "chassis", "IF3"], ["servo", SERVO, "IF1", "chassis", "IF4"], ["variateur", ESC, "IF1", "chassis", "IF5"],
  ["roue_ar_g", WHEEL, "IF1", "chassis", "IF6"], ["roue_av_g", WHEEL, "IF1", "chassis", "IF7"], ["roue_ar_d", WHEEL, "IF1", "chassis", "IF8"], ["roue_av_d", WHEEL, "IF1", "chassis", "IF9"],
  ["pare_chocs", BUMPER, "IF1", "chassis", "IF10", { angle: 180 }], ["support_hall", HALL, "IF1", "chassis", "IF11"], ["aimant", MAGNET, "IF1", "chassis", "IF12"], ["rupteur_d", SWITCH, "IF1", "chassis", "IF13"], ["rupteur_g", SWITCH, "IF1", "chassis", "IF14"],
  ["boitier", ENCLOSURE, "IF1", "plaque", "IF2"], ["joint", GASKET, "IF1", "boitier", "IF2"], ["pi", PI, "IF1", "plaque", "IF3"], ["pwm", PWM, "IF1", "plaque", "IF4"], ["imu", IMU, "IF1", "plaque", "IF5"], ["diviseurs", DIV, "IF1", "plaque", "IF6"],
  ["convertisseur", BUCK, "IF1", "plaque", "IF7"], ["moniteur", INA, "IF1", "plaque", "IF8"], ["coupure", FET, "IF1", "plaque", "IF9"],
  ["us_centre", US, "IF1", "plaque", "IF10"], ["us_gauche", US, "IF1", "plaque", "IF11"], ["us_droite", US, "IF1", "plaque", "IF12"], ["tof", TOF, "IF1", "plaque", "IF13"],
  ["arret", ESTOP, "IF1", "boitier", "IF3"], ["del", LED, "IF1", "boitier", "IF4"]];

export const DEMO_ROVER = {
  dw: "project/1", id: "demo-rover", name: "Rover — véhicule autonome d'apprentissage (exemple)", author: "DesignWizard.ai",
  description: "Le Rover de la visite guidée de DynamiteAgile, en 3D : un robot autonome sur un châssis tout-terrain 1:16 — plaque porte-modules découpée au laser, boîtier et pare-chocs imprimés, Raspberry Pi, trois capteurs à ultrasons, un capteur à temps de vol, une centrale inertielle, un capteur à effet Hall, arrêt d'urgence. Mêmes références RVR que sa nomenclature ; les pièces achetées sont des enveloppes indicatives. Le logiciel RVR-SW-001, la boîte RVR-9010-01 et la notice RVR-9020-01 ne sont pas des pièces 3D.",
  parts: PARTS,
  assemblies: [{ dw: "assembly/1", id: "RVR-ASM", name: "Rover — assemblage général",
    instances: BUILD.map(([id, p], k) => ({ id, part: p.id, ...(k ? {} : { fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }) })),
    mates: BUILD.slice(1).map(([id, , mine, to, theirs, o], k) => ({ id: `M${k + 1}`, a: { inst: id, iface: mine }, b: { inst: to, iface: theirs }, linked: true, by: "key", ...(o || {}) })),
    plan: { order: BUILD.map(([id]) => id) } }],
  drawing: { words: WORDS_ROVER },      // the English of what its drawings write (demo_words.js)
  log: [],
};
