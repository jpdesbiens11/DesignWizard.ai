/* DynamiteOrbit.ai — Logiciel, step 3 of the lean path : the MISSION PROFILES the bench plays (JP, 27 novembre 2026 : « une panoplie de profils
   différents qui couvre tout ce qui est généralement découpé en sous-étapes… »). One card per mission : what it does to the product (its kind,
   its length, its events on a strip of time), the limits of the software it crosses on purpose, and — once the campaign is played — what it
   proved of the requirements. Beside them : the limits no mission crosses, the envelope of the requirements no mission reaches. « Jouer sur le
   banc » opens the bench on that mission. The missions are written today from the thresholds of the software (sw/sw_pack.js) ; the next phase
   writes them from the requirements, and the screen says so. Route : #/swmis. What it follows : a test campaign's list of scenarios. */

import { el, svg, icon, btn, clear } from "../core/dom.js";
import { registerModule, setGuide, go } from "../core/app.js";
import { store } from "../core/store.js";
import { leanOf } from "../sw/sw_lean.js";
import { profilesOf, expandProfile } from "../sw/sw_story.js";
import { packLimits, coverage, plantOf } from "../sw/sw_pack.js";
import { swShell } from "./sw_vband.js";
import { leanHead, leanDesign, lastCampaign } from "./sw_lean_ui.js";

const KIND = { charge: { fr: "Charge", color: "#16a34a", icon: "power" }, discharge: { fr: "Décharge", color: "#dc2626", icon: "bolt" } }, OTHER = { fr: "Mission", color: "#7c3aed", icon: "flow" };
const VCOL = { pass: "#16a34a", fail: "#dc2626", none: "#94a3b8", uncovered: "#d97706", covered: "#0891b2" };
const mins = (ms) => `${Math.round(ms / 60000)} min`;

function render(main) {
  const { page, head, left, view, right } = swShell(main, "swmi2-view");
  const play = (d, p) => { try { localStorage.setItem(`dw.sw.profile.${d.id || "sw"}`, p.id); } catch (e) { /* the bench opens on its first mission */ } go("#/swsim"); };
  function strip(p, names) {
    const E = (p.events || []), end = Math.max(1, E.length ? E[E.length - 1].t : 1), W = 520, X = (t) => 8 + (t / end) * (W - 16);
    return svg("svg", { class: "swm2-strip", viewBox: `0 0 ${W} 30`, role: "img", "aria-label": `${E.length} événements sur ${mins(end)}` },
      svg("line", { x1: 8, y1: 15, x2: W - 8, y2: 15, class: "swm2-axis" }),
      ...E.map((e) => svg("circle", { cx: X(e.t), cy: 15, r: e.target ? 5 : 3, class: e.target ? "swm2-ev hit" : "swm2-ev" }, svg("title", null, `${mins(e.t)} — ${e.title}${e.target ? ` (franchit ${[].concat(e.target).map((t) => names[t] || t).join(", ")})` : ""}`))));
  }
  function draw() {
    const d = leanDesign(); head.replaceChildren(leanHead("missions", d));
    if (!d) { page.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Les missions"), el("p", null, "Le projet n'a pas encore de logiciel."))); setGuide([]); return; }
    const P = profilesOf(d), lim = plantOf(d) ? packLimits(d) : [], names = Object.fromEntries([...(d.objects || []).map((o) => [o.id, o.name.replace(/^Banc : /, "")]), ...lim.map((l) => [l.id, l.name])]), cov = plantOf(d) ? coverage(d, P) : { left: [] }, C = lastCampaign(d), L = leanOf("missions");
    clear(left); left.append(el("div", { class: "side-head" }, el("h2", null, "Missions")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": `${P.length}` }, el("h3", null, "Ce que l'écran montre"), el("p", { class: "small" }, L.says),
        el("p", { class: "small muted" }, "Aujourd'hui, les missions sont écrites à partir des seuils du logiciel. La phase suivante les écrit à partir des exigences : nominal, chaque limite approchée, franchie et revenue, corner cases, pannes injectées.")),
      el("div", { class: "side-section" }, el("h3", null, "Les missions du projet"), el("p", { class: "small" }, "La banque de profils (import et export .txt) est sur le banc."), btn("Ouvrir le banc HIL", () => go("#/swsim"), { small: true, icon: "play" }))));
    view.replaceChildren(el("div", { class: "swm2-list", "data-sw-missions": "" }, P.length ? P.map((p) => { const K = KIND[p.kind] || OTHER, E = expandProfile(p.events).filter((e) => !e.hidden), end = E.length ? E[E.length - 1].t : 0;
      const hits = [...new Set((p.events || []).flatMap((e) => [].concat(e.target || [])))], by = C ? C.rows.map((r) => r.by[p.id]).filter(Boolean) : [], n = (v) => by.filter((x) => x === v).length;
      return el("article", { class: "swm2-card", style: `--g:${K.color}`, "data-sw-mission": p.id },
        el("header", null, icon(K.icon), el("b", null, p.name), el("span", { class: "chip small" }, K.fr), el("small", null, ` ${mins(end)} · ${E.length} événements`), el("span", { class: "grow" }),
          btn("Jouer sur le banc", () => play(d, p), { small: true, primary: true, icon: "play", tip: "Ouvrir le banc HIL sur cette mission" })),
        strip(p, names),
        el("p", { class: "small" }, hits.length ? ["Franchit : ", ...hits.map((h) => el("span", { class: "swm2-hit" }, names[h] || h))] : "Ne franchit aucune limite à dessein."),
        C ? el("p", { class: "small swm2-proof" }, ["pass", "fail", "uncovered", "none"].filter((v) => n(v)).map((v) => el("span", { style: `--v:${VCOL[v]}` }, `${n(v)} ${{ pass: "tenues", fail: "échouées", uncovered: "enveloppe non couverte", none: "non exercées" }[v]}`))) : el("p", { class: "small muted" }, "Jouez la campagne (Constats) pour voir ce que cette mission prouve.")); })
      : el("p", { class: "muted" }, "Aucune mission : le logiciel n'a pas de module simulé sur son banc.")));
    clear(right); const unc = C ? C.rows.filter((r) => r.overall === "uncovered") : [];
    right.append(el("div", { class: "side-head" }, el("h2", null, "Ce qui reste")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": `${cov.left.length}` }, el("h3", null, "Limites jamais franchies"), cov.left.length ? cov.left.map((l) => el("p", { class: "small" }, icon("warning"), ` ${l.name}`)) : el("p", { class: "small muted" }, "Chaque limite du logiciel qui lit le module est franchie par une mission.")),
      el("div", { class: "side-section", "data-fold-note": C ? `${unc.length}` : "—" }, el("h3", null, "Enveloppe des exigences"), !C ? el("p", { class: "small muted" }, "Connue après la campagne.") : unc.length ? unc.map((r) => el("p", { class: "small" }, icon("warning"), ` ${r.key} — ${r.text}`)) : el("p", { class: "small muted" }, "Toute l'enveloppe est atteinte."))));
    setGuide([...cov.left.map((l) => ({ level: "tip", text: `Aucune mission ne franchit « ${l.name} ».` })), ...unc.map((r) => ({ level: "tip", text: `${r.key} : ${r.text} — aucune mission ne l'atteint.` }))]);
  }
  const off = store.on("change", () => draw()); draw();
  return () => { off(); setGuide([]); };
}
registerModule({ key: "swmis", label: "Missions", icon: "flow", tip: "3. Les mission profiles que le banc joue : ce que chacune franchit, ce qu'elle laisse", render });
