/* DynamiteOrbit.ai — a routing sheet on screen, whatever it describes (the manufacture of a part, the assembly of a
   product or of a board) : phase by phase — station, work holding, operations, tools, checks — with a note per phase
   kept in the artefact, the points to discuss, the sheet as text, Word and PDF with the pictures of the view, and the
   AI round trip on the artefact, the computed sheet given for reference. */

import { el, icon, btn, badge, toast, download, copyText, inUnits } from "../core/dom.js";
import { getUnits, docUnits } from "../core/units.js";
import { boardProse, boardDoc } from "../pcba/board_units.js";
import { app, docMeta } from "../core/app.js";
import { store } from "../core/store.js";
import { planText, planDoc, planKeys, PLAN_KINDS } from "../core/plan_doc.js";
import { docx } from "../core/docx.js";
import { pdfDoc } from "../core/pdfdoc.js";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bytesOf = (url) => { const b = atob(String(url).split(",")[1] || ""), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

/** The 3D view as it stands, as a figure for the documents : a picture in the Word file and in the PDF. */
export function shot(viewer, caption, phase, width = 95) {
  const png = bytesOf(viewer.snapshot()), jpeg = viewer.snapshotJpeg(0.86), w = viewer.canvas.width || 4, h = viewer.canvas.height || 3, fw = Math.min(width, 100 * (w / h));
  return { png, pngSize: [w, h], width: fw, height: fw * (h / w), caption, phase, draw: (sheet, x, y, dw, dh) => sheet.image(x, y, dw, dh, jpeg) };
}
/** What the AI needs to annotate a routing sheet : the sheet as computed, and where its notes go. */
export const planAiHelp = (plan) => ({ context: `${planText(plan)}\n\n${planKeys(plan)}`,
  help: ["La gamme donnée pour référence est calculée par l'outil à partir de l'artéfact : on ne la renvoie pas. Pour la changer, change ce qui la produit (opérations, matière première, interfaces, ordre).",
    `Pour l'annoter : sous « plan », « notes » porte une note par phase (clé de phase = texte de la note) et chaque ligne « point » un point à discuter avec ${PLAN_KINDS[plan.kind].audience}.`,
    ...(plan.kind === "assemblage" ? ["« plan order=[…] » fixe l'ordre de montage : la liste des identifiants des pièces posées (i1, i2…), toutes présentes une seule fois."] : []),
    ...(plan.kind === "fabrication" ? ["« plan order=[…] » fixe l'ordre des phases de l'atelier : la liste de leurs clés (stock, setup:+Z, deburr…) ; « comments » porte la réponse du fournisseur, phase par phase — ne l'invente pas : c'est la sienne."] : [])] });

/* the routing of a board reads as a board does — mil, then inches ; the others in inches */
const sayOf = (plan) => (plan.kind === "carte" ? boardProse : inUnits), docOf = (plan, d) => (plan.kind === "carte" ? boardDoc(d) : docUnits(d, getUnits()));
/** The buttons of a routing sheet. o : { figures() → figures for the documents (may be async), aiKey }. */
export function planBar(plan, o = {}) {
  const name = `${plan.id}_gamme`, doc = async () => docOf(plan, { ...planDoc(plan, { date: new Date(), project: store.project ? store.project.name || store.project.id : "", author: (store.project && store.project.author) || "", figures: o.figures ? await o.figures() : [] }), kind: "Gamme", ...docMeta() });      // Word and PDF read in the units chosen
  const make = async (b, fn) => { b.disabled = true; try { await fn(); } catch (e) { console.error(e); toast(`Gamme : ${e.message}`, "error", 7000); } b.disabled = false; };
  return el("div", { class: "form-actions plan-bar" },
    btn("Word", (e, b) => make(b, async () => download(`${name}.docx`, docx(await doc()), DOCX)), { small: true, primary: true, icon: "download", tip: "La gamme en document Word : phases, images, questions avec une colonne pour les réponses, signatures" }),
    btn("PDF", (e, b) => make(b, async () => download(`${name}.pdf`, pdfDoc(await doc()), "application/pdf")), { small: true, primary: true, icon: "pdf", tip: "Le même document en PDF" }),
    btn("Texte", () => download(`${name}.txt`, sayOf(plan)(planText(plan)), "text/plain;charset=utf-8"), { small: true, icon: "download", tip: "La gamme en texte brut : pour un courriel ou une demande de prix" }),
    btn("", async () => toast((await copyText(planText(plan))) ? "Gamme copiée : collez-la dans votre courriel." : "Copie impossible.", "success"), { small: true, icon: "copy", tip: "Copier la gamme (texte)" }),
    o.aiKey ? btn("IA", () => app.aiLoop && app.aiLoop(o.aiKey, planAiHelp(plan)), { small: true, icon: "sparkle", tip: "Confier à l'IA : la gamme part avec l'artéfact ; ses notes et ses points reviennent, vous validez les changements" }) : null);
}

/** The routing sheet in a panel. o : { selected (phase key), onSelect(phase, index), onNote(key, text), onPoints(list),
    phaseExtra(phase, index) → node, figures, aiKey }. */
export function planPanel(body, plan, o = {}) {
  const K = PLAN_KINDS[plan.kind], say = sayOf(plan), variant = (plan.facts.find(([k]) => k === "Variante") || [])[1];      // a routing is that of one variant of its document, and says which
  body.append(el("div", { class: "side-section" }, el("h3", null, el("span", { class: "grow" }, K.title), badge(`${plan.phases.length} phases`, "neutral")),
    variant ? el("p", { class: "plan-variant", "data-variant": variant }, badge(`Variante : ${variant}`, "info"), el("span", { class: "muted small" }, " La gamme et ses fiches sont celles de cette variante.")) : null,
    el("p", { class: "muted small" }, `Proposition tirée du modèle, à discuter avec ${K.audience}${o.onSelect ? " : cliquez une phase pour la voir dans la vue" : ""}. Vos notes restent dans l'artéfact.`), planBar(plan, o)));
  const list = el("ol", { class: "plan" });
  plan.phases.forEach((ph, i) => {
    const note = el("textarea", { class: "plan-note", rows: ph.note ? 2 : 1, placeholder: "Note de discussion : ce qui est convenu, ce qui est proposé…", "aria-label": `Note de la phase ${ph.n}`, onChange: (e) => o.onNote && o.onNote(ph.key, e.target.value.trim()) });
    note.value = ph.note || "";
    list.append(el("li", { class: `plan-phase${o.selected === ph.key ? " on" : ""}`, "data-phase": ph.key },
      el("div", { class: "plan-head" },
        el(o.onSelect ? "button" : "div", { type: o.onSelect ? "button" : null, class: "plan-pick", "data-tip": o.onSelect ? "Voir cette phase dans la vue (un second clic revient à l'ensemble)" : null, onClick: o.onSelect ? () => o.onSelect(ph, i) : null },
          el("span", { class: "g-n" }, ph.n), el("span", { class: "grow" }, el("b", null, ph.title), ph.station ? el("small", null, ph.station) : null)),
        ph.outsourced ? badge("sous-traité", "warn") : null, o.phaseExtra ? o.phaseExtra(ph, i) : null),
      ph.hold ? el("p", { class: "plan-hold" }, icon("lock"), el("span", null, say(`Prise de pièce : ${ph.hold}`))) : null,
      ph.ops.length ? el("ol", { class: "plan-ops" }, ph.ops.map((op) => el("li", null, el("span", { class: "g-n" }, op.n), el("div", { class: "grow" }, say(op.text),
        op.tools.length ? el("small", null, say(`Outillage : ${op.tools.join(" ; ")}`)) : null, op.control ? el("small", null, say(`Contrôle : ${op.control}`)) : null)))) : null,
      ph.checks.length ? el("ul", { class: "plan-checks" }, ph.checks.map((c) => el("li", null, icon("check"), el("span", null, c)))) : null,
      o.onNote ? note : ph.note ? el("p", { class: "plan-hold" }, `Note : ${ph.note}`) : null));
  });
  body.append(list);
  if (plan.hardware.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Visserie et fournitures"), el("ul", { class: "plan-list" }, plan.hardware.map((h) => el("li", null, el("b", null, `${h.qty} × `), h.name)))));
  if (plan.tools.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Outillage"), el("p", { class: "small" }, say(plan.tools.join(" · ")))));
  if (plan.characteristics.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Caractéristiques à tenir"), el("ul", { class: "plan-list" }, plan.characteristics.map((c) => el("li", null, say(c.text), c.control ? el("small", null, say(c.control)) : null)))));
  const points = plan.points || [], add = el("input", { type: "text", placeholder: "Ajouter un point à discuter…", "aria-label": "Nouveau point à discuter" });
  const push = () => { const t = add.value.trim(); if (t && o.onPoints) o.onPoints([...points, t]); };
  add.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); push(); } });
  body.append(el("div", { class: "side-section" }, el("h3", null, K.ask),
    el("ol", { class: "plan-questions" }, plan.questions.map((q) => el("li", null, badge(q.topic, "neutral"), " ", q.text)),
      points.map((t, i) => el("li", { class: "mine" }, badge("À voir", "info"), " ", t, o.onPoints ? el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer ce point", "data-tip": "Retirer ce point", onClick: () => o.onPoints(points.filter((x, k) => k !== i)) }, icon("cross")) : null))),
    o.onPoints ? el("div", { class: "plan-add" }, add, btn("", push, { small: true, icon: "plus", tip: "Ajouter ce point" })) : null));
  if (plan.advice.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Remarques tirées du modèle"), plan.advice.map((a) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", say(a)))));
}

/** Writes a note or the list of points in the « plan » of an artefact (the object is the artefact being edited). */
export function setPlanNote(x, key, text) { x.plan = x.plan || {}; x.plan.notes = x.plan.notes || {}; if (text) x.plan.notes[key] = text; else delete x.plan.notes[key]; tidy(x); }
export function setPlanPoints(x, list) { x.plan = x.plan || {}; if (list.length) x.plan.points = list; else delete x.plan.points; tidy(x); }
function tidy(x) { if (x.plan.notes && !Object.keys(x.plan.notes).length) delete x.plan.notes; if (!Object.keys(x.plan).length) delete x.plan; }
