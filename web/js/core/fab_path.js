/* DynamiteOrbit — the virtual fabrication shop : what it plays, and the tool that moves (JP, 21 novembre 2026 : « seules les pièces
   machinées et moulées, extrudées, stampées ou découpées au laser peuvent être animées ; le reste ce sont des procédés trop complexes
   (ex. PCBA, flex PCB) et tu ne devrais pas rendre une démo de la gamme qui est fausse… voir l'outil d'usinage bouger seulement pour les
   pièces usinées ou sur-usinées après moulage métallique… simuler un parcours d'usinage avec les allers-retours IA… et mentionner la
   possibilité, pour forcer les gens à le demander à Claude »).
   The tool does not WRITE a tool path : an AI does, through the round trip of the part (plan paths), and the tool reads it, checks it
   against the part and plays it — the tip of the tool along the moves, in the frame of the part. A path is not a machine program : its
   speeds and feeds are not used, no cutter compensation, no collision of the holder, no stock removal ; the screen says so. Pure. */

/** The processes the shop plays (JP's list) — and the word for each. */
export const PLAYED = { cnc_milling: "machined", cnc_turning: "machined", extrusion_al: "extruded", extrusion_plastic: "extruded", injection_molding: "moulded",
  die_casting: "cast", lp_die_casting: "cast", permanent_mold: "cast", sand_casting: "cast", sheet_metal: "stamped", laser_cut: "laser" };
const PRINTED = new Set(["fdm", "mjf", "sla", "lpbf"]);
/** Whether the shop plays a part, and why not. → { ok, kind } | { ok: false, short, why } */
export function fabPlayable(spec) {
  if (!spec) return { ok: false, short: "absente", why: "pièce absente" };
  if (spec.flex) return { ok: false, short: "circuit flexible", why: "un circuit flexible se fait chez son fabricant, en dizaines d'étapes (imagerie, gravure, laminage du coverlay, découpe) : l'atelier ne le joue pas" };
  if (spec.pcb || spec.process === "pcb") return { ok: false, short: "carte nue", why: "une carte nue se fait chez son fabricant de circuits imprimés, en dizaines d'étapes (imagerie, gravure, pressage, perçage, placage) : l'atelier ne la joue pas" };
  if (spec.study) return { ok: false, short: "modèle simplifié", why: "un modèle simplifié est une aide au calcul, pas une pièce à fabriquer" };
  if (spec.purchased || spec.process === "purchased" || spec.step) return { ok: false, short: "achetée ou de spécialiste", why: "pièce achetée, ou faite par un spécialiste (laminé, composant, pièce importée) : sa gamme est celle de son fabricant" };
  if (PRINTED.has(spec.process)) return { ok: false, short: "impression 3D", why: "impression 3D : la pièce monte couche par couche, avec ses supports et ses post-traitements — une image par étape la montrerait mal" };
  return PLAYED[spec.process] ? { ok: true, kind: PLAYED[spec.process] } : { ok: false, short: spec.process ? "procédé non montré" : "sans procédé", why: spec.process ? `procédé « ${spec.process} » : l'atelier ne sait pas le montrer juste` : "aucun procédé choisi" };
}
const MOVING = new Set(["cnc_milling", "cnc_turning", "extrusion_al", "extrusion_plastic", "die_casting", "lp_die_casting", "permanent_mold", "sand_casting"]);
/** The tool moves only where the part is machined : the set-ups of a machined or extruded part, the rework of a casting. */
export const toolMoves = (spec, phase) => !!spec && MOVING.has(spec.process) && fabPlayable(spec).ok && /^(setup:|rework$)/.test(String((phase && phase.key) || ""));

/** The tools a path names. axial : the tool's axis is the normal of the worked face (it comes in through that face). */
export const FAB_TOOLS = {
  center: { label: "Spot drill", fr: "foret à centrer", color: "#f59e0b", axial: true }, drill: { label: "Twist drill", fr: "foret hélicoïdal", color: "#d4a017", axial: true },
  tap: { label: "Tap", fr: "taraud", color: "#a16207", axial: true }, reamer: { label: "Reamer", fr: "alésoir", color: "#ca8a04", axial: true },
  endmill: { label: "End mill", fr: "fraise deux tailles", color: "#eab308", axial: true }, facemill: { label: "Face mill", fr: "fraise à surfacer", color: "#facc15", axial: true },
  chamfer: { label: "Chamfer mill", fr: "fraise à chanfreiner", color: "#fbbf24", axial: true }, boring: { label: "Boring bar", fr: "barre d'alésage", color: "#d97706", axial: true },
  turning: { label: "Turning tool", fr: "outil de tournage (plaquette)", color: "#b45309", axial: false } };
