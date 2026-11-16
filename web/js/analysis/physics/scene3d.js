/* DesignWizard.ai — the simple model of a hand calculation, in 3D : the beam with its wall and its load, the bolt in its
   two plates, the fins of a heat sink… drawn with the DIMENSIONS THE DESIGNER TYPED, so that a number out of proportion
   shows at once. Pure : it returns solids (as meshes), marks (arrows, supports, heat) and labels ; the screen puts them
   in the 3D view. What is shortened or thickened to stay readable says so in a label.
   sceneOf(model, inputs) → { solids: [{ id, mesh: { pos, nrm, idx, epos }, color, opacity }], marks: [{ t, at, dir, color }], labels: [{ at, text }] } */

import { toShown, shownUnit, converts, SI_UNITS } from "../../core/units.js";

const P = (v, d) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : d);
const n1 = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
export const SCENE_COLORS = { part: null, second: "#c8763f", dark: "#5b6570", tim: "#f59e0b", hot: "#e5484d", wall: "#8d949a", board: "#2f7d4f", fluid: "#38bdf8", force: "#e5484d", flow: "#0ea5e9", heat: "#f97316", current: "#eab308" };
const C = SCENE_COLORS;

/** A box centred on c, of size s. */
export function boxMesh(c, s) {
  const [hx, hy, hz] = s.map((v) => v / 2), pos = [], nrm = [], idx = [], F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  const h = [hx, hy, hz], at = (n, u, v, a, b) => [0, 1, 2].map((k) => c[k] + n[k] * h[k] + u[k] * h[k] * a + v[k] * h[k] * b);
  for (const [n, u, v] of F) { const o = pos.length / 3; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(...at(n, u, v, a, b)); nrm.push(...n); } idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  const k = (x, y, z) => [c[0] + x * hx, c[1] + y * hy, c[2] + z * hz], e = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) e.push(...k(-1, s1, s2), ...k(1, s1, s2), ...k(s1, -1, s2), ...k(s1, 1, s2), ...k(s1, s2, -1), ...k(s1, s2, 1));
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), epos: new Float32Array(e) };
}
/** A cylinder of radius r from point a to point b, closed at both ends (n facets). */
export function cylMesh(a, b, r, n = 28) {
  const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...ax) || 1, w = ax.map((v) => v / L), t = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = [w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]], ul = Math.hypot(...u), U = u.map((v) => v / ul), V = [w[1] * U[2] - w[2] * U[1], w[2] * U[0] - w[0] * U[2], w[0] * U[1] - w[1] * U[0]];
  const pos = [], nrm = [], idx = [], e = [], ring = (p, k) => { const q = 2 * Math.PI * k / n, cs = Math.cos(q), sn = Math.sin(q), d = [0, 1, 2].map((j) => U[j] * cs + V[j] * sn); return [[0, 1, 2].map((j) => p[j] + r * d[j]), d]; };
  for (let k = 0; k < n; k++) {
    const [p0, d0] = ring(a, k), [p1, d1] = ring(a, k + 1), [q0] = ring(b, k), [q1] = ring(b, k + 1), o = pos.length / 3;
    pos.push(...p0, ...p1, ...q1, ...q0); nrm.push(...d0, ...d1, ...d1, ...d0); idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    e.push(...p0, ...p1, ...q0, ...q1);
    for (const [c, m, x, y] of [[a, w.map((v) => -v), p1, p0], [b, w, q0, q1]]) { const z = pos.length / 3; pos.push(...c, ...x, ...y); nrm.push(...m, ...m, ...m); idx.push(z, z + 1, z + 2); }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), epos: new Float32Array(e) };
}

