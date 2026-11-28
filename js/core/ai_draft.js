/* DynamiteOrbit.ai — the guardrails of co-intelligence, the same as on the DynamiteAgile platform : what comes back
   from an AI is a draft until a human says otherwise (« Brouillon IA »), and a standard an AI names is not a
   reference until a human has confirmed its edition and its clause. markAiDraft() tags what an answer adds or
   changes ; confirmDraft() lifts the tag ; draftsOf() lists what is still waiting — a design review does not pass
   while anything waits. The tag lives on the item itself : ai = { draft: true, norms: [references to confirm] }. */

/** The lists of each kind of artefact whose items are tagged. */
export const DRAFT_LISTS = { board: ["functions", "blocks"] };
const keyOf = (x) => (x && typeof x === "object" ? x.id ?? x.ref ?? x.name ?? null : null);
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v));
const bare = (x) => { const { ai, ...rest } = x; return canon(rest); };      // the same content whatever the order of its keys
const NORM = /\b(?:ISO(?:\/IEC)?|IEC|CEI|EN|IPC|UL|ASTM|DIN|SAE|IEEE|JEDEC|J-STD|MIL-STD|NF|CSA|ASME|AIAG)[ -][A-Z]{0,2}-?\d{2,6}(?:[-:./]\d{1,4})*[A-Z]?\b/g;
const strings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "ai" && k !== "norms") strings(x, out); return out; };

/** The standards a text names : ["IPC-2221B", "IEC 60664-1"]. */
export function normsIn(text) { return [...new Set((String(text || "").match(NORM) || []).map((s) => s.replace(/\s+/g, " ")))]; }

/** Tags what an answer adds or changes. `after` is modified. → { drafts: [{ list, key }], norms: [references] } */
export function markAiDraft(before, after, kind = "board") {
  const drafts = [], norms = new Set();
  for (const list of DRAFT_LISTS[kind] || []) {
    const old = new Map(((before && before[list]) || []).map((x) => [String(keyOf(x)), x]));
    for (const item of (after && after[list]) || []) {
      const key = String(keyOf(item)), was = old.get(key);
      if (was && bare(was) === bare(item)) { if (was.ai) item.ai = was.ai; else delete item.ai; continue; }      // untouched : it keeps the state it had
      const known = new Set([...(was ? normsIn(strings(was).join(" ")) : []), ...((item.norms || []).map((n) => n.ref))]), named = normsIn(strings(item).join(" ")).filter((n) => !known.has(n));
      item.ai = { draft: true, ...(named.length || (was && was.ai && was.ai.norms) ? { norms: [...new Set([...((was && was.ai && was.ai.norms) || []), ...named])] } : {}) };
      drafts.push({ list, key }); for (const n of item.ai.norms || []) norms.add(n);
    }
  }
  return { drafts, norms: [...norms] };
}

/** What still waits for a human. → [{ list, key, name, norms }] */
export function draftsOf(doc, kind = "board") {
  const out = [];
  for (const list of DRAFT_LISTS[kind] || []) for (const item of (doc && doc[list]) || []) if (item.ai && item.ai.draft) out.push({ list, key: String(keyOf(item)), name: item.name || "", norms: item.ai.norms || [] });
  return out;
}

/** A human confirms an item. given : { "IPC-2221B": { edition, clause } } for each standard the AI named.
    → { ok, missing: [references whose edition or clause is not given] } ; nothing changes while something is missing. */
export function confirmDraft(item, given = {}) {
  if (!item || !item.ai) return { ok: true, missing: [] };
  const missing = (item.ai.norms || []).filter((n) => !given[n] || !String(given[n].edition || "").trim() || !String(given[n].clause || "").trim());
  if (missing.length) return { ok: false, missing };
  for (const n of item.ai.norms || []) { item.norms = (item.norms || []).filter((x) => x.ref !== n); item.norms.push({ ref: n, edition: String(given[n].edition).trim(), clause: String(given[n].clause).trim() }); }
  delete item.ai;
  return { ok: true, missing: [] };
}
