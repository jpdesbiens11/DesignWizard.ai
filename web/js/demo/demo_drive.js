/* DesignWizard.ai — demonstration project: a compact 400 V motor drive (mechatronic system with power, control,
   sensors, a CPU, two PCBs, a moulded housing and an extruded heat sink). Every part starts from its interfaces;
   the assembly mates itself from them. The HV+ / HV- gap on the power board is deliberately a little short, so the
   isolation analysis has something to find (parameter "gapHV" of DRV-PWR-PCB). */

const P = (value, min, max, label, group = "Enveloppe", step = 1) => ({ value, min, max, step, unit: "mm", label, group });

const BASE = {
  dw: "part/1", id: "DRV-BASE", name: "Base du boîtier", family: "enclosure", process: "injection_molding", material: "PC-ABS", revision: "A",
  function: "Loge les deux cartes, porte le dissipateur et reçoit le couvercle.", finish: "Grain fin VDI 27, noir", elec: { kind: "insulator" },
  params: { L: P(160, 120, 260, "Longueur"), W: P(110, 80, 200, "Largeur"), H: P(42, 25, 90, "Hauteur"), wall: P(2.5, 1.5, 4, "Paroi", "Enveloppe", 0.1), rc: P(6, 2, 15, "Rayon des coins", "Détails", 0.5),
    so: P(6, 4, 15, "Hauteur des colonnettes", "Cartes", 0.5), pwrX: P(47, 40, 70, "Centre carte de puissance (X)", "Cartes", 0.5), ctlX: P(122, 100, 140, "Centre carte de contrôle (X)", "Cartes", 0.5),
    winL: P(44, 20, 60, "Fenêtre thermique (X)", "Dissipateur"), winW: P(50, 20, 70, "Fenêtre thermique (Y)", "Dissipateur"), conW: P(18, 8, 40, "Largeur connecteur E/S", "Connecteur"), conH: P(9, 4, 20, "Hauteur connecteur E/S", "Connecteur") },
  interfaces: [
    { id: "IF1", type: "bolt_pattern", name: "Fixation carte de puissance", key: "pwr_pcb_mount", partner: "Carte de puissance", side: "B", face: "+Z", at: ["pwrX", "W/2"], level: "wall + so",
      params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 70, dy: 80 } }, opts: { thread: "insert", standoff: { h: "so", d: 7.5 } } },
    { id: "IF2", type: "bolt_pattern", name: "Fixation carte de contrôle", key: "ctrl_pcb_mount", partner: "Carte de contrôle", side: "B", face: "+Z", at: ["ctlX", "W/2"], level: "wall + so",
      params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 50, dy: 80 } }, opts: { thread: "insert", standoff: { h: "so", d: 7.5 } } },
    { id: "IF3", type: "bolt_pattern", name: "Fixation du couvercle", key: "cover_screws", partner: "Couvercle", side: "B", face: "+Z", at: ["L/2", "W/2"],
      params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "L - 2*wall - 7", dy: "W - 2*wall - 7" } }, opts: { thread: "insert", depth: 8 } },
    { id: "IF4", type: "planar", name: "Plan de joint du couvercle", key: "cover_seat", partner: "Couvercle", side: "B", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } },
    { id: "IF5", type: "bolt_pattern", name: "Fixation du dissipateur", key: "heatsink_mount", partner: "Dissipateur", side: "A", face: "-Z", at: ["pwrX", "W/2"],
      params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 60, dy: 66 } }, opts: { depth: "wall + 0.5", head: "none" } },
    { id: "IF6", type: "cutout", name: "Passage du connecteur E/S", key: "io_connector", partner: "Faisceau machine", side: "A", face: "-Y", at: ["ctlX", "wall + so + 1.6 + conH/2 + 0.5"],
      params: { shape: "rect", w: "conW", h: "conH", r: 1 }, opts: { depth: "wall + 0.5" } }],
  features: [
    { op: "extrude", id: "body", name: "Volume extérieur", profile: { rect: [0, 0, "L", "W"], r: "rc" }, plane: "XY", length: "H" },
    { op: "shell", id: "shell", name: "Coque", t: "wall", open: ["+Z"] },
    { op: "boss", id: "posts", name: "Bossages du couvercle", face: "+Z", start: "wall", d: 7, h: "H - wall", at: { grid: { origin: ["wall + 3.5", "wall + 3.5"], nx: 2, ny: 2, dx: "L - 2*wall - 7", dy: "W - 2*wall - 7" } } },
    { op: "pocket", id: "window", name: "Fenêtre thermique", face: "-Z", rect: ["pwrX - winL/2", "W/2 - winW/2", "winL", "winW"], r: 3, depth: "wall + 0.5" }],
  notes: ["Matière PC/ABS UL94 V-0 à l'épaisseur de paroi.", "Inserts M3 posés à chaud après moulage.", "Dépouille 1° sur les parois, à ajouter à l'outillage."],
};

