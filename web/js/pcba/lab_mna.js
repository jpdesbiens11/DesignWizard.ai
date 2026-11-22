/* DynamiteOrbit — the electronics lab : a small circuit solver (demande de JP : « un laboratoire d'électronique virtuel pour
   pré-tester les cartes… voir les fonctions de transfert… un module de simulation électronique pour préparer et anticiper
   les résultats en lab »). Modified nodal analysis, the method of every circuit simulator : one unknown per node voltage, one
   per current of a voltage source, an inductor or a controlled source ; Kirchhoff's current law at each node.
     circuit = { els: [element, …] } ; the node named "0" (or "GND") is the reference.
     R  { t:"R", id, a, b, r }                 C  { t:"C", id, a, b, c, v0 }          L  { t:"L", id, a, b, l, i0 }
     V  { t:"V", id, a, b, v: volts | wave }   I  { t:"I", id, a, b, i: amps | wave } (the current goes from a to b inside the source)
     D  { t:"D", id, a, k, vf, at }            a diode that drops vf volts at `at` amps (0,7 V at 10 mA ; an LED 2 V…)
     E  { t:"E", id, a, b, p, n, gain }        v(a) − v(b) = gain · (v(p) − v(n))
     OP { t:"OP", id, o, p, n, lo, hi, gain, gbw }   an amplifier : its output follows gain · (v+ − v−) between its two rails
     BV { t:"BV", id, a, b, f(prev, t) }       a source whose value is worked out from the state one step before (a regulator, a
                                                comparator with its hysteresis, a driver) — what an integrated circuit does, seen from outside
     BI { t:"BI", id, a, b, f(prev, t) }       the same for a current (what a chopper takes from its input)
     SW { t:"SW", id, a, b, on(prev, t), ron, roff }   a switch : closed or open, decided from the state one step before
   Three analyses : the operating point (dcOp), what happens in time (transient — backward Euler, the robust one, Newton at each
   step for the diodes and the amplifiers) and the answer in frequency (acSweep — the transfer function, small signal).
   Pure : no DOM. Everything in SI : volts, amperes, ohms, farads, henries, seconds, hertz. */

const GND = new Set(["0", "GND", "gnd"]), VT = 0.02585;
/** A signal in time. w : a number (constant) or { kind: "dc" | "sine" | "square" | "pulse" | "step" | "ramp" | "pwl", … } */
export function waveAt(w, t) {
  if (typeof w === "number") return w; if (!w) return 0;
  const off = w.offset || 0, amp = w.amp ?? 1, f = w.freq || 1, ph = ((w.phase || 0) * Math.PI) / 180, T = 1 / f, x = (((t - (w.delay || 0)) % T) + T) % T;
  switch (w.kind) {
    case "dc": return w.value ?? off;
    case "sine": return t < (w.delay || 0) ? off : off + amp * Math.sin(2 * Math.PI * f * (t - (w.delay || 0)) + ph);
    case "square": return t < (w.delay || 0) ? (w.low ?? off - amp) : x < T * (w.duty ?? 0.5) ? (w.high ?? off + amp) : (w.low ?? off - amp);
    case "pulse": return t >= (w.delay || 0) && t < (w.delay || 0) + (w.width ?? T / 2) ? (w.high ?? amp) : (w.low ?? 0);
    case "step": { const r = w.rise || 0, d = w.delay || 0; return t <= d ? (w.low ?? 0) : r > 0 && t < d + r ? (w.low ?? 0) + (((w.high ?? amp) - (w.low ?? 0)) * (t - d)) / r : (w.high ?? amp); }
    case "ramp": { const a = w.from ?? 0, b = w.to ?? 1, d = w.delay || 0, len = w.time || 1; return t <= d ? a : t >= d + len ? b : a + ((b - a) * (t - d)) / len; }
    case "pwl": { const p = w.points || []; if (!p.length) return 0; if (t <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (t <= p[i][0]) return p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (t - p[i - 1][0])) / (p[i][0] - p[i - 1][0] || 1e-30); return p[p.length - 1][1]; }
    default: return off;
  }
}

