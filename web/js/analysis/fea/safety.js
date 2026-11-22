/* DesignOrbit.ai — the safety factor of a structural result, point by point : the yield strength of the material over
   the von Mises stress there. It is read against the factor the designer aims at : below it the part is red, whatever
   else ; above it the colour goes from orange (just enough) through blue (comfortable) to green (ample). Pure : the
   screen paints the model with it, the report can quote its summary.
   The stress of a coarse mesh is indicative, so is this factor : local peaks (holes, fillets, the edge of a clamp) are
   not resolved. The yield strengths are typical values ; the data sheet of the grade prevails. */

export const FS_TARGETS = [1.25, 1.5, 2, 3, 4];
/** Colours of the bands (hex) ; two colours : the band shades from the first, at its lower bound, to the second. */
export const FS_COLORS = { yield: ["#7f1d1d", "#7f1d1d"], under: ["#dc2626", "#dc2626"], tight: ["#ea580c", "#fbbf24"], ok: ["#2563eb", "#22d3ee"], ample: ["#16a34a", "#16a34a"], none: ["#9ca3af", "#9ca3af"] };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const RGB = Object.fromEntries(Object.entries(FS_COLORS).map(([k, [a, b]]) => [k, [rgb(a), rgb(b)]]));
const clean = (t) => (Number.isFinite(t) && t >= 1 ? Math.min(t, 20) : 1.5);

/** The bands of a target factor T, from the worst : beyond yield (below 1), under the target, tight (T to 1,5 T),
    comfortable (1,5 T to 3 T), ample (3 T and more). → [{ key, from, to, fr }] ; `to` is Infinity for the last one. */
export function fsBands(target) {
  const T = clean(target), out = [];
  if (T > 1) out.push({ key: "yield", from: 0, to: 1, fr: "au-delà de la limite élastique" });
  out.push({ key: "under", from: T > 1 ? 1 : 0, to: T, fr: T > 1 ? "sous la marge visée" : "au-delà de la limite élastique" }, { key: "tight", from: T, to: 1.5 * T, fr: "marge juste" },
    { key: "ok", from: 1.5 * T, to: 3 * T, fr: "marge confortable" }, { key: "ample", from: 3 * T, to: Infinity, fr: "large marge" });
  return out;
}
/** The band a factor falls in ("none" when the yield strength of the material is not known). */
export function fsBand(fs, target) {
  if (Number.isNaN(fs)) return "none";
  const T = clean(target); return fs < 1 && T > 1 ? "yield" : fs < T ? "under" : fs < 1.5 * T ? "tight" : fs < 3 * T ? "ok" : "ample";
}
/** Colour of a factor for a target, as [r, g, b] in 0..1. */
export function fsColour(fs, target) {
  const key = fsBand(fs, target), [a, b] = RGB[key]; if (key !== "tight" && key !== "ok") return a;
  const T = clean(target), lo = key === "tight" ? T : 1.5 * T, hi = key === "tight" ? 1.5 * T : 3 * T, t = Math.min(1, Math.max(0, (fs - lo) / (hi - lo)));
  return a.map((c, i) => c + (b[i] - c) * t);
}
/** Factor at one point : NaN when the yield strength is unknown, Infinity where nothing is stressed. */
export const safetyOf = (vm, re) => (re > 0 ? (vm > 1e-12 ? re / vm : Infinity) : NaN);
/** The factor on the skin of a result. val : von Mises at the 4 vertices of each exposed face ; re : yield strength of the
    body of each face (0 : unknown) — or one number for a single material. → Float32Array, one value per vertex */
export function safetyField(val, re) {
  const out = new Float32Array(val.length), one = typeof re === "number";
  for (let i = 0; i < val.length; i++) out[i] = safetyOf(val[i], one ? re : re[i >> 2]);
  return out;
}
/** What the field says against a target : { min, at (vertex), under, yield, known (shares of the faces, by their worst
    vertex ; `under` includes `yield`), band (of the minimum) } — min is null when no material has a yield strength. */
export function safetySummary(fs, target) {
  const T = clean(target), faces = fs.length >> 2; let min = Infinity, at = -1, under = 0, yielded = 0, known = 0;
  for (let f = 0; f < faces; f++) {
    let worst = Infinity, has = false;
    for (let c = 0; c < 4; c++) { const v = fs[4 * f + c]; if (Number.isNaN(v)) continue; has = true; if (v < worst) worst = v; if (v < min) { min = v; at = 4 * f + c; } }
    if (!has) continue; known++; if (worst < T) under++; if (worst < 1) yielded++;
  }
  return { min: known ? min : null, at, under: faces ? under / faces : 0, yield: faces ? yielded / faces : 0, known: faces ? known / faces : 0, band: known ? fsBand(min, T) : "none", target: T };
}
/** One sentence for the panel and the report. */
export function safetyText(s) {
  const n = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","), pc = (v) => (v > 0 && v < 0.01 ? "moins de 1" : String(Math.round(v * 100)));
  if (s.min === null) return "Limite élastique inconnue pour ce matériau : pas de facteur de sécurité.";
  const head = `Facteur de sécurité minimal ${Number.isFinite(s.min) ? n(s.min) : "sans limite"} pour ${n(s.target)} visé`;
  if (s.under === 0) return `${head} : la marge est tenue partout.`;
  return `${head} : ${pc(s.under)} % de la surface est sous la marge${s.yield > 0 ? `, dont ${pc(s.yield)} % au-delà de la limite élastique` : ""}.`;
}
