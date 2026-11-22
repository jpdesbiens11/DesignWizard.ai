/* DesignOrbit.ai — the lights of the photo studio (demande de JP : « un module de rendu photo avec éclairage, pouvant être
   positionné comme dans un studio… on doit voir les ombres associées à la position de l'éclairage, comme dans un outil
   professionnel »). A light is a lamp one places around the product :
     { id, kind, az, el, power, soft, kelvin, shadow, off }
   az : where it stands around the vertical axis, from +X toward +Y ; el : how high above the horizon (degrees) — the same
   two angles as a point of view (core/render_looks.js). power : how strong (1 = an ordinary lamp) ; soft : the size of the
   source, 0 a point (a sharp shadow) to 1 a large softbox (a shadow that melts) ; kelvin : its colour temperature ;
   shadow : does it cast one ; off : kept, but it counts for nothing (core/onoff.js usage).
   A SETUP is a known way to place a few lights — three-point, high key, low key, backlit, and the sun at different hours ;
   it is laid relative to the camera, as a photographer does. Pure : no DOM, no three.js — core/photo_rig.js makes the lamps. */

export const LIGHT_GROUPS = [{ id: "studio", label: "Studio lights", fr: "Lampes de studio", color: "#d99a1c" }, { id: "day", label: "Daylight", fr: "Lumière du jour", color: "#3b82c4" }];
/* az here is RELATIVE to the camera (0 : behind the camera, 90 : to its right, 180 : behind the product) — where a new light of the kind is put */
export const LIGHT_KINDS = {
  key: { group: "studio", label: "Key light", fr: "Lumière principale", text: "Elle modèle le produit et porte son ombre", az: -45, el: 40, power: 1.6, soft: 0.4, kelvin: 5600, shadow: true },
  fill: { group: "studio", label: "Fill light", fr: "Lumière d'appoint", text: "De l'autre côté : elle débouche les ombres, sans en porter", az: 50, el: 18, power: 0.5, soft: 0.9, kelvin: 6000, shadow: false },
  rim: { group: "studio", label: "Rim light", fr: "Contre-jour", text: "Derrière le produit : elle détache son contour", az: 150, el: 35, power: 1.3, soft: 0.3, kelvin: 6500, shadow: false },
  top: { group: "studio", label: "Top light", fr: "Douche", text: "Au-dessus : un plateau de lumière", az: 0, el: 78, power: 0.8, soft: 0.8, kelvin: 5600, shadow: true },
  sun: { group: "day", label: "Sun", fr: "Soleil", text: "Loin, dur, parallèle : l'ombre nette du plein jour", az: -60, el: 42, power: 2.6, soft: 0.03, kelvin: 5400, shadow: true },
};
export const MAX_LIGHTS = 6, MAX_SHADOWS = 3;
const L = (kind, az, el, power, soft, kelvin, shadow) => ({ kind, az, el, power, soft, kelvin, shadow });
/* ambient : the light that comes from everywhere (the sky, the walls of the studio) — it is what is left in a shadow */
export const LIGHT_SETUPS = {
  "three-point": { group: "studio", label: "Three-point", fr: "Trois points", text: "Principale, appoint, contre-jour : le classique", ambient: 0.35, lights: [L("key", -45, 40, 1.6, 0.4, 5600, true), L("fill", 50, 18, 0.5, 0.9, 6000, false), L("rim", 150, 38, 1.3, 0.3, 6500, false)] },
  "high-key": { group: "studio", label: "High key", fr: "Clair et doux", text: "Tout est éclairé, peu d'ombre : le produit de catalogue", ambient: 0.75, lights: [L("key", -30, 50, 1.3, 0.85, 5600, true), L("fill", 45, 25, 0.9, 1, 5800, false), L("top", 0, 80, 0.7, 0.9, 5600, false)] },
  "low-key": { group: "studio", label: "Low key", fr: "Sombre et contrasté", text: "Une seule lampe dure, de côté : le relief", ambient: 0.08, lights: [L("key", -75, 32, 2.2, 0.15, 5200, true), L("rim", 160, 30, 0.9, 0.25, 7000, false)] },
  backlit: { group: "studio", label: "Backlit", fr: "À contre-jour", text: "Deux lampes derrière : la silhouette", ambient: 0.16, lights: [L("rim", 140, 30, 2, 0.3, 6500, true), L("rim", -150, 42, 1.5, 0.35, 6500, false), L("fill", 10, 15, 0.35, 1, 5600, false)] },
  noon: { group: "day", label: "Midday sun", fr: "Soleil de midi", text: "Haut dans le ciel : ombres courtes et nettes", ambient: 0.55, lights: [L("sun", -55, 62, 2.8, 0.03, 5600, true)] },
  morning: { group: "day", label: "Morning sun", fr: "Soleil du matin", text: "À mi-hauteur : la lumière qui montre les formes", ambient: 0.5, lights: [L("sun", -62, 34, 2.5, 0.03, 5000, true)] },
  golden: { group: "day", label: "Golden hour", fr: "Heure dorée", text: "Bas sur l'horizon : lumière chaude, ombres longues", ambient: 0.5, lights: [L("sun", -70, 13, 3.2, 0.04, 3400, true)] },
  overcast: { group: "day", label: "Overcast", fr: "Ciel couvert", text: "Pas de soleil : une lumière égale, des ombres à peine dites", ambient: 1, lights: [L("top", -20, 70, 0.5, 1, 6800, true)] },
};
export const DEFAULT_SETUP = "three-point";

