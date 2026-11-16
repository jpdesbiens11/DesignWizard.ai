/* DesignWizard.ai — the choice of the units, as two rows of buttons : the system (SI, or the imperial engineering hybrid) and
   the unit a pressure is read in (kPa, bar, psi, atm). A click keeps the choice and tells every screen (« dw:units » on the
   window, core/units.js) ; the rows redraw themselves. Used by the menu of the account and by the screens that show units. */

import { el, clear } from "./dom.js";
import { getUnits, setUnits, pressureUnit, UNIT_SYSTEMS, PRESSURE_UNITS } from "./units.js";

const PRESSURE_TIP = { kPa: "kilopascal", bar: "1 bar = 100 kPa", psi: "livre-force par pouce carré — 1 psi = 6,895 kPa", atm: "atmosphère normale — 1 atm = 101,325 kPa" };
/** o.keep : true inside a menu, so that a click does not close it. → the node */
export function unitPicker(o = {}) {
  const host = el("div", { class: "unit-pick" });
  const row = (name, items, cur, pick) => el("div", { class: "unit-seg", role: "group", "aria-label": name }, items.map(([k, label, tip]) => el("button", { type: "button", class: k === cur ? "on" : null, "aria-pressed": k === cur ? "true" : "false", "data-unit": k, "data-tip": tip || null,
    onClick: (e) => { if (o.keep) e.stopPropagation(); pick(k); draw(); } }, label)));
  function draw() {
    const U = getUnits(); clear(host);
    host.append(row("Système d'unités", Object.entries(UNIT_SYSTEMS).map(([k, s]) => [k, s.label, s.hint]), U.system, (k) => setUnits({ system: k, pressure: "auto" })),
      el("div", { class: "unit-line" }, el("small", null, "Pression"), row("Unité de pression", Object.keys(PRESSURE_UNITS).map((k) => [k, k, PRESSURE_TIP[k]]), pressureUnit(U), (k) => setUnits({ pressure: k }))));
  }
  draw(); return host;
}
