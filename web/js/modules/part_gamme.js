/* DesignWizard.ai — « Gamme » panel of the part studio: the raw stock to buy and the detailed routing sheet to talk
   with the supplier — phase by phase, each one shown in the 3D view as the part stands after it, with notes, the
   points to discuss and the Word / PDF / text sheets. Then the « Artéfacts » panel: the exchange files of the part. */

import { el, icon, btn, badge, field, fmt, toast, download, copyText } from "../core/dom.js";
import { store } from "../core/store.js";
import { routing, stockFromFirstFeature } from "../cad/shop.js";
import { STOCK_FORMS } from "../cad/stock.js";
import { session } from "../core/access.js";
import { kernel } from "../cad/client.js";
import { processPlan, stateSpec } from "../cad/process_plan.js";
import { planPanel, shot, setPlanNote, setPlanPoints } from "./plan_view.js";

const NO_STOCK = new Set(["injection_molding", "fdm", "mjf", "pcb", "extrusion_al", "extrusion_plastic", "purchased"]);      // processes that do not start from a bar or a plate

export function gammePanel(body, ctx) {
  const { st, id, editStock, vp } = ctx, s = st.spec, b = st.built;
  if (!b) { body.append(el("p", { class: "muted" }, "La gamme s'écrit après la construction de la pièce…")); return; }
  const r = routing(s, b), sf = b.facts.stock, plan = processPlan(s, b, { route: r, dfx: st.findings });
  if (sf) {
    body.append(el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, r.utilisation !== null ? `${Math.round(r.utilisation * 100)} %` : "—"), el("span", null, "du brut dans la pièce")),
      el("div", { class: "kpi" }, el("b", null, r.setups.length || 1), el("span", null, "posage(s)")), el("div", { class: "kpi" }, el("b", null, r.tools.length), el("span", null, "outil(s)"))));
    body.append(el("button", { class: "atelier-stock", type: "button", style: { width: "100%", font: "inherit", textAlign: "left", cursor: "pointer" }, onClick: () => editStock(), "data-tip": "Changer la matière première" },
      icon(STOCK_FORMS[sf.form].icon), el("div", null, el("b", null, sf.label), el("small", null, sf.exact ? "Taille du commerce : les faces restent brutes." : sf.standard ? "Brut du commerce à reprendre en usinage." : "Hors série courante."))));
  } else if (!s.extrusion && !s.pcb && !s.step && !NO_STOCK.has(s.process)) {
    const conv = stockFromFirstFeature(s);
    body.append(el("div", { class: "atelier-hint" }, icon("info"), el("div", null, "Cette pièce ne dit pas encore de quelle matière première elle part : la gamme ne peut ni choisir le brut, ni chiffrer la matière perdue.",
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", marginTop: ".4rem" } },
        conv ? btn("Déclarer le brut depuis la première forme", () => { store.updatePart(id, (x) => { x.stock = conv.stock; x.features = conv.features; }, `${id} : matière première déclarée`); toast("Matière première déclarée : la première forme devient le brut.", "success"); }, { small: true, icon: "sparkle" })
          : btn("Choisir une matière première", () => editStock(), { small: true, icon: "plus" })))));
  }
  /* the part as it stands after a phase : the later operations are left out and the part is built again */
  const stateOf = async (i) => { const sp = stateSpec(s, plan, i); return sp ? kernel.build(sp, null, `${id}~live`) : b; };
  const mark = () => body.querySelectorAll(".plan-phase").forEach((li) => li.classList.toggle("on", li.dataset.phase === st.phase));
  const show = async (ph, i) => {
    const token = st.token;
    try { const built = await stateOf(i); if (token !== st.token || st.phase !== ph.key) return; ctx.paint(built, i < plan.phases.length - 1 ? `Après la phase ${ph.n} — ${ph.title}` : ""); }
    catch (e) { toast(`Phase ${ph.n} : ${e.message}`, "warn"); }
  };
  planPanel(body, plan, { selected: st.phase, aiKey: `part:${id}`,
    onSelect: (ph, i) => { if (st.phase === ph.key) { st.phase = null; ctx.paint(b); } else { st.phase = ph.key; show(ph, i); } mark(); },
    onNote: (key, text) => store.updatePart(id, (x) => setPlanNote(x, key, text), `${id} : note de gamme`),
    onPoints: (list) => store.updatePart(id, (x) => setPlanPoints(x, list), `${id} : points à discuter`),
    figures: async () => {
      const v = vp.viewer, out = [], token = st.token;
      v.clearOverlays("frame"); v.clearOverlays("dfx");
      try {
        ctx.paint(b); out.push(shot(v, `${s.id} — la pièce finie`, null, 120));
        for (let i = 0; i < plan.phases.length - 1 && token === st.token; i++) { const sp = stateSpec(s, plan, i); if (!sp) break; ctx.paint(await kernel.build(sp, null, `${id}~live`)); out.push(shot(v, `La pièce après la phase ${plan.phases[i].n} — ${plan.phases[i].title}`, plan.phases[i].key)); }
      } finally { st.phase = null; ctx.paint(b); ctx.overlays(); mark(); }
      return out;
    } });
  const k = plan.phases.findIndex((ph) => ph.key === st.phase);
  if (k >= 0) show(plan.phases[k], k); else st.phase = null;
  if (sf && sf.rawVolume) body.append(el("p", { class: "muted small" }, `Brut : ${fmt(sf.rawVolume / 1000, 1)} cm³ · pièce : ${fmt(b.volume / 1000, 1)} cm³ · copeaux : ${fmt((sf.rawVolume - b.volume) / 1000, 1)} cm³ (ratio matière ${fmt(sf.rawVolume / b.volume, 2)} : 1).`));
}

