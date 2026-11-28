/* DynamiteOrbit.ai — feature engine of the part language: turns an (already evaluated) feature list into kernel bodies.
   Each feature: {op, id?, name?, body? ("main"), mode? ("add" | "cut" | "intersect"), suppressed?, when?} + its own fields.
   Face-based features take `face` ("+Z", "top"...), 2D positions in MODEL coordinates of that face's plane
   ([x,y] on ±Z, [x,z] on ±Y, [y,z] on ±X) and `start` (level of the face along its axis; default: the outside of the body). */

import { v3, FACES, PLANES, faceKey, facePoint } from "./vec.js";
import { normalizeProfile, profileBBox, profileArea, profilePerimeter, flattenLoop } from "./profile.js";
import { KernelError } from "./occ.js";
import { THREADS } from "./standards.js";
import { textStrokes, unmarkable, MARK_CHARS } from "./stroke_font.js";

export class FeatureError extends Error {
  constructor(msg, feature) { super(msg); this.feature = feature; }
}
const num = (v, what, f) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new FeatureError(`${what} : nombre attendu, reçu ${JSON.stringify(v)}. Correctif : vérifiez le nom du paramètre ou l'expression.`, f);
  return v;
};
const pos = (v, what, f) => { if (num(v, what, f) <= 0) throw new FeatureError(`${what} doit être positif (reçu ${v}).`, f); return v; };
const AXES = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const axisOf = (a, f) => {
  if (Array.isArray(a)) return v3.unit(a);
  const k = String(a || "Z").toUpperCase().replace("+", "");
  if (k.startsWith("-") && AXES[k.slice(1)]) return v3.neg(AXES[k.slice(1)]);
  if (!AXES[k]) throw new FeatureError(`Axe inconnu « ${a} » (X, Y ou Z).`, f);
  return AXES[k];
};

/** Expand a position list or a pattern into 2D points. */
export function positions(at, f) {
  if (!at) return [[0, 0]];
  if (Array.isArray(at)) {
    if (at.length && typeof at[0] === "number") return [[num(at[0], "at[0]", f), num(at[1], "at[1]", f)]];
    return at.map((p, i) => [num(p[0], `at[${i}][0]`, f), num(p[1], `at[${i}][1]`, f)]);
  }
  if (at.grid) {
    const g = at.grid, o = g.origin || [0, 0], nx = Math.round(g.nx || 1), ny = Math.round(g.ny || 1), out = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([o[0] + i * (g.dx || 0), o[1] + j * (g.dy || 0)]);
    return out;
  }
  if (at.circle) {
    const c = at.circle, o = c.center || [0, 0], n = Math.round(c.n || 1), r = (c.d || c.pcd || 0) / 2, a0 = c.start || 0, out = [];
    for (let i = 0; i < n; i++) { const a = (a0 + i * (c.angle || 360) / n) * Math.PI / 180; out.push([o[0] + r * Math.cos(a), o[1] + r * Math.sin(a)]); }
    return out;
  }
  throw new FeatureError(`Positions « at » non comprises : ${JSON.stringify(at)}. Formes : [x,y], [[x,y],...], {grid:{origin,nx,ny,dx,dy}}, {circle:{center,n,d,start}}.`, f);
}

function bodyBBox(K, st, name) { const s = st.bodies.get(name); return s ? K.bbox(s) : null; }
function allBBox(K, st) { let bb = null; for (const s of st.bodies.values()) { const b = K.bbox(s); bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.min(bb[2], b[2]), Math.max(bb[3], b[3]), Math.max(bb[4], b[4]), Math.max(bb[5], b[5])] : b; } return bb; }

/** Level of a face along its axis: explicit `start`, else the outside of the target body on that side. */
function faceLevel(K, st, f, face, body) {
  if (f.start !== undefined && f.start !== null) return num(f.start, "start", f);
  const bb = bodyBBox(K, st, body) || allBBox(K, st);
  if (!bb) throw new FeatureError(`« ${f.op} » sur la face ${face} : aucun volume n'existe encore. Correctif : commencez par un box ou un extrude.`, f);
  const F = FACES[face];
  return F.n[F.axis] > 0 ? bb[3 + F.axis] : bb[F.axis];
}

