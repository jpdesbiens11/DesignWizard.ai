/* DesignWizard.ai — BM 8s8p - 21700 : the cell holder of a CORE (JP, 21 novembre 2026, par menu : « le support de cellules » next).
   What the geometry leaves : the cells of a row stand side by side (21.7 mm a cell, a P45B is 21.55 mm at most : 0.15 mm between two cells)
   — no wall can pass between them. The holder holds each cell where there is room : a SPINE in the 3 mm gap between the two rows, whose teeth
   reach between the cells of each row (their tips stop 4 mm short of the row axis, 1.4 mm wide) and hold every cell, and a BAR in each 3 mm gap of the short ends, which leaves a channel of 1.2 mm
   to the fingers of the flex. On the long sides, the insulating sheet and the leg of the busbar hold the cells. One holder at the top of the
   cells, one at the bottom ; every size is a parameter ; the frame is the frame of the CORE.
   Iteration 5 (JP, 21 novembre, par menu : « support + rondelles en un ») : the bottom holder gets a FLOOR under the cells, and the thermal
   washers of the thermistors are bodies of the same part — molded in a second shot of soft, thermally conductive silicone (2K). The floor
   insulates the cans from the − plate (the paper of the laminate is no longer needed there) ; a window on each side of every cell lets a
   boss of the − plate rise to the can ; the washer, in the centre, goes down through the hole of the − plate onto its thermistor — it also
   locates the laminate. */

const P = (value, label, o = {}) => ({ value, unit: "mm", label, step: 0.1, group: "Support", ...o });

/** The holder. o : { X, Y, grid (pitch of the cells), gap (3 mm), h (height, an example) } → a part */
export function coreHolder(o) {
  const params = { X: P(o.X, "Longueur du CORE", { group: "CORE", min: 80, max: 120 }), Y: P(o.Y, "Largeur du CORE", { group: "CORE", min: 40, max: 60 }),
    grid: P(o.grid, "Pas des cellules (la grille du CORE)", { group: "CORE", min: 18, max: 25 }), gap: P(o.gap, "Jeu aux bouts et entre les rangées", { group: "CORE", min: 1, max: 10 }),
    h: P(o.h, "Hauteur du support (exemple)", { min: 3, max: 20 }), ch: P(1.2, "Passage laissé au flex, au bout (exemple)", { min: 0.5, max: 2.5 }),
    dp: P(21.8, "Diamètre des poches (0,125 mm de jeu au rayon sur une P45B)", { min: 21.4, max: 22.5 }),
    tooth: P(4, "Recul de la pointe des dents, depuis l'axe d'une rangée (exemple)", { min: 2, max: 8 }),
    dc: P(8, "Noyautage entre quatre cellules, diamètre (parois de 1,5 mm)", { min: 3, max: 9 }),
    de: P(5.2, "Noyautage d'un bout, diamètre (parois de 1,5 mm)", { min: 2, max: 6 }) };
  const cx = (i) => `gap + grid / 2 + ${i} * grid`, cy = (j) => (j ? "grid + gap + grid / 2" : "grid / 2");
  const pockets = []; for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) pockets.push({ op: "cylinder", id: `poche_${j + 1}${i + 1}`, name: `Poche de la cellule c${j + 1}${i + 1}`, mode: "cut", d: "dp", h: "h + 2", at: [cx(i), cy(j), -1], axis: "Z" });
  // coring : where four cells meet, the spine would be a block of about 11 mm (sink marks) ; a hole leaves walls of 1.5 mm. Same at each end, against the bar.
  const cores = [1, 2, 3].map((i) => ({ op: "cylinder", id: `noyau_${i}`, name: `Noyautage entre les cellules ${i} et ${i + 1}`, mode: "cut", d: "dc", h: "h + 2", at: [`gap + ${i} * grid`, "grid + gap / 2", -1], axis: "Z" }));
  cores.push({ op: "cylinder", id: "noyau_a", name: "Noyautage du bout X-", mode: "cut", d: "de", h: "h + 2", at: ["ch + de / 2 + 1.5", "grid + gap / 2", -1], axis: "Z" },
    { op: "cylinder", id: "noyau_b", name: "Noyautage du bout X+", mode: "cut", d: "de", h: "h + 2", at: ["X - ch - de / 2 - 1.5", "grid + gap / 2", -1], axis: "Z" });
  return { dw: "part/1", id: "BM-HOLDER", name: "Support du haut des cellules", function: "Tient les 8 cellules du CORE à leur place : une épine entre les deux rangées, dont les dents tiennent chaque cellule (0,125 mm de jeu), et une barre à chaque petit bout, qui laisse au flex son passage.",
    family: "molded", process: "injection_molding", material: "PC-ABS", revision: "A", params,
    features: [{ op: "box", id: "barre_a", name: "Barre du petit bout X-", at: ["ch", 0, 0], size: ["gap - ch", "Y", "h"] },
      { op: "box", id: "barre_b", name: "Barre du petit bout X+", at: ["X - gap", 0, 0], size: ["gap - ch", "Y", "h"] },
      { op: "box", id: "epine", name: "Épine entre les rangées, et ses dents", at: ["gap", "grid / 2 + tooth", 0], size: ["X - 2 * gap", "grid + gap - 2 * tooth", "h"] },
      ...pockets, ...cores, { op: "interfaces" }],
    interfaces: [],
    notes: ["Un support en haut, contre le busbar + ; celui du bas a son fond et ses rondelles (BM-HOLDER-BASE). PC/ABS d'une nuance V-0 à choisir (exemple).",
      "Les cellules d'une rangée se touchent presque (0,15 mm au plus) : pas de paroi possible entre elles. L'épine de 3 mm et ses dents les tiennent entre les rangées, les barres des bouts aux petits bouts ; sur les grands côtés, l'isolant de flanc et la jambe de busbar.",
      "Les dents s'arrêtent à 4 mm de l'axe de la rangée : leur pointe garde 1,4 mm, au-dessus du minimum de moulage du PC/ABS ; là où quatre cellules se rencontrent, un noyautage laisse des parois de 1,5 mm (sinon un bloc d'environ 11 mm, des retassures).",
      "Première itération : la dépouille, les détrompeurs, les congés et l'emboîtement d'un CORE au suivant ne sont pas dessinés."] };
}

