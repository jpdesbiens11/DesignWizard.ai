/* DesignWizard.ai — Dessins: the 2D drawing of each part and of each assembly, generated from the 3D and the interfaces,
   on a tabloid sheet (11 × 17 in) : standard views fitted in the middle, a small isometric view top right, notes bottom
   left, title block bottom right — with the parts list above it for an assembly. Every dimension has its balloon ; the
   left pane lists them all and gives each its class (normal, reference, SC, CSC). Shown as SVG, exported as a vector PDF. */

import { el, clear, icon, btn, badge, field, toast, download, fmt, fmtLen, unitField, inUnits } from "../core/dom.js";
import { zoomPane } from "../core/zoom_pane.js";
import { registerModule, go, setStatus, setGuide, app } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { SvgSheet } from "../draw/svg.js";
import { PdfSheet } from "../draw/pdf.js";
import { sectionOf } from "../cad/section_view.js";
import { composeDrawing, viewRequest, PAPER, drawingSemantics } from "../draw/part_drawing.js";
import { composeAssemblyDrawing, centerKey } from "../draw/asm_drawing.js";
import { getUnits } from "../core/units.js";
import { sayWith, drawingTexts, wordsIssues } from "../core/drawing_words.js";
import { drawingIssues } from "../core/drawing_guide.js";
import { busyVeil } from "../core/busy.js";
import { wordsSection } from "./drawing_words.js";
import { DIM_CLASSES, setDimClass, dimText } from "../draw/dim_model.js";
import { buildAssembly } from "../core/asm_scene.js";
import { matPoint, bboxTransform, bboxUnion } from "../cad/vec.js";
import { bomTop } from "../core/assembly_logic.js";
import { whereUsed, reviewItems } from "../core/review.js";
import { confidentialNote } from "../core/brand.js";
import { dimTree, dimClasses } from "../core/trees.js";
import { stateTree } from "./state_tree.js";
import { variantNow } from "../core/variants.js";
import { asmVariantNow } from "../core/asm_live.js";
import { partOut, asmOut, variantTag } from "../core/variant_out.js";

const [PW, PH] = PAPER.TABLOID;
/** The title-block fields of the project, and the revisions the review ledger remembers for an artefact. */
function sheetOpts(key, rev, extra) {
  const d = (store.project.drawing || {}), led = ((store.project.review || {}).items || {})[key] || {}, now = (reviewItems(store.project).find((x) => x.key === key) || {}).state;      // the state as it is today : a reviewed artefact that changed — or whose parts moved on — is no longer « reviewed »
  const revisions = (led.history || []).filter((h) => h.rev).map((h) => ({ rev: h.rev, description: h.note || "", date: String(h.when || "").slice(0, 10), by: led.by || d.checkedBy || "" }));
  return { projection: d.projection || "third", hidden: d.hidden !== false, drawnBy: d.drawnBy || store.project.author || "", checkedBy: d.checkedBy || "", approvedBy: d.approvedBy || "",
    status: d.status || (now === "ok" ? "Reviewed" : now === "changed" ? "To revalidate" : "Preliminary"), date: new Date().toISOString().slice(0, 10), revisions, organisation: d.organisation || "", confidential: confidentialNote(d.organisation, d.confidentiality), units: getUnits(), say: sayWith(d.words), ...extra };
}
const render2 = (compose, data, title) => { const svg = new SvgSheet({ width: PW, height: PH, title }), info = compose(svg, data);
  return { svg: svg.toString(0), svgs: svg.toStrings(), info, pdfBytes: () => { const pdf = new PdfSheet({ width: PW, height: PH, title }); compose(pdf, data); return pdf.toBytes(); } }; };

/** Build the drawing of a part. Returns {svg, pdfBytes(), info, built, spec, variant}. Shared with Rapport and Onshape.
    extra.variant : the name of a variant of the part — it is drawn as that variant, and the part is not changed. The sheet says which
    variant it shows, asked for or simply the one the part is in (core/variant_out.js). */
