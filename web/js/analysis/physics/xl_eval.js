/* DesignWizard.ai — a spreadsheet formula read the way a spreadsheet reads it, so that the platform can check, without a
   spreadsheet, that a workbook that is alive says what it says itself : numbers, texts, names and cells, + - * / ^ &,
   comparisons, and the few functions the workbooks use. The rules are the spreadsheet's own, not JavaScript's : a minus
   sign binds before a power (-2^2 = 4), powers read from the left (2^3^2 = 64), a division by zero is an ERROR (#DIV/0!)
   and not an infinity, IF computes only the branch it takes. Pure. */

export class XlError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = (code) => { throw new XlError(code); };
const TOKEN = /"[^"]*"|\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+|\d+\.?\d*(?:[Ee][+-]?\d+)?|[A-Za-z_$][A-Za-z0-9_.$!]*|<=|>=|<>|[-+*/^(),<>=&]/g;
const num = (v) => (typeof v === "number" ? (Number.isFinite(v) ? v : fail("#NUM!")) : typeof v === "boolean" ? (v ? 1 : 0) : fail("#VALUE!"));
const half = (x, d = 0) => { const k = 10 ** num(d), v = num(x); return Math.sign(v) * Math.round(Math.abs(v) * k) / k; };      // a spreadsheet rounds a half away from zero
/** The functions a formula may call. IF is not here : it is lazy. */
export const XL_FUNCTIONS = {
  PI: () => Math.PI, SQRT: (x) => (num(x) < 0 ? fail("#NUM!") : Math.sqrt(x)), LOG10: (x) => (num(x) <= 0 ? fail("#NUM!") : Math.log10(x)), LN: (x) => (num(x) <= 0 ? fail("#NUM!") : Math.log(x)),
  EXP: (x) => num(Math.exp(num(x))), TANH: (x) => Math.tanh(num(x)), TAN: (x) => num(Math.tan(num(x))), ATAN: (x) => Math.atan(num(x)), RADIANS: (x) => num(x) * Math.PI / 180, DEGREES: (x) => num(x) * 180 / Math.PI, ABS: (x) => Math.abs(num(x)), ROUND: half, MIN: (...a) => Math.min(...a.map(num)), MAX: (...a) => Math.max(...a.map(num)),
  AND: (...a) => a.map(num).every(Boolean), OR: (...a) => a.map(num).some(Boolean), NOT: (x) => !num(x),
};

/** A formula as a tree : ["num", v] ["str", s] ["name", n] ["range", "F12", "F30"] ["call", fn, args] ["neg", a] ["bin", op, a, b]. */
export function xlParse(src) {
  const tk = String(src).match(TOKEN) || []; let p = 0;
  if (tk.join("").replace(/\s+/g, "").length !== String(src).replace(/\s+/g, "").length) fail(`#PARSE! ${src}`);
  const peek = () => tk[p], eat = (t) => { if (tk[p] !== t) fail(`#PARSE! « ${t} » expected in ${src}`); p++; };
  const primary = () => { const t = tk[p++];
    if (t === undefined) fail(`#PARSE! ${src}`);
    if (t === "(") { const v = compare(); eat(")"); return v; }
    if (/^"/.test(t)) return ["str", t.slice(1, -1)];
    if (t.includes(":")) return ["range", ...t.replace(/\$/g, "").split(":")];
    if (/^\d/.test(t)) return ["num", Number(t)];
    if (!/^[A-Za-z_$]/.test(t)) fail(`#PARSE! ${src}`);
    if (peek() === "(") { p++; const args = []; if (peek() !== ")") { args.push(compare()); while (peek() === ",") { p++; args.push(compare()); } } eat(")"); return ["call", t.toUpperCase(), args]; }
    return ["name", t]; };
  const unary = () => (peek() === "-" ? (p++, ["neg", unary()]) : peek() === "+" ? (p++, unary()) : primary());
  const left = (next, ops) => () => { let v = next(); while (ops.includes(peek())) v = ["bin", tk[p++], v, next()]; return v; };
  const power = left(unary, ["^"]), term = left(power, ["*", "/"]), sum = left(term, ["+", "-"]), cat = left(sum, ["&"]);
  const compare = () => { const a = cat(); return ["=", "<>", "<", ">", "<=", ">="].includes(peek()) ? ["bin", tk[p++], a, cat()] : a; };
  const tree = compare(); if (p !== tk.length) fail(`#PARSE! left over in ${src}`); return tree;
}
const rank = (v) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2), fold = (v) => (typeof v === "string" ? v.toLowerCase() : v);
function binary(op, a, b) {
  if (op === "&") return `${a}${b}`;
  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) { const ra = rank(a), rb = rank(b), x = fold(a), y = fold(b), c = ra !== rb ? ra - rb : x < y ? -1 : x > y ? 1 : 0;      // a number sorts before a text, a text before a truth
    return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0; }
  const x = num(a), y = num(b);
  if (op === "+") return num(x + y); if (op === "-") return num(x - y); if (op === "*") return num(x * y);
  if (op === "/") return y === 0 ? fail("#DIV/0!") : num(x / y);
  if (x === 0 && y === 0) fail("#NUM!"); if (x === 0 && y < 0) fail("#DIV/0!"); if (x < 0 && !Number.isInteger(y)) fail("#NUM!");
  return num(x ** y);
}
/** The value of a tree. name(n) gives the value of a name or of a cell ; cells(a, b) the values of a range (a workbook only) — COUNTIF counts the ones equal to its word. */
export function xlValue(tree, name, cells) {
  const [kind, a, b, c] = tree;
  if (kind === "num" || kind === "str") return a;
  if (kind === "range") return cells ? cells(a, b) : fail("#REF! a range outside a workbook");
  if (kind === "call" && a === "COUNTIF") { const list = xlValue(b[0], name, cells), want = xlValue(b[1], name, cells); return (Array.isArray(list) ? list : [list]).filter((v) => binary("=", v, want)).length; }
  if (kind === "name") return a.toUpperCase() === "TRUE" ? true : a.toUpperCase() === "FALSE" ? false : name(a);
  if (kind === "neg") return -num(xlValue(a, name, cells));
  if (kind === "bin") return binary(a, xlValue(b, name, cells), xlValue(c, name, cells));
  if (a === "IF") return xlValue(num(xlValue(b[0], name, cells)) ? b[1] : b[2] || ["num", 0], name, cells);
  if (!XL_FUNCTIONS[a]) fail(`#NAME? ${a}`);
  return XL_FUNCTIONS[a](...b.map((x) => xlValue(x, name, cells)));
}
/** One formula, with what its names are worth : xlEval("in_x^2", { in_x: 3 }) → 9. */
export const xlEval = (src, env = {}) => xlValue(xlParse(src), (n) => (n in env ? env[n] : fail(`#NAME? ${n}`)));

