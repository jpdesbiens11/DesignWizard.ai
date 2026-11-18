/* DesignWizard.ai — turning a 3D view : where it pivots, and which way it goes (demandes de JP). The view turned about its
   centre, which nothing showed, and some turns were blocked : nothing happened from the top view, and the tilt stopped short of
   the vertical. Now :
   - the view turns about THE POINT UNDER THE POINTER when the button goes down (the centre of the view off the model) : what is
     grabbed stays where it is on the screen ;
   - NOTHING IS BLOCKED : three axes, and no stop. Left / right turns about the vertical of the model (Z) — seen from the top, that
     spins the picture in its plane ; up / down tilts about the horizontal of the screen, and goes on over the top ; Alt + drag
     rolls the picture about the line of sight. The model follows the hand, upside down too ;
   - while it turns, a cue sits on the pivot : the point, the Z axis as it lies on the screen, a ring with an arc and an arrow for
     the turn about Z, a second one for the tilt, a circle for the roll, and the angles turned since the press ;
   - the button held still for two seconds starts the AUTOMATIC ROTATION : a small panel by the pivot gives the way (arrows) and
     the speed (slow, medium, fast) ; Escape, the cross or a new gesture in the view ends it.
   The convention is the turntable of mechanical CAD with a visible spin centre. The first half is pure — the geometry of the turn
   and of the cue ; mountOrbit() draws on the page and moves the camera of core/viewer.js. */

const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** v turned by the angle a (rad) about the axis k (of length 1). */
export function turned(v, k, a) { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v) * (1 - c), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; }

export const ORBIT = { perPixel: 0.0085, show: 350, hold: 2000, radius: 46 };      // rad per pixel ; ms before the pivot shows, before the automatic rotation
export const AUTO_SPEEDS = [{ key: "slow", label: "Lente", deg: 9 }, { key: "medium", label: "Moyenne", deg: 27 }, { key: "fast", label: "Rapide", deg: 72 }];      // degrees per second
export const autoSpeed = (key) => AUTO_SPEEDS.find((s) => s.key === key) || AUTO_SPEEDS[0];

/** One step of the orbit about a pivot. cam : { target, dir (from the target to the eye), up (the up of the screen) } — dir and up
    of length 1, square to each other. yaw : about the vertical of the model (world Z) through the pivot ; rise : how much the eye
    rises, about the horizontal axis of the screen ; roll : about the line of sight. No angle is refused : over the top the view
    goes on, upside down. → { target, dir, up } — the pivot keeps its place on the screen. */
export function orbitAbout(cam, pivot, yaw = 0, rise = 0, roll = 0) {
  let dir = cam.dir, up = cam.up, off = sub(cam.target, pivot);
  if (yaw) { dir = turned(dir, Z, yaw); up = turned(up, Z, yaw); off = turned(off, Z, yaw); }
  if (rise) { const right = norm(cross(up, dir)); dir = turned(dir, right, -rise); up = turned(up, right, -rise); off = turned(off, right, -rise); }
  if (roll) { up = turned(up, dir, roll); off = turned(off, dir, roll); }
  dir = norm(dir); up = norm(sub(up, dir.map((c) => c * dot(up, dir))));      // kept square : nothing drifts over a long turn
  return { target: add(pivot, off), dir, up };
}
/** The turn about Z that makes what is near follow the hand : to the right when the hand goes right — upside down too, where the
    same turn would show the other way round. dxAngle : as the hand goes (right is positive) ; upZ : the height of the screen's up. */
export const yawOf = (dxAngle, upZ) => -dxAngle * (upZ < 0 ? -1 : 1);
/** How the vertical of the model lies on the screen : the angle of the Z axis from the up of the screen, clockwise, in degrees.
    right, up : the axes of the screen. 0 for a level view, 180 upside down ; a view straight down keeps the last sense of its up. */
export const horizonOf = (right, up) => (Math.hypot(right[2], up[2]) < 1e-6 ? 0 : Math.atan2(right[2], up[2]) * 180 / Math.PI);
/** The horizontal ring of the turntable as the eye sees it, in the frame where Z points up : an ellipse, flatter as the eye comes
    level ; the axis shortens as the eye rises. dirZ : the height of the eye direction (−1 … 1). → { rx, ry, below, axis } */
