/* DynamiteOrbit.ai — Labo, table : the view « En marche » — the two kinds of boards at work together (JP, 27 novembre 2026 : « 2 pcb types that
   speak to each other when powered with 12 V and do all functions related to HW » ; choix par menu : « Les 2 cartes en marche »).
   Above the main board, the lab supply on its 12 V connector, On / Off ; to the right, the CORE boards in a daisy chain, each with what it reads
   and its bleed resistor, the one that transmits now lit (the token moves one slot a frame of the screen : slowed down, said) ; under them, ONE
   cycle of the round-robin to scale — each frame, its silence, the cycle in its period. In the right pane, every hardware function of the main
   board — its net, its pin, its value now — and the frame of the CORE chosen, byte by byte. What runs : the software of the main board against
   the module on its bench (sw/sw_live.js) ; the boards set WAKE and the silence of the round-robin themselves (pcba/lab_system.js). The usage
   followed : a system bench — supplies, boards, harness — with a bus analyser's timing view under it. */

import { el, svg, btn, onOff, toast } from "../core/dom.js";
import { systemOf, systemPower, roundRobin, nodeReadings, coreFrame, benchFromBoards, hwFunctions, FRAME, SYSTEM_GAPS } from "../pcba/lab_system.js";
import { liveStart, liveSet, liveStep, liveDrive } from "../sw/sw_live.js";
import { cfgOf } from "../sw/sw_objects.js";
import { STATE_NAMES } from "../sw/sw_units.js";
import { gearPic } from "./elab_gear.js";

const fr = (v, d = 1) => String(+(+v).toFixed(d)).replace(".", ",");
const SPEEDS = [1, 10, 60], DRIVES = [["rest", "Repos", { mode: "rest" }], ["charge", "Charge", { mode: "charge" }], ["discharge", "Décharge 72 A", { mode: "discharge", a: 72 }]];
const STATE_COL = ["#16a34a", "#ca8a04", "#dc2626", "#7f1d1d"];

