/* DynamiteOrbit — the virtual fabrication shop, its scenes (point 13 of the roadmap, JP : « un genre d'atelier de fab virtuel… une gamme de
   fab visuelle… montages conventionnels (table, étau…), porte-outils manuels ou CNC simple, presse d'estampage »). For each phase of the
   routing of a part (cad/process_plan.js) : where the part stands — turned so that the face being worked looks at the tool — and the fixture
   and machine around it, built by the tool from boxes and cylinders : a vise on a machine table under a spindle, a chuck and a tool post, a
   press brake, a laser bed, the two halves of a mould, a build plate, a bench, a surface plate and its height gauge, a carton. No machine or
   fixture of a maker is drawn, no brand : what is shown is the PRINCIPLE of the set-up, said as such on the screen. Pure (browser and Node). */

import { boxMesh, cylMesh } from "../analysis/physics/scene3d.js";

const MOLD = new Set(["injection_molding", "die_casting", "lp_die_casting", "permanent_mold", "sand_casting"]), PRINT = new Set(["fdm", "mjf", "sla", "lpbf"]), SHEET = new Set(["laser_cut", "sheet_metal"]);
/** Rotations (rows) that bring the normal of a face to +Z (the tool comes from above), and to +X (a lathe : the tool works the free end). */
const UP = { "+Z": [[1, 0, 0], [0, 1, 0], [0, 0, 1]], "-Z": [[1, 0, 0], [0, -1, 0], [0, 0, -1]], "+X": [[0, 0, -1], [0, 1, 0], [1, 0, 0]], "-X": [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], "+Y": [[1, 0, 0], [0, 0, -1], [0, 1, 0]], "-Y": [[1, 0, 0], [0, 0, 1], [0, -1, 0]] };
const SIDE = { "+X": [[1, 0, 0], [0, 1, 0], [0, 0, 1]], "-X": [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], "+Y": [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], "-Y": [[0, -1, 0], [1, 0, 0], [0, 0, 1]], "+Z": [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], "-Z": [[0, 0, -1], [0, 1, 0], [1, 0, 0]] };
const mul = (R, p) => R.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
/* On a lathe the axis of the part (its Z) lies along the spindle (+X), the end being worked free toward the tailstock ; a radial face (a
   cross hole, a flat : live tooling) is then turned up, about the spindle. */
const RX = { "-X": [[1, 0, 0], [0, 1, 0], [0, 0, 1]], "+X": [[1, 0, 0], [0, -1, 0], [0, 0, -1]], "+Y": [[1, 0, 0], [0, 0, -1], [0, 1, 0]], "-Y": [[1, 0, 0], [0, 0, 1], [0, -1, 0]] };
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const latheR = (face) => (face === "-Z" ? SIDE["-Z"] : RX[face] ? mm(RX[face], SIDE["+Z"]) : SIDE["+Z"]);
/** A point of the part in the frame of the station (m : the matrix of placeFor, column-major). */
export const toStation = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
/** A direction of the part in the frame of the station. */
export const dirToStation = (m, d) => [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];

