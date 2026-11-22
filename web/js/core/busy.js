/* DynamiteOrbit — the veil of a long operation : what is being done, how far it is, for how long — and a button to cancel it. One look
   for every screen : a view of the 3D (core/viewport.js) or any panel (busyVeil on a host). While the kernel is being downloaded — 23 MB,
   once — the veil shows its bytes : the first operation of a session is the one that waits for it.
   veil.set(text, o) : o { done, total, cancel() (shows « Annuler »), stopped (true : nothing runs — a notice, with retry) , retry(),
   kind ("drive" : what waits for Google Drive) }. pageVeil() is the one of the whole page, for what no screen owns (a project being loaded).
   veil.set("") hides it. The words and the numbers come from core/progress.js.
   underVeil(veil, text, job) runs an export or a send under a veil : the same look, and a cancel that stops the kernel. */

import { el, btn, toast } from "./dom.js";
import { kernel } from "../cad/client.js";
import { busyView, cancellable } from "./progress.js";

export function busyVeil(host, cls = "view-busy") {
  const title = el("b", { class: "busy-title" }), sub = el("small", { class: "busy-sub" }), fill = el("i"), bar = el("div", { class: "busy-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, fill);
  const time = el("small", { class: "busy-time" }), hint = el("p", { class: "busy-hint" }), actions = el("div", { class: "busy-actions" }), spin = el("span", { class: "busy-spin", "aria-hidden": "true" });
  const card = el("div", { class: "busy-card", role: "status", "aria-live": "polite" }, el("div", { class: "busy-head" }, spin, title, time), bar, sub, hint, actions), node = el("div", { class: `${cls} hidden` }, card);
  host.append(node);
  let cur = null, timer = 0, off = null, seen = "", shown = "";
  const draw = () => {
    if (!cur) return;
    const now = Date.now(), v = busyView({ ...cur, canCancel: !!cur.cancel, stage: cur.stopped ? null : kernel.stage(), now }), mark = `${v.title}|${v.sub}|${v.ratio}`;
    if (mark !== seen) { seen = mark; cur.changedAt = now; }      // something moved : the clock of « nothing moves » starts again
    title.textContent = v.title; sub.textContent = v.sub; sub.hidden = !v.sub; time.textContent = cur.stopped ? "" : v.elapsed;
    card.classList.toggle("stopped", !!cur.stopped); bar.hidden = !!cur.stopped; spin.hidden = !!cur.stopped;
    bar.classList.toggle("unknown", v.ratio === null); fill.style.width = v.ratio === null ? "" : `${Math.round(v.ratio * 100)}%`;
    if (v.ratio === null) bar.removeAttribute("aria-valuenow"); else bar.setAttribute("aria-valuenow", String(Math.round(v.ratio * 100)));
    const h = cur.stopped ? "" : busyView({ ...cur, canCancel: !!cur.cancel, stage: kernel.stage(), now }).hint; hint.textContent = h; hint.hidden = !h;
  };
  /* the buttons are made again only when what they are changes : a line of progress that arrives while « Annuler » is being clicked must not
     take the button away from under the pointer (the click would be lost) — each one reads what to do when it is clicked */
  const buttons = () => { const sig = `${cur && cur.cancel && !cur.stopped ? "c" : ""}${cur && cur.retry ? (cur.stopped ? "R" : "r") : ""}`; if (sig === shown && actions.childNodes.length === sig.length) return; shown = sig;
    actions.replaceChildren(...[cur && cur.cancel && !cur.stopped ? btn("Annuler", () => { const c = cur.cancel; c(); }, { small: true, icon: "cross", tip: "Arrêter cette opération" }) : null,
    cur && cur.retry ? btn(cur.stopped ? "Reprendre" : "Réessayer", () => { const r = cur.retry; r(); }, { small: true, primary: !!cur.stopped, icon: "refresh" }) : null].filter(Boolean)); actions.hidden = !actions.childNodes.length; };
  return { node,
    /** Shows the veil, or hides it when the text is empty. */
    set(text, o = {}) {
      if (!text) { cur = null; seen = ""; shown = ""; actions.replaceChildren(); node.classList.add("hidden"); clearInterval(timer); timer = 0; if (off) { off(); off = null; } return; }
      const fresh = !cur || !!cur.stopped !== !!o.stopped;
      cur = { text, done: o.done, total: o.total, kind: o.kind || "", cancel: o.cancel || null, retry: o.retry || null, stopped: !!o.stopped, startedAt: fresh ? Date.now() : cur.startedAt, changedAt: fresh ? Date.now() : cur.changedAt };
      node.classList.remove("hidden"); buttons(); draw();
      if (!timer && !cur.stopped) timer = setInterval(draw, 500);
      if (cur.stopped) { clearInterval(timer); timer = 0; }
      if (!off) off = kernel.onStage(() => draw());
    },
    get on() { return !!cur && !cur.stopped; },
    dispose() { clearInterval(timer); if (off) off(); node.remove(); } };
}
/** A long export or send under a veil, with a button that really stops it. veil : anything with set(text, o) — a busyVeil, pageVeil(), or
    { set: vp.setBusy } for a 3D view. job(say, signal) as in progress.cancellable : say(text, done, total, { kind, hold }).
    o : { kernel (false : the job does not use the kernel, it is left alone), stop() (what else to stop), after() (what to put back : once
    stopped the kernel starts afresh, its shapes are built again), cancelled (the word said : what was, or was not, written) }.
    Resolves with the job's result, or with undefined once cancelled. */
export function underVeil(veil, text, job, o = {}) {
  return cancellable(job, { text, show: (t, x) => veil.set(t, x), hide: () => veil.set(""),
    stop: () => { if (o.kernel !== false) kernel.cancel(); if (o.stop) o.stop(); if (o.after) o.after(); toast(o.cancelled || "Opération annulée : rien n'a été écrit.", "info", 6000); } });
}
let page = null;
/** The veil of the whole page : one for the application, made when first asked for. */
export function pageVeil() { if (!page || !page.node.isConnected) page = busyVeil(document.body, "app-busy"); return page; }
