/* DesignOrbit.ai — BM 8s8p - 21700, CONCEPT 2 « consumer product interface » : a parallel branch of the history (JP, 22 novembre 2026 :
   « retravailler l'interface couvercle du fond et couvercle avec latch du haut pour imiter les concepts actuels plus compacts des consumer
   products… on commence le design de l'interface +/− des Core 2.0, commence un point de sauvegarde du MAIN et fait une branche parallèle »).
   JP's material (his own research notes, read ; no maker's sheet read here) : the battery compartment of a consumer product — the cells in
   line or in alternate bays, the − end on a SPRING that takes up the tolerances and presses, the + end on a RIGID plate with a dimple that is
   the stop ; for power, louvred bands rather than coil springs ; and a ROTARY HANDLE keyed to a FACE CAM that presses the linear stack — a
   helical ramp of 4–7° that holds itself, a dwell plateau and a stop pin at the end of the stroke, a thrust washer to a pressure plate guided
   so that it does not turn. His answers, by menu : the CORE in line and pressed, like D cells in a torch ; louvred bands on the − face of each
   CORE, the + face rigid with bosses (the stop) ; a quarter-turn handle, double-lobe cam ; the bottom lid active (connector, contactor, BMS
   board), the top lid the handle and its pressure plate.
   What a CORE 2.0 is : the 8 cells in parallel lie ALONG the module (Y), two rows of 4 ; their bottoms on a − plate, their caps under a +
   plate — the CORE is a big cell, − at y = 0, + at y = H. Its board lies on its top side. The stack : the bands of a CORE's − plate press the
   + plate of the CORE before, down to its three bosses ; the handle of the top lid presses the whole stack through Belleville washers that
   take up its tolerances ; the + of the stack goes back to the bottom lid by the return busbar under the floor.
   Every size and every force is an EXAMPLE, said on the parts. Frame : X across a row of 4 (92.8 mm), Y along the module, Z up (the two rows). */

import { run, sessionDefaults } from "../analysis/physics/index.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");
const box = (id, name, at, size, o = {}) => ({ op: "box", id, name, ...(o.body ? { body: o.body } : {}), at: at.map(r3), size: size.map(r3), ...(o.mode ? { mode: o.mode } : {}) });
const cylY = (id, name, at, d, h, o = {}) => ({ op: "cylinder", id, name, ...(o.body ? { body: o.body } : {}), at: at.map(r3), d: r3(d), h: r3(h), axis: "Y", ...(o.mode ? { mode: o.mode } : {}) });
const part = (id, name, o) => ({ dw: "part/1", id, name, revision: "A", params: {}, interfaces: [], ...o });

/** The numbers of concept 2, in one place. → an object of millimetres */
export const C2 = (() => {
  const D = 21.7, GAP = 3, X = 4 * D + 2 * GAP, Z = 2 * D + GAP, H = 70.15, CELL_D = 21.55, PT = 1.5, BAND = { h: 1.7, w: 12, l: 70, pitch: 3.5 };
  const rows = [D / 2, D + GAP + D / 2], cols = [0, 1, 2, 3].map((i) => GAP + D / 2 + i * D), pitch = r3(H + 2 * PT + BAND.h);
  const plate = { x0: 1, x1: X - 1, z0: 1, z1: Z - 1 }, bands = rows.map((z) => [r3(z - BAND.w / 2), r3(z + BAND.w / 2)]), bosses = [8, X / 2, X - 8].map((x) => [r3(x), r3(Z / 2)]);
  const board = { gap: 1, t: 1.6, comp: 7.6, y: r3((H - 46.4) / 2) };
  const cav = { x0: -1.5, x1: r3(X + 1.5), z0: -0.5, z1: r3(Z + board.gap + board.comp + 1.7) }, t = 2.5;
  const outer = { x0: r3(cav.x0 - t), x1: r3(cav.x1 + t), z0: r3(cav.z0 - t), z1: r3(cav.z1 + t) };
  const ret = { w: 40, t: 4 }, xm = X / 2, channel = { x0: r3(xm - ret.w / 2 - 0.5), x1: r3(xm + ret.w / 2 + 0.5), z1: outer.z0, z0: r3(outer.z0 - ret.t - 1) };
  const keel = { x0: r3(channel.x0 - t), x1: r3(channel.x1 + t), z0: r3(channel.z0 - t) };
  const lobe = { d: 10, hole: 3.4, at: [[outer.x0 - 1, outer.z0 - 1], [outer.x1 + 1, outer.z0 - 1], [outer.x1 + 1, outer.z1 + 1], [outer.x0 - 1, outer.z1 + 1]].map((p) => p.map(r3)) };      // Ø10 : JP's note, « garder le 10 mm »
  /* the top end, along Y : the + plate of CORE 8, the bands of the pressure plate, the copper plate, its insulating backing, the Belleville
     washers, the follower, a needle thrust bearing, the cam (its flat face on the bearing, its two ramps under the two bearing pins of the cap,
     its hub on the key of the shaft) — then the collar of the shaft under the cap, the cap, the circlip, the handle pinned on the shaft */
  const yPlus8 = r3(7 * pitch + H + PT), a = r3(yPlus8 + BAND.h);
  const top = { yPlus8, a, ins: r3(a + 2), disc: r3(a + 5), follower: r3(a + 9), bearing: r3(a + 12), cam: r3(a + 15), land: r3(a + 19), hub: r3(a + 20), end: r3(a + 24) };
  top.collar = r3(top.end - 1.5); top.cap1 = r3(top.end + 4); top.clip = r3(top.cap1 + 0.1); top.handle0 = r3(top.cap1 + 1.5); top.handle1 = r3(top.handle0 + 8);
  const bottom = { term: -5.2, backing: -6, end: -6, wall: -8.5, lid0: -80, inner0: -77.5, tab0: -40 };
  return { D, GAP, X, Z, H, CELL_D, PT, BAND, rows, cols, pitch, plate, bands, bosses, board, cav, outer, t, ret, xm, channel, keel, lobe, top, bottom, axis: [r3(xm), r3(Z / 2)], pins: [[8, r3(Z / 2)], [r3(X - 8), r3(Z / 2)]] };
})();

