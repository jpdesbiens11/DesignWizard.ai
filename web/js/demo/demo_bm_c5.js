/* DynamiteOrbit.ai — BM 8s8p - 21700, CONCEPT 5 « U handle and asymmetric cams », on its own branch from the tip of concept 4 (JP, 27 novembre
   2026 : « J'aimerais modifier les géométries du ESS et que tu implantes ce concept dans le projet ESS 8s8p directement » ; the concept sheet
   CB-6.29 of the brick CB-6 Swap interface (rails, latch, blind-mate connector), made in the Diamond of DynamiteAgile : « Cames asymétriques sous
   poignée en U : pousser puis barrer le BM » ; by menu : « Concept 5, depuis concept 4 »).
   What the sheet says, and how it is drawn here :
   - « En relevant la poignée, la came asymétrique roule sur une butée fixe : son rayon grandit et pousse le BM vers le connector, puis son plat
     arrive contre la butée et barre le BM. » — a plate cam on each side, keyed to the arm of a U HANDLE that turns on a pivot of the module ; a
     fixed STOP of the swap surface in the plane of each cam. Lying open (the arm along +Y), the cam shows its small radius to the stop ;
     raised to vertical, its radius grows by the STROKE and pushes the module toward −Y, the swap connector going home ; at the end the corner
     of the flat passes the stop (the module goes a little further : the over-travel) and the FLAT lies on it — leaving it, either way, asks
     for the over-travel again : the handle stays (« le plat ne revient pas seul »).
   - « cames G / D hors des côtés du BM, butées fixes dessous ; bras à l'intérieur » — from the module outward : the EAR of the module (on the
     interface ring of the top lid), the ARM, the CAM, the head of the PIN.
   - « 10 mm sous le top, au moins » ; « main gantée 120 × 45 mm » — the grip, closed, lies 10 mm under the top of the module ; between the
     arms 120 mm at least, and 45 mm between the grip and the end of the module, for the gloved hand. With straight arms, it is this 45 mm
     that sets the pivot so far behind the lid.
   - « gâchette : serrer = libérer (pawl secondaire au pivot) » — a TRIGGER under the grip ; a spring PAWL in each arm, its nose in a hole of
     the ear when the handle is closed : the second lock. Squeezing the trigger pulls the two rods in the arms, which pull the pawls out.
   - « Butées G / D sur chaque swap surface (drone et charging base) » — ONE swap surface drawn, the same for both : a plate, two side rails,
     the bulkhead and the RECEPTACLE of the swap connector, the two stops, two elastic BUMPERS on the bulkhead (added : the cam only pushes ;
     what holds the module the other way, takes the over-travel and keeps the flat pressed on its stop is these bumpers).
   - « Course 5-10 mm, angle du plat (sur-centre), couple avec moufle à −40 °C » — 8 mm ; a flat centred on the line of the stop (a detent,
     not an over-centre against a stop of the handle) ; the effort at the hand in the calculation, its admissible value an EXAMPLE.
   Frames : the module's (X across, Y along, Z up ; CORE 1 at the origin) for the ears and the swap surface ; the handle is drawn in the frame of
   its PIVOT (the axis along X through the origin), closed — the arm along +Z, the stop toward +Y — and placed at the pivot. Every size and every
   force is an EXAMPLE, said on the parts. Pure. */

import { run, sessionDefaults } from "../analysis/physics/index.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","), rad = (d) => d * Math.PI / 180;
const box = (id, name, at, size, mode, body) => ({ op: "box", id, name, ...(body ? { body } : {}), at: at.map(r3), size: size.map(r3), ...(mode ? { mode } : {}) });
const cyl = (axis) => (id, name, at, d, h, mode, body) => ({ op: "cylinder", id, name, ...(body ? { body } : {}), at: at.map(r3), d, h: r3(h), axis, ...(mode ? { mode } : {}) });
const cylX = cyl("X"), cylY = cyl("Y"), cylZ = cyl("Z");
const part = (id, name, o) => ({ dw: "part/1", id, name, revision: "A", params: {}, interfaces: [], ...o });
const at = (t, r = [0, 0, 0]) => ({ t: t.map(r3), r });

