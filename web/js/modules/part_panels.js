/* DesignWizard.ai — inspector panels of the part studio: parameters (sliders with live rebuild), interfaces,
   DFx findings with one-click fixes, data sheet, raw JSON. */

import { el, clear, icon, btn, badge, field, toast, fmt, fmtMass, fmtLen, fmtDims, inUnits, copyText, download, onOff } from "../core/dom.js";
import { paramAlts, canKeepAlts, addAlt, swapAlt, setAlt, dropAlt } from "../core/variants.js";
import { store } from "../core/store.js";
import { app } from "../core/app.js";
import { interfaceDialog, nextIfaceId } from "../core/part_edit.js";
import { INTERFACE_TYPES, interfaceType } from "../cad/interfaces.js";
import { PROCESSES, materialOrDefault, materialMenu, materialLabel } from "../cad/materials.js";
import { lookSwatch } from "./part_look.js";
import { lookOf, colorName } from "../core/part_look.js";
import { useMakerModel, dropMakerModel } from "../core/elec_parts.js";
import { validateSpec } from "../cad/build.js";
import { applyFix } from "../analysis/dfx_api.js";
import { toDwiz } from "../core/dwiz.js";
import { dwizFileName } from "../core/dwiz_names.js";
import { extractJson } from "../core/importer.js";
import { getUnits, shownUnit, toShown, fromShown, fieldValue, converts } from "../core/units.js";

/* ---------- parameters ---------- */
export function paramsPanel(body, { st, id, live }) {
  const defs = Object.entries(st.spec.params || {});
  if (!defs.length) { body.append(el("p", { class: "muted" }, "Cette pièce n'a pas de paramètres. Ajoutez-en dans l'onglet JSON (« params »), ou demandez-les à l'entrevue.")); return; }
  const raws = st.spec.params || {}, scope = st.built ? st.built.params.scope : {}, pending = {}, U = getUnits();      // a parameter is kept in its own unit (mm) ; it is read and typed in the unit chosen
  const groups = new Map();
  for (const [name, raw] of defs) { const d = raw !== null && typeof raw === "object" ? raw : { value: raw }; const g = d.group || "Paramètres"; if (!groups.has(g)) groups.set(g, []); groups.get(g).push([name, d]); }
  for (const [g, list] of groups) {
    const sec = el("div", { class: "side-section" }, el("h3", null, g));
    for (const [name, d] of list) {
      const derived = d.expr !== undefined, val = typeof d.value === "number" ? d.value : scope[name], unit = d.unit || "", conv = converts(unit, U), back = (x) => fromShown(x, unit, U);
      const num = el("input", { type: derived || typeof d.value === "string" ? "text" : "number", value: derived ? fmt(toShown(scope[name], unit, U), conv ? 4 : 3) : (typeof d.value === "string" ? d.value : fieldValue(val, unit, U)), step: conv ? "any" : d.step || "any", disabled: derived, "aria-label": d.label || name });
      const row = el("div", { class: "param" + (derived ? " derived" : "") }, el("label", { "data-tip": derived ? `Calculé : ${d.expr}` : d.note || null }, d.label || name, el("small", null, name + (unit ? ` · ${shownUnit(unit, U)}` : ""))), num);
      if (!derived && typeof d.value === "number" && typeof d.min === "number" && typeof d.max === "number") {
        const range = el("input", { type: "range", min: toShown(d.min, unit, U), max: toShown(d.max, unit, U), step: toShown(d.step || (d.max - d.min) / 200, unit, U), value: toShown(val, unit, U), "aria-label": `${d.label || name} (curseur)` });
        range.addEventListener("input", () => { num.value = conv ? Number((+range.value).toPrecision(5)) : range.value; pending[name] = back(+range.value); live({ ...pending }); });
        range.addEventListener("change", () => commit(name, back(+range.value), num));
        row.append(range);
      }
      /* other values kept beside this one (off) : a copy to change, then to turn on in its place — the cousins of the part */
      const keeps = !derived && typeof d.value === "number" && canKeepAlts(raws[name]);
      if (keeps) row.querySelector("label").append(el("button", { class: "icon-btn param-copy", type: "button", "aria-label": `Dupliquer la valeur de ${d.label || name}`, "data-tip": "Garder une autre valeur à côté (Off) : changez-la, puis mettez-la à On à la place de celle-ci", onClick: () => store.updatePart(id, (s) => { s.params[name] = addAlt(s.params[name]); }, `${st.spec.id} : ${name}, une valeur gardée de côté`) }, icon("copy")));
      num.addEventListener("keydown", (e) => { if (e.key === "Enter") num.blur(); });
      num.addEventListener("change", () => {
        const v = num.type === "number" ? parseFloat(num.value) : (/^-?\d+([.,]\d+)?$/.test(num.value.trim()) ? parseFloat(num.value.replace(",", ".")) : num.value.trim());
        if (v === "" || (typeof v === "number" && Number.isNaN(v))) { num.classList.add("bad"); return; }
        commit(name, typeof v === "number" ? back(v) : v, num);
      });
      sec.append(row);
      if (keeps) paramAlts(raws[name]).forEach((alt, k) => {
        const input = el("input", { type: "number", value: fieldValue(alt, unit, U), step: conv ? "any" : d.step || "any", "aria-label": `${d.label || name}, valeur gardée ${k + 1}`, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) store.updatePart(id, (s) => { s.params[name] = setAlt(s.params[name], k, back(v)); }, `${st.spec.id} : ${name}, valeur gardée = ${v}`); } });
        sec.append(el("div", { class: "param param-alt" }, el("label", null, onOff(false, () => store.updatePart(id, (s) => { s.params[name] = swapAlt(s.params[name], k); }, `${st.spec.id} : ${name} = ${alt} (valeur mise à On)`), `${d.label || name} = ${fieldValue(alt, unit, U)}`, "Valeur gardée de côté (Off) — cliquer pour la mettre à On : elle prend la place de la valeur du dessus, qui est gardée à son tour"),
          el("small", null, "gardée, à Off"), el("button", { class: "icon-btn param-copy", type: "button", "aria-label": `Retirer la valeur gardée ${k + 1} de ${d.label || name}`, "data-tip": "Retirer cette valeur gardée", onClick: () => store.updatePart(id, (s) => { s.params[name] = dropAlt(s.params[name], k); }, `${st.spec.id} : ${name}, valeur gardée retirée`) }, "×")), input));
      });
    }
    body.append(sec);
  }
  function commit(name, v, input) {
    input.classList.remove("bad");
    const ok = store.updatePart(id, (s) => { if (s.params[name] !== null && typeof s.params[name] === "object") s.params[name].value = v; else s.params[name] = v; }, `${st.spec.id} : ${name} = ${v}`);
    if (ok) { input.classList.remove("flash"); void input.offsetWidth; input.classList.add("flash"); }
  }
  body.append(el("p", { class: "muted", style: { fontSize: ".8rem", marginTop: ".8rem" } }, "Glissez un curseur : la pièce se reconstruit en direct. La valeur est enregistrée quand vous relâchez. Les pièces liées par une interface s'adaptent."));
}

