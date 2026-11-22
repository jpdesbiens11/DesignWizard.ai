/* DynamiteOrbit — a moulded part, thought through its MOLD. Plastic or metal, the part is what the mold lets out : where
   the material comes in (the gate), where the mold opens (the parting line) and which way (the pull), whether two halves
   are enough or side actions are needed (slides, lifters — cores in a sand mold), where the risers stand on a casting poured
   by gravity or filled from below, and what all of that LEAVES on the part once the gate and the risers are cut off and
   buffed : the witness marks. Pure : it reads the part (its `mold` block, its interfaces, its features) and, when it is
   built, its box and the bosses the kernel recorded.
   The figures are rules of thumb of published guides ; `basis` says how each was checked. The moldmaker and the foundry
   have the last word. */

import { FACES } from "../cad/vec.js";

const r1 = (x) => Math.round(x * 10) / 10, fr = (x) => String(r1(x)).replace(".", ",");
export const MOLD_COLORS = { parting: "#e5484d", pull: "#172b4d", slide: "#f59e0b", gate: "#2563eb", riser: "#8b5cf6", overflow: "#0ea5a4", witness: "#e5484d" };

/** How the mold of each process is made and filled. gates : the kinds of gate it accepts, the usual one first ; risers : whether
    a feeder stands on the casting ; side : what forms a feature across the pull (a slide in a metal mold, a core in sand). */
export const MOLDS = {
  injection_molding: { label: "Injection molding", short: "Injection", family: "plastic", fill: "pressure", gates: ["pin", "edge", "sub", "sprue", "valve"], risers: false, overflows: false, side: "slide", ejectors: true,
    tool: "Steel mold : cavity (fixed half) and core (moving half, with the ejector pins)", how: "La matière fondue est injectée sous haute pression par le gate, remplit la cavité, se fige ; le mold s'ouvre au parting line et les ejector pins poussent la pièce hors du core." },
  die_casting: { label: "High pressure die casting", short: "HPDC", family: "metal", fill: "pressure", gates: ["ingate"], risers: false, overflows: true, side: "slide", ejectors: true,
    tool: "Steel die : cover die (fixed) and ejector die (moving)", how: "Le métal est poussé par un piston à haute pression et grande vitesse à travers le runner et l'ingate ; l'air et le premier métal, froid, finissent dans les overflows et les vents, de l'autre côté de la pièce. Pas de riser : c'est la pression du piston qui compense le retrait." },
  lp_die_casting: { label: "Low pressure die casting", short: "LPDC", family: "metal", fill: "bottom", gates: ["stalk"], risers: true, overflows: false, side: "slide", ejectors: true,
    tool: "Permanent steel die, closed above the holding furnace", how: "Le moule métallique est posé sur le four. Une faible pression de gaz sur le bain fait monter le métal dans le riser tube (stalk) : la cavité se remplit par le bas, sans turbulence, de bas en haut jusqu'aux risers. La pression est tenue pendant que la pièce fige du haut vers le gate, puis relâchée : le métal resté liquide dans le tube redescend au four." },
  permanent_mold: { label: "Permanent mold casting", short: "Permanent mold", family: "metal", fill: "gravity", gates: ["gravity"], risers: true, overflows: false, side: "slide", ejectors: true,
    tool: "Permanent metal mold (cast iron or steel), poured by gravity", how: "Le métal est versé par gravité dans un moule métallique réutilisable : sprue, runner, puis ingate au parting line. Des risers, au-dessus des masses, nourrissent le retrait pendant que la pièce fige." },
  sand_casting: { label: "Sand casting", short: "Sand", family: "metal", fill: "gravity", gates: ["gravity"], risers: true, overflows: false, side: "core", ejectors: false,
    tool: "Sand mold : cope (top) and drag (bottom) rammed around a pattern, sand cores for the hollows", how: "Le métal est versé par gravité dans un moule en sable fait autour d'un pattern, puis détruit au décochage. Les creux et les contre-dépouilles sont faits par des cores en sable, pas par des slides. Des risers, au-dessus des masses, nourrissent le retrait." },
};
export const isMolded = (spec) => !!(spec && (MOLDS[spec.process] || (spec.mold && MOLDS[spec.mold.process])));
export const moldProcessOf = (spec) => (spec && MOLDS[spec.process] ? spec.process : spec && spec.mold && MOLDS[spec.mold.process] ? spec.mold.process : null);

