/* DynamiteOrbit — the electronics lab : the blocks of a board, simulated together (choix de JP, 19 novembre 2026 : « simuler la
   chaîne de la carte d'un seul tenant — protection, abaisseur, linéaire, charges — pour que les essais d'ensemble du plan de test
   aient aussi leurs valeurs attendues »). Each block alone is fed by the bench (pcba/lab_bench.js) ; here the board feeds itself :
   the circuits of its blocks are joined by the nets of the board, a supply is put on what comes from outside, and each rail is
   born of the one before.
   How blocks are joined : a net of a block is the net of the board that holds one of its pins (the parts of a block keep their
   local name and their reference) ; what stays inside a block keeps a name of its own. Every element is named by the reference
   of its part, so that what lights up is a part of the board.
   What it is not : the program of the microcontroller does not run — its pins drive nothing ; the integrated circuits are the same
   TYPICAL behaviours as in a block alone, and their quiescent current is not there. Pure. */

import { BLOCKS, blockParams } from "./blocks.js";
import { blockCircuit } from "./lab_devices.js";
import { transient, measure } from "./lab_mna.js";
import { tranResult, eng } from "./lab_bench.js";

const NODE_KEYS = ["a", "b", "k", "o", "p", "n"];
/** The key under which the tests of the whole board are kept in board.lab (no block is named so). */
export const BOARD_KEY = "BOARD";
const groundOf = (board) => { const g = (board.nets || []).find((n) => n.class === "ground") || (board.nets || []).find((n) => /^GND$/i.test(n.name)); return g ? g.name : "GND"; };

/** The circuit of a whole board. → { els, nets: { board net: node }, parts: [{ id: ref }], states, notes, blocks: [{ id, tpl, ports: { name: { dir, net (of the board) } } }] } */
export function boardCircuit(board, env = {}) {
  const ground = groundOf(board), byPin = new Map(); for (const n of board.nets || []) for (const p of n.pins || []) byPin.set(p, n.name);
  const els = [], states = [], notes = [], blocks = [], nets = Object.fromEntries((board.nets || []).map((n) => [n.name, n.name === ground ? "0" : n.name]));
  for (const b of board.blocks || []) { const T = BLOCKS[b.template]; if (!T) continue;
    const P = blockParams(T, b.params || {}), built = T.build(P), C = blockCircuit(built, b.template, P, env), refs = Object.fromEntries((board.parts || []).filter((p) => p.block === b.id && p.local).map((p) => [p.local, p.ref]));
    const onBoard = (local) => { for (const pin of local.pins) { const dot = pin.indexOf("."), ref = refs[pin.slice(0, dot)], hit = ref && byPin.get(`${ref}.${pin.slice(dot + 1)}`); if (hit) return hit; } return null; };
    const map = new Map(), portNet = {}; for (const n of built.nets) { const bn = onBoard(n); map.set(C.nets[n.name], bn ? nets[bn] : `${b.id}:${n.name}`); for (const [k, p] of Object.entries(built.ports || {})) if (p.net === n.name) portNet[k] = { dir: p.dir, net: bn }; }
    if (!Object.keys(refs).length) { notes.push(`${b.id} : ce bloc n'a pas encore ses composants sur la carte — il n'est pas dans la simulation d'ensemble.`); continue; }
    const G = (x) => { if (!map.has(x)) map.set(x, `${b.id}:${x}`); return map.get(x); }, name = (id) => { const s = String(id), c = s.indexOf(":"), base = c < 0 ? s : s.slice(0, c); return refs[base] ? `${refs[base]}${c < 0 ? "" : s.slice(c)}` : `${b.id}:${s}`; };
    const seen = (S) => new Proxy({}, { get: (_, l) => (typeof l === "string" ? S[G(l)] : undefined) }), byId = (I) => new Proxy({}, { get: (_, l) => (typeof l === "string" ? I[name(l)] : undefined) });      // a block reads the board through its own names
    for (const e of C.els) { const x = { ...e, id: name(e.id) }; for (const k of NODE_KEYS) if (typeof e[k] === "string") x[k] = G(e[k]); if (e.f) x.f = (S, t, self) => e.f(seen(S), t, self); if (e.on) x.on = (S, t, self) => e.on(seen(S), t, self); els.push(x); }
    for (const s of C.states) if (refs[s.part]) states.push({ part: refs[s.part], kind: s.kind, label: s.label, at: (v, i, k, t) => s.at(seen(v), byId(i), k, t) });
    for (const t of C.notes) notes.push(t.replace(/^(\w+) :/, (m, id) => (refs[id] ? `${refs[id]} :` : m)));
    blocks.push({ id: b.id, tpl: b.template, name: b.name || T.name, ports: portNet }); }
  return { els, nets, parts: (board.parts || []).map((p) => ({ id: p.ref })), states, notes, blocks, ground };
}

