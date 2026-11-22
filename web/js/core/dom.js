/* DynamiteOrbit — DOM helpers (same habits as DynamiteAgile): nodes are built with el() and textContent,
   never innerHTML on data. el() ignores null / undefined / false children. */

import { stampText } from "./brand.js";
import { getUnits, massText, measure, measures, proseUnits, shownUnit, fieldValue, fromShown, converts } from "./units.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style" && typeof v === "object") { for (const [p, x] of Object.entries(v)) { if (p.startsWith("--")) node.style.setProperty(p, x); else node.style[p] = x; } }      // a custom property (« --g ») is set by name : an assignment would drop it
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k in node && !["list", "type", "form"].includes(k) && typeof v !== "string") node[k] = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  append(node, children);
  return node;
}
export function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export function icon(name, cls = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "sk-icon " + cls);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  const theme = document.documentElement.dataset.theme;       // hand-drawn sprite in « Le.Carnet », straight lines in the other themes
  use.setAttribute("href", `img/${theme && theme !== "carnet" ? "icons-crisp" : "icons"}.svg#i-${name}`);
  svg.append(use);
  return svg;
}
export function svg(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}

export function btn(label, onClick, opts = {}) {
  const b = el("button", { type: "button", class: "btn" + (opts.primary ? " btn-primary" : "") + (opts.small ? " btn-small" : "") + (opts.danger ? " btn-danger" : "") + (opts.cls ? " " + opts.cls : ""),
    disabled: opts.disabled, "data-tip": opts.tip, "aria-label": opts.aria || (label ? null : opts.tip) }, opts.icon && icon(opts.icon), label && el("span", null, label));
  if (onClick) b.addEventListener("click", (e) => onClick(e, b));
  return b;
}
export function badge(text, kind = "neutral") { return el("span", { class: `badge badge-${kind}` }, text); }
export function field(label, input, hint) {
  return el("label", { class: "field" }, el("span", { class: "field-label" }, label), input, hint && el("span", { class: "field-hint" }, hint));
}
/** An On / Off switch, the same in every tree. on : its state ; set(next, event) ; what : what it turns on and off (« E1 »). */
export function onOff(on, set, what, tip) {
  return el("button", { class: "switch" + (on ? " on" : ""), type: "button", role: "switch", "aria-checked": on ? "true" : "false", "aria-label": `${what} : ${on ? "On" : "Off"}`,
    "data-tip": tip || (on ? `${what} compte (On) — cliquer pour le mettre de côté (Off)` : `${what} est de côté (Off) — cliquer pour le remettre (On)`), onClick: (e) => { e.stopPropagation(); set(!on, e); } });
}
export function table(headers, rows, cls = "") {
  return el("div", { class: "table-wrap " + cls }, el("table", { class: "data" },
    el("thead", null, el("tr", null, headers.map((h) => el("th", null, h)))),
    el("tbody", null, rows.map((r) => el("tr", r && r.attrs ? r.attrs : null, (r.cells || r).map((c) => el("td", null, c)))))));
}

