/* DynamiteOrbit.ai — the colours of a result : how a value becomes a colour on the model.
   « Rainbow » is the scale of a calculation plot, blue to red. « Iron » and « White hot » are the two scales an infrared camera
   usually offers : with them a thermal result reads like a thermal image — black and cold at one end, white and hot at the other,
   lighter all the way up — to be put beside the picture taken on the bench. The scales are made here, a few colours joined by
   straight lines : none is the palette of a camera maker. What is outside the scale takes a colour the scale does not have.
   Pure : no page. */

export const PALETTES = {
  rainbow: { label: "Rainbow", fr: "arc-en-ciel", stops: [[0.05, 0.25, 0.85], [0, 0.75, 0.9], [0.2, 0.78, 0.25], [1, 0.88, 0.1], [0.9, 0.12, 0.1]], over: [0.85, 0.27, 0.94], under: [0.62, 0.64, 0.68], overFr: "magenta", underFr: "gris" },
  iron: { label: "Iron", fr: "fer", ir: true, stops: [[0.02, 0.02, 0.09], [0.2, 0.03, 0.42], [0.55, 0.06, 0.52], [0.84, 0.2, 0.3], [0.96, 0.45, 0.08], [1, 0.74, 0.14], [1, 0.93, 0.5], [1, 1, 0.96]], over: [0.2, 0.95, 0.45], under: [0.15, 0.5, 1], overFr: "vert", underFr: "bleu" },
  white: { label: "White hot", fr: "blanc chaud", ir: true, stops: [[0.03, 0.03, 0.03], [1, 1, 1]], over: [0.95, 0.2, 0.18], under: [0.15, 0.5, 1], overFr: "rouge", underFr: "bleu" },
};
export const paletteOf = (name) => PALETTES[name] || PALETTES.rainbow;
/** Is this scale one of an infrared camera ? */
export const isInfrared = (name) => !!paletteOf(name).ir;

/** The colour of a share of the scale (0 : its bottom, 1 : its top). → [r, g, b], each 0 to 1 */
export function paletteColour(name, t) {
  const s = paletteOf(name).stops, x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i;
  return s[i].map((c, k) => c + (s[i + 1][k] - c) * f);
}
/** The scale as a strip, for a legend (a CSS gradient). */
export const paletteCss = (name) => `linear-gradient(90deg, ${paletteOf(name).stops.map((c) => `rgb(${c.map((v) => Math.round(v * 255)).join(", ")})`).join(", ")})`;
/** How light a colour looks (0 black, 1 white) : what the eye orders an infrared image by. */
export const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The colours of a field on a scale : one value per vertex → three numbers per vertex. Above the scale and below it, the two
    colours the palette keeps for that. range : [low, high] */
export function fieldColours(val, range, name = "rainbow") {
  const p = paletteOf(name), [a, b] = range, span = (b - a) || 1, col = new Float32Array(3 * val.length);
  for (let i = 0; i < val.length; i++) {
    const x = val[i], c = x > b * (1 + 1e-9) + 1e-12 ? p.over : x < a - 1e-9 * Math.abs(a) - 1e-12 ? p.under : paletteColour(name, (x - a) / span);
    col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2];
  }
  return col;
}
