/* DesignWizard.ai — busbars : a solid conductor, straight or folded, cut and punched from sheet. The designer gives the strip
   (width, thickness, material, potential, current) and its legs, each after a 90° bend up or down ; terminals are punched
   where screws go, and LAMELLA CONTACTS are laid on the flat faces — each with its own identity (CT1, CT2…), its size, its
   plating, the side it presses on. The definition is kept in the part (spec.busbar) : the part is written again from it at
   each change. Pure : no kernel, no DOM.
   def = { name, material, net, W, t, r, I, finish, legs: [{ L, bend }], terminals: [{ id, leg, s, y, screw, key }],
           contacts: [{ id, leg, side, s, y, turn, role, form, weld, u, w, h, n, gap, force, plating, base, duty, i, key }] }
   form : cone (pointed bosses embossed in the bar), bridge (spring blades lanced in a thin bar) or band (a band of lamellae laid on
   the land) — a contact without a form is a band, as before ; weld : "projection" when the bosses are welded ; u : volts d.c.
   leg.bend : the turn BEFORE the leg, +90 (up) or −90 (down) ; s : distance along the leg, from its start ; y : across the width ;
   side : +1 the face on the left of the travel (the top of the first leg), −1 the other ; role : "A" carries the contact points, "B" is the flat land. */

import { material } from "../cad/materials.js";
import { ELEC_INTERFACES, PLATINGS, CONTACT_FORMS, contactEstimate, contactForm, contactFormNotes, contactAdvice } from "../cad/interfaces_elec.js";
import { props } from "../analysis/physics/props.js";

const r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ",");
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
const FACE = (n) => (Math.abs(n[1]) > 0.5 ? (n[1] > 0 ? "+Z" : "-Z") : n[0] > 0 ? "+X" : "-X");
export const KFACTOR = 0.4;                                    // where the neutral fibre sits in a bend, as a share of the thickness
export const FINISHES = { none: "Cuivre nu", Sn: "Étamé", Ag: "Argenté", Ni: "Nickelé" };
export const blankBusbar = () => ({ name: "Busbar", material: "CU-C110", net: "HV+", W: 20, t: 3, r: 3, I: 100, finish: "Sn", legs: [{ L: 60 }, { L: 30, bend: 90 }, { L: 50, bend: -90 }],
  terminals: [{ id: "T1", leg: 0, s: 12, y: 10, screw: "M6" }], contacts: [] });

/** The legs as geometry, in the X–Z plane (the width runs along Y). → [{ i, C: [x, z] start of the centre line, d, n (left normal), L, from, to (the flat part : s between them), face(side), level(side) }] */
export function legsOf(def) {
  const out = [], t = def.t, set = def.r + t + 0.5; let C = [0, def.zc ?? t / 2], d = [1, 0];      // zc : the height of the centre line when it is not the middle of the strip (a track inside a flexible circuit)
  def.legs.forEach((leg, i) => {
    if (i) { const up = (leg.bend || 90) > 0; d = up ? [-d[1] + 0, d[0] + 0] : [d[1] + 0, -d[0] + 0]; }      // + 0 : never a negative zero
    const n = [-d[1] + 0, d[0] + 0], L = Number(leg.L) || 0, c = C;
    out.push({ i, C: c, d, n, L, from: i ? set : 0, to: i < def.legs.length - 1 ? L - set : L, face: (side) => FACE([n[0] * side, n[1] * side]), level: (side) => r2((Math.abs(n[1]) > 0.5 ? c[1] : c[0]) + side * (Math.abs(n[1]) > 0.5 ? n[1] : n[0]) * t / 2) });
    C = [c[0] + d[0] * L, c[1] + d[1] * L];
  });
  return out;
}
/** Where a point of a leg face is, for an interface : { face, level, at } — at = the two model axes of that face. */
export function onLeg(def, legs, leg, side, s, y) {
  const g = legs[leg], p = [g.C[0] + g.d[0] * s, g.C[1] + g.d[1] * s], face = g.face(side);
  return { face, level: g.level(side), at: face[1] === "Z" ? [r2(p[0]), r2(y)] : [r2(y), r2(p[1])], along: face[1] === "Z" ? 0 : 90 };
}
/** The leg, the side and the place a point picked on the part belongs to (point and normal in the frame of the part), or null. */
export function locate(def, point, normal) {
  const legs = legsOf(def), nx = [normal[0], normal[2]];
  for (const g of legs) for (const side of [1, -1]) {
    if (g.n[0] * side * nx[0] + g.n[1] * side * nx[1] < 0.9) continue;
    const rel = [point[0] - g.C[0], point[2] - g.C[1]], s = rel[0] * g.d[0] + rel[1] * g.d[1], off = rel[0] * g.n[0] + rel[1] * g.n[1];
    if (Math.abs(off - side * def.t / 2) < 0.2 && s >= -0.01 && s <= g.L + 0.01) return { leg: g.i, side, s: r2(Math.max(g.from, Math.min(g.to, s))), y: r2(Math.max(0, Math.min(def.W, point[1]))) };
  }
  return null;
}
/** The section of the strip : a closed outline with its bend radii, for the « extrude » of the part. grow : the same outline, larger by that much
    all round the same centre line — the sleeve of an insulation. */
