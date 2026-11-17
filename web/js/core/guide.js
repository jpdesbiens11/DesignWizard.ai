/* DesignWizard.ai — the guide : what a screen tells the designer while he works. A screen computes its list with a pure
   function (what is missing, what is odd, what to do next) and hands it here ; the guide draws it the same way everywhere —
   the most serious first, a word for its level, one line each, a click that takes the designer to the place — and marks
   the fields that wait for a value so that they blink until they are entered.
   An entry : { level: "error" | "todo" | "warn" | "tip", text, id?, field?, go?: () => void, fix?: { label, run } }. */

import { el, icon, btn, inUnits } from "./dom.js";

export const GUIDE_LEVELS = {
  error: { fr: "À corriger", icon: "warning", rank: 0, blocks: true },
  todo: { fr: "À entrer", icon: "edit", rank: 1, blocks: true },
  warn: { fr: "À vérifier", icon: "info", rank: 2, blocks: false },
  tip: { fr: "Conseil", icon: "sparkle", rank: 3, blocks: false },
};
/** Sorted copy, the most serious first ; unknown levels are tips. */
export function guideSort(list) { return [...(list || [])].filter((x) => x && x.text).map((x) => (GUIDE_LEVELS[x.level] ? x : { ...x, level: "tip" })).sort((a, b) => GUIDE_LEVELS[a.level].rank - GUIDE_LEVELS[b.level].rank); }
/** { error, todo, warn, tip, blocking } : how many of each. */
export function guideCount(list) { const c = { error: 0, todo: 0, warn: 0, tip: 0 }; for (const x of guideSort(list)) c[x.level]++; return { ...c, blocking: c.error + c.todo }; }
/** One line that sums a list up : « 1 à corriger · 2 à entrer » ; empty when there is nothing. */
export function guideSummary(list) { const c = guideCount(list); return Object.keys(GUIDE_LEVELS).filter((k) => c[k]).map((k) => `${c[k]} ${GUIDE_LEVELS[k].fr.toLowerCase()}`).join(" · "); }

/** The list as an element (null when it is empty). o : { title, go(entry) (a click on a line), max (lines shown, default 6), quiet (a word when all is well),
    si (true : the list of a calculation, written in SI and left so) }. An entry may say `si` for itself. */
export function guideBox(list, o = {}) {
  const all = guideSort(list), max = o.max || 6;
  if (!all.length) return o.quiet ? el("p", { class: "guide-ok small" }, icon("check"), " ", o.quiet) : null;
  const line = (x) => {
    const L = GUIDE_LEVELS[x.level], act = x.go || (o.go ? () => o.go(x) : null), body = [icon(L.icon), el("span", { class: "guide-text" }, el("b", null, `${L.fr} — `), x.si || o.si ? x.text : inUnits(x.text))];
    const node = act ? el("button", { class: `guide-line ${x.level}`, type: "button", onClick: act, "data-tip": "Y aller" }, body) : el("div", { class: `guide-line ${x.level}` }, body);
    return x.fix ? el("div", { class: "guide-fix" }, node, btn(x.fix.label, x.fix.run, { small: true, icon: "check" })) : node;
  };
  return el("div", { class: "guide", role: "status", "aria-live": "polite" }, ...[o.title ? el("div", { class: "guide-head" }, el("b", null, o.title), el("small", null, guideSummary(all))) : null].filter(Boolean),
    ...all.slice(0, max).map(line), ...(all.length > max ? [el("p", { class: "muted small" }, `… et ${all.length - max} autre${all.length - max > 1 ? "s" : ""}.`)] : []));
}
/** Marks a field that waits for its value : it blinks until `done` is called (the designer typed, or confirmed). → the wrapper */
export function needField(input, o = {}) {
  input.classList.add("need"); input.setAttribute("aria-invalid", "true"); if (o.hint) input.dataset.tip = o.hint;
  return input;
}
/** Brings an element into view and makes it blink for a moment : where the guide sends the designer. */
export function nudge(node) {
  if (!node) return false;
  if (node.scrollIntoView) node.scrollIntoView({ block: "center", behavior: "smooth" });
  node.classList.remove("nudge"); void node.offsetWidth; node.classList.add("nudge"); setTimeout(() => node.classList.remove("nudge"), 2400);
  if (node.focus && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(node.tagName)) node.focus({ preventScroll: true });
  return true;
}
