/* DynamiteOrbit.ai — BM 8s8p - 21700, CONCEPT 5, iteration 3 : the PIVOT IN A THICK TOP LID (JP, 28 novembre 2026 : « épaissir… 15-20 mm…
   pour avoir assez d'épaisseur pour le trou du pivot structural… un couvercle allégé en alu ou titane machiné dans la masse… toute la matière
   qui n'est pas structurale peut être évidée » ; « l'ajout de dimension… était en longueur pas largeur. Le couvercle du bout avec le pivot est
   très mince » ; « attention à la position angulaire de la came, ça doit pousser au max quand la poignée est dans le haut parallèle au cover
   vertical » ; on the sheet of three drawings, by menu : « Pivot dans le couvercle », « Oui, une seule pièce »).
   What changes from iteration 2 (which stays a point of the history, as the first jet) :
   - ONE TOP LID, 16 mm long, machined from solid : the interface ring (6 mm) and the PA66 cap (3 mm) become one aluminium part, screwed to the
     casing ; its outer face pocketed (ribs, a thin web), solid at the screws and at its two side LUGS, which carry the PIVOT in the middle of
     its 16 mm. The quarter-turn latch is gone with the cap : the lid is screwed ; the disc springs bear on its inner face, where they bore.
   - The handle CLOSED IS VERTICAL, parallel to the lid : the cam pushes its most (the flat on the stop) there — the cam itself does not change.
     The arms rise straight from the pivot and crank back at the top, the grip 2 mm off the lid. Like the ejector handle of a hot-swap module,
     the gloved hand takes it from under and behind (a hook grip, 45 mm free under the grip) ; the TRIGGER is a bail under the grip, squeezed
     up to release ; lying open, the handle is held full hand.
   - The STOPS come back low, under the pivot (the sheet : « butées fixes dessous ») ; the WINDOW of the surface (iteration 2) stays under the
     open grip — it gives the lever its length.
   Every size is an EXAMPLE. Pure. */

import { C5, layout5, moduleSizes, camOutline, contactBand, camCalc5, handlePart, rodPart, swapPlate, stopPart, stopX0, travelOf } from "./demo_bm_c5.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const box = (id, name, at, size, mode) => ({ op: "box", id, name, at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });
const cylX = (id, name, at, d, h, mode) => ({ op: "cylinder", id, name, at: at.map(r3), d, h: r3(h), axis: "X", ...(mode ? { mode } : {}) });
const cylY = (id, name, at, d, h, mode) => ({ op: "cylinder", id, name, at: at.map(r3), d, h: r3(h), axis: "Y", ...(mode ? { mode } : {}) });
const at = (t, r = [0, 0, 0]) => ({ t: t.map(r3), r });

/** Iteration 3, its examples : the lid (its length, the room left to the grip, its pockets), the lugs of the pivot, the bail, the window. */
export const LID = { t: 16, fingers: 45, swing: 75, pocket: { depth: 7, rib: 3, r: 2 }, cbore: { d: 9, depth: 6 }, lug: { below: 18, above: 12, boss: 24 },
  pawl: -15, bail: { gap: 3, t: 4, front: 13, back: 8, hinge: 10 }, under: -6, step: 0.25 };

/** The far points of the handle, in the frame of the pivot, closed : the crank (on the arms, outside the flanks : [y, z, false]), the grip, the
    bail and its clevises (between the arms : [y, z, true] — they may meet the lid). */