export function stripProfile(def, grow = 0) {
  const legs = legsOf(def), h = def.t / 2 + grow, left = [], right = [], first = legs[0], end = legs.at(-1), S = [first.C[0] - first.d[0] * grow, first.C[1] - first.d[1] * grow], E = [end.C[0] + end.d[0] * (end.L + grow), end.C[1] + end.d[1] * (end.L + grow)];
  const rin = Math.max(0.2, def.r - grow), rout = def.r + def.t + grow;
  legs.forEach((g, i) => {
    if (!i) { left.push([S[0] + g.n[0] * h, S[1] + g.n[1] * h]); right.push([S[0] - g.n[0] * h, S[1] - g.n[1] * h]); return; }
    const p = legs[i - 1], turnLeft = p.d[0] * g.d[1] - p.d[1] * g.d[0] > 0, m = [p.n[0] + g.n[0], p.n[1] + g.n[1]];
    left.push([g.C[0] + m[0] * h, g.C[1] + m[1] * h, turnLeft ? rin : rout]); right.push([g.C[0] - m[0] * h, g.C[1] - m[1] * h, turnLeft ? rout : rin]);
  });
  left.push([E[0] + end.n[0] * h, E[1] + end.n[1] * h]); right.push([E[0] - end.n[0] * h, E[1] - end.n[1] * h]);
  return { poly: [...right, ...left.reverse()].map((q) => q.map((x) => Math.round(x * 1e4) / 1e4)) };      // to the tenth of a micron : a copper track is 35 µm thick
}
/** Insulations a solid busbar can wear : the material of the sleeve and its usual thickness (mm). */
export const INSULATIONS = { "EPOXY": { fr: "Poudre époxy", t: 0.3 }, "PET-FILM": { fr: "Film polyester", t: 0.19 }, "PI-FILM": { fr: "Film polyimide", t: 0.1 } };
/** The windows of the sleeve : one where each terminal and each contact must touch the metal. → features of the body « isolant ». */
function windows(def, legs, ti, m) {
  const out = [], box = (id, leg, side, s, y, a, b) => { const g = legs[leg], q = onLeg(def, legs, leg, side, s, y), lo = side * (Math.abs(g.n[1]) > 0.5 ? g.n[1] : g.n[0]) > 0 ? q.level - 0.1 : q.level - ti - 0.1;      // a : along the leg, b : across
    out.push(q.face[1] === "Z" ? { op: "box", id, body: "isolant", mode: "cut", size: [r2(a), r2(b), r2(ti + 0.2)], at: [r2(q.at[0] - a / 2), r2(q.at[1] - b / 2), r2(lo)] } : { op: "box", id, body: "isolant", mode: "cut", size: [r2(ti + 0.2), r2(b), r2(a)], at: [r2(lo), r2(q.at[0] - b / 2), r2(q.at[1] - a / 2)] }); };
  for (const t of def.terminals) { if (!legs[t.leg]) continue; const d = (parseFloat(String(t.screw).replace(/[^0-9.]/g, "")) || 6) * 2 + 2 * m; for (const side of [1, -1]) box(`fen_${t.id}_${side > 0 ? "a" : "b"}`, t.leg, side, t.s, t.y ?? def.W / 2, d, Math.min(d, def.W)); }
  for (const c of def.contacts) { if (!legs[c.leg]) continue; box(`fen_${c.id}`, c.leg, c.side, c.s, c.y, (c.turn ? c.h : c.w) + 2 * m, (c.turn ? c.w : c.h) + 2 * m); }
  return out;
}
const nextId = (list, prefix) => `${prefix}${list.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ""), 10) || 0), 0) + 1}`;
/** A new terminal or contact where the designer pointed : it takes the next number of its kind, for good. where : { leg, side, s, y }. */
export function addTerminal(def, where, screw = "M6") { const t = { id: nextId(def.terminals, "T"), leg: where.leg, s: where.s, y: r2(def.W / 2), screw }; def.terminals.push(t); return t; }
export function addContact(def, where, o = {}) {
  const P = ELEC_INTERFACES.contact.params, w = Math.min(P.w, def.W - 2), i = def.I || P.i, form = contactAdvice({ i, t: def.t }).form;
  const c = { id: nextId(def.contacts, "CT"), leg: where.leg, side: where.side, s: where.s, y: where.y ?? r2(def.W / 2), turn: 0, role: "A", form, w, h: Math.min(P.h, def.W - 2), n: P.n, gap: form === "cone" ? 0.5 : P.gap, force: P.force, plating: P.plating, base: form === "band" ? P.base : "Cu", duty: "power", i, ...o };
  def.contacts.push(c); fit(def, c); return c;
}
/** The parameters of the interface of a contact : what the designer set, and — for a form made in the bar itself — the thickness of the bar. */
export function contactParams(def, c) {
  const form = contactForm(c, { band: c.band });
  return { w: c.w, h: c.h, n: c.n, gap: c.gap, force: c.force, plating: c.plating, base: c.base, duty: c.duty, i: c.i, ...(c.form ? { form: c.form } : {}), ...(c.u > 0 ? { u: c.u } : {}), ...(c.weld === "projection" ? { weld: "projection" } : {}), ...(form === "bridge" ? { t: Math.min(def.t, c.t || def.t) } : {}) };
}
/** Keeps a contact on the flat part of its leg and inside the width. */
export function fit(def, c) {
  const g = legsOf(def)[c.leg]; if (!g) return c;
  const along = c.turn ? c.h : c.w, across = c.turn ? c.w : c.h;
  c.s = r2(Math.max(g.from + along / 2, Math.min(g.to - along / 2, c.s))); c.y = r2(Math.max(across / 2, Math.min(def.W - across / 2, c.y)));
  return c;
}
/** What the strip is worth : section, current density, resistance and loss at 20 °C, developed length, and what does not follow the rules of the trade. */
export function busbarChecks(def) {
  const legs = legsOf(def), mat = material(def.material), P = props(def.material), S = def.W * def.t, len = legs.reduce((a, g) => a + g.L, 0), bends = legs.length - 1, notes = [];
  const flat = len - bends * 2 * (def.r + def.t / 2) + bends * (Math.PI / 2) * (def.r + KFACTOR * def.t), rho = (P && P.rhoE) || 1.724e-8, R = rho * (len / 1000) / (S * 1e-6), I = Number(def.I) || 0, J = I / S;
  const say = (level, text) => notes.push({ level, text });
  if (!mat || !mat.conductive) say("bad", `${mat ? mat.name : def.material} ne conduit pas : un busbar est en cuivre ou en aluminium.`);
  if (J > 5) say("bad", `${fr(J)} A/mm² : au-delà de 5 A/mm², la barre chauffe fort même bien refroidie — élargir ou épaissir.`); else if (J > 2.5) say("check", `${fr(J)} A/mm² : au-dessus du repère de 2,5 A/mm² à l'air libre — vérifier l'échauffement (écran Physique, modèle « busbar »).`);
  const rMin = ((mat && mat.rMinT) || 1) * def.t; if (bends && def.r < rMin - 1e-9) say("bad", `Rayon de pliage intérieur de ${fr(def.r)} mm pour ${fr(def.t)} mm d'épaisseur : au moins ${fr(rMin)} mm pour cette matière, sinon la fibre extérieure fissure.`);
  legs.forEach((g) => { if (g.to - g.from < 4) say("bad", `Branche ${g.i + 1} de ${fr(g.L)} mm : trop courte entre ses plis — il reste ${fr(Math.max(0, g.to - g.from))} mm de plat.`); });
  for (const t of def.terminals) { const g = legs[t.leg]; if (!g) { say("bad", `${t.id} : sa branche n'existe plus.`); continue; } const d = parseFloat(String(t.screw).replace(/[^0-9.]/g, "")) || 6;
    const lo = g.i === 0 ? 1.5 * d : g.from + d, hi = g.i === legs.length - 1 ? g.L - 1.5 * d : g.to - d;
    if (t.s < lo - 0.01 || t.s > hi + 0.01) say("check", `${t.id} (${t.screw}) : à moins de 1,5 × d d'un bout ou trop près d'un pli de la branche ${g.i + 1}.`);
    if (def.W < 2.5 * d) say("check", `${t.id} (${t.screw}) : largeur de ${fr(def.W)} mm pour une vis de ${d} mm — il reste peu de section autour du trou.`); }
  for (const c of def.contacts) { const g = legs[c.leg]; if (!g) { say("bad", `${c.id} : sa branche n'existe plus.`); continue; }
    for (const n of [...contactEstimate(c).notes, ...contactFormNotes(contactParams(def, c), { band: c.band })]) say("check", `${c.id} : ${n}`);
    if (c.duty === "power" && def.finish === "none") say("check", `${c.id} : plage de contact sur cuivre nu — l'oxyde monte la résistance avec le temps ; revêtir la plage (${PLATINGS[c.plating].fr.toLowerCase()}).`); }
  return { S: r2(S), J: r2(J), length: r2(len), flat: r2(flat), bends, R: R * 1e6, P: I * I * R, dU: I * R * 1e3, notes, ok: !notes.some((n) => n.level === "bad") };
}
/** Writes the part from its definition. Interfaces the definition does not own (added elsewhere) are kept. */
export function busbarPart(def, id, before = null) {
  const legs = legsOf(def), key = slug(`${id}_${def.name}`), fix = (v, label, group) => ({ value: v, min: v, max: v, step: 0.1, unit: "mm", label, group }), mine = new Set([...def.terminals, ...def.contacts].map((x) => x.id));
  const terminals = def.terminals.filter((t) => legs[t.leg]).map((t) => { const side = 1, q = onLeg(def, legs, t.leg, side, t.s, t.y ?? def.W / 2);
    return { id: t.id, type: "bolt_pattern", name: `Borne ${t.id} — ${def.net}`, key: t.key || `${key}_${t.id.toLowerCase()}`, side: "A", face: q.face, level: q.level, at: q.at, params: { screw: t.screw || "M6", pattern: { type: "single" } }, opts: { depth: r2(def.t + 0.5) } }; });
  const contacts = def.contacts.filter((c) => legs[c.leg]).map((c) => { const q = onLeg(def, legs, c.leg, c.side, c.s, c.y), rot = (q.along + (c.turn ? 90 : 0)) % 180;
    return { id: c.id, type: "contact", name: `${CONTACT_FORMS[contactForm(c, { band: c.band })].name} ${c.id} — ${def.net}`, key: c.key || `${key}_${c.id.toLowerCase()}`, side: c.role === "B" ? "B" : "A", face: q.face, level: q.level, at: q.at, ...(rot ? { rot } : {}), ...(c.external ? { external: true } : {}),
      params: contactParams(def, c), opts: { band: c.band || (c.form && c.form !== "band" ? "integral" : "insert") } }; });
  const ins = def.insulation && def.insulation.t > 0 && material(def.insulation.material) ? def.insulation : null;
  const kept = ((before && before.interfaces) || []).filter((i) => !mine.has(i.id) && !/^(T|CT)\d+$/.test(i.id)), ch = busbarChecks(def);
  return { ...(before ? { revision: before.revision, characteristics: before.characteristics } : {}), dw: "part/1", id, name: def.name || "Busbar", function: `Conduit ${def.net}${def.I ? ` : ${fr(def.I)} A` : ""} entre ${def.terminals.length + def.contacts.length} point(s) de raccordement`,
    family: "busbar", process: legs.length > 1 ? "sheet_metal" : "laser_cut", material: def.material, ...(def.finish && def.finish !== "none" ? { finish: FINISHES[def.finish] } : {}), elec: { kind: "conductor", net: def.net }, busbar: JSON.parse(JSON.stringify(def)),
    params: { W: { value: def.W, min: Math.max(2, def.W / 4), max: def.W * 4, step: 0.5, unit: "mm", label: "Largeur", group: "Bande" }, t: fix(def.t, "Épaisseur (se règle dans l'écran Busbars)", "Bande"), ...(legs.length > 1 ? { r: fix(def.r, "Rayon de pliage intérieur", "Bande") } : {}) },
    ...(ins ? { bodies: { isolant: { material: ins.material, kind: "insulator", label: INSULATIONS[ins.material] ? INSULATIONS[ins.material].fr : "Isolant" } } } : {}),
    features: [{ op: "extrude", id: "bande", name: "Bande", profile: stripProfile(def), plane: "XZ", length: "W" },
      ...(ins ? [{ op: "extrude", id: "gaine", name: "Isolant", body: "isolant", profile: stripProfile(def, ins.t), plane: "XZ", at: -ins.t, length: `W + ${r2(2 * ins.t)}` }, { op: "extrude", id: "gaine_ame", body: "isolant", mode: "cut", profile: stripProfile(def), plane: "XZ", length: "W" }, ...windows(def, legs, ins.t, ins.margin ?? 2)] : []),
      { op: "interfaces" }], interfaces: [...terminals, ...contacts, ...kept],
    notes: [`Section ${fr(ch.S)} mm², ${fr(ch.J)} A/mm² à ${fr(def.I || 0)} A ; résistance à 20 °C ≈ ${fr(ch.R)} µΩ.`, ...(ch.bends ? [`Développé ≈ ${fr(ch.flat)} mm (${ch.bends} pli(s) à 90°, rayon intérieur ${fr(def.r)} mm, facteur K ${String(KFACTOR).replace(".", ",")}) : à confirmer par le plieur.`] : []),
      ...(ins ? [`Isolant : ${(INSULATIONS[ins.material] || { fr: ins.material }).fr.toLowerCase()} de ${fr(ins.t)} mm, ouvert par une fenêtre à chaque borne et à chaque contact (${fr(ins.margin ?? 2)} mm de marge).`] : []),
      ...(def.contacts.length ? ["Plages de contact : planéité 0,05 mm, sans bavure ni rayure ; revêtement selon la nomenclature du contact."] : [])] };
}