const num = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const wrap = (a) => { const x = ((Number(a) % 360) + 540) % 360 - 180; return x === -180 ? 180 : x; };
/** One light, with every value in its range. raw : anything ; i : its place, for an id when it has none. */
export function tidyLight(raw, i = 0) {
  const r = raw && typeof raw === "object" ? raw : {}, kind = Object.hasOwn(LIGHT_KINDS, r.kind) ? r.kind : "key", K = LIGHT_KINDS[kind];
  const out = { id: typeof r.id === "string" && /^[\w-]{1,24}$/.test(r.id) ? r.id : `l${i + 1}`, kind, az: Math.round(wrap(num(r.az, K.az, -1e6, 1e6)) * 10) / 10, el: Math.round(num(r.el, K.el, 0, 90) * 10) / 10,
    power: Math.round(num(r.power, K.power, 0, 6) * 100) / 100, soft: Math.round(num(r.soft, K.soft, 0, 1) * 100) / 100, kelvin: Math.round(num(r.kelvin, K.kelvin, 2000, 10000) / 50) * 50, shadow: r.shadow === undefined ? K.shadow : !!r.shadow };
  if (r.off) out.off = true;
  return out;
}
/** A list of lights : at most MAX_LIGHTS, each with an id of its own. */
export function tidyLights(list) {
  const seen = new Set(), out = [];
  for (const raw of (Array.isArray(list) ? list : []).slice(0, MAX_LIGHTS)) { const l = tidyLight(raw, out.length); while (seen.has(l.id)) l.id = `l${seen.size + out.length + 2}`; seen.add(l.id); out.push(l); }
  return out;
}
/** The lights of a setup, laid relative to a camera that stands at camAz. → [{ id, kind, az, … }] */
export function setupLights(id, camAz = -35) { const S = LIGHT_SETUPS[id] || LIGHT_SETUPS[DEFAULT_SETUP]; return tidyLights(S.lights.map((l) => ({ ...l, az: camAz + l.az }))); }
export const setupAmbient = (id) => (LIGHT_SETUPS[id] || LIGHT_SETUPS[DEFAULT_SETUP]).ambient;
/** A light more, of a kind, where that kind usually stands relative to the camera. → the new list, or the same when it is full */
export function addLight(list, kind, camAz = -35) {
  const all = tidyLights(list); if (all.length >= MAX_LIGHTS || !LIGHT_KINDS[kind]) return all;
  let n = all.length + 1; while (all.some((l) => l.id === `l${n}`)) n++;
  return [...all, tidyLight({ id: `l${n}`, kind, az: camAz + LIGHT_KINDS[kind].az }, all.length)];
}
/** A copy of a light, set beside it, born Off (the usage of every list of entries). */
export function copyLight(list, id) {
  const all = tidyLights(list), i = all.findIndex((l) => l.id === id); if (i < 0 || all.length >= MAX_LIGHTS) return all;
  let n = all.length + 1; while (all.some((l) => l.id === `l${n}`)) n++;
  const c = { ...all[i], id: `l${n}`, az: wrap(all[i].az + 20), off: true }; return [...all.slice(0, i + 1), c, ...all.slice(i + 1)];
}
export const liveLights = (list) => tidyLights(list).filter((l) => !l.off && l.power > 0);
/** The lights that cast a shadow : the strongest first, MAX_SHADOWS at most (each shadow is a picture more to draw). */
export const shadowLights = (list) => liveLights(list).filter((l) => l.shadow).sort((a, b) => b.power - a.power).slice(0, MAX_SHADOWS).map((l) => l.id);

