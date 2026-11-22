/* DynamiteOrbit — the names of the trade for a board, on the screens (core/board_names.js says the words). Installed once :
   every text that is drawn is mapped as it enters the page — the text of an element, its tip, its accessible name —, so a
   screen declares nothing and a new screen follows without knowing. What somebody types, the code of an artefact (.dwiz,
   JSON, a prompt to copy) and the fields are left alone : they are data, or the person's own words in the making.
   The original text of what was mapped is kept on its node, so that another choice maps again from what was written.
   boardNamePicker() is the row of the menu of the account, beside the units. */

import { el, clear } from "./dom.js";
import { getBoardNames, setBoardNames, nameBoards, BOARD_NAME_SETS, goodBoardWord } from "./board_names.js";

const ATTRS = ["data-tip", "aria-label", "title", "placeholder"], SKIP = "textarea, input, pre, code, script, style, .prompt-box, [contenteditable], [data-raw]";
const WAS = Symbol("the text as it was written"), NOW = Symbol("the text it was given");

function mapText(n, names) {
  if (n[NOW] === n.data) return;                                           // our own writing, seen again by the observer
  n[WAS] = n.data; const t = nameBoards(n.data, names); if (t !== n.data) n.data = t; n[NOW] = n.data;
}
function mapEl(e, names) {
  for (const a of ATTRS) { const v = e.getAttribute(a); if (!v) continue; const now = e[NOW] || (e[NOW] = {}), was = e[WAS] || (e[WAS] = {});
    if (now[a] === v) continue; was[a] = v; const t = nameBoards(v, names); if (t !== v) e.setAttribute(a, t); now[a] = t; }
}
function each(root, fn) {
  if (root.nodeType === 3) { if (root.parentElement && !root.parentElement.closest(SKIP)) fn(root); return; }
  if (root.nodeType !== 1 || root.closest(SKIP)) return;
  fn(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = w.nextNode(); n; n = w.nextNode()) fn(n);
}
const map = (names) => (n) => (n.nodeType === 3 ? mapText(n, names) : mapEl(n, names));
/* back to what was written : what the page changed since is kept as it is */
function restore(n) {
  if (n.nodeType === 3) { if (n[WAS] !== undefined && n[NOW] === n.data) n.data = n[WAS]; delete n[WAS]; delete n[NOW]; return; }
  if (n[WAS]) for (const [a, v] of Object.entries(n[WAS])) if (n[NOW] && n[NOW][a] === n.getAttribute(a)) n.setAttribute(a, v);
  delete n[WAS]; delete n[NOW];
}

/** Starts mapping the page, now and whenever the choice changes. */
export function installBoardNames() {
  let obs = null;
  const start = () => {
    if (obs) { obs.disconnect(); obs = null; }
    each(document.body, restore);
    const names = getBoardNames(); if (names.plain) return;
    each(document.body, map(names));
    obs = new MutationObserver((list) => { const nm = getBoardNames(), f = map(nm);
      for (const m of list) { if (m.type === "childList") { for (const n of m.addedNodes) each(n, f); } else if (m.type === "characterData") { const p = m.target.parentElement; if (p && !p.closest(SKIP)) f(m.target); } else if (!m.target.closest(SKIP)) f(m.target); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  window.addEventListener("dw:boardNames", start);
  start();
}

/** The choice, as a row of buttons, and two fields for the words of the house. o.keep : true inside a menu, so that a click does not close it. → the node */
export function boardNamePicker(o = {}) {
  const host = el("div", { class: "unit-pick board-names", "data-raw": "" }), hold = (e) => { if (o.keep) e.stopPropagation(); };
  function draw() {
    const N = getBoardNames(); clear(host);
    host.append(el("div", { class: "unit-seg", role: "group", "aria-label": "Noms du métier pour une carte" }, Object.entries(BOARD_NAME_SETS).map(([k, s]) => el("button", { type: "button", class: k === N.set ? "on" : null, "aria-pressed": k === N.set ? "true" : "false", "data-names": k, "data-tip": s.hint,
      onClick: (e) => { hold(e); setBoardNames(k === "own" ? { set: "own", bare: N.bare, assy: N.assy } : { set: k }); draw(); } }, s.label))));
    if (N.set === "own") {
      const field = (key, label, self) => { const input = el("input", { type: "text", value: N[key], maxlength: "24", "aria-label": label, "data-own": key, onClick: hold, onKeydown: (e) => { e.stopPropagation(); if (e.key === "Enter") input.blur(); },
        onChange: () => { const ok = goodBoardWord(input.value, self); input.classList.toggle("bad", !ok); if (ok) { setBoardNames({ set: "own", [key]: input.value }); draw(); } } });
        return el("label", { class: "board-word" }, el("span", null, label), input); };
      host.append(el("div", { class: "board-words" }, field("bare", "Carte nue", "PCB"), field("assy", "Carte assemblée", "PCBA")));
    }
    host.append(el("small", { class: "muted unit-note" }, N.plain ? "La carte nue se dit PCB, la carte assemblée PCBA." : `La carte nue se dit ${N.bare}, la carte assemblée ${N.assy} — à l'écran et dans les documents Word et PDF. Les identifiants, les noms de fichiers et les .dwiz ne changent pas.`));
  }
  draw(); return host;
}
