/* DesignWizard.ai — the step up, drawn (core/stairs.js says where it leads) : one small button, the pictogram of where it leads,
   at the SAME place on every screen — the head of the left panel, right after its title ; on a page without panels, the head of
   the page. Installed once : a screen declares nothing, it only needs a left panel with a `.side-head` (or a `.page-head`).
   The usage it follows : the « up » button of a file explorer, next to the address. */

import { el, icon } from "./dom.js";
import { store } from "./store.js";
import { stairOf, aiTargetOf, addressOf } from "./stairs.js";

/** The button of a step. s : what stairOf gives. */
export function stairButton(s, o = {}) {
  return el("a", { class: "btn btn-small stair-btn" + (o.label ? " with-label" : ""), href: s.hash, "data-stair": s.hash, "data-icon": s.icon, "aria-label": s.tip, "data-tip": `${s.tip}${o.keys ? " (Alt + ↑)" : ""}`, style: s.color ? { "--g": s.color } : null }, icon(s.icon), o.label ? el("span", null, o.label) : null);
}
export const currentStair = () => { const { key, args } = addressOf(location.hash); return stairOf(key, args, store.project); };

/** o.ai(key) : open the AI round trip on an artefact — the button « IA » then sits at the head of the left panel of every studio, next to the step up :
    the same place on every screen, for what the screen shows (aiTargetOf). */
export function installStairs(o = {}) {
  const main = () => document.getElementById("main");
  let queued = false;
  function placeAi(side) {
    const m = main(), t = side && o.ai ? (() => { const { key, args } = addressOf(location.hash); return aiTargetOf(key, args, store.project); })() : null;
    for (const old of m.querySelectorAll(".head-ai")) if (!t || old.parentElement !== side || old.dataset.ai !== t.key) old.remove();
    if (!t || side.querySelector(":scope > .head-ai")) return;
    const tip = `Confier ${t.label} à l'IA : l'exporter avec votre demande, réimporter la réponse, voir chaque changement avant de l'appliquer — une étape annulable, et un journal pour revenir à avant`;
    const b = el("button", { class: "btn btn-small head-ai", type: "button", "data-ai": t.key, "aria-label": tip, "data-tip": tip, onClick: () => o.ai(t.key) }, icon("sparkle"), el("span", null, "IA"));
    const after = side.querySelector(":scope > .stair-btn") || side.querySelector(":scope > h2"); if (after) after.after(b); else side.append(b);
  }
  function place() {
    queued = false; const m = main(); if (!m) return;
    const s = currentStair(), side = [...m.querySelectorAll(".side-head")].find((h) => !h.closest(".side.right, .split.right")) || null;
    const page = side || document.querySelector("#levels .levels-up") ? null : m.querySelector(".page-head"), host = side || page;
    for (const old of m.querySelectorAll(".stair-btn")) if (!host || old.parentElement !== host || !s || old.dataset.stair !== s.hash || old.dataset.icon !== s.icon) old.remove();
    if (host && s && !host.querySelector(":scope > .stair-btn")) { const b = stairButton(s, { keys: true, label: side ? null : "Monter" }), title = side ? host.querySelector(":scope > h2") : null; if (title) title.after(b); else host.append(b); }
    placeAi(side);
  }
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", later); store.on("change", later); store.on("project", later);
  document.addEventListener("keydown", (e) => { if (!e.altKey || e.ctrlKey || e.metaKey || e.key !== "ArrowUp" || (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]"))) return;
    const s = currentStair(); if (s) { e.preventDefault(); location.hash = s.hash; } });
  later();
}
