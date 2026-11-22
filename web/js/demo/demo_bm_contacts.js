/* DesignWizard.ai — BM 8s8p - 21700 : the contacts between two CORE, iteration 12 (JP, 22 novembre 2026 : « let's pivot for a planar
   high-current contact with a spring (to replace the deformable contact) » — then the laminated busbar of a CORE remade as an industrial one,
   the welds on the cells visible, the sensors moved to the bottom support).
   What it is now : FACE AGAINST FACE. The outer face of the + leg of a CORE lies on the outer face of the − leg of the next, bare silver-plated
   copper on bare silver-plated copper ; the SPRING is the one of the module — the springs of the top lid press the whole stack of the 8 CORE
   between the two lids (demo_bm_lid.js, lidForces). No strip, no frame, no stop : the gap is zero and the pitch of the CORE is the CORE and its
   two legs. The four LV contacts of the RS-485 chain stay on the legs — a gold land FLUSH with the copper in an insulating insert, on both legs ;
   behind each land, a pin through the insert and a tail that climbs inside the leg, in the valley between two cells, to the board on top
   (the parts BM-LV-PLUS and BM-LV-MOINS) : nothing passes between two CORE any more.
   The resistance of a joint is bounded with Holm's theory, as printed by Lu, Goddard, Han and Hahn (arXiv 1701.00447, 2017, p. 3, eq. 1–3,
   citing Holm 1967 and Slade 2013) : constriction ρ / (2 a N) per unit area, the pressure at the asperities equal to the hardness. With the
   whole force on ONE spot (N A = 1) : R = ρ / (2 a), a = √(F / (π H)) — an upper bound ; many spots, which a real joint has, lower it, and a
   contamination film raises it (the second term of eq. 1, not counted : the faces are silver-plated and greased). ρ and H of copper : the
   infobox of the Wikipedia page « Copper » (16.78 nΩ·m at 20 °C ; Brinell up to 878 MPa, the highest hardness printed — the safe side).
   Every size is an EXAMPLE, said on each part. Pure : the layout, the parts, what the contacts add to the laminated busbar, the bound. */

/** The insulating island of an LV contact, its gold land, the pin and the tail behind it. */
export const ISLAND = { insert: 6, hole: 6, land: 4, landT: 0.3, pin: 1.2, tailW: 1.5, tailT: 0.3, tailIn: 1.0, slot: 0.6, recess: 0.1 };      // tailIn : the tail stands 1 mm inside the paper of the flank ; slot : the air around it, in its slot ; recess : the insert 0.1 mm under the copper — two inserts pressed together keep a creepage path between them
export const LV_NETS = ["GND_ISO", "RS485_A", "RS485_B", "+5V_ISO"];
/** The height of the LV contacts on the legs (example) : mid-height of the cells. */
export const LV_Z = 40;
const fr = (v) => String(Math.round(v * 1000) / 1000).replace(".", ",");
export const MARK = { hv: { h: 2.5, w: 0.3 }, lv: { h: 2, w: 0.25 }, depth: 0.05 };
/** Copper, as read (Wikipedia, « Copper », infobox) : resistivity at 20 °C ; the highest Brinell hardness printed. */
export const COPPER = { rho: 16.78e-9, H: 878e6 };

/** Where the contacts are on a leg, in the frame of the CORE (X the length of the CORE, the middle of it a valley between two cells) : the four
    LV contacts, two on each side of the valleys a cell from the middle — where the tails climb, clear of the cans — and the HV marks. */
export function contactLayout(X, grid = 21.7) {
  const xm = X / 2, v = [xm - grid, xm + grid];
  return { lv: LV_NETS.map((net, k) => ({ id: `LV${k + 1}`, net, x: Math.round((v[k >> 1] + (k % 2 ? 2.5 : -2.5)) * 1000) / 1000, z: LV_Z, mark: ["0V", "A", "B", "5V"][k] })),
    hv: [{ id: "HV1", mark: [9.5, 62] }, { id: "HV2", mark: [X - 9.5, 62] }] };
}
const slug = (net) => net.replace(/[^A-Za-z0-9]/g, "").toLowerCase(), r3 = (v) => Math.round(v * 1000) / 1000;
/** Where the tail of an LV contact stands across Y : 1 mm inside the paper of the flank, on the + side (s > 0) or the − side. */
export const tailY = (Y, s) => (s > 0 ? [r3(Y - ISLAND.tailIn - ISLAND.tailT), r3(Y - ISLAND.tailIn)] : [ISLAND.tailIn, r3(ISLAND.tailIn + ISLAND.tailT)]);
export const lvBody = slug;
const box = (id, name, body, at, size, mode, all) => ({ op: "box", id, name, ...(body ? { body } : {}), at, size, ...(mode ? { mode } : {}), ...(all ? { bodies: "all" } : {}) });
const cyl = (id, name, body, at, d, h, mode, all) => ({ op: "cylinder", id, name, ...(body ? { body } : {}), at, d, h, axis: "Y", ...(mode ? { mode } : {}), ...(all ? { bodies: "all" } : {}) });
/** The text the laser marks beside a contact : on the + leg (s > 0, read from +Y) or on the − leg (read from −Y). */
const marking = (id, text, at, kind, body, y, s) => ({ op: "mark", id, name: `Marquage laser « ${text} »`, body, face: s > 0 ? "+Y" : "-Y", start: y, at, dir: [-s, 0], text, h: MARK[kind].h, w: MARK[kind].w, depth: MARK.depth });

