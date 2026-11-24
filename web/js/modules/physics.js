/* DynamiteOrbit.ai — Physique : recognised hand calculations that answer « does the physics behind this part work ? ».
   A studio like the others. Left : what is entered — the part the dimensions come from, then the inputs by group. Centre :
   the simple model, its diagram in 2D on top and, below, the same model in 3D drawn with the typed dimensions. Right : the
   choice of the model (tiles by physics : a colour, a pictogram), the result, the calculation and the runs kept.
   A value the tool put there is an example : it is marked, the next one to enter blinks, and the report waits.
   Route : #/physics or #/physics/<modelId>/<partId>. Runs added to the report live in project.physics. */

import { el, clear, btn, icon, toast, download } from "../core/dom.js";
import { app, go, registerModule, setStatus, setGuide, docMeta } from "../core/app.js";
import { studyOf, putStudy } from "../analysis/physics/to_fea.js";
import { docx } from "../core/docx.js";
import { pdfDoc } from "../core/pdfdoc.js";
import { xlsx } from "../core/xlsx.js";
import { logoPng } from "../core/brand_logo.js";
import { physicsDoc, physicsBook } from "../analysis/physics/export.js";
import { XL_LIVE } from "../analysis/physics/xl_formulas.js";
import { shot } from "./plan_view.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport } from "../core/viewport.js";
import { arrow, clamp, gem } from "../core/view_marks.js";
import { guideBox, guideCount, nudge } from "../core/guide.js";
import { MODELS, DOMAINS, model, defaults, sessionDefaults, run, prefill, inputActive, inputIssues, exampleKeys, shortTitle, runName, runSheet } from "../analysis/physics/index.js";
import { medium, mediaMenu, mediaValues } from "../analysis/physics/media.js";
import { session } from "../core/access.js";
import { TREE, itemFolderName } from "../google/drive_fs.js";
import { sceneOf } from "../analysis/physics/scene3d.js";
import { sketch, domainIcon } from "./physics_sketch.js";
import { physicsSummary, show, qty, verdictBadge, domainOf, modelTiles, resultPanel, calcPanel, savedPanel, tabBar, validationMark } from "./physics_panels.js";
import { CALC_UNITS, shownUnit, fromShown, fieldValue, converts } from "../core/units.js";

export { physicsSummary, show };

const memory = new Map();        // model id -> last inputs, kept while the page is open
const prefillNotes = new Map();  // model id -> { key: where the value comes from }
const entered = new Map();       // model id -> the keys the designer typed or confirmed
const taken = new Set();         // `${model}|${part}` : what the part says was already carried into the model, once
const ui = { tab: "models", name: "" };    // the tab of the right panel, kept from one model to the next ; the name typed for the run to keep

