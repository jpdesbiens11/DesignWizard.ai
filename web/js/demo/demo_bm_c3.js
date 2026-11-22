/* DesignOrbit.ai — BM 8s8p - 21700, CONCEPT 3 « blade and fork », on its own branch, started from concept 1 (MAIN) (JP, 22 novembre 2026 :
   « cellules perpendiculaires à l'axe d'insertion du module, comme au concept 1 ; les CORE s'assemblent l'un à l'autre, contacts face à face,
   − contre +, dans l'axe d'insertion ; y mettre des contacts haute puissance à lames ; couvercles debout ; commencer simple… pas de ressorts de
   produit grand public : des ressorts fins et compacts, aucune place en longueur » ; his choices by menu : « Lame dans une pince », and the
   whole of concept 1 as the start).
   What changes from concept 1, and only that :
   - THE JOINT BETWEEN TWO CORE : the + leg of a CORE grows an EAR past its +X end and a BLADE (2.5 mm of copper) that runs along Y into a
     FORK on the − leg of the next CORE ; inside the fork, two louvred bands (the envelope read in iteration 9 : 12 mm wide, a pitch of 3.5 mm,
     a working height of 1.5 to 1.9 mm) press both faces of the blade. The contact force stays INSIDE the fork : the stack no longer has to be
     squeezed to make its contacts, and the blade slides in the fork — the tolerances of the 8 CORE along Y are taken there. The pitch stays
     50.9 mm : the legs still touch, face against face, but carry no defined force any more. The cost : 10 mm of WIDTH at the +X end.
   - THE TERMINALS : the − terminal has a blade like a + leg, the + terminal a fork like a − leg.
   - THE LID SPRINGS : the four coil springs of the pressure plate become four stacks of disc springs (Belleville washers) on columns of the
     plate — a few millimetres instead of 23 ; the stack is only held (against the accelerations along the module, a value the vehicle gives)
     and the LV lands kept closed.
   - THE CASING AND THE LIDS : 10 mm wider at +X ; the keel, the rails and the screw pattern follow, the lips of the top ring stay where the cam
     arm meets them.
   Every size and every force is an EXAMPLE, said on the parts. Frame of a CORE : X its length, Y across, Z up ; the cells stand on z = 0. Pure. */

import { run, sessionDefaults } from "../analysis/physics/index.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");
const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });

/** The blade and its fork, across X (in the frame of a CORE), along Y (from the contact face of the legs) and up Z — examples. */
export const F3 = {
  ear: 89.8,      // where the legs end (the busbar stops at the gaps of 3 mm of the short ends)
  jawIn: [92.9, 96.1], louvIn: [94.9, 96.6], blade: [96.6, 99.1], louvOut: [99.1, 100.8], jawOut: [99.6, 102.8],      // 0.1 mm clear of the board and the holders (x 92.8)
  groove: 1.2, play: 0.5,      // the housing of a band, 1.2 mm deep in its jaw (the band stands 1.7 mm from its bottom) ; 0.5 mm between a jaw and the blade
  z: { leg: [5, 68], jaw: [1, 69], louv: [7, 65] },      // the jaws face the side ribs of the casing (z 3 and 66) : the fork guides the CORE at +X
  y: { depth: 18, bottom: 2, band: [2, 14], tip: 15 },      // from the contact face : the fork 18 mm deep, its bottom 2 mm thick ; the bands ; the tip of the blade
  lead: { blade: [0.75, 2], mouth: [0.5, 1.5] },      // the chamfers : the nose of the blade, 0.75 mm a side over 2 mm ; the mouth of each jaw, 0.5 over 1.5 mm
  heel: 1.5, lap: 2.5,      // the heel of the blade, 1.5 mm under the end of the ear, which laps on it over 2.5 mm : the joint brazed on two faces
  band: { w: 12, p: 3.5, h: 1.7, Il: 40, Rl: 300, Fl: 7, F112: [5, 30] },      // the louvred band : envelope of the LOUVER_tron 112, values of a lamella of the MULTILAM LA-CU (read in iteration 9) ; F112 : the contact force of a plate of the 112, « 5 - 30 N depending on working height » (its sheet, rev03, p. 2, read)
};
/** The cavity of the casing for concept 3 : 10 mm more at +X, for the outer jaw ; the side ribs of +X face it. */
export const ENV3 = (env) => ({ ...env, x1: F3.jawOut[1], flex1: F3.jawOut[1], xm: (env.x0 + env.x1) / 2 });
/** A prism drawn in the plane X Y and pushed up Z : a profile with chamfers. */
const prism = (id, name, body, poly, z, mode) => ({ op: "extrude", id, name, body, plane: "XY", profile: { poly: poly.map((q) => q.map(r3)) }, at: r3(z[0]), length: r3(z[1] - z[0]), ...(mode ? { mode } : {}) });

