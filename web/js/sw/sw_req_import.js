/* DynamiteOrbit.ai — Logiciel : the REQUIREMENTS as a STANDARD INPUT (demande de JP, 24 novembre 2026 : « requirements is a standard input
   (that we don't document here, we load it with a standard structure that you specified with a prompt format for AI LLM (and then I convert
   mine using it), otherwise référence values if unavailable and color code (to inform the user) »).
   The project keeps its requirements where it keeps them ; the tool READS them in one structure, `dynamiteorbit/sw-requirements@1` :
     system        { name, domain (bms · ess · robot · drive · device · other), period_ms }
     signals       what the software reads from or gives to the board : { id, name, dir (in | out), type (analog | digital), unit, min, max,
                   hw: { board, pin, net } }
     requirements  { id, text (« shall »), kind, verify, block (a kind of block of the library), input (a signal or a requirement id),
                   output (a signal), values: { param: number | text }, source (where the project wrote it) }
   PROMPT gives the instruction an assistant needs to turn any document of requirements into that structure — with the catalogue of the
   blocks and of their values, written from the library itself, so it never lags. The tool calls no assistant : the text is copied.
   On import, the tool PLANS (what is created, what is linked, which values come from a requirement and which are reference values), then
   APPLIES in one undoable step : the requirements (to confirm : the structure came through an assistant, and an answer of an assistant confirms
   nothing — confirming a requirement confirms the values it gives), the board's pins, one block per requirement with its values (green), the values the
   requirement does not give left at the reference value of the block (amber, to confirm), the wires the inputs and outputs name, and the
   blocks laid out from left to right. A block the library cannot run yet is said, and its requirement kept, allocated to nothing.
   Pure : no page. */

import { KINDS, portsOf } from "./sw_objects.js";
import { REQ_KINDS, VERIFY } from "./sw_req.js";
import { flowLayout, LIBRARY, PACKS } from "./sw_blocks.js";

export const REQ_FORMAT = "dynamiteorbit/sw-requirements@1";
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "x";
const UNITS = { V: ["mV", 1000], mV: ["mV", 1], A: ["mA", 1000], mA: ["mA", 1], "°C": ["0.1 °C", 10], "0.1 °C": ["0.1 °C", 1], "%": ["‰", 10], "‰": ["‰", 1], rpm: ["rpm", 1], ms: ["ms", 1], s: ["ms", 1000], mWh: ["mWh", 1], Wh: ["mWh", 1000] };
/** A unit of a document to the unit of the tool, and the factor. → [unit, factor] */
export const toolUnit = (u) => UNITS[String(u || "").trim()] || [String(u || "mV").trim(), 1];
const BLOCKS = () => Object.entries(KINDS).filter(([, K]) => !K.pin);

