/* DesignWizard.ai — BM 8s8p - 21700, iteration 11 b : the BOTTOM LID (JP, 22 novembre 2026 : « celui du fond aura le connecteur LV et HV qui se
   connecte quand le BM est swappé dans sa cavité d'installation ou la station de recharge, et contient aussi [peut-être] la carte BMS
   principale, et le contacteur interne du BM… l'interface des 2 couvercles est vissée au casing central… métal ou plastique robuste » ;
   « Go, c'est bien les modifs » : the interface rings in machined aluminium).
   What the bottom lid holds, as drawn :
   - an interface RING (aluminium 6061-T6) screwed to the casing by its four screws for plastics, with a slot where the return busbar comes out,
     and four POSTS that run into the casing and take the push of the stack on the backing plate of the − terminal ;
   - a HOUSING (PA66-GF30) screwed to the ring, which holds :
   - the SWAP CONNECTOR, a blind-mate connector on the bottom face — two HV pins, six LV pins — drawn as a generic envelope : no series is
     chosen, none is copied ;
   - the CONTACTOR, a generic envelope with its two power studs : the return busbar (PACK+) comes to one, the other goes to the HV+ pin ;
   - the VOLUME kept for the central BMS board (JP : « peut-être ») : a board of 50 × 80 mm and its components — what the lid can hold, said ;
   - the copper straps : from the return busbar to the contactor, from the contactor to the HV+ pin, from the − terminal (its two studs) to the
     HV− pin.
   Frame of the module (CORE 1 at the origin, the casing along Y, its bottom end at y = CASE_Y0). Every size is an EXAMPLE, said on the parts. */

import { caseSection } from "./demo_bm_case.js";

const r3 = (v) => Math.round(v * 1000) / 1000;
const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });
const cylY = (id, name, body, at, d, h, mode) => ({ op: "cylinder", id, name, ...(body ? { body } : {}), at: at.map(r3), d, h: r3(h), axis: "Y", ...(mode ? { mode } : {}) });
const cylZ = (id, name, body, at, d, h, mode) => ({ op: "cylinder", id, name, ...(body ? { body } : {}), at: at.map(r3), d, h: r3(h), axis: "Z", ...(mode ? { mode } : {}) });

/** The planes of the bottom end, along Y : from the backing plate of the − terminal down to the bottom face of the housing. o : { end (the bottom
    end of the casing), back (the back of the backing plate of the − terminal), land (the back face of its copper), barEnd (the end of the return busbar) } */
export function bottomLayout(o) {
  const S = caseSection(), c = S.cavity;
  const e = o.end;      // every plane below is measured from the bottom end of the casing
  return { S, c, end: e, back: o.back, land: o.land, barEnd: o.barEnd, ring0: r3(e - 6), house0: r3(e - 56), wall: 2.5,
    posts: [[c.x0, 6], [c.x1 - 11.5, 6], [c.x0, 50], [c.x1 - 11.5, 50]], postW: 11.5, postH: 8,
    conn: { x0: 20, x1: 86, z0: 6, z1: 34, y0: r3(e - 66), y1: r3(e - 51), hvP: [76, 20], hvN: [46, 24], pin: 12, lv: [24, 29, 34, 54, 59, 64].map((x) => [x, 12]) },
    cont: { x0: 4, x1: 64, z0: 34, z1: 74, y0: r3(e - 43), y1: r3(e - 23), studA: [14, 54], studB: [54, 54] },
    riser: { y0: r3(e - 19), y1: r3(e - 15) }, descent: { y0: r3(e - 49), y1: r3(e - 45) },
    bms: { x0: 68, x1: 98, z0: 36, z1: 84, y0: r3(e - 51), y1: r3(e - 49.4), comp: r3(e - 35) },
    bar: { x0: r3(S.xm - 25), z0: r3(S.channel.z0 + 0.5), z1: r3(S.channel.z1 - 0.5) } };
}

