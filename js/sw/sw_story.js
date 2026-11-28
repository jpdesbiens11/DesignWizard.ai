/* DynamiteOrbit.ai — Logiciel : the USAGE PROFILE of the « Essayer » step (demande de JP, 24 novembre 2026 : « un profil d'utilisation temporel
   avec des événements types qui arrivent et déclenchent le logiciel via le matériel, et dont on voit la réponse — feedback produit et logiciel…
   superposer la storyline temporelle avec un pop-up qui raconte les événements, et laisser le multi-graphe du logiciel en dessous »).
   A profile is a list of EVENTS in time : what happens to the product (a cell heats, the chain of boards falls silent, someone presses a
   button), said in words, and what it puts on the pins of the board (`set` : an input of the bench, in the units the software keeps).
   The tool writes one for any software — the logical choices of a novice : at rest, then each input pushed past the threshold that reads it
   and brought back, then each logic input switched and switched back — or the project keeps its own (`design.profile`).
   playProfile runs it on the MODEL — the same step as the C (sw/sw_live.js) — and gives, for each event, what the software DID in answer :
   each 0 / 1 output that changed, when, said in words (« Contactor : ouvert, 610 ms après »), and the state of the product.
   Pure : no page. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { liveStart, liveSet, liveStep } from "./sw_live.js";
import { liveWires, split } from "./sw_design.js";
import { physText, STATE_NAMES } from "./sw_units.js";
import { DEVICES } from "./sw_devices.js";

const nameOf = (d, ref) => { const [id, key] = split(ref), o = (d.objects || []).find((x) => x.id === id); return { o, key, name: o ? o.name : id }; };
const fr1 = (ms) => `${String(+(ms / 1000).toFixed(2)).replace(".", ",")} s`;
/** The profile the tool writes for a software : at rest, then each input past its threshold and back, each logic input switched and back. → [{ t, id, title, says, set }] */
export function autoProfile(d) {
  const L = liveStart(d), W = liveWires(d), objs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind]), ev = [], gap = 3000; let t = 0;
  ev.push({ t: 0, id: "start", title: "Mise sous tension", says: "La carte s'allume : le logiciel démarre, tout est au repos.", set: {} }); t = 1500;
  /* a threshold that feeds a fault latch stops the product until an acknowledgement : those events come last, the others are seen first */
  const latches = (q, seen = new Set()) => { if (seen.has(q.id)) return false; seen.add(q.id);      // followed through the gates that combine it
    return W.some((w) => w.from.startsWith(`${q.id}.`) && objs.some((x) => w.to.startsWith(`${x.id}.`) && (x.kind === "fault_latch" || (x.kind === "logic" && latches(x, seen))))); };
  const items = []; for (const i of L.inputs) { const m = i.kind === "analog" ? objs.find((o) => W.some((w) => w.from === `${i.id}.counts` && w.to === `${o.id}.counts`)) : null;
    if (m) for (const q of objs.filter((x) => x.kind === "limit" && W.some((w) => w.from === `${m.id}.value` && w.to === `${x.id}.value`))) items.push({ i, q, last: latches(q) }); else if (i.kind === "digital") items.push({ i, q: null, last: false }); }
  items.sort((a, b) => Number(a.last) - Number(b.last));
  for (const { i, q: q0 } of items) { const pin = objs.find((o) => o.id === i.id), D = pin && pin.device && DEVICES[pin.device];
    if (i.kind === "analog") {
      for (const q of [q0]) { const c = cfgOf(q), step = Math.max(1, Math.round(Math.abs(c.trip) * 0.04)), rest = L.set[i.id];
        /* just past ITS threshold, short of a harder one on the same measure : « to watch » at 4,18 V is not pushed beyond the limit of 4,25 V */
        const src = (W.find((w) => w.to === `${q.id}.value`) || {}).from, harder = objs.filter((x) => x !== q && x.kind === "limit" && W.some((w) => w.from === src && w.to === `${x.id}.value`)).map(cfgOf).filter((h) => !!h.above === !!c.above && (c.above ? h.trip > c.trip : h.trip < c.trip)).map((h) => h.trip);
        const past = c.above ? Math.min(c.trip + step, ...harder.map((h) => Math.floor((c.trip + h) / 2))) : Math.max(c.trip - step, ...harder.map((h) => Math.ceil((c.trip + h) / 2)));
        ev.push({ t, id: `${q.id}-in`, title: `${i.name} : ${c.above ? "monte" : "descend"} au-delà de « ${q.name} »`, says: `${D ? `${D.label} : ` : ""}${i.name} passe de ${physText(rest, i.unit)} à ${physText(past, i.unit)} — au-delà du seuil de ${physText(c.trip, i.unit)}.`, set: { [i.id]: past } });
        t += Math.max(gap, c.delay + 1500);
        ev.push({ t, id: `${q.id}-out`, title: `${i.name} : retour à la normale`, says: `${i.name} revient à ${physText(rest, i.unit)}.`, set: { [i.id]: rest } }); t += gap; } }
    else if (i.kind === "digital") { const was = L.set[i.id] ? 1 : 0;
      ev.push({ t, id: `${i.id}-on`, title: `${i.name} : ${was ? "relâché" : "actif"}`, says: `${D ? `${D.label} : ` : ""}la broche « ${i.name} » passe à ${was ? 0 : 1}.`, set: { [i.id]: was ? 0 : 1 } }); t += gap;
      ev.push({ t, id: `${i.id}-off`, title: `${i.name} : retour`, says: `La broche « ${i.name} » revient à ${was}.`, set: { [i.id]: was } }); t += gap; } }
  ev.push({ t, id: "end", title: "Fin du profil", says: "Le profil est joué. Rejouez-le, ou changez un instrument du banc pour voir ce que fait le logiciel.", set: {} });
  return ev;
}
/** The profiles a design keeps (`design.profiles` : [{ id, name, kind, events }] — a charge and a discharge for a product with an ESS, or those
    imported from the bank), else its single profile of before (`design.profile`), else none : the tool writes one. */