const COVER = {
  dw: "part/1", id: "DRV-COVER", name: "Couvercle", family: "plate", process: "injection_molding", material: "PC-ABS", revision: "A",
  function: "Ferme le boîtier et protège les cartes.", elec: { kind: "insulator" },
  params: { L: P(160, 120, 260, "Longueur"), W: P(110, 80, 200, "Largeur"), t: P(2.5, 1.5, 4, "Épaisseur", "Enveloppe", 0.1), rc: P(6, 2, 15, "Rayon des coins", "Détails", 0.5),
    sx: P(148, 60, 250, "Entraxe des vis en X", "Fixation", 0.5), sy: P(98, 40, 190, "Entraxe des vis en Y", "Fixation", 0.5) },
  interfaces: [
    { id: "IF1", type: "bolt_pattern", name: "Fixation sur la base", key: "cover_screws", partner: "Base du boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"], params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "sx", dy: "sy" } }, opts: { head: "none" } },
    { id: "IF2", type: "planar", name: "Plan de joint", key: "cover_seat", partner: "Base du boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } }],
  features: [{ op: "extrude", id: "lid", name: "Plaque", profile: { rect: [0, 0, "L", "W"], r: "rc" }, plane: "XY", length: "t" }],
  notes: ["Matière PC/ABS UL94 V-0."],
};

const PWR = {
  dw: "part/1", id: "DRV-PWR-PCB", name: "Carte de puissance", family: "pcb", process: "pcb", material: "FR4", revision: "A",
  function: "Étage de puissance 400 V : pont de MOSFET, condensateurs du bus, mesure de courant.",
  params: { L: P(80, 60, 120, "Longueur"), W: P(90, 60, 140, "Largeur"), mx: P(70, 40, 110, "Entraxe des trous en X", "Fixation"), my: P(80, 40, 130, "Entraxe des trous en Y", "Fixation"),
    gapHV: P(2.5, 1, 10, "Écart entre zones HV+ et HV-", "Isolation", 0.1), gapLV: P(8, 3, 20, "Barrière HV / LV", "Isolation", 0.5) },
  interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation de la carte", key: "pwr_pcb_mount", partner: "Base du boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"], params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "mx", dy: "my" } } }],
  pcb: { size: ["L", "W"], r: 2, t: 1.6,
    zones: [
      { net: "HV+", side: "top", name: "Bus HV+", rect: [9, 44, "L/2 - 9 - gapHV/2", 36] }, { net: "HV-", side: "top", name: "Bus HV-", rect: ["L/2 + gapHV/2", 44, "L/2 - 9 - gapHV/2", 36] },
      { net: "LV", side: "top", name: "Commande de grille (LV)", rect: [9, 9, "L - 18", "35 - gapLV"] }, { net: "HV+", side: "bottom", name: "Plage thermique", rect: ["L/2 - 12", 50, 24, 20] }],
    components: [
      { ref: "Q1", name: "Demi-pont A", kind: "mosfet", at: [22, 62], size: [14, 18, 4.5] }, { ref: "Q2", name: "Demi-pont B", kind: "mosfet", at: [58, 62], size: [14, 18, 4.5] },
      { ref: "C1", name: "Condensateur du bus", kind: "capacitor", at: [22, 80], size: [16, 8, 24] }, { ref: "C2", name: "Condensateur du bus", kind: "capacitor", at: [58, 80], size: [16, 8, 24] },
      { ref: "U3", name: "Capteur de courant", kind: "sensor", at: [40, 30], size: [10, 8, 3] }, { ref: "U4", name: "Isolateur de grille", kind: "optocoupler", at: [22, 22], size: [9, 6, 3.5] },
      { ref: "U5", name: "Isolateur de grille", kind: "optocoupler", at: [58, 22], size: [9, 6, 3.5] }, { ref: "J3", name: "Liaison carte à carte", kind: "connector", at: [70, 14], size: [6, 16, 9] }],
    nets: { "HV+": { kind: "dc", voltage: 400, floating: true }, "HV-": { kind: "dc", voltage: 0, floating: true }, LV: { kind: "dc", voltage: 12 }, Chassis: { kind: "dc", voltage: 0 } } },
  features: [], notes: ["FR4 TG150, 1,6 mm, 2 oz, vernis épargne des deux côtés.", "Zones HV repérées par sérigraphie."],
};

