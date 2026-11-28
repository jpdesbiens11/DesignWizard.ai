/* DynamiteOrbit.ai — the groups of a side panel fold on demand (demande de JP). A studio stacks its groups in its panels ; the one to
   work on may be far down. A click on the title of a group folds it — its chevron then points to the right — and what is below comes
   up. Alt + click keeps that group alone open ; a button at the head of the panel folds or unfolds them all ; what is folded stays so
   from one visit to the next (this browser only). A folded group that still waits for a value says so, and the guide opens the group
   it sends the designer to.
   One mechanism for every studio : a group is a « .side-section » whose first child is its « h3 » — nothing to declare. A screen
   that knows what a group holds says it in « data-fold-note » on the section : it shows beside the title while the group is folded.
   A screen that draws groups of its own inside a group (the supports, the loads of a load case) gives each one « data-fold-key »
   and the class « fold-head » to its first child : it then folds the same way.
   The first half is pure (keys, what is stored) ; installFolds() is the only part that touches the page. */

const STORE = "dw.fold";

/** The key a group is remembered under : its screen, its panel, its title. */
export const foldKey = (screen, side, title) => `${screen || "home"}.${side}:${String(title || "").replace(/\s+/g, " ").trim().toLowerCase()}`;
/** The screen a location names : « #/fea/DRV-BASE » → « fea ». */
export const screenOf = (hash) => String(hash || "").replace(/^#\/?/, "").split(/[/?]/)[0] || "home";
/** What is folded, as kept : { key: 1 }. Whatever is not such a map reads as nothing folded. */
export function readFolds(store) {
  try { const v = JSON.parse((store && store.getItem(STORE)) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, on]) => on).map(([k]) => [k, 1])) : {}; } catch (e) { return {}; }
}
export function writeFolds(store, map) { try { store.setItem(STORE, JSON.stringify(map)); return true; } catch (e) { return false; } }      // a private window keeps nothing : folding still works for the visit
/** The map with one group folded or opened ; and with only `key` open among `keys`. */
export const setFold = (map, key, folded) => { const next = { ...map }; if (folded) next[key] = 1; else delete next[key]; return next; };
export const soloFold = (map, keys, key) => keys.reduce((m, k) => setFold(m, k, k !== key), map);
/** The title of a group : the words of its heading, without what its buttons, badges and counters say. node : the h3 (or its like). */
export function headingText(node) {
  let text = "";
  for (const c of (node && node.childNodes) || []) { if (c.nodeType === 3) text += c.textContent; else if (c.nodeType === 1 && !(c.matches && c.matches("button, a, input, select, svg, .badge, .chip"))) text += c.textContent; }
  return text.replace(/\s+/g, " ").trim();
}

/* ---------- the page ---------- */
let folds = {}, installed = false;
const GROUPS = ".side .side-section, .side [data-fold-key]", WAITS = "input.need, .bc-item.ask, .form-error, .guide-line.error, .guide-line.todo";      // what, in a folded group, still asks for the designer
const save = () => writeFolds(window.localStorage, folds);
const own = (g) => g.hasAttribute("data-fold-key");
const headOf = (g) => { const h = g.firstElementChild; return h && (own(g) ? h.classList.contains("fold-head") : h.tagName === "H3") ? h : null; };
/* the key of a group ; kept on the node, since a button of the heading may have drawn the panel anew before its click is seen here */
function keyOf(g) {
  if (own(g)) return g.getAttribute("data-fold-key");
  if (!g.isConnected && g._foldKey) return g._foldKey;
  const side = g.closest(".side"); return (g._foldKey = foldKey(screenOf(window.location.hash), side && side.classList.contains("right") ? "right" : "left", headingText(headOf(g))));
}
const groupsOf = (panel) => [...panel.querySelectorAll(".side-section")].filter(headOf);
const attr = (node, name, value) => { if (value == null || value === "") { if (node.hasAttribute(name)) node.removeAttribute(name); } else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); };
const flag = (node, name, on) => { if (node.classList.contains(name) !== !!on) node.classList.toggle(name, !!on); };

/** Is a group of the page folded ? A screen that draws groups of its own asks, and says, by key. */
export const isFolded = (key) => !!folds[key];
export function fold(key, folded) { if (!!folds[key] === !!folded) return; folds = setFold(folds, key, folded); if (installed) save(); }

