/* DesignWizard.ai — BM 8s8p - 21700 : the laminated busbar of a CORE (JP, 21 novembre 2026 : « 2 busbars en L pourraient être joints dans
   un busbar laminé en forme de 8, en multicouche avec Nomex entre les conducteurs et une enveloppe isolante mince externe, pour assembler une
   seule pièce sur la ligne »). Read, until JP says otherwise : the two L of a CORE — the + (on the + terminals, then down the +Y side) and
   the − (under the cans, then up the −Y side) — become ONE part : two copper conductors, aramid paper between the copper and the cells
   (and wherever two potentials meet), a thin polymer film outside. The series contact stays the one JP kept at iteration 2 : the outer
   face of the + leg presses the − leg of the next CORE — the film leaves those faces bare. The CORE (its cells in their holders) slides
   into the part by a short end ; then CORE and busbar go down on the flex, as one.
   What the laminate brings besides : the + plate no longer lies on the crimped rim of the cans (at −, it is the can) — the paper is in
   between, with a window over each + cap and a weld boss in it ; the insulating sheets of the sides are in it ; a hole under the centre
   of each cell for its thermistor, the − welds on both sides of it.
   Iteration 5 (JP, par menu : « support + rondelles en un ») : with o.floor, the bottom holder has a floor under the cells — it insulates
   the cans, so the paper under them goes ; the − plate lies under the floor, its weld bosses rise through the windows of the floor, and the
   washers of the holder come down through its holes.
   Every size is a parameter ; the frame is the frame of the CORE (the cells stand on z = 0). Pure : the part only. */

export const INS_T = 0.25, WRAP_T = 0.1;      // aramid paper (a thickness of its series), the polymer film outside — examples
const P = (value, label, o = {}) => ({ value, unit: "mm", label, step: 0.05, group: "Busbar", ...o });

/** The laminated busbar of a CORE. o : { X, Y, H, t, e (end gap), grid (pitch of the cells), gap, taps: { top: [x, y], bottom: [x, y] },
    floor (the floor of the bottom holder, mm ; 0 : none, the paper insulates the cans) } */
