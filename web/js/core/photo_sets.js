/* DynamiteOrbit — the sets of the photo studio (demande de JP : « des backgrounds built-in pour faire des photo shoots… le rover
   sur une dune de sable dans le désert, avec un ombrage sur le sable… en ville, en bord de mer, sur un porte-avions, sur un
   bateau, en campagne »). A set is a place built around the product, in three dimensions : a sky, a ground with its relief
   and its matter, water, and a few things that say where one is — so that the shadow of the product falls on real ground,
   wherever the light stands.
   EVERYTHING IS MADE BY THE TOOL, from noise and boxes : no photograph, no picture enters the repository, and nothing shows a
   real place, a real ship or a mark. A set is drawn at the size of the product (one unit = its radius, divided by the scale
   the designer chooses) : it is a backdrop, not a place measured.
   Pure : no DOM, no three.js — core/photo_set_build.js builds what is described here. Z is up ; the default camera looks
   toward −X and +Y, so that is where a set puts what is worth seeing. */

import { lightDir, kelvinRgb } from "./photo_lights.js";

export const SET_GROUPS = [
  { id: "studio", label: "Studio", fr: "En studio", color: "#8a8f98" }, { id: "land", label: "Land", fr: "Sur terre", color: "#b08a3c" },
  { id: "sea", label: "Sea", fr: "En mer", color: "#2b7fb8" }, { id: "city", label: "City", fr: "En ville", color: "#5d6673" }];
/* sky : top and horizon colours, how cloudy (0..1), sun : is there one to see ; ground : its matter (a tile of core/photo_sets.js) and the
   millimetres… no : the UNITS a tile covers ; relief : the shape of the land ; crest : how much the land falls away around the product (it
   stands on a height) ; slab : a floor of a given size [x0, x1, y0, y1] with nothing around ; water : its level (units, under the product)
   and colour ; shore : the land goes down to the water toward a direction ; props : what stands around ; fog : where the ground melts in
   the horizon ; setup : the lighting the set comes with (core/photo_lights.js) ; ambient : its light from everywhere */
