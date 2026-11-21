/* DesignWizard.ai — BM 8s8p - 21700 : the contacts between two CORE (JP, 21 novembre 2026 : « simuler les 4 interfaces LV et HV sur les
   surfaces des busbars verticaux, forme circulaire planaire, qui peuvent se déplacer sous la pression au bout des cores… jusqu'à ce qu'on
   arrive à des butées sur ces mêmes busbars à la périphérie des contacts (les 4 contacts, 2 LV, 2 HV)… le contact négatif est seulement un
   rond gravé avec écriture de ce que c'est au laser… tous les contacts + … sont des ressorts… le pourtour est gravé au laser » ; par menu :
   LV = le signal RS-485 en daisy chain, HV = la puissance du CORE, + d'un côté, − de l'autre ; le ressort : une couronne de lames).
   Read : on each joint between two CORE, 4 round contacts — 2 HV (the 360 A of the CORE, 180 A each) and 2 LV (RS-485 A and B). On the +
   leg (+Y) of a CORE, the springs : a crown of bridge blades, stamped in beryllium copper, welded on the leg ; around each, its stop —
   a copper ring for HV, the insulating rim of the insert for LV. On the − leg (−Y) of the next CORE : flat lands, an engraved circle
   around each. An LV contact is an island : a copper land in an insulating insert, set in a hole of the copper leg. Pressed until the
   stops touch, two CORE are STOP_H apart, and each blade has gone down by lift − STOP_H : the calculation of the tool (model
   « spring_stop ») says what force that gives, and the set it leaves once the blade has passed its elastic travel.
   The crowns are drawn FREE (as stamped) : in the module, their crests go into the next CORE by the travel to the stop — that overlap is
   the compression, not a clash. Every size is an EXAMPLE. Pure : the layout, the spring parts, what the contacts add to the laminated
   busbar, the calculations kept in the project.
   Iteration 7 (JP, par menu : « Contact HV élastique ») : the stops fix the gap between two CORE, so a blade only has to absorb the
   tolerance of its own free height, of the stop and of the flatness — ± TOL. The HV blades get longer (7 → 9.5 mm, same sheet) and a
   shorter travel (0.15 mm) : elastic at the longest travel of the window ; the plastic crown of iteration 6 stays as a variant of the
   part, and its calculation stays in the project, to compare. The LV blades follow the same window. */

import { run, sessionDefaults } from "../analysis/physics/index.js";

export const STOP_H = 0.6, TOL = 0.05, RIM = 0.02;      // the height of the stops (two CORE pressed together are this far apart) ; ± on the travel of a blade ; the insulating rim of an LV island stands RIM under the copper stops, which carry the load of the module (examples)
/* Iteration 8 (JP, par menu : « Couronne sertie ») : the HV stop is a washer of its own (BM-STOP-HV) whose lip holds the outer ring of the crown
   against the leg — no weld through the silver, no heat on the beryllium copper. A lip that can be coined needs some copper over the 0.25 mm
   ring : the stop goes from 0.35 to 0.6 mm, the HV crest from 0.5 to 0.75 (the same 0.15 mm of travel), and the LV land stands LV_UP proud,
   so that the LV crown keeps its own 0.35 mm stop height. */
export const LV_UP = 0.25;
/** The two crowns : n bridge blades of span l, width w, thickness t, their crest lift above the face when free ; R the radius of the
    middle of the blades ; ring the width of the two rings that hold their ends. Examples, checked by the model of the tool. */
export const SPRINGS = {
  hv: { id: "BM-SPRING-HV", n: 10, l: 9.5, w: 2.5, t: 0.25, lift: 0.75, R: 9.4, ring: 1.3, plating: "Ag", I: 180, Fmin: 1, groove: 18.8,
    washer: { id: "BM-STOP-HV", D: 36, d: 28.8, dc: 31.3 },      // the stop washer : outside, the inner edge of its lip, the recess under the lip that takes the outer ring of the crown
    plastic: { l: 7, lift: 0.9, R: 8.2 } },      // iteration 6, kept as a variant of the part : the same sheet, shorter blades pressed past their elastic travel
  lv: { id: "BM-SPRING-LV", n: 4, l: 5.5, w: 1, t: 0.1, lift: 0.45, R: 3.75, ring: 0.8, plating: "Au", I: 0.05, Fmin: 0.5, land: 7.6, recess: 7.8, insert: 9.4, hole: 9.7, groove: 10.5 } };
