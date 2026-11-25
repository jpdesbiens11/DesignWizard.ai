/* DynamiteOrbit.ai — Logiciel : a window that floats over the page moves by its title bar, as any window does (JP, 25 novembre 2026 : « la
   fenêtre de charge et équilibrage ne peut être déplacée avec la souris »). One helper for the monitoring and the charge windows : the bar
   takes the pointer (not its buttons), the window stays inside the page, and its place is kept by the browser under `key`. */

const kept = (key) => { try { const p = JSON.parse(localStorage.getItem(key) || "null"); return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null; } catch (e) { return null; } };
/** win : the window ; bar : what one takes it by ; key : where its place is kept. → { place(p), restore(fallback) } */
export function dragWindow(win, bar, key) {
  const place = (p) => { const w = win.offsetWidth || 400; win.style.left = `${Math.max(0, Math.min(window.innerWidth - Math.min(w, 120), p.x))}px`; win.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, p.y))}px`; };
  bar.style.cursor = "move";
  bar.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.target.closest("button, input, select, a")) return; e.preventDefault();
    const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; bar.setPointerCapture(e.pointerId);
    const move = (m) => place({ x: m.clientX - dx, y: m.clientY - dy });
    const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up); try { localStorage.setItem(key, JSON.stringify({ x: win.offsetLeft, y: win.offsetTop })); } catch (err) { /* the place holds until the page is left */ } };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up); });
  return { place, restore: (fallback) => place(kept(key) || fallback) };
}
