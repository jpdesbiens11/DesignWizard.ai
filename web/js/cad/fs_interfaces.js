/* DesignOrbit.ai — FeatureScript export (see featurescript.js), family blocks and interfaces: the "extrusion" block (an
   extrude), the "pcb" block (board, holes, one body per component) and the interfaces, recompiled with the logic of
   interfaces.js on symbolic values so that positions, patterns and depths stay expressions of the parameters. */

import { FACES, faceKey } from "./vec.js";
import { INTERFACE_TYPES } from "./interfaces.js";
import { thread, clearanceHole } from "./standards.js";
import { Skip, P_ATOM, K, V, neg, add, sub, mul, div, minS, round2, r2, cosd, sind, vecMm, created, pos } from "./fs_expr.js";
import { clean } from "./fs_helpers.js";
import { ptsList, ptsGrid, ptsRing } from "./fs_gen.js";
import { EMIT, emitHole, emitPocket, emitPad, emitBoss } from "./fs_features.js";

/* ---------- family blocks ---------- */

function emitExtrusionBlock(G, ex) {
  const axis = String(ex.axis || "Y").toUpperCase(), plane = { Y: "XZ", X: "YZ", Z: "XY" }[axis];
  if (!plane) throw new Skip(`extrusion.axis « ${ex.axis} » inconnu (X, Y ou Z)`);
  pos(G.S(ex.length, "extrusion.length"), "extrusion.length");
  EMIT.extrude(G, { id: "extrusion", profile: ex.profile, plane, length: ex.length });
}

function emitPcbBlock(G, pcb) {
  const t = pos(G.S(pcb.t ?? 1.6, "pcb.t"), "pcb.t");
  const outline = pcb.outline || (pcb.size ? { rect: [0, 0, pcb.size[0], pcb.size[1]], r: pcb.r ?? 0 } : null);
  if (!outline) throw new Skip("pcb : « outline » (profil) ou « size » [largeur, hauteur] requis");
  G.emit("// carte nue");
  EMIT.extrude(G, { id: "board", body: "board", profile: outline, plane: "XY", at: 0, length: t });
  (pcb.holes || []).forEach((h) => emitHole(G, { face: "+Z", body: "board", at: h.at, d: h.d, depth: "through", start: t }, null, G.next()));
  const comps = pcb.components || [];
  if (comps.length) {
    const N = G.next(), seen = new Set();
    G.emit("// composants : un corps (enveloppe) par composant");
    comps.forEach((c, i) => {
      let ref = String(c.ref || `X${i + 1}`);
      while (seen.has(ref)) ref += "'";
      seen.add(ref);
      const sz = c.size || [5, 5, 2], top = (c.side || "top") !== "bottom", at = c.at || [0, 0], so = G.S(c.standoff ?? 0, "standoff");
      const rot = c.rot ? G.frozen(c.rot, `rotation du composant ${ref}`) : 0, quarter = Math.abs((((rot % 180) + 180) % 180) - 90) < 1e-6;
      const w = pos(G.S(sz[quarter ? 1 : 0], "size"), `taille de ${ref}`), h = pos(G.S(sz[quarter ? 0 : 1], "size"), `taille de ${ref}`), z = pos(G.S(sz[2], "size"), `hauteur de ${ref}`);
      const x0 = sub(G.S(at[0], "at"), div(w, K(2))), y0 = sub(G.S(at[1], "at"), div(h, K(2))), z0 = top ? add(t, so) : sub(neg(z), so);
      const idExpr = `id + "comp${N}_${i + 1}"`;
      G.call("fCuboid", idExpr, [["corner1", vecMm([x0, y0, z0])], ["corner2", vecMm([add(x0, w), add(y0, h), add(z0, z)])]]);
      G.emit(`// ↑ ${clean(ref)}${c.name ? " — " + clean(c.name) : ""}`);
      G.bodies.set(ref, created(idExpr));
    });
  }
  if ((pcb.zones || []).length) G.warn("pcb : les zones de cuivre (« zones ») servent à l'analyse d'isolation et ne sont pas exportées vers Onshape.");
}

/* ---------- interfaces: same logic as interfaces.js `compile`, on symbolic values ---------- */

