/* DynamiteOrbit.ai — Logiciel, step 3 of the lean path : the MISSIONS the campaign plays, WRITTEN FROM THE REQUIREMENTS (JP, 27 novembre 2026 :
   « toutes les missions de l'équipement » ; « les missions viennent des requis » ; puis : « qu'elles puissent être déplacées et réordonnées…
   classées de fonctionnelle vers performance puis par safety / corner case / malfunction… voir les tags des requis dans le graph temporel du profil
   de mission… disable / enable… un niveau de difficulté — une priorité de conception, du plus facile au plus difficile »).
   Grouped by CLASS in JP's order — Functional, Performance, Safety, Corner cases, Malfunction, then the holdout set — each its colour and
   pictogram ; each mission a card : a grip to drag it (inside its class, or onto another class ; the keyboard : ↑ ↓ on the grip — Alt + ↑ ↓ stays
   the stairs of the platform), On / Off
   (Off : kept, never played), its difficulty from 1 to 5 (a proposal of the tool is dashed and blinks until a person sets it), the requirements
   it aims at, and its PROFILE GRAPH with their limits dashed and tagged (modules/sw_mission_graph.js). Each change is one undoable step on the
   software's plan (sw/sw_mission_plan.js) ; the campaign plays the missions that are On, in this order. Route : #/swmis.
   What it follows : a test plan's suites ordered by technique ; a reorderable list (the HTML drag and drop, a grip that moves with the arrow
   keys, as the handle of a slider) ; the On / Off switch of the platform ; a priority per test case. */

import { el, icon, btn, clear, onOff } from "../core/dom.js";
import { registerModule, setGuide, go } from "../core/app.js";
import { store } from "../core/store.js";
import { leanOf } from "../sw/sw_lean.js";
import { plantOf, packStart } from "../sw/sw_pack.js";
import { ORIGINS, GAPS, missionGaps, projectProfiles, missionSeconds } from "../sw/sw_req_missions.js";
import { CLASSES, LEVELS, classOf, moveMission, nudgeMission, setOff, setLevel, confirmLevels, sortByLevel } from "../sw/sw_mission_plan.js";
import { oracleText } from "../core/req_oracle.js";
import { swShell } from "./sw_vband.js";
import { leanHead, leanDesign, lastCampaign, missionsOf } from "./sw_lean_ui.js";
import { missionGraph } from "./sw_mission_graph.js";

const KIND = { charge: { fr: "Charge", icon: "power" }, discharge: { fr: "Décharge", icon: "bolt" } }, OTHER = { fr: "Mission", icon: "flow" };
const VCOL = { pass: "#16a34a", fail: "#dc2626", covered: "#0891b2" }, VFR = { pass: "tenues", fail: "échouées", covered: "enveloppe atteinte" };
const mins = (s) => (s >= 120 ? `${Math.round(s / 60)} min` : `${s} s`);

