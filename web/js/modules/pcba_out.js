/* DesignWizard.ai — PCBA screen: the output steps — checks, fabrication package, design review — and the views a user
   of a classic ECAD tool looks for : schematic, stack-up, rules, net classes, bill of materials. The same data as the
   natural flow, seen the classic way. */

import { el, icon, btn, badge, field, table, toast, download, fmt, modal, svg } from "../core/dom.js";
import { store } from "../core/store.js";
import { session } from "../core/access.js";
import { CLASSES, FAB, boardBom, resolveBoard } from "../pcba/model.js";
import { LIBRARY } from "../pcba/library.js";
import { BLOCKS } from "../pcba/blocks.js";
import { rebuildBlock, functionCsv, functionOutline } from "../pcba/synth.js";
import { ERC_RULES } from "../pcba/erc.js";
import { PCBA_BOOK, fixHints } from "../pcba/drc_rules.js";
import { fabPackage, fabZip, stackup } from "../pcba/fabfiles.js";
import { reviewData } from "../pcba/review_data.js";
import { reviewDoc, reviewVerdict, REVIEW_KINDS } from "../pcba/review.js";
import { docx } from "../core/docx.js";
import { pdfDoc } from "../core/pdfdoc.js";
import { twinPart } from "../pcba/twin.js";
import { NET_CONVENTION } from "../pcba/netnames.js";
import { toDwiz } from "../core/dwiz.js";
import { dwizFileName } from "../core/dwiz_names.js";
import { boardView, layerList, LAYER_STYLE, DRAW_ORDER } from "./pcba_view.js";
import { ui$ } from "./pcba_steps.js";
import { openAiLoopFor } from "./ai_loop.js";
import { boardAssemblyPlan } from "../pcba/assembly_plan.js";
import { followMoves, pruneCopper } from "../pcba/move.js";
import { functionalStructure, structureCsv, structureDiagram, treeDiagram } from "../pcba/structure.js";
import { drawio } from "../core/drawio.js";
import { draftsOf } from "../core/ai_draft.js";
import { autoroute } from "../pcba/route.js";
import { planPanel, setPlanNote, setPlanPoints } from "./plan_view.js";

const { txt, sel, section, scroll, hint } = ui$;
const pane = (view, title, sub, ...kids) => { const p = el("div", { class: "pcba-pane" }, el("div", { class: "pcba-pane-head" }, el("h2", null, title), sub ? el("span", { class: "muted small" }, sub) : null), el("div", { class: "pcba-scroll" }, ...kids)); view.append(p); return p; };
const finding = (f, onClick) => el("div", { class: "finding", onClick, style: { cursor: onClick ? "pointer" : null } }, el("span", { class: `sev ${f.severity}` }), el("div", null, el("b", null, `${f.rule} · ${f.title}`), el("p", { class: "small" }, f.message), fixHints(f) ? el("p", { class: "muted small" }, `→ ${fixHints(f)}`) : null));

/** What an AI needs to know to edit a board. */
export const boardAiHelp = () => [`Blocs disponibles (block <repère> <gabarit>, puis params) : ${Object.keys(BLOCKS).join(", ")}. Changer les « params » d'un bloc suffit : ses composants et ses nets seront reconstruits.`,
  "Un composant : part <repère> <composant de la bibliothèque> value=… at=[x, y] rot=0|90|180|270. Pour déplacer un composant ou un bloc, change seulement « at » (et « rot ») : ne touche pas aux lignes « track » et « via », l'outil fait suivre les pistes et refait les liaisons. Un net : net <NOM> class=signal|power|ground|hv pins=[U1.3, C2.1].", "Noms de nets en majuscules : rails +5V, +3V3 ; masses GND ; signaux FONCTION_SIGNAL."];