function apply(K, st, f, tool, mode) {
  const name = f.body || st.main, cur = st.bodies.get(name);
  mode = mode || f.mode || "add";
  if (mode === "add" || mode === "new") {
    st.bodies.set(name, cur ? K.fuse(cur, [tool]) : tool);
    if (!cur) st.order.push(name);
  } else if (mode === "cut") {
    const targets = f.bodies === "all" ? [...st.bodies.keys()] : [name];
    for (const t of targets) {
      const s = st.bodies.get(t);
      if (!s) { if (f.bodies !== "all") throw new FeatureError(`« ${f.op} » enlève de la matière au corps « ${t} », qui n'existe pas encore.`, f); continue; }
      st.bodies.set(t, K.cut(s, Array.isArray(tool) ? tool : [tool]));
    }
  } else if (mode === "intersect") {
    if (!cur) throw new FeatureError(`« ${f.op} » : rien à intersecter.`, f);
    st.bodies.set(name, K.common(cur, tool));
  } else throw new FeatureError(`Mode inconnu « ${mode} » (add, cut, intersect).`, f);
}

function profileFacts(profile) {
  const bb = profileBBox(profile);
  let rMin = Infinity;
  for (const lp of [profile.outer, ...profile.holes]) for (const s of lp) if (s.t === "A") rMin = Math.min(rMin, s.r);
  return { w: bb[2] - bb[0], h: bb[3] - bb[1], area: profileArea(profile), perimeter: profilePerimeter(profile), rMin: Number.isFinite(rMin) ? rMin : 0, holes: profile.holes.length };
}

/** The draft a feature asks for, in degrees (0 : straight). */
const leanOf = (f) => { const a = f.draft === undefined || f.draft === null || f.draft === false ? 0 : Number(f.draft); if (!Number.isFinite(a) || a < 0 || a > 15) throw new FeatureError(`« draft » = ${JSON.stringify(f.draft)} : un angle de 0 à 15 degrés est attendu.`, f); return a; };

