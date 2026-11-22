/* DesignOrbit.ai — the Shop companion for an EXTRUDED PROFILE. The designer says what goes inside — boards that slide
   in grooves, things that rest flat, things that just need room — and what the profile meets : each interface has its
   identity and must mate in the profile. The section then draws itself with the extruder's rules of thumb : one wall
   chosen for the size of the section, grooves made by two ribs no deeper than three times their width, a rib under
   each edge of what rests flat, a boss in each corner for the screws of the end plates, radii everywhere, a section
   symmetric about its middle. Aluminium is pushed through a die with mandrels, a plastic through a die and a
   calibrator : each with its own figures. Every decision is written down. The extruder's advice prevails. */

import { thread } from "../cad/standards.js";
import { material } from "../cad/materials.js";

const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100, half = (x) => Math.ceil(x * 2 - 1e-9) / 2, fr = (x) => String(r2(x)).replace(".", ",");
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40).replace(/^_+|_+$/g, "");

/** The extruder's figures, by process. wall(ccd) : the wall for a section whose circumscribed circle is ccd ; groove : depth over
    width of a groove at most ; port : hole for a thread-forming screw, by size ; side : clearance each side of a sliding tongue. */
export const EXTRUSION_RULES = {
  extrusion_al: { label: "Aluminium extrusion", fr: "extrusion d'aluminium", wall: (ccd) => (ccd <= 100 ? 1.5 : ccd <= 150 ? 2 : 2.5), groove: 3, side: 0.15, port: { M3: 2.7, M4: 3.6, M5: 4.5 },
    notes: ["Tolérances de section EN 12020-2 ; coupe à la scie ± 0,5 mm", "Anodisation 10 à 15 µm après usinage ; les rainures s'en trouvent réduites de 0,02 à 0,03 mm", "Casser les angles de coupe 0,2 à 0,5 mm"] },
  extrusion_plastic: { label: "Plastic extrusion", fr: "extrusion plastique", wall: (ccd) => (ccd <= 80 ? 1.5 : ccd <= 150 ? 2 : 2.5), groove: 2, side: 0.25, port: { M3: 2.6, M4: 3.5, M5: 4.4 },
    notes: ["Tolérances de section ± 0,3 mm, à confirmer avec l'extrudeur (calibrage)", "Coupe à la scie ± 0,5 mm ; ébavurer", "Retrait et flèche à contrôler sur les premières barres"] },
};
/** The extrusion process a material goes to. */
export function extrusionProcess(matId) { const m = material(matId); return m && m.processes.includes("extrusion_plastic") ? "extrusion_plastic" : m && m.cls !== "metal" ? "extrusion_plastic" : "extrusion_al"; }
/** What the brief asks to hold, when it says nothing : one board on rails. */
export const DEFAULT_CONTENTS = () => [{ name: "Carte", w: 100, h: 14, hold: "rail", edge: 1.6, below: 3 }];
const HOLD_FR = { rail: "glissée dans deux rainures", flat: "posée à plat", free: "libre, avec du jeu" };

/** Writes the profile. items = prepared interfaces (shop_intent.prepare). brief : { contents: [{ name, w, h, hold, edge, below }], length,
    open, ports (false : none), screw }. → the core of a spec (family extrusion). */