export async function makeDrawing(partId, extra = {}) {
  const own = store.part(partId);
  if (!own) throw new Error(`Pièce « ${partId} » introuvable.`);
  const o = partOut(own, extra.variant), spec = o.doc;
  const key = o.copy ? "drawing:variant" : partId, built = await kernel.build(spec, undefined, key);      // a variant is built beside the part : the part the other screens show stays in the kernel as it is
  if (!built.bodies.length) throw new Error(`${partId} n'a pas de volume à dessiner.`);
  const views = await kernel.hlr(key, viewRequest(sectionOf(spec, built)), true);
  return { ...render2(composeDrawing, { spec, built, views, project: store.project, opts: sheetOpts(`part:${partId}`, spec.revision, { ...extra, variant: o.variant }) }, `${spec.id} ${sayWith((store.project.drawing || {}).words)(spec.name) || ""}`), built, spec, variant: o.variant };
}
/** Build the drawing of an assembly : placed parts projected together, item balloons, parts list. Returns {svg, pdfBytes(), info, spec}. */
export async function makeAssemblyDrawing(asmId, extra = {}) {
  const own = store.assembly(asmId);
  if (!own) throw new Error(`Assemblage « ${asmId} » introuvable.`);
  const o = asmOut(own, extra.variant), asm = o.doc;      // a variant : its parts on and off, the assembly itself is not changed
  const ctx = await buildAssembly(asm), shown = ctx.asm.instances.filter((i) => !i.hidden);
  if (!shown.length) throw new Error(`${asmId} n'a aucune pièce à dessiner.`);
  const views = await kernel.hlrAsm(shown.map((i) => ({ key: i.part, matrix: ctx.sol.placements[i.id] })), viewRequest(), false), centers = {};
  /* the list of the sheet : the level of this assembly — a sub-assembly is one line, it has its own drawing — unless the project asks for every part (« à plat ») */
  const groups = ctx.asm.groups || {}, byLevel = Object.keys(groups).length > 0 && (extra.bom || (store.project.drawing || {}).asmBom) !== "flat", list = byLevel ? bomTop(store.project, ctx.asm, ctx.built) : ctx.bom;
  const middle = (i) => { const b = ctx.built[i.part].bbox; return matPoint(ctx.sol.placements[i.id], [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]); };
  for (const i of shown) if (!centers[i.part] && !(byLevel && i.group)) centers[i.part] = middle(i);      // by level, the balloon of a part goes to one placed at this level
  for (const r of list) if (r.kind === "assembly") { let box = null; for (const i of shown) if (i.group === r.group) box = bboxUnion(box, bboxTransform(ctx.built[i.part].bbox, ctx.sol.placements[i.id]));
    if (box) centers[centerKey(r)] = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2]; }      // the balloon of a sub-assembly : the middle of the block
  const rows = list.map((r) => ({ ...r, rev: r.kind === "part" ? (store.part(r.id) || {}).revision || "A" : r.kind === "assembly" ? r.rev : "" }));
  const count = { parts: ctx.asm.instances.length, inSubs: ctx.asm.instances.filter((i) => i.group).length, subs: Object.keys(groups).length, joints: (ctx.asm.mates || []).length };
  return { ...render2(composeAssemblyDrawing, { asm, project: store.project, views, bbox: ctx.bbox, rows, centers, count, mass: ctx.mass.mass, opts: sheetOpts(`assembly:${asmId}`, asm.revision, { ...extra, variant: o.variant }) }, `${asm.id} ${sayWith((store.project.drawing || {}).words)(asm.name) || ""}`), spec: asm, variant: o.variant };
}
export function svgNode(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml"), node = document.importNode(doc.documentElement, true);
  node.removeAttribute("width"); node.removeAttribute("height"); node.setAttribute("class", "sheet-view");
  return node;
}