const OPS = {
  box(K, st, f) {
    const s = f.size || [f.x, f.y, f.z];
    const size = [pos(s[0], "box size x", f), pos(s[1], "box size y", f), pos(s[2], "box size z", f)];
    const min = f.center ? [f.center[0] - size[0] / 2, f.center[1] - size[1] / 2, f.center[2] - size[2] / 2] : (f.at || [0, 0, 0]).map((v, i) => num(v, `box at[${i}]`, f));
    apply(K, st, f, K.box(min, v3.add(min, size)));
  },
  /** A tube wound in a helix (a cooling coil, a spring) : "at" = centre of the base of the helix, "r" = radius of its centre line there, "r1" at the
      top (a cone when it differs), "h" = height, "turns", "d" = outside diameter of the tube, "di" = its bore (0 : solid). */
  coil(K, st, f) {
    const a = axisOf(f.axis, f), base = (f.at || [0, 0, 0]).map((v, i) => num(v, `coil at[${i}]`, f)), r = pos(f.r, "coil r", f), r1 = f.r1 === undefined || f.r1 === null ? r : pos(f.r1, "coil r1", f);
    const h = pos(f.h, "coil h", f), turns = pos(f.turns, "coil turns", f), d = pos(f.d, "coil d", f), di = f.di ? pos(f.di, "coil di", f) : 0;
    if (h / turns < d - 1e-9) throw new FeatureError(`coil : le pas (${Math.round(h / turns * 100) / 100}) est plus court que le diamètre du tube (${d}) — les spires se traversent.`, f);
    if (Math.min(r, r1) <= d / 2) throw new FeatureError(`coil : le rayon de l'hélice (${Math.min(r, r1)}) doit dépasser le rayon du tube (${d / 2}).`, f);
    apply(K, st, f, K.coil(base, a, r, r1, h, turns, d, di));
  },
  cylinder(K, st, f) {
    const a = axisOf(f.axis, f), base = (f.at || [0, 0, 0]).map((v, i) => num(v, `cylinder at[${i}]`, f));
    const h = pos(f.h ?? f.length, "cylinder h", f), d = pos(f.d, "cylinder d", f);
    apply(K, st, f, K.cylinder(f.centered ? v3.sub(base, v3.mul(a, h / 2)) : base, a, d / 2, h));
    if ((f.mode || "add") === "cut") st.facts.holes.push({ d, depth: h, through: false, axis: a, at: base, source: f.id });
  },
  extrude(K, st, f) {
    const P = PLANES[String(f.plane || "XY").toUpperCase()];
    if (!P) throw new FeatureError(`Plan inconnu « ${f.plane} » (XY, XZ ou YZ).`, f);
    const profile = normalizeProfile(f.profile), len = num(f.length ?? f.h, "extrude length", f);
    if (Math.abs(len) < 1e-6) throw new FeatureError("extrude : longueur nulle.", f);
    const at = num(f.at ?? 0, "extrude at", f) - (f.symmetric ? len / 2 : 0);
    const face = K.faceOfProfile(profile, { o: v3.mul(P.n, at), u: P.u, v: P.v });
    apply(K, st, f, K.prism(face, v3.mul(P.n, len)));
    st.facts.extrudes.push({ ...profileFacts(profile), length: Math.abs(len), plane: f.plane || "XY", mode: f.mode || "add", source: f.id, profile });
  },
  revolve(K, st, f) {
    const P = PLANES[String(f.plane || "XZ").toUpperCase()];
    if (!P) throw new FeatureError(`Plan inconnu « ${f.plane} ».`, f);
    const profile = normalizeProfile(f.profile);
    const face = K.faceOfProfile(profile, { o: [0, 0, 0], u: P.u, v: P.v });
    apply(K, st, f, K.revolve(face, f.axis_at || [0, 0, 0], axisOf(f.axis || "Z", f), num(f.angle ?? 360, "revolve angle", f)));
    st.facts.revolves.push({ ...profileFacts(profile), source: f.id });
  },
  hole(K, st, f) {
    const face = faceKey(f.face || "+Z"), F = FACES[face], body = f.body || st.main;
    const level = faceLevel(K, st, f, face, body), bb = bodyBBox(K, st, body) || allBBox(K, st);
    const th = f.thread ? THREADS[String(f.thread).toUpperCase()] : null;
    if (f.thread && !th) throw new FeatureError(`Filetage inconnu « ${f.thread} ». Tailles : ${Object.keys(THREADS).join(", ")}.`, f);
    const d = f.d !== undefined ? pos(f.d, "hole d", f) : (th ? th.tap : null);
    if (!d) throw new FeatureError("hole : diamètre « d » manquant.", f);
    const span = bb[3 + F.axis] - bb[F.axis];
    const through = f.depth === undefined || f.depth === "through" || f.depth === "traversant";
    const depth = through ? span + 1 : pos(f.depth, "hole depth", f);
    const dirIn = v3.neg(F.n), over = 0.2, tools = [];
    const pts = positions(f.at, f);
    for (const p of pts) {
      const o = facePoint(face, p, level), top = v3.add(o, v3.mul(F.n, over));
      tools.push(K.cylinder(top, dirIn, d / 2, depth + over));
      if (f.cbore) tools.push(K.cylinder(top, dirIn, pos(f.cbore.d, "cbore d", f) / 2, pos(f.cbore.depth, "cbore depth", f) + over));
      if (f.csink) {
        const D = pos(f.csink.d, "csink d", f), ang = (f.csink.angle || 90) * Math.PI / 180, hc = (D - d) / 2 / Math.tan(ang / 2);
        if (hc > 1e-3) tools.push(K.cone(v3.add(o, v3.mul(dirIn, hc)), F.n, d / 2, D / 2 + over * Math.tan(ang / 2), hc + over));
      }
      st.facts.holes.push({ d, depth: through ? null : depth, through, face, at: o, axis: dirIn, thread: f.thread || null, cbore: f.cbore || null, csink: f.csink || null,
        source: f.id, iface: f.iface || null, fit: f.fit || null, level });
    }
    apply(K, st, f, tools, "cut");
  },
  pocket(K, st, f) {
    const face = faceKey(f.face || "+Z"), F = FACES[face], body = f.body || st.main, level = faceLevel(K, st, f, face, body);
    const def = f.profile || (f.rect ? { rect: f.rect, r: f.r } : f.circle ? { circle: f.circle } : f.slot ? { slot: f.slot } : null);
    if (!def) throw new FeatureError("pocket : donnez « profile », « rect », « circle » ou « slot ».", f);
    const profile = normalizeProfile(def), bb = bodyBBox(K, st, body) || allBBox(K, st);
    const through = f.depth === "through" || f.depth === "traversant";
    const depth = through ? bb[3 + F.axis] - bb[F.axis] + 1 : pos(f.depth, "pocket depth", f);
    const u = [0, 0, 0], v = [0, 0, 0]; u[F.plane[0]] = 1; v[F.plane[1]] = 1;
    const over = 0.2, o = v3.mul(F.n.map(Math.abs), level + over * F.n[F.axis]);
    const sketch = K.faceOfProfile(profile, { o, u, v });
    apply(K, st, f, K.prism(sketch, v3.mul(F.n, -(depth + over))), "cut");
    st.facts.pockets.push({ ...profileFacts(profile), depth: through ? null : depth, through, face, level, source: f.id, iface: f.iface || null });
  },
  pad(K, st, f) {   // additive counterpart of pocket: a profile raised from a face by h
    const face = faceKey(f.face || "+Z"), F = FACES[face], body = f.body || st.main, level = faceLevel(K, st, f, face, body);
    const def = f.profile || (f.rect ? { rect: f.rect, r: f.r } : f.circle ? { circle: f.circle } : null);
    if (!def) throw new FeatureError("pad : donnez « profile », « rect » ou « circle ».", f);
    const profile = normalizeProfile(def), h = pos(f.h, "pad h", f);
    const u = [0, 0, 0], v = [0, 0, 0]; u[F.plane[0]] = 1; v[F.plane[1]] = 1;
    const sink = 0.05, o = v3.mul(F.n.map(Math.abs), level - sink * F.n[F.axis]);
    let tool = K.prism(K.faceOfProfile(profile, { o, u, v }), v3.mul(F.n, h + sink));
    if (leanOf(f) > 0) tool = K.draft(tool, v3.neg(F.n), leanOf(f) * Math.PI / 180, v3.add(o, v3.mul(F.n, h + sink))).shape;       // drafted : its width kept at the top, wider at its foot
    apply(K, st, f, tool, "add");
    st.facts.extrudes.push({ ...profileFacts(profile), length: h, plane: face, mode: "add", source: f.id, profile });
  },
  slot(K, st, f) {
    const a = f.from, b = f.to;
    if (!a || !b) throw new FeatureError("slot : « from » et « to » requis.", f);
    OPS.pocket(K, st, { ...f, op: "pocket", slot: [a[0], a[1], b[0], b[1], pos(f.w, "slot w", f)], profile: undefined });
  },
  /** Laser marking : a text engraved in a face with the single-stroke font of the tool (cad/stroke_font.js) — each stroke a groove w wide and
      depth deep (square ends, drawn half a width longer : the joints stay full). at : the centre of the text, in the face plane ; dir : the reading direction there,
      as one sees the face from outside (on +Y, reading to the right is toward −X). */
  mark(K, st, f) {
    const face = faceKey(f.face || "+Z"), F = FACES[face], body = f.body || st.main, level = faceLevel(K, st, f, face, body), text = String(f.text ?? "").trim(), bad = unmarkable(text);
    if (!text) throw new FeatureError("mark : « text » est vide.", f);
    if (bad.length) throw new FeatureError(`mark : « ${bad.join(" ")} » ne se marque pas — la police à un trait de l'outil : ${MARK_CHARS}.`, f);
    const h = pos(f.h ?? 2, "mark h", f), w = pos(f.w ?? 0.25, "mark w", f), depth = pos(f.depth ?? 0.05, "mark depth", f), at = (f.at || [0, 0]).map((x, k) => num(x, `mark at[${k}]`, f)), dir = (f.dir || [1, 0]).map((x, k) => num(x, `mark dir[${k}]`, f));
    const u = [0, 0, 0], v = [0, 0, 0]; u[F.plane[0]] = 1; v[F.plane[1]] = 1;
    const over = 0.2, o = v3.mul(F.n.map(Math.abs), level + over * F.n[F.axis]);
    const D = [0, 0, 0]; D[F.plane[0]] = dir[0]; D[F.plane[1]] = dir[1]; const U = v3.cross(F.n, D), up = [U[F.plane[0]], U[F.plane[1]]];      // up, as one sees the face from outside
    const tools = textStrokes(text, { h, at, dir, up }).filter(([a, b, c, d]) => Math.hypot(c - a, d - b) > 1e-6)
      .map(([a, b, c, d]) => { const L = Math.hypot(c - a, d - b), t = [(c - a) / L * w / 2, (d - b) / L * w / 2], q = [-t[1], t[0]];      // a stroke : a bar w wide, w / 2 longer at each end so that the joints stay full (square ends : planar faces, light booleans)
        const poly = [[a - t[0] + q[0], b - t[1] + q[1]], [c + t[0] + q[0], d + t[1] + q[1]], [c + t[0] - q[0], d + t[1] - q[1]], [a - t[0] - q[0], b - t[1] - q[1]]];
        return K.faceOfProfile(normalizeProfile({ poly }), { o, u, v }); });
    const flat = tools.length > 1 ? K.unify(K.fuse(tools[0], tools.slice(1))) : tools[0];      // the strokes joined flat first : one tool, light to cut
    apply(K, st, f, K.prism(flat, v3.mul(F.n, -(depth + over))), "cut");
    (st.facts.marks || (st.facts.marks = [])).push({ text, face, at, h, depth, source: f.id });
  },
  boss(K, st, f) {
    const face = faceKey(f.face || "+Z"), F = FACES[face], body = f.body || st.main, level = faceLevel(K, st, f, face, body);
    const d = pos(f.d, "boss d", f), h = pos(f.h, "boss h", f), sink = 0.05, tools = [], cuts = [], lean = Math.tan(leanOf(f) * Math.PI / 180);
    const tip = f.tip === undefined || f.tip === null ? null : pos(f.tip, "boss tip", f);      // a pointed boss (an embossed projection) : d at the foot, « tip » at the top
    if (tip !== null && tip >= d) throw new FeatureError(`boss : « tip » (${tip}) doit être plus petit que « d » (${d}) — c'est le diamètre du sommet d'un bossage en pointe.`, f);
    for (const p of positions(f.at, f)) {
      const o = facePoint(face, p, level);
      tools.push(tip !== null ? K.cone(v3.sub(o, v3.mul(F.n, sink)), F.n, d / 2 + sink * (d - tip) / (2 * h), tip / 2, h + sink) : lean > 0 ? K.cone(v3.sub(o, v3.mul(F.n, sink)), F.n, d / 2 + (h + sink) * lean, d / 2, h + sink) : K.cylinder(v3.sub(o, v3.mul(F.n, sink)), F.n, d / 2, h + sink));      // drafted : a cone, its diameter kept at the top
      if (f.hole) {
        const th = f.hole.thread ? THREADS[String(f.hole.thread).toUpperCase()] : null;
        const hd = f.hole.d !== undefined ? pos(f.hole.d, "boss hole d", f) : (th ? th.tap : null);
        if (!hd) throw new FeatureError("boss : « hole.d » ou « hole.thread » requis.", f);
        const through = f.hole.depth === "through", hdep = through ? h + 50 : pos(f.hole.depth ?? h, "boss hole depth", f);
        const top = v3.add(o, v3.mul(F.n, h + 0.2));
        cuts.push(K.cylinder(top, v3.neg(F.n), hd / 2, hdep + 0.2));
        st.facts.holes.push({ d: hd, depth: through ? null : hdep, through, face, at: v3.add(o, v3.mul(F.n, h)), axis: v3.neg(F.n), thread: f.hole.thread || null,
          source: f.id, iface: f.iface || null, inBoss: d, insert: !!f.hole.insert });
      }
      st.facts.bosses.push({ d, h, face, at: o, hole: f.hole ? (f.hole.d || null) : null, source: f.id, iface: f.iface || null });
    }
    for (const t of tools) apply(K, st, f, t, "add");
    if (cuts.length) apply(K, st, f, cuts, "cut");
  },
  /** An arched blade standing on a face — a spring bridge lanced and formed in a strip : it leaves the face, rises by h at mid-span and
      comes back, over a span l along « dir » ([x, y] in the plane of the face ; default its first axis), w wide. t : the thickness of
      the blade — the arch is hollow under it when t < h. */
  arch(K, st, f) {
    const face = faceKey(f.face || "+Z"), F = FACES[face], body = f.body || st.main, level = faceLevel(K, st, f, face, body);
    const l = pos(f.l, "arch l", f), w = pos(f.w, "arch w", f), h = pos(f.h, "arch h", f), t = f.t === undefined || f.t === null ? h : pos(f.t, "arch t", f), sink = 0.05;
    if (h >= l / 2) throw new FeatureError(`arch : la flèche (${h}) doit rester sous la moitié de la portée (${l}).`, f);
    const dv = Array.isArray(f.dir) ? [num(f.dir[0], "arch dir[0]", f), num(f.dir[1], "arch dir[1]", f)] : [1, 0], dl = Math.hypot(dv[0], dv[1]);
    if (dl < 1e-9) throw new FeatureError("arch : « dir » est un vecteur [x, y] non nul dans le plan de la face.", f);
    const D = [0, 0, 0]; D[F.plane[0]] = dv[0] / dl; D[F.plane[1]] = dv[1] / dl;
    const Wd = v3.cross(F.n, D), R = (l * l / 4 + h * h) / (2 * h), tools = [];
    for (const p of positions(f.at, f)) {
      const o = facePoint(face, p, level), c = v3.sub(o, v3.mul(F.n, R - h)), half = l / 2 + w + 1, lo = [0, 0, 0], hi = [0, 0, 0];
      for (let a = 0; a < 3; a++) { const along = level + F.n[a] * (h + 1), under = level - F.n[a] * sink; lo[a] = a === F.axis ? Math.min(along, under) : o[a] - half; hi[a] = a === F.axis ? Math.max(along, under) : o[a] + half; }
      let tool = K.common(K.cylinder(v3.sub(c, v3.mul(Wd, w / 2)), Wd, R, w), K.box(lo, hi));
      if (t < h - 1e-6) tool = K.cut(tool, [K.cylinder(v3.sub(c, v3.mul(Wd, w / 2 + 0.5)), Wd, R - t, w + 1)]);       // the blade alone : the daylight under the bridge
      tools.push(tool);
      st.facts.bosses.push({ d: l, h, face, at: o, hole: null, source: f.id, iface: f.iface || null, arch: true });
    }
    for (const tool of tools) apply(K, st, f, tool, "add");
  },
  /** A moulded tub : a rounded box open on +Z, one wall everywhere, with a real draft. The outside and the inside are each a block
      that leans, then gets its corner radii and its floor radius ; one is taken out of the other — no offset surface, so it holds for
      every wall and angle. size [L, W, H] is the outside at the rim ; rc, rf the outside radii of the corners and of the floor. */
  tub(K, st, f) {
    const s = f.size || [], L = pos(s[0], "tub size x", f), W = pos(s[1], "tub size y", f), H = pos(s[2], "tub size z", f), t = pos(f.wall ?? f.t, "tub wall", f), deg = leanOf(f), rc = Math.max(0, num(f.rc ?? 0, "tub rc", f)), rf = Math.max(0, num(f.rf ?? 0, "tub rf", f));
    if (2 * t >= Math.min(L, W) - 1e-6 || t >= H - 1e-6) throw new FeatureError(`tub : une paroi de ${t} mm ne tient pas dans ${L} × ${W} × ${H} mm.`, f);
    if (rc > Math.min(L, W) / 2 - 1e-6) throw new FeatureError(`tub : rayon des angles ${rc} mm trop grand pour ${L} × ${W} mm.`, f);
    const block = (min, max, r1, r2) => { let b = K.box(min, max); if (deg > 0) b = K.draft(b, [0, 0, 1], deg * Math.PI / 180, [0, 0, H]).shape;
      if (r1 > 0.05) b = K.fillet(b, selectEdges(K, b, { dir: "Z" }, f).map((e) => e.edge), r1); if (r2 > 0.05) b = K.fillet(b, selectEdges(K, b, { face: "-Z" }, f).map((e) => e.edge), r2); return b; };
    apply(K, st, f, K.cut(block([0, 0, 0], [L, W, H], rc, rf), [block([t, t, t], [L - t, W - t, H + 1], rc - t, rf - t)]), "add");
    st.facts.shells.push({ t, open: ["+Z"], source: f.id, tub: true });
    if (rc > 0.05) st.facts.fillets.push({ size: rc - t, n: 4, source: f.id, inner: true }); if (rf > 0.05) st.facts.fillets.push({ size: rf - t, n: 4, source: f.id, inner: true });
    if (deg > 0) st.facts.drafts.push({ angle: deg, pull: "+Z", source: f.id, what: "parois" });
  },
  /** Draft on what is there : the faces of the body that run along the pull lean about a neutral plane (default : its far end along the pull). */
  draft(K, st, f) {
    const name = f.body || st.main, s = st.bodies.get(name), face = faceKey(f.pull || "+Z"), F = FACES[face], deg = pos(f.angle, "draft angle", f);
    if (!s) throw new FeatureError("draft : aucun volume à dépouiller.", f);
    const bb = K.bbox(s), at = f.neutral !== undefined ? num(f.neutral, "draft neutral", f) : (F.n[F.axis] > 0 ? bb[3 + F.axis] : bb[F.axis]), o = [0, 0, 0]; o[F.axis] = at;
    try { st.bodies.set(name, K.draft(s, F.n, deg * Math.PI / 180, o).shape); } catch (e) { throw new FeatureError(`${e.message} Correctif : dépouiller la forme avant ses congés, ou utiliser « tub », « boss » et « pad » avec leur « draft ».`, f); }
    st.facts.drafts.push({ angle: deg, pull: face, source: f.id, what: "corps" });
  },
  fillet(K, st, f) { dressUp(K, st, f, "fillet"); },
  chamfer(K, st, f) { dressUp(K, st, f, "chamfer"); },
  shell(K, st, f) {
    const name = f.body || st.main, s = st.bodies.get(name);
    if (!s) throw new FeatureError("shell : aucun volume à creuser.", f);
    const t = pos(f.t, "shell t", f), bb = K.bbox(s), open = [].concat(f.open || ["+Z"]).map(faceKey);
    const faces = K.facesInfo(s).filter((fi) => fi.type === "plane" && open.some((k) => {
      const F = FACES[k], lv = F.n[F.axis] > 0 ? bb[3 + F.axis] : bb[F.axis];
      return v3.dot(fi.n, F.n) > 0.999 && Math.abs(fi.c[F.axis] - lv) < 1e-3;
    })).map((fi) => fi.face);
    if (!faces.length) throw new FeatureError(`shell : aucune face plane trouvée sur ${open.join(", ")} pour ouvrir la coque.`, f);
    st.bodies.set(name, K.shell(s, faces, t));
    st.facts.shells.push({ t, open, source: f.id });
  },
};

