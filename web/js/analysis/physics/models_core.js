/* DesignOrbit.ai — Physique: helpers shared by the analytical models (French numbers for the calculation steps,
   safety checks, section properties, input builders, tiny solvers). SI inside compute(), practical units at the edges. */

export const PI = Math.PI;
export const G0 = 9.80665;             // m/s2
export const SIGMA_SB = 5.670374e-8;   // W/m2.K4 (Stefan-Boltzmann)
export const SHEAR = 0.577;            // shear yield / tensile yield (von Mises, distortion energy)

/** Number of a calculation step: `sig` significant digits, decimal comma, « × 10^n » outside 0,001 .. 999 999. */
export function n(v, sig = 4) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    let e = Math.floor(Math.log10(a)), m = Number((v / 10 ** e).toPrecision(sig));
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    return `${String(m).replace(".", ",")} × 10^${e}`;
  }
  return String(Number(v.toPrecision(sig))).replace(".", ",");
}

/** Safety check. Default: `value` must stay below `limit` (margin = limit / value); `min: true`: value must reach the
    limit (margin = value / limit); `margin` forces it (temperature rises). `sf` = recommended margin: between 1 and sf
    the check is « tight » (verdict "warn"). `soft`: rule of thumb, never a "fail". */
export function chk(label, value, limit, unit, o = {}) {
  let margin = o.margin !== undefined ? o.margin : o.min ? value / limit : limit / value;
  if (Number.isNaN(margin)) margin = 0;
  margin = Math.round(Math.min(999, Math.max(0, margin)) * 1000) / 1000;
  const sf = o.sf > 1 ? o.sf : 1;
  return { label, value, limit, unit, ok: margin >= 1, margin, tight: margin >= 1 && margin < sf, soft: !!o.soft,
    note: o.note || (margin < 1 ? "Limite dépassée." : margin < sf ? `Marge inférieure au coefficient demandé (${n(sf, 3)}).` : "") };
}
export function verdictOf(checks, warnings) {
  if (checks.some((c) => !c.ok && !c.soft)) return "fail";
  return warnings.length || checks.some((c) => !c.ok || c.tight) ? "warn" : "ok";
}

/** Result sheet of one compute(): values, checks, steps (hand calculation) and validity warnings. */
export function sheet() {
  const s = { values: {}, checks: [], steps: [], warnings: [] };
  s.step = (t) => { s.steps.push(t); return s; };
  s.warn = (t) => { s.warnings.push(t); return s; };
  s.check = (...a) => { s.checks.push(chk(...a)); return s; };
  s.set = (o) => { Object.assign(s.values, o); return s; };
  return s;
}

/** Temperature check: the margin compares temperature RISES above the reference (ambient): (Tmax - Tref) / (T - Tref). */
export function tempCheck(S, label, T, Tmax, Tref, o = {}) {
  return S.check(label, T, Tmax, "°C", { margin: (Tmax - Tref) / (T - Tref), ...o, note: o.note || (T > Tmax ? "Température limite dépassée." : "Marge calculée sur les échauffements.") });
}

/* ---------- input / output definition builders ---------- */
export const num = (key, label, unit, def, min, max, step, group, extra) => ({ key, label, unit, default: def, min, max, step, group, ...extra });
export const opt = (key, label, def, options, group, extra) => ({ key, label, unit: "", default: def, options, group, ...extra });
export const out = (key, label, unit) => ({ key, label, unit });
export const MAT = "Matériau", GEO = "Géométrie", LOAD = "Chargement", CRIT = "Critères";

/* ---------- beam / column sections (Roark, table A.1) ---------- */
export const SECTION_OPTIONS = [{ value: "rect", label: "Rectangulaire b × h" }, { value: "round", label: "Ronde pleine Ø d" },
  { value: "tube", label: "Tube rond Ø d, paroi t" }, { value: "custom", label: "Profilé en I ou autre (I, c, A saisis)" }];
