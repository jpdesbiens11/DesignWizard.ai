/* DynamiteOrbit.ai — FeatureScript export (see featurescript.js), generator: the state of one generation (lines of code,
   bodies, sketches, helpers used, warnings) and the emitters shared by features and interfaces: booleans on the tracked
   bodies, face levels, lists of points (positions and patterns become FeatureScript arrays filled by loops), profiles
   drawn as sketch entities. */

import { evaluate, identifiers, evalDeep } from "./expr.js";
import { normalizeProfile } from "./profile.js";
import { Skip, P_ATOM, P_MUL, wrap, fnum, parseExpr, printAst, K, V, isSym, add, mul, div, maxS, roundS, mm, vecMm, dirFs, created, pos } from "./fs_expr.js";
import { fsString } from "./fs_helpers.js";

const AX = ["X", "Y", "Z"];
/* Sketch frame for each normal axis: the sketch (x, y) are the two model axes of the plane, in the order of the part
   language ([y, z] for X, [x, z] for Y, [x, y] for Z); the plane normal is x × y. */
const SK_FRAME = [{ n: [1, 0, 0], x: [0, 1, 0] }, { n: [0, -1, 0], x: [1, 0, 0] }, { n: [0, 0, 1], x: [1, 0, 0] }];
const onFace = (F, u, v, w) => { const p = [null, null, null]; p[F.plane[0]] = u; p[F.plane[1]] = v; p[F.axis] = w; return p; };

function makeGen(scope, rename) {
  return {
    scope, rename, lines: [], depth: 2, n: 0, nb: 0, bodies: new Map(), main: "main", sketches: [], helpers: new Set(), warnings: [],
    emit(s) { this.lines.push(s ? "    ".repeat(this.depth) + s : ""); },
    open() { this.emit("{"); this.depth++; },
    close() { this.depth--; this.emit("}"); },
    /** fn(context, id + "...", { fields }) on several lines. */
    call(fn, idExpr, fields) {
      this.emit(`${fn}(context, ${idExpr}, {`);
      fields.forEach(([k, v], i) => this.lines.push("    ".repeat(this.depth + 2) + `"${k}" : ${v}${i < fields.length - 1 ? "," : ""}`));
      this.emit("});");
    },
    next() { return ++this.n; },
    warn(msg) { if (!this.warnings.includes(msg)) this.warnings.push(msg); },
    use(h) { this.helpers.add(h); },
    bodyQ(name) {
      const k = name || this.main, q = this.bodies.get(k);
      if (!q) throw new Skip(`le corps « ${k} » n'existe pas encore (aucun volume à modifier)`);
      return q;
    },
    /** Symbolic value of a raw field of the spec (number, expression) — or of a value that is already symbolic. */
    S(raw, what = "valeur") {
      if (isSym(raw)) return raw;
      if (typeof raw === "number") { if (!Number.isFinite(raw)) throw new Skip(`${what} : nombre non fini`); return K(raw); }
      if (typeof raw === "boolean") return K(raw ? 1 : 0);
      if (typeof raw !== "string") throw new Skip(`${what} : nombre ou expression attendu${raw === undefined || raw === null ? " (champ manquant)" : `, reçu ${JSON.stringify(raw)}`}`);
      const v = evaluate(raw, this.scope);
      if (!identifiers(raw).length) return K(v);
      const r = printAst(parseExpr(raw), this.rename), n = r.bool ? { fs: `(${r.fs} ? 1 : 0)`, prec: P_ATOM } : r;
      return { fs: n.fs, prec: n.prec, v, c: false };
    },
    /** Numeric value today (decisions taken at generation time). */
    num(raw) { return isSym(raw) ? raw.v : typeof raw === "boolean" ? (raw ? 1 : 0) : evaluate(raw, this.scope); },
    truthy(raw) {
      if (raw === undefined || raw === null || raw === false || raw === "") return false;
      if (isSym(raw)) return raw.v !== 0;
      if (typeof raw === "number") return raw !== 0;
      if (typeof raw === "string") { try { return evaluate(raw, this.scope) !== 0; } catch (e) { return true; } }
      return true;
    },
    /** Numeric value that the generated script will NOT recompute: warn when it depends on parameters. */
    frozen(raw, what) {
      const v = this.num(raw);
      if (typeof raw === "string" && identifiers(raw).length) this.warn(`${what} dépend de paramètres (« ${raw} ») : valeur figée à la génération (${fnum(v)}), elle ne suivra pas les paramètres dans Onshape.`);
      return v;
    },
    /** Integer count (pattern): constant, or round(...) of the expression. */
    count(raw, dflt, floor = 1) {
      const s = this.S(this.truthy(raw) ? raw : dflt, "nombre d'éléments");
      return s.c ? K(Math.max(floor, Math.round(s.v))) : maxS(K(floor), roundS(s));
    },
    /** New sketch on the plane normal to `axis` at `level` along it. */
    sketch(N, axis, level) {
      const fr = SK_FRAME[axis], o = [K(0), K(0), K(0)];
      o[axis] = level;
      this.emit(`const dwSketch${N} = newSketchOnPlane(context, id + "sketch${N}", {`);
      this.lines.push("    ".repeat(this.depth + 2) + `"sketchPlane" : plane(${vecMm(o)}, ${dirFs(fr.n)}, ${dirFs(fr.x)})`);
      this.emit("});");
      this.sketches.push(`id + "sketch${N}"`);
      return { v: `dwSketch${N}`, id: `id + "sketch${N}"` };
    },
    snapshot() { return { lines: this.lines.length, depth: this.depth, nb: this.nb, bodies: new Map(this.bodies), sketches: this.sketches.length, helpers: new Set(this.helpers), warnings: this.warnings.length, main: this.main }; },
    restore(s) { this.lines.length = s.lines; this.depth = s.depth; this.nb = s.nb; this.bodies = s.bodies; this.sketches.length = s.sketches; this.helpers = s.helpers; this.warnings.length = s.warnings; this.main = s.main; },
  };
}