export const ELASTIC = "Élastique — lames de 9,5 mm", PLASTIC = "Plastique — itération 6";
const GROOVE = { w: 0.4, d: 0.05 }, fr = (v) => String(v).replace(".", ",");      // a laser-engraved circle : its width and depth (example)
export const MARK = { hv: { h: 3, w: 0.3 }, lv: { h: 2.5, w: 0.25 }, depth: 0.05 };      // the laser marking : height of the capitals, width of a stroke, depth (examples)
/** The text the laser marks beside a contact, on the + leg (s > 0, read from +Y : toward −X) or on the − leg (read from −Y : toward +X). */
const marking = (id, c, body, y, s) => { const m = MARK[c.kind], text = c.kind === "hv" ? `${c.mark} ${s > 0 ? "+" : "−"}` : c.mark;
  return { op: "mark", id, name: `Marquage laser « ${text} »`, body, face: s > 0 ? "+Y" : "-Y", start: y, at: [c.x + c.at[0], c.z + c.at[1]], dir: [-s, 0], text, h: m.h, w: m.w, depth: MARK.depth }; };

/** Where the 4 contacts are on a leg, in the frame of the CORE : [x, z] of their centres ; X the length of the CORE, H the height of a cell. */
export function contactLayout(X, H) {
  const xm = X / 2, zm = H / 2;      // the HV circles as far apart as the leg allows (3.4 mm to its ends) ; the LV islands above and below, clear of them
  // mark : the text the laser writes beside each circle, and where its centre is from the centre of the contact — each in a free corner of the leg
  return [{ id: "HV1", kind: "hv", x: xm - 24, z: zm, text: "HV 1", mark: "HV1", at: [0, 24.4] }, { id: "HV2", kind: "hv", x: xm + 24, z: zm, text: "HV 2", mark: "HV2", at: [0, -24.6] },
    { id: "LVA", kind: "lv", net: "RS485_A", x: xm, z: zm + 18.5, text: "RS-485 A", mark: "RS485 A", at: [19.3, 5.9] }, { id: "LVB", kind: "lv", net: "RS485_B", x: xm, z: zm - 18.5, text: "RS-485 B", mark: "RS485 B", at: [-19.3, -5.9] }];
}

const cyl = (id, name, body, at, d, h, mode) => ({ op: "cylinder", id, name, body, at, d, h, axis: "Y", ...(mode ? { mode } : {}) });
/** A circle engraved by laser on a face of the copper, around a contact : a groove GROOVE.d deep, at radius r. y : the level of the face, s : +1 when the face looks to +Y. */
const groove = (id, what, body, c, r, y, s) => { const y0 = s > 0 ? y - GROOVE.d : y;
  return [cyl(id, `Gravure laser — cercle de ${what}`, body, [c.x, y0, c.z], 2 * (r + GROOVE.w / 2), GROOVE.d, "cut"), cyl(`${id}_in`, `Gravure laser — intérieur du cercle de ${what}`, body, [c.x, y0, c.z], 2 * (r - GROOVE.w / 2), GROOVE.d)]; };

/** A crown of bridge blades, free, standing on the + leg at the first contact of its kind : its two rings flat on the face (y), its blades
    bowed out of the face. The part is drawn in the frame of the CORE ; its second copy is moved along the leg. */