function hanging(L) {
  const g = C5.grip, B = LID.bail, h = L.zG, gy = L.gy, pts = [];
  for (let k = 0; k < 24; k++) { const q = 2 * Math.PI * k / 24; pts.push([gy + g.d / 2 * Math.cos(q), h + g.d / 2 * Math.sin(q), true]); }
  for (const y of [0, gy]) for (const z of [h - C5.arm.w / 2, h + C5.arm.w / 2]) pts.push([y, z, false]);
  const zb = h - g.d / 2 - B.gap;
  for (const y of [gy - B.front, gy + B.back]) for (const z of [zb - B.t, zb, h - 21]) pts.push([y, z, true]);
  return pts;
}
/** A point of the frame of the pivot, the handle turned by th (0 closed, −LID.swing open), in the module. */
const turned = (yP, zP, th) => ([y, z, inner]) => { const a = th * Math.PI / 180; return [yP + y * Math.cos(a) - z * Math.sin(a), zP + y * Math.sin(a) + z * Math.cos(a), inner]; };
/** Does the handle, turned through its whole swing, stay above the surface (or in its window) and off the lid (what is between the arms) ? */
function clears(L, m, o = LID) {
  for (let th = 0; th >= -o.swing; th -= 1) for (const [y, z, inner] of hanging(L).map(turned(L.yP, L.zP, th)))
    if (z < m.bottom + o.under || (inner && y < L.lid1 + 1 && y > L.lid0 - 1 && z < m.top)) return false;
  return true;
}
/** The layout of iteration 3 : the pivot in the middle of the lid ; the grip where the first jet had it in height, 45 mm behind the lid for the
    fingers ; the pivot as low as the handle, turned through its swing (75°), allows — the lowest is the longest lever. → null if none */
export function layoutLid(m, o = LID) {
  const L1 = layout5(m), lid0 = m.ringEnd, lid1 = r3(lid0 + o.t), yP = r3(lid0 + o.t / 2), zG = r3(L1.zP + L1.zG), gy = r3(lid1 + o.fingers + C5.grip.d / 2 - yP);
  for (let zP = C5.pivot.z; zP <= zG - C5.arm.w / 2; zP = r3(zP + o.step)) {
    const h = r3(zG - zP), L = { ...L1, lid0, lid1, yP, zP, gy, zG: h };
    if (clears(L, m, o)) return { ...L, lever: r3(Math.hypot(gy, h)), yS: r3(yP + L1.hf), grip: [r3(yP + gy), zG], swing: o.swing };
  }
  return null;
}

/* ---------- the lid ---------- */

