/* DynamiteOrbit.ai — where am I, drawn (core/where.js says what, core/tower.js how it stands) : two short lines right under the head
   of every left panel — the project, then the part, assembly, board, sheet… that the screen shows — and a flap that opens the
   launch tower : the project at the foot, the assemblies that hold the artefact, the artefact, the screen at the top where the
   rocket is ; each floor a link, each with what the guide finds on it. Installed once : a screen declares nothing, it only needs a
   left panel with a `.side-head`. The flap stays open or closed from one screen to the next (dw.tower). */

import { el, icon } from "./dom.js";
import { store } from "./store.js";
import { addressOf } from "./stairs.js";
import { whereOf } from "./where.js";
import { towerOf } from "./tower.js";
import { projectIssues } from "./guide_checks.js";

const KEY = "dw.tower";
const isOpen = () => { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
const LIGHT = { error: ["à corriger", "bad"], todo: ["à entrer", "bad"], warn: ["à vérifier", "warn"], tip: ["conseil", "tip"] };

function towerBox(floors) {
  const rows = [...floors].reverse().map((f) => {
    const L = f.light && LIGHT[f.light], tag = f.here ? el("span", { class: "tw-here" }, icon("wizard"), "ici") : null;
    const body = [el("span", { class: "tw-dot" }, icon(f.icon)), el("span", { class: "tw-text" }, el("small", null, f.kind), el("b", null, f.label), f.id && f.id !== f.label ? el("code", null, f.id) : null),
      L ? el("span", { class: `tw-light ${L[1]}`, "data-tip": `Guide : ${f.count ? `${f.count} point${f.count > 1 ? "s" : ""}, le plus sérieux ` : ""}« ${L[0]} »` }, f.count ? String(f.count) : "") : null, tag];
    const cls = "tw-floor" + (f.here ? " here" : "") + (f.pad ? " pad" : "") + (f.screen ? " screen" : "");
    return f.here || !f.hash ? el("div", { class: cls, "aria-current": f.here ? "location" : null }, ...body) : el("a", { class: cls, href: f.hash, "data-tip": `Aller à : ${f.label}` }, ...body);
  });
  return el("nav", { class: "tower", "aria-label": "Tour de lancement : où cet écran se tient dans le produit" }, ...rows);
}

export function installWhere() {
  let queued = false;
  function place() {
    queued = false; const m = document.getElementById("main"); if (!m) return;
    const side = [...m.querySelectorAll(".side-head")].find((h) => !h.closest(".side.right, .split.right")) || null;
    const { key, args } = addressOf(location.hash), w = side ? whereOf(key, args, store.project) : null, open = isOpen();
    const screen = String(document.title || "").split(" · ")[0];
    const floors = w && open ? towerOf(key, args, store.project, { issues: projectIssues(store.project), screen, hash: location.hash }) : null;
    const sig = w ? [w.project, w.kind, w.name, w.id, open ? "o" : "c", floors ? JSON.stringify(floors) : ""].join("|") : "";
    for (const old of m.querySelectorAll(".where-line")) if (!w || old.previousElementSibling !== side || old.dataset.sig !== sig) old.remove();
    if (!w || (side.nextElementSibling && side.nextElementSibling.classList.contains("where-line"))) return;
    const tip = `Vous êtes dans le projet « ${w.project} »${w.name ? `, ${w.kind.toLowerCase()} « ${w.name} »` : ""}`;
    const flap = el("button", { class: "where-flap", type: "button", "aria-expanded": open ? "true" : "false", "data-tip": open ? "Replier la tour de lancement" : "Ouvrir la tour de lancement : où cet écran se tient dans le produit, du projet jusqu'ici",
      onClick: () => { try { localStorage.setItem(KEY, open ? "0" : "1"); } catch (e) { /* private window */ } later(); } }, icon("wizard"), el("span", null, "Tour"), icon("chevron-down", "where-chev"));
    side.after(el("div", { class: "where-line" + (open ? " open" : ""), "data-sig": sig, role: "note", "aria-label": tip },
      el("div", { class: "where-top" }, el("a", { class: "where-project", href: "#/shop", "data-tip": tip }, icon("folder"), el("span", null, w.project)), flap),
      w.name ? el("span", { class: "where-what" }, icon(w.icon || "part"), el("small", null, w.kind), el("b", null, w.name), w.id ? el("code", null, w.id) : null) : null,
      floors ? towerBox(floors) : null));
  }
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  new MutationObserver(later).observe(document.getElementById("main") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", later); store.on("change", later); store.on("project", later);
  later();
}
