/* DesignWizard.ai — BM 8s8p - 21700 : the contacts between two CORE, iteration 9 (JP, 21 novembre 2026, on a capture of the crowns : « ces
   contacts n'ont pas l'air réalistes et possibles ; s'il le faut imite un design de ce genre d'interface et fais-les en lamelles
   unidirectionnelles, en te basant sur un cas réel de l'industrie, fais tes devoirs… on améliore » ; and, the menu closed by a message : the
   recommended choice, 4 LV contacts — RS-485 A and B, the supply of the bus side +5V_ISO and its ground GND_ISO, as the chain connectors of the
   CORE board carry them).
   Read from the makers' public documents (sources in docs/BM_MODULE.md and in the register of the tool) : a louvred contact strip between two
   flat faces — the strip of Weftron LOUVER_tron 112 (12 mm wide, louvres every 3.5 mm, copper plates on a stainless spring, no beryllium,
   silver 25 µm at least, a working height of 1.5 to 1.9 mm, p. 2) ; the same width and pitch as Stäubli's MULTILAM LA-CU, whose louvre is
   printed at 40 A and 0.3 mΩ (its product page) and 7 N (The MULTILAM Principle, p. 16). The strips of a joint are held by a plastic frame on
   the face, as a busbar-to-busbar frame of the trade holds its strips (Stäubli ClipLam) ; the gap between the two faces — the working height
   of the strip — is held by copper stops, which carry the force of the module. The signal contacts are short gold-plated leaf louvre strips
   (the LAV type of the makers : 5 mm wide, a louvre about 0.56 mm high free, TE p. 32) on raised insulating islands.
   Every size is an EXAMPLE, said on each part ; what the documents print is said as read. Pure : the layout, the parts, what the contacts add
   to the laminated busbar, the calculation kept in the project. */

import { run, sessionDefaults } from "../analysis/physics/index.js";

/** The gap the stops hold between the + leg of a CORE and the − leg of the next : the middle of the working range of the strip (1.5–1.9 mm). */
export const GAP = 1.7, GAP_TOL = 0.05;
export const STRIPS = {
  hv: { id: "BM-LAM-HV", w: 12, L: 40, p: 3.5, t: 0.15, h: GAP, rail: 1.2, e: 0.4, s: 0.9, color: "#c9ced6" },      // e : the thickness of a louvre as drawn ; s : half its lean along the strip
  lv: { id: "BM-LAM-LV", w: 5, L: 6, p: 0.8, t: 0.1, h: 0.45, free: 0.56, rail: 0.6, e: 0.2, s: 0.2, color: "#e2b340" } };
export const STOP = { id: "BM-STOP", d: 8 }, CAGE = { id: "BM-LAM-CAGE", t: 1.0, rim: 2 };
export const ISLAND = { insert: 10, hole: 10.4, land: 7, landT: 0.3, raise: GAP - STRIPS.lv.h };      // the LV land of the + leg stands `raise` above the face : its strip works at its height
export const LV_NETS = ["GND_ISO", "RS485_A", "RS485_B", "+5V_ISO"];
const fr = (v) => String(v).replace(".", ",");
export const MARK = { hv: { h: 2.5, w: 0.3 }, lv: { h: 2, w: 0.25 }, depth: 0.05 };

/** Where the contacts are on a leg, in the frame of the CORE (X the length of the CORE) : two HV strips along Z, four LV islands in a row low on
    the leg (their flex tails come up from under the CORE), four stops. */