/** The pockets of the outer face : a grid, ribs between, the corners kept for the screws. */
function pockets(m, S) {
  const P = LID.pocket, x0 = r3(m.out.x0 + P.rib), x1 = r3(m.out.x1 - P.rib), z0 = r3(m.bottom + P.rib), z1 = r3(m.top - P.rib), nx = 4, nz = 3;
  const w = (x1 - x0 - (nx - 1) * P.rib) / nx, hz = (z1 - z0 - (nz - 1) * P.rib) / nz, keep = S.R + P.rib + 1, out = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    let a = x0 + i * (w + P.rib), b = a + w; const c = z0 + k * (hz + P.rib), d = c + hz;
    for (const [px, pz] of S.ports) if (pz > c - keep && pz < d + keep) { if (Math.abs(px - a) < keep + 1) a = px + keep; if (Math.abs(px - b) < keep + 1) b = px - keep; }
    if (b - a > 6) out.push([a, c, b - a, d - c]);
  }
  return out;
}
function lidPart(ring, L, m, S) {
  const t = LID.t, y1 = L.lid1, face = r3(y1 - LID.pocket.depth), lug = LID.lug, P = C5.pivot, f = [];
  f.push(box("plaque", `Plaque du couvercle — ${t} mm avec la bride`, [m.out.x0, r3(m.ringEnd + 6), m.bottom], [r3(m.out.x1 - m.out.x0), r3(t - 6), r3(m.top - m.bottom)]));
  for (const [k, [x, z]] of S.ports.entries()) f.push(cylY(`vis_plaque_${k + 1}`, `Passage de la vis ${k + 1}`, [x, r3(m.ringEnd + 5.9), z], 4.5, r3(t - 5.8), "cut"),
    cylY(`lamage_${k + 1}`, `Lamage de la vis ${k + 1}`, [x, r3(y1 - LID.cbore.depth), z], LID.cbore.d, LID.cbore.depth + 0.1, "cut"));
  pockets(m, S).forEach(([x, z, w, h], k) => f.push({ op: "pocket", id: `poche_${k + 1}`, name: `Poche d'allègement ${k + 1}`, face: "+Y", rect: [r3(x), r3(z), r3(w), r3(h)], r: LID.pocket.r, depth: LID.pocket.depth }));
  for (const [s, x0] of [["g", L.ear[0]], ["d", L.mir(L.ear[1])]]) {
    const side = s === "g" ? "gauche" : "droite";
    f.push(box(`patte_pivot_${s}`, `Patte ${side} du pivot, dans les ${t} mm du couvercle`, [x0, m.ringEnd, r3(L.zP - lug.below)], [C5.ear.t, t, r3(lug.below + lug.above)]),
      cylX(`bossage_pivot_${s}`, `Bossage du pivot Ø${lug.boss}`, [x0, L.yP, L.zP], lug.boss, C5.ear.t),
      cylX(`alesage_pivot_${s}`, `Alésage du pivot Ø${fr(P.bore, 2)}, 3 mm dans le couvercle (l'axe y est emmanché)`, [s === "g" ? x0 - 0.1 : r3(x0 - 3), L.yP, L.zP], P.bore, C5.ear.t + 3.1, "cut"),
      cylX(`trou_pawl_${s}`, `Trou du pawl Ø${fr(C5.pawl.d + 0.4)}`, [x0 - 0.1, L.yP, r3(L.zP + LID.pawl)], C5.pawl.d + 0.4, C5.ear.t + 0.2, "cut"));
  }
  const keep = ring.features.filter((q) => q.op !== "interfaces" && !/^oreille_/.test(q.id));
  return { ...ring, name: "Couvercle du haut, usiné dans la masse", features: [...keep, ...f],
    function: `Ferme le bout haut du module, d'une seule pièce : vissé au boîtier par quatre vis, il porte la poussée des rondelles ressorts sur sa face intérieure et, par ses deux pattes, le pivot de la poignée en U, au milieu de ses ${t} mm.`,
    notes: [...ring.notes, `Concept 5, itération 3 : l'anneau (6 mm) et le couvercle PA66 (3 mm) en une seule pièce de ${t} mm, usinée dans la masse — alu 6061-T6 dessiné ; un titane ou un 7075 se choisira (absents de la bibliothèque). Face extérieure évidée : ${pockets(m, S).length} poches de ${LID.pocket.depth} mm, nervures de ${LID.pocket.rib} mm, toile de ${fr(t - 6 - LID.pocket.depth)} mm au-dessus de la fenêtre ; pleine aux vis et aux pattes du pivot.`,
      "Plus de quart de tour : le couvercle est vissé. Ouvrir le module demande un tournevis (le quart de tour l'ouvrait à la main). Il n'isole plus : les rondelles ressorts appuient sur la plaque de pression isolante, qui touche la borne +. Les lèvres de l'ancien quart de tour restent dessinées, sans emploi."] };
}

/* ---------- the handle ---------- */

