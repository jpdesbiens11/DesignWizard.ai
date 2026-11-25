/* DynamiteOrbit.ai — Logiciel, « Essayer » : the window « Charge et équilibrage » (demande de JP, 24 novembre 2026 : « une opération du mode de
   balancement passif visuel entre plusieurs cellules débalancées… la charge ralentit pendant ce temps… de 0,1 C à 2 C… en mode accéléré »).
   A window over the page, like the monitoring one : one column per CORE — its state of charge as a level, its voltage, how far above the lowest
   it stands, and its resistor, which glows while it bleeds ; above them the charger — its current in A and in C, the phase — ; under them the
   voltages of every block in time. Time runs at ×1 to ×10 000 ; « Un pas » adds a minute. The settings that matter are on the window : where
   the charge starts, how much it slows while balancing, the resistor. What decides is the « Passive balancing » block of the software
   (sw/sw_balance.js) ; the cells are TYPICAL, and the window says so.
   What it follows : the transport of a simulator, a bar chart that is also a gauge (one level per cell block, as battery tools show them). */

import { el, btn, icon } from "../core/dom.js";
import { dragWindow } from "./sw_drag.js";
import { refCite } from "./sw_refs_ui.js";
import { balanceSpec, balanceStart, balanceStep, balanceSummary } from "../sw/sw_balance.js";

const SPEEDS = [1, 10, 100, 1000, 10000], hm = (s) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
const f = (x, d = 2) => String(x.toFixed(d)).replace(".", ",");