export function contactLayout(X) {
  const xm = X / 2;
  return { hv: [{ id: "HV1", x: xm - 22, z0: 22, z1: 62, mark: [9.5, 42] }, { id: "HV2", x: xm + 22, z0: 22, z1: 62, mark: [X - 9.5, 42] }],
    lv: LV_NETS.map((net, k) => ({ id: `LV${k + 1}`, net, x: xm - 27 + 18 * k, z: 12, mark: ["0V", "A", "B", "5V"][k] })),
    stops: [[8, 30], [X - 8, 30], [8, 60], [X - 8, 60]] };
}
const slug = (net) => net.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const box = (id, name, body, at, size, mode) => ({ op: "box", id, name, body, at, size, ...(mode ? { mode } : {}) });
const cyl = (id, name, body, at, d, h, mode) => ({ op: "cylinder", id, name, body, at, d, h, axis: "Y", ...(mode ? { mode } : {}) });
/** The text the laser marks beside a contact : on the + leg (s > 0, read from +Y) or on the − leg (read from −Y). */
const marking = (id, text, at, kind, body, y, s) => ({ op: "mark", id, name: `Marquage laser « ${text} »`, body, face: s > 0 ? "+Y" : "-Y", start: y, at, dir: [-s, 0], text, h: MARK[kind].h, w: MARK[kind].w, depth: MARK.depth });

/** A louvred strip, as installed (its louvres leaning, pressed to the working height h) : two rails along Z on the face y, the louvres across
    them. Drawn in the frame of the CORE at x, from z0 ; the copies are moved along the leg. */
