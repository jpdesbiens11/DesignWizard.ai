/* DesignWizard.ai — the artefact at the centre of a page zooms (demande de JP). A sheet — a drawing — was fitted to the width of
   the centre and stayed so : a note in small type could not be read without the PDF. A centre that holds sheets now zooms : Ctrl +
   wheel (or a pinch) about the pointer, the buttons − and + of a small bar, a click on the percentage to fit the width again ; once
   larger than the centre, the sheet is dragged, or scrolled. The zoom is kept for the visit of the screen.
   A 3D view and the view of a board already zoom with the wheel ; the magnifier (core/loupe.js) works on all of them — its button is in the
   bar of each view (core/view_bar.js : − % + · Ajuster · Loupe), the same for a sheet.
   The first half is pure ; zoomPane() touches the page. */

import { viewBar } from "./view_bar.js";

export const ZOOM = { min: 0.5, max: 8, steps: [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4, 6, 8] };      // 1 : the sheet fitted to the width of the centre
export const clampZoom = (z) => Math.min(ZOOM.max, Math.max(ZOOM.min, Number.isFinite(z) ? z : 1));
/** The next step of the buttons : up (dir > 0) or down, from any zoom — a zoom between two steps goes to the nearest one that way. */
export function zoomStep(z, dir) {
  const s = ZOOM.steps, cur = clampZoom(z);
  if (dir > 0) return s.find((x) => x > cur * 1.001) || ZOOM.max;
  return [...s].reverse().find((x) => x < cur * 0.999) || ZOOM.min;
}
/** The zoom after a move of the wheel : smooth, the same ratio for the same move. */
export const zoomWheel = (z, deltaY) => clampZoom(clampZoom(z) * Math.exp(-Math.max(-240, Math.min(240, deltaY)) * 0.0022));
/** Where a point sits in a sheet, as fractions of its width and height (rect : the sheet on the page ; at : the point). */
export const pointIn = (rect, at) => ({ u: rect.width ? (at.x - rect.left) / rect.width : 0, v: rect.height ? (at.y - rect.top) / rect.height : 0 });
/** How far to scroll so that the same point of the sheet, once the sheet has changed size, comes back under `at`. */
export const scrollBack = (rect, p, at) => ({ dx: rect.left + p.u * rect.width - at.x, dy: rect.top + p.v * rect.height - at.y });
export const zoomText = (z) => `${Math.round(clampZoom(z) * 100)} %`;

/* ---------- the page ---------- */

/** Makes the sheets of a centre zoom. host : what scrolls (the centre) ; o : { items : the selector of a sheet (« .sheet-view ») }.
    → { get(), set(z, about?), fit() } ; the bar puts itself back each time the centre is drawn anew. */
export function zoomPane(host, o = {}) {
  const items = o.items || ".sheet-view";
  let z = 1;
  const bar = document.createElement("div"); bar.className = "zoom-bar";
  const vb = viewBar({ label: "la feuille", zoomOut: () => set(zoomStep(z, -1)), zoomIn: () => set(zoomStep(z, 1)), fit: () => fit(), text: () => zoomText(z), fitTip: "Ajuster à la largeur (100 %). Ctrl + molette : zoom autour du pointeur ; glisser : déplacer la feuille" });
  bar.append(vb.node);
  const paint = () => { host.style.setProperty("--zoom", String(z)); host.classList.toggle("zoomed", z > 1.001); host.classList.toggle("zoomed-out", z < 0.999); vb.update(); };
  /* about : { x, y } on the page — the point that stays where it is ; the middle of the centre without it. The sheet under that
     point is followed : what is between the sheets (their titles, the margins) does not zoom */
  function set(next, about) {
    const z1 = clampZoom(next); if (Math.abs(z1 - z) < 1e-4) return;
    const hr = host.getBoundingClientRect(), at = about || { x: hr.left + host.clientWidth / 2, y: hr.top + host.clientHeight / 2 }, sheets = [...host.querySelectorAll(items)];
    const sheet = sheets.find((n) => at.y <= n.getBoundingClientRect().bottom) || sheets[sheets.length - 1], p = sheet ? pointIn(sheet.getBoundingClientRect(), at) : null;
    z = z1; paint();
    if (sheet) { const d = scrollBack(sheet.getBoundingClientRect(), p, at); host.scrollLeft += d.dx; host.scrollTop += d.dy; }
  }
  const fit = () => { z = 1; paint(); host.scrollLeft = 0; };
  const mount = () => { if (host.querySelector(items)) { if (bar.parentElement !== host || host.firstElementChild !== bar) host.prepend(bar); } else if (bar.parentElement) bar.remove(); };
  host.classList.add("zoom-host"); paint(); mount();
  new MutationObserver(mount).observe(host, { childList: true });      // the centre drawn anew : the bar comes back, the zoom stays
  host.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey) || !host.querySelector(items)) return;
    e.preventDefault(); set(zoomWheel(z, e.deltaY), { x: e.clientX, y: e.clientY });
  }, { passive: false });
  /* dragging the sheet moves it — only once the pointer has really moved, so that a click stays a click */
  let drag = null;
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !e.target.closest || !e.target.closest(items) || (host.scrollWidth <= host.clientWidth + 1 && host.scrollHeight <= host.clientHeight + 1)) return;
    drag = { x: e.clientX, y: e.clientY, left: host.scrollLeft, top: host.scrollTop, on: false, id: e.pointerId };
  });
  host.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (Math.hypot(dx, dy) < 5) return; drag.on = true; host.classList.add("panning"); try { host.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone */ } }
    host.scrollLeft = drag.left - dx; host.scrollTop = drag.top - dy;
  });
  const drop = (e) => { if (!drag || (e && e.pointerId !== drag.id)) return; const moved = drag.on; drag = null; host.classList.remove("panning");
    if (moved) { const eat = (c) => { c.stopPropagation(); c.preventDefault(); }; host.addEventListener("click", eat, { capture: true, once: true }); setTimeout(() => host.removeEventListener("click", eat, true), 0); } };
  host.addEventListener("pointerup", drop); host.addEventListener("pointercancel", drop);
  return { get: () => z, set, fit };
}
