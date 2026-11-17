/* DesignWizard.ai — pointing at the model : what lies under the cursor (a face, an edge when the cursor is on one,
   a point when it is on the end of an edge), the selection the designer builds with clicks — one entity, or several
   with Ctrl + click — what it measures, and the menu a right click opens. A screen owns a selection, asks it what
   is chosen, and offers the gestures that make sense for it. */

import { el, icon } from "./dom.js";
import { lightFace } from "./view_marks.js";
import { getUnits, measure, shownNumber, shownUnit, converts } from "./units.js";

export const SEL = { chosen: "#ff8a00", hover: "#35c2ff" };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), r3 = (v) => Math.round(v * 1000) / 1000;
const segDist = (p, e, k) => { const ax = e[k], ay = e[k + 1], az = e[k + 2], dx = e[k + 3] - ax, dy = e[k + 4] - ay, dz = e[k + 5] - az, l2 = dx * dx + dy * dy + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy + (p[2] - az) * dz) / l2)) : 0; return Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy, p[2] - az - t * dz); };

/** The points of one edge of a mesh, in its own coordinates : [[x, y, z], …] ; and its middle. */
export function edgeLine(mesh, edgeId) {
  const pts = [], e = mesh.epos, of = mesh.edgeOf;
  for (let k = 0; k < of.length; k++) if (of[k] === edgeId) { if (!pts.length) pts.push([e[6 * k], e[6 * k + 1], e[6 * k + 2]]); pts.push([e[6 * k + 3], e[6 * k + 4], e[6 * k + 5]]); }
  return pts;
}
export const edgeMid = (mesh, edgeId) => { const p = edgeLine(mesh, edgeId), E = mesh.edges[edgeId]; return E && E.type === "line" && E.p0 && E.p1 ? E.p0.map((c, i) => r3((c + E.p1[i]) / 2)) : p.length ? p[Math.floor(p.length / 2)].map(r3) : null; };

/** What a pick points at. tol = how close (model units) the picked point must be to an edge, or to its end, to mean it.
    → { kind: "face" | "edge" | "vertex", key, id, at, face, faceId, edge, edgeId, normal, hit } or null */
export function entityOf(hit, mesh, tol) {
  if (!hit) return null;
  const P = hit.local || hit.point;
  if (mesh && mesh.epos && mesh.edges && mesh.edgeOf && tol > 0) {
    let best = -1, bd = Infinity;
    for (let k = 0; k < mesh.edgeOf.length; k++) { const d = segDist(P, mesh.epos, 6 * k); if (d < bd) { bd = d; best = mesh.edgeOf[k]; } }
    if (best >= 0 && bd <= tol) {
      const E = mesh.edges[best];
      if (!E.full) for (const end of [E.p0, E.p1]) if (end && dist(P, end) <= 1.4 * tol) return { kind: "vertex", key: `v:${hit.id}:${end.map(r3).join(",")}`, id: hit.id, at: end.map(r3), hit };
      return { kind: "edge", key: `e:${hit.id}:${best}`, id: hit.id, edgeId: best, edge: E, at: edgeMid(mesh, best), hit };
    }
  }
  return { kind: "face", key: `f:${hit.id}:${hit.faceId}`, id: hit.id, faceId: hit.faceId, face: hit.face, at: P.map(r3), normal: hit.normal, hit };
}