function render(main, args) {
  const parts = store.parts.filter((p) => !p.step), asms = store.assemblies, isAsm = args[0] === "asm";
  const id = isAsm ? (store.assembly(args[1]) ? args[1] : null) : args[0] && store.part(args[0]) ? args[0] : (parts[0] && parts[0].id) || null;
  /* the variant drawn : a name of the route (#/drawings/<part>/<variant>, #/drawings/asm/<assembly>/<variant>) — else the document as it is */
  const own0 = id ? (isAsm ? store.assembly(id) : store.part(id)) : null, asked = isAsm ? args[2] : args[1], variant = own0 && asked && (own0.variants || []).some((v) => v.name === asked) ? asked : null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), center = el("div", { style: { overflow: "auto", padding: "1rem" } });
  const root = el("div", { class: "studio" }, left, center, right);
  root.style.setProperty("--left-w", "340px");
  main.append(root); zoomPane(center);      // the sheets zoom : Ctrl + wheel, the small bar, dragging once larger than the centre
  left.append(el("img", { class: "side-mark", src: "img/marks/drawings.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Dessins")));
  const scroll = el("div", { class: "side-scroll" }), dimBox = el("div");
  left.append(scroll);
  const pick = el("select", { "aria-label": "Dessin affiché", onChange: (e) => go(`#/drawings/${e.target.value}`) },
    el("optgroup", { label: `Pièces (${parts.length})` }, parts.map((p) => el("option", { value: encodeURIComponent(p.id), selected: !isAsm && p.id === id }, `${p.id} — ${p.name || ""}`))),
    asms.length ? el("optgroup", { label: `Assemblages (${asms.length})` }, asms.map((a) => el("option", { value: `asm/${encodeURIComponent(a.id)}`, selected: isAsm && a.id === id }, `${a.id} — ${a.name || ""}`))) : null);
  const cousins = (own0 && own0.variants) || [], base = id ? `#/drawings/${isAsm ? "asm/" : ""}${encodeURIComponent(id)}` : "#/drawings", nowName = own0 ? (isAsm ? asmVariantNow(own0) : variantNow(own0)) : null;
  const pickVariant = cousins.length ? field("Variante dessinée", el("select", { "aria-label": "Variante dessinée", onChange: (e) => go(e.target.value ? `${base}/${encodeURIComponent(e.target.value)}` : base) },
    el("option", { value: "", selected: !variant }, `${isAsm ? "L'assemblage tel qu'il est" : "La pièce telle qu'elle est"}${nowName ? ` (${nowName})` : ""}`), cousins.map((v) => el("option", { value: v.name, selected: v.name === variant }, v.name))),
    variant ? `La feuille montre la variante « ${variant} » ; ${isAsm ? "l'assemblage" : "la pièce"} n'est pas changé${isAsm ? "" : "e"}.` : "Chaque variante a son dessin, sans changer le document.") : null;
  scroll.append(el("div", { class: "side-section" }, field("Dessin de", pick), pickVariant), dimBox);
  if (!id) { center.append(el("div", { class: "empty" }, el("h2", null, "Rien à dessiner"), el("p", null, "Créez une pièce : son dessin se génère tout seul."), el("a", { class: "btn btn-primary", href: "#/shop" }, "Démarrer par les interfaces"))); right.remove(); root.classList.add("no-right"); return null; }
  const st = { doc: null, token: 0, dim: null }, artefact = () => (isAsm ? store.assembly(id) : store.part(id));
  const d = () => store.project.drawing || {};
  const setD = (key, val, label) => store.commit(`Dessins : ${label}`, (p) => { p.drawing = { ...(p.drawing || {}), [key]: val }; });
  const veil = busyVeil(center, "sheet-busy");      // the sheet being projected : what, for how long, and a button to cancel
  const off = store.on("change", () => { if (!artefact()) { go("#/drawings"); return; } build(); });
  async function build() {
    const token = ++st.token;
    const stop = () => { st.token++; kernel.cancel(); setStatus("Dessin annulé", ""); veil.set("Dessin annulé : la feuille n'est pas tracée.", { stopped: true, retry: build }); };
    if (!st.doc) { clear(center); center.append(veil.node); veil.set("Projection des vues et mise en page…", { cancel: stop }); }
    try {
      const doc = isAsm ? await makeAssemblyDrawing(id, { variant }) : await makeDrawing(id, { variant });
      if (token !== st.token) return;
      st.doc = doc; veil.set("");
      clear(center); (doc.svgs || [doc.svg]).forEach((markup, i, all) => { if (all.length > 1) center.append(el("p", { class: "sheet-no" }, `Feuille ${i + 1} / ${all.length}`)); center.append(svgNode(markup)); });
      setStatus(`Dessin de ${id} à l'échelle ${doc.info.scale}`, "done");
      renderDims(); renderRight();
    } catch (e) { if (token !== st.token) return; veil.set(""); clear(center); center.append(el("div", { class: "card" }, el("h2", null, "Dessin impossible"), el("p", { class: "form-error" }, e.message))); }
  }
  /* every dimension of the sheet, with its balloon number : each can stay normal, become a reference, or a special characteristic */
  function renderDims() {
    clear(dimBox); if (!st.doc) return;
    const dims = st.doc.info.dims || [];
    /* an assembly : its balloons and its overall dimensions, as a tree to read */
    if (isAsm) { const tree = [{ key: "items", fr: "Repères", color: "#0ea5e9", tip: "Les pièces de la nomenclature, au numéro de leur bulle", items: st.doc.info.items.map((x) => ({ id: `item:${x.item}`, n: x.item, text: x.id, sub: x.view ? (x.kind === "assembly" ? "sous-assemblage" : "") : "masquée sur les vues" })) },
      { key: "dims", fr: "Cotes hors tout", color: "#2563eb", tip: "L'encombrement de l'assemblage", items: dims.map((x) => ({ id: `dim:${x.n}`, n: x.n, text: fmtLen(x.value, 2), sub: x.label })) }];
      dimBox.append(el("div", { class: "side-section" }, el("h3", null, `Repères (${st.doc.info.items.length}) et cotes (${dims.length})`), stateTree({ label: "Repères et cotes du dessin d'assemblage", tree, sel: null, attr: "data-dim-row", select: () => {} }))); return; }
    /* a part : its dimensions by nature ; a click on one opens ITS class — normal, reference, special characteristic — instead of a menu per dimension */
    const c = dimClasses(dims), tree = dimTree(dims, st.doc.info.onView, dimText);
    const editor = (it) => el("div", { class: "bc-edit", "data-dim-edit": it.id }, el("p", { class: "small", style: { margin: ".2rem 0" } }, `${it.sub} — ${it.where}${it.basic ? " · cote de base (encadrée)" : ""}`),
      el("div", { class: "bc-row" }, Object.entries(DIM_CLASSES).map(([k, cl]) => btn(cl.short || "Normale", () => store.updatePart(id, (p) => { setDimClass(p, it.id, k); }, `${id} : cote ${it.n} — ${cl.fr}`), { small: true, primary: k === it.cls, tip: cl.fr }))));
    dimBox.append(el("div", { class: "side-section" }, el("h3", null, `Cotes (${dims.length})`), el("p", { class: "muted", style: { fontSize: ".78rem", margin: "0 0 .4rem" } }, `Le numéro est celui de la bulle sur le dessin. ${c.sc} SC · ${c.csc} CSC · ${c.ref} référence(s). Cliquez une cote pour changer sa classe.`),
      stateTree({ label: "Cotes du dessin, par nature", tree, sel: st.dim, attr: "data-dim-row", select: (k) => { st.dim = k; renderDims(); }, editor })));
  }
  function pdf() { if (!st.doc) return; download(`${id}${variantTag(st.doc.variant)}_rev${st.doc.spec.revision || "A"}.pdf`, st.doc.pdfBytes(), "application/pdf"); toast("PDF vectoriel téléchargé (tabloïd, 11 × 17 po).", "success"); }
  function renderRight() {
    clear(right);
    const spec = artefact(), sem = isAsm ? { datums: [], gdt: [] } : st.doc ? { datums: st.doc.info.datums, gdt: st.doc.info.gdt } : drawingSemantics(spec, { interfaces: [], bbox: [0, 0, 0, 0, 0, 0] });
    right.append(el("div", { class: "side-head" }, el("h2", null, spec.name || id), btn("PDF", pdf, { primary: true, small: true, icon: "pdf", tip: "Télécharger le dessin en PDF vectoriel (tabloïd, 11 × 17 po)" })));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    /* the English of what the project writes on this sheet : the guide says how many texts have none */
    const texts = drawingTexts(store.project, `${isAsm ? "assembly" : "part"}:${id}`, isAsm && st.doc ? st.doc.info.rows : null); const key = `${isAsm ? "assembly" : "part"}:${id}`, focus = (f) => () => { const n = right.querySelector(`[data-field="${f}"]`); if (n) { n.scrollIntoView({ block: "center" }); n.focus(); } };
    setGuide([...drawingIssues(d(), { id, author: store.project.author, state: (reviewItems(store.project).find((x) => x.key === key) || {}).state }).map((x) => ({ ...x, go: focus(x.field) })), ...wordsIssues(d().words, texts)]);      // the title block, the review, then the English of the texts
    /* the section A-A of a part : where the plane passes. « Automatique » : across the length, through the middle, when the part has something inside. */
    const sectionRow = () => { const own = spec.section || null, bb = st.doc && st.doc.built ? st.doc.built.bbox : null, mode = !own ? "auto" : own.axis === "none" ? "none" : own.axis === "y" ? "y" : "x", i = mode === "y" ? 1 : 0;
      const setSec = (v, label) => store.updatePart(id, (p) => { if (v) p.section = v; else delete p.section; }, `${id} : coupe A-A — ${label}`);
      const lo = bb ? bb[i] : 0, hi = bb ? bb[i + 3] : 100, at = own && Number.isFinite(own.at) ? own.at : (lo + hi) / 2;
      return el("div", { class: "form-row" }, field("Coupe A-A", el("select", { "aria-label": "Coupe A-A", onChange: (e) => { const m = e.target.value; setSec(m === "auto" ? null : m === "none" ? { axis: "none" } : { axis: m }, e.target.selectedOptions[0].textContent); } },
          [["auto", "Automatique"], ["x", "En travers de la longueur (plan YZ)"], ["y", "En travers de la largeur (plan XZ)"], ["none", "Aucune"]].map(([v, l]) => el("option", { value: v, selected: v === mode }, l))), "Le plan est montré sur la vue de dessus ; la face coupée est hachurée"),
        mode === "x" || mode === "y" ? unitField(`Position du plan ${mode.toUpperCase()} (mm)`, { "aria-label": "Position du plan de coupe", value: Math.round(at * 100) / 100, min: lo, max: hi, step: 1 }, (v) => { if (Number.isFinite(v)) setSec({ axis: mode, at: Math.max(lo + 0.1, Math.min(hi - 0.1, v)) }, inUnits(`plan ${mode.toUpperCase()} = ${Math.round(v * 100) / 100} mm`)); }, { event: "onChange", hint: inUnits(`Entre ${Math.round(lo)} et ${Math.round(hi)} mm`) }) : null); };
    const text = (key, label, hint) => field(label, el("input", { type: "text", "data-field": key, value: d()[key] || "", onChange: (e) => setD(key, e.target.value, label) }), hint);
    const setRev = (v) => (isAsm ? store.updateAssembly(id, (x) => { x.revision = v || undefined; }, `${id} : révision`) : store.updatePart(id, (x) => { x.revision = v || undefined; }, `${id} : révision`));
    body.append(el("div", { class: "side-section" }, el("h3", null, "Cartouche"), el("div", { class: "form-row" }, text("drawnBy", "Dessiné"), text("checkedBy", "Vérifié")), el("div", { class: "form-row" }, text("approvedBy", "Approuvé"), text("status", "Statut", "Préliminaire, Pour revue, Émis…")),
      text("organisation", "Organisation", "À qui appartiennent les documents du projet : dans le cartouche et dans la note de confidentialité de tous les livrables"), text("confidentiality", "Note de confidentialité", "Laissez vide pour la note d'usage : « CONFIDENTIEL — ce document et les informations qu'il contient sont la propriété de… »"),
      el("div", { class: "form-row" }, field("Projection", el("select", { onChange: (e) => setD("projection", e.target.value, "projection") }, [["third", "Troisième dièdre (Amérique du Nord)"], ["first", "Premier dièdre (ISO / Europe)"]].map(([v, l]) => el("option", { value: v, selected: (d().projection || "third") === v }, l)))),
        isAsm ? null : el("label", { class: "check" }, el("input", { type: "checkbox", checked: d().hidden !== false, onChange: (e) => setD("hidden", e.target.checked, "arêtes cachées") }), "Arêtes cachées")),
      isAsm ? null : sectionRow(),
      /* an assembly that holds sub-assemblies : what its parts list shows */
      isAsm && (spec.instances || []).some((i) => i.asm) ? field("Nomenclature du dessin", el("select", { "aria-label": "Nomenclature du dessin", onChange: (e) => setD("asmBom", e.target.value === "flat" ? "flat" : "", "nomenclature du dessin") },
        [["level", "Ce niveau : un sous-assemblage = une ligne"], ["flat", "À plat : toutes les pièces"]].map(([v, l]) => el("option", { value: v, selected: (d().asmBom === "flat" ? "flat" : "level") === v }, l))), "L'usage : la liste d'un dessin d'ensemble est celle de son niveau ; chaque sous-assemblage a son propre dessin, avec sa liste.") : null,
      field(isAsm ? "Révision de l'assemblage" : "Révision de la pièce", el("input", { type: "text", value: spec.revision || "", onChange: (e) => setRev(e.target.value.trim()) }), "Le dessin porte toujours la révision de ce qu'il dessine ; la revue la fait avancer (A → B) quand un artéfact validé a changé.")));
    if (!isAsm) { const used = whereUsed(store.project, id);
      body.append(el("div", { class: "side-section" }, el("h3", null, "Employée dans"), used.length ? used.map((u) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, el("a", { href: `#/drawings/asm/${encodeURIComponent(u.id)}` }, el("code", null, u.id)), ` rév. ${u.rev}${u.qty > 1 ? ` (× ${u.qty})` : ""} — `,
        u.reviewedWith === null ? "pas encore revu" : u.upToDate ? badge(`revu avec la rév. ${u.reviewedWith}`, "ok") : badge(`revu avec la rév. ${u.reviewedWith} : à revalider`, "warn"))) : el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Aucun assemblage n'emploie encore cette pièce."))); }
    if (!isAsm) body.append(el("div", { class: "side-section" }, el("h3", null, "Références et GD&T (tirés des interfaces, ASME Y14.5)"),
      sem.datums.map((x) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, badge(x.letter, "info"), ` face ${x.face} — ${x.why}`)),
      sem.gdt.map((g) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, badge(g.symbol, "neutral"), ` ${g.diameter ? "Ø" : ""}${fmt(g.tolerance, 2)}${g.modifier === "mmc" ? " Ⓜ" : ""}${g.datums.length ? ` | ${g.datums.join(" | ")}` : ""} — ${g.name}`, g.rule ? el("small", { class: "muted" }, ` (${g.rule})`) : null)),
      !sem.gdt.length && el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Aucune interface : pas de tolérance géométrique générée.")));
    const notes = el("textarea", { rows: 6, value: (spec.notes || []).join("\n"), "aria-label": "Notes du dessin, une par ligne", placeholder: "Une note par ligne (traitement, marquage, contrôle…)" });
    notes.style.fontFamily = "var(--font)"; notes.style.fontSize = ".88rem";
    const saveNotes = () => { const list = notes.value.split("\n").map((s) => s.trim()).filter(Boolean); if (isAsm) store.updateAssembly(id, (x) => { x.notes = list; }, `${id} : notes du dessin`); else store.updatePart(id, (x) => { x.notes = list; }, `${id} : notes du dessin`); };
    body.append(el("div", { class: "side-section" }, el("h3", null, isAsm ? "Notes propres à l'assemblage" : "Notes propres à la pièce"), notes, el("div", { class: "form-actions" }, btn("Appliquer les notes", saveNotes, { small: true })),
      el("p", { class: "muted", style: { fontSize: ".8rem" } }, "Les notes générales (ASME Y14.5, matériau, tolérances, classes de cotes) sont ajoutées seules, toujours en bas à gauche de la feuille.", " ", el("a", { href: "#/help/sources/drawing" }, "Sources de la méthode →"))));
    body.append(wordsSection(texts, `${id}${spec.name ? ` — ${spec.name}` : ""}`));
    if (st.doc && !isAsm) body.append(el("div", { class: "side-section" }, el("h3", null, "Envoi"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Le PDF et le dessin natif Onshape partent avec l'assemblage."), el("a", { class: "btn btn-small", href: "#/onshape" }, icon("onshape"), "Envoyer vers Onshape")));
  }
  app.commands = [{ label: "Dessin : télécharger le PDF", hint: "dessin", icon: "pdf", keys: "pdf dessin drawing", run: pdf }];
  renderRight(); build();
  return () => { off(); st.token++; setGuide([]); };
}

registerModule({ key: "drawings", label: "Dessins", icon: "drawing", tip: "Dessin 2D de chaque pièce et de chaque assemblage, au format tabloïd : vues, cotes à bulles, classes SC / CSC, GD&T selon ASME Y14.5, nomenclature, cartouche — PDF vectoriel", render });