/* the unknowns of a circuit : its nodes (but the reference), then one current per element that needs one */
function layout(c) {
  const node = new Map(), branch = new Map(), at = (n) => { n = String(n); if (GND.has(n)) return -1; if (!node.has(n)) node.set(n, node.size); return node.get(n); };
  for (const e of c.els) for (const k of ["a", "b", "k", "o", "p", "n"]) if (e[k] !== undefined) at(e[k]);
  let m = node.size; for (const e of c.els) if (["V", "L", "E", "OP", "BV"].includes(e.t)) branch.set(e.id, m++);
  return { node, branch, n: m, at };
}
function solve(A, z, n) {                                              // Gauss with pivoting, in place ; null when the circuit has no single answer
  for (let k = 0; k < n; k++) {
    let p = k, big = Math.abs(A[k * n + k]); for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > big) { big = v; p = i; } }
    if (big < 1e-18) return null;
    if (p !== k) { for (let j = k; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; } const t = z[k]; z[k] = z[p]; z[p] = t; }
    for (let i = k + 1; i < n; i++) { const f = A[i * n + k] / A[k * n + k]; if (!f) continue; for (let j = k; j < n; j++) A[i * n + j] -= f * A[k * n + j]; z[i] -= f * z[k]; }
  }
  for (let k = n - 1; k >= 0; k--) { let s = z[k]; for (let j = k + 1; j < n; j++) s -= A[k * n + j] * z[j]; z[k] = s / A[k * n + k]; }
  return z;
}
/* a switch : closed, open — or closed for a share of the step (a number between 0 and 1), when its edge falls inside the step : the step then sees
   it as it was on average, and the timing of a chopper is not rounded to the step */
