/* DesignOrbit.ai — BM 8s8p - 21700, CONCEPT 4 « flat louvred faces », on its own branch from concept 3 (P7) (JP, 22 novembre 2026 : « comment on
   s'assure que les employés d'usine ne s'électrocutent pas puisque tu as une grosse patte non protégée… je pensais que des contacts flexibles sur
   les faces des busbars est plus simple que des grosses pins de busbars pliées » ; by menu : « Faces planes à lamelles »).
   What changes from concept 3 :
   - NOTHING STICKS OUT of a CORE : no blade, no fork. On the − leg, two louvred bands lie in grooves 1.2 mm deep in the copper, behind an
     insulating frame 0.5 mm thick whose windows let them through, flush with it ; the + leg is a flat silver-plated face. Two CORE pressed
     together : the frame of the one bears on the + face of the other (it is the stop), each band works at 1.7 mm, between the bottom of its
     groove and the + face. The pitch is 51.4 mm (0.5 more than concept 1 : the frame).
   - The width is that of concept 1 again (no fork at +X) ; the top end is no longer bound by a fork : it comes down.
   - The stack is pressed again — by the disc springs of the top lid, 700 N, for about 2 × 14 × 7 N = 196 N of lamellae per joint.
   - The ends are those of concept 3 (P7) : fixed return by a flexible shunt, no bridge, no spacers at the bottom.
   Every size and force is an EXAMPLE, said on the parts. Frame of a CORE : X its length, Y across, Z up ; the cells on z = 0. Pure. */

import { run, sessionDefaults } from "../analysis/physics/index.js";
import { topEnd } from "./demo_bm_lid.js";
import { bottomEnd } from "./demo_bm_bottom.js";
import { casingPart, casingPaths, terminalParts } from "./demo_bm_case.js";
import { pressPlateC3, discPart, lidForcesC3, F3 } from "./demo_bm_c3.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");
const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });

/** The joint of concept 4 (examples) : the frame, the grooves, the bands. */
export const F4 = { frame: 0.5, groove: 1.2, h: 1.7, x: [[5, 17], [75.6, 87.6]], z: [7, 58], lv: 7 };      // bands clear of the LV islands (x 22–25, 66–71) and of the HV marks (z 62)

/** What the − leg (face at y = face, the copper behind it toward +Y) receives : the grooves of its two bands, the insulating frame and its windows.
    body : the copper body ; frameBody : the frame ; lv : the x, z of the LV lands of the face (their windows). sfx : ids. */
