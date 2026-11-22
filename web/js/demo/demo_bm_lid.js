/* DynamiteOrbit — BM 8s8p - 21700, iteration 11 a : the RETURN BUSBAR and the TOP LID (JP, 22 novembre 2026 : « un busbar le long du boîtier
   extrudé qui se connecte aux 2 couvercles… le 2e couvercle vient fermer la boucle de courant interne, pousse sur les cores pour écraser les
   contacts LV et HV un sur l'autre en série et se lock avec un latch rotatif ; l'interface des 2 couvercles est vissée au casing central… soit
   métal ou plastique robuste supportant les efforts du latch » ; « Go, c'est bien les modifs » — the choices offered : a quarter-turn cam latch,
   the interface rings in machined aluminium).
   What the top lid does, as drawn :
   - an interface RING (aluminium 6061-T6, machined) screwed to the end of the casing by four screws for plastics in its ports ; two tongues
     run into the casing along its side walls and end in a LIP each ;
   - a CAP (PA66-GF30) and a quarter-turn CAM LATCH : a lever outside, a shaft through the cap, an arm inside ; turned a quarter, the arm bears
     on the two lips and holds the cap against the ring ;
   - between the cap and what it presses, SPRINGS : four on an insulating PRESSURE PLATE that pushes the + terminal — the stack of the 8 CORE
     is held by springs, whatever the tolerances of its 8 joints — and two on each CONTACT PAD ;
   - the loop closed by pressure, like the joints : pad A on the bare land of the + terminal, pad B on the tab of the return busbar, each face
     against face (iteration 12 : planar contacts, no louvred strip), joined by a flexible laminated strap : opening the lid opens the circuit of
     the module, as a service disconnect does.
   The return busbar : 50 × 4 mm of copper in the channel of the casing, from the bottom lid (iteration 11 b) to the top end, where it rises
   through a window milled in the floor into a tab that faces the lid.
   Every part is drawn in the frame of the module (CORE 1 at the origin, the casing along Y) ; every size and every force is an EXAMPLE, said on
   the parts. */

import { RETURN, caseSection } from "./demo_bm_case.js";
import { planarJoint } from "./demo_bm_contacts.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");
const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });
const cylY = (id, name, body, at, d, h, mode) => ({ op: "cylinder", id, name, ...(body ? { body } : {}), at: at.map(r3), d, h: r3(h), axis: "Y", ...(mode ? { mode } : {}) });

/** The forces of the top lid, in one place (examples, said) : what the springs give ; what every joint of the stack then carries (the plate and
    pad A both push the + terminal toward the bottom lid) ; what the latch takes ; what each screw of the ring then pulls ; and the bound of the
    resistance of the planar joints, after Holm (demo_bm_contacts.js planarJoint). I : the current of the module. → numbers, N, Ω */
export function lidForces(I = 360) {
  const stack = 4 * 200, padA = 2 * 150, padB = 2 * 150, total = stack + padA + padB, joint = stack + padA;
  return { stack, padA, padB, total, perScrew: total / 4, joint, jointR: planarJoint(joint, I), padAR: planarJoint(padA, I), padBR: planarJoint(padB, I) };
}
/** The planes of the top end, along Y (module frame), from the + terminal (its land) to the cap. o : { land (the back face of the + terminal),
    end (the end of the casing) } → numbers */