/** The bottom holder, with its floor and its washers — one part, two materials. o : { ...coreHolder, floor, below (from the floor to the top of a
    thermistor, downward : copper + film + the flex face, less the thermistor), washer: { d } } → a part */
export function coreBase(o) {
  const p = coreHolder(o), feats = p.features.filter((f) => f.op !== "interfaces");
  Object.assign(p.params, { fl: P(o.floor, "Épaisseur du fond, sous les cellules (exemple)", { min: 1.2, max: 3.5 }),
    hc: P(o.washer.d, "Logement de la rondelle, diamètre (exemple)", { min: 3, max: 8 }),
    wo: P(7, "Fenêtre de soudure −, à côté du centre (exemple)", { min: 5, max: 9 }), wd: P(6, "Fenêtre de soudure −, diamètre (exemple)", { min: 4, max: 8 }),
    rd: P(o.washer.d, "Rondelle thermique, diamètre (exemple)", { min: 3, max: 8 }), rh: P(o.floor + o.below, "Rondelle thermique, hauteur (du fond de la cellule à sa CTN)", { min: 1, max: 8 }) });
  for (const f of feats) if (/^poche_/.test(f.id)) { f.at = [f.at[0], f.at[1], 0]; f.h = "h + 1"; }      // the pockets stop on the floor
  const cx = (i) => `gap + grid / 2 + ${i} * grid`, cy = (j) => (j ? "grid + gap + grid / 2" : "grid / 2"), bodies = {}, extra = [{ op: "box", id: "fond", name: "Fond, sous les cellules", at: ["ch", 0, "-fl"], size: ["X - 2 * ch", "Y", "fl"] }];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
    const n = `c${j + 1}${i + 1}`, x = cx(i), y = cy(j);
    extra.push({ op: "cylinder", id: `logement_${n}`, name: `Logement de la rondelle de ${n}`, mode: "cut", d: "hc", h: "fl + 1", at: [x, y, "-fl - 0.5"], axis: "Z" });
    for (const [s, k] of [["-", "a"], ["+", "b"]]) extra.push({ op: "cylinder", id: `fenetre_${n}${k}`, name: `Fenêtre de soudure − ${k} de ${n}`, mode: "cut", d: "wd", h: "fl + 1", at: [`${x} ${s} wo`, y, "-fl - 0.5"], axis: "Z" });
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {      // the washers last : a second shot, its own bodies
    const n = `c${j + 1}${i + 1}`, body = `rondelle_${n}`;
    bodies[body] = { material: "THERMAL-PAD", kind: "insulator", label: `Rondelle thermique de ${n}` };
    extra.push({ op: "cylinder", id: body, name: `Rondelle thermique de ${n} (2e injection)`, body, d: "rd", h: "rh", at: [cx(i), cy(j), "-rh"], axis: "Z" });
  }
  return { ...p, id: "BM-HOLDER-BASE", name: "Support du bas des cellules, avec ses rondelles",
    function: "Tient le bas des 8 cellules, isole leurs fonds de la plaque − par son fond, laisse passer les soudures −, et porte au centre de chaque cellule la rondelle thermique qui presse sa CTN contre le godet.",
    bodies, features: [...feats, ...extra, { op: "interfaces" }],
    notes: ["Une pièce, deux matières : le support en PC/ABS et ses 8 rondelles en silicone chargé, souple et conducteur de chaleur, moulées en deuxième injection (2K) — nuance et adhérence à valider avec un mouleur (exemple).",
      "Le fond isole les godets de la plaque − : le papier du busbar laminé n'y est plus ; deux fenêtres par cellule laissent monter les bossages de soudure −.",
      "Chaque rondelle descend du fond de sa cellule, par le trou de la plaque −, jusqu'à sa CTN sur le flex : elle centre aussi le busbar laminé à la pose.",
      ...p.notes.slice(1)] };
}
