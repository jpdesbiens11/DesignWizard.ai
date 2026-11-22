/* DynamiteOrbit — turning a 3D view : where it pivots, and which way it goes (demandes de JP). The view turned about its
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
     the speed (slow, medium, fast) ; Escape, the cross or a new gesture in the view ends it. THE WAYS COMBINE (demande de JP :
     « une combinaison des 2 axes orthogonaux… les 2 flèches tournent en même temps ») : each axis — about Z, the tilt, the roll
     — has its own switch, two or three go at once, and each has its arrow going round its ring in the cue.
   - TURNING IN THE PLANE OF THE SCREEN is a gesture of its own, and it shows (demande de JP : « je veux la possibilité de tourner
     dans le plan… ça me gosse ») — it used to hide behind Alt + drag. A drag that starts on the EDGE BAND of the view rolls the
     picture round the centre of the view, as the hand goes round it : the virtual trackball, where a drag outside the ball turns
     about the line of sight. The band lights up under the pointer. Two curved arrows under the X Y Z triad roll it by a step ;
     Alt + ← / → does the same from the keyboard ; Alt + drag still rolls from anywhere ;
   - the orbit is FREE by default : the model follows the hand about the two axes of the screen, whatever its Z — the usual orbit
     of mechanical modellers. The TURNTABLE (the Z of the model stays upright ; left / right turns the part about its Z) is one
     click away, in the switch under the triad, and the choice is kept ;
   - the arrow keys turn the view by a step about its centre : 15°, 5° with Ctrl, 90° with Shift — the steps Onshape documents for
     its own arrow keys (the page of its keyboard shortcuts, read ; its mouse and view-cube pages could not be read).
   The first half is pure — the geometry of the turn and of the cue ; mountOrbit() draws on the page and moves the camera of
   core/viewer.js. */

import { recordView } from "./view_record.js";
import { mountAutoDock } from "./auto_dock.js";
import { shareName, turnSeconds } from "./share.js";

const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** v turned by the angle a (rad) about the axis k (of length 1). */
export function turned(v, k, a) { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v) * (1 - c), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; }

export const ORBIT = { perPixel: 0.0085, show: 350, hold: 2000, radius: 46 };      // rad per pixel ; ms before the pivot shows, before the automatic rotation
export const AUTO_SPEEDS = [{ key: "slow", label: "Lente", deg: 9 }, { key: "medium", label: "Moyenne", deg: 27 }, { key: "fast", label: "Rapide", deg: 72 }];      // degrees per second
export const autoSpeed = (key) => AUTO_SPEEDS.find((s) => s.key === key) || AUTO_SPEEDS[0];

/** One step of the orbit about a pivot. cam : { target, dir (from the target to the eye), up (the up of the screen) } — dir and up
    of length 1, square to each other. yaw : about the vertical of the model (world Z) through the pivot — or about `about`, the
    up of the screen for the free orbit ; rise : how much the eye rises, about the horizontal axis of the screen ; roll : about
    the line of sight. No angle is refused : over the top the view goes on, upside down. → { target, dir, up } — the pivot keeps
    its place on the screen. */
export function orbitAbout(cam, pivot, yaw = 0, rise = 0, roll = 0, about = Z) {
  let dir = cam.dir, up = cam.up, off = sub(cam.target, pivot);
  if (yaw) { dir = turned(dir, about, yaw); up = turned(up, about, yaw); off = turned(off, about, yaw); }
  if (rise) { const right = norm(cross(up, dir)); dir = turned(dir, right, -rise); up = turned(up, right, -rise); off = turned(off, right, -rise); }
  if (roll) { up = turned(up, dir, roll); off = turned(off, dir, roll); }
  dir = norm(dir); up = norm(sub(up, dir.map((c) => c * dot(up, dir))));      // kept square : nothing drifts over a long turn
  return { target: add(pivot, off), dir, up };
}
/** One step of the FREE orbit : the model follows the hand about the two axes of the screen — right and down are positive, as the
    hand goes ; what is near goes right when the hand goes right, whatever the Z of the model. roll : about the line of sight. */
