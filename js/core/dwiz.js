/* DesignWizard.ai — the .dwiz file format: every object of a mechatronic product as plain text that an engineer, a
   shop and an AI read the same way. One instruction per line, most important first; « # » starts a comment.

     dwiz part/1 DW-0042 "Support du capteur"            the first line says what the file is
     function "Tient le capteur face à l'aimant."        word value
     stock plate L=L W=W t=t                             word [values without name] name=value …
     interface IF1 bolt_pattern side=A face=-Z at=[L/2, W/2]
       params screw=M5 pattern={type: rect, nx: 2, ny: 2, dx: 80, dy: 50}      indented lines belong to the line above
     do tap face=+Z at=[10, 10] thread=M4 depth=(t - 1)                        (…) is a formula of the parameters
     note "Casser les angles vifs"

   Values: numbers, bare words, "text", (formulas), [lists], {name: value} maps, and « word = value » for a raw value.
   The notation is LOSSLESS over the JSON model (fromDwiz(toDwiz(x)) equals x) and generic: the words come from
   core/dwiz_names.js, and anything it does not know is still written and read back. JSON remains accepted everywhere. */

import { KINDS, kindOfDoc } from "./dwiz_names.js";

const NUM = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/, KEY = /^[A-Za-z_]\w*$/, PAIR = /^([A-Za-z_]\w*)=([\s\S]+)$/;
const EXPR = /^[\w\s.+\-*/%^(),<>=!]+$/, TWO_OPERANDS = /[\w.)]\s+[\w.(]/;
const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isScalar = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
const entries = (o) => Object.entries(o).filter(([, v]) => v !== undefined);

/* ---------- writing ---------- */
function balanced(s) { let d = 0; for (const c of s) { if (c === "(") d++; else if (c === ")" && --d < 0) return false; } return d === 0; }
/** True when the first "(" of s closes on its last character. */
function enclosed(s) {
  if (s[0] !== "(" || s[s.length - 1] !== ")") return false;
  for (let i = 0, d = 0; i < s.length; i++) { if (s[i] === "(") d++; else if (s[i] === ")" && --d === 0) return i === s.length - 1; }
  return false;
}
function atTop(s, re) { let d = 0; for (const c of s) { if (c === "(") d++; else if (c === ")") d--; else if (d === 0 && re.test(c)) return true; } return false; }
/** A string as a bare word, a (formula) or a "quoted text". Inside a list or a map a bare formula may contain spaces. */
function str(s, inList) {
  if (s === "" || s !== s.trim() || NUM.test(s) || /^(true|false|null|=|\?|<<<.*)$/.test(s) || /["«»#[\]{}\n\r\t]/.test(s) || !balanced(s)) return JSON.stringify(s);
  if (enclosed(s)) return `(${s})`;                            // the reader removes one pair of outer parentheses
  if (!atTop(s, inList ? /[,:]/ : /[\s,:=]/) && !/\s/.test(s)) return s;                       // a plain word
  if (!EXPR.test(s) || TWO_OPERANDS.test(s) || atTop(s, /[,:]/)) return JSON.stringify(s);     // a text, not a formula
  return inList ? s : `(${s})`;
}
function val(v, inList = false) {
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return str(v, inList);
  if (Array.isArray(v)) return `[${v.map((x) => val(x, true)).join(", ")}]`;
  return `{${entries(v).map(([k, x]) => `${KEY.test(k) ? k : JSON.stringify(k)}: ${val(x, true)}`).join(", ")}}`;
}
const word = (k, taken) => (KEY.test(k) && !(taken && taken.has(k)) ? k : JSON.stringify(k));
const longText = (v) => typeof v === "string" && (v.includes("\n") || v.length > 300) && !v.includes("\r") && !v.split("\n").some((l) => l.trim() === ">>>");
const itemWords = (kids) => new Set(Object.values(kids || {}).map((n) => n.word).filter(Boolean));

function scalarLine(out, pad, w, v) { if (longText(v)) out.push(`${pad}${w} <<<`, v, ">>>"); else out.push(`${pad}${w} ${val(v)}`); }
/** One map as a statement: word, values of the head keys, name=value pairs, then registered kids on indented lines. */
function mapLine(out, ind, w, obj, node, name) {
  const pad = "  ".repeat(ind), kids = node.kids || {}, used = new Set(), later = [], pairs = [];
  let line = pad + w + (name !== undefined ? ` ${name}` : "");
  for (const h of node.head || []) { if (obj[h] === undefined || longText(obj[h])) break; line += ` ${val(obj[h])}`; used.add(h); }
  for (const [k, v] of entries(obj)) {
    if (used.has(k)) continue;
    if (kids[k] || !KEY.test(k) || longText(v)) later.push([k, v]); else pairs.push(`${k}=${val(v)}`);
  }
  if (node.first) { const rank = (p) => { const i = node.first.indexOf(p.slice(0, p.indexOf("="))); return i < 0 ? node.first.length : i; }; pairs.sort((a, b) => rank(a) - rank(b)); }
  for (const p of pairs) { if (line.length + p.length > 118) { out.push(line); line = `${pad}  ${p}`; } else line += ` ${p}`; }   // a line that starts with name=value continues the line above
  out.push(line);
  const taken = itemWords(kids);
  for (const [k, v] of later) keyLines(out, ind + 1, k, v, kids[k], taken);
}
/** The lines of one key of a map. `taken` = item words of the context a key must not be confused with. */
function keyLines(out, ind, key, value, node, taken) {
  const pad = "  ".repeat(ind), w = word(key, taken), raw = () => out.push(`${pad}${w} = ${val(value)}`);
  if (value === undefined) return;
  if (node && node.word) {
    const list = node.keyed ? (isMap(value) ? entries(value) : null) : Array.isArray(value) ? value : null;
    if (!list || !list.length) return raw();
    if (node.scalar) { if (!list.every(isScalar)) return raw(); for (const v of list) scalarLine(out, pad, node.word, v); return; }
    if (node.keyed) {
      if (!list.every(([, v]) => isScalar(v) || isMap(v))) return raw();
      for (const [name, v] of list) { if (isMap(v)) mapLine(out, ind, node.word, v, node, str(name)); else out.push(`${pad}${node.word} ${str(name)} = ${val(v)}`); }
      return;
    }
    if (!list.every(isMap)) return raw();
    for (const v of list) mapLine(out, ind, node.word, v, node);
    return;
  }
  if (isMap(value)) { if (!entries(value).length) return raw(); return mapLine(out, ind, w, value, node || {}); }
  if (isScalar(value) && !(node && (node.head || node.kids))) return scalarLine(out, pad, w, value);
  raw();
}
/** Vocabulary of a document: chosen by its « dw » field only; an unknown kind is read and written word for word. */
const schemaOf = (doc) => KINDS[String((doc && doc.dw) || "").split("/")[0]] || { sections: [], kids: {} };
function docLines(doc) {
  const K = schemaOf(doc), out = [], embed = K.embed || {}, done = new Set(["dw"]), taken = itemWords(K.kids).add("dwiz");
  const head = ["dwiz", doc.dw === undefined ? "?" : val(doc.dw)];
  for (const k of ["id", "name"]) { if (!isScalar(doc[k]) || longText(doc[k])) break; head.push(val(doc[k])); done.add(k); }
  out.push(head.join(" "));
  const section = (title, keys) => {
    const lines = [];
    for (const k of keys) { if (done.has(k) || doc[k] === undefined) continue; done.add(k); keyLines(lines, 0, k, doc[k], K.kids[k], taken); }
    if (lines.length) out.push("", `# ${title}`, ...lines);
  };
  for (const [title, keys] of K.sections) section(title, keys);
  const tail = [];
  for (const [k, v] of entries(doc)) {
    if (done.has(k)) continue;
    if (embed[k] && Array.isArray(v) && v.length && v.every(isMap)) { tail.push(...v); done.add(k); }
  }
  section("Autres données", Object.keys(doc).filter((k) => k !== "step"));
  section("Géométrie importée", ["step"]);
  return [out, tail];
}
/** Write a document (part, assembly, project…) or a list of documents as .dwiz text. */
export function toDwiz(doc) {
  const docs = Array.isArray(doc) ? doc : [doc], blocks = [];
  for (const d of docs) { const [lines, tail] = docLines(d); blocks.push(lines.join("\n")); for (const t of tail) blocks.push(docLines(t)[0].join("\n")); }
  blocks[0] = blocks[0].replace("\n", "\n# DesignWizard.ai — fichier .dwiz : une instruction par ligne, « # » commente, les lignes en retrait précisent la ligne du dessus.\n");
  return `${blocks.join("\n\n\n")}\n`;
}

/* ---------- reading ---------- */
class DwizError extends Error { constructor(line, msg) { super(`Ligne ${line} : ${msg}`); this.line = line; } }
/** Parse one value: number, word, "text", «texte», (formula), [list], {map}. */
export function parseValue(src, line = 0) {
  let i = 0;
  const fail = (m) => { throw new DwizError(line, `${m} dans « ${src.length > 60 ? `${src.slice(0, 60)}…` : src} ».`); };
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const quoted = () => {
    let j = i + 1;
    while (j < src.length && src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
    if (j >= src.length) fail("guillemet fermant manquant");
    try { const s = JSON.parse(src.slice(i, j + 1)); i = j + 1; return s; } catch (e) { return fail("texte entre guillemets invalide"); }
  };
  function value(stop) {
    ws();
    const c = src[i];
    if (c === '"') return quoted();
    if (c === "«") { const e = src.indexOf("»", i); if (e < 0) fail("guillemet » manquant"); const s = src.slice(i + 1, e).trim(); i = e + 1; return s; }
    if (c === "[") {
      const out = []; i++; ws();
      if (src[i] === "]") { i++; return out; }
      for (;;) { out.push(value(",]")); ws(); if (src[i] === ",") { i++; continue; } if (src[i] === "]") { i++; return out; } fail("« , » ou « ] » attendu"); }
    }
    if (c === "{") {
      const out = {}; i++; ws();
      if (src[i] === "}") { i++; return out; }
      for (;;) {
        ws();
        let k;
        if (src[i] === '"') k = quoted(); else { const m = /^[A-Za-z_]\w*/.exec(src.slice(i)); if (!m) fail("nom attendu avant « : »"); k = m[0]; i += k.length; }
        ws(); if (src[i] !== ":") fail("« : » attendu après le nom"); i++;
        out[k] = value(",}"); ws();
        if (src[i] === ",") { i++; continue; } if (src[i] === "}") { i++; return out; } fail("« , » ou « } » attendu");
      }
    }
    let j = i, d = 0;
    for (; j < src.length; j++) { const ch = src[j]; if (ch === "(") d++; else if (ch === ")") d--; else if (d <= 0 && stop && stop.includes(ch)) break; }
    const t = src.slice(i, j).trim(); i = j;
    if (t === "") fail("valeur manquante");
    if (enclosed(t)) return t.slice(1, -1);
    return NUM.test(t) ? Number(t) : t === "true" ? true : t === "false" ? false : t === "null" ? null : t;
  }
  const v = value(null); ws();
  if (i < src.length) fail("texte en trop après la valeur");
  return v;
}
/** Cut a line into tokens at spaces that are outside quotes and brackets; drop the comment. */
function tokens(text, line) {
  const out = [];
  let cur = "", d = 0, q = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { cur += c; if (q === '"' && c === "\\") cur += text[++i] ?? ""; else if (c === q) q = ""; continue; }
    if (c === '"') { q = '"'; cur += c; } else if (c === "«") { q = "»"; cur += c; }
    else if (c === "#") break;
    else if ("([{".includes(c)) { d++; cur += c; } else if (")]}".includes(c)) { d--; cur += c; }
    else if (/\s/.test(c) && d <= 0) { if (cur) out.push(cur); cur = ""; } else cur += c;
  }
  if (q) throw new DwizError(line, "guillemet fermant manquant.");
  if (cur) out.push(cur);
  return out;
}
function statements(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/), root = { ind: -1, kids: [] }, stack = [root];
  for (let n = 0; n < lines.length; n++) {
    const rawLine = lines[n], line = n + 1, ind = /^[ \t]*/.exec(rawLine)[0].replace(/\t/g, "  ").length, toks = tokens(rawLine, line);
    if (!toks.length) continue;
    const here = toks.map((t) => { const m = PAIR.exec(t); return t === "=" ? { mark: true } : m ? { key: m[1], v: parseValue(m[2], line) } : { text: t }; });
    if (here.length && here[here.length - 1].text === "<<<") {       // raw text until a line « >>> »
      const body = [];
      for (n++; n < lines.length && lines[n].trim() !== ">>>"; n++) body.push(lines[n]);
      if (n >= lines.length) throw new DwizError(line, "bloc de texte « <<< » non fermé par « >>> ».");
      here[here.length - 1] = { v: body.join("\n"), text: null };
    }
    while (stack.length > 1 && stack[stack.length - 1].ind >= ind) stack.pop();
    const parent = stack[stack.length - 1];
    if (here[0].key !== undefined && parent !== root) { parent.toks.push(...here); continue; }     // continuation of the line above
    if (here[0].key !== undefined || here[0].mark) throw new DwizError(line, "une ligne commence par un mot (ex. « do drill … », « material AL6061-T6 »).");
    const w = here[0].text, st = { line, ind, quoted: w[0] === '"', word: w[0] === '"' ? parseValue(w, line) : w, toks: here.slice(1), kids: [] };
    for (const t of st.toks) if (t.text !== undefined && t.text !== null) t.v = parseValue(t.text, line);
    parent.kids.push(st); stack.push(st);
  }
  return root.kids;
}
function mapOf(s, node, skip) {
  const obj = {}, head = node.head || [];
  let h = 0, named = false;
  for (const t of s.toks.slice(skip)) {
    if (t.mark) throw new DwizError(s.line, "« = » inattendu ici.");
    if (t.key !== undefined) { obj[t.key] = t.v; named = true; continue; }
    if (named || h >= head.length) throw new DwizError(s.line, `valeur sans nom après « ${s.word} » : écrivez nom=valeur.`);
    obj[head[h++]] = t.v;
  }
  fill(obj, s.kids, node.kids);
  return obj;
}
function fill(target, list, kids) {
  const words = {};
  for (const [k, n] of Object.entries(kids || {})) if (n.word) words[n.word] = [k, n];
  for (const s of list) {
    const T = s.toks, one = () => { if (T.length !== 1 || T[0].key !== undefined || T[0].mark || s.kids.length) throw new DwizError(s.line, `« ${s.word} » attend une seule valeur.`); return T[0].v; };
    if (T[0] && T[0].mark) { if (T.length !== 2 || T[1].key !== undefined || s.kids.length) throw new DwizError(s.line, `« ${s.word} = » attend une seule valeur.`); target[s.word] = T[1].v; continue; }
    if (!s.quoted && words[s.word]) {
      const [key, node] = words[s.word];
      if (node.scalar) { (target[key] = target[key] || []).push(one()); continue; }
      if (node.keyed) {
        if (!T.length || T[0].key !== undefined) throw new DwizError(s.line, `« ${s.word} » attend un nom, ex. « ${s.word} L 120 ».`);
        const box = (target[key] = target[key] || {}), name = String(T[0].v);
        if (T[1] && T[1].mark) { if (T.length !== 3 || T[2].key !== undefined) throw new DwizError(s.line, `« ${s.word} ${name} = » attend une seule valeur.`); box[name] = T[2].v; } else box[name] = mapOf(s, node, 1);
        continue;
      }
      (target[key] = target[key] || []).push(mapOf(s, node, 0));
      continue;
    }
    const node = (!s.quoted && kids && kids[s.word]) || null, loose = T.filter((t) => t.key === undefined).length;
    if (node && (node.head || node.kids)) { target[s.word] = mapOf(s, node, 0); continue; }
    if (loose === 1 && T.length === 1 && !s.kids.length) { target[s.word] = T[0].v; continue; }
    if (!loose && (T.length || s.kids.length)) { target[s.word] = mapOf(s, node || {}, 0); continue; }
    throw new DwizError(s.line, T.length ? `« ${s.word} » : une seule valeur, ou des nom=valeur.` : `« ${s.word} » n'a pas de valeur.`);
  }
}
/** Read .dwiz text. Returns one document, a project with its parts and assemblies, or a list of documents. */
export function fromDwiz(text) {
  const all = statements(text), docs = [];
  for (const s of all) {
    if (s.word === "dwiz" && !s.quoted && s.ind === 0) {
      const d = {}, T = s.toks;
      if (!T.length || T.some((t) => t.key !== undefined || t.mark) || T.length > 3) throw new DwizError(s.line, "en-tête attendu : dwiz <genre/version> <numéro> \"nom\".");
      if (T[0].v !== "?") d.dw = T[0].v;
      if (T.length > 1) d.id = T[1].v;
      if (T.length > 2) d.name = T[2].v;
      docs.push({ d, body: [], line: s.line });
    } else { if (!docs.length) throw new DwizError(s.line, "le fichier doit commencer par « dwiz <genre/version> … »."); docs[docs.length - 1].body.push(s); }
  }
  if (!docs.length) throw new DwizError(1, "aucun document : le fichier doit commencer par « dwiz <genre/version> … ».");
  const out = docs.map(({ d, body }) => { fill(d, body, schemaOf(d).kids); return d; });
  if (out.length === 1) return out[0];
  const first = out[0], K = schemaOf(first);
  if (!K.embed) return out;
  for (const d of out.slice(1)) { const kind = kindOfDoc(d), key = Object.keys(K.embed).find((k) => K.embed[k] === kind) || "parts"; (first[key] = first[key] || []).push(d); }
  return first;
}
/** Does this text hold a .dwiz document (possibly inside an answer with other text around it)? Returns the document text or null. */
export function findDwiz(text) {
  const m = /(^|\n)[ \t]*dwiz[ \t]+\S+/.exec(String(text || ""));
  if (!m) return null;
  const rest = text.slice(m.index + m[1].length), end = rest.search(/\n[ \t]*```/);
  return end >= 0 ? rest.slice(0, end) : rest;
}
