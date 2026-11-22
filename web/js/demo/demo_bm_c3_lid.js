/* DynamiteOrbit — BM 8s8p - 21700, CONCEPT 3 : the TOP LID in blade and fork (JP, 22 novembre 2026, by menu : « Couvercle du haut », then
   « Pinces côté module » — the live side is female : the lid off, the copper under voltage is recessed).
   What changes from concept 1 at the top end :
   - FORK A on the back of the + terminal, FORK B on the back of the tab of the return busbar : horizontal jaws, each with the housing of its
     louvred band, opening toward the lid ;
   - the lid carries a RIGID copper BRIDGE : two horizontal blades (A and B) joined by a web against the cap ; closing the lid plugs both.
     The blades slide in their forks : the stack of the 8 CORE may be longer or shorter, the bridge does not care — no flexible strap, no
     spring on a pad any more ;
   - the tab of the return busbar comes 6.6 mm nearer the stack (the window of the casing follows), so that fork B fits before the cap.
   Every size is an EXAMPLE. Frame of the module (CORE 1 at the origin, the casing along Y). Pure. */

import { F3 } from "./demo_bm_c3.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");
const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });

/** The two forks of the top end and the bridge, in numbers (module frame). o : { rootA (the back face of the + terminal), rootB (the back face of
    the tab), cap (the inner face of the cap) } */
export function lidForks(o) {
  const t = 2.5, jaw = F3.jawIn[1] - F3.jawIn[0], g = F3.groove, play = F3.play, bandH = F3.band.h, web = 4;
  const stack = (z0) => ({ jawLo: [z0, z0 + jaw], bandLo: [z0 + jaw - g, z0 + jaw - g + bandH], blade: [z0 + jaw + play, z0 + jaw + play + t], jawHi: [z0 + jaw + 2 * play + t, z0 + 2 * jaw + 2 * play + t] });
  const A = { root: o.rootA, z: stack(66.5), band: [2, 14], mouth: 15, tip: 1.5 }, B = { root: o.rootB, z: stack(27.6), band: [1.5, 13.5], mouth: 14.5, tip: 1 };
  for (const k of [A, B]) k.z.bandHi = [k.z.jawHi[0] - bandH + g, k.z.jawHi[0] + g];
  return { t, x: [20, 78], bandX: [24, 74], webX: [26, 78], A, B, web: [r3(o.cap - web), o.cap], p: F3.band.p };
}

/** The features of a fork whose root is the face y = root (the jaws toward +Y). dy : shift into the frame of the part. */
export function lidForkFeatures(K, k, body, tag, dy = 0) {
  const y0 = k.root + dy, Z = k.z, [m, ml] = F3.lead.mouth, x = K.x, len = k.mouth, bx = K.bandX;
  const jaw = (id, name, z) => box(id, name, body, [x[0], y0, z[0]], [x[1] - x[0], len, z[1] - z[0]]);
  const groove = (id, name, z) => box(id, name, body, [bx[0] - 0.2, y0 + k.band[0] - 0.2, z[0]], [bx[1] - bx[0] + 0.4, k.band[1] - k.band[0] + 0.4, z[1] - z[0]], "cut");
  const mouth = (id, z, up) => { const f = up ? z[0] : z[1], e = y0 + len + 0.01, s = up ? 1 : -1;      // a triangle in the plane Y Z, pushed along X : the chamfer of the inner face at the mouth
    return { op: "extrude", id, name: `Bouche chanfreinée (${fr(m)} × ${fr(ml)} mm) — mâchoire ${up ? "haute" : "basse"}`, body, plane: "YZ", profile: { poly: [[y0 + len - ml, f], [e, f - s * 0.01], [e, f + s * m]].map((q) => q.map(r3)) }, at: r3(x[0] - 0.1), length: r3(x[1] - x[0] + 0.2), mode: "cut" }; };
  return [jaw(`pince_${tag}_bas`, `Pince ${tag.toUpperCase()} — mâchoire basse`, Z.jawLo), jaw(`pince_${tag}_haut`, `Pince ${tag.toUpperCase()} — mâchoire haute`, Z.jawHi),
    groove(`logement_${tag}_bas`, `Logement de la bande basse de la pince ${tag.toUpperCase()}`, [Z.bandLo[0], Z.jawLo[1] + 0.01]), groove(`logement_${tag}_haut`, `Logement de la bande haute de la pince ${tag.toUpperCase()}`, [Z.jawHi[0] - 0.01, Z.bandHi[1]]),
    mouth(`bouche_${tag}_bas`, Z.jawLo, false), mouth(`bouche_${tag}_haut`, Z.jawHi, true)];
}

