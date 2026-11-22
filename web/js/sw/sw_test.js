/* DesignOrbit.ai — Logiciel : the TESTS that prove the requirements (cycle en V, « 6 Vérification » ; the V-model pairs each phase of design
   with the phase of test made for it). A test is a scenario — what each input pin reads, instant after instant, as the live bench drives it —
   and what one EXPECTS : a signal worth a value at an instant, or one that becomes a value within a window (a response time). It names the
   requirements it proves. It runs on the MODEL, the very step the tool writes in C (sw/sw_design.js simulate) : passed or failed, with what
   was found.
   COVERAGE, said for what it is : across all the tests, has every 0 / 1 output of every tile taken both values ? It is a coverage of the
   MODEL. The structural coverage a standard asks (statements, decisions, MC/DC) is measured on the compiled C, with a coverage tool — the
   model does not give it, and the screen says so. Pure. */

import { KINDS, portOf, cfgOf } from "./sw_objects.js";
import { simulate, split, liveWires } from "./sw_design.js";

export const OPS = { "==": "vaut", ">=": "vaut au moins", "<=": "vaut au plus" };
export const testsOf = (d) => (d && d.tests) || [];
const nextId = (list) => `TC-${String(list.reduce((m, x) => Math.max(m, Number(String(x.id).split("-")[1]) || 0), 0) + 1).padStart(3, "0")}`;
/** A new test : the scenario of the design as its start, nothing expected yet. */
export function addTest(d, o = {}) { d.tests = d.tests || []; const sc = d.scenario || { steps: 100, pins: {} };
  const t = { id: nextId(d.tests), name: String(o.name || "Nouvel essai").trim(), reqs: [...(o.reqs || [])], steps: o.steps || sc.steps || 100, pins: JSON.parse(JSON.stringify(o.pins || sc.pins || {})), expect: JSON.parse(JSON.stringify(o.expect || [])), on: true, sure: o.sure !== false };
  d.tests.push(t); return t; }
export function copyTest(d, id) { const L = testsOf(d), t = L.find((x) => x.id === id); if (!t) return null; const c = { ...JSON.parse(JSON.stringify(t)), id: nextId(L), name: `${t.name} (copie)`, on: false }; L.splice(L.indexOf(t) + 1, 0, c); return c; }
export function setTest(d, id, o) { const t = testsOf(d).find((x) => x.id === id); if (!t) return null; for (const k of ["name", "reqs", "steps", "pins", "expect", "on", "sure"]) if (o[k] !== undefined) t[k] = o[k]; return t; }
export function removeTest(d, id) { const n = testsOf(d).length; d.tests = testsOf(d).filter((x) => x.id !== id); return d.tests.length < n; }

const nameOf = (d, ref) => { const [id, key] = split(ref), o = ((d && d.objects) || []).find((x) => x.id === id); return `${o ? o.name : id} · ${key}`; };
/** An expectation, in words. */
export function expectText(d, e) {
  const unit = (() => { const [id, key] = split(e.ref), o = ((d && d.objects) || []).find((x) => x.id === id), p = o && portOf(o, "out", key); return p && p.unit !== "0/1" ? ` ${p.unit}` : ""; })();
  return e.within ? `${nameOf(d, e.ref)} passe à ${e.becomes}${unit} entre ${e.within[0]} et ${e.within[1]} ms` : `${nameOf(d, e.ref)} ${OPS[e.op] || "vaut"} ${e.value}${unit} à ${e.at} ms`;
}
/** Runs a test on the model. → { id, ok, checks: [{ text, ok, got }], R } — a test that expects nothing is not passed : it proves nothing. */
export function runTest(d, t) {
  const R = simulate(d, { steps: t.steps, pins: t.pins || {} }), dt = d.period || 10, checks = [];
  const at = (ref, ms) => { const y = R.ports[ref]; if (!y || !y.length) return undefined; const k = Math.min(y.length - 1, Math.max(0, Math.round(ms / dt))); return y[k]; };
  for (const e of t.expect || []) {
    if (!R.ports[e.ref]) { checks.push({ text: expectText(d, e), ok: false, got: "ce signal n'existe pas dans le logiciel" }); continue; }
    if (e.within) { const y = R.ports[e.ref], k0 = Math.max(0, Math.ceil(e.within[0] / dt)), k1 = Math.min(y.length - 1, Math.floor(e.within[1] / dt)); let hit = -1;
      for (let k = k0; k <= k1; k++) if (y[k] === e.becomes) { hit = k; break; }
      checks.push({ text: expectText(d, e), ok: hit >= 0, got: hit >= 0 ? `à ${R.t[hit]} ms` : `jamais dans la fenêtre (vaut ${y[k1]} à ${R.t[k1] ?? e.within[1]} ms)` }); }
    else { const v = at(e.ref, e.at), ok = e.op === ">=" ? v >= e.value : e.op === "<=" ? v <= e.value : v === e.value; checks.push({ text: expectText(d, e), ok, got: `vaut ${v}` }); }
  }
  return { id: t.id, ok: checks.length > 0 && checks.every((c) => c.ok), checks, R };
}
/** Every test that is On. → { results: { id: run }, total, passed, failed, empty } */
export function runAll(d) {
  const results = {}; let passed = 0, failed = 0, empty = 0;
  for (const t of testsOf(d).filter((x) => x.on !== false)) { const r = runTest(d, t); results[t.id] = r; if (!(t.expect || []).length) empty++; else if (r.ok) passed++; else failed++; }
  return { results, total: Object.keys(results).length, passed, failed, empty };
}
/** The coverage of the MODEL : across the runs, every 0 / 1 output of every tile has taken 0 and 1. → { outs: [{ ref, name, seen0, seen1 }], full, of, ratio } */
export function modelCoverage(d, results) {
  const outs = []; for (const o of ((d && d.objects) || []).filter((x) => !x.off && KINDS[x.kind])) for (const p of KINDS[o.kind].ports.out) { const q = portOf(o, "out", p.key); if (q && q.unit === "0/1") outs.push({ ref: `${o.id}.${p.key}`, name: `${o.name} · ${p.key}`, seen0: false, seen1: false }); }
  for (const r of Object.values(results || {})) for (const x of outs) { const y = r.R.ports[x.ref] || []; if (y.includes(0)) x.seen0 = true; if (y.includes(1)) x.seen1 = true; }
  const full = outs.filter((x) => x.seen0 && x.seen1).length; return { outs, full, of: outs.length, ratio: outs.length ? full / outs.length : 0 };
}
/** What the guide says of the tests. → [{ level, text, test? }] */
export function testGuide(d, run) {
  const out = [], T = testsOf(d).filter((t) => t.on !== false);
  if (!T.length) return [{ level: "todo", text: "Aucun essai : un essai par exigence vérifiée « par essai » — un scénario, et ce que l'on attend." }];
  for (const t of T) { const r = run.results[t.id];
    if (!(t.expect || []).length) out.push({ level: "todo", text: `${t.id} n'attend rien : dites ce qui doit se passer (un signal, une valeur, un instant).`, test: t.id });
    else if (r && !r.ok) out.push({ level: "error", text: `${t.id} « ${t.name} » échoue : ${r.checks.filter((c) => !c.ok).map((c) => `${c.text} — ${c.got}`).join(" ; ")}.`, test: t.id });
    if (!(t.reqs || []).length) out.push({ level: "warn", text: `${t.id} ne prouve aucune exigence : dites laquelle.`, test: t.id });
    if (t.sure === false) out.push({ level: "warn", text: `${t.id} est un essai d'exemple : relisez le scénario et les attendus, puis confirmez-le.`, test: t.id }); }
  return out;
}

