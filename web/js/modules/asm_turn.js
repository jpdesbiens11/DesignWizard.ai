/* DesignWizard.ai — Assemblage : the handle that turns the chosen part (demande de JP : « tourner une pièce elle-même… avec une
   poignée dans la vue, au lieu de taper un angle »). Round the part chosen, a ring about the axis it can turn on — the vertical for
   a part placed by hand, the normal of its joint for a part a joint holds — and, on the ring, a round grip. Dragging the grip turns
   the part as the hand goes round the axis : 5° a notch, 15° with Shift, free with Alt ; everything that hangs on it follows, live
   (the assembly is solved again at each notch : the preview is what the release leaves). Released, it is ONE undoable step ; Escape
   gives it up. The grip is a slider for the keyboard (← → : a notch), and the card of the part has the same angle as a number.
   The convention is the rotation ring of the manipulators of mechanical modellers ; the model is core/asm_turn.js. */

import { el, field, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { solveLevels } from "../core/assembly_logic.js";
import { v3 } from "../cad/vec.js";
import { turnOf, withTurn, applyTurn, ringFrame, ringFrom, ringAt, ringPoints, ringAngle, turnDelta, snapTurn, turnSnap, turnText, wrapTurn } from "../core/asm_turn.js";

const COLOR = "#e2740c";

/** o : { id (of the assembly), ctx() → what buildAssembly gave (or null), selected() → the instance chosen (or null), name(id) → text }
    → { draw() (after the scene is shown), section() → the group « Orientation » of the card, or null } */
export function mountTurn(vp, o) {
  const v = vp.viewer, find = (x) => store.assembly(x);
  let live = null, refocus = false;
  const what = () => { const c = o.ctx(), sel = o.selected(), a = store.assembly(o.id); return c && sel && a ? turnOf(a, sel, { built: c.built, find, solved: { asm: c.asm, sol: c.sol } }) : null; };
  const said = (t, d) => (t.kind === "mate" ? `${o.name(t.inst)} tournée de ${turnText(d)} sur l'accouplement ${t.mate}` : `${o.name(t.inst)} tournée de ${turnText(d)} autour de Z`);
  const commit = (t, d) => { if (d) store.updateAssembly(o.id, (x) => { applyTurn(x, t, d); }, said(t, d)); };
  /* the ray under the pointer, in the model : a point and a direction */
  const rayOf = (e) => { const b = v.canvas.getBoundingClientRect(); v._cam(); v.raycaster.setFromCamera({ x: ((e.clientX - b.left) / b.width) * 2 - 1, y: -((e.clientY - b.top) / b.height) * 2 + 1 }, v.camera); return [v.raycaster.ray.origin.toArray(), v.raycaster.ray.direction.toArray()]; };
  /* every part where the assembly, solved with the turn, puts it */
  function preview(d) {
    const s = solveLevels(withTurn(live.doc, live.t, d), live.ctx.built, find), at = s.sol.placements;
    for (const id of v.objects.keys()) { const M = at[id.slice(0, id.indexOf("/"))]; if (M) v.setMatrix(id, M); }
    v.clearOverlays("turn-live");
    if (d) { v.addPath(ringPoints(live.t.centre, live.fr, live.r, 0, d), COLOR, "turn-live", 1.5); v.addLabel(ringAt(live.t.centre, live.fr, live.r * 1.16, d / 2), turnText(d), "turn-live", "turn-note"); }
    const rec = v.labels.find((l) => l.el === live.grip); if (rec) rec.p.set(...ringAt(live.t.centre, live.fr, live.r, d));
    live.grip.setAttribute("aria-valuetext", turnText(d)); v.dirty = true;
  }
  function start(e, t, fr, r, grip) {
    if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); grip.setPointerCapture(e.pointerId);
    const [ro, rd] = rayOf(e), a0 = ringAngle(ro, rd, t.centre, t.axis, fr), s0 = v.toScreen(ringAt(t.centre, fr, r, 0)), s1 = v.toScreen(ringAt(t.centre, fr, r, 2)), px = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) / 2 || 1;
    live = { t, fr, r, grip, doc: store.assembly(o.id), ctx: o.ctx(), last: a0, acc: 0, delta: 0, x0: e.clientX, y0: e.clientY, tan: [(s1[0] - s0[0]) / (2 * px), (s1[1] - s0[1]) / (2 * px)], px };
    grip.classList.add("on");
    const move = (ev) => {
      if (!live) return; const [o2, d2] = rayOf(ev), a = live.last === null ? null : ringAngle(o2, d2, t.centre, t.axis, fr); let d;
      if (a === null) d = ((ev.clientX - live.x0) * live.tan[0] + (ev.clientY - live.y0) * live.tan[1]) / live.px;      // the ring seen edge-on : along its tangent on the screen
      else { live.acc += turnDelta(live.last, a); live.last = a; d = live.acc; }      // round the axis, as the hand goes — more than a turn if it does
      d = snapTurn(d, turnSnap(ev)); if (d !== live.delta) { live.delta = d; preview(d); }
    };
    const end = (keep) => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); window.removeEventListener("keydown", esc, true); const l = live; live = null; if (!l) return;
      if (keep && l.delta) commit(l.t, l.delta); else { live = l; preview(0); live = null; draw(); } };
    const up = () => end(true), esc = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); end(false); } };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); window.addEventListener("keydown", esc, true);
  }
  function key(e, t) {
    const way = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!way) return;
    e.preventDefault(); e.stopPropagation(); refocus = true; commit(t, way * (e.altKey ? 1 : e.shiftKey ? 15 : 5));
  }
  function draw() {
    const held = refocus || !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("turn-grip")); refocus = false;      // the grip is drawn again with the scene : the keyboard stays on it
    v.clearOverlays("turn"); v.clearOverlays("turn-live"); if (live) return;
    const t = what(); if (!t) return;
    v._cam(); const first = ringFrame(t.axis, v._right.toArray()), r = Math.max(t.radius * 0.72, v.span * 0.07), half = v3.mul(v3.unit(t.axis), r * 0.45), b = v.canvas.getBoundingClientRect();
    /* the grip goes where the hand can take it : on the right of the ring, or further round when that place is out of the view (a part near an edge) */
    const seen = (p) => { const [x, y] = v.toScreen(p); return x > b.left + 30 && x < b.right - 30 && y > b.top + 70 && y < b.bottom - 30; };
    const fr = ringFrom(first, [0, 180, 90, 270, 45, 135, 225, 315].find((a) => seen(ringAt(t.centre, first, r, a))) || 0);
    v.addPath(ringPoints(t.centre, fr, r), COLOR, "turn", 0.55); v.addPath([v3.sub(t.centre, half), v3.add(t.centre, half)], COLOR, "turn", 0.45, true);
    const grip = v.addLabel(ringAt(t.centre, fr, r, 0), "", "turn", "turn-grip", () => {}), about = t.kind === "mate" ? `sur son accouplement ${t.mate}` : "autour de Z";
    grip.setAttribute("role", "slider"); grip.setAttribute("aria-label", `Tourner ${o.name(t.inst)} ${about}`); grip.setAttribute("aria-valuemin", "-180"); grip.setAttribute("aria-valuemax", "180"); grip.setAttribute("aria-valuenow", String(t.angle)); grip.setAttribute("aria-valuetext", `${String(t.angle).replace(".", ",")}°`);
    grip.dataset.tip = `Glisser : tourner ${o.name(t.inst)} ${about} — 5° par cran, Maj : 15°, Alt : libre ; ← → au clavier ; Échap abandonne`; grip.dataset.turn = t.kind;
    grip.addEventListener("pointerdown", (e) => start(e, t, fr, r, grip)); grip.addEventListener("keydown", (e) => key(e, t));
    if (held) grip.focus({ preventScroll: true });
  }
  /* the same angle as a number, in the card of the part : to type an exact value */
  function section() {
    const t = what(); if (!t) return null;
    const label = t.kind === "mate" ? `Angle de l'accouplement ${t.mate} (°)` : "Rotation autour de Z (°)";
    const input = el("input", { type: "number", step: "5", value: t.angle, "aria-label": label, "data-field": "turn", onChange: (e) => { const val = Number(e.target.value); if (Number.isFinite(val)) commit(t, t.kind === "mate" ? t.sign * wrapTurn(val - t.angle) : wrapTurn(val - t.angle)); } });
    return el("div", { class: "side-section", "data-fold-note": `${String(t.angle).replace(".", ",")}°` }, el("h3", null, "Orientation"), field(label, input, t.kind === "mate" ? "La pièce tourne autour de la normale de son accouplement ; ce qui tient à elle suit." : "La pièce est posée à la main : elle tourne autour de la verticale, par le milieu de sa boîte ; ce qui tient à elle suit."),
      el("p", { class: "atelier-hint", style: { margin: ".3rem 0 0" } }, icon("info"), " Ou glissez la poignée ronde orange, dans la vue : 5° par cran, Maj : 15°, Alt : libre."));
  }
  return { draw, section };
}
