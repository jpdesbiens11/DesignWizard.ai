/* DesignWizard.ai — Dessins: the 2D drawing of each part, generated from the 3D and the interfaces — views with hidden
   lines, overall dimensions, hole table, datums and GD&T, notes, title block — shown as SVG and exported as a vector PDF. */

import { el, clear, icon, btn, badge, field, toast, download, fmt } from "../core/dom.js";
import { registerModule, go, setStatus, app } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { SvgSheet } from "../draw/svg.js";
import { PdfSheet } from "../draw/pdf.js";
import { composeDrawing, viewRequest, PAPER, drawingSemantics } from "../draw/part_drawing.js";

/** Build the drawing of a part. Returns {svg, pdfBytes(), info, built}. Shared with Rapport and Onshape. */
export async function makeDrawing(partId, extra = {}) {
  const spec = store.part(partId);
  if (!spec) throw new Error(`Pièce « ${partId} » introuvable.`);
  const built = await kernel.build(spec);
  if (!built.bodies.length) throw new Error(`${partId} n'a pas de volume à dessiner.`);
  const views = await kernel.hlr(partId, viewRequest(), true);
  const d = (store.project.drawing || {}), opts = { size: "A3", projection: d.projection || "third", hidden: d.hidden !== false, drawnBy: d.drawnBy || store.project.author || "", checkedBy: d.checkedBy || "", approvedBy: d.approvedBy || "",
    status: d.status || "Préliminaire", date: new Date().toISOString().slice(0, 10), ...extra };
  const data = { spec, built, views, project: store.project, opts };
  const svg = new SvgSheet({ width: PAPER.A3[0], height: PAPER.A3[1], title: `${spec.id} ${spec.name || ""}` });
  const info = composeDrawing(svg, data);
  return { svg: svg.toString(0), info, built, spec,
    pdfBytes: () => { const pdf = new PdfSheet({ width: PAPER.A3[0], height: PAPER.A3[1], title: `${spec.id} ${spec.name || ""}` }); composeDrawing(pdf, data); return pdf.toBytes(); } };
}
export function svgNode(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml"), node = document.importNode(doc.documentElement, true);
  node.removeAttribute("width"); node.removeAttribute("height"); node.setAttribute("class", "sheet-view");
  return node;
}