/** What the contacts add to the laminated busbar : on both legs, an insulating insert per LV contact (a hole through the copper and the paper of
    the flank, the insert, the pocket of its land, the bore of its pin), the laser marks ; at the top, the slot where each tail goes up to the
    board. o : { Y, ins, t, top (the top of the laminate), H (the top of the cells) } ; L : contactLayout. */
export function busbarContacts(L, o) {
  const Yp = o.Y + o.ins + o.t, Ym = -(o.ins + o.t), I = ISLAND, features = [];
  const bodies = { isolant_lv: { material: "PA66-GF30", kind: "insulator", label: "Inserts isolants des contacts LV" } };
  for (const c of L.hv) features.push(marking(`texte_${c.id.toLowerCase()}p`, "HV +", c.mark, "hv", "plus", Yp, 1), marking(`texte_${c.id.toLowerCase()}m`, "HV −", c.mark, "hv", "moins", Ym, -1));
  for (const c of L.lv) for (const [side, s] of [["p", 1], ["m", -1]]) {
    const k = `${slug(c.net)}_${s > 0 ? "p" : "m"}`, body = s > 0 ? "plus" : "moins", y0 = s > 0 ? o.Y : Ym, y1 = s > 0 ? Yp : 0, out = s > 0 ? Yp : Ym;
    features.push(cyl(`trou_${k}`, `Trou de l'îlot ${c.net} — jambe ${s > 0 ? "+" : "−"} et papier du flanc`, null, [c.x, y0 - 0.2, c.z], I.hole, y1 - y0 + 0.4, "cut", true),
      cyl(`ilot_${k}`, `Insert isolant de ${c.net}, ${fr(I.recess)} mm sous le cuivre`, "isolant_lv", [c.x, s > 0 ? y0 : y0 + I.recess, c.z], I.insert, y1 - y0 - I.recess),
      cyl(`ilot_${k}_plage`, `Logement de la plage de ${c.net}, affleurante`, "isolant_lv", [c.x, s > 0 ? out - I.landT : out - 0.1, c.z], I.land + 0.2, I.landT + 0.1, "cut"),
      cyl(`ilot_${k}_broche`, `Passage de la broche de ${c.net}`, "isolant_lv", [c.x, y0 - 0.1, c.z], I.pin + 0.2, y1 - y0 + 0.2, "cut"),
      marking(`texte_${k}`, c.mark, [c.x + 1.2 * s, c.z + 5.5], "lv", body, out, s));
    void side;
    /* the slot of its tail through the top of the laminate : around the tail, I.slot of air on every side */
    const tl = tailY(o.Y, s), ys = [tl[0] - I.slot, tl[1] + I.slot], xw = I.tailW + 2 * I.slot;
    features.push(box(`fente_${k}`, `Fente de la queue de ${c.net} (jambe ${s > 0 ? "+" : "−"})`, null, [r3(c.x - xw / 2), r3(ys[0]), o.H], [r3(xw), r3(ys[1] - ys[0]), r3(o.top - o.H + 0.1)], "cut", true));
  }
  return { bodies, features, faces: { plus: Yp, moins: Ym } };
}

/** The four LV contacts of a leg, one part : on each, the gold land flush with the leg, the pin through its insert, the tail that climbs inside
    the leg (against the paper of the flank, between two cells) and through the slot of the laminate to the bottom of the board, where it is
    soldered. side : "p" (the + leg) or "m" (the − leg) ; o : { Y, ins, t, zb (the bottom of the board) }. */