/** The instruction for an assistant : turn the project's own requirements into the standard structure. */
export function reqPrompt() {
  const blocks = BLOCKS().map(([k, K]) => `- \`${k}\` — ${K.label} (${K.fr}) : ${K.text}\n  inputs : ${K.ports.in.map((p) => `${p.key} [${p.unit === "*" ? "unit of the block" : p.unit}]${p.free ? " (optional)" : ""}`).join(", ") || "none"} · outputs : ${K.ports.out.map((p) => `${p.key} [${p.unit === "*" ? "unit of the block" : p.unit}]`).join(", ")}\n  values : ${K.params.map((p) => `${p.key}${p.choices ? ` (one of ${p.choices.join(" | ")})` : ` [${p.unit === "*" ? "unit of the block" : p.unit || "-"}]`}`).join(", ") || "none"}`).join("\n");
  const planned = LIBRARY.filter((x) => x.planned).map((x) => `\`${x.id}\` (${x.label})`).join(", ");
  return `You convert a document of SOFTWARE REQUIREMENTS of an embedded product into ONE JSON object, the standard input of DynamiteOrbit.ai.
Answer with the JSON only, in a \`\`\`json block. Do not invent a number : a value the document does not give is LEFT OUT (the tool then shows its reference value, in amber, to confirm).

Structure (format "${REQ_FORMAT}") :
{
  "format": "${REQ_FORMAT}",
  "system": { "name": "…", "domain": "${PACKS.map((p) => p.id).join(" | ")} | other", "period_ms": 10 },
  "signals": [
    { "id": "cell_v", "name": "Highest cell voltage", "dir": "in", "type": "analog", "unit": "mV", "min": 2500, "max": 4500,
      "hw": { "board": "name of the board if the document says it", "pin": "ADC0 or a pin name", "net": "net name if known" } },
    { "id": "k_main", "name": "Main contactor coil", "dir": "out", "type": "digital" }
  ],
  "requirements": [
    { "id": "SWR-001", "text": "The software shall … (one requirement, one \\"shall\\", measurable)",
      "kind": "${Object.keys(REQ_KINDS).join(" | ")}", "verify": "${Object.keys(VERIFY).join(" | ")}",
      "block": "limit", "input": "cell_v", "output": null,
      "values": { "trip": 4250, "clear": 4150, "delay": 100 }, "source": "where the document says it (§, page)" }
  ]
}

Rules :
1. One requirement = one sentence with "shall", one kind, one way to verify it. Keep the document's own id when it has one.
2. "block" is the block of the library that carries the requirement, from the list below ; when none fits, write the closest planned block id (${planned}) or leave "block" out — the requirement is kept, allocated to nothing.
3. "input" names a signal id (dir "in") or the id of another requirement whose block feeds this one (a chain : measure → threshold → latch → command). "output" names a signal id (dir "out") the block drives.
4. "values" uses the keys of the block below, in the units given ; you may also write a value with its unit as text ("4.25 V", "100 ms", "60 °C") — the tool converts V, A, °C, %, s.
5. Signals : "analog" for a quantity read by a converter, "digital" for 0 / 1. Give min and max when the document gives a valid range.
6. Never copy a figure from a standard or a datasheet the document does not quote.

The blocks of the library (kind, what it does, its ports, its values) :
${blocks}
`;
}

/* ---------- the list of DynamiteAgile : its Goldmine export, read as it is (« Exporter (.csv) » of the requirements) ---------- */
/** A CSV text → rows of cells (quotes, doubled quotes, line breaks inside quotes). */
export function csvRows(text) {
  const s = String(text || "").replace(/^\uFEFF/, ""), rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === "," || c === ";") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}
const AGILE_KIND = { functional: "functional", performance: "performance", interface: "interface", safety: "safety", "personnel safety": "safety", environmental: "robustness", "standard / regulatory": "functional" };
const AGILE_VERIFY = { t: "test", test: "test", d: "test", demonstration: "test", a: "analysis", analysis: "analysis", i: "review", inspection: "review" };
export const SW_ALLOC = /\b(sw|software|logiciel|firmware|fw|embedded|embarqu)/i;
/** The requirements of a DynamiteAgile export (Goldmine), in the standard structure — the software ones when the list says which (its
    « allocation » column), all of them otherwise, and said. No block is named : an assistant, or the person, allocates them. → { data, notes } or null */
export function agileReqs(text) {
  const rows = csvRows(text); if (rows.length < 2) return null; const head = rows[0].map((h) => String(h).trim().toLowerCase()), at = (r, k) => { const i = head.indexOf(k); return i < 0 ? "" : String(r[i] || "").trim(); };
  if (!head.includes("statement") || !(head.includes("key") || head.includes("external_id"))) return null;
  const all = rows.slice(1).filter((r) => at(r, "statement") && !/^need$/i.test(at(r, "kind"))), sw = all.filter((r) => SW_ALLOC.test(at(r, "allocation"))), pick = sw.length ? sw : all, notes = [];
  notes.push(sw.length ? `${sw.length} exigence${sw.length > 1 ? "s" : ""} allouée${sw.length > 1 ? "s" : ""} au logiciel sur ${all.length} (colonne « allocation »).` : `Aucune exigence n'est allouée au logiciel dans la colonne « allocation » : les ${all.length} sont gardées — retirez celles qui ne sont pas du logiciel (On / Off).`);
  return { notes, data: { format: REQ_FORMAT, system: { name: "Exigences de DynamiteAgile" }, signals: [], requirements: pick.map((r) => { const key = at(r, "key") || at(r, "external_id"), doc = at(r, "source_doc");
    return { id: key, text: at(r, "statement") || at(r, "title"), kind: AGILE_KIND[at(r, "category").toLowerCase()] || "functional", verify: AGILE_VERIFY[at(r, "verification_method").toLowerCase()] || "test", source: `DynamiteAgile ${key}${doc ? ` · ${doc}` : ""}` }; }) } };
}

