/* DynamiteOrbit — a side panel drawn anew stays where it was (demande de JP). A studio draws a whole panel again when one of its
   values changes : the panel came back at its top, and the field just typed in lost the cursor — one had to scroll down again after
   each value. Here the panel keeps its place : the scroll position it had, and the cursor in the field one was in (after Tab : in
   the next one, as in any form).
   Nothing to declare : a panel is a « .side », what scrolls in it a « .side-scroll ». A screen that wants to take the designer
   somewhere else after a change does it as before (nudge) : it comes after, and wins.
   The first half is pure (which field of the new panel stands for the one that was left) ; installPanelKeep() touches the page. */

/** What tells a field from the others of its panel : what it is, how it is named, the card it sits in.
    d : { tag, type, label (aria-label), text (the words of its label), field (data-field), name, card } → string */
export const fieldSign = (d) => [d.tag, d.type, d.label, d.text, d.field, d.name, d.card].map((x) => String(x == null ? "" : x).replace(/\s+/g, " ").trim()).join("|");
/** Among the fields of a panel drawn anew (their signs, in order), the one that stands for the n-th field of sign `sign` — or −1.
    A panel that lost a card keeps the nearest of the same sign. */
export function sameField(signs, sign, nth) {
  const at = []; signs.forEach((s, i) => { if (s === sign) at.push(i); });
  return at.length ? at[Math.min(Math.max(0, nth), at.length - 1)] : -1;
}
/** Where Tab goes from stop `i` among `n` : the next one, the previous one with Shift ; −1 past the ends (the cursor stays). */
export const tabFrom = (i, n, back) => { const j = i + (back ? -1 : 1); return i >= 0 && j >= 0 && j < n ? j : -1; };
/** Does a panel have to be put back where it was ? was : the position kept ; now : where it is ; max : how far it can go. */
export const backTo = (was, now, max) => (was > 0 && Math.abs(Math.min(was, Math.max(0, max)) - now) > 1 ? Math.min(was, Math.max(0, max)) : null);

/* ---------- the page ---------- */
const FIELDS = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])", STOPS = `${FIELDS}, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])`;
const CARD = "[data-zone], [data-bc], [data-item], [data-key], [data-id]", RECENT = 700;      // ms : a panel drawn anew that long after a key or a change is its answer
let installed = false, last = null;      // last : the field the designer just acted in — { side, sign, nth, tab, t, node }
const sign = (n) => {
  const card = n.closest(CARD), wrap = n.closest("label, .field, .bc-row"), words = wrap && wrap.querySelector(".field-label, small");
  return fieldSign({ tag: n.tagName, type: n.type, label: n.getAttribute("aria-label"), text: words ? words.textContent : "", field: (n.closest("[data-field]") || n).getAttribute("data-field"), name: n.name,
    card: card ? ["zone", "bc", "item", "key", "id"].map((k) => card.getAttribute(`data-${k}`) || "").join(",") : "" });
};
const seen = (n) => !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length);
const scrollOf = (side) => side.querySelector(".side-scroll");

function note(e) {
  const n = e.target; if (!n || !n.matches || !n.matches(FIELDS)) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== "Tab") return;
  const side = n.closest(".side"); if (!side) return;
  const s = sign(n), nth = [...side.querySelectorAll(FIELDS)].filter((x) => sign(x) === s).indexOf(n), now = performance.now();
  const tab = e.type === "keydown" ? (e.key === "Tab" ? (e.shiftKey ? -1 : 1) : 0) : last && last.node === n && now - last.t < 250 ? last.tab : 0;      // Tab, then the change it commits : one gesture
  last = { side, sign: s, nth, tab, t: now, node: n };
}
function refocus(want) {
  const a = document.activeElement; if (a && a !== document.body && a.isConnected) return;      // the browser, or the screen, already put the cursor somewhere
  if (!want.side.isConnected) return;
  const fields = [...want.side.querySelectorAll(FIELDS)], i = sameField(fields.map(sign), want.sign, want.nth); if (i < 0) return;
  let node = fields[i];
  if (want.tab) { const stops = [...want.side.querySelectorAll(STOPS)].filter(seen), j = tabFrom(stops.indexOf(node), stops.length, want.tab < 0); if (j >= 0) node = stops[j]; }
  if (!seen(node)) return;
  node.focus({ preventScroll: true }); if (want.tab && node.select && /^(text|number|search|url|tel|email|password|)$/.test(node.type || "")) { try { node.select(); } catch (e) { /* not a field one selects in */ } }
}
function restore(side) {
  const sc = scrollOf(side);
  if (sc) { const to = backTo(side._top || 0, sc.scrollTop, sc.scrollHeight - sc.clientHeight); if (to !== null) sc.scrollTop = to; }
  if (last && last.side === side && !last.node.isConnected && performance.now() - last.t < RECENT) { const want = last; last = null; setTimeout(() => refocus(want), 0); }
}

/** Keeps every side panel where it was when it is drawn anew. Called once, when the application starts — after installFolds() :
    a folded group has its height before the panel is put back in place. */
export function installPanelKeep() {
  if (installed || typeof document === "undefined") return; installed = true;
  document.addEventListener("scroll", (e) => { const t = e.target; if (t && t.classList && t.classList.contains("side-scroll")) { const side = t.closest(".side"); if (side) side._top = t.scrollTop; } }, true);
  document.addEventListener("keydown", note, true); document.addEventListener("change", note, true);
  /* drawn anew : the panel, or what scrolls in it, received new children */
  new MutationObserver((list) => {
    const sides = new Set();
    for (const m of list) { const t = m.target; if (!m.addedNodes.length || !t.classList) continue; if (t.classList.contains("side")) sides.add(t); else if (t.classList.contains("side-scroll") && t.parentElement) sides.add(t.closest(".side")); }
    for (const side of sides) if (side && side.isConnected) restore(side);
  }).observe(document.body, { childList: true, subtree: true });
}
