/* DynamiteOrbit.ai — Logiciel : the bench of the LIVE simulation (demande de JP : « le voir en mode pause, en attente des différentes entrées
   qui pourraient changer à l'écran… une vraie simulation logicielle en temps réel »). The software runs its step against a bench one drives :
   « Marche » lets the time run — in real time, or slowed down so a delay of 100 ms can be seen —, « Pause » stops it, « Un pas » runs one
   period. In pause nothing moves : one changes an input, then steps, to see what the software does of it.
   Three things are shown, each in its place : the controls of the time under the page ; the bench in the right panel — a quantity is a
   slider and a field, a request is a switch, a contact follows its coil or is jammed, open or welded ; and under the tiles a CHRONOGRAM, the
   last seconds of every decision, as a logic analyser draws them.
   What it follows : the transport of a simulator (run, pause, single step, reset) and the chronogram of a logic analyser.
   The step is the model's (sw/sw_live.js) : nothing is computed here. */

import { el, clear, icon, btn, onOff } from "../core/dom.js";
import { liveStart, liveStep, liveSet, liveDrive, plantPins, due } from "../sw/sw_live.js";
import { packPhase } from "../sw/sw_pack.js";
import { KINDS, portsOf } from "../sw/sw_objects.js";
import { split } from "../sw/sw_design.js";
import { physText, shownUnit } from "../sw/sw_units.js";

const SPEEDS = [[0.05, "20 fois plus lent"], [0.2, "5 fois plus lent"], [1, "temps réel"]], FAST = [[1, "temps réel"], [10, "×10"], [100, "×100"], [400, "×400, au plus vite"]], fr = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace("-", "−");
/* the time : in ms for a short test, in minutes and seconds past a minute */
const clock = (ms) => (ms < 60000 ? `${fr(ms)} ms` : `${Math.floor(ms / 60000)} min ${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")} s`);
const CONTACT = [["follows", "suit la bobine"], ["open", "coincé ouvert"], ["closed", "soudé fermé"]];

/** o : { design() → the design, onFrame() (the values changed : refresh the tiles), onLog() (an event was logged) }
    → { bar, chart, side(), journal(), values (ref → value), L, running, play(), pause(), step(n), reset(), dispose() } */
