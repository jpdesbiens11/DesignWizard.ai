/* DesignOrbit.ai — FeatureScript export (see featurescript.js), expressions: translation of the part-language
   expressions into FeatureScript arithmetic, and the small symbolic values the generator computes with.
   A symbolic value is {fs, prec, v, c} = FeatureScript text + its operator precedence + the numeric value today (to take
   the decisions the builder takes: signs, pattern kinds) + "is a constant". In the generated feature every quantity is a
   plain number in millimetres (degrees for angles); the unit is applied at the last moment (`expr * millimeter`). */

import { ExprError } from "./expr.js";

/** Thrown when an element of the part cannot be converted: it is listed in `skipped` with this message as the reason. */
class Skip extends Error {}

const P_ATOM = 6, P_POW = 5, P_MUL = 3, P_ADD = 2, P_NEG = 1, P_LOW = 0;
const wrap = (x, min) => (x.prec >= min ? x.fs : `(${x.fs})`);

/** Plain decimal text of a number (FeatureScript literal): no exponent, no "-0", at most `digits` decimals. */
function fnum(v, digits = 6) {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Skip("valeur non finie");
  const k = 10 ** digits, r = Math.round(v * k) / k;
  let s = String(Object.is(r, -0) ? 0 : r);
  if (/e/i.test(s)) s = r.toFixed(digits).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

/* Same tokens as expr.js (its tokenizer is private): numbers, identifiers, + - * / % ^ ( ) , and comparisons. */
function tokenize(src) {
  const out = [], re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_.]*)|(<=|>=|==|!=|[-+*/%^(),<>]))/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new ExprError(`Expression « ${src} » : caractère inattendu « ${src[pos]} ».`);
    }
    pos = re.lastIndex;
    out.push(m[1] !== undefined ? { t: "num", v: parseFloat(m[1]) } : m[2] !== undefined ? { t: "id", v: m[2] } : { t: "op", v: m[3] });
  }
  return out;
}

/** Syntax tree of an expression, with the grammar of expr.js (comparison > sum > term > unary > power > primary). */
function parseExpr(src) {
  const toks = tokenize(String(src));
  let i = 0;
  const eat = (v) => (toks[i] && toks[i].t === "op" && toks[i].v === v ? (i++, true) : false);
  const need = (v) => { if (!eat(v)) throw new ExprError(`Expression « ${src} » : « ${v} » attendu.`); };
  const primary = () => {
    const t = toks[i++];
    if (!t) throw new ExprError(`Expression « ${src} » incomplète.`);
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "id") {
      if (!eat("(")) return { k: "id", v: t.v };
      const args = [];
      if (!eat(")")) { do { args.push(comparison()); } while (eat(",")); need(")"); }
      return { k: "call", f: t.v, args };
    }
    if (t.v === "(") { const e = comparison(); need(")"); return e; }
    if (t.v === "-") return { k: "neg", a: unary() };
    if (t.v === "+") return unary();
    throw new ExprError(`Expression « ${src} » : « ${t.v} » inattendu.`);
  };
  const power = () => { const b = primary(); return eat("^") ? { k: "bin", op: "^", a: b, b: unary() } : b; };
  const unary = () => (eat("-") ? { k: "neg", a: unary() } : eat("+") ? unary() : power());
  const term = () => { let v = unary(); for (;;) { const op = ["*", "/", "%"].find(eat); if (!op) return v; v = { k: "bin", op, a: v, b: unary() }; } };
  const sum = () => { let v = term(); for (;;) { const op = ["+", "-"].find(eat); if (!op) return v; v = { k: "bin", op, a: v, b: term() }; } };
  const comparison = () => {
    const a = sum(), t = toks[i];
    if (t && t.t === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(t.v)) { i++; return { k: "cmp", op: t.v, a, b: sum() }; }
    return a;
  };
  if (!toks.length) throw new ExprError("Expression vide.");
  const tree = comparison();
  if (i < toks.length) throw new ExprError(`Expression « ${src} » : « ${toks[i].v} » en trop.`);
  return tree;
}

