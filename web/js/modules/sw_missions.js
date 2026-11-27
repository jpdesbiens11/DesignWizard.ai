/* DynamiteOrbit.ai — Logiciel, step 3 of the lean path : the MISSIONS the campaign plays, WRITTEN FROM THE REQUIREMENTS (JP, 27 novembre 2026 :
   « toutes les missions de l'équipement — les variations in / out que le logiciel doit tenir dans les bornes des requis » ; choix par menu :
   « les missions viennent des requis »). Grouped by what they are — nominal, the limits of the requirements (each approached, crossed and held,
   then brought back), the envelope, corner cases, injected faults, the project's own duty cycles, the holdout set — each group its colour and
   pictogram, each mission a card : its name, the requirements it aims at, its events on a strip of time (the crossings in red), and once the
   campaign is played, what it proved. « Jouer sur le banc » opens the HIL bench on it. Beside them : the limits no mission can move, the duty
   cycles the tool wrote from the software's thresholds (they stay on the bench), what the missions do not do. Written by sw/sw_req_missions.js ;
   nothing is typed here. Route : #/swmis. What it follows : a test campaign's list of test cases, grouped by technique. */

import { el, svg, icon, btn, clear } from "../core/dom.js";
import { registerModule, setGuide, go } from "../core/app.js";
import { store } from "../core/store.js";
import { leanOf } from "../sw/sw_lean.js";
import { plantOf } from "../sw/sw_pack.js";
import { ORIGINS, GAPS, missionGaps, projectProfiles, missionSeconds } from "../sw/sw_req_missions.js";
import { oracleText } from "../core/req_oracle.js";
import { swShell } from "./sw_vband.js";
import { leanHead, leanDesign, lastCampaign, missionsOf } from "./sw_lean_ui.js";

const KIND = { charge: { fr: "Charge", icon: "power" }, discharge: { fr: "Décharge", icon: "bolt" } }, OTHER = { fr: "Mission", icon: "flow" };
const VCOL = { pass: "#16a34a", fail: "#dc2626", none: "#94a3b8", covered: "#0891b2" }, VFR = { pass: "tenues", fail: "échouées", covered: "enveloppe atteinte", none: "non exercées" };
const mins = (s) => (s >= 120 ? `${Math.round(s / 60)} min` : `${s} s`);