export function topLayout(o) {
  const S = caseSection(o.env), G = 0, cav = S.cavity, c0 = caseSection().cavity;      // iteration 12 : the pads lie on their faces ; c0 : the cavity of concept 1, where the lips stay
  const L = { lipX: [c0.x0, o.lipX1 ?? c0.x1], out: { x0: r3(S.ports[0][0] - S.R), x1: r3(S.ports[1][0] + S.R) }, land: o.land, end: o.end, padA: r3(o.land + G), plate0: r3(o.land + 3), tab: r3(o.end - 10.3), ring1: r3(o.end + 6), cap1: r3(o.end + 9), S, G, cav };
  /* iteration 12 : the tab of the return busbar 1.7 mm nearer the lid — pad B lies on it where it stood on its louvred strip */
  L.plate1 = r3(L.plate0 + 3); L.padA1 = r3(L.padA + 3); L.tab1 = r3(L.tab + 4); L.padB = r3(L.tab1 + G); L.padB1 = r3(L.padB + 3.6); L.strap1 = r3(L.padB1 + 4);
  L.lip0 = r3(L.end - 9); L.lip1 = r3(L.lip0 + 3); L.arm1 = r3(L.lip1 + 3);
  L.tabTop = 40; L.bar = { x0: r3(S.xm - RETURN.w / 2), x1: r3(S.xm + RETURN.w / 2), z0: r3(S.channel.z0 + 0.5), z1: r3(S.channel.z1 - 0.5) };
  /* the cam shaft stands aside : the shunt, 40 mm wide, comes down in the middle */
  L.springs = { plate: [[8, 5], [84.8, 5], [8, 44], [84.8, 44]], padA: [[30, 73], [62, 73]], padB: [[61, 4], [61, 22]] };
  L.shaft = [20, 56];
  return L;
}

/** The return busbar : the bar in the channel, its tab raised at the top end, a hole at the bottom end for the contactor. o : { y0 (its bottom end) } */
export function returnBar(L, o) {
  const B = L.bar;
  return { dw: "part/1", id: "BM-RETURN-BB", name: "Busbar de retour du module", family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params: {},
    bodies: { main: { material: "CU-C110", kind: "conductor", net: "PACK+", label: "Busbar de retour" } },
    features: [box("barre", "Barre dans le canal du boîtier", "main", [B.x0, o.y0, B.z0], [RETURN.w, L.tab1 - o.y0, RETURN.t]),
      box("languette", "Languette relevée au bout haut — la plage du contact B", "main", [B.x0, L.tab, B.z0], [RETURN.w, RETURN.t, L.tabTop - B.z0]),
      { op: "cylinder", id: "trou_bas", name: "Trou de la liaison au contacteur (M10, exemple)", body: "main", mode: "cut", d: 10.5, h: 10, at: [41.4, r3(o.y0 + 4.5), r3(B.z0 - 1)], axis: "Z" }],
    interfaces: [],
    function: "Ramène le courant du module, 360 A, du bout + au couvercle du fond, le long du boîtier, dans son canal fermé ; au bout haut, sa languette reçoit le contact B du couvercle du haut.",
    notes: [`Cuivre C110 de ${RETURN.w} × ${RETURN.t} mm, dimensionné par le modèle « busbar » de l'outil (calcul gardé dans le projet) ; plié à 90° au bout haut — rayon intérieur d'au moins une épaisseur (exemple), non dessiné.`,
      "Argenté sur la plage de la languette, là où le plot B se pose, face contre face ; nu ailleurs, isolé par le boîtier (paroi de 2,5 mm de PC).",
      "Le bout bas se boulonne à la barre du contacteur, dans le couvercle du fond : trou Ø10,5 pour une vis M10, exemple.",
      "Une pièce de spécialiste (busbar) : elle ne se joue pas dans l'atelier de fab."] };
}