/* ---------- the scenario of a test, written as an engineer reads it ---------- */
const div = (a, b) => Math.trunc(a / b), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** How each input pin is read in the unit of what it measures : an ADC channel that feeds an « Analog input » is said in that unit (mV, mA…),
    any other in counts or 0 / 1. → { [pin id]: { name, unit, kind ("analog" | "digital"), phys(counts), counts(value) } } */
export function pinScales(d) {
  const objs = ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]), O = Object.fromEntries(objs.map((o) => [o.id, o])), W = liveWires(d), out = {};
  for (const o of objs) { const K = KINDS[o.kind];
    if (K.pin === "ain") { const w = W.find((x) => x.from === `${o.id}.counts`), m = w ? O[split(w.to)[0]] : null;
      if (m && m.kind === "analog_in") { const c = cfgOf(m), full = (1 << c.bits) - 1, phys = (n) => div(div(n * c.vref, full) * c.num, c.den) + c.offset;
        const counts = (v) => { const n0 = clamp(Math.round(((v - c.offset) * c.den / c.num) * full / c.vref), 0, full); let best = n0; for (let n = Math.max(0, n0 - 3); n <= Math.min(full, n0 + 3); n++) if (Math.abs(phys(n) - v) < Math.abs(phys(best) - v)) best = n; return best; };      // the count whose value is nearest : written and read back the same
        out[o.id] = { name: m.name, unit: c.unit, kind: "analog", phys, counts }; }
      else out[o.id] = { name: o.name, unit: "counts", kind: "analog", phys: (n) => n, counts: (v) => clamp(Math.round(v), 0, 4095) }; }
    else if (K.pin === "din") out[o.id] = { name: o.name, unit: "0/1", kind: "digital", phys: (n) => n, counts: (v) => (v ? 1 : 0) }; }
  return out;
}
/** The points of a pin, as text : « 0 ms : 3 900 mV ; 500 ms : 4 330 mV » — in the unit of what it measures. */
export const pointsText = (points, sc) => (points || []).map(([t, n]) => `${t} : ${sc ? sc.phys(n) : n}`).join(" ; ");
/** Reads back such a text. → { points } or { error } */
export function parsePoints(text, sc) {
  const parts = String(text || "").split(/[;\n]+/).map((x) => x.trim()).filter(Boolean), out = [];
  for (const p of parts) { const m = /^(\d+)\s*(?:ms)?\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/.exec(p.replace(/\s+(?=\d)/g, (x, i, s) => (/\d$/.test(s.slice(0, i)) && !/[:=]\s*$/.test(s.slice(0, i)) ? "" : x)));
    if (!m) return { error: `« ${p} » : écrivez « instant en ms : valeur », par exemple « 500 : 4330 ».` };
    out.push([Number(m[1]), sc ? sc.counts(Number(m[2].replace(",", "."))) : Number(m[2])]); }
  if (!out.length) return { error: "Au moins un point : « 0 : valeur »." };
  out.sort((a, b) => a[0] - b[0]); return { points: out };
}
/** The outputs one may expect something of : every port that leaves a tile, and what the software writes on a pin (the input of a « Digital
    output » : it is what leaves the CPU). → [{ ref, name, unit }] */
export const outputsOf = (d) => ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]).flatMap((o) => {
  const K = KINDS[o.kind], ports = K.pin === "dout" ? K.ports.in.map((p) => ["in", p, " (broche)"]) : K.ports.out.map((p) => ["out", p, ""]);
  return ports.map(([side, p, tag]) => { const q = portOf(o, side, p.key); return { ref: `${o.id}.${p.key}`, name: `${o.name} · ${p.key}${tag}`, unit: q ? q.unit : "" }; }); });
