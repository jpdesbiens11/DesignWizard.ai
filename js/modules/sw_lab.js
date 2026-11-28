/* DynamiteOrbit.ai — Logiciel : the SOFTWARE LAB (demande de JP, 24 novembre 2026 : « the SW simulation interface needs to look a bit more like the
   HW Visual lab sim aspect as well. Like a SW lab testing »). As on the bench of the Labo of a board, the INSTRUMENTS stand above what is tested,
   each set ON ITS FACE : a source per input of the software — its display in the unit of the sensor, its knob, the counts it puts on the pin ;
   a switch with its lamp for a logic input ; a selector for a contact that follows its coil or is jammed — and, at the end of the rack, the
   PANEL OF LAMPS of what the software commands (a coil, a lamp, a valve), lit when the pin is at 1. Under the blocks, the chronogram is drawn
   as a scope screen (modules/sw_bench.js). Nothing is computed here : the bench is the live simulation's (sw/sw_live.js) — the same step as the C.
   What it follows : the instruments of the Labo (modules/elab_gear.js) — a front panel per instrument, its reading on a display. */

import { plantPins } from "../sw/sw_live.js";
import { el, icon } from "../core/dom.js";
import { KINDS } from "../sw/sw_objects.js";
import { DEVICES } from "../sw/sw_devices.js";
import { physText, shownUnit, toShown, toInside, shownStep } from "../sw/sw_units.js";

