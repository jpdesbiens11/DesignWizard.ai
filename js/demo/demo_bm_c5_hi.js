/* DynamiteOrbit.ai — BM 8s8p - 21700, CONCEPT 5, iteration 2 : the PIVOT HIGH (JP, 27 novembre 2026, by menu : « Rapprocher le pivot », then,
   on the picture of three options computed on the model : « A · pivot haut » ; and « just modify what you need to and try keeping as much as
   possible of the rest untouched… I don't want to lose any good ideas » — the first jet stays a point of the history).
   What the length of the module is bound by : the grip and the gloved hand behind it (45 mm) — not the pivot. In the first jet, the cams and
   the stops stood 23 to 55 mm further back than the grip ; here they come under it :
   - the GRIP stays where it was (10 mm under the top, 45 mm behind the lever of the quarter-turn latch) ;
   - the PIVOT goes up and forward, as far as the handle, hanging open, still clears the end of the module and the surface — the cam turns the
     same 90°, so the CAM, its flat and its stroke do not change, nor the pins, the pawls, the receptacle, the bumpers ;
   - the ARMS lean from the pivot to the grip ; the RODS follow them ; the TRIGGER hangs less (it would touch the surface, the handle open) ;
   - the EARS of the ring come to the new pivot ; the STOPS rise to the cams ; the RAILS stop short of the top lid (the open handle hangs there).
   Which pivot : the one that gives the longest lever (the effort at the hand), the open handle 2 mm above the surface and 1 mm behind the top
   lid, the stops ending under the grip. Every size is an EXAMPLE. Pure. */

import { C5, layout5, moduleSizes, camOutline, contactBand, camCalc5, handlePart, rodPart, triggerPart, earFeatures, swapPlate, stopPart, stopX0 } from "./demo_bm_c5.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const at = (t, r = [0, 0, 0]) => ({ t: t.map(r3), r });

/** Iteration 2, its examples : how short the trigger hangs (mm, 30 in the first jet) ; how low the open handle may hang, from the top of the
    surface (−6 : into a WINDOW of the plate, 2 mm above its underside — without it, the lever loses 3 mm and the hand passes 80 N) ; the
    room kept behind the lid ; where the rails stop before the top lid ; the step of the search. */
export const HI = { drop: 12, under: -6, behind: 1, rails: 10, step: 0.25, latch: [50, 62], window: 1 };

/** What hangs from the grip, in the frame of the pivot, closed : the grip, the trigger and its clevises — the points that may touch when the
    handle hangs open. */
function hanging(gy, gz, o = HI) {
  const g = C5.grip, T = C5.trigger, pts = [];
  for (let k = 0; k < 24; k++) { const q = 2 * Math.PI * k / 24; pts.push([gy + g.d / 2 * Math.cos(q), gz + g.d / 2 * Math.sin(q)]); }
  const y0 = gy + g.d / 2 + T.gap;
  for (const y of [gy, y0, y0 + T.t, gy + 23]) for (const z of [gz - o.drop, gz - 5, gz + 1, gz + 7]) pts.push([y, z]);
  return pts;
}
/** The handle turned open (−90° about X) : a point of the frame of the pivot, in the module. */
const openAt = (yP, zP) => ([y, z]) => [yP + z, zP - y];

/** The pivot of iteration 2, searched on the model : for each height, the most forward pivot whose open handle clears the surface and the
    top lid (and the latch lever, where it stands) ; of those, the one with the longest lever. m : moduleSizes. → { yP, zP, gy, gz, lever } */
export function highPivot(m, o = HI) {
  const L1 = layout5(m), yG = L1.yP, zG = r3(L1.zP + L1.zG), yMax = r3(yG + C5.grip.d / 2 - (L1.hf + C5.stop.l));
  let best = null;
  for (let zP = C5.pivot.z; zP <= m.top - (C5.cam.r0 + C5.cam.stroke + 1); zP = r3(zP + o.step)) {
    for (let yP = r3(m.cap + C5.pivot.pin / 2 + o.behind); yP <= yMax; yP = r3(yP + o.step)) {      // the end of the pin (2 mm inside the ear, its circlip) clears the top lid
      const gy = r3(yG - yP), gz = r3(zG - zP), open = hanging(gy, gz, o).map(openAt(yP, zP));
      const clear = open.every(([y, z]) => z >= m.bottom + o.under && y >= (z >= o.latch[0] && z <= o.latch[1] ? m.back : m.cap) + o.behind);
      if (!clear) continue;
      const lever = r3(Math.hypot(gy, gz)); if (!best || lever > best.lever) best = { yP, zP, gy, gz, lever };
      break;      // for this height, the most forward pivot is the longest lever
    }
  }
  return best;
}
/** The layout of iteration 2 : the one of the first jet, the pivot moved, the grip where it was. */
export function layoutHi(m, o = HI) {
  const L1 = layout5(m), P = highPivot(m, o);
  return { ...L1, yP: P.yP, zP: P.zP, gy: P.gy, zG: P.gz, lever: P.lever, yS: r3(P.yP + L1.hf), hi: P };
}