export const orbitFree = (cam, pivot, dxAngle = 0, dyAngle = 0, roll = 0) => orbitAbout(cam, pivot, -dxAngle, dyAngle, roll, cam.up);
/** How the orbit goes : "free" (the default) or "table" (the turntable : the Z of the model stays upright). Kept for the next visit ;
    every view open hears the change (the event « dw:orbit-mode »). */
export const ORBIT_MODES = [{ key: "free", label: "Libre", tip: "Rotation libre : la pièce suit la main sur les deux axes de l'écran, quel que soit son Z" }, { key: "table", label: "Table", tip: "Table tournante : le Z du modèle reste vertical ; gauche / droite tourne la pièce autour de son Z, dans son plan XY" }];
let modeNow = null;
export function orbitMode() { if (!modeNow) { try { modeNow = localStorage.getItem("dw.orbit.mode"); } catch (e) { /* no storage : a private window, a test */ } if (modeNow !== "table") modeNow = "free"; } return modeNow; }
export function setOrbitMode(m) { modeNow = m === "table" ? "table" : "free"; try { localStorage.setItem("dw.orbit.mode", modeNow); } catch (e) { /* kept for this visit */ } try { window.dispatchEvent(new Event("dw:orbit-mode")); } catch (e) { /* no window */ } return modeNow; }
/** The EDGE BAND of a view of w × h pixels : a drag that starts there rolls the picture in the plane of the screen. Its width ; and
    whether a point is in it — never in a view too small to have a middle left. */
export const rollBand = (w, h) => Math.max(26, Math.min(46, Math.min(w, h) * 0.075));
export const inRollBand = (x, y, w, h) => { const b = rollBand(w, h); return w >= 280 && h >= 220 && x >= 0 && y >= 0 && x <= w && y <= h && (x < b || y < b || x > w - b || y > h - b); };
/** The roll that follows the hand round the centre of the view, from one position of the pointer to the next (pixels of the screen,
    y down) : clockwise is positive, as the picture goes. Across the half turn the short way round is taken. */
export function rollStep(cx, cy, x0, y0, x1, y1) { let a = Math.atan2(y1 - cy, x1 - cx) - Math.atan2(y0 - cy, x0 - cx); if (a > Math.PI) a -= 2 * Math.PI; else if (a < -Math.PI) a += 2 * Math.PI; return a; }
/** The step of a key or of a button, in degrees : 15, 5 with Ctrl, 90 with Shift. */
export const turnStep = (e = {}) => (e.shiftKey ? 90 : e.ctrlKey || e.metaKey ? 5 : 15);
/** What an arrow key turns, as the hand would go : → { dx, dy, roll } in radians (right, down and clockwise are positive), or null.
    ← → ↑ ↓ turn the view to the left, the right, the top and the bottom ; Alt + ← / → rolls it in the plane of the screen. */
export function keyTurn(key, e = {}) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key], a = turnStep(e) * Math.PI / 180; if (!d) return null;
  if (e.altKey) return d[0] ? { dx: 0, dy: 0, roll: d[0] * a } : null;
  return { dx: d[0] * a, dy: d[1] * a, roll: 0 };
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
/** An arrow that goes round a ring, for a turn that does not end : its head at `angle`, its tail `len` behind, the way it goes
    (−1, 0, 1 ; 0 : nothing to draw). */
export const cometOf = (point, angle, way, len = 0.9) => (way ? arcOf((p) => point(angle - way * len + p), way * len) : { d: "", head: "" });
/** The ways of the automatic rotation, one switch per axis (x : about Z, y : the tilt, r : the roll ; −1, 0, 1). A way chosen
    again goes off, the opposite way of the same axis replaces it, the other axes are left as they are : two or three combine.
    No axis : everything stops. → a new { x, y, r } */