let toastBox = null;
export function toast(message, kind = "info", ms = 4200) {
  if (!toastBox) { toastBox = el("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastBox); }
  const t = el("div", { class: `toast toast-${kind}` }, message);
  toastBox.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

/** Modal dialog. Returns {close, body}. `opts.wide` for large content; Esc and backdrop click close it. */
export function modal(title, content, opts = {}) {
  const body = el("div", { class: "modal-body" }, content);
  const box = el("div", { class: "modal" + (opts.wide ? " modal-wide" : "") + (opts.xl ? " modal-xl" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
    el("div", { class: "modal-head" }, el("h2", null, title), el("button", { class: "icon-btn", type: "button", "aria-label": "Fermer", onClick: () => close() }, "×")), body);
  const back = el("div", { class: "modal-backdrop" + (opts.float ? " float" : "") }, box);      // float : the dialog stands aside and the screen behind stays live (the 3D view answers it)
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  function close(result) { back.remove(); document.removeEventListener("keydown", onKey, true); if (opts.onClose) opts.onClose(result); }
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  document.addEventListener("keydown", onKey, true);
  document.body.append(back);
  const first = box.querySelector("input, textarea, select, button.btn-primary");
  if (first) setTimeout(() => first.focus(), 30);
  return { close, body, box };
}
export function confirmBox(title, message, okLabel = "Confirmer", danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(title, [el("p", null, message), el("div", { class: "form-actions" },
      btn("Annuler", () => m.close()), btn(okLabel, () => { done = true; m.close(); }, { primary: !danger, danger }))], { onClose: () => resolve(done) });
  });
}
export function promptBox(title, label, value = "", hint = "") {
  return new Promise((resolve) => {
    let out = null;
    const input = el("input", { type: "text", value });
    const ok = () => { out = input.value.trim(); m.close(); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    const m = modal(title, [field(label, input, hint), el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("OK", ok, { primary: true }))], { onClose: () => resolve(out) });
  });
}

/* Tooltip written like a sticky note (data-tip attribute), placed so it is never clipped. */
let tipEl = null;
export function installTips() {
  tipEl = el("div", { class: "sk-tip", role: "tooltip" });
  document.body.append(tipEl);
  const show = (t) => {
    const text = t.getAttribute("data-tip");
    if (!text) return;
    tipEl.textContent = text;
    const r = t.getBoundingClientRect();
    tipEl.classList.add("on");
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
  };
  document.addEventListener("mouseover", (e) => { const t = e.target.closest && e.target.closest("[data-tip]"); if (t) show(t); else tipEl.classList.remove("on"); });
  document.addEventListener("focusin", (e) => { const t = e.target.closest && e.target.closest("[data-tip]"); if (t) show(t); });
  document.addEventListener("focusout", () => tipEl.classList.remove("on"));
  document.addEventListener("mousedown", () => tipEl.classList.remove("on"));
}

export function download(name, data, mime = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([stampText(name, data)], { type: mime });      // a text file leaves with the note of the platform (core/brand.js) — whoever wrote it
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = el("textarea", { value: text, style: { position: "fixed", opacity: "0" } });
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}
export const fmt = (v, d = 2) => (typeof v === "number" && Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("fr-CA", { maximumFractionDigits: d }) : "—");
export function debounce(fn, ms = 250) { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
/* ---------- quantities, in the units the designer chose (core/units.js) : the tools keep their millimetres, the screens convert as they write ---------- */
const local = (x) => (typeof x === "number" ? x.toLocaleString("fr-CA", { maximumFractionDigits: 6 }) : String(x));
/** A mass given in grams : « 111,1 g », « 1,83 kg » — with ounces or pounds beside in the imperial system. */
export function fmtMass(g) { return massText(g, getUnits(), local); }
/** A length given in millimetres, with its unit : « 12,5 mm » or « 0,4921 in ». unit : another unit of the tools (« mm² », « cm³ », « N », « MPa »…). */
export const fmtLen = (v, d = 2, unit = "mm") => measure(v, unit, d, getUnits(), local);
/** Several dimensions in millimetres and one unit : « 160 × 110 × 42 mm ». */
export const fmtDims = (list, d = 1, unit = "mm") => measures(list, unit, d, getUnits(), local);
/** A sentence written in millimetres, read in the units chosen. */
export const inUnits = (text) => proseUnits(text, getUnits());
/* a number FIELD whose value the project keeps in a unit of the tools (millimetres unless said) : what it shows, what it reads back, its label, its step */
/** Is the number behind this label a length ? Not when the label names another unit — (A), (N), (V), (°), (%) — or counts things. */
export const lengthLabel = (label) => !/\((?:A|N|V|°|%|kg|g|s|W|K|m)(?=[ )])[^)]*\)|^(?:Points|Pistes|Nombre|Quantité|Cordons)(?![A-Za-zÀ-ÿ])/.test(String(label || ""));
/** The value to put in the field : as kept when nothing converts, in the unit chosen otherwise. */
export const unitShown = (v, unit = "mm") => (v === undefined || v === null || v === "" ? "" : fieldValue(v, unit, getUnits()));
/** What was typed, back in the unit of the tools. */
export const unitBack = (v, unit = "mm") => fromShown(v, unit, getUnits());
/** The label of the field : « Largeur (mm) » reads « Largeur (in) », « Largeur » reads « Largeur (in) » — and stays as it is in SI. */
export const unitLabel = (label, unit = "mm") => (converts(unit, getUnits()) ? `${String(label).replace(new RegExp(` ?\\(${unit}\\)$`), "")} (${shownUnit(unit, getUnits())})` : label);
/** The step of the field : the tool's own in its unit, free when the value is converted. */
export const unitStep = (step, unit = "mm") => (converts(unit, getUnits()) ? "any" : step);
/** True when the fields of this unit show another one. */
export const unitOn = (unit = "mm") => converts(unit, getUnits());
/** A number input for a value the project keeps in a unit of the tools (millimetres unless said), shown and typed in the unit chosen when its label reads as a
    length. attrs : the attributes of the input, its value / min / max in the unit of the tools ; take(v, e) gets what was typed, back in that unit.
    o : { unit, length (true / false : do not read the label), event ("onInput" by default) }. → { input, label } */
export function unitInput(label, attrs, take, o = {}) {
  const unit = o.unit || "mm", len = o.length ?? lengthLabel(label), on = len && unitOn(unit), tip = attrs["data-tip"];
  const input = el("input", { type: "number", ...attrs, value: len ? unitShown(attrs.value, unit) : attrs.value, step: on ? "any" : attrs.step, min: on && attrs.min !== undefined ? 0 : attrs.min, max: on && typeof attrs.max === "number" ? unitShown(attrs.max, unit) : attrs.max,
    "data-tip": typeof tip === "string" ? inUnits(tip) : tip, [o.event || "onInput"]: (e) => { const raw = parseFloat(e.target.value); take(len ? unitBack(raw, unit) : raw, e); } });
  return { input, label: len ? unitLabel(label, unit) : label };
}
/** The same, as a labelled field. */
export const unitField = (label, attrs, take, o = {}) => { const u = unitInput(label, attrs, take, o); return field(u.label, u.input, o.hint); };
