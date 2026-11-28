/* DynamiteOrbit.ai — the pattern and the sheen of a look, laid on a mesh of a 3D view. The tile of a pattern (core/look_patterns.js)
   is drawn once on a canvas and repeats ; a mesh that has no texture coordinates gets them from a box projection, one tile every
   `period` millimetres (core/render_looks.js boxUv) — in the coordinates of the part, so that every instance of a part wears the
   same cloth. The tiles are shared by every view : they are never disposed with a mesh. Also the little pictures of a pattern
   for a swatch and a picker. Needs a page (canvas) and three.js ; the numbers are in core/look_patterns.js. */

import * as THREE from "../../vendor/three/three.module.min.js";
import { PATTERNS, SHEENS, DEFAULT_SHEEN, patternRgba, validPattern, validSheen } from "./look_patterns.js";
import { boxUv } from "./render_looks.js";

const canvases = new Map(), urls = new Map(), textures = new Map();
/** The tile of a pattern as a canvas of n × n pixels (kept). */
export function patternCanvas(id, n = 256) {
  const key = `${id}:${n}`; if (canvases.has(key)) return canvases.get(key);
  const c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d"), img = g.createImageData(n, n); img.data.set(patternRgba(id, n)); g.putImageData(img, 0, 0);
  canvases.set(key, c); return c;
}
/** The same as an address a style can show (a swatch, a cell of the picker). */
export function patternUrl(id, n = 64) { const key = `${id}:${n}`; if (!urls.has(key)) urls.set(key, patternCanvas(id, n).toDataURL("image/png")); return urls.get(key); }
/** The tile as a texture that repeats. */
export function patternTexture(id) {
  if (textures.has(id)) return textures.get(id);
  const t = new THREE.CanvasTexture(patternCanvas(id, 256)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (PATTERNS[id].style === "digital") t.magFilter = THREE.NearestFilter;      // square pixels stay square from close
  textures.set(id, t); return t;
}
/** Lays a look on a mesh of a view. mesh : a THREE.Mesh with a standard material ; src : { pos, nrm } (the mesh as the kernel gave it) ;
    look : { pattern, sheen } — a pattern that is gone gives the colour back to the caller, who knows it. */
export function paintLook(mesh, src, look) {
  const m = mesh.material, id = validPattern(look && look.pattern), P = id && PATTERNS[id], S = SHEENS[validSheen(look && look.sheen) || DEFAULT_SHEEN];
  m.roughness = S.rough; m.metalness = S.metal;
  if (P) {
    if (!src._uv || src._uv.period !== P.period) src._uv = { period: P.period, uv: boxUv(src.pos, src.nrm, P.period) };      // worked out once a mesh and a period
    mesh.geometry.setAttribute("uv", new THREE.BufferAttribute(src._uv.uv, 2)); m.map = patternTexture(id); m.color.set("#ffffff");
  } else if (m.userData.pattern) m.map = null;
  m.userData.pattern = P ? id : null; m.needsUpdate = true;
  return mesh;
}