/* ---------- interfaces ---------- */
export function interfacesPanel(body, { st, id, editIface }) {
  const s = st.spec;
  body.append(el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Une interface est le contrat entre cette pièce et sa voisine : même type, même clé, mêmes paramètres des deux côtés. La géométrie, le mate, la visserie et le GD&T en découlent."));
  for (const it of s.interfaces || []) {
    let t = null; try { t = interfaceType(it.type); } catch (e) { t = null; }
    const b = st.built && st.built.interfaces.find((x) => x.id === it.id);
    const mates = [];
    for (const a of store.assemblies) for (const m of a.mates || []) for (const [me, other] of [[m.a, m.b], [m.b, m.a]]) {
      const inst = a.instances.find((i) => i.id === me.inst), o = a.instances.find((i) => i.id === other.inst);
      if (inst && o && inst.part === id && me.iface === it.id) mates.push(`${o.part} (${a.id})`);
    }
    body.append(el("div", { class: "card", style: { marginBottom: ".6rem", padding: ".6rem .7rem" } },
      el("div", { style: { display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, it.name || it.id), badge(`côté ${it.side || "A"}`, it.side === "B" ? "b" : "a"), badge(t ? t.fr : it.type, "neutral"),
        mates.length ? badge("liée", "ok") : badge("libre", "warn")),
      el("p", { class: "muted", style: { margin: ".3rem 0", fontSize: ".82rem" } }, `${it.id} · face ${it.face || "+Z"} · clé ${it.key || "—"}${it.partner ? ` · voisin : ${it.partner}` : ""}`),
      b && el("p", { class: "code", style: { margin: ".2rem 0", fontSize: ".76rem", wordBreak: "break-word" } }, JSON.stringify(b.params)),
      mates.length ? el("p", { style: { margin: ".2rem 0", fontSize: ".82rem" } }, icon("link"), ` Liée à ${mates.join(", ")} : toute modification s'y propage.`) : null,
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", marginTop: ".3rem" } }, btn("Modifier", () => editIface(it.id), { small: true, icon: "edit" }),
        btn("Supprimer", () => store.updatePart(id, (x) => { x.interfaces = x.interfaces.filter((q) => q.id !== it.id); }, `Interface ${it.id} supprimée`), { small: true, icon: "trash", danger: true }))));
  }
  body.append(btn("Ajouter une interface", () => interfaceDialog({ id: nextIfaceId(s), type: "bolt_pattern", side: "A", face: "+Z", at: st.built ? [(st.built.bbox[0] + st.built.bbox[3]) / 2, (st.built.bbox[1] + st.built.bbox[4]) / 2].map((x) => Math.round(x * 10) / 10) : [0, 0] },
    (ni) => store.updatePart(id, (x) => { x.interfaces = x.interfaces || []; x.interfaces.push(ni); }, `Interface ${ni.id} ajoutée`), true), { icon: "plus" }));
  body.append(el("div", { class: "side-section" }, el("h3", null, "Types d'interface"), Object.entries(INTERFACE_TYPES).map(([k, t]) => el("p", { style: { fontSize: ".8rem", margin: "0 0 .35rem" } }, el("b", null, t.label), ` (${k}) — `, t.doc))));
}

/* ---------- DFx ---------- */
export function dfxPanel(body, { st, id, vp }) {
  const res = st.findings;
  if (!res) { body.append(el("p", { class: "muted" }, "Les règles DFx s'évaluent après la construction de la pièce…")); return; }
  if (res.unavailable) { body.append(el("p", { class: "muted" }, "Le moteur de règles DFx n'est pas chargé dans cette version.")); return; }
  const s = res.summary || { errors: 0, warnings: 0, infos: 0, score: 100 };
  body.append(el("div", { class: "kpis" }, el("div", { class: "kpi" }, el("b", null, `${s.score ?? "—"}`), el("span", null, "Score DFx / 100")), el("div", { class: "kpi" }, el("b", null, s.errors), el("span", null, "À corriger")),
    el("div", { class: "kpi" }, el("b", null, s.warnings), el("span", null, "À vérifier"))));
  const proc = PROCESSES[st.spec.process];
  body.append(el("p", { class: "muted", style: { fontSize: ".82rem" } }, `Règles du procédé : ${proc ? proc.fr : "non défini"} · ${(res.rules || []).length} règle(s) évaluée(s). Les règles se relancent à chaque modification.`));
  if (!res.findings.length) body.append(el("div", { class: "card" }, icon("check"), " Aucune remarque : la pièce respecte les règles évaluées."));
  for (const f of res.findings) {
    const card = el("div", { class: `finding ${f.severity}`, onClick: () => { if (f.where) { vp.viewer.clearOverlays("focus"); vp.viewer.addMarker(f.where, "#0c66e4", "focus", 1.8); } } }, el("span", { class: "sev" }),
      el("div", null, el("b", null, f.title), el("span", { class: "id" }, f.id)), el("p", null, inUnits(f.message)));
    if (f.fix && f.fix.patch) card.append(btn(inUnits(f.fix.label) || "Appliquer le correctif", (e) => {
      e.stopPropagation();
      try { store.updatePart(id, (x) => applyFix(x, f.fix.patch), `Correctif ${f.id} : ${f.fix.label || ""}`); toast(`Correctif appliqué : ${f.fix.label || f.id}`, "success"); } catch (err) { toast(err.message, "error"); }
    }, { small: true, icon: "sparkle", cls: "fix", tip: "Applique le correctif proposé (annulable avec Ctrl+Z)" }));
    body.append(card);
  }
}

/* ---------- the maker's 3D model of a library part : the designer downloads it for the part number chosen, it replaces the indicative shape ---------- */
function makerModel(s, id) {
  const L = s.library, has = !!s.step, file = el("input", { type: "file", accept: ".step,.stp", hidden: true, "data-maker-file": "1", onChange: async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const text = await f.text(); store.updatePart(id, (x) => { useMakerModel(x, text, f.name); }, `${s.id} : modèle 3D du fabricant (${f.name})`); toast(`Modèle ${f.name} mis à la place de la forme indicative. Vérifiez la place des interfaces.`, "success", 6000); }
    catch (err) { toast(err.message, "error", 8000); } e.target.value = ""; } });
  return el("div", { class: "side-section", "data-maker-model": has ? "step" : "indicative" }, el("h3", null, "Modèle 3D du fabricant"),
    el("p", { class: "small" }, has ? `Modèle fourni : ${(s.step && s.step.file) || L.model || "fichier STEP"}. La référence, les interfaces et les notes de la bibliothèque sont gardées.` : `La forme affichée est indicative : elle distingue le genre et prend la bonne place. Pour la référence exacte de ${L.maker} ${L.series}, téléchargez son modèle STEP sur le site du fabricant et mettez-le ici.`),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, file, btn(has ? "Changer de fichier STEP…" : "Mettre le modèle STEP…", () => file.click(), { small: true, icon: "upload", primary: !has, tip: "Un fichier .step ou .stp téléchargé chez le fabricant pour la référence choisie. Il est gardé dans le projet." }),
      el("a", { class: "btn btn-small", href: `https://duckduckgo.com/?q=${encodeURIComponent(`${L.maker} ${L.series} 3D model STEP`)}`, target: "_blank", rel: "noopener noreferrer", "data-tip": "Ouvre une recherche dans un nouvel onglet : le modèle se télécharge sur le site du fabricant, avec la référence exacte" }, icon("external"), "Chercher chez le fabricant"),
      ...(has ? [btn("Revenir à la forme indicative", () => store.updatePart(id, (x) => { dropMakerModel(x); }, `${s.id} : forme indicative`), { small: true, icon: "undo" })] : [])),
    el("p", { class: "muted small" }, "Le modèle d'un fabricant lui appartient : la plateforme ne le copie pas et ne le publie pas, elle garde seulement dans votre projet le fichier que vous y mettez."));
}
/* ---------- data sheet ---------- */
export function sheetPanel(body, { st, id }) {
  const s = st.spec, b = st.built, set = (key, label) => (e) => store.updatePart(id, (x) => { if (e.target.value === "") delete x[key]; else x[key] = e.target.value; }, `${s.id} : ${label} modifié`);
  const text = (key, label, hint) => field(label, el("input", { type: "text", value: s[key] || "", onChange: set(key, label) }), hint);
  const mat = materialOrDefault(s.material);
  body.append(text("name", "Nom"), field("Numéro de pièce", el("input", { type: "text", value: s.id, disabled: true })), text("function", "Fonction", "Une phrase : à quoi sert la pièce dans le produit."),
    field("Matériau", el("select", { onChange: set("material", "matériau") }, el("option", { value: "" }, "— à définir —"), materialMenu().map((f) => el("optgroup", { label: f.family }, f.list.map((m) => el("option", { value: m.id, selected: m.id === s.material }, materialLabel(m))))))),
    field("Procédé", el("select", { onChange: set("process", "procédé") }, el("option", { value: "" }, "— à définir —"), Object.entries(PROCESSES).map(([k, p]) => el("option", { value: k, selected: k === s.process }, p.label))),
      s.material && s.process && mat.processes && mat.processes.length && !mat.processes.includes(s.process) ? "Ce matériau n'est pas courant pour ce procédé." : null),
    text("finish", "Finition"), text("revision", "Révision"),
    el("div", { class: "field look-field" }, el("span", { class: "field-label" }, "Couleur à l'écran"), el("div", { class: "look-line" }, lookSwatch(s, { big: true }), el("span", null, lookOf(s).color ? colorName(lookOf(s).color) : `celle de la matière (${mat.name})`)),
      el("span", { class: "field-hint" }, "Pour reconnaître la pièce d'un coup d'œil, ici et dans l'assemblage. Ce n'est pas la finition.")));
  if (s.library && s.family === "connector") body.append(makerModel(s, id));
  const elec = s.elec || {};
  body.append(el("div", { class: "side-section" }, el("h3", null, "Rôle électrique (analyse d'isolation)"),
    el("div", { class: "form-row" }, field("Rôle", el("select", { onChange: (e) => store.updatePart(id, (x) => { x.elec = { ...(x.elec || {}), kind: e.target.value || undefined }; }, `${s.id} : rôle électrique`) },
      [["", "Automatique (selon le matériau)"], ["conductor", "Conducteur"], ["insulator", "Isolant"], ["chassis", "Chassis"], ["none", "Ignoré"]].map(([k, l]) => el("option", { value: k, selected: k === (elec.kind || "") }, l)))),
      field("Net", el("input", { type: "text", value: elec.net || "", placeholder: "HV+, GND…", onChange: (e) => store.updatePart(id, (x) => { x.elec = { ...(x.elec || {}), net: e.target.value.trim() || undefined }; }, `${s.id} : net`) })))));
  if (b) body.append(el("div", { class: "side-section" }, el("h3", null, "Propriétés calculées"), el("table", { class: "data" }, el("tbody", null,
    [["Masse", fmtMass(b.mass)], ["Volume", fmtLen(b.volume / 1000, 2, "cm³")], ["Enveloppe", fmtDims([b.bbox[3] - b.bbox[0], b.bbox[4] - b.bbox[1], b.bbox[5] - b.bbox[2]], 2)],
      ["Centre de gravité", fmtDims(b.cog, 1).replace(/ × /g, " ; ")], ["Corps", b.bodies.map((x) => x.name).join(", ")], ["Trous", String(b.facts.holes.length)], ["Densité", `${mat.rho} g/cm³`]].map(([k, v]) => el("tr", null, el("td", null, k), el("td", null, v)))))));
  if (b && b.log.length) body.append(el("div", { class: "side-section" }, el("h3", null, "Journal du noyau"), b.log.map((l) => el("p", { class: l.level === "error" ? "form-error" : "muted", style: { fontSize: ".82rem" } }, l.msg))));
  if (s.interview) body.append(el("div", { class: "side-section" }, el("h3", null, "Entrevue d'origine"),
    (s.interview.questions || []).map((q) => el("p", { style: { fontSize: ".82rem" } }, el("b", null, q.q), " — ", q.a)), (s.interview.assumptions || []).map((a) => el("p", { class: "muted", style: { fontSize: ".82rem" } }, "Hypothèse : ", a))));
}

