/* DesignWizard.ai — the fabrication shop, what leaves it for the supplier (point 13 of the roadmap : « sortir la gamme et la vidéo, ou un
   .pptx de la gamme avec les images des étapes et les mesures intermédiaires ; une case pour que le fournisseur écrive ses commentaires ») :
   the deck — a slide per phase, its picture, its operations, its measures, and a framed box for the supplier's answer — and the film of the
   steps, recorded from the view with its caption burnt in. Each goes out through download(), with the mark of the platform. */

import { download, fmtDims, fmtMass, toast } from "../core/dom.js";
import { pptx } from "../core/pptx.js";
import { confidentialNote } from "../core/brand.js";
import { store } from "../core/store.js";

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const bytesOf = (url) => { const b = atob(String(url).split(",")[1] || ""), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const picture = (viewer) => ({ bytes: bytesOf(viewer.snapshotJpeg(0.86)), type: "jpeg", w: viewer.canvas.width || 4, h: viewer.canvas.height || 3 });
/** The measures of a state, in words. */
export const measureWords = (m) => (m ? [`Encombrement : ${fmtDims(m.size, 1)}`, ...(m.mass ? [`Masse : ${fmtMass(m.mass)}`] : [])] : []);

/** The deck of a routing. o : { plan, spec, viewer, show(i) → Promise (paints step i, returns its measures), scene(i), pathNote(i) → text } → downloads the .pptx */
export async function fabDeck(o) {
  const { plan, spec, viewer } = o, slides = [], d = (store.project && store.project.drawing) || {}, comments = (spec.plan && spec.plan.comments) || {};
  for (let i = 0; i < plan.phases.length; i++) {
    const ph = plan.phases[i], m = await o.show(i), sc = o.scene(i);
    if (i === 0) slides.push({ title: `Gamme de fabrication — ${spec.id}`, sub: `${spec.name || ""} · révision ${spec.revision || "A"}`, image: picture(viewer),
      bullets: [...plan.facts.map(([k, v]) => `${k} : ${v}`), { text: "Les montages sont des montages de PRINCIPE, dessinés par l'outil : l'atelier choisit les siens.", italic: true, bullet: false }] });
    slides.push({ title: `${ph.n} — ${ph.title}`, sub: `${sc.station.label} — ${sc.station.fr}`, image: picture(viewer),
      bullets: [...(ph.hold ? [{ text: `Prise de pièce : ${ph.hold}`, bold: true }] : []), ...ph.ops.map((op) => `${op.n} ${op.text}${op.tools.length ? ` — ${op.tools.join(", ")}` : ""}`), ...ph.checks.map((c) => `Contrôle : ${c}`), ...measureWords(m).map((t) => ({ text: `Après la phase : ${t}`, bold: true })), ...(o.pathNote && o.pathNote(i) ? [{ text: o.pathNote(i), italic: true }] : []), ...(ph.note ? [{ text: `Note : ${ph.note}`, italic: true }] : [])],
      box: { label: "Réponse du fournisseur — ce que l'atelier propose, ce qui est convenu :", text: comments[ph.key] || "" } });
  }
  slides.push({ title: "Questions et points à discuter", bullets: [...plan.questions.map((q) => (typeof q === "string" ? q : q.text || q.q || "")), ...plan.points].filter(Boolean).slice(0, 14), box: { label: "Réponses du fournisseur :", text: "" } });
  download(`${spec.id}_atelier.pptx`, new Blob([pptx({ title: `Gamme de fabrication — ${spec.id}`, slides, confidential: confidentialNote(d.organisation, d.confidentiality) })], { type: PPTX }), PPTX);
  toast(`Diaporama de la gamme : ${slides.length} diapositives, une case de réponse pour le fournisseur sur chacune.`, "success");
}

/** The film of the steps : each step painted, held a moment, its caption burnt into the picture ; where a tool path is written, the tool machines.
    o : { viewer, steps, show(i), play(i) → Promise | null, caption(i), seconds, name } */
export async function recordFilm(o) {
  const src = o.viewer.canvas, w = src.width, h = src.height, can = document.createElement("canvas"); can.width = w; can.height = h;
  if (typeof MediaRecorder === "undefined" || !can.captureStream) { toast("Ce navigateur n'enregistre pas de vidéo : prenez le diaporama.", "warn"); return; }
  const g = can.getContext("2d"), stream = can.captureStream(30), type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4e6 }), chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((ok) => { rec.onstop = ok; });
  let text = "", live = true;
  const frame = () => { if (!live) return; g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0); const bh = Math.max(34, h * 0.075);
    g.fillStyle = "rgba(17,24,39,.82)"; g.fillRect(0, h - bh, w, bh); g.fillStyle = "#ffffff"; g.font = `600 ${Math.round(bh * 0.42)}px system-ui, sans-serif`; g.fillText(text, 14, h - bh * 0.36, w - 28);
    g.fillStyle = "rgba(255,255,255,.9)"; g.font = `${Math.round(bh * 0.3)}px system-ui, sans-serif`; g.fillText("DesignWizard.ai™ — montage de principe", 12, bh * 0.55); requestAnimationFrame(frame); };
  rec.start(250); requestAnimationFrame(frame);
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
  try { for (let i = 0; i < o.steps; i++) { text = o.caption(i); const cut = o.play ? o.play(i) : null;      // a phase whose tool path is written : the tool machines on the film
      if (cut && (await cut)) { await wait(1); continue; } await o.show(i); text = o.caption(i); await wait(o.seconds || 2.2); } }
  finally { live = false; rec.stop(); }
  await done;
  download(`${o.name}_atelier.webm`, new Blob(chunks, { type: "video/webm" }), "video/webm");
  toast(`Film de la gamme : ${o.steps} étapes, enregistré.`, "success");
}