/** The kinds of gate. on : where it meets the part — a face, the parting line, a side wall. mark : what stays on the part ;
    after : what is done to it. vestige : [min, max] height of what is left, mm — an order of magnitude only (see BASIS.vestige). */
export const GATES = {
  pin: { label: "Pin gate / hot tip", on: "face", icon: "pin", mark: "un petit téton rond au point d'injection", after: "laissé brut, ou arasé à la lame", vestige: [0.2, 0.5], note: "Au centre d'une face : remplissage équilibré, pas de reprise. Demande un mold à trois plaques ou un hot runner." },
  edge: { label: "Edge gate", on: "parting", icon: "edge", mark: "une marque rectangulaire sur le bord, au parting line", after: "coupé à la pince ou au gabarit, puis ébavuré", vestige: [0.3, 1], note: "Le plus simple et le moins cher : sur un bord, dans le plan du parting line. La marque se voit sur le chant." },
  sub: { label: "Submarine (tunnel) gate", on: "wall", icon: "sub", mark: "un petit point rond sur la paroi, sous le parting line", after: "cisaillé par l'éjection : rien à reprendre", vestige: [0.3, 0.8], note: "Se sépare seul à l'éjection. Pour une pièce petite ou moyenne ; pas pour une matière fragile ou très chargée." },
  sprue: { label: "Direct sprue gate", on: "face", icon: "sprue", mark: "le pied du sprue, de plusieurs millimètres de diamètre", after: "coupé, puis usiné ou poncé (buffed) à fleur", vestige: [0.5, 2], note: "Une cavité, peu de perte de pression : pour une pièce épaisse ou profonde. La trace est la plus grosse de toutes." },
  valve: { label: "Valve gate", on: "face", icon: "valve", mark: "un anneau fin, la trace de l'aiguille", after: "laissé brut", vestige: [0.1, 0.3], note: "Hot runner à obturateur : la trace la plus discrète, sur une face visible. Le mold coûte plus cher." },
  ingate: { label: "Ingate, runner and overflows", on: "parting", icon: "ingate", mark: "une bande le long du parting line, et la trace des overflows sur le côté opposé", after: "détourés à la presse (trim die) ; l'arête détourée est ébavurée", vestige: [0.3, 1], note: "Le métal entre en lame mince par un côté ; les overflows et les vents reçoivent l'air et le métal froid de l'autre côté." },
  stalk: { label: "Bottom gate (riser tube)", on: "bottom", icon: "stalk", mark: "le pied du gate, au point le plus bas de la pièce dans le moule", after: "scié, puis meulé et poncé (buffed) à fleur", vestige: [0.5, 2], note: "Le métal monte du four par le riser tube. Le gate reste liquide le dernier : c'est lui qui nourrit la pièce pendant qu'elle fige." },
  gravity: { label: "Sprue, runner and ingate", on: "parting", icon: "gravity", mark: "le pied de l'ingate, au parting line", after: "scié, puis meulé à fleur", vestige: [0.5, 2], note: "Le métal descend par le sprue, court dans le runner et entre par le bas de la cavité pour la remplir sans turbulence." },
};
/** What a mold leaves on a part, by nature. */
export const WITNESS = {
  gate: { label: "Gate vestige", color: MOLD_COLORS.gate }, parting: { label: "Parting line", color: MOLD_COLORS.parting }, ejector: { label: "Ejector pin marks", color: "#64748b" }, slide: { label: "Slide witness lines", color: MOLD_COLORS.slide },
  core: { label: "Core prints and fins", color: MOLD_COLORS.slide }, riser: { label: "Riser pads", color: MOLD_COLORS.riser }, overflow: { label: "Overflow and vent pads", color: MOLD_COLORS.overflow },
};
/** How each figure was checked — said as it is. */
export const BASIS = {
  riser: "Règle des modules (Chvorinov, méthode de Wlodawer) : le module du riser vaut au moins 1,2 fois celui de la masse qu'il nourrit, celui de son col 1,1 fois. Lue en extrait dans des notes de cours de fonderie ; les manuels (AFS, Campbell) n'ont pas été relus. Le module d'une masse est estimé ici par sa forme simple (plaque : épaisseur / 2 ; fût : diamètre / 4), pas mesuré sur la pièce.",
  lpdc: "Basse pression : environ 0,3 à 1 bar sur le bain, paroi d'environ 3 mm au minimum, alliages A356 et A319 — ordres de grandeur vus en extrait dans des guides de fournisseurs et d'associations de fonderie, qui ne s'accordent pas tous.",
  vestige: "Hauteur de la trace d'un gate : ordre de grandeur tiré d'un seul guide de fournisseur, vu en extrait. À fixer avec le mouliste, et à écrire au dessin.",
  count: "Le nombre de risers n'est pas calculé à partir d'une distance d'alimentation : il y en a un par masse isolée en haut du moule. La fonderie décide du nombre et de la place définitifs, souvent par simulation.",
};

