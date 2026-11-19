/* DesignWizard.ai — Labo, what one LOOKS at : the board seen from above, whose tracks and parts light up as the simulated
   current runs through them (demande de JP : « les traces et composantes doivent s'allumer comme si c'étaient des lumières,
   en orange ou rouge, et flasher pendant les cycles actifs… on veut voir le changement d'état clairement ») ; two
   oscilloscopes — the signal put in, the signal that comes out — with a cursor that runs along the trace ; and, for a test
   in frequency, the transfer function as a Bode plot. The numbers come from pcba/lab_bench.js ; nothing is decided here. */

import { el, svg } from "../core/dom.js";
import { eng } from "../pcba/lab_bench.js";
import { channelSetting, timeBase } from "../pcba/lab_plan.js";

const pts = (a) => a.map((p) => `${p[0]},${p[1]}`).join(" ");
/* from rest to full : dark copper, orange, then red — the colour of a filament that heats */
function heat(a) { const x = Math.max(0, Math.min(1, a)), mix = (p, q, t) => Math.round(p + (q - p) * t), c = x < 0.5 ? [mix(122, 255, x * 2), mix(84, 150, x * 2), mix(40, 20, x * 2)] : [255, mix(150, 40, (x - 0.5) * 2), mix(20, 20, (x - 0.5) * 2)]; return `rgb(${c[0]},${c[1]},${c[2]})`; }
const LED = { rouge: "#ff3b30", verte: "#34d058", jaune: "#ffd60a", orange: "#ff9f0a", bleue: "#3b9bff", blanche: "#f5f7fa" };

/** The board. → { show(R, o), light(frame), destroy() }
    R : the resolved board (pcba/model.js resolveBoard) ; o : { focus: Set of references under test (the rest is dimmed) }
    frame : { parts: { ref: 0..1 }, nets: { board net: 0..1 }, states: [{ ref, on, text, kind, color, label }] } */
