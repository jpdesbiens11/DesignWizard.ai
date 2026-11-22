/* DesignWizard.ai — Labo, the bench above the board : each instrument of the test drawn, its cords run to the points of the board, its
   settings typed ON its front (point 6, JP, 20 novembre 2026 : « chaque appareil dessiné, ses cordons tirés jusqu'aux points de la carte,
   et ses réglages changés SUR l'appareil — pas dans une section du volet de gauche ; ce qui ne se règle pas ici est dit »).
   The usage followed : the front panel of a bench instrument — the value typed where the display shows it, Enter or leaving the field
   sets it, Escape gives the shown value back ; a cord is drawn from the jack of the instrument to the point it is clipped on. Each
   setting is one undoable step of the notebook of the board (pcba/lab_plan.js setGear) ; the test is then simulated again with it (the
   Labo does that when the notebook changes). What has nothing to turn says why (pcba/lab_gear.js benchGear). A button of the board is
   pressed by a click on it in the view : held while the click is held (pressable). Mechanism : benchStrip(host, pcb, o). */

import { el, svg, icon, btn, toast } from "../core/dom.js";
import { gearPic, JACKS } from "./elab_gear.js";
import { benchGear, checkKnob, CIRCUIT_NOTE } from "../pcba/lab_gear.js";
import { LEADS } from "../pcba/lab_manip.js";

const fr = (x) => (x === null || x === undefined || !Number.isFinite(+x) ? "" : String(+(+x).toPrecision(4)));
/* where a field sits on the front of its drawing (pixels of the 190 × 104 drawing, drawn at its own size) */
const FIELD = { supply: { v: [16, 20, 66], ilim: [16, 42, 66] }, load: { r: [58, 72, 74] } };
const UNIT = { v: "V", ilim: "A", r: "Ω" };

/** The strip of instruments above the board, and the cords. host : where the strip goes (before the board) ; layer : the element both
    are in (the cords are drawn over it) ; pcb : the board (modules/elab_view.js labBoard).
    o : { set(gear, knob, value | null), reset(gear), pcbaHref } → { show(sheet), pressed(on), destroy() } */
