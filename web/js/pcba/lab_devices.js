/* DesignOrbit.ai — the electronics lab : what each component of a board IS, for the solver (pcba/lab_mna.js). A function block
   (pcba/blocks.js) gives its real little circuit — its parts, their values, the nets that join their pins : the passives go
   in as they are, and each integrated circuit is replaced by WHAT IT DOES SEEN FROM OUTSIDE (a regulator holds its output, a
   comparator pulls its output down, a driver follows its input, a memory answers on its bus). These are behaviours with
   TYPICAL values — thresholds, drops, resistances — not the model of a given reference : the datasheet of the part chosen
   has the last word, and the test plan says so. Pure : no DOM. SI inside. */

import { pwmShare } from "./lab_mna.js";

const fx = (x, d) => (+x).toFixed(d).replace(".", ",").replace("-", "−");      // a number as the screens write it

const UNIT = { "Ω": 1, R: 1, F: 1, H: 1, V: 1, A: 1, Hz: 1, W: 1 }, PRE = { p: 1e-12, n: 1e-9, "µ": 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
/** A value as it is written on a part : « 10 kΩ 1 % », « 100 nF », « 4,7 µH », « 5,1 V ». → { v (SI), unit } or null */
export function parseValue(text) {
  const m = /(-?\d+(?:[.,]\d+)?)\s*([pnµumkMG]?)\s*(Ω|ohm|R|F|H|V|A|Hz|W)(?![a-zA-Z])/.exec(String(text || "")); if (!m) return null;
  const unit = m[3] === "ohm" || m[3] === "R" ? "Ω" : m[3]; return { v: Number(m[1].replace(",", ".")) * (PRE[m[2]] || 1), unit };
}
export const siValue = (text, unit) => { const p = parseValue(text); return p && (!unit || p.unit === unit) ? p.v : null; };
/** What a component of the library is, for the lab : "R", "C", "L", "NTC", "LED", "D", "Z", "NMOS", "PMOS", "U:LDO"… or "" (a connector, a test point : nothing to solve). */
export function family(comp) {
  const c = String(comp || "");
  if (/^R-/.test(c)) return "R"; if (/^(C|CE)-/.test(c)) return "C"; if (/^L-CMC/.test(c)) return ""; if (/^L-/.test(c)) return "L"; if (/^NTC-/.test(c)) return "NTC"; if (/^LED-/.test(c)) return "LED";
  if (/^D-(ZEN|TVS-SM)/.test(c)) return "Z"; if (/^D-(SCH|SIG)/.test(c)) return "D"; if (/^Q-NMOS2/.test(c)) return "NMOS2"; if (/^Q-NMOS/.test(c)) return "NMOS"; if (/^Q-PMOS/.test(c)) return "PMOS";
  if (/^K-RELAY/.test(c)) return "RELAY"; if (/^SW-/.test(c)) return "BUTTON"; if (/^BZ-/.test(c)) return "BUZZER"; if (/^BAT-/.test(c)) return "BAT"; if (/^F-/.test(c)) return "FUSE"; if (/^FB-/.test(c)) return "BEAD";
  const u = /^U-([A-Z0-9]+)/.exec(c); return u && !/^ESD/.test(u[1]) ? `U:${u[1]}` : "";
}
const LED_VF = { rouge: 1.9, verte: 2.1, jaune: 2.0, orange: 2.0, bleue: 3.0, blanche: 3.0 };
/* the resistance of an NTC at a temperature (°C) : the usual law with its constant B */
export const ntcOhms = (r25, B, T) => r25 * Math.exp(B * (1 / (T + 273.15) - 1 / 298.15));

/* ---------- a bus that a memory or a sensor listens to : I²C, decoded edge after edge ---------- */
function i2cEar(addr) {
  const m = { scl: 1, sda: 1, live: false, n: 0, byte: 0, got: [], ack: false, mine: false, done: null };
  return (scl, sda, t) => {
    if (m.scl && scl) { if (m.sda && !sda) { m.live = true; m.n = 0; m.byte = 0; m.got = []; m.ack = false; m.mine = false; } else if (!m.sda && sda && m.live) { m.live = false; m.ack = false; if (m.mine) m.done = { t, bytes: m.got.slice(1) }; } }
    if (m.live) {
      if (!m.scl && scl) { if (m.n < 8) { m.byte = ((m.byte << 1) | sda) & 255; m.n++; } else { m.n = 0; m.byte = 0; } }                         // a rising clock : a bit is read
      if (m.scl && !scl) { if (m.n === 8) { if (!m.got.length) m.mine = (m.byte >> 1) === addr; m.ack = m.mine; if (m.mine) m.got.push(m.byte); } else m.ack = false; }      // a falling clock : the ninth bit is the answer
    }
    m.scl = scl; m.sda = sda; return m;
  };
}
/** What a master puts on an I²C bus to write bytes to an address : a schedule (t) → { scl, sda } (1 : released, 0 : held low). fbit : bits a second. */
export function i2cWrite(addr, bytes, fbit = 100e3, t0 = 0) {
  const T = 1 / fbit, all = [(addr << 1) & 254, ...bytes], bits = []; for (const b of all) { for (let k = 7; k >= 0; k--) bits.push((b >> k) & 1); bits.push(1); }      // the ninth bit is left to the one who answers
  const end = t0 + T * (bits.length + 2.5);
  return { end, bits: bits.length, at(t) { const x = (t - t0) / T; if (x < 0.5) return { scl: 1, sda: 1 }; if (x < 1) return { scl: 1, sda: 0 }; const k = Math.floor(x - 1), u = x - 1 - k;
    if (k < bits.length) return { scl: u >= 0.5 ? 1 : 0, sda: bits[k] }; const v = x - 1 - bits.length; return v < 0.5 ? { scl: 0, sda: 0 } : v < 1 ? { scl: 1, sda: 0 } : { scl: 1, sda: 1 }; } };
}
/** A byte on a serial line (start bit, eight bits least significant first, stop bit) : (t) → 1 or 0. */
export function uartFrame(bytes, baud = 115200, t0 = 0) { const T = 1 / baud, bits = []; for (const b of bytes) { bits.push(0); for (let k = 0; k < 8; k++) bits.push((b >> k) & 1); bits.push(1, 1); } return { end: t0 + bits.length * T, at: (t) => { const k = Math.floor((t - t0) / T); return k < 0 || k >= bits.length ? 1 : bits[k]; } }; }

/** The circuit of a block, ready for the solver.
    built : what a template builds { parts, nets, ports } ; tpl : its id ; P : its parameters ;
    o : { temp (°C, 25), press(t) (a button : pressed or not), ground (the name of the net that is the reference, "GND") }
    → { els, node(pin) → the node of « U.OUT », nets: { name: node }, states: [{ part, kind, label, at(v, i, k) → { on, text } }], notes: [what was assumed] } */
export function blockCircuit(built, tpl, P = {}, o = {}) {
  const els = [], states = [], notes = [], T = o.temp ?? 25, net = new Map(), nets = {};
  const gp = Object.values(built.ports || {}).find((q) => q.dir === "gnd" && q.suggest === "GND"), ground = o.ground || (gp ? gp.net : "GND");      // the reference : the net the block gives to the ground of the board
  for (const n of built.nets) { const node = n.name === ground ? "0" : n.name; nets[n.name] = node; for (const p of n.pins) net.set(p, node); }
  let loose = 0; const node = (pin) => { if (!net.has(pin)) { const f = `nc${++loose}`; net.set(pin, f); els.push({ t: "R", id: `_${f}`, a: f, b: "0", r: 1e9 }); } return net.get(pin); };
  const calc = (re) => { const c = (built.calc || []).find((x) => re.test(x.label)); return c ? Number(c.value) * ({ m: 1e-3, "µ": 1e-6, k: 1e3 }[String(c.unit)[0]] && String(c.unit).length > 1 ? { m: 1e-3, "µ": 1e-6, k: 1e3 }[String(c.unit)[0]] : 1) : null; };
  /* the reference a regulator holds on its feedback pin : read off the two resistors of its divider */
  const fbRef = (fbNode, outNode, vout) => { let top = null, bot = null; for (const e of els) if (e.t === "R") { const other = e.a === fbNode ? e.b : e.b === fbNode ? e.a : null; if (other === outNode) top = e.r; else if (other === "0") bot = e.r; } return top && bot ? (vout * bot) / (top + bot) : null; };
  const say = (part, kind, label, at) => states.push({ part, kind, label, at });
  const pwm = (t, f) => { const x = t * f; return x - Math.floor(x); };
  const isolate = (g) => { if (g !== "0" && !els.some((e) => e.id === `_iso_${g}`)) els.push({ t: "R", id: `_iso_${g}`, a: g, b: "0", r: 1e7 }); };
  const idle = (id, v, g, amps, volts) => els.push({ t: "R", id: `${id}:q`, a: v, b: g, r: volts / amps });      // what a circuit draws at rest (typical)
  for (const part of built.parts) {
    const id = part.id, F = family(part.comp), pin = (n) => node(`${id}.${n}`), val = part.value || "", plus = net.has(`${id}.+`) || net.has(`${id}.-`);      // a polarised capacitor names its pins + and −
    if (F === "R") els.push({ t: "R", id, a: pin("1"), b: pin("2"), r: siValue(val, "Ω") ?? 1e3 });
    else if (F === "C") els.push({ t: "C", id, a: pin(plus ? "+" : "1"), b: pin(plus ? "-" : "2"), c: siValue(val, "F") ?? 1e-7 });
    else if (F === "L") els.push({ t: "L", id, a: pin("1"), b: pin("2"), l: siValue(val, "H") ?? 1e-5 });
    else if (F === "FUSE") els.push({ t: "R", id, a: pin("1"), b: pin("2"), r: 0.03 });
    else if (F === "BEAD") els.push({ t: "R", id, a: pin("1"), b: pin("2"), r: 0.2 });
    else if (F === "NTC") { const r25 = siValue(val, "Ω") ?? 1e4, B = Number((/B\s*(\d{4})/.exec(val) || [0, 3950])[1]); els.push({ t: "R", id, a: pin("1"), b: pin("2"), r: ntcOhms(r25, B, T) }); say(id, "sensor", "Température lue", () => ({ on: true, text: `${T} °C → ${Math.round(ntcOhms(r25, B, T))} Ω` })); }
    else if (F === "LED") { const color = Object.keys(LED_VF).find((c) => val.toLowerCase().includes(c)) || P.color || "verte"; els.push({ t: "D", id, a: pin("A"), k: pin("K"), vf: LED_VF[color] || 2, at: 0.005 }); say(id, "led", "Témoin", (v, i, k) => ({ on: i[id][k] > 3e-4, text: `${fx((i[id][k] * 1e3), 1)} mA`, color })); }
    else if (F === "D") els.push({ t: "D", id, a: pin("A"), k: pin("K"), vf: /SCH/.test(part.comp) ? 0.35 : 0.65, at: /SCH/.test(part.comp) ? 0.1 : 0.01 });
    else if (F === "Z") { const vz = siValue(val, "V") ?? (/TVS/.test(part.comp) ? (P.v || 24) * 1.3 : 5.1), mid = `${id}_z`; els.push({ t: "D", id, a: pin("A"), k: pin("K"), vf: 0.7, at: 0.01 }, { t: "D", id: `${id}:r`, a: pin("K"), k: mid, vf: 0.7, at: 0.01 }, { t: "V", id: `${id}:v`, a: mid, b: pin("A"), v: Math.max(0.1, vz - 0.7) }); say(id, "clamp", "Écrêtage", (v, i, k) => ({ on: i[`${id}:r`][k] > 1e-3, text: `${vz} V` })); }
    else if (F === "NMOS" || F === "PMOS") { const D = pin("D"), S = pin("S"), G = pin("G"), n = F === "NMOS"; els.push({ t: "SW", id, a: D, b: S, ron: 0.05, roff: 1e8, on: (s) => (n ? (s[G] || 0) - (s[S] || 0) > 2 : (s[S] || 0) - (s[G] || 0) > 2) }, { t: "D", id: `${id}:b`, a: n ? S : D, k: n ? D : S, vf: 0.8, at: 1 }); say(id, "switch", "Transistor", (v, i, k) => ({ on: Math.abs(i[id][k]) > 1e-3, text: `${fx(Math.abs(i[id][k]), 2)} A` })); }
    else if (F === "NMOS2") for (const q of ["1", "2"]) { const D = pin(`D${q}`), S = pin(`S${q}`), G = pin(`G${q}`); els.push({ t: "SW", id: `${id}:${q}`, a: D, b: S, ron: 5, roff: 1e8, on: (s) => (s[G] || 0) - (s[S] || 0) > 1.2 }, { t: "D", id: `${id}:b${q}`, a: S, k: D, vf: 0.7, at: 0.05 }); }
    else if (F === "RELAY") { const vc = P.vcoil || 12, inom = calc(/bobine/i) || vc / 360, r = vc / inom, mid = `${id}_c`, A1 = pin("A1"), A2 = pin("A2"); els.push({ t: "R", id, a: A1, b: mid, r }, { t: "L", id: `${id}:l`, a: mid, b: A2, l: r * 4e-4 });
      const pulled = (s) => Math.abs((s[A1] || 0) - (s[mid] || 0)) / r > 0.7 * inom; els.push({ t: "SW", id: `${id}:no`, a: pin("COM"), b: pin("NO"), ron: 0.03, roff: 1e9, on: pulled }, { t: "SW", id: `${id}:nc`, a: pin("COM"), b: pin("NC"), ron: 0.03, roff: 1e9, on: (s) => !pulled(s) });
      say(id, "relay", "Relais", (v, i, k) => ({ on: Math.abs(i[id][k]) > 0.7 * inom, text: Math.abs(i[id][k]) > 0.7 * inom ? "collé (COM–NO)" : "relâché (COM–NC)" })); }
    else if (F === "BUTTON") { const press = o.press || (() => false); els.push({ t: "SW", id, a: pin("A"), b: pin("B"), ron: 0.1, roff: 1e9, on: (s, t) => !!press(t) }); say(id, "button", "Bouton", (v, i, k, t) => ({ on: !!press(t), text: press(t) ? "appuyé" : "relâché" })); }
    else if (F === "BUZZER") { els.push({ t: "R", id, a: pin("+"), b: pin("-"), r: 150 }); say(id, "sound", "Avertisseur", (v, i, k) => ({ on: Math.abs(i[id][k]) > 5e-3, text: Math.abs(i[id][k]) > 5e-3 ? "sonne" : "muet" })); }
    else if (F === "BAT") els.push({ t: "V", id, a: pin("+"), b: pin("-"), v: 3, rs: 10 });
    else if (F.startsWith("U:")) devices[F.slice(2)] ? devices[F.slice(2)]({ id, pin, P, tpl, els, say, notes, pwm, fbRef, calc, isolate, idle, T, o, built, wired: (n) => net.has(`${id}.${n}`) }) : notes.push(`${id} (${part.comp}) : pas de comportement dans le laboratoire — ce circuit est laissé ouvert.`);
  }
  return { els, node, nets, states, notes };
}

/* the loop of a switching regulator : the share of the time its switch is closed */
function loop(d0) { const m = { d: 0, di: d0, d0, t: 0, ref: null, on: null, live: false, high: false, trip: -1 };
  m.off = (t) => { m.t = t; m.on = null; m.di = m.d0; m.d = 0; m.live = false; return 0; };
  /* it starts from the share its two voltages call for, raised gently ; once up, a slow integrator trims what the losses took */
  /* ff : the share the voltages of this instant call for (a regulator follows its input at once, as a real one does) — the integrator then only trims ;
     it does not wind up while the share is held at its limit */
  m.step = (t, ref, fb, max, ff) => { if (m.on === null) { m.on = t; m.di = m.d0; } m.live = true; const h = Math.max(0, t - m.t), soft = Math.min(1, (t - m.on) / 5e-4), base = ff ?? m.d0, err = ref - fb, want = base + (m.di - m.d0), held = (want >= max && err > 0) || (want <= 0 && err < 0); m.t = t;
    if (soft >= 1 && h > 0 && h < 1e-4 && !held) m.di = Math.max(0, Math.min(max, m.di + 500 * err * h)); m.d = Math.max(0, Math.min(max, soft * (base + (m.di - m.d0)))); return m.d; };
  return m; }
/* what each integrated circuit does, seen from its pins — typical values */
const devices = {
  LDO({ id, pin, P, els, say, notes }) { const VIN = pin("VIN"), VOUT = pin("VOUT"), G = pin("GND"), vset = P.vout ?? 3.3; els.push({ t: "BV", id, a: VIN, b: VOUT, rs: 0.15, f: (s) => Math.max(0.3, (s[VIN] || 0) - (s[G] || 0) - vset) }, { t: "R", id: `${id}:q`, a: VIN, b: G, r: 2500 });
    notes.push(`${id} : régulateur linéaire tenu pour une chute minimale de 0,3 V et 2 mA de consommation propre (typiques).`); say(id, "reg", "Régulation", (v, i, k) => ({ on: Math.abs(v[VOUT][k] - (v[G] ? v[G][k] : 0) - vset) < 0.05 * vset, text: `${fx((v[VOUT][k]), 2)} V` })); },
  REF({ id, pin, P, els, say }) { const VIN = pin("VIN"), VOUT = pin("VOUT"), G = pin("GND"), vset = P.vout ?? 2.5; els.push({ t: "BV", id, a: VIN, b: VOUT, rs: 0.5, f: (s) => Math.max(0.2, (s[VIN] || 0) - (s[G] || 0) - vset) }, { t: "R", id: `${id}:q`, a: VIN, b: G, r: 5e4 }); say(id, "reg", "Référence", (v, i, k) => ({ on: Math.abs(v[VOUT][k] - vset) < 0.01 * vset, text: `${fx(v[VOUT][k], 3)} V` })); },
  /* a switching regulator : a switch chopped at its frequency, whose share of the time follows the feedback pin — with what a real one has to survive its own
     start : it waits for its input, raises its target gently, and lets go for the rest of the cycle when the current runs too high */
  BUCK({ id, pin, P, els, say, notes, pwm, calc }) { const VIN = pin("VIN"), SW = pin("SW"), FB = pin("FB"), G = pin("GND"), vout = P.vout ?? 5, vin = P.vin ?? 24, L = calc(/^Inductance/) || 33e-6, f = Math.min(2e6, Math.max(1e5, (vout * (1 - vout / vin)) / (L * Math.max(0.05, ((P.ripple || 30) / 100) * (P.iout || 1))))), ilim = 2.5 * (P.iout || 1) + 0.5, m = loop(vout / vin), uvlo = Math.min(0.6 * vin, 4.5);      // it runs above a typical under-voltage lockout ; below its output over its largest duty, it follows its input
    const ref = () => { if (m.ref === null) { let top = null, bot = null; for (const e of els) if (e.t === "R") { const o2 = e.a === FB ? e.b : e.b === FB ? e.a : null; if (o2 === "0" || o2 === G) bot = e.r; else if (o2) top = e.r; } m.ref = top && bot ? (vout * bot) / (top + bot) : 0.8; } return m.ref; };
    /* the two switches of a buck, seen over one step : the switching node is at the input for the share of the step the top one is closed, at the reference
       for the rest ; and the input gives the current of the inductance for that same share */
    const share = (s, t) => { const vi = (s[VIN] || 0) - (s[G] || 0), on = vi > uvlo, t0 = m.t, d = on ? m.step(t, ref(), (s[FB] || 0) - (s[G] || 0), 0.9, Math.min(0.9, vout / Math.max(vi, vout))) : m.off(t); m.il = ((m.vsw || 0) - ((s[SW] || 0) - (s[G] || 0))) / 0.11; m.high = on && m.il < ilim ? pwmShare(t0, t, f, d) : 0; m.vsw = m.high * ((s[VIN] || 0) - (s[G] || 0)); return m.vsw; };
    els.push({ t: "BV", id, a: SW, b: G, rs: 0.11, f: share }, { t: "BI", id: `${id}:in`, a: VIN, b: G, f: () => m.high * Math.max(0, m.il || 0) }, { t: "R", id: `${id}:q`, a: VIN, b: G, r: vin / 0.002 });
    notes.push(`${id} : découpage à ${Math.round(f / 1e3)} kHz déduit de l'inductance et de l'ondulation visée ; démarrage progressif en 0,5 ms, mise en marche au-dessus de ${fx(uvlo, 1)} V à l'entrée, rapport cyclique de 90 % au plus et limite de courant à ${fx(ilim, 1)} A (typiques).`); say(id, "switching", "Découpage", (v, i, k) => ({ on: v[SW][k] > 0.5 * vin, text: `${Math.round(f / 1e3)} kHz · α ≈ ${fx((m.d * 100), 0)} %` })); },
  BOOST({ id, pin, P, els, say, notes, pwm, calc }) { const VIN = pin("VIN"), SW = pin("SW"), FB = pin("FB"), G = pin("GND"), vout = P.vout ?? 12, vin = P.vin ?? 5, L = calc(/^Inductance/) || 15e-6, f = 4e5, ilim = 3 * ((calc(/Courant dans l'inductance/) || 0.8)) + 0.5, m = loop(1 - vin / vout);
    const ref = () => { if (m.ref === null) { let top = null, bot = null; for (const e of els) if (e.t === "R") { const o2 = e.a === FB ? e.b : e.b === FB ? e.a : null; if (o2 === "0" || o2 === G) bot = e.r; else if (o2) top = e.r; } m.ref = top && bot ? (vout * bot) / (top + bot) : 1.25; } return m.ref; };
    els.push({ t: "SW", id, a: SW, b: G, ron: 0.15, roff: 1e8, on: (s, t) => { const on = (s[VIN] || 0) - (s[G] || 0) > 0.6 * vin, h = t - m.t, d = on ? m.step(t, ref(), (s[FB] || 0) - (s[G] || 0), 0.85) : m.off(t), n = Math.floor(t * f + 1e-9);
      /* each cycle is closed for a whole number of steps ; what the rounding took is given back to the next cycle, so that the share is right on average */
      if (n !== m.cycle) { m.cycle = n; const N = Math.max(4, Math.round(1 / (f * Math.max(h, 1e-12)))), want = d * N + (m.carry || 0); m.steps = Math.round(want); m.carry = want - m.steps; m.k = 0; } m.k++;
      if (((s[SW] || 0) - (s[G] || 0)) / 0.15 > ilim && m.high) m.trip = n; m.high = on && m.trip !== n && m.k <= m.steps; return m.high; } }, { t: "R", id: `${id}:q`, a: VIN, b: G, r: vin / 0.002 });
    notes.push(`${id} : découpage à ${f / 1e3} kHz, démarrage progressif et limite de courant à ${fx(ilim, 1)} A (typiques) ; inductance de ${fx((L * 1e6), 0)} µH lue sur la carte.`); say(id, "switching", "Découpage", (v, i, k) => ({ on: v[SW][k] < 1, text: `${f / 1e3} kHz · α ≈ ${fx((m.d * 100), 0)} %` })); },
  DCDC({ id, pin, P, els, say, isolate }) { const VIN = pin("VIN"), G1 = pin("GND1"), VO = pin("VOUT"), G2 = pin("GND2"), vin = P.vin ?? 5, vout = P.vout ?? 5; isolate(G2); els.push({ t: "BV", id, a: VO, b: G2, rs: 2, f: (s) => ((s[VIN] || 0) - (s[G1] || 0) > 0.8 * vin ? vout : 0) }, { t: "R", id: `${id}:q`, a: VIN, b: G1, r: vin / 0.03 }); say(id, "reg", "Sortie isolée", (v, i, k) => ({ on: v[VO][k] - v[G2][k] > 0.9 * vout, text: `${fx((v[VO][k] - v[G2][k]), 2)} V, isolés` })); },
  SUP({ id, pin, P, els, say, notes }) { const VCC = pin("VCC"), G = pin("GND"), R = pin("RESET_N"), vth = P.vth ?? 2.93, m = { ok: null }, hold = 0.02; els.push({ t: "BV", id, a: R, b: G, rs: 200, f: (s, t) => { const v = (s[VCC] || 0) - (s[G] || 0); if (v < vth) m.ok = null; else if (m.ok === null) m.ok = t; return m.ok !== null && t - m.ok >= hold ? v : 0; } });
    notes.push(`${id} : la remise à zéro est relâchée ${hold * 1e3} ms après le franchissement du seuil (typique : la fiche donne 100 à 300 ms ; raccourci ici pour l'écran).`); say(id, "flag", "RESET", (v, i, k) => ({ on: v[R][k] > 0.5 * (P.vdd || 3.3), text: v[R][k] > 0.5 * (P.vdd || 3.3) ? "relâché : la carte démarre" : "tenu : la carte attend" })); },
  COMP({ id, pin, P, els, say }) { const A = pin("IN+"), B = pin("IN-"), O = pin("OUT"), G = pin("V-"); els.push({ t: "SW", id, a: O, b: G, ron: 30, roff: 1e9, on: (s) => (s[A] || 0) < (s[B] || 0) }); say(id, "flag", "Seuil", (v, i, k) => ({ on: v[A][k] >= v[B][k], text: v[A][k] >= v[B][k] ? "dépassé : sortie haute" : "sous le seuil : sortie basse" })); },
  OPAMP({ id, pin, P, els, idle }) { els.push({ t: "OP", id, o: pin("OUT"), p: pin("IN+"), n: pin("IN-"), lo: 0.03, hi: (P.vdd ?? 3.3) - 0.03, gain: 1e5, gbw: 1e6 }); idle(id, pin("V+"), pin("V-"), 5e-4, P.vdd ?? 3.3); },
  CSA({ id, pin, P, els, calc }) { const rs = calc(/Résistance de mesure/) || 0.013, full = calc(/Pleine échelle/) || 2.6, gain = Math.round(full / ((P.imax || 10) * rs)); els.push({ t: "E", id, a: pin("OUT"), b: pin("GND"), p: pin("IN+"), n: pin("IN-"), gain }); },
  HALLI({ id, pin, P, els, calc }) { const A = pin("IP+"), B = pin("IP-"), O = pin("VIOUT"), G = pin("GND"), V = pin("VCC"), sens = calc(/Sensibilité/) || 0.0436, rp = 1.2e-3; els.push({ t: "R", id: `${id}:p`, a: A, b: B, r: rp }, { t: "BV", id, a: O, b: G, rs: 5, f: (s) => ((s[V] || 0) - (s[G] || 0)) / 2 + (sens * ((s[A] || 0) - (s[B] || 0))) / rp }); },
  TEMP({ id, pin, els, say, T }) { els.push({ t: "BV", id, a: pin("OUT"), b: pin("GND"), rs: 5, f: () => 0.5 + 0.01 * T }); say(id, "sensor", "Température lue", () => ({ on: true, text: `${T} °C → ${fx((0.5 + 0.01 * T), 2)} V` })); },
  OPTO({ id, pin, els, say }) { const A = pin("A"), K = pin("K"), m = `${id}_f`; els.push({ t: "D", id, a: A, k: m, vf: 1.2, at: 0.005 }, { t: "R", id: `${id}:s`, a: m, b: K, r: 1 }, { t: "SW", id: `${id}:t`, a: pin("C"), b: pin("E"), ron: 150, roff: 1e9, on: (s) => (s[m] || 0) - (s[K] || 0) > 5e-4 }); say(id, "led", "Optocoupleur", (v, i, k) => ({ on: i[id][k] > 5e-4, text: `${fx((i[id][k] * 1e3), 1)} mA dans la DEL`, color: "rouge" })); },
  ISO({ id, pin, P, els, isolate }) { const G1 = pin("GND1"), G2 = pin("GND2"), V1 = pin("VDD1"), V2 = pin("VDD2"); isolate(G2); for (const x of ["A", "B", "C"]) { const I = pin(`IN${x}`), O = pin(`OUT${x}`); els.push({ t: "BV", id: `${id}:${x}`, a: O, b: G2, rs: 50, f: (s) => ((s[I] || 0) - (s[G1] || 0) > 0.5 * ((s[V1] || 0) - (s[G1] || 0)) ? (s[V2] || 0) - (s[G2] || 0) : 0) }); }
    const I = pin("IND"), O = pin("OUTD"); els.push({ t: "BV", id: `${id}:D`, a: O, b: G1, rs: 50, f: (s) => ((s[I] || 0) - (s[G2] || 0) > 0.5 * ((s[V2] || 0) - (s[G2] || 0)) ? (s[V1] || 0) - (s[G1] || 0) : 0) }); },
  GATE({ id, pin, P, els }) { const VS = pin("VS"), VB = pin("VB"), COM = pin("COM"), VCC = pin("VCC"), hin = pin("HIN"), lin = pin("LIN"); els.push({ t: "BV", id, a: pin("HO"), b: VS, rs: 5, f: (s) => ((s[hin] || 0) > 1.6 ? Math.max(0, (s[VB] || 0) - (s[VS] || 0)) : 0) }, { t: "BV", id: `${id}:lo`, a: pin("LO"), b: COM, rs: 5, f: (s) => ((s[lin] || 0) > 1.6 ? Math.max(0, (s[VCC] || 0) - (s[COM] || 0)) : 0) }); },
  HBRIDGE({ id, pin, P, els, say }) { const VM = pin("VM"), PG = pin("PGND"), O1 = pin("OUT1"), O2 = pin("OUT2"), a = pin("IN1"), b = pin("IN2"), hi = (s, n) => (s[n] || 0) > 1.6;
    els.push({ t: "SW", id, a: VM, b: O1, ron: 0.3, roff: 1e7, on: (s) => hi(s, a) && !hi(s, b) }, { t: "SW", id: `${id}:l1`, a: O1, b: PG, ron: 0.3, roff: 1e7, on: (s) => hi(s, b) }, { t: "SW", id: `${id}:h2`, a: VM, b: O2, ron: 0.3, roff: 1e7, on: (s) => hi(s, b) && !hi(s, a) }, { t: "SW", id: `${id}:l2`, a: O2, b: PG, ron: 0.3, roff: 1e7, on: (s) => hi(s, a) }, { t: "D", id: `${id}:d1`, a: PG, k: O1, vf: 0.8, at: 1 }, { t: "D", id: `${id}:d2`, a: PG, k: O2, vf: 0.8, at: 1 }, { t: "D", id: `${id}:d3`, a: O1, k: VM, vf: 0.8, at: 1 }, { t: "D", id: `${id}:d4`, a: O2, k: VM, vf: 0.8, at: 1 });
    say(id, "motor", "Moteur", (v, i, k) => { const d = v[O1][k] - v[O2][k]; return { on: Math.abs(d) > 1, text: d > 1 ? "avant" : d < -1 ? "arrière" : "arrêté" }; }); },
  STEP({ id, pin, P, els, say }) { const VM = pin("VM"), G = pin("GND"), st = pin("STEP"), dir = pin("DIR"), m = { was: 0, k: 0 }, seq = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const turn = (s) => { const now = (s[st] || 0) > 1.6 ? 1 : 0; if (now && !m.was) m.k = (m.k + ((s[dir] || 0) > 1.6 ? 3 : 1)) % 4; m.was = now; return seq[m.k]; };
    for (const [w, x, j] of [["A", 0, 0], ["B", 1, 1]]) els.push({ t: "BV", id: w === "A" ? id : `${id}:b1`, a: pin(`${w}OUT1`), b: G, rs: 0.6, f: (s) => (j === 0 ? turn(s) : seq[m.k])[x] > 0 ? (s[VM] || 0) : 0 }, { t: "BV", id: `${id}:${w}2`, a: pin(`${w}OUT2`), b: G, rs: 0.6, f: (s) => (seq[m.k][x] < 0 ? (s[VM] || 0) : 0) });
    els.push({ t: "BV", id: `${id}:v3`, a: pin("V3P3"), b: G, rs: 20, f: (s) => ((s[VM] || 0) > 6 ? 3.3 : 0) }); say(id, "motor", "Pas", () => ({ on: true, text: `phase ${m.k + 1} sur 4` })); },
  MCU({ id, pin, P, els, say }) { const V = pin("VDD"), G = pin("VSS"), R = pin("NRST"), vdd = P.vdd ?? 3.3; els.push({ t: "R", id, a: V, b: G, r: vdd / 0.02 }); say(id, "flag", "Microcontrôleur", (v, i, k) => { const run = v[V][k] > 0.6 * vdd && (!v[R] || v[R][k] > 0.6 * vdd); return { on: run, text: run ? "en marche" : v[V][k] > 0.6 * vdd ? "tenu en reset" : "éteint" }; }); },
  CAN({ id, pin, P, els, say, wired }) { const G = pin("GND"), T = pin("TXD"), CH = pin("CANH"), CL = pin("CANL"), vio = P.vio ?? 3.3, dom = (s) => (s[T] || 0) < 0.5 * vio, on = (s) => (s[pin("VCC")] || 0) > 4;
    els.push({ t: "R", id: `${id}:pt`, a: T, b: pin(wired("VIO") ? "VIO" : "VCC"), r: 1e5 },      /* TXD left alone is held high from inside : the bus rests */
      { t: "V", id: `${id}:vh`, a: `${id}_h`, b: G, v: 3.75 }, { t: "V", id: `${id}:vl`, a: `${id}_l`, b: G, v: 1.25 }, { t: "V", id: `${id}:vm`, a: `${id}_m`, b: G, v: 2.5 }, { t: "SW", id, a: `${id}_h`, b: CH, ron: 7.5, roff: 1e9, on: (s) => on(s) && dom(s) }, { t: "SW", id: `${id}:l`, a: `${id}_l`, b: CL, ron: 7.5, roff: 1e9, on: (s) => on(s) && dom(s) }, { t: "R", id: `${id}:q`, a: pin("VCC"), b: G, r: 1000 }, { t: "R", id: `${id}:bh`, a: CH, b: `${id}_m`, r: 3e4 }, { t: "R", id: `${id}:bl`, a: CL, b: `${id}_m`, r: 3e4 },
      { t: "BV", id: `${id}:rx`, a: pin("RXD"), b: G, rs: 60, f: (s) => ((s[CH] || 0) - (s[CL] || 0) > 0.9 ? 0 : vio) }); say(id, "bus", "Bus CAN", (v, i, k) => ({ on: v[CH][k] - v[CL][k] > 0.9, text: v[CH][k] - v[CL][k] > 0.9 ? "dominant (0)" : "récessif (1)" })); },
  RS485({ id, pin, P, els, say }) { const G = pin("GND"), V = pin("VCC"), A = pin("A"), B = pin("B"), DI = pin("DI"), DE = pin("DE"), vcc = P.vdd ?? 3.3, de = (s) => (s[DE] || 0) > 0.5 * vcc, di = (s) => (s[DI] || 0) > 0.5 * vcc;
    els.push({ t: "BV", id: `${id}:a`, a: `${id}_a`, b: G, f: (s) => (di(s) ? 0.9 : 0.1) * (s[V] || 0) }, { t: "BV", id: `${id}:b`, a: `${id}_b`, b: G, f: (s) => (di(s) ? 0.1 : 0.9) * (s[V] || 0) }, { t: "SW", id, a: `${id}_a`, b: A, ron: 12, roff: 1e9, on: de }, { t: "SW", id: `${id}:sb`, a: `${id}_b`, b: B, ron: 12, roff: 1e9, on: de }, { t: "R", id: `${id}:q`, a: V, b: G, r: 3300 }, { t: "R", id: `${id}:ra`, a: A, b: G, r: 1.2e5 }, { t: "R", id: `${id}:rb`, a: B, b: G, r: 1.2e5 },
      { t: "BV", id: `${id}:ro`, a: pin("RO"), b: G, rs: 60, f: (s) => ((s[A] || 0) - (s[B] || 0) > -0.05 ? (s[V] || 0) : 0) }); say(id, "bus", "Bus RS-485", (v, i, k) => ({ on: v[DE][k] > 0.5 * vcc, text: v[DE][k] > 0.5 * vcc ? "émet" : "écoute" })); },
  RS232({ id, pin, P, els, say }) { const G = pin("GND"), V = pin("VCC"), vcc = P.vdd ?? 3.3, up = (s) => ((s[V] || 0) > 0.8 * vcc ? 5.5 : 0); els.push({ t: "BV", id: `${id}:p`, a: pin("VS+"), b: G, rs: 150, f: up }, { t: "BV", id: `${id}:n`, a: pin("VS-"), b: G, rs: 150, f: (s) => -up(s) }, { t: "BV", id, a: pin("T1OUT"), b: G, rs: 300, f: (s) => ((s[pin("T1IN")] || 0) > 0.5 * vcc ? -up(s) : up(s)) }, { t: "BV", id: `${id}:r`, a: pin("R1OUT"), b: G, rs: 60, f: (s) => ((s[pin("R1IN")] || 0) > 1.4 ? 0 : s[V] || 0) });
    say(id, "bus", "Ligne RS-232", (v, i, k) => ({ on: v[pin("T1OUT")][k] > 3, text: v[pin("T1OUT")][k] > 3 ? "+5,5 V : un 0" : "−5,5 V : un 1 (repos)" })); },
  LIN({ id, pin, P, els, say }) { const G = pin("GND"), L = pin("LIN"), VS = pin("VS"), T = pin("TXD"), EN = pin("EN"); els.push({ t: "V", id: `${id}:vp`, a: `${id}_p`, b: G, v: 3.3 }, { t: "R", id: `${id}:pt`, a: T, b: `${id}_p`, r: 1e5 }, { t: "SW", id, a: L, b: G, ron: 20, roff: 1e9, on: (s) => (s[EN] || 0) > 1.6 && (s[T] || 0) < 1.6 }, { t: "BV", id: `${id}:rx`, a: pin("RXD"), b: G, rs: 60, f: (s) => ((s[L] || 0) > 0.5 * (s[VS] || 0) ? 3.3 : 0) }, { t: "R", id: `${id}:pu`, a: VS, b: L, r: 3e4 }); say(id, "bus", "Bus LIN", (v, i, k) => ({ on: v[L][k] < 0.4 * v[VS][k], text: v[L][k] < 0.4 * v[VS][k] ? "dominant (0)" : "récessif (1)" })); },
  USBUART({ id, pin, P, els, say, o }) { const G = pin("GND"), V = pin("VCC"), vio = P.vio ?? 3.3, tx = o.uart || { at: () => 1 }; els.push({ t: "BV", id, a: pin("TXD"), b: G, rs: 60, f: (s, t) => ((s[V] || 0) > 2.5 && tx.at(t) ? vio : 0) }, { t: "R", id: `${id}:q`, a: V, b: G, r: 400 }); say(id, "bus", "Liaison série", (v, i, k, t) => ({ on: !tx.at(t), text: tx.at(t) ? "repos (1)" : "un bit à 0" })); },
  EEPROM(d) { i2cPart(d, d.calc(/Adresse/) || 0x50, "Mémoire", (bytes) => `écrit ${bytes.slice(1).map(hex).join(" ")} à l'adresse ${hex(bytes[0] ?? 0)}`); },
  RTC(d) { i2cPart(d, 0x68, "Horloge", (bytes) => `registre ${hex(bytes[0] ?? 0)} mis à ${bytes.slice(1).map(hex).join(" ")}`); },
  IMU(d) { i2cPart(d, 0x6a, "Centrale inertielle", (bytes) => `registre ${hex(bytes[0] ?? 0)} mis à ${bytes.slice(1).map(hex).join(" ")}`); },
  FLASH({ id, pin, P, els, say }) { const G = pin("GND"), V = pin("VCC"), CS = pin("CS"), CK = pin("SCK"), MI = pin("MISO"), vdd = P.vdd ?? 3.3, ID = [0xa5, 0x5a, 0x3c], m = { was: 0, n: 0, out: 1, sel: false };
    const look = (s) => { const cs = (s[CS] || 0) < 0.5 * vdd, ck = (s[CK] || 0) > 0.5 * vdd ? 1 : 0; if (!cs) { m.n = 0; m.out = 1; } else if (m.was && !ck) { m.n++; const k = m.n - 8; m.out = k >= 0 && k < 24 ? (ID[Math.floor(k / 8)] >> (7 - (k % 8))) & 1 : 1; } m.was = ck; m.sel = cs; return m; };
    els.push({ t: "BV", id: `${id}:v`, a: `${id}_o`, b: G, f: (s) => (look(s).out ? s[V] || 0 : 0) }, { t: "SW", id, a: `${id}_o`, b: MI, ron: 60, roff: 1e9, on: () => m.sel }, { t: "R", id: `${id}:q`, a: V, b: G, r: 1e4 }); say(id, "memory", "Mémoire flash", () => ({ on: m.sel && m.n > 8, text: m.sel ? (m.n > 8 ? `répond : octet ${Math.min(3, Math.floor((m.n - 8) / 8) + 1)} sur 3` : "écoute la commande") : "au repos" })); },
};
const hex = (b) => `0x${(b & 255).toString(16).toUpperCase().padStart(2, "0")}`;
function i2cPart({ id, pin, P, els, say }, addr, name, words) {
  const G = pin("GND"), SCL = pin("SCL"), SDA = pin("SDA"), vdd = P.vdd ?? 3.3, ear = i2cEar(addr); let last = null, m = null;
  els.push({ t: "SW", id, a: SDA, b: G, ron: 40, roff: 1e9, on: (s, t) => { m = ear((s[SCL] || 0) > 0.5 * vdd ? 1 : 0, (s[SDA] || 0) > 0.5 * vdd ? 1 : 0, t); if (m.done && m.done !== last) last = m.done; return m.ack; } });
  say(id, "memory", name, (v, i, k, t) => { const wrote = last && t >= last.t; return { on: !!wrote || Math.abs(i[id][k]) > 1e-4, text: wrote ? words(last.bytes) : Math.abs(i[id][k]) > 1e-4 ? "répond (ACK)" : "écoute", addr }; });
}
/** The address a part of a bus answers to, for the one who writes the bench : { EEPROM, RTC, IMU }. */
export const I2C_ADDR = { eeprom: 0x50, rtc: 0x68, imu: 0x6a };
