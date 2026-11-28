/* DynamiteOrbit.ai — the marketing render : what each part is finished with, the scene it stands in, the point of view, the
   size of the picture. A finish is how a surface answers light — a gloss paint, a brushed metal, a matte plastic, a carbon
   weave, a clear shell — with, for some, a fine pattern laid on it ; it is chosen per part (every instance of the part
   wears it) and may carry its own colour. What is not chosen follows the material of the part.
   render = { scene, shot, size, ground, labels, looks: { <part id>: { finish, color } }, view: { az, el, dist } | null,
              setup, lights: [ … ] | null, ambient, scale, quality, exposure }
   kept on the assembly. Pure : no DOM, no three.js — the stage that draws it is core/render_stage.js. */

import { material } from "../cad/materials.js";
import { liveAsm } from "./asm_live.js";
import { validHex, overLook } from "./part_look.js";
import { PATTERNS, SHEENS } from "./look_patterns.js";
import { SETS, validSet } from "./photo_sets.js";
import { LIGHT_SETUPS, tidyLights, setupLights, setupAmbient, lightGuide } from "./photo_lights.js";

export const FINISH_GROUPS = [
  { id: "paint", label: "Paints", fr: "Peintures", color: "#d6453d" }, { id: "metal", label: "Metals", fr: "Métaux", color: "#5b7fa6" }, { id: "plastic", label: "Plastics and elastomers", fr: "Plastiques et élastomères", color: "#ee8a32" },
  { id: "composite", label: "Composites", fr: "Composites", color: "#3a3f47" }, { id: "clear", label: "Clear materials", fr: "Transparents", color: "#25ad9f" }];
/* metal, rough : how the surface reflects (0..1) ; coat : a clear varnish over it ; pattern : a fine texture, and its period in millimetres ;
   tint : the finish takes a colour of its own (a paint, an anodising) — otherwise it shows the colour of the material ; opacity : what it lets through */
export const FINISHES = {
  "paint-gloss": { group: "paint", label: "Gloss paint", fr: "Peinture brillante", text: "Laque vernie : reflets nets", metal: 0, rough: 0.16, coat: 1, tint: true },
  "paint-satin": { group: "paint", label: "Satin paint", fr: "Peinture satinée", text: "Reflets doux", metal: 0, rough: 0.45, coat: 0.3, tint: true },
  "paint-matte": { group: "paint", label: "Matte paint", fr: "Peinture mate", text: "Aucun reflet franc", metal: 0, rough: 0.9, coat: 0, tint: true },
  "paint-metallic": { group: "paint", label: "Metallic paint", fr: "Peinture métallisée", text: "Paillettes sous vernis", metal: 0.55, rough: 0.32, coat: 1, tint: true, pattern: "flakes", period: 12 },
  "metal-polished": { group: "metal", label: "Polished metal", fr: "Métal poli", text: "Miroir", metal: 1, rough: 0.1, coat: 0 },
  "metal-brushed": { group: "metal", label: "Brushed metal", fr: "Métal brossé", text: "Stries fines dans un sens", metal: 1, rough: 0.36, coat: 0, pattern: "brushed", period: 30 },
  "metal-blasted": { group: "metal", label: "Bead-blasted metal", fr: "Métal microbillé", text: "Grain mat, uniforme", metal: 0.95, rough: 0.62, coat: 0, pattern: "grain", period: 16 },
  "metal-anodized": { group: "metal", label: "Anodized aluminium", fr: "Aluminium anodisé", text: "Teinté dans la masse de l'oxyde, satiné", metal: 0.85, rough: 0.4, coat: 0, tint: true },
  "plastic-gloss": { group: "plastic", label: "Gloss plastic", fr: "Plastique brillant", text: "Moule poli", metal: 0, rough: 0.22, coat: 0.2 },
  "plastic-grain": { group: "plastic", label: "Textured plastic", fr: "Plastique grainé", text: "Grain de moule, mat", metal: 0, rough: 0.72, coat: 0, pattern: "grain", period: 10 },
  rubber: { group: "plastic", label: "Rubber", fr: "Caoutchouc", text: "Noir profond, sans reflet", metal: 0, rough: 0.96, coat: 0 },
  carbon: { group: "composite", label: "Woven carbon fiber", fr: "Carbone tissé", text: "Sergé 2 × 2 sous vernis", metal: 0.25, rough: 0.3, coat: 1, pattern: "weave", period: 8, own: "#17191d" },
  laminate: { group: "composite", label: "Glass-epoxy laminate", fr: "Stratifié verre-époxy", text: "Le vert d'une carte, satiné", metal: 0, rough: 0.5, coat: 0.4, pattern: "weave", period: 3 },
  glass: { group: "clear", label: "Glass", fr: "Verre", text: "Presque invisible, reflets vifs", metal: 0, rough: 0.04, coat: 1, opacity: 0.22 },
  "clear-plastic": { group: "clear", label: "Clear plastic", fr: "Plastique transparent", text: "Laisse voir ce qu'il couvre", metal: 0, rough: 0.18, coat: 0.5, opacity: 0.38 },
};
/* the sets (where the product stands) are in core/photo_sets.js, the lights in core/photo_lights.js ; a render keeps which set, how large the
   product looks in it (scale), the lighting — a setup of the list, or lights of one's own —, the light from everywhere (ambient), the exposure
   of the picture (in stops) and how far it is refined */