const swG = (e) => { const s = e.state === true ? 1 : e.state ? Math.max(0, Math.min(1, +e.state)) : 0; return s / (e.ron || 0.05) + (1 - s) / (e.roff || 1e9); };
const diodeIs = (e) => (e.at || 0.01) / (Math.exp((e.vf || 0.7) / ((e.nf || 2) * VT)) - 1);
/* one linear system : the circuit at time t, around the guess x, the reactive parts seen through the step h (h = 0 : the operating point) */
function stamp(c, L, x, prev, t, h, A, z) {
  const n = L.n, G = (i, j, g) => { if (i >= 0 && j >= 0) A[i * n + j] += g; }, cond = (a, b, g) => { G(a, a, g); G(b, b, g); G(a, b, -g); G(b, a, -g); }, src = (a, b, i) => { if (a >= 0) z[a] -= i; if (b >= 0) z[b] += i; }, v = (i) => (i >= 0 ? x[i] : 0);
  A.fill(0); z.fill(0); for (let i = 0; i < L.node.size; i++) A[i * n + i] = 1e-12;      // a whisper of conductance from every node to the reference : a pin left in the air does not stop the solver
  for (const e of c.els) {
    const a = e.a !== undefined ? L.at(e.a) : -1, b = e.b !== undefined ? L.at(e.b) : -1, k = L.branch.get(e.id);
    if (e.t === "R") cond(a, b, 1 / Math.max(e.r, 1e-9));
    else if (e.t === "SW") cond(a, b, swG(e));
    else if (e.t === "C") { if (h > 0) { const g = e.c / h, vp = prev ? (a >= 0 ? prev[a] : 0) - (b >= 0 ? prev[b] : 0) : e.v0 || 0; cond(a, b, g); src(a, b, -g * vp); } else cond(a, b, 1e-12); }
    else if (e.t === "L") { G(a, k, 1); G(b, k, -1); G(k, a, 1); G(k, b, -1); if (h > 0) { A[k * n + k] -= e.l / h; z[k] = -(e.l / h) * (prev ? prev[k] : e.i0 || 0); } else A[k * n + k] -= 1e-6; }
    else if (e.t === "V" || e.t === "BV") { G(a, k, 1); G(b, k, -1); G(k, a, 1); G(k, b, -1); z[k] = e.t === "V" ? waveAt(e.v, t) : e.value || 0; if (e.rs) A[k * n + k] -= e.rs; }
    else if (e.t === "I") src(a, b, waveAt(e.i, t)); else if (e.t === "BI") src(a, b, e.value || 0);
    else if (e.t === "E") { const p = L.at(e.p), q = L.at(e.n); G(a, k, 1); G(b, k, -1); G(k, a, 1); G(k, b, -1); G(k, p, -e.gain); G(k, q, e.gain); }
    else if (e.t === "D") { const ka = L.at(e.a), kk = L.at(e.k), nv = (e.nf || 2) * VT, is = diodeIs(e), vd = Math.min(v(ka) - v(kk), (e.vf || 0.7) + 0.6), ex = Math.exp(vd / nv), g = (is / nv) * ex + 1e-12, i = is * (ex - 1); cond(ka, kk, g); src(ka, kk, i - g * vd); }
    else if (e.t === "OP") { const o = L.at(e.o), p = L.at(e.p), q = L.at(e.n), lo = e.lo ?? 0, hi = e.hi ?? 5, mid = (lo + hi) / 2, half = (hi - lo) / 2, gain = e.gain || 1e5, vd = v(p) - v(q), u = (gain * vd) / half, th = Math.tanh(u), d = gain * (1 - th * th) + 1e-9;
      G(o, k, 1); G(k, o, 1); G(k, p, -d); G(k, q, d); z[k] = mid + half * th - d * vd; }
  }
}
function state(c, L, x) { const v = {}; for (const [name, i] of L.node) v[name] = x[i]; v["0"] = 0; return v; }
/* what is decided from one step to the next : the switches, and the sources that stand for an integrated circuit */
function decide(c, prevState, t) { for (const e of c.els) { if (e.t === "SW") { const s = e.on(prevState, t, e); e.state = typeof s === "number" ? s : !!s; } else if (e.t === "BV" || e.t === "BI") e.value = e.f(prevState, t, e); } }
/** The share of the time between t0 and t1 during which a chopper of frequency f is in the first part d of its cycle (0..1). */
export function pwmShare(t0, t1, f, d) { if (!(t1 > t0)) { const x = t1 * f; return x - Math.floor(x) < d ? 1 : 0; } const p0 = t0 * f - Math.floor(t0 * f), p1 = p0 + (t1 - t0) * f, over = (a, b) => Math.max(0, Math.min(p1, b) - Math.max(p0, a)); let on = 0; for (let n = 0; n <= Math.ceil(p1); n++) on += over(n, n + d); return Math.min(1, on / (p1 - p0)); }
function newton(c, L, x, prev, t, h) {
  const n = L.n, A = new Float64Array(n * n), z = new Float64Array(n), nl = c.els.some((e) => e.t === "D" || e.t === "OP");
  for (let it = 0; it < (nl ? 80 : 1); it++) {
    stamp(c, L, x, prev, t, h, A, z); const s = solve(A, z, n); if (!s) return false;
    let worst = 0; for (let i = 0; i < n; i++) { let d = s[i] - x[i]; if (nl && i < L.node.size && Math.abs(d) > 0.5) d = 0.5 * Math.sign(d); worst = Math.max(worst, Math.abs(d)); x[i] += d; }      // a step of a node is held back : a diode must not be thrown far
    if (worst < 1e-7) break;
  }
  return true;
}
/* the current through each element, from its a to its b (a diode : anode to cathode) */
function currents(c, L, x, prev, h, t) {
  const i = {}, v = (name) => { const k = L.at(name); return k >= 0 ? x[k] : 0; };
  for (const e of c.els) {
    if (e.t === "R") i[e.id] = (v(e.a) - v(e.b)) / Math.max(e.r, 1e-9); else if (e.t === "SW") i[e.id] = (v(e.a) - v(e.b)) * swG(e);
    else if (e.t === "C") i[e.id] = h > 0 && prev ? (e.c / h) * (v(e.a) - v(e.b) - ((L.at(e.a) >= 0 ? prev[L.at(e.a)] : 0) - (L.at(e.b) >= 0 ? prev[L.at(e.b)] : 0))) : 0;
    else if (e.t === "D") { const vd = Math.min(v(e.a) - v(e.k), (e.vf || 0.7) + 0.6); i[e.id] = diodeIs(e) * (Math.exp(vd / ((e.nf || 2) * VT)) - 1); }
    else if (e.t === "I") i[e.id] = waveAt(e.i, t); else if (e.t === "BI") i[e.id] = e.value || 0; else if (L.branch.has(e.id)) i[e.id] = e.t === "L" ? x[L.branch.get(e.id)] : -x[L.branch.get(e.id)];      // a source : the current it gives, out of its +
  }
  return i;
}
/** The operating point : every capacitor open, every inductor a wire, the sources as they are at t = 0. → { ok, v: { node: volts }, i: { id: amperes } } */
export function dcOp(circuit, t = 0) {
  const L = layout(circuit), x = new Float64Array(L.n); let st = { "0": 0 };
  for (let pass = 0; pass < 6; pass++) { decide(circuit, st, t); if (!newton(circuit, L, x, null, t, 0)) return { ok: false, v: {}, i: {} }; st = state(circuit, L, x); }      // a few turns : what is decided from the state settles
  return { ok: true, v: st, i: currents(circuit, L, x, null, 0, t) };
}
/** What happens in time. o : { tEnd, steps (2000), from : "op" (start from the operating point — the default) | "zero" }.
    → { ok, t: Float64Array, v: { node: Float64Array }, i: { id: Float64Array } } */