const cyl = (d) => d / 4, plate = (t) => t / 2;                  // the cooling modulus (volume / cooling surface) of a long boss, of a wall
/** A riser for a mass of modulus M : a cylinder as high as it is wide (modulus D / 6), on a neck. → { d, h, neck } in mm, rounded up to the millimetre */
export function riserFor(M) { return { d: Math.ceil(7.2 * M), h: Math.ceil(7.2 * M), neck: Math.ceil(4.4 * M), M: r1(M) }; }

const OPP = { "+X": "-X", "-X": "+X", "+Y": "-Y", "-Y": "+Y", "+Z": "-Z", "-Z": "+Z" }, SIDE_OPS = new Set(["pocket", "hole", "slot", "cut", "window"]), SIDE_IFACES = new Set(["cutout", "bolt_pattern", "pins", "fit"]);
const boxOf = (spec, built) => { const m = (spec && spec.mold) || {}; if (built && Array.isArray(built.bbox) && built.bbox.length === 6) return built.bbox.slice(); return m.L > 0 && m.W > 0 && m.H > 0 ? [0, 0, 0, m.L, m.W, m.H] : null; };
const centre = (bb, face) => { const F = FACES[face], c = [0, 1, 2].map((k) => (bb[k] + bb[k + 3]) / 2); c[F.axis] = F.n[F.axis] > 0 ? bb[F.axis + 3] : bb[F.axis]; return c.map(r1); };

/** The mold of a part. spec : the part ; built : the part once built (optional — the box, the bosses, the placed interfaces).
    → null when the part is not moulded, or
    { process, mold (MOLDS entry), pull, parting { level, axis, loop, text }, simple, slides [{ dir, kind, n, what }], lifters,
      gate { kind, auto, face, at, …GATES entry }, overflow { face, at } | null, risers [{ id, at, d, h, neck, why, on }],
      witness [{ kind, label, color, where, text }], cosmetic [faces], notes [text for the drawing], log [what was decided, and why], marks (for the 3D view) } */
