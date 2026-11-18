/* DesignWizard.ai — Part Studio : the variants of a part, in the left panel. A family of parts that differ a little is kept in one
   part : the state it is in — which operations are made, what its parameters are worth — is kept under a name, and a click on a
   name brings the whole cousin back, in one step that Ctrl + Z undoes. The model is core/variants.js ; this module draws it. */

import { el, btn, icon, badge, toast, promptBox, confirmBox } from "../core/dom.js";
import { store } from "../core/store.js";
import { variantNow, isVariant, applyVariant, keepVariant, dropVariant, variantDiff, keptAside } from "../core/variants.js";

const COLOR = "#0ea5a4";      // the colour of the variants, in the tree and on their mark

/** o : { spec (the part), id } → the section */
export function variantsSection(o) {
  const s = o.spec, list = s.variants || [], now = variantNow(s), aside = keptAside(s);
  const labels = Object.fromEntries(Object.entries(s.params || {}).map(([k, raw]) => [k, (raw && typeof raw === "object" && raw.label) || k]));
  const keep = async (name) => {
    const n = name || await promptBox("Garder cette variante", "Nom", `Variante ${list.length + 1}`, "L'état de la pièce en ce moment — opérations à On ou à Off, valeurs des paramètres — est gardé sous ce nom.");
    if (!n) return; const exists = list.some((v) => v.name === n.trim());
    if (exists && !name && !(await confirmBox("Ce nom existe déjà", `Remplacer la variante « ${n.trim()} » par l'état de la pièce en ce moment ?`, "Remplacer"))) return;
    store.updatePart(o.id, (x) => { x.variants = keepVariant(x, n); }, `${s.id} : variante « ${n.trim()} » gardée`); toast(`Variante « ${n.trim()} » gardée.`, "success", 2600);
  };
  const sec = el("div", { class: "side-section", "data-fold-note": list.length ? `${list.length} · ${now ? `en cours : ${now}` : "état sans nom"}` : "aucune" },
    el("h3", null, el("span", { class: "grow" }, `Variantes (${list.length})`), btn("", () => keep(), { small: true, icon: "plus", tip: "Garder l'état de la pièce en ce moment sous un nom — pour y revenir d'un clic" })));
  for (const v of list) {
    const on = isVariant(s, v), diff = on ? [] : variantDiff(s, v, labels);
    sec.append(el("div", { class: "nav-item variant" + (on ? " active" : ""), role: "button", tabindex: "0", "data-variant": v.name, "data-tip": on ? "La pièce est dans cette variante" : `Passer à cette variante : ${diff.join(" · ") || "rien ne change"}`,
      onClick: () => { if (on) return; store.updatePart(o.id, (x) => { const r = applyVariant(x, v); x.features = r.features; x.params = r.params; }, `${s.id} : variante « ${v.name} »`); toast(`Pièce passée à la variante « ${v.name} ». Ctrl + Z pour revenir.`, "success", 3200); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      mark(on), el("span", { class: "grow bc-text" }, el("span", null, v.name), el("small", null, on ? "en cours" : diff.slice(0, 3).join(" · ") || "comme la pièce")),
      on ? badge("en cours", "ok") : null,
      el("button", { class: "icon-btn", type: "button", "aria-label": `Mettre à jour la variante ${v.name}`, "data-tip": "Remplacer cette variante par l'état de la pièce en ce moment", style: { fontSize: ".95rem" }, onClick: (e) => { e.stopPropagation(); keep(v.name); } }, icon("refresh")),
      el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer la variante ${v.name}`, "data-tip": "Retirer ce nom — la pièce ne change pas", onClick: (e) => { e.stopPropagation(); store.updatePart(o.id, (x) => { x.variants = dropVariant(x, v.name); if (!x.variants.length) delete x.variants; }, `${s.id} : variante « ${v.name} » retirée`); } }, "×")));
  }
  sec.append(el("p", { class: "muted small" }, list.length
    ? `${now ? "" : "La pièce est dans un état sans nom : le « + » le garde. "}Une variante retient ce qui est à On et à Off dans l'arbre et la valeur de chaque paramètre ; une opération ou un paramètre ajouté plus tard vaut pour toutes.`
    : `Une famille de pièces un peu différentes tient dans une seule pièce : mettez des opérations à Off, changez des valeurs, puis gardez cet état sous un nom avec le « + »${aside.features || aside.values ? ` (${aside.features} opération${aside.features > 1 ? "s" : ""} à Off, ${aside.values} valeur${aside.values > 1 ? "s" : ""} gardée${aside.values > 1 ? "s" : ""} en ce moment)` : ""}.`));
  return sec;
}
/* the mark of a variant : the part and its cousin, the one in use filled */
function mark(on) {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "20"); s.setAttribute("height", "20"); s.setAttribute("aria-hidden", "true"); s.style.flex = "none";
  for (const [x, y, fill] of [[3, 8, on ? COLOR : "none"], [10, 3, "none"]]) { const r = document.createElementNS(NS, "rect"); r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "11"); r.setAttribute("height", "11"); r.setAttribute("rx", "2"); r.setAttribute("fill", fill); r.setAttribute("fill-opacity", ".35"); r.setAttribute("stroke", COLOR); r.setAttribute("stroke-width", "1.7"); s.append(r); }
  return s;
}