export function faceFeatures(body, frameBody, face, o) {
  const f = [], g = F4.groove, w = F4.frame, [z0, z1] = F4.z;
  F4.x.forEach(([x0, x1], k) => f.push(box(`rainure_${k + 1}${o.sfx || ""}`, `Rainure de la bande ${k + 1}, ${fr(g)} mm dans le cuivre`, body, [x0 - 0.2, face - 0.01, z0 - 0.2], [x1 - x0 + 0.4, g + 0.01, z1 - z0 + 0.4], "cut")));
  f.push(box(`cadre${o.sfx || ""}`, `Cadre isolant de ${fr(w)} mm sur la face — la butée du joint`, frameBody, [o.x0, face - w, o.zb], [o.x1 - o.x0, w, o.zt - o.zb]));
  F4.x.forEach(([x0, x1], k) => f.push(box(`fenetre_${k + 1}${o.sfx || ""}`, `Fenêtre du cadre pour la bande ${k + 1}`, frameBody, [x0 - 0.2, face - w - 0.1, z0 - 0.2], [x1 - x0 + 0.4, w + 0.2, z1 - z0 + 0.4], "cut")));
  for (const [x, z] of o.lv) f.push({ op: "cylinder", id: `fenetre_lv_${Math.round(x * 10)}${o.sfx || ""}`, name: "Fenêtre du cadre sur une plage LV", body: frameBody, mode: "cut", at: [r3(x), r3(face - w - 0.1), z], d: F4.lv, h: r3(w + 0.2), axis: "Y" });
  return f;
}
/** The two bands of a joint, one part, drawn in the grooves of a − face at y = face : from the bottom of the groove to the face of the frame. */
export function bandsPart(face) {
  const body = (label) => ({ material: "CU-C110", kind: "conductor", net: "CORE-", label }), [z0, z1] = F4.z, n = Math.floor((z1 - z0) / F3.band.p + 1e-9);
  return { dw: "part/1", id: "BM4-LAMELLES", name: "Bandes à lamelles de la face −", family: "contact", process: "purchased", material: "CU-C110", revision: "A", params: {},
    bodies: { bande_1: body("Bande 1"), bande_2: body("Bande 2") },
    features: F4.x.map(([x0, x1], k) => box(`bande_${k + 1}`, `Bande à lamelles ${k + 1}`, `bande_${k + 1}`, [x0, face - F4.frame, z0], [x1 - x0, F4.h, z1 - z0])), interfaces: [],
    function: "Les deux bandes à lamelles d'une face − : couchées dans leurs rainures, au ras du cadre isolant ; pressées par la face + du CORE voisin, elles portent ses 360 A.",
    notes: [`Deux bandes de 12 × ${z1 - z0} mm, ${n} lamelles chacune, dessinées à leur hauteur de travail de ${fr(F4.h)} mm : ${fr(F4.groove)} mm dans la rainure, ${fr(F4.frame)} mm dans la fenêtre du cadre. Même type qu'au concept 3 (enveloppe Weftron LOUVER_tron 112 ; valeurs d'une lamelle de la Stäubli MULTILAM LA-CU).`,
      "Au ras du cadre, rien ne dépasse : un CORE posé sur une table ne touche rien par ses bandes. Ce n'est pas une protection au doigt (une fenêtre de 12 mm laisse passer un doigt d'essai) ; un CORE seul n'a que 4,2 V."] };
}

/** Concept 4, built on the definition of concept 3 (P7) : the definition p is changed in place. c : { P1 (the definition of concept 1), X, Y, ins,
    t, H, zM1, I, caseL1 (the casing of concept 1), pitch1, at, core (the board part id) } → { pitch, caseL, end, Y0 } */