/** FeatureScript text of a tree: {fs, prec, bool}. Angles of sin / cos / tan are degrees in the part language. */
function printAst(n, rename) {
  const num = (x) => { const r = printAst(x, rename); return r.bool ? { fs: `(${r.fs} ? 1 : 0)`, prec: P_ATOM } : r; };
  const arg = (x) => num(x).fs;
  switch (n.k) {
    case "num": return { fs: fnum(n.v, 9), prec: P_ATOM };
    case "id": return { fs: n.v === "pi" || n.v === "PI" ? "PI" : rename(n.v), prec: P_ATOM };
    case "neg": return { fs: `-${wrap(num(n.a), P_ATOM)}`, prec: P_NEG };
    case "cmp": return { fs: `${wrap(num(n.a), P_NEG)} ${n.op} ${wrap(num(n.b), P_NEG)}`, prec: P_LOW, bool: true };
    case "bin": {
      const a = num(n.a), b = num(n.b);
      if (n.op === "^") return { fs: `${wrap(a, P_ATOM)} ^ ${wrap(b, P_ATOM)}`, prec: P_POW };
      if (n.op === "+") return { fs: `${wrap(a, P_NEG)} + ${wrap(b, P_ADD)}`, prec: P_ADD };
      if (n.op === "-") return { fs: `${wrap(a, P_NEG)} - ${wrap(b, P_MUL)}`, prec: P_ADD };
      return { fs: `${wrap(a, P_MUL)} ${n.op} ${wrap(b, P_POW)}`, prec: P_MUL };
    }
    case "call": {
      const a = n.args, f = n.f, need = (k) => { if (a.length !== k) throw new ExprError(`Fonction « ${f} » : ${k} argument(s) attendu(s), ${a.length} reçu(s).`); };
      const atom = (fs) => ({ fs, prec: P_ATOM });
      if (f === "min" || f === "max") {
        if (!a.length) throw new ExprError(`Fonction « ${f} » sans argument.`);
        return a.length === 1 ? num(a[0]) : atom(a.slice(1).reduce((acc, x) => `${f}(${acc}, ${arg(x)})`, arg(a[0])));
      }
      if (["abs", "sqrt", "floor", "ceil", "round"].includes(f)) { need(1); return atom(`${f}(${arg(a[0])})`); }
      if (["sin", "cos", "tan"].includes(f)) { need(1); return atom(`${f}(${wrap(num(a[0]), P_MUL)} * degree)`); }
      if (["asin", "acos", "atan"].includes(f)) { need(1); return { fs: `${f}(${arg(a[0])}) / degree`, prec: P_MUL }; }
      if (f === "atan2") { need(2); return { fs: `atan2(${arg(a[0])}, ${arg(a[1])}) / degree`, prec: P_MUL }; }
      if (f === "hypot") { if (!a.length) throw new ExprError("Fonction « hypot » sans argument."); return atom(`sqrt(${a.map((x) => { const w = wrap(num(x), P_ATOM); return `${w} * ${w}`; }).join(" + ")})`); }
      if (f === "pow") { need(2); return { fs: `${wrap(num(a[0]), P_ATOM)} ^ ${wrap(num(a[1]), P_ATOM)}`, prec: P_POW }; }
      if (f === "clamp") { need(3); return atom(`min(max(${arg(a[0])}, ${arg(a[1])}), ${arg(a[2])})`); }
      if (f === "if") {
        need(3);
        const c = printAst(a[0], rename), cond = c.bool ? c.fs : `${wrap(c, P_NEG)} != 0`;
        return { fs: `${cond} ? ${wrap(num(a[1]), P_NEG)} : ${wrap(num(a[2]), P_NEG)}`, prec: P_LOW };
      }
      throw new ExprError(`Fonction « ${f} » sans équivalent FeatureScript.`);
    }
    default: throw new ExprError("Expression non comprise.");
  }
}

/**
 * Translate an expression of the part language into FeatureScript arithmetic on plain numbers (millimetres, degrees).
 * Same operators; min max abs sqrt floor ceil round kept; sin / cos / tan get `* degree`; asin / acos / atan / atan2 are
 * divided by `degree`; hypot, pow, clamp are expanded; `if(c, a, b)` becomes `(c ? a : b)`; `pi` becomes `PI`.
 * The result is parenthesised unless it is a single operand, so it can be dropped anywhere:
 *   "L/2 - 10" -> "(L / 2 - 10)"   "max(t, 2)" -> "max(t, 2)"   "sin(30)" -> "sin(30 * degree)"
 * @param src     expression (string) or number
 * @param rename  optional function (parameter name) -> FeatureScript identifier (default: unchanged)
 */
export function exprToFeatureScript(src, rename = (name) => name) {
  if (typeof src === "number") { const s = fnum(src, 9); return s.startsWith("-") ? `(${s})` : s; }
  if (typeof src === "boolean") return src ? "1" : "0";
  if (typeof src !== "string") throw new ExprError("Expression attendue (texte ou nombre).");
  const r = printAst(parseExpr(src), rename), n = r.bool ? { fs: `${r.fs} ? 1 : 0`, prec: P_LOW } : r;
  return n.prec >= P_ATOM ? n.fs : `(${n.fs})`;
}

/* ---------- symbolic values: FeatureScript text + value today ---------- */