export function coreLaminate(o) {
  const fb = o.floor > 0;
  const params = { X: P(o.X, "Longueur du CORE", { group: "CORE", min: 80, max: 120 }), Y: P(o.Y, "Largeur du CORE", { group: "CORE", min: 40, max: 60 }),
    H: P(o.H, "Hauteur d'une cellule", { group: "CORE", min: 65, max: 75 }), grid: P(o.grid, "Pas des cellules (la grille du CORE)", { group: "CORE", min: 18, max: 25 }),
    gap: P(o.gap, "Jeu aux bouts et entre les rangées", { group: "CORE", min: 1, max: 10 }),
    t: P(o.t, "Épaisseur du cuivre (360 A, calcul gardé dans le projet)", { min: 0.5, max: 3 }), ins: P(INS_T, "Papier aramide entre le cuivre et les cellules (exemple)", { min: 0.05, max: 0.76 }),
    w: P(WRAP_T, "Enveloppe extérieure, film PET (exemple)", { min: 0.05, max: 0.35 }), e: P(o.e, "Jeu aux petits bouts, laissé au flex", { min: 1, max: 10 }),
    z0: P(5, "Retrait de la jambe, en bas ou en haut (exemple)", { min: 1, max: 20 }), cap: P(8, "Fenêtre du papier au droit d'une calotte + (exemple)", { min: 4, max: 12 }),
    pj: P(5, "Bossage de soudure, diamètre (exemple)", { min: 2, max: 8 }), hole: P(6, "Trou sous le centre d'une cellule, pour sa CTN (exemple)", { min: 3, max: 10 }),
    wo: P(fb ? 7 : 6.5, "Soudure −, de part et d'autre du centre (exemple)", { min: 4, max: 9 }),
    ...(fb ? { fb: P(o.floor, "Fond du support du bas, sous les cellules", { min: 1.2, max: 3.5 }) } : { wn: P(6.5, "Fenêtre du papier au droit d'une soudure − (exemple)", { min: 3, max: 9 }) }) };
  const under = fb ? "fb" : "ins";      // what lies between the cans and the − plate : the floor of the holder, or the paper
  const cx = (i) => `gap + grid / 2 + ${i} * grid`, cy = (j) => (j ? "grid + gap + grid / 2" : "grid / 2"), cells = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) cells.push({ n: `c${j + 1}${i + 1}`, x: cx(i), y: cy(j) });
  const len = "X - 2 * e", bodies = {
    plus: { material: "CU-C110", net: "CORE+", kind: "conductor", label: "Conducteur + (bornes +, flanc +Y)" },
    moins: { material: "CU-C110", net: "CORE-", kind: "conductor", label: "Conducteur − (fonds, flanc −Y)" },
    aramide: { material: "NOMEX-410", kind: "insulator", label: "Papier aramide, côté cellules" },
    enveloppe: { material: "PET-FILM", kind: "insulator", label: "Enveloppe extérieure" } };
  const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, body, at, size, ...(mode ? { mode } : {}) });
  const cyl = (id, name, body, at, d, h, mode, all) => ({ op: "cylinder", id, name, body, at, d, h, axis: "Z", ...(mode ? { mode } : {}), ...(all ? { bodies: "all" } : {}) });
  const features = [
    // the paper between the copper and the cells : over the + ends, along both long sides, under the cans
    box("papier_haut", "Papier sur les bornes +", "aramide", ["e", 0, "H"], [len, "Y + ins", "ins"]),
    box("papier_py", "Papier du flanc +Y", "aramide", ["e", "Y", 0], [len, "ins", "H"]),
    ...(fb ? [] : [box("papier_bas", "Papier sous les fonds", "aramide", ["e", "-ins", "-ins"], [len, "Y + ins", "ins"])]),
    box("papier_my", "Papier du flanc −Y", "aramide", ["e", "-ins", 0], [len, "ins", "H"]),
    // the two conductors : the + on the top and down +Y, the − under the cells and up −Y ; z0 keeps each leg away from the plate of the other
    box("plaque_plus", "Plaque + (sur les bornes +)", "plus", ["e", 0, "H + ins"], [len, "Y + ins + t", "t"]),
    box("jambe_plus", "Jambe + (flanc +Y, contact série)", "plus", ["e", "Y + ins", "z0"], [len, "t", "H + ins - z0"]),
    box("plaque_moins", fb ? "Plaque − (sous le fond du support)" : "Plaque − (sous les fonds)", "moins", ["e", "-(ins + t)", `-(${under} + t)`], [len, "Y + ins + t", "t"]),
    box("jambe_moins", "Jambe − (flanc −Y, contact série)", "moins", ["e", "-(ins + t)", `-${under}`], [len, "t", `H - z0 + ${under}`]),
    // the film outside : on the top (under the board) and under the bottom (on the flex) ; the outer faces of the legs stay bare — the series contact
    box("film_haut", "Enveloppe du dessus", "enveloppe", ["e", 0, "H + ins + t"], [len, "Y + ins + t", "w"]),
    box("film_bas", "Enveloppe du dessous", "enveloppe", ["e", "-(ins + t)", `-(${under} + t + w)`], [len, "Y + ins + t", "w"])];
  for (const c of cells) features.push(
    cyl(`fenetre_${c.n}`, `Fenêtre du papier — calotte + de ${c.n}`, "aramide", [c.x, c.y, "H - 0.5"], "cap", "ins + 1", "cut"),
    cyl(`bossage_${c.n}`, `Bossage de soudure + de ${c.n}`, "plus", [c.x, c.y, "H"], "pj", "ins"),
    cyl(`trou_${c.n}`, fb ? `Trou de la rondelle de ${c.n}` : `Trou de la CTN de ${c.n}`, null, [c.x, c.y, `-(${under} + t + w) - 1`], "hole", `${under} + t + w + 1.5`, "cut", true));
  for (const c of cells) for (const [s, k] of [["-", "a"], ["+", "b"]]) features.push(
    ...(fb ? [] : [cyl(`fenetre_${c.n}${k}`, `Fenêtre du papier — soudure − ${k} de ${c.n}`, "aramide", [`${c.x} ${s} wo`, c.y, "-ins - 0.5"], "wn", "ins + 1", "cut")]),
    cyl(`bossage_${c.n}${k}`, fb ? `Bossage de soudure − ${k} de ${c.n}, par la fenêtre du fond` : `Bossage de soudure − ${k} de ${c.n}`, "moins", [`${c.x} ${s} wo`, c.y, `-${under}`], "pj", under));
  if (o.contacts) { Object.assign(bodies, o.contacts.bodies); features.push(...o.contacts.features); }      // iteration 6 : the stops, the engraved circles, the LV islands (demo_bm_contacts.js)
  const taps = o.taps || {};      // the windows of the film where the flex takes the voltage of the CORE : B+ on the top, B− under it
  if (taps.top) features.push(box("fenetre_bplus", "Fenêtre de l'enveloppe — prise B+", "enveloppe", [taps.top[0] - 2.5, taps.top[1] - 2.5, "H + ins + t - 0.5"], [5, 5, "w + 1"], "cut"));
  if (taps.bottom) features.push(box("fenetre_bmoins", "Fenêtre de l'enveloppe — prise B−", "enveloppe", [taps.bottom[0] - 2.5, taps.bottom[1] - 2, `-(${under} + t + w) - 0.5`], [5, 4, "w + 1"], "cut"));
  features.forEach((f) => { if (f.body === null) delete f.body; });
  return { dw: "part/1", id: "BM-BB-LAM", name: "Busbar laminé du CORE",
    function: "Les deux busbars du CORE en une seule pièce : le + sur les bornes + et le long du flanc +Y, le − sous les fonds et le long du flanc −Y, isolés des cellules par du papier aramide et enveloppés d'un film mince ; la jambe + presse la jambe − du CORE voisin.",
    family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params, bodies, features: [...features, { op: "interfaces" }], interfaces: [],
    notes: ["Les deux L d'un CORE réunis en une pièce laminée (lecture confirmée par JP) : une seule pièce à poser sur la ligne ; le papier aramide remplace les isolants de flanc.",
      "Le papier sépare la plaque + du bord serti des cellules (au −, c'est le godet) : une fenêtre au droit de chaque calotte, un bossage de soudure dedans. La fiche de la P45B ne cote ni la calotte ni le bord serti : fenêtre de 8 mm en exemple.",
      fb ? "Sous les cellules, le fond du support du bas isole les godets : la plaque − est dessous, ses bossages de soudure montent par les fenêtres du fond, à 7 mm du centre ; au centre, un trou de 6 mm laisse passer la rondelle thermique (exemples)."
        : "Sous chaque cellule, un trou de 6 mm pour sa CTN, que ferme sa rondelle thermique ; les soudures − se font de part et d'autre, à 6,5 mm du centre (exemples).",
      "Le contact série reste pressé, face contre face : l'enveloppe laisse nues les faces extérieures des jambes. Le chant du cuivre aux petits bouts n'est pas couvert — les plis du flex passent juste à côté.",
      "Pièce pliée sur trois faces : laminée sur un gabarit en forme, ou pliée après lamination — à voir avec un fabricant de busbars laminés ; le CORE y glisse par un petit bout.",
      ...(o.contacts ? ["Contacts entre deux CORE : sur la jambe +, deux ressorts HV sertis sous leur rondelle de butée et deux ressorts LV sur des plages isolées ; sur la jambe −, des plages planes. Chaque contact est entouré d'un cercle gravé et marqué au laser de ce qu'il est — HV1 +, HV2 +, RS485 A, RS485 B côté + ; HV1 −, HV2 −, RS485 A, RS485 B côté − —, à côté de son cercle, jamais dans la zone de contact.",
        "Les plages LV sont des îlots : une plage de cuivre dans un insert isolant en PA66-GF30, posé dans un trou de la jambe ; le rebord de l'insert, côté +, fait butée — isolant contre isolant. Il est tenu 0,02 mm sous les rondelles de butée (exemple) : ce sont elles qui portent l'effort du module, le plastique ne flue pas sous la charge ; la plage de cuivre, côté +, monte de 0,25 mm pour que la couronne LV garde sa course.",
        "Les butées HV sont des rondelles à part (BM-STOP-HV), posées sur la jambe + après le laminage : leur lèvre sertit l'anneau extérieur de chaque couronne, leur face porte la jambe − du CORE voisin ; fixées par leur bord extérieur. La jambe garde une face plane, sans anneau repoussé ni creux au dos.",
        "Marquage laser sur cuivre nu : le cuivre renvoie la lumière infrarouge, un laser vert ou une source à impulsions courtes marque mieux ; quelques microns suffisent à la lecture — les 0,05 mm dessinés sont pour la vue. Hors des zones de contact."] : [])] };
}
