/* DesignWizard.ai — Onshape: connect the account (API keys kept on this computer by the local server), choose the
   document, review what will be created, then send the assembly: STEP converted to native Part Studios and Assembly,
   each drawing as a PDF tab AND as a native Onshape drawing attached to its part, plus the part properties. */

import { el, clear, icon, btn, badge, field, toast, fmt, table } from "../core/dom.js";
import { registerModule, setStatus } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import * as api from "../onshape/api.js";
import { planPush, pushToOnshape } from "../onshape/push.js";
import { buildAssembly } from "../core/asm_scene.js";
import { makeDrawing } from "./drawings.js";
import { materialOrDefault } from "../cad/materials.js";

const state = { doc: null, q: "" };

function render(main, args) {
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Onshape"), el("p", { class: "muted" }, "Envoyez l'assemblage dans le document Onshape de votre choix pour le détailler avec les fonctions natives : pièces et assemblage convertis du STEP, dessin PDF de chaque pièce et dessin natif Onshape attaché à son 3D."))));
  const box = el("div");
  page.append(box);
  let alive = true;
  const steps = el("ol", { class: "steps" }, ["Connecter le compte", "Choisir le document", "Vérifier l'envoi", "Envoyer"].map((s) => el("li", null, s)));
  const mark = (n) => [...steps.children].forEach((li, i) => { li.className = i < n ? "done" : i === n ? "now" : ""; });

  (async () => {
    const ok = await api.available().catch(() => false);
    if (!alive) return;
    if (!ok) {
      box.append(el("div", { class: "card taped" }, el("h2", null, "La connexion Onshape demande le serveur local"),
        el("p", null, "Vous utilisez la version statique de la plateforme (aucun serveur). Les clés d'API Onshape ne doivent jamais être confiées à une page web : c'est le petit serveur local qui les garde sur votre poste et parle à Onshape."),
        el("p", null, "Pour l'activer : téléchargez le dépôt, puis lancez ", el("code", null, "python designwizard.py"), " et ouvrez ", el("code", null, "http://127.0.0.1:8070"), "."),
        el("p", { class: "muted" }, "En attendant, le STEP de l'assemblage (onglet Assemblage → STEP) et les PDF des dessins s'importent à la main dans Onshape.")));
      return;
    }
    box.append(steps);
    const status = await api.status().catch((e) => ({ connected: false, error: e.message }));
    if (!alive) return;
    if (!status.connected) connectCard(status); else workCard(status);
  })();

  function connectCard(status) {
    mark(0);
    const ak = el("input", { type: "password", autocomplete: "off", placeholder: "Access key" }), sk = el("input", { type: "password", autocomplete: "off", placeholder: "Secret key" }), err = el("p", { class: "form-error" }, status.error || "");
    const base = el("input", { type: "text", value: "https://cad.onshape.com", placeholder: "https://cad.onshape.com" });
    box.append(el("div", { class: "card taped", style: { maxWidth: "760px" } }, el("h2", null, "Connecter mon compte Onshape"),
      el("p", null, "Créez une paire de clés d'API dans le ", el("b", null, "Developer Portal"), " d'Onshape : rubrique ", el("b", null, "API keys → Create new API key"), " (droits de lecture et d'écriture sur vos documents). Collez-les ici une seule fois. Détails : docs/ONSHAPE.md."),
      el("p", { class: "muted", style: { fontSize: ".86rem" } }, "Les clés sont envoyées au serveur local de ce poste, qui les enregistre dans son dossier data (fichier protégé, hors du dépôt) et ne les renvoie jamais au navigateur. Elles ne quittent ce poste que vers Onshape."),
      el("div", { class: "form-row" }, field("Access key", ak), field("Secret key", sk)), field("Adresse Onshape", base, "Entreprise : https://votre-societe.onshape.com"), err,
      el("div", { class: "form-actions" }, el("a", { class: "btn", href: "https://cad.onshape.com/appstore/dev-portal", target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Ouvrir le Developer Portal"),
        btn("Connecter", async (e, b) => { b.disabled = true; err.textContent = ""; try { const s = await api.connect({ accessKey: ak.value.trim(), secretKey: sk.value.trim(), baseUrl: base.value.trim() || undefined }); toast("Compte Onshape connecté.", "success"); clear(box); box.append(steps); workCard(s); } catch (x) { err.textContent = x.message; b.disabled = false; } }, { primary: true, icon: "link" }))));
  }

  function workCard(status) {
    mark(state.doc ? 2 : 1);
    const who = status.user ? (status.user.name || status.user.email || "") : "";
    const head = el("div", { class: "card", style: { marginBottom: "1rem" } }, el("p", { style: { margin: 0 } }, badge("connecté", "ok"), ` ${who} `, el("small", { class: "muted" }, status.baseUrl || ""),
      " ", btn("Déconnecter", async () => { await api.disconnect().catch(() => {}); toast("Clés Onshape effacées de ce poste."); clear(box); box.append(steps); connectCard({}); }, { small: true, icon: "unlink" })));
    const cols = el("div", { class: "two-col" });
    box.append(head, cols);

    /* document picker */
    const q = el("input", { type: "search", value: state.q, placeholder: "Chercher un document…" }), list = el("div"), newName = el("input", { type: "text", placeholder: `Ex. : ${store.project.name}` }), pub = el("input", { type: "checkbox" });
    const sel = el("p", null, state.doc ? ["Document choisi : ", el("b", null, state.doc.name)] : el("span", { class: "muted" }, "Aucun document choisi."));
    const load = async () => {
      clear(list); list.append(el("p", { class: "muted" }, "Recherche…"));
      try {
        const r = await api.listDocuments(q.value.trim(), { limit: 20 });
        clear(list);
        for (const d of r.items || []) list.append(el("button", { class: "nav-item" + (state.doc && state.doc.id === d.id ? " active" : ""), type: "button", onClick: () => choose(d) }, icon("folder"), el("span", { class: "grow" }, d.name), d.public ? badge("public", "warn") : null, el("small", null, d.modifiedAt ? new Date(d.modifiedAt).toLocaleDateString("fr-CA") : "")));
        if (!(r.items || []).length) list.append(el("p", { class: "muted" }, "Aucun document trouvé."));
      } catch (e) { clear(list); list.append(el("p", { class: "form-error" }, e.message)); }
    };
    const choose = (d) => { state.doc = d; state.q = q.value; clear(box); box.append(steps); workCard(status); };
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
    cols.append(el("div", { class: "card taped" }, el("h2", null, "Document Onshape de destination"), sel, el("div", { class: "form-row" }, field("Mes documents", q), btn("Chercher", load, { icon: "search" })), list,
      el("h3", { style: { marginTop: ".8rem" } }, "Ou créer un document"), el("div", { class: "form-row" }, field("Nom", newName), el("label", { class: "check", "data-tip": "Le plan gratuit d'Onshape n'accepte que des documents publics" }, pub, "Public"),
        btn("Créer", async () => { try { const d = await api.createDocument(newName.value.trim() || store.project.name, { public: pub.checked }); toast(`Document « ${d.name} » créé.`, "success"); choose(d); } catch (e) { toast(e.message, "error", 8000); } }, { icon: "plus" })),
      el("p", { class: "muted", style: { fontSize: ".8rem" } }, "Plan gratuit Onshape : les documents sont PUBLICS. N'y envoyez rien de confidentiel.")));
    load();

    /* content and send */
    const asmSel = el("select", null, store.assemblies.map((a) => el("option", { value: a.id, selected: a.id === args[0] }, `${a.id} — ${a.name || ""}`)));
    const oNative = el("input", { type: "checkbox", checked: true }), oPdf = el("input", { type: "checkbox", checked: true }), oMeta = el("input", { type: "checkbox", checked: true });
    const out = el("div");
    const send = el("div", { class: "card taped" }, el("h2", null, "Contenu de l'envoi"), store.assemblies.length ? field("Assemblage", asmSel) : el("p", { class: "form-error" }, "Le projet n'a pas d'assemblage. Correctif : créez-en un dans l'onglet Assemblage."),
      el("label", { class: "check", style: { display: "flex" } }, oNative, "Créer le dessin natif Onshape de chaque pièce (attaché à son 3D)"), el("label", { class: "check", style: { display: "flex" } }, oPdf, "Joindre le dessin PDF de chaque pièce (onglet PDF)"),
      el("label", { class: "check", style: { display: "flex" } }, oMeta, "Renseigner les propriétés des pièces (numéro, description, matériau, révision)"),
      el("div", { class: "form-actions" }, btn("Préparer et vérifier l'envoi", () => prepare(), { primary: true, icon: "play", disabled: !state.doc || !store.assemblies.length, tip: state.doc ? "Construit le STEP et les dessins, puis montre ce qui sera créé" : "Choisissez d'abord un document" })), out);
    cols.append(send);

    async function prepare() {
      clear(out); out.append(el("p", { class: "muted" }, "Construction du STEP et des dessins…"));
      try {
        const asm = store.assembly(asmSel.value), ctx = await buildAssembly(asm, (t) => setStatus(t, "busy"));
        if (ctx.errors.length) throw new Error(ctx.errors.join(" "));
        const items = ctx.asm.instances.map((i) => { const s = store.part(i.part); return { key: i.part, name: `${i.part} ${s.name || ""}`.trim(), instanceName: `${i.part} ${i.id}`, matrix: ctx.sol.placements[i.id] }; });
        const stepText = await kernel.step(items, `${asm.id} ${asm.name || ""}`.trim());
        const parts = [];
        for (const pid of [...new Set(ctx.asm.instances.map((i) => i.part))]) {
          const s = store.part(pid), entry = { id: pid, name: `${pid} ${s.name || ""}`.trim(), revision: s.revision || "A", material: materialOrDefault(s.material).name, description: s.function || s.name || "" };
          if (!s.step && (oPdf.checked || oNative.checked)) {
            setStatus(`Dessin : ${pid}`, "busy");
            try { const d = await makeDrawing(pid); if (oPdf.checked) entry.pdfBytes = d.pdfBytes(); entry.drawing = { title: `${pid} ${s.name || ""}`.trim(), size: "A3", notes: d.info.notes, gdt: d.info.gdt.map((g) => ({ symbol: g.symbol, tolerance: g.tolerance, datums: g.datums, name: g.name })) }; } catch (e) { entry.drawingError = e.message; }
          }
          parts.push(entry);
        }
        const job = { did: state.doc.id, wid: state.doc.defaultWorkspaceId, assemblyName: `${asm.id} ${asm.name || ""}`.trim(), stepText, parts, options: { nativeDrawings: oNative.checked, attachPdf: oPdf.checked, setMetadata: oMeta.checked } };
        setStatus("Envoi prêt", "done"); mark(2);
        clear(out);
        out.append(el("h3", { style: { marginTop: ".8rem" } }, `Ce qui sera créé dans « ${state.doc.name} »`), el("ul", { style: { fontSize: ".88rem", paddingLeft: "1.1rem" } }, planPush(job).map((l) => el("li", null, l))),
          state.doc.public ? el("p", { class: "form-error" }, "Ce document est PUBLIC : tout son contenu sera visible de tous.") : null,
          el("p", { class: "muted", style: { fontSize: ".82rem" } }, `STEP : ${fmt(stepText.length / 1024, 0)} Ko · ${parts.filter((x) => x.pdfBytes).length} PDF · rien n'est envoyé avant votre confirmation.`),
          el("div", { class: "form-actions" }, btn("Envoyer vers Onshape", (e, b) => { b.disabled = true; run(job); }, { primary: true, icon: "onshape" })));
      } catch (e) { clear(out); out.append(el("p", { class: "form-error" }, e.message)); setStatus("Préparation impossible", "bad"); }
    }
    async function run(job) {
      mark(3);
      const log = el("div", { class: "prompt-box", style: { maxHeight: "220px" } });
      out.append(log);
      try {
        const res = await pushToOnshape(job, (p) => { log.append(el("div", null, `${p.done !== undefined && p.total ? `[${p.done}/${p.total}] ` : ""}${p.label || p.step}${p.detail ? ` — ${p.detail}` : ""}`)); log.scrollTop = log.scrollHeight; setStatus(p.label || "Envoi Onshape", "busy"); });
        setStatus(res.ok ? "Envoyé vers Onshape" : "Envoi incomplet", res.ok ? "done" : "bad");
        out.append(el("div", { class: "card", style: { marginTop: ".6rem" } }, el("h3", null, res.ok ? "Envoi terminé" : "Envoi incomplet"), res.documentUrl && el("a", { class: "btn btn-primary", href: res.documentUrl, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Ouvrir le document dans Onshape"),
          el("p", { style: { marginTop: ".5rem", fontSize: ".88rem" } }, `${(res.elements.partStudios || []).length} Part Studio(s) · ${res.elements.assembly ? "1 assemblage" : "pas d'assemblage"} · ${(res.elements.drawings || []).length} dessin(s) natif(s) · ${(res.elements.pdfs || []).length} PDF`),
          (res.warnings || []).map((w) => el("p", { class: "form-error", style: { fontSize: ".84rem" } }, w))));
        store.commit("Envoi vers Onshape", (p) => { p.onshape = { documentId: job.did, documentName: state.doc.name, url: res.documentUrl || "", when: new Date().toISOString(), assembly: job.assemblyName }; });
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); setStatus("Envoi interrompu", "bad"); }
    }
  }
  return () => { alive = false; };
}

registerModule({ key: "onshape", label: "Onshape", icon: "onshape", hidden: true, tip: "Connexion et envoi vers Onshape", render });
