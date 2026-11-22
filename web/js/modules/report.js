/* DynamiteOrbit — Rapport: the design-review file of the project, built from the live model — pictures of the
   assembly and of each part, BOM, interface register, isolation verdicts, DFM / DFA findings, drawings, and the
   review decisions. Printable (PDF through the browser) or saved as one self-contained HTML file. */

import { productBoards, roleOf, BOARD_ROLES } from "../pcba/board_role.js";
import { assemblyHealth, HEALTH } from "../core/joint_health.js";
import { el, clear, icon, btn, badge, table, fmt, fmtMass, download, toast } from "../core/dom.js";
import { getUnits, docUnits } from "../core/units.js";
import { registerModule, setStatus, docMeta } from "../core/app.js";
import { store } from "../core/store.js";
import { Viewer } from "../core/viewer.js";
import { showBuilt } from "../core/viewport.js";
import { buildAssembly, showAssembly } from "../core/asm_scene.js";
import { projectDfx } from "./dfx.js";
import { busyVeil } from "../core/busy.js";
import { kernel } from "../cad/client.js";
import { physicsSummary } from "./physics.js";
import { simulationSummary } from "../analysis/fea/summary.js";
import { routing } from "../cad/shop.js";
import { orderCheck } from "../cad/order.js";
import { labelRows, labelGuide } from "../core/labels.js";
import { lookRows, renderOf, renderLights, SCENES, SHOTS } from "../core/render_looks.js";
import { LIGHT_SETUPS } from "../core/photo_lights.js";
import { makeDrawing, svgNode } from "./drawings.js";
import { reviewRows, reviewProgress, revisionRows } from "../core/review.js";
import { mvpRows, trlReached } from "../core/mvp.js";
import { trlLevel } from "../core/trl.js";
import { teamRows } from "../core/team.js";
import { plmRows } from "../core/plm.js";
import { historyRows } from "../core/history.js";
import { ecoRows, ecoMap } from "../core/eco.js";
import { swReport } from "../sw/sw_release.js";
import { specialRows } from "../cad/special_processes.js";
import { PROCESSES, materialOrDefault, processName } from "../cad/materials.js";
import { INTERFACE_TYPES } from "../cad/interfaces.js";
import { LEVEL_LABEL } from "../analysis/cc_rules.js";
import { processPlan } from "../cad/process_plan.js";
import { assemblyPlan } from "../core/asm_plan.js";
import { mateHardware, joints, freeInterfaces } from "../core/assembly_logic.js";
import { planSummary } from "../core/plan_doc.js";
import { variantRows, partOut } from "../core/variant_out.js";
import { BRAND, BRAND_LINE, FOOT_NOTE, logoSvg } from "../core/brand.js";
import { blocksOf } from "../core/dom_doc.js";
import { pdfDoc } from "../core/pdfdoc.js";
import { docx } from "../core/docx.js";

const sevText = { error: "À corriger", warn: "À vérifier", info: "Conseil" };
const img = (src, alt) => el("img", { src, alt, style: { width: "100%", height: "auto", border: "1.4px solid rgba(38,50,63,.25)", borderRadius: "10px", background: "#fff" } });