/** The concept, its examples in one place. */
export const C5 = {
  cam: { r0: 15, stroke: 8, flat: 6, rc: 1.5, hub: 12, end: 108, t: 10 },      // the cam : at the stop open, the stroke, the half flat, the radius of its corners, the back, where the ramp ends (°, past the open position), its thickness
  pivot: { z: 12, pin: 10, bore: 10.2, boss: 22, earBoss: 24 },      // the pivot above the swap surface (the cam clears it by 3 mm or more) ; the pin and its bores
  arm: { t: 8, w: 16 }, ear: { t: 6 }, play: 0.5,      // the arm (along X, along Y), the ear of the module, the play between them
  grip: { d: 25, under: 10 }, hand: { w: 120, d: 45 },      // the grip and how far under the top of the module ; the gloved hand (sheet CB-6.29)
  pawl: { d: 6, y: -15, into: 4 }, rod: { d: 3, bore: 4 },      // the pawl : its diameter, where it stands from the pivot, how far it enters the ear
  trigger: { half: 40.5, gap: 3, t: 6, drop: 30 },      // the trigger : half its length, its gap to the grip (the squeeze), its thickness, how far it hangs
  plate: { t: 8, x0: -45, tail: 30 }, rail: { w: 5.5, h: 10 }, stop: { w: 16, l: 32, top: 5, out: 7, hole: 8, screw: { d: 6.6, cb: 11, cbDepth: 6.5, tap: 5 } }, wall: { t: 10, h: 75 },
  recept: { gap: 1, play: 0.5, rim: 4.5, back: 10 }, bumper: { d: 16, pre: 1 },
  loads: { Fc: 150, m: 10.4, muS: 0.3,      // m : the module with its handle, measured by the tool on the assembly (10,44 kg) ; the rest are examples
            Fb: 200, g: 10, mu: 0.15, muP: 0.15, E: 210000, pAdm: 1500, wipe: 1, Fhand: 80 },
};

/* ---------- the cam : its outline and its travel ---------- */

/** The outline of the cam, in the frame of the pivot, the handle closed : [y, z] points, counter-clockwise. The flat faces +Y at r0 + stroke,
    `flat` mm each side of the axis, its two corners rounded. The ramp is drawn by its SUPPORT — how far the cam reaches toward the stop when
    the handle has turned so far : h(ψ) = r0 + k (90° − ψ), ψ the direction of the stop in the frame of the cam (90° : lying open, 0 : closed) —
    a constant slope, so the hand feels the same effort all along ; the ramp is tangent to the upper corner, which sets k. A point of the ramp
    is h n + h' t (n, t the normal and the tangent of the direction ψ). The back, a circle of the hub. */
export function camOutline(o = C5.cam) {
  const hf = o.r0 + o.stroke, rc = o.rc, cy = hf - rc, cz = o.flat - rc, Q = Math.PI / 2;
  const hC = (q) => cy * Math.cos(q) + cz * Math.sin(q) + rc, kC = (q) => cy * Math.sin(q) - cz * Math.cos(q);      // the support of the upper corner, and minus its slope
  let lo = Math.atan2(cz, cy), hi = Q;      // the tangency : the ramp and the corner reach as far, with the same slope
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (hC(m) - (o.r0 + kC(m) * (Q - m)) > 0) lo = m; else hi = m; }
  const qt = (lo + hi) / 2, k = kC(qt), qE = rad(o.end), pts = [];
  const arc = (c, q0, q1, n) => { for (let j = 0; j <= n; j++) { const q = q0 + (q1 - q0) * j / n; pts.push([c[0] + rc * Math.cos(q), c[1] + rc * Math.sin(q)]); } };
  arc([cy, -cz], -Q, 0, 6); arc([cy, cz], 0, qt, 8);      // the lower corner, the flat, the upper corner up to the ramp
  for (let j = 1; j <= 48; j++) { const q = qt + (qE - qt) * j / 48, h = o.r0 + k * (Q - q); pts.push([h * Math.cos(q) + k * Math.sin(q), h * Math.sin(q) - k * Math.cos(q)]); }
  const last = pts[pts.length - 1], b0 = Math.atan2(last[1], last[0]) + 0.5, b1 = 2 * Math.PI - 1;
  for (let j = 0; j <= 24; j++) { const q = b0 + (b1 - b0) * j / 24; pts.push([o.hub * Math.cos(q), o.hub * Math.sin(q)]); }
  return pts.map(([y, z]) => [r3(y), r3(z)]);
}
/** How far the cam reaches toward the stop (+Y of the world) when the handle is turned by th about X (0 : closed ; −90 : lying open, the arm
    along +Y) : the support of the outline in that direction. → mm from the pivot */
export function travelOf(pts, th) {
  const u = [Math.cos(rad(th)), -Math.sin(rad(th))];
  return pts.reduce((m, [y, z]) => Math.max(m, y * u[0] + z * u[1]), -Infinity);
}
/** The travel of the module along the swing, every degree : where the module stands, from the open position, toward the connector ; the slope
    (what turns a force into a torque : T = F dd/dθ) ; the peak and its angle ; the over-travel the flat gives back. */
