/* DynamiteOrbit — Logiciel : the C of a design, WRITTEN BY THE TOOL from its objects (sw/sw_objects.js, sw/sw_design.js) — a library,
   modules and a file structure (demande de JP : « des objets visuels… qui se codent tout seuls en librairie, module et structure de
   fichiers pour un CPU de BMS embarqué »).
     lib/        one module per KIND of object the design uses : its step, in whole numbers — the same step the browser simulates
     cfg/        one table per object put on the page : its thresholds, delays, scales
     io/         signal ↔ pin : what the software calls each pin of the board
     app/        the step of the software : every object, in the order of the wires ; every signal kept in one structure
     hal/        what touches the microcontroller, as an interface ; a skeleton for the CPU chosen ; a host that a test drives
     test/       the scenario of the design as vectors, and a program that prints the trace
     doc/        object ↔ files ↔ what it must do ↔ what shows it
   Plain C99 : no allocation, fixed-width types, a division that truncates. BACK TO BACK : compiled on a computer with every warning an
   error, the test must print, character for character, what the model gives (cExpected). It is a SKELETON : the code of the registers of
   the CPU is the maker's library, never copied here ; nothing of this has run on a microcontroller, and no claim of certification is made.
   Pure : → [{ name, text }]. Every file carries the note of the platform. */

import { FOOT_NOTE_ASCII } from "../core/brand.js";
import { KINDS, cfgOf, portsOf } from "./sw_objects.js";
import { order, liveWires, simulate, unsure, split } from "./sw_design.js";
import { loadDoc } from "./sw_load.js";

const up = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, "_"), lo = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_");
const head = (name, what) => `/* ${name} — ${what}\n * ${FOOT_NOTE_ASCII}\n * WRITTEN BY THE TOOL from the objects of the design : change the design, not this file.\n * A skeleton : it has run on no microcontroller. */\n`;
const guard = (name, body) => { const g = `${up(name)}_H`; return `#ifndef ${g}\n#define ${g}\n\n${body}\n#endif /* ${g} */\n`; };
const ascii = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[«»]/g, "\"").replace(/[^\x20-\x7e]/g, "-");
const plain = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[«»]/g, "\"").replace(/[^\n\x20-\x7e]/g, "-");      // a whole file : its lines kept

