/* DynamiteOrbit.ai — Assemblage : the handle that MOVES the chosen part and snaps it on an interface (demande de JP, 28 novembre 2026 : « que
   l'interface soit reconnue pour le mating en promenant la pièce devant l'interface parent à l'écran »). In the middle of the part chosen, a
   square grip with the arrows of a move. Dragged, the part (and what hangs on it) follows the hand in the plane of the screen ; the free
   interfaces it can mate with show as rings ; when one of its own interfaces comes within REACH pixels of one of them, the ring lights up,
   the part is shown where that joint puts it, and releasing makes the joint — ONE undoable step. Pulled further, it lets go. A part a joint
   holds stays put until the hand is REACH pixels away : then it comes off, and can be dropped anywhere or on another interface. Escape gives
   the gesture up. For the keyboard : the arrows move a free part by 5 mm in the plane of the screen (Shift : 25, Alt : 1), Enter snaps it
   on the compatible interface nearest on the screen. The convention : the drag and drop on a feature of the mechanical modellers
   (SolidWorks SmartMates, the Assemble command of Inventor) — the model is core/asm_snap.js. */

import { icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { matMul, matPoint, IDENTITY } from "../cad/vec.js";
import { nextJoint } from "../core/assembly_logic.js";
import { dragPlan, snapPick, letsGo, screenMove, applySnap, applyDrop, REACH } from "../core/asm_snap.js";

const LIT = "#e2740c", RING = "#0d9488";

/** o : { id (of the assembly), ctx() → what buildAssembly gave (or null), selected() → the instance chosen (or null), name(id) → text,
    quiet() (when the gesture starts : what else the view shows of the part steps aside), back() (when it is given up : it comes back) }
    → { draw() (after the scene is shown) } */
export function mountDrag(vp, o) {
  const v = vp.viewer;
  let live = null, refocus = false;
  const plan = () => { const c = o.ctx(), sel = o.selected(), a = store.assembly(o.id); return c && sel && a ? dragPlan(a, c.asm, c.sol, c.built, sel) : null; };
  const toScreen = (p) => v.toScreen(p);
  /* where every part of the block is drawn when the block has moved by D */
  function place(P, D) {
    const at = o.ctx().sol.placements; for (const k of v.objects.keys()) { const leaf = k.slice(0, k.indexOf("/")); if (P.moving.includes(leaf) && at[leaf]) v.setMatrix(k, matMul(D, at[leaf])); }
    const rec = live && v.labels.find((l) => l.el === live.grip); if (rec) rec.p.set(...matPoint(D, live.home));      // the grip stays under the hand, with the part
    v.dirty = true;
  }
  function rings(P, lit) {
    v.clearOverlays("drag-live");
    for (const t of P.targets) v.addMarker(t.at, lit && lit.target === t ? LIT : RING, "drag-live", lit && lit.target === t ? 1.6 : 1);
    if (lit) { v.addPath([lit.target.at, matPoint(lit.D, lit.target.from)], LIT, "drag-live", 0.6, true); v.addLabel(lit.target.at, lit.target.label, "drag-live", "snap-note"); }
  }
  /* the drop on a target : one step — or none, when the part is dropped back on the joint that held it */
  function snap(P, t) {
    const doc = store.assembly(o.id); if (!applySnap(JSON.parse(JSON.stringify(doc)), P, t)) return null;
    let m = null; store.updateAssembly(o.id, (x) => { m = applySnap(x, P, t); }, `Emboîtement de ${o.name(P.inst)} sur ${t.label} (M${nextJoint(doc)})`); return m;
  }
  function start(e, P, grip) {
    if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); grip.setPointerCapture(e.pointerId);
    v._cam(); const b = v.canvas.getBoundingClientRect();
    live = { P, grip, home: (v.labels.find((l) => l.el === grip) || { p: { toArray: () => P.centre } }).p.toArray(), x0: e.clientX, y0: e.clientY, perPx: v.span / (b.height || 1), right: v._right.toArray(), up: v._up.toArray(), free: !P.hold, D: IDENTITY, lit: null };
    grip.classList.add("on"); delete grip.dataset.tip; if (o.quiet) o.quiet(); rings(P, null);      // the grip itself is kept : it holds the pointer until the release ; the ring that turns the part and the tip step aside
    const move = (ev) => {
      if (!live) return; const dx = ev.clientX - live.x0, dy = ev.clientY - live.y0;
      if (!live.free) { if (!letsGo(dx, dy)) return; live.free = true; }      // a held part stays until the hand pulls it away
      const D = screenMove(dx, dy, live.right, live.up, live.perPx), hit = snapPick(P, D, toScreen);
      live.lit = hit ? { target: hit.target, D } : null; live.D = hit ? hit.target.delta : D;
      place(P, live.D); rings(P, live.lit);
    };
    const end = (keep) => {
      grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); window.removeEventListener("keydown", esc, true);
      const l = live; v.clearOverlays("drag-live"); if (!l) return; grip.classList.remove("on");
      if (keep && l.lit) { const m = snap(P, l.lit.target); live = null; if (!m) { place(P, IDENTITY); draw(); if (o.back) o.back(); } return; }
      live = null;
      if (keep && l.free && l.D !== IDENTITY) { store.updateAssembly(o.id, (x) => { applyDrop(x, P, l.D); }, P.hold ? `${o.name(P.inst)} : détachement et déplacement` : `${o.name(P.inst)} : déplacement`); return; }
      live = l; place(P, IDENTITY); live = null; draw(); if (o.back) o.back();      // given up : everything back where it was
    };
    const up = () => end(true), esc = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); end(false); } };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); window.addEventListener("keydown", esc, true);
  }
  function key(e, P) {
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const best = snapPick(P, IDENTITY, toScreen, Infinity); refocus = true; if (best) snap(P, best.target); return; }
    const way = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!way || P.hold) return;
    e.preventDefault(); e.stopPropagation(); refocus = true; v._cam();
    const step = e.altKey ? 1 : e.shiftKey ? 25 : 5;
    store.updateAssembly(o.id, (x) => { applyDrop(x, P, screenMove(way[0] * step, way[1] * step, v._right.toArray(), v._up.toArray(), 1)); }, `${o.name(P.inst)} : déplacement de ${step} mm`);
  }
  function draw() {
    const held = refocus || !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("move-grip")); refocus = false;
    v.clearOverlays("drag"); if (live) return;
    const P = plan(); if (!P || P.ground) return;      // the base does not move : everything else is placed from it
    /* the grip goes where the hand can take it : in the middle of the part, or nearer the middle of the view when that place is under an edge */
    v._cam(); const b = v.canvas.getBoundingClientRect(), seen = (q) => { const [x, y] = v.toScreen(q); return x > b.left + 40 && x < b.right - 40 && y > b.top + 70 && y < b.bottom - 40; }, mid = v.target.toArray();
    const at = [0, 0.25, 0.5, 0.75].map((k) => P.centre.map((c, i) => c + (mid[i] - c) * k)).find(seen) || P.centre;
    const grip = v.addLabel(at, "", "drag", "move-grip", () => {}), n = P.targets.length, name = o.name(P.inst);
    grip.append(icon("drag")); grip.dataset.move = P.hold ? "held" : "free"; grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", `Déplacer ${name}${n ? ` — ${n} interface${n > 1 ? "s" : ""} compatible${n > 1 ? "s" : ""}` : ""}`);
    grip.dataset.tip = `${P.hold ? `Tenue par ${P.hold} : tirez-la de ${REACH} px pour la détacher. ` : ""}Glisser : déplacer ${name} dans le plan de l'écran — ${n ? `elle s'emboîte quand une de ses interfaces passe devant ${n > 1 ? `l'une des ${n} interfaces compatibles (anneaux verts)` : "l'interface compatible (anneau vert)"}` : "aucune interface libre compatible dans l'assemblage"} ; Échap abandonne.${P.hold ? "" : " Clavier : ← ↑ → ↓ 5 mm (Maj : 25, Alt : 1)."}${n ? " Entrée : l'emboîter sur la plus proche." : ""}`;
    grip.addEventListener("pointerdown", (e) => start(e, P, grip)); grip.addEventListener("keydown", (e) => key(e, P));
    if (held) grip.focus({ preventScroll: true });
  }
  return { draw };
}