/* ---------- the scenes, by kind of sketch ---------- */
function make(U) {
  const S = { solids: [], marks: [], labels: [] }; let k = 0;
  /* what a label says, in the units shown : a quantity, a list of dimensions, a diameter (bare in SI, as on a drawing) */
  const w = (v, unit) => { const x = toShown(v, unit, U); return converts(unit, U) && Number.isFinite(x) && Math.abs(x) < 100 ? String(Number(x.toPrecision(3))).replace(".", ",") : n1(x); };      // a converted value keeps three significant digits : 0,05 mm is 0,00197 in, not 0
  const q = (v, unit) => `${w(v, unit)} ${shownUnit(unit, U)}`, dims = (list, unit = "mm") => `${list.map((v) => w(v, unit)).join(" × ")} ${shownUnit(unit, U)}`, dia = (d) => (converts("mm", U) ? `Ø${q(d, "mm")}` : `Ø${n1(d)}`);
  return { S, q, dims, dia, box: (c, s, color, opacity) => S.solids.push({ id: `m${++k}`, mesh: boxMesh(c, s), color: color || C.part, opacity: opacity ?? 1 }), cyl: (a, b, r, color, opacity) => S.solids.push({ id: `m${++k}`, mesh: cylMesh(a, b, r), color: color || C.part, opacity: opacity ?? 1 }),
    arrow: (at, dir, color = C.force) => S.marks.push({ t: "arrow", at, dir, color }), clamp: (at, dir) => S.marks.push({ t: "clamp", at, dir, color: "#2563eb" }), gem: (at, color = C.heat) => S.marks.push({ t: "gem", at, dir: [0, 0, 1], color }), label: (at, text) => S.labels.push({ at, text }) };
}
/* the section of a beam, a column : along axis 0 (X) or 2 (Z), from 0 to L. → half heights [in Y, in Z] (or [X, Y] for a column) */
function bar(G, i, L, axis) {
  const a = [0, 0, 0], b = [0, 0, 0]; b[axis] = L; const mid = [0, 0, 0]; mid[axis] = L / 2;
  if (i.section === "round" || i.section === "tube") { const r = P(i.d, 20) / 2; G.cyl(a, b, r); if (i.section === "tube") { const e = [...a], f = [...b]; e[axis] -= 0.4; f[axis] += 0.4; G.cyl(e, f, Math.max(r - P(i.t, 2), r * 0.2), C.dark); } return [r, r]; }
  const w = i.section === "custom" ? Math.sqrt(P(i.Ac, 400)) : P(i.b, 20), h = i.section === "custom" ? 2 * P(i.cc, w / 2) : P(i.h, 20), s = axis === 0 ? [L, w, h] : [w, h, L];
  G.box(mid, s); return [w / 2, h / 2];
}
const SCENES = {
  beam(G, i, kind) {
    const L = P(i.L, 200), [hy, hz] = bar(G, i, L, 0), cant = kind.startsWith("cantilever"), big = Math.max(hy, hz);
    if (cant) G.box([-L / 50, 0, 0], [L / 25, 6 * big, 6 * big], C.wall); else { G.clamp([L * 0.03, 0, -hz], [0, 0, -1]); G.clamp([L * 0.97, 0, -hz], [0, 0, -1]); }
    if (kind.endsWith("point")) G.arrow([cant ? L : L / 2, 0, hz], [0, 0, -1]); else for (let k = 0; k < 6; k++) G.arrow([L * (k + 0.5) / 6, 0, hz], [0, 0, -1]);
    G.label([L / 2, -hy, -hz], `L = ${G.q(L, "mm")}`); G.label([cant ? L : L / 2, 0, hz], `${kind.endsWith("udl") ? "charge répartie, " : ""}F = ${G.q(P(i.F, 0), "N")}`);
  },
  column(G, i) { const L = P(i.L, 300), [hx, hy] = bar(G, i, L, 2), big = Math.max(hx, hy); G.box([0, 0, -L / 50], [6 * big, 6 * big, L / 25], C.wall); G.arrow([0, 0, L], [0, 0, -1]); G.label([hx, 0, L / 2], `L = ${G.q(L, "mm")}`); G.label([0, 0, L], `F = ${G.q(P(i.F, 0), "N")}`); },
  shaft(G, i) { const L = P(i.L, 200), ro = P(i.do, 20) / 2; G.cyl([0, 0, 0], [L, 0, 0], ro); if (P(i.di, 0)) G.cyl([-0.4, 0, 0], [L + 0.4, 0, 0], Math.min(i.di / 2, ro * 0.95), C.dark); G.box([-L / 50, 0, 0], [L / 25, 5 * ro, 5 * ro], C.wall);
    G.arrow([L, ro, 0], [0, 0, 1]); G.arrow([L, -ro, 0], [0, 0, -1]); G.label([L, 0, ro], `T = ${G.q(P(i.T, 0), "N·m")}`); G.label([L / 2, 0, -ro], `L = ${G.q(L, "mm")} · ${G.dia(2 * ro)}`); },
  plate(G, i) { const a = P(i.a, 200), b = P(i.b, 150), t = P(i.t, 3); G.box([0, 0, 0], [a, b, t]);
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) G.arrow([x * a / 3.2, y * b / 3.2, t / 2], [0, 0, -1]);
    if (i.edges === "fixed") { const w = Math.max(t, a / 40); for (const s of [-1, 1]) { G.box([s * (a / 2 + w / 2), 0, 0], [w, b + 2 * w, 4 * t], C.wall); G.box([0, s * (b / 2 + w / 2), 0], [a, w, 4 * t], C.wall); } } else for (const x of [-1, 1]) for (const y of [-1, 1]) G.clamp([x * a / 2, y * b / 2, -t / 2], [0, 0, -1]);
    G.label([0, -b / 2, -t / 2], G.dims([a, b, t])); G.label([0, 0, t / 2], `p = ${G.q(P(i.p, 0), "kPa")}`); },
  bimetal(G, i) { const L = P(i.L, 200), s1 = Math.sqrt(P(i.A1, 100)), s2 = Math.sqrt(P(i.A2, 100)), w = Math.max(s1, s2); G.box([L / 2, s1 / 2, 0], [L, s1, s1]); G.box([L / 2, -s2 / 2, 0], [L, s2, s2], C.second);
    for (const x of [0, L]) G.box([x + (x ? 1 : -1) * L / 60, 0, 0], [L / 30, 3 * w, 2.4 * w], C.wall); G.gem([L / 2, 0, w / 2]); G.label([L / 2, 0, -w / 2], `L = ${G.q(L, "mm")} · de ${n1(i.T0 ?? 20)} à ${n1(i.T ?? 80)} °C`); },
  bolt(G, i) { const d = parseFloat(String(i.size || "M6").slice(1)) || 6, lk = P(i.lk, 2 * d), w = 6 * d;
    G.box([0, 0, lk / 4], [w, w, lk / 2]); G.box([d, 0, -lk / 4], [w, w, lk / 2], C.second); G.cyl([0, 0, -lk / 2 - (i.mode === "nut" ? 0.9 * d : 0)], [0, 0, lk / 2], d / 2, C.dark); G.cyl([0, 0, lk / 2], [0, 0, lk / 2 + 0.7 * d], 0.85 * d, C.dark);
    if (i.mode === "nut") G.cyl([0, 0, -lk / 2 - 0.8 * d], [0, 0, -lk / 2], 0.9 * d, C.dark);
    if (P(i.Fa, 0)) { G.arrow([0, 0, lk / 2 + 0.7 * d + 2.5 * d], [0, 0, 1]); G.label([0, 0, lk / 2 + 3 * d], `Fa = ${G.q(i.Fa, "N")}`); } if (P(i.Fs, 0)) { G.arrow([-w / 2, 0, lk / 4], [1, 0, 0]); G.label([-w / 2, 0, lk / 4], `Fs = ${G.q(i.Fs, "N")}`); }
    G.label([w / 2, 0, -lk / 2], `${i.size || "M6"} · serrage ${G.q(lk, "mm")}`); },
  pressfit(G, i) { const d = P(i.d, 20), L = P(i.L, 20), Do = P(i.Do, 2 * d); G.cyl([0, 0, 0], [L, 0, 0], Do / 2, C.second, 0.75); G.cyl([-0.6 * L, 0, 0], [1.6 * L, 0, 0], d / 2); G.label([L / 2, 0, Do / 2], `${G.dia(d)} · serrage ${G.q(P(i.delta, 0), "µm")}`); G.label([L / 2, 0, -Do / 2], `portée ${G.q(L, "mm")}`); },
  pin(G, i) { const d = P(i.d, 6), t = P(i.t, 6), np = Math.max(1, Math.round(P(i.np, 1))), two = String(i.planes) === "2", w = Math.max(6 * d, (np + 1) * 3 * d), layers = two ? [1, 0, -1] : [0.5, -0.5];
    layers.forEach((z, k) => G.box([(k % 2 ? 1 : -1) * 1.5 * d, 0, z * t], [6 * d, w, t], k % 2 ? C.second : C.part)); for (let k = 0; k < np; k++) G.cyl([0, (k - (np - 1) / 2) * 3 * d, -layers.length * t / 2 - 0.2 * t], [0, (k - (np - 1) / 2) * 3 * d, layers.length * t / 2 + 0.2 * t], d / 2, C.dark);
    G.arrow([-4.5 * d - 2 * d, 0, layers[0] * t], [-1, 0, 0]); G.arrow([4.5 * d + 2 * d, 0, layers[1] * t], [1, 0, 0]); G.label([0, 0, layers.length * t / 2], `${np} goupille${np > 1 ? "s" : ""} ${G.dia(d)} · F = ${G.q(P(i.F, 0), "N")}`); },
  pipe(G, i) { const d = P(i.d, 10), L = P(i.L, 500), shown = Math.min(L, 40 * d), wall = Math.max(0.8, 0.1 * d); G.cyl([0, 0, 0], [shown, 0, 0], d / 2 + wall, C.part, 0.55); G.cyl([-0.3, 0, 0], [shown + 0.3, 0, 0], d / 2, C.fluid, 0.8);
    G.arrow([0, 0, 0], [1, 0, 0], C.flow); G.arrow([shown + 3 * d, 0, 0], [1, 0, 0], C.flow); G.label([shown / 2, 0, d / 2 + wall], `${G.dia(d)} intérieur · L = ${G.q(L, "mm")}${shown < L ? " (raccourci à l'écran)" : ""}`); G.label([0, 0, -d], `Q = ${G.q(P(i.Q, 0), "L/min")}`); },
  orifice(G, i) { const D = P(i.D, 20), d = Math.min(P(i.d, 8), D * 0.98), wall = Math.max(0.8, 0.08 * D), L = 6 * D; G.cyl([0, 0, 0], [L, 0, 0], D / 2 + wall, C.part, 0.45); G.cyl([L / 2 - 0.06 * D, 0, 0], [L / 2 + 0.06 * D, 0, 0], D / 2 + wall, C.dark); G.cyl([L / 2 - 0.09 * D, 0, 0], [L / 2 + 0.09 * D, 0, 0], d / 2, C.fluid);
    G.arrow([0, 0, 0], [1, 0, 0], C.flow); G.arrow([L + 1.5 * D, 0, 0], [1, 0, 0], C.flow); G.label([L / 2, 0, D / 2 + wall], `orifice ${G.dia(d)} dans ${G.dia(D)}`); G.label([0, 0, -D], `Q = ${G.q(P(i.Q, 0), "L/min")}`); },
  wall(G, i) { const side = Math.sqrt(P(i.A, 400)), layers = [[i.t1, C.part, "1"], [i.tim_t, C.tim, "interface"], [i.t2, C.second, "2"], [i.t3, C.dark, "3"]].filter(([t]) => P(t, 0) > 0); let x = 0;
    for (const [t, color, name] of layers) { G.box([x + t / 2, 0, 0], [t, side, side], color); G.label([x + t / 2, 0, side / 2], `${name} · ${G.q(t, "mm")}`); x += t; }
    G.arrow([0, 0, 0], [1, 0, 0], C.heat); G.arrow([x + side * 0.45, 0, 0], [1, 0, 0], C.heat); G.label([0, 0, -side / 2], `P = ${n1(P(i.P, 0))} W sur ${G.q(P(i.A, 400), "mm²")}`); },
  chain(G, i) { G.box([0, 0, 3], [60, 60, 6], C.part); for (let k = -3; k <= 3; k++) G.box([k * 8, 0, 12], [2, 60, 12], C.part); G.box([0, 0, -1.5], [16, 16, 3], C.dark); G.box([0, 0, -3.6], [6, 6, 1.2], C.hot);
    G.gem([0, 0, -4.2], C.hot); G.arrow([0, 0, 30], [0, 0, 1], C.heat); G.label([0, 0, -4.2], `jonction · P = ${n1(P(i.P, 0))} W`); G.label([0, 0, 18], `air à ${n1(i.Ta ?? 25)} °C`); },
  fins(G, i, kind) { const W = P(i.W, 80), Lf = P(i.Lf, 60), H = P(i.H, 25), tf = P(i.tf, 1.5), N = Math.max(2, Math.min(60, Math.round(P(i.N, 8)))), base = Math.max(3, 0.12 * H), pitch = (W - tf) / (N - 1);
    G.box([0, 0, -base / 2], [W, Lf, base]); for (let k = 0; k < N; k++) G.box([-W / 2 + tf / 2 + k * pitch, 0, H / 2], [tf, Lf, H]); G.gem([0, 0, -base], C.hot);
    if (kind === "fins-forced") for (const x of [-0.3, 0, 0.3]) G.arrow([x * W, -Lf / 2, H / 2], [0, 1, 0], C.flow); else for (const x of [-0.3, 0, 0.3]) G.arrow([x * W, 0, H + 0.6 * H], [0, 0, 1], C.heat);
    G.label([0, -Lf / 2, -base], `${N} ailettes · ${G.dims([W, Lf, H])}`); G.label([0, 0, -base], `P = ${n1(P(i.P, 0))} W`); },
  lump(G, i) { const side = Math.cbrt(P(i.m, 100) / 1000 / P(i.rho, 2700)) * 1000; G.box([0, 0, 0], [side, side, side]); G.gem([0, 0, 0], C.hot); for (const s of [-1, 1]) G.arrow([s * side * 1.1, 0, 0], [s, 0, 0], C.heat); G.arrow([0, 0, side * 1.1], [0, 0, 1], C.heat);
    G.label([0, 0, -side / 2], `${n1(P(i.m, 100))} g · cube équivalent de ${G.q(side, "mm")}`); G.label([0, 0, side / 2], `P = ${n1(P(i.P, 0))} W`); },
  busbar(G, i) { const L = P(i.L, 200), w = P(i.w, 20), t = P(i.t, 3); G.box([L / 2, 0, 0], [L, w, t], C.second); G.arrow([0, 0, 0], [1, 0, 0], C.current); G.arrow([L + Math.max(w, L / 8), 0, 0], [1, 0, 0], C.current);
    G.label([L / 2, -w / 2, -t / 2], `${G.dims([w, t])} · L = ${G.q(L, "mm")}`); G.label([0, 0, t / 2], `I = ${n1(P(i.I, 0))} A`); },
  trace(G, i) { const L = P(i.L, 50), w = P(i.w, 1), tcu = P(i.tcu, 35) / 1000, shown = Math.max(tcu, 0.12 * w), bw = Math.max(8 * w, 6), inner = i.layer === "internal";
    G.box([L / 2, 0, -0.8], [L, bw, 1.6], C.board, inner ? 0.55 : 1); G.box([L / 2, 0, inner ? -0.8 : shown / 2], [L, w, shown], C.second); G.arrow([0, 0, inner ? -0.8 : shown], [1, 0, 0], C.current);
    G.label([L / 2, 0, shown], `piste ${G.q(w, "mm")} · cuivre ${G.q(P(i.tcu, 35), "µm")}${shown > tcu ? " (épaissi à l'écran)" : ""} · couche ${inner ? "interne" : "externe"}`); G.label([0, 0, -1.6], `I = ${n1(P(i.I, 0))} A`); },
  pulse(G, i) { const r = Math.sqrt(P(i.A, 2.5) / Math.PI), L = 14 * r; G.cyl([0, 0, 0], [L, 0, 0], r, C.second); G.arrow([0, 0, 0], [1, 0, 0], C.current); G.arrow([L + 5 * r, 0, 0], [1, 0, 0], C.current); G.gem([L / 2, 0, r], C.hot);
    G.label([L / 2, 0, -r], `section ${G.q(P(i.A, 2.5), "mm²")} (${G.dia(2 * r)} équivalent)`); G.label([0, 0, r], `I = ${n1(P(i.I, 0))} A pendant ${n1(P(i.time, 0))} s`); },
};
const KIND = { "cantilever-point": "beam", "cantilever-udl": "beam", "simple-point": "beam", "simple-udl": "beam", "fins-natural": "fins", "fins-forced": "fins" };

/** The 3D scene of a model for its inputs ; units : what its labels are written in (core/units.js). A model with no scene of its own gives an empty one. */
export function sceneOf(model, inputs, units = SI_UNITS) {
  const G = make(units), kind = model && model.sketch, fn = SCENES[KIND[kind] || kind];
  if (fn) fn(G, inputs || {}, kind);
  return G.S;
}
/** The box that holds every solid of a scene : [x0, y0, z0, x1, y1, z1] (null when it is empty). */
export function sceneBox(scene) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const s of scene.solids) for (let k = 0; k < s.mesh.pos.length; k += 3) for (let d = 0; d < 3; d++) { const v = s.mesh.pos[k + d]; if (v < b[d]) b[d] = v; if (v > b[d + 3]) b[d + 3] = v; }
  return scene.solids.length ? b : null;
}
