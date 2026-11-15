/* DesignWizard.ai — the laminated busbar and the thermal pad.
   A laminated busbar is a flat stack : conductors of opposite potentials lying on each other, a sheet of aramid paper
   between them through the whole thickness, a polymer film wrapped outside. The insulation overhangs the conductors all
   round — that overhang is the creepage path between two layers. Each conductor comes out at both ends by a tab of its own,
   side by side across the width, with its screw. One part, one body per layer : the isolation analysis sees every
   conductor with its potential and every insulator with its material. Pure : no kernel, no DOM.
   def = { name, L, W, e (overhang), material, layers: [{ net, t }], paper: { material, t }, wrap: { material, t } | null,
           tab: { L, screw, gap }, U (volts between neighbours), I (amperes per conductor) } */

import { material } from "../cad/materials.js";

const r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ",");
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
/** Aramid paper comes in these thicknesses (mm). */
export const PAPER_THICKNESS = [0.05, 0.08, 0.13, 0.18, 0.25, 0.3, 0.38, 0.51, 0.76];
export const blankLaminate = () => ({ name: "Busbar laminé", L: 120, W: 40, e: 4, material: "CU-C110", layers: [{ net: "HV+", t: 1.5 }, { net: "HV-", t: 1.5 }], paper: { material: "NOMEX-410", t: 0.25 }, wrap: { material: "PET-FILM", t: 0.19 }, tab: { L: 18, screw: "M6", gap: 8 }, U: 800, I: 150 });

