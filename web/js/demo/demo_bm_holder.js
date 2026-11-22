/* DynamiteOrbit — BM 8s8p - 21700 : the cell holder of a CORE (JP, 21 novembre 2026, par menu : « le support de cellules » next).
   What the geometry leaves : the cells of a row stand side by side (21.7 mm a cell, a P45B is 21.55 mm at most : 0.15 mm between two cells)
   — no wall can pass between them. The holder holds each cell where there is room : a SPINE in the 3 mm gap between the two rows, whose teeth
   reach between the cells of each row (their tips stop 4 mm short of the row axis, 1.4 mm wide) and hold every cell, and a BAR in each 3 mm gap of the short ends, which leaves a channel of 1.2 mm
   to the fingers of the flex. On the long sides, the insulating sheet and the leg of the busbar hold the cells. One holder at the top of the
   cells, one at the bottom ; every size is a parameter ; the frame is the frame of the CORE.
   Iteration 5 (JP, 21 novembre, par menu : « support + rondelles en un ») : the bottom holder gets a FLOOR under the cells, and the thermal
   washers of the thermistors are bodies of the same part — molded in a second shot of soft, thermally conductive silicone (2K). The floor
   insulates the cans from the − plate (the paper of the laminate is no longer needed there) ; a window on each side of every cell lets a
   boss of the − plate rise to the can ; the washer, in the centre, goes down through the hole of the − plate onto its thermistor — it also
   locates the laminate.
   Iteration 12 (JP, 22 novembre : « integrate the thermal measurement into the bottom cell support… a flex PCB that slides into the bottom
   support bracket… the cell sits on top of the sensor location… cone shape but part of the flex PCB ») : the bottom holder is TWO parts. The
   support keeps its floor under the cells, pierced under the centre of each cell ; a plate clipped under it leaves a slot of 0.4 mm between them,
   where the flex of the sensors slides in from the −X end ; at each cell, a cone formed in the flex rises through the hole of the floor and
   carries its thermistor to the bottom of the can — a pad of silicone foam in the plate, under the cone, keeps it pressed. No − plate, no
   washer, no weld window any more : the − of the cells is taken on top (demo_bm_lam.js). */

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

/** The bottom support : the holder, its floor under the cells, a hole under the centre of each cell for the cone of the flex. o : { ...coreHolder,
    floor, cone (the hole, mm) } → a part */
export function coreBase(o) {
  const p = coreHolder(o), feats = p.features.filter((f) => f.op !== "interfaces"), at = [];
  Object.assign(p.params, { fl: P(o.floor, "Épaisseur du fond, sous les cellules (exemple)", { min: 1.2, max: 3.5 }),
    hc: P(o.cone, "Trou du cône de chaque capteur, diamètre (exemple)", { min: 4, max: 10 }) });
  for (const f of feats) if (/^poche_/.test(f.id)) { f.at = [f.at[0], f.at[1], 0]; f.h = "h + 1"; }      // the pockets stop on the floor
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) at.push([Math.round((o.gap + o.grid / 2 + i * o.grid) * 1000) / 1000, o.rows[j]]);
  const extra = [{ op: "box", id: "fond", name: "Fond, sous les cellules — il s'arrête 1,2 mm avant le bout −X, où le flex se plie pour monter", at: ["ch + 1.2", 0, "-fl"], size: ["X - 2 * ch - 1.2", "Y", "fl"] },
    { op: "hole", id: "trous_cones", name: "Trous des cônes des capteurs, sous le centre de chaque cellule", face: "-Z", start: "-fl", depth: "fl", d: "hc", at }];
  return { ...p, id: "BM-HOLDER-BASE", name: "Support du bas des cellules",
    function: "Tient le bas des 8 cellules et les pose sur son fond ; sous le centre de chaque cellule, un trou laisse monter le cône du flex et sa thermistance jusqu'au fond du godet.",
    features: [...feats, ...extra, { op: "interfaces" }],
    notes: ["Itération 12 : le fond porte les cellules ; sous lui, la plaque clipsée (BM-BASE-CLIP) laisse une fente de 0,4 mm où glisse le flex des capteurs. Plus de plaque −, plus de rondelle moulée : le − se prend en haut, sur l'épaule des godets.",
      "Chaque trou du fond (Ø6, exemple) centre le cône de son capteur ; la cellule se pose dessus — sa thermistance touche le fond du godet.",
      ...p.notes.slice(1)] };
}

