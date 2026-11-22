/* DynamiteOrbit — a screen as a document : the blocks of the document model (core/pdfdoc.js, core/docx.js) read from
   the element that shows a report on screen, so that the PDF and the Word file say exactly what the screen says — one
   source, no second report to keep in step. It reads structure, never style : titles, paragraphs, tables, lists, key
   figures, pictures. It only needs tagName, children, textContent, getAttribute, classList-like className and value :
   the tests feed it plain objects. */

const text = (n) => String(n && n.textContent !== undefined ? n.textContent : "").replace(/\s+/g, " ").trim();
const tag = (n) => String((n && n.tagName) || "").toLowerCase();
const has = (n, cls) => ` ${(n && typeof n.className === "string" ? n.className : (n && n.getAttribute && n.getAttribute("class")) || "")} `.includes(` ${cls} `);
const kids = (n) => Array.from((n && n.children) || []);
/* what a cell or a field says : the value of a field when it holds one, the chosen option of a list, the text otherwise */
function said(n) {
  const t = tag(n);
  if (t === "input" || t === "textarea") return String(n.value ?? "").trim();
  if (t === "select") { const o = kids(n).find((x) => x.selected) || kids(n)[n.selectedIndex || 0]; return o ? text(o) : ""; }
  const field = kids(n).length === 1 && ["input", "select", "textarea"].includes(tag(kids(n)[0])) ? kids(n)[0] : null;
  return field ? said(field) : text(n);
}
const rowsOf = (n, cell) => { const out = []; const walk = (x) => { for (const c of kids(x)) { if (tag(c) === "tr") { const cells = kids(c).filter((k) => tag(k) === cell || (cell === "td" && tag(k) === "th" && out.length >= 0 && kids(c).some((q) => tag(q) === "td"))); if (cells.length) out.push(cells); } else if (["thead", "tbody", "tfoot"].includes(tag(c))) walk(c); } }; walk(n); return out; };

/** The blocks of a document from an element. o : { skip(node) → true to leave a node out, level (what an h2 becomes : 1 by default — h2 → h1, h3 → h2, h4 → h3) }. */
export function blocksOf(root, o = {}) {
  const out = [], shift = (o.level ?? 1) - 2, skip = (n) => has(n, "no-print") || ["button", "svg", "script", "style", "nav"].includes(tag(n)) || (o.skip && o.skip(n));
  const visit = (n) => {
    if (!n || skip(n)) return;
    const t = tag(n);
    if (/^h[1-6]$/.test(t)) { const lvl = Math.max(1, Math.min(3, +t[1] + shift)), words = text(n); if (words) out.push({ type: `h${lvl}`, text: words }); return; }
    if (t === "table") {
      const head = rowsOf(n, "th").find((r) => r.length) || null, body = rowsOf(n, "td");
      const rows = body.map((r) => r.map((c) => said(c))).filter((r) => r.some((c) => c !== ""));
      if (!rows.length) return;
      const titled = head && head.length === rows[0].length, facts = !titled && rows[0].length === 2;
      /* each column as wide as what it says : the longest cell, between 5 and 44 characters — a number stays narrow, a sentence gets the room */
      const widths = rows[0].map((_, i) => Math.max(5, Math.min(44, Math.max(titled ? text(head[i]).length : 0, ...rows.map((r) => String(r[i] ?? "").length)))));
      out.push(facts ? { type: "kv", rows } : { type: "table", ...(titled ? { head: head.map(text) } : {}), rows, widths });
      return;
    }
    if (t === "img") { const src = n.getAttribute ? n.getAttribute("src") || n.src || "" : n.src || ""; if (/^data:image\/jpe?g/.test(src)) out.push({ type: "figure", jpeg: src, size: n.naturalWidth && n.naturalHeight ? [n.naturalWidth, n.naturalHeight] : null, width: o.figure || 120, caption: (n.getAttribute && n.getAttribute("alt")) || "" }); return; }
    if (t === "figcaption") { const last = out[out.length - 1]; if (last && last.type === "figure") last.caption = text(n); return; }
    if (t === "ul" || t === "ol") { const items = kids(n).filter((c) => tag(c) === "li").map(text).filter(Boolean); if (items.length) out.push({ type: "list", ordered: t === "ol", items }); return; }
    if (has(n, "kpis")) { const rows = kids(n).filter((c) => has(c, "kpi")).map((c) => { const b = kids(c).find((x) => tag(x) === "b"), s = kids(c).find((x) => tag(x) === "span"); return [text(s), text(b)]; }).filter((r) => r[0] || r[1]); if (rows.length) out.push({ type: "kv", rows }); return; }
    if (has(n, "finding")) { const words = text(n); if (words) out.push({ type: "p", text: words, style: has(n, "error") ? "warn" : null }); return; }
    if (has(n, "field")) { const label = kids(n).find((c) => has(c, "field-label")), f = kids(n).find((c) => ["input", "select", "textarea"].includes(tag(c))); if (label && f) { const last = out[out.length - 1], row = [text(label), said(f) || "—"]; if (last && last.type === "kv" && last.fields) last.rows.push(row); else out.push({ type: "kv", rows: [row], fields: true }); return; } }
    if (t === "p" || t === "small" || t === "label") { const words = text(n); if (words) out.push({ type: "p", text: words, style: has(n, "muted") ? "muted" : has(n, "form-error") ? "warn" : null }); return; }
    for (const c of kids(n)) visit(c);
  };
  visit(root);
  return out.map((b) => { const c = { ...b }; delete c.fields; if (c.style === null) delete c.style; return c; });
}