/** The stack and its handle, in numbers (examples, said) : what the bands of a joint ask (a lamella of the Stäubli MULTILAM LA-CU : 7 N, 40 A —
    read in iteration 9), what the Belleville washers give, the stroke of the cam, the torque on the handle, and whether the ramp holds itself —
    by the analytical model « face_cam » (the mechanics of a square-thread power screw, page Wikipédia « Leadscrew », read), the one the project keeps.
    o : { mu (ramp on its pins), muB (needle thrust bearing), rb (its mean radius), alpha (ramp, °), rm (mean radius of the ramp), dwell (°), k (washer stack, N/mm), lever } */
export const CAM = { mu: 0.1, muB: 0.005, rb: 11.75, alpha: 5.5, rm: 15, dwell: 15, turn: 90, lobes: 2, k: 200, lever: 35, Fhand: 50, track: [11, 19], pin: 4, stop: 25, steps: 8 };
export function camLayout(o = {}) {
  const c = { ...CAM, ...o }, B = C2.BAND, n = Math.floor(B.l / B.pitch), perBand = n * 7, joint = 2 * perBand, amps = 2 * n * 40;      // two bands per joint
  const r = run("face_cam", { ...sessionDefaults("face_cam"), rm: c.rm, alpha: c.alpha, turn: c.turn, dwell: c.dwell, lobes: c.lobes, lever: c.lever, k: c.k, F0: 0, Freq: joint, mu: c.mu, muB: c.muB, rb: c.rb, Fhand: c.Fhand }), v = r.values;
  return { lamellae: n, perBand, joint, amps, stroke: r3(v.s), preload: r3(v.F), torque: r3(v.T_up), hand: r3(v.F_up), release: r3(v.F_rel), back: r3(v.T_down), alphaLock: r3(v.alphaLock), selfLock: v.T_down >= 0,
    margin: r3(v.F / joint), verdict: r.verdict, run: r, ...c };
}
/** The calculation of the cam, kept in the project (concept 2) : the model « face_cam » with the numbers of the cam drawn. */
export function camCalc() {
  const c = camLayout(), r = c.run;
  return { id: "phy-bm2-cam", name: `Came de face du couvercle du haut — ${Math.round(c.preload)} N sur la pile, ${String(Math.round(c.hand))} N à la main`, model: "face_cam", part: "BM2-CAM", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T16:00:00.000Z",
    why: `Un quart de tour : ${c.turn - c.dwell}° de rampe à ${fr(c.alpha)}° sur un rayon moyen de ${c.rm} mm, puis ${c.dwell}° de plateau ; deux lobes ; des rondelles Belleville de ${c.k} N/mm (exemple). Les deux joints de bandes demandent ${c.joint} N (${c.lamellae} lamelles × 7 N, deux bandes). Butée à aiguilles (μb ≈ ${fr(c.muB)}, valeur d'usage), rampe acier trempé sur goupilles graissées (μ ≈ ${fr(c.mu)}, valeur d'usage, à mesurer).` };
}

/* ---------- the CORE 2.0 ---------- */
const CU = "CU-C110";
function cellPart() {
  const { CELL_D, H } = C2;
  return part("BM2-CELL", "Cellule 21700 couchée (CORE 2.0)", { family: "purchased", process: "purchased", material: "LI-ION-CELL",
    features: [cylY("boite", "Boîte de la cellule", [0, 0, 0], CELL_D, r3(H - 0.6)), cylY("calotte", "Calotte +", [0, r3(H - 0.6), 0], 8, 0.6)],
    function: "Une cellule 21700 (Molicel P45B de la bibliothèque) couchée le long du module : son fond − sur la plaque −, sa calotte + sous la plaque +.",
    notes: ["Enveloppe de la P45B (Ø21,55 × 70,15 mm, fiche lue à l'itération 2) ; la calotte dessinée Ø8 × 0,6 mm (exemple)."] });
}
function holderPart() {
  const { X, Z, cols, rows } = C2;
  return part("BM2-HOLDER", "Support de cellules du CORE 2.0 (aux deux bouts)", { family: "molded", process: "injection_molding", material: "PC",
    features: [box("cadre", "Cadre", [0, 0, 0], [X, 8, Z]), ...rows.flatMap((z, j) => cols.map((x, i) => cylY(`godet_${j + 1}${i + 1}`, `Godet ${j + 1}.${i + 1}`, [x, -0.1, z], 21.8, 8.2, { mode: "cut" })))],
    function: "Tient les 8 cellules couchées à chaque bout du CORE et le guide dans le boîtier ; isole les cellules l'une de l'autre.",
    notes: ["PC V-0 (exemple), 8 mm d'épaisseur ; godets Ø21,8 pour des cellules de Ø21,55 au plus."] });
}
function platePart(sign) {
  const { plate: P, PT, H, bosses } = C2, y0 = sign > 0 ? H : -PT;
  const feats = [box("plaque", sign > 0 ? "Plaque +" : "Plaque −", [P.x0, y0, P.z0], [P.x1 - P.x0, PT, P.z1 - P.z0])];
  if (sign > 0) feats.push(...bosses.map(([x, z], k) => cylY(`bossage_${k + 1}`, `Bossage ${k + 1} — la butée du CORE suivant`, [x, r3(H + PT), z], 6, C2.BAND.h)));
  return part(sign > 0 ? "BM2-PLUS" : "BM2-MINUS", sign > 0 ? "Plaque + du CORE 2.0 (rigide, à bossages)" : "Plaque − du CORE 2.0 (porte les bandes à lamelles)",
    { family: "sheet_metal", process: "laser_cut", material: CU, features: feats, bodies: { main: { material: CU, kind: "conductor", net: sign > 0 ? "CORE+" : "CORE−" } },
      function: sign > 0 ? "Recueille le courant des 8 calottes + ; sa face extérieure est le contact RIGIDE du CORE : les bandes du CORE suivant la pressent, ses trois bossages sont la butée qui fixe leur hauteur de travail."
        : "Recueille le courant des 8 fonds − ; porte sur sa face extérieure les deux bandes à lamelles qui pressent la plaque + du CORE d'avant.",
      notes: [`Cuivre de ${fr(PT)} mm (exemple), soudé aux cellules par des languettes minces (à confirmer avec Molicel, comme à l'itération 12).`,
        sign > 0 ? `Trois bossages Ø6 × ${fr(C2.BAND.h)} mm, sur l'axe entre les deux rangées, hors des bandes : la hauteur de travail des bandes (1,5–1,9 mm, Weftron LOUVER_tron 112, lue à l'itération 9).` : "Les bandes y sont serties ou soudées (à voir avec le fabricant des bandes)."] });
}
function bandPart() {
  const { BAND } = C2;
  return part("BM2-BAND", "Bande à lamelles (contact −, ressort)", { family: "purchased", process: "purchased", material: "CUBE-C17200",
    features: [box("bande", "Bande à lamelles, à sa hauteur de travail", [0, 0, 0], [BAND.l, BAND.h, BAND.w])], bodies: { main: { material: "CUBE-C17200", kind: "conductor" } },
    function: "Le ressort du contact − : ses lamelles se couchent entre la plaque − d'un CORE et la plaque + du suivant, chacune un pont en parallèle ; elles rattrapent l'écart, la butée le fixe.",
    notes: [`Enveloppe à la hauteur de travail : ${BAND.l} × ${BAND.w} × ${fr(BAND.h)} mm, pas de ${fr(BAND.pitch)} mm — ${camLayout().lamellae} lamelles (exemple d'après les fiches lues à l'itération 9 : Weftron LOUVER_tron 112, une lamelle Stäubli MULTILAM LA-CU à 40 A et 7 N).`,
      `Deux bandes par joint : ${camLayout().amps} A de lamelles pour 360 A, ${camLayout().joint} N à pousser.`] });
}
/* ---------- the sensors and the voltage taps (JP, 22 novembre, par menu : « Capteurs et tension ») ----------
   The − face is now a contact : the thermistors leave it. A flex slides between the two rows of cells, in their gap of 3 mm, from one holder to
   the other ; a thermistor on a thermal pad bears on the flank of every cell — four upward on the upper row, four downward on the lower one ;
   its tail rises along the side of the CORE, in the play of the casing, to a tongue under the edge of the board. Two nickel-plated tabs take the
   voltage of the + and − plates up to the underside of the board, at its two ends. */
