/* DesignWizard.ai — DFM / DFA / DFx core: the Finding type, declarative auto-fix patches ("spell-checker for CAD"),
   the score of a list of findings and a mesh wall-thickness probe. No kernel, no DOM: runs in the browser and in Node.

   Finding = {
     id: "CNC-03", severity: "error" | "warn" | "info", category: "DFM" | "DFA" | "DFx", process, title, message,
     value, limit, unit, where: [x,y,z] | null (3D marker, part coordinates), feature: string | null, iface: string | null,
     source: string (reference of the rule),
     fix: null | { label: "Passer à Ø3,3 (foret standard)",
                   patch: [ { target: "param" | "feature" | "interface" | "spec", id: "f3" | "IF1" | "L" | null, path: "d" | "params.screw" | "opts.depth" | "material", value, part? } ] }
   }
   A patch never contains code: it is applied by applyPatch() and the part is simply rebuilt. */

export const SEVERITIES = ["error", "warn", "info"];
const RANK = { error: 0, warn: 1, info: 2 };

/** French number formatting: 3.3 -> "3,3" (at most `digits` decimals). */
export function num(x, digits = 2) {
  if (x === null || x === undefined || !Number.isFinite(+x)) return "?";
  const p = 10 ** digits;
  return String(Math.round(+x * p) / p).replace(".", ",");
}
export const round = (x, digits = 2) => { const p = 10 ** digits; return Math.round(x * p) / p; };

/** One rule of the printable rule book. flags: {fix: true (auto-fix exists), manual: true (not checked automatically), category}. */
export function rule(id, title, limit, severity, why, source, flags = {}) {
  return { id, title, limit, severity, why, source, ...flags };
}

const clean = (v) => (v === undefined || v === null ? null : typeof v === "number" ? (Number.isFinite(v) ? round(v, 4) : null) : v);   // no float noise in value / limit
/** Normalise a finding (every field present, so the UI never tests for undefined). */
export function makeFinding(o) {
  return { id: o.id, severity: RANK[o.severity] === undefined ? "info" : o.severity, category: o.category || "DFM", process: o.process || null,
    title: o.title || o.id, message: o.message || "", value: clean(o.value), limit: clean(o.limit), unit: o.unit || "",
    where: Array.isArray(o.where) && o.where.length === 3 && o.where.every(Number.isFinite) ? o.where.map((v) => round(v, 3)) : null,
    feature: o.feature ?? null, iface: o.iface ?? null, source: o.source || "", fix: o.fix && Array.isArray(o.fix.patch) && o.fix.patch.length ? o.fix : null };
}

/** Deterministic order: errors, then warnings, then infos; inside a level by rule id, feature, interface, message. */
export function sortFindings(list) {
  const key = (f) => [f.id, f.feature || "", f.iface || "", f.message];
  return list.slice().sort((a, b) => {
    if (RANK[a.severity] !== RANK[b.severity]) return RANK[a.severity] - RANK[b.severity];
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });
}

/* Score of a list of findings. It starts at 100; each error costs 20 points, each warning 5 and each info 1
   (the infos together never cost more than 10); the result is floored at 0.
   status: "fail" as soon as there is one error, "review" when only warnings remain, "pass" otherwise. */
export function summarize(findings) {
  let errors = 0, warnings = 0, infos = 0;
  for (const f of findings || []) { if (f.severity === "error") errors++; else if (f.severity === "warn") warnings++; else infos++; }
  const score = Math.max(0, Math.round(100 - 20 * errors - 5 * warnings - Math.min(10, infos)));
  return { errors, warnings, infos, score, status: errors ? "fail" : warnings ? "review" : "pass" };
}

/* ---------- declarative patches ---------- */
const segs = (path) => String(path ?? "").split(".").filter((s) => s !== "");
export function getPath(obj, path) {
  let cur = obj;
  for (const s of segs(path)) { if (cur === null || typeof cur !== "object") return undefined; cur = cur[s]; }
  return cur;
}
export function setPath(obj, path, value) {
  const ss = segs(path);
  if (!ss.length) throw new Error("applyPatch : chemin (path) vide.");
  let cur = obj;
  for (let i = 0; i < ss.length - 1; i++) {
    if (cur[ss[i]] === null || typeof cur[ss[i]] !== "object") cur[ss[i]] = /^\d+$/.test(ss[i + 1]) ? [] : {};
    cur = cur[ss[i]];
  }
  const last = ss[ss.length - 1];
  if (value === undefined) delete cur[last]; else cur[last] = value;
  return obj;
}

