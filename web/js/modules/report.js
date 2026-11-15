/* DesignWizard.ai — Rapport: the design-review file of the project, built from the live model — pictures of the
   assembly and of each part, BOM, interface register, isolation verdicts, DFM / DFA findings, drawings, and the
   review decisions. Printable (PDF through the browser) or saved as one self-contained HTML file. */

import { el, clear, icon, btn, badge, table, fmt, fmtMass, download, toast } from "../core/dom.js";
import { registerModule, setStatus } from "../core/app.js";
import { store } from "../core/store.js";
import { Viewer } from "../core/viewer.js";
import { showBuilt } from "../core/viewport.js";
import { buildAssembly, showAssembly } from "../core/asm_scene.js";
import { projectDfx } from "./dfx.js";
import { physicsSummary } from "./physics.js";
import { simulationSummary } from "../analysis/fea/summary.js";
import { routing } from "../cad/shop.js";
import { orderCheck } from "../cad/order.js";
import { makeDrawing, svgNode } from "./drawings.js";
import { reviewRows, reviewProgress } from "../core/review.js";
import { PROCESSES, materialOrDefault } from "../cad/materials.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";
import { LEVEL_LABEL } from "../analysis/cc_rules.js";
import { processPlan } from "../cad/process_plan.js";
import { assemblyPlan } from "../core/asm_plan.js";
import { mateHardware } from "../core/assembly_logic.js";
import { planSummary } from "../core/plan_doc.js";

const sevText = { error: "À corriger", warn: "À vérifier", info: "Conseil" };
const img = (src, alt) => el("img", { src, alt, style: { width: "100%", height: "auto", border: "1.4px solid rgba(38,50,63,.25)", borderRadius: "10px", background: "#fff" } });

async function pictures(dfx, onProgress) {
  const host = el("div", { style: { position: "fixed", left: "-3000px", top: "0", width: "900px", height: "600px" } });
  document.body.append(host);
  const v = new Viewer(host, {}), out = { parts: {}, asms: {} };
  try {
    for (const p of dfx.parts) {
      if (!p.built || !p.built.bodies.length) continue;
      onProgress(`Image : ${p.spec.id}`);
      v.clear(); showBuilt(v, p.built, { prefix: "p" }); v.view("iso");
      out.parts[p.spec.id] = v.snapshotJpeg(0.86);
    }
    for (const a of dfx.asms) {
      if (!a.ctx) continue;
      onProgress(`Images : ${a.asm.id}`);
      v.clear(); showAssembly(v, a.ctx, { skipHidden: false }); v.setExplode(0); v.view("iso");
      const assembled = v.snapshotJpeg(0.88);
      const k = Math.max(25, (a.ctx.bbox[5] - a.ctx.bbox[2] + a.ctx.bbox[3] - a.ctx.bbox[0]) * 0.22);
      v.setExplode(k); v.fit(1.6);
      const exploded = v.snapshotJpeg(0.88);
      v.setExplode(0);
      out.asms[a.asm.id] = { assembled, exploded };
    }
  } finally { v.dispose(); host.remove(); }
  return out;
}