/** Where the power of a board comes from and goes : { inputs: [{ net, volts }], rails: [{ net, volts, by (block id), name }] } — the rails in the
    order the power travels. An input is a net a block is fed by, and that no block of the board makes. */
export function powerTree(board, C = boardCircuit(board)) {
  const volts = (name) => ((board.nets || []).find((n) => n.name === name) || {}).voltage || 0, made = new Map(), fed = new Set();
  for (const b of C.blocks) for (const p of Object.values(b.ports)) { if (!p.net || p.net === C.ground) continue; if (p.dir === "power_out") made.set(p.net, b); else if (p.dir === "power_in") fed.add(p.net); }
  const inputs = [...fed].filter((n) => !made.has(n)).map((net) => ({ net, volts: volts(net) })).filter((x) => x.volts > 0), rails = [], live = new Set(inputs.map((x) => x.net));
  for (let pass = 0; pass < C.blocks.length + 1; pass++) for (const [net, b] of made) { if (live.has(net)) continue; if (Object.values(b.ports).some((p) => p.dir === "power_in" && live.has(p.net))) { live.add(net); rails.push({ net, volts: volts(net), by: b.id, name: b.name }); } }
  return { inputs, rails };
}

/* ---------- the bench of a whole board : a supply on what comes from outside, probes on its rails ---------- */
function makeBoardBench(board, env = {}) {
  const C = boardCircuit(board, env), els = C.els, log = [], tree = powerTree(board, C);
  /* a net of the board, or a pad of it (« R3.2 », a lead moved by hand) : the node of its net */
  const at = (x) => { if (x === "0" || x === "GND" || x === C.ground) return "0"; if (C.nets[x] !== undefined) return C.nets[x]; if (/^[^.\s]+\.[^\s]+$/.test(String(x))) { const n = (board.nets || []).find((q) => (q.pins || []).includes(x)); if (n) return at(n.name); } return x; };
  const mv = (gear, role) => ((env.moves || {})[gear] || {})[role] || null, moved = (to, ref) => ({ ...(to ? { atTo: to } : {}), ...(ref ? { atRef: ref } : {}) });
  const B = { board, C, els, log, at, tree, env, built: { parts: C.parts, nets: (board.nets || []).map((n) => ({ name: n.name })), ports: {} },
    supply(net, v, o = {}) { const g = (env.gear || {})[`supply:${net}`] || {}, free = typeof v === "number" && v >= 0 && (!o.wave || o.wave.kind === "step");      // a setting made ON the instrument (pcba/lab_gear.js), as on the bench of a block
      if (free && Number.isFinite(g.v) && g.v >= 0) { v = g.v; if (o.wave) o = { ...o, wave: { ...o.wave, high: g.v } }; } if (Number.isFinite(g.ilim) && g.ilim > 0) o = { ...o, ilim: g.ilim };
      const id = `PS_${net}`, mid = `${id}_o`, mp = mv(`supply:${net}`, "plus"), mm = mv(`supply:${net}`, "minus"); els.push({ t: "V", id, a: mid, b: mm ? at(mm) : "0", v: o.wave || v }, { t: "R", id: `${id}:r`, a: mid, b: at(mp || net), r: o.rs ?? 0.05 }); log.push({ instr: "supply", to: net, v: typeof v === "number" ? v : null, ilim: o.ilim || null, note: o.note || "", ref: "GND", free, ...((free && Number.isFinite(g.v)) || Number.isFinite(g.ilim) ? { set: true } : {}) , ...moved(mp, mm) }); return id; },
    sink(net, i, o = {}) { const id = `LOAD_${net}`, ma = mv(`load:${net}`, "load"), mb = mv(`load:${net}`, "loadBack"); els.push({ t: "I", id, a: at(ma || net), b: mb ? at(mb) : "0", i }); log.push({ instr: "load", to: net, i: typeof i === "number" ? i : null, wave: typeof i === "number" ? null : i, toRef: "GND", note: o.note || "", ...moved(ma, mb) }); return id; },
    probe(ch, net, o = {}) { const m = { ...((env.moves || {}).meter || {}), ...((env.moves || {}).scope || {}) }, mt = m[ch === 2 ? "probe2" : "probe"] || null, mr = m.clip || null;
      log.push({ instr: "scope", ch, to: net, ref: "GND", ac: !!o.ac, note: o.note || "", ...moved(mt, mr) }); return { at: mt || net, ref: mr, label: mt ? `${o.label || net} → ${mt}` : o.label || net, ac: !!o.ac }; },
    press(pin, note) { log.push({ instr: "press", to: pin, note: note || "" }); }, cell(pin, note) { log.push({ instr: "cell", to: pin, note: note || "" }); } };
  return B;
}
const fr = (x, d = 3) => String(+(+x).toPrecision(d)).replace(".", ",");
/* the time a signal first reaches a level, and the value of another at the last time a signal was above a level */
const firstAt = (t, y, level) => { for (let k = 0; k < y.length; k++) if (y[k] >= level) return t[k]; return NaN; };
const lastAbove = (y, level, from) => { let k = -1; for (let q = from; q < y.length; q++) if (y[q] >= level) k = q; return k; };
const LIMIT = 0.2, RISE = 2e-3;