export function swBench(o) {
  const st = { L: null, running: false, speed: 0.2, raf: 0, last: 0, rest: 0, logged: 0 }, bar = el("div", { class: "sw-live-bar" }), chart = el("canvas", { class: "sw-lanes", "aria-label": "Chronogramme : les dernières secondes de chaque décision du logiciel", role: "img" });
  const name = (ref) => { const d = o.design(), [id, key] = split(ref), x = d && d.objects.find((q) => q.id === id); return `${x ? x.name : id} · ${key}`; };
  const advance = (n) => (st.adv ? st.adv(n) : liveStep(st.L, n));
  const start = () => { const d = o.design(); st.L = d ? liveStart(d) : null; st.rest = 0; st.logged = 0; if (st.L) liveStep(st.L, 0); if (st.L && st.L.plant && st.speed < 1) st.speed = 100; };      // a module on the bench charges in an hour : time runs faster
  /* a frame : the numbers of the bar, the chronogram, the tiles — the BUTTONS are only redrawn when the state changes, so a click never falls between two of them */
  const frame = (state = false) => { if (state) drawBar(); else tickBar(); drawChart(); if (o.onFrame) o.onFrame(); if (st.L && st.L.log.length !== st.logged) { st.logged = st.L.log.length; if (o.onLog) o.onLog(); } };
  const tick = (ts) => { st.raf = 0; if (!st.running || !st.L) return; const q = due(Math.min(250, ts - st.last), st.L.m.dt, st.speed, st.rest); st.last = ts; st.rest = q.rest; if (q.n) { advance(q.n); frame(); } st.raf = requestAnimationFrame(tick); };
  const api = {
    bar, chart, get L() { return st.L; }, get running() { return st.running; }, values: (ref) => (st.L ? st.L.m.last[ref] : undefined),
    play() { if (!st.L || st.running) return; st.running = true; st.last = performance.now(); st.raf = requestAnimationFrame(tick); frame(true); },
    pause() { const was = st.running; st.running = false; if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; frame(was); },
    step(n = 1) { if (!st.L) return; api.pause(); advance(n); frame(); },
    /* who runs the steps : a usage profile splits them at the time of each of its events, so that none is applied late (a button held 0,3 s, at ×400) */
    setAdvance(fn) { st.adv = fn || null; },
    reset() { const was = st.running, keep = st.L ? { ...st.L.set } : {}; api.pause(); start(); if (st.L) for (const i of st.L.inputs) if (keep[i.id] !== undefined) liveSet(st.L, i.id, keep[i.id]); frame(true); if (was) api.play(); },
    set(id, v) { if (!st.L) return; liveSet(st.L, id, v); if (!st.running) frame(); },
    /* the module on the bench (sw/sw_pack.js) : what drives it, and itself */
    drive(patch) { if (!st.L) return; liveDrive(st.L, patch); if (!st.running) frame(); },
    get plant() { return st.L ? st.L.plant || null : null; }, get speed() { return st.speed; },
    dispose() { api.pause(); },
    setSpeed(v) { st.speed = v; st.rest = 0; frame(true); },      // a usage profile is played in real time (modules/sw_story_ui.js)
    /* the bench : what the pins read — one control per input pin */
    side() {
      const box = el("div", { class: "sw-bench", "data-sw-bench": "" }); if (!st.L) return box;
      if (!st.L.inputs.length) box.append(el("p", { class: "muted" }, "Ce logiciel ne lit aucune broche : rien à régler sur le banc."));
      const driven = plantPins(st.L);
      if (st.L.plant) { const P = st.L.plant; box.append(el("div", { class: "sw-ctl sw-plant", "data-ctl": "plant" }, el("label", null, icon("bolt"), el("b", null, "Le module simulé")), el("p", { class: "small" }, `${packPhase(P.phase)} · ${String(Math.abs(P.i).toFixed(1)).replace(".", ",")} A ${P.i > 0 ? "en charge" : P.i < 0 ? "en décharge" : ""} · ${String(P.temp.toFixed(1)).replace(".", ",")} °C au plus chaud`),
        el("small", { class: "muted" }, "Il mène les tensions, le courant et la température que le logiciel lit, et il obéit à ce que le logiciel commande (contacteur, dératation, pompe). Ses valeurs sont TYPIQUES. Un profil le pilote : charge, décharge, chaleur, chargeur en panne."))); }
      for (const i of st.L.inputs) { const v = st.L.set[i.id];
        if (i.kind === "analog" && driven.has(i.id)) { box.append(el("div", { class: "sw-ctl", "data-ctl": "plant-pin", "data-bench-read": i.id }, el("label", null, icon("sensor"), el("b", null, i.name), el("small", null, ` ${i.unit}`)), el("div", { class: "sw-ctl-row" }, el("b", { "data-bench-value": i.id }, physText(v, i.unit))), el("small", { class: "muted" }, "Mené par le module simulé : lu, pas réglé à la main."))); continue; }
        if (i.kind === "analog") { const out = el("small", { class: "muted", "data-bench-note": i.id }), num = el("input", { type: "number", min: i.min, max: i.max, step: i.step, value: String(v), "aria-label": `${i.name}, en ${i.unit}`, "data-bench": i.id }), range = el("input", { type: "range", min: i.min, max: i.max, step: i.step, value: String(v), "aria-label": `${i.name} (curseur)`, "data-bench-range": i.id });
          const say = () => { const x = st.L.set[i.id], odd = i.lo !== undefined && (x < i.lo || x > i.hi); out.textContent = `→ ${i.toCounts(x)} comptes sur ${i.full} à la broche${odd ? ` · hors de la plage vraisemblable (${fr(i.lo)} à ${fr(i.hi)} ${i.unit})` : ""}`; out.classList.toggle("warn", !!odd); };
          const put = (x, from) => { api.set(i.id, x); const now = st.L.set[i.id]; if (from !== num) num.value = String(now); if (from !== range) range.value = String(now); say(); };
          num.addEventListener("input", () => { if (num.value !== "") put(Number(num.value), num); }); range.addEventListener("input", () => put(Number(range.value), range)); say();
          box.append(el("div", { class: "sw-ctl", "data-ctl": "analog" }, el("label", null, icon("sensor"), el("b", null, i.name), el("small", null, ` ${i.unit}`)), el("div", { class: "sw-ctl-row" }, range, num), out));
        } else if (i.kind === "digital") { const sw = onOff(!!v, (on) => { api.set(i.id, on ? 1 : 0); redrawSide(); }, i.name, "Ce que la broche lit : 0 (rien) ou 1 (demandé, contact fermé)"); sw.dataset.bench = i.id;
          box.append(el("div", { class: "sw-ctl", "data-ctl": "digital" }, el("label", null, icon("chip"), el("b", null, i.name)), el("div", { class: "sw-ctl-row" }, sw, el("span", null, v ? "1 — demandé" : "0 — au repos"))));
        } else box.append(el("div", { class: "sw-ctl", "data-ctl": "contact" }, el("label", null, icon("power"), el("b", null, i.name)), el("div", { class: "sw-seg", role: "group", "aria-label": `${i.name} : ce que fait le contact` }, CONTACT.map(([k, l]) => el("button", { type: "button", class: v === k ? "on" : "", "aria-pressed": v === k ? "true" : "false", "data-bench": `${i.id}:${k}`, onClick: () => { api.set(i.id, k); redrawSide(); } }, l))),
          el("small", { class: "muted" }, v === "follows" ? `Il suit « ${i.ofName} », ${i.delay} ms plus tard : un contactor sain.` : v === "open" ? "Panne : le contact reste ouvert même commandé — bobine coupée." : "Panne : le contact reste fermé même relâché — contacts soudés.")));
      }
      return box;
    },
    /* the journal : every 0 / 1 decision that changed, the latest first */
    journal() {
      const L = st.L, list = L ? [...L.log].reverse().slice(0, 40) : [];
      return el("div", { "data-sw-journal": String(L ? L.log.length : 0) }, list.length ? el("ul", { class: "sw-journal" }, list.map((e) => el("li", { class: e.to ? "up" : "down" }, el("b", null, clock(e.t)), ` — ${name(e.ref)} passe à ${e.to}`))) : el("p", { class: "muted" }, "Rien n'a encore basculé. Lancez « Marche », ou changez une entrée du banc puis faites « Un pas »."));
    },
  };
  let sideHost = null; const redrawSide = () => { if (sideHost && sideHost.isConnected) sideHost.replaceChildren(api.side()); };
  api.mountSide = (host) => { sideHost = host; redrawSide(); };

  function drawBar() {
    clear(bar); const L = st.L; if (!L) return;
    const go = btn(st.running ? "Pause" : "Marche", () => (st.running ? api.pause() : api.play()), { primary: !st.running, small: true, icon: st.running ? null : "play", tip: st.running ? "Arrêter le temps : plus rien n'avance" : "Laisser le temps courir : le logiciel refait son pas à chaque période" }); go.dataset.swRun = st.running ? "on" : "off";
    const one = btn("Un pas", () => api.step(1), { small: true, icon: "chevron-right", tip: `Avancer d'une période (${L.m.dt} ms), puis s'arrêter` }); one.dataset.swStep = "";
    const again = btn("Redémarrer", () => api.reset(), { small: true, icon: "refresh", tip: "Remettre le logiciel à zéro, comme à la mise sous tension ; le banc garde ses réglages" }); again.dataset.swReset = "";
    bar.append(go, one, again, el("label", { class: "sw-speed" }, "Vitesse", el("select", { "aria-label": "Vitesse du temps simulé", "data-sw-speed": "", onChange: (e) => { st.speed = Number(e.target.value); st.rest = 0; } }, (L.plant ? FAST : SPEEDS).map(([k, l]) => el("option", { value: k, selected: k === st.speed }, l)))),
      el("span", { class: "chip", "data-sw-time": String(L.t) }, clock(L.t)), el("span", { class: `chip ${st.running ? "ok" : ""}`, "data-sw-state": st.running ? "run" : "pause" }, st.running ? "en marche" : "en pause"), el("span", { class: "muted small", "data-sw-count": "" }, `pas n° ${L.m.k} · un pas toutes les ${L.m.dt} ms`));
  }
  function tickBar() { const L = st.L, t = bar.querySelector("[data-sw-time]"), c = bar.querySelector("[data-sw-count]"); if (!L || !t) { drawBar(); return; } t.textContent = clock(L.t);
    if (sideHost && L.plant) for (const b of sideHost.querySelectorAll("[data-bench-value]")) { const i = L.inputs.find((x) => x.id === b.dataset.benchValue); if (i) b.textContent = physText(L.set[i.id], i.unit); } t.dataset.swTime = String(L.t); if (c) c.textContent = `pas n° ${L.m.k} · un pas toutes les ${L.m.dt} ms`; }
  /* the chronogram : a lane per decision (0 / 1) and per measure, the last seconds */
  function lanes() { const d = o.design(), out = []; if (!d) return out;
    for (const x of d.objects.filter((q) => !q.off && KINDS[q.kind])) for (const p of portsOf(x).out) { if (KINDS[x.kind].pin === "ain") continue; if (p.unit === "0/1") out.push({ ref: `${x.id}.${p.key}`, label: `${x.name} · ${p.label}`, bool: true }); else if (x.kind === "analog_in" || p.unit === "‰") out.push({ ref: `${x.id}.${p.key}`, label: `${x.name} (${shownUnit(p.unit)})`, bool: false, unit: p.unit }); }
    for (const x of d.objects.filter((q) => !q.off && KINDS[q.kind] && KINDS[q.kind].pin === "dout")) out.push({ ref: `${x.id}.level`, label: x.name, bool: true });
    /* what the software commands first, then what it decides, then what it measures : a short screen keeps what matters */
    const rank = (l) => (d.objects.some((x) => KINDS[x.kind] && KINDS[x.kind].pin === "dout" && l.ref === `${x.id}.level`) ? 0 : l.bool && !/\.valid$/.test(l.ref) ? 1 : l.bool ? 3 : 2);
    return out.map((l, i) => [l, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([l]) => l).slice(0, o.lanes || 14); }
  function drawChart() {
    const L = st.L, ls = lanes(), H = 20, LBL = 190, w = Math.max(360, chart.clientWidth || 800), h = ls.length * H + 6, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (chart.width !== Math.round(w * dpr) || chart.height !== Math.round(h * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); chart.style.height = `${h}px`; }
    const g = chart.getContext("2d"), ink = "#e2e8f0", mute = "#94a3b8", line = "#1e293b";      // a scope screen : dark in every theme, as the oscilloscopes of the Labo
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.font = "11px system-ui, sans-serif"; g.textBaseline = "middle"; if (!L) return;
    if (!L.trace.t.length) { g.fillStyle = "#4ade80"; g.font = "600 13px system-ui, sans-serif"; g.fillText("▶ Appuyez sur « Marche » ou « Un pas » : les courbes défilent ici.", LBL + 12, Math.min(h / 2, 14)); g.font = "11px system-ui, sans-serif"; }      // an empty screen says what to do
    const n = L.trace.t.length, span = L.keep, x = (k) => LBL + (w - LBL - 6) * (k + span - n) / (span - 1 || 1);
    ls.forEach((ln, r) => { const y0 = r * H + 4, y1 = y0 + H - 7, ys = L.trace.ports[ln.ref] || [], cur = ys.length ? ys[ys.length - 1] : 0;
      g.fillStyle = mute; g.fillText(ln.label.length > 30 ? `${ln.label.slice(0, 29)}…` : ln.label, 4, (y0 + y1) / 2); g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(LBL, y1 + 2.5); g.lineTo(w - 6, y1 + 2.5); g.stroke(); if (!ys.length) return;
      let lo = 0, hi = 1; if (!ln.bool) { lo = Math.min(...ys); hi = Math.max(...ys); if (hi === lo) { hi = lo + 1; lo -= 1; } }
      g.strokeStyle = ln.bool ? (cur ? "#f87171" : "#4ade80") : "#fb923c"; g.lineWidth = 1.8; g.beginPath();
      for (let k = 0; k < n; k++) { const yy = y1 - (y1 - y0) * (ys[k] - lo) / (hi - lo), xx = x(k); if (!k) g.moveTo(xx, yy); else { if (ln.bool) g.lineTo(xx, y1 - (y1 - y0) * (ys[k - 1] - lo) / (hi - lo)); g.lineTo(xx, yy); } } g.stroke();
      if (!ln.bool) { g.fillStyle = "#fb923c"; g.textAlign = "right"; g.fillText(physText(cur, ln.unit), w - 8, y0 + 3); g.textAlign = "left"; } });
  }
  start(); frame(true);
  return api;
}