export const profilesOf = (d) => (d && Array.isArray(d.profiles) && d.profiles.length ? d.profiles : d && Array.isArray(d.profile) && d.profile.length ? [{ id: "own", name: "Profil du projet", events: d.profile }] : []);
/** The events of a profile : the one named, else the first the design keeps, else the one the tool writes. */
export const profileOf = (d, id) => { const all = profilesOf(d), p = all.find((x) => x.id === id) || all[0]; return p ? p.events : autoProfile(d || {}); };
/** A profile as it is played : a PULSE (`pulse: { ack: 300 }` — a button pressed then released) becomes the press, then a hidden event that
    releases it ; hidden events are applied like the others but have no mark, no bubble, no « Suivant » of their own. */
export function expandProfile(events) {
  const out = []; for (const e of events || []) { out.push({ ...e, set: { ...(e.set || {}), ...Object.fromEntries(Object.keys(e.pulse || {}).map((k) => [k, 1])) } });
    for (const [k, ms] of Object.entries(e.pulse || {})) out.push({ t: e.t + ms, id: `${e.id}~${k}`, title: "", says: "", set: { [k]: 0 }, hidden: true }); }
  return out.sort((a, b) => a.t - b.t);
}

/** What a 0 / 1 output going to a value means, in words. */
export function sayOutput(d, ref, to) {
  const { o, key, name } = nameOf(d, ref), D = o && o.device && DEVICES[o.device];
  if (o && KINDS[o.kind].pin === "dout" && o.device === "led") return `${name} : ${to ? "allumée" : "éteinte"}`;
  if (o && KINDS[o.kind].pin === "dout" && o.device === "buzzer") return `${name} : ${to ? "sonne" : "se tait"}`;
  if (o && KINDS[o.kind].pin === "dout" && (o.device === "pump" || o.device === "fan")) return `${name} : ${to ? "en marche" : "à l'arrêt"}`;
  if (o && KINDS[o.kind].pin === "dout") return `${D ? D.label : name} : ${to ? "commandé" : "relâché"}`;
  if (o && o.kind === "balancing") return `${name} : ${to ? "la résistance de la CORE la plus haute est branchée" : "résistance débranchée"}`;
  if (o && o.kind === "state_lamp") return `${name} : ${{ green: "vert", yellow: "jaune", red: "rouge" }[key] || key}`;
  if (o && o.kind === "contactor" && key === "drive") return `${name} : ${to ? "fermé" : "ouvert"}`;
  if (o && o.kind === "limit") return `${name} : ${to ? "déclenché" : "relâché"}`;
  if (o && o.kind === "fault_latch") return `${name} : ${to ? "défaut retenu" : "défaut oublié"}`;
  return `${name} · ${key} : ${to}`;
}
/** Plays a profile on the model. → { duration, events: [{ ...event, answers: [{ t, after, ref, to, text }], state? }], trace : { t, ports } } */
/* an answer worth saying : a lamp or a LED that lights (its going out is said by the one that lights next) */
const worth = (d, ref, to) => { const { o } = nameOf(d, ref); return !(o && (o.kind === "state_lamp" || o.device === "led") && !to); };
export function playProfile(d, profile = profileOf(d)) {
  const L = liveStart(d, 1e9), dt = d.period || 10, evs = expandProfile(profile), end = (evs.length ? evs[evs.length - 1].t : 0) + 1000, out = evs.map((e) => ({ ...e, answers: [] }));
  /* what the software answers : its decisions, the state of a module, and what it commands on the board — not the pins it reads */
  const watch = [...new Set((d.objects || []).filter((o) => !o.off && KINDS[o.kind] && KINDS[o.kind].pin !== "ain" && KINDS[o.kind].pin !== "din").flatMap((o) => (o.kind === "module_state" ? ["state"] : KINDS[o.kind].ports.out.filter((p) => p.unit === "0/1").map((p) => p.key)).map((k) => `${o.id}.${k}`).concat(KINDS[o.kind].pin === "dout" ? [`${o.id}.level`] : [])))];
  let at = -1, vis = -1, prev = null;      // what the software answers is told with the last event one SEES (a hidden release is part of its press)
  for (let k = 0; k * dt <= end; k++) { const now = k * dt; while (at + 1 < out.length && out[at + 1].t <= now) { at++; if (!out[at].hidden) vis = at; for (const [id, v] of Object.entries(out[at].set || {})) liveSet(L, id, v); }
    liveStep(L, 1); const cur = Object.fromEntries(watch.map((r) => [r, L.m.last[r]]));
    if (prev && vis >= 0) for (const r of watch) if (cur[r] !== prev[r] && worth(d, r, cur[r])) { const { o } = nameOf(d, r), state = o && o.kind === "module_state" && r.endsWith(".state");
      out[vis].answers.push({ t: now, after: now - out[vis].t, ref: r, to: cur[r], text: state ? `${o.name} : ${STATE_NAMES[cur[r]] || cur[r]}` : sayOutput(d, r, cur[r]) }); }
    prev = cur; }
  for (const e of out) e.answers = e.answers.map((a) => ({ ...a, when: fr1(a.after) }));
  return { duration: end, events: out, trace: L.trace };
}