/* ---------- where a light is, and what it looks like ---------- */
const rad = (d) => (d * Math.PI) / 180;
/** The unit vector from the product toward a light (Z up). */
export const lightDir = (az, el) => [Math.cos(rad(el)) * Math.cos(rad(az)), Math.cos(rad(el)) * Math.sin(rad(az)), Math.sin(rad(el))];
/** The two angles of a direction. → { az, el } */
export function dirAngles(v) { const n = Math.hypot(v[0], v[1], v[2]) || 1; return { az: (Math.atan2(v[1], v[0]) * 180) / Math.PI, el: (Math.asin(Math.max(-1, Math.min(1, v[2] / n))) * 180) / Math.PI }; }
/** Half the angle under which the product sees the source (degrees) : 0,25° is the sun, 16° a softbox close by. */
export const softAngle = (soft) => 0.25 + 15.75 * Math.pow(Math.max(0, Math.min(1, soft)), 1.5);
/* the colour of a black body, a few anchors (sRGB 0..255), read between them ; 6500 K is the white of the screen */
const BODY = [[2000, 255, 137, 14], [2700, 255, 169, 87], [3200, 255, 187, 120], [4000, 255, 209, 163], [5000, 255, 228, 206], [5600, 255, 238, 227], [6500, 255, 255, 255], [7500, 232, 238, 255], [9000, 212, 224, 255], [10000, 204, 219, 255]];
/** The tint of a light of a colour temperature : [r, g, b] 0..1, the strongest channel at 1. */
export function kelvinRgb(k) {
  const t = Math.max(BODY[0][0], Math.min(BODY[BODY.length - 1][0], Number(k) || 6500)); let i = 1; while (i < BODY.length - 1 && BODY[i][0] < t) i++;
  const a = BODY[i - 1], b = BODY[i], f = (t - a[0]) / (b[0] - a[0]), c = [1, 2, 3].map((j) => (a[j] + (b[j] - a[j]) * f) / 255), m = Math.max(...c);
  return c.map((x) => x / m);
}
export const kelvinHex = (k) => `#${kelvinRgb(k).map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
/** Where the light of sample i of n comes from : its direction moved inside the disc of the source (a spiral that fills it evenly).
    Averaged over the samples, a small source gives a sharp shadow and a large one a shadow that melts with the distance. */
export function sampleDir(light, i, n) {
  const d = lightDir(light.az, light.el); if (n <= 1) return d;
  const R = Math.tan(rad(softAngle(light.soft))), r = R * Math.sqrt((i + 0.5) / n), t = i * 2.399963229728653;
  const u = [-Math.sin(rad(light.az)), Math.cos(rad(light.az)), 0], v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const o = [0, 1, 2].map((j) => d[j] + r * (Math.cos(t) * u[j] + Math.sin(t) * v[j])), m = Math.hypot(...o); return o.map((x) => x / m);
}
const frac = (x) => x - Math.floor(x);
/** Sample i of the light of the sky : a direction of the upper half, every part of the sky as often as another (above 4°). */
export function skyDir(i) { const z0 = Math.sin(rad(4)), z = z0 + (1 - z0) * frac(0.5 + i * 0.7548776662466927), a = 2 * Math.PI * frac(0.5 + i * 0.5698402909980532), s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; }

/* ---------- the plot : the studio seen from above, the camera at the bottom ---------- */
/** Where a light is drawn on the plot : the product at the centre, the horizon on the rim, straight above at the centre.
    camAz : where the camera stands — it is drawn at the bottom, as on a lighting diagram. → [x, y] from the centre, y down, in units of R */
export function plotXY(az, el, camAz = -35, R = 1) { const p = R * (1 - Math.max(0, Math.min(90, el)) / 90), a = rad(az - camAz - 90); return [p * Math.cos(a), -p * Math.sin(a)]; }
/** The light under a point of the plot. → { az, el } */
export function plotToLight(x, y, camAz = -35, R = 1) { const p = Math.min(1, Math.hypot(x, y) / R); return { az: Math.round(wrap((Math.atan2(-y, x) * 180) / Math.PI + camAz + 90)), el: Math.round((1 - p) * 90) }; }
/** A light said in a few words, as a photographer would : which side of the camera, how high, how soft. */
export function lightWords(l, camAz = -35) {
  const a = wrap(l.az - camAz), side = Math.abs(a) < 20 ? "dans l'axe de l'appareil" : Math.abs(a) > 160 ? "derrière le produit" : `${Math.abs(a) > 100 ? "derrière, " : ""}à ${a > 0 ? "droite" : "gauche"}`;
  return `${side} · ${l.el >= 65 ? "au-dessus" : l.el <= 15 ? "rasante" : `${Math.round(l.el)}° de haut`} · ${l.soft >= 0.7 ? "très douce" : l.soft >= 0.3 ? "douce" : "dure"}`;
}

/** What the lighting asks for. lights : the list ; ambient : the light from everywhere (0..1,5). → [{ level, text, id, field }] for the guide */
export function lightGuide(lights, ambient = 0.35) {
  const out = [], say = (level, text, id = null) => out.push({ level, text, id, field: "lights" }), all = tidyLights(lights), live = liveLights(all);
  if (!all.length && ambient < 0.2) say("error", "Aucune lumière : l'image serait noire. Choisissez un éclairage, ou ajoutez une lampe.");
  else if (all.length && !live.length) say(ambient < 0.2 ? "error" : "warn", "Toutes les lumières sont à Off : seule la lumière d'ambiance éclaire le produit.");
  const casting = live.filter((l) => l.shadow);
  if (live.length && !casting.length) say("tip", "Aucune lumière ne porte d'ombre : le produit paraîtra posé sur rien. Donnez une ombre à la lumière principale.");
  if (casting.length > MAX_SHADOWS) say("warn", `${casting.length} lumières portent une ombre : seules les ${MAX_SHADOWS} plus fortes en portent une dans l'image.`);
  for (const l of live) if (l.shadow && l.el < 4) say("warn", `${LIGHT_KINDS[l.kind].label} : à moins de 4° de l'horizon, son ombre s'allonge sans fin.`, l.id);
  return out;
}
