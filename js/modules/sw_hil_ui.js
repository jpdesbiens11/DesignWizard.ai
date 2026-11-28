/* DynamiteOrbit.ai — Logiciel : « Essai sur la carte » — the software tried on its board, one step per screen (demande de JP, 24 novembre 2026 :
   « être guidé comme pour le labo électronique, même interface, à tester le logiciel embarqué étape par étape sur une carte cible HW, celle de
   la section Électronique »). THE SAME SCREEN as « Manipulation en labo » (modules/elab_manip.js) and its pieces : left, the board of the
   Électronique section with the pads the step touches ringed and their leads (modules/elab_view.js labBoard, pcba/lab_manip.js placedPoints) ;
   right, the step — the instrument drawn as one sets it (modules/elab_gear.js), what to do, why, then ONE action : « C'est fait », or the
   reading to type, in volts or amperes. The order protects the board : a step opens when the ones before it are done ; a reading out of its
   band stops the test and says what to do ; a supervisor may let it pass, by name.
   What is ticked, read and noted is kept in the notebook of the software (project.swLab[design]) — one undoable step each — and an answer of an
   assistant never writes it. The steps come from sw/sw_hil.js : nothing is decided here. */

import { el, icon, btn, badge } from "../core/dom.js";
import { store } from "../core/store.js";
import { resolveBoard } from "../pcba/model.js";
import { LIBRARY } from "../pcba/library.js";
import { placedPoints } from "../pcba/lab_manip.js";
import { labBoard } from "./elab_view.js";
import { gearPic } from "./elab_gear.js";
import { hilSteps, hilState } from "../sw/sw_hil.js";

const KIND = { safety: ["Sécurité", "#b45309"], set: ["Régler l'appareil", "#2563eb"], connect: ["Brancher sur la carte", "#7c3aed"], guard: ["Vérifier avant d'alimenter", "#b45309"], power: ["Mise sous tension", "#dc2626"], do: ["Faire", "#0d9488"], read: ["Relever", "#0891b2"], off: ["Couper", "#475569"] };
const fr = (n) => String(+(+n).toPrecision(4)).replace(".", ",");
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "");