export function moldPlan(spec, built) {
  const proc = moldProcessOf(spec); if (!proc) return null;
  const K = MOLDS[proc], m = spec.mold || {}, bb = boxOf(spec, built), pull = FACES[m.pull] ? m.pull : "+Z", ax = FACES[pull].axis, wall = m.wall > 0 ? m.wall : 2.5, log = [], cosmetic = (Array.isArray(m.cosmetic) ? m.cosmetic : []).filter((f) => FACES[f]);
  const metal = K.family === "metal", skim = m.machined > 0 ? m.machined : 0, arch = m.arch || "shell";
  /* the parting line : at the open rim of a shell, around the flat face of a cover or of a plate — the widest section, where the two halves meet */
  const top = bb ? bb[ax + 3] : 0, level = typeof m.parting_level === "number" ? m.parting_level : top, pf = `${bb && level <= bb[ax] + 1e-6 ? "-" : "+"}${"XYZ"[ax]}`;      // a parting line at the bottom face (a flat cover die) is on that face
  const loop = bb ? (() => { const [a, b] = [0, 1, 2].filter((k) => k !== ax), P = (u, v) => { const p = [0, 0, 0]; p[a] = u; p[b] = v; p[ax] = level; return p.map(r1); }; return [P(bb[a], bb[b]), P(bb[a + 3], bb[b]), P(bb[a + 3], bb[b + 3]), P(bb[a], bb[b + 3]), P(bb[a], bb[b])]; })() : [];
  const parting = { level: r1(level), axis: ax, face: pf, loop, text: arch === "shell" ? "au bord supérieur de la coque, tout autour" : "autour de la face plane, sur son arête" };
  log.push(`Pull ${pull} : le mold s'ouvre dans ce sens. Parting line ${parting.text}${bb ? ` (niveau ${fr(level)} mm)` : ""} — ${K.tool}.`);
  /* what lies across the pull : each face that carries an opening, a hole or a fixing needs a slide (a core in a sand mold) */
  const sides = new Map(), note = (face, what) => { if (!FACES[face] || FACES[face].axis === ax) return; if (!sides.has(face)) sides.set(face, []); if (what && !sides.get(face).includes(what)) sides.get(face).push(what); };
  for (const f of spec.features || []) if (f && !f.suppressed && SIDE_OPS.has(f.op) && typeof f.face === "string") note(f.face, f.name || f.id || f.op);
  for (const i of spec.interfaces || []) if (i && SIDE_IFACES.has(i.type) && typeof i.face === "string") note(i.face, i.name || i.id);
  const lifters = m.lifters > 0 ? Math.round(m.lifters) : 0, kind = K.side;
  const slides = [...sides.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dir, what]) => ({ dir, kind, n: what.length, what }));
  const simple = !slides.length && !lifters;
  if (simple) log.push("Mold simple : deux moitiés qui s'ouvrent et se ferment (open / close), sans slide ni lifter. C'est le moins cher et le plus durable.");
  else {
    if (slides.length) log.push(kind === "core" ? `${slides.length} face(s) latérale(s) portent une ouverture ou un trou (${slides.map((s) => s.dir).join(", ")}) : en sand casting, un core en sable par forme — ou une reprise d'usinage, souvent moins chère pour un simple trou.`
      : `${slides.length} slide(s) dans le mold (${slides.map((s) => s.dir).join(", ")}) : une face latérale qui porte une ouverture, un trou ou une fixation ne se démoule pas dans le pull. Chaque slide ajoute du prix, de l'entretien et une ligne de témoin autour de ce qu'il forme. L'ouvrir jusqu'au parting line, ou la reporter sur le couvercle, le supprime.`);
    if (lifters) log.push(`${lifters} lifter(s) : chaque crochet est une contre-dépouille côté core, démoulée par un éjecteur incliné.`);
  }
  /* the gate : the one the designer chose, or the usual one of the process — an example until it is confirmed */
  const want = m.gating && typeof m.gating === "object" ? m.gating : {}, gk = K.gates.includes(want.kind) ? want.kind : K.gates[0], G = GATES[gk], auto = !K.gates.includes(want.kind);
  const low = OPP[pf], long = bb ? ((bb[(ax + 1) % 3 + 3] - bb[(ax + 1) % 3]) >= (bb[(ax + 2) % 3 + 3] - bb[(ax + 2) % 3]) ? (ax + 1) % 3 : (ax + 2) % 3) : (ax + 1) % 3;      // the long axis : a gate at the parting line stands on a short side, the material runs along the length
  let gface = FACES[want.side] ? want.side : null, at = null;
  if (G.on === "face" || G.on === "bottom") { gface = gface || low; if (bb) { at = centre(bb, gface); if (arch !== "shell" && gface === low && bb[ax + 3] - bb[ax] > 2 * wall) at[ax] = r1(level - wall); } }       // under a ribbed plate, the gate is on the rib side of the plate itself
  else { gface = gface && FACES[gface].axis !== ax ? gface : `-${"XYZ"[long]}`; if (bb) { at = centre(bb, gface); at[ax] = r1(G.on === "wall" ? level - Math.min(3, (bb[ax + 3] - bb[ax]) / 4) : level); } }
  const gate = { kind: gk, auto, face: gface, at, ...G };
  log.push(`Gate : ${G.label}${auto ? " (proposé — à confirmer)" : ""}, ${G.on === "face" ? `au centre de la face ${gface}` : G.on === "bottom" ? `au point bas du moule, face ${gface}` : G.on === "wall" ? `dans la paroi ${gface}, sous le parting line` : `au parting line, côté ${gface}`}. Il laisse ${G.mark} ; ${G.after}.`);
  const overflow = K.overflows && bb ? { face: OPP[gface], at: (() => { const p = centre(bb, OPP[gface]); p[ax] = r1(level); return p; })() } : null;
  if (overflow) log.push(`Overflows et vents côté ${overflow.face}, à l'opposé de l'ingate : ils sont détourés avec lui et laissent leur trace sur le parting line.`);
  /* the risers : one over each isolated mass that reaches the top of the mold — a boss, a land — sized by its modulus */
  const risers = [];
  if (K.risers) {
    const manual = Array.isArray(m.risers) ? m.risers.filter((r) => r && Array.isArray(r.at)) : null, H = bb ? bb[ax + 3] - bb[ax] : 0;
    const masses = manual ? [] : ((built && built.facts && built.facts.bosses) || []).filter((b) => b && !b.arch && Array.isArray(b.at) && FACES[b.face] && FACES[b.face].axis === ax && b.d > 0 && bb && Math.max(b.at[ax], b.at[ax] + FACES[b.face].n[ax] * b.h) >= top - Math.max(wall, 0.05 * H) - 1e-6);
    const groups = [];                                                // bosses that would share the footprint of one riser are fed by one riser
    for (const b of masses) { const R = riserFor(Math.max(cyl(b.d), plate(wall))), g = groups.find((q) => Math.hypot(q.at[(ax + 1) % 3] - b.at[(ax + 1) % 3], q.at[(ax + 2) % 3] - b.at[(ax + 2) % 3]) < (q.R.d + R.d) / 2);
      if (g) { g.n++; if (R.d > g.R.d) g.R = R; } else groups.push({ at: b.at.slice(), R, n: 1, src: b.source || "bossage" }); }
    for (const [k, g] of groups.entries()) { const p = g.at.slice(); p[ax] = top; risers.push({ id: `R${k + 1}`, at: p.map(r1), ...g.R, on: pf, why: `au-dessus de ${g.n > 1 ? `${g.n} bossages voisins` : "un bossage"} (« ${g.src} ») : module ${fr(g.R.M)} mm` }); }
    if (manual) manual.forEach((r, k) => { const R = riserFor(r.d > 0 ? r.d / 7.2 : plate(wall)), p = [0, 0, 0]; p[(ax + 1) % 3] = r.at[0]; p[(ax + 2) % 3] = r.at[1]; p[ax] = top; risers.push({ id: `R${k + 1}`, at: p.map(r1), ...R, on: pf, why: "placé par le concepteur" }); });
    if (!risers.length && bb && !manual) { const R = riserFor(plate(wall)), a = long, b = [0, 1, 2].find((k) => k !== ax && k !== a);                 // no mass at the top : the wall itself, fed at the middle of its two long sides
      for (const [k, v] of [bb[b], bb[b + 3]].entries()) { const p = [0, 0, 0]; p[a] = (bb[a] + bb[a + 3]) / 2; p[b] = v + (k ? -1 : 1) * wall / 2; p[ax] = top; risers.push({ id: `R${k + 1}`, at: p.map(r1), ...R, on: pf, why: `aucune masse en haut du moule : sur le bord, au milieu d'un grand côté (paroi de ${fr(wall)} mm, module ${fr(R.M)} mm)` }); } }
    if (risers.length) log.push(`${risers.length} riser(s) en haut du moule, Ø ${[...new Set(risers.map((r) => r.d))].map(fr).join(" et Ø ")} mm, aussi hauts que larges (règle des modules : riser ≥ 1,2 × la masse nourrie). ${proc === "lp_die_casting" ? "En low pressure, c'est d'abord le gate du bas, tenu sous pression, qui nourrit la pièce : un riser en haut ne sert qu'une masse isolée, loin du gate, et reçoit le premier métal." : "Ils figent en dernier et gardent la retassure hors de la pièce."}`);
  }
  /* what stays on the part, once everything is cut off and buffed */
  const witness = [], W = (k, where, text) => witness.push({ kind: k, ...WITNESS[k], where, text });
  W("gate", gate.face, `${G.label} : ${G.mark} — ${G.after}. Trace d'environ ${fr(G.vestige[0])} à ${fr(G.vestige[1])} mm (ordre de grandeur).`);
  W("parting", pf, `Une ligne fine tout autour, ${parting.text} : léger décalage des deux moitiés et bavure (flash) à ébavurer${metal ? "" : " si le mold s'use"}.`);
  if (K.ejectors) W("ejector", pull, `Des pastilles rondes côté ${metal ? "ejector die" : "core"} — sur les bossages, les nervures et le fond intérieur : en creux ou en relief de quelques dixièmes. Jamais sur une face d'aspect.`);
  if (slides.length) W(kind === "core" ? "core" : "slide", slides.map((s) => s.dir).join(", "), kind === "core" ? "Autour de chaque core : une fine bavure au joint du core, à ébarber ; la portée du core laisse un trou ou un bouchon à prévoir." : "Autour de chaque forme faite par un slide : une ligne de témoin rectangulaire, sur la face latérale.");
  if (overflow) W("overflow", overflow.face, "Les overflows et les vents, détourés avec l'ingate : une suite de petites traces sur le parting line, côté opposé au gate.");
  for (const r of risers) { const onSeat = (spec.interfaces || []).some((i) => i && i.type === "planar" && i.face === r.on);
    W("riser", r.id, `${r.id} — riser Ø ${fr(r.d)} sur un col Ø ${fr(r.neck)} : scié, puis meulé et poncé (buffed). Il reste une pastille Ø ${fr(r.neck)} mm${skim > 0 && onSeat ? `, sur une face reprise en usinage (${fr(skim)} mm de surépaisseur) : la trace disparaît` : ", brute de meulage : légèrement en relief ou en creux, d'un aspect différent du reste de la peau"}.`); }
  /* the notes of the drawing, in the words of the trade */
  const notes = [`Mold : ${K.label} — pull ${pull}, parting line ${parting.text}${simple ? ", open / close (aucun slide)" : `${slides.length ? `, ${slides.length} ${kind === "core" ? "core(s) en sable" : "slide(s)"} (${slides.map((s) => s.dir).join(" ")})` : ""}${lifters ? `, ${lifters} lifter(s)` : ""}`}`,
    `Gate : ${G.label}, ${G.on === "parting" ? `au parting line, côté ${gate.face}` : G.on === "wall" ? `dans la paroi ${gate.face}, sous le parting line` : `face ${gate.face}`}. Gate vestige ≤ ${fr(G.vestige[1])} mm, ${G.after}`,
    ...(risers.length ? [`Risers : ${risers.length} sur la face ${pf}, sciés puis poncés (buffed) à fleur${skim > 0 ? ` ; les faces usinées gardent ${fr(skim)} mm de surépaisseur` : ""}`] : []),
    ...(K.ejectors ? [`Ejector pin marks côté ${metal ? "ejector die" : "core"} seulement${cosmetic.length ? ` ; aucune trace de gate, d'ejector pin ni de riser sur la face ${cosmetic.join(", ")}` : ""}`] : cosmetic.length ? [`Aucune trace de gate ni de riser sur la face ${cosmetic.join(", ")}`] : [])];
  return { process: proc, mold: K, arch, pull, parting, simple, slides, lifters, gate, overflow, risers, witness, cosmetic, notes, log, box: bb, wall, machined: skim };
}

/** What the guide says of a mold. → [{ level : "error" | "todo" | "check" | "tip", text, field }] */
export function moldGuide(plan) {
  if (!plan) return [];
  const out = [], say = (level, text, field) => out.push({ level, text, field }), cos = new Set(plan.cosmetic);
  if (plan.gate.auto) say("todo", `Gate proposé : ${plan.gate.label}, face ${plan.gate.face}. C'est un exemple — confirmez-le ou choisissez-en un autre : c'est lui qui décide où reste la trace.`, "gate");
  if (cos.has(plan.gate.face)) say("error", `Le gate laisse sa trace sur la face ${plan.gate.face}, déclarée face d'aspect : changez de type de gate ou de côté.`, "gate");
  if (plan.mold.ejectors && cos.has(plan.pull)) say("check", `La face ${plan.pull}, déclarée face d'aspect, est du côté des ejector pins : inversez le pull, ou acceptez leurs traces.`, "cosmetic");
  for (const r of plan.risers) if (cos.has(r.on)) { say("check", `${plan.risers.length} riser(s) sur la face ${r.on}, déclarée face d'aspect : après sciage et buffing il reste une pastille visible. Déplacez les masses, ou reprenez la face en usinage.`, "risers"); break; }
  if (plan.slides.length) say(plan.slides.length >= 3 ? "check" : "tip", plan.mold.side === "core" ? `${plan.slides.length} face(s) latérale(s) à noyauter (${plan.slides.map((s) => s.dir).join(", ")}) : un core par forme, ou une reprise d'usinage.` : `${plan.slides.length} slide(s) dans le mold (${plan.slides.map((s) => s.dir).join(", ")}) : chacun coûte et s'use. Ouvrir la forme jusqu'au parting line le supprime.`, "slides");
  if (plan.lifters) say("tip", `${plan.lifters} lifter(s) pour les crochets : c'est le prix d'une fermeture sans vis.`, "slides");
  if (plan.risers.length && !(plan.machined > 0)) say("check", "Risers sur une pièce sans surépaisseur d'usinage : leurs pastilles restent sur la peau brute.", "risers");
  if (!plan.box) say("tip", "La pièce n'est pas encore construite : le gate et les risers se placeront sur sa géométrie.", "");
  return out;
}

/** The marks of a mold for a 3D view, in the frame of the part. size : the size of the part (for the lengths of the arrows).
    → [{ t : "loop", pts } | { t : "arrow", at, dir, len } | { t : "cyl", a, b, r } | { t : "label", at, text }, … each with a color and a kind] */
export function moldMarks(plan, size = 100) {
  if (!plan || !plan.box) return [];
  const out = [], bb = plan.box, ax = plan.parting.axis, n = FACES[plan.pull].n, c = [0, 1, 2].map((k) => (bb[k] + bb[k + 3]) / 2), L = Math.max(8, size * 0.16), add = (p, d, k) => p.map((x, i) => r1(x + d[i] * k));
  out.push({ t: "loop", kind: "parting", pts: plan.parting.loop, color: MOLD_COLORS.parting }, { t: "label", kind: "parting", at: plan.parting.loop[0], text: "Parting line", color: MOLD_COLORS.parting });
  const tip = c.slice(); tip[ax] = n[ax] > 0 ? bb[ax + 3] : bb[ax]; const far = add(tip, n, L * 1.3);
  out.push({ t: "arrow", kind: "pull", at: far, dir: n, len: L, color: MOLD_COLORS.pull }, { t: "label", kind: "pull", at: add(far, n, L), text: `Pull ${plan.pull}`, color: MOLD_COLORS.pull });
  for (const s of plan.slides) { const F = FACES[s.dir], p = c.slice(); p[F.axis] = F.n[F.axis] > 0 ? bb[F.axis + 3] : bb[F.axis]; const q = add(p, F.n, L * 0.5);
    out.push({ t: "arrow", kind: "slide", at: q, dir: F.n, len: L * 0.8, color: MOLD_COLORS.slide }, { t: "label", kind: "slide", at: add(q, F.n, L * 0.9), text: `${plan.mold.side === "core" ? "Core" : "Slide"} ${s.dir}`, color: MOLD_COLORS.slide }); }
  const g = plan.gate; if (g.at) { const F = FACES[g.face], rad = Math.max(1.2, Math.min(6, size * 0.02)) * (g.kind === "sprue" || g.kind === "stalk" || g.kind === "gravity" ? 1.8 : 1), base = add(g.at, F.n, 0.05), end = add(g.at, F.n, L * 0.55);
    out.push({ t: "cyl", kind: "gate", a: base, b: end, r: r1(rad), color: MOLD_COLORS.gate }, { t: "label", kind: "gate", at: end, text: `Gate — ${g.label}`, color: MOLD_COLORS.gate }); }
  if (plan.overflow) { const F = FACES[plan.overflow.face], p = plan.overflow.at; out.push({ t: "cyl", kind: "overflow", a: add(p, F.n, 0.05), b: add(p, F.n, L * 0.3), r: r1(Math.max(2, size * 0.03)), color: MOLD_COLORS.overflow }, { t: "label", kind: "overflow", at: add(p, F.n, L * 0.3), text: "Overflows, vents", color: MOLD_COLORS.overflow }); }
  for (const r of plan.risers) { const F = FACES[r.on]; out.push({ t: "cyl", kind: "neck", a: add(r.at, F.n, 0), b: add(r.at, F.n, r.neck * 0.3), r: r1(r.neck / 2), color: MOLD_COLORS.riser }, { t: "cyl", kind: "riser", a: add(r.at, F.n, r.neck * 0.3), b: add(r.at, F.n, r.neck * 0.3 + r.h), r: r1(r.d / 2), color: MOLD_COLORS.riser, opacity: 0.55 },
    { t: "label", kind: "riser", at: add(r.at, F.n, r.neck * 0.3 + r.h), text: `${r.id} — riser Ø${fr(r.d)}`, color: MOLD_COLORS.riser }); }
  return out;
}

/** The mold of a part as a short text for an AI or a moldmaker : the process, the mold, the gate, the risers, the witness marks. */
export function moldBrief(spec, plan) {
  if (!plan) return "";
  return [`${spec.id || ""} — ${spec.name || ""} : ${plan.mold.label}`.trim(), plan.mold.how, "", "MOLD", ...plan.log.map((l) => `- ${l}`), "", "WITNESS MARKS (ce qui reste sur la pièce)", ...plan.witness.map((w) => `- ${w.label} (${w.where}) : ${w.text}`), "", "NOTES DU DESSIN", ...plan.notes.map((x) => `- ${x}`), "",
    "Consigne : revoir ce plan de moule comme le ferait un mouliste ou un fondeur — le gate, le parting line, les slides, les risers et leurs traces. Répondre en rendant la pièce (.dwiz) avec son bloc « mold » corrigé : gating { kind, side }, cosmetic [faces], risers [{ at [u, v], d }], pull. Ne rien changer d'autre."].join("\n");
}