/** design() → { button, dispose() } — null when the software has no « Passive balancing » block */
export function swBalance(design, o = {}) {
  if (!((design() || {}).objects || []).some((o) => !o.off && o.kind === "balancing")) return null;
  const st = { open: false, run: false, speed: 1000, raf: 0, last: 0, rest: 0, over: { start: 3.0, cBal: 2, rBal: 8.2 } };
  let S = null, B = null;
  const cols = el("div", { class: "swbal-cols" }), head = el("div", { class: "swbal-head" }), chart = el("canvas", { class: "swbal-chart", role: "img", "aria-label": "Tension de chaque CORE dans le temps" });
  const go = btn("Marche", () => (st.run ? pause() : play()), { small: true, primary: true, icon: "play" }); go.dataset.balRun = "";
  const step = btn("Une minute", () => { pause(); balanceStep(B, 60); draw(); }, { small: true, icon: "chevron-right", tip: "Avancer d'une minute de charge, puis s'arrêter" });
  const again = btn("Recommencer", () => { pause(); reset(); }, { small: true, icon: "refresh" });
  const speed = el("select", { "aria-label": "Vitesse du temps", onChange: (e) => { st.speed = Number(e.target.value); } }, SPEEDS.map((k) => el("option", { value: k, selected: k === st.speed }, `×${k.toLocaleString("fr-CA")}`)));
  const num = (key, label, step0, min, max, unit, tip) => el("label", { class: "swbal-set", "data-tip": tip }, el("span", null, label), el("input", { type: "number", step: step0, min, max, value: String(st.over[key]), "data-bal-set": key, onChange: (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) { st.over[key] = v; pause(); reset(); } } }), el("small", null, unit));
  const sets = el("div", { class: "swbal-sets" }, num("start", "Départ", 0.05, 2.5, 4.1, "V", "Tension de départ de chaque CORE, au repos (0 % = 2,5 V, 100 % = 4,2 V)"), num("cBal", "Pendant l'équilibrage", 0.1, 0.05, 2, "C", "Le courant de charge pendant qu'une résistance décharge un CORE. 2 C : l'équilibrage tourne EN MÊME TEMPS que la charge, ce que prévoit un circuit de surveillance du commerce [ti-bq76952-trm]. Plus bas : la charge ralentit pour laisser l'écart se rattraper — un choix du projet, aucune source lue ne le demande"), num("rBal", "Résistance", 0.1, 1, 200, "Ω", "La résistance d'équilibrage de chaque CORE : plus petite, elle rattrape plus vite et chauffe plus"));
  const body = el("div", { class: "swbal-body" }, head, cols, el("p", { class: "swbal-note" }, "L'équilibrage passif tourne pendant la charge ou au repos, au-dessus d'une tension minimale et d'un écart ; on ne mesure pas une cellule pendant qu'on la décharge ", refCite("ti-bq76952-trm"), ". Courant d'une résistance d'un circuit du commerce : 65 à 200 mA ", refCite("ti-sluaa81a"), refCite("digikey-ltc6813"), " — 0,5 A ici demande des transistors externes. Charge : 0,1 C, puis courant constant, puis tension constante ", refCite("ti-bq24610"), refCite("bu-409"), " ; 2 C = 72 A, le maximum de la fiche de la cellule (9 A par cellule, 8 en parallèle) ", refCite("molicel-p45b"), ". Cellules TYPIQUES : courbe écrite de mémoire (0 % = 2,5 V, 100 % = 4,2 V), résistance des CORE et écarts de départ en exemple ; aucune source lue ne chiffre la durée de l'équilibrage d'une grosse cellule."), chart);
  const close = btn("", () => api.close(), { small: true, tip: "Fermer" }); close.textContent = "×"; close.classList.add("swm-x"); close.setAttribute("aria-label", "Fermer");
  const lamp = el("span", { class: "swbal-lamp", "data-bal-lamp": "off", role: "status", "aria-live": "polite" }, el("i", { "aria-hidden": "true" }), el("b", null, "Équilibrage au repos"));
  const bar = el("header", { class: "swm-head" }, icon("bolt"), el("h3", null, "Charge et équilibrage"), lamp, close);
  const win = el("div", { class: "swm swbal", role: "dialog", "aria-label": "Charge et équilibrage", tabindex: "-1", hidden: true, "data-sw-balance": "", onKeydown: (e) => { if (e.key === "Escape") api.close(); } },
    bar, el("div", { class: "swbal-bar" }, go, step, again, speed), sets, body);
  const drag = dragWindow(win, bar, "dw.sw.balance.pos");
  const button = btn("Charge et équilibrage", () => (st.open ? api.close() : api.open()), { small: true, icon: "bolt", tip: "Les 8 CORE pendant une charge : de 0,1 C à 2 C, puis l'équilibrage passif qui rattrape les écarts — en accéléré" }); button.dataset.swBalanceOpen = "";

  function reset() { S = balanceSpec(design(), { start: st.over.start, cBal: st.over.cBal, rBal: st.over.rBal }); B = balanceStart(S); draw(); }
  function play() { if (B.done) reset(); st.run = true; st.last = performance.now(); st.rest = 0; go.lastChild.textContent = "Pause"; st.raf = requestAnimationFrame(tick); }
  function pause() { st.run = false; if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; go.lastChild.textContent = "Marche"; }
  function tick(ts) { if (!st.run) return; const x = st.rest + Math.min(0.25, (ts - st.last) / 1000) * st.speed / S.dt, n = Math.floor(x); st.rest = x - n; st.last = ts; if (n) { balanceStep(B, Math.min(n, 20000)); draw(); } if (B.done) { pause(); draw(); return; } st.raf = requestAnimationFrame(tick); }
  function draw() {
    if (o.onDraw) o.onDraw(B);
    if (!st.open || !B) return; const R = balanceSummary(B), vr = B.v.map((x) => x - B.i * S.r), low = Math.min(...vr);
    head.replaceChildren(el("div", { class: `swbal-phase ${R.phase}` }, el("small", null, hm(R.t)), el("b", null, R.text)),
      el("div", { class: "swbal-gauge" }, el("small", null, "Chargeur"), el("b", null, `${f(R.i, 1)} A`), el("span", null, `${f(R.cRate, 2)} C`), el("i", { style: `width:${Math.min(100, (100 * R.cRate) / S.cHigh)}%` })),
      el("div", { class: "swbal-fig" }, el("small", null, "Écart"), el("b", { class: R.spread > S.cfg.delta ? "warn" : "ok" }, `${R.spread} mV`)), el("div", { class: "swbal-fig" }, el("small", null, "Résistances"), el("b", null, `${R.bleeding} / ${S.n}`)),
      el("div", { class: "swbal-fig" }, el("small", null, "Chaleur"), el("b", null, `${f(R.heatWh, 1)} Wh`)), el("div", { class: "swbal-fig" }, el("small", null, "Charge moyenne"), el("b", null, `${Math.round(R.socMean * 100)} %`)));
    cols.replaceChildren(...B.v.map((_, k) => { const soc = B.soc[k], on = !!B.bleed[k], dv = Math.round((vr[k] - low) * 1000);
      return el("div", { class: `swbal-col${on ? " on" : ""}`, "data-bal-core": String(k + 1) }, el("small", null, `CORE ${k + 1}`),
        el("div", { class: "swbal-cell" }, el("i", { style: `height:${Math.round(soc * 100)}%` }), el("span", null, `${Math.round(soc * 100)} %`)),
        el("b", null, `${f(vr[k], 3)} V`), el("span", { class: dv > S.cfg.delta ? "hi" : "" }, dv ? `+${dv} mV` : "le plus bas"),
        el("div", { class: "swbal-res", title: on ? `Résistance branchée : ${f(vr[k] / S.rBal, 2)} A dissipés` : "Résistance débranchée" }, resistor(on), el("small", null, on ? `${f(vr[k] / S.rBal, 2)} A` : "—"))); }));
    plot(); button.dataset.swBalancePhase = R.phase;
    /* the green light : balancing has started, and how many CORE bleed — beside the charge, not instead of it */
    lamp.dataset.balLamp = R.bleeding ? "on" : "off"; lamp.lastChild.textContent = R.bleeding ? `Équilibrage actif · ${R.bleeding} CORE` : R.phase === "done" ? "Équilibré" : "Équilibrage au repos";
  }
  function plot() {
    const T = B.trace, w = Math.max(320, chart.clientWidth || 520), h = 150, dpr = Math.min(2, window.devicePixelRatio || 1); chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); chart.style.height = `${h}px`;
    const g = chart.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = "#0b1220"; g.fillRect(0, 0, w, h); if (T.length < 2) return;
    const t1 = Math.max(60, T[T.length - 1].t), lo = 2.8, hi = 4.35, X = (t) => 34 + (w - 42) * t / t1, Y = (v) => h - 14 - (h - 24) * (v - lo) / (hi - lo);
    g.strokeStyle = "#1e293b"; g.lineWidth = 1; g.font = "10px system-ui, sans-serif"; g.fillStyle = "#64748b"; for (const v of [3.0, 3.5, 4.0, 4.2]) { g.beginPath(); g.moveTo(34, Y(v)); g.lineTo(w - 6, Y(v)); g.stroke(); g.fillText(`${f(v, 1)} V`, 2, Y(v) + 3); }
    const hue = (k) => `hsl(${(k * 360) / B.v.length} 80% 62%)`;
    for (let k = 0; k < B.v.length; k++) { g.strokeStyle = hue(k); g.lineWidth = 1.4; g.beginPath(); T.forEach((p, j) => { const y = Y(p.v[k] - p.i * S.r); if (!j) g.moveTo(X(p.t), y); else g.lineTo(X(p.t), y); }); g.stroke(); }
    g.strokeStyle = "#fbbf24"; g.setLineDash([4, 3]); g.beginPath(); T.forEach((p, j) => { const y = h - 14 - (h - 24) * Math.min(1, p.i / (S.cHigh * S.capAh)); if (!j) g.moveTo(X(p.t), y); else g.lineTo(X(p.t), y); }); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#fbbf24"; g.fillText("courant (pointillé, jusqu'à 2 C)", w - 170, 12); g.fillStyle = "#94a3b8"; g.fillText(hm(T[T.length - 1].t), w - 60, h - 2);
  }
  const resistor = (on) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 40 12"); s.setAttribute("class", `swbal-zig${on ? " on" : ""}`); s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", "M0 6 H8 L11 1 L15 11 L19 1 L23 11 L27 1 L30 6 H40"); s.append(p); return s; };
  const api = {
    button,
    open() { st.open = true; if (!win.isConnected) document.body.append(win); win.hidden = false; drag.restore({ x: Math.max(8, Math.min(330, window.innerWidth - 760)), y: 84 }); if (!B) reset(); else draw(); button.setAttribute("aria-expanded", "true"); win.focus(); },
    close() { st.open = false; pause(); win.hidden = true; button.setAttribute("aria-expanded", "false"); },
    dispose() { pause(); win.remove(); },
    get state() { return B && st.open ? B : null; },
  };
  return api;
}