/** Select edges of a body: "all", "vertical", or {dir, face, level, box, near, tol, type, r, len_min, len_max}. */
export function selectEdges(K, shape, sel, f) {
  if (Array.isArray(sel)) {                                     // several selections : their union (edges picked one by one in the view)
    const seen = new Set(), out = [];
    for (const one of sel) for (const e of selectEdges(K, shape, one, f)) { const k = e.mid.map((x) => x.toFixed(4)).join(","); if (!seen.has(k)) { seen.add(k); out.push(e); } }
    return out;
  }
  const bb = K.bbox(shape);
  // Seams of cylinders and tangent lines of existing fillets are smooth, not edges to dress up: leave them out.
  const cyl = K.facesInfo(shape).filter((fi) => fi.type === "cylinder");
  const smooth = (e) => e.type === "line" && cyl.some((c) => {
    if (Math.abs(Math.abs(v3.dot(e.dir, c.axis)) - 1) > 1e-6) return false;
    const w = v3.sub(e.mid, c.o), radial = v3.sub(w, v3.mul(c.axis, v3.dot(w, c.axis)));
    return Math.abs(v3.len(radial) - c.r) < 1e-4;
  });
  const all = K.edgesInfo(shape).filter((e) => (sel && sel.smooth) || !smooth(e));
  if (sel === undefined || sel === null || sel === "all") return all;
  if (typeof sel === "string") {
    const k = sel.toLowerCase();
    if (k === "vertical" || k === "verticales") sel = { dir: "Z" };
    else if (k === "horizontal") return all.filter((e) => e.type !== "line" || Math.abs(e.dir[2]) < 1e-3);
    else if (["top", "bottom", "front", "back", "left", "right", "+z", "-z", "+x", "-x", "+y", "-y"].includes(k)) sel = { face: sel };
    else throw new FeatureError(`Sélection d'arêtes inconnue « ${sel} ». Formes : "all", "vertical", {dir:"Z"}, {face:"+Z"}, {box:[...]}, {near:[x,y,z]}.`, f);
  }
  return all.filter((e) => {
    if (sel.dir) { const a = axisOf(sel.dir, f); if (e.type !== "line" || Math.abs(Math.abs(v3.dot(e.dir, a)) - 1) > 4e-3) return false; }      // within 5° : the corners of a drafted block lean by its draft
    if (sel.face) {
      const F = FACES[faceKey(sel.face)], lv = sel.level !== undefined ? sel.level : (F.n[F.axis] > 0 ? bb[3 + F.axis] : bb[F.axis]);
      if ([e.p0, e.p1, e.mid].some((p) => Math.abs(p[F.axis] - lv) > 1e-3)) return false;
    }
    if (sel.box) { const b = sel.box; if (e.mid.some((x, i) => x < b[i] - 1e-6 || x > b[3 + i] + 1e-6)) return false; }
    if (sel.near && v3.dist(e.mid, sel.near) > (sel.tol || 1)) return false;
    if (sel.type && e.type !== sel.type) return false;
    if (sel.r !== undefined && (e.type !== "circle" || Math.abs(e.r - sel.r) > 1e-3)) return false;
    if (sel.len_min !== undefined && (e.len || 0) < sel.len_min) return false;
    if (sel.len_max !== undefined && (e.len || 0) > sel.len_max) return false;
    return true;
  });
}