export function camTravel(pts = camOutline(), o = C5.cam) {
  const rows = []; let peak = -Infinity, peakAt = 0, kMax = 0;
  for (let th = -90; th <= 0; th += 1) { const d = travelOf(pts, th), prev = th > -90 ? travelOf(pts, th - 1) : d, k = (d - prev) / rad(1); rows.push({ th, d: r3(d - o.r0), k: r3(k) }); if (d > peak) { peak = d; peakAt = th; } kMax = Math.max(kMax, k); }
  const hf = travelOf(pts, 0), back = travelOf(pts, 3) - hf;
  return { rows, stroke: r3(hf - o.r0), peak: r3(peak - o.r0), peakAt, over: r3(peak - hf), kMax: r3(kMax), rampDeg: 90 + peakAt, holdsClosed: back > 0 };
}
/** Where the support touches the stop, in the frame of the pivot : its height along the swing (the stop must cover it). → { z0, z1 } */
export function contactBand(pts = camOutline()) {
  let z0 = Infinity, z1 = -Infinity;
  for (let th = -90; th <= 0; th += 1) {
    const u = [Math.cos(rad(th)), -Math.sin(rad(th))], best = pts.reduce((b, p) => (p[0] * u[0] + p[1] * u[1] > b[0] ? [p[0] * u[0] + p[1] * u[1], p] : b), [-Infinity, null])[1];
    const z = best[0] * Math.sin(rad(th)) + best[1] * Math.cos(rad(th)); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  for (const z of [-(C5.cam.flat - C5.cam.rc), C5.cam.flat - C5.cam.rc]) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }      // closed : the whole flat
  return { z0: r3(z0), z1: r3(z1) };
}

/* ---------- the layout ---------- */

/** Where everything stands. m : what the module of concept 4 gives — { out: { x0, x1 } (its sides), top (its top), bottom (under its keel),
    back (the farthest point of its top end : the lever of the quarter-turn latch), cap (the face of the top lid), ringEnd (where the interface ring starts), face (the face of
    the bottom lid), plug: { x0, x1, z0, z1, tip } (the swap connector) } → numbers */
export function layout5(m) {
  const P = C5.pivot, A = C5.arm, E = C5.ear, g = C5.grip, xm = r3((m.out.x0 + m.out.x1) / 2), mir = (x) => r3(2 * xm - x);
  const ear = [r3(m.out.x0 - E.t), m.out.x0], arm = [r3(ear[0] - C5.play - A.t), r3(ear[0] - C5.play)], cam = [r3(arm[0] - C5.cam.t), arm[0]];
  const zG = r3(m.top - g.under - g.d / 2), yP = r3(m.back + C5.hand.d + g.d / 2), zP = P.z;      // the grip 10 mm under the top ; the hand behind it, 45 mm
  const hf = C5.cam.r0 + C5.cam.stroke, yS = r3(yP + hf);      // the face of the stop, the handle closed
  const span = r3(mir(arm[1]) - arm[1]);      // between the arms
  return { xm, mir, ear, arm, cam, pin: [r3(cam[0] - 3), r3(ear[1] + 2)], yP, zP, zG: r3(zG - zP), lever: r3(zG - zP), yS, span, hand: r3(yP - g.d / 2 - m.back), m, hf };
}

/* ---------- the parts of the handle (frame of the pivot, closed) ---------- */

