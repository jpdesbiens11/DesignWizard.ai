/* DesignWizard.ai — the colour of a part, picked by its designer : a round swatch beside each part, and a picker that opens
   on it — a row per colour, a column per shade, lighter / darker, see-through or not, any other colour, or back to the
   colour of the material. Each choice is one undoable step ; the picker stays open to try another. Words and colours :
   core/part_look.js. */

import { el, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { materialOrDefault } from "../cad/materials.js";
import { palette, SHADES, OPACITIES, lookOf, shownLook, setLook, lighter, darker, colorName, luminance, validHex, autoLooks } from "../core/part_look.js";

const shown = (spec) => { const m = materialOrDefault(spec.material); return { ...shownLook(spec, m.color, m.opacity), material: m }; };
const paint = (spec, patch, label) => store.updatePart(spec.id, (x) => { setLook(x, patch); }, `${spec.id} : ${label}`);

/** The swatch of a part : its colour, dashed when it is only the colour of its material. A click opens the picker. */
export function lookSwatch(spec, o = {}) {
  const s = shown(spec), tip = s.own ? `Couleur de ${spec.id} : ${colorName(s.color)}${s.opacity < 1 ? `, ${Math.round(s.opacity * 100)} % opaque` : ""} — cliquer pour la changer` : `${spec.id} a la couleur de sa matière — cliquer pour lui donner la sienne`;
  return el("button", { class: `look-dot${s.own ? " own" : ""}${o.big ? " big" : ""}`, type: "button", "data-look": spec.id, "aria-label": tip, "data-tip": tip, style: { background: s.color, opacity: String(Math.max(0.45, s.opacity)) },
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); openLookPicker(spec.id, e.currentTarget); } });
}

/** The picker of one part, next to the node that opened it. It reads the part again after each choice. */
export function openLookPicker(id, anchor) {
  document.querySelectorAll(".look-pop").forEach((n) => n.remove());
  const pop = el("div", { class: "look-pop", role: "dialog", "aria-label": "Couleur de la pièce" }), spec = () => store.part(id);
  const close = () => { pop.remove(); document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key, true); };
  const away = (ev) => { if (!pop.contains(ev.target)) close(); }, key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } };
  const set = (patch, label) => { const p = spec(); if (!p) return close(); paint(p, patch, label); draw(); };
  function draw() {
    const p = spec(); if (!p) return close();
    const s = shown(p), own = lookOf(p), cur = own.color;
    const cell = (c) => el("button", { class: `look-cell${c.hex === cur ? " on" : ""}`, type: "button", "data-color": c.hex, "aria-label": c.label, "data-tip": c.label, "aria-pressed": c.hex === cur ? "true" : "false", style: { background: c.hex, color: luminance(c.hex) > 0.6 ? "#16283c" : "#fff" },
      onClick: () => set({ color: c.hex }, `couleur ${c.label.toLowerCase()}`) }, c.hex === cur ? "✓" : "");
    const custom = el("input", { type: "color", value: s.color, "aria-label": "Une autre couleur", "data-tip": "Une autre couleur, au choix", onChange: (e) => set({ color: validHex(e.target.value) }, "couleur au choix") });
    pop.replaceChildren(
      el("div", { class: "look-head" }, el("span", { class: "look-dot big own", style: { background: s.color, opacity: String(Math.max(0.45, s.opacity)) } }), el("div", { class: "grow" }, el("b", null, p.name || p.id), el("small", null, s.own && cur ? colorName(cur) : `couleur de la matière — ${s.material.name}`)),
        el("button", { class: "icon-btn", type: "button", "aria-label": "Fermer", onClick: close }, icon("close"))),
      el("div", { class: "look-grid", role: "group", "aria-label": "Couleurs et teintes" }, el("span"), SHADES.map((x) => el("small", { class: "look-col" }, x.fr)),
        palette().map((row) => [el("small", { class: "look-row" }, row.fr), row.cells.map(cell)])),
      el("div", { class: "look-tools" }, el("button", { class: "chip-btn", type: "button", "data-shade": "lighter", "data-tip": "La même couleur, un cran plus clair", onClick: () => set({ color: lighter(s.color) }, "teinte plus claire") }, "☀ Plus clair"),
        el("button", { class: "chip-btn", type: "button", "data-shade": "darker", "data-tip": "La même couleur, un cran plus foncé", onClick: () => set({ color: darker(s.color) }, "teinte plus foncée") }, "☾ Plus foncé"),
        el("label", { class: "look-custom" }, custom, el("span", null, "Autre…"))),
      el("div", { class: "look-tools", role: "group", "aria-label": "Transparence" }, OPACITIES.map((o) => { const on = Math.abs((own.opacity ?? 1) - o.v) < 0.05;
        return el("button", { class: `chip-btn${on ? " on" : ""}`, type: "button", "data-opacity": String(o.v), "aria-pressed": on ? "true" : "false", "data-tip": o.v < 1 ? "Voir à travers la pièce : ce qu'elle cache apparaît" : "La pièce cache ce qui est derrière elle", onClick: () => set({ opacity: o.v }, o.fr.toLowerCase()) }, o.fr); })),
      el("button", { class: "menu-item", type: "button", "data-look-reset": "1", disabled: !s.own, onClick: () => set({ color: null, opacity: null }, "couleur de la matière") }, icon("undo"), el("span", { class: "grow" }, `Revenir à la couleur de la matière (${s.material.name})`)),
      el("p", { class: "muted small look-note" }, "Une aide pour reconnaître la pièce à l'écran, dans son studio et dans l'assemblage. Ce n'est pas une finition : elle ne va sur aucun dessin et ne touche ni à la revue ni à la révision."));
  }
  draw(); document.body.append(pop);
  const a = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { right: 80, top: 80, bottom: 100 }, r = pop.getBoundingClientRect();
  pop.style.left = `${Math.max(6, Math.min(a.right + 8, window.innerWidth - r.width - 8))}px`; pop.style.top = `${Math.max(6, Math.min(a.top - 8, window.innerHeight - r.height - 8))}px`;
  setTimeout(() => { document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", key, true); }, 0);
  return close;
}

/** Two shortcuts over the list of parts : a colour of its own for every part that has none, and back to the materials. */
export function lookTools(parts) {
  const some = parts.some((p) => lookOf(p).color || lookOf(p).opacity !== null), all = parts.length > 0 && parts.every((p) => lookOf(p).color);
  return el("span", { class: "look-all" },
    el("button", { class: "icon-btn", type: "button", disabled: all || !parts.length, "data-look-auto": "1", "aria-label": "Une couleur par pièce", "data-tip": "Une couleur par pièce : chaque pièce qui n'en a pas reçoit la sienne, différente de ses voisines. Celles que vous avez choisies restent.",
      onClick: () => store.commit("Une couleur par pièce", (p) => { for (const [id, hex] of autoLooks(p.parts || [])) { const x = (p.parts || []).find((q) => q.id === id); if (x) setLook(x, { color: hex }); } }) }, icon("palette")),
    el("button", { class: "icon-btn", type: "button", disabled: !some, "data-look-clear": "1", "aria-label": "Couleurs des matières", "data-tip": "Toutes les pièces reprennent la couleur de leur matière",
      onClick: () => store.commit("Couleurs des matières", (p) => { for (const x of p.parts || []) delete x.look; }) }, icon("undo")));
}