/** The interface ring of the bottom lid : its flange, the slot of the return busbar, the four posts on the backing plate of the − terminal. */
export function bottomRing(L) {
  const S = L.S, c = L.c, ch = S.channel, out = { x0: -8.7, x1: 101.5, z0: S.keel.z0, z1: r3(S.ports[2][1] + S.R) }, at = S.ports.map((p) => [p[0], p[1]]);
  return { dw: "part/1", id: "BM-LID-RING-BOT", name: "Anneau d'interface du couvercle du fond", family: "machined", process: "cnc_milling", material: "AL6061-T6", revision: "A", params: {},
    features: [box("bride", "Bride", null, [out.x0, L.ring0, out.z0], [out.x1 - out.x0, 6, out.z1 - out.z0]),
      box("fenetre", "Fenêtre — la section de la cavité", null, [c.x0, L.ring0 - 1, c.z0], [c.x1 - c.x0, 8, c.z1 - c.z0], "cut"),
      box("passage_retour", "Passage du busbar de retour", null, [ch.x0, L.ring0 - 1, ch.z0], [ch.x1 - ch.x0, 8, ch.z1 - ch.z0], "cut"),
      ...L.posts.map(([x, z], k) => box(`patte_${k + 1}`, `Patte intérieure ${k + 1} — l'appui de l'entretoise ${k + 1}`, null, [x, L.ring0, z], [L.postW, 6, L.postH])),
      { op: "hole", id: "vis", name: "Passages des quatre vis du boîtier", face: "-Y", at, d: 4.5, depth: "through" }],
    interfaces: [],
    function: "Prend la poussée de la pile — la réaction des ressorts du couvercle du haut — par ses quatre entretoises, appuyées sur la plaque d'appui de la borne −, et la passe au boîtier par ses quatre vis.",
    notes: ["Aluminium 6061-T6 usiné, comme l'anneau du haut (choix de JP par menu) ; coulé sous pression en série (exemple).",
      "Les quatre entretoises sont des pièces à part, vissées sur la bride (M4, non dessinées) : d'un seul bloc, l'anneau aurait été usiné dans une plaque de 30 mm et 93 % de la matière serait partie en copeaux — l'outil l'a signalé."] };
}
/** A spacer of the bottom ring : it carries the push of the stack from the backing plate of the − terminal to the ring. Drawn at its first place. */
export function postPart(L) {
  const [x, z] = L.posts[0];
  return { dw: "part/1", id: "BM-POST", name: "Entretoise d'appui du couvercle du fond", family: "machined", process: "cnc_milling", material: "AL6061-T6", revision: "A", params: {},
    features: [box("entretoise", "Entretoise", null, [x, L.end, z], [L.postW, L.back - L.end, L.postH]), cylY("taraudage", "Taraudage M4 de sa vis", null, [x + L.postW / 2, L.end - 0.5, z + L.postH / 2], 3.3, 8.5, "cut")],
    interfaces: [],
    function: "Une des quatre entretoises qui portent la poussée de la pile — 690 N en tout (ressorts de la plaque et du plot A, exemple) — de la plaque d'appui de la borne − à l'anneau du fond.",
    notes: ["Aluminium 6061-T6, débitée dans une barre de 12 × 8 mm et taraudée M4 ; elle passe entre les nervures du boîtier (z 6 à 14 et 50 à 58)."] };
}

/** The housing of the bottom lid : a shell open toward the ring ; the window of the swap connector in its bottom face. */
export function bottomHousing(L) {
  const S = L.S, w = L.wall, x0 = -8.7, x1 = 101.5, z0 = S.keel.z0, z1 = r3(S.ports[2][1] + S.R), K = L.conn;
  return { dw: "part/1", id: "BM-LID-BOT", name: "Couvercle du fond", family: "molded", process: "injection_molding", material: "PA66-GF30", revision: "A", params: {},
    features: [box("coque", "Coque", null, [x0, L.house0, z0], [x1 - x0, L.ring0 - L.house0, z1 - z0]),
      { op: "fillet", id: "conges", name: "Congés des arêtes le long de l'axe — R3,75 dehors, R1,25 dedans après la coque", r: 1.5 * w, edges: { dir: "Y" } },
      { op: "shell", id: "creux", name: "Coque ouverte vers l'anneau", t: w, open: ["+Y"] },
      box("fenetre_connecteur", "Fenêtre du connecteur d'échange", null, [K.x0, L.house0 - 1, K.z0], [K.x1 - K.x0, w + 2, K.z1 - K.z0], "cut")],
    interfaces: [],
    function: "Ferme le bout bas du module et porte ce qui le relie au véhicule ou à la station : le connecteur d'échange, le contacteur, la carte BMS centrale (volume réservé).",
    notes: ["PA66-GF30, paroi de 2,5 mm (exemple) ; vissé à l'anneau du fond (quatre vis M4, non dessinées).",
      "Le connecteur s'engage à l'aveugle quand le module entre dans sa cavité ou sa station : la quille et les lobes du boîtier le guident ; les tolérances de cette entrée sont à tenir avec la cavité (non dessinée)."] };
}