const KEEP = new Set([4, 17, 21, 40, 43, 49, 54, 90, 94, 98, 99]);      // G words that change nothing the screen draws
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A G-code of the subset the screen reads : G0, G1, G2 / G3 (in XY, with I and J), the drilling cycles G81 to G85 with R, G80 ; mm (G21),
    absolute (G90). → { moves: [[g, x, y, z]], errors } */
export function parseGcode(text) {
  const moves = [], errors = []; let g = 0, at = [0, 0, null], cyc = null, R = null, cz = null;
  String(text || "").split(/\r?\n/).forEach((raw, n) => {
    const line = raw.replace(/\([^)]*\)/g, " ").replace(/;.*$/, "").toUpperCase(), words = [...line.matchAll(/([A-Z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g)], v = {}, gs = [];
    for (const [, k, x] of words) if (k === "G") gs.push(Number(x)); else v[k] = Number(x);
    for (const c of gs) {
      if (c === 20) errors.push(`ligne ${n + 1} : G20 (pouces) — le parcours s'écrit en millimètres (G21)`); else if (c === 91) errors.push(`ligne ${n + 1} : G91 (incrémental) — le parcours s'écrit en absolu (G90)`);
      else if (c <= 3) { g = c; cyc = null; } else if (c >= 81 && c <= 85) cyc = c; else if (c === 80) cyc = null; else if (!KEEP.has(c)) errors.push(`ligne ${n + 1} : G${c} n'est pas lu (G0, G1, G2, G3, G81 à G85, G80)`);
    }
    if (v.R !== undefined && (cyc || gs.some((c) => c >= 81 && c <= 85))) R = v.R;
    if (!["X", "Y", "Z"].some((k) => v[k] !== undefined)) return;
    const x = v.X ?? at[0], y = v.Y ?? at[1];
    if (cyc) {      // a drilling cycle : rapid over the hole, rapid to R, feed to Z, back to R (a tap and a boring cycle come back at feed)
      if (v.Z !== undefined) cz = v.Z; const r = R ?? at[2];
      if (cz === null || r === null || at[2] === null) { errors.push(`ligne ${n + 1} : cycle de perçage sans Z, sans R ou sans position de départ`); return; }
      moves.push([0, x, y, at[2]], [0, x, y, r], [1, x, y, cz], [cyc === 84 || cyc === 85 ? 1 : 0, x, y, r]); at = [x, y, r]; return;
    }
    const z = v.Z ?? at[2];
    if (z === null) { errors.push(`ligne ${n + 1} : première position sans Z`); return; }
    if (g === 2 || g === 3) {
      if (v.I === undefined && v.J === undefined) { errors.push(`ligne ${n + 1} : arc sans I ni J (le rayon R n'est pas lu)`); return; }
      const cx = at[0] + (v.I || 0), cy = at[1] + (v.J || 0), rad = Math.hypot(at[0] - cx, at[1] - cy), a0 = Math.atan2(at[1] - cy, at[0] - cx);
      let da = Math.atan2(y - cy, x - cx) - a0; if (g === 2 && da >= -1e-9) da -= 2 * Math.PI; if (g === 3 && da <= 1e-9) da += 2 * Math.PI;
      const k = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 18)));
      for (let i = 1; i <= k; i++) moves.push([1, r3(cx + rad * Math.cos(a0 + (da * i) / k)), r3(cy + rad * Math.sin(a0 + (da * i) / k)), r3(at[2] + ((z - at[2]) * i) / k)]);
    } else moves.push([g ? 1 : 0, x, y, z]);
    at = [x, y, z];
  });
  return { moves, errors };
}