export const SENSE = (() => {
  const { rows, cols, H, X, Z, board } = C2, r = C2.CELL_D / 2, low = r3(rows[0] + r), high = r3(rows[1] - r), mid = r3((low + high) / 2), ft = 0.2;
  return { low, high, f0: r3(mid - ft / 2), f1: r3(mid + ft / 2), y0: 9, y1: r3(H - 9), tail: { y0: 30, y1: 40, x0: r3(X + 0.2), x1: r3(X + 0.4) }, pad: 3, cols, H, X, Z, zb: r3(Z + board.gap), tab: 0.3 };
})();
function sensorFlexPart() {
  const S = SENSE, ymid = r3((S.y0 + S.y1) / 2), tongue = r3(S.zb - 0.2);
  return part("BM2-NTC-FLEX", "Flex des thermistances du CORE 2.0", { family: "flex", process: "purchased", material: "PI-FILM",
    bodies: { flex: { material: "PI-FILM", kind: "insulator", label: "Flex polyimide" }, ntc: { material: "THERMAL-PAD", kind: "insulator", label: "Thermistances sur leurs pastilles thermiques" } },
    features: [box("bande", "Bande entre les rangées", [3, S.y0, S.f0], [r3(S.X - 3 + 0.4), r3(S.y1 - S.y0), r3(S.f1 - S.f0)], { body: "flex" }),
      box("queue", "Queue, le long du flanc", [S.tail.x0, S.tail.y0, S.f0], [r3(S.tail.x1 - S.tail.x0), r3(S.tail.y1 - S.tail.y0), r3(tongue + 0.2 - S.f0)], { body: "flex" }),
      box("languette", "Languette sous le bord de la carte", [r3(S.X - 6), S.tail.y0, tongue], [r3(S.tail.x1 - S.X + 6), r3(S.tail.y1 - S.tail.y0), 0.2], { body: "flex" }),
      ...S.cols.map((x, i) => box(`ntc_haut_${i + 1}`, `Thermistance ${i + 5}, rangée du haut`, [r3(x - S.pad / 2), r3(ymid - S.pad / 2), S.f1], [S.pad, S.pad, r3(S.high - S.f1)], { body: "ntc" })),
      ...S.cols.map((x, i) => box(`ntc_bas_${i + 1}`, `Thermistance ${i + 1}, rangée du bas`, [r3(x - S.pad / 2), r3(ymid - S.pad / 2), S.low], [S.pad, S.pad, r3(S.f0 - S.low)], { body: "ntc" }))],
    function: "Mesure la température des 8 cellules : une thermistance sur le flanc de chacune, à mi-longueur — la face − est un contact, elle n'en porte plus.",
    notes: [`Glissé entre les deux rangées, dans leur jeu de ${fr(S.high - S.low)} mm ; les pastilles thermiques (${S.pad} × ${S.pad} mm, exemple) touchent chaque cellule sur sa génératrice.`,
      "La queue monte dans le jeu de 1,5 mm entre le CORE et le boîtier et finit en languette sous le bord de la carte, où un connecteur FPC ou des pastilles la reçoivent (à dessiner dans le PCBA).",
      "Pas encore vérifié : le temps de réponse à travers la pastille, l'usure du flex quand on glisse le CORE dans le boîtier."] });
}
function tapPart(sign) {
  const S = SENSE, t = S.tab, y = sign > 0 ? S.H : -t, ylo = sign > 0 ? r3(S.H + t - 14) : -t, yhi = sign > 0 ? r3(S.H + t) : 14, zp = r3(C2.plate.z1);
  return part(sign > 0 ? "BM2-TAP-P" : "BM2-TAP-M", sign > 0 ? "Prise de tension CORE+" : "Prise de tension CORE−", { family: "contact", process: "purchased", material: CU,
    bodies: { main: { material: CU, kind: "conductor", net: sign > 0 ? "CORE+" : "CORE-", label: "Languette de cuivre nickelé" } },
    features: [box("montee", "Montée depuis la plaque", [40, y, zp], [10, t, r3(S.zb - 0.3 - zp)]), box("retour", "Retour sous la carte", [40, ylo, r3(S.zb - 0.3)], [10, r3(yhi - ylo), 0.3])],
    function: `Amène la tension de la plaque ${sign > 0 ? "+" : "−"} sous la carte, à son bout ${sign > 0 ? "+" : "−"}.`,
    notes: ["Cuivre nickelé de 0,3 mm, 10 mm de large (exemple), soudé au bord de la plaque ; sa pastille sous la carte est à dessiner dans le PCBA.",
      "La tension se mesure équilibrage coupé, comme au concept 1 ; la chute dans la plaque, à 360 A, est hors de la mesure : la prise est sur la plaque, pas sur une cellule."] });
}