function dressUp(K, st, f, kind) {
  const name = f.body || st.main;
  let s = st.bodies.get(name);
  if (!s) throw new FeatureError(`${kind} : aucun volume.`, f);
  const size = kind === "fillet" ? pos(f.r, "fillet r", f) : pos(f.d ?? f.c, "chamfer d", f);
  s = K.unify(s);
  const edges = selectEdges(K, s, f.edges, f);
  if (!edges.length) { st.log.push({ level: "warn", feature: f.id, msg: `${kind} « ${f.id || ""} » : aucune arête ne correspond à la sélection ${JSON.stringify(f.edges ?? "all")}.` }); return; }
  const run = (shape, list) => {
    const out = kind === "fillet" ? K.fillet(shape, list, size) : K.chamfer(shape, list, size);
    if (!K.isValid(out)) throw new KernelError("résultat invalide");
    return out;
  };
  const label = kind === "fillet" ? "Congé R" : "Chanfrein ";
  let done = 0;
  try {
    s = run(s, edges.map((e) => e.edge));
    done = edges.length;
  } catch (e) {
    // The whole selection does not build: dress the edges one by one and keep what the kernel accepts.
    const mids = edges.map((x) => x.mid);
    for (const mid of mids) {
      const cur = K.edgesInfo(s).find((x) => v3.dist(x.mid, mid) < 1e-4);
      if (!cur) continue;
      try { s = run(s, [cur.edge]); done++; } catch (e2) { /* this edge stays sharp */ }
    }
    if (done < edges.length) st.log.push({ level: "warn", feature: f.id, msg: `${label}${size} : ${edges.length - done} arête(s) sur ${edges.length} restent vives (le noyau refuse cette valeur à cet endroit). Correctif : réduisez la valeur ou précisez la sélection « edges ».` });
  }
  if (done) {
    st.bodies.set(name, s);
    st.facts[kind === "fillet" ? "fillets" : "chamfers"].push({ size, count: done, source: f.id });
  }
}