/** Opens the test. → { close, root } or null (no software, no board) */
export function openHil() {
  const d0 = (store.project.software || [])[0]; if (!d0) return null;
  const { board, steps, notes } = hilSteps(store.project, d0); if (!board) return null;
  const id = d0.id, R = resolveBoard(board, LIBRARY), nb = () => (((store.project || {}).swLab || {})[id]) || {}, now = () => new Date().toISOString();
  const write = (label, fn) => store.commit(`Essai sur la carte : ${label}`, (p) => { p.swLab = p.swLab || {}; const n = (p.swLab[id] = p.swLab[id] || { ticks: {}, readings: {}, notes: {}, pass: {} }); for (const k of ["ticks", "readings", "notes", "pass"]) n[k] = n[k] || {}; fn(n); });
  const dots = el("div", { class: "manip-dots", role: "list", "aria-label": "Les étapes de l'essai" }), count = el("small"), boardHost = el("div", { class: "manip-board" }), legend = el("div", { class: "manip-legend", "aria-live": "polite" }), card = el("div", { class: "manip-card" });
  const full = btn("Plein écran", () => { try { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen().catch(() => {}); } catch (e) { /* the screen already covers the page */ } }, { small: true, icon: "fit" });
  const root = el("div", { class: "manip", role: "dialog", "aria-modal": "true", "aria-label": `Essai du logiciel sur la carte — ${board.name || board.id}`, "data-sw-hil": id },
    el("div", { class: "manip-head" }, icon("chip"), el("div", { class: "grow" }, el("h2", null, `Essai sur la carte — ${board.name || board.id}`), el("small", null, `${d0.name} · `, count)), dots, full, btn("Fermer", () => close(), { small: true, icon: "close" })),
    el("div", { class: "manip-body" }, el("div", { class: "manip-left" }, boardHost, legend), card));
  document.body.append(root);
  const pcb = labBoard(boardHost); let shown = -1, passOpen = false, alive = true;
  const goTo = (i) => { shown = Math.max(0, Math.min(steps.length - 1, i)); passOpen = false; draw(true); card.scrollTop = 0; };
  function action(s, st) {
    if (!st.open) return el("div", { class: "manip-act locked", "data-act": "locked" }, icon("lock"), el("span", { class: "grow" }, "Faites d'abord les étapes d'avant : l'ordre protège la carte."), btn("Aller à l'étape à faire", () => goTo(state().findIndex((x) => !x.done)), { small: true }));
    if (s.needs !== "reading") return st.done ? el("div", { class: "manip-act ok", "data-act": "done" }, badge("Fait", "ok"), el("span", { class: "grow" }), btn("Décocher", () => write(`étape reprise — ${s.title}`, (n) => { delete n.ticks[s.id]; }), { small: true }))
      : el("div", { class: "manip-act", "data-act": "tick" }, btn("C'est fait", () => { write(`étape faite — ${s.title}`, (n) => { n.ticks[s.id] = now(); }); goTo(shown + 1); }, { primary: true, cls: "big", icon: "check" }));
    const E = s.expect, box = el("div", { class: `manip-act ${st.bad ? "out" : st.done ? "ok" : ""}`, "data-act": "read" });
    const input = el("input", { type: "number", step: "any", value: st.value !== undefined ? fr(st.value).replace(",", ".") : "", "data-hil-read": s.id, "aria-label": `Valeur mesurée, en ${E.unit}`,
      onChange: (e) => { const v = Number(e.target.value); if (e.target.value === "" || !Number.isFinite(v)) return; write(`relevé — ${s.title}`, (n) => { n.readings[s.id] = v; delete n.pass[s.id]; }); if (v >= E.lo && v <= E.hi) setTimeout(() => goTo(shown + 1), 0); } });
    box.append(el("label", { class: "manip-read" }, "Mesuré", input, el("b", null, E.unit)), el("span", null, "Attendu : ", el("strong", null, `${fr(E.lo)} à ${fr(E.hi)} ${E.unit}`), ` — ${E.what}`), ...(st.done && !st.bad ? [badge("Dans la plage", "ok")] : []));
    if (st.bad) { box.append(el("p", { class: "manip-stop", role: "alert" }, icon("warning"), ` Hors de la plage : l'essai s'arrête. Coupez la sortie de l'alimentation, vérifiez les cordons et le net (une sortie qui ne bouge pas : le programme est-il lancé ? le net est-il le bon ?), puis mesurez de nouveau.`));
      if (!passOpen) box.append(btn("Un superviseur laisse passer…", () => { passOpen = true; draw(); }, { small: true, icon: "user" }));
      else { const by = el("input", { type: "text", placeholder: "Nom du superviseur", "data-pass-by": "" }), why = el("input", { type: "text", placeholder: "Pourquoi l'essai peut continuer" });
        box.append(el("div", { class: "manip-pass" }, by, why, btn("Laisser passer", () => { if (!by.value.trim()) { by.focus(); return; } write(`laissé passer — ${s.title}`, (n) => { n.pass[s.id] = { by: by.value.trim(), why: why.value.trim(), when: now() }; }); goTo(shown + 1); }, { small: true, primary: true }))); } }
    if (st.pass) box.append(el("p", { class: "manip-text" }, icon("user"), ` Laissé passer par ${st.pass.by}${st.pass.why ? ` — ${st.pass.why}` : ""}.`));
    return box;
  }
  const state = () => hilState(steps, nb());
  function draw(focus = false) {
    if (!alive) return; const S = state(); if (shown < 0) { shown = S.findIndex((x) => !x.done); if (shown < 0) shown = steps.length - 1; }
    const s = steps[shown], st = S[shown], pp = placedPoints(R, s), on = pp.points.filter((p) => p.at), done = S.filter((x) => x.done).length;
    count.textContent = `étape ${shown + 1} sur ${steps.length} — ${done} faite${done > 1 ? "s" : ""}${S.some((x) => x.bad) ? " — ESSAI ARRÊTÉ" : ""}`;
    dots.replaceChildren(...S.map((x, i) => el("button", { class: `manip-dot ${x.done ? "done" : x.open ? "open" : "locked"}${x.bad ? " stop" : ""}${i === shown ? " cur" : ""}`, type: "button", role: "listitem", "aria-current": i === shown ? "step" : null, "aria-label": `Étape ${i + 1} : ${steps[i].title}`, onClick: () => goTo(i) })));
    pcb.show(R, on.length ? { focus: new Set(on.map((p) => p.ref)) } : {}); pcb.mark(pp.points, pp.box);
    legend.replaceChildren(...(pp.points.length ? pp.points.map((p) => el("span", { class: "lead", "data-lead": p.lead }, el("i", { style: `background:${p.color}` }, p.label), el("span", null, `${p.word} → ${p.signal}`), el("small", null, p.at ? `${p.ref}, broche ${p.pin}` : "pas sur la carte"))) : [el("span", null, icon("info"), " Rien à brancher sur la carte à cette étape.")]));
    const K = KIND[s.kind] || KIND.do, last = shown === steps.length - 1;
    card.replaceChildren(...[el("span", { class: "manip-kind", style: `--dom:${K[1]}` }, `${shown + 1}. ${K[0]}`), el("h3", { tabindex: -1 }, s.title),
      s.instrument ? el("div", { class: "manip-gear" }, gearPic(s.gear, s.instrument), el("span", null, el("small", null, "Appareil"), el("b", null, s.instrument))) : null,
      el("p", { class: "manip-text" }, s.text), s.why ? el("p", { class: "manip-why" }, el("b", null, "Pourquoi. "), s.why) : null,
      shown === 0 && notes.length ? el("ul", { class: "manip-list", "data-hil-notes": String(notes.length) }, notes.map((t) => el("li", null, t))) : null,
      shown === 0 ? el("p", { class: "manip-why" }, el("b", null, "À savoir. "), "Ce que chaque sortie doit lire vient du modèle — le même pas que le C. Rien de cette procédure n'a encore tourné sur une vraie carte : vos relevés le diront.") : null,
      action(s, st), el("label", { class: "manip-note" }, "Notes de cette étape", el("textarea", { rows: 2, onChange: (e) => write(`note — ${s.title}`, (n) => { if (e.target.value.trim()) n.notes[s.id] = e.target.value.trim(); else delete n.notes[s.id]; }) }, (nb().notes || {})[s.id] || "")),
      el("div", { class: "manip-nav" }, btn("Précédent", () => goTo(shown - 1), { icon: "undo", disabled: shown === 0 }), el("span", { class: "grow" }), last ? btn("Fermer", () => close(), { primary: true, icon: "check" }) : btn("Suivant", () => goTo(shown + 1), { primary: st.done, icon: "chevron-right" }))].filter(Boolean));
    if (focus) { const f = card.querySelector('[data-act="tick"] .btn, [data-hil-read]'); if (f) f.focus(); }
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; } if (typing(e) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(shown + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(shown - 1); } }
  const off = store.on("change", () => setTimeout(() => draw(), 0));
  function close() { if (!alive) return; alive = false; off(); root.removeEventListener("keydown", onKey, true); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* nothing */ } root.remove(); }
  root.addEventListener("keydown", onKey, true);
  draw(true);
  return { close, root };
}
