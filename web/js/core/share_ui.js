/* DynamiteOrbit — « Partager », drawn (point 17, JP, 20 novembre 2026 : « Partager sur chaque artéfact — un lien vers l'élément, ou une
   version numérique choisie au clic »). One button, at the same place on every studio : the head of the left panel, right after « IA »
   (installed once, like the stairs : core/stairs_ui.js). It opens a menu : the link of the element ; the files the screen already makes, read
   from its own export buttons and grouped by nature (core/share.js) — a click there presses that button, so each file keeps its own making
   and its mark ; and, where the screen shows a 3D view, an animation of it (one turn, recorded : core/view_record.js). Nothing new is made
   here, nothing is sent anywhere : the files land on this computer, the link goes to the clipboard. The usage followed : the share sheet of
   desktop and web tools — a link first, then the formats. */

import { el, icon, toast } from "./dom.js";
import { shareGroups, shareLink, shareName } from "./share.js";

const EXPORT_ICONS = ["download", "pdf", "step", "export"];
/** The export buttons of the screen : those with a download, PDF, STEP or export pictogram, in the centre and the margins — not the menus. */
function exportButtons(main) {
  const sel = EXPORT_ICONS.map((n) => `button use[href$="#i-${n}"]`).join(", ");
  return [...main.querySelectorAll(sel)].map((u) => u.closest("button")).filter((b, i, all) => b && all.indexOf(b) === i && !b.disabled && !b.closest(".menu, .share-menu"))
    .map((b) => ({ label: (b.textContent || "").trim() || b.getAttribute("aria-label") || b.dataset.tip || "", tip: b.dataset.tip || b.getAttribute("aria-label") || "", ref: b }));
}
const viewOf = (main) => { const v = [...main.querySelectorAll(".viewport, .viewer, canvas")].map((n) => n.dwViewer || (n.parentElement && n.parentElement.dwViewer)).find(Boolean); return v && v.orbit ? v : null; };

function openMenu(anchor) {
  document.querySelectorAll(".share-menu").forEach((m) => m.remove());
  const main = document.getElementById("main"), what = shareName(location.hash), groups = shareGroups(exportButtons(main)), view = viewOf(main);
  const m = el("div", { class: "menu share-menu", role: "menu", "aria-label": `Partager ${what}` });
  const close = () => { m.remove(); document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc, true); };
  const away = (e) => { if (!m.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); anchor.focus(); } };
  const row = (ico, title, detail, run, color) => el("button", { class: "menu-item share-item", type: "button", role: "menuitem", "data-tip": detail, style: color ? { "--g": color } : null, onClick: () => { close(); run(); } },
    icon(ico), el("span", { class: "grow" }, el("b", null, title), detail ? el("small", null, detail) : null));
  m.append(el("div", { class: "menu-title" }, `Partager — ${what}`),
    row("link", "Copier le lien", "Il ouvre cet écran sur cet élément, dans le projet de qui l'a : vous plus tard, ou un membre de l'équipe qui en a le miroir", async () => {
      try { await navigator.clipboard.writeText(shareLink(location.href)); toast("Lien copié : il ouvre cet élément dans le projet de qui l'a.", "success"); }
      catch (e) { toast(`Copie refusée par le navigateur : le lien est ${location.href}`, "warn", 8000); } }));
  if (view) m.append(el("div", { class: "share-group", style: { "--g": "#be123c" } }, el("b", null, "Media"), el("small", null, "Vidéo de la vue")),
    row("play", "Animation : un tour de la vue (.webm)", "La vue fait un tour complet autour du Z, enregistré en vidéo avec la marque — pour une revue de conception", () => view.orbit.oneTurn(), "#be123c"));
  for (const g of groups) {
    m.append(el("div", { class: "share-group", style: { "--g": g.color } }, el("b", null, g.label), el("small", null, g.fr)));
    for (const it of g.items) m.append(row(it.format.icon, it.label, `${it.format.label}${it.tip && it.tip !== it.label ? ` — ${it.tip}` : ""}`, () => it.ref.click(), g.color));
  }
  if (!groups.length && !view) m.append(el("p", { class: "muted small share-none" }, "Cet écran n'a pas de fichier à lui ; le projet entier se télécharge par le menu Projet (.dwiz)."));
  const r = anchor.getBoundingClientRect(); Object.assign(m.style, { position: "fixed", left: `${Math.round(r.left)}px`, top: `${Math.round(r.bottom + 4)}px` });
  document.body.append(m); document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", esc, true);
  const first = m.querySelector("button"); if (first) first.focus();
}

/** The button, placed and kept at the head of the left panel of every studio, after « IA » (or after the step up). */
export function installShare() {
  let queued = false;
  const place = () => {
    queued = false; const main = document.getElementById("main"); if (!main) return;
    const side = [...main.querySelectorAll(".side-head")].find((h) => !h.closest(".side.right, .split.right")) || null;
    for (const old of main.querySelectorAll(".head-share")) if (old.parentElement !== side) old.remove();
    if (!side || side.querySelector(":scope > .head-share")) return;
    const tip = "Partager ce que l'écran montre : son lien, ou un des fichiers qu'il fait — STEP, PDF, Word, Gerber… — et, sur une vue 3D, une animation";
    const b = el("button", { class: "btn btn-small head-share", type: "button", "aria-label": tip, "data-tip": tip, "aria-haspopup": "menu", onClick: (e) => { e.stopPropagation(); openMenu(b); } }, icon("link"), el("span", null, "Partager"));
    const after = side.querySelector(":scope > .head-ai") || side.querySelector(":scope > .stair-btn:not(.down)") || side.querySelector(":scope > h2");
    if (after) after.after(b); else side.append(b);
  };
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", later); later();
}
