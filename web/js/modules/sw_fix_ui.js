/* DynamiteOrbit.ai — Logiciel : what is LEFT TO DO, shown on the page, and walked through (demandes de JP, 24 novembre 2026 : « je ne vois pas
   les 9 choses à corriger, ce serait le fun d'avoir un tour guidé des trucs à corriger » ; « pour approuver les paramètres de chaque bloc au lieu
   d'aller dans la marge de droite, un questionnaire pop-up qui passe au travers de chaque bloc avec un Approve dans le coin en haut à droite et
   un Next si on veut y revenir après le premier jet… si on repart le questionnaire, il montre les trucs restants ; un « ? » dans le coin des
   blocs avec des entrées à confirmer jusqu'à ce que leur état change »).
   Over the page, two counters : « ⚠ n à corriger » and « ? n valeurs à approuver ». The first opens the TOUR : a card that takes the problems
   of the guide one by one — what is wrong, in words, then « Aller au bloc » (the block chosen, its sheet open, the field blinking), « Suivant »,
   « Précédent » ; the list is read again at each step, so a fixed problem leaves it. The second opens the QUESTIONNAIRE : a dialog that goes
   through each block with values to confirm — its values typed in V, A, °C, each with where it comes from (a requirement, or the reference of
   the tool, and why) — « Approuver » at the top right confirms the block (and what was typed) in one undoable step and goes on ; « Plus tard »
   leaves it for the next pass. Opened again, it shows only what is left.
   What it follows : the coach marks of a guided tour, and the review queue of a code review tool (approve, next, what is left). */

import { el, btn, icon } from "../core/dom.js";
import { KINDS, cfgOf, paramUnit } from "../sw/sw_objects.js";
import { unsure } from "../sw/sw_design.js";
import { familyOf, sourceOf, VALUE_SOURCES } from "../sw/sw_blocks.js";
import { toShown, toInside, shownStep, shownUnit } from "../sw/sw_units.js";

const LV = { error: ["À corriger", "#dc2626"], todo: ["À entrer", "#d97706"], check: ["À vérifier", "#2563eb"], tip: ["Conseil", "#64748b"] };