/** The CORE 2.0, in its own frame : the − plate at y = 0, the + plate at y = H ; boardPart : the twin of the CORE board. */
export function coreTwoAssembly(boardPart) {
  const { cols, rows, H, BAND, bands, board, Z } = C2, at = (t) => ({ t: t.map(r3), r: [0, 0, 0] });
  const cells = rows.flatMap((z, j) => cols.map((x, i) => ({ id: `c${j + 1}${i + 1}`, part: "BM2-CELL", fixed: true, placement: at([x, 0, z]) })));
  return { dw: "assembly/1", id: "BM2-CORE-ASM", name: "CORE 2.0 (1S8P couché)", instances: [...cells,
    { id: "support_bas", part: "BM2-HOLDER", fixed: true, placement: at([0, 0, 0]) }, { id: "support_haut", part: "BM2-HOLDER", fixed: true, placement: at([0, r3(H - 8), 0]) },
    { id: "plaque_plus", part: "BM2-PLUS", fixed: true, placement: at([0, 0, 0]) }, { id: "plaque_moins", part: "BM2-MINUS", fixed: true, placement: at([0, 0, 0]) },
    ...bands.map(([z0], k) => ({ id: `bande_${k + 1}`, part: "BM2-BAND", fixed: true, placement: at([r3((C2.X - BAND.l) / 2), r3(-C2.PT - BAND.h), z0]) })),
    { id: "flex_ntc", part: "BM2-NTC-FLEX", fixed: true, placement: at([0, 0, 0]) }, { id: "prise_plus", part: "BM2-TAP-P", fixed: true, placement: at([0, 0, 0]) }, { id: "prise_moins", part: "BM2-TAP-M", fixed: true, placement: at([0, 0, 0]) },
    ...(boardPart ? [{ id: "carte", part: boardPart, fixed: true, placement: at([0, board.y, r3(Z + board.gap)]) }] : [])], mates: [] };
}

