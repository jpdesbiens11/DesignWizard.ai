/* DesignWizard.ai — the veil of a long operation : what is being done, how far it is, for how long — and a button to cancel it. One look
   for every screen : a view of the 3D (core/viewport.js) or any panel (busyVeil on a host). While the kernel is being downloaded — 23 MB,
   once — the veil shows its bytes : the first operation of a session is the one that waits for it.
   veil.set(text, o) : o { done, total, cancel() (shows « Annuler »), stopped (true : nothing runs — a notice, with retry) , retry() }.
   veil.set("") hides it. The words and the numbers come from core/progress.js. */

import { el, btn } from "./dom.js";
import { kernel } from "../cad/client.js";
import { busyView } from "./progress.js";

export function busyVeil(host, cls = "view-busy") {
  const title = el("b", { class: "busy-title" }), sub = el("small", { class: "busy-sub" }), fill = el("i"), bar = el("div", { class: "busy-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, fill);
  const time = el("small", { class: "busy-time" }), hint = el("p", { class: "busy-hint" }), actions = el("div", { class: "busy-actions" }), spin = el("span", { class: "busy-spin", "aria-hidden": "true" });
  const card = el("div", { class: "busy-card", role: "status", "aria-live": "polite" }, el("div", { class: "busy-head" }, spin, title, time), bar, sub, hint, actions), node = el("div", { class: `${cls} hidden` }, card);
  host.append(node);
  let cur = null, timer = 0, off = null, seen = "";
  const draw = () => {
    if (!cur) return;
    const now = Date.now(), v = busyView({ ...cur, stage: cur.stopped ? null : kernel.stage(), now }), mark = `${v.title}|${v.sub}|${v.ratio}`;
    if (mark !== seen) { seen = mark; cur.changedAt = now; }      // something moved : the clock of « nothing moves » starts again
    title.textContent = v.title; sub.textContent = v.sub; sub.hidden = !v.sub; time.textContent = cur.stopped ? "" : v.elapsed;
    card.classList.toggle("stopped", !!cur.stopped); bar.hidden = !!cur.stopped; spin.hidden = !!cur.stopped;
    bar.classList.toggle("unknown", v.ratio === null); fill.style.width = v.ratio === null ? "" : `${Math.round(v.ratio * 100)}%`;
    if (v.ratio === null) bar.removeAttribute("aria-valuenow"); else bar.setAttribute("aria-valuenow", String(Math.round(v.ratio * 100)));
    const h = cur.stopped ? "" : busyView({ ...cur, stage: kernel.stage(), now }).hint; hint.textContent = h; hint.hidden = !h;
  };
  const buttons = () => { actions.replaceChildren(...[cur && cur.cancel && !cur.stopped ? btn("Annuler", () => { const c = cur.cancel; c(); }, { small: true, icon: "cross", tip: "Arrêter cette opération" }) : null,
    cur && cur.retry ? btn(cur.stopped ? "Reprendre" : "Réessayer", () => { const r = cur.retry; r(); }, { small: true, primary: !!cur.stopped, icon: "refresh" }) : null].filter(Boolean)); actions.hidden = !actions.childNodes.length; };
  return { node,
    /** Shows the veil, or hides it when the text is empty. */
    set(text, o = {}) {
      if (!text) { cur = null; seen = ""; node.classList.add("hidden"); clearInterval(timer); timer = 0; if (off) { off(); off = null; } return; }
      const fresh = !cur || !!cur.stopped !== !!o.stopped;
      cur = { text, done: o.done, total: o.total, cancel: o.cancel || null, retry: o.retry || null, stopped: !!o.stopped, startedAt: fresh ? Date.now() : cur.startedAt, changedAt: fresh ? Date.now() : cur.changedAt };
      node.classList.remove("hidden"); buttons(); draw();
      if (!timer && !cur.stopped) timer = setInterval(draw, 500);
      if (cur.stopped) { clearInterval(timer); timer = 0; }
      if (!off) off = kernel.onStage(() => draw());
    },
    get on() { return !!cur && !cur.stopped; },
    dispose() { clearInterval(timer); if (off) off(); node.remove(); } };
}