export function conceptFour(p, c) {
  const P = r3(c.pitch1 + F4.frame), at = c.at, Ym = -(c.ins + c.t), lvz = 40, lvx = (c.lvx || []);
  const find = (d, id) => d.parts.find((x) => x.id === id);
  /* the laminated busbar of concept 1, its − leg with grooves and frame */
  const lam = JSON.parse(JSON.stringify(find(c.P1, "BM-BB-LAM")));
  lam.bodies.cadre = { material: "PA66-GF30", kind: "insulator", label: "Cadre isolant de la face − (0,5 mm) — la butée du joint" };
  const fi = lam.features.filter((f) => f.op !== "interfaces");
  lam.features = [...fi, ...faceFeatures("moins", "cadre", Ym, { x0: 3, x1: c.X - 3, zb: 5, zt: c.zM1, lv: lvx.map((x) => [x, lvz]) }), { op: "interfaces" }];
  lam.function = "Les deux pôles du CORE en une pièce laminée sur le dessus des cellules ; ses jambes pliées à 90° le long des grands côtés. Concept 4 : la jambe + est une face plate ; la jambe − porte deux bandes à lamelles dans des rainures, derrière un cadre isolant — rien ne dépasse du CORE.";
  lam.notes = [...lam.notes.filter((n) => !/^Les jambes sont nues/.test(n)),
    `Concept 4 — le contact série : sur la jambe −, deux rainures de ${fr(F4.groove)} mm dans le cuivre reçoivent les bandes à lamelles (BM4-LAMELLES) ; un cadre isolant de ${fr(F4.frame)} mm couvre la face, ses fenêtres laissent les bandes au ras. La face + du CORE voisin se pose sur le cadre : c'est la butée, les bandes travaillent à ${fr(F4.h)} mm.`,
    `Section de la jambe − aux rainures : ${fr(c.X - 6)} × 2 − 24 × ${fr(F4.groove)} = ${fr((c.X - 6) * 2 - 24 * F4.groove)} mm², ${fr(c.I / ((c.X - 6) * 2 - 24 * F4.groove))} A/mm² à ${c.I} A — le critère du calcul « busbar » est 2,5.`,
    "Les plages LV ne se touchent plus d'office : le cadre les écarte de 0,5 mm. La plage du côté + doit monter de 0,5 mm sur sa rondelle ondulée — à revoir."];
  /* the terminals : regenerated at the new gap, the + one with grooves, frame and bands like a − leg */
  const ends = terminalParts({ X: c.X, Y: c.Y, ins: c.ins, t: c.t, gap: F4.frame }), neg = ends.neg, pos = ends.pos;
  pos.bodies.cadre = { material: "PA66-GF30", kind: "insulator", label: "Cadre isolant de la borne + (0,5 mm)" };
  const posFace = r3(Ym + P);
  pos.features.push(...faceFeatures("plaque", "cadre", posFace, { x0: 3, x1: c.X - 3, zb: -3, zt: 80, lv: lvx.map((x) => [x, lvz]), sfx: "" }));
  pos.notes = [...pos.notes.filter((n) => !/plot A du couvercle/.test(n)), "Concept 4 : sa face, comme une jambe −, porte deux bandes à lamelles dans des rainures, derrière un cadre isolant ; la face + du CORE 8 s'y pose."];
  /* the ends, as in concept 3 (P7) : the + terminal back (its copper), the tab right behind, the lid as short as it goes */
  const back = r3(7 * P + posFace + c.t), TAB = r3(back + 1.8), lip0 = r3(TAB + 4 + 0.5), ring1 = r3(lip0 + 6.5), end = r3(ring1 - 6);
  const negLand = r3(c.Y + c.ins + c.t - P - F4.frame + 0), negFace = r3(c.Y + c.ins + c.t - (c.Y + 2 * (c.ins + c.t) + F4.frame)), nLand = r3(negFace - 2), nBack = r3(nLand - 3), Y0 = r3(nBack - 1);
  void negLand;
  pos.features = pos.features.filter((f) => f.body !== "appui"); delete pos.bodies.appui;
  const top = topEnd({ land: back, plate0: back, end, y0: r3(Y0 - 16), tab: TAB, tabTop: 80, lip0 }), L = top.layout, S = L.springs.plate, DISC = 3;
  const plate = pressPlateC3(L, S, DISC), B = L.bar;
  plate.features.push({ op: "box", id: "fenetre_retour", name: "Fenêtre de la languette du busbar de retour — toute la hauteur", mode: "cut", at: [r3(B.x0 - 0.5), r3(L.plate0 - 0.1), -3.1], size: [51, 3.2, 64.2] });
  const shunt = JSON.parse(JSON.stringify(find(p, "BM3-SHUNT"))); shunt.features[0].at = [B.x0, back, 66];
  const bottom = bottomEnd({ end: Y0, land: nLand, back: nBack, barEnd: r3(Y0 - 16) }), ring = bottom.parts.find((x) => x.id === "BM-LID-RING-BOT");
  for (const f of ring.features.filter((q) => /^patte_/.test(q.id))) f.size[1] = r3(nBack - bottom.layout.ring0);
  ring.notes = [...ring.notes.filter((n) => !/entretoises sont des pièces/.test(n)), "Concept 4 : comme au concept 3 (P7), les pattes de l'anneau appuient sur la plaque d'appui de la borne −, sans entretoises."];
  const caseL = r3(end - Y0), casing = casingPart({ L: caseL }); casing.plan = { paths: casingPaths(caseL) };
  const win = casing.features.find((f) => f.id === "fenetre_retour"); win.at[1] = r3(TAB - Y0 - 0.6); win.size[1] = r3(caseL + 1 - win.at[1]);
  casing.notes = [...casing.notes, `Concept 4 : la section du concept 1 (plus de pinces au bout +X) ; coupé à ${fr(caseL)} mm — ${fr(c.caseL1 - caseL)} mm de moins qu'au concept 1, avec un pas de ${fr(P)} mm.`];
  const keep = new Set(["BM-LID-TOP", "BM-LATCH-CAM", "BM-LID-RING-TOP", "BM-RETURN-BB"]);
  const fresh = new Map([...top.parts.filter((x) => keep.has(x.id)), ...bottom.parts.filter((x) => x.id !== "BM-POST"), lam, neg, pos, plate, shunt, casing, discPart(DISC, 175)].map((x) => [x.id, x]));
  p.parts = [...p.parts.filter((x) => x.id !== "BM3-LAMELLES").map((x) => fresh.get(x.id) || x), bandsPart(Ym)];
  /* the assemblies : the CORE at the new pitch, the bands in each CORE and on the + terminal, the lids */
  const core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"); for (const i of core.instances) if (i.part === "BM3-LAMELLES") i.part = "BM4-LAMELLES";
  const mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM");
  for (const i of mod.instances) {
    const m = /^core(\d)$/.exec(i.id); if (m) i.placement = at([0, r3((+m[1] - 1) * P), 0]);
    if (i.id === "borne_plus") i.placement = at([0, r3(7 * P), 0]);
    if (i.id === "lamelles_plus") { i.part = "BM4-LAMELLES"; i.placement = at([0, r3(8 * P), 0]); }
    if (i.id === "boitier") i.placement = at([0, Y0, 0]);
  }
  const lid = p.assemblies.find((a) => a.id === "BM-LID-TOP-ASM");
  lid.instances = lid.instances.map((i) => (i.part === "BM3-DISCS" ? { ...i, placement: at([i.placement.t[0], r3(L.ring1 - DISC), i.placement.t[2]]) } : i));
  const asmB = { ...bottom.assembly, instances: bottom.assembly.instances.filter((i) => i.part !== "BM-POST") };
  p.assemblies = p.assemblies.map((a) => (a.id === asmB.id ? asmB : a));
  const joint = p.assemblies.find((a) => a.id === "BM-JOINT-ASM"); if (joint) for (const i of joint.instances) if (/2$/.test(i.id)) i.placement = at([0, P, 0]);
  /* the calculations : the joint by its lamellae ; the blade, the fork and its jaw are gone */
  const F = lidForcesC3(64 * 0.07, { stack: 700, pads: 0 }), nb = Math.floor((F4.z[1] - F4.z[0]) / F3.band.p + 1e-9), r = run("louvre_strip", { ...sessionDefaults("louvre_strip"), strips: 2, L: F4.z[1] - F4.z[0], p: F3.band.p, Il: F3.band.Il, Rl: F3.band.Rl, Fl: F3.band.Fl, h: F4.h, tol: 0.05, I: c.I });
  p.physics = [...p.physics.filter((x) => !/^phy-bm3-(fork|blade|jaw)$/.test(x.id)), { id: "phy-bm4-joint", name: `Joint entre deux CORE — 2 bandes × ${nb} lamelles, ${c.I} A`, model: "louvre_strip", part: "BM4-LAMELLES", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T23:00:00.000Z",
    why: `Les deux bandes d'une face −, ${F4.z[1] - F4.z[0]} mm de long, contre la face + plate du CORE voisin. Hauteur : ${fr(F4.h)} mm — la rainure (${fr(F4.groove)}) et le cadre (${fr(F4.frame)}), ± 0,05 mm (exemple). L'effort pour fermer le joint (${r3(r.values.F)} N) vient des rondelles du couvercle du haut : ${F.stack} N sur toute la pile.` }];
  p.description = `Concept 4 « flat louvred faces » : rien ne dépasse d'un CORE — sur la face −, deux bandes à lamelles dans des rainures, au ras d'un cadre isolant ; la face + est plate. Pas ${fr(P)} mm ; section du concept 1 ; bouts du concept 3 (shunt fixe, sans entretoises) ; boîtier ${fr(caseL)} mm. Premier jet, à itérer.`;
  return { pitch: P, caseL, end, Y0, back };
}