export const SETS = {
  studio: { group: "studio", fr: "Studio clair", text: "Fond blanc sans raccord, lumière douce : le produit seul", sky: { top: "#ffffff", horizon: "#e6eaef", cloud: 0, sun: false }, ground: { kind: "seamless", color: "#f1f3f5", tile: 8 }, relief: "flat", fog: [16, 70], setup: "three-point", room: true },
  dark: { group: "studio", fr: "Studio sombre", text: "Fond anthracite, reflets marqués", sky: { top: "#3d4652", horizon: "#12151a", cloud: 0, sun: false }, ground: { kind: "seamless", color: "#1b1f25", tile: 8 }, relief: "flat", fog: [14, 60], setup: "low-key", room: true },
  sky: { group: "land", fr: "Plein air", text: "Un sol neutre sous un vrai ciel", sky: { top: "#4f8fd6", horizon: "#e4edf5", cloud: 0.25, sun: true }, ground: { kind: "concrete", color: "#c9cdd1", tile: 10 }, relief: "flat", fog: [30, 150], setup: "noon" },
  desert: { group: "land", fr: "Désert", text: "Au sommet d'une dune, les autres à perte de vue", sky: { top: "#3d7fd0", horizon: "#e8e3d6", cloud: 0.06, sun: true }, ground: { kind: "sand", color: "#e6c896", tile: 4 }, relief: "dunes", crest: 2.6, fog: [45, 230], setup: "morning" },
  country: { group: "land", fr: "Campagne", text: "Un pré, des collines, quelques arbres, une clôture", sky: { top: "#4b8fdc", horizon: "#e1edf6", cloud: 0.42, sun: true }, ground: { kind: "grass", color: "#6f9a48", tile: 6 }, relief: "hills", crest: 1, fog: [50, 240], setup: "noon", props: "country" },
  snow: { group: "land", fr: "Neige", text: "Une plaine blanche, des sapins au loin, un soleil bas", sky: { top: "#7fa9d8", horizon: "#f2f5f9", cloud: 0.18, sun: true }, ground: { kind: "snow", color: "#f4f6f9", tile: 9 }, relief: "drifts", crest: 0.5, fog: [40, 200], setup: "morning", props: "snow" },
  seaside: { group: "sea", fr: "Bord de mer", text: "Sur la plage, la mer devant, quelques rochers", sky: { top: "#3f8ad6", horizon: "#dcebf5", cloud: 0.22, sun: true }, ground: { kind: "sand", color: "#ecdcb4", tile: 4 }, relief: "beach", shore: { az: 120, flat: 4, slope: 0.07 }, water: { level: -0.55, color: "#1f7391" }, fog: [60, 260], setup: "noon", props: "seaside" },
  boat: { group: "sea", fr: "Bateau", text: "Sur le pont en bois d'un bateau, la mer autour", sky: { top: "#4690d8", horizon: "#dfecf5", cloud: 0.3, sun: true }, ground: { kind: "planks", color: "#c2915f", tile: 1.7 }, relief: "flat", slab: [-9, 6, -3.4, 3.4], water: { level: -1.1, color: "#1c6883" }, fog: [70, 280], setup: "noon", props: "boat" },
  carrier: { group: "sea", fr: "Porte-avions", text: "Sur un pont d'envol : lignes peintes, îlot, la mer loin en bas", sky: { top: "#5089c4", horizon: "#d6e3ee", cloud: 0.32, sun: true }, ground: { kind: "deck", color: "#727780", tile: 5 }, relief: "flat", slab: [-78, 44, -14, 14], water: { level: -7.5, color: "#1b5270" }, fog: [90, 320], setup: "morning", props: "carrier" },
  city: { group: "city", fr: "Ville — rue", text: "Au milieu d'une rue, entre deux rangées d'immeubles", sky: { top: "#6d9fd6", horizon: "#e3e9ee", cloud: 0.36, sun: true }, ground: { kind: "asphalt", color: "#70737a", tile: 5 }, relief: "flat", fog: [60, 230], setup: "morning", props: "city" },
  roof: { group: "city", fr: "Ville — toit", text: "Sur un toit-terrasse, la ville tout autour", sky: { top: "#5a8fcf", horizon: "#f0dfc6", cloud: 0.2, sun: true }, ground: { kind: "concrete", color: "#b9b6ae", tile: 6 }, relief: "flat", slab: [-13, 11, -9, 9], under: -34, fog: [90, 320], setup: "golden", props: "roof" },
};
export const validSet = (id) => (typeof id === "string" && Object.hasOwn(SETS, id) ? id : null);
export const setGroups = () => SET_GROUPS.map((g) => ({ ...g, items: Object.entries(SETS).filter(([, s]) => s.group === g.id).map(([id, s]) => ({ id, ...s })) }));

