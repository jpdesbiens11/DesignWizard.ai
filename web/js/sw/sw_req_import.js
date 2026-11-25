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
   A block with SEVERAL inputs or outputs names each one : "inputs": { "a": "SWR-017", "b": "SWR-018" } (the keys are the ports of the block below) and "outputs": { "emergency": "emerg_flag" } ; a source may name the port of another block : "SWR-024.close". Leave NO input of a block unwired and NO signal unused : every "in" signal is read by a block, every "out" signal is driven by one — the tool lists the loose ends.
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
  const first = s.split(/\r?\n/)[0].replace(/"[^"]*"/g, ""), sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";      // the separator of the header line : a « ; » inside a cell of a comma list stays text
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c; }
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

const cfgUnit = (o) => (o.params && o.params.unit) || "mV";
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
    /* the scaling of a signal the file already declares : the requirement is carried by ITS block, not by a second one without an input */
    const sig = kind === "analog_in" && r.input && feed[r.input] && d.objects.find((x) => `${x.id}.value` === feed[r.input].ref && x.kind === "analog_in");
    if (sig) { for (const p of KINDS.analog_in.params) { const raw = r.values ? r.values[p.key] : undefined, v = raw === undefined ? null : valueFor(p, raw, cfgUnit(sig)); if (v === null) continue; sig.params = { ...(sig.params || {}), [p.key]: v }; sig.src = { ...(sig.src || {}), [p.key]: id }; out.counts.fromReq++; row.values.push({ key: p.key, label: p.label, value: v, source: "req" }); }
      sig.req = sig.req || id; req.objs = [sig.id]; feed[id] = feed[r.input]; row.state = "made"; continue; }
    const K = KINDS[kind], src = r.input && feed[r.input], unitP = K.params.find((p) => p.key === "unit"), oid = fresh(r.name || `${kind}_${id}`), params = {}, sure = [], from = {};
    if (unitP && src && unitP.choices.includes(src.unit)) { params.unit = src.unit; sure.push("unit"); }
    const bu = params.unit || (unitP ? unitP.value : "");
    for (const p of K.params) { if (p.key === "unit" && params.unit) continue; const raw = r.values ? r.values[p.key] : undefined, v = raw === undefined ? null : valueFor(p, raw, bu);
      if (v !== null) { params[p.key] = v; from[p.key] = id; out.counts.fromReq++; row.values.push({ key: p.key, label: p.label, value: v, source: "req" }); }
      else { if (raw !== undefined) out.notes.push(`${id} : la valeur « ${p.key} » (${raw}) ne se lit pas dans l'unité du bloc — valeur de référence gardée.`); if (p.key !== "unit") { out.counts.reference++; row.values.push({ key: p.key, label: p.label, value: p.value, source: "ref" }); } } }
    d.objects.push({ id: oid, kind, name: r.name || `${K.label} — ${id}`, params, sure, src: from, req: id, x: 0, y: 0 }); req.objs = [oid]; out.counts.blocks++;
    feed[id] = { ref: `${oid}.${K.ports.out[0].key}`, unit: portsOf({ kind, params }).out[0].unit }; later.push({ r, oid, kind });
  }
  /* the wires the requirements name : an input from a signal or a block before, an output to a pin.
     « input » names one source ; « inputs » names several, by port ({ "b": "SWR-018" }) or in order ([...]) ; a source may name a port of a
     block (« SWR-024.close ») ; « outputs » names the pins each output drives ({ "emergency": "emerg_flag" }). A gate or a latch that names
     only one input takes the others from the ids its sentence quotes (« SWR-017 OR SWR-018 ») — the loose ends of a list written by hand. */
  const resolve = (ref) => { const [id, port] = String(ref).split(/\.(?=[a-z_]+$)/); const f = feed[id]; if (!f || !port) return f;
    const req = d.reqs.find((x) => x.id === id), o = req && d.objects.find((x) => x.id === (req.objs || [])[0]), P = o && portsOf(o).out.find((q) => q.key === port); return P ? { ref: `${o.id}.${port}`, unit: P.unit } : null; };
  const wire = (oid, key, src, why) => { const w = { from: src.ref, to: `${oid}.${key}` }; if (d.wires.some((x) => x.to === w.to)) return false; d.wires.push(w); out.wires.push(w); return true; };
  for (const { r, oid, kind } of later) {
    const o = d.objects.find((x) => x.id === oid), P = portsOf(o), free = (src) => P.in.find((p) => p.unit === src.unit && !d.wires.some((w) => w.to === `${oid}.${p.key}`));
    const named = r.inputs && !Array.isArray(r.inputs) && typeof r.inputs === "object" ? Object.entries(r.inputs) : [];
    const list = [...(r.input ? [r.input] : []), ...(Array.isArray(r.inputs) ? r.inputs : [])];
    if (!named.length && !Array.isArray(r.inputs)) for (const m of String(r.text).match(/\b[A-Z][A-Z0-9]*-\d+\b/g) || []) if (m !== r.id && !list.includes(m) && feed[m]) list.push(m);
    for (const [key, ref] of named) { const src = resolve(ref), port = P.in.find((p) => p.key === key);
      if (!src) out.notes.push(`${r.id || oid} : l'entrée « ${ref} » n'est ni un signal ni une exigence du fichier.`); else if (!port) out.notes.push(`${r.id || oid} : « ${KINDS[kind].label} » n'a pas d'entrée « ${key} ».`); else if (port.unit !== src.unit) out.notes.push(`${r.id || oid} : l'entrée « ${key} » attend des ${port.unit}, « ${ref} » donne des ${src.unit}.`); else wire(oid, key, src); }
    for (const ref of list) { const src = resolve(ref); if (!src) { out.notes.push(`${r.id || oid} : l'entrée « ${ref} » n'est ni un signal ni une exigence du fichier.`); continue; }
      let port = free(src);
      if (!port) { const [sid] = src.ref.split("."), so = d.objects.find((x) => x.id === sid), alt = so && portsOf(so).out.find((q) => P.in.some((p) => p.unit === q.unit && !d.wires.some((w) => w.to === `${oid}.${p.key}`)));      // a block with several outputs : the first that fits, said
        if (alt) { const s2 = { ref: `${sid}.${alt.key}`, unit: alt.unit }; port = free(s2); if (port) { wire(oid, port.key, s2); out.notes.push(`${r.id || oid} : de « ${ref} », l'outil a pris la sortie « ${alt.key} » — à vérifier, ou à nommer (« ${ref}.${alt.key} »).`); continue; } } }
      if (port) wire(oid, port.key, src); else out.notes.push(`${r.id || oid} : aucune entrée libre de « ${KINDS[kind].label} » ne reçoit des ${src.unit} (« ${ref} »).`); }
    const outs = r.outputs && typeof r.outputs === "object" && !Array.isArray(r.outputs) ? Object.entries(r.outputs) : [];
    if (r.output) { const port = P.out.find((p) => p.unit === "0/1" && !outs.some(([k]) => k === p.key)); if (port) outs.unshift([port.key, r.output]); }
    for (const [key, sig] of outs) { const port = P.out.find((p) => p.key === key); if (!sink[sig]) { out.notes.push(`${r.id || oid} : la sortie « ${sig} » n'est pas un signal de sortie du fichier.`); continue; } if (!port) { out.notes.push(`${r.id || oid} : « ${KINDS[kind].label} » n'a pas de sortie « ${key} ».`); continue; }
      if (!d.wires.some((w) => w.to === sink[sig])) { const w = { from: `${oid}.${key}`, to: sink[sig] }; d.wires.push(w); out.wires.push(w); } }
  }
  out.loose = looseEnds(d, data);
  const pos = flowLayout(d); for (const o of d.objects) if (pos[o.id] && !(d0 && d0.objects.some((x) => x.id === o.id))) Object.assign(o, pos[o.id]);
  return { design: d, ...out };
}

