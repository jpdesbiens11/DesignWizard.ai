/* DynamiteOrbit.ai — BM 8s8p - 21700 : the laminated busbar of a CORE, iteration 12 (JP, 22 novembre 2026, on the picture of an industrial
   laminated busbar bent at 90° : « by laminated busbar for the core, I meant something like this… can you refine » ; on pictures of laser-welded
   cell connections : contoured plates that follow the cells, « let's put the laser mark visibly »).
   What it is now : a laminated busbar as the trade makes them — the two conductors STACKED, flat, ON TOP of the cells : the − layer first, then
   the + layer, aramid paper under, between and around them, a film outside. Its exit tabs are its two legs, bent at 90° down the long sides :
   the − layer comes down the −Y side, the + layer down the +Y side — the planar contact faces of the series joint (demo_bm_contacts.js). Both
   poles of a cell are reached from the top (the crimped shoulder of the can is the − — to be confirmed with the cell maker : the sheet of the
   P45B does not dimension the top of the can) : over each cell, a well through the stack ; a thin tongue of the + layer goes down it to the cap,
   a thin disc of the − layer lies on the shoulder on two spots, under a small hole of the − layer and a window of the + layer. The laser welds
   are made on these thin parts, through the holes — and drawn : a ring on each weld.
   Nothing is under the cells any more : the bottom belongs to the bottom support and the sensors (demo_bm_holder.js, demo_bm_box.js).
   Every size is an EXAMPLE ; the frame is the frame of the CORE (the cells stand on z = 0, their top at H). Pure : the part only. */

export const INS_T = 0.25, WRAP_T = 0.1;      // aramid paper (a thickness of its series), the polymer film outside — examples
/** The thin parts that touch a cell, and the wells over it (examples) : the + tongue (disc on the cap, its neck and riser) ; the − discs on the shoulder. */
export const WELD = { well: 15, wellPlus: 12.6, cap: 6, neck: 3, rise: [6.0, 6.35], thin: 0.3, lift: 0.25, spotR: 9.0, spot: 3, spotHole: 2, spotWin: 4.5, ring: [2.4, 1.6], ringM: [1.8, 1.1], ringDepth: 0.05, keep: 1.5 };
const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");

/** The heights of the stack, from the top of the cells : paper, − copper, paper, + copper, film. */
export function stackOf(o) {
  const zA1 = o.H + o.ins, zM1 = zA1 + o.t, zB1 = zM1 + o.ins, zP1 = zB1 + o.t;
  return { zA1: r3(zA1), zM1: r3(zM1), zB1: r3(zB1), zP1: r3(zP1), zF1: r3(zP1 + o.w), h: r3(zP1 + o.w - o.H) };
}
/** Where the cells are, and their weld spots : the − spots on the shoulder, at 45° toward the near long side ; the + riser toward the middle. */
export function weldSpots(o) {
  const cells = [], d = r3(WELD.spotR / Math.SQRT2);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
    const x = r3(o.gap + o.grid / 2 + i * o.grid), y = r3(o.rows[j]), s = j ? 1 : -1;
    cells.push({ n: `c${j + 1}${i + 1}`, x, y, s, spots: [[r3(x - d), r3(y + s * d)], [r3(x + d), r3(y + s * d)]] });
  }
  return cells;
}