function handleLid(L) {
  const h = handlePart(L), A = C5.arm, g = C5.grip, B = LID.bail, gy = L.gy, hh = L.zG, zb = r3(hh - g.d / 2 - B.gap);
  const feats = h.features.flatMap((f) => {
    if (/^patte_/.test(f.id)) return [{ ...f, name: `${f.name}, sous le pivot`, at: [f.at[0], -7, -21], size: [A.t, 14, 21] }];
    if (/^logement_pawl_/.test(f.id)) return [{ ...f, at: [f.at[0], 0, LID.pawl] }];
    if (f.id === "grip") return [{ ...f, at: [f.at[0], gy, f.at[2]] }];
    if (/^chape_|^axe_gachette_/.test(f.id)) return [];
    if (/^tringle_/.test(f.id)) return [{ op: "cylinder", id: f.id, name: `${f.name}, dans le coude`, at: [f.at[0], 9, hh], d: C5.rod.bore, h: r3(gy - 21), axis: "Y", mode: "cut" }];
    return [f];
  });
  for (const [s, x0] of [["g", L.arm[0]], ["d", L.mir(L.arm[1])]]) feats.push(box(`coude_${s}`, `Coude du bras ${s === "g" ? "gauche" : "droit"}, vers le grip`, [x0, 0, r3(hh - A.w / 2)], [A.t, gy, A.w]));
  for (const [s, x0] of [["g", r3(L.xm - C5.trigger.half - 5.5)], ["d", r3(L.xm + C5.trigger.half + 0.5)]])
    feats.push(box(`chape_${s}`, `Chape de l'anse, côté ${s === "g" ? "gauche" : "droit"}`, [x0, r3(gy - B.front), r3(hh - 21)], [5, r3(B.front - 5), 13]),
      cylX(`axe_anse_${s}`, "Alésage de l'axe de l'anse Ø3,2", [x0 - 0.1, r3(gy - B.hinge), r3(zb - 2)], 3.2, 5.2, "cut"));
  h.features = [...feats.filter((f) => !/^tringle_/.test(f.id)), ...feats.filter((f) => /^tringle_/.test(f.id))];      // the rods' bores cut last : through the cranks
  h.notes = [`Aluminium 6061-T6 usiné (exemple). Fermée, VERTICALE, parallèle au couvercle : la came pousse alors son plus (son plat sur la butée). Les bouts droits montent du pivot (${fr(hh)} mm), puis la partie qui reçoit la main est décalée vers l'arrière : ${LID.fingers} mm pour les doigts gantés avant le couvercle (JP). Grip Ø${g.d} à ${C5.grip.under} mm sous le dessus du module, ${fr(L.span)} mm entre les bras.`,
    `Levier ${fr(L.lever)} mm. Elle s'ouvre de ${LID.swing}° seulement (une butée d'ouverture sur la patte du couvercle, non dessinée) : à 90°, le grip décalé retomberait dans le couvercle. La came n'en use pas le début : il reste ${fr(L.stroke)} mm de course depuis la poignée ouverte. L'anse sous le grip se serre vers le haut pour libérer.`, h.notes[2]];
  return h;
}
function bailPart(L) {
  const g = C5.grip, B = LID.bail, T = C5.trigger, gy = L.gy, hh = L.zG, zb = r3(hh - g.d / 2 - B.gap), x0 = r3(L.xm - T.half);
  return { dw: "part/1", id: "BM5-TRIGGER", name: "Anse de libération, sous le grip", revision: "A", params: {}, interfaces: [], family: "molded", process: "injection_molding", material: "PA66-GF30",
    features: [box("anse", "Anse, sous le grip", [x0, r3(gy - B.front), r3(zb - B.t)], [2 * T.half, r3(B.front + B.back), B.t]),
      cylX("tourillons", "Tourillons Ø3 dans les chapes", [r3(L.xm - T.half - 4.5), r3(gy - B.hinge), r3(zb - 2)], 3, 2 * T.half + 9)],
    function: "Serrée vers le haut contre le grip, elle libère : ses deux tringles retirent les pawls des pattes du couvercle. Lâchée, les ressorts des pawls la ramènent.",
    notes: [`Itération 3 : une anse sous le grip (${B.gap} mm de course), articulée à l'avant — la gâchette du premier jet pendait derrière le grip ; la poignée ouverte, elle toucherait la swap surface. PA66-GF30 (exemple) ; l'arbre dans le grip qui tire les tringles n'est pas dessiné.`] };
}

function rodLid(L) {
  const r = rodPart(L);
  r.features = [{ op: "cylinder", id: "tige", name: `Tige Ø${C5.rod.d}, dans le coude`, at: [0, 0, 0], d: C5.rod.d, h: r3(L.gy - 22), axis: "Y" }];
  r.notes = ["Itération 3 : dans le coude du bras, de l'anse vers le pivot ; un renvoi autour de l'axe la relie au pawl, sous le pivot (non dessiné) — le bout droit est trop court pour une tringle droite."];
  return r;
}

/* ---------- iteration 3, on the definition of iteration 2 ---------- */

/** The window of the plate under the handle turned through its swing, the module home or 8 mm back. */
export function windowLid(L, m, o = LID) {
  const low = []; for (let th = 0; th >= -o.swing; th -= 1) for (const q of hanging(L).map(turned(L.yP, L.zP, th))) if (q[1] < m.bottom) low.push(q);
  if (!low.length) return null;
  const ys = low.map(([y]) => y);
  return { x0: L.arm[0], x1: L.mir(L.arm[0]), y0: r3(Math.min(...ys) - 1), y1: r3(Math.max(...ys) + C5.cam.stroke + 1) };
}

