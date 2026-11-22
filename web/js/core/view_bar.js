/* DynamiteOrbit — the small bar of a view that zooms (demande de JP : « pan, zoom, ajuster à la fenêtre, loupe… enlever la loupe du menu
   du haut, ça n'a pas d'affaire là ») : ONE bar for every artefact at the centre of a page — a drawing, a board, the tiles of the software —
   in its top right corner : − [the zoom] + · Ajuster · Loupe. The percentage brings the view back to its true size (100 %), « Ajuster »
   fits the whole in the window, the magnifier (core/loupe.js) is turned on beside the zoom of the view it is used on.
   What it follows : the zoom controls of drawing and diagram tools (minus, percentage, plus, fit), the magnifier of a document viewer.
   A view that zooms gives its own functions ; the bar draws nothing else. */

import { el, icon } from "./dom.js";
import { loupeButton } from "./loupe.js";

/** o : { label (what zooms, for a screen reader), zoomOut(), zoomIn(), fit(), actual() (true size ; absent : the percentage fits too),
    text() → « 100 % », fitTip } → { node, update() } — call update() when the zoom changed */
export function viewBar(o) {
  const b = (label, tip, ico, run, data) => el("button", { type: "button", class: "icon-btn", "aria-label": label, "data-tip": tip, ...(data || {}), onClick: (e) => { e.stopPropagation(); run(); } }, icon(ico));
  const pct = el("button", { type: "button", class: "zoom-pct", "data-view-pct": "", "data-tip": o.actual ? "Taille réelle (100 %)" : "Ajuster à la fenêtre", onClick: (e) => { e.stopPropagation(); (o.actual || o.fit)(); } });
  const node = el("div", { class: "view-bar zoom-pill", role: "group", "aria-label": `Zoom — ${o.label || "la vue"}`, "data-view-bar": "", onPointerdown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation() },
    b("Réduire", "Réduire (molette vers soi)", "minus", o.zoomOut, { "data-view-out": "" }), pct, b("Agrandir", "Agrandir (molette vers l'avant)", "plus", o.zoomIn, { "data-view-in": "" }),
    el("span", { class: "view-sep", "aria-hidden": "true" }), b("Ajuster à la fenêtre", o.fitTip || "Ajuster à la fenêtre : tout se voit", "fit", o.fit, { "data-view-fit": "" }), loupeButton({ compact: true }));
  const update = () => { const t = o.text ? o.text() : ""; pct.textContent = t; pct.setAttribute("aria-label", `Zoom ${t} — ${o.actual ? "taille réelle" : "ajuster"}`); };
  update();
  return { node, update };
}

/** A view that shows a page of `box` (w × h, in units of the page) in a window of W × H pixels, all of it, with `m` pixels around :
    → { x, y, z } — z pixels per unit, (x, y) the corner of the page shown. Never above `max` (a few tiles are not blown up), never under `min`. */
export function fitView(W, H, box, m = 24, max = 1.4, min = 0.15) {
  const z = Math.max(min, Math.min(max, (W - 2 * m) / Math.max(1, box.w), (H - 2 * m) / Math.max(1, box.h)));
  return { x: -(W / z - box.w) / 2, y: -(H / z - box.h) / 2, z };
}
/** Zoom k times about the pixel (ax, ay) of the window : the point of the page under it stays under it. → { x, y, z } within [min, max] */
export function zoomView(v, k, ax, ay, min = 0.15, max = 4) {
  const ux = v.x + ax / v.z, uy = v.y + ay / v.z, z = Math.max(min, Math.min(max, v.z * k));
  return { x: ux - ax / z, y: uy - ay / z, z };
}
