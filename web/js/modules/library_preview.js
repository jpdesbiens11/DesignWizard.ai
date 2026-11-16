/* DesignWizard.ai — Bibliothèque : the 3D previews. Each family of connectors shows the indicative shape of its kind — the
   very solids its part will be made of (core/connector_shapes.js) — as a small picture on its card, and as a live view,
   to turn with the mouse, in the dialog that adds it. No kernel : the solids are boxes and cylinders, meshed here. One
   hidden view draws every picture, once ; the pictures are kept. A cell and a thermal pad have theirs too. */

import { Viewer } from "../core/viewer.js";
import { boxMesh, cylMesh } from "../analysis/physics/scene3d.js";
import { connectorSolids, TONES } from "../core/connector_shapes.js";
import { connectorEnvelope, poleNets, defaultPoles } from "../core/elec_parts.js";

const AXIS = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
/** What a connector would be made of, with the defaults of the « add » dialog unless said : { poles, mount }. */
export function previewOptions(c, o = {}) {
  const hv = c.domain === "hv", poles = Math.max(1, Math.round(o.poles || defaultPoles(c))), panel = (o.mount || (hv || c.kind === "circular" || c.sealed ? "panel" : "board")) === "panel", E = connectorEnvelope(c, poles);
  return { E, poles, panel, nets: poleNets(c, poles, o.net), e: panel ? Math.max(4, E.H * 0.25) : 0 };
}
/** The solids of a connector as coloured meshes. size : the largest dimension they are brought to (a 2 mm connector and a 90 mm
    one fill the same picture) ; 0 keeps the millimetres. */
export function previewMeshes(c, o = {}, size = 0) {
  const P = previewOptions(c, o), solids = connectorSolids(c, P.E, P), k = size > 0 ? size / Math.max(P.E.L, P.E.W, P.E.H, 1) : 1, hv = c.domain === "hv" ? "hv" : "lv";
  return solids.map((s) => { const at = s.at.map((v) => v * k), color = s.cut ? TONES.cut : s.tone === "housing" || !s.tone ? TONES.housing[hv] : TONES[s.tone];
    if (s.shape === "box") { const sz = s.size.map((v) => v * k); return { id: s.id, color, mesh: boxMesh(at.map((v, i) => v + sz[i] / 2), sz) }; }
    const ax = AXIS[s.axis] || AXIS.Z, h = s.h * k; return { id: s.id, color, mesh: cylMesh(at, at.map((v, i) => v + ax[i] * h), s.d * k / 2, 24) }; });
}
export const cellMeshes = (cell, size = 40) => { const k = size / cell.L, r = cell.d * k / 2, L = cell.L * k; return [{ id: "godet", color: "#3b6fb5", mesh: cylMesh([0, 0, 0], [0, 0, L * 0.94], r, 32) }, { id: "epaule", color: "#d7dbe0", mesh: cylMesh([0, 0, L * 0.94], [0, 0, L * 0.97], r * 0.96, 32) }, { id: "plot", color: "#c8cdd3", mesh: cylMesh([0, 0, L * 0.97], [0, 0, L], r * 0.42, 32) }]; };

/** The diagonal of the box that holds a set of meshes. */
export function diagonalOf(meshes) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of meshes) for (let i = 0; i < m.mesh.pos.length; i += 3) for (let a = 0; a < 3; a++) { const v = m.mesh.pos[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  return Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
}
/** Shows meshes in a viewer, framed — or, with « frame » (a diagonal), in the frame of a larger neighbour, so that sizes compare. */
export function showMeshes(viewer, meshes, frame = 0) {
  viewer.clear(); for (const m of meshes) viewer.add({ id: m.id, mesh: m.mesh, color: m.color, pickable: false });
  viewer.view("iso"); viewer.fit(1.12);
  if (frame > 0) { viewer.span = Math.max(viewer.span, frame * 1.12 * 0.88 / Math.min(1, viewer.w / viewer.h)); viewer.dirty = true; }
}
let stage = null;
const cache = new Map();
/** A picture (PNG data URL) of a set of meshes, drawn by one hidden view and kept under its key. "" when the browser has no 3D. */
export function pictureOf(key, make, frame = 0) {
  if (cache.has(key)) return cache.get(key);
  let url = "";
  try {
    if (!stage) { const host = document.createElement("div"); host.className = "lib-stage"; host.setAttribute("aria-hidden", "true"); document.body.append(host); stage = new Viewer(host, {}); stage.resize(); }
    showMeshes(stage, make(), frame); url = stage.snapshot();
  } catch (e) { url = ""; }
  cache.set(key, url); return url;
}
const largest = (c) => { const E = previewOptions(c).E; return Math.max(E.L, E.W, E.H, 1); };
/** The pictures of the families of one kind, drawn at one scale : the largest fills its picture, the others show how much smaller they are
    (never under a third, to stay readable). → Map family id → data URL */
export function connectorPictures(list) {
  const out = new Map(); if (!list.length) return out;
  const ref = list.reduce((m, c) => Math.max(m, largest(c)), 0), big = list.find((c) => largest(c) === ref), frame = diagonalOf(previewMeshes(big, {}, 40));
  for (const c of list) { const size = 40 * Math.max(1 / 3, largest(c) / ref); out.set(c.id, pictureOf(`cn:${c.id}:${Math.round(ref)}`, () => previewMeshes(c, {}, size), frame)); }
  return out;
}
export const cellPicture = (cell) => pictureOf(`cell:${cell.id}`, () => cellMeshes(cell));
/** A live view of a connector in a host element : { show(o), dispose() } — it is redrawn when the poles or the mounting change. */
export function livePreview(host, c) {
  const viewer = new Viewer(host, {}); viewer.resize();
  return { show: (o) => showMeshes(viewer, previewMeshes(c, o, 0)), dispose: () => { try { viewer.dispose(); } catch (e) { /* already gone */ } } };
}
