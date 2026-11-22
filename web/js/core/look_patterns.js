/* DynamiteOrbit — what a look can carry beside its colour (demande de JP : « color and shading that can be applied to each 3D
   part… including military camouflage colour / shade / texture options — snow, forest, desert… ») :
     a PATTERN — a texture laid on the part, here the camouflage sets ; each is a handful of colours and a way to break them up ;
     a SHEEN   — how the surface answers light in the view : matte, satin (what the view always showed), gloss, metallic.
   The patterns are GENERATED here, from noise : none reproduces the pattern of an armed force or of a maker — those are designs
   with owners. Only the idea is taken (a few colours of a terrain, in patches that break the outline), under plain names.
   A tile repeats without a seam ; it is laid on a part by a box projection, one tile every `period` millimetres
   (core/look_paint.js, core/render_looks.js boxUv). Pure : no DOM — the same numbers in the tests and on the screen. */

export const PATTERN_GROUPS = [{ id: "camo", label: "Camouflage", fr: "Camouflage", color: "#5d6b3a" }];
/* colors : the first is the ground, the others are laid over it in turn ; shares : what part of the surface each should take ;
   style : « blotch » (rounded patches) or « digital » (square pixels) ; grain : how many patches across a tile ; period : millimetres a tile */
export const PATTERNS = {
  "camo-forest": { group: "camo", label: "Forest", fr: "Forêt", text: "Verts, brun et noir : le sous-bois", colors: ["#55683a", "#2f3d24", "#6f5637", "#15170f"], shares: [0.38, 0.28, 0.21, 0.13], style: "blotch", grain: 5, period: 150 },
  "camo-jungle": { group: "camo", label: "Jungle", fr: "Jungle", text: "Verts vifs et ocre : la végétation dense", colors: ["#3f7030", "#72a046", "#1f3d1c", "#9a8642"], shares: [0.36, 0.27, 0.24, 0.13], style: "blotch", grain: 6, period: 130 },
  "camo-desert": { group: "camo", label: "Desert", fr: "Désert", text: "Sables et bruns clairs", colors: ["#d2ba8c", "#b39468", "#e6d6b2", "#8c6c48"], shares: [0.42, 0.26, 0.2, 0.12], style: "blotch", grain: 4, period: 170 },
  "camo-snow": { group: "camo", label: "Snow", fr: "Neige", text: "Blancs et gris froids", colors: ["#f3f5f6", "#d3d9dd", "#a9b3ba", "#7b858c"], shares: [0.5, 0.26, 0.16, 0.08], style: "blotch", grain: 4, period: 170 },
  "camo-urban": { group: "camo", label: "Urban", fr: "Urbain", text: "Gris et noir, en pixels : le béton", colors: ["#8d9298", "#5c6167", "#c4c8cc", "#2f3337"], shares: [0.36, 0.3, 0.19, 0.15], style: "digital", grain: 5, period: 140 },
  "camo-navy": { group: "camo", label: "Navy", fr: "Marine", text: "Bleus sombres, en pixels : la mer", colors: ["#2b4563", "#17273d", "#55748f", "#0b1119"], shares: [0.38, 0.29, 0.2, 0.13], style: "digital", grain: 5, period: 140 },
};
/* rough, metal : what the material of the view takes ; satin is the view as it always was — a look without a sheen shows it */
export const SHEENS = {
  matte: { label: "Matte", fr: "Mat", text: "Aucun reflet", rough: 0.96, metal: 0 },
  satin: { label: "Satin", fr: "Satiné", text: "Reflets doux — la vue ordinaire", rough: 0.62, metal: 0.08 },
  gloss: { label: "Gloss", fr: "Brillant", text: "Reflets nets", rough: 0.2, metal: 0.04 },
  metallic: { label: "Metallic", fr: "Métallisé", text: "L'éclat d'un métal peint", rough: 0.36, metal: 0.55 },
};
export const DEFAULT_SHEEN = "satin";
export const validPattern = (id) => (typeof id === "string" && Object.hasOwn(PATTERNS, id) ? id : null);      // its own names only : « constructor » is not a pattern
export const validSheen = (id) => (typeof id === "string" && Object.hasOwn(SHEENS, id) ? id : null);

