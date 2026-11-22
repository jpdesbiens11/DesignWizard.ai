/* DesignOrbit.ai — BM 8s8p - 21700, iteration 10 (JP, 22 novembre 2026, par menu : « fil LV et isolation des îlots, puis boîtier et borne du
   module » ; then « un boîtier extrudé en plastique le long des 8 modules qui contient ces 8 derniers… l'interface des 2 couvercles est vissée
   au casing central — des trous sont extrudés dans la section centrale et des vis autotaraudeuses se font des filets au premier assemblage »).
   What is drawn here : the CASING — a profile of polycarbonate extruded along Y, the 8 CORE slid inside on two floor rails and four side ribs ;
   a screw port in each corner, in a lobe outside the walls (the corners of the cavity are taken by the board and the flex) ; under the floor, a
   closed channel for the return busbar of iteration 11 (its section sized here, its bar not drawn) — the channel's keel and the four lobes
   also guide the module in its cavity or its charging station. The two TERMINALS of the module : the − terminal, at the bottom end, is a flat
   face like a + leg, its four LV lands flush (the RS-485 chain comes in there from the central BMS) ; the + terminal, at the top end, is a flat
   face like a − leg, its LV lands flush (the end of the chain). Iteration 12 : the joints are face against face (demo_bm_contacts.js).
   Read : the pre-hole and the depth of a thread-forming screw for plastics — EVO PT (EJOT), on the page of its licensee Semblex : hole
   0.85 × d1 ± 0.05 mm, installation depth 2 × d1 or more, counterbore 1.05 × d1, 0.1 × d1 deep. Not read : the boss diameter (no ratio is
   printed there ; the tool keeps a wall as thick as the casing around the hole), the pull-out of the screw in PC (the maker's EVO CALC), the
   values of an extruder for this section. Every size is an EXAMPLE ; the frame is the frame of a CORE (X its length, Z up, the cells on
   z = 0) — the casing runs along Y. */

import { run, sessionDefaults } from "../analysis/physics/index.js";
import { ISLAND, contactLayout } from "./demo_bm_contacts.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(r3(v)).replace(".", ",");
/** The section, around the envelope of a CORE (measured on its parts : x 0 to 92.8 — the board ; the flex panel at 0.7, and 92.1 kept for the
    symmetry of the section ; z −3.8 — the clipped plate under the CORE — to 82.55, the tallest component). */
export const CASE = {
  t: 2.5,      // the wall, the same everywhere (the tool's rule for a plastic section whose circumscribed circle is above 150 mm)
  side: 1.5, floor: 1.7, top: 1.7,      // from the CORE to the walls of the cavity : beside the board, under the flex, over the components
  rib: { h: 1.7, w: 3, z: [3, 66] },      // the side ribs : they touch the flex panels where the holders stand behind them (0.5 mm of play)
  rail: { h: 1.2, w: 4, dx: 23.2 },      // the floor rails, 23.2 mm each side of the middle : the flex under the CORE rides on them (0.5 mm of play)
  port: { d1: 4, hole: 3.4, ext: 2.8, depth: 12, cb: 4.2, cbDepth: 0.4, a: 3 },      // EVO PT 40 : the hole 0.85 × d1 drilled 12 mm at each end (2 × d1 = 8 at least) ; the profile is extruded at Ø2.8
  keel: { clr: 0.5 },      // the channel : the bar of the return busbar and 0.5 mm all round
  r: { cavity: 1, rib: 0.5, keel: 1, fillet: 1, channel: 0.5 },
};
/** The return busbar of iteration 11 : the section the channel is made for — 50 × 4 mm of copper (the tool's model below). */
export const RETURN = { w: 50, t: 4, L: 460 };
/** The CORE, as the casing sees it. */
export const CORE_ENV = { x0: 0, x1: 92.8, flex0: 0.7, flex1: 92.1, z0: -3.8, z1: 82.55 };