export const ringOf = (dirZ, r = ORBIT.radius) => ({ rx: r, ry: Math.max(r * 0.16, r * Math.abs(dirZ)), below: dirZ < 0, axis: Math.max(r * 0.3, r * Math.sqrt(Math.max(0, 1 - dirZ * dirZ))) });
/** A point of that ring, from its nearest point : phi > 0 goes to the right. */
export const ringPoint = (ring, phi) => [ring.rx * Math.sin(phi), (ring.below ? -1 : 1) * ring.ry * Math.cos(phi)];
/** A point of the tilt ring — a vertical ring seen a little from the side : psi > 0 goes down, as the hand does. */
export const tiltPoint = (r, psi) => [r * 0.34 * Math.cos(psi), r * Math.sin(psi)];
/** A point of the roll circle, from its top : gamma > 0 goes clockwise, as the picture does when the hand goes right. */
export const rollPoint = (r, gamma) => [r * Math.sin(gamma), -r * Math.cos(gamma)];
/** An arc with its arrow head : from the first point of a ring over `sweep` (rad, signed ; never more than nine tenths of a turn
    is drawn). point(angle) → [x, y]. → { d (svg path, "" when there is nothing to draw), head (three points, "x,y x,y x,y") } */
export function arcOf(point, sweep) {
  const a = Math.max(-5.65, Math.min(5.65, sweep)); if (Math.abs(a) < 0.03) return { d: "", head: "" };
  const n = Math.max(6, Math.ceil(Math.abs(a) * 9)), pts = Array.from({ length: n + 1 }, (_, i) => point(a * i / n));
  const [ex, ey] = pts[n], [bx, by] = point(a - Math.sign(a) * 0.12), t = norm([ex - bx, ey - by, 0]), w = [-t[1], t[0]], f = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return { d: "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L"), head: [f(ex + t[0] * 7, ey + t[1] * 7), f(ex + w[0] * 4.2, ey + w[1] * 4.2), f(ex - w[0] * 4.2, ey - w[1] * 4.2)].join(" ") };
}
/** How far the hold has come toward the automatic rotation : 0 before the pivot shows, 1 at two seconds. */
export const holdProgress = (ms) => Math.max(0, Math.min(1, (ms - ORBIT.show) / (ORBIT.hold - ORBIT.show)));
/** « Z 34° · incl. 12° · roulis 8° » : what was turned since the press (rad). */
export function orbitText(yaw, tilt, roll = 0) { const d = (a) => Math.round(Math.abs(a) * 180 / Math.PI); return [d(yaw) ? `Z ${d(yaw)}°` : "", d(tilt) ? `incl. ${d(tilt)}°` : "", d(roll) ? `roulis ${d(roll)}°` : ""].filter(Boolean).join(" · "); }

/* ---------- the page ---------- */
const NS = "http://www.w3.org/2000/svg", STORE = "dw.orbit";
const S = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const H = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

/** The cue and the automatic rotation of one viewer (core/viewer.js : target, dir, camera, el, canvas, toScreen, _pick, _cam).
    → { press(e, drag), turn(dx, dy, roll) (pixels ; roll : Alt is down), release(), stop(), dispose() } */
