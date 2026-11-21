/* DesignWizard.ai — the look of a part on screen : the colour and the shade its designer gives it to tell the parts apart,
   how see-through it is, the pattern laid on it (a camouflage) and how it answers light (its sheen). A visual aid, not a property
   of the product : it is not a finish, it goes on no drawing.
   look = { color: "#rrggbb", opacity: 0.2 … 1, pattern: "camo-forest", sheen: "matte" } — each one optional. It is held by a part
   (spec.look : every instance of the part wears it) and, in an assembly, by an instance (inst.look : this part, or this whole
   sub-assembly, HERE). The assembly wins over the part, and the outer assembly over the inner one — the convention of mechanical
   modellers, where an appearance given in an assembly overrides the part's own (overLook, core/asm_levels.js flatAsm).
   A part without a look shows the colour of its material. The look paints the main body of the part ; a body with a colour of its
   own (spec.bodies) keeps it. A look never dirties a review or a released revision (core/review.js leaves « look » out of the
   signature). Patterns and sheens : core/look_patterns.js. Pure : no DOM. */

import { validPattern, validSheen, DEFAULT_SHEEN, PATTERNS, SHEENS } from "./look_patterns.js";

/** The colours offered, one row each ; the shades are the columns. */
export const HUES = [
  { id: "grey", fr: "Gris", hex: "#8a94a0" }, { id: "blue", fr: "Bleu", hex: "#3d86e6" }, { id: "cyan", fr: "Cyan", hex: "#22b8cf" }, { id: "teal", fr: "Sarcelle", hex: "#25ad9f" },
  { id: "green", fr: "Vert", hex: "#46b97c" }, { id: "yellow", fr: "Jaune", hex: "#f2c230" }, { id: "orange", fr: "Orange", hex: "#ee8a32" }, { id: "red", fr: "Rouge", hex: "#e8554b" },
  { id: "pink", fr: "Rose", hex: "#e9708f" }, { id: "violet", fr: "Violet", hex: "#8a7df0" }, { id: "brown", fr: "Brun", hex: "#a0744c" },
];
export const SHADES = [{ level: -2, fr: "très clair" }, { level: -1, fr: "clair" }, { level: 0, fr: "franc" }, { level: 1, fr: "foncé" }, { level: 2, fr: "très foncé" }];
export const OPACITIES = [{ v: 1, fr: "Opaque" }, { v: 0.6, fr: "Voilé" }, { v: 0.3, fr: "Transparent" }];
const STEP = 0.18;       // what « plus clair » and « plus foncé » move by

/** "#rrggbb" in lower case from "#rgb", "#RRGGBB" or "rrggbb" ; null for anything else. */
export function validHex(x) {
  const s = String(x ?? "").trim().replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : /^[0-9a-f]{3}$/.test(s) ? `#${[...s].map((c) => c + c).join("")}` : null;
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), hexOf = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
/** A colour pulled toward white (k < 0) or toward black (k > 0), k between −1 and 1. */
export function mix(hex, k) {
  const h = validHex(hex); if (!h) return null;
  const to = k < 0 ? 255 : 0, a = Math.min(1, Math.abs(k));
  return hexOf(rgb(h).map((v) => v + (to - v) * a));
}
/** The shade of a colour : level −2 (very light) … 0 (as it is) … 2 (very dark). */
export const shade = (hex, level) => mix(hex, { "-2": -0.58, "-1": -0.3, 0: 0, 1: 0.26, 2: 0.5 }[Math.max(-2, Math.min(2, Math.round(level)))]);
export const lighter = (hex) => mix(hex, -STEP), darker = (hex) => mix(hex, STEP);
/** How light a colour looks, 0 (black) … 1 (white) : the text on a swatch is dark above 0,6. */
export function luminance(hex) { const h = validHex(hex); if (!h) return 0; const [r, g, b] = rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

/** The grid of the picker : a row per colour, a cell per shade. */
export const palette = () => HUES.map((h) => ({ ...h, cells: SHADES.map((s) => ({ hex: shade(h.hex, s.level), level: s.level, label: `${h.fr} ${s.fr}` })) }));
/** The name of a colour when it is one of the grid (« Bleu clair »), its code otherwise. */
export function colorName(hex) {
  const h = validHex(hex); if (!h) return "";
  for (const row of palette()) { const c = row.cells.find((x) => x.hex === h); if (c) return c.label; }
  return h;
}

const clampOpacity = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0.2, Math.min(1, Math.round(v * 100) / 100)) : null);
/** A look put in order, whatever holds it : { color (valid or null), opacity (0,2 … 1, or null), pattern (a known one, or null), sheen (or null) }. */
export function tidyLook(l) {
  const x = l && typeof l === "object" ? l : {};
  return { color: validHex(x.color), opacity: clampOpacity(x.opacity), pattern: validPattern(x.pattern), sheen: validSheen(x.sheen) };
}
/** Does a look say anything ? */
export const hasLook = (l) => !!(l && (l.color || l.pattern || l.sheen || (l.opacity !== null && l.opacity !== undefined)));
/** What a part — or an instance of an assembly — asks for. */
export function lookOf(holder) { return tidyLook(holder && holder.look); }
/** What a part shows, given the colour of its material : { color, opacity, pattern, sheen, own (it has a look of its own) }. */
export function shownLook(spec, materialColor, materialOpacity = 1) {
  const l = lookOf(spec);
  return { color: l.color || validHex(materialColor) || "#b9c6ce", opacity: l.opacity ?? materialOpacity ?? 1, pattern: l.pattern, sheen: l.sheen || DEFAULT_SHEEN, own: hasLook(l) };
}
/** Sets or clears the look of a part or of an instance, in place. patch : { color, opacity, pattern, sheen } — null clears one. A plain
    colour chosen takes the pattern away (one paint at a time) ; an opaque part keeps no opacity, a satin one no sheen. */
