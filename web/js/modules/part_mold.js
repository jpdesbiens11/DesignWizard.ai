/* DesignOrbit.ai — the « Mold » tab of a moulded or cast part : the part thought through its mold (core/mold_plan.js).
   What the designer chooses — the process when the alloy allows several, the gate, the faces that must stay clean — and
   what follows from the part : the pull, the parting line, the slides, the risers, and what all of it leaves on the part.
   On the model : the parting line, the pull, an arrow per slide, the gate, the overflows, the risers standing on their
   necks. A gate the tool proposed is an example : its tiles blink until one is chosen or confirmed. */

import { el, svg, btn, badge, toast, copyText } from "../core/dom.js";
import { store } from "../core/store.js";
import { toDwiz } from "../core/dwiz.js";
import { FACES } from "../cad/vec.js";
import { PROCESSES } from "../cad/materials.js";
import { moldProcesses } from "../core/shop_mold.js";
import { MOLDS, GATES, BASIS, MOLD_COLORS, moldPlan, moldGuide, moldMarks, moldBrief, isMolded } from "../core/mold_plan.js";
import { arrow } from "../core/view_marks.js";
import { cylMesh } from "../analysis/physics/scene3d.js";

export { isMolded };
const fr = (x) => String(Math.round(x * 10) / 10).replace(".", ","), FAMILY_COLOR = { plastic: "#2563eb", metal: "#b45309" }, LEVEL = { error: ["à corriger", "danger"], todo: ["à entrer", "warn"], check: ["à vérifier", "warn"], tip: ["conseil", "info"] };
const NOTE_RE = /^(Mold|Gate|Risers|Ejector pin marks|Aucune trace de gate) /;

/** Takes the marks of the mold off the view. */
export function clearMold(viewer) { for (const k of [...viewer.objects.keys()]) if (k.startsWith("mold/")) viewer.remove(k); viewer.clearOverlays("mold"); }
function showMold(viewer, plan) {
  clearMold(viewer);
  moldMarks(plan, viewer._size()).forEach((m, k) => {
    if (m.t === "loop") viewer.addPath(m.pts, m.color, "mold", 0.9);
    else if (m.t === "arrow") arrow(viewer, m.at.map((x, i) => x + m.dir[i] * m.len), m.dir, { tag: "mold", color: m.color, len: m.len });
    else if (m.t === "cyl") viewer.add({ id: `mold/${k}`, name: m.kind, mesh: cylMesh(m.a, m.b, m.r, 24), color: m.color, opacity: m.opacity ?? 1, pickable: false });
    else viewer.addLabel(m.at, m.text, "mold", "iface");
  });
  viewer.invalidate();
}

