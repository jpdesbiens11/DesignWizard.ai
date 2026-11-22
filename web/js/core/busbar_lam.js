/* DesignOrbit.ai — the laminated busbar and the thermal pad.
   A laminated busbar is a flat stack : conductors of opposite potentials lying on each other, a sheet of aramid paper
   between them through the whole thickness, a polymer film wrapped outside. The insulation overhangs the conductors all
   round — that overhang is the creepage path between two layers. Each conductor comes out at both ends by a tab of its own,
   side by side across the width, with its screw. One part, one body per layer : the isolation analysis sees every
   conductor with its potential and every insulator with its material. Pure : no kernel, no DOM.
   A laminate may carry its own measuring circuit : a flexible circuit laid in a slot of the paper between two conductors — a
   voltage tap on each of the two plates it touches, temperature probes at the core of the stack, a tail that leaves by the side.
   def = { name, L, W, e (overhang), material, layers: [{ net, t }], paper: { material, t }, wrap: { material, t } | null,
           tab: { L, screw, gap }, U (volts between neighbours), I (amperes per conductor),
           flex: { after (the conductor it lies on, counted from 1), t, cu, W, w (track), gap, ntc, tail: { L, ref } } | null } */

import { material } from "../cad/materials.js";
import { connector } from "../cad/elec_library.js";
import { sheetSeries } from "../cad/special_processes.js";

const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000, fr = (x) => String(r2(x)).replace(".", ",");
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
/** Aramid paper comes in these thicknesses (mm). */
export const PAPER_THICKNESS = sheetSeries("NOMEX-410");
export const blankLaminate = () => ({ name: "Busbar laminé", L: 120, W: 40, e: 4, material: "CU-C110", layers: [{ net: "HV+", t: 1.5 }, { net: "HV-", t: 1.5 }], paper: { material: "NOMEX-410", t: 0.25 }, wrap: { material: "PET-FILM", t: 0.19 }, tab: { L: 18, screw: "M6", gap: 8 }, U: 800, I: 150 });

/** The measuring circuit, as it is proposed : between the first two conductors, one probe, a tail for a board connector. */
export const blankLamFlex = () => ({ after: 1, t: 0.2, cu: 0.035, W: 10, w: 0.3, gap: 0.5, ntc: 1, tail: { L: 20, ref: "hirose-fh12" } });
const NTC = [1.6, 0.8, 0.5], POCKET = [2.6, 1.8, 0.6], PAD = 3, STIFF = 6;        // a 0603 thermistor, the pocket that houses it in the plate above, a tap, the stiffened end of the tail
/** The tracks of the measuring circuit across its width : the tap of the plate below at one edge, the probes and their return in the
    middle, the tap of the plate above at the other edge — the two potentials of the stack as far apart as the strip allows. */
