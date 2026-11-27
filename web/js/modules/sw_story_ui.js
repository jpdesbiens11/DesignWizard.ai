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
import { profileOf, profilesOf, playProfile, expandProfile, sayOutput } from "../sw/sw_story.js";
import { STATE_NAMES } from "../sw/sw_units.js";
import { liveStep, liveSet } from "../sw/sw_live.js";
import { packLimits } from "../sw/sw_pack.js";
import { monitorOf } from "../sw/sw_monitor.js";      // the conditions — not an action like the pump's threshold
import { openBank } from "./sw_profile_bank.js";
import { missionsOf } from "./sw_lean_ui.js";      // the missions written from the requirements : the bench plays them too

const fr = (ms) => `${String(+(ms / 1000).toFixed(1)).replace(".", ",")} s`;
const PKEY = (d) => `dw.sw.profile.${d.id || "sw"}`;
const chosen = (d) => { try { return localStorage.getItem(PKEY(d)); } catch (e) { return null; } };

/** bench : the live bench ; design() ; onSet() : the instruments were changed by an event ; change(label, fn) : an undoable step on the design.
    → { line, bubble, tick(), play(), next(), dispose() } */
export function swStory(bench, design, onSet, change, onHalt = null) {
  const st = { on: false, at: -1, until: null, manual: false, id: null, live: false, logN: 0, state: undefined }; let E = [], V = [], total = 1;
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
    const d = design(), own = profilesOf(d), every = [...own, ...missionsOf(d).filter((m) => !own.some((p) => p.id === m.id))];
    st.id = every.find((p) => p.id === id) ? id : every.find((p) => p.id === chosen(d)) ? chosen(d) : every[0] ? every[0].id : null;
    const cur = every.find((p) => p.id === st.id), all = cur && !own.includes(cur) ? [...own, cur] : own, evs = cur ? cur.events : profileOf(d, st.id);      // the switch : the bench's own, and a mission of the campaign when one is played
    if (id && st.id === id) { try { localStorage.setItem(PKEY(d), id); } catch (e) { /* the choice holds until the page is left */ } }
    /* a module on the bench (design.plant) : an hour of physics is not played in advance — what the software answers is gathered as it happens */
    st.live = !!(d && d.plant); if (st.live) { E = expandProfile(evs).map((e) => ({ ...e, answers: [] })); total = (E.length ? E[E.length - 1].t : 0) + 1000; }
    else { const plan = playProfile(d, evs); E = plan.events; total = plan.duration; } V = E.map((e, k) => (e.hidden ? -1 : k)).filter((k) => k >= 0);
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
  function apply() { const t = bench.L ? bench.L.t : 0; let changed = false; while (st.at + 1 < E.length && E[st.at + 1].t <= t) { st.at++; const e = E[st.at]; if (e.plant && bench.drive) { bench.drive(e.plant); changed = true; } for (const [id, v] of Object.entries(e.set || {})) { bench.set(id, v); changed = true; } } if (changed && onSet) onSet(); gather(); }
  /* LIVE answers (a module on the bench) : each 0 / 1 output that changed, and the state of the module, told with the last event one sees */
  function gather() { if (!st.live || !bench.L) return; const L = bench.L, d = design(), k = vis(), e = E[k], ref = d && d.plant && d.plant.state;
    const first = (L.nlog || 0) - L.log.length; if (st.logN < first) st.logN = first;
    for (; st.logN < (L.nlog || 0); st.logN++) { const g = L.log[st.logN - first]; if (!g) continue; if (!e || g.t < e.t) continue; const { o } = { o: (d.objects || []).find((x) => g.ref.startsWith(`${x.id}.`)) }; if (o && (o.kind === "state_lamp" || o.device === "led") && !g.to) continue;
      if (o && (o.kind === "limit" || o.kind === "logic") && e.answers.length > 12) continue; e.answers.push({ t: g.t, after: g.t - e.t, ref: g.ref, to: g.to, text: sayOutput(d, g.ref, g.to), when: fr(g.t - e.t) }); }
    const now = ref ? L.m.last[ref] : undefined; if (ref && now !== st.state) { if (e && st.state !== undefined) e.answers.push({ t: L.t, after: L.t - e.t, ref, to: now, text: `État du module : ${STATE_NAMES[now] || now}`, when: fr(L.t - e.t) }); st.state = now; } }
  /* runs the bench up to the time `until`, the events met on the way applied : one call per event */
  function runTo(until) { const dt = bench.L.m.dt; while (bench.L.t < until && !st.halt) { apply(); const n = E[st.at + 1] ? Math.min(E[st.at + 1].t, until) : until; let m = Math.max(1, Math.ceil((n - bench.L.t) / dt)); while (m > 0 && !st.halt) { const q = st.live ? Math.min(m, 500) : m; bench.step(q); m -= q; gather(); } } apply(); }
  function marksOn() { const v = vis(); for (const m of marks.children) m.classList.toggle("on", !!E[v] && m.dataset.sws === E[v].id); cursor.style.left = `${Math.min(100, (100 * (bench.L ? bench.L.t : 0)) / total)}%`; }
  const say = () => { const n = V.indexOf(vis()), left = V.length - 1 - n; nextB.lastChild.textContent = left > 0 ? `Suivant (${n + 2} / ${V.length})` : "Recommencer pas à pas"; if (left > 0) delete nextB.dataset.done; else nextB.dataset.done = ""; };
  /* ONE event one sees : applied, then the time runs until all it causes has happened (its answers, then 0.3 s), never past the next one */
  function next() {
    if (!st.manual || V.indexOf(vis()) >= V.length - 1) { bench.reset(); bench.pause(); st.on = false; st.manual = true; st.at = -1; fresh(); } else bench.pause();
    const k = V[V.indexOf(vis()) + 1], e = E[k], nk = V[V.indexOf(k) + 1], dt = bench.L.m.dt, after = st.live ? (nk !== undefined ? E[nk].t - dt : total) : Math.max(e.t, ...e.answers.map((a) => a.t)) + 300;
    runTo(Math.max(e.t, nk !== undefined ? Math.min(after, E[nk].t - dt) : Math.min(after, total))); if (onSet) onSet(); show(vis()); marksOn(); say();
  }
  function play(upTo = 0) {
    st.manual = false; nextB.lastChild.textContent = "Suivant"; delete nextB.dataset.done;
    bench.reset(); bench.pause(); st.on = true; st.at = -1; fresh(); st.until = upTo > 0 ? E[upTo].t : null;
    if (st.until) runTo(st.until); else apply();      // up to the event chosen, a few calls : one per event
    if (bench.setSpeed) bench.setSpeed(st.live ? Math.max(100, bench.speed || 100) : 1); bench.play(); tick();
  }
  function tick() {
    const t = bench.L ? bench.L.t : 0; cursor.style.left = `${Math.min(100, (100 * t) / total)}%`; if (!st.on) return;
    const was = vis(); apply(); const v = vis(); if (v >= 0) show(v); if (v !== was) marksOn();
    if (t >= total) { st.on = false; bench.pause(); }
  }
  /* the bench runs n steps : split at the time of each event of the profile, so that each is applied on time (sw_bench setAdvance) */
  function advance(n) { const L = bench.L, dt = L.m.dt, end = L.t + n * dt; if (st.halt) return L; if (!st.on && !st.manual) { liveStep(L, n); return L; }
    while (L.t < end) { apply(); const nx = E[st.at + 1] ? Math.min(E[st.at + 1].t, end) : end; let k = Math.max(1, Math.ceil((nx - L.t) / dt));
      while (k > 0) { const q = st.live ? Math.min(k, 100) : k; liveStep(L, q); k -= q; if (st.live && halted()) { apply(); return L; } } } apply(); return L; }
  /* A LIMIT MET (JP, 26 novembre 2026 : « when we meet a limit, user must restart the profile by clicking on "continue" if fault is manageable ») :
     the module goes to URGENCE or ARRÊT — the profile stops there and says why ; « Continuer » acknowledges the fault when its cause is gone, then
     the profile runs on (when the cause is still there, it runs on so that the time can clear it, and the profile's own acknowledgement comes) */
  function halted() { const L = bench.L, d = design(), ref = d && d.plant && d.plant.state; if (!ref) return false; const now = L.m.last[ref] || 0;
    if (now >= 2 && (st.lastRed || 0) < 2) { st.lastRed = now; const conds = new Set(monitorOf(d).rows.map((r) => r.id)), lims = packLimits(d).filter((l) => conds.has(l.id)), on = lims.filter((l) => L.m.last[`${l.id}.trip`]).map((l) => l.name), lost = d.plant.lost && L.set[d.plant.lost] ? ["la chaîne des cartes se tait"] : [];
      st.halt = { t: L.t, state: now, why: [...on, ...lost], event: E[vis()] ? E[vis()].title : "" }; bench.pause(); if (onHalt) onHalt(st.halt); return true; }
    st.lastRed = now; return false; }
  /** Continues after a limit : the fault acknowledged when nothing trips any more (a press of the button, 0,3 s), then the profile runs on. */
  function cont() { const L = bench.L, d = design(); if (!st.halt || !L) return; const ack = d.plant && d.plant.ack, trips = packLimits(d).some((l) => L.m.last[`${l.id}.trip`]), clear = !trips && !(d.plant.lost && L.set[d.plant.lost]);
    st.halt = null; if (ack && clear) { liveSet(L, ack, 1); liveStep(L, 30); liveSet(L, ack, 0); st.lastRed = L.m.last[d.plant.state] || 0; }
    if (onHalt) onHalt(null); bench.play(); }
  const canClear = () => { const L = bench.L, d = design(); return !!(L && d && d.plant && !packLimits(d).some((l) => L.m.last[`${l.id}.trip`]) && !(d.plant.lost && L.set[d.plant.lost])); };
  if (bench.setAdvance) bench.setAdvance(advance);
  /* a run starts : the answers gathered live are forgotten */
  function fresh() { st.logN = 0; st.state = undefined; st.halt = null; st.lastRed = 0; if (onHalt) onHalt(null); if (st.live) for (const e of E) e.answers = []; }
  load(null);
  return { get live() { return st.live; }, get playing() { return st.on; }, get halt() { return st.halt; }, get events() { return E; }, get total() { return total; }, get profileId() { return st.id; }, cont, canClear, load, line, bubble, tick, play, next, dispose() { st.on = false; if (bench.setAdvance) bench.setAdvance(null); } };
}
