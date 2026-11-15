/* DesignWizard.ai — the 3D viewport shared by every studio: the viewer plus its toolbar
   (standard views, fit, x-ray, section, exploded view, measure, picture) and a busy veil. */

import { el, btn, icon, download, toast } from "./dom.js";
import { Viewer } from "./viewer.js";
import { popupMenu } from "./view_select.js";

export function createViewport(host, opts = {}) {
  host.classList.add("viewport");
  const viewer = new Viewer(host, { onPick: (h, e) => opts.onPick && opts.onPick(h, e), onHover: opts.onHover, onMenu: (h, e) => (opts.onMenu ? opts.onMenu(h, e) : popupMenu(e, menu())), onMeasure: opts.onMeasure, onKey: (e) => onKey(e) });
  host._viewer = viewer;                                          // for whoever inspects the page (tests, the console)
  const busy = el("div", { class: "view-busy hidden" }, "");
  const status = el("div", { class: "view-status" });
  const tools = el("div", { class: "view-tools" });
  host.append(tools, status, busy);

  const group = (...items) => { const g = el("div", { class: "group" }, items); tools.append(g); return g; };
  const vbtn = (label, tip, fn, ico) => btn(label, fn, { small: true, tip, icon: ico });
  group(vbtn("Iso", "Vue isométrique (touche 0)", () => viewer.view("iso")), vbtn("Face", "Vue de face (1)", () => viewer.view("front")), vbtn("Dessus", "Vue de dessus (5)", () => viewer.view("top")),
    vbtn("Droite", "Vue de droite (4)", () => viewer.view("right")), vbtn("", "Cadrer tout (F)", () => viewer.fit(), "fit"));

  const state = { xray: false, section: null, measure: false, flip: false };
  const bX = vbtn("", "Rayons X : voir à travers les pièces (X)", () => toggleXray(), "eye");
  const bM = vbtn("", "Mesurer : cliquez deux points ou deux faces (M)", () => toggleMeasure(), "ruler");
  const secSel = el("select", { "aria-label": "Plan de coupe", "data-tip": "Coupe : choisissez un axe puis glissez le curseur (S)" },
    el("option", { value: "" }, "Coupe : aucune"), el("option", { value: "x" }, "Coupe X"), el("option", { value: "y" }, "Coupe Y"), el("option", { value: "z" }, "Coupe Z"));
  const secPos = el("input", { type: "range", min: "0", max: "1", step: "0.005", value: "0.5", class: "hidden", "aria-label": "Position de la coupe" });
  // the cut has two sides : the toggle shows the other one (what was cut away comes back, what was shown is cut)
  const secFlip = vbtn("", "Inverser la coupe : montrer l'autre côté (Maj + S)", () => { state.flip = !state.flip; secFlip.classList.toggle("on", state.flip); applySection(); }, "refresh");
  secFlip.classList.add("hidden");
  const applySection = () => { viewer.setSection(secSel.value || null, +secPos.value, !!state.flip); secPos.classList.toggle("hidden", !secSel.value); secFlip.classList.toggle("hidden", !secSel.value); };
  secSel.addEventListener("change", applySection); secPos.addEventListener("input", applySection);
  secSel.style.width = "auto"; secSel.style.padding = ".12rem .3rem"; secSel.style.fontSize = ".8rem";
  group(bX, bM, secSel, secPos, secFlip);
  function toggleXray() { state.xray = !state.xray; viewer.setXray(state.xray); bX.classList.toggle("on", state.xray); }
  function toggleMeasure() { state.measure = !state.measure; viewer.setMode(state.measure ? "measure" : "select"); bM.classList.toggle("on", state.measure); if (state.measure) toast("Mesure : cliquez un premier point (ou une face), puis un second.", "info", 3000); }

  let explode = null;
  if (opts.explode) {
    explode = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: "0", "aria-label": "Vue éclatée", "data-tip": "Vue éclatée : écarte les pièces le long de leurs interfaces (E)" });
    explode.addEventListener("input", () => viewer.setExplode(+explode.value * (opts.explodeScale ? opts.explodeScale() : 60)));
    group(icon("explode"), explode);
  }
  group(vbtn("", "Enregistrer une image PNG de la vue", () => download(`${opts.name ? opts.name() : "vue"}.png`, dataUrlBlob(viewer.snapshot())), "camera"));

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === "x") toggleXray(); else if (k === "m") toggleMeasure();
    else if (k === "s" && e.shiftKey && secSel.value) secFlip.click();
    else if (k === "s") { secSel.value = secSel.value ? "" : "z"; applySection(); }
    else if (k === "e" && explode) { explode.value = +explode.value > 0 ? "0" : "0.6"; explode.dispatchEvent(new Event("input")); }
    else if (k === "escape" && state.measure) toggleMeasure();
    else if (opts.onKey) opts.onKey(e);
  }

  /** What a right click offers in every view : the gestures of the view itself. */
  const menu = () => [{ title: "Vue" }, { label: "Cadrer tout", keys: "F", icon: "fit", run: () => viewer.fit() }, { label: "Vue isométrique", keys: "0", icon: "part", run: () => viewer.view("iso") }, { label: "Face", keys: "1", icon: "part", run: () => viewer.view("front") }, { label: "Dessus", keys: "5", icon: "part", run: () => viewer.view("top") }, { label: "Droite", keys: "4", icon: "part", run: () => viewer.view("right") },
      "—", { label: state.xray ? "Quitter les rayons X" : "Rayons X", keys: "X", icon: "eye", run: toggleXray }, { label: state.measure ? "Quitter la mesure" : "Mesurer", keys: "M", icon: "ruler", run: toggleMeasure },
      { label: secSel.value ? "Retirer la coupe" : "Coupe", keys: "S", icon: "section", run: () => { secSel.value = secSel.value ? "" : "z"; applySection(); } }, secSel.value ? { label: "Inverser la coupe", keys: "Maj+S", icon: "refresh", run: () => secFlip.click() } : null];

  return {
    viewer, tools, status, group,
    setBusy(text) { busy.textContent = text || ""; busy.classList.toggle("hidden", !text); },
    setStatus(...nodes) { status.replaceChildren(...nodes.filter(Boolean)); },
    resetSection() { secSel.value = ""; applySection(); },
    menu,
    /** A cut through a point, square to an axis ("x", "y" or "z") : the plane passes where the designer pointed. */
    sectionAt(axis, coord) { const bb = viewer.bbox(), i = "xyz".indexOf(axis), lo = bb.min.getComponent(i), hi = bb.max.getComponent(i); secSel.value = axis; secPos.value = String(Math.max(0, Math.min(1, (coord - lo) / ((hi - lo) || 1)))); applySection(); },
    dispose() { viewer.dispose(); },
  };
}

/** Add every body of a built part to the viewer. Returns the object ids. */
export function showBuilt(viewer, built, o = {}) {
  const ids = [];
  for (const b of built.bodies) {
    const id = `${o.prefix || built.id}/${b.name}`;
    viewer.add({ id, name: b.label || b.name, mesh: b.mesh, color: (o.colors && o.colors[b.name]) || o.color || b.color, opacity: o.opacity ?? b.opacity, matrix: o.matrix || null,
      explodeDir: o.explodeDir || null, pickable: o.pickable, data: { part: built.id, body: b.name, inst: o.inst || null, ...(o.data || {}) } });
    ids.push(id);
  }
  return ids;
}
export function dataUrlBlob(url) {
  const [head, b64] = url.split(","), mime = /:(.*?);/.exec(head)[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