/** What a selection measures, in plain words : the size of one entity, the distance between two — in the units given (core/units.js ; millimetres without). → text */
export function measureOf(items, units) {
  const L = (v) => measure(v, "mm", 2, units), A = (v) => measure(v, "mm²", 2, units), conv = converts("mm", units), tag = conv ? ` ${shownUnit("mm", units)}` : "", f2 = (v) => String(shownNumber(v, "mm", 2, units)).replace(".", ",");
  const one = (x) => (x.kind === "vertex" ? `Point (${x.at.map(f2).join(" ; ")})${tag}` : x.kind === "edge" ? (x.edge.type === "circle" ? `Arête circulaire Ø ${f2(2 * x.edge.r)}${tag}${x.edge.len ? ` · ${L(x.edge.len)}` : ""}` : `Arête${x.edge.type === "line" ? " droite" : ""} · ${L(x.edge.len || 0)}`)
    : !x.face ? "Surface" : x.face.type === "plane" ? `Face plane${x.face.area ? ` · ${A(x.face.area)}` : ""}` : x.face.type === "cylinder" ? `Cylindre Ø ${f2(2 * x.face.r)}${tag}${x.face.inner ? " (alésage)" : ""}` : `Surface ${x.face.type}`);
  if (!items.length) return "";
  if (items.length === 1) return one(items[0]);
  if (items.length === 2) {
    const [a, b] = items, plane = (x) => x.kind === "face" && x.face && x.face.type === "plane", axis = (x) => (x.kind === "face" && x.face && x.face.type === "cylinder" ? { o: x.face.o, d: x.face.axis } : x.kind === "edge" && x.edge.type === "circle" && x.edge.c && x.edge.axis ? { o: x.edge.c, d: x.edge.axis } : null);
    if (a.kind === "vertex" && b.kind === "vertex") return `Distance ${L(dist(a.at, b.at))} (ΔX ${f2(Math.abs(a.at[0] - b.at[0]))} · ΔY ${f2(Math.abs(a.at[1] - b.at[1]))} · ΔZ ${f2(Math.abs(a.at[2] - b.at[2]))}${tag})`;
    if (plane(a) && plane(b)) { const n = a.face.n, dot = Math.abs(n[0] * b.face.n[0] + n[1] * b.face.n[1] + n[2] * b.face.n[2]); if (dot > 0.9995) return `${L(Math.abs((b.at[0] - a.at[0]) * n[0] + (b.at[1] - a.at[1]) * n[1] + (b.at[2] - a.at[2]) * n[2]))} entre faces parallèles`; return `Angle ${String(Math.round(Math.acos(Math.min(1, dot)) * 18000 / Math.PI) / 100).replace(".", ",")}° entre les faces`; }
    const pl = plane(a) ? a : plane(b) ? b : null, other = pl === a ? b : a;
    if (pl && other.kind !== "face") return `${L(Math.abs((other.at[0] - pl.at[0]) * pl.face.n[0] + (other.at[1] - pl.at[1]) * pl.face.n[1] + (other.at[2] - pl.at[2]) * pl.face.n[2]))} du ${other.kind === "vertex" ? "point" : "milieu de l'arête"} à la face`;
    const xa = axis(a), xb = axis(b);
    if (xa && xb && xa.o && xb.o && xa.d && xb.d) { const w = [xb.o[0] - xa.o[0], xb.o[1] - xa.o[1], xb.o[2] - xa.o[2]], t = w[0] * xa.d[0] + w[1] * xa.d[1] + w[2] * xa.d[2]; return `Entraxe ${L(Math.hypot(w[0] - t * xa.d[0], w[1] - t * xa.d[1], w[2] - t * xa.d[2]))}`; }
    return `Distance ${L(dist(a.at, b.at))} entre les deux éléments`;
  }
  const n = (k) => items.filter((x) => x.kind === k).length, part = (c, one1, many) => (c ? `${c} ${c > 1 ? many : one1}` : null), len = items.filter((x) => x.kind === "edge").reduce((s, x) => s + (x.edge.len || 0), 0);
  return [part(n("face"), "face", "faces"), part(n("edge"), "arête", "arêtes"), part(n("vertex"), "point", "points")].filter(Boolean).join(" · ") + (len ? ` · ${L(len)} d'arêtes` : "");
}

/** An entity seen in the frame of the view. m = the 16 elements of the matrix of its object (column-major) : points move and turn,
    directions only turn. A part alone has the identity ; in an assembly each part stands where its mates put it. */
export function inWorld(x, m) {
  if (!x || !m) return x;
  const pt = (p) => (p ? [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] : p);
  const dir = (d) => { if (!d) return d; const v = [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]], l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((c) => c / l); };
  return { ...x, at: pt(x.at), ...(x.face ? { face: { ...x.face, ...(x.face.n ? { n: dir(x.face.n) } : {}), ...(x.face.o ? { o: pt(x.face.o) } : {}), ...(x.face.axis ? { axis: dir(x.face.axis) } : {}) } } : {}),
    ...(x.edge ? { edge: { ...x.edge, ...(x.edge.c ? { c: pt(x.edge.c) } : {}), ...(x.edge.axis ? { axis: dir(x.edge.axis) } : {}), ...(x.edge.p0 ? { p0: pt(x.edge.p0) } : {}), ...(x.edge.p1 ? { p1: pt(x.edge.p1) } : {}) } } : {}) };
}