/** The swap connector : a blind-mate envelope, two HV pins and six LV pins. */
export function swapConnector(L) {
  const K = L.conn, ins = { material: "PA66-GF30", kind: "insulator", label: "Corps isolant" }, pin = (net, label) => ({ material: "CU-C110", kind: "conductor", net, label });
  const lv = ["CAN_H", "CAN_L", "WAKE_12V", "GND_LV", "HVIL_A", "HVIL_B"];
  return { dw: "part/1", id: "BM-SWAP-CONN", name: "Connecteur d'échange LV + HV", family: "connector", process: "purchased", material: "PA66-GF30", revision: "A", params: {},
    bodies: { corps: ins, hv_plus: pin("HV+", "Broche HV+"), hv_moins: pin("PACK-", "Broche HV−"), ...Object.fromEntries(lv.map((n) => [`lv_${n.toLowerCase()}`, pin(n, `Broche ${n}`)])) },
    features: [box("corps", "Corps", "corps", [K.x0, K.y0, K.z0], [K.x1 - K.x0, K.y1 - K.y0, K.z1 - K.z0]),
      cylY("trou_hvp", "Logement HV+", "corps", [K.hvP[0], K.y0 - 1, K.hvP[1]], K.pin + 0.4, K.y1 - K.y0 + 2, "cut"), cylY("trou_hvn", "Logement HV−", "corps", [K.hvN[0], K.y0 - 1, K.hvN[1]], K.pin + 0.4, K.y1 - K.y0 + 2, "cut"),
      cylY("hv_plus", "Broche HV+", "hv_plus", [K.hvP[0], K.y0 + 2, K.hvP[1]], K.pin, L.riser.y0 - (K.y0 + 2)), cylY("hv_moins", "Broche HV−", "hv_moins", [K.hvN[0], K.y0 + 2, K.hvN[1]], K.pin, L.descent.y0 - (K.y0 + 2)),
      ...K.lv.map(([x, z], k) => cylY(`trou_lv_${k + 1}`, `Logement de ${lv[k]}`, "corps", [x, K.y0 - 1, z], 1.8, K.y1 - K.y0 + 2, "cut")),
      ...K.lv.map(([x, z], k) => cylY(`lv_${k + 1}`, `Broche ${lv[k]}`, `lv_${lv[k].toLowerCase()}`, [x, K.y0 + 2, z], 1.6, K.y1 - K.y0 - 4))],
    interfaces: [],
    function: "Relie le module au véhicule ou à la station de recharge quand il entre dans sa cavité : HV+ et HV−, le CAN du BMS central, le réveil 12 V, la masse LV, et la boucle de verrouillage (HVIL) qui dit au véhicule que le module est en place et fermé.",
    notes: ["Une enveloppe générique de connecteur à engagement aveugle (blind mate) : aucune série n'est choisie ni recopiée ; le connecteur réel se choisit avec la cavité et la station (courant de 360 A en continu, nombre de manœuvres, tenue aux tolérances d'entrée). Broches HV de Ø12 (exemple) : l'intensité admissible se lit sur la fiche du connecteur choisi.",
      "Broches LV (exemple) : CAN_H, CAN_L, WAKE_12V, GND_LV, HVIL_A et HVIL_B — la boucle HVIL passe aussi par le couvercle du haut : couvercle ouvert, la boucle est ouverte (à câbler)."] };
}