function render(main) {
  const page = el("div", { class: "page" });
  main.append(page);
  const p = store.project, rv = () => store.project.review || {};
  const head = el("div", { class: "page-head no-print" }, el("div", { class: "grow" }, el("h1", null, "Rapport de design review"), el("p", { class: "muted" }, "Le dossier se construit à partir du modèle vivant : relancez-le après chaque modification. Il sert de support à la revue et garde ses décisions.")),
    btn("Imprimer / PDF", () => window.print(), { icon: "pdf", tip: "Le navigateur enregistre le rapport en PDF (Destination : Enregistrer au format PDF)" }), btn("Fichier HTML autonome", () => saveHtml(), { icon: "download", tip: "Un seul fichier avec les images, à joindre à un courriel ou à un ticket" }));
  const doc = el("article", { id: "report" });
  page.append(head, doc);
  doc.append(el("p", { class: "muted" }, "Construction des pièces, des images et des analyses…"));
  let alive = true;

  (async () => {
    try {
      const dfx = await projectDfx((t) => setStatus(t, "busy"));
      const pics = await pictures(dfx, (t) => setStatus(t, "busy"));
      const drawings = {};
      for (const x of dfx.parts) { if (!x.built || !x.built.bodies.length || x.spec.step) continue; setStatus(`Dessin : ${x.spec.id}`, "busy"); try { drawings[x.spec.id] = (await makeDrawing(x.spec.id)).svg; } catch (e) { drawings[x.spec.id] = null; } }
      if (!alive) return;
      setStatus("Rapport à jour", "done");
      build(dfx, pics, drawings);
    } catch (e) { if (alive) { clear(doc); doc.append(el("div", { class: "card" }, el("h2", null, "Le rapport n'a pas pu être construit"), el("p", { class: "form-error" }, e.message))); } }
  })();

  function build(dfx, pics, drawings) {
    clear(doc);
    const errs = dfx.parts.reduce((s, x) => s + ((x.res.summary || {}).errors || 0), 0), warns = dfx.parts.reduce((s, x) => s + ((x.res.summary || {}).warnings || 0), 0);
    const iso = store.assemblies.flatMap((a) => ((a.isolation || {}).results || []).map((r) => ({ ...r, asm: a.id }))), isoBad = iso.filter((r) => r.ok === false).length;
    const mass = dfx.asms[0] && dfx.asms[0].ctx ? dfx.asms[0].ctx.mass.mass : dfx.parts.reduce((s, x) => s + (x.built ? x.built.mass : 0), 0);
    const verdict = errs || isoBad ? ["Points bloquants à lever", "danger"] : warns ? ["Acceptable sous réserve des points à vérifier", "warn"] : ["Conforme aux règles évaluées", "ok"];
    doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } },
      el("p", { class: "muted", style: { margin: 0 } }, "DesignWizard.ai by DynamiteAgile™ — dossier de revue de conception"), el("h2", { style: { fontSize: "1.5rem", fontFamily: "var(--hand)", margin: ".2rem 0" } }, p.name),
      el("p", null, p.description || ""), el("p", { class: "muted" }, `Généré le ${new Date().toLocaleString("fr-CA")} · ${p.parts.length} pièce(s) · ${p.assemblies.length} assemblage(s)${p.author ? ` · ${p.author}` : ""}`),
      el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, fmtMass(mass)), el("span", null, "Masse des pièces")), el("div", { class: "kpi" }, el("b", null, String(errs)), el("span", null, "DFx : à corriger")), el("div", { class: "kpi" }, el("b", null, String(warns)), el("span", null, "DFx : à vérifier")),
        el("div", { class: "kpi" }, el("b", null, iso.length ? (isoBad ? `${isoBad} / ${iso.length}` : "OK") : "—"), el("span", null, iso.length ? "Isolation : paires en défaut" : "Isolation : non analysée"))),
      el("p", null, el("b", null, "Avis automatique : "), badge(verdict[0], verdict[1]), " ", el("small", { class: "muted" }, "(indicatif : la décision appartient à la revue)"))));

    for (const a of dfx.asms) {
      const sec = el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, `Assemblage ${a.asm.id} — ${a.asm.name || ""}`));
      if (a.error || !a.ctx) { sec.append(el("p", { class: "form-error" }, a.error || "Assemblage non construit.")); doc.append(sec); continue; }
      const pic = pics.asms[a.asm.id];
      if (pic) sec.append(el("div", { class: "two-col" }, el("figure", { style: { margin: 0 } }, img(pic.assembled, `${a.asm.id} assemblé`), el("figcaption", { class: "muted", style: { fontSize: ".82rem" } }, "Vue assemblée")), el("figure", { style: { margin: 0 } }, img(pic.exploded, `${a.asm.id} éclaté`), el("figcaption", { class: "muted", style: { fontSize: ".82rem" } }, "Vue éclatée le long des interfaces"))));
      sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Nomenclature (BOM)"), table(["#", "Référence", "Désignation", "Qté", "Matériau", "Masse"], a.ctx.bom.map((r) => [String(r.item), r.id, r.name, String(r.qty), r.material || "—", r.mass === null ? "—" : fmtMass(r.mass)])));
      sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Mates et interfaces"), table(["Mate", "Interface", "Côté A", "Côté B", "Lien"], (a.asm.mates || []).map((m) => {
        const ia = a.asm.instances.find((i) => i.id === m.a.inst), ib = a.asm.instances.find((i) => i.id === m.b.inst), fa = ia && (a.ctx.built[ia.part].interfaces || []).find((i) => i.id === m.a.iface);
        return [m.id, fa ? `${fa.name} (${INTERFACE_TYPES[fa.type].fr})` : "?", ia ? ia.part : "?", ib ? ib.part : "?", m.linked === false ? "non lié" : "paramètres liés"];
      })));
      const gamme = assemblyPlan(a.asm, p, { hardwareOf: (m) => mateHardware(a.ctx.asm, a.ctx.built, m), mass: a.ctx.mass.mass });
      sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Gamme d'assemblage"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, planSummary(gamme)),
        table(["N°", "Étape", "Opérations", "Outillage", "Note de discussion"], gamme.phases.map((ph) => [String(ph.n), ph.title, ph.ops.map((o) => o.text).join(" ; ") || ph.checks.join(" ; "), ph.tools.join(" ; ") || "—", ph.note || "—"])));
      const isoA = (a.asm.isolation || {}).results;
      sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Isolation — creepage et clearance (IEC 60664-1)"));
      if (isoA && isoA.length) {
        const P = (a.asm.isolation || {}).params || {};
        sec.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, `Pollution degree ${P.pollution_degree ?? 2} · altitude ${P.altitude_m ?? 2000} m · OVC ${P.ovc || "II"} · champ cas ${P.field || "A"} · analysé le ${new Date(isoA[0].when).toLocaleString("fr-CA")}`),
          table(["Paire", "Tension", "Niveau", "Clr requise", "Clr mesurée", "Crp requis", "Crp mesuré", "Verdict"], isoA.map((r) => [`${r.a} ↔ ${r.b}`, `${fmt(r.u, 0)} V`, LEVEL_LABEL[r.level] || r.level, fmt(r.clrReq, 2), r.clr === null ? "> plafond" : fmt(r.clr, 2), r.crpReq === null ? "—" : `${fmt(r.crpReq, 2)}${r.group ? ` (${r.group})` : ""}`, r.crp === null ? "—" : fmt(r.crp, 2),
            r.ok === false ? badge("NON", "danger") : r.ok ? badge("OK", "ok") : badge("?", "warn")])), el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Distances en mm, mesurées sur la géométrie de l'assemblage complet."));
      } else sec.append(el("p", { class: "muted" }, "Analyse non lancée pour cet assemblage (onglet Isolation → Analyser)."));
      if (a.res.findings.length) sec.append(el("h3", { style: { marginTop: ".8rem" } }, "DFA — montage"), table(["Règle", "Niveau", "Constat"], a.res.findings.map((f) => [f.id, sevText[f.severity] || f.severity, el("span", null, el("b", null, f.title), " — ", f.message)])));
      doc.append(sec);
    }

    const phys = physicsSummary(p);
    if (phys.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Physique — modèles analytiques"),
      el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Chaque ligne est un modèle simple et reconnu, gardé pour la revue : il dit si la physique fonctionne, avant l'essai en laboratoire qui le confirme."),
      table(["Question", "Pièce", "Résultat", "Verdict"], phys.map((r) => [el("span", null, el("b", null, r.title), el("br"), el("small", { class: "muted" }, r.question)), r.partName || r.part || "—", r.result || "—",
        badge(r.verdictLabel || r.verdict, r.verdict === "ok" ? "ok" : r.verdict === "warn" ? "warn" : "danger")]))));

    if ((p.boards || []).length) {                               // electronic boards : where each one stands in its flow
      const holder = el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Cartes électroniques"), el("p", { class: "muted" }, "Vérification en cours…"));
      doc.append(holder);
      import("../pcba/summary.js").then(({ boardSummary }) => { if (!alive) return; holder.lastChild.replaceWith(table(["Carte", "Contenu", "Avancement", "Vérifications", "Gamme d'assemblage", "Revue"], boardSummary(p).map((b) => [el("a", { href: `#/pcba/${encodeURIComponent(b.id)}` }, `${b.id} — ${b.name}`), b.content, b.stage, badge(b.checks, b.errors ? "danger" : b.warns ? "warn" : "ok"), b.assembly, b.review]))); }).catch((e) => { holder.lastChild.textContent = e.message; });
    }
    const sims = simulationSummary(p);
    if (sims.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Simulations — éléments finis simplifiés"),
      el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Maillage grossier par cubes identiques. Chaque simulation est recoupée par le calcul à la main du modèle simple équivalent ; un écart de 20 % ou moins les dit concordants."),
      table(["Cas", "Cible", "Maillage", "À la main", "Simulation", "Écart", "Recoupement"], sims.map((r) => [r.kind, r.target, r.mesh, r.estimate, r.result, r.deviation, badge(r.verdictLabel, r.verdict === "ok" ? "ok" : r.verdict === "warn" ? "warn" : r.verdict === "fail" ? "danger" : "neutral")]))));

    for (const x of dfx.parts) {
      const s = x.spec, b = x.built, sum = x.res.summary || {};
      const route = b ? routing(s, b) : null, oc = b ? orderCheck(s, b, x.res, route) : null, gamme = b && !s.step ? processPlan(s, b, { route, dfx: x.res }) : null;
      const sec = el("section", { class: "card", style: { marginBottom: "1rem", breakInside: "avoid" } }, el("h2", null, `${s.id} — ${s.name || ""} `, sum.errors ? badge(`${sum.errors} à corriger`, "danger") : sum.warnings ? badge(`${sum.warnings} à vérifier`, "warn") : badge("conforme", "ok")));
      const facts = el("table", { class: "data" }, el("tbody", null, [["Fonction", s.function || "—"], ["Matériau", materialOrDefault(s.material).name], ["Procédé", (PROCESSES[s.process] || {}).fr || "—"], ["Masse", b ? fmtMass(b.mass) : "—"],
        ["Enveloppe", b ? `${fmt(b.bbox[3] - b.bbox[0], 1)} × ${fmt(b.bbox[4] - b.bbox[1], 1)} × ${fmt(b.bbox[5] - b.bbox[2], 1)} mm` : "—"], ["Révision", s.revision || "—"], ["Score DFx", typeof sum.score === "number" ? `${sum.score} / 100` : "—"],
        ["Interfaces", (b ? b.interfaces : []).map((i) => `${i.name} (${i.side})`).join(" · ") || "aucune"],
        ["Matière première", route && route.stock ? `${route.stock.label}${route.utilisation !== null ? ` — ${Math.round(route.utilisation * 100)} % utilisé` : ""}` : "non déclarée"],
        ["Fabrication", route ? `${route.steps.length} opération(s), ${route.setups.length || 1} posage(s), ${route.tools.length} outil(s)` : "—"],
        ["Gamme de fabrication", gamme ? planSummary(gamme) : "—"], ...(gamme ? gamme.phases.filter((ph) => ph.note).map((ph) => [`Note — phase ${ph.n}`, `${ph.title} : ${ph.note}`]) : []),
        ["Commande prototype", oc ? oc.label : "—"]].map(([k, v]) => el("tr", null, el("td", null, k), el("td", null, v)))));
      sec.append(el("div", { class: "two-col" }, pics.parts[s.id] ? img(pics.parts[s.id], s.id) : el("p", { class: "muted" }, "Pas d'image."), facts));
      const fl = x.res.findings.filter((f) => f.severity !== "info");
      if (fl.length) sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Constats DFM / DFx"), table(["Règle", "Niveau", "Constat"], fl.map((f) => [f.id, sevText[f.severity], el("span", null, el("b", null, f.title), " — ", f.message)])));
      if (drawings[s.id]) sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Dessin"), svgNode(drawings[s.id]));
      doc.append(sec);
    }

    const led = reviewRows(store.project), prog = reviewProgress(store.project);
    if (led.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "État de la revue, artéfact par artéfact ", badge(`${prog.ok} / ${prog.total} revus`, prog.left ? "warn" : "ok")),
      el("p", { class: "muted" }, "Un « Brouillon IA » a été écrit ou modifié par une IA et n'a pas été relu ; « Revu » engage la personne qui l'a validé. Tenu dans l'écran Revue."),
      table(["Genre", "Repère", "Nom", "Rév.", "État", "Note"], led)));
    const r = rv(), actions = r.actions || [];
    const set = (fn, label) => store.commit(`Revue : ${label}`, (x) => { x.review = x.review || { actions: [] }; x.review.actions = x.review.actions || []; fn(x.review); });
    const inp = (val, onChange, ph) => el("input", { type: "text", value: val || "", placeholder: ph, onChange: (e) => onChange(e.target.value) });
    doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Décision de la revue"),
      el("div", { class: "form-row" }, el("label", { class: "field" }, el("span", { class: "field-label" }, "Décision"), el("select", { onChange: (e) => set((x) => { x.decision = e.target.value; }, "décision") }, ["", "Approuvé", "Approuvé avec actions", "À revoir", "Refusé"].map((d) => el("option", { value: d, selected: (r.decision || "") === d }, d || "— à prendre —")))),
        el("label", { class: "field" }, el("span", { class: "field-label" }, "Date de la revue"), inp(r.date, (v) => set((x) => { x.date = v; }, "date"), "AAAA-MM-JJ")), el("label", { class: "field" }, el("span", { class: "field-label" }, "Participants"), inp(r.people, (v) => set((x) => { x.people = v; }, "participants"), "Noms, rôles"))),
      el("h3", null, "Actions"), table(["Action", "Responsable", "Échéance", "État", ""], actions.map((a, i) => [inp(a.text, (v) => set((x) => { x.actions[i].text = v; }, "action")), inp(a.owner, (v) => set((x) => { x.actions[i].owner = v; }, "responsable")), inp(a.due, (v) => set((x) => { x.actions[i].due = v; }, "échéance")),
        el("select", { onChange: (e) => set((x) => { x.actions[i].status = e.target.value; }, "état") }, ["Ouverte", "En cours", "Fermée"].map((k) => el("option", { selected: (a.status || "Ouverte") === k }, k))), btn("", () => set((x) => { x.actions.splice(i, 1); }, "action retirée"), { small: true, icon: "trash", cls: "no-print" })])),
      el("div", { class: "form-actions no-print" }, btn("Ajouter une action", () => set((x) => { x.actions.push({ text: "", owner: "", due: "", status: "Ouverte" }); }, "action ajoutée"), { small: true, icon: "plus" })),
      el("p", { class: "muted", style: { fontSize: ".8rem", marginTop: ".6rem" } }, "Signatures : ______________________ (concepteur)      ______________________ (vérificateur)      ______________________ (approbateur)")));
  }
  const off = store.on("change", (c) => { if (c && /^Revue/.test(c.label || "")) return; });
  async function saveHtml() {
    try {
      const css = await (await fetch("css/app.css")).text();
      const clone = doc.cloneNode(true);
      clone.querySelectorAll(".no-print").forEach((n) => n.remove());
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${p.name.replace(/[<>&]/g, "")} — design review</title><style>${css.replace(/url\("\.\.\/img[^)]*\)/g, "none")}</style></head><body><div class="page">${new XMLSerializer().serializeToString(clone)}</div></body></html>`;
      download(`${p.id}_design_review.html`, html, "text/html");
      toast("Rapport enregistré en un seul fichier HTML.", "success");
    } catch (e) { toast(`Enregistrement impossible : ${e.message}`, "error"); }
  }
  return () => { alive = false; off(); };
}

registerModule({ key: "report", label: "Rapport", icon: "report", tip: "Dossier de design review : images, BOM, interfaces, isolation, DFx, dessins, décisions", render });
