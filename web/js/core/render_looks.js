/* DesignWizard.ai — the marketing render : what each part is finished with, the scene it stands in, the point of view, the
   size of the picture. A finish is how a surface answers light — a gloss paint, a brushed metal, a matte plastic, a carbon
   weave, a clear shell — with, for some, a fine pattern laid on it ; it is chosen per part (every instance of the part
   wears it) and may carry its own colour. What is not chosen follows the material of the part.
   render = { scene, shot, size, ground, labels, looks: { <part id>: { finish, color } }, view: { az, el, dist } | null }
   kept on the assembly. Pure : no DOM, no three.js — the stage that draws it is core/render_stage.js. */

import { material } from "../cad/materials.js";
import { validHex } from "./part_look.js";

export const FINISH_GROUPS = [
  { id: "paint", fr: "Peintures", color: "#d6453d" }, { id: "metal", fr: "Métaux", color: "#5b7fa6" }, { id: "plastic", fr: "Plastiques et élastomères", color: "#ee8a32" },
  { id: "composite", fr: "Composites", color: "#3a3f47" }, { id: "clear", fr: "Transparents", color: "#25ad9f" }];
/* metal, rough : how the surface reflects (0..1) ; coat : a clear varnish over it ; pattern : a fine texture, and its period in millimetres ;
   tint : the finish takes a colour of its own (a paint, an anodising) — otherwise it shows the colour of the material ; opacity : what it lets through */
export const FINISHES = {
  "paint-gloss": { group: "paint", fr: "Peinture brillante", text: "Laque vernie : reflets nets", metal: 0, rough: 0.16, coat: 1, tint: true },
  "paint-satin": { group: "paint", fr: "Peinture satinée", text: "Reflets doux", metal: 0, rough: 0.45, coat: 0.3, tint: true },
  "paint-matte": { group: "paint", fr: "Peinture mate", text: "Aucun reflet franc", metal: 0, rough: 0.9, coat: 0, tint: true },
  "paint-metallic": { group: "paint", fr: "Peinture métallisée", text: "Paillettes sous vernis", metal: 0.55, rough: 0.32, coat: 1, tint: true, pattern: "flakes", period: 12 },
  "metal-polished": { group: "metal", fr: "Métal poli", text: "Miroir", metal: 1, rough: 0.1, coat: 0 },
  "metal-brushed": { group: "metal", fr: "Métal brossé", text: "Stries fines dans un sens", metal: 1, rough: 0.36, coat: 0, pattern: "brushed", period: 30 },
  "metal-blasted": { group: "metal", fr: "Métal microbillé", text: "Grain mat, uniforme", metal: 0.95, rough: 0.62, coat: 0, pattern: "grain", period: 16 },
  "metal-anodized": { group: "metal", fr: "Aluminium anodisé", text: "Teinté dans la masse de l'oxyde, satiné", metal: 0.85, rough: 0.4, coat: 0, tint: true },
  "plastic-gloss": { group: "plastic", fr: "Plastique brillant", text: "Moule poli", metal: 0, rough: 0.22, coat: 0.2 },
  "plastic-grain": { group: "plastic", fr: "Plastique grainé", text: "Grain de moule, mat", metal: 0, rough: 0.72, coat: 0, pattern: "grain", period: 10 },
  rubber: { group: "plastic", fr: "Caoutchouc", text: "Noir profond, sans reflet", metal: 0, rough: 0.96, coat: 0 },
  carbon: { group: "composite", fr: "Carbone tissé", text: "Sergé 2 × 2 sous vernis", metal: 0.25, rough: 0.3, coat: 1, pattern: "weave", period: 8, own: "#17191d" },
  laminate: { group: "composite", fr: "Stratifié verre-époxy", text: "Le vert d'une carte, satiné", metal: 0, rough: 0.5, coat: 0.4, pattern: "weave", period: 3 },
  glass: { group: "clear", fr: "Verre", text: "Presque invisible, reflets vifs", metal: 0, rough: 0.04, coat: 1, opacity: 0.22 },
  "clear-plastic": { group: "clear", fr: "Plastique transparent", text: "Laisse voir ce qu'il couvre", metal: 0, rough: 0.18, coat: 0.5, opacity: 0.38 },
};
export const SCENES = {
  studio: { fr: "Studio clair", text: "Fond blanc, lumière douce : le produit seul", sky: ["#ffffff", "#e3e8ee"], ground: "#f3f5f7", key: 1.5, fill: 0.5, room: 1 },
  dark: { fr: "Studio sombre", text: "Fond anthracite, reflets marqués", sky: ["#4a5360", "#0f1217"], ground: "#16191e", key: 2.2, fill: 0.22, room: 1.5 },
  sky: { fr: "Plein air", text: "Ciel clair, horizon : le produit dehors", sky: ["#8fc0f0", "#eef4fa"], ground: "#dfe4e8", key: 1.9, fill: 0.6, room: 1.1 },
};
/* az : around the vertical axis from +X toward +Y, el : above the horizon (degrees) ; fill : how much of the picture the product takes */
export const SHOTS = {
  hero: { fr: "Trois-quarts", text: "La vue qui montre le plus", az: -35, el: 18, fill: 0.82 }, side: { fr: "Profil", text: "De côté, à hauteur", az: -90, el: 4, fill: 0.86 },
  front: { fr: "De face", text: "Dans l'axe", az: 0, el: 6, fill: 0.8 }, low: { fr: "Contre-plongée", text: "D'en bas : le produit domine", az: -40, el: -12, fill: 0.84 },
  top: { fr: "Plongée", text: "D'en haut", az: -30, el: 55, fill: 0.78 },
};
export const SIZES = { hd: { fr: "Écran 16:9", w: 1920, h: 1080 }, square: { fr: "Carré", w: 1600, h: 1600 }, portrait: { fr: "Portrait 2:3", w: 1400, h: 2100 }, wide: { fr: "Bandeau 3:1", w: 2400, h: 800 }, uhd: { fr: "Grand format 4K", w: 3840, h: 2160 } };
export const blankRender = () => ({ scene: "studio", shot: "hero", size: "hd", ground: true, labels: true, looks: {}, view: null });
export const renderOf = (asm) => ({ ...blankRender(), ...((asm && asm.render) || {}), looks: { ...(((asm && asm.render) || {}).looks || {}) } });

