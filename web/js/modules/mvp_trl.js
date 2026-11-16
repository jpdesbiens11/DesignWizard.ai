/* DesignWizard.ai — Itérations MVP : the readiness scale on the page. Nine tiles in three coloured steps, a pictogram per
   level ; the chosen level opens under them with its official definitions (quoted, with the French beside), what has to
   be shown to claim it, and two examples — one automotive, one aerospace. The references close the page : what was
   read, what was not. The words come from core/trl.js. */

import { el, svg, badge } from "../core/dom.js";
import { TRL_LEVELS, TRL_GROUPS, TRL_SOURCES, TRL_EXAMPLES, trlGroup } from "../core/trl.js";

const P = (d, o = {}) => svg("path", { d, fill: o.fill ? "currentColor" : "none", "fill-opacity": o.fill ? o.op || 0.18 : undefined, stroke: "currentColor", "stroke-width": o.w || 1.7, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": o.dash });
const C = (cx, cy, r, o = {}) => svg("circle", { cx, cy, r, fill: o.fill ? "currentColor" : "none", "fill-opacity": o.fill ? o.op || 1 : undefined, stroke: o.fill && !o.w ? "none" : "currentColor", "stroke-width": o.w || 1.7 });
const R = (x, y, w, h, o = {}) => svg("rect", { x, y, width: w, height: h, rx: o.r === undefined ? 1.2 : o.r, fill: o.fill ? "currentColor" : "none", "fill-opacity": o.fill ? o.op || 0.2 : undefined, stroke: "currentColor", "stroke-width": o.w || 1.6, "stroke-dasharray": o.dash });
const chamber = () => R(2.6, 3.2, 18.8, 17.6, { r: 2.6, dash: "3 2.2", w: 1.4 });
const system = (dy = 0) => [R(5.8, 10 + dy, 4.6, 6.5, { fill: true }), R(10.4, 7.5 + dy, 4.2, 9, { fill: true, op: 0.4 }), R(14.6, 11 + dy, 3.6, 5.5, { fill: true })];
/* what each level looks like : a thing observed, an idea, a proof, a breadboard on the bench, a part in a test chamber, the
   whole system in the chamber, the system out in the real world, a seal, a product that runs */
const ICON = {
  1: () => [C(10, 10, 6.2), P("M14.6 14.6 L20.5 20.5", { w: 2.3 }), P("M6.6 10.2 q1.7 -3.6 3.4 0 t3.4 0", { w: 1.3 })],
  2: () => [P("M8.2 14.6 a6 6 0 1 1 7.6 0 c-.7 .7 -1 1.5 -1 2.4 h-5.6 c0 -.9 -.3 -1.7 -1 -2.4 Z", { fill: true }), P("M9.8 19.6 h4.4 M10.7 21.8 h2.6")],
  3: () => [P("M9.5 3 h5 M10.3 3 v5.6 L5.2 18.4 a1.7 1.7 0 0 0 1.5 2.6 h10.6 a1.7 1.7 0 0 0 1.5 -2.6 L13.7 8.6 V3", { fill: true, op: 0.14 }), P("M8.6 15.6 l2.3 2.3 l4.4 -4.6", { w: 1.9 })],
  4: () => [R(3.5, 6.5, 17, 9.5), ...[7, 10.3, 13.7, 17].flatMap((x) => [C(x, 9.7, 0.85, { fill: true }), C(x, 12.9, 0.85, { fill: true })]), P("M7 9.7 C7 2.6 13.7 2.6 13.7 9.7", { w: 1.3 }), P("M2 20.4 h20", { w: 2.2 }), P("M5.5 16 v4.4 M18.5 16 v4.4", { w: 1.4 })],
  5: () => [chamber(), R(7.6, 9.2, 6.4, 5.2, { fill: true, op: 0.3 }), P("M17.6 7.2 v6.4", { w: 1.5 }), C(17.6, 15.2, 1.5, { fill: true }), P("M6.4 18 l1.2 -1.3 l1.2 1.3 l1.2 -1.3 l1.2 1.3 l1.2 -1.3 l1.2 1.3 l1.2 -1.3", { w: 1.2 })],
  6: () => [chamber(), ...system(), P("M4.8 16.5 h14.4", { w: 1.5 })],
  7: () => [...system(2.9), P("M2 19.5 h20", { w: 2.2 }), C(18.6, 5.4, 2.1), P("M18.6 1.4 v.9 M22.3 5.4 h-.8 M21.3 2.6 l-.6 .6 M15.9 2.6 l.6 .6 M14.9 5.4 h.8", { w: 1.2 })],
  8: () => [C(12, 9.4, 5.8, { fill: true, op: 0.16, w: 1.7 }), P("M9.3 9.5 l1.9 1.9 l3.6 -3.8", { w: 1.9 }), P("M9 14.8 l-1.6 6.4 l3 -1.6 l1.6 2.6 l1.6 -2.6 l3 1.6 l-1.6 -6.4")],
  9: () => [P("M20 12 a8 8 0 1 1 -2.6 -5.9", { w: 1.8 }), P("M20 3.6 v4.6 h-4.6", { w: 1.8 }), C(12, 12, 2.6, { fill: true })],
};
const SECTOR = {
  auto: () => [P("M3 16 H2.5 V12.6 L5.3 11.6 L7.8 7.5 H14.9 L18 11.5 L21.5 12.6 V16 H19.6 M15.6 16 H9 M5 16 H3", { fill: false }), P("M6.6 11.5 H17.4", { w: 1.1 }), C(7, 16.2, 1.9), C(17.6, 16.2, 1.9)],
  aero: () => [P("M12 2.2 c.9 0 1.5 1 1.5 2.4 V9 l7.8 4.6 v2 l-7.8 -2.4 v4.3 l2.3 1.8 v1.6 L12 19.9 l-3.8 1 v-1.6 l2.3 -1.8 v-4.3 l-7.8 2.4 v-2 L10.5 9 V4.6 c0 -1.4 .6 -2.4 1.5 -2.4 Z", { fill: true, op: 0.16 })],
};
const pict = (draw, size, cls) => svg("svg", { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", class: cls }, ...(draw ? draw().flat(Infinity) : []));
/** The pictogram of a level (1 to 9), and of a sector ("auto", "aero"). */
export const trlIcon = (n, size = 30) => pict(ICON[n], size, "trl-icon");
export const sectorIcon = (kind, size = 34) => pict(SECTOR[kind], size, "trl-icon");

/** The scale and the chosen level. o : { sel, reached, target, live (the level under review, or 0), pick(n) } → [nodes] */
export function trlScale(o) {
  const mark = (n) => (n <= o.reached ? ["atteint", "done"] : n === o.live ? ["en revue", "live"] : null);
  const ladder = el("div", { class: "trl-ladder" }, TRL_GROUPS.map((g) => el("section", { class: "trl-group", style: `--dom:${g.color}`, "data-group": g.id },
    el("header", { class: "trl-group-head" }, el("b", null, g.label), el("small", null, g.hint)),
    el("div", { class: "trl-tiles" }, g.levels.map((n) => { const t = TRL_LEVELS[n], m = mark(n), on = n === o.sel;
      return el("button", { class: `trl-tile${on ? " sel" : ""}${m ? ` ${m[1]}` : ""}${n === o.target ? " target" : ""}`, type: "button", "data-trl": String(n), "aria-pressed": on ? "true" : "false", "data-tip": `TRL ${n} — ${t.short}`, onClick: () => o.pick(n) },
        trlIcon(n), el("b", null, `TRL ${n}`), el("small", null, t.word), ...[m ? el("i", { class: `trl-mark ${m[1]}` }, m[0]) : null, n === o.target ? el("i", { class: "trl-mark target" }, "cible") : null].filter(Boolean)); })))));
  return [ladder, trlDetail(o)];
}

const quote = (org, en, fr) => [el("span", { class: "trl-src" }, org), el("div", null, el("q", { lang: "en" }, en), el("small", null, fr))];
function trlDetail(o) {
  const t = TRL_LEVELS[o.sel], g = trlGroup(o.sel);
  if (!t) return el("div");
  const eg = (kind, text) => el("div", { class: "trl-eg", "data-sector": kind }, sectorIcon(kind), el("b", null, TRL_EXAMPLES[kind].label, el("small", null, ` — ${TRL_EXAMPLES[kind].subject}`)), el("p", null, text));
  return el("div", { class: "trl-detail", style: `--dom:${g.color}`, "data-trl-detail": String(t.n) },
    el("div", { class: "trl-head" }, trlIcon(t.n, 44), el("h3", null, `TRL ${t.n} — ${t.short}`),
      ...[t.n <= o.reached ? badge("atteint", "ok") : null, t.n === o.live ? badge("en revue", "warn") : null, t.n === o.target ? badge("cible du projet", "info") : null].filter(Boolean)),
    el("div", { class: "atelier-chips" }, el("span", { class: "chip", "data-tip": "Ce que l'on met à l'essai à ce niveau, d'après la description du matériel du tableau de la NASA" }, `On essaie : ${t.unit}`),
      el("span", { class: "chip", "data-tip": "Où la preuve est faite, d'après la même description" }, `Où : ${t.env}`),
      ...[t.mrl ? el("span", { class: "chip", "data-tip": "Niveau de maturité de fabrication qui accompagne d'ordinaire ce niveau, selon le guide automobile" }, `MRL habituel : ${t.mrl}`) : null].filter(Boolean)),
    el("div", null, el("h4", null, "Définition officielle"), el("div", { class: "trl-defs" }, ...quote("NASA", t.nasa, t.fr), ...quote("Commission européenne", t.ec, t.ecFr)),
      ...[t.caution ? el("p", { class: "trl-caution" }, t.caution) : null].filter(Boolean)),
    el("div", null, el("h4", null, "Ce qu'il faut montrer pour dire le niveau atteint"), el("p", null, t.hwFr), el("p", null, el("b", null, "Preuve attendue : "), t.exitFr),
      el("details", { class: "trl-orig" }, el("summary", null, "Texte d'origine (tableau de la NASA)"), el("p", { lang: "en" }, el("b", null, "Hardware description — "), t.hw), el("p", { lang: "en" }, el("b", null, "Exit criteria — "), t.exit))),
    el("div", null, el("h4", null, "Deux exemples"), el("div", { class: "trl-egs" }, eg("auto", t.auto), eg("aero", t.aero)),
      el("p", { class: "muted small" }, "Exemples écrits par la plateforme pour illustrer la définition ; la même technologie est suivie du TRL 1 au TRL 9. Ils ne viennent pas des sources."),
      el("p", { class: "small" }, el("b", null, "Guide automobile (résumé) : "), t.guide)),
    el("p", { class: "trl-not" }, el("b", null, "À ne pas confondre — "), t.not));
}

/** The references, at the foot of the page : each opens on what it covers and on how it was checked. */
export function trlReferences() {
  const row = (s, k) => el("details", { class: "trl-ref", "data-source": s.id }, el("summary", null, badge(s.read ? "lu" : "non lu", s.read ? "ok" : "neutral"), el("span", null, `[${k + 1}] ${s.org} — ${s.title}`)),
    el("p", { class: "small" }, s.detail, "."), el("p", { class: "small" }, el("b", null, "Vérification : "), s.how, ". ", el("b", null, "Usage ici : "), s.use, "."),
    ...[s.url ? el("p", { class: "small" }, el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.url)) : null].filter(Boolean));
  return el("section", { class: "card trl-refs" }, el("h2", null, "Références — définitions des niveaux de maturité"),
    el("p", { class: "muted" }, "Le texte officiel est l'anglais cité ; le français à côté est une traduction de la plateforme. Quand un contrat cite une norme précise, c'est elle qui fait foi. Un clic sur une référence dit ce qu'elle couvre et comment elle a été vérifiée."),
    TRL_SOURCES.map(row));
}