/** What a phase is, in the shop : the kind of station its scene shows. */
export function stationKind(phase, proc) {
  const k = String((phase && phase.key) || "");
  if (k === "stock") return MOLD.has(proc) ? "mould" : PRINT.has(proc) ? "print" : SHEET.has(proc) ? "laser" : /^extrusion/.test(proc || "") ? "extrude" : proc === "pcb" ? "panel" : "saw";
  if (k.startsWith("setup:")) return proc === "cnc_turning" ? "lathe" : SHEET.has(proc) ? "drill" : "mill";
  return { rework: "drill", bend: "brake", deburr: "bench", surface: "tank", check: "metrology", pack: "carton" }[k] || "bench";
}
export const STATIONS = {
  saw: { label: "Scie à ruban et sa table", fr: "le brut est débité à la longueur" }, laser: { label: "Table de découpe laser", fr: "la tôle posée sur les lattes, la tête au-dessus" },
  mould: { label: "Moule en deux demi-moules", fr: "la pièce prend forme dans l'empreinte, entre les deux demi-moules" }, print: { label: "Plateau d'impression", fr: "la pièce monte couche par couche sur le plateau" },
  extrude: { label: "Filière et table de sortie", fr: "le profilé sort de la filière, puis se coupe à longueur" }, panel: { label: "Panneau du fabricant de cartes", fr: "la carte nue sort du panneau de son fabricant" },
  mill: { label: "Étau sur la table d'un centre d'usinage", fr: "la pièce serrée dans l'étau sur ses cales, la face travaillée vers la broche" }, lathe: { label: "Mandrin trois mors et tourelle", fr: "la pièce serrée dans le mandrin, l'outil vient sur la face libre" },
  drill: { label: "Perceuse à colonne et petit étau", fr: "les reprises : perçages, taraudages, inserts" }, brake: { label: "Presse plieuse : poinçon et matrice en V", fr: "la tôle posée sur la matrice, le poinçon descend sur la ligne de pli" },
  bench: { label: "Établi", fr: "ébavurage à la main : outil à ébavurer, lime, toile abrasive" }, tank: { label: "Bain de traitement (sous-traitant)", fr: "le traitement de surface, souvent fait hors de l'atelier" },
  metrology: { label: "Marbre et colonne de mesure", fr: "le contrôle : la pièce sur le marbre, les cotes relevées" }, carton: { label: "Carton et calage", fr: "marquage, protection des faces d'appui, emballage pièce par pièce" },
};

/** Where the part stands for a phase : the matrix (column-major, for the viewer) that turns it — the worked face up (or toward the lathe tool) —
    centres it and sets it on z = 0 ; and its box in that frame [x0, y0, z0, x1, y1, z1]. bbox : the box of the part in its own frame. */
export function placeFor(phase, proc, bbox) {
  const face = String((phase && phase.key) || "").startsWith("setup:") ? String(phase.key).slice(6) : "+Z", lathe = proc === "cnc_turning" && String(phase && phase.key).startsWith("setup:");
  const R = lathe ? latheR(face) : UP[face] || UP["+Z"], P = [];
  for (const x of [bbox[0], bbox[3]]) for (const y of [bbox[1], bbox[4]]) for (const z of [bbox[2], bbox[5]]) P.push(mul(R, [x, y, z]));
  const lo = [0, 1, 2].map((k) => Math.min(...P.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...P.map((p) => p[k]))), t = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]];
  const r = (v) => Math.round(v * 1e6) / 1e6, matrix = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, t[0], t[1], t[2], 1].map(r);
  return { matrix, face, box: [lo[0] + t[0], lo[1] + t[1], 0, hi[0] + t[0], hi[1] + t[1], hi[2] - lo[2]].map(r) };
}

const STEEL = "#b8c2cc", DARK = "#7c8a99", CAST = "#9aa5b1", WOOD = "#c79a64";      // light, so the part stands out from what holds it
/** The fixture and machine of a phase, around the part placed by placeFor. → [{ id, label, kind: "box" | "cyl", c, s | a, b, r, color, opacity?, around? }]
    around : a hollow thing the part stands INSIDE (a mould, a tank, a carton) — drawn see-through. mould : the mould of the part in the frame
    of the station (mouldIn) — the halves split at its parting line, the sprue and the runner to ITS gate, its overflows ; without it, a sprue on top. */
