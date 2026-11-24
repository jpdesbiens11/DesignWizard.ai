/* DynamiteOrbit.ai — standard sizes used by features, interfaces and DFx checks (ISO metric). All in mm.
   Sources: ISO 273 (clearance holes), ISO 4762 (socket head cap screws), ISO 10642 (countersunk), ISO 7089 (washers),
   usual tap drill sizes (ISO 2306) and typical heat-set insert data (to confirm with the insert supplier). */

export const THREADS = {
  //        nominal, pitch, tap drill, clearance fine/medium/coarse, cap-head Ø / height, counterbore Ø, csk head Ø, washer OD, insert hole Ø / length
  "M2":   { d: 2,   p: 0.4,  tap: 1.6,  clr: [2.2, 2.4, 2.6],   head: [3.8, 2],   cbore: 4.4,  csk: 4.4,  washer: 5,  insert: [3.2, 4.0] },
  "M2.5": { d: 2.5, p: 0.45, tap: 2.05, clr: [2.7, 2.9, 3.1],   head: [4.5, 2.5], cbore: 5.5,  csk: 5.5,  washer: 6,  insert: [4.0, 5.0] },
  "M3":   { d: 3,   p: 0.5,  tap: 2.5,  clr: [3.2, 3.4, 3.6],   head: [5.5, 3],   cbore: 6.5,  csk: 6.72, washer: 7,  insert: [4.0, 5.8] },
  "M4":   { d: 4,   p: 0.7,  tap: 3.3,  clr: [4.3, 4.5, 4.8],   head: [7, 4],     cbore: 8,    csk: 8.96, washer: 9,  insert: [5.6, 8.2] },
  "M5":   { d: 5,   p: 0.8,  tap: 4.2,  clr: [5.3, 5.5, 5.8],   head: [8.5, 5],   cbore: 10,   csk: 11.2, washer: 10, insert: [6.4, 9.5] },
  "M6":   { d: 6,   p: 1.0,  tap: 5.0,  clr: [6.4, 6.6, 7.0],   head: [10, 6],    cbore: 11,   csk: 13.44, washer: 12, insert: [8.0, 12.7] },
  "M8":   { d: 8,   p: 1.25, tap: 6.8,  clr: [8.4, 9.0, 10.0],  head: [13, 8],    cbore: 15,   csk: 17.92, washer: 16, insert: [9.6, 12.7] },
  "M10":  { d: 10,  p: 1.5,  tap: 8.5,  clr: [10.5, 11.0, 12.0], head: [16, 10],  cbore: 18,   csk: 22.4, washer: 20, insert: [12.0, 15.0] },
  "M12":  { d: 12,  p: 1.75, tap: 10.2, clr: [13.0, 13.5, 14.5], head: [18, 12],  cbore: 20,   csk: 26.88, washer: 24, insert: [14.0, 18.0] },
};
export const FITS = { close: 0, fine: 0, medium: 1, normal: 1, coarse: 2, loose: 2 };

export function thread(name) {
  const t = THREADS[String(name || "").toUpperCase()];
  if (!t) throw new Error(`Vis inconnue « ${name} ». Tailles : ${Object.keys(THREADS).join(", ")}.`);
  return t;
}
export const clearanceHole = (name, fit = "medium") => thread(name).clr[FITS[fit] ?? 1];

/** Standard screw lengths (ISO 4762 preferred series). */
export const SCREW_LENGTHS = [4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80];
/** Shortest standard length giving `engagement` of thread after crossing `grip` of clamped material. */
export function screwLength(grip, engagement) {
  const need = grip + engagement;
  return SCREW_LENGTHS.find((l) => l >= need - 1e-6) || Math.ceil(need / 10) * 10;
}

/** Standard twist-drill diameters (0.1 steps to 10 mm, 0.5 beyond): the next size at or above d. */
export function standardDrill(d) {
  const step = d <= 10 ? 0.1 : 0.5;
  return Math.round(Math.ceil(d / step - 1e-6) * step * 100) / 100;
}
export const isStandardDrill = (d) => Math.abs(standardDrill(d) - d) < 1e-6 || Object.values(THREADS).some((t) => Math.abs(t.tap - d) < 1e-6 || t.clr.some((c) => Math.abs(c - d) < 1e-6));

/** Common end-mill diameters; an inside corner radius should be at least 0.5 x tool + a little (tool engagement). */
export const END_MILLS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
/** Stock sheet thicknesses (mm) often held by sheet-metal shops. */
export const SHEET_GAUGES = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0];
/** Standard PCB thicknesses. */
export const PCB_THICKNESS = [0.8, 1.0, 1.2, 1.6, 2.0, 2.4];

/** ISO 286 fundamental deviations for a few common fits (µm) by nominal size range — enough for H7/g6, H7/h6, H7/p6, H8/f7. */
const IT = { 6: [6, 8, 9, 11, 13, 16, 19, 22, 25], 7: [10, 12, 15, 18, 21, 25, 30, 35, 40], 8: [14, 18, 22, 27, 33, 39, 46, 54, 63] };
const RANGES = [3, 6, 10, 18, 30, 50, 80, 120, 180];
const DEV = { g: [-2, -4, -5, -6, -7, -9, -10, -12, -14], f: [-6, -10, -13, -16, -20, -25, -30, -36, -43], h: [0, 0, 0, 0, 0, 0, 0, 0, 0], p: [6, 12, 15, 18, 22, 26, 32, 37, 43] };
/** Limits (mm) of an ISO fit like "H7" (hole) or "g6" (shaft) at nominal size d. */
export function isoLimits(code, d) {
  const m = /^([A-Za-z])(\d)$/.exec(String(code).trim());
  const i = RANGES.findIndex((r) => d <= r);
  if (!m || i < 0 || !IT[m[2]]) return null;
  const it = IT[m[2]][i] / 1000, letter = m[1];
  if (letter === "H") return { lo: 0, hi: it };
  const dev = DEV[letter.toLowerCase()];
  if (!dev) return null;
  const es = dev[i] / 1000;
  return letter.toLowerCase() === "p" ? { lo: es, hi: es + it } : { lo: es - it, hi: es };
}