/* a rail a regulator makes — not the one a protection merely lets through */
const regulated = (T) => T.rails.filter((r) => r.volts < 0.9 * T.inputs[0].volts);
const TESTS = [
  { id: "powerup", nature: "power", title: "Mise sous tension de la carte entière", gear: ["supply", "scope", "dmm"],
    why: "Chaque bloc a été essayé seul, alimenté par le banc. Ici la carte s'alimente elle-même : chaque rail naît du précédent, et l'entrée donne pour la première fois le courant de tous les blocs à la fois. C'est l'essai qui dit si les blocs vont ensemble.",
    expect: (R) => { const T = R.B.tree; return `Chaque rail s'établit à sa valeur : ${T.rails.map((x) => `${x.net} à ${fr(x.volts)} V`).join(", ")}. À la mise sous tension, l'alimentation peut passer un instant en limitation, le temps de charger les condensateurs d'entrée ; elle doit en sortir seule — si elle y reste, coupez. Le programme du microcontrôleur ne tourne pas dans la simulation et le courant de repos des circuits intégrés n'y est pas : le courant d'entrée simulé est un plancher, d'où un plafond plutôt qu'une plage.`; },
    learn: "Un rail qui n'arrive pas se cherche en remontant : on mesure le rail d'avant, puis l'entrée du régulateur, puis sa broche de validation. Un rail trop bas avec un courant trop fort : une charge en court-circuit en aval.",
    wire(B) { const T = B.tree, ids = T.inputs.map((s) => B.supply(s.net, s.volts, { ilim: LIMIT, wave: { kind: "step", low: 0, high: s.volts, delay: 1e-3, rise: RISE } })), all = [...T.inputs, ...T.rails], last = all[all.length - 1], first = T.inputs[0];
      return { run: { kind: "tran", tEnd: 3e-2, steps: 6000, from: "zero" }, ch1: B.probe(1, first.net, { label: `Entrée ${first.net}` }), ch2: B.probe(2, last.net, { label: last.net }),
        meas: [...T.rails.map((r) => ({ label: `Tension du rail ${r.net}`, unit: "V", design: r.volts, read: (R) => R.m(r.net, 0.85).mean })),
          { label: `Temps d'établissement de ${last.net}, depuis le début de la montée de l'entrée`, unit: "s", under: (v) => Math.max(10 * v, 0.05), read: (R) => firstAt(R.t, R.v(last.net), 0.9 * last.volts) - firstAt(R.t, R.v(first.net), 0.1 * first.volts) },
          ...ids.map((id, k) => ({ label: `Courant d'entrée sur ${T.inputs[k].net}, carte au repos`, unit: "A", under: LIMIT / 2, read: (R) => Math.abs(R.im(id, 0.85).mean) }))] }; } },
  { id: "thresholds", nature: "static", title: "Montée et baisse lentes de la tension d'entrée", gear: ["supply", "dmm"],
    why: "Une alimentation qui s'affaisse — batterie faible, câble long, moteur qui démarre à côté — ne coupe pas la carte d'un coup : les rails lâchent l'un après l'autre, et reviennent l'un après l'autre. Savoir à quelle tension d'entrée chacun s'établit et à laquelle il lâche, c'est savoir jusqu'où la carte reste fiable.",
    expect: (R) => { const T = R.B.tree, reg = regulated(T); return `L'entrée monte lentement de zéro à ${fr(T.inputs[0].volts)} V, puis redescend. Un rail s'établit dès que son régulateur a assez de marge, et tient jusqu'à ce qu'il n'en ait plus : ${reg.length > 1 ? `le rail le plus bas (${reg[reg.length - 1].net}) arrive le premier et lâche le dernier` : "il tient sur presque toute la plage"}. Les seuils simulés sont ceux de comportements typiques — mise en marche du régulateur, rapport cyclique le plus grand, chute minimale : la fiche technique de chaque régulateur donne les siens, d'où une plage large.`; },
    learn: "La tension d'entrée minimale d'une carte n'est pas celle de son premier régulateur : c'est celle où le DERNIER rail utile est encore en régulation, avec la marge que demande le circuit de remise à zéro.",
    steps: ["Montez la tension de l'alimentation par pas de 1 V depuis zéro, en lisant chaque rail au multimètre ; à l'approche d'un seuil, par pas de 0,1 V. Notez la tension d'entrée à laquelle chaque rail atteint sa valeur.", "Redescendez de la même façon, et notez la tension d'entrée à laquelle chaque rail quitte sa valeur."],
    wire(B) { const T = B.tree, first = T.inputs[0], t1 = 0.021, t2 = 0.025, t3 = 0.045; for (const s of T.inputs) B.supply(s.net, s.volts, { ilim: LIMIT, wave: { kind: "pwl", points: [[0, 0], [1e-3, 0], [t1, s.volts], [t2, s.volts], [t3, 0]] }, note: "réglée à la main : de zéro à la valeur nominale, puis retour" }); const all = [...T.inputs, ...T.rails], last = all[all.length - 1], reg = regulated(T);
      const up = (R, r) => { const y = R.v(r.net); for (let k = 0; k < y.length; k++) if (y[k] >= 0.95 * r.volts) return R.v(first.net)[k]; return NaN; }, down = (R, r) => { const k0 = Math.floor((t2 / t3) * R.t.length), k = lastAbove(R.v(r.net), 0.95 * r.volts, k0); return k < 0 ? NaN : R.v(first.net)[k]; };
      return { run: { kind: "tran", tEnd: t3, steps: 9000, from: "zero" }, ch1: B.probe(1, first.net, { label: `Entrée ${first.net}` }), ch2: B.probe(2, last.net, { label: last.net }),
        meas: [...reg.map((r) => ({ label: `Tension d'entrée quand ${r.net} s'établit (à la montée)`, unit: "V", tol: 0.15, read: (R) => up(R, r) })), ...reg.map((r) => ({ label: `Tension d'entrée quand ${r.net} lâche (à la descente)`, unit: "V", tol: 0.15, read: (R) => down(R, r) }))] }; } },
];
/* a board that lives on its own cell (pcba/blocks_power.js : battery) : no supply of the bench — the cell feeds every block, and the one at the
   bench presses every button at once ; the LEDs share the cell, whose voltage sags by its internal resistance (a typical value, said) */