/* ---------- lib/ : the kinds, each written once ---------- */
const LIB = {
  analog_in: { mod: "dw_analog", what: "counts of the converter to a quantity : scale, moving average, plausibility",
    h: `typedef struct { uint8_t bits; int32_t vref_mv; int32_t num; int32_t den; int32_t offset; int32_t lo; int32_t hi; uint8_t n; } dw_analog_cfg_t;
typedef struct { int32_t buf[16]; uint8_t k; int64_t sum; dw_bool primed; int32_t value; dw_bool valid; } dw_analog_t;

void dw_analog_init(dw_analog_t *s);
void dw_analog_step(dw_analog_t *s, const dw_analog_cfg_t *c, uint16_t counts);`,
    c: `void dw_analog_init(dw_analog_t *s)
{
    uint8_t q;
    for (q = 0U; q < 16U; q++) { s->buf[q] = 0; }
    s->k = 0U; s->sum = 0; s->primed = 0U; s->value = 0; s->valid = 0U;
}

void dw_analog_step(dw_analog_t *s, const dw_analog_cfg_t *c, uint16_t counts)
{
    const int32_t full = (int32_t)((1UL << c->bits) - 1UL);
    const int32_t mv = (int32_t)(((int64_t)counts * c->vref_mv) / full);
    const int32_t x = (int32_t)(((int64_t)mv * c->num) / c->den) + c->offset;
    uint8_t q;
    if (s->primed == 0U) { for (q = 0U; q < c->n; q++) { s->buf[q] = x; } s->sum = (int64_t)x * c->n; s->primed = 1U; }
    else { s->sum += (int64_t)x - s->buf[s->k]; s->buf[s->k] = x; }
    s->k = (uint8_t)((s->k + 1U) % c->n);
    s->value = (int32_t)(s->sum / c->n);
    s->valid = (dw_bool)(((s->value >= c->lo) && (s->value <= c->hi)) ? 1U : 0U);
}`,
    cfg: (c) => `{ ${c.bits}U, ${c.vref}, ${c.num}, ${c.den}, ${c.offset}, ${c.lo}, ${c.hi}, ${c.n}U }`, call: (v, i, C) => `dw_analog_step(&${v}, &${C}, (uint16_t)${i.counts});`, outs: { value: "value", valid: "valid" } },
  energy_counter: { mod: "dw_energy", what: "the energy that leaves the pack and the energy that enters it, from current and voltage",
    h: `typedef struct { int64_t a_out; int64_t a_in; int32_t e_out; int32_t e_in; } dw_energy_t;

void dw_energy_init(dw_energy_t *s);
void dw_energy_step(dw_energy_t *s, int32_t i_ma, int32_t v_mv, uint32_t dt_ms);`,
    c: `#define DW_MWMS_PER_MWH ((int64_t)3600000)

void dw_energy_init(dw_energy_t *s) { s->a_out = 0; s->a_in = 0; s->e_out = 0; s->e_in = 0; }

void dw_energy_step(dw_energy_t *s, int32_t i_ma, int32_t v_mv, uint32_t dt_ms)
{
    const int64_t p = ((int64_t)i_ma * v_mv) / 1000;      /* mW */
    int64_t q;
    if (p > 0) { s->a_out += p * (int64_t)dt_ms; q = s->a_out / DW_MWMS_PER_MWH; s->e_out += (int32_t)q; s->a_out -= q * DW_MWMS_PER_MWH; }
    else if (p < 0) { s->a_in += (-p) * (int64_t)dt_ms; q = s->a_in / DW_MWMS_PER_MWH; s->e_in += (int32_t)q; s->a_in -= q * DW_MWMS_PER_MWH; }
    else { /* nothing flows */ }
}`,
    call: (v, i) => `dw_energy_step(&${v}, ${i.i}, ${i.v}, dt_ms);`, outs: { e_out: "e_out", e_in: "e_in" } },
  limit: { mod: "dw_limit", what: "a threshold with a delay and a hysteresis",
    h: `typedef struct { dw_bool above; int32_t trip; int32_t clear; uint32_t delay_ms; } dw_limit_cfg_t;
typedef struct { uint32_t t; dw_bool tripped; } dw_limit_t;

void dw_limit_init(dw_limit_t *s);
void dw_limit_step(dw_limit_t *s, const dw_limit_cfg_t *c, int32_t value, uint32_t dt_ms);`,
    c: `void dw_limit_init(dw_limit_t *s) { s->t = 0U; s->tripped = 0U; }

void dw_limit_step(dw_limit_t *s, const dw_limit_cfg_t *c, int32_t value, uint32_t dt_ms)
{
    const dw_bool over = (dw_bool)((c->above != 0U) ? (value >= c->trip) : (value <= c->trip));
    const dw_bool back = (dw_bool)((c->above != 0U) ? (value <= c->clear) : (value >= c->clear));
    if (s->tripped == 0U) {
        if (over != 0U) { s->t += dt_ms; if (s->t >= c->delay_ms) { s->tripped = 1U; } }
        else { s->t = 0U; }
    } else if (back != 0U) { s->tripped = 0U; s->t = 0U; }
    else { /* stays tripped */ }
}`,
    cfg: (c) => `{ ${c.above ? 1 : 0}U, ${c.trip}, ${c.clear}, ${c.delay}U }`, call: (v, i, C) => `dw_limit_step(&${v}, &${C}, ${i.value}, dt_ms);`, outs: { trip: "tripped" } },
  fault_latch: { mod: "dw_latch", what: "a fault kept until it is acknowledged",
    h: `typedef struct { dw_bool fault; } dw_latch_t;

void dw_latch_init(dw_latch_t *s);
void dw_latch_step(dw_latch_t *s, dw_bool a, dw_bool b, dw_bool c, dw_bool reset);`,
    c: `void dw_latch_init(dw_latch_t *s) { s->fault = 0U; }

void dw_latch_step(dw_latch_t *s, dw_bool a, dw_bool b, dw_bool c, dw_bool reset)
{
    if ((a != 0U) || (b != 0U) || (c != 0U)) { s->fault = 1U; }
    else if (reset != 0U) { s->fault = 0U; }
    else { /* keeps what it holds */ }
}`,
    call: (v, i) => `dw_latch_step(&${v}, ${i.a}, ${i.b}, ${i.c}, ${i.reset});`, outs: { fault: "fault" } },
  module_state: { mod: "dw_state", what: "the state of the module : normal, derated, emergency, stop (contactor open)",
    h: `#define DW_STATE_NORMAL (0)
#define DW_STATE_DERATED (1)
#define DW_STATE_EMERGENCY (2)
#define DW_STATE_STOP (3)

typedef struct { uint32_t t_lost_ms; uint32_t t_emerg_ms; } dw_state_cfg_t;
typedef struct { int32_t state; uint32_t tl; uint32_t te; dw_bool close; dw_bool derate; dw_bool emergency; } dw_state_t;

void dw_state_init(dw_state_t *s);
void dw_state_step(dw_state_t *s, const dw_state_cfg_t *c, dw_bool fault, dw_bool lost, dw_bool warn_a, dw_bool warn_b, dw_bool reset, uint32_t dt_ms);`,
    c: `void dw_state_init(dw_state_t *s) { s->state = DW_STATE_NORMAL; s->tl = 0U; s->te = 0U; s->close = 1U; s->derate = 0U; s->emergency = 0U; }

void dw_state_step(dw_state_t *s, const dw_state_cfg_t *c, dw_bool fault, dw_bool lost, dw_bool warn_a, dw_bool warn_b, dw_bool reset, uint32_t dt_ms)
{
    if (fault != 0U) { s->state = DW_STATE_STOP; s->tl = 0U; s->te = 0U; }
    else if (s->state == DW_STATE_STOP) { if (reset != 0U) { s->state = DW_STATE_NORMAL; s->tl = 0U; s->te = 0U; } }
    else {
        if (lost != 0U) { if (s->tl < c->t_lost_ms) { s->tl += dt_ms; } } else { s->tl = 0U; }
        if (s->tl >= c->t_lost_ms) {
            if (s->state != DW_STATE_EMERGENCY) { s->state = DW_STATE_EMERGENCY; s->te = 0U; }
            else { s->te += dt_ms; if (s->te >= c->t_emerg_ms) { s->state = DW_STATE_STOP; s->te = 0U; } }
        } else { s->state = ((warn_a != 0U) || (warn_b != 0U)) ? DW_STATE_DERATED : DW_STATE_NORMAL; s->te = 0U; }
    }
    s->close = (dw_bool)((s->state != DW_STATE_STOP) ? 1U : 0U);
    s->derate = (dw_bool)((s->state == DW_STATE_DERATED) ? 1U : 0U);
    s->emergency = (dw_bool)((s->state == DW_STATE_EMERGENCY) ? 1U : 0U);
}`,
    cfg: (c) => `{ ${c.t_lost}U, ${c.t_emerg}U }`, call: (v, i, C) => `dw_state_step(&${v}, &${C}, ${i.fault}, ${i.lost}, ${i.warn_a}, ${i.warn_b}, ${i.reset}, dt_ms);`, outs: { state: "state", close: "close", derate: "derate", emergency: "emergency" } },
  contactor: { mod: "dw_contactor", what: "a contactor closed on request, opened on a fault, its auxiliary contact read back",
    h: `typedef struct { uint32_t t_fb_ms; } dw_contactor_cfg_t;
typedef struct { dw_bool drive; uint32_t t; dw_bool fault; } dw_contactor_t;

void dw_contactor_init(dw_contactor_t *s);
void dw_contactor_step(dw_contactor_t *s, const dw_contactor_cfg_t *c, dw_bool request, dw_bool inhibit, dw_bool feedback, uint32_t dt_ms);`,
    c: `void dw_contactor_init(dw_contactor_t *s) { s->drive = 0U; s->t = 0U; s->fault = 0U; }

void dw_contactor_step(dw_contactor_t *s, const dw_contactor_cfg_t *c, dw_bool request, dw_bool inhibit, dw_bool feedback, uint32_t dt_ms)
{
    /* the order given at the step before is what the contact must follow */
    if (feedback != s->drive) { s->t += dt_ms; if (s->t >= c->t_fb_ms) { s->fault = 1U; } }
    else { s->t = 0U; if (request == 0U) { s->fault = 0U; } }
    s->drive = (dw_bool)(((request != 0U) && (inhibit == 0U) && (s->fault == 0U)) ? 1U : 0U);
}`,
    cfg: (c) => `{ ${c.t_fb}U }`, call: (v, i, C) => `dw_contactor_step(&${v}, &${C}, ${i.request}, ${i.inhibit}, ${i.feedback}, dt_ms);`, outs: { drive: "drive", fault: "fault" } },
};
const ctype = (p) => (p.unit === "0/1" ? "dw_bool" : p.unit === "counts" ? "uint16_t" : "int32_t");
const SIZE = { dw_bool: 1, uint8_t: 1, uint16_t: 2, int16_t: 2, int32_t: 4, uint32_t: 4, int64_t: 8, uint64_t: 8 };
/** The size of a C structure as a compiler lays it out with natural alignment : each field on a multiple of its own size, the whole on a
    multiple of its largest field. fields : [{ name, type, n? }] or the text between the braces of a typedef. → { size, align, fields: [{ name, type, n, at, size }] } */
