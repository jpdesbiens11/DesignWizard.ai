/* DynamiteOrbit.ai — the magnifier (demande de JP). A button turns it on and off — beside the zoom of each view (core/view_bar.js) and in the
   toolbar of a 3D view ; no longer in the top bar (demande de JP : « ça n'a pas d'affaire là »). While it is on, a round lens
   follows the pointer over every artefact — a drawing, a board, a diagram, a 3D view — and shows what is under it larger, by
   the factor of a short slider beside the button (× 1,5 to × 8). The pointer keeps working through the lens : one clicks, turns
   and scrolls as before. Escape puts the magnifier away.
   A vector artefact (SVG) is drawn again at the larger scale : it stays sharp. A view painted in pixels (the 3D views) is
   enlarged as it is : a zoom of the view itself shows more. What a screen lays over a 3D view (labels, markers) is not in the lens.
   The first half is pure ; installLoupe() and loupeButton() touch the page. Every button shows the same state : turned on from one view, it
   is on everywhere, and Escape puts it away. */

const STORE = "dw.loupe";
export const LOUPE = { min: 1.5, max: 8, step: 0.5, base: 3, size: 240, least: [120, 70] };      // least : smaller than this is an icon, not an artefact
export const loupeFactor = (k) => { const v = Number.isFinite(+k) ? +k : LOUPE.base; return Math.min(LOUPE.max, Math.max(LOUPE.min, Math.round(v / LOUPE.step) * LOUPE.step)); };
export const factorText = (k) => `× ${String(loupeFactor(k)).replace(".", ",")}`;
/** What is kept from one visit to the next : the factor. The magnifier itself starts put away. */
export function readLoupe(store) { try { const v = JSON.parse((store && store.getItem(STORE)) || "{}"); return { k: loupeFactor(v && v.k) }; } catch (e) { return { k: LOUPE.base }; } }
export function writeLoupe(store, state) { try { store.setItem(STORE, JSON.stringify({ k: loupeFactor(state.k) })); return true; } catch (e) { return false; } }
/** Where the enlarged copy of an artefact goes in the lens so that the point under the pointer sits at its centre.
    rect : the artefact on the page { left, top } ; at : the pointer { x, y } ; size : the lens ; k : the factor. */
export const lensOffset = (rect, at, size, k) => ({ left: size / 2 - (at.x - rect.left) * k, top: size / 2 - (at.y - rect.top) * k });
/** The part of a painted view the lens shows, in the pixels of that view. rect : { left, top, width, height } on the page ;
    px : [width, height] of the view in its own pixels. → { sx, sy, sw, sh } (may reach outside : the lens is blank there) */
export function lensSource(rect, at, size, k, px) {
  const fx = px[0] / rect.width, fy = px[1] / rect.height, w = size / k, h = size / k;
  return { sx: (at.x - rect.left - w / 2) * fx, sy: (at.y - rect.top - h / 2) * fy, sw: w * fx, sh: h * fy };
}
/** Is a box large enough to be an artefact, and not an icon ? */
export const isArtefact = (w, h) => w >= LOUPE.least[0] && h >= LOUPE.least[1];

/* ---------- the page ---------- */
let state = { on: false, k: LOUPE.base }, lens = null, paper = null, glass = null, src = null, copy = null, stale = false, watch = null, frame = 0, at = null, installed = false;
const listeners = new Set(), tell = () => { for (const f of listeners) f(state); };

/* the artefact under the pointer : the outermost drawing, or the painted view of a viewport */
function artefactAt(t) {
  if (!t || !t.closest || t.closest(".topbar, .loupe, .menu, .sk-tip")) return null;
  let node = t.closest("svg"); while (node && node.parentElement && node.parentElement.closest("svg")) node = node.parentElement.closest("svg");
  if (!node) { node = t.closest("canvas"); if (!node) { const view = t.closest(".viewport, .rd-view"); node = view ? view.querySelector("canvas") : null; } }
  if (!node) return null;
  const r = node.getBoundingClientRect(); return isArtefact(r.width, r.height) ? node : null;
}
function take(node) {
  if (src === node && !stale) return;
  if (watch) { watch.disconnect(); watch = null; }
  src = node; stale = false; if (copy) { copy.remove(); copy = null; }
  if (!node) return;
  if (node.tagName.toLowerCase() === "svg") {
    copy = node.cloneNode(true); copy.removeAttribute("id"); copy.setAttribute("aria-hidden", "true"); copy.classList.add("loupe-copy"); paper.append(copy);
    watch = new MutationObserver(() => { stale = true; }); watch.observe(node, { childList: true, subtree: true, attributes: true, characterData: true });      // the artefact changed : copied again at the next move
  }
}
function draw() {
  frame = 0; if (!state.on || !at) return;
  const node = artefactAt(document.elementFromPoint(at.x, at.y));
  if (!node) { lens.classList.remove("on"); take(null); return; }
  take(node);
  const S = LOUPE.size, k = state.k, r = node.getBoundingClientRect();
  lens.style.transform = `translate(${Math.round(at.x - S / 2)}px, ${Math.round(at.y - S / 2)}px)`; lens.classList.add("on");
  if (copy) {
    const o = lensOffset(r, at, S, k); glass.style.display = "none"; paper.style.display = "";
    copy.style.cssText = `position:absolute;left:${o.left}px;top:${o.top}px;width:${r.width}px;height:${r.height}px;max-width:none;margin:0;box-sizing:border-box;box-shadow:none;cursor:default;transform-origin:0 0;transform:scale(${k});`;
    paper.style.background = getComputedStyle(node).backgroundColor;
  } else {
    const d = window.devicePixelRatio || 1, w = Math.round(S * d); paper.style.display = "none"; glass.style.display = "";
    if (glass.width !== w) { glass.width = w; glass.height = w; }
    const g = glass.getContext("2d"), q = lensSource(r, at, S, k, [node.width, node.height]);
    g.clearRect(0, 0, w, w); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    try { g.drawImage(node, q.sx, q.sy, q.sw, q.sh, 0, 0, w, w); } catch (e) { /* a view that cannot be read : the lens stays blank */ }
  }
}
const ask = () => { if (!frame) frame = requestAnimationFrame(draw); };