function handlePart(L) {
  const A = C5.arm, P = C5.pivot, g = C5.grip, T = C5.trigger, zG = L.zG, f = [];
  for (const [s, x0] of [["g", L.arm[0]], ["d", L.mir(L.arm[1])]]) {
    const side = s === "g" ? "gauche" : "droit";
    f.push(box(`bras_${s}`, `Bras ${side}`, [x0, -A.w / 2, 0], [A.t, A.w, zG]), cylX(`moyeu_${s}`, `Moyeu du pivot, bras ${side}`, [x0, 0, 0], P.boss, A.t),
      box(`patte_${s}`, `Patte du pawl, bras ${side}`, [x0, -21, -7], [A.t, 21, 14]),
      cylX(`alesage_${s}`, `Alésage du pivot Ø${fr(P.bore)}`, [x0 - 0.1, 0, 0], P.bore, A.t + 0.2, "cut"),
      cylX(`logement_pawl_${s}`, `Logement du pawl Ø${fr(C5.pawl.d + 0.2)}`, [x0 - 0.1, C5.pawl.y, 0], C5.pawl.d + 0.2, A.t + 0.2, "cut"),
      cylZ(`tringle_${s}`, `Passage de la tringle Ø${C5.rod.bore}`, [x0 + A.t / 2, 0, 13], C5.rod.bore, r3(zG - g.d / 2 - 13), "cut"));
  }
  f.push(cylX("grip", `Grip Ø${g.d}, entre les bras`, [L.arm[0], 0, zG], g.d, r3(L.mir(L.arm[0]) - L.arm[0])));
  for (const [s, x0] of [["g", r3(L.xm - T.half - 5.5)], ["d", r3(L.xm + T.half + 0.5)]])
    f.push(box(`chape_${s}`, `Chape de la gâchette, côté ${s === "g" ? "gauche" : "droit"}`, [x0, 0, zG - 5], [5, 23, 12]), cylX(`axe_gachette_${s}`, "Alésage de l'axe de la gâchette Ø4,2", [x0 - 0.1, 18.5, zG + 1], 4.2, 5.2, "cut"));
  return part("BM5-HANDLE", "Poignée en U", { family: "machined", process: "cnc_milling", material: "AL6061-T6", features: f,
    function: "La poignée d'échange du BM : relevée, elle tourne les deux cames qui poussent le module vers le connector puis le barrent ; couchée, elle sert à le tirer hors de la swap surface.",
    notes: [`Aluminium 6061-T6 usiné d'une pièce (exemple) — en série, un tube cintré et des moyeux rapportés. Grip Ø${g.d} à ${C5.grip.under} mm sous le dessus du module, ${fr(L.span, 1)} mm entre les bras, ${fr(L.hand, 1)} mm entre le grip et le bout du module : la main gantée de la feuille CB-6.29 (${C5.hand.w} × ${C5.hand.d} mm) y passe.`,
      `Levier ${fr(L.lever, 1)} mm (pivot → grip). Dessinée fermée ; couchée, les bras à l'horizontale vers +Y, elle tourne de 90°.`,
      "Les cames sont goupillées sur les bras (deux goupilles Ø4 par came, non dessinées) ; la tringle de chaque bras tire son pawl par un renvoi d'angle (non dessiné)."] });
}
function camPart(pts) {
  const t = C5.cam.t;
  return part("BM5-CAM", "Came asymétrique", { family: "machined", process: "cnc_milling", material: "STEEL-1018",
    features: [{ op: "extrude", id: "came", name: "Profil de la came : rampe en spirale, plat, dos", profile: { poly: pts }, plane: "YZ", at: 0, length: t },
      cylX("alesage", `Alésage du pivot Ø${fr(C5.pivot.bore)}`, [-0.1, 0, 0], C5.pivot.bore, t + 0.2, "cut")],
    function: "Solidaire de la poignée, elle roule sur la butée fixe : son rayon grandit et pousse le module vers le connector, puis son plat se pose contre la butée et barre le module.",
    notes: [`Rayon contre la butée : ${C5.cam.r0} mm poignée couchée, ${C5.cam.r0 + C5.cam.stroke} mm au plat — ${C5.cam.stroke} mm de course ; plat de ${2 * C5.cam.flat} mm, coins R${fr(C5.cam.rc)}. Dessinée poignée fermée, le plat vers +Y.`,
      "Acier cémenté trempé (exemple, à choisir avec la butée) : la came et la butée glissent l'une sur l'autre sous l'effort du connector — l'usure de leur profil est le point de la feuille CB-6.29. Graisse ou revêtement à décider.",
      "La même pièce à gauche et à droite : son profil est dans le plan YZ."] });
}
function pinPart(L) {
  const len = r3(L.pin[1] - L.pin[0] - 3);
  return part("BM5-PIN", "Axe de pivot de la poignée", { family: "turned", process: "cnc_turning", material: "SS-304",
    features: [cylX("tete", "Tête Ø16", [0, 0, 0], 16, 3), cylX("fut", `Fût Ø${C5.pivot.pin}`, [3, 0, 0], C5.pivot.pin, len)],
    function: "Porte la poignée et sa came sur l'oreille du module ; reprend l'effort de la came sur la butée.",
    notes: [`Inox, Ø${C5.pivot.pin} dans des alésages Ø${fr(C5.pivot.bore)} (came, bras, oreille) ; une gorge et un anneau élastique au bout, à 2 mm derrière l'oreille (non dessinés). Bague bronze dans l'oreille à prévoir.`] });
}
function pawlPart(L) {
  const p = C5.pawl, len = r3(L.ear[0] + p.into - (L.arm[0] + 1));
  return part("BM5-PAWL", "Pawl du pivot", { family: "turned", process: "cnc_turning", material: "STEEL-1018",
    features: [cylX("verrou", `Verrou Ø${p.d}`, [0, 0, 0], p.d, len)],
    function: "Le second verrou : poussé par un ressort, son nez entre dans l'oreille quand la poignée est fermée ; la gâchette le retire.",
    notes: [`Dessiné engagé : ${p.into} mm dans l'oreille. Son ressort et le renvoi de la tringle sont dans le bras (non dessinés). Bout chanfreiné : il s'efface en passant sur l'oreille à la fermeture.`] });
}
function rodPart(L) {
  return part("BM5-ROD", "Tringle de la gâchette", { family: "turned", process: "cnc_turning", material: "SS-304",
    features: [cylZ("tige", `Tige Ø${C5.rod.d}`, [0, 0, 0], C5.rod.d, r3(L.zG - C5.grip.d / 2 - 16))],
    function: "Relie la gâchette au pawl de son bras.", notes: ["Dans le bras ; ses deux renvois — vers l'arbre de la gâchette dans le grip, vers le pawl — sont à dessiner."] });
}
function triggerPart(L) {
  const T = C5.trigger, zG = L.zG, y0 = r3(C5.grip.d / 2 + T.gap), x0 = r3(L.xm - T.half);
  return part("BM5-TRIGGER", "Gâchette du grip", { family: "molded", process: "injection_molding", material: "PA66-GF30",
    features: [cylX("charniere", "Charnière", [x0, 18.5, zG + 1], 8, 2 * T.half), cylX("tourillons", "Tourillons Ø4 dans les chapes", [r3(L.xm - T.half - 4.5), 18.5, zG + 1], 4, 2 * T.half + 9),
      box("lame", "Lame, sous le grip", [x0, y0, zG - T.drop], [2 * T.half, T.t, T.drop + 1])],
    function: "Serrée contre le grip, elle libère : ses deux tringles retirent les pawls des oreilles. Lâchée, les ressorts des pawls la ramènent.",
    notes: [`${T.gap} mm entre la lame et le grip : la course de la main. Côté extérieur du grip, sous lui (feuille CB-6.29). PA66-GF30 (exemple) ; l'arbre dans le grip qui tire les tringles n'est pas dessiné.`] });
}