export function labBoard(host) {
  host.classList.add("lab-board");
  const root = svg("svg", { class: "lab-svg", preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "La carte vue de dessus : les pistes et les composants s'allument avec le courant" }), world = svg("g", { transform: "scale(1,-1)" }), tags = el("div", { class: "lab-tags" });
  root.append(svg("defs", null, svg("filter", { id: "lab-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, svg("feGaussianBlur", { stdDeviation: 0.7, result: "b" }), svg("feMerge", null, svg("feMergeNode", { in: "b" }), svg("feMergeNode", { in: "SourceGraphic" })))), world); host.append(root, tags);
  let tracks = new Map(), parts = new Map(), vb = null, drag = null;
  const setVb = () => root.setAttribute("viewBox", vb.join(" "));
  root.addEventListener("wheel", (e) => { if (!vb) return; e.preventDefault(); const r = root.getBoundingClientRect(), k = e.deltaY > 0 ? 1.2 : 1 / 1.2, fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, w = vb[2] * k, h = vb[3] * k; vb = [vb[0] + (vb[2] - w) * fx, vb[1] + (vb[3] - h) * fy, w, h]; setVb(); }, { passive: false });
  root.addEventListener("pointerdown", (e) => { if (!vb) return; root.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, vb: [...vb] }; });
  root.addEventListener("pointermove", (e) => { if (!drag) return; const r = root.getBoundingClientRect(), k = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height); vb = [drag.vb[0] - (e.clientX - drag.x) * k, drag.vb[1] - (e.clientY - drag.y) * k, vb[2], vb[3]]; setVb(); });
  root.addEventListener("pointerup", () => { drag = null; });
  return {
    show(R, o = {}) {
      world.replaceChildren(); tags.replaceChildren(); tracks = new Map(); parts = new Map(); const focus = o.focus || null, b = R.bbox, m = 3;
      vb = [b[0] - m, -b[3] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m]; setVb();
      world.append(svg("polygon", { points: pts(R.outline), class: "lab-fr4" }));
      const copper = svg("g", { class: "lab-copper" }), bodies = svg("g", { class: "lab-parts" }); world.append(copper, bodies);
      const lay = (net, node) => { if (!tracks.has(net)) tracks.set(net, []); tracks.get(net).push(node); copper.append(node); };
      const routed = new Set(); for (const t of R.tracks || []) { if (!t.pts || t.pts.length < 2) continue; routed.add(t.net); lay(t.net, svg("polyline", { points: pts(t.pts), class: "lab-track", "stroke-width": Math.max(0.25, t.w || 0.3), "data-net": t.net })); }
      /* a net that is not routed yet is shown as the straight lines its copper will follow : the current still has to be seen */
      for (const n of R.nets || []) { if (routed.has(n.name) || n.pads.length < 2 || n.pads.length > 14) continue; const P = n.pads.map((i) => R.pads[i]); for (let i = 1; i < P.length; i++) lay(n.name, svg("line", { x1: P[i - 1].x, y1: P[i - 1].y, x2: P[i].x, y2: P[i].y, class: "lab-track lab-air", "stroke-width": 0.22, "data-net": n.name })); }
      for (const p of R.pads || []) copper.append(svg("rect", { x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h, rx: Math.min(p.w, p.h) * 0.2, class: "lab-pad" }));
      for (const p of R.parts || []) { const [x0, y0, x1, y1] = p.box, dim = focus && !focus.has(p.ref), g = svg("g", { class: `lab-part${dim ? " dim" : ""}`, "data-ref": p.ref }), body = svg("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: Math.min(x1 - x0, y1 - y0) * 0.14, class: "lab-body" }), halo = svg("circle", { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) * 1.1, class: "lab-halo", opacity: 0 });
        const s = Math.max(0.9, Math.min(2.2, Math.min(x1 - x0, y1 - y0) * 0.55)), name = svg("text", { x: (x0 + x1) / 2, y: -(y0 + y1) / 2 + s * 0.35, transform: "scale(1,-1)", "text-anchor": "middle", "font-size": s, class: "lab-ref" }, p.ref);
        g.append(halo, body, name); bodies.append(g); parts.set(p.ref, { g, body, halo, box: p.box }); }
      for (const [net, nodes] of tracks) if (focus) { const mine = (R.nets.find((n) => n.name === net) || { pads: [] }).pads.some((i) => focus.has(R.pads[i].ref)); if (!mine) nodes.forEach((n) => n.classList.add("dim")); }
    },
    light(frame) {
      for (const [net, nodes] of tracks) { const a = frame.nets && frame.nets[net]; for (const n of nodes) { if (a === undefined) { n.style.stroke = ""; n.style.opacity = ""; n.removeAttribute("filter"); } else { n.style.stroke = heat(a); n.style.opacity = String(0.55 + 0.45 * a); if (a > 0.35) n.setAttribute("filter", "url(#lab-glow)"); else n.removeAttribute("filter"); } } }
      for (const [ref, p] of parts) { const a = frame.parts && frame.parts[ref]; p.body.style.fill = a === undefined || a < 0.02 ? "" : heat(a); p.body.style.fillOpacity = a === undefined || a < 0.02 ? "" : String(0.35 + 0.65 * a); p.halo.setAttribute("opacity", "0"); p.g.classList.remove("on"); }
      tags.replaceChildren();
      for (const s of frame.states || []) { const p = parts.get(s.ref); if (!p) continue; if (s.on) { p.g.classList.add("on"); if (s.kind === "led") { p.halo.style.fill = LED[s.color] || LED.verte; p.halo.setAttribute("opacity", "0.75"); p.body.style.fill = LED[s.color] || LED.verte; p.body.style.fillOpacity = "1"; } }
        if (!s.on && ["clamp", "switch", "reg", "switching", "sound"].includes(s.kind)) continue;                // what does nothing just now is not written over the board
        const r = root.getBoundingClientRect(), k = Math.min(r.width / vb[2], r.height / vb[3]), ox = (r.width - vb[2] * k) / 2, oy = (r.height - vb[3] * k) / 2, cx = ox + ((p.box[0] + p.box[2]) / 2 - vb[0]) * k, cy = oy + (-p.box[3] - vb[1]) * k;
        tags.append(el("span", { class: `lab-tag ${s.kind}${s.on ? " on" : ""}`, style: `left:${cx}px;top:${cy}px`, "data-state": s.ref }, el("i"), el("b", null, s.label), ` ${s.text}`)); }
    },
    destroy() { root.remove(); tags.remove(); },
  };
}

const css = (name, d) => (getComputedStyle(document.documentElement).getPropertyValue(name) || d).trim() || d;
/** An oscilloscope : one trace, its grid of ten divisions by eight, a cursor. → { draw(t, y, q, o), node }
    o : { label, ac (the trace is shown around its mean), color } ; q : how far the cursor is, 0..1 */
export function scope(o = {}) {
  const canvas = el("canvas", { class: "lab-scope", width: 520, height: 300, role: "img", "aria-label": `Oscilloscope — ${o.label || ""}` }), read = el("div", { class: "lab-read" }), node = el("div", { class: "lab-scope-box", "data-scope": o.ch || "" }, el("div", { class: "lab-scope-head" }, el("b", { style: `color:${o.color}` }, `CH${o.ch}`), el("span", null, o.label || ""), read), canvas);
  return { node, draw(t, y, q, s = {}) {
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height, n = y.length, set = channelSetting(y, !!s.ac), vdiv = set.vdiv, mid = s.ac ? (set.min + set.max) / 2 : Math.round(((set.min + set.max) / 2 / vdiv)) * vdiv, tdiv = timeBase(t[n - 1] - t[0]), yOf = (v) => H / 2 - ((v - mid) / vdiv) * (H / 8), xOf = (k) => ((t[k] - t[0]) / (10 * tdiv)) * W;      // ten divisions of a time base one can set : 1, 2 or 5
    g.fillStyle = "#0b1410"; g.fillRect(0, 0, W, H); g.strokeStyle = "rgba(120,160,140,.28)"; g.lineWidth = 1; g.beginPath(); for (let i = 1; i < 10; i++) { g.moveTo((i * W) / 10, 0); g.lineTo((i * W) / 10, H); } for (let j = 1; j < 8; j++) { g.moveTo(0, (j * H) / 8); g.lineTo(W, (j * H) / 8); } g.stroke();
    g.strokeStyle = "rgba(160,200,180,.5)"; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    const upto = Math.max(1, Math.round(q * (n - 1))), step = Math.max(1, Math.floor(n / (W * 2))), line = (k0, k1, alpha, w) => { g.globalAlpha = alpha; g.lineWidth = w; g.strokeStyle = o.color; g.beginPath(); for (let k = k0; k <= k1; k += step) { const X = xOf(k), Y = Math.max(-4, Math.min(H + 4, yOf(y[k]))); if (k === k0) g.moveTo(X, Y); else g.lineTo(X, Y); } g.stroke(); g.globalAlpha = 1; };
    line(0, n - 1, 0.28, 1.4); g.shadowColor = o.color; g.shadowBlur = 8; line(0, upto, 1, 2.2); g.shadowBlur = 0;
    const X = xOf(upto), Y = Math.max(4, Math.min(H - 4, yOf(y[upto]))); g.fillStyle = "#fff"; g.beginPath(); g.arc(X, Y, 4, 0, 2 * Math.PI); g.fill(); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(X, 0); g.lineTo(X, H); g.stroke();
    read.textContent = `${eng(vdiv, "V")}/div · ${eng(tdiv, "s")}/div${s.ac ? " · AC" : ""} — ${eng(y[upto], "V").replace("-", "−")} à ${eng(t[upto] - t[0], "s")}`;
  } };
}
/** The transfer function : gain (decibels) and phase against frequency, the cut-off marked. → { node, draw(ac, cut, q) } */
export function bode() {
  const canvas = el("canvas", { class: "lab-scope lab-bode", width: 1060, height: 300, role: "img", "aria-label": "Fonction de transfert : gain et phase selon la fréquence" }), read = el("div", { class: "lab-read" }), node = el("div", { class: "lab-scope-box wide", "data-scope": "bode" }, el("div", { class: "lab-scope-head" }, el("b", { style: "color:#ffd60a" }, "Gain"), el("b", { style: "color:#5ac8fa" }, "Phase"), el("span", null, "Fonction de transfert (sortie ÷ entrée)"), read), canvas);
  return { node, draw(ac, cut, q) {
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height, n = ac.f.length, f0 = Math.log10(ac.f[0]), f1 = Math.log10(ac.f[n - 1]), top = Math.ceil((Math.max(...ac.db) + 3) / 10) * 10, bot = Math.min(top - 40, Math.floor((Math.min(...ac.db) - 3) / 10) * 10), xOf = (f) => ((Math.log10(f) - f0) / (f1 - f0)) * W, yOf = (db) => ((top - db) / (top - bot)) * H, pOf = (ph) => H / 2 - (ph / 180) * (H / 2);
    g.fillStyle = "#0b1410"; g.fillRect(0, 0, W, H); g.font = "12px sans-serif"; g.lineWidth = 1;
    for (let d = Math.ceil(f0); d <= Math.floor(f1); d++) { const X = xOf(Math.pow(10, d)); g.strokeStyle = "rgba(120,160,140,.4)"; g.beginPath(); g.moveTo(X, 0); g.lineTo(X, H); g.stroke(); g.fillStyle = "rgba(200,230,215,.8)"; g.fillText(eng(Math.pow(10, d), "Hz"), X + 4, H - 6); for (const m of [2, 5]) { const x2 = xOf(m * Math.pow(10, d)); if (x2 < W) { g.strokeStyle = "rgba(120,160,140,.16)"; g.beginPath(); g.moveTo(x2, 0); g.lineTo(x2, H); g.stroke(); } } }
    for (let db = top; db >= bot; db -= 10) { g.strokeStyle = "rgba(120,160,140,.28)"; g.beginPath(); g.moveTo(0, yOf(db)); g.lineTo(W, yOf(db)); g.stroke(); g.fillStyle = "rgba(255,214,10,.8)"; g.fillText(`${db} dB`, 4, yOf(db) - 3); }
    const upto = Math.max(1, Math.round(q * (n - 1))), curve = (get, color, k1, alpha, w) => { g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = w; g.beginPath(); for (let k = 0; k <= k1; k++) { const X = xOf(ac.f[k]), Y = get(k); if (k) g.lineTo(X, Y); else g.moveTo(X, Y); } g.stroke(); g.globalAlpha = 1; };
    curve((k) => pOf(ac.phase[k]), "#5ac8fa", n - 1, 0.25, 1.2); curve((k) => yOf(ac.db[k]), "#ffd60a", n - 1, 0.3, 1.4); curve((k) => pOf(ac.phase[k]), "#5ac8fa", upto, 0.9, 1.6); g.shadowColor = "#ffd60a"; g.shadowBlur = 8; curve((k) => yOf(ac.db[k]), "#ffd60a", upto, 1, 2.2); g.shadowBlur = 0;
    if (Number.isFinite(cut)) { const X = xOf(cut); g.strokeStyle = "#ff453a"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X, 0); g.lineTo(X, H); g.stroke(); g.setLineDash([]); g.fillStyle = "#ff453a"; g.fillText(`−3 dB à ${eng(cut, "Hz")}`, Math.min(W - 130, X + 6), 16); }
    g.fillStyle = "#fff"; g.beginPath(); g.arc(xOf(ac.f[upto]), yOf(ac.db[upto]), 4, 0, 2 * Math.PI); g.fill();
    read.textContent = `${eng(ac.f[upto], "Hz")} — gain ${String(+ac.gain[upto].toPrecision(3)).replace(".", ",")} (${ac.db[upto].toFixed(1).replace(".", ",")} dB), phase ${String(Math.round(ac.phase[upto])).replace("-", "−")}°`.replace("(-", "(−");
  } };
}
export { css };