/** The rigid bridge of the lid : blade A, blade B, the web against the cap. */
export function bridgeC3(K) {
  const blade = (k, tag) => box(`lame_${tag}`, `Lame ${tag.toUpperCase()} — ${fr(K.t)} × ${K.x[1] - K.x[0]} mm, dans la pince ${tag.toUpperCase()}`, "pont", [K.x[0], k.root + k.tip, k.z.blade[0]], [K.x[1] - K.x[0], K.web[1] - (k.root + k.tip), K.t]);
  const zw = [K.B.z.blade[0], K.A.z.blade[1]];
  return { dw: "part/1", id: "BM-BRIDGE", name: "Pont de contact du couvercle du haut", family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params: {},
    bodies: { pont: { material: "CU-C110", kind: "conductor", net: "PACK+", label: "Pont rigide — deux lames et leur âme" } },
    features: [blade(K.A, "a"), blade(K.B, "b"), box("ame", "Âme du pont, contre le couvercle", "pont", [K.webX[0], K.web[0], zw[0]], [K.webX[1] - K.webX[0], K.web[1] - K.web[0], zw[1] - zw[0]])], interfaces: [],
    function: "Ferme la boucle du courant du module quand le couvercle est posé : la lame A entre dans la pince de la borne +, la lame B dans celle du busbar de retour ; une âme de cuivre rigide les relie.",
    notes: [`Concept 3 : deux lames de ${fr(K.t)} × ${K.x[1] - K.x[0]} mm (145 mm², 2,5 A/mm² à 360 A) et une âme de ${fr(K.web[1] - K.web[0])} × ${K.webX[1] - K.webX[0]} mm, d'une pièce (usinée, ou découpée et brasée — exemple). Les lames glissent dans leurs pinces : la longueur de la pile des 8 CORE peut varier, le pont ne la sent pas — plus de shunt souple, plus de ressort de plot.`,
      "Fixé dans le couvercle (deux vis dans des inserts, non dessinées) ; l'âme laisse passer l'arbre de la came à gauche. Couvercle retiré : le pont part avec lui, la boucle est ouverte (sectionneur de service), et le cuivre sous tension du module reste en retrait dans ses pinces.",
      "L'effort pour fermer le couvercle — entrer les deux lames à la fois — n'est pas publié dans ce qui a été lu : c'est la came qui le donne ; à mesurer.",
      "Une pièce de spécialiste : elle ne se joue pas dans l'atelier de fab."] };
}

/** The four louvred bands of the two forks of the top end, one part, horizontal. */
export function lidBandsPart(K) {
  const body = (net, label) => ({ material: "CU-C110", kind: "conductor", net, label }), bodies = {}, features = [];
  for (const [k, tag] of [[K.A, "a"], [K.B, "b"]]) for (const lvl of ["bas", "haut"]) {
    const id = `bande_${tag}_${lvl}`, z = lvl === "bas" ? k.z.bandLo : k.z.bandHi;
    bodies[id] = body("PACK+", `Bande ${lvl} de la pince ${tag.toUpperCase()}`);
    features.push(box(id, `Bande à lamelles ${lvl} — pince ${tag.toUpperCase()}`, id, [K.bandX[0], k.root + k.band[0], z[0]], [K.bandX[1] - K.bandX[0], k.band[1] - k.band[0], z[1] - z[0]]));
  }
  const n = Math.floor((K.bandX[1] - K.bandX[0]) / K.p + 1e-9);
  return { dw: "part/1", id: "BM3-LAMELLES-HAUT", name: "Bandes à lamelles des pinces du bout haut", family: "contact", process: "purchased", material: "CU-C110", revision: "A", params: {}, bodies, features, interfaces: [],
    function: "Les bandes des deux pinces du bout haut : deux par pince, contre les deux faces de chaque lame du pont.",
    notes: [`Quatre bandes de 12 × ${K.bandX[1] - K.bandX[0]} mm, à plat, ${n} lamelles chacune — le même type que dans les joints entre CORE (enveloppe Weftron LOUVER_tron 112 ; valeurs d'une lamelle de la Stäubli MULTILAM LA-CU).`] };
}