export function lvContactPart(side, L, o) {
  const p = side === "p", I = ISLAND, Yp = o.Y + o.ins + o.t, Ym = -(o.ins + o.t), bodies = {}, features = [];
  for (const c of L.lv) {
    const b = slug(c.net), tail = tailY(o.Y, p ? 1 : -1);
    bodies[b] = { material: "CU-C110", kind: "conductor", net: c.net, label: `${c.net} — plage dorée, broche et queue` };
    const land = p ? Yp - I.landT : Ym, pin0 = p ? tail[0] : Ym + I.landT, pin1 = p ? Yp - I.landT : tail[1];
    features.push(cyl(`plage_${b}`, `Plage dorée de ${c.net}`, b, [c.x, land, c.z], I.land, I.landT),
      cyl(`broche_${b}`, `Broche de ${c.net}, à travers l'insert`, b, [c.x, pin0, c.z], I.pin, pin1 - pin0),
      box(`queue_${b}`, `Queue de ${c.net}, jusqu'à la carte`, b, [c.x - I.tailW / 2, tail[0], c.z - I.tailW / 2], [I.tailW, I.tailT, o.zb - (c.z - I.tailW / 2)]));
  }
  const sign = p ? "+" : "−";
  return { dw: "part/1", id: p ? "BM-LV-PLUS" : "BM-LV-MOINS", name: `Contacts LV de la jambe ${sign}`, family: "contact", process: "purchased", material: "CU-C110", revision: "A", params: {}, bodies, features, interfaces: [],
    function: `Les quatre contacts de la chaîne RS-485 sur la jambe ${sign} : une plage dorée affleurante, posée face à face sur celle du CORE ${p ? "suivant" : "précédent"} ; derrière, une broche et une queue qui montent à la carte.`,
    notes: [`Plage Ø${fr(I.land)} × ${fr(I.landT)} mm, dorée, dans un insert isolant Ø${fr(I.insert)} en PA66-GF30 emmanché dans la jambe, ${fr(I.recess)} mm sous le cuivre ; broche Ø${fr(I.pin)} ; queue de ${fr(I.tailW)} × ${fr(I.tailT)} mm qui monte à ${fr(I.tailIn)} mm du papier du flanc, dans le creux entre deux cellules (là où leurs godets sont loin de la jambe), puis par une fente du busbar laminé — ${fr(I.slot)} mm d'air tout autour — jusqu'à la carte, où elle se brase dans un trou (à placer dans le PCBA). Exemples.`,
      p ? "Côté +, la plage repose sur une rondelle ondulée dans son insert (non dessinée) : libre, elle dépasse de quelques centièmes ; pressée, elle affleure et touche celle d'en face — c'est le ressort du contact LV."
        : "Côté −, la plage est fixe et affleure : elle reçoit la plage + du CORE précédent.",
      "Les plages LV sont au potentiel du bus isolé ; le cuivre autour, à celui du CORE : l'insert et la fente gardent la distance, à vérifier dans l'Isolation (« Joint entre deux CORE »)."] };
}

/** The bound of the resistance of a pressed copper joint, after Holm (as printed by Lu et al., arXiv 1701.00447, p. 3, eq. 1–3) : the whole force
    F on one spot, of radius a = √(F / (π H)), its constriction R = ρ / (2 a). I : the current. → { F, a (m), R (Ω), U (V), P (W) } */
export function planarJoint(F, I, C = COPPER) {
  const a = Math.sqrt(F / (Math.PI * C.H)), R = C.rho / (2 * a);
  return { F, a, R, U: R * I, P: R * I * I };
}

/** The two voltage taps of the board : a nickel-plated copper tab laser-welded on a layer of the laminated busbar, through a window of its film,
    and rising beside the edge of the board, where it is soldered to a castellated pad. o : { X, Y, ins, t, zP1 (top of the + layer), zM1 (top of
    the − layer), zb (bottom of the board), boardT } → [B+, B−] */
export function tapParts(o) {
  const T = 0.2, w = 4, x0 = Math.round((o.X / 2 - w / 2) * 1000) / 1000, top = Math.round((o.zb + o.boardT) * 1000) / 1000, Ym = -(o.ins + o.t), r3 = (v) => Math.round(v * 1000) / 1000;
  const make = (plus) => {
    const net = plus ? "B+" : "B−", z0 = plus ? o.zP1 : o.zM1, foot = plus ? [o.Y, o.Y + 2] : [r3(Ym + 0.2), 0], blade = plus ? [o.Y, o.Y + T] : [-T, 0];
    return { dw: "part/1", id: plus ? "BM-TAP-NI-P" : "BM-TAP-NI-M", name: `Languette de prise ${net}`, family: "contact", process: "purchased", material: "CU-C110", revision: "A", params: {},
      bodies: { main: { material: "CU-C110", kind: "conductor", net: plus ? "CORE+" : "CORE-", label: `Languette ${net}, cuivre nickelé` } },
      features: [box("pied", `Pied soudé sur la couche ${plus ? "+" : "−"}`, "main", [x0, foot[0], z0], [w, r3(foot[1] - foot[0]), T]),
        box("lame", "Lame qui monte au bord de la carte", "main", [x0, blade[0], z0], [w, T, r3(top - z0)])], interfaces: [],
      function: `Prend la tension du CORE (${net}) pour la carte : soudée au laser sur la couche ${plus ? "+ au bord +Y" : "− au bord −Y"} du busbar laminé, elle monte le long du bord de la carte et s'y brase sur une demi-plage crénelée.`,
      notes: [`Cuivre nickelé de ${String(T).replace(".", ",")} × ${w} mm (exemple) ; la plage crénelée du bord de la carte est à placer dans le PCBA.`, "La mesure de tension se fait par cette languette, sans courant : sa section ne compte pas pour les 360 A."] };
  };
  return [make(true), make(false)];
}
