/* DesignWizard.ai — « Gamme » panel of the part studio: the raw stock to buy, the routing sheet (operations in the
   order of the shop), the tools, the set-ups and what the shop would advise. */

import { el, icon, btn, badge, fmt, toast, download } from "../core/dom.js";
import { store } from "../core/store.js";
import { routing, stockFromFirstFeature, FACE_FR } from "../cad/shop.js";
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

/** Plain-text routing sheet (for a quote request or the shop traveller). */
export function gammeText(spec, r) {
  return [`GAMME DE FABRICATION — ${spec.id} ${spec.name || ""}`.trim(), `Matériau : ${spec.material || "?"} · Procédé : ${r.process || spec.process || "?"}`, "",
    ...r.steps.map((s) => `${String(s.n).padStart(3)}  ${s.text}${s.face && s.kind !== "stock" ? `  [${FACE_FR[s.face] || s.face}]` : ""}`), "",
    r.tools.length ? `Outils : ${r.tools.join(" ; ")}` : "", ...r.advice.map((a) => `Conseil : ${a}`), "", "Généré par DesignWizard.ai — à valider par l'atelier."].filter((l) => l !== "").join("\n").replace(/\n(Outils|GAMME)/g, "\n\n$1");
}

/* ---------- « Artéfacts » panel: every exchange file of the part, one click each ---------- */
export function artifactsPanel(body, { st, id }) {
  body.append(el("p", { class: "muted small" }, "Ce que la pièce remet au reste de l'industrie. Chaque fichier est produit à la demande, à partir de la pièce telle qu'elle est maintenant."));
  import("../core/artifacts.js").then(({ artifactsFor, makeArtifact, partArtifacts }) => {
    const list = artifactsFor(st.spec);
    const get = async (a, b) => {
      b.disabled = true;
      try { const f = await makeArtifact(id, a.key); download(f.name, f.bytes, f.mime); for (const w of f.warnings.slice(0, 3)) toast(w, "warn", 7000); }
      catch (e) { toast(`${a.label} : ${e.message}`, "error", 7000); }
      b.disabled = false;
    };
    for (const a of list) body.append(el("div", { class: "artifact-row" }, icon(a.icon), el("div", { class: "grow" }, el("b", null, a.label), el("small", null, a.text)),
      btn("", (e, b) => get(a, b), { small: true, icon: "download", tip: `Télécharger ${st.spec.id}${a.ext}` })));
    body.append(el("div", { class: "form-actions" }, btn("Tout télécharger", async (e, b) => {
      b.disabled = true;
      const r = await partArtifacts(id);
      for (const f of r.files) download(f.name, f.bytes, f.mime);
      toast(`${r.files.length} fichier(s) téléchargés${r.errors.length ? ` ; non produits : ${r.errors.map((x) => x.label).join(", ")}` : ""}.`, r.errors.length ? "warn" : "success", 6000);
      b.disabled = false;
    }, { icon: "export" }), el("a", { class: "btn", href: "#/account" }, icon("cloud"), "Ranger dans Google Drive")));
    body.append(el("p", { class: "muted small" }, "DWG est un format fermé : la plateforme écrit du DXF, que tout logiciel DWG ouvre. Le FeatureScript est expérimental : il n'a pas encore été validé dans Onshape."));
  });
}
