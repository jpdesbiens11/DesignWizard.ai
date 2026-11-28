/* DynamiteOrbit.ai — Atelier, a new part step by step : the screen of core/shop_steps.js. It LAYS the six questions over the page
   of the intent, whose fields it does not own : the blocks of the left column carry `data-step`, and only the block of the
   question asked is shown — with a rail that says where one is, Back, Skip and Next (Enter), and a card that keeps what has
   been said, each line a way back to its question. The part is born at right all along. « Tout voir sur une page » brings the
   whole page back, for who knows it ; the choice is kept. */

import { el, icon, btn } from "../core/dom.js";
import { STEPS, stepMemo, stepState, stepOf, moveStep } from "../core/shop_steps.js";

const SLOT = "dwiz.shop.mode";
const readMode = () => { try { return localStorage.getItem(SLOT) === "all" ? "all" : "steps"; } catch { return "steps"; } };
const keepMode = (m) => { try { localStorage.setItem(SLOT, m); } catch { /* a private window : the choice lives for the page only */ } };
const MARK = { done: "✓", todo: "●", eg: "◐", skip: "○" }, SAY = { done: "répondu", todo: "à dire", eg: "exemple à confirmer", skip: "rien de dit" };

/** o : { left (the column of the questions), memo() → [brief, what stepMemo needs], all (true : the whole page, whatever was kept) } → { refresh(), show(field), go(i) } */
export function mountSteps(o) {
  let mode = o.all ? "all" : readMode(), now = 0;
  const head = el("div", { class: "wizard-head" }), foot = el("div", { class: "wizard-nav" }), card = el("section", { class: "card wizard-memo", "aria-label": "Ce qui est retenu" });
  o.left.prepend(head); o.left.append(foot, card);
  const block = (i) => o.left.querySelector(`[data-step="${i}"]`);
  function go(i, focus = true) {
    now = Math.max(0, Math.min(STEPS.length - 1, i)); apply();
    if (focus && mode === "steps") { const f = block(now) && block(now).querySelector("input:not([type=checkbox]), textarea, select, button"); if (f) f.focus({ preventScroll: true }); o.left.scrollIntoView({ block: "start", behavior: "auto" }); }
  }
  function setMode(m) { mode = m; keepMode(m); apply(); }
  function apply() {
    o.left.dataset.mode = mode; o.left.dataset.now = String(now);
    for (const sec of o.left.querySelectorAll(":scope > section.card.taped")) {
      const mine = [...sec.querySelectorAll("[data-step]")]; sec.classList.toggle("now", mine.some((b) => Number(b.dataset.step) === now));
      for (const b of mine) b.classList.toggle("now-step", Number(b.dataset.step) === now);
    }
    refresh();
  }
  function refresh() {
    const [brief, more] = o.memo(), memo = stepMemo(brief, more), S = STEPS[now], last = now === STEPS.length - 1;
    head.replaceChildren(...(mode === "all" ? [el("div", { class: "wizard-all" }, el("span", { class: "muted" }, "Toute la page, d'un coup."), btn("Revenir au pas à pas", () => setMode("steps"), { small: true, icon: "intent", tip: "Une question à la fois : son rôle, ses contraintes, ses voisines, ses interfaces, sa matière, la pièce proposée" }))]
      : [el("ol", { class: "wizard-rail", "aria-label": "Les six questions" }, STEPS.map((s, i) => { const state = stepState(i, memo);
        return el("li", { class: `${i === now ? "now" : ""} ${state}`.trim() }, el("button", { type: "button", "aria-current": i === now ? "step" : null, "aria-label": `Question ${i + 1} sur ${STEPS.length} : ${s.title}${state === "todo" ? " — à dire" : state === "done" ? " — répondu" : ""}`, "data-tip": s.ask, onClick: () => go(i) }, el("i", { "aria-hidden": "true" }, state === "done" && i !== now ? "✓" : String(i + 1)), el("span", null, s.title))); })),
      el("p", { class: "wizard-eyebrow" }, `Question ${now + 1} de ${STEPS.length}`), el("h2", { class: "wizard-ask" }, S.ask), el("p", { class: "muted wizard-hint" }, S.hint)]));
    foot.replaceChildren(...(mode === "all" ? [] : [
      btn("Retour", () => go(moveStep(now, -1)), { icon: "undo", disabled: now === 0, tip: "La question d'avant — rien n'est perdu" }),
      last ? null : btn("Passer", () => go(moveStep(now, 1)), { tip: "Laisser cette question pour plus tard : on y revient d'un clic, par le rail ou par la fiche" }),
      el("span", { class: "grow" }),
      last ? el("span", { class: "muted small wizard-end" }, "« Créer la pièce » est à droite, sous la pièce proposée ", icon("chevron-right")) : (() => { const b = btn("Suivant", () => go(moveStep(now, 1)), { primary: true, tip: "La question suivante (Entrée)" }); b.append(icon("chevron-right"), el("kbd", null, "Entrée")); b.dataset.next = ""; return b; })(),
      el("button", { class: "wizard-link", type: "button", "data-tip": "Pour qui connaît : toutes les questions sur une seule page, comme avant", onClick: () => setMode("all") }, "Tout voir sur une page")]));
    card.classList.toggle("end", mode === "steps" && last);
    card.replaceChildren(el("h2", null, icon("check"), "Ce qui est retenu", el("small", null, "un clic sur une ligne revient à sa question")),
      ...memo.map((m) => el("button", { class: `wizard-line ${m.state}${m.step === now && mode === "steps" ? " now" : ""}`, type: "button", "aria-label": `${m.label} : ${m.value} — ${SAY[m.state]}. Revenir à la question « ${STEPS[m.step].title} ».`, onClick: () => { if (mode === "all") { const b = block(m.step); if (b) b.scrollIntoView({ block: "center", behavior: "smooth" }); } else go(m.step); } },
        el("i", { "aria-hidden": "true" }, MARK[m.state]), el("span", { class: "k" }, m.label), el("span", { class: "v" }, m.value), icon("edit"))));
  }
  o.left.addEventListener("keydown", (e) => { if (e.key !== "Enter" || mode !== "steps" || e.shiftKey || e.ctrlKey || e.altKey) return; const t = e.target;
    if (t.tagName === "INPUT" && !["checkbox", "radio", "button", "search"].includes(t.type) && now < STEPS.length - 1) { e.preventDefault(); go(moveStep(now, 1)); } });
  apply();
  return { refresh, go, show: (field) => { const i = stepOf(field); if (i !== null && mode === "steps" && i !== now) go(i, false); } };
}