/** The contactor : a generic envelope and its two power studs. */
export function contactor(L) {
  const C = L.cont, ins = { material: "PA66-GF30", kind: "insulator", label: "Corps du contacteur" };
  return { dw: "part/1", id: "BM-CONTACTOR", name: "Contacteur du module", family: "electrical", process: "purchased", material: "PA66-GF30", revision: "A", params: {},
    bodies: { corps: ins, borne_a: { material: "CU-C110", kind: "conductor", net: "PACK+", label: "Borne côté module (PACK+)" }, borne_b: { material: "CU-C110", kind: "conductor", net: "HV+", label: "Borne côté connecteur (HV+)" } },
    features: [box("corps", "Corps", "corps", [C.x0, C.y0, C.z0], [C.x1 - C.x0, C.y1 - C.y0, C.z1 - C.z0]),
      cylY("borne_a", "Borne A — PACK+", "borne_a", [C.studA[0], C.y1, C.studA[1]], 10, L.riser.y1 - C.y1), cylY("borne_b", "Borne B — HV+", "borne_b", [C.studB[0], C.y1, C.studB[1]], 10, L.riser.y1 - C.y1)],
    interfaces: [],
    function: "Ouvre ou ferme le pôle + du module sur ordre du BMS central : le module ne met sa tension sur le connecteur que quand il le décide.",
    notes: ["Une enveloppe générique de contacteur continu (60 × 20 × 40 mm, deux bornes M10 à 40 mm l'une de l'autre, exemple) : la référence se choisit pour 360 A en continu sous 33,6 V, le courant à couper en défaut, la tension de bobine et l'économiseur — rien de cela n'a été lu.",
      "Un seul contacteur, sur le pôle + ; une précharge et un second contacteur sur le pôle − sont à décider avec la charge du véhicule (non dessinés)."] };
}

/** The volume kept for the central BMS board : the board and its components, as an envelope. */
export function bmsBoard(L) {
  const B = L.bms;
  return { dw: "part/1", id: "BM-BMS-BOARD", name: "Carte BMS centrale — volume réservé", family: "electrical", process: "purchased", material: "FR4", revision: "A", params: {},
    bodies: { carte: { material: "FR4", kind: "insulator", label: "Carte, 1,6 mm" }, composants: { material: "PA66-GF30", kind: "insulator", label: "Enveloppe des composants" } },
    features: [box("carte", "Carte", "carte", [B.x0, B.y0, B.z0], [B.x1 - B.x0, B.y1 - B.y0, B.z1 - B.z0]), box("composants", "Enveloppe des composants, 14 mm", "composants", [B.x0 + 2, B.y1, B.z0 + 2], [B.x1 - B.x0 - 4, B.comp - B.y1, B.z1 - B.z0 - 4])],
    interfaces: [],
    function: "Le volume que le couvercle du fond peut donner à la carte BMS centrale (JP : « contient peut-être le BMS ») : elle interroge les 8 cartes de CORE par la chaîne RS-485, commande le contacteur, parle au véhicule par le CAN.",
    notes: ["Une carte de 30 × 48 mm et 14 mm de composants, à côté du contacteur et des barres de 40 × 4 mm : c'est ce qui reste dans un couvercle de 56 mm de profondeur. Trop petit pour une carte BMS complète : un couvercle plus profond, une carte ailleurs (contre une paroi du boîtier), ou une carte en deux — à décider.",
      "Ses fils : vers les îlots LV de la borne − (la chaîne RS-485, sa polarisation et la seconde terminaison de 120 Ω), vers le connecteur (CAN, réveil, HVIL), vers la bobine du contacteur ; non dessinés."] };
}

/** The copper straps of the bottom lid, 40 × 4 mm (160 mm², what the tool's busbar model asks for 360 A under 60 °C) : the return busbar to stud A
    of the contactor (PACK+), stud B to the HV+ pin, the − terminal to the HV− pin along the top of the cavity, between its two studs. */