export function lamFlexTracks(def) {
  const f = def.flex, lo = def.layers[f.after - 1], hi = def.layers[f.after], list = [], edge = 0.5;
  if (lo) list.push({ id: "VS1", net: lo.net, fn: `Prise de tension ${lo.net}`, tap: "below" });
  for (let i = 1; i <= (f.ntc || 0); i++) list.push({ id: `TS${i}`, net: `TS${i}`, fn: `Sonde de température ${i}` });
  if (f.ntc) list.push({ id: "T-RET", net: "T-RET", fn: "Retour commun des sondes" });
  if (hi) list.push({ id: "VS2", net: hi.net, fn: `Prise de tension ${hi.net}`, tap: "above" });
  let x = edge; const rows = list.map((t) => { const row = { ...t, x: r3(x), w: f.w }; x += f.w + f.gap; return row; }), used = r2(x - f.gap + edge), last = rows.at(-1);
  if (last && last.tap === "above" && used <= f.W) last.x = r3(f.W - edge - f.w);
  return { rows, used };
}

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
  let flex = null;
  if (def.flex) {
    const f = def.flex, cover = (f.t - f.cu) / 2, hold = ((material("PI-FILM") || {}).dielectricKvMm || 0) * cover * 1000, lay = lamFlexTracks(def), up = def.layers[f.after], thicker = PAPER_THICKNESS.find((x) => x >= f.t), c = f.tail && connector(f.tail.ref);
    flex = { tracks: lay.rows, used: lay.used, pins: lay.rows.length, cover: r3(cover), hold, buried: r2(Math.min(def.W - 4, 30)) };
    if (!(f.after >= 1 && f.after < n)) say("bad", "Le circuit de mesure se loge entre deux conducteurs : il lui en faut un dessous et un dessus.");
    if (f.t > def.paper.t + 1e-9) say("bad", `Circuit de mesure de ${fr(f.t)} mm dans un papier de ${fr(def.paper.t)} mm : il ferait une bosse dans l'empilage — passer le papier à ${fr(thicker || f.t)} mm au moins.`);
    if (hold < test) say("bad", `Couverture du circuit de mesure : ${fr(cover * 1000)} µm de polyimide entre une piste et la plaque voisine, soit environ ${fr(hold / 1000)} kV pour un essai de ${fr(test / 1000)} kV — épaissir le circuit.`);
    if (lay.used > f.W + 1e-9) say("bad", `${lay.rows.length} pistes prennent ${fr(lay.used)} mm : le circuit de mesure n'en fait que ${fr(f.W)} — l'élargir.`);
    if (f.ntc && up && up.t < POCKET[2] + 0.5) say("bad", `Sonde de ${fr(NTC[2])} mm d'épaisseur : elle se loge dans un lamage de ${fr(POCKET[2])} mm de la plaque du dessus, qui n'a que ${fr(up.t)} mm.`);
    if (f.ntc && 6 + 5 * f.ntc > flex.buried) say("bad", `${f.ntc} sondes ne tiennent pas sur les ${fr(flex.buried)} mm de circuit pris entre les plaques.`);
    if (c && lay.rows.length * 0.5 + 1 > f.W) say("bad", `${lay.rows.length} contacts au pas de 0,5 mm ne tiennent pas dans une queue de ${fr(f.W)} mm.`);
    say("check", `Circuit de mesure : les pistes des prises portent les potentiels des plaques (${def.U || 0} V entre elles), celles des sondes le potentiel de la carte de mesure. L'écart entre pistes (${fr(f.gap)} mm) et la ligne de fuite sur la queue se jugent dans l'écran Isolation ; prévoir une résistance ou un fusible en série sur chaque prise, au plus près de la plaque.`);
  }
  return { rows, tabW: r2(wt), withstand, test, creep: r2(creep), flex, notes, ok: !notes.some((x) => x.level === "bad") };
}
/** Writes the part : conductors (the first is the main body), paper sheets, outer film, tabs and their screw interfaces. */
export function laminatePart(def, id) {
  const n = def.layers.length, tw = def.wrap ? def.wrap.t : 0, tp = def.paper.t, key = slug(`${id}_${def.name}`), ch = laminateChecks(def), wt = ch.tabW, features = [], bodies = {}, interfaces = [];
  let z = 0, zf = null;
  const sheet = (bid, idx, t) => { features.push({ op: "box", id: idx, body: bid, size: ["L + 2*e", "W + 2*e", t], at: ["-e", "-e", r2(z)] }); z += t; };
  if (def.wrap) { bodies.enveloppe = { material: def.wrap.material, kind: "insulator", label: "Enveloppe" }; sheet("enveloppe", "film_bas", tw); }
  def.layers.forEach((l, k) => {
    const body = k ? `c${k + 1}` : "main", y0 = r2(k * (wt + def.tab.gap));
    if (k) { bodies[`p${k}`] = { material: def.paper.material, kind: "insulator", label: `Papier ${k}` }; if (def.flex && def.flex.after === k) zf = z; sheet(`p${k}`, `papier${k}`, tp); bodies[body] = { material: def.material, net: l.net, kind: "conductor", label: l.net }; }
    features.push({ op: "box", id: `cond${k + 1}`, name: `Conducteur ${l.net}`, body, size: ["L", "W", l.t], at: [0, 0, r2(z)] },
      { op: "box", id: `patte${k + 1}a`, body, size: [def.tab.L, wt, l.t], at: [-def.tab.L, y0, r2(z)] }, { op: "box", id: `patte${k + 1}b`, body, size: [def.tab.L, wt, l.t], at: ["L", y0, r2(z)] });
    for (const [tag, x] of [["a", r2(-def.tab.L / 2 - def.e / 2)], ["b", `L + ${r2(def.tab.L / 2 + def.e / 2)}`]]) interfaces.push({ id: `T${k + 1}${tag}`, type: "bolt_pattern", name: `Borne ${l.net} ${tag === "a" ? "entrée" : "sortie"}`, key: `${key}_t${k + 1}${tag}`, side: "A", face: "+Z", level: r2(z + l.t), at: [x, r2(y0 + wt / 2)], ...(k ? { body } : {}),
      params: { screw: def.tab.screw, pattern: { type: "single" } }, opts: { depth: r2(l.t + 0.5) } });
    z += l.t;
  });
  if (def.wrap) sheet("enveloppe", "film_haut", tw);
  const fx = zf === null ? null : measuringCircuit(def, ch, zf, key); if (fx) { Object.assign(bodies, fx.bodies); features.push(...fx.features); interfaces.push(...fx.interfaces); }
  const pm = material(def.paper.material) || { name: def.paper.material }, wm = def.wrap ? material(def.wrap.material) || { name: def.wrap.material } : null;
  return { dw: "part/1", id, name: def.name || "Busbar laminé", function: `Conduit ${def.layers.map((l) => l.net).join(" et ")} l'un sur l'autre : faible inductance, potentiels isolés par du papier aramide${fx ? " ; il mesure lui-même ses tensions et sa température" : ""}`, family: "busbar", process: "purchased", material: def.material,
    elec: { kind: "conductor", net: def.layers[0].net }, laminate: JSON.parse(JSON.stringify(def)), bodies,
    params: { L: { value: def.L, min: 20, max: 2000, step: 1, unit: "mm", label: "Longueur des conducteurs", group: "Barre" }, W: { value: def.W, min: def.W, max: def.W, step: 1, unit: "mm", label: "Largeur (se règle à la création)", group: "Barre" }, e: { value: def.e, min: 1, max: 30, step: 0.5, unit: "mm", label: "Débord de l'isolant", group: "Isolation" } },
    features: [...features, { op: "interfaces" }], interfaces,
    notes: [...(fx ? fx.notes : []), `Empilage, de bas en haut : ${[wm ? `${wm.name} ${fr(tw)} mm` : null, ...def.layers.flatMap((l, k) => [k ? `${pm.name} ${fr(tp)} mm` : null, `${l.net} ${fr(l.t)} mm`]), wm ? `${wm.name} ${fr(tw)} mm` : null].filter(Boolean).join(" · ")}. Épaisseur totale ${fr(z)} mm.`,
      `Le papier dépasse les conducteurs de ${fr(def.e)} mm tout autour : ligne de fuite ${fr(ch.creep)} mm entre voisins. Tenue du papier ≈ ${fr(ch.withstand / 1000)} kV pour un essai de ${fr(ch.test / 1000)} kV.`,
      "Collage des couches à chaud sous presse ; bords de l'enveloppe scellés ; essai diélectrique entre conducteurs sur chaque pièce.", "Ordres de grandeur : la fiche de l'isolant acheté et l'essai font foi."] };
}
/* The measuring circuit, written into the stack : a slot in the paper, the film, a copper body per track, a tap on each plate, the probes
   and their pockets, the stiffened tail and its interface. It crosses the bar at mid-length and leaves by the +Y side. zf : the top of the plate it lies on. */