export function springPart(kind, c, y) {
  const s = SPRINGS[kind], hv = kind === "hv", P = (value, label, o = {}) => ({ value, unit: "mm", label, step: 0.05, group: "Ressort", ...o });
  const params = { l: P(s.l, "Portée d'une lame", { min: 2, max: 12 }), w: P(s.w, "Largeur d'une lame", { min: 0.5, max: 4 }), t: P(s.t, "Épaisseur de la tôle", { step: 0.01, min: 0.05, max: 0.5 }),
    lift: P(s.lift, "Levée libre du sommet d'une lame, depuis la face", { step: 0.01, min: 0.1, max: 2 }), R: P(s.R, "Rayon du milieu des lames", { min: 2, max: 15 }), ring: P(s.ring, "Largeur des anneaux", { min: 0.5, max: 3 }) };
  const at = [c.x, y, c.z], step = 360 / s.n, features = [
    cyl("anneau_ext", "Anneau extérieur (pieds des lames)", "main", at, "2 * (R + l / 2 + ring)", "t"),
    cyl("anneau_ext_in", "Anneau extérieur — dedans", "main", [c.x, y - 0.1, c.z], "2 * (R + l / 2 - 0.3)", "t + 0.2", "cut"),
    cyl("anneau_int", "Anneau intérieur (pieds des lames)", "main", at, "2 * (R - l / 2 + 0.3)", "t"),
    cyl("anneau_int_in", "Anneau intérieur — trou", "main", [c.x, y - 0.1, c.z], "2 * (R - l / 2 - ring)", "t + 0.2", "cut")];
  for (let k = 0; k < s.n; k++) features.push({ op: "arch", id: `lame_${k + 1}`, name: `Lame ${k + 1}`, face: "+Y", start: `${y} + t`,
    at: [`${c.x} + R * cos(${k * step})`, `${c.z} + R * sin(${k * step})`], dir: [`cos(${k * step})`, `sin(${k * step})`], l: "l", w: "w", h: "lift - t", t: "t" });
  const own = { l: s.l, w: s.w, t: s.t, lift: s.lift, R: s.R, ring: s.ring }, variants = hv ? { variants: [{ name: ELASTIC, off: [], params: own }, { name: PLASTIC, off: [], params: { ...own, ...s.plastic } }], variantOn: ELASTIC } : {};
  return { dw: "part/1", id: s.id, name: hv ? "Ressort de contact HV — couronne de lames" : "Ressort de contact LV — couronne de lames", ...variants,
    function: hv ? "Contact de puissance entre deux CORE : une couronne de lames-ponts sertie sur la jambe + par sa rondelle de butée ; pressée par la jambe − du CORE voisin jusqu'à cette butée."
      : "Contact du signal RS-485 entre deux CORE : une petite couronne de lames sur la plage isolée de la jambe + ; pressée jusqu'au rebord isolant de son îlot.",
    family: "contact", process: "purchased", material: "CUBE-C17200", revision: "A", params, features, interfaces: [],
    notes: [`${s.n} lames-ponts de ${[s.l, s.w, s.t].map(fr).join(" × ")} mm, tenues aux deux bouts par deux anneaux ; levée libre de ${fr(s.lift)} mm, butée à ${fr(hv ? STOP_H : STOP_H - LV_UP)} mm au-dessus de ${hv ? "la jambe" : "sa plage"} (exemples). Dessiné libre, tel qu'estampé.`,
      hv ? `Cuivre-béryllium C17200 durci (TH04), argenté. La butée fixe l'écart : la lame n'absorbe que ± ${fr(TOL)} mm (bombé, butée, planéité) et reste élastique au plus long de la course — le calcul « Contact HV » gardé dans le projet le dit. La variante « ${PLASTIC} » garde la couronne de l'itération 6, des lames de 7 mm qui plastifient, pour comparer.`
        : `Cuivre-béryllium C17200 durci (TH04), doré sur nickel : la lame reste élastique au plus long de la course (± ${fr(TOL)} mm) — le calcul « Contact LV » gardé dans le projet le dit.`,
      `Estampé sur un outil à suivre : percer les fenêtres entre les lames et le trou du centre, frapper le bombé des lames, découper le contour. Les deux bouts d'une lame sont tenus : le bombé l'allonge de ${fr(+(800 * (s.lift - s.t) ** 2 / (3 * s.l ** 2)).toFixed(2))} % seulement. La bande se met en forme dans un état formable (recuit ou quart dur), puis se durcit par revenu — l'état TH04 vient après la mise en forme, selon la fiche de la bande (non lue).`,
      `Le bombé tenu à ± ${fr(TOL)} mm demande une frappe de calibrage après le revenu, ou un tri à 100 % : à ± 0,1 mm, la lame sortirait de sa course élastique au pire des cotes.`,
      "Usiner, poncer ou découper au laser le cuivre-béryllium dégage des poussières toxiques : l'estampage, les traitements et la soudure se font chez un fabricant équipé.",
      hv ? "Serti sous sa rondelle de butée (BM-STOP-HV) : la lèvre de la rondelle tient l'anneau extérieur contre la jambe — ni soudure à travers l'argent, ni chaleur sur le cuivre-béryllium ; la couronne se remplace en changeant la rondelle." : "Brasé ou soudé sur la plage de cuivre de son îlot, avant la dorure ; le fil qui monte le signal à la carte n'est pas dessiné."] };
}