/** Completes an answer : blocks whose parameters changed are built again so parts and nets follow ; says what the checks find. */
export function boardAiCheck(board, doc) {
  try {
    const before = new Map(board.blocks.map((b) => [b.id, JSON.stringify(b.params)]));
    for (const b of doc.blocks || []) if (BLOCKS[b.template] && before.has(b.id) && before.get(b.id) !== JSON.stringify(b.params)) rebuildBlock(doc, b.id, b.params);
    const R = resolveBoard(doc, LIBRARY);
    if (R.problems.length) return R.problems.map((t) => ({ severity: "block", text: t }));
    const f = followMoves(board, doc, LIBRARY), notes = [];      // parts moved in the answer : their copper follows, their links are laid again
    if (f.moved.length) { const r = f.nets.length ? autoroute(doc, LIBRARY, { nets: f.nets, keep: true, maxMs: 8000, passes: 1 }) : { routed: 0, open: 0 }; pruneCopper(doc, LIBRARY, f.nets);
      notes.push({ severity: r.open ? "warn" : "info", text: `${f.moved.length} composant(s) déplacé(s) (${f.moved.slice(0, 6).join(", ")}${f.moved.length > 6 ? "…" : ""}) : leurs pistes ont suivi, ${r.routed} liaison(s) refaite(s)${r.open ? ` ; ${r.open} restent à router` : ""}.` }); }
    return [...notes, { severity: "info", text: "Après application : relancez le placement et le routage si des composants ont été ajoutés, puis les vérifications." }];
  } catch (e) { return [{ severity: "block", text: `Réponse incohérente : ${e.message}` }]; }
}
export const boardAiLoop = (ctx) => openAiLoopFor(`board:${ctx.board.id}`);

/* ---------- 5. checks ---------- */
function verifs(ctx, { left, view, right }) {
  const { board, R, ui, drc, erc } = ctx, all = [...erc.findings, ...drc.findings], st = drc.stats, v = boardView(view);
  const scene = () => ({ R, art: ctx.art, board, layers: ui.layers, findings: drc.findings, focus: ui.focus, onPick: (h) => { ui.net = h.net || null; v.show(scene()); } });
  v.show(scene()); if (ui.focus && ui.focus.at) v.focus(ui.focus.at);
  const l = scroll(left, el("div", { class: "side-head" }, el("h2", null, "Vérifications"), badge(drc.summary.error + erc.summary.error ? `${drc.summary.error + erc.summary.error} erreur(s)` : "aucune erreur", drc.summary.error + erc.summary.error ? "danger" : "ok")));
  l.append(el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, st.minTrack === null ? "—" : `${fmt(st.minTrack)} mm`), el("span", null, "plus petite piste")), el("div", { class: "kpi" }, el("b", null, st.minSpace === null ? "—" : `${fmt(Math.min(st.minSpace, 9.99))} mm`), el("span", null, "plus petit isolement")),
    el("div", { class: "kpi" }, el("b", null, st.minDrill === null ? "—" : `${fmt(st.minDrill)} mm`), el("span", null, "plus petit perçage")), el("div", { class: "kpi" }, el("b", null, `${Math.round(100 * st.probe)} %`), el("span", null, "nets accessibles au test"))));
  l.append(el("p", { class: "muted small" }, `Classe de fabrication : ${(FAB[(board.rules || {}).fab || "standard"] || FAB.standard).label}. ${st.checked} couples de cuivres mesurés.`),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Livre de règles", () => modal("Règles de conception d'une carte assemblée", el("div", null, ...PCBA_BOOK.map((g) => el("div", null, el("h3", null, g.category), el("ul", { class: "small" }, g.steps.map((s) => el("li", null, s))), table(["Règle", "Limite", "Pourquoi"], g.rules.map((r) => [`${r.id} ${r.title}`, r.limit, r.why])))),
      el("h3", null, "Contrôle électrique"), table(["Règle", "Pourquoi"], ERC_RULES.map((r) => [`${r.id} ${r.title}`, r.why]))), { xl: true }), { icon: "library", small: true })),
    section("Couches", layerList(ctx.art, ui.layers, () => v.show(scene()))));
  const r = scroll(right, el("div", { class: "side-head" }, el("h2", null, `Constats (${all.length})`)));
  if (!all.length) r.append(el("p", { class: "muted" }, "Rien à signaler."));
  for (const sev of ["error", "warn", "info"]) { const list = all.filter((f) => f.severity === sev); if (list.length) r.append(section({ error: "Erreurs", warn: "Avertissements", info: "Remarques" }[sev], ...list.map((f) => finding(f, f.at ? () => { ui.focus = f; v.show(scene()); v.focus(f.at); } : null)))); }
  return () => v.destroy();
}

