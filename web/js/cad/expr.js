/* DesignWizard.ai — safe expression evaluator for the part language.
   Numbers in a part spec may be written as expressions of the part parameters: "L/2 - 10", "max(t, 2)".
   No eval / new Function (strict CSP): a small recursive-descent parser over + - * / % ^ ( ) , identifiers and calls. */

const FUNCS = {
  min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sin: (d) => Math.sin(d * Math.PI / 180), cos: (d) => Math.cos(d * Math.PI / 180), tan: (d) => Math.tan(d * Math.PI / 180),
  asin: (v) => Math.asin(v) * 180 / Math.PI, acos: (v) => Math.acos(v) * 180 / Math.PI, atan: (v) => Math.atan(v) * 180 / Math.PI,
  atan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI, hypot: Math.hypot, pow: Math.pow,
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi), if: (c, a, b) => (c ? a : b),
};
const CONSTS = { pi: Math.PI, PI: Math.PI };

export class ExprError extends Error {}

function tokenize(src) {
  const out = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_.]*)|(<=|>=|==|!=|[-+*/%^(),<>]))/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new ExprError(`Expression « ${src} » : caractère inattendu « ${src[pos]} ».`);
    }
    pos = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: "num", v: parseFloat(m[1]) });
    else if (m[2] !== undefined) out.push({ t: "id", v: m[2] });
    else out.push({ t: "op", v: m[3] });
  }
  return out;
}

