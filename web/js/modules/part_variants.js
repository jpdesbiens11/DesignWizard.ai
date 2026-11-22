/* DesignOrbit.ai — the variants of a part, and of an assembly, in the left panel. A family that differs a little is kept in one
   document : the state it is in — for a part, which operations are made and what its parameters are worth ; for an assembly, which
   parts are on — is kept under a name, and a click on a name brings the whole cousin back, in one step that Ctrl + Z undoes.
   Each variant has its drawing, without changing the document (the sheet says which variant it shows).
   ONE variant is in use and it is ALIVE — what one changes in the tree belongs to it ; the first « + » keeps the original under « Origine ».
   The models are core/variants.js and core/asm_live.js ; this module draws them — one group, the same for both. */

import { el, btn, icon, field, toast, promptBox } from "../core/dom.js";
import { store } from "../core/store.js";
import { variantNow, newVariant, useVariant, dropVariant, variantDiff, keptAside, ORIGIN } from "../core/variants.js";
import { asmVariantNow, applyAsmVariant, newAsmVariant, dropAsmVariant, asmVariantDiff, offOf, ASM_ORIGIN } from "../core/asm_live.js";
import { namedVariant, partOut, asmOut, outChoices } from "../core/variant_out.js";

const COLOR = "#0ea5a4";      // the colour of the variants, in the tree and on their mark

/** The mark of the variant in use, beside the title of what it owns — the tree, the parameters : whose they are is said where one changes them. */
export function variantChip(name, what = "L'arbre") {
  return name ? el("span", { class: "variant-chip", "data-variant-on": name, "data-tip": `${what} montre la variante « ${name} » : ce que vous y changez lui appartient. Les autres variantes restent telles que vous les avez laissées.` }, mark(true), el("span", null, name)) : null;
}
/** The group « Variantes ». ONE variant is in use, and it is alive : what one changes belongs to it (core/variants.js). A click on another brings it
    in ; « + » makes a new one, a copy of the one in use — the first « + » also keeps the original, under « Origine ».
    o : { list, now (the name of the variant in use, or null), diff(v) → [words], add(name), apply(v), drop(name), drawing(v) → href,
    origin (the name of the original), the (« la pièce »), The (« La pièce »), owns (what belongs to a variant, in words), hint } */
