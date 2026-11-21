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
   busbar, the calculations kept in the project. */

import { run, sessionDefaults } from "../analysis/physics/index.js";

export const STOP_H = 0.35;      // the height of the stops : two CORE pressed together are this far apart (example)
/** The two crowns : n bridge blades of span l, width w, thickness t, their crest lift above the face when free ; R the radius of the
    middle of the blades ; ring the width of the two rings that hold their ends. Examples, checked by the model of the tool. */
export const SPRINGS = {
  hv: { id: "BM-SPRING-HV", n: 10, l: 7, w: 2.5, t: 0.25, lift: 0.65, R: 8.2, ring: 1.3, plating: "Ag", I: 180, stop: [14, 16], groove: 17 },
  lv: { id: "BM-SPRING-LV", n: 4, l: 4, w: 1, t: 0.1, lift: 0.43, R: 3.5, ring: 0.8, plating: "Au", I: 0.05, land: 6.6, recess: 6.8, insert: 8.4, hole: 8.7, groove: 9.5 } };
const GROOVE = { w: 0.4, d: 0.05 }, fr = (v) => String(v).replace(".", ",");      // a laser-engraved circle : its width and depth (example)

/** Where the 4 contacts are on a leg, in the frame of the CORE : [x, z] of their centres ; X the length of the CORE, H the height of a cell. */
export function contactLayout(X, H) {
  const xm = X / 2, zm = H / 2;
  return [{ id: "HV1", kind: "hv", x: xm - 26, z: zm, text: "HV 1" }, { id: "HV2", kind: "hv", x: xm + 26, z: zm, text: "HV 2" },
    { id: "LVA", kind: "lv", net: "RS485_A", x: xm, z: zm + 13, text: "RS-485 A" }, { id: "LVB", kind: "lv", net: "RS485_B", x: xm, z: zm - 13, text: "RS-485 B" }];
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
  return { dw: "part/1", id: s.id, name: hv ? "Ressort de contact HV — couronne de lames" : "Ressort de contact LV — couronne de lames",
    function: hv ? "Contact de puissance entre deux CORE : une couronne de lames-ponts soudée sur la jambe + ; pressée par la jambe − du CORE voisin jusqu'à la butée de cuivre qui l'entoure."
      : "Contact du signal RS-485 entre deux CORE : une petite couronne de lames sur la plage isolée de la jambe + ; pressée jusqu'au rebord isolant de son îlot.",
    family: "contact", process: "purchased", material: "CUBE-C17200", revision: "A", params, features, interfaces: [],
    notes: [`${s.n} lames-ponts de ${[s.l, s.w, s.t].map(fr).join(" × ")} mm, tenues aux deux bouts par deux anneaux ; levée libre de ${fr(s.lift)} mm, butée à ${fr(STOP_H)} mm (exemples). Dessiné libre, tel qu'estampé.`,
      hv ? "Cuivre-béryllium C17200 durci (TH04), argenté : la lame dépasse sa course élastique et prend sa forme au premier serrage — le calcul « Contact HV » gardé dans le projet dit l'effort à la butée et la déformation permanente. Remonté, il redonne le même effort à la butée, en élastique (relaxation non comptée)."
        : "Cuivre-béryllium C17200 durci (TH04), doré sur nickel : la lame reste élastique jusqu'à la butée — le calcul « Contact LV » gardé dans le projet le dit.",
      "Usiner, poncer ou découper au laser le cuivre-béryllium dégage des poussières toxiques : l'estampage, les traitements et la soudure se font chez un fabricant équipé.",
      hv ? "Soudé au laser sur la jambe +, par points sur les deux anneaux (exemple)." : "Soudé ou brasé sur la plage de cuivre de son îlot ; le fil qui monte le signal à la carte n'est pas dessiné."] };
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
      cyl(`butee_${k}`, `Butée de ${c.text} + (anneau de cuivre)`, "plus", [c.x, Yp, c.z], 2 * hv.stop[1], STOP_H),
      cyl(`butee_${k}_in`, `Butée de ${c.text} + — dedans`, "plus", [c.x, Yp, c.z], 2 * hv.stop[0], STOP_H + 0.5, "cut"),
      ...groove(`gravure_${k}m`, `${c.text} −`, "moins", c, hv.groove, Ym, -1));
    else for (const [side, y, s, body] of [["p", Yp, 1, "plus"], ["m", Ym, -1, "moins"]]) {
      const land = `lv_${c.net.slice(-1).toLowerCase()}_${side}`, base = s > 0 ? o.Y + o.ins : Ym, top = s > 0 ? Yp : -o.ins;
      bodies[land] = { material: "CU-C110", kind: "conductor", net: c.net, label: `Plage ${c.text} (jambe ${s > 0 ? "+" : "−"})` };
      features.push(...groove(`gravure_${k}${side}`, `${c.text} (jambe ${s > 0 ? "+" : "−"})`, body, c, lv.groove, y, s),
        cyl(`trou_${k}${side}`, `Trou de l'îlot ${c.text} dans la jambe ${s > 0 ? "+" : "−"}`, body, [c.x, base - 0.2, c.z], 2 * lv.hole, top - base + 0.7, "cut"),
        cyl(`ilot_${k}${side}`, `Insert isolant de ${c.text}${s > 0 ? ", son rebord fait butée" : ""}`, "isolant_lv", [c.x, base, c.z], 2 * lv.insert, top - base + (s > 0 ? STOP_H : 0)),
        cyl(`ilot_${k}${side}_creux`, `Logement de la plage de ${c.text}`, "isolant_lv", [c.x, s > 0 ? y - 0.3 : y - 0.5, c.z], 2 * lv.recess, s > 0 ? STOP_H + 0.8 : 0.8, "cut"),
        cyl(`plage_${k}${side}`, `Plage de cuivre de ${c.text}`, land, [c.x, s > 0 ? y - 0.3 : y, c.z], 2 * lv.land, 0.3));
    }
  }
  return { bodies, features, faces: { plus: Yp, moins: Ym } };
}

/** The two calculations of the contacts, kept in the project under the names of the springs : the model « spring_stop » with the crowns as drawn. */
export function contactSizing(I_CORE) {
  const keep = (kind, name, why, when) => { const s = SPRINGS[kind], inputs = { ...sessionDefaults("spring_stop"), n: s.n, l: s.l, w: s.w, t: s.t, lift: s.lift, hs: STOP_H, plating: s.plating, I: s.I }, r = run("spring_stop", inputs);
    return { id: `phy-bm-${kind}`, name, model: "spring_stop", part: s.id, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when, why }; };
  return [keep("hv", `Contact HV — ${SPRINGS.hv.n} lames, ${SPRINGS.hv.I} A (${I_CORE} A sur 2 contacts)`, `Le courant du CORE, ${I_CORE} A, partagé par les deux contacts HV. La lame est poussée au-delà de sa course élastique : c'est voulu (demande de JP : la déformation plastique jusqu'à la butée), et le calcul le signale.`, "2026-11-21T22:00:00.000Z"),
    keep("lv", `Contact LV — ${SPRINGS.lv.n} lames, signal RS-485`, "Un signal de liaison série : quelques dizaines de milliampères. Une surface dorée, des lames qui restent élastiques jusqu'à la butée.", "2026-11-21T22:01:00.000Z")];
}
