/* DynamiteOrbit — thin layer over the OpenCascade kernel (replicad-opencascadejs "single" build: constructors are
   overloaded by arguments, handles are transparent). Every kernel call of the platform goes through this file.
   Units mm. Works in a Web Worker and in Node (tests). Temporary kernel objects are tracked and freed by flush(). */

import { v3 } from "./vec.js";

export class KernelError extends Error {}

export function makeKernel(oc) {
  const arena = [];
  const T = (o) => { if (o && typeof o.delete === "function") arena.push(o); return o; };
  const PR = () => T(new oc.Message_ProgressRange());
  const pnt = (p) => T(new oc.gp_Pnt(p[0], p[1], p[2]));
  const dir = (d) => T(new oc.gp_Dir(d[0], d[1], d[2]));
  const vec = (d) => T(new oc.gp_Vec(d[0], d[1], d[2]));
  const SE = oc.TopAbs_ShapeEnum;
  const P3 = (p) => [p.X(), p.Y(), p.Z()];

  /** Free every temporary created since the last flush, except the wrappers listed in `keep`. */
  function flush(keep = []) {
    const hold = new Set(keep);
    for (const o of arena.splice(0)) {
      if (hold.has(o)) continue;
      try { if (!o.isDeleted()) o.delete(); } catch (e) { /* already gone */ }
    }
  }

  function explore(shape, kind) {
    const out = [];
    const ex = T(new oc.TopExp_Explorer(shape, kind, SE.TopAbs_SHAPE));
    for (; ex.More(); ex.Next()) out.push(ex.Current());
    return out;
  }

  /* ---------- primitives ---------- */
  function box(min, max) {
    if (max[0] - min[0] < 1e-6 || max[1] - min[1] < 1e-6 || max[2] - min[2] < 1e-6) throw new KernelError(`Boîte de taille nulle (${min} → ${max}).`);
    return T(T(new oc.BRepPrimAPI_MakeBox(pnt(min), pnt(max))).Shape());
  }
  function cylinder(base, axis, r, h) {
    if (r <= 1e-6 || h <= 1e-6) throw new KernelError(`Cylindre de rayon ${r} et de hauteur ${h}.`);
    return T(T(new oc.BRepPrimAPI_MakeCylinder(T(new oc.gp_Ax2(pnt(base), dir(v3.unit(axis)))), r, h)).Shape());
  }
  /** Truncated cone between radius r0 at `base` and r1 at base + axis * h (countersinks). */
  function cone(base, axis, r0, r1, h) {
    const a = v3.unit(axis);
    const ref = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const x = v3.unit(v3.cross(ref, a));
    const top = v3.add(base, v3.mul(a, h));
    const pts = [base, v3.add(base, v3.mul(x, r0)), v3.add(top, v3.mul(x, r1)), top].filter((p, i, all) => i === 0 || v3.dist(p, all[i - 1]) > 1e-9);
    const wb = T(new oc.BRepBuilderAPI_MakeWire());
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; wb.Add(T(T(new oc.BRepBuilderAPI_MakeEdge(pnt(p), pnt(q))).Edge())); });
    const face = T(T(new oc.BRepBuilderAPI_MakeFace(T(wb.Wire()), true)).Face());
    return T(T(new oc.BRepPrimAPI_MakeRevol(face, T(new oc.gp_Ax1(pnt(base), dir(a))), 2 * Math.PI, true)).Shape());
  }

  /** A tube wound in a helix : its centre line runs on a cylinder (r0 === r1) or a cone, from `base` along `axis`, `turns` turns over the
      height h ; the tube has the outside diameter d and, when di > 0, a bore. The line is a straight line of the (angle, height) plane
      of the surface, made a 3D curve ; a disc normal to its start is swept along it. */
  function coil(base, axis, r0, r1, h, turns, d, di = 0) {
    if (!(r0 > 1e-6 && r1 > 1e-6 && h > 1e-6 && turns > 1e-6 && d > 1e-6)) throw new KernelError(`Serpentin : rayons ${r0} et ${r1}, hauteur ${h}, ${turns} tour(s), tube de ${d}.`);
    if (di >= d) throw new KernelError(`Serpentin : l'alésage (${di}) doit rester sous le diamètre du tube (${d}).`);
    const a = v3.unit(axis), ax = T(new oc.gp_Ax3(pnt(base), dir(a))), ang = Math.atan2(r1 - r0, h), slant = h / Math.cos(ang), sweep = 2 * Math.PI * turns, len = Math.hypot(sweep, slant);
    const surf = Math.abs(r1 - r0) < 1e-9 ? T(new oc.Geom_CylindricalSurface(ax, r0)) : T(new oc.Geom_ConicalSurface(ax, ang, r0));
    const line = T(new oc.Geom2d_Line(T(new oc.gp_Pnt2d(0, 0)), T(new oc.gp_Dir2d(sweep, slant))));
    const edge = T(T(new oc.BRepBuilderAPI_MakeEdge(line, surf, 0, len)).Edge());
    oc.BRepLib.BuildCurves3d(edge);
    const spine = T(T(new oc.BRepBuilderAPI_MakeWire(edge)).Wire());
    const X = P3(T(ax.XDirection())), Y = P3(T(ax.YDirection())), start = v3.add(base, v3.mul(X, r0));
    const tan = v3.unit(v3.add(v3.mul(Y, sweep / len * r0), v3.mul(v3.add(v3.mul(X, Math.sin(ang)), v3.mul(a, Math.cos(ang))), slant / len)));
    const ring = (r, n) => T(T(new oc.BRepBuilderAPI_MakeWire(T(T(new oc.BRepBuilderAPI_MakeEdge(T(new oc.gp_Circ(T(new oc.gp_Ax2(pnt(start), dir(n))), r)))).Edge()))).Wire());
    const mf = T(new oc.BRepBuilderAPI_MakeFace(ring(d / 2, tan), true));
    if (di > 1e-6) mf.Add(ring(di / 2, v3.neg(tan)));                                  // the bore : the same circle, turned the other way
    const pipe = T(new oc.BRepOffsetAPI_MakePipe(spine, T(mf.Face())));
    if (!pipe.IsDone()) throw new KernelError("Serpentin : le balayage le long de l'hélice a échoué.");
    return T(pipe.Shape());
  }

  /* ---------- sketch -> face ---------- */
  function wireOfLoop(loop, to3) {
    const wb = T(new oc.BRepBuilderAPI_MakeWire());
    for (const s of loop) {
      let edge;
      if (s.t === "L") edge = T(new oc.BRepBuilderAPI_MakeEdge(pnt(to3(s.a)), pnt(to3(s.b))));
      else {
        const arc = T(new oc.GC_MakeArcOfCircle(pnt(to3(s.a)), pnt(to3(s.m)), pnt(to3(s.b))));
        edge = T(new oc.BRepBuilderAPI_MakeEdge(T(arc.Value())));
      }
      wb.Add(T(edge.Edge()));
    }
    if (!wb.IsDone()) throw new KernelError("Profil : le contour ne se ferme pas (segments non jointifs).");
    return T(wb.Wire());
  }
  /** Planar face of a normalised profile placed on frame {o, u, v}: 2D (a, b) -> o + a*u + b*v. */
  function faceOfProfile(profile, frame) {
    const to3 = (p) => [frame.o[0] + p[0] * frame.u[0] + p[1] * frame.v[0], frame.o[1] + p[0] * frame.u[1] + p[1] * frame.v[1], frame.o[2] + p[0] * frame.u[2] + p[1] * frame.v[2]];
    const mf = T(new oc.BRepBuilderAPI_MakeFace(wireOfLoop(profile.outer, to3), true));
    for (const h of profile.holes || []) mf.Add(wireOfLoop(h, to3));
    if (!mf.IsDone()) throw new KernelError("Profil : face impossible à construire (contour croisé ?).");
    return T(mf.Face());
  }
  const prism = (face, d) => T(T(new oc.BRepPrimAPI_MakePrism(face, vec(d), false, true)).Shape());
  const revolve = (face, origin, axis, angleDeg) => T(T(new oc.BRepPrimAPI_MakeRevol(face, T(new oc.gp_Ax1(pnt(origin), dir(v3.unit(axis)))), angleDeg * Math.PI / 180, true)).Shape());

  /* ---------- booleans ---------- */
  function boolean(Cls, a, tools, what) {
    tools = tools.filter(Boolean);
    if (!tools.length) return a;
    const op = T(new Cls());
    const la = T(new oc.NCollection_List_TopoDS_Shape()), lt = T(new oc.NCollection_List_TopoDS_Shape());
    la.Append(a); tools.forEach((x) => lt.Append(x));
    op.SetArguments(la); op.SetTools(lt); op.SetFuzzyValue(1e-5);
    op.Build(PR());
    if (!op.IsDone()) throw new KernelError(`Opération ${what} impossible sur cette géométrie.`);
    return T(op.Shape());
  }
  const fuse = (a, tools) => boolean(oc.BRepAlgoAPI_Fuse, a, tools, "union");
  const cut = (a, tools) => boolean(oc.BRepAlgoAPI_Cut, a, tools, "enlèvement");
  const common = (a, b) => boolean(oc.BRepAlgoAPI_Common, a, [b], "intersection");
  function unify(shape) {
    const u = T(new oc.ShapeUpgrade_UnifySameDomain(shape, true, true, false));
    u.Build();
    return T(u.Shape());
  }
  function compound(shapes) {
    const b = T(new oc.TopoDS_Builder()), c = T(new oc.TopoDS_Compound());
    b.MakeCompound(c);
    shapes.forEach((s) => b.Add(c, s));
    return c;
  }
  function transform(shape, m) {   // m: column-major 4x4 rigid matrix
    const tr = T(new oc.gp_Trsf());
    tr.SetValues(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14]);
    return T(T(new oc.BRepBuilderAPI_Transform(shape, tr, true)).Shape());
  }
  const isValid = (shape) => T(new oc.BRepCheck_Analyzer(shape, true, false)).IsValid();

  /* ---------- topology queries ---------- */
  function edgesInfo(shape) {
    const out = [], seen = new Set();
    for (const cur of explore(shape, SE.TopAbs_EDGE)) {
      const e = oc.TopoDS.Edge(cur), ac = T(new oc.BRepAdaptor_Curve(e));
      const u0 = ac.FirstParameter(), u1 = ac.LastParameter();
      const p0 = P3(T(ac.Value(u0))), p1 = P3(T(ac.Value(u1))), mid = P3(T(ac.Value((u0 + u1) / 2)));
      const key = [mid, p0, p1].map((p) => p.map((x) => Math.round(x * 1e4)).join(",")).sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const t = ac.GetType();
      const info = { edge: e, p0, p1, mid, u0, u1, type: "other", adaptor: ac };
      if (t === oc.GeomAbs_CurveType.GeomAbs_Line) { info.type = "line"; info.dir = v3.unit(v3.sub(p1, p0)); info.len = v3.dist(p0, p1); }
      else if (t === oc.GeomAbs_CurveType.GeomAbs_Circle) {
        const ci = T(ac.Circle());
        info.type = "circle"; info.r = ci.Radius(); info.c = P3(T(ci.Location())); info.axis = (() => { const d = T(T(ci.Axis()).Direction()); return [d.X(), d.Y(), d.Z()]; })();
        info.len = info.r * Math.abs(u1 - u0); info.full = Math.abs(Math.abs(u1 - u0) - 2 * Math.PI) < 1e-6;
      }
      out.push(info);
    }
    return out;
  }
  function facesInfo(shape) {
    const out = [];
    for (const cur of explore(shape, SE.TopAbs_FACE)) {
      const f = oc.TopoDS.Face(cur), ad = T(new oc.BRepAdaptor_Surface(f, true)), t = ad.GetType();
      const rev = f.Orientation() === oc.TopAbs_Orientation.TopAbs_REVERSED;
      const info = { face: f, type: "other", rev };
      const G = oc.GeomAbs_SurfaceType;
      if (t === G.GeomAbs_Plane) {
        const pl = T(ad.Plane()), d = T(T(pl.Axis()).Direction());
        info.type = "plane"; info.o = P3(T(pl.Location())); info.n = v3.mul([d.X(), d.Y(), d.Z()], rev ? -1 : 1);
      } else if (t === G.GeomAbs_Cylinder) {
        const cy = T(ad.Cylinder()), ax = T(cy.Axis()), d = T(ax.Direction());
        info.type = "cylinder"; info.r = cy.Radius(); info.o = P3(T(ax.Location())); info.axis = [d.X(), d.Y(), d.Z()];
        info.inner = rev;                                  // reversed cylinder = hole wall (normal points to the axis)
        info.sweep = Math.abs(ad.LastUParameter() - ad.FirstUParameter());
        info.h = Math.abs(ad.LastVParameter() - ad.FirstVParameter());
      } else if (t === G.GeomAbs_Cone) info.type = "cone";
      else if (t === G.GeomAbs_Sphere) info.type = "sphere";
      else if (t === G.GeomAbs_Torus) info.type = "torus";
      const g = T(new oc.GProp_GProps());
      oc.BRepGProp.SurfaceProperties(f, g, false, false);
      info.area = g.Mass(); info.c = P3(T(g.CentreOfMass()));
      out.push(info);
    }
    return out;
  }
  function bbox(shape) {
    const bb = T(new oc.Bnd_Box());
    oc.BRepBndLib.AddOptimal(shape, bb, false, false);          // exact box (no tolerance padding)
    if (bb.IsVoid()) return [0, 0, 0, 0, 0, 0];
    return [bb.GetXMin(), bb.GetYMin(), bb.GetZMin(), bb.GetXMax(), bb.GetYMax(), bb.GetZMax()];
  }
  function props(shape) {
    const g = T(new oc.GProp_GProps());
    oc.BRepGProp.VolumeProperties(shape, g, false, false, false);
    const s = T(new oc.GProp_GProps());
    oc.BRepGProp.SurfaceProperties(shape, s, false, false);
    return { volume: g.Mass(), cog: P3(T(g.CentreOfMass())), area: s.Mass(), bbox: bbox(shape) };
  }
  function distance(a, b) {
    const d = T(new oc.BRepExtrema_DistShapeShape(a, b));
    if (!d.IsDone() || d.NbSolution() < 1) return null;
    return { d: d.Value(), p: P3(T(d.PointOnShape1(1))), q: P3(T(d.PointOnShape2(1))) };
  }

  /* ---------- dress-up ---------- */
  function fillet(shape, edges, r) {
    const mk = T(new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational));
    edges.forEach((e) => mk.Add(r, e));
    mk.Build(PR());
    if (!mk.IsDone()) throw new KernelError(`Congé R${r} impossible sur ces arêtes (rayon trop grand pour la géométrie voisine ?).`);
    return T(mk.Shape());
  }
  function chamfer(shape, edges, d) {
    const mk = T(new oc.BRepFilletAPI_MakeChamfer(shape));
    edges.forEach((e) => mk.Add(d, e));
    mk.Build(PR());
    if (!mk.IsDone()) throw new KernelError(`Chanfrein ${d} impossible sur ces arêtes.`);
    return T(mk.Shape());
  }
  function shell(shape, openFaces, t) {
    const faces = T(new oc.NCollection_List_TopoDS_Shape());
    openFaces.forEach((f) => faces.Append(f));
    const mk = T(new oc.BRepOffsetAPI_MakeThickSolid());
    mk.MakeThickSolidByJoin(shape, faces, -Math.abs(t), 1e-3, oc.BRepOffset_Mode.BRepOffset_Skin, false, false, oc.GeomAbs_JoinType.GeomAbs_Intersection, false, PR());
    if (!mk.IsDone()) throw new KernelError(`Coque d'épaisseur ${t} impossible (paroi plus épaisse qu'un détail de la pièce ?).`);
    return T(mk.Shape());
  }

  /** Draft : every face that runs along the pull direction — planes, and cylinders about it — leans by `angle` (radians) about the
      neutral plane through `neutral`, square to the pull. A positive angle makes the shape wider along the pull : a box open toward
      +Z narrows toward its floor, as a moulded part narrows toward the bottom of its cavity. → { shape, faces : how many lean } */
  function draft(shape, pull, angle, neutral) {
    const d = v3.unit(pull), mk = T(new oc.BRepOffsetAPI_DraftAngle(shape)), pln = T(new oc.gp_Pln(pnt(neutral), dir(d)));
    let n = 0;
    for (const fi of facesInfo(shape)) {
      const along = fi.type === "plane" ? Math.abs(v3.dot(fi.n, d)) < 1e-6 : fi.type === "cylinder" ? Math.abs(Math.abs(v3.dot(fi.axis, d)) - 1) < 1e-6 : false;
      if (!along) continue;
      mk.Add(fi.face, dir(d), -angle, pln, true); n++;                       // the kernel counts the other way round
      if (!mk.AddDone()) { mk.Remove(fi.face); n--; }
    }
    if (!n) throw new KernelError("Dépouille : aucune face parallèle au sens de démoulage.");
    mk.Build(PR());
    if (!mk.IsDone()) throw new KernelError(`Dépouille de ${(angle * 180 / Math.PI).toFixed(1)}° impossible sur cette forme.`);
    return { shape: T(mk.Shape()), faces: n };
  }

  /* ---------- tessellation ---------- */
  function tessellate(shape, deflection) {
    const bb = bbox(shape), diag = Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) || 1;
    const defl = deflection || Math.max(0.02, Math.min(0.15, diag / 900));
    T(new oc.BRepMesh_IncrementalMesh(shape, defl, false, 0.35, false));
    const pos = [], nrm = [], idx = [], faceOf = [], faces = [];
    const finfo = facesInfo(shape);
    finfo.forEach((fi, fidx) => {
      const loc = T(new oc.TopLoc_Location());
      let tri;
      try { tri = oc.BRep_Tool.Triangulation(fi.face, loc, 0); } catch (e) { tri = null; }
      faces.push({ type: fi.type, n: fi.n, o: fi.o, r: fi.r, axis: fi.axis, inner: fi.inner, area: fi.area, c: fi.c });
      if (!tri || (tri.isNull && tri.isNull()) || !tri.NbTriangles()) return;
      T(tri);
      const tr = T(loc.Transformation()), base = pos.length / 3, nn = tri.NbNodes();
      const acc = new Float64Array(nn * 3);
      for (let k = 1; k <= nn; k++) { const p = T(T(tri.Node(k)).Transformed(tr)); pos.push(p.X(), p.Y(), p.Z()); }
      for (let k = 1; k <= tri.NbTriangles(); k++) {
        const t3 = T(tri.Triangle(k));
        let a = t3.Value(1) - 1, b = t3.Value(2) - 1, c = t3.Value(3) - 1;
        if (fi.rev) [b, c] = [c, b];
        const A = base + a, B = base + b, C = base + c;
        const ux = pos[B * 3] - pos[A * 3], uy = pos[B * 3 + 1] - pos[A * 3 + 1], uz = pos[B * 3 + 2] - pos[A * 3 + 2];
        const wx = pos[C * 3] - pos[A * 3], wy = pos[C * 3 + 1] - pos[A * 3 + 1], wz = pos[C * 3 + 2] - pos[A * 3 + 2];
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        if (nx * nx + ny * ny + nz * nz < 1e-18) continue;
        for (const q of [a, b, c]) { acc[q * 3] += nx; acc[q * 3 + 1] += ny; acc[q * 3 + 2] += nz; }
        idx.push(A, B, C); faceOf.push(fidx);
      }
      for (let k = 0; k < nn; k++) { const l = Math.hypot(acc[k * 3], acc[k * 3 + 1], acc[k * 3 + 2]) || 1; nrm.push(acc[k * 3] / l, acc[k * 3 + 1] / l, acc[k * 3 + 2] / l); }
    });
    const epos = [], edgeOf = [], edges = [];
    edgesInfo(shape).forEach((ei, k) => {
      const n = ei.type === "line" ? 1 : Math.max(6, Math.ceil((ei.len || 10) / Math.max(defl * 6, 0.4)));
      const m = Math.min(n, 96), pts = [];
      for (let j = 0; j <= m; j++) pts.push(P3(T(ei.adaptor.Value(ei.u0 + (ei.u1 - ei.u0) * j / m))));
      for (let j = 0; j < m; j++) { epos.push(...pts[j], ...pts[j + 1]); edgeOf.push(k); }
      edges.push({ type: ei.type, p0: ei.p0, p1: ei.p1, r: ei.r, c: ei.c, axis: ei.axis, len: ei.len, full: ei.full });
    });
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), faceOf: new Uint32Array(faceOf), faces,
      epos: new Float32Array(epos), edgeOf: new Uint32Array(edgeOf), edges, deflection: defl };
  }

  /* ---------- STEP ---------- */
  const safeName = (s) => String(s || "part").replace(/[^A-Za-z0-9_\-. ]/g, "_").slice(0, 80) || "part";
  function readVfs(path) { const s = oc.FS.readFile(path, { encoding: "utf8" }); oc.FS.unlink(path); return s; }
  /** STEP AP214 of named, coloured components: items [{name, shape, color:[r,g,b] 0..1, matrix?}] under one assembly.
      An item with `children` (and no shape) is a SUB-ASSEMBLY : a product of its own that holds them, each child placed in ITS
      frame ; the same key met again is the same product placed once more. The file keeps the levels of the assembly. */
  function stepWrite(items, assemblyName) {
    oc.Interface_Static.SetCVal("write.step.schema", "AP214IS");
    oc.Interface_Static.SetCVal("write.step.unit", "MM");
    const doc = T(new oc.TDocStd_Document(T(new oc.TCollection_ExtendedString("XmlXCAF"))));
    const main = T(doc.Main());
    const shapes = oc.XCAFDoc_DocumentTool.ShapeTool(main), colors = oc.XCAFDoc_DocumentTool.ColorTool(main);
    const ext = (s) => T(new oc.TCollection_ExtendedString(safeName(s)));
    const single = items.length === 1 && !items[0].matrix;
    const assembly = single ? null : T(shapes.NewShape());
    if (assembly) oc.TDataStd_Name.Set(assembly, ext(assemblyName || "Assembly"));
    const protos = new Map();
    const place = (parent, it) => {
      let loc;
      if (it.matrix) {
        const m = it.matrix, tr = T(new oc.gp_Trsf());
        tr.SetValues(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14]);
        loc = T(new oc.TopLoc_Location(tr));
      } else loc = T(new oc.TopLoc_Location());
      const comp = T(shapes.AddComponent(parent, proto(it), loc));
      oc.TDataStd_Name.Set(comp, ext(it.instanceName || it.name));
    };
    /* the product an item stands for : a shape, or a sub-assembly filled with its own children before it is placed anywhere */
    function proto(it) {
      let label = it.key && protos.get(it.key);
      if (label) return label;
      if (it.children) { label = T(shapes.NewShape()); oc.TDataStd_Name.Set(label, ext(it.name)); for (const c of it.children) place(label, c); }
      else {
        label = T(shapes.AddShape(it.shape, false, false));
        oc.TDataStd_Name.Set(label, ext(it.name));
        if (it.color) colors.SetColor(label, T(new oc.Quantity_ColorRGBA(it.color[0], it.color[1], it.color[2], 1)), oc.XCAFDoc_ColorType.XCAFDoc_ColorSurf);
      }
      if (it.key) protos.set(it.key, label);
      return label;
    }
    for (const it of items) { if (assembly) place(assembly, it); else proto(it); }
    shapes.UpdateAssemblies();
    const w = T(new oc.STEPCAFControl_Writer());
    w.SetNameMode(true); w.SetColorMode(true);
    const path = "/dw_out.step";
    if (!w.Perform(doc, path, PR())) throw new KernelError("Écriture STEP impossible.");
    return readVfs(path);
  }
  /** Read a STEP text: returns the solids found (in file order) with their bounding boxes. */
  function stepRead(text) {
    const path = "/dw_in.step";
    oc.FS.writeFile(path, text);
    const rd = T(new oc.STEPControl_Reader());
    const ok = rd.ReadFile(path) === oc.IFSelect_ReturnStatus.IFSelect_RetDone;
    oc.FS.unlink(path);
    if (!ok) throw new KernelError("Fichier STEP illisible. Correctif : exportez-le en AP214 ou AP242 depuis votre CAO.");
    rd.TransferRoots(PR());
    const one = T(rd.OneShape());
    let solids = explore(one, SE.TopAbs_SOLID).map((s) => oc.TopoDS.Solid(s));
    if (!solids.length) solids = [one];
    return solids.map((s, i) => ({ shape: s, index: i, ...props(s) }));
  }

  /* ---------- hidden-line projection for drawings ---------- */
  /** Project `shape` along `viewDir` (pointing from the eye to the model), with `xDir` as the sheet's horizontal axis.
      Returns polylines in sheet coordinates (x right, y up): {visible, hidden, outline}. */
  function hlr(shape, viewDir, xDir, withHidden = true) {
    const algo = T(new oc.HLRBRep_Algo());
    algo.Add(shape, 0);
    const eye = v3.neg(v3.unit(viewDir));
    algo.Projector(T(new oc.HLRAlgo_Projector(T(new oc.gp_Ax2(pnt([0, 0, 0]), dir(eye), dir(v3.unit(xDir)))))));
    algo.Update(); algo.Hide();
    const hs = T(new oc.HLRBRep_HLRToShape(algo));
    const lines = (comp) => {
      const out = [];
      if (!comp || comp.IsNull()) return out;
      T(comp);
      oc.BRepLib.BuildCurves3d(comp);
      for (const cur of explore(comp, SE.TopAbs_EDGE)) {
        const ac = T(new oc.BRepAdaptor_Curve(oc.TopoDS.Edge(cur)));
        const u0 = ac.FirstParameter(), u1 = ac.LastParameter(), t = ac.GetType();
        let n = 1;
        if (t !== oc.GeomAbs_CurveType.GeomAbs_Line) {
          const r = t === oc.GeomAbs_CurveType.GeomAbs_Circle ? T(ac.Circle()).Radius() : 10;
          n = Math.max(8, Math.min(96, Math.ceil(Math.abs(u1 - u0) * Math.sqrt(Math.max(r, 0.5)) * 4)));
        }
        const pts = [];
        for (let k = 0; k <= n; k++) { const p = T(ac.Value(u0 + (u1 - u0) * k / n)); pts.push([p.X(), p.Y()]); }
        const seg = { pts };
        if (t === oc.GeomAbs_CurveType.GeomAbs_Circle) { const ci = T(ac.Circle()), c = T(ci.Location()); seg.circle = { c: [c.X(), c.Y()], r: ci.Radius(), full: Math.abs(Math.abs(u1 - u0) - 2 * Math.PI) < 1e-6 }; }
        out.push(seg);
      }
      return out;
    };
    const res = { visible: [...lines(hs.VCompound()), ...lines(hs.OutLineVCompound())], smooth: lines(hs.Rg1LineVCompound()), hidden: [] };
    if (withHidden) res.hidden = [...lines(hs.HCompound()), ...lines(hs.OutLineHCompound())];
    return res;
  }

  /** Planar section of a shape by the plane through `origin` with normal `n`: returns 3D polylines. */
  function section(shape, origin, n) {
    const pl = T(new oc.gp_Pln(pnt(origin), dir(v3.unit(n))));
    const face = T(T(new oc.BRepBuilderAPI_MakeFace(pl, -1e4, 1e4, -1e4, 1e4)).Face());
    const sec = T(new oc.BRepAlgoAPI_Section(shape, face, false));
    sec.Build(PR());
    const out = [];
    for (const cur of explore(T(sec.Shape()), SE.TopAbs_EDGE)) {
      const ac = T(new oc.BRepAdaptor_Curve(oc.TopoDS.Edge(cur))), u0 = ac.FirstParameter(), u1 = ac.LastParameter();
      const m = ac.GetType() === oc.GeomAbs_CurveType.GeomAbs_Line ? 1 : 24, pts = [];
      for (let k = 0; k <= m; k++) pts.push(P3(T(ac.Value(u0 + (u1 - u0) * k / m))));
      out.push(pts);
    }
    return out;
  }

  return { oc, flush, track: T, box, cylinder, cone, coil, faceOfProfile, prism, revolve, fuse, cut, common, unify, compound, transform, isValid,
    edgesInfo, facesInfo, bbox, props, distance, fillet, chamfer, shell, draft, tessellate, stepWrite, stepRead, hlr, section, explore };
}