/** The LOOSE ENDS of a software after an import (JP : « je l'ai essayé et il y a des bouts libres ») : a signal of the file read by no block, a
    pin driven by none, an input of a block left unwired, a requirement no block carries (a block still to come, or none named).
    → [{ kind: "signal-in" | "signal-out" | "input" | "planned" | "none", id, text }] */
export function looseEnds(d, data = {}) {
  const out = [], W = d.wires || [], objs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind]);
  for (const o of objs) { const K = KINDS[o.kind];
    if (K.pin === "ain" || K.pin === "din") { if (!W.some((w) => w.from.startsWith(`${o.id}.`) && !objs.some((x) => x.kind === "analog_in" && w.to === `${x.id}.counts` && !W.some((v) => v.from.startsWith(`${x.id}.`))))) out.push({ kind: "signal-in", id: o.id, text: `${o.name} : lu par aucun bloc.` }); }
    else if (K.pin === "dout") { if (!W.some((w) => w.to === `${o.id}.level`)) out.push({ kind: "signal-out", id: o.id, text: `${o.name} : aucun bloc ne la commande.` }); }
    else for (const p of portsOf(o).in) if (!p.free && !W.some((w) => w.to === `${o.id}.${p.key}`)) out.push({ kind: "input", id: o.id, text: `${o.name} : l'entrée « ${p.label} » n'est reliée à rien.` }); }
  /* a requirement on the period of the software is held by the architecture : the period of the design */
  const byArch = (r) => { const m = /\b(?:period|période)\D{0,30}?(\d+)\s*ms\b/i.exec(r.text || ""); return !!m && Number(m[1]) === Number(d.period); };
  for (const r of (d.reqs || []).filter((x) => x.on !== false && !(x.objs || []).length && !byArch(x))) { const src = (data.requirements || []).find((x) => x && String(x.id) === r.id), planned = src && src.block && LIBRARY.some((x) => x.planned && x.id === src.block);
    out.push({ kind: planned ? "planned" : "none", id: r.id, text: planned ? `${r.id} : son bloc (« ${src.block} ») est à venir dans l'outil — l'exigence est gardée, portée par rien.` : `${r.id} : aucun bloc ne la porte — ${r.verify === "analysis" || r.verify === "review" ? "elle se vérifie par analyse ou revue." : "à porter par un bloc, ou à vérifier autrement."}` }); }
  return out;
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
