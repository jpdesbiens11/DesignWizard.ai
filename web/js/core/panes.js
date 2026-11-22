/* DesignOrbit.ai — the side panels of a studio. The border between a panel and the view is dragged to give the panel
   room ; a panel hides and comes back with one button, always in sight on its border (also : a double click or Enter
   on the border, Ctrl + B for the left panel). The widths and what is hidden are kept in the browser and SHARED by every
   screen : a panel widened in one module has the same width in the next. The studio lays itself out from --left-w and
   --right-w (app.css) : this module only moves those two lengths.
   Every panel of every page (demande de JP : « toutes les marges gauche droite des pages doivent pouvoir être cachées et redimensionnées ») :
   a studio gets its borders wherever it stands in the page — under a header of its own too — and a right panel that only appears later
   (a screen that opens on an empty state) gets its border when it comes. A new screen has nothing to declare : a `.studio` with its
   `aside.side`, and a `.side.right` for the right one. */

export const PANE = { min: 200, max: 760, left: 300, right: 340, view: 320, step: 24, key: "dw.panes", all: "*" };
const num = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
/** A width a panel may take : between the smallest that stays readable and what leaves `PANE.view` to the 3D view. */
export const clampPane = (w, room = Infinity) => Math.round(Math.max(PANE.min, Math.min(PANE.max, Math.max(PANE.min, room - PANE.view), num(w, PANE.min))));
/** The panels, read from what the browser kept (anything unreadable gives the defaults). One state for every screen ; what
    an earlier version kept for this screen alone (key) is taken once, as a start. */
export function readPanes(text, key) {
  let p = null;
  try { const all = JSON.parse(text || "{}"); p = all && typeof all === "object" && !Array.isArray(all) ? (all[PANE.all] || all[key]) : null; } catch (e) { p = null; }
  p = p && typeof p === "object" ? p : {};
  return { left: clampPane(num(p.left, PANE.left)), right: clampPane(num(p.right, PANE.right)), leftOff: !!p.leftOff, rightOff: !!p.rightOff };
}
/** The text to keep once the panels have changed : the one state every screen reads. */
export function writePanes(text, key, state) {
  return JSON.stringify({ [PANE.all]: { left: state.left, right: state.right, leftOff: !!state.leftOff, rightOff: !!state.rightOff } });
}
/** What a drag gives : a panel pulled under half its smallest width folds away, otherwise it takes the width, clamped. */
export function dragPane(state, side, width, room) {
  const off = `${side}Off`;
  return width < PANE.min / 2 ? { ...state, [off]: true } : { ...state, [off]: false, [side]: clampPane(width, room) };
}