export const autoToggled = (now, axis, val) => (axis ? { x: now.x || 0, y: now.y || 0, r: now.r || 0, [axis]: now[axis] === val ? 0 : val } : { x: 0, y: 0, r: 0 });
/** « Z ▶ + ▲ · 27 °/s » : what the automatic rotation is doing, with the signs of its buttons ("" at rest) — short : the panel sits just beside it. */
export function autoText(a, deg) { const w = [a.x ? `Z ${a.x > 0 ? "▶" : "◀"}` : "", a.y ? (a.y > 0 ? "▼" : "▲") : "", a.r ? (a.r > 0 ? "↻" : "↺") : ""].filter(Boolean); return w.length ? `${w.join(" + ")} · ${deg} °/s` : ""; }
/** How far the hold has come toward the automatic rotation : 0 before the pivot shows, 1 at two seconds. */
export const holdProgress = (ms) => Math.max(0, Math.min(1, (ms - ORBIT.show) / (ORBIT.hold - ORBIT.show)));
/** « Z 34° · incl. 12° · plan 8° » : what was turned since the press (rad) ; free : the turn is about the screen, not about Z (« ↔ 34° »). */
export function orbitText(yaw, tilt, roll = 0, free = false) { const d = (a) => Math.round(Math.abs(a) * 180 / Math.PI); return [d(yaw) ? `${free ? "↔" : "Z"} ${d(yaw)}°` : "", d(tilt) ? `${free ? "↕" : "incl."} ${d(tilt)}°` : "", d(roll) ? `plan ${d(roll)}°` : ""].filter(Boolean).join(" · "); }

/* ---------- the page ---------- */
const NS = "http://www.w3.org/2000/svg", STORE = "dw.orbit";
const S = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const H = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

/** The cue and the automatic rotation of one viewer (core/viewer.js : target, dir, camera, el, canvas, toScreen, _pick, _cam).
    → { edge(e) (is this press on the edge band ?), press(e, drag), turn(dx, dy, roll, e) (pixels ; roll : Alt is down), release(),
        hover(e | null), step({ dx, dy, roll }) (a key, a button), sized(w, h), stop(), dispose() } */