/** The selection of a view. onChange(items) is called after each change. */
export function createSelection(viewer, onChange) {
  const items = new Map(); let hovered = null;
  const tol = () => 7 * viewer.span / Math.max(1, viewer.h);
  const meshOf = (id) => { const o = viewer.objects.get(id); return o ? o.def.mesh : null; };
  const world = (id, p) => { const o = viewer.objects.get(id); if (!o) return p; const m = o.group.matrixWorld.elements; return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; };
  const paint = (x, color, tag) => {
    if (x.kind === "face") lightFace(viewer, x.id, x.faceId, { color, tag, opacity: tag === "sel" ? 0.62 : 0.4 });
    else if (x.kind === "edge") { const pts = edgeLine(meshOf(x.id) || { epos: [], edgeOf: [] }, x.edgeId).map((p) => world(x.id, p)); if (pts.length > 1) viewer.addPath(pts, color, tag, tag === "sel" ? 1.5 : 1.2); }
    else viewer.addMarker(world(x.id, x.at), color, tag, tag === "sel" ? 1.3 : 1.1);
  };
  const draw = () => { viewer.clearOverlays("sel"); for (const x of items.values()) paint(x, SEL.chosen, "sel"); if (onChange) onChange([...items.values()]); };
  return {
    at: (hit) => (hit ? entityOf(hit, meshOf(hit.id), tol()) : null),
    items: () => [...items.values()], has: (x) => !!x && items.has(x.key), count: () => items.size,
    /** A click : alone it replaces the selection (or clears it in the void) ; with `add` (Ctrl) it adds the entity, or takes it out. */
    click(x, add) { if (!x) { if (!add && items.size) { items.clear(); draw(); } return; } if (add) { if (items.has(x.key)) items.delete(x.key); else items.set(x.key, x); } else { const only = items.size === 1 && items.has(x.key); items.clear(); if (!only) items.set(x.key, x); } draw(); },
    set(list) { items.clear(); for (const x of list) items.set(x.key, x); draw(); },
    clear() { if (items.size) { items.clear(); draw(); } },
    hover(x) { const k = x ? x.key : null; if (k === hovered) return; hovered = k; viewer.clearOverlays("selhover"); if (x && !items.has(x.key)) paint(x, SEL.hover, "selhover"); },
    redraw: draw, measure: () => measureOf([...items.values()].map((x) => { const o = viewer.objects.get(x.id); return o ? inWorld(x, o.group.matrixWorld.elements) : x; }), getUnits()),
  };
}

/** A menu at the cursor. items : { label, keys, icon, run, disabled } · "—" (a line) · { title } ; closes on a choice, a click elsewhere or Escape. */
export function popupMenu(e, items) {
  document.querySelectorAll(".ctx-menu").forEach((n) => n.remove());
  const m = el("div", { class: "menu ctx-menu", role: "menu" }), close = () => { m.remove(); document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key, true); };
  const away = (ev) => { if (!m.contains(ev.target)) close(); }, key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } };
  for (const it of items) {
    if (!it) continue;
    if (it === "—") { if (m.lastChild && !m.lastChild.classList.contains("ctx-line")) m.append(el("div", { class: "ctx-line" })); continue; }
    if (it.title) { m.append(el("div", { class: "ctx-title" }, it.title)); continue; }
    m.append(el("button", { type: "button", class: "menu-item", role: "menuitem", disabled: !!it.disabled, onClick: () => { close(); it.run(); } }, icon(it.icon || "chevron-right"), el("span", { class: "grow" }, it.label), it.keys ? el("kbd", null, it.keys) : null));
  }
  document.body.append(m);
  const r = m.getBoundingClientRect(); m.style.left = `${Math.max(4, Math.min(e.clientX, window.innerWidth - r.width - 6))}px`; m.style.top = `${Math.max(4, Math.min(e.clientY, window.innerHeight - r.height - 6))}px`;
  setTimeout(() => { document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", key, true); }, 0);
  return { close };
}