export function bottomStraps(L) {
  const C = L.cont, R = L.riser, D = L.descent, b = L.bar, K = L.conn, net = (n, label) => ({ material: "CU-C110", kind: "conductor", net: n, label }), W = 40, T = 4;
  return { dw: "part/1", id: "BM-LID-STRAPS", name: "Barres du couvercle du fond", family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params: {},
    bodies: { plus: net("PACK+", "Barre PACK+ — busbar de retour → contacteur"), hv: net("HV+", "Barre HV+ — contacteur → connecteur"), moins: net("PACK-", "Barre PACK− — borne − → connecteur") },
    features: [
      box("p_pied", "Pied sur le busbar de retour", "plus", [21.4, L.barEnd, b.z1], [W, L.ring0 - 0.5 - L.barEnd, T]), cylZ("p_vis", "Passage de la vis M10 du busbar de retour", "plus", [41.4, r3(L.barEnd + 4.5), b.z1 - 0.5], 10.5, T + 1, "cut"),
      box("p_montant", "Montant vers la borne A", "plus", [4, R.y0, b.z1], [W, T, C.studA[1] + 8 - b.z1]), cylY("p_trou", "Passage de la borne A", "plus", [C.studA[0], R.y0 - 1, C.studA[1]], 10.5, T + 2, "cut"),
      box("h_plaque", "Plaque de la borne B à la broche HV+", "hv", [46, R.y0, K.hvP[1] - 8], [W, T, C.studB[1] + 8 - (K.hvP[1] - 8)]), cylY("h_trou", "Passage de la borne B", "hv", [C.studB[0], R.y0 - 1, C.studB[1]], 10.5, T + 2, "cut"),
      box("m_plaque", "Plaque sur la plage de la borne −", "moins", [15, r3(L.land - T), 72], [63, T, 9]),
      ...[21.4, 71.4].map((x, k) => cylY(`m_goujon_${k + 1}`, `Passage du goujon ${k + 1}`, "moins", [x, r3(L.land - T - 1), 76.5], 6.5, T + 2, "cut")),
      box("m_longe", "Barre le long du haut de la cavité, entre les goujons", "moins", [26, D.y0, 77.5], [W, r3(L.land - T - D.y0), T]),
      box("m_descente", "Descente vers la broche HV−", "moins", [26, D.y0, 16], [W, D.y1 - D.y0, 77.5 + T - 16])],
    interfaces: [],
    function: "Les trois liaisons de puissance du couvercle du fond : le busbar de retour au contacteur, le contacteur à la broche HV+, la borne − à la broche HV−.",
    notes: ["Cuivre C110 de 40 × 4 mm (160 mm²) : ce que le modèle « busbar » de l'outil demande pour 360 A sous 60 °C (barre seule à l'air libre, prudent pour des barres courtes boulonnées) ; boulonnées aux bornes M10 du contacteur, aux goujons M6 de la borne − et au busbar de retour (M10).",
      "La barre PACK− presse la plage nue de la borne −, serrée par les écrous de ses goujons ; elle passe en haut de la cavité, entre les deux goujons, au-dessus des entretoises et du contacteur."] };
}

/** Every part of the bottom end, and its assembly. o : { end, back, land, barEnd } */
export function bottomEnd(o) {
  const L = bottomLayout(o), parts = [bottomRing(L), postPart(L), bottomHousing(L), swapConnector(L), contactor(L), bmsBoard(L), bottomStraps(L)];
  const at = { t: [0, 0, 0], r: [0, 0, 0] }, [x0, z0] = L.posts[0];
  return { layout: L, parts, assembly: { dw: "assembly/1", id: "BM-LID-BOT-ASM", name: "Couvercle du fond", instances: [
    { id: "anneau", part: "BM-LID-RING-BOT", fixed: true, placement: at }, ...L.posts.map(([x, z], k) => ({ id: `entretoise_${k + 1}`, part: "BM-POST", fixed: true, placement: { t: [r3(x - x0), 0, r3(z - z0)], r: [0, 0, 0] } })),
    { id: "couvercle", part: "BM-LID-BOT", fixed: true, placement: at },
    { id: "connecteur", part: "BM-SWAP-CONN", fixed: true, placement: at }, { id: "contacteur", part: "BM-CONTACTOR", fixed: true, placement: at },
    { id: "bms", part: "BM-BMS-BOARD", fixed: true, placement: at }, { id: "barres", part: "BM-LID-STRAPS", fixed: true, placement: at }], mates: [] } };
}