/* ---------- « Artéfacts » panel: every exchange file of the part, one click each ---------- */
export function artifactsPanel(body, { st, id }) {
  const orderBox = el("div", { class: "order-card" }, el("p", { class: "muted small" }, "Vérification de la commande…"));
  body.append(el("h3", null, "Commander le prototype"), orderBox, el("h3", { style: { marginTop: "1rem" } }, "Fichiers d'échange"),
    el("p", { class: "muted small" }, "Ce que la pièce remet au reste de l'industrie. Chaque fichier est produit à la demande, à partir de la pièce telle qu'elle est maintenant."));
  import("../core/artifacts.js").then(({ artifactsFor, makeArtifact, partArtifacts, orderStatus, orderPackage }) => {
    const order = { quantity: 1, ...(st.spec.intent && st.spec.intent.quantity ? { quantity: st.spec.intent.quantity } : {}), ...(st.spec.order || {}) };
    const keep = () => store.updatePart(id, (x) => { x.order = { ...order }; }, `${id} : commande modifiée`);
    const drawOrder = async () => {
      let s;
      try { s = await orderStatus(id, order); } catch (e) { orderBox.replaceChildren(el("p", { class: "form-error" }, e.message)); return; }
      const c = s.check, qty = el("input", { type: "number", min: 1, step: 1, value: order.quantity, onChange: (e) => { order.quantity = Math.max(1, parseInt(e.target.value, 10) || 1); keep(); } });
      const need = el("input", { type: "date", value: order.need_by || "", onChange: (e) => { if (e.target.value) order.need_by = e.target.value; else delete order.need_by; keep(); } });
      orderBox.replaceChildren(el("p", null, badge(c.ready ? (c.express ? "Express" : "Prête") : "À corriger", c.ready ? (c.express ? "ok" : "info") : "danger"), " ", el("b", null, c.label)),
        ...c.blockers.map((t) => el("p", { class: "form-error" }, t)), ...c.cautions.map((t) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", t)),
        c.drivers.length ? el("ul", { class: "decisions" }, c.drivers.map((t) => el("li", null, t))) : null,
        el("div", { class: "form-row tight" }, field("Quantité", qty), field("Livraison souhaitée", need)),
        el("div", { class: "form-actions" },
          btn("Copier la demande de prix", async () => { try { const p = await orderPackage(id, order); toast((await copyText(p.rfq)) ? "Demande de prix copiée : collez-la dans votre courriel à l'atelier." : "Copie impossible.", "success", 6000); } catch (e) { toast(e.message, "error"); } }, { small: true, icon: "copy" }),
          btn("Dossier de commande (.zip)", async (e, b) => { b.disabled = true; try { const p = await orderPackage(id, order); download(p.name, p.bytes, "application/zip"); toast(`Dossier prêt : demande de prix + ${p.files.length} fichier(s).`, "success", 6000); } catch (x) { toast(x.message, "error"); } b.disabled = false; },
            { primary: true, small: true, icon: "export", disabled: !c.ready, tip: c.ready ? "Demande de prix, STEP, dessin PDF, DXF, STL, gamme et fiche .dwiz dans une seule archive" : "Corrigez d'abord ce qui bloque" })),
        session.account ? el("div", { class: "form-actions" }, btn("Ranger la commande dans Drive", async (e, b) => {
          b.disabled = true;
          try { const p = await orderPackage(id, order), r = await session.fs.saveOrder(store.project, p, { partId: id, quantity: c.quantity }); toast(`Commande rangée dans Drive : ${r.folder.name}. Partagez ce dossier avec l'atelier depuis Drive.`, "success", 8000); if (r.folder.webViewLink) window.open(r.folder.webViewLink, "_blank", "noopener"); }
          catch (x) { toast(x.message, "error", 7000); }
          b.disabled = false;
        }, { small: true, icon: "cloud", disabled: !c.ready, tip: "05_Commandes / date, numéro, quantité : l'archive et la demande de prix, prêtes à partager" })) : null,
        el("p", { class: "muted small" }, "Délais typiques d'ateliers de prototypage rapide, en jours ouvrables, hors transport : ils classent les options ; le devis de l'atelier fait foi."));
    };
    drawOrder();
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