/** The finish a body wears when nothing is chosen : from the class of its material, and whether it is see-through. */
export function defaultFinish(materialId, opacity = 1) {
  const m = material(materialId), cls = m ? m.cls : "plastic";
  if (opacity < 0.9) return "clear-plastic";
  if (cls === "metal") return "metal-brushed"; if (cls === "elastomer") return "rubber"; if (cls === "pcb") return "laminate";
  return cls === "component" ? "plastic-gloss" : "plastic-grain";
}
/** What a body shows : { finish (id), color, opacity, metal, rough, coat, pattern, period }. body : { name, material, color, opacity } as the kernel built it ;
    choice : what the designer chose for its part ({ finish, color }) — it dresses the main body, the other bodies keep their own material. */
export function bodyLook(body, choice = null, main = "main") {
  const mine = choice && body.name === main ? choice : null, id = mine && FINISHES[mine.finish] ? mine.finish : defaultFinish(body.material, body.opacity ?? 1), F = FINISHES[id];
  const color = mine && F.tint && validHex(mine.color) ? mine.color : F.own && !(mine && validHex(mine.color)) ? F.own : mine && validHex(mine.color) ? mine.color : body.color || "#a8b0b8";
  return { finish: id, color, opacity: F.opacity ?? (id === "clear-plastic" ? 0.38 : 1), metal: F.metal, rough: F.rough, coat: F.coat, pattern: F.pattern || null, period: F.period || 0 };
}
/** One row per part of the assembly, for the screen and the report : { part, name, qty, finish, group, color, chosen }. built : part id → the kernel build. */
export function lookRows(asm, built, names = {}) {
  const R = renderOf(asm), count = new Map(); for (const i of asm.instances) count.set(i.part, (count.get(i.part) || 0) + 1);
  return [...count.keys()].filter((p) => built[p]).map((p) => { const b = built[p], main = b.bodies.find((x) => x.name === b.main) || b.bodies[0], L = bodyLook(main, R.looks[p], main.name);
    return { part: p, name: names[p] || p, qty: count.get(p), finish: L.finish, label: FINISHES[L.finish].fr, group: FINISHES[L.finish].group, color: L.color, chosen: !!(R.looks[p] && FINISHES[R.looks[p].finish]) }; });
}
/** What the render asks for. parts : the ids of the parts of the assembly. → [{ level, text, id, field }] for the guide */
export function renderGuide(asm, parts = []) {
  const out = [], say = (level, text, id = null, field = null) => out.push({ level, text, id, field }), R = renderOf(asm);
  if (!SCENES[R.scene]) say("error", `Décor inconnu : « ${R.scene} ».`, null, "scene"); if (!SHOTS[R.shot] && !R.view) say("error", `Point de vue inconnu : « ${R.shot} ».`, null, "shot"); if (!SIZES[R.size]) say("error", `Format inconnu : « ${R.size} ».`, null, "size");
  for (const [p, c] of Object.entries(R.looks)) {
    if (parts.length && !parts.includes(p)) say("warn", `Une finition est gardée pour ${p}, qui n'est plus dans l'assemblage.`, p, "looks");
    else if (!c || !FINISHES[c.finish]) say("error", `${p} : finition inconnue (« ${c && c.finish} »).`, p, "looks");
    else if (c.color && !validHex(c.color)) say("error", `${p} : couleur illisible (« ${c.color} ») — attendu « #rrggbb ».`, p, "looks");
    else if (c.color && !FINISHES[c.finish].tint) say("tip", `${p} : « ${FINISHES[c.finish].fr} » montre la couleur de la matière — la couleur choisie ne compte pas.`, p, "looks");
  }
  if (!Object.keys(R.looks).length) say("tip", "Aucune finition choisie : chaque pièce montre celle de sa matière. Cliquez une pièce pour l'habiller.", null, "looks");
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
  if (!SCENES[r.scene]) r.scene = b.scene; if (!SHOTS[r.shot]) r.shot = b.shot; if (!SIZES[r.size]) r.size = b.size; r.ground = r.ground !== false; r.labels = r.labels !== false;
  r.looks = Object.fromEntries(Object.entries(r.looks && typeof r.looks === "object" ? r.looks : {}).filter(([, c]) => c && FINISHES[c.finish]).map(([p, c]) => [p, { finish: c.finish, ...(validHex(c.color) ? { color: c.color } : {}) }]));
  r.view = r.view && [r.view.az, r.view.el, r.view.dist].every((x) => Number.isFinite(Number(x))) ? { az: +r.view.az, el: +r.view.el, dist: +r.view.dist } : null;
  return r;
}