export function structSize(fields) {
  const list = typeof fields === "string" ? fields.split(";").map((f) => f.trim()).filter(Boolean).map((f) => { const m = /^(\w+)\s+(\w+)(?:\[(\d+)\])?$/.exec(f); return m ? { type: m[1], name: m[2], n: m[3] ? Number(m[3]) : 1 } : null; }).filter(Boolean) : fields;
  let at = 0, align = 1; const out = [];
  for (const f of list) { const one = SIZE[f.type] || 4, n = f.n || 1; at = Math.ceil(at / one) * one; out.push({ name: f.name, type: f.type, n, at, size: one * n }); at += one * n; align = Math.max(align, one); }
  return { size: Math.ceil(at / align) * align, align, fields: out };
}
const inBraces = (text, name) => { const m = new RegExp(`typedef struct \\{([^}]*)\\} ${name};`).exec(text || ""); return m ? m[1] : null; };
/** What the software keeps in memory, read from the very structures the files declare : for each object its working memory (RAM) and its table
    of settings (constant, in flash) ; and the one structure of every signal. → { objects: [{ id, name, kind, mod, ram, rom, vars: [{ name, type, n }] }], signals: { size, fields }, ram, rom } */
export function memoryPlan(d) {
  const P = plan(d), objects = P.objs.filter((x) => LIB[x.kind]).map((x) => { const L = LIB[x.kind], st = structSize(inBraces(L.h, `${L.mod}_t`) || ""), cf = inBraces(L.h, `${L.mod}_cfg_t`);
    return { id: x.id, name: x.name, kind: x.kind, mod: L.mod, ram: st.size, rom: cf ? structSize(cf).size : 0, vars: st.fields.map((f) => ({ name: f.name, type: f.type, n: f.n })) }; });
  const signals = structSize(P.outs.map((x) => ({ name: x.name, type: ctype(x.port) })));
  return { objects, signals, ram: objects.reduce((n, o) => n + o.ram, 0) + signals.size, rom: objects.reduce((n, o) => n + o.rom, 0) };
}

