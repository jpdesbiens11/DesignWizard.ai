/* DynamiteOrbit.ai — the choice of the units, as a row of buttons : the system the DESIGN is read in (SI, or the imperial
   engineering hybrid). A click keeps the choice and tells every screen (« dw:units » on the window, core/units.js) ; the row
   redraws itself. The calculations do not follow it : they stay in SI. Used by the menu of the account. */

import { el, clear } from "./dom.js";
import { getUnits, setUnits, UNIT_SYSTEMS } from "./units.js";

/** o.keep : true inside a menu, so that a click does not close it. → the node */
export function unitPicker(o = {}) {
  const host = el("div", { class: "unit-pick" });
  const row = (name, items, cur, pick) => el("div", { class: "unit-seg", role: "group", "aria-label": name }, items.map(([k, label, tip]) => el("button", { type: "button", class: k === cur ? "on" : null, "aria-pressed": k === cur ? "true" : "false", "data-unit": k, "data-tip": tip || null,
    onClick: (e) => { if (o.keep) e.stopPropagation(); pick(k); draw(); } }, label)));
  function draw() {
    const U = getUnits(); clear(host);
    host.append(row("Système d'unités", Object.entries(UNIT_SYSTEMS).map(([k, s]) => [k, s.label, s.hint]), U.system, (k) => setUnits({ system: k })),
      el("small", { class: "muted unit-note" }, "Pour la conception : pièces, assemblage, carte, dessins, gammes. Les calculs restent en SI."));
  }
  draw(); return host;
}