export function stripPart(kind, x, z0, y) {
  const S = STRIPS[kind], hv = kind === "hv", n = Math.floor(S.L / S.p + 1e-9), feats = [
    box("rail_a", "Bord de la bande", "main", [x - S.w / 2, y, z0], [S.rail, S.t, S.L]), box("rail_b", "Bord de la bande", "main", [x + S.w / 2 - S.rail, y, z0], [S.rail, S.t, S.L])];
  for (let k = 0; k < n; k++) { const zc = z0 + S.p / 2 + k * S.p;
    feats.push({ op: "extrude", id: `lamelle_${k + 1}`, name: `Lamelle ${k + 1}`, body: "main", plane: "YZ", at: x - S.w / 2, length: S.w,
      profile: { poly: [[y, zc - S.s - S.e / 2], [y, zc - S.s + S.e / 2], [y + S.h, zc + S.s + S.e / 2], [y + S.h, zc + S.s - S.e / 2]] } }); }
  return { dw: "part/1", id: S.id, name: hv ? "Bande de contact HV à lamelles" : "Bande de contact LV à lamelles, dorée", family: "contact", process: "purchased", material: hv ? "CU-C110" : "CUBE-C17200", revision: "A",
    bodies: { main: { material: hv ? "CU-C110" : "CUBE-C17200", kind: "conductor", label: hv ? "Bande à lamelles (argentée)" : "Bande à lamelles (dorée)" } }, params: {}, features: feats, interfaces: [],
    function: hv ? "Le contact de puissance entre deux CORE : une bande à lamelles tenue dans son cadre sur la jambe +, écrasée par la jambe − du CORE voisin jusqu'à la hauteur que tiennent les butées."
      : "Un contact du signal entre deux CORE (RS-485 A ou B, +5V_ISO, GND_ISO) : une courte bande à lamelles dorée sur la plage surélevée d'un îlot de la jambe +, écrasée sur la plage de l'îlot d'en face.",
    notes: hv ? [`${n} lamelles au pas de ${fr(S.p)} mm sur ${S.L} mm, ${S.w} mm de large — l'enveloppe d'une bande du commerce : LOUVER_tron 112 de Weftron (plaques de cuivre sur un ressort en inox, sans béryllium, argent 25 µm au moins, hauteur de travail 1,5 à 1,9 mm — fiche, p. 2, lue), même largeur et même pas que la MULTILAM LA-CU de Stäubli. La référence et ses valeurs se confirment avec le fabricant.`,
        `Dessinée posée, à sa hauteur de travail de ${fr(S.h)} mm : les lamelles inclinées touchent la jambe d'en face. Elle se coupe à la longueur et se pose dans son cadre (BM-LAM-CAGE) ; elle n'est ni soudée ni brasée : elle se remplace.`,
        "Les plages des deux jambes sont argentées là où la bande appuie, comme le demandent les fabricants pour les valeurs de leurs fiches (cuivre argenté propre, rugosité N6) ; graisse de contact selon la fiche."]
      : [`${n} lamelles au pas de ${fr(S.p)} mm sur ${S.L} mm, ${S.w} mm de large, dorées — le type à lame « LAV » des fabricants (5 mm de large ; une lamelle de 0,56 mm de haut libre chez TE, catalogue p. 32, lu). Le pas exact et la hauteur de travail de ce type ne sont pas publiés dans ce qui a été lu : ${fr(S.p)} mm et ${fr(S.h)} mm sont des exemples.`,
        "Brasée ou clipsée sur la plage dorée de son îlot ; aucune valeur de résistance n'est publiée pour les versions dorées lues : à mesurer sur l'îlot réel."] };
}
/** The frame that holds the HV strips on the + leg : an insulating plate thinner than the gap — it never carries the force of the module. */
export function cagePart(L, y) {
  const S = STRIPS.hv, C = CAGE, feats = [];
  for (const c of L.hv) feats.push(box(`cadre_${c.id.toLowerCase()}`, `Cadre de ${c.id}`, "main", [c.x - S.w / 2 - C.rim, y, c.z0 - C.rim], [S.w + 2 * C.rim, C.t, S.L + 2 * C.rim]),
    box(`fenetre_${c.id.toLowerCase()}`, `Fenêtre de ${c.id}`, "main", [c.x - S.w / 2 - 0.2, y - 0.1, c.z0 - 0.2], [S.w + 0.4, C.t + 0.2, S.L + 0.4], "cut"));
  return { dw: "part/1", id: C.id, name: "Cadre des bandes HV", family: "insulator", process: "injection_molding", material: "PA66-GF30", revision: "A", params: {}, features: feats, interfaces: [], elec: { kind: "insulator" },
    function: "Tient les deux bandes HV à leur place sur la jambe + : une fenêtre par bande, comme le cadre plastique d'un joint busbar-busbar du commerce ; plus mince que l'écart, il ne porte pas l'effort du module.",
    notes: [`PA66-GF30, ${fr(C.t)} mm d'épaisseur pour ${fr(GAP)} mm d'écart (exemple) ; collé sur la jambe ou clipsé dans deux trous — à choisir avec le fabricant du busbar.`] };
}
/** A stop : a silver-plated copper spacer brazed on the + leg, as high as the gap. It holds the working height of the strips and carries the force of the module. */
export function stopPart(at, y) {
  return { dw: "part/1", id: STOP.id, name: "Butée entre deux CORE", family: "contact", process: "cnc_turning", material: "CU-C110", revision: "A", params: {},
    features: [cyl("butee", "Butée", "main", [at[0], y, at[1]], STOP.d, GAP)], interfaces: [],
    function: "Tient l'écart entre la jambe + d'un CORE et la jambe − du suivant — la hauteur de travail des bandes — et porte l'effort qui presse le module.",
    notes: [`Cuivre argenté, Ø${STOP.d} × ${fr(GAP)} mm, hauteur à ± ${fr(GAP_TOL)} mm : c'est elle qui fixe l'écrasement des lamelles (plage de la bande : 1,5 à 1,9 mm). Brasée sur la jambe + ; les deux jambes qu'elle sépare sont au même potentiel — elle conduit aussi.`, "Quatre par CORE, aux coins de la jambe, hors des bandes et des îlots."] };
}

/** What the contacts add to the laminated busbar : the LV islands of both legs (an insulating insert in a hole of the copper, a gold land in it —
    raised on the + leg), the engraved frames around the HV lands of the − leg, the laser marks. o : { Y, ins, t } ; L : contactLayout. */
