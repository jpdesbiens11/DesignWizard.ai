/* DesignWizard.ai — turning a 3D view : where it pivots, and which way it goes (demande de JP). The view turned about its
   centre, which nothing showed : one could not tell what would stay still nor how the rest would swing. Now :
   - the view turns about THE POINT UNDER THE POINTER when the button goes down (the centre of the view off the model) : what is
     grabbed stays where it is on the screen ;
   - while it turns, a cue sits on that point : the pivot, the vertical axis the turntable spins about, a ring with an arc and an
     arrow that follow the hand (left / right), a second one for the tilt (up / down), and the angles turned since the press ;
   - the button held still for two seconds starts the AUTOMATIC ROTATION : a small panel by the pivot gives the way (four arrows)
     and the speed (slow, medium, fast) ; Escape, the cross or a new gesture in the view ends it.
   The convention is the turntable of mechanical CAD (Z stays up) with a visible spin centre. The first half is pure — the
   geometry of the turn and of the cue ; mountOrbit() draws on the page and moves the camera of core/viewer.js. */

const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** v turned by the angle a (rad) about the axis k (of length 1). */
export function turned(v, k, a) { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v) * (1 - c), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; }

export const ORBIT = { perPixel: 0.0085, pole: 0.995, show: 350, hold: 2000, radius: 46 };      // rad per pixel ; how close to straight up or down the tilt may go ; ms before the pivot shows, before the automatic rotation
export const AUTO_SPEEDS = [{ key: "slow", label: "Lente", deg: 9 }, { key: "medium", label: "Moyenne", deg: 27 }, { key: "fast", label: "Rapide", deg: 72 }];      // degrees per second
export const autoSpeed = (key) => AUTO_SPEEDS.find((s) => s.key === key) || AUTO_SPEEDS[0];

/** One step of the turntable about a pivot. cam : { target, dir (from the target to the eye, length 1) } ; yaw : about the vertical
    axis through the pivot ; pitch : about the horizontal axis of the screen through it. The tilt stops before straight up or down.
    → { target, dir, pitch (the tilt really made : 0 at the stop) } — the pivot keeps its place on the screen. */
export function orbitAbout(cam, pivot, yaw, pitch) {
  let dir = turned(cam.dir, Z, yaw), off = turned(sub(cam.target, pivot), Z, yaw), made = 0;
  const axis = norm(cross(Z, dir)), next = turned(dir, axis, -pitch);
  if (pitch && Math.abs(next[2]) < ORBIT.pole) { dir = next; off = turned(off, axis, -pitch); made = pitch; }
  return { target: add(pivot, off), dir: norm(dir), pitch: made };
}
/** The horizontal ring of the turntable as the eye sees it : an ellipse, flatter as the eye comes down ; the vertical axis shortens
    as it rises. dirZ : the height of the eye direction (−1 … 1). → { rx, ry, below (seen from underneath), axis (half length of the axis) } */
export const ringOf = (dirZ, r = ORBIT.radius) => ({ rx: r, ry: Math.max(r * 0.16, r * Math.abs(dirZ)), below: dirZ < 0, axis: Math.max(r * 0.3, r * Math.sqrt(Math.max(0, 1 - dirZ * dirZ))) });
/** A point of that ring, from its nearest point : phi > 0 goes to the right, as the hand does. */
export const ringPoint = (ring, phi) => [ring.rx * Math.sin(phi), (ring.below ? -1 : 1) * ring.ry * Math.cos(phi)];
/** A point of the tilt ring — a vertical ring seen a little from the side : psi > 0 goes down, as the hand does. */
export const tiltPoint = (r, psi) => [r * 0.34 * Math.cos(psi), r * Math.sin(psi)];
/** An arc with its arrow head : from the nearest point of a ring over `sweep` (rad, signed ; never more than nine tenths of a turn
    is drawn). point(angle) → [x, y]. → { d (svg path, "" when there is nothing to draw), head (three points, "x,y x,y x,y") } */
export function arcOf(point, sweep) {
  const a = Math.max(-5.65, Math.min(5.65, sweep)); if (Math.abs(a) < 0.03) return { d: "", head: "" };
  const n = Math.max(6, Math.ceil(Math.abs(a) * 9)), pts = Array.from({ length: n + 1 }, (_, i) => point(a * i / n));
  const [ex, ey] = pts[n], [bx, by] = point(a - Math.sign(a) * 0.12), t = norm([ex - bx, ey - by, 0]), w = [-t[1], t[0]], f = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return { d: "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L"), head: [f(ex + t[0] * 7, ey + t[1] * 7), f(ex + w[0] * 4.2, ey + w[1] * 4.2), f(ex - w[0] * 4.2, ey - w[1] * 4.2)].join(" ") };
}
/** How far the hold has come toward the automatic rotation : 0 before the pivot shows, 1 at two seconds. */
export const holdProgress = (ms) => Math.max(0, Math.min(1, (ms - ORBIT.show) / (ORBIT.hold - ORBIT.show)));
/** « Z 34° · incl. 12° » : what was turned since the press (rad, as the hand went). */
export function orbitText(yaw, tilt) { const d = (a) => Math.round(Math.abs(a) * 180 / Math.PI); return [d(yaw) ? `Z ${d(yaw)}°` : "", d(tilt) ? `incl. ${d(tilt)}°` : ""].filter(Boolean).join(" · "); }