/** The interface ring of the top lid : aluminium, screwed to the casing ; its window ; its two tongues and their lips. */
export function topRing(L) {
  const S = L.S, c = L.cav, out = { ...L.out, z0: S.keel.z0, z1: r3(S.ports[2][1] + S.R) }, at = S.ports.map((p) => [p[0], p[1]]), [lx0, lx1] = L.lipX;
  return { dw: "part/1", id: "BM-LID-RING-TOP", name: "Anneau d'interface du couvercle du haut", family: "machined", process: "cnc_milling", material: "AL6061-T6", revision: "A", params: {},
    features: [box("bride", "Bride", null, [out.x0, L.end, out.z0], [out.x1 - out.x0, 6, out.z1 - out.z0]),
      box("fenetre", "Fenêtre — la section de la cavité", null, [c.x0, L.end - 1, c.z0], [c.x1 - c.x0, 8, c.z1 - c.z0], "cut"),
      box("langue_g", "Languette gauche, le long de la paroi", null, [lx0, L.lip0, 50], [2.5, L.end - L.lip0, 12]), box("levre_g", "Lèvre gauche — l'appui du bras de la came", null, [lx0, L.lip0, 50], [7.5, 3, 12]),
      box("langue_d", "Languette droite", null, [lx1 - 2.5, L.lip0, 50], [2.5, L.end - L.lip0, 12]), box("levre_d", "Lèvre droite — l'appui du bras de la came", null, [lx1 - 7.5, L.lip0, 50], [7.5, 3, 12]),
      { op: "hole", id: "vis", name: "Passages des quatre vis du boîtier", face: "+Y", at, d: 4.5, depth: "through" }],
    interfaces: [],
    function: `Prend l'effort du latch (${lidForces().total} N) et le passe au boîtier par ses quatre vis, ${lidForces().perScrew} N chacune : la came du couvercle s'appuie sur ses deux lèvres.`,
    notes: ["Aluminium 6061-T6 usiné (choix de JP par menu : une interface qui ne flue pas sous l'effort permanent des ressorts — le PC du boîtier et les plastiques fluent avec le temps et la chaleur) ; coulé sous pression en série (exemple).",
      "Quatre vis EVO PT 40 dans les trous du boîtier ; entre un trou et la fenêtre, 2 mm de matière : pas de lamage — les têtes se logent dans le couvercle.",
      "Les lèvres sont droites sur le dessin ; la rampe de la came — ce qui tire le couvercle de quelques millimètres en tournant — est à dessiner avec le fournisseur du latch."] };
}

