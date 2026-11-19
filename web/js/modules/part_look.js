/* DesignWizard.ai — the look of a part, picked by its designer : a round swatch beside each part, and a picker that opens on it —
   a row per colour, a column per shade, lighter / darker, a pattern (the camouflage sets), a sheen (matte … metallic), see-through
   or not, any other colour, or back to what it showed before. Each choice is one undoable step ; the picker stays open to try
   another. ONE picker for three things (demande de JP : « part & assembly defined and visible ») :
     a part       — its look, worn by every instance of it ;
     an instance  — the look of this part, or of this whole sub-assembly, in THIS assembly : it wins over the look of the part ;
     an assembly  — every instance of it at once.
   Words, colours and the rule of who wins : core/part_look.js ; patterns and sheens : core/look_patterns.js. */

import { el, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { materialOrDefault } from "../cad/materials.js";
import { palette, SHADES, OPACITIES, lookOf, shownLook, setLook, overLook, hasLook, lookWords, lighter, darker, colorName, luminance, validHex, autoLooks } from "../core/part_look.js";
import { PATTERNS, SHEENS, DEFAULT_SHEEN, patternGroups, validPattern } from "../core/look_patterns.js";
import { patternUrl } from "../core/look_paint.js";

const shown = (spec) => { const m = materialOrDefault(spec.material); return { ...shownLook(spec, m.color, m.opacity), material: m }; };
/* how a swatch is filled : the tile of its pattern, or its colour */
const fill = (s) => (validPattern(s.pattern) ? { backgroundImage: `url(${patternUrl(s.pattern, 48)})`, backgroundSize: "cover", backgroundColor: PATTERNS[s.pattern].colors[0] } : { background: s.color });
const said = (s) => (s.pattern ? `Camouflage ${PATTERNS[s.pattern].label}` : colorName(s.color));

/* ---------- what a picker paints ---------- */
/* each : holder() → the thing that carries the look (null : gone) ; title, base(holder) → what it shows when it says nothing { color, opacity, pattern, sheen, words } ;
   paint(patch, label) ; label of the dialog, of the way back, and the note under it */
const partTarget = (id) => ({ kind: "part", holder: () => store.part(id), title: (p) => p.name || p.id, dialog: "Apparence de la pièce",
  base: (p) => { const m = materialOrDefault(p.material); return { color: m.color, opacity: m.opacity ?? 1, pattern: null, sheen: DEFAULT_SHEEN, words: `couleur de la matière — ${m.name}` }; },
  paint: (patch, label) => store.updatePart(id, (x) => { setLook(x, patch); }, `${id} : ${label}`), back: (b) => `Revenir à la ${b.words.split(" — ")[0]} (${b.words.split(" — ")[1]})`,
  note: "Une aide pour reconnaître la pièce à l'écran, dans son studio et dans tous les assemblages qui l'emploient. Ce n'est pas une finition : elle ne va sur aucun dessin et ne touche ni à la revue ni à la révision." });
const instOf = (asmId, instId) => { const a = store.assembly(asmId); return a ? (a.instances || []).find((i) => i.id === instId) || null : null; };
const instTarget = (asmId, instId) => ({ kind: "inst", holder: () => instOf(asmId, instId), dialog: "Apparence dans cet assemblage",
  title: (i) => { const d = i.asm ? store.assembly(i.asm) : store.part(i.part); return `${(d && d.name) || i.asm || i.part} — ici`; },
  base: (i) => { const p = i.part ? store.part(i.part) : null; if (!p) return { color: "#b9c6ce", opacity: 1, pattern: null, sheen: DEFAULT_SHEEN, words: "l'apparence de chacune de ses pièces" };
    const s = shown(p); return { color: s.color, opacity: s.opacity, pattern: s.pattern, sheen: s.sheen, words: `comme la pièce — ${said(s)}` }; },
  paint: (patch, label) => store.updateAssembly(asmId, (a) => { const i = (a.instances || []).find((q) => q.id === instId); if (i) setLook(i, patch); }, `${asmId} : ${instId} — ${label}, ici`),
  back: (b, i) => (i.asm ? "Revenir à l'apparence de ses pièces" : "Revenir à l'apparence de la pièce"),
  note: "Ce que l'assemblage dit ici l'emporte sur l'apparence de la pièce, dans cet assemblage seulement — et dans ceux qui le contiennent. Un sous-assemblage s'habille d'un seul bloc. Rien ne va sur un dessin." });
/* every instance of an assembly at once : what they all share is what the picker shows */
const common = (a) => { const all = (a.instances || []).map((i) => lookOf(i)), same = (k) => (all.length && all.every((l) => l[k] === all[0][k]) ? all[0][k] : null); return { color: same("color"), opacity: same("opacity"), pattern: same("pattern"), sheen: same("sheen") }; };
const asmTarget = (asmId) => ({ kind: "all", holder: () => { const a = store.assembly(asmId); return a ? { id: a.id, name: a.name, look: common(a), n: (a.instances || []).length } : null; }, dialog: "Apparence de tout l'assemblage",
  title: (h) => `${h.name || h.id} — ses ${h.n} élément${h.n > 1 ? "s" : ""}`, base: () => ({ color: "#b9c6ce", opacity: 1, pattern: null, sheen: DEFAULT_SHEEN, words: "chaque pièce garde la sienne" }),
  paint: (patch, label) => store.updateAssembly(asmId, (a) => { for (const i of a.instances || []) setLook(i, patch); }, `${asmId} : ${label}, sur tout l'assemblage`), back: () => "Revenir à l'apparence de chaque pièce",
  note: "Habille d'un coup chaque élément de cet assemblage — pièces et sous-assemblages. Chacun peut ensuite être repris seul, par sa fiche ou son menu." });

/** The swatch of a part : its colour or its pattern, dashed when it is only the colour of its material. A click opens the picker. */
export function lookSwatch(spec, o = {}) {
  const s = shown(spec), tip = s.own ? `Apparence de ${spec.id} : ${lookWords(lookOf(spec)) || said(s)} — cliquer pour la changer` : `${spec.id} a la couleur de sa matière — cliquer pour lui donner la sienne`;
  return el("button", { class: `look-dot${s.own ? " own" : ""}${o.big ? " big" : ""}`, type: "button", "data-look": spec.id, "data-pattern": s.pattern || null, "aria-label": tip, "data-tip": tip, style: { ...fill(s), opacity: String(Math.max(0.45, s.opacity)) },
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); openLookPicker(spec.id, e.currentTarget); } });
}
/** The swatch of an instance in an assembly : what it shows HERE — solid when the assembly says so, dashed when it follows its part. */
export function instSwatch(asmId, inst, o = {}) {
  const T = instTarget(asmId, inst.id), b = T.base(inst), own = lookOf(inst), s = { ...overLook(b, own), own: hasLook(own) }, what = lookWords(own) || said(s);
  const tip = s.own ? `Ici : ${what} — l'assemblage l'emporte sur la pièce. Cliquer pour changer.` : `Ici : ${b.words}. Cliquer pour lui donner une apparence propre à cet assemblage.`;
  return el("button", { class: `look-dot${s.own ? " own" : ""}${o.big ? " big" : ""}`, type: "button", "data-look-inst": inst.id, "data-pattern": s.pattern || null, "aria-label": tip, "data-tip": tip, style: { ...fill({ color: s.color || b.color, pattern: s.pattern }), opacity: String(Math.max(0.45, s.opacity ?? 1)) },
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); openPicker(T, e.currentTarget); } });
}
export const openLookPicker = (id, anchor) => openPicker(partTarget(id), anchor);
export const openInstLookPicker = (asmId, instId, anchor) => openPicker(instTarget(asmId, instId), anchor);
export const openAsmLookPicker = (asmId, anchor) => openPicker(asmTarget(asmId), anchor);