/** The window of the plate under the open handle : the width of the grip between the arms ; along Y, what hangs below the top of the plate,
    the module home or 8 mm back (the handle opened before the module is pulled, or lying while it is slid in). */
export function windowOf(L, m, o = HI) {
  if (!o.window) return null;
  const low = hanging(L.gy, L.zG, o).map(openAt(L.yP, L.zP)).filter(([, z]) => z < m.bottom);
  if (!low.length) return null;
  const ys = low.map(([y]) => y);
  return { x0: L.arm[0], x1: L.mir(L.arm[0]), y0: r3(Math.min(...ys) - 1), y1: r3(Math.max(...ys) + C5.cam.stroke + 1) };
}

/* ---------- what changes ---------- */

/** The arm between the pivot and the grip, in the plane YZ : a band of width w from s0 to s1 along it. */
function band(L, w, s0, s1) {
  const len = Math.hypot(L.gy, L.zG), u = [L.gy / len, L.zG / len], n = [-u[1], u[0]], p = (s, k) => [r3(u[0] * s + n[0] * k * w / 2), r3(u[1] * s + n[1] * k * w / 2)];
  return [p(s0, -1), p(s1, -1), p(s1, 1), p(s0, 1)];
}
/** The handle : the one of the first jet, its arms leaning to the grip, the rods' slots along them ; the grip and its clevises where the grip is. */
function handleHi(L) {
  const h = handlePart(L), A = C5.arm, g = C5.grip, len = Math.hypot(L.gy, L.zG), bore = C5.rod.bore;
  h.features = h.features.map((f) => {
    if (/^bras_/.test(f.id)) return { op: "extrude", id: f.id, name: `${f.name}, incliné du pivot au grip`, profile: { poly: band(L, A.w, 0, len) }, plane: "YZ", at: f.at[0], length: A.t };
    if (/^tringle_/.test(f.id)) return { op: "extrude", id: f.id, name: `${f.name}, le long du bras`, mode: "cut", profile: { poly: band(L, bore, 13, r3(len - g.d / 2)) }, plane: "YZ", at: r3(f.at[0] - bore / 2), length: bore };
    if (f.id === "grip" || /^chape_|^axe_gachette_/.test(f.id)) return { ...f, at: [f.at[0], r3(f.at[1] + L.gy), f.at[2]] };
    return f;
  });
  h.notes = [h.notes[0], `Itération 2 (pivot haut) : levier ${fr(L.lever)} mm (pivot → grip), les bras inclinés de ${fr(Math.atan2(L.gy, L.zG) * 180 / Math.PI)}° vers l'arrière. Dessinée fermée ; ouverte, elle tourne de 90° et pend vers le bas, juste derrière le couvercle.`, h.notes[2]];
  return h;
}
/** The rods, along the leaning arms : a square of the rod's diameter, drawn in the frame of the pivot. */
function rodHi(L) {
  const r = rodPart(L), len = Math.hypot(L.gy, L.zG), d = C5.rod.d;
  r.features = [{ op: "extrude", id: "tige", name: `Tige ${d} × ${d}, le long du bras`, profile: { poly: band(L, d, 14, r3(len - C5.grip.d / 2 - 2)) }, plane: "YZ", at: 0, length: d }];
  return r;
}
/** The trigger : the one of the first jet, where the grip is, hanging HI.drop mm instead of 30. */
function triggerHi(L, o = HI) {
  const t = triggerPart(L, { ...C5.trigger, drop: o.drop });
  t.features = t.features.map((f) => ({ ...f, at: [f.at[0], r3(f.at[1] + L.gy), f.at[2]] }));
  t.notes = [...t.notes, `Itération 2 : la lame ne descend plus que de ${o.drop} mm sous le grip (30 au premier jet) — la poignée ouverte pend, et une lame plus longue toucherait la swap surface.`];
  return t;
}

