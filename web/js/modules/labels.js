/* DesignOrbit.ai — Étiquettes : stickers, rating plates and markings laid on a product. Left, what is entered : the labels of
   the assembly, and for the chosen one its kind, its size, its rotation and its artwork — the mark of the platform, a text,
   an image. Centre, the assembly in 3D : with a label chosen, a click on a face lays it there — flat on a plane, wrapped
   without stretching on a cylinder ; the arrows slide it, R turns it, Delete removes it. Right, what is obtained : the
   artwork at scale, the list for the printer, the files (SVG per label, CSV list). The rules : core/labels.js.
   Route : #/labels/<assembly>. */

import { el, clear, icon, svg, btn, badge, field, toast, fmt, unitField, debounce, modal, copyText, table, download } from "../core/dom.js";
import { registerModule, go, setStatus, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { createViewport } from "../core/viewport.js";
import { buildAssembly, showAssembly } from "../core/asm_scene.js";
import { openInstances } from "../core/asm_levels.js";
import { showLabels } from "../core/label_raster.js";
import { toDwiz } from "../core/dwiz.js";
import { aiRead, aiDiff } from "../core/ai_loop.js";
import { applyAnswer } from "./ai_loop.js";
import { guideBox, needField, nudge } from "../core/guide.js";
import { matInvRigid, matDir, matPoint } from "../cad/vec.js";
import { LABEL_KINDS, LABEL_ARTS, LABEL_SHAPES, IMAGE_LIMIT, blankLabel, brandSticker, nextLabelId, isWrapped, surfaceAt, labelFrame, moveLabel, labelSvg, labelGuide, labelRows, labelsCsv, tidyLabel } from "../core/labels.js";

const KEYS = [["Clic sur une face", "Y poser l'étiquette choisie — à plat sur un plan, enroulée sur un cylindre"], ["Clic sur une étiquette", "La choisir"], ["← → ↑ ↓", "La glisser de 1 mm (Maj : 10 mm · Alt : 0,1 mm)"], ["R", "La tourner de 15° (Maj : dans l'autre sens)"], ["Tab · Suppr", "Étiquette suivante · retirer l'étiquette choisie"]];
const ART_COLOR = { logo: "#0c66e4", text: "#8a7df0", image: "#2f9e5b" }, fr = (x, d = 1) => fmt(x, d);
const pic = (color, ...kids) => svg("svg", { viewBox: "0 0 48 30", width: 64, height: 40, class: "cf-icon", "aria-hidden": "true", style: `--dom:${color}` }, ...kids.flat(Infinity));
const sheet = (x, y, w, h, rx = 3) => svg("rect", { x, y, width: w, height: h, rx, fill: "var(--dom)", "fill-opacity": 0.14, stroke: "var(--dom)", "stroke-width": 1.5 });
const ink = (d, w = 2) => svg("path", { d, fill: "none", stroke: "var(--dom)", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" });
const ART_PIC = {
  logo: () => [sheet(4, 5, 40, 20), ink("M13 11 L10 20 M15 11 L18 20", 1.8), ink("M8.5 19.5 Q14 23.5 19.5 19.5", 1.8), ink("M24 12 H39 M24 18 H34", 2.2)],
  text: () => [sheet(4, 5, 40, 20), ink("M10 12 H38", 2.6), ink("M14 19 H34", 1.6)],
  image: () => [sheet(4, 5, 40, 20), ink("M8 21 L17 12 L24 18 L29 14 L40 22", 1.8), svg("circle", { cx: 33, cy: 10.5, r: 2.4, fill: "var(--dom)" })],
};
const KIND_PIC = {
  sticker: () => [sheet(5, 6, 30, 18, 4), ink("M35 24 Q43 22 43 14", 1.6), ink("M35 24 L43 14", 1.2)],                    // a corner that peels
  plate: () => [sheet(5, 6, 38, 18, 1), ...[[9, 10], [39, 10], [9, 20], [39, 20]].map(([x, y]) => svg("circle", { cx: x, cy: y, r: 1.5, fill: "var(--dom)" })), ink("M15 13 H33 M15 18 H28", 1.6)],
  marking: () => [svg("rect", { x: 5, y: 6, width: 38, height: 18, rx: 2, fill: "currentColor", "fill-opacity": 0.14, stroke: "currentColor", "stroke-width": 1.2 }), ink("M11 12 H37 M11 18 H30", 2), ink("M40 3 L36 9", 1.4)],
};
const tile = (o) => el("button", { class: `cf-tile${o.sel ? " sel" : ""}`, type: "button", "aria-pressed": o.sel ? "true" : "false", "data-tip": o.tip || null, style: `--dom:${o.color}`, onClick: o.run, ...o.data }, o.pic, el("b", null, o.label));
/** What goes to an AI : the labels alone, behind a short request ; the answer brings them back. */
const request = (asm, rows) => ["Tu es l'assistant de conception de DesignOrbit.ai. Voici les étiquettes d'un produit (autocollants, plaques signalétiques, marquages) : seul le bloc « labels » se modifie.",
  "ENTREVUE — pose-moi au plus cinq questions, une à la fois : ce que le produit doit dire à qui le regarde (marque, référence, avertissements, tensions), ce que la réglementation de mon marché exige sur la plaque, les couleurs de la marque. Puis résume en trois lignes et attends mon accord.",
  "RÉPONSE ATTENDUE — un seul bloc ```dwiz avec l'assemblage entier, lignes « label » à jour : id, name, kind (sticker, plate ou marking), w et h en mm, turn en degrés, art (type logo, text ou image ; text, sub, ink, paper, shape rect, round ou pill). Ne touche ni à « inst » ni à « on » : la pose se fait à la souris. Garde les repères existants. Après le bloc, liste ce que tu as changé.",
  "", `Étiquettes en place : ${rows.map((r) => `${r.id} ${r.name} (${r.kind}, ${r.w} × ${r.h} mm, ${r.surface} de ${r.on})`).join(" ; ") || "aucune"}.`, "", toDwiz(asm).trimEnd()].join("\n");

function render(main, args) {
  const list = store.assemblies, id = args[0] && store.assembly(args[0]) ? args[0] : (list[0] && list[0].id) || null;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), view = el("div"), root = el("div", { class: "studio" }, left, view, right);
  root.style.setProperty("--right-w", "400px"); main.append(root);
  if (!id) { root.classList.add("no-right"); right.remove(); left.append(el("div", { class: "side-head" }, el("h2", null, "Étiquettes")));
    view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Une étiquette se pose sur un produit"), el("p", null, "Ouvrez un projet qui a un assemblage : les étiquettes se posent sur ses pièces."), btn("Voir les exemples", () => go("#/home"), { primary: true, icon: "home" })))); return null; }
  const st = { sel: null, ctx: null, token: 0, alive: true }, asm = () => store.assembly(id), labels = () => asm().labels || [];
  const change = (label, fn) => store.updateAssembly(id, (a) => { a.labels = a.labels || []; fn(a.labels, a); }, label);
  const item = () => labels().find((l) => l.id === st.sel) || null;
  const edit = (label, fn) => change(label, (L) => { const l = L.find((q) => q.id === st.sel); if (l) fn(l); });
  const open = () => openInstances(asm(), (x) => store.assembly(x));      // every part through the sub-assemblies : a label sits on a part
  const names = () => Object.fromEntries(open().map((i) => [i.id, (store.part(i.part) || {}).name || i.part]));
  const add = (make, where = null) => change("Étiquette ajoutée", (L) => { const l = make(nextLabelId(L)); if (where) Object.assign(l, where); L.push(l); st.sel = l.id; });
  const remove = (lid) => { if (st.sel === lid) st.sel = null; change(`${lid} retirée`, (L) => { const k = L.findIndex((q) => q.id === lid); if (k >= 0) L.splice(k, 1); }); };
  /* a point picked in the view → where a label sits : the instance, and the surface in the coordinates of its part */
  const whereOf = (h) => { const inst = h && h.def && h.def.data && h.def.data.inst, m = inst && st.ctx && st.ctx.sol.placements[inst]; if (!m || !h.normal || h.def.data.label) return null;
    return { inst, on: surfaceAt({ local: h.local, normal: matDir(matInvRigid(m), h.normal), face: h.face }) }; };
  const menuFor = (h) => {
    if (h && h.def && h.def.data && h.def.data.label) { const lid = h.def.data.label; return [{ title: `Étiquette ${lid}` }, { label: `Choisir ${lid}`, icon: "check", run: () => choose(lid) }, { label: `Retirer ${lid}`, icon: "trash", run: () => remove(lid) }]; }
    const w = whereOf(h); if (!w) return h ? [{ title: "Une étiquette se pose sur une face d'une pièce" }] : null;
    const what = isWrapped(w) ? `cylindre Ø ${fr(2 * w.on.r)}` : w.on.tangent ? "face courbe (plan tangent)" : "face plane";
    return [{ title: `${names()[w.inst]} — ${what}` }, ...(item() ? [{ label: `Poser ${st.sel} ici`, icon: "mate", run: () => edit(`${st.sel} posée`, (l) => Object.assign(l, w)) }] : []),
      { label: "La marque DesignOrbit.ai, ici", icon: "sparkle", run: () => add((n) => brandSticker(n), w) }, { label: "Un texte, ici", icon: "edit", run: () => add((n) => blankLabel(n), w) }];
  };
  const onKey = (e) => {
    const l = item(), k = e.key, step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1, all = labels();
    if (k === "Tab" && all.length) { e.preventDefault(); choose(all[(all.findIndex((q) => q.id === st.sel) + 1) % all.length].id); return; }
    if (!l) return;
    const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
    if (d && l.on) { e.preventDefault(); edit(`${l.id} glissée`, (q) => moveLabel(q, d[0] * step, d[1] * step)); }
    else if (k.toLowerCase() === "r") { e.preventDefault(); edit(`${l.id} tournée`, (q) => { q.turn = (((q.turn || 0) + (e.shiftKey ? -15 : 15)) % 360 + 360) % 360; }); }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); remove(l.id); }
  };
  const vp = createViewport(view, { name: () => id, explode: false, select: false, menuFor, onKey, keys: KEYS,
    onPick: (h) => { if (h && h.def && h.def.data && h.def.data.label) { choose(h.def.data.label); return true; }
      const w = whereOf(h); if (w && item()) edit(`${st.sel} posée`, (l) => Object.assign(l, w)); else if (w) toast("Choisissez une étiquette à gauche, ou clic droit : « La marque, ici ».", "info", 4000); return true; } });
  const info = el("span", { class: "chip" }, "—"), verdict = el("span", { class: "chip" }, ""); vp.setStatus(info, verdict);
  const guide = () => labelGuide(labels(), open().map((i) => i.id)).map((x) => ({ ...x, go: () => goTo(x) }));
  function goTo(x) { if (x.id && labels().some((l) => l.id === x.id)) { st.sel = x.id; renderLeft(); mark(); } const f = x.field === "add" ? left.querySelector("[data-add-box]") : left.querySelector(`[data-f="${x.field}"]`) || (x.field === "on" ? view : left.querySelector("[data-label-card]")); if (f) nudge(f); }
  function choose(lid) { st.sel = lid; renderLeft(); renderRight(); mark(); }
  function mark() { const v = vp.viewer; v.clearOverlays("lb"); if (!st.ctx) return;
    for (const l of labels()) { const F = l.on && labelFrame(l), m = F && st.ctx.sol.placements[l.inst]; if (!m) continue; const p = matPoint(m, F.o), on = l.id === st.sel; v.addLabel(p, l.id, "lb", on ? "iface" : "label", () => choose(l.id)); } }
  async function draw() { const token = ++st.token; if (!st.ctx) return; await showLabels(vp.viewer, labels(), st.ctx.sol.placements, { alive: () => st.alive && token === st.token }); if (token !== st.token) return; mark();
    const g = guide(), bad = g.filter((x) => x.level === "error").length, todo = g.filter((x) => x.level === "todo").length, chk = g.filter((x) => x.level === "warn").length, n = labels().length;
    info.textContent = `${n} étiquette(s) · ${labels().filter((l) => l.on).length} posée(s) · ${fr(labels().reduce((a, l) => a + l.w * l.h / 100, 0), 0)} cm²`;
    verdict.textContent = bad ? `${bad} à corriger` : todo ? `${todo} à entrer` : chk ? `${chk} à vérifier` : n ? "prêtes" : ""; verdict.className = `chip ${bad ? "bad" : todo || chk ? "warn" : n ? "done" : ""}`; }
  async function build() { setStatus("Construction de l'assemblage…", "busy");
    try { const ctx = await buildAssembly(asm(), (t) => setStatus(t, "busy")); if (!st.alive) return; st.ctx = ctx; showAssembly(vp.viewer, ctx); vp.viewer.view("iso"); vp.viewer.fit(1.1); setStatus(`${id} prêt`, "done"); await draw(); }
    catch (e) { setStatus(e.message, "error"); } }
  function reimport() {
    const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient l'assemblage dans un bloc ```dwiz." }), out = el("div"); let next = null;
    const ok = btn("Appliquer ces changements", () => { if (!next) return; applyAnswer([`assembly:${id}`], `Étiquettes de ${id} réimportées depuis une IA`, () => change("Étiquettes mises à jour par l'IA", (L, a) => { a.labels = next; })); m.close(); toast("Étiquettes réécrites depuis la réponse de l'IA.", "success"); }, { primary: true, icon: "check", disabled: true });
    area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
      try { const doc = aiRead(area.value); if (!doc || !Array.isArray(doc.labels)) throw new Error("La réponse ne contient pas de lignes « label »."); const old = labels(), L = doc.labels.map((l, k) => { const before = old.find((q) => q.id === l.id); return tidyLabel({ ...l, inst: before ? before.inst : null, on: before ? before.on : null }, k); }), diff = aiDiff(old, L);
        out.append(el("p", null, diff.length ? `${diff.length} changement(s) :` : "Aucun changement dans les étiquettes."), el("ul", { class: "decisions" }, diff.slice(0, 30).map((x) => el("li", null, `${x.path} — ${x.text}`))), guideBox(labelGuide(L, asm().instances.map((i) => i.id)), { title: "Ce que les étiquettes revenues demandent" }) || el("span"));
        if (diff.length) { next = L; ok.disabled = false; }
      } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
    const m = modal("Réimporter les étiquettes depuis une IA", [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  }
  function card(l) {
    const a = l.art || {}, slow = debounce((label, fn) => edit(label, fn), 350), set = (label, fn) => edit(`${l.id} : ${label}`, fn);
    const num = (key, label, step, min, tip) => unitField(label, { value: l[key] ?? 0, step, min, "data-f": key, "data-tip": tip || null }, (v) => { if (v >= min) slow(`${l.id} : ${label}`, (q) => { q[key] = v; }); });
    const txt = el("input", { type: "text", value: a.text || "", placeholder: a.type === "logo" ? "DesignOrbit.ai" : "Ce que dit l'étiquette", "data-f": "text", onChange: (e) => set("texte", (q) => { q.art.text = e.target.value; }) }); if (a.type === "text" && !String(a.text || "").trim()) needField(txt, { hint: "Le texte de l'étiquette" });
    const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/svg+xml", hidden: true, onChange: (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { if (String(rd.result).length > 4 * IMAGE_LIMIT) { toast("Image trop lourde pour le projet : réduisez-la sous 1 Mo environ.", "error", 6000); return; } set("image", (q) => { q.art.src = String(rd.result); }); }; rd.readAsDataURL(f); } });
    const bring = btn(a.src ? "Changer l'image…" : "Apporter l'image…", () => file.click(), { small: true, icon: "upload", tip: "PNG, JPEG ou SVG ; elle est gardée dans le projet" }); bring.dataset.f = "src";
    const color = (key, label) => field(label, el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(a[key] || "") ? a[key] : "#ffffff", "data-f": key, onChange: (e) => set(label, (q) => { q.art[key] = e.target.value; }) }));
    return el("div", { class: "card taped ft-card", "data-label-card": l.id },
      field("Nom", el("input", { type: "text", value: l.name || "", onChange: (e) => set("nom", (q) => { q.name = e.target.value; }) })),
      el("p", { class: "ft-label" }, "Son genre"), el("div", { class: "cf-tiles" }, Object.entries(LABEL_KINDS).map(([k, K]) => tile({ sel: k === l.kind, color: K.color, label: K.label, tip: K.text, pic: pic(K.color, KIND_PIC[k]()), data: { "data-kind": k }, run: () => set(K.label.toLowerCase(), (q) => { q.kind = k; }) }))),
      el("div", { class: "form-row tight" }, num("w", "Largeur (mm)", 1, 1, isWrapped(l) ? `Le long du tour du cylindre (${fr(2 * Math.PI * l.on.r, 0)} mm de tour)` : null), num("h", "Hauteur (mm)", 1, 1), num("turn", "Rotation (°)", 5, 0, "0 : le texte se lit à l'horizontale — autour du cylindre ; 90 : le long de son axe")),
      el("p", { class: "ft-label" }, "Son motif"), el("div", { class: "cf-tiles" }, Object.entries(LABEL_ARTS).map(([k, A]) => tile({ sel: k === a.type, color: ART_COLOR[k], label: A.fr, tip: A.text, pic: pic(ART_COLOR[k], ART_PIC[k]()), data: { "data-art": k }, run: () => set(A.fr.toLowerCase(), (q) => { q.art.type = k; if (k === "logo" && !q.art.text) { q.art.text = "DesignOrbit.ai"; q.art.sub = "by DynamiteAgile™"; } }) }))),
      a.type === "image" ? el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, file, bring, a.src ? el("small", { class: "muted" }, `${Math.round(a.src.length / 1024)} Ko`) : null)
        : el("div", { class: "form-row tight" }, field(a.type === "logo" ? "Nom à côté du sigle" : "Texte", txt), field("Seconde ligne", el("input", { type: "text", value: a.sub || "", onChange: (e) => set("seconde ligne", (q) => { q.art.sub = e.target.value; }) }))),
      el("div", { class: "form-row tight" }, color("ink", "Encre"), color("paper", "Fond"), field("Forme", el("select", { onChange: (e) => set("forme", (q) => { q.art.shape = e.target.value; }) }, Object.entries(LABEL_SHAPES).map(([k, t]) => el("option", { value: k, selected: k === (a.shape || "round") }, t))))),
      el("p", { class: "muted small", "data-f": "on" }, !l.on ? "À poser : cliquez, dans la vue, la face qui la porte." : `Sur ${names()[l.inst] || l.inst} — ${isWrapped(l) ? `enroulée sur un cylindre Ø ${fr(2 * l.on.r)}` : l.on.tangent ? "à plat sur le plan tangent d'une face courbe" : "à plat sur une face plane"}. Un clic sur une autre face la déplace.`),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Motif (.svg)", () => download(`${id}_${l.id}.svg`, labelSvg(l), "image/svg+xml"), { small: true, icon: "download", tip: "Le motif à l'échelle, en millimètres : le fichier pour l'imprimeur" }), btn("Retirer", () => remove(l.id), { small: true, icon: "trash", danger: true })));
  }
  function renderLeft() {
    clear(left); const L = labels();
    left.append(el("div", { class: "side-head" }, el("h2", null, "Étiquettes"), el("a", { class: "btn btn-small", href: `#/assembly/${encodeURIComponent(id)}`, "data-tip": "Ouvrir l'assemblage" }, icon("assembly"))));
    const scroll = el("div", { class: "side-scroll" }); left.append(scroll);
    if (list.length > 1) scroll.append(el("div", { class: "side-section" }, list.map((a) => el("a", { class: "nav-item" + (a.id === id ? " active" : ""), href: `#/labels/${encodeURIComponent(a.id)}` }, icon("assembly"), el("span", { class: "grow" }, a.name || a.id), el("small", null, `${(a.labels || []).length}`)))));
    scroll.append(el("div", { class: "side-section", "data-add-box": "" }, el("h3", null, "Ajouter une étiquette"), el("div", { class: "cf-tiles" }, Object.entries(LABEL_ARTS).map(([k, A]) => tile({ color: ART_COLOR[k], label: A.fr, tip: `${A.text} — puis cliquez la face qui la porte`, pic: pic(ART_COLOR[k], ART_PIC[k]()), data: { "data-add": k }, run: () => add((n) => (k === "logo" ? brandSticker(n) : { ...blankLabel(n), name: k === "image" ? "Image" : "Texte", art: { ...blankLabel(n).art, type: k } })) })))));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, `Étiquettes de l'assemblage (${L.length})`), L.length ? L.map((l) => { const on = l.id === st.sel, K = LABEL_KINDS[l.kind] || LABEL_KINDS.sticker;
      return [el("button", { class: `ft-row${on ? " sel" : ""}`, type: "button", "data-label": l.id, "aria-expanded": on ? "true" : "false", style: `--dom:${K.color}`, onClick: () => choose(on ? null : l.id) }, pic(K.color, KIND_PIC[l.kind] ? KIND_PIC[l.kind]() : KIND_PIC.sticker()),
        el("span", { class: "ft-name" }, el("b", null, l.id), ` ${l.name || K.label}`, el("small", null, `${K.label} · ${fr(l.w, 0)} × ${fr(l.h, 0)} mm · ${l.on ? names()[l.inst] || l.inst : "à poser"}`)), l.on ? null : badge("à poser", "warn")), on ? card(l) : null]; })
      : el("p", { class: "atelier-hint" }, icon("info"), " Aucune étiquette : choisissez un motif ci-dessus, puis cliquez la face qui la porte.")));
    const g = guideBox(guide(), { title: "Ce que les étiquettes demandent", quiet: L.length ? "Posées, lisibles, à leur taille." : "" }); if (g) scroll.append(el("div", { class: "side-section" }, g));
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Avec une IA"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier pour une IA", async () => toast((await copyText(request(asm(), labelRows(labels(), names())))) ? "Copié : les étiquettes et leur consigne." : "Copie impossible.", "success", 5000), { small: true, icon: "sparkle", tip: "Les étiquettes, précédées de la façon de mener l'entrevue et de la réponse attendue" }),
      btn("Réimporter…", reimport, { small: true, icon: "wizard", tip: "Aperçu des changements, puis une seule étape annulable" }))));
  }
  function renderRight() {
    clear(right); const L = labels(), rows = labelRows(L, names()), l = item();
    right.append(el("div", { class: "side-head" }, el("h2", null, "Ce que l'on obtient"), el("a", { class: "btn btn-small", href: `#/render/${encodeURIComponent(id)}`, "data-tip": "Rendu marketing : finitions, décor, image" }, icon("sparkle"))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    if (l) body.append(el("div", { class: "side-section" }, el("h3", null, `${l.id} — le motif, à l'échelle`), el("div", { class: "lb-art" }, el("img", { alt: `Motif de ${l.id}`, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(labelSvg(l, { px: 4 }))}` })), el("p", { class: "muted small" }, `${fr(l.w, 0)} × ${fr(l.h, 0)} mm, soit ${fr(l.w * l.h / 100)} cm².`)));
    if (rows.length) body.append(el("div", { class: "side-section" }, el("h3", null, "La liste pour l'imprimeur"), table(["", "Genre, sur", "mm", "cm²"], rows.map((r) => [r.id, el("span", null, r.kind, el("br"), el("small", { class: "muted" }, `${r.on} — ${r.surface}`)), `${fr(r.w, 0)} × ${fr(r.h, 0)}`, fr(r.area)])),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, btn("Liste (.csv)", () => download(`${id}_etiquettes.csv`, labelsCsv(rows), "text/csv;charset=utf-8"), { small: true, icon: "download" }),
        btn("Tous les motifs (.svg)", () => L.forEach((q, k) => setTimeout(() => download(`${id}_${q.id}.svg`, labelSvg(q), "image/svg+xml"), k * 250)), { small: true, icon: "download", tip: "Un fichier par étiquette, à l'échelle" })),
      el("p", { class: "muted small" }, "Sur un cylindre, l'étiquette est développée sans étirement : un millimètre du motif est un millimètre d'arc. ", el("a", { href: "#/help/sources/project" }, "Sources"))));
    else body.append(el("p", { class: "atelier-hint" }, icon("info"), " La liste et les motifs apparaissent ici dès qu'une étiquette existe."));
    body.append(el("div", { class: "side-section" }, el("h3", null, "À la souris et au clavier"), el("table", { class: "data" }, el("tbody", null, KEYS.map(([k, t]) => el("tr", null, el("td", null, el("kbd", null, k)), el("td", { style: { fontSize: ".8rem" } }, t)))))));
  }
  const refresh = () => { renderLeft(); renderRight(); setGuide(guide()); };
  const off = store.on("change", () => { if (!store.assembly(id)) { go("#/labels"); return; } refresh(); draw(); });
  refresh(); build();
  return () => { st.alive = false; off(); st.token++; setGuide([]); };
}

registerModule({ key: "labels", label: "Étiquettes", icon: "edit", tip: "Étiquettes : autocollants, plaques signalétiques et marquages, à leur taille, posés sur une face plane ou enroulés sur un cylindre", render });