/** The cap, the cam latch, the pressure plate. */
export function topCap(L) {
  return { dw: "part/1", id: "BM-LID-TOP", name: "Couvercle du haut", family: "molded", process: "injection_molding", material: "PA66-GF30", revision: "A", params: {},
    features: [box("plaque", "Plaque du couvercle", null, [L.out.x0, L.ring1, L.S.keel.z0], [r3(L.out.x1 - L.out.x0), 3, r3(L.S.ports[2][1] + L.S.R - L.S.keel.z0)]), cylY("arbre", "Passage de l'arbre de la came", null, [L.shaft[0], L.ring1 - 1, L.shaft[1]], 8.6, 5, "cut"),
      ...L.S.ports.map((q, k) => cylY(`tete_${k + 1}`, `Logement de la tête de vis ${k + 1}`, null, [q[0], L.ring1 - 0.5, q[1]], 9, 3, "cut"))],
    interfaces: [],
    function: "Ferme le bout haut du module ; porte la came, les ressorts et le pont de contact ; tenu contre l'anneau par la came.",
    notes: [`PA66-GF30 de 3 mm (exemple) : isolant — les ressorts des plots touchent des pièces au potentiel PACK+. Sous l'effort des ressorts (${lidForces().total} N), la plaque fléchit : des nervures sont à dessiner, et à vérifier en simulation.`,
      "Le couvercle retiré, le pont de contact part avec lui : le circuit du module est ouvert (sectionneur de service). Le BMS central doit le voir avant tout courant — à prévoir à l'itération 11 b."] };
}
export function camLatch(L) {
  const [x, z] = L.shaft;
  return { dw: "part/1", id: "BM-LATCH-CAM", name: "Came quart de tour du couvercle", family: "machined", process: "purchased", material: "SS-304", revision: "A", params: {},
    features: [cylY("arbre", "Arbre", null, [x, L.lip1, z], 8, L.cap1 + 4 - L.lip1), box("bras", "Bras de came, en appui sur les lèvres de l'anneau", null, [4, L.lip1, 52], [84, 3, 8]),
      box("levier", "Levier, dehors", null, [x - 25, L.cap1 + 0.5, 52], [50, 3.5, 8])],
    interfaces: [],
    function: "Tient le couvercle : un quart de tour du levier amène le bras sous les lèvres de l'anneau et tire le couvercle contre lui.",
    notes: ["Dessinée verrouillée : le bras à l'horizontale, en appui sur les deux lèvres. Déverrouillée (levier vertical), le bras passe entre les lèvres et le couvercle sort.",
      "Inox, ensemble arbre, bras et levier à faire faire (exemple) ; la rampe qui tire le couvercle, la butée du quart de tour et un verrou du levier (goupille, plomb de service) sont à dessiner avec le fournisseur."] };
}
export function pressurePlate(L) {
  return { dw: "part/1", id: "BM-PRESS-PLATE", name: "Plaque de pression de la pile", family: "molded", process: "injection_molding", material: "PA66-GF30", revision: "A", params: {},
    features: [box("plaque", "Plaque", null, [3, L.plate0, -3], [86.8, 3, 63])], interfaces: [],
    function: "Répartit sur la plaque d'appui de la borne + l'effort des quatre ressorts : il presse les 8 joints du module en série, jusqu'aux butées.",
    notes: ["PA66-GF30, 3 mm (exemple) ; isolante : elle appuie sur la plaque d'appui de la borne +, sans toucher le cuivre."] };
}
/** A compression spring, drawn along Y from y0 over h. */
export function springPart(id, name, o) {
  return { dw: "part/1", id, name, family: "spring", process: "purchased", material: "SS-304", revision: "A", params: {},
    features: [{ op: "coil", id: "ressort", name: "Ressort", d: o.wire, r: r3((o.od - o.wire) / 2), h: r3(o.h - o.wire), turns: o.turns, at: [0, r3(o.wire / 2), 0], axis: "Y" }], interfaces: [],      // the wire's half-thickness at each end : the spring stands between its seats
    function: o.fn, notes: [`Ressort de compression Ø${fr(o.od)}, fil ${fr(o.wire)} mm, ${o.turns} spires, dessiné à sa longueur posée de ${fr(o.h)} mm ; effort visé : ${o.force} N à cette longueur (exemple) — à choisir dans un catalogue de ressorts, en inox pour ressorts.`] };
}
/** The contact bridge : pad A on the + terminal, pad B on the tab of the return busbar, the flexible strap between them. */
export function bridgePart(L) {
  const net = { material: "CU-C110", kind: "conductor", net: "PACK+" };
  return { dw: "part/1", id: "BM-BRIDGE", name: "Pont de contact du couvercle du haut", family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params: {},
    bodies: { plotA: { ...net, label: "Plot A — sur la borne +" }, tresse: { ...net, label: "Shunt souple (feuillards de cuivre laminés)" }, plotB: { ...net, label: "Plot B — sur le busbar de retour" } },
    features: [box("plot_a", "Plot A, face à la plage de la borne +", "plotA", [24, L.padA, 66.5], [45, 3, 13]),
      box("plot_b", "Plot B, face à la languette du busbar de retour", "plotB", [30, L.padB, -8], [40, L.padB1 - L.padB, 46]), box("plot_b_haut", "Plot B, talon du shunt", "plotB", [30, L.padB1, 30], [40, 4, 4]),
      box("shunt_h", "Shunt souple, 40 × 4 mm — le long du couvercle", "tresse", [30, L.plate0 + 0.25, 62.5], [40, L.strap1 - L.plate0 - 0.25, 4]),
      box("shunt_v", "Shunt souple, 40 × 4 mm — la descente vers le plot B", "tresse", [30, L.padB1, 34], [40, 4, 32.5])],
    interfaces: [],
    function: "Ferme la boucle du courant du module quand le couvercle est verrouillé : le plot A presse la plage de la borne +, le plot B la languette du busbar de retour, chacun face contre face, poussé par ses ressorts ; un shunt souple les relie.",
    notes: [`Deux plots, deux jeux de ressorts : la position de la borne + dépend des tolérances des 8 joints, celle de la languette du boîtier — chaque plot trouve sa face. Contacts plans, argentés : ${lidForces().padA} N par plot, soit au plus ${fr(lidForces().padAR.R * 1e6)} µΩ chacun selon Holm (une seule tache de contact, la borne haute ; à mesurer).`,
      "Shunt souple de 40 × 4 mm (160 mm²) : un empilage de feuillards de cuivre soudés à leurs bouts (soudure par diffusion, usage des busbars souples). 160 mm² est ce que le modèle « busbar » de l'outil demande pour 360 A sous 60 °C — barre seule à l'air libre : prudent ici, où le shunt est court et boulonné à des pièces plus grosses.",
      "Une pièce de spécialiste : elle ne se joue pas dans l'atelier de fab."] };
}