const BARE = /^[A-Za-z_][A-Za-z0-9_]*$/;
function setParam(spec, name, value) {
  spec.params = spec.params || {};
  const p = spec.params[name];
  if (p !== null && typeof p === "object") {
    delete p.expr;                                             // a derived parameter becomes a plain value
    p.value = value;
    if (typeof value === "number") {                           // keep the slider range consistent with the fix
      if (typeof p.min === "number" && value < p.min) p.min = value;
      if (typeof p.max === "number" && value > p.max) p.max = value;
    }
  } else spec.params[name] = value;
}
/* A field that holds a bare parameter name ("r_corner") is fixed at its source: the parameter. Any other expression
   ("L/2 - 10") is replaced by the number. Non-numeric values ("through", "insert") always replace the field. */
function setField(spec, holder, path, value) {
  const cur = getPath(holder, path), name = typeof cur === "string" ? cur.trim() : null;
  if (typeof value === "number" && name && BARE.test(name) && spec.params && Object.prototype.hasOwnProperty.call(spec.params, name)) setParam(spec, name, value);
  else setPath(holder, path, value);
}
function findById(list, id, prefix) {
  if (!Array.isArray(list)) return null;
  const hit = list.find((x) => x && x.id === id);
  if (hit) return hit;
  const m = new RegExp(`^${prefix}(\\d+)$`).exec(String(id));   // implicit ids: "f3" = third feature, "IF2" = second interface
  const cand = m ? list[+m[1] - 1] : null;
  return cand && !cand.id ? cand : null;
}

/** Apply a declarative patch to a part spec. Returns a NEW spec (deep copy); the input is left untouched.
    Entries: {target: "param", id: "L", value} · {target: "feature", id: "f3", path: "d", value} ·
    {target: "interface", id: "IF1", path: "opts.depth", value} · {target: "spec", path: "material", value}.
    An extra `part` field (assembly fixes) names the part to patch: entries for another part are skipped when the
    spec carries a different id. */
export function applyPatch(spec, patch) {
  const out = JSON.parse(JSON.stringify(spec || {}));
  for (const op of Array.isArray(patch) ? patch : (patch && patch.patch) || []) {
    if (!op || (op.part && out.id && op.part !== out.id)) continue;
    if (op.target === "param") {
      if (!op.id) throw new Error("applyPatch : « id » du paramètre manquant.");
      if (op.path && op.path !== "value") { out.params = out.params || {}; if (out.params[op.id] === null || typeof out.params[op.id] !== "object") out.params[op.id] = { value: out.params[op.id] }; setPath(out.params[op.id], op.path, op.value); }
      else setParam(out, op.id, op.value);
    } else if (op.target === "feature") {
      const f = findById(out.features, op.id, "f");
      if (!f) throw new Error(`applyPatch : feature « ${op.id} » introuvable.`);
      setField(out, f, op.path, op.value);
    } else if (op.target === "interface") {
      const it = findById(out.interfaces, op.id, "IF");
      if (!it) throw new Error(`applyPatch : interface « ${op.id} » introuvable.`);
      setField(out, it, op.path, op.value);
    } else if (op.target === "spec") setField(out, out, op.path, op.value);
    else throw new Error(`applyPatch : cible inconnue « ${op.target} » (param, feature, interface, spec).`);
  }
  return out;
}

/* ---------- mesh wall thickness ---------- */
/* Bounding-volume hierarchy over the triangles (median split), flat arrays. */
function buildBVH(pos, idx) {
  const nt = idx.length / 3, order = new Uint32Array(nt), cen = new Float64Array(nt * 3), tb = new Float64Array(nt * 6);
  for (let t = 0; t < nt; t++) {
    order[t] = t;
    for (let k = 0; k < 3; k++) {
      const a = pos[idx[t * 3] * 3 + k], b = pos[idx[t * 3 + 1] * 3 + k], c = pos[idx[t * 3 + 2] * 3 + k];
      cen[t * 3 + k] = (a + b + c) / 3; tb[t * 6 + k] = Math.min(a, b, c); tb[t * 6 + 3 + k] = Math.max(a, b, c);
    }
  }
  const nodes = [];                                            // {b: [6], l, r} or leaf {b, s, n}
  const make = (s, n) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], cb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = s; i < s + n; i++) { const t = order[i]; for (let k = 0; k < 3; k++) {
      if (tb[t * 6 + k] < b[k]) b[k] = tb[t * 6 + k]; if (tb[t * 6 + 3 + k] > b[3 + k]) b[3 + k] = tb[t * 6 + 3 + k];
      if (cen[t * 3 + k] < cb[k]) cb[k] = cen[t * 3 + k]; if (cen[t * 3 + k] > cb[3 + k]) cb[3 + k] = cen[t * 3 + k]; } }
    const node = { b, s, n, l: -1, r: -1 }, at = nodes.push(node) - 1;
    if (n > 4) {
      let ax = 0; for (let k = 1; k < 3; k++) if (cb[3 + k] - cb[k] > cb[3 + ax] - cb[ax]) ax = k;
      if (cb[3 + ax] - cb[ax] > 1e-12) {
        const sub = Array.from(order.subarray(s, s + n)).sort((p, q) => cen[p * 3 + ax] - cen[q * 3 + ax]);
        order.set(sub, s);
        const half = n >> 1;
        node.l = make(s, half); node.r = make(s + half, n - half);
      }
    }
    return at;
  };
  if (nt) make(0, nt);
  return { nodes, order };
}