export function fixtureOf(kind, box, mould = null) {
  const [x0, y0, , x1, y1, h] = box, w = x1 - x0, d = y1 - y0, m = Math.max(w, d), out = [];
  const B = (id, label, c, s, color, o = {}) => out.push({ id, label, kind: "box", c, s, color, ...o }), C = (id, label, a, b, r, color, o = {}) => out.push({ id, label, kind: "cyl", a, b, r, color, ...o });
  const table = (z, size = m * 2 + 120) => B("table", "Table", [0, 0, z - 10], [size, size * 0.7, 20], CAST);
  if (kind === "mill") {
    const p = 8, top = Math.min(h * 0.5, 30), jw = Math.max(w * 1.1, 60);
    B("parallel-a", "Cale parallèle", [0, -d / 4, -p / 2], [w * 0.9, 6, p], STEEL); B("parallel-b", "Cale parallèle", [0, d / 4, -p / 2], [w * 0.9, 6, p], STEEL);
    B("jaw-fixed", "Mors fixe", [0, y0 - 7, (top - p) / 2], [jw, 14, top + p], STEEL); B("jaw-moving", "Mors mobile", [0, y1 + 7, (top - p) / 2], [jw, 14, top + p], STEEL);
    B("vise", "Corps de l'étau", [0, 0, -p - 9], [jw + 20, d + 60, 18], DARK); table(-p - 18);
    C("cutter", "Fraise", [0, 0, h + 3], [0, 0, h + 25], Math.max(3, Math.min(10, m / 12)), "#d4a017"); C("spindle", "Broche", [0, 0, h + 25], [0, 0, h + 85], 22, DARK);
  } else if (kind === "lathe") {
    const rp = Math.hypot(d, h) / 2, R = rp + 14, cz = h / 2;      // the jaws close on the circle the part turns in
    C("chuck", "Mandrin", [x0 - 45, 0, cz], [x0 - 3, 0, cz], R, DARK); for (let k = 0; k < 3; k++) { const q = (k * 2 * Math.PI) / 3; B(`jaw-${k}`, "Mors", [x0 + 4, Math.cos(q) * (rp + 4.5), cz + Math.sin(q) * (rp + 4.5)], [14, 8, 8], STEEL); }
    B("toolpost", "Tourelle porte-outil", [x1 - Math.min(10, w / 4), y1 + 32, cz], [24, 24, 24], STEEL); B("tool", "Outil de tournage", [x1 - Math.min(10, w / 4), y1 + 12, cz], [6, 16, 6], "#d4a017");
    B("bed", "Banc du tour", [0, 0, cz - R - 18], [w + 160, R * 2 + 60, 16], CAST);
  } else if (kind === "saw") {
    table(0, m + 160); B("blade", "Lame de scie", [x1 + 4, 0, h / 2 + 10], [1.5, d + 40, h + 40], "#c0c6cc"); B("vise", "Étau de la scie", [x1 - Math.min(20, w / 3), y1 + 9, h / 2], [20, 16, h], STEEL);
  } else if (kind === "laser") {
    const n = Math.max(4, Math.min(16, Math.round(w / 25)));
    for (let k = 0; k < n; k++) B(`slat-${k}`, "Latte", [x0 - 20 + (k * (w + 40)) / (n - 1), 0, -9], [2, d + 60, 18], STEEL);
    table(-18, m + 120); C("head", "Tête laser", [x0 + w * 0.3, 0, h + 6], [x0 + w * 0.3, 0, h + 60], 10, DARK);
  } else if (kind === "mould") {
    const g = 25, M = mould, a = M ? M.axis : 2, lo = [x0, y0, 0], hi = [x1, y1, h], split = M ? Math.max(lo[a], Math.min(hi[a], M.split)) : h / 2;
    const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), half = (from, to) => { const c = mid.slice(), s = [0, 1, 2].map((k) => hi[k] - lo[k] + 2 * g); c[a] = (from + to) / 2; s[a] = to - from; return [c, s]; };
    const low = half(lo[a] - g, split), high = half(split, hi[a] + g), [mov, fix] = !M || M.sign > 0 ? [high, low] : [low, high];       // the moving half opens in the pull
    B("half-fixed", "Demi-moule fixe (côté injection)", fix[0], fix[1], STEEL, { opacity: 0.22, around: true });
    B("half-moving", "Demi-moule mobile (côté éjection)", mov[0], mov[1], "#93a3b5", { opacity: 0.22, around: true });
    const G = M && M.gate, add = (p, n, k) => p.map((v, i) => v + n[i] * k), at = (p, v) => { const q = p.slice(); q[a] = v; return q; };
    if (!G) C("sprue", "Buse d'injection", [0, 0, h + g], [0, 0, h + g + 45], 9, DARK);
    else if (G.on === "face" || G.on === "bottom") C("sprue", G.on === "bottom" ? "Tube d'alimentation (par le bas)" : "Buse et carotte jusqu'au point d'injection", G.at, add(G.at, G.n, g + 45), 5, DARK);
    else {                                                                    // at the parting line (or under it) : the sprue comes through the fixed half beside the part, a runner runs along the parting plane to the gate
      const s = at(add(G.at, G.n, 16), split), out = !M || M.sign > 0 ? lo[a] - g - 40 : hi[a] + g + 40;
      C("sprue", "Carotte (sprue) et buse, à travers le demi-moule fixe", s, at(s, out), 5, DARK); C("runner", "Canal (runner) dans le plan de joint", s, at(G.at, split), 2.5, "#2563eb");
      if (Math.abs(G.at[a] - split) > 0.05) C("tunnel", "Tunnel jusqu'au point d'injection, sous le plan de joint", add(at(G.at, split), G.n, 1), add(G.at, G.n, 1), 1, "#2563eb");
      const t = [0, 1, 2].find((k) => k !== a && Math.abs(G.n[k]) < 0.5), side = hi[t] - lo[t];
      if (G.kind === "ingate") { const c = add(at(G.at, split), G.n, 3), sz = [0, 1, 2].map((k) => (k === a ? 1.5 : k === t ? side * 0.6 : 6)); B("ingate", "Ingate : le métal entre en lame mince", c, sz, "#2563eb"); }
      if (M.overflow) for (const k of [-1, 0, 1]) { const c = add(at(M.overflow.at, split), M.overflow.n, 7); c[t] += (k * side) / 3; B(`overflow-${k + 1}`, "Overflow et évent, à l'opposé de l'ingate", c, [0, 1, 2].map((q) => (q === a ? 4 : q === t ? 8 : 6)), "#0ea5a4"); }
    }
  } else if (kind === "print") {
    B("plate", "Plateau", [0, 0, -4], [m + 60, m + 60, 8], "#9ca3af"); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(`post-${sx}${sy}`, "Montant", [sx * (m / 2 + 40), sy * (m / 2 + 40), (h + 60) / 2], [10, 10, h + 60], DARK);
    C("nozzle", "Tête d'impression", [0, 0, h + 4], [0, 0, h + 30], 8, "#d4a017");
  } else if (kind === "extrude") {
    B("die", "Filière", [x0 - 16, 0, h / 2], [24, d + 80, h + 80], DARK); B("runout", "Table de sortie", [w / 2, 0, -6], [w + 60, d + 40, 12], CAST);
  } else if (kind === "panel") {
    B("panel", "Panneau de fabrication", [0, 0, h / 2], [w + 40, d + 40, h], "#2f7d4f", { opacity: 0.25, around: true });
  } else if (kind === "drill") {
    const top = Math.min(h * 0.5, 20);
    B("jaw-a", "Mors", [0, y0 - 6, top / 2], [Math.max(w, 40), 12, top], STEEL); B("jaw-b", "Mors", [0, y1 + 6, top / 2], [Math.max(w, 40), 12, top], STEEL); table(0, m + 120);
    C("drill", "Foret", [0, 0, h + 3], [0, 0, h + 40], 3, "#d4a017"); C("column", "Colonne", [0, -(m / 2 + 70), -20], [0, -(m / 2 + 70), h + 120], 14, DARK); B("head", "Tête de la perceuse", [0, -(m / 4 + 30), h + 70], [50, m / 2 + 90, 50], DARK);
  } else if (kind === "brake") {
    B("die", "Matrice en V", [0, 0, -15], [w + 40, 30, 30], DARK); B("bed", "Tablier", [0, 0, -45], [w + 120, 50, 30], CAST); B("punch", "Poinçon", [0, 0, h + 35], [w + 40, 12, 60], STEEL); B("ram", "Coulisseau", [0, 0, h + 85], [w + 120, 40, 40], CAST);
  } else if (kind === "bench") {
    B("bench", "Établi", [0, 0, -15], [m * 2 + 160, m + 120, 30], WOOD); C("deburr", "Outil à ébavurer", [x1 + 25, 0, 6], [x1 + 90, 0, 6], 5, "#2563eb");
  } else if (kind === "tank") {
    const g = 20, W = w + 2 * g, D = d + 2 * g, H = h + 2 * g;
    B("tank-floor", "Fond du bain", [0, 0, -g - 3], [W + 6, D + 6, 6], "#64748b", { around: true }); B("bath", "Bain", [0, 0, H / 2 - g], [W, D, H], "#38bdf8", { opacity: 0.25, around: true });
    for (const [id, c, s] of [["wall-a", [0, -D / 2 - 3, H / 2 - g], [W + 6, 6, H]], ["wall-b", [0, D / 2 + 3, H / 2 - g], [W + 6, 6, H]], ["wall-c", [-W / 2 - 3, 0, H / 2 - g], [6, D, H]], ["wall-d", [W / 2 + 3, 0, H / 2 - g], [6, D, H]]]) B(id, "Paroi du bain", c, s, "#64748b", { opacity: 0.45, around: true });
  } else if (kind === "metrology") {
    B("plate", "Marbre", [0, 0, -30], [m * 2 + 140, m + 120, 60], "#374151"); const gx = x1 + 45;
    B("gauge-base", "Pied de la colonne de mesure", [gx, 0, 6], [40, 40, 12], DARK); C("gauge-post", "Colonne", [gx, 0, 12], [gx, 0, h + 60], 5, STEEL); B("gauge-arm", "Palpeur", [gx - 22, 0, h + 2], [44, 6, 6], "#d4a017");
  } else if (kind === "carton") {
    const g = 15, W = w + 2 * g, D = d + 2 * g, H = h + g;
    B("carton-floor", "Fond du carton", [0, 0, -3], [W, D, 6], WOOD, { around: true }); for (const [id, c, s] of [["side-a", [0, -D / 2, H / 2], [W, 3, H]], ["side-b", [0, D / 2, H / 2], [W, 3, H]], ["side-c", [-W / 2, 0, H / 2], [3, D, H]], ["side-d", [W / 2, 0, H / 2], [3, D, H]]]) B(id, "Carton", c, s, WOOD, { opacity: 0.4, around: true });
  }
  return out;
}
/** The meshes of a fixture, for the viewer : { id, mesh, color, opacity }. */
export const fixtureMeshes = (solids) => solids.map((s) => ({ id: `fab/${s.id}`, name: s.label, mesh: s.kind === "cyl" ? cylMesh(s.a, s.b, s.r, 28) : boxMesh(s.c, s.s), color: s.color, opacity: s.opacity ?? 1, pickable: false }));
/** The box a solid takes, for the checks : [x0, y0, z0, x1, y1, z1]. */
export function solidBox(s) {
  if (s.kind === "box") return [0, 1, 2].map((k) => s.c[k] - s.s[k] / 2).concat([0, 1, 2].map((k) => s.c[k] + s.s[k] / 2));
  const lo = [0, 1, 2].map((k) => Math.min(s.a[k], s.b[k])), hi = [0, 1, 2].map((k) => Math.max(s.a[k], s.b[k])), ax = [0, 1, 2].map((k) => Math.abs(s.b[k] - s.a[k]) > 1e-9);
  return [0, 1, 2].map((k) => lo[k] - (ax[k] && !ax.every(Boolean) && ax.filter(Boolean).length === 1 ? 0 : s.r)).concat([0, 1, 2].map((k) => hi[k] + (ax[k] && ax.filter(Boolean).length === 1 ? 0 : s.r)));
}
const NORMAL = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
/** The mould of a part (moldPlan of core/mold_plan.js) in the frame of the station : the axis and sense of the pull, the level of the parting
    line, the gate and the overflows, each with the outward normal of its face. null when the plan says too little. */