/** True when a studio shows a right panel now : it has one, it is not hidden, and the studio is not said to go without. Pure enough to test. */
export const hasRightPane = (studio) => !!studio && !studio.classList.contains("no-right") && [...studio.children].some((c) => c.classList && c.classList.contains("side") && c.classList.contains("right") && !c.hidden);
/** Puts the two borders on a studio (once). key : the screen ; store : where the widths are kept. */
export function mountPanes(studio, key, store) {
  if (!studio || studio.dataset.panes) return; studio.dataset.panes = key;
  const keep = store || (typeof localStorage !== "undefined" ? localStorage : null), get = () => { try { return keep ? keep.getItem(PANE.key) : ""; } catch (e) { return ""; } };
  let st = readPanes(get(), key);
  let right = hasRightPane(studio);
  const handles = {};
  /* the widths are kept at the normal size of the display ; a larger display (the preferences) widens the panels with their text */
  const zoom = () => { try { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1; } catch (e) { return 1; } };
  const apply = (save) => {
    const k = zoom();
    studio.style.setProperty("--left-w", st.leftOff ? "0px" : `${Math.round(st.left * k)}px`); studio.classList.toggle("left-off", st.leftOff);
    if (right) { studio.style.setProperty("--right-w", st.rightOff ? "0px" : `${Math.round(st.right * k)}px`); studio.classList.toggle("right-off", st.rightOff); }
    for (const [side, h] of Object.entries(handles)) { const off = st[`${side}Off`], word = side === "left" ? "gauche" : "droite";
      h.b.textContent = (side === "left") === off ? "›" : "‹"; h.b.setAttribute("aria-label", `${off ? "Montrer" : "Masquer"} le panneau de ${word}`); h.b.dataset.tip = `${off ? "Montrer" : "Masquer"} le volet de ${word}${side === "left" ? " (Ctrl + B)" : ""} — glisser la bordure pour l'élargir : la largeur est gardée d'un écran à l'autre`; h.b.setAttribute("aria-pressed", off ? "false" : "true");
      h.el.setAttribute("aria-valuenow", String(off ? 0 : st[side])); }
    if (save && keep) { try { keep.setItem(PANE.key, writePanes(get(), key, st)); } catch (e) { /* a private window keeps nothing */ } }
  };
  const room = (side) => studio.getBoundingClientRect().width / zoom() - (side === "left" ? (right && !st.rightOff ? st.right : 0) : (st.leftOff ? 0 : st.left));
  const toggle = (side) => { st = { ...st, [`${side}Off`]: !st[`${side}Off`] }; apply(true); };
  const make = (side) => {
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
      const move = (ev) => { const r = studio.getBoundingClientRect(); st = dragPane(st, side, (side === "left" ? ev.clientX - r.left : r.right - ev.clientX) / zoom(), room(side)); apply(false); };
      const up = () => { h.classList.remove("drag"); studio.classList.remove("resizing"); h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); apply(true); };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
    studio.append(h);
  };
  make("left"); if (right) make("right");
  /* a right panel that comes later, or goes : its border follows (the screen changes a class of the studio, or its children) */
  const sync = () => { const now = hasRightPane(studio); if (now === right) return; right = now;
    if (right) make("right"); else if (handles.right) { handles.right.el.remove(); delete handles.right; studio.classList.remove("right-off"); studio.style.removeProperty("--right-w"); }
    apply(false); };
  if (typeof MutationObserver !== "undefined") new MutationObserver(sync).observe(studio, { attributes: true, attributeFilter: ["class"], childList: true });
  /* Ctrl + B : the left panel, from anywhere on the screen ; the listener goes away with the studio */
  const onKey = (e) => { if (!studio.isConnected) { window.removeEventListener("keydown", onKey); return; } if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === "b") { e.preventDefault(); toggle("left"); } };
  const onScale = () => { if (!studio.isConnected) { window.removeEventListener("dw:scale", onScale); return; } apply(false); };
  if (typeof window !== "undefined") { window.addEventListener("keydown", onKey); window.addEventListener("dw:scale", onScale); }
  apply(false);
}

/* ---------- the panel at the bottom of a centre (demande de JP : « redimensionner le panneau de mesure du bas central ») ----------
   What a centre shows under its view — the oscilloscopes of the Labo, the chronogram of the software — takes the height one drags its top
   edge to, and folds away with the button on that edge (also : a double click, or Enter, on the edge ; ↑ ↓ to change it from the keyboard).
   The height is kept in the browser, one per screen (`data-bottom`). A screen has nothing to declare but its structure : a `.bottom-pane`
   whose part that grows is its `.bottom-body` ; what is outside the body (a bar of controls) stays when the panel is folded.
   What it follows : the bottom panel of a development tool or a simulator, a splitter one drags. */
