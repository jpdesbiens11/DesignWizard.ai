/* DynamiteOrbit — a set of the photo studio, built : the ground with its relief and its matter, the water, the dome of the
   sky, and what stands around (core/photo_sets.js says what ; this file makes the meshes). Everything is in UNITS and sits in
   one group that the stage scales to the product and puts under it. The tiles of the grounds are shared and kept ; what a
   set builds for itself is freed with it. Needs a page (canvas) and three.js. */

import * as THREE from "../../vendor/three/three.module.min.js";
import { SETS, setHeight, setWet, paintSky, groundTile, groundFinish, facadeTile, setProps, fbm } from "./photo_sets.js";

const FAR = 330;                                               // how far the ground and the water go, in units : past the fog
const canvasOf = (n, m, fill) => { const c = document.createElement("canvas"); c.width = n; c.height = m; const g = c.getContext("2d"), img = g.createImageData(n, m); fill(img.data); g.putImageData(img, 0, 0); return c; };
const tiles = new Map();
/* the two textures of a ground : its tint and its bumps — made once, shared by every stage */
function tileOf(kind) {
  if (tiles.has(kind)) return tiles.get(kind);
  const n = 256, T = groundTile(kind, n), map = new THREE.CanvasTexture(canvasOf(n, n, (d) => d.set(T.rgba))), bump = new THREE.CanvasTexture(canvasOf(n, n, (d) => { for (let i = 0; i < n * n; i++) { d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = T.bump[i]; d[4 * i + 3] = 255; } }));
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; } map.colorSpace = THREE.SRGBColorSpace;
  tiles.set(kind, { map, bump }); return tiles.get(kind);
}
let waves = null, facade = null;
const wavesTex = () => { if (!waves) { const n = 256; waves = new THREE.CanvasTexture(canvasOf(n, n, (d) => { const T = groundTile("snow", n).bump, S = groundTile("sand", n).bump; for (let i = 0; i < n * n; i++) { d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = 0.55 * T[i] + 0.45 * S[i]; d[4 * i + 3] = 255; } })); waves.wrapS = waves.wrapT = THREE.RepeatWrapping; waves.anisotropy = 8; } return waves; };
const facadeTex = () => { if (!facade) { facade = new THREE.CanvasTexture(canvasOf(128, 128, (d) => d.set(facadeTile(128, 4, 4, 3)))); facade.wrapS = facade.wrapT = THREE.RepeatWrapping; facade.colorSpace = THREE.SRGBColorSpace; facade.anisotropy = 8; } return facade; };

/** The sky of a set as a canvas that wraps the world (the sun where the light of kind « sun » stands). */
export function skyCanvas(id, sun = null, w = 1024) { const S = SETS[id] || SETS.studio; return canvasOf(w, w / 2, (d) => d.set(paintSky(S.sky, sun, w, w / 2))); }
/** A dome that wears a sky, for a world where Z is up : its texture reads by direction as paintSky wrote it. */
export function skyDome(texture, radius) { const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false })); m.rotation.x = Math.PI / 2; m.renderOrder = -10; return m; }