export const SCENES = SETS;
export const QUALITY = { draft: { fr: "Rapide", text: "16 passes : une image en un instant", n: 16 }, fine: { fr: "Soignée", text: "48 passes : des ombres fondues", n: 48 }, max: { fr: "Maximale", text: "160 passes : pour l'image que l'on publie", n: 160 } };
/* az : around the vertical axis from +X toward +Y, el : above the horizon (degrees) ; fill : how much of the picture the product takes */
export const SHOTS = {
  hero: { fr: "Trois-quarts", text: "La vue qui montre le plus", az: -35, el: 18, fill: 0.82 }, road: { fr: "Près du sol", text: "De trois-quarts, bas : le décor derrière le produit", az: -38, el: 6.5, fill: 0.6 }, side: { fr: "Profil", text: "De côté, à hauteur", az: -90, el: 4, fill: 0.86 },
  front: { fr: "De face", text: "Dans l'axe", az: 0, el: 6, fill: 0.8 }, low: { fr: "Contre-plongée", text: "D'en bas : le produit domine", az: -40, el: -12, fill: 0.84 },
  top: { fr: "Plongée", text: "D'en haut", az: -30, el: 55, fill: 0.78 },
};
export const SIZES = { hd: { fr: "Écran 16:9", w: 1920, h: 1080 }, square: { fr: "Carré", w: 1600, h: 1600 }, portrait: { fr: "Portrait 2:3", w: 1400, h: 2100 }, wide: { fr: "Bandeau 3:1", w: 2400, h: 800 }, uhd: { fr: "Grand format 4K", w: 3840, h: 2160 } };
export const blankRender = () => ({ scene: "studio", shot: "hero", size: "hd", ground: true, labels: true, looks: {}, view: null });
/* what a render says of its lighting and of its picture when it says nothing : it follows the lighting of its set, at the size of the product, refined with care. A file keeps these only when they were chosen. */
const UNSAID = { setup: null, lights: null, ambient: null, scale: 1, quality: "fine", exposure: 0 };
export const renderOf = (asm) => ({ ...UNSAID, ...blankRender(), ...((asm && asm.render) || {}), looks: { ...(((asm && asm.render) || {}).looks || {}) } });

/** The finish a body wears when nothing is chosen : from the class of its material, and whether it is see-through. */
export function defaultFinish(materialId, opacity = 1) {
  const m = material(materialId), cls = m ? m.cls : "plastic";
  if (opacity < 0.9) return "clear-plastic";
  if (cls === "metal") return "metal-brushed"; if (cls === "elastomer") return "rubber"; if (cls === "pcb") return "laminate";
  return cls === "component" ? "plastic-gloss" : "plastic-grain";
}
/** What a body shows : { finish (id), color, opacity, metal, rough, coat, pattern, period }. body : { name, material, color, opacity } as the kernel built it ;
    choice : what the designer chose for its part ({ finish, color }) — it dresses the main body, the other bodies keep their own material.
    here : the look the assembly gives this instance (inst.look). Without a finish chosen, the look the part wears on screen — its
    camouflage, its sheen, what the assembly says of it here — goes on the picture too (core/part_look.js). */