/** The numbers of the section : cavity, walls, keel, channel, lobes and their ports. → { cavity, outer, keel, channel, ports, R, xm, zm } */
export function caseSection(env = CORE_ENV, C = CASE) {
  const t = C.t, xm = env.xm ?? (env.x0 + env.x1) / 2;      // concept 3 : the cavity widens at +X for the forks, the keel and the rails stay under the CORE
  const cav = { x0: env.x0 - C.side, x1: env.x1 + C.side, z0: env.z0 - C.rail.h - 0.5, z1: env.z1 + C.top };      // the rails stand 0.5 mm under the flex
  const outer = { x0: cav.x0 - t, x1: cav.x1 + t, z0: cav.z0 - t, z1: cav.z1 + t };
  const ch = { w: RETURN.w + 2 * C.keel.clr, h: RETURN.t + 2 * C.keel.clr }, channel = { x0: xm - ch.w / 2, x1: xm + ch.w / 2, z1: outer.z0, z0: outer.z0 - ch.h };
  const keel = { x0: channel.x0 - t, x1: channel.x1 + t, z0: channel.z0 - t };
  const a = C.port.a, R = C.port.hole / 2 + t;      // a lobe : a wall as thick as the casing around the hole
  const ports = [[cav.x0 - a, cav.z0 - a], [cav.x1 + a, cav.z0 - a], [cav.x1 + a, cav.z1 + a], [cav.x0 - a, cav.z1 + a]].map((p) => p.map(r3));
  return { cavity: cav, outer, keel, channel, ports, R, xm, zm: (cav.z0 + cav.z1) / 2, d: r3(outer.x0 - ports[0][0]) };
}

/* The outline, as SVG path data (y up) : the walls, a lobe at each corner joined to its two walls by a fillet of radius rf, the keel under
   the floor. A fillet lies in the air, tangent to the wall and to the lobe : its centre is at rf from the wall and at R + rf from the lobe. */
function lobeJoint(d, R, rf) {      // in a corner frame : the outer corner at the origin, the wall along +u (its surface v = 0), the lobe centred at (−d, −d)
  const uf = -d + Math.sqrt((R + rf) ** 2 - (d - rf) ** 2), c = [uf, -rf], k = R / (R + rf);
  return { wall: [uf, 0], lobe: [-d + (c[0] + d) * k, -d + (c[1] + d) * k] };
}
const N = (v) => String(r3(v));
export function outlinePath(S, C = CASE) {
  const { outer: O, keel: K, R } = S, rf = C.r.fillet, rk = C.r.keel, J = lobeJoint(S.d, R, rf);
  const corner = { bl: (u, v) => [O.x0 + u, O.z0 + v], br: (u, v) => [O.x1 - u, O.z0 + v], tr: (u, v) => [O.x1 - u, O.z1 - v], tl: (u, v) => [O.x0 + u, O.z1 - v] };
  const P = (p) => `${N(p[0])} ${N(p[1])}`, arc = (r, large, sweep, p) => `A ${N(r)} ${N(r)} 0 ${large} ${sweep} ${P(p)}`;
  /* around one lobe, coming along the first wall : fillet (clockwise), the lobe (counter-clockwise, more than a half turn), fillet */
  const turn = (k, first) => { const m = corner[k], a = first === "u" ? J : { wall: [J.wall[1], J.wall[0]], lobe: [J.lobe[1], J.lobe[0]] }, b = first === "u" ? { wall: [J.wall[1], J.wall[0]], lobe: [J.lobe[1], J.lobe[0]] } : J;
    return [arc(rf, 0, 0, m(...a.lobe)), arc(R, 1, 1, m(...b.lobe)), arc(rf, 0, 0, m(...b.wall))].join(" "); };
  const bl = corner.bl, br = corner.br, tr = corner.tr, tl = corner.tl;
  return [`M ${P(bl(...J.wall))}`, `L ${P([K.x0 - rk, O.z0])}`, arc(rk, 0, 0, [K.x0, O.z0 - rk]), `L ${P([K.x0, K.z0 + rk])}`, arc(rk, 0, 1, [K.x0 + rk, K.z0]),
    `L ${P([K.x1 - rk, K.z0])}`, arc(rk, 0, 1, [K.x1, K.z0 + rk]), `L ${P([K.x1, O.z0 - rk])}`, arc(rk, 0, 0, [K.x1 + rk, O.z0]),
    `L ${P(br(...J.wall))}`, turn("br", "u"), `L ${P(tr(J.wall[1], J.wall[0]))}`, turn("tr", "v"), `L ${P(tl(...J.wall))}`, turn("tl", "u"),
    `L ${P(bl(J.wall[1], J.wall[0]))}`, turn("bl", "v"), "Z"].join(" ");
}
/** The cavity, ribs and rails included : a polygon whose corners are rounded. */
export function cavityPoly(S, C = CASE, env = CORE_ENV) {
  const c = S.cavity, rc = C.r.cavity, rr = C.r.rib, rl = C.rail, rb = C.rib, xa = env.flex0 - 0.5, xb = env.flex1 + 0.5, zr = c.z0 + rl.h;
  const rails = [S.xm - rl.dx, S.xm + rl.dx].flatMap((x) => [[x - rl.w / 2, c.z0, rr], [x - rl.w / 2, zr, rr], [x + rl.w / 2, zr, rr], [x + rl.w / 2, c.z0, rr]]);
  const ribs = (x, sgn) => rb.z.flatMap((z) => [[c[sgn > 0 ? "x1" : "x0"], z - rb.w / 2, rr], [x, z - rb.w / 2, rr], [x, z + rb.w / 2, rr], [c[sgn > 0 ? "x1" : "x0"], z + rb.w / 2, rr]]);
  const right = ribs(xb, 1), left = ribs(xa, -1).reverse();
  return [[c.x0, c.z0, rc], ...rails, [c.x1, c.z0, rc], ...right, [c.x1, c.z1, rc], [c.x0, c.z1, rc], ...left].map(([x, z, r]) => [r3(x), r3(z), r]);
}

