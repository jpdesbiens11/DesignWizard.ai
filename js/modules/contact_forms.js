/* DesignWizard.ai — the three forms of a pressure contact, shown as what they are : a cross-section of two bars pressed
   together, with pointed bosses, spring blades or a band of lamellae between them. One picker for the Busbars screen and
   the Shop : a tile per form (its colour, its picture, a few words), the one the platform would choose marked, and under
   it what the chosen form is made of and what the voltage asks. Words and figures : cad/interfaces_elec.js. */

import { el, svg, badge, btn } from "../core/dom.js";
import { CONTACT_FORMS, VOLTAGE_CLASSES, PLATINGS, contactForm, contactFacts, contactAdvice, voltageClass } from "../cad/interfaces_elec.js";

export const FORM_COLOR = { cone: "#ee8a32", bridge: "#25ad9f", band: "#8a7df0" };
const bar = (y, h = 7) => svg("rect", { x: 3, y, width: 66, height: h, rx: 1.2, fill: "currentColor", "fill-opacity": 0.14, stroke: "currentColor", "stroke-width": 1.4 });
const line = (d, w = 1.8, extra = {}) => svg("path", { d, fill: "none", stroke: "var(--dom)", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round", ...extra });
const DRAW = {
  /* bosses embossed in the lower bar : each point touches the bar above ; the dimple of the punch shows underneath */
  cone: (weld) => [bar(4), bar(27), ...[14, 29, 44, 59].flatMap((x) => [svg("path", { d: `M${x - 6} 27 L${x - 1.4} 11.4 H${x + 1.4} L${x + 6} 27 Z`, fill: "var(--dom)", "fill-opacity": 0.55, stroke: "var(--dom)", "stroke-width": 1.3, "stroke-linejoin": "round" }),
    line(`M${x - 2.6} 34 L${x} 30 L${x + 2.6} 34`, 1, { stroke: "currentColor", "stroke-opacity": 0.5 }), ...(weld ? [svg("circle", { cx: x, cy: 11, r: 2.4, fill: "var(--hl-red)" })] : [])])],
  /* blades lanced in a thin bar and arched : each bridge bends when the bars close */
  bridge: () => [bar(4), bar(29, 4), ...[9, 30, 51].flatMap((x) => [line(`M${x} 29 Q${x + 7.5} ${-6.5} ${x + 15} 29`, 2.4), line(`M${x + 2.4} 29 H${x + 12.6}`, 2.6, { stroke: "var(--surface)" })])],
  /* a band of slanted lamellae laid between the two lands : many points in parallel */
  band: () => [bar(4), bar(27), line("M6 19 H66", 1.2, { "stroke-opacity": 0.55 }), ...Array.from({ length: 9 }, (_, k) => line(`M${9 + k * 6.6} 26 L${14.5 + k * 6.6} 12`, 2.2))],
};
/** The picture of a form : a section of the two bars and of what stands between them. */
export function contactFormIcon(form, o = {}) {
  const draw = DRAW[form] || DRAW.band;
  return svg("svg", { viewBox: "0 0 72 38", width: o.width || 96, height: (o.width || 96) * 38 / 72, class: "cf-icon", "aria-hidden": "true", style: `--dom:${FORM_COLOR[form] || FORM_COLOR.band}` }, ...draw(!!o.weld).flat(Infinity));
}

/** The picker. o : { p (the parameters of the contact), opts, t (bar thickness, when known), pick(form), apply(advice) } → node */
export function contactFormPicker(o) {
  const p = o.p || {}, cur = contactForm(p, o.opts || {}), adv = contactAdvice({ i: p.i, u: p.u, t: o.t, duty: p.duty, force: p.force }), cls = voltageClass(p.u);
  const tiles = el("div", { class: "cf-tiles", role: "group", "aria-label": "Forme du contact" }, Object.entries(CONTACT_FORMS).map(([k, f]) => el("button", { class: `cf-tile${k === cur ? " sel" : ""}`, type: "button", "data-form": k, "aria-pressed": k === cur ? "true" : "false", "data-tip": f.text, style: `--dom:${FORM_COLOR[k]}`, onClick: () => o.pick(k) },
    contactFormIcon(k, { weld: k === "cone" && p.weld === "projection" }), el("b", null, f.label), ...[k === adv.form ? el("i", { class: "cf-mark" }, "conseillé") : null].filter(Boolean))));
  const same = adv.form === cur && adv.plating === (p.plating || "Ag") && (p.n || 0) >= adv.n;
  return el("div", { class: "cf-box" }, tiles, el("p", { class: "small cf-facts" }, ...contactFacts(p, o.opts || {})),
    el("div", { class: "cf-advice" }, el("p", { class: "small" }, el("b", null, `Pour ${p.i || 0} A${p.u > 0 ? ` sous ${p.u} V` : ""}${o.t ? `, barre de ${String(o.t).replace(".", ",")} mm` : ""} : `), `${CONTACT_FORMS[adv.form].label.toLowerCase()}, ${PLATINGS[adv.plating].label.toLowerCase()}, ${adv.n} points au moins. `, ...[cls ? badge(cls === "over" ? "au-delà de la classe B" : `classe ${cls}`, cls === "A" ? "ok" : "warn") : null].filter(Boolean)),
      el("ul", { class: "small cf-why" }, adv.why.map((t) => el("li", null, t))), el("p", { class: "muted cf-std" }, `À respecter : ${adv.standards.join(" ; ")}. ${cls ? `${cls === "over" ? "" : `${VOLTAGE_CLASSES[cls].fr[0].toUpperCase()}${VOLTAGE_CLASSES[cls].fr.slice(1)}, selon l'ISO 6469-3. `}` : "Donnez la tension pour connaître la classe (ISO 6469-3). "}Les seuils de 150 A et de 1 mm sont des repères de la plateforme : l'essai fait foi.`),
      ...[!same && o.apply ? btn("Appliquer le conseil", () => o.apply(adv), { small: true, icon: "sparkle", tip: "Prend la forme, le revêtement et le nombre de points conseillés ; le reste ne change pas" }) : null].filter(Boolean)));
}