function render(main) {
  const { page, head, left, view, right } = swShell(main, "swmi2-view");
  let drag = null, focusId = null;
  const play = (d, p) => { try { localStorage.setItem(`dw.sw.profile.${d.id || "sw"}`, p.id); } catch (e) { /* the bench opens on its first mission */ } go("#/swsim"); };
  /* one undoable step on the plan of the software */
  const change = (d, label, fn) => store.commit(`Missions : ${label}`, (p) => { const x = (p.software || []).find((s) => s.id === d.id); if (x) x.missionPlan = fn(x.missionPlan || {}); });
  const copyToBank = (d, m) => store.commit(`Missions : « ${m.name} » copiée dans la banque (Off)`, (p) => { const x = (p.software || []).find((s) => s.id === d.id); if (!x) return; let id = `${m.id}-copie`, k = 2; while ((x.profiles || []).some((q) => q.id === id)) id = `${m.id}-copie${k++}`;
    x.profiles = [...(x.profiles || []), { id, name: `${m.name} (copie)`, kind: m.kind, keys: m.keys || [], events: JSON.parse(JSON.stringify(m.events)) }]; x.missionPlan = setOff(x.missionPlan || {}, id, true); });
  function levelPick(d, m) {
    return el("span", { class: `swm2-level${m.levelSure ? "" : " guess"}`, role: "radiogroup", "aria-label": `Difficulté de « ${m.name} »`, "data-sw-level": String(m.level) },
      el("small", null, "Difficulté "), LEVELS.map((L) => el("button", { type: "button", role: "radio", "aria-checked": m.level === L.n ? "true" : "false", class: m.level === L.n ? "on" : "", style: `--l:${L.color}`, "data-tip": `${L.n} — ${L.fr}${m.level === L.n && !m.levelSure ? " (proposé par l'outil : un clic le confirme)" : ""}`,
        onClick: () => change(d, `difficulté de « ${m.name} » : ${L.n} (${L.fr})`, (P) => setLevel(P, m.id, L.n)) }, String(L.n))));
  }
  function card(d, m, all, C, R, C1, amb) {
    const O = ORIGINS[m.origin] || ORIGINS.project, K = KIND[m.kind] || OTHER, Cl = classOf(m.cls), by = C ? C.rows.map((r) => r.by[m.id]).filter((v) => v && v !== "none") : [], n = (v) => by.filter((x) => x === v).length;
    const grip = el("button", { type: "button", class: "swm2-grip icon-btn", "aria-label": `Déplacer « ${m.name} » (glisser, ou ↑ ↓ sur la poignée)`, "data-tip": "Glisser pour déplacer — dans sa classe ou sur une autre ; au clavier : ↑ ↓ sur la poignée (Alt + ↑ ↓ reste la marche d'escalier)", "data-grip": m.id,
      onPointerDown: () => { art.draggable = true; }, onKeyDown: (e) => { if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); e.stopPropagation(); focusId = m.id; change(d, `« ${m.name} » déplacée`, (P) => nudgeMission(P, all, m.id, e.key === "ArrowUp" ? -1 : 1)); } } }, icon("drag"));
    const art = el("article", { class: `swm2-card${m.off ? " off" : ""}`, style: `--g:${Cl.color}`, "data-sw-mission": m.id, "data-origin": m.origin, "data-cls": m.cls },
      el("header", null, grip, icon(K.icon), el("b", null, m.name), el("span", { class: "chip small", style: `--g:${O.color}`, "data-tip": O.says }, O.fr), el("small", null, ` ${mins(missionSeconds(m))}`), el("span", { class: "grow" }),
        onOff(!m.off, (on) => change(d, `« ${m.name} » ${on ? "On" : "Off"}`, (P) => setOff(P, m.id, !on)), `La mission « ${m.name} »`, m.off ? "Off : gardée, la campagne ne la joue pas — cliquer pour la remettre" : "On : la campagne la joue — cliquer pour la mettre de côté"),
        btn("Jouer sur le banc", () => play(d, m), { small: true, primary: true, icon: "play", tip: "Ouvrir le banc HIL sur cette mission" })),
      el("div", { class: "swm2-meta" }, levelPick(d, m),
        m.cls === "reserve" ? null : el("label", { class: "small swm2-cls" }, "Classe ", el("select", { "aria-label": `Classe de « ${m.name} »`, "data-sw-cls": m.id, onChange: (e) => { focusId = m.id; change(d, `« ${m.name} » vers ${classOf(e.target.value).fr}`, (P) => moveMission(P, all, m.id, e.target.value, null)); } },
          CLASSES.filter((c) => c.key !== "reserve").map((c) => el("option", { value: c.key, selected: c.key === m.cls ? "" : null }, c.fr)))),      // the keyboard's way to another class (the grip's arrows stay inside it)
        (m.keys || []).length ? el("span", { class: "small swm2-keys" }, "Vise : ", ...m.keys.map((k) => el("a", { class: "swm2-key", href: "#/lreq", "data-tip": "La liste des exigences" }, k))) : null,
        m.origin === "reserve" ? null : btn("Copier", () => copyToBank(d, m), { small: true, icon: "copy", tip: "Une copie dans la banque du banc, née Off : à changer par son .txt" })),
      missionGraph(m, R, C, C1, amb),
      m.origin === "reserve" ? el("p", { class: "small muted" }, icon("lock"), " Jamais montrée à une IA : la boucle la rejoue sans la donner.") : null,
      C && !m.off ? (by.length ? el("p", { class: "small swm2-proof" }, ["fail", "pass", "covered"].filter((v) => n(v)).map((v) => el("span", { style: `--v:${VCOL[v]}` }, `${n(v)} ${VFR[v]}`))) : el("p", { class: "small muted" }, "Aucune limite ne s'y joue.")) : null);
    art.addEventListener("dragstart", (e) => { drag = m.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", m.id); } catch (x) { /* some browsers refuse it : `drag` holds the id */ } art.classList.add("dragging"); });
    art.addEventListener("dragend", () => { art.draggable = false; art.classList.remove("dragging"); drag = null; view.querySelectorAll(".drop-before, .drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after")); });
    art.addEventListener("dragover", (e) => { if (!drag || drag === m.id) return; e.preventDefault(); const r = art.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2; art.classList.toggle("drop-after", after); art.classList.toggle("drop-before", !after); });
    art.addEventListener("dragleave", () => art.classList.remove("drop-before", "drop-after"));
    art.addEventListener("drop", (e) => { if (!drag || drag === m.id) return; e.preventDefault(); e.stopPropagation(); const r = art.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2, same = all.filter((x) => x.cls === m.cls), k = same.indexOf(m);
      const before = after ? (same[k + 1] ? same[k + 1].id : null) : m.id, id = drag, mv = all.find((x) => x.id === id); focusId = id;
      change(d, `« ${mv ? mv.name : id} » déplacée${mv && mv.cls !== m.cls ? ` vers ${classOf(m.cls).fr}` : ""}`, (P) => moveMission(P, all, id, m.cls, before || null)); });
    return art;
  }
  function draw() {
    const d = leanDesign(); head.replaceChildren(leanHead("missions", d));
    if (!d) { page.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Les missions"), el("p", null, "Le projet n'a pas encore de logiciel."))); setGuide([]); return; }
    const M = missionsOf(d), C = lastCampaign(d), L = leanOf("missions"), R = store.project && store.project.reqs, gaps = plantOf(d) ? missionGaps(store.project) : [], bench = projectProfiles(d).bench;
    const S = plantOf(d) ? packStart(d).S : { capAh: 36, amb: 25 }, guess = M.filter((m) => !m.levelSure), on = M.filter((m) => !m.off);
    const groups = CLASSES.map((Cl) => ({ Cl, list: M.filter((m) => m.cls === Cl.key) })).filter((g) => g.list.length);
    clear(left); left.append(el("div", { class: "side-head" }, el("h2", null, "Missions")),
      el("div", { class: "side-actions" }, btn("Ranger par difficulté", () => change(d, "chaque classe rangée du plus facile au plus difficile", (P) => sortByLevel(P, M)), { small: true, icon: "flow", tip: "Dans chaque classe, du plus facile au plus difficile : l'ordre dans lequel la conception les prend" }),
        guess.length ? (() => { const b = btn(`Confirmer ${guess.length} difficulté${guess.length > 1 ? "s" : ""}`, () => change(d, `${guess.length} difficultés confirmées`, (P) => confirmLevels(P, M)), { small: true, icon: "check", tip: "Les difficultés proposées par l'outil, prises telles quelles" }); b.dataset.swLevelsConfirm = ""; return b; })() : null),
      el("div", { class: "side-scroll" },
        el("div", { class: "side-section", "data-fold-note": `${on.length} sur ${M.length}` }, el("h3", null, "Ce que l'écran montre"), el("p", { class: "small" }, L.says),
          el("p", { class: "small" }, "Écrites à partir des exigences, jamais à partir du logiciel. Glissez une mission par sa poignée pour la ranger, dans sa classe ou dans une autre ; Off la garde sans la jouer ; la difficulté dit l'ordre dans lequel la conception les prend. Sur chaque graphe, en pointillé : les limites des exigences visées, taguées de leur clé.")),
        el("div", { class: "side-section", "data-fold-note": `${groups.length} classes` }, el("h3", null, "Les classes"),
          groups.map((g) => el("p", { class: "swm2-sort small", style: `--g:${g.Cl.color}` }, icon(g.Cl.icon), el("b", null, ` ${g.Cl.fr}`), el("small", null, ` ${g.list.filter((m) => !m.off).length} / ${g.list.length}`)))),
        el("div", { class: "side-section", "data-fold-note": "1 à 5" }, el("h3", null, "La difficulté"), LEVELS.map((x) => el("p", { class: "swm2-sort small", style: `--g:${x.color}` }, el("b", null, `${x.n}`), ` ${x.fr}`)),
          el("p", { class: "small muted" }, "En pointillé et qui clignote : proposée par l'outil d'après la classe, à confirmer.")),
        el("div", { class: "side-section" }, el("h3", null, "Le banc"), el("p", { class: "small" }, "La banque de profils (import et export .txt) est sur le banc."), btn("Ouvrir le banc HIL", () => go("#/swsim"), { small: true, icon: "play" }))));
    view.replaceChildren(el("div", { class: "swm2-list", "data-sw-missions": String(M.length) }, groups.length ? groups.map((g) => {
      const sec = el("section", { class: "swm2-group", style: `--g:${g.Cl.color}`, "data-sw-mission-group": g.Cl.key },
        el("h3", null, icon(g.Cl.icon), ` ${g.Cl.fr}`, el("small", null, ` ${g.list.filter((m) => !m.off).length} / ${g.list.length} — ${g.Cl.says}`)), g.list.map((m) => card(d, m, M, C, R, S.capAh, S.amb)));
      /* dropped on the class, not on a card : at the end of the class (the holdout set takes no other mission) */
      sec.addEventListener("dragover", (e) => { if (drag && (g.Cl.key !== "reserve" || (M.find((x) => x.id === drag) || {}).cls === "reserve")) e.preventDefault(); });
      sec.addEventListener("drop", (e) => { if (!drag) return; e.preventDefault(); const id = drag, mv = M.find((x) => x.id === id); focusId = id; change(d, `« ${mv ? mv.name : id} » déplacée vers ${g.Cl.fr}`, (P) => moveMission(P, M, id, g.Cl.key, null)); });
      return sec; }) : el("p", { class: "muted" }, "Aucune mission : le logiciel n'a pas de module simulé sur son banc.")));
    if (focusId) { const gr = view.querySelector(`[data-grip="${CSS.escape(focusId)}"]`); if (gr) { gr.focus(); gr.scrollIntoView({ block: "nearest" }); } focusId = null; }
    clear(right); const unc = C ? C.rows.filter((r) => r.overall === "uncovered") : [];
    /* where to start : what fails, on the easiest mission first */
    const lvl = (id) => (M.find((m) => m.id === id) || { level: 9 }).level, start = C ? C.rows.filter((r) => r.overall === "fail").map((r) => ({ r, at: Object.entries(r.by).filter(([, v]) => v === "fail").map(([id]) => id).sort((a, b) => lvl(a) - lvl(b))[0] })).filter((x) => x.at).sort((a, b) => lvl(a.at) - lvl(b.at)) : [];
    right.append(el("div", { class: "side-head" }, el("h2", null, "Ce qui reste")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": C ? `${start.length}` : "—", "data-sw-start": String(start.length) }, el("h3", null, "Par où commencer"), !C ? el("p", { class: "small muted" }, "Après la campagne (Constats) : ce qui échoue, la mission la plus facile d'abord.")
        : start.length ? start.map((x) => { const m = M.find((q) => q.id === x.at), Lv = LEVELS[(m ? m.level : 3) - 1]; return el("p", { class: "small swm2-start", style: `--l:${Lv.color}` }, el("b", null, String(Lv.n)), ` ${x.r.key} — ${x.r.text} — échoue sur « ${m ? m.name : x.at} »`); }) : el("p", { class: "small muted" }, "Rien n'échoue.")),
      el("div", { class: "side-section", "data-fold-note": `${gaps.length}`, "data-sw-mission-gaps": String(gaps.length) }, el("h3", null, "Limites sans mission"), gaps.length ? gaps.map((x) => el("p", { class: "small" }, icon("warning"), ` ${x.key} — ${oracleText(x.o)} : le banc ne sait pas la faire varier.`)) : el("p", { class: "small muted" }, "Chaque limite lue par la machine a sa mission.")),
      el("div", { class: "side-section", "data-fold-note": C ? `${unc.length}` : "—" }, el("h3", null, "Enveloppe des exigences"), !C ? el("p", { class: "small muted" }, "Connue après la campagne (Constats).") : unc.length ? unc.map((r) => el("p", { class: "small" }, icon("warning"), ` ${r.key} — ${r.text}`)) : el("p", { class: "small muted" }, "Toute l'enveloppe est atteinte.")),
      bench.length ? el("div", { class: "side-section", "data-fold-note": `${bench.length}` }, el("h3", null, "Restent sur le banc"), el("p", { class: "small" }, `${bench.map((p) => `« ${p.name} »`).join(", ")} : écrits par l'outil à partir des seuils du logiciel. Ils restent sur le banc pour essayer à la main ; la campagne ne les joue pas — une mesure tirée du logiciel jugerait le logiciel contre lui-même.`)) : null,
      el("div", { class: "side-section", "data-fold-note": `${GAPS.length}` }, el("h3", null, "Ce que les missions ne font pas"), el("ul", { class: "small" }, GAPS.map((t) => el("li", null, t))))));
    setGuide([...(guess.length ? [{ level: "check", text: `${guess.length} difficulté${guess.length > 1 ? "s" : ""} proposée${guess.length > 1 ? "s" : ""} par l'outil : à confirmer ou à changer.` }] : []),
      ...gaps.map((x) => ({ level: "tip", text: `${x.key} : ${oracleText(x.o)} — aucune mission ne peut la faire varier.` })), ...unc.map((r) => ({ level: "tip", text: `${r.key} : ${r.text} — aucune mission ne l'atteint.` }))]);
  }
  const off = store.on("change", () => draw()); draw();
  return () => { off(); setGuide([]); };
}
registerModule({ key: "swmis", label: "Missions", icon: "flow", tip: "3. Les missions que la campagne joue, écrites à partir des exigences : classées, ordonnées, On / Off, leur difficulté", render });