const partsOf = (board, tpl, local) => { const ids = new Set((board.blocks || []).filter((b) => b.template === tpl).map((b) => b.id)); return (board.parts || []).filter((p) => ids.has(p.block) && p.local === local).map((p) => p.ref); };
const CELL = [{ id: "cell", nature: "function", title: "La carte entière sur sa pile, tous les boutons à la fois", gear: ["dmm"],
  why: "Chaque bloc a été essayé seul, sur l'alimentation du banc. Ici, c'est la pile de la carte qui alimente tout, et l'on appuie sur tous les boutons à la fois : les DEL se partagent la pile, dont la tension baisse un peu plus.",
  expect: (R) => `Boutons relâchés : aucune DEL allumée, la pile à environ 3 V. Tous les boutons appuyés : toutes les DEL allumées, chacune à un peu moins de son courant prévu ; la pile perd quelques centièmes de volt. Les 10 Ω de résistance interne de la pile sont une valeur typique : la vôtre peut en avoir le double, surtout si elle a servi.`,
  learn: "Une source n'est jamais parfaite : plus on lui demande de courant, plus sa tension baisse. Une pile bouton s'en ressent vite — c'est pourquoi cette carte ne consomme que pendant l'appui.",
  env: () => ({ press: (t) => t > 1e-3 }),
  wire(B) { const bat = partsOf(B.board, "battery", "BT")[0], rail = (B.tree.rails.find((r) => r.by && (B.board.blocks || []).some((b) => b.id === r.by && b.template === "battery")) || B.tree.rails[0] || {}).net || "+3V", leds = partsOf(B.board, "push_led", "D"), keys = partsOf(B.board, "push_led", "SW");
    if (bat) B.cell(`${bat}.+`, "une pile CR2032 neuve"); keys.forEach((k) => B.press(`${k}.A`));
    return { run: { kind: "tran", tEnd: 2e-3, steps: 400 }, ch1: B.probe(1, rail, { label: "Pile" }), ch2: B.probe(2, rail, { label: "Pile, tous les boutons appuyés" }),
      meas: [{ label: "Tension de la pile, boutons relâchés", unit: "V", before: true, read: (R) => measure(R.sub(R.v(rail), 0.2, 0.45)).mean, design: 3, tol: 0.1 }, { label: "Tension de la pile, tous les boutons appuyés", unit: "V", read: (R) => R.m(rail, 0.8).mean, design: 3 - 10 * 2e-3 * leds.length, tol: 0.1 },
        ...leds.map((d) => { const x = ledLeg(B.board, d); return x ? { label: `Tension aux bornes de ${x.r} — le courant de ${d} est U ÷ ${x.ohms} Ω`, unit: "V", read: (R) => R.md(x.a, x.b, 0.8).mean, design: x.i * x.ohms, tol: 0.2 } : null; }).filter(Boolean)] }; } }];