export function setLook(holder, patch = {}) {
  const cur = lookOf(holder), next = { color: "color" in patch ? validHex(patch.color) : cur.color, opacity: "opacity" in patch ? clampOpacity(patch.opacity) : cur.opacity,
    pattern: "pattern" in patch ? validPattern(patch.pattern) : cur.pattern, sheen: "sheen" in patch ? validSheen(patch.sheen) : cur.sheen };
  if ("color" in patch && next.color && !("pattern" in patch)) next.pattern = null;
  if (next.opacity !== null && next.opacity >= 1) next.opacity = null;
  if (next.sheen === DEFAULT_SHEEN) next.sheen = null;
  if (!hasLook(next)) delete holder.look;
  else holder.look = { ...(next.color ? { color: next.color } : {}), ...(next.opacity !== null ? { opacity: next.opacity } : {}), ...(next.pattern ? { pattern: next.pattern } : {}), ...(next.sheen ? { sheen: next.sheen } : {}) };
  return holder;
}
/** A look laid over another : what the outer one says wins. The paint — a colour or a pattern — is taken whole from the one that gives
    one (a plain colour given in an assembly covers the pattern of the part) ; the opacity and the sheen each on their own. → a tidy look */
export function overLook(inner, outer) {
  const a = tidyLook(inner), b = tidyLook(outer), paint = b.color || b.pattern ? b : a;
  return { color: paint.color, pattern: paint.pattern, opacity: b.opacity ?? a.opacity, sheen: b.sheen ?? a.sheen };
}
/** A look in a few words : « Camouflage Forest, mat », « Bleu clair, voilé », or "" when it says nothing. */
export function lookWords(look) {
  const l = tidyLook(look), out = [];
  if (l.pattern) out.push(`Camouflage ${PATTERNS[l.pattern].label}`); else if (l.color) out.push(colorName(l.color));
  if (l.sheen) out.push(SHEENS[l.sheen].fr.toLowerCase());
  if (l.opacity !== null) out.push(l.opacity <= 0.45 ? "transparent" : "voilé");
  return out.join(", ");
}
/** A colour of its own for every part that has none : colours in turn, then their light and dark shades, so that neighbours in
    the list differ. taken : the colours already in use. → Map id → "#rrggbb" for the parts to paint (none for those that have one). */
export function autoLooks(parts) {
  const used = new Set((parts || []).map((p) => lookOf(p).color).filter(Boolean)), out = new Map();
  const order = [0, -1, 1, -2, 2].flatMap((level) => HUES.filter((h) => h.id !== "grey").map((h) => shade(h.hex, level)));
  let k = 0;
  for (const p of parts || []) {
    if (lookOf(p).color) continue;
    while (k < order.length && used.has(order[k])) k++;
    const hex = order[k % order.length]; used.add(hex); out.set(p.id, hex); k++;
  }
  return out;
}
