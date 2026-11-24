/* DynamiteOrbit.ai — Logiciel, « Essayer » : the USAGE PROFILE played on the bench (demande de JP, 24 novembre 2026 : « un profil d'utilisation
   temporel avec des événements types qui arrivent et déclenchent le logiciel via le matériel, et dont on voit la réponse… superposer la
   storyline temporelle avec un pop-up qui raconte les événements, et laisser le multi-graphe du logiciel en dessous »).
   Three things, each in its place : the STORYLINE — a time line, one numbered mark per event, the cursor of the bench running along it ; the
   BUBBLE — the event that just happened in words, then, as the time reaches them, what the software and the product answered (« Contactor :
   ouvert, 1,49 s après ») ; the chronogram stays below, untouched. « Jouer le profil » starts the bench again and lets the events come : each
   one sets the instruments of the bench as the product would (sw/sw_story.js) — the same step as the C. A click on a mark replays up to it.
   « Suivant » plays ONE event at a time (JP : « jouer chaque partie une à la fois avec un arrêt jusqu'à ce qu'on actionne Suivant… et on voit
   l'état changé, les valeurs mesurées, l'output changé ») : the event is applied, the time runs until all it causes has happened, the bench
   stops. The bubble is a strip under the storyline — never over the pieces, whose values and states it would hide (JP, sur une capture).
   THE PROFILES (JP : « un profil de charge et un de décharge… un bouton pour passer de l'un à l'autre… ou une banque de profils de mission en
   .txt qui peuvent venir de l'IA ») : a switch over the profiles the design keeps — Charge | Décharge for a product with an ESS ; none when the
   design keeps none, and the tool writes one —, and « Banque de profils » (modules/sw_profile_bank.js). The choice is kept by the browser.
   What it follows : the timeline of a media player, the captions of a guided tour, the « step over » of a debugger, a segmented control. */

import { el, btn, icon } from "../core/dom.js";
import { profileOf, profilesOf, playProfile } from "../sw/sw_story.js";
import { openBank } from "./sw_profile_bank.js";

const fr = (ms) => `${String(+(ms / 1000).toFixed(1)).replace(".", ",")} s`;
const PKEY = (d) => `dw.sw.profile.${d.id || "sw"}`;
const chosen = (d) => { try { return localStorage.getItem(PKEY(d)); } catch (e) { return null; } };

/** bench : the live bench ; design() ; onSet() : the instruments were changed by an event ; change(label, fn) : an undoable step on the design.
    → { line, bubble, tick(), play(), next(), dispose() } */
