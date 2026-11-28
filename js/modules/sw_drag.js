/* DynamiteOrbit.ai — Logiciel : a window that floats over the page moves by its title bar, as any window does (JP, 25 novembre 2026 : « la
   fenêtre de charge et équilibrage ne peut être déplacée avec la souris »). One helper for the monitoring and the charge windows : the bar
   takes the pointer (not its buttons), the window stays inside the page, and its place is kept by the browser under `key`. */

const kept = (key) => { try { const p = JSON.parse(localStorage.getItem(key) || "null"); return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null; } catch (e) { return null; } };
/** win : the window ; bar : what one takes it by ; key : where its place is kept. → { place(p), restore(fallback) } */
export function dragWindow(win, bar, key) {
  const place = (p) => { const w = win.offsetWidth || 400; win.style.left = `${Math.max(0, Math.min(window.innerWidth - Math.min(w, 120), p.x))}px`; win.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, p.y))}px`; };
  bar.style.cursor = "move";
  bar.addEventListener("pointerdown", (e) => { if (e.button !== 0 || win.classList.contains("docked") || e.target.closest("button, input, select, a")) return; e.preventDefault();
    const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; bar.setPointerCapture(e.pointerId);
    const move = (m) => place({ x: m.clientX - dx, y: m.clientY - dy });
    const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up); try { localStorage.setItem(key, JSON.stringify({ x: win.offsetLeft, y: win.offsetTop })); } catch (err) { /* the place holds until the page is left */ } };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up); });
  return { place, restore: (fallback) => place(kept(key) || fallback) };
}

/* DOCKED over a side pane (JP, 26 novembre 2026 : « monitoring du swap pan de droite quand ouvert svp, et l'autre pan de gauche — les deux avec
   des x dans le coin top-droit pour fermer et revenir à l'affichage de ses pans ») : the window covers the pane exactly — it follows the pane when
   its border is dragged or the page resized —, and closing it shows the pane again, untouched underneath (the pane is never emptied : a screen
   that redraws its panel loses nothing). A pane hidden or too narrow : the window floats, as before. What it follows : a docked tool window. */
const paneOf = (side) => [...document.querySelectorAll(`.studio aside.side${side === "right" ? ".right" : ":not(.right)"}`)].find((a) => a.offsetWidth > 200 && a.offsetHeight > 200) || null;
/** → { on() : true when docked, off() } */
/* a pane the person HID (JP, 28 novembre 2026 : « remettre une marge droite où charge et équilibrage sont incrustés lorsque ce volet est ouvert ») : the
   window opens it again, by the button of its border (core/panes.js : the same state as a click), and folds it back when it closes */
const hiddenPane = (side) => { const s = [...document.querySelectorAll(`.studio.${side}-off`)].find((x) => x.querySelector(`:scope > aside.side${side === "right" ? ".right" : ":not(.right)"}`)); return s ? { studio: s, btn: s.querySelector(`:scope > .split.${side} .split-btn`) } : null; };
export function dockOver(win, side) {
  let pane = null, ro = null, opened = null; const fit = () => { if (!pane || !pane.isConnected) return; const r = pane.getBoundingClientRect(); Object.assign(win.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }); };
  return {
    on() { pane = paneOf(side);
      if (!pane) { const h = hiddenPane(side); if (h && h.btn) { h.btn.click(); opened = h; pane = h.studio.querySelector(`:scope > aside.side${side === "right" ? ".right" : ":not(.right)"}`); } }
      if (!pane) return false; win.classList.add("docked", `docked-${side}`); fit(); ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null; if (ro) ro.observe(pane); window.addEventListener("resize", fit); return true; },
    off() { if (ro) ro.disconnect(); ro = null; window.removeEventListener("resize", fit); if (pane) { win.classList.remove("docked", `docked-${side}`); for (const k of ["width", "height"]) win.style[k] = ""; } pane = null;
      if (opened && opened.studio.isConnected && !opened.studio.classList.contains(`${side}-off`) && opened.btn) opened.btn.click(); opened = null; },      // hidden before : hidden again
    get docked() { return !!pane; },
  };
}
