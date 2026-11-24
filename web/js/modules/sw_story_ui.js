/* DynamiteOrbit.ai — Logiciel, « Essayer » : the USAGE PROFILE played on the bench (demande de JP, 24 novembre 2026 : « un profil d'utilisation
   temporel avec des événements types qui arrivent et déclenchent le logiciel via le matériel, et dont on voit la réponse… superposer la
   storyline temporelle avec un pop-up qui raconte les événements, et laisser le multi-graphe du logiciel en dessous »).
   Three things, each in its place : the STORYLINE — a time line under the pieces, one numbered mark per event, the cursor of the bench running
   along it ; the BUBBLE over the pieces — the event that just happened in words, then, as the time reaches them, what the software and the
   product answered (« Contactor : ouvert, 1,49 s après ») ; the chronogram stays below, untouched. « Jouer le profil » starts the bench
   again and lets the events come : each one sets the instruments of the bench as the product would (sw/sw_story.js) — the same step as the C.
   A click on a mark replays the profile up to that event. What it follows : the timeline of a media player, and the captions of a guided tour. */

import { el, btn, icon } from "../core/dom.js";
import { profileOf, playProfile } from "../sw/sw_story.js";

const fr = (ms) => `${String(+(ms / 1000).toFixed(1)).replace(".", ",")} s`;
/** bench : the live bench (modules/sw_bench.js) ; design() ; onSet() : the instruments were changed by an event. → { line, bubble, tick(), play(), dispose() } */
export function swStory(bench, design, onSet) {
  const d = design(), plan = playProfile(d, profileOf(d)), E = plan.events, total = plan.duration;
  const st = { on: false, at: -1, until: null };
  const cursor = el("i", { class: "sws-cursor", "aria-hidden": "true" }), marks = el("div", { class: "sws-marks" }), bubble = el("div", { class: "sws-bubble", hidden: true, role: "status", "aria-live": "polite", "data-sw-bubble": "" });
  const go = btn("Jouer le profil d'utilisation", () => play(), { small: true, primary: true, icon: "play", tip: "Le banc repart de zéro et les événements arrivent un à un : ce qui arrive au produit, ce que le logiciel répond" }); go.dataset.swStoryPlay = "";
  E.forEach((e, i) => marks.append(el("button", { type: "button", class: "sws-mark", style: `left:${(100 * e.t) / total}%`, "data-sws": e.id, "data-tip": `${fr(e.t)} — ${e.title}`, "aria-label": `Événement ${i + 1} à ${fr(e.t)} : ${e.title}`, onClick: () => play(i) }, String(i + 1))));
  const line = el("div", { class: "sws-line", "data-sw-story": String(E.length) }, go, el("div", { class: "sws-track" }, el("span", { class: "sws-rail" }), marks, cursor), el("small", { class: "sws-total" }, fr(total)));
  function show(i) {
    const e = E[i]; if (!e) return; bubble.hidden = false; const now = bench.L ? bench.L.t : 0, seen = e.answers.filter((a) => a.t <= now);
    bubble.replaceChildren(...[el("div", { class: "sws-head" }, el("span", { class: "sws-n" }, String(i + 1)), el("small", null, `${fr(e.t)} · événement ${i + 1} sur ${E.length}`), el("button", { type: "button", class: "icon-btn", "aria-label": "Fermer la bulle", onClick: () => { bubble.hidden = true; } }, "×")),
      el("b", null, e.title), el("p", null, e.says),
      e.answers.length ? el("div", { class: "sws-answer" }, el("small", null, icon("chip"), " Le logiciel et le produit répondent"), el("ul", null, e.answers.map((a) => el("li", { class: a.t <= now ? "seen" : "wait" }, a.t <= now ? "✓ " : "… ", `${a.text}`, el("em", null, ` — ${a.when} après`)))))
        : i ? el("p", { class: "sws-quiet" }, "Le logiciel ne change rien : rien ne dépasse un seuil.") : null].filter(Boolean));
    bubble.dataset.seen = String(seen.length);
  }
  function play(upTo = 0) {
    bench.reset(); bench.pause(); st.on = true; st.at = -1; st.until = upTo > 0 ? E[upTo].t : null;
    if (st.until) { const dt = bench.L.m.dt; while (bench.L.t < st.until) { apply(); const next = E[st.at + 1] ? Math.min(E[st.at + 1].t, st.until) : st.until; bench.step(Math.max(1, Math.ceil((next - bench.L.t) / dt))); } }      // up to the event chosen, a few calls : one per event
    apply();
    if (bench.setSpeed) bench.setSpeed(1); bench.play(); tick();
  }
  function apply() { const t = bench.L ? bench.L.t : 0; let changed = false; while (st.at + 1 < E.length && E[st.at + 1].t <= t) { st.at++; for (const [id, v] of Object.entries(E[st.at].set || {})) { bench.set(id, v); changed = true; } } if (changed && onSet) onSet(); }
  function tick() {
    const t = bench.L ? bench.L.t : 0; cursor.style.left = `${Math.min(100, (100 * t) / total)}%`; if (!st.on) return;
    const was = st.at; apply(); if (st.at >= 0) show(st.at); if (st.at !== was) for (const m of marks.children) m.classList.toggle("on", m.dataset.sws === (E[st.at] || {}).id);
    if (t >= total) { st.on = false; bench.pause(); }
  }
  return { line, bubble, tick, play, dispose() { st.on = false; } };
}