function measuringCircuit(def, ch, zf, key) {
  /* zc, zu : the levels under and over the copper of the tracks, in the middle of the film */
  const f = def.flex, k = f.after, tp = def.paper.t, zc = r3(zf + (f.t - f.cu) / 2), zu = r3(zc + f.cu), cover = r3(zc - zf), inL = ch.flex.buried, tail = (f.tail && f.tail.L) || 20, c = f.tail && connector(f.tail.ref), up = `c${k + 1}`, bodies = {}, features = [], interfaces = [];
  const x0 = (dx) => `L/2 - ${r3(f.W / 2 - dx)}`, y0 = (dy) => `W - ${r3(inL - dy)}`, stiff = r2(Math.max(0.05, 0.3 - f.t));
  bodies.flex = { material: "PI-FILM", kind: "insulator", label: "Circuit de mesure" };
  features.push({ op: "box", id: "fente_papier", name: "Fente du papier pour le circuit de mesure", body: `p${k}`, mode: "cut", size: [r2(f.W + 0.4), `${r2(inL + 0.4)} + e`, r2(tp + 0.1)], at: [x0(-0.2), y0(-0.2), r3(zf - 0.05)] },
    { op: "box", id: "film_mesure", name: "Circuit de mesure", body: "flex", size: [f.W, `${r2(inL + tail)} + e`, f.t], at: [x0(0), y0(0), r3(zf)] });
  ch.flex.tracks.forEach((t, i) => { const body = `piste${i + 1}`, geo = { size: [t.w, `${r2(inL + tail - 1.5)} + e`, r3(zu - zc)], at: [x0(t.x), y0(1), zc] };
    bodies[body] = { material: "CU-C110", net: t.net, kind: "conductor", label: `${t.id} ${t.net}` };
    features.push({ op: "box", id: `lit${i + 1}`, body: "flex", mode: "cut", ...geo }, { op: "box", id: body, name: `Piste ${t.id} — ${t.net}`, body, ...geo });
    if (!t.tap) return;                                                               // a tap : a window in the cover, and a pad that touches its plate
    const below = t.tap === "below", px = below ? 0 : r3(f.W - 1), zt = below ? r3(zf) : zu, h = r3(below ? zc - zf : zf + tp - zu), pad = `vs${below ? 1 : 2}`;
    bodies[pad] = { material: "CU-C110", net: t.net, kind: "conductor", label: `${t.id} ${t.net}` };
    features.push({ op: "box", id: `fenetre_${pad}`, body: "flex", mode: "cut", size: [1, PAD, r3(below ? zc - zf : zf + f.t - zu)], at: [x0(px), y0(1), zt] }, { op: "box", id: pad, name: `Prise de tension ${t.net}`, body: pad, size: [1, PAD, h], at: [x0(px), y0(1), zt] }); });
  for (let i = 1; i <= (f.ntc || 0); i++) { const body = `ts${i}`, yc = 6 + 5 * (i - 1);
    bodies[body] = { material: "GENERIC-COMPONENT", kind: "insulator", label: `Sonde TS${i}` };
    features.push({ op: "box", id: `lamage_${body}`, name: `Lamage de la sonde TS${i}`, body: up, mode: "cut", size: [POCKET[0], POCKET[1], r2(POCKET[2] + 0.05)], at: [`L/2 - ${POCKET[0] / 2}`, y0(yc - POCKET[1] / 2), r3(zf + tp - 0.05)] },
      { op: "box", id: body, name: `Sonde de température TS${i}`, body, size: NTC, at: [`L/2 - ${NTC[0] / 2}`, y0(yc - NTC[1] / 2), r3(zf + f.t)] }); }
  bodies.raidisseur = { material: "FR4", kind: "insulator", label: "Raidisseur de la queue" };
  features.push({ op: "box", id: "raidisseur", name: "Raidisseur de la queue", body: "raidisseur", size: [f.W, STIFF, stiff], at: [x0(0), `W + e + ${r2(tail - STIFF)}`, r3(zf - stiff)] });
  interfaces.push({ id: "FQ", type: "planar", name: `Queue du circuit de mesure${c ? ` — ${c.maker} ${c.series}` : ""}`, key: `${key}_queue`, partner: "Carte de mesure", side: "A", face: "+Z", level: r3(zf + f.t), at: ["L/2", `W + e + ${r2(tail - STIFF / 2)}`], body: "flex", params: { w: f.W, h: STIFF } });
  const lo = def.layers[k - 1], hi = def.layers[k];
  return { bodies, features, interfaces, notes: [`Circuit de mesure entre ${lo.net} et ${hi.net} : polyimide de ${fr(f.t)} mm dans une fente du papier, à mi-longueur ; une prise de tension soudée sur chacune des deux plaques${f.ntc ? `, ${f.ntc} sonde(s) de température au cœur de l'empilage, logée(s) dans un lamage de ${fr(POCKET[2])} mm de la plaque ${hi.net}` : ""}.`,
    `Queue de ${fr(tail)} mm sortant par le côté, raidie sur ${STIFF} mm, ${ch.flex.pins} contacts${c ? ` — ${c.maker} ${c.series}` : ""} : ${ch.flex.tracks.map((t) => t.net).join(", ")}. Couverture de ${fr(cover * 1000)} µm entre piste et plaque (≈ ${fr(ch.flex.hold / 1000)} kV).`,
    "Circuit de mesure : géométrie de principe — pistes droites, sans plages ni routage ; le scellement de l'enveloppe autour de la queue n'est pas dessiné."] };
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
