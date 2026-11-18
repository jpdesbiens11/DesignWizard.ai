/* DesignWizard.ai — the variants of a part, and of an assembly, in the left panel. A family that differs a little is kept in one
   document : the state it is in — for a part, which operations are made and what its parameters are worth ; for an assembly, which
   parts are on — is kept under a name, and a click on a name brings the whole cousin back, in one step that Ctrl + Z undoes.
   Each variant has its drawing, without changing the document (the sheet says which variant it shows).
   The models are core/variants.js and core/asm_live.js ; this module draws them — one group, the same for both. */

import { el, btn, icon, toast, promptBox, confirmBox } from "../core/dom.js";
import { store } from "../core/store.js";
import { variantNow, isVariant, applyVariant, keepVariant, dropVariant, variantDiff, keptAside } from "../core/variants.js";
import { asmVariantNow, isAsmVariant, applyAsmVariant, keepAsmVariant, dropAsmVariant, asmVariantDiff, offOf } from "../core/asm_live.js";

const COLOR = "#0ea5a4";      // the colour of the variants, in the tree and on their mark

/** The group « Variantes ». o : { list, now (the name of the variant in use, or null), isOn(v), diff(v) → [words], keep(name), apply(v),
    drop(name), drawing(v) → href, the (« la pièce »), The (« La pièce »), kept (what a variant remembers, for the prompt), tip, hint } */
export function variantPanel(o) {
  const list = o.list;
  const keep = async (name) => {
    const n = name || await promptBox("Garder cette variante", "Nom", `Variante ${list.length + 1}`, `L'état de ${o.the} en ce moment — ${o.kept} — est gardé sous ce nom.`);
    if (!n) return; const exists = list.some((v) => v.name === n.trim());
    if (exists && !name && !(await confirmBox("Ce nom existe déjà", `Remplacer la variante « ${n.trim()} » par l'état de ${o.the} en ce moment ?`, "Remplacer"))) return;
    o.keep(n.trim()); toast(`Variante « ${n.trim()} » gardée.`, "success", 2600);
  };
  const sec = el("div", { class: "side-section", "data-fold-note": list.length ? `${list.length} · ${o.now ? `en cours : ${o.now}` : "état sans nom"}` : "aucune" },
    el("h3", null, el("span", { class: "grow" }, `Variantes (${list.length})`), btn("", () => keep(), { small: true, icon: "plus", tip: o.tip })));
  for (const v of list) {
    const on = o.isOn(v), diff = on ? [] : o.diff(v);
    sec.append(el("div", { class: "nav-item variant" + (on ? " active" : ""), role: "button", tabindex: "0", "data-variant": v.name, "aria-current": on ? "true" : null, "data-tip": on ? `${v.name} — ${o.the} est dans cette variante` : `${v.name} — passer à cette variante : ${diff.join(" · ") || "rien ne change"}`,
      onClick: () => { if (on) return; o.apply(v); toast(`${o.The} est passée à la variante « ${v.name} ». Ctrl + Z pour revenir.`.replace("L'assemblage est passée", "L'assemblage est passé"), "success", 3200); },
      onKeydown: (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.currentTarget.click(); } } },
      mark(on), el("span", { class: "grow bc-text" }, el("span", null, v.name), el("small", null, on ? "en cours" : diff.slice(0, 3).join(" · ") || `comme ${o.the}`)),
      el("a", { class: "icon-btn", href: o.drawing(v), "aria-label": `Dessin de la variante ${v.name}`, "data-tip": `Le dessin de cette variante — sans changer ${o.the}`, style: { fontSize: ".95rem" }, onClick: (e) => e.stopPropagation() }, icon("drawing")),
      el("button", { class: "icon-btn", type: "button", "aria-label": `Mettre à jour la variante ${v.name}`, "data-tip": `Remplacer cette variante par l'état de ${o.the} en ce moment`, style: { fontSize: ".95rem" }, onClick: (e) => { e.stopPropagation(); keep(v.name); } }, icon("refresh")),
      el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la variante ${v.name}`, "data-tip": `Retirer ce nom — ${o.the} ne change pas`, onClick: (e) => { e.stopPropagation(); o.drop(v.name); } }, "×")));
  }
  sec.append(el("p", { class: "muted small" }, o.hint));
  return sec;
}

/** The variants of a part. o : { spec (the part), id } → the section */
export function variantsSection(o) {
  const s = o.spec, list = s.variants || [], now = variantNow(s), aside = keptAside(s);
  const labels = Object.fromEntries(Object.entries(s.params || {}).map(([k, raw]) => [k, (raw && typeof raw === "object" && raw.label) || k]));
  return variantPanel({ list, now, the: "la pièce", The: "La pièce", kept: "opérations à On ou à Off, valeurs des paramètres", tip: "Garder l'état de la pièce en ce moment sous un nom — pour y revenir d'un clic",
    isOn: (v) => isVariant(s, v), diff: (v) => variantDiff(s, v, labels), drawing: (v) => `#/drawings/${encodeURIComponent(o.id)}/${encodeURIComponent(v.name)}`,
    keep: (n) => store.updatePart(o.id, (x) => { x.variants = keepVariant(x, n); }, `${s.id} : variante « ${n} » gardée`),
    apply: (v) => store.updatePart(o.id, (x) => { const r = applyVariant(x, v); x.features = r.features; x.params = r.params; }, `${s.id} : variante « ${v.name} »`),
    drop: (name) => store.updatePart(o.id, (x) => { x.variants = dropVariant(x, name); if (!x.variants.length) delete x.variants; }, `${s.id} : variante « ${name} » retirée`),
    hint: list.length
      ? `${now ? "" : "La pièce est dans un état sans nom : le « + » le garde. "}Une variante retient ce qui est à On et à Off dans l'arbre et la valeur de chaque paramètre ; une opération ou un paramètre ajouté plus tard vaut pour toutes.`
      : `Une famille de pièces un peu différentes tient dans une seule pièce : mettez des opérations à Off, changez des valeurs, puis gardez cet état sous un nom avec le « + »${aside.features || aside.values ? ` (${aside.features} opération${aside.features > 1 ? "s" : ""} à Off, ${aside.values} valeur${aside.values > 1 ? "s" : ""} gardée${aside.values > 1 ? "s" : ""} en ce moment)` : ""}.` });
}