const fr = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace("-", "−");
const CONTACT = [["follows", "suit"], ["open", "coincé ouvert"], ["closed", "soudé"]];
const JACKS = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
/** The rack. bench : the live bench (modules/sw_bench.js) ; design() → the design. → { node, refresh() } — refresh() reads the bench again without redrawing. */
/* the colour of a lamp of the bench : a LED says its own (« verte », « jaune », « rouge »), a pump or a fan that runs is green, the rest red */
const lampColour = (o) => { const n = String(o.name || "").toLowerCase(); if (o.device === "pump" || o.device === "fan") return "green"; if (o.device === "led") return /vert|green/.test(n) ? "green" : /jaune|yellow|ambre/.test(n) ? "yellow" : "red"; return "red"; };
export function swRack(bench, design) {
  const node = el("div", { class: "swlab-rack", role: "group", "aria-label": "Le banc du logiciel : les instruments qui tiennent ses entrées, les témoins de ses sorties", "data-sw-rack": "" });
  const devOf = (id) => { const d = design(), o = d && d.objects.find((x) => x.id === id); return o && o.device ? DEVICES[o.device] : null; };
  const lamps = [], reads = [];
  function draw() {
    node.replaceChildren(); lamps.length = 0; reads.length = 0; const L = bench.L; if (!L) return; const driven = plantPins(L);
    /* COMPACT while a module is on the bench (JP, 26 novembre 2026 : « do they say something useful? can we change and compact them to keep them? ») :
       what the module drives is READ on one line — the same values as the monitoring and the mission ; what one injects by hand stays a small
       switch — the chain that falls silent, the acknowledge button, the contact jammed open or welded. The outputs are in the mission. */
    node.classList.toggle("compact", !!L.plant);
    if (L.plant) { L.inputs.forEach((i) => { const v = L.set[i.id];
        if (i.kind === "analog") { const b = el("b", null, physText(v, i.unit)); reads.push([i, b]); node.append(el("span", { class: "swlab-chip read", "data-sw-gear": i.id, title: "Mené par le module simulé : lu, pas réglé à la main" }, icon("sensor"), el("span", null, i.name), b)); return; }
        if (i.kind === "digital") { node.append(el("button", { type: "button", class: `swlab-chip sw${v ? " on" : ""}`, "data-sw-gear": i.id, "data-bench": i.id, "aria-pressed": v ? "true" : "false", title: "Injecter à la main : 0 ou 1", onClick: () => { bench.set(i.id, L.set[i.id] ? 0 : 1); draw(); } }, el("i", { class: `swlab-led${v ? " on" : ""}` }), el("span", null, i.name), el("b", null, v ? "1" : "0"))); return; }
        node.append(el("span", { class: "swlab-chip", "data-sw-gear": i.id }, icon("power"), el("span", null, i.name), el("span", { class: "swlab-seg mini", role: "group", "aria-label": `${i.name} : ce que fait le contact` }, CONTACT.map(([k, l]) => el("button", { type: "button", class: v === k ? "on" : "", "aria-pressed": v === k ? "true" : "false", "data-bench": `${i.id}:${k}`, title: k === "follows" ? "Sain : il suit la bobine" : k === "open" ? "Panne : reste ouvert" : "Panne : reste fermé", onClick: () => { bench.set(i.id, k); draw(); } }, l))))); });
      return; }
    L.inputs.forEach((i, n) => { const D = devOf(i.id), v = L.set[i.id], head = el("h4", null, icon(D ? D.icon : i.kind === "analog" ? "sensor" : "chip"), el("span", null, i.name), el("small", null, D ? D.label : i.kind === "analog" ? "source" : i.kind === "digital" ? "entrée" : "contact"));
      const gear = el("div", { class: "swlab-gear", "data-sw-gear": i.id, style: `--jack:${JACKS[n % JACKS.length]}` }, head);
      if (i.kind === "analog") { const U = i.unit, lcd = el("input", { type: "number", min: toShown(i.min, U), max: toShown(i.max, U), step: String(Math.max(shownStep(U), toShown(i.step, U))), value: String(toShown(v, U)), "aria-label": `${i.name}, en ${shownUnit(U)}`, "data-bench": i.id }), range = el("input", { type: "range", min: i.min, max: i.max, step: i.step, value: String(v), "aria-label": `${i.name} (bouton)`, "data-bench-range": i.id }), note = el("p", { class: "swlab-note" }), face = el("div", { class: "swlab-lcd" }, lcd, el("span", null, shownUnit(U)));
        const say = () => { const x = L.set[i.id], odd = i.lo !== undefined && (x < i.lo || x > i.hi); note.textContent = odd ? `hors de la plage vraisemblable (${physText(i.lo, U)} à ${physText(i.hi, U)}) : le logiciel ne doit pas la croire` : `${physText(i.min, U)} … ${physText(i.max, U)} · à la broche : ${fr(i.toCounts(x))} comptes sur ${fr(i.full)}`; note.classList.toggle("warn", !!odd); face.classList.toggle("warn", !!odd); };
        const put = (x, from) => { bench.set(i.id, x); const now = L.set[i.id]; if (from !== lcd) lcd.value = String(toShown(now, U)); if (from !== range) range.value = String(now); say(); };
        lcd.addEventListener("input", () => { if (lcd.value !== "") put(toInside(lcd.value, U), lcd); });      // typed in V, A, °C : the bench keeps the whole numbers of the software range.addEventListener("input", () => put(Number(range.value), range)); say();
        /* a pin the module on the bench drives (sw/sw_pack.js) : the instrument READS it, as the monitoring does — it follows the module, it is not set by hand */
        if (driven.has(i.id)) { lcd.readOnly = true; range.disabled = true; gear.classList.add("driven"); reads.push([i, lcd, range]); note.textContent = "Mené par le module simulé : il suit la charge ou la décharge."; gear.append(face, range, note); }
        else gear.append(face, range, note);
      } else if (i.kind === "digital") { const led = el("i", { class: `swlab-led${v ? " on" : ""}` }), sw = el("button", { type: "button", class: "swlab-sw", "aria-pressed": v ? "true" : "false", "data-bench": i.id, onClick: () => { bench.set(i.id, L.set[i.id] ? 0 : 1); draw(); } }, v ? "1 — ACTIF" : "0 — repos");
        gear.append(el("div", { class: "swlab-toggle" }, led, sw), el("p", { class: "swlab-note" }, D ? D.text : "Ce que la broche lit : 0 ou 1."));
      } else gear.append(el("div", { class: "swlab-seg", role: "group", "aria-label": `${i.name} : ce que fait le contact` }, CONTACT.map(([k, l]) => el("button", { type: "button", class: v === k ? "on" : "", "aria-pressed": v === k ? "true" : "false", "data-bench": `${i.id}:${k}`, onClick: () => { bench.set(i.id, k); draw(); } }, l))),
        el("p", { class: "swlab-note" }, v === "follows" ? `Il suit « ${i.ofName} », ${i.delay} ms plus tard : sain.` : v === "open" ? "Panne : reste ouvert même commandé." : "Panne : reste fermé même relâché."));
      gear.append(el("i", { class: "swlab-jack", "aria-hidden": "true" })); node.append(gear); });
    const d = design(), outs = d ? d.objects.filter((o) => !o.off && KINDS[o.kind] && KINDS[o.kind].pin === "dout") : [];
    if (outs.length) node.append(el("div", { class: "swlab-gear swlab-panel", "data-sw-lamps": String(outs.length) }, el("h4", null, icon("power"), el("span", null, "Ce que le logiciel commande"), el("small", null, "témoins")),
      el("div", { class: "swlab-outs" }, outs.map((o) => { const led = el("i", { class: `swlab-led ${lampColour(o)}` }), turns = o.device === "pump" || o.device === "fan"; lamps.push([`${o.id}.level`, led]); return el("span", { class: `swlab-out${turns ? " turns" : ""}`, "data-sw-lamp": o.id, title: o.device && DEVICES[o.device] ? DEVICES[o.device].text : o.name }, led, turns ? icon("refresh", "swlab-spin") : null, o.name.length > 26 ? `${o.name.slice(0, 25)}…` : o.name); }))));
    refresh();
  }
  function refresh() { const L = bench.L; if (L) for (const [i, lcd, range] of reads) { const v = L.set[i.id]; if (!range) { lcd.textContent = physText(v, i.unit); continue; } lcd.value = String(toShown(v, i.unit)); range.value = String(v); }
    for (const [ref, led] of lamps) { const on = bench.values(ref) === 1; led.classList.toggle("on", on); led.parentNode.classList.toggle("on", on); } }
  draw();
  return { node, refresh, redraw: draw };
}