export const BOTTOM = { min: 90, start: 240, view: 140, key: "dw.bottom", step: 24 };
/** A height a bottom panel may take : not under its smallest, and leaving `BOTTOM.view` to the view above it. room : the height of the centre. */
export const clampBottom = (h, room = Infinity) => Math.round(Math.max(BOTTOM.min, Math.min(Math.max(BOTTOM.min, room - BOTTOM.view), Number.isFinite(h) && h > 0 ? h : BOTTOM.start)));
/** What the browser kept for a screen. → { h, off } */
export function readBottom(text, key) { let p = null; try { const all = JSON.parse(text || "{}"); p = all && typeof all === "object" && !Array.isArray(all) ? all[key] : null; } catch (e) { p = null; } p = p && typeof p === "object" ? p : {}; return { h: clampBottom(p.h), off: !!p.off }; }
export function writeBottom(text, key, state) { let all = {}; try { const j = JSON.parse(text || "{}"); if (j && typeof j === "object" && !Array.isArray(j)) all = j; } catch (e) { all = {}; } return JSON.stringify({ ...all, [key]: { h: state.h, off: !!state.off } }); }

/** Puts the edge on a bottom panel (once). The panel must be laid out in a column whose other part shrinks (flex : 1 ; min-height : 0). */
export function mountBottom(box, store) {
  if (!box || box.dataset.bottomOn) return; box.dataset.bottomOn = "1";
  const key = box.dataset.bottom || "*", keep = store || (typeof localStorage !== "undefined" ? localStorage : null), get = () => { try { return keep ? keep.getItem(BOTTOM.key) : ""; } catch (e) { return ""; } };
  let st = readBottom(get(), key);
  const h = document.createElement("div"), b = document.createElement("button");
  h.className = "hsplit"; h.tabIndex = 0; h.setAttribute("role", "separator"); h.setAttribute("aria-orientation", "horizontal"); h.setAttribute("aria-valuemin", String(BOTTOM.min));
  h.setAttribute("aria-label", "Bordure du panneau du bas : glisser pour le grandir, double clic pour le replier"); b.type = "button"; b.className = "hsplit-btn"; h.append(b); box.prepend(h);
  const room = () => { const p = box.parentElement; return p ? p.getBoundingClientRect().height : Infinity; };
  const apply = (save) => { box.style.setProperty("--bottom-h", `${st.h}px`); box.classList.toggle("folded", st.off); b.textContent = st.off ? "▴" : "▾";
    b.setAttribute("aria-label", st.off ? "Déplier le panneau du bas" : "Replier le panneau du bas"); b.dataset.tip = `${st.off ? "Déplier" : "Replier"} le panneau du bas — glisser la bordure pour le grandir : la hauteur est gardée pour cet écran`; h.setAttribute("aria-valuenow", String(st.off ? 0 : st.h));
    if (save && keep) { try { keep.setItem(BOTTOM.key, writeBottom(get(), key, st)); } catch (e) { /* a private window keeps nothing */ } } };
  const toggle = () => { st = { ...st, off: !st.off }; apply(true); };
  b.addEventListener("click", (e) => { e.stopPropagation(); toggle(); }); b.addEventListener("pointerdown", (e) => e.stopPropagation());
  h.addEventListener("dblclick", toggle);
  h.addEventListener("keydown", (e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { st = { off: false, h: clampBottom((st.off ? BOTTOM.min : st.h) + (e.key === "ArrowUp" ? BOTTOM.step : -BOTTOM.step), room()) }; apply(true); e.preventDefault(); } else if (e.key === "Enter" || e.key === " ") { toggle(); e.preventDefault(); } });
  h.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; h.setPointerCapture(e.pointerId); h.classList.add("drag"); document.documentElement.classList.add("resizing-v"); e.preventDefault();
    const y0 = e.clientY, h0 = st.off ? 0 : st.h;      // the edge follows the pointer from where it was taken : no jump
    const move = (ev) => { const want = h0 + (y0 - ev.clientY); st = want < BOTTOM.min / 2 ? { ...st, off: true } : { off: false, h: clampBottom(want, room()) }; apply(false); };
    const up = () => { h.classList.remove("drag"); document.documentElement.classList.remove("resizing-v"); h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); apply(true); };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  });
  apply(false);
}
