/* DesignWizard.ai — « Ce que cela dérange », drawn : the disturbances an answer of an AI would cause elsewhere in the product (core/ai_disturb.js),
   grouped by level — broken, to redo, to look at —, each group with its colour and its pictogram, each line short, its target named (a click
   goes there when the box is on a page). The same box in the door « Avec l'IA » (under each row of its preview) and in the common loop of
   every screen (under the list of changes). Nothing is decided here. */

import { el, icon } from "../core/dom.js";
import { DISTURB_LEVELS, disturbWords } from "../core/ai_disturb.js";
import { partHash } from "../core/shop_levels.js";

const hashOf = (t, project) => (!t ? null : t.kind === "part" ? ((project && (project.parts || []).find((p) => p.id === t.id)) ? partHash(project.parts.find((p) => p.id === t.id)) : `#/parts/${encodeURIComponent(t.id)}`) : t.kind === "assembly" ? `#/assembly/${encodeURIComponent(t.id)}` : t.kind === "board" ? `#/pcba/${encodeURIComponent(t.id)}` : t.kind === "analysis" ? "#/physics" : t.kind === "case" ? `#/fea/${encodeURIComponent(t.id)}` : null);

/** The box. list : disturbs(…) ; o : { title, links (true : a line is a link to its target), project (to find the studio of a part), compact } → an element, or null when nothing is disturbed and o.quiet. */
export function disturbBox(list, o = {}) {
  const L = list || [];
  if (!L.length) return o.quiet ? null : el("p", { class: "ai-disturb none", "data-disturb": "0" }, icon("check"), " ", o.none || "Rien d'autre dans le produit ne dépend de ce qui change.");
  const box = el("div", { class: `ai-disturb${o.compact ? " compact" : ""}`, "data-disturb": String(L.length), role: "group", "aria-label": o.title || "Ce que cela dérange ailleurs" },
    el("p", { class: "ai-disturb-head" }, icon("branch"), el("b", null, ` ${o.title || "Ce que cela dérange ailleurs"} — `), disturbWords(L)));
  for (const [level, L0] of Object.entries(DISTURB_LEVELS)) {
    const mine = L.filter((x) => x.level === level); if (!mine.length) continue;
    box.append(el("div", { class: "ai-disturb-group", style: { "--g": L0.color }, "data-level": level }, el("span", { class: "ai-disturb-tag", "data-tip": L0.why }, icon(L0.icon), ` ${L0.fr}`),
      el("ul", null, mine.map((x) => { const h = o.links ? hashOf(x.target, o.project) : null; return el("li", { "data-kind": x.kind }, h ? el("a", { href: h }, x.text) : x.text); }))));
  }
  return box;
}
