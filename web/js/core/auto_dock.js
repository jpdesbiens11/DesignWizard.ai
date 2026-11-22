/* DesignWizard.ai — where the panel of the automatic rotation stands (point 17, JP, 20 novembre 2026 : « le menu de rotation automatique se
   déplace — une poignée — ou se range en onglet de la marge de droite, montrer / cacher »). The usage followed : a floating tool palette of
   the desktop tools — dragged by its title bar, docked into the side panel by a button, undocked by the same button. Where it stands is kept
   in this browser (dw.auto.place) : the next rotation opens where the last one was left. The right margin shows and hides as every margin
   does (core/panes.js). Mechanism : mountAutoDock(panel, head, viewer) — once per panel ; placeOf / clampPlace are pure. */

const KEY = "dw.auto.place";

/** A place, put in order : { dock: true } or { x, y } (pixels from the top left of the view), or null when nothing usable is kept. */
export function placeOf(raw) {
  let p = raw; if (typeof raw === "string") { try { p = JSON.parse(raw); } catch (e) { return null; } }
  if (!p || typeof p !== "object") return null;
  if (p.dock === true) return { dock: true };
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
}
/** A floating place kept inside the view : the panel stays whole on screen (8 px from every edge). view, size : { w, h } → { x, y } */
export function clampPlace(p, view, size) {
  const m = 8, x = Math.min(Math.max(m, p.x), Math.max(m, view.w - size.w - m)), y = Math.min(Math.max(m, p.y), Math.max(m, view.h - size.h - m));
  return { x: Math.round(x), y: Math.round(y) };
}
const read = () => { try { return placeOf(localStorage.getItem(KEY)); } catch (e) { return null; } };
const keep = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* a private window : kept for this visit */ } };
/** The right margin of the studio that holds the view, if it has one. */
const marginOf = (viewer) => { const s = viewer.el.closest(".studio") || document; return s.querySelector("aside.side.right"); };

/** Makes the panel movable by its head and dockable into the right margin. dockBtn : the button that docks / undocks it. */
export function mountAutoDock(panel, head, viewer, dockBtn) {
  const paint = (docked) => { dockBtn.textContent = docked ? "⇤" : "⇥"; const tip = docked ? "Remettre la rotation dans la vue, où on la déplace par sa poignée" : "Ranger la rotation dans la marge de droite — elle s'y montre et s'y cache avec la marge";
    dockBtn.setAttribute("aria-label", tip); dockBtn.dataset.tip = tip; dockBtn.setAttribute("aria-pressed", docked ? "true" : "false"); };
  const float = (p) => { panel.classList.remove("docked"); if (panel.parentElement !== viewer.el) viewer.el.append(panel);
    const v = { w: viewer.el.clientWidth, h: viewer.el.clientHeight }, s = { w: panel.offsetWidth || 196, h: panel.offsetHeight || 200 };
    if (p) { const q = clampPlace(p, v, s); Object.assign(panel.style, { left: `${q.x}px`, top: `${q.y}px`, right: "auto", bottom: "auto" }); panel.dataset.placed = "1"; } else delete panel.dataset.placed; paint(false); };      // placed : the view no longer moves it beside the pivot
  const dock = () => { const m = marginOf(viewer); if (!m) return false; panel.classList.add("docked"); Object.assign(panel.style, { left: "", top: "", right: "", bottom: "" });
    const headOf = m.querySelector(":scope > .side-head"); if (headOf) headOf.after(panel); else m.prepend(panel); panel.dataset.placed = "1"; paint(true); return true; };
  const start = read();
  if (start && start.dock && !dock()) float(null); else if (start && !start.dock) float(start); else paint(false);
  dockBtn.addEventListener("click", () => { if (panel.classList.contains("docked")) { float({ x: 12, y: 12 }); keep({ x: 12, y: 12 }); } else if (dock()) keep({ dock: true }); });
  /* the head is the grip : a drag from it moves the panel ; a press on one of its buttons stays a press */
  head.addEventListener("pointerdown", (e) => {
    if (panel.classList.contains("docked") || e.button !== 0 || e.target.closest("button")) return;
    const r = panel.getBoundingClientRect(), v = viewer.el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; head.setPointerCapture(e.pointerId); e.preventDefault();
    const move = (ev) => float({ x: ev.clientX - v.left - dx, y: ev.clientY - v.top - dy });
    const up = (ev) => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); const q = panel.getBoundingClientRect(); keep({ x: q.left - v.left, y: q.top - v.top }); void ev; };
    head.addEventListener("pointermove", move); head.addEventListener("pointerup", up);
  });
}