async function pictures(dfx, onProgress) {
  const host = el("div", { style: { position: "fixed", left: "-3000px", top: "0", width: "900px", height: "600px" } });
  document.body.append(host);
  const v = new Viewer(host, {}), out = { parts: {}, asms: {} };
  try {
    const todo = dfx.parts.filter((p) => p.built && p.built.bodies.length).length + dfx.asms.filter((a) => a.ctx).length; let n = 0;
    for (const p of dfx.parts) {
      if (!p.built || !p.built.bodies.length) continue;
      onProgress(`Image ${n + 1} / ${todo} : ${p.spec.id}`, n, todo); n++; await new Promise((r) => setTimeout(r));      // a breath between two pictures : the veil is drawn, a click on « Annuler » is heard
      v.clear(); showBuilt(v, p.built, { prefix: "p" }); v.view("iso");
      out.parts[p.spec.id] = v.snapshotJpeg(0.86);
    }
    for (const a of dfx.asms) {
      if (!a.ctx) continue;
      onProgress(`Image ${n + 1} / ${todo} : ${a.asm.id}`, n, todo); n++; await new Promise((r) => setTimeout(r));
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
    btn("PDF", (e, b) => saveDoc(b, "pdf"), { icon: "pdf", primary: true, tip: "Le dossier en PDF, au gabarit des documents : cartouche d'en-tête, approbation, journal des révisions, sommaire, note de confidentialité" }),
    btn("Word", (e, b) => saveDoc(b, "docx"), { icon: "download", tip: "Le même dossier en document Word, à compléter ou à annoter" }),
    btn("Imprimer", () => window.print(), { icon: "pdf", tip: "L'impression du navigateur : la page telle qu'elle est à l'écran" }), btn("Fichier HTML autonome", () => saveHtml(), { icon: "download", tip: "Un seul fichier avec les images, à joindre à un courriel ou à un ticket" }));
  const doc = el("article", { id: "report" });
  page.append(head, doc);
  let alive = true, turn = 0;
  const veil = busyVeil(doc, "sheet-busy");      // the three steps of the report — analyses, pictures, drawings — each with its count, and a button to cancel
  async function run() {
    const mine = ++turn, live = () => alive && mine === turn;
    const stop = () => { turn++; kernel.cancel(); setStatus("Rapport annulé", ""); veil.set("Rapport annulé : rien n'est affiché.", { stopped: true, retry: run }); };
    const say = (t, done, total) => { setStatus(t, "busy"); if (live()) veil.set(t, { done, total, cancel: stop }); };
    clear(doc); doc.append(veil.node); say("Construction des pièces, des images et des analyses…");
    try {
      const dfx = await projectDfx((t, done, total) => say(`Analyses — ${t}`, done, total)); if (!live()) return;
      const pics = await pictures(dfx, (t, done, total) => { if (!live()) throw Object.assign(new Error("Rapport annulé."), { cancelled: true }); say(`Images — ${t}`, done, total); }); if (!live()) return;
      const drawings = {}, sheets = dfx.parts.filter((x) => x.built && x.built.bodies.length && !x.spec.step); let n = 0;
      for (const x of sheets) { say(`Dessins — ${n + 1} / ${sheets.length} : ${x.spec.id}`, n, sheets.length); n++; try { drawings[x.spec.id] = (await makeDrawing(x.spec.id)).svg; } catch (e) { if (e && e.cancelled) throw e; drawings[x.spec.id] = null; } if (!live()) return; }
      setStatus("Rapport à jour", "done"); veil.set("");
      build(dfx, pics, drawings);
    } catch (e) { if ((e && e.cancelled) || !live()) return; veil.set(""); clear(doc); doc.append(el("div", { class: "card" }, el("h2", null, "Le rapport n'a pas pu être construit"), el("p", { class: "form-error" }, e.message))); }
  }
  run();

  function build(dfx, pics, drawings) {
    clear(doc);
    const errs = dfx.parts.reduce((s, x) => s + ((x.res.summary || {}).errors || 0), 0), warns = dfx.parts.reduce((s, x) => s + ((x.res.summary || {}).warnings || 0), 0);
    const iso = [...store.assemblies, ...productBoards(store.project)].flatMap((a) => ((a.isolation || {}).results || []).map((r) => ({ ...r, asm: a.id }))), isoBad = iso.filter((r) => r.ok === false).length;
    const mass = dfx.asms[0] && dfx.asms[0].ctx ? dfx.asms[0].ctx.mass.mass : dfx.parts.reduce((s, x) => s + (x.built ? x.built.mass : 0), 0);
    const verdict = errs || isoBad ? ["Points bloquants à lever", "danger"] : warns ? ["Acceptable sous réserve des points à vérifier", "warn"] : ["Conforme aux règles évaluées", "ok"];
    doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } },
      el("p", { class: "muted", style: { margin: 0, display: "flex", alignItems: "center", gap: ".5rem" } }, icon("logo"), el("b", null, BRAND_LINE), ` · ${BRAND.workflow} — dossier de revue de conception`), el("h2", { style: { fontSize: "1.5rem", fontFamily: "var(--hand)", margin: ".2rem 0" } }, p.name),
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
      /* the joint register : each mated pair with its number, its kind and what holds it ; then the interfaces that look outside the product */
      const reg = joints(a.ctx.asm, a.ctx.built, Object.fromEntries(p.parts.map((x) => [x.id, x]))), linked = new Map((a.asm.mates || []).map((m) => [m.id, m.linked !== false]));
      const H = assemblyHealth(a.ctx.asm, a.ctx.built, Object.fromEntries(p.parts.map((x) => [x.id, x])), a.ctx.sol), hOf = new Map(H.rows.map((r) => [r.id, r]));
      sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Registre des joints"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, `Santé des accouplements — ${H.text}. Les interférences se cherchent dans l'écran Assemblage.`), table(["N°", "Joint", "Pièce A · interface", "Pièce B · interface", "Ce qui le tient", "Procédé", "Lien", "Santé"],
        reg.map((r) => [r.id, r.kind, r.a, r.b, r.hardware.map((h) => `${String(h.qty).replace(".", ",")}${h.unit ? ` ${h.unit}` : " ×"} ${h.name}`).join(" + ") || "—", r.process || "—", linked.get(r.id) ? "paramètres liés" : "non lié", hOf.get(r.id) ? `${HEALTH[hOf.get(r.id).state].fr}${hOf.get(r.id).notes.length ? ` — ${hOf.get(r.id).notes.join(" ")}` : ""}` : "—"])));
      const outer = freeInterfaces(a.ctx.asm, a.ctx.built).filter((f) => f.external);
      if (outer.length) sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Interfaces externes — le contrat avec l'extérieur du produit"), table(["Pièce", "Interface", "Type", "Vers"], outer.map((f) => [f.part, f.iface.name || f.iface.id, INTERFACE_TYPES[f.iface.type].label, f.iface.partner || "—"])));
      const gamme = assemblyPlan(a.asm, p, { hardwareOf: (m) => mateHardware(a.ctx.asm, a.ctx.built, m), mass: a.ctx.mass.mass });
      sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Gamme d'assemblage"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, planSummary(gamme)),
        table(["N°", "Étape", "Opérations", "Outillage", "Note de discussion"], gamme.phases.map((ph) => [String(ph.n), ph.title, ph.ops.map((o) => o.text).join(" ; ") || ph.checks.join(" ; "), ph.tools.join(" ; ") || "—", ph.note || "—"])));
      const lab = labelRows(a.asm.labels, Object.fromEntries(a.ctx.asm.instances.map((i) => [i.id, (store.part(i.part) || {}).name || i.part]))), labAsk = labelGuide(a.asm.labels, a.ctx.asm.instances.map((i) => i.id)).filter((x) => x.level !== "tip");
      if (lab.length) sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Étiquettes, autocollants et marquages"), table(["Repère", "Nom", "Genre", "Motif", "Sur", "Surface", "Taille (mm)", "Aire (cm²)"], lab.map((r) => [r.id, r.name, r.kind, r.art, r.on, r.surface, `${fmt(r.w, 0)} × ${fmt(r.h, 0)}`, fmt(r.area, 1)])),
        ...(labAsk.length ? [el("p", { class: "muted", style: { fontSize: ".84rem" } }, labAsk.map((x) => x.text).join(" "))] : []));
      const fin = a.asm.render ? lookRows({ ...a.asm, instances: a.ctx.asm.instances }, a.ctx.built, Object.fromEntries(a.ctx.asm.instances.map((i) => [i.part, (store.part(i.part) || {}).name || i.part]))).filter((r) => r.chosen) : [], rd = renderOf(a.asm);
      if (fin.length) sec.append(el("h3", { style: { marginTop: ".8rem" } }, "Studio photo — finitions choisies"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, `Décor : ${(SCENES[rd.scene] || SCENES.studio).fr.toLowerCase()} ; éclairage : ${renderLights(rd).own ? "lumières placées à la main" : LIGHT_SETUPS[renderLights(rd).setup].label} ; point de vue : ${rd.view ? "réglé à la souris" : (SHOTS[rd.shot] || SHOTS.hero).fr.toLowerCase()}. Réglages d'image, pas des finitions d'atelier.`),
        table(["Référence", "Pièce", "Finition", "Couleur"], fin.map((r) => [r.part, r.name, r.label, r.color])));
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
      import("../pcba/summary.js").then(({ boardSummary }) => { if (!alive) return; holder.lastChild.replaceWith(table(["Carte", "Contenu", "Avancement", "Vérifications", "Gamme d'assemblage", "Labo — plan de test", "Revue"], boardSummary(p).filter((b) => roleOf(p.boards.find((x) => x.id === b.id)) === "product").map((b) => [el("a", { href: `#/pcba/${encodeURIComponent(b.id)}` }, `${b.id} — ${b.name}`), b.content, b.stage, badge(b.checks, b.errors ? "danger" : b.warns ? "warn" : "ok"), b.assembly, el("a", { href: `#/elab/${encodeURIComponent(b.id)}` }, b.lab), b.review]))); }).catch((e) => { holder.lastChild.textContent = e.message; });
      const tools = (p.boards || []).filter((b) => roleOf(b) === "bench"); if (tools.length) holder.append(el("p", { class: "muted", "data-bench-boards": "" }, `Cartes de banc d'essai — des outils du laboratoire, hors du produit, de son assemblage et de son isolation : ${tools.map((b) => `${b.id}${b.name ? ` (${b.name})` : ""}`).join(", ")}.`));
      for (const b of productBoards(p)) { const R = (b.isolation || {}).results || []; if (!R.length) continue; const P = { level: "functional", ...((b.isolation || {}).params || {}) };      // a board analysed alone : its real copper, by potential
        holder.append(el("h3", { style: { marginTop: ".8rem" } }, `Isolation de la carte seule — ${b.id}`), el("p", { class: "muted", style: { fontSize: ".84rem" } }, `Pollution degree ${P.pollution_degree ?? 2} · altitude ${P.altitude_m ?? 2000} m · OVC ${P.ovc || "II"} · analysé le ${new Date(R[0].when).toLocaleString("fr-CA")}`),
          table(["Potentiels", "Au plus court", "Tension", "Niveau", "Clr requise", "Clr mesurée", "Crp requis", "Crp mesuré", "Verdict"], R.map((r) => [`${r.a} ↔ ${r.b}`, r.nets ? `${r.nets[0] || "?"} ↔ ${r.nets[1] || "?"}` : "—", `${fmt(r.u, 0)} V`, LEVEL_LABEL[r.level] || r.level, fmt(r.clrReq, 2), r.clr === null ? "> plafond" : fmt(r.clr, 2), r.crpReq === null ? "—" : fmt(r.crpReq, 2), r.crp === null ? "—" : fmt(r.crp, 2), r.ok === false ? badge("NON", "danger") : r.ok ? badge("OK", "ok") : badge("?", "warn")])),
          el("p", { class: "muted", style: { fontSize: ".78rem" } }, "Distances en mm, mesurées sur le cuivre des deux couches externes de la carte nue, les nets regroupés par tension. Les couches internes et les corps des composants ne sont pas mesurés.")); }
    }
    const sims = simulationSummary(p);
    if (sims.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Simulations — éléments finis simplifiés"),
      el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Maillage grossier par cubes identiques. Chaque simulation est recoupée par le calcul à la main du modèle simple équivalent ; un écart de 20 % ou moins les dit concordants."),
      table(["Cas", "Cible", "Maillage", "À la main", "Simulation", "Écart", "Recoupement"], sims.map((r) => [r.kind, r.target, r.mesh, r.estimate, r.instruments ? el("span", null, r.result, el("small", { class: "muted", style: { display: "block" } }, `Instruments : ${r.instruments}`)) : r.result, r.deviation, badge(r.verdictLabel, r.verdict === "ok" ? "ok" : r.verdict === "warn" ? "warn" : r.verdict === "fail" ? "danger" : "neutral")]))));

    for (const x of dfx.parts) {
      const s = x.spec, b = x.built, sum = x.res.summary || {};
      const route = b ? routing(s, b) : null, oc = b ? orderCheck(s, b, x.res, route) : null, gamme = b && !s.step ? processPlan(s, b, { route, dfx: x.res }) : null;
      const sec = el("section", { class: "card", style: { marginBottom: "1rem", breakInside: "avoid" } }, el("h2", null, `${s.id} — ${s.name || ""} `, sum.errors ? badge(`${sum.errors} à corriger`, "danger") : sum.warnings ? badge(`${sum.warnings} à vérifier`, "warn") : badge("conforme", "ok")));
      const facts = el("table", { class: "data" }, el("tbody", null, [["Fonction", s.function || "—"], ["Matériau", materialOrDefault(s.material).name], ["Procédé", processName(s.process) || "—"], ["Masse", b ? fmtMass(b.mass) : "—"],
        ["Enveloppe", b ? `${fmt(b.bbox[3] - b.bbox[0], 1)} × ${fmt(b.bbox[4] - b.bbox[1], 1)} × ${fmt(b.bbox[5] - b.bbox[2], 1)} mm` : "—"], ["Révision", s.revision || "—"], ...((s.variants || []).length ? [["Variante montrée", partOut(s).variant || "état sans nom"]] : []), ["Score DFx", typeof sum.score === "number" ? `${sum.score} / 100` : "—"],
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
    const revs = revisionRows(store.project);
    if (revs.length && store.assemblies.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Révisions et cas d'emploi"),
      el("p", { class: "muted" }, "Chaque pièce avec sa révision, les assemblages qui l'emploient, et la révision de la pièce avec laquelle chacun a été revu. Un assemblage revu avec une révision dépassée est à revalider : il prendra alors sa propre révision suivante. Les dessins portent toujours la révision de ce qu'ils dessinent."),
      table(["Pièce", "Nom", "Rév.", "État", "Employée dans"], revs)));
    const fam = variantRows(store.project);
    if (fam.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Variantes"),
      el("p", { class: "muted" }, "Une pièce ou un assemblage peut garder ses cousines sous un nom. Ce dossier montre chaque document dans la variante où il est en ce moment — images, analyses, masse, dessins et gammes sont ceux de cette variante ; les autres sont listées avec ce qu'elles changent. Pour revoir une autre variante : passez-y d'un clic dans le document, puis relancez le dossier. Le numéro et la révision sont ceux du document."),
      table(["Genre", "Repère", "Nom", "Variante montrée", "Autres variantes gardées"], fam.map((r) => [r.kind === "part" ? "Pièce" : "Assemblage", el("code", null, r.id), r.name, r.now || "état sans nom", r.variants.filter((v) => !v.on).map((v) => `${v.name} (${v.diff.join(" · ") || "comme le document"})`).join(" ; ") || "—"]))));
    const spe = specialRows(store.parts);
    if (spe.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Procédés spéciaux"),
      el("p", { class: "muted" }, "Les pièces découpées au laser, pliées ou imprimées : le laser ou le procédé de leur matière, ce qu'il demande au dessin, et ce qui se contrôle — l'état du bord coupé, la suite après impression. Valeurs typiques de guides publiés : le fournisseur et la fiche de la matière font foi (Atelier → Procédés spéciaux)."),
      table(["Pièce", "Nom", "Procédé", "Matière", "Laser · norme", "Ce que le procédé demande", "À contrôler · après"], spe)));
    const rel = plmRows(store.project);
    if (rel.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Révisions gelées et libérées"),
      el("p", { class: "muted" }, "Geler fige une révision ; sa revue de conception, par quelqu'un d'autre que son auteur, la libère ou la refuse. Forme, ajustement et fonction conservés : la révision suivante du même numéro. Rompus : un nouveau numéro, avec celui dont il dérive. Un assemblage est gelé avec la révision de chacune de ses pièces, et ne se libère qu'une fois chacune libérée. Tenu dans l'écran Révisions."),
      table(["Numéro", "Rév.", "Nom", "État", "Approuvée par", "Gelée le", "Dérive de", "Forme · ajustement · fonction", "Gelée avec"], rel)));
    if (store.project.team && store.project.team.owner) { const tr = teamRows(store.project);
      doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Équipe et messages ", badge(tr.conflicts ? `${tr.conflicts} conflit(s) à trancher` : "aucun conflit", tr.conflicts ? "warn" : "ok")),
        el("p", { class: "muted" }, `Miroir de @${store.project.team.owner}. Chaque membre garde le projet entier chez lui ; les miroirs se fusionnent par artéfact. Tenu dans l'écran Équipe.`),
        table(["Membre", "Depuis", "Son miroir, lu le", "Messages"], tr.members), tr.open.length ? table(["Date", "De", "Sujet", "Message encore ouvert"], tr.open) : el("p", { class: "muted" }, "Aucun message ouvert.")));
    }
    const hist = historyRows(store.project);
    if (hist.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Historique de conception"),
      el("p", { class: "muted" }, "Chaque point garde la définition complète du produit à un moment ; revenir à un point puis continuer ouvre une branche. Un point se pose à la main, ou tout seul après une réponse d'IA appliquée. Tenu dans l'écran Historique."),
      table(["Point", "Posé le", "Genre", "Nom", "Après", "Itération MVP", "Révisions", "Branche"], hist)));
    for (const w of swReport(store.project)) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, `Logiciel — ${w.name} `, badge(w.ready ? "prêt à livrer" : `${w.left.length} point${w.left.length > 1 ? "s" : ""} avant la livraison`, w.ready ? "ok" : "warn")),
      el("p", { class: "muted" }, `Référence : ${w.std}. Chaque exigence, comment elle se prouve, les essais qui la prouvent — rejoués sur le modèle à la construction de ce rapport. La couverture structurelle du C compilé n'est pas mesurée ici, et rien ici ne rend un logiciel conforme. Tenu dans le groupe Logiciel (cycle en V).`),
      w.left.length ? el("ul", null, w.left.map((t) => el("li", null, t))) : null, table(["Exigence", "Genre", "Texte", "Preuve", "Essais", "État"], w.rows)));
    const own = ecoRows(store.project), eco = ecoMap(store.project);
    if (own.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Cadre de conception — règles du projet"),
      el("p", { class: "muted" }, `Ce que le projet impose et que l'outil ne vérifie pas ; une règle à Off est gardée mais ne part pas vers une IA. Le produit compte ${eco.nodes.length} artéfacts reliés par ${eco.edges.length} liens de dépendance. Tenu dans l'écran Écosystème.`),
      table(["Règle", "Texte", "État"], own)));
    const iters = mvpRows(store.project);
    if (iters.length) doc.append(el("section", { class: "card", style: { marginBottom: "1rem" } }, el("h2", null, "Itérations MVP ", badge(trlReached(store.project) ? `TRL ${trlReached(store.project)} atteint` : "aucun niveau atteint", trlReached(store.project) ? "ok" : "neutral")),
      el("p", { class: "muted" }, `Cible du projet : TRL ${(store.project.mvp || {}).target || 6}. Chaque itération est gelée, passée en revue puis close par une décision ; la convergence est la part de ce qui a bougé depuis l'itération gelée précédente. Tenu dans l'écran Itérations MVP.`),
      ...[trlLevel((store.project.mvp || {}).target || 6)].filter(Boolean).map((t) => el("p", { class: "small" }, el("b", null, `TRL ${t.n} — ${t.short}. `), `Définition officielle — NASA : « ${t.nasa} » ; Commission européenne (Horizon 2020, annexe G) : « ${t.ec} ». Preuve attendue : ${t.exitFr}`)),
      table(["Itération", "Objectif", "Niveau visé", "Revue de passage", "Gelée le", "Revues", "Convergence", "Décision"], iters)));
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
  /* the file as a document of the house : what the screen shows, read block by block (core/dom_doc.js) */
  async function saveDoc(b, kind) {
    b.disabled = true;
    try {
      const blocks = blocksOf(doc, { figure: 118 }).filter((x, i) => !(i === 0 && x.type === "p")), r = rv(), led = store.project.review || {};
      const model = { title: "Dossier de revue de conception", subtitle: p.name || p.id, kind: "Rapport de revue de conception", subject: "Revue de conception", reference: `${p.id}-REVUE`, revision: led.rev || "A", author: p.author || "", date: new Date(), header: `${p.name || p.id} — revue de conception`,
        blocks: [{ type: "toc" }, ...blocks, { type: "h1", text: "Signatures" }, { type: "signatures", roles: ["Concepteur", "Vérificateur", "Approbateur"] }], ...docMeta() };
      if (r.date || r.decision) model.revisions = [{ rev: model.revision, reason: r.decision ? `Revue : ${r.decision}` : "Revue de conception", sections: "Toutes", by: p.author || "", date: r.date || new Date().toISOString().slice(0, 10) }];
      const shown = docUnits(model, getUnits(), { si: /^(?:Physique — modèles analytiques|Simulations — éléments finis|Isolation — creepage)/ });      // the file reads in the units chosen, as the screens do — its calculations stay in SI
      if (kind === "pdf") download(`${p.id}_revue_de_conception.pdf`, pdfDoc(shown), "application/pdf"); else download(`${p.id}_revue_de_conception.docx`, docx(shown), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      toast(kind === "pdf" ? "Dossier enregistré en PDF." : "Dossier enregistré en Word.", "success");
    } catch (e) { console.error(e); toast(`Dossier ${kind === "pdf" ? "PDF" : "Word"} : ${e.message}`, "error", 7000); }
    b.disabled = false;
  }
  async function saveHtml() {
    try {
      const css = await (await fetch("css/app.css")).text();
      const clone = doc.cloneNode(true);
      clone.querySelectorAll(".no-print").forEach((n) => n.remove());
      clone.querySelectorAll("svg.sk-icon").forEach((n) => { if ((n.querySelector("use") || { getAttribute: () => "" }).getAttribute("href").endsWith("#i-logo")) n.outerHTML = logoSvg(22); });      // the sprite does not travel with the file : the mark is drawn in it
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${p.name.replace(/[<>&]/g, "")} — design review</title><style>${css.replace(/url\("\.\.\/img[^)]*\)/g, "none")}</style></head><body><div class="page">${new XMLSerializer().serializeToString(clone)}<p class="muted" style="margin-top:2rem;padding-top:.6rem;border-top:1px solid #9aa5b4;font-size:.78rem">${FOOT_NOTE}</p></div></body></html>`;
      download(`${p.id}_design_review.html`, html, "text/html");
      toast("Rapport enregistré en un seul fichier HTML.", "success");
    } catch (e) { toast(`Enregistrement impossible : ${e.message}`, "error"); }
  }
  return () => { alive = false; off(); veil.dispose(); };
}

registerModule({ key: "report", label: "Rapport", icon: "report", tip: "Dossier de design review : images, BOM, interfaces, isolation, DFx, dessins, décisions", render });