/* ---------- the ears of the module : on the interface ring of the top lid ---------- */

function earFeatures(L, ringEnd) {
  const P = C5.pivot, f = [];
  for (const [s, x0] of [["g", L.ear[0]], ["d", L.mir(L.ear[1])]]) {
    const side = s === "g" ? "gauche" : "droite";
    f.push(box(`oreille_${s}`, `Oreille ${side} du pivot de la poignée`, [x0, ringEnd, L.zP - P.earBoss / 2], [C5.ear.t, r3(L.yP - ringEnd), P.earBoss]),
      cylX(`oreille_${s}_bout`, `Bout arrondi de l'oreille ${side}`, [x0, L.yP, L.zP], P.earBoss, C5.ear.t),
      cylX(`oreille_${s}_pivot`, `Alésage du pivot Ø${fr(P.bore)}`, [x0 - 0.1, L.yP, L.zP], P.bore, C5.ear.t + 0.2, "cut"),
      cylX(`oreille_${s}_pawl`, `Trou du pawl Ø${fr(C5.pawl.d + 0.4)}`, [x0 - 0.1, r3(L.yP + C5.pawl.y), L.zP], C5.pawl.d + 0.4, C5.ear.t + 0.2, "cut"));
  }
  return f;
}

/* ---------- the swap surface (frame of the module : the module closed, home) ---------- */

