/* DesignWizard.ai — Busbars : laying a hole, a terminal or a contact with the mouse, helped. The three tools of the view arm
   the placer (core/view_place.js) : the face of the leg under the pointer shows its 5 mm grid, the centre line catches the
   feature, the dimensions and the coordinates follow, a click drops it. A feature already there is picked up again by a
   two-second hold, or from its card. Here too : the card of a through hole, and the position of the chosen connection,
   to type in the left pane once it is laid. */

import { el, btn, field, unitField } from "../core/dom.js";
import { locate, legFace, legsOf, connections, addHole, addTerminal, addContact, fit, fitHole } from "../core/busbar.js";
import { createPlacer } from "../core/view_place.js";
import { snapPoint } from "../core/snap.js";
import { snapPrefs } from "../core/view_place.js";
import { ELEC_INTERFACES } from "../cad/interfaces_elec.js";

export const isContact = (x) => /^CT/.test(x.id), isHole = (x) => /^H\d/.test(x.id), kindOf = (x) => (isContact(x) ? "contact" : isHole(x) ? "hole" : "terminal");
const screwD = (x) => parseFloat(String(x.screw || "M6").replace(/[^0-9.]/g, "")) || 6, fr = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
/** Half-sizes of a connection, [along the leg, across] : what its ghost shows. */
export function halfOf(kind, x = {}) {
  if (kind === "hole") { const d = x.d || 6.6, l = x.l > d ? x.l : d; return x.turn ? [d / 2, l / 2] : [l / 2, d / 2]; }
  if (kind === "terminal") { const d = screwD(x) * 1.1; return [d / 2, d / 2]; }
  const P = ELEC_INTERFACES.contact.params, w = x.w || P.w, h = x.h || P.h; return x.turn ? [h / 2, w / 2] : [w / 2, h / 2];
}
export const TOOLS = [
  { kind: "hole", label: "Trou de passage", icon: "drill", tip: "Un trou traversant, rond ou oblong : survolez une face plane de la barre, cliquez pour le poser" },
  { kind: "terminal", label: "Borne vissée", icon: "bolt", tip: "Un trou de passage pour une vis, et l'interface vissée que l'autre pièce reprend" },
  { kind: "contact", label: "Contact à pression", icon: "power", tip: "Une plage de contact : bossages, lames ou bande" },
];
const NAME = { hole: "Trou de passage", terminal: "Borne", contact: "Contact" };

