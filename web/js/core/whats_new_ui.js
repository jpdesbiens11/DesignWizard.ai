/* DesignOrbit.ai — what is new, shown on the screens (core/whats_new.js holds the lines and the review). Installed once :
   the element a line names carries a small mark, « Nouveau », until the line is ticked « vu » (JP, 23 novembre, par menu :
   « Vu = disparaît ») — the tick stays in the list, it is the trace of the review ; untick it and the mark comes back. A button of the top bar says how many lines are left and opens their list : « Montrer » leads to the
   element, the box ticks the line, « Passer à une nouvelle revue » puts the marks away until the next version.
   The marks live in one layer above the page, placed from where the elements are : nothing is added inside a screen, so no
   layout can be disturbed, and a screen declares nothing. A mark shows only when its element can be seen — not under a
   dialog, not scrolled away. The usage it follows : the « new » badge of an application after an update, and the checklist
   of a review. */

import { el, icon, btn, modal } from "./dom.js";
import { nudge } from "./guide.js";
import { NEWS, getReview, setReview, reviewLines, byVersion, reviewCount, markSeen, nextReview, previousReview } from "./whats_new.js";

let running = "0.0.0", layer = null, queued = false, button = null, panel = null;
const lines = () => reviewLines(getReview(running), running);
const find = (sel) => { for (const n of document.querySelectorAll(sel)) if (!n.closest("#news-layer, .news-panel")) return n; return null; };
const later = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
function shown(node, r) {
  if (!(r.width > 0 && r.height > 0) || r.bottom < 4 || r.top > innerHeight - 4 || r.right < 4 || r.left > innerWidth - 4) return false;
  const x = Math.min(innerWidth - 2, Math.max(2, r.left + Math.min(r.width / 2, 40))), y = Math.min(innerHeight - 2, Math.max(2, r.top + Math.min(r.height / 2, 14))), hit = document.elementsFromPoint(x, y).find((e) => !e.closest("#news-layer"));      // the mark itself is not the element : a mark over a small element would hide it, then show it again — it flickered (JP, 23 novembre)
  return !!hit && (node.contains(hit) || hit.contains(node));
}
function draw() {
  queued = false; if (!layer) return;
  const want = new Map();
  for (const n of lines()) { if (n.seen || n.noMark) continue; const node = find(n.sel); if (!node) continue; const r = node.getBoundingClientRect(); if (shown(node, r)) want.set(n.id, { n, r }); }
  for (const f of [...layer.children]) if (!want.has(f.dataset.news)) f.remove();
  for (const [id, { n, r }] of want) {
    let f = layer.querySelector(`[data-news="${id}"]`);
    if (!f) { f = el("button", { class: "new-flag", type: "button", "data-news": id, onClick: () => openNews(id) }); layer.append(f); }
    if (f.textContent !== "Nouveau") f.textContent = "Nouveau";      // a line ticked « vu » has no mark : its tick in the list is the trace
    f.setAttribute("aria-label", `Nouveau, version ${n.v} : ${n.title}`); f.dataset.tip = `${n.title} — v${n.v}. Un clic ouvre la liste des nouveautés à revoir.`;
    f.style.left = `${Math.round(Math.max(2, Math.min(innerWidth - 74, r.left - 6)))}px`; f.style.top = `${Math.round(Math.max(2, r.top - 11))}px`;
  }
  refreshButton();
}
function refreshButton() {
  if (!button || !button.isConnected) return;
  const c = reviewCount(lines()); button.hidden = !c.total; const badge = button.querySelector(".news-count");
  if (badge && badge.textContent !== String(c.left)) badge.textContent = String(c.left);
  if (badge) badge.hidden = !c.left; button.classList.toggle("done", !!c.total && !c.left);
  button.dataset.tip = c.total ? `Nouveautés à revoir : ${c.text}. Chaque nouveauté porte une marque à l'écran ; la liste y mène.` : "";
}
const write = (review) => { setReview(review, running); };