/** The passes of a phase, read : each { tool, d, moves, by, note, errors }. */
export function passesOf(spec, key) {
  const list = spec && spec.plan && spec.plan.paths && spec.plan.paths[key];
  return (Array.isArray(list) ? list : []).map((p) => {
    const errors = [], g = p && typeof p.gcode === "string" ? parseGcode(p.gcode) : null, raw = g ? g.moves : Array.isArray(p && p.moves) ? p.moves : [];
    if (g) errors.push(...g.errors);
    const moves = raw.filter((m) => Array.isArray(m) && m.length === 4 && [0, 1].includes(m[0]) && m.slice(1).every(Number.isFinite));
    if (moves.length < raw.length) errors.push(`${raw.length - moves.length} position(s) illisible(s) : chacune s'écrit [g, x, y, z], g = 0 (rapide) ou 1 (travail)`);
    return { tool: String((p && p.tool) || ""), d: Number(p && p.d), moves, by: (p && p.by) || "", note: (p && p.note) || "", errors };
  });
}
const AX = { "+X": [0, 1], "-X": [0, -1], "+Y": [1, 1], "-Y": [1, -1], "+Z": [2, 1], "-Z": [2, -1] };
/** The face a phase works (« free » : the top). */
export const faceOf = (key) => { const f = String(key || "").replace(/^setup:/, ""); return AX[f] ? f : "+Z"; };
/** What is wrong with the passes of a phase, against the part as it stands before the phase. o : { bbox, face, lathe } → [{ level, text }] */
export function pathIssues(passes, o) {
  const out = [], say = (level, text) => out.push({ level, text }), b = o.bbox, [ax, sg] = AX[o.face] || AX["+Z"];
  const top = sg > 0 ? b[ax + 3] : -b[ax], far = sg > 0 ? b[ax] : -b[ax + 3], h = (m) => sg * m[ax + 1];
  passes.forEach((ps, k) => {
    const T = FAB_TOOLS[ps.tool], name = `passe ${k + 1}${T ? ` (${T.label})` : ""}`;
    for (const e of ps.errors) say("error", `${name} : ${e}`);
    if (!T) say("error", `${name} : outil « ${ps.tool} » inconnu — ${Object.keys(FAB_TOOLS).join(", ")}`);
    if (!(ps.d > 0 && ps.d <= 100)) say("error", `${name} : diamètre d'outil absent, ou hors de 0 à 100 mm`);
    if (ps.moves.length < 2) { say("error", `${name} : moins de deux positions`); return; }
    if (ps.moves.length > 20000) say("error", `${name} : plus de 20 000 positions — l'écran n'anime pas un programme de série`);
    const slack = Math.max(30, 2 * (ps.d || 0)), past = Math.max(1.5, 0.4 * (ps.d || 0) + 1);
    let deep = 0, far2 = 0, fast = 0;
    ps.moves.forEach((m, i) => {
      if ([0, 1, 2].some((q) => m[q + 1] < b[q] - slack || m[q + 1] > b[q + 3] + slack)) far2++;
      if (T && T.axial && m[0] === 1 && h(m) < far - past) deep++;
      const prev = ps.moves[i - 1], inside = [0, 1, 2].every((q) => q === ax || (m[q + 1] > b[q] && m[q + 1] < b[q + 3]));
      if (!o.lathe && prev && m[0] === 0 && inside && h(m) < top - 0.05 && h(m) < h(prev) - 0.01) fast++;
    });
    if (deep) say("warn", `${name} : ${deep} position(s) de travail plus de ${String(r3(past)).replace(".", ",")} mm au-delà de la face opposée — l'outil entrerait dans l'étau ou les cales`);
    if (far2) say("warn", `${name} : ${far2} position(s) à plus de ${slack} mm de la pièce — le repère est-il bien celui de la pièce ?`);
    if (fast) say("warn", `${name} : ${fast} descente(s) en rapide (G0) sous la face travaillée, au-dessus de la pièce — un rapide ne doit pas entrer dans la matière`);
  });
  return out;
}