/* ---------- 6. fabrication ---------- */
function fabrication(ctx, { left, view, right }) {
  const { board, R, ui } = ctx, pk = fabPackage(board, ctx.lib, { date: new Date() }), ready = ctx.flow.steps.find((s) => s.key === "verifs").state === "done", n = R.layers.length, coat = board.board.coating && board.board.coating.type !== "none";
  const days = [n >= 4 ? 5 : 3, n >= 4 ? 8 : 5], asm = [3, 5], total = [days[0] + asm[0] + (coat ? 1 : 0), days[1] + asm[1] + (coat ? 2 : 0)];
  const l = scroll(left, el("div", { class: "side-head" }, el("h2", null, "Dossier de fabrication"), badge(ready ? "prêt à envoyer" : "à vérifier d'abord", ready ? "ok" : "warn")));
  if (!ready) l.append(hint("Les vérifications signalent encore des erreurs : le dossier se génère, mais ne l'envoyez pas tel quel.", "warn"));
  l.append(el("div", { class: "order-card" }, el("b", null, `${total[0]} à ${total[1]} jours ouvrables`), el("p", { class: "small" }, `Carte nue ${n} couches : ${days[0]} à ${days[1]} j. Assemblage de ${pk.stats.parts} composants : ${asm[0]} à ${asm[1]} j.${coat ? " Vernis : 1 à 2 j." : ""} Ordres de grandeur d'un atelier de prototypage rapide ; son devis fait foi.`)),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, btn("Télécharger le dossier (.zip)", () => download(`${board.id}-rev${board.revision || "A"}-fabrication.zip`, fabZip(board, ctx.lib, { date: new Date() }), "application/zip"), { primary: true, icon: "download" }),
      session.fs && store.mode === "drive" ? btn("Ranger dans Drive", async () => { try { await session.fs.saveOrder(store.project, { name: `${board.id}-rev${board.revision || "A"}-fabrication.zip`, bytes: fabZip(board, ctx.lib, { date: new Date() }), rfq: pk.files.find((f) => f.key === "notes").text }, { partId: board.id, quantity: 5 }); toast("Dossier rangé dans Drive, sous 05_Commandes.", "success"); } catch (e) { toast(e.message, "error"); } }, { icon: "cloud" }) : null,
      btn("Jumeau mécanique", () => { const ex = board.part ? store.part(board.part) : null, tw = twinPart(board, ctx.lib, ex); if (ex) store.updatePart(ex.id, (s) => { s.pcb = tw.pcb; }, `${ex.id} : composants repris de ${board.id}`); else { const id = store.addPart(tw); ctx.update((b) => { b.part = id; }); } toast(`Composants et nets reportés sur la pièce ${ex ? ex.id : tw.id} : la carte apparaît telle quelle dans l'assemblage.`, "success"); }, { icon: "pcb", tip: "Reporte les composants (encombrements, hauteurs) et les nets sur la pièce mécanique de la carte" })));
  l.append(section(`Fichiers (${pk.files.length})`, ...pk.files.map((f) => el("div", { class: "artifact-row" }, el("span", { class: "grow" }, el("b", null, f.label), el("small", { class: "muted", style: { display: "block" } }, f.name)), btn("", () => download(f.name, f.text, f.mime), { small: true, icon: "download", tip: "Télécharger ce fichier" })))));
  const v = boardView(view), on = new Set(["top", "mask_top", "silk_top", "outline"]);
  const show = () => v.show({ R, art: pk.art, board, layers: on });
  show();
  l.append(section("Aperçu des couches", layerList(pk.art, on, show)));
  /* right : the assembly routing to talk with the assembler, or the fabrication notes */
  const tab = ui.fabTab === "notes" ? "notes" : "gamme", r = scroll(right, el("div", { class: "side-head" }, el("h2", null, tab === "notes" ? "Notes de fabrication" : "Gamme d'assemblage")),
    el("div", { class: "subtabs" }, [["gamme", "Gamme"], ["notes", "Notes"]].map(([k, t]) => el("button", { class: `subtab${tab === k ? " active" : ""}`, type: "button", onClick: () => { ui.fabTab = k; ctx.redraw(); } }, t))));
  if (tab === "notes") r.append(el("pre", { class: "pcba-notes" }, pk.files.find((f) => f.key === "notes").text));
  else planPanel(r, boardAssemblyPlan(board, ctx.lib), { aiKey: `board:${board.id}`,
    onNote: (key, text) => ctx.update((b) => setPlanNote(b, key, text), `${board.id} : note de gamme`), onPoints: (list) => ctx.update((b) => setPlanPoints(b, list), `${board.id} : points à discuter`),
    figures: async () => { const sides = pk.stats.sides.length ? pk.stats.sides : ["top"], out = []; for (const sd of sides) out.push(await pngOf(figureOf(ctx, ["outline", `fab_${sd}`, `silk_${sd}`], `Plan d'équipement, ${sd === "top" ? "dessus" : "dessous"}`))); return out; } });
  return () => v.destroy();
}