/* ---------- the casing, the return busbar, the two ends ---------- */
function casingPart() {
  const { outer: O, cav, channel: ch, keel: K, lobe, top, bottom, X } = C2, y0 = bottom.end, L = r3(top.end - y0);
  return part("BM2-CASING", "Boîtier extrudé du concept 2", { family: "extrusion", process: "extrusion_plastic", material: "PC",
    features: [box("paroi", "Profilé", [O.x0, y0, O.z0], [O.x1 - O.x0, L, O.z1 - O.z0]), box("quille", "Quille du canal", [K.x0, y0, K.z0], [K.x1 - K.x0, L, O.z0 - K.z0]),
      ...lobe.at.map(([x, z], k) => cylY(`lobe_${k + 1}`, `Lobe ${k + 1}, Ø${lobe.d}`, [x, y0, z], lobe.d, L)),
      box("cavite", "Cavité des CORE", [cav.x0, r3(y0 - 1), cav.z0], [cav.x1 - cav.x0, r3(L + 2), cav.z1 - cav.z0], { mode: "cut" }),
      box("canal", "Canal du busbar de retour", [ch.x0, r3(y0 - 1), ch.z0], [ch.x1 - ch.x0, r3(L + 2), ch.z1 - ch.z0], { mode: "cut" }),
      ...lobe.at.map(([x, z], k) => cylY(`trou_${k + 1}`, `Trou de vis ${k + 1} (EVO PT 40 : Ø3,4)`, [x, r3(y0 - 1), z], lobe.hole, r3(L + 2), { mode: "cut" })),
      box("fenetre", "Fenêtre du shunt, au bout haut", [28, r3(top.a - 2), r3(O.z0 - 0.2)], [r3(X - 56), 6, r3(cav.z0 - O.z0 + 0.4)], { mode: "cut" })],
    function: "Contient la pile des 8 CORE 2.0 en ligne ; ses quatre lobes reçoivent les vis des deux couvercles ; sous le fond, le canal du busbar de retour.",
    notes: [`Section ${fr(O.x1 - O.x0)} × ${fr(O.z1 - K.z0)} mm, paroi de ${fr(C2.t)} mm, coupé à ${fr(L)} mm (exemples). Lobes Ø${lobe.d} (la note de JP : élargis de 8,4 à 10 mm), trous Ø${fr(lobe.hole)} pour vis EVO PT 40.`,
      "Plus long et plus bas que le boîtier du concept 1 : les CORE couchés en ligne, leur carte sur le dessus."] });
}
function returnPart() {
  const { ret, xm, channel: ch, top, bottom } = C2, y0 = bottom.tab0, y1 = r3(top.a + 2);
  return part("BM2-RETURN", "Busbar de retour du concept 2", { family: "busbar", process: "purchased", material: CU, bodies: { main: { material: CU, kind: "conductor", net: "PACK+" } },
    features: [box("barre", "Barre 40 × 4", [r3(xm - ret.w / 2), y0, r3(ch.z0 + 0.5)], [ret.w, r3(y1 - y0), ret.t])],
    function: "Ramène le + de la pile, pris au bout haut par le shunt de la plaque de pression, jusqu'au couvercle du fond.",
    notes: ["40 × 4 mm de cuivre : la section que le modèle « busbar » demandait pour 360 A à l'itération 11 b (exemple)."] });
}
function terminalPart() {
  const { plate: P, bosses, BAND, bottom } = C2;
  return part("BM2-TERM-NEG", "Borne − du module (plaque rigide à bossages)", { family: "sheet_metal", process: "laser_cut", material: CU, bodies: { main: { material: CU, kind: "conductor", net: "PACK−" } },
    features: [box("plaque", "Plaque", [P.x0, bottom.term, P.z0], [P.x1 - P.x0, 2, P.z1 - P.z0]), ...bosses.map(([x, z], k) => cylY(`bossage_${k + 1}`, `Bossage ${k + 1}`, [x, r3(bottom.term + 2), z], 6, BAND.h)),
      box("languette", "Languette vers le couvercle du fond", [r3(C2.xm - 10), bottom.tab0, 20], [20, r3(bottom.term - bottom.tab0), 3])],
    function: "Le contact rigide du bout bas : les bandes du CORE 1 la pressent jusqu'à ses bossages ; sa languette entre dans le couvercle du fond.",
    notes: ["Comme une plaque + de CORE : le contact rigide est le même partout dans la pile."] });
}
function backingPart() {
  const { X, Z, bottom, xm } = C2;
  return part("BM2-BACKING", "Appui isolant de la borne −", { family: "molded", process: "injection_molding", material: "PA66-GF30",
    features: [box("appui", "Appui", [0, bottom.backing, 0], [X, r3(bottom.term - bottom.backing), Z]), box("fente", "Fente de la languette", [r3(xm - 10.5), r3(bottom.backing - 0.1), 19.5], [21, 1, 4], { mode: "cut" })],
    function: "Reprend la poussée de la pile contre le couvercle du fond ; isole la borne −." });
}
function bottomLidParts() {
  const { outer: O, cav, keel: K, channel: ch, bottom: B, xm } = C2, L = r3(B.end - B.lid0);
  const shell = part("BM2-LID-BOT", "Couvercle du fond, actif (concept 2)", { family: "molded", process: "injection_molding", material: "PA66-GF30",
    features: [box("coque", "Coque", [O.x0, B.lid0, K.z0], [O.x1 - O.x0, L, O.z1 - K.z0]), box("dedans", "Logement", [cav.x0, B.inner0, ch.z0], [cav.x1 - cav.x0, r3(B.wall - B.inner0), r3(cav.z1 - ch.z0)], { mode: "cut" }),
      box("passage_retour", "Passage du busbar de retour", [ch.x0, r3(B.wall - 0.1), ch.z0], [ch.x1 - ch.x0, r3(B.end - B.wall + 0.2), r3(ch.z1 - ch.z0)], { mode: "cut" }),
      box("passage_borne", "Passage de la languette de la borne −", [r3(xm - 10.5), r3(B.wall - 0.1), 19.5], [21, r3(B.end - B.wall + 0.2), 4], { mode: "cut" }),
      box("passage_connecteur", "Ouverture du connecteur d'échange", [20, r3(B.lid0 - 0.1), 5], [52, r3(B.inner0 - B.lid0 + 0.2), 30], { mode: "cut" })],
    function: "Le bout actif du module : connecteur d'échange, contacteur sur le +, carte du BMS central — dans un logement assez grand pour elle (JP : « bas actif »).",
    notes: [`Logement de ${fr(cav.x1 - cav.x0)} × ${fr(B.wall - B.inner0)} mm : la carte du BMS central (85 × 62 mm) y tient à plat — la décision « où mettre la carte » est réglée ici.`,
      "Les vis dans les lobes du boîtier, la nervuration et le joint d'étanchéité sont à dessiner."] });
  const contactor = part("BM2-CONTACTOR", "Contacteur du + (enveloppe générique)", { family: "purchased", process: "purchased", material: "PA66-GF30",
    features: [box("enveloppe", "Enveloppe", [50, -72, -7], [40, 30, 32])], function: "Ouvre le + du module ; commandé par le BMS central.", notes: ["Enveloppe générique (aucune série copiée) ; les barres vers le connecteur sont à dessiner."] });
  const connector = part("BM2-CONNECTOR", "Connecteur d'échange (enveloppe générique)", { family: "purchased", process: "purchased", material: "PA66-GF30",
    features: [box("enveloppe", "Enveloppe", [20, -90, 5], [52, 14, 30])], function: "Se branche quand le module est glissé dans sa cavité ou sa station : PACK+, PACK−, le bus du véhicule.", notes: ["Enveloppe générique ; la série est à choisir."] });
  return [shell, contactor, connector];
}
function topLidParts() {
  const { plate: P, outer: O, keel: K, axis: [ax, az], pins: pins0, top: T, X } = C2, plateBox = (id, name, y, t, mat, o = {}) => part(id, name, { family: o.family || "molded", process: o.process || "injection_molding", material: mat,
    features: [box("plaque", name, [P.x0, y, P.z0], [P.x1 - P.x0, t, P.z1 - P.z0]), ...(o.holes ? pins0.map(([x, z], k) => cylY(`guide_${k + 1}`, `Passage de la goupille ${k + 1}`, [x, r3(y - 0.1), z], 4.4, r3(t + 0.2), { mode: "cut" })) : [])],
    ...(o.bodies ? { bodies: o.bodies } : {}), function: o.fn, notes: o.notes || [] });
  const ring = (id, name, y, od, id0, h, mat, fn) => part(id, name, { family: "purchased", process: "purchased", material: mat, features: [cylY("anneau", name, [ax, y, az], od, h), cylY("alesage", "Alésage", [ax, r3(y - 0.1), az], id0, r3(h + 0.2), { mode: "cut" })], function: fn });
  const press = plateBox("BM2-PRESS-CU", "Plaque de pression, cuivre (contact + du bout haut)", T.a, 2, CU, { family: "sheet_metal", process: "laser_cut", bodies: { main: { material: CU, kind: "conductor", net: "PACK+" } },
    fn: "Porte les deux bandes qui pressent la plaque + du CORE 8 ; son shunt descend au busbar de retour." });
  const ins = plateBox("BM2-PRESS-INS", "Plaque de pression, isolante", T.ins, 3, "PA66-GF30", { holes: true, fn: "Isole la plaque de cuivre ; guidée par les deux goupilles du couvercle, elle ne tourne pas." });
  const disc = ring("BM2-DISC", "Rondelles Belleville (empilage)", T.disc, 40, 20.4, 4, "SS-17-4PH", "Rattrapent les tolérances de la pile : la came les écrase d'une course fixe, elles donnent l'effort.");
  disc.notes = [`Empilage dessiné à sa hauteur posée ; raideur visée ${camLayout().k} N/mm, ${fr(camLayout().preload)} N à la course de la came (exemple — à choisir dans un catalogue de rondelles DIN 2093).`];
  const follower = plateBox("BM2-FOLLOWER", "Suiveur de came (ne tourne pas)", T.follower, 3, "SS-304", { holes: true, family: "machined", process: "machining", fn: "Reçoit la poussée de la came par la butée à aiguilles ; guidé par les deux goupilles, il pousse les rondelles sans tourner." });
  const c = camLayout(), S = c.stroke, tip = r3(T.land + S), into = r3(T.end + 3), keyTop = r3(T.collar - 0.2), ST = "SS-17-4PH";
  const at = (r, q) => [r3(ax + r * Math.cos(q * Math.PI / 180)), r3(az + r * Math.sin(q * Math.PI / 180))];
  const sector = (r0, r1, a0, a1) => { const n = Math.max(2, Math.ceil((a1 - a0) / 3)), pts = []; for (let k = 0; k <= n; k++) pts.push(at(r1, a0 + (a1 - a0) * k / n)); for (let k = n; k >= 0; k--) pts.push(at(r0, a0 + (a1 - a0) * k / n)); return { poly: pts }; };
  const ramp = (id, name, a0, a1, h) => ({ op: "extrude", id, name, plane: "XZ", at: T.land, length: r3(h), profile: sector(c.track[0], c.track[1], a0, a1) });
  const rise = c.turn - c.dwell, step = rise / c.steps, lobes = [0, 180];
  const bearing = part("BM2-NEEDLE", "Butée à aiguilles et ses deux rondelles", { family: "purchased", process: "purchased", material: ST,
    features: [cylY("rondelle_1", "Rondelle côté suiveur", [ax, T.bearing, az], 32, 0.8), cylY("cage", "Cage à aiguilles", [ax, r3(T.bearing + 0.8), az], 30, 1.4), cylY("rondelle_2", "Rondelle côté came", [ax, r3(T.bearing + 2.2), az], 32, 0.8),
      cylY("alesage", "Alésage", [ax, r3(T.bearing - 0.1), az], 15, 3.2, { mode: "cut" })],
    function: "Laisse tourner la came sous la poussée de la pile : son frottement (μb ≈ 0,005, valeur d'usage) ne pèse presque rien dans le couple.",
    notes: ["Enveloppe générique Ø15 × Ø32 × 3 mm (aucune série lue) : la fiche du fabricant choisi donne la charge et le frottement."] });
  const cam = part("BM2-CAM", "Came de face à deux lobes, clavetée sur l'arbre", { family: "machined", process: "machining", material: ST,
    features: [cylY("disque", "Disque — sa face plate sur la butée", [ax, T.cam, az], 44, 4), cylY("moyeu", "Moyeu", [ax, T.land, az], 16, r3(T.hub - T.land)),
      box("ergot", "Ergot de butée (entre les deux goupilles de butée)", [r3(ax + 15.6), T.cam, r3(az + 2.05)], [12, 4, 6]),
      ...lobes.flatMap((q0, L) => [...Array.from({ length: c.steps }, (_, k) => ramp(`rampe_${L + 1}_${k + 1}`, `Rampe ${L + 1}, marche ${k + 1}`, q0 + k * step, q0 + (k + 1) * step, S * (k + 0.5) / c.steps)),
        ramp(`plateau_${L + 1}`, `Plateau ${L + 1} (fin de course)`, q0 + rise, q0 + rise + 25, S)]),
      cylY("alesage", "Alésage Ø10", [ax, r3(T.cam - 0.1), az], 10, r3(T.hub - T.cam + 0.2), { mode: "cut" }),
      box("rainure", "Rainure de clavette du moyeu", [r3(ax + 3), r3(T.cam - 0.1), r3(az - 1.5)], [3.4, r3(T.hub - T.cam + 0.2), 3], { mode: "cut" })],
    function: "Un quart de tour de la poignée : ses deux rampes passent sous les deux goupilles d'appui du couvercle et la came descend de sa course ; sa face plate pousse la butée, le suiveur, les rondelles, la pile. Au plateau, elle tient sans verrou.",
    notes: [`Deux rampes hélicoïdales à ${fr(c.alpha)}° sur un rayon moyen de ${c.rm} mm (piste de ${c.track[0]} à ${c.track[1]} mm), ${rise}° de montée puis un plateau : course ${fr(S)} mm. Dessinées en ${c.steps} marches (le noyau ne trace pas d'hélice ici) ; la vraie rampe est continue — fraisée en 4 axes, ou frittée puis reprise.`,
      `Elle FLOTTE sur la clavette : la poussée va des goupilles d'appui au couvercle, l'arbre ne porte que le couple. Ergot entre deux goupilles de butée : ${c.turn}° de rotation, pas plus.`,
      `Calcul gardé dans le projet (modèle « face_cam ») : ${Math.round(c.preload)} N sur la pile, ${fr(c.torque)} N·m, ${Math.round(c.hand)} N à la main ; la rampe tient seule (pente limite ${fr(c.alphaLock)}°), le plateau aussi.`, "Acier 17-4 PH trempé (exemple) : la rampe et les goupilles frottent."] });
  const shaft = part("BM2-SHAFT", "Arbre de la poignée (claveté, à collet)", { family: "machined", process: "machining", material: ST,
    features: [cylY("arbre", "Arbre Ø10", [ax, r3(T.cam + 0.5), az], 10, r3(T.handle1 - T.cam - 0.5)), cylY("collet", "Collet Ø14, sous le couvercle", [ax, T.collar, az], 14, 1.5),
      box("rainure", "Rainure de clavette", [r3(ax + 3.2), r3(T.cam + 0.4), r3(az - 1.5)], [3, r3(keyTop - T.cam - 0.4), 3], { mode: "cut" }),
      cylY("gorge", "Gorge du circlip", [ax, T.clip, az], 11, 1, { mode: "cut" }), cylY("fond_gorge", "Fond de gorge Ø9,4", [ax, T.clip, az], 9.4, 1),
      { op: "cylinder", id: "trou_goupille", name: "Trou de la goupille de la poignée", at: [ax, r3(T.handle0 + 2.5), r3(az - 6)], d: 2.5, h: 12, axis: "Z", mode: "cut" }],
    function: "Porte le couple de la poignée à la came par la clavette ; tenu en long par son collet sous le couvercle et le circlip dessus.",
    notes: ["Il ne porte pas la poussée de la pile : la came flotte sur la clavette, les goupilles d'appui reprennent l'effort dans le couvercle."] });
  const key = part("BM2-KEY", "Clavette parallèle 3 × 3", { family: "purchased", process: "purchased", material: ST,
    features: [box("clavette", "Clavette", [r3(ax + 3.2), r3(T.cam + 0.5), r3(az - 1.5)], [3, r3(keyTop - T.cam - 0.5), 3])],
    function: "Fait tourner la came avec l'arbre, sans jeu au retour, et la laisse glisser le long de l'arbre sur sa course.",
    notes: [`3 × 3 × ${fr(keyTop - T.cam - 0.5)} mm — la taille d'usage d'un arbre de 8 à 10 mm (la table de la norme DIN 6885 n'a pas été lue ici). Ajustement P9 / h9 dans l'arbre (la note de JP), glissant dans le moyeu : la came doit pouvoir descendre de sa course.`] });
  const clip = part("BM2-CIRCLIP", "Circlip de l'arbre", { family: "purchased", process: "purchased", material: ST,
    features: [cylY("anneau", "Circlip", [ax, T.clip, az], 17, 1), cylY("alesage", "Alésage", [ax, r3(T.clip - 0.1), az], 9.4, 1.2, { mode: "cut" })],
    function: "Retient l'arbre contre le couvercle, dehors ; il ne porte que la poignée.", notes: ["Enveloppe générique d'un anneau d'arbre Ø10 (aucune série lue)."] });
  const xpin = part("BM2-XPIN", "Goupille élastique de la poignée", { family: "purchased", process: "purchased", material: ST,
    features: [{ op: "cylinder", id: "goupille", name: "Goupille Ø2,5", at: [ax, r3(T.handle0 + 2.5), r3(az - 8)], d: 2.5, h: 16, axis: "Z" }],
    function: "Lie la poignée à l'arbre.", notes: ["Ø2,5 × 16 mm (exemple)."] });
  const pins = [...pins0.map(([x, z], k) => ({ id: `guide_${k + 1}`, name: `Goupille de guidage ${k + 1}`, x, z, y0: T.ins })),
    ...[90, 270].map((q, k) => { const [x, z] = at(c.rm, q); return { id: `appui_${k + 1}`, name: `Goupille d'appui ${k + 1} — la rampe ${k + 1} passe dessous`, x, z, y0: tip }; }),
    { id: "butee_fin", name: "Goupille de butée — fin du quart de tour", x: r3(ax + c.stop), z: az, y0: r3(T.cam + 0.5) }, { id: "butee_debut", name: "Goupille de butée — début du quart de tour", x: r3(ax - 10.1), z: r3(az + 22.87), y0: r3(T.cam + 0.5) }];
  const cap = part("BM2-CAP", "Couvercle du haut (porte la poignée et les goupilles de la came)", { family: "molded", process: "injection_molding", material: "PA66-GF30",
    bodies: { main: { material: "PA66-GF30", label: "Couvercle" }, goupilles: { material: ST, label: "Goupilles emmanchées (acier trempé)" } },
    features: [box("plaque", "Couvercle", [O.x0, T.end, K.z0], [O.x1 - O.x0, 4, O.z1 - K.z0]), cylY("passage", "Passage de l'arbre", [ax, r3(T.end - 0.1), az], 10.4, 4.2, { mode: "cut" }),
      ...pins.map((g) => cylY(`logement_${g.id}`, `Logement — ${g.name}`, [g.x, r3(T.end - 0.1), g.z], 4, 3.1, { mode: "cut" })),
      ...pins.map((g) => cylY(g.id, g.name, [g.x, g.y0, g.z], 4, r3(into - g.y0), { body: "goupilles" }))],
    function: "Ferme le bout haut ; ses goupilles guident la plaque et le suiveur, portent la poussée de la came (goupilles d'appui) et bornent le quart de tour (goupilles de butée).",
    notes: ["Vissé dans les quatre lobes du boîtier (vis à dessiner). Pas d'électronique ici (JP : « haut à poignée »).", `Goupilles Ø4 emmanchées de 3 mm (exemple : surmoulées ou emmanchées, à voir avec le mouliste) ; les deux goupilles d'appui portent ${Math.round(c.preload / 2)} N chacune.`] });
  const handle = part("BM2-HANDLE", "Poignée quart de tour", { family: "molded", process: "injection_molding", material: "PA66-GF30",
    features: [cylY("moyeu", "Moyeu Ø16", [ax, T.handle0, az], 16, 8), box("levier", "Levier", [r3(ax - 35), r3(T.handle0 + 5), r3(az - 6)], [70, 3, 12]),
      cylY("alesage", "Alésage de l'arbre", [ax, r3(T.handle0 - 0.1), az], 10, 8.2, { mode: "cut" }),
      { op: "cylinder", id: "trou_goupille", name: "Trou de la goupille", at: [ax, r3(T.handle0 + 2.5), r3(az - 8.1)], d: 2.5, h: 16.2, axis: "Z", mode: "cut" }],
    function: "Un quart de tour : la pile est pressée.", notes: [`Effort à la main : ${Math.round(c.hand)} N au bout du levier de ${c.lever} mm pour fermer, ${Math.round(c.release)} N pour ouvrir (modèle « face_cam »). Le levier repliable à plat n'est pas dessiné.`] });
  const strap = part("BM2-STRAP", "Shunt du bout haut", { family: "busbar", process: "purchased", material: CU, bodies: { main: { material: CU, kind: "conductor", net: "PACK+" } },
    features: [box("shunt", "Shunt souple", [30, T.a, -3.5], [r3(X - 60.8), 2, 4.5])], function: "Relie la plaque de pression au busbar de retour, par la fenêtre du fond ; souple, il suit la course de la came." });
  return [press, ins, disc, follower, bearing, cam, shaft, key, clip, xpin, cap, handle, strap];
}

