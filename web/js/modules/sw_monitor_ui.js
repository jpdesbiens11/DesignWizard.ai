/* DynamiteOrbit.ai — Logiciel : the MONITORING window of the « Essayer » step (demande de JP, 24 novembre 2026 : « un tableau de bord au pilote du
   BM ou au user qui allume des LED quand on a des conditions à surveiller, avec les valeurs montrées sous ou à côté des LED… un pop-up ouvert /
   fermé en plus de la fenêtre globale » — titre « Monitoring du BM-SWAP »).
   A window that floats over the page, opened and closed by its button, moved by its title bar (the place is kept by the browser), or sent to a
   window of its own — on a second screen, as the dashboard of the pilot. Inside : the general state as a traffic light (green · yellow · red)
   and its name ; one LED per condition, grouped by what it watches (voltage, temperature, current), lit in its colour when it holds, the value
   it compares under it, in volts or degrees, and its threshold ; then what the product does — contactor, fault, chain, buzzer — and the sound.
   What is shown is read from the software (sw/sw_monitor.js) and from the live bench : nothing here decides.
   What it follows : the annunciator panel of a cockpit ; a non-modal dialog (role dialog, Esc closes, focus goes to it on opening). */

import { el, btn, icon, onOff, toast } from "../core/dom.js";
import { monitorOf, monitorRead } from "../sw/sw_monitor.js";
import { soundOn, setSoundOn } from "./sw_sound.js";

const POS = "dw.sw.monitor.pos";
const keep = (p) => { try { localStorage.setItem(POS, JSON.stringify(p)); } catch (e) { /* the place holds until the page is left */ } };
const kept = () => { try { const p = JSON.parse(localStorage.getItem(POS) || "null"); return p && Number.isFinite(p.x) ? p : null; } catch (e) { return null; } };
const LIGHT = { green: "Bon", yellow: "À surveiller", red: "Limite dépassée" };