/** Wall thickness of a closed triangle mesh {pos, idx}: a ray is cast from the centroid of each (sampled) triangle along
    the inward normal to the first hit on the same mesh (hits closer than opts.eps = 1e-3 are ignored). Large triangles
    are split so that flat faces are sampled too; at most opts.maxRays (1500) rays. A hit on a surface that is far from
    parallel to the source (|cos| < opts.minCos = 0.7, i.e. more than 45°) is a wedge, not a wall, and is left out.
    Returns { min, p10, median, p90, max, at: [x,y,z] of the thinnest spot, rays } (area-weighted percentiles; null without hit). */
export function meshWallThickness(mesh, opts = {}) {
  const none = { min: null, p10: null, median: null, p90: null, max: null, at: null, rays: 0 };
  if (!mesh || !mesh.pos || !mesh.idx || mesh.idx.length < 12) return none;
  const pos = mesh.pos, idx = mesh.idx, nt = Math.floor(idx.length / 3);
  const maxRays = opts.maxRays || 1500, eps = opts.eps ?? 1e-3, minCos = opts.minCos ?? 0.7;
  const P = (t, c) => [pos[idx[t * 3 + c] * 3], pos[idx[t * 3 + c] * 3 + 1], pos[idx[t * 3 + c] * 3 + 2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = new Float64Array(nt * 3), area = new Float64Array(nt);
  let total = 0;
  for (let t = 0; t < nt; t++) {
    const n = cross(sub(P(t, 1), P(t, 0)), sub(P(t, 2), P(t, 0))), l = Math.hypot(n[0], n[1], n[2]);
    area[t] = l / 2; total += area[t];
    if (l > 1e-14) { nrm[t * 3] = n[0] / l; nrm[t * 3 + 1] = n[1] / l; nrm[t * 3 + 2] = n[2] / l; }
  }
  if (!(total > 0)) return none;
  // samples: centroid of every triangle; triangles larger than one "cell" are split 4^k times (k <= 3)
  const cell = total / (maxRays * 0.5), samples = [];
  const split = (a, b, c, k, t, w) => {
    if (k === 0) { samples.push({ t, w, o: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] }); return; }
    const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2], ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2];
    split(a, ab, ca, k - 1, t, w / 4); split(ab, b, bc, k - 1, t, w / 4); split(ca, bc, c, k - 1, t, w / 4); split(ab, bc, ca, k - 1, t, w / 4);
  };
  for (let t = 0; t < nt; t++) {
    if (area[t] < 1e-12) continue;
    const k = area[t] > cell ? Math.min(3, Math.ceil(Math.log(area[t] / cell) / Math.log(4))) : 0;
    split(P(t, 0), P(t, 1), P(t, 2), k, t, area[t]);
  }
  const step = Math.max(1, Math.ceil(samples.length / maxRays));
  const { nodes, order } = buildBVH(pos, idx), stack = new Int32Array(128), hits = [];
  /** First hit of a ray from o along d, the triangle `skip` left out. → [distance, triangle] ([Infinity, -1] : none) */
  const cast = (o, d, skip) => {
    const inv = d.map((v) => (Math.abs(v) > 1e-12 ? 1 / v : (v >= 0 ? 1e12 : -1e12)));
    let best = Infinity, bestTri = -1, sp = 0;
    stack[sp++] = 0;
    while (sp) {
      const node = nodes[stack[--sp]], b = node.b;
      let t0 = eps, t1 = best, miss = false;
      for (let k = 0; k < 3 && !miss; k++) {
        let lo = (b[k] - o[k]) * inv[k], hi = (b[3 + k] - o[k]) * inv[k];
        if (lo > hi) { const sw = lo; lo = hi; hi = sw; }
        if (lo > t0) t0 = lo; if (hi < t1) t1 = hi;
        if (t0 > t1 + 1e-9) miss = true;
      }
      if (miss) continue;
      if (node.l >= 0) { stack[sp++] = node.l; stack[sp++] = node.r; continue; }
      for (let i = node.s; i < node.s + node.n; i++) {          // Möller–Trumbore, two-sided
        const t = order[i];
        if (t === skip) continue;
        const a = P(t, 0), e1 = sub(P(t, 1), a), e2 = sub(P(t, 2), a), h = cross(d, e2), det = dot(e1, h);
        if (Math.abs(det) < 1e-14) continue;
        const f = 1 / det, sv = sub(o, a), u = f * dot(sv, h);
        if (u < -1e-9 || u > 1 + 1e-9) continue;
        const q = cross(sv, e1), v = f * dot(d, q);
        if (v < -1e-9 || u + v > 1 + 1e-9) continue;
        const dist = f * dot(e2, q);
        if (dist > eps && dist < best) { best = dist; bestTri = t; }
      }
    }
    return [best, bestTri];
  };
  for (let s = Math.floor(step / 2); s < samples.length; s += step) {
    const sm = samples[s], d = [-nrm[sm.t * 3], -nrm[sm.t * 3 + 1], -nrm[sm.t * 3 + 2]], o = sm.o, [best, bestTri] = cast(o, d, sm.t);
    if (bestTri < 0) continue;
    const cos = Math.abs(d[0] * nrm[bestTri * 3] + d[1] * nrm[bestTri * 3 + 1] + d[2] * nrm[bestTri * 3 + 2]);
    if (cos < minCos) continue;
    hits.push({ d: best, w: sm.w, o, dir: d });
  }
  if (!hits.length) return none;
  hits.sort((a, b) => a.d - b.d);
  /* A spot that looks thick is measured again across : from the middle of its ray, the extent of the material in the two directions
     square to it. A ray that runs up a rib, or down a wall from its rim, crosses a thin section — a mass is thick every way. */
  if (opts.across !== false) {
    const mid = hits[Math.floor(hits.length / 2)].d;
    for (const h of hits) {
      if (h.d <= 1.5 * mid) continue;
      const d = h.dir, c = [h.o[0] + d[0] * h.d / 2, h.o[1] + d[1] * h.d / 2, h.o[2] + d[2] * h.d / 2], k = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])], ax = k[0] <= k[1] && k[0] <= k[2] ? [1, 0, 0] : k[1] <= k[2] ? [0, 1, 0] : [0, 0, 1];
      let u = cross(d, ax); const lu = Math.hypot(u[0], u[1], u[2]) || 1; u = [u[0] / lu, u[1] / lu, u[2] / lu]; const v = cross(d, u);
      for (const q of [u, v]) { const a1 = cast(c, q, -1)[0], a2 = cast(c, [-q[0], -q[1], -q[2]], -1)[0]; if (Number.isFinite(a1) && Number.isFinite(a2) && a1 + a2 < h.d) h.d = a1 + a2; }
    }
    hits.sort((a, b) => a.d - b.d);
  }
  const wsum = hits.reduce((s, h) => s + h.w, 0);
  const pct = (p) => { let acc = 0; for (const h of hits) { acc += h.w; if (acc >= wsum * p - 1e-12) return h.d; } return hits[hits.length - 1].d; };
  const first = hits[0];
  return { min: first.d, p10: pct(0.1), median: pct(0.5), p90: pct(0.9), max: hits[hits.length - 1].d,
    at: [first.o[0] - 0, first.o[1] - 0, first.o[2] - 0], rays: hits.length };
}