const K = (v) => { const fs = fnum(v); return { fs, prec: fs.startsWith("-") ? P_NEG : P_ATOM, v, c: true }; };
const V = (name, v = NaN) => ({ fs: name, prec: P_ATOM, v, c: false });
const isSym = (x) => x !== null && typeof x === "object" && typeof x.fs === "string" && "prec" in x;
const is0 = (x) => x.c && x.v === 0, is1 = (x) => x.c && x.v === 1;
function neg(a) { return a.c ? K(-a.v) : a.negOf ? a.negOf : { fs: `-${wrap(a, P_ATOM)}`, prec: P_NEG, v: -a.v, c: false, negOf: a }; }
function add(a, b) {
  if (a.c && b.c) return K(a.v + b.v);
  if (is0(a)) return b;
  if (is0(b)) return a;
  if (b.c && b.v < 0) return sub(a, K(-b.v));
  if (b.negOf) return sub(a, b.negOf);
  return { fs: `${wrap(a, P_NEG)} + ${wrap(b, P_ADD)}`, prec: P_ADD, v: a.v + b.v, c: false };
}
function sub(a, b) {
  if (a.c && b.c) return K(a.v - b.v);
  if (is0(b)) return a;
  if (is0(a)) return neg(b);
  if (b.c && b.v < 0) return add(a, K(-b.v));
  if (b.negOf) return add(a, b.negOf);
  return { fs: `${wrap(a, P_NEG)} - ${wrap(b, P_MUL)}`, prec: P_ADD, v: a.v - b.v, c: false };
}
function mul(a, b) {
  if (a.c && b.c) return K(a.v * b.v);
  if (is0(a) || is0(b)) return K(0);
  if (is1(a)) return b;
  if (is1(b)) return a;
  if (a.c && a.v < 0) return neg(mul(K(-a.v), b));                // keep the sign outside: "x - 0.5 * w" reads better than "x + (-0.5) * w"
  if (b.c && b.v < 0) return neg(mul(a, K(-b.v)));
  if (a.negOf) return neg(mul(a.negOf, b));
  if (b.negOf) return neg(mul(a, b.negOf));
  return { fs: `${wrap(a, P_MUL)} * ${wrap(b, P_POW)}`, prec: P_MUL, v: a.v * b.v, c: false };
}
function div(a, b) {
  if (a.c && b.c) return K(a.v / b.v);
  if (is1(b)) return a;
  if (is0(a)) return K(0);
  return { fs: `${wrap(a, P_MUL)} / ${wrap(b, P_POW)}`, prec: P_MUL, v: a.v / b.v, c: false };
}
const fn1 = (name, js, a) => (a.c ? K(js(a.v)) : { fs: `${name}(${a.fs})`, prec: P_ATOM, v: js(a.v), c: false });
const fn2 = (name, js, a, b) => (a.c && b.c ? K(js(a.v, b.v)) : { fs: `${name}(${a.fs}, ${b.fs})`, prec: P_ATOM, v: js(a.v, b.v), c: false });
const minS = (a, b) => fn2("min", Math.min, a, b), maxS = (a, b) => fn2("max", Math.max, a, b);
const roundS = (a) => fn1("round", Math.round, a);
const round2 = (a) => (a.c ? K(Math.round(a.v * 100) / 100) : div(roundS(mul(a, K(100))), K(100)));
const r2 = (x) => Math.round(x * 100) / 100;
const trig = (name, js) => (a) => (a.c ? K(Math.round(js(a.v * Math.PI / 180) * 1e12) / 1e12) : { fs: `${name}(${wrap(a, P_MUL)} * degree)`, prec: P_ATOM, v: js(a.v * Math.PI / 180), c: false });
const cosd = trig("cos", Math.cos), sind = trig("sin", Math.sin), tand = trig("tan", Math.tan);

const mm = (s) => `${wrap(s, P_MUL)} * millimeter`;
const vecMm = (p) => `vector(${p.map((s) => s.fs).join(", ")}) * millimeter`;
const dirFs = (v) => `vector(${v.map((c) => fnum(c)).join(", ")})`;
const created = (idExpr) => `qCreatedBy(${idExpr}, EntityType.BODY)`;
const pos = (s, what) => { if (!(s.v > 0)) throw new Skip(`${what} doit être positif (reçu ${fnum(s.v)})`); return s; };

export { Skip, P_ATOM, P_POW, P_MUL, P_ADD, P_NEG, P_LOW, wrap, fnum, parseExpr, printAst, K, V, isSym, neg, add, sub, mul, div, minS, maxS, roundS,
  round2, r2, cosd, sind, tand, mm, vecMm, dirFs, created, pos };