/** The placer of the screen. ctx : { viewer, host, def(), change(label, fn), choose(id) } → { placer, buttons, moveTool(x), drop(kind, w), moveTo(id, w), snapped(w, x) } */
export function busbarPlacer(ctx) {
  const margin = (kind, x) => halfOf(kind, x).map((v) => v + (kind === "contact" ? 0 : 1));
  const tool = (kind, x = null) => ({ kind, id: x ? x.id : null, label: x ? `${x.id} repris` : NAME[kind], size: halfOf(kind, x || {}), half: margin(kind, x || {}) });
  const where = (hit) => (hit && hit.normal ? locate(ctx.def(), hit.local || hit.point, hit.normal) : null);
  const drop = (kind, w) => ctx.change(`${NAME[kind]} posé`, (d) => { const x = kind === "hole" ? addHole(d, w) : kind === "terminal" ? Object.assign(addTerminal(d, w), { y: w.y }) : addContact(d, w); ctx.choose(x.id); });
  const moveTo = (id, w) => ctx.change(`${id} déplacé`, (d) => { const x = connections(d).length && [...d.terminals, ...d.contacts, ...(d.holes || [])].find((q) => q.id === id); if (!x) return;
    x.leg = w.leg; x.s = w.s; x.y = w.y; if (isContact(x)) { x.side = w.side; fit(d, x); } else if (isHole(x)) fitHole(d, x); else { const g = legsOf(d)[x.leg]; if (g) x.s = Math.max(g.from, Math.min(g.to, x.s)); } ctx.choose(id); });
  /** Where a plain click would lay a connection : the same catches as the armed tool, without the preview. */
  const snapped = (w, x) => { const kind = kindOf(x), f = legFace(ctx.def(), w, margin(kind, x), x.id), s = snapPoint([w.s, w.y], f, snapPrefs()); return { ...w, s: s.u, y: s.v }; };
  const placer = createPlacer(ctx.viewer, ctx.host, {
    face: (hit, t) => { const w = where(hit); return w ? legFace(ctx.def(), w, t.half, t.id) : null; },
    local: (hit) => { const w = where(hit); return [w.s, w.y]; },
    drop: (t, f, s) => { const w = { leg: f.leg, side: f.side, s: s.u, y: s.v }; if (t.id) moveTo(t.id, w); else drop(t.kind, w); },
    points: () => { const d = ctx.def(); return connections(d).map((x) => { const f = legFace(d, { leg: x.leg, side: x.side || 1 }); return f ? { id: x.id, x, label: `${x.id} — ${NAME[x.kind].toLowerCase()}`, p: f.P(x.s, x.y ?? d.W / 2) } : null; }).filter(Boolean); },
    pickUp: (found) => tool(found.x.kind, found.x),
  });
  const buttons = TOOLS.map((t) => btn(t.label, () => placer.arm(tool(t.kind)), { small: true, icon: t.icon, tip: t.tip }));
  for (const [k, b] of buttons.entries()) b.dataset.tool = TOOLS[k].kind;
  return { placer, buttons, moveTool: (x) => tool(kindOf(x), x), drop, moveTo, snapped };
}

/** The fields of a through hole, in its card. set(label, fn) edits it. */
export function holeFields(x, set) {
  const num = (key, label, step, min, tip) => unitField(label, { value: x[key] ?? 0, step, min, "data-tip": tip || null }, (v) => { if (v >= min) set(label, (q) => { if (key === "l" && !(v > q.d)) delete q.l; else q[key] = v; }); }, { event: "onChange" });
  return [el("div", { class: "form-row tight" }, num("d", "Diamètre (mm)", 0.1, 0.5, "Le diamètre du trou — ou la largeur d'un trou oblong"), num("l", "Longueur si oblong", 0.5, 0, "Plus grande que le diamètre : le trou devient oblong. 0 : un trou rond")),
    ...(x.l > x.d ? [el("label", { class: "check small" }, el("input", { type: "checkbox", checked: !!x.turn, onChange: (e) => set("sens de l'oblong", (q) => { if (e.target.checked) q.turn = 1; else delete q.turn; }) }), "Oblong en travers de la branche")] : [])];
}
/** The position of the chosen connection, typed : for the left pane, once it is laid with the mouse. */
export function positionSection(def, x, set, pickUp) {
  const g = legsOf(def)[x.leg], num = (key, label, max) => unitField(label, { value: key === "y" ? (x.y ?? def.W / 2) : x.s, step: 0.5, min: 0, max, "data-pos": key }, (v) => { if (Number.isFinite(v)) set(`${x.id} : ${label}`, (q) => { q[key] = v; }); }, { event: "onChange" });
  return el("div", { class: "side-section", "data-position": x.id }, el("h3", null, el("span", { class: "grow" }, `Position de ${x.id}`), btn("", pickUp, { small: true, icon: "mate", tip: "Le reprendre à la souris : il suit le pointeur, un clic le pose (ou maintenez deux secondes dessus, dans la vue)" })),
    el("div", { class: "form-row" }, num("s", "Le long de la branche (mm)", g ? g.L : undefined), num("y", "En travers (mm)", def.W)),
    el("p", { class: "muted small" }, `Branche ${x.leg + 1}${g ? `, longue de ${fr(g.L)} mm` : ""} ; largeur ${fr(def.W)} mm — l'axe est à ${fr(def.W / 2)}.`));
}