/** The blade and its ear, on a + leg whose contact face is at y = face (the ear in the plane of the leg, behind its face). body : the conductor. */
export function bladeFeatures(body, face, t, o = {}) {
  const z = F3.z.leg, h = z[1] - z[0], b = F3.blade, sfx = o.sfx || "", [c, cl] = F3.lead.blade, y0 = face - t, tip = face + F3.y.tip, heel = b[0] - F3.lap;
  return [box(`oreille_plus${sfx}`, "Oreille de la jambe +, au-delà du bout +X — son bout entre dans le talon de la lame", body, [F3.ear, y0, z[0]], [b[0] - F3.ear, t, h]),
    prism(`lame${sfx}`, `Lame ${fr(b[1] - b[0])} mm — usinée, nez chanfreiné ; elle entre dans la pince du CORE suivant`, body, [[b[0], y0], [b[1], y0], [b[1], tip - cl], [b[1] - c, tip], [b[0] + c, tip], [b[0], tip - cl]], z),
    box(`talon${sfx}`, "Talon de la lame — le bout de l'oreille y repose ; brasé dessous et au bout", body, [heel, y0 - F3.heel, z[0]], [b[1] - heel, F3.heel, h])];
}
/** The fork and its ear, on a − leg whose contact face is at y = face (the ear behind it, the jaws in front, toward +Y) : each jaw with the housing
    of its band and a chamfer at its mouth. */
export function forkFeatures(body, face, t, o = {}) {
  const z = F3.z.jaw, h = z[1] - z[0], Y = F3.y, sfx = o.sfx || "", D = face + Y.depth, [m, ml] = F3.lead.mouth, a = F3.jawIn, e = F3.jawOut;
  const groove = (id, name, x) => box(id, name, body, [x[0], face + Y.band[0] - 0.2, F3.z.louv[0] - 0.2], [x[1] - x[0], Y.band[1] - Y.band[0] + 0.4, F3.z.louv[1] - F3.z.louv[0] + 0.4], "cut");
  return [box(`oreille_moins${sfx}`, "Oreille de la jambe −, jusqu'à la pince", body, [F3.ear, face, F3.z.leg[0]], [a[0] - F3.ear, t, F3.z.jaw[1] - F3.z.leg[0]]),
    prism(`machoire_int${sfx}`, "Mâchoire intérieure de la pince, sa bouche chanfreinée", body, [[a[0], face], [a[1] - m, face], [a[1], face + ml], [a[1], D], [a[0], D]], z),
    prism(`machoire_ext${sfx}`, "Mâchoire extérieure de la pince, sa bouche chanfreinée", body, [[e[0], face + ml], [e[0] + m, face], [e[1], face], [e[1], D], [e[0], D]], z),
    box(`fond_pince${sfx}`, "Fond de la pince — relie les deux mâchoires", body, [a[0], D - Y.bottom, z[0]], [e[1] - a[0], Y.bottom, h]),
    groove(`logement_int${sfx}`, `Logement de la bande, ${fr(F3.groove)} mm de profondeur — mâchoire intérieure`, [F3.louvIn[0], a[1]]),
    groove(`logement_ext${sfx}`, `Logement de la bande, ${fr(F3.groove)} mm de profondeur — mâchoire extérieure`, [e[0], F3.louvOut[1]])];
}