/** The variants of an assembly : which of its parts are on. o : { asm, id, names (instance id → what to call it) } → the section */
export function asmVariantsSection(o) {
  const a = o.asm, list = a.variants || [], now = asmVariantNow(a), off = offOf(a).instances.length;
  return variantPanel({ list, now, the: "l'assemblage", The: "L'assemblage", kept: "pièces à On ou à Off", tip: "Garder sous un nom les pièces à On et à Off en ce moment — pour y revenir d'un clic",
    isOn: (v) => isAsmVariant(a, v), diff: (v) => asmVariantDiff(a, v, o.names || {}), drawing: (v) => `#/drawings/asm/${encodeURIComponent(o.id)}/${encodeURIComponent(v.name)}`,
    keep: (n) => store.updateAssembly(o.id, (x) => { x.variants = keepAsmVariant(x, n); }, `${a.id} : variante « ${n} » gardée`),
    apply: (v) => store.updateAssembly(o.id, (x) => { applyAsmVariant(x, v); }, `${a.id} : variante « ${v.name} »`),
    drop: (name) => store.updateAssembly(o.id, (x) => { x.variants = dropAsmVariant(x, name); if (!x.variants.length) delete x.variants; }, `${a.id} : variante « ${name} » retirée`),
    hint: list.length
      ? `${now ? "" : "L'assemblage est dans un état sans nom : le « + » le garde. "}Une variante retient les pièces à On et à Off ; une pièce ajoutée plus tard vaut pour toutes. La variante de chaque pièce n'en fait pas partie : elle se choisit dans la pièce.`
      : `Plusieurs versions d'un produit tiennent dans un seul assemblage : mettez des pièces à Off, puis gardez cet état sous un nom avec le « + »${off ? ` (${off} pièce${off > 1 ? "s" : ""} à Off en ce moment)` : ""}.` });
}
/* the mark of a variant : the part and its cousin, the one in use filled */
function mark(on) {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "20"); s.setAttribute("height", "20"); s.setAttribute("aria-hidden", "true"); s.style.flex = "none";
  for (const [x, y, fill] of [[3, 8, on ? COLOR : "none"], [10, 3, "none"]]) { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "11"); r.setAttribute("height", "11"); r.setAttribute("rx", "2"); r.setAttribute("fill", fill); r.setAttribute("fill-opacity", ".35"); r.setAttribute("stroke", COLOR); r.setAttribute("stroke-width", "1.7"); s.append(r); }
  return s;
}
