/* DynamiteOrbit — what the formulas of a workbook are written with : a choice read from a table, a value read between
   the points of a table, a margin, the properties of air at a temperature, and the two ways a spreadsheet finds a root
   without a solver — a bisection laid out as a table (one row per step), and a fixed number of substitutions. Pure.
   A formula names what it reads between braces : {key} an input, {p:prop} a property of a medium, {h:key} an
   intermediate cell, {o:key} a result, {s:key} a cell of the sheet « Solveur ». */

/** A number as a spreadsheet reads it in a formula (no « e-8 » in lower case). */
export const xn = (v) => String(v).replace("e", "E");
/** Is this choice the one named ? A list may hand back « 8.8 » as a number : both are read. */
export const is = (key, v) => (/^-?\d+(\.\d+)?$/.test(v) ? `OR({${key}}="${v}",{${key}}=${v})` : `{${key}}="${v}"`);
/** A value by choice : pick("size", { M3: 3, M4: 4 }, 6) → IF(size="M3",3,IF(size="M4",4,6)). */
export const pick = (key, table, other) => Object.entries(table).reduceRight((rest, [k, v]) => `IF(${is(key, k)},${xn(v)},${rest})`, xn(other));
/** A value read between the points of a table, held at both ends — the same straight lines as interp() of the models. x : a formula. */
export const between = (xs, ys, x) => `(${xn(ys[0])}${xs.slice(1).map((xk, k) => `+(${xn(ys[k + 1])}-${xn(ys[k])})/(${xn(xk)}-${xn(xs[k])})*(MIN(MAX(${x},${xn(xs[k])}),${xn(xk)})-${xn(xs[k])})`).join("")})`;
/** min(999, a / b), and 999 when b is nothing : the margin a model shows among its results. */
export const upTo999 = (a, b) => `IF(${b}>0,MIN(999,${a}/${b}),999)`;

/* ---------- air at 1 atm, as props.js computes it : ideal gas, Sutherland's law ; T a formula in kelvin, kept inside -50 … 300 °C ---------- */
export const filmK = (T) => `MIN(573.15,MAX(223.15,${T}+273.15))`;
export const AIR = { cp: 1007, rho: (K) => `(352.98/${K})`, mu: (K) => `(0.00001716*(${K}/273.15)^1.5*383.55/(${K}+110.4))`, k: (K) => `(0.02364*(${K}/273.15)^1.5*467.15/(${K}+194))` };
AIR.nu = (K) => `(${AIR.mu(K)}/${AIR.rho(K)})`; AIR.alpha = (K) => `(${AIR.k(K)}/(${AIR.rho(K)}*1007))`; AIR.Pr = (K) => `(${AIR.mu(K)}*1007/${AIR.k(K)})`;
/** The efficiency of a straight fin : tanh(m Hc) / (m Hc), m = √(2 h / (k t)). h, k, t, Hc : formulas (SI). */
export const finEta = (h, k, t, Hc) => { const x = `(SQRT(2*${h}/(${k}*${t}))*${Hc})`; return `IF(${x}>0.000000001,TANH(${x})/${x},1)`; };

/** A bisection as a table : the root of an increasing function between lo and hi, one row per step — what bisect() of the models does.
    key : the name of the unknown ; cols : [{ key, label, f(x) }] the cells of a row computed from the middle x (a formula), each may read the ones
    before it as {s:<key>_<col>_<step>} through at(col) ; the LAST column is the function whose sign decides.
    → { grid, root : the formula of the root } */
export function bisection(key, label, lo, hi, steps, cols) {
  const c = (name, k) => `${key}_${name}_${k}`, rows = [];
  for (let k = 1; k <= steps + 1; k++) { const prev = `{s:${c(cols[cols.length - 1].key, k - 1)}}`, x = `{s:${c("mid", k)}}`, at = (name) => `{s:${c(name, k)}}`;
    rows.push([k, { key: c("lo", k), f: k === 1 ? xn(lo) : `IF(${prev}>0,{s:${c("lo", k - 1)}},{s:${c("mid", k - 1)}})` }, { key: c("hi", k), f: k === 1 ? xn(hi) : `IF(${prev}>0,{s:${c("mid", k - 1)}},{s:${c("hi", k - 1)}})` },
      { key: c("mid", k), f: `({s:${c("lo", k)}}+{s:${c("hi", k)}})/2` }, ...(k <= steps ? cols.map((q) => ({ key: c(q.key, k), f: q.f(x, at) })) : [])]); }
  return { root: `{s:${c("mid", steps + 1)}}`, grid: { title: `Résolution par dichotomie — ${label}`, note: `La plateforme cherche ${label} par dichotomie : à chaque ligne l'intervalle est coupé en deux, du côté où le bilan change de signe. ${steps} pas suffisent ici ; la dernière ligne donne la valeur gardée. Un tableur n'a pas de solveur dans ses formules : ce tableau en tient lieu, et il suit les cases jaunes.`,
    head: ["Pas", "Borne basse", "Borne haute", "Milieu", ...cols.map((q) => q.label)], rows } };
}
/** A fixed number of substitutions : x ← g(x), from a first value — what a model does when it loops a few times. cols : [{ key, label, f(prev, at) }],
    prev : the formula of the unknown at the step before ; the LAST column is the unknown. → { grid, last(col) : the formula of a cell of the last row } */
export function substitutions(key, label, first, steps, cols) {
  const c = (name, k) => `${key}_${name}_${k}`, rows = [];
  for (let k = 1; k <= steps; k++) { const prev = k === 1 ? xn(first) : `{s:${c(cols[cols.length - 1].key, k - 1)}}`, at = (name) => `{s:${c(name, k)}}`; rows.push([k, ...cols.map((q) => ({ key: c(q.key, k), f: q.f(prev, at) }))]); }
  return { last: (name) => `{s:${c(name, steps)}}`, grid: { title: `Résolution par substitutions — ${label}`, note: `La plateforme part de ${String(first).replace(".", ",")} et recalcule ${label} ${steps} fois de suite, chaque ligne avec le résultat de la précédente : la dernière ligne donne les valeurs gardées. Ce tableau suit les cases jaunes.`,
    head: ["Passe", ...cols.map((q) => q.label)], rows } };
}