/** o : { project(), redraw() — the drawing and the right pane, each frame ; refresh() — the whole screen, after a click } → { bar(), draw(g) → box, right(pane), click(target), stop() } */
export function systemRun(o) {
  const st = { v12: true, cut: false, run: false, speed: 10, drive: "rest", sel: 1, token: 0, L: null, key: "", timer: 0, ackUntil: 0 };
  const design = (s) => ((o.project().software) || []).find((d) => d.board === s.main.id && d.plant) || null;
  function ensure() {
    const s = systemOf(o.project()), d = s && design(s), k = s && d ? `${s.main.id}|${s.node.id}|${d.id}` : "";
    if (k !== st.key) { st.key = k; st.L = d ? liveStart(d, 10) : null; if (st.L) { liveDrive(st.L, { mode: "rest", start: 3.8 }); inputs(s, d); liveStep(st.L, 100); } }
    return { s, d };
  }
  /* the boards set two inputs of the bench by themselves : WAKE is the 12 V, the round-robin is silent without its bus side or with the chain cut */
  function inputs(s, d) { const P = systemPower(s, { v12: st.v12 }), b = benchFromBoards(P, st.cut), pl = d.plant || {};
    if (pl.wake) liveSet(st.L, pl.wake, b.wake); if (pl.lost) liveSet(st.L, pl.lost, b.lost); if (pl.ack) liveSet(st.L, pl.ack, Date.now() < st.ackUntil ? 1 : 0); return P; }
  function tick() { const { s, d } = ensure(); if (!st.L) return; inputs(s, d); liveStep(st.L, Math.max(1, Math.round((200 * st.speed) / st.L.m.dt))); st.token = (st.token + 1) % (s.n + 2); o.redraw(); }
  const play = () => { st.run = true; clearInterval(st.timer); st.timer = setInterval(tick, 200); o.refresh(); }, pause = () => { st.run = false; clearInterval(st.timer); st.timer = 0; o.refresh(); };
  const drive = (k) => { st.drive = k; const { s } = ensure(); if (st.L && s) liveDrive(st.L, { ...DRIVES.find((x) => x[0] === k)[2] }); if (!st.run) play(); else o.refresh(); };
  const last = () => (st.L ? st.L.m.last : {});

  function bar() {
    const sw12 = onOff(st.v12, (on) => { st.v12 = on; const { s, d } = ensure(); if (st.L) inputs(s, d); toast(on ? "12 V présent : la carte principale alimente le bus side des CORE boards, le round-robin reprend." : "12 V coupé : les CORE boards sont silent, la carte principale reste en standby sur le module, le contactor s'ouvre.", "info", 5000); o.refresh(); }, "Alimentation 12 V de la carte principale");
    return [el("label", { class: "sys-12v", "data-sys-12v": "" }, sw12, el("b", null, " 12 V")),
      el("div", { class: "role-switch", role: "radiogroup", "aria-label": "Ce que fait le module" }, DRIVES.map(([k, l]) => el("button", { type: "button", role: "radio", "aria-checked": st.drive === k ? "true" : "false", class: st.drive === k ? "on" : "", style: { "--g": "#2563eb" }, "data-sys-drive": k, onClick: () => drive(k) }, l))),
      btn(st.run ? "Pause" : "Marche", () => (st.run ? pause() : play()), { small: true, primary: !st.run, icon: st.run ? "pause" : "play" }),
      el("select", { "aria-label": "Vitesse du temps", style: { width: "auto" }, onChange: (e) => { st.speed = Number(e.target.value); } }, SPEEDS.map((k) => el("option", { value: k, selected: k === st.speed }, `×${k}`))),
      btn(st.cut ? "Rebrancher la daisy chain" : "Débrancher la daisy chain", () => { st.cut = !st.cut; o.refresh(); }, { small: true, icon: "link", tip: "Un connecteur de la daisy chain décroche : la carte principale ne reçoit plus de frames — timeout, puis emergency (avec le 12 V)" }),
      btn("Acquitter", () => { st.ackUntil = Date.now() + 500; }, { small: true, icon: "check", tip: "L'entrée d'acquittement (ACK) de la carte principale, appuyée un instant" })];
  }

  function draw(g) {
    const { s, d } = ensure();
    if (!s || !d) { g.append(svg("text", { x: 0, y: 30, class: "lab-table-name" }, s ? `Le logiciel de ${s.main.id} n'a pas de module simulé : posez-le (Logiciel), puis revenez.` : "Posez une carte principale et une carte qui l'écoute, reliées par leur bus RS-485 (exemple : le projet BM 8s8p).")); return { w: 900, h: 60, y: -10 }; }
    const P = systemPower(s, { v12: st.v12 }), m = last(), R = roundRobin(s.n), reads = nodeReadings(st.L.plant, s.n), talk = P.bus && !st.cut;
    const mx = 0, my = 140, mw = 330, mh = 300, cx0 = mw + 90, cw = 118, ch = 120, cgap = 22, cy = my + 40;
    /* the lab supply on the 12 V connector */
    const pic = gearPic({ kind: "supply", v: 12, ilim: null, on: st.v12 }, "Alimentation de laboratoire 12 V"); if (pic) { for (const [k, v] of Object.entries({ x: 0, y: -20, width: 190, height: 104 })) pic.setAttribute(k, v); g.append(pic); }
    g.append(svg("path", { d: `M164,58 C164,110 40,100 40,${my}`, class: `sys-cord${st.v12 ? "" : " off"}` }), svg("text", { x: 48, y: my - 8, class: "sys-small" }, "J1 · 12 V"));
    /* the main board : its rails, its state, what it drives */
    const state = m["module.state"] || 0, items = hwFunctions(s.main, d, m).flatMap((x) => x.items);
    g.append(svg("rect", { x: mx, y: my, width: mw, height: mh, rx: 8, class: "sys-board" }), svg("text", { x: mx + 12, y: my + 22, class: "sys-title" }, `${s.main.id} — carte principale`));
    const rails = ["+12V", "+34V", "VSYS", "+5V", "+3V3", "+5V_ISO", "+5V_CISO"].filter((r) => (s.main.nets || []).some((n) => n.name === r));
    rails.forEach((r, i) => { const on = P.main.on.has(r), x = mx + 12 + (i % 4) * 78, y = my + 36 + Math.floor(i / 4) * 24; g.append(svg("rect", { x, y, width: 72, height: 18, rx: 9, class: `sys-rail${on ? " on" : ""}` }), svg("text", { x: x + 36, y: y + 13, class: "sys-rail-t", "text-anchor": "middle" }, r)); });
    g.append(svg("rect", { x: mx + 12, y: my + 94, width: mw - 24, height: 44, rx: 6, fill: STATE_COL[state] || "#475569", class: "sys-state" }), svg("text", { x: mx + mw / 2, y: my + 122, "text-anchor": "middle", class: "sys-state-t" }, `${STATE_NAMES[state] || "?"}${st.v12 ? "" : " · standby, sans 12 V"}`));
    items.filter((x) => x.dir === "dout").forEach((x, i) => { const px = mx + 30 + (i % 4) * 76, py = my + 170 + Math.floor(i / 4) * 62, col = x.device === "led" ? (/vert/i.test(x.name) ? "#22c55e" : /jaune/i.test(x.name) ? "#eab308" : "#ef4444") : "#f97316";
      g.append(svg("circle", { cx: px, cy: py, r: 13, class: `sys-lamp${x.on ? " on" : ""}`, fill: x.on ? col : "#334155" }), svg("text", { x: px, y: py + 28, "text-anchor": "middle", class: "sys-small" }, short(x)), svg("text", { x: px, y: py + 40, "text-anchor": "middle", class: "sys-pin" }, x.net)); });
    /* the daisy chain : the four wires, lit when the bus side has its supply and the chain holds */
    const jx = mx + mw, jy = my + 60, xs = (k) => cx0 + (k - 1) * (cw + cgap);
    g.append(svg("path", { d: `M${jx},${jy} C${jx + 50},${jy} ${xs(1) - 50},${cy + 30} ${xs(1)},${cy + 30}`, class: `sys-chain${talk ? "" : " off"}${st.cut ? " cut" : ""}` }), svg("text", { x: jx + 6, y: jy - 8, class: "sys-small" }, "J3 · RS-485 A, B, +5V_ISO, GND_ISO"));
    for (let k = 1; k <= s.n; k++) { const x = xs(k), r = reads[k - 1], now = talk && st.token === k, sel = st.sel === k;
      if (k > 1) g.append(svg("path", { d: `M${xs(k - 1) + cw},${cy + 30} L${x},${cy + 30}`, class: `sys-chain${talk ? "" : " off"}` }));
      g.append(svg("g", { class: `sys-core${now ? " talk" : ""}${sel ? " sel" : ""}${P.bus ? "" : " dark"}`, "data-core": String(k), role: "button", tabindex: "0", "aria-label": `CORE ${k}` },
        svg("rect", { x, y: cy, width: cw, height: ch, rx: 7 }), svg("text", { x: x + 8, y: cy + 17, class: "sys-title" }, `CORE ${k}`),
        svg("text", { x: x + 8, y: cy + 38, class: "sys-val" }, `${fr(r.mv / 1000, 3)} V`), svg("text", { x: x + 8, y: cy + 56, class: "sys-small" }, `8 NTC · ${fr(r.ntc[0] / 10)} °C`),
        svg("path", { d: `M${x + 8},${cy + 76} h8 l3,-6 l5,12 l5,-12 l5,12 l5,-12 l3,6 h8`, class: `sys-bleed${r.bleed ? " on" : ""}` }), svg("text", { x: x + 62, y: cy + 80, class: "sys-small" }, r.bleed ? "balancing ON" : "balancing OFF"),
        svg("text", { x: x + 8, y: cy + 106, class: "sys-small" }, P.bus ? (now ? `transmet — slot ${k}` : `slot ${k}`) : "silent : pas de 12 V"))); }
    /* one cycle of the round-robin, to scale */
    const ty = my + mh + 70, TW = xs(s.n) + cw, X = (t) => (t / R.period) * TW;
    g.append(svg("text", { x: 0, y: ty - 26, class: "lab-table-name" }, `Un cycle du round-robin, à l'échelle — ${R.baud.toLocaleString("fr-CA")} bauds, frame de ${FRAME.bytes} octets`), svg("line", { x1: 0, y1: ty + 34, x2: TW, y2: ty + 34, class: "sys-axis" }));
    for (const t of [0, 25, 50, 75, 100].filter((x) => x <= R.period)) g.append(svg("line", { x1: X(t), y1: ty + 30, x2: X(t), y2: ty + 38, class: "sys-axis" }), svg("text", { x: X(t), y: ty + 52, "text-anchor": "middle", class: "sys-small" }, `${t} ms`));
    if (talk) for (const q of R.slots) g.append(svg("rect", { x: X(q.t0), y: ty, width: Math.max(2, X(q.t1) - X(q.t0)), height: 26, rx: 2, class: `sys-slot${st.token === q.slot ? " talk" : ""}` }), svg("text", { x: X(q.t0) + 2, y: ty - 4, class: "sys-pin" }, String(q.slot)));
    else g.append(svg("text", { x: 0, y: ty + 18, class: "lab-table-name" }, st.cut ? "Daisy chain débranchée : aucune frame — timeout à la carte principale." : "Aucune frame : sans 12 V, le bus side des CORE boards n'est pas alimenté."));
    g.append(svg("line", { x1: X(R.cycle), y1: ty - 8, x2: X(R.cycle), y2: ty + 40, class: "sys-cycle" }), svg("text", { x: X(R.cycle) + 4, y: ty + 10, class: "sys-small" }, `cycle ${fr(R.cycle, 1)} ms sur ${R.period} ms`));
    g.append(svg("text", { x: 0, y: ty + 74, class: "sys-small" }, `Frame ${fr(R.frame, 2)} ms · silence t3,5 et turnaround ${fr(R.gap, 2)} ms · CORE 1 ouvre le cycle toutes les ${R.period} ms · le token avance d'un slot par image (ralenti) · exemples à confirmer`));
    return { w: Math.max(TW, 900), h: ty + 90 + 30, y: -30 };
  }
  const short = (x) => (x.device ? { led: "LED", buzzer: "buzzer", pump: "pump", fan: "fan" }[x.device] || x.device : /contacteur|coil|bobine/i.test(x.name) ? "contactor" : x.name.split(" ")[0]);

  function right(pane) {
    const { s, d } = ensure(); pane.replaceChildren(el("div", { class: "side-head" }, el("h2", null, "En marche")));
    const sc = el("div", { class: "side-scroll" }); pane.append(sc); if (!s || !d) return;
    const m = last(), mod = (d.objects || []).find((x) => x.kind === "module_state"), tl = mod ? cfgOf(mod).t_lost : null;
    sc.append(el("div", { class: "side-section", "data-fold-note": STATE_NAMES[m["module.state"] || 0] }, el("h3", null, "Le module"),
      el("p", { class: "small" }, `État : ${STATE_NAMES[m["module.state"] || 0]} · 12 V ${st.v12 ? "présent" : "absent (standby)"} · daisy chain ${st.cut ? "débranchée" : "branchée"}${tl ? ` · timeout ${tl} ms` : ""}.`)));
    for (const gr of hwFunctions(s.main, d, m)) sc.append(el("div", { class: "side-section", "data-fold-note": `${gr.items.length}` }, el("h3", null, gr.name),
      gr.items.map((x) => el("div", { class: "sys-fn", "data-sys-fn": x.id }, el("i", { class: `sys-dot${x.on ? " on" : ""}${x.dir === "ain" ? " val" : ""}` }), el("span", { class: "grow" }, x.name, el("small", null, x.net ? ` ${x.net} · ${x.pin}` : " frame des CORE")), el("b", null, x.text)))));
    const r = nodeReadings(st.L.plant, s.n)[st.sel - 1], bytes = coreFrame(st.sel, r);
    sc.append(el("div", { class: "side-section", "data-fold-note": `${bytes.length} octets` }, el("h3", null, `La frame de CORE ${st.sel}`),
      el("p", { class: "small muted" }, FRAME.what), el("code", { class: "sys-hex", "data-sys-frame": String(st.sel) }, bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")),
      el("p", { class: "small" }, `${fr(r.mv / 1000, 3)} V · ${fr(r.ntc[0] / 10)} °C · balancing ${r.bleed ? "ON" : "OFF"} — un clic sur une CORE choisit sa frame.`)));
    sc.append(el("div", { class: "side-section", "data-fold-note": `${SYSTEM_GAPS.length}` }, el("h3", null, "Ce qui n'est pas simulé"), el("ul", { class: "small" }, SYSTEM_GAPS.map((t) => el("li", null, t)))));
  }
  function click(target) { const c = target.closest && target.closest("[data-core]"); if (!c) return false; st.sel = Number(c.dataset.core); o.redraw(); return true; }
  return { bar, draw, right, click, stop: () => { clearInterval(st.timer); st.timer = 0; st.run = false; }, get state() { return st; } };
}