function patternOf(G, pattern = {}) {
  const t = pattern.type || (pattern.pts ? "points" : G.truthy(pattern.pcd) ? "circle" : G.truthy(pattern.nx) || G.truthy(pattern.ny) ? "rect" : "single");
  if (t === "single") return { kind: "list", pts: [[K(0), K(0)]] };
  if (t === "rect") return { kind: "grid", nx: G.count(pattern.nx, 2), ny: G.count(pattern.ny, 2), dx: G.S(pattern.dx ?? 0, "pattern dx"), dy: G.S(pattern.dy ?? 0, "pattern dy") };
  if (t === "circle") return { kind: "ring", n: G.count(pattern.n, 4), r: div(G.S(pattern.pcd ?? 0, "pattern pcd"), K(2)), start: G.S(pattern.start ?? 0, "pattern start") };
  if (t === "points") return { kind: "list", pts: (pattern.pts || []).map((p, i) => [G.S(p[0], `pts[${i}][0]`), G.S(p[1], `pts[${i}][1]`)]) };
  throw new Skip(`motif d'interface inconnu « ${t} » (single, rect, circle, points)`);
}
const SINGLE = () => ({ kind: "list", pts: [[K(0), K(0)]] });
const row = (n, pitch) => ({ kind: "grid", nx: n, ny: K(1), dx: pitch, dy: K(0) });

/** Sub-features of one side of an interface, in FRAME coordinates (pattern descriptors, symbolic sizes). */
function compileIface(G, typeName, side, p, o) {
  const S = (x, what) => G.S(x, what);
  if (typeName === "bolt_pattern") {
    const th = thread(p.screw), pat = patternOf(G, p.pattern || {});
    if (side === "A") {
      const f = { op: "hole", pat, d: K(clearanceHole(p.screw, o.fit || "medium")), depth: o.depth ?? "through" };
      if (o.head === "cbore") f.cbore = { d: th.cbore, depth: r2(th.head[1] + 0.4) };
      if (o.head === "csink") f.csink = { d: th.csk, angle: 90 };
      return [f];
    }
    const insert = o.thread === "insert", clr = o.thread === "clearance";
    const hd = clr ? clearanceHole(p.screw, "medium") : insert ? th.insert[0] : th.tap;
    const depth = o.depth ?? (clr ? "through" : insert ? r2(th.insert[1] + 1) : r2(2.5 * th.d));
    if (o.standoff && G.truthy(o.standoff.h) && G.num(o.standoff.h) > 0) {
      const h = S(o.standoff.h, "standoff h"), od = G.truthy(o.standoff.d) ? S(o.standoff.d, "standoff d") : K(r2(Math.max(2.2 * hd, hd + 2 * (insert ? 1.6 : 1.2))));
      const hdep = clr ? "through" : minS(depth === "through" ? K(1e3) : S(depth, "depth"), add(h, S(o.standoff.into ?? 0, "standoff into")));
      return [{ op: "boss", pat, d: od, h, below: true, hole: { d: K(hd), depth: hdep } }];
    }
    return [{ op: "hole", pat, d: K(hd), depth }];
  }
  if (typeName === "planar") return side === "B" && G.truthy(o.pad) && G.num(o.pad) > 0 ? [{ op: "pad", w: S(p.w, "w"), h: S(p.h, "h"), t: S(o.pad, "pad") }] : [];
  if (typeName === "fit") {
    if (side === "A") return [{ op: "boss", pat: SINGLE(), d: S(p.d, "d"), h: S(p.length, "length") }];
    return [{ op: "hole", pat: SINGLE(), d: S(p.d, "d"), depth: o.depth ?? round2(add(S(p.length, "length"), K(0.5))) }];
  }
  if (typeName === "cutout") {
    const out = [];
    if (side === "A") {
      if (p.shape === "round") out.push({ op: "hole", pat: SINGLE(), d: S(p.d, "d"), depth: o.depth ?? "through" });
      else out.push({ op: "pocket", rect: [S(p.w, "w"), S(p.h, "h")], r: S(G.truthy(p.r) ? p.r : 0, "r"), depth: o.depth ?? "through" });
    }
    if (p.fix && p.fix.screw) {
      const pitch = G.truthy(p.fix.pitch) ? S(p.fix.pitch, "pitch") : add(S(G.truthy(p.w) ? p.w : G.truthy(p.d) ? p.d : 20, "w"), K(8)), pat = row(G.count(p.fix.n, 2), pitch);
      out.push(side === "A" ? { op: "hole", pat, d: K(clearanceHole(p.fix.screw)), depth: o.depth ?? "through" }
        : { op: "hole", pat, d: K(thread(p.fix.screw).tap), depth: r2(2.5 * thread(p.fix.screw).d) });
    }
    return out;
  }
  if (typeName === "rail") return side === "A" ? [] : [{ op: "pocket", rect: [S(p.length, "length"), round2(add(S(p.t, "t"), mul(K(2), S(o.clearance ?? 0.2, "clearance"))))], r: K(0), depth: p.depth }];
  if (typeName === "pins") {
    const pat = row(G.count(p.n, 2), S(p.pitch, "pitch"));
    return [{ op: "hole", pat, d: S(p.d, "d"), depth: side === "A" ? (o.depth ?? "through") : (o.depth ?? round2(mul(S(G.truthy(p.length) ? p.length : 12, "length"), K(0.5)))) }];
  }
  throw new Skip(`type d'interface « ${typeName} » sans conversion FeatureScript`);
}