export function transient(circuit, o = {}) {
  const L = layout(circuit), N = Math.max(2, Math.round(o.steps || 2000)), h = (o.tEnd || 1e-3) / N, x = new Float64Array(L.n), out = { ok: true, t: new Float64Array(N + 1), v: {}, i: {} };
  for (const name of L.node.keys()) out.v[name] = new Float64Array(N + 1); out.v["0"] = new Float64Array(N + 1); for (const e of circuit.els) out.i[e.id] = new Float64Array(N + 1);
  let st = { "0": 0 };
  if (o.from !== "zero") { for (let pass = 0; pass < 6; pass++) { decide(circuit, st, 0); if (!newton(circuit, L, x, null, 0, 0)) { out.ok = false; return out; } st = state(circuit, L, x); } }
  else for (const e of circuit.els) if (e.t === "L" && e.i0) x[L.branch.get(e.id)] = e.i0;
  const keep = (k, t, prev) => { out.t[k] = t; for (const [name, i] of L.node) out.v[name][k] = x[i]; const cur = currents(circuit, L, x, prev, prev ? h : 0, t); for (const id in cur) out.i[id][k] = cur[id]; };
  keep(0, 0, null);
  for (let k = 1; k <= N; k++) { const t = k * h, prev = Float64Array.from(x); decide(circuit, st, t); if (!newton(circuit, L, x, prev, t, h)) { out.ok = false; break; } st = state(circuit, L, x); keep(k, t, prev); }
  return out;
}