/** The size of the kernel file, in bytes : what a download counts towards (a server may send it compressed, and then says another length). */
export const KERNEL_BYTES = 22980267;
/* the kernel file, compiled as it arrives, its bytes counted on the way : onProgress(received, total) */
async function streamKernel(url, imports, onProgress) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok || !res.body) throw new KernelError(`Le noyau CAO n'a pas pu être téléchargé (réponse ${res.status}). Correctif : vérifiez la connexion, puis réessayez.`);
  const reader = res.body.getReader(); let got = 0;
  const counted = new ReadableStream({ async pull(c) { const { done, value } = await reader.read(); if (done) { onProgress(KERNEL_BYTES, KERNEL_BYTES); c.close(); return; } got += value.byteLength; onProgress(Math.min(got, KERNEL_BYTES), KERNEL_BYTES); c.enqueue(value); },
    cancel(reason) { return reader.cancel(reason); } });
  return WebAssembly.instantiateStreaming(new Response(counted, { headers: { "Content-Type": "application/wasm" } }), imports);
}
/** Load the kernel. In the browser pass the URL of the vendor folder; in Node pass {wasmBinary}. onProgress(received, total) : told as the
    kernel file arrives (browser only) — without it, the loader fetches the file by itself, silently. */
export async function loadKernel(baseUrl, extra = {}, onProgress = null) {
  const mod = await import(/* @vite-ignore */ baseUrl + "replicad_single.js");
  const watch = !!onProgress && !extra.wasmBinary && typeof fetch === "function" && typeof ReadableStream === "function" && typeof WebAssembly.instantiateStreaming === "function";
  let fail = null; const broke = new Promise((ok, no) => { fail = no; });
  const hook = watch ? { instantiateWasm: (imports, ready) => { streamKernel(baseUrl + "replicad_single.wasm", imports, onProgress).then((r) => ready(r.instance, r.module), fail); return {}; } } : {};
  const oc = await Promise.race([mod.default({ locateFile: (f) => baseUrl + f, print: () => {}, printErr: () => {}, ...hook, ...extra }), broke]);
  return makeKernel(oc);
}