/** o : { design(), problems() → [{ level, text, obj?, field? }], pick(id, field), change(label, fn) } → { bar, refresh(), dispose() } */
export function swFix(o) {
  const fixB = btn("", () => tour(0), { small: true, tip: "Le tour guidé : chaque chose à corriger, une à la fois, et le bloc qu'elle touche" }), askB = btn("", () => quiz(), { small: true, tip: "Le questionnaire : chaque bloc dont les valeurs sont à approuver, un à la fois" });
  fixB.dataset.swFixTour = ""; askB.dataset.swQuiz = ""; fixB.classList.add("swf-fix"); askB.classList.add("swf-ask");
  const bar = el("div", { class: "swf-bar", "data-sw-fixbar": "" }, fixB, askB);
  let card = null, dlg = null;
  const list = () => o.problems().filter((p) => p.level !== "tip");
  function refresh() {
    const n = list().length, q = unsure(o.design() || { objects: [] }).length;
    fixB.replaceChildren(icon(n ? "warning" : "check"), el("span", null, n ? `${n} à corriger` : "Rien à corriger")); fixB.disabled = !n; fixB.dataset.swFixTour = String(n);
    askB.replaceChildren(el("b", { class: "swf-q" }, "?"), el("span", null, q ? `${q} valeur${q > 1 ? "s" : ""} à approuver` : "Valeurs approuvées")); askB.disabled = !q; askB.dataset.swQuiz = String(q);
    if (card) drawCard();
  }

  /* ---------- the tour ---------- */
  let at = 0;
  function tour(i) { at = i; if (!card) { card = el("div", { class: "swf-card", role: "dialog", "aria-label": "Tour guidé des choses à corriger", "data-sw-tour": "", onKeydown: (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); } }); document.body.append(card); } drawCard(true); }
  const close = () => { if (card) { card.remove(); card = null; } };
  const step = (k) => { const L = list(); if (!L.length) return; at = (at + k + L.length) % L.length; drawCard(true); };
  function drawCard(go = false) {
    const L = list(); if (at >= L.length) at = Math.max(0, L.length - 1); const p = L[at];
    if (!p) { card.replaceChildren(el("div", { class: "swf-head" }, icon("check"), el("b", null, "Plus rien à corriger"), el("button", { type: "button", class: "icon-btn", "aria-label": "Fermer", onClick: close }, "×")), el("p", null, "Le guide n'a plus rien à dire sur ce logiciel. Il reste peut-être des valeurs à approuver : le questionnaire « ? » les passe une à une.")); return; }
    const [lab, col] = LV[p.level] || LV.check, D = o.design(), ob = p.obj && D ? D.objects.find((x) => x.id === p.obj) : null, isAsk = /valeurs? sont des exemples|est un exemple/.test(p.text);      // the line of the guide on the examples : the questionnaire answers it
    card.style.setProperty("--lv", col); card.dataset.level = p.level;
    card.replaceChildren(...[el("div", { class: "swf-head" }, el("span", { class: "swf-chip" }, lab), el("small", null, `${at + 1} / ${L.length}`), el("button", { type: "button", class: "icon-btn", "aria-label": "Fermer le tour", onClick: close }, "×")),
      ob ? el("div", { class: "swf-obj", style: `--dom:${familyOf(ob.kind, ob).color}` }, icon(KINDS[ob.kind].icon || "chip"), el("b", null, ob.name)) : null, el("p", null, p.text),
      el("div", { class: "swf-nav" }, btn("Précédent", () => step(-1), { small: true, disabled: L.length < 2 }),
        isAsk ? btn("Ouvrir le questionnaire", () => { close(); quiz(); }, { small: true, primary: true }) : ob ? btn("Aller au bloc", () => o.pick(ob.id, p.field), { small: true, primary: true, icon: "fit" }) : null,
        btn("Suivant", () => step(1), { small: true, icon: "chevron-right", disabled: L.length < 2 }))].filter(Boolean));
    if (go && ob) o.pick(ob.id, p.field);
  }

  /* ---------- the questionnaire ---------- */
  let qi = 0, skipped = new Set();
  const pending = () => { const D = o.design(); if (!D) return []; const by = new Map(); for (const u of unsure(D)) { if (!by.has(u.obj)) by.set(u.obj, []); by.get(u.obj).push(u.key); } return [...by.entries()].map(([id, keys]) => ({ ob: D.objects.find((x) => x.id === id), keys })).filter((x) => x.ob); };
  function quiz(start) { skipped = new Set(); qi = 0; if (start) { const k = pending().findIndex((x) => x.ob.id === start); if (k > 0) qi = k; } if (!dlg) { dlg = el("div", { class: "swf-quiz", role: "dialog", "aria-modal": "false", "aria-label": "Questionnaire des valeurs à approuver", "data-sw-quiz-dlg": "", onKeydown: (e) => { if (e.key === "Escape") qclose(); } }); document.body.append(dlg); } drawQuiz(); }
  const qclose = () => { if (dlg) { dlg.remove(); dlg = null; } };
  function drawQuiz() {
    const P = pending(), order = [...P.filter((x) => !skipped.has(x.ob.id)), ...P.filter((x) => skipped.has(x.ob.id))];
    if (!P.length) { dlg.replaceChildren(el("div", { class: "swf-qhead" }, icon("check"), el("h3", null, "Toutes les valeurs sont approuvées"), el("button", { type: "button", class: "icon-btn", "aria-label": "Fermer", onClick: qclose }, "×")), el("p", null, "Chaque bloc a ses valeurs relues : le guide peut laisser écrire les fichiers C.")); return; }
    if (qi >= order.length) qi = 0; const { ob, keys } = order[qi], K = KINDS[ob.kind], F = familyOf(ob.kind, ob), cf = cfgOf(ob), typed = {};
    if (o.show) o.show(ob.id);
    const rows = K.params.filter((p) => keys.includes(p.key)).map((p) => { const U = paramUnit(ob, p), src = sourceOf(ob, p.key), whence = src === "req" ? `Donnée par ${ob.src[p.key] === "signals" ? "la liste des signaux" : `l'exigence ${ob.src[p.key]}`}` : VALUE_SOURCES.ref.text;
      const input = p.choices ? el("select", { "data-quiz-param": p.key, onChange: (e) => { typed[p.key] = typeof p.value === "number" ? Number(e.target.value) : e.target.value; } }, p.choices.map((v) => el("option", { value: v, selected: v === cf[p.key] }, String(v))))
        : el("input", { type: "number", step: String(shownStep(U)), value: String(toShown(cf[p.key], U)), "data-quiz-param": p.key, onInput: (e) => { const v = toInside(e.target.value, U); if (e.target.value !== "" && Number.isFinite(v)) typed[p.key] = v; } });
      return el("div", { class: `swf-row ${src}` }, el("label", null, el("b", null, p.label), el("small", null, p.text)), el("div", { class: "swf-val" }, input, el("span", null, p.choices ? "" : shownUnit(U))), el("small", { class: `swf-src ${src}` }, whence)); });
    const approve = btn("Approuver", () => { const id = ob.id, ks = keys, t = { ...typed }; skipped.delete(id); o.change(`Logiciel : valeurs de ${ob.name} approuvées`, (x) => { const q = x.objects.find((z) => z.id === id); if (!q) return; q.params = { ...(q.params || {}), ...t }; q.sure = [...new Set([...(q.sure || []), ...ks])]; }); setTimeout(() => dlg && drawQuiz(), 0); },
      { primary: true, icon: "check", tip: "J'ai relu ces valeurs (et celles que j'ai tapées) : elles sont confirmées, une étape annulable" });
    approve.dataset.quizApprove = ""; approve.classList.add("swf-approve");
    const later = btn("Plus tard", () => { skipped.add(ob.id); qi = (qi + 1) % order.length; drawQuiz(); }, { small: true, icon: "chevron-right", tip: "Passer ce bloc : il revient à la fin, et au prochain questionnaire" }); later.dataset.quizNext = "";
    const n = P.reduce((s, x) => s + x.keys.length, 0);
    dlg.style.setProperty("--dom", F.color);
    dlg.replaceChildren(el("div", { class: "swf-qhead" }, el("span", { class: "swf-qico" }, icon(K.icon || F.icon)), el("div", null, el("small", null, `${F.fr} · ${K.label}`), el("h3", null, ob.name)), approve, el("button", { type: "button", class: "icon-btn", "aria-label": "Fermer le questionnaire", onClick: qclose }, "×")),
      el("p", { class: "muted small" }, K.text), el("div", { class: "swf-rows" }, rows),
      el("div", { class: "swf-qfoot" }, el("small", null, `Bloc ${qi + 1} sur ${order.length} · ${n} valeur${n > 1 ? "s" : ""} encore à approuver`), btn("Précédent", () => { qi = (qi - 1 + order.length) % order.length; drawQuiz(); }, { small: true, disabled: order.length < 2 }), later));
  }
  refresh();
  return { bar, refresh, quiz, tour, dispose() { close(); qclose(); } };
}