function swapPlate(L) {
  const p = C5.plate, R = C5.rail, W = C5.wall, m = L.m, x1 = L.mir(p.x0), y0 = r3(m.face - deep() - W.t), y1 = r3(L.yS + C5.stop.l + p.tail);
  const wall1 = r3(y0 + W.t), bottom = m.bottom, holes = stopHoles(L);
  return part("BM5-SWAP-PLATE", "Swap surface — drone et charging base", { family: "machined", process: "cnc_milling", material: "AL6061-T6",
    features: [box("plateau", `Plateau de ${p.t} mm`, [p.x0, y0, bottom - p.t], [r3(x1 - p.x0), r3(y1 - y0), p.t]),
      box("cloison", "Cloison du connector", [p.x0, y0, bottom], [r3(x1 - p.x0), W.t, W.h]),
      box("rail_g", "Rail gauche — guide le flanc du module", [r3(m.out.x0 - C5.play - R.w), wall1, bottom], [R.w, r3(L.yS - 4 - wall1), R.h]),
      box("rail_d", "Rail droit", [r3(m.out.x1 + C5.play), wall1, bottom], [R.w, r3(L.yS - 4 - wall1), R.h]),
      ...holes.map(([x, y], k) => cylZ(`taraudage_${k + 1}`, `Taraudage M6 de la butée ${k < 2 ? "gauche" : "droite"}`, [x, y, bottom - p.t - 0.1], C5.stop.screw.tap, p.t + 0.2, "cut"))],
    function: "L'interface d'échange du véhicule ou de la station : le module y glisse entre deux rails, son connector entre dans le réceptacle de la cloison, ses cames roulent sur les deux butées.",
    notes: ["Une seule swap surface est dessinée : la même pour le drone et la charging base (feuille CB-6.29 : butées G / D sur chaque swap surface).",
      `Le module se pose entre les rails, sa quille sur le plateau, et glisse vers la cloison jusqu'à ce que ses cames touchent les butées, poignée couchée : son connector est alors à ${C5.cam.stroke} mm de chez lui, son nez déjà ${fr(inMouth(m))} mm dans la bouche du réceptacle. Relever la poignée fait le reste.`,
      "Aluminium 6061-T6 usiné (exemple) ; dans le véhicule, le plateau est une partie de sa structure."] });
}
const stopX0 = (L) => r3(L.cam[0] - C5.stop.out);      // the left stop : 7 mm beyond the outer face of the cam ; its inner face 1 mm short of the arm
function stopHoles(L) { const x = r3(stopX0(L) + C5.stop.w / 2), xs = [x, L.mir(x)]; return xs.flatMap((xx) => [[xx, r3(L.yS + C5.stop.hole)], [xx, r3(L.yS + C5.stop.l - C5.stop.hole)]]); }
function stopPart(L, band) {
  const S = C5.stop, zTop = r3(L.zP + band.z1 + S.top), h = r3(zTop - L.m.bottom);
  return part("BM5-STOP", "Butée fixe de la came", { family: "machined", process: "cnc_milling", material: "STEEL-1018",
    features: [box("bloc", "Bloc", [0, 0, 0], [S.w, S.l, h]),
      ...[S.hole, S.l - S.hole].flatMap((y, k) => [cylZ(`vis_${k + 1}`, "Passage de vis M6", [S.w / 2, y, -0.1], S.screw.d, h + 0.2, "cut"), cylZ(`lamage_${k + 1}`, "Lamage", [S.w / 2, y, r3(h - S.screw.cbDepth)], S.screw.cb, S.screw.cbDepth + 0.1, "cut")])],
    function: "La butée fixe dans le plan de la came : la came y roule en poussant le module, puis son plat s'y pose et le barre.",
    notes: [`Sa face −Y est la face de contact : ${fr(L.hf, 1)} mm devant le pivot quand la poignée est fermée. Elle couvre la came de z ${fr(L.zP + band.z0, 1)} à ${fr(L.zP + band.z1, 1)} mm (là où la came la touche le long de la rotation), plus ${S.top} mm.`,
      `Acier cémenté trempé (exemple), comme la came ; ${S.w} mm de large — la came la touche sur ${C5.cam.t - 1} mm, le reste dépasse vers l'extérieur : le bras de la poignée passe à 1 mm de sa face intérieure. Deux vis M6 dans le plateau — l'effort de la came est un cisaillement : une clavette ou un épaulement dans le plateau est à dessiner.`,
      "Hors du module, visible et facile à nettoyer (feuille CB-6.29) ; la glace sur la face de contact reste un risque à éprouver."] });
}
function receptaclePart(L) {
  const R = C5.recept, K = L.m.plug, face = r3(L.m.face - R.gap), y0 = r3(L.m.face - deep());
  return part("BM5-RECEPT", "Réceptacle du connector d'échange", { family: "connector", process: "purchased", material: "PA66-GF30",
    features: [box("corps", "Corps", [K.x0 - R.rim - R.play, y0, K.z0 - R.rim - R.play], [r3(K.x1 - K.x0 + 2 * (R.rim + R.play)), r3(face - y0), r3(K.z1 - K.z0 + 2 * (R.rim + R.play))]),
      box("bouche", "Bouche : le nez du connector y entre", [K.x0 - R.play, r3(K.tip - R.play), K.z0 - R.play], [r3(K.x1 - K.x0 + 2 * R.play), r3(face + 0.1 - K.tip + R.play), r3(K.z1 - K.z0 + 2 * R.play)], "cut")],
    function: "La moitié fixe du connector d'échange, sur la cloison : il reçoit le nez du connector du module, à l'aveugle.",
    notes: ["Une enveloppe générique, comme le connector du module : aucune série n'est choisie. Contacts, flottement et chanfreins d'entrée sont ceux du fournisseur — à choisir ensemble.",
      `Sa face est à ${fr(R.gap)} mm du couvercle du fond quand le module est barré ; poignée couchée, le module est ${C5.cam.stroke} mm en arrière et le nez n'est que ${fr(inMouth(L.m))} mm dans la bouche — assez pour l'aligner. Le connector doit accepter la sur-course du plat (${fr(camTravel().over)} mm).`] });
}
/** How deep the bulkhead stands in front of the bottom lid : the gap, then the receptacle. */
const deep = () => r3(C5.recept.gap + C5.recept.back * 1.9);
/** How far the nose of the connector is already in the mouth when the handle lies open. */
const inMouth = (m) => r3(m.face - C5.recept.gap - m.plug.tip - C5.cam.stroke);
function bumperPart() {
  const B = C5.bumper;
  return part("BM5-BUMPER", "Butée élastique avant", { family: "purchased", process: "purchased", material: "SILICONE",
    features: [cylY("tampon", `Tampon Ø${B.d}`, [0, 0, 0], B.d, deep())],
    function: "Retient le module vers l'avant, prend la sur-course du plat et garde le plat des cames pressé contre leurs butées : la came ne fait que pousser.",
    notes: [`Dessinée à sa longueur de travail, ${B.pre} mm écrasée (exemple) ; ${C5.loads.Fb / 2} N chacune au sur-centre (exemple). Polyuréthane 90 Shore A à prévoir (la bibliothèque n'a qu'un silicone).`] });
}