/** What the design is, read once for the writers. */
function plan(d) {
  const ord = order(d), O = Object.fromEntries((d.objects || []).map((o) => [o.id, o])), src = Object.fromEntries(liveWires(d).map((w) => [w.to, w.from])), objs = ord.ids.map((id) => O[id]);
  const sig = (ref) => { const [id, key] = split(ref); return `bms.${lo(id)}_${lo(key)}`; }, outs = objs.flatMap((o) => portsOf(o).out.map((p) => ({ obj: o, port: p, ref: `${o.id}.${p.key}`, name: `${lo(o.id)}_${lo(p.key)}` })));
  return { ord, O, src, objs, sig, outs, kinds: [...new Set(objs.map((o) => o.kind))].filter((k) => LIB[k]) };
}
/** The values each pin driven by points takes, step after step, and the pins that follow an output. */
function vectors(d) {
  const sc = d.scenario || { steps: 0, pins: {} }, R = simulate(d, sc), P = plan(d), fixed = [], follow = [];
  for (const o of P.objs) { const K = KINDS[o.kind]; if (K.pin !== "ain" && K.pin !== "din") continue; const s = (sc.pins || {})[o.id] || { points: [] }, key = K.ports.out[0].key;
    if (s.follows) follow.push({ obj: o, of: P.O[s.follows], lag: Math.round((s.delay || 0) / (d.period || 10)), stuck: s.stuck }); else fixed.push({ obj: o, values: R.ports[`${o.id}.${key}`] }); }
  return { R, steps: sc.steps || 0, fixed, follow };
}
/** The trace the test must print, from the MODEL : a line of names, then a line per step. */
export function cExpected(d) { const P = plan(d), V = vectors(d); return [["t_ms", ...P.outs.map((x) => x.name)].join(";"), ...V.R.t.map((t, k) => [t, ...P.outs.map((x) => V.R.ports[x.ref][k])].join(";"))].join("\n") + "\n"; }
/** What an object must do, as one sentence one can test. */
export function requirement(d, o) {
  const c = cfgOf(o), P = plan(d), from = (key) => { const r = P.src[`${o.id}.${key}`]; return r ? P.O[split(r)[0]].name : "nothing"; };
  if (o.kind === "analog_in") return `${o.name} shall give the value of ${from("counts")} in ${c.unit} (counts x ${c.vref} mV / ${(1 << c.bits) - 1} x ${c.num} / ${c.den} + ${c.offset}), averaged over ${c.n} sample(s), and say it valid between ${c.lo} and ${c.hi} ${c.unit}.`;
  if (o.kind === "limit") return `${o.name} shall trip when ${from("value")} stays ${c.above ? "at or above" : "at or below"} ${c.trip} ${c.unit} for ${c.delay} ms, and clear when it is back ${c.above ? "at or below" : "at or above"} ${c.clear} ${c.unit}.`;
  if (o.kind === "fault_latch") return `${o.name} shall hold a fault as soon as one of its inputs is 1, and release it only on a reset with every input back to 0.`;
  if (o.kind === "module_state") return `${o.name} shall be in STOP, the contactor open, as soon as ${from("fault")} is 1, and leave it only on a reset with no fault ; be in EMERGENCY when ${from("lost")} has held for ${c.t_lost} ms, and in STOP when the emergency lasts ${c.t_emerg} ms ; else be DERATED while ${from("warn_a")} or ${from("warn_b")} holds, and NORMAL otherwise.`;
  if (o.kind === "contactor") return `${o.name} shall close on a request, open on an inhibit, and raise a fault when its feedback has not followed the order for ${c.t_fb} ms.`;
  if (o.kind === "energy_counter") return `${o.name} shall count, in mWh, the energy that leaves the pack and the energy that enters it, from ${from("i")} and ${from("v")}.`;
  return `${o.name} is a pin of the microcontroller (${KINDS[o.kind].label}).`;
}

