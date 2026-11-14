/* DesignWizard.ai — starter parts: parametric specs in the part language, used by "Nouvelle pièce" when the user does
   not start from an interview. Each is a normal part: every dimension is a parameter, interfaces are ready to mate. */

const P = (value, min, max, label, group = "Enveloppe", step = 1) => ({ value, min, max, step, unit: "mm", label, group });

export const TEMPLATES = [
  { key: "plate", icon: "layers", title: "Plaque usinée", text: "Plaque rectangulaire avec motif de fixation aux coins.",
    spec: { name: "Plaque de montage", family: "plate", process: "cnc_milling", material: "AL6061-T6", function: "Plaque support avec quatre vis de fixation.",
      params: { L: P(120, 40, 400, "Longueur"), W: P(80, 30, 300, "Largeur"), t: P(6, 2, 25, "Épaisseur", "Enveloppe", 0.5), r: P(6, 0, 30, "Rayon des coins", "Détails", 0.5), inset: P(10, 5, 40, "Retrait des vis", "Fixation", 0.5) },
      interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation au support", key: "plate_mount", side: "A", face: "+Z", at: ["L/2", "W/2"],
        params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 2, dx: "L - 2*inset", dy: "W - 2*inset" } }, opts: { head: "cbore" } }],
      features: [{ op: "extrude", id: "base", name: "Plaque", profile: { rect: [0, 0, "L", "W"], r: "r" }, plane: "XY", length: "t" }, { op: "interfaces" }, { op: "chamfer", id: "break", name: "Cassage des arêtes", d: 0.5, edges: { face: "+Z" } }] } },
  { key: "bracket", icon: "part", title: "Équerre", text: "Équerre en L usinée, une interface sur chaque aile.",
    spec: { name: "Équerre de fixation", family: "prismatic", process: "cnc_milling", material: "AL6061-T6", function: "Relie deux plans perpendiculaires.",
      params: { A: P(60, 20, 200, "Aile horizontale"), B: P(50, 20, 200, "Aile verticale"), W: P(40, 15, 150, "Largeur"), t: P(5, 2, 15, "Épaisseur", "Enveloppe", 0.5), ri: P(4, 1, 15, "Rayon intérieur", "Détails", 0.5) },
      interfaces: [
        { id: "IF1", type: "bolt_pattern", name: "Fixation au sol", key: "bracket_base", side: "A", face: "-Z", at: ["t + (A - t)/2", "W/2"], params: { screw: "M5", pattern: { type: "rect", nx: 1, ny: 2, dx: 0, dy: "W - 16" } }, opts: { depth: "t + 0.5" } },
        { id: "IF2", type: "bolt_pattern", name: "Fixation au mur", key: "bracket_wall", side: "A", face: "-X", at: ["W/2", "t + (B - t)/2"], params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 1, dx: "W - 16", dy: 0 } }, opts: { depth: "t + 0.5" } }],
      features: [{ op: "extrude", id: "L", name: "Profil en L", plane: "XZ", length: "W",
        profile: { poly: [[0, 0], ["A", 0], ["A", "t"], ["t", "t", "ri"], ["t", "B"], [0, "B"]] } }, { op: "interfaces" }, { op: "fillet", id: "corners", name: "Arrondis des ailes", r: 3, edges: { dir: "Z", box: ["A - 1", -1, -1, "A + 1", "W + 1", "t + 1"] } }] } },
  { key: "enclosure", icon: "assembly", title: "Boîtier (base)", text: "Base de boîtier creuse avec colonnettes pour PCB, découpe connecteur et fixations du couvercle.",
    spec: { name: "Base de boîtier", family: "enclosure", process: "injection_molding", material: "PC-ABS", function: "Loge et protège la carte électronique.",
      params: { L: P(130, 60, 300, "Longueur intérieure + parois"), W: P(90, 40, 250, "Largeur"), H: P(32, 12, 120, "Hauteur"), wall: P(2.5, 1.2, 5, "Paroi", "Enveloppe", 0.1),
        rc: P(6, 1, 20, "Rayon des coins", "Détails", 0.5), pcbL: P(100, 40, 250, "Entraxe PCB en X", "PCB"), pcbW: P(70, 30, 200, "Entraxe PCB en Y", "PCB"), so: P(6, 3, 20, "Hauteur des colonnettes", "PCB", 0.5),
        conW: P(16, 6, 60, "Largeur connecteur", "Connecteur"), conH: P(8, 3, 30, "Hauteur connecteur", "Connecteur") },
      interfaces: [
        { id: "IF1", type: "bolt_pattern", name: "Fixation du PCB", key: "pcb_mount", partner: "PCB", side: "B", face: "+Z", at: ["L/2", "W/2"], level: "wall + so",
          params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "pcbL", dy: "pcbW" } }, opts: { thread: "insert", standoff: { h: "so", d: 7.5 } } },
        { id: "IF2", type: "cutout", name: "Passage connecteur", key: "io_connector", partner: "Connecteur", side: "A", face: "-Y", at: ["L/2", "wall + so + 1.6 + conH/2"],
          params: { shape: "rect", w: "conW", h: "conH", r: 1 }, opts: { depth: "wall + 0.5" } },
        { id: "IF3", type: "bolt_pattern", name: "Fixation du couvercle", key: "cover_screws", partner: "Couvercle", side: "B", face: "+Z", at: ["L/2", "W/2"],
          params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "L - 2*wall - 7", dy: "W - 2*wall - 7" } }, opts: { thread: "insert", depth: 8 } },
        { id: "IF4", type: "planar", name: "Plan de joint du couvercle", key: "cover_seat", partner: "Couvercle", side: "B", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } }],
      features: [{ op: "extrude", id: "body", name: "Volume extérieur", profile: { rect: [0, 0, "L", "W"], r: "rc" }, plane: "XY", length: "H" },
        { op: "shell", id: "shell", name: "Coque", t: "wall", open: ["+Z"] },
        { op: "boss", id: "posts", name: "Bossages du couvercle", face: "+Z", start: "wall", d: 7, h: "H - wall",
          at: { grid: { origin: ["wall + 3.5", "wall + 3.5"], nx: 2, ny: 2, dx: "L - 2*wall - 7", dy: "W - 2*wall - 7" } } }] } },
  { key: "cover", icon: "layers", title: "Couvercle", text: "Couvercle plat qui se visse sur la base du boîtier.",
    spec: { name: "Couvercle de boîtier", family: "plate", process: "injection_molding", material: "PC-ABS", function: "Ferme le boîtier.",
      params: { L: P(130, 60, 300, "Longueur"), W: P(90, 40, 250, "Largeur"), t: P(2.5, 1.2, 5, "Épaisseur", "Enveloppe", 0.1), rc: P(6, 1, 20, "Rayon des coins", "Détails", 0.5),
        sx: P(118, 20, 290, "Entraxe des vis en X", "Fixation", 0.5), sy: P(78, 20, 240, "Entraxe des vis en Y", "Fixation", 0.5) },
      interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation sur la base", key: "cover_screws", partner: "Base de boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"],
        params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "sx", dy: "sy" } }, opts: { head: "none" } },
        { id: "IF2", type: "planar", name: "Plan de joint", key: "cover_seat", partner: "Base de boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } }],
      features: [{ op: "extrude", id: "lid", name: "Plaque", profile: { rect: [0, 0, "L", "W"], r: "rc" }, plane: "XY", length: "t" }] } },
  { key: "pcb", icon: "pcb", title: "Carte PCB", text: "Carte avec CPU, connecteur, étage de puissance et zones d'isolation.",
    spec: { name: "Carte de contrôle", family: "pcb", process: "pcb", material: "FR4", function: "Porte le CPU, les capteurs et les connecteurs.",
      params: { L: P(110, 30, 300, "Longueur"), W: P(80, 20, 250, "Largeur"), pcbL: P(100, 20, 280, "Entraxe des trous en X", "Fixation"), pcbW: P(70, 10, 230, "Entraxe des trous en Y", "Fixation") },
      interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation de la carte", key: "pcb_mount", partner: "Boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"],
        params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "pcbL", dy: "pcbW" } } }],
      pcb: { size: ["L", "W"], r: 2, t: 1.6,
        components: [{ ref: "U1", name: "CPU", kind: "mcu", at: ["L/2", "W/2"], size: [14, 14, 1.6] }, { ref: "J1", name: "Connecteur E/S", kind: "connector", at: ["L/2", 5.5], size: [16, 11, 8] },
          { ref: "Q1", name: "Étage de puissance", kind: "mosfet", at: ["L - 22", "W - 18"], size: [16, 10, 4.5] }, { ref: "U2", name: "Capteur de courant", kind: "sensor", at: [22, "W - 18"], size: [8, 6, 2] },
          { ref: "C1", name: "Condensateur", kind: "capacitor", at: ["L - 22", 22], size: [10, 10, 12] }],
        zones: [], nets: { "+24V": { kind: "dc", voltage: 24 }, GND: { kind: "dc", voltage: 0 } } },
      features: [] } },
  { key: "heatsink", icon: "extrusion", title: "Dissipateur extrudé", text: "Profilé aluminium à ailettes, coupé à longueur.",
    spec: { name: "Dissipateur extrudé", family: "extrusion", process: "extrusion_al", material: "AL6063-T5", function: "Évacue la chaleur de l'étage de puissance.",
      params: { W: P(80, 30, 200, "Largeur"), base: P(5, 2, 12, "Épaisseur de la semelle", "Profil", 0.5), fin: P(18, 5, 60, "Hauteur des ailettes", "Profil"), tf: P(2, 1.2, 5, "Épaisseur d'ailette", "Profil", 0.1),
        n: { value: 9, min: 3, max: 25, step: 1, unit: "", label: "Nombre d'ailettes", group: "Profil" }, L: P(100, 20, 600, "Longueur coupée") },
      interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation du module de puissance", key: "power_mount", side: "B", face: "-Z", at: ["W/2", "L/2"],
        params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 50, dy: 60 } }, opts: { thread: "tapped", depth: "base - 0.8" } }],
      extrusion: { axis: "Y", length: "L", profile: { gen: "heatsink", W: "W", base: "base", fin: "fin", tf: "tf", n: "n" } }, features: [] } },
  { key: "cardbox", icon: "extrusion", title: "Boîtier extrudé à glissières", text: "Tube aluminium avec rainures guide-cartes : les PCB se glissent dedans.",
    spec: { name: "Boîtier extrudé à glissières", family: "extrusion", process: "extrusion_al", material: "AL6063-T5", function: "Loge une ou deux cartes glissées dans ses rainures et sert de dissipateur.",
      params: { W: P(108, 50, 220, "Largeur extérieure"), H: P(46, 20, 120, "Hauteur extérieure"), t: P(2.5, 1.5, 5, "Paroi", "Profil", 0.1), card: P(100, 40, 200, "Largeur de la carte", "Cartes", 0.5), ct: P(1.6, 0.8, 2.4, "Épaisseur de la carte", "Cartes", 0.1),
        slots: { value: 2, min: 1, max: 5, step: 1, unit: "", label: "Nombre de niveaux de cartes", group: "Cartes" }, first: P(6, 3, 30, "Hauteur du premier niveau", "Cartes", 0.5), pitch: P(16, 8, 40, "Pas entre niveaux", "Cartes", 0.5), L: P(120, 40, 500, "Longueur coupée") },
      interfaces: [{ id: "IF1", type: "rail", name: "Glissière de la carte basse", key: "card_rail_1", partner: "Carte", side: "B", face: "+Y", at: ["W/2", "t + first + ct/2"], params: { t: "ct", depth: 1.5, length: "card" }, opts: { clearance: 0.15 } }],
      extrusion: { axis: "Y", length: "L", profile: { gen: "card_enclosure", W: "W", H: "H", t: "t", wall_side: "(W - card)/2 + 1.5", slots: "slots", slot_t: "ct + 0.3", slot_d: 1.5, first: "first", pitch: "pitch" },
        inside: [{ name: "Carte (niveau 1)", w: "card", h: "ct", at: ["W/2", "t + first + (ct + 0.3)/2"], clearance: 0.1 }] }, features: [] } },
  { key: "busbar", icon: "power", title: "Busbar", text: "Barre de cuivre percée aux deux extrémités.",
    spec: { name: "Busbar", family: "busbar", process: "laser_cut", material: "CU-C110", function: "Conduit le courant entre deux bornes.", elec: { kind: "conductor", net: "HV+" },
      params: { L: P(90, 30, 400, "Longueur"), W: P(20, 8, 80, "Largeur"), t: P(3, 1, 10, "Épaisseur", "Enveloppe", 0.5), e: P(12, 6, 40, "Distance trou – bout", "Fixation", 0.5) },
      interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Borne 1", key: "terminal_1", side: "A", face: "+Z", at: ["e", "W/2"], params: { screw: "M6", pattern: { type: "single" } } },
        { id: "IF2", type: "bolt_pattern", name: "Borne 2", key: "terminal_2", side: "A", face: "+Z", at: ["L - e", "W/2"], params: { screw: "M6", pattern: { type: "single" } } }],
      features: [{ op: "extrude", id: "bar", name: "Barre", profile: { rect: [0, 0, "L", "W"], r: 2 }, plane: "XY", length: "t" }] } },
  { key: "block", icon: "part", title: "Bloc libre", text: "Un simple bloc pour partir de zéro et le sculpter avec la baguette.",
    spec: { name: "Nouvelle pièce", family: "prismatic", process: "cnc_milling", material: "AL6061-T6", function: "",
      params: { L: P(80, 5, 500, "Longueur"), W: P(50, 5, 500, "Largeur"), H: P(20, 2, 300, "Hauteur") }, interfaces: [], features: [{ op: "box", id: "bloc", name: "Bloc", size: ["L", "W", "H"] }] } },
];

export function fromTemplate(key, id) {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error(`Gabarit inconnu « ${key} ».`);
  const spec = JSON.parse(JSON.stringify(t.spec));
  spec.dw = "part/1"; spec.id = id;
  return spec;
}