/** Add / cut / intersect the bodies of query `tool` with the target body of the feature (as features.js `apply`). */
function apply(G, f, tool, N, mode, guard) {
  const name = f.body || G.main;
  mode = mode || f.mode || "add";
  const boolean = (opName, fields) => {
    if (guard) { G.emit(`if (size(${guard}) > 0)`); G.open(); }
    G.call("opBoolean", `id + "${opName}${N}"`, fields);
    if (guard) G.close();
  };
  if (mode === "add" || mode === "new") {
    const cur = G.bodies.get(name);
    if (!cur) {                                                  // first solid of that body: keep a query on it
      const v = name === G.main ? "dwMain" : `dwBody${++G.nb}`;
      G.emit(`const ${v} = ${tool};`);
      G.bodies.set(name, v);
      return;
    }
    boolean("union", [["tools", `qUnion([${cur}, ${tool}])`], ["operationType", "BooleanOperationType.UNION"]]);
  } else if (mode === "cut") {
    let targets;
    if (f.bodies === "all") {
      if (!G.bodies.size) throw new Skip("aucun volume à couper");
      const all = [...G.bodies.values()];
      targets = all.length === 1 ? all[0] : `qUnion([${all.join(", ")}])`;
    } else targets = G.bodyQ(name);
    boolean("cut", [["tools", tool], ["targets", targets], ["operationType", "BooleanOperationType.SUBTRACTION"]]);
  } else if (mode === "intersect") {
    boolean("intersect", [["tools", `qUnion([${G.bodyQ(name)}, ${tool}])`], ["operationType", "BooleanOperationType.INTERSECTION"]]);
  } else throw new Skip(`mode inconnu « ${mode} » (add, cut, intersect)`);
}

/** Level of a face along its axis: explicit `start`, else the outside of the body, measured in Onshape. */
function levelSym(G, N, start, F, bodyName) {
  if (start !== undefined && start !== null) {
    const s = G.S(start, "start");
    if (s.c || s.prec >= P_ATOM) return s;
    G.emit(`const dwLv${N} = ${s.fs};`);
    return V(`dwLv${N}`, s.v);
  }
  const body = G.bodyQ(bodyName);
  G.use("box");
  G.emit(`const dwLv${N} = dwLevel(context, ${body}, ${F.axis}, ${F.n[F.axis] > 0});`);
  return V(`dwLv${N}`);
}
function throughDepth(G, N, F, body) {
  G.use("box");
  G.emit(`const dwDepth${N} = dwSpan(context, ${body}, ${F.axis}) + 1;`);
  return V(`dwDepth${N}`);
}

/* ---------- point lists (positions and patterns become FeatureScript arrays filled by loops) ---------- */