/* ---------- a tile of a pattern : which colour at each pixel ---------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const seedOf = (text) => { let h = 2166136261; for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h || 1; };
/* smooth noise that wraps : random values on a g × g lattice, eased between its points, two octaves */
function field(n, g, R) {
  const octave = (cells) => { const v = Float32Array.from({ length: cells * cells }, () => R()), ease = (t) => t * t * (3 - 2 * t);
    return (x, y) => { const fx = (x / n) * cells, fy = (y / n) * cells, i = Math.floor(fx), j = Math.floor(fy), a = ease(fx - i), b = ease(fy - j), at = (p, q) => v[((q + cells) % cells) * cells + ((p + cells) % cells)];
      return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * b; }; };
  const big = octave(g), small = octave(g * 2), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = 0.68 * big(x, y) + 0.32 * small(x, y);
  return out;
}
/** A tile of a pattern : Uint8Array of n × n colour indices (0 : its first colour, the ground). Deterministic ; it repeats without a seam.
    Each colour after the first is a layer of patches laid over what is under it, sized so that the colours take about their shares. */
export function patternTile(id, n = 128) {
  const P = validPattern(id) && PATTERNS[id], out = new Uint8Array(n * n); if (!P) return out;
  const m = P.style === "digital" ? Math.max(8, Math.round(n / 4)) : n, cells = new Uint8Array(m * m), R = rng(seedOf(id)), K = P.colors.length;
  /* the cover of a layer, so that what the later layers leave of it is its share */
  const cover = new Array(K).fill(0); let left = 1;
  for (let k = K - 1; k >= 1; k--) { cover[k] = Math.min(0.95, P.shares[k] / left); left *= 1 - cover[k]; }
  for (let k = 1; k < K; k++) {
    const f = field(m, P.grain + (k % 2), R), sorted = Float32Array.from(f).sort(), cut = sorted[Math.min(m * m - 1, Math.floor((1 - cover[k]) * m * m))];
    for (let i = 0; i < m * m; i++) if (f[i] > cut) cells[i] = k;
  }
  if (m === n) return cells;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = cells[Math.floor((y * m) / n) * m + Math.floor((x * m) / n)];      // square pixels, each a few of the tile
  return out;
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** The same tile as a picture : Uint8ClampedArray of n × n × 4 (red, green, blue, opaque). */
export function patternRgba(id, n = 128) {
  const P = validPattern(id) && PATTERNS[id], px = new Uint8ClampedArray(n * n * 4); if (!P) return px;
  const t = patternTile(id, n), c = P.colors.map(rgb);
  for (let i = 0; i < n * n; i++) { const v = c[t[i]]; px[4 * i] = v[0]; px[4 * i + 1] = v[1]; px[4 * i + 2] = v[2]; px[4 * i + 3] = 255; }
  return px;
}
/** The share of the surface each colour of a tile takes : [0…1] per colour. */
export function patternShares(id, n = 128) { const P = validPattern(id) && PATTERNS[id]; if (!P) return []; const t = patternTile(id, n), count = new Array(P.colors.length).fill(0); for (const v of t) count[v]++; return count.map((x) => x / (n * n)); }
/** One colour that stands for a pattern where a texture cannot go (a swatch too small, a file that keeps one colour a body) : its ground. */
export const patternColor = (id) => (validPattern(id) ? PATTERNS[id].colors[0] : null);
/** The patterns by group, for a picker : [{ ...group, items: [{ id, ...pattern }] }]. */
export const patternGroups = () => PATTERN_GROUPS.map((g) => ({ ...g, items: Object.entries(PATTERNS).filter(([, p]) => p.group === g.id).map(([id, p]) => ({ id, ...p })) }));