/** Gives a group its heading to click, and the state it was left in. Done again each time a panel is drawn anew ; changes nothing twice. */
function dress(g) {
  const h = headOf(g); if (!h) return;
  const shut = !!folds[keyOf(g)];
  if (!h.classList.contains("fold-head") || !h.hasAttribute("aria-expanded")) { h.classList.add("fold-head"); if (!h.hasAttribute("role")) h.setAttribute("role", "button"); h.tabIndex = 0; h._foldTip = !h.hasAttribute("data-tip"); }
  flag(g, "folded", shut); attr(h, "aria-expanded", !shut); attr(h, "data-note", g.getAttribute("data-fold-note"));
  flag(g, "fold-alert", shut && !!g.querySelector(WAITS));
  if (h._foldTip) attr(h, "data-tip", shut ? "Déplier ce groupe (Alt + clic : ne garder que lui ouvert)" : "Replier ce groupe : les suivants remontent (Alt + clic : ne garder que lui ouvert)");
}
/** The « fold all / unfold all » button at the head of a panel that has several groups. */
function headButton(panel) {
  const head = panel.querySelector(":scope > .side-head"); if (!head) return;
  const groups = groupsOf(panel); let b = head.querySelector(":scope > .fold-all");
  if (groups.length < 2) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement("button"); b.type = "button"; b.className = "icon-btn fold-all";
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"), path = document.createElementNS(NS, "path");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); svg.setAttribute("aria-hidden", "true");
    path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.7"); path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round"); svg.append(path); b.append(svg);
    b.addEventListener("click", () => { const list = groupsOf(panel), shut = !list.every((s) => s.classList.contains("folded")); for (const s of list) folds = setFold(folds, keyOf(s), shut); save(); sweep(); });
    head.append(b);
  }
  const all = groups.every((s) => s.classList.contains("folded")), label = all ? "Tout déplier" : "Tout replier — puis ouvrez le groupe à modifier";
  if (b.getAttribute("aria-label") !== label) { b.setAttribute("aria-label", label); b.setAttribute("data-tip", label); b.setAttribute("aria-pressed", String(all)); b.querySelector("path").setAttribute("d", all ? "M4 6.5L8 3l4 3.5M4 9.5L8 13l4-3.5" : "M4 2.5l4 3.5 4-3.5M4 13.5l4-3.5 4 3.5"); }      // arrows apart : unfold ; arrows that meet : fold
}
function sweep() { for (const g of document.querySelectorAll(GROUPS)) dress(g); for (const p of document.querySelectorAll(".side")) headButton(p); }
function toggle(g, e) {
  const key = keyOf(g), panel = g.closest(".side");
  if (e && e.altKey && panel && !own(g)) folds = soloFold(folds, groupsOf(panel).map(keyOf), key); else folds = setFold(folds, key, !folds[key]);
  save(); sweep();
}
/** Opens the folded groups an element is in : where the guide sends the designer must be seen. → true when something was opened */
export function unfoldAround(node) {
  if (!installed || !node || !node.closest) return false;
  let done = false;
  for (let g = node.closest(".folded"); g; g = g.parentElement && g.parentElement.closest(".folded")) if (headOf(g)) { folds = setFold(folds, keyOf(g), false); done = true; }
  if (done) { save(); sweep(); }
  return done;
}

/** Makes the groups of every side panel foldable, now and each time a panel is drawn anew. Called once, when the application starts. */
export function installFolds() {
  if (installed || typeof document === "undefined") return; installed = true;
  folds = { ...readFolds(window.localStorage), ...folds };
  document.addEventListener("click", (e) => {
    const h = e.target.closest && e.target.closest(".fold-head"), g = h && h.parentElement; if (!g || headOf(g) !== h) return;
    const control = e.target.closest("button, a, input, select, label");
    if (control && h.contains(control) && control !== h) {      // a button of the heading does its own work ; one that adds something opens the folded group to show it — a switch (the eye of a type) does not
      if (folds[keyOf(g)] && !control.hasAttribute("aria-pressed")) { folds = setFold(folds, keyOf(g), false); save(); sweep(); }
      return;
    }
    toggle(g, e);
  });
  document.addEventListener("keydown", (e) => { const h = e.target; if ((e.key === "Enter" || e.key === " ") && h.classList && h.classList.contains("fold-head") && h.parentElement && headOf(h.parentElement) === h) { e.preventDefault(); toggle(h.parentElement, e); } });
  /* a panel drawn anew comes back unfolded : it is dressed again before the page is painted */
  const drawn = (m) => (m.target.closest && m.target.closest(".side")) || [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches(".side, .side-section, [data-fold-key]") || n.querySelector(".side-section, [data-fold-key]")));
  new MutationObserver((list) => { if (list.some(drawn)) sweep(); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(sweep, 0));
  sweep();
}