function ptsList(G, N, pts) {
  G.emit(`const dwPts${N} = [${pts.map((p) => `[${p[0].fs}, ${p[1].fs}]`).join(", ")}];`);
  return `dwPts${N}`;
}
/** nx × ny points; fn(i, j) gives the point from the two loop indices (symbolic). */
function ptsGrid(G, N, nx, ny, fn) {
  const one = (c) => c.c && c.v === 1;
  const i = one(nx) ? K(0) : V(`dwI${N}`), j = one(ny) ? K(0) : V(`dwJ${N}`);
  G.emit(`var dwPts${N} = [];`);
  if (!one(ny)) { G.emit(`for (var dwJ${N} = 0; dwJ${N} < ${ny.fs}; dwJ${N} += 1)`); G.open(); }
  if (!one(nx)) { G.emit(`for (var dwI${N} = 0; dwI${N} < ${nx.fs}; dwI${N} += 1)`); G.open(); }
  const p = fn(i, j);
  G.emit(`dwPts${N} = append(dwPts${N}, [${p[0].fs}, ${p[1].fs}]);`);
  if (!one(nx)) G.close();
  if (!one(ny)) G.close();
  return `dwPts${N}`;
}
/** n points on a circle; angle(i) in degrees, fn(cos, sin) gives the point. */
function ptsRing(G, N, n, angle, fn) {
  G.emit(`var dwPts${N} = [];`);
  G.emit(`for (var dwI${N} = 0; dwI${N} < ${n.fs}; dwI${N} += 1)`);
  G.open();
  G.emit(`const dwAngle${N} = ${wrap(angle(V(`dwI${N}`)), P_MUL)} * degree;`);
  const p = fn(V(`cos(dwAngle${N})`), V(`sin(dwAngle${N})`));
  G.emit(`dwPts${N} = append(dwPts${N}, [${p[0].fs}, ${p[1].fs}]);`);
  G.close();
  return `dwPts${N}`;
}

/** POS of the part language: [x, y] | [[x, y], ...] | {grid} | {circle}. */
function emitPos(G, N, at) {
  if (at === undefined || at === null) return ptsList(G, N, [[K(0), K(0)]]);
  if (Array.isArray(at)) {
    const list = at.length && !Array.isArray(at[0]) ? [at] : at;
    return ptsList(G, N, list.map((p, i) => [G.S(p[0], `at[${i}][0]`), G.S(p[1], `at[${i}][1]`)]));
  }
  if (at.grid) {
    const g = at.grid, o = g.origin || [0, 0], ox = G.S(o[0], "grid origin"), oy = G.S(o[1], "grid origin"), dx = G.S(g.dx ?? 0, "grid dx"), dy = G.S(g.dy ?? 0, "grid dy");
    return ptsGrid(G, N, G.count(g.nx, 1, 0), G.count(g.ny, 1, 0), (i, j) => [add(ox, mul(i, dx)), add(oy, mul(j, dy))]);
  }
  if (at.circle) {
    const c = at.circle, o = c.center || [0, 0], cx = G.S(o[0], "circle center"), cy = G.S(o[1], "circle center"), n = G.count(c.n, 1, 0);
    const r = div(G.S(G.truthy(c.d) ? c.d : G.truthy(c.pcd) ? c.pcd : 0, "circle d"), K(2)), a0 = G.S(c.start ?? 0, "circle start"), span = G.S(G.truthy(c.angle) ? c.angle : 360, "circle angle");
    return ptsRing(G, N, n, (i) => add(a0, div(mul(i, span), n)), (cs, sn) => [add(cx, mul(r, cs)), add(cy, mul(r, sn))]);
  }
  throw new Skip("positions « at » non comprises (formes : [x, y], [[x, y], ...], {grid}, {circle})");
}

const loopHead = (G, N, pts, k = "K") => { G.emit(`for (var dw${k}${N} = 0; dw${k}${N} < size(${pts}); dw${k}${N} += 1)`); G.open(); G.emit(`const dwU${N} = ${pts}[dw${k}${N}][0];`); G.emit(`const dwV${N} = ${pts}[dw${k}${N}][1];`); };
/** One primitive per point of the running loop, collected in the array `tools`. */
function toolInLoop(G, N, fn, name, tools, fields, k = "K") {
  const idExpr = `id + ("${name}${N}_" ~ dw${k}${N})`;
  G.call(fn, idExpr, fields);
  G.emit(`${tools} = append(${tools}, ${created(idExpr)});`);
}

/* ---------- profiles -> sketch entities ---------- */

