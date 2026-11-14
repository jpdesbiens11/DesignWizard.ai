/* DesignWizard.ai — « Gamme » panel of the part studio: the raw stock to buy, the routing sheet (operations in the
   order of the workshop), the tools, the set-ups and what the workshop would advise. */

import { el, icon, btn, badge, fmt, toast, download } from "../core/dom.js";
import { store } from "../core/store.js";
import { routing, stockFromFirstFeature, FACE_FR } from "../cad/workshop.js";
import { STOCK_FORMS } from "../cad/stock.js";

export function gammePanel(body, { st, id, editStock }) {
  const s = st.spec, b = st.built;
  if (!b) { body.append(el("p", { class: "muted" }, "La gamme s'écrit après la construction de la pièce…")); return; }
  const r = routing(s, b), sf = b.facts.stock;
  if (sf) {
    body.append(el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, r.utilisation !== null ? `${Math.round(r.utilisation * 100)} %` : "—"), el("span", null, "du brut dans la pièce")),
      el("div", { class: "kpi" }, el("b", null, r.setups.length || 1), el("span", null, "posage(s)")), el("div", { class: "kpi" }, el("b", null, r.tools.length), el("span", null, "outil(s)"))));
    body.append(el("button", { class: "atelier-stock", type: "button", style: { width: "100%", font: "inherit", textAlign: "left", cursor: "pointer" }, onClick: () => editStock(), "data-tip": "Changer la matière première" },
      icon(STOCK_FORMS[sf.form].icon), el("div", null, el("b", null, sf.label), el("small", null, sf.exact ? "Taille du commerce : les faces restent brutes." : sf.standard ? "Brut du commerce à reprendre en usinage." : "Hors série courante."))));
  } else {
    const conv = stockFromFirstFeature(s);
    body.append(el("div", { class: "atelier-hint" }, icon("info"), el("div", null, "Cette pièce ne dit pas encore de quelle matière première elle part : la gamme ne peut ni choisir le brut, ni chiffrer la matière perdue.",
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", marginTop: ".4rem" } },
        conv ? btn("Déclarer le brut depuis la première forme", () => { store.updatePart(id, (x) => { x.stock = conv.stock; x.features = conv.features; }, `${id} : matière première déclarée`); toast("Matière première déclarée : la première forme devient le brut.", "success"); }, { small: true, icon: "sparkle" })
          : btn("Choisir une matière première", () => editStock(), { small: true, icon: "plus" })))));
  }
  body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, "Gamme de fabrication"),
    btn("", () => download(`${s.id}_gamme.txt`, gammeText(s, r), "text/plain;charset=utf-8"), { small: true, icon: "download", tip: "Télécharger la gamme (texte)" })),
    el("ol", { class: "gamme" }, r.steps.map((x) => el("li", { class: `g-${x.kind}` }, el("span", { class: "g-n" }, x.n), el("span", { class: "grow" }, x.text), x.face && x.kind !== "stock" ? badge(FACE_FR[x.face] || x.face, "neutral") : null)))));
  if (r.tools.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Outils"), el("p", { class: "small" }, r.tools.join(" · "))));
  if (r.advice.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Conseils de l'atelier"), r.advice.map((a) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", a))));
  if (sf && sf.rawVolume) body.append(el("p", { class: "muted small" }, `Brut : ${fmt(sf.rawVolume / 1000, 1)} cm³ · pièce : ${fmt(b.volume / 1000, 1)} cm³ · copeaux : ${fmt((sf.rawVolume - b.volume) / 1000, 1)} cm³ (ratio matière ${fmt(sf.rawVolume / b.volume, 2)} : 1).`));
}

/** Plain-text routing sheet (for a quote request or the workshop traveller). */
export function gammeText(spec, r) {
  return [`GAMME DE FABRICATION — ${spec.id} ${spec.name || ""}`.trim(), `Matériau : ${spec.material || "?"} · Procédé : ${r.process || spec.process || "?"}`, "",
    ...r.steps.map((s) => `${String(s.n).padStart(3)}  ${s.text}${s.face && s.kind !== "stock" ? `  [${FACE_FR[s.face] || s.face}]` : ""}`), "",
    r.tools.length ? `Outils : ${r.tools.join(" ; ")}` : "", ...r.advice.map((a) => `Conseil : ${a}`), "", "Généré par DesignWizard.ai — à valider par l'atelier."].filter((l) => l !== "").join("\n").replace(/\n(Outils|GAMME)/g, "\n\n$1");
}
