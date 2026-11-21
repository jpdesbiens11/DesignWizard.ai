/* DesignWizard.ai — Simulation : the places of a condition on the real geometry.
   A support, a load, a heat source is set on the product itself : any of its faces (plane, cylindrical, sloped, inside a housing),
   any of its edges, any of its points — one, or several chosen together (Ctrl + click) — and, on a model reduced by a cut, the face
   the cut leaves. A place is a short list of such items, kept in st.places under a key (« place:3 ») that the load case refers to ;
   the solver reads it as triangles, lines and points (analysis/fea/entity.js). What the view shows is the part as the kernel built
   it, so a face is the face of the part, whatever the cubes of the mesh look like.
   Pure enough to be read alone : it draws through the viewer it is given and keeps no state of its own. */

import { edgeLine, measureOf } from "../core/view_select.js";
import { lightFace } from "../core/view_marks.js";
import { faceTris } from "../core/mesh_clip.js";
import { CALC_UNITS } from "../core/units.js";

const AX = "XYZ", r2 = (v) => Math.round(v * 100) / 100;
export const CUT_FIELD = "feacut";      // the object of the view that is the face of a cut
export const bodyId = (k) => `b${k}`, bodyOf = (id) => (/^b\d+$/.test(String(id)) ? parseInt(String(id).slice(1), 10) : -1);

/** What an item is made of, to know it again when the geometry is built anew : its kind, its size, where it is. */
function signature(item, geo) {
  if (item.kind === "cut") return `cut:${item.axis}`;
  if (item.kind === "point") return `pt:${item.at.map(r2).join(",")}`;
  const mesh = geo.bodies[item.body] && geo.bodies[item.body].mesh; if (!mesh) return null;
  if (item.kind === "edge") { const l = edgeLine(mesh, item.edgeId); return l.length ? `e:${l.length}:${l[0].map(r2).join(",")}:${l[l.length - 1].map(r2).join(",")}` : null; }
  const t = faceTris(mesh, item.faceId); if (!t.length) return null;
  const c = [0, 0, 0]; for (let i = 0; i < t.length; i += 3) for (let d = 0; d < 3; d++) c[d] += t[i + d];
  return `f:${t.length / 9}:${c.map((v) => r2(v / (t.length / 3))).join(",")}`;
}
/** An entity of the view (what its selection holds, or a point clicked on a face) as an item of a place — or null. */
export function placeItem(x, geo) {
  if (!x) return null;
  let item = null;
  if (x.kind === "point") item = { kind: "point", at: x.at.map(Number) };
  else if (x.id === CUT_FIELD) { const n = (x.normal || [1, 0, 0]).map(Math.abs); item = { kind: "cut", axis: n.indexOf(Math.max(...n)) }; }
  else if (bodyOf(x.id) < 0) return null;
  else if (x.kind === "face" && x.faceId >= 0) item = { kind: "face", body: bodyOf(x.id), faceId: x.faceId };
  else if (x.kind === "edge") item = { kind: "edge", body: bodyOf(x.id), edgeId: x.edgeId };
  else if (x.kind === "vertex") item = { kind: "point", at: x.at.map(Number) };
  if (!item) return null;
  const sig = signature(item, geo); return sig ? { ...item, sig } : null;
}
/** The words of a place : what one item is and measures, or how many of each. */
export function placeLabel(items, geo) {
  const word = (it) => {
    if (it.kind === "cut") return `Face de coupe ${AX[it.axis]}`;
    if (it.kind === "point") return measureOf([{ kind: "vertex", at: it.at }], CALC_UNITS);
    const mesh = geo.bodies[it.body].mesh, own = geo.bodies.length > 1 ? ` — ${geo.bodies[it.body].name}` : "";
    return (it.kind === "edge" ? measureOf([{ kind: "edge", edge: mesh.edges[it.edgeId] || {} }], CALC_UNITS) : measureOf([{ kind: "face", face: mesh.faces[it.faceId] }], CALC_UNITS)) + own;
  };
  if (items.length === 1) return word(items[0]);
  const n = (k) => items.filter((x) => x.kind === k).length, part = (c, one, many) => (c ? `${c} ${c > 1 ? many : one}` : null);
  return [part(n("face"), "face", "faces"), part(n("edge"), "arête", "arêtes"), part(n("point"), "point", "points"), part(n("cut"), "face de coupe", "faces de coupe")].filter(Boolean).join(" · ");
}
/** The key of the place made of these items : the one that already holds exactly them, or a new one. → key, or null when nothing can be held */
export function placeKey(st, items, geo) {
  const list = items.filter(Boolean); if (!list.length) return null;
  const sig = list.map((x) => x.sig).sort().join("|");
  for (const [key, p] of Object.entries(st.places)) if (p.items.map((x) => x.sig).sort().join("|") === sig) return key;
  st.placeSeq = (st.placeSeq || 0) + 1; const key = `place:${st.placeSeq}`;
  st.places[key] = { items: list, label: placeLabel(list, geo) }; return key;
}
/** A place as the solver reads it : one region, its items together. The object is kept on the place, so the mesh is searched once. */
export function placeRegion(place, geo) {
  if (place.region) return place.region;
  const any = place.items.map((it) => (it.kind === "cut" ? { cut: it.axis } : it.kind === "point" ? { near: it.at, r: 0 } : it.kind === "edge" ? { path: edgeLine(geo.bodies[it.body].mesh, it.edgeId) } : { tris: faceTris(geo.bodies[it.body].mesh, it.faceId) }));
  place.region = { any }; return place.region;
}
/** After the geometry is built anew : does each place still name what it named ? A place whose item changed is `gone`. */
export function checkPlaces(st, geo) {
  for (const p of Object.values(st.places)) { delete p.region; p.gone = p.items.some((it) => (it.kind === "cut" ? !(st.cuts || []).some((c) => !c.off && c.axis === it.axis) : signature(it, geo) !== it.sig)); if (!p.gone) p.label = placeLabel(p.items, geo); }
}
/** The outward direction of the first face of a place (the mean of its triangles), or null : where a new load points from. */
export function placeNormal(place, geo) {
  const it = place.items.find((x) => x.kind === "face"); if (!it) return null;
  const t = faceTris(geo.bodies[it.body].mesh, it.faceId), n = [0, 0, 0];
  for (let o = 0; o < t.length; o += 9) { const u = [t[o + 3] - t[o], t[o + 4] - t[o + 1], t[o + 5] - t[o + 2]], v = [t[o + 6] - t[o], t[o + 7] - t[o + 1], t[o + 8] - t[o + 2]]; n[0] += u[1] * v[2] - u[2] * v[1]; n[1] += u[2] * v[0] - u[0] * v[2]; n[2] += u[0] * v[1] - u[1] * v[0]; }
  const l = Math.hypot(n[0], n[1], n[2]); return l > 1e-9 ? n.map((c) => c / l) : null;
}
/** Where a place is, as points with their outward direction : for its symbols and its label. n : about how many per item.
    centre : the middle of the product (an edge, a point look away from it) ; cutAt(axis) → { at, keep, box } of a cut plane. */