/** Concept 5, iteration 2, on the definition of the first jet : the definition p is changed in place. → { layout, calc } */
export function conceptFiveHigh(p, o = HI) {
  const m = moduleSizes(p), L = layoutHi(m, o), L1 = layout5(m), pts = camOutline(), band5 = contactBand(pts), find = (id) => p.parts.find((x) => x.id === id);
  /* the ears, at the new pivot */
  const ring = JSON.parse(JSON.stringify(find("BM-LID-RING-TOP")));
  ring.features = [...ring.features.filter((f) => !/^oreille_/.test(f.id)), ...earFeatures(L, m.ringEnd)];
  ring.notes = [...ring.notes, `Concept 5, itération 2 : les oreilles sont courtes et hautes — le pivot est à ${fr(L.yP - m.cap)} mm derrière le couvercle, ${fr(L.zP)} mm au-dessus de la swap surface (${fr(L1.yP - m.cap)} mm et ${fr(L1.zP)} mm au premier jet).`];
  /* the stops, up to the cams ; the rails, short of the top lid ; the plate, as long as the stops */
  const stop = stopPart(L, band5), plate = swapPlate(L), wall1 = plate.features.find((f) => f.id === "rail_g").at[1];
  for (const f of plate.features.filter((q) => /^rail_/.test(q.id))) f.size[1] = r3(m.cap - o.rails - wall1);
  const W = windowOf(L, m, o), t = C5.plate.t;
  if (W) plate.features.push({ op: "box", id: "fenetre_poignee", name: "Fenêtre sous la poignée ouverte", mode: "cut", at: [W.x0, W.y0, r3(m.bottom - t - 0.1)], size: [r3(W.x1 - W.x0), r3(W.y1 - W.y0), r3(t + 0.2)] });
  plate.notes = [...plate.notes, `Itération 2 : les rails s'arrêtent ${o.rails} mm avant le couvercle du haut ; derrière lui, une fenêtre de ${fr(W.x1 - W.x0)} × ${fr(W.y1 - W.y0)} mm traverse le plateau — la poignée ouverte y pend, ${fr(-o.under)} mm sous le dessus du plateau au plus, sans en sortir par-dessous ; elle laisse au pivot ${fr(L.lever)} mm de levier.`];
  const fresh = new Map([ring, handleHi(L), rodHi(L), triggerHi(L, o), stop, plate].map((x) => [x.id, x]));
  p.parts = p.parts.map((x) => fresh.get(x.id) || x);
  /* the assemblies : the handle at its pivot, the rods in the frame of the pivot, the stops at their face */
  const mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM"), handle = p.assemblies.find((a) => a.id === "BM5-HANDLE-ASM"), swap = p.assemblies.find((a) => a.id === "BM5-SWAP-ASM");
  mod.instances.find((i) => i.id === "poignee").placement = at([0, L.yP, L.zP]);
  for (const i of handle.instances.filter((q) => /^tringle_/.test(q.id))) i.placement = at([r3(i.placement.t[0] - C5.rod.d / 2), 0, 0]);
  swap.instances.find((i) => i.id === "butee_g").placement = at([stopX0(L), L.yS, m.bottom]);
  swap.instances.find((i) => i.id === "butee_d").placement = at([r3(L.mir(stopX0(L)) - C5.stop.w), L.yS, m.bottom]);
  /* the calculation : the same cam, the new lever */
  const calc = camCalc5(L, pts);
  calc.why = `Itération 2 (pivot haut) : la même came, un levier de ${fr(L.lever)} mm. ${calc.why}`;
  p.physics = p.physics.map((c) => (c.id === calc.id ? calc : c));
  const before = r3(L1.yS + C5.stop.l), after = r3(Math.max(L.yS + C5.stop.l, L1.yP + C5.grip.d / 2));
  p.description = `${p.description} Itération 2 : le pivot monte à ${fr(L.zP)} mm et avance de ${fr(L1.yP - L.yP)} mm, les bras s'inclinent vers le grip resté en place ; les butées viennent sous le grip — ${fr(before - after)} mm de moins derrière le couvercle.`;
  return { layout: L, calc, gain: r3(before - after) };
}