/* The picker, next to the node that opened it. It reads what it paints again after each choice. */
function openPicker(T, anchor) {
  document.querySelectorAll(".look-pop").forEach((n) => n.remove());
  const pop = el("div", { class: "look-pop", role: "dialog", "aria-label": T.dialog, "data-look-kind": T.kind });
  const close = () => { pop.remove(); document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key, true); };
  const away = (ev) => { if (!pop.contains(ev.target)) close(); }, key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } };
  const set = (patch, label) => { if (!T.holder()) return close(); T.paint(patch, label); draw(); };
  function draw() {
    const h = T.holder(); if (!h) return close();
    const own = lookOf(h), b = T.base(h), s = { ...overLook(b, own) }, cur = own.pattern ? null : own.color, sheen = own.sheen || (own.pattern || own.color || T.kind !== "inst" ? DEFAULT_SHEEN : b.sheen);
    const cell = (c) => el("button", { class: `look-cell${c.hex === cur ? " on" : ""}`, type: "button", "data-color": c.hex, "aria-label": c.label, "data-tip": c.label, "aria-pressed": c.hex === cur ? "true" : "false", style: { background: c.hex, color: luminance(c.hex) > 0.6 ? "#16283c" : "#fff" },
      onClick: () => set({ color: c.hex }, `couleur ${c.label.toLowerCase()}`) }, c.hex === cur ? "✓" : "");
    const custom = el("input", { type: "color", value: s.color || b.color, "aria-label": "Une autre couleur", "data-tip": "Une autre couleur, au choix", onChange: (e) => set({ color: validHex(e.target.value) }, "couleur au choix") });
    /* the patterns, by group : each a tile of itself and a short name under it */
    const pat = (id, P) => { const on = own.pattern === id; return el("button", { class: `look-pat${on ? " on" : ""}`, type: "button", "data-pattern": id, "aria-pressed": on ? "true" : "false", "aria-label": `Camouflage ${P.label} (${P.fr})`, "data-tip": `${P.label} — ${P.text}`, onClick: () => set({ pattern: on ? null : id }, on ? "sans motif" : `camouflage ${P.label}`) },
      el("span", { class: "look-tile", style: { backgroundImage: `url(${patternUrl(id, 64)})` } }), el("small", null, P.label)); };
    const plain = el("button", { class: `look-pat${own.pattern ? "" : " on"}`, type: "button", "data-pattern": "", "aria-pressed": own.pattern ? "false" : "true", "aria-label": "Uni : une couleur, sans motif", "data-tip": "Uni — une couleur, sans motif", onClick: () => set({ pattern: null }, "sans motif") },
      el("span", { class: "look-tile plain", style: { background: s.color || b.color } }), el("small", null, "Uni"));
    pop.replaceChildren(
      el("div", { class: "look-head" }, el("span", { class: "look-dot big own", style: { ...fill({ color: s.color || b.color, pattern: s.pattern }), opacity: String(Math.max(0.45, s.opacity ?? 1)) } }), el("div", { class: "grow" }, el("b", null, T.title(h)), el("small", null, hasLook(own) ? lookWords(own) || said(s) : b.words)),
        el("button", { class: "icon-btn", type: "button", "aria-label": "Fermer", onClick: close }, icon("close"))),
      el("div", { class: "look-grid", role: "group", "aria-label": "Couleurs et teintes" }, el("span"), SHADES.map((x) => el("small", { class: "look-col" }, x.fr)),
        palette().map((row) => [el("small", { class: "look-row" }, row.fr), row.cells.map(cell)])),
      el("div", { class: "look-tools" }, el("button", { class: "chip-btn", type: "button", "data-shade": "lighter", "data-tip": "La même couleur, un cran plus clair", onClick: () => set({ color: lighter(s.color || b.color) }, "teinte plus claire") }, "☀ Plus clair"),
        el("button", { class: "chip-btn", type: "button", "data-shade": "darker", "data-tip": "La même couleur, un cran plus foncé", onClick: () => set({ color: darker(s.color || b.color) }, "teinte plus foncée") }, "☾ Plus foncé"),
        el("label", { class: "look-custom" }, custom, el("span", null, "Autre…"))),
      ...patternGroups().map((g) => el("div", { class: "look-patterns", role: "group", "aria-label": `Motifs — ${g.label}`, style: { "--g": g.color } }, el("b", { class: "look-group" }, g.label), el("div", { class: "look-pats" }, plain, g.items.map((P) => pat(P.id, P))))),
      el("div", { class: "look-tools", role: "group", "aria-label": "Finition à l'écran" }, el("small", { class: "look-row" }, "Finition"), Object.entries(SHEENS).map(([id, S]) => { const on = sheen === id;
        return el("button", { class: `chip-btn look-sheen ${id}${on ? " on" : ""}`, type: "button", "data-sheen": id, "aria-pressed": on ? "true" : "false", "data-tip": `${S.label} — ${S.text}`, onClick: () => set({ sheen: id }, `finition ${S.fr.toLowerCase()}`) }, el("i"), S.fr); })),
      el("div", { class: "look-tools", role: "group", "aria-label": "Transparence" }, OPACITIES.map((o) => { const on = Math.abs((own.opacity ?? 1) - o.v) < 0.05;
        return el("button", { class: `chip-btn${on ? " on" : ""}`, type: "button", "data-opacity": String(o.v), "aria-pressed": on ? "true" : "false", "data-tip": o.v < 1 ? "Voir à travers la pièce : ce qu'elle cache apparaît" : "La pièce cache ce qui est derrière elle", onClick: () => set({ opacity: o.v }, o.fr.toLowerCase()) }, o.fr); })),
      el("button", { class: "menu-item", type: "button", "data-look-reset": "1", disabled: !hasLook(own), onClick: () => set({ color: null, opacity: null, pattern: null, sheen: null }, T.kind === "part" ? "couleur de la matière" : "apparence de la pièce") }, icon("undo"), el("span", { class: "grow" }, T.back(b, h))),
      el("p", { class: "muted small look-note" }, T.note));
  }
  draw(); document.body.append(pop);
  const a = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { right: 80, top: 80, bottom: 100 }, r = pop.getBoundingClientRect();
  pop.style.left = `${Math.max(6, Math.min(a.right + 8, window.innerWidth - r.width - 8))}px`; pop.style.top = `${Math.max(6, Math.min(a.top - 8, window.innerHeight - r.height - 8))}px`;
  setTimeout(() => { document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", key, true); }, 0);
  return close;
}

/** Two shortcuts over the list of parts : a colour of its own for every part that has none, and back to the materials. */
export function lookTools(parts) {
  const some = parts.some((p) => hasLook(lookOf(p))), all = parts.length > 0 && parts.every((p) => lookOf(p).color || lookOf(p).pattern);
  return el("span", { class: "look-all" },
    el("button", { class: "icon-btn", type: "button", disabled: all || !parts.length, "data-look-auto": "1", "aria-label": "Une couleur par pièce", "data-tip": "Une couleur par pièce : chaque pièce qui n'en a pas reçoit la sienne, différente de ses voisines. Celles que vous avez choisies restent.",
      onClick: () => store.commit("Une couleur par pièce", (p) => { for (const [id, hex] of autoLooks(p.parts || [])) { const x = (p.parts || []).find((q) => q.id === id); if (x) setLook(x, { color: hex }); } }) }, icon("palette")),
    el("button", { class: "icon-btn", type: "button", disabled: !some, "data-look-clear": "1", "aria-label": "Couleurs des matières", "data-tip": "Toutes les pièces reprennent la couleur de leur matière",
      onClick: () => store.commit("Couleurs des matières", (p) => { for (const x of p.parts || []) delete x.look; }) }, icon("undo")));
}
/** The same over an assembly : dress every element of it at once, or give each one back the look of its part. o : { asm, id } */
export function asmLookTools(o) {
  const some = (o.asm.instances || []).some((i) => hasLook(lookOf(i)));
  return el("span", { class: "look-all" },
    el("button", { class: "icon-btn", type: "button", "data-look-asm": "1", "aria-label": "Apparence de tout l'assemblage", "data-tip": "Habiller tout l'assemblage d'un coup : une couleur, un camouflage, une finition — chaque élément le porte ici", onClick: (e) => { e.stopPropagation(); openAsmLookPicker(o.id, e.currentTarget); } }, icon("palette")),
    el("button", { class: "icon-btn", type: "button", disabled: !some, "data-look-asm-clear": "1", "aria-label": "Apparence des pièces", "data-tip": "Chaque élément reprend l'apparence de sa pièce : ce que l'assemblage disait ici est retiré",
      onClick: (e) => { e.stopPropagation(); store.updateAssembly(o.id, (a) => { for (const i of a.instances || []) delete i.look; }, `${o.id} : apparence des pièces`); } }, icon("undo")));
}
/** The group « Apparence » of the card of an instance : what it shows HERE (the assembly wins), and — for a part — what the part
    shows wherever it is used. Each swatch opens its picker. */
export function instLookSection(asmId, inst) {
  const own = lookOf(inst), T = instTarget(asmId, inst.id), b = T.base(inst), p = inst.part ? store.part(inst.part) : null, mine = hasLook(own);
  return el("div", { class: "side-section", "data-fold-note": mine ? `ici : ${lookWords(own)}` : "comme la pièce" }, el("h3", null, "Apparence"),
    el("div", { class: "look-line", "data-look-here": mine ? "own" : "part" }, instSwatch(asmId, inst, { big: true }), el("span", { class: "grow" }, el("b", null, "Ici : "), mine ? lookWords(own) : b.words),
      mine ? el("button", { class: "icon-btn", type: "button", "aria-label": T.back(b, inst), "data-tip": T.back(b, inst), onClick: () => T.paint({ color: null, opacity: null, pattern: null, sheen: null }, "apparence de la pièce") }, icon("undo")) : null),
    p ? el("div", { class: "look-line" }, lookSwatch(p, { big: true }), el("span", { class: "grow" }, el("b", null, "La pièce : "), hasLook(lookOf(p)) ? lookWords(lookOf(p)) : "la couleur de sa matière")) : null,
    el("p", { class: "muted small", style: { margin: ".35rem 0 0" } }, p ? "L'apparence donnée ici l'emporte sur celle de la pièce, dans cet assemblage ; celle de la pièce vaut partout où elle sert."
      : "Un sous-assemblage s'habille d'un seul bloc : ce qui est donné ici couvre l'apparence de chacune de ses pièces."));
}
