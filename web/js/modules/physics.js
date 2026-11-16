/* DesignWizard.ai — Physique : recognised hand calculations that answer « does the physics behind this part work ? ».
   A studio like the others. Left : what is entered — the part the dimensions come from, then the inputs by group. Centre :
   the simple model, its diagram in 2D on top and, below, the same model in 3D drawn with the typed dimensions. Right : the
   choice of the model (tiles by physics : a colour, a pictogram), the result, the calculation and the runs kept.
   A value the tool put there is an example : it is marked, the next one to enter blinks, and the report waits.
   Route : #/physics or #/physics/<modelId>/<partId>. Runs added to the report live in project.physics. */

import { el, clear, btn, toast } from "../core/dom.js";
import { registerModule, setStatus, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { createViewport } from "../core/viewport.js";
import { arrow, clamp, gem } from "../core/view_marks.js";
import { guideBox, guideCount, nudge } from "../core/guide.js";
import { MODELS, DOMAINS, model, defaults, run, prefill, inputActive, inputIssues, exampleKeys, shortTitle, runName, runSheet } from "../analysis/physics/index.js";
import { session } from "../core/access.js";
import { TREE, itemFolderName } from "../google/drive_fs.js";
import { sceneOf } from "../analysis/physics/scene3d.js";
import { sketch, domainIcon } from "./physics_sketch.js";
import { physicsSummary, show, verdictBadge, domainOf, modelTiles, resultPanel, calcPanel, savedPanel, tabBar } from "./physics_panels.js";

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
  const fields = new Map(), guideHost = el("div", { class: "phys-guide" });
  if (!cur) ui.tab = "models";

  const done = () => { if (!entered.has(cur.id)) entered.set(cur.id, new Set()); return entered.get(cur.id); };
  const notes = () => (cur && prefillNotes.get(cur.id)) || {};
  const examples = () => (cur ? exampleKeys(cur, inputs, new Set([...done(), ...Object.keys(notes())])) : []);
  const take = (id) => { if (!memory.has(id)) memory.set(id, defaults(id)); return memory.get(id); };
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

  /* ---------- what follows every change : the run, the guide, the marks on the fields, the views ---------- */
  function update(refit) {
    r = cur ? run(cur.id, inputs) : null;
    const eg = examples();
    found = inputIssues(cur, inputs, r, { examples: eg, read: Object.keys(notes()), part: partId }).map((x) => (x.examples ? { ...x, fix: { label: "Tout confirmer", run: confirmAll } } : x));
    setGuide(found.map((x) => ({ ...x, go: () => goTo(x) })));
    for (const [key, f] of fields) {
      const v = inputs[key], bad = !f.def.options && (v === null || v === undefined || !Number.isFinite(v) || v < f.def.min || v > f.def.max), isEg = eg.includes(key);
      f.row.style.display = inputActive(f.def, inputs) ? "" : "none";
      f.input.classList.toggle("bad", bad); f.input.classList.toggle("eg", isEg); f.input.classList.toggle("need", isEg && key === eg[0]);
      if (isEg) f.input.dataset.tip = "Valeur d'exemple : tapez la vôtre, ou Entrée pour la garder"; else delete f.input.dataset.tip;
    }
    clear(guideHost); const g = guideBox(found, { go: goTo }); if (g) guideHost.append(g);
    drawTop(); if (ui.tab !== "models") drawRight(true);
    clearTimeout(timer); timer = setTimeout(() => { if (alive) drawScene(refit); }, refit ? 0 : 90);
  }

  /* ---------- left : the part the dimensions come from, then the inputs by group ---------- */
  function drawLeft() {
    clear(left); fields.clear();
    left.append(el("img", { class: "side-mark", src: "img/marks/physique.svg", alt: "" }), el("div", { class: "side-head" }, el("h2", null, "Physique")));
    const scroll = el("div", { class: "side-scroll" });
    left.append(scroll);
    scroll.append(el("div", { class: "subtabs" }, el("a", { class: "subtab active", href: "#/physics" }, "Modèles analytiques"), el("a", { class: "subtab", href: "#/fea" }, "Simulation")));
    if (!cur) {
      scroll.append(guideHost, el("p", { class: "muted small" }, "Des modèles analytiques reconnus et simples — une poutre, un tube, une vis, une ailette — qui répondent à 80 % de la question « la physique derrière cette pièce fonctionne-t-elle ? »."),
        el("p", { class: "muted small" }, "Chaque calcul montre ses formules, ses hypothèses et sa source ; la simulation par éléments finis simplifiés, puis l'essai, confirment le reste. Les entrées du modèle choisi viennent ici."));
      return;
    }
    const d = domainOf(cur);
    scroll.append(el("div", { class: "phys-now", style: `--dom:${d.color}` }, domainIcon(d.id, d.color, 26), el("div", { class: "grow" }, el("b", null, shortTitle(cur)), el("small", null, d.label)),
      btn("Changer", () => showTiles(".phys-tile.sel"), { small: true, tip: "Choisir un autre modèle, dans le volet de droite" })), guideHost);
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
    for (const d of cur.inputs) {
      if (d.group !== group) { group = d.group; sec = el("div", { class: "side-section" }, el("h3", null, group || "Données")); scroll.append(sec); }
      const id = `phys-${d.key}`, note = notes()[d.key];
      let input;
      if (d.options) input = el("select", { id, "data-field": d.key, onChange: (e) => { inputs[d.key] = e.target.value; update(true); } }, d.options.map((o) => el("option", { value: o.value, selected: o.value === String(inputs[d.key]) }, o.label)));
      else {
        input = el("input", { id, "data-field": d.key, type: "number", inputmode: "decimal", value: inputs[d.key] === null || inputs[d.key] === undefined ? "" : String(inputs[d.key]), min: String(d.min), max: String(d.max), step: String(d.step || "any"), class: note ? "flash" : null });
        input.addEventListener("input", () => { inputs[d.key] = input.value === "" ? null : Number(input.value); done().add(d.key); if (notes()[d.key]) delete notes()[d.key]; update(); });
        input.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; done().add(d.key); update(); const next = fields.get(examples()[0]); if (next) next.input.focus(); });
      }
      const row = el("div", { class: `param${d.options ? " wide" : ""}`, "data-key": d.key }, el("label", { for: id }, d.label, d.unit ? el("small", null, d.unit) : null), input, note ? el("small", { class: "phys-from" }, `↳ ${note}`) : null);
      fields.set(d.key, { row, input, def: d }); sec.append(row);
    }
    scroll.append(el("div", { class: "form-actions" }, btn("Valeurs par défaut", () => { Object.assign(inputs, defaults(cur.id)); prefillNotes.delete(cur.id); entered.delete(cur.id); drawLeft(); update(true); }, { small: true, icon: "refresh", tip: "Revenir aux valeurs d'exemple du modèle" })));
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
      el("div", { class: "phys-2d-foot" }, el("span", { class: "zone-tag" }, "2D · schéma de principe"), cur.outputs.slice(0, 3).map((x) => el("span", { class: "chip" }, `${x.label} : ${show(r.values[x.key])} ${x.unit}`.trim())), eg ? el("span", { class: "chip eg", "data-tip": "Le verdict ne vaut que pour vos valeurs : le guide de gauche dit lesquelles restent des exemples" }, `${eg} valeur${eg > 1 ? "s" : ""} d'exemple`) : null));
  }
  /* ---------- centre, bottom : the same model in 3D, with the typed dimensions ---------- */
  function drawScene(refit) {
    const v = vp.viewer;
    v.clear();
    if (!cur) { chip.textContent = "3D · choisissez un modèle"; return; }
    const sc = sceneOf(cur, inputs), own = domainOf(cur).color;      // the part under study takes the colour of its physics, as in the diagram
    for (const s of sc.solids) v.add({ id: s.id, mesh: s.mesh, color: s.color || own, opacity: s.opacity, pickable: false });
    for (const m of sc.marks) { if (m.t === "gem") gem(v, m.at, { color: m.color, tag: "phys" }); else (m.t === "clamp" ? clamp : arrow)(v, m.at, m.dir, { color: m.color, tag: "phys" }); }
    for (const l of sc.labels) v.addLabel(l.at, l.text, "phys", "phys-label");
    v.resize(); if (refit) v.view("iso"); else v.fit();
    chip.textContent = "3D · aux dimensions entrées";
  }

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
      name: ui.name || runName(store.project, cur.id, partId), setName: (v) => { ui.name = v; },
      save: () => { const entry = { id: `phy-${Date.now().toString(36)}`, name: (ui.name || runName(store.project, cur.id, partId)).trim(), model: cur.id, part: partId || null, inputs: r.inputs, values: r.values, checks: r.checks, verdict: r.verdict, when: new Date().toISOString() };
        store.commit(`Physique : ${entry.name}`, (p) => { p.physics = p.physics || []; p.physics.push(entry); }); ui.name = ""; toast(`« ${entry.name} » gardé dans le projet${partId ? `, au nom de ${partId}` : ""}.`, "success"); file(entry); } });
    else if (ui.tab === "calc") calcPanel(body, { cur, r });
    else savedPanel(body, { rows, project: store.project, remove: (id) => store.commit("Physique : calcul retiré du rapport", (p) => { p.physics = (p.physics || []).filter((x) => x.id !== id); }),
      reopen: (id) => { const s = (store.project.physics || []).find((x) => x.id === id); if (!s || !model(s.model)) return; memory.set(s.model, { ...defaults(s.model), ...s.inputs }); prefillNotes.delete(s.model); entered.set(s.model, new Set(Object.keys(defaults(s.model))));
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
  if (cur) { inputs = take(cur.id); carry(); }
  drawLeft(); update(true); drawRight();
  return () => { alive = false; clearTimeout(timer); off(); vp.dispose(); };
}

registerModule({ key: "physics", label: "Physique", icon: "physics", tip: "Modèles analytiques reconnus : poutre, flambement, vis, tube, dissipateur, busbar… avec verdict, marges et calcul détaillé", render });
