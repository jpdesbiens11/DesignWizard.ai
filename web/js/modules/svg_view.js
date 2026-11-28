/* DynamiteOrbit.ai — a page drawn in SVG that pans and zooms like every 2D view of the tool (core/view_bar.js) : the wheel zooms about the
   pointer, a drag of the background pans (a click without a drag reaches what is under it), the bar of the view gives − % + · Ajuster · Loupe.
   The page opens fitted, and fits again when the window changes size while one has not zoomed nor moved it.
   Used by the tree of the history (history_tree.js) and the map of the ecosystem (eco_map.js). Draws nothing of its own. */

import { viewBar, fitView, zoomView } from "../core/view_bar.js";

const NS = "http://www.w3.org/2000/svg";
/** host : the box ; o : { label (what is shown, for a screen reader), cls, data (an attribute name set on the svg), fitTip, maxFit (the zoom
    « Ajuster » does not exceed), grab (a selector : what a drag must NOT start on — the things one clicks), tall () → "top" | "bottom" | null (a page taller than the window opens
    fitted to its width, at that end) } → { svg, setBox(w, h), fit(), reveal(y0, y1), destroy() } */
export function svgView(host, o = {}) {
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", o.cls || ""); svg.setAttribute("role", "group"); svg.setAttribute("aria-label", o.label || "Vue");
  if (o.data) svg.setAttribute(o.data, ""); host.append(svg);
  const vw = { x: 0, y: 0, z: 1, moved: false }, size = () => [Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)];
  let box = { w: 600, h: 300 };
  const apply = () => { const [W, H] = size(); svg.setAttribute("viewBox", `${vw.x} ${vw.y} ${W / vw.z} ${H / vw.z}`); svg.style.width = `${W}px`; svg.style.height = `${H}px`; bar.update(); };
  const fit = () => { const [W, H] = size(), max = o.maxFit || 1.25; let v = fitView(W, H, box, 20, max, 0.2);
    const end = o.tall && o.tall();      // a page taller than the window : fitted to its width, at the end one reads first (the history : its newest point)
    if (end) { const z = Math.max(0.2, Math.min(max, (W - 40) / Math.max(1, box.w))); if (box.h * z > H - 40) v = { x: -(W / z - box.w) / 2, y: end === "bottom" ? box.h - (H - 20) / z : -20 / z, z }; }
    Object.assign(vw, v, { moved: false }); apply(); };
  /** Bring the band [y0, y1] of the page into the window when it is out of it (a point chosen with the keyboard) : the view follows. */
  const reveal = (y0, y1) => { const [, H] = size(), top = vw.y, m = 16 / vw.z, bot = vw.y + H / vw.z; if (y0 >= top + m && y1 <= bot - m) return; vw.y = y0 < top + m ? y0 - m : y1 - H / vw.z + m; vw.moved = true; apply(); };
  const zoomAt = (k, px, py) => { const [W, H] = size(); Object.assign(vw, zoomView(vw, k, px ?? W / 2, py ?? H / 2, 0.2, 4), { moved: true }); apply(); };
  const bar = viewBar({ label: o.label, zoomOut: () => zoomAt(1 / 1.25), zoomIn: () => zoomAt(1.25), fit, actual: () => zoomAt(1 / vw.z), text: () => `${Math.round(vw.z * 100)} %`, fitTip: o.fitTip });
  bar.node.classList.add("view-float"); host.append(bar.node);
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-240, Math.min(240, e.deltaY)) * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (o.grab && e.target.closest(o.grab))) return;
    const x0 = e.clientX, y0 = e.clientY, v0 = { ...vw }; let moved = false; svg.setPointerCapture(e.pointerId);
    const move = (ev) => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; host.classList.add("panning"); vw.x = v0.x - dx / vw.z; vw.y = v0.y - dy / vw.z; vw.moved = true; apply(); };
    const up = () => { host.classList.remove("panning"); svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerup", up); svg.removeEventListener("pointercancel", up); };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!vw.moved) fit(); else apply(); }) : null; if (ro) ro.observe(host);
  return { svg, setBox: (w, h) => { box = { w, h }; if (!vw.moved) fit(); else apply(); }, fit, reveal, destroy: () => { if (ro) ro.disconnect(); bar.node.remove(); svg.remove(); } };
}