/** Concept 5, iteration 3 : the definition p (iteration 2) is changed in place. → { layout, calc, gain } */
export function conceptFiveLid(p) {
  const m = moduleSizes(p), L0 = layoutLid(m), L1 = layout5(m), pts = camOutline(), band = contactBand(pts), find = (id) => p.parts.find((x) => x.id === id);
  const L = { ...L0, stroke: r3(C5.cam.stroke - (travelOf(pts, -LID.swing) - C5.cam.r0)) };
  const S = { ports: [[-4.5, -8.5], [97.3, -8.5], [97.3, 87.25], [-4.5, 87.25]], R: 4.2 };
  const ring = find("BM-LID-RING-TOP"), holes = ring.features.find((f) => f.id === "vis"); if (holes) S.ports = holes.at;
  const lid = lidPart(JSON.parse(JSON.stringify(ring)), L, m, S);
  /* the swap surface : the stops under the pivot, the window under the open grip */
  const plate = swapPlate(L), W = windowLid(L, m), t = C5.plate.t;
  if (W) plate.features.push(box("fenetre_poignee", "Fenêtre sous la poignée ouverte", [W.x0, W.y0, r3(m.bottom - t - 0.1)], [r3(W.x1 - W.x0), r3(W.y1 - W.y0), r3(t + 0.2)], "cut"));
  plate.notes = [...plate.notes, `Itération 3 : la fenêtre (${fr(W ? W.x1 - W.x0 : 0)} × ${fr(W ? W.y1 - W.y0 : 0)} mm) reste sous la poignée ouverte — sans elle, le pivot monterait et le levier raccourcirait.`];
  const fresh = new Map([lid, handleLid(L), rodLid(L), bailPart(L), stopPart(L, band), plate].map((x) => [x.id, x]));
  p.parts = p.parts.filter((x) => !["BM-LID-TOP", "BM-LATCH-CAM"].includes(x.id)).map((x) => fresh.get(x.id) || x);
  /* the assemblies */
  const lidAsm = p.assemblies.find((a) => a.id === "BM-LID-TOP-ASM");
  lidAsm.instances = lidAsm.instances.filter((i) => !["BM-LID-TOP", "BM-LATCH-CAM"].includes(i.part));
  const mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM"), handle = p.assemblies.find((a) => a.id === "BM5-HANDLE-ASM"), swap = p.assemblies.find((a) => a.id === "BM5-SWAP-ASM");
  mod.instances.find((i) => i.id === "poignee").placement = at([0, L.yP, L.zP]);
  for (const i of handle.instances) {
    if (/^tringle_/.test(i.id)) i.placement = at([r3((/_g$/.test(i.id) ? L.arm[0] : L.mir(L.arm[1])) + C5.arm.t / 2), 9.5, L.zG]);
    if (/^pawl_/.test(i.id)) i.placement = { ...i.placement, t: [i.placement.t[0], 0, LID.pawl] };
  }
  swap.instances.find((i) => i.id === "butee_g").placement = at([stopX0(L), L.yS, m.bottom]);
  swap.instances.find((i) => i.id === "butee_d").placement = at([r3(L.mir(stopX0(L)) - C5.stop.w), L.yS, m.bottom]);
  /* the calculation : the same cam, its lever */
  const calc = camCalc5(L, pts);
  calc.why = `Itération 3 (pivot dans le couvercle, poignée fermée verticale, ouverte à ${LID.swing}°) : la même came, un levier de ${fr(L.lever)} mm ; ${fr(L.stroke)} mm de course depuis la poignée ouverte. ${calc.why}`;
  p.physics = p.physics.map((c) => (c.id === calc.id ? calc : c));
  const end1 = r3(L1.yS + C5.stop.l), end = r3(Math.max(L.yS + C5.stop.l, L.grip[0] + C5.grip.d / 2));
  p.description = `${p.description} Itération 3 : un couvercle du haut de ${LID.t} mm usiné dans la masse et évidé, qui porte le pivot au milieu de son épaisseur ; la poignée fermée est verticale, parallèle au couvercle — la came y pousse son plus — ; ses bouts droits vont au pivot, la partie qui reçoit la main est décalée de ${LID.fingers} mm pour les doigts ; elle s'ouvre de ${LID.swing}° ; plus de quart de tour.`;
  return { layout: L, calc, gain: r3(end1 - end) };
}