export function benchStrip(host, layer, pcb, o = {}) {
  const row = el("div", { class: "lab-gear-row", role: "group", "aria-label": "Les appareils du banc, réglés sur leur face" }), cords = svg("svg", { class: "lab-cords", "aria-hidden": "true" });
  host.prepend(row); layer.append(cords);
  let gear = [], down = false;
  const card = (g) => {
    const face = el("div", { class: "gear-face" }), pic = gearPic({ ...g, on: true, down, ch: 0, mode: "vdc" }, `${g.name} — ${g.to}`);
    if (pic) face.append(pic);
    for (const k of g.knobs) { const at = (FIELD[g.kind] || {})[k.k]; if (!at) continue;
      const shown = k.k === "ilim" && Number.isFinite(k.value) && k.value < 1 ? { k: 1e3, u: "mA" } : k.k === "r" && k.value >= 1e3 ? { k: 1e-3, u: "kΩ" } : { k: 1, u: UNIT[k.k] };
      const input = el("input", { type: "number", step: "any", class: "gear-knob", value: fr(Number.isFinite(k.value) ? k.value * shown.k : null), "data-knob": k.k, "aria-label": `${g.name} sur ${g.to} — ${k.label} (${shown.u})`, "data-tip": `${k.label}, réglée sur l'appareil : Entrée pour l'appliquer — l'essai est simulé de nouveau avec elle`, style: { left: `${at[0]}px`, top: `${at[1]}px`, width: `${at[2]}px` } });
      const apply = () => { const raw = input.value.trim(); if (raw === fr(Number.isFinite(k.value) ? k.value * shown.k : null)) return; if (raw === "") { o.set(g, k.k, null); return; }
        const c = checkKnob(g.kind, k.k, Number(raw.replace(",", ".")) / shown.k); if (!c.ok) { toast(c.text, "warn", 5000); input.value = fr(k.value * shown.k); return; } o.set(g, k.k, c.value); };
      input.addEventListener("change", apply); input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } if (e.key === "Escape") { input.value = fr(Number.isFinite(k.value) ? k.value * shown.k : null); input.blur(); } });
      face.append(input, el("span", { class: "gear-unit", style: { left: `${at[0] + at[2] + 2}px`, top: `${at[1] + 3}px` } }, shown.u)); }
    const head = el("div", { class: "gear-head" }, el("b", null, g.name), el("small", null, g.kind === "scope" ? `voie${(g.channels || []).length > 1 ? "s" : ""} ${(g.channels || [1]).join(", ")}` : `sur ${g.to}`), g.set ? btn("", () => o.reset(g), { small: true, icon: "undo", tip: "Revenir au réglage que propose l'essai", cls: "gear-reset" }) : null);
    const note = g.fixed ? el("p", { class: "gear-fixed" }, icon("info"), " ", g.fixed) : el("p", { class: "gear-fixed set" }, icon("wizard"), g.set ? " Réglée ici : l'essai suit ce réglage." : " Tapez la valeur sur l'écran de l'appareil.");
    return el("div", { class: `gear-card${g.set ? " is-set" : ""}`, "data-gear": g.key, "data-kind": g.kind }, head, note, face);      // the face last : its jacks at the bottom of the card, where the cords leave
  };
  /* the cords : from the jack of each instrument to the dot of its point on the board, in the colour of the lead */
  function draw() {
    cords.replaceChildren(); const L = layer.getBoundingClientRect(); if (!L.width) return; cords.setAttribute("viewBox", `0 0 ${L.width} ${L.height}`);
    const dots = [...layer.querySelectorAll(".lab-mark[data-gear]")].map((m) => { const d = m.querySelector(".lab-mark-dot"), r = d && d.getBoundingClientRect(); return r ? { gear: m.dataset.gear, lead: m.dataset.lead, x: r.left + r.width / 2 - L.left, y: r.top + r.height / 2 - L.top } : null; }).filter(Boolean);
    const used = new Map(), strip = row.getBoundingClientRect();
    for (const c of row.querySelectorAll(".gear-card")) {
      const g = gear.find((x) => x.key === c.dataset.gear), pic = c.querySelector(".gear-pic"); if (!g || !pic) continue; const P = pic.getBoundingClientRect(); if (P.right < strip.left || P.left > strip.right) continue;      // a card scrolled out of the strip has no cord
      for (const d of dots.filter((x) => x.gear === g.key)) {
        const J = (JACKS[g.kind] || {})[d.lead]; if (!J) continue; const n = used.get(`${g.key}:${d.lead}`) || 0; used.set(`${g.key}:${d.lead}`, n + 1); const j = Array.isArray(J[0]) ? J[n % J.length] : J;
        const x0 = P.left - L.left + (j[0] / 190) * P.width, y0 = P.top - L.top + (j[1] / 104) * P.height, mid = Math.max(y0 + 40, (y0 + d.y) / 2), color = (LEADS[d.lead] || LEADS.part).color, path = `M${x0},${y0} C${x0},${mid} ${d.x},${mid} ${d.x},${d.y}`;
        cords.append(svg("path", { d: path, class: "lab-cord-halo" }), svg("path", { d: path, class: "lab-cord", stroke: color, "data-cord": `${g.key}:${d.lead}` }), svg("circle", { cx: x0, cy: y0, r: 4, fill: color, class: "lab-cord-plug" }));
      }
    }
  }
  let queued = false; const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };
  const stop = pcb.onView(later), ro = new ResizeObserver(later); ro.observe(layer); row.addEventListener("scroll", later, { passive: true });
  return {
    /** the instruments of a sheet : drawn, their points marked on the board, their cords run */
    show(sheet) {
      gear = sheet && !sheet.noSim ? benchGear(sheet) : []; row.replaceChildren(); row.hidden = !gear.length;
      if (gear.length) row.append(...gear.map(card), el("p", { class: "gear-circuit" }, icon("chip"), " ", CIRCUIT_NOTE, " ", o.pcbaHref ? el("a", { href: o.pcbaHref }, "Ouvrir le PCBA") : null));
      return gear.flatMap((g) => g.leads.filter((l) => l.ref).map((l) => ({ ...l, gear: g.key })));      // the points to mark on the board (each with its instrument)
    },
    /** the button of the board held, or released : its drawing follows */
    pressed(on) { down = !!on; for (const c of row.querySelectorAll('.gear-card[data-kind="press"]')) { const g = gear.find((x) => x.key === c.dataset.gear), old = c.querySelector(".gear-pic"); if (g && old) old.replaceWith(gearPic({ ...g, down }, `${g.name} — ${g.to}`)); } later(); },
    redraw: later,
    destroy() { stop(); ro.disconnect(); row.remove(); cords.remove(); },
  };
}

/** A button of the board, pressed by a click on it in the view : held while the pointer is down, released when it lets go.
    node : the part as drawn (labBoard().partNode) ; on(down) is told each change. → a function that removes it. */
export function pressable(node, on) {
  if (!node) return () => {};
  node.classList.add("pressable"); node.setAttribute("role", "button"); node.setAttribute("tabindex", "0"); node.setAttribute("aria-label", "Bouton de la carte : appuyer — tenir le clic, ou la barre d'espace");
  let held = false; const up = () => { if (!held) return; held = false; node.classList.remove("held"); on(false); window.removeEventListener("pointerup", up); };
  const press = (e) => { if (e.button !== undefined && e.button !== 0) return; e.stopPropagation(); e.preventDefault(); held = true; node.classList.add("held"); on(true); window.addEventListener("pointerup", up); };
  const key = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (e.type === "keydown" && !held) { held = true; node.classList.add("held"); on(true); } if (e.type === "keyup") up(); } };
  node.addEventListener("pointerdown", press); node.addEventListener("keydown", key); node.addEventListener("keyup", key);
  return () => { up(); node.classList.remove("pressable", "held"); node.removeEventListener("pointerdown", press); node.removeEventListener("keydown", key); node.removeEventListener("keyup", key); };
}