export function mouldIn(m, mp) {
  if (!mp || !mp.parting || !NORMAL[mp.pull]) return null;
  const d = dirToStation(m, NORMAL[mp.pull]), a = [0, 1, 2].reduce((b, k) => (Math.abs(d[k]) > Math.abs(d[b]) ? k : b), 0), P = [0, 0, 0]; P[mp.parting.axis] = mp.parting.level;
  const spot = (x) => (x && Array.isArray(x.at) && NORMAL[x.face] ? { at: toStation(m, x.at), n: dirToStation(m, NORMAL[x.face]) } : null), G = spot(mp.gate);
  return { axis: a, sign: Math.sign(d[a]), split: toStation(m, P)[a], gate: G && { ...G, kind: mp.gate.kind, on: mp.gate.on }, overflow: spot(mp.overflow) };
}
/** The whole scene of a phase. mould : the mould plan of a moulded part (moldPlan), drawn on its moulding phase. → { kind, station, place, solids } */
export function sceneOf(phase, proc, bbox, mould = null) {
  const kind = stationKind(phase, proc), place = placeFor(phase, proc, bbox);
  return { kind, station: STATIONS[kind], place, solids: fixtureOf(kind, place.box, kind === "mould" ? mouldIn(place.matrix, mould) : null) };
}
