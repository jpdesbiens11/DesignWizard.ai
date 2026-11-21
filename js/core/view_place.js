/* DesignWizard.ai — placing a feature with the mouse, helped : while a tool is armed, the face under the pointer shows a 5 mm
   grid, the feature follows as a ghost, the centre line appears when the symmetry axis catches it (so does the line of a
   feature it comes in line with), two dimensions run to the nearer edges, and a window in the top right corner of the view
   gives the coordinates as they change. A click drops the feature there ; Escape lets go ; Alt frees it from every catch.
   A feature already there is picked up again by holding the pointer on it for two seconds. The catches switch on and
   off from the right-click menu, and are remembered. The rules of the catch : core/snap.js. */

import { el } from "./dom.js";
import { SNAP_DEFAULT, snapPoint, snapGuides } from "./snap.js";

const KEY = "dw.snap", HOLD = 2000, REACH = 18, fr = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
const caught = (c) => (c.kind === "axis" ? " · sur l'axe de symétrie" : c.kind === "align" ? ` · aligné sur ${c.ref}` : c.kind === "limit" ? " · en limite" : "");
/** What the designer switched on : { axes, align, gridOn, direction } — kept from one session to the next. */
export function snapPrefs() {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { saved = {}; }
  return { ...SNAP_DEFAULT, ...Object.fromEntries(["axes", "align", "gridOn", "direction"].filter((k) => typeof saved[k] === "boolean").map((k) => [k, saved[k]])) };
}
export function setSnapPref(key, on) { const p = snapPrefs(), next = { axes: p.axes, align: p.align, gridOn: p.gridOn, direction: p.direction, [key]: !!on }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* private mode : for this session only */ } return next; }
/** The lines of a right-click menu that switch the catches. after : called once a line is chosen. */
export function snapMenu(after = () => {}) {
  const p = snapPrefs(), line = (key, label) => ({ label: `${label} : ${p[key] ? "oui" : "non"}`, icon: p[key] ? "check" : "cross", run: () => { setSnapPref(key, !p[key]); after(); } });
  return [{ title: "Accrochage à la souris" }, line("axes", "Axes de symétrie"), line("align", "Alignement sur les voisins"), line("gridOn", "Grille de 5 mm"), line("direction", "Parallèle / perpendiculaire (mesure)")];
}

/** The helper of one view. viewer : the 3D viewer ; host : the element of the view (the window of coordinates goes in its top right
    corner). o : { face(hit, tool) → face of core/snap.js with P(u, v) → [x, y, z], names, title — or null off a flat face ;
    local(hit, face) → [u, v] ; drop(tool, face, snapped) ; points() → [{ id, label, p: [x, y, z] }] (the features already there : the
    one nearest the pointer on the screen is the one a hold picks up — a hole has no face to point at) ; pickUp(found) → the tool that moves it }. → { arm(tool), cancel(), armed(), hover(hit, e), click(hit, e) → true when it used the click, dispose() } */