/** The resistor in series with an LED of a push_led block : its reference, its two nets on the board, its value and the current it was designed for —
    with no supply on the bench, the current of an LED is read as the voltage across its resistor. */
function ledLeg(board, ref) {
  const p = (board.parts || []).find((x) => x.ref === ref), b = p && (board.blocks || []).find((x) => x.id === p.block), T = b && BLOCKS[b.template]; if (!T) return null;
  const r = (board.parts || []).find((x) => x.block === b.id && x.local === "R"), net = (pin) => ((board.nets || []).find((n) => (n.pins || []).includes(pin)) || {}).name, calc = T.build(blockParams(T, b.params || {})).calc || [], c = (re) => Number((calc.find((x) => re.test(x.label)) || {}).value);
  return r && net(`${r.ref}.1`) && net(`${r.ref}.2`) ? { r: r.ref, a: net(`${r.ref}.1`), b: net(`${r.ref}.2`), ohms: c(/Résistance de la DEL/), i: c(/Courant de la DEL/) } : null;
}
/** The tests of a whole board : none when nothing feeds it from outside or when it makes no rail of its own ; a board on its own cell has its own. */
export function boardTests(board) { const T = powerTree(board); return T.inputs.length && T.rails.length ? TESTS : (board.blocks || []).some((b) => b.template === "battery") ? CELL : []; }
/** Runs a test of the whole board. → the same result as a test of a block (pcba/lab_bench.js runTest), its parts named by their reference
    and its nets by their name on the board ; board : true. */
export function runBoardTest(board, testId, o = {}) {
  const test = boardTests(board).find((x) => x.id === testId); if (!test) return { ok: false, kind: "none", error: "Essai inconnu." };
  /* what the test writes (a press), then what was set on the instruments (env.gear) */
  const B = makeBoardBench(board, { ...(test.env ? test.env() : {}), ...(o.env || {}) }), plan = test.wire(B), sim = transient({ els: B.els }, plan.run), out = tranResult(B, plan, test, {}, sim);
  return { ...out, board: true, tree: B.tree, notes: [...B.C.notes, "Carte entière : le programme du microcontrôleur ne tourne pas, ses broches ne commandent rien ; le courant de repos des circuits intégrés n'est pas simulé."] };
}
export { eng };