/* ---------- the page ---------- */
const NS = "http://www.w3.org/2000/svg", STORE = "dw.orbit";
const S = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const H = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

/** The cue and the automatic rotation of one viewer (core/viewer.js : target, dir, camera, el, canvas, toScreen, _pick).
    → { press(e, drag), turn(dx, dy) (pixels), release(), stop(), dispose() } */
export function mountOrbit(viewer) {
  const R = ORBIT.radius, box = 2 * (R + 24);
  const svg = S("svg", { class: "dw-orbit", viewBox: `${-box / 2} ${-box / 2} ${box} ${box}`, width: box, height: box, "aria-hidden": "true" });
  const axis = S("line", { class: "ax" }), zed = S("text", { class: "zed" }), ring = S("ellipse", { class: "ring", cx: 0, cy: 0 }), tilt = S("ellipse", { class: "ring", cx: 0, cy: 0, rx: R * 0.34, ry: R });
  const yawArc = S("path", { class: "arc" }), yawHead = S("polygon", { class: "head" }), tiltArc = S("path", { class: "arc tilt" }), tiltHead = S("polygon", { class: "head tilt" });
  const hold = S("circle", { class: "hold", cx: 0, cy: 0, r: 15, pathLength: 100 }), dot = S("circle", { class: "pivot", cx: 0, cy: 0, r: 4.2 });
  zed.textContent = "Z"; svg.append(axis, zed, ring, tilt, yawArc, yawHead, tiltArc, tiltHead, hold, dot);
  const note = H("div", "dw-orbit-note"); svg.hidden = true; note.hidden = true; viewer.el.append(svg, note);
  let pivot = null, yaw = 0, tip = 0, timers = [], t0 = 0, raf = 0, auto = null, panel = null;      // auto : { x, y (−1, 0, 1), speed, last }

  const cam = () => ({ target: viewer.target.toArray(), dir: viewer.dir.toArray() });
  /* angles as the hand goes : right and down are positive. The model follows the hand both ways — what is near goes right when the
     hand goes right, down when it goes down (the eye then rises : more of the top shows), as in the usual orbit of 3D tools. */
  function apply(dxAngle, dyAngle) {
    viewer.camera.up.set(0, 0, 1);
    const next = orbitAbout(cam(), pivot, -dxAngle, dyAngle);
    viewer.target.set(...next.target); viewer.dir.set(...next.dir); viewer.dirty = true;
    yaw += dxAngle; if (next.pitch) tip += dyAngle;
    return next;
  }
  function place() {
    if (!pivot) return; const [sx, sy] = viewer.toScreen(pivot), r = viewer.el.getBoundingClientRect(), x = sx - r.left, y = sy - r.top;
    svg.style.left = `${x - box / 2}px`; svg.style.top = `${y - box / 2}px`; note.style.left = `${x}px`; note.style.top = `${y + R + 20}px`;
    if (panel) { panel.style.left = `${Math.max(6, Math.min(r.width - 204, x + R + 14))}px`; panel.style.top = `${Math.max(6, Math.min(r.height - 190, y - 78))}px`; }
  }
  /* full : the rings and the arcs ; else the pivot alone (and how far the hold has come) */
  function draw(full, progress = 0) {
    const g = ringOf(viewer.dir.z, R); svg.hidden = false; svg.classList.toggle("full", full);
    axis.setAttribute("x1", 0); axis.setAttribute("x2", 0); axis.setAttribute("y1", -g.axis - 8); axis.setAttribute("y2", g.axis + 8); zed.setAttribute("x", 0); zed.setAttribute("y", -g.axis - 15);
    ring.setAttribute("rx", g.rx); ring.setAttribute("ry", g.ry);
    const a = arcOf((p) => ringPoint(g, p), yaw), b = arcOf((p) => tiltPoint(R, p), tip);
    yawArc.setAttribute("d", a.d); yawHead.setAttribute("points", a.head); tiltArc.setAttribute("d", b.d); tiltHead.setAttribute("points", b.head);
    hold.style.strokeDasharray = `${Math.round(progress * 100)} 100`; hold.style.display = progress > 0 && progress < 1 ? "" : "none";
    const text = full ? orbitText(yaw, tip) : progress > 0 ? "maintenez : rotation automatique" : ""; note.hidden = !text; note.textContent = text;
    place();
  }
  const hide = () => { svg.hidden = true; note.hidden = true; }, clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; cancelAnimationFrame(raf); raf = 0; };
  /* a screen that waits for a click in the view (a tool armed, a place to point at) keeps the hold for itself */
  const taken = () => (typeof viewer.holdBusy === "function" && viewer.holdBusy()) || viewer.mode !== "select" || getComputedStyle(viewer.canvas).cursor === "crosshair";

  function press(e, drag) {
    endAuto(); clearTimers();
    const hit = viewer._pick(e); pivot = hit ? hit.point.slice() : viewer.target.toArray(); yaw = 0; tip = 0; t0 = performance.now();
    if (e.pointerType === "touch" || taken()) return;
    const grow = () => { if (!timers.length) return; draw(false, holdProgress(performance.now() - t0)); raf = requestAnimationFrame(grow); };
    timers = [setTimeout(grow, ORBIT.show), setTimeout(() => { clearTimers(); drag.auto = true; startAuto(); }, ORBIT.hold)];      // drag.auto : the release that follows is not a click
  }
  function turn(dx, dy) { if (!pivot || auto) return; clearTimers(); apply(dx * ORBIT.perPixel, dy * ORBIT.perPixel); draw(true); }
  function release() { clearTimers(); if (!auto) hide(); }

  /* ---------- the automatic rotation ---------- */
  function startAuto() {
    let speed = "slow"; try { speed = autoSpeed(localStorage.getItem(STORE)).key; } catch (e) { /* a private window */ }
    auto = { x: 0, y: 0, speed, last: 0 }; yaw = 0; tip = 0;
    panel = H("div", "dw-auto"); panel.setAttribute("role", "group"); panel.setAttribute("aria-label", "Rotation automatique de la vue");
    const head = H("div", "dw-auto-head"), pad = H("div", "dw-auto-pad"), speeds = H("div", "seg text"); speeds.setAttribute("role", "group"); speeds.setAttribute("aria-label", "Vitesse de rotation");
    const close = H("button", "icon-btn", "×"); close.type = "button"; close.setAttribute("aria-label", "Arrêter la rotation automatique"); close.dataset.tip = "Arrêter et fermer (Échap)"; close.addEventListener("click", endAuto);
    head.append(H("b", "", "Rotation automatique"), close);
    const way = (cls, label, glyph, x, y) => { const b = H("button", `dw-auto-way ${cls}`, glyph); b.type = "button"; b.setAttribute("aria-label", label); b.dataset.tip = label; b.dataset.way = `${x},${y}`;
      b.addEventListener("click", () => { const same = auto.x === x && auto.y === y; auto.x = same ? 0 : x; auto.y = same ? 0 : y; auto.last = 0; paint(); if (!raf && (auto.x || auto.y)) raf = requestAnimationFrame(spin); }); return b; };
    pad.append(way("up", "Basculer vers le haut", "▲", 0, -1), way("left", "Tourner vers la gauche", "◀", -1, 0), way("stop", "Arrêter", "■", 0, 0), way("right", "Tourner vers la droite", "▶", 1, 0), way("down", "Basculer vers le bas", "▼", 0, 1));
    for (const s of AUTO_SPEEDS) { const b = H("button", "seg-btn", s.label); b.type = "button"; b.dataset.speed = s.key; b.dataset.tip = `${s.deg}° par seconde`; b.addEventListener("click", () => { auto.speed = s.key; try { localStorage.setItem(STORE, s.key); } catch (e) { /* kept for this visit */ } paint(); }); speeds.append(b); }
    panel.append(head, pad, speeds, H("small", "dw-auto-hint", "Choisissez un sens. Échap arrête.")); viewer.el.append(panel);
    window.addEventListener("keydown", onKey, true); paint(); draw(true);
  }
  function paint() {
    if (!panel) return;
    for (const b of panel.querySelectorAll(".dw-auto-way")) { const on = b.dataset.way === `${auto.x},${auto.y}` && (auto.x || auto.y); b.classList.toggle("on", !!on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    for (const b of panel.querySelectorAll("[data-speed]")) { const on = b.dataset.speed === auto.speed; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
  }
  function spin(t) {
    raf = 0; if (!auto || !viewer.alive) return; if (!auto.x && !auto.y) { draw(true); return; }
    const dt = auto.last ? Math.min(0.05, (t - auto.last) / 1000) : 0, w = autoSpeed(auto.speed).deg * Math.PI / 180; auto.last = t;
    const next = apply(auto.x * w * dt, auto.y * w * dt);
    if (auto.y && dt && !next.pitch) { auto.y = 0; paint(); }      // straight up or down : the tilt stops there
    draw(true); raf = requestAnimationFrame(spin);
  }
  function onKey(e) { if (e.key === "Escape" && auto) { e.stopPropagation(); endAuto(); } }
  function endAuto() { if (!auto) return; auto = null; cancelAnimationFrame(raf); raf = 0; window.removeEventListener("keydown", onKey, true); if (panel) { panel.remove(); panel = null; } hide(); }

  return { press, turn, release, stop: () => { clearTimers(); endAuto(); hide(); }, dispose: () => { clearTimers(); endAuto(); svg.remove(); note.remove(); }, auto: () => (auto ? { ...auto } : null), pivot: () => (pivot ? pivot.slice() : null) };
}
