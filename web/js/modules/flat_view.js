/* DynamiteOrbit — « Plié · À plat » : a thin folded part seen in its flat state, in the 3D view of its studio (JP, 21 novembre 2026).
   The convention of the mechanical modelers : a switch of the view between the folded part and its flat pattern ; on the flat, the bend
   lines (dash-dot, the colour of the bend lines of the « Développé » tab) and their notes — UP / DOWN, the angle, the inside radius, seen
   from the top face. A click on a note says which bend it is and where it is changed : the bends are not edited on the flat (they are
   edited in the definition of the part). The flat is computed by core/flat_pattern.js and built by the kernel as a part of its own.
   flatToggle(vp, { spec(), built(), repaint(), onBend(bend), tags (the overlays of the screen, hidden on the flat) }) → { sync(), refresh(), on() } : sync() after the part changes (shows or hides
   the switch), refresh() after a build (the flat follows), on() tells whether the flat is shown. */

import { el, toast } from "../core/dom.js";
import { kernel } from "../cad/client.js";
import { showBuilt } from "../core/viewport.js";
import { canFlatten, flatOf, flatSpec } from "../core/flat_pattern.js";
import { BEND_COLOR } from "./part_fold.js";

const MODES = [{ key: "folded", label: "Plié", tip: "La pièce telle qu'elle est montée" }, { key: "flat", label: "À plat", tip: "La pièce dépliée, telle qu'elle est découpée : les lignes de pli et leurs notes (UP / DOWN, angle, rayon intérieur), vues de la face du dessus" }];

export function flatToggle(vp, o) {
  const st = { mode: "folded", token: 0, flat: null };
  const seg = el("div", { class: "seg text flat-seg", role: "group", "aria-label": "Forme de la pièce : pliée ou à plat", "data-flat-toggle": "" });
  for (const m of MODES) { const b = el("button", { type: "button", class: "seg-btn", "data-mode": m.key, "data-tip": m.tip }, m.label); b.addEventListener("click", () => set(m.key)); seg.append(b); }
  const note = el("span", { class: "chip flat-note hidden", "data-flat-note": "" }, "");
  vp.group(seg, note);
  const paint = () => { for (const b of seg.children) { const on = b.dataset.mode === st.mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } note.classList.toggle("hidden", st.mode !== "flat"); };

  async function show() {
    const token = ++st.token, v = vp.viewer, spec = o.spec(), flat = flatOf(spec, o.built());
    if (!flat) { set("folded"); return; }
    st.flat = flat;
    try {
      const built = await kernel.build(flatSpec(flat, spec), null, `${spec.id}~flat`);
      if (token !== st.token || st.mode !== "flat") return;
      const keep = new Set(showBuilt(v, built, { prefix: "flat" }));
      for (const k of [...v.objects.keys()]) if (!keep.has(k)) v.remove(k);
      v.clearOverlays("flat"); for (const t of o.tags || []) v.clearOverlays(t);
      const z = flat.t + 0.02;
      for (const b of flat.bends) {
        v.addPath([[b.a[0], b.a[1], z], [b.b[0], b.b[1], z]], BEND_COLOR, "flat", 0.6, true);
        v.addLabel([(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, z], `${b.id} · ${b.label}`, "flat", "bend", () => (o.onBend ? o.onBend(b) : toast(`${b.id} : ${b.label}, ${b.dir === "UP" ? "vers la face du dessus" : "vers la face du dessous"}. Le pli se change dans la définition de la pièce${b.of ? ` (branche ${b.of})` : ""}, pas sur le flan.`)));
      }
      for (const m of flat.marks) v.addLabel([m.at[0], m.at[1], m.face === "top" ? flat.t + m.h : 0], m.id, "flat", m.kind === "temp" ? "iface" : "warn");
      note.textContent = `À plat · ${flat.size[0].toFixed(1)} × ${flat.size[1].toFixed(1)} mm · ${flat.bends.length} pli(s) · k ${flat.k}`;
      note.dataset.tip = flat.notes.join(" ");
      v.view("top"); v.fit(); v.invalidate();
    } catch (e) { if (token === st.token) { toast(`À plat : ${e.message}`); set("folded"); } }
  }
  function set(mode) {
    if (mode === st.mode) return;
    st.mode = mode; paint();
    if (mode === "flat") { show(); return; }
    st.token++; vp.viewer.clearOverlays("flat");
    for (const k of [...vp.viewer.objects.keys()]) if (k.startsWith("flat")) vp.viewer.remove(k);
    o.repaint(); vp.viewer.view("iso"); vp.viewer.fit();
  }
  function sync() { const ok = canFlatten(o.spec(), o.built()); seg.hidden = !ok; if (!ok && st.mode === "flat") set("folded"); }
  paint(); sync();
  return { sync, refresh: () => { sync(); if (st.mode === "flat") show(); }, on: () => st.mode === "flat", flat: () => st.flat };
}