/** The casing. o : { L (length along Y), Y0 (where its −Y end is, in the module) } → a part (its own frame : y from 0 to L) */
export function casingPart(o) {
  const E = o.env || CORE_ENV, S = caseSection(E), C = CASE, Pt = C.port, L = o.L, ch = S.channel;
  const profile = { outer: { path: outlinePath(S) }, holes: [{ poly: cavityPoly(S, C, E) }, { rect: [ch.x0, ch.z0, ch.x1 - ch.x0, ch.z1 - ch.z0], r: C.r.channel }, ...S.ports.map((p) => ({ circle: [p[0], p[1], Pt.ext] }))] };
  const env = (name, x0, x1, z0, z1, clearance) => ({ name, w: r3(x1 - x0), h: r3(z1 - z0), at: [r3((x0 + x1) / 2), r3((z0 + z1) / 2)], clearance });
  const at = S.ports.map((p) => [p[0], p[1]]), cb = { d: Pt.cb, depth: Pt.cbDepth };
  const lid = (face, name, key, partner) => ({ id: face === "-Y" ? "IF1" : "IF2", type: "bolt_pattern", name, key, partner, side: "B", face, at: [S.xm, r3((S.ports[0][1] + S.ports[2][1]) / 2)],
    params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: r3(S.ports[1][0] - S.ports[0][0]), dy: r3(S.ports[2][1] - S.ports[1][1]) } }, opts: { depth: Pt.depth, port: true } });
  return { dw: "part/1", id: "BM-CASING", name: "Boîtier extrudé du module", family: "extrusion", process: "extrusion_plastic", material: "PC", revision: "A",
    function: "Contient les 8 CORE, glissés sur deux rails du fond et tenus par quatre nervures de côté ; porte aux quatre coins les vis des deux couvercles, dans des trous venus d'extrusion ; sous le fond, le canal fermé du busbar de retour. Sa quille et ses quatre lobes guident le module dans sa cavité ou sa station de recharge.",
    params: { L: { value: L, unit: "mm", label: "Longueur coupée", min: 300, max: 800, step: 0.5, group: "Enveloppe" } },
    extrusion: { axis: "Y", length: "L", profile, inside: [env("CORE — carte et composants", E.x0, Math.min(E.x1, CORE_ENV.x1), 72.7, E.z1, 0.3), env("CORE — flex et supports", E.flex0, E.flex1, E.z0, 72.7, 0.3),
      env("Busbar de retour (itération 11)", S.xm - RETURN.w / 2, S.xm + RETURN.w / 2, ch.z0 + C.keel.clr, ch.z1 - C.keel.clr, 0.3)] },
    features: [{ op: "interfaces" },
      { op: "hole", id: "vis_fond", name: "Trous des vis du couvercle du fond (percés, lamés)", face: "-Y", at, d: Pt.hole, depth: Pt.depth, cbore: cb },
      { op: "hole", id: "vis_haut", name: "Trous des vis du couvercle du haut (percés, lamés)", face: "+Y", at, d: Pt.hole, depth: Pt.depth, cbore: cb },
      { op: "box", id: "fenetre_retour", name: "Fenêtre fraisée dans le fond, au bout haut — la languette du busbar de retour y monte", mode: "cut", at: [ch.x0, r3(L - 14), r3(ch.z1 - 0.2)], size: [r3(ch.x1 - ch.x0), 15, 4] }],
    interfaces: [lid("-Y", "Fixation du couvercle du fond", "bm_casing_lid_bottom", "Couvercle du fond"), lid("+Y", "Fixation du couvercle du haut", "bm_casing_lid_top", "Couvercle du haut")],
    look: { color: "#cfe4f2", opacity: 0.35 },
    notes: [`Polycarbonate d'une nuance V-0 à choisir (exemple), extrudé : paroi de ${fr(C.t)} mm partout, section ${fr(S.outer.x1 - S.outer.x0)} × ${fr(S.outer.z1 - S.keel.z0)} mm hors lobes ; coupé à ${fr(L)} mm.`,
      `Vis des couvercles : quatre vis pour plastiques EVO PT 40 (EJOT) par bout, prises dans des trous venus d'extrusion (Ø${fr(Pt.ext)}) que l'on perce à Ø${fr(Pt.hole)} ± 0,05 sur ${Pt.depth} mm et que l'on lame à Ø${fr(Pt.cb)} × ${fr(Pt.cbDepth)} mm aux deux bouts — 0,85 × d1, au moins 2 × d1 de prise, lamage 1,05 × d1 sur 0,1 × d1 : valeurs du fabricant de la vis, lues. Une section extrudée tient d'usage ± 0,3 mm : le trou se fait donc en reprise là où la vis travaille. La vis forme son filet au premier vissage.`,
      `Les trous sont fermés, dans un lobe de ${fr(2 * S.R)} mm, une paroi de ${fr(C.t)} mm autour : la vis pousse la matière vers l'extérieur, un canal ouvert en « C » s'écarterait (choix de l'outil). Le diamètre du lobe n'est pas dans ce qui a été lu du fabricant de la vis, ni la tenue à l'arrachement dans le PC : à calculer avec son outil (EVO CALC) quand l'effort du latch sera connu (itération 11).`,
      "Profilé fermé, six creux (la cavité, le canal, quatre trous) : une filière à mandrin et un calibrage — à discuter avec l'extrudeur, avec la planéité des grandes parois (± 0,3 mm d'usage à confirmer).",
      `Les CORE ne touchent le boîtier que par les deux rails du fond et les quatre nervures de côté, 0,5 mm de jeu : la plaque clipsée sous le support du bas glisse sur les rails quand on pose un CORE (itération 12 : le flex est dans la fente, à l'abri) ; la nervure du côté +X fait face à la barre du support, il n'y a plus de panneau de flex de ce côté.`,
      `Canal du busbar de retour : ${fr(ch.x1 - ch.x0)} × ${fr(ch.z1 - ch.z0)} mm, pour une barre de ${RETURN.w} × ${RETURN.t} mm (calcul gardé dans le projet) ; au bout haut, une fenêtre fraisée dans le fond laisse monter sa languette vers le couvercle.`] };
}