/* the grain of a ground is seen from close only : past these distances (units) its bumps fade, band after band — far away a dune is smooth */
const NEAR = [6, 11, 19, 34], FADE = [1, 0.6, 0.3, 0.12, 0];
/* the land : rings that widen with the distance, so that the ground is fine under the product and coarse at the horizon */
function terrain(id, pad, S) {
  const NS = 144, NR = 150, g = 1.04, a = FAR / (Math.pow(g, NR) - 1), pos = new Float32Array((NR + 1) * NS * 3), uv = new Float32Array((NR + 1) * NS * 2), col = new Float32Array((NR + 1) * NS * 3), idx = [];
  const wet = [0.5, 0.52, 0.56];
  for (let k = 0; k <= NR; k++) { const p = a * (Math.pow(g, k) - 1);
    for (let s = 0; s < NS; s++) { const t = (s / NS) * 2 * Math.PI, x = p * Math.cos(t), y = p * Math.sin(t), o = k * NS + s, h = setHeight(id, x, y, pad), w = setWet(id, x, y, pad), tone = 0.9 + 0.2 * fbm(x * 0.03 + 9, y * 0.03 + 4, 3, 3), foam = S.water ? Math.max(0, 1 - Math.abs(h - S.water.level - 0.02) / 0.05) : 0;
      pos[3 * o] = x; pos[3 * o + 1] = y; pos[3 * o + 2] = h; uv[2 * o] = x / S.ground.tile; uv[2 * o + 1] = y / S.ground.tile;
      for (let c = 0; c < 3; c++) col[3 * o + c] = Math.min(1, (tone * (1 - w) + tone * wet[c] * w) * (1 - foam) + foam); } }
  const geo = new THREE.BufferGeometry(); let band = 0, from = 0;
  for (let k = 0; k < NR; k++) { const p = a * (Math.pow(g, k) - 1), b = NEAR.findIndex((d) => p < d) < 0 ? NEAR.length : NEAR.findIndex((d) => p < d); if (b !== band) { geo.addGroup(from, idx.length - from, band); band = b; from = idx.length; }
    for (let s = 0; s < NS; s++) { const a0 = k * NS + s, a1 = k * NS + ((s + 1) % NS), b0 = a0 + NS, b1 = a1 + NS; if (k > 0) idx.push(a0, b1, a1); idx.push(a0, b0, b1); } }      // wound so that the land faces the sky
  geo.addGroup(from, idx.length - from, band);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
/* many flat rectangles laid on the ground in one mesh : painted lines */
function paintGeo(rects, z) { const pos = [], idx = []; rects.forEach(([x0, x1, y0, y1], i) => { pos.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z); idx.push(4 * i, 4 * i + 1, 4 * i + 2, 4 * i, 4 * i + 2, 4 * i + 3); }); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
/* a lump : a ball whose points are pushed in and out — a rock, the crown of a tree */
function lump(seed, rough = 0.25) { const g = new THREE.IcosahedronGeometry(1, 2), p = g.getAttribute("position"); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + rough * (fbm(x * 1.7 + seed * 3.1, y * 1.7 + z * 1.3, 5 + seed, 2) - 0.5) * 2; p.setXYZ(i, x * k, y * k, z * k); } g.setAttribute("normal", new THREE.BufferAttribute(Float32Array.from(p.array, (v, i) => v / (Math.hypot(p.array[i - (i % 3)], p.array[i - (i % 3) + 1], p.array[i - (i % 3) + 2]) || 1)), 3)); return g; }      // lit as a round thing, not as facets

/** Builds a set. o : { pad (the radius of the flat place of the product, in units), ground (false : no ground at all — the product alone in the sky) }.
    → { group, sky (a canvas), fog [near, far] in units, horizon (its colour), dispose() } — everything in units, the product at the origin, standing at z = 0. */