function render(main) {
  const { page, head, left, view, right } = swShell(main, "swmi2-view");
  const play = (d, p) => { try { localStorage.setItem(`dw.sw.profile.${d.id || "sw"}`, p.id); } catch (e) { /* the bench opens on its first mission */ } go("#/swsim"); };
  function strip(p) {
    const E = (p.events || []).filter((e) => !e.hidden), end = Math.max(1, missionSeconds(p) * 1000), W = 520, X = (t) => 8 + (t / end) * (W - 16);
    return svg("svg", { class: "swm2-strip", viewBox: `0 0 ${W} 30`, role: "img", "aria-label": `${E.length} événements sur ${mins(missionSeconds(p))}` },
      svg("line", { x1: 8, y1: 15, x2: W - 8, y2: 15, class: "swm2-axis" }),
      ...E.map((e) => svg("circle", { cx: X(e.t), cy: 15, r: e.cross ? 5 : 3, class: e.cross ? "swm2-ev hit" : "swm2-ev" }, svg("title", null, `${mins(Math.round(e.t / 1000))} — ${e.title}`))));
  }
  function card(d, p, C) {
    const O = ORIGINS[p.origin] || ORIGINS.project, K = KIND[p.kind] || OTHER, by = C ? C.rows.map((r) => r.by[p.id]).filter((v) => v && v !== "none") : [], n = (v) => by.filter((x) => x === v).length;
    return el("article", { class: "swm2-card", style: `--g:${O.color}`, "data-sw-mission": p.id, "data-origin": p.origin },
      el("header", null, icon(K.icon), el("b", null, p.name), el("span", { class: "chip small" }, K.fr), el("small", null, ` ${mins(missionSeconds(p))} · ${(p.events || []).filter((e) => !e.hidden).length} événements`), el("span", { class: "grow" }),
        btn("Jouer sur le banc", () => play(d, p), { small: true, primary: true, icon: "play", tip: "Ouvrir le banc HIL sur cette mission" })),
      strip(p),
      (p.keys || []).length ? el("p", { class: "small swm2-keys" }, "Vise : ", ...p.keys.map((k) => el("a", { class: "swm2-key", href: "#/lreq", "data-tip": "La liste des exigences" }, k))) : null,
      p.origin === "reserve" ? el("p", { class: "small muted" }, icon("lock"), " Jamais montrée à une IA : la boucle la rejoue sans la donner.") : null,
      C ? (by.length ? el("p", { class: "small swm2-proof" }, ["fail", "pass", "covered"].filter((v) => n(v)).map((v) => el("span", { style: `--v:${VCOL[v]}` }, `${n(v)} ${VFR[v]}`))) : el("p", { class: "small muted" }, "Aucune limite ne s'y joue."))
        : null);
  }
  function draw() {
    const d = leanDesign(); head.replaceChildren(leanHead("missions", d));
    if (!d) { page.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Les missions"), el("p", null, "Le projet n'a pas encore de logiciel."))); setGuide([]); return; }
    const M = missionsOf(d), C = lastCampaign(d), L = leanOf("missions"), gaps = plantOf(d) ? missionGaps(store.project) : [], bench = projectProfiles(d).bench;
    const groups = Object.entries(ORIGINS).map(([k, O]) => ({ k, O, list: M.filter((p) => (p.origin || "project") === k) })).filter((g) => g.list.length);
    clear(left); left.append(el("div", { class: "side-head" }, el("h2", null, "Missions")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": `${M.length}` }, el("h3", null, "Ce que l'écran montre"), el("p", { class: "small" }, L.says),
        el("p", { class: "small" }, "Les missions sont écrites à partir des exigences, jamais à partir du logiciel : chaque limite lue par la machine est approchée, franchie et tenue, puis revenue. Une tension se tient par le cell emulator du banc, une température par une chaleur du dehors, un courant par la charge ou le chargeur.")),
      el("div", { class: "side-section", "data-fold-note": `${groups.length} sortes` }, el("h3", null, "Les sortes"),
        groups.map((g) => el("p", { class: "swm2-sort small", style: `--g:${g.O.color}` }, icon(g.O.icon), el("b", null, ` ${g.O.fr}`), el("small", null, ` ${g.list.length} · ${g.O.en}`)))),
      el("div", { class: "side-section" }, el("h3", null, "Le banc"), el("p", { class: "small" }, "La banque de profils (import et export .txt) est sur le banc."), btn("Ouvrir le banc HIL", () => go("#/swsim"), { small: true, icon: "play" }))));
    view.replaceChildren(el("div", { class: "swm2-list", "data-sw-missions": String(M.length) }, groups.length ? groups.map((g) => el("section", { class: "swm2-group", style: `--g:${g.O.color}`, "data-sw-mission-group": g.k },
      el("h3", null, icon(g.O.icon), ` ${g.O.fr}`, el("small", null, ` ${g.list.length} — ${g.O.says}`)), g.list.map((p) => card(d, p, C))))
      : el("p", { class: "muted" }, "Aucune mission : le logiciel n'a pas de module simulé sur son banc.")));
    clear(right); const unc = C ? C.rows.filter((r) => r.overall === "uncovered") : [];
    right.append(el("div", { class: "side-head" }, el("h2", null, "Ce qui reste")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": `${gaps.length}`, "data-sw-mission-gaps": String(gaps.length) }, el("h3", null, "Limites sans mission"), gaps.length ? gaps.map((x) => el("p", { class: "small" }, icon("warning"), ` ${x.key} — ${oracleText(x.o)} : le banc ne sait pas la faire varier.`)) : el("p", { class: "small muted" }, "Chaque limite lue par la machine a sa mission.")),
      el("div", { class: "side-section", "data-fold-note": C ? `${unc.length}` : "—" }, el("h3", null, "Enveloppe des exigences"), !C ? el("p", { class: "small muted" }, "Connue après la campagne (Constats).") : unc.length ? unc.map((r) => el("p", { class: "small" }, icon("warning"), ` ${r.key} — ${r.text}`)) : el("p", { class: "small muted" }, "Toute l'enveloppe est atteinte.")),
      bench.length ? el("div", { class: "side-section", "data-fold-note": `${bench.length}` }, el("h3", null, "Restent sur le banc"), el("p", { class: "small" }, `${bench.map((p) => `« ${p.name} »`).join(", ")} : écrits par l'outil à partir des seuils du logiciel. Ils restent sur le banc pour essayer à la main ; la campagne ne les joue pas — une mesure tirée du logiciel jugerait le logiciel contre lui-même.`)) : null,
      el("div", { class: "side-section", "data-fold-note": `${GAPS.length}` }, el("h3", null, "Ce que les missions ne font pas"), el("ul", { class: "small" }, GAPS.map((t) => el("li", null, t))))));
    setGuide([...gaps.map((x) => ({ level: "tip", text: `${x.key} : ${oracleText(x.o)} — aucune mission ne peut la faire varier.` })), ...unc.map((r) => ({ level: "tip", text: `${r.key} : ${r.text} — aucune mission ne l'atteint.` }))]);
  }
  const off = store.on("change", () => draw()); draw();
  return () => { off(); setGuide([]); };
}
registerModule({ key: "swmis", label: "Missions", icon: "flow", tip: "3. Les missions que la campagne joue, écrites à partir des exigences : chaque limite approchée, franchie, revenue", render });
