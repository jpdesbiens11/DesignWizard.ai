/* DesignWizard.ai — PCBA: a single-stroke font for silkscreen and assembly drawings. Each glyph is drawn on a grid
   4 wide and 6 high ; a stroke is a string of digit pairs « xy ». Lower case reads as upper case ; an unknown
   character is a small box. The strokes are drawn with a round pen, like every line of a Gerber file. */

const G = {
  A: "0004264440 0242", B: "00063645443303 3342413000", C: "4536160501103041", D: "00062644422000", E: "40000646 0333", F: "000646 0333", G: "45361605011030414323", H: "0006 4046 0343",
  I: "1030 2026 1636", J: "0110304146", K: "0006 460340", L: "060040", M: "0006234640", N: "00064046", O: "103041453616050110", P: "00063645443303", Q: "103041453616050110 2240", R: "00063645443303 2340",
  S: "453616050413334241301001", T: "0646 2026", U: "060110304146", V: "062046", W: "0610233046", X: "0046 0640", Y: "062346 2320", Z: "06460040",
  0: "103041453616050110 1135", 1: "152620 1030", 2: "05163645440040", 3: "05163645443313 334241301001", 4: "30360242", 5: "460603334241301001", 6: "4536160501103041423303", 7: "064610",
  8: "13040516364544331302011030414233", 9: "0110304145361605041343",
  "+": "0343 2125", "-": "0343", ".": "2020", ",": "2011", _: "0040", "/": "0046", ":": "2222 2424", "(": "36242230", ")": "16242210", "#": "1016 3036 0242 0444", "%": "0046 1616 3030", "=": "0242 0444",
  "µ": "0400 01102031 3430", "Ω": "001012030516364543323040", "°": "1526352415", " ": "",
};
const BOX = "0040460600", ADVANCE = 6;
const glyph = (ch) => { const c = ch === "μ" ? "µ" : ch, up = c === "µ" ? c : c.toUpperCase(); return G[up] !== undefined ? G[up] : BOX; };

/** Width of a text of height h, in millimetres. */
export const textWidth = (text, h) => (String(text).length * ADVANCE - 2) * h / 6;

/** Strokes of a text as polylines in board coordinates.
    opts : { x, y, h, rot (0 / 90 / 180 / 270), mirror (bottom side), align: "left" | "center" | "right" } ; (x, y) is on the baseline. */
export function textStrokes(text, { x = 0, y = 0, h = 1, rot = 0, mirror = false, align = "left" } = {}) {
  const s = h / 6, str = String(text), w = textWidth(str, h), x0 = align === "center" ? -w / 2 : align === "right" ? -w : 0, out = [], q = ((Math.round(rot / 90) % 4) + 4) % 4;
  const put = (px, py) => { let u = mirror ? -px : px, v = py; for (let k = 0; k < q; k++) [u, v] = [-v, u]; return [x + u, y + v]; };
  [...str].forEach((ch, i) => {
    for (const stroke of glyph(ch).split(" ")) {
      if (!stroke) continue;
      const pts = [];
      for (let k = 0; k + 1 < stroke.length; k += 2) pts.push(put(x0 + (i * ADVANCE + +stroke[k]) * s, +stroke[k + 1] * s));
      out.push(pts);
    }
  });
  return out;
}