/** The terminals. Every plate is drawn in the frame of the CORE it touches : the − terminal in that of CORE 1, the + terminal in that of CORE 8.
    o : { Y (the width of the CORE), ins, t (the copper of a leg), gap (between two CORE), X } → { neg, pos } */
export function terminalParts(o) {
  const T = 2, B = 3, x0 = 3, x1 = o.X - 3, z0 = -3, z1 = 80, L = contactLayout(o.X), I = ISLAND, studs = [[o.X / 2 - 25, 76.5], [o.X / 2 + 25, 76.5]];
  const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, body, at, size, ...(mode ? { mode } : {}) });
  const cyl = (id, name, body, at, d, h, mode) => ({ op: "cylinder", id, name, body, at, d, h, axis: "Y", ...(mode ? { mode } : {}) });
  const make = (neg) => {
    const face = neg ? o.Y + o.ins + o.t - (o.Y + 2 * (o.ins + o.t) + o.gap) : -(o.ins + o.t) + (o.Y + 2 * (o.ins + o.t) + o.gap);      // the face that meets the CORE
    const s = neg ? 1 : -1, back = face - s * T, bk = back - s * B, zb = neg ? 71 : 66, lo = (a, b) => Math.min(a, b), feats = [], bodies = {
      plaque: { material: "CU-C110", kind: "conductor", net: neg ? "PACK-" : "PACK+", label: `Plaque de cuivre de la borne ${neg ? "−" : "+"}` },
      appui: { material: "PA66-GF30", kind: "insulator", label: "Plaque d'appui isolante" }, isolant_lv: { material: "PA66-GF30", kind: "insulator", label: "Inserts isolants des contacts LV" },
      ...(neg ? { goujons: { material: "STEEL-1018", kind: "conductor", net: "PACK-", label: "Goujons sertis M6" } } : {}) };
    feats.push(box("plaque", "Plaque de cuivre", "plaque", [x0, lo(face, back), z0], [x1 - x0, T, z1 - z0]), box("appui", "Plaque d'appui isolante", "appui", [x0, lo(back, bk), z0], [x1 - x0, B, zb - z0]));
    if (neg) for (const [k, p] of studs.entries()) feats.push(cyl(`goujon_${k + 1}`, `Goujon serti M6 ${k + 1} — liaison au couvercle`, "goujons", [p[0], back - 12, p[1]], 6, 12));
    for (const c of L.lv) {
      const k = c.net.replace(/[^A-Za-z0-9]/g, "").toLowerCase(), top = face, land = `lv_${k}`;
      bodies[land] = { material: "CU-C110", kind: "conductor", net: c.net, label: `Plage ${c.net} de la borne ${neg ? "−" : "+"}, dorée` };
      feats.push(cyl(`trou_${k}`, `Trou de l'îlot ${c.net}`, "plaque", [c.x, lo(face, back) - 0.2, c.z], I.hole, T + 0.4, "cut"),
        cyl(`ilot_${k}`, `Insert isolant de ${c.net}`, "isolant_lv", [c.x, lo(top, back), c.z], I.insert, Math.abs(top - back)),
        cyl(`ilot_${k}_creux`, `Logement de la plage de ${c.net}`, "isolant_lv", [c.x, neg ? top - I.landT : top - 0.1, c.z], I.land + 0.2, I.landT + 0.1, "cut"),
        cyl(`plage_${k}`, `Plage dorée de ${c.net}`, land, [c.x, neg ? top - I.landT : top, c.z], I.land, I.landT),
        cyl(`fil_${k}`, `Passage du fil de ${c.net}`, "appui", [c.x, lo(back, bk) - 0.2, c.z], 4, B + 0.4, "cut"));
    }
    const sign = neg ? "−" : "+";
    return { dw: "part/1", id: neg ? "BM-TERM-NEG" : "BM-TERM-POS", name: `Borne ${sign} du module`, family: "busbar", process: "purchased", material: "CU-C110", revision: "A", params: {}, bodies, features: feats, interfaces: [],
      function: neg ? "Le bout − de la chaîne des 8 CORE, au fond du boîtier : une face plane comme une jambe +, posée sur la jambe − du CORE 1 ; ses quatre plages LV affleurantes amènent le RS-485 du BMS central dans la chaîne."
        : "Le bout + de la chaîne, en haut du boîtier : une face plane comme une jambe −, où se pose la jambe + du CORE 8 ; ses plages LV ferment la chaîne.",
      notes: [`Cuivre de ${T} mm (C110), argenté sur sa face de contact ; plaque d'appui isolante de ${B} mm (PA66-GF30, exemple) entre la borne et le couvercle, qui transmet l'effort de la pile sans conduire.`,
        neg ? "En haut, au dos, la plage de liaison reste nue : deux goujons sertis M6 à tête affleurante (exemple) y reçoivent le conducteur du couvercle du fond — vers le contacteur et le connecteur (itération 11 b)."
          : "En haut, au dos, une plage de 14 mm reste nue, argentée : le plot A du couvercle du haut y appuie, face contre face — le couvercle retiré, le module est ouvert (itération 11).",
        neg ? "Ses plages LV affleurent comme celles d'une jambe + ; au dos, un fil par îlot passe la plaque d'appui vers le BMS central (itération 11)."
          : "Ses plages LV sont celles d'une jambe −, affleurantes. Les 8 cartes sont identiques et sans terminaison (bloc RS-485 du PCBA : terminaison « non ») : la terminaison de 120 Ω du bout de la chaîne se pose ici, entre les plages A et B — l'autre est au BMS central.",
        "Une pièce de spécialiste (busbar) : faite chez son fabricant, elle ne se joue pas dans l'atelier de fab."] };
  };
  return { neg: make(true), pos: make(false) };
}

