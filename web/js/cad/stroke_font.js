/* DesignWizard.ai — a single-stroke font, made by the tool, for laser marking (JP, 21 novembre 2026 : « label with laser marking on the busbar
   surface around each contact interface »). A laser marks a line : each character is a few straight strokes on a grid 4 wide and 6 high,
   drawn here from scratch — no font of a maker is copied. The capitals, the digits and a few signs a part needs (+, −, ., /) ; a lower-case
   letter is marked as its capital. Pure : textStrokes gives the strokes of a text in the 2D frame of a face. */

const G = {
  A: "0 0 2 6|2 6 4 0|1 3 3 3", B: "0 0 0 6|0 6 3 6|3 6 4 5|4 5 4 4|4 4 3 3|0 3 3 3|3 3 4 2|4 2 4 1|4 1 3 0|3 0 0 0",
  C: "4 5 3 6|3 6 1 6|1 6 0 5|0 5 0 1|0 1 1 0|1 0 3 0|3 0 4 1", D: "0 0 0 6|0 6 3 6|3 6 4 5|4 5 4 1|4 1 3 0|3 0 0 0",
  E: "4 6 0 6|0 6 0 0|0 0 4 0|0 3 3 3", F: "4 6 0 6|0 6 0 0|0 3 3 3", G: "4 5 3 6|3 6 1 6|1 6 0 5|0 5 0 1|0 1 1 0|1 0 3 0|3 0 4 1|4 1 4 3|4 3 2 3",
  H: "0 0 0 6|4 0 4 6|0 3 4 3", I: "1 6 3 6|2 6 2 0|1 0 3 0", K: "0 0 0 6|4 6 0 2|1 3 4 0", L: "0 6 0 0|0 0 4 0", M: "0 0 0 6|0 6 2 3|2 3 4 6|4 6 4 0",
  N: "0 0 0 6|0 6 4 0|4 0 4 6", O: "1 0 3 0|3 0 4 1|4 1 4 5|4 5 3 6|3 6 1 6|1 6 0 5|0 5 0 1|0 1 1 0", P: "0 0 0 6|0 6 3 6|3 6 4 5|4 5 4 4|4 4 3 3|3 3 0 3",
  R: "0 0 0 6|0 6 3 6|3 6 4 5|4 5 4 4|4 4 3 3|3 3 0 3|2 3 4 0", S: "4 5 3 6|3 6 1 6|1 6 0 5|0 5 0 4|0 4 1 3|1 3 3 3|3 3 4 2|4 2 4 1|4 1 3 0|3 0 1 0|1 0 0 1",
  T: "0 6 4 6|2 6 2 0", U: "0 6 0 1|0 1 1 0|1 0 3 0|3 0 4 1|4 1 4 6", V: "0 6 2 0|2 0 4 6", W: "0 6 1 0|1 0 2 3|2 3 3 0|3 0 4 6", X: "0 0 4 6|0 6 4 0", Y: "0 6 2 3|4 6 2 3|2 3 2 0", Z: "0 6 4 6|4 6 0 0|0 0 4 0",
  0: "1 0 3 0|3 0 4 1|4 1 4 5|4 5 3 6|3 6 1 6|1 6 0 5|0 5 0 1|0 1 1 0|0 1 4 5", 1: "1 5 2 6|2 6 2 0|1 0 3 0", 2: "0 5 1 6|1 6 3 6|3 6 4 5|4 5 4 4|4 4 0 0|0 0 4 0",
  3: "0 5 1 6|1 6 3 6|3 6 4 5|4 5 4 4|4 4 3 3|3 3 1 3|3 3 4 2|4 2 4 1|4 1 3 0|3 0 1 0|1 0 0 1", 4: "3 0 3 6|3 6 0 2|0 2 4 2",
  5: "4 6 0 6|0 6 0 3|0 3 3 3|3 3 4 2|4 2 4 1|4 1 3 0|3 0 0 0", 6: "3 6 1 6|1 6 0 5|0 5 0 1|0 1 1 0|1 0 3 0|3 0 4 1|4 1 4 2|4 2 3 3|3 3 0 3", 7: "0 6 4 6|4 6 1 0",
  8: "1 3 0 4|0 4 0 5|0 5 1 6|1 6 3 6|3 6 4 5|4 5 4 4|4 4 3 3|3 3 1 3|1 3 0 2|0 2 0 1|0 1 1 0|1 0 3 0|3 0 4 1|4 1 4 2|4 2 3 3",
  9: "4 3 1 3|1 3 0 4|0 4 0 5|0 5 1 6|1 6 3 6|3 6 4 5|4 5 4 1|4 1 3 0|3 0 1 0", "+": "2 1 2 5|0 3 4 3", "-": "0.5 3 3.5 3", ".": "1.8 0 2.2 0", "/": "0 0 4 6" };
const GLYPHS = Object.fromEntries(Object.entries(G).map(([c, s]) => [c, s.split("|").map((x) => x.split(" ").map(Number))]));
const ALIAS = { "−": "-", "–": "-" };
export const MARK_CHARS = Object.keys(GLYPHS).join("");
const norm = (c) => ALIAS[c] || c.toUpperCase();
/** The characters of a text this font cannot mark (a space is a gap). */
export const unmarkable = (text) => [...new Set([...String(text)].filter((c) => c !== " " && !GLYPHS[norm(c)]))];
/** The width of a text of cap height h : 4 units a character, 2 between two, the grid is 6 high. */
export const textWidth = (text, h) => { const n = [...String(text)].length; return n ? (n * 6 - 2) * h / 6 : 0; };
/** The strokes of a text, centred on `at`, reading along `dir` (a vector of the face), its capitals `h` high, toward `up` (by default `dir` turned a
    quarter to the left — give it when the face is seen mirrored, as the +Y face of a part is). → [[u1, v1, u2, v2]] in the frame of the face. */
export function textStrokes(text, { h, at = [0, 0], dir = [1, 0], up = null }) {
  const k = h / 6, d = Math.hypot(dir[0], dir[1]) || 1, a = [dir[0] / d, dir[1] / d], e = up ? Math.hypot(up[0], up[1]) || 1 : 1, b = up ? [up[0] / e, up[1] / e] : [-a[1], a[0]], w = textWidth(text, h), out = [];
  const P = (x, y) => [at[0] + a[0] * (x - w / 2) + b[0] * (y - h / 2), at[1] + a[1] * (x - w / 2) + b[1] * (y - h / 2)];
  [...String(text)].forEach((c, i) => { const g = GLYPHS[norm(c)]; if (!g) return; const x0 = i * 6 * k;
    for (const [x1, y1, x2, y2] of g) { const p = P(x0 + x1 * k, y1 * k), q = P(x0 + x2 * k, y2 * k); out.push([+p[0].toFixed(4), +p[1].toFixed(4), +q[0].toFixed(4), +q[1].toFixed(4)]); } });
  return out;
}