/** The files of the design. o : { cpu (a CPU sheet : sw/sw_cpu.js) } → [{ name, text }] */
export function cFiles(d, o = {}) {
  const P = plan(d), V = vectors(d), cpu = o.cpu || { key: "generic", name: "generic CPU", notes: [] }, dir = lo(cpu.key || "generic"), files = [], put = (name, text) => files.push({ name: `bms/${name}`, text: plain(text) });
  const pending = unsure(d), warn = pending.length ? `/* EXAMPLE VALUES NOT CONFIRMED BY THE PROJECT : ${pending.length} — ${ascii(pending.slice(0, 6).map((u) => `${u.obj}.${u.key}`).join(", "))}${pending.length > 6 ? ", ..." : ""} */\n` : "";
  put("lib/dw_types.h", head("dw_types.h", "the types every module shares") + guard("dw_types", `#include <stdint.h>\n\ntypedef uint8_t dw_bool;      /* 0 or 1 */\n`));
  for (const k of P.kinds) { const L = LIB[k]; put(`lib/${L.mod}.h`, head(`${L.mod}.h`, L.what) + guard(L.mod, `#include "dw_types.h"\n\n${L.h}\n`)); put(`lib/${L.mod}.c`, head(`${L.mod}.c`, L.what) + `#include "${L.mod}.h"\n\n${L.c}\n`); }
  /* cfg/ : a table per object that has something to set */
  const withCfg = P.objs.filter((x) => LIB[x.kind] && LIB[x.kind].cfg), cname = (x) => `BMS_CFG_${up(x.id)}`;
  put("cfg/bms_cfg.h", head("bms_cfg.h", "what each object of the design is set to") + guard("bms_cfg", `${[...new Set(withCfg.map((x) => `#include "${LIB[x.kind].mod}.h"`))].join("\n")}\n\n#define BMS_PERIOD_MS (${d.period || 10}U)      /* how often the step runs */\n\n${withCfg.map((x) => `extern const ${LIB[x.kind].mod}_cfg_t ${cname(x)};      /* ${ascii(x.name)} */`).join("\n")}\n`));
  put("cfg/bms_cfg.c", head("bms_cfg.c", "what each object of the design is set to") + warn + `#include "bms_cfg.h"\n\n${withCfg.map((x) => `/* ${ascii(requirement(d, x))} */\nconst ${LIB[x.kind].mod}_cfg_t ${cname(x)} = ${LIB[x.kind].cfg(cfgOf(x))};`).join("\n\n")}\n`);
  /* io/ : the pins, under the name the software knows them by */
  const pins = P.objs.filter((x) => KINDS[x.kind].pin), pname = (x) => `BMS_${KINDS[x.kind].pin === "ain" ? "ADC" : "PIN"}_${up(x.id)}`, pval = (x) => (KINDS[x.kind].pin === "ain" ? cfgOf(x).channel : cfgOf(x).pin);
  put("io/bms_io.h", head("bms_io.h", "signal <-> pin : what the software calls each pin of the board") + guard("bms_io", `${pins.map((x) => `#define ${pname(x)} (${pval(x)}U)      /* ${ascii(x.name)} — ${KINDS[x.kind].label} */`).join("\n")}\n`));
  /* hal/ : what touches the microcontroller */
  put("hal/hal.h", head("hal.h", "what touches the microcontroller : the only functions the project writes for its CPU") + guard("hal", `#include "dw_types.h"\n\nvoid hal_init(void);\nuint16_t hal_adc_read(uint8_t channel);      /* counts, 0 to full scale */\ndw_bool hal_gpio_read(uint8_t pin);\nvoid hal_gpio_write(uint8_t pin, dw_bool level);\n`));
  put(`hal/${dir}/hal_${dir}.c`, head(`hal_${dir}.c`, `the hardware layer for ${ascii(cpu.name)} : TO BE WRITTEN with the library of its maker`) + `#include "hal.h"\n\n${(cpu.notes || []).map((n) => `/* ${ascii(n)} */`).join("\n")}${(cpu.notes || []).length ? "\n\n" : ""}void hal_init(void)\n{\n    /* TODO : clocks, the converter, the directions of the pins — and the self-tests the CPU asks for at start-up */\n}\n\nuint16_t hal_adc_read(uint8_t channel)\n{\n    (void)channel;      /* TODO : start a conversion of this channel, return its counts */\n    return 0U;\n}\n\ndw_bool hal_gpio_read(uint8_t pin)\n{\n    (void)pin;      /* TODO */\n    return 0U;\n}\n\nvoid hal_gpio_write(uint8_t pin, dw_bool level)\n{\n    (void)pin; (void)level;      /* TODO */\n}\n`);
  put("hal/host/hal_host.c", head("hal_host.c", "the hardware layer of a computer : a test sets what the pins read, and reads what they are given") + `#include "hal.h"\n\nuint16_t host_adc[64];\ndw_bool host_in[256];\ndw_bool host_out[256];\n\nvoid hal_init(void) { }\nuint16_t hal_adc_read(uint8_t channel) { return host_adc[channel % 64U]; }\ndw_bool hal_gpio_read(uint8_t pin) { return host_in[pin]; }\nvoid hal_gpio_write(uint8_t pin, dw_bool level) { host_out[pin] = level; }\n`);
  /* app/ : every object, in the order of the wires */
  const svar = (x) => `s_${lo(x.id)}`, steps = P.objs.map((x) => { const K = KINDS[x.kind], L = LIB[x.kind], inp = Object.fromEntries(K.ports.in.map((p) => [p.key, P.src[`${x.id}.${p.key}`] ? P.sig(P.src[`${x.id}.${p.key}`]) : "0U"]));
    if (K.pin === "ain") return `    bms.${lo(x.id)}_counts = hal_adc_read(${pname(x)});`; if (K.pin === "din") return `    bms.${lo(x.id)}_level = hal_gpio_read(${pname(x)});`; if (K.pin === "dout") return `    hal_gpio_write(${pname(x)}, ${inp.level});`;
    return `    ${L.call(svar(x), inp, cname(x))}      /* ${ascii(x.name)} */\n${Object.entries(L.outs).map(([key, field]) => `    bms.${lo(x.id)}_${lo(key)} = ${svar(x)}.${field};`).join("\n")}`; });
  put("app/bms_app.h", head("bms_app.h", "the step of the software, and every signal of the design") + guard("bms_app", `#include "dw_types.h"\n\n/* every signal : what an object gives. A test, a bus, a display reads them here. */\ntypedef struct {\n${P.outs.map((x) => `    ${ctype(x.port)} ${x.name};      /* ${ascii(x.obj.name)} : ${x.port.label}, ${x.port.unit} */`).join("\n")}\n} bms_signals_t;\n\nextern bms_signals_t bms;\n\nvoid bms_init(void);\nvoid bms_step(uint32_t dt_ms);      /* to be called every BMS_PERIOD_MS */\n`));
  put("app/bms_app.c", head("bms_app.c", "the step of the software : every object, in the order of the wires") + warn + `#include "bms_app.h"\n#include "bms_cfg.h"\n#include "bms_io.h"\n#include "hal.h"\n${P.kinds.map((k) => `#include "${LIB[k].mod}.h"`).join("\n")}\n\nbms_signals_t bms;\n\n${P.objs.filter((x) => LIB[x.kind]).map((x) => `static ${LIB[x.kind].mod}_t ${svar(x)};`).join("\n")}\n\nvoid bms_init(void)\n{\n${P.outs.map((x) => `    bms.${x.name} = 0;`).join("\n")}\n${P.objs.filter((x) => LIB[x.kind]).map((x) => `    ${LIB[x.kind].mod}_init(&${svar(x)});`).join("\n")}\n    hal_init();\n}\n\nvoid bms_step(uint32_t dt_ms)\n{\n${steps.join("\n")}\n${P.kinds.some((k) => /dt_ms/.test(LIB[k].call("s", {}, "c"))) ? "" : "    (void)dt_ms;\n"}}\n`);
  /* test/ : the scenario as vectors, and what prints the trace */
  const arr = (f) => `static const ${KINDS[f.obj.kind].pin === "ain" ? "uint16_t" : "dw_bool"} V_${up(f.obj.id)}[STEPS] = { ${f.values.join(", ")} };`;
  put("test/bms_test.c", head("bms_test.c", "the scenario of the design, replayed : it must print what the model of the tool gives") + `#include <stdio.h>\n#include "bms_app.h"\n#include "bms_cfg.h"\n#include "bms_io.h"\n\n#define STEPS (${Math.max(1, V.steps)}U)\n\nextern uint16_t host_adc[64];\nextern dw_bool host_in[256];\nextern dw_bool host_out[256];\n\n${V.fixed.map(arr).join("\n")}\n${V.follow.map((f) => `static dw_bool H_${up(f.obj.id)}[STEPS];      /* what ${ascii(f.of.name)} was given, step after step */`).join("\n")}\n\nint main(void)\n{\n    uint32_t k;\n    bms_init();\n    printf("${["t_ms", ...P.outs.map((x) => x.name)].join(";")}\\n");\n    for (k = 0U; k < STEPS; k++) {\n${V.fixed.map((f) => `        ${KINDS[f.obj.kind].pin === "ain" ? `host_adc[${pname(f.obj)}]` : `host_in[${pname(f.obj)}]`} = V_${up(f.obj.id)}[k];`).join("\n")}\n${V.follow.map((f) => `        host_in[${pname(f.obj)}] = ${f.stuck === 0 || f.stuck === 1 ? `${f.stuck}U` : `(k >= ${f.lag + 1}U) ? H_${up(f.obj.id)}[k - ${f.lag + 1}U] : 0U`};      /* the contact follows the order, ${f.lag} step(s) late */`).join("\n")}\n        bms_step(BMS_PERIOD_MS);\n${V.follow.map((f) => `        H_${up(f.obj.id)}[k] = host_out[${pname(f.of)}];`).join("\n")}\n        printf("%lu${P.outs.map(() => ";%ld").join("")}\\n", (unsigned long)(k * BMS_PERIOD_MS)${P.outs.map((x) => `, (long)bms.${x.name}`).join("")});\n    }\n    return 0;\n}\n`);
  put("test/expected.txt", cExpected(d));
  /* doc/ */
  const rows = P.objs.map((x) => { const L = LIB[x.kind]; return `| ${ascii(x.name)} | ${KINDS[x.kind].label} | ${L ? `lib/${L.mod}.c` : "hal/hal.h"} | ${L && L.cfg ? cname(x) : KINDS[x.kind].pin ? pname(x) : "-"} | ${ascii(requirement(d, x))} |`; });
  put("doc/TRACE.md", `# ${ascii(d.name || d.id)} - object <-> files <-> what it must do\n\n${FOOT_NOTE_ASCII}\n\n| Object | Kind | Module | Table / pin | What it must do |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\nThe test (test/bms_test.c) replays the scenario of the design and prints every signal at every step ; test/expected.txt is what the MODEL of the tool gives for the same scenario. The two must be the same, character for character.\n`);
  put("doc/LOADING.md", loadDoc(cpu, ascii(d.name || d.id)));      // from these files to the microcontroller, step by step — what the maker of the CPU publishes, where it was read
  put("README.md", `# ${ascii(d.name || d.id)}\n\n${FOOT_NOTE_ASCII}\n\nWritten by the tool from ${P.objs.length} objects and ${liveWires(d).length} wires. CPU chosen : ${ascii(cpu.name)}. Period of the step : ${d.period || 10} ms.\n${pending.length ? `\n**${pending.length} value(s) are examples proposed by the tool and not confirmed by the project.**\n` : ""}\n- lib/ : one module per kind of object (${P.kinds.map((k) => LIB[k].mod).join(", ")})\n- cfg/ : one table per object\n- io/ : signal <-> pin\n- app/ : the step, every object in the order of the wires\n- hal/ : the interface to the microcontroller ; hal/${dir}/ is to be written with the library of the maker ; hal/host/ lets a computer run the test\n- test/ : the scenario replayed ; doc/ : object <-> files <-> what it must do\n\nBack to back, on a computer :\n\n    cc -std=c99 -Wall -Wextra -pedantic -Werror -Ilib -Icfg -Iio -Iapp -Ihal lib/*.c cfg/*.c app/*.c hal/host/*.c test/*.c -o bms_test\n    ./bms_test > got.txt && cmp got.txt test/expected.txt\n\nThis is a SKELETON. It has run on no microcontroller. No claim of certification is made : under DO-178C or ISO 26262 a code generator must itself be qualified.\n`);
  return files;
}
export { LIB };