/* a gate as a picture : the part in section (a tub, its parting line dashed), and the gate in colour */
function gateIcon(kind, color) {
  const ink = "currentColor", part = [svg("path", { d: "M10 14 V36 H54 V14 H48 V30 H16 V14 Z", fill: "none", stroke: ink, "stroke-width": 1.6, "stroke-linejoin": "round" }), svg("line", { x1: 4, y1: 14, x2: 60, y2: 14, stroke: MOLD_COLORS.parting, "stroke-width": 1, "stroke-dasharray": "3 2" })];
  const P = (d, o = {}) => svg("path", { d, fill: o.fill || "none", stroke: color, "stroke-width": o.w || 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }), dot = (x, y, r = 2.4) => svg("circle", { cx: x, cy: y, r, fill: color });
  const G = { pin: [P("M32 44 V38"), dot(32, 37)], valve: [P("M32 45 V38", { w: 3.4 }), svg("circle", { cx: 32, cy: 37, r: 3.6, fill: "none", stroke: color, "stroke-width": 1.4 })], sprue: [P("M27 45 L30 36 H34 L37 45 Z", { fill: color, w: 1 })],
    edge: [P("M2 12 H10", { w: 3.2 })], sub: [P("M2 8 L6 8 L11 20"), dot(11, 21, 1.8)], ingate: [P("M1 12 H10", { w: 4 }), P("M54 12 H58", { w: 2 }), dot(60, 9, 2.2), dot(60, 15, 2.2)],
    stalk: [P("M32 46 V37", { w: 5 }), P("M32 30 V24 M29 27 L32 23 L35 27", { w: 1.6 })], gravity: [P("M4 2 L7 9 V20 H10"), P("M2 2 H10", { w: 1.6 })] };
  return svg("svg", { viewBox: "0 0 64 48", width: 64, height: 48, class: "cf-icon", "aria-hidden": "true" }, ...part, ...(G[kind] || []));
}
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}${o.ask ? " need" : ""}`, type: "button", style: `--dom:${o.color}`, "aria-pressed": o.sel ? "true" : "false", "data-tip": o.tip || null, ...(o.data || {}), onClick: o.pick }, ...[o.pic || null, el("b", null, o.label), o.small ? el("small", null, o.small) : null, o.sel && o.mark ? el("i", { class: "cf-mark" }, o.mark) : null].filter(Boolean));
const dot = (color) => { const s = el("span", { class: "bc-dot", "aria-hidden": "true" }); s.style.background = color; return s; };
const row = (color, head, text, extra) => el("div", { class: "bc-item mold-row" }, dot(color), el("span", { class: "bc-text" }, el("span", null, head), el("small", null, text)), ...[extra].filter(Boolean));

export function moldPanel(body, ctx) {
  const { st, id, vp } = ctx, spec = st.spec, plan = moldPlan(spec, st.built);
  if (!plan) { body.append(el("p", { class: "muted" }, "Cette pièce n'est pas moulée.")); return; }
  showMold(vp.viewer, plan);
  const K = plan.mold, color = FAMILY_COLOR[K.family], found = moldGuide(plan), set = (fn, what) => store.updatePart(id, (x) => { x.mold = { ...(x.mold || {}) }; fn(x.mold, x); }, `${spec.id} : ${what}`);
  body.append(el("div", { class: "side-section", "data-mold": plan.process }, el("h3", null, K.label),
    el("div", { class: "atelier-chips" }, el("span", { class: "chip" + (plan.simple ? " done" : "") }, plan.simple ? "Open / close" : [plan.slides.length ? `${plan.slides.length} ${K.side === "core" ? "core(s)" : "slide(s)"}` : null, plan.lifters ? `${plan.lifters} lifter(s)` : null].filter(Boolean).join(" · ")),
      el("span", { class: "chip" }, `Pull ${plan.pull}`), el("span", { class: "chip" }, `Gate : ${plan.gate.label}`), ...(K.risers ? [el("span", { class: "chip" }, `${plan.risers.length} riser(s)`)] : [])),
    el("p", { class: "small", style: { margin: ".35rem 0 0" } }, K.how), el("p", { class: "muted small", style: { margin: ".2rem 0 0" } }, K.tool)));
  if (found.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Guide du mold"), found.map((g) => el("div", { class: `finding ${g.level === "error" ? "error" : g.level === "tip" ? "info" : "warn"}`, "data-mold-guide": g.level }, el("span", { class: "sev" }), el("div", null, badge(LEVEL[g.level][0], LEVEL[g.level][1])), el("p", null, g.text)))));
  /* the process, when the material goes to more than one mold */
  const procs = moldProcesses(spec.material);
  if (procs.length > 1) body.append(el("div", { class: "side-section" }, el("h3", null, "Procédé"), el("div", { class: "cf-tiles" }, procs.map((k) => tile({ sel: k === plan.process, color: FAMILY_COLOR[MOLDS[k].family], label: MOLDS[k].short, small: MOLDS[k].fill === "pressure" ? "sous pression" : MOLDS[k].fill === "bottom" ? "rempli par le bas" : "par gravité", tip: `${PROCESSES[k].label} — ${MOLDS[k].how}`, data: { "data-mold-process": k },
    pick: () => { if (k !== plan.process) set((m, x) => { x.process = k; m.process = k; delete m.gating; }, `procédé ${MOLDS[k].label}`); } }))),
    el("p", { class: "muted small" }, "Changer de procédé change le mold, le gate et les risers. La paroi, le draft et les surépaisseurs ont été dessinés pour le procédé d'origine : le DFx dit ce qui ne convient plus.")));
  /* the gate : the kinds this process accepts, then the side it stands on */
  const pickGate = (kind) => set((m) => { m.gating = { ...(m.gating || {}), kind }; if (GATES[kind].on !== (GATES[plan.gate.kind] || {}).on) delete m.gating.side; }, `gate ${GATES[kind].label}`);
  const sides = Object.keys(FACES).filter((f) => (plan.gate.on === "face" || plan.gate.on === "bottom" ? FACES[f].axis === plan.parting.axis : FACES[f].axis !== plan.parting.axis));
  body.append(el("div", { class: "side-section" }, el("h3", null, "Gate — par où la matière entre"),
    el("div", { class: "cf-tiles" }, K.gates.map((k) => tile({ sel: k === plan.gate.kind, ask: plan.gate.auto, color: MOLD_COLORS.gate, label: GATES[k].label, tip: GATES[k].note, pic: gateIcon(k, MOLD_COLORS.gate), mark: plan.gate.auto ? "proposé" : "choisi", data: { "data-gate": k }, pick: () => pickGate(k) }))),
    el("p", { class: "small", style: { margin: ".35rem 0 .2rem" } }, el("b", null, plan.gate.label), ` — ${plan.gate.note}`),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap", gap: ".25rem" } }, el("small", { class: "muted" }, plan.gate.on === "parting" || plan.gate.on === "wall" ? "Côté :" : "Face :"),
      sides.map((f) => el("button", { class: "btn btn-small" + (f === plan.gate.face ? " btn-primary" : ""), type: "button", "aria-pressed": f === plan.gate.face ? "true" : "false", "data-gate-side": f, onClick: () => set((m) => { m.gating = { kind: plan.gate.kind, ...(m.gating || {}), side: f }; }, `gate côté ${f}`) }, f)),
      ...(plan.gate.auto ? [btn("Confirmer ce gate", () => pickGate(plan.gate.kind), { small: true, icon: "check", tip: "Le gate proposé devient votre choix : il s'écrit dans la pièce" })] : []))));
  /* the mold : where it opens, and what moves sideways */
  body.append(el("div", { class: "side-section" }, el("h3", null, "Mold — parting line, pull et slides"),
    row(MOLD_COLORS.parting, "Parting line", `${plan.parting.text}${plan.box ? ` — niveau ${fr(plan.parting.level)} mm` : ""}`), row(MOLD_COLORS.pull, `Pull ${plan.pull}`, "le sens dans lequel le mold s'ouvre et la pièce sort ; tout ce qui n'a pas de draft dans ce sens grippe"),
    ...(plan.simple ? [row("#2ec27e", "Open / close", "deux moitiés, aucun mouvement latéral : le mold le plus simple")] : []),
    ...plan.slides.map((s) => row(MOLD_COLORS.slide, `${s.kind === "core" ? "Core" : "Slide"} ${s.dir}`, `forme ${s.what.join(", ") || "une ouverture"}`)), ...(plan.lifters ? [row(MOLD_COLORS.slide, `${plan.lifters} lifter(s)`, "un par crochet, côté core")] : []),
    ...(plan.overflow ? [row(MOLD_COLORS.overflow, "Overflows, vents", `côté ${plan.overflow.face}, à l'opposé de l'ingate`)] : [])));
  if (K.risers) body.append(el("div", { class: "side-section" }, el("h3", null, "Risers"), ...(plan.risers.length ? plan.risers.map((r) => row(MOLD_COLORS.riser, `${r.id} — Ø ${fr(r.d)} × ${fr(r.h)} mm, col Ø ${fr(r.neck)}`, r.why)) : [el("p", { class: "muted small" }, "Aucun riser placé.")]),
    el("details", { class: "small muted" }, el("summary", null, "D'où viennent ces chiffres"), el("p", null, BASIS.riser), el("p", null, BASIS.count), ...(plan.process === "lp_die_casting" ? [el("p", null, BASIS.lpdc)] : []))));
  /* what stays on the part */
  body.append(el("div", { class: "side-section" }, el("h3", null, "Ce qui reste sur la pièce (witness marks)"), plan.witness.map((w) => row(w.color, `${w.label} — ${w.where}`, w.text)),
    el("details", { class: "small muted" }, el("summary", null, "D'où viennent ces chiffres"), el("p", null, BASIS.vestige))));
  /* the faces that must stay clean */
  const cos = new Set(plan.cosmetic);
  body.append(el("div", { class: "side-section" }, el("h3", null, "Faces d'aspect"), el("p", { class: "muted small", style: { margin: "0 0 .3rem" } }, "Les faces où rien ne doit se voir : ni gate, ni ejector pin, ni riser. Le guide dit quand le mold les marque."),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap", gap: ".25rem" } }, Object.keys(FACES).map((f) => el("button", { class: "btn btn-small" + (cos.has(f) ? " btn-primary" : ""), type: "button", "aria-pressed": cos.has(f) ? "true" : "false", "data-cosmetic": f,
      onClick: () => set((m) => { const c = new Set(m.cosmetic || []); if (c.has(f)) c.delete(f); else c.add(f); m.cosmetic = [...c].sort(); if (!m.cosmetic.length) delete m.cosmetic; }, `face d'aspect ${f}`) }, f)))));
  /* the notes of the drawing, and the round trip with an AI or a moldmaker */
  const onDrawing = plan.notes.every((n) => (spec.notes || []).includes(n));
  body.append(el("div", { class: "side-section" }, el("h3", null, "Notes du dessin"), el("ul", { class: "small", style: { margin: "0 0 .4rem 1rem", padding: 0 } }, plan.notes.map((n) => el("li", null, n))),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn(onDrawing ? "Notes à jour sur le dessin" : "Porter ces notes au dessin", () => store.updatePart(id, (x) => { x.notes = [...(x.notes || []).filter((n) => !NOTE_RE.test(n)), ...plan.notes]; }, `${spec.id} : notes du mold portées au dessin`), { small: true, icon: "drawing", disabled: onDrawing, tip: "Écrit le mold, le gate, les risers et les traces dans les notes de la pièce : le dessin les reprend" }),
      btn("Copier pour une IA ou un mouliste", async () => toast((await copyText(`${moldBrief(spec, plan)}\n\n${toDwiz(spec)}`)) ? "Plan de moule et pièce (.dwiz) copiés : la réponse revient par « Importer », avec l'aperçu des changements." : "Copie impossible.", "success", 6000), { small: true, icon: "copy", tip: "Le mold de la pièce en clair, la consigne et la pièce en .dwiz : à confier comme à un mouliste" }))));
}