/** A workbook computed as a spreadsheet computes it. book : the model xlsx() takes ; over : { name : value } — what one types in a named cell.
    → get(what) : the value of a named cell, of « A1 » on the first sheet, or of « Sheet!A1 ». A cell whose formula calls a function unknown here
    (a lookup in another sheet, a count) is worth what it was worth when the file was written. Throws XlError as a spreadsheet shows an error. */
export function xlBook(book, over = {}) {
  const sheets = new Map(book.sheets.map((s) => [s.name, s.rows.map((r) => (Array.isArray(r) ? r : (r && r.cells) || []))])), first = book.sheets[0].name;
  const clean = (ref) => ref.replace(/\$/g, ""), names = new Map(book.names.map((n) => [n.name, clean(n.ref)])), forced = new Map(Object.entries(over).filter(([n]) => names.has(n)).map(([n, v]) => [names.get(n), v]));
  const memo = new Map(), busy = new Set();
  const cell = (at) => { const [, sh, col, row] = /^(.+)!([A-Z]+)(\d+)$/.exec(at) || fail(`#REF! ${at}`); let c = 0; for (const ch of col) c = c * 26 + ch.charCodeAt(0) - 64; const rows = sheets.get(sh) || fail(`#REF! ${at}`); return (rows[Number(row) - 1] || [])[c - 1]; };
  const value = (at) => {
    if (forced.has(at)) return forced.get(at); if (memo.has(at)) return memo.get(at);
    const c = cell(at), plain = c !== null && typeof c === "object" ? c.v : c, kept = plain === undefined || plain === null ? 0 : plain; let v = kept;
    if (c && typeof c === "object" && c.f) { if (busy.has(at)) fail(`#REF! circular ${at}`); busy.add(at);
      const here = at.split("!")[0], col = (t) => { let k = 0; for (const ch of /^[A-Z]+/.exec(t)[0]) k = k * 26 + ch.charCodeAt(0) - 64; return k; }, row = (t) => Number(/\d+$/.exec(t)[0]), letter = (k) => { let t = ""; for (; k > 0; k = Math.floor((k - 1) / 26)) t = String.fromCharCode(65 + (k - 1) % 26) + t; return t; };
      const span = (p, q) => { const out = []; for (let r = Math.min(row(p), row(q)); r <= Math.max(row(p), row(q)); r++) for (let k = Math.min(col(p), col(q)); k <= Math.max(col(p), col(q)); k++) { try { out.push(value(`${here}!${letter(k)}${r}`)); } catch (e) { if (!(e instanceof XlError)) throw e; } } return out; };      // a cell in error counts for nothing
      try { v = xlValue(xlParse(c.f), (n) => value(names.has(n) ? names.get(n) : /^\$?[A-Z]{1,3}\$?\d+$/.test(n) ? `${here}!${clean(n)}` : fail(`#NAME? ${n}`)), span); }
      catch (e) { if (!(e instanceof XlError) || !/^#(NAME\? [A-Z0-9]+$|PARSE!)/.test(e.code) || plain === undefined || plain === null || plain === "") throw e; v = kept; }
      finally { busy.delete(at); } }
    memo.set(at, v); return v; };
  return (what) => value(names.has(what) ? names.get(what) : what.includes("!") ? clean(what) : `${first}!${clean(what)}`);
}
