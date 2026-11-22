/* DesignOrbit.ai — Logiciel : the TRACE drawn (cycle en V, « 1 Exigences ») — three columns, as a requirements tool shows its trace :
   the requirements (a colour per kind), the tiles that carry them out (a colour per nature), the tests that prove them (green passed, red
   failed, grey not run). A line goes from a requirement to each of its tiles and to each test that names it. The requirement chosen keeps
   its lines lit, the rest fades ; a tile no requirement asks for is outlined in amber. A box is a button : a click chooses it. The page
   pans and zooms (modules/svg_view.js). Draws ; decides nothing (sw/sw_req.js). */

import { svgView } from "./svg_view.js";
import { REQ_KINDS, trace } from "../sw/sw_req.js";
import { KINDS, NATURES } from "../sw/sw_objects.js";
import { testsOf } from "../sw/sw_test.js";

const NS = "http://www.w3.org/2000/svg", W = 300, H = 40, GAP = 10, X = [20, 420, 820], TOP = 44;
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) { if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
const cut = (s, n) => (String(s || "").length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ""));

/** host ; o : { onPick({ req } | { obj } | { test }) } → { draw(d, run, sel), destroy() } */
export function traceMap(host, o = {}) {
  const view = svgView(host, { cls: "swt-map", label: "La traçabilité : exigences, tuiles, essais", data: "data-sw-trace", fitTip: "Ajuster à la fenêtre : toute la trace se voit", grab: "[data-trace-node]", maxFit: 1.1 }), svg = view.svg;
  function draw(d, run, sel) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const T = trace(d, run ? run.results : null), reqs = T.rows.filter((x) => x.state !== "off").map((x) => x.req), objs = (d.objects || []).filter((x) => !x.off && KINDS[x.kind]), tests = testsOf(d).filter((t) => t.on !== false), orphan = new Set(T.orphans);
    objs.sort((a, b) => NATURES.findIndex((n) => n.id === KINDS[a.kind].nature) - NATURES.findIndex((n) => n.id === KINDS[b.kind].nature));
    const pos = new Map(), put = (key, col, i) => pos.set(key, { x: X[col], y: TOP + i * (H + GAP) });
    reqs.forEach((r, i) => put(`req:${r.id}`, 0, i)); objs.forEach((x, i) => put(`obj:${x.id}`, 1, i)); tests.forEach((t, i) => put(`test:${t.id}`, 2, i));
    const rows = Math.max(1, reqs.length, objs.length, tests.length), box = { w: X[2] + W + 30, h: TOP + rows * (H + GAP) + 10 };
    const selKey = sel && (sel.req ? `req:${sel.req}` : sel.obj ? `obj:${sel.obj}` : sel.test ? `test:${sel.test}` : null);
    const links = []; for (const r of reqs) { for (const id of r.objs || []) if (pos.has(`obj:${id}`)) links.push([`req:${r.id}`, `obj:${id}`, "alloc"]); for (const t of tests) if ((t.reqs || []).includes(r.id)) links.push([`req:${r.id}`, `test:${t.id}`, "proof"]); }
    const near = new Set(selKey ? [selKey, ...links.filter(([a, b]) => a === selKey || b === selKey).flatMap(([a, b]) => [a, b])] : []);
    const lit = (k) => !selKey || near.has(k);
    svg.append(S("rect", { class: "swt-back", x: -5000, y: -5000, width: box.w + 10000, height: box.h + 10000 }));
    ["Exigences", "Tuiles qui les réalisent", "Essais qui les prouvent"].forEach((t, i) => svg.append(S("text", { class: "swt-head", x: X[i], y: TOP - 16 }, t)));
    const g = S("g", { class: "swt-links" }); svg.append(g);
    for (const [a, b, kind] of links) { const A = pos.get(a), B = pos.get(b); if (!A || !B) continue; const x1 = A.x + W, y1 = A.y + H / 2, x2 = B.x, y2 = B.y + H / 2, m = (x1 + x2) / 2;
      g.append(S("path", { d: kind === "proof" ? `M${x1} ${y1}C${x1 + 220} ${y1} ${x2 - 220} ${y2} ${x2} ${y2}` : `M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}`, class: `swt-link ${kind}${lit(a) && lit(b) && (!selKey || a === selKey || b === selKey) ? "" : " faded"}` })); }
    const node = (key, label, sub, color, cls, pick, extra) => { const p = pos.get(key);
      svg.append(S("g", { class: `swt-node ${cls}${key === selKey ? " on" : ""}${lit(key) ? "" : " faded"}`, tabindex: "0", role: "button", "data-trace-node": key, "aria-pressed": key === selKey ? "true" : "false", "aria-label": `${label} — ${sub}`,
        onClick: pick, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } } },
        S("rect", { class: "swt-box", x: p.x, y: p.y, width: W, height: H, rx: 7 }), S("rect", { x: p.x, y: p.y, width: 6, height: H, rx: 3, fill: color }),
        S("text", { class: "swt-id", x: p.x + 14, y: p.y + 16 }, cut(label, 40)), S("text", { class: "swt-sub", x: p.x + 14, y: p.y + 31 }, cut(sub, 52)), extra || null)); };
    const ST = Object.fromEntries(T.rows.map((x) => [x.req.id, x.state]));
    for (const r of reqs) node(`req:${r.id}`, `${r.id} · ${REQ_KINDS[r.kind].fr}`, r.text, REQ_KINDS[r.kind].color, `req ${ST[r.id]}`, () => o.onPick && o.onPick({ req: r.id }), S("text", { class: `swt-state ${ST[r.id]}`, x: pos.get(`req:${r.id}`).x + W - 8, y: pos.get(`req:${r.id}`).y + 16, "text-anchor": "end" }, { verified: "✓", failed: "✗", untested: "…", untraced: "!", signed: "✓", tosign: "✎" }[ST[r.id]] || ""));
    for (const x of objs) { const N = NATURES.find((n) => n.id === KINDS[x.kind].nature); node(`obj:${x.id}`, x.name, `${N.fr} · ${KINDS[x.kind].label}`, N.color, `obj${orphan.has(x.id) ? " orphan" : ""}`, () => o.onPick && o.onPick({ obj: x.id })); }
    for (const t of tests) { const r = run && run.results[t.id], cls = !r ? "idle" : !(t.expect || []).length ? "idle" : r.ok ? "pass" : "fail"; node(`test:${t.id}`, `${t.id} · ${t.name}`, !r ? "pas lancé" : !(t.expect || []).length ? "n'attend rien" : r.ok ? "réussi" : "échoue", cls === "pass" ? "#16a34a" : cls === "fail" ? "#dc2626" : "#94a3b8", `test ${cls}`, () => o.onPick && o.onPick({ test: t.id })); }
    view.setBox(box.w, box.h);
  }
  return { draw, destroy: view.destroy };
}