/* ---------- the calculation ---------- */

/** The cam on its stop, computed on the outline drawn. → a calculation of the project */
export function camCalc5(L, pts) {
  const T = camTravel(pts), K = C5.loads, c = C5.cam, ramp = r3((T.stroke + T.over) / T.kMax * 180 / Math.PI);
  const inputs = { ...sessionDefaults("lever_cam"), r0: c.r0, s: c.stroke, a: c.flat, rc: c.rc, ramp, lever: L.lever, cams: 2, rp: C5.pivot.pin / 2, b: r3(C5.cam.t - 1), Fc: K.Fc, m: K.m, muS: K.muS, Fb: K.Fb, Fv: r3(K.m * 9.81 * K.g), mu: K.mu, muP: K.muP, E: K.E, pAdm: K.pAdm, wipe: K.wipe, Fhand: K.Fhand };
  const r = run("lever_cam", inputs);
  return { id: "phy-bm5-cam", name: `Came de la poignée en U — ${c.stroke} mm de course, ${Math.round(r.values.F_hand)} N à la main`, model: "lever_cam", part: "BM5-CAM", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-27T22:30:00.000Z",
    why: `Le profil dessiné, lu point par point : couchée, la came montre ${c.r0} mm à la butée ; relevée, elle monte de ${fr(T.stroke + T.over)} mm sur ${T.rampDeg}° (sommet à ${T.peakAt}°), puis le plat rend ${fr(T.over)} mm. Sa pente la plus forte, ${fr(T.kMax)} mm/rad, est celle d'une rampe constante de ${fr(ramp, 1)}° : c'est elle qui est entrée. Masse du module avec sa poignée, mesurée par l'outil sur l'assemblage : ${fr(K.m, 1)} kg. Efforts d'EXEMPLE : connector ${K.Fc} N (aucune fiche lue), frottement du module μ ${fr(K.muS)}, butées élastiques ${K.Fb} N, ${K.g} g pour ce qui veut ouvrir ; ${K.Fhand} N à la main admis avec une moufle à −40 °C (à confirmer).` };
}

/* ---------- concept 5, on the definition of concept 4 ---------- */

/** What the module of concept 4 measures, read on its parts (the frame of the module). */
export function moduleSizes(p) {
  const find = (id) => p.parts.find((x) => x.id === id), feat = (id, f) => find(id).features.find((q) => q.id === f);
  const end = (f) => f.at[1] + (f.op === "box" ? f.size[1] : f.h);
  const ring = feat("BM-LID-RING-TOP", "bride"), cap = feat("BM-LID-TOP", "plaque"), shaft = feat("BM-LATCH-CAM", "arbre"), lever = feat("BM-LATCH-CAM", "levier");
  const lid = feat("BM-LID-BOT", "coque");
  const conn = find("BM-SWAP-CONN"), cb = conn.features.reduce((b, f) => { if (f.op !== "box" || f.mode === "cut") return b; return { x0: Math.min(b.x0, f.at[0]), x1: Math.max(b.x1, f.at[0] + f.size[0]), z0: Math.min(b.z0, f.at[2]), z1: Math.max(b.z1, f.at[2] + f.size[2]), tip: Math.min(b.tip, f.at[1]) }; }, { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, tip: Infinity });
  return { out: { x0: ring.at[0], x1: r3(ring.at[0] + ring.size[0]) }, top: r3(ring.at[2] + ring.size[2]), bottom: ring.at[2], ringEnd: ring.at[1],
    back: r3(Math.max(end(cap), end(shaft), end(lever))), cap: r3(end(cap)), face: lid.at[1], plug: { x0: cb.x0, x1: cb.x1, z0: cb.z0, z1: cb.z1, tip: r3(cb.tip) } };
}