export function bodyLook(body, choice = null, main = "main", here = null) {
  const L = bodyFinish(body, choice, main); if ((choice && FINISHES[choice.finish]) || body.name !== main) return L;
  const worn = overLook({ pattern: body.pattern, sheen: body.sheen }, here);
  if (worn.pattern) { L.pattern = worn.pattern; L.period = PATTERNS[worn.pattern].period; L.color = "#ffffff"; } else if (worn.color) L.color = worn.color;
  if (worn.sheen) { L.rough = SHEENS[worn.sheen].rough; L.metal = SHEENS[worn.sheen].metal; L.coat = worn.sheen === "gloss" ? 0.6 : 0; }
  if (worn.opacity !== null) L.opacity = worn.opacity;
  return L;
}
function bodyFinish(body, choice = null, main = "main") {
  const mine = choice && body.name === main ? choice : null, id = mine && FINISHES[mine.finish] ? mine.finish : defaultFinish(body.material, body.opacity ?? 1), F = FINISHES[id];
  const color = mine && F.tint && validHex(mine.color) ? mine.color : F.own && !(mine && validHex(mine.color)) ? F.own : mine && validHex(mine.color) ? mine.color : body.color || "#a8b0b8";
  return { finish: id, color, opacity: F.opacity ?? (id === "clear-plastic" ? 0.38 : 1), metal: F.metal, rough: F.rough, coat: F.coat, pattern: F.pattern || null, period: F.period || 0 };
}
/** One row per part of the assembly, for the screen and the report : { part, name, qty, finish, group, color, chosen }. built : part id → the kernel build. */
export function lookRows(asm, built, names = {}) {
  asm = liveAsm(asm);
  const R = renderOf(asm), count = new Map(); for (const i of asm.instances) count.set(i.part, (count.get(i.part) || 0) + 1);
  return [...count.keys()].filter((p) => built[p]).map((p) => { const b = built[p], main = b.bodies.find((x) => x.name === b.main) || b.bodies[0], L = bodyLook(main, R.looks[p], main.name);
    return { part: p, name: names[p] || p, qty: count.get(p), finish: L.finish, label: FINISHES[L.finish].label, group: FINISHES[L.finish].group, color: L.color, chosen: !!(R.looks[p] && FINISHES[R.looks[p].finish]) }; });
}
/** What the render asks for. parts : the ids of the parts of the assembly. → [{ level, text, id, field }] for the guide */
export function renderGuide(asm, parts = []) {
  const out = [], say = (level, text, id = null, field = null) => out.push({ level, text, id, field }), R = renderOf(asm);
  if (!validSet(R.scene)) say("error", `Décor inconnu : « ${R.scene} ».`, null, "scene"); if (!SHOTS[R.shot] && !R.view) say("error", `Point de vue inconnu : « ${R.shot} ».`, null, "shot"); if (!SIZES[R.size]) say("error", `Format inconnu : « ${R.size} ».`, null, "size");
  for (const [p, c] of Object.entries(R.looks)) {
    if (parts.length && !parts.includes(p)) say("warn", `Une finition est gardée pour ${p}, qui n'est plus dans l'assemblage.`, p, "looks");
    else if (!c || !FINISHES[c.finish]) say("error", `${p} : finition inconnue (« ${c && c.finish} »).`, p, "looks");
    else if (c.color && !validHex(c.color)) say("error", `${p} : couleur illisible (« ${c.color} ») — attendu « #rrggbb ».`, p, "looks");
    else if (c.color && !FINISHES[c.finish].tint) say("tip", `${p} : « ${FINISHES[c.finish].label} » montre la couleur de la matière — la couleur choisie ne compte pas.`, p, "looks");
  }
  if (!Object.keys(R.looks).length) say("tip", "Aucune finition choisie : chaque pièce montre celle de sa matière. Cliquez une pièce pour l'habiller.", null, "looks");
  const L = renderLights(R); for (const g of lightGuide(L.lights, L.ambient)) out.push(g);
  return out;
}

/* ---------- fine patterns, as pixels : one square tile that repeats without a seam ---------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** A pattern as grey levels : Uint8ClampedArray of n × n values, 255 = untouched surface, lower = darker. Deterministic. */
export function patternPixels(name, n = 128) {
  const px = new Uint8ClampedArray(n * n), R = rng(name.length * 7919 + n);
  if (name === "brushed") { for (let y = 0; y < n; y++) { let v = 215 + R() * 40; for (let x = 0; x < n; x++) { if (R() < 0.04) v = 205 + R() * 50; px[y * n + x] = v; } } }      // streaks that run along x
  else if (name === "weave") { const c = n / 8; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = Math.floor(x / c), j = Math.floor(y / c), over = ((i + j) & 3) < 2, t = over ? (x % c) / c : (y % c) / c; px[y * n + x] = (over ? 150 : 95) + 70 * Math.sin(Math.PI * t); } }   // 2 × 2 twill
  else if (name === "flakes") { px.fill(232); for (let k = 0; k < n * n / 14; k++) px[Math.floor(R() * n * n)] = 255; for (let k = 0; k < n * n / 30; k++) px[Math.floor(R() * n * n)] = 200; }
  else { for (let k = 0; k < n * n; k++) px[k] = 222 + R() * 33; }                                                                                                                // grain
  return px;
}
/** Texture coordinates for a mesh that has none : each vertex is projected along the axis its normal leans to (a box around the part) ; one
    period of the pattern every `period` millimetres. pos, nrm : flat arrays of the mesh. → Float32Array (2 per vertex) */