export function newState() {
  return { bodies: new Map(), order: [], log: [], main: "main", facts: { holes: [], pockets: [], bosses: [], fillets: [], chamfers: [], shells: [], extrudes: [], revolves: [], drafts: [] } };
}

/** The words of a failure : an exception of the kernel itself carries no message (a number, or an abort) — it is said as such. */
export const whyOf = (e) => (e && e.message ? e.message : typeof e === "number" ? "le noyau CAO a refusé cette géométrie (erreur interne)" : String(e));

/** Run a list of evaluated features on the state. A failing feature is reported and skipped (the part still builds). */
export function runFeatures(K, st, features, strict = false) {
  for (const f of features || []) {
    if (!f || f.suppressed) continue;
    if (f.when !== undefined && !f.when) continue;
    const op = OPS[f.op];
    try {
      if (!op) throw new FeatureError(`Opération inconnue « ${f.op} ». Opérations : ${Object.keys(OPS).join(", ")}.`, f);
      op(K, st, f);
    } catch (e) {
      if (strict) throw e;
      st.log.push({ level: "error", feature: f.id, op: f.op, msg: `Feature « ${f.id || f.op} » : ${whyOf(e)}` });
    }
  }
  return st;
}
export const FEATURE_OPS = Object.keys(OPS);
