/* DynamiteOrbit.ai — the artwork of a label as a picture : its SVG (core/labels.js) drawn once on a canvas, kept, and laid as a
   texture on the patch that wraps the label on its part. Shared by the Labels screen and the marketing render. */

import { labelSvg, labelPatch } from "./labels.js";

const cache = new Map(), MAX = 2048;
/** The canvas of a label, at about 10 pixels per millimetre (never more than 2048 on its long side). → Promise<canvas | null> */
export function rasterLabel(label) {
  const px = Math.max(1, Math.min(10, MAX / Math.max(label.w, label.h))), key = JSON.stringify([label.w, label.h, label.art, label.name, px]);
  if (cache.has(key)) return cache.get(key);
  const job = new Promise((resolve) => {
    const img = new Image(), w = Math.max(2, Math.round(label.w * px)), h = Math.max(2, Math.round(label.h * px));
    img.onload = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); resolve(c); };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(labelSvg(label, { px }))}`;
  });
  if (cache.size > 60) cache.clear();
  cache.set(key, job); return job;
}
/** Lays the labels of an assembly in a viewer : one textured patch each, on the instance that carries it. placements : instance id → matrix ;
    hidden : ids of the instances not shown. Returns the ids added ("label/E1"…). Labels still to be placed are skipped. */
export async function showLabels(viewer, labels, placements, o = {}) {
  const ids = [], wanted = (labels || []).filter((l) => l.on && l.inst && placements[l.inst] && !(o.hidden && o.hidden.has(l.inst)));
  const pictures = await Promise.all(wanted.map((l) => rasterLabel(l)));
  if (o.alive && !o.alive()) return ids;
  for (const k of [...viewer.objects.keys()]) if (k.startsWith("label/")) viewer.remove(k);
  wanted.forEach((l, k) => { const mesh = labelPatch(l); if (!mesh || !pictures[k]) return; const id = `label/${l.id}`;
    viewer.add({ id, name: l.name || l.id, mesh, map: pictures[k], matrix: placements[l.inst], pickable: true, data: { label: l.id, inst: l.inst } }); ids.push(id); });
  return ids;
}