/** Reads a text (the JSON, or an answer with a \`\`\`json block, or a CSV export of DynamiteAgile). → { ok, data?, errors: [text], notes? } */
export function parseReqs(text) {
  const ag = /statement/i.test(String(text || "").split(/\r?\n/)[0] || "") ? agileReqs(text) : null; if (ag) return { ok: ag.data.requirements.length > 0, data: ag.data, errors: ag.data.requirements.length ? [] : ["Le fichier de DynamiteAgile ne contient aucune exigence."], notes: ag.notes, from: "dynamiteagile" };
  const s = String(text || ""), m = /```(?:json)?\s*([\s\S]*?)```/.exec(s), body = (m ? m[1] : s).trim(); let data;
  try { data = JSON.parse(body); } catch (e) { return { ok: false, errors: [`Ce n'est pas du JSON lisible : ${String(e.message || e).slice(0, 120)}`] }; }
  const errors = [];
  if (!data || typeof data !== "object") errors.push("Le fichier n'est pas un objet JSON.");
  else { if (data.format !== REQ_FORMAT) errors.push(`Le format doit être « ${REQ_FORMAT} » (lu : « ${data.format || "rien"} »).`);
    if (!Array.isArray(data.requirements)) errors.push("Il manque la liste « requirements »."); if (data.signals !== undefined && !Array.isArray(data.signals)) errors.push("« signals » doit être une liste."); }
  return errors.length ? { ok: false, errors } : { ok: true, data, errors: [] };
}
/** A value of the document for a parameter of a block : a number, or a text with its unit, converted to the unit the block reads. */
function valueFor(p, raw, blockUnit) {
  if (p.choices) { const hit = p.choices.find((c) => String(c).toLowerCase() === String(raw).toLowerCase()); return hit === undefined ? null : hit; }
  if (typeof raw === "number") return Math.round(raw);
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(.*)$/.exec(String(raw)); if (!m) return null; const [u, f] = toolUnit(m[2] || (p.unit === "*" ? blockUnit : p.unit));
  const want = p.unit === "*" ? blockUnit : p.unit; if (m[2] && want && u !== want && !(u === "ms" && want === "ms")) return null;
  return Math.round(Number(m[1].replace(",", ".")) * f);
}

/** What an import would do to a design (or to a new one). → { design (the design as it would be), rows: [{ id, text, block, state ("made" | "planned" | "none"), values: [{ key, label, value, source }] }],
    signals: [{ id, name, dir, made: [ids] }], wires, notes: [text], counts: { reqs, blocks, fromReq, reference, planned } } */