/** The stop washer of a HV contact, crimping its crown (iteration 8) : a copper ring STOP_H thick on the + leg, its lip over the outer ring of the
    crown, a recess under the lip as deep as the crown is thick. Drawn in the frame of the CORE, at the first HV contact. */
export function stopPart(c, y) {
  const h = SPRINGS.hv, W = h.washer, P = (value, label, o = {}) => ({ value, unit: "mm", label, step: 0.05, group: "Rondelle", ...o });
  const params = { D: P(W.D, "Diamètre extérieur (la butée)", { min: 30, max: 40 }), d: P(W.d, "Diamètre intérieur de la lèvre", { min: 20, max: 34 }),
    dc: P(W.dc, "Diamètre du logement sous la lèvre (l'anneau de la couronne)", { min: 25, max: 36 }), H: P(STOP_H, "Épaisseur — la hauteur de la butée", { step: 0.01, min: 0.3, max: 1.5 }),
    tc: P(h.t, "Profondeur du logement — l'épaisseur de la couronne", { step: 0.01, min: 0.05, max: 0.5 }) };
  const features = [cyl("rondelle", "Rondelle de butée", "main", [c.x, y, c.z], "D", "H"), cyl("levre", "Trou de la lèvre", "main", [c.x, y - 0.1, c.z], "d", "H + 0.2", "cut"),
    cyl("logement", "Logement de l'anneau extérieur, sous la lèvre", "main", [c.x, y - 0.1, c.z], "dc", "tc + 0.1", "cut")];
  return { dw: "part/1", id: W.id, name: "Rondelle de butée HV — sertit la couronne", family: "contact", process: "purchased", material: "CU-C110", revision: "A", params, features, interfaces: [],
    function: "La butée d'un contact HV et la retenue de sa couronne : posée sur la jambe +, sa lèvre tient l'anneau extérieur de la couronne contre le cuivre ; sa face porte la jambe − du CORE voisin.",
    notes: [`Cuivre ${fr(STOP_H)} mm, frappé : un logement de ${fr(h.t)} mm sous la lèvre pour l'anneau de la couronne, la lèvre gardant ${fr(+(STOP_H - h.t).toFixed(2))} mm de cuivre ; argentée comme la couronne. Hauteur et planéité à ± 0,02 mm : c'est elle qui fixe l'écart entre deux CORE (exemple).`,
      "Pose : couronne sur la jambe, rondelle par-dessus, puis la rondelle fixée à la jambe par son bord extérieur — points de soudure laser cuivre sur cuivre, ou brasure —, à 2,5 mm de la couronne : la couronne n'est que serrée, jamais chauffée.",
      "Après le laminage : derrière 2 mm de cuivre, le papier aramide voit un point de soudure par l'autre face — la tenue à vérifier avec le fabricant du busbar."] };
}

/** What the contacts add to the laminated busbar : the stops and the engraved circles on the + leg, the engraved circles on the − leg, and the
    4 LV islands (an insulating insert in a hole of the copper, a copper land in it). o : { Y, ins, t } of the busbar ; layout : contactLayout. */