/** Every part of concept 2, and its assemblies. boards : { core (the twin of the CORE board), bms (the twin of the central BMS board) } */
export function conceptTwo(boards = {}) {
  const parts = [cellPart(), holderPart(), platePart(+1), platePart(-1), bandPart(), sensorFlexPart(), tapPart(+1), tapPart(-1), casingPart(), returnPart(), terminalPart(), backingPart(), ...bottomLidParts(), ...topLidParts()];
  const at = (t) => ({ t: t.map(r3), r: [0, 0, 0] }), T = C2.top, B = C2.bottom;
  const lidTop = { dw: "assembly/1", id: "BM2-LID-TOP-ASM", name: "Couvercle du haut à poignée (concept 2)", instances: [
    ...C2.bands.map(([z0], k) => ({ id: `bande_${k + 1}`, part: "BM2-BAND", fixed: true, placement: at([r3((C2.X - C2.BAND.l) / 2), T.yPlus8, z0]) })),
    { id: "plaque_cu", part: "BM2-PRESS-CU", fixed: true, placement: at([0, 0, 0]) }, { id: "plaque_iso", part: "BM2-PRESS-INS", fixed: true, placement: at([0, 0, 0]) },
    { id: "belleville", part: "BM2-DISC", fixed: true, placement: at([0, 0, 0]) }, { id: "suiveur", part: "BM2-FOLLOWER", fixed: true, placement: at([0, 0, 0]) },
    { id: "aiguilles", part: "BM2-NEEDLE", fixed: true, placement: at([0, 0, 0]) }, { id: "came", part: "BM2-CAM", fixed: true, placement: at([0, 0, 0]) },
    { id: "arbre", part: "BM2-SHAFT", fixed: true, placement: at([0, 0, 0]) }, { id: "clavette", part: "BM2-KEY", fixed: true, placement: at([0, 0, 0]) },
    { id: "couvercle", part: "BM2-CAP", fixed: true, placement: at([0, 0, 0]) }, { id: "circlip", part: "BM2-CIRCLIP", fixed: true, placement: at([0, 0, 0]) },
    { id: "poignee", part: "BM2-HANDLE", fixed: true, placement: at([0, 0, 0]) }, { id: "goupille_poignee", part: "BM2-XPIN", fixed: true, placement: at([0, 0, 0]) }], mates: [] };
  const lidBot = { dw: "assembly/1", id: "BM2-LID-BOT-ASM", name: "Couvercle du fond actif (concept 2)", instances: [
    { id: "coque", part: "BM2-LID-BOT", fixed: true, placement: at([0, 0, 0]) }, { id: "contacteur", part: "BM2-CONTACTOR", fixed: true, placement: at([0, 0, 0]) },
    { id: "connecteur", part: "BM2-CONNECTOR", fixed: true, placement: at([0, 0, 0]) },
    ...(boards.bms ? [{ id: "bms", part: boards.bms, fixed: true, placement: at([3.9, -77, 42]) }] : [])], mates: [] };
  const module = { dw: "assembly/1", id: "BM2-MODULE-ASM", name: "BM 8s8p — concept 2, CORE en ligne pressés", instances: [
    { id: "boitier", part: "BM2-CASING", fixed: true, placement: at([0, 0, 0]) }, { id: "borne_moins", part: "BM2-TERM-NEG", fixed: true, placement: at([0, 0, 0]) },
    { id: "appui", part: "BM2-BACKING", fixed: true, placement: at([0, 0, 0]) },
    ...Array.from({ length: 8 }, (_, k) => ({ id: `core${k + 1}`, asm: "BM2-CORE-ASM", fixed: true, placement: at([0, r3(k * C2.pitch), 0]) })),
    { id: "retour", part: "BM2-RETURN", fixed: true, placement: at([0, 0, 0]) }, { id: "shunt", part: "BM2-STRAP", fixed: true, placement: at([0, 0, 0]) },
    { id: "couvercle_haut", asm: "BM2-LID-TOP-ASM", fixed: true, placement: at([0, 0, 0]) }, { id: "couvercle_fond", asm: "BM2-LID-BOT-ASM", fixed: true, placement: at([0, 0, 0]) }], mates: [] };
  void B;
  return { parts, assemblies: [module, coreTwoAssembly(boards.core), lidTop, lidBot] };
}