export function mountOrbit(viewer) {
  const R = ORBIT.radius, box = 2 * (R + 30);
  const svg = S("svg", { class: "dw-orbit", viewBox: `${-box / 2} ${-box / 2} ${box} ${box}`, width: box, height: box, "aria-hidden": "true" });
  const level = S("g"), axis = S("line", { class: "ax", x1: 0, x2: 0 }), zed = S("text", { class: "zed", x: 0 }), ring = S("ellipse", { class: "ring", cx: 0, cy: 0 }), tilt = S("ellipse", { class: "ring", cx: 0, cy: 0, rx: R * 0.34, ry: R });
  const yawArc = S("path", { class: "arc" }), yawHead = S("polygon", { class: "head" }), tiltArc = S("path", { class: "arc tilt" }), tiltHead = S("polygon", { class: "head tilt" }), rollArc = S("path", { class: "arc roll" }), rollHead = S("polygon", { class: "head roll" });
  const hold = S("circle", { class: "hold", cx: 0, cy: 0, r: 15, pathLength: 100 }), dot = S("circle", { class: "pivot", cx: 0, cy: 0, r: 4.2 });
  zed.textContent = "Z"; level.append(axis, zed, ring, yawArc, yawHead); svg.append(level, tilt, tiltArc, tiltHead, rollArc, rollHead, hold, dot);      // level : what lies with the Z of the model, turned as Z lies on the screen
  const note = H("div", "dw-orbit-note"); svg.hidden = true; note.hidden = true; viewer.el.append(svg, note);
  let pivot = null, yaw = 0, tip = 0, spun = 0, timers = [], t0 = 0, raf = 0, auto = null, panel = null;      // yaw : the turn of the camera about Z ; tip, spun : as the hand went ; auto : { x, y, r (−1, 0, 1), speed, last }

  /* the camera as it stands : its up is the real up of the screen, square to the line of sight, whatever a preset left in camera.up */
  const cam = () => { viewer._cam(); const m = viewer.camera.matrixWorld.elements; return { target: viewer.target.toArray(), dir: viewer.dir.toArray(), up: [m[4], m[5], m[6]], right: [m[0], m[1], m[2]] }; };
  /* angles as the hand goes : right and down are positive ; the model follows the hand — what is near goes right when the hand goes
     right, down when it goes down (the eye then rises : more of the top shows), as in the usual orbit of 3D tools */
  function apply(dxAngle, dyAngle, rollAngle = 0) {
    const c = cam(), turn = yawOf(dxAngle, c.up[2]), next = orbitAbout(c, pivot, turn, dyAngle, rollAngle);
    viewer.target.set(...next.target); viewer.dir.set(...next.dir); viewer.camera.up.set(...next.up); viewer.dirty = true;
    yaw += turn; tip += dyAngle; spun += rollAngle;
  }
  function place() {
    if (!pivot) return; const [sx, sy] = viewer.toScreen(pivot), r = viewer.el.getBoundingClientRect(), x = sx - r.left, y = sy - r.top;
    svg.style.left = `${x - box / 2}px`; svg.style.top = `${y - box / 2}px`; note.style.left = `${x}px`; note.style.top = `${y + R + 26}px`;
    if (panel) { panel.style.left = `${Math.max(6, Math.min(r.width - 204, x + R + 20))}px`; panel.style.top = `${Math.max(6, Math.min(r.height - 196, y - 84))}px`; }
  }
  /* full : the rings and the arcs ; else the pivot alone (and how far the hold has come) */
  function draw(full, progress = 0) {
    const c = cam(), g = ringOf(c.dir[2], R); svg.hidden = false; svg.classList.toggle("full", full);
    level.setAttribute("transform", `rotate(${horizonOf(c.right, c.up).toFixed(1)})`);
    axis.setAttribute("y1", -g.axis - 8); axis.setAttribute("y2", g.axis + 8); zed.setAttribute("y", -g.axis - 15); ring.setAttribute("rx", g.rx); ring.setAttribute("ry", g.ry);
    const a = arcOf((p) => ringPoint(g, p), -yaw), b = arcOf((p) => tiltPoint(R, p), tip), s = arcOf((p) => rollPoint(R + 12, p), spun);      // a point of the ring goes the other way round than the camera
    yawArc.setAttribute("d", a.d); yawHead.setAttribute("points", a.head); tiltArc.setAttribute("d", b.d); tiltHead.setAttribute("points", b.head); rollArc.setAttribute("d", s.d); rollHead.setAttribute("points", s.head);
    hold.style.strokeDasharray = `${Math.round(progress * 100)} 100`; hold.style.display = progress > 0 && progress < 1 ? "" : "none";
    const text = full ? orbitText(yaw, tip, spun) : progress > 0 ? "maintenez : rotation automatique" : ""; note.hidden = !text; note.textContent = text;
    place();
  }
  const hide = () => { svg.hidden = true; note.hidden = true; }, clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; cancelAnimationFrame(raf); raf = 0; };
  /* a screen that waits for a click in the view (a tool armed, a place to point at) keeps the hold for itself */
  const taken = () => (typeof viewer.holdBusy === "function" && viewer.holdBusy()) || viewer.mode !== "select" || getComputedStyle(viewer.canvas).cursor === "crosshair";

  function press(e, drag) {
    endAuto(); clearTimers();
    const hit = viewer._pick(e); pivot = hit ? hit.point.slice() : viewer.target.toArray(); yaw = 0; tip = 0; spun = 0; t0 = performance.now();
    if (e.pointerType === "touch" || taken()) return;
    const grow = () => { if (!timers.length) return; draw(false, holdProgress(performance.now() - t0)); raf = requestAnimationFrame(grow); };
    timers = [setTimeout(grow, ORBIT.show), setTimeout(() => { clearTimers(); drag.auto = true; startAuto(); }, ORBIT.hold)];      // drag.auto : the release that follows is not a click
  }
  function turn(dx, dy, roll = false) { if (!pivot || auto) return; clearTimers(); if (roll) apply(0, 0, dx * ORBIT.perPixel); else apply(dx * ORBIT.perPixel, dy * ORBIT.perPixel); draw(true); }
  function release() { clearTimers(); if (!auto) hide(); }

  /* ---------- the automatic rotation ---------- */
  function startAuto() {
    let speed = "slow"; try { speed = autoSpeed(localStorage.getItem(STORE)).key; } catch (e) { /* a private window */ }
    auto = { x: 0, y: 0, r: 0, speed, last: 0 }; yaw = 0; tip = 0; spun = 0;
    panel = H("div", "dw-auto"); panel.setAttribute("role", "group"); panel.setAttribute("aria-label", "Rotation automatique de la vue");
    const head = H("div", "dw-auto-head"), pad = H("div", "dw-auto-pad"), speeds = H("div", "seg text"); speeds.setAttribute("role", "group"); speeds.setAttribute("aria-label", "Vitesse de rotation");
    const close = H("button", "icon-btn", "×"); close.type = "button"; close.setAttribute("aria-label", "Arrêter la rotation automatique"); close.dataset.tip = "Arrêter et fermer (Échap)"; close.addEventListener("click", endAuto);
    head.append(H("b", "", "Rotation automatique"), close);
    const way = (cls, label, glyph, x, y, r = 0) => { const b = H("button", `dw-auto-way ${cls}`, glyph); b.type = "button"; b.setAttribute("aria-label", label); b.dataset.tip = label; b.dataset.way = `${x},${y},${r}`;
      b.addEventListener("click", () => { const same = auto.x === x && auto.y === y && auto.r === r; auto.x = same ? 0 : x; auto.y = same ? 0 : y; auto.r = same ? 0 : r; auto.last = 0; paint(); if (!raf && (auto.x || auto.y || auto.r)) raf = requestAnimationFrame(spin); }); return b; };
    pad.append(way("rl", "Rouler vers la gauche", "↺", 0, 0, -1), way("up", "Basculer vers le haut", "▲", 0, -1), way("rr", "Rouler vers la droite", "↻", 0, 0, 1), way("left", "Tourner vers la gauche", "◀", -1, 0), way("stop", "Arrêter", "■", 0, 0), way("right", "Tourner vers la droite", "▶", 1, 0), way("down", "Basculer vers le bas", "▼", 0, 1));
    for (const s of AUTO_SPEEDS) { const b = H("button", "seg-btn", s.label); b.type = "button"; b.dataset.speed = s.key; b.dataset.tip = `${s.deg}° par seconde`; b.addEventListener("click", () => { auto.speed = s.key; try { localStorage.setItem(STORE, s.key); } catch (e) { /* kept for this visit */ } paint(); }); speeds.append(b); }
    panel.append(head, pad, speeds, H("small", "dw-auto-hint", "Choisissez un sens. Échap arrête.")); viewer.el.append(panel);
    window.addEventListener("keydown", onKey, true); paint(); draw(true);
  }
  const going = () => !!(auto && (auto.x || auto.y || auto.r));
  function paint() {
    if (!panel) return;
    for (const b of panel.querySelectorAll(".dw-auto-way")) { const on = going() && b.dataset.way === `${auto.x},${auto.y},${auto.r}`; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    for (const b of panel.querySelectorAll("[data-speed]")) { const on = b.dataset.speed === auto.speed; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
  }
  function spin(t) {
    raf = 0; if (!auto || !viewer.alive) return; if (!going()) { draw(true); return; }
    const dt = auto.last ? Math.min(0.05, (t - auto.last) / 1000) : 0, w = autoSpeed(auto.speed).deg * Math.PI / 180; auto.last = t;
    apply(auto.x * w * dt, auto.y * w * dt, auto.r * w * dt); draw(true); raf = requestAnimationFrame(spin);
  }
  function onKey(e) { if (e.key === "Escape" && auto) { e.stopPropagation(); endAuto(); } }
  function endAuto() { if (!auto) return; auto = null; cancelAnimationFrame(raf); raf = 0; window.removeEventListener("keydown", onKey, true); if (panel) { panel.remove(); panel = null; } hide(); }

  return { press, turn, release, stop: () => { clearTimers(); endAuto(); hide(); }, dispose: () => { clearTimers(); endAuto(); svg.remove(); note.remove(); }, auto: () => (auto ? { ...auto } : null), pivot: () => (pivot ? pivot.slice() : null) };
}
