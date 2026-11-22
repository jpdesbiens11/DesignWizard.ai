/* DynamiteOrbit — Logiciel : the list of delivery, drawn (cycle en V, « 7 Livraison ») — a line per check, a click leads to where it is
   settled. The rule is in sw/sw_release.js. */

import { el, icon } from "../core/dom.js";
import { releaseChecks, releaseReady } from "../sw/sw_release.js";
import { vstepOf } from "../sw/sw_steps.js";

/** → a section of the left panel. go(step, page) : open the step where a line is settled. */
export function releaseList(d, cpu, run, go) {
  const C = releaseChecks(d, cpu, run), n = C.filter((c) => c.ok).length;
  return el("div", { class: "side-section", "data-box": "release", "data-fold-note": `${n} sur ${C.length}` }, el("h3", null, "La liste de livraison"),
    el("p", { class: releaseReady(C) ? "lab-note" : "muted small" }, releaseReady(C) ? [icon("check"), " Tout est prêt : le paquet peut partir."] : "Ce qui doit tenir avant que le paquet parte ; un clic mène à l'étape où cela se règle."),
    el("ul", { class: "sw-release", "data-sw-release": String(n) }, C.map((c) => { const V = vstepOf(c.step); return el("li", { class: c.ok ? "ok" : "ko" }, el("button", { type: "button", class: "sw-rel-line", "data-sw-check": c.id, onClick: () => go(c.step, c.page), "data-tip": `Étape ${V.n} — ${V.title}` },
      icon(c.ok ? "check" : "warning"), el("span", null, c.text), el("small", null, `${V.n}. ${V.title}`))); })),
    el("p", { class: "muted small" }, "La liste de l'outil : elle ne remplace ni la revue de conception, ni l'autorité qui accepte un logiciel."));
}