/** The time line of an animation : each segment with its start and end, the feed and the rapid at a speed made for the eye (mm/s). */
export function timeline(passes, speed = { feed: 45, rapid: 180, change: 0.7 }) {
  const segs = []; let t = 0;
  passes.forEach((ps, k) => { if (k) t += speed.change; for (let i = 1; i < ps.moves.length; i++) { const a = ps.moves[i - 1].slice(1), m = ps.moves[i], L = Math.hypot(m[1] - a[0], m[2] - a[1], m[3] - a[2]), dt = L / (m[0] ? speed.feed : speed.rapid);
    segs.push({ k, a, b: m.slice(1), g: m[0], t0: t, t1: t + dt, L }); t += dt; } });
  return { segs, T: t, length: segs.reduce((s, x) => s + (x.g ? x.L : 0), 0) };
}
/** Where the tip is at time t. → { k (the pass), p, g } */
export function tipAt(tl, t) {
  const s = tl.segs.find((x) => t <= x.t1) || tl.segs[tl.segs.length - 1];
  if (!s) return null; const u = s.t1 > s.t0 ? Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0))) : 1;
  return { k: s.k, g: s.g, p: [0, 1, 2].map((q) => s.a[q] + (s.b[q] - s.a[q]) * u) };
}

const f1 = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
/** What goes to the AI with the part : the request, the format, the frame, the holes of the face, the box of the part. holes : facts.holes of the part. */
export function pathAsk(spec, phase, holes, bbox, lathe) {
  const face = faceOf(phase.key), mine = (holes || []).filter((x) => !x.face || x.face === face || phase.key === "rework" || phase.key === "setup:free");
  const ask = `Écris le parcours d'outil de la phase ${phase.n} « ${phase.title} » de ${spec.id}, pour l'animer dans l'atelier de fab : les passes dans l'ordre de l'atelier (centrer, percer, tarauder, fraiser…), en G-code simple ou en positions [g, x, y, z].`;
  const help = [`PARCOURS D'OUTIL — dans « plan paths », sous la clé de la phase « ${phase.key} » : une liste de passes, chacune { tool, d, gcode | moves, by, note }.`,
    `tool : ${Object.entries(FAB_TOOLS).map(([k, t]) => `${k} (${t.fr})`).join(", ")} ; d : le diamètre de l'outil, en mm ; by : qui l'a écrit (ex. « Claude, IA ») ; note : ce que l'atelier doit savoir.`,
    "gcode : G0 (rapide), G1 (travail), G2 / G3 dans le plan XY avec I et J, cycles de perçage G81 à G85 avec R, G80 ; en mm (G21), en absolu (G90). Ou moves : [[g, x, y, z], …], g = 0 rapide, 1 travail.",
    `Repère : celui de la pièce (son .dwiz), en mm. Le point est le BOUT de l'outil. ${lathe ? "Tour : l'axe de la pièce est son Z ; un outil de tournage (turning) a son bout sur le rayon, du côté +Y de la pièce ; un foret ou une barre d'alésage vient par la face." : `L'outil vient par la face ${face} : son axe est la normale de cette face.`}`,
    `La pièce avant la phase tient dans la boîte X ${f1(bbox[0])} à ${f1(bbox[3])}, Y ${f1(bbox[1])} à ${f1(bbox[4])}, Z ${f1(bbox[2])} à ${f1(bbox[5])}. Ne pas travailler plus de 1,5 mm au-delà de la face opposée (l'outil entrerait dans l'étau) ; les rapides restent hors de la matière.`,
    `Ce que la phase fait : ${phase.ops.map((op) => `${op.n} ${op.text}`).join(" ; ") || "—"}.`,
    ...(mine.length ? [`Perçages de cette phase : ${mine.map((x) => `Ø${f1(x.d)} en (${x.at.map(f1).join(", ")}), ${x.through ? "débouchant" : `profondeur ${f1(x.depth)}`}${x.thread ? `, taraudé ${x.thread}` : ""}${x.axis ? `, axe (${x.axis.map(f1).join(", ")}) vers la matière` : ""}`).join(" ; ")}.`] : []),
    "Ce n'est pas un programme de machine : l'atelier écrit le sien. L'écran lit le parcours, le vérifie contre la pièce et l'anime ; ni vitesses, ni compensation, ni collision du porte-outil, ni enlèvement de matière."];
  return { ask, help };
}