export function boxUv(pos, nrm, period = 20) {
  const n = pos.length / 3, uv = new Float32Array(2 * n), k = 1 / Math.max(period, 1e-6);
  for (let i = 0; i < n; i++) { const ax = Math.abs(nrm[3 * i]), ay = Math.abs(nrm[3 * i + 1]), az = Math.abs(nrm[3 * i + 2]), x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    if (az >= ax && az >= ay) { uv[2 * i] = x * k; uv[2 * i + 1] = y * k; } else if (ax >= ay) { uv[2 * i] = y * k; uv[2 * i + 1] = z * k; } else { uv[2 * i] = x * k; uv[2 * i + 1] = z * k; } }
  return uv;
}
/** Where the camera stands : the eye, from the centre of the box of the product, for a point of view and a picture of ratio `aspect`.
    bbox : [x0, y0, z0, x1, y1, z1] ; fov in degrees (vertical). → { eye, target, dist, az, el } */
export function cameraFor(bbox, shot, aspect = 16 / 9, fov = 28) {
  const c = [(bbox[0] + bbox[3]) / 2, (bbox[1] + bbox[4]) / 2, (bbox[2] + bbox[5]) / 2], s = shot || SHOTS.hero, az = (s.az || 0) * Math.PI / 180, el = (s.el || 0) * Math.PI / 180;
  const d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)], right = [-Math.sin(az), Math.cos(az), 0], up = [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)];
  /* the eight corners of the box, seen from that side : each must stay inside the picture, across and up — a slender product fills a tall picture */
  const tv = Math.tan(fov * Math.PI / 360) * (s.fill || 0.82), th = tv * aspect; let dist = 1;
  for (const x of [bbox[0], bbox[3]]) for (const y of [bbox[1], bbox[4]]) for (const z of [bbox[2], bbox[5]]) { const q = [x - c[0], y - c[1], z - c[2]], dot = (a) => q[0] * a[0] + q[1] * a[1] + q[2] * a[2];
    dist = Math.max(dist, dot(d) + Math.abs(dot(right)) / th, dot(d) + Math.abs(dot(up)) / tv); }
  if (s.dist > 0) dist = s.dist;
  return { eye: [c[0] + d[0] * dist, c[1] + d[1] * dist, c[2] + d[2] * dist], target: c, dist, az: s.az || 0, el: s.el || 0 };
}
/** A render block put back in order — what comes from a file or from an AI. */
export function tidyRender(raw) {
  const b = blankRender(), r = { ...b, ...(raw && typeof raw === "object" ? raw : {}) };
  if (!validSet(r.scene)) r.scene = b.scene; if (!SHOTS[r.shot]) r.shot = b.shot; if (!SIZES[r.size]) r.size = b.size; r.ground = r.ground !== false; r.labels = r.labels !== false;
  r.looks = Object.fromEntries(Object.entries(r.looks && typeof r.looks === "object" ? r.looks : {}).filter(([, c]) => c && FINISHES[c.finish]).map(([p, c]) => [p, { finish: c.finish, ...(validHex(c.color) ? { color: c.color } : {}) }]));
  r.view = r.view && [r.view.az, r.view.el, r.view.dist].every((x) => Number.isFinite(Number(x))) ? { az: +r.view.az, el: +r.view.el, dist: +r.view.dist } : null;
  r.setup = typeof r.setup === "string" && Object.hasOwn(LIGHT_SETUPS, r.setup) ? r.setup : null; r.lights = Array.isArray(r.lights) ? tidyLights(r.lights) : null;
  const within = (v, lo, hi, d) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
  r.ambient = within(r.ambient ?? null, 0, 1.5, null); r.scale = within(r.scale ?? null, 0.4, 2.5, 1); r.exposure = within(r.exposure ?? null, -2, 2, 0); if (!Object.hasOwn(QUALITY, r.quality)) r.quality = UNSAID.quality;
  for (const k of Object.keys(UNSAID)) if (r[k] === UNSAID[k]) delete r[k];                       // what was not chosen is not written
  return r;
}
/** Where the camera of a render stands around the product (degrees) : its kept view, or its point of view of the list. */
export const shotAz = (r) => (r && r.view ? r.view.az : (SHOTS[r && r.shot] || SHOTS.hero).az);
/** The lighting of a render, as it is : { lights, ambient, setup (the setup in use — the one chosen, or the one of the set), own (the lights
    were placed by hand : they no longer follow the setup, nor the camera) }. A setup is laid relative to the camera of the render. */
export function renderLights(render) {
  const r = { ...UNSAID, ...(render || blankRender()) }, setup = r.setup && Object.hasOwn(LIGHT_SETUPS, r.setup) ? r.setup : (SETS[validSet(r.scene) || "studio"]).setup, own = Array.isArray(r.lights);
  return { lights: own ? tidyLights(r.lights) : setupLights(setup, shotAz(r)), ambient: Number.isFinite(r.ambient) && r.ambient !== null ? r.ambient : setupAmbient(setup), setup, own };
}