export function variantPanel(o) {
  const list = o.list, first = !list.length;
  const add = async () => {
    const n = await promptBox("Nouvelle variante", "Nom", `Variante ${Math.max(1, list.length)}`, `Une copie de ${o.the} telle qu'elle est en ce moment. Elle devient la variante en cours : ${o.owns} lui appartiendront.${first ? ` L'état d'aujourd'hui est aussi gardé sous le nom « ${o.origin} », pour y revenir d'un clic.` : ""}`);
    if (!n || !n.trim()) return; if (list.some((v) => v.name === n.trim())) { toast(`Une variante s'appelle déjà « ${n.trim()} ».`, "error", 4200); return; }
    o.add(n.trim()); toast(`Variante « ${n.trim()} » : c'est elle qui est en cours.${first ? ` « ${o.origin} » garde ${o.the} d'avant.` : ""}`, "success", 4200);
  };
  const sec = el("div", { class: "side-section", "data-box": "variants", "data-fold-note": list.length ? `${list.length} · ${o.now ? `en cours : ${o.now}` : "état sans nom"}` : "aucune" },
    el("h3", null, el("span", { class: "grow" }, `Variantes (${list.length})`), (() => { const b = btn("", () => add(), { small: true, icon: "plus", tip: first ? `Faire une variante de ${o.the} : une copie, sous un nom — l'original reste, sous « ${o.origin} »` : "Nouvelle variante : une copie de celle qui est en cours" }); b.dataset.variantAdd = ""; return b; })()));
  for (const v of list) {
    const on = v.name === o.now, diff = on ? [] : o.diff(v), base = v.name === o.origin;
    sec.append(el("div", { class: "nav-item variant" + (on ? " active" : ""), role: "button", tabindex: "0", "data-variant": v.name, "aria-current": on ? "true" : null, "data-tip": on ? `${v.name} — la variante en cours : ${o.owns} sont les siens` : `${v.name} — passer à cette variante : ${diff.join(" · ") || "rien ne change"}`,
      onClick: () => { if (on) return; o.apply(v); toast(`Variante « ${v.name} » en cours. Ctrl + Z pour revenir.`, "success", 3200); },
      onKeydown: (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.currentTarget.click(); } } },
      mark(on), el("span", { class: "grow bc-text" }, el("span", null, v.name), el("small", null, on ? "en cours" : diff.slice(0, 3).join(" · ") || "comme la variante en cours")),
      el("a", { class: "icon-btn", href: o.drawing(v), "aria-label": `Dessin de la variante ${v.name}`, "data-tip": `Le dessin de cette variante — sans changer ${o.the}`, style: { fontSize: ".95rem" }, onClick: (e) => e.stopPropagation() }, icon("drawing")),
      el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la variante ${v.name}`, "data-tip": base ? `Retirer « ${v.name} » — ${o.the} ne change pas, mais l'original n'aura plus de nom` : `Retirer ce nom — ${o.the} ne change pas`, onClick: (e) => { e.stopPropagation(); o.drop(v.name); } }, "×")));
  }
  sec.append(el("p", { class: "muted small", "data-variant-hint": "" }, o.hint));
  return sec;
}

/** The variants of a part. o : { spec (the part), id } → the section */
export function variantsSection(o) {
  const s = o.spec, list = s.variants || [], now = variantNow(s), aside = keptAside(s);
  const labels = Object.fromEntries(Object.entries(s.params || {}).map(([k, raw]) => [k, (raw && typeof raw === "object" && raw.label) || k]));
  return variantPanel({ list, now, origin: ORIGIN, the: "la pièce", The: "La pièce", owns: "les opérations que vous mettrez à On ou à Off et les valeurs des paramètres que vous changerez",
    diff: (v) => variantDiff(s, v, labels), drawing: (v) => `#/drawings/${encodeURIComponent(o.id)}/${encodeURIComponent(v.name)}`,
    add: (n) => store.updatePart(o.id, (x) => { const r = newVariant(x, n); if (r) { x.variants = r.variants; x.variantOn = r.variantOn; } }, `${s.id} : nouvelle variante « ${n} »`),
    apply: (v) => store.updatePart(o.id, (x) => { const r = useVariant(x, v); x.features = r.features; x.params = r.params; x.variantOn = r.variantOn; }, `${s.id} : variante « ${v.name} »`),
    drop: (name) => store.updatePart(o.id, (x) => { x.variants = dropVariant(x, name); if (!x.variants.length) delete x.variants; if (x.variantOn === name) delete x.variantOn; }, `${s.id} : variante « ${name} » retirée`),
    hint: list.length
      ? `${now ? `L'arbre ci-dessus et les paramètres (volet de droite) sont ceux de « ${now} » : une opération mise à On ou à Off, une valeur changée lui appartient, sans rien faire de plus. Un clic sur une autre variante la montre à sa place — « ${ORIGIN} » est la pièce d'avant les variantes.` : "La pièce est dans un état qui n'a pas de nom : le « + » le garde comme une nouvelle variante."} Les cotes d'une opération valent pour toutes les variantes : pour qu'une cote diffère, écrivez-la avec un paramètre.`
      : `Une famille de pièces un peu différentes tient dans une seule pièce. Le « + » fait une variante : une copie sous un nom, où vous mettez des opérations à Off et changez des valeurs de paramètres — l'original reste, sous « ${ORIGIN} »${aside.features || aside.values ? ` (${aside.features} opération${aside.features > 1 ? "s" : ""} à Off, ${aside.values} valeur${aside.values > 1 ? "s" : ""} gardée${aside.values > 1 ? "s" : ""} en ce moment)` : ""}.` });
}

/** The variants of an assembly : which of its parts are on. o : { asm, id, names (instance id → what to call it) } → the section */
export function asmVariantsSection(o) {
  const a = o.asm, list = a.variants || [], now = asmVariantNow(a), off = offOf(a).instances.length;
  return variantPanel({ list, now, origin: ASM_ORIGIN, the: "l'assemblage", The: "L'assemblage", owns: "les pièces que vous mettrez à On ou à Off",
    diff: (v) => asmVariantDiff(a, v, o.names || {}), drawing: (v) => `#/drawings/asm/${encodeURIComponent(o.id)}/${encodeURIComponent(v.name)}`,
    add: (n) => store.updateAssembly(o.id, (x) => { const r = newAsmVariant(x, n); if (r) { x.variants = r.variants; x.variantOn = r.variantOn; } }, `${a.id} : nouvelle variante « ${n} »`),
    apply: (v) => store.updateAssembly(o.id, (x) => { applyAsmVariant(x, v); x.variantOn = v.name; }, `${a.id} : variante « ${v.name} »`),
    drop: (name) => store.updateAssembly(o.id, (x) => { x.variants = dropAsmVariant(x, name); if (!x.variants.length) delete x.variants; if (x.variantOn === name) delete x.variantOn; }, `${a.id} : variante « ${name} » retirée`),
    hint: list.length
      ? `${now ? `La liste des pièces ci-dessus est celle de « ${now} » : une pièce mise à On ou à Off lui appartient, sans rien faire de plus. Un clic sur une autre variante la montre à sa place — « ${ASM_ORIGIN} » est l'assemblage d'avant les variantes.` : "L'assemblage est dans un état qui n'a pas de nom : le « + » le garde comme une nouvelle variante."} Une pièce ajoutée plus tard vaut pour toutes. La variante de chaque pièce n'en fait pas partie : elle se choisit dans la pièce.`
      : `Plusieurs versions d'un produit tiennent dans un seul assemblage. Le « + » fait une variante : une copie sous un nom, où vous mettez des pièces à Off — l'original reste, sous « ${ASM_ORIGIN} »${off ? ` (${off} pièce${off > 1 ? "s" : ""} à Off en ce moment)` : ""}.` });
}
/** The menu « Variante qui sort » : which cousin a file, an order or a send is made for — from a copy, the document is not changed.
    The same on every screen that lets something out. o : { doc, isAsm, value (the name chosen, or ""), onPick(name),
    what (« La commande et les fichiers »), are (« sont ceux », « est celui ») } → a node, or null when the document keeps no variant */
export function outPicker(o) {
  const list = (o.doc && o.doc.variants) || []; if (!list.length) return null;
  const out = (o.isAsm ? asmOut : partOut)(o.doc, o.value), the = o.isAsm ? "l'assemblage n'est pas changé" : "la pièce n'est pas changée", value = namedVariant(o.doc, o.value) ? o.value : "";
  const sel = el("select", { "aria-label": "Variante qui sort", "data-field": "out", onChange: (e) => o.onPick(e.target.value) }, outChoices(o.doc, o.isAsm).map((c) => el("option", { value: c.value, selected: c.value === value }, c.label)));
  const hint = out.copy ? `${o.what} ${o.are || "sont ceux"} de la variante « ${out.variant} » ; ${the}.`
    : out.variant ? `${o.what} ${o.are || "sont ceux"} de la variante « ${out.variant} », et le disent dans leur nom.`
      : `L'état en ce moment n'a pas de nom : rien de ce qui sort n'en portera. Choisissez une variante, ou gardez cet état sous un nom.`;
  return el("div", { class: "out-variant" + (out.copy ? " other" : ""), "data-out": out.variant || "" }, mark(!out.copy), field("Variante qui sort", sel, hint));
}
/* the mark of a variant : the part and its cousin, the one in use filled */
function mark(on) {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "20"); s.setAttribute("height", "20"); s.setAttribute("aria-hidden", "true"); s.style.flex = "none";
  for (const [x, y, fill] of [[3, 8, on ? COLOR : "none"], [10, 3, "none"]]) { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "11"); r.setAttribute("height", "11"); r.setAttribute("rx", "2"); r.setAttribute("fill", fill); r.setAttribute("fill-opacity", ".35"); r.setAttribute("stroke", COLOR); r.setAttribute("stroke-width", "1.7"); s.append(r); }
  return s;
}