/** What the stack is worth : section and current density per conductor, what the paper withstands, the creepage round its edge, the air between two tabs. */
export function laminateChecks(def) {
  const n = def.layers.length, pm = material(def.paper.material) || {}, notes = [], say = (level, text) => notes.push({ level, text });
  const wt = (def.W - (n - 1) * def.tab.gap) / n, withstand = (pm.dielectricKvMm || 0) * def.paper.t * 1000, test = 2 * (def.U || 0) + 1000, creep = 2 * def.e + def.paper.t, d = parseFloat(String(def.tab.screw).replace(/[^0-9.]/g, "")) || 6;
  const rows = def.layers.map((l) => ({ net: l.net, S: r2(def.W * l.t), J: r2((def.I || 0) / (def.W * l.t)) }));
  if (n < 2) say("bad", "Un busbar laminé a au moins deux conducteurs.");
  if (withstand < test) say("bad", `Papier de ${fr(def.paper.t)} mm : il tient environ ${fr(withstand / 1000)} kV, pour un essai diélectrique de 2 U + 1000 V = ${fr(test / 1000)} kV — épaissir le papier.`);
  if (wt < 2.5 * d) say("bad", `Pattes de ${fr(wt)} mm de large pour une vis ${def.tab.screw} : il faut au moins ${fr(2.5 * d)} mm — élargir la barre ou réduire l'écart entre pattes.`);
  if (def.tab.L <= def.e + 1.5 * d) say("bad", `Pattes de ${fr(def.tab.L)} mm : elles doivent dépasser l'isolant (${fr(def.e)} mm) de 1,5 × d au moins pour la vis.`);
  for (const r of rows) { if (r.J > 5) say("bad", `${r.net} : ${fr(r.J)} A/mm² — au-delà de 5 A/mm².`); else if (r.J > 2.5) say("check", `${r.net} : ${fr(r.J)} A/mm² — au-dessus du repère de 2,5 A/mm² ; une barre laminée évacue mal sa chaleur au cœur.`); }
  say("check", `Ligne de fuite entre deux conducteurs voisins, par le bord du papier : ${fr(creep)} mm ; distance dans l'air entre deux pattes : ${fr(def.tab.gap)} mm — à juger pour ${def.U || 0} V dans l'écran Isolation, sur l'assemblage.`);
  return { rows, tabW: r2(wt), withstand, test, creep: r2(creep), notes, ok: !notes.some((x) => x.level === "bad") };
}
/** Writes the part : conductors (the first is the main body), paper sheets, outer film, tabs and their screw interfaces. */
export function laminatePart(def, id) {
  const n = def.layers.length, tw = def.wrap ? def.wrap.t : 0, tp = def.paper.t, key = slug(`${id}_${def.name}`), ch = laminateChecks(def), wt = ch.tabW, features = [], bodies = {}, interfaces = [];
  let z = 0;
  const sheet = (bid, idx, t) => { features.push({ op: "box", id: idx, body: bid, size: ["L + 2*e", "W + 2*e", t], at: ["-e", "-e", r2(z)] }); z += t; };
  if (def.wrap) { bodies.enveloppe = { material: def.wrap.material, kind: "insulator", label: "Enveloppe" }; sheet("enveloppe", "film_bas", tw); }
  def.layers.forEach((l, k) => {
    const body = k ? `c${k + 1}` : "main", y0 = r2(k * (wt + def.tab.gap));
    if (k) { bodies[`p${k}`] = { material: def.paper.material, kind: "insulator", label: `Papier ${k}` }; sheet(`p${k}`, `papier${k}`, tp); bodies[body] = { material: def.material, net: l.net, kind: "conductor", label: l.net }; }
    features.push({ op: "box", id: `cond${k + 1}`, name: `Conducteur ${l.net}`, body, size: ["L", "W", l.t], at: [0, 0, r2(z)] },
      { op: "box", id: `patte${k + 1}a`, body, size: [def.tab.L, wt, l.t], at: [-def.tab.L, y0, r2(z)] }, { op: "box", id: `patte${k + 1}b`, body, size: [def.tab.L, wt, l.t], at: ["L", y0, r2(z)] });
    for (const [tag, x] of [["a", r2(-def.tab.L / 2 - def.e / 2)], ["b", `L + ${r2(def.tab.L / 2 + def.e / 2)}`]]) interfaces.push({ id: `T${k + 1}${tag}`, type: "bolt_pattern", name: `Borne ${l.net} ${tag === "a" ? "entrée" : "sortie"}`, key: `${key}_t${k + 1}${tag}`, side: "A", face: "+Z", level: r2(z + l.t), at: [x, r2(y0 + wt / 2)], ...(k ? { body } : {}),
      params: { screw: def.tab.screw, pattern: { type: "single" } }, opts: { depth: r2(l.t + 0.5) } });
    z += l.t;
  });
  if (def.wrap) sheet("enveloppe", "film_haut", tw);
  const pm = material(def.paper.material) || { name: def.paper.material }, wm = def.wrap ? material(def.wrap.material) || { name: def.wrap.material } : null;
  return { dw: "part/1", id, name: def.name || "Busbar laminé", function: `Conduit ${def.layers.map((l) => l.net).join(" et ")} l'un sur l'autre : faible inductance, potentiels isolés par du papier aramide`, family: "busbar", process: "purchased", material: def.material,
    elec: { kind: "conductor", net: def.layers[0].net }, laminate: JSON.parse(JSON.stringify(def)), bodies,
    params: { L: { value: def.L, min: 20, max: 2000, step: 1, unit: "mm", label: "Longueur des conducteurs", group: "Barre" }, W: { value: def.W, min: def.W, max: def.W, step: 1, unit: "mm", label: "Largeur (se règle à la création)", group: "Barre" }, e: { value: def.e, min: 1, max: 30, step: 0.5, unit: "mm", label: "Débord de l'isolant", group: "Isolation" } },
    features: [...features, { op: "interfaces" }], interfaces,
    notes: [`Empilage, de bas en haut : ${[wm ? `${wm.name} ${fr(tw)} mm` : null, ...def.layers.flatMap((l, k) => [k ? `${pm.name} ${fr(tp)} mm` : null, `${l.net} ${fr(l.t)} mm`]), wm ? `${wm.name} ${fr(tw)} mm` : null].filter(Boolean).join(" · ")}. Épaisseur totale ${fr(z)} mm.`,
      `Le papier dépasse les conducteurs de ${fr(def.e)} mm tout autour : ligne de fuite ${fr(ch.creep)} mm entre voisins. Tenue du papier ≈ ${fr(ch.withstand / 1000)} kV pour un essai de ${fr(ch.test / 1000)} kV.`,
      "Collage des couches à chaud sous presse ; bords de l'enveloppe scellés ; essai diélectrique entre conducteurs sur chaque pièce.", "Ordres de grandeur : la fiche de l'isolant acheté et l'essai font foi."] };
}
/** A thermal pad as a part : it is squeezed between two flat faces. o : { id, L, W, t, squeeze (share of the thickness lost when pressed), material }. */
export function thermalPadPart(o = {}) {
  const L = o.L || 40, W = o.W || 40, t = o.t || 1, sq = o.squeeze ?? 0.2, mat = material(o.material || "THERMAL-PAD"), k = (mat && mat.k) || 3, tc = r2(t * (1 - sq)), R = tc / 1000 / (k * L * W * 1e-6), key = slug(`${o.id || "pad"}_pad`);
  const face = (id, f, name) => ({ id, type: "planar", name, key: `${key}_${id.toLowerCase()}`, side: "A", face: f, at: ["L/2", "W/2"], params: { w: "L", h: "W" } });
  return { dw: "part/1", id: o.id || "PAD-1", name: `Pad thermique ${fr(L)} × ${fr(W)} × ${fr(t)}`, function: `Conduit la chaleur entre deux faces : ≈ ${fr(R)} K/W une fois écrasé à ${fr(tc)} mm`, family: "thermal", process: "purchased", material: mat ? mat.id : "THERMAL-PAD", elec: { kind: "insulator" },
    thermal: { k, t, squeeze: sq, R: r2(R) }, params: { L: { value: L, min: 5, max: 500, step: 1, unit: "mm", label: "Longueur", group: "Pad" }, W: { value: W, min: 5, max: 500, step: 1, unit: "mm", label: "Largeur", group: "Pad" }, tc: { value: tc, min: 0.1, max: 10, step: 0.05, unit: "mm", label: "Épaisseur écrasée", group: "Pad" } },
    features: [{ op: "box", id: "pad", name: "Pad", size: ["L", "W", "tc"] }, { op: "interfaces" }], interfaces: [face("IF1", "-Z", "Face froide"), face("IF2", "+Z", "Face chaude")],
    notes: [`Épaisseur libre ${fr(t)} mm, modélisé écrasé de ${Math.round(sq * 100)} % : ${fr(tc)} mm. Résistance thermique ≈ épaisseur / (k × surface) = ${fr(R)} K/W avec k = ${fr(k)} W/m·K.`, "L'effort d'écrasement et la résistance réelle dépendent de la pression : fiche du pad acheté à suivre.", "Isolant électrique : sa tenue diélectrique se lit sur la fiche, pour l'épaisseur écrasée."] };
}