function emitInterface(G, iface) {
  const type = INTERFACE_TYPES[iface.type];
  if (!type) throw new Skip(`type d'interface inconnu « ${iface.type} »`);
  const side = iface.side === "B" ? "B" : "A", face = faceKey(iface.face || "+Z"), F = FACES[face], bodyName = iface.body || G.main;
  const p = { ...JSON.parse(JSON.stringify(type.params)), ...(iface.params || {}) }, o = { ...(side === "A" ? type.optsA : type.optsB), ...(iface.opts || {}) };
  const subs = compileIface(G, iface.type, side, p, o);
  if (!subs.length) { G.emit("// (ce côté de l'interface n'ajoute aucune géométrie à la pièce)"); return; }
  const N0 = G.next();
  let level;
  if (iface.level !== undefined && iface.level !== null) {
    const s = G.S(iface.level, "level");
    if (s.c || s.prec >= P_ATOM) level = s; else { G.emit(`const dwPlane${N0} = ${s.fs};`); level = V(`dwPlane${N0}`, s.v); }
  } else {
    G.use("box");
    G.emit(`const dwPlane${N0} = dwLevel(context, ${G.bodyQ(bodyName)}, ${F.axis}, ${F.n[F.axis] > 0});`);
    level = V(`dwPlane${N0}`);
  }
  // mate frame in the 2D coordinates of the face plane: origin `at`, axes u and v turned by `rot`; side B is mirrored in v
  const U = [F.u[F.plane[0]], F.u[F.plane[1]]], W = [F.v[F.plane[0]], F.v[F.plane[1]]], rot = G.S(iface.rot ?? 0, "rot"), c = cosd(rot), sn = sind(rot);
  const ux = add(mul(K(U[0]), c), mul(K(W[0]), sn)), uy = add(mul(K(U[1]), c), mul(K(W[1]), sn)), vx = sub(mul(K(W[0]), c), mul(K(U[0]), sn)), vy = sub(mul(K(W[1]), c), mul(K(U[1]), sn));
  const at = iface.at || [0, 0], a0 = G.S(at[0], "at[0]"), a1 = G.S(at[1], "at[1]"), sign = side === "B" ? -1 : 1;
  const toFace = (a, b, sg = sign) => [add(a0, add(mul(ux, a), mul(vx, mul(K(sg), b)))), add(a1, add(mul(uy, a), mul(vy, mul(K(sg), b))))];
  const points = (N, pat) => {
    if (pat.kind === "list") return ptsList(G, N, pat.pts.map(([a, b]) => toFace(a, b)));
    if (pat.kind === "grid") {
      const half = (n) => div(sub(n, K(1)), K(2));
      return ptsGrid(G, N, pat.nx, pat.ny, (i, j) => toFace(mul(sub(i, half(pat.nx)), pat.dx), mul(sub(j, half(pat.ny)), pat.dy)));
    }
    return ptsRing(G, N, pat.n, (i) => add(pat.start, div(mul(i, K(360)), pat.n)), (cs, s) => toFace(mul(pat.r, cs), mul(pat.r, s)));
  };
  const corners = (w, h, sg) => [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([i, j]) => toFace(mul(K(i), w), mul(K(j), h), sg));
  for (const sf of subs) {
    const N = G.next(), base = { id: iface.id, face, body: iface.body };
    if (sf.op === "hole") emitHole(G, { ...base, d: sf.d, depth: sf.depth, cbore: sf.cbore, csink: sf.csink, start: level }, points(N, sf.pat), N);
    else if (sf.op === "boss") emitBoss(G, { ...base, d: sf.d, h: sf.h, hole: sf.hole, start: sf.below ? sub(level, sf.h) : level }, points(N, sf.pat), N);
    else if (sf.op === "pocket") emitPocket(G, { ...base, profile: { poly: corners(sf.rect[0], sf.rect[1], sign), r: sf.r }, depth: sf.depth, start: level }, N);
    else if (sf.op === "pad") emitPad(G, { ...base, profile: { poly: corners(sf.w, sf.h, 1) }, h: sf.t, start: level }, N);
  }
}

export { emitExtrusionBlock, emitPcbBlock, emitInterface };