export function createPlacer(viewer, host, o) {
  viewer.holdBusy = () => !!tool;      // a tool armed keeps the held button for itself : no automatic rotation meanwhile (core/view_orbit.js)
  const box = el("div", { class: "place-box", hidden: true, role: "status", "aria-live": "polite" });
  host.append(box);
  let tool = null, cur = null, gridKey = null, timer = 0, down = null, lastHit = null, skipClick = false;
  const P = (f, u, v) => f.P(u, v), wipe = () => { viewer.clearOverlays("place"); viewer.clearOverlays("place-grid"); gridKey = null; };
  const say = (...lines) => { box.replaceChildren(...lines.filter(Boolean).map((t, k) => el(k ? "span" : "b", null, t))); box.hidden = false; };
  function drawGrid(f, G) {
    viewer.clearOverlays("place-grid");
    for (const u of G.grid.u) viewer.addPath([P(f, u, f.v[0]), P(f, u, f.v[1])], "#6b8fb5", "place-grid", 0.18);
    for (const v of G.grid.v) viewer.addPath([P(f, f.u[0], v), P(f, f.u[1], v)], "#6b8fb5", "place-grid", 0.18);
  }
  function drawLive(f, s, G) {
    viewer.clearOverlays("place");
    for (const l of G.lines) viewer.addPath(l.along === "u" ? [P(f, f.u[0], l.at), P(f, f.u[1], l.at)] : [P(f, l.at, f.v[0]), P(f, l.at, f.v[1])], l.kind === "axis" ? "#e8554b" : "#8a7df0", "place", 0.55, true);     // the centre line, or the line of a neighbour
    for (const d of G.dims) { if (!(d.value > 0.005)) continue; const a = P(f, d.from[0], d.from[1]), b = P(f, d.to[0], d.to[1]); viewer.addPath([a, b], "#0c66e4", "place", 0.3); viewer.addLabel([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], fr(d.value), "place", "dim"); }
    const size = tool.size || [0, 0], ring = [];
    if (size[0] > 0 && size[1] > 0) for (let k = 0; k <= 32; k++) { const a = k / 32 * 2 * Math.PI; ring.push(P(f, s.u + Math.cos(a) * size[0], s.v + Math.sin(a) * size[1])); }
    if (ring.length) viewer.addPath(ring, "#ff8a3d", "place", 0.6);
    viewer.addMarker(P(f, s.u, s.v), "#ff8a3d", "place", 0.8);
  }
  const api = {
    armed: () => tool,
    arm(t) { api.cancel(); tool = t; viewer.canvas.style.cursor = "crosshair"; say(t.label, "Survolez une face plane : la grille et les cotes apparaissent. Clic pour poser · Échap pour lâcher · Alt pour ne rien accrocher."); },
    cancel() { tool = null; cur = null; wipe(); box.hidden = true; viewer.canvas.style.cursor = ""; },
    hover(hit, e) {
      lastHit = hit;
      if (!tool) return false;
      const f = hit && hit.normal ? o.face(hit, tool) : null;
      if (!f) { cur = null; viewer.clearOverlays("place"); say(tool.label, "Une face plane, hors des plis."); return true; }
      const prefs = snapPrefs(), s = snapPoint(o.local(hit, f), f, { ...prefs, free: !!(e && e.altKey) }), G = snapGuides(s, f, prefs);
      if (f.key !== gridKey) { drawGrid(f, G); gridKey = f.key; }
      drawLive(f, s, G); cur = { f, s };
      say(`${tool.label} — ${f.title}`, `${f.names.u} : ${fr(s.u)} mm${caught(s.snap.u)}`, `${f.names.v} : ${fr(s.v)} mm${caught(s.snap.v)}`);
      return true;
    },
    click(hit, e) {
      if (skipClick) { skipClick = false; return true; }           // the release that ends a two-second hold is not a drop
      if (!tool) return false;
      if (hit) api.hover(hit, e);
      if (!cur) return true;
      const t = tool, c = cur; api.cancel(); o.drop(t, c.f, c.s);
      return true;
    },
    dispose() { api.cancel(); clearTimeout(timer); viewer.canvas.removeEventListener("pointerdown", onDown); window.removeEventListener("pointerup", onUp); viewer.canvas.removeEventListener("pointermove", onMove); document.removeEventListener("keydown", onKey, true); box.remove(); },
  };
  /* two seconds on a feature picks it up again */
  const stop = () => { clearTimeout(timer); timer = 0; down = null; };
  function onDown(e) {
    if (e.button !== 0 || tool || !o.points) return;
    let found = null;
    for (const q of o.points()) { const s = viewer.toScreen(q.p), d = Math.hypot(s[0] - e.clientX, s[1] - e.clientY); if (d <= REACH && (!found || d < found.d)) found = { ...q, d }; }
    if (!found) return;
    down = { x: e.clientX, y: e.clientY }; say(found.label, "Maintenez deux secondes pour le reprendre à la souris.");
    timer = setTimeout(() => { timer = 0; down = null; skipClick = true; api.arm(o.pickUp(found)); if (lastHit) api.hover(lastHit, null); }, HOLD);
  }
  function onMove(e) { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { stop(); if (!tool) box.hidden = true; } }
  function onUp() { if (timer) { stop(); if (!tool) box.hidden = true; } setTimeout(() => { skipClick = false; }, 0); }
  function onKey(e) { if (e.key === "Escape" && tool) { e.stopPropagation(); api.cancel(); } }
  viewer.canvas.addEventListener("pointerdown", onDown); viewer.canvas.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); document.addEventListener("keydown", onKey, true);
  return api;
}