/* ---------- the answer in frequency : the same circuit, small signal, complex numbers ---------- */
function csolve(Ar, Ai, zr, zi, n) {
  for (let k = 0; k < n; k++) {
    let p = k, big = Math.hypot(Ar[k * n + k], Ai[k * n + k]); for (let i = k + 1; i < n; i++) { const v = Math.hypot(Ar[i * n + k], Ai[i * n + k]); if (v > big) { big = v; p = i; } }
    if (big < 1e-20) return false;
    if (p !== k) { for (let j = 0; j < n; j++) { let t = Ar[k * n + j]; Ar[k * n + j] = Ar[p * n + j]; Ar[p * n + j] = t; t = Ai[k * n + j]; Ai[k * n + j] = Ai[p * n + j]; Ai[p * n + j] = t; } let t = zr[k]; zr[k] = zr[p]; zr[p] = t; t = zi[k]; zi[k] = zi[p]; zi[p] = t; }
    const dr = Ar[k * n + k], di = Ai[k * n + k], dd = dr * dr + di * di;
    for (let i = k + 1; i < n; i++) { const ar = Ar[i * n + k], ai = Ai[i * n + k]; if (!ar && !ai) continue; const fr = (ar * dr + ai * di) / dd, fi = (ai * dr - ar * di) / dd;
      for (let j = k; j < n; j++) { const br = Ar[k * n + j], bi = Ai[k * n + j]; Ar[i * n + j] -= fr * br - fi * bi; Ai[i * n + j] -= fr * bi + fi * br; } zr[i] -= fr * zr[k] - fi * zi[k]; zi[i] -= fr * zi[k] + fi * zr[k]; }
  }
  for (let k = n - 1; k >= 0; k--) { let sr = zr[k], si = zi[k]; for (let j = k + 1; j < n; j++) { sr -= Ar[k * n + j] * zr[j] - Ai[k * n + j] * zi[j]; si -= Ar[k * n + j] * zi[j] + Ai[k * n + j] * zr[j]; } const dr = Ar[k * n + k], di = Ai[k * n + k], dd = dr * dr + di * di; zr[k] = (sr * dr + si * di) / dd; zi[k] = (si * dr - sr * di) / dd; }
  return true;
}
/** The transfer function from a source to a node : v(out) / v(source), from fStart to fEnd. The diodes are taken at the operating point, an
    amplifier as its gain with its one pole (gbw). o : { source (id of a V), out (node), ref (node, "0"), fStart, fEnd, points }
    → { ok, f: [], gain: [] (a ratio), db: [], phase: [] (degrees) } */
export function acSweep(circuit, o) {
  const L = layout(circuit), n = L.n, op = dcOp(circuit), N = Math.max(2, o.points || 60), out = { ok: op.ok, f: [], gain: [], db: [], phase: [] }; if (!op.ok) return out;
  const vop = (name) => op.v[String(name)] || 0, iOut = L.at(o.out), iRef = o.ref !== undefined ? L.at(o.ref) : -1;
  for (let s = 0; s < N; s++) {
    const f = o.fStart * Math.pow(o.fEnd / o.fStart, s / (N - 1)), w = 2 * Math.PI * f, Ar = new Float64Array(n * n), Ai = new Float64Array(n * n), zr = new Float64Array(n), zi = new Float64Array(n);
    for (let i = 0; i < L.node.size; i++) Ar[i * n + i] = 1e-12;
    const G = (i, j, gr, gi = 0) => { if (i >= 0 && j >= 0) { Ar[i * n + j] += gr; Ai[i * n + j] += gi; } }, cond = (a, b, gr, gi = 0) => { G(a, a, gr, gi); G(b, b, gr, gi); G(a, b, -gr, -gi); G(b, a, -gr, -gi); };
    for (const e of circuit.els) {
      const a = e.a !== undefined ? L.at(e.a) : -1, b = e.b !== undefined ? L.at(e.b) : -1, k = L.branch.get(e.id);
      if (e.t === "R") cond(a, b, 1 / Math.max(e.r, 1e-9)); else if (e.t === "SW") cond(a, b, swG(e)); else if (e.t === "C") cond(a, b, 0, w * e.c);
      else if (e.t === "L") { G(a, k, 1); G(b, k, -1); G(k, a, 1); G(k, b, -1); Ai[k * n + k] -= w * e.l; }
      else if (e.t === "V" || e.t === "BV") { G(a, k, 1); G(b, k, -1); G(k, a, 1); G(k, b, -1); zr[k] = e.id === o.source ? 1 : 0; }
      else if (e.t === "E") { G(a, k, 1); G(b, k, -1); G(k, a, 1); G(k, b, -1); G(k, L.at(e.p), -e.gain); G(k, L.at(e.n), e.gain); }
      else if (e.t === "D") { const nv = (e.nf || 2) * VT, vd = Math.min(vop(e.a) - vop(e.k), (e.vf || 0.7) + 0.6); cond(L.at(e.a), L.at(e.k), (diodeIs(e) / nv) * Math.exp(vd / nv) + 1e-12); }
      else if (e.t === "OP") { const A0 = e.gain || 1e5, wp = (2 * Math.PI * (e.gbw || 1e6)) / A0, den = 1 + (w / wp) * (w / wp), gr = A0 / den, gi = (-A0 * (w / wp)) / den, oo = L.at(e.o), p = L.at(e.p), q = L.at(e.n); G(oo, k, 1); G(k, oo, 1); G(k, p, -gr, -gi); G(k, q, gr, gi); }
    }
    if (!csolve(Ar, Ai, zr, zi, n)) { out.ok = false; break; }
    const re = (iOut >= 0 ? zr[iOut] : 0) - (iRef >= 0 ? zr[iRef] : 0), im = (iOut >= 0 ? zi[iOut] : 0) - (iRef >= 0 ? zi[iRef] : 0), g = Math.hypot(re, im);
    out.f.push(f); out.gain.push(g); out.db.push(20 * Math.log10(Math.max(g, 1e-12))); out.phase.push((Math.atan2(im, re) * 180) / Math.PI);
  }
  return out;
}