/** The top lid, its parts placed : ring, cap, latch, pressure plate, springs, bridge. at : (t) → placement */
export function topLidAssembly(L) {
  const at = (t, r = [0, 0, 0]) => ({ t: t.map(r3), r }), sp = (k, part, x, z, y0) => ({ id: k, part, fixed: true, placement: at([x, y0, z]) }), S = L.springs;
  return { dw: "assembly/1", id: "BM-LID-TOP-ASM", name: "Couvercle du haut, verrouillé", instances: [
    { id: "anneau", part: "BM-LID-RING-TOP", fixed: true, placement: at([0, 0, 0]) }, { id: "couvercle", part: "BM-LID-TOP", fixed: true, placement: at([0, 0, 0]) },
    { id: "came", part: "BM-LATCH-CAM", fixed: true, placement: at([0, 0, 0]) }, { id: "plaque", part: "BM-PRESS-PLATE", fixed: true, placement: at([0, 0, 0]) },
    { id: "pont", part: "BM-BRIDGE", fixed: true, placement: at([0, 0, 0]) },
    ...S.plate.map(([x, z], k) => sp(`ressort_p${k + 1}`, "BM-SPRING-PLATE", x, z, L.plate1)), ...S.padA.map(([x, z], k) => sp(`ressort_a${k + 1}`, "BM-SPRING-PAD-A", x, z, L.padA1)),
    ...S.padB.map(([x, z], k) => sp(`ressort_b${k + 1}`, "BM-SPRING-PAD-B", x, z, L.padB1))], mates: [] };
}

/** Every part of the top end. o : { land, end, y0 (bottom end of the return busbar) } → { layout, parts, assembly() } */
export function topEnd(o) {
  const L = topLayout(o), plateH = L.cap1 - 3 - L.plate1, aH = L.ring1 - L.padA1, bH = L.ring1 - L.padB1;
  const parts = [returnBar(L, o), topRing(L), topCap(L), camLatch(L), pressurePlate(L), bridgePart(L),
    springPart("BM-SPRING-PLATE", "Ressort de la plaque de pression", { od: 10, wire: 1.6, turns: 8, h: plateH, force: 200, fn: `Un des quatre ressorts qui pressent la pile des 8 CORE : ${lidForces().stack} N en tout (exemple) — chaque joint plan en porte ${lidForces().joint} N avec ceux du plot A.` }),
    springPart("BM-SPRING-PAD-A", "Ressort du plot A", { od: 8, wire: 1.2, turns: 8, h: aH, force: 150, fn: "Presse le plot A sur la plage de la borne + — et, par elle, la pile." }),
    springPart("BM-SPRING-PAD-B", "Ressort du plot B", { od: 8, wire: 1.2, turns: 4, h: bH, force: 150, fn: "Presse le plot B sur la languette du busbar de retour." })];
  return { layout: L, parts, assembly: () => topLidAssembly(L) };
}