export function sectionInputs(group = "Section") {
  return [opt("section", "Forme de la section", "rect", SECTION_OPTIONS, group),
    num("b", "Largeur b", "mm", 20, 0.05, 5000, 0.5, group, { when: { section: ["rect"] } }),
    num("h", "Hauteur h (dans le sens de la charge)", "mm", 10, 0.05, 5000, 0.5, group, { when: { section: ["rect"] } }),
    num("d", "Diamètre extérieur d", "mm", 12, 0.05, 5000, 0.5, group, { when: { section: ["round", "tube"] } }),
    num("t", "Épaisseur de paroi t", "mm", 1.5, 0.05, 2500, 0.1, group, { when: { section: ["tube"] } }),
    num("Ic", "Moment quadratique I", "mm⁴", 8500, 1e-6, 1e12, 100, group, { when: { section: ["custom"] } }),
    num("cc", "Distance à la fibre extrême c", "mm", 10, 0.01, 2500, 0.5, group, { when: { section: ["custom"] } }),
    num("Ac", "Aire de la section A", "mm²", 150, 1e-4, 1e8, 1, group, { when: { section: ["custom"] } })];
}
/** { A mm2, I mm4, c mm, ks (max shear / mean shear), name }; writes its step on the sheet. */
export function sectionProps(i, S) {
  let A, I, c, ks, txt;
  if (i.section === "round" || i.section === "tube") {
    let di = i.section === "tube" ? i.d - 2 * i.t : 0;
    if (di < 0) { di = 0; S.warn("Paroi du tube plus épaisse que le rayon : section calculée comme une barre pleine."); }
    I = PI * (i.d ** 4 - di ** 4) / 64; A = PI * (i.d ** 2 - di ** 2) / 4; c = i.d / 2; ks = di > 0 ? 2 : 4 / 3;
    txt = di > 0 ? `Section tube Ø ${n(i.d)} × ${n(i.t)} mm (dᵢ = ${n(di)} mm) : I = π (d⁴ − dᵢ⁴) / 64 = ${n(I)} mm⁴ ; A = π (d² − dᵢ²) / 4 = ${n(A)} mm² ; c = d / 2 = ${n(c)} mm`
      : `Section ronde Ø ${n(i.d)} mm : I = π d⁴ / 64 = ${n(I)} mm⁴ ; A = π d² / 4 = ${n(A)} mm² ; c = d / 2 = ${n(c)} mm`;
  } else if (i.section === "custom") {
    I = i.Ic; A = i.Ac; c = i.cc; ks = 1;
    txt = `Profilé saisi : I = ${n(I)} mm⁴ ; A = ${n(A)} mm² ; c = ${n(c)} mm`;
  } else {
    I = i.b * i.h ** 3 / 12; A = i.b * i.h; c = i.h / 2; ks = 1.5;
    txt = `Section rectangulaire : I = b h³ / 12 = ${n(i.b)} × ${n(i.h)}³ / 12 = ${n(I)} mm⁴ ; A = b h = ${n(A)} mm² ; c = h / 2 = ${n(c)} mm`;
  }
  S.step(`${txt} (Roark, table A.1).`);
  return { A, I, c, ks, r: Math.sqrt(I / A) };
}

/* ---------- tiny numerical helpers ---------- */
/** Root of an increasing function between lo and hi (bisection). */
export function bisect(f, lo, hi, it = 70) {
  let a = lo, b = hi;
  for (let k = 0; k < it; k++) { const m = (a + b) / 2; if (f(m) > 0) b = m; else a = m; }
  return (a + b) / 2;
}
/** Linear interpolation in a table (clamped at both ends). */
export function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let k = 1; k < xs.length; k++) if (x <= xs[k]) return ys[k - 1] + (ys[k] - ys[k - 1]) * (x - xs[k - 1]) / (xs[k] - xs[k - 1]);
  return ys[ys.length - 1];
}