/** Evaluate `src` (string or number) with the variables of `scope` (plain object name -> number). */
export function evaluate(src, scope = {}) {
  if (typeof src === "number") return src;
  if (typeof src === "boolean") return src ? 1 : 0;
  if (typeof src !== "string") throw new ExprError(`Valeur numérique attendue, reçu ${JSON.stringify(src)}.`);
  const text = src.trim();
  if (text === "") throw new ExprError("Expression vide.");
  const toks = tokenize(text);
  let i = 0;
  const peek = () => toks[i];
  const eat = (v) => { if (toks[i] && toks[i].t === "op" && toks[i].v === v) { i++; return true; } return false; };
  const need = (v) => { if (!eat(v)) throw new ExprError(`Expression « ${src} » : « ${v} » attendu.`); };

  function primary() {
    const t = toks[i++];
    if (!t) throw new ExprError(`Expression « ${src} » incomplète.`);
    if (t.t === "num") return t.v;
    if (t.t === "id") {
      if (eat("(")) {
        const fn = FUNCS[t.v];
        if (!fn) throw new ExprError(`Expression « ${src} » : fonction inconnue « ${t.v} ».`);
        const args = [];
        if (!eat(")")) { do { args.push(comparison()); } while (eat(",")); need(")"); }
        return fn(...args);
      }
      if (Object.prototype.hasOwnProperty.call(scope, t.v)) {
        const v = scope[t.v];
        if (typeof v !== "number" || Number.isNaN(v)) throw new ExprError(`Paramètre « ${t.v} » sans valeur numérique.`);
        return v;
      }
      if (Object.prototype.hasOwnProperty.call(CONSTS, t.v)) return CONSTS[t.v];
      throw new ExprError(`Paramètre inconnu « ${t.v} » dans « ${src} ». Correctif : ajoutez-le dans "params".`);
    }
    if (t.v === "(") { const v = comparison(); need(")"); return v; }
    if (t.v === "-") return -unary();
    if (t.v === "+") return unary();
    throw new ExprError(`Expression « ${src} » : « ${t.v} » inattendu.`);
  }
  function unary() { if (eat("-")) return -unary(); if (eat("+")) return unary(); return power(); }
  function power() { const b = primary(); if (eat("^")) return Math.pow(b, unary()); return b; }
  function term() {
    let v = unary();
    for (;;) {
      if (eat("*")) v *= unary();
      else if (eat("/")) v /= unary();
      else if (eat("%")) v %= unary();
      else return v;
    }
  }
  function sum() {
    let v = term();
    for (;;) {
      if (eat("+")) v += term();
      else if (eat("-")) v -= term();
      else return v;
    }
  }
  function comparison() {
    const a = sum();
    const t = peek();
    if (t && t.t === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(t.v)) {
      i++;
      const b = sum();
      return ({ "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b, "==": Math.abs(a - b) < 1e-9, "!=": Math.abs(a - b) >= 1e-9 })[t.v] ? 1 : 0;
    }
    return a;
  }
  const v = comparison();
  if (i < toks.length) throw new ExprError(`Expression « ${src} » : « ${toks[i].v} » en trop.`);
  if (!Number.isFinite(v)) throw new ExprError(`Expression « ${src} » : résultat non fini (${v}).`);
  return v;
}

/** Identifiers used by an expression (for dependency ordering and unknown-parameter checks). */
export function identifiers(src) {
  if (typeof src !== "string") return [];
  const ids = new Set();
  const toks = tokenize(src);
  toks.forEach((t, k) => {
    const call = toks[k + 1] && toks[k + 1].t === "op" && toks[k + 1].v === "(";
    if (t.t === "id" && !call && !(t.v in CONSTS)) ids.add(t.v);
  });
  return [...ids];
}

/** Normalise the "params" block of a spec: {name: number | {value, min, max, step, unit, label, group, expr}}.
    Returns {defs: {name: def}, scope: {name: number}} with derived parameters (expr) resolved. */
export function resolveParams(params = {}, overrides = {}) {
  const defs = {};
  for (const [name, raw] of Object.entries(params || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new ExprError(`Nom de paramètre invalide « ${name} » (lettres, chiffres, _).`);
    if (name in FUNCS || name in CONSTS) throw new ExprError(`Nom de paramètre réservé « ${name} ».`);
    const d = (raw !== null && typeof raw === "object") ? { ...raw } : { value: raw };
    if (name in overrides) d.value = overrides[name];
    defs[name] = d;
  }
  const scope = {};
  const pending = new Set(Object.keys(defs));
  for (let guard = 0; pending.size && guard < 64; guard++) {
    let progress = false;
    for (const name of [...pending]) {
      const d = defs[name];
      const src = d.expr !== undefined ? d.expr : d.value;
      if (typeof src === "number") { scope[name] = src; pending.delete(name); progress = true; continue; }
      if (typeof src !== "string") throw new ExprError(`Paramètre « ${name} » : valeur manquante.`);
      const deps = identifiers(src);
      if (deps.every((x) => x in scope)) { scope[name] = evaluate(src, scope); pending.delete(name); progress = true; }
      else {
        const unknown = deps.filter((x) => !(x in defs));
        if (unknown.length) throw new ExprError(`Paramètre « ${name} » : référence inconnue « ${unknown[0]} ».`);
      }
    }
    if (!progress) throw new ExprError(`Paramètres en boucle : ${[...pending].join(", ")}.`);
  }
  for (const [name, d] of Object.entries(defs)) {
    if (d.expr !== undefined) d.derived = true;
    d.resolved = scope[name];
  }
  return { defs, scope };
}

/** Evaluate every numeric leaf of a JSON value: numbers stay, strings that parse as expressions become numbers.
    `keep` lists keys whose string values must stay text (ids, names, enums). */
export function evalDeep(value, scope, keep = TEXT_KEYS) {
  if (Array.isArray(value)) return value.map((v) => evalDeep(v, scope, keep));
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = (keep.has(k) && typeof v === "string") ? v : evalDeep(v, scope, keep);
    return out;
  }
  if (typeof value === "string") {
    if (/^[\s\d.+\-*/%^(),<>=!A-Za-z_]+$/.test(value) && /[\dA-Za-z_]/.test(value)) {
      try { return evaluate(value, scope); } catch (e) { if (/^[\s\d.+\-*/()]+$/.test(value)) throw e; return value; }
    }
    return value;
  }
  return value;
}

export const TEXT_KEYS = new Set(["id", "op", "name", "label", "type", "key", "side", "face", "plane", "axis", "mode", "body", "material", "process",
  "family", "screw", "thread", "head", "net", "kind", "ref", "note", "notes", "unit", "group", "depth_mode", "shape", "fit", "path", "edges",
  "dir", "of", "text", "title", "description", "function", "role", "color", "finish", "pattern_type", "standard", "designator", "value_text", "partner", "datum", "gen", "file", "form", "shop", "tool"]);