export function busbarContacts(layout, o) {
  const Yp = o.Y + o.ins + o.t, Ym = -(o.ins + o.t), hv = SPRINGS.hv, lv = SPRINGS.lv, features = [];
  const bodies = { isolant_lv: { material: "PA66-GF30", kind: "insulator", label: "Inserts isolants des contacts LV" } };
  for (const c of layout) {
    const k = c.id.toLowerCase();
    if (c.kind === "hv") features.push(
      ...groove(`gravure_${k}p`, `${c.text} +`, "plus", c, hv.groove, Yp, 1),
      ...groove(`gravure_${k}m`, `${c.text} −`, "moins", c, hv.groove, Ym, -1), marking(`texte_${k}p`, c, "plus", Yp, 1), marking(`texte_${k}m`, c, "moins", Ym, -1));
    else for (const [side, y, s, body] of [["p", Yp, 1, "plus"], ["m", Ym, -1, "moins"]]) {
      const land = `lv_${c.net.slice(-1).toLowerCase()}_${side}`, base = s > 0 ? o.Y + o.ins : Ym, top = s > 0 ? Yp : -o.ins;
      bodies[land] = { material: "CU-C110", kind: "conductor", net: c.net, label: `Plage ${c.text} (jambe ${s > 0 ? "+" : "−"})` };
      features.push(...groove(`gravure_${k}${side}`, `${c.text} (jambe ${s > 0 ? "+" : "−"})`, body, c, lv.groove, y, s),
        cyl(`trou_${k}${side}`, `Trou de l'îlot ${c.text} dans la jambe ${s > 0 ? "+" : "−"}`, body, [c.x, base - 0.2, c.z], 2 * lv.hole, top - base + 0.7, "cut"),
        cyl(`ilot_${k}${side}`, `Insert isolant de ${c.text}${s > 0 ? ", son rebord fait butée" : ""}`, "isolant_lv", [c.x, base, c.z], 2 * lv.insert, top - base + (s > 0 ? STOP_H - RIM : 0)),
        cyl(`ilot_${k}${side}_creux`, `Logement de la plage de ${c.text}`, "isolant_lv", [c.x, s > 0 ? y - 0.3 : y - 0.5, c.z], 2 * lv.recess, s > 0 ? STOP_H + 0.8 : 0.8, "cut"),
        cyl(`plage_${k}${side}`, `Plage de cuivre de ${c.text}${s > 0 ? `, ${fr(LV_UP)} mm au-dessus de la jambe` : ""}`, land, [c.x, s > 0 ? y - 0.3 : y, c.z], 2 * lv.land, s > 0 ? 0.3 + LV_UP : 0.3), marking(`texte_${k}${side}`, c, body, y, s));
    }
  }
  return { bodies, features, faces: { plus: Yp, moins: Ym, lv: Yp + LV_UP } };
}

/** The calculations of the contacts, kept in the project under the names of the springs : the model « spring_stop » with the crowns as drawn, the
    travel ± TOL. The plastic HV crown of iteration 6 is kept beside the elastic one, to compare. */
export function contactSizing(I_CORE) {
  const keep = (id, kind, geo, name, why, when) => { const s = SPRINGS[kind], g = { l: s.l, lift: s.lift, ...geo };
    const inputs = { ...sessionDefaults("spring_stop"), n: s.n, l: g.l, w: s.w, t: s.t, lift: g.lift, hs: kind === "lv" ? STOP_H - LV_UP : STOP_H, tol: TOL, plating: s.plating, I: s.I, Fmin: s.Fmin }, r = run("spring_stop", inputs);
    return { id, name, model: "spring_stop", part: s.id, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when, why }; };
  return [keep("phy-bm-hv", "hv", {}, `Contact HV — élastique, ${SPRINGS.hv.n} lames de ${fr(SPRINGS.hv.l)} mm, ${SPRINGS.hv.I} A`, `Le courant du CORE, ${I_CORE} A, partagé par les deux contacts HV. Choix de JP (itération 7) : une lame qui reste élastique jusqu'à la butée, même au plus long de la course (± ${fr(TOL)} mm) — des lames plus longues dans la même tôle, et moins de course : c'est la butée qui fixe l'écart entre deux CORE, pas le ressort.`, "2026-11-21T23:00:00.000Z"),
    keep("phy-bm-hv-plastic", "hv", SPRINGS.hv.plastic, `Contact HV — plastique (itération 6, pour comparer), ${SPRINGS.hv.n} lames de ${fr(SPRINGS.hv.plastic.l)} mm`, "La couronne de l'itération 6, gardée pour comparer : des lames de 7 mm poussées de 0,30 mm, au-delà de leur course élastique — plus d'effort et moins de résistance, mais une déformation permanente et une couronne qui ne se reprend pas.", "2026-11-21T22:00:00.000Z"),
    keep("phy-bm-lv", "lv", {}, `Contact LV — ${SPRINGS.lv.n} lames de ${fr(SPRINGS.lv.l)} mm, signal RS-485`, `Un signal de liaison série : quelques dizaines de milliampères. Une surface dorée — effort minimal de ${fr(SPRINGS.lv.Fmin)} N par lame, valeur d'usage pour l'or, à confirmer —, des lames qui restent élastiques au plus long de la course.`, "2026-11-21T23:01:00.000Z")];
}