function render(main, args) {
  let cur = model(args[0]) || null, partId = args[1] && store.part(args[1]) ? args[1] : "", inputs = null, r = null, found = [], alive = true, timer = 0;
  const left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), top = el("div", { class: "phys-2d" }), host = el("div", { class: "phys-3d" }), centre = el("div", { class: "phys-centre" }, top, host);
  main.append(el("div", { class: "studio phys" }, left, centre, right));
  const vp = createViewport(host, { name: () => `${cur ? cur.id : "physique"}_modele`, select: false }), chip = el("span", { class: "chip" }, "3D");
  vp.setStatus(chip);
  const fields = new Map(), derived = new Map(), shownOf = new Map(), guideHost = el("div", { class: "phys-guide" });      // what is typed · what a medium gives (read only) · what a fluid shows
  if (!cur) ui.tab = "models";

  const done = () => { if (!entered.has(cur.id)) entered.set(cur.id, new Set()); return entered.get(cur.id); };
  const notes = () => (cur && prefillNotes.get(cur.id)) || {};
  const examples = () => (cur ? exampleKeys(cur, inputs, new Set([...done(), ...Object.keys(notes())])) : []);
  const take = (id) => { if (!memory.has(id)) memory.set(id, sessionDefaults(id)); return memory.get(id); };      // a model opens with the media it proposes : its properties come from them
  /* another model, another part : the screen stays, the address follows */
  /* what the part says without being built — its material, and for a busbar its strip, its current and its finish — goes into a model
     the first time the two meet : arriving from the busbar screen, the calculation is already the one of that busbar */
  function carry() {
    const spec = partId ? store.part(partId) : null, key = cur && `${cur.id}|${partId}`;
    if (!spec || !cur || taken.has(key) || (entered.get(cur.id) || new Set()).size) return 0;
    taken.add(key); const pf = prefill(cur.id, { spec, built: null }), n = Object.keys(pf.inputs).length;
    if (n) { Object.assign(inputs, pf.inputs); prefillNotes.set(cur.id, { ...(prefillNotes.get(cur.id) || {}), ...pf.notes }); }
    return n;
  }
  function open(id, part = partId) {
    cur = model(id) || null; partId = part; inputs = cur ? take(cur.id) : null; ui.name = ""; const n = carry();
    if (n) toast(`${n} valeur(s) reprise(s) de ${partId}${store.part(partId).busbar ? " (bande, courant, finition, matière)" : " (matière)"} : vérifiez-les.`, "success", 4200);
    try { history.replaceState(null, "", `#/physics${cur ? `/${cur.id}${partId ? "/" + encodeURIComponent(partId) : ""}` : ""}`); } catch (e) { /* a page opened from the disk */ }
    drawLeft(); update(true); drawRight(true);
  }
  const showTiles = (sel) => { ui.tab = "models"; drawRight(); setTimeout(() => { if (alive) nudge(right.querySelector(sel)); }, 60); };
  function goTo(x) {
    if (!cur) { showTiles(".phys-group"); return; }
    const f = x && x.field && fields.get(x.field);
    nudge(f ? f.input : guideHost);
  }
  function confirmAll() { for (const k of examples()) done().add(k); update(); }
  /* a reference case, in the fields of the model : the values of the source, typed — no medium gives them — and none of them is an example of the tool */
  function loadCase(c) {
    const m = model(c.model); if (!m) return;
    const blank = Object.fromEntries((m.media || []).filter((s) => !s.own).map((s) => [s.key, ""])), next = { ...defaults(m.id), ...blank, ...c.inputs };
    memory.set(m.id, next); prefillNotes.delete(m.id); entered.set(m.id, new Set(Object.keys(next))); ui.tab = "calc"; open(m.id);
    toast(`Cas de référence chargé — ${c.title} : les valeurs sont celles de la source. « Valeurs par défaut » revient au modèle.`, "success", 6000);
  }
  /* the same geometry, in the Simulation : a simplified model — the dimensions, the material, the supports and the load of this calculation — made or updated in one step */
  function toSimulation() {
    const s = studyOf(cur.id, r.inputs); if (!s.ok) { toast(s.why, "info", 8000); return; }
    const had = !!store.part(s.id); store.commit(`Modèle simplifié : ${s.part.name}`, (p) => { putStudy(p, s); }, { part: s.id });
    toast(`${had ? "Modèle simplifié mis à jour" : "Modèle simplifié créé"} (${s.id}) — ${s.says}${s.notes.length ? ` ${s.notes[0]}` : ""}`, "success", 10000); go(`#/fea/${encodeURIComponent(s.id)}`);
  }
  const toValidation = () => { ui.tab = "calc"; drawRight(); setTimeout(() => { if (alive) nudge(right.querySelector(".val-section")); }, 60); };

  /* ---------- what follows every change : the run, the guide, the marks on the fields, the views ---------- */
  function update(refit) {
    r = cur ? run(cur.id, inputs) : null;
    const eg = examples();
    found = inputIssues(cur, inputs, r, { examples: eg, read: Object.keys(notes()), part: partId }).map((x) => (x.examples ? { ...x, fix: { label: "Tout confirmer", run: confirmAll } } : x));
    setGuide(found.map((x) => ({ ...x, si: true, go: () => goTo(x) })));
    for (const [key, f] of fields) {
      const v = inputs[key], bad = !f.def.options && (v === null || v === undefined || !Number.isFinite(v) || v < f.def.min || v > f.def.max), isEg = eg.includes(key);
      f.row.style.display = inputActive(f.def, inputs) ? "" : "none";
      f.input.classList.toggle("bad", bad); f.input.classList.toggle("eg", isEg); f.input.classList.toggle("need", isEg && key === eg[0]);
      if (isEg) f.input.dataset.tip = f.slot ? "Média proposé : choisissez le vôtre, ou Entrée pour le garder" : "Valeur d'exemple : tapez la vôtre, ou Entrée pour la garder"; else delete f.input.dataset.tip;
    }
    if (r && r.media) { for (const [key, o] of derived) if (r.media.values[key] !== undefined) o.out.textContent = qty(r.media.values[key], o.unit); for (const [key, host] of shownOf) drawShown(host, r.media.shown.find((x) => x.slot === key)); }      // a fluid changes with its temperature
    clear(guideHost); const g = guideBox(found, { go: goTo, si: true }); if (g) guideHost.append(g);
    drawTop(); if (ui.tab !== "models") drawRight(true);
    clearTimeout(timer); timer = setTimeout(() => { if (alive) drawScene(refit); }, refit ? 0 : 90);
  }

  /* ---------- left : the part the dimensions come from, then the inputs by group ---------- */
  const drawShown = (host, sh) => { clear(host); if (!sh) return; for (const [label, value, unit] of sh.rows) host.append(el("div", { class: "param derived" }, el("label", null, label), el("output", null, `${show(value)}${unit ? ` ${unit}` : ""}`))); if (sh.T !== null) host.append(el("small", { class: "phys-from" }, `↳ ${sh.name} à ${show(sh.T)} °C`)); };
  /* a medium is chosen in a menu — solids first, then liquids, then gases, by group and by name — and what it gives is written beside it, not typed */
  function mediumRow(slot) {
    const id = `phys-${slot.key}`, now = medium(inputs[slot.key]), note = notes()[slot.key], pick = (v) => { inputs[slot.key] = v; done().add(slot.key); if (notes()[slot.key]) delete notes()[slot.key]; drawLeft(); update(true); };
    const select = el("select", { id, "data-field": slot.key, "data-medium": now ? now.state : "", onChange: (e) => pick(e.target.value) }, ...(now ? [] : [el("option", { value: inputs[slot.key] || "", selected: true }, "— valeurs saisies, avant la base des médias —")]),
      mediaMenu(slot.states).flatMap((st) => st.groups.map((g) => el("optgroup", { label: `${st.label} — ${g.group}` }, g.list.map((m) => el("option", { value: m.id, selected: !!now && m.id === now.id }, m.name))))));
    select.addEventListener("keydown", (e) => { if (e.key === "Enter") { done().add(slot.key); update(); } });
    const row = el("div", { class: "param wide medium", "data-key": slot.key }, el("label", { for: id }, slot.label, el("a", { class: "medium-link", href: `#/media${now ? `/${now.id}` : ""}`, "data-tip": "Ouvrir la base des médias : toutes ses propriétés, et d'où elles viennent" }, "base")), select, note ? el("small", { class: "phys-from" }, `↳ ${note}`) : null);
    fields.set(slot.key, { row, input: select, def: { key: slot.key, options: true }, slot });
    return row;
  }
  function drawLeft() {
    clear(left); fields.clear(); derived.clear(); shownOf.clear();
    left.append(el("img", { class: "side-mark", src: "img/marks/physique.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Physique")));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    scroll.append(el("div", { class: "subtabs" }, el("a", { class: "subtab active", href: "#/physics" }, "Modèles analytiques"), el("a", { class: "subtab", href: "#/fea" }, "Simulation")));
    const U = CALC_UNITS, units = el("div", { class: "side-section phys-units" }, el("h3", null, "Unités"), el("p", { class: "muted small", "data-calc-units": "si", style: { margin: 0 } }, "Les calculs s'écrivent en SI — mm, N, MPa, kPa, °C — quel que soit le système choisi pour la conception."), el("a", { class: "btn btn-small", href: "#/media", style: { marginTop: ".45rem" }, "data-tip": "Les solides, les liquides et les gaz que les modèles connaissent, avec leurs propriétés et leurs sources" }, "Base des médias"));      // an engineering calculation is written in SI : nothing here follows the choice of units
    if (!cur) {
      scroll.append(guideHost, units, el("p", { class: "muted small" }, "Des modèles analytiques reconnus et simples — une poutre, un tube, une vis, une ailette — qui répondent à 80 % de la question « la physique derrière cette pièce fonctionne-t-elle ? »."),
        el("p", { class: "muted small" }, "Chaque calcul montre ses formules, ses hypothèses et sa source ; la simulation par éléments finis simplifiés, puis l'essai, confirment le reste. Les entrées du modèle choisi viennent ici."));
      return;
    }
    const d = domainOf(cur);
    scroll.append(el("div", { class: "phys-now", style: `--dom:${d.color}` }, domainIcon(d.id, d.color, 26), el("div", { class: "grow" }, el("b", null, shortTitle(cur)), el("small", null, d.label)),
      btn("Changer", () => showTiles(".phys-tile.sel"), { small: true, tip: "Choisir un autre modèle, dans le volet de droite" })), guideHost, units);
    const pick = el("select", { "aria-label": "Pièce du projet", onChange: (e) => open(cur.id, e.target.value) }, el("option", { value: "" }, "— aucune pièce —"), store.parts.map((p) => el("option", { value: p.id, selected: p.id === partId }, `${p.id} — ${p.name || ""}`)));
    const read = btn("Reprendre ses dimensions", async (e, b) => {
      const spec = store.part(partId), id = cur.id;
      if (!spec) return;
      let built = null;
      b.disabled = true; setStatus("Construction de la pièce…", "busy");
      try { built = await kernel.build(spec); } catch (err) { toast(`La pièce n'a pas pu être construite (${err.message}) : seules les propriétés du matériau sont reprises.`, "error"); }
      setStatus("Prêt");
      if (!alive || !cur || cur.id !== id) return;
      const pf = prefill(id, { spec, built }), n = Object.keys(pf.inputs).length;
      Object.assign(inputs, pf.inputs); prefillNotes.set(id, pf.notes); for (const k of Object.keys(pf.inputs)) done().delete(k);
      toast(n ? `${n} valeur(s) reprise(s) de ${spec.id} : vérifiez-les, l'enveloppe n'est pas toujours la section utile.` : "Ce modèle ne reprend aucune valeur de cette pièce.", n ? "success" : "info");
      drawLeft(); update(true);
    }, { small: true, icon: "ruler", disabled: !partId, tip: "Longueur, section, épaisseur et propriétés du matériau lues sur la pièce choisie" });
    scroll.append(el("div", { class: "side-section" }, el("h3", null, "Pièce du projet (facultatif)"), pick, el("div", { class: "phys-take" }, read), ...[store.parts.length ? null : el("p", { class: "muted small" }, "Aucune pièce dans le projet : entrez les valeurs à la main.")].filter(Boolean)));
    let group = null, sec = null;
    const mv = mediaValues(cur.id, inputs), before = new Map((cur.media || []).map((s) => [s.own ? s.key : (cur.inputs.find((d) => s.gives[d.key]) || {}).key, s]));      // a medium stands before the first value it gives
    for (const d of cur.inputs) {
      if (d.group !== group) { group = d.group; sec = el("div", { class: "side-section" }, el("h3", null, group || "Données")); scroll.append(sec); }
      const slot = before.get(d.key), from = mv.from[d.key];
      if (slot) sec.append(mediumRow(slot));
      if (slot && slot.own) { const host = el("div", { class: "phys-shown" }); shownOf.set(slot.key, host); drawShown(host, mv.shown.find((x) => x.slot === slot.key)); sec.append(host); continue; }      // the choice of the model itself : the menu of media replaces it
      if (from) { const out = el("output", null, qty(mv.values[d.key], d.unit)); derived.set(d.key, { out, unit: d.unit }); sec.append(el("div", { class: "param derived", "data-key": d.key, "data-from": from.medium, "data-tip": `Donné par ${from.name} : changez le média pour changer la valeur` }, el("label", null, d.label), out)); continue; }
      const id = `phys-${d.key}`, note = notes()[d.key];
      let input;
      if (d.options) input = el("select", { id, "data-field": d.key, onChange: (e) => { inputs[d.key] = e.target.value; update(true); } }, d.options.map((o) => el("option", { value: o.value, selected: o.value === String(inputs[d.key]) }, o.label)));
      else {
        input = el("input", { id, "data-field": d.key, type: "number", inputmode: "decimal", value: inputs[d.key] === null || inputs[d.key] === undefined ? "" : String(fieldValue(inputs[d.key], d.unit, U)), min: String(fieldValue(d.min, d.unit, U)), max: String(fieldValue(d.max, d.unit, U)), step: converts(d.unit, U) ? "any" : String(d.step || "any"), class: note ? "flash" : null });
        input.addEventListener("input", () => { inputs[d.key] = input.value === "" ? null : fromShown(Number(input.value), d.unit, U); done().add(d.key); if (notes()[d.key]) delete notes()[d.key]; update(); });
        input.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; done().add(d.key); update(); const next = fields.get(examples()[0]); if (next) next.input.focus(); });
      }
      const row = el("div", { class: `param${d.options ? " wide" : ""}`, "data-key": d.key }, el("label", { for: id }, d.label, d.unit ? el("small", null, shownUnit(d.unit, U)) : null), input, note ? el("small", { class: "phys-from" }, `↳ ${note}`) : null);
      fields.set(d.key, { row, input, def: d }); sec.append(row);
    }
    scroll.append(el("div", { class: "form-actions" }, btn("Valeurs par défaut", () => { Object.assign(inputs, sessionDefaults(cur.id)); prefillNotes.delete(cur.id); entered.delete(cur.id); drawLeft(); update(true); }, { small: true, icon: "refresh", tip: "Revenir aux valeurs d'exemple du modèle" })));
  }

  /* ---------- centre, top : the diagram of the model, with its question and its answer ---------- */
  function drawTop() {
    clear(top); centre.classList.toggle("none", !cur);       // no model yet : the choice of a physics takes the whole centre
    if (!cur) {
      top.append(el("div", { class: "phys-pick" }, el("h2", null, "Quelle physique voulez-vous vérifier ?"), el("div", { class: "phys-doms" }, DOMAINS.map((d) => el("button", { class: "phys-dom", type: "button", style: `--dom:${d.color}`, "data-domain": d.id, onClick: () => showTiles(`.phys-group[data-domain="${d.id}"]`) },
        domainIcon(d.id, d.color, 46), el("b", null, d.label), el("small", null, d.hint), el("span", { class: "phys-count" }, `${MODELS.filter((m) => m.domain === d.id).length} modèles`)))),
        el("p", { class: "muted small" }, "Les modèles sont rangés par physique dans le volet de droite : un clic sur une tuile l'ouvre ici, en 2D et en 3D.")));
      return;
    }
    const d = domainOf(cur), eg = examples().length;
    top.append(el("div", { class: "phys-2d-head", style: `--dom:${d.color}` }, el("span", { class: "phys-chip" }, domainIcon(d.id, "currentColor", 18), d.label), el("div", { class: "grow" }, el("h2", null, cur.question), el("small", { class: "muted" }, cur.title)), verdictBadge(r.verdict)),
      sketch(cur, { fill: true, color: d.color }),
      el("div", { class: "phys-2d-foot" }, el("span", { class: "zone-tag" }, "2D · schéma de principe"), cur.outputs.slice(0, 3).map((x) => el("span", { class: "chip" }, `${x.label} : ${qty(r.values[x.key], x.unit)}`)), eg ? el("span", { class: "chip eg", "data-tip": "Le verdict ne vaut que pour vos valeurs : le guide de gauche dit lesquelles restent des exemples" }, `${eg} valeur${eg > 1 ? "s" : ""} d'exemple`) : null,
        ((v) => el("button", { class: `chip val-chip ${v.n ? (v.bad ? "bad" : "done") : "none"}`, type: "button", "data-tip": "Les exemples publiés contre lesquels ce modèle a été rejoué : la source, ce qu'elle imprime, ce que l'outil trouve, l'écart — onglet « Calcul »", onClick: toValidation }, icon(v.n ? (v.bad ? "warning" : "check") : "minus"), v.text))(validationMark(cur.id)),
        ((s) => el("button", { class: `chip sim-chip${s.ok ? "" : " none"}`, type: "button", "data-study": s.ok ? s.id : "", "aria-disabled": s.ok ? null : "true", "data-tip": s.ok ? `Ouvrir la Simulation sur la même géométrie : ${s.says} C'est un modèle simplifié, rangé à part — pas une pièce du produit.` : `Pas encore dans la Simulation — ${s.why}`, onClick: toSimulation }, icon("physics"), s.ok ? "Simuler cette géométrie" : "Simulation : pas pour ce modèle"))(studyOf(cur.id, r.inputs))));
  }
  /* ---------- centre, bottom : the same model in 3D, with the typed dimensions ---------- */
  function drawScene(refit) {
    const v = vp.viewer;
    v.clear();
    if (!cur) { chip.textContent = "3D · choisissez un modèle"; return; }
    const sc = sceneOf(cur, inputs, CALC_UNITS), own = domainOf(cur).color;      // the part under study takes the colour of its physics, as in the diagram
    for (const s of sc.solids) v.add({ id: s.id, mesh: s.mesh, color: s.color || own, opacity: s.opacity, pickable: false });
    for (const m of sc.marks) { if (m.t === "gem") gem(v, m.at, { color: m.color, tag: "phys" }); else (m.t === "clamp" ? clamp : arrow)(v, m.at, m.dir, { color: m.color, tag: "phys" }); }
    for (const l of sc.labels) v.addLabel(l.at, l.text, "phys", "phys-label");
    v.resize(); if (refit) v.view("iso"); else v.fit();
    chip.textContent = "3D · aux dimensions entrées";
  }

  /* ---------- what a calculation leaves with : the note (Word, PDF) at the template of the house, and the workbook to iterate offline ---------- */
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const meta = () => ({ date: new Date(), project: store.project ? store.project.name || store.project.id : "", author: (store.project && store.project.author) || "" }), slug = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "calcul";
  const nowRun = () => ({ id: "now", name: (ui.name || runName(store.project, cur.id, partId)).trim(), model: cur.id, part: partId || "", inputs: r.inputs, when: new Date().toISOString() });
  const noteOf = (runs, figures) => ({ ...physicsDoc(runs, store.project, { ...meta(), figures }), ...docMeta() });
  const outNow = () => { const one = nowRun(), file = slug(one.name), fig = () => ({ now: shot(vp.viewer, "Le modèle du calcul, aux dimensions entrées", null, 110) }), live = XL_LIVE.includes(cur.id) && r.inputs.fluid !== "custom";
    return { word: () => download(`${file}_note_de_calcul.docx`, docx(noteOf([one], fig())), DOCX), pdf: () => download(`${file}_note_de_calcul.pdf`, pdfDoc(noteOf([one], fig())), "application/pdf"),
      excel: () => download(`${file}_calcul.xlsx`, xlsx(physicsBook(cur.id, r.inputs, { ...meta(), name: one.name, part: partId, version: app.version, logo: logoPng(), confidential: docMeta().confidential })), XLSX),
      note: live ? "Le classeur est vivant : résultats, marges et verdict sont des formules — changez une case jaune, tout suit." : "Classeur : résultats à l'export, et un balayage par donnée — le fluide de ce calcul a été saisi à la main ; choisissez un fluide de la base pour un classeur vivant." }; };
  const outAll = () => { const runs = store.project.physics || [], file = slug(store.project.name || store.project.id || "projet"); return { word: () => download(`${file}_notes_de_calcul.docx`, docx(noteOf(runs)), DOCX), pdf: () => download(`${file}_notes_de_calcul.pdf`, pdfDoc(noteOf(runs)), "application/pdf") }; };
  /* ---------- right : the choice of the model, then what it answers ---------- */
  function drawRight(keep) {
    const was = right.querySelector(".side-scroll"), y = keep && was ? was.scrollTop : 0, rows = physicsSummary(store.project), c = guideCount(found);
    clear(right);
    right.append(el("div", { class: "side-head" }, el("h2", null, cur ? shortTitle(cur) : "Modèles analytiques")),
      tabBar([["models", "Modèles"], ["result", "Résultat", 0, r ? r.verdict : ""], ["calc", "Calcul"], ["saved", "Rapport", rows.length]], ui.tab, (k) => { ui.tab = k; drawRight(); }));
    const body = el("div", { class: "side-scroll" });
    right.append(body);
    if (ui.tab === "models") modelTiles(body, { cur, saved: rows, pick: (id) => open(id) });
    else if (ui.tab === "result") resultPanel(body, { cur, r, waits: c.blocking ? `Le rapport attend : ${c.blocking} point${c.blocking > 1 ? "s" : ""} à entrer ou à corriger — le guide du volet de gauche les montre.` : "",
      blocked: () => { toast("Entrez ou confirmez d'abord les valeurs que le guide demande.", "info"); goTo(found.find((x) => x.level === "error" || x.level === "todo")); },
      name: ui.name || runName(store.project, cur.id, partId), setName: (v) => { ui.name = v; }, out: outNow(),
      save: () => { const entry = { id: `phy-${Date.now().toString(36)}`, name: (ui.name || runName(store.project, cur.id, partId)).trim(), model: cur.id, part: partId || null, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: new Date().toISOString() };
        store.commit(`Physique : ${entry.name}`, (p) => { p.physics = p.physics || []; p.physics.push(entry); }); ui.name = ""; toast(`« ${entry.name} » gardé dans le projet${partId ? `, au nom de ${partId}` : ""}.`, "success"); file(entry); } });
    else if (ui.tab === "calc") calcPanel(body, { cur, r, loadCase });
    else savedPanel(body, { rows, project: store.project, out: outAll(), remove: (id) => store.commit("Physique : calcul retiré du rapport", (p) => { p.physics = (p.physics || []).filter((x) => x.id !== id); }),
      reopen: (id) => { const s = (store.project.physics || []).find((x) => x.id === id); if (!s || !model(s.model)) return; memory.set(s.model, { ...defaults(s.model), ...s.inputs }); prefillNotes.delete(s.model); entered.set(s.model, new Set(Object.keys(sessionDefaults(s.model))));
        ui.tab = "result"; open(s.model, s.part && store.part(s.part) ? s.part : ""); } });
    body.scrollTop = y;
  }

  /* in Drive, the sheet of a kept run is filed with the analyses of its part : 03_Analyses / <pièce> / <nom>.txt */
  async function file(entry) {
    if (!(session.fs && store.mode === "drive")) return;
    try { const part = entry.part ? store.part(entry.part) : null; await session.fs.publish(store.project, [{ path: [TREE.analyses, part ? itemFolderName(part.id, part.name) : "Sans pièce"], name: `${entry.name}.txt`, mime: "text/plain", bytes: runSheet(entry, store.project) }]); toast("Fiche du calcul rangée dans Drive, avec les analyses de la pièce.", "success"); }
    catch (e) { toast(`Drive : la fiche du calcul n'a pas pu être rangée (${e.message}). Le calcul reste dans le projet.`, "error", 7000); }
  }
  const off = store.on("change", () => { if (alive) drawRight(true); });
  /* back from the Simulation of a simplified model : its values are those of the calculation it was made from */
  const made = cur && partId ? store.part(partId) : null;
  if (made && made.study && made.study.model === cur.id) { if (!memory.has(cur.id)) { memory.set(cur.id, { ...defaults(cur.id), ...made.study.inputs }); entered.set(cur.id, new Set(Object.keys(made.study.inputs))); } partId = ""; }
  if (cur) { inputs = take(cur.id); carry(); }
  drawLeft(); update(true); drawRight();
  return () => { alive = false; clearTimeout(timer); off(); vp.dispose(); };
}

registerModule({ key: "physics", label: "Physique", icon: "physics", tip: "Modèles analytiques reconnus : poutre, flambement, vis, tube, dissipateur, busbar… avec verdict, marges et calcul détaillé", render });