function drawProfile(G, sk, def, what) {
  let k = 0;
  const name = () => fsString(`p${++k}`);
  const numeric = (profile) => {                                 // fixed numbers: SVG paths, generated sections
    G.use("path");
    for (const loop of [profile.outer, ...profile.holes]) {
      G.emit(`dwPath(${sk}, ${name()}, [`);
      loop.forEach((s, i) => {
        const c = s.t === "L" ? [s.a[0], s.a[1], s.b[0], s.b[1]] : [s.a[0], s.a[1], s.m[0], s.m[1], s.b[0], s.b[1]];
        G.lines.push("    ".repeat(G.depth + 2) + `[${c.map((x) => fnum(x)).join(", ")}]${i < loop.length - 1 ? "," : ""}`);
      });
      G.emit("]);");
    }
  };
  const one = (d) => {
    if (!d || typeof d !== "object") throw new Skip(`${what} : profil manquant ou invalide`);
    if (Array.isArray(d.outer) && d.outer[0] && d.outer[0].t) return numeric(d);                 // already normalised
    if (d.gen) {
      G.warn(`${what} : la section « gen:${d.gen} » est développée à la génération ; dans Onshape elle est figée et ne suit plus les paramètres.`);
      return numeric(normalizeProfile(evalDeep(d, G.scope)));
    }
    if (d.outer) { one(d.outer); for (const h of d.holes || []) one(h); return undefined; }
    if (d.rect) {
      const [x, y, w, h] = d.rect.map((v, i) => G.S(v, `rect[${i}]`));
      pos(w, "largeur du rect"); pos(h, "hauteur du rect");
      const r = d.r === undefined || d.r === null ? K(0) : G.S(d.r, "rect r");
      if (r.c && r.v <= 0) G.emit(`skRectangle(${sk}, ${name()}, { "firstCorner" : vector(${x.fs}, ${y.fs}) * millimeter, "secondCorner" : vector(${add(x, w).fs}, ${add(y, h).fs}) * millimeter });`);
      else { G.use("polygon"); G.emit(`dwPolygon(${sk}, ${name()}, [[${x.fs}, ${y.fs}, ${r.fs}], [${add(x, w).fs}, ${y.fs}, ${r.fs}], [${add(x, w).fs}, ${add(y, h).fs}, ${r.fs}], [${x.fs}, ${add(y, h).fs}, ${r.fs}]]);`); }
    } else if (d.circle) {
      const [cx, cy, dia] = d.circle.map((v, i) => G.S(v, `circle[${i}]`));
      pos(dia, "diamètre du cercle");
      G.emit(`skCircle(${sk}, ${name()}, { "center" : vector(${cx.fs}, ${cy.fs}) * millimeter, "radius" : ${mm(div(dia, K(2)))} });`);
    } else if (d.slot) {
      const v = d.slot.map((x, i) => G.S(x, `slot[${i}]`));
      if (v.length < 5) throw new Skip(`${what} : slot = [x1, y1, x2, y2, w]`);
      pos(v[4], "largeur du slot");
      G.use("slot");
      G.emit(`dwSlot(${sk}, ${name()}, ${v.slice(0, 5).map((s) => s.fs).join(", ")});`);
    } else if (d.poly) {
      if (!Array.isArray(d.poly) || d.poly.length < 3) throw new Skip(`${what} : un polygone demande au moins 3 points`);
      const dr = d.r === undefined || d.r === null ? K(0) : G.S(d.r, "poly r");
      const vs = d.poly.map((p, i) => {
        const extra = p[2], r = extra === undefined || extra === null ? dr : (typeof extra === "object" && !isSym(extra) ? (extra.r === undefined || extra.r === null ? dr : G.S(extra.r, "rayon de sommet")) : G.S(extra, "rayon de sommet"));
        return `[${G.S(p[0], `point ${i + 1} x`).fs}, ${G.S(p[1], `point ${i + 1} y`).fs}, ${r.fs}]`;
      });
      G.use("polygon");
      G.emit(`dwPolygon(${sk}, ${name()}, [${vs.join(", ")}]);`);
    } else if (d.path) numeric(normalizeProfile(evalDeep({ path: d.path, flipY: d.flipY }, G.scope)));
    else throw new Skip(`${what} : forme de profil inconnue (${Object.keys(d).join(", ")})`);
    for (const h of d.holes || []) one(h);
    return undefined;
  };
  one(def);
  G.emit(`skSolve(${sk});`);
}

/** Sketch a profile on the plane normal to `axis` at `level`, extrude it by `depth` along `dir`: returns the query of the solid. */
function sketchExtrude(G, N, axis, level, def, dir, depth, what) {
  const sk = G.sketch(N, axis, level);
  drawProfile(G, sk.v, def, what);
  G.call("opExtrude", `id + "extrude${N}"`, [["entities", `qSketchRegion(${sk.id}, true)`], ["direction", dirFs(dir)], ["endBound", "BoundingType.BLIND"], ["endDepth", mm(depth)]]);
  return created(`id + "extrude${N}"`);
}

function axisOf(G, a) {
  if (Array.isArray(a)) { const v = a.map((c) => G.frozen(c, "axe")), l = Math.hypot(...v) || 1; return v.map((c) => c / l); }
  const k = String(a || "Z").toUpperCase().replace("+", ""), minus = k.startsWith("-"), i = AX.indexOf(minus ? k.slice(1) : k);
  if (i < 0) throw new Skip(`axe inconnu « ${a} » (X, Y ou Z)`);
  const v = [0, 0, 0];
  v[i] = minus ? -1 : 1;
  return v;
}

export { onFace, makeGen, apply, levelSym, throughDepth, ptsList, ptsGrid, ptsRing, emitPos, loopHead, toolInLoop, drawProfile, sketchExtrude, axisOf };
