/* DesignOrbit.ai — where am I, drawn (core/where.js says what) : two short lines right under the head of every left panel —
   the project, then the part, assembly, board, sheet… that the screen shows. Installed once : a screen declares nothing, it
   only needs a left panel with a `.side-head`. A click on the project line opens the Shop of the project. */

import { el, icon } from "./dom.js";
import { store } from "./store.js";
import { addressOf } from "./stairs.js";
import { whereOf } from "./where.js";

export function installWhere() {
  let queued = false;
  function place() {
    queued = false; const m = document.getElementById("main"); if (!m) return;
    const side = [...m.querySelectorAll(".side-head")].find((h) => !h.closest(".side.right, .split.right")) || null;
    const { key, args } = addressOf(location.hash), w = side ? whereOf(key, args, store.project) : null;
    const sig = w ? [w.project, w.kind, w.name, w.id].join("|") : "";
    for (const old of m.querySelectorAll(".where-line")) if (!w || old.previousElementSibling !== side || old.dataset.sig !== sig) old.remove();
    if (!w || (side.nextElementSibling && side.nextElementSibling.classList.contains("where-line"))) return;
    const tip = `Vous êtes dans le projet « ${w.project} »${w.name ? `, ${w.kind.toLowerCase()} « ${w.name} »` : ""}`;
    side.after(el("div", { class: "where-line", "data-sig": sig, role: "note", "aria-label": tip, "data-tip": tip },
      el("a", { class: "where-project", href: "#/shop" }, icon("folder"), el("span", null, w.project)),
      w.name ? el("span", { class: "where-what" }, icon(w.icon || "part"), el("small", null, w.kind), el("b", null, w.name), w.id ? el("code", null, w.id) : null) : null));
  }
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  new MutationObserver(later).observe(document.getElementById("main") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", later); store.on("change", later); store.on("project", later);
  later();
}