export function placeSpots(place, geo, n, centre, cutAt) {
  const out = [], away = (p) => { const d = p.map((c, i) => c - centre[i]), a = d.map(Math.abs), k = a.indexOf(Math.max(...a)), v = [0, 0, 0]; v[k] = d[k] < 0 ? -1 : 1; return v; };
  for (const it of place.items) {
    if (it.kind === "point") { out.push({ p: it.at, out: away(it.at) }); continue; }
    if (it.kind === "cut") { const c = cutAt ? cutAt(it.axis) : null; if (!c) continue; const [u, v] = [0, 1, 2].filter((d) => d !== it.axis), dir = [0, 0, 0]; dir[it.axis] = -c.keep;
      for (let i = 0; i < n; i++) { const p = [0, 0, 0]; p[it.axis] = c.at; p[u] = c.box[u] + (c.box[u + 3] - c.box[u]) * (i + 0.5) / n; p[v] = (c.box[v] + c.box[v + 3]) / 2; out.push({ p, out: dir }); } continue; }
    const mesh = geo.bodies[it.body].mesh;
    if (it.kind === "edge") { const l = edgeLine(mesh, it.edgeId); for (let i = 0; i < Math.min(n, l.length); i++) { const p = l[Math.min(l.length - 1, Math.floor((i + 0.5) * l.length / Math.min(n, l.length)))]; out.push({ p, out: away(p) }); } continue; }
    /* a face : a few of its triangles, the largest of each stretch of its list — spread over it, each with its own outward direction */
    const t = faceTris(mesh, it.faceId), count = t.length / 9, want = Math.min(count, Math.max(1, n * n)), per = count / want;
    for (let k = 0; k < want; k++) {
      let best = -1, area = -1, dir = null;
      for (let j = Math.floor(k * per); j < Math.floor((k + 1) * per) && j < count; j++) { const o = 9 * j, u = [t[o + 3] - t[o], t[o + 4] - t[o + 1], t[o + 5] - t[o + 2]], v = [t[o + 6] - t[o], t[o + 7] - t[o + 1], t[o + 8] - t[o + 2]], c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], a = Math.hypot(c[0], c[1], c[2]); if (a > area) { area = a; best = o; dir = c.map((x) => x / (a || 1)); } }
      if (best >= 0) out.push({ p: [0, 1, 2].map((d) => (t[best + d] + t[best + 3 + d] + t[best + 6 + d]) / 3), out: dir });
    }
  }
  return out;
}
/** Lights up a place in the view : its faces, its edges, its points. */
export function lightPlace(viewer, place, geo, color, tag) {
  for (const it of place.items) {
    if (it.kind === "face") lightFace(viewer, bodyId(it.body), it.faceId, { color, tag, opacity: 0.55 });
    else if (it.kind === "edge") { const l = edgeLine(geo.bodies[it.body].mesh, it.edgeId); if (l.length > 1) viewer.addPath(l, color, tag, 1.4); }
    else if (it.kind === "point") viewer.addMarker(it.at, color, tag, 1.6);
  }
}
/** What a place can take : a pressure and convection need a face ; an edge or a point takes a force, a power, a temperature, a support. */
export const placeHasFace = (place) => place.items.some((x) => x.kind === "face" || x.kind === "cut");