/** The calculation that sized the channel, kept in the project : the return busbar, 50 × 4 mm, carries the 360 A of the module along it. */
export function returnSizing(I) {
  const inputs = { ...sessionDefaults("busbar"), w: RETURN.w, t: RETURN.t, L: RETURN.L, I, Ta: 40, Tmax: 60 }, r = run("busbar", inputs);
  return { id: "phy-bm-return", name: `Busbar de retour — ${RETURN.w} × ${RETURN.t} mm, ${I} A`, model: "busbar", part: "BM-CASING", inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T12:00:00.000Z",
    why: `Le courant du module, ${I} A, ramené du bout + au couvercle du fond le long du boîtier ; limite ${inputs.Tmax} °C, l'ambiante que la P45B admet en décharge. Barre seule en convection naturelle : dans son canal fermé, l'échauffement réel est plus fort — à vérifier avec le module fermé.` };
}

/** The paths of the machining phases of the casing, written by an AI (Claude) as answers to the request of the shop : drill, ream and counterbore
    the four screw holes of each end. In the frame of the part ; the tool comes along Y. */
export function casingPaths(L, env) {
  const S = caseSection(env), P = CASE.port, BY = "Claude (IA) — exemple de démonstration", n = (v) => String(r3(v));
  const pass = (sgn, tool, d, depth, note) => { const y0 = sgn > 0 ? 0 : L, far = y0 - sgn * 20, near = y0 - sgn * 2, end = y0 + sgn * depth, lines = ["G21 G90"];
    S.ports.forEach((p, k) => { lines.push(`G0 X${n(p[0])} Y${n(far)} Z${n(p[1])}`, `G0 Y${n(near)}`, `G1 Y${n(end)}`, `G0 Y${n(far)}`); });
    return { tool, d, by: BY, note, gcode: lines.join("\n") }; };
  const side = (sgn) => [pass(sgn, "drill", 3.3, P.depth + 0.5, `Avant-trou Ø3,3 dans le trou extrudé Ø${fr(P.ext)}, sur ${fr(P.depth + 0.5)} mm : un foret court et rigide, le trou existant le guide mal — pointer d'abord si le trou extrudé est décentré de plus de 0,1 mm.`),
    pass(sgn, "reamer", P.hole, P.depth, `Alésoir Ø${fr(P.hole)} sur ${P.depth} mm : ± 0,05 mm, ce que demande le fabricant de la vis. Dans le polycarbonate, un alésoir affûté pour les plastiques, sans lubrifiant qui l'attaque.`),
    pass(sgn, "endmill", P.cb, P.cbDepth, `Lamage Ø${fr(P.cb)} × ${fr(P.cbDepth)} mm (1,05 × d1, 0,1 × d1) : une fraise à bout plat ou un outil à lamer, plongée seule.`)];
  return { "setup:-Y": side(1), "setup:+Y": side(-1) };
}