/** The laminated busbar of concept 1, with its blade (+ leg) and its fork (− leg). lam : the part of concept 1 ; o : { Y, ins, t } */
export function laminateC3(lam, o) {
  const p = JSON.parse(JSON.stringify(lam)), Yp = o.Y + o.ins + o.t, Ym = -(o.ins + o.t), feats = p.features.filter((f) => f.op !== "interfaces");
  p.features = [...feats, ...bladeFeatures("plus", Yp, o.t), ...forkFeatures("moins", Ym, o.t), { op: "interfaces" }];
  p.function = "Les deux pôles du CORE en une pièce laminée posée sur le dessus des cellules ; ses jambes pliées à 90° le long des grands côtés. Concept 3 : la jambe + porte une lame au bout +X, la jambe − une pince ; la lame d'un CORE entre dans la pince du suivant — c'est le contact série.";
  p.notes = [...p.notes.filter((n) => !/^Les jambes sont nues/.test(n)),
    `Concept 3 — le contact série : au-delà du bout +X, la jambe + se prolonge en oreille ; au bout, une lame de cuivre de ${fr(F3.blade[1] - F3.blade[0])} × ${fr(F3.z.leg[1] - F3.z.leg[0])} mm, usinée et brasée (une borne rapportée, comme en font les fabricants de busbars laminés — à voir avec eux), court le long de Y et dépasse la face de ${F3.y.tip} mm. La jambe − porte la pince : deux mâchoires de ${fr(F3.jawIn[1] - F3.jawIn[0])} mm, son fond à ${F3.y.depth} mm de la face ; chaque mâchoire a le logement de sa bande, ${fr(F3.groove)} mm de profondeur, et laisse ${fr(F3.play)} mm d'air contre la lame — la lame est guidée, la bande ne travaille que sur sa hauteur.`,
    `Les entrées : un nez de ${fr(F3.lead.blade[0])} mm par face sur ${F3.lead.blade[1]} mm au bout de la lame, une bouche de ${fr(F3.lead.mouth[0])} mm sur ${fr(F3.lead.mouth[1])} mm à chaque mâchoire (exemples — la fiche de la bande donne le chanfrein qu'elle demande).`,
    `La brasure : le bout de l'oreille (${fr(o.t)} mm) repose sur ${fr(F3.lap)} mm sur le talon de la lame (${fr(F3.heel)} mm d'épaisseur) et bute sur la lame : brasé dessous et au bout, environ ${Math.round((F3.lap + o.t) * (F3.z.leg[1] - F3.z.leg[0]))} mm² de joint pour 360 A, 1,3 A/mm² (brasure à l'argent, exemple ; sa tenue au cyclage thermique est à essayer).`,
    "La lame est de 2,5 mm, pas l'oreille pliée de 2 mm : 2 × 63 mm, c'est 2,86 A/mm² à 360 A, au-dessus du critère de 2,5 A/mm² du calcul « busbar » ; 2,5 × 63 mm le tient (calcul gardé dans le projet).",
    "Les jambes se touchent encore, face contre face — même potentiel, sans effort défini : le courant passe par la lame et ses lamelles. Elles restent argentées là où les plages LV et les lamelles travaillent ; la lame et les mâchoires portent leurs chanfreins d'entrée."];
  return p;
}
/** The pair of louvred bands of a fork, one part : drawn in the fork of a − leg whose face is at y = face. */
export function louvrePart(face) {
  const Y = F3.y, z = F3.z.louv, band = (id, name, x) => box(id, name, id, [x[0], face + Y.band[0], z[0]], [x[1] - x[0], Y.band[1] - Y.band[0], z[1] - z[0]]);
  const body = (label) => ({ material: "CU-C110", kind: "conductor", net: "CORE-", label });
  const n = Math.floor((z[1] - z[0]) / F3.band.p + 1e-9);
  return { dw: "part/1", id: "BM3-LAMELLES", name: "Bandes à lamelles de la pince", family: "contact", process: "purchased", material: "CU-C110", revision: "A", params: {},
    bodies: { bande_int: body("Bande côté mâchoire intérieure"), bande_ext: body("Bande côté mâchoire extérieure") },
    features: [band("bande_int", "Bande à lamelles — mâchoire intérieure", F3.louvIn), band("bande_ext", "Bande à lamelles — mâchoire extérieure", F3.louvOut)], interfaces: [],
    function: "Les deux bandes à lamelles d'une pince : elles pressent les deux faces de la lame du CORE précédent et portent ses 360 A ; leur effort reste dans la pince.",
    notes: [`Deux bandes de ${F3.band.w} × ${fr(z[1] - z[0])} mm, debout dans la pince, dessinées à leur hauteur de travail de ${fr(F3.band.h)} mm : ${n} lamelles chacune au pas de ${fr(F3.band.p)} mm. L'enveloppe est celle de la Weftron LOUVER_tron 112, les valeurs d'une lamelle celles de la Stäubli MULTILAM LA-CU (${F3.band.Il} A, ${F3.band.Rl} µΩ, ${F3.band.Fl} N) — lues à l'itération 9 ; la fiche du type choisi fait foi.`,
      `Une bande à lamelles flotte dans son logement (The MULTILAM Principle, p. 22) : ici une rainure de ${fr(F3.groove)} mm dans chaque mâchoire, 0,2 mm plus longue et plus large que la bande (exemple — la fiche de la bande donne son logement).`,
      `La fiche de la LOUVER_tron 112 (rev03, p. 2, lue) : effort de contact de ${F3.band.F112[0]} à ${F3.band.F112[1]} N par pont selon la hauteur de travail, plus de 40 A par pont d'habitude selon l'application, « sliding and rotating contact feasibility ». Les mâchoires sont vérifiées pour l'effort le plus fort (calcul gardé dans le projet).`,
      "L'effort pour entrer la lame n'est publié ni sur cette fiche ni dans ce qui a été lu (la page de Stäubli refuse les lectures automatiques) : à demander au fabricant ou à mesurer. On l'entre CORE après CORE, à la pose : une seule pince à la fois."] };
}