const CTRL = {
  dw: "part/1", id: "DRV-CTRL-PCB", name: "Carte de contrôle", family: "pcb", process: "pcb", material: "FR4", revision: "A",
  function: "CPU, capteurs, communication et connecteur E/S.",
  params: { L: P(60, 40, 100, "Longueur"), W: P(90, 60, 140, "Largeur"), mx: P(50, 30, 90, "Entraxe des trous en X", "Fixation"), my: P(80, 40, 130, "Entraxe des trous en Y", "Fixation") },
  interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation de la carte", key: "ctrl_pcb_mount", partner: "Base du boîtier", side: "A", face: "-Z", at: ["L/2", "W/2"], params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: "mx", dy: "my" } } }],
  pcb: { size: ["L", "W"], r: 2, t: 1.6,
    zones: [{ net: "LV", side: "top", name: "Logique 12 V / 3,3 V", rect: [8, 12, "L - 16", "W - 24"] }],
    components: [
      { ref: "U1", name: "CPU", kind: "mcu", at: ["L/2", 52], size: [14, 14, 1.6] }, { ref: "U2", name: "Capteur de température", kind: "sensor", at: [16, 70], size: [5, 4, 1.5] },
      { ref: "U6", name: "Capteur inertiel", kind: "sensor", at: [44, 70], size: [4, 4, 1.2] }, { ref: "J1", name: "Connecteur E/S", kind: "connector", at: ["L/2", 6], size: [16, 11, 8] },
      { ref: "J2", name: "Liaison carte à carte", kind: "connector", at: [8, 30], size: [6, 16, 9] }, { ref: "Y1", name: "Quartz", kind: "other", at: [44, 38], size: [5, 3.2, 1.2] }],
    nets: { LV: { kind: "dc", voltage: 12 } } },
  features: [], notes: ["FR4 1,6 mm, 4 couches."],
};

const SINK = {
  dw: "part/1", id: "DRV-HEATSINK", name: "Dissipateur extrudé", family: "extrusion", process: "extrusion_al", material: "AL6063-T5", revision: "A",
  function: "Évacue la chaleur de l'étage de puissance ; relié au Chassis.", finish: "Anodisé noir 10 µm", elec: { kind: "chassis", net: "Chassis" },
  params: { W: P(80, 50, 140, "Largeur"), base: P(7, 3, 12, "Épaisseur de la semelle", "Profil", 0.5), fin: P(20, 8, 50, "Hauteur des ailettes", "Profil"), tf: P(2.4, 1.2, 4, "Épaisseur d'ailette", "Profil", 0.1),
    n: { value: 10, min: 4, max: 20, step: 1, unit: "", label: "Nombre d'ailettes", group: "Profil" }, L: P(86, 40, 200, "Longueur coupée") },
  interfaces: [{ id: "IF1", type: "bolt_pattern", name: "Fixation sous la base", key: "heatsink_mount", partner: "Base du boîtier", side: "B", face: "-Z", at: ["W/2", "L/2"],
    params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 60, dy: 66 } }, opts: { thread: "tapped", depth: "base - 1" } }],
  extrusion: { axis: "Y", length: "L", profile: { gen: "heatsink", W: "W", base: "base", fin: "fin", tf: "tf", n: "n" },
    outside: [{ name: "Plage thermique du module", w: 44, h: 1, at: ["W/2", -1], clearance: 0.2 }] },
  features: [], notes: ["Profilé 6063-T5 coupé à longueur, ébavuré.", "Planéité de la face d'appui 0,1 mm."],
};

export const DEMO_DRIVE = {
  dw: "project/1", id: "demo-variateur", name: "Variateur compact 400 V (démonstration)", author: "DesignWizard.ai",
  description: "Système mécatronique de démonstration : boîtier moulé, carte de puissance 400 V, carte de contrôle avec CPU et capteurs, dissipateur extrudé. Chaque pièce part de ses interfaces ; l'assemblage se monte seul.",
  parts: [BASE, COVER, PWR, CTRL, SINK],
  assemblies: [{ dw: "assembly/1", id: "DRV-ASM", name: "Variateur compact — assemblage général",
    instances: [{ id: "i1", part: "DRV-BASE", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "DRV-PWR-PCB" }, { id: "i3", part: "DRV-CTRL-PCB" }, { id: "i4", part: "DRV-COVER" }, { id: "i5", part: "DRV-HEATSINK" }],
    mates: [{ id: "M1", a: { inst: "i2", iface: "IF1" }, b: { inst: "i1", iface: "IF1" }, linked: true, by: "key" }, { id: "M2", a: { inst: "i3", iface: "IF1" }, b: { inst: "i1", iface: "IF2" }, linked: true, by: "key" },
      { id: "M3", a: { inst: "i4", iface: "IF1" }, b: { inst: "i1", iface: "IF3" }, linked: true, by: "key" }, { id: "M4", a: { inst: "i4", iface: "IF2" }, b: { inst: "i1", iface: "IF4" }, linked: true, by: "key" },
      { id: "M5", a: { inst: "i1", iface: "IF5" }, b: { inst: "i5", iface: "IF1" }, linked: true, by: "key" }],
    isolation: { nets: [{ name: "HV+", kind: "dc", voltage: 400, floating: true }, { name: "HV-", kind: "dc", voltage: 0, floating: true }, { name: "LV", kind: "dc", voltage: 12 }, { name: "Chassis", kind: "dc", voltage: 0 }],
      params: { pollution_degree: 2, altitude_m: 2000, ovc: "II", field: "A", level: "basic" }, levels: { "HV+|LV": "reinforced", "HV-|LV": "reinforced" } } }],
  log: [],
};
