/* DynamiteOrbit.ai — Logiciel : the C of the CONVENTIONAL blocks (sw/sw_kinds_more.js), written once — the same step, number for number, as
   the browser simulates. Joined to the library of sw/sw_c.js (LIB) ; a block without its entry here could not be written, and a test holds
   that every kind has one. Plain C99 : no allocation, fixed-width types, a division that truncates toward zero. */

import { LOGIC_OPS } from "./sw_kinds_more.js";

export const LIB_MORE = {
  debounce: { mod: "dw_debounce", what: "a logic input believed only once it has held",
    h: `typedef struct { uint32_t t_ms; } dw_debounce_cfg_t;
typedef struct { dw_bool out; uint32_t t; } dw_debounce_t;

void dw_debounce_init(dw_debounce_t *s);
void dw_debounce_step(dw_debounce_t *s, const dw_debounce_cfg_t *c, dw_bool in, uint32_t dt_ms);`,
    c: `void dw_debounce_init(dw_debounce_t *s) { s->out = 0U; s->t = 0U; }

void dw_debounce_step(dw_debounce_t *s, const dw_debounce_cfg_t *c, dw_bool in, uint32_t dt_ms)
{
    const dw_bool x = (dw_bool)((in != 0U) ? 1U : 0U);
    if (x != s->out) { s->t += dt_ms; if (s->t >= c->t_ms) { s->out = x; s->t = 0U; } }
    else { s->t = 0U; }
}`,
    cfg: (c) => `{ ${c.t}U }`, call: (v, i, C) => `dw_debounce_step(&${v}, &${C}, ${i.in}, dt_ms);`, outs: { out: "out" } },
  on_delay: { mod: "dw_ton", what: "an on-delay timer (TON)",
    h: `typedef struct { uint32_t pt_ms; } dw_ton_cfg_t;
typedef struct { uint32_t et; dw_bool q; } dw_ton_t;

void dw_ton_init(dw_ton_t *s);
void dw_ton_step(dw_ton_t *s, const dw_ton_cfg_t *c, dw_bool in, uint32_t dt_ms);`,
    c: `void dw_ton_init(dw_ton_t *s) { s->et = 0U; s->q = 0U; }

void dw_ton_step(dw_ton_t *s, const dw_ton_cfg_t *c, dw_bool in, uint32_t dt_ms)
{
    if (in != 0U) { if (s->et < c->pt_ms) { s->et += dt_ms; } }
    else { s->et = 0U; }
    s->q = (dw_bool)(((in != 0U) && (s->et >= c->pt_ms)) ? 1U : 0U);
}`,
    cfg: (c) => `{ ${c.pt}U }`, call: (v, i, C) => `dw_ton_step(&${v}, &${C}, ${i.in}, dt_ms);`, outs: { q: "q" } },
  logic: { mod: "dw_logic", what: "AND, OR, XOR or NOT of two decisions",
    h: `#define DW_LOGIC_AND (0U)
#define DW_LOGIC_OR (1U)
#define DW_LOGIC_XOR (2U)
#define DW_LOGIC_NOT (3U)

typedef struct { uint8_t op; } dw_logic_cfg_t;
typedef struct { dw_bool y; } dw_logic_t;

void dw_logic_init(dw_logic_t *s);
void dw_logic_step(dw_logic_t *s, const dw_logic_cfg_t *c, dw_bool a, dw_bool b);`,
    c: `void dw_logic_init(dw_logic_t *s) { s->y = 0U; }

void dw_logic_step(dw_logic_t *s, const dw_logic_cfg_t *c, dw_bool a, dw_bool b)
{
    const uint8_t x = (uint8_t)((a != 0U) ? 1U : 0U);
    const uint8_t z = (uint8_t)((b != 0U) ? 1U : 0U);
    if (c->op == DW_LOGIC_AND) { s->y = (dw_bool)(x & z); }
    else if (c->op == DW_LOGIC_OR) { s->y = (dw_bool)(x | z); }
    else if (c->op == DW_LOGIC_XOR) { s->y = (dw_bool)(x ^ z); }
    else { s->y = (dw_bool)(1U - x); }
}`,
    cfg: (c) => `{ ${Math.max(0, LOGIC_OPS.indexOf(c.op))}U }`, call: (v, i, C) => `dw_logic_step(&${v}, &${C}, ${i.a}, ${i.b});`, outs: { y: "y" } },
  pid: { mod: "dw_pi", what: "a PI regulator in whole numbers, its integral clamped (anti-windup)",
    h: `typedef struct { int32_t kp; int32_t ki; int32_t umin; int32_t umax; } dw_pi_cfg_t;
typedef struct { int64_t acc; int32_t u; } dw_pi_t;

void dw_pi_init(dw_pi_t *s);
void dw_pi_step(dw_pi_t *s, const dw_pi_cfg_t *c, int32_t sp, int32_t pv, uint32_t dt_ms);`,
    c: `void dw_pi_init(dw_pi_t *s) { s->acc = 0; s->u = 0; }

void dw_pi_step(dw_pi_t *s, const dw_pi_cfg_t *c, int32_t sp, int32_t pv, uint32_t dt_ms)
{
    const int64_t e = (int64_t)sp - (int64_t)pv;
    const int64_t lo = (int64_t)c->umin * 1000000;
    const int64_t hi = (int64_t)c->umax * 1000000;
    int64_t u;
    s->acc += (int64_t)c->ki * e * (int64_t)dt_ms;
    if (s->acc < lo) { s->acc = lo; } else if (s->acc > hi) { s->acc = hi; } else { /* inside */ }
    u = (((int64_t)c->kp * e) / 1000) + (s->acc / 1000000);
    if (u < c->umin) { u = c->umin; } else if (u > c->umax) { u = c->umax; } else { /* inside */ }
    s->u = (int32_t)u;
}`,
    cfg: (c) => `{ ${c.kp}, ${c.ki}, ${c.umin}, ${c.umax} }`, call: (v, i, C) => `dw_pi_step(&${v}, &${C}, ${i.sp}, ${i.pv}, dt_ms);`, outs: { u: "u" } },
  ramp: { mod: "dw_ramp", what: "a rate limiter : a value that may not jump",
    h: `typedef struct { int32_t rate; } dw_ramp_cfg_t;
typedef struct { int32_t y; dw_bool primed; } dw_ramp_t;

void dw_ramp_init(dw_ramp_t *s);
void dw_ramp_step(dw_ramp_t *s, const dw_ramp_cfg_t *c, int32_t x, uint32_t dt_ms);`,
    c: `void dw_ramp_init(dw_ramp_t *s) { s->y = 0; s->primed = 0U; }

void dw_ramp_step(dw_ramp_t *s, const dw_ramp_cfg_t *c, int32_t x, uint32_t dt_ms)
{
    const int64_t m = ((int64_t)c->rate * (int64_t)dt_ms) / 1000;
    int64_t d;
    if (s->primed == 0U) { s->y = x; s->primed = 1U; }
    else {
        d = (int64_t)x - (int64_t)s->y;
        if (d > m) { d = m; } else if (d < -m) { d = -m; } else { /* inside */ }
        s->y = (int32_t)((int64_t)s->y + d);
    }
}`,
    cfg: (c) => `{ ${c.rate} }`, call: (v, i, C) => `dw_ramp_step(&${v}, &${C}, ${i.x}, dt_ms);`, outs: { y: "y" } },
};
/** What a conventional block must do, as one sentence one can test. from(key) : the name of what feeds an input. → text or null */
export function moreRequirement(o, c, from) {
  if (o.kind === "debounce") return `${o.name} shall change its output only when ${from("in")} has held its new value for ${c.t} ms.`;
  if (o.kind === "on_delay") return `${o.name} shall set its output when ${from("in")} has been 1 for ${c.pt} ms, and clear it as soon as ${from("in")} is 0.`;
  if (o.kind === "logic") return c.op === "NOT" ? `${o.name} shall give the inverse of ${from("a")}.` : `${o.name} shall give ${from("a")} ${c.op} ${from("b")}.`;
  if (o.kind === "pid") return `${o.name} shall command, in per mille between ${c.umin} and ${c.umax}, ${c.kp}/1000 of the error between ${from("sp")} and ${from("pv")} (${c.unit}) plus its integral at ${c.ki}/1000 per second, the integral held within the same bounds.`;
  if (o.kind === "ramp") return `${o.name} shall follow ${from("x")} without changing by more than ${c.rate} ${c.unit} per second.`;
  return null;
}