/** Concept 5, built on the definition of concept 4 : the definition p is changed in place. → { layout, travel, calc } */
export function conceptFive(p) {
  const m = moduleSizes(p), L = layout5(m), pts = camOutline(), T = camTravel(pts), band = contactBand(pts), find = (id) => p.parts.find((x) => x.id === id);
  /* the ears, on the interface ring of the top lid */
  const ring = JSON.parse(JSON.stringify(find("BM-LID-RING-TOP")));
  ring.features = [...ring.features.filter((f) => f.op !== "interfaces"), ...earFeatures(L, m.ringEnd)];
  ring.function = `${ring.function} Concept 5 : ses deux oreilles portent le pivot de la poignée en U, ${fr(L.yP - m.cap, 1)} mm derrière le couvercle ; la poussée de la came passe par elles.`;
  ring.notes = [...ring.notes, `Concept 5 : deux oreilles de ${C5.ear.t} mm le long des flancs, jusqu'au pivot (alésage Ø${fr(C5.pivot.bore)}, trou du pawl). Usinées avec l'anneau sur le dessin ; en série, rapportées et vissées — à revoir avec l'atelier. Elles travaillent en traction quand le module veut reculer, en compression quand la came le pousse.`];
  /* the parts */
  const parts = [handlePart(L), camPart(pts), pinPart(L), pawlPart(L), rodPart(L), triggerPart(L), swapPlate(L), stopPart(L, band), receptaclePart(L), bumperPart()];
  p.parts = [...p.parts.map((x) => (x.id === ring.id ? ring : x)), ...parts];
  /* the assemblies : the handle on the module ; the module on its swap surface */
  const xs = { camD: L.mir(L.cam[1]), pinD: L.mir(L.pin[0]), pawlD: L.mir(r3(L.arm[0] + 1)), rodG: r3(L.arm[0] + C5.arm.t / 2) }, flip = [0, 180, 0];
  const handle = { id: "BM5-HANDLE-ASM", name: "Poignée en U et ses cames", instances: [
    { id: "poignee", part: "BM5-HANDLE", fixed: true, placement: at([0, 0, 0]) },
    { id: "came_g", part: "BM5-CAM", fixed: true, placement: at([L.cam[0], 0, 0]) }, { id: "came_d", part: "BM5-CAM", fixed: true, placement: at([xs.camD, 0, 0]) },
    { id: "axe_g", part: "BM5-PIN", fixed: true, placement: at([L.pin[0], 0, 0]) }, { id: "axe_d", part: "BM5-PIN", fixed: true, placement: at([xs.pinD, 0, 0], flip) },
    { id: "pawl_g", part: "BM5-PAWL", fixed: true, placement: at([r3(L.arm[0] + 1), C5.pawl.y, 0]) }, { id: "pawl_d", part: "BM5-PAWL", fixed: true, placement: at([xs.pawlD, C5.pawl.y, 0], flip) },
    { id: "tringle_g", part: "BM5-ROD", fixed: true, placement: at([xs.rodG, 0, 14]) }, { id: "tringle_d", part: "BM5-ROD", fixed: true, placement: at([L.mir(xs.rodG), 0, 14]) },
    { id: "gachette", part: "BM5-TRIGGER", fixed: true, placement: at([0, 0, 0]) }], mates: [] };
  const mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM");
  mod.instances.push({ id: "poignee", asm: handle.id, fixed: true, placement: at([0, L.yP, L.zP]) });
  const B = C5.bumper, yB = r3(m.face - deep()), zB = 52;
  const swap = { id: "BM5-SWAP-ASM", name: "Interface d'échange — le BM barré sur sa swap surface", instances: [
    { id: "module", asm: "BM-8S8P-ASM", fixed: true, placement: at([0, 0, 0]) },
    { id: "surface", part: "BM5-SWAP-PLATE", fixed: true, placement: at([0, 0, 0]) },
    { id: "butee_g", part: "BM5-STOP", fixed: true, placement: at([stopX0(L), L.yS, m.bottom]) }, { id: "butee_d", part: "BM5-STOP", fixed: true, placement: at([r3(L.mir(stopX0(L)) - C5.stop.w), L.yS, m.bottom]) },
    { id: "receptacle", part: "BM5-RECEPT", fixed: true, placement: at([0, 0, 0]) },
    { id: "tampon_g", part: "BM5-BUMPER", fixed: true, placement: at([r3(m.out.x0 + B.d / 2 + 1), yB, zB]) }, { id: "tampon_d", part: "BM5-BUMPER", fixed: true, placement: at([r3(m.out.x1 - B.d / 2 - 1), yB, zB]) }], mates: [] };
  p.assemblies = [...p.assemblies, handle, swap];
  /* the calculation */
  const calc = camCalc5(L, pts);
  p.physics = [...p.physics, calc];
  p.description = `${p.description} — Concept 5 « U handle and asymmetric cams » (feuille CB-6.29 de DynamiteAgile), ajouté au concept 4 sans rien lui retirer : sa poignée d'échange — une poignée en U qui pivote derrière le couvercle du haut ; relevée, ses deux cames roulent sur les butées fixes de la swap surface, poussent le module de ${C5.cam.stroke} mm vers le connector, puis leur plat le barre ; gâchette et pawls en second verrou. Swap surface dessinée : rails, réceptacle, butées, tampons. Premier jet du concept 5, à itérer.`;
  return { layout: L, travel: T, band, calc };
}