export function swStory(bench, design, onSet, change) {
  const st = { on: false, at: -1, until: null, manual: false, id: null }; let E = [], V = [], total = 1;
  const cursor = el("i", { class: "sws-cursor", "aria-hidden": "true" }), marks = el("div", { class: "sws-marks" }), bubble = el("div", { class: "sws-bubble", hidden: true, role: "status", "aria-live": "polite", "data-sw-bubble": "" });
  const go = btn("Jouer le profil", () => play(), { small: true, primary: true, icon: "play", tip: "Le banc repart de zéro et les événements arrivent un à un, en temps réel : ce qui arrive au produit, ce que le logiciel répond" }); go.dataset.swStoryPlay = "";
  const nextB = btn("Suivant", () => next(), { small: true, icon: "chevron-right", tip: "Un événement à la fois : il arrive, le logiciel répond, puis tout s'arrête — on regarde l'état, les valeurs et les sorties, puis « Suivant » encore" }); nextB.classList.add("sws-next"); nextB.dataset.swStoryNext = "";
  const pick = el("div", { class: "sws-pick", role: "radiogroup", "aria-label": "Le profil joué", "data-sw-profiles": "" });
  const bank = btn("Banque", () => openBank({ design, change, current: st.id, choose: (id) => load(id) }), { small: true, icon: "folder", tip: "Les profils de mission de ce logiciel : en choisir un, en importer un (.txt), l'exporter, ou demander à une IA d'en écrire un" }); bank.dataset.swProfileBank = "";
  const total$ = el("small", { class: "sws-total" });
  const line = el("div", { class: "sws-line" }, pick, go, nextB, el("div", { class: "sws-track" }, el("span", { class: "sws-rail" }), marks, cursor), total$, bank);
  const vis = () => { let v = -1; for (let k = 0; k <= st.at && k < E.length; k++) if (!E[k].hidden) v = k; return v; };      // the last event one SEES

  /* a profile : its events played on the model, its marks, its switch */
  function load(id) {
    const d = design(), all = profilesOf(d); st.id = all.find((p) => p.id === id) ? id : all.find((p) => p.id === chosen(d)) ? chosen(d) : all[0] ? all[0].id : null;
    if (id && st.id === id) { try { localStorage.setItem(PKEY(d), id); } catch (e) { /* the choice holds until the page is left */ } }
    const plan = playProfile(d, profileOf(d, st.id)); E = plan.events; total = plan.duration; V = E.map((e, k) => (e.hidden ? -1 : k)).filter((k) => k >= 0);
    st.on = false; st.manual = false; st.at = -1; bubble.hidden = true; total$.textContent = fr(total); line.dataset.swStory = String(V.length);
    marks.replaceChildren(...V.map((k, n) => { const e = E[k]; return el("button", { type: "button", class: "sws-mark", style: `left:${(100 * e.t) / total}%`, "data-sws": e.id, "data-tip": `${fr(e.t)} — ${e.title}`, "aria-label": `Événement ${n + 1} à ${fr(e.t)} : ${e.title}`, onClick: () => play(k) }, String(n + 1)); }));
    pick.replaceChildren(...(all.length > 1 ? all.map((p) => el("button", { type: "button", role: "radio", class: p.id === st.id ? "on" : "", "aria-checked": p.id === st.id ? "true" : "false", "data-profile": p.id, "data-tip": `Le profil « ${p.name} »${p.kind ? ` (${p.kind})` : ""}`, onClick: () => { if (p.id !== st.id) { bench.pause(); load(p.id); bench.reset(); } } }, icon(p.kind === "charge" ? "bolt" : p.kind === "discharge" ? "power" : "flow"), p.name)) : []));
    pick.hidden = all.length < 2; nextB.lastChild.textContent = "Suivant"; delete nextB.dataset.done; marksOn();
  }
  function show(k) {
    const e = E[k]; if (!e) return; bubble.hidden = false; const now = bench.L ? bench.L.t : 0, seen = e.answers.filter((a) => a.t <= now), n = V.indexOf(k);
    bubble.replaceChildren(...[el("div", { class: "sws-head" }, el("span", { class: "sws-n" }, String(n + 1)), el("small", null, `${fr(e.t)} · événement ${n + 1} sur ${V.length}`), el("button", { type: "button", class: "icon-btn", "aria-label": "Fermer la bulle", onClick: () => { bubble.hidden = true; } }, "×")),
      el("b", null, e.title), el("p", null, e.says),
      e.answers.length ? el("div", { class: "sws-answer" }, el("small", null, icon("chip"), " Le logiciel et le produit répondent"), el("ul", null, e.answers.map((a) => el("li", { class: a.t <= now ? "seen" : "wait" }, a.t <= now ? "✓ " : "… ", `${a.text}`, el("em", null, ` — ${a.when} après`)))))
        : n ? el("p", { class: "sws-quiet" }, "Le logiciel ne change rien : rien ne dépasse un seuil.") : null].filter(Boolean));
    bubble.dataset.seen = String(seen.length);
  }
  function apply() { const t = bench.L ? bench.L.t : 0; let changed = false; while (st.at + 1 < E.length && E[st.at + 1].t <= t) { st.at++; for (const [id, v] of Object.entries(E[st.at].set || {})) { bench.set(id, v); changed = true; } } if (changed && onSet) onSet(); }
  /* runs the bench up to the time `until`, the events met on the way applied : one call per event */
  function runTo(until) { const dt = bench.L.m.dt; while (bench.L.t < until) { apply(); const n = E[st.at + 1] ? Math.min(E[st.at + 1].t, until) : until; bench.step(Math.max(1, Math.ceil((n - bench.L.t) / dt))); } apply(); }
  function marksOn() { const v = vis(); for (const m of marks.children) m.classList.toggle("on", !!E[v] && m.dataset.sws === E[v].id); cursor.style.left = `${Math.min(100, (100 * (bench.L ? bench.L.t : 0)) / total)}%`; }
  const say = () => { const n = V.indexOf(vis()), left = V.length - 1 - n; nextB.lastChild.textContent = left > 0 ? `Suivant (${n + 2} / ${V.length})` : "Recommencer pas à pas"; if (left > 0) delete nextB.dataset.done; else nextB.dataset.done = ""; };
  /* ONE event one sees : applied, then the time runs until all it causes has happened (its answers, then 0.3 s), never past the next one */
  function next() {
    if (!st.manual || V.indexOf(vis()) >= V.length - 1) { bench.reset(); bench.pause(); st.on = false; st.manual = true; st.at = -1; } else bench.pause();
    const k = V[V.indexOf(vis()) + 1], e = E[k], nk = V[V.indexOf(k) + 1], dt = bench.L.m.dt, after = Math.max(e.t, ...e.answers.map((a) => a.t)) + 300;
    runTo(Math.max(e.t, nk !== undefined ? Math.min(after, E[nk].t - dt) : Math.min(after, total))); if (onSet) onSet(); show(vis()); marksOn(); say();
  }
  function play(upTo = 0) {
    st.manual = false; nextB.lastChild.textContent = "Suivant"; delete nextB.dataset.done;
    bench.reset(); bench.pause(); st.on = true; st.at = -1; st.until = upTo > 0 ? E[upTo].t : null;
    if (st.until) runTo(st.until); else apply();      // up to the event chosen, a few calls : one per event
    if (bench.setSpeed) bench.setSpeed(1); bench.play(); tick();
  }
  function tick() {
    const t = bench.L ? bench.L.t : 0; cursor.style.left = `${Math.min(100, (100 * t) / total)}%`; if (!st.on) return;
    const was = vis(); apply(); const v = vis(); if (v >= 0) show(v); if (v !== was) marksOn();
    if (t >= total) { st.on = false; bench.pause(); }
  }
  load(null);
  return { line, bubble, tick, play, next, dispose() { st.on = false; } };
}