export function busbarContacts(L, o) {
  const Yp = o.Y + o.ins + o.t, Ym = -(o.ins + o.t), S = STRIPS.hv, I = ISLAND, features = [];
  const bodies = { isolant_lv: { material: "PA66-GF30", kind: "insulator", label: "Inserts isolants des contacts LV" } };
  for (const c of L.hv) {
    const k = c.id.toLowerCase(), g = 0.4, d = MARK.depth;
    features.push(box(`gravure_${k}m`, `Gravure laser — cadre de la plage ${c.id} (jambe −)`, "moins", [c.x - S.w / 2 - 1 - g, Ym, c.z0 - 1 - g], [S.w + 2 + 2 * g, d, S.L + 2 + 2 * g], "cut"),
      box(`gravure_${k}m_in`, `Gravure laser — intérieur du cadre de ${c.id}`, "moins", [c.x - S.w / 2 - 1, Ym, c.z0 - 1], [S.w + 2, d, S.L + 2]),
      marking(`texte_${k}p`, `${c.id} +`, c.mark, "hv", "plus", Yp, 1), marking(`texte_${k}m`, `${c.id} −`, c.mark, "hv", "moins", Ym, -1));
  }
  for (const c of L.lv) for (const [side, s] of [["p", 1], ["m", -1]]) {
    const k = `${slug(c.net)}_${side}`, body = s > 0 ? "plus" : "moins", base = s > 0 ? o.Y + o.ins : Ym, face = s > 0 ? Yp : -o.ins, top = s > 0 ? Yp + I.raise : Ym;
    const land = `lv_${k}`; bodies[land] = { material: "CU-C110", kind: "conductor", net: c.net, label: `Plage ${c.net} (jambe ${s > 0 ? "+" : "−"}), dorée` };
    features.push(cyl(`trou_${k}`, `Trou de l'îlot ${c.net} dans la jambe ${s > 0 ? "+" : "−"}`, body, [c.x, Math.min(base, face) - 0.2, c.z], I.hole, Math.abs(face - base) + 0.4, "cut"),
      cyl(`ilot_${k}`, `Insert isolant de ${c.net}${s > 0 ? `, surélevé de ${fr(I.raise)} mm` : ""}`, "isolant_lv", [c.x, s > 0 ? base : top, c.z], I.insert, s > 0 ? top - base : -o.ins - top),
      cyl(`ilot_${k}_creux`, `Logement de la plage de ${c.net}`, "isolant_lv", [c.x, s > 0 ? top - I.landT : top - 0.1, c.z], I.land + 0.2, I.landT + 0.1, "cut"),
      cyl(`plage_${k}`, `Plage dorée de ${c.net}`, land, [c.x, s > 0 ? top - I.landT : top, c.z], I.land, I.landT),
      marking(`texte_${k}`, c.mark, [c.x + 9, c.z], "lv", body, s > 0 ? Yp : Ym, s));
  }
  return { bodies, features, faces: { plus: Yp, moins: Ym, lv: Yp + I.raise } };
}

/** The calculation of the HV joint, kept in the project under the name of the strip : the model « louvre_strip » with the values the documents print. */
export function contactSizing(I_CORE) {
  const S = STRIPS.hv, inputs = { ...sessionDefaults("louvre_strip"), strips: 2, L: S.L, p: S.p, Il: 40, Rl: 300, Fl: 7, hMin: 1.5, hMax: 1.9, mate: "cu", h: GAP, tol: GAP_TOL, I: I_CORE, Umax: 12.5 }, r = run("louvre_strip", inputs);
  return [{ id: "phy-bm-lam", name: `Joint HV entre deux CORE — 2 bandes de ${S.L} mm, ${I_CORE} A`, model: "louvre_strip", part: S.id, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: "2026-11-22T01:00:00.000Z",
    why: `Le courant du CORE, ${I_CORE} A, par les deux bandes du joint. Valeurs d'une lamelle : 40 A et 0,3 mΩ (page produit de la MULTILAM LA-CU de Stäubli, même largeur et même pas que la bande dessinée), 7 N (The MULTILAM Principle, p. 16) ; plage de travail 1,5 à 1,9 mm (Weftron LOUVER_tron 112, p. 2) ; 12,5 mV, la limite qu'un fabricant prend pour son courant assigné (catalogue des fiches à fourche, p. 10). La résistance d'une lamelle de la 112 elle-même n'est pas dans ce qui a été lu : à demander au fabricant.` }];
}