/** bench : the live bench ; design() ; sound : modules/sw_sound.js. → { button, refresh(), open(), close(), dispose() } — null when there is nothing to watch */
export function swMonitor(bench, design, sound) {
  const M = monitorOf(design()); if (!M.rows.length && !M.lamp && M.state === null) return null;
  const st = { open: false, win: null };
  const lamps = Object.fromEntries(["red", "yellow", "green"].map((k) => [k, el("i", { class: `swm-lamp ${k}`, "aria-hidden": "true" })]));
  const stateText = el("b", { class: "swm-state" }), clock = el("small", { class: "swm-clock" }), body = el("div", { class: "swm-body" });
  const leds = {}, values = {}, prod = {};
  const coreBox = el("section", { class: "swm-group swm-coresec", hidden: true, "data-swm-cores": "" });
  const groups = [...new Set(M.rows.map((r) => r.group))];
  for (const g of groups) body.append(el("section", { class: "swm-group" }, el("h4", null, g), el("div", { class: "swm-grid" }, M.rows.filter((r) => r.group === g).map((r) => {
    leds[r.id] = el("i", { class: `swm-led ${r.sev}`, "aria-hidden": "true" }); values[r.id] = el("b", { class: "swm-val" }, "—");
    return el("div", { class: "swm-cond", "data-swm": r.id, "data-tip": `${r.label} — ${r.sev === "red" ? "une limite : le produit s'arrête" : "à surveiller : le produit continue, dératé"}` }, leds[r.id], el("span", { class: "swm-name" }, r.label), values[r.id], el("small", null, `seuil ${r.rule}`)); }))));
  if (M.product.length) body.append(el("section", { class: "swm-group" }, el("h4", null, "Le produit"), el("div", { class: "swm-grid" }, M.product.map((p) => {
    prod[p.id] = { led: el("i", { class: "swm-led", "aria-hidden": "true" }), text: el("b", { class: "swm-val" }) };
    return el("div", { class: "swm-cond", "data-swm": p.id }, prod[p.id].led, el("span", { class: "swm-name" }, p.label), prod[p.id].text); }))));
  body.append(coreBox);
  const soundSw = onOff(soundOn(), (on) => { setSoundOn(on); if (!on) sound.update(false); }, "Son de l'alarme", "Le buzzer s'entend dans le haut-parleur de l'ordinateur : un carillon doux, toutes les deux secondes, tant qu'il sonne");
  const foot = el("div", { class: "swm-foot" }, el("label", { class: "swm-sound" }, icon("warning"), "Son du buzzer", soundSw), btn("Écouter", () => sound.chime(), { small: true, tip: "Le son de l'alarme, une fois" }),
    btn("Fenêtre à part", () => detach(), { small: true, icon: "export", tip: "Ouvrir le tableau de bord dans sa propre fenêtre — sur un deuxième écran, comme celui du pilote" }));
  const close = btn("", () => api.close(), { small: true, tip: "Fermer le monitoring (il se rouvre par son bouton)" }); close.textContent = "×"; close.classList.add("swm-x"); close.setAttribute("aria-label", "Fermer le monitoring");
  const bar = el("header", { class: "swm-head" }, icon("sensor"), el("h3", { id: "swm-title" }, M.title), clock, close);
  const panel = el("div", { class: "swm", role: "dialog", "aria-labelledby": "swm-title", tabindex: "-1", hidden: true, "data-sw-monitor": "",
    onKeydown: (e) => { if (e.key === "Escape") { e.stopPropagation(); api.close(); } } },
  bar, el("div", { class: "swm-top" }, el("div", { class: "swm-light", role: "img", "aria-label": "État général" }, lamps.red, lamps.yellow, lamps.green), el("div", null, el("small", null, "État général"), stateText)), body, foot);
  /* moved by its title bar, as any window */
  bar.addEventListener("pointerdown", (e) => { if (st.win || e.target.closest("button")) return; const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; bar.setPointerCapture(e.pointerId);
    const move = (m) => place({ x: m.clientX - dx, y: m.clientY - dy }), up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); keep({ x: panel.offsetLeft, y: panel.offsetTop }); };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); });
  const place = (p) => { const w = panel.offsetWidth || 380, h = panel.offsetHeight || 300; panel.style.left = `${Math.max(0, Math.min(window.innerWidth - w, p.x))}px`; panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, p.y))}px`; void h; };
  const button = btn(M.title, () => (st.open ? api.close() : api.open()), { small: true, icon: "sensor", tip: "Le tableau de bord : une LED par condition à surveiller, les valeurs à côté, l'état général en vert, jaune ou rouge" });
  button.dataset.swMonitorOpen = ""; button.setAttribute("aria-expanded", "false");
  const light = el("i", { class: "swm-dot", "aria-hidden": "true" }); button.prepend(light);

  function detach() {
    const w = window.open("", "dw-monitor", "width=460,height=720"); if (!w) { toast("Le navigateur a bloqué la fenêtre : autorisez les fenêtres de ce site, puis recommencez.", "error", 6000); return; }
    w.document.title = M.title; w.document.body.className = "swm-own";
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) w.document.head.append(el("link", { rel: "stylesheet", href: l.href }));
    st.win = w; panel.classList.add("own"); panel.hidden = false; w.document.body.replaceChildren(panel); st.open = true;
    w.addEventListener("pagehide", () => { if (st.win !== w) return; st.win = null; panel.classList.remove("own"); document.body.append(panel); api.close(); });
    api.refresh();
  }
  const api = {
    button,
    open() { if (st.win) { st.win.focus(); return; } st.open = true; if (!panel.isConnected) document.body.append(panel); panel.hidden = false; place(kept() || { x: window.innerWidth - 420, y: 90 }); button.setAttribute("aria-expanded", "true"); api.refresh(); panel.focus(); },
    close() { st.open = false; if (st.win) { const w = st.win; st.win = null; panel.classList.remove("own"); w.close(); } panel.hidden = true; button.setAttribute("aria-expanded", "false"); },
    /* each frame of the bench : the lamps, the LEDs, the values */
    refresh() {
      const R = monitorRead(M, (r) => bench.values(r)); light.className = `swm-dot ${R.general || ""}`; button.dataset.swMonitorState = R.general || "";
      if (!st.open) return;
      for (const k of ["red", "yellow", "green"]) lamps[k].classList.toggle("on", R.general === k);
      stateText.textContent = `${R.general ? LIGHT[R.general] : "—"}${R.stateName ? ` · ${R.stateName}` : ""}`; panel.dataset.swmGeneral = R.general || "";
      const t = bench.L ? bench.L.t : 0; clock.textContent = `t = ${String((t / 1000).toFixed(1)).replace(".", ",")} s`;
      for (const r of R.rows) { leds[r.id].classList.toggle("on", r.on); values[r.id].textContent = r.valueText; values[r.id].parentNode.classList.toggle("on", r.on); }
      for (const p of R.product) { const P = prod[p.id], bad = p.sev === "green" ? false : p.sev === "off-red" ? !p.on : p.on; P.led.className = `swm-led ${p.sev === "green" ? (p.on ? "green on" : "") : bad ? "red on" : "green on"}`; P.text.textContent = p.text; P.led.parentNode.classList.toggle("on", bad); }
    },
    /* the 8 CORE of « Charge et équilibrage », while it runs : each one's voltage climbing, its resistor glowing green-lit when it bleeds */
    cores(B) {
      if (!B) { coreBox.hidden = true; return; } coreBox.hidden = false; const r = B.S.r, vr = B.v.map((x) => x - B.i * r), low = Math.min(...vr), n = B.bleed.filter(Boolean).length;
      coreBox.replaceChildren(el("h4", null, "Les CORE — charge et équilibrage", el("span", { class: `swm-bal${n ? " on" : ""}`, "data-swm-bal": n ? "on" : "off" }, el("i", { "aria-hidden": "true" }), n ? ` équilibrage actif · ${n}` : " équilibrage au repos")),
        el("div", { class: "swm-cores" }, B.v.map((_, k) => el("div", { class: `swm-core${B.bleed[k] ? " on" : ""}`, "data-swm-core": String(k + 1) }, el("div", { class: "swm-cbar" }, el("i", { style: `height:${Math.round(B.soc[k] * 100)}%` })),
          el("b", null, String(vr[k].toFixed(2)).replace(".", ",")), el("small", null, Math.round((vr[k] - low) * 1000) ? `+${Math.round((vr[k] - low) * 1000)}` : "min")))));
    },
    dispose() { api.close(); panel.remove(); },
  };
  return api;
}
