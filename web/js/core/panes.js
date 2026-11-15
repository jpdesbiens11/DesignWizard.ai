/* DesignWizard.ai — the side panels of a studio. The border between a panel and the view is dragged to give the panel
   room ; a panel folds away and comes back (the button on the border, a double click, or Enter on the border). Each
   screen remembers its own widths in the browser. The studio lays itself out from --left-w and --right-w (app.css) :
   this module only moves those two lengths. */

export const PANE = { min: 200, max: 760, left: 300, right: 340, view: 320, step: 24, key: "dw.panes" };
const num = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
/** A width a panel may take : between the smallest that stays readable and what leaves `PANE.view` to the 3D view. */
export const clampPane = (w, room = Infinity) => Math.round(Math.max(PANE.min, Math.min(PANE.max, Math.max(PANE.min, room - PANE.view), num(w, PANE.min))));
/** The panels of a screen, read from what the browser kept (anything unreadable gives the defaults). */
export function readPanes(text, key) {
  let p = null;
  try { const all = JSON.parse(text || "{}"); p = all && typeof all === "object" ? all[key] : null; } catch (e) { p = null; }
  p = p && typeof p === "object" ? p : {};
  return { left: clampPane(num(p.left, PANE.left)), right: clampPane(num(p.right, PANE.right)), leftOff: !!p.leftOff, rightOff: !!p.rightOff };
}
/** The text to keep once a screen has changed its panels. */
export function writePanes(text, key, state) {
  let all = {};
  try { const x = JSON.parse(text || "{}"); if (x && typeof x === "object" && !Array.isArray(x)) all = x; } catch (e) { all = {}; }
  all[key] = { left: state.left, right: state.right, leftOff: !!state.leftOff, rightOff: !!state.rightOff };
  return JSON.stringify(all);
}
/** What a drag gives : a panel pulled under half its smallest width folds away, otherwise it takes the width, clamped. */
export function dragPane(state, side, width, room) {
  const off = `${side}Off`;
  return width < PANE.min / 2 ? { ...state, [off]: true } : { ...state, [off]: false, [side]: clampPane(width, room) };
}

/** Puts the two borders on a studio (once). key : the screen ; store : where the widths are kept. */
export function mountPanes(studio, key, store) {
  if (!studio || studio.dataset.panes) return; studio.dataset.panes = key;
  const keep = store || (typeof localStorage !== "undefined" ? localStorage : null), get = () => { try { return keep ? keep.getItem(PANE.key) : ""; } catch (e) { return ""; } };
  let st = readPanes(get(), key);
  const right = !studio.classList.contains("no-right") && [...studio.children].some((c) => c.classList && c.classList.contains("side") && c.classList.contains("right"));
  const handles = {};
  const apply = (save) => {
    studio.style.setProperty("--left-w", st.leftOff ? "0px" : `${st.left}px`); studio.classList.toggle("left-off", st.leftOff);
    if (right) { studio.style.setProperty("--right-w", st.rightOff ? "0px" : `${st.right}px`); studio.classList.toggle("right-off", st.rightOff); }
    for (const [side, h] of Object.entries(handles)) { const off = st[`${side}Off`], word = side === "left" ? "gauche" : "droite";
      h.b.textContent = (side === "left") === off ? "›" : "‹"; h.b.setAttribute("aria-label", `${off ? "Montrer" : "Masquer"} le panneau de ${word}`); h.b.dataset.tip = off ? "Montrer le panneau" : "Masquer le panneau (double clic sur la bordure)";
      h.el.setAttribute("aria-valuenow", String(off ? 0 : st[side])); }
    if (save && keep) { try { keep.setItem(PANE.key, writePanes(get(), key, st)); } catch (e) { /* a private window keeps nothing */ } }
  };
  const room = (side) => studio.getBoundingClientRect().width - (side === "left" ? (right && !st.rightOff ? st.right : 0) : (st.leftOff ? 0 : st.left));
  const toggle = (side) => { st = { ...st, [`${side}Off`]: !st[`${side}Off`] }; apply(true); };
  for (const side of right ? ["left", "right"] : ["left"]) {
    const h = document.createElement("div"), b = document.createElement("button");
    h.className = `split ${side}`; h.tabIndex = 0; h.setAttribute("role", "separator"); h.setAttribute("aria-orientation", "vertical"); h.setAttribute("aria-valuemin", "0"); h.setAttribute("aria-valuemax", String(PANE.max));
    h.setAttribute("aria-label", `Bordure du panneau de ${side === "left" ? "gauche" : "droite"} : glisser pour l'élargir, double clic pour le masquer`);
    b.type = "button"; b.className = "split-btn"; h.append(b); handles[side] = { el: h, b };
    b.addEventListener("click", (e) => { e.stopPropagation(); toggle(side); }); b.addEventListener("pointerdown", (e) => e.stopPropagation());
    h.addEventListener("dblclick", () => toggle(side));
    h.addEventListener("keydown", (e) => {
      const grow = (side === "left") === (e.key === "ArrowRight");
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { st = dragPane(st, side, (st[`${side}Off`] ? 0 : st[side]) + (grow ? PANE.step : -PANE.step), room(side)); apply(true); e.preventDefault(); }
      else if (e.key === "Enter" || e.key === " ") { toggle(side); e.preventDefault(); }
    });
    h.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      h.setPointerCapture(e.pointerId); h.classList.add("drag"); studio.classList.add("resizing"); e.preventDefault();
      const move = (ev) => { const r = studio.getBoundingClientRect(); st = dragPane(st, side, side === "left" ? ev.clientX - r.left : r.right - ev.clientX, room(side)); apply(false); };
      const up = () => { h.classList.remove("drag"); studio.classList.remove("resizing"); h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); apply(true); };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
    studio.append(h);
  }
  apply(false);
}
