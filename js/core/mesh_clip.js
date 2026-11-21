/* DesignWizard.ai — a mesh of the kernel made ready for a view that works in the frame of the product : placed where its part stands
   (bakeMesh), and cut by planes square to the axes (clipMesh) — what a model reduced by a symmetry or a cut still shows. Faces and
   edges keep their numbers, so what is pointed at in the view is still the face, the edge of the part. Pure. */

/** A mesh in the frame of the product. m : the 16 elements of the matrix of its part (column-major), or nothing (already there).
    → { pos, nrm, idx, faceOf, faces, epos, edgeOf, edges } — points moved and turned, directions turned. */
export function bakeMesh(mesh, m) {
  if (!m) return mesh;
  const pt = (p) => (p ? [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] : p);
  const dir = (d) => { if (!d) return d; const v = [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]], l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((c) => c / l); };
  const move = (src, f) => { const out = new Float32Array(src.length); for (let i = 0; i < src.length; i += 3) { const q = f([src[i], src[i + 1], src[i + 2]]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; } return out; };
  return { ...mesh, pos: move(mesh.pos, pt), nrm: mesh.nrm ? move(mesh.nrm, dir) : mesh.nrm, epos: mesh.epos ? move(mesh.epos, pt) : mesh.epos,
    faces: (mesh.faces || []).map((f) => ({ ...f, ...(f.n ? { n: dir(f.n) } : {}), ...(f.o ? { o: pt(f.o) } : {}), ...(f.axis ? { axis: dir(f.axis) } : {}), ...(f.c ? { c: pt(f.c) } : {}) })),
    edges: (mesh.edges || []).map((e) => ({ ...e, ...(e.p0 ? { p0: pt(e.p0) } : {}), ...(e.p1 ? { p1: pt(e.p1) } : {}), ...(e.c ? { c: pt(e.c) } : {}), ...(e.axis ? { axis: dir(e.axis) } : {}) })) };
}

/** What a mesh keeps on the kept side of planes square to the axes. planes : [{ axis: 0 | 1 | 2, at, keep: 1 | -1 }].
    A triangle the plane crosses is cut ; so is an edge. Each piece keeps the number of its face, of its edge. */
export function clipMesh(mesh, planes) {
  const cuts = (planes || []).filter((p) => p && p.axis >= 0 && p.axis <= 2 && Number.isFinite(p.at)); if (!cuts.length) return mesh;
  const { pos, nrm, idx, faceOf } = mesh;
  let tris = [], segs = [];      // a triangle : [faceId, v0, v1, v2], a vertex : [x, y, z, nx, ny, nz] ; a segment : [edgeId, a, b]
  for (let t = 0; t < idx.length / 3; t++) tris.push([faceOf ? faceOf[t] : 0, ...[0, 1, 2].map((c) => { const i = 3 * idx[3 * t + c]; return [pos[i], pos[i + 1], pos[i + 2], nrm ? nrm[i] : 0, nrm ? nrm[i + 1] : 0, nrm ? nrm[i + 2] : 0]; })]);
  for (let s = 0; mesh.epos && s < mesh.epos.length / 6; s++) segs.push([mesh.edgeOf ? mesh.edgeOf[s] : 0, [mesh.epos[6 * s], mesh.epos[6 * s + 1], mesh.epos[6 * s + 2]], [mesh.epos[6 * s + 3], mesh.epos[6 * s + 4], mesh.epos[6 * s + 5]]]);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (const pl of cuts) {
    const side = (v) => (pl.keep < 0 ? pl.at - v[pl.axis] : v[pl.axis] - pl.at), next = [], kept = [];
    for (const [face, ...v] of tris) {
      const d = v.map(side), poly = [];
      if (d[0] >= 0 && d[1] >= 0 && d[2] >= 0) { next.push([face, ...v]); continue; }
      if (d[0] < 0 && d[1] < 0 && d[2] < 0) continue;
      for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; if (d[i] >= 0) poly.push(v[i]); if ((d[i] >= 0) !== (d[j] >= 0)) poly.push(mix(v[i], v[j], d[i] / (d[i] - d[j]))); }
      for (let i = 1; i + 1 < poly.length; i++) next.push([face, poly[0], poly[i], poly[i + 1]]);
    }
    for (const [edge, a, b] of segs) {
      const da = side(a), db = side(b); if (da < 0 && db < 0) continue;
      kept.push(da >= 0 && db >= 0 ? [edge, a, b] : da >= 0 ? [edge, a, mix(a, b, da / (da - db))] : [edge, mix(a, b, da / (da - db)), b]);
    }
    tris = next; segs = kept;
  }
  const out = { ...mesh, pos: new Float32Array(9 * tris.length), nrm: new Float32Array(9 * tris.length), idx: new Uint32Array(3 * tris.length), faceOf: new Uint32Array(tris.length), epos: new Float32Array(6 * segs.length), edgeOf: new Uint32Array(segs.length) };
  tris.forEach(([face, ...v], t) => { out.faceOf[t] = face; v.forEach((q, c) => { out.pos.set(q.slice(0, 3), 9 * t + 3 * c); out.nrm.set(q.slice(3), 9 * t + 3 * c); out.idx[3 * t + c] = 3 * t + c; }); });
  segs.forEach(([edge, a, b], s) => { out.edgeOf[s] = edge; out.epos.set(a, 6 * s); out.epos.set(b, 6 * s + 3); });
  return out;
}

/** The triangles of one face of a mesh, as a region of the solver reads them : 9 numbers each. */
export function faceTris(mesh, faceId) {
  const out = []; for (let t = 0; t < mesh.faceOf.length; t++) if (mesh.faceOf[t] === faceId) for (let c = 0; c < 3; c++) { const i = 3 * mesh.idx[3 * t + c]; out.push(mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]); }
  return Float32Array.from(out);
}