export function mountOrbit(viewer) {
  const R = ORBIT.radius, box = 2 * (R + 30);
  const svg = S("svg", { class: "dw-orbit", viewBox: `${-box / 2} ${-box / 2} ${box} ${box}`, width: box, height: box, "aria-hidden": "true" });
  const level = S("g"), axis = S("line", { class: "ax", x1: 0, x2: 0 }), zed = S("text", { class: "zed", x: 0 }), ring = S("ellipse", { class: "ring", cx: 0, cy: 0 }), tilt = S("ellipse", { class: "ring", cx: 0, cy: 0, rx: R * 0.34, ry: R });
  const yawArc = S("path", { class: "arc" }), yawHead = S("polygon", { class: "head" }), tiltArc = S("path", { class: "arc tilt" }), tiltHead = S("polygon", { class: "head tilt" }), rollArc = S("path", { class: "arc roll" }), rollHead = S("polygon", { class: "head roll" });
  const hold = S("circle", { class: "hold", cx: 0, cy: 0, r: 15, pathLength: 100 }), dot = S("circle", { class: "pivot", cx: 0, cy: 0, r: 4.2 });
  zed.textContent = "Z"; level.append(axis, zed, ring, yawArc, yawHead); svg.append(level, tilt, tiltArc, tiltHead, rollArc, rollHead, hold, dot);      // level : what lies with the Z of the model, turned as Z lies on the screen
  const note = H("div", "dw-orbit-note"); svg.hidden = true; note.hidden = true; viewer.el.append(svg, note);
  /* the edge band, lit under the pointer ; under the triad, the two arrows that roll the picture and the switch free / turntable */
  const band = H("div", "dw-roll-band"), bandNote = H("span", "", "↻ glisser le bord : tourner dans le plan de l'écran"); band.append(bandNote);
  const ctl = H("div", "dw-view-turn"), modes = H("div", "seg text"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "Rotation de la vue à la souris"); ctl.setAttribute("role", "group"); ctl.setAttribute("aria-label", "Tourner la vue");
  /* the pictogram of a turn in the plane : an arc with its arrow round a point — not the bare round arrow of « undo » */
  const turnIcon = () => { const i = S("svg", { viewBox: "0 0 18 18", width: 18, height: 18, "aria-hidden": "true" }); i.append(S("path", { d: "M14.6 9a5.6 5.6 0 1 1-1.9-4.2", fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linecap": "round" }), S("path", { d: "M14.3 1.5v4.4H9.9z", fill: "currentColor" }), S("circle", { cx: 9, cy: 9, r: 1.7, fill: "currentColor" })); return i; };
  const rollBtn = (glyph, way, label) => { const b = H("button", `dw-view-roll${way < 0 ? " ccw" : ""}`); b.append(turnIcon()); b.type = "button"; b.setAttribute("aria-label", label); b.dataset.tip = `${label} — 15° ; Maj : 90° ; Ctrl : 5° (Alt + ${way < 0 ? "←" : "→"})`; b.dataset.roll = way;
    b.addEventListener("click", (e) => step({ dx: 0, dy: 0, roll: way * turnStep(e) * Math.PI / 180 })); return b; };
  for (const m of ORBIT_MODES) { const b = H("button", "seg-btn", m.label); b.type = "button"; b.dataset.mode = m.key; b.dataset.tip = m.tip; b.addEventListener("click", () => setOrbitMode(m.key)); modes.append(b); }
  ctl.append(rollBtn("↺", -1, "Tourner la vue dans le plan de l'écran, sens antihoraire"), rollBtn("↻", 1, "Tourner la vue dans le plan de l'écran, sens horaire"), modes); viewer.el.append(band, ctl);
  const paintMode = () => { for (const b of modes.children) { const on = b.dataset.mode === orbitMode(); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } };
  window.addEventListener("dw:orbit-mode", paintMode); paintMode();
  let pivot = null, yaw = 0, tip = 0, spun = 0, went = [0, 0, 0], timers = [], t0 = 0, raf = 0, auto = null, panel = null, rolling = null, flash = 0, free = false;      // rolling : the last place of the pointer, while a drag from the edge band rolls the picture ; flash : the cue of a key or of a button, shown a moment      // yaw : the turn of the camera about Z ; tip, spun : as the hand went ; went : the way of the last step on each axis ; auto : { x, y, r (−1, 0, 1), sense, speed, last }

  /* the camera as it stands : its up is the real up of the screen, square to the line of sight, whatever a preset left in camera.up */
  const cam = () => { viewer._cam(); const m = viewer.camera.matrixWorld.elements; return { target: viewer.target.toArray(), dir: viewer.dir.toArray(), up: [m[4], m[5], m[6]], right: [m[0], m[1], m[2]] }; };
  /* angles as the hand goes : right and down are positive ; the model follows the hand — what is near goes right when the hand goes
     right, down when it goes down (the eye then rises : more of the top shows), as in the usual orbit of 3D tools */
  /* sense : the automatic rotation keeps the turn about Z it started with (1, −1) — a turn that also tilts goes over the top, and
     the spin must not turn back there ; by hand (0) the model follows the hand, upside down too */
  function apply(dxAngle, dyAngle, rollAngle = 0, sense = 0) {
    free = !sense && orbitMode() === "free";      // by hand, the free orbit unless the turntable is chosen ; the automatic rotation keeps its axes — about Z, the tilt, the roll
    const c = cam(), turn = free ? -dxAngle : sense ? -dxAngle * sense : yawOf(dxAngle, c.up[2]), next = free ? orbitFree(c, pivot, dxAngle, dyAngle, rollAngle) : orbitAbout(c, pivot, turn, dyAngle, rollAngle);
    viewer.target.set(...next.target); viewer.dir.set(...next.dir); viewer.camera.up.set(...next.up); viewer.dirty = true;
    yaw += turn; tip += dyAngle; spun += rollAngle; went = [Math.sign(turn), Math.sign(dyAngle), Math.sign(rollAngle)];
  }
  function place() {
    if (!pivot) return; const [sx, sy] = viewer.toScreen(pivot), r = viewer.el.getBoundingClientRect(), x = sx - r.left, y = sy - r.top;
    svg.style.left = `${x - box / 2}px`; svg.style.top = `${y - box / 2}px`; note.style.left = `${x}px`; note.style.top = `${y + R + 26}px`;
    if (panel && !panel.dataset.placed) { panel.style.left = `${Math.max(6, Math.min(r.width - 204, x + R + 20))}px`; panel.style.top = `${Math.max(6, Math.min(r.height - 196, y - 84))}px`; }
  }
  /* full : the rings and the arcs ; else the pivot alone (and how far the hold has come) */
  function draw(full, progress = 0) {
    const loose = free && !auto, c = cam(), g = loose ? { rx: R, ry: R * 0.34, below: false, axis: 0 } : ringOf(c.dir[2], R); svg.hidden = false; svg.classList.toggle("full", full); svg.classList.toggle("free", loose);      // free : the ring lies with the screen, and there is no Z to show
    level.setAttribute("transform", `rotate(${loose ? 0 : horizonOf(c.right, c.up).toFixed(1)})`);
    axis.setAttribute("y1", -g.axis - 8); axis.setAttribute("y2", g.axis + 8); zed.setAttribute("y", -g.axis - 15); ring.setAttribute("rx", g.rx); ring.setAttribute("ry", g.ry);
    const onRing = (p) => ringPoint(g, p), onTilt = (p) => tiltPoint(R, p), onRoll = (p) => rollPoint(R + 12, p);      // a point of the ring goes the other way round than the camera
    const [a, b, s] = auto ? [cometOf(onRing, -yaw, -went[0]), cometOf(onTilt, tip, went[1]), cometOf(onRoll, spun, went[2])] : [arcOf(onRing, -yaw), arcOf(onTilt, tip), arcOf(onRoll, spun)];      // by hand : what was turned since the press ; alone : one arrow per axis that goes, round its ring
    yawArc.setAttribute("d", a.d); yawHead.setAttribute("points", a.head); tiltArc.setAttribute("d", b.d); tiltHead.setAttribute("points", b.head); rollArc.setAttribute("d", s.d); rollHead.setAttribute("points", s.head);
    hold.style.strokeDasharray = `${Math.round(progress * 100)} 100`; hold.style.display = progress > 0 && progress < 1 ? "" : "none";
    const text = auto ? autoText(auto, autoSpeed(auto.speed).deg) : full ? orbitText(yaw, tip, spun, loose) : progress > 0 ? "maintenez : rotation automatique" : ""; note.hidden = !text; note.textContent = text;
    place();
  }
  const hide = () => { svg.hidden = true; note.hidden = true; }, clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; cancelAnimationFrame(raf); raf = 0; };
  /* a screen that waits for a click in the view (a tool armed, a place to point at) keeps the hold for itself */
  const taken = () => (typeof viewer.holdBusy === "function" && viewer.holdBusy()) || viewer.mode !== "select" || getComputedStyle(viewer.canvas).cursor === "crosshair";

  /* the edge band : is the pointer on it — and may a drag from there roll the picture (no tool armed, a mouse or a pen) ? */
  const where = (e) => { const r = viewer.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  const edge = (e) => { if (!e || e.pointerType === "touch" || e.button > 0 || e.shiftKey || taken()) return false; const p = where(e); return inRollBand(p.x, p.y, p.w, p.h); };
  const light = (on) => { if (band.classList.contains("on") === on) return; band.classList.toggle("on", on); viewer.el.classList.toggle("dw-roll-edge", on); if (on) { const r = viewer.el.getBoundingClientRect(); band.style.borderWidth = `${rollBand(r.width, r.height)}px`; } };
  function hover(e) { if (!rolling) light(!!e && !auto && edge(e)); }
  /* a key or a button : one step about the centre of the view, and the cue a moment */
  function step(t) { if (auto || !t) return; clearTimers(); if (!flash) { yaw = 0; tip = 0; spun = 0; } clearTimeout(flash); pivot = viewer.target.toArray(); apply(t.dx, t.dy, t.roll); draw(true); flash = setTimeout(() => { flash = 0; hide(); }, 900); }
  function sized(w, h) { ctl.hidden = w < 300 || h < 250; if (ctl.hidden) light(false); }
  function press(e, drag) {
    endAuto(); clearTimers(); clearTimeout(flash); flash = 0;
    if (drag.roll) { pivot = viewer.target.toArray(); yaw = 0; tip = 0; spun = 0; rolling = [e.clientX, e.clientY]; light(true); return; }      // from the edge band : round the centre of the view, and no hold
    const hit = viewer._pick(e); pivot = hit ? hit.point.slice() : viewer.target.toArray(); yaw = 0; tip = 0; spun = 0; t0 = performance.now(); light(false);
    if (e.pointerType === "touch" || taken()) return;
    const grow = () => { if (!timers.length) return; draw(false, holdProgress(performance.now() - t0)); raf = requestAnimationFrame(grow); };
    timers = [setTimeout(grow, ORBIT.show), setTimeout(() => { clearTimers(); drag.auto = true; startAuto(); }, ORBIT.hold)];      // drag.auto : the release that follows is not a click
  }
  function turn(dx, dy, roll = false, e = null) {
    if (!pivot || auto) return; clearTimers();
    if (rolling && e) { const p = where(e); apply(0, 0, rollStep(p.cx, p.cy, rolling[0], rolling[1], e.clientX, e.clientY)); rolling = [e.clientX, e.clientY]; }      // the picture goes round the centre as the hand does
    else if (roll) apply(0, 0, dx * ORBIT.perPixel); else apply(dx * ORBIT.perPixel, dy * ORBIT.perPixel);
    draw(true);
  }
  function release() { clearTimers(); if (rolling) { rolling = null; light(false); } if (!auto) hide(); }

  /* ---------- the automatic rotation ---------- */
  function startAuto() {
    let speed = "slow"; try { speed = autoSpeed(localStorage.getItem(STORE)).key; } catch (e) { /* a private window */ }
    auto = { x: 0, y: 0, r: 0, sense: 1, speed, last: 0 }; yaw = 0; tip = 0; spun = 0; went = [0, 0, 0];
    panel = H("div", "dw-auto"); panel.setAttribute("role", "group"); panel.setAttribute("aria-label", "Rotation automatique de la vue");
    const head = H("div", "dw-auto-head"), pad = H("div", "dw-auto-pad"), speeds = H("div", "seg text"); speeds.setAttribute("role", "group"); speeds.setAttribute("aria-label", "Vitesse de rotation");
    const close = H("button", "icon-btn", "×"); close.type = "button"; close.setAttribute("aria-label", "Arrêter la rotation automatique"); close.dataset.tip = "Arrêter et fermer (Échap)"; close.addEventListener("click", endAuto);
    const grip = H("span", "dw-auto-grip", "⠿"), dockBtn = H("button", "icon-btn dw-auto-dock", "⇥"); grip.setAttribute("aria-hidden", "true"); dockBtn.type = "button";
    head.dataset.tip = "Glisser la poignée pour déplacer la rotation dans la vue"; head.append(grip, H("b", "", "Rotation automatique"), dockBtn, close);
    /* one switch per axis : a way goes on or off without touching the other axes, so two or three combine ; ■ stops them all */
    const way = (cls, label, glyph, axis = "", val = 0) => { const b = H("button", `dw-auto-way ${cls}`, glyph); b.type = "button"; b.setAttribute("aria-label", label); b.dataset.tip = axis ? `${label} — se combine avec un autre sens` : label; b.dataset.axis = axis; b.dataset.val = val;
      b.addEventListener("click", () => { Object.assign(auto, autoToggled(auto, axis, val), { last: 0 }); if (axis === "x" && auto.x) auto.sense = cam().up[2] < 0 ? -1 : 1; went = [0, 0, 0]; paint(); draw(true); if (!raf && going()) raf = requestAnimationFrame(spin); }); return b; };
    pad.append(way("rl", "Rouler vers la gauche", "↺", "r", -1), way("up", "Basculer vers le haut", "▲", "y", -1), way("rr", "Rouler vers la droite", "↻", "r", 1), way("left", "Tourner vers la gauche, autour du Z", "◀", "x", -1), way("stop", "Tout arrêter"), way("right", "Tourner vers la droite, autour du Z", "▶", "x", 1), way("down", "Basculer vers le bas", "▼", "y", 1));
    for (const s of AUTO_SPEEDS) { const b = H("button", "seg-btn", s.label); b.type = "button"; b.dataset.speed = s.key; b.dataset.tip = `${s.deg}° par seconde`; b.addEventListener("click", () => { auto.speed = s.key; try { localStorage.setItem(STORE, s.key); } catch (e) { /* kept for this visit */ } paint(); }); speeds.append(b); }
    /* the animation (point 17) : what the view shows, recorded until the next click ; or one full turn about Z, recorded, then the rotation stops */
    const recRow = H("div", "dw-auto-rec"), recBtn = H("button", "chip-btn dw-auto-record"), turnBtn = H("button", "chip-btn dw-auto-turn", "↻ Un tour enregistré"); recBtn.type = "button"; turnBtn.type = "button";
    recBtn.dataset.tip = "Enregistrer ce que la vue montre, en vidéo WebM, jusqu'au prochain clic — pour une revue de conception"; turnBtn.dataset.tip = "Un tour complet autour du Z, à la vitesse choisie, enregistré en vidéo WebM ; la rotation s'arrête ensuite";
    recBtn.addEventListener("click", () => (rec ? stopRec() : startRec())); turnBtn.addEventListener("click", oneTurn); recRow.append(recBtn, turnBtn);
    panel.append(head, pad, speeds, recRow, H("small", "dw-auto-hint", "Un sens, ou deux à la fois : ils se combinent. Échap arrête.")); viewer.el.append(panel); mountAutoDock(panel, head, viewer, dockBtn);
    window.addEventListener("keydown", onKey, true); paint(); draw(true);
  }
  const going = () => !!(auto && (auto.x || auto.y || auto.r));
  let rec = null, recTick = 0, turnEnd = 0;
  function paintRec() { const b = panel && panel.querySelector(".dw-auto-record"); if (!b) return; b.textContent = rec ? `■ Arrêter · ${Math.round(rec.seconds())} s` : "● Enregistrer"; b.classList.toggle("on", !!rec); b.setAttribute("aria-pressed", rec ? "true" : "false"); }
  function startRec() { if (rec) return; rec = recordView(viewer.canvas, { caption: shareName(location.hash), name: location.hash }); if (!rec) return; recTick = setInterval(paintRec, 500); paintRec(); }
  function stopRec() { clearInterval(recTick); clearTimeout(turnEnd); recTick = 0; turnEnd = 0; const r = rec; rec = null; paintRec(); return r ? r.stop() : null; }
  function oneTurn() {
    if (!auto) startAuto();
    Object.assign(auto, { x: 1, y: 0, r: 0, last: 0 }); auto.sense = cam().up[2] < 0 ? -1 : 1; went = [0, 0, 0]; paint(); draw(true); if (!raf) raf = requestAnimationFrame(spin);
    startRec(); clearTimeout(turnEnd); turnEnd = setTimeout(() => { if (auto) { auto.x = 0; paint(); } stopRec(); }, turnSeconds(autoSpeed(auto.speed).deg) * 1000 + 250);
  }
  function paint() {
    if (!panel) return; paintRec();
    for (const b of panel.querySelectorAll(".dw-auto-way[data-axis]")) { if (!b.dataset.axis) continue; const on = auto[b.dataset.axis] === +b.dataset.val; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    for (const b of panel.querySelectorAll("[data-speed]")) { const on = b.dataset.speed === auto.speed; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
  }
  function spin(t) {
    raf = 0; if (!auto || !viewer.alive) return; if (!going()) { went = [0, 0, 0]; draw(true); return; }
    const dt = auto.last ? Math.min(0.05, (t - auto.last) / 1000) : 0, w = autoSpeed(auto.speed).deg * Math.PI / 180; auto.last = t;
    apply(auto.x * w * dt, auto.y * w * dt, auto.r * w * dt, auto.sense); draw(true); raf = requestAnimationFrame(spin);
  }
  function onKey(e) { if (e.key === "Escape" && auto) { e.stopPropagation(); endAuto(); } }
  function endAuto() { if (!auto) return; if (rec) stopRec(); auto = null; cancelAnimationFrame(raf); raf = 0; window.removeEventListener("keydown", onKey, true); if (panel) { const had = panel.contains(document.activeElement); panel.remove(); panel = null; if (had) viewer.canvas.focus({ preventScroll: true }); } hide(); }      // the keys of the view (F, 0 … 6) work again at once

  return { edge, hover, step, sized, press, turn, release, stop: () => { clearTimers(); endAuto(); hide(); }, dispose: () => { clearTimers(); clearTimeout(flash); endAuto(); window.removeEventListener("dw:orbit-mode", paintMode); svg.remove(); note.remove(); band.remove(); ctl.remove(); }, auto: () => (auto ? { ...auto } : null), pivot: () => (pivot ? pivot.slice() : null), oneTurn, recording: () => !!rec };
}