/** The laminated busbar of a CORE. o : { X, Y, H, t, ins, w, e (end gap), grid, gap, rows, contacts (demo_bm_contacts.js busbarContacts) } */
export function coreLaminate(o) {
  const W = WELD, z = stackOf(o), Ym = r3(-(o.ins + o.t)), Yp = r3(o.Y + o.ins + o.t), e = o.e, len = r3(o.X - 2 * e), z0 = 5, keep = W.keep;
  const bodies = {
    plus: { material: "CU-C110", net: "CORE+", kind: "conductor", label: "Couche + (dessus) et sa jambe (flanc +Y)" },
    moins: { material: "CU-C110", net: "CORE-", kind: "conductor", label: "Couche − (dessous) et sa jambe (flanc −Y)" },
    aramide: { material: "NOMEX-410", kind: "insulator", label: "Papier aramide — sous, entre et autour des couches" },
    enveloppe: { material: "PET-FILM", kind: "insulator", label: "Film extérieur" } };
  const box = (id, name, body, at, size, mode, all) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}), ...(all ? { bodies: "all" } : {}) });
  const up = (id, name, body, start, depth, d, at) => ({ op: "hole", id, name, face: "-Z", start: r3(start), depth: r3(depth), d, at, ...(body ? { body } : { bodies: "all" }) });      // a cut that starts 0.2 under « start » and rises
  const boss = (id, name, body, start, d, h, at) => ({ op: "boss", id, name, body, face: "+Z", start: r3(start), d, h, at });
  const cells = weldSpots(o), centres = cells.map((c) => [c.x, c.y]), spots = cells.flatMap((c) => c.spots);
  const features = [
    // the paper : along both long sides, on the top of the cells, between the two layers
    box("papier_my", "Papier du flanc −Y", "aramide", [e, -o.ins, 0], [len, o.ins, o.H]),
    box("papier_py", "Papier du flanc +Y", "aramide", [e, o.Y, 0], [len, o.ins, o.H]),
    box("papier_a", "Papier sur les cellules", "aramide", [e, -o.ins, o.H], [len, o.Y + 2 * o.ins, o.ins]),
    // the − layer and its leg : it stops short of the + leg ; the + layer and its leg : it starts clear of the − leg
    box("couche_moins", "Couche − (sur le papier)", "moins", [e, Ym, z.zA1], [len, o.Y - keep - Ym, o.t]),
    box("jambe_moins", "Jambe − (flanc −Y, pliée à 90° — face de contact)", "moins", [e, Ym, z0], [len, o.t, z.zM1 - z0]),
    box("papier_b", "Papier entre les deux couches", "aramide", [e, Ym, z.zM1], [len, o.Y + o.ins - Ym, o.ins]),
    box("couche_plus", "Couche + (sur le papier)", "plus", [e, keep, z.zB1], [len, Yp - keep, o.t]),
    box("jambe_plus", "Jambe + (flanc +Y, pliée à 90° — face de contact)", "plus", [e, o.Y + o.ins, z0], [len, o.t, z.zP1 - z0]),
    box("film_haut", "Film du dessus", "enveloppe", [e, keep, z.zP1], [len, Yp - keep, o.w]),
    box("film_bord", "Film du bord −Y, sur le papier de la couche −", "enveloppe", [e, Ym, z.zB1], [len, keep - Ym, o.w]),
    // over each cell : the well through the stack ; the + layer keeps a smaller hole, where its tongue comes up
    up("puits", "Puits au-dessus de chaque cellule (papier, couche −, papier)", null, o.H, z.zB1 - o.H, W.well, centres),
    up("puits_plus", "Trou de la couche + et du film, où monte la languette +", null, z.zB1 + 0.2, z.zF1 + 0.1 - z.zB1 - 0.2, W.wellPlus, centres),
    // over each − weld spot : a window of the paper, a small hole of the − layer, a window of the paper, the + layer and the film
    up("fenetres_epaule", "Fenêtres du papier sur l'épaule des godets", null, o.H, o.ins, W.spotWin, spots),
    up("trous_moins", "Trous de soudure de la couche −", null, o.H + o.ins + 0.2, z.zM1 + 0.1 - o.H - o.ins - 0.2, W.spotHole, spots),
    up("fenetres_haut", "Fenêtres d'accès au laser (papier, couche +, film)", null, z.zM1 + 0.2, z.zF1 + 0.1 - z.zM1 - 0.2, W.spotWin, spots),
    // the windows of the voltage taps : B+ on the + layer at the +Y edge, B− on the − layer at the −Y edge
    box("fenetre_bplus", "Fenêtre du film — prise B+", "enveloppe", [o.X / 2 - 2.2, o.Y, z.zP1 - 0.05], [4.4, Yp - o.Y + 0.1, o.w + 0.15], "cut"),
    box("fenetre_bmoins", "Fenêtre du papier et du film — prise B−", null, [o.X / 2 - 2.2, Ym - 0.1, z.zM1], [4.4, -Ym + 0.1, z.zB1 + o.w + 0.1 - z.zM1], "cut", true)];
  if (o.contacts) { Object.assign(bodies, o.contacts.bodies); features.push(...o.contacts.features); }      // the LV islands, the marks, the slots of the tails
  // the thin parts on the cells, then the weld marks on them
  /* a boss of the tool starts 0.05 mm under its face : these start 0.05 mm up, so that they lie on the cells without entering them */
  features.push(boss("disques_moins", "Disques de la couche − sur l'épaule des godets (0,3 mm)", "moins", o.H + 0.05, W.spot, W.thin - 0.05, spots),
    boss("disques_plus", "Disques de la languette + sur les calottes (0,3 mm)", "plus", o.H + 0.05, W.cap, W.thin - 0.05, centres));
  for (const c of cells) {
    const k = -c.s, a = (r) => r3(c.y + k * r), lo = (p, q) => Math.min(p, q), span = (p, q) => Math.abs(q - p);
    features.push(box(`col_${c.n}`, `Col de la languette + de ${c.n}`, "plus", [c.x - W.neck / 2, lo(a(2.8), a(W.rise[1])), o.H + W.lift], [W.neck, span(a(2.8), a(W.rise[1])), W.thin]),
      box(`montee_${c.n}`, `Montée de la languette + de ${c.n}, jusqu'à la couche +`, "plus", [c.x - W.neck / 2, lo(a(W.rise[0]), a(W.rise[1])), o.H + W.lift], [W.neck, span(a(W.rise[0]), a(W.rise[1])), z.zP1 - o.H - W.lift]));
  }
  features.push({ op: "hole", id: "soudures_plus", name: "Soudures laser sur les calottes — l'anneau de chaque cordon", body: "plus", face: "+Z", start: r3(o.H + W.thin), depth: W.ringDepth, d: W.ring[0], at: centres },
    boss("soudures_plus_c", "Soudures laser sur les calottes — le centre du cordon", "plus", o.H + W.thin - W.ringDepth, W.ring[1], W.ringDepth, centres),
    { op: "hole", id: "soudures_moins", name: "Soudures laser sur l'épaule — l'anneau de chaque cordon", body: "moins", face: "+Z", start: r3(o.H + W.thin), depth: W.ringDepth, d: W.ringM[0], at: spots },
    boss("soudures_moins_c", "Soudures laser sur l'épaule — le centre du cordon", "moins", o.H + W.thin - W.ringDepth, W.ringM[1], W.ringDepth, spots));
  return { dw: "part/1", id: "BM-BB-LAM", name: "Busbar laminé du CORE",
    function: "Les deux pôles du CORE en une pièce laminée posée sur le dessus des cellules : la couche − et la couche + empilées, isolées par du papier aramide, sous un film ; leurs languettes minces soudées au laser sur l'épaule et la calotte de chaque cellule ; leurs sorties pliées à 90° le long des grands côtés — les faces du contact plan avec les CORE voisins.",
    family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params: {}, bodies, features: [...features, { op: "interfaces" }], interfaces: [],
    notes: ["Itération 12 (JP, sur la photo d'un busbar laminé industriel plié à 90°) : les deux conducteurs ne sont plus deux L qui entourent le CORE, mais deux couches empilées sur le dessus, comme le fait un fabricant de busbars laminés — la couche − sur les cellules, la couche + au-dessus, papier aramide sous, entre et autour, film dehors. Leurs sorties sont les deux jambes, pliées à 90°.",
      `Cuivre de ${fr(o.t)} mm par couche (360 A, calcul gardé dans le projet), papier de ${fr(o.ins)} mm, film de ${fr(o.w)} mm : ${fr(z.h)} mm de haut au-dessus des cellules (exemples).`,
      `Au-dessus de chaque cellule, un puits de Ø${fr(W.well)} traverse le papier et la couche − ; la couche + garde un trou de Ø${fr(W.wellPlus)}, d'où descend sa languette : une montée de ${fr(W.neck)} mm de large, un col à ${fr(W.lift)} mm au-dessus du joint et du bord serti, un disque de Ø${fr(W.cap)} × ${fr(W.thin)} mm sur la calotte.`,
      `Le − se prend sur l'épaule du godet, deux points par cellule à ${fr(W.spotR)} mm du centre : un disque de Ø${fr(W.spot)} × ${fr(W.thin)} mm de la couche −, sous un trou de Ø${fr(W.spotHole)} ; au-dessus, une fenêtre de Ø${fr(W.spotWin)} dans le papier, la couche + et le film laisse passer le laser. Souder sur l'épaule est à confirmer avec le fabricant de la cellule : la fiche de la P45B ne cote ni la calotte ni l'épaule.`,
      "Les soudures se font sur les parties minces (0,3 mm), jamais à travers une couche de 2 mm ; chaque cordon est dessiné : un anneau gravé de 0,05 mm et son centre, sur chaque calotte et chaque point d'épaule — on les voit d'en haut, par les puits et les fenêtres.",
      "Les jambes sont nues, argentées : le contact série se fait face contre face, pressé par les ressorts du couvercle du haut (contact plan, borne haute de Holm gardée dans le projet). Les îlots LV y sont percés, leurs plages affleurent ; les fentes de leurs queues traversent le haut de la pièce près des grands côtés.",
      "Prises de tension de la carte : une fenêtre du film sur la couche + au bord +Y (B+), une fenêtre du papier et du film sur la couche − au bord −Y (B−) — une languette de nickel y est soudée et monte au bord de la carte (BM-TAP-NI).",
      "Pièce de spécialiste : laminée à plat, pliée après lamination ou laminée sur gabarit — à voir avec un fabricant de busbars laminés ; elle ne se joue pas dans l'atelier de fab."] };
}