/* ---------- noise : the same numbers every time ---------- */
const ease = (t) => t * t * (3 - 2 * t), mix = (a, b, t) => a + (b - a) * t, clamp01 = (x) => Math.max(0, Math.min(1, x));
export const sstep = (a, b, x) => ease(clamp01((x - a) / (b - a)));
function hash(i, j, s) { let h = (Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 1442695041)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** Smooth noise 0..1 at a point of the plane. */
export function vnoise(x, y, seed = 1) { const i = Math.floor(x), j = Math.floor(y), a = ease(x - i), b = ease(y - j); return mix(mix(hash(i, j, seed), hash(i + 1, j, seed), a), mix(hash(i, j + 1, seed), hash(i + 1, j + 1, seed), a), b); }
export function fbm(x, y, seed = 1, oct = 4) { let v = 0, amp = 0.5, f = 1, tot = 0; for (let o = 0; o < oct; o++) { v += amp * vnoise(x * f, y * f, seed + o * 17); tot += amp; amp *= 0.5; f *= 2; } return v / tot; }
/* the same noise on a tile that repeats : u, v in 0..1, cx × cy cells */
function tnoise(u, v, cx, cy, seed) { const x = u * cx, y = v * cy, i = Math.floor(x), j = Math.floor(y), a = ease(x - i), b = ease(y - j), at = (p, q) => hash(((p % cx) + cx) % cx, ((q % cy) + cy) % cy, seed); return mix(mix(at(i, j), at(i + 1, j), a), mix(at(i, j + 1), at(i + 1, j + 1), a), b); }

/* ---------- the relief : how high the land is at a point (units), before the product flattens its own place ---------- */
const RELIEF = {
  flat: () => 0,
  dunes: (x, y) => { const w = fbm(x * 0.045, y * 0.045, 11, 3), a = 1 - Math.abs(Math.sin(0.33 * (x * 0.82 + y * 0.57) + w * 6.5)), b = 1 - Math.abs(Math.sin(0.17 * (y * 0.94 - x * 0.34) + w * 4.2 + 1.3)); return 1.5 * Math.pow(a, 1.7) + 3.1 * Math.pow(b, 1.5) + 5 * fbm(x * 0.012, y * 0.012, 5, 2); },
  hills: (x, y) => 9 * fbm(x * 0.014, y * 0.014, 7, 3) + 0.3 * fbm(x * 0.16, y * 0.16, 9, 2),
  drifts: (x, y) => 2.4 * fbm(x * 0.03, y * 0.03, 13, 3) + 0.25 * fbm(x * 0.3, y * 0.12, 15, 2),
  beach: (x, y) => 0.35 * fbm(x * 0.09, y * 0.09, 17, 3),
};
const zero = new Map();
/** The height of the ground of a set at (x, y), in units ; the product stands at the origin, on a place made flat (radius pad). */
export function setHeight(id, x, y, pad = 1.5) {
  const S = SETS[id]; if (!S || S.slab) return 0;
  const f = RELIEF[S.relief] || RELIEF.flat; if (!zero.has(id)) zero.set(id, f(0, 0));
  const p = Math.hypot(x, y); let h = (f(x, y) - zero.get(id)) * sstep(pad * 1.5, pad + 34, p) - (S.crest || 0) * sstep(pad, pad + 16, p);      // the relief comes in slowly, and the land falls away first : nothing stands between the camera and the product
  if (S.shore) { const a = (S.shore.az * Math.PI) / 180, d = x * Math.cos(a) + y * Math.sin(a) - pad - S.shore.flat; if (d > 0) h -= S.shore.slope * d * sstep(0, 6, d) + 0.9 * sstep(40, 90, d); }
  return h;
}
/** How wet the ground is at a point, 0..1 : near the water of a set that has a shore (the sand darkens, the foam whitens). */
export function setWet(id, x, y, pad = 1.5) { const S = SETS[id]; if (!S || !S.water || S.slab) return 0; const h = setHeight(id, x, y, pad) - S.water.level; return 1 - sstep(0.02, 0.38, h); }

/* ---------- the sky : a picture of the whole dome ---------- */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** The sky as a picture that wraps the world : w × h pixels (red, green, blue, opaque), the zenith on the first row, the horizon in the
    middle ; the column of a direction az is ((az / 360 + 0.5) mod 1) · w. sky : { top, horizon, cloud, sun } ; sun : { az, el, kelvin } or null. */
export function paintSky(sky, sun = null, w = 512, h = 256) {
  const px = new Uint8ClampedArray(w * h * 4), top = rgb(sky.top), hor = rgb(sky.horizon), sd = sun && sky.sun ? lightDir(sun.az, sun.el) : null, sc = sd ? kelvinRgb(sun.kelvin).map((c) => c * 255) : null, low = sd ? clamp01(1 - sun.el / 28) : 0;
  for (let y = 0; y < h; y++) {
    const el = 90 - (180 * (y + 0.5)) / h, se = Math.sin((el * Math.PI) / 180), ce = Math.cos((el * Math.PI) / 180), t = el > 0 ? Math.pow(se, 0.42) : 0;
    for (let x = 0; x < w; x++) {
      const az = (((x + 0.5) / w - 0.5) * 2 * Math.PI), d = [ce * Math.cos(az), ce * Math.sin(az), se], c = [0, 1, 2].map((k) => mix(hor[k], top[k], t));
      let cover = 0;
      if (sky.cloud > 0 && el > 0) { const q = 1 / (se + 0.16), n = fbm(d[0] * q * 1.15 + 3.7, d[1] * q * 1.15 + 1.9, 21, 5); cover = sstep(0.98 - 0.6 * sky.cloud, 1.18 - 0.6 * sky.cloud, n + 0.25) * sstep(0, 0.1, se); }
      if (sd) {
        const dot = Math.max(0, d[0] * sd[0] + d[1] * sd[1] + d[2] * sd[2]), glow = 0.34 * Math.pow(dot, 10) + 0.5 * Math.pow(dot, 90), warm = low * Math.pow(dot, 3) * (1 - clamp01(el / 40)) * 0.5;
        for (let k = 0; k < 3; k++) c[k] = mix(c[k], sc[k], clamp01(glow + warm) * (1 - 0.6 * cover));
        if (dot > 0.99994) for (let k = 0; k < 3; k++) c[k] = 255;                              // the disc itself : half a degree across
      }
      if (cover > 0) { const lit = sd ? 0.86 + 0.14 * Math.max(0, d[0] * sd[0] + d[1] * sd[1] + d[2] * sd[2]) : 0.92, g = 255 * lit * (1 - 0.22 * sky.cloud); for (let k = 0; k < 3; k++) c[k] = mix(c[k], mix(g, hor[k], 0.25), cover * 0.92); }
      const o = 4 * (y * w + x); px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  return px;
}

/* ---------- the matter of a ground : a tile that repeats — its colours, and how rough it is under the light ---------- */
const TILES = {
  seamless: () => [1, 1, 1, 0.5],
  sand: (u, v) => { const n = 0.5 * tnoise(u, v, 5, 5, 1) + 0.3 * tnoise(u, v, 22, 22, 2) + 0.2 * tnoise(u, v, 90, 90, 3), r = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 34 + 2.6 * tnoise(u, v, 4, 4, 4) + 0.7 * tnoise(u, v, 13, 13, 6))), k = 0.86 + 0.14 * n; return [k, k * (0.985 + 0.02 * n), k * (0.95 + 0.06 * n), 0.62 * r + 0.38 * tnoise(u, v, 128, 128, 5)]; },
  grass: (u, v) => { const n = tnoise(u, v, 7, 7, 1), s = tnoise(u, v, 150, 150, 2), m = tnoise(u, v, 28, 28, 3), k = 0.6 + 0.24 * n + 0.26 * s; return [k * (0.82 + 0.3 * m), k, k * (0.7 + 0.2 * n), 0.55 * s + 0.45 * tnoise(u, v, 70, 70, 4)]; },
  snow: (u, v) => { const n = 0.6 * tnoise(u, v, 6, 6, 1) + 0.4 * tnoise(u, v, 30, 30, 2), k = 0.94 + 0.06 * n; return [k * 0.985, k * 0.992, k, 0.7 * n + 0.3 * tnoise(u, v, 110, 110, 3)]; },
  asphalt: (u, v) => { const s = tnoise(u, v, 200, 200, 1), n = tnoise(u, v, 9, 9, 2), p = tnoise(u, v, 64, 64, 3), k = 0.72 + 0.26 * (s - 0.5) + 0.14 * (n - 0.5) + (p > 0.82 ? 0.16 : 0); return [k, k, k * 1.02, s]; },
  deck: (u, v) => { const s = tnoise(u, v, 230, 230, 1), n = tnoise(u, v, 6, 6, 2), k = 0.78 + 0.3 * (s - 0.5) + 0.18 * (n - 0.5); return [k, k * 1.01, k * 1.03, s]; },
  concrete: (u, v) => { const n = 0.6 * tnoise(u, v, 8, 8, 1) + 0.4 * tnoise(u, v, 60, 60, 2), j = Math.min(Math.abs(((u * 2) % 1) - 0.5), Math.abs(((v * 2) % 1) - 0.5)) > 0.492 ? 0.62 : 1, k = (0.8 + 0.2 * n) * j; return [k, k, k * 0.99, j < 1 ? 0.1 : 0.5 + 0.5 * tnoise(u, v, 180, 180, 3)]; },
  planks: (u, v) => { const N = 8, p = Math.floor(u * N) % N, fu = u * N - Math.floor(u * N), tone = hash(p, 3, 7), joint = (v * 2 + hash(p, 5, 7)) % 1, gap = Math.abs(fu - 0.5) > 0.465 || joint < 0.006, g = tnoise(u, v, 96, 5, 8 + p), k = gap ? 0.2 : 0.68 + 0.26 * tone + 0.14 * (g - 0.5); return [k, k * (0.97 + 0.04 * tone), k * (0.93 + 0.06 * tone), gap ? 0 : 0.7 + 0.3 * g]; },
};
/** A tile of ground : { rgba (n × n × 4, the tint to multiply the colour of the set by, 255 = unchanged), bump (n × n, 0..255 : how high) }. */
export function groundTile(kind, n = 256) {
  const f = TILES[kind] || TILES.seamless, rgba = new Uint8ClampedArray(n * n * 4), bump = new Uint8ClampedArray(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = f((x + 0.5) / n, (y + 0.5) / n), o = y * n + x; rgba[4 * o] = 255 * Math.min(1, c[0]); rgba[4 * o + 1] = 255 * Math.min(1, c[1]); rgba[4 * o + 2] = 255 * Math.min(1, c[2]); rgba[4 * o + 3] = 255; bump[o] = 255 * clamp01(c[3]); }
  return { rgba, bump };
}
/** How strongly the bumps of a ground show, and how rough it is : { bump, rough, metal }. */
export const groundFinish = (kind) => ({ seamless: { bump: 0, rough: 0.9 }, sand: { bump: 0.9, rough: 0.95 }, grass: { bump: 0.7, rough: 0.97 }, snow: { bump: 0.5, rough: 0.8 }, asphalt: { bump: 0.35, rough: 0.9 }, deck: { bump: 0.4, rough: 0.92 }, concrete: { bump: 0.25, rough: 0.88 }, planks: { bump: 0.5, rough: 0.6 } })[kind] || { bump: 0, rough: 0.9 };
/** The front of a building as a tile : cols × rows windows on a wall, a few of them lit. → rgba n × n × 4 */
export function facadeTile(n = 128, cols = 4, rows = 4, seed = 1) {
  const px = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fu = (x / n) * cols, fv = (y / n) * rows, i = Math.floor(fu), j = Math.floor(fv), a = fu - i, b = fv - j, win = a > 0.2 && a < 0.8 && b > 0.22 && b < 0.74, h = hash(i, j, seed), o = 4 * (y * n + x);
    const c = win ? (h > 0.86 ? [236, 214, 160] : h > 0.5 ? [58, 74, 92] : [38, 48, 62]) : [205, 205, 205];
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
  return px;
}

/* ---------- what stands around : boxes, posts, trees, rocks, painted lines — the same every time ---------- */
const box = (x, y, z, sx, sy, sz, color, o = {}) => ({ type: "box", at: [x, y, z + sz / 2], size: [sx, sy, sz], color, ...o });
const line = (x0, x1, y0, y1, color) => ({ type: "paint", rect: [x0, x1, y0, y1], color });
const WALLS = ["#b9b4aa", "#9aa3ad", "#c8bfb0", "#8d8f96", "#a89f94", "#b3bac2", "#d2cdc4"];
function towers(cx, cy, n, spread, base, hMin, hMax, seed) { const out = []; for (let i = 0; i < n; i++) { const a = hash(i, 1, seed) * 2 * Math.PI, d = spread[0] + (spread[1] - spread[0]) * Math.sqrt(hash(i, 2, seed)), w = 7 + 9 * hash(i, 3, seed), dp = 7 + 9 * hash(i, 4, seed), ht = hMin + (hMax - hMin) * Math.pow(hash(i, 5, seed), 1.6); out.push(box(cx + d * Math.cos(a), cy + d * Math.sin(a), base, w, dp, ht, WALLS[Math.floor(hash(i, 6, seed) * WALLS.length)], { facade: true, turn: Math.floor(hash(i, 7, seed) * 4) * 90 })); } return out; }
const PROPS = {
  city: () => {
    const out = [box(0, 11.2, 0, 400, 3.6, 0.16, "#b4b0a7", { cast: false }), box(0, -11.2, 0, 400, 3.6, 0.16, "#b4b0a7", { cast: false }), line(-200, 200, 8.95, 9.15, "#e9e7e0"), line(-200, 200, -9.15, -8.95, "#e9e7e0")];
    for (let i = -40; i <= 40; i++) out.push(line(i * 5 - 1.3, i * 5 + 1.3, 3.0, 3.18, "#e3c84a"));                         // the dashes between the two lanes, past the product
    for (let k = 0; k < 10; k++) out.push(line(-21, -17.5, -8.6 + k * 1.8, -7.7 + k * 1.8, "#eceae4"));                         // a crossing
    for (const side of [1, -1]) { let x = -150; for (let i = 0; x < 150; i++) { const w = 9 + 10 * hash(i, side, 31), ht = 9 + 26 * Math.pow(hash(i, side, 32), 1.4), dp = 12 + 6 * hash(i, side, 33), gap = hash(i, side, 34) > 0.8 ? 4 : 0.3; out.push(box(x + w / 2, side * (13.1 + dp / 2), 0, w, dp, ht, WALLS[Math.floor(hash(i, side, 35) * WALLS.length)], { facade: true })); x += w + gap; } }
    for (let i = -6; i <= 6; i++) { out.push({ type: "post", at: [i * 22 + 4, 10.2, 0], h: 6.5, r: 0.09, color: "#4a4f55" }, box(i * 22 + 4, 9.4, 6.4, 0.24, 1.7, 0.12, "#4a4f55", { cast: false })); }
    return out.concat(towers(0, 0, 46, [80, 210], 0, 18, 70, 41));
  },
  roof: () => {
    const out = [box(0, 9, 0, 24, 0.4, 0.75, "#c9c5bc"), box(0, -9, 0, 24, 0.4, 0.75, "#c9c5bc"), box(-13, 0, 0, 0.4, 18.4, 0.75, "#c9c5bc"), box(11, 0, 0, 0.4, 18.4, 0.75, "#c9c5bc"), box(-1, 0, -34, 24.6, 18.6, 33.9, "#a9a59c", { facade: true, cast: false })];
    out.push(box(-10.6, -6.4, 0, 3.2, 2.2, 1.6, "#9aa0a6"), box(-10.9, -3.2, 0, 1.6, 1.6, 1.1, "#8b9197"), { type: "post", at: [-11.8, -7.9, 0], h: 4.2, r: 0.05, color: "#5a5f66" });
    return out.concat(towers(0, 0, 120, [26, 230], -34, 14, 62, 51));
  },
  carrier: () => {
    const out = [box(-17, 0, -8.5, 122, 25, 7.4, "#4c5157", { cast: false }), line(-78, 44, -3.2, -2.9, "#e8e6df"), line(-78, 44, 12.6, 12.9, "#d8b83a"), line(-78, 44, -12.9, -12.6, "#d8b83a"), line(-78, 44, 5.9, 6.1, "#e8e6df")];
    for (let i = -15; i <= 8; i++) out.push(line(i * 5 - 1.2, i * 5 + 1.2, 1.4, 1.62, "#e8e6df"));
    for (let i = -7; i <= 4; i++) out.push(line(i * 9.5, i * 9.5 + 0.3, -12.6, -8.4, "#e8e6df"));                                // the short bars of a landing area
    /* the island : a stack of plain boxes, a mast, a bar that could be an antenna */
    out.push(box(-50, 10.6, 0, 17, 5.2, 5.6, "#8b9197"), box(-51, 10.6, 5.6, 11, 4.4, 3.4, "#939aa0"), box(-52, 10.6, 9, 7, 3.8, 2.4, "#9aa1a7"), box(-52, 10.6, 9.5, 7.2, 4, 0.7, "#27313b", { cast: false }),
      { type: "post", at: [-53, 10.6, 11.4], h: 8.5, r: 0.14, color: "#6b7178" }, box(-53, 10.6, 16.5, 0.3, 4.6, 0.3, "#6b7178"), box(-48, 10.6, 11.4, 2.2, 2.2, 2.6, "#939aa0"));
    return out;
  },
  boat: () => {
    const out = [box(-1.5, 0, -1.3, 15.6, 7.2, 1.26, "#f1f0ec", { cast: false }), box(-1.5, 3.5, 0, 15.4, 0.22, 0.62, "#f4f3ef"), box(-1.5, -3.5, 0, 15.4, 0.22, 0.62, "#f4f3ef"), box(6.1, 0, 0, 0.22, 7.2, 0.62, "#f4f3ef"),
      box(-1.5, 3.5, 0.62, 15.6, 0.34, 0.09, "#a9764a"), box(-1.5, -3.5, 0.62, 15.6, 0.34, 0.09, "#a9764a"), box(6.1, 0, 0.62, 0.34, 7.4, 0.09, "#a9764a"),
      box(-7.4, 0, 0, 3.4, 5, 2.5, "#f6f5f1"), box(-7.4, 0, 2.5, 3.9, 5.5, 0.14, "#e9e7e1"), box(-5.68, 0, 1.35, 0.04, 3.8, 0.75, "#27313b", { cast: false }), { type: "post", at: [-7.4, 0, 2.6], h: 3.4, r: 0.06, color: "#d9d7d1" }];
    for (let i = 0; i < 7; i++) for (const s of [3.5, -3.5]) out.push({ type: "post", at: [-8.6 + i * 2.4, s, 0.62], h: 0.5, r: 0.04, color: "#c9c7c1" });
    return out;
  },
  seaside: () => { const out = []; for (let i = 0; i < 7; i++) { const a = (((i % 2 ? 58 : 158) + 34 * hash(i, 1, 61)) * Math.PI) / 180, d = 7 + 9 * hash(i, 2, 61), s = 0.3 + 0.75 * hash(i, 3, 61); out.push({ type: "rock", at: [d * Math.cos(a), d * Math.sin(a), 0], size: [s * 1.5, s, s * 0.7], color: "#7d7a74", seed: i }); } return out; },      // a few rocks on both sides, never between the product and the sea
  country: () => {
    const out = []; for (let i = 0; i < 70; i++) { const a = hash(i, 1, 71) * 2 * Math.PI, d = 11 + 110 * Math.pow(hash(i, 2, 71), 1.4); out.push({ type: "tree", kind: "leaf", at: [d * Math.cos(a), d * Math.sin(a), 0], h: 3.2 + 3.6 * hash(i, 3, 71), seed: i }); }
    const at = (i) => [i * 2.6, 7.5 + 0.7 * Math.sin(i * 0.31)];                                                               // a fence that wanders a little
    for (let i = -30; i <= 30; i++) { out.push({ type: "post", at: [...at(i), 0], h: 1.15, r: 0.07, color: "#8a6a48", ground: true }); if (i < 30) for (const z of [0.45, 0.9]) out.push({ type: "bar", from: at(i), to: at(i + 1), z, r: 0.045, color: "#93724e", ground: true }); }
    return out;
  },
  snow: () => { const out = []; for (let i = 0; i < 60; i++) { const a = hash(i, 1, 81) * 2 * Math.PI, d = 13 + 120 * Math.pow(hash(i, 2, 81), 1.3); out.push({ type: "tree", kind: "fir", at: [d * Math.cos(a), d * Math.sin(a), 0], h: 3.5 + 4 * hash(i, 3, 81), seed: i }); } return out; },
};
/** What stands around the product in a set : [{ type: "box" | "post" | "bar" | "paint" | "tree" | "rock", … }] in units. */
export const setProps = (id) => (SETS[id] && PROPS[SETS[id].props] ? PROPS[SETS[id].props]() : []);
/** The one colour that stands for a set where a picture cannot go (a tile of the list) : [sky, ground]. */
export const setColors = (id) => { const S = SETS[validSet(id) || "studio"]; return [S.sky.top, S.sky.horizon, S.ground.color, S.water ? S.water.color : null]; };