/* ---------- what one reads on an instrument ---------- */
const part = (a, from = 0) => (from > 0 ? a.subarray(Math.floor(a.length * from)) : a);
/** What a signal measures over the last part of a run (from : 0..1, where to start) : { min, max, pp (peak to peak), mean, rms, ac (rms without its mean) }. */
export function measure(a, from = 0) { const s = part(a, from); let min = Infinity, max = -Infinity, sum = 0, sq = 0; for (const v of s) { if (v < min) min = v; if (v > max) max = v; sum += v; sq += v * v; } const mean = sum / s.length; return { min, max, pp: max - min, mean, rms: Math.sqrt(sq / s.length), ac: Math.sqrt(Math.max(0, sq / s.length - mean * mean)) }; }
/** The frequency of a signal (hertz ; 0 when it does not swing) : it is counted as a trigger counts it — a rise is one only once the signal
    has been down under 30 % of its swing and comes up past 70 %, so that a step on the way is not counted twice. */
export function frequency(t, a, from = 0) { const k0 = Math.floor(a.length * from), m = measure(a, from), lo = m.min + 0.3 * m.pp, hi = m.min + 0.7 * m.pp, x = []; if (m.pp < 1e-9) return 0; let armed = a[k0] < lo; for (let k = k0 + 1; k < a.length; k++) { if (a[k] < lo) armed = true; else if (armed && a[k] >= hi) { armed = false; x.push(t[k]); } } return x.length > 1 ? (x.length - 1) / (x[x.length - 1] - x[0]) : 0; }
/** The time a signal takes to go from 10 % to 90 % of its step (seconds), and where it ends. → { rise, final, t10, t90 } */
export function riseTime(t, a) { const v0 = a[0], v1 = a[a.length - 1], at = (q) => { const lv = v0 + (v1 - v0) * q; for (let k = 1; k < a.length; k++) if ((a[k - 1] - lv) * (a[k] - lv) <= 0 && a[k] !== a[k - 1]) return t[k - 1] + ((t[k] - t[k - 1]) * (lv - a[k - 1])) / (a[k] - a[k - 1]); return NaN; }, t10 = at(0.1), t90 = at(0.9); return { rise: t90 - t10, final: v1, t10, t90 }; }
/** The frequency where a transfer function has lost 3 dB from its level at the start of the sweep (hertz ; NaN when it never does). */
export function cutoff(ac) { const ref = ac.db[0] - 3.0103; for (let k = 1; k < ac.f.length; k++) if (ac.db[k] <= ref) { const u = (ref - ac.db[k - 1]) / (ac.db[k] - ac.db[k - 1]); return ac.f[k - 1] * Math.pow(ac.f[k] / ac.f[k - 1], u); } return NaN; }
/** The gain of a transfer function at a frequency (a ratio), read between its points. */
export function gainAt(ac, f) { for (let k = 1; k < ac.f.length; k++) if (f <= ac.f[k]) { const u = Math.log(f / ac.f[k - 1]) / Math.log(ac.f[k] / ac.f[k - 1]); return Math.pow(10, (ac.db[k - 1] + (ac.db[k] - ac.db[k - 1]) * Math.max(0, Math.min(1, u))) / 20); } return ac.gain[ac.gain.length - 1]; }