/** The terminals of concept 1, the − one with a blade (it acts as a + leg), the + one with a fork (as a − leg). Each is drawn in the frame of the
    CORE it touches : the − terminal in that of CORE 1, the + terminal in that of CORE 8. o : { Y, ins, t, pitch } */
export function terminalsC3(neg, pos, o) {
  const N = JSON.parse(JSON.stringify(neg)), P = JSON.parse(JSON.stringify(pos)), Yp = o.Y + o.ins + o.t, Ym = -(o.ins + o.t), add = (part, feats, note) => {
    part.features = [...part.features, ...feats]; part.notes = [...part.notes, note]; };
  add(N, bladeFeatures("plaque", Yp - o.pitch, o.t), "Concept 3 : comme une jambe +, la borne − porte une oreille et une lame au bout +X ; la lame entre dans la pince du CORE 1.");
  add(P, forkFeatures("plaque", Ym + o.pitch, o.t), "Concept 3 : comme une jambe −, la borne + porte une oreille et une pince au bout +X ; la lame du CORE 8 y entre, entre deux bandes à lamelles.");
  return { neg: N, pos: P };
}

/** The forces of the top lid in concept 3 (examples) : the disc springs only hold the stack ; the pads of the bridge are those of concept 1. m : the
    mass of the stack (kg, its cells only — the lower bound) → { stack, padA, padB, total, perScrew, joint, g } */
export function lidForcesC3(m, o = {}) {
  const stack = o.stack ?? 4 * 100, padA = o.pads ?? 2 * 150, padB = o.pads ?? 2 * 150, total = stack + padA + padB, joint = stack + padA;
  return { stack, padA, padB, total, perScrew: total / 4, joint, g: joint / (m * 9.81) };
}
/** The pressure plate of concept 3 : the plate of concept 1 and four columns toward the cap, a pilot on each for its disc springs. L : the layout of
    the top lid ; S : where the springs stand ([x, z]) ; h : the height of a stack of disc springs. */
export function pressPlateC3(L, S, h) {
  const top = r3(L.ring1 - h), feats = [box("plaque", "Plaque", null, [3, L.plate0, -3], [86.8, 3, 63])];
  S.forEach(([x, z], k) => feats.push({ op: "cylinder", id: `colonne_${k + 1}`, name: `Colonne ${k + 1} — l'appui de ses rondelles ressorts`, at: [x, L.plate1, z], d: 10, h: r3(top - L.plate1), axis: "Y" },
    { op: "cylinder", id: `pilote_${k + 1}`, name: `Pilote ${k + 1} — centre les rondelles`, at: [x, top, z], d: 5, h: r3(h - 0.5), axis: "Y" }));
  return { dw: "part/1", id: "BM-PRESS-PLATE", name: "Plaque de pression de la pile", family: "molded", process: "injection_molding", material: "PA66-GF30", revision: "A", params: {}, features: feats, interfaces: [],
    function: "Tient la pile des 8 CORE contre le couvercle du fond : quatre colonnes portent chacune un empilage de rondelles ressorts, qui s'appuie sous le couvercle.",
    notes: ["PA66-GF30 (exemple) ; isolante, elle appuie sur la plaque d'appui de la borne +.", `Concept 3 : les colonnes remplacent les ressorts à spires de 23 mm ; il reste ${fr(h)} mm de rondelles. Le couvercle pourrait donc raccourcir le module — pas fait dans ce premier jet.`] };
}
/** A stack of disc springs (Belleville washers), drawn as its envelope along Y from y = 0. */
export function discPart(h, force) {
  return { dw: "part/1", id: "BM3-DISCS", name: "Rondelles ressorts de la plaque de pression", family: "spring", process: "purchased", material: "SS-304", revision: "A", params: {},
    features: [{ op: "cylinder", id: "rondelles", name: "Empilage de rondelles ressorts (enveloppe)", at: [0, 0, 0], d: 10, h, axis: "Y" }, { op: "cylinder", id: "alesage", name: "Alésage", at: [0, -0.1, 0], d: 5.2, h: h + 0.2, axis: "Y", mode: "cut" }], interfaces: [],
    function: `Un des quatre empilages qui tiennent la pile : ${force} N chacun (exemple), sur ${fr(h)} mm.`,
    notes: ["Rondelles ressorts Ø10 × Ø5,2 (une taille d'usage), empilées en série et en parallèle pour l'effort et la course voulus : la série, l'épaisseur et la courbe effort-course se lisent au catalogue — rien n'a été lu ici. Dessinées comme leur enveloppe.",
      "Un ressort fin et compact (JP) : il ne porte aucun courant, il ne fait que tenir la pile — le contact est dans les pinces."] };
}

