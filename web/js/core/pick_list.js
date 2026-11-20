/* DesignWizard.ai — a drop-down list one can search (demande de JP : « un menu déroulant pour choisir la pièce… quand il y a
   30 pièces, il faut vraiment scroller »). A button shows what is chosen ; it opens a list grouped by nature — a colour per
   group, a pictogram and a short title per line — with a field that narrows it as one types.
   The usage it follows : the combobox of the web (WAI-ARIA « combobox with a listbox popup ») — Enter, Space or ↓ opens ; typing
   filters ; ↑ ↓ Home End move ; Enter chooses ; Escape closes and gives the focus back to the button ; a click elsewhere closes. */

import { el, icon } from "./dom.js";

const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** The lines of the groups that hold every word typed (accents and case do not count) ; a group left empty goes away. Pure. */
export function filterGroups(groups, text) {
  const words = plain(text).split(/\s+/).filter(Boolean);
  return (groups || []).map((g) => ({ ...g, items: (g.items || []).filter((it) => { const hay = plain(`${it.title} ${it.sub || ""} ${it.id}`); return words.every((w) => hay.includes(w)); }) })).filter((g) => g.items.length);
}
let seq = 0;
/** o : { label (what is chosen here, for a screen reader), value (id of the line chosen), groups: [{ label, color, items: [{ id, title, sub, icon, dot (a colour) }] }],
    onPick(id, event), empty (words when there is nothing to choose),
    extra(item, close) → a small control at the end of a line (« open in a tab »), foot(close) → what closes the list (« new… », « see all ») } → the button */
export function pickList(o) {
  const all = () => (o.groups || []).flatMap((g) => g.items), cur = all().find((it) => it.id === o.value) || null, uid = `pick${++seq}`;
  const face = (it) => (it ? [icon(it.icon || "part"), el("span", { class: "grow pick-title" }, el("b", null, it.title), it.sub ? el("small", null, it.sub) : null)] : [el("span", { class: "grow muted" }, o.empty || "Rien à choisir")]);
  const button = el("button", { class: "pick-btn", type: "button", role: "combobox", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-controls": `${uid}-list`, "aria-label": `${o.label}${cur ? ` : ${cur.title}` : ""}`, "data-pick": o.value || "", "data-tip": cur ? `${o.label} : ${cur.title}${cur.sub ? ` — ${cur.sub}` : ""}. Cliquer pour en choisir une autre.` : null, disabled: !all().length }, ...face(cur), icon("chevron-down"));
  return pickMenu(button, o, uid);
}
/** The same list behind a button of one's own — the chevron of a breadcrumb. The button says what it is (its name, aria-haspopup). */
export function pickMenu(button, o, uid = `pick${++seq}`) {
  const all = () => (o.groups || []).flatMap((g) => g.items);
  button.setAttribute("aria-haspopup", "listbox"); button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", `${uid}-list`);
  let pop = null, active = -1, shown = [];
  const close = (focus = true) => { if (!pop) return; pop.remove(); pop = null; button.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", away, true); if (focus) button.focus(); };
  const away = (e) => { if (pop && !pop.contains(e.target) && !button.contains(e.target)) close(false); };
  const choose = (id, e) => { close(); if (id !== o.value || (e && (e.ctrlKey || e.metaKey))) o.onPick(id, e); };
  function open() {
    if (pop) return close();
    const input = el("input", { type: "search", class: "pick-search", placeholder: "Chercher…", "aria-label": `Chercher — ${o.label}`, "aria-controls": `${uid}-list`, autocomplete: "off" }), list = el("div", { class: "pick-list", role: "listbox", id: `${uid}-list`, "aria-label": o.label }), count = el("small", { class: "muted pick-count" });
    const draw = () => {
      const groups = filterGroups(o.groups, input.value); shown = groups.flatMap((g) => g.items); if (active >= shown.length) active = shown.length - 1; if (active < 0 && shown.length) active = Math.max(0, shown.findIndex((it) => it.id === o.value));
      list.replaceChildren(...(groups.length ? groups.flatMap((g) => [el("div", { class: "pick-group", role: "presentation", style: { "--pick": g.color || "var(--graphite)" } }, el("i"), g.label, el("small", null, String(g.items.length))),
        ...g.items.map((it) => { const k = shown.indexOf(it); return el("div", { class: `pick-opt${k === active ? " on" : ""}${it.id === o.value ? " cur" : ""}`, role: "option", id: `${uid}-o${k}`, "aria-selected": it.id === o.value ? "true" : "false", "data-id": it.id, onClick: (e) => choose(it.id, e), onPointermove: () => { if (active !== k) { active = k; draw(); } } },
          icon(it.icon || "part"), el("span", { class: "grow pick-title" }, el("b", null, it.title), it.sub ? el("small", null, it.sub) : null), it.dot ? el("i", { class: "pick-dot", style: { background: it.dot } }) : null, o.extra ? o.extra(it, close) : null); })]) : [el("p", { class: "muted small", style: { margin: ".4rem .5rem" } }, "Rien ne correspond.")]));
      count.textContent = shown.length === all().length ? `${shown.length}` : `${shown.length} sur ${all().length}`; input.setAttribute("aria-activedescendant", active >= 0 ? `${uid}-o${active}` : "");
      const on = list.querySelector(".pick-opt.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    };
    input.addEventListener("input", () => { active = input.value ? 0 : -1; draw(); });
    input.addEventListener("keydown", (e) => { const n = shown.length;
      if (e.key === "ArrowDown") { e.preventDefault(); active = n ? (active + 1) % n : -1; draw(); } else if (e.key === "ArrowUp") { e.preventDefault(); active = n ? (active - 1 + n) % n : -1; draw(); }
      else if (e.key === "Home") { e.preventDefault(); active = n ? 0 : -1; draw(); } else if (e.key === "End") { e.preventDefault(); active = n - 1; draw(); }
      else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active].id, e); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === "Tab") close(false); });
    const foot = o.foot ? o.foot(close) : null;
    pop = el("div", { class: "pick-pop" }, el("div", { class: "pick-head" }, icon("search"), input, count), list, foot ? el("div", { class: "pick-foot" }, foot) : null); document.body.append(pop);
    const r = button.getBoundingClientRect(), w = Math.max(r.width, o.width || 300); pop.style.width = `${Math.min(w, window.innerWidth - 12)}px`; pop.style.left = `${Math.max(6, Math.min(r.left, window.innerWidth - w - 6))}px`; pop.style.top = `${r.bottom + 4}px`; pop.style.maxHeight = `${Math.max(180, window.innerHeight - r.bottom - 16)}px`;
    button.setAttribute("aria-expanded", "true"); active = -1; draw(); input.focus(); setTimeout(() => document.addEventListener("pointerdown", away, true), 0);
  }
  button.addEventListener("click", open);
  button.addEventListener("keydown", (e) => { if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !pop) { e.preventDefault(); open(); } });
  return button;
}