export function planImport(data, d0) {
  const d = d0 ? JSON.parse(JSON.stringify(d0)) : { id: "SW-1", name: (data.system && data.system.name) || "Logiciel importé", cpu: "generic", period: (data.system && data.system.period_ms) || 10, objects: [], wires: [], reqs: [], tests: [] };
  d.objects = d.objects || []; d.wires = d.wires || []; d.reqs = d.reqs || [];
  if (data.system && data.system.domain) d.domain = data.system.domain;
  const has = (id) => d.objects.some((o) => o.id === id), fresh = (base) => { let id = slug(base), n = 2; while (has(id)) id = `${slug(base)}_${n++}`; return id; };
  const out = { rows: [], signals: [], wires: [], notes: [], counts: { reqs: 0, blocks: 0, fromReq: 0, reference: 0, planned: 0 } }, feed = {}, sink = {};
  /* the board's pins : an analog signal is a converter channel and its scaling ; a digital one a pin */
  let ch = 0, gpio = 0;
  for (const s of data.signals || []) {
    if (!s || !s.id) continue; const hw = s.hw && (s.hw.net || s.hw.pin || s.hw.board) ? { ...(s.hw.board ? { board: String(s.hw.board) } : {}), ...(s.hw.net ? { net: String(s.hw.net) } : {}), ...(s.hw.pin ? { pin: String(s.hw.pin) } : {}) } : undefined, made = [];
    const num = (x) => { const n = /(\d+)/.exec(String(x || "")); return n ? Number(n[1]) : null; };
    if (s.dir === "out") { const id = fresh(`${s.id}_out`); d.objects.push({ id, kind: "pin_dout", name: `Sortie : ${s.name || s.id}`, params: { pin: num(hw && hw.pin) ?? gpio++ }, sure: hw && hw.pin ? ["pin"] : [], ...(hw ? { hw } : {}), x: 0, y: 0 }); made.push(id); sink[s.id] = `${id}.level`; }
    else if (s.type === "digital") { const id = fresh(`${s.id}_in`); d.objects.push({ id, kind: "pin_din", name: `Entrée : ${s.name || s.id}`, params: { pin: num(hw && hw.pin) ?? gpio++ }, sure: hw && hw.pin ? ["pin"] : [], ...(hw ? { hw } : {}), x: 0, y: 0 }); made.push(id); feed[s.id] = { ref: `${id}.level`, unit: "0/1" }; }
    else { const [u, f] = toolUnit(s.unit), pin = fresh(`${s.id}_adc`), q = fresh(s.id), params = { unit: u }, sure = ["unit"];
      const from = {}; if (Number.isFinite(s.min)) { params.lo = Math.round(s.min * f); from.lo = "signals"; } if (Number.isFinite(s.max)) { params.hi = Math.round(s.max * f); from.hi = "signals"; }
      d.objects.push({ id: pin, kind: "pin_adc", name: `Voie : ${s.name || s.id}`, params: { channel: num(hw && hw.pin) ?? ch++ }, sure: hw && hw.pin ? ["channel"] : [], ...(hw ? { hw } : {}), x: 0, y: 0 }, { id: q, kind: "analog_in", name: s.name || s.id, params, sure, src: from, x: 0, y: 0 });
      d.wires.push({ from: `${pin}.counts`, to: `${q}.counts` }); made.push(pin, q); feed[s.id] = { ref: `${q}.value`, unit: u }; }
    out.signals.push({ id: s.id, name: s.name || s.id, dir: s.dir === "out" ? "out" : "in", made });
  }
  /* one block per requirement that names one ; its values from the requirement, the others at the reference value */
  const reqIds = new Set(d.reqs.map((r) => r.id)), later = [];
  for (const r of data.requirements || []) {
    if (!r || !r.text) continue;
    /* a requirement already in the software (the same id : a list from DynamiteAgile, sent back by an assistant with its blocks) is not doubled —
       it receives its block if it has none yet, and keeps what it has otherwise */
    const known = r.id ? d.reqs.find((x) => x.id === String(r.id)) : null; let id = known ? known.id : String(r.id || `SWR-${String(d.reqs.length + 1).padStart(3, "0")}`); if (!known) { while (reqIds.has(id)) id = `${id}-b`; reqIds.add(id); }
    const kind = r.block && KINDS[r.block] && !KINDS[r.block].pin ? r.block : null, planned = !kind && r.block && LIBRARY.some((x) => x.planned && x.id === r.block), had = known && (known.objs || []).length;
    const row = { id, text: String(r.text), block: r.block || "", state: had ? "kept" : kind ? "made" : planned ? "planned" : "none", values: [], known: !!known }; out.rows.push(row); out.counts.reqs++;
    const req = known || { id, text: String(r.text).trim(), kind: REQ_KINDS[r.kind] ? r.kind : "functional", verify: VERIFY[r.verify] ? r.verify : "test", objs: [], on: true, sure: false, ...(r.source ? { source: String(r.source) } : {}) }; if (!known) d.reqs.push(req);
    if (had) { const o = d.objects.find((x) => x.id === known.objs[0]); if (o && KINDS[o.kind]) feed[id] = { ref: `${o.id}.${KINDS[o.kind].ports.out[0].key}`, unit: portsOf(o).out[0].unit }; continue; }
    if (!kind) { if (planned) out.counts.planned++; continue; }
    const K = KINDS[kind], src = r.input && feed[r.input], unitP = K.params.find((p) => p.key === "unit"), oid = fresh(r.name || `${kind}_${id}`), params = {}, sure = [], from = {};
    if (unitP && src && unitP.choices.includes(src.unit)) { params.unit = src.unit; sure.push("unit"); }
    const bu = params.unit || (unitP ? unitP.value : "");
    for (const p of K.params) { if (p.key === "unit" && params.unit) continue; const raw = r.values ? r.values[p.key] : undefined, v = raw === undefined ? null : valueFor(p, raw, bu);
      if (v !== null) { params[p.key] = v; from[p.key] = id; out.counts.fromReq++; row.values.push({ key: p.key, label: p.label, value: v, source: "req" }); }
      else { if (raw !== undefined) out.notes.push(`${id} : la valeur « ${p.key} » (${raw}) ne se lit pas dans l'unité du bloc — valeur de référence gardée.`); if (p.key !== "unit") { out.counts.reference++; row.values.push({ key: p.key, label: p.label, value: p.value, source: "ref" }); } } }
    d.objects.push({ id: oid, kind, name: r.name || `${K.label} — ${id}`, params, sure, src: from, req: id, x: 0, y: 0 }); req.objs = [oid]; out.counts.blocks++;
    feed[id] = { ref: `${oid}.${K.ports.out[0].key}`, unit: portsOf({ kind, params }).out[0].unit }; later.push({ r, oid, kind });
  }
  /* the wires the requirements name : an input from a signal or a block before, an output to a pin */
  for (const { r, oid, kind } of later) {
    const o = d.objects.find((x) => x.id === oid), P = portsOf(o), src = r.input && feed[r.input];
    if (r.input && !src) out.notes.push(`${r.id || oid} : l'entrée « ${r.input} » n'est ni un signal ni une exigence du fichier.`);
    if (src) { const port = P.in.find((p) => p.unit === src.unit && !d.wires.some((w) => w.to === `${oid}.${p.key}`)); if (port) { const w = { from: src.ref, to: `${oid}.${port.key}` }; d.wires.push(w); out.wires.push(w); } else out.notes.push(`${r.id || oid} : aucune entrée de « ${KINDS[kind].label} » ne reçoit des ${src.unit}.`); }
    if (r.output && sink[r.output]) { const port = P.out.find((p) => p.unit === "0/1"); if (port && !d.wires.some((w) => w.to === sink[r.output])) { const w = { from: `${oid}.${port.key}`, to: sink[r.output] }; d.wires.push(w); out.wires.push(w); } }
  }
  const pos = flowLayout(d); for (const o of d.objects) if (pos[o.id] && !(d0 && d0.objects.some((x) => x.id === o.id))) Object.assign(o, pos[o.id]);
  return { design: d, ...out };
}

/** The prompt, with what the project already has : its requirements (their ids kept, so the answer allocates them instead of doubling them),
    the pins the software already reads or drives, and the nets of the board that reach the microcontroller. */
export function reqPromptWith(d, board, nets = []) {
  const reqs = ((d && d.reqs) || []).filter((r) => r.on !== false).map((r) => ({ id: r.id, text: r.text, kind: r.kind, verify: r.verify, allocated: (r.objs || []).length > 0 }));
  const pins = ((d && d.objects) || []).filter((o) => KINDS[o.kind] && KINDS[o.kind].pin).map((o) => ({ id: o.id, name: o.name, kind: o.kind, net: (o.hw && o.hw.net) || "" }));
  return `${reqPrompt()}
THE PROJECT NOW (keep these ids ; for a requirement already "allocated", leave "block" out) :
${JSON.stringify({ requirements: reqs, pins, board: board ? (board.name || board.id) : null, nets_of_the_microcontroller: nets.map((n) => `${n.net} (${n.pin})`) }, null, 1)}

If the list above has requirements without a block, answer with the SAME ids and add "block", "input", "output" and "values" to each one the library can carry ; name the signals the board gives (use the nets above in "hw") ; leave the others without "block".
`;
}