/** The calculations of concept 3, kept on its branch : the louvred bands of a fork, the blade as a bar, the screws of the lids with the new forces. */
export function calcsC3(I, F) {
  const keep = (id, name, model, part, inputs, why) => { const r = run(model, { ...sessionDefaults(model), ...inputs }); return { id, name, model, part, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T18:00:00.000Z", why }; };
  const nb = Math.floor((F3.z.louv[1] - F3.z.louv[0]) / F3.band.p + 1e-9), b = F3.blade[1] - F3.blade[0], h = F3.z.leg[1] - F3.z.leg[0];
  return [keep("phy-bm3-fork", `Pince du joint entre deux CORE — 2 bandes × ${nb} lamelles, ${I} A`, "louvre_strip", "BM3-LAMELLES",
    { strips: 2, L: F3.z.louv[1] - F3.z.louv[0], p: F3.band.p, Il: F3.band.Il, Rl: F3.band.Rl, Fl: F3.band.Fl, h: F3.band.h, tol: 0.05, I },
    `Les deux bandes d'une pince, ${fr(F3.z.louv[1] - F3.z.louv[0])} mm de long chacune, contre les deux faces de la lame. La hauteur est l'écart entre la lame et une mâchoire, ${fr(F3.band.h)} mm, à ± 0,05 mm (pince et lame usinées, exemple). « L'effort pour fermer le joint » est ici celui que les mâchoires tiennent entre elles : il ne sort pas de la pince.`),
  keep("phy-bm3-blade", `Lame du joint — ${fr(b)} × ${h} mm, ${I} A`, "busbar", "BM-BB-LAM", { w: h, t: b, L: 20, I, Ta: 40, Tmax: 60 },
    `La lame, de l'oreille aux lamelles : la plus petite section du joint. Une oreille simplement pliée (2 mm) donnait 2,86 A/mm² et un avertissement ; ${fr(b)} mm le tient. Barre seule à l'air libre : la lame est courte et serrée entre deux bandes, qui la refroidissent.`),
  keep("phy-bm3-jaw", `Mâchoire de la pince — ${nb} lamelles à ${F3.band.F112[1]} N`, "beam_cantilever_udl", "BM-BB-LAM", { mat: "CU-C110", L: F3.y.depth - F3.y.bottom, section: "rect", b: F3.z.jaw[1] - F3.z.jaw[0], h: F3.jawIn[1] - F3.jawIn[0] - F3.groove, F: nb * F3.band.F112[1], dlim: 0.1, sf: 1.5 },
    `La mâchoire extérieure ne tient que par le fond de la pince : une poutre encastrée de ${F3.y.depth - F3.y.bottom} mm, de la hauteur de la pince, épaisse de ce qui reste derrière le logement (${fr(F3.jawIn[1] - F3.jawIn[0] - F3.groove)} mm). Charge : ${nb} ponts à ${F3.band.F112[1]} N, le plus fort de la fiche de la 112. Flèche admise 0,1 mm : la bande doit rester entre 1,5 et 1,9 mm, la lame et la pince étant à ± 0,05 mm.`),
  keep("phy-bm3-screws", `Vis des couvercles dans le boîtier — ${F.perScrew} N par vis`, "plastic_screw", "BM-CASING", { mat: "PC", d: 4, Dp: 3.4, L: 8, Db: 8.4, F: F.perScrew, sf: 3 },
    `Concept 3 : la pile n'est plus pressée pour ses contacts ; les rondelles en donnent ${F.stack} N${F.padA + F.padB ? `, les plots du pont ${F.padA + F.padB} N` : " (le pont du couvercle n'est plus pressé : ses lames glissent dans leurs pinces)"} — ${F.total} N sur l'anneau du haut, ${F.perScrew} N par vis EVO PT 40. Même trou, même prise et même lobe qu'au concept 1 ; coefficient de 3 (le PC flue sous charge tenue).`)];
}