/* ---------- the part file: .dwiz (the platform's format) or its JSON twin ---------- */
export function jsonPanel(body, { st, id }) {
  const MARK = "[STEP importé : non modifiable ici]", big = st.spec.step && typeof st.spec.step === "object" && String(st.spec.step.text || "").length > 2000;
  const shown = big ? { ...st.spec, step: { ...st.spec.step, text: MARK } } : st.spec;
  let json = false;
  const ta = el("textarea", { rows: 26, spellcheck: false }), err = el("p", { class: "form-error" });
  const show = () => { ta.value = json ? JSON.stringify(shown, null, 1) : toDwiz(shown); };
  const flip = btn("Voir en JSON", () => { json = !json; flip.lastChild.textContent = json ? "Voir en .dwiz" : "Voir en JSON"; show(); }, { small: true, icon: "refresh" });
  show();
  body.append(el("p", { class: "muted", style: { fontSize: ".82rem" } }, "La pièce dans le format de la plateforme (.dwiz) : une instruction par ligne, lisible par un humain, un atelier et une IA. Modifiez-la ici, ou recollez la réponse d'une entrevue (.dwiz ou JSON)."), ta, err,
    el("div", { class: "form-actions" }, flip, btn("Copier", async () => toast((await copyText(ta.value)) ? "Texte copié." : "Copie impossible."), { small: true, icon: "copy" }),
      btn(".dwiz", () => download(dwizFileName(st.spec), toDwiz(st.spec), "text/plain;charset=utf-8"), { small: true, icon: "download", tip: "Télécharger la fiche de pièce .dwiz" }),
      btn("Confier à l'IA", () => app.aiLoop && app.aiLoop(`part:${id}`), { small: true, icon: "sparkle", tip: "Exporter la pièce avec une demande, réimporter la réponse et voir les changements avant de les appliquer" }),
      btn("Appliquer", () => {
        const obj = extractJson(ta.value), v = obj && !Array.isArray(obj) ? validateSpec(obj) : null;
        if (!v) { err.textContent = extractJson.error || "Texte illisible : ni .dwiz, ni JSON de pièce."; return; }
        if (v.errors.length) { err.textContent = v.errors.join("\n"); return; }
        if (big && obj.step && obj.step.text === MARK) obj.step = st.spec.step;
        obj.id = id;
        store.updatePart(id, () => obj, `${id} : fichier modifié`);
        toast("Pièce mise à jour.", "success");
      }, { primary: true, small: true })));
}