/* ---------- small geometry helpers shared by the rule modules ---------- */
/** Distance from `at` along the unit direction `axis` to the exit of the box bbox = [x0,y0,z0,x1,y1,z1] (null if none). */
export function exitDistance(at, axis, bbox) {
  if (!at || !axis || !bbox) return null;
  let best = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(axis[k]) < 1e-9) continue;
    const t = ((axis[k] > 0 ? bbox[3 + k] : bbox[k]) - at[k]) / axis[k];
    if (t < best) best = t;
  }
  return Number.isFinite(best) ? best : null;
}
/** Smallest distance from `at` to the sides of the bbox, measured in the plane normal to `axis` (hole axis / face normal). */
export function edgeDistance(at, axis, bbox) {
  if (!at || !axis || !bbox) return null;
  let main = 0, best = Infinity;
  for (let k = 1; k < 3; k++) if (Math.abs(axis[k]) > Math.abs(axis[main])) main = k;
  for (let k = 0; k < 3; k++) if (k !== main) best = Math.min(best, at[k] - bbox[k], bbox[3 + k] - at[k]);
  return Number.isFinite(best) ? best : null;
}
/** Group a list by a string key, keeping the order of first appearance. */
export function groupBy(list, keyOf) {
  const map = new Map();
  for (const x of list || []) { const k = keyOf(x); if (!map.has(k)) map.set(k, []); map.get(k).push(x); }
  return [...map.values()];
}