/** The plate clipped under the bottom support : a slot of `slot` mm between them for the flex (open at the −X end, where it comes in and rises
    to the board), rims along the long sides and at the +X end, a pocket under each cone with its pad of silicone foam. o : { X, Y, grid, gap,
    rows, floor, slot, t (the plate), flexT, pad: { d, pocket } } → a part */
export function coreClip(o) {
  const ch = 1.2, r = 1, top = -(o.floor + o.slot), z0 = top - o.t, at = [], bodies = { main: { material: "PC-ABS", kind: "insulator", label: "Plaque clipsée" }, mousse: { material: "SILICONE", kind: "insulator", label: "Pastilles de mousse sous les cônes" } };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) at.push([Math.round((o.gap + o.grid / 2 + i * o.grid) * 1000) / 1000, o.rows[j]]);
  const r3 = (v) => Math.round(v * 1000) / 1000, flexBottom = -(o.floor + o.flexT);
  return { dw: "part/1", id: "BM-BASE-CLIP", name: "Plaque clipsée sous le support du bas", family: "molded", process: "injection_molding", material: "PC-ABS", revision: "A", params: {}, bodies,
    features: [{ op: "box", id: "plaque", name: "Plaque", body: "main", at: [ch, 0, r3(z0)], size: [r3(o.X - 2 * ch), o.Y, o.t] },
      { op: "box", id: "bord_a", name: "Rebord du grand côté −Y (tient la fente)", body: "main", at: [ch, 0, r3(top)], size: [r3(o.X - 2 * ch), r, o.slot] },
      { op: "box", id: "bord_b", name: "Rebord du grand côté +Y", body: "main", at: [ch, r3(o.Y - r), r3(top)], size: [r3(o.X - 2 * ch), r, o.slot] },
      { op: "box", id: "bord_c", name: "Rebord du bout +X — le flex entre par le bout −X", body: "main", at: [r3(o.X - ch - r), r, r3(top)], size: [r, r3(o.Y - 2 * r), o.slot] },
      { op: "hole", id: "logements", name: "Logements des pastilles de mousse", body: "main", face: "+Z", start: r3(top), depth: o.pad.pocket, d: r3(o.pad.d + 0.4), at },
      { op: "boss", id: "pastilles", name: "Pastilles de mousse de silicone sous les cônes", body: "mousse", face: "+Z", start: r3(top - o.pad.pocket), d: o.pad.d, h: r3(flexBottom - (top - o.pad.pocket)), at },
      { op: "interfaces" }], interfaces: [],
    function: "Ferme le dessous du support du bas : entre les deux, la fente où glisse le flex des capteurs ; sous chaque cône, une pastille de mousse le presse vers la cellule.",
    notes: [`PC/ABS de ${String(o.t).replace(".", ",")} mm, fente de ${String(o.slot).replace(".", ",")} mm entre la plaque et le fond du support (exemples) ; clipsée au support par quatre crochets (non dessinés).`,
      "Le flex entre par le bout −X, quand le CORE est monté : la plaque se clipse ensuite. Les rebords des grands côtés et du bout +X tiennent la fente.",
      `Sous chaque cône, une pastille de mousse de silicone (Ø${String(o.pad.d).replace(".", ",")}, exemple) dans son logement : elle pousse le cône et sa thermistance contre le fond du godet — c'est le ressort du capteur. Nuance et écrasement à choisir.`] };
}