/* ---------- 7. design review ---------- */
/** A view of the board as a figure : drawn as vectors in the PDF, as a picture in the Word file. */
function figureOf(ctx, layers, caption, zones) {
  const { R, art, board } = ctx, w = Math.min(150, R.w * 1.6), h = w * R.h / R.w;
  const draw = (sheet, x, y, fw, fh) => {
    const k = Math.min(fw / R.w, fh / R.h), X = (px) => x + (px - R.bbox[0]) * k, Y = (py) => y + (R.bbox[3] - py) * k, P = (pts) => pts.map((p) => [X(p[0]), Y(p[1])]);
    sheet.polyline(P(R.outline), { close: true, fill: "#f4f1e8", color: "#20242a", w: 0.3 });
    for (const key of DRAW_ORDER) { if (!layers.includes(key)) continue; const col = (LAYER_STYLE[key] || ["#666"])[0];
      for (const p of art.layers[key] || []) { if (p.clear) continue;
        if (p.t === "pad") sheet.rect(X(p.x - p.w / 2), Y(p.y + p.h / 2), p.w * k, p.h * k, { fill: col, color: null }); else if (p.t === "circle") sheet.circle(X(p.x), Y(p.y), p.d * k / 2, { fill: col, color: null });
        else if (p.t === "track") { if (p.pts.length > 1) sheet.polyline(P(p.pts), { color: col, w: Math.max(0.05, p.w * k), cap: "round" }); } else if (p.t === "region" && !key.startsWith("coat")) sheet.polyline(P(p.pts), { close: true, fill: col, color: null, opacity: 0.25 }); } }
    if (zones) for (const b of board.blocks) if (Array.isArray(b.zone)) { sheet.rect(X(b.zone[0]), Y(b.zone[1] + b.zone[3]), b.zone[2] * k, b.zone[3] * k, { color: "#0c66e4", w: 0.25, fill: "#0c66e4", opacity: 0.12 }); sheet.text(X(b.zone[0]) + 0.8, Y(b.zone[1] + b.zone[3]) + 0.8, `${b.id} ${b.name}`.slice(0, Math.max(4, Math.floor(b.zone[2] * k / 1.5))), { size: 2.2, baseline: "top", color: "#0c3f8a" }); }
    for (const hh of R.holes) sheet.circle(X(hh.x), Y(hh.y), hh.d * k / 2, { color: "#20242a", w: 0.2, fill: "#ffffff" });
  };
  return { draw, width: w, height: h, caption };
}
/** Rasterises a figure for the Word file (the PDF keeps the vectors). */
async function pngOf(fig) {
  const { SvgSheet } = await import("../draw/svg.js"), sheet = new SvgSheet({ width: fig.width, height: fig.height, background: "#ffffff" });
  fig.draw(sheet, 0, 0, fig.width, fig.height);
  const markup = sheet.toString ? sheet.toString() : sheet.toSvg(), img = new Image(), px = [Math.round(fig.width * 8), Math.round(fig.height * 8)];
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error("image de la figure illisible")); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`; });
  const c = document.createElement("canvas"); c.width = px[0]; c.height = px[1]; c.getContext("2d").drawImage(img, 0, 0, px[0], px[1]);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
  return { ...fig, png: new Uint8Array(await blob.arrayBuffer()), pngSize: px };
}
function revue(ctx, { left, view, right }) {
  const { board, ui } = ctx, kind = ui.kind, K = REVIEW_KINDS[kind], rv = board.review || {};
  const figures = { floorplan: figureOf(ctx, ["outline", "fab_top"], "Implantation conceptuelle : une zone par bloc", true), top: figureOf(ctx, ["top", "silk_top", "outline"], "Cuivre et sérigraphie, dessus"), bottom: figureOf(ctx, ["bottom", "outline"], "Cuivre, dessous") };
  const data = () => reviewData(board, ctx.lib, { kind, date: new Date(), project: { id: store.project.id, name: store.project.name }, figures }), d = data(), V = reviewVerdict(d), doc = reviewDoc(d), name = `${board.id}-rev${board.revision || "A"}-${K.short}`;
  const setR = (fn, label) => ctx.update((b) => { b.review = b.review || {}; fn(b.review); }, label || "Revue modifiée");
  const l = scroll(left, el("div", { class: "side-head" }, el("h2", null, "Revue de conception")));
  l.append(el("div", { class: "subtabs" }, ...Object.entries(REVIEW_KINDS).map(([k, x]) => el("button", { type: "button", class: `subtab${k === kind ? " active" : ""}`, onClick: () => { ui.kind = k; ctx.redraw(); } }, k === "PDR" ? "Préliminaire" : "Détaillée"))), el("p", { class: "muted small" }, K.text),
    field("Rédacteur", txt(rv.author, (v) => setR((r) => { r.author = v; }))), field("Points ouverts (un par ligne)", el("textarea", { rows: 3, style: { width: "100%" }, onChange: (e) => setR((r) => { r.open = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); }) }, (rv.open || []).join("\n"))),
    field("Décisions (une par ligne)", el("textarea", { rows: 3, style: { width: "100%" }, onChange: (e) => setR((r) => { r.decisions = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); }) }, (rv.decisions || []).join("\n"))));
  l.append(section("Rapport à partager", el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
    btn("Word (.docx)", async () => { try { const f = {}; for (const [k, x] of Object.entries(figures)) f[k] = await pngOf(x); download(`${name}.docx`, docx(reviewDoc({ ...data(), figures: f })), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); } catch (e) { toast(`Rapport Word : ${e.message}`, "error"); } }, { primary: true, icon: "download" }),
    btn("PDF", () => { try { download(`${name}.pdf`, pdfDoc(doc), "application/pdf"); } catch (e) { toast(`Rapport PDF : ${e.message}`, "error"); } }, { primary: true, icon: "pdf" }))));
  const structure = () => functionalStructure(board, ctx.lib), drafts = new Set(draftsOf(board).filter((w) => w.list === "functions").map((w) => w.key));
  l.append(section("Structure fonctionnelle", el("p", { class: "muted small" }, "L'arbre des fonctions (critères, bloc, composants, nets) et la structure fonctionnelle : ce qui entre, ce qui sort, les flux d'énergie et d'information entre les blocs. Le fichier draw.io reste modifiable."), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
    btn("draw.io", () => download(`${board.id}-fonctions.drawio`, drawio([treeDiagram(ctx.rows, `${board.id} — ${board.name || ""}`, drafts), structureDiagram(structure())]), "application/xml"), { small: true, primary: true, icon: "download", tip: "Deux pages modifiables dans diagrams.net : l'arbre des fonctions et la structure fonctionnelle" }),
    btn("Flux (.csv)", () => download(`${board.id}-flux.csv`, structureCsv(structure()), "text/csv"), { small: true, icon: "download", tip: "Les flux d'énergie et d'information, bloc à bloc" }),
    btn("Tableur (.csv)", () => download(`${board.id}-fonctions.csv`, functionCsv(ctx.rows), "text/csv"), { small: true, icon: "download" }), btn("Texte", () => download(`${board.id}-fonctions.txt`, functionOutline(ctx.rows), "text/plain"), { small: true, icon: "download" }),
    btn("JSON", () => download(`${board.id}-fonctions.json`, JSON.stringify(ctx.rows, null, 1), "application/json"), { small: true, icon: "download" }))));
  l.append(section("Artéfact de la carte", el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, btn("Carte (.dwiz)", () => download(dwizFileName(board), toDwiz(board), "text/plain"), { small: true, icon: "download" }), btn("Copier pour l'IA", () => boardAiLoop(ctx), { small: true, icon: "sparkle", tip: "Copier la carte avec une demande, travailler avec l'assistant de son choix, réimporter avec un aperçu : ce que l'IA ajoute arrive en « Brouillon IA »" }))));
  const page = el("div", { class: "pcba-report" }, el("h1", null, doc.title), el("p", { class: "muted" }, `${doc.subtitle} — ${doc.reference}, révision ${doc.revision}`));
  for (const b of doc.blocks) {
    if (/^h[123]$/.test(b.type)) page.append(el(b.type === "h1" ? "h2" : b.type === "h2" ? "h3" : "h4", null, b.text));
    else if (b.type === "p") page.append(el("p", { class: b.style === "muted" ? "muted" : b.style === "warn" ? "form-error" : null }, b.text));
    else if (b.type === "list") page.append(el(b.ordered ? "ol" : "ul", null, b.items.map((i) => el("li", null, typeof i === "string" ? i : i.text))));
    else if (b.type === "table" || b.type === "kv") page.append(table(b.head || [], b.rows.map((r) => r.map((c) => (c !== null && typeof c === "object" ? el("span", { class: c.fill ? `cell-${c.fill}` : null, style: { fontWeight: c.bold ? 650 : null } }, c.text) : c))), b.type === "kv" ? "kv" : ""));
    else if (b.type === "checklist") page.append(el("ul", { class: "pcba-checks" }, b.items.map((i) => el("li", { class: i.state }, icon(i.state === "ok" ? "check" : "warning"), " ", i.text))));
    else if (b.type === "signatures") page.append(table(["Rôle", "Nom", "Date", "Signature"], b.roles.map((r) => [r, "", "", ""])));
    else if (b.type === "figure") page.append(el("p", { class: "muted small", style: { textAlign: "center" } }, `[ ${b.caption || "Figure"} — dans le rapport ]`));
  }
  pane(view, K.label, "Aperçu du rapport ; les fichiers Word et PDF portent la même chose, figures comprises.", page);
  const r = scroll(right, el("div", { class: "side-head" }, el("h2", null, "Verdict"), badge(V.ready ? "prête pour la revue" : `${V.blockers.length} point(s) bloquant(s)`, V.ready ? "ok" : "danger")));
  for (const t of V.blockers) r.append(hint(t, "warn"));
  if (V.cautions.length) r.append(section("À examiner en revue", el("ul", { class: "small" }, V.cautions.map((t) => el("li", null, t)))));
  r.append(section("Liste de vérification", el("ul", { class: "pcba-checks" }, V.checklist.map((i) => el("li", { class: i.state }, icon(i.state === "ok" ? "check" : "warning"), " ", i.text)))));
}

/* ---------- classic ECAD views ---------- */
function schema(ctx, { left, view, right }) {
  const { board, R } = ctx, netOf = R.netOf;
  scroll(left, el("div", { class: "side-head" }, el("h2", null, "Schéma")), el("p", { class: "muted small" }, "Le schéma se lit par blocs, comme des feuilles hiérarchiques : chaque composant avec ses broches, chaque broche avec l'étiquette de son net. Deux broches qui portent la même étiquette sont reliées."),
    section("Feuilles", ...board.blocks.map((b) => el("a", { class: "pcba-pick", href: `#sch-${b.id}`, onClick: (e) => { e.preventDefault(); const n = document.getElementById(`sch-${b.id}`); if (n) n.scrollIntoView({ behavior: "smooth" }); } }, icon("chevron-right"), el("span", null, `${b.id} ${b.name}`)))));
  const sheets = board.blocks.map((b) => { const parts = R.parts.filter((p) => p.block === b.id);
    return el("section", { class: "pcba-sheet", id: `sch-${b.id}` }, el("h3", null, `${b.id} — ${b.name}`), el("div", { class: "sch-grid" }, ...parts.map((p) => { const pins = [...new Map(p.pads.map((i) => [R.pads[i].n, R.pads[i]])).values()];
      return el("div", { class: "sch-part" }, el("div", { class: "sch-head" }, el("b", null, p.ref), el("span", null, p.value || p.def.package)), el("small", { class: "muted" }, p.def.name), el("table", null, el("tbody", null, pins.map((pad) => el("tr", null, el("td", { class: "sch-n" }, pad.n), el("td", null, pad.name === pad.n ? "" : pad.name), el("td", { class: `sch-net ${pad.net ? (R.rules.of(pad.net).class) : "nc"}` }, netOf.get(pad.pin) || "—")))))); }))); });
  pane(view, "Schéma par blocs", `${R.parts.length} composants, ${R.nets.length} nets`, ...sheets);
  scroll(right, el("div", { class: "side-head" }, el("h2", null, "Nomenclature des nets")), el("ul", { class: "small pcba-conv" }, NET_CONVENTION.map((c) => el("li", null, el("code", null, c.example), " — ", c.meaning))));
}
function empilage(ctx, { left, view, right }) {
  const { board } = ctx, rows = stackup(board), total = rows.reduce((s, r) => s + r.thickness, 0);
  scroll(left, el("div", { class: "side-head" }, el("h2", null, "Empilage")), el("p", { class: "muted small" }, "L'empilage se règle à l'étape Implantation : nombre de couches, épaisseur, cuivre, finition."), btn("Aller à l'implantation", () => ctx.nav("implantation"), { icon: "chevron-right" }));
  const g = svg("svg", { class: "pcba-stack", viewBox: "0 0 420 260" }); let y = 14;
  for (const r of rows) { const h = Math.max(9, r.thickness / total * 200), cu = /Cuivre/.test(r.material); g.append(svg("rect", { x: 20, y, width: 190, height: h, class: cu ? "st-cu" : /Vernis/.test(r.material) ? "st-mask" : "st-fr4" }), svg("text", { x: 222, y: y + h / 2 + 4, class: "st-label" }, `${r.layer} — ${r.material}, ${fmt(r.thickness, 3)} mm`)); y += h + 2; }
  pane(view, "Empilage de la carte nue", `${fmt(total, 2)} mm au total`, g, table(["Couche", "Matière", "Épaisseur"], rows.map((r) => [r.layer, r.material, `${fmt(r.thickness, 3)} mm`])));
  scroll(right, el("div", { class: "side-head" }, el("h2", null, "Plans")), el("p", { class: "small" }, (board.planes || []).length ? (board.planes || []).map((p) => `${p.net} sur ${ctx.art.names[p.layer] || p.layer}`).join(" ; ") : "Aucun plan de cuivre déclaré."));
}
function regles(ctx, { left, view, right }) {
  const { board } = ctx, fab = FAB[(board.rules || {}).fab || "standard"] || FAB.standard;
  scroll(left, el("div", { class: "side-head" }, el("h2", null, "Règles")), el("p", { class: "muted small" }, "Les règles viennent de trois endroits : la classe de fabrication (ce que l'atelier tient), les classes de nets (ce que le circuit demande) et le livre de règles (ce que l'assemblage et l'essai demandent)."), btn("Lancer les vérifications", () => ctx.nav("verifs"), { primary: true, icon: "play" }));
  pane(view, "Règles de conception", fab.label, el("h3", null, "Capacités de fabrication"), table(["Règle", "Valeur"], [["Piste minimale", `${fmt(fab.track)} mm`], ["Isolement minimal", `${fmt(fab.space)} mm`], ["Perçage minimal", `${fmt(fab.drill)} mm`], ["Couronne minimale", `${fmt(fab.ring, 3)} mm`], ["Cuivre au bord", `${fmt(fab.edge)} mm`], ["Paroi entre deux trous", `${fmt(fab.holeGap)} mm`], ["Pont de vernis épargne", `${fmt(fab.maskDam)} mm`], ["Trait de sérigraphie", `${fmt(fab.silk)} mm`]]),
    ...PCBA_BOOK.map((g) => el("div", null, el("h3", null, g.category), table(["Règle", "Limite", "Gravité"], g.rules.map((r) => [`${r.id} ${r.title}`, r.limit, { error: "erreur", warn: "avertissement", info: "remarque" }[r.severity]])))));
  scroll(right, el("div", { class: "side-head" }, el("h2", null, "Constats en cours")), el("p", { class: "small" }, `${ctx.drc.summary.error} erreur(s), ${ctx.drc.summary.warn} avertissement(s), ${ctx.drc.summary.info} remarque(s).`));
}
function classes(ctx, { left, view, right }) {
  const { board, R } = ctx, own = (board.rules || {}).classes || {}, setC = (k, key, v) => ctx.update((b) => { b.rules = b.rules || {}; b.rules.classes = b.rules.classes || {}; b.rules.classes[k] = { ...(b.rules.classes[k] || {}), [key]: v }; }, `Classe ${CLASSES[k].label}`);
  const n = (v, on) => el("input", { type: "number", step: "0.05", value: v, style: { width: "4.6rem" }, onChange: (e) => { const x = parseFloat(e.target.value); if (x > 0) on(x); } });
  scroll(left, el("div", { class: "side-head" }, el("h2", null, "Classes de nets")), el("p", { class: "muted small" }, "Une classe fixe la largeur préférée des pistes, l'isolement minimal et le via. La tension et le courant de chaque net les font grandir d'après IPC-2221."));
  pane(view, "Classes de nets", null, table(["Classe", "Piste (mm)", "Isolement (mm)", "Via Ø / perçage", "Nets"], Object.entries(CLASSES).map(([k, c]) => { const o = own[k] || {}; return [c.label, n(o.track ?? c.track, (v) => setC(k, "track", v)), n(o.clearance ?? c.clearance, (v) => setC(k, "clearance", v)), `${fmt((o.via || c.via)[0])} / ${fmt((o.via || c.via)[1])}`, String(R.nets.filter((x) => x.class === k).length)]; })),
    el("h3", null, "Nets"), table(["Net", "Classe", "Tension", "Courant", "Piste", "Isolement", "Broches"], R.nets.map((x) => [x.name, sel(x.class, Object.entries(CLASSES).map(([k, c]) => [k, c.label]), (v) => ctx.update((b) => { b.nets.find((q) => q.name === x.name).class = v; }, `${x.name} : classe`)),
      n(x.voltage, (v) => ctx.update((b) => { b.nets.find((q) => q.name === x.name).voltage = v; }, `${x.name} : tension`)), n(x.current, (v) => ctx.update((b) => { b.nets.find((q) => q.name === x.name).current = v; }, `${x.name} : courant`)), `${fmt(x.rules.track)} mm`, `${fmt(x.rules.clearance)} mm`, String(x.pads.length)])));
  scroll(right, el("div", { class: "side-head" }, el("h2", null, "D'où viennent les valeurs")), el("p", { class: "small" }, "Piste : la plus grande entre la classe, la largeur IPC-2221 pour le courant (cuivre de la carte, +10 K) et la capacité de l'atelier."), el("p", { class: "small" }, "Isolement : le plus grand entre la classe, IPC-2221B à la tension du net (colonne B2 carte nue, A5 carte vernie) et la capacité de l'atelier."));
}
function nomenclature(ctx, { left, view, right }) {
  const { board } = ctx, bom = boardBom(board, ctx.lib), cost = bom.reduce((s, l) => s + l.total, 0), pk = () => fabPackage(board, ctx.lib, { date: new Date() }).files.find((f) => f.key === "bom");
  scroll(left, el("div", { class: "side-head" }, el("h2", null, "Nomenclature")), el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, String(bom.length)), el("span", null, "lignes")), el("div", { class: "kpi" }, el("b", null, String(bom.reduce((s, l) => s + l.qty, 0))), el("span", null, "composants")), el("div", { class: "kpi" }, el("b", null, `${fmt(cost)} $`), el("span", null, "par carte"))),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Télécharger (.csv)", () => { const f = pk(); download(f.name, f.text, f.mime); }, { primary: true, icon: "download" })), el("p", { class: "muted small" }, "Prix unitaires typiques de prototype ; la référence exacte se saisit ici ou dans le layout."));
  const setAll = (refs, fn) => ctx.update((b) => { for (const p of b.parts) if (refs.includes(p.ref)) fn(p); }, "Nomenclature modifiée");
  pane(view, "Nomenclature", `${fmt(cost)} $ de composants par carte`, table(["N°", "Qté", "Repères", "Valeur", "Désignation", "Boîtier", "Référence du fabricant", "Prix"], bom.map((l, i) => [String(i + 1), String(l.qty), l.refs.join(" "), l.value || "—", l.name, l.package, txt(l.mpn, (v) => setAll(l.refs, (p) => { if (v) p.mpn = v; else delete p.mpn; }), "9rem"), l.dnp ? badge("non monté", "warn") : `${fmt(l.total)} $`])));
  scroll(right, el("div", { class: "side-head" }, el("h2", null, "Assemblage")), el("p", { class: "small" }, `${bom.filter((l) => l.tht).reduce((s, l) => s + l.qty, 0)} composant(s) traversant(s), ${bom.filter((l) => !l.mpn && !l.dnp).length} ligne(s) sans référence choisie.`));
}

export const OUTPUT_STEPS = { verifs, fabrication, revue };
/** What a user of a classic ECAD tool looks for, and where it is here. */
export const CLASSIC = {
  schema: { label: "Schéma", tip: "Chaque composant, ses broches et l'étiquette de leur net, feuille par feuille", render: schema }, carte: { label: "Carte et couches", tip: "L'éditeur de carte : placement, routage, couches", step: "layout" },
  empilage: { label: "Empilage", tip: "Les couches de la carte nue, de dessus en dessous", render: empilage }, regles: { label: "Règles", tip: "Règles de conception et capacités de fabrication", render: regles },
  classes: { label: "Classes de nets", tip: "Largeur, isolement et via par classe ; tension et courant par net", render: classes }, bom: { label: "Nomenclature", tip: "La liste des composants à acheter et à monter", render: nomenclature },
  sorties: { label: "Sorties de fabrication", tip: "Gerber, perçage, placement, nomenclature, netlist", step: "fabrication" },
};