export const loupeState = () => ({ ...state });
export function setLoupe(patch) {
  state = { on: patch.on === undefined ? state.on : !!patch.on, k: patch.k === undefined ? state.k : loupeFactor(patch.k) };
  if (installed) { writeLoupe(window.localStorage, state); document.documentElement.classList.toggle("loupe-on", state.on); if (!state.on) { lens.classList.remove("on"); take(null); } else ask(); }
  tell();
}

/** Puts the lens on the page and follows the pointer. Called once, when the application starts. */
export function installLoupe() {
  if (installed || typeof document === "undefined") return; installed = true;
  state = { on: false, k: readLoupe(window.localStorage).k };
  lens = document.createElement("div"); lens.className = "loupe"; lens.setAttribute("aria-hidden", "true"); lens.style.width = lens.style.height = `${LOUPE.size}px`;
  paper = document.createElement("div"); paper.className = "loupe-paper"; glass = document.createElement("canvas"); glass.className = "loupe-glass"; glass.style.display = "none";
  const cross = document.createElement("i"); cross.className = "loupe-cross"; lens.append(paper, glass, cross); document.body.append(lens);
  document.addEventListener("pointermove", (e) => { at = { x: e.clientX, y: e.clientY }; if (state.on) ask(); }, { passive: true });
  document.addEventListener("pointerleave", () => { at = null; lens.classList.remove("on"); });
  document.addEventListener("scroll", () => { if (state.on) ask(); }, { capture: true, passive: true });
  document.addEventListener("wheel", () => { if (state.on) setTimeout(ask, 30); }, { capture: true, passive: true });      // a view that zooms under the lens is read again once painted
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.on && !document.querySelector(".modal, .menu")) setLoupe({ on: false }); });
  window.addEventListener("hashchange", () => { take(null); if (state.on) setTimeout(ask, 60); });
  tell();
}

/** A button of the magnifier, and beside it — only while the magnifier is on — the short slider of its factor. o.compact : an icon button,
    for the bar of a view. Many buttons may be on the page : each follows the one state, and leaves the list once it is off the page. → element */
export function loupeButton(o = {}) {
  const NS = "http://www.w3.org/2000/svg", ico = document.createElementNS(NS, "svg"), path = document.createElementNS(NS, "path");
  ico.setAttribute("viewBox", "0 0 16 16"); ico.setAttribute("width", "16"); ico.setAttribute("height", "16"); ico.setAttribute("aria-hidden", "true"); ico.setAttribute("class", "loupe-ico");
  path.setAttribute("d", "M10.6 10.6L14 14M7 4.6v4.8M4.6 7h4.8M11.5 7a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0z"); path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.6"); path.setAttribute("stroke-linecap", "round"); ico.append(path);
  const b = document.createElement("button"); b.type = "button"; b.className = `${o.compact ? "icon-btn" : "btn btn-small"} loupe-btn`; b.dataset.loupe = ""; b.append(ico);
  const range = document.createElement("input"); range.type = "range"; range.min = LOUPE.min; range.max = LOUPE.max; range.step = LOUPE.step; range.className = "loupe-range"; range.setAttribute("aria-label", "Grossissement de la loupe");
  const out = document.createElement("b"); out.className = "loupe-k"; const more = document.createElement("span"); more.className = "loupe-more"; more.append(range, out);
  const wrap = document.createElement("span"); wrap.className = "loupe-ctl"; wrap.append(b, more);
  const paint = (s) => { if (!wrap.isConnected && wrap.dataset.shown) { listeners.delete(paint); return; } if (wrap.isConnected) wrap.dataset.shown = "1"; b.setAttribute("aria-pressed", String(s.on)); b.classList.toggle("on", s.on); more.hidden = !s.on; range.value = s.k; out.textContent = factorText(s.k);
    b.setAttribute("aria-label", s.on ? "Ranger la loupe" : "Loupe"); b.setAttribute("data-tip", s.on ? "Ranger la loupe (Échap)" : `Loupe : grossit ${factorText(s.k)} ce qui est sous le pointeur — dessin, carte, schéma, vue 3D`); };
  b.addEventListener("click", (e) => { e.stopPropagation(); setLoupe({ on: !state.on }); }); range.addEventListener("input", () => setLoupe({ k: parseFloat(range.value) }));
  listeners.add(paint); paint(state);
  return wrap;
}