function lineRow(n, close) {
  const box = el("input", { type: "checkbox", checked: !!n.seen, "aria-label": `Vu : ${n.title}`, onChange: (e) => { write(markSeen(getReview(running), n.id, e.target.checked)); later(); } });
  const show = n.where ? btn("Montrer", () => { close(); if (location.hash !== n.where) location.hash = n.where; setTimeout(() => { const node = find(n.sel); if (node) nudge(node); }, 900); }, { small: true, icon: "eye", tip: "Ouvrir l'écran et montrer l'élément" }) : null;
  return el("div", { class: `news-line${n.seen ? " seen" : ""}`, "data-line": n.id }, el("label", { class: "news-seen", "data-tip": "Cocher une fois vu : la marque quitte l'écran, la coche reste ici pour la trace ; décocher la fait revenir" }, box, el("span", null, "vu")),
    el("div", { class: "grow" }, el("b", null, n.title), el("p", null, n.text), n.how ? el("small", { class: "muted" }, n.how) : null), show);
}
function panelBody(close, focus) {
  const host = el("div", { class: "news-panel" });
  const fill = () => {
    const R = getReview(running), L = lines(), c = reviewCount(L);
    host.replaceChildren(el("p", { class: "muted" }, `Ce qui a changé à l'écran depuis la version ${R.base}. Chaque ligne a sa marque sur l'élément lui-même ; cocher « vu » l'enlève de l'écran, la coche reste ici pour la trace. « Passer à une nouvelle revue » range la liste.`),
      el("div", { class: "news-bar" }, el("b", null, c.text), el("span", { class: "grow" }),
        L.length ? btn("Passer à une nouvelle revue", () => { write(nextReview(getReview(running), running)); fill(); }, { small: true, primary: !c.left, icon: "check", tip: "Range les marques de cette revue : la prochaine version apportera les siennes. La revue rangée se rouvre d'ici" }) : null,
        R.before ? btn(`Rouvrir la revue depuis la ${R.before.base}`, () => { write(previousReview(getReview(running))); fill(); }, { small: true, icon: "undo", tip: "Remet les marques et les coches de la revue précédente" }) : null),
      ...(L.length ? byVersion(L).map((g) => el("section", { class: "news-version" }, el("h3", null, `Version ${g.v}`), g.lines.map((n) => lineRow(n, close)))) : [el("p", { class: "muted" }, "Rien à revoir : la prochaine version apportera ses marques.")]),
      el("p", { class: "muted small" }, "Toutes les versions : ", el("a", { href: "#/help/news", onClick: () => close() }, "Aide → Nouveautés"), "."));
    if (focus) { const node = host.querySelector(`[data-line="${focus}"]`); if (node) setTimeout(() => nudge(node), 60); focus = null; }
  };
  fill(); const on = () => { if (host.isConnected) fill(); else window.removeEventListener("dw:news", on); }; window.addEventListener("dw:news", on);
  return host;
}
/** Opens the list of what is new ; id : a line to show first. */
export function openNews(id = "") {
  if (panel && panel.isConnected) return;
  let close = () => {}; const body = panelBody(() => close(), id), m = modal("Nouveautés à revoir", body, { wide: true });
  panel = body; close = (m && m.close) || (() => { const b = body.closest(".modal-backdrop"); if (b) b.remove(); });
}
/** The button of the top bar : shown while a review has lines. */
export function newsButton() {
  button = el("button", { class: "btn btn-small news-btn", id: "news-btn", type: "button", hidden: true, "aria-label": "Nouveautés à revoir", onClick: () => openNews() }, icon("star"), el("span", { class: "news-count" }, "0"));
  setTimeout(refreshButton, 0); return button;
}
/** Starts marking the page. o.running : the version that runs. */
export function installWhatsNew(o = {}) {
  running = o.running || running;
  layer = el("div", { id: "news-layer", "aria-live": "off" }); document.body.append(layer);
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("scroll", later, { capture: true, passive: true }); window.addEventListener("resize", later); window.addEventListener("hashchange", later); window.addEventListener("dw:news", later);
  setInterval(later, 1500);                                               // a panel that slides or a view that settles moves an element without changing the page
  later();
}
/** The card of the Help : every line, version by version, and where the review stands. */
export function newsCard(open = false) {
  const card = el("section", { class: "card news-card", id: "news", style: { marginBottom: "1rem" } }, el("h2", null, "Nouveautés, version par version"),
    el("p", { class: "muted" }, "Ce que chaque version a changé à l'écran. Pendant une revue, chaque ligne publiée depuis sa version de départ porte une marque sur l'élément lui-même ; le bouton à l'étoile de la barre du haut en tient la liste."),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Ouvrir la revue en cours", () => openNews(), { small: true, icon: "star" })),
    byVersion(NEWS.map((n) => ({ ...n, seen: "" }))).map((g) => el("section", { class: "news-version" }, el("h3", null, `Version ${g.v}`), g.lines.map((n) => el("div", { class: "news-line" }, el("div", { class: "grow" }, el("b", null, n.title), el("p", null, n.text), n.how ? el("small", { class: "muted" }, n.how) : null), n.where ? el("a", { class: "btn btn-small", href: n.where }, icon("chevron-right"), "Ouvrir") : null)))));
  if (open) setTimeout(() => card.scrollIntoView && card.scrollIntoView({ block: "start" }), 0);
  return card;
}