export function buildSet(id, o = {}) {
  const S = SETS[id] || SETS.studio, pad = o.pad || 1.5, group = new THREE.Group(), own = [], keep = (x) => { own.push(x); return x; }, F = groundFinish(S.ground.kind), T = tileOf(S.ground.kind);
  const mat = (color, more = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...more }));
  const add = (geo, material, more = {}) => { const m = new THREE.Mesh(geo, material); m.receiveShadow = true; m.castShadow = more.cast !== false; if (more.at) m.position.set(...more.at); group.add(m); return m; };
  const ground = mat(S.ground.color, { map: S.ground.kind === "seamless" ? null : T.map, bumpMap: F.bump ? T.bump : null, bumpScale: F.bump * (o.bump || 1), roughness: F.rough, vertexColors: !S.slab });
  if (o.ground !== false) {
    if (S.slab) { const [x0, x1, y0, y1] = S.slab, m = keep(ground.clone()); m.map = keep(T.map.clone()); m.map.repeat.set((x1 - x0) / S.ground.tile, (y1 - y0) / S.ground.tile); if (F.bump) { m.bumpMap = keep(T.bump.clone()); m.bumpMap.repeat.copy(m.map.repeat); }
      add(keep(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.3)), [ground, ground, ground, ground, m, ground], { at: [(x0 + x1) / 2, (y0 + y1) / 2, -0.15], cast: false });
      if (S.under !== undefined) add(keep(new THREE.CircleGeometry(FAR, 64)), mat("#3d4046", { roughness: 0.95 }), { at: [0, 0, S.under], cast: false }); }
    else add(keep(terrain(id, pad, S)), FADE.map((f) => { if (f === 1 || !F.bump) return ground; const m = keep(ground.clone()); if (f) m.bumpScale = F.bump * f; else m.bumpMap = null; return m; }), { cast: false });
    if (S.water) add(keep(new THREE.CircleGeometry(FAR, 96)), keep(new THREE.MeshPhysicalMaterial({ color: S.water.color, roughness: 0.16, metalness: 0, bumpMap: (() => { const t = keep(wavesTex().clone()); t.repeat.set(FAR / 4, FAR / 4); return t; })(), bumpScale: 0.6 * (o.bump || 1), envMapIntensity: 1.6 })), { at: [0, 0, S.water.level], cast: false });
    /* what stands around */
    const paints = new Map(), z0 = (p) => (p.ground ? setHeight(id, p.at ? p.at[0] : (p.from[0] + p.to[0]) / 2, p.at ? p.at[1] : (p.from[1] + p.to[1]) / 2, pad) : 0), crowns = [0, 1, 2].map((i) => keep(lump(i, 0.3))), rocks = [0, 1, 2].map((i) => keep(lump(i + 5, 0.45)));
    const trunk = keep(new THREE.CylinderGeometry(0.5, 0.7, 1, 7)), fir = keep(new THREE.ConeGeometry(1, 1, 9)), bark = mat("#5d4631"), post = keep(new THREE.CylinderGeometry(1, 1, 1, 8)), cube = keep(new THREE.BoxGeometry(1, 1, 1));
    for (const p of setProps(id)) {
      if (p.type === "paint") { if (!paints.has(p.color)) paints.set(p.color, []); paints.get(p.color).push(p.rect); }
      else if (p.type === "box") { const side = p.facade ? (() => { const t = keep(facadeTex().clone()); t.repeat.set(Math.max(1, Math.round(Math.max(p.size[0], p.size[1]) / 3.4)), Math.max(1, Math.round(p.size[2] / 3.2))); return mat(p.color, { map: t, roughness: 0.7 }); })() : mat(p.color), top = p.facade ? mat(p.color, { roughness: 0.95 }) : side;
        const m = add(cube, [side, side, top, top, side, side], { at: p.at, cast: p.cast }); m.scale.set(p.size[0], p.size[2], p.size[1]); m.rotation.set(Math.PI / 2, 0, 0); if (p.turn) m.rotation.set(Math.PI / 2, ((p.turn || 0) * Math.PI) / 180, 0); }
      else if (p.type === "post") { const m = add(post, mat(p.color), { at: [p.at[0], p.at[1], p.at[2] + z0(p) + p.h / 2] }); m.scale.set(p.r, p.h, p.r); m.rotation.x = Math.PI / 2; }
      else if (p.type === "bar") { const dx = p.to[0] - p.from[0], dy = p.to[1] - p.from[1], m = add(cube, mat(p.color), { at: [(p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2, p.z + z0(p)] }); m.scale.set(Math.hypot(dx, dy), p.r * 2, p.r * 2.6); m.rotation.z = Math.atan2(dy, dx); }
      else if (p.type === "rock") { const m = add(rocks[p.seed % 3], mat(p.color, { roughness: 0.95 }), { at: [p.at[0], p.at[1], setHeight(id, p.at[0], p.at[1], pad) + p.size[2] * 0.25] }); m.scale.set(...p.size); m.rotation.z = p.seed * 1.9; }
      else if (p.type === "tree") { const z = setHeight(id, p.at[0], p.at[1], pad), h = p.h, tone = 0.85 + 0.3 * (((p.seed * 37) % 10) / 10);
        if (p.kind === "fir") { const green = mat(new THREE.Color("#2c4a36").multiplyScalar(tone), { roughness: 0.95 }); for (const [zc, w, hh] of [[0.36, 0.24, 0.44], [0.58, 0.18, 0.4], [0.8, 0.12, 0.38]]) { const m = add(fir, green, { at: [p.at[0], p.at[1], z + h * zc] }); m.scale.set(h * w, h * hh, h * w); m.rotation.x = Math.PI / 2; } const t = add(trunk, bark, { at: [p.at[0], p.at[1], z + h * 0.07] }); t.scale.set(h * 0.045, h * 0.14, h * 0.045); t.rotation.x = Math.PI / 2; }
        else { const t = add(trunk, bark, { at: [p.at[0], p.at[1], z + h * 0.22] }); t.scale.set(h * 0.05, h * 0.44, h * 0.05); t.rotation.x = Math.PI / 2; const c = add(crowns[p.seed % 3], mat(new THREE.Color("#4f7f3a").multiplyScalar(tone), { roughness: 0.95 }), { at: [p.at[0], p.at[1], z + h * 0.68] }); c.scale.set(h * 0.34, h * 0.34, h * 0.36); c.rotation.z = p.seed; } }
    }
    for (const [color, rects] of paints) add(keep(paintGeo(rects, 0.012)), mat(color, { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { cast: false });
  }
  return { group, set: S, fog: S.fog, horizon: S.sky.horizon, far: FAR, dispose: () => { for (const x of own) x.dispose(); group.clear(); } };
}