export function extruded(brief, items, log) {
  const proc = brief.process && EXTRUSION_RULES[brief.process] ? brief.process : extrusionProcess(brief.material), R = EXTRUSION_RULES[proc], mat = material(brief.material) || { name: brief.material }, open = !!brief.open;
  const L = half(Math.max(20, Number(brief.length) || 120)), screw = brief.screw || "M3", pd = R.port[screw] || R.port.M3, key = slug(brief.name || "profile");
  /* what goes inside : the list of the brief, then a tongue for every rail interface that names none */
  const rails = items.filter((it) => it.type === "rail"), contents = (brief.contents && brief.contents.length ? brief.contents : rails.length ? [] : DEFAULT_CONTENTS()).map((c) => ({ ...c }));
  const tongues = contents.filter((c) => c.hold === "rail");
  rails.forEach((it, i) => { const p = it.params || {}; if (tongues[i]) Object.assign(tongues[i], { w: Number(p.length) || tongues[i].w, edge: Number(p.t) || tongues[i].edge, iface: it });
    else { const c = { name: it.partner || it.name || `Carte ${i + 1}`, w: Number(p.length) || 60, h: 12, hold: "rail", edge: Number(p.t) || 1.6, below: 3, iface: it }; contents.push(c); tongues.push(c); } });
  if (!contents.length) throw new Error("Profilé : dites ce qu'il contient (au moins un élément à glisser, à poser ou à loger).");
  for (const c of contents) { c.w = Number(c.w); c.h = Number(c.h); if (!(c.w > 0) || !(c.h > 0)) throw new Error(`Profilé : « ${c.name || "élément"} » doit avoir une largeur et une hauteur.`); c.hold = HOLD_FR[c.hold] ? c.hold : "free"; }
  log.push(`Procédé : ${R.label} — ${mat.name}. La section se dessine autour de ${contents.length} élément(s) : ${contents.map((c) => `${c.name || "élément"} ${fr(c.w)} × ${fr(c.h)} mm, ${HOLD_FR[c.hold]}`).join(" ; ")}.`);
  /* the cavity : wide enough for the widest thing, the tongues touching the walls or carried further in by longer ribs */
  const side = R.side, free = 0.5, relief = 0.4, Wc = half(Math.max(...contents.map((c) => (c.hold === "rail" ? c.w + 2 * (side + relief) : c.w + 2 * free)), 10));     // relief : the groove is deeper than the edge by its bottom radius, a square edge never rides on it
  const size = (t) => { const b = brief.ports === false ? 0 : r1(pd + Math.max(t, 1.5)),      // a boss as thick as the wall around its screw channel
    tf = t, gap = 1; let z = b ? b + 0.5 : 0; const lay = [];      // z : height above the floor of the cavity
    contents.forEach((c, i) => {
      if (c.hold === "rail") { const edge = c.edge || 1.6, g = r2(edge + 2 * side), d = r1(Math.min(R.groove * g, Math.max(1.5, c.iface && Number(c.iface.params.depth) ? Number(c.iface.params.depth) : 1.5) + relief)), below = Math.max(Number(c.below) || 3, tf + 0.5), above = Math.max(c.h - edge - below, tf + 0.5), zc = r2(z + below + edge / 2);
        lay.push({ c, kind: "rail", zc, g, d, edge, lo: z, hi: zc + edge / 2 + above }); z = zc + edge / 2 + above + gap; }
      else if (c.hold === "flat") { const first = !lay.length, onBoss = !!(first && b && c.w >= Wc - 2 * b + 3), zs = first && !b ? 0 : onBoss ? b : r2(z + tf);     // on the floor, on the corner bosses, or on two ribs of its own
        lay.push({ c, kind: "flat", zs, ledge: !(first && !b) && !onBoss, onBoss, lo: zs, hi: zs + c.h }); z = zs + c.h + gap; }
      else { lay.push({ c, kind: "free", lo: z + free, hi: z + free + c.h }); z = z + c.h + 2 * free + gap; }
    });
    const Hc = half(z - gap + (open ? 0.5 : Math.max(1.5, b ? b + 0.5 : 0)));
    return { b, tf, lay, Hc, W: Wc + 2 * t, H: Hc + (open ? t : 2 * t) }; };
  let t = 2, S = size(t); for (let k = 0; k < 3; k++) { const want = R.wall(Math.hypot(S.W, S.H)); if (want === t) break; t = want; S = size(t); }
  const { b, tf, lay, Hc } = S, W = S.W, H = S.H, ccd = Math.hypot(W, H);
  log.push(`Paroi de ${fr(t)} mm, la même partout : cercle circonscrit de ${fr(ccd)} mm (règle : ${proc === "extrusion_al" ? "1,5 mm jusqu'à 100, 2 mm jusqu'à 150, 2,5 mm au-delà" : "1,5 mm jusqu'à 80, 2 mm jusqu'à 150, 2,5 mm au-delà"}). Nervures de la même épaisseur.`);
  log.push(`Cavité de ${fr(Wc)} × ${fr(Hc)} mm → section ${fr(W)} × ${fr(H)} mm${open ? ", ouverte sur le dessus (profilé en U)" : ", fermée (un creux : filière à mandrin)"} ; longueur coupée ${fr(L)} mm.`);
  const P = (value, min, max, label, group, step = 0.5) => ({ value, min: r1(min), max: r1(max), step, unit: "mm", label, group });
  const params = { L: P(L, 10, 6000, "Longueur coupée", "Enveloppe", 1), Wc: P(Wc, 8, 400, "Largeur de la cavité", "Enveloppe"), Hc: P(Hc, 5, 300, "Hauteur de la cavité", "Enveloppe"), t: P(t, proc === "extrusion_al" ? 1.2 : 1, 5, "Paroi", "Profil", 0.1) };
  const zAbs = (z) => `t + ${r2(z)}`, prof = { gen: "fitted", W: "Wc + 2*t", H: open ? "Hc + t" : "Hc + 2*t", t: "t", tf: "t", c: side, ...(open ? { open: true } : {}), rails: [], ledges: [], ...(b ? { ports: { d: pd, b } } : {}) };
  const inside = [], out = [], used = new Set();
  const ifo = (it, face, at, extra = {}) => { const o = { id: it.id, type: it.type, name: it.name, key: it.key, partner: it.partner, side: it.side, external: it.external, face, at, params: it.params, opts: it.opts, ...extra }; for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
  let n = items.length;
  for (const x of lay) {
    const c = x.c, name = c.name || "élément";
    if (x.kind === "rail") {
      prof.rails.push({ y: zAbs(x.zc), g: x.g, d: x.d, w: c.w, relief });
      const reach = r2(Math.max(x.d, (Wc - c.w) / 2 - side - relief + x.d));
      inside.push({ name: `${name} (bord)`, w: c.w, h: x.edge, at: ["Wc/2 + t", zAbs(x.zc)], clearance: 0.05 }, { name: `${name} (composants)`, w: r2(c.w - 2 * (x.d - relief + 1)), h: r2(x.hi - x.lo - 0.4), at: ["Wc/2 + t", zAbs((x.lo + x.hi) / 2)], clearance: 0.2 });
      const it = c.iface || { id: `IF${++n}`, type: "rail", name: `Glissière — ${name}`, key: `${key}_${slug(name)}_rail`, partner: name, side: "B", made: true };
      used.add(it); out.push(ifo(it, "+Y", ["Wc/2 + t", zAbs(x.zc)], { side: "B", params: { ...(it.params || {}), t: x.edge, depth: x.d, length: c.w }, opts: { ...(it.opts || {}), clearance: side, extruded: true } }));
      log.push(`« ${name} » : glissière à ${fr(x.zc)} mm du fond — rainure de ${fr(x.g)} mm (bord de ${fr(x.edge)} mm + ${fr(side)} mm de jeu par face), profonde de ${fr(x.d)} mm dont ${fr(relief)} mm de dégagement au fond (${fr(x.d / x.g)} fois sa largeur, limite ${R.groove}), faite de deux nervures${reach > x.d + 0.05 ? ` longues de ${fr(reach)} mm : l'élément est plus étroit que la cavité` : ""}.${it.made ? ` Interface « ${it.key} » créée : la pièce qui glisse la reprendra telle quelle.` : ""}`);
    } else if (x.kind === "flat") {
      if (x.ledge) { prof.ledges.push({ y: zAbs(x.zs), w: c.w }); log.push(`« ${name} » : posé à plat à ${fr(x.zs)} mm du fond, sur deux nervures de 3 mm sous ses bords.`); } else log.push(x.onBoss ? `« ${name} » : posé à plat sur les bossages des angles, à ${fr(x.zs)} mm du fond.` : `« ${name} » : posé à plat sur le fond.`);
      inside.push({ name, w: c.w, h: c.h, at: ["Wc/2 + t", zAbs(x.zs + c.h / 2 + 0.1)], clearance: 0.05 });
    } else { inside.push({ name, w: c.w, h: c.h, at: ["Wc/2 + t", zAbs((x.lo + x.hi) / 2)], clearance: 0.3 }); log.push(`« ${name} » : logé avec ${fr(free)} mm de jeu autour.`); }
  }
  /* what the profile meets outside : flats on its faces, and the end plates screwed into its corner bosses */
  for (const it of items) {
    if (used.has(it) || it.type === "rail") continue;
    const w = it.where || "-Z", onEnd = w[1] === "Y";
    if (it.type === "bolt_pattern" && onEnd && b) out.push(ifo(it, w, ["Wc/2 + t", open ? `(t + ${b})/2` : "Hc/2 + t"], { side: "B", params: { ...it.params, screw, pattern: { type: "rect", nx: 2, ny: open ? 1 : 2, dx: `Wc + t - ${b}`, dy: open ? 0 : `Hc + t - ${b}` } }, opts: { ...(it.opts || {}), depth: 10, port: true } }));
    else if (it.type === "planar") out.push(ifo(it, w, w[1] === "Z" ? ["Wc/2 + t", "L/2"] : onEnd ? ["Wc/2 + t", open ? "(Hc + t)/2" : "Hc/2 + t"] : ["L/2", open ? "(Hc + t)/2" : "Hc/2 + t"], w[1] === "Z" ? { params: { ...it.params, w: "Wc + 2*t", h: "L" } } : {}));
    else out.push(ifo(it, w, w[1] === "Z" ? ["Wc/2 + t", "L/2"] : onEnd ? ["Wc/2 + t", open ? "(Hc + t)/2" : "Hc/2 + t"] : ["L/2", open ? "(Hc + t)/2" : "Hc/2 + t"]));
  }
  if (b) {
    const ends = items.filter((it) => it.type === "bolt_pattern" && (it.where || "")[1] === "Y").length;
    if (!ends && brief.ports !== false) for (const [face, tag, label] of [["-Y", "av", "avant"], ["+Y", "ar", "arrière"]]) out.push({ id: `IF${++n}`, type: "bolt_pattern", name: `Fixation du flasque ${label}`, key: `${key}_flasque_${tag}`, partner: `Flasque ${label}`, side: "B", face, at: ["Wc/2 + t", open ? `(t + ${b})/2` : "Hc/2 + t"],
      params: { screw, pattern: { type: "rect", nx: 2, ny: open ? 1 : 2, dx: `Wc + t - ${b}`, dy: open ? 0 : `Hc + t - ${b}` } }, opts: { depth: 10, port: true } });
    log.push(`Flasques : ${open ? 2 : 4} bossages de ${fr(b)} mm dans les angles, chacun avec un canal de vis ouvert en « C » de Ø ${fr(pd)} mm sur toute la longueur, pour des vis ${screw} autoformeuses${ends ? "" : " — une interface par bout est créée pour les flasques"}. Le canal s'ouvre sur la cavité : aucun mandrin de plus dans la filière, et l'angle extérieur s'arrondit autour de lui pour garder la paroi.`);
  }
  const widest = Math.max(...lay.filter((x) => x.kind === "rail").map((x) => (Wc - x.c.w) / 2 - side - relief + x.d), 0);
  if (widest > 6 * tf) log.push(`Attention : des nervures de ${fr(widest)} mm pour ${fr(tf)} mm d'épaisseur sont élancées — rapprocher les largeurs des éléments, ou porter le plus étroit par une nervure venue du fond.`);
  if (proc === "extrusion_plastic" && !open) log.push("Un profilé plastique fermé demande un calibrage interne : ouvrez-le sur le dessus (profilé en U) si rien n'oblige à le fermer.");
  log.push("Rayons de 0,4 mm au moins sur tous les angles, section symétrique : un écoulement équilibré donne un profilé droit.");
  return { family: "extrusion", process: proc, params, features: [{ op: "interfaces" }], interfaces: out, notes: R.notes,
    extrusion: { axis: "Y", length: "L", profile: prof, inside } };
}