function render(main, args) {
  const parts = store.parts.filter((p) => !p.step);
  const id = args[0] && store.part(args[0]) ? args[0] : (parts[0] && parts[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), center = el("div", { style: { overflow: "auto", padding: "1rem" } });
  const root = el("div", { class: "studio" }, left, center, right);
  main.append(root);
  left.append(el("img", { class: "side-mark", src: "img/marks/drawings.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Dessins")));
  const scroll = el("div", { class: "side-scroll" });
  left.append(scroll);
  scroll.append(el("div", { class: "side-section" }, el("h3", null, `Pièces (${parts.length})`), parts.map((p) => el("a", { class: "nav-item" + (p.id === id ? " active" : ""), href: `#/drawings/${encodeURIComponent(p.id)}` }, icon("drawing"), el("span", { class: "grow" }, p.name || p.id), el("small", null, p.id)))));
  if (!id) { center.append(el("div", { class: "empty" }, el("h2", null, "Aucune pièce à dessiner"), el("p", null, "Créez une pièce : son dessin se génère tout seul."), el("a", { class: "btn btn-primary", href: "#/shop" }, "Démarrer par les interfaces"))); right.remove(); root.classList.add("no-right"); return null; }
  const st = { doc: null, token: 0 };
  const d = () => store.project.drawing || {};
  const setD = (key, val, label) => store.commit(`Dessins : ${label}`, (p) => { p.drawing = { ...(p.drawing || {}), [key]: val }; });
  const off = store.on("change", () => { if (!store.part(id)) { go("#/drawings"); return; } build(); });
  async function build() {
    const token = ++st.token;
    if (!st.doc) { clear(center); center.append(el("p", { class: "muted" }, "Projection des vues et mise en page…")); }
    try {
      const doc = await makeDrawing(id);
      if (token !== st.token) return;
      st.doc = doc;
      clear(center); center.append(svgNode(doc.svg));
      setStatus(`Dessin de ${id} à l'échelle ${doc.info.scale}`, "done");
      renderRight();
    } catch (e) { if (token !== st.token) return; clear(center); center.append(el("div", { class: "card" }, el("h2", null, "Dessin impossible"), el("p", { class: "form-error" }, e.message))); }
  }
  function pdf() { if (!st.doc) return; download(`${id}_rev${st.doc.spec.revision || "A"}.pdf`, st.doc.pdfBytes(), "application/pdf"); toast("PDF vectoriel téléchargé.", "success"); }
  function renderRight() {
    clear(right);
    const spec = store.part(id), sem = st.doc ? { datums: st.doc.info.datums, gdt: st.doc.info.gdt } : drawingSemantics(spec, { interfaces: [], bbox: [0, 0, 0, 0, 0, 0] });
    right.append(el("div", { class: "side-head" }, el("h2", null, spec.name || id), btn("PDF", pdf, { primary: true, small: true, icon: "pdf", tip: "Télécharger le dessin en PDF vectoriel (A3)" })));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    const text = (key, label, hint) => field(label, el("input", { type: "text", value: d()[key] || "", onChange: (e) => setD(key, e.target.value, label) }), hint);
    body.append(el("div", { class: "side-section" }, el("h3", null, "Cartouche"), el("div", { class: "form-row" }, text("drawnBy", "Dessiné"), text("checkedBy", "Vérifié")), el("div", { class: "form-row" }, text("approvedBy", "Approuvé"), text("status", "Statut", "Préliminaire, Pour revue, Émis…")),
      el("div", { class: "form-row" }, field("Projection", el("select", { onChange: (e) => setD("projection", e.target.value, "projection") }, [["third", "Troisième dièdre (Amérique du Nord)"], ["first", "Premier dièdre (ISO / Europe)"]].map(([v, l]) => el("option", { value: v, selected: (d().projection || "third") === v }, l)))),
        el("label", { class: "check" }, el("input", { type: "checkbox", checked: d().hidden !== false, onChange: (e) => setD("hidden", e.target.checked, "arêtes cachées") }), "Arêtes cachées")),
      field("Révision de la pièce", el("input", { type: "text", value: spec.revision || "", onChange: (e) => store.updatePart(id, (x) => { x.revision = e.target.value.trim() || undefined; }, `${id} : révision`) }))));
    body.append(el("div", { class: "side-section" }, el("h3", null, "Références et GD&T (tirés des interfaces)"),
      sem.datums.map((x) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, badge(x.letter, "info"), ` face ${x.face} — ${x.why}`)),
      sem.gdt.map((g) => el("p", { style: { fontSize: ".84rem", margin: "0 0 .25rem" } }, badge(g.symbol, "neutral"), ` ${g.diameter ? "Ø" : ""}${fmt(g.tolerance, 2)}${g.modifier === "mmc" ? " Ⓜ" : ""}${g.datums.length ? ` | ${g.datums.join(" | ")}` : ""} — ${g.name}`, g.rule ? el("small", { class: "muted" }, ` (${g.rule})`) : null)),
      !sem.gdt.length && el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Aucune interface : pas de tolérance géométrique générée.")));
    const notes = el("textarea", { rows: 6, value: (spec.notes || []).join("\n"), placeholder: "Une note par ligne (traitement, marquage, contrôle…)" });
    notes.style.fontFamily = "var(--font)"; notes.style.fontSize = ".88rem";
    body.append(el("div", { class: "side-section" }, el("h3", null, "Notes propres à la pièce"), notes, el("div", { class: "form-actions" }, btn("Appliquer les notes", () => store.updatePart(id, (x) => { x.notes = notes.value.split("\n").map((s) => s.trim()).filter(Boolean); }, `${id} : notes du dessin`), { small: true })),
      el("p", { class: "muted", style: { fontSize: ".8rem" } }, "Les notes générales (matériau, tolérances ISO 2768-mK, ébavurage) sont ajoutées automatiquement.")));
    if (st.doc) body.append(el("div", { class: "side-section" }, el("h3", null, "Envoi"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Le PDF et le dessin natif Onshape partent avec l'assemblage."), el("a", { class: "btn btn-small", href: "#/onshape" }, icon("onshape"), "Envoyer vers Onshape")));
  }
  app.commands = [{ label: "Dessin : télécharger le PDF", hint: "dessin", icon: "pdf", keys: "pdf dessin drawing", run: pdf }];
  renderRight(); build();
  return () => { off(); st.token++; };
}

registerModule({ key: "drawings", label: "Dessins", icon: "drawing", tip: "Dessin 2D de chaque pièce : vues, cotes, GD&T tiré des interfaces, cartouche, notes — PDF vectoriel", render });
